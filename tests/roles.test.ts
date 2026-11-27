// Roles, invites and the organiser view's numbers (migration 20261127010000).
import { describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, fresh, signUp } from "./pg";

const setup = async () => {
    const db = await fresh();
    const { rows: [o] } = await db.query<{ id: string }>("select id from orgs where slug = 'clearwell'");
    const people: Record<string, string> = {};
    for (const role of ["owner", "admin", "editor", "viewer"]) {
        people[role] = await signUp(db, `${role}@x.test`);
        await db.query("insert into org_members (org_id, user_id, role) values ($1, $2, $3)", [o.id, people[role], role]);
    }
    people.donor = await signUp(db, "donor@x.test");
    return { db, org: o.id, people };
};
const call = (db: PGlite, uid: string | null, sql: string, args: unknown[] = []) => as(db, uid, () => db.query(sql, args));
const can = async (p: Promise<unknown>) => p.then(() => true, () => false);

describe("roles", () => {
    it("ranks owner > admin > editor > viewer, and editing needs editor", async () => {
        const { db, org, people } = await setup();
        const save = (who: string) => can(call(db, people[who], "select bio_save($1, '{}'::jsonb)", [org]));
        expect(await save("editor")).toBe(true);
        expect(await save("viewer")).toBe(false);
        expect(await save("donor")).toBe(false);
    });

    it("viewers and up see the organiser view; donors and the public do not", async () => {
        const { db, org, people } = await setup();
        const see = (uid: string | null) => can(call(db, uid, "select org_insights($1)", [org]));
        expect(await see(people.viewer)).toBe(true);
        expect(await see(people.donor)).toBe(false);
        expect(await see(null)).toBe(false);
    });

    it("viewers cannot read donors' details", async () => {
        const { db, org, people } = await setup();
        await db.query("insert into donations (org_id, donor_name, donor_email, amount_cents, currency, status) values ($1, 'A', 'a@x.test', 1000, 'GBP', 'succeeded')", [org]);
        expect((await call(db, people.viewer, "select donor_email from donations")).rows).toHaveLength(0);
        expect((await call(db, people.editor, "select donor_email from donations")).rows).toHaveLength(1);
    });

    it("only admins manage the team, only owners touch admins and owners, and the last owner stays", async () => {
        const { db, org, people } = await setup();
        expect(await can(call(db, people.editor, "select member_add($1, 'new@x.test', 'viewer')", [org]))).toBe(false);
        expect(await can(call(db, people.admin, "select member_set_role($1, $2, 'editor')", [org, people.viewer]))).toBe(true);
        expect(await can(call(db, people.admin, "select member_set_role($1, $2, 'owner')", [org, people.editor]))).toBe(false);
        expect(await can(call(db, people.admin, "select member_remove($1, $2)", [org, people.owner]))).toBe(false);
        expect(await can(call(db, people.owner, "select member_set_role($1, $2, 'admin')", [org, people.owner]))).toBe(false);
        expect(await can(call(db, people.viewer, "select member_remove($1, $2)", [org, people.viewer]))).toBe(true);
    });

    it("an invite turns into membership when that person first signs in", async () => {
        const { db, org, people } = await setup();
        const r = await call(db, people.admin, "select member_add($1, 'Trustee@X.test', 'viewer') as added", [org]);
        expect((r.rows[0] as { added: boolean }).added).toBe(false);
        const t = await signUp(db, "trustee@x.test");
        const roles = await call(db, t, "select slug, role from my_roles()");
        expect(roles.rows).toEqual([{ slug: "clearwell", role: "viewer" }]);
        expect((await db.query("select 1 from org_invites")).rows).toHaveLength(0);
    });

    it("org_insights adds up paid gifts by fund and Gift Aid, keeping anonymous donors anonymous", async () => {
        const { db, org, people } = await setup();
        const gift = (name: string, cents: number, fund: string, giftAid: boolean, anonymous: boolean) =>
            db.query("insert into donations (org_id, donor_name, donor_email, anonymous, amount_cents, currency, status, fund, gift_aid) values ($1, $2, $3, $4, $5, 'GBP', 'succeeded', $6, $7)", [org, name, `${name}@x.test`, anonymous, cents, fund, giftAid]);
        await gift("a", 4000, "Zakat", true, false);
        await gift("b", 1000, "Sadaqah", false, true);
        const r = await call(db, people.viewer, "select org_insights($1) as i", [org]);
        const i = (r.rows[0] as { i: { raised_cents: number; gift_aid_cents: number; by_fund: Record<string, number>; top: { name: string }[] } }).i;
        expect(i.raised_cents).toBe(5000);
        expect(i.gift_aid_cents).toBe(1000);
        expect(i.by_fund).toEqual({ Zakat: 4000, Sadaqah: 1000 });
        expect(i.top.map((t) => t.name)).toEqual(["a", "Anonymous"]);
    });
});
