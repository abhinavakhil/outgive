/**
 * A/B tests of ask amounts and layouts, per organisation (checkout_experiments in 20261128300000_us_checkout.sql).
 * A browser session sticks to one variant: the same session and test always give the same variant. A result is conversion
 * (paid gifts / visitors) and the average gift, with a plain two-proportion z-test to say when a difference is likely real.
 */
import type { Layout } from "./us";

export interface Variant { id: string; label: string; layout?: Layout; presets?: number[] }
export interface Experiment { id: string; kind: "amounts" | "layout"; variants: Variant[] }

/** FNV-1a, 32 bits: small, fast and even enough to split sessions. */
export const hash = (s: string) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
};
/** The variant this session sees. Sticky: depends only on the test and the session. */
export const assign = (e: Pick<Experiment, "id" | "variants">, session: string): Variant => e.variants[hash(`${e.id}:${session}`) % e.variants.length];

const KEY = "ck_session";
/** This browser session's id (sessionStorage), made once. Falls back to a fresh id where storage is blocked. */
export const sessionId = () => {
    try { let s = window.sessionStorage.getItem(KEY); if (!s) { s = crypto.randomUUID(); window.sessionStorage.setItem(KEY, s); } return s; } catch { return crypto.randomUUID(); }
};

export interface Arm { id: string; label: string; visitors: number; gifts: number; raised_cents: number }
export const conversion = (a: Pick<Arm, "visitors" | "gifts">) => (a.visitors > 0 ? a.gifts / a.visitors : 0);
export const averageGift = (a: Pick<Arm, "gifts" | "raised_cents">) => (a.gifts > 0 ? a.raised_cents / a.gifts / 100 : 0);
/** Revenue per visitor: what each variant earns for every donor who sees it (conversion × average gift). */
export const perVisitor = (a: Arm) => (a.visitors > 0 ? a.raised_cents / a.visitors / 100 : 0);

/** Standard normal CDF (Abramowitz and Stegun 26.2.17, error under 1e-7). */
const phi = (z: number) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp((-z * z) / 2);
    const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z > 0 ? 1 - p : p;
};
/** Fewer visitors than this per variant and the readout says "too early", whatever the numbers. */
export const MIN_VISITORS = 100;
/**
 * Is variant b's conversion different from a's? Two-proportion z-test, two-sided. `confident` at p < 0.05 with enough visitors.
 * ponytail: conversion only, and a fixed 95% bar checked whenever you look (peeking inflates false wins a little); use a sequential
 * test if charities start stopping tests early on it.
 */
export const significance = (a: Pick<Arm, "visitors" | "gifts">, b: Pick<Arm, "visitors" | "gifts">) => {
    const pa = conversion(a), pb = conversion(b), n = a.visitors + b.visitors;
    const pool = n ? (a.gifts + b.gifts) / n : 0, se = Math.sqrt(pool * (1 - pool) * (1 / Math.max(1, a.visitors) + 1 / Math.max(1, b.visitors)));
    const z = se > 0 ? (pb - pa) / se : 0, p = 2 * (1 - phi(Math.abs(z)));
    return { lift: pa > 0 ? pb / pa - 1 : 0, z, p, enough: a.visitors >= MIN_VISITORS && b.visitors >= MIN_VISITORS, confident: a.visitors >= MIN_VISITORS && b.visitors >= MIN_VISITORS && p < 0.05 };
};
/** The readout in words for a variant against the first (the control). */
export const verdict = (control: Arm, arm: Arm) => {
    const s = significance(control, arm);
    if (!s.enough) return { tone: "grey" as const, text: `Too early: ${MIN_VISITORS} visitors each needed` };
    if (!s.confident) return { tone: "lilac" as const, text: "No clear difference yet" };
    return s.lift > 0 ? { tone: "sage" as const, text: `Likely better: +${Math.round(s.lift * 100)}% conversion` } : { tone: "peach" as const, text: `Likely worse: ${Math.round(s.lift * 100)}% conversion` };
};
