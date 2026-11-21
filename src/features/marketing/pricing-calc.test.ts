import { describe, expect, it } from "vitest";
import { estimate, stripeFeeFor, TIPS_OFF_FEE_BPS } from "./pricing-calc";

const base = { raisedCents: 1_000_000, avgGiftCents: 5000, tipPct: 10, cover: false };

describe("pricing calculator", () => {
    it("estimates Stripe's fee at 2.9% + 30 per payment", () => {
        expect(stripeFeeFor(5000)).toBe(175);
        expect(stripeFeeFor(0)).toBe(0);
    });
    it("tips on: no platform fee, tips are paid by donors on top", () => {
        const e = estimate({ ...base, tipsOn: true });
        expect(e).toMatchObject({ gifts: 200, raised: 1_000_000, platformFee: 0, tips: 100_000, stripeFee: 35_000, charity: 965_000, donorsPay: 1_100_000 });
    });
    it("tips off: the platform fee comes out of the gifts and there are no tips", () => {
        const e = estimate({ ...base, tipsOn: false });
        expect(TIPS_OFF_FEE_BPS).toBe(300);
        expect(e).toMatchObject({ tips: 0, platformFee: 30_000, stripeFee: 35_000, charity: 935_000, donorsPay: 1_000_000 });
    });
    it("a covered card fee leaves the charity with at least the full gift", () => {
        const e = estimate({ ...base, tipsOn: true, cover: true });
        expect(e.cover).toBe(200 * 181);
        expect(e.charity).toBeGreaterThanOrEqual(e.raised);
        expect(e.charity - e.raised).toBeLessThanOrEqual(e.gifts * 2);
    });
    it("holds up at the edges: nothing raised, and a gift bigger than the total", () => {
        expect(estimate({ ...base, raisedCents: 0, tipsOn: true }).charity).toBe(0);
        expect(estimate({ ...base, raisedCents: 2000, tipsOn: true }).gifts).toBe(1);
        expect(estimate({ ...base, avgGiftCents: 0, raisedCents: 1000, tipsOn: false }).gifts).toBe(10);
    });
});
