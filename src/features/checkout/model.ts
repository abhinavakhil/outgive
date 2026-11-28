/**
 * Checkout maths, shared by every layout. Plain functions over major currency units (pounds, dollars), rounded to pennies.
 * A host app describes its campaign as a CheckoutCampaign; nothing here knows about Outgive's data.
 */
import { nextFriday, nightCharges, nightPlan } from "../../../supabase/functions/nightly-charge/plan";
import type { Experiment } from "./experiments";

/**
 * "nights": one gift on each of the last ten nights of Ramadan, charged night by night from a saved payment method.
 * "weekly": Jumu'ah giving, every Friday (US; offered when the campaign's appeal is weekly).
 */
export type Freq = "once" | "monthly" | "yearly" | "weekly" | "nights";
export type Method = "card" | "dd" | "bank" | "wallet" | "apple" | "paypal";
export type Tone = "violet" | "coral" | "green" | "gold";

/**
 * An optional add-on. price "fee" means "cover the card fee", worked out from the gift. tribute opens the dedication fields.
 * giftAidEligible: true only when the add-on is a further donation with nothing given back (an extra gift to a fund).
 * Leave it off for anything bought or carrying a benefit (a ticket, merchandise, a raffle entry). Fee cover never counts.
 */
export interface Extra {
    id: string; name: string; desc?: string; price: number | "fee"; tone: Tone; icon: string; tribute?: boolean; giftAidEligible?: boolean;
    /** Priced per person or per day: price × the donor's count (Zakat al-Fitr per person, Fidya per missed fast). */
    unit?: { one: string; many: string; max: number };
    /** The fund this line is credited to, when it is not the gift's own (zakat_al_fitr, fidya). Kept on its own receipt line. */
    fund?: string;
}

/**
 * A match pledge from a named sponsor. It counts only while confirmed, up to the deadline and inside the caps;
 * the server must check the pot again when it takes the payment, because `remaining` here is a snapshot.
 */
export interface Match {
    sponsor: string;
    /** "pending" (promised, not signed off) never counts and should not be advertised as a live match. */
    status: "confirmed" | "pending";
    /** ISO date or date-time. A plain date ("2027-01-31") runs to the end of that day. */
    deadline: string;
    /** What is left of the sponsor's pot, in the campaign's currency. */
    remaining: number;
    /** The most the sponsor adds to any one gift. */
    perGiftMax?: number;
    /** Gifts below this are not matched. */
    minGift?: number;
    /** Sponsor's money per unit given: 1 doubles the gift (the default), 0.5 adds half. */
    ratio?: number;
}
/** The old shape. Still accepted so stored campaigns load, but it names no sponsor, so it is never counted: move to Match. */
export type LegacyMatch = { until: string };
export type MatchReason = "none" | "unconfirmed" | "expired" | "cap-reached" | "below-min";
export interface MatchResult {
    amount: number;
    /** Why nothing is matched; null when something is. */
    reason: MatchReason | null;
    /** Matched, but less than the full ratio because a cap cut it. */
    capped: boolean;
}

/** Who the donor is really paying, as checked by Outgive. Show a claim only when trustGaps() clears it. */
export interface Trust {
    legalName: string;
    regNo: string;
    /** "Charity Commission for England and Wales" */
    regulator: string;
    /** Checked against the regulator's register, and when (ISO). verified without verifiedAt counts as unverified. */
    verified: boolean;
    verifiedAt?: string;
    /** Receipts from this organisation can be used for tax relief in the donor's country. */
    taxReceipts: boolean;
    /** Where the money goes: the fund's name, and whether it is restricted to that purpose. */
    fund: { name: string; restricted: boolean };
}
export type TrustGap = "legalName" | "regNo" | "regulator" | "verified" | "fund";

export interface CheckoutCampaign {
    id: string;
    /** "Keep Marsh Lane Youth Club open this winter" */
    title: string;
    /** Who runs it: "Marsh Lane Community Trust". */
    charity: string;
    /** Short name for who benefits, used in sentences: "the club". */
    beneficiary: string;
    raised: number;
    goal: number;
    currency: string;
    locale?: string;
    presets: number[];
    /** UK Gift Aid: +25% from HMRC for UK taxpayers. Off for other countries. */
    giftAid?: boolean;
    /** A sponsor's match pledge. See matchFor() for when it counts. */
    match?: Match | LegacyMatch | null;
    /** Where the gift can go, first is the default: [id, label, in-a-sentence]. */
    funds?: [string, string, string][];
    extras?: Extra[];
    /** Impact lines from the charity, highest threshold first: [from amount, line]. */
    impact?: [number, string][];
    /** @deprecated use trust.regNo, and show it only when trustGaps() says it is verified. */
    charityNo?: string;
    trust?: Trust;
    /**
     * Which ways to pay are switched on, from the organisation's connected providers (Stripe: card, wallets, bank, dd; PayPal: paypal).
     * Leave out to offer everything (the sample). All false: the checkout says it cannot take payments yet.
     */
    payments?: PayConfig;
    /** Card fee estimate: rate and fixed part (major units), for "cover the fee". */
    fee?: { rate: number; fixed: number };
    /** US: dollars, EIN and tax-deductible wording, no Gift Aid, no PayPal. Unset: worked out from the currency (regionOf). */
    region?: "US" | "UK";
    /** The add-ons the charity switched on in the checkout builder (us.ts ADDONS). Unset on UK campaigns, which use `extras` as they are. */
    addons?: string[];
    /** The charity pre-ticks "cover the fees". It is then always shown, never hidden. */
    coverDefault?: boolean;
    /** The last-ten-nights schedule: the ISO date of night 21's evening (moves with the moon sighting). */
    nights?: { start: string };
    /** Amount buttons for a fund that needs its own (Zakat gifts run larger). */
    fundPresets?: Record<string, number[]>;
    /** A fund priced per person or per day (Zakat al-Fitr, Fidya): the amount is price × count. */
    perUnitFunds?: Record<string, { price: number; one: string; many: string; max: number }>;
    /** "Round up to a milestone": the appeal's milestones come every `step` (a table's goal, say), named in `label`. */
    milestone?: { step: number; label: string };
    /** For "give from my donor-advised fund": the charity's mailing address and any note for the DAF sponsor. */
    daf?: { address: string; note?: string };
    /** The appeal is weekly (Jumu'ah): offer "Every Friday" (Appeal.weekly on the bio page's appeals). US only. */
    weekly?: boolean;
    /** The organisation's running A/B test of ask amounts or layouts (experiments.ts). The checkout picks a sticky variant. */
    experiment?: Experiment | null;
}

export const FREQS: Freq[] = ["once", "monthly", "yearly"];
export const FREQ_LABEL: Record<Freq, { short: string; line: string; every: string; sentence: string }> = {
    once: { short: "One-off", line: "One-off gift", every: "", sentence: "once" },
    monthly: { short: "Monthly", line: "Every month", every: "every month", sentence: "every month" },
    yearly: { short: "Yearly", line: "Every year", every: "every year", sentence: "every year" },
    weekly: { short: "Fridays", line: "Every Friday", every: "every Friday", sentence: "every Friday" },
    nights: { short: "Last ten nights", line: "Each of the last ten nights", every: "each night", sentence: "on each of the last ten nights" },
};
export const METHOD_NAME: Record<Method, string> = { card: "Card", dd: "Direct Debit", bank: "Pay by bank", wallet: "Apple Pay", apple: "Apple Pay", paypal: "PayPal" };
/** "bank" is ACH bank debit in the US, pay by bank in the UK. */
export const methodName = (m: Method, us: boolean) => (us && m === "bank" ? "Bank debit" : METHOD_NAME[m]);

export const MIN = 2, MAX = 10000;
/** The dial runs DIAL_MIN..DIAL_MAX in steps of 5; typing reaches anything MIN..MAX. */
export const DIAL_MIN = 5, DIAL_MAX = 500;

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const clampAmount = (v: unknown) => Math.max(MIN, Math.min(MAX, Math.round(Number(v) || MIN)));

export const money = (n: number, currency: string, locale = "en-GB") => {
    const r = round2(n);
    return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2 }).format(r);
};

const feeOf = (c: Pick<CheckoutCampaign, "fee">) => ({ rate: c.fee?.rate ?? 0.015, fixed: Math.round((c.fee?.fixed ?? 0.2) * 100) });
/** What covers the processor's fee on a charge of `amount`, so the charity nets all of it: (A + f) / (1 − p) − A, rounded up to the cent. */
export const feeFor = (amount: number, c: Pick<CheckoutCampaign, "fee">) => {
    const f = feeOf(c), cents = Math.round(amount * 100);
    return cents > 0 ? Math.ceil((cents + f.fixed) / (1 - f.rate) - cents - 1e-9) / 100 : 0;
};
export const regionOf = (c: Pick<CheckoutCampaign, "region" | "currency">): "US" | "UK" => c.region ?? (c.currency === "USD" ? "US" : "UK");

/** 0..1 around the dial for an amount. */
export const dialRatio = (amount: number) => Math.min(1, Math.max(0, (amount - DIAL_MIN) / (DIAL_MAX - DIAL_MIN)));
/** The amount at an angle: ratio 0..1 snapped to 5s. */
export const dialAmount = (ratio: number) => clampAmount(Math.round((DIAL_MIN + ratio * (DIAL_MAX - DIAL_MIN)) / 5) * 5);
/**
 * The ratio under the pointer, given its offset from the dial's centre. While dragging, crossing the top from either side
 * pins to the end instead of jumping from max to min.
 */
export const ratioAt = (dx: number, dy: number, prevAmount: number, dragging: boolean) => {
    let r = ((Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
    const prev = dialRatio(prevAmount);
    if (dragging && prev > 0.8 && r < 0.2) r = 1;
    if (dragging && prev < 0.2 && r > 0.8) r = 0;
    return r;
};

/** The next charge: same day next month or year, or the month's last day when it is shorter (31 Jan → 28 Feb, not 3 Mar). */
export const nextDate = (freq: Freq, from = new Date()) => {
    // Weekly: the next Friday after today (a gift made on a Friday is this Friday's), at noon local time for display.
    if (freq === "weekly") { const [y, m, dd] = nextFriday(from).split("-").map(Number); return new Date(y, m - 1, dd, 12); }
    const d = new Date(from), day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + (freq === "monthly" ? 1 : freq === "yearly" ? 12 : 0));
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return d;
};

export const impactFor = (amount: number, c: Pick<CheckoutCampaign, "impact">) => c.impact?.find(([from]) => amount >= from)?.[1] ?? "";

/** A monthly upsell after a one-off gift: about 30% of it, in 5s, between 5 and 50. */
export const suggestMonthly = (amount: number) => Math.max(5, Math.min(50, Math.round((amount * 0.3) / 5) * 5));

/** HMRC adds 25p for every £1 donated (basic-rate tax on the gift). */
export const GIFT_AID_RATE = 0.25;

/** When a match pledge stops counting. An unreadable date gives an invalid Date, which matchFor treats as passed. */
export const matchEnds = (m: Pick<Match, "deadline">) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(m.deadline) ? `${m.deadline}T23:59:59.999` : m.deadline);

/** What the sponsor adds to a gift of `amount` right now, and why if it is nothing. Only the gift is matched, not extras or the fee. */
export const matchFor = (m: CheckoutCampaign["match"], amount: number, now = new Date()): MatchResult => {
    const no = (reason: MatchReason): MatchResult => ({ amount: 0, reason, capped: false });
    if (!m) return no("none");
    if (!("status" in m) || m.status !== "confirmed") return no("unconfirmed");
    if (!(now.getTime() <= matchEnds(m).getTime())) return no("expired");
    if (!(m.remaining > 0)) return no("cap-reached");
    if (amount < (m.minGift ?? 0)) return no("below-min");
    const full = round2(amount * (m.ratio ?? 1)), got = round2(Math.max(0, Math.min(full, m.remaining, m.perGiftMax ?? Infinity)));
    return { amount: got, reason: got > 0 ? null : "cap-reached", capped: got > 0 && got < full };
};

const PLACEHOLDER = /^\s*(\[.*\])?\s*$/;
/** What is missing, a "[placeholder]", or unverified in a campaign's trust details. Empty means every claim can be shown. */
export const trustGaps = (t?: Trust | null): TrustGap[] => {
    if (!t) return ["legalName", "regNo", "regulator", "verified", "fund"];
    const gaps: TrustGap[] = (["legalName", "regNo", "regulator"] as const).filter((k) => PLACEHOLDER.test(t[k] ?? ""));
    if (!t.verified || !t.verifiedAt || Number.isNaN(Date.parse(t.verifiedAt))) gaps.push("verified");
    if (PLACEHOLDER.test(t.fund?.name ?? "")) gaps.push("fund");
    return gaps;
};

/**
 * The trust claims that may be shown to a donor, or null when the organisation is not verified (then show none of them).
 * Each claim is there only when trustGaps() clears it; the registration needs both its number and its regulator.
 */
export const trustClaims = (t?: Trust | null) => {
    const gaps = trustGaps(t);
    if (!t || gaps.includes("verified")) return null;
    const has = (k: TrustGap) => !gaps.includes(k);
    return {
        legalName: has("legalName") ? t.legalName.trim() : "",
        registration: has("regNo") && has("regulator") ? { regNo: t.regNo.trim(), regulator: t.regulator.trim() } : null,
        fund: has("fund") ? { name: t.fund.name.trim(), restricted: !!t.fund.restricted } : null,
        taxReceipts: !!t.taxReceipts,
        verifiedAt: new Date(t.verifiedAt!),
    };
};
export type TrustClaims = NonNullable<ReturnType<typeof trustClaims>>;

/** The sponsor's name for the donor, or "" when it is missing or still a "[placeholder]" (then say "a sponsor"). */
export const sponsorName = (m: CheckoutCampaign["match"]) => (m && "sponsor" in m && !PLACEHOLDER.test(m.sponsor ?? "") ? m.sponsor.trim() : "");

export interface QuoteLine {
    key: string;
    label: string;
    value: number;
    /** "recurring" is charged again with every regular payment; "once" is charged today only. */
    when: "once" | "recurring";
    /** Gift Aid HMRC adds on this line: 0 when Gift Aid is off or the line is not a donation (fee cover, purchases). */
    giftAid: number;
}
export interface Quote {
    fee: number;
    /** One-off extras (meal, kit), charged once even on a regular gift. */
    oneOff: number;
    /** What repeats: the gift plus a covered fee. */
    recur: number;
    /** What the donor pays today. */
    total: number;
    /** Gift Aid on today's payment: the sum of the lines' giftAid. */
    giftAid: number;
    /** What the sponsor adds to today's gift. matchReason says why when it is 0. */
    match: number;
    matchReason: MatchReason | null;
    matchCapped: boolean;
    /** What the charity gets from this gift: gift, extras, Gift Aid and match (not the covered fee, which goes to the processor). */
    receives: number;
    /** Everything charged today, each marked once or recurring. */
    lines: QuoteLine[];
    /** Charged now: the same lines and total, named for the summary. */
    today: { lines: QuoteLine[]; total: number };
    /** Each later payment of a regular gift, with its Gift Aid and first date; null for a one-off. Later payments are not matched here. */
    later: { lines: QuoteLine[]; total: number; giftAid: number; next: Date } | null;
    /** The last-ten-nights schedule: nothing is charged today, each night is charged on its own. `total` above is the whole schedule. */
    nights: { units: number; charges: { night: number; date: string; due: string; units: number; total: number }[] } | null;
}
export interface QuoteState { amount: number; freq: Freq; picks: Record<string, boolean>; ga: boolean; counts?: Record<string, number>; odd?: boolean; round?: number; fund?: string }
/** The donor's count for a per-unit extra, kept between 1 and its maximum. */
export const countOf = (x: Pick<Extra, "id" | "unit">, counts?: Record<string, number>) => Math.max(1, Math.min(x.unit?.max ?? 1, Math.round(counts?.[x.id] ?? 1)));
const sum = (ls: QuoteLine[], k: "value" | "giftAid") => round2(ls.reduce((t, l) => t + l[k], 0));
/**
 * Everything the donor is charged, line by line. Each add-on, Zakat al-Fitr, Fidya, a round-up and the covered fee is a line of its own,
 * so a Zakat amount is never blended with anything else. On a one-off gift the fee covers the whole charge; on a regular gift it covers
 * the repeating gift; on the ten nights each night's charge covers its own fee.
 */
export const quote = (s: QuoteState, c: CheckoutCampaign, now = new Date()): Quote => {
    const regular = s.freq === "monthly" || s.freq === "yearly" || s.freq === "weekly", ga = !!c.giftAid && s.ga, us = regionOf(c) === "US";
    const plan = s.freq === "nights" ? nightPlan(c.nights?.start, !!s.odd, now) : null;
    const units = plan?.reduce((t, n) => t + n.units, 0) ?? 1, gift = round2(s.amount * units);
    const line = (key: string, label: string, value: number, repeats: boolean, donation: boolean): QuoteLine =>
        ({ key, label, value, when: repeats && regular ? "recurring" : "once", giftAid: ga && donation ? round2(value * GIFT_AID_RATE) : 0 });
    const fundName = us && s.fund ? c.funds?.find(([id]) => id === s.fund)?.[1] : "";
    const giftLabel = fundName ? `${fundName}${plan ? `, ${plan.length} nights${s.odd ? ", double on odd nights" : ""}` : regular ? `, ${FREQ_LABEL[s.freq].every}` : ""}` : `${FREQ_LABEL[s.freq].short} gift`;
    const lines = [line("gift", giftLabel, gift, true, true)];
    let wantCover = false;
    for (const x of c.extras ?? []) {
        if (!s.picks[x.id] || x.tribute) continue;
        if (x.price === "fee") { wantCover = true; continue; }
        const n = countOf(x, s.counts), name = x.name.replace(/^Add an? /, "").replace(/^./, (m) => m.toUpperCase());
        lines.push(line(x.id, x.unit ? `${name}, ${n} ${n === 1 ? x.unit.one : x.unit.many}` : name, round2(x.price * n), false, !!x.giftAidEligible));
    }
    if (s.round && s.round > 0) lines.push(line("round", "Round up", round2(s.round), false, true));
    const extras = round2(lines.slice(1).reduce((t, l) => t + l.value, 0));
    const charges = plan ? nightCharges(Math.round(s.amount * 100), plan, Math.round(extras * 100), true, feeOf(c)) : null;
    const fee = charges ? charges.reduce((t, n) => t + n.cover, 0) / 100 : feeFor(regular ? s.amount : s.amount + extras, c);
    const cover = wantCover ? fee : 0;
    if (cover) lines.push(line("fee", us ? "Cover the fees" : "Card fee", cover, true, false));
    const again = lines.filter((l) => l.when === "recurring");
    const total = sum(lines, "value"), recur = plan ? s.amount : round2(s.amount + cover), oneOff = round2(total - recur), giftAid = sum(lines, "giftAid");
    const m = matchFor(c.match, gift, now);
    return {
        fee, oneOff, recur, total, giftAid, match: m.amount, matchReason: m.reason, matchCapped: m.capped,
        receives: round2(total - cover + giftAid + m.amount), lines, today: plan ? { lines: [], total: 0 } : { lines, total },
        later: regular ? { lines: again, total: sum(again, "value"), giftAid: sum(again, "giftAid"), next: nextDate(s.freq, now) } : null,
        nights: charges ? { units, charges: charges.map((n) => ({ night: n.night, date: n.date, due: n.due, units: n.units, total: (wantCover ? n.total : n.total - n.cover) / 100 })) } : null,
    };
};

export type PayKey = "card" | "wallets" | "bank" | "dd" | "paypal";
export type PayConfig = Partial<Record<PayKey, boolean>>;
/** The setting each method depends on. */
export const PAY_KEY: Record<Method, PayKey> = { card: "card", apple: "wallets", wallet: "wallets", bank: "bank", dd: "dd", paypal: "paypal" };
export const allows = (pay: PayConfig | undefined, k: PayKey) => !pay || !!pay[k];

/** Payment methods offered: Direct Debit only makes sense for regular gifts, pay-by-bank only for one-off; then only what the charity has switched on. */
export const methodsFor = (freq: Freq, layout: string, pay?: PayConfig, us?: { bank: boolean }): Method[] => {
    // US: card (Apple Pay and Google Pay ride on it) and, from the bank add-on, ACH bank debit. No PayPal, no Direct Debit.
    if (us) return (["card", ...(us.bank ? ["bank" as const] : [])] as Method[]).filter((m) => allows(pay, PAY_KEY[m]));
    const regular = freq !== "once";
    const all: Method[] = layout === "ticket" ? ["apple", "card", regular ? "dd" : "bank", "paypal"]
        : layout === "pledge" ? (regular ? ["dd", "card", "wallet"] : ["card", "bank", "wallet"])
        : regular ? ["dd", "card"] : ["card", "bank"];
    return all.filter((m) => allows(pay, PAY_KEY[m]));
};

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

/** Line icons (24px, stroke) for the sample extras. */
export const ICONS = {
    card: "M3 6.5h18v11H3zM3 10.5h18",
    meal: "M4 11h16a8 8 0 01-16 0zM9 7.5c0-1.5 1-1.5 1-3M14 7.5c0-1.5 1-1.5 1-3",
    ball: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
    heart: "M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z",
};

/** The designs' sample campaign. Every figure is a placeholder for the charity to replace. */
export const SAMPLE: CheckoutCampaign = {
    id: "sample",
    title: "Keep Marsh Lane Youth Club open this winter",
    charity: "Marsh Lane Community Trust",
    beneficiary: "the club",
    raised: 27200, goal: 40000, currency: "GBP", locale: "en-GB",
    presets: [10, 25, 50, 100],
    giftAid: true,
    match: { sponsor: "[Sponsor name]", status: "confirmed", deadline: "2027-01-31", remaining: 5000, perGiftMax: 250, ratio: 1 },
    funds: [["most", "Most needed", "wherever it’s needed most"], ["heat", "Heating and rent", "heating and rent"], ["staff", "Youth workers", "the youth workers"], ["food", "Kitchen", "the kitchen"]],
    extras: [
        { id: "cover", name: "Cover the card fee", desc: "The club keeps your full gift", price: "fee", tone: "violet", icon: ICONS.card },
        { id: "meal", name: "Add a hot meal", desc: "One-off, for the kitchen fund", price: 3, tone: "coral", icon: ICONS.meal, giftAidEligible: true },
        { id: "kit", name: "Add a sports kit", desc: "One-off, for footballs and bibs", price: 5, tone: "green", icon: ICONS.ball, giftAidEligible: true },
        { id: "tribute", name: "Dedicate this gift", desc: "In honour or in memory, with an e-card", price: 0, tone: "gold", icon: ICONS.heart, tribute: true },
    ],
    impact: [[100, "a full week of sessions for one young person"], [50, "a youth worker for one evening"], [25, "heating for one evening session"], [10, "a hot meal for five young people"], [0, "part of an evening’s heating"]],
    trust: { legalName: "[Charity legal name]", regNo: "[Registration number]", regulator: "Charity Commission for England and Wales", verified: false, taxReceipts: true, fund: { name: "[Fund name]", restricted: false } },
};

/** Card helpers, only for the form's look and checks; the card itself is taken by the payment provider. */
export type Brand = "visa" | "mastercard" | "amex" | "";
export const cardBrand = (d: string): Brand => /^4/.test(d) ? "visa" : /^(5[1-5]|2[2-7])/.test(d) ? "mastercard" : /^3[47]/.test(d) ? "amex" : "";
export const cardLength = (b: Brand) => (b === "amex" ? 15 : 16);
/** 4-4-4-4, or 4-6-5 for Amex. */
export const formatCard = (d: string) => (cardBrand(d) === "amex" ? [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)] : d.match(/.{1,4}/g) ?? []).filter(Boolean).join(" ");
export const luhn = (d: string) => {
    let sum = 0;
    for (let i = 0; i < d.length; i++) { let n = Number(d[d.length - 1 - i]); if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; }
    return d.length > 11 && sum % 10 === 0;
};
/** MMYY digits → valid and not in the past. */
export const expiryOk = (e: string, now = new Date()) => {
    if (e.length !== 4) return false;
    const m = Number(e.slice(0, 2)), y = 2000 + Number(e.slice(2));
    return m >= 1 && m <= 12 && (y > now.getFullYear() || (y === now.getFullYear() && m >= now.getMonth() + 1));
};

export const sortCodeOk = (d: string) => /^\d{6}$/.test(d);
export const accountOk = (d: string) => /^\d{8}$/.test(d);

/** What is wrong with the payment details for a method, in the donor's words, or "" when they are complete. */
export const payProblem = (m: Method, s: { card: string; exp: string; cvc: string; holder: string; bank: string; ddName: string; sort: string; acct: string }): { field: string; msg: string } | null => {
    if (m === "card") {
        const b = cardBrand(s.card);
        if (s.card.length < cardLength(b) || !luhn(s.card)) return { field: "card", msg: "Check your card number. It doesn’t look complete." };
        if (!expiryOk(s.exp)) return { field: "exp", msg: s.exp.length < 4 ? "Add your card’s expiry date." : "That card has expired. Check the expiry date." };
        if (s.cvc.length !== (b === "amex" ? 4 : 3)) return { field: "cvc", msg: `Add the ${b === "amex" ? 4 : 3}-digit security code.` };
        if (s.holder.trim().length < 2) return { field: "holder", msg: "Add the name on the card." };
    }
    if (m === "dd") {
        if (s.ddName.trim().length < 2) return { field: "ddName", msg: "Add the account holder’s name." };
        if (!sortCodeOk(s.sort)) return { field: "sort", msg: "A sort code is 6 digits, like 12-34-56." };
        if (!accountOk(s.acct)) return { field: "acct", msg: "An account number is 8 digits." };
    }
    if (m === "bank" && !s.bank) return { field: "bank", msg: "Choose your bank." };
    return null;
};

/**
 * The sample campaign, shaped by the home page's "describe your appeal" box: ?appeal= becomes the title,
 * and ?giftaid=0 / ?match=0 switch those off. Anything longer than a headline is cut.
 */
export const sampleFrom = (search: string): CheckoutCampaign => {
    const q = new URLSearchParams(search), appeal = (q.get("appeal") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const noGa = q.get("giftaid") === "0", noMatch = q.get("match") === "0";
    if (!appeal && !noGa && !noMatch) return SAMPLE; // nothing to change: the sample itself
    return { ...SAMPLE, ...(appeal && { title: appeal }), ...(noGa && { giftAid: false }), ...(noMatch && { match: null }) };
};
