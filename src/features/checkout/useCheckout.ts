import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type TrackData, track as umami } from "@/shared/lib/analytics";
import { type Ads, type GiftTags, funnelStep, giftTags, trackDonation } from "@/shared/attribution";
import { db, isDemo } from "@/shared/lib/db";
import { flag } from "@/shared/lib/flags";
import { type CheckoutCampaign, EMAIL, FREQS, type Freq, METHOD_NAME, type Method, UK_POSTCODE, MAX, MIN, allows, clampAmount, countOf, round2, methodsFor, money, payProblem, quote, suggestMonthly, trustClaims } from "./model";
import { type NextKind, monthlyNudge, nextAction } from "./next-action";
import { type PayOrder, type PayResult, type PaymentProvider, STILL_CONFIRMING, createAttempts, demoPayments, hostPayments, livePayments, mapError, methodOf, returnedPayment, settle, takePayment } from "./payments";
import { type PresetVariant, presetsFor } from "./presets";
import { type Draft, clearDraft, fromDraft, fromServer, keepDraft, loadDraft, recoveryRequest, resumeId, saveDraft } from "./recovery";
import { STRIPE_KEY, type StripeFieldsHandle } from "./StripeFields";
import { BANK_FROM, type Layout, SHORT, isUs, nightsOpen, roundGap, shownAddons } from "./us";

export type { Layout };
/** Add-ons that are extras (lines on the gift), by the extra's id. */
const EXTRA_ADDON: Record<string, string> = { alfitr: "alfitr", fidya: "fidya", tribute: "dedication" };
/** Step names, as they appear in analytics events (checkout_step_boost …). */
export const STEPS = ["amount", "boost", "details", "pay", "done"] as const;

/** What the host's payment handler gets. Card numbers never leave the form: take payment with your provider's own fields (Stripe Elements, Checkout). */
export interface Order {
    campaignId: string; layout: Layout; currency: string;
    amount: number; freq: Freq; total: number; recur: number; giftAid: number; match: number; receives: number;
    fund?: string; extras: string[]; method: Method; paidWith: string;
    donor: { first: string; last: string; email: string; anonymous: boolean; updates: boolean; postcode?: string; address?: string };
    tribute?: { name: string; email: string };
    /** Every line charged, with the fund it is credited to, so the receipt keeps Zakat exact and each add-on on its own line. */
    lines?: { key: string; label: string; value: number; fund: string }[];
    /** The ten nights: double on the odd nights. */
    odd?: boolean;
    /** Where the gift came from (the embed's source, UTM tags), kept in the gift's details. */
    source?: Record<string, string>;
    /** Revenue attribution (src/shared/attribution.ts giftTags): sent as `tags` on the pay function's start. */
    tags?: GiftTags;
    /** The A/B test variant this donor saw, kept on the gift so results count it. */
    experiment?: { id: string; variant: string };
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
    /** Where this checkout is hosted (the embed's source: { qr: "table-6" }, UTM tags), kept on every gift it takes. */
    source?: Record<string, string>;
    /** The A/B test variant chosen for this session (Checkout does it from campaign.experiment). */
    experiment?: { id: string; variant: string };
    /** "Pledge now, pay by a date": records the pledge (the pledges API) and resolves; throw with words for the donor. Simulated when left out. */
    onPledge?: (p: { amount: number; currency: string; fund: string; due: string; donor: { name: string; email: string } }) => Promise<void>;
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
const OWN_AMOUNT = ["typed", "dial", "resumed", "nudge", "upsell", "link", "fund"];
const NOT_DONE = "That payment wasn’t completed, so nothing was taken. You can try again or choose another way to pay.";
const top = () => { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* jsdom */ } };

const fresh = (c: CheckoutCampaign, variant: PresetVariant, freq: Freq = "once") => {
    const amount = presetsFor({ campaign: presetsOf(c, c.funds?.[0]?.[0] ?? "", freq), freq, variant }).selected, said = session.get<string[]>(DECLINED, []);
    return {
        step: 0, amount, amountText: String(amount), amountSource: "default",
        // Fee cover is pre-ticked only when the charity turned that on; nothing else that costs money ever is.
        freq, picks: (c.coverDefault ? { cover: true } : {}) as Record<string, boolean>, fund: c.funds?.[0]?.[0] ?? "", ga: !!c.giftAid,
        counts: {} as Record<string, number>, odd: false, round: 0, daf: false, pledgeBy: "", pledged: false,
        /** The fraud guard asked for a Turnstile check; receiptUrl: the PDF receipt-send made for a paid gift. */
        challenge: false, receiptUrl: "",
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
    return { ...r, amount, amountText: String(amount), freq: ([...FREQS, "weekly", "nights"] as string[]).includes(r.freq) ? (r.freq as Freq) : ("once" as Freq) };
};
/**
 * The screens a layout walks through (step numbers as in STEPS). UK: amount, Gift Aid and extras, details, payment, thank you.
 * US: no Gift Aid step to explain, so the details sit on the payment screen (four screens). The short layouts put the add-ons on
 * the gift screen too: gift, payment, thank you.
 */
/** A night's gift is small and repeats: its own buttons. Zakat runs larger (fundPresets). */
export const NIGHT_PRESETS = [5, 10, 25, 50];
const presetsOf = (c: CheckoutCampaign, fund: string, freq: Freq) => ({ presets: freq === "nights" ? NIGHT_PRESETS : c.fundPresets?.[fund] ?? c.presets });
export const flowFor = (c: CheckoutCampaign, layout: Layout) => (SHORT.includes(layout) ? [0, 3, 4] : isUs(c) ? [0, 1, 3, 4] : [0, 1, 2, 3, 4]);
/** The last screen of the flow at or before `step`. */
const onFlow = (flow: number[], step: number) => [...flow].reverse().find((n) => n <= step) ?? 0;
/** An amount kept to the cent, between MIN and MAX. */
const exact = (v: unknown) => Math.max(MIN, Math.min(MAX, round2(Number(v) || MIN)));
/**
 * A link that says what to give: ?amount=1234.56&fund=zakat (the zakat calculator's "Give $X as Zakat"). The amount is decimal
 * major units, kept to the cent; the fund only when the campaign offers it.
 */
export const fromLink = (c: CheckoutCampaign, search = window.location.search): Partial<CheckoutState> => {
    const q = new URLSearchParams(search), a = Number(q.get("amount")), fund = q.get("fund") ?? "";
    return {
        ...(c.funds?.some(([id]) => id === fund) ? { fund } : {}),
        ...(a >= MIN && a <= MAX ? { amount: exact(a), amountText: String(exact(a)), amountSource: "link" } : {}),
    };
};
const init = (c: CheckoutCampaign, layout: Layout, variant: PresetVariant, live: boolean): CheckoutState => {
    const base = { ...fresh(c, variant, layout === "nights" && nightsOpen(c) ? "nights" : "once"), ...fromLink(c) };
    if (live && new URLSearchParams(window.location.search).has("ck_pay")) {
        const snap = session.get<{ campaign: string; s: Partial<CheckoutState> } | null>(INFLIGHT, null);
        return snap?.campaign === c.id ? { ...base, ...snap.s, step: 3, pay: "authorized" } : { ...base, step: 3, pay: "authorized", bare: true };
    }
    const id = resumeId(), d = loadDraft(c.id, id);
    if (!d) return base;
    const r = restore(d);
    return { ...base, ...r, ...fromLink(c), step: onFlow(flowFor(c, layout), r.step), resumed: id ? "link" : "browser" };
};
/** The recovery rpcs. /checkout renders before the app opens its database, so this opens it on demand; recovery is a nicety and fails silently. */
const rpc = <T = unknown>(name: string, args: Record<string, unknown>) => db().then((d) => d.rpc<T>(name, args)).catch(() => null);

/** Shared state and actions behind all three layouts, with a funnel event for every step. */
export const useCheckout = (p: CheckoutProps) => {
    const { campaign: c, layout, onPay, track = umami, addOn } = p;
    const [variant] = useState(() => flag("checkout_presets"));
    const live = !isDemo && !!STRIPE_KEY && !onPay && !p.payments ? p.live ?? null : null;
    const [s, setS] = useState(() => init(c, layout, variant, !!live));
    const set = useCallback((x: Partial<CheckoutState>) => setS((o) => ({ ...o, ...x })), []);
    const us = isUs(c), flow = flowFor(c, layout), detailsOnPay = !flow.includes(2);
    /** The host's source plus any utm_* tags on this address, kept on the gift. */
    const [sourceTags] = useState(() => {
        const t: Record<string, string> = { ...p.source };
        new URLSearchParams(window.location.search).forEach((v, k) => { if (/^utm_[a-z]+$/.test(k) && v) t[k] = v.slice(0, 80); });
        return Object.keys(t).length ? t : null;
    });
    // Which add-ons are on the gift screen (at most three), then the quote over only the extras the donor can see.
    const q0 = useMemo(() => quote(s, c), [s, c]);
    const m0 = c.match && "status" in c.match ? c.match : null;
    const gap = us ? roundGap(c, q0.total - s.round) : 0;
    const onScreen = us ? shownAddons(c.addons, { total: q0.total, layout, matchLive: !!m0 && (q0.matchReason === null || q0.matchReason === "below-min"), roundGap: gap, fund: s.fund }) : [];
    const extras = useMemo(() => (c.extras ?? []).filter((x) => !us || x.price === "fee" || (onScreen as string[]).includes(EXTRA_ADDON[x.id] ?? x.id)), [c, us, onScreen.join()]); // eslint-disable-line react-hooks/exhaustive-deps
    const view = useMemo(() => (us ? { ...c, extras } : c), [c, us, extras]);
    const q = useMemo(() => (us ? quote({ ...s, round: onScreen.includes("roundup") ? s.round : 0 }, view) : q0), [us, s, view, q0, onScreen.includes("roundup")]); // eslint-disable-line react-hooks/exhaustive-deps
    const f = useCallback((n: number) => money(n, c.currency, c.locale), [c.currency, c.locale]);
    const recurring = s.freq === "monthly" || s.freq === "yearly" || s.freq === "weekly", nights = s.freq === "nights";
    const presetCampaign = useMemo(() => presetsOf(c, s.fund, s.freq), [c, s.fund, s.freq]);
    const presets = useMemo(() => presetsFor({ campaign: presetCampaign, freq: s.freq, variant }).amounts, [presetCampaign, s.freq, variant]);
    /** How often the donor can give: the ten nights only on a US campaign with that add-on, while a night is still to come. */
    const freqs: Freq[] = us ? ["once", "monthly", ...(c.weekly ? ["weekly" as const] : []), ...(nightsOpen(c) ? ["nights" as const] : [])] : FREQS;
    /** A fund priced per person or day (Zakat al-Fitr, Fidya): the amount is price × count, set with a stepper. */
    const perUnit = c.perUnitFunds?.[s.fund];
    // Live, Apple Pay and Google Pay are offered inside Stripe's own card fields, so our simulated wallet buttons go.
    const wallets = allows(c.payments, "wallets") && !live, paypal = allows(c.payments, "paypal") && !us;
    const methods = methodsFor(s.freq, layout, c.payments, us ? { bank: !!c.addons?.includes("bank") && q.total >= BANK_FROM } : undefined).filter((m) => !live || (m !== "apple" && (m !== "wallet" || paypal)));
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
    /** A Turnstile token for the next start only (the guard checks it once). */
    const challengeToken = useRef("");

    const base = (): TrackData => ({ layout, campaign: c.id, amount: s.amount, freq: s.freq, preset_variant: variant, ...(us ? { region: "US", fund: s.fund } : {}), ...(s.step >= 3 ? { method } : {}) });
    const ev = (name: string, data?: TrackData) => track(name, { ...base(), ...data });
    /** Exposure events are sent once per ask, however often it re-renders. */
    const shown = useRef(new Set<string>());
    const expose = (key: string, name: string, data: TrackData) => { if (!shown.current.has(key)) { shown.current.add(key); ev(name, data); } };

    // Open, and give up: a visit that leaves before paying records the step it stopped on.
    const stepRef = useRef(0);
    stepRef.current = s.step;
    useEffect(() => {
        track("checkout_view", { layout, campaign: c.id, preset_variant: variant });
        funnelStep(live?.org_id ?? "", "visit", layout); funnelStep(live?.org_id ?? "", "checkout_started", layout);
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

    // Every add-on's take-up is measured: one exposure per add-on per gift screen (checkout_addon_shown), then each toggle (checkout_extra, checkout_addon).
    useEffect(() => { if (s.step === 0 || s.step === 1) for (const id of [...onScreen, ...(extras.some((x) => x.price === "fee") ? ["cover"] : [])]) expose(`addon:${id}`, "checkout_addon_shown", { id }); }, [onScreen.join(), s.step]); // eslint-disable-line react-hooks/exhaustive-deps
    const fail = (step: number, field: string, err: string) => { const at = onFlow(flow, step); set({ step: at, err, errField: field, issue: null }); ev("checkout_invalid", { step: STEPS[at], field }); return false; };
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
        lines: q.lines.map((l) => ({ key: l.key, label: l.label, value: l.value, fund: l.key === "gift" ? s.fund : l.key === "fee" ? "fees" : (c.extras?.find((x) => x.id === l.key)?.fund ?? (l.key === "round" ? "general" : s.fund)) })),
        ...(nights ? { odd: s.odd } : {}),
        ...(sourceTags ? { source: sourceTags } : {}),
        ...(p.experiment ? { experiment: p.experiment } : {}),
        // Add-ons by key in cents (0 for a dedication), and which were offered, for revenue tracking.
        tags: giftTags({
            layout, campaign: c.id, rhythm: (s.freq === "nights" ? "nightly" : s.freq) as NonNullable<GiftTags["rhythm"]>, // "weekly" too, for Jumu'ah gifts
            addons: { ...Object.fromEntries(q.lines.filter((l) => l.key !== "gift").map((l) => [l.key === "fee" ? "cover" : l.key === "round" ? "roundup" : l.key, Math.round(l.value * 100)])), ...(s.picks.tribute ? { dedication: 0 } : {}) },
            addons_shown: [...onScreen, ...(extras.some((x) => x.price === "fee") ? ["cover"] : [])],
            consent: { updates: s.updates, recover: s.recover },
        }),
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
            // Embedded on another site: tell the host page (embed/v1.js passes it on as onPaid). No personal details.
            if (paid) funnelStep(live?.org_id ?? "", "paid", layout);
            // A bare donation event (value and currency only) for the charity's own ads, when it opted in (revenue_ads is null otherwise).
            if (live?.org_id && paid && !nights) void db().then((d) => d.rpc<Ads>("revenue_ads", { org: live.org_id })).then((ads) => trackDonation(ads, Math.round(q.total * 100), c.currency)).catch(() => {});
            // The PDF receipt (receipt-send, by the compliance work); a nicety, so a failure leaves the print button.
            if (live && paid && r.id) void db().then((d) => d.fn<{ pdf_url?: string }>("receipt-send", { donation_id: r.id })).then((x) => { if (x?.pdf_url) set({ receiptUrl: x.pdf_url }); }).catch(() => {});
            if (window.parent !== window) window.parent.postMessage({ type: "outgive:paid", status: paid ? "succeeded" : "processing", total: q.total, currency: c.currency, freq: s.freq, fund: s.fund }, "*");
            endDraft(); top();
        } else if (r.status === "processing") {
            // Not an answer yet. The attempt stays open, so checking again resumes the same payment instead of starting another.
            set({ pay: "idle", step: 3, err: r.message ?? STILL_CONFIRMING, errField: "", issue: { confirming: true, retryable: true, alt: false } });
            ev("checkout_pay_unconfirmed", fx);
        } else {
            const e = r.error ?? { ...mapError({}), message: NOT_DONE, suggestAlternative: true }; // requires_action: the donor came back without approving
            set({ pay: "idle", step: 3, err: e.message, errField: "", issue: { confirming: false, retryable: e.retryable && e.code !== "challenge_required", alt: e.suggestAlternative }, challenge: e.code === "challenge_required" });
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
        if ((recurring || nights) && !s.mandate) return fail(3, "mandate", nights ? "Switch on the authorisation to schedule your nightly gifts." : "Switch on the authorisation to start your regular gift.");
        running.current = true;
        if (stripe) {
            const bad = fields.current ? await fields.current.submit() : notReady();
            if (bad) { running.current = false; return fail(3, "card", bad.message); }
        }
        const order: PayOrder = { ...orderFor(label), ...(!live && !express && method === "card" ? { demoCard: s.card } : {}), ...(challengeToken.current ? { challengeToken: challengeToken.current } : {}) };
        challengeToken.current = "";
        const fx = facts(order);
        set({ pay: "pending", err: "", errField: "", issue: null, paidWith: label, step: 3 });
        ev("checkout_pay_start", fx);
        funnelStep(live?.org_id ?? "", "payment_attempted", layout);
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
        ? nextAction({ campaign: c, gift: { amount: s.amount, freq: s.freq === "nights" ? "once" : s.freq }, donor: { declined: [...s.declined, ...(p.onStartFundraiser ? [] : ["fundraiser" as const]), ...(us && !c.addons?.includes("monthly") ? ["monthly" as const] : [])] }, addOn, recommended: p.recommended })
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
    const next = () => { if (!valid()) return; if (s.step === 0) { ev("checkout_amount", { source: s.amountSource }); funnelStep(live?.org_id ?? "", "amount_chosen", layout); } if (s.step < 3) go(flow[flow.indexOf(s.step) + 1] ?? 3); else void pay(); };

    /**
     * "Pledge now, pay by a date": no payment now. The pledge goes to the pledges API (via onPledge), which emails a pay link and
     * reminds the donor before the date. Needs a name and an email, like any gift.
     */
    const pledgeLater = async () => {
        if (busy || running.current) return;
        const d = details();
        if (d) return fail(3, d[0], d[1]);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s.pledgeBy)) return fail(3, "pledgeBy", "Choose the date you will pay by.");
        running.current = true;
        set({ pay: "pending", err: "" });
        ev("checkout_addon", { id: "pledge", on: 1 });
        try {
            const save = p.onPledge ?? (live?.org_id
                ? (x: Parameters<NonNullable<CheckoutProps["onPledge"]>>[0]) => db().then((d) => d.rpc("checkout_pledge_create", { org: live.org_id, p: { ...x, amount_cents: Math.round(x.amount * 100), donor_name: x.donor.name, donor_email: x.donor.email, due_date: x.due } })).then(() => undefined)
                : () => new Promise<void>((r) => setTimeout(r, 900))); // the demo: nothing is saved
            await save({ amount: q.total, currency: c.currency, fund: s.fund, due: s.pledgeBy, donor: { name: `${s.first.trim()} ${s.last.trim()}`.trim(), email: s.email.trim() } });
            set({ pay: "idle", pledged: true, step: 4 }); ev("checkout_pledged", { total: q.total }); endDraft(); top();
        } catch (e) { set({ pay: "idle", err: (e as Error)?.message || "We couldn’t save your pledge. Try again." }); }
        running.current = false;
    };

    return {
        s, set, q, f, c, layout, recurring, methods, method, busy, canPay, presets, variant, live, fields, wallets, paypal, addOn, recommended: p.recommended,
        /** The payment is on its way (Direct Debit, pay by bank): the end screen says so instead of "paid". */
        pending: s.pay === "processing" || s.pledged,
        /** Gift Aid this gift would attract, whether or not it is switched on. */
        gaAdds: s.ga ? q.giftAid : quote({ ...s, ga: true }, c).giftAid,
        /** Shown only when the organisation is verified. */
        trust: trustClaims(c.trust),
        next, back: () => go(flow[Math.max(0, flow.indexOf(s.step) - 1)] ?? 0), go, pay,
        us, flow, detailsOnPay, nights, freqs, perUnit, extras, view, addons: onScreen, roundGap: gap, pledgeLater,
        /** After a failure: the same button again. A retryable failure, or an unconfirmed payment, resumes the same attempt. */
        retry: () => pay(s.paidWith || undefined),
        /** Turnstile passed: the same payment again (same attempt key), with the token. */
        passChallenge: (token: string) => { challengeToken.current = token; set({ challenge: false }); void pay(s.paidWith || undefined); },
        setAmount: (v: unknown, source: string) => { const a = clampAmount(v); set({ amount: a, amountText: String(a), amountSource: source }); },
        // Cents are kept (a Zakat amount from the calculator is exact to the cent); whole amounts stay whole.
        typeAmount: (raw: string) => { const t = (raw.replace(/[^0-9.]/g, "").match(/^\d{0,5}(\.\d{0,2})?/)?.[0] ?? ""), n = Number(t); set(n >= MIN && n <= MAX ? { amountText: t, amount: round2(n), amountSource: "typed" } : { amountText: t }); },
        blurAmount: () => { const a = exact(s.amountText); set({ amount: a, amountText: String(a) }); },
        setFreq: (freq: Freq) => {
            const a = presetsFor({ campaign: presetsOf(c, s.fund, freq), freq, variant }).selected;
            set({ freq, mandate: false, nudgeFrom: 0, ...(OWN_AMOUNT.includes(s.amountSource) ? {} : { amount: a, amountText: String(a), amountSource: "default" }) });
            ev("checkout_freq", { freq });
        },
        setGa: (ga: boolean) => { set({ ga, err: "", errField: "" }); ev("checkout_giftaid", { on: ga ? 1 : 0 }); },
        toggleExtra: (id: string) => { const on = !s.picks[id]; set({ picks: { ...s.picks, [id]: on } }); ev("checkout_extra", { id, on: on ? 1 : 0 }); },
        setMethod: (m: Method) => { set({ method: m, err: "", issue: null }); ev("checkout_method", { method: m }); },
        setFund: (fund: string) => {
            const u = c.perUnitFunds?.[fund], n = Math.max(1, s.counts[fund] ?? 1);
            // A per-unit fund sets the amount itself; leaving one goes back to the buttons for the new fund.
            const amount = u ? u.price * n : perUnit ? presetsFor({ campaign: { presets: c.fundPresets?.[fund] ?? c.presets }, freq: s.freq, variant }).selected : 0;
            set({ fund, ...(amount ? { amount, amountText: String(amount), amountSource: u ? "fund" : "default" } : {}), ...(u && s.freq === "nights" ? { freq: "once" as Freq } : {}) });
            ev("checkout_fund", { fund });
        },
        /** People for Zakat al-Fitr, days for Fidya: on the add-on (an extra's id) or on the fund itself. */
        setCount: (id: string, n: number) => {
            const u = c.perUnitFunds?.[id], x = c.extras?.find((e) => e.id === id), max = u?.max ?? x?.unit?.max ?? 1, v = Math.max(1, Math.min(max, Math.round(n)));
            set({ counts: { ...s.counts, [id]: v }, ...(u && s.fund === id ? { amount: u.price * v, amountText: String(u.price * v), amountSource: "fund" } : {}) });
            ev("checkout_count", { id, n: v });
        },
        countOf: (id: string) => { const x = c.extras?.find((e) => e.id === id); return x ? countOf(x, s.counts) : Math.max(1, s.counts[id] ?? 1); },
        setOdd: (odd: boolean) => { set({ odd, mandate: false }); ev("checkout_addon", { id: "nights_odd", on: odd ? 1 : 0 }); },
        /** Round up: adds the gap as its own line (to the appeal, never into a Zakat amount). Tap again to take it off. */
        toggleRound: () => { const on = !s.round; set({ round: on ? gap : 0 }); ev("checkout_addon", { id: "roundup", on: on ? 1 : 0, value: gap }); },
        toggleDaf: () => { set({ daf: !s.daf }); ev("checkout_addon", { id: "daf", on: s.daf ? 0 : 1 }); },
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
