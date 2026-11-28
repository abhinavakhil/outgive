// The billing edge functions' pure logic (supabase/functions/billing/plans.ts), run under vitest because Deno is not always installed.
import { describe, expect, it } from "vitest";
import { planOfPrice, priceFor, rowOf, trialEnd } from "../supabase/functions/billing/plans";

const ENV: Record<string, string> = { BILLING_PRICE_STANDARD_MONTHLY: "price_s_m", BILLING_PRICE_STANDARD_ANNUAL: "price_s_y", BILLING_PRICE_MULTI_MONTHLY: "price_m_m" };
const env = (k: string) => ENV[k];

describe("billing plans", () => {
    it("reads prices from secrets and maps them back", () => {
        expect(priceFor("standard", "year", env)).toBe("price_s_y");
        expect(priceFor("multi", "year", env)).toBe(null);
        expect(priceFor("free", "month", env)).toBe(null);
        expect(planOfPrice("price_m_m", env)).toEqual({ plan: "multi", interval: "month" });
        expect(planOfPrice("price_other", env)).toBe(null);
    });

    it("turns a subscription into a row, reading the period end from the item", () => {
        const r = rowOf({ id: "sub_1", status: "active", customer: { id: "cus_1" }, items: { data: [{ price: { id: "price_s_m" }, current_period_end: 1800000000 }] } }, env);
        expect(r).toMatchObject({ plan: "standard", billing_interval: "month", status: "active", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", current_period_end: "2027-01-15T08:00:00.000Z" });
        expect(rowOf({ id: "sub_2", status: "active", customer: "cus_2", items: { data: [{ price: { id: "price_x" } }] } }, env).plan).toBe("free");
    });

    it("lets a pilot add a card now and pay from the day after the pilot ends", () => {
        const now = Date.parse("2027-01-01T00:00:00Z");
        expect(trialEnd("2027-03-31", now)).toBe(Date.parse("2027-03-31T23:59:59Z") / 1000);
        expect(trialEnd("2027-01-01", now)).toBeUndefined();
        expect(trialEnd(null, now)).toBeUndefined();
    });
});
