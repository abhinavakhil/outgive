import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, fresh, signUp } from "./pg";

let db: PGlite; let owner: string; let donor: string; let org: { id: string }; let campaign: { id: string }; let page: { id: string; supporter_id: string };
const rpc = async <T = any>(name: string, args: Record<string, unknown>) => {
    const keys = Object.keys(args);
    const r = await db.query<Record<string, T>>(`select to_jsonb(${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})) as v`, keys.map((k) => (typeof args[k] === "object" && args[k] !== null ? JSON.stringify(args[k]) : args[k])));
    return r.rows[0].v;
};
const rows = async <T = any>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

beforeAll(async () => {
    db = await fresh();
    owner = await signUp(db, "owner@clearwell.test");
    donor = await signUp(db, "amara@example.test");
}, 60000);

describe("organisations", () => {
    it("anon cannot create an org", async () => {
        await expect(as(db, null, () => rpc("org_create", { p: { slug: "x", name: "X" } }))).rejects.toThrow(/Sign in/);
    });
    it("a signed-in user creates an org and becomes its owner", async () => {
        org = await as(db, owner, () => rpc("org_create", { p: { slug: "clearwell", name: "Clearwell Trust", tagline: "Clean water", impact_usd: 6000, impact_unit: "boreholes", currency: "GBP" } }));
        expect(org.id).toBeTruthy();
        const m = await rows("select role from org_members where org_id = $1 and user_id = $2", [org.id, owner]);
        expect(m[0].role).toBe("owner");
        expect((await rows("select * from org_by_slug('clearwell')"))[0].currency).toBe("GBP");
    });
    it("slug must be url-safe", async () => {
        await expect(as(db, owner, () => rpc("org_create", { p: { slug: "Bad Slug!", name: "X" } }))).rejects.toThrow();
    });
    it("only members update the org", async () => {
        await expect(as(db, donor, () => rpc("org_update", { org: org.id, p: { name: "Hijack" } }))).rejects.toThrow(/Not a member/);
        const o = await as(db, owner, () => rpc("org_update", { org: org.id, p: { color: "#1f7a4d", custom_domain: "Give.Clearwell.org", live: { ask: "Who gives £500?" } } }));
        expect(o.color).toBe("#1f7a4d");
        expect((await rows("select * from org_by_host('give.clearwell.org')")).length).toBe(1);
        expect(o.live.ask).toBe("Who gives £500?");
    });
    it("members can be added by email", async () => {
        expect(await as(db, owner, () => rpc("member_add", { org: org.id, member_email: "AMARA@example.test", member_role: "editor" }))).toBe(true);
        expect(await as(db, owner, () => rpc("member_add", { org: org.id, member_email: "nobody@example.test" }))).toBe(false);
        await as(db, owner, () => rows("select member_remove($1, $2)", [org.id, donor]));
        expect((await rows("select 1 from org_members where user_id = $1", [donor])).length).toBe(0);
    });
});

describe("pages", () => {
    it("only org members create campaigns; anyone signed in creates a fundraiser under it", async () => {
        await expect(as(db, donor, () => rpc("page_create", { p: { org_id: org.id, type: "campaign", slug: "water", title: "Water" } }))).rejects.toThrow(/organisation/);
        campaign = await as(db, owner, () => rpc("page_create", { p: { org_id: org.id, type: "campaign", slug: "clean-water", title: "Clean water for 40 villages", goal_cents: 3000000, currency: "GBP", gifts: [10, 25, 50], causes: ["Clean Water"] } }));
        expect(campaign.id).toBeTruthy();
        page = await as(db, donor, () => rpc("page_create", { p: { org_id: org.id, type: "fundraiser", slug: "amara-runs", title: "Amara runs the marathon", parent_id: campaign.id, goal_cents: 100000, currency: "GBP" } }));
        expect(page.supporter_id).toBeTruthy();
        const s = await rows("select name, kind, link from supporters where id = $1", [page.supporter_id]);
        expect(s[0]).toMatchObject({ name: "Amara runs the marathon", kind: "Individuals", link: "/f/amara-runs" });
    });
    it("a taken slug gets a suffix", async () => {
        const p2 = await as(db, donor, () => rpc("page_create", { p: { org_id: org.id, type: "fundraiser", slug: "amara-runs", title: "Second page" } }));
        expect(p2.slug).toBe("amara-runs-2");
    });
    it("drafts are hidden from the public but visible to their owner", async () => {
        await as(db, donor, () => rpc("page_update", { page: page.id, p: { status: "draft" } }));
        expect(await as(db, null, () => rpc("page_get", { org: org.id, t: "fundraiser", s: "amara-runs" }))).toBeNull();
        expect((await as(db, donor, () => rpc("page_get", { org: org.id, t: "fundraiser", s: "amara-runs" }))).page.status).toBe("draft");
        await as(db, donor, () => rpc("page_update", { page: page.id, p: { status: "live", title: "Amara runs Nairobi" } }));
        expect((await rows("select name from supporters where id = $1", [page.supporter_id]))[0].name).toBe("Amara runs Nairobi");
    });
    it("strangers cannot edit a page or post updates", async () => {
        const stranger = await signUp(db, "stranger@example.test");
        await expect(as(db, stranger, () => rpc("page_update", { page: page.id, p: { title: "Mine now" } }))).rejects.toThrow(/cannot edit/);
        await expect(as(db, stranger, () => rpc("update_post", { page: page.id, t: "Hi", b: "" }))).rejects.toThrow(/cannot post/);
        const u = await as(db, owner, () => rpc("update_post", { page: page.id, t: "Drilling starts", b: "The rig arrived." }));
        expect(u.title).toBe("Drilling starts");
    });
    it("ticket types are replaced as a set", async () => {
        const ev = await as(db, owner, () => rpc("page_create", { p: { org_id: org.id, type: "event", slug: "gala", title: "Gala dinner" } }));
        const t1 = await as(db, owner, () => rpc("ticket_types_set", { page: ev.id, items: [{ name: "Seat", price_cents: 6000, quantity: 120 }, { name: "Table of 8", price_cents: 44000 }] }));
        expect(t1.length ?? (await rows("select * from ticket_types where page_id = $1", [ev.id])).length).toBeTruthy();
        const list = await rows("select id, name from ticket_types where page_id = $1 order by sort", [ev.id]);
        expect(list.map((x: any) => x.name)).toEqual(["Seat", "Table of 8"]);
        await as(db, owner, () => rpc("ticket_types_set", { page: ev.id, items: [{ id: list[0].id, name: "Seat", price_cents: 6500, quantity: 100 }] }));
        expect((await rows("select name, price_cents from ticket_types where page_id = $1", [ev.id]))).toEqual([{ name: "Seat", price_cents: 6500 }]);
    });
});

describe("donations and the board", () => {
    it("the public cannot insert donations directly", async () => {
        await expect(as(db, null, () => db.query("insert into donations (org_id, page_id, amount_cents, currency, usd_cents) values ($1, $2, 100, 'USD', 100)", [org.id, page.id]))).rejects.toThrow();
        await expect(as(db, donor, () => rpc("donation_record", { p: { page_id: page.id, amount_cents: 5000, currency: "GBP", donor_name: "Me" } }))).rejects.toThrow(/organisation/);
    });
    it("the service role (webhook) inserts a card gift; totals, USD conversion and roll-up follow", async () => {
        await db.exec("set role service_role");
        await db.query("insert into donations (org_id, page_id, donor_name, donor_email, amount_cents, currency, status, source, stripe_payment_intent_id, message) values ($1, $2, 'Jonas Weber', 'jonas@example.test', 7800, 'gbp', 'succeeded', 'card', 'pi_1', 'Go Amara')", [org.id, page.id]);
        await db.exec("reset role");
        const d = (await rows("select currency, usd_cents, supporter_id, org_id from donations where stripe_payment_intent_id = 'pi_1'"))[0];
        expect(d.currency).toBe("GBP");
        expect(Number(d.usd_cents)).toBe(10000); // 78 GBP at 0.78 per USD
        expect(d.supporter_id).toBe(page.supporter_id);
        expect((await rows("select raised_cents, donor_count from pages where id = $1", [page.id]))[0]).toEqual({ raised_cents: 7800, donor_count: 1 });
        expect((await rows("select raised_cents, donor_count from pages where id = $1", [campaign.id]))[0]).toEqual({ raised_cents: 7800, donor_count: 1 });
    });
    it("a pending gift counts for nothing until it succeeds; a refund takes it back", async () => {
        await db.exec("set role service_role");
        await db.query("insert into donations (org_id, page_id, donor_name, amount_cents, currency, status, stripe_payment_intent_id) values ($1, $2, 'Pending Pat', 100000, 'GBP', 'pending', 'pi_2')", [org.id, page.id]);
        expect((await rows("select raised_cents from pages where id = $1", [page.id]))[0].raised_cents).toBe(7800);
        await db.query("update donations set status = 'succeeded' where stripe_payment_intent_id = 'pi_2'");
        expect((await rows("select raised_cents from pages where id = $1", [page.id]))[0].raised_cents).toBe(107800);
        await db.query("update donations set status = 'refunded' where stripe_payment_intent_id = 'pi_2'");
        await db.exec("reset role");
        expect((await rows("select raised_cents, donor_count from pages where id = $1", [page.id]))[0]).toEqual({ raised_cents: 7800, donor_count: 1 });
    });
    it("an org member records an offline gift that creates a board row; anonymous gifts hide the name", async () => {
        const d = await as(db, owner, () => rpc("donation_record", { p: { org_id: org.id, amount_cents: 1890000, currency: "USD", donor_name: "Amara Okafor", supporter_name: "Amara Okafor", supporter_kind: "Individuals", supporter_tagline: "Running for Kitui", source: "offline", claimed_rank: 1 }}));
        expect(d.status).toBe("succeeded");
        const anon = await as(db, owner, () => rpc("donation_record", { p: { org_id: org.id, amount_cents: 500, currency: "USD", donor_name: "Secret", anonymous: true, supporter_name: "Northfield Rotary", supporter_kind: "Teams" } }));
        expect(anon.donor_name).toBe("Anonymous");
        const cause = await as(db, owner, () => rpc("donation_record", { p: { org_id: org.id, amount_cents: 60000, currency: "USD", donor_name: "Cause Giver", cause: "A borehole for a village" } }));
        expect(cause.cause).toBe("A borehole for a village");
        expect((await as(db, null, () => rows("select cause from activity($1, 5)", [org.id]))).some((r: any) => r.cause === "A borehole for a village")).toBe(true);
        await expect(as(db, owner, () => rpc("donation_record", { p: { org_id: org.id, amount_cents: 500, currency: "USD", source: "card" } }))).rejects.toThrow(/source/);
    });
    it("the board ranks supporters by USD with today, week, recruited and streak", async () => {
        const b = await as(db, null, () => rows("select * from board($1)", [org.id]));
        expect(b.map((r: any) => r.name)).toEqual(["Amara Okafor", "Amara runs Nairobi", "Northfield Rotary"]);
        expect(Number(b[0].total)).toBe(18900);
        expect(Number(b[0].today)).toBe(18900);
        expect(Number(b[1].recruited)).toBe(1); // Jonas gave to Amara's page
        expect(Number(b[1].streak)).toBe(1);
        expect(b[2].kind).toBe("Teams");
    });
    it("every gift change is broadcast to the org channel with public-safe fields only", async () => {
        const sent = await rows("select payload, topic, private from realtime.sent where topic = $1 order by (payload->>'created_at')", [`donations:${org.id}`]);
        expect(sent.length).toBeGreaterThanOrEqual(4);
        expect(sent.every((m: any) => m.private === true)).toBe(true);
        expect(sent.some((m: any) => m.payload.donor_name === "Anonymous")).toBe(true);
        expect(sent.some((m: any) => m.payload.donor_name === "Secret" || "donor_email" in m.payload || "stripe_payment_intent_id" in m.payload)).toBe(false);
        expect(sent.map((m: any) => m.payload.status)).toContain("refunded");
    });
    it("public_donations never exposes emails or anonymous names", async () => {
        const cols = (await rows("select column_name from information_schema.columns where table_name = 'public_donations'")).map((c: any) => c.column_name);
        expect(cols).not.toContain("donor_email");
        const pub = await as(db, null, () => rows("select name from public_donations where org_id = $1 order by created_at", [org.id]));
        expect(pub.some((r: any) => r.name === "Secret")).toBe(false);
        expect(pub.some((r: any) => r.name === "Anonymous")).toBe(true);
        const direct = await as(db, null, () => rows("select * from donations"));
        expect(direct.length).toBe(0);
    });
    it("page_get bundles page, gifts, updates and rank context", async () => {
        const g = await as(db, null, () => rpc("page_get", { org: org.id, t: "fundraiser", s: "amara-runs" }));
        expect(g.page.raised_cents).toBe(7800);
        expect(g.donations.length).toBe(1);
        expect(g.updates[0].title).toBe("Drilling starts");
        expect(g.parent.slug).toBe("clean-water");
        expect(g.can_edit).toBe(false);
        const c = await as(db, null, () => rpc("page_get", { org: org.id, t: "campaign", s: "clean-water" }));
        expect(c.children[0].title).toBe("Amara runs Nairobi");
    });
    it("a matching pledge doubles gifts up to its cap", async () => {
        await as(db, owner, () => rpc("match_pledge_set", { org: org.id, p: { sponsor_name: "Bluefin Logistics", cap_cents: 10000, ratio: 1 } }));
        await as(db, owner, () => rpc("donation_record", { p: { org_id: org.id, page_id: page.id, amount_cents: 6000, currency: "USD", donor_name: "Kofi" } }));
        await as(db, owner, () => rpc("donation_record", { p: { org_id: org.id, page_id: page.id, amount_cents: 6000, currency: "USD", donor_name: "Hana" } }));
        const m = await rows("select amount_cents from donations where source = 'match' order by created_at");
        expect(m.map((x: any) => Number(x.amount_cents))).toEqual([6000, 4000]);
        expect((await rows("select matched_cents from match_pledges"))[0].matched_cents).toBe(10000);
        const b = await rows("select name, match from board($1) where name = 'Bluefin Logistics'", [org.id]);
        expect(Number(b[0].match)).toBe(100);
    });
    it("a donor who signs up later gets their earlier gifts linked by email", async () => {
        const jonas = await signUp(db, "Jonas@example.test");
        expect((await rows("select donor_id from donations where stripe_payment_intent_id = 'pi_1'"))[0].donor_id).toBe(jonas);
        const mine = await as(db, jonas, () => rows("select * from my_donations()"));
        expect(mine.length).toBe(1);
    });
    it("org stats and admin lists are members-only", async () => {
        expect(await as(db, null, () => rpc("org_stats", { org: org.id }))).toBeNull();
        const s = await as(db, owner, () => rpc("org_stats", { org: org.id }));
        expect(Number(s.donations)).toBeGreaterThanOrEqual(5);
        expect((await as(db, donor, () => rows("select * from org_donations($1)", [org.id]))).length).toBe(0);
        expect((await as(db, owner, () => rows("select * from org_donations($1)", [org.id]))).length).toBeGreaterThanOrEqual(5);
        expect((await as(db, null, () => rows("select * from activity($1, 3)", [org.id]))).length).toBe(3);
    });
    it("refunding via RPC is members-only and recounts", async () => {
        const d = (await rows("select id from donations where donor_name = 'Kofi'"))[0];
        await expect(as(db, donor, () => rows("select donation_set_status($1, $2)", [d.id, "refunded"]))).rejects.toThrow();
        const before = (await rows("select raised_cents from pages where id = $1", [page.id]))[0].raised_cents;
        await as(db, owner, () => rows("select donation_set_status($1, $2)", [d.id, "refunded"]));
        expect((await rows("select raised_cents from pages where id = $1", [page.id]))[0].raised_cents).toBe(before - 6000);
    });
});
