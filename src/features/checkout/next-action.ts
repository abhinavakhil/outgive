/**
 * What to ask a donor for next: a monthly nudge before payment, and one action on the thank-you screen.
 * Pure rules, so the same donor sees the same ask and a declined ask is never repeated.
 */
import { type CheckoutCampaign, type Freq, suggestMonthly, trustGaps } from "./model";

/** One-off gifts from this amount get the "make it monthly?" nudge before payment. */
export const NUDGE_FROM = 20;
/** Below this, a monthly ask on the thank-you screen would be more than the gift itself. */
export const MONTHLY_FROM = 10;

/**
 * The pre-payment nudge: only for a one-off gift of at least `threshold`, from a donor who is not already giving monthly
 * and has not said no this session. Returns the monthly amount to suggest, or null to show nothing.
 */
export const monthlyNudge = (i: { amount: number; freq: Freq; declined?: boolean; alreadyMonthly?: boolean; threshold?: number }): { amount: number } | null =>
    i.freq !== "once" || i.declined || i.alreadyMonthly || i.amount < (i.threshold ?? NUDGE_FROM) ? null : { amount: suggestMonthly(i.amount) };

export type NextKind = "monthly" | "addon" | "campaign" | "share" | "fundraiser";
export type NextAction =
    | { kind: "monthly"; amount: number }
    | { kind: "addon"; id: string; name: string; amount: number }
    | { kind: "campaign"; id: string; title: string }
    | { kind: "share" }
    | { kind: "fundraiser" };
export interface NextInput {
    campaign: Pick<CheckoutCampaign, "id">;
    /** The gift just made. */
    gift: { amount: number; freq: Freq };
    /** recurring: already has a regular gift somewhere. declined: asks turned down before, never shown again. */
    donor?: { recurring?: boolean; declined?: NextKind[] };
    /** A small extra gift to a related cause. */
    addOn?: { id: string; name: string; amount: number };
    /** One other campaign to recommend; offered only when its trust details are complete and verified. */
    recommended?: Pick<CheckoutCampaign, "id" | "title" | "trust">;
}

/**
 * The single next action for the thank-you screen. The first rule that fits and was not declined wins:
 *  1. monthly: a one-off gift of MONTHLY_FROM or more, from a donor with no regular gift.
 *  2. fundraiser: the donor is committed (this gift is regular, or they already give regularly).
 *  3. addon: a related-cause add-on was supplied and costs no more than the gift.
 *  4. campaign: a different campaign was supplied and trustGaps() finds nothing wrong with it.
 *  5. share: always fits.
 *  6. fundraiser: last resort when share was declined.
 * null when every fitting action was declined.
 */
export const nextAction = ({ campaign, gift, donor, addOn, recommended }: NextInput): NextAction | null => {
    const committed = gift.freq !== "once" || !!donor?.recurring;
    const rules: (NextAction | false | undefined)[] = [
        !committed && gift.amount >= MONTHLY_FROM && { kind: "monthly", amount: suggestMonthly(gift.amount) },
        committed && { kind: "fundraiser" },
        addOn && addOn.amount > 0 && addOn.amount <= gift.amount && { kind: "addon", ...addOn },
        recommended && recommended.id !== campaign.id && !trustGaps(recommended.trust).length && { kind: "campaign", id: recommended.id, title: recommended.title },
        { kind: "share" },
        { kind: "fundraiser" },
    ];
    return rules.find((a): a is NextAction => !!a && !donor?.declined?.includes(a.kind)) ?? null;
};
