import { describe, expect, it } from "vitest";
import { type Row, buckets, change, giftAidShare, heat, loyalty, methodShare, niceMax } from "./insights";

const now = new Date(2026, 10, 21, 15, 0).getTime(); // Sat 21 Nov 2026, 3pm local
const gift = (daysAgo: number, usd: number, over: Partial<Row> = {}) => ({ donor_name: "A", donor_email: null, usd_cents: usd * 100, status: "succeeded", recurring: false, source: "card", page_id: null, created_at: new Date(now - daysAgo * 86400000).toISOString(), ...over }) as Row;

describe("dashboard figures", () => {
    const rows = [gift(0, 10), gift(0, 5, { recurring: true, donor_name: "B", pay_method: "dd", gift_aid_cents: 125 }), gift(1, 20), gift(6, 40), gift(7, 80), gift(3, 999, { status: "refunded" }), gift(40, 100, { donor_name: "B" })];
    it("buckets days, weeks and months up to today, paid gifts only", () => {
        const days = buckets(rows, "day", 7, now);
        expect(days.map((b) => b.usd)).toEqual([40, 0, 0, 0, 0, 20, 15]);
        expect(days[6]).toMatchObject({ label: "Sat", when: "Sat 21 Nov, so far", one: 10, rec: 5, gifts: 2, donors: 2 });
        expect(buckets(rows, "week", 2, now).map((b) => b.usd)).toEqual([80, 75]);
        const months = buckets(rows, "month", 2, now);
        expect(months.map((b) => [b.label, b.usd])).toEqual([["Oct", 100], ["Nov", 155]]);
    });
    it("axis tops split into thirds", () => {
        expect([0, 545, 2550, 8420, 95, 1000].map(niceMax)).toEqual([3, 600, 3000, 9000, 120, 1200]);
    });
    it("change needs something to compare with", () => {
        expect(change(150, 100)).toBe(50);
        expect(change(10, 0)).toBeNull();
    });
    it("methods, loyalty, Gift Aid and the busiest time", () => {
        expect(methodShare(rows, (k) => k, 1)).toEqual([{ label: "card", count: 5, pct: (5 / 6) * 100 }, { label: "Other", count: 1, pct: (1 / 6) * 100 }]);
        expect(loyalty(rows)).toEqual({ donors: 2, repeat: 2, regular: 1 });
        expect(Math.round(giftAidShare(rows))).toBe(17);
        expect(heat(rows)).toMatchObject({ max: 3, busiest: "Sat afternoon" });
    });
});
