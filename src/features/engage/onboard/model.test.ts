import { expect, test } from "vitest";
import { SLUG, formatEin, ramadanTemplate, slugify, tidySlug } from "./model";

test("page address", () => {
    expect(slugify("  Hope Foundation, Inc. ")).toBe("hope-foundation-inc");
    expect(tidySlug("Clear Well-")).toBe("clear-well-");
    expect(SLUG.test("clear-well")).toBe(true);
    expect(SLUG.test("clear-well-")).toBe(false);
    expect(SLUG.test("-x")).toBe(false);
});

test("EIN formats as NN-NNNNNNN", () => {
    expect(formatEin("123456789")).toBe("12-3456789");
    expect(formatEin("12-34a5678901")).toBe("12-3456789");
    expect(formatEin("1")).toBe("1");
});

test("the Ramadan template has the four funds and no goals", () => {
    const t = ramadanTemplate("Hope Foundation", "");
    expect(t.causes.map((c) => c.title)).toEqual(["Zakat", "Sadaqah", "Zakat al-Fitr", "Fidya"]);
    expect(t.causes.every((c) => c.goal === 0 && c.raised === 0)).toBe(true);
    expect(t.avatar).toBe("HF");
    expect(t.campaigns).toEqual([]);
});
