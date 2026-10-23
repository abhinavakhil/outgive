import { describe, expect, it } from "vitest";
import { parse, pathOf, tenantOf } from "./route";

const bare = tenantOf("outgive.org"); const sub = tenantOf("clearwell.outgive.org"); const custom = tenantOf("give.clearwell.org");
describe("tenants", () => {
    it("platform hosts carry no tenant", () => { expect(tenantOf("localhost:5173")).toEqual({ slug: null, host: null }); expect(tenantOf("outgive-abc.vercel.app").slug).toBeNull(); expect(tenantOf("www.outgive.org").slug).toBeNull(); });
    it("subdomains and custom domains do", () => { expect(sub).toEqual({ slug: "clearwell", host: null }); expect(custom).toEqual({ slug: null, host: "give.clearwell.org" }); expect(tenantOf("Give.Clearwell.org:443").host).toBe("give.clearwell.org"); });
});
describe("parse", () => {
    it("platform routes", () => { expect(parse("/", bare)).toEqual({ name: "landing" }); expect(parse("/pricing/", bare)).toEqual({ name: "pricing" }); expect(parse("/nope", bare)).toEqual({ name: "notfound" }); });
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
describe("pathOf round-trips", () => {
    const views = [parse("/demo", bare), parse("/o/mangrove/f/plant-trees", bare), parse("/demo/e/gala/manage", bare), parse("/demo/admin/payments", bare), parse("/demo/overlay", bare), parse("/demo/c/water/live", bare), parse("/pricing", bare), parse("/demo/create", bare, "?for=abc")];
    for (const v of views) it(JSON.stringify(v), () => { const p = pathOf(v, bare); const [path, q] = p.split("?"); expect(parse(path, bare, q ? `?${q}` : "")).toEqual(v); });
    it("drops the prefix on a tenant host", () => { expect(pathOf({ name: "board", org: "clearwell" }, sub)).toBe("/"); expect(pathOf({ name: "live", org: "clearwell" }, sub)).toBe("/live"); expect(pathOf({ name: "page", org: "x", page: { type: "team", slug: "a b" } }, custom)).toBe("/t/a%20b"); });
});
