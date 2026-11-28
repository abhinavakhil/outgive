// Card-testing rules: given a charity's limits and what this IP and card did lately, allow, challenge or block one gift attempt.
// Pure and import-free, so the pay guard (guard.ts, Deno) and the Engage screens (src/features/engage/compliance, vitest) share it.
// Mirrors the fraud_settings table (supabase/migrations/20261128200000_receipts_ein_fraud.sql).

export interface FraudSettings {
    /** Smallest gift, in cents. Card testers use tiny amounts. */
    min_cents: number;
    /** Gift attempts allowed per IP in 10 minutes. */
    ip_per_10min: number;
    /** Attempts allowed per card in an hour (needs the card's fingerprint; Radar enforces it too). */
    card_per_hour: number;
    /** Declines from this IP in the last hour before the next try must pass a challenge (Turnstile). 0 turns challenges off. */
    challenge_after: number;
    block_disposable: boolean;
    /** Declines across the charity in 10 minutes that raise a burst alert. */
    decline_alert: number;
    /** Reminder shown on the screen: Radar must be on for the connected account (destination charges use the platform's Radar, direct charges the charity's). */
    radar: boolean;
}
export const DEFAULT_FRAUD: FraudSettings = { min_cents: 500, ip_per_10min: 5, card_per_hour: 3, challenge_after: 2, block_disposable: true, decline_alert: 10, radar: true };

/** A row of fraud_events, as much as the rules need. */
export interface FraudEvent { kind: "attempt" | "block" | "decline" | "challenge" | "alert"; at: string; attempt_key?: string | null; ip_hash?: string | null; card_fp?: string | null }

export type Reason = "below_minimum" | "disposable_email" | "ip_rate" | "card_rate" | "challenge_failed";
export type Verdict = { action: "allow" } | { action: "challenge" } | { action: "block"; reason: Reason };

export interface Attempt { amount_cents: number; email?: string | null; ip_hash?: string | null; card_fp?: string | null; attempt_key: string; now: Date | string }

/** In the donor's words, for the pay function's refusal. */
export const REASON_TEXT: Record<Reason, string> = {
    below_minimum: "The smallest gift here is higher. Choose a larger amount.",
    disposable_email: "Please use an email address you keep, so your receipt reaches you.",
    ip_rate: "Too many tries in a short time. Wait ten minutes and try again.",
    card_rate: "This card has been tried too many times. Wait an hour or use another card.",
    challenge_failed: "We could not confirm you are not a robot. Try again.",
};
/** For the blocked log on the Engage screen. */
export const REASON_LABEL: Record<Reason, string> = {
    below_minimum: "Under the minimum gift", disposable_email: "Disposable email", ip_rate: "Same IP, too many attempts",
    card_rate: "Same card, too many attempts", challenge_failed: "Challenge failed",
};

// ponytail: a short list of the big throwaway-mail domains; swap for the disposable-email-domains list (~4k domains) if testers get past it.
export const DISPOSABLE = new Set(["mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "grr.la", "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmailo.com", "yopmail.com", "yopmail.net", "trashmail.com", "trashmail.de", "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "mintemail.com", "mohmal.com", "emailondeck.com", "burnermail.io", "mailnesia.com", "spamgourmet.com", "tempr.email", "discard.email", "moakt.com", "1secmail.com", "emailfake.com", "mail.tm", "mailpoof.com", "inboxkitten.com"]);
export const isDisposable = (email?: string | null) => {
    const d = (email ?? "").trim().toLowerCase().split("@")[1];
    return !!d && (DISPOSABLE.has(d) || [...DISPOSABLE].some((x) => d.endsWith(`.${x}`)));
};

const within = (e: FraudEvent, now: number, ms: number) => now - new Date(e.at).getTime() <= ms;
/** Distinct attempts: a retried request with the same attempt_key is one attempt. */
const attempts = (events: FraudEvent[]) => new Set(events.filter((e) => e.kind === "attempt" || e.kind === "block").map((e) => e.attempt_key ?? e.at)).size;

/**
 * The verdict for one attempt. `recent` is this IP's and card's events from the last hour (any charity: testers hop between forms).
 * `challenge` is the result of verifying the donor's challenge token: undefined when none was sent.
 * The attempt itself is not in `recent`; limits are "N allowed", so the N+1th is blocked.
 */
export const evaluate = (s: FraudSettings, a: Attempt, recent: FraudEvent[], challenge?: boolean): Verdict => {
    const now = new Date(a.now).getTime();
    if (a.amount_cents < s.min_cents) return { action: "block", reason: "below_minimum" };
    if (s.block_disposable && isDisposable(a.email)) return { action: "block", reason: "disposable_email" };
    const others = recent.filter((e) => e.attempt_key !== a.attempt_key);
    const ip = a.ip_hash ? others.filter((e) => e.ip_hash === a.ip_hash) : [];
    if (attempts(ip.filter((e) => within(e, now, 10 * 60_000))) >= s.ip_per_10min) return { action: "block", reason: "ip_rate" };
    const card = a.card_fp ? others.filter((e) => e.card_fp === a.card_fp && within(e, now, 3600_000)) : [];
    if (attempts(card) >= s.card_per_hour) return { action: "block", reason: "card_rate" };
    const declines = (a.ip_hash ? recent.filter((e) => e.ip_hash === a.ip_hash) : []).filter((e) => e.kind === "decline" && within(e, now, 3600_000)).length;
    if (s.challenge_after > 0 && declines >= s.challenge_after) {
        if (challenge === undefined) return { action: "challenge" };
        if (!challenge) return { action: "block", reason: "challenge_failed" };
    }
    return { action: "allow" };
};

