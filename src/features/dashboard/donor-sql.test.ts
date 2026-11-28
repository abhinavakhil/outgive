// The donor self-service SQL (20261121000200) on a real Postgres: a donor reaches only their own gifts, and recovery needs consent.
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { MIGRATIONS, as, fresh, signUp } from "../../../tests/pg";

let db: PGlite; let owner: string; let amara: string; let other: string; let org: string; let gift: string; let regular: string;
const rows = async <T = any>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = any>(sql: string, params: unknown[] = []) => (await rows<{ v: T }>(`select to_jsonb(${sql}) as v`, params))[0].v;
const pay = (extra = "") => rows<{ id: string }>(`insert into donations (org_id, donor_name, donor_email, amount_cents, currency, status, source, recurring, stripe_subscription_id, pay_method, gift_aid_cents) values ($1, 'Amara', 'Amara@Example.test', 2500, 'GBP', 'succeeded', 'card', true, 'sub_1', 'dd', 625) returning id ${extra}`, [org]);

beforeAll(async () => {
    db = await fresh(); await db.query("update orgs set slug = slug || '-migrated' where slug = 'clearwell'"); // migration 20261127000000 already creates clearwell
    owner = await signUp(db, "owner@clearwell.test"); amara = await signUp(db, "amara@example.test"); other = await signUp(db, "other@example.test");
    org = (await as(db, owner, () => one<{ id: string }>("org_create($1)", [JSON.stringify({ slug: "clearwell", name: "Clearwell Trust" })]))).id;
    gift = (await pay())[0].id; // as the webhook would: service role, matched to the donor by email only
    await pay(); // next month's invoice on the same subscription
}, 60000);

describe("gift history and receipts", () => {
    it("lists the donor's gifts, matched by their account's email, with method and Gift Aid", async () => {
        const mine = await as(db, amara, () => rows("select * from my_gifts()"));
        expect(mine.length).toBe(2);
        expect(mine[0]).toMatchObject({ org_name: "Clearwell Trust", method: "dd", gift_aid_cents: 625, status: "succeeded", recurring: true });
    });
    it("shows nobody else's", async () => {
        expect((await as(db, other, () => rows("select * from my_gifts()"))).length).toBe(0);
        expect((await as(db, null, () => rows("select * from my_gifts()"))).length).toBe(0);
        expect((await as(db, other, () => rows("select * from donations"))).length).toBe(0); // RLS on the table itself
    });
    it("a receipt opens for its donor only", async () => {
        expect(await as(db, amara, () => one("my_receipt($1)", [gift]))).toMatchObject({ id: gift, amount_cents: 2500, method: "dd", org: { name: "Clearwell Trust" } });
        expect(await as(db, other, () => one("my_receipt($1)", [gift]))).toBeNull();
        expect(await as(db, null, () => one("my_receipt($1)", [gift]))).toBeNull();
    });
    it("a demo gift belongs to the visitor who made it", async () => {
        const d = await as(db, owner, () => one<{ donor_id: string }>("donation_record($1)", [JSON.stringify({ org_id: org, amount_cents: 500, source: "demo", recurring: true })]));
        expect(d.donor_id).toBe(owner);
        expect((await as(db, owner, () => rows("select * from my_recurring()"))).length).toBe(1);
    });
});

describe("regular gifts", () => {
    it("one per subscription, however many invoices", async () => {
        const r = await as(db, amara, () => rows("select * from my_recurring()"));
        expect(r.length).toBe(1);
        expect(r[0]).toMatchObject({ amount_cents: 2500, currency: "GBP", status: "active", every: "monthly", pending: false });
        expect(new Date(r[0].next_at).getTime()).toBeGreaterThan(Date.now());
        regular = r[0].id;
    });
    it("the organisation's members see its regular gifts; nobody else does", async () => {
        const r = await as(db, owner, () => rows("select * from org_recurring($1)", [org]));
        expect(r.find((x: any) => x.id === regular)).toMatchObject({ donor_name: "Amara", amount_cents: 2500, status: "active", method: "dd", failed: false });
        expect((await as(db, amara, () => rows("select * from org_recurring($1)", [org]))).length).toBe(0);
        expect((await as(db, null, () => rows("select * from org_recurring($1)", [org]))).length).toBe(0);
    });
    it("only the donor can change one", async () => {
        await expect(as(db, other, () => one("recurring_change($1, 'cancel')", [regular]))).rejects.toThrow(/not yours/);
        await expect(as(db, owner, () => one("recurring_change($1, 'pause')", [regular]))).rejects.toThrow(/not yours/);
        await expect(as(db, null, () => one("recurring_change($1, 'pause')", [regular]))).rejects.toThrow(/Sign in/);
        expect((await as(db, other, () => rows("select * from recurring_gifts where id = $1", [regular]))).length).toBe(0);
        // No way round the function: the table takes no writes from a donor, not even their own row.
        await expect(as(db, amara, () => rows("update recurring_gifts set amount_cents = 1 where id = $1 returning id", [regular]))).rejects.toThrow(/permission denied/);
    });
    it("pause, resume, amount and cancel, each recorded for the Stripe sync", async () => {
        expect((await as(db, amara, () => one("recurring_change($1, 'pause')", [regular]))).status).toBe("paused");
        await expect(as(db, amara, () => one("recurring_change($1, 'pause')", [regular]))).rejects.toThrow(/already paused/);
        expect((await as(db, amara, () => rows("select * from my_recurring()")))[0]).toMatchObject({ status: "paused", next_at: null, pending: true });
        expect((await as(db, amara, () => one("recurring_change($1, 'resume')", [regular]))).status).toBe("active");
        await expect(as(db, amara, () => one("recurring_change($1, 'amount', 100)", [regular]))).rejects.toThrow(/between/);
        await expect(as(db, amara, () => one("recurring_change($1, 'amount')", [regular]))).rejects.toThrow(/between/);
        await expect(as(db, amara, () => one("recurring_change($1, 'delete')", [regular]))).rejects.toThrow(/Unknown/);
        expect((await as(db, amara, () => one("recurring_change($1, 'amount', 4000)", [regular]))).amount_cents).toBe(4000);
        expect((await as(db, amara, () => one("recurring_change($1, 'cancel')", [regular]))).status).toBe("cancelled");
        await expect(as(db, amara, () => one("recurring_change($1, 'resume')", [regular]))).rejects.toThrow(/cancelled/);
        const log = await rows("select action, amount_cents, applied_at, user_id from recurring_changes where recurring_id = $1 order by created_at", [regular]);
        expect(log.map((c: any) => c.action)).toEqual(["pause", "resume", "amount", "cancel"]);
        expect(log[2].amount_cents).toBe(4000);
        expect(log.every((c: any) => c.applied_at === null && c.user_id === amara)).toBe(true); // a subscription is behind it: all still to sync
    });
});

describe("checkout recovery", () => {
    const req = (over: Record<string, unknown> = {}) => JSON.stringify({ token: "tok-0123456789abcdef", email: " Amara@Example.test ", campaign: "f/help-priya", consent: true, draft: { amount: 50, freq: "monthly", extras: ["cover"], first: "Amara", step: 2, card: "4242424242424242", cvc: "123", sort: "20-00-00", acct: "55779911" }, ...over });
    it("refuses without consent or a real address", async () => {
        await expect(as(db, null, () => one("checkout_recovery_save($1)", [req({ consent: false })]))).rejects.toThrow(/consent/);
        await expect(as(db, null, () => one("checkout_recovery_save($1)", [req({ consent: undefined })]))).rejects.toThrow(/consent/);
        await expect(as(db, null, () => one("checkout_recovery_save($1)", [req({ email: "nope" })]))).rejects.toThrow(/email/);
        expect((await rows("select 1 from checkout_recoveries")).length).toBe(0);
    });
    it("stores a consented request, and never payment details", async () => {
        expect(await as(db, null, () => one("checkout_recovery_save($1)", [req()]))).toBe(true);
        expect(await as(db, null, () => one("checkout_recovery_save($1)", [req({ draft: { amount: 75, step: 3 } })]))).toBe(true); // same token: refreshed, not doubled
        expect(await as(db, null, () => one("checkout_recovery_save($1)", [req()]))).toBe(true);
        const r = await rows("select email, campaign, draft, consumed_at, sent_at from checkout_recoveries");
        expect(r.length).toBe(1);
        expect(r[0]).toMatchObject({ email: "amara@example.test", campaign: "f/help-priya", consumed_at: null, sent_at: null });
        expect(Object.keys(r[0].draft).sort()).toEqual(["amount", "extras", "first", "freq", "step"]);
    });
    it("the table is closed; the token opens one draft until it is used", async () => {
        await expect(as(db, null, () => rows("select * from checkout_recoveries"))).rejects.toThrow(/permission denied/);
        await expect(as(db, amara, () => rows("select * from checkout_recoveries"))).rejects.toThrow(/permission denied/);
        expect(await as(db, null, () => one("checkout_recovery_get($1)", ["wrong-token-0123456789"]))).toBeNull();
        expect(await as(db, null, () => one("checkout_recovery_get($1)", ["tok-0123456789abcdef"]))).toMatchObject({ campaign: "f/help-priya", draft: { amount: 50 } });
        expect(await as(db, null, () => one("checkout_recovery_done($1)", ["tok-0123456789abcdef"]))).toBe(true);
        expect(await as(db, null, () => one("checkout_recovery_get($1)", ["tok-0123456789abcdef"]))).toBeNull();
        expect(await as(db, null, () => one("checkout_recovery_save($1)", [req()]))).toBe(false); // a used token is not reopened
    });
    it("caps open requests per address", async () => {
        for (const n of [1, 2, 3]) expect(await as(db, null, () => one("checkout_recovery_save($1)", [req({ token: `tok-cap-000000000000${n}` })]))).toBe(true);
        expect(await as(db, null, () => one("checkout_recovery_save($1)", [req({ token: "tok-cap-0000000000004" })]))).toBe(false);
    });
});

it("the migration can run again without doubling anything", async () => {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS, "20261121000200_donor_self_service.sql"), "utf8"));
    expect((await rows("select 1 from recurring_gifts")).length).toBe(2);
});
