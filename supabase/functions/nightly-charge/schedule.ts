// The last ten nights, as the pay function starts them: the donor's consent and payment method are saved on the charity's own Stripe
// account (a SetupIntent, nothing charged), with one gift_schedule_charges row per night. nightly-charge (index.ts) takes each night.
// One schedule per attempt_key, and every Stripe call has an idempotency key under it, so a retried start makes nothing twice.
import { admin, stripe } from "../_shared/deps.ts";
import { type PayOut, pmTypes, type StartInput } from "../pay/logic.ts";
import { NIGHT_21, fromSetup, nightCharges, nightPlan } from "./plan.ts";

type DB = ReturnType<typeof admin>;
interface Sched { id: string; status: string; stripe_account_id: string; stripe_setup_intent_id: string; stripe_payment_method_id: string | null }

export const startNights = async (db: DB, b: StartInput, org: { id: string; name: string }, acct: string): Promise<PayOut> => {
    const key = b.attempt_key, s = stripe(), on = (k: string) => ({ idempotencyKey: `${key}:${k}`, stripeAccount: acct });
    const find = async () => (await db.from("gift_schedules").select("id, status, stripe_account_id, stripe_setup_intent_id, stripe_payment_method_id").eq("attempt_key", key).maybeSingle()).data as Sched | null;
    let row = await find();
    if (!row) {
        const { data: set } = await db.from("checkout_settings").select("nights_start").eq("org_id", org.id).maybeSingle();
        const plan = nightPlan(set?.nights_start ?? NIGHT_21, !!b.odd);
        if (!plan.length) return { status: "failed", id: "", error: { code: "not_configured", message: "The last ten nights have passed for this year. Choose a one-off gift instead." } };
        // The server's own sums, never the page's: per-night gift × units, extras on the first night, each night's fee when covered.
        const charges = nightCharges(b.amount_cents, plan, b.extras_cents ?? 0, !!b.cover_nights);
        const meta = { org_id: org.id, schedule_attempt: key, fund: b.fund ?? "" };
        const customer = await s.customers.create({ email: b.donor_email, name: b.donor_name?.trim() || undefined, metadata: meta }, on("cus"));
        const si = await s.setupIntents.create({ customer: customer.id, payment_method_types: pmTypes(b.method, b.currency), usage: "off_session", description: `The last ten nights with ${org.name}`, metadata: meta }, on("seti"));
        const { data: made, error } = await db.from("gift_schedules").insert({
            org_id: org.id, attempt_key: key, stripe_account_id: acct, stripe_customer_id: customer.id, stripe_setup_intent_id: si.id, pay_method: b.method,
            donor_name: b.anonymous ? "Anonymous" : b.donor_name?.trim() || "Anonymous", donor_email: b.donor_email, anonymous: !!b.anonymous,
            fund: b.fund?.trim() ?? "", currency: b.currency.toUpperCase(), per_night_cents: b.amount_cents, extras_cents: b.extras_cents ?? 0, odd: !!b.odd, cover: !!b.cover_nights, details: b.details ?? {},
        }).select("id").single();
        if (error || !made) { row = await find(); if (!row) throw new Error(error?.message ?? "Could not save the schedule"); }
        else {
            const { error: e2 } = await db.from("gift_schedule_charges").insert(charges.map((c) => ({ schedule_id: made.id, night: c.night, night_date: c.date, due_at: c.due, gift_cents: c.gift, extras_cents: c.extras, cover_cents: c.cover, amount_cents: c.total })));
            if (e2) throw new Error(e2.message);
            return fromSetup(si, made.id);
        }
    }
    return fromSetup(await s.setupIntents.retrieve(row.stripe_setup_intent_id, {}, { stripeAccount: row.stripe_account_id }), row.id);
};

/** The pay function's status for a schedule id: once the method is saved, the schedule goes live. Null when the id is not a schedule. */
export const scheduleStatus = async (db: DB, id: string): Promise<PayOut | null> => {
    const { data } = await db.from("gift_schedules").select("id, status, stripe_account_id, stripe_setup_intent_id, stripe_payment_method_id").eq("id", id).maybeSingle();
    const row = data as Sched | null;
    if (!row) return null;
    if (row.status === "active" || row.status === "completed") return { status: "succeeded", id };
    if (row.status === "cancelled") return { status: "failed", id, error: { code: "canceled" } };
    const si = await stripe().setupIntents.retrieve(row.stripe_setup_intent_id, {}, { stripeAccount: row.stripe_account_id });
    const out = fromSetup(si, id);
    const pm = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
    if (out.status === "succeeded" && pm) await db.from("gift_schedules").update({ status: "active", stripe_payment_method_id: pm, consent_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
    return out;
};
