/** Layout 3, "Gift ticket": one question at a time on the left, and a ticket on the right that fills in as you go and becomes the receipt. */
import { cx } from "@/shared/utils/cx";
import { METHOD_NAME, impactFor } from "./model";
import { AfterButtons, AmountInput, Boosts, Details, Dial, Err, ExpressGiftAid, Extras, FreqSeg, GiftRows, Later, Mandate, NextStep, NoPayments, Nudge, PayFields, Presets, Radio, Row, Tribute, TrustPanel, cta, dark, endCopy, soft } from "./parts";
import type { Ck } from "./useCheckout";

const NAMES = ["Amount", "Boost", "You", "Pay"];
const SUB: Record<string, string> = { apple: "One tap with Face ID", card: "Debit or credit", dd: "Straight from your bank account", bank: "Approve in your banking app, no card needed", paypal: "Use your PayPal balance or linked card" };
const TAG: Record<string, string> = { apple: "Fastest", dd: "Lowest fees" };

export const GiftTicket = ({ ck, brand, onShare, onStart }: { ck: Ck; brand: string; onShare?: () => void; onStart?: () => void }) => {
    const { s, c, f, q } = ck;
    const step = s.step, done = step === 4, end = endCopy(ck);
    const pct = Math.round((c.raised / c.goal) * 100);
    const fullName = `${s.first.trim()} ${s.last.trim()}`.trim();
    const Q = [
        ["How much would you like to give?", "Drag the dial, tap an amount or type your own.", "Takes about a minute"],
        c.giftAid ? ["Want to add 25% for free?", "Gift Aid costs you nothing. Everything here is optional.", "Everything on this step is optional"] : ["Anything to add?", "Everything here is optional.", "Everything on this step is optional"],
        ["Where should we send your receipt?", c.giftAid && s.ga ? "Just your name and email, plus your home address for Gift Aid." : "Just your name and email.", "Never sold or shared"],
        ["How would you like to pay?", "Your bank confirms the payment before we say thank you.", "Encrypted. Never stored by the charity"],
    ][Math.min(3, step)];
    const note = ck.busy ? (s.pay === "pending" ? "Payment started…" : "Authorised, waiting for your bank…") : Q[2];

    return (
        <div className="ck flex min-h-dvh flex-col overflow-x-clip bg-white lg:grid lg:grid-cols-[104px_minmax(0,1fr)_minmax(380px,480px)]">
            {/* Step rail: a column on desktop, a bar on phones */}
            <nav aria-label="Steps" className="flex items-center gap-3 border-b border-(--ck-sep) px-4 py-3 lg:sticky lg:top-0 lg:h-dvh lg:flex-col lg:border-r lg:border-b-0 lg:px-0 lg:py-8">
                <svg width="40" height="28" viewBox="0 0 34 24" role="img" aria-label={brand} className="flex-none"><circle cx="12" cy="12" r="10" fill="none" stroke="#C77BE6" strokeWidth="3.5" /><circle cx="22" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3.5" /></svg>
                <div className="ml-auto flex gap-3 sm:gap-5 lg:my-auto lg:ml-0 lg:flex-col lg:gap-[22px]">
                    {NAMES.map((label, i) => {
                        const past = i < step || done, cur = i === step;
                        return (
                            <button key={label} type="button" disabled={i > step || done} onClick={() => ck.go(i)} aria-current={cur ? "step" : undefined} className="flex flex-col items-center gap-1.5 border-0 bg-transparent p-0" style={{ color: past ? "var(--ck-green)" : cur ? "var(--ck-ink)" : "var(--ck-muted)" }}>
                                <span className="flex size-10 items-center justify-center rounded-2xl text-[16px] font-extrabold lg:size-[46px] lg:text-[17px]" style={{ background: past ? "var(--ck-green-soft)" : cur ? "var(--ck-accent)" : "var(--ck-seg)", boxShadow: cur ? "0 8px 18px rgba(150,70,190,0.30)" : "none" }}>{past ? "✓" : i + 1}</span>
                                <span className="text-[12px] font-extrabold">{label}</span>
                            </button>
                        );
                    })}
                </div>
                <svg width="18" height="18" viewBox="0 0 14 14" role="img" aria-label="Secure checkout" className="hidden lg:block"><rect x="2.5" y="6" width="9" height="6.5" rx="1.5" fill="none" stroke="var(--ck-muted)" strokeWidth="1.5" /><path d="M4.5 6V4.2a2.5 2.5 0 015 0V6" fill="none" stroke="var(--ck-muted)" strokeWidth="1.5" /></svg>
            </nav>

            <main className={cx("flex min-w-0 flex-col gap-[22px] px-4 py-6 sm:px-10 lg:px-16 lg:py-9", done ? "order-3 lg:order-none lg:col-start-3 lg:row-start-1" : "")}>
                {!done ? (
                    <div className="flex flex-1 flex-col justify-center gap-[30px]">
                        <div key={step} className="ck-fade flex items-center justify-between gap-6">
                            <div className="flex min-w-0 flex-col gap-2.5">
                                <h1 className="m-0 max-w-[13em] text-[32px] leading-[1.05] font-bold tracking-[-1.2px] text-balance sm:text-[48px] sm:tracking-[-1.8px]">{Q[0]}</h1>
                                <p className="m-0 text-[16px] text-(--ck-muted) sm:text-[18px]">{Q[1]}</p>
                            </div>
                            <div aria-hidden="true" className="hidden size-[132px] flex-none sm:block">{ART[step]}</div>
                        </div>

                        <div key={`b${step}`} className="ck-fade flex flex-col">
                            {step === 0 && (
                                <div className="flex flex-wrap items-center gap-x-12 gap-y-7">
                                    <div className="mx-auto w-full max-w-[330px] flex-[0_1_330px] sm:mx-0"><Dial ck={ck} size={330} ground="var(--ck-tint)" /></div>
                                    <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-[18px]">
                                        <div className="flex flex-wrap gap-2.5"><Presets ck={ck} className="min-h-[58px] rounded-[18px]" /></div>
                                        <AmountInput ck={ck} label="Type another amount" />
                                        <div className="flex flex-col gap-2"><span className="text-[14px] font-extrabold">How often?</span><FreqSeg ck={ck} track="bg-(--ck-seg)" /></div>
                                        <div className="flex items-center gap-3 rounded-[18px] bg-(--ck-coral-soft) px-[18px] py-3.5 text-[16px] font-bold text-(--ck-coral-ink)"><strong className="text-[20px] font-extrabold whitespace-nowrap">{f(s.amount)}</strong>pays for {impactFor(s.amount, c)}</div>
                                    </div>
                                </div>
                            )}
                            {step === 1 && (
                                <div className="flex flex-col gap-3.5">
                                    {c.giftAid && <>
                                        {([[true, "Yes, add Gift Aid", "I’m a UK taxpayer. The charity claims 25p for every £1 from HMRC.", `+${f(ck.gaAdds)}`], [false, "No thanks", "I don’t pay UK tax, or I’d rather not.", ""]] as const).map(([v, title, sub, right]) => {
                                            const on = s.ga === v, col = v ? "#C99A12" : "var(--ck-accent-strong)";
                                            return (
                                                <button key={title} type="button" aria-pressed={on} onClick={() => ck.setGa(v)} className="ck-soft flex min-h-[84px] items-center gap-[18px] rounded-3xl border-2 px-[22px] py-3.5 text-left text-(--ck-ink)" style={{ borderColor: on ? col : "var(--ck-line)", background: on ? (v ? "var(--ck-gold-soft)" : "var(--ck-accent-soft)") : "#fff" }}>
                                                    <Radio on={on} color={col} />
                                                    <span className="flex flex-1 flex-col gap-[3px]"><strong className="text-[19px] font-extrabold tracking-[-0.3px] sm:text-[21px]">{title}</strong><span className="text-[15px] text-(--ck-muted)">{sub}</span></span>
                                                    {right && <strong className="text-[24px] font-extrabold tracking-[-0.8px] whitespace-nowrap text-(--ck-green) sm:text-[30px]">{right}</strong>}
                                                </button>
                                            );
                                        })}
                                        <span className="text-[13px] leading-normal text-(--ck-muted)">By choosing yes you confirm that if you pay less Income Tax or Capital Gains Tax than the Gift Aid claimed on all your donations this tax year, you will pay any difference.</span>
                                    </>}
                                    <span className="mt-2.5 text-[14px] font-extrabold">Small extras, if you like</span>
                                    <Extras ck={ck} grid />
                                    <Tribute ck={ck} />
                                    <Nudge ck={ck} />
                                </div>
                            )}
                            {step === 2 && <><Details ck={ck} address="flat" prefsRow /></>}
                            {step === 3 && (
                                <div data-ck-methods className="flex flex-col gap-3">
                                    <NoPayments ck={ck} />
                                    <ExpressGiftAid ck={ck} />
                                    {ck.methods.map((m) => {
                                        const on = ck.method === m;
                                        return (
                                            <div key={m} className="flex flex-col rounded-3xl border-2" style={{ borderColor: on ? "var(--ck-accent-strong)" : "var(--ck-line)", background: on ? "var(--ck-accent-soft)" : "#fff" }}>
                                                <button type="button" aria-pressed={on} onClick={() => ck.setMethod(m)} className="flex min-h-[68px] items-center gap-4 rounded-[22px] border-0 bg-transparent px-4 py-2.5 text-left text-(--ck-ink) sm:px-5">
                                                    <Radio on={on} />
                                                    <span className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5"><strong className="text-[19px] font-extrabold tracking-[-0.3px] sm:text-[20px]">{METHOD_NAME[m]}</strong><span className="text-[14px] text-(--ck-muted) sm:text-[15px]">{SUB[m]}</span></span>
                                                    {TAG[m] && <span className="text-[12px] font-extrabold tracking-[0.5px] text-(--ck-green) uppercase">{TAG[m]}</span>}
                                                </button>
                                                {on && (m === "card" || m === "bank" || m === "dd") && <div className="flex flex-col gap-2 px-4 pb-[18px] sm:px-5"><PayFields ck={ck} bankNote={false} /></div>}
                                            </div>
                                        );
                                    })}
                                    <Mandate ck={ck} />
                                    <TrustPanel ck={ck} />
                                </div>
                            )}
                            <Err ck={ck} className="mt-3" />
                        </div>

                        <div className="sticky bottom-0 z-10 -mx-4 -my-4 flex flex-wrap items-center gap-3 bg-white px-4 py-4 shadow-[0_-8px_16px_-12px_rgba(26,20,64,0.25)] sm:mx-0 sm:px-0 sm:shadow-none">
                            {step > 0 && <button type="button" onClick={ck.back} className={cx(soft, "min-h-16 rounded-[20px] text-[17px]")}>Back</button>}
                            <button type="button" onClick={ck.next} disabled={ck.busy} className={cx(cta, "min-h-16 flex-[1_1_200px] rounded-[20px] text-[19px] sm:flex-[0_1_340px]")}>{step === 0 ? `Continue with ${f(s.amount)}` : step === 1 ? "Continue" : step === 2 ? "Continue to payment" : ck.busy ? "Waiting for your bank…" : `Give ${f(q.total)}`}</button>
                            {step === 0 && ck.wallets && <button type="button" onClick={ck.express} className={cx(dark, "min-h-16 rounded-[20px] text-[17px]")}>Apple Pay</button>}
                            <span role={ck.busy ? "status" : undefined} className="text-[14px] font-semibold text-(--ck-muted) sm:ml-2.5">{note}</span>
                        </div>
                    </div>
                ) : (
                    <div className="ck-fade flex flex-1 flex-col justify-center gap-[26px]">
                        <div className="flex items-center gap-[18px]" aria-live="polite">
                            <span aria-hidden="true" className="size-[88px] flex-none sm:size-[108px]">{ART[4]}</span>
                            <span className={cx("rounded-[10px] px-3 py-2 text-[13px] font-extrabold", ck.pending ? "bg-[#F8E5A6] text-(--ck-gold-ink)" : "bg-(--ck-green-soft) text-(--ck-green-ink)")}>{ck.pending ? end.chip : "Payment confirmed by your bank"}</span>
                        </div>
                        <h1 className={cx("m-0 leading-none font-bold text-balance", ck.pending ? "text-[38px] tracking-[-1.4px] sm:text-[56px] sm:tracking-[-2.2px]" : "text-[48px] tracking-[-2px] sm:text-[76px] sm:tracking-[-3px]")}>{end.title}</h1>
                        <p className="m-0 max-w-[30em] text-[18px] leading-normal text-(--ck-ink-2) sm:text-[20px]">{ck.pending ? end.body : <>Your ticket is your receipt. {cap(c.beneficiary)} gets <strong className="font-extrabold text-(--ck-ink)">{f(q.receives)}</strong> because of you.</>}</p>
                        <Later ck={ck} manage className="rounded-[20px] px-5 py-4 text-[15px]" />
                        {ck.nextUp && <div className="flex flex-col rounded-[28px] bg-(--ck-tint) px-6 py-[22px]"><NextStep ck={ck} onShare={onShare} onStart={onStart} /></div>}
                        <AfterButtons ck={ck} onShare={onShare} onStart={onStart} receipt className="grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))]" />
                    </div>
                )}
            </main>

            <aside aria-label="Your gift ticket" className={cx("relative m-3 flex items-center justify-center rounded-[32px] px-4 py-8 sm:m-5 sm:rounded-[40px] sm:px-6 lg:sticky lg:top-5 lg:min-h-[calc(100dvh-40px)] lg:self-start", done ? "order-2 lg:order-none lg:col-start-2 lg:row-start-1 bg-[#E9E4FB] [background-image:radial-gradient(circle_at_20%_10%,#D2EFDF_0,rgba(210,239,223,0)_50%),radial-gradient(circle_at_85%_90%,#F7D9FB_0,rgba(247,217,251,0)_50%)]" : "bg-[#E9E4FB] [background-image:radial-gradient(circle_at_80%_10%,#F7D9FB_0,rgba(247,217,251,0)_50%)]")}>
                {done && <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">{CONFETTI.map(([x, y, w, h, r, bg, rot], i) => <span key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%`, width: w, height: h, borderRadius: r, background: bg, transform: `rotate(${rot}deg)` }} />)}</div>}
                <div className="relative w-full rounded-[30px] bg-white shadow-[0_30px_60px_rgba(90,60,170,0.22)] transition-transform duration-300" style={{ maxWidth: done ? 440 : 390, transform: done ? "rotate(-2deg)" : "rotate(2deg)" }}>
                    <div className="overflow-hidden rounded-t-[30px] leading-[0]">{SCENE}</div>
                    <div className="flex flex-col gap-3 px-6 pt-[18px] pb-5 sm:px-7">
                        <div className="flex items-center justify-between text-[12px] font-extrabold tracking-[1.4px] uppercase"><span className="text-(--ck-link)">Gift ticket</span><span className="text-(--ck-muted)">No. {ticketNo(c.id)}</span></div>
                        <div className="flex flex-col gap-1"><span className="text-[13px] font-bold text-(--ck-muted)">{c.charity}</span><strong className="text-[22px] leading-[1.12] font-extrabold tracking-[-0.6px] sm:text-[24px]">{c.title}</strong><span className="text-[14px] font-bold text-(--ck-muted)">{fullName ? `For ${fullName}` : ck.trust?.registration ? `Registered charity no. ${ck.trust.registration.regNo}` : ""}</span></div>
                        <div className="flex flex-col gap-1.5"><div className="h-2 rounded-full bg-[#EFE9FA]"><div className="h-full rounded-full bg-linear-to-r from-[#E7B4F7] to-(--ck-accent-strong)" style={{ width: `${Math.min(100, pct)}%` }} /></div><span className="text-[13px] font-bold text-(--ck-muted)">{f(c.raised)} of {f(c.goal)}, {pct}% funded</span></div>
                    </div>
                    <div aria-hidden="true" className="relative mx-[22px] h-0 border-t-2 border-dashed border-[#D9D2E8]"><span className="absolute -top-[17px] -left-[38px] size-8 rounded-full bg-[#E9E4FB]" /><span className="absolute -top-[17px] -right-[38px] size-8 rounded-full bg-[#E9E4FB]" /></div>
                    <div className="flex flex-col gap-3 px-6 pt-[22px] pb-5 sm:px-7">
                        <GiftRows ck={ck} feeLabel="Card fee covered" />
                        {c.giftAid && step === 0 && !s.express && <Row k="Gift Aid" v="- - -" pending />}
                        {/* On the amount step Gift Aid is still to be chosen, so it shows as a blank; the match is real either way. */}
                        <Boosts ck={ck} giftAid={step > 0 || s.express} />
                        {step >= 3 ? <Row k={ck.pending ? "Paying with" : "Paid with"} v={s.paidWith || METHOD_NAME[ck.method]} /> : <Row k="Paid with" v="- - -" pending />}
                        <div className="mt-1 flex items-baseline justify-between border-t-[1.5px] border-(--ck-sep) pt-3.5"><span className="text-[15px] font-extrabold">{done ? (ck.pending ? end.total : "Paid") : "To pay"}</span><strong className="text-[34px] font-extrabold tracking-[-1.3px] whitespace-nowrap sm:text-[40px]">{f(q.total)}</strong></div>
                        {!done && <Later ck={ck} />}
                        <div aria-hidden="true" className="h-11 rounded-md [background:repeating-linear-gradient(90deg,#1A1440_0_3px,transparent_3px_6px,#1A1440_6px_7px,transparent_7px_12px,#1A1440_12px_16px,transparent_16px_19px)]" />
                        <span className="text-[11px] font-extrabold tracking-[1.2px] text-(--ck-muted) uppercase">{done && !ck.pending ? (s.email.trim() ? `Receipt sent to ${s.email.trim()}` : "Receipt sent to your email") : `Charity receives ${f(q.receives)}`}</span>
                    </div>
                    {done && <div className={cx("absolute right-[22px] bottom-[34px] -rotate-10 rounded-[14px] border-4 bg-white/95 px-[18px] py-1.5 text-[30px] font-extrabold tracking-[2px] uppercase shadow-[0_8px_18px_rgba(20,90,60,0.18)]", ck.pending ? "border-[#C99A12] text-(--ck-gold-ink)" : "border-(--ck-green) text-(--ck-green)")}>{end.stamp}</div>}
                </div>
            </aside>
        </div>
    );
};

const cap = (x: string) => x.replace(/^./, (m) => m.toUpperCase());
/** A stable four-digit number for the ticket, from the campaign id. */
const ticketNo = (id: string) => String([...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9000, 7) + 1000);

const CONFETTI: [number, number, number, number, string, string, number][] = [[8, 6, 14, 14, "50%", "#D9A0F0", 0], [22, 14, 10, 22, "4px", "#F8E5A6", 24], [82, 8, 16, 16, "50%", "#C9EBD8", 0], [90, 22, 10, 24, "4px", "#FBD6CE", -30], [6, 34, 12, 12, "50%", "#FBD6CE", 0], [93, 48, 14, 14, "50%", "#F8E5A6", 0], [5, 62, 10, 22, "4px", "#C9EBD8", 40], [91, 72, 12, 12, "50%", "#D9A0F0", 0], [12, 88, 16, 16, "50%", "#F8E5A6", 0], [30, 94, 10, 22, "4px", "#D9A0F0", -20], [70, 93, 14, 14, "50%", "#FBD6CE", 0], [86, 90, 10, 22, "4px", "#C9EBD8", 30], [50, 3, 10, 20, "4px", "#D9A0F0", 60]];

const SCENE = (
    <svg viewBox="0 0 390 132" aria-hidden="true" className="block h-auto w-full">
        <defs><linearGradient id="ckSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#35256E" /><stop offset="1" stopColor="#C39AE8" /></linearGradient></defs>
        <rect width="390" height="132" fill="url(#ckSky)" />
        <circle cx="322" cy="34" r="30" fill="#FBE9A9" opacity="0.16" /><circle cx="322" cy="34" r="17" fill="#FBE9A9" />
        <circle cx="40" cy="22" r="2" fill="#fff" /><circle cx="96" cy="40" r="1.6" fill="#fff" opacity="0.8" /><circle cx="140" cy="18" r="2.2" fill="#fff" opacity="0.9" /><circle cx="232" cy="26" r="1.8" fill="#fff" opacity="0.8" /><circle cx="274" cy="52" r="1.6" fill="#fff" opacity="0.7" /><circle cx="362" cy="70" r="2" fill="#fff" opacity="0.8" /><circle cx="24" cy="62" r="1.6" fill="#fff" opacity="0.7" /><circle cx="118" cy="66" r="1.8" fill="#fff" opacity="0.6" />
        <path d="M0 106 Q90 84 190 102 T390 94 V132 H0z" fill="#EFE7FC" />
        <path d="M58 106 L76 66 L94 106z" fill="#2B1F5E" /><path d="M68 84 L76 66 L84 84z" fill="#fff" />
        <path d="M84 108 L98 78 L112 108z" fill="#3A2B78" /><path d="M92 91 L98 78 L104 91z" fill="#fff" />
        <path d="M296 102 L312 64 L328 102z" fill="#2B1F5E" /><path d="M305 81 L312 64 L319 81z" fill="#fff" />
        <ellipse cx="205" cy="106" rx="78" ry="9" fill="#FFD66B" opacity="0.35" />
        <rect x="150" y="58" width="110" height="48" fill="#1A1440" />
        <path d="M140 60 L205 28 L270 60z" fill="#2B1F5E" /><path d="M140 60 L205 28 L270 60 L258 60 L205 36 L152 60z" fill="#fff" />
        <rect x="162" y="70" width="24" height="20" rx="3" fill="#FFD66B" /><rect x="224" y="70" width="24" height="20" rx="3" fill="#FFD66B" />
        <path d="M174 70v20M162 80h24M236 70v20M224 80h24" stroke="#1A1440" strokeWidth="2" />
        <rect x="196" y="78" width="18" height="28" rx="3" fill="#D9A0F0" /><circle cx="210" cy="93" r="1.6" fill="#1A1440" />
        <rect x="188" y="46" width="34" height="10" rx="3" fill="#D9A0F0" />
        <circle cx="56" cy="118" r="3" fill="#fff" /><circle cx="340" cy="116" r="4" fill="#fff" /><circle cx="250" cy="122" r="2.5" fill="#fff" />
    </svg>
);

const art = (children: React.ReactNode) => <svg viewBox="0 0 120 120" className="block size-full">{children}</svg>;
const ART = [
    art(<><circle cx="60" cy="60" r="56" fill="#F4F0FC" /><ellipse cx="50" cy="90" rx="30" ry="10" fill="#E9C766" /><ellipse cx="50" cy="84" rx="30" ry="10" fill="#F8E5A6" stroke="#D9B45A" strokeWidth="2" /><ellipse cx="50" cy="72" rx="30" ry="10" fill="#E9C766" /><ellipse cx="50" cy="66" rx="30" ry="10" fill="#F8E5A6" stroke="#D9B45A" strokeWidth="2" /><ellipse cx="50" cy="54" rx="30" ry="10" fill="#E9C766" /><ellipse cx="50" cy="48" rx="30" ry="10" fill="#F8E5A6" stroke="#D9B45A" strokeWidth="2" /><path d="M50 43v10M45 48h10" stroke="#B8922F" strokeWidth="2.5" strokeLinecap="round" /><path d="M88 40c-7-11-24-3-17 10l17 17 17-17c7-13-10-21-17-10z" fill="#D9A0F0" stroke="#B45FD6" strokeWidth="2.5" strokeLinejoin="round" /><circle cx="98" cy="84" r="4" fill="#C9EBD8" /><circle cx="20" cy="30" r="3" fill="#FBD6CE" /></>),
    art(<><circle cx="60" cy="60" r="56" fill="#FDF6DD" /><rect x="28" y="58" width="60" height="42" rx="7" fill="#D9A0F0" /><rect x="23" y="46" width="70" height="17" rx="6" fill="#B45FD6" /><rect x="53" y="46" width="10" height="54" fill="#F8E5A6" /><path d="M58 46c-4-14-22-14-20-4s14 6 20 4zm0 0c4-14 22-14 20-4s-14 6-20 4z" fill="none" stroke="#B45FD6" strokeWidth="5" strokeLinejoin="round" /><circle cx="92" cy="32" r="19" fill="#14704A" /><path d="M92 23v18M83 32h18" stroke="#fff" strokeWidth="4" strokeLinecap="round" /><path d="M18 34l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#E9C766" /></>),
    art(<><circle cx="60" cy="60" r="56" fill="#E7F6EE" /><rect x="38" y="20" width="44" height="52" rx="6" fill="#fff" stroke="#14704A" strokeWidth="2.5" /><path d="M47 34h26M47 44h26M47 54h16" stroke="#9AD3B6" strokeWidth="3" strokeLinecap="round" /><path d="M20 52l40 28 40-28v42a8 8 0 01-8 8H28a8 8 0 01-8-8z" fill="#D9A0F0" stroke="#B45FD6" strokeWidth="2.5" strokeLinejoin="round" /><path d="M22 98l28-24M98 98L70 74" stroke="#B45FD6" strokeWidth="2.5" strokeLinecap="round" /><circle cx="98" cy="30" r="4" fill="#F8E5A6" /></>),
    art(<><circle cx="60" cy="60" r="56" fill="#E3EAFE" /><g transform="rotate(-6 53 61)"><rect x="14" y="36" width="78" height="50" rx="9" fill="#1A1440" /><rect x="24" y="48" width="15" height="11" rx="2.5" fill="#F8E5A6" /><rect x="24" y="70" width="38" height="4" rx="2" fill="#D9D2E8" /><circle cx="78" cy="44" r="9" fill="none" stroke="#D9A0F0" strokeWidth="5" /></g><path d="M86 54l20 7v14c0 13-9 22-20 26-11-4-20-13-20-26V61z" fill="#C9EBD8" stroke="#14704A" strokeWidth="3" strokeLinejoin="round" /><path d="M77 77l7 7 12-13" fill="none" stroke="#14704A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></>),
    art(<><circle cx="60" cy="60" r="56" fill="#E7F6EE" /><path d="M60 14v10M24 28l7 7M96 28l-7 7M12 60h10M98 60h10" stroke="#9AD3B6" strokeWidth="4" strokeLinecap="round" /><path d="M60 92C40 78 30 68 30 54a15 15 0 0130-4 15 15 0 0130 4c0 14-10 24-30 38z" fill="#D9A0F0" stroke="#B45FD6" strokeWidth="3" strokeLinejoin="round" /><path d="M48 58l9 9 16-18" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="24" cy="92" r="4" fill="#F8E5A6" /><circle cx="98" cy="90" r="5" fill="#FBD6CE" /></>),
];
