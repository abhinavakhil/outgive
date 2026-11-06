import { type FC, type ReactNode, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useMotionValue, useSpring } from "motion/react";
import { ArrowRight, BarChart01, Check, CodeBrowser, CreditCard01, Gift01, Globe01, HeartHand, Lock01, QrCode01, Repeat01, Target04, Trophy01, Tv01, Users01, Zap } from "@untitledui/icons";
import { cx } from "@/shared/utils/cx";

/** The coming-soon page: Outgive's crowdfunding platform, before launch. Also the screen a signed-out visitor sees on any page that is not open yet. */

const WORDS = ["gift", "donor", "share", "mile", "pound"];
const FEATURES: [FC<{ className?: string }>, string][] = [
    [Trophy01, "Live leaderboards"], [Users01, "Team and company races"], [Tv01, "Big-screen live mode"], [QrCode01, "Scan-to-give QR"], [Zap, "Matching gifts"], [Repeat01, "Monthly giving"],
    [Target04, "Goals and milestones"], [Gift01, "Impact units"], [CodeBrowser, "Embeds and overlays"], [Globe01, "Every currency"], [CreditCard01, "Paid straight to the charity"], [BarChart01, "Real-time reporting"],
];
const Sparkle = ({ className }: { className?: string }) => <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 0c.9 6.6 4.8 10.6 12 12-7.2 1.4-11.1 5.4-12 12-.9-6.6-4.8-10.6-12-12C7.2 10.6 11.1 6.6 12 0z" /></svg>;
const Heart = ({ className }: { className?: string }) => <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.2 0 3.6 1.2 5.3 3.1 1.7-1.9 3.1-3.1 5.3-3.1 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" /></svg>;
const Mark = () => <span className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-xl bg-white text-brand-600 shadow-[0_3px_0_rgb(0_0_0/0.15)]"><Heart className="size-4.5" /></span><span className="font-bubble text-2xl font-bold tracking-tight text-white">outgive</span></span>;
const usd = (n: number) => `$${Math.round(n).toLocaleString("en")}`;
const IN = "animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both motion-reduce:animate-none";

/** A sticker you can pick up and throw; it springs back home. The bob lives on the `translate` property so it doesn't fight the drag transform. */
const Sticker = ({ className, bob, children }: { className: string; bob: string; children: ReactNode }) => (
    <motion.span aria-hidden="true" drag dragSnapToOrigin dragElastic={0.6} whileHover={{ scale: 1.06 }} whileDrag={{ scale: 1.15, rotate: 0, zIndex: 30 }} className={cx("absolute z-20 hidden cursor-grab touch-none select-none active:cursor-grabbing xl:block", className)}>
        <span className={cx("block motion-reduce:animate-none", bob)}>{children}</span>
    </motion.span>
);

/** Hearts thrown out from the middle when someone joins. */
const Burst = () => (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; const d = 110 + (i % 3) * 50; return (
            <motion.span key={i} className={cx("absolute", i % 3 === 0 ? "text-white" : i % 3 === 1 ? "text-pop-300" : "text-heart")} initial={{ x: 0, y: 0, scale: 0, opacity: 1 }} animate={{ x: Math.cos(a) * d * 1.6, y: Math.sin(a) * d * 0.7 - 30, scale: [0, 1.2, 0.9], opacity: [1, 1, 0], rotate: (i % 2 ? 1 : -1) * 40 }} transition={{ duration: 1.3, ease: "easeOut", delay: (i % 4) * 0.03 }}><Heart className="size-5" /></motion.span>
        ); })}
    </span>
);

/** Dashed orbits, twinkles and the blue band shared by the landing and the gate. */
const Backdrop = () => (
    <>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <svg className="absolute -top-64 -left-64 size-[820px] animate-[spin_120s_linear_infinite] text-white/20 motion-reduce:animate-none" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.45" strokeDasharray="2.5 3"><circle cx="100" cy="100" r="98" /><circle cx="100" cy="100" r="72" /></svg>
            <svg className="absolute top-40 -right-72 size-[760px] animate-[spin_160s_linear_infinite_reverse] text-white/15 motion-reduce:animate-none" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.45" strokeDasharray="2.5 3"><circle cx="100" cy="100" r="98" /></svg>
            <Sparkle className="absolute top-32 left-[14%] size-5 animate-pulse text-pop-300" />
            <Sparkle className="absolute top-[22%] right-[12%] size-7 animate-pulse text-white/80 [animation-delay:700ms]" />
            <Sparkle className="absolute top-[48%] left-[7%] size-3.5 animate-pulse text-white/60 [animation-delay:1400ms]" />
            <Sparkle className="absolute top-[44%] right-[22%] size-3 animate-pulse text-pop-300/80 [animation-delay:300ms]" />
        </div>
    </>
);

const Nav = () => (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 md:px-8">
        <a href="/" aria-label="Outgive home" className="rounded-xl outline-white focus-visible:outline-2 focus-visible:outline-offset-4"><Mark /></a>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium text-white/85 sm:gap-2">
            <a href="#features" className="hidden rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white sm:block">What's coming</a>
            <a href="/#join" className="ml-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 font-semibold text-brand-700 shadow-[0_3px_0_rgb(0_0_0/0.15)] outline-white transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 whitespace-nowrap"><span className="max-sm:hidden">Get early access</span><span className="sm:hidden">Join</span><ArrowRight className="size-4" /></a>
        </nav>
    </header>
);

/**
 * The Google Form the waitlist posts to. From the form's "Get pre-filled link": `action` is the form URL with /viewform swapped for /formResponse,
 * and each field is its `entry.<number>` name. `role` can stay empty if the form has no such question.
 */
const FORM = { action: "", email: "", role: "" };

/** Email plus who you are, sent to the Google Form. */
const Waitlist = () => {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<"charity" | "fundraiser">("charity");
    const [state, setState] = useState<"idle" | "busy" | "done">("idle");
    const [error, setError] = useState("");
    const submit = async () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("That email doesn't look right.");
        if (!FORM.action) return setError("The waitlist isn't connected yet. Try again soon.");
        setState("busy"); setError("");
        const body = new URLSearchParams({ [FORM.email]: email.trim(), ...(FORM.role ? { [FORM.role]: role === "charity" ? "Charity" : "Fundraiser" } : {}) });
        // Google Forms sends no CORS headers, so the response is opaque: a network failure is the only error we can see.
        try { await fetch(FORM.action, { method: "POST", mode: "no-cors", body }); setState("done"); } catch { setError("Couldn't reach the waitlist. Check your connection and try again."); setState("idle"); }
    };
    return (
        <div id="join" className="relative flex w-full max-w-xl scroll-mt-24 flex-col items-center gap-3">
            {state === "done" && <Burst />}
            <AnimatePresence mode="wait" initial={false}>
                {state === "done" ? (
                    <motion.div key="done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.5 }} role="status" className="flex w-full items-center gap-3 rounded-[28px] bg-white p-2 pr-5 text-left shadow-xl shadow-brand-950/25">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pop-300 text-brand-950"><Check className="size-6" /></span>
                        <span><span className="block font-bold text-neutral-900">You're on the list.</span><span className="text-sm text-neutral-500">We'll write to {email.trim()} when early access opens.</span></span>
                    </motion.div>
                ) : (
                    <motion.form key="form" exit={{ scale: 0.95, opacity: 0 }} onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex w-full flex-col gap-2 rounded-[30px] bg-white/12 p-2 ring-1 ring-white/25 backdrop-blur-sm ring-inset sm:flex-row">
                        <input type="email" aria-label="Email address" aria-invalid={!!error} autoComplete="email" placeholder="you@yourcharity.org" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className="h-13 w-full min-w-0 rounded-full sm:flex-1 bg-white px-5 text-md text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:ring-4 focus-visible:ring-pop-300/60" />
                        <button type="submit" disabled={state === "busy"} className="group inline-flex h-13 cursor-pointer items-center justify-center gap-2 rounded-full bg-pop-300 px-6 text-md font-bold whitespace-nowrap text-brand-950 shadow-[0_4px_0_rgb(0_0_0/0.18)] outline-white transition hover:-translate-y-0.5 hover:bg-pop-400 focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-0 disabled:opacity-70">{state === "busy" ? "Joining…" : <>Join the waitlist<ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></>}</button>
                    </motion.form>
                )}
            </AnimatePresence>
            {error && <p role="alert" className="text-sm font-semibold text-pop-100">{error}</p>}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-white/75">
                {state !== "done" && <div role="radiogroup" aria-label="I am" className="flex rounded-full bg-white/10 p-0.5 ring-1 ring-white/15 ring-inset">
                    {(["charity", "fundraiser"] as const).map((r) => <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)} className={cx("relative cursor-pointer rounded-full px-3 py-1 font-semibold outline-white transition focus-visible:outline-2", role === r ? "text-brand-700" : "text-white/80 hover:text-white")}>{role === r && <motion.span layoutId="role" className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", bounce: 0.25, duration: 0.4 }} />}<span className="relative">{r === "charity" ? "I'm a charity" : "I fundraise"}</span></button>)}
                </div>}
                <span>Free for early charities</span><span aria-hidden="true">·</span><span>No card needed</span>
            </div>
        </div>
    );
};

type Row = { id: string; name: string; initials: string; usd: number; tone: string };
const START: Row[] = [
    { id: "a", name: "Northfield Rotary", initials: "NR", usd: 16861, tone: "bg-brand-100 text-brand-800" },
    { id: "b", name: "Amara Okafor", initials: "AO", usd: 15420, tone: "bg-pop-100 text-brand-900" },
    { id: "c", name: "Bluefin Logistics", initials: "BL", usd: 15046, tone: "bg-brand-200 text-brand-900" },
    { id: "d", name: "St Hilda's Primary", initials: "SH", usd: 13430, tone: "bg-pop-300 text-brand-950" },
    { id: "e", name: "The Tuesday Swimmers", initials: "TS", usd: 12711, tone: "bg-brand-50 text-brand-700" },
];
const DONORS = ["Grace", "Mateo", "Priya", "Jonas", "Lena", "Kofi", "Aiko", "Sam"];
const GOAL = 90000;
type Gift = { k: number; who: string; to: string; toId: string; usd: number };

/** The make-believe campaign the whole page plays: every few seconds a gift lands, just big enough for a chaser to overtake the row above. */
const useSim = () => {
    const [rows, setRows] = useState(START);
    const [feed, setFeed] = useState<Gift[]>([{ k: 2, who: "Priya", to: "Bluefin Logistics", toId: "", usd: 120 }, { k: 1, who: "Grace", to: "Amara Okafor", toId: "", usd: 50 }, { k: 0, who: "Kofi", to: "St Hilda's Primary", toId: "", usd: 25 }]);
    const [flash, setFlash] = useState(0);
    const [n, setN] = useState(0);
    const cur = useRef(START);
    useEffect(() => {
        const id = setInterval(() => {
            const rs = cur.current; const i = 1 + Math.floor(Math.random() * (rs.length - 1)); const gift = Math.round(rs[i - 1].usd - rs[i].usd + 40 + Math.random() * 600);
            cur.current = rs.map((r, j) => (j === i ? { ...r, usd: r.usd + gift } : r)).sort((a, b) => b.usd - a.usd);
            if (cur.current[0].id !== rs[0].id) setFlash(Date.now());
            setRows(cur.current); setN((x) => x + 1);
            setFeed((f) => [{ k: Date.now(), who: DONORS[Math.floor(Math.random() * DONORS.length)], to: rs[i].name, toId: rs[i].id, usd: gift }, ...f].slice(0, 4));
        }, 2600);
        return () => clearInterval(id);
    }, []);
    useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(0), 1800); return () => clearTimeout(t); }, [flash]);
    const total = rows.reduce((n, r) => n + r.usd, 0);
    return { rows, feed, flash, total, gifts: 212 + n, pct: Math.min(100, Math.round((total / GOAL) * 100)) };
};
type Sim = ReturnType<typeof useSim>;

/** Small progress ring for the funded sticker. */
const Ring = ({ pct }: { pct: number }) => {
    const c = 2 * Math.PI * 15;
    return <svg viewBox="0 0 36 36" className="size-9 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" strokeWidth="5" className="stroke-brand-100" /><motion.circle cx="18" cy="18" r="15" fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} className="stroke-brand-600" animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ type: "spring", bounce: 0 }} /></svg>;
};

/** The donor's side: a phone on the give screen. Its button taps itself each time a gift lands on the board. */
const Phone = ({ sim }: { sim: Sim }) => {
    const last = sim.feed[0]; const amounts = [25, 50, 100, 250]; const pick = amounts[last.k % amounts.length];
    return (
        <div aria-hidden="true" className="absolute -right-4 bottom-10 z-20 hidden w-[230px] rotate-[6deg] lg:block xl:-right-14">
            <div className="animate-[bob_6s_ease-in-out_infinite] rounded-[42px] bg-neutral-950 p-2.5 shadow-[0_40px_80px_-20px_rgb(8_12_60/0.7)] ring-1 ring-white/20 motion-reduce:animate-none">
                <div className="relative overflow-hidden rounded-[34px] bg-white text-neutral-900">
                    <div className="flex items-center justify-between px-5 pt-3 text-[11px] font-semibold"><span>9:41</span><span className="h-5 w-16 rounded-full bg-neutral-950" /><span className="flex gap-0.5"><span className="h-2.5 w-1 rounded-sm bg-neutral-900" /><span className="h-2.5 w-1 rounded-sm bg-neutral-900" /><span className="h-2.5 w-1 rounded-sm bg-neutral-300" /></span></div>
                    <div className="flex flex-col gap-3 px-4 pt-4 pb-6">
                        <div className="relative h-24 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-3 text-white">
                            <Sparkle className="absolute top-3 right-3 size-4 text-pop-300" />
                            <div className="text-[10px] font-semibold text-white/70 uppercase">Clean water appeal</div>
                            <div className="mt-1 font-bubble text-2xl font-bold tabular-nums">{usd(sim.total)}</div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/25"><motion.div className="h-full rounded-full bg-pop-300" animate={{ width: `${sim.pct}%` }} /></div>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">{amounts.map((a) => <span key={a} className={cx("rounded-xl py-2 text-center text-xs font-bold transition-colors duration-300", a === pick ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-600")}>${a}</span>)}</div>
                        <div className="text-center text-[11px] text-neutral-500">Puts you at <b className="text-brand-700">#2</b> on the board</div>
                        <div className="relative">
                            <motion.div key={last.k} initial={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.6 }} className="flex h-11 items-center justify-center rounded-full bg-pop-300 text-sm font-bold text-brand-950 shadow-[0_3px_0_rgb(0_0_0/0.15)]">Give ${pick}</motion.div>
                            {/* The "tap": a ring that grows out of the button each time. */}
                            <motion.span key={`t${last.k}`} initial={{ scale: 0.3, opacity: 0.7 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 0.8 }} className="pointer-events-none absolute top-1/2 left-1/2 -mt-5 -ml-5 size-10 rounded-full ring-2 ring-white" />
                        </div>
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div key={last.k} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0, transition: { duration: 0.12 } }} className="flex items-center gap-2 rounded-2xl bg-pop-100 px-3 py-2 text-[11px]"><Heart className="size-4 shrink-0 text-heart" /><span className="truncate"><b>{last.who}</b> just gave {usd(last.usd)}</span></motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

/** Feature pills scrolling past in two rows, opposite ways. Pauses under the pointer. */
const Marquee = () => {
    const half = Math.ceil(FEATURES.length / 2);
    return (
        <div id="features" aria-label="What's coming" className="flex w-full max-w-4xl scroll-mt-24 flex-col gap-2.5 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            {[FEATURES.slice(0, half), FEATURES.slice(half)].map((row, r) => (
                <div key={r} className="flex overflow-hidden">
                    {/* The row is written twice so the loop is seamless; the copy is hidden from screen readers. */}
                    <ul className={cx("flex shrink-0 gap-2.5 pr-2.5 hover:[animation-play-state:paused] motion-reduce:animate-none", r ? "animate-[marquee-half_38s_linear_infinite_reverse]" : "animate-[marquee-half_32s_linear_infinite]")}>
                        {[...row, ...row].map(([Icon, label], i) => (
                            <li key={i} aria-hidden={i >= row.length || undefined} className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 py-2 pr-4 pl-2 text-sm font-semibold whitespace-nowrap text-white/90 ring-1 ring-white/15 ring-inset">
                                <span className="flex size-7 items-center justify-center rounded-full bg-white text-brand-600"><Icon className="size-4" /></span>{label}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
            <p className="hand mt-1 text-center text-xl text-white/80">…and a lot more on the way</p>
        </div>
    );
};

/** A product window that plays itself: gifts land, rows overtake each other, the total climbs. The phone hangs off its right edge, in room the board leaves for it. */
const Mockup = ({ sim }: { sim: Sim }) => {
    const { rows, feed, flash, total, pct, gifts } = sim;
    const lead = rows[0].usd; const hit = feed[0];
    // The window leans toward the pointer.
    const rx = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 }); const ry = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
    const lean = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); ry.set(((e.clientX - r.left) / r.width - 0.5) * 6); rx.set(-((e.clientY - r.top) / r.height - 0.5) * 5); };
    const stats: [string, string][] = [["Gifts today", gifts.toLocaleString("en")], ["Average gift", usd(total / (1180 + gifts))], ["Teams racing", "14"]];
    return (
        <div className="relative mx-auto w-full max-w-5xl px-2 text-left md:px-0">
            <Phone sim={sim} />
            {/* The window runs off the bottom of the page and fades into the blue, like a peek at the product. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-brand-600 to-transparent" />
            <div aria-hidden="true" className="absolute -inset-x-10 -top-20 bottom-0 rounded-full bg-[radial-gradient(closest-side,rgb(255_176_222/0.55),rgb(255_255_255/0.18)_45%,transparent)] blur-2xl" />
            <motion.div onPointerMove={lean} onPointerLeave={() => { rx.set(0); ry.set(0); }} style={{ rotateX: rx, rotateY: ry, transformPerspective: 1600 }}>
            <motion.div initial={{ y: 60, opacity: 0, rotateX: 18 }} whileInView={{ y: 0, opacity: 1, rotateX: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ type: "spring", bounce: 0.2, duration: 1.1 }} style={{ transformPerspective: 1400 }} className="relative overflow-hidden rounded-t-[28px] bg-white p-1.5 pb-0 text-neutral-900 shadow-[0_40px_120px_-20px_rgb(8_12_60/0.55)] ring-1 ring-white/70">
                {/* Chrome: traffic lights, address, live state. */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex gap-1.5"><span className="size-3 rounded-full bg-[#ff5f57]" /><span className="size-3 rounded-full bg-[#febc2e]" /><span className="size-3 rounded-full bg-[#28c840]" /></span>
                    <span className="mx-auto flex h-8 w-full max-w-sm items-center justify-center gap-1.5 rounded-full bg-neutral-100 text-xs font-medium text-neutral-500"><Lock01 className="size-3" />yourcharity.org<span className="text-neutral-400">/clean-water</span></span>
                    <span className="hidden items-center gap-1.5 rounded-full bg-heart/10 px-2.5 py-1 text-[11px] font-bold text-heart sm:inline-flex"><span className="relative flex size-1.5"><span className="absolute inset-0 animate-ping rounded-full bg-heart" /><span className="relative size-1.5 rounded-full bg-heart" /></span>LIVE</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-t-[22px] bg-neutral-50 ring-1 ring-neutral-100 md:grid-cols-[220px_minmax(0,1fr)]">
                    <aside className="hidden flex-col gap-1 border-r border-neutral-100 bg-white p-3 text-sm md:flex">
                        <span className="flex items-center gap-2 px-2 pt-1 pb-3"><span className="flex size-7 items-center justify-center rounded-lg bg-brand-600 text-white"><Heart className="size-3.5" /></span><b className="text-sm">Clearwell Trust</b></span>
                        <span className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">Campaigns</span>
                        {[["Clean water appeal", `${pct}%`], ["Winter coat drive", "41%"], ["Marathon team", "67%"]].map(([n, p], i) => <span key={n} className={cx("flex items-center gap-2 rounded-xl px-2 py-2", i === 0 ? "bg-brand-50 font-semibold text-brand-700" : "text-neutral-600")}><span className={cx("size-2 rounded-full", i === 0 ? "bg-brand-600" : "bg-neutral-300")} /><span className="min-w-0 flex-1 truncate">{n}</span><span className="text-[11px] font-bold text-neutral-400 tabular-nums">{p}</span></span>)}
                        <span className="mt-4 flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase"><span className="size-1.5 animate-pulse rounded-full bg-heart" />Just now</span>
                        <ul className="flex flex-col gap-1.5">
                            <AnimatePresence initial={false}>
                                {feed.slice(0, 3).map((f) => (
                                    <motion.li key={f.k} layout initial={{ opacity: 0, y: -12, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ type: "spring", bounce: 0.35 }} className="flex items-center gap-2 rounded-xl bg-neutral-50 p-2 text-xs">
                                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-pop-100 text-[10px] font-bold text-brand-900">{f.who.slice(0, 2).toUpperCase()}</span>
                                        <span className="min-w-0 flex-1 leading-tight"><b className="block truncate">{f.who} · {usd(f.usd)}</b><span className="block truncate text-neutral-500">to {f.to}</span></span>
                                    </motion.li>
                                ))}
                            </AnimatePresence>
                        </ul>
                    </aside>
                    <section className="flex flex-col gap-4 p-4 md:p-6 lg:pr-44">
                        <div className="flex items-center gap-4">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">Clean water appeal<AnimatePresence>{flash > 0 && <motion.span key={flash} initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: -4 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", bounce: 0.6 }} className="rounded-full bg-pop-300 px-2 py-0.5 text-[11px] font-bold text-brand-950">New #1!</motion.span>}</AnimatePresence></div>
                                <motion.div key={total} initial={{ color: "#2b59ff" }} animate={{ color: "#121830" }} transition={{ duration: 0.8 }} className="font-bubble text-4xl leading-tight font-bold tabular-nums md:text-5xl">{usd(total)}</motion.div>
                                <div className="text-xs text-neutral-500">raised of <b className="text-neutral-700">{usd(GOAL)}</b></div>
                            </div>
                            <span className="relative flex size-16 shrink-0 items-center justify-center"><span className="absolute inset-0 [&>svg]:size-16"><Ring pct={pct} /></span><span className="font-bubble text-sm font-bold text-brand-700">{pct}%</span></span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {stats.map(([k, v]) => <div key={k} className="min-w-0 rounded-2xl bg-white p-2.5 ring-1 ring-neutral-100 md:p-3"><div className="truncate text-[10px] font-semibold text-neutral-400 md:text-[11px]">{k}</div><div className="font-bubble text-md font-bold tabular-nums md:text-lg">{v}</div></div>)}
                        </div>
                        <ol className="flex flex-col gap-1.5">
                            {rows.map((r, i) => (
                                <motion.li layout key={r.id} transition={{ type: "spring", bounce: 0.3, duration: 0.7 }} className={cx("relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5", i === 0 ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30" : "bg-white ring-1 ring-neutral-100")}>
                                    {/* How close this row is to #1, drawn behind it. */}
                                    {i > 0 && <motion.span aria-hidden="true" className="absolute bottom-0 left-0 h-[3px] rounded-r-full bg-gradient-to-r from-brand-300 to-pop-300" animate={{ width: `${(r.usd / lead) * 100}%` }} transition={{ type: "spring", bounce: 0 }} />}
                                    <span className={cx("relative w-5 font-bubble text-lg font-bold", i === 0 ? "text-white" : "text-neutral-400")}>{i + 1}</span>
                                    <span className={cx("relative flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-white", r.tone)}>{r.initials}</span>
                                    <span className="relative min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                                    <AnimatePresence>{hit && hit.toId === r.id && <motion.span key={hit.k} initial={{ y: 8, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", bounce: 0.6 }} className="relative rounded-full bg-pop-300 px-2 py-0.5 text-[11px] font-bold text-brand-950">+{usd(hit.usd)}</motion.span>}</AnimatePresence>
                                    <span className={cx("relative font-bubble text-md font-bold tabular-nums", i === 0 ? "text-white" : "text-brand-700")}>{usd(r.usd)}</span>
                                </motion.li>
                            ))}
                        </ol>
                    </section>
                </div>
            </motion.div>
            </motion.div>
        </div>
    );
};

export const ComingSoon = () => {
    const sim = useSim(); const leader = sim.rows[0]; const last = sim.feed[0];
    const [w, setW] = useState(0);
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => { const id = setInterval(() => setW((n) => (n + 1) % WORDS.length), 2200); return () => clearInterval(id); }, []);
    /** A soft light follows the pointer across the blue. Written straight to CSS variables so it never re-renders. */
    const spot = (e: React.PointerEvent) => { root.current?.style.setProperty("--mx", `${e.clientX}px`); root.current?.style.setProperty("--my", `${e.clientY + window.scrollY}px`); };
    return (
        <MotionConfig reducedMotion="user">
            <div ref={root} onPointerMove={spot} className="relative flex min-h-dvh flex-col overflow-hidden bg-brand-600 text-white">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_var(--mx,50%)_var(--my,-20%),rgb(255_255_255/0.13),transparent_70%)] motion-reduce:hidden" />
                <div aria-hidden="true" className="grain pointer-events-none absolute inset-0" />
                <Backdrop />
                <Nav />
                <main className="relative flex flex-1 flex-col items-center gap-8 px-4 pt-10 text-center md:pt-16">
                    <span className={cx(IN, "inline-flex items-center gap-2 rounded-full bg-white/12 py-1 pr-3.5 pl-1 text-xs font-medium whitespace-nowrap ring-1 ring-white/20 ring-inset sm:text-sm")}><span className="rounded-full bg-pop-300 px-2.5 py-0.5 text-xs font-bold text-brand-950">Coming soon</span>Building a better charity experience</span>

                    <div className="relative">
                        {/* Floating stickers either side of the headline, as on the moodboard. Each one can be picked up and thrown. */}
                        {/* They follow the campaign playing in the product window below. */}
                        <Sticker className="top-0 -left-60 -rotate-6" bob="animate-[bob_5s_ease-in-out_infinite]"><span className="flex items-center gap-2.5 rounded-2xl bg-white py-2 pr-4 pl-2 text-brand-700 shadow-xl shadow-brand-950/25"><Ring pct={sim.pct} /><span className="leading-none"><span className="block font-bubble text-2xl font-bold tabular-nums">{sim.pct}%</span><span className="text-[11px] font-semibold text-neutral-500">funded</span></span></span></Sticker>
                        <Sticker className="-right-56 bottom-4 rotate-6" bob="animate-[bob_6s_ease-in-out_infinite_reverse]"><span className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-brand-700 shadow-xl shadow-brand-950/25"><Heart className="size-5 text-heart" /><AnimatePresence mode="wait" initial={false}><motion.span key={last.k} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0, transition: { duration: 0.12 } }} className="font-bubble text-2xl font-bold tabular-nums">+{usd(last.usd)}</motion.span></AnimatePresence></span></Sticker>
                        {/* A white-bordered "photo", like the polaroid on the moodboard. */}
                        <Sticker className="-bottom-28 -left-72 -rotate-[9deg]" bob="animate-[bob_7s_ease-in-out_infinite]">
                            <span className="block w-44 rounded-[22px] bg-white p-2 shadow-2xl shadow-brand-950/30">
                                <span className="relative flex h-32 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-pop-300 via-pop-100 to-brand-200">
                                    <Sparkle className="absolute top-3 right-4 size-4 text-white" /><Sparkle className="absolute bottom-4 left-4 size-3 text-white/80" />
                                    <AnimatePresence mode="popLayout" initial={false}><motion.span key={leader.id} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: "spring", bounce: 0.55 }} className="flex size-16 items-center justify-center rounded-full bg-white font-bubble text-2xl font-bold text-brand-700 shadow-lg ring-4 ring-white/60">{leader.initials}</motion.span></AnimatePresence>
                                    <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white"><Trophy01 className="size-3" />#1</span>
                                </span>
                                <span className="hand block truncate px-1 pt-1.5 pb-0.5 text-center text-xl leading-none text-brand-900">{leader.name.replace(/^The /, "").split(" ")[0]} took #1!</span>
                            </span>
                        </Sticker>
                        <span aria-hidden="true" className="hand absolute -bottom-40 -left-[22rem] hidden -rotate-12 text-lg text-white/70 xl:block">psst… drag us</span>
                        <span aria-hidden="true" className="hand absolute -top-10 right-0 hidden rotate-[8deg] text-2xl text-white/90 lg:block">launching soon!<svg viewBox="0 0 60 40" className="ml-auto h-8 w-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M50 4 C 52 20, 40 30, 14 34" strokeDasharray="4 5" /><path d="M22 28 L13 34 L22 39" /></svg></span>

                        <h1 className={cx(IN, "text-[52px] leading-[0.92] font-extrabold tracking-[-0.045em] delay-100 sm:text-[80px] md:text-[112px]")}>
                            <span className="block">Make every</span>
                            <span className="relative inline-block align-bottom">
                            <span className="relative inline-grid h-[1.02em] justify-items-center overflow-hidden px-1 align-bottom [clip-path:inset(0)]">
                                {/* Every word sits invisibly in the same cell, so the slot is as wide as the longest one and "count." never moves. */}
                                {WORDS.map((x) => <span key={x} aria-hidden="true" className="invisible col-start-1 row-start-1">{x}</span>)}
                                <AnimatePresence mode="popLayout" initial={false}>
                                    <motion.span key={WORDS[w]} initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "-100%", opacity: 0 }} transition={{ type: "spring", bounce: 0.35, duration: 0.6 }} className="col-start-1 row-start-1 text-pop-300">{WORDS[w]}</motion.span>
                                </AnimatePresence>
                            </span>
                            {/* A marker scribble that redraws under each new word. */}
                            <svg aria-hidden="true" viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute -bottom-[0.08em] left-[4%] h-[0.16em] w-[92%] text-white/90"><motion.path key={w} d="M3 13 C 40 5, 80 17, 120 9 S 180 6, 197 11" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }} /></svg>
                            </span>{" "}
                            <motion.span initial={{ scale: 0.2, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1 }} whileHover={{ scale: 1.1, rotate: -7 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", bounce: 0.55, duration: 0.9, delay: 0.45 }} className="bubble inline-block text-brand-600">count.</motion.span>
                        </h1>
                    </div>

                    <p className={cx(IN, "max-w-2xl text-lg text-white/85 delay-200 md:text-xl")}>Crowdfunding rebuilt for charities and the people who raise for them. Live leaderboards, team races and big-screen moments, with far more options than the tools you use today.</p>

                    <div className={cx(IN, "flex w-full justify-center delay-300")}><Waitlist /></div>

                    <div className={cx(IN, "flex w-full justify-center delay-500")}><Marquee /></div>

                    <div className="mt-8 w-full md:mt-12"><Mockup sim={sim} /></div>
                </main>
            </div>
        </MotionConfig>
    );
};

/** What a visitor sees on any page that is not open yet. */
export const ComingSoonGate = () => {
    return (
        <div className="relative flex min-h-dvh flex-col overflow-hidden bg-brand-600 text-white">
            <Backdrop />
            <Nav />
            <main className="relative flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-24 text-center">
                <span className={cx(IN, "flex size-16 items-center justify-center rounded-3xl bg-white text-brand-600 shadow-[0_5px_0_rgb(0_0_0/0.15)]")}><HeartHand className="size-8" /></span>
                <h1 className={cx(IN, "text-[48px] leading-none font-extrabold tracking-[-0.04em] delay-100 md:text-[80px]")}>Coming <span className="bubble inline-block -rotate-3 text-brand-600">soon.</span></h1>
                <p className={cx(IN, "max-w-md text-lg text-white/85 delay-200")}>This part of Outgive isn't open yet. Join the waitlist and we'll let you in first.</p>
                <div className={cx(IN, "flex flex-wrap justify-center gap-2 delay-300")}>
                    <a href="/#join" className="inline-flex h-12 items-center gap-2 rounded-full bg-pop-300 px-6 font-bold text-brand-950 shadow-[0_4px_0_rgb(0_0_0/0.18)] outline-white transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2">Join the waitlist<ArrowRight className="size-4" /></a>
                </div>
            </main>
        </div>
    );
};
