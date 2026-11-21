/**
 * Every figure on the charity dashboard, worked out in the browser from the organisation's gifts (org_donations).
 * ponytail: reads the newest ROW_LIMIT gifts, so a long range undercounts for an organisation with more; move the sums into a SQL function then.
 */
import type { DonationRow } from "@/shared/domain/types";

export const ROW_LIMIT = 2000;
/** A gift as org_donations returns it; older rows have no pay_method. */
export type Row = DonationRow & { pay_method?: string | null; gift_aid_cents?: number | string };
export interface Bucket { label: string; when: string; from: number; to: number; usd: number; one: number; rec: number; gifts: number; donors: number }
export type Unit = "day" | "week" | "month";

const paid = (r: Row) => r.status === "succeeded";
const at = (r: Row) => new Date(r.created_at).getTime();
const usdOf = (rs: Row[]) => rs.reduce((n, r) => n + Number(r.usd_cents), 0) / 100;
export const donorKey = (r: Row) => (r.donor_email || r.donor_name || "").toLowerCase();
const d = (t: number, o: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString("en-GB", o);

/** Paid gifts made from `from` up to (not including) `to`. */
export const paidBetween = (rows: Row[], from: number, to: number) => rows.filter((r) => paid(r) && at(r) >= from && at(r) < to);

/** Change from prev to cur in percent; null when there is nothing to compare with. */
export const change = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The top of a chart's axis: the next round figure that splits into thirds. */
export const niceMax = (v: number) => { if (!(v > 0)) return 3; const p = 10 ** Math.floor(Math.log10(v)); return [1.2, 1.5, 3, 6, 9, 12].map((m) => m * p).find((m) => m >= v)!; };

/** The last n days, 7-day weeks ending today, or calendar months, oldest first, in the viewer's time zone. Money counts paid gifts only. */
export const buckets = (rows: Row[], unit: Unit, n: number, now = Date.now()): Bucket[] => {
    /** Start of the bucket k steps back; k = -1 is where the newest ends. */
    const edge = (k: number) => {
        const x = new Date(now); x.setHours(0, 0, 0, 0);
        if (unit === "month") { x.setDate(1); x.setMonth(x.getMonth() - k); } else x.setDate(x.getDate() - (unit === "week" ? 7 * (k + 1) - 1 : k));
        return x.getTime();
    };
    const ok = rows.filter(paid);
    return Array.from({ length: n }, (_, i) => {
        const k = n - 1 - i; const from = edge(k); const to = edge(k - 1);
        const inside = ok.filter((r) => at(r) >= from && at(r) < to);
        const sofar = k === 0 ? ", so far" : "";
        return {
            from, to, usd: usdOf(inside), one: usdOf(inside.filter((r) => !r.recurring)), rec: usdOf(inside.filter((r) => r.recurring)), gifts: inside.length, donors: new Set(inside.map(donorKey)).size,
            label: unit === "day" ? d(from, { weekday: "short" }) : unit === "week" ? d(from, { day: "numeric", month: "short" }) : d(from, { month: "short" }),
            when: unit === "day" ? d(from, { weekday: "short", day: "numeric", month: "short" }) + sofar : unit === "week" ? `7 days from ${d(from, { day: "numeric", month: "short" })}` : d(from, { month: "long", year: "numeric" }) + sofar,
        };
    });
};

/** Share of paid gifts by how they were paid: the biggest `top`, the rest as Other. */
export const methodShare = (rows: Row[], name: (key: string) => string, top = 3) => {
    const counts = new Map<string, number>();
    for (const r of rows.filter(paid)) { const k = name(r.pay_method || r.source); counts.set(k, (counts.get(k) ?? 0) + 1); }
    const all = [...counts].sort((a, b) => b[1] - a[1]); const total = sum(all.map((x) => x[1]));
    const rest = sum(all.slice(top).map((x) => x[1]));
    return [...all.slice(0, top), ...(rest ? [["Other", rest] as [string, number]] : [])].map(([label, count]) => ({ label, count, pct: (count / total) * 100 }));
};

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const PARTS: [string, number][] = [["Morning", 6], ["Afternoon", 12], ["Evening", 18], ["Night", 0]];
/** Paid gifts by weekday and part of the day (viewer's time zone): grid[part][day], with the busiest and quietest cells named. */
export const heat = (rows: Row[]) => {
    const grid = PARTS.map(() => DAYS.map(() => 0));
    for (const r of rows.filter(paid)) { const t = new Date(r.created_at); const h = t.getHours(); grid[h < 6 ? 3 : h < 12 ? 0 : h < 18 ? 1 : 2][(t.getDay() + 6) % 7]++; }
    const cells = grid.flatMap((row, p) => row.map((count, day) => ({ count, name: `${DAYS[day]} ${PARTS[p][0].toLowerCase()}` })));
    const by = [...cells].sort((a, b) => b.count - a.count);
    return { grid, max: by[0].count, busiest: by[0].name, quietest: by[by.length - 1].name };
};

/** Donors who gave, gave more than once, and give regularly. */
export const loyalty = (rows: Row[]) => {
    const n = new Map<string, number>(); const regular = new Set<string>();
    for (const r of rows.filter(paid)) { const k = donorKey(r); n.set(k, (n.get(k) ?? 0) + 1); if (r.recurring) regular.add(k); }
    return { donors: n.size, repeat: [...n.values()].filter((c) => c > 1).length, regular: regular.size };
};

/** Money raised by the page it was given on; gifts on no page are the organisation's own. */
export const byPage = (rows: Row[], title: (pageId: string) => string | undefined, top = 5) => {
    const m = new Map<string, number>();
    for (const r of rows.filter(paid)) { const k = (r.page_id && title(r.page_id)) || "Leaderboard and direct gifts"; m.set(k, (m.get(k) ?? 0) + Number(r.usd_cents) / 100); }
    const total = sum([...m.values()]);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, top).map(([label, usd]) => ({ label, usd, pct: total ? (usd / total) * 100 : 0 }));
};

/** Percent of paid gifts with Gift Aid on them. */
export const giftAidShare = (rows: Row[]) => { const ok = rows.filter(paid); return ok.length ? (ok.filter((r) => Number(r.gift_aid_cents) > 0).length / ok.length) * 100 : 0; };
