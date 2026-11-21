import { describe, expect, it } from "vitest";
import { presetsFor } from "./presets";

describe("smart presets", () => {
    const campaign = { presets: [10, 25, 50, 100] };
    const once = { campaign, freq: "once" as const };
    it("control keeps the campaign's presets whatever the context", () => {
        expect(presetsFor({ campaign, freq: "monthly", lastGift: { amount: 30, freq: "monthly" }, variant: "control" })).toEqual({ amounts: [10, 25, 50, 100], selected: 25, variant: "control" });
    });
    it("with nothing known, offers the campaign's presets and selects the second", () => {
        expect(presetsFor(once)).toEqual({ amounts: [10, 25, 50, 100], selected: 25, variant: "smart" });
        expect(presetsFor({ campaign: { presets: [] }, freq: "once" }).amounts).toEqual([10, 25, 50, 100]);
        expect(presetsFor({ campaign: { presets: [50, 10, 50, 0] }, freq: "once" }).amounts).toEqual([10, 50]);
    });
    it("lowers monthly presets, in 5s", () => {
        expect(presetsFor({ campaign, freq: "monthly" })).toMatchObject({ amounts: [5, 10, 20, 40], selected: 10 });
        expect(presetsFor({ campaign, freq: "yearly" }).amounts).toEqual([10, 25, 50, 100]);
    });
    it("anchors on the donor's last gift of the same kind", () => {
        expect(presetsFor({ ...once, lastGift: { amount: 30, freq: "once" } })).toMatchObject({ amounts: [25, 30, 50, 100], selected: 30 });
        expect(presetsFor({ ...once, lastGift: { amount: 500, freq: "yearly" } })).toMatchObject({ amounts: [25, 50, 100, 500], selected: 500 });
        expect(presetsFor({ ...once, lastGift: { amount: 5, freq: "once" } })).toMatchObject({ amounts: [5, 10, 25, 50], selected: 5 });
        expect(presetsFor({ ...once, lastGift: { amount: 8, freq: "monthly" } })).toMatchObject({ amounts: [10, 25, 50, 100], selected: 25 });
    });
    it("otherwise leans on the campaign's typical gift", () => {
        expect(presetsFor({ ...once, typicalGift: 40 }).selected).toBe(50);
        expect(presetsFor({ campaign, freq: "monthly", typicalGift: 60 }).selected).toBe(20); // 60 × 0.4 = 24, nearest step 20
        expect(presetsFor({ campaign, freq: "monthly", typicalGift: 40 }).selected).toBe(10); // 16 → 15, between 10 and 20: the lower wins a tie
    });
    it("adds a step for a typical gift beyond the presets", () => {
        expect(presetsFor({ ...once, typicalGift: 400 })).toMatchObject({ amounts: [25, 50, 100, 400], selected: 400 });
    });
    it("ask-up selects the step above the anchor, when there is one", () => {
        expect(presetsFor({ ...once, typicalGift: 40, variant: "ask-up" }).selected).toBe(100);
        expect(presetsFor({ ...once, lastGift: { amount: 500, freq: "once" }, variant: "ask-up" }).selected).toBe(500);
    });
    it("is deterministic", () => {
        const ctx = { ...once, lastGift: { amount: 30, freq: "once" as const }, typicalGift: 40 };
        expect(presetsFor(ctx)).toEqual(presetsFor(ctx));
    });
});
