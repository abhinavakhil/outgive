import { ANALYTICS } from "@/shared/lib/seo";

/**
 * Umami: open-source (MIT), cookieless page analytics. It sets no cookies and builds no visitor profiles, so it needs no consent banner in most places.
 * Nothing loads until ANALYTICS.websiteId is set in seo.ts. Page views, including in-app navigation, are recorded by the script itself.
 */
declare global { interface Window { umami?: { track: (event: string, data?: Record<string, string | number>) => void } } }

export const initAnalytics = () => {
    if (!ANALYTICS.websiteId || document.querySelector("script[data-website-id]")) return;
    const s = document.createElement("script");
    s.defer = true; s.src = ANALYTICS.src;
    s.dataset.websiteId = ANALYTICS.websiteId;
    s.dataset.doNotTrack = "true"; // honour the browser's Do Not Track setting
    document.head.appendChild(s);
};

export type TrackData = Record<string, string | number>;
/** Every event sent this visit, newest last, for the dev panel and browser tests. */
export const sent: { event: string; data?: TrackData; at: number }[] = [];
if (import.meta.env.DEV) (window as unknown as { __events: typeof sent }).__events = sent;
const listeners = new Set<() => void>();
export const onTrack = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** A named event with a few plain facts. Never pass names, emails or anything else that identifies a person. */
export const track = (event: string, data?: TrackData) => {
    sent.push({ event, data, at: Date.now() }); if (sent.length > 200) sent.shift();
    listeners.forEach((fn) => fn());
    if (import.meta.env.DEV) console.info("[analytics]", event, data ?? "");
    // The home page embeds a live donate page as a preview; its clicks are not real donors, so they stay out of the numbers.
    if (new URLSearchParams(location.search).has("preview")) return;
    try { window.umami?.track(event, data); } catch { /* analytics must never break the page */ }
};
