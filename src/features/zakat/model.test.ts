import { describe, expect, it } from "vitest";
import { type ZakatInput, cleanSlug, giveLink, parseAmount, perGram, safeUrl, zakat } from "./model";
import { parse, pathOf, tenantOf } from "@/shared/lib/route";

const base: ZakatInput = { cash: 0, investments: 0, business: 0, owed: 0, debts: 0, gold: 0, silver: 0, goldPrice: 100, silverPrice: 1, basis: "silver" };
const z = (x: Partial<ZakatInput>) => zakat({ ...base, ...x });

describe("nisab", () => {
    it("silver basis is 595 g at the silver price", () => expect(z({ silverPrice: 1.05 }).nisab).toBe(624.75));
    it("gold basis is 85 g at the gold price", () => expect(z({ basis: "gold", goldPrice: 117.35 }).nisab).toBe(9974.75));
    it("same wealth can be due on silver and not on gold", () => {
        expect(z({ cash: 5000 }).due).toBe(125);
        expect(z({ cash: 5000, basis: "gold" })).toMatchObject({ above: false, due: 0 });
    });
});

describe("below and above", () => {
    it("below the nisab owes nothing", () => expect(z({ cash: 594.99 })).toMatchObject({ above: false, due: 0, net: 594.99 }));
    it("exactly at the nisab is due", () => expect(z({ cash: 595 })).toMatchObject({ above: true, due: 14.88 }));
    it("adds every kind of wealth, metals at their price", () => {
        const r = z({ cash: 18000, investments: 12500, gold: 40, goldPrice: 85, silver: 100, silverPrice: 1.05, business: 1000, owed: 2000 });
        expect(r.assets).toBe(18000 + 12500 + 3400 + 105 + 1000 + 2000);
        expect(r.lines.map(([l]) => l)).toEqual(["Cash and bank", "Shares and investments", "Gold, 40 g", "Silver, 100 g", "Business stock", "Money owed to you"]);
        expect(r.due).toBe(925.13);
    });
    it("leaves empty lines out", () => expect(z({ cash: 10 }).lines).toEqual([["Cash and bank", 10]]));
});

describe("debts", () => {
    it("are taken off before the nisab test", () => {
        const r = z({ cash: 1000, debts: 500 });
        expect(r).toMatchObject({ net: 500, above: false, due: 0, debts: 500 });
    });
    it("larger than assets leave nothing, never a negative", () => expect(z({ cash: 100, debts: 900 })).toMatchObject({ net: 0, due: 0 }));
    it("the prototype example", () => {
        const r = z({ cash: 18000, gold: 40, investments: 12500, owed: 2000, debts: 4500, goldPrice: 85, silverPrice: 1.05 });
        expect(r).toMatchObject({ assets: 35900, net: 31400, due: 785 });
    });
});

describe("guards", () => {
    it("negative, NaN and Infinity count as zero", () => expect(z({ cash: -500, investments: NaN, owed: Infinity, debts: -10 })).toMatchObject({ assets: 0, debts: 0, net: 0, due: 0 }));
    it("all zero owes nothing", () => expect(z({})).toMatchObject({ assets: 0, net: 0, due: 0, above: false }));
    it("no metal price means no nisab, so nothing is due", () => expect(z({ cash: 1e6, silverPrice: 0 })).toMatchObject({ nisab: 0, above: false, due: 0 }));
});

describe("rounding to cents", () => {
    it("rounds half a cent up", () => expect(z({ cash: 1000.2 }).due).toBe(25.01)); // 25.005
    it("rounds down below half", () => expect(z({ cash: 1000.15 }).due).toBe(25)); // 25.00375
    it("float sums stay exact", () => expect(z({ cash: 0.1, investments: 0.2, silverPrice: 0.0001 }).assets).toBe(0.3));
    it("metal value rounds to the cent", () => expect(z({ gold: 1.234, goldPrice: 117.35 }).lines[0]).toEqual(["Gold, 1.234 g", 144.81]));
});

describe("helpers", () => {
    it("parses what people type", () => {
        expect(parseAmount("$1,250.50")).toBe(1250.5);
        expect(parseAmount(" 300 ")).toBe(300);
        expect(parseAmount(".5")).toBe(0.5);
        for (const s of ["", ".", "-5", "abc", "1.2.3", "1e5"]) expect(parseAmount(s)).toBe(0);
    });
    it("converts a troy-ounce price to per gram", () => {
        expect(perGram(3650)).toBe(117.35);
        expect(perGram(43.23)).toBe(1.39);
        expect(perGram(-1)).toBe(0);
    });
    it("fills the gift on the charity's checkout", () => {
        expect(giveLink("https://hope.org/give", 785)).toBe("https://hope.org/give?amount=785.00&fund=zakat");
        expect(giveLink("https://hope.org/give?ref=x&fund=sadaqah", 14.88)).toBe("https://hope.org/give?ref=x&fund=zakat&amount=14.88");
    });
    it("refuses unsafe addresses and slugs", () => {
        expect(safeUrl("javascript:alert(1)")).toBeNull();
        expect(safeUrl("/checkout")).toBeNull();
        expect(safeUrl("https://a.org")?.host).toBe("a.org");
        expect(cleanSlug("hope-foundation")).toBe("hope-foundation");
        expect(cleanSlug("<x>")).toBeNull();
    });
});

describe("routes", () => {
    const t = tenantOf("outgive.org");
    it("parses and prints both paths", () => {
        expect(parse("/zakat-calculator", t)).toEqual({ name: "zakat-calculator" });
        expect(parse("/zakat-calculator/embed", t, "?charity=hope")).toEqual({ name: "zakat-embed" });
        expect(pathOf({ name: "zakat-calculator" }, t)).toBe("/zakat-calculator");
        expect(pathOf({ name: "zakat-embed" }, t)).toBe("/zakat-calculator/embed");
    });
});
