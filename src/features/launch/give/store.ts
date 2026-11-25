/**
 * The Ramadan basket, shared by the charity page (/ramadhan) and the give flow (/ramadhan/give).
 * Picking a cause or nights on the page puts it in this basket; the flow opens with it, and changes there show back on the page.
 * Kept in localStorage until the gift is paid. Every open copy stays in step.
 */
import { useCallback, useEffect, useState } from "react";
import type { Choice } from "./model";

export type Donor = { first: string; last: string; email: string; anon: boolean; zakat: boolean; news: boolean; behalf: string; note: string; house: string; postcode: string; giveAs: "Sadaqah" | "Zakat" | "Sadaqah Jariyah" | "Lillah"; behalfOn?: boolean };
export type Method = "apple" | "google" | "card" | "paypal";
export type Give = Choice & { donor: Donor; method: Method };

export const EMPTY: Give = {
    qty: {}, mode: "30", picked: [21, 23, 25, 27, 29], boost: 0, topUp: 0, roundUp: false, cover: true, giftAid: false, tip: 1, qadr: 0, extra: 0,
    donor: { first: "", last: "", email: "", anon: false, zakat: false, news: false, behalf: "", note: "", house: "", postcode: "", giveAs: "Sadaqah" }, method: "card",
};
const KEY = "outgive.rgive.v2";

const read = (): Give => {
    try { const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Give> | null; if (s) return { ...EMPTY, ...s, donor: { ...EMPTY.donor, ...s.donor } }; } catch { /* storage unavailable */ }
    return EMPTY;
};
const listeners = new Set<(g: Give) => void>();
let current: Give | null = null;
const write = (g: Give) => {
    current = g;
    try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* storage unavailable */ }
    listeners.forEach((l) => l(g));
};
// Another tab changed the basket.
if (typeof window !== "undefined") addEventListener("storage", (e) => { if (e.key === KEY) { current = null; const g = read(); listeners.forEach((l) => l(g)); } });

/** The shared basket and a setter that takes a patch or an updater. */
export const useGive = () => {
    const [g, setG] = useState<Give>(() => (current ??= read()));
    // Catch up on anything written between this render and subscribing (a child's effect runs before its parent's).
    useEffect(() => { listeners.add(setG); if (current) setG(current); return () => void listeners.delete(setG); }, []);
    const set = useCallback((p: Partial<Give> | ((g: Give) => Partial<Give>)) => { const base = current ?? read(); write({ ...base, ...(typeof p === "function" ? p(base) : p) }); }, []);
    return [g, set] as const;
};
/** After payment: forget the basket and the donor's details. */
export const clearGive = () => { current = EMPTY; try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } listeners.forEach((l) => l(EMPTY)); };
