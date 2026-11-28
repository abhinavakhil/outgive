// Outgive's own subscription plans on Stripe Billing (the PLATFORM account: the charity pays Outgive, donations never pass through here).
// Price IDs come from secrets, never from code:
//   BILLING_PRICE_STANDARD_MONTHLY, BILLING_PRICE_STANDARD_ANNUAL, BILLING_PRICE_MULTI_MONTHLY, BILLING_PRICE_MULTI_ANNUAL
// Pure functions (no Deno globals) so vitest can check them too: tests/billing-plans.test.ts.

export type Plan = "free" | "standard" | "multi";
export type Interval = "month" | "year";
export type Env = (key: string) => string | undefined;

export const PRICE_ENV: Record<Exclude<Plan, "free">, Record<Interval, string>> = {
    standard: { month: "BILLING_PRICE_STANDARD_MONTHLY", year: "BILLING_PRICE_STANDARD_ANNUAL" },
    multi: { month: "BILLING_PRICE_MULTI_MONTHLY", year: "BILLING_PRICE_MULTI_ANNUAL" },
};

/** The Stripe price for a paid plan, or null when that secret is not set. */
export const priceFor = (plan: Plan, interval: Interval, env: Env) => (plan === "free" ? null : env(PRICE_ENV[plan][interval]) || null);

/** Which plan and interval a Stripe price is, or null for a price Outgive does not sell. */
export const planOfPrice = (price: string, env: Env): { plan: Plan; interval: Interval } | null => {
    for (const plan of ["standard", "multi"] as const) for (const interval of ["month", "year"] as const) if (env(PRICE_ENV[plan][interval]) === price) return { plan, interval };
    return null;
};

/** Only the subscription fields this needs. current_period_end moved onto items in newer Stripe API versions; both are read. */
export interface Subscription {
    id: string; status: string; customer: string | { id: string }; cancel_at_period_end?: boolean; current_period_end?: number;
    metadata?: Record<string, string>;
    items: { data: { price: { id: string }; current_period_end?: number }[] };
}

/** The org_subscriptions row for a Stripe subscription. An unknown price keeps the status but grants no plan. */
export const rowOf = (s: Subscription, env: Env) => {
    const item = s.items.data[0], p = item ? planOfPrice(item.price.id, env) : null, end = item?.current_period_end ?? s.current_period_end;
    return {
        plan: p?.plan ?? "free", billing_interval: p?.interval ?? null, status: s.status,
        stripe_customer_id: typeof s.customer === "string" ? s.customer : s.customer.id, stripe_subscription_id: s.id,
        current_period_end: end ? new Date(end * 1000).toISOString() : null, cancel_at_period_end: !!s.cancel_at_period_end, updated_at: new Date().toISOString(),
    };
};

/**
 * A founding pilot adding a card before its free period ends starts on a trial to the pilot's end, so the first charge is the day after.
 * Stripe needs trial_end at least 48 hours ahead; nearer than that, billing just starts now.
 */
export const trialEnd = (pilotUntil: string | null, now = Date.now()) => {
    if (!pilotUntil) return undefined;
    const t = Math.floor(Date.parse(`${pilotUntil}T23:59:59Z`) / 1000);
    return t - now / 1000 > 48 * 3600 ? t : undefined;
};
