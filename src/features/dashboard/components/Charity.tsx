import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useApp } from "@/shared/lib/app-context";
import { csv, download } from "@/shared/lib/format";
import { CURRENCIES } from "@/shared/domain/model";
import { fmt } from "@/shared/lib/money";
import type { BoardRow, Org, PageRow } from "@/shared/domain/types";
import { AnimatedListItem, BorderBeam, NumberTicker } from "@/shared/ui";
import { cx } from "@/shared/utils/cx";
import { type Bucket, DAYS, PARTS, ROW_LIMIT, type Row, type Unit, buckets, byPage, change, donorKey, giftAidShare, heat, loyalty, methodShare, niceMax, paidBetween, sum } from "../insights";
import { methodOf } from "./Giving";

/** A row of org_recurring: one standing gift to the organisation. */
export interface OrgRegular { id: string; donor_name: string; amount_cents: number; currency: string; every: "monthly" | "yearly"; status: "active" | "paused" | "cancelled"; method: string; started_at: string; next_at: string | null; cancelled_at: string | null; failed: boolean }
export interface OrgData { id: string; rows: Row[]; subs: OrgRegular[]; visits: number; titles: Map<string, string> }

/** The organisation's gifts, regular gifts, page visits and page titles; read again whenever a gift lands. */
export const useOrgData = (org: Org | null): OrgData | null => {
    const { db, toast } = useApp();
    const [data, setData] = useState<OrgData | null>(null);
    const id = org?.id;
    const load = useCallback(() => {
        if (!id) return;
        Promise.all([db.rpc<Row[]>("org_donations", { org: id, n: ROW_LIMIT }), db.rpc<OrgRegular[]>("org_recurring", { org: id }), db.rpc<BoardRow[]>("board", { org: id }), db.rpc<PageRow[]>("pages_list", { org: id })])
            .then(([rows, subs, board, pages]) => setData({ id, rows, subs, visits: sum(board.map((b) => b.visits)), titles: new Map(pages.map((p) => [p.id, p.title])) }))
            .catch((e) => toast((e as Error).message));
    }, [db, id, toast]);
    useEffect(() => {
        if (!id) return;
        load(); let t: ReturnType<typeof setTimeout>;
        const off = db.onDonations(id, () => { clearTimeout(t); t = setTimeout(load, 400); });
        return () => { off(); clearTimeout(t); };
    }, [db, id, load]);
    return data?.id === id ? data : null;
};

const MUTED = "text-(--od-muted)";
const DAY = 86400000;
const dayOf = (iso: string | number, year = false) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year && { year: "numeric" }) });
const STATUS: Record<string, [string, string]> = { succeeded: ["Paid", "ok"], refunded: ["Refunded", "flat"], failed: ["Failed", "bad"], disputed: ["Disputed", "warn"], active: ["Active", "ok"], paused: ["Paused", "warn"], cancelled: ["Cancelled", "flat"] };
const Tag = ({ s }: { s: string }) => <span className={cx("od-tag", STATUS[s]?.[1] ?? "flat")}>{STATUS[s]?.[0] ?? s}</span>;
const typeOf = (r: Row) => (r.recurring ? "Monthly" : "One-off");
const aidOf = (r: Row) => (Number(r.gift_aid_cents) > 0 ? "Yes" : "No");
const pctText = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
/** How a figure moved against the period before. down: a rise is bad news (refunds). */
const Delta = ({ v, down, title }: { v: number | null; down?: boolean; title: string }) => (v === null ? null : <span title={title} className={cx("od-tag", v === 0 ? "flat" : v > 0 !== !!down ? "ok" : "bad")}>{pctText(v)}</span>);

/** money: whole units in the viewer's currency; short: £1.2k for axis labels. */
const useMoney = () => {
    const { money, currency } = useApp();
    const short = useCallback((usd: number) => new Intl.NumberFormat("en", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(usd * CURRENCIES[currency]), [currency]);
    return { money, short };
};
const Card = ({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) => <section className={cx("od-card flex flex-col", className)} style={style}>{children}</section>;
const Seg = <T extends string>({ label, options, value, onChange }: { label: string; options: readonly (readonly [T, string, string?])[]; value: T; onChange: (v: T) => void }) => (
    <div role="group" aria-label={label} className="od-seg">{options.map(([id, text, aria]) => <button key={id} type="button" aria-pressed={value === id} aria-label={aria} onClick={() => onChange(id)}>{text}</button>)}</div>
);
const Chips = <T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void }) => (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2.5">{options.map((o) => <button key={o} type="button" className="od-chip" aria-pressed={value === o} onClick={() => onChange(o)}>{o}</button>)}</div>
);
const Ticks = ({ max, short, height }: { max: number; short: (n: number) => string; height: number }) => <div aria-hidden="true" className={cx("flex flex-col justify-between text-sm", MUTED)} style={{ height }}>{[1, 2 / 3, 1 / 3, 0].map((f) => <span key={f} className="flex h-0 items-center leading-none">{short(max * f)}</span>)}</div>;
/** The one tooltip of a chart, beside column i of n; it flips to the other side past halfway and never leaves the plot. */
const tipSide = (i: number, n: number, gap: number): CSSProperties => (i >= n / 2 ? { right: `clamp(0px, calc(${((n - i - 0.5) / n) * 100}% + ${gap}px), calc(100% - 210px))` } : { left: `clamp(0px, calc(${((i + 0.5) / n) * 100}% + ${gap}px), calc(100% - 210px))` });
const Table = ({ cols, head, min, children, empty }: { cols: string; head: ReactNode[]; min: number; children: ReactNode[]; empty: string }) => (
    <div className="overflow-x-auto"><div role="table" className="flex flex-col" style={{ minWidth: min }}>
        <div role="row" className="od-head" style={{ gridTemplateColumns: cols }}>{head.map((h, i) => <span role="columnheader" key={i} className={cx(i === head.length - 1 && i > 3 && "text-right")}>{h}</span>)}</div>
        <div role="rowgroup" className="od-rows flex flex-col">{children}</div>
        {children.length === 0 && <p className={cx("px-1.5 pt-4 text-sm", MUTED)}>{empty}</p>}
    </div></div>
);
const cell = (v: ReactNode, cls?: string) => <span role="cell" className={cx("min-w-0 truncate", cls)}>{v}</span>;

const RANGES = { "7d": ["day", 7, "Last 7 days"], "1m": ["week", 4, "Last 4 weeks"], "6m": ["month", 6, "Last 6 months"] } as const satisfies Record<string, readonly [Unit, number, string]>;
type Range = keyof typeof RANGES;
const ACT_COLS = "0.9fr 1.8fr 0.9fr 1.3fr 1fr 0.8fr 1fr";
const PAINT = ["url(#odLime)", "var(--od-m3)", "url(#odPink)", "var(--od-m4)"];
const SWATCH = ["var(--od-m1)", "var(--od-m3)", "var(--od-m2)", "var(--od-m4)"];

export const Overview = ({ d, open }: { d: OrgData; open: (view: "donations" | "gateways") => void }) => {
    const { money, short } = useMoney();
    const [range, setRange] = useState<Range>("7d");
    const [hover, setHover] = useState(-1);
    const [q, setQ] = useState("");
    const [type, setType] = useState<"All" | "One-off" | "Monthly">("All");
    const [sort, setSort] = useState<"newest" | "largest">("newest");

    const stats = useMemo(() => {
        const now = Date.now(); const cur = paidBetween(d.rows, now - 30 * DAY, now + DAY); const prev = paidBetween(d.rows, now - 60 * DAY, now - 30 * DAY);
        const usd = (rs: Row[]) => sum(rs.map((r) => Number(r.usd_cents))) / 100;
        const back = (from: number, to: number) => usd(d.rows.filter((r) => (r.status === "refunded" || r.status === "disputed") && new Date(r.created_at).getTime() >= from && new Date(r.created_at).getTime() < to));
        const active = d.subs.filter((s) => s.status === "active"); const fresh = active.filter((s) => new Date(s.started_at).getTime() > now - 30 * DAY).length;
        return { raised: [usd(cur), usd(prev)], gifts: [cur.length, prev.length], refunded: [back(now - 30 * DAY, now + DAY), back(now - 60 * DAY, now - 30 * DAY)], active: active.length, fresh };
    }, [d]);
    const [unit, n, rangeName] = RANGES[range];
    const both = useMemo(() => buckets(d.rows, unit, n * 2), [d.rows, unit, n]);
    const bars = both.slice(n); const max = niceMax(Math.max(...bars.map((b) => b.usd)));
    const peak = bars.reduce((a, b, i) => (b.usd > bars[a].usd ? i : a), 0);
    const act = hover >= 0 && hover < bars.length ? hover : peak; const on = bars[act];
    const rangeDelta = change(sum(bars.map((b) => b.usd)), sum(both.slice(0, n).map((b) => b.usd)));

    const methods = useMemo(() => { let run = 0; const C = 2 * Math.PI * 64; return methodShare(d.rows, methodOf).map((m, i, all) => { const start = run; run += m.pct; const a = ((start + m.pct / 2) / 100) * 2 * Math.PI; return { ...m, text: `${Math.round(m.pct)}%`, dash: `${Math.max(0.5, (m.pct / 100) * C - (all.length > 1 ? 3 : 0))} ${C}`, off: -(start / 100) * C, x: 50 + 46 * Math.sin(a), y: 50 - 44 * Math.cos(a) }; }); }, [d.rows]);

    const latest = useMemo(() => {
        const list = d.rows.filter((r) => (type === "All" || typeOf(r) === type) && r.donor_name.toLowerCase().includes(q.trim().toLowerCase()));
        return (sort === "largest" ? [...list].sort((a, b) => Number(b.usd_cents) - Number(a.usd_cents)) : list).slice(0, 5);
    }, [d.rows, q, type, sort]);

    const since = "Compared with the 30 days before";
    const cards: [string, ReactNode, ReactNode][] = [
        ["Raised, last 30 days", <NumberTicker value={stats.raised[0]} format={money} />, <Delta v={change(stats.raised[0], stats.raised[1])} title={since} />],
        ["Donations, last 30 days", <NumberTicker value={stats.gifts[0]} />, <Delta v={change(stats.gifts[0], stats.gifts[1])} title={since} />],
        ["Active subscriptions", <NumberTicker value={stats.active} />, stats.fresh > 0 && <span className="od-tag ok" title="Started in the last 30 days">+{stats.fresh} new</span>],
        ["Refunded, last 30 days", <NumberTicker value={stats.refunded[0]} format={money} />, <Delta down v={change(stats.refunded[0], stats.refunded[1])} title={since} />],
    ];
    return (
        <div className="flex flex-col gap-[22px]">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-[18px]">
                {cards.map(([label, value, delta], i) => (
                    <div key={label} data-stat className="od-card flex flex-col gap-3 rounded-[30px] px-[26px] py-[22px]">
                        <span className={cx("text-[15px]", MUTED)}>{label}</span>
                        <div className="flex flex-wrap items-center gap-3"><strong className="text-[32px] leading-none font-normal tracking-[-0.8px]">{value}</strong>{delta}</div>
                        {i === 0 && <BorderBeam size={90} duration={9} borderWidth={1.5} colorFrom="var(--od-lime)" colorTo="var(--od-accent)" />}
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-stretch gap-[22px]">
                <Card className="flex-[2_1_520px] gap-[26px] px-5 pt-[30px] pb-[26px] sm:px-[34px]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3.5"><h2 className="od-h2">Donations raised</h2><Delta v={rangeDelta} title="Compared with the period before" /></div>
                        <Seg label="Time range" value={range} onChange={(r) => { setRange(r); setHover(-1); }} options={(Object.keys(RANGES) as Range[]).map((id) => [id, id, RANGES[id][2]] as const)} />
                    </div>
                    <div role="img" aria-label={`Bar chart of donations raised, ${rangeName.toLowerCase()}. Highest: ${bars[peak].when}, ${money(bars[peak].usd)}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4">
                        <Ticks max={max} short={short} height={270} />
                        <div data-chart="bars" onMouseLeave={() => setHover(-1)} className="od-dash relative flex h-[270px] items-end">
                            {bars.map((b, i) => (
                                <button key={b.from} type="button" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(-1)} aria-label={`${b.when}: ${money(b.usd)}`} className="od-col flex h-full min-w-0 flex-1 flex-col items-center justify-end border-0 bg-transparent p-0">
                                    <span className="od-bar rounded-full" style={{ width: act === i ? 38 : 20, maxWidth: "72%", height: `${(b.usd / max) * 100}%`, minHeight: 8, background: act === i ? "var(--od-bar-on)" : "var(--od-bar-dim)", boxShadow: act === i ? "var(--od-glow)" : "none" }} />
                                </button>
                            ))}
                            <span role="tooltip" className="od-tip pointer-events-none absolute z-10 flex flex-col gap-2 px-4 py-3 whitespace-nowrap" style={{ bottom: `${(on.usd / max) * 50}%`, transform: "translateY(50%)", ...tipSide(act, bars.length, 30) }}>
                                <span className="flex items-center gap-2 text-lg font-medium"><span className="size-[9px] rounded-full bg-(--od-accent)" />{money(on.usd)}</span>
                                <span className={cx("text-[15px]", MUTED)}>{on.when}</span>
                            </span>
                        </div>
                        <span />
                        <div aria-hidden="true" className="flex pt-3.5 text-[15px]">{bars.map((b, i) => <span key={b.from} className={cx("min-w-0 flex-1 truncate text-center", act === i ? "text-(--od-ink)" : MUTED)}>{b.label}</span>)}</div>
                    </div>
                </Card>

                <Card className="flex-[1_1_320px] gap-[18px] px-5 pt-[30px] pb-[26px] sm:px-[30px]">
                    <div className="flex items-center justify-between gap-3"><h2 className="od-h2">Gifts by method</h2><button type="button" onClick={() => open("gateways")} aria-label="Manage payment gateways" className="flex size-11 flex-none items-center justify-center rounded-full border-0 bg-transparent text-(--od-ink2) hover:bg-(--od-soft)"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button></div>
                    {methods.length === 0 ? <p className={cx("my-auto py-10 text-center text-[15px]", MUTED)}>How donors paid appears here after your first gift.</p> : <>
                        <div className="relative my-auto w-full max-w-[320px] self-center py-3.5">
                            <svg viewBox="0 0 240 240" role="img" aria-label={`Donut chart: ${methods.map((m) => `${m.text} of gifts by ${m.label}`).join(", ")}`} className="mx-auto block w-[84%] -rotate-90" style={{ filter: "var(--od-donut-glow)" }}>
                                <defs><linearGradient id="odLime" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: "var(--od-lime-a)" }} /><stop offset="1" style={{ stopColor: "var(--od-lime-b)" }} /></linearGradient><linearGradient id="odPink" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E7B4F8" /><stop offset="1" stopColor="#B45FD6" /></linearGradient></defs>
                                <circle cx="120" cy="120" r="115" fill="none" style={{ stroke: "var(--od-line)" }} strokeWidth="1.5" strokeDasharray="1 9" strokeLinecap="round" />
                                {methods.map((m, i) => <circle key={m.label} cx="120" cy="120" r="64" fill="none" style={{ stroke: PAINT[i] }} strokeWidth="76" strokeDasharray={m.dash} strokeDashoffset={m.off} />)}
                            </svg>
                            {methods.map((m) => <span key={m.label} aria-hidden="true" className="od-tip absolute flex -translate-x-1/2 -translate-y-1/2 flex-col gap-0.5 rounded-[14px] px-3.5 py-[9px] whitespace-nowrap shadow-[0_10px_24px_rgb(0_0_0/0.18)]" style={{ left: `clamp(56px, ${m.x}%, calc(100% - 56px))`, top: `${m.y}%` }}><strong className="text-[17px] font-medium">{m.text}</strong><span className={cx("max-w-28 truncate text-sm", MUTED)}>{m.label}</span></span>)}
                        </div>
                        <div className="flex flex-wrap justify-center gap-x-[18px] gap-y-2 text-sm text-(--od-ink2)">{methods.map((m, i) => <span key={m.label} className="inline-flex items-center gap-2"><span className="size-3 rounded" style={{ background: SWATCH[i] }} />{m.label}</span>)}</div>
                    </>}
                </Card>
            </div>

            <Card className="gap-5 px-5 pt-[30px] pb-[22px] sm:px-[34px]">
                <div className="flex flex-wrap items-center justify-between gap-3.5">
                    <h2 className="od-h2">Recent activity</h2>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <label className="relative flex min-w-0 flex-[1_1_200px] items-center sm:flex-none"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={cx("absolute left-4", MUTED)}><path d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg><input className="od-in h-[46px] rounded-full bg-transparent pl-11 text-[15px] sm:w-60" type="search" aria-label="Search donors" placeholder="Search donors" value={q} onChange={(e) => setQ(e.target.value)} /></label>
                        <button type="button" className="od-btn ghost" aria-label={`Filter by type: ${type}`} onClick={() => setType(type === "All" ? "One-off" : type === "One-off" ? "Monthly" : "All")}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>{type === "All" ? "Filter" : type}</button>
                        <button type="button" className="od-btn ghost" onClick={() => setSort(sort === "newest" ? "largest" : "newest")}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M7 19l-3-3M7 19l3-3M17 19V5M17 5l-3 3M17 5l3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>Sort by: {sort}</button>
                    </div>
                </div>
                <div data-activity>
                    <Table cols={ACT_COLS} min={760} head={["Date", "Donor", "Type", "Method", "Amount", "Gift Aid", "Status"]} empty={d.rows.length ? "No donations match. Clear the search or change the filter." : "No donations yet. They appear here as they arrive."}>
                        {/* One child while there are rows, so the table's empty line shows when there are none. */}
                        {[<AnimatePresence key="rows" initial={false}>{latest.map((r) => (
                            <AnimatedListItem key={r.id} role="row" data-row className="od-row" style={{ gridTemplateColumns: ACT_COLS, minHeight: 62 }}>
                                {cell(dayOf(r.created_at))}{cell(r.donor_name)}{cell(typeOf(r))}{cell(methodOf(r.pay_method || r.source))}{cell(fmt(r.amount_cents, r.currency), "tabular-nums")}{cell(aidOf(r))}<span role="cell"><Tag s={r.status} /></span>
                            </AnimatedListItem>
                        ))}</AnimatePresence>].slice(0, latest.length ? 1 : 0)}
                    </Table>
                </div>
                <button type="button" onClick={() => open("donations")} className="min-h-11 self-start border-0 bg-transparent px-1 text-[15px] font-medium text-(--od-link) hover:underline">See all donations</button>
            </Card>
        </div>
    );
};

const DON_COLS = "2fr 1fr 1fr 0.8fr 1.3fr 1fr 1fr";
const DON_FILTERS = ["All", "One-off", "Monthly", "Refunded"] as const;
export const Donations = ({ d, org }: { d: OrgData; org: Org }) => {
    const [f, setF] = useState<(typeof DON_FILTERS)[number]>("All");
    const [shown, setShown] = useState(100);
    const list = d.rows.filter((r) => f === "All" || (f === "Refunded" ? r.status === "refunded" : typeOf(r) === f));
    const exportCsv = () => download(`${org.slug}-donations.csv`, csv(list.map((r) => ({ date: r.created_at, donor: r.donor_name, email: r.donor_email ?? "", amount: r.amount_cents / 100, currency: r.currency, type: typeOf(r), gift_aid: Number(r.gift_aid_cents ?? 0) / 100, method: methodOf(r.pay_method || r.source), status: r.status, message: r.message, id: r.id }))));
    return (
        <Card className="gap-4 p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2.5"><Chips label="Show" options={DON_FILTERS} value={f} onChange={(v) => { setF(v); setShown(100); }} /><button type="button" className="od-btn ml-auto" disabled={!list.length} onClick={exportCsv}>Export CSV</button></div>
            <Table cols={DON_COLS} min={760} head={["Donor", "Amount", "Type", "Gift Aid", "Method", "Date", "Status"]} empty={d.rows.length ? "No donations match this filter." : "No donations yet. They appear here as they arrive."}>
                {list.slice(0, shown).map((r) => (
                    <div role="row" data-row key={r.id} className="od-row" style={{ gridTemplateColumns: DON_COLS }}>
                        {cell(r.donor_name, "font-medium")}{cell(fmt(r.amount_cents, r.currency), "font-semibold tabular-nums")}{cell(typeOf(r), MUTED)}{cell(aidOf(r), MUTED)}{cell(methodOf(r.pay_method || r.source), MUTED)}{cell(dayOf(r.created_at, true), MUTED)}<span role="cell" className="justify-self-end"><Tag s={r.status} /></span>
                    </div>
                ))}
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3"><span className={cx("text-[13px]", MUTED)}>Showing {Math.min(shown, list.length)} of {d.rows.length} donations{d.rows.length >= ROW_LIMIT && ` (the newest ${ROW_LIMIT})`}</span>{list.length > shown && <button type="button" className="od-btn" onClick={() => setShown(shown + 100)}>Show 100 more</button>}</div>
        </Card>
    );
};

const SUB_COLS = "2fr 1.2fr 1fr 1.3fr 1.2fr 1fr";
const SUB_FILTERS = ["Active", "Paused", "Failed", "Cancelled"] as const;
const subState = (s: OrgRegular) => (s.failed && s.status === "active" ? "failed" : s.status);
export const Subscriptions = ({ d }: { d: OrgData }) => {
    const { money } = useMoney();
    const [f, setF] = useState<(typeof SUB_FILTERS)[number]>("Active");
    const active = d.subs.filter((s) => subState(s) === "active"); const failed = d.subs.filter((s) => subState(s) === "failed").length;
    const fresh = active.filter((s) => new Date(s.started_at).getTime() > Date.now() - 30 * DAY).length;
    const monthly = sum(active.map((s) => s.amount_cents / 100 / (CURRENCIES[s.currency] ?? 1) / (s.every === "yearly" ? 12 : 1)));
    const list = d.subs.filter((s) => subState(s) === f.toLowerCase());
    const next = (s: OrgRegular) => (s.status === "paused" ? "Paused" : s.status === "cancelled" ? (s.cancelled_at ? `Ended ${dayOf(s.cancelled_at)}` : "Ended") : s.next_at ? dayOf(s.next_at, new Date(s.next_at).getFullYear() !== new Date().getFullYear()) : "–");
    const stats = [["Active subscriptions", String(active.length), fresh ? `${fresh} new in the last 30 days` : "None new in the last 30 days"], ["Expected each month", money(monthly), "Before Gift Aid; yearly gifts spread over 12 months"], ["Failed payments", String(failed), failed ? "The latest payment did not go through" : "None right now"]];
    return (
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-4">{stats.map(([label, value, note]) => <div key={label} data-stat className="od-card flex flex-col gap-2 px-[22px] py-5"><span className={cx("text-sm font-medium", MUTED)}>{label}</span><strong className="text-[32px] leading-none font-normal tracking-[-0.8px] tabular-nums">{value}</strong><span className={cx("text-sm", MUTED)}>{note}</span></div>)}</div>
            <Card className="gap-4 p-5 sm:p-7">
                <Chips label="Show" options={SUB_FILTERS} value={f} onChange={setF} />
                <Table cols={SUB_COLS} min={740} head={["Donor", "Gift", "Started", "Next payment", "Method", "Status"]} empty={`No ${f.toLowerCase()} subscriptions.`}>
                    {list.map((s) => (
                        <div role="row" data-row key={s.id} className="od-row" style={{ gridTemplateColumns: SUB_COLS }}>
                            {cell(s.donor_name, "font-medium")}{cell(`${fmt(s.amount_cents, s.currency)} a ${s.every === "yearly" ? "year" : "month"}`, "font-semibold tabular-nums")}{cell(new Date(s.started_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" }), MUTED)}{cell(next(s), MUTED)}{cell(methodOf(s.method), MUTED)}<span role="cell" className="justify-self-end"><Tag s={subState(s)} /></span>
                        </div>
                    ))}
                </Table>
                <span className={cx("text-[13px]", MUTED)}>Donors pause, change or cancel their own gift from their Outgive account. A failed payment stays under Failed until the next one clears.</span>
            </Card>
        </div>
    );
};

const PERIODS = { "4 weeks": ["week", 4], "12 weeks": ["week", 12], "12 months": ["month", 12] } as const satisfies Record<string, readonly [Unit, number]>;
type Period = keyof typeof PERIODS;
const spark = (arr: number[]) => { const lo = Math.min(...arr), hi = Math.max(...arr); return arr.map((v, i) => `${((i / (arr.length - 1 || 1)) * 100).toFixed(1)},${(36 - ((v - lo) / (hi - lo || 1)) * 32).toFixed(1)}`).join(" "); };
const DASH3 = "od-dash3";

export const Analytics = ({ d, org }: { d: OrgData; org: Org }) => {
    const { money, short } = useMoney();
    const [period, setPeriod] = useState<Period>("12 weeks");
    const [hover, setHover] = useState(-1);
    const [unit, n] = PERIODS[period];
    const both = useMemo(() => buckets(d.rows, unit, n * 2), [d.rows, unit, n]);
    const cur = both.slice(n); const prev = both.slice(0, n);
    const span = (bs: Bucket[]) => { const rs = paidBetween(d.rows, bs[0].from, bs[bs.length - 1].to); const usd = sum(bs.map((b) => b.usd)); return { usd, gifts: rs.length, donors: new Set(rs.map(donorKey)).size, avg: rs.length ? usd / rs.length : 0 }; };
    const a = span(cur), b = span(prev);
    const before = "Compared with the period before";
    const kpis: [string, string, number | null, number[]][] = [
        ["Raised", money(a.usd), change(a.usd, b.usd), cur.map((x) => x.usd)],
        ["Donations", a.gifts.toLocaleString("en-GB"), change(a.gifts, b.gifts), cur.map((x) => x.gifts)],
        ["Donors", a.donors.toLocaleString("en-GB"), change(a.donors, b.donors), cur.map((x) => x.donors)],
        ["Average gift", money(a.avg), change(a.avg, b.avg), cur.map((x) => (x.gifts ? x.usd / x.gifts : 0))],
    ];
    const max = niceMax(Math.max(...cur.map((x) => Math.max(x.one, x.rec))));
    const ax = (i: number) => (((i + 0.5) / n) * 600).toFixed(1); const ay = (v: number) => (240 - (v / max) * 240).toFixed(1);
    const line = (k: "one" | "rec") => "M" + cur.map((x, i) => `${ax(i)} ${ay(x[k])}`).join("L"); const area = (k: "one" | "rec") => `${line(k)}L${ax(n - 1)} 240L${ax(0)} 240Z`;
    const on = hover >= 0 && hover < n ? cur[hover] : null;
    const who = useMemo(() => loyalty(d.rows), [d.rows]); const h = useMemo(() => heat(d.rows), [d.rows]);
    const pages = useMemo(() => byPage(d.rows, (id) => d.titles.get(id)), [d]); const aid = Math.round(giftAidShare(d.rows));
    const ofDonors = (x: number) => (who.donors ? `(${((x / who.donors) * 100).toFixed(1)}% of donors)` : "");
    // Page visits are counted in visits, not people, so they sit in the note rather than as a bar beside donors.
    const journey: [string, number, string][] = [["Donated", who.donors, ""], ["Gave more than once", who.repeat, ofDonors(who.repeat)], ["Give every month or year", who.regular, ofDonors(who.regular)]];
    const top = Math.max(1, ...journey.map((j) => j[1]));
    const exportCsv = () => download(`${org.slug}-analytics-${period.replace(" ", "-")}.csv`, csv(cur.map((x) => ({ period: x.when, from: new Date(x.from).toISOString().slice(0, 10), raised_usd: x.usd, one_off_usd: x.one, recurring_usd: x.rec, donations: x.gifts, donors: x.donors }))));
    return (
        <div className="flex flex-col gap-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
                <Seg label="Period" value={period} onChange={(p) => { setPeriod(p); setHover(-1); }} options={(Object.keys(PERIODS) as Period[]).map((p) => [p, p] as const)} />
                <button type="button" className="od-btn ghost" onClick={exportCsv}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M12 15l-4-4M12 15l4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>Export report</button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(230px,100%),1fr))] gap-[18px]">
                {kpis.map(([label, value, delta, arr]) => (
                    <div key={label} data-stat className="od-card flex flex-col gap-3 rounded-[30px] px-[26px] py-[22px]">
                        <span className={cx("text-[15px]", MUTED)}>{label}</span>
                        <div className="flex items-end justify-between gap-3">
                            <div className="flex flex-col gap-2.5"><strong className="text-[32px] leading-none font-normal tracking-[-0.8px] tabular-nums">{value}</strong><span className="self-start"><Delta v={delta} title={before} /></span></div>
                            <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" className="h-11 min-w-[60px] flex-[0_1_110px] overflow-visible"><polyline points={spark(arr)} fill="none" style={{ stroke: delta !== null && delta < 0 ? "var(--od-bad-fg)" : "var(--od-c2)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-stretch gap-[22px]">
                <Card className="flex-[2_1_540px] gap-[22px] px-5 pt-7 pb-6 sm:px-8">
                    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="od-h2 sm">One-off and recurring</h2>
                        <div className="flex gap-[18px] text-sm text-(--od-ink2)"><span className="inline-flex items-center gap-2"><span className="size-3 rounded bg-(--od-c1)" />One-off</span><span className="inline-flex items-center gap-2"><span className="size-3 rounded bg-(--od-c2)" />Recurring</span></div></div>
                    <div role="img" aria-label={`Line chart of one-off and recurring donations over the last ${period}. One-off went from ${money(cur[0].one)} to ${money(cur[n - 1].one)}, recurring from ${money(cur[0].rec)} to ${money(cur[n - 1].rec)}.`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5">
                        <Ticks max={max} short={short} height={260} />
                        <div data-chart="trend" onMouseLeave={() => setHover(-1)} className={cx(DASH3, "relative h-[260px]")}>
                            <svg viewBox="0 0 600 240" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
                                <defs><linearGradient id="odA1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--od-c1)" }} stopOpacity="0.32" /><stop offset="1" style={{ stopColor: "var(--od-c1)" }} stopOpacity="0" /></linearGradient><linearGradient id="odA2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--od-c2)" }} stopOpacity="0.28" /><stop offset="1" style={{ stopColor: "var(--od-c2)" }} stopOpacity="0" /></linearGradient></defs>
                                <path d={area("one")} fill="url(#odA1)" /><path d={area("rec")} fill="url(#odA2)" />
                                <path d={line("one")} fill="none" style={{ stroke: "var(--od-c1)" }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                                <path d={line("rec")} fill="none" style={{ stroke: "var(--od-c2)" }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                            </svg>
                            <div className="absolute inset-0 flex">
                                {cur.map((x, i) => (
                                    <button key={x.from} type="button" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(-1)} aria-label={`${x.when}: one-off ${money(x.one)}, recurring ${money(x.rec)}`} className="od-col relative h-full min-w-0 flex-1 border-0 bg-transparent p-0">
                                        {hover === i && <><span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-(--od-muted) opacity-50" />{(["one", "rec"] as const).map((k) => <span key={k} aria-hidden="true" className="absolute left-1/2 -mb-[5px] -ml-[5px] size-2.5 rounded-full shadow-[0_0_0_2px_var(--od-cs)]" style={{ bottom: `${(x[k] / max) * 100}%`, background: `var(--od-c${k === "one" ? 1 : 2})` }} />)}</>}
                                    </button>
                                ))}
                            </div>
                            {on && <span role="tooltip" className="od-tip pointer-events-none absolute top-1.5 z-10 flex flex-col gap-1.5 px-4 py-3 text-[15px] whitespace-nowrap" style={tipSide(hover, n, 14)}>
                                <span className={cx("text-sm", MUTED)}>{on.when}</span>
                                <span className="flex items-center gap-2"><span className="size-2.5 rounded-[3px] bg-(--od-c1)" />One-off<strong className="ml-auto pl-[18px] font-medium tabular-nums">{money(on.one)}</strong></span>
                                <span className="flex items-center gap-2"><span className="size-2.5 rounded-[3px] bg-(--od-c2)" />Recurring<strong className="ml-auto pl-[18px] font-medium tabular-nums">{money(on.rec)}</strong></span>
                            </span>}
                        </div>
                        <span />
                        <div aria-hidden="true" className={cx("flex pt-3 text-sm", MUTED)}>{cur.map((x, i) => <span key={x.from} className="min-w-0 flex-1 overflow-hidden text-center whitespace-nowrap">{n > 6 && i % 2 ? "" : x.label}</span>)}</div>
                    </div>
                </Card>

                <Card className="flex-[1_1_340px] gap-5 px-5 pt-7 pb-6 sm:px-[30px]">
                    <h2 className="od-h2 sm">Donor journey</h2>
                    <div className="flex flex-col gap-[18px]">{journey.map(([label, count, pct], i) => (
                        <div key={label} className="flex flex-col gap-2"><div className="flex items-baseline justify-between gap-3"><span>{label}</span><span className={cx("text-[15px]", MUTED)}><strong className="font-medium text-(--od-ink) tabular-nums">{count.toLocaleString("en-GB")}</strong> {pct}</span></div>
                            <div className="h-3.5 overflow-hidden rounded-full bg-(--od-soft)"><div className="h-full rounded-full" style={{ width: `${Math.max((count / top) * 100, 2)}%`, background: i === journey.length - 1 ? "var(--od-c2)" : "var(--od-c1)" }} /></div></div>
                    ))}</div>
                    <span className="mt-auto rounded-[18px] bg-(--od-soft) px-4 py-3.5 text-[15px] leading-[1.45] text-(--od-ink2)">{who.donors ? `${Math.round((who.repeat / who.donors) * 100)}% of your donors have given more than once, and ${Math.round((who.regular / who.donors) * 100)}% give regularly.` : "Your donors appear here after the first gift."}{d.visits > 0 && ` Supporters' pages have had ${d.visits.toLocaleString("en-GB")} visits.`}</span>
                </Card>
            </div>

            <div className="flex flex-wrap items-stretch gap-[22px]">
                <Card className="flex-[1_1_460px] gap-5 px-5 pt-7 pb-6 sm:px-8">
                    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="od-h2 sm">When people give</h2><span className={cx("inline-flex items-center gap-2 text-sm", MUTED)}>Fewer<span className="inline-block h-2.5 w-[84px] rounded-full" style={{ background: "linear-gradient(90deg, rgb(var(--od-heat) / 0.1), var(--od-c1))" }} />More</span></div>
                    <div className="overflow-x-auto"><div role="img" aria-label={h.max ? `Heatmap of gifts by day and time of day. Busiest: ${h.busiest}.` : "Heatmap of gifts by day and time of day. No gifts yet."} className="grid min-w-[440px] grid-cols-[96px_repeat(7,minmax(0,1fr))] gap-1.5 text-sm">
                        <span />{DAYS.map((x) => <span key={x} className={cx("flex min-h-10 items-center justify-center", MUTED)}>{x}</span>)}
                        {PARTS.map(([part], p) => [<span key={part} className={cx("flex min-h-10 items-center", MUTED)}>{part}</span>, ...h.grid[p].map((v, i) => <span key={`${part}${i}`} title={`${DAYS[i]} ${part.toLowerCase()}: ${v} ${v === 1 ? "gift" : "gifts"}`} className="min-h-10 rounded-xl" style={{ background: `rgb(var(--od-heat) / ${(0.08 + (h.max ? v / h.max : 0) * 0.92).toFixed(2)})` }} />)])}
                    </div></div>
                    <span className="text-[15px] text-(--od-ink2)">{h.max ? `Busiest time: ${h.busiest}. Quietest: ${h.quietest}. Times are in your time zone.` : "The pattern appears after your first gifts."}</span>
                </Card>

                <Card className="flex-[1_1_380px] gap-5 px-5 pt-7 pb-6 sm:px-8">
                    <h2 className="od-h2 sm">Where gifts come from</h2>
                    <div className="flex flex-col">{pages.length === 0 ? <p className={cx("text-[15px]", MUTED)}>Your pages appear here once they raise money.</p> : pages.map((r) => (
                        <div key={r.label} className="grid min-h-[52px] grid-cols-[minmax(96px,1.3fr)_minmax(0,1.6fr)_auto] items-center gap-3.5 border-b border-(--od-line)"><span className="truncate" title={r.label}>{r.label}</span><span className="h-2.5 overflow-hidden rounded-full bg-(--od-soft)"><span className="block h-full rounded-full bg-(--od-c1)" style={{ width: `${(r.pct / pages[0].pct) * 100}%` }} /></span><span className="text-right whitespace-nowrap"><strong className="font-medium tabular-nums">{short(r.usd)}</strong> <span className={cx("text-sm", MUTED)}>{Math.round(r.pct)}%</span></span></div>
                    ))}</div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3"><div className="flex flex-col gap-0.5"><span className={cx("text-[15px]", MUTED)}>Gift Aid added</span><strong className="text-[26px] font-normal tracking-[-0.5px]">{aid}% of gifts</strong></div><div role="progressbar" aria-label="Share of gifts with Gift Aid" aria-valuemin={0} aria-valuemax={100} aria-valuenow={aid} className="h-3 flex-[1_1_160px] overflow-hidden rounded-full bg-(--od-soft)"><div className="h-full rounded-full bg-(--od-lime)" style={{ width: `${aid}%` }} /></div></div>
                </Card>
            </div>
        </div>
    );
};
