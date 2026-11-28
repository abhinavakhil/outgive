// The Headless API: keys, the API's reads and the webhook outbox (migration 20261128500000) on a real Postgres, and the pure parts of
// the api and webhook-deliver functions (signatures, backoff, cursors, idempotency keys).
import crypto from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, fresh, signUp } from "./pg";
import { after, backoff, sign, verify } from "../supabase/functions/webhook-deliver/logic";
import { attemptKey, decodeCursor, encodeCursor, keyShape, page, parseLimit, route, toStart } from "../supabase/functions/api/logic";

describe("webhook signing and retries", () => {
    it("signs t.body with HMAC-SHA256, like any receiver would check it", async () => {
        const h = await sign("whsec_x", '{"a":1}', 1700000000);
        expect(h).toBe(`t=1700000000,v1=${crypto.createHmac("sha256", "whsec_x").update('1700000000.{"a":1}').digest("hex")}`);
        expect(await verify("whsec_x", '{"a":1}', h, 1700000100)).toBe(true);
        expect(await verify("whsec_x", '{"a":2}', h, 1700000100)).toBe(false);       // body changed
        expect(await verify("whsec_y", '{"a":1}', h, 1700000100)).toBe(false);       // other secret
        expect(await verify("whsec_x", '{"a":1}', h, 1700000400)).toBe(false);       // older than five minutes
        expect(await verify("whsec_x", '{"a":1}', "nonsense", 1700000000)).toBe(false);
    });
    it("backs off 1 min, 5 min ... 24 h, then gives up", () => {
        expect([1, 2, 3, 7].map(backoff)).toEqual([60, 300, 1800, 86400]);
        expect(backoff(8)).toBeNull();
        const t = Date.UTC(2027, 2, 1);
        expect(after(0, { ok: false, http: 500, error: null }, t)).toMatchObject({ attempts: 1, status: "pending", last_status: 500, last_error: "HTTP 500", next_at: new Date(t + 60_000).toISOString() });
        expect(after(7, { ok: false, http: null, error: "refused" }, t)).toMatchObject({ attempts: 8, status: "failed", last_error: "refused" });
        expect(after(3, { ok: true, http: 204, error: null }, t)).toMatchObject({ attempts: 4, status: "succeeded", last_error: null });
    });
});

describe("api logic", () => {
    it("routes, keys, limits and cursors", () => {
        expect(route("/api/v1/donations/abc")).toEqual(["donations", "abc"]);
        expect(route("/functions/v1/api/v1/donors/")).toEqual(["donors"]);
        expect(route("/api/donations")).toBeNull();
        expect(keyShape("sk_live_" + "a".repeat(48))).toEqual({ kind: "secret", mode: "live" });
        expect(keyShape("pk_test_" + "0".repeat(48))).toEqual({ kind: "publishable", mode: "test" });
        expect(keyShape("sk_live_short")).toBeNull();
        expect([parseLimit(null), parseLimit("100"), parseLimit("0"), parseLimit("2.5")]).toEqual([25, 100, null, null]);
        const c = encodeCursor("2027-03-01T00:00:00.123456+00:00", "x@y.z:USD");
        expect(decodeCursor(c)).toEqual({ ts: "2027-03-01T00:00:00.123456+00:00", id: "x@y.z:USD" });
        expect(decodeCursor("!!")).toBe("bad");
        const rows = [1, 2, 3].map((i) => ({ id: `id${i}`, created_at: `2027-03-0${i}T00:00:00Z` }));
        expect(page(rows, 2)).toMatchObject({ has_more: true, data: rows.slice(0, 2), next_cursor: encodeCursor(rows[1].created_at, "id2") });
        expect(page(rows, 3)).toMatchObject({ has_more: false, next_cursor: null });
    });
    it("an Idempotency-Key becomes the same attempt_key, per API key", async () => {
        const a = await attemptKey("key1", "order-42");
        expect(a).toMatch(/^api_[0-9a-f]{40}$/);
        expect(await attemptKey("key1", "order-42")).toBe(a);
        expect(await attemptKey("key2", "order-42")).not.toBe(a);
    });
    it("builds the pay function's input with the key's org, and its rules", () => {
        const s = toStart({ amount_cents: 5000, fund: "Zakat", donor: { email: "a@b.co" }, tags: { utm_source: "app" } }, "org-1", "api_" + "0".repeat(40));
        expect(s).toMatchObject({ action: "start", org_id: "org-1", currency: "USD", method: "card", freq: "once", tip_cents: 0, tags: { channel: "api", utm_source: "app" } });
        expect(toStart({ amount_cents: 50 }, "org-1", "api_" + "0".repeat(40))).toBe("The minimum gift is 1.00");
        expect(toStart({ amount_cents: 500, frequency: "nights" as "once" }, "org-1", "api_" + "0".repeat(40))).toMatch(/frequency/);
    });
});

let db: PGlite; let org: string; const people: Record<string, string> = {};
const q = async <T = any>(uid: string | null | undefined, sql: string, args: unknown[] = []) => (uid === undefined ? db.query<T>(sql, args) : as(db, uid, () => db.query<T>(sql, args))).then((r) => r.rows);
const fails = (p: Promise<unknown>) => p.then(() => false, () => true);

describe("headless API in the database", () => {
    beforeAll(async () => {
        db = await fresh();
        org = (await q(undefined, "select id from orgs where slug = 'hope-foundation'"))[0].id;
        for (const role of ["admin", "editor"]) { people[role] = await signUp(db, `${role}@x.test`); await q(undefined, "insert into org_members (org_id, user_id, role) values ($1, $2, $3)", [org, people[role], role]); }
    }, 60000);

    it("keys: admins only, shown once, stored hashed, revocable, rate limited", async () => {
        expect(await fails(q(people.editor, "select api_key_create($1, 'secret', 'test')", [org]))).toBe(true);
        const [{ k }] = await q(people.admin, "select api_key_create($1, 'secret', 'test', 'Server') as k", [org]);
        expect(k.key).toMatch(/^sk_test_[0-9a-f]{48}$/);
        const [row] = await q(undefined, "select * from api_keys where id = $1", [k.id]);
        expect(row.token).toBeNull();
        expect(row.hash).toBe(crypto.createHash("sha256").update(k.key).digest("hex"));
        expect(JSON.stringify(row)).not.toContain(k.key);
        const [{ pk }] = await q(people.admin, "select api_key_create($1, 'publishable', 'test') as pk", [org]);
        expect((await q(undefined, "select token from api_keys where id = $1", [pk.id]))[0].token).toBe(pk.key);

        const [{ a }] = await q(undefined, "select api_auth($1, 2) as a", [k.key]);
        expect(a).toMatchObject({ org_id: org, kind: "secret", mode: "test", limited: false });
        await q(undefined, "select api_auth($1, 2)", [k.key]);
        expect((await q(undefined, "select api_auth($1, 2) as a", [k.key]))[0].a.limited).toBe(true);
        expect((await q(undefined, "select last_used_at from api_keys where id = $1", [k.id]))[0].last_used_at).not.toBeNull();
        expect((await q(undefined, "select api_auth('sk_test_nope') as a"))[0].a).toBeNull();
        expect(await fails(q(people.editor, "select developers_get($1)", [org]))).toBe(true);
        expect(await fails(q(people.admin, "select * from api_keys"))).toBe(true);       // only through the functions
        await q(people.admin, "select api_key_revoke($1, $2)", [org, k.id]);
        expect((await q(undefined, "select api_auth($1) as a", [k.key]))[0].a).toBeNull();
    });

    it("events go to the endpoints that want them, and a webhook problem never blocks a payment", async () => {
        const [{ e }] = await q(people.admin, `select webhook_save($1, '{"url":"https://hooks.example.org/outgive","events":["donation.succeeded","pledge.paid"]}') as e`, [org]);
        const [{ z }] = await q(people.admin, `select webhook_save($1, '{"url":"https://hooks.zapier.com/x","events":["*"]}') as z`, [org]);
        expect(await fails(q(people.admin, `select webhook_save($1, '{"url":"http://insecure.example.org","events":["*"]}')`, [org]))).toBe(true);
        const [d] = await q(undefined, "insert into donations (org_id, amount_cents, currency, donor_name, donor_email, status, fund, tags) values ($1, 5000, 'USD', 'Test Donor', 'td@x.test', 'pending', 'Zakat', '{\"channel\":\"api\"}') returning id", [org]);
        expect(await q(undefined, "select 1 from webhook_events v where v.data ->> 'id' = $1", [d.id])).toHaveLength(0); // pending: nothing yet
        await q(undefined, "update donations set status = 'succeeded' where id = $1", [d.id]);
        await q(undefined, "update donations set status = 'refunded' where id = $1", [d.id]);
        const evs = await q(undefined, "select v.type, v.data, array_agg(x.endpoint_id order by x.endpoint_id) as eps from webhook_events v join webhook_deliveries x on x.event_id = v.id where v.data ->> 'id' = $1 group by v.id order by v.created_at", [d.id]);
        expect(evs.map((v) => v.type)).toEqual(["donation.succeeded", "donation.refunded"]);
        expect(evs[0].eps.sort()).toEqual([e, z].sort());
        expect(evs[1].eps).toEqual([z]);                                                       // the first endpoint did not ask for refunds
        expect(evs[0].data).toMatchObject({ object: "donation", amount_cents: 5000, fund: "Zakat", tags: { channel: "api" }, donor: { email: "td@x.test" } });

        // The outbox breaking (here: its table gone) leaves the donation's own update untouched.
        await q(undefined, "alter table webhook_deliveries rename to wd_away");
        await q(undefined, "update donations set status = 'succeeded' where id = $1", [d.id]);
        expect((await q(undefined, "select status from donations where id = $1", [d.id]))[0].status).toBe("succeeded");
        await q(undefined, "alter table wd_away rename to webhook_deliveries");

        const claimed = await q(undefined, "select * from webhook_claim($1, 10)", [org]);
        expect(claimed.length).toBe(3);
        expect(claimed[0].event).toMatchObject({ object: "event", type: "donation.succeeded" });
        expect(await q(undefined, "select * from webhook_claim($1, 10)", [org])).toHaveLength(0);   // leased, not sent twice
        await q(undefined, "update webhook_deliveries set status = 'failed', attempts = 8 where id = $1", [claimed[0].delivery_id]);
        await q(people.admin, "select webhook_replay($1, $2)", [org, claimed[0].delivery_id]);
        expect((await q(undefined, "select status, attempts from webhook_deliveries where id = $1", [claimed[0].delivery_id]))[0]).toEqual({ status: "pending", attempts: 0 });
        await q(people.admin, "select webhook_test($1, $2)", [org, e]);
        const [{ g }] = await q(people.admin, "select developers_get($1) as g", [org]);
        expect(g.endpoints).toHaveLength(2);
        expect(g.deliveries[0]).toMatchObject({ type: "webhook.test", endpoint_id: e });
    });

    it("pledge and receipt events", async () => {
        const [p] = await q(undefined, "insert into pledges (org_id, donor_name, amount_cents) values ($1, 'Pledger', 10000) returning id", [org]);
        await q(undefined, "insert into pledge_payments (pledge_id, amount_cents, method) values ($1, 10000, 'check')", [p.id]);
        const types = await q(undefined, "select type, data ->> 'status' as s from webhook_events where data ->> 'id' = $1 order by created_at", [p.id]);
        expect(types).toEqual([{ type: "pledge.created", s: "open" }, { type: "pledge.paid", s: "paid" }]);
        const [r] = await q(undefined, "insert into receipts (org_id, year, number, currency, dated) values ($1, 2027, 'T-1', 'USD', now()) returning id", [org]);
        expect(await q(undefined, "select 1 from webhook_events where data ->> 'id' = $1", [r.id])).toHaveLength(0);
        await q(undefined, "update receipts set sent_at = now() where id = $1", [r.id]);
        expect((await q(undefined, "select type from webhook_events where data ->> 'id' = $1", [r.id])).map((x) => x.type)).toEqual(["receipt.sent"]);
    });

    it("api_list pages newest first with a stable cursor, only the key's charity", async () => {
        const all = (await q(undefined, "select api_list($1, 'donations', null, null, 101) as r", [org])).map((x) => x.r);
        expect(all.length).toBeGreaterThan(3);
        const p1 = (await q(undefined, "select api_list($1, 'donations', null, null, 2) as r", [org])).map((x) => x.r);
        const p2 = (await q(undefined, "select api_list($1, 'donations', $2, $3, 2) as r", [org, p1[1].created_at, p1[1].id])).map((x) => x.r);
        expect([...p1, ...p2].map((d) => d.id)).toEqual(all.slice(0, 4).map((d) => d.id));
        const other = (await q(undefined, "select id from orgs where slug <> 'hope-foundation' limit 1"))[0].id;
        expect((await q(undefined, "select api_get($1, 'donations', $2) as r", [other, all[0].id]))[0].r).toBeNull();
        const donors = (await q(undefined, "select api_list($1, 'donors', null, null, 3) as r", [org])).map((x) => x.r);
        expect(donors[0]).toMatchObject({ object: "donor" });
        const d2 = (await q(undefined, "select api_list($1, 'donors', $2, $3, 3) as r", [org, donors[2].last_gift_at, donors[2].id])).map((x) => x.r);
        expect(d2.map((d) => d.id)).not.toContain(donors[2].id);
        expect(await fails(q(people.admin, "select api_list($1, 'donations')", [org]))).toBe(true);  // service role only
    });
});
