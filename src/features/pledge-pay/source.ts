/**
 * Where pledges come from for the donor pay link (/pledge/<token>) and the host console (/demo/host, /o/<org>/host).
 * With Supabase: the pledge SQL API (src/features/engage/pledges/api.ts). In demo mode the in-browser database has no pledge tables,
 * so a small fixture in localStorage stands in: pledges logged on the host console open at /pledge/<token> in the same browser.
 * ponytail: the fixture is one browser's sample data, not a sync engine; it goes once the demo database loads the pledge migration.
 */
import type { DB } from "@/shared/lib/db";
import { type OfflineMethod, type PayLinkPledge, type Pledge, type PledgeInput, type PledgePayment, addPayment, isoDay, listPledges, pledgeByToken, pledgeStatus, remaining, savePledge } from "@/features/engage";

export interface PledgeSource {
    list: (org: string) => Promise<Pledge[]>;
    save: (org: string, p: PledgeInput) => Promise<{ id: string; pay_token: string }>;
    pay: (pledge: string, p: { amount_cents: number; method: OfflineMethod; reference?: string }) => Promise<unknown>;
    byToken: (token: string) => Promise<PayLinkPledge | null>;
}

export const liveSource = (db: DB): PledgeSource => ({
    list: (org) => listPledges(db, org),
    save: (org, p) => savePledge(db, org, p),
    pay: (pledge, p) => addPayment(db, pledge, p),
    byToken: (token) => pledgeByToken(db, token),
});

// ---------------------------------------------------------------- demo fixture
type Store = Pick<Storage, "getItem" | "setItem">;
const KEY = "outgive.demo-pledges.v1";
const ORG = { org_id: "demo", org_slug: "clearwell", org_name: "Clearwell Trust" };
const DAY = 86400000;
const day = (n: number, now = Date.now()) => isoDay(new Date(now + n * DAY));
const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
const pay = (amount_cents: number, method: PledgePayment["method"], online = false): PledgePayment => ({ id: crypto.randomUUID(), amount_cents, method, reference: "", received_at: new Date().toISOString(), online });

/** Sample pledges, one per state of the pay link. Their tokens are readable so the states can be opened by hand: /pledge/demo-open … */
export const seedPledges = (now = Date.now()): Pledge[] => ([
    ["demo-open", "Aisha Khan", 150000, [], 21],
    ["demo-part", "Omar Siddiqui", 300000, [pay(100000, "check")], 14],
    ["demo-paid", "Yusuf Rahman", 50000, [pay(50000, "pay_link", true)], 30],
    ["demo-off", "Hana Yusuf", 75000, [], -40, true],
] as [string, string, number, PledgePayment[], number, boolean?][]).map(([token, name, amount, payments, due, off]) => ({
    id: crypto.randomUUID(), donor_name: name, donor_email: `${name.split(" ")[0].toLowerCase()}@example.com`, donor_phone: "+12125550101", event: "Night 27 dinner",
    amount_cents: amount, paid_cents: payments.reduce((n, p) => n + p.amount_cents, 0), currency: "USD", pledged_at: new Date(now - DAY).toISOString(), due_date: day(due, now),
    written_off: !!off, reminders_paused: false, note: "Table 4", pay_token: token, created_at: new Date(now - DAY).toISOString(),
    status: "open", reminders_sent: 0, method: payments[0]?.method ?? null, payments,
}));

const withStatus = (p: Pledge): Pledge => {
    const paid_cents = p.payments.reduce((n, x) => n + x.amount_cents, 0);
    return { ...p, paid_cents, status: pledgeStatus({ ...p, paid_cents }), method: p.payments[0]?.method ?? null };
};

export const demoSource = (store: Store | null = (() => { try { return window.localStorage; } catch { return null; } })()): PledgeSource & { payOnline: (token: string, cents: number) => Promise<void> } => {
    let mem: Pledge[] | null = null;
    const read = (): Pledge[] => { try { mem ??= JSON.parse(store?.getItem(KEY) ?? "null"); } catch { /* unreadable: reseed */ } return (mem ??= seedPledges()); };
    const write = (ps: Pledge[]) => { mem = ps; try { store?.setItem(KEY, JSON.stringify(ps)); } catch { /* private mode */ } };
    const change = (match: (p: Pledge) => boolean, f: (p: Pledge) => Pledge) => {
        const ps = read(), i = ps.findIndex(match);
        if (i < 0) throw new Error("Pledge not found");
        const next = withStatus(f(ps[i])); write(ps.map((p, j) => (j === i ? next : p))); return next;
    };
    const capped = (p: Pledge, cents: number) => { if (!(cents > 0)) throw new Error("Enter an amount"); if (cents > remaining(p)) throw new Error("That is more than what is left on the pledge"); };
    return {
        list: async () => read().map(withStatus).sort((a, b) => b.created_at.localeCompare(a.created_at)),
        save: async (_org, input) => {
            if (input.id) { const p = change((x) => x.id === input.id, (x) => ({ ...x, ...input })); return p; }
            if (!input.donor_name?.trim()) throw new Error("Add the donor’s name");
            if (!(Number(input.amount_cents) > 0)) throw new Error("Enter the amount pledged");
            const now = new Date().toISOString();
            const p = withStatus({
                id: crypto.randomUUID(), donor_name: input.donor_name.trim(), donor_email: input.donor_email || null, donor_phone: input.donor_phone || null, event: input.event ?? "",
                amount_cents: Number(input.amount_cents), paid_cents: 0, currency: input.currency ?? "USD", pledged_at: now, due_date: input.due_date ?? null, written_off: false,
                reminders_paused: false, note: input.note ?? "", pay_token: hex(), created_at: now, status: "open", reminders_sent: 0, method: null, payments: [],
            });
            write([p, ...read()]); return p;
        },
        pay: async (id, x) => change((p) => p.id === id, (p) => { capped(p, x.amount_cents); return { ...p, payments: [...p.payments, { ...pay(x.amount_cents, x.method), reference: x.reference ?? "" }] }; }),
        payOnline: async (token, cents) => { change((p) => p.pay_token === token, (p) => { if (p.written_off) throw new Error("This pledge link is not valid"); capped(p, cents); return { ...p, payments: [...p.payments, pay(cents, "pay_link", true)] }; }); },
        byToken: async (token) => {
            const p = read().map(withStatus).find((x) => x.pay_token === token);
            return p ? { ...ORG, first_name: p.donor_name.split(" ")[0], event: p.event, amount_cents: p.amount_cents, paid_cents: p.paid_cents, remaining_cents: remaining(p), currency: p.currency, due_date: p.due_date, status: p.status, accepts: ["card", "wallets"] } : null;
        },
    };
};

// ---------------------------------------------------------------- tonight's numbers
/** One event's pledges for the host console and the live screen: pledged, paid (online and offline), what is left, and the offline part. */
export const tonight = (ps: Pledge[], event: string) => {
    const mine = ps.filter((p) => p.event === event && !p.written_off);
    const sum = (f: (p: Pledge) => number) => mine.reduce((n, p) => n + f(p), 0);
    return {
        count: mine.length,
        pledged_cents: sum((p) => p.amount_cents),
        paid_cents: sum((p) => p.paid_cents),
        remaining_cents: sum(remaining),
        /** Cash, checks and Zelle the team recorded. Online payments are gifts already, so the live total has them. */
        offline_cents: sum((p) => p.payments.filter((x) => !x.online).reduce((n, x) => n + x.amount_cents, 0)),
    };
};
