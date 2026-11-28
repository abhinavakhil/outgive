import { renderToStaticMarkup } from "react-dom/server";
import { AppContext, type AppCtx, makeMoney } from "@/shared/lib/app-context";
import { ACTIVITY, SUPPORTERS } from "@/shared/lib/demo-data";
import { DEFAULT_BRAND } from "@/shared/domain/model";
import { type View, parse, pathOf, tenantOf } from "@/shared/lib/route";
import { LEGAL_DRAFT, SITE, metaFor } from "@/shared/lib/seo";
import { LandingV2 } from "@/features/launch";
import { FAQ, Info, Pricing } from "@/features/marketing";
import { Blog, POSTS, allPosts, docTitle, primeCms, type Post } from "@/features/blog";
import { ZAKAT_FAQ, ZakatPage } from "@/features/zakat";

/**
 * Build-time HTML for the pages worth indexing, loaded by scripts/prerender.mjs.
 * The browser still runs the normal app over the top; this exists so crawlers and link previews get real content without running JavaScript.
 */
const noop = () => {};
const tenant = tenantOf("outgive.org");
const ctx: AppCtx = { db: null as never, user: null, tenant, org: null, member: false, isDemo: true, currency: "USD", setCurrency: noop, money: makeMoney("USD"), go: noop, href: (g) => pathOf(parse("/", tenant) && (g as View), tenant), board: SUPPORTERS, activity: ACTIVITY, hall: [], refresh: noop, brand: DEFAULT_BRAND, setBrand: noop, setOrg: noop, me: null, setMe: noop, toast: noop };
ctx.href = (g) => { const v = ("org" in g ? g : { ...g, org: "clearwell" }) as View; return pathOf(v, tenant); };
/** image: the share card under /public (1200x630) and its alt text. */
type Extra = { title?: string; description?: string; jsonLd?: object[]; lastmod?: string; ogType?: string; image?: string; imageAlt?: string };
const crumbs = (items: [string, string][]) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE.url + path })) });
const orgLd = { "@context": "https://schema.org", "@type": "Organization", name: SITE.name, url: SITE.url, logo: `${SITE.url}/icon-512.png`, description: "Ramadan fundraising platform for charities and mosques: donation pages, supporter fundraising and live leaderboards." };
const siteLd = { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: SITE.url };
const appLd = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: SITE.name, url: SITE.url, applicationCategory: "BusinessApplication", operatingSystem: "Web", image: `${SITE.url}/og.png`, description: "Ramadan donation pages, supporter fundraising pages and live leaderboards for charities and mosques, with Gift Aid and matched giving built in.", offers: { "@type": "Offer", price: "0", priceCurrency: "GBP", description: "Free to start, 0% platform fee with optional donor tips" } };
const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
const postLd = (p: Post): object[] => [
    { "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, description: p.description, datePublished: p.published, dateModified: p.updated, mainEntityOfPage: `${SITE.url}/blog/${p.slug}`, image: p.cover ?? `${SITE.url}/og/${POSTS.includes(p) ? p.slug : "blog"}.png`, author: p.author ? { "@type": "Person", name: p.author } : { "@type": "Organization", name: SITE.name, url: SITE.url }, publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: `${SITE.url}/favicon.svg` } } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    crumbs([["Blog", "/blog"], [p.title, `/blog/${p.slug}`]]),
];
const screens = (posts: Post[]): [View, () => React.ReactNode, Extra?][] => [
    // The public pages worth indexing: home, pricing, the help pages and the blog.
    [{ name: "landing" }, () => <LandingV2 />, { jsonLd: [orgLd, siteLd, appLd], imageAlt: "Outgive: make this Ramadan your biggest appeal yet" }],
    [{ name: "pricing" }, () => <Pricing />, { jsonLd: [appLd, crumbs([["Pricing", "/pricing"]])], image: "/og/pricing.png", imageAlt: "Outgive pricing: free to start, fair when you grow" }],
    [{ name: "faq" }, () => <Info kind="faq" />, { jsonLd: [faqLd, crumbs([["FAQ", "/faq"]])], image: "/og/faq.png", imageAlt: "Outgive FAQ" }],
    [{ name: "rules" }, () => <Info kind="rules" />, { jsonLd: [crumbs([["Rules", "/rules"]])], image: "/og/rules.png", imageAlt: "Outgive leaderboard rules" }],
    [{ name: "about" }, () => <Info kind="about" />, { jsonLd: [crumbs([["About", "/about"]])] }],
    [{ name: "blog" }, () => <Blog />, { lastmod: posts.map((p) => p.updated).sort().at(-1), image: "/og/blog.png", imageAlt: "The Outgive blog: fundraising guides", jsonLd: [{ "@context": "https://schema.org", "@type": "Blog", name: `${SITE.name} blog`, url: `${SITE.url}/blog`, blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE.url}/blog/${p.slug}`, datePublished: p.published })) }, crumbs([["Blog", "/blog"]])] }],
    ...posts.map((p): [View, () => React.ReactNode, Extra] => [{ name: "post", slug: p.slug }, () => <Blog slug={p.slug} />, { title: docTitle(p), description: p.description, jsonLd: postLd(p), lastmod: p.updated, ogType: "article", image: p.cover ? `${p.cover}?w=1200&h=630&fit=crop` : POSTS.includes(p) ? `/og/${p.slug}.png` : "/og/blog.png", imageAlt: p.coverAlt || p.title }]),
    [{ name: "zakat-calculator" }, () => <ZakatPage />, { jsonLd: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "Zakat calculator", url: `${SITE.url}/zakat-calculator`, applicationCategory: "FinanceApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } }, { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: ZAKAT_FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }, crumbs([["Zakat calculator", "/zakat-calculator"]])] }],
];

export const site = SITE;
/** Loads the posts written in Sanity, so pages() prerenders them too. */
export { primeCms };
/** Only open screens (the home page and the blog) are prerendered, and so in the sitemap: the rest show "Coming soon" until VITE_ALL_PAGES=true (see isOpen in App.tsx). */
export const pages = () => screens(allPosts(POSTS)).filter(([view]) => import.meta.env.VITE_ALL_PAGES === "true" || ["landing", "blog", "post", "zakat-calculator"].includes(view.name)).map(([view, el, x = {}]) => {
    const [title, description] = metaFor(view.name, DEFAULT_BRAND);
    return { path: pathOf(view, tenant), title: x.title ?? title, description: x.description ?? description, html: renderToStaticMarkup(<AppContext.Provider value={ctx}>{el()}</AppContext.Provider>), jsonLd: x.jsonLd ?? [], lastmod: x.lastmod, ogType: x.ogType ?? "website", image: x.image ?? "/og.png", imageAlt: x.imageAlt ?? title, noindex: LEGAL_DRAFT && (view.name === "terms" || view.name === "privacy") };
});
