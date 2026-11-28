import { describe, expect, it } from "vitest";
import { coverCents, fromSetup, nightCharges, nightPlan } from "../../../supabase/functions/nightly-charge/plan";
import { SAMPLE, feeFor, methodsFor, quote, regionOf } from "./model";
import { DEFAULT_SETTINGS, MAX_SHOWN, settingsProblem, shownAddons, roundGap, toSettings, usSample } from "./us";
import { embedSettings } from "./Embed";
import { flowFor, fromLink } from "./useCheckout";

const US = usSample({ ...DEFAULT_SETTINGS, addons: ["cover", "alfitr", "fidya", "nights", "monthly"] });
const BEFORE = new Date("2027-02-01T12:00:00Z"); // before night 21 (27 Feb 2027)
const base = { amount: 100, freq: "once" as const, picks: {}, ga: false, fund: "zakat" };

describe("US fee cover: (A + f) / (1 − p) − A at 2.2% + 30c", () => {
    it("grosses up so the charity nets the whole gift, rounded up to the cent", () => {
        expect(coverCents(10000)).toBe(256); // (100 + 0.30) / 0.978 = 102.556… → $2.56
        expect(coverCents(2500)).toBe(87);
        expect(coverCents(0)).toBe(0);
        // The charity really nets the gift after the fee is taken from the gross charge.
        for (const a of [500, 2500, 10000, 123456]) { const g = a + coverCents(a); expect(g - Math.round(g * 0.022 + 30)).toBeGreaterThanOrEqual(a); }
        expect(feeFor(100, US)).toBe(2.56);
    });
    it("is its own line, never pre-ticked unless the charity turns it on (then it is visible and ticked)", () => {
        const q = quote({ ...base, picks: { cover: true } }, US, BEFORE);
        expect(q.lines.map((l) => [l.key, l.value])).toEqual([["gift", 100], ["fee", 2.56]]);
        expect(q.lines[0].label).toBe("Zakat");
        expect(q.receives).toBe(100 + q.match); // the fee goes to the processor, not the charity
        expect(usSample({ ...DEFAULT_SETTINGS, addons: [], cover_default: true }).extras?.some((x) => x.id === "cover")).toBe(true);
        expect(usSample({ ...DEFAULT_SETTINGS, addons: [] }).extras?.some((x) => x.id === "cover")).toBe(false);
    });
});

describe("Zakat al-Fitr and Fidya", () => {
    it("charges $15 a person and $15 a missed day, each on its own line, so the Zakat stays exact", () => {
        const q = quote({ ...base, picks: { alfitr: true, fidya: true }, counts: { alfitr: 4, fidya: 3 } }, US, BEFORE);
        expect(q.lines.map((l) => [l.key, l.label, l.value])).toEqual([["gift", "Zakat", 100], ["alfitr", "Zakat al-Fitr, 4 people", 60], ["fidya", "Fidya, 3 days", 45]]);
        expect(q.total).toBe(205);
    });
    it("keeps counts between 1 and the most allowed", () => {
        expect(quote({ ...base, picks: { alfitr: true }, counts: { alfitr: 99 } }, US, BEFORE).lines[1].value).toBe(300);
        expect(quote({ ...base, picks: { alfitr: true }, counts: { alfitr: 0 } }, US, BEFORE).lines[1].value).toBe(15);
    });
    it("fee cover covers the whole one-off charge", () => {
        const q = quote({ ...base, picks: { alfitr: true, cover: true }, counts: { alfitr: 4 } }, US, BEFORE);
        expect(q.lines.at(-1)).toMatchObject({ key: "fee", value: coverCents(16000) / 100 });
    });
});

describe("the last ten nights", () => {
    it("is ten nights from night 21, 10 units, or 15 with double odd nights", () => {
        const all = nightPlan("2027-02-27", false, BEFORE), odd = nightPlan("2027-02-27", true, BEFORE);
        expect(all.map((n) => n.night)).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
        expect(all[0]).toMatchObject({ date: "2027-02-27", due: "2027-02-28T01:00:00.000Z", units: 1 });
        expect(all.reduce((t, n) => t + n.units, 0)).toBe(10);
        expect(odd.reduce((t, n) => t + n.units, 0)).toBe(15);
        expect(odd.filter((n) => n.units === 2).map((n) => n.night)).toEqual([21, 23, 25, 27, 29]);
    });
    it("a saved method is a success with nothing charged; a bank still verifying is on its way", () => {
        expect(fromSetup({ status: "succeeded" }, "s")).toEqual({ status: "succeeded", id: "s" });
        expect(fromSetup({ status: "processing" }, "s")).toEqual({ status: "processing", id: "s", delayed: true });
        expect(fromSetup({ status: "requires_payment_method", client_secret: "seti_1_secret_x" }, "s")).toEqual({ status: "requires_action", id: "s", clientSecret: "seti_1_secret_x" });
    });
    it("leaves out nights already charged", () => {
        expect(nightPlan("2027-02-27", false, new Date("2027-03-03T02:00:00Z")).map((n) => n.night)).toEqual([25, 26, 27, 28, 29, 30]);
        expect(nightPlan("2027-02-27", false, new Date("2027-04-01"))).toEqual([]);
    });
    it("charges nothing today; extras go on the first night; each night covers its own fee", () => {
        const q = quote({ ...base, freq: "nights", amount: 10, odd: true, picks: { cover: true, alfitr: true }, counts: { alfitr: 2 } }, US, BEFORE);
        expect(q.today.total).toBe(0);
        expect(q.nights!.units).toBe(15);
        const c = nightCharges(1000, nightPlan("2027-02-27", true, BEFORE), 3000, true);
        expect(c[0]).toMatchObject({ gift: 2000, extras: 3000, cover: coverCents(5000) });
        expect(c[1]).toMatchObject({ gift: 1000, extras: 0, cover: coverCents(1000) });
        expect(q.nights!.charges[0].total).toBe(c[0].total / 100);
        expect(q.total).toBe((15 * 1000 + 3000 + c.reduce((t, n) => t + n.cover, 0)) / 100);
        expect(q.lines[0].label).toBe("Zakat, 10 nights, double on odd nights");
    });
});

describe("add-on rules", () => {
    const at = { total: 100, layout: "hero", matchLive: true, roundGap: 40, fund: "general" };
    it("shows at most three on the gift screen, in the charity's order; nights, monthly and cover are not counted", () => {
        expect(shownAddons(["cover", "nights", "monthly", "alfitr", "fidya", "dedication", "match", "roundup"], at)).toEqual(["alfitr", "fidya", "dedication"]);
        expect(MAX_SHOWN).toBe(3);
    });
    it("bank debit from $500, pledge only on pledge and kiosk, match only while live, round up only with a gap", () => {
        expect(shownAddons(["bank"], at)).toEqual([]);
        expect(shownAddons(["bank"], { ...at, total: 500 })).toEqual(["bank"]);
        expect(shownAddons(["pledge"], at)).toEqual([]);
        expect(shownAddons(["pledge"], { ...at, layout: "kiosk" })).toEqual(["pledge"]);
        expect(shownAddons(["match"], { ...at, matchLive: false })).toEqual([]);
        expect(shownAddons(["roundup"], { ...at, roundGap: 0 })).toEqual([]);
        expect(shownAddons(["alfitr"], { ...at, fund: "zakat_al_fitr" })).toEqual([]);
    });
    it("rounds up to the next milestone, never by more than the gift", () => {
        expect(roundGap({ raised: 412860, milestone: { step: 500, label: "" } }, 100)).toBe(40);
        expect(roundGap({ raised: 412860, milestone: { step: 5000, label: "" } }, 100)).toBe(0);
        expect(roundGap({ raised: 100, milestone: undefined }, 100)).toBe(0);
    });
    it("the builder refuses a fourth add-on on the gift screen and unknown values", () => {
        expect(settingsProblem(DEFAULT_SETTINGS)).toBeNull();
        expect(settingsProblem({ ...DEFAULT_SETTINGS, addons: ["alfitr", "fidya", "dedication", "roundup"] })).toMatch(/Up to 3/);
        expect(settingsProblem({ ...DEFAULT_SETTINGS, addons: ["alfitr", "fidya", "dedication", "cover", "nights", "monthly"] })).toBeNull();
        expect(toSettings({ layout: "nope", addons: ["cover", "x"], funds: [] })).toMatchObject({ layout: "hero", addons: ["cover"], funds: DEFAULT_SETTINGS.funds });
    });
    it("an embed's query overrides the saved settings only with known values, and never past three", () => {
        const s = embedSettings({ layout: "hero", addons: ["cover"] }, new URLSearchParams("layout=kiosk&funds=zakat,bogus&addons=alfitr,pledge&coverFees=1"));
        expect(s).toMatchObject({ layout: "kiosk", funds: ["zakat"], addons: ["alfitr", "pledge"], cover_default: true });
        expect(embedSettings({ addons: ["cover"] }, new URLSearchParams("addons=alfitr,fidya,dedication,roundup")).addons).toEqual(["cover"]);
    });
});

describe("US vs UK", () => {
    it("works out the region from the currency unless set", () => {
        expect(regionOf(SAMPLE)).toBe("UK");
        expect(regionOf(US)).toBe("US");
        expect(US.giftAid).toBe(false);
    });
    it("US pays by card (wallets ride on it) and bank debit from the add-on; never PayPal or Direct Debit", () => {
        expect(methodsFor("once", "hero", US.payments, { bank: false })).toEqual(["card"]);
        expect(methodsFor("monthly", "hero", US.payments, { bank: true })).toEqual(["card", "bank"]);
        expect(methodsFor("monthly", "hero")).toContain("dd");
    });
    it("US is four screens at most, the short layouts three; the UK keeps its five", () => {
        expect(flowFor(US, "hero")).toEqual([0, 1, 3, 4]);
        expect(flowFor(US, "compact")).toEqual([0, 3, 4]);
        expect(flowFor(SAMPLE, "hero")).toEqual([0, 1, 2, 3, 4]);
    });
    it("reads ?amount= (to the cent) and ?fund=zakat from the zakat calculator's link", () => {
        expect(fromLink(US, "?amount=1234.567&fund=zakat")).toEqual({ fund: "zakat", amount: 1234.57, amountText: "1234.57", amountSource: "link" });
        expect(fromLink(US, "?amount=abc&fund=nope")).toEqual({});
    });
});
