/**
 * Pledges and unpaid-pledge recovery: the shapes the SQL API returns (supabase/migrations/20261128000000_pledge_recovery.sql) and the
 * maths the screens need. Pure, so the UI and the tests share it. Status and KPIs mirror pledge_status() and pledge_report() in SQL.
 * Money is integer cents; dates are ISO strings as PostgREST sends them.
 */

export type PledgeStatus = "written_off" | "paid" | "overdue" | "part_paid" | "open";
export type PayMethod = "pay_link" | "card" | "ach" | "check" | "cash" | "zelle" | "other";
/** What staff can record by hand; pay_link payments only come from the pay link. */
export type OfflineMethod = Exclude<PayMethod, "pay_link">;
export type StepAction = "thank_you" | "pay_link" | "reminder" | "split_offer" | "call_list" | "write_off_review";
export type Channel = "sms" | "email" | "task";

export interface PledgePayment { id: string; amount_cents: number; method: PayMethod; reference: string; received_at: string; online: boolean }
/** A row of pledges_list(org). */
export interface Pledge {
    id: string; donor_name: string; donor_email: string | null; donor_phone: string | null; event: string;
    amount_cents: number; paid_cents: number; currency: string; pledged_at: string; due_date: string | null;
    written_off: boolean; reminders_paused: boolean; note: string; pay_token: string; created_at: string;
    status: PledgeStatus; reminders_sent: number; method: PayMethod | null; payments: PledgePayment[];
}
/** What pledge_save(org, p) takes: no id creates, an id changes only the keys given. */
export type PledgeInput = Partial<Pick<Pledge, "id" | "donor_name" | "donor_email" | "donor_phone" | "event" | "amount_cents" | "currency" | "pledged_at" | "due_date" | "written_off" | "reminders_paused" | "note">>;
export interface Step { id?: string; day: number; action: StepAction; channels: Channel[]; enabled: boolean }
/** A row of pledge_reminders_list(org, pledge?). Tasks (the call list) have channel "task" and status open/done. */
export interface Reminder {
    id: string; pledge_id: string; donor_name: string; donor_phone: string | null; donor_email: string | null; event: string;
    action: StepAction; channel: Channel; scheduled_at: string; status: "pending" | "sending" | "sent" | "failed" | "skipped" | "open" | "done";
    provider: string | null; error: string | null; sent_at: string | null;
}
export interface Totals {
    count: number; pledged_cents: number; collected_cents: number; collected_pct: number;
    outstanding_cents: number; outstanding_count: number; overdue_count: number; written_off_cents: number; written_off_count: number;
}
export interface EventRow { event: string; count: number; pledged_cents: number; collected_cents: number; outstanding_cents: number; written_off_cents: number }
/** What pledge_report(org) returns. */
export interface Report { totals: Totals; by_event: EventRow[]; by_method: Partial<Record<PayMethod, number>> }
/** What pledge_by_token(token) returns for the public pay-link page. */
export interface PayLinkPledge {
    org_id: string; org_slug: string; org_name: string; first_name: string; event: string;
    amount_cents: number; paid_cents: number; remaining_cents: number; currency: string; due_date: string | null; status: PledgeStatus; accepts: string[];
}

export const STATUS_LABEL: Record<PledgeStatus, string> = { written_off: "Written off", paid: "Paid", overdue: "Overdue", part_paid: "Part paid", open: "Open" };
export const METHOD_LABEL: Record<PayMethod, string> = { pay_link: "Pay link", card: "Card", ach: "ACH", check: "Check", cash: "Cash", zelle: "Zelle", other: "Other" };
export const STEP_LABEL: Record<StepAction, string> = {
    thank_you: "Thank-you message with one-tap pay link",
    pay_link: "Your pledge, pay in one tap",
    reminder: "Reminder",
    split_offer: "Offer to split into 3 monthly payments",
    call_list: "Add to volunteer call list",
    write_off_review: "Review for write-off",
};
export const isTask = (a: StepAction) => a === "call_list" || a === "write_off_review";

type Amounts = Pick<Pledge, "amount_cents" | "paid_cents" | "due_date" | "written_off">;
type Dated = Amounts & Pick<Pledge, "pledged_at" | "reminders_paused">;

/** "2027-03-16" for a Date, in UTC like the database's current_date. */
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const remaining = (p: Amounts) => Math.max(0, p.amount_cents - p.paid_cents);
/** Written off, then paid, then overdue (due before today and not paid, part paid or not), then part paid, then open. */
export const pledgeStatus = (p: Amounts, today: string = isoDay(new Date())): PledgeStatus =>
    p.written_off ? "written_off" : p.paid_cents >= p.amount_cents ? "paid" : p.due_date && p.due_date < today ? "overdue" : p.paid_cents > 0 ? "part_paid" : "open";
/** Still being chased: not paid, not written off. */
export const isOpen = (p: Amounts) => !p.written_off && p.paid_cents < p.amount_cents;

const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0);

export const kpis = (ps: Amounts[], today?: string): Totals => {
    const pledged = sum(ps, (p) => p.amount_cents), collected = sum(ps, (p) => p.paid_cents);
    const live = ps.filter((p) => !p.written_off), off = ps.filter((p) => p.written_off);
    return {
        count: ps.length, pledged_cents: pledged, collected_cents: collected, collected_pct: pledged > 0 ? Math.round((100 * collected) / pledged) : 0,
        outstanding_cents: sum(live, remaining), outstanding_count: live.filter((p) => remaining(p) > 0).length,
        overdue_count: ps.filter((p) => pledgeStatus(p, today) === "overdue").length,
        written_off_cents: sum(off, remaining), written_off_count: off.length,
    };
};

/** Pledged against paid, per event, biggest first. */
export const byEvent = (ps: (Amounts & Pick<Pledge, "event">)[]): EventRow[] => {
    const groups = new Map<string, (Amounts & Pick<Pledge, "event">)[]>();
    for (const p of ps) groups.set(p.event, [...(groups.get(p.event) ?? []), p]);
    return [...groups].map(([event, g]) => {
        const t = kpis(g);
        return { event, count: g.length, pledged_cents: t.pledged_cents, collected_cents: t.collected_cents, outstanding_cents: t.outstanding_cents, written_off_cents: t.written_off_cents };
    }).sort((a, b) => b.pledged_cents - a.pledged_cents || a.event.localeCompare(b.event));
};

const DAY = 86400000;
/** When a step falls due for a pledge: pledged_at plus the step's days. */
export const stepAt = (p: Pick<Pledge, "pledged_at">, s: Pick<Step, "day">) => new Date(new Date(p.pledged_at).getTime() + s.day * DAY);
/** The next enabled step still ahead of an open, unpaused pledge, and when; null when nothing more will go out. */
export const nextStep = (p: Dated, steps: Step[], now = new Date()): { step: Step; at: Date } | null => {
    if (!isOpen(p) || p.reminders_paused) return null;
    const ahead = steps.filter((s) => s.enabled).map((step) => ({ step, at: stepAt(p, step) })).filter((x) => x.at > now);
    return ahead.sort((a, b) => a.at.getTime() - b.at.getTime())[0] ?? null;
};

/** The first of three monthly payments the split offer suggests (rounded up, so three cover the balance). */
export const splitFirst = (p: Amounts, n = 3) => Math.ceil(remaining(p) / n);
/** The donor's one-tap pay link. `split` opens it on the first of three monthly payments. */
export const payUrl = (token: string, origin = globalThis.location?.origin ?? "", split = false) => `${origin}/pledge/${token}${split ? "?split=3" : ""}`;
