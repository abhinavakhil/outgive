// The donor journey and impact reports (migrations 20261128400000 and the 20261128400100 sample), on a real Postgres.
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, fresh, MIGRATIONS, signUp } from "./pg";
import { dueSends, enrollments, impactLines, impactSentence, type Gift, type Settings, type Step } from "../supabase/functions/journey-run/model";

const SAMPLE = ["Aisha Khan", "Yusuf Rahman", "Maryam Ali", "Bilal Ahmed", "Hana Yusuf", "Sara Qureshi", "Omar Siddiqui"];
const SAMPLE_EMAILS = SAMPLE.map((n) => n.toLowerCase().replace(" ", ".") + "@example.com");
let db: PGlite; let org: string; const people: Record<string, string> = {};
const q = async <T = any>(uid: string | null | undefined, sql: string, args: unknown[] = []) => (uid === undefined ? db.query<T>(sql, args) : as(db, uid, () => db.query<T>(sql, args))).then((r) => r.rows);
const fails = (p: Promise<unknown>) => p.then(() => false, () => true);
const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

beforeAll(async () => {
    db = await fresh();
    // The shared US sample org comes from 20261128000050; make it here if that migration is not in this tree yet, then seed again.
    if (!(await q(undefined, "select 1 from orgs where slug = 'hope-foundation'")).length) {
        await q(undefined, "insert into orgs (slug, name, currency, country) values ('hope-foundation', 'Hope Foundation', 'USD', 'US')");
        await db.exec(fs.readFileSync(path.join(MIGRATIONS, "20261128400100_journeys_sample.sql"), "utf8"));
    }
    org = (await q(undefined, "select id from orgs where slug = 'hope-foundation'"))[0].id;
    for (const role of ["editor", "viewer"]) { people[role] = await signUp(db, `${role}@x.test`); await q(undefined, "insert into org_members (org_id, user_id, role) values ($1, $2, $3)", [org, people[role], role]); }
    people.outsider = await signUp(db, "outsider@x.test");
}, 60000);

describe("journeys", () => {
    it("seeds the default steps, units and a draft journey for every org", async () => {
        const [{ j }] = await q(people.viewer, "select journey_get($1) as j", [org]);
        expect(j.settings).toMatchObject({ live: false, audience: "all", season_label: "Ramadan 1448" });
        expect(j.steps.map((s: Step) => `${s.trigger}:${s.day}:${s.kind}:${s.enabled}`)).toEqual([
            "eid:0:thanks:true", "eid:7:receipt:true", "eid:14:impact:true", "eid:30:monthly_ask:true", "eid:60:qurbani:true", "eid:180:field_update:false", "eid:320:warmup:true",
            "lapsed:3:lapsed:true", "anniversary:0:anniversary:true"]);
        expect(j.steps.find((s: Step) => s.kind === "monthly_ask").channels).toEqual(["email", "sms"]);
        // Other samples (revenue) share this org, so compare with the TS rules over every donor rather than fixed numbers.
        expect(j.audience.all).toBe(j.audience.first_time + j.audience.returning);
        expect(j.audience.first_time).toBeGreaterThanOrEqual(3);
        expect(j.audience.lapsed).toBeGreaterThanOrEqual(1);
        const units = await q(people.viewer, "select fund, unit_cents from impact_units_list($1)", [org]);
        expect(units.map((u) => `${u.fund}:${u.unit_cents}`)).toEqual(["Zakat:6000", "Sadaqah:400", "Zakat al-Fitr:1500", "Fidya:1500", "Building fund:12000"]);
        const [o2] = await q(undefined, "insert into orgs (slug, name) values ('new-charity', 'New') returning id");
        expect((await q(undefined, "select count(*)::int as n from journey_steps where org_id = $1", [o2.id]))[0].n).toBe(9);
    });

    it("only the team reads; contact details are editor-only; only editors write", async () => {
        expect(await fails(q(people.outsider, "select journey_get($1)", [org]))).toBe(true);
        expect(await q(people.outsider, "select * from journey_donors_list($1)", [org])).toHaveLength(0);
        const v = await q(people.viewer, "select * from journey_donors_list($1)", [org]);
        const mine = (await q(people.editor, "select * from journey_donors_list($1)", [org])).filter((d) => SAMPLE_EMAILS.includes(d.email));
        expect(mine).toHaveLength(7);
        expect(mine.map((d) => `${d.donor_name}:${d.segment}`).sort()).toEqual(["Aisha Khan:first_time", "Bilal Ahmed:returning", "Hana Yusuf:first_time", "Maryam Ali:first_time", "Omar Siddiqui:lapsed", "Sara Qureshi:returning", "Yusuf Rahman:returning"]);
        expect(v.every((d) => d.email === null && d.phone === null)).toBe(true);
        expect(mine.find((d) => d.donor_name === "Aisha Khan")).toMatchObject({ segment: "first_time", season_cents: 160000 });
        const e = await q(people.editor, "select email, phone from journey_donors_list($1) where email = 'aisha.khan@example.com'", [org]);
        expect(e[0]).toEqual({ email: "aisha.khan@example.com", phone: "+12125550102" });
        expect(await fails(q(people.viewer, "select journey_settings_save($1, '{\"audience\":\"first_time\"}')", [org]))).toBe(true);
        expect(await fails(q(people.viewer, "select impact_units_save($1, '[]')", [org]))).toBe(true);
        expect(await fails(q(people.editor, "select journey_enroll($1)", [org]))).toBe(true); // service role only
        expect(await q(people.viewer, "select * from journey_enrollments")).toHaveLength(0);
    });

    it("goes live only with a postal address (CAN-SPAM)", async () => {
        await q(undefined, "update orgs set address = '' where id = $1", [org]); // another sample may have set one
        expect(await fails(q(people.editor, "select journey_settings_save($1, '{\"live\":true}')", [org]))).toBe(true);
        await q(undefined, "update orgs set address = '100 Main St, Edison, NJ 08817' where id = $1", [org]);
        const [s] = await q(people.editor, "select * from journey_settings_save($1, '{\"live\":true}')", [org]);
        expect(s.live).toBe(true);
        expect(await fails(q(people.editor, "select org_contact_email_save($1, 'hello@hope.example')", [org]))).toBe(true); // admin only
        await q(undefined, "update orgs set contact_email = 'hello@hope.example' where id = $1", [org]);
    });

    it("enrolls and schedules the way model.ts says", async () => {
        const [st] = await q<Settings>(undefined, "select * from journey_settings where org_id = $1", [org]);
        const settings = { ...st, ramadan_start: iso(st.ramadan_start), eid_date: iso(st.eid_date), prev_ramadan_start: iso(st.prev_ramadan_start), prev_eid_date: iso(st.prev_eid_date) };
        const gifts = await q(undefined, "select lower(donor_email) as email, (created_at at time zone 'America/New_York')::date as day, amount_cents as cents, fund from donations where org_id = $1 and status = 'succeeded'", [org]);
        const by: Record<string, Gift[]> = {};
        for (const x of gifts) (by[x.email] ??= []).push({ day: iso(x.day), cents: Number(x.cents), fund: x.fund });
        const want = (today: string) => Object.entries(by).flatMap(([email, g]) => enrollments(g, settings, today).map((e) => `${email}:${e.trigger}:${e.anchor}`)).sort();
        await q(undefined, "select journey_enroll($1, '2027-03-16')", [org]);
        const got = await q(undefined, "select email, trigger, anchor from journey_enrollments where org_id = $1", [org]);
        expect(got.map((e) => `${e.email}:${e.trigger}:${iso(e.anchor)}`).sort()).toEqual(want("2027-03-16"));
        // The journeys sample: 6 eid, 1 lapsed, 4 first-gift anniversaries (gifts on 12-16 March 2026).
        expect(got.filter((e) => SAMPLE_EMAILS.includes(e.email))).toHaveLength(11);
        expect((await q(undefined, "select journey_enroll($1, '2027-03-16') as n", [org]))[0].n).toBe(0); // idempotent

        await q(undefined, "select journey_schedule($1, '2027-03-25')", [org]);
        const steps = (await q(people.viewer, "select journey_get($1) as j", [org]))[0].j.steps as Step[];
        const sends = await q(undefined, "select e.email, e.trigger, e.anchor, e.phone, s.kind, s.channel, s.status from journey_sends s join journey_enrollments e on e.id = s.enrollment_id where s.org_id = $1", [org]);
        const ens = await q(undefined, "select * from journey_enrollments where org_id = $1", [org]);
        const expected = ens.flatMap((e) => dueSends(steps, { trigger: e.trigger, anchor: iso(e.anchor), monthly_at_start: e.monthly_at_start }, "2027-03-25")
            .flatMap((x) => x.step.channels.filter((c) => c === "email" || e.phone).map((c) => `${e.email}:${e.trigger}:${x.step.kind}:${c}:${x.status}`)));
        expect(sends.map((s) => `${s.email}:${s.trigger}:${s.kind}:${s.channel}:${s.status}`).sort()).toEqual(expected.sort());
        expect(sends.filter((s) => s.trigger === "eid" && s.status === "pending").every((s) => s.kind === "impact")).toBe(true);
    });

    it("claims once, with the donor's numbers; clicks and gifts are credited to the step; monthly exits", async () => {
        await q(undefined, "update journey_sends set scheduled_at = now() - interval '1 hour' where org_id = $1", [org]);
        const claimed: any[] = [];
        for (let batch; (batch = await q(undefined, "select * from journey_sends_claim($1, 1000)", [org])).length; ) claimed.push(...batch);
        expect(claimed.length).toBeGreaterThan(0);
        expect(await q(undefined, "select * from journey_sends_claim($1)", [org])).toHaveLength(0);
        const aisha = claimed.find((c) => c.email === "aisha.khan@example.com" && c.kind === "impact");
        expect(aisha.vars).toMatchObject({ full_name: "Aisha Khan", season_cents: 160000, season_zakat_cents: 126000 });
        expect(impactSentence(impactLines(aisha.vars.funds, aisha.vars.units))).toBe("20 family food packs, a month each, 85 iftar meals and 4 people fed on Eid morning");
        expect(aisha.vars.report_token).toMatch(/^[0-9a-f]{64}$/);
        expect(aisha.org_address).toBe("100 Main St, Edison, NJ 08817");
        expect(aisha.org_contact_email).toBe("hello@hope.example");

        await q(undefined, "update journey_sends set status = 'sent', sent_at = now() - interval '10 minutes', target_url = 'https://x.org/impact/abc' where id = $1", [aisha.id]);
        expect((await q(undefined, "select journey_click($1) as u", [aisha.token]))[0].u).toBe("https://x.org/impact/abc");
        expect((await q(undefined, "select journey_click('nope') as u"))[0].u).toBeNull();
        await q(undefined, "insert into donations (org_id, donor_name, donor_email, amount_cents, currency, usd_cents, fund, status) values ($1, 'Aisha Khan', 'Aisha.Khan@example.com', 5000, 'USD', 5000, 'Sadaqah', 'succeeded')", [org]);
        const [{ j }] = await q(people.viewer, "select journey_get($1) as j", [org]);
        expect(j.steps.find((s: Step) => s.kind === "impact")).toMatchObject({ clicked: 1, gave_again: 1, converted_cents: 5000 });
        await q(undefined, "insert into donations (org_id, donor_name, donor_email, amount_cents, currency, usd_cents, fund, status, recurring) values ($1, 'Aisha Khan', 'aisha.khan@example.com', 1500, 'USD', 1500, 'Sadaqah', 'succeeded', true)", [org]);
        const en = await q(undefined, "select status, exit_reason from journey_enrollments where org_id = $1 and email = 'aisha.khan@example.com'", [org]);
        expect(en.every((e) => e.status === "exited" && e.exit_reason === "monthly")).toBe(true);
        expect((await q(people.viewer, "select journey_get($1) as j", [org]))[0].j.steps.find((s: Step) => s.kind === "impact").monthly).toBe(1);
    });

    it("unsubscribing is public by token, per charity, and stops later sends", async () => {
        const [s] = await q(undefined, "select s.token, s.enrollment_id from journey_sends s join journey_enrollments e on e.id = s.enrollment_id where e.email = 'sara.qureshi@example.com' and s.channel = 'email' limit 1");
        expect((await q(null, "select journey_unsubscribe_info($1) as i", [s.token]))[0].i).toEqual({ org_name: "Hope Foundation", channel: "email", unsubscribed: false });
        expect((await q(null, "select journey_unsubscribe($1) as i", [s.token]))[0].i.unsubscribed).toBe(true);
        expect((await q(null, "select journey_unsubscribe('nope') as i"))[0].i).toBeNull();
        await q(undefined, "update journey_enrollments set status = 'active', exit_reason = null where email = 'sara.qureshi@example.com'"); // even if staff put her back
        const [x] = await q(undefined, "insert into journey_sends (org_id, enrollment_id, kind, channel, scheduled_at, status) values ($1, $2, 'custom', 'email', now(), 'pending') returning id", [org, s.enrollment_id]);
        expect((await q(undefined, "select * from journey_sends_claim($1)", [org])).map((c) => c.id)).not.toContain(x.id);
        expect((await q(undefined, "select status, error from journey_sends where id = $1", [x.id]))[0]).toEqual({ status: "skipped", error: "opted out" });
        const [d] = await q(people.editor, "select * from journey_donors_list($1) where email = 'sara.qureshi@example.com'", [org]);
        expect(d.suppressed).toBe(true);
    });

    it("the public report shows the first name and the season's gifts, never contact details", async () => {
        const [d] = await q(people.editor, "select key from journey_donors_list($1) where email = 'yusuf.rahman@example.com'", [org]);
        const [{ t }] = await q(people.viewer, "select impact_report_link($1, $2) as t", [org, d.key]);
        expect(t).toMatch(/^[0-9a-f]{64}$/);
        expect((await q(people.viewer, "select impact_report_link($1, $2) as t", [org, d.key]))[0].t).toBe(t); // same link every time
        const [{ r }] = await q(null, "select impact_report_by_token($1) as r", [t]);
        expect(r).toMatchObject({ org_name: "Hope Foundation", first_name: "Yusuf", season: "Ramadan 1448", gifts: 3, monthly: false });
        expect(r.funds).toEqual({ Zakat: 300000, "Building fund": 500000, Sadaqah: 50000 }); // not last Ramadan's 2,500
        expect(JSON.stringify(r)).not.toMatch(/@|555/);
        expect((await q(null, "select impact_report_by_token('0000') as r"))[0].r).toBeNull();
        expect((await q(undefined, "select views from impact_reports where token = $1", [t]))[0].views).toBe(1);
        expect(await fails(q(people.outsider, "select impact_report_link($1, $2)", [org, d.key]))).toBe(true);
        const [{ p }] = await q(people.viewer, "select journey_preview($1, $2, '2027-03-25') as p", [org, d.key]);
        expect(p).toMatchObject({ full_name: "Yusuf Rahman", season_cents: 850000, ytd_cents: 850000, last_cents: 250000, report_token: t, org: "Hope Foundation" });
        expect(JSON.stringify(p)).not.toMatch(/@/);
    });

    it("editors replace steps and units", async () => {
        const [{ j }] = await q(people.editor, "select journey_get($1) as j", [org]);
        const next = j.steps.filter((s: Step) => s.kind !== "qurbani").map((s: Step) => ({ ...s, enabled: s.kind === "field_update" ? true : s.enabled }));
        await q(people.editor, "select journey_steps_save($1, $2)", [org, JSON.stringify([...next, { trigger: "eid", day: 90, kind: "custom", title: "Check-in", channels: ["email"], subject: "Hi {name}", body: "..." }])]);
        const after = (await q(people.viewer, "select journey_get($1) as j", [org]))[0].j.steps as Step[];
        expect(after.map((s) => `${s.day}:${s.kind}:${s.enabled}`).slice(0, 7)).toEqual(["0:thanks:true", "7:receipt:true", "14:impact:true", "30:monthly_ask:true", "90:custom:true", "180:field_update:true", "320:warmup:true"]);
        expect(await fails(q(people.editor, "select journey_steps_save($1, $2)", [org, JSON.stringify([{ day: 1, kind: "custom", title: "x", channels: ["fax"] }])]))).toBe(true);
        await q(people.editor, "select impact_units_save($1, $2)", [org, JSON.stringify([{ fund: "Sadaqah", unit_cents: 500, label: "iftar meals" }])]);
        expect((await q(people.viewer, "select fund, unit_cents from impact_units_list($1)", [org]))).toEqual([{ fund: "Sadaqah", unit_cents: 500 }]);
    });
});
