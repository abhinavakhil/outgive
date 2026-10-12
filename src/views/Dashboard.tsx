import { type FC, type ReactNode, createContext, useContext, useEffect, useState } from "react";
import { AlertCircle, Announcement01, ArrowRight, ArrowUp, Check, Copy01, Heart, HelpCircle, HomeLine, Link01, Lock01, Share07, TrendUp01, Trophy01, User01, Zap } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import { BrandLogo, ThemeToggle, ago, pct, typeOf, useApp } from "@/components/outgive/shared";
import { type PageData, initials, pageKey } from "@/data";
import { cx } from "@/utils/cx";

type Tab = "home" | "campaigns" | "giving" | "account";
const NAV: [Tab, string, FC<{ className?: string }>][] = [["home", "Home", HomeLine], ["campaigns", "Campaigns", Announcement01], ["giving", "Giving", Heart], ["account", "Account", User01]];
/** Badges earned by months given in a row. */
const BADGES: [string, number][] = [["Spark", 1], ["Giver", 3], ["Champion", 6], ["Hero", 9], ["Legend", 12], ["Evergreen", 24]];

/** Three takes on the same dashboard. bento = colour-forward tiles of mixed size, paper = quiet, ruled and dense, focus = one editorial column with big type and no card chrome. */
type Dir = "bento" | "paper" | "focus";
const DIRS: [Dir, string][] = [["bento", "Bento"], ["paper", "Paper"], ["focus", "Editorial"]];
const DirContext = createContext<Dir>("bento");
const CARD: Record<Dir, string> = { bento: "rounded-3xl bg-primary p-[18px] shadow-xs ring-1 ring-secondary ring-inset", paper: "rounded-xl bg-primary p-4 ring-1 ring-secondary ring-inset", focus: "border-t border-primary py-4" };
const Tile = ({ className, children }: { className?: string; children: ReactNode }) => { const dir = useContext(DirContext); return <div className={cx("flex min-w-0 flex-col gap-1.5", CARD[dir], className, dir === "focus" && "rounded-2xl")}>{children}</div>; };
const Eyebrow = ({ children }: { children: ReactNode }) => <span className="text-[11px] font-bold tracking-wider text-tertiary uppercase">{children}</span>;
const More = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => <button type="button" onClick={onClick} className="mt-auto flex w-fit cursor-pointer items-center gap-1 pt-2.5 text-sm font-bold text-brand-secondary underline underline-offset-4 outline-focus-ring focus-visible:outline-2">{children}<ArrowRight className="size-3.5" /></button>;

/** Cumulative giving as a filled line. Needs at least two points. */
const AreaChart = ({ values }: { values: number[] }) => {
    const w = 600; const h = 110; const max = Math.max(...values) * 1.1 || 1;
    const pts = values.map((v, i) => [Math.round(20 + (i * (w - 40)) / (values.length - 1)), Math.round(h - 8 - (v / max) * (h - 26))] as const);
    const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
    const [lx, ly] = pts[pts.length - 1];
    return (
        <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Giving over time" className="block h-auto w-full">
            <defs><linearGradient id="dash-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--color-brand-500)" stopOpacity="0.3" /><stop offset="1" stopColor="var(--color-brand-500)" stopOpacity="0" /></linearGradient></defs>
            <polygon points={`${line} ${lx},${h} ${pts[0][0]},${h}`} fill="url(#dash-area)" />
            <polyline points={line} fill="none" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={lx} cy={ly} r="5" fill="var(--color-bg-primary)" stroke="var(--color-brand-600)" strokeWidth="2.5" />
        </svg>
    );
};

/** The supporter's own space: what needs them, where they stand, their pages and their gifts. */
export const Dashboard = ({ pages }: { pages: Record<string, PageData> }) => {
    const { go, money, board, setBoard, activity, brand, me } = useApp();
    const [tab, setTab] = useState<Tab>("home");
    const [copied, setCopied] = useState(false);
    const [alerts, setAlerts] = useState(false);
    const [shown, setShown] = useState(true);
    const [dir, setDirState] = useState<Dir>(() => { try { const d = localStorage.getItem("outgive.dash"); return DIRS.some(([k]) => k === d) ? (d as Dir) : "bento"; } catch { return "bento"; } });
    const setDir = (d: Dir) => { setDirState(d); try { localStorage.setItem("outgive.dash", d); } catch { /* storage unavailable */ } };
    useEffect(() => { if (!copied) return; const id = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(id); }, [copied]);

    const byTotal = [...board].sort((a, b) => b.total - a.total);
    /** Until someone claims a rank in this browser, the dashboard shows a mid-table supporter as an example. */
    const real = byTotal.find((o) => o.id === me);
    const mine = real ?? byTotal[Math.min(6, byTotal.length - 1)];
    const [name, setName] = useState(mine?.name ?? "");
    const [tagline, setTagline] = useState(mine?.tagline ?? "");
    if (!mine) return <div className="flex min-h-dvh items-center justify-center bg-secondary p-6"><Button color="primary" onPress={() => go({ name: "home" })}>Go to the leaderboard</Button></div>;

    const rank = byTotal.findIndex((o) => o.id === mine.id) + 1;
    const above = byTotal[rank - 2];
    const gap = above ? above.total + 1 - mine.total : 0;
    const gifts = activity.filter((a) => a.who === mine.name);
    const myPages = Object.values(pages);
    const unit = brand.impact && brand.impact.usd > 0 ? Math.floor(mine.total / brand.impact.usd) : 0;
    const link = `${window.location.host}/${mine.page.replace(/^\//, "") || "f/" + mine.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); } };
    /** Real gifts in time order when there are enough of them; otherwise the shape of the all-time total, for the example profile. */
    const series = gifts.length >= 2 ? [...gifts].reverse().reduce<number[]>((acc, g) => [...acc, (acc[acc.length - 1] ?? 0) + g.usd], []) : real ? [] : [0.41, 0.57, 0.5, 0.76, 0.89, 1].map((f) => Math.round(mine.total * f));

    const needs: [string, FC<{ className?: string }>, string, string, string, () => void][] = [
        ...(above ? [["bg-error-primary text-error-primary", TrendUp01, `${above.name} is ${money(gap)} ahead of you`, `Give ${money(gap)} to take #${rank - 1}, or raise it from friends`, `Take #${rank - 1}`, () => go({ name: "home" })] as (typeof needs)[number]] : []),
        ["bg-warning-primary text-warning-primary", Zap, mine.streak > 0 ? `Keep your ${mine.streak}-month streak` : "Start a giving streak", "Give any amount before the month ends", "Give", () => go({ name: "home" })],
        myPages.length === 0 ? ["bg-tertiary text-primary", Announcement01, "Start a fundraising page", "Every gift to it counts toward your rank", "Start a page", () => go({ name: "create" })] : ["bg-success-primary text-success-primary", Check, `${myPages.length} ${myPages.length === 1 ? "page is" : "pages are"} live`, "Share them to climb without paying the gap yourself", "View", () => setTab("campaigns")],
        ...(!alerts ? [["bg-tertiary text-primary", AlertCircle, "Turn on overtake alerts", "At most one message a day, from the charity", "Settings", () => setTab("account")] as (typeof needs)[number]] : []),
    ];
    const kpis: [string, string, string, boolean][] = [
        ["Given all-time", money(mine.total), `#${rank} of ${byTotal.length} on the board`, false],
        ["This week", money(mine.week), mine.today > 0 ? `${money(mine.today)} today` : "Resets Monday", mine.today > 0],
        ["Donors recruited", String(mine.recruited), "through your pages", false],
        [brand.impact?.unit && unit > 0 ? "Impact" : "Streak", brand.impact?.unit && unit > 0 ? `${unit.toLocaleString("en")}` : `${mine.streak} mo`, brand.impact?.unit && unit > 0 ? `${brand.impact.unit} funded` : "months given in a row", false],
    ];

    const pageList = myPages.length === 0
        ? <ol className="flex flex-col">{([["Claim a rank on the board", !!real], ["Start your first page", false], ["Share it with five friends", false]] as [string, boolean][]).map(([t, done], i) => <li key={t} className="flex items-center gap-3 border-t border-secondary py-3 first:border-0"><span className={cx("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold", done ? "bg-brand-solid text-white" : "bg-tertiary text-secondary")}>{done ? <Check className="size-3.5" /> : i + 1}</span><span className="min-w-0 flex-1 text-sm font-semibold text-primary">{t}</span>{done ? <Badge type="pill-color" color="success" size="sm">Done</Badge> : <Button size="sm" color="secondary" className="rounded-full" onPress={() => go(i === 0 ? { name: "home" } : { name: "create" })}>Start</Button>}</li>)}</ol>
        : <div className="flex flex-col gap-4">{myPages.slice(0, 3).map((p) => <button key={pageKey(p)} type="button" onClick={() => go({ name: "page", key: pageKey(p) })} className="cursor-pointer rounded-lg text-left outline-focus-ring focus-visible:outline-2"><div className="mb-1.5 flex justify-between gap-3 text-sm"><b className="truncate text-primary">{p.title}</b><span className="shrink-0 text-tertiary tabular-nums">{pct(p)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-tertiary"><div className="h-full rounded-full bg-brand-solid" style={{ width: `${pct(p)}%` }} /></div><p className="mt-1.5 text-xs text-tertiary tabular-nums">{money(p.raised)} of {money(p.goal)} · {p.supporters} supporters</p></button>)}</div>;
    const giftList = (n: number) => gifts.length === 0
        ? <p className="rounded-2xl bg-secondary px-4 py-5 text-sm text-tertiary">No gifts recorded in this browser yet. Claim a rank and it shows here.</p>
        : <ul className="flex flex-col">{gifts.slice(0, n).map((g, i) => <li key={`${g.at}-${i}`} className="flex items-center gap-3 border-t border-secondary py-3 first:border-0"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tertiary text-secondary"><Heart className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-primary">Gift to {brand.name}</span><span className="block text-xs text-tertiary">{ago(g.at)}{ago(g.at) !== "just now" && " ago"}</span></span><span className="text-sm font-bold text-primary tabular-nums">{money(g.usd)}</span></li>)}</ul>;

    const promoInner = (
        <>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20"><Announcement01 className="size-5" /></span>
            <div className="min-w-44 flex-1"><h3 className="text-md font-bold">{myPages.length ? "Start another campaign" : "Raise for a cause you love"}</h3><p className="text-[13px] text-white/85">Set up a page in about three minutes. Every gift to it counts toward your rank.</p></div>
            <Button color="secondary" className="rounded-full" iconTrailing={ArrowRight} onPress={() => go({ name: "create" })}>{myPages.length ? "Create campaign" : "Start a page"}</Button>
        </>
    );
    const streakInner = (
        <>
            <div className="flex items-center justify-between gap-2"><Eyebrow>Giving streak</Eyebrow><Badge type="pill-color" color="brand" size="sm">{BADGES.filter(([, m]) => mine.streak >= m).length} of {BADGES.length} badges</Badge></div>
            <span className="text-[26px] leading-tight font-bold tracking-tight text-primary"><span className="tabular-nums">{mine.streak}</span> {mine.streak === 1 ? "month" : "months"}</span>
            <span className="text-xs font-semibold text-tertiary">Give before the month ends to keep it going</span>
            <ol aria-label="Last 7 months" className="mt-3 grid grid-cols-7 gap-1.5">{Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - 5 + i); const gave = i < 6 && 6 - i <= mine.streak; return <li key={i} className="flex flex-col items-center gap-1 text-[11px] font-bold text-tertiary"><span className={cx("flex h-10 w-full items-center justify-center rounded-xl", gave ? "bg-primary text-brand-secondary ring-1 ring-brand ring-inset" : i === 6 ? "border border-dashed border-primary" : "bg-primary/50")}>{gave && <Check className="size-4" />}</span>{d.toLocaleDateString("en", { month: "short" })}</li>; })}</ol>
            <ol aria-label="Badges" className="mt-3.5 grid grid-cols-6 gap-2">{BADGES.map(([n, m]) => { const on = mine.streak >= m; return <li key={n} title={`${n}: ${m} ${m === 1 ? "month" : "months"} in a row`} className="flex flex-col items-center gap-1 text-center"><span className={cx("relative flex size-11 items-center justify-center rounded-full", on ? "bg-primary text-brand-secondary ring-[1.5px] ring-brand ring-inset" : "border-[1.5px] border-dashed border-primary text-quaternary")}><Trophy01 className="size-5" />{!on && <Lock01 className="absolute -right-1 -bottom-1 size-4 rounded-full bg-tertiary p-0.5 text-tertiary" />}</span><span className="text-[10px] leading-tight font-semibold text-tertiary">{n}</span></li>; })}</ol>
        </>
    );
    const linkInner = (
        <>
            <Link01 className="size-4 shrink-0 text-quaternary" /><span className="min-w-36 flex-1 truncate text-sm font-bold text-primary">{link}</span>
            <Button size="sm" color="secondary" className="rounded-full" iconLeading={copied ? Check : Copy01} onPress={copy}>{copied ? "Copied" : "Copy"}</Button>
            <Button size="sm" color="primary" className="rounded-full" iconLeading={Share07} onPress={() => navigator.share?.({ title: mine.name, url: `https://${link}` }).catch(() => {}) ?? copy()}>Share</Button>
        </>
    );
    const homeBento = (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile className="col-span-full gap-0 p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-3.5"><span className="flex items-center gap-2 text-sm font-extrabold text-primary"><AlertCircle className="size-4" />Needs you · {needs.length}</span><span className="text-xs font-semibold text-tertiary">Clear these to keep climbing</span></div>
                {needs.map(([tone, Icon, t, d, cta, run], i) => <div key={t} className="flex items-center gap-3.5 border-t border-secondary px-[18px] py-3.5"><span className={cx("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}><Icon className="size-[18px]" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-primary">{t}</span><span className="block text-[13px] text-tertiary">{d}</span></span><Button size="sm" color={i === 0 ? "primary" : "secondary"} className="shrink-0 rounded-full" onPress={run}>{cta}</Button></div>)}
            </Tile>
            {kpis.map(([k, v, ctx, up], i) => <Tile key={k} className={cx(i === 0 && "bg-brand-secondary ring-transparent")}><span className="text-xs font-bold text-tertiary">{k}</span><span className="text-[26px] leading-tight font-bold tracking-tight text-primary tabular-nums">{v}</span><span className={cx("flex items-start gap-1 text-xs font-semibold", up ? "text-success-primary" : "text-tertiary")}>{up && <ArrowUp className="mt-0.5 size-3" />}{ctx}</span></Tile>)}
            <Tile className="col-span-2">
                <div className="flex items-center justify-between gap-2"><Eyebrow>Given over time</Eyebrow>{!real && <Badge type="pill-color" color="gray" size="sm">Example</Badge>}</div>
                <span className="text-[30px] leading-tight font-bold tracking-tight text-primary tabular-nums">{money(mine.total)}</span>
                {series.length >= 2 ? <div className="mt-2 rounded-xl bg-secondary py-1"><AreaChart values={series} /></div> : <p className="mt-2 rounded-xl bg-secondary px-4 py-6 text-sm text-tertiary">Your chart appears after your second gift.</p>}
                <More onClick={() => setTab("giving")}>See all giving</More>
            </Tile>
            <Tile className="col-span-2"><div className="flex items-center justify-between gap-2"><Eyebrow>{myPages.length ? "Your pages" : "Set up your fundraising"}</Eyebrow>{myPages.length > 0 && <Badge type="pill-color" color="brand" size="sm">{myPages.length} live</Badge>}</div>{pageList}<More onClick={() => (myPages.length ? setTab("campaigns") : go({ name: "create" }))}>{myPages.length ? "All campaigns" : "Start a page"}</More></Tile>
            <Tile className="col-span-full flex-row flex-wrap items-center gap-2.5 rounded-full py-2 pr-2 pl-5">
                {linkInner}
            </Tile>
            <Tile className="col-span-2 bg-brand-secondary ring-transparent">
                {streakInner}
            </Tile>
            <Tile className="col-span-2"><div className="flex items-center justify-between gap-2"><Eyebrow>Recent gifts</Eyebrow><span className="text-xs font-bold text-tertiary">{gifts.length} recorded</span></div>{giftList(3)}<More onClick={() => setTab("giving")}>All activity</More></Tile>
            <Tile className="col-span-full flex-row flex-wrap items-center gap-4 bg-brand-solid text-white ring-transparent">
                {promoInner}
            </Tile>
        </div>
    );

    /** Pieces shared by the Paper and Editorial directions. */
    const running = (
        <div><p className="mb-2.5 text-[11px] font-bold tracking-wider text-tertiary uppercase">Running · nothing for you to do</p>
            <div className="flex flex-wrap gap-2">{([[`On the board at #${rank}`, true], [myPages.length ? `${myPages.length} ${myPages.length === 1 ? "page" : "pages"} live` : "Profile live", true], [mine.match ? `Matching gifts up to ${money(mine.match)}` : `${money(mine.week)} given this week`, true], [`Streak: give before the month ends`, false]] as [string, boolean][]).map(([t, ok]) => <span key={t} className={cx("inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold", dir === "paper" ? "rounded-md" : "rounded-full", ok ? "bg-success-primary text-success-primary" : "bg-warning-primary text-warning-primary")}>{ok ? <Check className="size-3.5" /> : <Zap className="size-3.5" />}{t}</span>)}</div></div>
    );
    const chartBody = (h: string) => <><div className="flex flex-wrap items-baseline gap-2.5"><span className={cx("leading-none font-bold tracking-tight text-primary tabular-nums", h)}>{money(mine.total)}</span>{!real && <Badge type="pill-color" color="gray" size="sm">Example</Badge>}</div>{series.length >= 2 ? <div className="mt-3 rounded-xl bg-secondary py-1"><AreaChart values={series} /></div> : <p className="mt-3 rounded-xl bg-secondary px-4 py-6 text-sm text-tertiary">Your chart appears after your second gift.</p>}</>;
    const linkBar = <div className={cx("flex flex-wrap items-center gap-2.5 bg-primary py-2 pr-2 pl-4 ring-1 ring-secondary ring-inset", dir === "paper" ? "rounded-xl" : "rounded-full")}>{linkInner}</div>;
    const promo = <div className={cx("flex flex-wrap items-center gap-4 bg-brand-solid p-5 text-white", dir === "paper" ? "rounded-xl" : "rounded-2xl")}>{promoInner}</div>;

    /** B · Paper: dense and ruled, everything visible without scrolling far. */
    const head = (t: string, aside = "") => <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2.5 border-b border-secondary pb-1.5"><h2 className="text-sm font-bold text-primary">{t}</h2>{aside && <span className="text-xs font-semibold text-tertiary">{aside}</span>}</div>;
    const panel = (title: string, aside: ReactNode, body: ReactNode, foot?: ReactNode) => (
        <section className="flex min-w-0 flex-col rounded-xl bg-primary ring-1 ring-secondary ring-inset">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-secondary px-4 py-3"><Eyebrow>{title}</Eyebrow>{aside}</div>
            <div className="flex flex-1 flex-col p-4">{body}</div>
            {foot && <div className="rounded-b-xl border-t border-secondary bg-secondary px-4 pb-2.5">{foot}</div>}
        </section>
    );
    const homePaper = (
        <div className="flex flex-col gap-3.5">
            <section className="overflow-hidden rounded-xl bg-primary ring-1 ring-secondary ring-inset">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-secondary bg-secondary px-4 py-3"><span className="flex items-center gap-2 text-[13px] font-extrabold text-primary"><AlertCircle className="size-4" />Needs you · {needs.length}</span><span className="text-[12.5px] font-semibold text-tertiary">Clear these to keep climbing</span></div>
                {needs.map(([tone, Icon, t, d, cta, run], i) => <div key={t} className="flex items-center gap-3.5 border-t border-secondary px-4 py-3 first:border-0"><span className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}><Icon className="size-[18px]" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-primary">{t}</span><span className="block text-[13px] text-tertiary">{d}</span></span><Button size="sm" color={i === 0 ? "primary" : "secondary"} className="shrink-0" onPress={run}>{cta}</Button></div>)}
            </section>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-secondary ring-1 ring-secondary ring-inset md:grid-cols-4">{kpis.map(([k, v, ctx, up]) => <div key={k} className="flex min-w-0 flex-col gap-0.5 bg-primary px-4 py-3"><dt className="text-[11px] font-bold tracking-wide text-tertiary uppercase">{k}</dt><dd className="text-[21px] leading-tight font-bold tracking-tight text-primary tabular-nums">{v}</dd><dd className={cx("text-[11.5px] font-semibold", up ? "text-success-primary" : "text-tertiary")}>{ctx}</dd></div>)}</dl>
            {linkBar}
            {running}
            {head("Giving and pages")}
            <div className="grid items-stretch gap-3.5 md:grid-cols-2">
                {panel("Given over time", null, chartBody("text-[34px]"), <More onClick={() => setTab("giving")}>See all giving</More>)}
                {panel(myPages.length ? "Your pages" : "Set up your fundraising", myPages.length > 0 && <Badge type="pill-color" color="brand" size="sm">{myPages.length} live</Badge>, pageList, <More onClick={() => (myPages.length ? setTab("campaigns") : go({ name: "create" }))}>{myPages.length ? "All campaigns" : "Start a page"}</More>)}
            </div>
            {head("Recent gifts", `${gifts.length} recorded`)}
            <section className="rounded-xl bg-primary ring-1 ring-secondary ring-inset"><div className="px-4 py-1.5">{giftList(5)}</div><div className="rounded-b-xl border-t border-secondary bg-secondary px-4 pb-2.5"><More onClick={() => setTab("giving")}>All activity</More></div></section>
            {head("Streak and badges", `${BADGES.filter(([, m]) => mine.streak >= m).length} of ${BADGES.length} earned`)}
            <section className="flex flex-col gap-1.5 rounded-xl bg-brand-primary p-4">{streakInner}</section>
            {promo}
        </div>
    );

    /** C · Editorial: one column, big type, ruled sections. */
    const sect = (title: string, body: ReactNode, lead?: string) => <section className="flex flex-col gap-3.5"><div><h2 className="text-[22px] leading-tight font-bold tracking-tight text-primary">{title}</h2>{lead && <p className="mt-1 text-[15px] text-tertiary">{lead}</p>}</div>{body}</section>;
    const homeFocus = (
        <div className="flex flex-col gap-9">
            <div className="flex flex-col gap-3"><span className="text-[64px] leading-none font-bold tracking-[-0.04em] text-primary tabular-nums md:text-[84px]">{money(mine.total)}</span>
                <p className="max-w-[34ch] text-xl leading-snug text-secondary">given to {brand.name}, which puts you at <mark className="rounded bg-brand-secondary px-1.5 text-primary">#{rank} of {byTotal.length}</mark>.{mine.today > 0 && ` ${money(mine.today)} of it today.`}</p></div>
            {sect("Needs you", <div className="border-t border-primary">{needs.map(([, , t, d, cta, run], i) => <div key={t} className="flex items-center gap-4 border-b border-secondary py-4"><span className={cx("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold tabular-nums", i === 0 ? "bg-brand-solid text-white" : "bg-tertiary text-secondary")}>{i + 1}</span><span className="min-w-0 flex-1"><span className="block text-md font-bold text-primary">{t}</span><span className="block text-sm text-tertiary">{d}</span></span><Button size="sm" color={i === 0 ? "primary" : "secondary"} className="shrink-0 rounded-full" onPress={run}>{cta}</Button></div>)}</div>, `${needs.length} things are costing you rank or momentum.`)}
            {sect("Your link", <>{linkBar}{running}</>)}
            {sect("Given over time", <div className="border-t border-primary pt-4">{chartBody("text-[38px]")}<More onClick={() => setTab("giving")}>See all giving</More></div>)}
            {sect(myPages.length ? "Your pages" : "Set up your fundraising", <div className="border-t border-primary pt-3">{pageList}<More onClick={() => (myPages.length ? setTab("campaigns") : go({ name: "create" }))}>{myPages.length ? "All campaigns" : "Start a page"}</More></div>)}
            {sect("Recent gifts", <div className="border-t border-primary pt-1">{giftList(5)}<More onClick={() => setTab("giving")}>All activity</More></div>)}
            <section className="flex flex-col gap-1.5 rounded-2xl bg-brand-secondary p-5">{streakInner}</section>
            {promo}
        </div>
    );
    const home = dir === "paper" ? homePaper : dir === "focus" ? homeFocus : homeBento;

    const campaigns = (
        <div className="flex flex-col gap-3">
            {myPages.length === 0 && <div className="flex flex-col items-center gap-2.5 rounded-3xl border border-dashed border-primary bg-primary px-5 py-9 text-center"><b className="text-md text-primary">No pages yet</b><p className="max-w-sm text-sm text-tertiary">A fundraising page lets friends give in your name. Everything it raises counts toward your rank.</p><Button color="primary" className="rounded-full" onPress={() => go({ name: "create" })}>Start a page</Button></div>}
            {myPages.map((p) => <Tile key={pageKey(p)} className="gap-2.5 p-5"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-md font-bold text-primary">{p.title || "Untitled page"}</p><p className="text-xs text-tertiary">{typeOf(p).label} · {p.org || brand.name}</p></div><Badge type="pill-color" color="success" size="sm">Live</Badge></div><div className="flex items-center gap-2.5"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-tertiary"><div className="h-full rounded-full bg-brand-solid" style={{ width: `${pct(p)}%` }} /></div><span className="rounded-full bg-brand-solid px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">{pct(p)}%</span></div><div className="flex flex-wrap items-center justify-between gap-2 text-xs text-tertiary"><span>Raised <b className="text-primary tabular-nums">{money(p.raised)}</b> of {money(p.goal)} · {p.supporters} supporters</span><Button size="sm" color="secondary" className="rounded-full" onPress={() => go({ name: "page", key: pageKey(p) })}>Open page</Button></div></Tile>)}
            {myPages.length > 0 && <button type="button" onClick={() => go({ name: "create" })} className="flex min-h-15 cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-primary bg-primary p-3.5 text-sm font-bold text-secondary outline-focus-ring hover:border-brand hover:text-brand-secondary focus-visible:outline-2">Start another page</button>}
        </div>
    );

    const giving = (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">{([[money(mine.total), "all-time"], [money(mine.week), "this week"], [money(mine.today), "today"]] as [string, string][]).map(([v, l]) => <Tile key={l} className="p-4"><b className="text-lg text-primary tabular-nums">{v}</b><span className="text-xs font-semibold text-tertiary">{l}</span></Tile>)}</div>
            <Tile><Eyebrow>Every gift</Eyebrow>{giftList(50)}</Tile>
            {unit > 0 && brand.impact && <Tile className="bg-brand-secondary ring-transparent"><Eyebrow>What it did</Eyebrow><p className="text-md font-bold text-primary">Your giving has funded {unit.toLocaleString("en")} {unit === 1 ? brand.impact.unit.replace(/s$/, "") : brand.impact.unit}.</p></Tile>}
        </div>
    );

    const account = (
        <div className="flex flex-col gap-4">
            <Tile className="gap-4 p-5"><Eyebrow>On the board</Eyebrow>
                <div className="grid gap-3.5 sm:grid-cols-2"><Input label="Display name" value={name} onChange={setName} isDisabled={!real} /><Input label="One line under your name" value={tagline} onChange={setTagline} isDisabled={!real} /></div>
                {real ? <Button color="primary" className="w-fit rounded-full" isDisabled={!name.trim() || (name === mine.name && tagline === mine.tagline)} onPress={() => setBoard((all) => all.map((o) => (o.id === mine.id ? { ...o, name: name.trim(), tagline: tagline.trim() } : o)))}>Save</Button> : <p className="text-sm text-tertiary">This is an example profile. Claim a rank on the board and these become yours to edit.</p>}
            </Tile>
            <Tile className="gap-0 p-5"><Eyebrow>Preferences</Eyebrow>
                <div className="flex items-center justify-between gap-4 border-b border-secondary py-3.5"><span><span className="block text-sm font-bold text-primary">Show my name on the board</span><span className="block text-[13px] text-tertiary">Off shows you as Anonymous. Your gifts still count.</span></span><Toggle aria-label="Show my name on the board" isSelected={shown} onChange={setShown} /></div>
                <div className="flex items-center justify-between gap-4 py-3.5"><span><span className="block text-sm font-bold text-primary">Tell me if I'm overtaken</span><span className="block text-[13px] text-tertiary">At most one message a day. Stop any time.</span></span><Toggle aria-label="Tell me if I'm overtaken" isSelected={alerts} onChange={setAlerts} /></div>
                <p className="text-xs text-tertiary">Demo: preferences are not saved and no messages are sent.</p>
            </Tile>
        </div>
    );

    const titles: Record<Tab, [string, string]> = { home: [`Hello, ${mine.name.split(" ")[0]}`, `You hold #${rank} on the ${brand.name} board.`], campaigns: ["Campaigns", "Pages you have set up in this browser."], giving: ["Giving", "What you have given, and what it did."], account: ["Account", "How you appear on the board."] };
    return (
        <div className={cx("flex min-h-dvh flex-col", dir === "bento" ? "bg-secondary" : "bg-primary")}>
            <header className={cx("sticky top-0 z-30 flex items-center gap-2.5 px-4 md:px-7", dir === "bento" && "h-16 bg-secondary md:h-[76px]", dir === "paper" && "h-[60px] border-b border-secondary bg-primary", dir === "focus" && "h-[72px] bg-neutral-950")}>
                <div className={cx("mr-auto min-w-0", dir === "focus" && "[&_.truncate]:text-white")}><BrandLogo onClick={() => go({ name: "home" })} /></div>
                <ThemeToggle />
                <Button size="sm" color="secondary" className="rounded-full max-sm:hidden" onPress={() => go({ name: "home" })}>Leaderboard</Button>
                <Button size="sm" color="primary" className="rounded-full" onPress={() => go({ name: "create" })}><span className="max-sm:hidden">Start fundraising</span><span className="sm:hidden">Fundraise</span></Button>
            </header>
            <div className={cx("mx-auto grid w-full max-w-[1100px] flex-1 items-start gap-6 px-4 pb-16 md:px-6 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-7", dir === "bento" ? "pt-2" : dir === "paper" ? "pt-5" : "pt-9")}>
                <aside className="flex flex-col gap-3.5 lg:sticky lg:top-[92px]">
                    <div className={cx("flex flex-col gap-0.5", dir === "bento" && "items-center rounded-[20px] bg-brand-secondary px-4 pt-5 pb-4 text-center", dir === "paper" && "items-center rounded-xl px-3.5 pt-4 pb-3.5 text-center ring-1 ring-secondary ring-inset", dir === "focus" && "items-start border-b border-secondary pb-5 text-left")}>
                        <span className="mb-3 rounded-full ring-8 ring-white/50"><Avatar size="2xl" initials={initials(mine.name)} /></span>
                        <span className="text-[17px] font-bold text-primary">{mine.name}</span>
                        <span className="text-[12.5px] font-semibold text-tertiary">{real ? `${mine.kind.replace(/s$/, "").replace(/ie$/, "y")} · ${mine.country}` : "Example profile"}</span>
                        <dl className={cx("my-3.5 grid w-full grid-cols-3 px-1.5 py-3", dir === "bento" && "rounded-xl bg-primary", dir === "paper" && "rounded-lg bg-secondary", dir === "focus" && "border-y border-secondary px-0")}>{([[`#${rank}`, "Rank"], [money(mine.total), "Given"], [String(mine.streak), "Streak"]] as [string, string][]).map(([v, l], i) => <div key={l} className={cx("flex min-w-0 flex-col items-center", i > 0 && "border-l border-secondary")}><dd className="max-w-full truncate text-md font-bold text-primary tabular-nums">{v}</dd><dt className="text-[10.5px] font-semibold text-tertiary">{l}</dt></div>)}</dl>
                        <button type="button" onClick={() => go({ name: "home" })} className={cx("flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 bg-primary-solid text-[13.5px] font-bold text-white outline-focus-ring transition hover:opacity-90 focus-visible:outline-2", dir === "bento" ? "rounded-full" : "rounded-xl")}>{real ? "See my place on the board" : "Claim a rank to make this yours"}</button>
                    </div>
                    <nav aria-label="Dashboard" className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">
                        {NAV.map(([id, label, Icon]) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)} className={cx("flex shrink-0 cursor-pointer items-center outline-focus-ring transition focus-visible:outline-2", tab === id ? "font-bold text-primary" : "font-semibold text-secondary", dir === "bento" && cx("min-h-12 gap-3 rounded-full py-1 pr-4 pl-1 text-[15px]", tab !== id && "hover:bg-primary/60"), dir === "paper" && cx("min-h-10 gap-2 rounded-lg pr-3.5 pl-1.5 text-sm", tab === id ? "bg-secondary shadow-[inset_3px_0_0_var(--color-fg-primary)]" : "hover:bg-secondary"), dir === "focus" && cx("min-h-11 gap-2 rounded-xl pr-4 pl-2 text-[15px]", tab === id ? "bg-brand-secondary" : "hover:bg-secondary"))}><span className={cx("flex shrink-0 items-center justify-center", dir === "bento" ? cx("size-10 rounded-full shadow-xs", tab === id ? "bg-brand-solid text-white ring-4 ring-brand-200" : "bg-primary text-primary") : "size-7")}><Icon className="size-[18px]" /></span>{label}</button>)}
                    </nav>
                    <button type="button" onClick={() => go({ name: "faq" })} className="flex min-h-15 cursor-pointer items-center gap-3 rounded-2xl bg-primary/60 py-2.5 pr-4 pl-2.5 text-left text-sm font-bold text-primary outline-focus-ring transition hover:bg-primary focus-visible:outline-2 max-lg:hidden"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary"><HelpCircle className="size-[18px]" /></span><span>Need a hand?<span className="block text-[11.5px] font-semibold text-tertiary">Rules and common questions</span></span></button>
                </aside>
                <main className={cx("flex min-w-0 flex-col", dir === "focus" ? "max-w-[680px] gap-7" : "gap-4")}>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div><h1 className={cx("font-bold tracking-tight text-primary", dir === "focus" ? "text-display-sm md:text-display-md" : dir === "paper" ? "text-display-xs" : "text-display-xs md:text-display-sm")}>{titles[tab][0]}</h1><p className="mt-1 text-sm text-tertiary">{titles[tab][1]}</p></div>
                        <div role="group" aria-label="Dashboard style" className="flex gap-0.5 rounded-full bg-primary p-1 ring-1 ring-secondary ring-inset">{DIRS.map(([k, l]) => <button key={k} type="button" aria-pressed={dir === k} onClick={() => setDir(k)} className={cx("cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold outline-focus-ring transition focus-visible:outline-2", dir === k ? "bg-brand-solid text-white" : "text-tertiary hover:text-primary")}>{l}</button>)}</div>
                    </div>
                    <DirContext.Provider value={dir}>{{ home, campaigns, giving, account }[tab]}</DirContext.Provider>
                </main>
            </div>
        </div>
    );
};
