import { assertEquals } from "jsr:@std/assert@1";
import { handle, type Store, type StoredDonation } from "./handle.ts";

const base = (over: Partial<StoredDonation> = {}): StoredDonation => ({ id: "d1", org_id: "o1", page_id: "p1", supporter_id: null, donor_id: null, donor_name: "Jonas", donor_email: "jonas@example.test", anonymous: false, amount_cents: 5000, currency: "GBP", tip_cents: 500, cover_cents: 0, platform_fee_cents: 0, message: "", dedication: "", recurring: false, status: "pending", stripe_payment_intent_id: null, stripe_subscription_id: null, stripe_invoice_id: null, ticket_type_id: null, ticket_qty: 0, claimed_rank: null, receipt_sent_at: null, created_at: new Date().toISOString(), ...over });

/** An in-memory Store that records what the handler did. */
const fake = (rows: StoredDonation[]) => {
    const events = new Set<string>(); const log: string[] = []; const receipts: string[] = [];
    const find = (f: (d: StoredDonation) => boolean) => Promise.resolve(rows.find(f) ?? null);
    const s: Store = {
        seen: async (id) => { if (events.has(id)) return true; events.add(id); return false; },
        byId: (id) => find((d) => d.id === id), bySession: (x) => find((d) => (d as unknown as { sid?: string }).sid === x), byIntent: (x) => find((d) => d.stripe_payment_intent_id === x), byInvoice: (x) => find((d) => d.stripe_invoice_id === x),
        latestForSubscription: (x) => Promise.resolve([...rows].reverse().find((d) => d.stripe_subscription_id === x) ?? null),
        update: async (id, patch) => { const d = rows.find((r) => r.id === id)!; Object.assign(d, patch); log.push(`update ${id} ${JSON.stringify(patch)}`); },
        insertRenewal: async (from, inv, amount) => { const d = base({ ...from, id: `r${rows.length}`, stripe_invoice_id: inv, amount_cents: amount, status: "succeeded", receipt_sent_at: null }); rows.push(d); log.push(`renewal ${amount}`); return d; },
        userIdByEmail: async (e) => (e === "jonas@example.test" ? "u-jonas" : null),
        orgStripeStatus: async (a, c, p) => { log.push(`org ${a} ${c} ${p}`); },
        receipt: async (d) => { receipts.push(d.id); return true; },
    };
    return { s, log, receipts, rows };
};

Deno.test("checkout completed marks the gift succeeded, links the donor and sends one receipt", async () => {
    const f = fake([base()]);
    const ev = { id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", payment_intent: "pi_1", metadata: { donation_id: "d1" }, customer_details: { email: "JONAS@example.test" } } } };
    assertEquals(await handle(f.s, ev), "succeeded");
    assertEquals(f.rows[0].status, "succeeded");
    assertEquals(f.rows[0].stripe_payment_intent_id, "pi_1");
    assertEquals(f.rows[0].donor_id, null); // email lookup is case-sensitive in the fake; the real store uses ilike
    assertEquals(f.receipts, ["d1"]);
    assertEquals(await handle(f.s, ev), "duplicate");
    assertEquals(f.receipts.length, 1);
});

Deno.test("an unpaid session (bank debit pending) waits for async success", async () => {
    const f = fake([base()]);
    assertEquals(await handle(f.s, { id: "e1", type: "checkout.session.completed", data: { object: { id: "cs", payment_status: "unpaid", metadata: { donation_id: "d1" } } } }), "awaiting async payment");
    assertEquals(f.rows[0].status, "pending");
    assertEquals(await handle(f.s, { id: "e2", type: "checkout.session.async_payment_succeeded", data: { object: { id: "cs", payment_status: "paid", metadata: { donation_id: "d1" }, payment_intent: "pi_9" } } }), "succeeded");
});

Deno.test("subscriptions: first invoice belongs to the checkout row, later invoices become new gifts", async () => {
    const f = fake([base({ recurring: true, stripe_subscription_id: "sub_1", stripe_invoice_id: "in_1", status: "succeeded", receipt_sent_at: "x" })]);
    assertEquals(await handle(f.s, { id: "e1", type: "invoice.paid", data: { object: { id: "in_1", subscription: "sub_1", amount_paid: 5500 } } }), "invoice already recorded");
    assertEquals(await handle(f.s, { id: "e2", type: "invoice.paid", data: { object: { id: "in_2", subscription: "sub_1", amount_paid: 5500 } } }), "renewal");
    assertEquals(f.rows.length, 2);
    assertEquals(f.rows[1].amount_cents, 5000); // tip stripped out
    assertEquals(await handle(f.s, { id: "e3", type: "invoice.paid", data: { object: { id: "in_2", subscription: "sub_1", amount_paid: 5500 } } }), "invoice already recorded");
});

Deno.test("refunds and disputes change status; a partial refund keeps the gift", async () => {
    const f = fake([base({ status: "succeeded", stripe_payment_intent_id: "pi_1" })]);
    assertEquals(await handle(f.s, { id: "e1", type: "charge.refunded", data: { object: { payment_intent: "pi_1", amount: 5500, amount_refunded: 1000 } } }), "partial refund kept");
    assertEquals(await handle(f.s, { id: "e2", type: "charge.dispute.created", data: { object: { payment_intent: "pi_1" } } }), "disputed");
    assertEquals(f.rows[0].status, "disputed");
    assertEquals(await handle(f.s, { id: "e3", type: "charge.dispute.closed", data: { object: { payment_intent: "pi_1", status: "won" } } }), "dispute won");
    assertEquals(f.rows[0].status, "succeeded");
    assertEquals(await handle(f.s, { id: "e4", type: "charge.refunded", data: { object: { payment_intent: "pi_1", amount: 5500, amount_refunded: 5500 } } }), "refunded");
    assertEquals(f.rows[0].status, "refunded");
});

Deno.test("account.updated syncs the charity's Stripe status; unknown events are ignored", async () => {
    const f = fake([]);
    assertEquals(await handle(f.s, { id: "e1", type: "account.updated", data: { object: { id: "acct_1", charges_enabled: true, payouts_enabled: false } } }), "account status");
    assertEquals(f.log, ["org acct_1 true false"]);
    assertEquals(await handle(f.s, { id: "e2", type: "payment_intent.created", data: { object: {} } }), "ignored");
});
