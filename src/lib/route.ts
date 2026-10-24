/**
 * Tenant-aware routing. An organisation is reached on its own host (custom domain or <slug>.outgive.org) or under /o/<slug>.
 * /demo is the sample charity's board. On a tenant host the /o/<slug> prefix disappears.
 */
import { PREFIX, type PageType } from "@/data";

export const DEMO_SLUG = "clearwell";
/** Hosts that are the platform itself, not a tenant. */
const BARE = /^(localhost|127\.0\.0\.1|\[::1\]|outgive\.org|www\.outgive\.org|.*\.vercel\.app|.*\.netlify\.app)(:\d+)?$/i;
const SUB = /^([a-z0-9-]+)\.outgive\.org(:\d+)?$/i;

export type Tenant = { slug: string | null; host: string | null };
/** slug from a subdomain; host for a custom domain to look up; neither on the platform's own hosts. */
export const tenantOf = (host: string): Tenant => {
    if (BARE.test(host)) return { slug: null, host: null };
    const m = host.match(SUB);
    if (m && m[1] !== "www") return { slug: m[1].toLowerCase(), host: null };
    return { slug: null, host: host.replace(/:\d+$/, "").toLowerCase() };
};

export type PageRef = { type: PageType; slug: string };
export type View =
    | { name: "landing" } | { name: "landing-b" } | { name: "layouts" } | { name: "pricing" } | { name: "start" } | { name: "login" } | { name: "dashboard" }
    | { name: "about" } | { name: "rules" } | { name: "faq" } | { name: "terms" } | { name: "privacy" } | { name: "notfound" }
    | { name: "board"; org: string } | { name: "live"; org: string; page?: PageRef } | { name: "give"; org: string; page?: PageRef } | { name: "overlay"; org: string; page?: PageRef }
    | { name: "create"; org: string; parent?: string } | { name: "admin"; org: string; tab?: string } | { name: "thanks"; org: string }
    | { name: "page"; org: string; page: PageRef; sub?: "manage" } | { name: "embed"; org: string; page?: PageRef };

const TYPE_OF: Record<string, PageType> = Object.fromEntries(Object.entries(PREFIX).map(([t, p]) => [p, t as PageType]));
const STATIC: Record<string, View> = { "/": { name: "landing" }, "/landing-b": { name: "landing-b" }, "/layouts": { name: "layouts" }, "/pricing": { name: "pricing" }, "/start": { name: "start" }, "/login": { name: "login" }, "/dashboard": { name: "dashboard" }, "/about": { name: "about" }, "/rules": { name: "rules" }, "/faq": { name: "faq" }, "/terms": { name: "terms" }, "/privacy": { name: "privacy" } };
const clean = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p) || "/";

/** Routes inside an organisation, given the path after its prefix. */
const orgView = (org: string, rest: string, query: URLSearchParams): View => {
    const seg = clean(rest).split("/").filter(Boolean);
    if (seg.length === 0) return { name: "board", org };
    const [a, b, c] = seg;
    if (a === "live" && seg.length === 1) return { name: "live", org };
    if (a === "overlay" && seg.length === 1) return { name: "overlay", org };
    if (a === "give" && seg.length === 1) return { name: "give", org };
    if (a === "create" && seg.length === 1) return { name: "create", org, parent: query.get("for") ?? undefined };
    if (a === "admin" && seg.length <= 2) return { name: "admin", org, tab: b };
    if (a === "thanks" && seg.length === 1) return { name: "thanks", org };
    if (a === "embed") { if (seg.length === 1) return { name: "embed", org }; if (seg.length === 3 && TYPE_OF[b]) return { name: "embed", org, page: { type: TYPE_OF[b], slug: decodeURIComponent(c) } }; }
    if (TYPE_OF[a] && b) {
        const page = { type: TYPE_OF[a], slug: decodeURIComponent(b) };
        if (seg.length === 2) return { name: "page", org, page };
        if (seg.length === 3 && c === "manage") return { name: "page", org, page, sub: "manage" };
        if (seg.length === 3 && c === "live") return { name: "live", org, page };
        if (seg.length === 3 && c === "overlay") return { name: "overlay", org, page };
        if (seg.length === 3 && c === "give") return { name: "give", org, page };
    }
    return { name: "notfound" };
};

export const parse = (path: string, tenant: Tenant, search = ""): View => {
    const p = clean(path); const q = new URLSearchParams(search);
    if (tenant.slug) {
        // On a tenant host the platform's own screens still work at their usual paths, except / which is the board.
        if (p !== "/" && STATIC[p]) return STATIC[p];
        return orgView(tenant.slug, p, q);
    }
    if (tenant.host) return orgView(tenant.host, p, q); // slug is resolved from the host by the app; carry the host as the key meanwhile
    if (STATIC[p]) return STATIC[p];
    const m = p.match(/^\/(demo|o\/([a-z0-9-]+))(\/.*)?$/i);
    if (m) return orgView(m[2] ? m[2].toLowerCase() : DEMO_SLUG, m[3] ?? "/", q);
    return { name: "notfound" };
};

/** The path for a view. On a tenant host org paths have no prefix; the demo org lives at /demo. */
export const pathOf = (v: View, tenant: Tenant): string => {
    const prefix = (org: string) => (tenant.slug || tenant.host ? "" : org === DEMO_SLUG ? "/demo" : `/o/${org}`);
    const pg = (r: PageRef) => `/${PREFIX[r.type]}/${encodeURIComponent(r.slug)}`;
    switch (v.name) {
        case "landing": case "notfound": return tenant.slug || tenant.host ? "/" : "/";
        case "board": return prefix(v.org) || "/";
        case "live": return `${prefix(v.org)}${v.page ? pg(v.page) : ""}/live`;
        case "overlay": return `${prefix(v.org)}${v.page ? pg(v.page) : ""}/overlay`;
        case "give": return `${prefix(v.org)}${v.page ? pg(v.page) : ""}/give`;
        case "create": return `${prefix(v.org)}/create${v.parent ? `?for=${encodeURIComponent(v.parent)}` : ""}`;
        case "admin": return `${prefix(v.org)}/admin${v.tab ? `/${v.tab}` : ""}`;
        case "thanks": return `${prefix(v.org)}/thanks`;
        case "embed": return `${prefix(v.org)}/embed${v.page ? pg(v.page) : ""}`;
        case "page": return `${prefix(v.org)}${pg(v.page)}${v.sub ? `/${v.sub}` : ""}`;
        default: return `/${v.name}`;
    }
};
