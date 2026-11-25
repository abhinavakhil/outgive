/**
 * / (and /v2): the Outgive landing page, built from the Outgive design system and its landing canvas.
 * Hero with a working donate card on a stage, the page deck, three ways to give, one night section
 * (the live-screen flow and the four steps), the three donate layouts, and a forest close.
 * Figures are the sample appeal's and are marked "Sample figures" on the stage.
 */
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { DemoRequest } from "@/shared/ui";
import { Logo, donateHref } from "./Ramadan";
import "./v2.css";

type AppealKey = "zakat" | "sadaqah" | "iftar" | "fidya";
const AP: Record<AppealKey, { label: string; title: string; em: string; raised: number; goal: number }> = {
    zakat: { label: "Zakat", title: "Zakat appeal", em: "this Ramadan.", raised: 38240, goal: 50000 },
    sadaqah: { label: "Sadaqah", title: "Clean water for", em: "40 villages.", raised: 174961, goal: 250000 },
    iftar: { label: "Iftar", title: "Iftar meals,", em: "night by night.", raised: 24060, goal: 30000 },
    fidya: { label: "Fidya", title: "Fidya for", em: "missed fasts.", raised: 6400, goal: 10000 },
};
const AMOUNTS = [10, 25, 50, 100];
const PAGES = ["Donate page", "Fundraiser", "Leaderboard", "Team race", "Live screen"];
const SLUGS = ["give", "amina", "leaderboard", "teams", "live"];
const AUD = {
    mosques: ["Mosques", "Put the live total on the masjid screen and let the room give by QR code.", "The masjid screen"],
    charities: ["Charities", "Run every appeal from one place and watch gifts land as they happen.", "The appeal screen"],
    fundraisers: ["Fundraisers", "Give your team a page and race the others to the top of the leaderboard.", "The team screen"],
} as const;
type Aud = keyof typeof AUD;
const GIFTS: [string, number][] = [["Mateo and Sofia", 106], ["Ridge Runners", 340], ["Grace Mwangi", 45], ["Northfield Rotary", 250], ["Amara Okafor", 75], ["Bluefin Logistics", 500], ["St Hilda's Primary", 120]];
const STEPS = [
    ["Create", "Pick your cause, add your story and photos, set a goal. It takes about two minutes.", "Zakat, Sadaqah, Iftar and Fidya", "Free to start"],
    ["Share", "Send your link or show the QR code. Supporters can start their own fundraiser from it.", "One link and a QR code", "Supporters start their own fundraiser"],
    ["Give", "Donors pick an amount, add Gift Aid and pay. The receipt arrives straight away.", "Card, Apple Pay, Google Pay, PayPal, Direct Debit", "Gift Aid in one tap"],
    ["Race", "Put the live screen up and watch teams climb the leaderboard through the Last 10 Nights.", "Teams and individuals", "Updates as gifts arrive"],
] as const;
const NAV: [string, string][] = [["Features", "#pages"], ["Live nights", "#nights"], ["Pricing", "/pricing"], ["Leaderboard", "/leaderboard"]];
const FOOT: [string, [string, string][]][] = [
    ["Product", [["Ramadan giving page", "/ramadhan"], ["Fundraising pages", "/create"], ["Live screens", "/demo/live"], ["Leaderboards", "/leaderboard"], ["Checkout", "/checkout"]]],
    ["Resources", [["Pricing", "/pricing"], ["Blog", "/blog"], ["FAQ", "/faq"], ["Fundraising rules", "/rules"]]],
    ["Company", [["About", "/about"], ["Contact", "mailto:hello@outgive.tech"], ["Book a demo", "#demo"]]],
    ["Legal", [["Privacy policy", "/privacy"], ["Terms of service", "/terms"]]],
];
const money = (n: number) => n.toLocaleString("en-GB");
const d = (s: number) => ({ animationDelay: `${s}s` }) as CSSProperties;
const T = { title: { fontSize: 25, lineHeight: 1.05, letterSpacing: "-0.045em", fontWeight: 500 } as CSSProperties, pill: { minHeight: 24, padding: "0 8px", fontSize: 11 } as CSSProperties };

/** The crescent: an orange disc with a second disc cut out of its upper left. `id` keeps the gradient and mask unique. */
const Moon = ({ id, style, flat }: { id: string; style: CSSProperties; flat?: boolean }) => (
    <svg aria-hidden="true" viewBox="0 0 100 100" style={{ position: "absolute", ...style }}>
        <defs>
            <radialGradient id={`${id}g`} cx="40%" cy="30%" r="80%"><stop offset="0" stopColor="#FFA96F" /><stop offset="1" stopColor="#E9632A" /></radialGradient>
            <mask id={`${id}m`}><rect width="100" height="100" fill="#fff" /><circle cx="34" cy="36" r="43" fill="#000" /></mask>
        </defs>
        <circle cx="52" cy="52" r="46" fill={flat ? "#F0783C" : `url(#${id}g)`} mask={`url(#${id}m)`} />
    </svg>
);
const Live = ({ label = "Live" }: { label?: string }) => <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "#3E9A55" }} />{label}</span>;
const Check = () => <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="#D2DBA0" /><path d="m6 10 3 3 5-6" fill="none" stroke="#191919" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const QR = ({ size, label }: { size: number; label?: string }) => (
    <svg width={size} height={size} viewBox="0 0 21 21" shapeRendering="crispEdges" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
        <path fill="#191919" d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z" /><path fill="#fff" d="M1 1h5v5H1zM15 1h5v5h-5zM1 15h5v5H1z" />
        <path fill="#191919" d="M2 2h3v3H2zM16 2h3v3h-3zM2 16h3v3H2zM9 0h1v2H9zM11 1h2v1h-2zM8 3h2v2H8zM11 4h1v3h-1zM9 6h1v1H9zM0 9h2v1H0zM3 8h1v3H3zM5 9h2v1H5zM8 8h2v2H8zM11 9h3v1h-3zM15 8h1v2h-1zM17 9h2v1h-2zM20 8h1v3h-1zM9 11h2v2H9zM12 11h1v3h-1zM14 12h2v2h-2zM17 12h1v1h-1zM19 13h2v1h-2zM8 14h1v3H8zM10 15h2v1h-2zM14 15h1v2h-1zM16 16h2v2h-2zM19 15h1v3h-1zM9 18h2v2H9zM12 17h1v2h-1zM14 19h3v1h-3zM18 19h3v2h-3z" />
    </svg>
);
const LeaderRow = ({ n, name, v, top }: { n: number; name: string; v: string; top?: boolean }) => (
    <span className="v2-row" style={{ padding: "11px 12px", borderRadius: 14, background: top ? "#F4F3F0" : undefined, fontSize: 15 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 24, height: 24, borderRadius: 8, background: top ? "#F0783C" : "#EEE", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: top ? 600 : 400 }}>{n}</span>{name}</span>
        {top ? <strong style={{ fontWeight: 600 }}>{v}</strong> : <span>{v}</span>}
    </span>
);
const Race = ({ name, pct, fill = "#2F3A22", track = "rgba(255,255,255,.6)", v }: { name: string; pct: number; fill?: string; track?: string; v?: string }) => (
    <span style={{ display: "block" }}><span className="v2-row"><span>{name}</span><span>{v ?? `${pct}%`}</span></span><span style={{ display: "block", height: 8, borderRadius: 99, background: track, marginTop: 5 }}><span style={{ display: "block", width: `${pct}%`, height: "100%", borderRadius: 99, background: fill }} /></span></span>
);
const Field = ({ label, value }: { label: string; value: string }) => <div><p className="v2-lbl">{label}</p><p style={{ background: "#F4F3F0", borderRadius: 10, padding: "11px 12px", fontSize: 14, marginTop: 4 }}>{value}</p></div>;
const StepCard = ({ children, size = 15 }: { children: React.ReactNode; size?: number }) => <div className="v2-card v2-pop" style={{ width: "100%", maxWidth: 340, padding: 22, display: "flex", flexDirection: "column", gap: 14, fontSize: size }}>{children}</div>;
const Layout = ({ href, art, title, body }: { href: string; art: React.ReactNode; title: string; body: string }) => (
    <a href={href} className="v2-card v2-tilt" style={{ padding: "12px 12px 28px", textAlign: "center", display: "block" }}>
        {art}
        <h3 className="v2-t3" style={{ marginTop: 22 }}>{title}</h3><p className="v2-sub" style={{ fontSize: 16, marginTop: 6, padding: "0 16px" }}>{body}</p>
        <p style={{ display: "inline-block", fontWeight: 500, borderBottom: "1.5px solid #191919", marginTop: 16, paddingBottom: 3 }}>Try {title}</p>
    </a>
);

export const LandingV2 = () => {
    const [amount, setAmount] = useState(50);
    const [appeal, setAppeal] = useState<AppealKey>("sadaqah");
    const [gave, setGave] = useState(0);
    const [justGave, setJustGave] = useState(false);
    const [page, setPage] = useState(2);
    const [aud, setAud] = useState<Aud>("mosques");
    const [step, setStep] = useState(0);
    const [tick, setTick] = useState(0);
    const stepTimer = useRef<number | undefined>(undefined);

    const startSteps = () => { window.clearInterval(stepTimer.current); stepTimer.current = window.setInterval(() => setStep((s) => (s + 1) % 4), 6000); };
    useEffect(() => {
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
        const live = window.setInterval(() => setTick((t) => t + 1), 3400);
        startSteps();
        return () => { window.clearInterval(live); window.clearInterval(stepTimer.current); };
    }, []);

    const ap = AP[appeal]; const raised = ap.raised + gave; const pct = Math.min(100, Math.round((raised / ap.goal) * 1000) / 10);
    let liveTotal = 18962; for (let j = 1; j <= tick; j++) liveTotal += GIFTS[(2 + j) % 7][1];
    const when = tick === 0 ? ["2 min", "5 min", "8 min"] : ["just now", "1 min", "3 min"];
    const feed = [0, 1, 2].map((k) => { const g = GIFTS[(((2 + tick - k) % 7) + 7) % 7]; return { text: `${g[0]} gave £${g[1]}`, when: when[k] }; });
    const card = (i: number): CSSProperties => { const o = i - page, a = Math.abs(o); return { transform: `translateX(calc(-50% + ${o * 262}px)) translateY(${a * a * 14}px) rotate(${o * 5}deg) scale(${1 - a * 0.07})`, zIndex: 10 - a, opacity: a > 2 ? 0.35 : 1 }; };
    const st = STEPS[step];

    return (
        <div className="v2">
            <header className="v2-wrap" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px 32px", paddingTop: 18, paddingBottom: 18, fontSize: 15 }}>
                <a href="/" aria-label="Outgive home" style={{ display: "flex" }}><Logo size={26} /></a>
                <nav aria-label="Main" style={{ display: "flex", flexWrap: "wrap", gap: "0 26px" }}>{NAV.map(([l, h]) => <a key={l} className="v2-navl" href={h}>{l}</a>)}</nav>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}><a className="v2-navl" href="/login">Log in</a><a href="#demo" className="v2-btn v2-ink" style={{ minHeight: 44, padding: "0 20px", fontSize: 15 }}>Book a demo</a></div>
            </header>

            <main>
                <section id="top" className="v2-wrap" style={{ paddingTop: 64, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 26 }}>
                    <h1 className="v2-rise" style={{ fontSize: "clamp(48px, 7.2vw, 100px)", lineHeight: 0.98, letterSpacing: "-0.055em", fontWeight: 500, maxWidth: "10.5em" }}>Make this <span className="v2-sc v2-mark">Ramadan</span> your biggest appeal yet.</h1>
                    <p className="v2-sub v2-rise" style={{ maxWidth: "30em", fontSize: 18, ...d(0.1) }}>Launch your donation page in minutes, let supporters fundraise for you, and turn the Last 10 Nights into a live race.</p>
                    <div className="v2-rise" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "10px 12px", ...d(0.2) }}><a href="#demo" className="v2-btn v2-sage-btn">Book a demo</a><a href="/ramadhan" className="v2-btn v2-soft-btn">See a live Ramadan page</a></div>
                </section>

                <section className="v2-wrap v2-rise" style={{ paddingTop: 64, ...d(0.35) }}>
                    <div style={{ position: "relative", borderRadius: 36, background: "#F4F3F0", padding: "64px clamp(16px, 3vw, 40px) 28px", display: "flex", flexDirection: "column", gap: 36 }}>
                        <div className="v2-row v2-lbl" style={{ position: "absolute", top: 20, left: 26, right: 26 }}><Live label="Clearwell Trust, Ramadan appeal" /><span>Sample figures</span></div>
                        <div className="v2-stage">
                            <div className="v2-side" style={{ transform: "rotate(-4deg)", justifySelf: "end", width: "100%", maxWidth: 250 }}>
                                <div className="v2-float" style={{ background: "linear-gradient(170deg, #DDE5B4, #CFD99C)", borderRadius: "6px 6px 22px 6px", padding: "24px 22px 20px", textAlign: "left", boxShadow: "0 1px 0 rgba(255,255,255,.6) inset, 0 30px 40px -22px rgba(60,70,20,.5)" }}>
                                    <p className="v2-lbl" style={{ color: "#4B5530" }}>Gift Aid, built in</p>
                                    <p style={{ fontSize: 76, lineHeight: 1, letterSpacing: "-0.07em", fontWeight: 500, margin: "6px 0 14px" }}>+25<span style={{ fontSize: ".5em", verticalAlign: "top" }}>%</span></p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 14, color: "#4B5530", borderTop: "1.5px dashed #A8B46F", paddingTop: 12 }}>
                                        <div className="v2-row"><span>Your gift</span><span>£{amount.toFixed(2)}</span></div>
                                        <div className="v2-row"><span>Gift Aid</span><span>+ £{(amount * 0.25).toFixed(2)}</span></div>
                                        <div className="v2-row" style={{ color: "#191919", fontWeight: 600, marginTop: 4 }}><span>Clearwell Trust gets</span><span>£{(amount * 1.25).toFixed(2)}</span></div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ position: "relative" }}>
                                <div className="v2-card v2-floatb" style={{ position: "absolute", zIndex: 3, top: -44, right: -18, borderRadius: 999, padding: "8px 16px 8px 8px", display: "flex", alignItems: "center", gap: 10, fontSize: 14, whiteSpace: "nowrap" }}>
                                    <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: "50%", background: "#DDE5B4", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{justGave ? "You" : "GM"}</span>
                                    <span><strong style={{ fontWeight: 600 }}>{justGave ? "You" : "Grace Mwangi"}</strong> gave £{justGave ? amount : 45}</span><span className="v2-lbl">{justGave ? "just now" : "4 min ago"}</span>
                                </div>
                                <div className="v2-lilac" style={{ position: "relative", overflow: "hidden", borderRadius: 30, padding: 30, textAlign: "left", boxShadow: "inset 0 1px 0 rgba(255,255,255,.55), 0 0 0 1px rgba(90,50,160,.08), 0 40px 70px -28px rgba(90,50,160,.55)", display: "flex", flexDirection: "column", gap: 20 }}>
                                    <Moon id="hero" style={{ width: 210, height: 210, right: 18, top: -6 }} />
                                    <p className="v2-lbl" style={{ position: "relative", color: "#4A3A66", letterSpacing: "0.08em", fontSize: 11, fontWeight: 500 }}>CLEARWELL TRUST</p>
                                    <h2 style={{ position: "relative", fontSize: "clamp(34px, 3.6vw, 46px)", lineHeight: 1, letterSpacing: "-0.05em", fontWeight: 500, marginTop: 70 }}>{ap.title}<br /><span className="v2-sc">{ap.em}</span></h2>
                                    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8 }}>
                                        <div className="v2-row" style={{ fontSize: 14 }}><strong style={{ fontWeight: 600 }}>£{money(raised)} raised</strong><span style={{ color: "#4A3A66" }}>of £{money(ap.goal)}</span></div>
                                        <div className="v2-bar" style={{ background: "rgba(255,255,255,.55)" }}><span style={{ background: "#F0783C", width: `${pct}%`, transition: "width .7s cubic-bezier(.2,.8,.2,1)" }} /></div>
                                    </div>
                                    <div className="v2-row" style={{ position: "relative", flexWrap: "wrap" }}>
                                        <div role="group" aria-label="Choose an amount" style={{ display: "flex", gap: 6 }}>
                                            {AMOUNTS.map((v) => <button key={v} type="button" aria-pressed={v === amount} onClick={() => setAmount(v)} style={{ minWidth: 54, minHeight: 44, padding: "0 12px", borderRadius: 999, fontSize: 15, fontWeight: 500, textAlign: "center", background: v === amount ? "#191919" : "rgba(255,255,255,.75)", color: v === amount ? "#fff" : "#191919", transition: "background .2s, color .2s" }}>£{v}</button>)}
                                        </div>
                                        <button type="button" onClick={() => { setGave((g) => g + amount); setJustGave(true); }} className="v2-btn" style={{ background: "#F0783C", color: "#191919", minHeight: 44, padding: "0 22px", fontWeight: 600, boxShadow: "0 10px 20px -8px rgba(233,99,42,.8)" }}>Give £{amount}</button>
                                    </div>
                                </div>
                            </div>
                            <div className="v2-side" style={{ transform: "rotate(3deg)", justifySelf: "start", width: "100%", maxWidth: 270, position: "relative" }}>
                                <div className="v2-card v2-floatb" style={{ padding: 22, textAlign: "left", display: "flex", flexDirection: "column", gap: 16 }}>
                                    <div className="v2-row"><span style={{ fontWeight: 500, letterSpacing: "-0.02em" }}>Every gift doubled</span><span style={{ fontSize: 12, fontWeight: 500, background: "#FDE3D4", color: "#9A3A0E", borderRadius: 999, padding: "4px 10px" }}>£1 for £1</span></div>
                                    <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
                                        <div><p className="v2-lbl">You give</p><p style={{ fontSize: 34, letterSpacing: "-0.05em", fontWeight: 500, lineHeight: 1.1 }}>£{amount}</p></div>
                                        <svg width="28" height="34" viewBox="0 0 28 34" aria-hidden="true"><path d="M3 20h20m-7-7 7 7-7 7" fill="none" stroke="#191919" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        <div><p className="v2-lbl">Charity gets</p><p style={{ fontSize: 34, letterSpacing: "-0.05em", fontWeight: 500, lineHeight: 1.1, color: "#C24A14" }}>£{amount + Math.min(amount, 250)}</p></div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, color: "#6E6E6E", borderTop: "1px solid #EEE", paddingTop: 12 }}>
                                        <div className="v2-row"><span>Matched up to</span><span style={{ color: "#191919" }}>£250 a gift</span></div>
                                        <div className="v2-row"><span>Left in the match</span><span style={{ color: "#191919" }}>£5,000</span></div>
                                    </div>
                                </div>
                                <p className="v2-note v2-sc" aria-hidden="true" style={{ display: "block", fontSize: 15, color: "#6E6E6E", marginTop: 22, transform: "rotate(-6deg)", textAlign: "center" }}>a sponsor doubles it</p>
                            </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                            <div className="v2-seg v2-card" role="group" aria-label="Appeal type" style={{ alignItems: "center", borderRadius: 999 }}>
                                <span className="v2-lbl" style={{ padding: "0 10px 0 16px" }}>Appeal</span>
                                {(Object.keys(AP) as AppealKey[]).map((k) => <button key={k} type="button" aria-pressed={k === appeal} onClick={() => { setAppeal(k); setGave(0); setJustGave(false); }}>{AP[k].label}</button>)}
                            </div>
                        </div>
                    </div>
                </section>

                <section id="pages" className="v2-wrap" style={{ paddingTop: 136, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 22 }}>
                    <h2 className="v2-h2" style={{ maxWidth: "8em" }}>Every page your appeal needs.</h2>
                    <p className="v2-sub" style={{ maxWidth: "31em" }}>One appeal gives you a donate page, fundraiser and team pages, a leaderboard and a live screen. They all count toward the same total.</p>
                    <div className="v2-seg" role="group" aria-label="Pages" style={{ background: "#F4F3F0", justifyContent: "center", borderRadius: 28, marginTop: 6 }}>
                        {PAGES.map((l, i) => <button key={l} type="button" aria-pressed={i === page} onClick={() => setPage(i)} style={{ boxShadow: i === page ? "0 6px 14px -6px rgba(25,25,25,.6)" : "none" }}>{l}</button>)}
                    </div>
                    <p className="v2-lbl" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 10 }}>outgive.org/clearwell/{SLUGS[page]}<span style={{ background: "#EEF2D6", color: "#3F4A22", borderRadius: 6, padding: "2px 8px" }}>5 pages, one total</span></p>
                </section>
                <div className="v2-deck">
                    <button type="button" onClick={() => setPage(0)} aria-label="Donate page" className="v2-card v2-lilac" style={card(0)}>
                        <span className="v2-lbl" style={{ color: "#4A3A66" }}>Donate page</span>
                        <span style={{ ...T.title, fontSize: 27, marginTop: "auto" }}>Clean water for 40 villages.</span>
                        <span className="v2-bar" style={{ background: "rgba(255,255,255,.55)" }}><span style={{ width: "70%", background: "#F0783C" }} /></span>
                        <span style={{ display: "flex", gap: 6 }}>{AMOUNTS.map((v) => <span key={v} className={v === 50 ? "v2-chip v2-chip-on" : "v2-chip"}>£{v}</span>)}</span>
                    </button>
                    <button type="button" onClick={() => setPage(1)} aria-label="Fundraiser" className="v2-card v2-peach" style={card(1)}>
                        <span className="v2-lbl" style={{ color: "#7A4A2E" }}>Fundraiser</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}><span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: "50%", background: "#F0783C", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>A</span><span className="v2-lbl" style={{ color: "#7A4A2E" }}>Amina is fundraising<br />for Clearwell Trust</span></span>
                        <span style={T.title}>Amina's Ramadan walk for water</span>
                        <span className="v2-bar" style={{ background: "rgba(255,255,255,.7)" }}><span style={{ width: "74%", background: "#191919" }} /></span>
                        <span className="v2-row" style={{ fontSize: 14 }}><strong style={{ fontWeight: 600 }}>£1,850</strong><span style={{ color: "#7A4A2E" }}>of £2,500</span></span>
                    </button>
                    <button type="button" onClick={() => setPage(2)} aria-label="Leaderboard" className="v2-card" style={{ gap: 6, ...card(2) }}>
                        <span className="v2-row v2-lbl" style={{ paddingBottom: 8 }}><span>Leaderboard</span><Live /></span>
                        <LeaderRow n={1} name="Amara Okafor" v="£18,900" top /><LeaderRow n={2} name="Northfield Rotary" v="£16,861" /><LeaderRow n={3} name="Bluefin Logistics" v="£15,046" /><LeaderRow n={4} name="St Hilda's Primary" v="£13,430" />
                    </button>
                    <button type="button" onClick={() => setPage(3)} aria-label="Team race" className="v2-card v2-sage" style={card(3)}>
                        <span className="v2-lbl" style={{ color: "#4B5530" }}>Team race</span>
                        <span style={T.title}>Three teams, one total.</span>
                        <span style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: "auto", fontSize: 14 }}><Race name="Northfield Rotary" pct={82} /><Race name="Bluefin Logistics" pct={64} /><Race name="St Hilda's Primary" pct={41} /></span>
                    </button>
                    <button type="button" onClick={() => setPage(4)} aria-label="Live screen" className="v2-card v2-forest" style={{ color: "#EEF2D6", ...card(4) }}>
                        <span className="v2-lbl" style={{ color: "#C5CF9A" }}>Live screen</span>
                        <span style={{ marginTop: "auto" }}><span className="v2-lbl" style={{ color: "#C5CF9A", display: "block" }}>Night 27, raised tonight</span><span style={{ fontSize: 64, lineHeight: 1, letterSpacing: "-0.06em", fontWeight: 500, color: "#fff" }}>£18,962</span></span>
                        <span className="v2-bar" style={{ background: "rgba(255,255,255,.15)" }}><span style={{ width: "62%", background: "#F0783C" }} /></span>
                        <span className="v2-lbl" style={{ color: "#C5CF9A" }}>Updates as gifts arrive</span>
                    </button>
                </div>

                <section className="v2-wrap" style={{ paddingTop: 112 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "20px 48px", marginBottom: 56 }}>
                        <h2 className="v2-h2">More ways<br />to give.</h2>
                        <div style={{ maxWidth: "24em" }}><p className="v2-sub">Zakat, Sadaqah and Iftar each get their own appeal. Fidya, emergency and education appeals too.</p><a href="#demo" style={{ display: "inline-block", fontWeight: 500, borderBottom: "1.5px solid #191919", padding: "12px 0 4px" }}>Book a demo</a></div>
                    </div>
                    <div className="v2-ways" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28, alignItems: "start" }}>
                        <article className="v2-card v2-tilt" style={{ padding: "12px 12px 28px", transform: "rotate(-3deg) translateY(16px)" }}>
                            <div className="v2-sage" style={{ borderRadius: 16, padding: 26, minHeight: 230, display: "flex", alignItems: "center" }}>
                                <div className="v2-card" style={{ padding: 18, width: "100%", borderRadius: 18, transform: "rotate(3deg)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 12, background: "#2F3A22" }} /><span><span style={{ display: "block", fontSize: 14, fontWeight: 500 }}>Zakat appeal</span><span className="v2-lbl">Clearwell Trust</span></span></div>
                                    <div className="v2-row" style={{ marginTop: 16 }}><span style={{ fontSize: 30, letterSpacing: "-0.05em", fontWeight: 500 }}>£38,240</span><span className="v2-lbl">of £50,000</span></div>
                                    <div style={{ height: 6, borderRadius: 99, background: "#EEE", marginTop: 8 }}><div style={{ width: "76%", height: "100%", borderRadius: 99, background: "#191919" }} /></div>
                                </div>
                            </div>
                            <div style={{ padding: "22px 16px 0" }}><h3 className="v2-t3">Zakat</h3><p className="v2-sub" style={{ fontSize: 16, marginTop: 6 }}>Its own appeal page and goal, with a receipt for every gift.</p></div>
                        </article>
                        <article className="v2-card v2-tilt" style={{ padding: "12px 12px 28px", transform: "translateY(-14px)" }}>
                            <div style={{ background: "#F4F3F0", borderRadius: 16, padding: 22, minHeight: 230, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
                                {([["Water well", "One-off", "£6,000", "#D2DBA0"], ["Orphan care", "Monthly", "£20 / mo", "#C6AEE8"], ["Food packs", "One-off", "£45", "#F6B48F"]] as const).map(([n, k, v, c]) => (
                                    <div key={n} className="v2-card v2-row" style={{ padding: "12px 14px", borderRadius: 14, boxShadow: "0 0 0 1px rgba(25,25,25,.06), 0 6px 14px -8px rgba(25,25,25,.2)" }}><span style={{ display: "flex", alignItems: "center", gap: 10 }}><span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, background: c }} /><span><span style={{ display: "block", fontSize: 14, fontWeight: 500 }}>{n}</span><span className="v2-lbl">{k}</span></span></span><strong style={{ fontWeight: 600 }}>{v}</strong></div>
                                ))}
                            </div>
                            <div style={{ padding: "22px 16px 0" }}><h3 className="v2-t3">Sadaqah</h3><p className="v2-sub" style={{ fontSize: 16, marginTop: 6 }}>Give once or every month. Every gift goes straight to the charity.</p></div>
                        </article>
                        <article className="v2-card v2-tilt" style={{ padding: "12px 12px 28px", transform: "rotate(3deg) translateY(16px)" }}>
                            <div className="v2-peach" style={{ position: "relative", overflow: "hidden", borderRadius: 16, padding: 24, minHeight: 230 }}>
                                <p style={{ fontSize: 44, letterSpacing: "-0.06em", fontWeight: 500, lineHeight: 1, color: "#C24A14" }}>4,812 meals</p><p className="v2-lbl" style={{ color: "#7A4A2E", marginTop: 6 }}>and climbing, night by night</p>
                                <svg viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true" style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: 130 }}><path d="M0 110 C 70 106, 110 78, 160 70 S 250 40, 300 10 V120 H0Z" fill="#F7C3A4" opacity=".7" /><path d="M0 110 C 70 106, 110 78, 160 70 S 250 40, 300 10" fill="none" stroke="#F0783C" strokeWidth="3" /></svg>
                            </div>
                            <div style={{ padding: "22px 16px 0" }}><h3 className="v2-t3">Iftar</h3><p className="v2-sub" style={{ fontSize: 16, marginTop: 6 }}>Fund meals night by night and watch the total climb on the live screen.</p></div>
                        </article>
                    </div>
                </section>

                <section id="nights" style={{ background: "#191919", color: "#F2F2F2", marginTop: 136 }}>
                    <div className="v2-wrap" style={{ paddingTop: 120, paddingBottom: 120 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "24px 48px", marginBottom: 56 }}>
                            <h2 className="v2-h2" style={{ color: "#fff" }}>Light up the<br /><span className="v2-sc" style={{ color: "#D2DBA0" }}>last ten</span> nights.</h2>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, flex: "0 1 400px" }}>
                                <div className="v2-seg v2-seg-dark" role="group" aria-label="Who is it for" style={{ background: "#2A2A2A" }}>{(Object.keys(AUD) as Aud[]).map((k) => <button key={k} type="button" aria-pressed={k === aud} onClick={() => setAud(k)}>{AUD[k][0]}</button>)}</div>
                                <p style={{ fontSize: 16, lineHeight: 1.55, color: "#A8A8A8", minHeight: "3.1em" }}>{AUD[aud][1]}</p>
                            </div>
                        </div>
                        <div className="v2-flow">
                            <div className="v2-dcard" style={{ flex: "0 0 auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                                <p className="v2-lbl" style={{ color: "#A8A8A8" }}>A donor's phone</p>
                                <div style={{ width: 220, maxWidth: "100%", margin: "0 auto", borderRadius: 34, padding: 8, background: "#0E0E0E", boxShadow: "0 0 0 1px #3A3A3A" }}>
                                    <div className="v2-lilac" style={{ borderRadius: 27, padding: "22px 16px 16px", color: "#191919", display: "flex", flexDirection: "column", gap: 10 }}>
                                        <p style={{ fontSize: 9, letterSpacing: "0.08em", color: "#4A3A66" }}>CLEARWELL TRUST</p>
                                        <p style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.02em" }}>Iftar meals appeal</p>
                                        <p style={{ fontSize: 40, letterSpacing: "-0.06em", fontWeight: 500, lineHeight: 1 }}>£50</p>
                                        <div style={{ display: "flex", gap: 4 }}>{AMOUNTS.map((v) => <span key={v} className={v === 50 ? "v2-chip v2-chip-on" : "v2-chip"} style={T.pill}>£{v}</span>)}</div>
                                        <p style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}><span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 4, background: "#191919" }} />Add Gift Aid</p>
                                        <div style={{ borderRadius: 999, background: "#F0783C", textAlign: "center", fontSize: 13, fontWeight: 600, padding: 10 }}>Give £50</div>
                                    </div>
                                </div>
                            </div>
                            <div className="v2-conn" aria-hidden="true"><span /></div>
                            <div className="v2-dcard" style={{ flex: "0 1 250px", padding: 20, display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
                                <p className="v2-lbl" style={{ color: "#A8A8A8" }}>Gift Aid added</p>
                                <div className="v2-row" style={{ color: "#A8A8A8" }}><span>Gift</span><span>£50.00</span></div>
                                <div className="v2-row" style={{ color: "#A8A8A8" }}><span>Gift Aid</span><span style={{ color: "#D2DBA0" }}>+ £12.50</span></div>
                                <div className="v2-row" style={{ borderTop: "1px solid #3A3A3A", paddingTop: 10, fontWeight: 500, fontSize: 16 }}><span>Charity gets</span><span>£62.50</span></div>
                            </div>
                            <div className="v2-conn" aria-hidden="true"><span style={{ animationDelay: "1.2s" }} /></div>
                            <div className="v2-dcard" style={{ flex: "1 1 380px", minWidth: 0, padding: 14 }}>
                                <p className="v2-lbl" style={{ color: "#A8A8A8", padding: "4px 8px 12px" }}>{AUD[aud][2]}</p>
                                <div className="v2-forest" style={{ borderRadius: 14, padding: 26, display: "flex", flexDirection: "column", gap: 18 }}>
                                    <div className="v2-row" style={{ alignItems: "flex-start" }}>
                                        <div><p style={{ fontSize: 11, letterSpacing: "0.08em", color: "#C5CF9A" }}>NIGHT 27, RAISED TONIGHT</p><p aria-live="off" style={{ fontSize: "clamp(48px, 5.4vw, 72px)", lineHeight: 1.05, letterSpacing: "-0.06em", fontWeight: 500, color: "#fff", fontVariantNumeric: "tabular-nums" }}>£{money(liveTotal)}</p></div>
                                        <span className="v2-qr"><QR size={62} label="QR code to give" /></span>
                                    </div>
                                    <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,.14)" }}><div style={{ width: "62%", height: "100%", borderRadius: 99, background: "#F0783C" }} /></div>
                                    <ul style={{ fontSize: 14, color: "#EEF2D6" }}>
                                        <li key={tick} className="v2-row v2-pop" style={{ padding: "8px 0" }}><span style={{ display: "flex", alignItems: "center", gap: 8 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "#F0783C" }} />{feed[0].text}</span><span style={{ color: "#C5CF9A" }}>{feed[0].when}</span></li>
                                        <li className="v2-row" style={{ padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.1)", opacity: 0.8 }}><span>{feed[1].text}</span><span style={{ color: "#C5CF9A" }}>{feed[1].when}</span></li>
                                        <li className="v2-row" style={{ padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.1)", opacity: 0.6 }}><span>{feed[2].text}</span><span style={{ color: "#C5CF9A" }}>{feed[2].when}</span></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="v2-row" style={{ flexWrap: "wrap", marginTop: 40, fontSize: 14, color: "#A8A8A8" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}><span style={{ marginRight: 8 }}>Donors pay with</span>{["Card", "Apple Pay", "Google Pay", "PayPal", "Direct Debit"].map((p) => <span key={p} className="v2-chip" style={{ background: "#2A2A2A", color: "#F2F2F2", boxShadow: "none" }}>{p}</span>)}</div>
                            <a href="/demo/live" style={{ color: "#fff", fontWeight: 500, borderBottom: "1.5px solid #fff", padding: "12px 0 4px" }}>See a live screen</a>
                        </div>

                        <h2 className="v2-h2" style={{ color: "#fff", marginTop: 160, marginBottom: 48 }}>Build an appeal,<br />step by step.</h2>
                        <div role="group" aria-label="Steps" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                            {STEPS.map((x, i) => (
                                <button key={x[0]} type="button" aria-pressed={i === step} onClick={() => { setStep(i); if (stepTimer.current) startSteps(); }} style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 48, color: i === step ? "#fff" : "#8A8A8A", transition: "color .3s" }}>
                                    <span style={{ display: "block", height: 2, borderRadius: 2, background: "#3A3A3A", overflow: "hidden" }}>{i === step && <span key={step} className="v2-fill" style={{ display: "block", height: "100%", background: "#D2DBA0" }} />}</span>
                                    <span style={{ fontSize: 16, fontWeight: 500 }}><span style={{ color: "#8A8A8A", marginRight: 8 }}>{i + 1}</span>{x[0]}</span>
                                </button>
                            ))}
                        </div>
                        <div className="v2-dcard" style={{ marginTop: 18, padding: "clamp(24px, 4vw, 48px)", display: "flex", flexWrap: "wrap", gap: 40, alignItems: "stretch", borderRadius: 28 }}>
                            <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 40, minHeight: 300 }}>
                                <div><h3 style={{ fontSize: 36, letterSpacing: "-0.045em", fontWeight: 500, color: "#fff" }}>{st[0]}</h3><p style={{ fontSize: 17, lineHeight: 1.55, color: "#A8A8A8", marginTop: 12, maxWidth: "24em" }}>{st[1]}</p></div>
                                <ul style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 15 }}><li style={{ display: "flex", alignItems: "center", gap: 10 }}><Check />{st[2]}</li><li style={{ display: "flex", alignItems: "center", gap: 10 }}><Check />{st[3]}</li></ul>
                            </div>
                            <div key={step} style={{ flex: "1 1 320px", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#191919" }}>
                                {step === 0 && <StepCard>
                                    <p style={{ fontWeight: 500 }}>New appeal</p>
                                    <Field label="Appeal" value="Clean water for 40 villages" /><Field label="Goal" value="£250,000" />
                                    <div><p className="v2-lbl">Type</p><p style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>{["Zakat", "Sadaqah", "Iftar", "Fidya"].map((t) => <span key={t} className={t === "Sadaqah" ? "v2-chip v2-chip-on" : "v2-chip"}>{t}</span>)}</p></div>
                                    <p style={{ background: "#191919", color: "#fff", borderRadius: 999, textAlign: "center", padding: 13, fontSize: 14, fontWeight: 500 }}>Publish appeal</p>
                                </StepCard>}
                                {step === 1 && <StepCard>
                                    <p style={{ fontWeight: 500 }}>Share your appeal</p>
                                    <div className="v2-row" style={{ background: "#F4F3F0", borderRadius: 10, padding: "6px 6px 6px 12px", fontSize: 14 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>outgive.org/clearwell/water</span><span style={{ background: "#191919", color: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 13, whiteSpace: "nowrap" }}>Copy link</span></div>
                                    <div className="v2-row v2-lilac" style={{ borderRadius: 14, padding: 16 }}><span style={{ fontSize: 20, letterSpacing: "-0.04em", fontWeight: 500, lineHeight: 1.1 }}>Scan to give</span><span style={{ background: "#fff", borderRadius: 8, padding: 6, display: "inline-flex" }}><QR size={56} /></span></div>
                                    <div className="v2-row" style={{ fontSize: 14, border: "1px solid #E6E6E6", borderRadius: 10, padding: "11px 12px" }}><span>Amina started a fundraiser</span><span className="v2-lbl">just now</span></div>
                                </StepCard>}
                                {step === 2 && <StepCard>
                                    <p style={{ fontWeight: 500 }}>Your gift</p>
                                    <p style={{ fontSize: 56, letterSpacing: "-0.06em", fontWeight: 500, lineHeight: 1 }}>£50</p>
                                    <div className="v2-row" style={{ background: "#EEF2D6", borderRadius: 10, padding: "11px 12px", fontSize: 14 }}><span>Gift Aid added</span><strong style={{ fontWeight: 600 }}>+ £12.50</strong></div>
                                    <p style={{ display: "flex", flexWrap: "wrap", gap: 6 }}><span className="v2-chip v2-chip-on">Apple Pay</span><span className="v2-chip">Card</span><span className="v2-chip">PayPal</span></p>
                                    <p style={{ background: "#F0783C", borderRadius: 999, textAlign: "center", padding: 13, fontSize: 14, fontWeight: 600 }}>Give £50</p>
                                </StepCard>}
                                {step === 3 && <StepCard size={14}>
                                    <div className="v2-row"><span style={{ fontWeight: 500, fontSize: 16 }}>Night 27 race</span><span className="v2-lbl"><Live /></span></div>
                                    <Race name="Northfield Rotary" pct={82} v="£16,861" fill="#F0783C" track="#EEE" /><Race name="Bluefin Logistics" pct={64} v="£15,046" fill="#191919" track="#EEE" /><Race name="St Hilda's Primary" pct={41} v="£13,430" fill="#191919" track="#EEE" />
                                </StepCard>}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="v2-wrap" style={{ paddingTop: 136 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 18, marginBottom: 56 }}><h2 className="v2-h2">Make it your own.</h2><p className="v2-sub">Three donate page layouts. Pick the one that suits your appeal.</p></div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
                        <Layout href={donateHref("hero")} title="Hero stage" body="A big amount dial with the impact beside it." art={
                            <div className="v2-lilac" style={{ position: "relative", overflow: "hidden", borderRadius: 16, padding: 26, minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Moon id="lay" flat style={{ width: 90, height: 90, right: 14, top: 10 }} />
                                <div className="v2-card" style={{ position: "relative", padding: 18, width: "78%", textAlign: "left", borderRadius: 18 }}><p className="v2-lbl">Your gift</p><p style={{ fontSize: 46, letterSpacing: "-0.06em", fontWeight: 500, lineHeight: 1.05 }}>£50</p><p className="v2-lbl">£62.50 to the charity with Gift Aid</p><p style={{ background: "#191919", color: "#fff", borderRadius: 999, textAlign: "center", padding: 9, fontSize: 13, fontWeight: 500, marginTop: 12 }}>Give £50</p></div>
                            </div>} />
                        <Layout href={donateHref("pledge")} title="Pledge" body="The gift reads as one sentence with tappable words." art={
                            <div className="v2-sage" style={{ borderRadius: 16, padding: 26, minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div className="v2-card" style={{ padding: 20, textAlign: "left", borderRadius: 18 }}><p style={{ fontSize: 23, lineHeight: 1.75, letterSpacing: "-0.03em", fontWeight: 500 }}>I'll give <span style={{ background: "#E3EABF", borderRadius: 8, padding: "3px 9px" }}>£50</span> <span style={{ background: "#E7DBF7", borderRadius: 8, padding: "3px 9px" }}>every night</span> for <span style={{ background: "#FDE3D4", borderRadius: 8, padding: "3px 9px" }}>orphan care</span>.</p></div>
                            </div>} />
                        <Layout href={donateHref("ticket")} title="Gift ticket" body="One question at a time, with a ticket that becomes the receipt." art={
                            <div className="v2-peach" style={{ borderRadius: 16, padding: 26, minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div className="v2-card" style={{ padding: "18px 20px", transform: "rotate(-5deg)", width: "74%", textAlign: "left", borderRadius: 14 }}><div className="v2-row v2-lbl" style={{ fontSize: 11, letterSpacing: "0.08em" }}><span>GIFT TICKET</span><span>NO. 0147</span></div><p style={{ fontSize: 44, lineHeight: 1.1, letterSpacing: "-0.06em", fontWeight: 500 }}>£50</p><p style={{ fontSize: 13 }}>Iftar meals, Night 27</p><p className="v2-lbl" style={{ borderTop: "1.5px dashed #DDD", paddingTop: 8, marginTop: 10 }}>Becomes your receipt</p></div>
                            </div>} />
                    </div>
                </section>

                <section id="start" className="v2-wrap" style={{ paddingTop: 136, paddingBottom: 64 }}>
                    <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(170deg, #3A4829 0%, #27311B 100%)", color: "#EEF2D6", borderRadius: 40, padding: "clamp(56px, 8vw, 104px) 24px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 26, boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)" }}>
                        <Moon id="end" style={{ width: 300, height: 300, right: -70, top: -90 }} />
                        <h2 style={{ position: "relative", fontSize: "clamp(64px, 10vw, 140px)", lineHeight: 1.1, letterSpacing: "-0.06em", fontWeight: 500, color: "#fff", marginBottom: 20 }}>Start <span className="v2-sc" style={{ color: "#D2DBA0" }}>giving.</span></h2>
                        <p style={{ position: "relative", fontSize: 17, lineHeight: 1.55, maxWidth: "27em" }}>Gifts are paid into the charity's own Stripe account. They never pass through a fundraiser's hands, or ours.</p>
                        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
                            <a href="#demo" className="v2-btn" style={{ background: "#D2DBA0", color: "#191919" }}>Book a demo</a>
                            <a href="/ramadhan" className="v2-btn" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}>See a live Ramadan page</a>
                            <a href="/pricing" className="v2-btn" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}>See pricing</a>
                        </div>
                        <dl style={{ position: "relative", width: "100%", maxWidth: 720, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 40, borderTop: "1px solid rgba(255,255,255,.14)" }}>
                            {[["£0", "to start"], ["0%", "platform fee"], ["+25%", "Gift Aid"]].map(([v, k]) => <div key={k} style={{ padding: "32px 8px 48px", display: "flex", flexDirection: "column-reverse" }}><dt style={{ fontSize: 14, color: "#C5CF9A" }}>{k}</dt><dd style={{ fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-0.05em", fontWeight: 500, color: "#D2DBA0" }}>{v}</dd></div>)}
                        </dl>
                    </div>
                </section>
            </main>

            <footer className="v2-wrap" style={{ paddingTop: 32, paddingBottom: 40, fontSize: 15, color: "#666" }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "40px 56px", borderTop: "1px solid #EEE", paddingTop: 48 }}>
                    <a href="/" aria-label="Outgive home" style={{ display: "flex", alignSelf: "flex-start" }}><Logo size={26} /></a>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "32px 80px" }}>
                        {FOOT.map(([t, links]) => <div key={t} style={{ display: "flex", flexDirection: "column" }}><strong style={{ color: "#191919", fontWeight: 600, padding: "6px 0" }}>{t}</strong>{links.map(([l, h]) => <a key={l} className="v2-navl" style={{ padding: "6px 0" }} href={h}>{l}</a>)}</div>)}
                    </div>
                </div>
                <p style={{ fontSize: 14, marginTop: 48 }}>© 2026 Outgive</p>
            </footer>
            <DemoRequest />
        </div>
    );
};
