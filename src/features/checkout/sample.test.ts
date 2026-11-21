import { describe, expect, it } from "vitest";
import { SAMPLE, sampleFrom } from "./model";

describe("sample checkout from the home page box", () => {
    it("uses the described appeal as the title and honours the switches", () => {
        const c = sampleFrom("?appeal=Raise%20%C2%A3250%2C000%20for%20clean%20water&giftaid=0&match=0");
        expect(c.title).toBe("Raise £250,000 for clean water");
        expect(c.giftAid).toBe(false);
        expect(c.match).toBeNull();
    });
    it("falls back to the sample", () => {
        expect(sampleFrom("").title).toBe(SAMPLE.title);
        expect(sampleFrom("?appeal=%20%20").giftAid).toBe(SAMPLE.giftAid);
    });
});
