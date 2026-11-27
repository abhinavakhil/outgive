/**
 * The charity's Ramadan page (/ramadhan): everything the page shows and how it looks, as one object.
 * Saved in this browser until the backend is connected; the editor at /ramadhan/edit writes it, the page reads it.
 */
import { useCallback, useEffect, useState } from "react";

export type BlockId = "banner" | "totals" | "ways" | "campaigns" | "causes" | "supporters" | "gifts" | "journey" | "links";
export const BLOCK_NAMES: Record<BlockId, string> = { banner: "Ramadan banner", totals: "Appeal totals", ways: "Ways to give", campaigns: "Campaigns", causes: "Causes", supporters: "Top supporters", gifts: "Recent gifts", journey: "Our journey", links: "Links" };

/** impact: the headline outcome ("800 children"). price/per: what one gift buys ("£25 a child"). tag: a short label for the list row. */
export type Campaign = { id: string; title: string; text: string; raised: number; goal: number; art: number; illo?: string; ends: string; impact?: string; price?: number; per?: string; tag?: string; donors?: number };
export type Cause = { id: string; title: string; note: string; raised: number; goal: number; icon: string; amounts: number[] };
export type Link = { id: string; label: string; url: string };
export type Step = { id: string; title: string; text: string; done: boolean };

export type Theme = {
    colour: string;
    /** outline: cream page, black outlines, gradient grid hero. soft: colour wash, white cards. bold: the page in the charity colour. */
    style: "outgive" | "outline" | "soft";
    corners: "round" | "pill" | "square";
    font: "Outfit" | "DM Sans" | "Space Grotesk" | "Fraunces";
    causes: "list" | "grid";
};

export type BioPage = {
    name: string; tagline: string; charityNo: string; logo: string; avatar: string;
    socials: { instagram: string; whatsapp: string; website: string; email: string };
    ramadanStart: string;
    theme: Theme;
    blocks: { id: BlockId; on: boolean }[];
    campaigns: Campaign[]; causes: Cause[]; links: Link[]; journey: Step[];
    /** People who have given, from live data (bio/live.ts). Unset on the sample page. */
    backers?: number;
};

export const ICONS = {
    water: "M12 3.5s6 6.2 6 10.7a6 6 0 01-12 0c0-4.5 6-10.7 6-10.7z",
    shield: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z",
    bowl: "M4 11h16a8 8 0 01-16 0zM9 7.5c0-1.5 1-1.5 1-3M14 7.5c0-1.5 1-1.5 1-3",
    heart: "M12 20l-7-7a4.2 4.2 0 016-6l1 1 1-1a4.2 4.2 0 016 6z",
    bookmark: "M7 4h10v16l-5-3-5 3z",
    book: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16",
    home: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z",
    gift: "M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9C9 9 7 4 10 4s2 5 2 5c0-0 1-5 2-5 3 0 1 5-2 5",
} as const;
export type IconKey = keyof typeof ICONS;

export const DEFAULT_PAGE: BioPage = {
    name: "Clearwell Trust", tagline: "Clean water for 40 villages", charityNo: "[Registered charity no.]", logo: "", avatar: "CT",
    socials: { instagram: "", whatsapp: "", website: "", email: "" },
    ramadanStart: "2027-02-08",
    theme: { colour: "#F0783C", style: "outgive", corners: "round", font: "Outfit", causes: "grid" },
    blocks: (["links", "banner", "totals", "ways", "campaigns", "causes", "supporters", "gifts", "journey"] as BlockId[]).map((id) => ({ id, on: true })),
    campaigns: [
        { id: "c1", title: "Water for Kitui", text: "Three boreholes for villages in Kitui, Kenya.", raised: 174961, goal: 250000, art: 0, illo: "water", ends: "2027-03-09", impact: "3 boreholes", price: 50, per: "a family", donors: 2140 },
        { id: "c2", title: "1,000 iftars a night", text: "Hot meals at sunset in Gaziantep and Idlib.", raised: 24060, goal: 30000, art: 3, illo: "food", ends: "2027-03-09", impact: "1,000 meals a night", price: 4, per: "a meal", tag: "Tonight", donors: 1210 },
        { id: "c3", title: "Eid gifts for orphans", text: "A new outfit and a gift for 800 children.", raised: 9800, goal: 20000, art: 2, illo: "orphans", ends: "2027-03-10", impact: "800 children", price: 25, per: "a child", donors: 392 },
        { id: "c4", title: "Winter kits for Gaza", text: "Blankets, coats and heaters for 500 families.", raised: 31200, goal: 60000, art: 1, illo: "emergency", ends: "2027-03-09", price: 60, per: "a kit", tag: "Urgent", donors: 640 },
        { id: "c5", title: "Rebuild 20 homes", text: "Flood-proof homes in Sindh, Pakistan.", raised: 18400, goal: 80000, art: 3, illo: "shelter", ends: "2027-03-09", price: 250, per: "a room", tag: "23 days", donors: 180 },
        { id: "c6", title: "Qur'an school in Sylhet", text: "Classrooms and teachers for 120 children.", raised: 6200, goal: 15000, art: 0, illo: "education", ends: "2027-03-10", price: 50, per: "a desk", tag: "Sadaqah Jariyah", donors: 96 },
    ],
    causes: [
        { id: "zakat", title: "Zakat", note: "Paid to those eligible, 100% policy", raised: 38240, goal: 50000, icon: "zakat", amounts: [50, 100, 250] },
        { id: "water", title: "Water", note: "Wells and handpumps for villages", raised: 21400, goal: 30000, icon: "water", amounts: [25, 50, 100] },
        { id: "emergency", title: "Emergency", note: "Food, medicine and blankets, sent fast", raised: 16200, goal: 40000, icon: "emergency", amounts: [20, 50, 100] },
        { id: "shelter", title: "Shelter", note: "Homes rebuilt after floods and war", raised: 9400, goal: 25000, icon: "shelter", amounts: [50, 150, 300] },
        { id: "food", title: "Food and iftar", note: "£4 feeds one person at sunset", raised: 12060, goal: 15000, icon: "food", amounts: [20, 40, 100] },
        { id: "orphans", title: "Orphans", note: "Monthly support for a child", raised: 12400, goal: 20000, icon: "orphans", amounts: [15, 30, 60] },
        { id: "education", title: "Education", note: "Books, teachers and school fees", raised: 5300, goal: 12000, icon: "education", amounts: [15, 30, 75] },
        { id: "health", title: "Health", note: "Clinics, medicine and eye camps", raised: 7800, goal: 15000, icon: "health", amounts: [25, 50, 120] },
    ],
    links: [
        { id: "l1", label: "Our 2026 impact report", url: "#" },
        { id: "l2", label: "Volunteer at our iftars", url: "#" },
    ],
    journey: [
        { id: "j1", title: "Appeal launched", text: "Water and iftar for 40 villages", done: true },
        { id: "j2", title: "£100,000 raised", text: "Night 9, with 1,240 supporters", done: true },
        { id: "j3", title: "Well no. 3 completed", text: "Kitui, Kenya: 600 people now have water", done: true },
        { id: "j4", title: "£250,000 goal", text: "Night 27 matched by a sponsor, £1 for £1", done: false },
    ],
};

/** Sample supporters and gifts. These come from real donations once the backend is connected. */
export const SUPPORTERS: [string, number, string][] = [["Amara Okafor", 18900, "Individual"], ["Northfield Rotary", 16861, "Team"], ["Bluefin Logistics", 15046, "Company"], ["St Hilda's Primary", 13430, "School"], ["Jonas Weber", 11991, "Individual"], ["The Tuesday Swimmers", 10711, "Team"]];
/** Recent gifts: who, amount, what it was for (a short tag) and how long ago. */
export const GIFTS: [string, number, string, string][] = [["Grace M.", 150, "Last 10 nights", "4 min"], ["Ridge Runners", 340, "Iftar", "12 min"], ["Anonymous", 100, "Zakat", "25 min"], ["Mateo and Sofia", 106, "Eid gifts", "41 min"]];
/** Gifts per night through Ramadan, and the running total. */
export const PER_NIGHT = [1810, 2240, 1530, 2610, 3120, 2840, 3500, 4010, 5220, 3810, 4430, 4720, 4150, 5610, 4920, 5830, 6240, 5510, 6640, 7020, 8810, 9540, 8420, 10210, 9730, 11040, 16020, 10410, 9120, 7630];

const KEY = "outgive.bio.v6";
const read = (): BioPage => {
    try {
        const s = localStorage.getItem(KEY);
        if (s) { const p = { ...DEFAULT_PAGE, ...JSON.parse(s) } as BioPage; p.theme = { ...DEFAULT_PAGE.theme, ...p.theme }; if (!["outgive", "outline", "soft"].includes(p.theme.style)) p.theme.style = "outgive";
            // Sections added since this page was saved go in at their default place, shown.
            DEFAULT_PAGE.blocks.forEach((b, i) => { if (!p.blocks.some((x) => x.id === b.id)) p.blocks.splice(Math.min(i, p.blocks.length), 0, b); });
            return p;
        }
    } catch { /* storage unavailable */ }
    return DEFAULT_PAGE;
};
const listeners = new Set<(p: BioPage) => void>();

/** The page and a setter; every open copy (page and editor) stays in step, and changes survive a reload. */
export const useBioPage = () => {
    const [page, setPage] = useState<BioPage>(read);
    useEffect(() => { listeners.add(setPage); return () => void listeners.delete(setPage); }, []);
    const update = useCallback((f: (p: BioPage) => BioPage) => {
        const next = f(read());
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
        listeners.forEach((l) => l(next));
    }, []);
    const reset = useCallback(() => { try { localStorage.removeItem(KEY); } catch { /* */ } listeners.forEach((l) => l(DEFAULT_PAGE)); }, []);
    return { page, update, reset };
};

export const uid = () => Math.random().toString(36).slice(2, 8);
export const money = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
/** Ink or white text, whichever reads better on the colour. */
export const onColour = (hex: string) => { const n = parseInt(hex.slice(1, 7), 16) || 0, [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#191919" : "#FFFFFF"; };
export const COLOURS = ["#F0783C", "#5A43F0", "#2B59FF", "#0F7A5C", "#191919", "#D9822B", "#C2416B", "#7B3FD6", "#0E7490"];
