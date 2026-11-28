// The last ten nights, charged night by night. Run every 15 minutes by pg_cron (see the end of 20261128300000_us_checkout.sql),
// with the x-cron-secret header. Each run:
//   1. emails a reminder, with the one-tap cancel link, to schedules whose first night is within a day;
//   2. claims the nights now due (gift_schedule_claim, `for update skip locked`), and for each makes a donation row and an off-session
//      PaymentIntent on the charity's own Stripe account (a direct charge), idempotent on the night, then emails what was given.
// A declined night is marked failed and the donor is told; the other nights still run. stripe-webhook confirms ACH nights later.
//   3. sends the one opt-in reminder for an abandoned checkout (checkout_recovery_claim): the resume link, who it is from, a reply-to,
//      and a one-click unsubscribe (RFC 8058) that closes the draft. POST ?unsubscribe=<token> needs no secret.
// ponytail: no automatic retry of a declined night; add one when charities ask (the claim already re-takes stale 'charging' rows).
import { admin, env, fail, json, serve, SITE_URL, stripe } from "../_shared/deps.ts";
import { fmt, platformFeeFor } from "../_shared/money.ts";
import { send, unsubscribeHeaders } from "../_shared/notify/index.ts";
import { pmTypes } from "../pay/logic.ts";
import { resumeUrl } from "./plan.ts";

interface Due {
    charge_id: string; schedule_id: string; org_id: string; org_name: string; night: number; night_date: string; gift_cents: number; extras_cents: number; cover_cents: number; amount_cents: number;
    currency: string; fund: string; pay_method: string; stripe_account_id: string; stripe_customer_id: string; stripe_payment_method_id: string; donor_name: string; donor_email: string; anonymous: boolean;
    details: Record<string, unknown>; cancel_token: string; platform_fee_bps: number;
}
const cancelUrl = (t: string) => `${SITE_URL()}/checkout?schedule=${t}`;
const mail = (to: string, orgId: string, subject: string, lines: string[]) =>
    send({ to, channel: "email", orgId, subject, body: lines.join("\n\n"), html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#191919;max-width:520px">${lines.map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/(https:\/\/\S+)/g, '<a href="$1" style="color:#191919">$1</a>')}</p>`).join("")}</div>` });

const charge = async (db: ReturnType<typeof admin>, c: Due) => {
    const key = `night_${c.charge_id}`;
    // The night's donation row: the gift and its extras credited to the charity, the covered fee apart. One per night (attempt_key).
    await db.from("donations").upsert({
        org_id: c.org_id, donor_name: c.anonymous ? "Anonymous" : c.donor_name, donor_email: c.donor_email, anonymous: c.anonymous,
        amount_cents: c.gift_cents + c.extras_cents, cover_cents: c.cover_cents, tip_cents: 0, platform_fee_cents: platformFeeFor(c.gift_cents + c.extras_cents, c.platform_fee_bps),
        currency: c.currency, recurring: true, source: "card", status: "pending", attempt_key: key, pay_method: c.pay_method, provider: "stripe", fund: c.fund,
        stripe_account_id: c.stripe_account_id, details: { ...c.details, schedule_id: c.schedule_id, night: c.night },
    }, { onConflict: "attempt_key", ignoreDuplicates: true });
    const { data: d } = await db.from("donations").select("id, status").eq("attempt_key", key).single();
    if (!d) throw new Error("no donation row");
    let status = "failed", pi: string | null = null, error: string | null = null;
    try {
        const p = await stripe().paymentIntents.create({
            amount: c.amount_cents, currency: c.currency.toLowerCase(), customer: c.stripe_customer_id, payment_method: c.stripe_payment_method_id,
            payment_method_types: pmTypes(c.pay_method, c.currency), off_session: true, confirm: true,
            description: `Night ${c.night} gift to ${c.org_name}`, metadata: { donation_id: d.id, schedule_id: c.schedule_id, night: String(c.night), fund: c.fund },
            application_fee_amount: platformFeeFor(c.gift_cents + c.extras_cents, c.platform_fee_bps) || undefined,
        }, { idempotencyKey: key, stripeAccount: c.stripe_account_id });
        pi = p.id; status = p.status === "succeeded" ? "succeeded" : p.status === "processing" ? "processing" : "failed";
        if (status === "failed") error = p.last_payment_error?.decline_code ?? p.last_payment_error?.code ?? p.status;
    } catch (e) {
        const x = e as { code?: string; decline_code?: string; raw?: { payment_intent?: { id?: string } } };
        pi = x.raw?.payment_intent?.id ?? null; error = x.decline_code ?? x.code ?? "failed";
    }
    await db.from("donations").update({ stripe_payment_intent_id: pi, ...(status === "succeeded" ? { status: "succeeded" } : status === "failed" ? { status: "failed", pay_error: error } : {}) }).eq("id", d.id).in("status", ["pending", "failed"]);
    await db.from("gift_schedule_charges").update({ status, donation_id: d.id, stripe_payment_intent_id: pi, error, charged_at: new Date().toISOString() }).eq("id", c.charge_id);
    const { data: next } = await db.from("gift_schedule_charges").select("night, amount_cents").eq("schedule_id", c.schedule_id).eq("status", "due").order("night").limit(1).maybeSingle();
    const first = c.donor_name.split(" ")[0];
    await mail(c.donor_email, c.org_id, status === "failed" ? `Night ${c.night}: your gift to ${c.org_name} didn't go through` : `Night ${c.night}: ${fmt(c.amount_cents, c.currency)} to ${c.org_name}`, [
        status === "failed" ? `Assalamu alaikum ${first}, your bank declined tonight's gift of ${fmt(c.amount_cents, c.currency)}, so nothing was taken for night ${c.night}.` : `Assalamu alaikum ${first}, your gift for night ${c.night} of ${fmt(c.amount_cents, c.currency)} has gone to ${c.org_name}. May it be accepted.`,
        next ? `Next: night ${next.night}, ${fmt(next.amount_cents, c.currency)}.` : "That was your last night. JazakAllahu khayran.",
        `See your nights or cancel the rest in one tap: ${cancelUrl(c.cancel_token)}`,
    ]);
    return status;
};

/** The day before the first night: what will be taken and when, with the cancel link. Once per schedule. */
const remind = async (db: ReturnType<typeof admin>) => {
    const soon = new Date(Date.now() + 86400000).toISOString();
    const { data } = await db.from("gift_schedules").select("id, org_id, donor_name, donor_email, currency, cancel_token, orgs(name), gift_schedule_charges(night, due_at, amount_cents, status)").eq("status", "active").is("reminded_at", null).limit(200);
    let n = 0;
    for (const s of (data ?? []) as unknown as { id: string; org_id: string; donor_name: string; donor_email: string; currency: string; cancel_token: string; orgs: { name: string } | null; gift_schedule_charges: { night: number; due_at: string; amount_cents: number; status: string }[] }[]) {
        const due = s.gift_schedule_charges.filter((c) => c.status === "due").sort((a, b) => a.night - b.night);
        if (!due.length || due[0].due_at > soon) continue;
        const total = due.reduce((t, c) => t + c.amount_cents, 0);
        await mail(s.donor_email, s.org_id, `Your last ten nights with ${s.orgs?.name ?? "the charity"} start tonight`, [
            `Assalamu alaikum ${s.donor_name.split(" ")[0]}, your first gift of ${fmt(due[0].amount_cents, s.currency)} goes on night ${due[0].night}, then each night to night ${due.at(-1)!.night}: ${fmt(total, s.currency)} in all.`,
            `Changed your mind? Cancel the nights still to come in one tap: ${cancelUrl(s.cancel_token)}`,
        ]);
        await db.from("gift_schedules").update({ reminded_at: new Date().toISOString() }).eq("id", s.id);
        n++;
    }
    return n;
};

/** One reminder per abandoned checkout, only where the donor gave an email and ticked the opt-in. */
const recoveries = async (db: ReturnType<typeof admin>) => {
    const { data } = await db.rpc("checkout_recovery_claim", { lim: 100 });
    let n = 0;
    for (const r of (data ?? []) as { token: string; email: string; campaign: string; draft: { amount?: number; freq?: string; first?: string }; expires_at: string; org_name: string | null; reply_to: string | null; address: string | null }[]) {
        const who = r.org_name ?? "the charity", unsub = `${env("SUPABASE_URL")}/functions/v1/nightly-charge?unsubscribe=${r.token}`;
        const amount = Number(r.draft.amount) > 0 ? fmt(Math.round(Number(r.draft.amount) * 100), "USD") : "";
        const res = await send({
            to: r.email, channel: "email", fromName: r.org_name ?? undefined, replyTo: r.reply_to ?? undefined, headers: unsubscribeHeaders(unsub),
            subject: `Your gift${amount ? ` of ${amount}` : ""} to ${who} is waiting`,
            body: [
                `Assalamu alaikum${r.draft.first ? ` ${r.draft.first}` : ""}, you started a gift${amount ? ` of ${amount}` : ""} to ${who} and asked us to send you a link to finish it.`,
                `Pick up where you left off: ${resumeUrl(SITE_URL(), r.campaign, r.token)}`,
                `The link works until ${new Date(r.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. This is the only reminder we will send. Don't want it? Unsubscribe: ${unsub}`,
                // CAN-SPAM: a valid postal address. The charity's own (Receipts and safety), else the platform's NOTIFY_POSTAL_ADDRESS.
                `Sent for ${who}${r.address || Deno.env.get("NOTIFY_POSTAL_ADDRESS") ? `, ${r.address || Deno.env.get("NOTIFY_POSTAL_ADDRESS")}` : ""}.`,
            ].join("

"),
        });
        if (res.ok) n++;
    }
    return n;
};

serve(async (req) => {
    // One-click unsubscribe from the abandoned-checkout reminder: closes the draft, so nothing more is sent. No secret: the token is the key.
    const unsub = new URL(req.url).searchParams.get("unsubscribe");
    if (unsub) { if (/^[A-Za-z0-9_-]{16,64}$/.test(unsub)) await admin().rpc("checkout_recovery_done", { t: unsub }); return new Response("You won't get any more emails about this gift.", { headers: { "Content-Type": "text/plain; charset=utf-8" } }); }
    if (req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return fail("Forbidden", 403);
    const db = admin();
    const reminded = await remind(db), recovered = await recoveries(db);
    const { data, error } = await db.rpc("gift_schedule_claim", { lim: 100 });
    if (error) return fail(error.message, 500);
    const out: Record<string, number> = {};
    for (const c of (data ?? []) as Due[]) {
        const r = await charge(db, c).catch(async (e) => { console.error(e); await db.from("gift_schedule_charges").update({ status: "due", claimed_at: null }).eq("id", c.charge_id); return "error"; });
        out[r] = (out[r] ?? 0) + 1;
    }
    return json({ reminded, recovered, ...out });
});
