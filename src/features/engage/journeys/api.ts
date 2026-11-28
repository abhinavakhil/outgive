/** The journey SQL API and the journey-run function, typed. Every call goes through db (src/shared/lib/db.ts). */
import type { DB } from "@/shared/lib/db";
import type { Journey, JourneyDonor, JourneySend, Preview, Settings, Step } from "./model";

export const getJourney = (db: DB, org: string) => db.rpc<Journey>("journey_get", { org });
/** Only the keys given change. { live: true } fails until the charity has a postal address. Editor or higher. */
export const saveSettings = (db: DB, org: string, p: Partial<Settings>) => db.rpc<Settings>("journey_settings_save", { org, p });
/** Replaces the whole list; steps left out are removed. Editor or higher. */
export const saveSteps = (db: DB, org: string, steps: Step[]) => db.rpc<Step[]>("journey_steps_save", { org, steps });
export const listDonors = (db: DB, org: string) => db.rpc<JourneyDonor[]>("journey_donors_list", { org });
/** Render with compose(step, varsFor(p, p.org, { site }), ...) for the preview. */
export const preview = (db: DB, org: string, key: string) => db.rpc<Preview>("journey_preview", { org, k: key });
/** Take a donor out of the journey (active false) or put them back. Editor or higher. */
export const setEnrollment = (db: DB, enrollment: string, active: boolean) => db.rpc<void>("journey_enrollment_set", { enrollment, active });
export const listSends = (db: DB, org: string, lim = 200) => db.rpc<JourneySend[]>("journey_sends_list", { org, lim });
/** Sends this step to the signed-in user's own email (with a donor's numbers when key is given). Editor or higher. */
export const sendTest = (db: DB, org_id: string, step_id: string, key?: string) => db.fn<{ ok: boolean; provider: string; error?: string }>("journey-run", { action: "test", org_id, step_id, ...(key ? { key } : {}) });
/** "Run now" for one org: enroll, schedule and send what is due. Editor or higher. */
export const runJourney = (db: DB, org_id: string) => db.fn<{ enrolled: number; scheduled: number; sent: number; failed: number; skipped: number }>("journey-run", { org_id });
/** Public: the unsubscribe page. */
export const unsubscribeInfo = (db: DB, token: string) => db.rpc<{ org_name: string; channel: "email" | "sms"; unsubscribed: boolean } | null>("journey_unsubscribe_info", { token });
export const unsubscribe = (db: DB, token: string) => db.rpc<{ org_name: string; channel: "email" | "sms"; unsubscribed: boolean } | null>("journey_unsubscribe", { token });
