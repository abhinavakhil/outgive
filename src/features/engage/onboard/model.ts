/**
 * Self-serve charity setup (/engage with no charity yet): the page address rules, the EIN shape and the Ramadan 1448 starter appeal.
 * Pure, so the rules are tested without a browser.
 */
import type { BioPage } from "@/features/launch";

/** Same rules as /start (features/onboarding): lowercase letters, numbers and dashes, 1 to 40 long, no dash at either end. */
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
/** What the address box keeps while typing: a trailing dash stays so "clear-well" can be typed. */
export const tidySlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").slice(0, 40);
export const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** As the person types: digits only, dash after the second. "123456789" → "12-3456789". */
export const formatEin = (s: string) => { const d = s.replace(/\D/g, "").slice(0, 9); return d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d; };

export const COUNTRIES = [["US", "United States"], ["GB", "United Kingdom"]] as const;
export type Country = (typeof COUNTRIES)[number][0];
export const CURRENCY_OF: Record<Country, "USD" | "GBP"> = { US: "USD", GB: "GBP" };

/** Ramadan 1448 begins on the evening of 7 February 2027 (first fast 8 February). */
export const RAMADAN_1448 = "2027-02-08";

/**
 * The starter Ramadan page saved with bio_save: the four funds a Ramadan appeal always needs, no goals (the charity sets them),
 * no campaigns, no sample numbers. Amounts are suggested gift sizes in the charity's currency.
 */
export const ramadanTemplate = (name: string, website: string): BioPage => ({
    name, tagline: "Ramadan 1448 appeal", charityNo: "", logo: "",
    avatar: name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    socials: { instagram: "", whatsapp: "", website, email: "" },
    ramadanStart: RAMADAN_1448,
    theme: { colour: "#0F7A5C", style: "outgive", corners: "round", font: "Outfit", causes: "grid" },
    blocks: (["banner", "totals", "ways", "causes", "campaigns", "supporters", "gifts", "journey", "links"] as const).map((id) => ({ id, on: !["campaigns", "journey", "links"].includes(id) })),
    campaigns: [],
    causes: [
        { id: "zakat", title: "Zakat", note: "Paid only to those eligible", raised: 0, goal: 0, icon: "zakat", amounts: [50, 100, 250] },
        { id: "sadaqah", title: "Sadaqah", note: "Where it is needed most", raised: 0, goal: 0, icon: "mosque", amounts: [20, 50, 100] },
        { id: "zakat-al-fitr", title: "Zakat al-Fitr", note: "One for each person, before Eid prayer", raised: 0, goal: 0, icon: "food", amounts: [15, 45, 90] },
        { id: "fidya", title: "Fidya", note: "For fasts that cannot be made up", raised: 0, goal: 0, icon: "food", amounts: [15, 150, 450] },
    ],
    links: [], journey: [],
});

/** The "Start with" step: the Ramadan appeal (recommended), another campaign template (campaigns/templates.ts) or nothing (""). */
export const START_WITH = [
    ["ramadan", "Ramadan 1448 appeal template", "An appeal from 8 February 2027 with Zakat, Sadaqah, Zakat al-Fitr and Fidya funds. You set the goal."],
    ["jumuah", "Jumu'ah giving", "A weekly gift every Friday, all year."],
    ["dhul-hijjah", "Dhul Hijjah and Qurbani", "Qurbani shares and the first ten days, 7 to 19 May 2027."],
    ["building", "Building fund", "A masjid or school, counted in bricks, with pledges."],
    ["emergency", "Emergency appeal", "Food, kits and shelter, open for 30 days."],
    ["", "Start empty", "Just the charity. Build your appeal yourself."],
] as const;
export type StartWith = (typeof START_WITH)[number][0];
