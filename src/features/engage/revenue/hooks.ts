/**
 * Revenue dashboards' data for the Engage screens: one hook per dashboard, plus the export / import / settings calls.
 * Every read is a SQL function from migration 20261128100000 (viewer or higher). In the demo (ws.sample) the hooks return the
 * prototype's sample figures (sample.ts) and the shell labels the page "Sample data". Tonight refreshes as gifts land.
 */
import { useEffect, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import type { DB } from "@/shared/lib/db";
import type { Load } from "../overview/data";
import { useWorkspace } from "../shell/workspace";
import { toCsv, type Addons, type Campaign, type Filters, type FunnelGroup, type FunnelRow, type SourceGroup, type SourceRow, type Tonight } from "./model";
import type { ImportRow, Tool } from "./importer";
import { SAMPLE_ADDONS, SAMPLE_CAMPAIGN, SAMPLE_FUNNEL, SAMPLE_SOURCES, SAMPLE_TONIGHT } from "./sample";

const NOT_ALLOWED = "Figures could not be loaded. Only the charity’s team can see them.";

/** Calls `name` with { org, ...args } and keeps the result; `live` reloads on every gift for the org and once a minute. */
const useRpc = <T,>(name: string, args: Record<string, unknown>, sample: T, live = false): Load<T> => {
    const { db } = useApp();
    const ws = useWorkspace();
    const [s, setS] = useState<Load<T>>({ state: "loading" });
    const key = JSON.stringify(args);
    useEffect(() => {
        if (ws.sample) return;
        let off = false;
        const load = () => db.rpc<T>(name, { org: ws.org.id, ...JSON.parse(key) })
            .then((data) => !off && setS({ state: "ready", data }), (e) => { console.error(name, e); if (!off) setS({ state: "empty", why: NOT_ALLOWED }); });
        void load();
        if (!live) return () => { off = true; };
        const unsub = db.onDonations(ws.org.id, () => void load()), t = setInterval(load, 60000);
        return () => { off = true; unsub(); clearInterval(t); };
    }, [db, ws.org.id, ws.sample, name, key, live]);
    return ws.sample ? { state: "ready", data: sample } : s;
};

/** The night in filters.night, else tonight, else the last night with gifts. Live. */
export const useTonight = (f: Filters = {}) => useRpc<Tonight>("revenue_tonight", { f }, SAMPLE_TONIGHT, true);
/** Totals, median, rhythm mix, by day / night / fund / campaign. */
export const useCampaign = (f: Filters = {}) => useRpc<Campaign>("revenue_campaign", { f }, SAMPLE_CAMPAIGN);
/** One row per channel (or ad campaign, QR code, fundraiser...). Derive conversion, average and ROAS with sourceStats. */
export const useSources = (f: Filters = {}, by: SourceGroup = "channel") => useRpc<SourceRow[]>("revenue_sources", { f, grp: by }, by === "channel" ? SAMPLE_SOURCES : []);
/** Sessions per step by device (or layout, channel), with an "all" row. Derive rates with funnelStats. */
export const useFunnel = (f: Filters = {}, by: FunnelGroup = "device") => useRpc<FunnelRow[]>("revenue_funnel", { f, grp: by }, by === "device" ? SAMPLE_FUNNEL : SAMPLE_FUNNEL.slice(0, 1));
/** Take-up and extra dollars per add-on, and the fee-cover rate. Derive rates with addonStats. */
export const useAddons = (f: Filters = {}) => useRpc<Addons>("revenue_addons", { f }, SAMPLE_ADDONS);

// ---------------------------------------------------------------- export, import, settings (editor / admin; the SQL checks)
/** Every gift with its tags and donor details as CSV text. */
export const exportCsv = async (db: DB, org: string, f: Filters = {}) => toCsv(await db.rpc<Record<string, unknown>[]>("revenue_export", { org, f }));

export type ImportResult = { batch_id: string | null; rows: number; invalid: number; duplicates: number; new: number; imported: number; total_cents: number };
/** dry (default): counts only. Then call again with dry = false to keep them. Send parseImport(text).rows. */
export const importGifts = (db: DB, org: string, tool: Tool, filename: string, rows: ImportRow[], dry = true) =>
    db.rpc<ImportResult>("revenue_import", { org, tool, filename, rows, dry });
export const undoImport = (db: DB, batch: string) => db.rpc<void>("revenue_import_undo", { batch });
export type ImportBatch = { id: string; tool: Tool; filename: string; rows: number; imported: number; skipped: number; total_cents: number; created_at: string };
export const listImports = (db: DB, org: string) => db.rpc<ImportBatch[]>("revenue_imports_list", { org });

export type RevenueSettings = {
    timezone: string; ramadan_start: string | null; report_to: string[]; report_hour: number;
    ads_opt_in: boolean; ga4_id: string | null; meta_pixel_id: string | null; ad_spend: Record<string, number>;
};
export const getSettings = (db: DB, org: string) => db.rpc<RevenueSettings | null>("revenue_settings_get", { org });
/** Admins. Send only the keys to change. */
export const saveSettings = (db: DB, org: string, s: Partial<RevenueSettings>) => db.rpc<RevenueSettings>("revenue_settings_save", { org, s });
