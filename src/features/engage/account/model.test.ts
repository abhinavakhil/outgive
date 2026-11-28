import { describe, expect, it } from "vitest";
import { type Billing, type Chapter, canManage, chapterSlug, pilotDaysLeft, planAllows, rolesOffered, rollUp, statusLabel, upgradeFor } from "./model";

const b = (p: Partial<Billing>): Billing => ({ plan: "free", billed_by_parent: false, appeals: 0, chapters: 0, ...p });

describe("account model", () => {
    it("gates features by plan, the same way as plan_allows in SQL", () => {
        expect(planAllows("free", "pledge_recovery")).toBe(false);
        expect(planAllows("standard", "pledge_recovery")).toBe(true);
        expect(planAllows("standard", "chapters")).toBe(false);
        expect(planAllows("multi", "chapters")).toBe(true);
        expect(upgradeFor("free", "analytics")).toBe("standard");
        expect(upgradeFor("multi", "analytics")).toBe(null);
    });

    it("reads the pilot and the subscription state", () => {
        expect(pilotDaysLeft(b({ pilot_until: "2027-03-31" }), "2027-03-21")).toBe(10);
        expect(pilotDaysLeft(b({ pilot_until: "2027-03-31" }), "2027-04-01")).toBe(null);
        expect(statusLabel(b({ pilot_until: "2027-03-31" }), "2027-03-01").text).toBe("Founding pilot");
        expect(statusLabel(b({ status: "past_due" }), "2027-03-01").text).toBe("Payment failed");
        expect(statusLabel(b({ status: "active", cancel_at_period_end: true }), "2027-03-01").text).toBe("Ends at period end");
        expect(statusLabel(b({ billed_by_parent: true }), "2027-03-01").text).toBe("Billed by parent");
    });

    it("offers only the roles a person may hand out", () => {
        expect(rolesOffered("admin")).toEqual(["editor", "viewer"]);
        expect(rolesOffered("editor")).toEqual([]);
        const m = { user_id: "u2", email: "a@x", name: "", role: "admin" as const };
        expect(canManage("admin", m, "u1")).toBe(false);
        expect(canManage("owner", m, "u1")).toBe(true);
        expect(canManage("owner", m, "u2")).toBe(false);
    });

    it("rolls chapters up and names them under the parent", () => {
        const c = (raised: number): Chapter => ({ id: "", slug: "", name: "", created_at: "", members: 1, insights: { raised_cents: raised, gifts: 2, donors: 1 } });
        expect(rollUp([c(100), c(250)])).toEqual({ raised_cents: 350, gifts: 4, donors: 2 });
        expect(chapterSlug("clearwell", "Clearwell Dallas")).toBe("clearwell-dallas");
        expect(chapterSlug("clearwell", "  Fort Worth! ")).toBe("clearwell-fort-worth");
    });
});
