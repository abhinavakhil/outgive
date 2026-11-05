/** Money maths shared by the donate form and the checkout function. Everything is integer cents. */

export const TIP_CHOICES = [0, 5, 10, 15] as const;
export const DEFAULT_TIP_PCT = 10;
/** Stripe's standard card rate, used to estimate what "cover the fees" should add. The real fee is taken by Stripe from the charity's balance. */
export const CARD_FEE_PCT = 2.9;
export const CARD_FEE_FIXED = 30;

export const tipFor = (amountCents: number, pct: number) => Math.round((amountCents * pct) / 100);
/** What to add so the charity still nets the gift after Stripe's cut: solves (gift + cover) * (1 - r) - fixed = gift. */
export const coverFor = (amountCents: number) => Math.max(0, Math.ceil((amountCents + CARD_FEE_FIXED) / (1 - CARD_FEE_PCT / 100) - amountCents));
export const platformFeeFor = (amountCents: number, bps: number) => Math.round((amountCents * bps) / 10000);

export interface Breakdown { amount: number; tip: number; cover: number; platformFee: number; total: number; applicationFee: number }
/** The full charge: gift + tip + cover; the platform keeps tip + fee as Stripe's application fee. */
export const breakdown = (amountCents: number, { tipPct = 0, cover = false, feeBps = 0 }: { tipPct?: number; cover?: boolean; feeBps?: number } = {}): Breakdown => {
    const amount = Math.max(0, Math.round(amountCents));
    const tip = tipFor(amount, tipPct);
    const cov = cover ? coverFor(amount) : 0;
    const platformFee = platformFeeFor(amount, feeBps);
    return { amount, tip, cover: cov, platformFee, total: amount + tip + cov, applicationFee: tip + platformFee };
};

/** Currencies Stripe treats as having no minor unit, so amounts are whole units. */
export const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "HUF", "TWD", "UGX", "XAF", "XOF"]);
export const toMinor = (units: number, currency: string) => Math.round(units * (ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100));
export const fromMinor = (cents: number, currency: string) => cents / (ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100);

export const fmt = (cents: number, currency: string, opts: Intl.NumberFormatOptions = {}) =>
    new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2, ...opts }).format(fromMinor(cents, currency));
