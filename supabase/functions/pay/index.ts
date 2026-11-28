// The payment service's front door, used by the in-page checkout (src/features/checkout) and the Ramadan give flow.
// `start` makes a pending donation row, picks the provider for the charity and the way to pay (_shared/payments/registry.ts), and starts
// its payment; `status` asks that provider how it ended. Providers live in _shared/payments, one module each.
// One donation row per attempt_key, and the key is also the provider's idempotency key, so a retried request can never charge twice.
// The donation row is only marked succeeded from what the provider says (here on `status`, and by stripe-webhook).
import { admin, fail, json, serve } from "../_shared/deps.ts";
import { guard } from "../_shared/fraud/guard.ts";
import { platformFeeFor } from "../_shared/money.ts";
import { provider, route } from "../_shared/payments/registry.ts";
import type { Account } from "../_shared/payments/types.ts";
import { type PayInput, type PayOut, type StartInput, totals, validate } from "./logic.ts";
import { scheduleStatus, startNights } from "../nightly-charge/schedule.ts";

type DB = ReturnType<typeof admin>;
type Row = Record<string, unknown> & { id: string; org_id: string; status: string; amount_cents: number; cover_cents: number; tip_cents: number; currency: string; pay_method: string; provider: string | null };

/** Only a gift that is still open becomes succeeded, so a refund or dispute is never undone. The webhook sends the receipt. */
const markPaid = (db: DB, id: string) => db.from("donations").update({ status: "succeeded", pay_error: null }).eq("id", id).in("status", ["pending", "failed"]);
const refused = (id: string, code: string, message: string): PayOut => ({ status: "failed", id, error: { code, message } });

const start = async (b: StartInput) => {
    const db = admin();
    const currency = b.currency.toUpperCase(), freq = b.freq ?? "once", key = b.attempt_key, m = totals(b);
    const { data: rate } = await db.from("fx_rates").select("currency").eq("currency", currency).maybeSingle();
    if (!rate) return fail(`${currency} is not supported yet`);
    // A pledge pay link: the pledge decides the org and currency, and caps the gift at what is left. A paid pledge takes no more.
    let pledge: { id: string; org_id: string; currency: string; amount_cents: number; paid_cents: number; written_off: boolean; donor_name: string; donor_email: string | null } | null = null;
    if (b.pledge_token) {
        const { data } = await db.from("pledges").select("id, org_id, currency, amount_cents, paid_cents, written_off, donor_name, donor_email").eq("pay_token", b.pledge_token).maybeSingle();
        if (!data || data.written_off) return fail("This pledge link is not valid", 404);
        if (data.currency !== currency) return fail(`This pledge is in ${data.currency}`);
        const left = Number(data.amount_cents) - Number(data.paid_cents);
        if (left <= 0) return fail("This pledge is already paid. Thank you!", 409);
        if (m.gift > left) return fail("That is more than what is left on the pledge");
        pledge = data;
    }
    let page: { id: string; org_id: string; title: string; status: string } | null = null;
    if (b.page_id) {
        const { data } = await db.from("pages").select("id, org_id, title, status").eq("id", b.page_id).maybeSingle();
        if (!data) return fail("Page not found", 404);
        if (data.status !== "live") return fail("This page is not taking gifts at the moment");
        page = data;
    }
    const { data: org } = await db.from("orgs").select("*").eq("id", page?.org_id ?? pledge?.org_id ?? b.org_id).maybeSingle();
    if (!org) return fail("Organisation not found", 404);
    const on = { card: true, wallets: true, bank: true, dd: true, paypal: true, ...(org.pay_methods ?? {}) } as Record<string, boolean>;
    if (!on[b.method === "wallet" ? "wallets" : b.method]) return json(refused("", "not_configured", `${org.name} doesn’t take this way of paying. Choose another.`));

    const { data: accounts } = await db.from("payment_accounts").select("provider, external_id, charges_enabled, enabled, priority").eq("org_id", org.id);
    const r = route((accounts ?? []) as Account[], b.method, freq !== "once");
    if ("error" in r) {
        const why = { not_offered: "This way of paying is not set up yet. Choose another.", not_ready: `${org.name} has not finished setting up payments yet.`, no_recurring: "This way of paying can only take one-off gifts. Choose another for a regular gift." }[r.error];
        return json(refused("", "not_configured", why));
    }

    // The last ten nights: nothing is charged now. The method is saved on the charity's account; nightly-charge takes each night.
    if (freq === "nights") return json(await startNights(db, { ...b, currency }, org, r.account.external_id));

    // The attempt's row: found if this key has been here before, otherwise made now. The unique index settles two requests racing.
    const find = async () => (await db.from("donations").select("*").eq("attempt_key", key).maybeSingle()).data as Row | null;
    let d = await find();
    const fee = platformFeeFor(m.gift, org.platform_fee_bps);
    if (!d) {
        const { error } = await db.from("donations").insert({
            org_id: org.id, page_id: page?.id ?? null, pledge_id: pledge?.id ?? null, donor_name: b.anonymous ? "Anonymous" : b.donor_name?.trim() || pledge?.donor_name || "Anonymous", donor_email: b.donor_email ?? pledge?.donor_email ?? null, anonymous: !!b.anonymous,
            amount_cents: m.gift, currency, cover_cents: m.cover, tip_cents: m.tip, platform_fee_cents: fee, dedication: b.dedication?.trim() ?? "", cause: b.cause?.trim() ?? "",
            recurring: freq !== "once", source: "card", status: "pending", attempt_key: key, pay_method: b.method, provider: r.provider.id,
            fund: b.fund?.trim() ?? "", gift_aid: !!b.gift_aid, gift_aid_cents: b.gift_aid ? Math.round(m.gift * 0.25) : 0, details: b.details ?? {}, tags: b.tags ?? {},
        });
        d = await find();
        if (!d) return fail(error?.message ?? "Could not start the gift", 500);
        if (!error && b.donor_email) { const { data: p } = await db.from("profiles").select("id").ilike("email", b.donor_email).maybeSingle(); if (p) await db.from("donations").update({ donor_id: p.id }).eq("id", d.id); }
    }
    if (d.org_id !== org.id || d.amount_cents !== m.gift || d.cover_cents !== m.cover || d.tip_cents !== m.tip || d.currency !== currency || d.pay_method !== b.method) return fail("This attempt was started with different details. Start the payment again.", 409);
    if (["succeeded", "refunded", "disputed"].includes(d.status)) return json({ status: "succeeded", id: d.id } satisfies PayOut);

    const row = d;
    const out = await r.provider.start({
        input: { ...b, currency }, donationId: d.id, account: r.account, row,
        org: { id: org.id, name: org.name, platform_fee_bps: org.platform_fee_bps, country: org.country }, title: page ? page.title : org.name,
        amounts: { ...m, platformFee: fee },
        save: async (patch) => { await db.from("donations").update(patch).eq("id", row.id); },
    });
    return json(out);
};

const status = async (id: string) => {
    const db = admin();
    const { data } = await db.from("donations").select("*").eq("id", id).maybeSingle();
    const d = data as Row | null;
    if (!d) { const n = await scheduleStatus(db, id); if (n) return json(n); }
    if (!d || !d.attempt_key) return fail("Payment not found", 404);
    if (["succeeded", "refunded", "disputed"].includes(d.status)) return json({ status: "succeeded", id } satisfies PayOut);
    // Rows from before the payment service have no provider; they were PayPal by pay_method, otherwise Stripe.
    const p = provider(d.provider ?? (d.pay_method === "paypal" ? "paypal" : "stripe"));
    if (!p) return json(refused(id, "unknown", ""));
    const out = await p.status({ donationId: id, row: d });
    if (out.status === "succeeded") await markPaid(db, id);
    return json(out);
};

serve(async (req) => {
    const b = (await req.json()) as PayInput;
    const bad = validate(b); if (bad) return fail(bad);
    // Card-testing limits and the EIN gate, before anything is charged (_shared/fraud).
    if (b.action === "start") { const stop = await guard(req, b); if (stop) return json(stop); }
    try { return b.action === "status" ? await status(b.id) : await start(b); } catch (e) {
        // A refusal from Stripe (bad card data cannot get here; this is things like an unsupported currency for Bacs) goes back as a failed payment with Stripe's code.
        const x = e as { type?: string; code?: string; decline_code?: string; message?: string };
        if (typeof x?.type === "string" && x.type.startsWith("Stripe")) { console.error(e); return json({ status: "failed", id: b.action === "status" ? b.id : "", error: { code: x.type === "StripeConnectionError" ? "network" : x.code, decline_code: x.decline_code } } satisfies PayOut); }
        throw e;
    }
});
