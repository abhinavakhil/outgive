// Input checks and status mapping for the pay function; no Stripe or database, so they run under `deno test`.

export type PayMethod = "card" | "wallet" | "dd" | "bank" | "paypal";
export interface StartInput {
    action: "start";
    /** One per checkout attempt, made by the client. The same key always resolves to the same donation row and the same charge. */
    attempt_key: string;
    org_id?: string; page_id?: string; method: PayMethod; freq?: "once" | "monthly" | "yearly"; currency: string;
    /** The gift itself; what repeats on a regular gift. */
    amount_cents: number;
    /** One-off add-ons, charged once even on a regular gift. */
    extras_cents?: number;
    /** The covered card fee, charged with every payment. */
    cover_cents?: number;
    /** A tip to Outgive, charged with the first payment. */
    tip_cents?: number;
    donor_name?: string; donor_email?: string; anonymous?: boolean; dedication?: string; cause?: string; origin?: string; return_to?: string;
    /** Zakat, Sadaqah, Sadaqah Jariyah or Lillah: kept on the gift so restricted funds can be reported apart. */
    fund?: string;
    /** The donor made a Gift Aid declaration; their home address is in details. */
    gift_aid?: boolean;
    /** What the gift is made of (basket items, nights, on behalf of, Gift Aid address), stored on the donation for the charity. */
    details?: Record<string, unknown>;
}
export interface StatusInput { action: "status"; id: string }
export type PayInput = StartInput | StatusInput;

/** What the client gets back. `error` carries the provider's own codes; the client turns them into words (src/features/checkout/payments.ts). */
export interface PayOut {
    status: "succeeded" | "processing" | "requires_action" | "failed";
    /** The donation id; poll `status` with it. */
    id: string;
    clientSecret?: string; redirectUrl?: string;
    /** processing that takes days (Bacs, pay by bank): show "on its way", stop polling. */
    delayed?: boolean;
    error?: { code?: string; decline_code?: string; message?: string };
}

/** Stripe payment method types behind each method. Wallets are card payments the Payment Element offers by itself. */
export const PM_TYPES: Record<Exclude<PayMethod, "paypal">, string[]> = { card: ["card"], wallet: ["card"], dd: ["bacs_debit"], bank: ["pay_by_bank"] };
const SLOW = new Set<string>(["dd", "bank"]);
const cents = (n: unknown) => n === undefined || (Number.isInteger(n) && (n as number) >= 0);

export const validate = (b: PayInput) => {
    if (b.action === "status") return /^[0-9a-f-]{36}$/i.test(b.id ?? "") ? null : "id is required";
    if (b.action !== "start") return "action must be start or status";
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(b.attempt_key ?? "")) return "attempt_key is required";
    if (!b.org_id && !b.page_id) return "org_id or page_id is required";
    if (!["card", "wallet", "dd", "bank", "paypal"].includes(b.method)) return "Unknown payment method";
    if (!["once", "monthly", "yearly"].includes(b.freq ?? "once")) return "freq must be once, monthly or yearly";
    if (!Number.isInteger(b.amount_cents) || b.amount_cents < 100) return "The minimum gift is 1.00";
    if (!cents(b.extras_cents) || !cents(b.cover_cents) || !cents(b.tip_cents)) return "extras_cents, cover_cents and tip_cents must be whole, positive numbers";
    if (totals(b).today > 99_999_900) return "That amount is above the card limit";
    if (!/^[A-Za-z]{3}$/.test(b.currency ?? "")) return "currency must be a 3-letter code";
    if (b.donor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.donor_email)) return "That email address does not look right";
    if ((b.dedication ?? "").length > 200 || (b.cause ?? "").length > 80 || (b.donor_name ?? "").length > 80 || (b.fund ?? "").length > 40) return "Text is too long";
    if (b.details !== undefined && (typeof b.details !== "object" || b.details === null || JSON.stringify(b.details).length > 8000)) return "details must be a small object";
    if (b.gift_aid && !(typeof b.details?.postcode === "string" && b.details.postcode.trim() && typeof b.details?.house === "string" && b.details.house.trim())) return "Gift Aid needs a house name or number and a postcode";
    return null;
};

/** gift = what the charity is credited with; today = the first charge (tip included); recur = every later charge. */
export const totals = (b: Pick<StartInput, "amount_cents" | "extras_cents" | "cover_cents" | "tip_cents">) => {
    const extras = b.extras_cents ?? 0, cover = b.cover_cents ?? 0, tip = b.tip_cents ?? 0;
    return { gift: b.amount_cents + extras, cover, tip, today: b.amount_cents + extras + cover + tip, recur: b.amount_cents + cover };
};

export interface Intent { status: string; client_secret?: string | null; last_payment_error?: { code?: string; decline_code?: string } | null }
/**
 * A PaymentIntent as the checkout sees it. An intent waiting for a payment method is "requires_action" (confirm it with the client secret);
 * when polling (`fresh` false) and its last try was refused, that is the answer: "failed", with Stripe's codes.
 */
export const fromIntent = (pi: Intent, method: string, id: string, fresh: boolean): PayOut => {
    const secret = pi.client_secret ?? undefined, e = pi.last_payment_error;
    if (pi.status === "succeeded") return { status: "succeeded", id };
    if (pi.status === "processing") return { status: "processing", id, delayed: SLOW.has(method) };
    if (pi.status === "canceled") return { status: "failed", id, error: { code: "canceled" } };
    if (pi.status === "requires_payment_method" && e && !fresh) return { status: "failed", id, error: { code: e.code, decline_code: e.decline_code } };
    return { status: "requires_action", id, clientSecret: secret };
};

interface PayPalOrder { id?: string; status?: string; links?: { rel: string; href: string }[]; purchase_units?: { payments?: { captures?: { status?: string }[] } }[]; details?: { issue?: string }[] }
/** A PayPal order (or capture response) as the checkout sees it. APPROVED means the donor said yes and the caller should capture. */
export const fromPayPal = (o: PayPalOrder, id: string): PayOut & { capture?: boolean } => {
    const cap = o.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    if (cap === "COMPLETED") return { status: "succeeded", id };
    if (cap === "PENDING") return { status: "processing", id, delayed: true };
    if (cap || o.status === "VOIDED" || !o.status) return { status: "failed", id, error: { code: o.details?.[0]?.issue === "INSTRUMENT_DECLINED" || cap ? "card_declined" : "unknown" } };
    if (o.status === "APPROVED") return { status: "processing", id, capture: true };
    if (o.status === "COMPLETED") return { status: "succeeded", id };
    return { status: "requires_action", id, redirectUrl: o.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href };
};
