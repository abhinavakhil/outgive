// Revenue tracking (migrations 20261128100000 and the 20261128100100 sample), on a real Postgres.
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, fresh, signUp } from "./pg";

let db: PGlite; let org: string; const people: Record<string, string> = {};
const q = async <T = any>(uid: string | null | undefined, sql: string, args: unknown[] = []) => (uid === undefined ? db.query<T>(sql, args) : as(db, uid, () => db.query<T>(sql, args))).then((r) => r.rows);
const fails = (p: Promise<unknown>) => p.then(() => false, () => true);
const one = async (uid: string | null, sql: string, args: unknown[] = []) => (await q(uid, sql, args))[0].r;

beforeAll(async () => {
    db = await fresh();
    org = (await q(undefined, "select id from orgs where slug = 'hope-foundation'"))[0].id;
    for (const role of ["editor", "viewer", "admin"]) { people[role] = await signUp(db, `${role}@x.test`); await q(undefined, "insert into org_members (org_id, user_id, role) values ($1, $2, $3)", [org, people[role], role]); }
    people.donor = await signUp(db, "donor@x.test");
}, 120000);

describe("revenue sample", () => {
    it("matches the prototype's totals by source, fund and night", async () => {
        // This sample alone (the journeys sample, 20261128400100, adds a few more gifts to the same org).
        const [own] = await q(undefined, "select sum(amount_cents)::bigint as cents, count(distinct donor_email)::int as donors from donations where org_id = $1 and tags ->> 'session' like 'smp-%'", [org]);
        expect(Math.round(Number(own.cents) / 100)).toBeGreaterThan(412850);
        expect(Math.round(Number(own.cents) / 100)).toBeLessThan(412870);
        expect(own.donors).toBe(3872);
        const [all] = await q(undefined, "select sum(amount_cents)::bigint as cents from donations where org_id = $1 and status = 'succeeded' and source <> 'match'", [org]);
        const c = await one(people.viewer, "select revenue_campaign($1) as r", [org]);
        expect(c.raised_cents).toBe(Number(all.cents));
        const nights = c.by_night as { night: number; cents: number }[];
        expect(nights).toHaveLength(30);
        expect(nights.reduce((a, b) => (b.cents > a.cents ? b : a)).night).toBe(27);
        const s = await one(people.viewer, "select revenue_sources($1) as r", [org]);
        const qr = s.find((x: any) => x.key === "Live night QR");
        expect(Math.round(qr.cents / 100)).toBeCloseTo(128400, -1);
        expect(qr).toMatchObject({ donors: 1042, visitors: 2310 });
        expect(s.find((x: any) => x.key === "Meta ads").spend_cents).toBe(940000);
        expect(c.by_campaign.map((x: any) => x.key)).toEqual(expect.arrayContaining(["Building fund dinner", "Last ten nights", "Ramadan appeal"]));
    });

    it("tonight, funnel and add-ons", async () => {
        const t = await one(people.viewer, `select revenue_tonight($1, '{"night":27}') as r`, [org]);
        expect(t).toMatchObject({ night: 27, live: false, match_remaining_cents: 0 });
        expect(t.match_pots[0]).toMatchObject({ cap_cents: 2000000, matched_cents: 1376000, active: false });
        expect(t.pledged_cents).toBeGreaterThan(0); // the pledge sample's Night 27 dinner
        expect(t.top_tables.length).toBe(5);
        const f = await one(people.viewer, "select revenue_funnel($1) as r", [org]);
        const all = f.find((x: any) => x.key === "all");
        expect(all.visit).toBe(25040);
        expect(all.paid).toBe((await q(undefined, "select count(*)::int as n from donations where org_id = $1 and tags ->> 'session' like 'smp-%'", [org]))[0].n); // every gift session counts as paid
        expect(all.visit >= all.checkout_started && all.checkout_started >= all.amount_chosen && all.amount_chosen >= all.payment_attempted && all.payment_attempted >= all.paid).toBe(true);
        const a = await one(people.viewer, "select revenue_addons($1) as r", [org]);
        const rate = a.fee_covered / a.gifts;
        expect(rate).toBeGreaterThan(0.65); expect(rate).toBeLessThan(0.77);
        const zf = a.addons.find((x: any) => x.key === "zakat_al_fitr");
        expect(zf.taken / zf.shown).toBeGreaterThan(0.3);
    });
});

describe("tags, access, import, export", () => {
    it("cleans tags, keeps renewals' tags, links matches", async () => {
        const [d] = await q(undefined, `insert into donations (org_id, amount_cents, currency, status, stripe_subscription_id, tags) values ($1, 1000, 'USD', 'succeeded', 'sub_x',
            '{"channel":"Email","night":"27","seconds":40,"evil":"x","utm_source":${JSON.stringify("x".repeat(500))},"addons":{"roundup":400,"bad":"9"},"addons_shown":["roundup"]}') returning tags`, [org]);
        expect(d.tags).toEqual({ channel: "Email", seconds: 40, utm_source: "x".repeat(200), addons: { roundup: 400 }, addons_shown: ["roundup"] });
        const [r] = await q(undefined, "insert into donations (org_id, amount_cents, currency, status, stripe_subscription_id) values ($1, 1000, 'USD', 'succeeded', 'sub_x') returning tags", [org]);
        expect(r.tags.channel).toBe("Email");
        await q(undefined, "insert into match_pledges (org_id, sponsor_name, cap_cents) values ($1, 'Test sponsor', 50000)", [org]);
        const [g] = await q(undefined, "insert into donations (org_id, amount_cents, currency, status, source) values ($1, 2000, 'USD', 'succeeded', 'card') returning id", [org]);
        const [m] = await q(undefined, "select amount_cents::int as c from donations where match_for = $1", [g.id]);
        expect(m.c).toBe(2000);
        const t = await one(people.viewer, "select revenue_export($1) as r", [org]).catch(() => null);
        expect(t).toBeNull(); // viewers get no rows, so no r
        const [e] = await q(people.editor, "select match_cents::int from revenue_export($1) where id = $2", [org, g.id]);
        expect(e.match_cents).toBe(2000);
        await q(undefined, "update match_pledges set active = false where sponsor_name = 'Test sponsor'");
    });

    it("viewers read dashboards, donors cannot; export is editor-only; funnel is public", async () => {
        expect(await fails(q(people.donor, "select revenue_campaign($1)", [org]))).toBe(true);
        expect(await fails(q(people.viewer, "select revenue_rows($1)", [org]))).toBe(true);
        expect(await fails(q(people.viewer, "select * from revenue_facts"))).toBe(true);
        expect(await q(people.viewer, "select * from revenue_export($1)", [org])).toHaveLength(0);
        const e = await q(people.editor, `select * from revenue_export($1, '{"night":27,"channel":"Email"}')`, [org]);
        expect(e.length).toBeGreaterThan(0);
        expect(e[0].donor_email).toMatch(/@example\.com$/);
        await q(null, "select funnel_track($1, 'sess-abcdef12', 'visit', '{\"channel\":\"Email\",\"device\":\"mobile\"}')", [org]);
        await q(null, "select funnel_track($1, 'sess-abcdef12', 'visit', '{}')", [org]);
        expect(await fails(q(null, "select funnel_track($1, 'x', 'visit')", [org]))).toBe(true);
        expect((await q(undefined, "select count(*)::int as n from funnel_events where session_id = 'sess-abcdef12'"))[0].n).toBe(1);
    });

    it("imports dry, then for real, skips duplicates, and undoes", async () => {
        const rows = [
            { external_id: "lg1", created_at: "2026-03-01T20:00:00Z", amount_cents: 5000, donor_email: "a@example.com", fund: "Zakat", campaign: "LG appeal" },
            { external_id: "lg1", created_at: "2026-03-01T20:00:00Z", amount_cents: 5000 },
            { external_id: "lg2", created_at: "bad", amount_cents: 100 },
            { external_id: "lg3", created_at: "2026-03-02", amount_cents: 2500, recurring: "yes" },
        ];
        const dry = await one(people.editor, "select revenue_import($1, 'launchgood', 'lg.csv', $2) as r", [org, JSON.stringify(rows)]);
        expect(dry).toMatchObject({ rows: 4, invalid: 1, duplicates: 1, new: 2, imported: 0, total_cents: 7500, batch_id: null });
        expect(await fails(q(people.viewer, "select revenue_import($1, 'launchgood', 'lg.csv', $2, false)", [org, JSON.stringify(rows)]))).toBe(true);
        const done = await one(people.editor, "select revenue_import($1, 'launchgood', 'lg.csv', $2, false) as r", [org, JSON.stringify(rows)]);
        expect(done.imported).toBe(2);
        const again = await one(people.editor, "select revenue_import($1, 'launchgood', 'lg.csv', $2, false) as r", [org, JSON.stringify(rows)]);
        expect(again.imported).toBe(0);
        const s = await one(people.viewer, "select revenue_sources($1) as r", [org]);
        expect(s.find((x: any) => x.key === "LaunchGood")).toMatchObject({ cents: 7500, gifts: 2 });
        await q(people.editor, "select revenue_import_undo($1)", [done.batch_id]);
        expect((await q(undefined, "select count(*)::int as n from donations where source = 'import'"))[0].n).toBe(0);
    });

    it("settings: admins write, ads ids public only when opted in; morning report claims once", async () => {
        expect(await fails(q(people.editor, `select revenue_settings_save($1, '{"report_to":["a@b.co"]}')`, [org]))).toBe(true);
        expect(await fails(q(people.admin, `select revenue_settings_save($1, '{"timezone":"Mars/Base"}')`, [org]))).toBe(true);
        const s = await one(people.admin, `select revenue_settings_save($1, '{"report_to":["Ops@Hope.org","nope"],"ga4_id":"G-ABC123","ads_opt_in":false}') as r`, [org]);
        expect(s.report_to).toEqual(["ops@hope.org"]);
        expect(await one(null, "select revenue_ads($1) as r", [org])).toBeNull();
        await q(people.admin, `select revenue_settings_save($1, '{"ads_opt_in":true}')`, [org]);
        expect(await one(null, "select revenue_ads($1) as r", [org])).toEqual({ ga4: "G-ABC123" });
        // The morning after Night 27 (2027-03-06 09:00 New York): nights are computed from now(), so check the night maths directly.
        expect(await one(undefined, "select revenue_night('2027-03-06 09:00-05' ::timestamptz - interval '12 hours', '2027-02-08', 'America/New_York') as r")).toBe(27);
        expect(await one(undefined, "select revenue_night('2027-03-05 21:00-05', '2027-02-08', 'America/New_York') as r")).toBe(27);
        expect(await one(undefined, "select revenue_night('2027-03-06 01:30-05', '2027-02-08', 'America/New_York') as r")).toBe(27);
        expect(await one(undefined, "select revenue_night('2027-02-06 21:00-05', '2027-02-08', 'America/New_York') as r")).toBeNull();
    });
});
