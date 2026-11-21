import { describe, expect, it } from "vitest";
import { breakdown, coverFor, fmt, tipFor, toMinor } from "./money";

describe("money", () => {
    it("tips round to the cent", () => { expect(tipFor(2500, 10)).toBe(250); expect(tipFor(333, 15)).toBe(50); expect(tipFor(2500, 0)).toBe(0); });
    it("cover leaves the charity with the gift after Stripe's cut", () => {
        for (const gift of [100, 2500, 9999, 100000]) {
            const c = coverFor(gift);
            const net = Math.floor((gift + c) * (1 - 0.029)) - 30;
            expect(net).toBeGreaterThanOrEqual(gift);
            expect(net - gift).toBeLessThan(5);
        }
    });
    it("breakdown adds up and the platform keeps tip plus fee", () => {
        const b = breakdown(5000, { tipPct: 10, cover: true, feeBps: 300 });
        expect(b).toMatchObject({ amount: 5000, tip: 500, platformFee: 150 });
        expect(b.total).toBe(5000 + 500 + b.cover);
        expect(b.applicationFee).toBe(650);
        expect(breakdown(-5).total).toBe(0);
    });
    it("handles zero-decimal currencies", () => { expect(toMinor(1000, "JPY")).toBe(1000); expect(toMinor(10, "usd")).toBe(1000); expect(fmt(1000, "JPY")).toContain("1,000"); expect(fmt(1050, "USD")).toBe("$10.50"); });
});
