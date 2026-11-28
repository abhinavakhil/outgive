import { describe, expect, it } from "vitest";
import { ago, deliveryLabel, embedCode, shortUrl, validUrl } from "./model";

describe("headless API screen model", () => {
    it("labels deliveries by what the endpoint answered", () => {
        expect(deliveryLabel({ status: "succeeded", last_status: 204, attempts: 1 })).toEqual(["sage", "204"]);
        expect(deliveryLabel({ status: "pending", last_status: 500, attempts: 2 })).toEqual(["peach", "500, retrying"]);
        expect(deliveryLabel({ status: "pending", last_status: null, attempts: 0 })).toEqual(["lilac", "Queued"]);
        expect(deliveryLabel({ status: "failed", last_status: null, attempts: 8 })).toEqual(["peach", "Gave up"]);
    });
    it("formats times, URLs and the embed", () => {
        const now = Date.parse("2027-03-05T12:00:00Z");
        expect([ago(null, now), ago("2027-03-05T11:59:30Z", now), ago("2027-03-05T11:45:00Z", now), ago("2027-03-05T09:00:00Z", now)]).toEqual(["Never", "Just now", "15 min ago", "3 h ago"]);
        expect(shortUrl("https://a.org/hooks/")).toBe("a.org/hooks");
        expect([validUrl("https://a.org/x"), validUrl("http://a.org"), validUrl("https://localhost")]).toEqual([true, false, false]);
        expect(embedCode("hope-foundation")).toContain('charity: "hope-foundation"');
    });
});
