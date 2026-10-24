import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import QRCode from "qrcode";
import { BrandMark, useApp } from "@/components/outgive/shared";
import { CURRENCIES, initials } from "@/data";
import type { PageRef } from "@/lib/route";
import { fmt } from "@/lib/money";
import type { DonationRow, LiveState, PageBundle } from "@/lib/types";
import { cx } from "@/utils/cx";

/**
 * The live screen: a wall display for a giving day, gala or stream. Big total, thermometer, the board reordering as gifts land,
 * a ticker of every gift, confetti and milestone moments, a QR code to give, and whatever the presenter pushes from the console.
 * Scoped to the organisation (/live) or to one page (/c/slug/live).
 */
const MILESTONES = [25, 50, 75, 100];
const usdOf = (d: DonationRow) => d.usd_cents / 100;

export const useLive = (pageRef?: PageRef) => {
    const { db, org } = useApp();
    const [bundle, setBundle] = useState<PageBundle | null>(null);
    const [gifts, setGifts] = useState<DonationRow[]>([]);
    const [last, setLast] = useState<DonationRow | null>(null);
    const load = () => { if (org && pageRef) db.rpc<PageBundle | null>("page_get", { org: org.id, t: pageRef.type, s: pageRef.slug }).then(setBundle); };
    useEffect(load, [db, org, pageRef?.type, pageRef?.slug]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!org) return;
        return db.onDonations(org.id, (d) => {
            if (d.status !== "succeeded" || d.source === "match") return;
            if (bundle && d.page_id !== bundle.page.id && !bundle.children.some((c) => c.id === d.page_id)) return;
            setGifts((g) => (g.some((x) => x.id === d.id) ? g : [d, ...g].slice(0, 12))); setLast(d); load();
        });
    }, [db, org, bundle?.page.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const state: LiveState = { ...(org?.live ?? {}), ...(bundle?.page.live ?? {}) };
    return { bundle, gifts, last, state };
};

const Confetti = ({ at }: { at: number }) => {
    const bits = useMemo(() => Array.from({ length: 80 }, (_, i) => ({ x: (i * 37) % 100, d: 0.6 + ((i * 13) % 10) / 10, r: (i * 53) % 360, c: ["bg-brand-400", "bg-brand-600", "bg-white", "bg-brand-200", "bg-yellow-300"][i % 5], w: 6 + (i % 3) * 3 })), [at]);
    return <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">{bits.map((b, i) => <motion.span key={`${at}-${i}`} initial={{ y: -40, x: `${b.x}vw`, rotate: 0, opacity: 1 }} animate={{ y: "110vh", rotate: b.r + 720, opacity: [1, 1, 0.8, 0] }} transition={{ duration: 2.4 + b.d, ease: "easeIn", delay: (i % 7) * 0.08 }} className={cx("absolute top-0 rounded-sm", b.c)} style={{ width: b.w, height: b.w * 1.6 }} />)}</div>;
};

/** Counts up to the value over half a second, so a new gift is seen landing. */
const useCountUp = (value: number) => {
    const [shown, setShown] = useState(value); const from = useRef(value);
    useEffect(() => { const start = performance.now(); const a = from.current; let raf = 0; const tick = (t: number) => { const k = Math.min(1, (t - start) / 600); setShown(a + (value - a) * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); else from.current = value; }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [value]);
    return shown;
};

export const Live = ({ pageRef }: { pageRef?: PageRef }) => {
    const { org, brand, board, money, currency, activity, href } = useApp();
    const { bundle, gifts, last, state } = useLive(pageRef);
    const [qr, setQr] = useState("");
    const [confetti, setConfetti] = useState(0);
    const [milestone, setMilestone] = useState<number | null>(null);
    const seenPct = useRef(-1);
    const giveUrl = `${window.location.origin}${pageRef ? href({ name: "page", org: org!.slug, page: pageRef }) : href({ name: "home" })}`;
    useEffect(() => { QRCode.toDataURL(giveUrl, { width: 320, margin: 1, color: { dark: "#000000", light: "#ffffff" } }).then(setQr).catch(() => setQr("")); }, [giveUrl]);
    useEffect(() => { if (last) setConfetti(Date.now()); }, [last]);
    useEffect(() => { if (state.confetti_at && state.confetti_at > Date.now() - 15000) setConfetti(state.confetti_at); }, [state.confetti_at]);

    const rate = CURRENCIES[currency] ?? 1;
    const totalUsd = bundle ? bundle.page.raised_cents / 100 / (CURRENCIES[bundle.page.currency] ?? 1) : board.reduce((n, o) => n + o.total, 0);
    const goalUsd = bundle ? bundle.page.goal_cents / 100 / (CURRENCIES[bundle.page.currency] ?? 1) : state.ask_usd ?? 0;
    const pct = goalUsd > 0 ? Math.min(100, (totalUsd / goalUsd) * 100) : 0;
    useEffect(() => { const hit = MILESTONES.filter((m) => pct >= m).pop() ?? -1; if (seenPct.current >= 0 && hit > seenPct.current) { setMilestone(hit); setConfetti(Date.now()); setTimeout(() => setMilestone(null), 8000); } seenPct.current = hit; }, [pct]);
    const shown = useCountUp(totalUsd);
    const rows = useMemo(() => (bundle ? [...bundle.donations].reduce<Record<string, number>>((m, d) => ({ ...m, [d.name]: (m[d.name] ?? 0) + d.usd_cents / 100 }), {}) : null), [bundle]);
    const top = bundle ? Object.entries(rows ?? {}).filter(([n]) => n !== "Anonymous").sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, total], i) => ({ id: name, name, total, rank: i + 1 })) : [...board].sort((a, b) => b.total - a.total).slice(0, 10).map((o, i) => ({ id: o.id, name: o.name, total: o.total, rank: i + 1 }));
    const feed = gifts.length ? gifts.map((d) => ({ id: d.id, who: d.donor_name, usd: usdOf(d), message: d.message })) : (bundle ? bundle.donations.slice(0, 8).map((d) => ({ id: d.id, who: d.name, usd: d.usd_cents / 100, message: d.message })) : activity.slice(0, 8).map((a, i) => ({ id: String(i), who: a.who, usd: a.usd, message: "" })));
    const mode = state.mode ?? "board";
    const title = bundle ? bundle.page.title : brand.tagline;
    const endsAt = bundle?.page.end_date ? new Date(bundle.page.end_date).getTime() : null;
    const [now, setNow] = useState(Date.now());
    useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
    const left = endsAt ? Math.max(0, endsAt - now) : null;
    const leftText = left === null ? "" : left === 0 ? "Closed" : left > 86400000 * 2 ? `${Math.ceil(left / 86400000)} days left` : `${Math.floor(left / 3600000)}h ${Math.floor((left % 3600000) / 60000)}m left`;

    if (!org) return null;
    return (
        <div className="min-h-dvh overflow-hidden bg-neutral-950 text-white" style={{ fontFamily: `"${brand.font}", ui-sans-serif, system-ui` }}>
            <div aria-hidden="true" className="pointer-events-none fixed inset-0" style={{ background: "radial-gradient(ellipse at 20% 0%, color-mix(in srgb, var(--color-brand-500) 28%, transparent), transparent 55%), radial-gradient(ellipse at 100% 100%, color-mix(in srgb, var(--color-brand-700) 30%, transparent), transparent 50%)" }} />
            {confetti > Date.now() - 6000 && <Confetti at={confetti} />}
            {state.paused && <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/95 text-2xl font-semibold">Back in a moment</div>}
            <div className="relative mx-auto flex min-h-dvh max-w-[1700px] flex-col gap-6 p-6 md:p-10">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4"><BrandMark className="size-14 rounded-2xl text-xl" /><div><div className="text-[clamp(1.4rem,2.5vw,2.4rem)] leading-none font-semibold">{brand.name}</div><div className="mt-1 text-[clamp(0.9rem,1.3vw,1.3rem)] text-white/70">{title}</div></div></div>
                    <div className="flex items-center gap-6 text-right">{leftText && <div><div className="text-xs tracking-widest text-white/50 uppercase">Time</div><div className="text-xl font-semibold">{leftText}</div></div>}<div><div className="text-xs tracking-widest text-white/50 uppercase">Supporters</div><div className="text-xl font-semibold tabular-nums">{bundle ? bundle.page.donor_count : board.length}</div></div><span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm"><span className="relative inline-flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>Live</span></div>
                </header>

                <AnimatePresence>{state.ask && <motion.div key={state.ask} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="rounded-3xl bg-white px-8 py-5 text-center text-[clamp(1.3rem,2.6vw,2.6rem)] font-semibold text-neutral-950 shadow-2xl">{state.ask}{state.ask_usd ? <span className="ml-3 rounded-full bg-brand-solid px-4 py-1 text-white">{money(state.ask_usd)}</span> : null}</motion.div>}</AnimatePresence>
                <AnimatePresence>{milestone && <motion.div key={milestone} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed inset-x-0 top-1/3 z-30 mx-auto w-fit rounded-3xl bg-brand-solid px-10 py-6 text-center text-[clamp(1.6rem,4vw,4rem)] font-bold shadow-2xl">{milestone === 100 ? "Goal reached!" : `${milestone}% of the way there`}</motion.div>}</AnimatePresence>

                <main className={cx("grid flex-1 gap-6", mode === "board" ? "lg:grid-cols-[1.1fr_1fr]" : "lg:grid-cols-1")}>
                    <section className="flex flex-col justify-center gap-6 rounded-[2rem] bg-white/5 p-8 ring-1 ring-white/10 md:p-12">
                        <div className="text-sm tracking-[0.2em] text-white/60 uppercase">Raised so far</div>
                        <div className="text-[clamp(3rem,9vw,9rem)] leading-none font-bold tracking-tight tabular-nums">{money(Math.round(shown))}</div>
                        {goalUsd > 0 && <div className="flex flex-col gap-3"><div className="h-6 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-brand-solid" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 60, damping: 18 }} /></div><div className="flex justify-between text-lg text-white/80"><span>{Math.round(pct)}% of {money(goalUsd)}</span><span>{money(Math.max(0, goalUsd - totalUsd))} to go</span></div></div>}
                        {brand.impact && brand.impact.usd > 0 && totalUsd >= brand.impact.usd && <div className="text-xl text-white/80">Enough for <b className="text-white">{Math.floor(totalUsd / brand.impact.usd).toLocaleString("en")} {brand.impact.unit}</b></div>}
                        <AnimatePresence mode="popLayout">{last && <motion.div key={last.id} initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-4 rounded-2xl bg-brand-solid/90 px-5 py-4 text-xl"><span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold">{initials(last.donor_name) || "A"}</span><span className="min-w-0"><b>{last.donor_name}</b> just gave <b>{money(usdOf(last))}</b>{last.message && <span className="block truncate text-base text-white/85">“{last.message}”</span>}</span></motion.div>}</AnimatePresence>
                        {state.show_qr !== false && qr && <div className="flex items-center gap-5 pt-2"><img src={qr} alt="QR code to give" className="size-28 rounded-xl bg-white p-1.5 md:size-36" /><div className="text-lg text-white/80"><div className="font-semibold text-white">Scan to give</div><div className="text-base text-white/60">{giveUrl.replace(/^https?:\/\//, "")}</div></div></div>}
                    </section>

                    {mode === "board" && <section className="flex flex-col gap-3 rounded-[2rem] bg-white/5 p-6 ring-1 ring-white/10 md:p-8">
                        <h2 className="text-sm tracking-[0.2em] text-white/60 uppercase">{bundle ? "Top supporters" : "Leaderboard"}</h2>
                        <ol className="flex flex-col gap-2">
                            <AnimatePresence initial={false}>{top.map((o) => (
                                <motion.li key={o.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className={cx("flex items-center gap-4 rounded-2xl px-4 py-3", o.rank === 1 ? "bg-brand-solid" : o.rank <= 3 ? "bg-white/15" : "bg-white/5")}>
                                    <span className="w-9 text-[clamp(1rem,1.6vw,1.6rem)] font-bold tabular-nums">{o.rank}</span>
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">{initials(o.name)}</span>
                                    <span className="min-w-0 flex-1 truncate text-[clamp(1rem,1.5vw,1.5rem)] font-semibold">{o.name}</span>
                                    <span className="text-[clamp(1rem,1.5vw,1.5rem)] font-bold tabular-nums">{money(o.total)}</span>
                                </motion.li>
                            ))}</AnimatePresence>
                            {top.length === 0 && <li className="rounded-2xl bg-white/5 px-4 py-6 text-center text-white/60">The first gift puts a name here.</li>}
                        </ol>
                    </section>}
                </main>

                <footer className="overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                    <div className="flex gap-10 whitespace-nowrap px-6 py-3 text-lg [animation:ticker_40s_linear_infinite] motion-reduce:[animation:none]" style={{ animationName: "outgive-ticker" }}>
                        {(feed.length ? [...feed, ...feed] : [{ id: "e", who: "Be the first", usd: 0, message: "" }]).map((g, i) => <span key={`${g.id}-${i}`} className="flex items-center gap-2"><span className="size-2 rounded-full bg-brand-400" /><b>{g.who}</b>{g.usd > 0 && <span className="text-white/80">{money(g.usd)}</span>}{g.message && <span className="text-white/60">“{g.message}”</span>}</span>)}
                    </div>
                </footer>
            </div>
            <style>{`@keyframes outgive-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } } .\\[animation\\:ticker_40s_linear_infinite\\] { animation: outgive-ticker 40s linear infinite }`}</style>
            {!org.remove_branding && <div className="fixed right-4 bottom-4 text-xs text-white/40">Live by Outgive · {fmt(Math.round(totalUsd * rate * 100), currency)}</div>}
        </div>
    );
};

/** Transparent overlay for OBS or any browser source: goal bar, running total and a pop-up for each gift. ?theme=bar|alert|ticker */
export const Overlay = ({ pageRef }: { pageRef?: PageRef }) => {
    const { org, brand, board, money } = useApp();
    const { bundle, last, gifts } = useLive(pageRef);
    const theme = new URLSearchParams(window.location.search).get("theme") ?? "bar";
    const [show, setShow] = useState<DonationRow | null>(null);
    useEffect(() => { if (!last) return; setShow(last); const id = setTimeout(() => setShow(null), 7000); return () => clearTimeout(id); }, [last]);
    useEffect(() => { document.documentElement.style.background = "transparent"; document.body.style.background = "transparent"; return () => { document.documentElement.style.background = ""; document.body.style.background = ""; }; }, []);
    const totalUsd = bundle ? bundle.page.raised_cents / 100 / (CURRENCIES[bundle.page.currency] ?? 1) : board.reduce((n, o) => n + o.total, 0);
    const goalUsd = bundle ? bundle.page.goal_cents / 100 / (CURRENCIES[bundle.page.currency] ?? 1) : org?.live.ask_usd ?? 0;
    const pct = goalUsd > 0 ? Math.min(100, (totalUsd / goalUsd) * 100) : 0;
    if (!org) return null;
    return (
        <div className="min-h-dvh bg-transparent p-4 text-white" style={{ fontFamily: `"${brand.font}", ui-sans-serif, system-ui`, textShadow: "0 1px 2px rgb(0 0 0 / .5)" }}>
            {theme !== "alert" && <div className="w-full max-w-xl rounded-2xl bg-neutral-950/80 p-4 ring-1 ring-white/10 backdrop-blur">
                <div className="flex items-center gap-3"><BrandMark className="size-9 rounded-xl text-sm" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{bundle?.page.title ?? brand.name}</div>{goalUsd > 0 && <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/15"><motion.div className="h-full rounded-full bg-brand-solid" animate={{ width: `${pct}%` }} /></div>}</div><div className="text-right"><div className="text-2xl leading-none font-bold tabular-nums">{money(Math.round(totalUsd))}</div>{goalUsd > 0 && <div className="text-xs text-white/70">of {money(goalUsd)}</div>}</div></div>
                {theme === "ticker" && gifts.length > 0 && <div className="mt-3 flex flex-col gap-1 text-sm">{gifts.slice(0, 5).map((g) => <div key={g.id} className="flex justify-between gap-3"><span className="truncate">{g.donor_name}</span><span className="font-semibold tabular-nums">{money(g.usd_cents / 100)}</span></div>)}</div>}
            </div>}
            <AnimatePresence>{show && <motion.div key={show.id} initial={{ y: 30, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0 }} className="mt-4 flex w-full max-w-xl items-center gap-4 rounded-2xl bg-brand-solid px-5 py-4 shadow-2xl"><span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/25 text-lg font-bold">{initials(show.donor_name) || "A"}</span><div className="min-w-0"><div className="text-lg"><b>{show.donor_name}</b> gave <b>{money(show.usd_cents / 100)}</b></div>{show.message && <div className="truncate text-sm text-white/85">“{show.message}”</div>}</div></motion.div>}</AnimatePresence>
        </div>
    );
};
