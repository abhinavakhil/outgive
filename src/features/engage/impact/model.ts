/** Personal impact reports: a fund's money as things, using the charity's own costs. Shared with the journey-run edge function. */
export { impactLines, impactSentence, money } from "../../../../supabase/functions/journey-run/model";
export type { ImpactLine, Unit } from "../../../../supabase/functions/journey-run/model";
import type { Unit } from "../../../../supabase/functions/journey-run/model";

/** impact_report_by_token(token): what the public /impact/<token> page shows. No contact details. */
export interface Report {
    org_name: string; org_slug: string; logo_url: string; currency: string; season: string; starts: string; ends: string;
    first_name: string | null; funds: Record<string, number>; gifts: number; units: Unit[]; monthly: boolean; give_url: string;
}
export const totalOf = (r: Pick<Report, "funds">) => Object.values(r.funds).reduce((n, c) => n + Number(c), 0);
