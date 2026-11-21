// What each Stripe event does to the donations table, written against a small Store interface so it can be tested without Stripe or Postgres.

export interface DonationPatch { status?: string; stripe_payment_intent_id?: string | null; stripe_subscription_id?: string | null; stripe_invoice_id?: string | null; donor_email?: string | null; donor_id?: string | null; receipt_sent_at?: string | null; pay_error?: string | null }
export interface StoredDonation { id: string; org_id: string; page_id: string | null; supporter_id: string | null; donor_id: string | null; donor_name: string; donor_email: string | null; anonymous: boolean; amount_cents: number; currency: string; tip_cents: number; cover_cents: number; platform_fee_cents: number; message: string; dedication: string; recurring: boolean; status: string; stripe_payment_intent_id: string | null; stripe_subscription_id: string | null; stripe_invoice_id: string | null; ticket_type_id: string | null; ticket_qty: number; claimed_rank: number | null; receipt_sent_at: string | null; created_at: string; attempt_key?: string | null }
export interface Store {
    seen: (eventId: string, type: string) => Promise<boolean>;
    byId: (id: string) => Promise<StoredDonation | null>;
    bySession: (sessionId: string) => Promise<StoredDonation | null>;
    byIntent: (pi: string) => Promise<StoredDonation | null>;
    byInvoice: (inv: string) => Promise<StoredDonation | null>;
    latestForSubscription: (sub: string) => Promise<StoredDonation | null>;
    update: (id: string, patch: DonationPatch) => Promise<void>;
    insertRenewal: (from: StoredDonation, invoiceId: string, amountCents: number) => Promise<StoredDonation>;
    userIdByEmail: (email: string) => Promise<string | null>;
    orgStripeStatus: (accountId: string, charges: boolean, payouts: boolean) => Promise<void>;
    receipt: (d: StoredDonation) => Promise<boolean>;
}

type Obj = Record<string, unknown>;
export interface Event { id: string; type: string; data: { object: Obj } }
const str = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" && "id" in v ? String((v as Obj).id) : null);

const succeed = async (s: Store, d: StoredDonation, patch: DonationPatch) => {
    const email = patch.donor_email ?? d.donor_email;
    const donor_id = d.donor_id ?? (email ? await s.userIdByEmail(email) : null);
    await s.update(d.id, { ...patch, status: "succeeded", donor_email: email, donor_id });
    const done = { ...d, ...patch, status: "succeeded", donor_email: email, donor_id };
    if (email && !d.receipt_sent_at && (await s.receipt(done))) await s.update(d.id, { receipt_sent_at: new Date().toISOString() });
    return "succeeded";
};

/** Returns a short description of what happened, for the function log. */
export const handle = async (s: Store, ev: Event): Promise<string> => {
    if (await s.seen(ev.id, ev.type)) return "duplicate";
    const o = ev.data.object;
    switch (ev.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
            const id = (o.metadata as Obj | undefined)?.donation_id as string | undefined;
            const d = (id && (await s.byId(id))) || (await s.bySession(String(o.id)));
            if (!d) return "no donation for session";
            if (o.payment_status === "unpaid" && ev.type === "checkout.session.completed") return "awaiting async payment";
            if (d.status === "succeeded") return "already succeeded";
            const email = (o.customer_details as Obj | undefined)?.email as string | undefined;
            return succeed(s, d, { stripe_payment_intent_id: str(o.payment_intent), stripe_subscription_id: str(o.subscription), stripe_invoice_id: str(o.invoice), donor_email: email ?? d.donor_email });
        }
        case "checkout.session.async_payment_failed":
        case "checkout.session.expired": {
            const d = await s.bySession(String(o.id));
            if (d && d.status === "pending") { await s.update(d.id, { status: "failed" }); return "failed"; }
            return "ignored";
        }
        case "invoice.paid": {
            // Newer API versions moved the subscription under parent.subscription_details.
            const sub = str(o.subscription) ?? str(((o.parent as Obj | undefined)?.subscription_details as Obj | undefined)?.subscription); const inv = String(o.id);
            if (!sub) return "no subscription";
            if (await s.byInvoice(inv)) return "invoice already recorded";
            const prev = await s.latestForSubscription(sub);
            if (!prev) return "unknown subscription";
            // The first invoice belongs to the checkout row; later ones are new monthly gifts.
            if (prev.status === "pending") return succeed(s, prev, { stripe_invoice_id: inv, stripe_payment_intent_id: str(o.payment_intent) });
            if (prev.stripe_invoice_id === inv) return "first invoice";
            const total = Number(o.amount_paid ?? 0); const gift = Math.max(1, total - prev.tip_cents - prev.cover_cents);
            const d = await s.insertRenewal(prev, inv, gift);
            if (d.donor_email && (await s.receipt(d))) await s.update(d.id, { receipt_sent_at: new Date().toISOString() });
            return "renewal";
        }
        // The in-page checkout (the pay function) confirms a PaymentIntent directly; its rows carry an attempt_key. Checkout Session gifts keep to the cases above.
        case "payment_intent.succeeded":
        case "payment_intent.payment_failed": {
            const id = (o.metadata as Obj | undefined)?.donation_id as string | undefined;
            const d = (id && (await s.byId(id))) || (await s.byIntent(String(o.id)));
            if (!d?.attempt_key) return "ignored";
            if (ev.type === "payment_intent.payment_failed") {
                // Not final: the donor can try another card on the same intent, and a later success wins.
                const e = o.last_payment_error as Obj | undefined;
                if (d.status === "pending") { await s.update(d.id, { status: "failed", pay_error: String(e?.decline_code ?? e?.code ?? "failed") }); return "failed"; }
                return "ignored";
            }
            // Open gifts become succeeded; one the pay function already marked succeeded still needs its receipt. Refunded and disputed stay as they are.
            if (d.status === "pending" || d.status === "failed" || (d.status === "succeeded" && !d.receipt_sent_at)) return succeed(s, d, { stripe_payment_intent_id: String(o.id), pay_error: null });
            return "ignored";
        }
        case "charge.refunded": {
            const pi = str(o.payment_intent); if (!pi) return "no intent";
            const d = await s.byIntent(pi); if (!d) return "unknown charge";
            if (Number(o.amount_refunded) >= Number(o.amount)) { await s.update(d.id, { status: "refunded" }); return "refunded"; }
            return "partial refund kept";
        }
        case "charge.dispute.created": { const d = await s.byIntent(str(o.payment_intent) ?? ""); if (d) { await s.update(d.id, { status: "disputed" }); return "disputed"; } return "unknown charge"; }
        case "charge.dispute.closed": { const d = await s.byIntent(str(o.payment_intent) ?? ""); if (d) { await s.update(d.id, { status: o.status === "won" ? "succeeded" : "refunded" }); return `dispute ${o.status}`; } return "unknown charge"; }
        case "account.updated": { await s.orgStripeStatus(String(o.id), !!o.charges_enabled, !!o.payouts_enabled); return "account status"; }
        default: return "ignored";
    }
};
