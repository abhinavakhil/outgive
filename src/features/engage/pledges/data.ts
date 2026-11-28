/**
 * The pledge screen's data. Live: the SQL API through ./api. Demo (ws.sample): the prototype's twelve pledges, kept in memory, so every
 * action works and nothing is sent. The Overview's pledge figures (sidebar badge, "Pledges collected", "Pledges to chase") read
 * usePledgeSummary below, so they always agree with this screen.
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import { useWorkspace } from "../shell/workspace";
import * as api from "./api";
import { type OfflineMethod, type Pledge, type PledgeInput, type Reminder, type Step, isOpen, isoDay, kpis, pledgeStatus, remaining, stepAt } from "./model";

/** The demo's "today": the Monday after Eid, as on the Overview. */
export const SAMPLE_TODAY = "2027-03-15";

// ---------------------------------------------------------------- the sample (the prototype's Hope Foundation)
const NIGHT = (n: number) => new Date(Date.UTC(2027, 1, 7 + n - 1, 2)).toISOString(); // Night n, 9 pm New York
const S: [string, string, string, number, number, string, number, OfflineMethod | "pay_link" | null][] = [
    ["Yusuf Rahman", "Night 27 dinner", NIGHT(27), 5000, 5000, "2027-03-15", 1, "pay_link"], ["Aisha Khan", "Night 27 dinner", NIGHT(27), 2500, 1000, "2027-03-20", 2, "card"],
    ["Omar Siddiqui", "Night 21", NIGHT(21), 10000, 0, "2027-03-12", 3, null], ["Fatima Malik", "Night 25", NIGHT(25), 1200, 0, "2027-03-25", 1, null],
    ["Bilal Ahmed", "Night 27 dinner", NIGHT(27), 3000, 3000, "2027-03-15", 0, "check"], ["Hana Yusuf", "Night 23", NIGHT(23), 750, 0, "2027-03-10", 2, null],
    ["Ibrahim Patel", "Building fund dinner", NIGHT(14), 15000, 6000, "2027-04-30", 1, "ach"], ["Maryam Ali", "Night 29", NIGHT(29), 500, 0, "2027-03-18", 0, null],
    ["Zaid Hassan", "Night 27 dinner", NIGHT(27), 2000, 0, "2027-03-08", 4, null], ["Sara Qureshi", "Night 25", NIGHT(25), 1000, 1000, "2027-03-20", 1, "zelle"],
    ["Khalid Mansour", "Building fund dinner", NIGHT(14), 7500, 0, "2027-04-30", 0, null], ["Noor Abbas", "Night 21", NIGHT(21), 300, 0, "2027-03-05", 4, null],
];
/** In the demo, these donors pay by the link the next time recovery runs (the prototype's simulation). */
const WILL_PAY = new Set(["Fatima Malik", "Hana Yusuf", "Maryam Ali"]);
const samplePledges = (): Pledge[] => S.map(([name, event, at, amt, paid, due, sent, method], i) => {
    const p = { id: `sample-${1042 + i}`, donor_name: name, donor_email: `${name.toLowerCase().replace(" ", ".")}@example.com`, donor_phone: `+1212555${String(101 + i).padStart(4, "0")}`, event,
        amount_cents: amt * 100, paid_cents: paid * 100, currency: "USD", pledged_at: at, due_date: due, written_off: false, reminders_paused: false, note: "Sample pledge",
        pay_token: (1042 + i).toString(16).padStart(64, "0"), created_at: at, reminders_sent: sent, method,
        payments: paid ? [{ id: `pay-${i}`, amount_cents: paid * 100, method: method ?? "cash", reference: "", received_at: at, online: method === "pay_link" }] : [] } as Omit<Pledge, "status">;
    return { ...p, status: pledgeStatus(p, SAMPLE_TODAY) };
});
export const SAMPLE_STEPS: Step[] = [
    { id: "s0", day: 0, action: "thank_you", channels: ["sms"], enabled: true }, { id: "s2", day: 2, action: "pay_link", channels: ["email"], enabled: true },
    { id: "s7", day: 7, action: "reminder", channels: ["email", "sms"], enabled: true }, { id: "s14", day: 14, action: "split_offer", channels: ["email"], enabled: true },
    { id: "s21", day: 21, action: "call_list", channels: ["task"], enabled: true }, { id: "s45", day: 45, action: "write_off_review", channels: ["task"], enabled: false },
];
/** Sample reminders: the message steps each pledge has had (as many as its count), and an open call-list task where day 21 has passed. */
const sampleReminders = (ps: Pledge[], steps: Step[]): Reminder[] => ps.flatMap((p) => {
    const base = { pledge_id: p.id, donor_name: p.donor_name, donor_phone: p.donor_phone, donor_email: p.donor_email, event: p.event, provider: "console", error: null };
    const msgs = steps.filter((s) => s.enabled && s.action !== "call_list" && s.action !== "write_off_review").flatMap((s) => s.channels.map((c) => ({ s, c })));
    const sent = msgs.slice(0, p.reminders_sent).map(({ s, c }, i) => ({ ...base, id: `${p.id}-r${i}`, action: s.action, channel: c, scheduled_at: stepAt(p, s).toISOString(), status: "sent" as const, sent_at: stepAt(p, s).toISOString() }));
    const call = steps.find((s) => s.action === "call_list" && s.enabled);
    const task = call && isOpen(p) && isoDay(stepAt(p, call)) <= SAMPLE_TODAY ? [{ ...base, id: `${p.id}-call`, action: call.action, channel: "task" as const, scheduled_at: stepAt(p, call).toISOString(), status: "open" as const, provider: null, sent_at: null }] : [];
    return [...sent, ...task];
});

/** A pledge added in the demo. */
const fresh = (p: PledgeInput): Pledge => {
    const now = new Date().toISOString();
    return { id: `sample-new-${Date.now()}`, donor_name: "", donor_email: null, donor_phone: null, event: "", amount_cents: 0, paid_cents: 0, currency: "USD", pledged_at: now, due_date: null,
        written_off: false, reminders_paused: false, note: "", pay_token: Date.now().toString(16).padStart(64, "0"), created_at: now, status: "open", reminders_sent: 0, method: null, payments: [], ...p } as Pledge;
};

// ---------------------------------------------------------------- the screen's store
export type RunResult = { scheduled: number; sent: number; failed: number; skipped: number; paid?: number };
export type Store = {
    state: "loading" | "ready" | "error"; error?: string; today: string;
    pledges: Pledge[]; steps: Step[]; reminders: Reminder[];
    save: (p: PledgeInput) => Promise<void>;
    pay: (pledge: string, p: { amount_cents: number; method: OfflineMethod; reference?: string }) => Promise<void>;
    saveSteps: (steps: Step[]) => Promise<void>;
    taskDone: (id: string, done?: boolean) => Promise<void>;
    run: () => Promise<RunResult>;
    history: (pledge: string) => Promise<Reminder[]>;
};

const listeners = new Set<() => void>();
/** Tells every pledge figure on the page (sidebar badge, Overview) to read again after a change. */
const changed = () => { summaries.clear(); listeners.forEach((f) => f()); };

export const usePledges = (): Store => {
    const { db } = useApp();
    const ws = useWorkspace();
    const [pledges, setPledges] = useState<Pledge[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [state, setState] = useState<Store["state"]>("loading");
    const [error, setError] = useState<string>();
    const today = ws.sample ? SAMPLE_TODAY : isoDay(new Date());
    const org = ws.org.id;

    const load = useCallback(async () => {
        if (ws.sample) {
            const ps = demo.pledges ??= samplePledges(), st = demo.steps ??= SAMPLE_STEPS;
            demo.reminders ??= sampleReminders(ps, st);
            setPledges(ps); setSteps(st); setReminders(demo.reminders); setState("ready"); return;
        }
        try {
            const [ps, st, rs] = await Promise.all([api.listPledges(db, org), api.listSteps(db, org), api.listReminders(db, org)]);
            setPledges(ps ?? []); setSteps(st ?? []); setReminders(rs ?? []); setState("ready");
        } catch (e) { setError((e as Error).message); setState("error"); }
    }, [db, org, ws.sample]);
    useEffect(() => { void load(); }, [load]);

    const after = async (f: () => Promise<unknown>) => { await f(); changed(); await load(); };
    /** Demo writes: change the in-memory sample and recompute each status. */
    const edit = (f: (ps: Pledge[]) => Pledge[]) => { demo.pledges = f(demo.pledges ?? []).map((p) => ({ ...p, status: pledgeStatus(p, SAMPLE_TODAY) })); changed(); return load(); };

    return {
        state, error, today, pledges, steps, reminders,
        save: (p) => ws.sample
            ? edit((ps) => (p.id ? ps.map((x) => (x.id === p.id ? ({ ...x, ...p } as Pledge) : x)) : [fresh(p), ...ps]))
            : after(() => api.savePledge(db, org, p)),
        pay: (id, x) => ws.sample
            ? edit((ps) => ps.map((p) => (p.id === id ? { ...p, paid_cents: p.paid_cents + x.amount_cents, method: x.method, payments: [...p.payments, { id: `pay-${Date.now()}`, amount_cents: x.amount_cents, method: x.method, reference: x.reference ?? "", received_at: new Date().toISOString(), online: false }] } : p)))
            : after(() => api.addPayment(db, id, x)),
        saveSteps: async (s) => { if (ws.sample) { demo.steps = s; return load(); } await after(() => api.saveSteps(db, org, s)); },
        taskDone: async (id, done = true) => {
            if (ws.sample) { demo.reminders = (demo.reminders ?? []).map((r) => (r.id === id ? { ...r, status: done ? "done" : "open" } : r)); return load(); }
            await after(() => api.taskDone(db, id, done));
        },
        run: async () => {
            if (!ws.sample) { const r = await api.runRecovery(db, org); changed(); await load(); return r; }
            // Demo: every open, unpaused pledge gets one more reminder; the three "will pay" donors pay by the link. Nothing is sent.
            let sent = 0, paid = 0;
            await edit((ps) => ps.map((p) => {
                if (!isOpen(p) || p.reminders_paused) return p;
                sent++;
                if (!WILL_PAY.has(p.donor_name)) return { ...p, reminders_sent: p.reminders_sent + 1 };
                paid++;
                return { ...p, reminders_sent: p.reminders_sent + 1, paid_cents: p.amount_cents, method: "pay_link", payments: [...p.payments, { id: `pay-${p.id}`, amount_cents: remaining(p), method: "pay_link", reference: "", received_at: new Date().toISOString(), online: true }] };
            }));
            return { scheduled: sent, sent, failed: 0, skipped: 0, paid };
        },
        history: async (id) => ws.sample ? sampleReminders((demo.pledges ?? []).filter((p) => p.id === id), demo.steps ?? SAMPLE_STEPS) : api.listReminders(db, org, id),
    };
};
/** The demo's in-memory sample, kept across screens so the Overview and the badge see the same changes. */
const demo: { pledges?: Pledge[]; steps?: Step[]; reminders?: Reminder[] } = {};

// ---------------------------------------------------------------- the Overview's pledge figures
export type PledgeSummary = { open: number; toChase: number; pledged_cents: number; collected_cents: number; collected_pct: number };
const summaries = new Map<string, Promise<PledgeSummary | null>>();
/** Open pledges, those to chase (overdue or on the call list) and collected against pledged. Null until loaded, or when unavailable. */
export const usePledgeSummary = (): PledgeSummary | null => {
    const { db } = useApp();
    const ws = useWorkspace();
    const [s, setS] = useState<PledgeSummary | null>(null);
    const [tick, setTick] = useState(0);
    useEffect(() => { const f = () => setTick((t) => t + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
    useEffect(() => {
        let off = false;
        const key = ws.sample ? "sample" : ws.org.id;
        if (!summaries.has(key)) summaries.set(key, ws.sample
            ? Promise.resolve((() => { const ps = demo.pledges ??= samplePledges(); const t = kpis(ps, SAMPLE_TODAY); return { open: t.outstanding_count, toChase: t.overdue_count, pledged_cents: t.pledged_cents, collected_cents: t.collected_cents, collected_pct: t.collected_pct }; })())
            : api.pledgeReport(db, ws.org.id).then((r) => ({ open: r.totals.outstanding_count, toChase: r.totals.overdue_count, pledged_cents: r.totals.pledged_cents, collected_cents: r.totals.collected_cents, collected_pct: r.totals.collected_pct }), () => null));
        summaries.get(key)!.then((v) => !off && setS(v));
        return () => { off = true; };
    }, [db, ws.org.id, ws.sample, tick]);
    return s;
};
