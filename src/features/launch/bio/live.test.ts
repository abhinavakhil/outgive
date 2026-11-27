import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE } from "./model";
import { withStats } from "./live";

describe("withStats", () => {
    it("puts real totals on each campaign and cause, and real people on the boards", () => {
        const now = Date.parse("2027-02-20T20:00:00Z");
        const s = withStats(DEFAULT_PAGE, {
            raised_cents: 7500, gifts: 2, donors: 2,
            by_cause: { c1: { cents: 5000, donors: 1 }, water: { cents: 2500, donors: 1 } },
            recent: [{ name: "Aisha K.", amount_cents: 5000, cause: "Water for Kitui", created_at: "2027-02-20T19:55:00Z" }],
            top: [{ name: "Aisha K.", amount_cents: 5000 }],
        }, now);
        expect(s.page.campaigns.find((c) => c.id === "c1")).toMatchObject({ raised: 50, donors: 1 });
        expect(s.page.campaigns.find((c) => c.id === "c2")).toMatchObject({ raised: 0, donors: 0 });
        expect(s.page.causes.find((c) => c.id === "water")?.raised).toBe(25);
        expect(s.gifts).toEqual([["Aisha K.", 50, "Water for Kitui", "5 min"]]);
        expect(s.supporters).toEqual([["Aisha K.", 50, "Individual"]]);
    });
});

describe("nightsFrom", () => {
    it("puts each day's gifts on its Ramadan night, in pounds", async () => {
        const { nightsFrom } = await import("./Insights");
        const n = nightsFrom({ "2027-02-08": 1500, "2027-02-10": 250, "2027-01-01": 999 }, "2027-02-08");
        expect(n).toHaveLength(30);
        expect([n[0], n[1], n[2]]).toEqual([15, 0, 2.5]);
        expect(n.reduce((a, b) => a + b, 0)).toBe(17.5);
    });
});
