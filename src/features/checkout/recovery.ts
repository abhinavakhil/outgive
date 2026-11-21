/**
 * Abandonment recovery: an unfinished gift is kept in this browser so the donor can pick it up again, and, only if they
 * ticked the opt-in, on the server so a link to it can be emailed (checkout_recoveries in the donor_self_service migration).
 * A draft holds what the donor chose and how to greet them. It never holds card or bank details, a postcode or an address.
 */
import { pathOf } from "@/shared/lib/route";
import { EMAIL } from "./model";

export const DRAFT_TTL = 7 * 86400000;
const KEY = "outgive.checkout.draft.";

export interface Draft {
    /** Also the resume token in the emailed link. */
    id: string; campaign: string; savedAt: number;
    /** The donor ticked "email me a link to finish this gift". */
    consent: boolean;
    amount: number; freq: string; extras: string[]; fund: string; ga: boolean; first: string; email: string; step: number;
}
/** The slice of the checkout state a draft is made from; CheckoutState fits it. `recover` is the opt-in checkbox. */
export interface DraftSource { step: number; amount: number; freq: string; picks: Record<string, boolean>; fund: string; ga: boolean; first: string; email: string; recover?: boolean }
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const local = (): Store | null => { try { return window.localStorage; } catch { return null; } };
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

/** Picks the fields a draft may hold, one by one, so nothing sensitive in the state can ride along. Keeps the id of an earlier draft. */
export const toDraft = (campaign: string, s: DraftSource, prev?: Draft | null, now = Date.now()): Draft => ({
    id: prev?.id ?? newId(), campaign, savedAt: now, consent: !!s.recover,
    amount: s.amount, freq: s.freq, extras: Object.keys(s.picks).filter((k) => s.picks[k]), fund: s.fund, ga: s.ga,
    first: s.first.trim().slice(0, 80), email: s.email.trim(), step: s.step,
});

/** The state to merge back in. Lands on the details step at most: the rest of the details and the payment are typed again. */
export const fromDraft = (d: Draft) => ({
    amount: d.amount, amountText: String(d.amount), amountSource: "resumed", freq: d.freq, picks: Object.fromEntries(d.extras.map((k) => [k, true])) as Record<string, boolean>,
    fund: d.fund, ga: d.ga, first: d.first, email: d.email, recover: d.consent, step: Math.max(0, Math.min(2, d.step)),
});

export const expired = (d: Pick<Draft, "savedAt">, now = Date.now()) => now - d.savedAt > DRAFT_TTL;

/** This browser's draft for a campaign, or null. Out-of-date drafts are deleted; with an id (from a resume link) it must match. */
export const loadDraft = (campaign: string, id?: string | null, store: Store | null = local(), now = Date.now()): Draft | null => {
    try {
        const d = JSON.parse(store?.getItem(KEY + campaign) ?? "null") as Draft | null;
        if (!d || typeof d.id !== "string" || !(d.amount > 0)) return null;
        if (expired(d, now)) { store?.removeItem(KEY + campaign); return null; }
        return id && id !== d.id ? null : d;
    } catch { return null; }
};

/** Saves the draft for a campaign and returns it. Skips the thank-you step: a finished gift has nothing to recover. */
export const saveDraft = (campaign: string, s: DraftSource, store: Store | null = local(), now = Date.now()): Draft | null => {
    if (s.step >= 4) return null;
    const d = toDraft(campaign, s, loadDraft(campaign, null, store, now), now);
    try { store?.setItem(KEY + campaign, JSON.stringify(d)); } catch { /* storage full or blocked: the checkout still works */ }
    return d;
};
/** Keeps a draft as it is, id included: one fetched from the server for a resume link opened in another browser. */
export const keepDraft = (d: Draft, store: Store | null = local()) => { try { store?.setItem(KEY + d.campaign, JSON.stringify(d)); } catch { /* blocked */ } };
export const clearDraft = (campaign: string, store: Store | null = local()) => { try { store?.removeItem(KEY + campaign); } catch { /* blocked */ } };

/**
 * The link that reopens a draft. Campaign keys as the checkout uses them: "sample", "org/<slug>", or a create-flow page "f/<slug>".
 * A host embedding the checkout elsewhere passes its own page as `page`; the link is that page with ?resume=.
 */
export const resumeLink = (campaignKey: string, draftId: string, origin = window.location.origin, page?: string): string => {
    const org = campaignKey.match(/^org\/([a-z0-9-]+)$/)?.[1];
    const u = new URL(page ?? (org ? pathOf({ name: "checkout", org }, { slug: null, host: null }) : "/checkout"), origin);
    if (!page && !org && campaignKey !== "sample") u.searchParams.set("campaign", campaignKey);
    u.searchParams.set("resume", draftId);
    return u.toString();
};
/** The draft id in a resume link, if this address is one. */
export const resumeId = (search = window.location.search) => new URLSearchParams(search).get("resume");

/** A recovery email may go out only with the explicit opt-in, a usable address, and a draft that is unfinished and in date. */
export const canEmailRecovery = (d: Draft | null | undefined, now = Date.now()): d is Draft => !!d && d.consent === true && EMAIL.test(d.email) && d.step < 4 && !expired(d, now);

/** Arguments for the checkout_recovery_save rpc, or null when the donor has not agreed to an email. */
export const recoveryRequest = (d: Draft | null | undefined, now = Date.now()) =>
    canEmailRecovery(d, now) ? { p: { token: d.id, email: d.email, campaign: d.campaign, consent: true, draft: { amount: d.amount, freq: d.freq, extras: d.extras, fund: d.fund, ga: d.ga, first: d.first, step: d.step } } } : null;

/** A draft from the server's answer to checkout_recovery_get, for a resume link opened in another browser. */
export const fromServer = (id: string, r: { campaign: string; email: string; draft: Partial<Draft>; created_at: string } | null): Draft | null =>
    r && Number(r.draft.amount) > 0 ? { id, campaign: r.campaign, savedAt: new Date(r.created_at).getTime(), consent: true, amount: Number(r.draft.amount), freq: r.draft.freq ?? "once", extras: r.draft.extras ?? [], fund: r.draft.fund ?? "", ga: !!r.draft.ga, first: r.draft.first ?? "", email: r.email, step: r.draft.step ?? 0 } : null;
