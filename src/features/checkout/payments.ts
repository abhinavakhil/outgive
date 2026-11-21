/**
 * Taking the payment, behind one interface for every provider: Stripe and PayPal through the `pay` edge function, and a simulated
 * provider for the demo and local development. The thank-you screen is only ever shown on a "succeeded" that came from the server.
 *
 *   const key = attempts.keyFor(order);
 *   const r = await takePayment(provider, order, key, () => set({ pay: "authorized" }));
 *   attempts.finish(r);
 *
 * Card numbers never pass through here: live cards are typed into Stripe's own fields (StripeFields.tsx). The one exception is
 * `demoCard`, which only the simulated provider reads, to pick a test outcome; it is never sent anywhere.
 */
import { toMinor } from "@/shared/lib/money";
import type { Order } from "./useCheckout";

export type PayStatus = "succeeded" | "processing" | "requires_action" | "failed";
export type PayCode = "card_declined" | "insufficient_funds" | "expired_card" | "authentication_required" | "network" | "not_configured" | "unknown";
export interface PayError {
    code: PayCode;
    /** For the donor, in plain words. */
    message: string;
    /** Trying again with the same details can work, and must reuse the same attempt key (so it can never charge twice). False: the attempt is over; the next try is a new attempt. */
    retryable: boolean;
    /** Point the donor at a different card or another way to pay. */
    suggestAlternative: boolean;
}
export interface PayResult {
    status: PayStatus;
    /** The payment's id (the donation row's id when live). "" when the payment never started. */
    id: string;
    /** requires_action: send the donor here (PayPal approval). `provider.confirm` does it. */
    redirectUrl?: string;
    /** requires_action: confirm with Stripe's fields. `provider.confirm` does it. */
    clientSecret?: string;
    /** processing that takes days (Bacs Direct Debit, pay by bank): show "on its way", not "thank you, paid". */
    delayed?: boolean;
    /** For the donor: the error's message, or why it is still processing. */
    message?: string;
    error?: PayError;
}
/** The order, plus the card typed into the demo's own card form. Only the simulated provider reads `demoCard`. */
export type PayOrder = Order & { demoCard?: string };

export interface PaymentProvider {
    /** Begins (or resumes) the payment for this attempt. Never throws: a failure is a result. The same key never charges twice. */
    start: (order: PayOrder, attemptKey: string) => Promise<PayResult>;
    /** Does what a requires_action result asks: confirms with Stripe's fields (3-D Secure included) or redirects to PayPal. */
    confirm: (r: PayResult) => Promise<PayResult>;
    /** What the server says now. Poll it with `settle`. */
    status: (id: string) => Promise<PayResult>;
}

// ---------------------------------------------------------------- errors
const COPY: Record<PayCode, [message: string, retryable: boolean, suggestAlternative: boolean]> = {
    card_declined: ["Your card was declined, so nothing was taken. Try a different card or another way to pay.", false, true],
    insufficient_funds: ["That card doesn’t have enough funds for this gift, so nothing was taken. Try a different card or another way to pay.", false, true],
    expired_card: ["That card has expired, so nothing was taken. Try a different card.", false, true],
    authentication_required: ["Your bank needs you to approve this payment. Nothing has been taken yet. Try again and approve it with your bank.", true, false],
    network: ["We couldn’t reach the payment service. Check your connection and try again. You won’t be charged twice.", true, false],
    not_configured: ["That way of paying isn’t available. Choose another way to pay.", false, true],
    unknown: ["The payment didn’t go through. Try again. You won’t be charged twice.", true, false],
};
const OFFLINE = /failed to (fetch|send)|network ?error|load failed/i;

/** Any provider error (a Stripe.js error, the pay function's `error`, a thrown Error) as a machine code and words for the donor. */
export const mapError = (raw: unknown): PayError => {
    const e = (raw && typeof raw === "object" ? raw : { message: String(raw ?? "") }) as { code?: string; decline_code?: string; type?: string; message?: string };
    const c = e.decline_code || e.code || "", said = (e.message ?? "").trim();
    const code: PayCode = c === "insufficient_funds" ? "insufficient_funds"
        : c === "expired_card" ? "expired_card"
        : c === "authentication_required" || c === "payment_intent_authentication_failure" ? "authentication_required"
        : c === "not_configured" ? "not_configured"
        : c === "network" || e.type === "api_connection_error" || OFFLINE.test(said) ? "network"
        : c === "card_declined" || e.type === "card_error" || e.decline_code ? "card_declined"
        : "unknown";
    const [message, retryable, suggestAlternative] = COPY[code];
    // Our own server and Stripe.js already speak to the donor; keep what they said when we have no better words.
    const own = (code === "unknown" || code === "not_configured") && said && said.length <= 160 ? said : message;
    return { code, message: own, retryable: retryable && c !== "canceled", suggestAlternative };
};
const failed = (id: string, raw: unknown): PayResult => { const error = mapError(raw); return { status: "failed", id, error, message: error.message }; };

// ---------------------------------------------------------------- attempts
/** What makes two tries the same attempt: same campaign, method, money and donor. Change any of them and it is a new attempt. */
const printOf = (o: Order) => [o.campaignId, o.method, o.paidWith, o.freq, o.currency, o.total, o.recur, o.donor.email.toLowerCase()].join("|");
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const session = (): Store | null => { try { return window.sessionStorage; } catch { return null; } };
const SAVED = "ck_attempt";

/**
 * The attempt key: the idempotency key for one try at paying. `keyFor` gives the same key for the same order until `finish` ends
 * the attempt, so a double click, a retry after a dropped connection or a reload mid-payment resumes the same charge.
 * Kept in sessionStorage so a reload does not forget a payment that is in flight.
 */
export const createAttempts = (store: Store | null = session(), newKey: () => string = () => crypto.randomUUID()) => {
    let cur: { print: string; key: string } | null = null;
    try { cur = JSON.parse(store?.getItem(SAVED) ?? "null"); } catch { /* unreadable: start clean */ }
    const save = () => { try { if (cur) store?.setItem(SAVED, JSON.stringify(cur)); else store?.removeItem(SAVED); } catch { /* private mode */ } };
    return {
        keyFor: (order: Order) => { const print = printOf(order); if (cur?.print !== print) { cur = { print, key: newKey() }; save(); } return cur.key; },
        /**
         * Call with the final result. The attempt ends (the next try gets a new key) when it was paid, when it is on its way
         * (Bacs, bank), or when it failed for good. It stays open after a retryable failure or an unconfirmed "processing".
         */
        finish: (r: PayResult) => { if (r.status === "succeeded" || (r.status === "processing" && r.delayed) || (r.status === "failed" && !r.error?.retryable)) { cur = null; save(); } },
    };
};

// ---------------------------------------------------------------- polling
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export interface SettleOptions { interval?: number; timeout?: number; sleep?: (ms: number) => Promise<void>; now?: () => number }
export const STILL_CONFIRMING = "We’re still confirming your payment. Please don’t pay again; your receipt will be emailed as soon as it goes through.";

/**
 * Polls until the server gives an answer: succeeded, failed, requires_action, or a delayed processing (Bacs, bank).
 * A dropped connection while polling is not an answer, so it keeps going. On timeout the result is "processing" with a
 * message for the donor: never a success we have not seen, and never an invitation to pay twice.
 */
export const settle = async (p: Pick<PaymentProvider, "status">, id: string, { interval = 1500, timeout = 30000, sleep = wait, now = Date.now }: SettleOptions = {}): Promise<PayResult> => {
    const end = now() + timeout;
    for (;;) {
        const r = await p.status(id).catch((e) => failed(id, e));
        const unsure = r.status === "processing" ? !r.delayed : r.status === "failed" && r.error?.code === "network";
        if (!unsure) return r;
        if (now() + interval > end) return { status: "processing", id, message: STILL_CONFIRMING };
        await sleep(interval);
    }
};

/**
 * The whole payment: start, do what the provider asks (card fields, 3-D Secure, PayPal), then wait for the server's answer.
 * `onAuthorized` fires when the provider has accepted the payment and only the server's confirmation is left.
 */
export const takePayment = async (p: PaymentProvider, order: PayOrder, attemptKey: string, onAuthorized?: () => void, opts?: SettleOptions): Promise<PayResult> => {
    let r = await p.start(order, attemptKey);
    if (r.status === "requires_action") r = await p.confirm(r);
    if (r.status !== "processing") return r;
    onAuthorized?.();
    r = await settle(p, r.id, opts);
    // Still waiting on the donor (a 3-D Secure check they closed): the attempt is open, and trying again resumes it.
    return r.status === "requires_action" ? failed(r.id, { code: "authentication_required" }) : r;
};

// ---------------------------------------------------------------- live: the pay edge function (Stripe, PayPal)
/** The server's name for how this order is paid. The express buttons pay with their own label whatever method is selected. */
export const methodOf = (o: Pick<Order, "method" | "paidWith">) => o.paidWith === "PayPal" || o.method === "paypal" ? "paypal" : o.paidWith === "Apple Pay" || o.paidWith === "Google Pay" || o.method === "apple" || o.method === "wallet" ? "wallet" : o.method;

type Fn = <T = unknown>(name: string, body: Record<string, unknown>) => Promise<T>;
interface ServerResult { status: PayStatus; id: string; clientSecret?: string; redirectUrl?: string; delayed?: boolean; error?: unknown }
const fromServer = (r: ServerResult): PayResult => {
    if (r.status === "failed") return { ...failed(r.id, r.error), clientSecret: r.clientSecret };
    return { status: r.status, id: r.id, clientSecret: r.clientSecret, redirectUrl: r.redirectUrl, delayed: r.delayed };
};
/** Stripe's fields, as the provider needs them (StripeFields' handle). */
export interface Confirmer { confirm: (clientSecret: string, returnUrl: string) => Promise<{ error?: unknown }> }
const RETURN = "ck_pay";
const returnUrl = (id: string) => { const u = new URL(window.location.href); u.searchParams.set(RETURN, id); return u.toString(); };
/** After a redirect back (PayPal, a bank's page): the payment's id from the address, which is then cleaned. Poll it with `settle`. */
export const returnedPayment = (): string | null => {
    const u = new URL(window.location.href), id = u.searchParams.get(RETURN);
    if (!id) return null;
    for (const k of [RETURN, "payment_intent", "payment_intent_client_secret", "redirect_status", "token", "PayerID"]) u.searchParams.delete(k);
    window.history.replaceState(window.history.state, "", u.toString());
    return id;
};

/**
 * Stripe and PayPal through the `pay` function. `fn` is `(await db()).fn`; `target` says whose gift it is; `fields` gives the mounted
 * StripeFields handle. The body is built field by field, so nothing else on the order (a demo card least of all) can reach the server.
 */
export const livePayments = (fn: Fn, target: { org_id?: string; page_id?: string }, fields: () => Confirmer | null, redirect: (url: string) => void = (url) => window.location.assign(url)): PaymentProvider => ({
    start: async (o, attemptKey) => {
        try {
            return fromServer(await fn<ServerResult>("pay", {
                action: "start", attempt_key: attemptKey, ...target, method: methodOf(o), freq: o.freq, currency: o.currency,
                amount_cents: toMinor(o.amount, o.currency), extras_cents: toMinor(o.total - o.recur, o.currency), cover_cents: toMinor(o.recur - o.amount, o.currency),
                donor_name: `${o.donor.first} ${o.donor.last}`.trim(), donor_email: o.donor.email || undefined, anonymous: o.donor.anonymous, dedication: o.tribute?.name ?? "", cause: o.fund ?? "",
                origin: window.location.origin, return_to: window.location.pathname + window.location.search,
            }));
        } catch (e) { return failed("", e); }
    },
    confirm: async (r) => {
        if (r.redirectUrl) { redirect(r.redirectUrl); return new Promise<PayResult>(() => {}); } // the page is leaving; `returnedPayment` picks it up on the way back
        if (!r.clientSecret) return r;
        const f = fields();
        if (!f) return failed(r.id, { message: "The card form isn’t ready yet. Try again in a moment." });
        try { const { error } = await f.confirm(r.clientSecret, returnUrl(r.id)); return error ? failed(r.id, error) : { status: "processing", id: r.id }; } catch (e) { return failed(r.id, e); }
    },
    status: async (id) => { try { return fromServer(await fn<ServerResult>("pay", { action: "status", id })); } catch (e) { return failed(id, e); } },
});

// ---------------------------------------------------------------- a host's own handler
/**
 * A library user's `onPay` as a provider, so it runs through the same states as every other payment. The handler resolves when the
 * host's provider has confirmed the payment and throws (with words for the donor) when it has not. A paid attempt is never run again.
 */
export const hostPayments = (onPay: (order: Order) => Promise<void>): PaymentProvider => {
    const paid = new Set<string>();
    return {
        start: async ({ demoCard: _demoCard, ...order }, attemptKey) => {
            if (paid.has(attemptKey)) return { status: "succeeded", id: attemptKey };
            try { await onPay(order); paid.add(attemptKey); return { status: "succeeded", id: attemptKey }; } catch (e) { return failed(attemptKey, e); }
        },
        confirm: async (r) => r,
        status: async (id) => (paid.has(id) ? { status: "succeeded", id } : failed(id, {})),
    };
};

// ---------------------------------------------------------------- demo: a simulated provider
/** Stripe's documented test numbers and what they do here. Any other card is paid. */
export const TEST_CARDS: Record<string, PayCode> = { "4000000000000002": "card_declined", "4000000000009995": "insufficient_funds", "4000002500003155": "authentication_required" };
export interface DemoOptions {
    /** Called once per paid attempt, to record the gift wherever the host keeps gifts. */
    record?: (order: Order) => Promise<unknown> | unknown;
    sleep?: (ms: number) => Promise<void>;
    /** The payment animation's beats: pending, then authorised, then confirmed. */
    pendingMs?: number; authMs?: number;
    /** How long the pretend 3-D Secure step takes. */
    challengeMs?: number;
}
/**
 * The same interface with no provider behind it, for the demo and local development. Timed to the payment animation
 * (1.4s pending, 1.45s authorised). Direct Debit and pay by bank end as a delayed "processing", as they do for real.
 * Nothing leaves the browser; `demoCard` only picks the outcome.
 */
export const demoPayments = ({ record, sleep = wait, pendingMs = 1400, authMs = 1450, challengeMs = 1200 }: DemoOptions = {}): PaymentProvider => {
    interface Attempt { id: string; order: Order; slow: boolean; authorised: boolean; paid: boolean; done?: Promise<unknown> }
    const byKey = new Map<string, Attempt>(), byId = new Map<string, Attempt>();
    return {
        start: async ({ demoCard, ...order }, attemptKey) => {
            let a = byKey.get(attemptKey);
            if (!a) { a = { id: `demo_${attemptKey}`, order, slow: order.method === "dd" || order.method === "bank", authorised: false, paid: false }; byKey.set(attemptKey, a); byId.set(a.id, a); }
            if (a.paid) return { status: "succeeded", id: a.id }; // the same attempt again: already paid, nothing more is taken
            await sleep(pendingMs);
            const outcome = methodOf(order) === "card" ? TEST_CARDS[(demoCard ?? "").replace(/\D/g, "")] : undefined;
            if (outcome === "authentication_required") return a.authorised ? { status: "processing", id: a.id } : { status: "requires_action", id: a.id, message: "Your bank wants to check it’s you." };
            if (outcome) return failed(a.id, { code: outcome });
            a.authorised = true;
            return { status: "processing", id: a.id };
        },
        confirm: async (r) => { const a = byId.get(r.id); if (!a) return failed(r.id, {}); await sleep(challengeMs); a.authorised = true; return { status: "processing", id: a.id }; },
        status: async (id) => {
            const a = byId.get(id);
            if (!a) return failed(id, {});
            if (!a.authorised) return { status: "requires_action", id };
            if (a.slow) return { status: "processing", id, delayed: true };
            a.done ??= (async () => { await sleep(authMs); await record?.(a.order); a.paid = true; })();
            try { await a.done; return { status: "succeeded", id }; } catch (e) { a.done = undefined; return failed(id, e); }
        },
    };
};
