import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import QRCode from "qrcode";
import { BrandMark, useApp } from "@/components/outgive/shared";
import { type Activity, CURRENCIES, initials } from "@/data";
import type { PageRef } from "@/lib/route";
import { fmt } from "@/lib/money";
import type { DonationRow, LiveItem, LiveLayout, LiveState, PageBundle } from "@/lib/types";
import { cx } from "@/utils/cx";

/**
 * The live screen: a wall display for a giving day, gala or stream, in five layouts the presenter switches between from the console.
 * Big total, thermometer, the board reordering as gifts land, a ticker of every gift, impact items with tonight's count, confetti and
 * milestone moments, and a QR code that opens the phone give screen. Scoped to the organisation (/live) or to one page (/c/slug/live).
 */
const MILESTONES = [25, 50, 75, 100];
const usdOf = (d: DonationRow) => d.usd_cents / 100;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

export const useLive = (pageRef?: PageRef) => {
    const { db, org, board } = useApp();
    const [bundle, setBundle] = useState<PageBundle | null>(null);
    const [gifts, setGifts] = useState<DonationRow[]>([]);
    const [last, setLast] = useState<DonationRow | null>(null);
    const [orgRecent, setOrgRecent] = useState<Activity[]>([]);
    const load = () => {
        if (!org) return;
        if (pageRef) db.rpc<PageBundle | null>("page_get", { org: org.id, t: pageRef.type, s: pageRef.slug }).then(setBundle);
        else db.rpc<{ who: string; usd: string; at: string; cause: string; message: string }[]>("activity", { org: org.id, n: 200 }).then((rows) => setOrgRecent(rows.map((x) => ({ who: x.who, usd: Number(x.usd), at: new Date(x.at).getTime(), cause: x.cause, message: x.message })))).catch(() => {});
    };
    useEffect(load, [db, org, pageRef?.type, pageRef?.slug]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!org) return;
        return db.onDonations(org.id, (d) => {
            if (d.status !== "succeeded" || d.source === "match") return;
            if (bundle && d.page_id !== bundle.page.id && !bundle.children.some((c) => c.id === d.page_id)) return;
            setGifts((g) => (g.some((x) => x.id === d.id) ? g : [d, ...g].slice(0, 30))); setLast(d); load();
        });
    }, [db, org, bundle?.page.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const state: LiveState = { ...(org?.live ?? {}), ...(bundle?.page.live ?? {}) };
    const recent: Activity[] = useMemo(() => (bundle ? bundle.donations.map((d) => ({ who: d.name, usd: d.usd_cents / 100, at: new Date(d.created_at).getTime(), cause: d.cause, message: d.message })) : orgRecent), [bundle, orgRecent]);
    const totalUsd = bundle ? bundle.page.raised_cents / 100 / (CURRENCIES[bundle.page.currency] ?? 1) : board.reduce((n, o) => n + o.total, 0);
    const goalUsd = bundle ? bundle.page.goal_cents / 100 / (CURRENCIES[bundle.page.currency] ?? 1) : state.goal_usd ?? 0;
    const items: LiveItem[] = state.items ?? [];
    const fundedToday = useMemo(() => { const since = startOfToday(); const m: Record<string, number> = {}; for (const g of recent) if (g.cause && g.at >= since) m[g.cause] = (m[g.cause] ?? 0) + 1; return m; }, [recent]);
    return { bundle, gifts, last, state, recent, totalUsd, goalUsd, items, fundedToday };
};

/** Counts up to the value over half a second, so a new gift is seen landing. */
export const useCountUp = (value: number) => {
    const [shown, setShown] = useState(value); const from = useRef(value);
    useEffect(() => { const start = performance.now(); const a = from.current; let raf = 0; const tick = (t: number) => { const k = Math.min(1, (t - start) / 600); setShown(a + (value - a) * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); else from.current = value; }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [value]);
    return shown;
};

const Confetti = ({ at }: { at: number }) => {
    const bits = useMemo(() => Array.from({ length: 80 }, (_, i) => ({ x: (i * 37) % 100, d: 0.6 + ((i * 13) % 10) / 10, r: (i * 53) % 360, c: ["bg-brand-400", "bg-brand-600", "bg-white", "bg-brand-200", "bg-yellow-300"][i % 5], w: 6 + (i % 3) * 3 })), [at]);
    return <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">{bits.map((b, i) => <motion.span key={`${at}-${i}`} initial={{ y: -40, x: `${b.x}vw`, rotate: 0, opacity: 1 }} animate={{ y: "110vh", rotate: b.r + 720, opacity: [1, 1, 0.8, 0] }} transition={{ duration: 2.4 + b.d, ease: "easeIn", delay: (i % 7) * 0.08 }} className={cx("absolute top-0 rounded-sm", b.c)} style={{ width: b.w, height: b.w * 1.6 }} />)}</div>;
};

/** Theme-aware surface classes. `t` is the theme; panels are translucent so the brand gradient shows through. */
const skin = (t: "dark" | "light") => ({
    page: t === "dark" ? "bg-neutral-950 text-white" : "bg-[#f7f5f2] text-neutral-950",
    panel: t === "dark" ? "bg-white/5 ring-1 ring-white/10" : "bg-white ring-1 ring-black/5 shadow-sm",
    muted: t === "dark" ? "text-white/60" : "text-neutral-500",
    soft: t === "dark" ? "text-white/80" : "text-neutral-700",
    row: t === "dark" ? "bg-white/5" : "bg-neutral-100",
    row3: t === "dark" ? "bg-white/15" : "bg-neutral-200",
    track: t === "dark" ? "bg-white/10" : "bg-neutral-200",
    glow: t === "dark"
        ? "radial-gradient(ellipse at 20% 0%, color-mix(in srgb, var(--color-brand-500) 28%, transparent), transparent 55%), radial-gradient(ellipse at 100% 100%, color-mix(in srgb, var(--color-brand-700) 30%, transparent), transparent 50%)"
        : "radial-gradient(ellipse at 20% 0%, color-mix(in srgb, var(--color-brand-300) 35%, transparent), transparent 55%), radial-gradient(ellipse at 100% 100%, color-mix(in srgb, var(--color-brand-200) 45%, transparent), transparent 50%)",
});
type Skin = ReturnType<typeof skin>;

const Qr = ({ src, url, s, size = "md" }: { src: string; url: string; s: Skin; size?: "md" | "lg" }) => src ? (
    <div className="flex items-center gap-5"><img src={src} alt="QR code to give from your phone" className={cx("rounded-xl bg-white p-1.5", size === "lg" ? "size-44 md:size-60" : "size-28 md:size-36")} /><div className={cx(size === "lg" ? "text-2xl" : "text-lg", s.soft)}><div className="font-semibold">Scan to give</div><div className={cx("text-base", s.muted)}>{url.replace(/^https?:\/\//, "")}</div></div></div>
) : null;

const Thermo = ({ pct, goal, total, money, s, size = "md" }: { pct: number; goal: number; total: number; money: (n: number) => string; s: Skin; size?: "md" | "lg" }) => goal > 0 ? (
    <div className="flex flex-col gap-3"><div className={cx("overflow-hidden rounded-full", s.track, size === "lg" ? "h-10" : "h-6")}><motion.div className="h-full rounded-full bg-brand-solid" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 60, damping: 18 }} /></div><div className={cx("flex justify-between", s.soft, size === "lg" ? "text-2xl" : "text-lg")}><span>{Math.round(pct)}% of {money(goal)}</span><span>{money(Math.max(0, goal - total))} to go</span></div></div>
) : null;

const LastGift = ({ last, money, big }: { last: DonationRow | null; money: (n: number) => string; big?: boolean }) => (
    <AnimatePresence mode="popLayout">{last && <motion.div key={last.id} initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0 }} className={cx("flex items-center gap-4 rounded-2xl bg-brand-solid/90 px-5 py-4 text-white", big ? "text-2xl" : "text-xl")}><span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold">{initials(last.donor_name) || "A"}</span><span className="min-w-0"><b>{last.donor_name}</b> just gave <b>{money(usdOf(last))}</b>{last.cause && <span className="text-white/85"> for {last.cause.toLowerCase()}</span>}{last.message && <span className="block truncate text-base text-white/85">“{last.message}”</span>}</span></motion.div>}</AnimatePresence>
);

const Rank = ({ o, s, size = "md" }: { o: { id: string; name: string; total: number; rank: number }; s: Skin; size?: "md" | "sm" }) => (
    <motion.li key={o.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className={cx("flex items-center gap-4 rounded-2xl", size === "sm" ? "px-3 py-2" : "px-4 py-3", o.rank === 1 ? "bg-brand-solid text-white" : o.rank <= 3 ? s.row3 : s.row)}>
        <span className={cx("font-bold tabular-nums", size === "sm" ? "w-6 text-base" : "w-9 text-[clamp(1rem,1.6vw,1.6rem)]")}>{o.rank}</span>
        <span className={cx("flex shrink-0 items-center justify-center rounded-full bg-black/10 text-sm font-bold", size === "sm" ? "size-8" : "size-10", o.rank === 1 && "bg-white/20")}>{initials(o.name)}</span>
        <span className={cx("min-w-0 flex-1 truncate font-semibold", size === "sm" ? "text-base" : "text-[clamp(1rem,1.5vw,1.5rem)]")}>{o.name}</span>
        <span className={cx("font-bold tabular-nums", size === "sm" ? "text-base" : "text-[clamp(1rem,1.5vw,1.5rem)]")}>{o.total.toLocaleString("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
    </motion.li>
);

export const Live = ({ pageRef }: { pageRef?: PageRef }) => {
    const { org, brand, board, money, currency, href } = useApp();
    const { bundle, gifts, last, state, recent, totalUsd, goalUsd, items, fundedToday } = useLive(pageRef);
    const [qr, setQr] = useState("");
    const [confetti, setConfetti] = useState(0);
    const [milestone, setMilestone] = useState<number | null>(null);
    const seenPct = useRef(-1);
    // ?layout= and ?theme= preview a composition without changing what the console pushed; the console's own previews use them.
    const q = new URLSearchParams(window.location.search);
    const theme = (q.get("theme") as "dark" | "light" | null) ?? state.theme ?? "dark"; const s = skin(theme);
    const layout: LiveLayout = (q.get("layout") as LiveLayout | null) ?? state.layout ?? "classic";
    const giveUrl = `${window.location.origin}${pageRef ? href({ name: "give", org: org!.slug, page: pageRef }) : href({ name: "give" })}`;
    useEffect(() => { QRCode.toDataURL(giveUrl, { width: 480, margin: 1, color: { dark: "#000000", light: "#ffffff" } }).then(setQr).catch(() => setQr("")); }, [giveUrl]);
    useEffect(() => { if (last) setConfetti(Date.now()); }, [last]);
    useEffect(() => { if (state.confetti_at && state.confetti_at > Date.now() - 15000) setConfetti(state.confetti_at); }, [state.confetti_at]);

    const rate = CURRENCIES[currency] ?? 1;
    const pct = goalUsd > 0 ? Math.min(100, (totalUsd / goalUsd) * 100) : 0;
    useEffect(() => { const hit = MILESTONES.filter((m) => pct >= m).pop() ?? -1; if (seenPct.current >= 0 && hit > seenPct.current) { setMilestone(hit); setConfetti(Date.now()); setTimeout(() => setMilestone(null), 8000); } seenPct.current = hit; }, [pct]);
    const shown = useCountUp(totalUsd);
    const rows = useMemo(() => (bundle ? [...bundle.donations].reduce<Record<string, number>>((m, d) => ({ ...m, [d.name]: (m[d.name] ?? 0) + d.usd_cents / 100 }), {}) : null), [bundle]);
    const top = bundle ? Object.entries(rows ?? {}).filter(([n]) => n !== "Anonymous").sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, total], i) => ({ id: name, name, total, rank: i + 1 })) : [...board].sort((a, b) => b.total - a.total).slice(0, 10).map((o, i) => ({ id: o.id, name: o.name, total: o.total, rank: i + 1 }));
    const feed = gifts.length ? gifts.map((d) => ({ id: d.id, who: d.donor_name, usd: usdOf(d), message: d.message, cause: d.cause })) : recent.slice(0, 12).map((a, i) => ({ id: String(i), who: a.who, usd: a.usd, message: a.message ?? "", cause: a.cause ?? "" }));
    const title = bundle ? bundle.page.title : brand.tagline;
    const endsAt = bundle?.page.end_date ? new Date(bundle.page.end_date).getTime() : null;
    const [now, setNow] = useState(Date.now());
    useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
    const left = endsAt ? Math.max(0, endsAt - now) : null;
    const leftText = left === null ? "" : left === 0 ? "Closed" : left > 86400000 * 2 ? `${Math.ceil(left / 86400000)} days left` : `${Math.floor(left / 3600000)}h ${Math.floor((left % 3600000) / 60000)}m left`;
    const supporters = bundle ? bundle.page.donor_count : board.length;
    const impact = brand.impact && brand.impact.usd > 0 && totalUsd >= brand.impact.usd ? <div className={cx("text-xl", s.soft)}>Enough for <b>{Math.floor(totalUsd / brand.impact.usd).toLocaleString("en")} {brand.impact.unit}</b></div> : null;

    if (!org) return null;
    const Total = ({ size }: { size: "md" | "lg" | "xl" }) => <div><div className={cx("text-sm tracking-[0.2em] uppercase", s.muted)}>Raised so far</div><div className={cx("leading-none font-bold tracking-tight tabular-nums", size === "xl" ? "text-[clamp(3.5rem,11vw,11rem)]" : size === "lg" ? "text-[clamp(3rem,9vw,9rem)]" : "text-[clamp(2rem,5vw,4.5rem)]")}>{money(Math.round(shown))}</div></div>;
    const Board = ({ limit = 10, size = "md" as "md" | "sm", heading = bundle ? "Top supporters" : "Leaderboard" }) => (
        <section className={cx("flex flex-col gap-3 rounded-[2rem] p-6 md:p-8", s.panel)}>
            <h2 className={cx("text-sm tracking-[0.2em] uppercase", s.muted)}>{heading}</h2>
            <ol className="flex flex-col gap-2"><AnimatePresence initial={false}>{top.slice(0, limit).map((o) => <Rank key={o.id} o={o} s={s} size={size} />)}</AnimatePresence>{top.length === 0 && <li className={cx("rounded-2xl px-4 py-6 text-center", s.row, s.muted)}>The first gift puts a name here.</li>}</ol>
        </section>
    );

    const layouts: Record<LiveLayout, ReactNode> = {
        classic: (
            <main className="grid flex-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
                <section className={cx("flex flex-col justify-center gap-6 rounded-[2rem] p-8 md:p-12", s.panel)}><Total size="lg" /><Thermo pct={pct} goal={goalUsd} total={totalUsd} money={money} s={s} />{impact}<LastGift last={last} money={money} />{state.show_qr !== false && <Qr src={qr} url={giveUrl} s={s} />}</section>
                <Board />
            </main>
        ),
        thermo: (
            <main className={cx("flex flex-1 flex-col items-center justify-center gap-8 rounded-[2rem] p-8 text-center md:p-12", s.panel)}>
                <Total size="xl" />
                <div className="w-full max-w-5xl"><Thermo pct={pct} goal={goalUsd} total={totalUsd} money={money} s={s} size="lg" /></div>
                {impact}
                <div className="w-full max-w-3xl"><LastGift last={last} money={money} big /></div>
                {state.show_qr !== false && <Qr src={qr} url={giveUrl} s={s} />}
            </main>
        ),
        impact: (
            <main className="grid flex-1 gap-6 lg:grid-cols-[1fr_minmax(16rem,22rem)]">
                <section className="flex flex-col gap-6">
                    <div className={cx("flex flex-wrap items-end justify-between gap-6 rounded-[2rem] p-8", s.panel)}><Total size="md" /><div className="w-full max-w-xl flex-1"><Thermo pct={pct} goal={goalUsd} total={totalUsd} money={money} s={s} /></div></div>
                    <ul className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {items.map((it) => { const n = fundedToday[it.label] ?? 0; const hot = last?.cause === it.label; return (
                            <motion.li key={it.label} animate={hot ? { scale: [1, 1.04, 1] } : {}} transition={{ duration: 0.6 }} className={cx("flex flex-col justify-between gap-4 rounded-[1.75rem] p-6", hot ? "bg-brand-solid text-white" : s.panel)}>
                                <div className="flex items-start justify-between gap-4"><div className="text-[clamp(1.1rem,1.6vw,1.6rem)] leading-tight font-semibold">{it.label}</div><span className={cx("shrink-0 rounded-full px-3 py-1 text-base font-bold tabular-nums", hot ? "bg-white/20" : "bg-brand-solid text-white")}>{money(it.usd)}</span></div>
                                <div className="flex items-end justify-between gap-3"><div><div className="text-[clamp(2rem,4vw,4rem)] leading-none font-bold tabular-nums">{n}</div><div className={cx("mt-1 text-sm", hot ? "text-white/80" : s.muted)}>funded today</div></div><div className="flex max-w-[50%] flex-wrap justify-end gap-1">{Array.from({ length: Math.min(n, 24) }, (_, i) => <span key={i} className={cx("size-2.5 rounded-full", hot ? "bg-white" : "bg-brand-solid")} />)}</div></div>
                            </motion.li>
                        ); })}
                        {items.length === 0 && <li className={cx("rounded-[1.75rem] p-8 text-center text-lg sm:col-span-2 xl:col-span-3", s.panel, s.muted)}>Add impact items in the presenter console: what a gift of each size pays for.</li>}
                    </ul>
                </section>
                <aside className="flex flex-col gap-6"><div className={cx("flex flex-col gap-5 rounded-[2rem] p-6", s.panel)}><LastGift last={last} money={money} />{state.show_qr !== false && qr && <div className="flex flex-col items-center gap-3 text-center"><img src={qr} alt="QR code to give from your phone" className="w-full max-w-[16rem] rounded-2xl bg-white p-2" /><div className={cx("text-xl font-semibold", s.soft)}>Scan to fund one</div><div className={cx("text-sm", s.muted)}>{giveUrl.replace(/^https?:\/\//, "")}</div></div>}</div><Board limit={5} size="sm" /></aside>
            </main>
        ),
        podium: (
            <main className="flex flex-1 flex-col gap-6">
                <div className={cx("flex flex-wrap items-end justify-between gap-6 rounded-[2rem] px-8 py-6", s.panel)}><Total size="md" /><div className="w-full max-w-xl flex-1"><Thermo pct={pct} goal={goalUsd} total={totalUsd} money={money} s={s} /></div>{state.show_qr !== false && <Qr src={qr} url={giveUrl} s={s} />}</div>
                <section className="grid flex-1 items-end gap-4 md:grid-cols-3">
                    {[top[1], top[0], top[2]].map((o, i) => o ? (
                        <motion.div key={o.id} layout className={cx("flex flex-col items-center gap-3 rounded-[2rem] p-6 text-center", o.rank === 1 ? "bg-brand-solid text-white md:min-h-[26rem]" : cx(s.panel, i === 0 ? "md:min-h-[20rem]" : "md:min-h-[16rem]"))}>
                            <span className={cx("flex items-center justify-center rounded-full text-2xl font-bold", o.rank === 1 ? "size-24 bg-white/20" : cx("size-20", s.row3))}>{initials(o.name)}</span>
                            <span className={cx("text-5xl font-bold", o.rank === 1 ? "text-white/80" : s.muted)}>#{o.rank}</span>
                            <span className="text-[clamp(1.2rem,2vw,2rem)] leading-tight font-semibold">{o.name}</span>
                            <span className="text-[clamp(1.4rem,2.6vw,2.6rem)] font-bold tabular-nums">{money(o.total)}</span>
                        </motion.div>
                    ) : <div key={i} />)}
                </section>
                {top.length > 3 && <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><AnimatePresence initial={false}>{top.slice(3, 11).map((o) => <Rank key={o.id} o={o} s={s} size="sm" />)}</AnimatePresence></ol>}
            </main>
        ),
        wall: (
            <main className="grid flex-1 gap-6 lg:grid-cols-[minmax(18rem,24rem)_1fr]">
                <aside className={cx("flex flex-col justify-between gap-8 rounded-[2rem] p-8", s.panel)}><div className="flex flex-col gap-6"><Total size="md" /><Thermo pct={pct} goal={goalUsd} total={totalUsd} money={money} s={s} />{impact}</div>{state.show_qr !== false && qr && <div className="flex flex-col items-center gap-3 text-center"><img src={qr} alt="QR code to give from your phone" className="w-full max-w-[14rem] rounded-2xl bg-white p-2" /><div className={cx("text-lg font-semibold", s.soft)}>Scan to give</div></div>}</aside>
                <section className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-3"><AnimatePresence initial={false}>{feed.slice(0, 12).map((g, i) => (
                    <motion.div key={g.id} layout initial={{ opacity: 0, scale: 0.9, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }} className={cx("flex flex-col gap-3 rounded-[1.5rem] p-5", i === 0 ? "bg-brand-solid text-white sm:col-span-2 xl:col-span-2" : s.panel)}>
                        <div className="flex items-center gap-3"><span className={cx("flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold", i === 0 ? "bg-white/20" : s.row3)}>{initials(g.who) || "A"}</span><span className={cx("min-w-0 flex-1 truncate font-semibold", i === 0 ? "text-2xl" : "text-lg")}>{g.who}</span><span className={cx("font-bold tabular-nums", i === 0 ? "text-3xl" : "text-xl")}>{money(g.usd)}</span></div>
                        {(g.cause || g.message) && <div className={cx("truncate", i === 0 ? "text-lg text-white/85" : cx("text-sm", s.muted))}>{g.cause ? `for ${g.cause.toLowerCase()}` : `“${g.message}”`}</div>}
                    </motion.div>
                ))}</AnimatePresence>{feed.length === 0 && <div className={cx("rounded-[1.5rem] p-8 text-center text-lg sm:col-span-2 xl:col-span-3", s.panel, s.muted)}>Gifts appear here as they land.</div>}</section>
            </main>
        ),
    };

    return (
        <div className={cx("min-h-dvh overflow-hidden", s.page)} style={{ fontFamily: `"${brand.font}", ui-sans-serif, system-ui` }}>
            <div aria-hidden="true" className="pointer-events-none fixed inset-0" style={{ background: s.glow }} />
            {confetti > Date.now() - 6000 && <Confetti at={confetti} />}
            {state.paused && <div className={cx("fixed inset-0 z-50 flex items-center justify-center text-2xl font-semibold", theme === "dark" ? "bg-neutral-950/95" : "bg-white/95")}>Back in a moment</div>}
            <div className="relative mx-auto flex min-h-dvh max-w-[1700px] flex-col gap-6 p-6 md:p-10">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4"><BrandMark className="size-14 rounded-2xl text-xl" /><div><div className="text-[clamp(1.4rem,2.5vw,2.4rem)] leading-none font-semibold">{brand.name}</div><div className={cx("mt-1 text-[clamp(0.9rem,1.3vw,1.3rem)]", s.soft)}>{title}</div></div></div>
                    <div className="flex items-center gap-6 text-right">{leftText && <div><div className={cx("text-xs tracking-widest uppercase", s.muted)}>Time</div><div className="text-xl font-semibold">{leftText}</div></div>}<div><div className={cx("text-xs tracking-widest uppercase", s.muted)}>Supporters</div><div className="text-xl font-semibold tabular-nums">{supporters}</div></div><span className={cx("flex items-center gap-2 rounded-full px-3 py-1.5 text-sm", s.row)}><span className="relative inline-flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>Live</span></div>
                </header>

                <AnimatePresence>{state.ask && <motion.div key={state.ask} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className={cx("rounded-3xl px-8 py-5 text-center text-[clamp(1.3rem,2.6vw,2.6rem)] font-semibold shadow-2xl", theme === "dark" ? "bg-white text-neutral-950" : "bg-neutral-950 text-white")}>{state.ask}{state.ask_usd ? <span className="ml-3 rounded-full bg-brand-solid px-4 py-1 text-white">{money(state.ask_usd)}</span> : null}</motion.div>}</AnimatePresence>
                <AnimatePresence>{milestone && <motion.div key={milestone} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed inset-x-0 top-1/3 z-30 mx-auto w-fit rounded-3xl bg-brand-solid px-10 py-6 text-center text-[clamp(1.6rem,4vw,4rem)] font-bold text-white shadow-2xl">{milestone === 100 ? "Goal reached!" : `${milestone}% of the way there`}</motion.div>}</AnimatePresence>

                {layouts[layout] ?? layouts.classic}

                {layout !== "wall" && <footer className={cx("overflow-hidden rounded-full", s.panel)}>
                    <div className="flex gap-10 whitespace-nowrap px-6 py-3 text-lg motion-reduce:[animation:none]" style={{ animation: "outgive-ticker 40s linear infinite" }}>
                        {(feed.length ? [...feed, ...feed] : [{ id: "e", who: "Be the first", usd: 0, message: "", cause: "" }]).map((g, i) => <span key={`${g.id}-${i}`} className="flex items-center gap-2"><span className="size-2 rounded-full bg-brand-400" /><b>{g.who}</b>{g.usd > 0 && <span className={s.soft}>{money(g.usd)}</span>}{g.cause ? <span className={s.muted}>for {g.cause.toLowerCase()}</span> : g.message && <span className={s.muted}>“{g.message}”</span>}</span>)}
                    </div>
                </footer>}
            </div>
            <style>{`@keyframes outgive-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
            {!org.remove_branding && <div className={cx("fixed right-4 bottom-4 text-xs", s.muted)}>Live by Outgive · {fmt(Math.round(totalUsd * rate * 100), currency)}</div>}
        </div>
    );
};

/** Transparent overlay for OBS or any browser source: goal bar, running total and a pop-up for each gift. ?theme=bar|alert|ticker */
export const Overlay = ({ pageRef }: { pageRef?: PageRef }) => {
    const { org, brand, money } = useApp();
    const { bundle, last, gifts, totalUsd, goalUsd } = useLive(pageRef);
    const theme = new URLSearchParams(window.location.search).get("theme") ?? "bar";
    const [show, setShow] = useState<DonationRow | null>(null);
    useEffect(() => { if (!last) return; setShow(last); const id = setTimeout(() => setShow(null), 7000); return () => clearTimeout(id); }, [last]);
    useEffect(() => { document.documentElement.style.background = "transparent"; document.body.style.background = "transparent"; return () => { document.documentElement.style.background = ""; document.body.style.background = ""; }; }, []);
    const pct = goalUsd > 0 ? Math.min(100, (totalUsd / goalUsd) * 100) : 0;
    if (!org) return null;
    return (
        <div className="min-h-dvh bg-transparent p-4 text-white" style={{ fontFamily: `"${brand.font}", ui-sans-serif, system-ui`, textShadow: "0 1px 2px rgb(0 0 0 / .5)" }}>
            {theme !== "alert" && <div className="w-full max-w-xl rounded-2xl bg-neutral-950/80 p-4 ring-1 ring-white/10 backdrop-blur">
                <div className="flex items-center gap-3"><BrandMark className="size-9 rounded-xl text-sm" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{bundle?.page.title ?? brand.name}</div>{goalUsd > 0 && <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/15"><motion.div className="h-full rounded-full bg-brand-solid" animate={{ width: `${pct}%` }} /></div>}</div><div className="text-right"><div className="text-2xl leading-none font-bold tabular-nums">{money(Math.round(totalUsd))}</div>{goalUsd > 0 && <div className="text-xs text-white/70">of {money(goalUsd)}</div>}</div></div>
                {theme === "ticker" && gifts.length > 0 && <div className="mt-3 flex flex-col gap-1 text-sm">{gifts.slice(0, 5).map((g) => <div key={g.id} className="flex justify-between gap-3"><span className="truncate">{g.donor_name}{g.cause && <span className="text-white/60"> · {g.cause}</span>}</span><span className="font-semibold tabular-nums">{money(g.usd_cents / 100)}</span></div>)}</div>}
            </div>}
            <AnimatePresence>{show && <motion.div key={show.id} initial={{ y: 30, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0 }} className="mt-4 flex w-full max-w-xl items-center gap-4 rounded-2xl bg-brand-solid px-5 py-4 shadow-2xl"><span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/25 text-lg font-bold">{initials(show.donor_name) || "A"}</span><div className="min-w-0"><div className="text-lg"><b>{show.donor_name}</b> gave <b>{money(show.usd_cents / 100)}</b>{show.cause && <span className="text-white/85"> for {show.cause.toLowerCase()}</span>}</div>{show.message && <div className="truncate text-sm text-white/85">“{show.message}”</div>}</div></motion.div>}</AnimatePresence>
        </div>
    );
};
