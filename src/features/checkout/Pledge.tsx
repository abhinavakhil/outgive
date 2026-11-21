/** Layout 2, "Pledge": the gift reads as one sentence with tappable words; the card beside it holds the detail for each step. */
import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import { FREQS, FREQ_LABEL, impactFor } from "./model";
import { AfterButtons, AmountInput, Details, Dial, Err, ExpressGiftAid, Extras, GIFT_AID_DECLARATION, Later, Lines, Logo, Mandate, NextStep, NoPayments, Nudge, PayFields, PayState, Presets, Seg, Tribute, TrustPanel, Verified, Wallets, cta, dark, endCopy, matchInfo, payLabel, soft } from "./parts";
import type { Ck } from "./useCheckout";

const Caret = () => <svg width="0.32em" height="0.32em" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const pillFill = "border-0 bg-(--ck-accent) font-extrabold text-(--ck-ink) shadow-[0_8px_20px_rgba(150,70,190,0.26)]";
const pillLine = "border-[1.5px] border-(--ck-line) bg-white text-(--ck-ink) shadow-[0_6px_16px_rgba(40,20,90,0.10)]";
const Pill = ({ onClick, label, className, children, pressed }: { onClick?: () => void; label?: string; className: string; children: ReactNode; pressed?: boolean }) =>
    onClick ? <button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} className={cx("ck-pill", className)}>{children}</button> : <span className={cx("ck-pill", className)}>{children}</span>;

const BACK = ["from-[#D5C8F8] to-[#E6DEFB]", "from-[#F3D46C] to-[#F8E7A9]", "from-[#AEE0C6] to-[#D2EFDF]", "from-[#BFD0FA] to-[#DCE5FD]", "from-[#AEE0C6] to-[#D2EFDF]"];

export const Pledge = ({ ck, brand, onShare, onStart }: { ck: Ck; brand: string; onShare?: () => void; onStart?: () => void }) => {
    const { s, c, f, q, recurring } = ck;
    const step = s.step, done = step === 4, end = endCopy(ck), name = s.first.trim() ? `, ${s.first.trim()}` : "";
    const pct = Math.round((c.raised / c.goal) * 100);
    const nextAmount = [...ck.presets, 250].find((v) => v > s.amount) ?? ck.presets[0];
    const funds = c.funds ?? [];
    const fundIdx = Math.max(0, funds.findIndex(([id]) => id === s.fund));
    const mi = Math.max(0, ck.methods.indexOf(ck.method));
    const word = { card: "card", dd: "Direct Debit", bank: "bank app", wallet: "wallet", apple: "Apple Pay", paypal: "PayPal" }[ck.method];
    const h = "m-0 text-[34px] leading-[1.38] font-bold tracking-[-1.2px] sm:text-[48px] sm:tracking-[-2px] lg:text-[56px]";

    const crumbs: [string, number][] = [];
    if (step >= 1 && !done) crumbs.push([`${f(s.amount)} ${FREQ_LABEL[s.freq].sentence}`, 0]);
    if (step >= 2 && !done) crumbs.push([(c.giftAid ? (s.ga ? "Gift Aid on" : "No Gift Aid") : "Extras") + (Object.values(s.picks).some(Boolean) ? ", extras added" : ""), 1]);
    if (step >= 3 && !done) crumbs.push([s.first.trim() ? `Receipt for ${s.first.trim()}` : "Details added", 2]);
    const chips: [string, string, string][] = [];
    if (q.giftAid) chips.push([`Gift Aid adds ${f(q.giftAid)}`, "#FDF1C4", "#5E4A0C"]);
    if (q.match) chips.push([`${matchInfo(ck).who || "A sponsor"} matches ${f(q.match)}`, "#FDE7E1", "#8A3524"]);
    chips.push([`${cap(c.beneficiary)} receives ${f(q.receives)}`, "#DDF4E8", "#14573B"]);

    return (
        <div className="ck flex min-h-dvh flex-col gap-6 bg-[#FFF8F4] px-4 pt-5 pb-10 [background-image:radial-gradient(circle_at_92%_12%,#F7D9FB_0,rgba(247,217,251,0)_44%),radial-gradient(circle_at_70%_96%,#FBD6CE_0,rgba(251,214,206,0)_48%)] sm:px-10 sm:pt-7 lg:px-16 lg:pb-11">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <Logo name={brand} />
                <div className="order-last flex w-full items-center gap-3.5 sm:order-none sm:w-auto sm:flex-[0_1_380px]">
                    <span className="text-[14px] font-extrabold whitespace-nowrap">{f(c.raised)} <span className="font-semibold text-(--ck-muted)">of {f(c.goal)}</span></span>
                    <div className="h-2 flex-1 rounded-full bg-[#EFE4EC]" role="progressbar" aria-label="Raised so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-linear-to-r from-[#E7B4F7] to-(--ck-accent-strong)" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                </div>
                <span className="rounded-[10px] border border-(--ck-line) bg-white px-3 py-[7px] text-[12px] font-extrabold tracking-[0.5px] text-(--ck-link) shadow-[0_2px_6px_rgba(40,20,90,0.08)]">{done ? (ck.pending ? "Payment on its way" : "Payment confirmed") : `Step ${step + 1} of 4`}</span>
            </header>

            <div className="grid flex-1 content-center items-center gap-x-14 gap-y-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,470px)]">
                {/* The sentence */}
                <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1 lg:self-end">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="mr-1.5"><Verified label={ck.trust ? "Verified" : null}>{c.charity}</Verified></span>
                        {crumbs.map(([label, to]) => (
                            <button key={to} type="button" onClick={() => ck.go(to)} className="ck-soft inline-flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] border-(--ck-line) bg-white px-3.5 text-[14px] font-bold text-(--ck-ink)">
                                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.4 2.4 4.6-5" fill="none" stroke="var(--ck-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>{label}
                            </button>
                        ))}
                    </div>
                    <div key={step} className="ck-fade">
                        {step === 0 && <h1 className={cx(h, "lg:text-[64px]")}>I’ll give <Pill onClick={() => ck.setAmount(nextAmount, "pill")} label={`Amount ${f(s.amount)}, tap to step up`} className={pillFill}>{f(s.amount)}</Pill> <Pill onClick={() => ck.setFreq(FREQS[(FREQS.indexOf(s.freq) + 1) % 3])} label={`How often: ${FREQ_LABEL[s.freq].sentence}, tap to change`} className={pillLine}>{FREQ_LABEL[s.freq].sentence}<Caret /></Pill> to {lower(c.title)}.</h1>}
                        {step === 1 && (c.giftAid
                            ? <h1 className={h}>Make it <Pill onClick={() => ck.setGa(!s.ga)} pressed={s.ga} label="Gift Aid, tap to switch" className={cx("font-extrabold text-(--ck-ink) shadow-[0_6px_16px_rgba(140,100,10,0.16)]", s.ga ? "border-0 bg-[#F8E5A6]" : "border-2 border-dashed border-[#C99A12] bg-white")}>{f(q.total + ck.gaAdds)}</Pill> with Gift Aid{funds.length ? <>, and send it to <Pill onClick={() => ck.setFund(funds[(fundIdx + 1) % funds.length][0])} label="Where it goes, tap to change" className={pillLine}>{funds[fundIdx][2]}<Caret /></Pill></> : null}.</h1>
                            : <h1 className={h}>Send it to <Pill onClick={() => funds.length && ck.setFund(funds[(fundIdx + 1) % funds.length][0])} className={pillLine}>{funds[fundIdx]?.[2] ?? "wherever it’s needed most"}<Caret /></Pill>, with any extras you like.</h1>)}
                        {step === 2 && <h1 className={h}>I’m <Pill className={cx(pillLine, !s.first.trim() && "text-(--ck-faint)!")}>{s.first.trim() || "your name"}</Pill>, and my receipt goes to <Pill className={cx(pillLine, "break-all", !s.email.trim() && "text-(--ck-faint)!")}>{s.email.trim() || "your email"}</Pill>.</h1>}
                        {step === 3 && <h1 className={h}>I’ll pay <Pill className={pillFill}>{f(q.total)}</Pill> {ck.method === "bank" ? "with my" : "by"} <Pill onClick={() => ck.setMethod(ck.methods[(mi + 1) % ck.methods.length])} label="Payment method, tap to change" className={pillLine}>{word}<Caret /></Pill>{recurring ? ` ${FREQ_LABEL[s.freq].sentence}` : ""}.</h1>}
                        {done && (ck.pending
                            ? <div className="flex flex-col gap-[18px]" aria-live="polite"><h1 className={h}>Your gift of <Pill className={pillFill}>{f(q.total)}</Pill> is on its way{name}.</h1><p className="m-0 max-w-[46ch] text-[18px] leading-normal text-(--ck-ink-2)">{end.body}</p></div>
                            : <div className="flex flex-col gap-[18px]" aria-live="polite"><h1 className={cx(h, "lg:text-[64px]")}>Thank you{name}. You gave <Pill className={pillFill}>{f(q.total)}</Pill> and {c.beneficiary} gets <Pill className="border-0 bg-(--ck-mint) font-extrabold text-(--ck-green-ink) shadow-[0_8px_20px_rgba(40,130,90,0.18)]">{f(q.receives)}</Pill>.</h1><p className="m-0 text-[18px] text-(--ck-ink-2)">Your bank has confirmed the payment and your receipt is in your inbox.</p></div>)}
                    </div>
                </div>

                {/* The card */}
                <div className="relative min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-6 lg:pr-[22px]">
                    <div aria-hidden="true" className={cx("absolute top-0 right-0 hidden h-[300px] w-[72%] rotate-6 rounded-[30px] bg-linear-to-b shadow-[0_24px_50px_rgba(110,80,200,0.14)] lg:block", BACK[step])} />
                    <div className="relative flex flex-col gap-[18px] rounded-[32px] bg-white p-5 shadow-[0_0_0_10px_rgba(255,255,255,0.6),0_30px_60px_rgba(150,80,160,0.20)] sm:rounded-[40px] sm:p-7">
                        {step === 0 && <div className="ck-fade flex flex-col items-center gap-5">
                            <Dial ck={ck} size={330} ground="var(--ck-tint)" />
                            <div className="flex w-full flex-wrap gap-2"><Presets ck={ck} className="min-h-[54px] text-[17px]" /><AmountInput ck={ck} className="flex-[1.3_1_100px]" /></div>
                            <span className="self-stretch rounded-[14px] bg-(--ck-coral-soft) px-3.5 py-3 text-[15px] font-bold text-(--ck-coral-ink)">{f(s.amount)} could pay for: {impactFor(s.amount, c)}</span>
                        </div>}
                        {step === 1 && <div className="ck-fade flex flex-col gap-3.5">
                            <strong className="text-[20px] font-extrabold tracking-[-0.3px]">Optional extras</strong>
                            <Extras ck={ck} /><Tribute ck={ck} />
                            {c.giftAid && <span className="rounded-[14px] bg-(--ck-gold-soft) px-3.5 py-3 text-[13px] leading-normal text-(--ck-gold-ink)">{s.ga ? `Gift Aid is on. ${GIFT_AID_DECLARATION}` : "Gift Aid is off. Tap the dashed amount in the sentence to add 25% at no cost, if you pay UK tax."}</span>}
                            <Nudge ck={ck} />
                        </div>}
                        {step === 2 && <div className="ck-fade flex flex-col gap-3.5"><strong className="text-[20px] font-extrabold tracking-[-0.3px]">Your details</strong><Details ck={ck} address="flat" /></div>}
                        {step === 3 && <div className="ck-fade flex flex-col gap-3.5">
                            <NoPayments ck={ck} />
                            <ExpressGiftAid ck={ck} />
                            {ck.methods.length > 1 && <div data-ck-methods><Seg label="Payment method" options={ck.methods.map((m) => [m, { card: "Card", dd: "Direct Debit", bank: "Bank", wallet: "Wallet" }[m as string] ?? m])} value={ck.method} onPick={ck.setMethod} track="bg-(--ck-seg)" /></div>}
                            <PayFields ck={ck} preview />
                            {ck.method === "wallet" && <><Wallets ck={ck} /><span className="text-[14px] text-(--ck-muted)">One tap. Your wallet fills in the payment details for you.</span></>}
                            <Mandate ck={ck} /><Later ck={ck} /><PayState ck={ck} /><TrustPanel ck={ck} />
                        </div>}
                        {done && <div className="ck-fade flex flex-col gap-3">
                            <strong className="text-[20px] font-extrabold tracking-[-0.3px]">{ck.pending ? "Your gift" : "Your receipt"}</strong>
                            <Lines ck={ck} paidWith />
                            <div className="flex items-baseline justify-between border-t-[1.5px] border-dashed border-(--ck-line) pt-3.5"><span className="text-[16px] font-extrabold">{end.total}</span><strong className="text-[34px] font-extrabold tracking-[-1px]">{f(q.total)}</strong></div>
                            <Later ck={ck} manage />
                            <TrustPanel ck={ck} />
                            {!ck.pending && <button type="button" onClick={() => window.print()} className={cx(soft, "min-h-[52px] text-[15px] font-extrabold")}>Download receipt (PDF)</button>}
                            {ck.nextUp && <div className="mt-1.5 flex flex-col rounded-[22px] bg-(--ck-tint) p-[18px]"><NextStep ck={ck} onShare={onShare} onStart={onStart} /></div>}
                        </div>}
                    </div>
                </div>

                {/* What it adds up to, and the buttons */}
                <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-2 lg:self-start">
                    {!done && <div className="flex flex-wrap items-center gap-2.5">{chips.map(([label, bg, fg]) => <span key={label} className="inline-flex min-h-[46px] items-center rounded-[14px] px-4 text-[16px] font-extrabold" style={{ background: bg, color: fg }}>{label}</span>)}</div>}
                    <Err ck={ck} className="text-[16px]" />
                    {!done ? (
                        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 bg-[#FFF8F4]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                            {step > 0 && <button type="button" onClick={ck.back} className={cx(soft, "min-h-16 text-[17px]")}>Back</button>}
                            <button type="button" onClick={ck.next} disabled={ck.busy} className={cx(cta, "min-h-16 flex-[1_1_220px] text-[19px] sm:flex-[0_1_340px]")}>{step === 0 ? `Continue with ${f(s.amount)}` : step === 1 ? "Continue" : step === 2 ? "Continue to payment" : ck.busy ? "Waiting for your bank…" : `${payLabel(ck, false)} now`}</button>
                            {step === 0 && ck.wallets && <button type="button" onClick={ck.express} className={cx(dark, "min-h-16 text-[17px]")}>Apple Pay</button>}
                        </div>
                    ) : <AfterButtons ck={ck} onShare={onShare} onStart={onStart} />}
                </div>
            </div>
        </div>
    );
};
const cap = (x: string) => x.replace(/^./, (m) => m.toUpperCase());
const lower = (x: string) => x.replace(/^./, (m) => m.toLowerCase());
