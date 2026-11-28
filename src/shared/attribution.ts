/**
 * Where a gift came from, read once per browser session, plus the checkout funnel and the opt-in ad pixels.
 *
 * For the checkout (src/features/checkout):
 *   attribution()                     the session's first-touch tags (UTM, ad click id, QR, fundraiser, team, night, event, referrer,
 *                                     device, channel). Read from the URL + referrer the first time it is called in a session, then cached.
 *   giftTags({ layout, addons, ... }) everything to send as `tags` on the pay function's start call. Adds `seconds` since checkout_started.
 *   funnelStep(orgId, step, layout)   records a funnel step (visit, checkout_started, amount_chosen, payment_attempted, paid). Fire and
 *                                     forget; each step counts once per session. Does nothing in demo mode.
 *   trackDonation(ads, cents, cur)    after a paid gift: a bare donation event (value + currency, nothing else: never fund, zakat
 *                                     status or donor details) to GA4 and/or Meta. `ads` is revenue_ads(org) and is null unless the
 *                                     charity opted in, so passing it through is always safe.
 * URL parameters read: utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid / fbclid / msclkid / ttclid, qr (a screen,
 * poster or table id, e.g. ?qr=table-6), fundraiser (or ref), team, night (1-30), event.
 * Every value is cut to 200 characters here and cleaned again by the database (revenue_tags_clean).
 */
import { db, isDemo } from "@/shared/lib/db";

export type Channel = "Live night QR" | "Fundraiser pages" | "Email" | "Meta ads" | "Google ads" | "WhatsApp shares" | "Social" | "Search" | "Referral" | "Other campaigns" | "Website direct";
export type Device = "mobile" | "tablet" | "desktop";
export type FunnelStep = "visit" | "checkout_started" | "amount_chosen" | "payment_attempted" | "paid";

export interface Attribution {
    /** Random id for this browser session; links funnel steps to the gift. */
    session: string;
    channel: Channel;
    device: Device;
    utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string;
    /** Origin and path only: a referrer's query string can carry other people's data. */
    referrer?: string;
    /** Path of the first page of the session. */
    landing?: string;
    click_id?: string; click_type?: "gclid" | "fbclid" | "msclkid" | "ttclid";
    qr?: string; fundraiser?: string; team?: string; night?: number; event?: string;
}

/** What the checkout knows about the gift itself. addons: key -> cents (0 for free ones like a dedication); addons_shown: keys offered. */
export interface GiftFacts {
    layout?: string; campaign?: string; rhythm?: "once" | "monthly" | "yearly" | "nightly";
    addons?: Record<string, number>; addons_shown?: string[];
    state?: string; zip?: string; consent?: Record<string, boolean>;
}
export type GiftTags = Attribution & GiftFacts & { seconds?: number };

const cut = (s: string | null | undefined) => (s ? s.trim().slice(0, 200) || undefined : undefined);
const lower = (s?: string) => s?.toLowerCase() ?? "";

/** Groups a gift's tags into one channel. The same rules name the channel of every stored gift, so keep them here only. */
export const channelOf = (t: Partial<Attribution>): Channel => {
    const src = lower(t.utm_source), med = lower(t.utm_medium), ref = lower(t.referrer);
    const paid = /(^|_|-)(cpc|ppc|paid|ads?|paid_?social|display|cpm)($|_|-)/.test(med);
    if (t.qr) return "Live night QR";
    if (t.fundraiser || t.team) return "Fundraiser pages";
    if (med === "email" || /newsletter|mailchimp|klaviyo|constantcontact|^email$/.test(src)) return "Email";
    if (t.click_type === "fbclid" || (paid && /facebook|^fb$|instagram|^ig$|meta/.test(src))) return "Meta ads";
    if (t.click_type === "gclid" || (paid && /google|youtube/.test(src))) return "Google ads";
    if (/whatsapp/.test(src) || /wa\.me|whatsapp/.test(ref)) return "WhatsApp shares";
    if (/facebook|^fb$|instagram|^ig$|twitter|^x$|tiktok|linkedin|threads/.test(src) || /facebook\.com|instagram\.com|t\.co\/|twitter\.com|x\.com|tiktok\.com|linkedin\.com/.test(ref)) return "Social";
    if (t.utm_source || t.utm_campaign || t.click_id) return "Other campaigns";
    if (/google\.|bing\.com|duckduckgo|yahoo\.|ecosia/.test(ref)) return "Search";
    if (t.referrer) return "Referral";
    return "Website direct";
};

export const deviceOf = (ua: string, width = 1024): Device =>
    /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? "tablet" : /mobi|iphone|android/i.test(ua) || width < 640 ? "mobile" : "desktop";

const sessionId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 32);

/** Pure: the tags for a landing URL, referrer and browser. `self` is our own origin, so internal navigation is not a referrer. */
export const readAttribution = (url: string, referrer: string, ua: string, width?: number, session = sessionId()): Attribution => {
    const u = new URL(url), p = u.searchParams, get = (k: string) => cut(p.get(k));
    let ref: string | undefined;
    try { const r = new URL(referrer); if (r.origin !== u.origin) ref = cut(r.origin + r.pathname); } catch { /* no referrer */ }
    const click = (["gclid", "fbclid", "msclkid", "ttclid"] as const).find((k) => p.get(k));
    const night = Number(p.get("night"));
    const a: Attribution = {
        session, channel: "Website direct", device: deviceOf(ua, width), referrer: ref, landing: cut(u.pathname),
        utm_source: get("utm_source"), utm_medium: get("utm_medium"), utm_campaign: get("utm_campaign"), utm_content: get("utm_content"), utm_term: get("utm_term"),
        click_id: click ? cut(p.get(click)) : undefined, click_type: click,
        qr: get("qr"), fundraiser: get("fundraiser") ?? get("ref"), team: get("team"), event: get("event"),
        night: Number.isInteger(night) && night >= 1 && night <= 30 ? night : undefined,
    };
    for (const k of Object.keys(a) as (keyof Attribution)[]) if (a[k] === undefined) delete a[k];
    return { ...a, channel: channelOf(a) };
};

const KEY = "og_attr", STARTED = "og_attr_started";
const store = () => { try { return sessionStorage; } catch { return null; } };
let memo: Attribution | null = null;

/** The session's first-touch tags. Safe to call often. */
export const attribution = (): Attribution => {
    if (memo) return memo;
    const s = store();
    try { const saved = s?.getItem(KEY); if (saved) return (memo = JSON.parse(saved) as Attribution); } catch { /* read fresh */ }
    memo = readAttribution(location.href, document.referrer, navigator.userAgent, innerWidth);
    try { s?.setItem(KEY, JSON.stringify(memo)); } catch { /* private mode: lives in memory */ }
    return memo;
};

/** The tags for the pay function's start call: `tags: giftTags({ layout, addons, addons_shown, rhythm, campaign })`. */
export const giftTags = (facts: GiftFacts = {}): GiftTags => {
    const started = Number(store()?.getItem(STARTED) ?? 0);
    return { ...attribution(), ...facts, ...(started ? { seconds: Math.min(86400, Math.round((Date.now() - started) / 1000)) } : {}) };
};

/** Records a funnel step for this session. Never throws, never blocks the checkout. */
export const funnelStep = (orgId: string, step: FunnelStep, layout?: string) => {
    if (step === "checkout_started") try { if (!store()?.getItem(STARTED)) store()?.setItem(STARTED, String(Date.now())); } catch { /* no timing */ }
    if (isDemo || !orgId) return;
    const a = attribution();
    const tags = { channel: a.channel, device: a.device, layout, utm_source: a.utm_source, utm_campaign: a.utm_campaign, qr: a.qr, fundraiser: a.fundraiser, team: a.team };
    void db().then((d) => d.rpc("funnel_track", { org: orgId, session_id: a.session, step, tags })).catch(() => {});
};

export type Ads = { ga4?: string; meta?: string } | null;
type W = Window & { gtag?: (...a: unknown[]) => void; dataLayer?: unknown[]; fbq?: ((...a: unknown[]) => void) & { queue?: unknown[] } };
const script = (src: string) => { const s = document.createElement("script"); s.async = true; s.src = src; document.head.appendChild(s); };

/** The bare donation event: value and currency only. Loads gtag.js / fbevents.js with the charity's ids if the page has neither. */
export const trackDonation = (ads: Ads, cents: number, currency: string) => {
    if (!ads || typeof window === "undefined") return;
    const w = window as W, value = Math.round(cents) / 100;
    if (ads.ga4) {
        if (!w.gtag) {
            w.dataLayer = w.dataLayer ?? [];
            w.gtag = function () { w.dataLayer!.push(arguments); };   // gtag.js reads the arguments object itself
            w.gtag("js", new Date()); w.gtag("config", ads.ga4, { send_page_view: false });
            script(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ads.ga4)}`);
        }
        w.gtag("event", "donation", { value, currency });
    }
    if (ads.meta) {
        if (!w.fbq) {
            // Meta's own stub: calls queue until fbevents.js loads and sets callMethod.
            const f = Object.assign((...a: unknown[]) => { if (f.callMethod) f.callMethod(...a); else f.queue.push(a); }, { queue: [] as unknown[], loaded: true, version: "2.0", callMethod: undefined as undefined | ((...a: unknown[]) => void), push: undefined as unknown });
            f.push = f; w.fbq = f;
            w.fbq("init", ads.meta);
            script("https://connect.facebook.net/en_US/fbevents.js");
        }
        w.fbq("track", "Donate", { value, currency });
    }
};
