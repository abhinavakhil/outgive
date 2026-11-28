/**
 * Layouts 4–6, the short ones: gift → payment → thank you, three screens. They share one body and differ in their frame.
 *   nights:  the last ten nights, on the night ground, the schedule chosen by default.
 *   compact: just the card, inline on any page (the embed's usual look).
 *   kiosk:   a tablet at the masjid door: big targets, and it resets itself after the thank-you.
 * Built on the Outgive design system (white ground, #F4F3F0 surface, ink, Outfit 500 set tight, hairlines). Buttons are green, black or white only.
 */
import { useEffect } from "react";
import { cx } from "@/shared/utils/cx";
import { FREQ_LABEL, countOf, impactFor, methodName } from "./model";
import { AddonCards, AmountInput, DafPanel, EmployerMatch, Err, Field, FundChips, Logo, Mandate, NextStep, NightsPanel, NoPayments, PayFields, PledgeLater, Stepper, Switch, TrustPanel, UnitAmount, endCopy, payLabel } from "./parts";
import { dayName } from "./us";
import type { Ck } from "./useCheckout";

const KIOSK_RESET_MS = 45000;

export const Short = ({ ck, brand, onShare, onStart }: { ck: Ck; brand: string; onShare?: () => void; onStart?: () => void }) => {
    const kind = ck.layout as "nights" | "compact" | "kiosk", step = ck.s.step, { c, f } = ck;
    const onDark = kind === "nights" && step === 0;
    // The kiosk is shared: after a thank-you it goes back to a clean gift for the next person.
    useEffect(() => { if (kind !== "kiosk" || step !== 4) return; const t = setTimeout(ck.restart, KIOSK_RESET_MS); return () => clearTimeout(t); }, [kind, step]); // eslint-disable-line react-hooks/exhaustive-deps
    const night = ck.q.nights?.charges[0]?.night;
    const pct = c.goal ? Math.min(100, Math.round((c.raised / c.goal) * 100)) : 0;
    return (
        <div className={cx("ck cs", `cs-${kind}`, onDark && "cs-dark")}>
            {kind !== "compact" && (
                <header className="cs-head">
                    <Logo name={brand} />
                    {kind === "nights" ? <span className="cs-tag cs-tag-live"><i />{night ? `From night ${night}` : "Last ten nights"}</span> : <span className="cs-tag">{kind === "kiosk" ? "Tap to give" : c.charity}</span>}
                </header>
            )}
            {kind !== "compact" && step === 0 && (
                <section className="cs-intro">
                    <span className="cs-eyebrow">{kind === "nights" ? "Ramadan, the last ten nights" : kind === "kiosk" ? `Welcome to ${c.charity}` : c.charity}</span>
                    <h1 className="cs-h1">{kind === "nights" ? "The last ten nights" : c.title}</h1>
                    {c.goal > 0 && <>
                        <div className="cs-meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
                        <div className="cs-meta"><span>{f(c.raised)} raised</span><span>{pct}% of {f(c.goal)}</span></div>
                    </>}
                </section>
            )}
            <main className={cx("cs-card ck-fade", step === 4 && "cs-done")} key={step}>
                {step === 0 && <Gift ck={ck} kiosk={kind === "kiosk"} />}
                {step === 3 && <Pay ck={ck} />}
                {step === 4 && <Thanks ck={ck} onShare={onShare} onStart={onStart} kiosk={kind === "kiosk"} />}
            </main>
            {kind !== "compact" && <p className="cs-foot">{ck.us ? `Paid directly to ${c.trust?.legalName || c.charity}${c.trust?.regNo && !/^\s*\[/.test(c.trust.regNo) ? `, EIN ${c.trust.regNo}` : ""}. Tax-deductible as allowed by law.` : `Paid directly to ${c.charity}.`}</p>}
        </div>
    );
};

/** A segmented control: equal segments on the #F4F3F0 track, a white thumb that slides to the one chosen. */
const Thumbs = <T extends string>({ label, options, value, onPick }: { label: string; options: [T, string][]; value: T; onPick: (v: T) => void }) => {
    const i = options.findIndex(([v]) => v === value);
    return (
        <div role="group" aria-label={label} className="cs-seg" style={{ "--n": options.length, "--i": Math.max(0, i) } as React.CSSProperties}>
            {options.map(([v, l]) => <button key={v} type="button" aria-pressed={v === value} onClick={() => onPick(v)}>{l}</button>)}
        </div>
    );
};

const Lines = ({ ck, all }: { ck: Ck; all?: boolean }) => (
    <dl className="cs-lines">
        {(all || ck.nights ? ck.q.lines : ck.q.today.lines).map((l) => <div key={l.key}><dt>{l.label}</dt><dd>{ck.f(l.value)}</dd></div>)}
        {ck.q.match > 0 && <div className="cs-boost"><dt>Matched by {ck.c.match && "sponsor" in ck.c.match && !/^\s*\[/.test(ck.c.match.sponsor) ? ck.c.match.sponsor : "a sponsor"}</dt><dd>+{ck.f(ck.q.match)}</dd></div>}
        <div className="cs-total"><dt>{ck.nights ? `Over ${ck.q.nights?.charges.length ?? 10} nights` : ck.s.freq === "monthly" ? "Each month" : "Today"}</dt><dd>{ck.f(ck.q.total)}</dd></div>
    </dl>
);

/** The add-on lines with a switch (cover the fees, Zakat al-Fitr, Fidya, dedication). A per-unit one opens its stepper when on. */
const AddonRows = ({ ck }: { ck: Ck }) => (
    <>
        {ck.extras.map((x) => {
            const on = !!ck.s.picks[x.id], cost = x.price === "fee" ? ck.q.fee : x.price * countOf(x, ck.s.counts);
            return (
                <div key={x.id} className={cx("cs-addon", on && "on")}>
                    <button type="button" aria-pressed={on} onClick={() => ck.toggleExtra(x.id)}>
                        <span className="cs-addon-t"><b>{x.price === "fee" ? `Cover the ${ck.f(cost)} fee` : x.name}</b><span>{x.price === "fee" ? `So ${ck.c.charity} receives all of it` : x.desc}</span></span>
                        {x.price !== "fee" && cost > 0 && <span className="cs-addon-p">+{ck.f(cost)}</span>}
                        <Switch on={on} green />
                    </button>
                    {on && x.unit && <div className="cs-addon-x"><span>{ck.f(x.price as number)} × {x.unit.many}</span><Stepper value={countOf(x, ck.s.counts)} max={x.unit.max} label={x.unit.many} onChange={(n) => ck.setCount(x.id, n)} /></div>}
                    {on && x.tribute && <div className="cs-addon-x"><Field label="In honour or memory of" placeholder="Their name" className="flex-1" value={ck.s.tributeName} onChange={(e) => ck.set({ tributeName: e.target.value })} /></div>}
                </div>
            );
        })}
    </>
);

const Gift = ({ ck, kiosk }: { ck: Ck; kiosk: boolean }) => {
    const { s, c, f } = ck, impact = impactFor(s.amount, c);
    return (
        <div className="cs-stack">
            {!!c.funds?.length && <div className="cs-field"><span className="cs-lbl">Fund</span><FundChips ck={ck} /></div>}
            <div className="cs-field">
                <span className="cs-lbl">{ck.nights ? "Each night" : "Amount"}</span>
                {ck.perUnit ? <UnitAmount ck={ck} big={kiosk} /> : (
                    <div className="cs-amounts">
                        {ck.presets.map((v) => <button key={v} type="button" aria-pressed={s.amount === v && s.amountSource !== "typed"} onClick={() => ck.setAmount(v, "preset")}>{f(v)}</button>)}
                        <AmountInput ck={ck} className="cs-other" />
                    </div>
                )}
                {impact && !ck.perUnit && !ck.nights && <span className="cs-note">{f(s.amount)} could pay for {impact}</span>}
            </div>
            {ck.freqs.length > 1 && <div className="cs-field"><span className="cs-lbl">How often</span><Thumbs label="How often" options={ck.freqs.map((x) => [x, x === "nights" ? "Ten nights" : FREQ_LABEL[x].short])} value={s.freq} onPick={ck.setFreq} /></div>}
            <NightsPanel ck={ck} />
            {(ck.extras.length > 0 || ck.addons.length > 0) && <div className="cs-field"><span className="cs-lbl">Add to your gift</span><AddonCards ck={ck} /><AddonRows ck={ck} /></div>}
            <Lines ck={ck} />
            <Err ck={ck} />
            <button type="button" onClick={ck.next} className="cs-btn cs-green">{ck.nights ? `Continue, ${f(s.amount)} a night` : `Continue with ${f(ck.q.total)}`}</button>
        </div>
    );
};

const Pay = ({ ck }: { ck: Ck }) => {
    const { s, set, f } = ck, bad = (k: string) => s.errField === k;
    return (
        <div className="cs-stack">
            <div className="cs-sum">
                <span><b>{ck.c.funds?.find(([id]) => id === s.fund)?.[1] ?? "Your gift"}</b>{ck.nights ? `${f(s.amount)} a night, ${ck.q.nights?.charges.length} nights` : FREQ_LABEL[s.freq].line}</span>
                <strong>{f(ck.q.total)}</strong>
                <button type="button" onClick={ck.back} className="cs-link">Change</button>
            </div>
            <div className="cs-grid2">
                <Field label="First name" autoComplete="given-name" value={s.first} invalid={bad("first")} onChange={(e) => set({ first: e.target.value })} />
                <Field label="Last name" autoComplete="family-name" value={s.last} invalid={bad("last")} onChange={(e) => set({ last: e.target.value })} />
                <Field label="Email for your tax receipt" className="col-span-full" type="email" autoComplete="email" placeholder="you@example.com" value={s.email} invalid={bad("email")} onChange={(e) => set({ email: e.target.value })} />
                {/* Its own opt-in, off by default: one reminder email with a link back to this gift, and nothing else. */}
                <label className="cs-check col-span-full"><input type="checkbox" checked={s.recover} onChange={(e) => set({ recover: e.target.checked })} />Email me a link to finish this gift if I don’t complete it</label>
            </div>
            <NoPayments ck={ck} />
            {ck.wallets && !ck.nights && <div className="cs-grid2"><button type="button" disabled={ck.busy} onClick={() => ck.pay("Apple Pay")} className="cs-btn cs-black">Apple Pay</button><button type="button" disabled={ck.busy} onClick={() => ck.pay("Google Pay")} className="cs-btn cs-white">Google Pay</button></div>}
            {ck.methods.length > 1 && <div data-ck-methods><Thumbs label="Payment method" options={ck.methods.map((m) => [m, methodName(m, ck.us)])} value={ck.method} onPick={ck.setMethod} /></div>}
            <PayFields ck={ck} />
            <Mandate ck={ck} />
            <PledgeLater ck={ck} />
            <DafPanel ck={ck} />
            <Err ck={ck} />
            <div className="cs-row">
                <button type="button" onClick={ck.back} className="cs-btn cs-white">Back</button>
                <button type="button" onClick={ck.next} disabled={ck.busy} className="cs-btn cs-green cs-grow">{payLabel(ck)}</button>
            </div>
            <TrustPanel ck={ck} />
        </div>
    );
};

const Thanks = ({ ck, onShare, onStart, kiosk }: { ck: Ck; onShare?: () => void; onStart?: () => void; kiosk: boolean }) => {
    const end = endCopy(ck), n = ck.q.nights?.charges;
    return (
        <div className="cs-stack" aria-live="polite">
            <span className="cs-tag cs-tag-ok">{end.chip}</span>
            <h1 className="cs-h1 cs-h1-sm">{end.title}</h1>
            <p className="cs-sub">{end.body || (n?.length ? `Your first gift of ${ck.f(n[0].total)} goes on night ${n[0].night}, the evening of ${dayName(n[0].date, ck.c.locale)}. We email you before it, with a one-tap cancel link.` : `${ck.f(ck.q.total)} to ${ck.c.charity}. Your tax receipt is on its way to ${ck.s.email.trim() || "your inbox"}, with each fund on its own line.`)}</p>
            <Lines ck={ck} all />
            {ck.s.receiptUrl && <a href={ck.s.receiptUrl} target="_blank" rel="noreferrer" className="cs-btn cs-white">Download your tax receipt (PDF)</a>}
            <EmployerMatch ck={ck} />
            {ck.nextUp?.kind === "monthly" && <div className="cs-next"><NextStep ck={ck} onShare={onShare} onStart={onStart} /></div>}
            <div className="cs-row">
                <button type="button" onClick={onShare} className="cs-btn cs-black cs-grow">Share the appeal</button>
                <button type="button" onClick={ck.restart} className="cs-btn cs-white cs-grow">{kiosk ? "Next person" : "Give again"}</button>
            </div>
            {kiosk && <span className="cs-note">This screen resets for the next person in a moment.</span>}
        </div>
    );
};
