// Receipts, EIN status and fraud logging (migration 20261128200000) on a real Postgres, against the hope-foundation sample org.
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, fresh, signUp } from "../../../../tests/pg";

let db: PGlite; let org: string; const people: Record<string, string> = {};
const q = async <T = any>(uid: string | null | undefined, sql: string, args: unknown[] = []) => (uid === undefined ? db.query<T>(sql, args) : as(db, uid, () => db.query<T>(sql, args))).then((r) => r.rows);
const fails = (p: Promise<unknown>) => p.then(() => false, () => true);

beforeAll(async () => {
    db = await fresh();
    org = (await q(undefined, "select id from orgs where slug = 'hope-foundation'"))[0].id;
    for (const role of ["admin", "editor", "viewer"]) { people[role] = await signUp(db, `${role}@x.test`); await q(undefined, "insert into org_members (org_id, user_id, role) values ($1, $2, $3)", [org, people[role], role]); }
    people.donor = await signUp(db, "donor@x.test");
}, 60000);

describe("EIN gate and settings", () => {
    it("a US charity takes no payments until its EIN is verified; others are not affected", async () => {
        const ready = async (o: string) => (await q(undefined, "select org_payments_ready($1) as r", [o]))[0].r;
        expect(await ready(org)).toBe(false);
        const uk = (await q(undefined, "select id from orgs where slug = 'clearwell'"))[0].id;
        expect(await ready(uk)).toBe(true);
        await q(undefined, "update orgs set ein_status = 'verified' where id = $1", [org]);
        expect(await ready(org)).toBe(true);
    });

    it("only admins change settings; a new EIN needs the check again; nobody can verify themselves", async () => {
        expect(await fails(q(people.editor, `select compliance_save($1, '{"legal_name":"X"}')`, [org]))).toBe(true);
        const [{ c }] = await q(people.admin, `select compliance_save($1, '{"legal_name":"Hope Foundation Inc.","address":"410 Park Ave, Plainfield, NJ 07060","receipt_goods_line":false}') as c`, [org]);
        expect(c).toMatchObject({ legal_name: "Hope Foundation Inc.", ein: "123456789", receipt_goods_line: false, receipts_unsent: 6, fraud: { min_cents: 500, ip_per_10min: 5, card_per_hour: 3, challenge_after: 2 } });
        await q(undefined, "update orgs set ein_status = 'verified' where id = $1", [org]);
        const [{ c: same }] = await q(people.admin, `select compliance_save($1, '{"ein":"12-3456789"}') as c`, [org]);
        expect(same.ein_status).toBe("verified");
        const [{ c: moved }] = await q(people.admin, `select compliance_save($1, '{"ein":"98-7654321"}') as c`, [org]);
        expect(moved).toMatchObject({ ein: "987654321", ein_status: "unverified", payments_ready: false });
        await fails(q(people.admin, `update orgs set ein_status = 'verified' where id = '${org}'`));
        expect((await q(undefined, "select ein_status from orgs where id = $1", [org]))[0].ein_status).toBe("unverified"); // no direct writes to orgs
        expect((await q(people.viewer, "select compliance_get($1) as c", [org]))[0].c.legal_name).toBe("Hope Foundation Inc.");
        expect(await fails(q(people.donor, "select compliance_get($1)", [org]))).toBe(true);
        expect((await q(people.viewer, "select compliance_get($1) as c", [org]))[0].c.contact_email).toBe("");
        await q(people.admin, "select org_contact_email_save($1, 'Donations@Hope.example')", [org]);
        expect((await q(people.viewer, "select compliance_get($1) as c", [org]))[0].c.contact_email).toBe("donations@hope.example");
    });

    it("fraud settings: defaults until saved, admins only", async () => {
        expect(await fails(q(people.editor, `select fraud_settings_save($1, '{"min_cents":1000}')`, [org]))).toBe(true);
        const [f] = await q(people.admin, `select * from fraud_settings_save($1, '{"min_cents":1000}')`, [org]);
        expect(f).toMatchObject({ min_cents: 1000, ip_per_10min: 5, challenge_after: 2 });
        expect(await fails(q(people.admin, `select fraud_settings_save($1, '{"min_cents":5}')`, [org]))).toBe(true);
    });
});

describe("fraud log", () => {
    it("logs each decline with its attempt's IP and raises one burst alert", async () => {
        await q(undefined, "delete from fraud_events where org_id = $1", [org]); // the sample week
        await q(people.admin, `select fraud_settings_save($1, '{"decline_alert":3}')`, [org]);
        for (let i = 0; i < 4; i++) {
            const key = `attempt-key-burst-${i}`;
            await q(undefined, "insert into fraud_events (org_id, kind, attempt_key, ip_hash) values ($1, 'attempt', $2, 'iphash')", [org, key]);
            const [d] = await q(undefined, "insert into donations (org_id, amount_cents, currency, usd_cents, status, attempt_key) values ($1, 2500, 'USD', 2500, 'pending', $2) returning id", [org, key]);
            await q(undefined, "update donations set status = 'failed', pay_error = 'card_declined' where id = $1", [d.id]);
            await q(undefined, "update donations set status = 'failed' where id = $1", [d.id]); // a second failure event logs nothing more
        }
        const declines = await q(undefined, "select * from fraud_events where org_id = $1 and kind = 'decline'", [org]);
        expect(declines).toHaveLength(4);
        expect(declines.every((e) => e.ip_hash === "iphash" && e.reason === "card_declined")).toBe(true);
        await q(undefined, "insert into fraud_events (org_id, kind, reason) values ($1, 'block', 'ip_rate'), ($1, 'block', 'ip_rate'), ($1, 'block', 'disposable_email')", [org]);
        const [{ l }] = await q(people.viewer, "select fraud_log($1) as l", [org]);
        expect(l).toMatchObject({ blocked: 3, declines: 4, by_reason: [{ reason: "ip_rate", n: 2 }, { reason: "disposable_email", n: 1 }] });
        expect(l.alerts).toHaveLength(1);
        expect(await fails(q(people.donor, "select fraud_log($1)", [org]))).toBe(true);
        expect(await q(people.donor, "select * from fraud_events")).toHaveLength(0);
    });
});

describe("receipts", () => {
    it("numbers count up per org, year and kind; only the service role may draw them", async () => {
        const next = async (yr: number, k = "gift") => (await q(undefined, "select receipt_next($1, $2, $3) as n", [org, yr, k]))[0].n;
        expect([await next(2031), await next(2031), await next(2032), await next(2031, "year_end")]).toEqual([1, 2, 1, 1]);
        expect(await fails(q(people.admin, "select receipt_next($1, 2027, 'gift')", [org]))).toBe(true);
    });

    it("year_end_donors groups a year's paid gifts per email, leaving out refunds and other years", async () => {
        const add = (email: string, cents: number, at: string, status = "succeeded") => q(undefined, "insert into donations (org_id, donor_email, donor_name, amount_cents, cover_cents, currency, usd_cents, status, fund, created_at) values ($1, $2, 'Aisha Khan', $3, 100, 'USD', $3, $4, 'Zakat', $5)", [org, email, cents, status, at]);
        await add("Aisha@x.test", 10000, "2027-03-06T21:00:00Z"); await add("aisha@x.test", 5000, "2027-12-31T23:00:00Z");
        await add("aisha@x.test", 7000, "2027-04-01T00:00:00Z", "refunded"); await add("aisha@x.test", 9000, "2028-01-01T00:00:00Z");
        const rows = await q(undefined, "select * from year_end_donors($1, 2027)", [org]);
        const a = rows.find((r) => r.donor_email === "aisha@x.test");
        expect(a.gifts.map((g: { amount_cents: number }) => g.amount_cents)).toEqual([10000, 5000]);
        expect(await fails(q(people.admin, "select * from year_end_donors($1, 2027)", [org]))).toBe(true);
    });

    it("the team and the donor read receipts; nobody else", async () => {
        await q(undefined, "insert into receipts (org_id, kind, year, number, donor_email, currency, dated) values ($1, 'gift', 2027, 'HF-2027-99999', 'Donor@x.test', 'USD', now())", [org]);
        expect(await q(people.donor, "select number from receipts")).toEqual([{ number: "HF-2027-99999" }]);
        expect((await q(people.viewer, "select number from receipts_list($1)", [org])).map((x) => x.number)).toContain("HF-2027-99999");
        const other = await signUp(db, "other@x.test");
        expect(await q(other, "select * from receipts")).toHaveLength(0);
        expect(await q(other, "select * from receipts_list($1)", [org])).toHaveLength(0);
    });
});

describe("sample", () => {
    it("hope-foundation has 40 receipts (6 unsent) and the prototype's 412 blocked attempts", async () => {
        const db2 = await fresh(), o = (await db2.query<{ id: string }>("select id from orgs where slug = 'hope-foundation'")).rows[0].id;
        const [{ n, unsent }] = (await db2.query<{ n: number; unsent: number }>("select count(*)::int n, count(*) filter (where sent_at is null)::int unsent from receipts where org_id = $1", [o])).rows;
        expect([n, unsent]).toEqual([40, 6]);
        expect((await db2.query<{ n: number }>("select count(*)::int n from fraud_events where org_id = $1 and kind = 'block'", [o])).rows[0].n).toBe(412);
    }, 60000);
});
