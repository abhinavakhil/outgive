import { describe, expect, it } from "vitest";
import { type Freq, type Match, SAMPLE, type Trust, clampAmount, dialAmount, feeFor, impactFor, matchFor, methodsFor, money, nextDate, quote, ratioAt, sponsorName, suggestMonthly, trustClaims, trustGaps } from "./model";
import { resolveFlag } from "@/shared/lib/flags";

describe("checkout quote", () => {
    const base = { amount: 25, freq: "once" as const, picks: {}, ga: true };
    const all = { cover: true, meal: true, kit: true, tribute: true };
    const NOW = new Date(2026, 10, 21, 12); // local time, before the sample match's deadline
    const q$ = (s: { freq?: Freq; picks?: Record<string, boolean>; ga?: boolean }, c = SAMPLE) => quote({ ...base, ...s }, c, NOW);
    it("adds Gift Aid and match to what the charity receives", () => {
        const q = q$({});
        expect(q.total).toBe(25);
        expect(q.giftAid).toBe(6.25);
        expect(q.match).toBe(25);
        expect(q.matchReason).toBeNull();
        expect(q.receives).toBe(56.25);
        expect(q.oneOff).toBe(0);
        expect(q.later).toBeNull();
        expect(q.today).toEqual({ lines: q.lines, total: 25 });
    });
    it("charges one-off extras and a covered fee, but the fee is not received", () => {
        const q = q$({ picks: all });
        expect(feeFor(25, SAMPLE)).toBe(0.59); // (25 + 0.20) / (1 - 1.5%) - 25, rounded up
        expect(q.recur).toBe(25.71); // a one-off covers the fee on the whole charge, extras included
        expect(q.oneOff).toBe(8);
        expect(q.total).toBe(33.71);
        expect(q.receives).toBe(66.25);
        expect(q.lines.map((l) => l.key)).toEqual(["gift", "meal", "kit", "fee"]);
    });
    it("claims Gift Aid on donations only, line by line, never on the covered fee", () => {
        const q = q$({ picks: all });
        expect(q.lines.map((l) => l.giftAid)).toEqual([6.25, 0.75, 1.25, 0]);
        expect(q.giftAid).toBe(8.25);
        // Fee cover alone adds nothing to the claim.
        expect(q$({ picks: { cover: true } }).giftAid).toBe(6.25);
        // An extra is not a donation unless it says so.
        const shop = { ...SAMPLE, extras: [{ ...SAMPLE.extras![1], giftAidEligible: undefined }] };
        expect(q$({ picks: { meal: true } }, shop).giftAid).toBe(6.25);
        // Pennies: 25% of £2.99 is 74.75p, claimed as 75p.
        const odd = { ...SAMPLE, extras: [{ ...SAMPLE.extras![1], price: 2.99 }] };
        expect(q$({ picks: { meal: true } }, odd).giftAid).toBe(7);
    });
    it("drops Gift Aid when off, or when the campaign has none", () => {
        const off = q$({ ga: false, picks: all });
        expect(off.giftAid).toBe(0);
        expect(off.lines.every((l) => l.giftAid === 0)).toBe(true);
        expect(q$({}, { ...SAMPLE, giftAid: false, match: null }).receives).toBe(25);
    });
    it("splits a monthly gift into today and later: the fee recurs, extras are charged once", () => {
        const q = q$({ freq: "monthly", picks: all });
        expect(q.lines.map((l) => [l.key, l.when])).toEqual([["gift", "recurring"], ["meal", "once"], ["kit", "once"], ["fee", "recurring"]]);
        expect(q.today.total).toBe(33.59);
        expect(q.later!.lines.map((l) => l.key)).toEqual(["gift", "fee"]);
        expect(q.later!.total).toBe(25.59);
        expect(q.later!.total).toBe(q.recur);
        expect(q.later!.giftAid).toBe(6.25);
        expect(q.later!.next).toEqual(new Date(2026, 11, 21, 12));
        // Nothing picked: later is just the gift. One-off gifts mark every line "once".
        expect(q$({ freq: "yearly" }).later).toMatchObject({ total: 25, next: new Date(2027, 10, 21, 12) });
        expect(q$({ picks: all }).lines.every((l) => l.when === "once")).toBe(true);
    });
    it("keeps the next charge inside a shorter month", () => {
        expect(nextDate("monthly", new Date(2027, 0, 31))).toEqual(new Date(2027, 1, 28));
        expect(nextDate("yearly", new Date(2028, 1, 29))).toEqual(new Date(2029, 1, 28));
    });
});

describe("verified matching", () => {
    const NOW = new Date(2026, 10, 21, 12);
    const m: Match = { sponsor: "[Sponsor name]", status: "confirmed", deadline: "2026-11-30", remaining: 1000 };
    it("doubles a gift from a confirmed sponsor, at its ratio", () => {
        expect(matchFor(m, 25, NOW)).toEqual({ amount: 25, reason: null, capped: false });
        expect(matchFor({ ...m, ratio: 0.5 }, 25, NOW).amount).toBe(12.5);
    });
    it("counts nothing, and says why", () => {
        expect(matchFor(null, 25, NOW).reason).toBe("none");
        expect(matchFor({ ...m, status: "pending" }, 25, NOW)).toEqual({ amount: 0, reason: "unconfirmed", capped: false });
        expect(matchFor({ until: "30 Nov" }, 25, NOW).reason).toBe("unconfirmed"); // the old shape names no sponsor
        expect(matchFor(m, 25, new Date(2026, 11, 1)).reason).toBe("expired");
        expect(matchFor({ ...m, deadline: "soon" }, 25, NOW).reason).toBe("expired");
        expect(matchFor({ ...m, remaining: 0 }, 25, NOW).reason).toBe("cap-reached");
        expect(matchFor({ ...m, minGift: 30 }, 25, NOW).reason).toBe("below-min");
    });
    it("runs to the end of the deadline day, or to the exact time given", () => {
        expect(matchFor(m, 25, new Date(2026, 10, 30, 23, 59)).amount).toBe(25);
        expect(matchFor({ ...m, deadline: "2026-11-21T11:00:00Z" }, 25, new Date("2026-11-21T11:00:01Z")).reason).toBe("expired");
    });
    it("stops at what is left in the pot and at the per-gift cap", () => {
        expect(matchFor({ ...m, remaining: 10.5 }, 25, NOW)).toEqual({ amount: 10.5, reason: null, capped: true });
        expect(matchFor({ ...m, perGiftMax: 100 }, 500, NOW)).toEqual({ amount: 100, reason: null, capped: true });
    });
    it("reaches the quote", () => {
        const s = { amount: 25, freq: "once" as const, picks: {}, ga: false };
        expect(quote(s, { ...SAMPLE, match: { ...m, remaining: 10 } }, NOW)).toMatchObject({ match: 10, matchCapped: true, receives: 35 });
        expect(quote(s, { ...SAMPLE, match: m }, new Date(2027, 0, 1))).toMatchObject({ match: 0, matchReason: "expired", receives: 25 });
    });
});

describe("trust details", () => {
    const ok: Trust = { legalName: "Marsh Lane Community Trust", regNo: "0000000", regulator: "Charity Commission for England and Wales", verified: true, verifiedAt: "2026-11-01", taxReceipts: true, fund: { name: "General fund", restricted: false } };
    it("clears a complete, verified charity", () => { expect(trustGaps(ok)).toEqual([]); });
    it("lists what is missing, a placeholder, or unverified", () => {
        expect(trustGaps(undefined)).toEqual(["legalName", "regNo", "regulator", "verified", "fund"]);
        expect(trustGaps(SAMPLE.trust)).toEqual(["legalName", "regNo", "verified", "fund"]);
        expect(trustGaps({ ...ok, regNo: " " })).toEqual(["regNo"]);
        expect(trustGaps({ ...ok, verifiedAt: undefined })).toEqual(["verified"]);
        expect(trustGaps({ ...ok, verified: false })).toEqual(["verified"]);
    });
});

describe("amounts and the dial", () => {
    it("clamps typed amounts", () => { expect(clampAmount("0")).toBe(2); expect(clampAmount(99999)).toBe(10000); expect(clampAmount("abc")).toBe(2); });
    it("snaps the dial to 5s from 5 to 500", () => { expect(dialAmount(0)).toBe(5); expect(dialAmount(1)).toBe(500); expect(dialAmount(0.5)).toBe(255); });
    it("reads the angle clockwise from the top", () => {
        expect(ratioAt(0, -10, 25, false)).toBeCloseTo(0); // top
        expect(ratioAt(10, 0, 25, false)).toBeCloseTo(0.25); // right
        expect(ratioAt(0, 10, 25, false)).toBeCloseTo(0.5); // bottom
    });
    it("does not wrap from max to min while dragging past the top", () => {
        expect(ratioAt(1, -10, 480, true)).toBe(1);
        expect(ratioAt(-1, -10, 6, true)).toBe(0);
    });
    it("picks an impact line and a monthly suggestion", () => {
        expect(impactFor(60, SAMPLE)).toBe("a youth worker for one evening");
        expect(impactFor(3, SAMPLE)).toBe("part of an evening’s heating");
        expect(suggestMonthly(25)).toBe(10);
        expect(suggestMonthly(1000)).toBe(50);
    });
    it("formats whole and part pounds", () => { expect(money(25, "GBP")).toBe("£25"); expect(money(25.5, "GBP")).toBe("£25.50"); });
    it("offers Direct Debit only for regular gifts", () => {
        expect(methodsFor("monthly", "hero")).toContain("dd");
        expect(methodsFor("once", "hero")).not.toContain("dd");
        expect(methodsFor("once", "ticket")).toEqual(["apple", "card", "bank", "paypal"]);
    });
});

describe("checkout_layout flag", () => {
    it("prefers the address, then this browser, then the build, then the default", () => {
        expect(resolveFlag("checkout_layout", { search: "?checkout_layout=ticket", stored: "pledge", env: "hero" })).toBe("ticket");
        expect(resolveFlag("checkout_layout", { search: "", stored: "pledge", env: "ticket" })).toBe("pledge");
        expect(resolveFlag("checkout_layout", { env: "ticket" })).toBe("ticket");
        expect(resolveFlag("checkout_layout", {})).toBe("hero");
    });
    it("ignores values it does not know", () => {
        expect(resolveFlag("checkout_layout", { search: "?checkout_layout=nope", env: "bogus" })).toBe("hero");
    });
});

import { cardBrand, expiryOk, formatCard, luhn } from "./model";
describe("card helpers", () => {
    it("spots the brand and groups the digits", () => {
        expect(cardBrand("4242")).toBe("visa"); expect(cardBrand("5555")).toBe("mastercard"); expect(cardBrand("3782")).toBe("amex");
        expect(formatCard("4242424242424242")).toBe("4242 4242 4242 4242");
        expect(formatCard("378282246310005")).toBe("3782 822463 10005");
    });
    it("checks the number and the expiry", () => {
        expect(luhn("4242424242424242")).toBe(true); expect(luhn("4242424242424241")).toBe(false);
        expect(expiryOk("1230", new Date(2026, 10))).toBe(true); expect(expiryOk("1025", new Date(2026, 10))).toBe(false); expect(expiryOk("1330")).toBe(false);
    });
});

import { payProblem } from "./model";
describe("what can be paid with", () => {
    it("offers only the methods the charity switched on", () => {
        expect(methodsFor("once", "ticket", { card: true, paypal: false, wallets: false, bank: false })).toEqual(["card"]);
        expect(methodsFor("monthly", "hero", { card: false, dd: true })).toEqual(["dd"]);
        expect(methodsFor("once", "hero", {})).toEqual([]);
    });
    it("refuses incomplete or wrong card and bank details", () => {
        const ok = { card: "4242424242424242", exp: "1230", cvc: "123", holder: "Sam Lee", bank: "", ddName: "", sort: "", acct: "" };
        expect(payProblem("card", ok)).toBeNull();
        expect(payProblem("card", { ...ok, card: "4242424242424241" })?.field).toBe("card");
        expect(payProblem("card", { ...ok, exp: "0120" })?.field).toBe("exp");
        expect(payProblem("card", { ...ok, cvc: "12" })?.field).toBe("cvc");
        expect(payProblem("card", { ...ok, holder: "" })?.field).toBe("holder");
        expect(payProblem("dd", { ...ok, ddName: "Sam", sort: "123456", acct: "1234567" })?.field).toBe("acct");
        expect(payProblem("bank", ok)?.field).toBe("bank");
        expect(payProblem("apple", ok)).toBeNull();
    });
});

describe("what the donor is shown about trust and the sponsor", () => {
    const full: Trust = { legalName: "Test Charity Ltd", regNo: "T-1", regulator: "Test Regulator", verified: true, verifiedAt: "2026-05-03", taxReceipts: true, fund: { name: "Test fund", restricted: true } };
    it("shows nothing for an unverified organisation, the sample included", () => {
        expect(trustClaims(SAMPLE.trust)).toBeNull();
        expect(trustClaims(undefined)).toBeNull();
        expect(trustClaims({ ...full, verified: false })).toBeNull();
        expect(trustClaims({ ...full, verifiedAt: undefined })).toBeNull();
    });
    it("shows each verified claim only when it is filled in", () => {
        expect(trustClaims(full)).toMatchObject({ legalName: "Test Charity Ltd", registration: { regNo: "T-1", regulator: "Test Regulator" }, fund: { name: "Test fund", restricted: true }, taxReceipts: true });
        const partial = trustClaims({ ...full, regNo: "[Registration number]", legalName: " ", taxReceipts: false, fund: { name: "[Fund name]", restricted: false } });
        expect(partial).toMatchObject({ legalName: "", registration: null, fund: null, taxReceipts: false });
        expect(trustClaims({ ...full, regulator: "" })?.registration).toBeNull(); // a number without its regulator is not a claim
    });
    it("names a sponsor, but never a placeholder or the old match shape", () => {
        expect(sponsorName({ sponsor: "Acme Trust", status: "confirmed", deadline: "2027-01-31", remaining: 1 })).toBe("Acme Trust");
        expect(sponsorName(SAMPLE.match)).toBe("");
        expect(sponsorName({ until: "30 Nov" })).toBe("");
        expect(sponsorName(null)).toBe("");
    });
});
