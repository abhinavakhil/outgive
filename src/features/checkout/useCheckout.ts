import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type TrackData, track as umami } from "@/shared/lib/analytics";
import { db, isDemo } from "@/shared/lib/db";
import { flag } from "@/shared/lib/flags";
import { type CheckoutCampaign, EMAIL, FREQS, type Freq, METHOD_NAME, type Method, UK_POSTCODE, allows, clampAmount, methodsFor, money, payProblem, quote, suggestMonthly, trustClaims } from "./model";
import { type NextKind, monthlyNudge, nextAction } from "./next-action";
import { type PayOrder, type PayResult, type PaymentProvider, STILL_CONFIRMING, createAttempts, demoPayments, hostPayments, livePayments, mapError, methodOf, returnedPayment, settle, takePayment } from "./payments";
import { type PresetVariant, presetsFor } from "./presets";
import { type Draft, clearDraft, fromDraft, fromServer, keepDraft, loadDraft, recoveryRequest, resumeId, saveDraft } from "./recovery";
import { STRIPE_KEY, type StripeFieldsHandle } from "./StripeFields";

export type Layout = "hero" | "pledge" | "ticket";
/** Step names, as they appear in analytics events (checkout_step_boost …). */
export const STEPS = ["amount", "boost", "details", "pay", "done"] as const;

/** What the host's payment handler gets. Card numbers never leave the form: take payment with your provider's own fields (Stripe Elements, Checkout). */
export interface Order {
    campaignId: string; layout: Layout; currency: string;
    amount: number; freq: Freq; total: number; recur: number; giftAid: number; match: number; receives: number;
    fund?: string; extras: string[]; method: Method; paidWith: string;
    donor: { first: string; last: string; email: string; anonymous: boolean; updates: boolean; postcode?: string; address?: string };
    tribute?: { name: string; email: string };
}
export interface CheckoutProps {
    campaign: CheckoutCampaign;
    layout: Layout;
    /** Take the payment. Resolve when the provider confirms; throw (with a message for the donor) to show an error. Leave out to simulate one. */
    onPay?: (order: Order) => Promise<void>;
    /** A ready payment provider (payments.ts), for a host that needs more than onPay: delayed methods, redirects, its own polling. */
    payments?: PaymentProvider;
    /**
     * Live payments through the `pay` function: whose gift it is, and the charity's Stripe account. Used only on a real backend with
     * VITE_STRIPE_PUBLISHABLE_KEY set; otherwise the payment is simulated.
     */
    live?: { org_id?: string; page_id?: string; stripeAccount?: string | null };
    /** A small, separate gift to a related cause, offered after paying. It is never added to the main payment. */
    addOn?: { id: string; name: string; amount: number };
    /** One other campaign to suggest after paying. Offered only when its trust details are complete and verified. */
    recommended?: Pick<CheckoutCampaign, "id" | "title" | "trust"> & { url: string };
    /** Analytics sink, Umami by default. Gets event names like checkout_step_pay and plain, non-personal facts. */
    track?: (event: string, data?: TrackData) => void;
    /** Buttons on the thank-you screen. */
    onShare?: () => void;
    onStartFundraiser?: () => void;
}

/**
 * idle → pending → authorized → succeeded (the thank-you), or → processing: a Direct Debit or bank payment that is on its way
 * and will be confirmed by email (the "pending" end screen). A failure goes back to idle with `issue` set.
 */
export type PayState = "idle" | "pending" | "authorized" | "succeeded" | "processing";
/** What went wrong with the last try. confirming: the bank has not answered yet, so the donor checks again instead of paying again. */
export interface Issue { confirming: boolean; retryable: boolean; alt: boolean }

const session = {
    get: <T>(k: string, d: T): T => { try { return (JSON.parse(window.sessionStorage.getItem(k) ?? "null") as T | null) ?? d; } catch { return d; } },
    set: (k: string, v: unknown) => { try { if (v == null) window.sessionStorage.removeItem(k); else window.sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
/** Asks the donor said no to this session ("nudge", or a next-action kind): never shown again. */
const DECLINED = "ck_declined";
/** What the donor chose, kept while a payment leaves for PayPal or a bank's page, so the result screen can be drawn on the way back. No card, bank or address details. */
const INFLIGHT = "ck_inflight";
const declineFor = (k: string) => session.set(DECLINED, [...new Set([...session.get<string[]>(DECLINED, []), k])]);
/** A change of frequency keeps an amount the donor chose themselves; a default or a tapped button is re-picked for the new frequency. */
const OWN_AMOUNT = ["typed", "dial", "resumed", "nudge", "upsell"];
const NOT_DONE = "That payment wasn’t completed, so nothing was taken. You can try again or choose another way to pay.";
const top = () => { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* jsdom */ } };

const fresh = (c: CheckoutCampaign, variant: PresetVariant, freq: Freq = "once") => {
    const amount = presetsFor({ campaign: c, freq, variant }).selected, said = session.get<string[]>(DECLINED, []);
    return {
        step: 0, amount, amountText: String(amount), amountSource: "default",
        freq, picks: {} as Record<string, boolean>, fund: c.funds?.[0]?.[0] ?? "", ga: !!c.giftAid,
        anon: false, updates: false, recover: false, method: "card" as Method, bank: "", mandate: false, express: false,
        first: "", last: "", email: "", postcode: "", address: "", tributeName: "", tributeEmail: "",
        card: "", exp: "", cvc: "", holder: "", ddName: "", sort: "", acct: "", errField: "",
        pay: "idle" as PayState, paidWith: "", err: "", issue: null as Issue | null,
        /** Where a restored draft came from; "" when this is a new gift. bare: back from a redirect with nothing known but the result. */
        resumed: "" as "" | "browser" | "link" | "server", bare: false,
        nudgeDeclined: said.includes("nudge"), nudgeFrom: 0,
        declined: said.filter((k) => k !== "nudge") as NextKind[], nextClosed: false,
        addon: "idle" as "idle" | "confirm" | "paying" | "paid" | "pending", addonMsg: "",
    };
};
export type CheckoutState = ReturnType<typeof fresh>;

const restore = (d: Draft) => {
    const r = fromDraft(d), amount = clampAmount(r.amount);
    return { ...r, amount, amountText: String(amount), freq: (FREQS as string[]).includes(r.freq) ? (r.freq as Freq) : ("once" as Freq) };
};
const init = (c: CheckoutCampaign, variant: PresetVariant, live: boolean): CheckoutState => {
    const base = fresh(c, variant);
    if (live && new URLSearchParams(window.location.search).has("ck_pay")) {
        const snap = session.get<{ campaign: string; s: Partial<CheckoutState> } | null>(INFLIGHT, null);
        return snap?.campaign === c.id ? { ...base, ...snap.s, step: 3, pay: "authorized" } : { ...base, step: 3, pay: "authorized", bare: true };
    }
    const id = resumeId(), d = loadDraft(c.id, id);
    return d ? { ...base, ...restore(d), resumed: id ? "link" : "browser" } : base;
};
/** The recovery rpcs. /checkout renders before the app opens its database, so this opens it on demand; recovery is a nicety and fails silently. */
const rpc = <T = unknown>(name: string, args: Record<string, unknown>) => db().then((d) => d.rpc<T>(name, args)).catch(() => null);

/** Shared state and actions behind all three layouts, with a funnel event for every step. */
export const useCheckout = (p: CheckoutProps) => {
    const { campaign: c, layout, onPay, track = umami, addOn } = p;
    const [variant] = useState(() => flag("checkout_presets"));
    const live = !isDemo && !!STRIPE_KEY && !onPay && !p.payments ? p.live ?? null : null;
    const [s, setS] = useState(() => init(c, variant, !!live));
    const set = useCallback((x: Partial<CheckoutState>) => setS((o) => ({ ...o, ...x })), []);
    const q = useMemo(() => quote(s, c), [s, c]);
    const f = useCallback((n: number) => money(n, c.currency, c.locale), [c.currency, c.locale]);
    const recurring = s.freq !== "once";
    const presets = useMemo(() => presetsFor({ campaign: c, freq: s.freq, variant }).amounts, [c, s.freq, variant]);
    // Live, Apple Pay and Google Pay are offered inside Stripe's own card fields, so our simulated wallet buttons go.
    const wallets = allows(c.payments, "wallets") && !live, paypal = allows(c.payments, "paypal");
    const methods = methodsFor(s.freq, layout, c.payments).filter((m) => !live || (m !== "apple" && (m !== "wallet" || paypal)));
    const method: Method = methods.includes(s.method) ? s.method : methods.includes("card") ? "card" : methods[0] ?? "card";
    /** Anything to pay with at all: a method in the list, or the express wallets / PayPal. */
    const canPay = methods.length > 0 || wallets || paypal;
    const busy = s.pay === "pending" || s.pay === "authorized";

    // One provider and one attempt store for the life of this checkout: the demo keeps its attempts in memory.
    const fields = useRef<StripeFieldsHandle | null>(null);
    const hostPay = useRef(onPay); hostPay.current = onPay;
    const [provider] = useState<PaymentProvider>(() => p.payments
        ?? (onPay ? hostPayments((o) => hostPay.current!(o))
            : live ? livePayments((name, body) => db().then((d) => d.fn(name, body)), { org_id: live.org_id, page_id: live.page_id }, () => fields.current)
                : demoPayments()));
    const [attempts] = useState(() => createAttempts());
    /** True from the pay click to the result, so a second click before the next render cannot start a second run. */
    const running = useRef(false);

    const base = (): TrackData => ({ layout, campaign: c.id, amount: s.amount, freq: s.freq, preset_variant: variant, ...(s.step >= 3 ? { method } : {}) });
    const ev = (name: string, data?: TrackData) => track(name, { ...base(), ...data });
    /** Exposure events are sent once per ask, however often it re-renders. */
    const shown = useRef(new Set<string>());
    const expose = (key: string, name: string, data: TrackData) => { if (!shown.current.has(key)) { shown.current.add(key); ev(name, data); } };

    // Open, and give up: a visit that leaves before paying records the step it stopped on.
    const stepRef = useRef(0);
    stepRef.current = s.step;
    useEffect(() => {
        track("checkout_view", { layout, campaign: c.id, preset_variant: variant });
        if (s.resumed) expose("resumed", "checkout_resumed", { source: s.resumed, step: STEPS[s.step] });
        const leave = () => { if (stepRef.current < 4) track("checkout_abandon", { layout, campaign: c.id, preset_variant: variant, step: STEPS[stepRef.current] }); };
        window.addEventListener("pagehide", leave);
        // Leaving in-app (unmount) counts only once the donor has moved past the amount.
        return () => { window.removeEventListener("pagehide", leave); if (stepRef.current > 0) leave(); };
    }, [layout, c.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---------------------------------------------------------------- recovery: the unfinished gift, kept in this browser
    /** The draft's token once it is on the server (the donor ticked the email opt-in), so it can be closed. */
    const [remote] = useState(() => ({ token: s.recover ? loadDraft(c.id)?.id ?? null : null }));
    const endDraft = () => { clearDraft(c.id); if (remote.token) void rpc("checkout_recovery_done", { t: remote.token }); remote.token = null; };
    const sig = JSON.stringify([s.step, s.amount, s.freq, s.picks, s.fund, s.ga, s.first.trim(), s.email.trim(), s.recover]);
    const sig0 = useRef(sig);
    useEffect(() => {
        // Nothing to keep until the donor changes something, and nothing once the payment has started.
        if (s.step >= 4 || s.pay !== "idle" || s.bare || sig === sig0.current) return;
        const t = setTimeout(() => {
            const d = saveDraft(c.id, s), req = recoveryRequest(d);
            if (req && d) { remote.token = d.id; void rpc("checkout_recovery_save", req); }
            else if (!s.recover && remote.token) { void rpc("checkout_recovery_done", { t: remote.token }); remote.token = null; } // consent withdrawn
        }, 600);
        return () => clearTimeout(t);
    }, [sig, s.pay]); // eslint-disable-line react-hooks/exhaustive-deps
    // A resume link opened in another browser: the draft is only on the server.
    useEffect(() => {
        const id = resumeId();
        if (!id || s.resumed || s.pay !== "idle") return;
        let gone = false;
        void rpc<Parameters<typeof fromServer>[1]>("checkout_recovery_get", { t: id }).then((r) => {
            const d = fromServer(id, r);
            if (gone || !d || d.campaign !== c.id) return;
            keepDraft(d); remote.token = id;
            setS((o) => (o.step === 0 && o.amountSource === "default" ? { ...o, ...restore(d), resumed: "server" } : o));
            expose("resumed", "checkout_resumed", { source: "server", step: STEPS[Math.min(2, d.step)] });
        });
        return () => { gone = true; };
    }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const go = (n: number) => {
        setS((o) => ({ ...o, step: n, err: "", errField: "", issue: null, resumed: "", express: n >= 3 && o.express }));
        track(`checkout_step_${STEPS[n]}`, { ...base(), dir: n > s.step ? "forward" : "back" });
        top();
    };

    const fail = (step: number, field: string, err: string) => { set({ step, err, errField: field, issue: null }); ev("checkout_invalid", { step: STEPS[step], field }); return false; };
    /** Checks the current step before moving on; says what is missing in plain words. */
    const details = (): [string, string] | null => {
        const needFull = c.giftAid && s.ga;
        if (!s.first.trim()) return ["first", "Add your first name for the receipt."];
        if (needFull && !s.last.trim()) return ["last", "Gift Aid needs your last name too."];
        if (!EMAIL.test(s.email.trim())) return ["email", "Add an email address so we can send your receipt."];
        return needFull ? giftAidAddress() : null;
    };
    const giftAidAddress = (): [string, string] | null => {
        if (!UK_POSTCODE.test(s.postcode.trim())) return ["postcode", "Gift Aid needs a UK postcode, like LS9 7AB."];
        if (!s.address.trim()) return ["address", "Gift Aid needs your house number and street."];
        return null;
    };
    const valid = (): boolean => {
        if (s.step === 0 && !(Number(s.amountText) >= 2)) return fail(0, "amount", `Choose at least ${f(2)}.`);
        const d = s.step === 2 && details();
        if (d) return fail(2, d[0], d[1]);
        return true;
    };

    // ---------------------------------------------------------------- paying
    const orderFor = (label: string): Order => ({
        campaignId: c.id, layout, currency: c.currency, amount: s.amount, freq: s.freq, total: q.total, recur: q.recur, giftAid: q.giftAid, match: q.match, receives: q.receives,
        fund: s.fund || undefined, extras: Object.keys(s.picks).filter((k) => s.picks[k]), method, paidWith: label,
        donor: { first: s.first.trim(), last: s.last.trim(), email: s.email.trim(), anonymous: s.anon, updates: s.updates, ...(c.giftAid && s.ga ? { postcode: s.postcode.trim().toUpperCase(), address: s.address.trim() } : {}) },
        ...(s.picks.tribute ? { tribute: { name: s.tributeName.trim(), email: s.tributeEmail.trim() } } : {}),
    });
    const facts = (o: Order): TrackData => ({ method: methodOf(o), total: o.total, giftaid: o.giftAid ? 1 : 0, extras: o.extras.length });
    const take = (order: PayOrder, onAuthorized?: () => void) => takePayment(provider, order, attempts.keyFor(order), onAuthorized)
        .catch((e): PayResult => ({ status: "failed", id: "", error: mapError(e) }));
    const notReady = () => mapError({ message: "The card form isn’t ready yet. Try again in a moment." });

    /** Where a payment's result leads: the thank-you, the "on its way" screen, or back to the payment step with what to do next. */
    const land = (r: PayResult, fx: TrackData) => {
        attempts.finish(r); running.current = false; session.set(INFLIGHT, null);
        if (r.status === "succeeded" || (r.status === "processing" && r.delayed)) {
            const paid = r.status === "succeeded";
            set({ pay: paid ? "succeeded" : "processing", step: 4, err: "", errField: "", issue: null });
            ev(paid ? "checkout_paid" : "checkout_pending", fx);
            endDraft(); top();
        } else if (r.status === "processing") {
            // Not an answer yet. The attempt stays open, so checking again resumes the same payment instead of starting another.
            set({ pay: "idle", step: 3, err: r.message ?? STILL_CONFIRMING, errField: "", issue: { confirming: true, retryable: true, alt: false } });
            ev("checkout_pay_unconfirmed", fx);
        } else {
            const e = r.error ?? { ...mapError({}), message: NOT_DONE, suggestAlternative: true }; // requires_action: the donor came back without approving
            set({ pay: "idle", step: 3, err: e.message, errField: "", issue: { confirming: false, retryable: e.retryable, alt: e.suggestAlternative } });
            ev("checkout_pay_failed", { method: fx.method, reason: e.code });
        }
    };

    /**
     * Takes the payment, but only with complete, valid details. The express wallets and PayPal collect the donor's
     * name, email and payment in their own sheet; every other method needs the details step and its own fields.
     */
    const pay = async (label = METHOD_NAME[method]) => {
        if (busy || running.current) return;
        const express = label === "Apple Pay" || label === "Google Pay" ? "wallets" : label === "PayPal" ? "paypal" : null;
        if (express ? !(express === "wallets" ? wallets : paypal) : !methods.includes(method)) return fail(3, "method", `${c.charity} doesn’t take ${label} yet. Choose another way to pay.`);
        const stripe = !!live && !express && (method === "card" || method === "dd" || method === "bank");
        if (!express) {
            const d = details();
            if (d) return fail(2, d[0], d[1]);
            const bad = stripe ? null : payProblem(method, s); // live, Stripe's own fields do this check
            if (bad) return fail(3, bad.field, bad.msg);
        } else if (c.giftAid && s.ga) {
            // The wallet gives the name; the Gift Aid declaration still needs a home address.
            const d = giftAidAddress();
            if (d) return fail(3, d[0], d[1]);
        }
        if (recurring && !s.mandate) return fail(3, "mandate", "Switch on the authorisation to start your regular gift.");
        running.current = true;
        if (stripe) {
            const bad = fields.current ? await fields.current.submit() : notReady();
            if (bad) { running.current = false; return fail(3, "card", bad.message); }
        }
        const order: PayOrder = { ...orderFor(label), ...(!live && !express && method === "card" ? { demoCard: s.card } : {}) };
        const fx = facts(order);
        set({ pay: "pending", err: "", errField: "", issue: null, paidWith: label, step: 3 });
        ev("checkout_pay_start", fx);
        if (live) session.set(INFLIGHT, { campaign: c.id, s: { amount: s.amount, amountText: s.amountText, freq: s.freq, picks: s.picks, fund: s.fund, ga: s.ga, first: s.first, last: s.last, email: s.email, method, paidWith: label, express: s.express, mandate: s.mandate } });
        land(await take(order, () => set({ pay: "authorized" })), fx);
    };

    // Back from PayPal or a bank's page: ask the server how it ended and show that, whatever else is known.
    const back = useRef<string | null | undefined>(undefined);
    useEffect(() => {
        if (back.current !== undefined) return; // once, even when effects run twice in development
        back.current = live ? returnedPayment() : null;
        if (!back.current) return;
        running.current = true;
        const fx = facts(orderFor(s.paidWith || METHOD_NAME[method]));
        void settle(provider, back.current).then((r) => land(r, fx));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ---------------------------------------------------------------- asks: the monthly nudge, and one next action after paying
    const nudge = s.step === 1 ? monthlyNudge({ amount: s.amount, freq: s.freq, declined: s.nudgeDeclined }) : null;
    const nextUp = s.step === 4 && !s.nextClosed && !s.bare
        ? nextAction({ campaign: c, gift: { amount: s.amount, freq: s.freq }, donor: { declined: [...s.declined, ...(p.onStartFundraiser ? [] : ["fundraiser" as const])] }, addOn, recommended: p.recommended })
        : null;
    useEffect(() => { if (nudge) expose("nudge", "checkout_nudge_shown", { suggest: nudge.amount }); }, [!!nudge]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (nextUp) expose(`next:${nextUp.kind}`, "checkout_next_shown", { kind: nextUp.kind }); }, [nextUp?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

    /** The add-on: a second, separate payment with its own attempt key, started only by its own confirm button. */
    const payAddOn = async () => {
        if (!addOn || s.addon === "paying" || running.current) return;
        running.current = true;
        if (live) {
            const bad = fields.current ? await fields.current.submit() : notReady();
            if (bad) { running.current = false; return set({ addon: "confirm", addonMsg: bad.message }); }
        }
        const main = orderFor(s.paidWith || METHOD_NAME[method]);
        const order: PayOrder = {
            ...main, amount: addOn.amount, freq: "once", total: addOn.amount, recur: addOn.amount, giftAid: 0, match: 0, receives: addOn.amount, fund: addOn.id, extras: [], tribute: undefined,
            ...(live ? { method: "card" as Method, paidWith: "Card" } : methodOf(main) === "card" ? { demoCard: s.card } : {}),
        };
        const fx = { id: addOn.id, total: addOn.amount, method: methodOf(order) };
        set({ addon: "paying", addonMsg: "" });
        ev("checkout_addon_pay_start", fx);
        const r = await take(order);
        attempts.finish(r); running.current = false;
        if (r.status === "succeeded") { set({ addon: "paid" }); ev("checkout_addon_paid", fx); }
        else if (r.status === "processing" && r.delayed) { set({ addon: "pending" }); ev("checkout_addon_pending", fx); }
        else { set({ addon: "confirm", addonMsg: r.error?.message ?? r.message ?? NOT_DONE }); ev("checkout_addon_failed", { ...fx, reason: r.error?.code ?? r.status }); }
    };

    const again = (x: Partial<CheckoutState>, freq: Freq = "once") => { endDraft(); shown.current.clear(); setS({ ...fresh(c, variant, freq), first: s.first, last: s.last, email: s.email, ...x }); top(); };
    const next = () => { if (!valid()) return; if (s.step === 0) ev("checkout_amount", { source: s.amountSource }); if (s.step < 3) go(s.step + 1); else void pay(); };

    return {
        s, set, q, f, c, layout, recurring, methods, method, busy, canPay, presets, variant, live, fields, wallets, paypal, addOn, recommended: p.recommended,
        /** The payment is on its way (Direct Debit, pay by bank): the end screen says so instead of "paid". */
        pending: s.pay === "processing",
        /** Gift Aid this gift would attract, whether or not it is switched on. */
        gaAdds: s.ga ? q.giftAid : quote({ ...s, ga: true }, c).giftAid,
        /** Shown only when the organisation is verified. */
        trust: trustClaims(c.trust),
        next, back: () => go(Math.max(0, s.step - 1)), go, pay,
        /** After a failure: the same button again. A retryable failure, or an unconfirmed payment, resumes the same attempt. */
        retry: () => pay(s.paidWith || undefined),
        setAmount: (v: unknown, source: string) => { const a = clampAmount(v); set({ amount: a, amountText: String(a), amountSource: source }); },
        typeAmount: (raw: string) => { const t = raw.replace(/[^0-9]/g, "").slice(0, 5), n = Number(t); set(n >= 2 && n <= 10000 ? { amountText: t, amount: n, amountSource: "typed" } : { amountText: t }); },
        blurAmount: () => { const a = clampAmount(s.amountText); set({ amount: a, amountText: String(a) }); },
        setFreq: (freq: Freq) => {
            const a = presetsFor({ campaign: c, freq, variant }).selected;
            set({ freq, mandate: false, nudgeFrom: 0, ...(OWN_AMOUNT.includes(s.amountSource) ? {} : { amount: a, amountText: String(a), amountSource: "default" }) });
            ev("checkout_freq", { freq });
        },
        setGa: (ga: boolean) => { set({ ga, err: "", errField: "" }); ev("checkout_giftaid", { on: ga ? 1 : 0 }); },
        toggleExtra: (id: string) => { const on = !s.picks[id]; set({ picks: { ...s.picks, [id]: on } }); ev("checkout_extra", { id, on: on ? 1 : 0 }); },
        setMethod: (m: Method) => { set({ method: m, err: "", issue: null }); ev("checkout_method", { method: m }); },
        setFund: (fund: string) => { set({ fund }); ev("checkout_fund", { fund }); },
        /**
         * The fast path: straight to payment with a wallet, skipping the optional boost step and the details form.
         * Gift Aid is then asked on the payment step, and counts only if the donor says yes there (or already chose it on the boost step).
         */
        express: () => {
            ev("checkout_express", { method: "wallet", from: STEPS[s.step] });
            go(3);
            set({ express: true, ga: s.step >= 1 && s.ga, method: layout === "ticket" && methods.includes("apple") ? "apple" : layout === "pledge" && methods.includes("wallet") ? "wallet" : s.method });
        },
        nudge,
        acceptNudge: () => { if (!nudge) return; ev("checkout_nudge_accepted", { suggest: nudge.amount }); set({ freq: "monthly", amount: nudge.amount, amountText: String(nudge.amount), amountSource: "nudge", nudgeFrom: s.amount, mandate: false }); },
        declineNudge: () => { if (!nudge) return; ev("checkout_nudge_declined", { suggest: nudge.amount }); declineFor("nudge"); set({ nudgeDeclined: true }); },
        /** Back to the one-off gift, and the ask is not made again. */
        undoNudge: () => { ev("checkout_nudge_undone"); declineFor("nudge"); set({ freq: "once", amount: s.nudgeFrom, amountText: String(s.nudgeFrom), amountSource: "preset", nudgeFrom: 0, nudgeDeclined: true, mandate: false }); },
        nextUp,
        acceptNext: (kind: NextKind) => { ev("checkout_next_accepted", { kind }); if (kind === "addon") set({ addon: "confirm", addonMsg: "" }); },
        /** No thanks: the ask closes for this gift and is not offered again this session. */
        declineNext: (kind: NextKind) => { ev("checkout_next_declined", { kind }); declineFor(kind); set({ declined: [...s.declined, kind], nextClosed: true, addon: "idle", addonMsg: "" }); },
        payAddOn,
        /** Thank-you upsell: start a new monthly gift at a suggested amount. */
        upsell: () => { const a = suggestMonthly(s.amount); ev("checkout_upsell_monthly", { suggest: a }); again({ amount: a, amountText: String(a), amountSource: "upsell", method: layout === "ticket" ? "card" : "dd" }, "monthly"); },
        restart: () => { ev("checkout_restart"); again({}); },
    };
};
export type Ck = ReturnType<typeof useCheckout>;
