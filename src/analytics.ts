import { ANALYTICS } from "@/seo";

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

/** A named event with a few plain facts. Never pass names, emails or anything else that identifies a person. */
export const track = (event: string, data?: Record<string, string | number>) => { try { window.umami?.track(event, data); } catch { /* analytics must never break the page */ } };
