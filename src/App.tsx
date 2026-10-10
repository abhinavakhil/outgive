import { useCallback, useEffect, useMemo, useState } from "react";
import { AppContext, type View, makeMoney, typeOf } from "@/components/outgive/shared";
import { applyBrand } from "@/brand";
import { ACTIVITY, type Activity, type Brand, DEFAULT_BRAND, type Donation, PREFIX, type PageData, type PageUpdate, REGIONS, REGION_OF, SAMPLE_PAGE, SUPPORTERS, type Supporter, pageKey } from "@/data";
import { CampaignPage } from "@/views/CampaignPage";
import { CreateFlow } from "@/views/CreateFlow";
import { Info } from "@/views/Info";
import { Leaderboard } from "@/views/Leaderboard";
import { NotFound } from "@/views/NotFound";

const STORE = "outgive.pages";
const PAGE_PATH = new RegExp(`^/(${Object.values(PREFIX).join("|")})/([^/]+)$`);
const STATIC: Record<string, View> = { "/": { name: "home" }, "/create": { name: "create" }, "/about": { name: "about" }, "/rules": { name: "rules" }, "/faq": { name: "faq" }, "/layouts": { name: "page" } };
const parse = (path: string): View => {
    const clean = path.length > 1 ? path.replace(/\/$/, "") : path;
    const m = clean.match(PAGE_PATH);
    return STATIC[clean] ?? (m ? { name: "page", key: `${m[1]}/${decodeURIComponent(m[2])}` } : { name: "notfound" });
};
const toPath = (v: View) => (v.name === "home" ? "/" : v.name === "page" ? (v.key ? `/${v.key}` : "/layouts") : v.name === "notfound" ? "/" : `/${v.name}`);

const load = <T,>(key: string, fallback: T): T => {
    try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
};

export const App = () => {
    const [view, setView] = useState<View>(() => parse(window.location.pathname));
    const [currency, setCurrency] = useState("USD");
    const [pages, setPages] = useState<Record<string, PageData>>(() => load(STORE, {}));
    const [board, setBoard] = useState<Supporter[]>(() => load("outgive.board", SUPPORTERS));
    const [activity, setActivity] = useState<Activity[]>(() => load("outgive.activity", ACTIVITY));
    const [brand, setBrandState] = useState<Brand>(() => ({ ...DEFAULT_BRAND, ...load("outgive.brand", {}) }));
    const setBrand = useCallback((b: Brand) => {
        setBrandState(b); applyBrand(b);
        try { localStorage.setItem("outgive.brand", JSON.stringify(b)); } catch { /* a big logo can exceed the quota: brand lasts until reload */ }
    }, []);
    useEffect(() => { applyBrand(brand); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const onPop = () => setView(parse(window.location.pathname));
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);
    useEffect(() => {
        try { localStorage.setItem(STORE, JSON.stringify(pages)); } catch { /* storage full or unavailable: pages last until reload */ }
    }, [pages]);
    useEffect(() => {
        try { localStorage.setItem("outgive.board", JSON.stringify(board)); localStorage.setItem("outgive.activity", JSON.stringify(activity.slice(0, 30))); } catch { /* storage full or unavailable */ }
    }, [board, activity]);
    useEffect(() => { document.title = view.name === "page" ? `${brand.name}. Fundraising page` : `${brand.name}. Leaderboard`; }, [view, brand.name]);

    const go = useCallback((v: View) => {
        setView(v);
        try { window.history.pushState(null, "", toPath(v)); } catch { /* history unavailable */ }
        window.scrollTo(0, 0);
    }, []);
    const ctx = useMemo(() => ({ currency, setCurrency, go, money: makeMoney(currency), board, setBoard, activity, setActivity, brand, setBrand }), [currency, go, board, activity, brand, setBrand]);

    /** Saves a new page under a free URL and returns its key. */
    const publish = (p: PageData) => {
        let slug = p.slug || "page"; let n = 2;
        while (pages[pageKey({ ...p, slug })] || pageKey({ ...p, slug }) === pageKey(SAMPLE_PAGE)) slug = `${p.slug}-${n++}`;
        const next = { ...p, slug };
        setPages((all) => ({ ...all, [pageKey(next)]: next }));
        return pageKey(next);
    };
    const save = (key: string, p: PageData) => { if (!p.isSample) setPages((all) => ({ ...all, [key]: p })); else setSample(p); };
    const [sample, setSample] = useState<PageData>(SAMPLE_PAGE);
    const give = (key: string, d: Donation) => {
        const bump = (p: PageData): PageData => ({ ...p, raised: p.raised + d.usd, supporters: p.supporters + 1, donations: [d, ...p.donations] });
        const target = key === pageKey(SAMPLE_PAGE) ? sample : pages[key];
        if (key === pageKey(SAMPLE_PAGE)) setSample(bump);
        else setPages((all) => (all[key] ? { ...all, [key]: bump(all[key]) } : all));
        if (target && target.title.trim()) credit(target, d.usd);
    };
    /** A gift on a page counts toward that page's rank on the charity's board; a page that isn't listed yet is added. */
    const credit = (p: PageData, usd: number) => {
        const name = p.title.trim();
        setBoard((all) => all.some((c) => c.name.toLowerCase() === name.toLowerCase())
            ? all.map((c) => (c.name.toLowerCase() === name.toLowerCase() ? { ...c, total: c.total + usd, today: c.today + usd } : c))
            : [...all, { id: Date.now(), name, tagline: typeOf(p).label + " page", kind: p.type === "team" ? "Teams" : "Individuals", region: REGION_OF[p.country] ?? REGIONS[0], country: p.country, page: "/" + pageKey(p), total: usd, today: usd, visits: 0, days: 0 }]);
        setActivity((a) => [{ who: name, usd, at: Date.now() }, ...a]);
    };

    const addUpdate = (key: string, u: PageUpdate) => {
        const add = (p: PageData): PageData => ({ ...p, updates: [u, ...p.updates] });
        if (key === pageKey(SAMPLE_PAGE)) setSample(add);
        else setPages((all) => (all[key] ? { ...all, [key]: add(all[key]) } : all));
    };

    const key = view.name === "page" ? (view.key ?? pageKey(SAMPLE_PAGE)) : "";
    const page = key === pageKey(SAMPLE_PAGE) ? sample : pages[key];

    return (
        <AppContext.Provider value={ctx}>
            {view.name === "home" && <Leaderboard />}
            {view.name === "create" && <CreateFlow onPublish={publish} />}
            {view.name === "page" && (page ? <CampaignPage pageKey={key} page={page} setPage={(p) => save(key, p)} give={(d) => give(key, d)} addUpdate={(u) => addUpdate(key, u)} /> : <NotFound />)}
            {view.name === "notfound" && <NotFound />}
            {(view.name === "about" || view.name === "rules" || view.name === "faq") && <Info kind={view.name} />}
        </AppContext.Provider>
    );
};
