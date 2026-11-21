import { describe, expect, it } from "vitest";
import { type Trust } from "./model";
import { monthlyNudge, nextAction } from "./next-action";

describe("pre-payment monthly nudge", () => {
    it("suggests a monthly amount for a one-off gift at or above the threshold", () => {
        expect(monthlyNudge({ amount: 50, freq: "once" })).toEqual({ amount: 15 });
        expect(monthlyNudge({ amount: 20, freq: "once" })).toEqual({ amount: 5 });
        expect(monthlyNudge({ amount: 19, freq: "once" })).toBeNull();
        expect(monthlyNudge({ amount: 19, freq: "once", threshold: 10 })).toEqual({ amount: 5 });
    });
    it("stays quiet for regular gifts, regular donors, and after a no", () => {
        expect(monthlyNudge({ amount: 50, freq: "monthly" })).toBeNull();
        expect(monthlyNudge({ amount: 50, freq: "yearly" })).toBeNull();
        expect(monthlyNudge({ amount: 50, freq: "once", alreadyMonthly: true })).toBeNull();
        expect(monthlyNudge({ amount: 50, freq: "once", declined: true })).toBeNull();
    });
});

describe("thank-you next action", () => {
    const trust: Trust = { legalName: "Riverside Food Bank", regNo: "0000000", regulator: "Charity Commission for England and Wales", verified: true, verifiedAt: "2026-11-01", taxReceipts: true, fund: { name: "General fund", restricted: false } };
    const campaign = { id: "a" }, once = { amount: 25, freq: "once" as const };
    const addOn = { id: "meal", name: "A hot meal", amount: 3 };
    const recommended = { id: "b", title: "Riverside Food Bank winter appeal", trust };
    const full = { campaign, gift: once, addOn, recommended };
    it("asks a one-off donor to go monthly first", () => {
        expect(nextAction(full)).toEqual({ kind: "monthly", amount: 10 });
    });
    it("asks a committed donor to start a fundraiser", () => {
        expect(nextAction({ ...full, gift: { amount: 25, freq: "monthly" } })).toEqual({ kind: "fundraiser" });
        expect(nextAction({ ...full, donor: { recurring: true } })).toEqual({ kind: "fundraiser" });
    });
    it("falls through what was declined: add-on, then a verified campaign, then share", () => {
        expect(nextAction({ ...full, donor: { declined: ["monthly"] } })).toEqual({ kind: "addon", ...addOn });
        expect(nextAction({ ...full, donor: { declined: ["monthly", "addon"] } })).toEqual({ kind: "campaign", id: "b", title: recommended.title });
        expect(nextAction({ ...full, donor: { declined: ["monthly", "addon", "campaign"] } })).toEqual({ kind: "share" });
        expect(nextAction({ ...full, donor: { declined: ["monthly", "addon", "campaign", "share"] } })).toEqual({ kind: "fundraiser" });
        expect(nextAction({ ...full, donor: { declined: ["monthly", "addon", "campaign", "share", "fundraiser"] } })).toBeNull();
    });
    it("skips the monthly ask for a tiny gift and an add-on dearer than the gift", () => {
        expect(nextAction({ campaign, gift: { amount: 5, freq: "once" }, addOn })).toEqual({ kind: "addon", ...addOn });
        expect(nextAction({ campaign, gift: { amount: 2, freq: "once" }, addOn })).toEqual({ kind: "share" });
    });
    it("never recommends an unverified campaign, or the one just given to", () => {
        const no = { declined: ["monthly" as const] };
        expect(nextAction({ campaign, gift: once, donor: no, recommended: { ...recommended, trust: { ...trust, verified: false } } })).toEqual({ kind: "share" });
        expect(nextAction({ campaign, gift: once, donor: no, recommended: { id: "b", title: "No trust details" } })).toEqual({ kind: "share" });
        expect(nextAction({ campaign, gift: once, donor: no, recommended: { ...recommended, id: "a" } })).toEqual({ kind: "share" });
    });
});
