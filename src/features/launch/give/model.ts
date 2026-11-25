/**
 * The Ramadan donate flow's menu and maths (/ramadhan/give). Plain functions, pounds rounded to pennies.
 * A basket of items (qty × unit price) is given on each chosen night; "once" items are charged a single time today.
 */
import type { BioPage } from "../bio/model";

export const NIGHTS = 30;
export type Mode = "30" | "10" | "odd" | "pick" | "once" | "fri";
export const MODES: [Mode, string, string][] = [
    ["30", "All 30 nights", "Every night of Ramadan"],
    ["10", "Last 10 nights", "Nights 21 to 30, to catch Laylat al-Qadr"],
    ["odd", "Odd nights", "21, 23, 25, 27 and 29"],
    ["pick", "Pick nights", "Choose any nights"],
    ["fri", "Fridays", "Every Jumu’ah of Ramadan"],
    ["once", "Give once", "A single gift today"],
];

export type Item = {
    id: string; title: string; note: string; price: number; per: string; art: string;
    section: "campaigns" | "causes" | "obligations";
    /** Charged once today, never per night (Zakat al-Fitr, Fidya). */
    once?: boolean; tag?: string; zakat?: boolean;
};

/** What one unit of each cause buys on a night, keyed by the cause's illustration. */
const NIGHTLY: Record<string, [number, string, string?]> = {
    zakat: [10, "per night", "Zakat-eligible"], water: [5, "a person's clean water", "Most given"], emergency: [10, "a hygiene kit"],
    shelter: [25, "towards a room"], food: [4, "an iftar meal", "Most given"], orphans: [5, "a day's care for a child"],
    education: [3, "a school day"], health: [5, "a check-up"],
};
/** One-off duties and gifts, offered on the menu and again as add-ons in the basket. */
export const OBLIGATIONS: Item[] = [
    { id: "fitr", title: "Zakat al-Fitr", note: "Due before Eid prayer, for each person in your home", price: 5, per: "a person", art: "food", section: "obligations", once: true, tag: "Due before Eid" },
    { id: "fidya", title: "Fidya", note: "For each fast you can't keep and won't make up", price: 5, per: "a fast", art: "food", section: "obligations", once: true },
    { id: "eid", title: "Eid gift for an orphan", note: "A new outfit and a gift on Eid morning", price: 25, per: "a child", art: "orphans", section: "obligations", once: true },
];

export const menuFrom = (page: BioPage): Item[] => [
    ...page.campaigns.map((c): Item => ({ id: c.id, title: c.title, note: c.text, price: c.price ?? 10, per: c.per ?? "per night", art: c.illo ?? "health", section: "campaigns", tag: c.tag })),
    ...page.causes.map((c): Item => { const [price, per, tag] = NIGHTLY[c.icon] ?? [5, "per night"]; return { id: c.id, title: c.title, note: c.note, price, per, art: c.icon, section: "causes", tag, zakat: c.icon === "zakat" }; }),
    ...OBLIGATIONS,
];

/** The nights a mode gives on. */
/** Nights that fall on a Friday, given the date of night 1 (ISO). */
export const fridaysFrom = (startIso: string) => range(1, NIGHTS).filter((n) => new Date(Date.parse(startIso) + (n - 1) * 86400000).getUTCDay() === 5);

/** The nights a mode gives on ("fri" needs the Fridays, from fridaysFrom). */
export const nightsFor = (mode: Mode, picked: number[], fridays: number[] = []): number[] =>
    mode === "fri" ? fridays : mode === "30" ? range(1, NIGHTS) : mode === "10" ? range(21, NIGHTS) : mode === "odd" ? [21, 23, 25, 27, 29] : mode === "pick" ? [...new Set(picked)].filter((n) => n >= 1 && n <= NIGHTS).sort((a, b) => a - b) : [];
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Extra on each of the last ten nights: any amount, or "double" to give the night's basket twice. */
export type Boost = number | "double";
export type Choice = {
    qty: Record<string, number>; mode: Mode; picked: number[]; boost: Boost;
    /** Round each night's gift up to the next £5. */
    roundUp: boolean; cover: boolean; giftAid: boolean;
    /** Voluntary support for Outgive, per charge. */
    tip: number;
    /** Percent more on night 27 (0 to 100), the likeliest Laylat al-Qadr. */
    qadr: number;
    /** Added to every night on top of the basket, from the amount screen's + button. */
    topUp?: number;
    /** A nightly amount picked outright (a bundle tile); when set it replaces the basket's own total. */
    amount?: number;
    /** A one-off gift to the emergency appeal, added today ("give with this gift"). */
    extra: number;
};
export const FEE = { rate: 0.015, fixed: 0.2 };
export const MATCH = { sponsor: "The Amanah Fund", ratio: 1, remaining: 274579 };

export const round2 = (n: number) => Math.round(n * 100) / 100;
const fee = (n: number) => (n > 0 ? round2(n * FEE.rate + FEE.fixed) : 0);

export type Quote = {
    /** The basket for one night, before round-up and boost. */
    basket: number; roundUp: number; nightly: number; boosted: number;
    nights: number[]; onceItems: number;
    /** Every charge in order: night (0 = today) and amount. */
    charges: { night: number; gift: number; tip: number; fee: number; total: number }[];
    gifts: number; tips: number; fees: number; total: number;
    giftAid: number; match: number; receives: number;
    /** Distinct nightly totals, low to high, for "£9 a night, £18 on the last ten". */
    perNight: number[];
};

/** startIso (the date of night 1) is needed only for the Fridays mode. */
export const quote = (ch: Choice, menu: Item[], startIso?: string): Quote => {
    const line = (once: boolean) => round2(menu.filter((i) => !!i.once === once).reduce((n, i) => n + (ch.qty[i.id] ?? 0) * i.price, 0));
    const basket = line(false), onceItems = line(true);
    const rounded = ch.roundUp && basket > 0 ? Math.ceil(basket / 5) * 5 : basket;
    const nightly = ch.amount && ch.amount > 0 ? round2(ch.amount) : basket > 0 ? round2(rounded + Math.max(0, ch.topUp ?? 0)) : 0;
    const boostOn = (n: number) => (n > 20 && nightly > 0 ? (ch.boost === "double" ? nightly : ch.boost) : 0);
    const nightGift = (n: number) => { const g = nightly + boostOn(n); return n === 27 ? g * (1 + (ch.qadr ?? 0) / 100) : g; };
    // "Give once": the nightly basket becomes a single gift today, with the boost left out.
    const nights = ch.mode === "once" ? [] : nightsFor(ch.mode, ch.picked, startIso ? fridaysFrom(startIso) : []);
    const today = (ch.mode === "once" ? nightly + onceItems : onceItems) + (ch.extra ?? 0);
    const charges = [
        ...(today > 0 ? [{ night: 0, gift: round2(today) }] : []),
        ...(nightly > 0 ? nights.map((n) => ({ night: n, gift: round2(nightGift(n)) })) : []),
    ].map((c) => { const f = ch.cover ? fee(c.gift + ch.tip) : 0; return { ...c, tip: ch.tip, fee: f, total: round2(c.gift + ch.tip + f) }; });
    const sum = (k: "gift" | "tip" | "fee" | "total") => round2(charges.reduce((n, c) => n + c[k], 0));
    const gifts = sum("gift"), fees = sum("fee");
    const giftAid = ch.giftAid ? round2(gifts * 0.25) : 0;
    const match = round2(Math.min(gifts, MATCH.remaining) * MATCH.ratio);
    return {
        basket, roundUp: round2(nightly - basket), nightly, boosted: nights.some((n) => n > 20) ? round2(nightly + boostOn(21)) : nightly,
        nights, onceItems, charges, gifts, tips: sum("tip"), fees, total: sum("total"), giftAid, match,
        receives: round2(gifts + fees + giftAid + match),
        perNight: [...new Set(charges.filter((c) => c.night > 0).map((c) => c.total))].sort((a, b) => a - b),
    };
};

/** Bundles for one night, and the level each one reaches. */
export const LEVELS: [number, string][] = [[5, "Supporter"], [10, "Helper"], [20, "Champion"], [50, "Hero"], [100, "Legend"]];
/** The level a nightly amount reaches: 1-based, 0 below the first bundle. */
export const levelOf = (nightly: number) => LEVELS.reduce((l, [min], i) => (nightly >= min ? i + 1 : l), 0);

/** What a gift buys, in the largest cause's own unit: "60 iftar meals". */
const UNIT: Record<string, [string, string]> = { food: ["iftar meal", "iftar meals"], water: ["person given clean water", "people given clean water"], zakat: ["Zakat gift", "Zakat gifts"], orphans: ["day of care for an orphan", "days of care for orphans"], education: ["school day", "school days"], health: ["check-up", "check-ups"], emergency: ["hygiene kit", "hygiene kits"], shelter: ["part of a room rebuilt", "parts of rooms rebuilt"] };
export const impactOf = (gifts: number, qty: Record<string, number>, menu: Item[]) => {
    const top = menu.filter((i) => qty[i.id] && !i.once).sort((a, b) => b.price * qty[b.id] - a.price * qty[a.id])[0];
    if (!top || gifts <= 0) return "";
    const unit = UNIT[top.art];
    const n = Math.max(1, Math.floor(gifts / top.price));
    return unit ? `${n.toLocaleString("en-GB")} ${n === 1 ? unit[0] : unit[1]}` : `${n} × ${top.title}`;
};

export const gbp = (n: number) => `£${round2(n).toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(round2(n)) ? 0 : 2, maximumFractionDigits: 2 })}`;
export const itemCount = (qty: Record<string, number>) => Object.values(qty).reduce((n, q) => n + q, 0);

/** Card checks for the simulated payment: Luhn, a future expiry, a 3–4 digit code. */
export const luhn = (num: string) => {
    const d = num.replace(/\D/g, "");
    if (d.length < 13 || d.length > 19) return false;
    let s = 0;
    for (let i = 0; i < d.length; i++) { let x = +d[d.length - 1 - i]; if (i % 2) { x *= 2; if (x > 9) x -= 9; } s += x; }
    return s % 10 === 0;
};
export const expiryOk = (mmyy: string, now = new Date()) => {
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(mmyy.trim());
    if (!m || +m[1] < 1 || +m[1] > 12) return false;
    return new Date(2000 + +m[2], +m[1], 1) > now;
};
