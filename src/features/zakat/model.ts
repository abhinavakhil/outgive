/**
 * Zakat on wealth, in US dollars: 2.5% of net zakatable wealth when it reaches the nisab.
 * Money is worked in whole cents so the breakdown adds up exactly. Rounds the zakat to the nearest cent.
 */
export type Basis = "silver" | "gold";
export type ZakatInput = {
    cash: number; investments: number; business: number; owed: number; debts: number;
    /** Weights in grams of pure metal. */
    gold: number; silver: number;
    /** Prices in US dollars per gram. */
    goldPrice: number; silverPrice: number;
    basis: Basis;
};
export type ZakatResult = {
    /** What was counted, in dollars, in the order shown. Lines with nothing in them are left out. */
    lines: [string, number][];
    assets: number; debts: number; net: number; nisab: number; due: number; above: boolean;
};

/** Classical nisab: 20 mithqal of gold and 200 dirhams of silver, in their usual modern weights. */
export const NISAB_GRAMS: Record<Basis, number> = { gold: 85, silver: 595 };
export const RATE = 0.025;
export const TROY_OUNCE_GRAMS = 31.1034768;

/** A usable amount: finite and above zero, else 0. */
const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
const toCents = (n: number) => Math.round(pos(n) * 100);

/** What a donor typed ("$1,250.50", " 300 ", "") as a number; anything unreadable or negative is 0. */
export const parseAmount = (s: string): number => {
    const t = s.replace(/[$,\s]/g, "");
    if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".") return 0;
    return Number(t);
};

/** A spot price per troy ounce as dollars per gram, to the cent. */
export const perGram = (ozPrice: number) => Math.round((pos(ozPrice) / TROY_OUNCE_GRAMS) * 100) / 100;

export const zakat = (z: ZakatInput): ZakatResult => {
    const gp = pos(z.goldPrice), sp = pos(z.silverPrice);
    const rows: [string, number][] = [
        ["Cash and bank", toCents(z.cash)],
        ["Shares and investments", toCents(z.investments)],
        [`Gold, ${fmtG(z.gold)} g`, Math.round(pos(z.gold) * gp * 100)],
        [`Silver, ${fmtG(z.silver)} g`, Math.round(pos(z.silver) * sp * 100)],
        ["Business stock", toCents(z.business)],
        ["Money owed to you", toCents(z.owed)],
    ];
    const assets = rows.reduce((s, [, c]) => s + c, 0);
    const debts = toCents(z.debts);
    const net = Math.max(0, assets - debts);
    const nisab = Math.round(NISAB_GRAMS[z.basis] * (z.basis === "gold" ? gp : sp) * 100);
    // With no metal price there is no nisab to measure against, so nothing is due.
    const above = nisab > 0 && net > 0 && net >= nisab;
    const due = above ? Math.round(net / 40) : 0; // 2.5%, divided exactly
    return { lines: rows.filter(([, c]) => c > 0).map(([l, c]) => [l, c / 100]), assets: assets / 100, debts: debts / 100, net: net / 100, nisab: nisab / 100, due: due / 100, above };
};

const fmtG = (g: number) => String(Math.round(pos(g) * 1000) / 1000);

export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

/** Only an absolute http(s) address is followed; anything else (javascript:, relative, junk) is refused. */
export const safeUrl = (s: string | null | undefined): URL | null => {
    if (!s) return null;
    try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:" ? u : null; } catch { return null; }
};
export const cleanSlug = (s: string | null | undefined) => (s && /^[a-z0-9-]{1,60}$/.test(s) ? s : null);

/**
 * The charity's checkout with the gift filled: `?amount=<dollars, 2dp>&fund=zakat`, kept alongside any query the address already has.
 * This is the contract the checkout reads.
 */
export const giveLink = (base: string, due: number): string => {
    const u = safeUrl(base);
    if (!u) return base;
    u.searchParams.set("amount", due.toFixed(2));
    u.searchParams.set("fund", "zakat");
    return u.toString();
};
