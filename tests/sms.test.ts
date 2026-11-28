// Text-to-give keywords and SMS opt-outs (migration 20261128700000), on a real Postgres.
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, fresh, signUp } from "./pg";

let db: PGlite; let org: string; let other: string; const people: Record<string, string> = {};
const q = async <T = any>(uid: string | null | undefined, sql: string, args: unknown[] = []) => (uid === undefined ? db.query<T>(sql, args) : as(db, uid, () => db.query<T>(sql, args))).then((r) => r.rows);
const fails = (p: Promise<unknown>) => p.then(() => false, () => true);

beforeAll(async () => {
    db = await fresh();
    org = (await q(undefined, "select id from orgs where slug = 'hope-foundation'"))[0].id;
    other = (await q(undefined, "select id from orgs where slug = 'clearwell'"))[0].id;
    for (const role of ["editor", "viewer"]) { people[role] = await signUp(db, `${role}@x.test`); await q(undefined, "insert into org_members (org_id, user_id, role) values ($1, $2, $3)", [org, people[role], role]); }
}, 60000);

describe("keywords", () => {
    it("seeds the sample; viewers read, editors write, one charity per keyword", async () => {
        expect((await q(people.viewer, "select keyword from sms_keywords_list($1)", [org])).map((r) => r.keyword)).toEqual(["BUILD", "IFTAR", "ZAKAT"]);
        expect(await fails(q(people.viewer, `select sms_keyword_save($1, '{"keyword":"QURBANI"}')`, [org]))).toBe(true);
        const [k] = await q(people.editor, `select * from sms_keyword_save($1, '{"keyword":"qurbani","fund":"general","amount_cents":9500,"appeal":"Qurbani 1448"}')`, [org]);
        expect(k).toMatchObject({ keyword: "QURBANI", amount_cents: 9500 });
        expect(await fails(q(people.editor, `select sms_keyword_save($1, '{"keyword":"STOP"}')`, [org]))).toBe(true);
        expect(await fails(q(people.editor, `select sms_keyword_save($1, '{"keyword":"IFTAR","fund":"bogus"}')`, [org]))).toBe(true);
        await q(undefined, "insert into sms_keywords (keyword, org_id) values ('CLEAN', $1)", [other]);
        expect(await fails(q(people.editor, `select sms_keyword_save($1, '{"keyword":"CLEAN"}')`, [org]))).toBe(true);
        const [f] = await q(undefined, "select * from sms_keyword_find('iftar')");
        expect(f).toMatchObject({ org_slug: "hope-foundation", org_name: "Hope Foundation", fund: "general", amount_cents: 5000 });
        await q(people.editor, "select sms_keyword_delete($1, 'qurbani')", [org]);
        expect(await q(undefined, "select 1 from sms_keywords where keyword = 'QURBANI'")).toHaveLength(0);
    });

    it("the webhook functions are not callable by signed-in people", async () => {
        expect(await fails(q(people.editor, "select * from sms_keyword_find('IFTAR')"))).toBe(true);
        expect(await fails(q(people.editor, "select sms_opt('+12125550101', true)"))).toBe(true);
    });
});

describe("STOP and START", () => {
    it("pause pledge reminders and suppress SMS, then undo only that", async () => {
        const phone = "+12125550101";
        await q(undefined, "update pledges set reminders_paused = true where donor_phone = '+12125550102'"); // staff paused another number
        const [{ r }] = await q(undefined, "select sms_opt('(212) 555-0101', true) as r");
        expect(r).toMatchObject({ phone, paused: 1, suppressed: 1 });
        expect((await q(undefined, "select reminders_paused from pledges where donor_phone = $1", [phone]))[0].reminders_paused).toBe(true);
        expect(await q(undefined, "select reason from contact_suppressions where org_id = $1 and channel = 'sms' and address = $2", [org, phone])).toEqual([{ reason: "unsubscribed" }]);
        const [{ r: again }] = await q(undefined, "select sms_opt($1, true) as r", [phone]); // a second STOP changes nothing
        expect(again).toMatchObject({ paused: 0, suppressed: 0 });
        const [{ r: back }] = await q(undefined, "select sms_opt($1, false) as r", [phone]);
        expect(back).toMatchObject({ resumed: 1, unsuppressed: 1 });
        expect((await q(undefined, "select reminders_paused from pledges where donor_phone = $1", [phone]))[0].reminders_paused).toBe(false);
        expect(await q(undefined, "select 1 from contact_suppressions where address = $1", [phone])).toHaveLength(0);
        expect((await q(undefined, "select reminders_paused from pledges where donor_phone = '+12125550102'"))[0].reminders_paused).toBe(true);
        expect(await fails(q(undefined, "select sms_opt('12', true)"))).toBe(true);
    });
});

describe("our own texts skip opted-out numbers", () => {
    it("queued and new SMS to a STOP number are skipped as opted_out, at every charity; email and other numbers go", async () => {
        const ph = "+12125550103", other = "+12125550104";
        const pl = async (phone: string) => (await q(undefined, "select id from pledges where donor_phone = $1 limit 1", [phone]))[0].id;
        const remind = async (pledge: string, channel: string, step: string) => (await q(undefined,
            "insert into pledge_reminders (pledge_id, org_id, action, channel, scheduled_at, status) values ($1, $2, $3, $4, now() - interval '1 minute', 'pending') returning id, status, error", [pledge, org, step, channel]))[0];
        const [enr] = await q(undefined, "insert into journey_enrollments (org_id, email, phone, trigger, anchor) values ($1, 'sms-test@x.test', $2, 'eid', '2027-03-09') returning id", [org, ph]);
        const send = async (channel: string, kind: string) => (await q(undefined,
            "insert into journey_sends (org_id, enrollment_id, kind, channel, scheduled_at, status) values ($1, $2, $3, $4, now() - interval '1 minute', 'pending') returning id, status, error", [org, enr.id, kind, channel]))[0];

        const queued = await remind(await pl(ph), "sms", "queued"), queuedJ = await send("sms", "thanks");
        expect(queued.status).toBe("pending");
        await q(undefined, "select sms_opt($1, true)", [ph]);
        for (const [t, id] of [["pledge_reminders", queued.id], ["journey_sends", queuedJ.id]]) expect((await q(undefined, `select status, error from ${t} where id = $1`, [id]))[0]).toEqual({ status: "skipped", error: "opted_out" });

        expect(await remind(await pl(ph), "sms", "later")).toMatchObject({ status: "skipped", error: "opted_out" });
        expect(await send("sms", "impact")).toMatchObject({ status: "skipped", error: "opted_out" });
        const mail = await remind(await pl(ph), "email", "later"), mailJ = await send("email", "impact");
        expect([mail.status, mailJ.status]).toEqual(["pending", "pending"]);
        const fine = await remind(await pl(other), "sms", "later");
        expect(fine.status).toBe("pending");

        const claimed = (await q(undefined, "select id from pledge_reminders_claim($1, 500)", [org])).map((r) => r.id);
        expect(claimed).toContain(fine.id); expect(claimed).not.toContain(queued.id);
        // STOP also paused this number's pledges, so its pledge email is closed by the claim as before; the journey email still goes.
        expect((await q(undefined, "select error from pledge_reminders where id = $1", [mail.id]))[0].error).toBe("pledge closed");
        await q(undefined, "select sms_opt($1, false)", [ph]);
        expect(await remind(await pl(ph), "sms", "after-start")).toMatchObject({ status: "pending" });
    });
});
