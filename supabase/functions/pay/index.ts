// Takes a gift from the in-page checkout (src/features/checkout): `start` makes a pending donation row and the provider's payment, `status` says how it ended.
// Stripe: a PaymentIntent (or a Subscription's first invoice) as a destination charge on behalf of the charity, like the checkout function; the browser confirms it with Stripe's Payment Element.
// PayPal: an order paid straight to the charity's merchant id, captured once the donor approves it.
// One donation row per attempt_key, and the key is also the provider's idempotency key, so a retried request can never charge twice.
// The donation row is only marked succeeded from what the provider says (here on `status`, and by stripe-webhook).
import { admin, fail, json, serve, stripe, SITE_URL } from "../_shared/deps.ts";
import { fromMinor, platformFeeFor, ZERO_DECIMAL } from "../_shared/money.ts";
import { fromIntent, fromPayPal, type PayInput, type PayOut, PM_TYPES, type StartInput, totals, validate } from "./logic.ts";

type Row = { id: string; org_id: string; status: string; amount_cents: number; cover_cents: number; currency: string; attempt_key: string; pay_method: string; stripe_payment_intent_id: string | null; paypal_order_id: string | null };
type DB = ReturnType<typeof admin>;

/** PayPal REST call with a fresh app token. null when PayPal's keys are not set (PAYPAL_CLIENT_ID, PAYPAL_SECRET; PAYPAL_API for the sandbox). */
const paypal = async (path: string, body?: unknown, requestId?: string) => {
    const id = Deno.env.get("PAYPAL_CLIENT_ID"), secret = Deno.env.get("PAYPAL_SECRET");
    if (!id || !secret) return null;
    const base = Deno.env.get("PAYPAL_API") ?? "https://api-m.paypal.com";
    const tok = await (await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" })).json();
    const r = await fetch(`${base}${path}`, { method: body === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json", ...(requestId ? { "PayPal-Request-Id": requestId } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return await r.json();
};

/** Only a gift that is still open becomes succeeded, so a refund or dispute is never undone. The webhook sends the receipt. */
const markPaid = (db: DB, id: string) => db.from("donations").update({ status: "succeeded", pay_error: null }).eq("id", id).in("status", ["pending", "failed"]);
const refused = (id: string, code: string, message: string): PayOut => ({ status: "failed", id, error: { code, message } });

const start = async (b: StartInput) => {
    const db = admin();
    const currency = b.currency.toUpperCase(), cur = currency.toLowerCase(), freq = b.freq ?? "once", key = b.attempt_key, m = totals(b);
    const { data: rate } = await db.from("fx_rates").select("currency").eq("currency", currency).maybeSingle();
    if (!rate) return fail(`${currency} is not supported yet`);
    let page: { id: string; org_id: string; title: string; status: string } | null = null;
    if (b.page_id) {
        const { data } = await db.from("pages").select("id, org_id, title, status").eq("id", b.page_id).maybeSingle();
        if (!data) return fail("Page not found", 404);
        if (data.status !== "live") return fail("This page is not taking gifts at the moment");
        page = data;
    }
    const { data: org } = await db.from("orgs").select("*").eq("id", page?.org_id ?? b.org_id).maybeSingle();
    if (!org) return fail("Organisation not found", 404);
    const on = { card: true, wallets: true, bank: true, dd: true, paypal: true, ...(org.pay_methods ?? {}) } as Record<string, boolean>;
    if (!on[b.method === "wallet" ? "wallets" : b.method]) return json(refused("", "not_configured", `${org.name} doesn’t take this way of paying. Choose another.`));
    if (b.method === "paypal") {
        if (freq !== "once") return json(refused("", "not_configured", "PayPal can only take one-off gifts for now. Choose another way to pay."));
        // TODO(paypal): set PAYPAL_CLIENT_ID and PAYPAL_SECRET (`supabase secrets set`) to switch PayPal on; until then this is the answer.
        if (!org.paypal_merchant_id || !Deno.env.get("PAYPAL_CLIENT_ID") || !Deno.env.get("PAYPAL_SECRET")) return json(refused("", "not_configured", "PayPal is not set up yet. Choose another way to pay."));
    } else if (!org.stripe_account_id || !org.stripe_charges_enabled) return json(refused("", "not_configured", `${org.name} has not finished setting up payments yet.`));

    // The attempt's row: found if this key has been here before, otherwise made now. The unique index settles two requests racing.
    const find = async () => (await db.from("donations").select("*").eq("attempt_key", key).maybeSingle()).data as Row | null;
    let d = await find();
    if (!d) {
        const { error } = await db.from("donations").insert({
            org_id: org.id, page_id: page?.id ?? null, donor_name: b.anonymous || !b.donor_name?.trim() ? "Anonymous" : b.donor_name.trim(), donor_email: b.donor_email ?? null, anonymous: !!b.anonymous,
            amount_cents: m.gift, currency, cover_cents: m.cover, platform_fee_cents: platformFeeFor(m.gift, org.platform_fee_bps), dedication: b.dedication?.trim() ?? "", cause: b.cause?.trim() ?? "",
            recurring: freq !== "once", source: "card", status: "pending", attempt_key: key, pay_method: b.method,
        });
        d = await find();
        if (!d) return fail(error?.message ?? "Could not start the gift", 500);
        if (!error && b.donor_email) { const { data: p } = await db.from("profiles").select("id").ilike("email", b.donor_email).maybeSingle(); if (p) await db.from("donations").update({ donor_id: p.id }).eq("id", d.id); }
    }
    if (d.org_id !== org.id || d.amount_cents !== m.gift || d.cover_cents !== m.cover || d.currency !== currency || d.pay_method !== b.method) return fail("This attempt was started with different details. Start the payment again.", 409);
    if (["succeeded", "refunded", "disputed"].includes(d.status)) return json({ status: "succeeded", id: d.id } satisfies PayOut);

    const title = page ? page.title : org.name;
    const name = `${freq === "once" ? "Gift" : freq === "monthly" ? "Monthly gift" : "Yearly gift"} to ${title}`;
    const meta = { donation_id: d.id, org_id: org.id, page_id: page?.id ?? "" };

    if (b.method === "paypal") {
        const back = new URL(`${(b.origin ?? SITE_URL()).replace(/\/$/, "")}${b.return_to && b.return_to.startsWith("/") ? b.return_to : "/"}`);
        back.searchParams.set("ck_pay", d.id);
        // Idempotent on PayPal-Request-Id, so a retry gets the same order back.
        // ponytail: no platform fee on PayPal gifts (that needs PayPal's partner programme); the charity is the payee and gets the whole gift.
        const o = await paypal("/v2/checkout/orders", {
            intent: "CAPTURE",
            purchase_units: [{ custom_id: d.id, description: name.slice(0, 127), amount: { currency_code: currency, value: fromMinor(m.today, currency).toFixed(ZERO_DECIMAL.has(currency) ? 0 : 2) }, payee: { merchant_id: org.paypal_merchant_id } }],
            payment_source: { paypal: { experience_context: { return_url: back.toString(), cancel_url: back.toString(), user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" } } },
        }, key);
        if (o?.id && !d.paypal_order_id) await db.from("donations").update({ paypal_order_id: o.id }).eq("id", d.id);
        const out = fromPayPal(o ?? {}, d.id);
        return json(out.status === "requires_action" && !out.redirectUrl ? refused(d.id, "unknown", "PayPal could not start the payment.") : out);
    }

    const s = stripe();
    if (d.stripe_payment_intent_id) return json(fromIntent(await s.paymentIntents.retrieve(d.stripe_payment_intent_id), b.method, d.id, true));
    const types = PM_TYPES[b.method], fee = platformFeeFor(m.gift, org.platform_fee_bps), acct = org.stripe_account_id as string;
    if (freq === "once") {
        const pi = await s.paymentIntents.create({ amount: m.today, currency: cur, payment_method_types: types, description: name, metadata: meta, application_fee_amount: fee || undefined, transfer_data: { destination: acct }, on_behalf_of: acct }, { idempotencyKey: key });
        await db.from("donations").update({ stripe_payment_intent_id: pi.id }).eq("id", d.id);
        return json(fromIntent(pi, b.method, d.id, true));
    }
    // A regular gift: a subscription whose first invoice is paid in the page. Each call has its own idempotency key under the attempt's.
    const customer = await s.customers.create({ email: b.donor_email || undefined, name: b.donor_name?.trim() || undefined, metadata: meta }, { idempotencyKey: `${key}:cus` });
    const product = await s.products.create({ name, metadata: meta }, { idempotencyKey: `${key}:prod` });
    const sub = await s.subscriptions.create({
        customer: customer.id, description: name, metadata: meta,
        items: [{ price_data: { currency: cur, unit_amount: m.recur, recurring: { interval: freq === "yearly" ? "year" : "month" }, product: product.id } }],
        add_invoice_items: b.extras_cents ? [{ price_data: { currency: cur, unit_amount: b.extras_cents, product: product.id } }] : undefined,
        payment_behavior: "default_incomplete",
        // deno-lint-ignore no-explicit-any
        payment_settings: { payment_method_types: types as any, save_default_payment_method: "on_subscription" },
        application_fee_percent: m.recur ? Math.round((fee / m.recur) * 10000) / 100 : 0, transfer_data: { destination: acct }, on_behalf_of: acct,
        expand: ["latest_invoice.confirmation_secret"],
    }, { idempotencyKey: `${key}:sub` });
    const inv = sub.latest_invoice as unknown as { id: string; confirmation_secret?: { client_secret?: string } };
    const secret = inv?.confirmation_secret?.client_secret;
    if (!secret) return fail("Could not start the regular gift", 500);
    // The first invoice's PaymentIntent id is the front of its client secret; storing it (and the invoice) lets status and the webhook find this row.
    await db.from("donations").update({ stripe_subscription_id: sub.id, stripe_invoice_id: inv.id, stripe_payment_intent_id: secret.split("_secret_")[0] }).eq("id", d.id);
    return json({ status: "requires_action", id: d.id, clientSecret: secret } satisfies PayOut);
};

const status = async (id: string) => {
    const db = admin();
    const { data } = await db.from("donations").select("*").eq("id", id).maybeSingle();
    const d = data as Row | null;
    if (!d || !d.attempt_key) return fail("Payment not found", 404);
    if (["succeeded", "refunded", "disputed"].includes(d.status)) return json({ status: "succeeded", id } satisfies PayOut);
    if (d.pay_method === "paypal") {
        if (!d.paypal_order_id) return json(refused(id, "unknown", ""));
        let out = fromPayPal((await paypal(`/v2/checkout/orders/${d.paypal_order_id}`)) ?? {}, id);
        if (out.capture) out = fromPayPal((await paypal(`/v2/checkout/orders/${d.paypal_order_id}/capture`, {}, `${d.attempt_key}:cap`)) ?? {}, id);
        // TODO(paypal): no webhook yet, so PayPal gifts get no emailed receipt and a delayed capture (eCheque) is never confirmed here.
        if (out.status === "succeeded") await markPaid(db, id);
        return json({ ...out, capture: undefined });
    }
    if (!d.stripe_payment_intent_id) return json(refused(id, "unknown", ""));
    const out = fromIntent(await stripe().paymentIntents.retrieve(d.stripe_payment_intent_id), d.pay_method, id, false);
    if (out.status === "succeeded") await markPaid(db, id);
    return json(out);
};

serve(async (req) => {
    const b = (await req.json()) as PayInput;
    const bad = validate(b); if (bad) return fail(bad);
    try { return b.action === "status" ? await status(b.id) : await start(b); } catch (e) {
        // A refusal from Stripe (bad card data cannot get here; this is things like an unsupported currency for Bacs) goes back as a failed payment with Stripe's code.
        const x = e as { type?: string; code?: string; decline_code?: string; message?: string };
        if (typeof x?.type === "string" && x.type.startsWith("Stripe")) { console.error(e); return json({ status: "failed", id: b.action === "status" ? b.id : "", error: { code: x.type === "StripeConnectionError" ? "network" : x.code, decline_code: x.decline_code } } satisfies PayOut); }
        throw e;
    }
});
