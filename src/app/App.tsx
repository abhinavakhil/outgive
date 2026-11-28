import { Spinner } from "@/shared/ui";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppContext, type Go, makeMoney } from "@/shared/lib/app-context";
import { applyBrand } from "@/shared/lib/brand";
import { type Activity, type Brand, DEFAULT_BRAND, PREFIX, type Supporter } from "@/shared/domain/model";
import { type DB, db as loadDb, isDemo } from "@/shared/lib/db";
import { DEMO_SLUG, type Tenant, type View, parse, pathOf, tenantOf } from "@/shared/lib/route";
import { type BoardRow, type Org, type User, toBrand, toSupporter } from "@/shared/domain/types";
import { ComingSoon, ComingSoonGate, LandingV2, Ramadan } from "@/features/launch";
import { screenFor } from "@/app/routes";
import { LEGAL_DRAFT, SITE, metaFor, setMeta } from "@/shared/lib/seo";
import { DASH_BG, dashDark } from "@/shared/lib/dash-theme";

const load = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; } };
const save = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const orgOf = (v: View) => ("org" in v ? v.org : null);

/** Every page is open. Set VITE_LAUNCHED=false at build time to put the "Coming soon" gate back on every path except local dev. */
/**
 * Open for now: the landing page, the charity's Ramadan page and its donate flow, and the sample leaderboard. Every other screen
 * shows "Coming soon" and is kept out of search. Set VITE_ALL_PAGES=true to open everything again (local work on other screens).
 */
const ALL_PAGES = import.meta.env.VITE_ALL_PAGES === "true";
const isOpen = (v: View) => ALL_PAGES || v.name === "landing" || v.name === "blog" || v.name === "post" || v.name === "ramadhan" || v.name === "ramadhan-give" || v.name === "ramadhan-login" || v.name === "ramadhan-account" || v.name === "ramadhan-team" || v.name === "pledge" || v.name === "host" || v.name === "impact-report" || v.name === "unsubscribe" || (v.name === "board" && v.org === DEMO_SLUG && location.pathname.startsWith("/leaderboard"))
    // The charity back office is signed-in only and still being built: open in local dev, behind the gate on the live site.
    || v.name === "zakat-calculator" || v.name === "zakat-embed"
    || (v.name === "engage" && import.meta.env.DEV);

const LOCAL = import.meta.env.VITE_LAUNCHED !== "false" || import.meta.env.DEV || /^(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.)/.test(window.location.hostname);

/** What the build put in #root for this path, read before React replaces it. */
const PRERENDERED = document.getElementById("root")?.innerHTML ?? "";

/** On /dashboard the splash wears the dashboard's own page colour, so nothing flashes before its chunk arrives. */
/** While the app or a screen loads: a spinner on the screen's own background (the dashboard keeps its theme). */
const Splash = ({ text }: { text: string }) => <div className="flex min-h-dvh items-center justify-center bg-primary" style={window.location.pathname.startsWith("/dashboard") ? { background: DASH_BG[dashDark() ? "dark" : "light"] } : undefined}><Spinner label={text} /></div>;

export const App = () => {
    const [tenant, setTenant] = useState<Tenant>(() => tenantOf(window.location.host));
    const [view, setView] = useState<View>(() => {
        const t = tenantOf(window.location.host), v = parse(window.location.pathname, t, window.location.search);
        if (v.name === "create" || v.name === "board") { const to = pathOf(v, t); if (to !== window.location.pathname + window.location.search) try { window.history.replaceState(null, "", to); } catch { /* history unavailable */ } }
        return v;
    });
    const [dbi, setDbi] = useState<DB | null>(null);
    const [dbError, setDbError] = useState("");
    const [user, setUser] = useState<User | null>(null);
    const [org, setOrgState] = useState<Org | null>(null);
    const [orgMissing, setOrgMissing] = useState(false);
    const [member, setMember] = useState(false);
    const [board, setBoard] = useState<Supporter[]>([]);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [hall, setHall] = useState<[string, string, number][]>([]);
    const [currency, setCurrencyState] = useState(() => load("outgive.currency", "USD"));
    const [preview, setPreview] = useState<Brand | null>(null);
    const [me, setMeState] = useState<string | null>(null);
    const [toastMsg, setToastMsg] = useState("");
    const orgRef = useRef<Org | null>(null);

    // Before launch the live site only shows the coming-soon screens, which need no data, so it never loads the database.
    useEffect(() => { if (!LOCAL) return; loadDb().then(setDbi).catch((e) => setDbError(String((e as Error).message ?? e))); }, []);
    useEffect(() => { if (!dbi) return; dbi.user().then(setUser); return dbi.onAuth(setUser); }, [dbi]);
    useEffect(() => {
        const onPop = () => setView(parse(window.location.pathname, tenant, window.location.search));
        window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop);
    }, [tenant]);

    const slug = orgOf(view);
    /** Load the organisation for the screen: by slug, or by host on a custom domain. */
    useEffect(() => {
        if (!dbi || !slug) { setOrgState(null); setOrgMissing(false); return; }
        if (orgRef.current && (orgRef.current.slug === slug || orgRef.current.custom_domain === slug)) return;
        let live = true;
        const q = tenant.host && slug === tenant.host ? dbi.rpc<Org[]>("org_by_host", { h: slug }) : dbi.rpc<Org[]>("org_by_slug", { s: slug });
        q.then((rows) => { if (!live) return; const o = rows[0] ?? null; orgRef.current = o; setOrgState(o); setOrgMissing(!o); if (o && tenant.host) setTenant({ slug: o.slug, host: tenant.host }); }).catch(() => { if (live) { setOrgState(null); setOrgMissing(true); } });
        return () => { live = false; };
    }, [dbi, slug, tenant.host]);
    const setOrg = useCallback((o: Org) => { orgRef.current = o; setOrgState(o); }, []);
    useEffect(() => { if (!dbi || !org || !user) { setMember(false); return; } dbi.rpc<boolean>("is_member", { org: org.id }).then(setMember).catch(() => setMember(false)); }, [dbi, org, user]);
    useEffect(() => { if (!org) return; setMeState(load(`outgive.me.${org.id}`, null)); setPreview(null); }, [org]);
    const setMe = useCallback((id: string | null) => { setMeState(id); if (org) save(`outgive.me.${org.id}`, id); }, [org]);

    const refresh = useCallback(() => {
        if (!dbi || !org) return;
        Promise.all([dbi.rpc<BoardRow[]>("board", { org: org.id }), dbi.rpc<{ who: string; usd: string; at: string }[]>("activity", { org: org.id, n: 20 }), dbi.rpc<{ week_of: string; name: string; usd: string }[]>("hall_of_fame", { org: org.id })])
            .then(([b, a, h]) => { setBoard(b.map(toSupporter)); setActivity(a.map((x) => ({ who: x.who, usd: Number(x.usd), at: new Date(x.at).getTime() }))); setHall(h.map((x) => [new Date(x.week_of).toLocaleDateString("en", { day: "numeric", month: "short" }), x.name, Number(x.usd)])); })
            .catch((e) => console.error(e));
    }, [dbi, org]);
    useEffect(() => { refresh(); }, [refresh]);
    useEffect(() => {
        if (!dbi || !org) return;
        let t: ReturnType<typeof setTimeout>;
        const offD = dbi.onDonations(org.id, () => { clearTimeout(t); t = setTimeout(refresh, 400); });
        const offO = dbi.onOrg(org.id, (o) => setOrg(o));
        return () => { offD(); offO(); clearTimeout(t); };
    }, [dbi, org, refresh, setOrg]);

    const brand = useMemo(() => preview ?? (org ? toBrand(org) : DEFAULT_BRAND), [preview, org]);
    useEffect(() => { applyBrand(brand); }, [brand]);
    const setCurrency = useCallback((c: string) => { setCurrencyState(c); save("outgive.currency", c); }, []);
    useEffect(() => { if (!toastMsg) return; const id = setTimeout(() => setToastMsg(""), 4000); return () => clearTimeout(id); }, [toastMsg]);

    /** Short navigation targets resolve against the organisation on screen, or the demo. */
    const full = useCallback((g: Go): View => {
        const o = slug ?? DEMO_SLUG;
        switch (g.name) {
            case "home": return { name: "board", org: o };
            case "create": return "org" in g ? g : { name: "create", org: o, parent: g.parent };
            case "page": if ("key" in g) { const [p, s] = g.key.split("/"); const type = (Object.keys(PREFIX) as (keyof typeof PREFIX)[]).find((t) => PREFIX[t] === p)!; return { name: "page", org: o, page: { type, slug: s } }; } return g;
            case "admin": return "org" in g ? g : { name: "admin", org: o, tab: g.tab };
            case "live": return "org" in g ? g : { name: "live", org: o };
            case "overlay": return "org" in g ? g : { name: "overlay", org: o };
            case "give": return "org" in g ? g : { name: "give", org: o, page: g.page };
            case "thanks": return "org" in g ? g : { name: "thanks", org: o, ref: g.ref };
            default: return g;
        }
    }, [slug]);
    const href = useCallback((g: Go) => pathOf(full(g), tenant), [full, tenant]);
    const go = useCallback((g: Go) => {
        const v = full(g); setView(v);
        try { window.history.pushState(null, "", pathOf(v, tenant)); } catch { /* history unavailable */ }
        window.scrollTo(0, 0);
    }, [full, tenant]);

    const ctx = useMemo(() => dbi && ({ db: dbi, user, tenant, org, member, isDemo, currency, setCurrency, money: makeMoney(currency), go, href, board, activity, hall, refresh, brand, setBrand: setPreview, setOrg, me, setMe, toast: setToastMsg }), [dbi, user, tenant, org, member, currency, setCurrency, go, href, board, activity, hall, refresh, brand, setOrg, me, setMe]);

    /** Title, description and canonical follow the screen, so shared links and search results describe what is on it. */
    useEffect(() => {
        // A blog post (from its article, in the blog's chunk) and a real campaign page set their own title.
        if (view.name !== "post" && view.name !== "checkout" && !(view.name === "page" && view.real)) setMeta(...metaFor(view.name, brand));
        const noindex = !isOpen(view) || ["legacy", "checkout", "notfound", "ui", "ui-variants", "dashboard", "admin", "landing-b", "v2", "ramadan", "ramadhan-edit", "ramadhan-give", "ramadhan-login", "ramadhan-account", "ramadhan-team", "pledge", "host", "impact-report", "unsubscribe", "engage", "thanks", "login", "overlay", "embed", "zakat-embed"].includes(view.name) || (view.name === "board" && !!view.skin) || (LEGAL_DRAFT && (view.name === "terms" || view.name === "privacy"));
        document.querySelector('meta[name="robots"]')?.setAttribute("content", noindex ? "noindex" : "index, follow");
        let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
        canonical.href = (tenant.host ? `https://${tenant.host}` : SITE.url) + pathOf(view, tenant);
    }, [view, brand, tenant]);

    // The coming-soon screens need no data, so they render at once instead of waiting for the database.
    if (view.name === "landing") return <LandingV2 />;
    if (!isOpen(view)) return <ComingSoonGate />;
    if (view.name === "ramadan") return <Ramadan />;
    if (view.name === "legacy") return <ComingSoon />;
    // The blog needs no data either. While its chunk loads, the prerendered article stays on screen instead of a blank page.
    if (view.name === "blog" || view.name === "post" || view.name === "zakat-calculator" || view.name === "zakat-embed") return <Suspense fallback={<div className="contents" dangerouslySetInnerHTML={{ __html: PRERENDERED }} />}>{screenFor(view)}</Suspense>;
    if (!LOCAL) return <ComingSoonGate />;
    // The checkout brings its own data and look, so it does not wait for the demo database.
    if (view.name === "checkout" && !view.org) return <Suspense fallback={<Splash text="Loading" />}>{screenFor(view)}</Suspense>;
    if (dbError) return <Splash text={`Could not start: ${dbError}`} />;
    if (!ctx) return <Splash text="Loading" />;
    const needsOrg = !!slug;
    const screen = () => {
        if (needsOrg && !orgMissing && !org) return <Splash text="Loading" />;
        return <Suspense fallback={<Splash text="Loading" />}>{screenFor(needsOrg && orgMissing ? { name: "notfound" } : view)}</Suspense>;
    };
    return (
        <AppContext.Provider value={ctx}>
            {screen()}
            {toastMsg && <div role="status" className="fixed bottom-5 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-primary-solid px-4 py-2.5 text-sm font-medium text-white shadow-lg">{toastMsg}</div>}
        </AppContext.Provider>
    );
};
