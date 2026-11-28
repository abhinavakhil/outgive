/**
 * Revenue tracking: the shapes the SQL dashboards return (migration 20261128100000) and the maths on top of them, kept pure so the
 * screens, the sample data and the tests share it. Money is integer cents. Channel grouping lives in src/shared/attribution.ts.
 */
export { channelOf, type Channel } from "@/shared/attribution";

/** Dashboard filters. from / to are local dates (inclusive), YYYY-MM-DD. */
export type Filters = { from?: string; to?: string; night?: number; campaign?: string; fund?: string; channel?: string };
export type SourceGroup = "channel" | "utm_source" | "utm_campaign" | "utm_content" | "qr" | "fundraiser" | "team";
export type FunnelGroup = "device" | "layout" | "channel";

export type Tonight = {
    night: number | null; live: boolean;
    raised_cents: number; gifts: number; donors: number; gifts_last_10_min: number;
    pledges: number; pledged_cents: number; pledge_collected_cents: number;
    match_unlocked_cents: number; match_remaining_cents: number;
    match_pots: { sponsor: string; cap_cents: number; matched_cents: number; active: boolean }[];
    top_tables: { qr: string; cents: number; gifts: number }[];
};
export type Slice = { key: string; cents: number; gifts: number; donors: number };
export type Campaign = {
    raised_cents: number; net_cents: number; cover_cents: number; gifts: number; donors: number; new_donors: number; median_cents: number;
    monthly_gifts: number; nightly_gifts: number; pledged_gifts: number;
    by_day: { day: string; cents: number; gifts: number }[];
    by_night: { night: number; cents: number; gifts: number }[];
    by_fund: Slice[]; by_campaign: Slice[];
};
export type SourceRow = Slice & { net_cents: number; visitors: number; spend_cents: number | null };
export type FunnelRow = { key: string; visit: number; checkout_started: number; amount_chosen: number; payment_attempted: number; paid: number };
export type Addons = { gifts: number; fee_covered: number; fee_cover_cents: number; addons: { key: string; shown: number; taken: number; cents: number }[] };

export const STEPS = ["visit", "checkout_started", "amount_chosen", "payment_attempted", "paid"] as const;

// ---------------------------------------------------------------- maths
/** a / b, 0 when b is 0. */
export const rate = (a: number, b: number) => (b > 0 ? a / b : 0);
export const mean = (xs: number[]) => rate(xs.reduce((a, b) => a + b, 0), xs.length);
export const median = (xs: number[]) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Donors per visitor, the prototype's "converts at". */
export const conversion = (donors: number, visitors: number) => rate(donors, visitors);
export const takeUp = (taken: number, shown: number) => rate(taken, shown);
export const feeCoverRate = (covered: number, gifts: number) => rate(covered, gifts);
/** Return on ad spend: dollars raised per dollar spent, or null with no spend recorded. */
export const roas = (cents: number, spend: number | null | undefined) => (spend ? cents / spend : null);

/** The local date and hour of a moment in a time zone. */
const local = (d: Date, tz: string) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
    return { day: Date.UTC(+p.year, +p.month - 1, +p.day), hour: +p.hour };
};
/**
 * The Ramadan night (1-30) a moment belongs to, as revenue_night in SQL. ramadanStart is 1 Ramadan (the first fast); Night N is the
 * evening of ramadanStart + N - 2, and a night runs from local noon to the next noon, so a gift at 1 a.m. counts for the night before.
 */
export const nightOf = (at: Date | string, ramadanStart: string, tz = "America/New_York") => {
    const { day, hour } = local(new Date(at), tz);
    const n = Math.round((day - Date.parse(`${ramadanStart}T00:00:00Z`)) / 86400000) - (hour < 12 ? 1 : 0) + 2;
    return n >= 1 && n <= 30 ? n : null;
};
/** Evening date (YYYY-MM-DD) of Night n. */
export const nightDate = (n: number, ramadanStart: string) => new Date(Date.parse(`${ramadanStart}T00:00:00Z`) + (n - 2) * 86400000).toISOString().slice(0, 10);

/** Thirty nights, zero-filled. */
export const nightSeries = (rows: Campaign["by_night"]) => Array.from({ length: 30 }, (_, i) => rows.find((r) => r.night === i + 1)?.cents ?? 0);
/** First twenty, last ten, and the odd nights of the last ten (21, 23, 25, 27, 29). */
export const nightSplit = (nights: number[]) => ({
    first20: nights.slice(0, 20).reduce((a, b) => a + b, 0),
    last10: nights.slice(20).reduce((a, b) => a + b, 0),
    oddLast10: nights.slice(20).filter((_, i) => (i + 21) % 2 === 1).reduce((a, b) => a + b, 0),
});

/** A dashboard row with the derived figures the table shows. */
export const sourceStats = (rows: SourceRow[]) => {
    const total = rows.reduce((a, r) => a + r.cents, 0);
    return rows.map((r) => ({ ...r, share: rate(r.cents, total), avg_cents: rate(r.cents, r.gifts), conversion: conversion(r.donors, r.visitors), roas: roas(r.cents, r.spend_cents) }));
};
/** The source that turns visitors into donors best (needs visitors). */
export const bestConverter = (rows: SourceRow[]) => sourceStats(rows).filter((r) => r.visitors > 0).sort((a, b) => b.conversion - a.conversion)[0] ?? null;

export const campaignStats = (c: Campaign) => ({
    avg_cents: rate(c.raised_cents, c.gifts), monthly_share: rate(c.monthly_gifts, c.gifts), nightly_share: rate(c.nightly_gifts, c.gifts),
    new_share: rate(c.new_donors, c.donors), fee_cover_share: rate(c.cover_cents, c.raised_cents),
});

/** Each step as a share of visits and of the step before; the biggest drop is where most people leave. */
export const funnelStats = (r: FunnelRow) => STEPS.map((s, i) => ({ step: s, sessions: r[s], ofVisits: rate(r[s], r.visit), ofPrevious: i ? rate(r[s], r[STEPS[i - 1]]) : 1 }));
export const biggestDrop = (r: FunnelRow) => funnelStats(r).slice(1).sort((a, b) => a.ofPrevious - b.ofPrevious)[0]?.step ?? null;

export const addonStats = (a: Addons) => ({
    feeCover: feeCoverRate(a.fee_covered, a.gifts),
    addons: a.addons.map((x) => ({ ...x, takeUp: takeUp(x.taken, x.shown), avg_cents: rate(x.cents, x.taken) })).sort((p, q) => q.takeUp - p.takeUp),
});

/** Gifts per minute over the last-10-minutes window. */
export const perMinute = (t: Pick<Tonight, "gifts_last_10_min">) => t.gifts_last_10_min / 10;

// ---------------------------------------------------------------- CSV
const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v instanceof Date ? v.toISOString() : String(v);
    // Quote when needed; a leading = + - @ is neutralised so a spreadsheet never runs it as a formula.
    const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
/** Rows to CSV with a header row; columns default to the first row's keys. */
export const toCsv = (rows: Record<string, unknown>[], columns = rows[0] ? Object.keys(rows[0]) : []) =>
    [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\r\n");
