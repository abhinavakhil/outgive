/**
 * The one-tap pledge pay link, /pledge/<token> (?split=3 opens on a third of what is left). Public: the token is the key.
 * Reads the pledge with pledge_by_token (first name only), then pays through the same `pay` edge function and Stripe fields as the
 * Ramadan give flow (payFunction + StripeFields + settle from the checkout library), with `pledge_token` so the server caps the gift at
 * what is left and books it against the pledge. In demo mode the pledge comes from the fixture (source.ts) and the payment is simulated.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Bank, CheckCircle, CreditCard, DeviceMobile, LockSimple } from "@phosphor-icons/react";
import { type PayResult, StripeFields, type StripeFieldsHandle, payFunction, returnedPayment, settle } from "@/features/checkout";
import type { PayLinkPledge } from "@/features/engage";
import type { Org } from "@/shared/domain/types";
import { track } from "@/shared/lib/analytics";
import { useApp } from "@/shared/lib/app-context";
import { fmt } from "@/shared/lib/money";
import { cx } from "@/shared/utils/cx";
import { Frame } from "./Frame";
import { demoSource, liveSource } from "./source";

type Method = "wallet" | "card" | "bank";
type Done = { paid: number; left: number; delayed: boolean; ref: string };
const METHODS: [Method, string, string][] = [["wallet", "Apple Pay or Google Pay", "One tap on your phone"], ["card", "Card", "Visa, Mastercard, Amex, Discover"], ["bank", "Bank debit (ACH)", "From your checking account, lowest fees for large pledges"]];
const dateOf = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** What the pay button takes: the whole balance, or a third of it rounded up to whole dollars (so three cover it), offered from $3 left and when it is less than the whole. */
export const amountsFor = (left: number) => { const third = Math.ceil(left / 300) * 100; return { all: left, third: left >= 300 && third < left ? third : 0 }; };

const Note = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Frame><section className="pp-card pp-note"><h1 className="pp-h">{title}</h1><div className="pp-sub">{children}</div><a className="pp-btn white" href="/">Go to Outgive</a></section></Frame>
);

export const PledgePay = ({ token }: { token: string }) => {
    const { db, isDemo } = useApp();
    const src = useMemo(() => (isDemo ? demoSource() : liveSource(db)), [db, isDemo]);
    const [p, setP] = useState<PayLinkPledge | null | undefined>(undefined);
    const [split, setSplit] = useState(() => new URLSearchParams(location.search).get("split") === "3");
    const [method, setMethod] = useState<Method>("wallet");
    const [card, setCard] = useState({ num: "", exp: "", cvc: "" });
    const [phase, setPhase] = useState<"idle" | "paying">("idle");
    const [error, setError] = useState("");
    const [done, setDone] = useState<Done | null>(null);
    /** The charity's Stripe account: the pay function charges on its behalf, so Stripe's fields must say the same. */
    const [acct, setAcct] = useState<string | null>(null);
    const fields = useRef<StripeFieldsHandle>(null);
    const attempt = useRef<{ sig: string; key: string } | null>(null);

    useEffect(() => {
        let off = false;
        src.byToken(token).then((r) => {
            if (off) return;
            setP(r ?? null);
            if (r && !isDemo) db.rpc<Org[]>("org_by_slug", { s: r.org_slug }).then((o) => !off && setAcct(o[0]?.stripe_account_id ?? null), () => {});
        }, () => !off && setP(null));
        // Back from a bank's page or a redirect: ask the server how it ended.
        const id = isDemo ? null : returnedPayment();
        if (id) void settle(payFunction(db.fn, () => null), id).then((r) => {
            if (r.status === "succeeded" || r.status === "processing") src.byToken(token).then((x) => !off && x && (setP(x), setDone({ paid: 0, left: x.remaining_cents, delayed: r.status === "processing", ref: id.slice(0, 8).toUpperCase() })));
            else setError(r.error?.message ?? "That payment wasn’t completed, so nothing was taken.");
        });
        return () => { off = true; };
    }, [token, src]); // eslint-disable-line react-hooks/exhaustive-deps

    if (p === undefined) return <Frame><div className="pp-card pp-skel" aria-busy="true" aria-label="Loading your pledge" /></Frame>;
    if (p === null) return <Note title="This pay link isn’t working">The link may be mistyped or old. Ask the masjid or charity that sent it for a new one. Nothing has been charged.</Note>;
    if (!done && p.status === "written_off") return <Note title={`Assalamu alaikum, ${p.first_name}`}>Nothing more is due on your pledge to {p.org_name}. May Allah accept what you gave and reward your intention.</Note>;

    const cur = p.currency, money = (c: number) => fmt(c, cur);
    const { all, third } = amountsFor(p.remaining_cents);
    const amount = split && third ? third : all;
    const pct = p.amount_cents ? Math.min(100, (100 * p.paid_cents) / p.amount_cents) : 0;
    const cardOk = method !== "card" || !isDemo || (card.num.replace(/\D/g, "").length >= 15 && /^\d\d\s?\/\s?\d\d$/.test(card.exp) && /^\d{3,4}$/.test(card.cvc));

    const pay = async () => {
        if (phase !== "idle") return;
        if (!cardOk) return setError("Check the card number, expiry (MM/YY) and security code.");
        setError("");
        const fail = (r: Pick<PayResult, "error" | "message" | "status">) => { setPhase("idle"); setError(r.error?.message ?? r.message ?? "The payment didn’t go through. Try again. You won’t be charged twice."); track("pp_pay_fail", { reason: r.error?.code ?? r.status, method }); };
        track("pp_pay_start", { method, amount: amount / 100, split: split ? 1 : 0 });
        if (isDemo) {
            setPhase("paying");
            await wait(1600);
            // ponytail: simulated payment, Stripe's decline test card fails. Live payments take the branch below.
            if (method === "card" && card.num.replace(/\D/g, "") === "4000000000000002") return fail({ status: "failed", message: "Your card was declined, so nothing was taken. Try a different card or Apple Pay." });
            try { await (src as ReturnType<typeof demoSource>).payOnline(token, amount); } catch (e) { return fail({ status: "failed", message: (e as Error).message }); }
        } else {
            const bad = await fields.current?.submit(); if (bad) return setError(bad.message);
            const sig = `${method}|${amount}`;
            if (attempt.current?.sig !== sig) attempt.current = { sig, key: crypto.randomUUID().replace(/-/g, "") };
            setPhase("paying");
            const f = payFunction(db.fn, () => fields.current);
            let r = await f.start({ attempt_key: attempt.current.key, pledge_token: token, amount_cents: amount, method, currency: cur, freq: "once" });
            if (r.status === "requires_action") r = await f.confirm(r);
            if (r.status === "processing" && !r.delayed) r = await settle(f, r.id);
            if (r.status !== "succeeded" && r.status !== "processing") return fail(r);
            attempt.current = null;
            setDone({ paid: amount, left: p.remaining_cents - amount, delayed: r.status === "processing", ref: r.id.slice(0, 8).toUpperCase() });
            track("pp_paid", { method, amount: amount / 100, split: split ? 1 : 0, live: 1 });
            return setPhase("idle");
        }
        setDone({ paid: amount, left: p.remaining_cents - amount, delayed: false, ref: `PL-${Math.random().toString(36).slice(2, 8).toUpperCase()}` });
        track("pp_paid", { method, amount: amount / 100, split: split ? 1 : 0 });
        setPhase("idle");
    };

    if (done) return (
        <Frame>
            <section className="pp-card pp-thanks" aria-live="polite">
                <span className="pp-tick"><CheckCircle size={34} weight="fill" aria-hidden="true" /></span>
                <h1 className="pp-h">JazakAllahu khayran, {p.first_name}</h1>
                <p className="pp-sub">{done.delayed ? `Your ${money(done.paid)} payment is on its way. We’ll email your receipt when it clears.` : done.paid ? `You paid ${money(done.paid)} toward your pledge to ${p.org_name}.` : `Your payment to ${p.org_name} went through.`}</p>
                <dl className="pp-stats">
                    <div><dt>Pledged</dt><dd>{money(p.amount_cents)}</dd></div>
                    <div><dt>Paid</dt><dd>{money(p.amount_cents - Math.max(0, done.left))}</dd></div>
                    <div><dt>Left</dt><dd>{money(Math.max(0, done.left))}</dd></div>
                </dl>
                <p className="pp-fine">{done.left > 0 ? "Use this same link whenever you are ready for the next payment. Your receipt is on its way by email." : "Your pledge is paid in full. Your receipt is on its way by email."} Reference {done.ref}.</p>
                {done.left > 0 && <button type="button" className="pp-btn white" onClick={() => { setP({ ...p, paid_cents: p.amount_cents - done.left, remaining_cents: done.left, status: "part_paid" }); setDone(null); setSplit(false); }}>Make another payment</button>}
            </section>
        </Frame>
    );

    const paidUp = p.remaining_cents <= 0;
    return (
        <Frame wide>
            <div className="pp-grid">
                <section className="pp-card pp-summary">
                    <span className="pp-kicker">{p.org_name}{p.event && <> · {p.event}</>}</span>
                    <h1 className="pp-h">Assalamu alaikum, {p.first_name}</h1>
                    <p className="pp-sub">{paidUp ? `Your pledge to ${p.org_name} is paid in full. JazakAllahu khayran, may Allah accept it from you.` : `Thank you for your pledge to ${p.org_name}. You can pay what is left here, all at once or a third at a time.`}</p>
                    <dl className="pp-stats">
                        <div><dt>Pledged</dt><dd>{money(p.amount_cents)}</dd></div>
                        <div><dt>Paid</dt><dd>{money(p.paid_cents)}</dd></div>
                        <div className="hi"><dt>Left to pay</dt><dd>{money(p.remaining_cents)}</dd></div>
                    </dl>
                    <div className="pp-bar" role="progressbar" aria-label="Paid so far" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
                    {p.due_date && !paidUp && <p className={cx("pp-due", p.status === "overdue" && "late")}>{p.status === "overdue" ? `Was due ${dateOf(p.due_date)}. Pay whenever you can.` : `Due by ${dateOf(p.due_date)}`}</p>}
                </section>
                {!paidUp && (
                    <section className="pp-card pp-payform" aria-label="Pay your pledge">
                        {third > 0 && (
                            <div className="pp-seg" role="radiogroup" aria-label="How much to pay">
                                <button type="button" role="radio" aria-checked={!split} className={cx(!split && "on")} onClick={() => setSplit(false)}><b>{money(all)}</b><span>All of it</span></button>
                                <button type="button" role="radio" aria-checked={split} className={cx(split && "on")} onClick={() => setSplit(true)}><b>{money(third)}</b><span>A third now</span></button>
                            </div>
                        )}
                        <div className="pp-methods" role="radiogroup" aria-label="How to pay">
                            {METHODS.map(([id, label, sub]) => { const on = method === id; return (
                                <div key={id} className={cx("pp-method", on && "on")}>
                                    <button type="button" role="radio" aria-checked={on} onClick={() => setMethod(id)}>
                                        <span className="pp-mtile">{id === "card" ? <CreditCard size={20} aria-hidden="true" /> : id === "bank" ? <Bank size={20} aria-hidden="true" /> : <DeviceMobile size={20} aria-hidden="true" />}</span>
                                        <span className="pp-mtx"><b>{label}</b><span>{sub}</span></span>
                                        <span className={cx("pp-radio", on && "on")} aria-hidden="true" />
                                    </button>
                                    {on && !isDemo && <div className="pp-mbody"><StripeFields ref={fields} total={amount / 100} currency={cur} method={id} onBehalfOf={acct} /></div>}
                                    {on && isDemo && id === "card" && (
                                        <div className="pp-mbody pp-cardf">
                                            <label className="pp-field"><span>Card number</span><input inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={card.num} onChange={(e) => setCard({ ...card, num: e.target.value.replace(/[^\d ]/g, "").slice(0, 23) })} /></label>
                                            <div className="pp-two"><label className="pp-field"><span>Expiry</span><input inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value.slice(0, 7) })} /></label><label className="pp-field"><span>Security code</span><input inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></label></div>
                                        </div>
                                    )}
                                </div>
                            ); })}
                        </div>
                        {error && <p role="alert" className="pp-error">{error}</p>}
                        <button type="button" className="pp-btn green lg" onClick={pay} disabled={phase !== "idle"}>{phase === "paying" ? "Processing…" : `Pay ${money(amount)}`}</button>
                        <p className="pp-fine"><LockSimple size={13} weight="fill" aria-hidden="true" /> Encrypted by Stripe. Paying by check, Zelle or cash instead? Give it to the {p.org_name} team and they will mark it paid.{isDemo && " Payments are simulated in this preview."}</p>
                    </section>
                )}
            </div>
        </Frame>
    );
};
