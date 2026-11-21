/**
 * Which amounts to offer, and which to preselect, from what is known about the campaign and the donor.
 * Pure and deterministic: the same inputs always give the same buttons, so an experiment only varies `variant`.
 */
import { type CheckoutCampaign, type Freq, MAX, MIN, clampAmount } from "./model";

/**
 * control: the campaign's own presets, second one selected (the behaviour before this module).
 * smart: scaled for monthly, anchored on the donor's last gift or the campaign's typical gift.
 * ask-up: smart, but preselects the step above the anchor.
 */
export type PresetVariant = "control" | "smart" | "ask-up";
export interface PresetChoice { amounts: number[]; selected: number; variant: PresetVariant }
export interface PresetContext {
    campaign: Pick<CheckoutCampaign, "presets">;
    freq: Freq;
    /** The donor's last gift, if known. Used only when it was the same kind (monthly vs not) as this one. */
    lastGift?: { amount: number; freq: Freq };
    /** The campaign's typical one-off gift (its median, say). */
    typicalGift?: number;
    variant?: PresetVariant;
}

const FALLBACK = [10, 25, 50, 100];
/** A monthly ask sits at about 40% of a one-off ask. */
export const MONTHLY_SCALE = 0.4;
const fives = (n: number) => Math.max(5, Math.min(MAX, Math.round(n / 5) * 5));
const ladder = (xs: number[]) => [...new Set(xs.filter((n) => n >= MIN && n <= MAX))].sort((a, b) => a - b);

export const presetsFor = ({ campaign, freq, lastGift, typicalGift, variant = "smart" }: PresetContext): PresetChoice => {
    const own = ladder(campaign.presets), base = own.length ? own : FALLBACK;
    if (variant === "control") return { amounts: base, selected: base[1] ?? base[0], variant };

    const monthly = freq === "monthly", scale = (n: number) => (monthly ? fives(n * MONTHLY_SCALE) : n);
    const scaled = ladder(base.map(scale));
    let anchor = scaled[1] ?? scaled[0];
    if (lastGift && (lastGift.freq === "monthly") === monthly) anchor = clampAmount(lastGift.amount); // their own amount, exactly
    else if (typicalGift && typicalGift > 0) {
        const t = scale(typicalGift);
        // Inside the ladder, snap to the nearest step (the lower on a tie) so two near-equal buttons never sit side by side.
        anchor = t < scaled[0] || t > scaled[scaled.length - 1] ? fives(t) : scaled.reduce((best, n) => (Math.abs(n - t) < Math.abs(best - t) ? n : best));
    }
    // Same number of buttons as the campaign set, with one step below the anchor where there is one.
    const all = ladder([...scaled, anchor]), at = all.indexOf(anchor), from = Math.max(0, Math.min(at - 1, all.length - scaled.length));
    const amounts = all.slice(from, from + scaled.length);
    return { amounts, selected: variant === "ask-up" ? amounts[amounts.indexOf(anchor) + 1] ?? anchor : anchor, variant };
};
