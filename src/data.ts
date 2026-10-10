import type { FC } from "react";
import { Announcement01, Calendar, Flag01, Heart, HeartHand, Users01 } from "@untitledui/icons";

export const CAUSES = ["Health", "Education", "Clean Water", "Hunger", "Climate", "Animals", "Children", "Disaster Relief", "Refugees", "Women & Girls", "Disability", "Housing", "Mental Health", "Elderly Care", "Human Rights", "Arts & Culture"];
export const REGIONS = ["Africa", "Asia", "Europe", "Latin America", "Middle East", "North America", "Oceania"];
/** Indicative demo rates against USD. Replace with a live rates service. */
export const CURRENCIES: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.78, INR: 84, AED: 3.67 };

/** Who can hold a rank on a charity's board. */
export const KINDS = ["Individuals", "Teams", "Companies", "Schools"];
/** One row on the board: a supporter ranked by what they have given to the charity. */
export interface Supporter { id: number; name: string; tagline: string; kind: string; region: string; country: string; page: string; total: number; today: number; visits: number; days: number }

/** Fictional supporters of the demo charity. Demo data only. */
const SEED: [string, string, string, string, string][] = [
    ["Amara Okafor", "Running the Nairobi marathon for the Kitui boreholes", "Individuals", "Africa", "Kenya"],
    ["Northfield Rotary", "Our club's annual water appeal", "Teams", "Europe", "United Kingdom"],
    ["Bluefin Logistics", "Matching every staff gift pound for pound", "Companies", "North America", "United States"],
    ["St Hilda's Primary", "Year 6 walked 40 km, one for each village", "Schools", "Europe", "United Kingdom"],
    ["Jonas Weber", "Shaving my head when we hit the first pump", "Individuals", "Europe", "Germany"],
    ["The Tuesday Swimmers", "A cold-water swim every week until March", "Teams", "Oceania", "New Zealand"],
    ["Priya Sharma", "In memory of my grandmother, who carried water daily", "Individuals", "Asia", "India"],
    ["Harbour Dental", "Our practice's charity of the year", "Companies", "Oceania", "Australia"],
    ["Lakeside High", "The sixth-form bake sale that got out of hand", "Schools", "North America", "Canada"],
    ["Tomás Rivera", "Cycling Lisbon to Porto in July", "Individuals", "Europe", "Portugal"],
    ["Team Clearwell Dubai", "Expat five-a-side league, winnings donated", "Teams", "Middle East", "United Arab Emirates"],
    ["Leila Haddad", "Birthday fundraiser, no presents please", "Individuals", "Middle East", "Jordan"],
    ["Greenway Architects", "One percent of every project fee", "Companies", "Europe", "Netherlands"],
    ["Riverbank Academy", "Our whole-school fast for water", "Schools", "Asia", "Singapore"],
    ["Mateo & Sofia", "Wedding gifts went here instead", "Individuals", "Latin America", "Colombia"],
    ["The Night Shift", "ICU nurses, fundraising between shifts", "Teams", "Europe", "Ireland"],
    ["Kofi Mensah", "Three peaks in three days", "Individuals", "Africa", "Ghana"],
    ["Pinewood Coffee Co.", "Ten cents from every cup in April", "Companies", "North America", "United States"],
    ["Hana Suzuki", "Running my first 10k at 62", "Individuals", "Asia", "Japan"],
    ["Oakridge College", "Student union charity week", "Schools", "Europe", "United Kingdom"],
    ["Fatima Al-Sayed", "Ramadan giving", "Individuals", "Middle East", "Egypt"],
    ["Ridge Runners", "Trail-running club, one dollar per kilometre", "Teams", "North America", "United States"],
    ["Daniel Osei", "Sponsored silence, 48 hours", "Individuals", "Africa", "Nigeria"],
    ["Marlow & Finch", "Our firm's year-end giving", "Companies", "Europe", "United Kingdom"],
    ["Elena Petrova", "Selling my paintings for pumps", "Individuals", "Europe", "Bulgaria"],
    ["Sunrise Montessori", "Pennies for pumps jar, finally counted", "Schools", "Asia", "India"],
    ["Yusuf Rahman", "Fasting for water, with friends", "Individuals", "Asia", "Bangladesh"],
    ["The Allotment Crew", "Veg box sales all summer", "Teams", "Europe", "United Kingdom"],
    ["Grace Mwangi", "Walking to work for a month", "Individuals", "Africa", "Kenya"],
    ["Cedar Point Gym", "Spin-a-thon, 24 hours straight", "Companies", "North America", "Canada"],
    ["Ben Carter", "Quit coffee, gave the money away", "Individuals", "Oceania", "Australia"],
    ["Willow Lane School", "Reception class sponsored toddle", "Schools", "Europe", "United Kingdom"],
];
export const SUPPORTERS: Supporter[] = SEED.map((r, i) => {
    const total = Math.round(18500 * Math.pow(0.89, i) + 400 - i * 4);
    return { id: i + 1, name: r[0], tagline: r[1], kind: r[2], region: r[3], country: r[4], page: "/f/" + r[0].toLowerCase().replace(/[^a-z]+/g, "-"),
        total, today: Math.round(total * (((i * 37) % 11) / 60 + 0.01)), visits: Math.round(total * (2.2 + ((i * 13) % 7) / 3)), days: 3 + ((i * 17) % 44) };
});
export interface Activity { who: string; usd: number; at: number }
const MIN = 60000;
export const ACTIVITY: Activity[] = [{ who: "Amara Okafor", usd: 18900, at: Date.now() - 49 * MIN }, { who: "Hana Suzuki", usd: 2810, at: Date.now() - 130 * MIN }, { who: "Priya Sharma", usd: 6120, at: Date.now() - 310 * MIN }, { who: "Ben Carter", usd: 1050, at: Date.now() - 560 * MIN }];

/** How the ranking is drawn. list = rows, podium = top three on a stand, race = bars relative to #1. */
export type Variant = "list" | "podium" | "race";
export const VARIANTS: [Variant, string][] = [["list", "List"], ["podium", "Podium"], ["race", "Race"]];
export const FONTS = ["Poppins", "Inter", "DM Sans", "Nunito", "Lora"];
/** The charity running this board. Everything a white-label customer changes lives here. */
export interface Brand { name: string; tagline: string; logo: string; color: string; font: string; variant: Variant }
export const DEFAULT_BRAND: Brand = { name: "Clearwell Trust", tagline: "Clean water for 40 villages", logo: "", color: "#e0603f", font: "Poppins", variant: "list" };
export const BRAND_PRESETS: Brand[] = [
    DEFAULT_BRAND,
    { name: "Mangrove Line", tagline: "Replanting the coast, one kilometre at a time", logo: "", color: "#1f7a4d", font: "DM Sans", variant: "race" },
    { name: "Quiet Line", tagline: "Someone to talk to, all night", logo: "", color: "#5b4bd6", font: "Inter", variant: "podium" },
    { name: "Little Lungs", tagline: "Paediatric asthma care in high-smog cities", logo: "", color: "#0f6fb5", font: "Nunito", variant: "list" },
];
export const REGION_OF: Record<string, string> = { India: "Asia", Kenya: "Africa", "United Kingdom": "Europe", "United States": "North America", "United Arab Emirates": "Middle East" };
export const NO_CHARITY = "Independent organiser";

export type PageType = "fundraiser" | "campaign" | "team" | "challenge" | "event" | "memory";
export const PAGE_TYPES: { id: PageType; label: string; desc: string; icon: FC<{ className?: string }>; tile: string; cta: string; detailTitle: string }[] = [
    { id: "fundraiser", label: "Fundraiser", desc: "A personal page raising for a charity", icon: Heart, tile: "bg-[#FBD9C5]", cta: "Donate", detailTitle: "Who are you raising for?" },
    { id: "campaign", label: "Campaign", desc: "A charity's appeal that others can fundraise for", icon: Announcement01, tile: "bg-[#F8E7A8]", cta: "Donate", detailTitle: "Which charity is this for?" },
    { id: "team", label: "Team", desc: "A group sharing one total", icon: Users01, tile: "bg-[#CFE5D2]", cta: "Back the team", detailTitle: "Tell us about your team" },
    { id: "challenge", label: "Challenge", desc: "Walk, run, ride or fast to a target", icon: Flag01, tile: "bg-[#CFE0F2]", cta: "Sponsor", detailTitle: "What is the challenge?" },
    { id: "event", label: "Event", desc: "A date, a place and tickets", icon: Calendar, tile: "bg-[#E0D6F2]", cta: "Get tickets", detailTitle: "When and where?" },
    { id: "memory", label: "In memory", desc: "Gifts in honour of someone", icon: HeartHand, tile: "bg-[#F6D2D8]", cta: "Give in memory", detailTitle: "Who is this page for?" },
];

export type LayoutId = "classic" | "split" | "full-bleed" | "poster" | "story" | "dashboard" | "leaderboard" | "ticket" | "tracker" | "bento" | "chapters" | "impact";
export const LAYOUTS: { id: LayoutId; name: string; desc: string; types: PageType[] }[] = [
    { id: "classic", name: "Classic", desc: "Photo and story with a donate card beside it", types: ["campaign", "fundraiser", "memory"] },
    { id: "split", name: "Split", desc: "Half colour, half photo, one clear ask", types: ["fundraiser", "memory"] },
    { id: "full-bleed", name: "Full-bleed", desc: "Wide cover with the donate card overlapping", types: ["campaign", "event"] },
    { id: "poster", name: "Poster", desc: "Big type on colour, no photo needed", types: ["challenge", "event", "team"] },
    { id: "story", name: "Story", desc: "One narrow column that reads like a letter", types: ["memory", "fundraiser"] },
    { id: "dashboard", name: "Dashboard", desc: "Numbers and progress first", types: ["campaign", "team"] },
    { id: "leaderboard", name: "Leaderboard", desc: "The ranking is the page", types: ["team", "challenge"] },
    { id: "ticket", name: "Ticket", desc: "Date, programme and tickets", types: ["event"] },
    { id: "tracker", name: "Tracker", desc: "Distance logged next to money raised", types: ["challenge", "fundraiser"] },
    { id: "bento", name: "Bento", desc: "A grid of tiles for facts at a glance", types: ["campaign"] },
    { id: "chapters", name: "Chapters", desc: "Tabs for story, impact, updates", types: ["campaign", "event"] },
    { id: "impact", name: "Impact", desc: "Giving levels lead the page", types: ["campaign"] },
];

export type Cover = { kind: "none" | "image" | "video" | "youtube"; src: string };
export interface Donation { name: string; usd: number; message: string; at: number; monthly?: boolean; dedication?: string }
export interface PageUpdate { title: string; body: string; at: number }
export interface PageData {
    type: PageType; slug: string; title: string; org: string; country: string; goal: number; raised: number; supporters: number;
    /** Description as HTML, written in the Penna editor. */
    story: string; cover: Cover; layout: LayoutId; isSample: boolean;
    causes: string[]; details: Record<string, string>; gifts: number[]; endDate: string; showGoal: boolean; created: number;
    donations: Donation[]; updates: PageUpdate[];
    /** Where the money goes, as [label, percent] rows. */
    allocation: [string, number][];
}
export const DEFAULT_ALLOCATION: [string, number][] = [["Programmes", 80], ["Delivery and logistics", 14], ["Running costs", 6]];
/** URL prefix per page type: /f/slug for a fundraiser, /c/slug for a campaign and so on. */
export const PREFIX: Record<PageType, string> = { fundraiser: "f", campaign: "c", team: "t", challenge: "ch", event: "e", memory: "m" };
export const pageKey = (p: Pick<PageData, "type" | "slug">) => `${PREFIX[p.type]}/${p.slug}`;
const DAY = 86400000;
export const SAMPLE_PAGE: PageData = {
    type: "campaign", slug: "clean-water-for-40-villages", title: "Clean water for 40 villages", org: "Clearwell Trust", country: "Kenya", goal: 30000, raised: 18420, supporters: 412, layout: "classic", isSample: true,
    cover: { kind: "none", src: "" }, causes: ["Clean Water", "Children"], gifts: [10, 25, 50, 100], showGoal: true, created: Date.now() - 41 * DAY, endDate: "",
    details: { Charity: "Clearwell Trust", "Registration number": "CT-20418 (sample)", "Country of registration": "Kenya", "Supporter fundraisers": "Allowed" },
    story: "<p>Forty villages in the district share six working pumps. Children walk up to two hours for water before school. Each borehole serves about 300 people and lasts 20 years with basic upkeep.</p><p>Every gift goes to drilling, pump parts and training two local caretakers per village.</p>",
    donations: [{ name: "Anonymous", usd: 50, message: "Keep going.", at: Date.now() - 2 * 3600000 }, { name: "Amara O.", usd: 2140, message: "For the Nakuru school.", at: Date.now() - 3 * DAY }, { name: "Jonas W.", usd: 1875, message: "", at: Date.now() - 6 * DAY }, { name: "Priya S.", usd: 1420, message: "Thank you for the work you do.", at: Date.now() - 9 * DAY }],
    allocation: [["Boreholes and pumps", 78], ["Training caretakers", 14], ["Running costs", 8]],
    updates: [{ title: "Drilling starts in Kitui", body: "The rig arrived on Monday and the first three boreholes are scheduled for this month.", at: Date.now() - 5 * DAY }, { title: "We passed 400 supporters", body: "Thank you. Your gifts have already covered 14 hand-pump service kits.", at: Date.now() - 18 * DAY }],
};
export const PEOPLE: [string, number][] = [["Amara O.", 2140], ["Jonas W.", 1875], ["Priya S.", 1420], ["Tomás R.", 960], ["Leila H.", 715]];
export const LEVELS: [number, string, string][] = [[25, "Hand-pump spares", "Keeps one pump running for a year"], [120, "Caretaker training", "Two people trained per village"], [600, "Share of a borehole", "One tenth of a new well"]];
export const initials = (n: string) => n.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
