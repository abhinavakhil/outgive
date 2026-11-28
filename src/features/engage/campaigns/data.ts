/**
 * The Campaigns screen's data. Live: the page from bio_get (campaigns, funds, raised by campaign) and saved back with bio_save;
 * keywords through sms_keywords_* (migration 20261128700000). Demo (ws.sample): Hope Foundation's sample, in memory, nothing saved.
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import { useWorkspace } from "../shell/workspace";
import { type ApplyOptions, type Page, type Template, applyTemplate, templateOf } from "./templates";

export type Keyword = { keyword: string; fund: string; amount_cents: number | null; appeal: string };
type BioGet = { bio: Page | null; stats: { by_cause: Record<string, { cents: number }> } } | null;

/** The demo's "today": the Monday after Eid, as on the Overview. */
export const SAMPLE_TODAY = "2027-03-15";
/** The text-to-give number. Set VITE_SMS_NUMBER to the Outgive Twilio number once it is registered. */
export const SMS_NUMBER: string | null = import.meta.env.VITE_SMS_NUMBER || null;
const SAMPLE_NUMBER = "(212) 555-0148";

const samplePage = (): Page => {
    const o = (x: Partial<ApplyOptions> = {}) => ({ orgName: "Hope Foundation", today: "2026-11-20", ...x });
    let p = applyTemplate(null, templateOf("ramadan"), o({ title: "Ramadan appeal", goal: 300000 }));
    p = applyTemplate(p, templateOf("building"), o({ title: "Building fund", goal: 150000, today: "2026-09-04" }));
    p = applyTemplate(p, templateOf("jumuah"), o({ today: "2026-10-02" }));
    p = applyTemplate(p, templateOf("dhul-hijjah"), o({ title: "Qurbani 1448", goal: 40000 }));
    return p;
};
const SAMPLE_RAISED: Record<string, number> = { "ramadan-2027": 249120, "building-2026": 66420, "jumuah-2026": 8640 };
const SAMPLE_KEYWORDS: Keyword[] = [
    { keyword: "BUILD", fund: "general", amount_cents: 2500, appeal: "the building fund" },
    { keyword: "IFTAR", fund: "general", amount_cents: 5000, appeal: "Iftar 1448" },
    { keyword: "ZAKAT", fund: "zakat", amount_cents: null, appeal: "Zakat" },
];

export const useCampaigns = () => {
    const { db } = useApp();
    const ws = useWorkspace();
    const [state, setState] = useState<"loading" | "ready" | "error">(ws.sample ? "ready" : "loading");
    const [error, setError] = useState("");
    const [page, setPage] = useState<Page | null>(() => (ws.sample ? samplePage() : null));
    const [raised, setRaised] = useState<Record<string, number>>(ws.sample ? SAMPLE_RAISED : {});
    const [keywords, setKeywords] = useState<Keyword[]>(ws.sample ? SAMPLE_KEYWORDS : []);
    const today = ws.sample ? SAMPLE_TODAY : new Date().toISOString().slice(0, 10);

    const loadPage = useCallback(async () => {
        const r = await db.rpc<BioGet>("bio_get", { s: ws.org.slug });
        setPage(r?.bio ?? null);
        setRaised(Object.fromEntries(Object.entries(r?.stats.by_cause ?? {}).map(([k, v]) => [k, v.cents / 100])));
        return r?.bio ?? null;
    }, [db, ws.org.slug]);

    useEffect(() => {
        if (ws.sample) return;
        let off = false;
        Promise.all([loadPage(), db.rpc<Keyword[]>("sms_keywords_list", { org: ws.org.id }).catch(() => [] as Keyword[])])
            .then(([, k]) => { if (!off) { setKeywords(k ?? []); setState("ready"); } })
            .catch((e) => { if (!off) { setError((e as Error).message); setState("error"); } });
        return () => { off = true; };
    }, [db, ws.org.id, ws.sample, loadPage]);

    /** Adds the template's appeal to the page. Live, it reads the page again first so a change made elsewhere is kept. */
    const apply = async (t: Template, o: Omit<ApplyOptions, "orgName" | "today">) => {
        const opts = { ...o, orgName: ws.org.name, today };
        if (ws.sample) { setPage((p) => applyTemplate(p, t, opts)); return; }
        const next = applyTemplate(await loadPage(), t, opts);
        await db.rpc("bio_save", { org: ws.org.id, b: next });
        setPage(next);
    };
    const saveKeyword = async (k: Keyword) => {
        const row = ws.sample ? k : await db.rpc<Keyword>("sms_keyword_save", { org: ws.org.id, k });
        setKeywords((ks) => [...ks.filter((x) => x.keyword !== row.keyword), row].sort((a, b) => a.keyword.localeCompare(b.keyword)));
    };
    const removeKeyword = async (kw: string) => {
        if (!ws.sample) await db.rpc("sms_keyword_delete", { org: ws.org.id, kw });
        setKeywords((ks) => ks.filter((x) => x.keyword !== kw));
    };
    return { state, error, page, raised, keywords, today, number: ws.sample ? SAMPLE_NUMBER : SMS_NUMBER, sample: ws.sample, apply, saveKeyword, removeKeyword };
};
