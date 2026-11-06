import type { Variant } from "@/shared/domain/model";

export const REGIONS = ["Africa", "Asia", "Europe", "Latin America", "Middle East", "North America", "Oceania"];
/** Who can hold a rank on a charity's board. */
export const KINDS = ["Individuals", "Teams", "Companies", "Schools"];

/** The races a supporter can win. Money boards rank by gifts; the other two let a small donor lead. */
export type BoardKey = "total" | "week" | "today" | "recruited" | "streak";
export const BOARDS: { key: BoardKey; label: string; title: string; money: boolean; note: string }[] = [
    { key: "total", label: "All-time", title: "All-time ranking", money: true, note: "" },
    { key: "week", label: "This week", title: "This week's ranking", money: true, note: "Resets every Monday at 00:00 UTC. Each week's winner goes to the hall of fame." },
    { key: "today", label: "Today", title: "Today's ranking", money: true, note: "Resets at 00:00 UTC." },
    { key: "recruited", label: "Recruiters", title: "Most donors recruited", money: false, note: "Ranked by donors brought in through a fundraising page, not by money given." },
    { key: "streak", label: "Streaks", title: "Longest monthly streak", money: false, note: "Ranked by consecutive months of giving. Any amount counts." },
];

export const VARIANTS: [Variant, string][] = [["list", "List"], ["podium", "Podium"], ["race", "Race"], ["league", "League"], ["levels", "Levels"], ["arcade", "Arcade"], ["spotlight", "Spotlight"], ["spotpodium", "Spotlight podium"], ["ribbons", "Ribbons"]];
