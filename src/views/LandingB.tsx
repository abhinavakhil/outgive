import { type ReactNode, useEffect, useRef, useState } from "react";
import { Container, type Go, Logo, useApp } from "@/components/outgive/shared";
import { LANDING_FAQ } from "@/views/Landing";
import { cx } from "@/utils/cx";

/**
 * A second take on the product page: a full-bleed brand sky that fades to the page, holding a field of light that ripples outward;
 * under it, quiet sections with hairline grids, light numerals and grain-gradient product panels.
 */
const LABEL = "font-mono text-[11px] tracking-[0.12em] uppercase";
const GRAIN = { backgroundImage: "radial-gradient(120% 90% at 85% 10%, var(--color-brand-300) 0, transparent 55%), radial-gradient(90% 90% at 10% 100%, var(--color-brand-200) 0, transparent 50%), linear-gradient(160deg, var(--color-brand-800), var(--color-brand-600))" };
const Ui = ({ className, children }: { className?: string; children: ReactNode }) => <div className={cx("grid gap-2.5 rounded-[10px] bg-primary p-4 text-left text-[13px] text-primary shadow-2xl ring-1 ring-black/5", className)}>{children}</div>;
const R = ({ a, b, strong }: { a: ReactNode; b: ReactNode; strong?: boolean }) => <div className="flex items-center justify-between gap-2.5 tabular-nums"><span className={strong ? "font-medium text-primary" : "text-tertiary"}>{a}</span><b className="font-medium">{b}</b></div>;
const Hr = () => <div className="h-px bg-secondary" />;
const Chip = ({ children }: { children: ReactNode }) => <span className="rounded-[3px] bg-brand-200 px-1.5 py-0.5 font-mono text-[10.5px] tracking-wide text-brand-900 uppercase">{children}</span>;
const Go = ({ children }: { children: ReactNode }) => <div className="rounded-[5px] bg-primary-solid py-2 text-center font-medium text-white">{children}</div>;
const Lb = ({ n, name, pct, amount }: { n: string; name: string; pct: number; amount: string }) => <div className="grid grid-cols-[20px_1fr_auto] items-center gap-2.5"><em className="font-mono text-[11px] text-tertiary not-italic">{n}</em><span>{name}<i className="mt-1.5 block h-1 rounded bg-brand-solid" style={{ width: `${pct}%` }} /></span><b className="font-medium tabular-nums">{amount}</b></div>;

/** Dots on a plane seen in perspective; one gift lands and the ripple travels outward. Still when the visitor prefers reduced motion. */
const Field = () => {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const c = ref.current; const g = c?.getContext("2d"); if (!c || !g) return;
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches; let raf = 0;
        const draw = (ms: number) => {
            const w = (c.width = c.clientWidth); const h = (c.height = c.clientHeight); const t = still ? 2 : ms / 1000;
            for (let z = 0; z < 34; z++) {
                const v = z / 33; const scale = 0.35 + v * 0.9; const y0 = h * (0.5 + v * v * 0.48);
                g.fillStyle = v < 0.62 ? `rgba(255,255,255,${0.8 - v * 0.6})` : `rgba(111,43,32,${0.25 + (v - 0.62) * 0.9})`;
                for (let x = 0; x <= 70; x++) {
                    const u = x / 70 - 0.5; const d = Math.hypot(u * 8, (v - 0.45) * 6);
                    g.beginPath(); g.arc(w / 2 + u * w * 1.25 * scale, y0 - Math.sin(d * 2.4 - t * 1.6) * 16 * Math.exp(-d * 0.35) * scale, 0.8 + v * 1.3, 0, 7); g.fill();
                }
            }
            if (!still) raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, []);
    return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />;
};

const Block = ({ id, tint, dark, children }: { id?: string; tint?: boolean; dark?: boolean; children: ReactNode }) => <section id={id} className={cx("scroll-mt-10 py-16 md:py-28", tint && "border-y border-secondary bg-secondary", dark && "bg-neutral-950 text-neutral-100")}><Container>{children}</Container></section>;
const Head = ({ label, title, sub, center, aside }: { label?: string; title: string; sub?: string; center?: boolean; aside?: ReactNode }) => (
    <div className={cx("mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-12", center && "flex-col items-center text-center")}>
        <div className={cx("grid gap-3.5", center && "justify-items-center")}>{label && <span className={cx(LABEL, "text-tertiary")}>{label}</span>}<h2 className="text-display-sm font-light tracking-tight text-balance md:text-display-md">{title}</h2>{sub && <p className="max-w-[52ch] text-md text-tertiary">{sub}</p>}</div>{aside}
    </div>
);

export const LandingB = () => {
    const { go, href, money } = useApp();
    const [tab, setTab] = useState(0);
    const [raise, setRaise] = useState(200000);
    const [step, setStep] = useState(0);
    useEffect(() => { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; const id = setInterval(() => setStep((s) => (s + 1) % 3), 3600); return () => clearInterval(id); }, [step]);
    const A = ({ to, className, children }: { to: Go; className?: string; children: ReactNode }) => <a href={href(to)} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(to); }} className={cx("outline-focus-ring focus-visible:outline-2", className)}>{children}</a>;
    const white = "inline-flex items-center justify-center bg-white px-5 py-3 font-mono text-[13px] tracking-[0.08em] whitespace-nowrap text-brand-800 uppercase transition hover:-translate-y-px";
    const btn = "inline-flex items-center justify-center rounded-[5px] bg-primary-solid px-4 py-2.5 text-sm font-medium whitespace-nowrap text-white transition hover:-translate-y-px";

    const JOURNEY: [string, string, ReactNode][] = [
        ["Create", "Name your charity, pick a colour, and the board is yours.", <><R a="Charity" b="Clearwell Trust" /><Hr /><R a="Brand" b={<span className="flex gap-1.5">{["bg-brand-600", "bg-[#1f7a4d]", "bg-[#5b4bd6]"].map((c) => <i key={c} className={cx("size-[18px] rounded-full", c)} />)}</span>} /><Hr /><R a="Ranking layout" b="Podium · 1 of 29" /><Hr /><R a="Status" b={<Chip>Ready to share</Chip>} /></>],
        ["Share", "Share one link. Individuals, teams, companies and schools each get their own race.", <><div className="flex items-center justify-between"><b className="font-medium">All-time ranking</b><Chip>Live</Chip></div><Lb n="01" name="Amara Okafor" pct={92} amount={money(18900)} /><Lb n="02" name="Northfield Rotary" pct={82} amount={money(16861)} /><Lb n="03" name="Bluefin Logistics" pct={73} amount={money(15046)} /><Lb n="04" name="St Hilda's Primary" pct={65} amount={money(13430)} /></>],
        ["Claim", "Every rank shows its price. One more than the holder takes the place.", <><div className="grid grid-cols-3 gap-1.5">{[["#3", 15047], ["#2", 16862], ["#1", 18901]].map(([r, v], i) => <span key={r} className={cx("rounded-[5px] py-2 text-center font-medium ring-1 ring-inset", i === 1 ? "bg-primary-solid text-white ring-transparent" : "ring-secondary")}>{r} · {money(v as number)}</span>)}</div><R a="Giving as" b="Team" /><R a="Show my name on the board" b="Yes" /><Hr /><div className="flex items-center justify-between"><b className="font-medium">This puts you at</b><b className="text-2xl font-light tracking-tight">#2 of 32</b></div><Go>Give {money(16862)} and take #2</Go></>],
        ["Climb", "Overtaken? The board prices the way back, and a fundraising page lets friends cover the gap.", <><R strong a="Your place" b="#7 of 32" /><Hr /><R a="The Tuesday Swimmers" b={`${money(1142)} ahead`} /><R a="Raised through your page" b="19 donors" /><R a="Giving streak" b="5 months" /><Hr /><R a="Weekly board" b="Resets Monday" /></>],
    ];
    const HOW: [string, string, ReactNode][] = [
        ["Put your supporters on a board", "Your charity gets one public leaderboard on its own name and colours.", <><R a="Board" b="Clearwell Trust" /><R a="On the board" b="32 supporters" /><R a="Boards" b="All-time · Week · Today" /><Go>Open the board</Go></>],
        ["Every rank shows its price", "A live price sits on every place. Passing someone costs one unit more than they have given.", <><div className="flex items-center justify-between"><b className="font-medium">Take #1</b><Chip>Live price</Chip></div><div className="text-3xl font-light tracking-tight">{money(18901)}</div><R a="Held by Amara Okafor" b={money(18900)} /><Go>Claim rank</Go></>],
        ["People climb by giving and recruiting", "A rank is a supporter's own gifts plus everything their fundraising page brings in.", <><R strong a="Jonas Weber" b="#5" /><R a="Own gifts" b={money(4200)} /><R a="Through his page" b={money(7791)} /><Hr /><R strong a="Counts toward rank" b={money(11991)} /></>],
    ];
    const CAPS: [string, string, ReactNode][] = [
        ["Ranked giving", "A live leaderboard where the next place always has a price.", <><Lb n="01" name="Team Oakfield" pct={92} amount={money(6480)} /><Lb n="02" name="Youth Circle" pct={70} amount={money(4990)} /><Lb n="03" name="Sara's run" pct={46} amount={money(3375)} /></>],
        ["Next rank up", "An ask sized for every donor, not only the one chasing first.", <><R a="You are" b="#27" /><R a="Passes Kofi Mensah" b={money(12)} /><Go>Give {money(12)}</Go></>],
        ["Weekly boards and streaks", "A fresh race every Monday, and credit for giving month after month.", <><div className="grid h-11 grid-cols-8 items-end gap-1">{[30, 40, 48, 58, 66, 78, 88, 100].map((h) => <i key={h} className="rounded-sm bg-brand-solid/85" style={{ height: `${h}%` }} />)}</div><R a="Giving streak" b="8 months" /></>],
        ["Company matching", "A company claims a place by pledging to match gifts up to a cap.", <><R a="Gift" b={money(40)} /><R a="Matched by Bluefin" b={<span className="text-brand-secondary">+ {money(40)}</span>} /><Hr /><R strong a="Charity receives" b={money(80)} /></>],
        ["White label", "Your colours, logo and name on every page.", <><R a="Brand" b={<span className="flex gap-1.5">{["bg-brand-600", "bg-[#2b4bd6]", "bg-[#1f7a4d]"].map((c) => <i key={c} className={cx("size-[18px] rounded-full", c)} />)}</span>} /><R a="Font" b="Yours" /><Go>Claim rank</Go></>],
        ["29 ranking layouts", "From a plain list to a podium, a ladder or a stadium scoreboard.", <><div className="grid grid-cols-3 items-end gap-1.5">{[["2", "h-9 bg-brand-300"], ["1", "h-14 bg-brand-solid text-white"], ["3", "h-6 bg-brand-200"]].map(([n, c]) => <span key={n} className={cx("flex items-start justify-center rounded-t-md pt-0.5 font-semibold", c)}>{n}</span>)}</div><R a="Layout" b="Podium" /></>],
    ];

    return (
        <div className="bg-primary text-primary">
            <section className="relative grid min-h-[min(880px,100dvh)] grid-rows-[auto_1fr_auto] overflow-hidden text-white" style={{ background: "linear-gradient(180deg, var(--color-brand-950) 0%, var(--color-brand-900) 22%, var(--color-brand-800) 40%, var(--color-brand-600) 62%, var(--color-brand-300) 80%, var(--color-brand-100) 90%, var(--color-bg-primary) 100%)" }}>
                <Field />
                {["top-[18px] left-[18px] border-r-0 border-b-0 border-white/45", "top-[18px] right-[18px] border-b-0 border-l-0 border-white/45", "bottom-[18px] left-[18px] border-t-0 border-r-0 border-black/25", "right-[18px] bottom-[18px] border-t-0 border-l-0 border-black/25"].map((c) => <i key={c} aria-hidden="true" className={cx("absolute z-[2] size-[18px] border", c)} />)}
                <header className="relative z-[3] flex items-center justify-between gap-4 px-6 py-6 md:px-[76px] md:py-10">
                    <span className="[&_button]:text-white [&_path]:stroke-white"><Logo onClick={() => go({ name: "landing-b" })} /></span>
                    <ul className="flex gap-1.5 font-mono text-[13px] tracking-[0.1em] uppercase max-md:hidden">{[["#platform", "Platform"], ["#fees", "Fees"], ["#faq", "FAQ"]].map(([h, l]) => <li key={h}><a href={h} className="block px-[18px] py-2.5 opacity-75 hover:opacity-100">{l}</a></li>)}</ul>
                    <A to={{ name: "home" }} className={white}>Live demo</A>
                </header>
                <div className="relative z-[3] grid content-start justify-items-center gap-6 px-4 pt-12 text-center md:pt-28">
                    <h1 className="font-mono text-[clamp(30px,5.2vw,64px)] leading-[1.1] tracking-tight [text-shadow:0_0_28px_rgb(255_255_255/0.35)]">Giving, made a <span className="font-medium text-brand-200 [filter:drop-shadow(0_0_14px_rgb(255_255_255/0.6))]">race</span></h1>
                    <p className="font-mono text-[clamp(15px,1.9vw,21px)] tracking-[0.06em] opacity-90">Every rank has a price</p>
                    <A to={{ name: "home" }} className={white}>See the live board</A>
                </div>
                <div className="relative z-[3] flex flex-wrap items-end justify-between gap-4 px-6 pb-8 font-mono text-[13px] text-primary md:px-[76px] md:pb-12"><span>© 2026 · Outgive</span><div className="flex flex-wrap gap-5"><span><b className="font-medium">0%</b> taken from gifts</span><span><b className="font-medium">29</b> ranking layouts</span></div></div>
            </section>

            <div className="pt-10 md:pt-14"><Container>
                <p className={cx(LABEL, "mb-5 text-center text-tertiary")}>Built for the organisations that run on generosity</p>
                <ul className="grid grid-cols-3 overflow-hidden rounded-lg ring-1 ring-secondary ring-inset md:grid-cols-6">{["Charities", "Schools", "Faith groups", "Hospices", "Food banks", "Relief funds"].map((s) => <li key={s} className="border-secondary px-2.5 py-5 text-center text-lg font-light text-secondary max-md:[&:nth-child(n+4)]:border-t [&:not(:first-child)]:border-l max-md:[&:nth-child(4)]:border-l-0">{s}</li>)}</ul>
            </Container></div>

            <Block id="platform">
                <Head label="In numbers" title="The board supporters want to climb." aside={<A to={{ name: "home" }} className={btn}>Try the demo</A>} />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_1.25fr_1fr]">
                    {[[["0%", "taken from a gift by the board"], ["29", "ranking layouts to choose from"]], null, [["5", "boards: all-time, week, today, recruiters and streaks"], ["12", "fundraising page layouts"]]].map((col, i) => col
                        ? <div key={i} className="grid gap-3">{col.map(([n, l]) => <div key={n} className="grid min-h-[150px] content-between gap-6 rounded-lg bg-secondary p-5 ring-1 ring-secondary ring-inset"><b className="text-[clamp(38px,4.6vw,56px)] leading-none font-light tracking-tight">{n}</b><span className="text-[13.5px] text-tertiary">{l}</span></div>)}</div>
                        : <div key={i} className="grid min-h-80 place-items-center rounded-lg p-5 max-md:order-first max-md:col-span-full md:p-10" style={GRAIN}><Ui className="w-[min(300px,100%)]"><div className="flex items-center justify-between"><b className="font-medium">Clearwell Trust</b><Chip>Live</Chip></div><div className="text-3xl font-light tracking-tight">Take #1 <span className="text-xs text-tertiary">for {money(18901)}</span></div><Hr /><Lb n="01" name="Amara Okafor" pct={100} amount={money(18900)} /><Lb n="02" name="Northfield Rotary" pct={89} amount={money(16861)} /><Go>Claim rank</Go></Ui></div>)}
                </div>
            </Block>

            <section className="pb-16 md:pb-28"><Container>
                <Head center title="One board for giving" sub="Whether you run the appeal or rally support for it, Outgive gives you the same simple tools." />
                <div className="grid gap-3 md:grid-cols-2">{[["01", "For charities", "Run a leaderboard on your own name and colours, see who is giving and what moves them, and let rivalry do the asking.", "See the live board", { name: "home" } as Go], ["02", "For fundraisers", "Open a personal or team page, share one link, and climb the board as gifts arrive.", "Start a page", { name: "create" } as Go]].map(([n, t, d, cta, to]) => (
                    <A key={n as string} to={to as Go} className="group relative grid min-h-[340px] content-start gap-3 overflow-hidden rounded-lg bg-gradient-to-b from-brand-900 to-brand-950 p-7 text-white">
                        <span aria-hidden="true" className="absolute inset-x-[-20%] bottom-[-55%] h-[110%] rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.28),transparent)] transition-transform duration-500 group-hover:-translate-y-[12%]" />
                        <span className={cx(LABEL, "relative text-white/60")}>{n as string}</span><h3 className="relative text-display-xs font-light tracking-tight">{t as string}</h3><p className="relative max-w-[38ch] text-[14.5px] text-white/75">{d as string}</p><span className="relative mt-1.5 justify-self-start rounded-[5px] px-3 py-2 text-[13px] ring-1 ring-white/15 ring-inset">{cta as string}</span>
                    </A>
                ))}</div>
            </Container></section>

            <Block id="journey" tint>
                <Head center label="The appeal journey" title="Create, share, claim and climb" />
                <div role="tablist" aria-label="Journey" className="no-scrollbar mb-8 flex gap-6 overflow-x-auto border-b border-secondary md:mb-12">{JOURNEY.map(([l], i) => <button key={l} type="button" role="tab" aria-selected={tab === i} onClick={() => setTab(i)} className={cx("-mb-px cursor-pointer border-b-2 py-3 text-sm whitespace-nowrap outline-focus-ring focus-visible:outline-2", tab === i ? "border-fg-primary text-primary" : "border-transparent text-tertiary")}>{l}</button>)}</div>
                <p className="mx-auto mb-7 max-w-[26ch] text-center text-2xl leading-tight font-light tracking-tight text-balance md:mb-11 md:text-display-sm">{JOURNEY[tab][1]}</p>
                <div className="grid min-h-80 place-items-center rounded-[10px] p-5 md:min-h-[460px] md:p-14" style={GRAIN}><Ui className="w-[min(440px,100%)]">{JOURNEY[tab][2]}</Ui></div>
            </Block>

            <Block id="fees" dark>
                <div className="grid items-start gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-20">
                    <div className="grid justify-items-start gap-4"><span className={cx(LABEL, "text-neutral-400")}>Fees</span><h2 className="text-display-sm font-light tracking-tight md:text-display-md">Keep more of every gift.</h2><p className="max-w-[52ch] text-md text-neutral-300">The board takes no share of a gift. A bigger appeal means more for the cause, not more for the platform.</p><A to={{ name: "home" }} className="inline-flex rounded-[5px] bg-neutral-50 px-4 py-2.5 text-sm font-medium text-neutral-950">Try the demo</A></div>
                    <div>
                        <div className="border-t border-white/15 py-5"><div className="flex items-baseline justify-between gap-3"><label htmlFor="raise" className="text-[14.5px] text-neutral-300">You raise in a year</label><b className="text-[clamp(34px,5vw,60px)] leading-none font-light tracking-tight tabular-nums">{money(raise)}</b></div>
                            <input id="raise" type="range" min={10000} max={1000000} step={10000} value={raise} onChange={(e) => setRaise(Number(e.target.value))} className="mt-4 w-full cursor-grab accent-brand-400" /></div>
                        {([["Reaches the cause with a 5% platform fee", raise * 0.95, false], ["Reaches the cause with Outgive at 0%", raise, false], ["The difference", raise * 0.05, true]] as [string, number, boolean][]).map(([l, v, hl]) => <div key={l} className="flex items-baseline justify-between gap-4 border-t border-white/15 py-5 last:border-b"><span className="text-[14.5px] text-neutral-300">{l}</span><b className={cx("text-[clamp(34px,5vw,60px)] leading-none font-light tracking-tight tabular-nums", hl && "text-brand-300")}>{money(v)}</b></div>)}
                        <p className="mt-3.5 text-xs text-neutral-500">Illustration only: no share taken from gifts compared with a 5% platform fee, before payment processing and any subscription cost.</p>
                    </div>
                </div>
            </Block>

            <Block>
                <Head center label="What's included" title="Everything a ranked appeal needs" sub="Six tools that turn a list of donors into a contest." />
                <ul className="grid gap-x-3 gap-y-7 sm:grid-cols-2 md:gap-y-9 lg:grid-cols-3">{CAPS.map(([t, d, ui]) => <li key={t} className="group grid content-start gap-2.5"><div className="mb-1.5 grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-secondary p-4 ring-1 ring-secondary transition-colors ring-inset group-hover:bg-brand-primary"><Ui className="w-full max-w-[230px] gap-2 p-3 text-xs shadow-lg transition-transform duration-300 group-hover:-translate-y-1">{ui}</Ui></div><h3 className="text-md font-medium">{t}</h3><p className="text-[13.5px] text-tertiary">{d}</p></li>)}</ul>
            </Block>

            <Block tint>
                <div className="grid items-center gap-6 md:grid-cols-2 md:gap-16">
                    <div className="grid aspect-square max-h-[440px] w-full place-items-center rounded-[10px] bg-brand-200 p-6"><Ui key={step} className="w-[min(300px,100%)] animate-in fade-in duration-300">{HOW[step][2]}</Ui></div>
                    <div><span className={cx(LABEL, "text-tertiary")}>How it works</span><h2 className="mt-3 text-display-sm font-light tracking-tight md:text-display-md">A leaderboard your supporters can act on.</h2>
                        <ol className="mt-6 grid gap-6">{HOW.map(([t, d], i) => <li key={t}><button type="button" aria-current={step === i} onClick={() => setStep(i)} className={cx("grid w-full cursor-pointer grid-cols-[34px_1fr] gap-4 rounded-lg text-left outline-focus-ring transition-opacity focus-visible:outline-2", step !== i && "opacity-45")}><em className={cx("grid size-[34px] place-items-center rounded-full font-mono text-[13px] not-italic ring-1 ring-inset", step === i ? "bg-primary-solid text-white ring-transparent" : "bg-primary ring-secondary")}>{i + 1}</em><span><b className="block text-md font-medium">{t}</b><span className="mt-0.5 block text-sm text-tertiary">{d}</span></span></button></li>)}</ol>
                    </div>
                </div>
            </Block>

            <Block id="faq">
                <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:gap-20">
                    <div className="grid content-start gap-3"><span className={cx(LABEL, "text-tertiary")}>FAQ</span><h2 className="text-display-sm font-light tracking-tight md:text-display-md">Good to know</h2></div>
                    <div>{LANDING_FAQ.map(([q, a], i) => <details key={q} open={i === 0} className="group border-t border-secondary last:border-b"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-[18px] text-md outline-focus-ring focus-visible:outline-2 [&::-webkit-details-marker]:hidden">{q}<span aria-hidden="true" className="font-mono text-tertiary transition-transform group-open:rotate-45">+</span></summary><p className="max-w-[58ch] pb-[18px] text-[14.5px] text-tertiary">{a}</p></details>)}</div>
                </div>
            </Block>

            <section className="relative overflow-hidden bg-brand-950 text-white">
                <svg aria-hidden="true" viewBox="0 0 600 200" fill="none" stroke="currentColor" strokeWidth="1" className="absolute right-0 bottom-0 h-auto w-3/5 text-brand-400 opacity-35"><path d="M0 160C80 160 110 60 190 60s110 90 190 90 110-120 220-120" /><path d="M0 175C80 175 110 85 190 85s110 80 190 80 110-110 220-110" /><path d="M0 190C80 190 110 110 190 110s110 70 190 70 110-100 220-100" /></svg>
                <Container className="relative grid justify-items-start gap-5 py-14 md:py-24"><span className={cx(LABEL, "text-brand-300")}>Get started</span><h2 className="max-w-[14ch] text-display-md font-light tracking-tight md:text-display-xl">Give your next appeal a race worth winning.</h2>
                    <div className="flex flex-wrap gap-2.5"><A to={{ name: "home" }} className="inline-flex rounded-[5px] bg-neutral-50 px-4 py-2.5 text-sm font-medium text-neutral-950">Open the live demo</A><A to={{ name: "create" }} className="inline-flex rounded-[5px] px-4 py-2.5 text-sm font-medium text-white ring-1 ring-white/15 ring-inset">Start a fundraising page</A></div>
                </Container>
            </section>
            <footer className="border-t border-white/15 bg-brand-950 font-mono text-[13px] text-brand-200/80"><Container className="flex flex-wrap justify-between gap-5 pt-7 pb-10"><span>© 2026 · Outgive</span><nav aria-label="Footer" className="flex flex-wrap gap-5"><a href="#platform" className="hover:text-white">Platform</a><a href="#journey" className="hover:text-white">Journey</a><a href="#fees" className="hover:text-white">Fees</a><a href="#faq" className="hover:text-white">FAQ</a><A to={{ name: "terms" }} className="hover:text-white">Terms</A><A to={{ name: "privacy" }} className="hover:text-white">Privacy</A></nav></Container></footer>
        </div>
    );
};
