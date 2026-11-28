/**
 * The hosted checkout that any site embeds (public/embed/v1.js puts it in an iframe), and the page a nightly-gift email links to.
 *   /checkout?embed=1&charity=<org slug>&layout=compact&funds=zakat,sadaqah&addons=cover,alfitr&coverFees=1&source={"qr":"table-6"}
 *   /checkout?schedule=<token>   see the ten nights and cancel the rest in one tap
 * Without a database (the demo) the embed shows the US sample.
 */
import { useEffect, useState } from "react";
import { db, isDemo } from "@/shared/lib/db";
import { Checkout } from "./Checkout";
import { type CheckoutCampaign } from "./model";
import type { Experiment } from "./experiments";
import { type CheckoutSettings, LAYOUT_IDS, type Layout, toSettings, usCampaign, usSample } from "./us";

/** What checkout_settings_public(slug) returns: the organisation, as a donor may see it, and its builder settings. */
interface Public { org: { id: string; slug: string; name: string; legal_name: string; ein: string; address?: string; verified: boolean; raised_cents: number; stripe_account_id: string | null; charges_enabled: boolean }; settings: Partial<CheckoutSettings> | null; experiment?: Experiment | null; weekly?: boolean }
type Loaded = { c: CheckoutCampaign; layout: Layout; live?: { org_id: string; stripeAccount: string } };

/**
 * A US organisation's checkout as donors see it: its builder settings (overridden by `q` where allowed), its verified legal name and
 * EIN, its running A/B test, and its Stripe account when it can take payments. The US sample without a database, or for an unknown slug.
 */
export const usePublicCampaign = (slug: string, q: URLSearchParams = new URLSearchParams()) => {
    const [state, setState] = useState<Loaded | null>(null);
    useEffect(() => {
        const sample = () => { const s = embedSettings(null, q); setState({ c: usSample(s), layout: s.layout }); };
        if (isDemo || !/^[a-z0-9-]{1,40}$/.test(slug)) return sample();
        db().then((d) => d.rpc<Public | null>("checkout_settings_public", { slug })).then((r) => {
            if (!r) return sample();
            const s = embedSettings(r.settings, q), o = r.org;
            const c = { ...usCampaign({ id: `org/${o.slug}`, name: o.name, legalName: o.legal_name, ein: o.ein, verifiedAt: o.verified ? new Date().toISOString() : null, raised: o.raised_cents / 100 }, { ...s, daf_address: s.daf_address || o.address || "" }), experiment: r.experiment ?? null, weekly: !!r.weekly };
            setState({ c, layout: s.layout, live: o.stripe_account_id && o.charges_enabled ? { org_id: o.id, stripeAccount: o.stripe_account_id } : undefined });
        }).catch(sample);
    }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps
    return state;
};

/** The host's choices override the saved settings, but only with known values: a page cannot invent an add-on or a fund. */
export const embedSettings = (saved: Partial<CheckoutSettings> | null | undefined, q: URLSearchParams): CheckoutSettings => {
    const s = toSettings(saved), list = (k: string) => q.get(k)?.split(",").map((x) => x.trim()).filter(Boolean);
    const merged = toSettings({ ...s, ...(q.get("layout") ? { layout: q.get("layout") } : {}), ...(list("funds") ? { funds: list("funds") } : {}), ...(list("addons") ? { addons: list("addons") } : {}), ...(q.has("coverFees") ? { cover_default: q.get("coverFees") === "1" || q.get("coverFees") === "true" } : {}) });
    // More than three on the gift screen from a host's query: keep the saved ones.
    return merged.addons.filter((a) => !["nights", "monthly", "cover"].includes(a)).length > 3 ? { ...merged, addons: s.addons } : merged;
};
/** source={"qr":"table-6"} from the loader: short string values only. */
const sourceOf = (q: URLSearchParams): Record<string, string> | undefined => {
    try {
        const o = JSON.parse(q.get("source") ?? "null") as Record<string, unknown> | null;
        if (!o || typeof o !== "object") return undefined;
        const out = Object.fromEntries(Object.entries(o).filter(([k, v]) => /^[a-z_]{1,24}$/i.test(k) && (typeof v === "string" || typeof v === "number")).slice(0, 8).map(([k, v]) => [k, String(v).slice(0, 80)]));
        return Object.keys(out).length ? out : undefined;
    } catch { return undefined; }
};

export const EmbedCheckout = () => {
    const q = new URLSearchParams(location.search), slug = (q.get("charity") ?? "").toLowerCase();
    const state = usePublicCampaign(slug, q);
    useEffect(() => { document.documentElement.classList.add("ck-preview"); document.body.style.background = "transparent"; }, []);
    // Tell the loader how tall the checkout is, so the iframe never scrolls inside the host page.
    useEffect(() => {
        if (window.parent === window) return;
        // The checkout's own height (it can shrink, e.g. after paying), not the document's, which never goes below the iframe.
        const el = () => document.querySelector<HTMLElement>(".ck") ?? document.body;
        const post = () => window.parent.postMessage({ type: "outgive:height", height: Math.ceil(el().getBoundingClientRect().height) }, "*");
        const ro = new ResizeObserver(post); ro.observe(document.body); ro.observe(el()); post();
        const mo = new MutationObserver(() => { ro.observe(el()); post(); }); mo.observe(document.body, { childList: true, subtree: true });
        return () => { ro.disconnect(); mo.disconnect(); };
    }, [state]);
    if (!state) return null;
    return <Checkout campaign={state.c} layout={LAYOUT_IDS.includes(state.layout) ? state.layout : "compact"} live={state.live} source={sourceOf(q)} brand={state.c.charity} />;
};

/** What gift_schedule_get(token) returns. */
interface Sched { org_name: string; fund: string; currency: string; per_night_cents: number; odd: boolean; status: "active" | "cancelled" | "completed"; charges: { night: number; date: string; status: string; amount_cents: number }[] }
const usd = (cents: number, cur = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(cents / 100);

/** The link in every nightly email: the schedule, and one tap to cancel the nights still to come. */
export const ScheduleManage = ({ token }: { token: string }) => {
    const [s, setS] = useState<Sched | null | "missing">(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => { db().then((d) => d.rpc<Sched | null>("gift_schedule_get", { t: token })).then((r) => setS(r ?? "missing")).catch(() => setS("missing")); }, [token]);
    const cancel = async () => {
        setBusy(true);
        try { await (await db()).rpc("gift_schedule_cancel", { t: token }); setS((o) => (o && o !== "missing" ? { ...o, status: "cancelled", charges: o.charges.map((c) => (c.status === "due" ? { ...c, status: "cancelled" } : c)) } : o)); } finally { setBusy(false); }
    };
    return (
        <div className="ck cs">
            <main className="cs-card" style={{ marginTop: 40 }}>
                {s === null ? <p className="cs-sub">Loading your nights…</p> : s === "missing" ? <p className="cs-sub">That link has expired or is not right. Reply to any of our emails and we will sort it out.</p> : (
                    <div className="cs-stack">
                        <span className="cs-tag cs-tag-ok">{s.status === "active" ? "Scheduled" : s.status === "cancelled" ? "Cancelled" : "Complete"}</span>
                        <h1 className="cs-h1 cs-h1-sm">Your ten nights with {s.org_name}</h1>
                        <dl className="cs-lines">{s.charges.map((c) => <div key={c.night}><dt>Night {c.night}, {new Date(`${c.date}T12:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "long", timeZone: "UTC" })}</dt><dd>{usd(c.amount_cents, s.currency)} · {c.status === "succeeded" ? "given" : c.status === "due" ? "to come" : c.status}</dd></div>)}</dl>
                        {s.status === "active" ? <button type="button" disabled={busy} onClick={cancel} className="cs-btn cs-black">Cancel the nights still to come</button> : <p className="cs-sub">Nothing more will be taken.</p>}
                    </div>
                )}
            </main>
        </div>
    );
};
