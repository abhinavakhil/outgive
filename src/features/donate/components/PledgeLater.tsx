import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Check, Copy01, X } from "@untitledui/icons";
import { useApp } from "@/shared/lib/app-context";
import { cx } from "@/shared/utils/cx";
import { type PayBy, pledgePublic } from "@/features/engage";
import { demoSource } from "@/features/pledge-pay";

/**
 * "Pledge now, pay later" on the live night's phone screen: name, a mobile or an email, an amount and when they will pay. The
 * donor gets their one-tap pay link straight away; the recovery sequence sends it again and reminds them before the date.
 * Live: pledge_create_public (anon, rate limited, only during a live night). Demo: the pledge-pay fixture in this browser.
 */
const PAY_BY: [PayBy, string, number][] = [["1w", "In 1 week", 7], ["1m", "In 1 month", 30], ["3m", "In 3 months", 90]];
const longDate = (days: number) => new Date(Date.now() + days * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric" });
const field = "h-12 w-full rounded-xl bg-field px-3.5 text-base text-ink outline-focus-ring placeholder:text-ink-faint focus-visible:outline-2";
const black = "inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-ink-inverse outline-focus-ring focus-visible:outline-2 disabled:cursor-progress disabled:opacity-60";
const white = "inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-raised px-5 font-semibold text-ink shadow-edge outline-focus-ring focus-visible:outline-2";

export const PledgeLater = ({ open, onClose, orgSlug, gifts, money }: { open: boolean; onClose: () => void; orgSlug: string; gifts: number[]; money: (usd: number) => string }) => {
    const { db, isDemo, toast } = useApp();
    const ref = useRef<HTMLDialogElement>(null), title = useId(), errId = useId();
    const [usd, setUsd] = useState<number>(gifts[1] ?? 250), [other, setOther] = useState("");
    const [payBy, setPayBy] = useState<PayBy>("1m");
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState<{ token: string; first: string; usd: number; when: string; contact: string } | null>(null);
    useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
    useEffect(() => { if (!open) { setDone(null); setError(""); } }, [open]);
    const amount = other.trim() ? Number(other.replace(/[$,\s]/g, "")) : usd;
    const link = done ? `${window.location.origin}/pledge/${done.token}` : "";

    const submit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget), s = (k: string) => String(f.get(k) ?? "").trim();
        const name = s("name"), phone = s("phone"), email = s("email");
        if (!phone && !email) { setError("Add a mobile number or an email so we can send your pay link."); return; }
        if (!(amount >= 1)) { setError("Enter the amount you are pledging."); return; }
        const cents = Math.round(amount * 100), days = PAY_BY.find(([k]) => k === payBy)![2];
        setBusy(true); setError("");
        try {
            const token = isDemo
                ? (await demoSource().save("demo", { donor_name: name, donor_phone: phone || null, donor_email: email || null, amount_cents: cents, currency: "USD", event: "Live night", due_date: new Date(Date.now() + days * 86400000).toISOString().slice(0, 10), note: "Pledged from the live screen" })).pay_token
                : await pledgePublic(db, orgSlug, { donor_name: name, donor_phone: phone || undefined, donor_email: email || undefined, amount_cents: cents, pay_by: payBy });
            setDone({ token, first: name.split(" ")[0], usd: amount, when: longDate(days), contact: phone ? "phone" : "email" });
        } catch (x) { setError((x as Error).message || "That did not go through. Try again."); } finally { setBusy(false); }
    };
    const copy = () => { void navigator.clipboard?.writeText(link).then(() => toast("Pay link copied"), () => toast("Could not copy the link")); };

    return (
        <dialog ref={ref} aria-labelledby={title} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}
            className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-24px)] w-[min(32rem,calc(100vw-24px))] overflow-y-auto rounded-3xl bg-primary p-0 text-ink shadow-lift backdrop:bg-black/30 backdrop:backdrop-blur-sm">
            {open && <div className="flex flex-col gap-5 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                    <h2 id={title} className="flex-1 text-xl font-semibold tracking-tight text-ink">{done ? `JazakAllah khair, ${done.first}` : "Pledge now, pay later"}</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-1 inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-ink-3 outline-focus-ring hover:bg-tint-2 focus-visible:outline-2"><X className="size-5" /></button>
                </div>
                {done ? (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3 rounded-2xl bg-tint-1 p-4">
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#D2DBA0] text-[#191919]"><Check className="size-5" /></span>
                            <p className="text-sm text-ink-2">Your pledge of <b className="font-bubble font-bold text-ink tabular-nums">{money(done.usd)}</b> is saved. Pay any time before <b className="font-semibold text-ink">{done.when}</b>, all at once or in parts.</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-ink">Your pay link</span>
                            <code className="block truncate rounded-xl bg-field px-3.5 py-3 font-mono text-sm text-ink-2">{link}</code>
                            <p className="text-sm text-ink-3">We will also send it to your {done.contact}, and remind you before the date. Pay in one tap whenever you are ready.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={copy} className={white}><Copy01 className="size-4" />Copy link</button>
                            <a href={`/pledge/${done.token}`} className={black}>Pay now</a>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submit} onInput={() => error && setError("")} className="flex flex-col gap-4" aria-describedby={error ? errId : undefined}>
                        <p className="-mt-2 text-sm text-ink-3">Promise a gift tonight and pay by a date that suits you. We send a one-tap pay link, and a reminder before it is due.</p>
                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-2 text-sm font-semibold text-ink">How much?</legend>
                            <div className="grid grid-cols-4 gap-2">{gifts.slice(0, 4).map((g) => (
                                <button key={g} type="button" aria-pressed={!other.trim() && usd === g} onClick={() => { setUsd(g); setOther(""); }}
                                    className={cx("h-12 cursor-pointer rounded-xl font-bubble font-bold tabular-nums outline-focus-ring focus-visible:outline-2", !other.trim() && usd === g ? "bg-ink text-ink-inverse" : "bg-raised text-ink shadow-edge")}>{money(g)}</button>
                            ))}</div>
                            <label className="sr-only" htmlFor={`${title}-other`}>Other amount</label>
                            <input id={`${title}-other`} inputMode="decimal" placeholder="Other amount" value={other} onChange={(e) => setOther(e.target.value)} className={field} />
                        </fieldset>
                        <fieldset>
                            <legend className="mb-2 text-sm font-semibold text-ink">Pay by</legend>
                            <div className="grid grid-cols-3 gap-2">{PAY_BY.map(([k, l, d]) => (
                                <label key={k} className={cx("flex cursor-pointer flex-col items-center justify-center rounded-xl px-2 py-2.5 text-center outline-focus-ring has-[:focus-visible]:outline-2", payBy === k ? "bg-[#D2DBA0] text-[#191919]" : "bg-raised text-ink shadow-edge")}>
                                    <input type="radio" name="pay_by" value={k} checked={payBy === k} onChange={() => setPayBy(k)} className="sr-only" />
                                    <span className="text-sm font-semibold">{l}</span><span className={cx("text-xs", payBy === k ? "text-[#3d4320]" : "text-ink-3")}>{longDate(d)}</span>
                                </label>
                            ))}</div>
                        </fieldset>
                        <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-ink">Your name</span><input name="name" required maxLength={120} autoComplete="name" className={field} /></label>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-ink">Mobile</span><input name="phone" type="tel" autoComplete="tel" placeholder="(212) 555-0100" className={field} /></label>
                            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-ink">or email</span><input name="email" type="email" autoComplete="email" className={field} /></label>
                        </div>
                        {error && <p id={errId} role="alert" className="rounded-xl bg-tint-2 px-3.5 py-2.5 text-sm text-ink">{error}</p>}
                        <button disabled={busy} className={black}>{busy ? "Saving…" : `Pledge ${amount >= 1 ? money(amount) : ""}`}</button>
                    </form>
                )}
            </div>}
        </dialog>
    );
};
