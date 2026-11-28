/**
 * The data behind the After-Eid journey and Impact reports screens. Live: the SQL API (./api, ../impact/api). Demo (ws.sample): the
 * prototype's Hope Foundation, kept in memory, so every control works and nothing is sent. The Overview's after-Eid week and
 * "Steps to approve" read useJourneyStore too, so they agree with the journey screen.
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import { useWorkspace } from "../shell/workspace";
import * as api from "./api";
import * as impactApi from "../impact/api";
import type { Unit } from "../impact/model";
import { type DonorVars, type Journey, type JourneyDonor, type Preview, type Settings, type Step, addDays } from "./model";

/** The demo's "today": the Monday after Eid, as on the Overview. */
export const SAMPLE_TODAY = "2027-03-15";

// ---------------------------------------------------------------- defaults (the same words journey_seed() puts in the database)
const S = (trigger: Step["trigger"], day: number, kind: Step["kind"], title: string, channels: Step["channels"], subject: string, body: string, sms = "", cta_label = "", cta_url = "", enabled = true): Step & { id: string } =>
    ({ id: `${trigger}-${day}-${kind}`, trigger, day, kind, title, channels, subject, body, sms, cta_label, cta_url, enabled });
export const DEFAULT_STEPS = [
    S("eid", 0, "thanks", "Eid Mubarak, and thank you", ["email"], "Eid Mubarak, {name}. Thank you for this Ramadan", "Your gifts to {org} this Ramadan reached families in need and fed our community every night of iftar. We will write again soon with exactly what your giving did."),
    S("eid", 7, "receipt", "Receipt and year-to-date total", ["email"], "Your Ramadan giving summary", "Here is your giving to {org} so far in {year}.\n\nTotal given: {ytd_total}\nZakat: {ytd_zakat}\n\nYour tax receipt for each gift was emailed when you gave. Keep this summary with them for your records."),
    S("eid", 14, "impact", "Personal impact report", ["email"], "{name}, here is what your gifts did", "We have counted it up: {impact}, because of you. Your personal report is one tap away.", "", "See my report", "{report_url}"),
    S("eid", 30, "monthly_ask", "Monthly giving ask", ["email", "sms"], "Keep Ramadan going all year", "Many of our supporters give a little each month so families are not only fed in Ramadan. $15 a month provides a family food pack every quarter.", "{org}: $15 a month provides a family food pack every quarter. Start here: {link}", "Give $15 a month", "{monthly_url}"),
    S("eid", 60, "qurbani", "Qurbani for Eid al-Adha", ["email"], "Qurbani 1448: give a share", "Eid al-Adha is close. A Qurbani share through {org} is distributed fresh to families who rarely eat meat.", "", "Give a Qurbani share", "{give_url}"),
    S("eid", 180, "field_update", "Six-month field update", ["email"], "Six months on: a letter from the field", "A short update from our team on the projects your Ramadan gifts funded, with photos from the distribution.", "", "See my report", "{report_url}", false),
    S("eid", 320, "warmup", "Ramadan warm-up", ["email"], "Ramadan is six weeks away", "Set up your last-ten-nights giving now and never miss an odd night. It takes one minute.", "", "Schedule my ten nights", "{give_url}"),
    S("lapsed", 3, "lapsed", "We missed you this Ramadan", ["email"], "We missed you this Ramadan, {name}", "Last Ramadan you gave {last_total} to {org}, and it did real good. This year we did not hear from you, and that is alright. If you would still like to give before the year is out, it takes a minute.", "", "Give now", "{give_url}"),
    S("anniversary", 0, "anniversary", "Anniversary of first gift", ["email"], "A year ago today, {name}", "It is a year since your first gift to {org}. Thank you for being part of this. Here is everything your giving has done this year.", "", "See my report", "{report_url}"),
];
export const DEFAULT_UNITS: Unit[] = [
    { fund: "Zakat", unit_cents: 6000, label: "family food packs, a month each", label_one: "family food pack for a month", note: "Zakat gifts go only to zakat-eligible recipients, as set out in our zakat policy." },
    { fund: "Sadaqah", unit_cents: 400, label: "iftar meals", label_one: "iftar meal", note: "" },
    { fund: "Zakat al-Fitr", unit_cents: 1500, label: "people fed on Eid morning", label_one: "person fed on Eid morning", note: "" },
    { fund: "Fidya", unit_cents: 1500, label: "days of meals for a person in need", label_one: "day of meals for a person in need", note: "" },
    { fund: "Building fund", unit_cents: 12000, label: "sq ft of the new masjid", label_one: "sq ft of the new masjid", note: "" },
];
const SETTINGS: Settings = { live: false, audience: "all", season_label: "Ramadan 1448", give_url: "", ramadan_start: "2027-02-08", eid_date: "2027-03-10", prev_ramadan_start: "2026-02-18", prev_eid_date: "2026-03-20" };

// ---------------------------------------------------------------- the sample donors (the prototype's six, plus one lapsed)
type SampleDonor = { name: string; city: string; segment: JourneyDonor["segment"]; season: Record<string, number>; last: number; phone?: string };
const SD: SampleDonor[] = [
    { name: "Aisha Khan", city: "Edison, NJ", segment: "first_time", season: { Zakat: 1200, Sadaqah: 340, "Zakat al-Fitr": 60 }, last: 0, phone: "+12125550102" },
    { name: "Yusuf Rahman", city: "Plainfield, NJ", segment: "returning", season: { Zakat: 3000, "Building fund": 5000, Sadaqah: 500 }, last: 2500, phone: "+12125550101" },
    { name: "Maryam Ali", city: "Queens, NY", segment: "first_time", season: { Sadaqah: 280, "Zakat al-Fitr": 75, Fidya: 150 }, last: 0 },
    { name: "Bilal Ahmed", city: "Jersey City, NJ", segment: "returning", season: { "Building fund": 3000, Zakat: 950 }, last: 400, phone: "+12125550105" },
    { name: "Hana Yusuf", city: "Paterson, NJ", segment: "first_time", season: { Sadaqah: 120, "Zakat al-Fitr": 45 }, last: 0 },
    { name: "Sara Qureshi", city: "Princeton, NJ", segment: "returning", season: { Zakat: 2400, Sadaqah: 1000, "Zakat al-Fitr": 90 }, last: 2000 },
    { name: "Omar Siddiqui", city: "Newark, NJ", segment: "lapsed", season: {}, last: 250 },
];
export const CITY: Record<string, string> = Object.fromEntries(SD.map((d) => [d.name, d.city]));
const sum = (o: Record<string, number>) => Object.values(o).reduce((n, v) => n + v, 0);
const keyOf = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "");
const sampleDonors = (): JourneyDonor[] => SD.map((d) => ({
    key: keyOf(d.name), donor_name: d.name, email: `${d.name.toLowerCase().replace(" ", ".")}@example.com`, phone: d.phone ?? null, segment: d.segment,
    season_cents: sum(d.season) * 100, total_cents: (sum(d.season) + d.last) * 100, first_gift: d.last ? "2026-03-14" : "2027-02-20", monthly: false, suppressed: false, sends: 0, conversions: 0, enrollments: [],
}));
const sampleVars = (d: SampleDonor, units: Unit[], s: Settings): DonorVars => {
    const zakat = Object.entries(d.season).filter(([f]) => f.toLowerCase().startsWith("zakat")).reduce((n, [, v]) => n + v, 0) * 100;
    return { full_name: d.name, currency: "USD", season: s.season_label, year: 2027, season_cents: sum(d.season) * 100, season_zakat_cents: zakat, ytd_cents: sum(d.season) * 100, ytd_zakat_cents: zakat,
        last_cents: d.last * 100, funds: Object.fromEntries(Object.entries(d.season).map(([f, v]) => [f, v * 100])), units, report_token: keyOf(d.name).padEnd(64, "0").slice(0, 64) };
};
/** The prototype's audience sizes for the whole sample charity (3,872 donors), not just the seven above. */
const SAMPLE_AUDIENCE = { all: 3872, first_time: 1201, returning: 2671, lapsed: 418 };

// ---------------------------------------------------------------- the store
export type JStore = {
    state: "loading" | "ready" | "error"; error?: string; today: string; sample: boolean;
    journey: Journey; donors: JourneyDonor[]; units: Unit[];
    saveSettings: (p: Partial<Settings>) => Promise<void>;
    saveSteps: (steps: Step[]) => Promise<void>;
    saveUnits: (units: Unit[]) => Promise<void>;
    preview: (key: string) => Promise<Preview>;
    reportLink: (key: string) => Promise<string>;
    sendTest: (stepId: string, key?: string) => Promise<{ ok: boolean; provider: string; error?: string }>;
    run: () => Promise<{ enrolled: number; scheduled: number; sent: number; failed: number; skipped: number }>;
};
const EMPTY: Journey = { settings: { ...SETTINGS, updated_at: "" }, address: "", steps: [], audience: { all: 0, first_time: 0, returning: 0, lapsed: 0 }, enrolled: 0, exited_monthly: 0, unsubscribed: 0 };

export const useJourneyStore = (): JStore => {
    const { db } = useApp();
    const ws = useWorkspace(), org = ws.org.id, sample = ws.sample;
    const [state, setState] = useState<JStore["state"]>("loading"), [error, setError] = useState<string>();
    const [journey, setJourney] = useState<Journey>(EMPTY), [donors, setDonors] = useState<JourneyDonor[]>([]), [units, setUnits] = useState<Unit[]>([]);

    const load = useCallback(async () => {
        if (sample) {
            setJourney({ settings: { ...SETTINGS, updated_at: "" }, address: "100 Main St, Edison, NJ 08817 (sample)", steps: DEFAULT_STEPS, audience: SAMPLE_AUDIENCE, enrolled: 0, exited_monthly: 0, unsubscribed: 0 });
            setDonors(sampleDonors()); setUnits(DEFAULT_UNITS); setState("ready"); return;
        }
        try {
            const [j, d, u] = await Promise.all([api.getJourney(db, org), api.listDonors(db, org), impactApi.listUnits(db, org)]);
            setJourney(j); setDonors(d); setUnits(u); setState("ready");
        } catch (e) { setError((e as Error).message); setState("error"); }
    }, [db, org, sample]);
    useEffect(() => { void load(); }, [load]);

    const settings = journey.settings;
    return {
        state, error, today: sample ? SAMPLE_TODAY : new Date().toISOString().slice(0, 10), sample, journey, donors, units,
        saveSettings: async (p) => {
            if (sample) { setJourney((j) => ({ ...j, settings: { ...j.settings, ...p } })); return; }
            await api.saveSettings(db, org, p); await load();
        },
        saveSteps: async (steps) => {
            if (sample) { setJourney((j) => ({ ...j, steps: steps.map((s, i) => ({ ...s, id: s.id ?? `new-${i}-${Date.now()}` })) })); return; }
            await api.saveSteps(db, org, steps); await load();
        },
        saveUnits: async (u) => {
            if (sample) { setUnits(u); return; }
            setUnits(await impactApi.saveUnits(db, org, u));
        },
        preview: async (key) => {
            if (sample) { const d = SD.find((x) => keyOf(x.name) === key) ?? SD[0]; return { ...sampleVars(d, units, settings), report_token: keyOf(d.name).padEnd(64, "0").slice(0, 64), org: ws.org.name, address: journey.address }; }
            return api.preview(db, org, key);
        },
        reportLink: async (key) => (sample ? keyOf(SD.find((x) => keyOf(x.name) === key)?.name ?? "sample").padEnd(64, "0").slice(0, 64) : impactApi.reportLink(db, org, key)),
        sendTest: async (stepId, key) => (sample ? { ok: true, provider: "sample" } : api.sendTest(db, org, stepId, key)),
        run: async () => {
            if (sample) return { enrolled: 0, scheduled: 0, sent: 0, failed: 0, skipped: 0 };
            const r = await api.runJourney(db, org); await load(); return r;
        },
    };
};

/** When each enabled Eid step goes out, for the Overview's week and the journey's timeline. */
export const scheduleOf = (j: Journey) => j.steps.filter((s) => s.enabled && s.trigger === "eid").map((s) => ({ step: s, on: addDays(j.settings.eid_date, s.day) }));

/** Just the journey (no donors), for the Overview's week and to-do. One fetch per org per page load; null while loading or on error. */
const glance = new Map<string, Promise<Journey | null>>();
export const useJourneyGlance = (): Journey | null => {
    const { db } = useApp();
    const ws = useWorkspace();
    const [j, setJ] = useState<Journey | null>(null);
    useEffect(() => {
        if (ws.sample) { setJ({ settings: { ...SETTINGS, updated_at: "" }, address: "", steps: DEFAULT_STEPS, audience: SAMPLE_AUDIENCE, enrolled: 0, exited_monthly: 0, unsubscribed: 0 }); return; }
        let off = false;
        if (!glance.has(ws.org.id)) glance.set(ws.org.id, api.getJourney(db, ws.org.id).catch(() => null));
        glance.get(ws.org.id)!.then((x) => !off && setJ(x));
        return () => { off = true; };
    }, [db, ws.org.id, ws.sample]);
    return j;
};
