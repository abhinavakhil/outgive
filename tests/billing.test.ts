// Chapters (has_role parent inheritance) and plan gating (migration 20261128600000).
import { describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, fresh, signUp } from "./pg";

const call = (db: PGlite, uid: string | null, sql: string, args: unknown[] = []) => as(db, uid, () => db.query(sql, args));
const can = async (p: Promise<unknown>) => p.then(() => true, () => false);
const one = async <T>(db: PGlite, uid: string | null, sql: string, args: unknown[] = []) => ((await call(db, uid, sql, args)).rows[0] as { v: T }).v;

const setup = async () => {
    const db = await fresh();
    const { rows: [o] } = await db.query<{ id: string }>("select id from orgs where slug = 'clearwell'");
    const people: Record<string, string> = {};
    for (const role of ["owner", "admin", "editor", "viewer"]) {
        people[role] = await signUp(db, `${role}@x.test`);
        await db.query("insert into org_members (org_id, user_id, role) values ($1, $2, $3)", [o.id, people[role], role]);
    }
    people.lead = await signUp(db, "lead@x.test");
    const chapter = await one<string>(db, people.admin, "select chapter_create($1, 'Clearwell Dallas', 'clearwell-dallas') as v", [o.id]);
    const sibling = await one<string>(db, people.owner, "select chapter_create($1, 'Clearwell Austin', 'clearwell-austin') as v", [o.id]);
    await db.query("insert into org_members (org_id, user_id, role) values ($1, $2, 'admin')", [chapter, people.lead]);
    return { db, org: o.id, chapter, sibling, people };
};
const role = (db: PGlite, uid: string, org: string, min: string) => one<boolean>(db, uid, "select has_role($1, $2) as v", [org, min]);

describe("chapters", () => {
    it("parent admins and owners hold their role in each chapter; parent editors and viewers do not", async () => {
        const { db, chapter, people } = await setup();
        expect(await role(db, people.owner, chapter, "owner")).toBe(true);
        expect(await role(db, people.admin, chapter, "admin")).toBe(true);
        expect(await role(db, people.admin, chapter, "owner")).toBe(false);
        expect(await role(db, people.editor, chapter, "viewer")).toBe(false);
        expect(await role(db, people.viewer, chapter, "viewer")).toBe(false);
    });

    it("nothing flows up to the parent or across to a sibling chapter", async () => {
        const { db, org, sibling, people } = await setup();
        expect(await role(db, people.lead, org, "viewer")).toBe(false);
        expect(await role(db, people.lead, sibling, "viewer")).toBe(false);
    });

    it("parent admins can edit and manage a chapter's team, and see it in my_roles", async () => {
        const { db, chapter, people } = await setup();
        expect(await can(call(db, people.admin, "select bio_save($1, '{}'::jsonb)", [chapter]))).toBe(true);
        expect(await can(call(db, people.admin, "select member_add($1, 'helper@x.test', 'editor')", [chapter]))).toBe(true);
        const roles = (await call(db, people.admin, "select slug, role from my_roles() order by slug")).rows;
        expect(roles).toEqual([{ slug: "clearwell", role: "admin" }, { slug: "clearwell-austin", role: "admin" }, { slug: "clearwell-dallas", role: "admin" }]);
        expect((await call(db, people.lead, "select slug from my_roles()")).rows).toEqual([{ slug: "clearwell-dallas" }]);
    });

    it("only parent admins add chapters, chapters cannot nest, and the list rolls up each chapter's gifts", async () => {
        const { db, org, chapter, people } = await setup();
        expect(await can(call(db, people.editor, "select chapter_create($1, 'X', 'x-chapter')", [org]))).toBe(false);
        expect(await can(call(db, people.lead, "select chapter_create($1, 'Y', 'y-chapter')", [chapter]))).toBe(false);
        await expect(db.query("update orgs set parent_org_id = $1 where id = $2", [chapter, org])).rejects.toThrow();
        await db.query("insert into donations (org_id, donor_name, donor_email, amount_cents, currency, status) values ($1, 'A', 'a@x.test', 2500, 'USD', 'succeeded')", [chapter]);
        const list = await one<{ slug: string; insights: { raised_cents: number } }[]>(db, people.admin, "select chapters_list($1) as v", [org]);
        expect(list.map((c) => [c.slug, c.insights.raised_cents])).toEqual([["clearwell-austin", 0], ["clearwell-dallas", 2500]]);
        expect(await can(call(db, people.viewer, "select chapters_list($1)", [org]))).toBe(false);
    });
});

describe("plans", () => {
    const sub = (db: PGlite, org: string, plan: string, status: string) =>
        db.query("insert into org_subscriptions (org_id, plan, status) values ($1, $2, $3) on conflict (org_id) do update set plan = excluded.plan, status = excluded.status", [org, plan, status]);
    const allows = (db: PGlite, uid: string, org: string, f: string) => one<boolean>(db, uid, "select plan_allows($1, $2) as v", [org, f]);

    it("free by default: no pledge recovery, analytics, unlimited appeals or chapters", async () => {
        const { db, org, people } = await setup();
        for (const f of ["pledge_recovery", "analytics", "appeals_unlimited", "chapters"]) expect(await allows(db, people.viewer, org, f)).toBe(false);
        expect(await one(db, people.viewer, "select billing_status($1) ->> 'plan' as v", [org])).toBe("free");
    });

    it("standard unlocks the tools, multi adds chapters, and chapters take the parent's plan", async () => {
        const { db, org, chapter, people } = await setup();
        await sub(db, org, "standard", "active");
        expect(await allows(db, people.viewer, org, "pledge_recovery")).toBe(true);
        expect(await allows(db, people.viewer, org, "chapters")).toBe(false);
        await sub(db, org, "multi", "past_due");
        expect(await allows(db, people.viewer, org, "chapters")).toBe(true);
        expect(await allows(db, people.lead, chapter, "analytics")).toBe(true);
        await sub(db, org, "multi", "canceled");
        expect(await allows(db, people.viewer, org, "analytics")).toBe(false);
    });

    it("a founding pilot is free with the agreed plan until its date, set only by Outgive staff", async () => {
        const { db, org, people } = await setup();
        expect(await can(call(db, people.owner, "select billing_set_pilot($1, '2999-01-01', 'multi', 'letter')", [org]))).toBe(false);
        await db.query("update profiles set is_platform_admin = true where id = $1", [people.lead]);
        await call(db, people.lead, "select billing_set_pilot($1, '2999-01-01', 'multi', 'Pilot letter 2026-11-28')", [org]);
        expect(await one(db, people.viewer, "select org_plan($1) as v", [org])).toBe("multi");
        await db.query("update org_subscriptions set pilot_until = '2020-01-01'");
        expect(await one(db, people.viewer, "select org_plan($1) as v", [org])).toBe("free");
    });

    it("billing details are for admins; viewers get the plan only", async () => {
        const { db, org, people } = await setup();
        await sub(db, org, "standard", "active");
        expect(await one(db, people.admin, "select billing_status($1) ->> 'status' as v", [org])).toBe("active");
        expect(await one(db, people.viewer, "select billing_status($1) ->> 'status' as v", [org])).toBe(null);
        expect((await call(db, people.viewer, "select * from org_subscriptions")).rows).toHaveLength(0);
        expect(await can(call(db, null, "select billing_status($1)", [org]))).toBe(false);
    });
});
