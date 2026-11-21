/**
 * Tenant-aware routing. An organisation is reached on its own host (custom domain or <slug>.outgive.org) or under /o/<slug>.
 * /demo is the sample charity's board. On a tenant host the /o/<slug> prefix disappears.
 */
import { PREFIX, type PageType } from "@/shared/domain/model";

export const DEMO_SLUG = "clearwell";
/** Hosts that are the platform itself, not a tenant. */
const BARE = /^(localhost|127\.0\.0\.1|\[::1\]|(?:www\.)?outgive\.(?:org|tech)|.*\.vercel\.app|.*\.netlify\.app)(:\d+)?$/i;
const SUB = /^([a-z0-9-]+)\.outgive\.(?:org|tech)(:\d+)?$/i;

export type Tenant = { slug: string | null; host: string | null };
/** slug from a subdomain; host for a custom domain to look up; neither on the platform's own hosts. */
export const tenantOf = (host: string): Tenant => {
    if (BARE.test(host)) return { slug: null, host: null };
    const m = host.match(SUB);
    if (m && m[1] !== "www") return { slug: m[1].toLowerCase(), host: null };
    return { slug: null, host: host.replace(/:\d+$/, "").toLowerCase() };
};

export type PageRef = { type: PageType; slug: string };
/** Live screen compositions and overlay styles, as they appear in links: /live/podium/light, /overlay/ticker. */
export const LIVE_LINK_LAYOUTS = ["classic", "thermo", "impact", "podium", "wall"] as const;
export const OVERLAY_STYLES = ["bar", "alert", "ticker"] as const;
/** Views of the dashboard after /dashboard/: the charity's (donations … profile), then the signed-in donor's own (giving, account). No tab is the overview. */
export const DASH_TABS = ["donations", "subscriptions", "analytics", "gateways", "profile", "giving", "account"] as const;
type LiveLink = { layout?: (typeof LIVE_LINK_LAYOUTS)[number]; theme?: "dark" | "light" };
export type View =
    | { name: "landing" } | { name: "legacy" } | { name: "landing-b" } | { name: "layouts" } | { name: "ui" } | { name: "ui-variants" } | { name: "pricing" } | { name: "start" } | { name: "login" }
    /** /dashboard/giving opens a tab; /dashboard/receipt/<gift id> is that gift's receipt. */
    | { name: "dashboard"; tab?: (typeof DASH_TABS)[number]; gift?: string }
    | { name: "blog" } | { name: "post"; slug: string }
    | { name: "about" } | { name: "rules" } | { name: "faq" } | { name: "terms" } | { name: "privacy" } | { name: "notfound" }
    | { name: "board"; org: string } | ({ name: "live"; org: string; page?: PageRef } & LiveLink) | { name: "give"; org: string; page?: PageRef }
    | { name: "overlay"; org: string; page?: PageRef; style?: (typeof OVERLAY_STYLES)[number] }
    /** parent: the campaign a new page sits under, as its key ("c/water"); an id from an older ?for= link also works. */
    | { name: "create"; org: string; parent?: string } | { name: "admin"; org: string; tab?: string }
    /** ref: a gift id (demo) or a Stripe Checkout session id (cs_...). */
    | { name: "thanks"; org: string; ref?: string }
    /** real: a campaign made in the create flow, at /f/<slug>, /t/<slug>… on the platform host; only real campaigns show there. */
    | { name: "page"; org: string; page: PageRef; sub?: "manage" | "donate"; amount?: number; real?: true }
    | { name: "embed"; org: string; page?: PageRef; theme?: "dark"; limit?: number }
    /** The donate checkout: /checkout is the sample; /demo/checkout and /o/<org>/checkout offer what that organisation has connected. */
    | { name: "checkout"; org?: string };

const TYPE_OF: Record<string, PageType> = Object.fromEntries(Object.entries(PREFIX).map(([t, p]) => [p, t as PageType]));
const STATIC: Record<string, View> = { "/": { name: "landing" }, "/landing-b": { name: "landing-b" }, "/layouts": { name: "layouts" }, "/ui": { name: "ui" }, "/ui/variants": { name: "ui-variants" }, "/pricing": { name: "pricing" }, "/start": { name: "start" }, "/login": { name: "login" }, "/dashboard": { name: "dashboard" }, "/about": { name: "about" }, "/rules": { name: "rules" }, "/faq": { name: "faq" }, "/terms": { name: "terms" }, "/privacy": { name: "privacy" }, "/blog": { name: "blog" }, "/checkout": { name: "checkout" }, "/ramadan": { name: "landing" }, "/legacy": { name: "legacy" } };
const clean = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p) || "/";

/** /live/podium/light: an optional layout and theme, in either order. */
const liveOpts = (rest: string[], q: URLSearchParams): LiveLink | null => {
    const o: LiveLink = {};
    for (const x of [...rest, q.get("layout") ?? "", q.get("theme") ?? ""].filter(Boolean)) {
        if ((LIVE_LINK_LAYOUTS as readonly string[]).includes(x)) o.layout ??= x as LiveLink["layout"];
        else if (x === "dark" || x === "light") o.theme ??= x;
        else if (rest.includes(x)) return null;
    }
    return o;
};
const overlayOpts = (rest: string[], q: URLSearchParams) => {
    const x = rest[0] ?? q.get("theme") ?? ""; if (rest.length > 1) return null;
    if (!x) return {}; return (OVERLAY_STYLES as readonly string[]).includes(x) ? { style: x as (typeof OVERLAY_STYLES)[number] } : null;
};
/** /embed/dark/10: dark widget, ten rows. */
const embedOpts = (rest: string[], q: URLSearchParams) => {
    const o: { theme?: "dark"; limit?: number } = {};
    for (const x of [...rest, q.get("theme") ?? "", q.get("limit") ?? ""].filter(Boolean)) {
        if (x === "dark") o.theme = "dark"; else if (/^\d+$/.test(x)) o.limit = Number(x); else if (rest.includes(x)) return null;
    }
    return o;
};
const drop = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
/** /dashboard/<view> and /dashboard/receipt/<gift id>. */
const dashView = (p: string): View | null => {
    const m = p.match(/^\/dashboard\/(?:([a-z]+)|receipt\/([0-9a-f-]{36}))$/);
    if (!m) return null;
    // Links from the donor dashboard this replaced: its pages sit with the giving, its organisations became the switcher.
    const tab = m[1] === "pages" ? "giving" : m[1] === "orgs" ? undefined : m[1];
    if (tab && !(DASH_TABS as readonly string[]).includes(tab)) return null;
    return drop<View>({ name: "dashboard", tab: tab as (typeof DASH_TABS)[number] | undefined, gift: m[2] });
};

/** Routes inside an organisation, given the path after its prefix. Older query-string links (?for=, ?theme=, ?donate) still resolve. */
const orgView = (org: string, rest: string, query: URLSearchParams): View => {
    const seg = clean(rest).split("/").filter(Boolean);
    if (seg.length === 0) return { name: "board", org };
    const [a, b, c] = seg;
    if (a === "live") { const o = liveOpts(seg.slice(1), query); if (o) return drop({ name: "live", org, ...o }); }
    if (a === "overlay") { const o = overlayOpts(seg.slice(1), query); if (o) return drop({ name: "overlay", org, ...o }); }
    if ((a === "give" || a === "donate") && seg.length === 1) return { name: "give", org };
    if (a === "checkout" && seg.length === 1) return { name: "checkout", org };
    if (a === "create" && seg.length === 1) return drop({ name: "create", org, parent: query.get("for") ?? undefined });
    if (a === "admin" && seg.length <= 2) return drop({ name: "admin", org, tab: b });
    if (a === "thanks" && seg.length <= 2) return drop({ name: "thanks", org, ref: b ?? query.get("session_id") ?? query.get("donation") ?? undefined });
    if (a === "embed") {
        if (TYPE_OF[b] && c) { const o = embedOpts(seg.slice(3), query); if (o) return drop({ name: "embed", org, page: { type: TYPE_OF[b], slug: decodeURIComponent(c) }, ...o }); }
        else { const o = embedOpts(seg.slice(1), query); if (o) return drop({ name: "embed", org, ...o }); }
    }
    if (TYPE_OF[a] && b) {
        const page = { type: TYPE_OF[a], slug: decodeURIComponent(b) };
        const more = seg.slice(3);
        if (seg.length === 2) return query.has("donate") ? drop({ name: "page", org, page, sub: "donate", amount: Number(query.get("amount")) || undefined }) : { name: "page", org, page };
        if (c === "manage" && !more.length) return { name: "page", org, page, sub: "manage" };
        if (c === "donate" && more.length <= 1 && (!more[0] || /^\d+(\.\d+)?$/.test(more[0]))) return drop({ name: "page", org, page, sub: "donate", amount: more[0] ? Number(more[0]) : undefined });
        if (c === "give" && !more.length) return { name: "give", org, page };
        if (c === "fundraise" && !more.length) return { name: "create", org, parent: `${a}/${page.slug}` };
        if (c === "live") { const o = liveOpts(more, query); if (o) return drop({ name: "live", org, page, ...o }); }
        if (c === "overlay") { const o = overlayOpts(more, query); if (o) return drop({ name: "overlay", org, page, ...o }); }
        if (c === "embed") { const o = embedOpts(more, query); if (o) return drop({ name: "embed", org, page, ...o }); }
    }
    return { name: "notfound" };
};

export const parse = (path: string, tenant: Tenant, search = ""): View => {
    const p = clean(path); const q = new URLSearchParams(search);
    const dash = tenant.host ? null : dashView(p);
    if (dash) return dash;
    if (tenant.slug) {
        // On a tenant host the platform's own screens still work at their usual paths, except / which is the board and the blog, which lives only on the platform's host.
        if (p !== "/" && p !== "/blog" && STATIC[p]) return STATIC[p];
        return orgView(tenant.slug, p, q);
    }
    if (tenant.host) return orgView(tenant.host, p, q); // slug is resolved from the host by the app; carry the host as the key meanwhile
    if (STATIC[p]) return STATIC[p];
    if (p === "/create") return drop({ name: "create", org: DEMO_SLUG, parent: q.get("for") ?? undefined });
    const real = p.match(/^\/([a-z]{1,2})\/([^/]+)$/);
    if (real && TYPE_OF[real[1]]) return { name: "page", org: DEMO_SLUG, page: { type: TYPE_OF[real[1]], slug: decodeURIComponent(real[2]) }, real: true };
    const post = p.match(/^\/blog\/([a-z0-9-]+)$/);
    if (post) return { name: "post", slug: post[1] };
    const m = p.match(/^\/(demo|o\/([a-z0-9-]+))(\/.*)?$/i);
    if (m) return orgView(m[2] ? m[2].toLowerCase() : DEMO_SLUG, m[3] ?? "/", q);
    return { name: "notfound" };
};

/** The path for a view. On a tenant host org paths have no prefix; the demo org lives at /demo. */
export const pathOf = (v: View, tenant: Tenant): string => {
    const prefix = (org: string) => (tenant.slug || tenant.host ? "" : org === DEMO_SLUG ? "/demo" : `/o/${org}`);
    const pg = (r: PageRef) => `/${PREFIX[r.type]}/${encodeURIComponent(r.slug)}`;
    const opts = (...xs: (string | number | undefined)[]) => xs.filter((x) => x !== undefined && x !== "").map((x) => `/${x}`).join("");
    switch (v.name) {
        case "landing": case "notfound": return "/";
        case "board": return prefix(v.org) || "/";
        case "live": return `${prefix(v.org)}${v.page ? pg(v.page) : ""}/live${opts(v.layout, v.theme)}`;
        case "overlay": return `${prefix(v.org)}${v.page ? pg(v.page) : ""}/overlay${opts(v.style)}`;
        case "give": return `${prefix(v.org)}${v.page ? pg(v.page) : ""}/${v.page ? "give" : "donate"}`;
        case "create": {
            const demo = !tenant.slug && !tenant.host && v.org === DEMO_SLUG; // the demo creates at plain /create
            const [t, slug] = v.parent?.split("/") ?? [];
            if (!demo && t && slug && TYPE_OF[t]) return `${prefix(v.org)}/${t}/${encodeURIComponent(slug)}/fundraise`;
            return `${demo ? "" : prefix(v.org)}/create${v.parent ? `?for=${encodeURIComponent(v.parent)}` : ""}`;
        }
        case "admin": return `${prefix(v.org)}/admin${opts(v.tab)}`;
        case "thanks": return `${prefix(v.org)}/thanks${opts(v.ref)}`;
        case "embed": return `${prefix(v.org)}${v.page ? `${pg(v.page)}/embed` : "/embed"}${opts(v.theme, v.limit)}`;
        case "post": return `/blog/${v.slug}`;
        case "dashboard": return `/dashboard${v.gift ? `/receipt/${v.gift}` : opts(v.tab)}`;
        case "checkout": return v.org ? `${prefix(v.org)}/checkout` : "/checkout";
        case "page": return v.real && !tenant.slug && !tenant.host ? pg(v.page) : `${prefix(v.org)}${pg(v.page)}${opts(v.sub, v.sub === "donate" ? v.amount : undefined)}`;
        default: return `/${v.name}`;
    }
};
