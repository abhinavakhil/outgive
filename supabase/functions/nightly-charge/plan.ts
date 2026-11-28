// The last-ten-nights schedule and the donor-covered fee, as plain maths with no imports, so the checkout (src/features/checkout)
// and the Deno functions (pay, nightly-charge) work out the same nights and the same cents.

/** The US nonprofit card rate: 2.2% + 30c. A charity on another rate passes its own. */
export const US_FEE = { rate: 0.022, fixed: 30 };

/**
 * What to add so the charity still nets `cents` after the processor takes rate × charge + fixed: (A + f) / (1 − p) − A, in whole cents,
 * rounded up so the charity is never short.
 */
export const coverCents = (cents: number, fee: { rate: number; fixed: number } = US_FEE) =>
    cents > 0 ? Math.max(0, Math.ceil((cents + fee.fixed) / (1 - fee.rate) - cents - 1e-9)) : 0;

/** Ramadan 1448: the first fast is expected on 8 February 2027, so night 21 is the evening of 27 February. The charity can move it. */
export const NIGHT_21 = "2027-02-27";
/** Nights are charged at 01:00 UTC on the morning after, which is 8pm the same evening in New York. */
// ponytail: one charge hour for every US charity; store an IANA time zone per org when West Coast masjids ask.
export const CHARGE_HOUR_UTC = 1;

export interface Night { night: number; /** The evening, ISO date. */ date: string; /** When it is charged. */ due: string; /** 2 on an odd night when the donor gives double, else 1. */ units: number }

/**
 * The nights still to come, from night 21 (the evening of `start`) to night 30, with double units on the odd nights (21, 23, 25, 27, 29)
 * when `odd` is on: 10 units every night, or 15 with double odd nights. A night whose charge time has passed is left out.
 */
export const nightPlan = (start = NIGHT_21, odd = false, now = new Date()): Night[] => {
    const [y, m, d] = start.split("-").map(Number);
    const out: Night[] = [];
    for (let n = 21; n <= 30; n++) {
        const eve = new Date(Date.UTC(y, m - 1, d + (n - 21)));
        const due = new Date(Date.UTC(y, m - 1, d + (n - 21) + 1, CHARGE_HOUR_UTC));
        if (due.getTime() <= now.getTime()) continue;
        out.push({ night: n, date: eve.toISOString().slice(0, 10), due: due.toISOString(), units: odd && n % 2 ? 2 : 1 });
    }
    return out;
};

export interface NightCharge extends Night { gift: number; extras: number; cover: number; total: number }
/**
 * Each night's charge in cents: the per-night gift × units, one-off extras (Zakat al-Fitr, Fidya) on the first night only,
 * and, when the donor covers fees, the fee on that night's charge (each charge pays its own fixed part).
 */
export const nightCharges = (perNight: number, plan: Night[], extras = 0, cover = false, fee = US_FEE): NightCharge[] =>
    plan.map((n, i) => {
        const gift = perNight * n.units, x = i === 0 ? extras : 0, c = cover ? coverCents(gift + x, fee) : 0;
        return { ...n, gift, extras: x, cover: c, total: gift + x + c };
    });

/** A SetupIntent as the checkout sees it: saved is "succeeded" (nothing was charged), a bank still verifying is a delayed "processing". */
export const fromSetup = (si: { status: string; client_secret?: string | null }, id: string): { status: "succeeded" | "processing" | "requires_action" | "failed"; id: string; clientSecret?: string; delayed?: boolean; error?: { code: string } } =>
    si.status === "succeeded" ? { status: "succeeded", id }
    : si.status === "processing" ? { status: "processing", id, delayed: true }
    : si.status === "canceled" ? { status: "failed", id, error: { code: "canceled" } }
    : { status: "requires_action", id, clientSecret: si.client_secret ?? undefined };

/** The page that reopens an abandoned checkout, as recovery.ts resumeLink makes it: "org/<slug>", the samples, or a create-flow page. */
export const resumeUrl = (site: string, campaign: string, token: string) => {
    const org = campaign.match(/^org\/([a-z0-9-]+)$/)?.[1], u = new URL(org ? `/o/${org}/checkout` : "/checkout", site);
    if (campaign === "us-sample") u.searchParams.set("region", "us");
    else if (!org && campaign !== "sample") u.searchParams.set("campaign", campaign);
    u.searchParams.set("resume", token);
    return u.toString();
};

/**
 * Jumu'ah giving (the contract in src/features/engage/campaigns/weekly.ts): the next Friday strictly after `now` (UTC), so a gift made on
 * a Friday counts as this Friday's and the subscription starts next week. Charged at 17:00 UTC (noon in New York).
 */
export const nextFriday = (now: Date): string => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + (((5 - d.getUTCDay() + 7) % 7) || 7));
    return d.toISOString().slice(0, 10);
};
/** Unix seconds of the first weekly charge: the next Friday at 17:00 UTC. */
export const weeklyAnchor = (now: Date) => Math.floor(Date.parse(`${nextFriday(now)}T17:00:00Z`) / 1000);
