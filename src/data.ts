import type { FC } from "react";
import { Announcement01, Calendar, Flag01, Heart, HeartHand, Users01 } from "@untitledui/icons";

export const CAUSES = ["Health", "Education", "Clean Water", "Hunger", "Climate", "Animals", "Children", "Disaster Relief", "Refugees", "Women & Girls", "Disability", "Housing", "Mental Health", "Elderly Care", "Human Rights", "Arts & Culture"];
export const REGIONS = ["Africa", "Asia", "Europe", "Latin America", "Middle East", "North America", "Oceania"];
/** Indicative demo rates against USD. Replace with a live rates service. */
export const CURRENCIES: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.78, INR: 84, AED: 3.67 };

export interface Charity { id: number; name: string; tagline: string; cause: string; region: string; country: string; domain: string; total: number; today: number; clicks: number; days: number }

/** Fictional organisations. Demo data only. */
const SEED: [string, string, string, string, string][] = [
    ["Clearwell Trust", "Boreholes and hand pumps for villages past the last road", "Clean Water", "Africa", "Kenya"],
    ["Second Bell Schools", "Evening classes for children who work during the day", "Education", "Asia", "India"],
    ["Open Ladle Kitchens", "Hot meals served daily, no questions asked", "Hunger", "Europe", "United Kingdom"],
    ["Mangrove Line", "Replanting coastal mangroves one kilometre at a time", "Climate", "Asia", "Indonesia"],
    ["Night Bus Clinic", "A mobile clinic that parks where the hospitals aren't", "Health", "Latin America", "Peru"],
    ["Paws Over Borders", "Vet care and rehoming for street animals", "Animals", "Europe", "Romania"],
    ["First Thousand Days", "Nutrition for mothers and babies from pregnancy to age two", "Children", "Africa", "Malawi"],
    ["Roof Before Rain", "Emergency shelter kits delivered within 72 hours", "Disaster Relief", "Asia", "Philippines"],
    ["Welcome Table", "Legal help and language classes for new arrivals", "Refugees", "Middle East", "Jordan"],
    ["Her Ledger", "Bookkeeping training and seed loans for women traders", "Women & Girls", "Africa", "Ghana"],
    ["Ramp & Rail", "Making public buildings usable for wheelchair users", "Disability", "Latin America", "Colombia"],
    ["Quiet Line", "A free listening service staffed through the night", "Mental Health", "Oceania", "New Zealand"],
    ["Tin Roof Collective", "Self-build housing co-ops with shared tools", "Housing", "Africa", "Uganda"],
    ["Sunday Callers", "Weekly visits and phone calls for people living alone", "Elderly Care", "Europe", "Portugal"],
    ["Paper Lantern Library", "Travelling libraries on three-wheelers", "Education", "Asia", "Bangladesh"],
    ["Court Friend", "Free representation for people who can't afford a lawyer", "Human Rights", "North America", "Mexico"],
    ["Salt Marsh Watch", "Community rangers protecting nesting wetlands", "Climate", "Europe", "Netherlands"],
    ["Little Lungs", "Paediatric asthma care in high-smog cities", "Health", "Asia", "Pakistan"],
    ["Loom House", "Keeping handloom weaving alive with paid apprenticeships", "Arts & Culture", "Asia", "India"],
    ["Harvest Relay", "Rescuing unsold produce from markets to food banks", "Hunger", "North America", "Canada"],
    ["Stray Hours", "Weekend spay and neuter camps", "Animals", "Asia", "Thailand"],
    ["River Schoolboats", "Floating classrooms for monsoon-cut-off villages", "Education", "Asia", "Bangladesh"],
    ["Warm Hall", "Heated community rooms through winter", "Elderly Care", "Europe", "Poland"],
    ["Kite String Fund", "Bursaries that cover the last year of school", "Children", "Africa", "Nigeria"],
    ["Two Buckets", "Household water filters and hygiene training", "Clean Water", "Asia", "Nepal"],
    ["After the Flood", "Rebuilding small farms after extreme weather", "Disaster Relief", "Africa", "Mozambique"],
    ["Sister Circuit", "Coding bootcamps for girls aged 12 to 18", "Women & Girls", "Middle East", "Egypt"],
    ["Common Ground Homes", "Tenancy support for families leaving shelters", "Housing", "North America", "United States"],
    ["Signing Hands", "Sign language interpreters in clinics and courts", "Disability", "Africa", "South Africa"],
    ["Reef Nursery", "Growing and replanting coral fragments", "Climate", "Oceania", "Fiji"],
    ["Border Kitchen", "Meals and phone charging at transit points", "Refugees", "Europe", "Greece"],
    ["Open Mic Minds", "Peer support groups for young men", "Mental Health", "Europe", "Ireland"],
];
export const CHARITIES: Charity[] = SEED.map((r, i) => {
    const total = Math.round(18500 * Math.pow(0.89, i) + 400 - i * 4);
    return { id: i + 1, name: r[0], tagline: r[1], cause: r[2], region: r[3], country: r[4], domain: r[0].toLowerCase().replace(/[^a-z]+/g, "") + ".example",
        total, today: Math.round(total * (((i * 37) % 11) / 60 + 0.01)), clicks: Math.round(total * (2.2 + ((i * 13) % 7) / 3)), days: 3 + ((i * 17) % 44) };
});
export interface Activity { who: string; usd: number; at: number }
const MIN = 60000;
export const ACTIVITY: Activity[] = [{ who: "Clearwell Trust", usd: 18900, at: Date.now() - 49 * MIN }, { who: "Harvest Relay", usd: 2810, at: Date.now() - 130 * MIN }, { who: "Quiet Line", usd: 6120, at: Date.now() - 310 * MIN }, { who: "Reef Nursery", usd: 1050, at: Date.now() - 560 * MIN }];
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
