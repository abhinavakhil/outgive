import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import { CURRENCIES, FONTS } from "@/shared/domain/model";
import type { Org } from "@/shared/domain/types";
import { initials } from "@/shared/lib/format";
import { ALL_VARIANTS } from "@/features/leaderboard";
import { SignIn } from "@/features/auth";
import { Coin, GiftBox } from "@/features/launch";
import "../start.css";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
/** What the address box keeps while typing: dashes at the ends stay (so "clear-well" can be typed) and the live check flags them. */
const tidy = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").slice(0, 40);
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const SWATCHES: [string, string][] = [["#2b59ff", "Blue"], ["#7A2FA6", "Orchid"], ["#E0457B", "Pink"], ["#E0603F", "Coral"], ["#D9920B", "Amber"], ["#0E8F62", "Green"], ["#1A1C1A", "Ink"]];
/** Black or white, whichever reads on the colour. */
const onColor = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160 ? "#14121A" : "#fff"; };
/** Sample supporters for the preview, in USD. */
const SAMPLE: [string, number][] = [["Amara Okafor", 2400], ["Harbour Runners", 1850], ["Yusuf Ali", 920]];
const STEPS = ["Organisation", "Your page", "Details"];
/** The three layouts drawn as thumbnails; every other layout is in the fourth tile's list. */
const LAYOUTS: [string, ReactNode][] = [
    ["list", <><rect x="0" y="1" width="44" height="7" rx="3.5" /><rect x="0" y="12" width="44" height="7" rx="3.5" opacity=".55" /><rect x="0" y="23" width="44" height="7" rx="3.5" opacity=".3" /></>],
    ["podium", <><rect x="1" y="12" width="12" height="18" rx="3" opacity=".55" /><rect x="16" y="2" width="12" height="28" rx="3" /><rect x="31" y="19" width="12" height="11" rx="3" opacity=".3" /></>],
    ["race", <><rect x="0" y="1" width="44" height="7" rx="3.5" /><rect x="0" y="12" width="30" height="7" rx="3.5" opacity=".55" /><rect x="0" y="23" width="16" height="7" rx="3.5" opacity=".3" /></>],
];
const Arrow = ({ back }: { back?: boolean }) => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={back ? { transform: "scaleX(-1)" } : undefined}><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/** A charity creates its organisation, one short step at a time, while the board draws its page. Stripe is connected next, from the dashboard. */
export const Start = () => {
    const { db, user, go, href, isDemo } = useApp();
    // Older home pages link here with ?goal=…; it becomes the first tagline.
    const [f, setF] = useState(() => ({ name: "", slug: "", tagline: (new URLSearchParams(window.location.search).get("goal") ?? "").slice(0, 80), description: "", color: "#2b59ff", font: "Inter", variant: "list", currency: "USD", country: "", registration_number: "", website: "", impact_unit: "", impact_usd: "" }));
    const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));
    const [step, setStep] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [tried, setTried] = useState(false);
    const [touched, setTouched] = useState(false);
    const [taken, setTaken] = useState("");
    const heading = useRef<HTMLHeadingElement>(null);
    const moved = useRef(false);
    // A new step announces itself: focus goes to its heading (not on first load).
    useEffect(() => { if (moved.current) heading.current?.focus(); moved.current = true; }, [step]);

    const slug = f.slug || slugify(f.name);
    const slugOk = SLUG.test(slug);
    const nameErr = (tried || touched) && !f.name.trim() ? "Give your organisation a name." : "";
    const slugErr = taken && taken === slug ? "That address is taken. Pick another." : (f.slug || (tried && f.name.trim())) && !slugOk ? "The address can only have letters, numbers and dashes, and must start and end with a letter or number." : "";
    const signedIn = !!user || isDemo;
    const money = (usd: number) => new Intl.NumberFormat("en", { style: "currency", currency: f.currency, maximumFractionDigits: 0 }).format(usd * (CURRENCIES[f.currency] ?? 1));
    const custom = !SWATCHES.some(([c]) => c.toLowerCase() === f.color.toLowerCase());
    const layoutName = ALL_VARIANTS.find(([k]) => k === f.variant)?.[1] ?? "List";
    const kind = f.variant.includes("podium") ? "podium" : f.variant === "race" ? "race" : "list";

    /** Step one's check: the name and the address. Returns true when both are fine; otherwise shows step one and focuses the problem. */
    const identityOk = () => {
        setTried(true);
        const bad = !f.name.trim() ? "st-name" : !slugOk || taken === slug ? "st-slug" : "";
        if (bad) { setStep(0); requestAnimationFrame(() => document.getElementById(bad)?.focus()); }
        return !bad;
    };
    const submit = async () => {
        if (!identityOk()) return;
        setBusy(true); setError("");
        try { const o = await db.rpc<Org>("org_create", { p: { ...f, slug, impact_usd: f.impact_usd || null } }); go({ name: "admin", org: o.slug, tab: "payments" }); }
        catch (e) { if ((e as Error).message.includes("orgs_slug_key")) { setTaken(slug); setStep(0); requestAnimationFrame(() => document.getElementById("st-slug")?.focus()); } else setError((e as Error).message); }
        finally { setBusy(false); }
    };
    const forward = () => { if (step === 2) return void submit(); if (identityOk()) setStep(step + 1); };
    const text = (k: keyof typeof f, label: string, placeholder: string, extra?: { type?: string; note?: string; inputMode?: "decimal" | "url"; autoComplete?: string }) => (
        <div className="st-field"><label className="st-label" htmlFor={`st-${k}`}>{label}{extra?.note && <small>{extra.note}</small>}</label><input id={`st-${k}`} className="st-in" type={extra?.type ?? "text"} inputMode={extra?.inputMode} autoComplete={extra?.autoComplete} min={extra?.type === "number" ? 0 : undefined} value={f[k]} onChange={(e) => set(k)(e.target.value)} placeholder={placeholder} /></div>
    );

    return (
        <div className="st">
            <section className="st-board" aria-label="Your page so far">
                <Coin className="st-prop" style={{ width: 84, right: 34, top: 96, transform: "rotate(-10deg)" }} />
                <GiftBox className="st-prop" style={{ width: 112, right: -22, bottom: -6, transform: "rotate(10deg)" }} />
                <div className="st-top">
                    <a className="st-logo" href={href({ name: "landing" })} aria-label="Outgive home">
                        <svg width="34" height="24" viewBox="0 0 34 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="#F2DC3B" strokeWidth="3.5" /><circle cx="22" cy="12" r="10" fill="none" stroke="#fff" strokeWidth="3.5" /></svg>Outgive
                    </a>
                    <span className="st-free st-mono">Free to start</span>
                </div>
                <h1>Your giving page, live in <em>two minutes</em></h1>
                <figure className="st-pv">
                    <div className="st-win" data-preview aria-hidden="true" style={{ "--c": f.color, "--on": onColor(f.color), fontFamily: `"${f.font}", "Schibsted Grotesk", sans-serif` } as CSSProperties}>
                        <div className="st-bar"><i /><i /><i /><span className="st-mono" data-pv="url">outgive.tech/o/<b>{slugOk ? slug : "your-charity"}</b></span></div>
                        <div className="st-page">
                            <div className="st-id">
                                <span className="st-tile">{initials(f.name) || <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 20s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.400-7 10-7 10z" fill="currentColor" /></svg>}</span>
                                <strong data-pv="name" className={f.name ? undefined : "st-ghost"}>{f.name || "Your organisation"}</strong>
                                <span className="st-on"><i />3 on the board</span>
                            </div>
                            <div className="st-hero">
                                <span>Take #1 for</span><b>{money(SAMPLE[0][1] + 1)}</b>
                                <p data-pv="tagline" className={f.tagline ? undefined : "st-ghost"}>{f.tagline || "Your tagline goes here"}</p>
                            </div>
                            <div className="st-claim"><span>Your name, team or company</span><b>Claim rank</b></div>
                            <div className="st-body" key={kind} data-pv="board" data-kind={kind}>
                                {kind === "podium" ? <ol className="st-podium">{[1, 0, 2].map((i) => <li key={i}><i>{initials(SAMPLE[i][0])}</i><span>{SAMPLE[i][0]}</span><b>{money(SAMPLE[i][1])}</b></li>)}</ol>
                                    : kind === "race" ? <ol className="st-race">{SAMPLE.map(([n, usd]) => <li key={n}><span>{n}</span><b>{money(usd)}</b><em style={{ width: `${(usd / SAMPLE[0][1]) * 100}%` }} /></li>)}</ol>
                                    : <ol className="st-rows">{SAMPLE.map(([n, usd], i) => <li key={n}><span>#{i + 1}</span><i>{initials(n)}</i>{n}<b>{money(usd)}</b></li>)}</ol>}
                            </div>
                        </div>
                    </div>
                    <figcaption className="st-mono"><i aria-hidden="true" />Live preview<span>· <span data-pv="variant">{layoutName}</span> board · sample supporters</span></figcaption>
                </figure>
            </section>

            <main className="st-sheet">
                {!signedIn ? (
                    <div className="st-form st-out">
                        <div className="st-head"><h2>Sign in to start</h2><p>Your account becomes the organisation's owner. After that it is one short form, then Stripe.</p></div>
                        <div className="st-signin"><SignIn next="/start" title="Email or Google" sub="We email you a link, or use your Google account. No password." /></div>
                    </div>
                ) : (
                    <form className="st-form" noValidate onSubmit={(e) => { e.preventDefault(); forward(); }}>
                        <nav aria-label="Setup progress">
                            <ol className="st-steps">{STEPS.map((s, i) => (
                                <li key={s} data-state={i < step ? "done" : i === step ? "now" : "todo"} aria-current={i === step ? "step" : undefined}>
                                    <button type="button" className="st-mono" disabled={i >= step} onClick={() => setStep(i)} aria-label={`Step ${i + 1} of 3: ${s}${i < step ? ", done. Go back to it" : ""}`}>
                                        <span>{i + 1}<b>{s}</b><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                                    </button>
                                </li>
                            ))}</ol>
                        </nav>

                        {step === 0 && <div className="st-step" key="0">
                            <div className="st-head"><h2 ref={heading} tabIndex={-1}>What is your organisation called?</h2><p>The name supporters see on your page and their receipts. You can change it later.</p></div>
                            <div className="st-field">
                                <label className="st-label" htmlFor="st-name">Organisation name</label>
                                <input id="st-name" className="st-in st-big" value={f.name} onChange={(e) => set("name")(e.target.value)} onBlur={() => setTouched(true)} placeholder="Clearwell Trust" autoComplete="organization" required aria-required="true" aria-invalid={!!nameErr} aria-describedby={nameErr ? "st-name-err" : undefined} />
                                {nameErr && <p id="st-name-err" className="st-err" role="alert">{nameErr}</p>}
                            </div>
                            <div className="st-field">
                                <label className="st-label" htmlFor="st-slug">Page address</label>
                                <div className="st-url"><span className="st-mono">outgive.tech/o/</span><input id="st-slug" value={f.slug} onChange={(e) => set("slug")(tidy(e.target.value))} placeholder={slug || "your-charity"} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={!!slugErr} aria-describedby={slugErr ? "st-slug-err" : "st-slug-hint"} />{slugOk && !slugErr && <i aria-hidden="true" />}</div>
                                {slugErr ? <p id="st-slug-err" className="st-err" role="alert">{slugErr}</p>
                                    : <p id="st-slug-hint" className="st-hint">{f.slug ? "Letters, numbers and dashes." : slugOk ? "Made from your name. Type over it to choose your own." : "Where supporters find you. We suggest one from your name."}</p>}
                            </div>
                            <fieldset className="st-field">
                                <legend>Currency<small>What supporters give in</small></legend>
                                <div className="st-opts st-cur">{Object.keys(CURRENCIES).map((c) => <label key={c} className="st-chip"><input type="radio" name="st-currency" value={c} checked={f.currency === c} onChange={() => set("currency")(c)} />{c}</label>)}</div>
                            </fieldset>
                        </div>}

                        {step === 1 && <div className="st-step" key="1">
                            <div className="st-head"><h2 ref={heading} tabIndex={-1}>Make the page yours</h2><p>A colour, a font and how the board ranks your supporters. The defaults are fine; change them any time.</p></div>
                            {text("tagline", "Tagline", "Clean water for 40 villages", { note: "One line under your name" })}
                            <fieldset className="st-field">
                                <legend>Brand colour<small>{custom ? "Custom" : SWATCHES.find(([c]) => c.toLowerCase() === f.color.toLowerCase())?.[1]}</small></legend>
                                <div className="st-opts">
                                    {SWATCHES.map(([c, n]) => <label key={c} className="st-sw" style={{ "--sw": c } as CSSProperties} title={n}><input type="radio" name="st-color" value={c} checked={f.color.toLowerCase() === c.toLowerCase()} onChange={() => set("color")(c)} /><i aria-hidden="true" /><span className="st-sr">{n}</span></label>)}
                                    <label className="st-sw st-custom" data-on={custom} style={{ "--sw": f.color } as CSSProperties} title="Pick any colour"><i aria-hidden="true" /><input type="color" aria-label="Custom brand colour" value={f.color} onChange={(e) => set("color")(e.target.value)} /></label>
                                </div>
                            </fieldset>
                            <fieldset className="st-field">
                                <legend>Font</legend>
                                <div className="st-opts st-tiles">{FONTS.map((x) => <label key={x} className="st-tile2" style={{ fontFamily: `"${x}", sans-serif` }}><input type="radio" name="st-font" value={x} checked={f.font === x} onChange={() => set("font")(x)} /><b aria-hidden="true">{f.name.trim().split(/\s+/).slice(0, 2).join(" ") || "Clearwell Trust"}</b><span>{x}</span></label>)}</div>
                            </fieldset>
                            <fieldset className="st-field">
                                <legend>Board layout<small>How supporters are ranked</small></legend>
                                <div className="st-opts st-tiles st-lay">
                                    {LAYOUTS.map(([v, art]) => <label key={v} className="st-tile2"><input type="radio" name="st-variant" value={v} checked={f.variant === v} onChange={() => set("variant")(v)} /><svg viewBox="0 0 44 32" fill="currentColor" aria-hidden="true">{art}</svg><span>{ALL_VARIANTS.find(([k]) => k === v)?.[1]}</span></label>)}
                                    <label className="st-tile2" data-on={!LAYOUTS.some(([v]) => v === f.variant)}>
                                        <em>{LAYOUTS.some(([v]) => v === f.variant) ? `${ALL_VARIANTS.length - LAYOUTS.length} more` : layoutName}</em><span>All layouts</span>
                                        <select id="st-variant" aria-label="All board layouts" value={f.variant} onChange={(e) => set("variant")(e.target.value)}>{ALL_VARIANTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                                    </label>
                                </div>
                            </fieldset>
                        </div>}

                        {step === 2 && <div className="st-step" key="2">
                            <div className="st-head"><h2 ref={heading} tabIndex={-1}>Anything for your receipts?</h2><p>All optional. These show on your page and on donor receipts, and you can add them later from your dashboard.</p></div>
                            <div className="st-field"><label className="st-label" htmlFor="st-description">About your organisation</label><textarea id="st-description" className="st-in" rows={3} value={f.description} onChange={(e) => set("description")(e.target.value)} placeholder="What you do and who it helps" /></div>
                            {text("website", "Website", "https://", { inputMode: "url", autoComplete: "url" })}
                            <div className="st-two">
                                {text("country", "Country", "United Kingdom", { autoComplete: "country-name" })}
                                {text("registration_number", "Charity registration number", "Shown on receipts")}
                            </div>
                            <div className="st-two">
                                {text("impact_unit", "What a gift buys", "boreholes", { note: "Plural" })}
                                {text("impact_usd", "Cost of one", "6000", { type: "number", note: "In US dollars", inputMode: "decimal" })}
                            </div>
                        </div>}

                        {error && <p className="st-err" role="alert" style={{ marginTop: 24 }}>{error}</p>}
                        <div className="st-go">
                            {step > 0 && <button type="button" className="st-back" onClick={() => setStep(step - 1)} aria-label="Back"><Arrow back /></button>}
                            <button type="submit" className="st-cta" disabled={busy}>{step < 2 ? "Continue" : busy ? "Creating…" : "Create my organisation"}<Arrow /></button>
                        </div>
                        {step === 2 && <p className="st-next"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M3 10.500h18" stroke="currentColor" strokeWidth="2" /></svg>Next you connect Stripe, so gifts are paid straight to your account.</p>}
                        {isDemo && <p className="st-demo">Demo: the organisation you create lives in this browser only.</p>}
                    </form>
                )}
            </main>
        </div>
    );
};
