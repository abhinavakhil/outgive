// The payment service's tables and the live Ramadan page (migration 20261127000000).
import { describe, expect, it } from "vitest";
import { as, fresh, signUp } from "./pg";

describe("payment service and the Ramadan page", () => {
    it("keeps payment_accounts in step with a charity's Stripe and PayPal connections", async () => {
        const db = await fresh();
        const { rows: [o] } = await db.query<{ id: string }>("select id from orgs where slug = 'clearwell'");
        await db.query("update orgs set stripe_account_id = 'acct_1', stripe_charges_enabled = true, paypal_merchant_id = 'PP1' where id = $1", [o.id]);
        const acc = await db.query<{ provider: string; external_id: string; charges_enabled: boolean }>("select provider, external_id, charges_enabled from payment_accounts where org_id = $1 order by provider", [o.id]);
        expect(acc.rows).toEqual([{ provider: "paypal", external_id: "PP1", charges_enabled: true }, { provider: "stripe", external_id: "acct_1", charges_enabled: true }]);
        await db.query("update orgs set paypal_merchant_id = null where id = $1", [o.id]);
        expect((await db.query("select 1 from payment_accounts where org_id = $1 and provider = 'paypal'", [o.id])).rows).toHaveLength(0);
    });

    it("bio_get shows paid gifts only, split by cause, and hides anonymous names", async () => {
        const db = await fresh();
        const { rows: [o] } = await db.query<{ id: string }>("select id from orgs where slug = 'clearwell'");
        const gift = (name: string, cents: number, status: string, anonymous: boolean, split: Record<string, number>) =>
            db.query("insert into donations (org_id, donor_name, donor_email, anonymous, amount_cents, currency, status, fund, details) values ($1, $2, $3, $4, $5, 'GBP', $6, 'Zakat', $7)", [o.id, name, `${name}@x.test`, anonymous, cents, status, JSON.stringify({ split })]);
        await gift("aisha", 5000, "succeeded", false, { c1: 3000, water: 2000 });
        await gift("omar", 2000, "succeeded", true, { water: 2000 });
        await gift("pending", 9900, "pending", false, { c1: 9900 });
        const r = await as(db, null, () => db.query<{ b: { org_id: string; stats: { raised_cents: number; donors: number; by_cause: Record<string, { cents: number; donors: number }>; recent: { name: string }[]; top: { name: string }[] } } }>("select bio_get('clearwell') as b"));
        const s = r.rows[0].b.stats;
        expect(s.raised_cents).toBe(7000);
        expect(s.donors).toBe(2);
        expect(s.by_cause).toEqual({ c1: { cents: 3000, donors: 1 }, water: { cents: 4000, donors: 2 } });
        expect(s.recent.map((g) => g.name).sort()).toEqual(["Anonymous", "aisha"]);
        expect(s.top.map((t) => t.name)).toEqual(["aisha"]);
        expect(JSON.stringify(r.rows[0].b)).not.toContain("@x.test");
    });

    it("only members save the page", async () => {
        const db = await fresh();
        const { rows: [o] } = await db.query<{ id: string }>("select id from orgs where slug = 'clearwell'");
        const stranger = await signUp(db, "s@x.test");
        await expect(as(db, stranger, () => db.query("select bio_save($1, '{\"name\":\"x\"}'::jsonb)", [o.id]))).rejects.toThrow(/Not a member/);
        const owner = await signUp(db, "o@x.test");
        await db.query("insert into org_members (org_id, user_id, role) values ($1, $2, 'owner')", [o.id, owner]);
        await as(db, owner, () => db.query("select bio_save($1, '{\"name\":\"Clearwell\"}'::jsonb)", [o.id]));
        expect((await db.query<{ bio: { name: string } }>("select bio from orgs where id = $1", [o.id])).rows[0].bio.name).toBe("Clearwell");
    });
});
