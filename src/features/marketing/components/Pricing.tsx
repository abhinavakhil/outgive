/**
 * /pricing, in the home page's board-and-paper style, kept to about three screens: hero, plans, one calculator, five questions, call to action.
 * One product, two ways to pay for it: tips on (donors can add an optional tip, 0% platform fee) or tips off (a platform fee from each gift).
 * Fundraisers never pay. Anything not decided yet is a [bracketed placeholder].
 */
import { type ReactNode, useRef, useState } from "react";
import { Coin, GiftBox, Label, Mark, Star, useMotion } from "@/features/launch";
import { CARD_FEE_FIXED, CARD_FEE_PCT, DEFAULT_TIP_PCT, fmt, TIP_CHOICES } from "@/shared/lib/money";
import { cx } from "@/shared/utils/cx";
import { estimate, TIPS_OFF_FEE_BPS } from "../pricing-calc";
import "./pricing.css";

const FEE_PCT = TIPS_OFF_FEE_BPS / 100;
/** Stripe's standard card rate as the checkout estimates it. */
const CARD_RATE = `${CARD_FEE_PCT}% + ${CARD_FEE_FIXED}p`;
const NAV: [string, string][] = [["Home", "/"], ["Plans", "#plans"], ["Calculator", "#calculator"], ["FAQ", "#faq"], ["Demo", "/demo"]];
const FRAME = "mx-auto max-w-[1180px] scroll-mt-4 border-x border-(--rd-rule) sm:mx-8 xl:mx-auto";
const gbp = (cents: number) => fmt(cents, "GBP", { maximumFractionDigits: 0 });
const d = (n: number) => ({ ["--d" as string]: n });

/** The two ways a charity can fund Outgive. `rows` is who pays what: the charity, its donors, and Stripe. */
interface Plan { name: string; who: string; price: string; unit: string; rows: [string, string][]; best?: boolean }
const STRIPE_ROW: [string, string] = ["Stripe", `About ${CARD_RATE} card processing (estimate)`];
const PLANS: Plan[] = [
    { name: "Tips on", who: "The default, for most charities and mosques", price: "0%", unit: "platform fee", best: true, rows: [["Charity", "No platform fee, no setup fee, no monthly fee"], ["Donors", `Can add an optional tip, ${DEFAULT_TIP_PCT}% suggested, on top of the gift`], STRIPE_ROW] },
    { name: "Tips off", who: "For charities that prefer donors never see a tip", price: `${FEE_PCT}%`, unit: "platform fee per gift", rows: [["Charity", `${FEE_PCT}% of each gift, with no setup fee and no monthly fee`], ["Donors", "Never see a tip at checkout"], STRIPE_ROW] },
];

const FAQ: [string, ReactNode][] = [
    ["What does Outgive cost a charity?", <>Nothing to set up and nothing each month. With tips on, the platform fee is 0%: donors can add an optional tip to Outgive at checkout, and that tip is the whole business model. If you switch tips off, a {FEE_PCT}% platform fee is taken from each gift instead. Everything else is the same either way.</>],
    ["Is the tip really optional?", <>Yes. The checkout suggests {DEFAULT_TIP_PCT}% and offers {TIP_CHOICES.filter(Boolean).join("%, ")}% or “No tip”. The tip is added on top of the gift, so it never reduces what the charity receives. A charity can hide it completely by switching tips off in Payments → Fees.</>],
    ["Who pays the card fees?", <>Stripe charges its standard processing rate, around {CARD_RATE} per card payment, lower for registered charities in many countries. It is paid from the charity’s Stripe balance. Donors can tick “cover the fees” at checkout, which adds enough for the charity to still net the full gift. The figures on this page are estimates; your Stripe account shows the real rate.</>],
    ["How does the charity get paid?", <>Every gift goes to the charity’s own Stripe account, and Stripe pays out to the charity’s bank. Outgive never holds the money. You connect Stripe once when you set up your organisation.</>],
    ["What happens with refunds?", <>Refunds and disputes are handled in the charity’s Stripe dashboard. When a gift is refunded in full, the campaign total and the leaderboard update by themselves. [Whether tips and platform fees are returned on a refund]</>],
];

export const Pricing = () => {
    const root = useRef<HTMLDivElement>(null), hero = useRef<HTMLElement>(null);
    useMotion(root, hero);
    const [menu, setMenu] = useState(false);
    return (
        <div id="top" ref={root} className="rd min-h-dvh overflow-x-clip">
            {/* ---------- Hero on the board ---------- */}
            <section ref={hero} className="rd-board relative text-white">
                <header className="relative z-20 mx-auto flex max-w-[1180px] items-center gap-6 border-b border-white/10 px-5 py-4 sm:px-8">
                    <a href="/" className="flex items-center gap-2 text-[19px] font-bold tracking-[-0.02em]"><Mark />Outgive</a>
                    <nav aria-label="Main" className="mx-auto hidden items-center gap-7 text-[14px] text-white/80 lg:flex">{NAV.map(([label, href]) => <a key={label} href={href} className="py-1 hover:text-white">{label}</a>)}</nav>
                    <div className="ml-auto hidden items-center gap-2.5 sm:flex lg:ml-0">
                        <a href="/start" className="rd-btn-yellow rounded-full px-4 py-2 text-[13.5px] font-semibold">Start free</a>
                        <a href="/create" className="rd-btn-dark rounded-full px-4 py-2 text-[13.5px] font-semibold">Start a fundraiser</a>
                    </div>
                    <button type="button" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)} className="ml-auto grid size-11 place-items-center rounded-full bg-white/10 sm:ml-0 lg:hidden">
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d={menu ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    </button>
                </header>
                {menu && <nav aria-label="Mobile" className="relative z-20 mx-5 mb-2 flex flex-col rounded-2xl bg-black/25 p-2 lg:hidden">{NAV.map(([l, h]) => <a key={l} href={h} onClick={() => setMenu(false)} className="rounded-xl px-4 py-3 text-[15px] hover:bg-white/10">{l}</a>)}<a href="/start" className="rd-btn-yellow mt-1 rounded-full px-4 py-3 text-center text-[15px] font-semibold sm:hidden">Start free</a></nav>}

                <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8">
                    <div aria-hidden="true" className="absolute inset-x-5 top-0 bottom-0 sm:inset-x-8">
                        <div className="rd-grid absolute inset-y-0 left-0 w-[12%] border-r border-white/10" />
                        <div className="rd-grid absolute inset-y-0 right-0 w-[12%] border-l border-white/10" />
                    </div>
                    <div className="relative flex flex-col items-center px-2 pt-10 pb-20 text-center sm:pt-14 sm:pb-24">
                        <span className="rd-in inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 py-1 pr-1 pl-3 text-[12.5px] font-medium backdrop-blur" style={d(0)}>Pricing<span className="rounded-full bg-[#ff8cc6] px-2 py-0.5 text-[11px] font-semibold text-[#1b1c1a]">Tip-funded</span></span>
                        <h1 className="rd-in mt-5 text-[40px] leading-[1.02] tracking-[-0.02em] sm:text-[72px]" style={d(1)}>Free to start.<br /><span className="rd-accent text-[#f2dc3b]">Fair</span> when you grow.</h1>
                        <p className="rd-in mt-5 max-w-[46ch] text-[16px] leading-relaxed text-white/75 sm:text-[18px]" style={d(2)}>No setup fee, no monthly fee, and a 0% platform fee when donors can add a tip.</p>
                    </div>
                    <GiftBox style={{ ["--k" as string]: "20px" }} className="rd-par rd-float pointer-events-none absolute top-8 -right-6 hidden w-[120px] [--r:10deg] lg:block" />
                    <Coin style={{ ["--k" as string]: "26px" }} className="rd-par pointer-events-none absolute top-[96px] left-[6%] hidden w-[60px] -rotate-12 lg:block" />
                    <Star style={{ ["--k" as string]: "10px" }} className="rd-par pointer-events-none absolute right-[14%] bottom-[56px] hidden w-[48px] xl:block" />
                </div>
            </section>

            {/* ---------- The paper sheet ---------- */}
            <main className="rd-sheet relative z-10 -mt-10 rounded-t-[44px] bg-(--rd-paper) sm:rounded-t-[64px]">
                {/* plans: the two ways to fund it, then fundraisers and large charities in a slimmer row */}
                <section id="plans" aria-labelledby="pr-plans" className="mx-auto max-w-[1180px] scroll-mt-4 px-4 pt-8 pb-12 sm:px-8 sm:pt-12 sm:pb-14">
                    <h2 id="pr-plans" className="sr-only">Plans</h2>
                    <div className="rd-in grid items-stretch gap-4 md:grid-cols-2 lg:gap-5">
                        {PLANS.map((p) => (
                            <article key={p.name} aria-label={p.name} className={cx("rd-lift relative flex flex-col overflow-hidden rounded-[28px] p-7 sm:p-9", p.best ? "rd-board text-white shadow-[0_24px_48px_rgb(74_29_107/0.3)]" : "border border-(--rd-rule) bg-white shadow-[0_16px_36px_rgb(0_0_0/0.05)]")}>
                                {p.best && <div aria-hidden="true" className="rd-grid absolute inset-0 opacity-50" />}
                                <div className="relative flex min-h-7 flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-[20px] leading-tight">{p.name}</h3>
                                    {p.best && <span className="rounded-full bg-[#f2dc3b] px-2.5 py-1 text-[11.5px] font-semibold text-[#1b1c1a] shadow-[0_2px_0_#ff7eb6]">Recommended</span>}
                                </div>
                                <p className={cx("relative mt-1 text-[14.5px] leading-snug", p.best ? "text-white/70" : "text-(--rd-ink-2)")}>{p.who}</p>
                                <p className="relative mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <span className={cx("text-[84px] leading-[0.85] font-bold tracking-[-0.05em] tabular-nums sm:text-[104px]", p.best && "text-[#f2dc3b]")}>{p.price}</span>
                                    <span className={cx("text-[15px]", p.best ? "text-white/75" : "text-(--rd-ink-2)")}>{p.unit}</span>
                                </p>
                                <dl className={cx("relative mt-7 mb-7 text-[14.5px] leading-snug", p.best ? "text-white/90" : "text-(--rd-ink)")}>
                                    {p.rows.map(([k, v]) => (
                                        <div key={k} className={cx("flex gap-4 border-t py-3", p.best ? "border-white/15" : "border-(--rd-rule)")}>
                                            <dt className={cx("rd-mono w-[68px] flex-none pt-[3px] text-[11px] uppercase", p.best ? "text-[#f2dc3b]" : "text-(--rd-mono)")}>{k}</dt>
                                            <dd>{v}</dd>
                                        </div>
                                    ))}
                                </dl>
                                <a href="/start" className={cx("relative mt-auto flex min-h-12 items-center justify-center rounded-full px-5 text-[15px] font-semibold", p.best ? "rd-btn-yellow" : "rd-btn-dark")}><span className="sr-only">{p.name}: </span>Start free</a>
                            </article>
                        ))}
                    </div>
                    <div className="rd-reveal mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[1.35fr_1fr] lg:gap-5">
                        <article aria-label="Fundraisers" className="relative flex flex-wrap items-center gap-x-6 gap-y-4 overflow-hidden rounded-[24px] bg-[#fbeaf2] p-6 sm:px-8">
                            <div aria-hidden="true" className="rd-cross absolute inset-0 opacity-40" />
                            <p className="relative text-[52px] leading-none font-bold tracking-[-0.05em] text-[#b2306f] tabular-nums">£0</p>
                            <div className="relative min-w-[200px] flex-1">
                                <h3 className="text-[18px] leading-tight">Fundraisers never pay</h3>
                                <p className="mt-1 max-w-[40ch] text-[14px] leading-snug text-(--rd-ink-2)">A fundraising page is free, and every gift goes straight to the charity’s own Stripe account, never through you.</p>
                            </div>
                            <a href="/create" className="rd-btn-dark relative flex min-h-11 items-center rounded-full px-5 text-[14px] font-semibold whitespace-nowrap">Start a fundraiser</a>
                        </article>
                        <article aria-label="Enterprise" className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[24px] border border-dashed border-[#bdbab2] p-6 sm:px-8">
                            <div className="min-w-[180px] flex-1">
                                <h3 className="text-[18px] leading-tight">[Enterprise / large charities]</h3>
                                <p className="mt-1 text-[14px] leading-snug text-(--rd-ink-2)">[Enterprise price] · [Enterprise billing terms]</p>
                            </div>
                            <a href="mailto:hello@outgive.tech?subject=Outgive%20for%20large%20charities" className="rd-btn-grey flex min-h-11 items-center rounded-full px-5 text-[14px] font-semibold whitespace-nowrap">Talk to us</a>
                        </article>
                    </div>
                    <p className="rd-reveal mt-6 text-center text-[13.5px] text-(--rd-ink-2)">Every feature is included either way. Switch between tips on and tips off whenever you like in Payments → Fees.</p>
                </section>

                <section id="calculator" aria-labelledby="pr-calculator" className={FRAME}>
                    <div className="border-t border-(--rd-rule) p-4 sm:p-6"><Calculator /></div>
                </section>

                <section id="faq" aria-labelledby="pr-faq" className={FRAME}>
                    <div className="grid gap-8 border-t border-(--rd-rule) px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[0.8fr_1.5fr] lg:gap-10">
                        <div className="rd-reveal px-1 sm:px-3">
                            <Label align="left">Questions</Label>
                            <h2 id="pr-faq" className="mt-3 text-[34px] leading-[1.04] sm:text-[44px]">Pricing, answered</h2>
                            <p className="mt-4 max-w-[34ch] text-[15.5px] leading-relaxed text-(--rd-ink-2)">The short version: charities start free, donors choose whether to tip, and fundraisers never pay.</p>
                            <a href="/faq" className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-[14.5px] font-semibold text-(--rd-green) underline decoration-[#d9b8ec] decoration-2 underline-offset-4 hover:decoration-(--rd-green)">All questions<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></a>
                        </div>
                        <Faq />
                    </div>
                </section>
                <div className="h-16" />
            </main>

            {/* ---------- Call to action and footer on the board ---------- */}
            <footer className="rd-board relative -mt-12 overflow-hidden pt-12 text-white">
                <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8">
                    <div aria-hidden="true" className="rd-grid h-10 border-x border-white/10" />
                    <div className="rd-check rd-reveal relative flex flex-wrap items-center justify-between gap-6 border border-white/10 px-6 py-12 sm:px-10">
                        <div>
                            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11.5px] font-medium tracking-wide uppercase">Free to start</span>
                            <h2 className="mt-4 max-w-[20ch] text-[30px] leading-[1.12] sm:text-[36px]">Ready to launch your <span className="text-[#f2dc3b]">Ramadan appeal?</span></h2>
                        </div>
                        <div className="flex flex-wrap gap-2.5"><a href="/start" className="rd-btn-yellow flex min-h-11 items-center rounded-full px-5 text-[14px] font-semibold">Start free</a><a href="/create" className="rd-btn-dark flex min-h-11 items-center rounded-full px-5 text-[14px] font-semibold">Start a fundraiser</a></div>
                        <Star className="pointer-events-none absolute -top-[78px] right-4 w-[64px] sm:right-12" />
                    </div>
                    <div aria-hidden="true" className="rd-grid h-10 border-x border-white/10" />
                    <div className="flex flex-wrap items-center justify-between gap-4 border border-white/10 px-6 py-5 text-[13px] text-white/60 sm:px-8">
                        <a href="/" className="flex items-center gap-2 text-[17px] font-bold text-white"><Mark />Outgive</a>
                        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">{([["Home", "/"], ["Demo", "/demo"], ["Blog", "/blog"], ["FAQ", "/faq"], ["Terms", "/terms"], ["Privacy", "/privacy"], ["Contact", "mailto:hello@outgive.tech"]] as const).map(([l, h]) => <a key={l} href={h} className="py-1 hover:text-white">{l}</a>)}</nav>
                        <span>© {new Date().getFullYear()} Outgive. All rights reserved.</span>
                    </div>
                </div>
                <div className="h-8" />
            </footer>
        </div>
    );
};

/* ---------- pieces ---------- */

const RAISED_MIN = 1000, RAISED_MAX = 250000;
/** The calculator's fixed assumptions: every gift is this size, paid by card, and with tips on donors add the suggested tip. */
const AVG_GIFT = 25;
/** [key, label, amount, colour, shown value] for the breakdown bar and its legend. */
type Part = [string, string, number, string, string];

/** One card: a slider and the tips switch on the left, what the charity receives on the right. Amounts are in pounds here and pence in the maths. */
const Calculator = () => {
    const [raised, setRaised] = useState(25000), [tipsOn, setTipsOn] = useState(true);
    const e = estimate({ raisedCents: raised * 100, avgGiftCents: AVG_GIFT * 100, tipsOn, tipPct: DEFAULT_TIP_PCT, cover: false });
    const share = (n: number) => `${e.donorsPay ? (n / e.donorsPay) * 100 : 0}%`;
    const parts: Part[] = [
        ["stripe", `Stripe card fees, about ${CARD_RATE}`, e.stripeFee, "#8fb8a0", `−${gbp(e.stripeFee)}`],
        ["fee", `Outgive platform fee (${tipsOn ? 0 : FEE_PCT}%)`, e.platformFee, "#ff8cc6", tipsOn ? gbp(0) : `−${gbp(e.platformFee)}`],
        ["tips", tipsOn ? `Optional tips to Outgive, on top (${DEFAULT_TIP_PCT}% suggested)` : "Tips to Outgive (off)", e.tips, "#d6b4f7", gbp(e.tips)],
    ];
    return (
        <div className="rd-reveal grid overflow-hidden rounded-[32px] border border-(--rd-rule) bg-white shadow-[0_1px_0_#fff_inset,0_30px_60px_-30px_rgb(0_0_0/0.18)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <form onSubmit={(ev) => ev.preventDefault()} className="flex flex-col p-7 sm:p-10">
                <Label align="left">Calculator</Label>
                <h2 id="pr-calculator" className="mt-3 text-[32px] leading-[1.04] sm:text-[42px]">See what your appeal keeps</h2>
                <label htmlFor="pr-raised" className="mt-8 text-[15px] font-semibold text-(--rd-ink-2)">If your appeal raises</label>
                <div className="relative mt-2 pt-14" style={{ ["--f" as string]: (raised - RAISED_MIN) / (RAISED_MAX - RAISED_MIN) }}>
                    <output htmlFor="pr-raised" className="pr-bubble absolute top-0 -translate-x-1/2 rounded-[14px] bg-(--rd-ink) px-3.5 py-2 text-[22px] leading-none font-bold tracking-[-0.02em] whitespace-nowrap text-white tabular-nums shadow-[0_8px_18px_rgb(0_0_0/0.18)]">{gbp(raised * 100)}</output>
                    <span aria-hidden="true" className="pr-caret absolute top-[34px] size-3 -translate-x-1/2 rotate-45 rounded-[2px] bg-(--rd-ink)" />
                    <input id="pr-raised" type="range" min={RAISED_MIN} max={RAISED_MAX} step={1000} value={raised} onChange={(ev) => setRaised(Number(ev.target.value))} aria-valuetext={`${gbp(raised * 100)} raised`} className="pr-range" />
                    <div aria-hidden="true" className="rd-mono flex justify-between text-[11px] text-(--rd-ink-2)"><span>{gbp(RAISED_MIN * 100)}</span><span>{gbp(RAISED_MAX * 100)}</span></div>
                </div>
                <div className="mt-6 border-y border-(--rd-rule) lg:mt-auto">
                    <button type="button" role="switch" aria-checked={tipsOn} onClick={() => setTipsOn(!tipsOn)} className="group flex min-h-11 w-full items-center justify-between gap-4 py-4 text-left">
                        <span><span className="block text-[16px] font-bold tracking-[-0.01em]">Donor tips</span><span className="block text-[13.5px] text-(--rd-ink-2)">{tipsOn ? "On: 0% platform fee" : `Off: ${FEE_PCT}% platform fee from each gift`}</span></span>
                        <span aria-hidden="true" className={cx("flex h-7 w-12 flex-none items-center rounded-full p-0.5 transition-colors duration-300", tipsOn ? "bg-(--rd-green)" : "bg-[#cfccc4] group-hover:bg-[#bfbcb4]")}><span className={cx("size-6 rounded-full bg-white shadow transition-transform duration-300 motion-reduce:transition-none", tipsOn && "translate-x-5")} /></span>
                    </button>
                </div>
            </form>

            <div className="p-3 pt-0 lg:pt-3 lg:pl-0">
                <div aria-live="polite" className="rd-board relative flex h-full flex-col overflow-hidden rounded-[22px] p-6 text-white sm:p-9">
                    <div aria-hidden="true" className="rd-grid absolute inset-0 opacity-50" />
                    <p className="rd-mono relative text-[11.5px] text-[#f2dc3b] uppercase">Your charity receives (estimate)</p>
                    {/* the exact figure at once: a counting animation here disagreed with the breakdown below while it settled */}
                    <output data-out="charity" className="relative mt-3 block text-[60px] leading-[0.95] font-bold tracking-[-0.045em] tabular-nums sm:text-[88px]">{gbp(e.charity)}</output>
                    <p className="relative mt-3 text-[14.5px] text-white/70">from {gbp(e.raised)} given, as about {e.gifts.toLocaleString("en-GB")} card {e.gifts === 1 ? "gift" : "gifts"} of £{AVG_GIFT}</p>
                    <div aria-hidden="true" className="relative mt-7 flex h-2.5 gap-[3px] overflow-hidden rounded-full">
                        {([["charity", "", e.charity, "#f2dc3b", ""], ...parts] as Part[]).map(([k, , n, c]) => <span key={k} className="rounded-[3px] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: share(n), background: c, marginLeft: n ? undefined : -3 }} />)}
                    </div>
                    <dl className="relative mt-4 flex flex-col divide-y divide-white/12 text-[14px]">
                        {parts.map(([k, label, , c, v]) => (
                            <div key={k} className="flex items-center justify-between gap-4 py-2.5"><dt className="flex items-center gap-2.5 text-white/80"><span aria-hidden="true" className="size-2.5 flex-none rounded-[3px]" style={{ background: c }} />{label}</dt><dd data-out={k} className="font-semibold whitespace-nowrap tabular-nums">{v}</dd></div>
                        ))}
                    </dl>
                    <p className="relative mt-auto pt-4 text-[12.5px] leading-relaxed text-white/60">An estimate at Stripe’s standard rate; yours may be lower. Tips are optional, so the real figure depends on what donors choose.</p>
                </div>
            </div>
        </div>
    );
};

/** One answer open at a time; the panel's height eases with a grid row from 0fr to 1fr. */
const Faq = () => {
    const [open, setOpen] = useState(0);
    return (
        <div className="rd-reveal self-start overflow-hidden rounded-[24px] border border-(--rd-rule) bg-white" style={d(1)}>
            {FAQ.map(([q, a], i) => (
                <div key={q} className="border-b border-(--rd-rule) last:border-b-0">
                    <h3 className="text-[16.5px] tracking-[-0.015em]">
                        <button type="button" id={`pr-q${i}`} aria-expanded={open === i} aria-controls={`pr-a${i}`} onClick={() => setOpen(open === i ? -1 : i)} className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left font-bold transition-colors hover:bg-[#faf9f6] sm:px-7">
                            {q}
                            <span aria-hidden="true" className={cx("grid size-8 flex-none place-items-center rounded-full transition duration-300 motion-reduce:transition-none", open === i ? "rotate-45 bg-(--rd-ink) text-white" : "bg-(--rd-paper) text-(--rd-ink)")}><svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg></span>
                        </button>
                    </h3>
                    <div id={`pr-a${i}`} role="region" aria-labelledby={`pr-q${i}`} className={cx("grid transition-[grid-template-rows,visibility] duration-300 ease-out motion-reduce:transition-none", open === i ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]")}>
                        <div className="min-h-0 overflow-hidden"><p className="max-w-[68ch] px-5 pb-6 text-[15px] leading-relaxed text-(--rd-ink-2) sm:px-7">{a}</p></div>
                    </div>
                </div>
            ))}
        </div>
    );
};
