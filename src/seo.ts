import type { View } from "@/components/outgive/shared";
import type { Brand, PageData } from "@/data";

/** The one place the public address lives. Change `url` when the domain is bought; canonical links, the sitemap and share previews all read it. */
export const SITE = { name: "Outgive", url: "https://outgive.org" };

/** Umami analytics (open source, cookieless). Paste the website ID from your Umami dashboard to switch it on; point `src` at your own server if you self-host. */
export const ANALYTICS = { src: "https://cloud.umami.is/script.js", websiteId: "" };

/** Who stands behind the terms and privacy pages. While any value is still in [brackets] those two pages are marked as drafts and kept out of search. */
export const LEGAL = { company: "[Company legal name]", address: "[Registered address]", email: "[contact email]", law: "[country or state whose law applies]", updated: "12 October 2026" };
export const LEGAL_DRAFT = Object.values(LEGAL).some((v) => v.startsWith("["));

/** Where each screen lives. Fundraising pages carry their own key. */
export const pathOf = (v: View): string => (v.name === "landing" || v.name === "notfound" ? "/" : v.name === "home" ? "/demo" : v.name === "page" ? (v.key ? `/${v.key}` : "/layouts") : `/${v.name}`);

/** Title and description for a screen, so search results and shared links describe what is on it. */
export const metaFor = (name: View["name"], brand: Brand, page?: PageData): [string, string] => {
    const missing: [string, string] = ["Page not found", `This page does not exist. Go to ${SITE.name}.`];
    return ({
        landing: ["Charity leaderboard software that makes supporters give more | Outgive", "Outgive turns your supporters into a public fundraising leaderboard on your own brand. Every rank has a price, so people give more to climb. See the live demo."],
        "landing-b": ["Giving, made a race | Outgive", "A second design for the Outgive product page: charity leaderboards where every rank has a price."],
        home: [`${brand.name} leaderboard: give more to take a rank`, `${brand.tagline}. See who is giving most to ${brand.name}, what it costs to pass them, and claim your own rank. Live Outgive demo.`],
        create: [`Start fundraising for ${brand.name}`, `Set up a fundraising page for ${brand.name} in minutes. Every gift to it counts toward your rank on the leaderboard.`],
        about: [`About the ${brand.name} leaderboard`, `How the ${brand.name} leaderboard works: your rank is set by what you give and what you raise.`],
        rules: ["Leaderboard rules: how ranks are claimed, held and reset | Outgive", "The rules of an Outgive fundraising leaderboard: give more than the holder to take a rank, weekly resets, anonymous giving and what happens on refunds."],
        dashboard: [`Your dashboard · ${brand.name}`, `Your rank, gifts, fundraising pages and giving streak on the ${brand.name} leaderboard.`],
        terms: ["Terms of use | Outgive", "The terms for using Outgive: what the demo is, what you may do on it, and where responsibility sits."],
        privacy: ["Privacy policy | Outgive", "What Outgive collects, what stays in your browser, how analytics work without cookies, and how to reach us."],
        faq: ["Fundraising leaderboard FAQ | Outgive", "Answers about claiming a rank, currencies, fundraising pages and running a leaderboard for your own charity."],
        notfound: missing,
        page: page ? [`${page.title || "Fundraising page"} · ${brand.name}`, `Give to ${page.title || "this page"} for ${page.org || brand.name}. Every gift counts toward its rank on the leaderboard.`] : missing,
    } as Record<View["name"], [string, string]>)[name];
};
