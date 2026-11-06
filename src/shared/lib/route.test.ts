import { describe, expect, it } from "vitest";
import { parse, pathOf, tenantOf } from "./route";

const bare = tenantOf("outgive.org"); const sub = tenantOf("clearwell.outgive.org"); const custom = tenantOf("give.clearwell.org");
describe("tenants", () => {
    it("platform hosts carry no tenant", () => { expect(tenantOf("localhost:5173")).toEqual({ slug: null, host: null }); expect(tenantOf("outgive-abc.vercel.app").slug).toBeNull(); expect(tenantOf("www.outgive.org").slug).toBeNull(); expect(tenantOf("www.outgive.tech")).toEqual({ slug: null, host: null }); expect(tenantOf("outgive.tech")).toEqual({ slug: null, host: null }); expect(tenantOf("clearwell.outgive.tech").slug).toBe("clearwell"); });
    it("subdomains and custom domains do", () => { expect(sub).toEqual({ slug: "clearwell", host: null }); expect(custom).toEqual({ slug: null, host: "give.clearwell.org" }); expect(tenantOf("Give.Clearwell.org:443").host).toBe("give.clearwell.org"); });
});
describe("parse", () => {
    it("platform routes", () => { expect(parse("/", bare)).toEqual({ name: "landing" }); expect(parse("/pricing/", bare)).toEqual({ name: "pricing" }); expect(parse("/nope", bare)).toEqual({ name: "notfound" }); });
    it("blog", () => { expect(parse("/blog/", bare)).toEqual({ name: "blog" }); expect(parse("/blog/how-to-start", bare)).toEqual({ name: "post", slug: "how-to-start" }); expect(parse("/blog/a/b", bare)).toEqual({ name: "notfound" }); expect(parse("/blog/x", sub)).toEqual({ name: "notfound" }); expect(parse("/blog", sub)).toEqual({ name: "notfound" }); expect(pathOf({ name: "post", slug: "x" }, bare)).toBe("/blog/x"); });
    it("/demo and /o/<slug> are org prefixes", () => {
        expect(parse("/demo", bare)).toEqual({ name: "board", org: "clearwell" });
        expect(parse("/o/Mangrove/f/plant-trees", bare)).toEqual({ name: "page", org: "mangrove", page: { type: "fundraiser", slug: "plant-trees" } });
        expect(parse("/demo/e/gala/manage", bare)).toEqual({ name: "page", org: "clearwell", page: { type: "event", slug: "gala" }, sub: "manage" });
        expect(parse("/demo/c/water/live", bare)).toEqual({ name: "live", org: "clearwell", page: { type: "campaign", slug: "water" } });
        expect(parse("/demo/admin/payments", bare)).toEqual({ name: "admin", org: "clearwell", tab: "payments" });
        expect(parse("/demo/create", bare, "?for=abc")).toEqual({ name: "create", org: "clearwell", parent: "abc" });
        expect(parse("/demo/embed/f/x", bare)).toEqual({ name: "embed", org: "clearwell", page: { type: "fundraiser", slug: "x" } });
        expect(parse("/demo/x/y", bare)).toEqual({ name: "notfound" });
    });
    it("on a tenant host the prefix disappears", () => {
        expect(parse("/", sub)).toEqual({ name: "board", org: "clearwell" });
        expect(parse("/live", sub)).toEqual({ name: "live", org: "clearwell" });
        expect(parse("/f/amara", custom)).toEqual({ name: "page", org: "give.clearwell.org", page: { type: "fundraiser", slug: "amara" } });
        expect(parse("/login", sub)).toEqual({ name: "login" });
    });
});
describe("action links are paths", () => {
    const water = { type: "campaign" as const, slug: "water" };
    it("donate, with an optional amount", () => {
        expect(parse("/demo/c/water/donate", bare)).toEqual({ name: "page", org: "clearwell", page: water, sub: "donate" });
        expect(parse("/demo/c/water/donate/50", bare)).toEqual({ name: "page", org: "clearwell", page: water, sub: "donate", amount: 50 });
        expect(parse("/demo/c/water/donate/abc", bare)).toEqual({ name: "notfound" });
        expect(parse("/demo/donate", bare)).toEqual({ name: "give", org: "clearwell" });
        expect(parse("/donate", sub)).toEqual({ name: "give", org: "clearwell" });
    });
    it("live layout and theme, overlay style, embed options", () => {
        expect(parse("/demo/live/podium/light", bare)).toEqual({ name: "live", org: "clearwell", layout: "podium", theme: "light" });
        expect(parse("/demo/c/water/live/dark", bare)).toEqual({ name: "live", org: "clearwell", page: water, theme: "dark" });
        expect(parse("/demo/live/sparkles", bare)).toEqual({ name: "notfound" });
        expect(parse("/demo/overlay/ticker", bare)).toEqual({ name: "overlay", org: "clearwell", style: "ticker" });
        expect(parse("/demo/embed/dark/10", bare)).toEqual({ name: "embed", org: "clearwell", theme: "dark", limit: 10 });
        expect(parse("/demo/c/water/embed", bare)).toEqual({ name: "embed", org: "clearwell", page: water });
    });
    it("fundraise under a campaign, receipts", () => {
        expect(parse("/demo/c/water/fundraise", bare)).toEqual({ name: "create", org: "clearwell", parent: "c/water" });
        expect(parse("/demo/thanks/cs_test_123", bare)).toEqual({ name: "thanks", org: "clearwell", ref: "cs_test_123" });
    });
    it("older query-string links still resolve", () => {
        expect(parse("/demo/c/water", bare, "?donate&amount=25")).toEqual({ name: "page", org: "clearwell", page: water, sub: "donate", amount: 25 });
        expect(parse("/demo/live", bare, "?layout=wall&theme=light")).toEqual({ name: "live", org: "clearwell", layout: "wall", theme: "light" });
        expect(parse("/demo/overlay", bare, "?theme=alert")).toEqual({ name: "overlay", org: "clearwell", style: "alert" });
        expect(parse("/demo/thanks", bare, "?session_id=cs_x")).toEqual({ name: "thanks", org: "clearwell", ref: "cs_x" });
        expect(parse("/demo/embed/c/water", bare, "?limit=8")).toEqual({ name: "embed", org: "clearwell", page: water, limit: 8 });
    });
    it("links are written as paths", () => {
        expect(pathOf({ name: "page", org: "clearwell", page: water, sub: "donate", amount: 50 }, bare)).toBe("/demo/c/water/donate/50");
        expect(pathOf({ name: "give", org: "clearwell" }, sub)).toBe("/donate");
        expect(pathOf({ name: "give", org: "clearwell", page: water }, sub)).toBe("/c/water/give");
        expect(pathOf({ name: "live", org: "mangrove", page: water, layout: "impact", theme: "light" }, bare)).toBe("/o/mangrove/c/water/live/impact/light");
        expect(pathOf({ name: "overlay", org: "clearwell", style: "alert" }, sub)).toBe("/overlay/alert");
        expect(pathOf({ name: "create", org: "clearwell", parent: "c/water" }, sub)).toBe("/c/water/fundraise");
        expect(pathOf({ name: "thanks", org: "clearwell", ref: "abc" }, bare)).toBe("/demo/thanks/abc");
        expect(pathOf({ name: "embed", org: "clearwell", page: water, theme: "dark" }, sub)).toBe("/c/water/embed/dark");
    });
});
describe("pathOf round-trips", () => {
    const views = [parse("/demo", bare), parse("/o/mangrove/f/plant-trees", bare), parse("/demo/e/gala/manage", bare), parse("/demo/admin/payments", bare), parse("/demo/overlay", bare), parse("/demo/c/water/live", bare), parse("/pricing", bare), parse("/demo/create", bare, "?for=abc"), parse("/demo/c/water/donate/50", bare), parse("/demo/live/wall/light", bare), parse("/demo/overlay/ticker", bare), parse("/demo/c/water/fundraise", bare), parse("/demo/thanks/cs_1", bare), parse("/demo/embed/dark/10", bare), parse("/demo/donate", bare)];
    for (const v of views) it(JSON.stringify(v), () => { const p = pathOf(v, bare); const [path, q] = p.split("?"); expect(parse(path, bare, q ? `?${q}` : "")).toEqual(v); });
    it("drops the prefix on a tenant host", () => { expect(pathOf({ name: "board", org: "clearwell" }, sub)).toBe("/"); expect(pathOf({ name: "live", org: "clearwell" }, sub)).toBe("/live"); expect(pathOf({ name: "page", org: "x", page: { type: "team", slug: "a b" } }, custom)).toBe("/t/a%20b"); });
});
