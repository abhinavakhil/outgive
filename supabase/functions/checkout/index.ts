// Creates a Stripe Checkout Session for a gift (one-off or monthly) and a pending donation row the webhook will confirm.
// The charge is a destination charge on behalf of the charity's connected account; the platform keeps tip + fee as the application fee.
import { admin, fail, json, serve, stripe, SITE_URL } from "../_shared/deps.ts";
import { breakdown, DEFAULT_TIP_PCT, ZERO_DECIMAL } from "../_shared/money.ts";
import { type CheckoutInput, validate } from "./validate.ts";

serve(async (req) => {
    const b = (await req.json()) as CheckoutInput;
    const bad = validate(b); if (bad) return fail(bad);
    const db = admin(); const s = stripe();
    const currency = b.currency.toUpperCase();
    const { data: rate } = await db.from("fx_rates").select("currency").eq("currency", currency).maybeSingle();
    if (!rate) return fail(`${currency} is not supported yet`);

    let page: { id: string; org_id: string; title: string; type: string; slug: string; status: string; currency: string } | null = null;
    if (b.page_id) {
        const { data } = await db.from("pages").select("id, org_id, title, type, slug, status, currency").eq("id", b.page_id).maybeSingle();
        if (!data) return fail("Page not found", 404);
        if (data.status !== "live") return fail("This page is not taking gifts at the moment");
        page = data;
    }
    const { data: org } = await db.from("orgs").select("*").eq("id", page?.org_id ?? b.org_id).maybeSingle();
    if (!org) return fail("Organisation not found", 404);
    if (!org.stripe_account_id || !org.stripe_charges_enabled) return fail(`${org.name} has not finished setting up payments yet. Ask them to connect Stripe from their dashboard.`, 409);

    let ticketName = ""; let unit = b.amount_cents; let qty = 1;
    if (b.ticket_type_id) {
        const { data: t } = await db.from("ticket_types").select("*").eq("id", b.ticket_type_id).maybeSingle();
        if (!t || t.page_id !== page?.id) return fail("Ticket not found", 404);
        qty = Math.max(1, Math.min(20, Math.floor(b.ticket_qty ?? 1)));
        if (t.quantity !== null && t.sold + qty > t.quantity) return fail("Not enough tickets left");
        ticketName = t.name; unit = t.price_cents; b.amount_cents = unit * qty;
        if (b.amount_cents < 100) return fail("Free tickets do not go through checkout");
    }
    const tipPct = org.tips_enabled ? (b.tip_pct ?? DEFAULT_TIP_PCT) : 0;
    const money = breakdown(b.amount_cents, { tipPct, cover: !!b.cover, feeBps: org.platform_fee_bps });

    const { data: supporterId } = await db.rpc("supporter_for", { org: org.id, s_name: b.supporter_name ?? null, s_kind: b.supporter_kind ?? null, s_tagline: b.supporter_tagline ?? null, s_country: b.supporter_country ?? null, s_region: b.supporter_region ?? null, s_link: null });
    const { data: donation, error } = await db.from("donations").insert({
        org_id: org.id, page_id: page?.id ?? null, supporter_id: supporterId ?? null, donor_name: b.anonymous || !b.donor_name?.trim() ? "Anonymous" : b.donor_name.trim(), donor_email: b.donor_email ?? null, anonymous: !!b.anonymous,
        amount_cents: b.amount_cents, currency, tip_cents: money.tip, cover_cents: money.cover, platform_fee_cents: money.platformFee, message: b.message?.trim() ?? "", dedication: b.dedication?.trim() ?? "",
        recurring: !!b.recurring, source: "card", status: "pending", ticket_type_id: b.ticket_type_id ?? null, ticket_qty: b.ticket_type_id ? qty : 0, claimed_rank: b.claimed_rank ?? null,
    }).select("id").single();
    if (error || !donation) return fail(error?.message ?? "Could not start the gift", 500);
    if (b.donor_email) { const { data: p } = await db.from("profiles").select("id").ilike("email", b.donor_email).maybeSingle(); if (p) await db.from("donations").update({ donor_id: p.id }).eq("id", donation.id); }

    const origin = (b.origin ?? SITE_URL()).replace(/\/$/, "");
    const back = b.return_to && b.return_to.startsWith("/") ? b.return_to : "/";
    const title = page ? page.title : org.name;
    const name = ticketName ? `${ticketName} · ${title}` : `${b.recurring ? "Monthly gift" : "Gift"} to ${title}`;
    const cur = currency.toLowerCase();
    const meta = { donation_id: donation.id, org_id: org.id, page_id: page?.id ?? "" };
    const common = { success_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}${back}`, customer_email: b.donor_email || undefined, metadata: meta, client_reference_id: donation.id, submit_type: "donate" as const };
    const session = b.recurring
        ? await s.checkout.sessions.create({
            ...common, mode: "subscription",
            line_items: [{ quantity: 1, price_data: { currency: cur, unit_amount: money.total, recurring: { interval: "month" }, product_data: { name } } }],
            subscription_data: { metadata: meta, application_fee_percent: money.total ? Math.round((money.applicationFee / money.total) * 10000) / 100 : 0, transfer_data: { destination: org.stripe_account_id }, on_behalf_of: org.stripe_account_id, description: name },
        })
        : await s.checkout.sessions.create({
            ...common, mode: "payment",
            line_items: [
                { quantity: qty, price_data: { currency: cur, unit_amount: unit + Math.round(money.cover / qty), product_data: { name } } },
                ...(money.tip > 0 ? [{ quantity: 1, price_data: { currency: cur, unit_amount: money.tip, product_data: { name: "Tip to Outgive", description: "Keeps the platform free for charities" } } }] : []),
            ],
            payment_intent_data: { metadata: meta, description: name, application_fee_amount: money.applicationFee || undefined, transfer_data: { destination: org.stripe_account_id }, on_behalf_of: org.stripe_account_id },
        });
    await db.from("donations").update({ stripe_checkout_session_id: session.id }).eq("id", donation.id);
    return json({ url: session.url, donation_id: donation.id, zero_decimal: ZERO_DECIMAL.has(currency) });
});
