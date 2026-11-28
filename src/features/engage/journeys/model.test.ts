import { describe, expect, it } from "vitest";
import { compose, dueSends, enrollments, nextStep, render, segment, unknownVars, varsFor, type DonorVars, type Gift, type Settings, type Step } from "./model";
import { impactLines, impactSentence } from "../impact/model";

const S: Settings = { live: true, audience: "all", season_label: "Ramadan 1448", give_url: "", ramadan_start: "2027-02-08", eid_date: "2027-03-10", prev_ramadan_start: "2026-02-18", prev_eid_date: "2026-03-20" };
const g = (day: string, dollars: number, fund = "Sadaqah"): Gift => ({ day, cents: dollars * 100, fund });
const step = (day: number, kind: Step["kind"], o: Partial<Step> = {}): Step => ({ trigger: "eid", day, kind, title: kind, channels: ["email"], subject: "", body: "", sms: "", cta_label: "", cta_url: "", enabled: true, ...o });
const UNITS = [{ fund: "Zakat", unit_cents: 6000, label: "family food packs, a month each", label_one: "family food pack for a month" }, { fund: "Sadaqah", unit_cents: 400, label: "iftar meals", label_one: "iftar meal" }, { fund: "Zakat al-Fitr", unit_cents: 1500, label: "people fed on Eid morning" }];

describe("audience", () => {
    it("segments donors by this and last Ramadan", () => {
        expect(segment([g("2027-02-20", 10)], S)).toBe("first_time");
        expect(segment([g("2027-02-20", 10), g("2026-03-01", 5)], S)).toBe("returning");
        expect(segment([g("2026-03-01", 5)], S)).toBe("lapsed");
        expect(segment([g("2025-01-01", 5)], S)).toBe("other");
    });
    it("enrolls from Eid on, by audience; lapsed and anniversary are their own triggers", () => {
        const first = [g("2027-02-20", 10)], back = [g("2027-02-20", 10), g("2026-03-01", 5)];
        expect(enrollments(first, S, "2027-03-09")).toEqual([]);
        expect(enrollments(first, S, "2027-03-10")).toEqual([{ trigger: "eid", anchor: "2027-03-10" }]);
        expect(enrollments(back, { ...S, audience: "first_time" }, "2027-03-12")).toEqual([]);
        expect(enrollments([g("2026-03-01", 5)], S, "2027-03-12")).toEqual([{ trigger: "lapsed", anchor: "2027-03-10" }]);
        expect(enrollments([g("2026-03-14", 5), g("2027-02-20", 1)], S, "2027-03-16")).toContainEqual({ trigger: "anniversary", anchor: "2027-03-14" });
        expect(enrollments([g("2026-03-01", 5)], S, "2027-03-12").some((e) => e.trigger === "anniversary")).toBe(false); // 11 days late: not backfilled
        expect(enrollments(first, { ...S, live: false }, "2027-04-01")).toEqual([]);
        expect(enrollments(first, S, "2027-04-01", ["lapsed"])).toEqual([]);
    });
});

describe("steps", () => {
    const steps = [step(0, "thanks"), step(7, "receipt"), step(14, "impact"), step(30, "monthly_ask"), step(180, "field_update", { enabled: false })];
    it("sends the latest due step and skips the overtaken ones", () => {
        expect(dueSends(steps, { trigger: "eid", anchor: "2027-03-10" }, "2027-03-10").map((x) => x.status)).toEqual(["pending"]);
        expect(dueSends(steps, { trigger: "eid", anchor: "2027-03-10" }, "2027-03-25").map((x) => `${x.step.day}:${x.status}`)).toEqual(["0:skipped", "7:skipped", "14:pending"]);
    });
    it("never asks a monthly donor to go monthly", () => {
        expect(dueSends(steps, { trigger: "eid", anchor: "2027-03-10", monthly_at_start: true }, "2027-04-10").map((x) => `${x.step.day}:${x.status}`)).toEqual(["0:skipped", "7:skipped", "14:pending", "30:skipped"]);
        expect(nextStep(steps, { trigger: "eid", anchor: "2027-03-10", monthly_at_start: true }, "2027-03-25")).toBeNull();
        expect(nextStep(steps, { trigger: "eid", anchor: "2027-03-10" }, "2027-03-25")).toMatchObject({ on: "2027-04-09", step: { kind: "monthly_ask" } });
    });
});

describe("impact", () => {
    it("turns money into things with the charity's costs", () => {
        const l = impactLines({ Zakat: 120000, Sadaqah: 34000, "Zakat al-Fitr": 6000, General: 500 }, UNITS);
        expect(l.map((x) => [x.fund, x.count])).toEqual([["Zakat", 20], ["Sadaqah", 85], ["Zakat al-Fitr", 4], ["General", 0]]);
        expect(impactSentence(l)).toBe("20 family food packs, a month each, 85 iftar meals and 4 people fed on Eid morning");
        expect(impactLines({ Sadaqah: 400 }, UNITS)[0].label).toBe("iftar meal");
        expect(impactLines({ zakat: 5999 }, UNITS)[0].count).toBe(0);
    });
});

describe("messages", () => {
    const v: DonorVars = { full_name: "Aisha Khan", currency: "USD", season: "Ramadan 1448", year: 2027, season_cents: 160000, season_zakat_cents: 126000, ytd_cents: 160000, ytd_zakat_cents: 126000, last_cents: 0, funds: { Zakat: 120000, Sadaqah: 34000 }, units: UNITS, report_token: "ab".repeat(32) };
    const vars = varsFor(v, "Hope Foundation", { site: "https://x.org" });
    it("fills templates and flags unknown placeholders", () => {
        expect(render("Eid Mubarak, {name}. {total}, zakat {zakat}. {oops}", vars)).toBe("Eid Mubarak, Aisha. $1,600, zakat $1,260. {oops}");
        expect(unknownVars("{name} {oops} {impact}")).toEqual(["oops"]);
        expect(vars.report_url).toBe(`https://x.org/impact/${"ab".repeat(32)}`);
        expect(vars.monthly_url).toBe("https://x.org/ramadhan/give?monthly=1");
    });
    it("an email names the charity, shows its address and a working opt-out; a text ends with STOP", () => {
        const st = step(30, "monthly_ask", { subject: "{name}, keep going", body: "Hi <b>", sms: "{org}: {link}", cta_label: "Give $15 a month", cta_url: "{monthly_url}" });
        const m = compose(st, vars, { org: "Hope Foundation", address: "1 Main St, Edison, NJ 08817", track: "https://fn/journey-run?c=t", unsubscribe: "https://x.org/unsubscribe/t" });
        expect(m.subject).toBe("Aisha, keep going");
        expect(m.target).toBe("https://x.org/ramadhan/give?monthly=1");
        expect(m.text).toContain("Give $15 a month: https://fn/journey-run?c=t");
        expect(m.text).toContain("1 Main St, Edison, NJ 08817");
        expect(m.html).toContain("https://x.org/unsubscribe/t");
        expect(m.html).toContain("Hi &lt;b&gt;");
        expect(m.html).not.toMatch(/outgive/i);
        expect(m.sms).toBe("Hope Foundation: https://fn/journey-run?c=t Reply STOP to opt out.");
    });
});
