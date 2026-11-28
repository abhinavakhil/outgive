import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { H1448, QURBANI_SHARES, TEMPLATES, applyTemplate, rowsOf, templateOf } from "./templates";
import { fridaysBetween, nextFriday, weeklyStripe, yearly } from "./weekly";
import { giveLink, giveReply, keywordProblem, parse, twilioSignature, validSignature } from "../../../../supabase/functions/sms-inbound/logic";

const hijri = (iso: string) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" })
        .formatToParts(new Date(`${iso}T12:00:00Z`)).map((x) => [x.type, x.value]));
    return `${p.day}/${p.month}/${parseInt(p.year)}`;
};

describe("1448 dates", () => {
    it("match the Umm al-Qura calendar", () => {
        expect(hijri(H1448.ramadan)).toBe("1/9/1448");
        expect(hijri(H1448.night21)).toBe("21/9/1448");
        expect(hijri(H1448.eidFitr)).toBe("1/10/1448");
        expect(hijri(H1448.dhulHijjah)).toBe("1/12/1448");
        expect(hijri(H1448.arafah)).toBe("9/12/1448");
        expect(hijri(H1448.eidAdha)).toBe("10/12/1448");
        expect(hijri(H1448.tashreeqEnd)).toBe("13/12/1448");
    });
});

describe("templates", () => {
    it("each has funds, three asks with outcomes, a schedule and add-ons", () => {
        expect(TEMPLATES.map((t) => t.id)).toEqual(["ramadan", "dhul-hijjah", "emergency", "building", "jumuah"]);
        for (const t of TEMPLATES) {
            expect(t.funds.length).toBeGreaterThan(0);
            expect(t.asks).toHaveLength(3);
            expect(t.asks.every((a) => a.amount > 0 && a.outcome)).toBe(true);
            expect(keywordProblem(t.keyword)).toBeNull();
        }
        expect(templateOf("dhul-hijjah").asks[2].amount).toBe(QURBANI_SHARES[1].price * 7);
        expect(templateOf("jumuah").schedule).toMatchObject({ kind: "weekly", weekday: 5 });
    });

    it("applying adds funds and a campaign and keeps the page", () => {
        const one = applyTemplate(null, templateOf("ramadan"), { orgName: "Hope Foundation", today: "2026-11-28" });
        expect(one.causes.map((c) => c.id)).toEqual(["zakat", "sadaqah", "zakat-al-fitr", "fidya"]);
        expect(one.campaigns[0]).toMatchObject({ id: "ramadan-2027", title: "Ramadan 1448", ends: H1448.eidFitr });
        const two = applyTemplate(one, templateOf("dhul-hijjah"), { orgName: "x", today: "2026-11-28", goal: 20000 });
        expect(two.causes.map((c) => c.id)).toEqual(["zakat", "sadaqah", "zakat-al-fitr", "fidya", "qurbani"]); // sadaqah not twice
        expect(two.campaigns.map((c) => c.id)).toEqual(["ramadan-2027", "dhul-hijjah-2027"]);
        expect(two.campaigns[1].goal).toBe(20000);
        expect(two.name).toBe("Hope Foundation");
        const again = applyTemplate(two, templateOf("ramadan"), { orgName: "x", today: "2026-11-28", title: "Second appeal" });
        expect(again.campaigns[2]).toMatchObject({ id: "ramadan-2027-2", title: "Second appeal" });
        const b = applyTemplate(null, templateOf("building"), { orgName: "x", today: "2026-11-28", unit: "sqft" });
        expect(b.campaigns[0]).toMatchObject({ per: "a square foot", price: 150, ends: "" });
        expect(b.appeals![0].asks.map((a) => a.amount)).toEqual([150, 1500, 15000]);
        const e = applyTemplate(null, templateOf("emergency"), { orgName: "x", today: "2026-11-28" });
        expect(e.appeals![0]).toMatchObject({ starts: "2026-11-28", ends: "2026-12-28" });
    });

    it("lists campaigns with where they stand", () => {
        let p = applyTemplate(null, templateOf("ramadan"), { orgName: "x", today: "2026-11-28" });
        p = applyTemplate(p, templateOf("jumuah"), { orgName: "x", today: "2026-11-28" });
        p = { ...p, campaigns: [...p.campaigns, { id: "old", title: "Hand-made", text: "", raised: 10, goal: 100, art: 0, ends: "2026-01-01" }] };
        const r = rowsOf(p, "2027-02-10", { "ramadan-2027": 500 });
        expect(r.map((x) => [x.id, x.status, x.raised])).toEqual([["ramadan-2027", "In progress", 500], ["jumuah-2026", "Every Friday", 0], ["old", "Done", 10]]);
        expect(rowsOf(p, "2027-01-01")[0].status).toBe("Not started");
    });
});

describe("weekly giving", () => {
    it("anchors on the next Friday, never today", () => {
        expect(nextFriday(new Date("2026-11-28T10:00:00Z"))).toBe("2026-12-04"); // a Saturday
        expect(nextFriday(new Date("2026-12-04T10:00:00Z"))).toBe("2026-12-11"); // a Friday: next week's
        expect(nextFriday(new Date("2026-12-03T23:00:00Z"))).toBe("2026-12-04");
        expect(fridaysBetween("2027-02-08", "2027-03-09")).toEqual(["2027-02-12", "2027-02-19", "2027-02-26", "2027-03-05"]);
        expect(weeklyStripe(1000, 1000, new Date("2026-11-28T10:00:00Z"))).toMatchObject({ interval: "week", billing_cycle_anchor: Date.UTC(2026, 11, 4, 17) / 1000, proration_behavior: "none" });
        expect(yearly(10)).toBe(520);
    });
});

describe("text to give", () => {
    it("parses keywords and opt-out words", () => {
        expect(parse(" stop ")).toEqual({ kind: "stop" });
        expect(parse("Stop.")).toEqual({ kind: "stop" });
        expect(parse("START")).toEqual({ kind: "start" });
        expect(parse("info")).toEqual({ kind: "help" });
        expect(parse("iftar 50")).toEqual({ kind: "give", keyword: "IFTAR", amount: 50 });
        expect(parse("IFTAR $1,250.50")).toEqual({ kind: "give", keyword: "IFTAR", amount: 1250.5 });
        expect(parse("Zakat")).toEqual({ kind: "give", keyword: "ZAKAT", amount: null });
        expect(parse("iftar fifty")).toEqual({ kind: "unknown" });
        expect(parse("")).toEqual({ kind: "unknown" });
        expect(keywordProblem("STOP")).toMatch(/kept/);
        expect(keywordProblem("ab")).toMatch(/3 to 15/);
        expect(keywordProblem("IFTAR")).toBeNull();
    });

    it("replies with a one-tap link, amount and fund filled in", () => {
        const k = { keyword: "IFTAR", org_slug: "hope-foundation", org_name: "Hope Foundation", fund: "general", amount_cents: 5000, appeal: "Iftar 1448" };
        expect(giveLink("https://outgive.tech/", k, 25)).toBe("https://outgive.tech/o/hope-foundation/checkout?amount=25&fund=general&utm_source=sms&utm_medium=text&utm_campaign=iftar");
        expect(giveReply("https://outgive.tech", k, 25)).toBe("Hope Foundation: thank you. Give $25 to Iftar 1448 in one tap: https://outgive.tech/o/hope-foundation/checkout?amount=25&fund=general&utm_source=sms&utm_medium=text&utm_campaign=iftar Reply STOP to opt out.");
        expect(giveReply("https://outgive.tech", k, null)).toContain("Give $50 ");
        expect(giveReply("https://outgive.tech", { ...k, amount_cents: null }, null)).toContain("Give to Iftar 1448 in one tap");
        expect(giveReply("https://outgive.tech", k, 0.5)).toMatch(/\$1 to \$10,000/);
    });

    it("checks Twilio signatures the way Twilio makes them", async () => {
        const url = "https://x.supabase.co/functions/v1/sms-inbound", p = { From: "+12125550101", To: "+18005551212", Body: "IFTAR 50" };
        const node = createHmac("sha1", "secret").update(url + "Body" + p.Body + "From" + p.From + "To" + p.To).digest("base64");
        expect(await twilioSignature("secret", url, p)).toBe(node);
        expect(await validSignature("secret", url, p, node)).toBe(true);
        expect(await validSignature("secret", url, { ...p, Body: "IFTAR 5000" }, node)).toBe(false);
        expect(await validSignature("secret", url, p, null)).toBe(false);
    });
});

describe("onboarding start", () => {
    it("Ramadan is the onboarding's own starter; others carry the website", async () => {
        const { startPage } = await import("./templates");
        const { START_WITH, ramadanTemplate } = await import("../onboard/model");
        expect(startPage("ramadan", "A", "https://a.org", "2026-11-28")).toEqual(ramadanTemplate("A", "https://a.org"));
        const j = startPage("jumuah", "A", "https://a.org", "2026-11-28");
        expect(j).toMatchObject({ name: "A", socials: { website: "https://a.org" } });
        expect(j.campaigns[0].tag).toBe("Every Friday");
        expect(START_WITH.map(([id]) => id).filter(Boolean).every((id) => TEMPLATES.some((t) => t.id === id))).toBe(true);
    });
});
