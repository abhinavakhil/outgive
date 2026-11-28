/**
 * Self-serve setup, shown at /engage to a signed-in person who is on no charity's team (and at /engage?onboard in the demo, for previews).
 * Three screens, one action each: the charity, its verification details, then a Ramadan 1448 starter appeal or an empty start.
 * The charity is made by org_create (the caller becomes its owner); the starter appeal is saved on it with bio_save.
 * Then the page reloads into /engage?welcome so my_roles is read again and the Overview opens with the next steps.
 */
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "@phosphor-icons/react";
import { OgLogo } from "@/shared/ui";
import { useApp } from "@/shared/lib/app-context";
import type { Org } from "@/shared/domain/types";
import type { OrgRole } from "@/features/launch";
import { cx } from "@/shared/utils/cx";
import { Tag } from "../ui/primitives";
import { parseEin } from "../compliance/model";
import { saveCompliance } from "../compliance/api";
import { COUNTRIES, CURRENCY_OF, type Country, SLUG, START_WITH, type StartWith, formatEin, slugify, tidySlug } from "./model";
import { startPage } from "../campaigns/templates";
import "./onboard.css";

const STEPS = ["Your charity", "Verification", "Start with"];
type Avail = "idle" | "checking" | "free" | "taken" | "unknown";

const Field = ({ id, label, hint, error, children }: { id: string; label: string; hint?: ReactNode; error?: string; children: ReactNode }) => (
    <div className="eg-ob-field">
        <label htmlFor={id}>{label}</label>
        {children}
        {error ? <p id={`${id}-msg`} className="eg-ob-err" role="alert">{error}</p> : hint ? <p id={`${id}-msg`} className="eg-ob-hint">{hint}</p> : null}
    </div>
);

export const Onboard = () => {
    const { db, user, isDemo } = useApp();
    const email = user?.email ?? (isDemo ? "you@example.org" : "");
    const [f, setF] = useState({ name: "", slug: "", country: "US" as Country, currency: "USD" as "USD" | "GBP", website: "", ein: "", charityNo: "", address: "", template: "ramadan" as StartWith });
    const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }));
    const [step, setStep] = useState(0);
    const [tried, setTried] = useState(false);
    const [avail, setAvail] = useState<Avail>("idle");
    const [error, setError] = useState<ReactNode>("");
    const [busy, setBusy] = useState(false);
    const sending = useRef(false);
    const heading = useRef<HTMLHeadingElement>(null);
    const moved = useRef(false);
    useEffect(() => { document.title = "Set up your charity · Outgive"; }, []);
    // Each new screen announces itself: focus moves to its heading (not on first load).
    useEffect(() => { if (moved.current) heading.current?.focus(); moved.current = true; }, [step]);

    const slug = f.slug || slugify(f.name);
    const slugOk = SLUG.test(slug);
    // Live availability: org_by_slug is public and returns the org that has the address, if any.
    useEffect(() => {
        if (!slugOk) { setAvail("idle"); return; }
        setAvail("checking");
        let off = false;
        const t = setTimeout(() => db.rpc<Org[]>("org_by_slug", { s: slug }).then((o) => !off && setAvail(o?.length ? "taken" : "free"), () => !off && setAvail("unknown")), 350);
        return () => { off = true; clearTimeout(t); };
    }, [db, slug, slugOk]);

    const us = f.country === "US";
    const einDigits = f.ein ? parseEin(f.ein) : "";
    const nameErr = tried && !f.name.trim() ? "Add your charity’s legal name." : "";
    const slugErr = avail === "taken" ? "That address is taken. Try another." : (f.slug || (tried && f.name.trim())) && !slugOk ? "Use letters, numbers and dashes, starting and ending with a letter or number." : "";
    const webBad = !!f.website.trim() && !/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(f.website.trim());
    const webErr = tried && webBad ? "That doesn’t look like a web address." : "";
    const einErr = tried && us && f.ein && einDigits === null ? "An EIN is nine digits, like 12-3456789." : "";

    const focus = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());
    const next = (e: FormEvent) => {
        e.preventDefault(); setTried(true); setError("");
        if (step === 0) {
            const bad = !f.name.trim() ? "ob-name" : !slugOk || avail === "taken" ? "ob-slug" : webBad ? "ob-web" : "";
            if (bad) return focus(bad);
        }
        if (step === 1 && us && f.ein && einDigits === null) return focus("ob-ein");
        setTried(false);
        if (step < 2) setStep(step + 1); else void create();
    };

    const create = async () => {
        if (sending.current) return; // a second click while the first is in flight does nothing
        sending.current = true; setBusy(true);
        const website = f.website.trim() && !/^https?:\/\//i.test(f.website.trim()) ? `https://${f.website.trim()}` : f.website.trim();
        // orgs.ein is not on the live database yet, so the EIN goes in registration_number as nine digits.
        const p = { name: f.name.trim(), slug, country: f.country, currency: f.currency, website, registration_number: us ? einDigits || "" : f.charityNo.trim() };
        let org: { id: string; slug: string } | null = null;
        try {
            org = await db.rpc<Org>("org_create", { p });
        } catch (e) {
            const m = (e as Error).message ?? "";
            if (/orgs_slug_key|duplicate key/i.test(m)) {
                // A retry after a lost response: the charity was made and is already ours. Carry on with it rather than make a second.
                const mine = await db.rpc<OrgRole[]>("my_roles").catch(() => [] as OrgRole[]);
                const r = mine?.find((x) => x.slug === slug);
                if (r) org = { id: r.org_id, slug: r.slug };
                else { setAvail("taken"); setStep(0); setError("Someone has just taken that address. Pick another."); focus("ob-slug"); }
            } else if (/sign in|42501|jwt/i.test(m)) setError(<>You’re signed out. <a href="/ramadhan/login?next=/engage">Sign in again</a> and your details will need re-entering.</>);
            else setError("We couldn’t reach Outgive. Check your connection and try again.");
        }
        if (!org) { sending.current = false; setBusy(false); return; }
        // The starter appeal. The charity exists either way; if this fails the Overview says the appeal is not set up yet.
        if (f.template) await db.rpc("bio_save", { org: org.id, b: startPage(f.template, p.name, website, new Date().toISOString().slice(0, 10)) }).catch((e) => console.error("bio_save", e));
        // Legal name, EIN and address for receipts. compliance_save is not on the live database yet; when it is, this fills it in.
        await saveCompliance(db, org.id, { legal_name: p.name, ein: us ? einDigits || "" : "", address: f.address.trim() }).catch(() => {});
        // A full load reads my_roles again, so the workspace opens on the new charity.
        location.assign(`/engage?org=${encodeURIComponent(org.slug)}&welcome${f.template ? `=${f.template}` : ""}`);
    };

    const availNote = avail === "checking" ? "Checking…" : avail === "free" ? <span className="eg-ob-ok"><Check size={14} weight="bold" aria-hidden="true" />Available</span> : avail === "unknown" ? "We couldn’t check this right now. We’ll check again when you finish." : "Where supporters find you. Made from your name; type to change it.";

    return (
        <div className="eg eg-ob">
            <div className="eg-panel">
                <aside className="eg-side">
                    <a href="/" className="eg-logo" aria-label="Outgive home"><OgLogo size={24} /></a>
                    <nav aria-label="Setup steps">
                        <p className="eg-label">Set up your charity</p>
                        <ol className="eg-nav">
                            {STEPS.map((s, i) => (
                                <li key={s}>
                                    <button type="button" className="eg-nav-item" aria-current={i === step ? "step" : undefined} disabled={i > step || busy} onClick={() => setStep(i)}>
                                        <i className={cx("eg-ob-num", i < step && "done")} aria-hidden="true">{i < step ? <Check size={12} weight="bold" /> : i + 1}</i><span>{s}</span>
                                        {i < step && <span className="eg-sr">(done)</span>}
                                    </button>
                                </li>
                            ))}
                        </ol>
                    </nav>
                </aside>
                <header className="eg-top">
                    <span className="eg-ob-who">{email}</span>
                    {!isDemo && <button type="button" className="eg-btn white sm" onClick={async () => { await db.signOut(); location.href = "/ramadhan/login?next=/engage"; }}>Sign out</button>}
                </header>
                <main className="eg-body" id="eg-main">
                    <form className="eg-card eg-ob-card" onSubmit={next} noValidate aria-busy={busy}>
                        {step === 0 && <>
                            <header><p className="eg-label">Welcome to Outgive</p><h1 ref={heading} tabIndex={-1}>Tell us about your charity</h1><p className="eg-muted">Two minutes, then you’re in your back office.</p></header>
                            <Field id="ob-name" label="Legal name" error={nameErr} hint="As registered, for receipts.">
                                <input id="ob-name" value={f.name} onChange={(e) => set("name")(e.target.value)} autoComplete="organization" aria-invalid={!!nameErr} aria-describedby="ob-name-msg" />
                            </Field>
                            <Field id="ob-slug" label="Page address" error={slugErr} hint={availNote}>
                                <div className={cx("eg-ob-url", avail === "free" && "ok")}><span>outgive.tech/</span><input id="ob-slug" value={f.slug} placeholder={slug || "your-charity"} onChange={(e) => set("slug")(tidySlug(e.target.value))} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={!!slugErr} aria-describedby="ob-slug-msg" /></div>
                            </Field>
                            <div className="eg-ob-row">
                                <Field id="ob-country" label="Country">
                                    <select id="ob-country" value={f.country} onChange={(e) => { const c = e.target.value as Country; setF((o) => ({ ...o, country: c, currency: CURRENCY_OF[c] })); }}>{COUNTRIES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
                                </Field>
                                <Field id="ob-cur" label="Currency">
                                    <select id="ob-cur" value={f.currency} onChange={(e) => set("currency")(e.target.value as "USD" | "GBP")}><option value="USD">US dollar (USD)</option><option value="GBP">Pound sterling (GBP)</option></select>
                                </Field>
                            </div>
                            <Field id="ob-web" label="Website (optional)" error={webErr}>
                                <input id="ob-web" type="url" inputMode="url" value={f.website} onChange={(e) => set("website")(e.target.value)} placeholder="yourcharity.org" autoComplete="url" aria-invalid={!!webErr} aria-describedby="ob-web-msg" />
                            </Field>
                        </>}
                        {step === 1 && <>
                            <header><p className="eg-label">{f.name.trim()}</p><h1 ref={heading} tabIndex={-1}>Verification details</h1></header>
                            {us ? (
                                <Field id="ob-ein" label="EIN" error={einErr} hint="Nine digits, like 12-3456789. You can add it later.">
                                    <input id="ob-ein" inputMode="numeric" autoComplete="off" value={f.ein} onChange={(e) => set("ein")(formatEin(e.target.value))} placeholder="12-3456789" aria-invalid={!!einErr} aria-describedby="ob-ein-msg" />
                                </Field>
                            ) : (
                                <Field id="ob-no" label="Charity number (optional)" hint="From the Charity Commission register.">
                                    <input id="ob-no" value={f.charityNo} onChange={(e) => set("charityNo")(e.target.value.slice(0, 20))} aria-describedby="ob-no-msg" />
                                </Field>
                            )}
                            <Field id="ob-addr" label="Postal address (optional)" hint="Printed on donor receipts.">
                                <textarea id="ob-addr" rows={2} value={f.address} onChange={(e) => set("address")(e.target.value.slice(0, 200))} autoComplete="street-address" aria-describedby="ob-addr-msg" />
                            </Field>
                            <p className="eg-ob-note">{us
                                ? <><b>Payments stay off until your EIN is verified.</b> We check it against the IRS list after setup. Nothing is verified yet, and you can explore everything meanwhile.</>
                                : <><b>Payments start once you connect Stripe</b>, from your back office after setup.</>}</p>
                        </>}
                        {step === 2 && <>
                            <header><p className="eg-label">{f.name.trim()}</p><h1 ref={heading} tabIndex={-1}>How do you want to start?</h1></header>
                            <fieldset className="eg-ob-choices">
                                <legend className="eg-sr">Start with</legend>
                                {START_WITH.map(([id, name, note]) => (
                                    <label key={id} className={cx("eg-ob-choice", f.template === id && "on")}>
                                        <input type="radio" name="ob-start" checked={f.template === id} onChange={() => set("template")(id)} />
                                        <span><b>{name}{id === "ramadan" && <> <Tag tone="sage">Recommended</Tag></>}</b><small>{note}</small></span>
                                    </label>
                                ))}
                            </fieldset>
                        </>}
                        {error && <p className="eg-ob-err" role="alert">{error}</p>}
                        <footer className="eg-ob-foot">
                            {step > 0 && <button type="button" className="eg-btn white" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={16} weight="bold" aria-hidden="true" />Back</button>}
                            <button type="submit" className="eg-btn sage" disabled={busy}>{step < 2 ? <>Continue<ArrowRight size={16} weight="bold" aria-hidden="true" /></> : busy ? "Creating…" : "Create my charity"}</button>
                        </footer>
                    </form>
                    <p className="eg-ob-invite">Joining an existing charity? Ask its admin to add {email || "your email"}, then sign in again.</p>
                </main>
            </div>
        </div>
    );
};

/** On the Overview after setup (/engage?welcome): what to do next. Dismissing drops ?welcome from the address. */
export const Welcome = ({ org, us }: { org: string; us: boolean }) => {
    const { href } = useApp();
    const q = new URLSearchParams(location.search);
    const [open, setOpen] = useState(q.has("welcome"));
    if (!open) return null;
    const template = q.get("welcome") === "ramadan";
    const close = () => { q.delete("welcome"); history.replaceState(null, "", `${location.pathname}${q.size ? `?${q}` : ""}`); setOpen(false); };
    const items: [string, string, string | null][] = [
        ["Connect Stripe", "So gifts reach your bank. Test mode works straight away.", href({ name: "admin", org, tab: "payments" })],
        ...(us ? [["Verify your EIN", "Live payments open once it checks out against the IRS list.", "/engage/receipts"] as [string, string, string]] : []),
        template
            ? ["Set up your appeal", "Your Ramadan 1448 appeal has Zakat, Sadaqah, Zakat al-Fitr and Fidya. Add a goal and campaigns.", null]
            : ["Set up your appeal", "Add the funds and campaigns donors can give to.", null],
    ];
    return (
        <section className="eg-card eg-ob-welcome" aria-labelledby="ob-welcome-h">
            <header className="eg-card-head"><h2 id="ob-welcome-h" className="eg-card-title">Your charity is set up. Next steps</h2>
                <button type="button" className="eg-icon-btn sm" aria-label="Dismiss next steps" onClick={close}><X size={18} weight="bold" aria-hidden="true" /></button></header>
            <ol>{items.map(([t, n, h], i) => (
                <li key={t}><i className="eg-ob-num" aria-hidden="true">{i + 1}</i><span>{h ? <a href={h}><b>{t}</b></a> : <b>{t}</b>}<small>{n}</small></span></li>
            ))}</ol>
        </section>
    );
};
