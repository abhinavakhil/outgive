/** Pieces every checkout layout shares: the dial, amount buttons, switches, form fields, payment panels and receipt lines. */
import { type InputHTMLAttributes, type ReactNode, useRef, useState } from "react";
import { cx } from "@/shared/utils/cx";
import { OgLogo, OgMark } from "@/shared/ui";
import { type Brand, FREQS, FREQ_LABEL, METHOD_NAME, type Method, type QuoteLine, type Tone, accountOk, cardBrand, cardLength, dialAmount, dialRatio, expiryOk, formatCard, luhn, matchEnds, ratioAt, sortCodeOk, sponsorName } from "./model";
import { StripeFields } from "./StripeFields";
import type { Ck } from "./useCheckout";

export const cta = "ck-cta min-h-[60px] rounded-[18px] border-0 bg-(--ck-accent) px-6 text-[18px] font-extrabold text-(--ck-ink) shadow-[0_12px_24px_rgba(150,70,190,0.28)] disabled:opacity-75";
export const soft = "ck-soft min-h-[60px] rounded-[18px] border-[1.5px] border-(--ck-line) bg-white px-6 text-[16px] font-bold text-(--ck-ink)";
export const dark = "min-h-[56px] rounded-[18px] border-0 bg-(--ck-ink) px-5 text-[16px] font-bold text-white disabled:opacity-75";
export const TONE: Record<Tone, [string, string]> = { violet: ["#EFE9FB", "#4F2FC0"], coral: ["#FDE7E1", "#8A3524"], green: ["#DDF4E8", "#14704A"], gold: ["#FDF1C4", "#6B5408"] };

export const Logo = ({ name }: { name: string }) => (
    <a href="/" aria-label="Outgive home" className="flex items-center gap-2.5">{name.toLowerCase() === "outgive" ? <OgLogo size={26} tone="auto" /> : <><OgMark size={20} tone="auto" /><span className="text-[23px] font-bold tracking-[-0.6px]">{name}</span></>}</a>
);
const chip = "rounded-lg px-2 py-1 text-[12px] font-extrabold";
/** A line with a small badge in front. Pass `label={null}` for no badge: "Verified" is only for an organisation that is (ck.trust). */
export const Verified = ({ children, label, gold }: { children: ReactNode; label: string | null; gold?: boolean }) => (
    <span className="inline-flex flex-wrap items-center justify-center gap-2.5 text-[14px] font-bold text-(--ck-ink-2)">{label && <span className={cx(chip, gold ? "bg-[#F8E5A6] text-(--ck-gold-ink)" : "bg-(--ck-mint) text-(--ck-green-ink)")}>{label}</span>}{children}</span>
);
const longDay = (d: Date, locale = "en-GB") => d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
/** Who the donor is paying, as checked. Nothing at all for an unverified organisation, and only the claims that are filled in. */
export const TrustPanel = ({ ck, className }: { ck: Ck; className?: string }) => {
    const t = ck.trust;
    if (!t) return null;
    const rows = [
        t.legalName && ["Charity", t.legalName],
        t.registration && ["Registered", `No. ${t.registration.regNo}, ${t.registration.regulator}`],
        t.fund && ["Your gift goes to", `${t.fund.name}${t.fund.restricted ? ", and is used only for that" : ""}`],
    ].filter((r): r is [string, string] => !!r);
    return (
        <div data-ck-trust className={cx("flex flex-col gap-2 rounded-[18px] border-[1.5px] border-(--ck-line-2) bg-white px-4 py-3.5 text-left text-[13.5px] leading-snug", className)}>
            <span className="flex flex-wrap items-center gap-2"><span className={cx(chip, "bg-(--ck-mint) text-(--ck-green-ink)")}>Verified</span><span className="font-bold text-(--ck-muted)">Checked on {longDay(t.verifiedAt, ck.c.locale)}</span></span>
            <dl className="m-0 flex flex-col gap-1.5">{rows.map(([k, v]) => <div key={k} className="flex flex-wrap gap-x-2"><dt className="font-bold text-(--ck-muted)">{k}</dt><dd className="m-0 font-extrabold [overflow-wrap:anywhere]">{v}</dd></div>)}</dl>
            {t.taxReceipts && <span className="text-(--ck-ink-2)">Your receipt can be used to claim tax relief.</span>}
        </div>
    );
};

/** A switch's look; the button around it carries aria-pressed. */
export const Switch = ({ on, green }: { on: boolean; green?: boolean }) => (
    <span aria-hidden="true" className="relative block h-[30px] w-[50px] flex-none rounded-full transition-colors" style={{ background: on ? (green ? "var(--ck-green)" : "var(--ck-accent-strong)") : "var(--ck-track)" }}>
        <span className="absolute top-[3px] size-6 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-[left]" style={{ left: on ? 23 : 3 }} />
    </span>
);
export const Radio = ({ on, color = "var(--ck-accent-strong)" }: { on: boolean; color?: string }) => (
    <span aria-hidden="true" className="flex size-[26px] flex-none items-center justify-center rounded-full border-2" style={{ borderColor: on ? color : "#BDB0DA" }}><span className="size-[13px] rounded-full" style={{ background: on ? color : "transparent" }} /></span>
);

/** Drag around the ring to pick 5–500 in 5s; the centre shows the amount. Keyboard: arrows step by 5. */
export const Dial = ({ ck, size = 350, ground = "rgba(255,255,255,0.7)" }: { ck: Ck; size?: number; ground?: string }) => {
    const drag = useRef(false);
    const { s, f } = ck;
    const at = (e: React.PointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        ck.setAmount(dialAmount(ratioAt(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), s.amount, drag.current)), "dial");
    };
    const ratio = dialRatio(s.amount), deg = Math.max(3, ratio * 360), th = ratio * Math.PI * 2;
    return (
        <div
            role="slider" tabIndex={0} aria-label="Gift amount" aria-valuemin={5} aria-valuemax={500} aria-valuenow={s.amount} aria-valuetext={f(s.amount)}
            className="ck-dial relative aspect-square w-full rounded-full" style={{ maxWidth: size }}
            onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browsers */ } drag.current = false; at(e); drag.current = true; }}
            onPointerMove={(e) => { if (drag.current) at(e); }}
            onPointerUp={() => { drag.current = false; }} onPointerCancel={() => { drag.current = false; }}
            onKeyDown={(e) => { const d = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 50, PageDown: -50 }[e.key]; if (d) { e.preventDefault(); ck.setAmount(s.amount + d, "dial"); } }}
        >
            <div className="pointer-events-none absolute inset-0 rounded-full" style={{ background: ground }} />
            <div className="ck-ring pointer-events-none absolute inset-0 rounded-full" style={{ background: `conic-gradient(#EFC6FA 0deg, var(--ck-accent-strong) ${deg}deg, #E7DFF6 ${deg}deg 360deg)` }} />
            <div className="ck-ticks pointer-events-none absolute inset-0 rounded-full" />
            <div className="pointer-events-none absolute inset-[19%] rounded-full bg-white shadow-[0_16px_36px_rgba(90,60,170,0.20)]" />
            <div className="pointer-events-none absolute -mt-[21px] -ml-[21px] size-[42px] rounded-full border-[5px] border-(--ck-accent-strong) bg-white shadow-[0_6px_16px_rgba(120,50,170,0.35)]" style={{ left: `${50 + 45 * Math.sin(th)}%`, top: `${50 - 45 * Math.cos(th)}%` }} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
                <span className="text-[14px] font-bold text-(--ck-muted)">{FREQ_LABEL[s.freq].line}</span>
                <strong className="text-[clamp(40px,12vw,64px)] leading-none font-extrabold tracking-[-2.4px] tabular-nums">{f(s.amount)}</strong>
                <span className="text-[13px] font-bold text-(--ck-muted)">Drag to change</span>
            </div>
        </div>
    );
};

export const Presets = ({ ck, filled = true, className }: { ck: Ck; filled?: boolean; className?: string }) => (
    <>
        {ck.presets.map((v) => {
            const on = ck.s.amount === v;
            return (
                <button key={v} type="button" aria-pressed={on} onClick={() => ck.setAmount(v, "preset")}
                    className={cx("ck-soft min-h-14 flex-[1_1_72px] rounded-2xl border-[1.5px] text-[18px] font-extrabold text-(--ck-ink)", className)}
                    style={{ borderColor: on ? "var(--ck-accent-strong)" : "var(--ck-line)", background: on && filled ? "var(--ck-accent)" : on ? "var(--ck-accent-soft)" : "#fff", boxShadow: on ? "0 8px 18px rgba(150,70,190,0.26)" : "0 2px 6px rgba(40,20,90,0.06)" }}>
                    {ck.f(v)}
                </button>
            );
        })}
    </>
);
export const AmountInput = ({ ck, className, label = "Other amount" }: { ck: Ck; className?: string; label?: string }) => {
    const sym = ck.f(0).replace(/[\d.,\s]/g, "");
    return (
        <label className={cx("relative block", className)}>
            <span aria-hidden="true" className="absolute top-1/2 left-4 -translate-y-1/2 text-[17px] font-extrabold text-(--ck-muted)">{sym}</span>
            <input className="ck-in bg-white! pl-8! text-[18px]! font-extrabold!" inputMode="numeric" aria-label={`${label} in ${ck.c.currency}`} placeholder="Other"
                value={ck.s.amountText} onChange={(e) => ck.typeAmount(e.target.value)} onBlur={ck.blurAmount} aria-invalid={ck.s.step === 0 && !!ck.s.err} />
        </label>
    );
};

/** A segmented control (one of a few). */
export const Seg = <T extends string>({ label, options, value, onPick, className, track = "bg-white/75 border border-white" }: { label: string; options: [T, ReactNode][]; value: T; onPick: (v: T) => void; className?: string; track?: string }) => (
    <div role="group" aria-label={label} className={cx("flex gap-1 rounded-[18px] p-[5px]", track, className)}>
        {options.map(([id, body]) => {
            const on = id === value;
            return <button key={id} type="button" aria-pressed={on} onClick={() => onPick(id)} className="min-h-[50px] flex-1 rounded-[13px] border-0 px-2 text-[15px] font-bold transition" style={{ background: on ? "#fff" : "transparent", color: on ? "var(--ck-ink)" : "var(--ck-muted)", boxShadow: on ? "0 4px 12px rgba(64,32,120,0.14)" : "none" }}>{body}</button>;
        })}
    </div>
);
export const FreqSeg = ({ ck, className, track }: { ck: Ck; className?: string; track?: string }) => <Seg label="How often" options={FREQS.map((x) => [x, FREQ_LABEL[x].short])} value={ck.s.freq} onPick={ck.setFreq} className={className} track={track} />;

/** Line icons for fields, 24px stroke paths. */
export const FIELD_ICON = {
    user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20c1.4-3.4 4.3-5 7.5-5s6.1 1.6 7.5 5",
    mail: "M3.5 6.5h17v11h-17zM4 7.5l8 6 8-6",
    pin: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
    home: "M4 10.5L12 4l8 6.5V20H4zM9.5 20v-5.5h5V20",
    card: "M3 6.5h18v11H3zM3 10.5h18M6.5 14.5h4",
    calendar: "M4 6h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4",
    lock: "M6 11h12v9H6zM8.5 11V8.5a3.5 3.5 0 017 0V11",
    heart: "M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z",
    bank: "M3.5 9.5L12 4l8.5 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3.5 20h17",
    hash: "M9 4l-2 16M17 4l-2 16M4.5 9h16M3.5 15h16",
};
export const Icon = ({ d, className, size = 20 }: { d: string; className?: string; size?: number }) => <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={className}><path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/** A labelled input, with an optional leading icon, something on the right (a badge, a tick) and a hint underneath. */
export const Field = ({ label, className, invalid, icon, trailing, hint, ...p }: { label: string; className?: string; invalid?: boolean; icon?: string; trailing?: ReactNode; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) => (
    <label className={cx("flex min-w-0 flex-col gap-1.5", className)}>
        <span className="ck-label">{label}</span>
        <span className="relative block">
            {icon && <Icon d={icon} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#a6a2b8]" />}
            <input className={cx("ck-in", icon && "pl-11!", trailing && "pr-12!")} aria-invalid={invalid || undefined} {...p} />
            {trailing && <span className="absolute top-1/2 right-3.5 -translate-y-1/2">{trailing}</span>}
        </span>
        {hint && <span className="ck-hint">{hint}</span>}
    </label>
);

const errOn = (ck: Ck, field: RegExp) => !!ck.s.err && field.test(ck.s.err);

export const Extras = ({ ck, grid }: { ck: Ck; grid?: boolean }) => (
    <div className={grid ? "grid grid-cols-[repeat(auto-fit,minmax(min(270px,100%),1fr))] gap-3" : "flex flex-col overflow-hidden rounded-3xl border-[1.5px] border-(--ck-line-2)"}>
        {(ck.c.extras ?? []).map((x, i) => {
            const on = !!ck.s.picks[x.id], [tile, ink] = TONE[x.tone];
            // Every price says whether it is charged once or with each payment: only a covered fee repeats on a regular gift.
            const cost = x.price === "fee" ? ck.q.fee : x.price, price = cost ? `+${ck.f(cost)}` : "Free";
            const when = !cost ? "" : x.price === "fee" && ck.recurring ? FREQ_LABEL[ck.s.freq].every : "one-time";
            const inline = <span className="text-[14px] font-extrabold text-(--ck-link)">{price}{when && <span className="font-bold text-(--ck-muted)"> {when}</span>}</span>;
            return (
                <button key={x.id} type="button" aria-pressed={on} onClick={() => ck.toggleExtra(x.id)}
                    className={cx("ck-row flex items-center gap-3.5 border-0 text-left text-(--ck-ink)", grid ? "min-h-[72px] rounded-[20px] border-[1.5px]! px-4 py-3" : "min-h-[72px] px-4 py-2.5")}
                    style={grid ? { borderColor: on ? "var(--ck-accent-strong)" : "var(--ck-line)", background: on ? "var(--ck-accent-soft)" : "#fff" } : { borderTop: i ? "1.5px solid var(--ck-sep)" : 0, background: on ? "#FCF7FF" : "#fff" }}>
                    <span aria-hidden="true" className="flex size-[46px] flex-none items-center justify-center rounded-[14px]" style={{ background: tile }}><svg width="24" height="24" viewBox="0 0 24 24"><path d={x.icon} fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5"><strong className="text-[16px] font-extrabold">{x.name}</strong>{grid ? inline : <>{x.desc && <span className="text-[14px] leading-snug text-(--ck-muted)">{x.desc}</span>}<span className="sm:hidden">{inline}</span></>}</span>
                    {!grid && <span className="hidden flex-none flex-col items-end sm:flex"><strong className="text-[15px] font-extrabold whitespace-nowrap text-(--ck-link)">{price}</strong>{when && <span className="text-[12px] font-bold whitespace-nowrap text-(--ck-muted)">{when}</span>}</span>}
                    <Switch on={on} />
                </button>
            );
        })}
    </div>
);
export const Tribute = ({ ck }: { ck: Ck }) => ck.s.picks.tribute ? (
    <div className="ck-fade grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-3">
        <Field label="Dedicated to" icon={FIELD_ICON.heart} placeholder="Their name" value={ck.s.tributeName} onChange={(e) => ck.set({ tributeName: e.target.value })} />
        <Field label="Send an e-card to" icon={FIELD_ICON.mail} type="email" placeholder="recipient@example.com" value={ck.s.tributeEmail} onChange={(e) => ck.set({ tributeEmail: e.target.value })} />
    </div>
) : null;

/** Gift Aid's yellow framed card. */
export const GoldFrame = ({ children, foot }: { children: ReactNode; foot?: ReactNode }) => (
    <div className="rounded-[28px] bg-linear-to-b from-[#F3D46C] to-[#F8E7A9] p-[7px]">
        <div className="rounded-[22px] bg-white px-5 py-[18px] shadow-[0_10px_24px_rgba(140,100,10,0.16)]">{children}</div>
        {foot && <div className="px-[18px] pt-[11px] pb-[7px] text-[12px] font-extrabold tracking-[1.1px] text-(--ck-gold-ink)">{foot}</div>}
    </div>
);

export const Prefs = ({ ck, row }: { ck: Ck; row?: boolean }) => {
    const items: [keyof Ck["s"], string, string][] = [["anon", "Hide my name on the campaign page", "The charity still sees it for your receipt"], ["updates", `Email me updates from ${ck.c.beneficiary}`, "Separate from your receipt. Unsubscribe any time"]];
    return (
        <div className={row ? "flex flex-wrap gap-3" : "flex flex-col overflow-hidden rounded-3xl border-[1.5px] border-(--ck-line-2)"}>
            {items.map(([k, name, desc], i) => {
                const on = !!ck.s[k];
                return (
                    <button key={k} type="button" aria-pressed={on} onClick={() => ck.set({ [k]: !on })}
                        className={cx("ck-row flex items-center gap-3.5 border-0 text-left text-(--ck-ink)", row ? "min-h-[60px] flex-[1_1_240px] rounded-[18px] border-[1.5px]! px-[18px]" : "min-h-[70px] px-4 py-2.5")}
                        style={row ? { borderColor: on ? "var(--ck-accent-strong)" : "var(--ck-line)", background: on ? "var(--ck-accent-soft)" : "#fff" } : { borderTop: i ? "1.5px solid var(--ck-sep)" : 0, background: on ? "#FCF7FF" : "#fff" }}>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5"><strong className="text-[15px] font-extrabold sm:text-[16px]">{name}</strong>{!row && <span className="text-[14px] leading-snug text-(--ck-muted)">{desc}</span>}</span>
                        <Switch on={on} />
                    </button>
                );
            })}
        </div>
    );
};

/** The home address HMRC needs for a Gift Aid declaration. */
const GiftAidAddress = ({ ck, postcodeLabel = "Postcode" }: { ck: Ck; postcodeLabel?: string }) => (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <Field label={postcodeLabel} icon={FIELD_ICON.pin} autoComplete="postal-code" placeholder="LS9 7AB" value={ck.s.postcode} onChange={(e) => ck.set({ postcode: e.target.value, ...fixed(ck, "postcode") })} invalid={ck.s.errField === "postcode"} />
        <Field label="House number and street" icon={FIELD_ICON.home} placeholder="12 Marsh Lane" autoComplete="address-line1" value={ck.s.address} onChange={(e) => ck.set({ address: e.target.value, ...fixed(ck, "address") })} invalid={ck.s.errField === "address"} />
    </div>
);
/** Typing in the field an error points at clears that error. */
const fixed = (ck: Ck, field: string) => (ck.s.errField === field ? { err: "", errField: "" } : {});
const addressErr = (ck: Ck) => ck.s.errField === "postcode" || ck.s.errField === "address";
export const GIFT_AID_DECLARATION = "I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the Gift Aid claimed on all my donations in that tax year, it is my responsibility to pay any difference.";

/**
 * The fast path's Gift Aid question, on the payment step: yes or no, and the home address only for a yes.
 * The wallet supplies the donor's name, so nothing else is asked.
 */
export const ExpressGiftAid = ({ ck }: { ck: Ck }) => {
    const { s, c } = ck;
    if (!c.giftAid || !s.express) return null;
    return (
        <div className="ck-fade flex flex-col gap-3 rounded-[22px] bg-(--ck-gold-soft) p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5"><strong className="text-[16px] font-extrabold">Add {ck.f(ck.gaAdds)} with Gift Aid?</strong><span className="text-[13.5px] leading-snug text-(--ck-gold-ink)">Free if you pay UK tax. HMRC adds 25p to every £1.</span></span>
                <Seg label="Add Gift Aid" options={[["yes", "Yes"], ["no", "No"]]} value={s.ga ? "yes" : "no"} onPick={(v) => ck.setGa(v === "yes")} className="flex-[1_1_140px] sm:flex-[0_0_150px]" track="bg-white/70 border border-white" />
            </div>
            {s.ga && <>
                <GiftAidAddress ck={ck} />
                {/* Said here, beside the fields it is about; Err leaves it out on this step. */}
                {addressErr(ck) && <p role="alert" className="m-0 text-[14.5px] font-bold text-(--ck-err)">{s.err}</p>}
                <span className="text-[12.5px] leading-normal text-(--ck-gold-ink)">{GIFT_AID_DECLARATION}</span>
            </>}
        </div>
    );
};

/**
 * Before payment, on the boost step: a one-off gift can become a smaller monthly one. Inline, never a modal, and
 * "Keep it one-off" is remembered for the session. After a yes, one tap changes it back.
 */
export const Nudge = ({ ck, className }: { ck: Ck; className?: string }) => {
    const { s, f, c } = ck, small = "min-h-11 rounded-[14px] px-4 text-[14.5px] font-extrabold";
    if (s.step !== 1) return null;
    if (!ck.nudge) return s.nudgeFrom > 0 && s.freq === "monthly" ? (
        <div role="status" className={cx("flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[18px] bg-(--ck-green-soft) px-4 py-3 text-[14.5px] font-bold text-(--ck-green-ink)", className)}>
            <span className="min-w-0 flex-[1_1_200px]">You’re now giving {f(s.amount)} every month.</span>
            <button type="button" onClick={ck.undoNudge} className={cx(small, "border-0 bg-white text-(--ck-ink)")}>Change back to {f(s.nudgeFrom)} one-off</button>
        </div>
    ) : null;
    return (
        <div role="group" aria-label="Give monthly instead" className={cx("ck-fade flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[22px] border-[1.5px] border-(--ck-line) bg-(--ck-tint) p-4", className)}>
            <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5"><strong className="text-[16px] font-extrabold">Give {f(ck.nudge.amount)} a month instead?</strong><span className="text-[14px] leading-snug text-(--ck-muted)">A regular gift lets {c.beneficiary} plan ahead. You can cancel any time.</span></span>
            <span className="flex flex-wrap gap-2">
                <button type="button" onClick={ck.acceptNudge} className={cx(small, "border-0 bg-(--ck-ink) text-white")}>Switch to monthly</button>
                <button type="button" onClick={ck.declineNudge} className={cx(small, "ck-soft border-[1.5px] border-(--ck-line) bg-white text-(--ck-ink)")}>Keep it one-off</button>
            </span>
        </div>
    );
};

/** Name, email, and the Gift Aid address when Gift Aid is on. */
export const Details = ({ ck, address = "gold", prefsRow }: { ck: Ck; address?: "gold" | "flat"; prefsRow?: boolean }) => {
    const { s, set, c } = ck;
    const ga = c.giftAid && s.ga;
    const addr = <GiftAidAddress ck={ck} postcodeLabel={address === "flat" ? "Postcode for Gift Aid" : "Postcode"} />;
    return (
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-3.5">
                <Field label="First name" icon={FIELD_ICON.user} placeholder="Sam" autoComplete="given-name" value={s.first} onChange={(e) => set({ first: e.target.value })} invalid={errOn(ck, /first name/)} />
                <Field label="Last name" placeholder="Taylor" autoComplete="family-name" value={s.last} onChange={(e) => set({ last: e.target.value })} invalid={errOn(ck, /last name/)} />
                <Field label="Email" className="col-span-full" icon={FIELD_ICON.mail} hint="We’ll send your receipt here." type="email" autoComplete="email" placeholder="you@example.co.uk" value={s.email} onChange={(e) => set({ email: e.target.value })} invalid={errOn(ck, /email/)} />
                {/* Its own opt-in, off by default, and nothing to do with the charity's updates below. */}
                <label className="col-span-full -mt-1.5 flex min-h-11 cursor-pointer items-center gap-3 text-[14px] leading-snug font-semibold text-(--ck-ink-2)">
                    <input type="checkbox" className="ck-check" checked={s.recover} onChange={(e) => set({ recover: e.target.checked })} />
                    <span>Email me a link to finish this gift if I don’t complete it.</span>
                </label>
            </div>
            {ga && (address === "gold"
                ? <GoldFrame foot="HMRC uses this to match your gift to your tax record"><strong className="mb-3 block text-[17px] font-extrabold">Home address for Gift Aid</strong>{addr}</GoldFrame>
                : <div className="rounded-[26px] bg-(--ck-gold-soft) p-[18px]">{addr}</div>)}
            <Prefs ck={ck} row={prefsRow} />
        </div>
    );
};

const BrandMark = ({ brand, onDark }: { brand: Brand; onDark?: boolean }) => {
    if (brand === "visa") return <span className={cx("text-[15px] font-extrabold tracking-[-0.3px] italic", onDark ? "text-white" : "text-[#1A1F71]")}>VISA</span>;
    if (brand === "mastercard") return <span className="flex"><span className="size-[18px] rounded-full bg-[#EB001B]" /><span className="-ml-2 size-[18px] rounded-full bg-[#F79E1B] opacity-90" /></span>;
    if (brand === "amex") return <span className="rounded-[4px] bg-[#2E77BC] px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.5px] text-white">AMEX</span>;
    return null;
};
const Tick = () => <span className="flex size-6 items-center justify-center rounded-full bg-(--ck-green-soft) text-(--ck-green)"><Icon d="M6 12.5l4 4 8-9" size={14} /></span>;
const inGroupIcon = "pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#a6a2b8]";

/** The card as it fills in. It turns over to show the security code. */
export const CardPreview = ({ ck, flipped }: { ck: Ck; flipped?: boolean }) => {
    const { card, exp, cvc, holder } = ck.s;
    const brand = cardBrand(card), len = cardLength(brand);
    const number = formatCard((card + "•".repeat(len)).slice(0, len));
    const face = "ck-face overflow-hidden rounded-[20px] bg-(--ck-ink) text-white shadow-[0_0_0_6px_rgba(217,160,240,0.28),0_18px_36px_rgba(26,20,64,0.32)]";
    return (
        <div aria-hidden="true" className={cx("ck-card3d w-[300px] max-w-full", flipped && "is-flipped")}>
            <div className="relative aspect-[1.586] w-full">
                <div className={cx(face, "flex flex-col justify-between px-5 py-[18px]")}>
                    <div className="absolute -top-[52px] -right-[52px] size-44 rounded-full border-[26px] border-(--ck-accent) opacity-90" />
                    <div className="absolute top-[34px] right-[34px] size-44 rounded-full border-[26px] border-white/10" />
                    <div className="relative flex items-start justify-between">
                        <span className="h-[28px] w-[38px] rounded-[7px] bg-linear-135 from-[#F8E5A6] to-[#D9B45A] shadow-[inset_0_0_0_1px_rgba(120,80,10,0.25)]" />
                        <span className="flex h-7 items-center"><BrandMark brand={brand} onDark /></span>
                    </div>
                    <div className="relative flex flex-col gap-3">
                        <span className="text-[19px] font-bold tracking-[1.8px] whitespace-nowrap tabular-nums">{number}</span>
                        <div className="flex items-end justify-between gap-3">
                            <span className="flex min-w-0 flex-col gap-0.5"><span className="text-[9px] font-bold tracking-[1.2px] text-white/60 uppercase">Card holder</span><span className="truncate text-[12.5px] font-bold tracking-[0.8px] uppercase">{holder.trim() || "Your name"}</span></span>
                            <span className="flex flex-none flex-col gap-0.5 text-right"><span className="text-[9px] font-bold tracking-[1.2px] text-white/60 uppercase">Expires</span><span className="text-[12.5px] font-bold tracking-[0.8px] tabular-nums">{exp.length > 2 ? `${exp.slice(0, 2)}/${exp.slice(2)}` : "MM/YY"}</span></span>
                        </div>
                    </div>
                </div>
                <div className={cx(face, "ck-face-back flex flex-col pt-6")}>
                    <div className="h-10 bg-[#0B0820]" />
                    <div className="mx-5 mt-4 flex items-center gap-3">
                        <div className="h-9 flex-1 rounded-md [background:repeating-linear-gradient(-45deg,#F4F0FC_0_6px,#E7DFF6_6px_12px)]" />
                        <span className="flex h-9 min-w-14 items-center justify-center rounded-md bg-white px-2 text-[15px] font-extrabold tracking-[2px] text-(--ck-ink) italic">{cvc || "•".repeat(brand === "amex" ? 4 : 3)}</span>
                    </div>
                    <span className="mx-5 mt-auto mb-4 text-[10px] font-bold tracking-[0.8px] text-white/60 uppercase">Security code</span>
                </div>
            </div>
        </div>
    );
};

/**
 * Card number, expiry and security code as one grouped control, then the name. With `preview`, a live card sits above.
 * The form checks the number (Luhn), the expiry and the code length; a live site takes the card in its provider's secure fields.
 */
export const CardForm = ({ ck, preview }: { ck: Ck; preview?: boolean }) => {
    const { s, set } = ck;
    const [flipped, setFlipped] = useState(false);
    const brand = cardBrand(s.card), len = cardLength(brand), cvcLen = brand === "amex" ? 4 : 3;
    const full = s.card.length >= len, numOk = full && luhn(s.card);
    const shown = (f: string) => ck.s.errField === f;
    const numBad = (full && !numOk) || shown("card"), expBad = (s.exp.length === 4 && !expiryOk(s.exp)) || shown("exp");
    const expText = s.exp.length > 2 ? `${s.exp.slice(0, 2)} / ${s.exp.slice(2)}` : s.exp;
    const onExp = (raw: string) => { let d = raw.replace(/\D/g, ""); if (d.length === 1 && Number(d) > 1) d = `0${d}`; set({ exp: d.slice(0, 4), errField: "", err: "" }); };
    const hint = numBad ? "That card number doesn’t look right. Check the digits." : expBad ? (s.exp.length < 4 ? "Add your card’s expiry date." : "That expiry date has passed.") : shown("cvc") ? `The security code is ${cvcLen} digits.` : brand === "amex" ? "The 4-digit code is on the front of your card." : "The 3-digit code is on the back of your card.";
    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            {preview && <div className="flex justify-center py-1"><CardPreview ck={ck} flipped={flipped} /></div>}
            <div className="flex flex-col gap-1.5">
                <span className="ck-label" id="ck-card-label">Card details</span>
                <div className="ck-group" role="group" aria-labelledby="ck-card-label">
                    <div className="relative border-b-[1.5px] border-[#efeaf8]">
                        <Icon d={FIELD_ICON.card} className={inGroupIcon} />
                        <input className="ck-in pr-20! pl-11!" inputMode="numeric" autoComplete="cc-number" aria-label="Card number" placeholder="1234 1234 1234 1234" aria-invalid={numBad || undefined}
                            value={formatCard(s.card)} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); set({ card: d.slice(0, cardLength(cardBrand(d))), errField: "", err: "" }); }} />
                        <span className="pointer-events-none absolute top-1/2 right-3.5 flex -translate-y-1/2 items-center gap-2">
                            {numOk ? <><BrandMark brand={brand} /><Tick /></> : brand ? <BrandMark brand={brand} /> : <span className="flex items-center gap-1.5 opacity-60"><BrandMark brand="visa" /><BrandMark brand="mastercard" /></span>}
                        </span>
                    </div>
                    <div className="grid grid-cols-2">
                        <div className="relative border-r-[1.5px] border-[#efeaf8]">
                            <Icon d={FIELD_ICON.calendar} className={inGroupIcon} />
                            <input className="ck-in pl-11!" inputMode="numeric" autoComplete="cc-exp" aria-label="Expiry date, month and year" placeholder="MM / YY" aria-invalid={expBad || undefined} value={expText}
                                onChange={(e) => onExp(e.target.value)} onKeyDown={(e) => { if (e.key === "Backspace" && s.exp.length === 2) { e.preventDefault(); set({ exp: s.exp.slice(0, 1) }); } }} />
                        </div>
                        <div className="relative">
                            <Icon d={FIELD_ICON.lock} className={inGroupIcon} />
                            <input className="ck-in pl-11!" inputMode="numeric" autoComplete="cc-csc" aria-label="Security code" placeholder={brand === "amex" ? "4 digits" : "CVC"} value={s.cvc} aria-invalid={shown("cvc") || undefined}
                                onFocus={() => setFlipped(true)} onBlur={() => setFlipped(false)} onChange={(e) => set({ cvc: e.target.value.replace(/\D/g, "").slice(0, cvcLen), errField: "", err: "" })} />
                        </div>
                    </div>
                </div>
                <span className={cx("ck-hint", (numBad || expBad || shown("cvc")) && "text-(--ck-err)!")}>{hint}</span>
            </div>
            <Field label="Name on card" icon={FIELD_ICON.user} autoComplete="cc-name" placeholder="As it appears on the card" value={s.holder} invalid={shown("holder")} onChange={(e) => set({ holder: e.target.value, errField: "", err: "" })} />
            <p className="m-0 flex items-start gap-2 text-[12.5px] leading-snug font-semibold text-(--ck-muted)"><Icon d={FIELD_ICON.lock} size={15} className="mt-px flex-none" />Encrypted and sent straight to the payment provider. The charity never sees your card number.</p>
        </div>
    );
};

/** Bacs Direct Debit: account holder, sort code (shown 12-34-56) and account number. */
export const DdFields = ({ ck }: { ck: Ck }) => {
    const { s, set } = ck;
    const shown = (f: string) => s.errField === f;
    const sortText = s.sort.replace(/(\d{2})(?=\d)/g, "$1-");
    return (
        <div className="flex flex-col gap-3">
            <Field label="Account holder name" icon={FIELD_ICON.user} placeholder="As shown on your statement" autoComplete="name" value={s.ddName} invalid={shown("ddName")} onChange={(e) => set({ ddName: e.target.value, errField: "", err: "" })} />
            <div className="grid grid-cols-2 gap-3">
                <Field label="Sort code" icon={FIELD_ICON.bank} inputMode="numeric" autoComplete="off" placeholder="12-34-56" value={sortText} invalid={shown("sort")} onChange={(e) => set({ sort: e.target.value.replace(/\D/g, "").slice(0, 6), errField: "", err: "" })} trailing={sortCodeOk(s.sort) ? <Tick /> : undefined} />
                <Field label="Account number" icon={FIELD_ICON.hash} inputMode="numeric" autoComplete="off" placeholder="8 digits" value={s.acct} invalid={shown("acct")} onChange={(e) => set({ acct: e.target.value.replace(/\D/g, "").slice(0, 8), errField: "", err: "" })} trailing={accountOk(s.acct) ? <Tick /> : undefined} />
            </div>
            <span className="rounded-2xl bg-(--ck-tint) px-4 py-3.5 text-[14px] leading-normal text-(--ck-ink-2)"><strong className="font-extrabold">Direct Debit Guarantee.</strong> We email the amount and date before each collection. Your bank refunds any payment taken in error.</span>
        </div>
    );
};
export const BANKS = ["Barclays", "HSBC", "Lloyds", "Monzo", "NatWest", "Starling"];
export const Banks = ({ ck, note = true }: { ck: Ck; note?: boolean }) => (
    <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {BANKS.map((b) => { const on = ck.s.bank === b; return <button key={b} type="button" aria-pressed={on} onClick={() => ck.set({ bank: b, errField: "", err: "" })} className="ck-soft min-h-14 rounded-2xl border-[1.5px] text-[15px] font-extrabold text-(--ck-ink)" style={{ borderColor: on ? "var(--ck-accent-strong)" : ck.s.errField === "bank" ? "var(--ck-err)" : "var(--ck-line)", background: on ? "var(--ck-accent-soft)" : "#fff" }}>{b}</button>; })}
        </div>
        {note && <span className="text-[14px] text-(--ck-muted)">We open your banking app, you approve the amount, and you come back here for your receipt.</span>}
    </div>
);
/** Express buttons: Apple Pay and Google Pay when wallets are on, PayPal when PayPal is connected. */
export const Wallets = ({ ck, className }: { ck: Ck; className?: string }) => {
    if (!ck.wallets && !ck.paypal) return null;
    return (
        <div className={cx("grid gap-2.5", className)}>
            {ck.wallets && <button type="button" onClick={() => ck.pay("Apple Pay")} disabled={ck.busy} className={dark}>Apple Pay</button>}
            {ck.wallets && <button type="button" onClick={() => ck.pay("Google Pay")} disabled={ck.busy} className={cx(soft, "min-h-14 text-[17px]")}>Google Pay</button>}
            {ck.paypal && <button type="button" onClick={() => ck.pay("PayPal")} disabled={ck.busy} className="min-h-14 rounded-[18px] border-0 bg-[#FFD66B] text-[17px] font-extrabold text-(--ck-ink) disabled:opacity-75">PayPal</button>}
        </div>
    );
};
/** Stripe's Appearance options, close to the checkout's own fields. */
const STRIPE_LOOK = { theme: "stripe", variables: { fontFamily: "Urbanist, system-ui, sans-serif", colorPrimary: "#b45fd6", colorText: "#1a1440", colorDanger: "#b3261e", borderRadius: "14px" } };
/**
 * The fields for the chosen method. Live, they are Stripe's own (the card never touches our inputs, and Stripe checks it);
 * in the demo they are our card, Direct Debit and bank forms.
 */
export const PayFields = ({ ck, preview, bankNote }: { ck: Ck; preview?: boolean; bankNote?: boolean }) => {
    const m = ck.method;
    if (!ck.methods.includes(m)) return null;
    if (ck.live && (m === "card" || m === "dd" || m === "bank")) return <StripeFields ref={ck.fields} total={ck.q.total} currency={ck.c.currency} recurring={ck.recurring} method={m} onBehalfOf={ck.live.stripeAccount} appearance={STRIPE_LOOK} />;
    return m === "card" ? <CardForm ck={ck} preview={preview} /> : m === "dd" ? <DdFields ck={ck} /> : m === "bank" ? <Banks ck={ck} note={bankNote} /> : null;
};
/** Shown when the charity has no way to take payments switched on. */
export const NoPayments = ({ ck }: { ck: Ck }) => ck.canPay ? null : (
    <div role="alert" className="rounded-2xl bg-(--ck-gold-soft) px-4 py-3.5 text-[15px] leading-normal text-(--ck-gold-ink)"><strong className="font-extrabold">{ck.c.charity} isn’t taking online payments yet.</strong> Please check back soon.</div>
);

export const Mandate = ({ ck }: { ck: Ck }) => {
    if (!ck.recurring) return null;
    const on = ck.s.mandate;
    return (
        <button type="button" aria-pressed={on} onClick={() => ck.set({ mandate: !on, err: "" })} className="ck-row flex items-center gap-3.5 rounded-[20px] border-[1.5px] px-4 py-3.5 text-left text-(--ck-ink)" style={{ borderColor: on ? "var(--ck-accent-strong)" : errOn(ck, /authorisation/) ? "var(--ck-err)" : "var(--ck-line)", background: on ? "var(--ck-accent-soft)" : "#fff" }}>
            <span className="flex flex-1 flex-col gap-0.5"><strong className="text-[16px] font-extrabold">I authorise {ck.f(ck.q.recur)} {FREQ_LABEL[ck.s.freq].every}</strong><span className="text-[14px] leading-snug text-(--ck-muted)">First payment today, next on {nextOn(ck)}. Pause or cancel any time.</span></span>
            <Switch on={on} />
        </button>
    );
};
/** The next payment of a regular gift (quote().later.next: same day next month or year, clamped to the month's length). "" for a one-off. */
export const nextOn = (ck: Ck) => (ck.q.later ? longDay(ck.q.later.next, ck.c.locale) : "");

/**
 * What stopped the donor, announced to screen readers. A failed or unconfirmed payment also says what to do next:
 * try again (the same attempt, so never a second charge), check again, or choose another way to pay.
 */
export const Err = ({ ck, className }: { ck: Ck; className?: string }) => {
    const { err, issue, step } = ck.s;
    if (!err || (step === 3 && ck.s.express && addressErr(ck))) return null; // the express Gift Aid card shows that one itself
    if (!issue || step !== 3) return <p role="alert" className={cx("m-0 text-[15px] font-bold text-(--ck-err)", className)}>{err}</p>;
    const other = () => {
        const el = document.querySelector<HTMLElement>("[data-ck-methods]");
        el?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        el?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    };
    return (
        <div role="alert" className={cx("flex flex-col gap-3 rounded-[18px] border-[1.5px] p-4", issue.confirming ? "border-[#ecd98f] bg-(--ck-gold-soft)" : "border-[#f1c9c5] bg-[#fff6f5]", className)}>
            <p className={cx("m-0 text-[15px] leading-snug font-bold", issue.confirming ? "text-(--ck-gold-ink)" : "text-(--ck-err)")}>{err}</p>
            {(issue.retryable || (issue.alt && ck.methods.length > 1)) && (
                <div className="flex flex-wrap gap-2.5">
                    {issue.retryable && <button type="button" onClick={ck.retry} disabled={ck.busy} className={cx(dark, "min-h-12 text-[15px]")}>{issue.confirming ? "Check again" : "Try again"}</button>}
                    {issue.alt && ck.methods.length > 1 && <button type="button" onClick={other} className={cx(soft, "min-h-12 text-[15px]")}>Choose another way to pay</button>}
                </div>
            )}
        </div>
    );
};
export const PayState = ({ ck }: { ck: Ck }) => ck.busy ? <span role="status" className="rounded-[10px] bg-(--ck-green-soft) px-2.5 py-2 text-[13px] font-extrabold text-(--ck-green)">{ck.s.pay === "pending" ? "Payment started…" : "Authorised, waiting for your bank…"}</span> : null;

/** On a regular gift, each line says whether it is charged again. A one-off gift has nothing to tell apart. */
const tagOf = (ck: Ck, l: QuoteLine) => (!ck.recurring ? undefined : l.when === "recurring" ? FREQ_LABEL[ck.s.freq].line : "Today only");
/** What is charged today, line by line. */
export const GiftRows = ({ ck, feeLabel }: { ck: Ck; feeLabel?: string }) => <>{ck.q.today.lines.map((l) => <Row key={l.key} k={l.key === "fee" && feeLabel ? feeLabel : l.label} tag={tagOf(ck, l)} v={ck.f(l.value)} />)}</>;

/** The match, in words: who the sponsor is, until when, and whether it doubles the gift. `live` is false when there is nothing to advertise. */
export const matchInfo = (ck: Ck) => {
    const m = ck.c.match && "status" in ck.c.match ? ck.c.match : null, why = ck.q.matchReason;
    // Confirmed, in date and with money left: a gift is matched, or would be from the minimum up.
    const live = !!m && (why === null || why === "below-min");
    return { live, who: sponsorName(m), doubled: live && (m.ratio ?? 1) === 1, until: live ? matchEnds(m).toLocaleDateString(ck.c.locale ?? "en-GB", { day: "numeric", month: "long" }) : "" };
};
/** Why this gift is matched in part, or not at all. "" when there is nothing to explain (no match on offer, or matched in full). */
export const matchNote = (ck: Ck) => {
    const { q, f } = ck, m = ck.c.match && "status" in ck.c.match ? ck.c.match : null;
    if (!m) return "";
    const who = sponsorName(m) || "The sponsor";
    if (q.matchCapped) return m.perGiftMax != null && q.match === m.perGiftMax ? `${who} matches up to ${f(m.perGiftMax)} of each gift.` : `Only ${f(q.match)} is left in the match fund, so that much of this gift is matched.`;
    return q.matchReason === "expired" ? "The match offer has ended, so this gift isn’t matched."
        : q.matchReason === "cap-reached" ? "The match fund has been used up, so this gift isn’t matched."
        : q.matchReason === "below-min" ? `Gifts of ${f(m.minGift ?? 0)} or more are matched.` : "";
};
/** Gift Aid and the sponsor's match, in green, with a note when the match is cut or missing. */
export const Boosts = ({ ck, giftAid = true }: { ck: Ck; giftAid?: boolean }) => {
    const note = matchNote(ck);
    return (
        <>
            {giftAid && ck.q.giftAid > 0 && <Row k="Gift Aid from HMRC" v={`+${ck.f(ck.q.giftAid)}`} boost />}
            {ck.q.match > 0 && <Row k={`Matched by ${sponsorName(ck.c.match) || "a sponsor"}`} v={`+${ck.f(ck.q.match)}`} boost />}
            {note && <span className="text-[13px] leading-snug text-(--ck-muted)">{note}</span>}
        </>
    );
};
/** Gift lines, then the boosts (Gift Aid, match) in green. */
export const Lines = ({ ck, paidWith }: { ck: Ck; paidWith?: boolean }) => (
    <>
        <GiftRows ck={ck} />
        {paidWith && <Row k={ck.pending ? "Paying with" : "Paid with"} v={ck.s.paidWith || METHOD_NAME[ck.method]} />}
        <Boosts ck={ck} />
    </>
);
/** A regular gift's later payments: how much, how often and when the next one is (quote().later). Nothing for a one-off. */
export const Later = ({ ck, className, manage }: { ck: Ck; className?: string; manage?: boolean }) => {
    const l = ck.q.later;
    if (!l) return null;
    return (
        <div className={cx("flex flex-col gap-0.5 rounded-[14px] bg-(--ck-tint) px-3.5 py-3 text-[13.5px] leading-snug text-(--ck-ink-2)", className)}>
            <strong className="text-[14.5px] font-extrabold text-(--ck-ink)">Then {ck.f(l.total)} {FREQ_LABEL[ck.s.freq].every}</strong>
            <span>Next payment on {nextOn(ck)}.{l.giftAid > 0 ? ` HMRC adds ${ck.f(l.giftAid)} Gift Aid each time.` : ""}{manage ? " We email you before each payment. Change, pause or cancel any time in your donor account." : ""}</span>
        </div>
    );
};
export const Row = ({ k, v, boost, pending, tag }: { k: string; v: string; boost?: boolean; pending?: boolean; tag?: string }) => (
    <div className="flex items-baseline justify-between gap-4 text-[15px]">
        <span className={cx("flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5", boost ? "font-bold text-(--ck-green)" : pending ? "font-semibold text-[#A7A2B8]" : "font-semibold text-(--ck-muted)")}>{k}{tag && <span className="rounded-md bg-(--ck-tint) px-1.5 py-0.5 text-[11px] leading-none font-extrabold tracking-[0.3px] whitespace-nowrap text-(--ck-link)">{tag}</span>}</span>
        <strong className={cx("font-extrabold whitespace-nowrap", boost ? "text-(--ck-green)" : pending ? "text-[#C9C3DA]" : "")}>{v}</strong>
    </div>
);

export const methodLabel = (m: Method) => METHOD_NAME[m];
/** "Give £25 by card" style label for the pay button. */
export const payLabel = (ck: Ck, suffix = true) => ck.busy ? "Waiting for your bank…" : `Give ${ck.f(ck.q.total)}${!suffix ? "" : ck.method === "dd" ? " by Direct Debit" : ck.method === "bank" ? " by bank" : ck.method === "card" ? " by card" : ""}`;

/**
 * Words for the end screen. Paid is only ever said for a payment the server confirmed; a Direct Debit or bank payment that is
 * still on its way gets its own wording, with no receipt promised until it goes through.
 */
export const endCopy = (ck: Ck) => {
    const { s, c, f, q } = ck, name = s.first.trim() ? `, ${s.first.trim()}` : "", who = c.beneficiary.replace(/^./, (m) => m.toUpperCase());
    if (!ck.pending) return { chip: "Confirmed", title: `Thank you${name}.`, body: "", total: "You paid", stamp: "Paid" };
    const dd = ck.method === "dd";
    return {
        chip: dd ? "Direct Debit being set up" : "Waiting for your bank",
        title: `Your gift is on its way${name}.`,
        body: `${dd ? "Your bank is setting up your Direct Debit" : "Your bank is confirming the payment"}. ${who} gets ${f(q.receives)} once it goes through, which can take a few working days. We’ll email your receipt then. You don’t need to do anything else, and please don’t pay again.`,
        total: dd ? "To be collected" : "To be confirmed", stamp: "Pending",
    };
};

/**
 * The one ask after paying, chosen by next-action.ts. Every ask has a plain "No thanks", which closes it for this gift and is
 * remembered for the session. The layout supplies the frame around it.
 */
export const NextStep = ({ ck, onShare, onStart }: { ck: Ck; onShare?: () => void; onStart?: () => void }) => {
    const a = ck.nextUp;
    if (!a) return null;
    const { c, f } = ck;
    if (a.kind === "addon") return <AddOn ck={ck} name={a.name} amount={a.amount} />;
    const [title, text, label, act]: [string, string, string, (() => void) | undefined] =
        a.kind === "monthly" ? [`Make it ${f(a.amount)} every month?`, `A regular gift lets ${c.beneficiary} plan ahead. It is a new gift with its own authorisation.`, "Set up a monthly gift", ck.upsell]
        : a.kind === "campaign" ? ["Another campaign you could support", a.title, "See this campaign", undefined]
        : a.kind === "share" ? ["Tell someone about this campaign", "Sharing never shows your amount or personal details.", "Share the campaign", onShare]
        : ["Start your own fundraiser", `Raise more for ${c.beneficiary} with a page of your own.`, "Start your own fundraiser", onStart];
    const yes = cx(cta, "inline-flex min-h-[54px] flex-[1_1_190px] items-center justify-center text-center text-[16px] no-underline");
    return (
        <div data-ck-next={a.kind} className="flex flex-1 flex-col gap-3.5">
            <NextHead title={title} text={text} />
            <div className="mt-auto flex flex-wrap gap-2.5">
                {a.kind === "campaign"
                    ? <a href={ck.recommended?.url} onClick={() => ck.acceptNext(a.kind)} className={yes}>{label}</a>
                    : <button type="button" onClick={() => { ck.acceptNext(a.kind); act?.(); }} className={yes}>{label}</button>}
                <button type="button" onClick={() => ck.declineNext(a.kind)} className={cx(soft, "min-h-[54px] text-[15px]")}>No thanks</button>
            </div>
        </div>
    );
};
/** A caption for the frame around each ask. */
export const NEXT_FOOT = { monthly: "A new gift with its own authorisation", addon: "A separate payment, only if you confirm", campaign: "Checked and verified", share: "Your amount stays private", fundraiser: "Your own page for this cause" };
const NextHead = ({ title, text }: { title: string; text: string }) => (
    <div className="flex flex-col gap-1.5"><strong className="text-[20px] leading-tight font-extrabold tracking-[-0.3px]">{title}</strong><span className="text-[15px] leading-normal text-(--ck-muted)">{text}</span></div>
);
/**
 * A small gift to a related cause, after the main one. It is a separate payment: "Add" only opens the confirmation, and nothing
 * is taken until the donor presses the confirm button, which starts its own payment attempt.
 */
const AddOn = ({ ck, name, amount }: { ck: Ck; name: string; amount: number }) => {
    const { s, f } = ck, sum = f(amount), paying = s.addon === "paying";
    const how = ck.live ? "by card" : `with ${s.paidWith || METHOD_NAME[ck.method]}`;
    if (s.addon === "paid" || s.addon === "pending") return (
        <div data-ck-next="addon" role="status" className="flex flex-1 flex-col gap-3.5">
            <NextHead title={s.addon === "paid" ? `Thank you. ${sum} more for ${name}.` : `Your ${sum} gift to ${name} is on its way.`} text={s.addon === "paid" ? "That was a separate payment, with its own receipt." : "Your bank is confirming it. We’ll email your receipt when it goes through."} />
        </div>
    );
    const open = s.addon !== "idle";
    return (
        <div data-ck-next="addon" className="flex flex-1 flex-col gap-3.5">
            {open
                ? <NextHead title={`Confirm a separate gift of ${sum}`} text={`This is a new payment of ${sum} to ${name}, ${how}. It is not part of the gift you just made.`} />
                : <NextHead title={`Add ${sum} for ${name}?`} text="A separate one-off gift. Nothing more is taken unless you confirm it." />}
            {open && ck.live && <StripeFields ref={ck.fields} total={amount} currency={ck.c.currency} method="card" onBehalfOf={ck.live.stripeAccount} appearance={STRIPE_LOOK} />}
            <div aria-live="polite">{paying ? <span role="status" className="text-[14px] font-bold text-(--ck-green)">Taking your {sum} gift…</span> : s.addonMsg && <p role="alert" className="m-0 text-[14.5px] leading-snug font-bold text-(--ck-err)">{s.addonMsg}</p>}</div>
            <div className="mt-auto flex flex-wrap gap-2.5">
                {open
                    ? <button type="button" onClick={ck.payAddOn} disabled={paying} className={cx(cta, "min-h-[54px] flex-[1_1_190px] text-[16px]")}>{paying ? "Waiting for your bank…" : `Confirm and pay ${sum}`}</button>
                    : <button type="button" onClick={() => ck.acceptNext("addon")} className={cx(cta, "min-h-[54px] flex-[1_1_190px] text-[16px]")}>Add {sum}</button>}
                <button type="button" onClick={() => ck.declineNext("addon")} disabled={paying} className={cx(soft, "min-h-[54px] text-[15px] disabled:opacity-60")}>{open ? "Cancel" : "No thanks"}</button>
            </div>
        </div>
    );
};

/** After paying: share, the receipt, start your own, give again. The one already featured as the next step is left out. */
export const AfterButtons = ({ ck, onShare, onStart, receipt, className }: { ck: Ck; onShare?: () => void; onStart?: () => void; receipt?: boolean; className?: string }) => {
    const k = ck.nextUp?.kind;
    return (
        <div className={cx("grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3", className)}>
            {k !== "share" && <button type="button" onClick={onShare} className={cx(dark, "min-h-[58px]")}>Share the campaign</button>}
            {receipt && !ck.pending && <button type="button" onClick={() => window.print()} className={cx(soft, "min-h-[58px]")}>Download receipt</button>}
            {onStart && k !== "fundraiser" && <button type="button" onClick={onStart} className={cx(soft, "min-h-[58px]")}>Start your own fundraiser</button>}
            <button type="button" onClick={ck.restart} className={cx(soft, "min-h-[58px]")}>Give again</button>
        </div>
    );
};

/** Full-screen "your gift is on its way" while the payment is in flight: three objects fly through on speed lines. */
export const PayAnimation = ({ ck }: { ck: Ck }) => {
    if (!ck.busy) return null;
    // Back from a redirect with nothing known but the payment's id, there is no amount to name.
    const pending = ck.s.pay === "pending" && !ck.s.bare;
    const lines: [string, string, string, string, string][] = [["18%", "34vw", "rgba(217,160,240,0),#D9A0F0", "0.55s", "0s"], ["31%", "22vw", "rgba(248,229,166,0),#F0CF63", "0.4s", "0.15s"], ["58%", "40vw", "rgba(201,235,216,0),#9AD3B6", "0.65s", "0.05s"], ["69%", "26vw", "rgba(251,214,206,0),#F5A999", "0.45s", "0.3s"]];
    return (
        <div role="status" aria-live="polite" className="fixed inset-0 z-50 box-border flex flex-col items-center justify-end overflow-hidden bg-white/96 px-6 pb-[9vh] [background-image:radial-gradient(circle_at_50%_40%,#F7ECFD_0,rgba(247,236,253,0)_60%)]">
            {lines.map(([top, w, g, dur, delay]) => <span key={top} aria-hidden="true" className="ck-line" style={{ top, width: w, background: `linear-gradient(90deg,${g})`, animationDuration: dur, animationDelay: delay }} />)}
            {FLYERS.map(([trail, art], i) => <div key={i} aria-hidden="true" className={cx("ck-fly", i === 1 && "ck-fly2", i === 2 && "ck-fly3")}><span className="ck-trail" style={{ background: `linear-gradient(90deg,${trail})` }} />{art}</div>)}
            <div className="relative flex flex-col items-center gap-3.5 text-center">
                <strong className="text-[30px] leading-[1.05] font-bold tracking-[-1.3px] sm:text-[40px]">{pending ? `Sending ${ck.f(ck.q.total)} to ${ck.c.beneficiary}` : "Your bank is confirming"}</strong>
                <span className="text-[16px] text-(--ck-muted) sm:text-[18px]">{pending ? "Hold tight, this takes a few seconds." : "Almost there. Please keep this page open."}</span>
                <div aria-hidden="true" className="mt-1 flex gap-2">{[0, 0.15, 0.3].map((d) => <span key={d} className="ck-dot size-2.5 rounded-full bg-(--ck-accent-strong)" style={{ animationDelay: `${d}s` }} />)}</div>
            </div>
        </div>
    );
};
const svg = (children: ReactNode) => <svg viewBox="0 0 200 200" className="relative block size-full">{children}</svg>;
/** The coin, lantern and gift box that fly across the payment animation. Shared with the Ramadan give flow. */
export const FLYERS: [string, ReactNode][] = [
    ["rgba(246,203,76,0),rgba(246,203,76,0.55)", svg(<><defs><radialGradient id="ckCoinA" cx="0.34" cy="0.28" r="0.85"><stop offset="0" stopColor="#FFF6C4" /><stop offset="0.5" stopColor="#F6CB4C" /><stop offset="1" stopColor="#D4901A" /></radialGradient><linearGradient id="ckCoinB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E9B84A" /><stop offset="1" stopColor="#9C6410" /></linearGradient></defs><ellipse cx="104" cy="186" rx="62" ry="8" fill="#1A1440" opacity="0.12" /><circle cx="110" cy="104" r="80" fill="url(#ckCoinB)" /><circle cx="96" cy="98" r="80" fill="url(#ckCoinA)" /><circle cx="96" cy="98" r="62" fill="none" stroke="#C28A1C" strokeWidth="4" opacity="0.55" /><circle cx="96" cy="98" r="72" fill="none" stroke="#FFF6C4" strokeWidth="2" opacity="0.7" /><path d="M122 132H74v-6c8-4 12-10 12-20h-12v-10h10c-1-4-2-8-2-12 0-14 10-23 24-23 8 0 14 3 18 7l-9 9c-2-3-5-4-9-4-6 0-10 4-10 10 0 4 1 8 2 13h16v10H99c0 8-3 14-7 18h30z" fill="#A9741A" /><path d="M120 130H72v-6c8-4 12-10 12-20H72V94h10c-1-4-2-8-2-12 0-14 10-23 24-23 8 0 14 3 18 7l-9 9c-2-3-5-4-9-4-6 0-10 4-10 10 0 4 1 8 2 13h16v10H97c0 8-3 14-7 18h30z" fill="#FFF3B8" opacity="0.85" /><ellipse cx="62" cy="58" rx="24" ry="9" fill="#fff" opacity="0.6" transform="rotate(-38 62 58)" /></>)],
    ["rgba(255,210,92,0),rgba(255,170,60,0.5)", svg(<><defs><radialGradient id="ckLampGlow" cx="0.5" cy="0.56" r="0.5"><stop offset="0" stopColor="#FFE48A" stopOpacity="0.85" /><stop offset="1" stopColor="#FFE48A" stopOpacity="0" /></radialGradient><radialGradient id="ckLampGlass" cx="0.5" cy="0.55" r="0.75"><stop offset="0" stopColor="#FFFBE6" /><stop offset="0.45" stopColor="#FFD25C" /><stop offset="1" stopColor="#EE7F26" /></radialGradient><linearGradient id="ckLampMetal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#4A3A94" /><stop offset="0.5" stopColor="#2B1F5E" /><stop offset="1" stopColor="#151033" /></linearGradient></defs><circle cx="100" cy="112" r="98" fill="url(#ckLampGlow)" /><ellipse cx="100" cy="188" rx="52" ry="7" fill="#1A1440" opacity="0.14" /><path d="M72 46 Q100 2 128 46" fill="none" stroke="url(#ckLampMetal)" strokeWidth="7" strokeLinecap="round" /><path d="M58 60 L100 36 L142 60z" fill="url(#ckLampMetal)" /><rect x="54" y="56" width="92" height="13" rx="5" fill="#1A1440" /><rect x="64" y="68" width="72" height="92" rx="8" fill="url(#ckLampGlass)" /><rect x="112" y="68" width="24" height="92" fill="#C9541A" opacity="0.22" /><path d="M100 94 C114 112 112 134 100 140 C88 134 86 112 100 94z" fill="#FFFDF0" /><path d="M100 110 C106 120 105 132 100 136 C95 132 94 120 100 110z" fill="#FFC94A" /><rect x="62" y="68" width="9" height="92" fill="url(#ckLampMetal)" /><rect x="129" y="68" width="9" height="92" fill="#151033" /><rect x="96" y="68" width="7" height="92" fill="#2B1F5E" opacity="0.8" /><rect x="52" y="158" width="96" height="15" rx="6" fill="#1A1440" /><rect x="64" y="171" width="72" height="11" rx="5" fill="url(#ckLampMetal)" /><rect x="72" y="76" width="8" height="40" rx="4" fill="#fff" opacity="0.5" /></>)],
    ["rgba(217,160,240,0),rgba(180,95,214,0.5)", svg(<><defs><linearGradient id="ckBoxA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#EDC2FA" /><stop offset="1" stopColor="#A94FD0" /></linearGradient><linearGradient id="ckBoxB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F8E0FE" /><stop offset="1" stopColor="#C77BE6" /></linearGradient><linearGradient id="ckBoxC" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFF3B8" /><stop offset="1" stopColor="#E0A52E" /></linearGradient></defs><ellipse cx="100" cy="186" rx="68" ry="8" fill="#1A1440" opacity="0.13" /><rect x="38" y="94" width="124" height="86" rx="12" fill="url(#ckBoxA)" /><path d="M122 94h28a12 12 0 0112 12v62a12 12 0 01-12 12h-28z" fill="#6E2A96" opacity="0.28" /><rect x="38" y="100" width="124" height="10" fill="#6E2A96" opacity="0.25" /><rect x="86" y="94" width="28" height="86" fill="url(#ckBoxC)" /><rect x="30" y="70" width="140" height="32" rx="10" fill="url(#ckBoxB)" /><rect x="86" y="70" width="28" height="32" fill="url(#ckBoxC)" /><path d="M100 72 C82 34 40 36 48 60 C54 76 84 74 100 72z" fill="url(#ckBoxC)" /><path d="M100 72 C118 34 160 36 152 60 C146 76 116 74 100 72z" fill="#E9B84A" /><path d="M92 66 C82 48 62 46 62 56 C62 64 80 66 92 66z" fill="#FFF8E0" opacity="0.75" /><circle cx="100" cy="70" r="11" fill="#D4901A" /><circle cx="97" cy="67" r="5" fill="#FFF3B8" opacity="0.8" /><rect x="40" y="76" width="34" height="7" rx="3.5" fill="#fff" opacity="0.65" /></>)],
];
