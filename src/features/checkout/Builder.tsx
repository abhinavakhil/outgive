/**
 * The checkout builder's data: an organisation's layout and add-ons (checkout_settings), add-on take-up, and its A/B tests
 * (checkout_experiments). The screen is Engage's "Checkout builder" section (src/features/engage/checkout), which takes these
 * through the feature index. Demo figures for the in-browser demo are here too, labelled as samples.
 */
import type { DB } from "@/shared/lib/db";
import type { Arm, Variant } from "./experiments";
import { type CheckoutSettings, toSettings } from "./us";

export const loadSettings = (db: DB, org: string) => db.rpc<Partial<CheckoutSettings> | null>("checkout_settings_get", { org }).then(toSettings);
export const saveSettings = (db: DB, org: string, s: CheckoutSettings) => db.rpc<void>("checkout_settings_save", { org, s });
/** Share of paid gifts in the last `days` that carried each add-on line (from donations.details.lines). */
export const addonTakeup = (db: DB, org: string, days = 7) => db.rpc<{ key: string; gifts: number; share: number }[]>("checkout_addon_takeup", { org, days });

export interface ExperimentResult { id: string; name: string; kind: "amounts" | "layout"; status: "running" | "stopped"; started_at: string; stopped_at: string | null; variants: (Variant & Pick<Arm, "visitors" | "gifts" | "raised_cents">)[] }
export const listExperiments = (db: DB, org: string) => db.rpc<ExperimentResult[]>("checkout_experiment_results", { org });
/** Starts a test (stopping any running one). Admins only. */
export const startExperiment = (db: DB, org: string, e: { name: string; kind: "amounts" | "layout"; variants: Variant[] }) => db.rpc<string>("checkout_experiment_save", { org, p: e });
export const stopExperiment = (db: DB, org: string, id: string) => db.rpc<string>("checkout_experiment_save", { org, p: { stop: id } });

/** Sample figures for the demo (the prototype's): add-on take-up, last 7 days. */
export const SAMPLE_TAKEUP = [{ key: "cover", share: 0.71 }, { key: "alfitr", share: 0.34 }, { key: "nights", share: 0.18 }, { key: "monthly", share: 0.09 }, { key: "dedication", share: 0.06 }, { key: "roundup", share: 0.024 }];
/** A sample test for the demo: the usual ask ladder against one a step higher. */
export const SAMPLE_EXPERIMENTS: ExperimentResult[] = [{
    id: "sample-ask", name: "Higher ask ladder", kind: "amounts", status: "running", started_at: "2027-02-20T00:00:00Z", stopped_at: null,
    variants: [
        { id: "a", label: "$25 · $50 · $100 · $250", presets: [25, 50, 100, 250], visitors: 1840, gifts: 221, raised_cents: 2061900 },
        { id: "b", label: "$50 · $100 · $250 · $500", presets: [50, 100, 250, 500], visitors: 1812, gifts: 197, raised_cents: 2486400 },
    ],
}];
