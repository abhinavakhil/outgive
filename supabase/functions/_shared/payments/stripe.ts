// Stripe Connect. Two ways a gift is made on the charity's connected account:
//   destination charge (UK): the platform's charge, on behalf of the charity, its money transferred to the charity.
//   direct charge (US): the charge is made on the charity's own account, so the charity is the merchant of record (its name on the
//     statement, its nonprofit rate, its Radar rules). The platform fee and tip are the application fee.
// Cards, Apple Pay / Google Pay, Bacs Direct Debit, pay by bank, and ACH bank debit (us_bank_account), through the Payment Element.
// Regular gifts are Subscriptions; the last ten nights are a SetupIntent (nightly-charge/schedule.ts).
import { stripe } from "../deps.ts";
import { fromIntent, pmTypes } from "../../pay/logic.ts";
import { weeklyAnchor } from "../../nightly-charge/plan.ts";
import type { Provider } from "./types.ts";

/** Dollar gifts are direct charges (US charities). By currency alone, so StripeFields makes the same call in the browser. */
export const isDirect = (_org: { country?: string | null }, currency: string) => currency.toUpperCase() === "USD";

export const stripeProvider: Provider = {
    id: "stripe",
    capabilities: { methods: ["card", "wallet", "dd", "bank"], recurring: true, offSession: true, platformFee: true, refunds: true },
    configured: () => !!Deno.env.get("STRIPE_SECRET_KEY"),

    start: async ({ input: b, donationId, account, org, title, amounts: m, save, row }) => {
        const s = stripe();
        const acct = account.external_id, direct = isDirect(org, b.currency);
        // Direct: every call runs as the charity's account. Destination: as the platform, with the charity named on the charge.
        const on = (k?: string) => ({ ...(k ? { idempotencyKey: k } : {}), ...(direct ? { stripeAccount: acct } : {}) });
        const dest = direct ? {} : { transfer_data: { destination: acct }, on_behalf_of: acct };
        const existing = row.stripe_payment_intent_id as string | null;
        if (existing) return fromIntent(await s.paymentIntents.retrieve(existing, {}, on()), b.method, donationId, true);
        const freq = b.freq ?? "once", key = b.attempt_key, cur = b.currency.toLowerCase();
        const types = pmTypes(b.method, b.currency), appFee = m.platformFee + m.tip;
        const name = `${freq === "once" ? "Gift" : freq === "monthly" ? "Monthly gift" : freq === "weekly" ? "Weekly gift" : "Yearly gift"} to ${title}`;
        const source = (b.details?.source ?? {}) as Record<string, string>;
        // TODO(attribution): the revenue agent's tags (src/shared/attribution.ts) arrive in details.source once it lands; they ride along here.
        const meta = { donation_id: donationId, org_id: String(row.org_id), page_id: String(row.page_id ?? ""), fund: b.fund ?? "", gift_aid: b.gift_aid ? "yes" : "no", ...Object.fromEntries(Object.entries(source).slice(0, 8).map(([k, v]) => [`src_${k}`.slice(0, 40), String(v).slice(0, 80)])) };
        if (direct) await save({ stripe_account_id: acct });

        if (freq === "once") {
            const pi = await s.paymentIntents.create({ amount: m.today, currency: cur, payment_method_types: types, description: name, metadata: meta, application_fee_amount: appFee || undefined, ...dest }, on(key));
            await save({ stripe_payment_intent_id: pi.id });
            return fromIntent(pi, b.method, donationId, true);
        }
        // A regular gift: a subscription whose first invoice is paid in the page. Each call has its own idempotency key under the attempt's.
        const customer = await s.customers.create({ email: b.donor_email || undefined, name: b.donor_name?.trim() || undefined, metadata: meta }, on(`${key}:cus`));
        const product = await s.products.create({ name, metadata: meta }, on(`${key}:prod`));
        // Weekly (Jumu'ah): the subscription starts on the next Friday with no proration, so today's gift (and any extras) is a one-off
        // item on the first invoice, which is paid in the page like monthly. Then m.recur every Friday.
        const weekly = freq === "weekly", firstItems = (weekly ? m.recur : 0) + (b.extras_cents ?? 0);
        const sub = await s.subscriptions.create({
            customer: customer.id, description: name, metadata: meta,
            items: [{ price_data: { currency: cur, unit_amount: m.recur, recurring: { interval: weekly ? "week" : freq === "yearly" ? "year" : "month" }, product: product.id } }],
            add_invoice_items: firstItems ? [{ price_data: { currency: cur, unit_amount: firstItems, product: product.id } }] : undefined,
            ...(weekly ? { billing_cycle_anchor: weeklyAnchor(new Date()), proration_behavior: "none" as const } : {}),
            payment_behavior: "default_incomplete",
            // deno-lint-ignore no-explicit-any
            payment_settings: { payment_method_types: types as any, save_default_payment_method: "on_subscription" },
            application_fee_percent: m.recur ? Math.round((appFee / m.recur) * 10000) / 100 : 0, ...dest,
            expand: ["latest_invoice.confirmation_secret"],
        }, on(`${key}:sub`));
        const inv = sub.latest_invoice as unknown as { id: string; confirmation_secret?: { client_secret?: string } };
        const secret = inv?.confirmation_secret?.client_secret;
        if (!secret) throw new Error("Could not start the regular gift");
        // The first invoice's PaymentIntent id is the front of its client secret; storing it (and the invoice) lets status and the webhook find this row.
        await save({ stripe_subscription_id: sub.id, stripe_invoice_id: inv.id, stripe_payment_intent_id: secret.split("_secret_")[0] });
        return { status: "requires_action", id: donationId, clientSecret: secret };
    },

    status: async ({ donationId, row }) => {
        const pi = row.stripe_payment_intent_id as string | null, acct = row.stripe_account_id as string | null;
        if (!pi) return { status: "failed", id: donationId, error: { code: "unknown" } };
        return fromIntent(await stripe().paymentIntents.retrieve(pi, {}, acct ? { stripeAccount: acct } : undefined), String(row.pay_method), donationId, false);
    },
};
