/** The receipts / EIN / fraud SQL API and edge functions, typed. Every call goes through db (src/shared/lib/db.ts). */
import type { DB } from "@/shared/lib/db";
import type { Compliance, ComplianceInput, EinResult, FraudLog, FraudSettings, Receipt, ReceiptRow } from "./model";

export const getCompliance = (db: DB, org: string) => db.rpc<Compliance>("compliance_get", { org });
/** Admin. A changed EIN or legal name sets ein_status back to unverified (payments stop until checked again). */
export const saveCompliance = (db: DB, org: string, p: ComplianceInput) => db.rpc<Compliance>("compliance_save", { org, p });
/** Admin. Looks the EIN up (sandbox or ProPublica), stores the verdict on the org. Without ein, the saved one is checked. */
/** Admin. Donors' replies to receipts and journey emails go here; "" clears it. */
export const saveContactEmail = (db: DB, org: string, email: string) => db.rpc<string>("org_contact_email_save", { org, email });
export const checkEin = (db: DB, org_id: string, ein?: string, refresh = false) => db.fn<EinResult>("ein-check", { org_id, ...(ein ? { ein } : {}), refresh });
export const saveFraud = (db: DB, org: string, p: Partial<FraudSettings>) => db.rpc<FraudSettings & { org_id: string }>("fraud_settings_save", { org, p });
export const fraudLog = (db: DB, org: string, days = 7) => db.rpc<FraudLog>("fraud_log", { org, days });
export const listReceipts = (db: DB, org: string, yr?: number, kind?: Receipt["kind"]) => db.rpc<ReceiptRow[]>("receipts_list", { org, ...(yr ? { yr } : {}), ...(kind ? { k: kind } : {}) });
/** Public, keyed by the donation id: the thank-you page's receipt (issued now if the gift is paid). pdf_url opens the PDF. */
export const receiptForGift = (db: DB, donation_id: string) => db.fn<{ id: string; receipt: Receipt; text: string; pdf_url: string; sent_at: string | null }>("receipt-send", { donation_id });
/** Editor. Emails a receipt or statement again. */
export const resendReceipt = (db: DB, receipt_id: string) => db.fn<{ sent: boolean }>("receipt-send", { receipt_id, action: "send" });
/** Admin. Issues and emails the year's statements for one charity (dry_run only counts donors). */
export const runYearEnd = (db: DB, org_id: string, year?: number, dry_run = false) => db.fn<{ year: number; orgs: number; donors: number; issued: number; sent: number; unsent: number }>("year-end-statements", { org_id, ...(year ? { year } : {}), dry_run });
