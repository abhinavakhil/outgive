// Stripe → donations. Verifies the signature, then applies the event through handle.ts with a Postgres-backed Store.
import { admin, fail, json, stripe, SITE_URL } from "../_shared/deps.ts";
import { sendReceipt } from "../_shared/email.ts";
import { fmt } from "../_shared/money.ts";
import { type Event, handle, type Store, type StoredDonation } from "./handle.ts";

const PREFIX: Record<string, string> = { fundraiser: "f", campaign: "c", team: "t", challenge: "ch", event: "e", memory: "m" };

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
        receipt: async (d) => {
            const { data: org } = await db.from("orgs").select("name, registration_number, country, color, slug, custom_domain").eq("id", d.org_id).single();
            const { data: page } = d.page_id ? await db.from("pages").select("title, type, slug").eq("id", d.page_id).single() : { data: null };
            if (!org || !d.donor_email) return false;
            const base = org.custom_domain ? `https://${org.custom_domain}` : `${SITE_URL()}/o/${org.slug}`;
            return sendReceipt({ to: d.donor_email, donorName: d.donor_name, orgName: org.name, orgRegistration: org.registration_number, orgCountry: org.country, amount: fmt(d.amount_cents, d.currency), tip: d.tip_cents ? fmt(d.tip_cents, d.currency) : "", total: fmt(d.amount_cents + d.tip_cents + d.cover_cents, d.currency), date: new Date(d.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), donationId: d.id, pageTitle: page?.title ?? org.name, pageUrl: page ? `${base}/${PREFIX[page.type]}/${page.slug}` : base, recurring: d.recurring, dedication: d.dedication, brandColor: org.color });
        },
    };
};

Deno.serve(async (req) => {
    const sig = req.headers.get("stripe-signature"); if (!sig) return fail("Missing signature", 400);
    const body = await req.text();
    let event: Event;
    try { event = (await stripe().webhooks.constructEventAsync(body, sig, Deno.env.get("STRIPE_WEBHOOK_SECRET")!)) as unknown as Event; } catch (e) { return fail(`Bad signature: ${(e as Error).message}`, 400); }
    try { const result = await handle(store(), event); console.log(event.type, result); return json({ received: true, result }); } catch (e) { console.error(e); return fail((e as Error).message, 500); }
});
