/** The impact SQL API, typed. */
import type { DB } from "@/shared/lib/db";
import type { Report, Unit } from "./model";

export type SavedUnit = Unit & { id: string; org_id: string; sort: number };
export const listUnits = (db: DB, org: string) => db.rpc<SavedUnit[]>("impact_units_list", { org });
/** Replaces the whole list, in this order. Editor or higher. */
export const saveUnits = (db: DB, org: string, units: Unit[]) => db.rpc<SavedUnit[]>("impact_units_save", { org, units });
/** A donor's report token (made on first use), to open /impact/<token>. key from journey_donors_list. Viewer or higher. */
export const reportLink = (db: DB, org: string, key: string) => db.rpc<string>("impact_report_link", { org, k: key });
/** Public, by token. Null when unknown. Counts a view. */
export const reportByToken = (db: DB, token: string) => db.rpc<Report | null>("impact_report_by_token", { token });
