// Stripe → donations. Verifies the signature, then applies the event through handle.ts with a Postgres-backed Store.
import { admin, fail, json, stripe } from "../_shared/deps.ts";
import { receiptOnPaid } from "../_shared/receipts/issue.ts";
import { type Event, handle, type Store, type StoredDonation, verifyAny } from "./handle.ts";

const store = (): Store => {
    const db = admin();
    const one = async (col: string, val: string) => (await db.from("donations").select("*").eq(col, val).maybeSingle()).data as StoredDonation | null;
    return {
        seen: async (id, type) => { const { error } = await db.from("stripe_events").insert({ id, type }); return !!error; },
        byId: (id) => one("id", id),
        bySession: (id) => one("stripe_checkout_session_id", id),
        byIntent: (pi) => one("stripe_payment_intent_id", pi),
        byInvoice: (inv) => one("stripe_invoice_id", inv),
        latestForSubscription: async (sub) => (await db.from("donations").select("*").eq("stripe_subscription_id", sub).order("created_at", { ascending: false }).limit(1).maybeSingle()).data as StoredDonation | null,
        update: async (id, patch) => { const { error } = await db.from("donations").update(patch).eq("id", id); if (error) throw error; },
        insertRenewal: async (from, invoiceId, amountCents) => {
            const { data, error } = await db.from("donations").insert({ org_id: from.org_id, page_id: from.page_id, supporter_id: from.supporter_id, donor_id: from.donor_id, donor_name: from.donor_name, donor_email: from.donor_email, anonymous: from.anonymous, amount_cents: amountCents, currency: from.currency, tip_cents: from.tip_cents, cover_cents: from.cover_cents, platform_fee_cents: from.platform_fee_cents, message: "", dedication: from.dedication, recurring: true, source: "card", status: "succeeded", stripe_subscription_id: from.stripe_subscription_id, stripe_invoice_id: invoiceId }).select("*").single();
            if (error) throw error; return data as StoredDonation;
        },
        userIdByEmail: async (email) => (await db.from("profiles").select("id").ilike("email", email).maybeSingle()).data?.id ?? null,
        orgStripeStatus: async (acct, charges, payouts) => { await db.from("orgs").update({ stripe_charges_enabled: charges, stripe_payouts_enabled: payouts }).eq("stripe_account_id", acct); },
        // The US receipt (number, fund lines, EIN, the IRS wording): _shared/receipts. Emails it when the charity sends receipts right away.
        receipt: (d) => receiptOnPaid(db, d.id),
        nightCharge: async (pi, status, error) => { await db.from("gift_schedule_charges").update({ status, error: error ?? null }).eq("stripe_payment_intent_id", pi).in("status", ["processing", "charging", "failed"]); },
    };
};

Deno.serve(async (req) => {
    const sig = req.headers.get("stripe-signature"); if (!sig) return fail("Missing signature", 400);
    const body = await req.text();
    let event: Event;
    // Platform events, and Connect events from charities' own accounts (US direct charges, their subscriptions and ACH): one handler for both.
    try { event = await verifyAny([Deno.env.get("STRIPE_WEBHOOK_SECRET"), Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET")], async (secret) => (await stripe().webhooks.constructEventAsync(body, sig, secret)) as unknown as Event); } catch (e) { return fail(`Bad signature: ${(e as Error).message}`, 400); }
    try { const result = await handle(store(), event); console.log(event.type, result); return json({ received: true, result }); } catch (e) { console.error(e); return fail((e as Error).message, 500); }
});
