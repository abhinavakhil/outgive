/**
 * Campaign templates: every appeal of the year as data. A template sets the funds, the suggested gifts and what each one does,
 * the schedule and the checkout add-ons that fit. applyTemplate() adds one to the charity's page (the BioPage saved with bio_save),
 * keeping everything already there, so /ramadhan never loses a campaign or a fund.
 * Pure, so the dates and the merge are tested without a browser (templates.test.ts).
 */
import type { BioPage } from "@/features/launch";
import { RAMADAN_1448, ramadanTemplate } from "../onboard/model";

type Cause = BioPage["causes"][number];
type Campaign = BioPage["campaigns"][number];

export type TemplateId = "ramadan" | "dhul-hijjah" | "emergency" | "building" | "jumuah";
/** A suggested gift and what it does. */
export type Ask = { amount: number; outcome: string };
export type Day = { date: string; label: string };
export type Schedule =
    | { kind: "season"; starts: string; ends: string; days: Day[]; note: string }
    | { kind: "weekly"; weekday: 5; label: string }
    | { kind: "open"; days: number | null };
/** Checkout add-on ids (features/checkout us.ts ADDONS), plus "weekly": a gift every Friday (see weekly.ts for the payment contract). */
export type Addon = "nights" | "alfitr" | "fidya" | "cover" | "match" | "dedication" | "roundup" | "bank" | "pledge" | "monthly" | "weekly";
export const ADDON_NAME: Record<Addon, string> = {
    nights: "Last-ten-nights schedule", alfitr: "Zakat al-Fitr", fidya: "Fidya", cover: "Cover the fees", match: "Match banner", dedication: "Dedication",
    roundup: "Round up to a milestone", bank: "Bank debit for large gifts", pledge: "Pledge now, pay later", monthly: "Monthly upgrade", weekly: "Every Friday",
};
export type BuildingUnit = "bricks" | "sqft";
export type Template = {
    id: TemplateId; name: string; summary: string; season: string;
    /** The funds it adds to the page (causes). */
    funds: Cause[];
    asks: Ask[];
    schedule: Schedule;
    addons: Addon[];
    /** The appeal card on the page. */
    illo: string; goal: number; per: string;
    /** The checkout fund a text-to-give link opens on (features/checkout us.ts FUND_IDS). */
    fund: "general" | "zakat" | "sadaqah";
    /** A text-to-give keyword to suggest. */
    keyword: string;
};

// ---------------------------------------------------------------- 1448 dates
/**
 * Umm al-Qura dates (Intl "islamic-umalqura"; the test checks them). An astronomical estimate: where a charity follows a local
 * moon sighting, each date can fall a day later.
 */
export const H1448 = {
    ramadan: RAMADAN_1448, night21: "2027-02-28", eidFitr: "2027-03-09",
    dhulHijjah: "2027-05-07", arafah: "2027-05-15", eidAdha: "2027-05-16", tashreeqEnd: "2027-05-19",
} as const;
export const ESTIMATE_NOTE = "Astronomical estimate (Umm al-Qura). With a local moon sighting each date can be a day later.";

const fund = (id: string, title: string, note: string, icon: string, amounts: number[]): Cause => ({ id, title, note, raised: 0, goal: 0, icon, amounts });
const SADAQAH = fund("sadaqah", "Sadaqah", "Where it is needed most", "mosque", [20, 50, 100]);
const ZAKAT = fund("zakat", "Zakat", "Paid only to those eligible", "zakat", [50, 100, 250]);

/** Qurbani prices per animal: a goat or sheep is one share, a cow or camel seven. Suggested; the charity sets its own. */
export const QURBANI_SHARES = [
    { animal: "Goat or sheep", shares: 1, price: 95 },
    { animal: "Cow", shares: 7, price: 75 },
    { animal: "Camel", shares: 7, price: 90 },
] as const;

/** What one unit of a building costs, by how the charity counts it. */
export const BUILDING_UNITS: Record<BuildingUnit, { one: string; many: string; price: number }> = {
    bricks: { one: "brick", many: "bricks", price: 25 },
    sqft: { one: "square foot", many: "square feet", price: 150 },
};
export const buildingAsks = (u: BuildingUnit): Ask[] => {
    const x = BUILDING_UNITS[u];
    return [[1, x.one], [10, x.many], [100, x.many]].map(([n, w]) => ({ amount: x.price * (n as number), outcome: `${n === 1 ? "One" : n} ${w}` }));
};

export const TEMPLATES: Template[] = [
    {
        id: "ramadan", name: "Ramadan 1448", season: "8 Feb to 9 Mar 2027", summary: "Thirty nights of giving, with the last ten nights scheduled and Zakat al-Fitr before Eid.",
        funds: ramadanTemplate("", "").causes,
        asks: [{ amount: 15, outcome: "Zakat al-Fitr for one person" }, { amount: 50, outcome: "Iftar for ten people" }, { amount: 250, outcome: "A month of food for a family" }],
        schedule: { kind: "season", starts: H1448.ramadan, ends: H1448.eidFitr, note: ESTIMATE_NOTE, days: [
            { date: H1448.ramadan, label: "First fast" }, { date: H1448.night21, label: "Last ten nights begin" }, { date: H1448.eidFitr, label: "Eid al-Fitr" }] },
        addons: ["nights", "alfitr", "fidya", "cover", "dedication", "monthly"],
        illo: "food", goal: 100000, per: "an iftar", fund: "general", keyword: "IFTAR",
    },
    {
        id: "dhul-hijjah", name: "Dhul Hijjah and Qurbani", season: "7 to 19 May 2027", summary: "The best ten days of the year, the Day of Arafah, and Qurbani shares sacrificed on Eid al-Adha.",
        funds: [fund("qurbani", "Qurbani", "Sacrificed on Eid al-Adha, meat to families in need", "food", QURBANI_SHARES.map((s) => s.price)), SADAQAH],
        asks: [
            { amount: 95, outcome: "One goat or sheep: a full Qurbani" },
            { amount: 75, outcome: "One share of a cow (1 of 7)" },
            { amount: 525, outcome: "A whole cow: seven shares" },
        ],
        schedule: { kind: "season", starts: H1448.dhulHijjah, ends: H1448.tashreeqEnd, note: ESTIMATE_NOTE, days: [
            { date: H1448.dhulHijjah, label: "First ten days begin" }, { date: H1448.arafah, label: "Day of Arafah" },
            { date: H1448.eidAdha, label: "Eid al-Adha" }, { date: H1448.tashreeqEnd, label: "Last day of Qurbani" }] },
        addons: ["dedication", "cover", "match"],
        illo: "food", goal: 50000, per: "a share", fund: "general", keyword: "QURBANI",
    },
    {
        id: "emergency", name: "Emergency appeal", season: "Any time, 30 days", summary: "Open within the hour when a crisis hits: food, hygiene kits and shelter, Zakat-eligible.",
        funds: [fund("emergency", "Emergency relief", "Sent where the crisis is", "emergency", [30, 60, 150]), ZAKAT],
        asks: [{ amount: 30, outcome: "A week of food for a family" }, { amount: 60, outcome: "A hygiene and winter kit" }, { amount: 150, outcome: "Emergency shelter for a family" }],
        schedule: { kind: "open", days: 30 },
        addons: ["cover", "match", "dedication", "monthly"],
        illo: "emergency", goal: 25000, per: "a family", fund: "sadaqah", keyword: "RELIEF",
    },
    {
        id: "building", name: "Building fund", season: "Until the goal is met", summary: "A masjid or school, counted in bricks or square feet, with pledges paid over months.",
        funds: [fund("building", "Building fund", "Sadaqah Jariyah: a charity that lasts", "mosque", [25, 250, 2500])],
        asks: buildingAsks("bricks"),
        schedule: { kind: "open", days: null },
        addons: ["pledge", "bank", "roundup"],
        illo: "mosque", goal: 500000, per: "a brick", fund: "general", keyword: "BUILD",
    },
    {
        id: "jumuah", name: "Jumu'ah giving", season: "Every Friday", summary: "A small gift every Friday, taken automatically, all year.",
        funds: [fund("jumuah", "Jumu'ah giving", "Sadaqah every Friday", "mosque", [5, 10, 25])],
        asks: [{ amount: 5, outcome: "Every Friday: $260 a year" }, { amount: 10, outcome: "Every Friday: $520 a year" }, { amount: 25, outcome: "Every Friday: $1,300 a year" }],
        schedule: { kind: "weekly", weekday: 5, label: "Every Friday" },
        addons: ["weekly", "cover", "dedication"],
        illo: "mosque", goal: 0, per: "a week", fund: "sadaqah", keyword: "FRIDAY",
    },
];
export const templateOf = (id: TemplateId) => TEMPLATES.find((t) => t.id === id)!;

// ---------------------------------------------------------------- applying a template to the page
/** Kept on the page next to its campaigns: how each appeal was made, for the Campaigns screen. Other screens ignore it. */
export type Appeal = { id: string; template: TemplateId; starts: string; ends: string | null; weekly: boolean; addons: Addon[]; asks: Ask[] };
export type Page = BioPage & { appeals?: Appeal[] };
export type ApplyOptions = { orgName: string; today: string; title?: string; goal?: number; unit?: BuildingUnit };

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** When the appeal runs: a season keeps its dates, "open" runs from today, weekly from today with no end. */
export const datesOf = (t: Template, today: string): { starts: string; ends: string | null } =>
    t.schedule.kind === "season" ? { starts: t.schedule.starts, ends: t.schedule.ends }
    : t.schedule.kind === "open" ? { starts: today, ends: t.schedule.days ? addDays(today, t.schedule.days) : null }
    : { starts: today, ends: null };

/** The page with the template's appeal added: its funds where the page lacks them, one campaign, one appeal record. Nothing is removed. */
export const applyTemplate = (page: Page | null, t: Template, o: ApplyOptions): Page => {
    const base: Page = page ?? { ...ramadanTemplate(o.orgName, ""), tagline: t.name, causes: [], ...(t.id === "ramadan" ? {} : { ramadanStart: RAMADAN_1448 }) };
    const asks = t.id === "building" ? buildingAsks(o.unit ?? "bricks") : t.asks;
    const per = t.id === "building" ? `a ${BUILDING_UNITS[o.unit ?? "bricks"].one}` : t.per;
    const { starts, ends } = datesOf(t, o.today);
    const taken = new Set(base.campaigns.map((c) => c.id));
    let id = `${t.id}-${starts.slice(0, 4)}`;
    for (let n = 2; taken.has(id); n++) id = `${t.id}-${starts.slice(0, 4)}-${n}`;
    const campaign: Campaign = {
        id, title: (o.title ?? "").trim() || t.name, text: t.summary, raised: 0, goal: Math.max(0, Math.round(o.goal ?? t.goal)),
        art: base.campaigns.length % 4, illo: t.illo, ends: ends ?? "", price: asks[0].amount, per, impact: asks[0].outcome,
        ...(t.schedule.kind === "weekly" ? { tag: "Every Friday" } : {}),
    };
    const have = new Set(base.causes.map((c) => c.id));
    return {
        ...base,
        causes: [...base.causes, ...t.funds.filter((f) => !have.has(f.id))],
        campaigns: [...base.campaigns, campaign],
        appeals: [...(base.appeals ?? []), { id, template: t.id, starts, ends, weekly: t.schedule.kind === "weekly", addons: t.addons, asks }],
    };
};

// ---------------------------------------------------------------- the list on the Campaigns screen
export type Status = "Not started" | "In progress" | "Done" | "Every Friday";
export type Row = { id: string; title: string; template: TemplateId | null; starts: string | null; ends: string | null; goal: number; raised: number; status: Status; per?: string; price?: number };
/** Every campaign on the page, with how it was made when Outgive knows, and where it stands today. `raised` is from paid gifts by campaign id. */
export const rowsOf = (page: Page | null, today: string, raised: Record<string, number> = {}): Row[] => (page?.campaigns ?? []).map((c) => {
    const a = page?.appeals?.find((x) => x.id === c.id);
    const starts = a?.starts ?? page?.ramadanStart ?? null, ends = a ? a.ends : c.ends || null;
    const status: Status = a?.weekly ? "Every Friday" : starts && today < starts ? "Not started" : ends && today > ends ? "Done" : "In progress";
    return { id: c.id, title: c.title, template: a?.template ?? null, starts, ends, goal: c.goal, raised: raised[c.id] ?? c.raised, status, per: c.per, price: c.price };
});

/** The page saved when a new charity starts with a template (onboarding's "Start with"). Ramadan is the onboarding's own starter page. */
export const startPage = (id: TemplateId, name: string, website: string, today: string): Page => {
    if (id === "ramadan") return ramadanTemplate(name, website);
    const p = applyTemplate(null, templateOf(id), { orgName: name, today });
    return { ...p, socials: { ...p.socials, website } };
};
