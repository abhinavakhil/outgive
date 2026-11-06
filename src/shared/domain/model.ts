import type { FC } from "react";
import { Announcement01, Calendar, Flag01, Heart, HeartHand, Users01 } from "@untitledui/icons";

export const CAUSES = ["Health", "Education", "Clean Water", "Hunger", "Climate", "Animals", "Children", "Disaster Relief", "Refugees", "Women & Girls", "Disability", "Housing", "Mental Health", "Elderly Care", "Human Rights", "Arts & Culture"];
/** Indicative demo rates against USD. Replace with a live rates service. */
export const CURRENCIES: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.78, INR: 84, AED: 3.67 };

/** One row on the board: a supporter ranked by what they have given to the charity. */
/** week = given since Monday, recruited = donors brought in through a fundraising page, streak = consecutive months of giving, match = cap a company has pledged to match gifts up to. */
export interface Supporter { id: string; name: string; tagline: string; kind: string; region: string; country: string; page: string; total: number; today: number; week: number; recruited: number; streak: number; visits: number; days: number; match?: number }

export interface Activity { who: string; usd: number; at: number; cause?: string; message?: string }

/** How the ranking is drawn. list = rows, podium = top three on a stand, race = bars relative to #1, league = tiers with a promotion line, levels = XP cards with badges, arcade = high-score table,
 * spotlight = top three on a tinted hero with the list as a sheet over it, spotpodium = stepped podium in a dark card, ribbons = full-colour hero with ribbon rank tags. */
/** The nine below are drawn in Leaderboard.tsx; twenty more live in views/boards.tsx and are named by their key there. */
export type Variant = "list" | "podium" | "race" | "league" | "levels" | "arcade" | "spotlight" | "spotpodium" | "ribbons" | (string & {});
export const FONTS = ["Rubik", "Poppins", "Inter", "DM Sans", "Nunito", "Lora"];
/** The charity running this board. Everything a white-label customer changes lives here. */
/** impact = what a gift buys: the cost of one unit in USD and the unit's plural name. */
export interface Brand { name: string; tagline: string; logo: string; color: string; font: string; variant: Variant; impact?: { usd: number; unit: string } }
export const DEFAULT_BRAND: Brand = { name: "Clearwell Trust", tagline: "Clean water for 40 villages", logo: "", color: "#2b59ff", font: "Rubik", variant: "list", impact: { usd: 6000, unit: "boreholes" } };
export const BRAND_PRESETS: Brand[] = [
    DEFAULT_BRAND,
    { name: "Mangrove Line", tagline: "Replanting the coast, one kilometre at a time", logo: "", color: "#1f7a4d", font: "DM Sans", variant: "race", impact: { usd: 25, unit: "mangroves" } },
    { name: "Quiet Line", tagline: "Someone to talk to, all night", logo: "", color: "#5b4bd6", font: "Inter", variant: "podium", impact: { usd: 8, unit: "night calls" } },
    { name: "Little Lungs", tagline: "Paediatric asthma care in high-smog cities", logo: "", color: "#0f6fb5", font: "Nunito", variant: "list", impact: { usd: 40, unit: "inhaler kits" } },
];

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
export const typeOf = (p: Pick<PageData, "type">) => PAGE_TYPES.find((t) => t.id === p.type)!;
export const pct = (p: PageData) => Math.min(100, Math.round((p.raised / Math.max(1, p.goal)) * 100));
export const daysLeft = (p: PageData) => (p.endDate ? Math.max(0, Math.ceil((new Date(p.endDate).getTime() - Date.now()) / 86400000)) : null);
