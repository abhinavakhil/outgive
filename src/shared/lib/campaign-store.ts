/**
 * Campaigns made in the create flow, kept in this browser until the campaigns API exists.
 * Every call is async and shaped like the API it stands in for (create / get / list / update / donate), so swapping in
 * `fetch("/api/campaigns…")` later changes only this file.
 *
 * Storage: a cookie (og_cs) lists the ids of the campaigns made in this browser; each record and its photos live in
 * localStorage under that id. Records used to sit in the cookies themselves, but cookies ride along on every request:
 * twenty campaigns made ~18KB of headers and the server refused every request (431), so only the ids stay there.
 * ponytail: one browser's storage (~5MB, photos included); the API removes the limit.
 */
import type { Donation, PageType } from "@/shared/domain/model";

export interface Campaign {
    id: string;
    type: PageType;
    slug: string;
    title: string;
    /** The charity the gifts go to. */
    charity: string;
    /** Goal in USD, like every amount in the app; `money()` shows it in the visitor's currency. */
    goal: number;
    /** First line of the story, shown large, and the rest of it as plain text with blank lines between paragraphs. */
    lead: string;
    body: string;
    /** Donation buttons, in USD. */
    gifts: number[];
    /** Answers specific to the type: team name, target and unit, event date, the person remembered. */
    details: Record<string, string>;
    /** Data URLs; the first is the cover. Stored apart from the record so a full quota drops photos, not the campaign. */
    photos: string[];
    /** Who made the page (the signed-in person's name), shown as "Organised by". */
    organiser?: string;
    /** A YouTube link (watch, youtu.be or Shorts) shown with the photos, or absent. */
    video?: string;
    /** The page this one raises for, by its address key ("c/clean-water"). */
    parentId?: string;
    createdAt: number;
    raised: number;
    donations: Donation[];
}
export type NewCampaign = Omit<Campaign, "id" | "createdAt" | "raised" | "donations">;

const INDEX = "og_cs";
const YEAR = 60 * 60 * 24 * 365;

/** Raw cookie values: callers pass strings that are already cookie-safe (encodeURIComponent output or plain ids). */
const readCookie = (name: string): string | null => {
    const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
    return hit ? hit.slice(name.length + 1) : null;
};
const writeCookie = (name: string, value: string, maxAge = YEAR) => {
    document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
};
/** The cookie holds only the list of campaign ids (8 characters each), so it stays tiny on every request. */
const ids = () => (readCookie(INDEX) ?? "").split(",").filter(Boolean);

const save = (c: Campaign) => {
    const { photos, ...rest } = c;
    localStorage.setItem(`og_c_${c.id}`, JSON.stringify(rest));
    if (!ids().includes(c.id)) writeCookie(INDEX, [...ids(), c.id].join(","));
    if (photos) savePhotos(c.id, photos);
};
const load = (id: string): Campaign | null => {
    migrate(id);
    try { const raw = localStorage.getItem(`og_c_${id}`); return raw ? { ...(JSON.parse(raw) as Omit<Campaign, "photos">), photos: loadPhotos(id) } : null; } catch { return null; }
};
/** Records saved by the first version lived in chunked cookies (og_c_<id>_<n>); move them into localStorage once. */
const migrate = (id: string) => {
    const parts = Number(readCookie(`og_c_${id}`) ?? 0);
    if (!parts) return;
    let raw = "";
    for (let i = 0; i < parts; i++) raw += readCookie(`og_c_${id}_${i}`) ?? "";
    try { localStorage.setItem(`og_c_${id}`, decodeURIComponent(raw)); } catch { return; }
    for (let i = 0; i < parts; i++) writeCookie(`og_c_${id}_${i}`, "", 0);
    writeCookie(`og_c_${id}`, "", 0);
};
/** Saves as many photos as fit; a full localStorage keeps the cover and drops the rest rather than losing the campaign. */
const savePhotos = (id: string, photos: string[]) => {
    for (let n = photos.length; n >= 0; n--) {
        try { if (n) localStorage.setItem(`og_p_${id}`, JSON.stringify(photos.slice(0, n))); else localStorage.removeItem(`og_p_${id}`); return n; } catch { /* over quota: try fewer */ }
    }
    return 0;
};
const loadPhotos = (id: string): string[] => { try { return JSON.parse(localStorage.getItem(`og_p_${id}`) ?? "[]"); } catch { return []; } };

const slugTaken = (type: PageType, slug: string) => ids().some((id) => { const c = load(id); return c?.type === type && c.slug === slug; });

export const campaigns = {
    async create(input: NewCampaign): Promise<Campaign> {
        let slug = input.slug || "campaign";
        for (let n = 2; slugTaken(input.type, slug); n++) slug = `${input.slug}-${n}`;
        const c: Campaign = { ...input, slug, id: crypto.randomUUID().slice(0, 8), createdAt: Date.now(), raised: 0, donations: [] };
        save(c);
        return { ...c, photos: loadPhotos(c.id) };
    },
    async get(type: PageType, slug: string): Promise<Campaign | null> {
        for (const id of ids()) { const c = load(id); if (c && c.type === type && c.slug === slug) return c; }
        return null;
    },
    /** Pages raising for this one (fundraisers and teams that joined it), keyed by its address, e.g. "c/clean-water". */
    async children(key: string): Promise<Campaign[]> {
        return ids().map(load).filter((c): c is Campaign => !!c && c.parentId === key).sort((a, b) => b.raised - a.raised);
    },
    async list(): Promise<Campaign[]> {
        return ids().map(load).filter((c): c is Campaign => !!c).sort((a, b) => b.createdAt - a.createdAt);
    },
    async update(id: string, patch: Partial<NewCampaign>): Promise<Campaign> {
        const c = load(id);
        if (!c) throw new Error("That campaign no longer exists in this browser.");
        const next = { ...c, ...patch };
        save(next);
        return next;
    },
    /** Records a gift. Keeps the 50 newest so a busy page doesn't fill this browser's storage. */
    async donate(id: string, d: Donation): Promise<Campaign> {
        const c = load(id);
        if (!c) throw new Error("That campaign no longer exists in this browser.");
        const next = { ...c, raised: c.raised + d.usd, donations: [d, ...c.donations].slice(0, 50) };
        save(next);
        return next;
    },
    async remove(id: string): Promise<void> {
        migrate(id);
        writeCookie(INDEX, ids().filter((x) => x !== id).join(","));
        try { localStorage.removeItem(`og_c_${id}`); localStorage.removeItem(`og_p_${id}`); } catch { /* ignore */ }
    },
};
