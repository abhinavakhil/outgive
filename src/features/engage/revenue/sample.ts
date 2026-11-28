/**
 * SAMPLE figures for the in-browser demo (ws.sample): the Outgive US prototype's Hope Foundation, the same numbers the SQL sample
 * (20261128100100) puts in the database. $412,860 from 3,872 donors; Night 27 the biggest.
 */
import type { Addons, Campaign, FunnelRow, SourceRow, Tonight } from "./model";

const SOURCES: [string, number, number, number][] = [["Live night QR", 128400, 1042, 2310], ["Email", 84950, 702, 3900], ["Meta ads", 61300, 588, 9800], ["Fundraiser pages", 58210, 731, 3050], ["Website direct", 46700, 390, 4100], ["WhatsApp shares", 33300, 419, 1880]];
const FUNDS: [string, number, number][] = [["Zakat", 176300, 1210], ["Sadaqah", 121480, 1630], ["Building fund", 66420, 142], ["Zakat al-Fitr", 38940, 702], ["Fidya", 9720, 188]];
const CAMPS: [string, number, number][] = [["Ramadan appeal", 248190, 2410], ["Last ten nights", 98250, 1119], ["Building fund dinner", 66420, 343]];
const TOTAL = 41286000, DONORS = 3872, GIFTS = 5240, START = "2027-02-08";
const gifts = (donors: number) => Math.round((donors * GIFTS) / DONORS);
const slice = ([key, dollars, donors]: [string, number, number, ...unknown[]]) => ({ key, cents: dollars * 100, gifts: gifts(donors), donors });

export const NIGHTS = (() => {
    const w = Array.from({ length: 30 }, (_, i) => { const n = i + 1; let x = 0.7 + 0.025 * n + ((n * 37) % 7) / 30; if (n > 20) x *= 1.7; if (n > 20 && n % 2) x *= 1.35; if (n === 27) x *= 1.6; return x; });
    const sum = w.reduce((a, b) => a + b, 0);
    return w.map((x) => Math.round((x / sum) * TOTAL));
})();

export const SAMPLE_CAMPAIGN: Campaign = {
    raised_cents: TOTAL, net_cents: Math.round(TOTAL * 0.968), cover_cents: Math.round(TOTAL * 0.017), gifts: GIFTS, donors: DONORS, new_donors: 2340, median_cents: 5000,
    monthly_gifts: Math.round(GIFTS * 0.09), nightly_gifts: Math.round(GIFTS * 0.06), pledged_gifts: 0,
    by_night: NIGHTS.map((cents, i) => ({ night: i + 1, cents, gifts: Math.round((cents / TOTAL) * GIFTS) })),
    by_day: NIGHTS.map((cents, i) => ({ day: new Date(Date.parse(`${START}T00:00:00Z`) + (i - 1) * 86400000).toISOString().slice(0, 10), cents, gifts: Math.round((cents / TOTAL) * GIFTS) })),
    by_fund: FUNDS.map(slice), by_campaign: CAMPS.map(slice),
};

export const SAMPLE_SOURCES: SourceRow[] = SOURCES.map((s) => ({ ...slice(s), net_cents: Math.round(s[1] * 96.8), visitors: s[3], spend_cents: s[0] === "Meta ads" ? 940000 : null }));

export const SAMPLE_TONIGHT: Tonight = {
    night: 27, live: false, raised_cents: NIGHTS[26], gifts: Math.round((NIGHTS[26] / TOTAL) * GIFTS), donors: Math.round((NIGHTS[26] / TOTAL) * DONORS), gifts_last_10_min: 38,
    pledges: 4, pledged_cents: 1250000, pledge_collected_cents: 900000, match_unlocked_cents: 1376000, match_remaining_cents: 624000,
    match_pots: [{ sponsor: "Al-Noor Family Foundation", cap_cents: 2000000, matched_cents: 1376000, active: true }],
    top_tables: [["table-6", 412000, 61], ["screen-main", 388500, 74], ["table-2", 297000, 40], ["table-11", 254000, 35], ["table-9", 198000, 29]].map(([qr, cents, g]) => ({ qr: qr as string, cents: cents as number, gifts: g as number })),
};

const funnel = (key: string, visit: number, k: [number, number, number, number]): FunnelRow =>
    ({ key, visit, checkout_started: Math.round(visit * k[0]), amount_chosen: Math.round(visit * k[1]), payment_attempted: Math.round(visit * k[2]), paid: Math.round(visit * k[3]) });
export const SAMPLE_FUNNEL: FunnelRow[] = [funnel("all", 25040, [0.45, 0.31, 0.25, 0.21]), funnel("mobile", 18030, [0.46, 0.31, 0.24, 0.2]), funnel("desktop", 5510, [0.42, 0.31, 0.27, 0.24]), funnel("tablet", 1500, [0.44, 0.3, 0.25, 0.21])];

export const SAMPLE_ADDONS: Addons = {
    gifts: GIFTS, fee_covered: Math.round(GIFTS * 0.71), fee_cover_cents: Math.round(TOTAL * 0.017),
    addons: ([["zakat_al_fitr", 0.34, 6000], ["last_ten", 0.18, 0], ["monthly", 0.09, 0], ["dedication", 0.06, 0], ["fidya", 0.04, 4500], ["roundup", 0.024, 4000]] as const)
        .map(([key, r, avg]) => ({ key, shown: GIFTS, taken: Math.round(GIFTS * r), cents: Math.round(GIFTS * r) * avg })),
};
