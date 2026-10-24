import { renderToStaticMarkup } from "react-dom/server";
import { AppContext, type AppCtx, makeMoney } from "@/components/outgive/shared";
import { ACTIVITY, DEFAULT_BRAND, SUPPORTERS } from "@/data";
import { type View, parse, pathOf, tenantOf } from "@/lib/route";
import { LEGAL_DRAFT, SITE, metaFor } from "@/seo";
import { Info } from "@/views/Info";
import { LANDING_FAQ, Landing } from "@/views/Landing";
import { Leaderboard } from "@/views/Leaderboard";
import { Pricing } from "@/views/Pricing";

/**
 * Build-time HTML for the pages worth indexing, loaded by scripts/prerender.mjs.
 * The browser still runs the normal app over the top; this exists so crawlers and link previews get real content without running JavaScript.
 */
const noop = () => {};
const tenant = tenantOf("outgive.org");
const ctx: AppCtx = { db: null as never, user: null, tenant, org: null, member: false, isDemo: true, currency: "USD", setCurrency: noop, money: makeMoney("USD"), go: noop, href: (g) => pathOf(parse("/", tenant) && (g as View), tenant), board: SUPPORTERS, activity: ACTIVITY, hall: [], refresh: noop, brand: DEFAULT_BRAND, setBrand: noop, setOrg: noop, me: null, setMe: noop, toast: noop };
ctx.href = (g) => { const v = ("org" in g ? g : { ...g, org: "clearwell" }) as View; return pathOf(v, tenant); };
const SCREENS: [View, () => React.ReactNode][] = [
    [{ name: "landing" }, () => <Landing />],
    [{ name: "board", org: "clearwell" }, () => <Leaderboard />],
    [{ name: "pricing" }, () => <Pricing />],
    [{ name: "about" }, () => <Info kind="about" />],
    [{ name: "rules" }, () => <Info kind="rules" />],
    [{ name: "faq" }, () => <Info kind="faq" />],
    [{ name: "terms" }, () => <Info kind="terms" />],
    [{ name: "privacy" }, () => <Info kind="privacy" />],
];
const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: LANDING_FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
const orgLd = { "@context": "https://schema.org", "@type": "Organization", name: SITE.name, url: SITE.url, logo: `${SITE.url}/favicon.svg` };

export const site = SITE;
export const pages = () => SCREENS.map(([view, el]) => {
    const [title, description] = metaFor(view.name, DEFAULT_BRAND);
    return { path: pathOf(view, tenant), title, description, html: renderToStaticMarkup(<AppContext.Provider value={ctx}>{el()}</AppContext.Provider>), jsonLd: view.name === "landing" ? [orgLd, faqLd] : [], noindex: LEGAL_DRAFT && (view.name === "terms" || view.name === "privacy") };
});
