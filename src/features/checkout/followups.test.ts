import { describe, expect, it } from "vitest";
import { nextFriday, resumeUrl, weeklyAnchor } from "../../../supabase/functions/nightly-charge/plan";
import { type StartInput, validate } from "../../../supabase/functions/pay/logic";
import { type Store, type StoredDonation, handle, verifyAny } from "../../../supabase/functions/stripe-webhook/handle";
import { assign, averageGift, conversion, hash, significance, verdict } from "./experiments";
import { quote } from "./model";
import { resumeLink } from "./recovery";
import { usSample } from "./us";

describe("A/B tests", () => {
    const e = { id: "exp1", variants: [{ id: "a", label: "A" }, { id: "b", label: "B" }] };
    it("keeps a session on one variant, and splits sessions about evenly", () => {
        expect(assign(e, "session-123")).toBe(assign(e, "session-123"));
        const n = Array.from({ length: 2000 }, (_, i) => assign(e, `s${i}-${hash(String(i))}`).id).filter((x) => x === "a").length;
        expect(n).toBeGreaterThan(900); expect(n).toBeLessThan(1100);
    });
    it("reads conversion and the average gift", () => {
        expect(conversion({ visitors: 200, gifts: 20 })).toBe(0.1);
        expect(averageGift({ gifts: 4, raised_cents: 20000 })).toBe(50);
    });
    it("calls a difference only with enough visitors and p < 0.05", () => {
        // 10% vs 13% over 2000 visitors each: z ≈ 2.97, p ≈ 0.003.
        const s = significance({ visitors: 2000, gifts: 200 }, { visitors: 2000, gifts: 260 });
        expect(s.confident).toBe(true); expect(s.p).toBeLessThan(0.01); expect(s.lift).toBeCloseTo(0.3, 5);
        expect(significance({ visitors: 2000, gifts: 200 }, { visitors: 2000, gifts: 210 }).confident).toBe(false);
        expect(significance({ visitors: 50, gifts: 5 }, { visitors: 50, gifts: 25 }).confident).toBe(false); // too few visitors
        expect(verdict({ id: "a", label: "", visitors: 40, gifts: 4, raised_cents: 0 }, { id: "b", label: "", visitors: 40, gifts: 9, raised_cents: 0 }).text).toMatch(/Too early/);
        expect(verdict({ id: "a", label: "", visitors: 2000, gifts: 260, raised_cents: 0 }, { id: "b", label: "", visitors: 2000, gifts: 200, raised_cents: 0 }).tone).toBe("peach");
    });
});

describe("Stripe webhook: Connect events and ACH nights", () => {
    it("verifies with whichever signing secret matches, skipping unset ones", async () => {
        const verify = async (s: string) => { if (s !== "whsec_connect") throw new Error("bad sig"); return { ok: s }; };
        expect(await verifyAny([undefined, "whsec_platform", "whsec_connect"], verify)).toEqual({ ok: "whsec_connect" });
        await expect(verifyAny(["whsec_platform"], verify)).rejects.toThrow("bad sig");
        await expect(verifyAny([undefined], verify)).rejects.toThrow(/No webhook signing secret/);
    });
    it("settles a night's ACH charge on its schedule row and the gift, and waits while processing", async () => {
        const row = { id: "d1", org_id: "o", attempt_key: "night_x", status: "pending", donor_email: "a@b.co", donor_id: null, receipt_sent_at: null } as unknown as StoredDonation;
        const nights: string[] = [], updates: string[] = [];
        const s = {
            seen: async () => false, byId: async (id: string) => (id === "d1" ? row : null), byIntent: async () => null, bySession: async () => null, byInvoice: async () => null, latestForSubscription: async () => null,
            update: async (_: string, p: object) => { updates.push(JSON.stringify(p)); }, insertRenewal: async () => row, userIdByEmail: async () => null, orgStripeStatus: async () => {}, receipt: async () => true,
            nightCharge: async (pi: string, st: string) => { nights.push(`${pi} ${st}`); },
        } as unknown as Store;
        const ev = (type: string) => ({ id: `evt_${type}`, type, data: { object: { id: "pi_1", metadata: { donation_id: "d1", schedule_id: "s1" } } } });
        expect(await handle(s, ev("payment_intent.processing"))).toBe("processing");
        expect(await handle(s, ev("payment_intent.succeeded"))).toBe("succeeded");
        expect(nights).toEqual(["pi_1 succeeded"]);
        expect(updates.some((u) => u.includes('"status":"succeeded"'))).toBe(true);
    });
});

describe("abandoned-checkout reminder", () => {
    it("links back to the same page the browser would, with the resume token", () => {
        expect(resumeUrl("https://www.outgive.tech", "org/hope-foundation", "tok123")).toBe(resumeLink("org/hope-foundation", "tok123", "https://www.outgive.tech"));
        expect(resumeUrl("https://www.outgive.tech", "sample", "tok123")).toBe(resumeLink("sample", "tok123", "https://www.outgive.tech"));
        expect(resumeUrl("https://www.outgive.tech", "us-sample", "t")).toBe("https://www.outgive.tech/checkout?region=us&resume=t");
    });
});

describe("weekly Friday giving (Jumu'ah)", () => {
    it("starts on the next Friday, and a Friday gift counts as this Friday's", () => {
        expect(nextFriday(new Date("2027-02-24T10:00:00Z"))).toBe("2027-02-26"); // Wednesday
        expect(nextFriday(new Date("2027-02-26T10:00:00Z"))).toBe("2027-03-05"); // Friday: next week's
        expect(weeklyAnchor(new Date("2027-02-24T10:00:00Z"))).toBe(Date.parse("2027-02-26T17:00:00Z") / 1000);
    });
    it("is accepted for dollars only", () => {
        const b = { action: "start", attempt_key: "k".repeat(20), org_id: "o", method: "card", currency: "USD", amount_cents: 1000, freq: "weekly" } as StartInput;
        expect(validate(b)).toBeNull();
        expect(validate({ ...b, currency: "GBP" })).toMatch(/US gifts/);
    });
    it("repeats the gift and its covered fee every Friday", () => {
        const q = quote({ amount: 10, freq: "weekly", picks: { cover: true }, ga: false, fund: "general" }, usSample(), new Date(2027, 1, 24, 12));
        expect(q.later?.total).toBe(q.recur);
        expect(q.later?.next).toEqual(new Date(2027, 1, 26, 12));
        expect(q.lines[0].label).toBe("Ramadan appeal, every Friday");
    });
});
