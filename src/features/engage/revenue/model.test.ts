import { describe, expect, it } from "vitest";
import { addonStats, biggestDrop, bestConverter, campaignStats, channelOf, conversion, median, nightDate, nightOf, nightSeries, nightSplit, sourceStats, toCsv } from "./model";
import { parseCsv, parseDate, parseImport } from "./importer";
import { readAttribution } from "@/shared/attribution";
import { SAMPLE_ADDONS, SAMPLE_CAMPAIGN, SAMPLE_FUNNEL, SAMPLE_SOURCES, NIGHTS } from "./sample";
import { buildMorningReport } from "../../../../supabase/functions/morning-report/report";

describe("maths", () => {
    it("median, rates", () => {
        expect(median([])).toBe(0); expect(median([5, 1, 3])).toBe(3); expect(median([4, 1, 3, 2])).toBe(2.5);
        expect(conversion(1042, 2310)).toBeCloseTo(0.451, 3); expect(conversion(1, 0)).toBe(0);
    });
    it("nights follow the SQL: Night 1 is the eve of the first fast, nights run noon to noon, New York time", () => {
        expect(nightOf("2027-03-06T02:00:00Z", "2027-02-08")).toBe(27);     // 21:00 on 5 March in New York
        expect(nightOf("2027-03-06T06:30:00Z", "2027-02-08")).toBe(27);     // 01:30 the morning after
        expect(nightOf("2027-03-06T18:00:00Z", "2027-02-08")).toBe(28);     // 13:00, the next night's day
        expect(nightOf("2027-02-08T02:00:00Z", "2027-02-08")).toBe(1);
        expect(nightOf("2027-02-07T02:00:00Z", "2027-02-08")).toBeNull();
        expect(nightDate(27, "2027-02-08")).toBe("2027-03-05");
    });
    it("sample nights: last ten spike on odd nights, Night 27 biggest", () => {
        const n = nightSeries(SAMPLE_CAMPAIGN.by_night);
        expect(n.indexOf(Math.max(...n))).toBe(26);
        const s = nightSplit(NIGHTS);
        expect(s.last10).toBeGreaterThan(s.first20 * 0.9); expect(s.oddLast10).toBeGreaterThan(s.last10 / 2);
        expect(campaignStats(SAMPLE_CAMPAIGN).avg_cents).toBeCloseTo(7879, 0);
    });
    it("sources, funnel and add-ons", () => {
        const s = sourceStats(SAMPLE_SOURCES);
        expect(s.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1);
        expect(s.find((r) => r.key === "Meta ads")!.roas).toBeCloseTo(6.5, 1);
        expect(bestConverter(SAMPLE_SOURCES)!.key).toBe("Live night QR");
        expect(biggestDrop(SAMPLE_FUNNEL[0])).toBe("checkout_started");
        const a = addonStats(SAMPLE_ADDONS);
        expect(a.feeCover).toBeCloseTo(0.71, 2); expect(a.addons[0].key).toBe("zakat_al_fitr");
    });
    it("CSV quotes and neutralises formulas", () => {
        expect(toCsv([{ a: 'x,"y"', b: "=SUM(A1)", c: -5, d: { k: 1 }, e: null }])).toBe('a,b,c,d,e\r\n"x,""y""",\'=SUM(A1),-5,"{""k"":1}",');
    });
});

describe("attribution", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile";
    it("reads the URL and groups the channel", () => {
        const a = readAttribution("https://outgive.tech/give?qr=table-6&night=27&utm_source=x", "https://outgive.tech/ramadhan", ua, 390, "s1");
        expect(a).toEqual({ session: "s1", channel: "Live night QR", device: "mobile", landing: "/give", qr: "table-6", night: 27, utm_source: "x" });
        const m = readAttribution("https://o.t/?fbclid=abc&utm_campaign=r27", "https://l.facebook.com/l.php?u=secret", "Mozilla/5.0 (Windows NT 10.0)", 1400, "s2");
        expect(m).toMatchObject({ channel: "Meta ads", device: "desktop", click_type: "fbclid", click_id: "abc", referrer: "https://l.facebook.com/l.php" });
        expect(readAttribution("https://o.t/?night=99", "", ua, 390, "s").night).toBeUndefined();
    });
    it("channel rules", () => {
        expect(channelOf({ utm_source: "newsletter", utm_medium: "email" })).toBe("Email");
        expect(channelOf({ utm_source: "facebook", utm_medium: "paid_social" })).toBe("Meta ads");
        expect(channelOf({ utm_source: "facebook" })).toBe("Social");
        expect(channelOf({ utm_source: "whatsapp" })).toBe("WhatsApp shares");
        expect(channelOf({ referrer: "https://wa.me/" })).toBe("WhatsApp shares");
        expect(channelOf({ fundraiser: "aisha" })).toBe("Fundraiser pages");
        expect(channelOf({ click_type: "gclid", click_id: "x" })).toBe("Google ads");
        expect(channelOf({ referrer: "https://www.google.com/" })).toBe("Search");
        expect(channelOf({ referrer: "https://blog.example/" })).toBe("Referral");
        expect(channelOf({})).toBe("Website direct");
    });
});

describe("import", () => {
    it("parses quoted CSV", () => {
        expect(parseCsv('a,b\r\n"x, ""y""","line\nbreak"\n\n')).toEqual([["a", "b"], ['x, "y"', "line\nbreak"]]);
        expect(parseDate("03/05/2027 9:14 PM")).toBe("2027-03-05T21:14:00.000Z");
        expect(parseDate("2027-03-05 21:14:00 UTC")).toBe("2027-03-05T21:14:00.000Z");
        expect(parseDate("02/30/2027")).toBeNull(); expect(parseDate("soon")).toBeNull();
    });
    it("maps Donorbox and LaunchGood exports", () => {
        const db = parseImport("Donor First Name,Donor Last Name,Donor Email,Amount,Currency,Donated At,Designation,Recurring Donation,Processing Fee,Stripe Charge Id,Postal Code\nAisha,Khan,AISHA@x.com,\"$1,200.00\",usd,2026-03-14 21:00:00 UTC,Zakat,false,35.10,ch_1,10001\nBad,Row,b@x.com,abc,usd,2026-03-14,,,,ch_2,");
        expect(db.tool).toBe("donorbox");
        expect(db.rows).toEqual([{ external_id: "ch_1", created_at: "2026-03-14T21:00:00.000Z", amount_cents: 120000, currency: "USD", fund: "Zakat", donor_name: "Aisha Khan", donor_email: "aisha@x.com", anonymous: false, recurring: false, processing_fee_cents: 3510, zip: "10001" }]);
        expect(db.errors).toEqual([{ line: 3, why: 'Amount "abc" is not a positive number' }]);
        const lg = parseImport("Donation ID,Date,Amount,Name,Email,Campaign,Anonymous,Type\n9,03/01/2026,50,Omar S,o@x.com,Ramadan 1447,Yes,Monthly");
        expect(lg.tool).toBe("launchgood");
        expect(lg.rows[0]).toMatchObject({ external_id: "9", amount_cents: 5000, campaign: "Ramadan 1447", anonymous: true, recurring: true });
        expect(parseImport("Foo,Bar\n1,2").errors.map((e) => e.why)).toEqual(["No amount column", "No date column"]);
    });
});

describe("morning report", () => {
    it("summarises the night against the one before", () => {
        const night = { raised_cents: 4501500, gifts: 571, donors: 430, pledges: 4, pledged_cents: 1250000, pledge_collected_cents: 400000, match_unlocked_cents: 0, match_remaining_cents: 0, top_tables: [{ qr: "table-6", cents: 412000, gifts: 61 }] };
        const r = buildMorningReport({ orgName: "Hope <Foundation>", currency: "USD", night: 27, tonight: night, previous: { ...night, raised_cents: 1892500 }, newDonors: 120,
            funds: [{ key: "Zakat", cents: 2000000, gifts: 200 }], sources: [{ key: "Live night QR", cents: 1500000, gifts: 200 }], dashboardUrl: "https://outgive.tech/engage/revenue" });
        expect(r.subject).toBe("Night 27: $45,015 from 571 gifts");
        expect(r.text).toContain("Raised: $45,015 from 571 gifts (+138% on Night 26)");
        expect(r.text).toContain("Pledged: $12,500 in 4 pledges, $4,000 collected so far");
        expect(r.text).not.toContain("Match:");
        expect(r.html).toContain("Hope &lt;Foundation&gt;");
    });
});
