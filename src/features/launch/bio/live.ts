/**
 * The Ramadan page with Supabase connected: content saved on the org (orgs.bio) and the numbers from paid gifts (bio_get).
 * Gifts landing while the page is open refresh it (the donations broadcast). In demo mode nothing here runs and the page keeps its sample data.
 */
import { useEffect, useState } from "react";
import { db, isDemo } from "@/shared/lib/db";
import type { BioPage } from "./model";
import type { Gift, Supporter } from "./BioView";

/** The charity /ramadhan belongs to (seeded by migration 20261127000000). */
export const RAMADAN_ORG = "clearwell";

export type Stats = {
    raised_cents: number; gifts: number; donors: number;
    by_cause: Record<string, { cents: number; donors: number }>;
    recent: { name: string; amount_cents: number; cause: string; created_at: string }[];
    top: { name: string; amount_cents: number }[];
};
export type Live = { org_id: string; currency: string; bio: BioPage | null; accepts: string[]; stripe_account: string | null; stats: Stats };

const ago = (iso: string, now: number) => {
    const m = Math.max(1, Math.round((now - Date.parse(iso)) / 60000));
    return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} hr` : `${Math.round(m / 1440)} d`;
};

/** The page with real raised figures per campaign and cause, and real supporters and gifts. */
export const withStats = (page: BioPage, s: Stats, now = Date.now()): { page: BioPage; supporters: Supporter[]; gifts: Gift[] } => {
    const fill = <T extends { id: string; raised: number; donors?: number }>(x: T): T => ({ ...x, raised: (s.by_cause[x.id]?.cents ?? 0) / 100, donors: s.by_cause[x.id]?.donors ?? 0 });
    return {
        page: { ...page, campaigns: page.campaigns.map(fill), causes: page.causes.map(fill), backers: s.donors },
        supporters: s.top.map((t) => [t.name, t.amount_cents / 100, "Individual"]),
        gifts: s.recent.map((g) => [g.name, g.amount_cents / 100, g.cause, ago(g.created_at, now)]),
    };
};

/** The live org and stats, or null in demo mode and while loading. */
export const useLive = (slug = RAMADAN_ORG) => {
    const [live, setLive] = useState<Live | null>(null);
    useEffect(() => {
        if (isDemo) return;
        let off = false, unsub = () => {};
        void db().then(async (d) => {
            const load = async () => { const r = await d.rpc<Live | null>("bio_get", { s: slug }); if (!off && r) setLive(r); return r; };
            const first = await load().catch((e) => { console.error("bio_get", e); return null; });
            if (first && !off) unsub = d.onDonations(first.org_id, () => void load());
        });
        return () => { off = true; unsub(); };
    }, [slug]);
    return live;
};
