import { renderToStaticMarkup } from "react-dom/server";
import { AppContext, type AppCtx, makeMoney } from "@/shared/lib/app-context";
import { ACTIVITY, SUPPORTERS } from "@/shared/lib/demo-data";
import { DEFAULT_BRAND } from "@/shared/domain/model";
import { type View, parse, pathOf, tenantOf } from "@/shared/lib/route";
import { LEGAL_DRAFT, SITE, metaFor } from "@/shared/lib/seo";
import { ComingSoon } from "@/features/launch";
import { Blog, POSTS, docTitle, type Post } from "@/features/blog";

/**
 * Build-time HTML for the pages worth indexing, loaded by scripts/prerender.mjs.
 * The browser still runs the normal app over the top; this exists so crawlers and link previews get real content without running JavaScript.
 */
const noop = () => {};
const tenant = tenantOf("outgive.org");
const ctx: AppCtx = { db: null as never, user: null, tenant, org: null, member: false, isDemo: true, currency: "USD", setCurrency: noop, money: makeMoney("USD"), go: noop, href: (g) => pathOf(parse("/", tenant) && (g as View), tenant), board: SUPPORTERS, activity: ACTIVITY, hall: [], refresh: noop, brand: DEFAULT_BRAND, setBrand: noop, setOrg: noop, me: null, setMe: noop, toast: noop };
ctx.href = (g) => { const v = ("org" in g ? g : { ...g, org: "clearwell" }) as View; return pathOf(v, tenant); };
type Extra = { title?: string; description?: string; jsonLd?: object[]; lastmod?: string; ogType?: string };
const crumbs = (items: [string, string][]) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE.url + path })) });
const orgLd = { "@context": "https://schema.org", "@type": "Organization", name: SITE.name, url: SITE.url, logo: `${SITE.url}/favicon.svg` };
const postLd = (p: Post): object[] => [
    { "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, description: p.description, datePublished: p.published, dateModified: p.updated, mainEntityOfPage: `${SITE.url}/blog/${p.slug}`, image: `${SITE.url}/og.png`, author: { "@type": "Organization", name: SITE.name, url: SITE.url }, publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: `${SITE.url}/favicon.svg` } } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    crumbs([["Blog", "/blog"], [p.title, `/blog/${p.slug}`]]),
];
const SCREENS: [View, () => React.ReactNode, Extra?][] = [
    // Before launch the coming-soon page and the blog are the only prerendered screens.
    [{ name: "landing" }, () => <ComingSoon />, { jsonLd: [orgLd] }],
    [{ name: "blog" }, () => <Blog />, { lastmod: POSTS.map((p) => p.updated).sort().at(-1), jsonLd: [{ "@context": "https://schema.org", "@type": "Blog", name: `${SITE.name} blog`, url: `${SITE.url}/blog`, blogPost: POSTS.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE.url}/blog/${p.slug}`, datePublished: p.published })) }, crumbs([["Blog", "/blog"]])] }],
    ...POSTS.map((p): [View, () => React.ReactNode, Extra] => [{ name: "post", slug: p.slug }, () => <Blog slug={p.slug} />, { title: docTitle(p), description: p.description, jsonLd: postLd(p), lastmod: p.updated, ogType: "article" }]),
];

export const site = SITE;
export const pages = () => SCREENS.map(([view, el, x = {}]) => {
    const [title, description] = metaFor(view.name, DEFAULT_BRAND);
    return { path: pathOf(view, tenant), title: x.title ?? title, description: x.description ?? description, html: renderToStaticMarkup(<AppContext.Provider value={ctx}>{el()}</AppContext.Provider>), jsonLd: x.jsonLd ?? [], lastmod: x.lastmod, ogType: x.ogType ?? "website", noindex: LEGAL_DRAFT && (view.name === "terms" || view.name === "privacy") };
});
