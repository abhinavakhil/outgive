import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppContext, type Go, makeMoney } from "@/components/outgive/shared";
import { applyBrand } from "@/brand";
import { type Activity, type Brand, DEFAULT_BRAND, PREFIX, type Supporter } from "@/data";
import { type DB, db as loadDb, isDemo } from "@/lib/db";
import { DEMO_SLUG, type Tenant, type View, parse, pathOf, tenantOf } from "@/lib/route";
import { type BoardRow, type Org, type User, toBrand, toSupporter } from "@/lib/types";
import { Admin } from "@/views/Admin";
import { CreateFlow } from "@/views/CreateFlow";
import { Dashboard } from "@/views/Dashboard";
import { Embed } from "@/views/Embed";
import { Info } from "@/views/Info";
import { Leaderboard } from "@/views/Leaderboard";
import { Landing } from "@/views/Landing";
import { LandingB } from "@/views/LandingB";
import { Live, Overlay } from "@/views/Live";
import { Login } from "@/views/Login";
import { NotFound } from "@/views/NotFound";
import { PageScreen, SamplePage } from "@/views/PageScreen";
import { Pricing } from "@/views/Pricing";
import { Start } from "@/views/Start";
import { Thanks } from "@/views/Thanks";
import { LEGAL_DRAFT, SITE, metaFor } from "@/seo";

const load = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; } };
const save = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const orgOf = (v: View) => ("org" in v ? v.org : null);

const Splash = ({ text }: { text: string }) => <div className="flex min-h-dvh items-center justify-center bg-primary text-sm text-tertiary">{text}</div>;

export const App = () => {
    const [tenant, setTenant] = useState<Tenant>(() => tenantOf(window.location.host));
    const [view, setView] = useState<View>(() => parse(window.location.pathname, tenantOf(window.location.host), window.location.search));
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

    useEffect(() => { loadDb().then(setDbi).catch((e) => setDbError(String((e as Error).message ?? e))); }, []);
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
            case "thanks": return "org" in g ? g : { name: "thanks", org: o };
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
        const [title, desc] = metaFor(view.name, brand);
        document.title = title;
        for (const [sel, content] of [['meta[name="description"]', desc], ['meta[property="og:title"]', title], ['meta[property="og:description"]', desc], ['meta[name="twitter:title"]', title], ['meta[name="twitter:description"]', desc]]) document.querySelector(sel)?.setAttribute("content", content);
        const noindex = ["notfound", "dashboard", "admin", "landing-b", "thanks", "login", "overlay", "embed"].includes(view.name) || (LEGAL_DRAFT && (view.name === "terms" || view.name === "privacy"));
        document.querySelector('meta[name="robots"]')?.setAttribute("content", noindex ? "noindex" : "index, follow");
        let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
        canonical.href = (tenant.host ? `https://${tenant.host}` : SITE.url) + pathOf(view, tenant);
    }, [view, brand, tenant]);

    if (dbError) return <Splash text={`Could not start: ${dbError}`} />;
    if (!ctx) return <Splash text={isDemo ? "Starting the demo…" : "Loading…"} />;
    const needsOrg = !!slug;
    const screen = () => {
        if (needsOrg && orgMissing) return <NotFound />;
        if (needsOrg && !org) return <Splash text="Loading…" />;
        switch (view.name) {
            case "landing": return <Landing />;
            case "landing-b": return <LandingB />;
            case "layouts": return <SamplePage />;
            case "pricing": return <Pricing />;
            case "start": return <Start />;
            case "login": return <Login />;
            case "dashboard": return <Dashboard />;
            case "about": case "rules": case "faq": case "terms": case "privacy": return <Info kind={view.name} />;
            case "board": return <Leaderboard />;
            case "live": return <Live pageRef={view.page} />;
            case "overlay": return <Overlay pageRef={view.page} />;
            case "create": return <CreateFlow parent={view.parent} />;
            case "admin": return <Admin tab={view.tab} />;
            case "thanks": return <Thanks />;
            case "page": return <PageScreen key={`${view.page.type}/${view.page.slug}`} pageRef={view.page} manage={view.sub === "manage"} />;
            case "embed": return <Embed pageRef={view.page} />;
            default: return <NotFound />;
        }
    };
    return (
        <AppContext.Provider value={ctx}>
            {screen()}
            {toastMsg && <div role="status" className="fixed bottom-5 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-primary-solid px-4 py-2.5 text-sm font-medium text-white shadow-lg">{toastMsg}</div>}
        </AppContext.Provider>
    );
};
