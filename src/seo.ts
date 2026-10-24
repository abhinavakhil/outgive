import type { View } from "@/lib/route";
import type { Brand, PageData } from "@/data";

/** The one place the public address lives. Change `url` when the domain is bought; canonical links, the sitemap and share previews all read it. */
export const SITE = { name: "Outgive", url: "https://outgive.org" };

/** Umami analytics (open source, cookieless). Paste the website ID from your Umami dashboard to switch it on; point `src` at your own server if you self-host. */
export const ANALYTICS = { src: "https://cloud.umami.is/script.js", websiteId: "" };

/** Who stands behind the terms and privacy pages. While any value is still in [brackets] those two pages are marked as drafts and kept out of search. */
export const LEGAL = { company: "[Company legal name]", address: "[Registered address]", email: "[contact email]", law: "[country or state whose law applies]", updated: "23 October 2026" };
export const LEGAL_DRAFT = Object.values(LEGAL).some((v) => v.startsWith("["));

/** Title and description for a screen, so search results and shared links describe what is on it. */
export const metaFor = (name: View["name"], brand: Brand, page?: PageData): [string, string] => {
    const missing: [string, string] = ["Page not found", `This page does not exist. Go to ${SITE.name}.`];
    const m: Partial<Record<View["name"], [string, string]>> = {
        landing: ["Fundraising platform with live leaderboards, on your own brand | Outgive", "Outgive is a white-label fundraising platform: donation pages, peer-to-peer fundraising, events and a live leaderboard where every rank has a price. Free for charities; donors tip."],
        "landing-b": ["Giving, made a race | Outgive", "A second design for the Outgive product page: charity leaderboards where every rank has a price."],
        board: [`${brand.name} leaderboard: give more to take a rank`, `${brand.tagline}. See who is giving most to ${brand.name}, what it costs to pass them, and claim your own rank.`],
        live: [`${brand.name} live`, `Live fundraising screen for ${brand.name}: the total, the board and every gift as it lands.`],
        overlay: [`${brand.name} overlay`, "Stream overlay."],
        create: [`Start fundraising for ${brand.name}`, `Set up a fundraising page for ${brand.name} in minutes. Every gift to it counts toward your rank on the leaderboard.`],
        about: [`About the ${brand.name} leaderboard`, `How the ${brand.name} leaderboard works: your rank is set by what you give and what you raise.`],
        rules: ["Leaderboard rules: how ranks are claimed, held and reset | Outgive", "The rules of an Outgive fundraising leaderboard: give more than the holder to take a rank, weekly resets, anonymous giving and what happens on refunds."],
        dashboard: [`Your dashboard · ${SITE.name}`, "Your gifts, receipts, fundraising pages and organisations."],
        admin: [`${brand.name} · organiser dashboard`, "Donations, pages, branding, payouts and the live screen."],
        terms: ["Terms of use | Outgive", "The terms for using Outgive: what the platform does, how gifts are paid to charities, and where responsibility sits."],
        privacy: ["Privacy policy | Outgive", "What Outgive collects, how payments are processed by Stripe, how analytics work without cookies, and how to reach us."],
        faq: ["Fundraising leaderboard FAQ | Outgive", "Answers about claiming a rank, fees, currencies, fundraising pages and running a leaderboard for your own charity."],
        pricing: ["Pricing | Outgive", "Outgive is free for charities. Donors can add a tip; card processing is paid to Stripe. White-label on every plan."],
        start: ["Start your organisation | Outgive", "Create your charity's board, connect Stripe and start taking gifts."],
        login: ["Sign in | Outgive", "Sign in with a magic link or Google."],
        thanks: [`Thank you · ${brand.name}`, "Your gift has been received."],
        layouts: ["12 fundraising page layouts | Outgive", "Every layout holds the same sections: story, progress, gifts, updates and sharing."],
        embed: [`${brand.name}`, "Embedded Outgive widget."],
        notfound: missing,
        page: page ? [`${page.title || "Fundraising page"} · ${brand.name}`, `Give to ${page.title || "this page"} for ${page.org || brand.name}. Every gift counts toward its rank on the leaderboard.`] : missing,
    };
    return m[name] ?? missing;
};
