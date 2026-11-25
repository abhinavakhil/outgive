import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE } from "../bio/model";
import { type Choice, expiryOk, impactOf, levelOf, luhn, menuFrom, nightsFor, quote } from "./model";

const menu = menuFrom(DEFAULT_PAGE);
const base: Choice = { qty: { food: 2, water: 1 }, mode: "10", picked: [], boost: 0, roundUp: false, cover: false, giftAid: false, tip: 0, qadr: 0, extra: 0 };
const q = (c: Partial<Choice>) => quote({ ...base, ...c }, menu);

describe("ramadan give quote", () => {
    it("gives the basket on each chosen night", () => {
        const r = q({});
        expect(r.basket).toBe(13); // 2 × £4 iftar + £5 water
        expect(r.nights).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
        expect(r.total).toBe(130);
        expect(r.match).toBe(130);
        expect(r.receives).toBe(260);
    });
    it("rounds up and boosts only the last ten nights", () => {
        const r = q({ mode: "30", roundUp: true, boost: "double" });
        expect(r.nightly).toBe(15);
        expect(r.roundUp).toBe(2);
        expect(r.perNight).toEqual([15, 30]);
        expect(r.gifts).toBe(20 * 15 + 10 * 30);
    });
    it("charges one-off items today, with tip, fee cover and Gift Aid", () => {
        const r = q({ mode: "odd", qty: { food: 1, fitr: 4 }, tip: 1, cover: true, giftAid: true });
        expect(r.charges[0]).toEqual({ night: 0, gift: 20, tip: 1, fee: 0.52, total: 21.52 });
        expect(r.charges.length).toBe(6);
        expect(r.gifts).toBe(20 + 5 * 4);
        expect(r.giftAid).toBe(10);
        expect(r.tips).toBe(6);
    });
    it("gives once as a single charge today", () => {
        const r = q({ mode: "once", boost: 10 });
        expect(r.charges).toEqual([{ night: 0, gift: 13, tip: 0, fee: 0, total: 13 }]);
    });
    it("charges nothing for an empty basket", () => {
        expect(q({ qty: {} }).charges).toEqual([]);
        expect(nightsFor("pick", [27, 3, 3, 40])).toEqual([3, 27]);
    });
    it("adds the night-27 boost and the one-off extra", () => {
        const r = q({ qadr: 50, extra: 5 });
        expect(r.charges.find((c) => c.night === 27)?.gift).toBe(19.5);
        expect(r.charges[0]).toEqual({ night: 0, gift: 5, tip: 0, fee: 0, total: 5 });
        expect(r.gifts).toBe(130 + 6.5 + 5);
    });
    it("adds the nightly top-up and any last-ten extra", () => {
        const r = q({ topUp: 7, boost: 3 });
        expect(r.nightly).toBe(20);
        expect(r.perNight).toEqual([23]);
        expect(r.gifts).toBe(230);
    });
    it("lets a bundle set the nightly amount, and names its level and impact", () => {
        const r = q({ amount: 50, mode: "30" });
        expect(r.nightly).toBe(50);
        expect(r.gifts).toBe(1500);
        expect(levelOf(50)).toBe(4);
        expect(levelOf(4)).toBe(0);
        expect(impactOf(120, { food: 2, water: 1 }, menu)).toBe("30 iftar meals");
    });
    it("gives on the Fridays of Ramadan", () => {
        const r = quote({ ...base, mode: "fri" }, menu, "2027-02-08");
        expect(r.nights).toEqual([5, 12, 19, 26]);
    });
    it("checks cards", () => {
        expect(luhn("4242 4242 4242 4242")).toBe(true);
        expect(luhn("4242 4242 4242 4241")).toBe(false);
        expect(expiryOk("12/30", new Date(2026, 10, 1))).toBe(true);
        expect(expiryOk("10/26", new Date(2026, 10, 1))).toBe(false);
    });
});
