// Pledges and recovery (migrations 20261128000000 and the 20261128000100 sample), on a real Postgres.
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, fresh, signUp } from "./pg";
import { kpis, type Pledge } from "../src/features/engage/pledges/model";

let db: PGlite; let org: string; const people: Record<string, string> = {};
const q = async <T = any>(uid: string | null | undefined, sql: string, args: unknown[] = []) => (uid === undefined ? db.query<T>(sql, args) : as(db, uid, () => db.query<T>(sql, args))).then((r) => r.rows);
const fails = (p: Promise<unknown>) => p.then(() => false, () => true);

beforeAll(async () => {
    db = await fresh();
    org = (await q(undefined, "select id from orgs where slug = 'hope-foundation'"))[0].id;
    for (const role of ["editor", "viewer"]) { people[role] = await signUp(db, `${role}@x.test`); await q(undefined, "insert into org_members (org_id, user_id, role) values ($1, $2, $3)", [org, people[role], role]); }
    people.donor = await signUp(db, "donor@x.test");
}, 60000);

describe("pledges", () => {
    it("seeds the sample and default steps; the SQL report matches the TS maths", async () => {
        const list = await q<Pledge>(people.viewer, "select * from pledges_list($1, '2027-03-16')", [org]);
        expect(list).toHaveLength(12);
        expect(await q(undefined, "select 1 from pledges p join orgs o on o.id = p.org_id where o.slug = 'clearwell'")).toHaveLength(0); // the real demo charity stays clean
        expect((await q(undefined, "select currency, country, ein from orgs where slug = 'hope-foundation'"))[0]).toEqual({ currency: "USD", country: "US", ein: "123456789" });
        expect(list.find((p) => p.donor_name === "Bilal Ahmed")).toMatchObject({ status: "paid", method: "check" });
        const [{ r }] = await q(people.viewer, "select pledge_report($1, '2027-03-16') as r", [org]);
        expect(r.totals).toEqual(kpis(list.map((p) => ({ ...p, amount_cents: Number(p.amount_cents), paid_cents: Number(p.paid_cents), due_date: p.due_date && new Date(p.due_date as unknown as Date).toISOString().slice(0, 10) })), "2027-03-16"));
        expect(r.by_method).toEqual({ ach: 600000, check: 300000, zelle: 100000, pay_link: 600000 });
        const steps = await q(people.viewer, "select day, action, enabled from pledge_steps_list($1)", [org]);
        expect(steps.map((s) => `${s.day}:${s.action}:${s.enabled}`)).toEqual(["0:thank_you:true", "2:pay_link:true", "7:reminder:true", "14:split_offer:true", "21:call_list:true", "45:write_off_review:false"]);
    });

    it("viewers read, editors write, others neither", async () => {
        expect(await q(people.donor, "select * from pledges_list($1)", [org])).toHaveLength(0);
        expect(await q(people.donor, "select * from pledges")).toHaveLength(0);
        expect(await fails(q(people.viewer, `select pledge_save($1, '{"donor_name":"X","amount_cents":100}')`, [org]))).toBe(true);
        const [p] = await q(people.editor, `select * from pledge_save($1, '{"donor_name":"Test Donor","donor_phone":"(212) 555-0199","amount_cents":10000,"event":"Night 1"}')`, [org]);
        expect(p).toMatchObject({ donor_phone: "+12125550199", currency: "USD", paid_cents: 0 });
        expect(p.pay_token).toMatch(/^[0-9a-f]{64}$/);
        expect(await fails(q(people.editor, `select pledge_save($1, '{"donor_name":"X","amount_cents":100,"donor_phone":"12"}')`, [org]))).toBe(true);
    });

    it("contact details are editor-only; viewers get names and amounts", async () => {
        const v = await q(people.viewer, "select donor_name, donor_email, donor_phone, amount_cents from pledges_list($1)", [org]);
        expect(v.length).toBeGreaterThan(0);
        expect(v.every((p) => p.donor_email === null && p.donor_phone === null && p.donor_name && p.amount_cents)).toBe(true);
        const e = await q(people.editor, "select donor_email, donor_phone from pledges_list($1) where donor_name = 'Aisha Khan'", [org]);
        expect(e[0]).toEqual({ donor_email: "aisha.khan@example.com", donor_phone: "+12125550102" });
        expect(await q(people.viewer, "select * from pledges")).toHaveLength(0);
        const [task] = await q(undefined, "insert into pledge_reminders (pledge_id, org_id, action, channel, scheduled_at, status) select id, org_id, 'call_list', 'task', now(), 'open' from pledges where donor_name = 'Aisha Khan' returning id");
        const rv = await q(people.viewer, "select donor_email, donor_phone from pledge_reminders_list($1) where id = $2", [org, task.id]);
        expect(rv[0]).toEqual({ donor_email: null, donor_phone: null });
        expect((await q(people.editor, "select donor_phone from pledge_reminders_list($1) where id = $2", [org, task.id]))[0].donor_phone).toBe("+12125550102");
        await q(undefined, "delete from pledge_reminders where id = $1", [task.id]);
    });

    it("org_insights counts money staff took against pledges, not pay-link payments twice", async () => {
        const [{ i }] = await q(people.viewer, "select org_insights($1) as i", [org]);
        // Sample: check 3000 + ACH 6000 + Zelle 1000 offline. Its pay_link payments are not counted: online ones are donations already.
        expect(i.offline_pledge_cents).toBe(1000000);
        const [{ d }] = await q(undefined, "select coalesce(sum(amount_cents), 0)::bigint as d from donations where org_id = $1 and status = 'succeeded'", [org]); // other samples' gifts
        expect(i.raised_cents).toBe(Number(d) + 1000000);
    });

    it("offline payments and pay-link gifts move paid; refunds take it back", async () => {
        const [p] = await q(people.editor, `select * from pledge_save($1, '{"donor_name":"Pay Test","amount_cents":30000,"currency":"USD"}')`, [org]);
        const [pay] = await q(people.editor, `select * from pledge_payment_add($1, '{"amount_cents":10000,"method":"zelle","reference":"ZL-1"}')`, [p.id]);
        expect(await fails(q(people.editor, `select pledge_payment_add($1, '{"amount_cents":100,"method":"pay_link"}')`, [p.id]))).toBe(true);
        const [d] = await q(undefined, "insert into donations (org_id, amount_cents, currency, status, pledge_id) values ($1, 20000, 'USD', 'pending', $2) returning id", [org, p.id]);
        const paid = async () => Number((await q(undefined, "select paid_cents from pledges where id = $1", [p.id]))[0].paid_cents);
        expect(await paid()).toBe(10000);
        await q(undefined, "update donations set status = 'succeeded' where id = $1", [d.id]);
        await q(undefined, "update donations set status = 'succeeded' where id = $1", [d.id]); // a second webhook changes nothing
        expect(await paid()).toBe(30000);
        expect((await q(null, "select pledge_by_token($1) as t", [p.pay_token]))[0].t).toMatchObject({ status: "paid", remaining_cents: 0, first_name: "Pay" });
        await q(undefined, "update donations set status = 'refunded' where id = $1", [d.id]);
        expect(await paid()).toBe(10000);
        expect(await fails(q(people.editor, "select pledge_payment_remove(x.id) from pledge_payments x where donation_id = $1", [d.id]))).toBe(false); // gone already
        await q(people.editor, "select pledge_payment_remove($1)", [pay.id]);
        expect(await paid()).toBe(0);
        expect((await q(null, "select pledge_by_token('nope') as t"))[0].t).toBeNull();
    });

    it("schedules only the latest due message, keeps tasks, and skips closed pledges at claim time", async () => {
        const [p] = await q(people.editor, `select * from pledge_save($1, jsonb_build_object('donor_name','Late Entry','donor_email','late@example.com','amount_cents',5000,'pledged_at', now() - interval '22 days'))`, [org]);
        await q(undefined, "select pledge_recovery_schedule($1)", [org]);
        const rs = await q(undefined, "select action, channel, status from pledge_reminders where pledge_id = $1 order by scheduled_at, channel", [p.id]);
        expect(rs.map((r) => `${r.action}/${r.channel}/${r.status}`)).toEqual(["thank_you/sms/skipped", "pay_link/email/skipped", "reminder/email/skipped", "reminder/sms/skipped", "split_offer/email/pending", "call_list/task/open"]);
        expect((await q(undefined, "select pledge_recovery_schedule($1) as n", [org]))[0].n).toBe(0); // idempotent
        const claimed = await q(undefined, "select * from pledge_reminders_claim($1)", [org]);
        expect(claimed.filter((c) => c.donor_name === "Late Entry").map((c) => c.action)).toEqual(["split_offer"]);
        expect(await q(undefined, "select * from pledge_reminders_claim($1)", [org])).toHaveLength(0); // claimed once
        // A pledge paid before its message goes out is skipped.
        const [p2] = await q(people.editor, `select * from pledge_save($1, jsonb_build_object('donor_name','Paid Fast','amount_cents',5000,'pledged_at', now() - interval '1 hour'))`, [org]);
        await q(undefined, "select pledge_recovery_schedule($1)", [org]);
        await q(people.editor, `select pledge_payment_add($1, '{"amount_cents":5000,"method":"cash"}')`, [p2.id]);
        expect(await q(undefined, "select * from pledge_reminders_claim($1)", [org])).toHaveLength(0);
        expect((await q(undefined, "select status from pledge_reminders where pledge_id = $1", [p2.id]))[0].status).toBe("skipped");
        expect(await fails(q(people.editor, "select pledge_recovery_schedule($1)", [org]))).toBe(true); // service role only
    });

    it("editors replace the steps; tasks tick off", async () => {
        const steps = await q(people.editor, "select * from pledge_steps_list($1)", [org]);
        const next = steps.filter((s) => s.action !== "write_off_review").map((s) => ({ ...s, enabled: s.action !== "split_offer" }));
        await q(people.editor, "select pledge_steps_save($1, $2)", [org, JSON.stringify([...next, { day: 10, action: "reminder", channels: ["sms"] }])]);
        const after = await q(people.viewer, "select day, action, enabled from pledge_steps_list($1)", [org]);
        expect(after.map((s) => `${s.day}:${s.action}:${s.enabled}`)).toEqual(["0:thank_you:true", "2:pay_link:true", "7:reminder:true", "10:reminder:true", "14:split_offer:false", "21:call_list:true"]);
        expect(await fails(q(people.editor, "select pledge_steps_save($1, $2)", [org, JSON.stringify([{ day: 1, action: "call_list", channels: ["sms"] }])]))).toBe(true);
        const [task] = await q(people.viewer, "select id from pledge_reminders_list($1) where channel = 'task' and status = 'open'", [org]);
        expect(await fails(q(people.viewer, "select pledge_task_done($1)", [task.id]))).toBe(true);
        await q(people.editor, "select pledge_task_done($1)", [task.id]);
        expect((await q(undefined, "select status from pledge_reminders where id = $1", [task.id]))[0].status).toBe("done");
    });
});

describe("pledge now, pay later (public)", () => {
    const pub = (p: Record<string, unknown>, slug = "hope-foundation") => q(null, "select pledge_create_public($1, $2) as t", [slug, JSON.stringify({ donor_name: "Amina Yusuf", donor_phone: "(212) 555-0177", amount_cents: 50000, pay_by: "1m", ...p })]).then((r) => r[0].t as string);
    it("only during a live night, and returns just the pay token", async () => {
        await q(undefined, "update orgs set live = '{}' where slug = 'hope-foundation'");
        expect(await fails(pub({}))).toBe(true);
        await q(undefined, `update orgs set live = '{"pledge_event":"Night 27 dinner","paused":true}' where slug = 'hope-foundation'`);
        expect(await fails(pub({}))).toBe(true);
        await q(undefined, `update orgs set live = '{"pledge_event":"Night 27 dinner"}' where slug = 'hope-foundation'`);
        const t = await pub({});
        expect(t).toMatch(/^[0-9a-f]{64}$/);
        const [p] = await q(undefined, "select donor_phone, event, amount_cents, due_date - current_date as days, created_by, currency from pledges where pay_token = $1", [t]);
        expect(p).toMatchObject({ donor_phone: "+12125550177", event: "Night 27 dinner", amount_cents: 50000, days: 30, created_by: null, currency: "USD" });
        expect((await q(null, "select pledge_by_token($1) as b", [t]))[0].b).toMatchObject({ first_name: "Amina", remaining_cents: 50000, status: "open" });
    });
    it("validates the donor's input", async () => {
        for (const bad of [{ donor_name: " " }, { amount_cents: 50 }, { amount_cents: 100000001 }, { amount_cents: "lots" }, { donor_phone: "12", donor_email: "" }, { donor_phone: "", donor_email: "" }, { donor_phone: "", donor_email: "nope" }, { pay_by: "1y" }])
            expect(await fails(pub(bad)), JSON.stringify(bad)).toBe(true);
        expect(await fails(pub({}, "no-such-charity"))).toBe(true);
    });
    it("limits each contact to 3 an hour", async () => {
        const e = { donor_phone: "", donor_email: "rate@example.com" };
        for (let i = 0; i < 3; i++) await pub(e);
        expect(await fails(pub(e))).toBe(true);
        expect(await fails(pub({ ...e, donor_email: "other@example.com" }))).toBe(false);
    });
});

