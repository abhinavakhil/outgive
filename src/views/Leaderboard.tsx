import { type FC, type ReactNode, createElement, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Award01, Brush03, Building07, Calendar, Diamond01, GraduationHat01, Grid01, Minus, Plus, Shield01, TrendUp01, Trophy01, User01, Users01, XClose, Zap } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
import { BrandPanel } from "@/components/outgive/BrandPanel";
import { BrandLogo, Container, FIELD, PillSelect, ThemeToggle, useApp } from "@/components/outgive/shared";
import { BOARDS, type BoardKey, CURRENCIES, HALL, KINDS, REGIONS, type Supporter, VARIANTS, type Variant, initials } from "@/data";
import { ALL_VARIANTS, type BoardCtx, MORE_BOARDS } from "@/views/boards";
import { cx } from "@/utils/cx";
import { track } from "@/analytics";

const ago = (m: number) => (m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`);
const opts = (xs: string[]) => xs.map((x) => ({ label: x, value: x }));
type Row = Supporter & { rank: number };
const YOU = "ring-2 ring-brand ring-offset-2 ring-offset-bg-primary";
const BOARD_ICON: Record<BoardKey, FC<{ className?: string }> | null> = { total: Trophy01, week: Calendar, today: null, recruited: Users01, streak: Zap };
const KIND_ICON: Record<string, FC<{ className?: string }>> = { All: Grid01, Individuals: User01, Teams: Users01, Companies: Building07, Schools: GraduationHat01 };
/** League tiers by rank. The top tier takes the brand colour; the rest are fixed metals. */
const TIERS = [{ name: "Diamond", upTo: 3, tone: "text-brand-secondary", icon: Diamond01 }, { name: "Gold", upTo: 10, tone: "text-[#c9960c]", icon: Trophy01 }, { name: "Silver", upTo: 20, tone: "text-[#8b95a1]", icon: Award01 }, { name: "Bronze", upTo: Infinity, tone: "text-[#b9703a]", icon: Shield01 }];
const tierOf = (rank: number) => TIERS.find((t) => rank <= t.upTo)!;
/** Level n starts at (n-1)² × $100 given, so each level takes a little more than the last. */
const levelOf = (usd: number) => { const n = Math.floor(Math.sqrt(usd / 100)) + 1; const lo = (n - 1) ** 2 * 100; const hi = n ** 2 * 100; return { n, next: hi, pct: Math.round(((usd - lo) / (hi - lo)) * 100), title: ["Spark", "Giver", "Champion", "Hero", "Legend"][Math.min(4, Math.floor((n - 1) / 3))] }; };
const ord = (n: number) => n + (n % 100 > 10 && n % 100 < 14 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th"));
const Crown = ({ className }: { className?: string }) => <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className={className}><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" /></svg>;
/** A banner ribbon: a band with a notched, darker tail tucked behind each end. */
const Ribbon = ({ band, tail, children }: { band: string; tail: string; children: ReactNode }) => (
    <span className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-start drop-shadow-md">
        <span aria-hidden="true" className={cx("-mr-2.5 w-6 translate-y-2 self-stretch", tail)} style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 38% 50%)" }} />
        <span className={cx("relative z-10 flex items-center gap-1.5 rounded-[5px] px-4 font-extrabold tracking-wide whitespace-nowrap uppercase", band)}>{children}</span>
        <span aria-hidden="true" className={cx("-ml-2.5 w-6 translate-y-2 self-stretch", tail)} style={{ clipPath: "polygon(0 0, 100% 0, 62% 50%, 100% 100%, 0 100%)" }} />
    </span>
);
/** The first three rows in stand order (2nd, 1st, 3rd), each with its place among the rows shown. */
const stand = (rows: Row[]) => { const t = rows.slice(0, 3).map((o, i) => ({ o, place: i + 1 })); return t.length === 3 ? [t[1], t[0], t[2]] : t; };
const CHIP = "inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary";
const NAME = "transition-colors group-hover:text-brand-secondary";
const one = (kind: string) => ({ Individuals: "Individual", Teams: "Team", Companies: "Company", Schools: "School" })[kind] ?? kind;

export const Leaderboard = () => {
    const { go, money, currency, setCurrency, board, setBoard, activity, setActivity, brand, setBrand, me: you, setMe: setYou } = useApp();
    const [period, setPeriod] = useState<BoardKey>("total");
    const [kind, setKind] = useState("All");
    const [region, setRegion] = useState("Worldwide");
    const [open, setOpen] = useState<number | null>(null);
    const [bump, setBump] = useState(1);
    const [heroName, setHeroName] = useState("");
    const [heroKind, setHeroKind] = useState("");
    const [claim, setClaim] = useState<{ usd: number; rank: number } | null>(null);
    const [form, setForm] = useState({ name: "", tagline: "", page: "", country: "", kind: KINDS[0], region: REGIONS[0], amount: "", show: true, alerts: false });
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");
    /** Set by a claim so the page scrolls to the new row once, not on every visit. */
    const justClaimed = useRef(false);
    const [branding, setBranding] = useState(false);
    const variant = brand.variant;

    useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 4000); return () => clearTimeout(id); }, [toast]);
    useEffect(() => { if (!justClaimed.current || you === null) return; justClaimed.current = false; document.getElementById(`row-${you}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [you, board]);

    const rate = CURRENCIES[currency];
    const byTotal = useMemo(() => [...board].sort((a, b) => b.total - a.total), [board]);
    const ranked: Row[] = useMemo(() => [...board].sort((a, b) => b[period] - a[period]).map((o, i) => ({ ...o, rank: i + 1 })), [board, period]);
    const shown = ranked.filter((o) => (kind === "All" || o.kind === kind) && (region === "Worldwide" || o.region === region));
    const todayTotal = money(board.reduce((n, o) => n + o.today, 0));
    const todayTop = useMemo(() => [...board].sort((a, b) => b.today - a.today).slice(0, 5), [board]);
    const heroUsd = (byTotal[0]?.total ?? 0) + bump;
    /** An anonymous gift never merges into a named row. */
    const existing = form.show ? board.find((o) => o.name.toLowerCase() === form.name.trim().toLowerCase()) : undefined;
    const boardDef = BOARDS.find((b) => b.key === period)!;
    const fmt = (n: number) => (boardDef.money ? money(n) : period === "recruited" ? `${n} recruited` : `${n} mo`);
    const val = (o: Supporter) => fmt(o[period]);
    /** "3 boreholes": what an amount pays for, in the charity's own unit. Empty when it buys less than one. */
    const impact = (usd: number) => { const u = brand.impact; const n = u && u.usd > 0 && u.unit ? Math.floor(usd / u.usd) : 0; return n >= 1 ? `${n.toLocaleString("en")} ${n === 1 ? u!.unit.replace(/s$/, "") : u!.unit}` : ""; };

    /** gift is what goes in the amount field: the full price for a newcomer, or only the difference for someone already ranked. */
    const openClaim = (usd: number, rank: number, name = "", kindName = "", gift = usd) => {
        setForm({ name, tagline: "", page: "", country: "", kind: kindName || KINDS[0], region: REGIONS[0], amount: String(Math.ceil(gift * rate)), show: true, alerts: false });
        setError(""); setClaim({ usd, rank }); track("claim-opened", { rank });
    };
    const submit = () => {
        if (!claim) return;
        const gift = Math.round(Number(form.amount) / rate); const name = form.show ? form.name.trim() : "Anonymous";
        if (!name) return setError("Enter your name, or your team's.");
        if (!(gift > 0)) return setError("Enter a gift amount.");
        const total = (existing?.total ?? 0) + gift;
        const id = existing?.id ?? Date.now();
        setBoard((prev) => existing
            ? prev.map((o) => (o.id === existing.id ? { ...o, total, today: o.today + gift, week: o.week + gift } : o))
            : [...prev, { id, name, tagline: form.show ? form.tagline.trim() || "Newly listed" : "Giving privately", kind: form.kind, region: form.region, country: form.country.trim() || form.region, page: form.show ? form.page.trim().replace(/^https?:\/\//, "") : "", total: gift, today: gift, week: gift, recruited: 0, streak: 0, visits: 0, days: 0 }]);
        setActivity((a) => [{ who: name, usd: gift, at: Date.now() }, ...a]);
        track("claim-completed", { rank: landing, usd: gift, anonymous: form.show ? 0 : 1 });
        setClaim(null); setBump(1); setPeriod("total"); setKind("All"); setRegion("Worldwide"); setHeroName(""); justClaimed.current = true; setYou(id);
        setToast(`${name} took #${landing} with ${money(total)}${form.alerts ? ". We'll tell you if you're overtaken." : ""}`);
    };

    /** Live figures for the claim dialog: what the typed amount comes to, the rank it lands on, and the price of the ranks just above. */
    const others = byTotal.filter((o) => o.id !== existing?.id);
    const giftUsd = Math.max(0, Math.round(Number(form.amount) / rate) || 0);
    const newTotal = (existing?.total ?? 0) + giftUsd;
    const landing = others.filter((o) => o.total >= newTotal).length + 1;
    const giftFor = (rank: number) => Math.max(1, (others[rank - 1]?.total ?? 0) + 1 - (existing?.total ?? 0));
    const quick = claim ? [...new Set([claim.rank, claim.rank - 1, claim.rank - 3, 1].map((r) => Math.min(Math.max(1, r), others.length + 1)))].sort((a, b) => b - a) : [];
    const setGift = (usd: number) => { setForm((f) => ({ ...f, amount: String(Math.ceil(usd * rate)) })); setError(""); };
    const symbol = new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((x) => x.type === "currency")?.value ?? currency;

    /** The ask for everyone who is not chasing #1: the price of one place up, or of a first place on the board. */
    const mine = you !== null ? byTotal.findIndex((o) => o.id === you) : -1;
    const lastRow = byTotal[byTotal.length - 1];
    const nextUp = mine > 0 ? { text: <>You're <b className="text-primary">#{mine + 1}</b>. <b className="text-primary">{money(byTotal[mine - 1].total + 1 - byTotal[mine].total)}</b> more passes {byTotal[mine - 1].name}.</>, cta: `Give ${money(byTotal[mine - 1].total + 1 - byTotal[mine].total)}`, run: () => openClaim(byTotal[mine - 1].total + 1, mine, byTotal[mine].name, byTotal[mine].kind, byTotal[mine - 1].total + 1 - byTotal[mine].total) }
        : mine === 0 ? { text: <>You hold <b className="text-primary">#1</b>.{byTotal[1] && <> {byTotal[1].name} is {money(byTotal[0].total - byTotal[1].total)} behind.</>}</>, cta: "", run: () => {} }
        : lastRow ? { text: <>Not chasing #1? <b className="text-primary">{money(lastRow.total + 1)}</b> puts your name on the board at #{byTotal.length}.</>, cta: `Join for ${money(lastRow.total + 1)}`, run: () => openClaim(lastRow.total + 1, byTotal.length, heroName, heroKind) } : null;
    /** The closest race between two of a kind: the pair of schools, teams or companies nearest to level. */
    const rival = useMemo(() => {
        let best: [Supporter, Supporter] | null = null;
        for (const k of ["Schools", "Teams", "Companies"]) { const xs = byTotal.filter((o) => o.kind === k); for (let i = 0; i + 1 < xs.length; i++) if (!best || xs[i + 1].total / xs[i].total > best[1].total / best[0].total) best = [xs[i], xs[i + 1]]; }
        return best;
    }, [byTotal]);

    const tab = (on: boolean) => cx("inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[0.8rem] font-semibold whitespace-nowrap outline-focus-ring transition focus-visible:outline-2", on ? "bg-brand-solid text-white" : "text-primary hover:bg-primary/60");
    const claimRow = (o: Row) => openClaim(o.total + 1, byTotal.findIndex((x) => x.id === o.id) + 1);
    const claimLink = (o: Row) => boardDef.money && <button type="button" onClick={() => claimRow(o)} className="cursor-pointer font-semibold text-brand-secondary underline-offset-2 hover:underline">claim for {money(o.total + 1)}</button>;
    /** Fades in over a hovered or focused row (put `group relative` on the row). Touch screens get the inline claim link instead. */
    const claimPill = (o: Row, className?: string) => boardDef.money && <button type="button" onClick={() => claimRow(o)} className={cx("pointer-events-none absolute -top-2 left-1/2 z-10 hidden -translate-x-1/2 cursor-pointer rounded-full bg-brand-solid px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-white opacity-0 shadow-sm outline-focus-ring transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:outline-2 md:block", className)}>claim this rank for {money(o.total + 1)}</button>;
    /** What this row needs to pass the one above it in the current period. */
    const gapUp = (o: Row) => (o.rank > 1 ? ranked[o.rank - 2][period] - o[period] + 1 : 0);
    const climb = (o: Row) => <span className="inline-flex items-center gap-0.5 text-xs text-tertiary">{o.rank > 1 ? <><ArrowUp className="size-3" />{fmt(gapUp(o))} to #{o.rank - 1}</> : "Leading"}</span>;
    const meta = (o: Row) => (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-tertiary"><span className="font-semibold text-secondary">{one(o.kind)}</span><span>·</span><span>{o.country}</span><span>·</span><span>{o.visits.toLocaleString("en")} visits</span>{o.match && <><span>·</span><span className="font-semibold text-brand-secondary">Matching gifts up to {money(o.match)}</span></>}{impact(o.total) && <><span className="max-sm:hidden">·</span><span className="max-sm:hidden">funded {impact(o.total)}</span></>}<span>·</span>
            <button type="button" aria-expanded={open === o.id} onClick={() => setOpen(open === o.id ? null : o.id)} className="cursor-pointer underline-offset-2 hover:text-primary hover:underline">{open === o.id ? "hide details" : "see details"}</button>{boardDef.money && <span className="md:hidden">·</span>}<span className="md:hidden">{claimLink(o)}</span></div>
    );
    const details = (o: Row) => open === o.id && <p className="mt-2 max-w-prose text-sm text-tertiary">{o.name} is giving from {o.country} ({o.region}). All-time {money(o.total)}, this week {money(o.week)}, today {money(o.today)}. {impact(o.total) && `That has funded ${impact(o.total)}. `}{o.recruited > 0 && `Brought in ${o.recruited} donors. `}{o.streak > 0 && `Has given ${o.streak} months in a row. `}{o.match && `Matching every gift up to ${money(o.match)}. `}{o.page ? `Fundraising page: ${o.page}. ` : ""}{o.days === 0 ? "Joined the board today." : `On the board for ${o.days} days.`}</p>;
    const youBadge = (o: Row) => you === o.id && <Badge type="pill-color" color="brand" size="sm">You</Badge>;

    const boardCtx: BoardCtx = { val, money, claim: claimRow, pill: claimPill, link: claimLink, badge: youBadge, gap: gapUp, fmt, you, metric: period, canClaim: boardDef.money, label: boardDef.label };

    const ListRow = ({ o }: { o: Row }) => (
        <li id={`row-${o.id}`} className={cx("group relative shrink-0 px-4 py-3", o.rank === 1 ? "rounded-2xl bg-brand-secondary" : o.rank === 2 ? "rounded-2xl bg-brand-primary" : o.rank === 3 ? "rounded-2xl bg-brand-primary/60" : "border-b border-secondary", you === o.id && cx(YOU, "rounded-2xl"))}>
            {claimPill(o)}
            <div className="flex items-center gap-3.5">
                <span className={cx("w-8 text-md font-semibold tabular-nums", o.rank <= 3 ? "text-brand-secondary" : "text-tertiary")}>#{o.rank}</span>
                <Avatar size="md" initials={initials(o.name)} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><span className={cx("truncate text-md font-semibold text-primary", NAME)}>{o.name}</span>{youBadge(o)}</span><span className="shrink-0 text-md font-semibold text-brand-secondary tabular-nums">{val(o)}</span></div>
                    <div className="truncate text-sm text-tertiary">{o.tagline}</div>
                    {meta(o)}
                </div>
            </div>
            <div className="ml-[3.25rem]">{details(o)}</div>
        </li>
    );

    /** Top three on a stand (2, 1, 3 on wide screens), the rest as rows. */
    const Podium = ({ rows }: { rows: Row[] }) => {
        const h: Record<number, string> = { 1: "md:pt-8 md:pb-10 bg-brand-secondary", 2: "md:mt-10 bg-brand-primary", 3: "md:mt-16 bg-brand-primary/60" };
        return (
            <>
                <ol className="grid gap-3 md:grid-cols-3 md:items-end">
                    {stand(rows).map(({ o, place }) => (
                        <li key={o.id} id={`row-${o.id}`} className={cx("group relative flex flex-col items-center gap-2 rounded-3xl px-4 py-6 text-center transition duration-200 hover:-translate-y-1 hover:shadow-lg", place === 1 ? "max-md:order-first" : place === 3 ? "max-md:order-last" : "max-md:order-2", h[place], you === o.id && YOU)}>
                            {claimPill(o)}
                            <span className={cx("flex items-center justify-center rounded-full font-bold", place === 1 ? "h-9 min-w-9 bg-brand-solid px-2 text-md text-white" : "h-7 min-w-7 bg-brand-secondary px-1.5 text-sm text-brand-secondary")}>{o.rank}</span>
                            <Avatar size={place === 1 ? "2xl" : "xl"} initials={initials(o.name)} className="mt-1" />
                            <span className="flex items-center gap-2"><span className={cx("text-lg font-semibold text-primary", NAME)}>{o.name}</span>{youBadge(o)}</span>
                            <span className={cx("font-semibold tracking-tight text-brand-secondary tabular-nums", place === 1 ? "text-display-sm" : "text-display-xs")}>{val(o)}</span>
                            <span className="line-clamp-2 text-sm text-tertiary">{o.tagline}</span>
                            <span className="text-xs text-tertiary">{one(o.kind)} · {o.country}</span>
                            <span className="text-xs md:hidden">{claimLink(o)}</span>
                        </li>
                    ))}
                </ol>
                {rows.length > 3 && <ol className="mt-3 flex flex-col gap-1.5">{rows.slice(3).map((o) => <ListRow key={o.id} o={o} />)}</ol>}
            </>
        );
    };

    /** Every row is a bar relative to #1, so the gap to the next rank is visible at a glance. */
    const Race = ({ rows }: { rows: Row[] }) => {
        const max = Math.max(1, ...rows.map((o) => o[period]));
        return (
            <ol className="flex flex-col gap-2">
                {rows.map((o) => (
                    <li key={o.id} id={`row-${o.id}`} className={cx("group relative rounded-2xl px-3 py-2 transition-colors hover:bg-secondary", you === o.id && YOU)}>
                        {claimPill(o)}
                        <div className="flex items-center gap-3">
                            <span className={cx("w-7 text-sm font-semibold tabular-nums", o.rank <= 3 ? "text-brand-secondary" : "text-tertiary")}>#{o.rank}</span>
                            <Avatar size="sm" initials={initials(o.name)} />
                            <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2"><span className={cx("truncate font-semibold text-primary", NAME)}>{o.name}</span>{youBadge(o)}<span className="hidden truncate text-xs text-tertiary sm:inline">{o.tagline}</span></span>
                                    <button type="button" aria-expanded={open === o.id} onClick={() => setOpen(open === o.id ? null : o.id)} className="shrink-0 cursor-pointer text-xs text-tertiary hover:text-primary">{one(o.kind)} · {o.country}</button></div>
                                <div className="flex items-center gap-2">
                                    <div className="h-7 flex-1 overflow-hidden rounded-full bg-secondary">
                                        <div className={cx("flex h-full min-w-[4.5rem] items-center justify-end rounded-full px-2.5 text-xs font-semibold tabular-nums transition-[width] duration-700", o.rank === 1 ? "bg-brand-solid text-white" : o.rank <= 3 ? "bg-brand-400 text-white" : "bg-brand-secondary text-brand-secondary")} style={{ width: `${Math.max(8, (o[period] / max) * 100)}%` }}>{val(o)}</div>
                                    </div>
                                    <span className="shrink-0 text-xs md:hidden">{claimLink(o)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="ml-[4.25rem]">{details(o)}</div>
                    </li>
                ))}
            </ol>
        );
    };

    /** Rows below the top three in the Spotlight (a), Spotlight podium (d) and Ribbons (f) layouts. */
    const flatRow = (o: Row, v: "a" | "d" | "f", max: number) => (
        <li key={o.id} id={`row-${o.id}`} className={cx("group relative flex items-center gap-2.5 border-b border-secondary py-4 last:border-0 md:gap-[18px]", you === o.id && cx(YOU, "rounded-2xl px-2"))}>
            {claimPill(o)}
            <span className={cx("shrink-0 text-center font-extrabold tabular-nums", v === "d" ? "flex size-9 items-center justify-center rounded-full bg-brand-solid text-sm text-white" : "w-7 text-md text-quaternary")}>{o.rank}</span>
            <span className={cx("shrink-0 rounded-full", v === "f" && "ring-[3px] ring-brand-300")}><Avatar size="lg" initials={initials(o.name)} /></span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className={cx("truncate text-md font-bold text-primary", NAME)}>{o.name}</span>{youBadge(o)}</div>
                <div className="truncate text-sm text-tertiary tabular-nums">{o.visits.toLocaleString("en")} visits{v === "f" && ` · ${o.country}`}</div>
                <span className="text-xs md:hidden">{claimLink(o)}</span>
            </div>
            {v === "a" && <div className="hidden w-[200px] shrink-0 items-center gap-2.5 md:flex"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-brand-solid transition-[width] duration-700" style={{ width: `${(o[period] / max) * 100}%` }} /></div><span className="w-10 text-[13px] font-bold text-secondary tabular-nums">{Math.round((o[period] / max) * 100)}%</span></div>}
            {v === "d" && <span className="hidden h-[30px] shrink-0 items-center rounded-full bg-secondary px-3 md:inline-flex">{climb(o)}</span>}
            <span className={cx("shrink-0 font-extrabold tabular-nums", v === "f" ? "text-xl tracking-tight text-primary" : "inline-flex h-10 items-center rounded-xl bg-brand-secondary px-3.5 text-md text-brand-secondary")}>{val(o)}</span>
        </li>
    );

    /** A: top three on a brand-tint hero, 1st raised and ringed, with the rest as a sheet sliding over it. */
    const Spotlight = ({ rows }: { rows: Row[] }) => {
        const max = Math.max(1, ...rows.map((o) => o[period]));
        return (
            <div>
                <section aria-label="Top three" className={cx("flex flex-col items-center gap-9 rounded-[32px] bg-brand-secondary px-4 pt-8 md:px-10 md:pt-11", rows.length > 3 ? "pb-24 md:pb-28" : "pb-8")}>
                    <span className="inline-flex h-9 items-center gap-2 rounded-full bg-brand-solid px-3.5 text-[13px] font-bold text-white"><Crown className="size-3.5" />Top 3 · {boardDef.label}</span>
                    <ol className="flex w-full items-end justify-center gap-2 md:gap-10">
                        {stand(rows).map(({ o, place }) => (
                            <li key={o.id} id={`row-${o.id}`} className={cx("group relative flex min-w-0 flex-1 flex-col items-center gap-1 text-center", place === 1 ? "max-w-[300px] pb-7" : "max-w-[260px]", you === o.id && cx(YOU, "rounded-2xl ring-offset-bg-brand-secondary"))}>
                                {claimPill(o, place === 1 ? "-top-12" : undefined)}
                                <div className="relative mb-3.5">
                                    {place === 1 && <Crown className="absolute -top-8 left-1/2 size-8 -translate-x-1/2 text-brand-secondary" />}
                                    <span aria-hidden="true" className={cx("flex items-center justify-center rounded-full border-white font-extrabold", place === 1 ? "size-[88px] border-[6px] bg-brand-200 text-2xl text-brand-800 ring-[3px] ring-brand md:size-32 md:text-[34px]" : "size-16 border-[5px] bg-brand-100 text-lg text-brand-700 md:size-24 md:text-[26px]")}>{initials(o.name)}</span>
                                    <span className={cx("absolute -bottom-3 left-1/2 flex h-7 min-w-10 -translate-x-1/2 items-center justify-center rounded-full px-2.5 text-[13px] font-extrabold", place === 1 ? "bg-brand-solid text-white" : "bg-primary text-primary shadow-sm")}>{ord(o.rank)}</span>
                                </div>
                                <h3 className="mt-2 flex max-w-full items-center justify-center gap-1.5"><span className={cx("truncate font-bold text-primary", NAME, place === 1 ? "text-md md:text-lg" : "text-[13px] md:text-md")}>{o.name}</span>{youBadge(o)}</h3>
                                <div className={cx("leading-tight font-extrabold tracking-tight text-primary tabular-nums", place === 1 ? "text-[26px] md:text-[40px]" : "text-xl md:text-[30px]")}>{val(o)}</div>
                                <div className="text-xs font-semibold text-tertiary tabular-nums md:text-sm">{o.visits.toLocaleString("en")} visits</div>
                                <span className="text-xs md:hidden">{claimLink(o)}</span>
                            </li>
                        ))}
                    </ol>
                </section>
                {rows.length > 3 && <ol className="relative mx-2 -mt-[72px] rounded-[28px] bg-primary px-4 pt-2 pb-3 shadow-xl ring-1 ring-secondary md:mx-6 md:px-7">{rows.slice(3).map((o) => flatRow(o, "a", max))}</ol>}
            </div>
        );
    };

    /** D: a stepped podium in a dark card with a brand glow behind the winner. The card stays dark in both themes. */
    const SpotPodium = ({ rows }: { rows: Row[] }) => (
        <div className="flex flex-col gap-2">
            <section aria-label="Top three" className="relative overflow-hidden rounded-[32px] bg-neutral-950 text-white ring-1 ring-secondary ring-inset">
                <div aria-hidden="true" className="absolute top-10 left-1/2 size-[560px] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--color-brand-500) 34%, transparent) 0%, transparent 62%)" }} />
                <div className="relative flex justify-center pt-7"><span className="inline-flex h-[34px] items-center gap-2 rounded-full bg-white/10 px-3.5 text-[13px] font-bold tracking-wide text-brand-300"><Crown className="size-3.5" />Top supporters</span></div>
                <ol className="relative flex items-end gap-1.5 px-3 pt-14 md:gap-4 md:px-14">
                    {stand(rows).map(({ o, place }) => (
                        <li key={o.id} id={`row-${o.id}`} className="group relative flex min-w-0 flex-1 flex-col items-center text-center">
                            {claimPill(o, place === 1 ? "-top-12" : undefined)}
                            <div className="relative mb-4">
                                {place === 1 && <Crown className="absolute -top-10 left-1/2 size-8 -translate-x-1/2 text-brand-400" />}
                                <span aria-hidden="true" className={cx("flex items-center justify-center rounded-full font-extrabold ring-offset-neutral-950", place === 1 ? "size-[84px] bg-brand-100 text-2xl text-brand-800 ring-4 ring-brand-500 ring-offset-[5px] md:size-[116px] md:text-[32px]" : "size-[60px] text-[17px] ring-[3px] ring-offset-4 md:size-[84px] md:text-2xl", place === 2 && "bg-brand-200 text-brand-800 ring-brand-300", place === 3 && "bg-white text-neutral-950 ring-brand-200", you === o.id && "ring-white")}>{initials(o.name)}</span>
                            </div>
                            <h3 className="flex max-w-full items-center justify-center gap-1.5"><span className={cx("truncate font-bold transition-colors group-hover:text-brand-300", place === 1 ? "text-sm md:text-lg" : "text-xs md:text-md")}>{o.name}</span>{youBadge(o)}</h3>
                            <div className={cx("leading-tight font-extrabold tracking-tight tabular-nums", place === 1 ? "text-2xl text-brand-400 md:text-[42px]" : "text-lg md:text-[30px]")}>{val(o)}</div>
                            <div className="text-[11px] text-neutral-400 tabular-nums md:text-sm">{o.visits.toLocaleString("en")} visits</div>
                            <span className="text-xs md:hidden [&_button]:text-brand-300">{claimLink(o)}</span>
                            <div aria-label={`${ord(o.rank)} place`} className={cx("mt-5 flex w-full items-start justify-center rounded-t-[22px] pt-1 font-extrabold md:pt-4", place === 1 ? "h-[92px] bg-brand-500 text-[32px] text-white md:h-40" : place === 2 ? "h-14 bg-brand-300 text-[26px] text-brand-950 md:h-[104px]" : "h-9 bg-brand-200 text-[26px] text-brand-900 md:h-[68px]")}>{o.rank}</div>
                        </li>
                    ))}
                </ol>
            </section>
            {rows.length > 3 && <ol className="px-2">{rows.slice(3).map((o) => flatRow(o, "d", 1))}</ol>}
        </div>
    );

    /** F: full brand-colour hero with a soft sunburst, white-bordered avatars with ribbon rank tags, and the list as a sheet at its foot. */
    const Ribbons = ({ rows }: { rows: Row[] }) => (
        <section aria-label="Top supporters" className="relative overflow-hidden rounded-[36px] bg-brand-solid px-3 pt-8 text-white md:px-8">
            <div aria-hidden="true" className="absolute top-[42%] left-1/2 size-[1600px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "repeating-conic-gradient(from 0deg, rgb(255 255 255 / 0.1) 0deg 9deg, transparent 9deg 18deg)" }} />
            <div className="relative flex flex-col items-center gap-1.5 pb-11 text-center">
                <span className="mb-2 flex size-16 items-center justify-center rounded-full bg-neutral-950 text-brand-300"><Crown className="size-[30px]" /></span>
                <h3 className="text-display-xs font-extrabold tracking-tight">Top supporters</h3>
                <p className="text-sm font-semibold text-white/90">{brand.name} · {brand.tagline}</p>
            </div>
            <ol className="relative flex items-start justify-center gap-2.5 px-2 pb-14 md:gap-9 md:px-6">
                {stand(rows).map(({ o, place }) => (
                    <li key={o.id} id={`row-${o.id}`} className={cx("group relative flex min-w-0 flex-1 flex-col items-center text-center", place === 1 ? "max-w-[280px]" : "max-w-[240px] pt-9")}>
                        {claimPill(o, cx("bg-neutral-950", place !== 1 && "top-5"))}
                        <div className="relative mb-9">
                            <span aria-hidden="true" className={cx("flex items-center justify-center rounded-full border-white font-extrabold shadow-lg", place === 1 ? "size-24 border-[7px] bg-brand-100 text-[26px] text-brand-800 md:size-36 md:text-[40px]" : "size-[72px] border-[6px] text-xl md:size-28 md:text-[30px]", place === 2 && "bg-brand-200 text-brand-800", place === 3 && "bg-neutral-800 text-white", you === o.id && "ring-4 ring-neutral-950")}>{initials(o.name)}</span>
                            <Ribbon band={place === 1 ? "h-9 bg-neutral-950 text-sm text-brand-300 md:h-10 md:text-[15px]" : place === 2 ? "h-7 bg-white text-xs text-brand-700 md:h-8 md:text-[13px]" : "h-7 bg-brand-100 text-xs text-brand-800 md:h-8 md:text-[13px]"} tail={place === 1 ? "bg-neutral-700" : place === 2 ? "bg-brand-200" : "bg-brand-300"}>{place === 1 && <Crown className="size-3.5" />}{ord(o.rank)}</Ribbon>
                        </div>
                        <h3 className="flex max-w-full items-center justify-center gap-1.5"><span className={cx("truncate font-extrabold tracking-tight underline-offset-4 group-hover:underline", place === 1 ? "text-sm md:text-[19px]" : "text-xs md:text-[17px]")}>{o.name}</span>{youBadge(o)}</h3>
                        <div className={cx("leading-tight font-extrabold tracking-tight tabular-nums", place === 1 ? "text-[22px] md:text-4xl" : "text-lg md:text-[28px]")}>{val(o)}</div>
                        <div className="text-[13px] font-semibold text-white/90 tabular-nums">{o.visits.toLocaleString("en")} visits</div>
                        <span className="text-xs md:hidden [&_button]:text-white [&_button]:underline">{claimLink(o)}</span>
                    </li>
                ))}
            </ol>
            {rows.length > 3 && <ol className="relative -mx-3 rounded-t-[28px] bg-primary px-4 pt-2 pb-3 text-primary md:mx-0 md:px-7">{rows.slice(3).map((o) => flatRow(o, "f", 1))}</ol>}
        </section>
    );

    /** Tiers by rank. Each tier shows what it takes to be promoted into it; each row shows its gap to the rank above. */
    const League = ({ rows }: { rows: Row[] }) => (
        <div className="flex flex-col gap-4">
            {TIERS.map((t, ti) => {
                const inTier = rows.filter((o) => tierOf(o.rank) === t);
                const cut = ti > 0 ? ranked[TIERS[ti - 1].upTo - 1] : undefined;
                return inTier.length > 0 && (
                    <section key={t.name} className="rounded-2xl ring-1 ring-secondary ring-inset">
                        <h3 className="flex items-center gap-2 rounded-t-2xl bg-secondary px-4 py-2.5 text-sm font-semibold text-primary"><t.icon className={cx("size-4", t.tone)} />{t.name} league<span className="font-normal text-tertiary">#{ti === 0 ? 1 : TIERS[ti - 1].upTo + 1}{t.upTo === Infinity ? "+" : `–${t.upTo}`}</span>{cut && <span className="ml-auto text-xs font-medium text-tertiary">promotion at {fmt(cut[period] + 1)}</span>}</h3>
                        <ol>
                            {inTier.map((o) => (
                                <li key={o.id} id={`row-${o.id}`} className={cx("group relative flex items-center gap-3 border-t border-secondary px-4 py-2.5 transition-colors last:rounded-b-2xl hover:bg-secondary", you === o.id && cx(YOU, "rounded-2xl"))}>
                                    {claimPill(o)}
                                    <span className={cx("w-8 text-sm font-semibold tabular-nums", t.tone)}>#{o.rank}</span>
                                    <Avatar size="sm" initials={initials(o.name)} />
                                    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={cx("truncate text-sm font-semibold text-primary", NAME)}>{o.name}</span>{youBadge(o)}</div><div className="truncate text-xs text-tertiary">{o.tagline}</div><span className="text-xs md:hidden">{claimLink(o)}</span></div>
                                    <div className="flex shrink-0 flex-col items-end"><span className="text-sm font-semibold text-brand-secondary tabular-nums">{val(o)}</span>{climb(o)}</div>
                                </li>
                            ))}
                        </ol>
                    </section>
                );
            })}
        </div>
    );

    /** One card per supporter: a level earned from all-time giving, progress to the next one, and badges. */
    const Levels = ({ rows }: { rows: Row[] }) => (
        <ol className="grid gap-3 sm:grid-cols-2">
            {rows.map((o) => {
                const lv = levelOf(o.total); const t = tierOf(o.rank);
                return (
                    <li key={o.id} id={`row-${o.id}`} className={cx("group relative flex min-w-0 flex-col gap-3 rounded-2xl p-4 ring-1 ring-secondary transition duration-200 ring-inset hover:-translate-y-0.5 hover:shadow-md hover:ring-brand", you === o.id && YOU)}>
                        {claimPill(o)}
                        <div className="flex items-center gap-3">
                            <span className="relative shrink-0"><Avatar size="lg" initials={initials(o.name)} /><span aria-hidden="true" className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-brand-solid text-[11px] font-bold text-white ring-2 ring-bg-primary">{lv.n}</span></span>
                            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={cx("truncate text-md font-semibold text-primary", NAME)}>{o.name}</span>{youBadge(o)}</div><div className="truncate text-xs text-tertiary">#{o.rank} · Level {lv.n} {lv.title}</div></div>
                            <span className="shrink-0 text-md font-semibold text-brand-secondary tabular-nums">{val(o)}</span>
                        </div>
                        <div>
                            <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={`Progress to level ${lv.n + 1}`} aria-valuenow={lv.pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-brand-solid transition-[width] duration-700" style={{ width: `${lv.pct}%` }} /></div>
                            <div className="mt-1 flex justify-between text-xs text-tertiary"><span>{lv.pct}% to level {lv.n + 1}</span><span>{money(lv.next - o.total)} to go</span></div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className={CHIP}><t.icon className={cx("size-3", t.tone)} />{t.name}</span>
                            {o.days === 0 ? <span className={CHIP}>New today</span> : o.days >= 7 && <span className={CHIP}><Zap className="size-3 text-brand-secondary" />{o.days}-day streak</span>}
                            {todayTop.some((x) => x.id === o.id) && <span className={CHIP}><TrendUp01 className="size-3 text-brand-secondary" />Hot today</span>}
                            <span className="ml-auto text-xs md:hidden">{claimLink(o)}</span>
                        </div>
                    </li>
                );
            })}
        </ol>
    );

    /** High-score table. The panel stays dark in both themes; selecting a row claims its rank. */
    const Arcade = ({ rows }: { rows: Row[] }) => (
        <div className="rounded-2xl bg-neutral-950 p-4 font-mono text-sm tracking-wider text-neutral-50 uppercase ring-1 ring-secondary ring-inset md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3"><span className="text-lg font-bold tracking-[0.2em] text-brand-400">High scores</span><button type="button" onClick={() => openClaim(heroUsd, 1)} className="animate-pulse cursor-pointer text-brand-300 uppercase outline-focus-ring hover:text-white focus-visible:outline-2 motion-reduce:animate-none">▶ Insert coin</button></div>
            <div className="grid grid-cols-[3.5rem_1fr_auto] gap-x-3 border-b border-white/15 px-2 pb-2 text-xs text-white/50"><span>Rank</span><span>Name</span><span>Score</span></div>
            <ol>
                {rows.map((o) => (
                    <li key={o.id} id={`row-${o.id}`} className={cx(you === o.id && "ring-2 ring-brand")}>
                        <button type="button" onClick={() => claimRow(o)} className={cx("group grid w-full cursor-pointer grid-cols-[3.5rem_1fr_auto] items-center gap-x-3 px-2 py-2 text-left uppercase outline-focus-ring hover:bg-brand-solid hover:text-white focus-visible:bg-brand-solid focus-visible:text-white focus-visible:outline-2", o.rank <= 3 ? "font-bold text-brand-300" : "text-white/85")}>
                            <span>{ord(o.rank)}</span>
                            <span className="truncate"><span aria-hidden="true" className="invisible group-hover:visible group-focus-visible:visible">▶ </span>{o.name}{you === o.id && " (you)"}</span>
                            <span className="tabular-nums">{boardDef.money ? <><span className="group-hover:hidden group-focus-visible:hidden">{val(o)}</span><span className="hidden group-hover:inline group-focus-visible:inline">Claim {money(o.total + 1)}</span></> : val(o)}</span>
                        </button>
                    </li>
                ))}
            </ol>
            <p className="mt-4 text-center text-xs text-white/40">Select a row to take its rank</p>
        </div>
    );

    return (
        <div className="flex min-h-dvh flex-col bg-primary">
            <Container className="flex flex-1 flex-col gap-4 pt-6 pb-5 md:px-4 lg:max-w-5xl">
                <header className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                            <BrandLogo />
                            <span className="hidden items-center gap-1.5 rounded-full border border-secondary px-2.5 py-1 text-xs whitespace-nowrap text-tertiary md:inline-flex">
                                <span className="relative inline-flex size-2 shrink-0"><span className="absolute inline-flex size-full animate-ping rounded-full bg-success-solid opacity-75 motion-reduce:animate-none" /><span className="relative inline-flex size-2 rounded-full bg-success-solid" /></span>
                                <span className="font-semibold text-success-primary">{board.length} on the board</span><span>· {todayTotal} given today</span>
                            </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                            <nav aria-label="Main" className="flex items-center gap-3 text-xs font-medium text-tertiary sm:gap-6 sm:text-sm">
                                {([["dashboard", "Dashboard"], ["page", "Layouts"], ["about", "About"], ["rules", "Rules"]] as const).map(([n, l]) => <button key={n} type="button" onClick={() => go({ name: n })} className="cursor-pointer rounded outline-focus-ring transition-colors hover:text-primary focus-visible:outline-2 max-md:last:hidden">{l}</button>)}
                            </nav>
                            <div className="flex items-center gap-1">
                                <button type="button" aria-label="Your branding" title="Your branding" onClick={() => setBranding(true)} className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-tertiary outline-focus-ring transition hover:bg-secondary hover:text-primary focus-visible:outline-2"><Brush03 className="size-4" /></button>
                                <ThemeToggle />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-[20px] bg-tertiary p-1.5">
                        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" role="group" aria-label="Who">
                            {["All", ...KINDS].map((c) => { const Icon = KIND_ICON[c]; return <button key={c} type="button" aria-pressed={kind === c} onClick={() => setKind(c)} className={tab(kind === c)}>{Icon && <Icon className={cx("size-3.5", kind === c ? "text-white/85" : "text-brand-secondary")} />}{c}</button>; })}
                        </div>
                        <button type="button" onClick={() => go({ name: "create" })} className={cx(tab(false), "pl-1.5 text-brand-secondary")}><Plus className="size-3.5" /><span className="max-sm:hidden">Start fundraising</span><span className="sm:hidden">Fundraise</span></button>
                    </div>
                </header>

                <section className="flex flex-col items-center gap-6 pt-5 pb-3">
                    <div role="group" aria-label="Board" className="no-scrollbar flex max-w-full gap-0.5 overflow-x-auto rounded-full p-1 ring-1 ring-secondary ring-inset">
                        {BOARDS.map((b) => { const Icon = BOARD_ICON[b.key]; return <button key={b.key} type="button" aria-pressed={period === b.key} onClick={() => setPeriod(b.key)} className={cx(tab(period === b.key), period !== b.key && "text-brand-secondary")}>{Icon ? <Icon className="size-3.5" /> : <span className={cx("size-1.5 rounded-full", period === b.key ? "bg-white" : "bg-brand-solid")} />}{b.label}</button>; })}
                    </div>
                    <h1 className="flex flex-wrap items-center justify-center gap-x-3 text-center text-display-sm font-semibold tracking-tight text-primary md:text-display-md">
                        <span>Take #1 for</span>
                        <span className="flex items-center gap-2.5">
                            <button type="button" aria-label="Lower amount" onClick={() => setBump((b) => Math.max(1, b - 100))} className="flex size-5 cursor-pointer items-center justify-center rounded-full bg-brand-secondary text-brand-secondary outline-focus-ring focus-visible:outline-2"><Minus className="size-3" /></button>
                            <span className="text-brand-secondary tabular-nums">{money(heroUsd)}</span>
                            <button type="button" aria-label="Raise amount" onClick={() => setBump((b) => (b === 1 ? 100 : b + 100))} className="flex size-5 cursor-pointer items-center justify-center rounded-full bg-brand-secondary text-brand-secondary outline-focus-ring focus-visible:outline-2"><Plus className="size-3" /></button>
                        </span>
                    </h1>
                    <form className="flex w-full max-w-[57rem] flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); openClaim(heroUsd, 1, heroName, heroKind); }}>
                        <label className="relative flex-1"><User01 aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-quaternary" /><input aria-label="Your name or team" className={cx(FIELD, "w-full pl-10")} placeholder="Your name, team or company" value={heroName} onChange={(e) => setHeroName(e.target.value)} /></label>
                        <PillSelect label="Giving as" className="sm:w-64" value={heroKind} onChange={setHeroKind} options={KINDS} placeholder="Giving as" />
                        <button type="submit" className="h-11 cursor-pointer rounded-full bg-brand-solid px-6 text-md font-semibold text-white shadow-xs outline-focus-ring transition hover:bg-brand-solid_hover focus-visible:outline-2 focus-visible:outline-offset-2">Claim rank</button>
                    </form>
                    <p className="-mt-3 text-center text-xs text-tertiary">{brand.tagline}. Every gift goes to {brand.name}; your name goes on the board.</p>
                </section>

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_230px]">
                    <main className="flex min-w-0 flex-col gap-2">
                        {nextUp && <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-brand-primary px-4 py-3 text-sm text-secondary"><span className="flex min-w-0 items-center gap-2"><ArrowUp aria-hidden="true" className="size-4 shrink-0 text-brand-secondary" /><span>{nextUp.text}</span></span>{nextUp.cta && <Button color="primary" size="sm" className="rounded-full" onPress={nextUp.run}>{nextUp.cta}</Button>}</div>}
                        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-tertiary">{boardDef.title} · {shown.length}</h2><div className="flex flex-wrap gap-2"><PillSelect label="Layout" size="sm" className="w-44" value={ALL_VARIANTS.find(([k]) => k === variant)?.[1] ?? ""} onChange={(l) => setBrand({ ...brand, variant: ALL_VARIANTS.find(([, x]) => x === l)?.[0] ?? "list" })} options={ALL_VARIANTS.map(([, l]) => l)} /><PillSelect label="Currency" size="sm" className="w-24" value={currency} onChange={setCurrency} options={Object.keys(CURRENCIES)} /><PillSelect label="Region" size="sm" className="w-44" value={region} onChange={setRegion} options={["Worldwide", ...REGIONS]} /></div></div>
                        {boardDef.note && <p className="-mt-1 text-xs text-tertiary">{boardDef.note}</p>}
                        {shown.length === 0 && <p className="rounded-2xl bg-secondary p-5 text-sm text-tertiary">Nobody here yet. Be the first to claim a rank for this group and region.</p>}
                        {shown.length > 0 && variant === "list" && <ol className="flex flex-col gap-1.5">{shown.map((o) => <ListRow key={o.id} o={o} />)}</ol>}
                        {shown.length > 0 && variant === "podium" && <Podium rows={shown} />}
                        {shown.length > 0 && variant === "race" && <Race rows={shown} />}
                        {shown.length > 0 && variant === "league" && <League rows={shown} />}
                        {shown.length > 0 && variant === "levels" && <Levels rows={shown} />}
                        {shown.length > 0 && variant === "arcade" && <Arcade rows={shown} />}
                        {shown.length > 0 && variant === "spotlight" && <Spotlight rows={shown} />}
                        {shown.length > 0 && variant === "spotpodium" && <SpotPodium rows={shown} />}
                        {shown.length > 0 && variant === "ribbons" && <Ribbons rows={shown} />}
                        {shown.length > 0 && MORE_BOARDS[variant] && createElement(MORE_BOARDS[variant].board, { rows: shown, c: boardCtx })}
                    </main>

                    <aside className="flex min-w-0 flex-col gap-5">
                        <section className="flex flex-col gap-2.5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary"><span className="size-1.5 rounded-full bg-brand-solid" />Today's ranking</h2><button type="button" onClick={() => setPeriod("today")} className="cursor-pointer text-xs font-medium text-brand-secondary hover:underline">See all ›</button></div>
                            <ol className="flex flex-col gap-2 text-sm">{todayTop.map((o, i) => (<li key={o.id} className="flex items-center gap-2"><span className="w-5 text-xs font-semibold text-tertiary">#{i + 1}</span><Avatar size="xs" initials={initials(o.name)} /><span className="min-w-0 flex-1 truncate text-secondary">{o.name}</span><span className="text-xs font-semibold text-brand-secondary tabular-nums">{money(o.today)}</span></li>))}</ol>
                        </section>
                        <section className="flex flex-col gap-2.5"><h2 className="text-sm font-semibold text-primary">Latest activity</h2>
                            <ul className="flex flex-col gap-2 text-xs text-tertiary">{activity.slice(0, 4).map((a, i) => (<li key={i}><span className="font-semibold text-primary">{a.who}</span> claimed a rank with {money(a.usd)} · {ago(Math.round((Date.now() - a.at) / 60000))}</li>))}</ul>
                        </section>
                        {rival && <section className="flex flex-col gap-2.5 rounded-2xl p-4 ring-1 ring-secondary ring-inset"><h2 className="text-sm font-semibold text-primary">Rivalry to watch</h2>
                            {rival.map((o, i) => (<div key={o.id} className="flex flex-col gap-1"><div className="flex items-baseline justify-between gap-2 text-xs"><span className="truncate font-medium text-secondary">{o.name}</span><span className="font-semibold text-brand-secondary tabular-nums">{money(o.total)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className={cx("h-full rounded-full", i === 0 ? "bg-brand-solid" : "bg-brand-300")} style={{ width: `${(o.total / rival[0].total) * 100}%` }} /></div></div>))}
                            <p className="text-xs text-tertiary">{rival[1].name} needs {money(rival[0].total + 1 - rival[1].total)} to pass {rival[0].name}.</p>
                            <Button color="secondary" size="sm" className="rounded-full" onPress={() => openClaim(rival[0].total + 1, byTotal.findIndex((x) => x.id === rival[0].id) + 1, rival[1].name, rival[1].kind, rival[0].total + 1 - rival[1].total)}>Back the challenger</Button>
                        </section>}
                        <section className="flex flex-col gap-2.5"><h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary"><Award01 aria-hidden="true" className="size-4 text-brand-secondary" />Hall of fame</h2>
                            <ol className="flex flex-col gap-2 text-xs text-tertiary">{HALL.map(([week, who, usd]) => (<li key={week} className="flex items-baseline justify-between gap-2"><span className="min-w-0 truncate"><span className="font-semibold text-primary">{who}</span> · week of {week}</span><span className="shrink-0 font-semibold text-brand-secondary tabular-nums">{money(usd)}</span></li>))}</ol>
                        </section>
                        <div className="flex flex-col items-start gap-2 rounded-2xl bg-brand-primary p-4">
                            <h2 className="text-sm font-semibold text-primary">Fundraising for {brand.name}?</h2>
                            <p className="text-xs text-tertiary">Set up a page in one of 12 layouts. Every gift to it counts toward your rank.</p>
                            <Button color="primary" size="sm" className="rounded-full" iconTrailing={ArrowRight} onPress={() => go({ name: "create" })}>Start fundraising</Button>
                        </div>
                        <div className="flex flex-col items-start gap-2 rounded-2xl p-4 ring-1 ring-secondary ring-inset">
                            <h2 className="text-sm font-semibold text-primary">Run this for your charity</h2>
                            <p className="text-xs text-tertiary">Your name, logo, colour and font. See it in ten seconds.</p>
                            <Button color="secondary" size="sm" className="rounded-full" iconLeading={Brush03} onPress={() => setBranding(true)}>Your branding</Button>
                        </div>
                    </aside>
                </div>
                <footer className="mt-6 flex flex-col items-center gap-3 border-t border-secondary pt-6 pb-4 text-center text-sm text-tertiary">
                    <p><span className="font-semibold text-primary">{board.length}</span> supporters have given <span className="font-semibold text-primary">{money(board.reduce((n, o) => n + o.total, 0))}</span> to {brand.name} through this board{impact(board.reduce((n, o) => n + o.total, 0)) && <>, enough for <span className="font-semibold text-primary">{impact(board.reduce((n, o) => n + o.total, 0))}</span></>}.</p>
                    <p className="text-xs">Demo with fictional supporters. No payments are taken. White-label leaderboard by <a href="/" data-umami-event="board-to-product" onClick={(e) => { e.preventDefault(); go({ name: "landing" }); }} className="font-semibold text-primary underline-offset-2 hover:underline">Outgive</a>.</p>
                    <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-1 text-xs font-medium">
                        {([["rules", "Rules"], ["faq", "FAQ"], ["about", "About"], ["create", "Start fundraising"]] as const).map(([n, l], i) => <span key={n} className="flex items-center gap-1">{i > 0 && <span>·</span>}<button type="button" onClick={() => go({ name: n })} className="cursor-pointer rounded px-1 hover:text-primary hover:underline">{l}</button></span>)}
                        <span className="flex items-center gap-1"><span>·</span><button type="button" onClick={() => setBranding(true)} className="cursor-pointer rounded px-1 hover:text-primary hover:underline">Run your own board</button></span>
                        {(["terms", "privacy"] as const).map((n) => <span key={n} className="flex items-center gap-1"><span>·</span><a href={`/${n}`} onClick={(e) => { e.preventDefault(); go({ name: n }); }} className="rounded px-1 capitalize hover:text-primary hover:underline">{n}</a></span>)}
                    </nav>
                </footer>
            </Container>

            <BrandPanel open={branding} onClose={() => setBranding(false)} />
            <ModalOverlay isOpen={!!claim} isDismissable onOpenChange={(o) => { if (!o) setClaim(null); }}>
                <Modal className="max-w-md"><Dialog aria-label="Claim a rank">
                    <form className="flex w-full flex-col gap-5 p-5 md:p-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                        <div className="flex items-start gap-3.5">
                            <span aria-hidden="true" className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-solid px-2 text-lg font-bold text-white tabular-nums">#{landing}</span>
                            <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-primary">Claim your rank</h2><p className="text-sm text-tertiary">Every gift goes to {brand.name}. {claim && money(claim.usd)} takes #{claim?.rank}.</p></div>
                            <button type="button" aria-label="Close" onClick={() => setClaim(null)} className="-mt-1 -mr-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-tertiary outline-focus-ring transition hover:bg-secondary hover:text-primary focus-visible:outline-2"><XClose className="size-5" /></button>
                        </div>

                        <div className="flex flex-col gap-2.5">
                            <label className={cx("flex h-16 items-center gap-2 rounded-2xl bg-primary px-4 ring-1 ring-inset transition focus-within:ring-2", error ? "ring-error" : "ring-primary focus-within:ring-brand")}>
                                <span className="text-xl font-semibold text-tertiary">{symbol}</span>
                                <input aria-label={`Gift amount in ${currency}`} aria-invalid={!!error} type="number" inputMode="numeric" min={1} value={form.amount} onChange={(e) => { setForm({ ...form, amount: e.target.value }); setError(""); }} className="w-full min-w-0 [appearance:textfield] bg-transparent text-display-xs font-semibold text-primary tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none" />
                                <span className="text-sm font-medium text-tertiary">{currency}</span>
                            </label>
                            <div role="group" aria-label="Pick a rank" className="flex flex-wrap gap-1.5">
                                {quick.map((r) => { const g = giftFor(r); const on = giftUsd === g; return <button key={r} type="button" aria-pressed={on} onClick={() => setGift(g)} className={cx("cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold outline-focus-ring transition focus-visible:outline-2", on ? "bg-brand-solid text-white" : "bg-secondary text-secondary hover:bg-tertiary")}>#{r} · {money(g)}</button>; })}
                            </div>
                            <p role="status" className={cx("text-sm", error ? "text-error-primary" : "text-tertiary")}>
                                {error || (giftUsd > 0
                                    ? <>{existing ? <>Added to your {money(existing.total)}, making {money(newTotal)}. </> : null}This puts {form.show ? "you" : "an anonymous gift"} at <b className="text-primary">#{landing}</b> of {others.length + 1}{impact(giftUsd) && <> and funds <b className="text-primary">{impact(giftUsd)}</b></>}.</>
                                    : "Enter an amount to see your rank.")}
                            </p>
                        </div>

                        {form.show && <Input label="Name on the board" autoFocus placeholder="You, your team or your company" value={form.name} onChange={(v) => { setForm({ ...form, name: v }); setError(""); }} />}
                        {existing ? <Badge type="pill-color" color="success" size="md">Already on the board. This gift is added to your total.</Badge> : <>
                            <div role="group" aria-label="Giving as" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                                {KINDS.map((k) => <button key={k} type="button" aria-pressed={form.kind === k} onClick={() => setForm({ ...form, kind: k })} className={cx("cursor-pointer rounded-xl px-2 py-2 text-sm font-semibold ring-1 outline-focus-ring transition ring-inset focus-visible:outline-2", form.kind === k ? "bg-brand-primary text-brand-secondary ring-brand" : "text-secondary ring-secondary hover:bg-secondary")}>{one(k)}</button>)}
                            </div>
                            <details className="group/more rounded-xl ring-1 ring-secondary ring-inset">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-medium text-secondary outline-focus-ring focus-visible:outline-2 [&::-webkit-details-marker]:hidden">Add a message, page or country<span className="text-xs text-tertiary">optional</span></summary>
                                <div className="flex flex-col gap-3 px-3.5 pb-3.5">
                                    {form.show && <Input label="Why you're giving" placeholder="One line shown under your name" value={form.tagline} onChange={(v) => setForm({ ...form, tagline: v })} />}
                                    {form.show && <Input label="Fundraising page" placeholder="Link to your page" value={form.page} onChange={(v) => setForm({ ...form, page: v })} />}
                                    <div className="grid gap-3 sm:grid-cols-2"><Input label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} /><NativeSelect label="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} options={opts(REGIONS)} /></div>
                                </div>
                            </details>
                        </>}

                        <div className="flex flex-col gap-3 rounded-xl bg-secondary p-3.5">
                            <Checkbox isSelected={form.show} onChange={(v) => setForm({ ...form, show: v })} label="Show my name on the board" hint="Untick to give as Anonymous. It still counts for your team, company or school." />
                            <Checkbox isSelected={form.alerts} onChange={(v) => setForm({ ...form, alerts: v })} label="Tell me if I'm overtaken" hint="At most one message a day. Stop any time." />
                        </div>

                        {/* On phones the form is taller than the screen, so the action stays pinned to the bottom of the dialog. */}
                        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col gap-2 bg-primary px-5 pt-3 pb-5 md:static md:m-0 md:p-0">
                            <Button size="lg" color="primary" type="submit" className="w-full rounded-full" isDisabled={!(giftUsd > 0)}>{giftUsd > 0 ? `Give ${money(giftUsd)} and take #${landing}` : "Enter an amount"}</Button>
                            <p className="text-center text-xs text-tertiary">Demo only. No payment is taken. On a live board your rank appears once the payment clears.</p>
                        </div>
                    </form>
                </Dialog></Modal>
            </ModalOverlay>
            {toast && <div role="status" className="fixed bottom-5 left-1/2 z-40 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-primary-solid px-4 py-2.5 text-sm font-medium text-white shadow-lg">{toast}</div>}
        </div>
    );
};
