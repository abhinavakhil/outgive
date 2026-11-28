/** The pledge SQL API and the pledge-recovery function, typed. Every call goes through db (src/shared/lib/db.ts). */
import type { DB } from "@/shared/lib/db";
import type { OfflineMethod, PayLinkPledge, Pledge, PledgeInput, Reminder, Report, Step } from "./model";

export const listPledges = (db: DB, org: string) => db.rpc<Pledge[]>("pledges_list", { org });
/** Create (no id) or change (id + only the keys to change). Write off: { id, written_off: true }. Stop reminders: { id, reminders_paused: true }. */
export const savePledge = (db: DB, org: string, p: PledgeInput) => db.rpc<Omit<Pledge, "status" | "reminders_sent" | "method" | "payments">>("pledge_save", { org, p });
export const addPayment = (db: DB, pledge: string, p: { amount_cents: number; method: OfflineMethod; reference?: string; received_at?: string }) => db.rpc("pledge_payment_add", { pledge, p });
export const removePayment = (db: DB, payment: string) => db.rpc<void>("pledge_payment_remove", { payment });
export const pledgeReport = (db: DB, org: string) => db.rpc<Report>("pledge_report", { org });
export const listSteps = (db: DB, org: string) => db.rpc<Step[]>("pledge_steps_list", { org });
/** Replaces the whole list; steps left out are removed. */
export const saveSteps = (db: DB, org: string, steps: Step[]) => db.rpc<Step[]>("pledge_steps_save", { org, steps });
export const listReminders = (db: DB, org: string, pledge?: string) => db.rpc<Reminder[]>("pledge_reminders_list", { org, ...(pledge ? { pledge } : {}) });
export const taskDone = (db: DB, reminder: string, done = true) => db.rpc<void>("pledge_task_done", { reminder, done });
/** Public: the pay-link page. Null for an unknown token. Pay with the pay function: { action: "start", pledge_token, amount_cents ≤ remaining, ... }. */
export const pledgeByToken = (db: DB, token: string) => db.rpc<PayLinkPledge | null>("pledge_by_token", { token });
/** "Run recovery now" for one org (editor or higher). */
export const runRecovery = (db: DB, org_id: string) => db.fn<{ scheduled: number; sent: number; failed: number; skipped: number }>("pledge-recovery", { org_id });
/** Public, no sign-in: a donor pledges from the live night's QR screen and gets back the pay token for /pledge/<token>. */
export type PayBy = "1w" | "1m" | "3m";
export const pledgePublic = (db: DB, org_slug: string, p: { donor_name: string; donor_email?: string; donor_phone?: string; amount_cents: number; pay_by: PayBy }) => db.rpc<string>("pledge_create_public", { org_slug, p });
