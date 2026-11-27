// Stripe Connect: a destination charge on behalf of the charity's connected account (its own, or one Outgive made and onboarded for it).
// Cards, Apple Pay / Google Pay, Bacs Direct Debit and pay by bank, through the Payment Element. Regular gifts are Subscriptions.
// The platform keeps the platform fee and the tip as the application fee; the rest is the charity's.
import { stripe } from "../deps.ts";
import { fromIntent, PM_TYPES } from "../../pay/logic.ts";
import type { Provider } from "./types.ts";

export const stripeProvider: Provider = {
    id: "stripe",
    capabilities: { methods: ["card", "wallet", "dd", "bank"], recurring: true, offSession: true, platformFee: true, refunds: true },
    configured: () => !!Deno.env.get("STRIPE_SECRET_KEY"),

    start: async ({ input: b, donationId, account, title, amounts: m, save, row }) => {
        const s = stripe();
        const existing = row.stripe_payment_intent_id as string | null;
        if (existing) return fromIntent(await s.paymentIntents.retrieve(existing), b.method, donationId, true);
        const freq = b.freq ?? "once", key = b.attempt_key, cur = b.currency.toLowerCase(), acct = account.external_id;
        const types = PM_TYPES[b.method as keyof typeof PM_TYPES], appFee = m.platformFee + m.tip;
        const name = `${freq === "once" ? "Gift" : freq === "monthly" ? "Monthly gift" : "Yearly gift"} to ${title}`;
        const meta = { donation_id: donationId, org_id: String(row.org_id), page_id: String(row.page_id ?? ""), fund: b.fund ?? "", gift_aid: b.gift_aid ? "yes" : "no" };

        if (freq === "once") {
            const pi = await s.paymentIntents.create({ amount: m.today, currency: cur, payment_method_types: types, description: name, metadata: meta, application_fee_amount: appFee || undefined, transfer_data: { destination: acct }, on_behalf_of: acct }, { idempotencyKey: key });
            await save({ stripe_payment_intent_id: pi.id });
            return fromIntent(pi, b.method, donationId, true);
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
            application_fee_percent: m.recur ? Math.round((appFee / m.recur) * 10000) / 100 : 0, transfer_data: { destination: acct }, on_behalf_of: acct,
            expand: ["latest_invoice.confirmation_secret"],
        }, { idempotencyKey: `${key}:sub` });
        const inv = sub.latest_invoice as unknown as { id: string; confirmation_secret?: { client_secret?: string } };
        const secret = inv?.confirmation_secret?.client_secret;
        if (!secret) throw new Error("Could not start the regular gift");
        // The first invoice's PaymentIntent id is the front of its client secret; storing it (and the invoice) lets status and the webhook find this row.
        await save({ stripe_subscription_id: sub.id, stripe_invoice_id: inv.id, stripe_payment_intent_id: secret.split("_secret_")[0] });
        return { status: "requires_action", id: donationId, clientSecret: secret };
    },

    status: async ({ donationId, row }) => {
        const pi = row.stripe_payment_intent_id as string | null;
        if (!pi) return { status: "failed", id: donationId, error: { code: "unknown" } };
        return fromIntent(await stripe().paymentIntents.retrieve(pi), String(row.pay_method), donationId, false);
    },
};
