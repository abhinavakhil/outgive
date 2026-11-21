/** The pricing page calculator: what a charity nets from an appeal, built on the same per-gift maths as the checkout (shared/lib/money). Integer minor units throughout. */
import { breakdown, CARD_FEE_FIXED, CARD_FEE_PCT } from "@/shared/lib/money";

/** The platform fee when a charity switches tips off: the 3% the admin Payments → Fees panel shows. Outgive sets the real figure per organisation (organisations.platform_fee_bps). */
export const TIPS_OFF_FEE_BPS = 300;

export interface EstimateInput { raisedCents: number; avgGiftCents: number; tipsOn: boolean; tipPct: number; cover: boolean; feeBps?: number }
export interface Estimate {
    /** How many gifts the total is split into. */ gifts: number;
    /** Gifts to the charity, before any fee. */ raised: number;
    /** Donor tips to Outgive, paid on top of the gifts. Zero when tips are off. */ tips: number;
    /** What donors add on top to cover the card fee. */ cover: number;
    /** Outgive's fee taken from the gifts. Zero when tips are on. */ platformFee: number;
    /** Stripe's card fee at the standard rate, an estimate. */ stripeFee: number;
    /** What reaches the charity: gifts + cover - Stripe fee - platform fee. */ charity: number;
    /** Everything donors are charged: gifts + tips + cover. */ donorsPay: number;
}

/** Stripe's estimated fee on one card payment, at the rate the checkout uses for "cover the fees". */
export const stripeFeeFor = (chargeCents: number) => (chargeCents > 0 ? Math.round((chargeCents * CARD_FEE_PCT) / 100) + CARD_FEE_FIXED : 0);

/**
 * Splits the total into equal gifts, prices one gift with the checkout's `breakdown`, and multiplies up.
 * ponytail: every gift is the average and pays by card at the standard rate, and Stripe's fee is counted on gift + cover only (not on the tip). Model a gift mix or other payment methods if the page ever needs more than an estimate.
 */
export const estimate = ({ raisedCents, avgGiftCents, tipsOn, tipPct, cover, feeBps = TIPS_OFF_FEE_BPS }: EstimateInput): Estimate => {
    const total = Math.max(0, Math.round(raisedCents)), avg = Math.max(100, Math.round(avgGiftCents));
    const gifts = total > 0 ? Math.max(1, Math.round(total / avg)) : 0;
    if (!gifts) return { gifts: 0, raised: 0, tips: 0, cover: 0, platformFee: 0, stripeFee: 0, charity: 0, donorsPay: 0 };
    const b = breakdown(total / gifts, { tipPct: tipsOn ? tipPct : 0, cover, feeBps: tipsOn ? 0 : feeBps });
    const stripe = stripeFeeFor(b.amount + b.cover);
    return {
        gifts, raised: gifts * b.amount, tips: gifts * b.tip, cover: gifts * b.cover, platformFee: gifts * b.platformFee, stripeFee: gifts * stripe,
        charity: gifts * (b.amount + b.cover - stripe - b.platformFee), donorsPay: gifts * b.total,
    };
};
