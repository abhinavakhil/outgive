import { describe, expect, it } from "vitest";
import { byEvent, kpis, nextStep, payUrl, pledgeStatus, splitFirst, type Step } from "./model";

// The sample pledges (supabase/migrations/20261128000100_pledges_sample.sql), in dollars.
const SAMPLE: [string, string, number, number, string | null][] = [
    ["Yusuf Rahman", "Night 27 dinner", 5000, 5000, "2027-03-15"], ["Aisha Khan", "Night 27 dinner", 2500, 1000, "2027-03-20"],
    ["Omar Siddiqui", "Night 21", 10000, 0, "2027-03-12"], ["Fatima Malik", "Night 25", 1200, 0, "2027-03-25"],
    ["Bilal Ahmed", "Night 27 dinner", 3000, 3000, null], ["Hana Yusuf", "Night 23", 750, 0, "2027-03-10"],
    ["Ibrahim Patel", "Building fund dinner", 15000, 6000, "2027-04-30"], ["Maryam Ali", "Night 29", 500, 0, "2027-03-18"],
    ["Zaid Hassan", "Night 27 dinner", 2000, 0, "2027-03-08"], ["Sara Qureshi", "Night 25", 1000, 1000, null],
    ["Khalid Mansour", "Building fund dinner", 7500, 0, "2027-04-30"], ["Noor Abbas", "Night 21", 300, 0, "2027-03-05"],
];
const pledges = SAMPLE.map(([donor_name, event, a, p, due_date]) => ({ donor_name, event, amount_cents: a * 100, paid_cents: p * 100, due_date, written_off: false }));
const TODAY = "2027-03-16";

const STEPS: Step[] = [
    { day: 0, action: "thank_you", channels: ["sms"], enabled: true }, { day: 2, action: "pay_link", channels: ["email"], enabled: true },
    { day: 7, action: "reminder", channels: ["email", "sms"], enabled: true }, { day: 14, action: "split_offer", channels: ["email"], enabled: true },
    { day: 21, action: "call_list", channels: ["task"], enabled: true }, { day: 45, action: "write_off_review", channels: ["task"], enabled: false },
];

describe("pledge status", () => {
    it("matches the prototype on the sample", () => {
        const s = Object.fromEntries(pledges.map((p) => [p.donor_name, pledgeStatus(p, TODAY)]));
        expect(s).toMatchObject({ "Yusuf Rahman": "paid", "Aisha Khan": "part_paid", "Omar Siddiqui": "overdue", "Fatima Malik": "open", "Hana Yusuf": "overdue", "Ibrahim Patel": "part_paid", "Noor Abbas": "overdue", "Sara Qureshi": "paid" });
    });
    it("written off beats everything; part paid and past due is overdue; due today is not overdue", () => {
        const p = { amount_cents: 1000, paid_cents: 400, due_date: "2027-03-10", written_off: false };
        expect(pledgeStatus({ ...p, written_off: true }, TODAY)).toBe("written_off");
        expect(pledgeStatus(p, TODAY)).toBe("overdue");
        expect(pledgeStatus({ ...p, due_date: TODAY }, TODAY)).toBe("part_paid");
        expect(pledgeStatus({ ...p, paid_cents: 1200 }, TODAY)).toBe("paid");
    });
});

describe("KPIs and the pledged-against-paid report", () => {
    it("adds up the sample", () => {
        expect(kpis(pledges, TODAY)).toEqual({ count: 12, pledged_cents: 4875000, collected_cents: 1600000, collected_pct: 33, outstanding_cents: 3275000, outstanding_count: 9, overdue_count: 4, written_off_cents: 0, written_off_count: 0 });
    });
    it("a write-off moves the balance out of outstanding", () => {
        const t = kpis(pledges.map((p) => (p.donor_name === "Omar Siddiqui" ? { ...p, written_off: true } : p)), TODAY);
        expect([t.outstanding_cents, t.outstanding_count, t.written_off_cents, t.written_off_count]).toEqual([2275000, 8, 1000000, 1]);
    });
    it("groups by event, biggest first", () => {
        const e = byEvent(pledges);
        expect(e[0]).toEqual({ event: "Building fund dinner", count: 2, pledged_cents: 2250000, collected_cents: 600000, outstanding_cents: 1650000, written_off_cents: 0 });
        expect(e.map((x) => x.event)).toEqual(["Building fund dinner", "Night 27 dinner", "Night 21", "Night 25", "Night 23", "Night 29"]);
    });
});

describe("next step", () => {
    const p = { amount_cents: 100000, paid_cents: 0, due_date: null, written_off: false, reminders_paused: false, pledged_at: "2027-03-05T02:00:00Z" };
    it("is the next enabled step ahead", () => {
        expect(nextStep(p, STEPS, new Date("2027-03-08T00:00:00Z"))?.step.action).toBe("reminder");
        expect(nextStep(p, STEPS, new Date("2027-03-08T00:00:00Z"))?.at.toISOString()).toBe("2027-03-12T02:00:00.000Z");
    });
    it("skips disabled steps, and stops for paid, written-off and paused pledges", () => {
        expect(nextStep(p, STEPS, new Date("2027-03-30T00:00:00Z"))).toBeNull(); // only the disabled day-45 step is left
        expect(nextStep({ ...p, paid_cents: 100000 }, STEPS, new Date("2027-03-05T03:00:00Z"))).toBeNull();
        expect(nextStep({ ...p, written_off: true }, STEPS, new Date("2027-03-05T03:00:00Z"))).toBeNull();
        expect(nextStep({ ...p, reminders_paused: true }, STEPS, new Date("2027-03-05T03:00:00Z"))).toBeNull();
    });
});

it("split and pay link", () => {
    expect(splitFirst({ amount_cents: 250000, paid_cents: 100000, due_date: null, written_off: false })).toBe(50000);
    expect(splitFirst({ amount_cents: 1000, paid_cents: 0, due_date: null, written_off: false })).toBe(334);
    expect(payUrl("ab".repeat(32), "https://outgive.tech", true)).toBe(`https://outgive.tech/pledge/${"ab".repeat(32)}?split=3`);
});
