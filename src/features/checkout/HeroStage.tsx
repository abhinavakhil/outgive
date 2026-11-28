/** Layout 1, "Hero stage": the amount dial centre stage, with an impact card on the left and the running gift on the right. */
import { cx } from "@/shared/utils/cx";
import { impactFor } from "./model";
import { AddonCards, DafPanel, EmployerMatch, FundChips, NightsPanel, UnitAmount, AfterButtons, AmountInput, Details, Dial, Err, ExpressGiftAid, Extras, FreqSeg, GoldFrame, Later, Lines, Logo, Mandate, NEXT_FOOT, NextStep, NoPayments, Nudge, PayFields, PayState, Presets, Seg, Switch, Tribute, TrustPanel, Verified, Wallets, cta, dark, endCopy, matchInfo, payLabel, soft } from "./parts";
import type { Ck } from "./useCheckout";

const NAMES = ["Amount", "Gift Aid", "Details", "Payment"];
const SHELL = { coral: "from-[#F9BDB2] to-[#FBD6CE]", gold: "from-[#F3D46C] to-[#F8E7A9]", green: "from-[#AEE0C6] to-[#D2EFDF]", blue: "from-[#BFD0FA] to-[#DCE5FD]", violet: "from-[#D5C8F8] to-[#E6DEFB]" };

/** A white card sitting in a tinted frame, with a small caption under it: the design's signature shape. */
const Framed = ({ shell, foot, footInk, tilt, className, children }: { shell: string; foot?: React.ReactNode; footInk: string; tilt?: string; className?: string; children: React.ReactNode }) => (
    <div className={cx("ck-float min-w-0 rounded-[30px] bg-linear-to-b p-2 shadow-[0_24px_50px_rgba(110,80,160,0.14)]", shell, tilt, className)}>
        <div className="flex flex-col gap-2.5 rounded-[23px] bg-white p-5 shadow-[0_10px_22px_rgba(80,50,120,0.12)]">{children}</div>
        {foot && <div className="flex justify-between gap-3 px-[18px] pt-3 pb-2 text-[12px] font-extrabold tracking-[1.2px] uppercase" style={{ color: footInk }}>{foot}</div>}
    </div>
);

export const HeroStage = ({ ck, brand, onShare, onStart }: { ck: Ck; brand: string; onShare?: () => void; onStart?: () => void }) => {
    const { s, c, f, q } = ck;
    const step = s.step, done = step === 4, match = matchInfo(ck), end = endCopy(ck);
    const gaLabel = c.giftAid ? "Gift Aid" : ck.us ? "Add-ons" : "Extras", unit = ck.us ? "dollar" : "pound";
    const left = [
        { shell: SHELL.coral, chip: "#FDE7E1", ink: "#8A3524", badge: f(s.amount), title: (impactFor(s.amount, c) || `Every ${unit} helps`).replace(/^./, (m) => m.toUpperCase()), sub: "Example from the charity", foot: q.match > 0 ? `${match.doubled && !q.matchCapped ? "Doubled" : "Matched"} until ${match.until}` : `Every ${unit} counts` },
        c.giftAid
            ? { shell: SHELL.gold, chip: "#FDF1C4", ink: "#6B5408", badge: "+25%", title: `Gift Aid turns ${f(q.total)} into ${f(q.total + ck.gaAdds)}`, sub: "Paid by HMRC, not by you", foot: "For UK taxpayers" }
            : { shell: SHELL.gold, chip: "#FDF1C4", ink: "#6B5408", badge: "Optional", title: "Small extras go a long way", sub: "Everything on this step is optional", foot: "Skip any of it" },
        { shell: SHELL.green, chip: "#DDF4E8", ink: "#14573B", badge: "Private", title: "Your details stay with the charity", sub: ck.us ? "Used for your tax receipt only" : "Used for your receipt and Gift Aid only", foot: "Never sold or shared" },
        { shell: SHELL.blue, chip: "#E3EAFE", ink: "#2B3F8F", badge: "Secure", title: "Your bank confirms before we say thanks", sub: "Card details are encrypted and never stored by the charity", foot: "Protected checkout" },
    ][Math.min(3, step)];
    const titles = [c.title, "Make your gift go further", "Where should we send your receipt?", "How would you like to pay?"];
    const pct = Math.round((c.raised / c.goal) * 100);
    const methods = ck.methods.map((m) => [m, <span key={m} className="flex flex-col items-center"><strong className="text-[16px] font-extrabold">{{ card: "Card", dd: "Direct Debit", bank: ck.us ? "Bank debit" : "Pay by bank" }[m as string] ?? m}</strong><span className="text-[12px] font-bold opacity-80">{{ card: ck.us ? "Apple Pay, Google Pay too" : "Debit or credit", dd: "Lowest fees", bank: ck.us ? "Lowest fees, ACH" : "Approve in your app" }[m as string]}</span></span>] as [typeof m, React.ReactNode]);

    return (
        <div className="ck flex min-h-dvh flex-col items-center bg-[#F3EFFC] [background-image:radial-gradient(circle_at_12%_18%,#F7D9FB_0,rgba(247,217,251,0)_42%),radial-gradient(circle_at_88%_30%,#D9E4FF_0,rgba(217,228,255,0)_44%),radial-gradient(circle_at_50%_100%,#FBD6CE_0,rgba(251,214,206,0)_46%)]">
            <header className="flex w-full flex-wrap items-center justify-between gap-4 px-4 pt-5 sm:px-14 sm:pt-7">
                <Logo name={brand} />
                <nav aria-label="Checkout steps" className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 sm:order-none sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
                    <div className="flex gap-1 rounded-[18px] border border-white bg-white/75 p-1.5 shadow-[0_6px_18px_rgba(110,80,200,0.10)]">
                        {NAMES.map((label, i) => {
                            if (!ck.flow.includes(i)) return null;
                            const cur = i === step, past = i < step || done;
                            return (
                                <button key={label} type="button" disabled={i > step || done} onClick={() => ck.go(i)} aria-current={cur ? "step" : undefined}
                                    className="flex min-h-11 items-center gap-2 rounded-[13px] border-0 px-3.5 text-[15px] font-bold whitespace-nowrap sm:px-[18px]" style={{ background: cur ? "var(--ck-ink)" : "transparent", color: cur ? "#fff" : past ? "var(--ck-green)" : "var(--ck-muted)" }}>
                                    {past && <span aria-hidden="true">✓</span>}{i === 1 ? gaLabel : label}
                                </button>
                            );
                        })}
                    </div>
                </nav>
                <button type="button" onClick={ck.express} className={cx(dark, "min-h-[50px] text-[15px]", step < 3 && ck.wallets ? "" : "invisible")}>Apple Pay</button>
            </header>

            {!done ? (
                <div className="flex w-full flex-col items-center gap-7 px-4 pt-7 pb-10 sm:gap-[34px] sm:px-10 sm:pt-10 sm:pb-12">
                    <div className="flex flex-col items-center gap-3.5 text-center">
                        <Verified label={ck.trust ? "Verified" : null}>{step === 0 ? `${c.charity}, ${pct}% funded` : c.title}</Verified>
                        <h1 className={cx("m-0 max-w-[17em] leading-[1.04] font-bold tracking-[-1.9px] text-balance", step === 0 ? "text-[36px] sm:text-[54px]" : "text-[32px] sm:text-[44px]")}>{titles[Math.min(3, step)]}</h1>
                    </div>

                    <div className="flex w-full flex-wrap items-center justify-center gap-x-[52px] gap-y-6">
                        <Framed shell={left.shell} footInk={left.ink} tilt="lg:-rotate-3" className="hidden flex-[0_1_300px] lg:block" foot={left.foot}>
                            <strong className="self-start rounded-[14px] px-3.5 py-2 text-[22px] font-extrabold whitespace-nowrap" style={{ background: left.chip, color: left.ink }}>{left.badge}</strong>
                            <strong className="text-[20px] leading-tight font-extrabold tracking-[-0.3px]">{left.title}</strong>
                            <span className="text-[14px] leading-snug text-(--ck-muted)">{left.sub}</span>
                        </Framed>

                        <div className="flex min-w-0 flex-[0_1_580px] flex-col items-center gap-[22px]">
                            {step === 0 ? (
                                <div className="ck-fade flex w-full flex-col items-center gap-[22px]">
                                    <Dial ck={ck} size={350} />
                                    <p className="m-0 text-center text-[15px] font-bold text-(--ck-coral-ink) lg:hidden">{f(s.amount)} could pay for {impactFor(s.amount, c)}</p>
                                    <div className="flex w-full flex-wrap gap-2.5"><Presets ck={ck} /><AmountInput ck={ck} className="flex-[1.3_1_120px]" /></div>
                                    <Err ck={ck} className="self-start" />
                                    <div className="w-full"><NightsPanel ck={ck} /></div>
                                    <div className="flex w-full flex-wrap items-center gap-3">
                                        <FreqSeg ck={ck} className="flex-[1_1_300px]" />
                                        <button type="button" onClick={ck.next} className={cx(cta, "flex-[1.3_1_260px]")}>Continue with {f(s.amount)}</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="ck-fade flex w-full flex-col rounded-[28px] bg-white shadow-[0_0_0_10px_rgba(255,255,255,0.55),0_30px_60px_rgba(110,80,200,0.18)] sm:rounded-[36px]">
                                    <div className="flex flex-col gap-5 px-4 pt-6 pb-6 sm:px-[30px] sm:pt-7">
                                        {step === 1 && <>
                                            {c.giftAid && (
                                                <GoldFrame foot={s.ga ? "I am a UK taxpayer and will cover any tax shortfall" : "The charity claims 25p for every £1 from HMRC"}>
                                                    <div className="flex flex-wrap items-center gap-4">
                                                        <div className="flex flex-[1_1_220px] flex-col gap-1.5">
                                                            <strong className="text-[20px] font-extrabold tracking-[-0.4px]">Add 25% with Gift Aid</strong>
                                                            <div className="flex flex-wrap items-center gap-2.5">
                                                                <span className="text-[17px] font-extrabold text-(--ck-muted)">{f(q.total)}</span>
                                                                <svg width="24" height="14" viewBox="0 0 28 14" aria-hidden="true"><path d="M1 7h24M20 2l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                                <span className="text-[26px] font-extrabold tracking-[-0.7px]" style={{ color: s.ga ? "var(--ck-green)" : "var(--ck-faint)" }}>{f(q.total + ck.gaAdds)}</span>
                                                            </div>
                                                        </div>
                                                        <button type="button" aria-pressed={s.ga} onClick={() => ck.setGa(!s.ga)} className="flex min-h-[52px] flex-none items-center gap-2.5 rounded-2xl border-[1.5px] py-0 pr-4 pl-2.5 text-[15px] font-extrabold whitespace-nowrap text-(--ck-ink)" style={{ borderColor: s.ga ? "#D9B93A" : "var(--ck-line)", background: s.ga ? "var(--ck-gold-soft)" : "#fff" }}>
                                                            <Switch on={s.ga} green />{s.ga ? "Gift Aid on" : "Add Gift Aid"}
                                                        </button>
                                                    </div>
                                                </GoldFrame>
                                            )}
                                            {ck.us && <div className="flex flex-col gap-2.5"><h2 className="m-0 text-[16px] font-extrabold">Which fund?</h2><FundChips ck={ck} /><UnitAmount ck={ck} /></div>}
                                            {ck.us && <AddonCards ck={ck} />}
                                            {!ck.us && !!c.funds?.length && (
                                                <div className="flex flex-col gap-2.5">
                                                    <h2 className="m-0 text-[16px] font-extrabold">Where should it go?</h2>
                                                    <div className="flex flex-wrap gap-2">
                                                        {c.funds.map(([id, label]) => { const on = s.fund === id; return <button key={id} type="button" aria-pressed={on} onClick={() => ck.setFund(id)} className="ck-soft min-h-11 rounded-xl border-[1.5px] px-3.5 text-[13px] font-extrabold tracking-[0.3px] text-(--ck-link) shadow-[0_2px_6px_rgba(40,20,90,0.08)]" style={{ borderColor: on ? "var(--ck-accent-strong)" : "var(--ck-line)", background: on ? "var(--ck-ink)" : "#fff", color: on ? "#fff" : undefined }}>{label}</button>; })}
                                                    </div>
                                                </div>
                                            )}
                                            <Extras ck={ck} />
                                            <Tribute ck={ck} />
                                            <Nudge ck={ck} />
                                        </>}
                                        {step === 2 && <><Details ck={ck} /><Err ck={ck} /></>}
                                        {step === 3 && <>
                                            {ck.detailsOnPay && !s.express && <Details ck={ck} />}
                                            <ExpressGiftAid ck={ck} />
                                            <Wallets ck={ck} className="grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))]" />
                                            <NoPayments ck={ck} />
                                            {ck.methods.length > 0 && (ck.wallets || ck.paypal) && <div className="flex items-center gap-3.5 text-[12px] font-extrabold tracking-[1.2px] text-(--ck-muted) uppercase"><span className="h-px flex-1 bg-(--ck-line-2)" />or pay another way<span className="h-px flex-1 bg-(--ck-line-2)" /></div>}
                                            {ck.methods.length > 1 && <div data-ck-methods><Seg label="Payment method" options={methods} value={ck.method} onPick={ck.setMethod} track="bg-(--ck-seg)" /></div>}
                                            <PayFields ck={ck} preview />
                                            <Mandate ck={ck} />
                                            <DafPanel ck={ck} />
                                            <Err ck={ck} />
                                            <TrustPanel ck={ck} />
                                        </>}
                                    </div>
                                    <div className="sticky bottom-0 flex flex-wrap gap-3 rounded-b-[28px] border-t border-(--ck-sep) bg-white px-4 pt-4 pb-5 sm:static sm:rounded-b-[36px] sm:px-[30px] sm:pt-5 sm:pb-7">
                                        <button type="button" onClick={ck.back} className={soft}>Back</button>
                                        <button type="button" onClick={ck.next} disabled={ck.busy} className={cx(cta, "flex-[1_1_220px]")}>{step === 1 ? (ck.detailsOnPay ? "Continue to payment" : "Continue") : step === 2 ? "Continue to payment" : payLabel(ck)}</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Framed shell={SHELL.violet} footInk="#5A44A8" tilt="lg:rotate-3" className="w-full flex-[0_1_310px]" foot={<><span>Charity receives</span><span>{f(q.receives)}</span></>}>
                            <strong className="text-[17px] font-extrabold">Your gift</strong>
                            <Lines ck={ck} />
                            <div className="flex items-baseline justify-between border-t-[1.5px] border-dashed border-(--ck-line) pt-3"><span className="text-[15px] font-extrabold">You pay</span><strong className="text-[30px] font-extrabold tracking-[-0.9px] whitespace-nowrap">{f(q.total)}</strong></div>
                            <Later ck={ck} />
                            <PayState ck={ck} />
                        </Framed>
                    </div>
                </div>
            ) : (
                <div className="ck-fade box-border flex w-full max-w-[1020px] flex-col items-center gap-[34px] px-4 pt-10 pb-12 sm:px-10 sm:pt-11">
                    <div className="flex flex-col items-center gap-3.5 text-center" aria-live="polite">
                        <Verified label={end.chip} gold={ck.pending}>{ck.pending ? "Not paid yet" : "Your bank has approved the payment"}</Verified>
                        <h1 className={cx("m-0 leading-none font-bold text-balance", ck.pending ? "text-[38px] tracking-[-1.6px] sm:text-[60px] sm:tracking-[-2.4px]" : "text-[48px] tracking-[-3px] sm:text-[76px]")}>{end.title}</h1>
                        <p className="m-0 max-w-[42ch] text-[17px] leading-normal text-(--ck-ink-2) sm:text-[19px]">{ck.pending ? end.body : <>{cap(c.beneficiary)} gets <strong className="font-extrabold">{f(q.receives)}</strong> because of you. Your receipt is in your inbox.</>}</p>
                    </div>
                    <div className="flex w-full flex-wrap items-start justify-center gap-x-11 gap-y-6">
                        <Framed shell={ck.pending ? SHELL.gold : SHELL.green} footInk={ck.pending ? "#6B5408" : "#14573B"} tilt="lg:-rotate-2" className="flex flex-[0_1_380px] flex-col">
                            <strong className="text-[20px] font-extrabold tracking-[-0.3px]">{ck.pending ? "Your gift" : "Your receipt"}</strong>
                            <Lines ck={ck} paidWith />
                            <div className="mt-auto flex items-baseline justify-between border-t-[1.5px] border-dashed border-(--ck-line) pt-3.5"><span className="text-[16px] font-extrabold">{end.total}</span><strong className="text-[34px] font-extrabold tracking-[-1px]">{f(q.total)}</strong></div>
                            <Later ck={ck} manage />
                            <TrustPanel ck={ck} />
                            <EmployerMatch ck={ck} />
                            {!ck.pending && <button type="button" onClick={() => window.print()} className={cx(soft, "min-h-[52px] text-[15px] font-extrabold")}>Download receipt (PDF)</button>}
                        </Framed>
                        {ck.nextUp && (
                            <Framed shell={SHELL.violet} footInk="#5A44A8" tilt="lg:rotate-2" className="flex flex-[0_1_380px] flex-col" foot={NEXT_FOOT[ck.nextUp.kind]}>
                                <NextStep ck={ck} onShare={onShare} onStart={onStart} />
                            </Framed>
                        )}
                    </div>
                    <AfterButtons ck={ck} onShare={onShare} onStart={onStart} className="w-full max-w-[820px]" />
                </div>
            )}

            <div className="mt-auto grid w-full grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] items-center gap-3 bg-white px-[8%] py-[22px]">
                <Stat big={f(c.raised)} small={`raised of ${f(c.goal)}`} />
                {match.live && (match.doubled
                    ? <Stat big="2×" small={`matched ${match.who ? `by ${match.who} ` : ""}until ${match.until}`} />
                    : <Stat big="Matched" small={`by ${match.who || "a sponsor"} until ${match.until}`} />)}
                {c.giftAid && <Stat big="+25%" small="with Gift Aid" />}
            </div>
        </div>
    );
};
const cap = (x: string) => x.replace(/^./, (m) => m.toUpperCase());
const Stat = ({ big, small }: { big: string; small: string }) => <div className="flex items-baseline justify-center gap-2.5"><strong className="text-[26px] font-extrabold tracking-[-0.6px]">{big}</strong><span className="text-[15px] font-semibold text-(--ck-muted)">{small}</span></div>;
