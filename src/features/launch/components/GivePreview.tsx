/**
 * The landing page's donate-flow preview: the menu and maths of /ramadhan/give (give/model.ts) in a phone frame.
 * It keeps its own state and never touches the shared basket (give/store.ts), so playing here leaves /ramadhan as it was.
 * Nothing is charged; "Pay" only waits a moment and shows the thank-you.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CauseArt, ILLUSTRATION_BG } from "../bio/illustrations";
import { DEFAULT_PAGE } from "../bio/model";
import { type Choice, LEVELS, MODES, type Mode, gbp, impactOf, itemCount, levelOf, menuFrom, quote } from "../give/model";

const ORG = DEFAULT_PAGE.name;
const SHOWN = ["food", "water", "orphans", "fitr"];
const ALL = menuFrom(DEFAULT_PAGE);
const MENU = SHOWN.flatMap((id) => ALL.filter((i) => i.id === id));
const NIGHTS = MODES.filter(([m]) => ["30", "10", "odd", "once"].includes(m));
const METHODS: [string, string][] = [["Apple Pay", "/pay/apple-pay.svg"], ["Card", "/pay/card.svg"], ["PayPal", "/pay/paypal.svg"]];
const STEPS = [
    ["Menu", "Causes sit on a menu, each with a price. Donors tap ADD, the way they would order dinner."],
    ["Nights", "All thirty, the last ten, the odd nights, or a single gift today."],
    ["Pay", "Gift Aid in one tap, then Apple Pay, Google Pay, PayPal or a card."],
    ["Thank you", "A receipt, what the gift funded, and a level to beat next time."],
] as const;
const TITLES = [ORG, "Your basket", "Pay", "Thank you"];

const Sign = ({ minus }: { minus?: boolean }) => <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d={minus ? "M2 6h8" : "M2 6h8M6 2v8"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
const Tile = ({ art }: { art: string }) => <span className="gp-tile" style={{ background: ILLUSTRATION_BG[art as keyof typeof ILLUSTRATION_BG] ?? "#F4F3F0" }}><CauseArt name={art} /></span>;
const Stepper = ({ n, name, add }: { n: number; name: string; add: (by: number) => void }) => n === 0
    ? <button type="button" className="gp-add" onClick={() => add(1)} aria-label={`Add ${name}`}>ADD<Sign /></button>
    : (
        <span className="gp-step" role="group" aria-label={`${name}: ${n}`}>
            <button type="button" onClick={() => add(-1)} aria-label={`One less ${name}`}><Sign minus /></button>
            <b aria-live="polite">{n}</b>
            <button type="button" onClick={() => add(1)} aria-label={`One more ${name}`}><Sign /></button>
        </span>
    );
const Line = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => <p className={strong ? "gp-line strong" : "gp-line"}><span>{k}</span><span>{v}</span></p>;

export const GivePreview = () => {
    const [step, setStep] = useState(0);
    const [qty, setQty] = useState<Record<string, number>>({ food: 2, water: 1 });
    const [mode, setMode] = useState<Mode>("10");
    const [giftAid, setGiftAid] = useState(true);
    const [method, setMethod] = useState(0);
    const [paying, setPaying] = useState(false);
    const title = useRef<HTMLParagraphElement>(null);
    const moved = useRef(false);
    const timer = useRef<number | undefined>(undefined);

    const q = useMemo(() => {
        const ch: Choice = { qty, mode, picked: [], boost: 0, roundUp: false, cover: false, giftAid, tip: 0, qadr: 0, extra: 0 };
        return quote(ch, MENU);
    }, [qty, mode, giftAid]);
    const count = itemCount(qty), empty = q.total <= 0;
    const nights = q.nightly > 0 ? q.nights.length : 0;
    const level = levelOf(q.nightly);
    const impact = impactOf(q.gifts - q.onceItems, qty, MENU);
    const add = (id: string) => (by: number) => setQty((x) => { const n = Math.max(0, (x[id] ?? 0) + by), { [id]: _, ...rest } = x; return n ? { ...rest, [id]: n } : rest; });
    const go = (s: number) => { window.clearTimeout(timer.current); setPaying(false); moved.current = true; setStep(s); };
    const pay = () => { setPaying(true); timer.current = window.setTimeout(() => go(3), 1100); };
    const again = () => { setQty({ food: 2, water: 1 }); setMode("10"); setGiftAid(true); go(0); };

    // A step's own button unmounts when the screen changes, so focus moves to the new screen's title.
    useEffect(() => { if (moved.current && title.current?.closest(".gp-phone")?.contains(document.activeElement)) title.current.focus(); }, [step]);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    const items = MENU.filter((i) => qty[i.id]);
    const given = nights ? `${nights} nights` : "One-off";

    return (
        <div className="v2-give">
            <div className="gp-copy">
                <h2 className="v2-h2">Fill a basket.<br />Give it every night.</h2>
                <p className="v2-sub" style={{ maxWidth: "27em" }}>The Ramadan donate flow works like a delivery app. Try it here: the phone runs the flow's own menu and sums, and nothing is charged.</p>
                <ol className="gp-steps">
                    {STEPS.map(([t, body], i) => (
                        <li key={t}>
                            <button type="button" aria-current={i === step ? "step" : undefined} onClick={() => go(i)} disabled={empty && i > 0}>
                                <span className="gp-n" aria-hidden="true">{i + 1}</span>
                                <span><b>{t}</b><span>{body}</span></span>
                            </button>
                        </li>
                    ))}
                </ol>
                <a href="/ramadhan/give" className="v2-btn v2-ink gp-open">Open the full donate flow</a>
            </div>

            <div className="gp-stage">
                <div className="gp-phone" role="group" aria-label="Donate flow preview">
                    <div className="gp-screen">
                        <div className="gp-top">
                            {step > 0 && step < 3 ? <button type="button" className="gp-back" onClick={() => go(step - 1)} aria-label="Back"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button> : <span className="gp-av" aria-hidden="true">{DEFAULT_PAGE.avatar}</span>}
                            <p ref={title} tabIndex={-1} className="gp-title"><b>{TITLES[step]}</b><small>{step === 0 ? DEFAULT_PAGE.tagline : step === 3 ? ORG : `Step ${step + 1} of 4`}</small></p>
                            <span className="gp-dots" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i <= step ? "on" : undefined} />)}</span>
                        </div>

                        {step === 0 && (
                            <div key="menu" className="gp-body">
                                <ul className="gp-menu">
                                    {MENU.map((i) => (
                                        <li key={i.id}>
                                            <Tile art={i.art} />
                                            <span className="gp-item"><b>{i.title}</b><small>{gbp(i.price)} {i.per}</small><small className="gp-when">{i.once ? "Given once" : "Given nightly"}</small></span>
                                            <Stepper n={qty[i.id] ?? 0} name={i.title} add={add(i.id)} />
                                        </li>
                                    ))}
                                </ul>
                                <button type="button" className="gp-bar" onClick={() => go(1)} disabled={empty}>
                                    <span><small>{empty ? "Your basket is empty" : `${count} ${count === 1 ? "item" : "items"} added`}</small><b>{empty ? "Add a cause to start" : q.basket ? `${gbp(q.basket)} a night${q.onceItems ? ` + ${gbp(q.onceItems)}` : ""}` : `${gbp(q.onceItems)} today`}</b></span>
                                    <span className="gp-bar-r">View basket</span>
                                </button>
                            </div>
                        )}

                        {step === 1 && (
                            <div key="nights" className="gp-body">
                                <ul className="gp-card gp-cart">
                                    {items.map((i) => <li key={i.id}><span className="gp-item"><b>{i.title}</b><small>{gbp(i.price)} {i.per}{i.once ? ", once" : ""}</small></span><Stepper n={qty[i.id]} name={i.title} add={add(i.id)} /></li>)}
                                    {!items.length && <li><small>Your basket is empty.</small></li>}
                                </ul>
                                <div className="gp-card">
                                    <p className="gp-h">Which nights</p>
                                    <div className="gp-modes" role="radiogroup" aria-label="Which nights">
                                        {NIGHTS.map(([m, l]) => <button key={m} type="button" role="radio" aria-checked={m === mode} onClick={() => setMode(m)}>{l}</button>)}
                                    </div>
                                    <p className="gp-hint">{MODES.find(([m]) => m === mode)?.[2]}</p>
                                </div>
                                <div className="gp-card gp-bill">
                                    {nights > 0 && <Line k={`${gbp(q.nightly)} × ${nights} nights`} v={gbp(q.nightly * nights)} />}
                                    {q.charges[0]?.night === 0 && <Line k="Today" v={gbp(q.charges[0].gift)} />}
                                    <Line k="Total" v={gbp(q.total)} strong />
                                </div>
                                <button type="button" className="gp-cta" onClick={() => go(2)} disabled={empty}>Continue</button>
                            </div>
                        )}

                        {step === 2 && (
                            <div key="pay" className="gp-body">
                                <button type="button" role="switch" aria-checked={giftAid} className="gp-card gp-aid" onClick={() => setGiftAid(!giftAid)}>
                                    <span><b>Add Gift Aid</b><small>{giftAid ? `${ORG} claims ${gbp(q.gifts * 0.25)} more, at no cost to you` : "UK taxpayers add 25% at no cost"}</small></span>
                                    <span className="gp-sw" aria-hidden="true" />
                                </button>
                                <div className="gp-card">
                                    <p className="gp-h">Pay with</p>
                                    <div className="gp-methods" role="radiogroup" aria-label="Pay with">
                                        {METHODS.map(([l, src], i) => <button key={l} type="button" role="radio" aria-checked={i === method} onClick={() => setMethod(i)}><img src={src} alt="" width="38" height="24" loading="lazy" /><b>{l}</b><span className="gp-radio" aria-hidden="true" /></button>)}
                                    </div>
                                </div>
                                <div className="gp-card gp-bill">
                                    <Line k={`Your gift, ${given.toLowerCase()}`} v={gbp(q.gifts)} />
                                    {giftAid && <Line k="Gift Aid" v={`+ ${gbp(q.giftAid)}`} />}
                                    <Line k={`${ORG} gets`} v={gbp(q.gifts + q.giftAid)} strong />
                                </div>
                                <button type="button" className="gp-cta gp-pay" onClick={pay} disabled={empty || paying} aria-live="polite">{paying ? `Sending ${gbp(q.total)}` : `Give ${gbp(q.total)}`}</button>
                            </div>
                        )}

                        {step === 3 && (
                            <div key="done" className="gp-body gp-done">
                                <svg className="gp-tick" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" /><path d="M36 62l16 16 32-34" /></svg>
                                <p className="gp-big">Gift confirmed</p>
                                <p className="gp-hint">JazakAllahu khayran</p>
                                {impact && <p className="gp-impact">{impact}, funded</p>}
                                <div className="gp-card gp-bill" style={{ width: "100%" }}>
                                    <Line k="Donation" v={gbp(q.gifts)} />
                                    <Line k="Gift Aid claimed" v={giftAid ? gbp(q.giftAid) : "Not claimed"} />
                                    <Line k="Given as" v={given} />
                                    {level > 0 && <Line k={`Level ${level}`} v={LEVELS[level - 1][1]} />}
                                    <Line k="Paid with" v={METHODS[method][0]} strong />
                                </div>
                                <button type="button" className="gp-cta gp-ghost" onClick={again}>Start again</button>
                            </div>
                        )}
                    </div>
                </div>
                <p className="v2-lbl gp-fine">A preview with sample prices. Nothing is charged.</p>
            </div>
        </div>
    );
};
