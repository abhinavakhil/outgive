/**
 * Jumu'ah giving: a gift every Friday. The payment side belongs to the checkout (supabase/functions/pay, _shared/payments/stripe.ts);
 * this is the model and the contract it should follow. Nothing here charges anyone.
 *
 * How monthly works today: pay `freq: "monthly"` makes a Stripe subscription (interval "month") whose first invoice is paid in the page
 * (payment_behavior default_incomplete, confirmation_secret), and stripe-webhook records each later invoice as a donation.
 *
 * CONTRACT for weekly (for the checkout agent):
 *   1. pay/logic.ts: StartInput.freq adds "weekly"; validate() accepts it (same rules as monthly, USD only).
 *   2. _shared/payments/stripe.ts, the regular-gift branch, when freq === "weekly": use weeklyStripe(amount, now) below —
 *        items[0].price_data.recurring = { interval: "week" }
 *        billing_cycle_anchor = the next Friday, 17:00 UTC (noon in New York, before Jumu'ah on the west coast)
 *        proration_behavior = "none"
 *        add_invoice_items gets the first gift (with extras), so the first invoice is non-zero and is paid in the page today
 *        exactly as monthly is (confirmation_secret). The subscription then charges m.recur every Friday from the anchor.
 *      Name it "Weekly gift to <title>" (the `name` line), and keep metadata.fund so the webhook files it under the Jumu'ah fund.
 *   3. If today is Friday, today's gift is this Friday's: the anchor is next week's Friday.
 *   4. stripe-webhook: nothing new; invoice.paid for a weekly subscription is recorded like a monthly one (recurring = true).
 *   5. The checkout's frequency control offers "Every Friday" when the campaign's appeal is weekly (Appeal.weekly in templates.ts).
 * ponytail: fixed 17:00 UTC anchor for every charity; use the org's time zone when there are charities outside US time zones.
 */

/** The next Friday strictly after `now`, as YYYY-MM-DD (UTC). */
export const nextFriday = (now: Date): string => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + (((5 - d.getUTCDay() + 7) % 7) || 7));
    return d.toISOString().slice(0, 10);
};

/** Fridays from `from` to `to`, inclusive (YYYY-MM-DD). A season's count of Jumu'ahs. */
export const fridaysBetween = (from: string, to: string): string[] => {
    const out: string[] = [];
    for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() === 5) out.push(d.toISOString().slice(0, 10));
    return out;
};

/** The Stripe subscription fields for a weekly gift (see the contract above). `firstCents` is today's charge; `recurCents` every Friday's. */
export const weeklyStripe = (firstCents: number, recurCents: number, now: Date) => ({
    interval: "week" as const,
    billing_cycle_anchor: Math.floor(Date.parse(`${nextFriday(now)}T17:00:00Z`) / 1000),
    proration_behavior: "none" as const,
    first_invoice_cents: firstCents,
    recur_cents: recurCents,
});

/** What a weekly gift comes to in a year, for "$10 every Friday, $520 a year". */
export const yearly = (weekly: number) => weekly * 52;
