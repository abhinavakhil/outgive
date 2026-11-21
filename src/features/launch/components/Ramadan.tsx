/**
 * / (and /ramadan): the page that sells Outgive as a Ramadan giving platform to charities, mosques and fundraisers.
 * The V8 "orchid pink" design: a purple board (hero, call to action, footer) around a lilac paper sheet
 * (appeal types, essentials, who it's for, the live donate page, why Outgive). The desk props are drawn in props.tsx, so the page needs no images.
 */
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { Facebook, Instagram, X } from "@/shared/ui";
import { cx } from "@/shared/utils/cx";
import { Beads, BinderClip, Crescent, Folder, Lantern, Paperclip, Pencil } from "./props";
import "./ramadan.css";

const NAV: [string, string][] = [["Home", "#top"], ["Features", "#give"], ["Who it’s for", "#who"], ["How it works", "#how"], ["Pricing", "/pricing"], ["Demo", "/demo"]];
/** The three donate-page layouts (the checkout_layout flag). */
const LAYOUTS = [["hero", "Hero stage", "A big amount dial with the impact beside it"], ["pledge", "Pledge", "The gift reads as one sentence with tappable words"], ["ticket", "Gift ticket", "One question at a time, with a ticket that becomes the receipt"]] as const;
type LayoutId = (typeof LAYOUTS)[number][0];
const donateHref = (layout: LayoutId, appeal = "Raise £250,000 for clean water this Ramadan") => `/checkout?${new URLSearchParams({ checkout_layout: layout, appeal })}`;

/** The switches under the "describe your appeal" box: they turn those parts of the donate page on or off. */
const SWITCHES = ["Gift Aid", "Matched giving"];
/** Example appeals: pressing one writes it into the box. */
const EXAMPLES: [string, string][] = [["Water wells", "Raise £250,000 for clean water this Ramadan"], ["Last 10 Nights", "Give every night of the Last 10 Nights for orphan care"], ["Iftar meals", "Fund 5,000 iftar meals at our masjid this Ramadan"]];
/** The appeal types in the strip under the hero, each with a line icon (a 24px path). */
const APPEALS: [string, string][] = [
    ["Mosques", "M3 20h18M5 20v-7h14v7M7 13a5 5 0 0110 0M12 8V5M10 20v-2.5a2 2 0 014 0V20"],
    ["Water wells", "M12 3.5s6 6.2 6 10.7a6 6 0 01-12 0c0-4.5 6-10.7 6-10.7zM9.2 14.8a2.8 2.8 0 002.8 2.8"],
    ["Orphan care", "M12 20.2l-1.2-1.1C6 14.9 3.5 12.6 3.5 9.6a4.1 4.1 0 014.1-4.1c1.7 0 3.3.9 4.4 2.3 1.1-1.4 2.7-2.3 4.4-2.3a4.1 4.1 0 014.1 4.1c0 3-2.5 5.3-7.3 9.5z"],
    ["Food packs", "M3.5 9.5h17l-1.6 10H5.1zM8 9.5l2.2-5M16 9.5l-2.2-5M9.5 13.2v3M14.5 13.2v3"],
    ["Emergencies", "M12 4l8.5 15h-17zM12 10v4M12 16.8v.2"],
    ["Education", "M2.5 9L12 4.5 21.5 9 12 13.5zM6.5 11v4.5c3 2.3 8 2.3 11 0V11M21.5 9v5.5"],
];
const FRAME = "mx-auto max-w-[1240px] border-x border-(--rd-rule)";
const AUDIENCES = [
    { id: "charity", tag: "Charities and mosques", icon: APPEALS[0][1], title: "Your whole Ramadan, in one place", body: "Run your appeal, the fundraising pages under it and your live nights from one dashboard.", points: ["A Ramadan campaign page for your Zakat, Sadaqah or iftar appeal", "Supporters start their own fundraising pages under your appeal", "Team races, live iftar screens and leaderboards", "Payouts to your own Stripe account, with Gift Aid"], cta: ["Start your appeal", "/start"], alt: ["See a live leaderboard", "/demo"] },
    { id: "fundraiser", tag: "Fundraisers", icon: APPEALS[2][1], title: "Raise for a cause you love", body: "Anyone can start a page in a couple of minutes and take donations. Every gift is paid straight to the charity.", points: ["Pick a charity, set a goal and tell your story", "Share one link on WhatsApp, Instagram and the masjid group", "Take donations from family and friends, paid straight to the charity", "Climb the leaderboard as your page grows"], cta: ["Start a fundraiser", "/create"], alt: ["See a sample page", donateHref("ticket", "Amina’s Ramadan walk for water")] },
] as const;
const STEPS = [
    ["Create your page", "Pick your cause, add your story and photos, set a goal. It takes about two minutes."],
    ["Share it", "One link and a QR code for WhatsApp, your socials and the masjid noticeboard."],
    ["Take donations", "Card, Apple Pay, Google Pay, PayPal and Direct Debit, with receipts sent for you."],
] as const;

const d = (n: number) => ({ "--d": n }) as CSSProperties;
const k = (n: number) => ({ "--k": `${n}px` }) as CSSProperties;
const PILL = "inline-flex items-center rounded-full font-medium whitespace-nowrap";
const BADGE = "inline-flex items-center gap-2.5 rounded-full border border-white/14 bg-white/10 py-[5px] pr-1.5 pl-4";
const LIVE = "rounded-full bg-(--rd-gold) px-2.5 py-1 text-[13px] leading-none font-semibold text-[#2A2400] normal-case";

export const Ramadan = () => {
    const [ask, setAsk] = useState(EXAMPLES[0][1]);
    const [menu, setMenu] = useState(false);
    const [picked, setPicked] = useState<string[]>(SWITCHES);
    const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
    /** Opens the donate app with this appeal: the text becomes the campaign title, the switches turn Gift Aid and matching on or off. */
    const start = () => {
        const q = new URLSearchParams({ appeal: ask.trim() });
        if (!picked.includes("Gift Aid")) q.set("giftaid", "0");
        if (!picked.includes("Matched giving")) q.set("match", "0");
        window.location.href = `/checkout?${q}`;
    };
    const root = useRef<HTMLDivElement>(null), hero = useRef<HTMLElement>(null);
    useMotion(root, hero);
    return (
        <div id="top" ref={root} className="rd rd-home min-h-dvh overflow-x-clip">
            {/* ---------- Hero on the board ---------- */}
            <section ref={hero} className="rd-board relative overflow-hidden rounded-[22px] pb-[104px] text-white sm:rounded-[28px] sm:pb-[152px]">
                <header className="relative z-20 mx-auto flex max-w-[1320px] items-center justify-between gap-4 border-b border-white/10 px-[clamp(16px,4vw,64px)] py-4 sm:py-[22px]">
                    <a href="/" className="flex items-center gap-2.5 text-[24px] font-semibold tracking-[-0.6px] sm:text-[26px]"><Mark size={28} />Outgive</a>
                    <nav aria-label="Main" className="hidden items-center gap-3.5 xl:flex">
                        {NAV.map(([label, href], i) => <a key={label} href={href} aria-current={i === 0 ? "page" : undefined} className={cx("border-b-2 px-2 py-2.5 text-[16.5px] hover:text-white", i === 0 ? "border-white text-white" : "border-transparent text-white/86")}>{label}</a>)}
                    </nav>
                    <div className="ml-auto hidden gap-3 sm:flex xl:ml-0">
                        <a href="/start" className={cx(PILL, "rd-btn-yellow min-h-[50px] px-[22px] text-[17px]")}>Start free</a>
                        <a href="/create" className={cx(PILL, "rd-btn-dark min-h-[50px] px-[22px] text-[17px]")}>Start a fundraiser</a>
                    </div>
                    <button type="button" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)} className="grid size-11 flex-none place-items-center rounded-full bg-white/10 xl:hidden">
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d={menu ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    </button>
                </header>
                {menu && <nav aria-label="Mobile" className="relative z-20 mx-4 mt-2 flex flex-col rounded-2xl bg-black/25 p-2 xl:hidden">{NAV.map(([l, h]) => <a key={l} href={h} onClick={() => setMenu(false)} className="rounded-xl px-4 py-3 text-[16px] hover:bg-white/10">{l}</a>)}<a href="/start" className={cx(PILL, "rd-btn-yellow mt-1 min-h-12 justify-center px-4 text-[16px] sm:hidden")}>Start free</a><a href="/create" className={cx(PILL, "rd-btn-dark mt-2 min-h-12 justify-center px-4 text-[16px] sm:hidden")}>Start a fundraiser</a></nav>}

                <div className="relative mx-auto max-w-[1320px] px-[clamp(16px,4vw,64px)]">
                    {/* the cutting mat: gridded side columns, a clear centre */}
                    <div aria-hidden="true" className="rd-grid rd-mat absolute max-sm:hidden inset-x-[clamp(16px,8vw,150px)] top-0 bottom-[74px] border-x border-white/10" />

                    <div className="relative flex flex-col items-center gap-[22px] pt-14 pb-12 text-center sm:pt-20 sm:pb-16">
                        <span className={cx(BADGE, "rd-in text-[14.5px] sm:text-[16px]")} style={d(0)}>Free to start · 0% platform fee<span className={LIVE}>Ramadan 1448</span></span>
                        <h1 className="rd-in max-w-[900px] text-[clamp(40px,6.2vw,78px)] leading-[1.04]" style={d(1)}>Make This Ramadan Your Biggest Appeal Yet</h1>
                        <p className="rd-in max-w-[660px] text-[clamp(17px,1.6vw,21px)] leading-[1.55] text-balance text-white/74" style={d(2)}>Launch your donation page in minutes, let supporters fundraise for you, and turn the Last 10 Nights into a live race up the leaderboard. Gift Aid is built in, and every gift goes straight to your charity.</p>

                        {/* the "ask" box: describe the appeal, switch its parts, open the donate page */}
                        <form onSubmit={(e) => { e.preventDefault(); start(); }} className="rd-in rd-ask mt-[26px] w-full max-w-[860px] rounded-[26px] border border-white/16 bg-black/14 text-left shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]" style={d(3)}>
                            <div className="flex flex-col gap-5 px-4 pt-5 pb-[18px] sm:gap-7 sm:px-[22px] sm:pt-[22px]">
                                <label htmlFor="rd-ask" className="sr-only">Describe your Ramadan appeal</label>
                                <textarea id="rd-ask" rows={2} value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); start(); } }} placeholder="What are you raising for this Ramadan?" className="w-full resize-none bg-transparent p-1 text-[17px] leading-normal text-white placeholder:text-white/50 focus:outline-none sm:text-[19px]" />
                                <div className="flex items-center gap-3">
                                    <span aria-hidden="true" className="hidden size-[46px] place-items-center rounded-full border-[1.5px] border-white/55 min-[420px]:grid"><svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span>
                                    <span role="img" aria-label="Works for Zakat, iftar and water appeals" className="flex h-[46px] items-center rounded-full border-[1.5px] border-white/55 px-1.5 max-[419px]:hidden">
                                        <span className="grid size-[34px] place-items-center rounded-full bg-white"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M15.5 3.5A8.5 8.5 0 1020.5 15 7 7 0 0115.5 3.5z" fill="#7A2FA6" /></svg></span>
                                        <span className="-ml-1.5 grid size-[34px] place-items-center rounded-full border-2 border-(--rd-board) bg-(--rd-gold)"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M4 13h16a8 8 0 01-16 0zM12 5v4M8 7l1 2M16 7l-1 2" fill="none" stroke="#2A2400" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
                                        <span className="-ml-1.5 grid size-[34px] place-items-center rounded-full border-2 border-(--rd-board) bg-[#D9ECFF]"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z" fill="#2A6FB8" /></svg></span>
                                    </span>
                                    <button type="submit" className="group ml-auto flex h-[50px] items-center justify-between gap-2.5 rounded-full bg-white pr-1.5 pl-5 text-[16px] font-medium whitespace-nowrap max-[419px]:w-full text-[#17201B] shadow-[0_6px_14px_rgb(0_0_0/0.25)] transition hover:bg-[#f3eef8]">Preview my donate page<span className="grid size-[38px] place-items-center rounded-full bg-(--rd-board) text-white transition group-hover:translate-x-0.5 motion-reduce:transition-none"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span></button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2.5 border-t border-white/14 px-4 py-4 sm:gap-3 sm:px-[22px]">
                                {SWITCHES.map((c) => { const on = picked.includes(c); return (
                                    <button key={c} type="button" aria-pressed={on} onClick={() => toggle(c)} className="rd-chip inline-flex min-h-11 items-center gap-2 rounded-full px-[18px] text-[15px] sm:text-[16px]">
                                        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d={on ? "M5 12.5l4.5 4.5L19 7.5" : "M12 5v14M5 12h14"} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>{c}
                                    </button>
                                ); })}
                                {EXAMPLES.map(([label, text], i) => <button key={label} type="button" aria-label={`Try an example: ${text}`} onClick={() => setAsk(text)} className={cx("min-h-11 rounded-full border border-dashed border-white/35 px-[18px] text-[15px] text-white/80 transition-colors hover:border-white/60 hover:text-white sm:text-[16px]", i === 2 && "max-sm:hidden")}>{label}</button>)}
                            </div>
                        </form>
                        <p className="rd-in -mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[14px] text-white/68" style={d(4)}>{["No setup fee", "No contract", "Paid straight to your Stripe"].map((x) => <span key={x} className="inline-flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>{x}</span>)}</p>
                    </div>

                    {/* the ruler: thirty nights, the last ten picked out */}
                    <div className="relative mx-[clamp(0px,4vw,80px)]">
                        <div aria-hidden="true" className="rd-mono flex justify-between px-0.5 pb-2 text-[10.5px] text-white/62 sm:text-[12px]"><span>NIGHTS OF RAMADAN</span><span className="text-(--rd-gold)">LAST 10 NIGHTS ⟶</span></div>
                        <div role="img" aria-label="A ruler of the 30 nights of Ramadan, with nights 21 to 30 highlighted" className="flex h-[74px] border-y border-white/18 bg-white/[0.03]">
                            {Array.from({ length: 30 }, (_, i) => { const n = i + 1, last = n > 20; return (
                                <div key={n} className={cx("flex min-w-0 flex-1 flex-col justify-between border-l border-white/14 pt-1.5", last && "bg-[rgb(242_220_59/0.07)]")}>
                                    <span className={cx("text-center text-[9px] sm:text-[11px]", last ? "text-(--rd-gold)" : "text-white/62", n % 5 !== 0 && "max-md:invisible")}>{n}</span>
                                    <span className="rd-ticks h-[22px]" />
                                </div>
                            ); })}
                        </div>
                    </div>
                </div>

                {/* desk props */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden xl:block">
                    <Crescent className="rd-par absolute top-[210px] left-[26px] w-[112px] -rotate-[14deg] drop-shadow-[0_18px_22px_rgb(0_0_0/0.35)]" style={k(22)} />
                    <span className="rd-par absolute top-[196px] left-[168px] size-[22px] rounded-full shadow-[4px_8px_8px_rgb(0_0_0/0.35)]" style={{ ...k(30), background: "radial-gradient(circle at 35% 30%, #E8C9A0, #9A6B3F)" }} />
                    <Pencil className="rd-par absolute top-[400px] left-[62px] rotate-[-58deg]" style={{ ...k(14), width: 12, height: 150 }} />
                    <Lantern className="rd-par absolute bottom-[264px] left-[70px] w-[170px] drop-shadow-[0_26px_26px_rgb(0_0_0/0.45)]" style={k(18)} />
                    <Beads className="rd-par absolute bottom-[128px] -left-[28px]" style={k(10)} />
                    <Folder label="ZAKAT RECEIPT" className="rd-par absolute top-[170px] -right-[30px] rotate-[22deg]" style={k(16)} />
                    <div className="rd-par absolute right-0 bottom-[302px] flex flex-col items-end gap-4" style={k(-12)}>
                        <Gift name="Aisha K." line="Gave £100 on night 27" tone="#F2DC3B" className="rd-float -mr-5 pr-[34px]" style={{ "--r": "-6deg" } as CSSProperties} />
                        <Gift name="Masjid Al-Noor" line="Passed 80% of its goal" tone="#EFC6FA" className="rd-float -mr-[50px] pr-[60px] [animation-delay:-3s]" style={{ "--r": "-4deg" } as CSSProperties} />
                    </div>
                    <Paperclip className="rd-par absolute right-[90px] bottom-[92px] w-[110px] -rotate-[28deg]" style={k(8)} />
                </div>
            </section>

            {/* ---------- The paper sheet ---------- */}
            <main className="rd-sheet relative z-10 -mt-[72px] rounded-[36px] bg-(--rd-paper) sm:-mt-[112px] sm:rounded-[64px] lg:rounded-[80px]">
                <Strip />

                {/* essentials */}
                <section id="give" aria-labelledby="rd-give" className="px-2 sm:px-4">
                    <div className={FRAME}>
                        <Head id="rd-give" label="Ramadan essentials" title="Everything a Ramadan Appeal Needs, in One Place">Take every kind of gift, keep donors coming back all month and make the last ten nights your biggest yet.</Head>
                        <div className="grid border-t border-(--rd-rule) lg:grid-cols-3">
                            <Card d={0} title="Every Appeal, One Checkout" body="Run Zakat, Sadaqah, Fidya and iftar appeals, each with its own page and goal. UK donors add Gift Aid in a single tap."><GivingMock /></Card>
                            <Card d={1} soon title="Never Miss the Last Ten Nights" body="Donors set an amount once and give on each of the last ten nights, so their Sadaqah is there on Laylat al-Qadr, whichever night it falls."><NightsMock /></Card>
                            <Card d={2} last title="Live Leaderboards and Live Screens" body="Put your appeal on the big screen at iftar. Every gift lands on the leaderboard as it happens, so the whole room gives together."><LiveMock /></Card>
                        </div>
                        <div aria-hidden="true" className="rd-cross h-12 border-b border-(--rd-rule)" />
                        <div className="h-14 sm:h-[90px]" />
                    </div>
                </section>

                <Audience />
                <HowItWorks />

                {/* why outgive: the medals */}
                <section id="why" aria-labelledby="rd-why" className="px-2 pb-20 sm:px-4 sm:pb-[140px]">
                    <div className={FRAME}>
                        <div className="rd-reveal relative flex flex-wrap items-end justify-between gap-7 border-t border-(--rd-rule) px-[clamp(20px,5vw,70px)] pt-20 pb-16 sm:pt-[120px] sm:pb-[110px]">
                            <Dots />
                            <div className="flex flex-col gap-4"><Label align="left">Why Outgive</Label><h2 id="rd-why" className="max-w-[14ch] text-[clamp(36px,4.6vw,62px)] leading-[1.06]">Raise With Complete Confidence</h2></div>
                            <div className="flex flex-wrap gap-3.5"><a href="/start" className={cx(PILL, "rd-btn-yellow min-h-[54px] px-[26px] text-[18px]")}>Start free</a><a href="/create" className={cx(PILL, "rd-btn-grey min-h-[54px] px-[26px] text-[18px]")}>Start a fundraiser</a></div>
                        </div>
                        <div aria-hidden="true" className="rd-hatch h-12 border-y border-(--rd-rule) sm:h-[72px]" />
                        <div className="grid lg:grid-cols-3">
                            <Medal d={0} pat="rd-pat1" title="Paid Straight to the Charity" icon={<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>} art={<><path d="M70 14l44 18v32c0 30-20 52-44 62-24-10-44-32-44-62V32z" fill="#fff" stroke="#E4E3E0" strokeWidth="4" /><path d="M82 46a24 24 0 1012 32 20 20 0 01-12-32z" fill="#E7E6E2" /></>}>Every gift goes to the charity’s own Stripe account. It never passes through a fundraiser’s hands, or ours.</Medal>
                            <Medal d={1} pat="rd-pat2" title="Clear Fees and Receipts" icon={<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />} art={<><rect x="30" y="20" width="80" height="100" rx="16" fill="#fff" stroke="#E4E3E0" strokeWidth="4" /><path d="M48 50h44M48 68h44M48 86h26" stroke="#E2E1DD" strokeWidth="8" strokeLinecap="round" /></>}>Charities start free, and <a href="/pricing" className="font-medium text-(--rd-green) underline decoration-[#dcbfee] decoration-2 underline-offset-4 hover:decoration-(--rd-green)">the pricing page</a> shows who pays what before you begin. Every donor gets a receipt.</Medal>
                            <Medal d={2} last pat="rd-pat3" title="Secure, Gift Aid Ready" icon={<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />} art={<><rect x="28" y="62" width="84" height="62" rx="14" fill="#fff" stroke="#E4E3E0" strokeWidth="4" /><path d="M46 62V46a24 24 0 0148 0v16" fill="none" stroke="#fff" strokeWidth="14" /><path d="M46 62V46a24 24 0 0148 0v16" fill="none" stroke="#E4E3E0" strokeWidth="3" /><circle cx="70" cy="90" r="8" fill="#E2E1DD" /></>}>Payments run through Stripe, and UK taxpayers can add Gift Aid in a single tap.</Medal>
                        </div>
                    </div>
                </section>
            </main>

            {/* ---------- Call to action and footer on the board ---------- */}
            <footer id="cta" className="rd-board relative -mt-[60px] overflow-hidden rounded-b-[22px] px-[clamp(8px,4vw,60px)] pt-[120px] text-white sm:-mt-[110px] sm:rounded-b-[28px] sm:pt-[200px]">
                <div className="relative mx-auto max-w-[1240px] border-x border-white/10">
                    <div aria-hidden="true" className="rd-grid h-12 sm:h-[76px]" />
                    <div className="rd-check rd-reveal flex flex-wrap items-center justify-between gap-[30px] border-y border-white/10 bg-white/5 px-[clamp(20px,5vw,76px)] py-12 sm:py-[70px]">
                        <div className="flex flex-col items-start gap-[18px]">
                            <span className={cx(BADGE, "text-[14px] sm:text-[15px]")}>RAMADAN MUBARAK<span className={LIVE}>Live</span></span>
                            <h2 className="max-w-[560px] text-[clamp(32px,3.6vw,48px)] leading-[1.12]">Ready to make this Ramadan your biggest appeal yet?</h2>
                        </div>
                        <div className="flex flex-wrap gap-3.5"><a href="/start" className={cx(PILL, "rd-btn-yellow min-h-[54px] px-6 text-[18px]")}>Start free</a><a href="/create" className={cx(PILL, "rd-btn-dark min-h-[54px] px-6 text-[18px]")}>Start a fundraiser</a></div>
                    </div>
                    <div aria-hidden="true" className="rd-grid h-12 sm:h-[76px]" />

                    <div className="relative grid border-t border-white/10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
                        <Dots light />
                        <div className="flex min-w-0 flex-col gap-[18px] px-6 pt-12 pb-10 sm:col-span-2 sm:px-10 sm:pt-14 sm:pb-[50px] lg:col-span-1">
                            <a href="/" className="flex items-center gap-2.5 text-[26px] font-semibold tracking-[-0.6px]"><Mark size={28} />Outgive</a>
                            <p className="max-w-[300px] text-[16px] leading-[1.55] text-white/68">The Ramadan giving platform for charities, mosques and fundraisers.</p>
                            <div className="mt-[18px] flex flex-wrap gap-2.5"><a href="/start" className={cx(PILL, "rd-btn-yellow min-h-12 px-5 text-[16px]")}>Start free</a><a href="/create" className={cx(PILL, "rd-btn-dark min-h-12 px-5 text-[16px]")}>Start a fundraiser</a></div>
                            <div className="relative mt-8 flex items-end gap-3 sm:mt-[46px]">
                                <Social href="https://instagram.com" label="Outgive on Instagram" bg="linear-gradient(160deg,#F58A5C,#C1358F 60%,#7A3FD0)" className="-rotate-[4deg]"><Instagram size={24} /></Social>
                                <Social href="https://x.com" label="Outgive on X" bg="linear-gradient(180deg,#3a3a3a,#161616)" className="rotate-[3deg]"><X size={22} /></Social>
                                <Social href="https://facebook.com" label="Outgive on Facebook" bg="linear-gradient(180deg,#4a90f5,#1767d8)" className="-rotate-[2deg]"><Facebook size={24} /></Social>
                                <span aria-hidden="true" className="rd-hand mb-[30px] ml-2 rotate-[8deg] rounded-[50%] border-[1.5px] border-white/45 px-4 py-1 text-[22px] leading-tight whitespace-nowrap text-white/70">Share the reward</span>
                            </div>
                        </div>
                        <Col title="Product" links={[["Ramadan appeals", "#give"], ["Fundraising pages", "#who"], ["Donate page", "#how"], ["Live screens", "/demo/live"], ["Leaderboards", "/demo"], ["Checkout", "/checkout"]]} />
                        <Col title="Resources" links={[["How it works", "#how"], ["Pricing", "/pricing"], ["Blog", "/blog"], ["FAQ", "/faq"], ["Fundraising rules", "/rules"]]} />
                        <Col title="Company" links={[["About", "/about"], ["Contact", "mailto:hello@outgive.tech"], ["Book a demo", "mailto:hello@outgive.tech?subject=Ramadan%20demo"], ["Privacy policy", "/privacy"], ["Terms of service", "/terms"]]} />
                    </div>
                    <div className="mt-6 flex flex-wrap justify-between gap-4 border-t border-white/10 px-6 pt-[26px] pb-[34px] text-[15px] text-white/68 sm:mt-10 sm:px-10">
                        <span>© {new Date().getFullYear()} Outgive [LEGAL NAME]. Company no. [REG. NO.]</span>
                        <span className="flex gap-[30px]"><a href="/terms" className="hover:text-white">Terms</a><a href="/privacy" className="hover:text-white">Privacy</a></span>
                    </div>
                </div>
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden xl:block">
                    <BinderClip className="absolute top-[240px] right-[40px] w-[130px] rotate-[32deg] drop-shadow-[0_18px_18px_rgb(0_0_0/0.4)]" />
                    <Paperclip className="absolute bottom-[370px] left-[10px] w-[110px] -rotate-[40deg]" />
                    <Pencil className="absolute right-[70px] -bottom-[30px] -rotate-[28deg]" />
                </div>
            </footer>
        </div>
    );
};

/* ---------- pieces ---------- */

export const Mark = ({ size = 22 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3.5A9 9 0 1020.5 14 7 7 0 0117 3.5z" fill="currentColor" /><path d="M17.5 7l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4L15.5 9l1.4-.6z" fill="#F2DC3B" /></svg>;
export const Label = ({ children, align = "center" }: { children: string; align?: "center" | "left" }) => (
    <p className={cx("rd-mono flex items-center gap-2 text-[13px] text-(--rd-mono) uppercase sm:text-[15px]", align === "center" && "justify-center")}><span aria-hidden="true">⊣</span>{children}<span aria-hidden="true">⊢</span></p>
);
export const Tick = ({ light }: { light?: boolean }) => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 flex-none"><circle cx="12" cy="12" r="10" fill={light ? "rgb(242 220 59 / 0.18)" : "#F0D3FA"} /><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke={light ? "#F2DC3B" : "#7A2FA6"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Ico = ({ d, size = 20 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none"><path d={d} /></svg>;
/** The feathered double arrow either side of the strip's label: a firm chevron with a lighter one trailing it. */
const Chev = ({ flip }: { flip?: boolean }) => <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="var(--rd-green)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cx("flex-none", flip && "-scale-x-100")}><path d="M10 2L4 8l6 6" /><path d="M18 2l-6 6 6 6" opacity=".38" /></svg>;
/** The two registration dots where a frame's rule meets its sides. */
const Dots = ({ light }: { light?: boolean }) => <>{["-left-[5px]", "-right-[5px]"].map((x) => <span key={x} aria-hidden="true" className={cx("absolute -top-[5px] size-[9px] rounded-full", x, light ? "bg-white/70" : "bg-[#6F726C]")} />)}</>;
const Cursor = ({ className }: { className?: string }) => <svg width="26" height="26" viewBox="0 0 24 24" className={cx("absolute", className)}><path d="M5 3l14 8-6 1.5L10 19z" fill="#111" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" /></svg>;
/** Marks a feature that is on its way rather than live. */
const Soon = () => <span className="rd-mono w-fit rounded-full bg-[#F0D3FA] px-2.5 py-1 text-[11px] leading-none text-[#5E2185] uppercase">Coming for Ramadan</span>;

/** A section's centred heading block: mono label, headline, one line under it. */
const Head = ({ id, label, title, children }: { id: string; label: string; title: string; children: ReactNode }) => (
    <div className="rd-reveal relative flex flex-col items-center gap-[18px] border-t border-(--rd-rule) px-6 pt-20 pb-16 text-center sm:pt-[110px] sm:pb-[100px]">
        <Dots />
        <Label>{label}</Label>
        <h2 id={id} className="max-w-[760px] text-[clamp(36px,4.6vw,62px)] leading-[1.06]">{title}</h2>
        <p className="max-w-[560px] text-[17px] leading-[1.55] text-(--rd-ink-2) sm:text-[19px]">{children}</p>
    </div>
);

/** A floating gift card on the desk. The names are illustrative. */
const Gift = ({ name, line, tone, className, style }: { name: string; line: string; tone: string; className?: string; style?: CSSProperties }) => (
    <div className={cx("flex items-center gap-3 rounded-[16px] bg-white py-3 pl-3 text-left text-(--rd-ink) shadow-[0_16px_28px_rgb(0_0_0/0.3)]", className)} style={style}>
        <span className="grid size-10 flex-none place-items-center rounded-full text-[14px] font-semibold" style={{ background: tone }}>{name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
        <span className="flex flex-col gap-0.5"><strong className="text-[15px] font-semibold">{name}</strong><span className="text-[13px] text-[#5C5F5A]">{line}</span></span>
    </div>
);

/** The appeal types as a logo bar: a label between hairlines, then a six-cell pill with a rule running behind it. */
const Strip = () => (
    <section aria-labelledby="rd-for" className="rd-reveal px-4 pt-[52px] pb-14 sm:pt-[76px] sm:pb-20">
        <div className="mx-auto flex max-w-[980px] items-center justify-center gap-3 sm:gap-6">
            <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-linear-to-r from-transparent to-[#A99DB8]" />
            <h2 id="rd-for" className="flex items-center gap-2.5 text-[15px] font-medium! tracking-normal! whitespace-nowrap text-(--rd-ink) sm:gap-3.5 sm:text-[16.5px]"><Chev />Built for every Ramadan appeal<Chev flip /></h2>
            <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-linear-to-l from-transparent to-[#A99DB8]" />
        </div>
        <div className="relative mt-8 sm:mt-11">
            {/* the rule the bar sits on, with a registration dot where it meets each side of the frame */}
            <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-[#CFC4DE]">
                {["left-[max(2px,calc(50%-620px))]", "right-[max(2px,calc(50%-620px))]"].map((x) => <span key={x} className={cx("absolute top-1/2 hidden size-[7px] -translate-y-1/2 rounded-full bg-[#8F839E] sm:block", x)} />)}
            </div>
            <ul className="rd-gloss relative mx-auto grid w-full max-w-[1120px] grid-cols-2 gap-px overflow-hidden rounded-[30px] bg-[#D8CEE8] sm:grid-cols-3 lg:grid-cols-6 lg:rounded-full">
                {APPEALS.map(([label, path]) => <li key={label} className="rd-cell flex h-[68px] items-center justify-center gap-2.5 text-[16px] font-semibold text-[#3F3A47] sm:text-[18px] lg:h-[88px]"><span className="text-(--rd-green)"><Ico d={path} size={24} /></span>{label}</li>)}
            </ul>
        </div>
    </section>
);

const Card = ({ title, body, children, last, soon, d: delay }: { title: string; body: string; children: ReactNode; last?: boolean; soon?: boolean; d: number }) => (
    <article className={cx("rd-reveal relative flex flex-col gap-7 overflow-hidden border-b border-(--rd-rule) px-5 pt-[34px] pb-[70px] sm:gap-9 sm:px-10", !last && "lg:border-r")} style={d(delay)}>
        <div aria-hidden="true" className="rd-card-art">{children}</div>
        <div className="relative z-1 flex flex-col gap-2">
            {soon && <Soon />}
            <h3 className="text-[22px]">{title}</h3>
            <p className="text-[17px] leading-normal text-(--rd-ink-2)">{body}</p>
        </div>
        <span aria-hidden="true" className="rd-fold" />
    </article>
);

/** Card one: the kinds of appeal, as a row of round icons over a stack of ledger rows. */
const GivingMock = () => (
    <div className="flex h-[376px] flex-col items-center sm:h-[440px]">
        <div className="flex gap-2 rounded-full border border-dashed border-[#CFCCC4] bg-[#F7F6F3] p-2 shadow-[0_10px_20px_rgb(0_0_0/0.06)] sm:gap-2.5">
            {([["#9A9C96", "M8 19h9M9 19c1.5-2 1.5-4 .5-7M7 12h7M16 7.5A3.5 3.5 0 009.5 9c0 1 .3 2 .5 3"], ["#C4A24A", "M4 18l3-8h10l3 8zM8 10l2-5h4l2 5"], ["#7A2FA6", "M12 3l8 4v2H4V7zM6 10v7M10 10v7M14 10v7M18 10v7M4 20h16"], ["#7C8CC7", "M4 17l5-5 4 3 7-8"], ["#B48ACB", "M4 8h16v11H4zM9 8V5h6v3"]] as const).map(([c, path], i) => (
                <span key={path} className={cx("grid place-items-center rounded-full", i === 2 ? "-mt-0.5 size-[54px] border-[3px] border-(--rd-orchid) bg-white" : "size-[46px] bg-[#EFEDE8] sm:size-[50px]")} style={{ color: c }}><Ico d={path} size={i === 2 ? 24 : 22} /></span>
            ))}
        </div>
        <div className="relative mt-[26px] flex w-full max-w-[360px] flex-col gap-3 rounded-t-[22px] bg-linear-to-b from-[#E6E4DF] to-(--rd-paper) to-30% px-4 pt-4">
            {([["Zakat appeal", "Live", "#2A6FB8", "#22568F", "#DCEAFA"], ["Sadaqah", "Live", "#C4A24A", "#7A5A0E", "#FBEFC8"], ["Iftar meals", "Add", "#8A5CB0", "#6A3A90", "#EFE3F8"], ["Gift Aid", "+25%", "#B45FD6", "#5E2185", "#F0D3FA"]] as const).map(([l, tag, dot, fg, bg]) => (
                <div key={l} className="flex items-center gap-2.5 rounded-[12px] border border-[#DDDAD3] bg-white px-3.5 py-3 text-[17px] shadow-[0_3px_0_#E2DFD8]"><span className="size-2.5 rounded-full" style={{ background: dot }} />{l}<span className="ml-auto rounded-full px-2.5 py-[3px] text-[12px] font-semibold" style={{ color: fg, background: bg }}>{tag}</span></div>
            ))}
            <Cursor className="top-[112px] right-[30px]" />
            <div className="rd-scallop -mx-4 h-9 border-t border-dashed border-[#CFCCC4]" />
        </div>
    </div>
);

/** Card two: the month as a calendar, the last ten nights scheduled and the odd nights starred. */
const NightsMock = () => (
    <div className="rd-rings flex h-[440px] flex-col items-center justify-center gap-[30px]">
        <span className="inline-flex items-center gap-2.5 rounded-full bg-white py-[7px] pr-[18px] pl-[7px] text-[17px] shadow-[0_10px_22px_rgb(0_0_0/0.08),inset_0_-2px_0_#ECEAE4]"><span className="grid size-8 place-items-center rounded-full bg-(--rd-green)"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M15.5 3.5A8.5 8.5 0 1020.5 15 7 7 0 0115.5 3.5z" fill="#fff" /></svg></span>Last 10 Nights autopilot</span>
        <div className="rounded-[26px] bg-[#ECEAE5] p-3.5 shadow-[inset_0_2px_6px_rgb(0_0_0/0.06)] sm:p-[18px]">
            <div className="grid grid-cols-[repeat(6,34px)] gap-2 rounded-[18px] bg-white p-3.5 shadow-[0_14px_26px_rgb(0_0_0/0.10)] sm:grid-cols-[repeat(6,36px)] sm:p-4">
                {Array.from({ length: 30 }, (_, i) => { const n = i + 1, last = n > 20; return (
                    <span key={n} className={cx("relative grid h-[34px] place-items-center rounded-[10px] border text-[13px] font-semibold sm:h-9", last ? "border-(--rd-green) bg-(--rd-orchid) text-white" : "border-[#E6E4DE] bg-(--rd-paper) text-[#8E918A]")}>{n}{last && n % 2 === 1 && <span className="absolute -top-[7px] -right-[7px] size-4 rounded-full border-2 border-white bg-(--rd-gold)" />}</span>
                ); })}
            </div>
        </div>
        <div className="flex gap-[18px] text-[13px] text-(--rd-ink-2)"><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-(--rd-orchid)" />Scheduled gift</span><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-(--rd-gold)" />Odd night</span></div>
    </div>
);

/** Card three: a live dial over two alerts dropping into a tray. The names are illustrative. */
const LiveMock = () => (
    <div className="relative flex h-[440px] flex-col items-center">
        <div className="rd-dial mt-5 grid size-[150px] place-items-center rounded-full">
            <span className="grid size-[104px] place-items-center rounded-full bg-[#F7F6F3] shadow-[0_10px_20px_rgb(0_0_0/0.10),inset_0_2px_0_#fff]"><span className="grid size-[70px] place-items-center rounded-full border border-[#E2E0DA] bg-white text-(--rd-green)"><Mark size={34} /></span></span>
        </div>
        <span className="rd-hand absolute top-[132px] left-0 rotate-[8deg] text-[22px] text-[#6F726C]">Live update</span>
        <svg width="90" height="40" viewBox="0 0 90 40" className="absolute top-[140px] left-20"><path d="M4 30C30 6 60 6 82 26M82 26l-10-2M82 26l-2-10" fill="none" stroke="#8E918A" strokeWidth="1.6" strokeLinecap="round" /></svg>
        <div className="relative mt-10 h-[200px] w-full max-w-[380px]">
            <div className="absolute inset-x-6 top-0 flex items-center gap-2.5 rounded-[14px] border border-[#E2E0DA] bg-white px-3.5 py-3 shadow-[0_6px_14px_rgb(0_0_0/0.06)]"><span className="grid size-[34px] flex-none place-items-center rounded-full bg-[#D9ECFF] text-[12px] font-semibold text-[#22568F]">TI</span><span className="truncate text-[15px] font-semibold">Team Iqra took first place</span><span className="ml-auto flex-none text-[11px] text-[#8E918A]">9:12 pm</span></div>
            <div className="absolute inset-x-0 top-[44px] z-2 flex -rotate-[5deg] flex-col gap-1.5 rounded-[14px] border border-[#E2E0DA] bg-white px-4 py-3.5 shadow-[0_16px_28px_rgb(0_0_0/0.12)]"><span className="flex items-center gap-2.5"><span className="grid size-[34px] flex-none place-items-center rounded-full bg-(--rd-gold) text-[12px] font-semibold">AK</span><strong className="truncate text-[16px] font-semibold">A new gift is on the board</strong><span className="ml-auto flex-none text-[11px] text-[#8E918A]">9:41 pm</span></span><span className="text-[13px] leading-[1.4] text-[#6F726C]">It is on the live screen at tonight’s iftar and counted towards the goal.</span></div>
            <Cursor className="top-11 right-10 z-3" />
            <div className="absolute -inset-x-1.5 bottom-0 z-2 h-[92px] rounded-t-[6px] rounded-b-[28px] border border-[#DEDBD4] bg-linear-to-b from-[#F7F6F3] to-[#ECEAE5] shadow-[0_18px_26px_rgb(0_0_0/0.08),inset_0_2px_0_#fff]" />
        </div>
    </div>
);

const Medal = ({ pat, art, icon, title, children, last, d: delay }: { pat: string; art: ReactNode; icon: ReactNode; title: string; children: ReactNode; last?: boolean; d: number }) => (
    <article className={cx("rd-reveal flex flex-col border-b border-(--rd-rule)", !last && "lg:border-r")} style={d(delay)}>
        <div aria-hidden="true" className={cx(pat, "relative flex h-[400px] justify-center overflow-hidden border-b border-(--rd-rule) sm:h-[470px]")}>
            <div className="absolute top-0 left-1/2 flex -translate-x-1/2 gap-1.5"><span className="rd-ribbon skew-x-[14deg]" /><span className="rd-ribbon -skew-x-[14deg]" /></div>
            <div className="rd-medal absolute top-[110px] grid size-[240px] place-items-center rounded-full sm:size-[280px]"><svg width="140" height="140" viewBox="0 0 140 140" className="drop-shadow-[0_6px_8px_rgb(0_0_0/0.12)]">{art}</svg></div>
        </div>
        <div className="flex flex-col items-center gap-2.5 px-[clamp(20px,3vw,40px)] pt-9 pb-11 text-center sm:pt-11 sm:pb-[52px]">
            <h3 className="flex items-center gap-2.5 text-[22px]"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--rd-orchid)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">{icon}</svg>{title}</h3>
            <p className="max-w-[380px] text-[17px] leading-[1.55] text-(--rd-ink-2)">{children}</p>
        </div>
    </article>
);

const Col = ({ title, links }: { title: string; links: [string, string][] }) => (
    <nav aria-label={title} className="flex flex-col border-white/10 max-lg:border-t sm:border-l sm:max-lg:first-of-type:border-l-0">
        <h3 className="border-b border-white/10 px-6 pt-8 pb-5 text-[19px] font-medium! sm:px-10 lg:pt-14 lg:pb-[30px]">{title}</h3>
        <ul className="flex flex-col gap-4 px-6 pt-6 pb-9 text-[17px] sm:px-10 lg:pt-[30px] lg:pb-[50px]">{links.map(([l, h]) => <li key={l}><a href={h} className="text-white/72 hover:text-white">{l}</a></li>)}</ul>
    </nav>
);
const Social = ({ href, label, bg, className, children }: { href: string; label: string; bg: string; className?: string; children: ReactNode }) => (
    <a href={href} aria-label={label} target="_blank" rel="noreferrer" className={cx("grid size-[54px] flex-none place-items-center rounded-[14px] text-white shadow-[0_10px_18px_rgb(0_0_0/0.3),inset_0_2px_0_rgb(255_255_255/0.3)] transition hover:-translate-y-0.5 motion-reduce:transition-none", className)} style={{ background: bg }}>{children}</a>
);

/** Turns on the entrance and scroll reveals (only once JavaScript runs) and lets the hero's props drift with the pointer. */
export const useMotion = (root: React.RefObject<HTMLDivElement | null>, hero: React.RefObject<HTMLElement | null>) => {
    useEffect(() => {
        const el = root.current, h = hero.current;
        if (!el) return;
        el.classList.add("rd-js");
        // Reveal everything that has reached the lower part of the screen, or already scrolled past it, so a fast scroll or a jump never leaves a section hidden.
        let sweepRaf = 0;
        const sweep = () => { cancelAnimationFrame(sweepRaf); sweepRaf = requestAnimationFrame(() => el.querySelectorAll(".rd-reveal:not(.is-in)").forEach((n) => { if (n.getBoundingClientRect().top < innerHeight * 0.92) n.classList.add("is-in"); })); };
        sweep();
        addEventListener("scroll", sweep, { passive: true }); addEventListener("resize", sweep);
        let raf = 0;
        const move = (e: PointerEvent) => {
            if (!h || e.pointerType !== "mouse") return;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => { const r = h.getBoundingClientRect(); h.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3)); h.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3)); });
        };
        h?.addEventListener("pointermove", move);
        return () => { removeEventListener("scroll", sweep); removeEventListener("resize", sweep); h?.removeEventListener("pointermove", move); cancelAnimationFrame(raf); cancelAnimationFrame(sweepRaf); };
    }, [root, hero]);
};

/** Who it's for: charities and mosques on one side, fundraisers on the other, each with its pitch and its own way in. */
const Audience = () => (
    <section id="who" aria-labelledby="rd-who" className="px-2 sm:px-4">
        <div className={FRAME}>
            <Head id="rd-who" label="Who it’s for" title="Built for Charities. Open to Everyone.">Run your charity’s whole Ramadan appeal, or start a page for a cause you love in a couple of minutes. Every gift goes straight to the charity.</Head>
            <div className="grid border-t border-(--rd-rule) lg:grid-cols-2">
                {AUDIENCES.map((a, i) => (
                    <article key={a.id} id={`rd-${a.id}`} className={cx("rd-reveal relative flex flex-col border-b border-(--rd-rule) px-5 pt-9 pb-10 sm:px-[clamp(24px,5vw,56px)] sm:pt-14 sm:pb-14", i === 0 && "lg:border-r")} style={d(i)}>
                        <p className="rd-mono flex items-center gap-3 text-[13px] text-(--rd-mono) uppercase"><span className="grid size-11 place-items-center rounded-full border-[3px] border-(--rd-orchid) bg-white"><Ico d={a.icon} size={22} /></span>{`0${i + 1} / ${a.tag}`}</p>
                        <h3 className="mt-6 max-w-[17ch] text-[clamp(28px,3vw,38px)] leading-[1.08] tracking-[-0.025em]!">{a.title}</h3>
                        <p className="mt-3 max-w-[44ch] text-[17px] leading-[1.55] text-(--rd-ink-2)">{a.body}</p>
                        <ul className="mt-7 mb-9 divide-y divide-(--rd-rule) border-y border-(--rd-rule) text-[16px]">
                            {a.points.map((x) => <li key={x} className="flex gap-3 py-3.5"><Tick />{x}</li>)}
                        </ul>
                        <div className="mt-auto flex flex-wrap gap-3"><a href={a.cta[1]} className={cx(PILL, "rd-btn-yellow min-h-[50px] px-6 text-[17px]")}>{a.cta[0]}</a><a href={a.alt[1]} className={cx(PILL, "rd-btn-grey min-h-[50px] px-6 text-[17px]")}>{a.alt[0]}</a></div>
                    </article>
                ))}
            </div>
            <div aria-hidden="true" className="rd-hatch h-12 border-b border-(--rd-rule)" />
            <div className="h-14 sm:h-[90px]" />
        </div>
    </section>
);

/** How it works, beside the real thing: three steps on the left, and the live donate page in a phone with its three layouts on the right. */
const HowItWorks = () => {
    const [layout, setLayout] = useState<LayoutId>("hero");
    const [, layoutName, layoutDesc] = LAYOUTS.find(([id]) => id === layout)!;
    return (
        <section id="how" aria-labelledby="rd-how" className="px-2 sm:px-4">
            <div className={FRAME}>
                <Head id="rd-how" label="How it works" title="See the Donate Page Your Donors Get">Set up, share and start taking gifts. The phone shows the real donate page, running live, so you can try it before you start.</Head>
                <div className="grid items-center gap-10 border-t border-(--rd-rule) px-3 py-8 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12 lg:px-12">
                    <div className="rd-reveal px-2 sm:px-0">
                        <ol className="divide-y divide-(--rd-rule) border-y border-(--rd-rule)">
                            {STEPS.map(([title, body], i) => (
                                <li key={title} className="flex gap-5 py-6">
                                    <span aria-hidden="true" className="rd-mono grid size-11 flex-none place-items-center rounded-full border-[3px] border-(--rd-orchid) bg-white text-[13px] text-(--rd-green)">{`0${i + 1}`}</span>
                                    <div><h3 className="text-[22px]">{title}</h3><p className="mt-1.5 max-w-[42ch] text-[17px] leading-normal text-(--rd-ink-2)">{body}</p></div>
                                </li>
                            ))}
                        </ol>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <a href={donateHref(layout)} className={cx(PILL, "rd-btn-yellow min-h-[54px] px-6 text-[17px]")}>Open it full screen</a>
                            <a href="/start" className={cx(PILL, "rd-btn-grey min-h-[54px] px-6 text-[17px]")}>Use it for my appeal</a>
                        </div>
                    </div>
                    {/* the stage: the real checkout in a phone, with the layout switch above it */}
                    <div id="donate" className="rd-reveal rd-board relative scroll-mt-4 overflow-hidden rounded-[28px] px-4 pt-5 text-white shadow-[0_30px_60px_-24px_rgb(74_29_107/0.55)] sm:rounded-[36px] sm:px-8 sm:pt-7 lg:pb-7" style={d(1)}>
                        <div aria-hidden="true" className="rd-grid absolute inset-0 opacity-70" />
                        <div aria-hidden="true" className="rd-halo absolute top-[150px] left-1/2 size-[620px] -translate-x-1/2 rounded-full" />
                        <div role="group" aria-label="Donate page layout" className="relative mx-auto flex w-full max-w-[380px] rounded-full border border-white/16 bg-black/22 p-1">
                            {LAYOUTS.map(([id, name]) => <button key={id} type="button" aria-pressed={layout === id} onClick={() => setLayout(id)} className={cx("min-h-11 flex-1 rounded-full px-2 text-[14.5px] font-medium transition-[background-color,color,box-shadow] duration-300", layout === id ? "bg-white text-(--rd-ink) shadow-[0_6px_14px_rgb(0_0_0/0.25)]" : "text-white/80 hover:bg-white/8 hover:text-white")}>{name}</button>)}
                        </div>
                        {/* two lines tall whatever the text, so the phone never jumps when the layout changes */}
                        <p aria-live="polite" className="relative mx-auto mt-2 flex min-h-[44px] max-w-[36ch] items-center justify-center text-center text-[14px] leading-snug text-white/74">{layoutDesc}</p>
                        {/* on small screens the phone runs off the bottom of the stage and opens the page full screen when tapped, so it never traps the page's own scroll */}
                        <div className="relative mx-auto mt-4 w-full max-w-[320px] max-lg:-mb-[150px]">
                            <Phone key={layout} src={`${donateHref(layout)}&preview=1`} title={`Live donate page preview, ${layoutName} layout`} />
                            <a href={donateHref(layout)} aria-label={`Open the ${layoutName} donate page full screen`} className="absolute inset-0 rounded-[54px] lg:hidden" />
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2.5 bg-linear-to-t from-(--rd-board-2) from-55% to-transparent px-4 pt-14 pb-5 lg:static lg:mt-6 lg:bg-none lg:p-0">
                            <span aria-hidden="true" className="flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-medium text-(--rd-ink) shadow-[0_10px_24px_rgb(0_0_0/0.35)] lg:hidden">Tap the phone to try it<svg width="14" height="14" viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                            <p className="relative flex items-center gap-2 text-center text-[13.5px] text-white/74"><span aria-hidden="true" className="size-2 rounded-full bg-(--rd-gold) shadow-[0_0_0_4px_rgb(242_220_59/0.2)] motion-safe:animate-pulse" />Live preview. No payment is taken.</p>
                        </div>
                    </div>
                </div>
                <div aria-hidden="true" className="rd-cross h-12 border-y border-(--rd-rule)" />
                <div className="h-14 sm:h-[90px]" />
            </div>
        </section>
    );
};

/**
 * A phone with the real checkout running in it. The screen is drawn at phone size (390 x 844: status bar, address bar, then the page
 * in an iframe) and scaled as one piece to fit the frame. The page hides its own scrollbars when it has ?preview (checkout.css).
 */
const Phone = ({ src, title }: { src: string; title: string }) => {
    const box = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(300 / 390);
    useEffect(() => {
        const el = box.current; if (!el) return;
        const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / 390));
        ro.observe(el); return () => ro.disconnect();
    }, []);
    return (
        <div className="rd-phone relative rounded-[54px] bg-[#0d0e0c] p-2.5">
            {/* side buttons */}
            <span aria-hidden="true" className="absolute top-[17%] -left-[3px] h-[4%] w-[4px] rounded-l-[2px] bg-[#1b1d1a]" /><span aria-hidden="true" className="absolute top-[25%] -left-[3px] h-[8%] w-[4px] rounded-l-[2px] bg-[#1b1d1a]" /><span aria-hidden="true" className="absolute top-[35%] -left-[3px] h-[8%] w-[4px] rounded-l-[2px] bg-[#1b1d1a]" /><span aria-hidden="true" className="absolute top-[29%] -right-[3px] h-[12%] w-[4px] rounded-r-[2px] bg-[#1b1d1a]" />
            <div ref={box} className="relative overflow-hidden rounded-[44px] bg-[#f3effc]" style={{ aspectRatio: "390 / 844" }}>
                <div className="absolute top-0 left-0 h-[844px] w-[390px] origin-top-left" style={{ transform: `scale(${scale})` }}>
                    <div aria-hidden="true" className="relative h-[94px] border-b border-black/6 bg-white text-[#1b1c1a]">
                        <div className="flex h-[50px] items-center justify-between pt-1 pr-7 pl-9 text-[16px] font-semibold tracking-[-0.01em]">
                            <span>9:41</span>
                            <span className="absolute top-[10px] left-1/2 h-[31px] w-[106px] -translate-x-1/2 rounded-full bg-black" />
                            <svg width="68" height="14" viewBox="0 0 68 14" fill="currentColor"><rect x="0" y="9" width="3" height="4" rx="1" /><rect x="5" y="6.5" width="3" height="6.5" rx="1" /><rect x="10" y="3.5" width="3" height="9.5" rx="1" /><rect x="15" y="1" width="3" height="12" rx="1" /><path d="M31 3.2c2.4 0 4.6.9 6.3 2.5l-1.3 1.4a7.2 7.2 0 00-10 0l-1.3-1.4A9.1 9.1 0 0131 3.200zm0 3.900c1.4 0 2.7.5 3.7 1.500l-1.4 1.400a3.3 3.3 0 00-4.6 0l-1.4-1.400c1-1 2.3-1.5 3.7-1.500zm0 3.700l1.5 1.6-1.5 1.6-1.5-1.600z" /><rect x="43.5" y="1.5" width="20" height="11" rx="3.5" fill="none" stroke="currentColor" strokeOpacity=".4" /><rect x="45.5" y="3.5" width="16" height="7" rx="2" /><rect x="65" y="5" width="1.5" height="4" rx=".75" opacity=".45" /></svg>
                        </div>
                        <div className="mx-3 flex h-[36px] items-center justify-center gap-1.5 rounded-full bg-[#f0eff2] text-[14px] font-medium text-[#3b3c37]"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>outgive.tech/c/your-appeal</div>
                    </div>
                    <iframe title={title} src={src} loading="lazy" className="rd-screen block h-[750px] w-[390px] border-0 max-lg:pointer-events-none" />
                    <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-1/2 h-[5px] w-[136px] -translate-x-1/2 rounded-full bg-black/80" />
                </div>
                <span aria-hidden="true" className="rd-glare pointer-events-none absolute inset-0 rounded-[inherit]" />
            </div>
        </div>
    );
};
