/**
 * Receipts, EIN check and fraud controls: the shapes the SQL API returns (supabase/migrations/20261128200000_receipts_ein_fraud.sql)
 * and the logic the screens share with the edge functions. The logic lives with the functions (Deno) and is re-exported here, so the
 * receipt preview, the EIN steps and the fraud verdicts on screen are exactly what the server does.
 */
export * from "../../../../supabase/functions/_shared/receipts/receipt";
export * from "../../../../supabase/functions/_shared/fraud/rules";
export { CACHE_DAYS, fromProPublica, nameMatches, parseEin, SANDBOX, verdict, type EinRecord, type EinResult, type EinStatus } from "../../../../supabase/functions/ein-check/logic";
import type { FraudSettings, Reason } from "../../../../supabase/functions/_shared/fraud/rules";
import type { EinStatus } from "../../../../supabase/functions/ein-check/logic";

/** compliance_get(org). */
export interface Compliance {
    legal_name: string; ein: string; address: string;
    /** Where donors' replies go (Reply-To on every email); "" when not set. Saved with org_contact_email_save. */
    contact_email: string; ein_status: EinStatus | "unverified"; ein_checked_at: string | null;
    ein_check: { ein: string; source: "propublica" | "sandbox"; found: boolean; name: string; city: string; state: string; subsection: number | null; deductibility: number | null; revoked: boolean; checked_at: string } | null;
    receipt_prefix: string; receipt_now: boolean; receipt_year_end: boolean; receipt_goods_line: boolean;
    /** Receipts issued but not emailed yet (the Overview's "Receipts to send"). */
    receipts_unsent: number;
    /** False for a US charity until its EIN is verified: the pay function refuses gifts. */
    payments_ready: boolean;
    fraud: FraudSettings;
}
export type ComplianceInput = Partial<Pick<Compliance, "legal_name" | "ein" | "address" | "contact_email" | "receipt_prefix" | "receipt_now" | "receipt_year_end" | "receipt_goods_line">>;

/** fraud_log(org, days): the "blocked this week" card. */
export interface FraudLog {
    blocked: number; challenged: number; declines: number;
    by_reason: { reason: Reason; n: number; last: string }[];
    recent: { at: string; kind: "block" | "alert"; reason: Reason | "decline_burst"; amount_cents: number | null; email_domain: string | null }[];
    alerts: { at: string; reason: "decline_burst" }[];
}
