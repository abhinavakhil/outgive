import type { ReactNode } from "react";
import { platforms } from "./posts/crowdfunding-platforms-for-nonprofits";
import { givingTuesday } from "./posts/giving-tuesday-plan";
import { startFundraiser } from "./posts/how-to-start-a-fundraiser";
import { teamIdeas } from "./posts/team-fundraising-ideas";
import { checkCharity } from "./posts/how-to-check-a-charity";
import { taxDeductible } from "./posts/are-donations-tax-deductible";

export type Audience = "charities" | "fundraisers" | "donors";
export const AUDIENCES: [Audience, string][] = [["charities", "For charities"], ["fundraisers", "For fundraisers"], ["donors", "For donors"]];

/**
 * One article. `answer` is the short direct answer shown under the title, the part search engines and AI assistants quote.
 * Dates are ISO (yyyy-mm-dd); bump `updated` whenever a figure in the post is re-checked or changed.
 */
export type Post = {
    slug: string; title: string; description: string; audience: Audience;
    published: string; updated: string; minutes: number;
    answer: string; takeaways: string[]; body: ReactNode;
    faq: [string, string][]; sources: [string, string][];
};

/** Newest first. */
export const POSTS: Post[] = [givingTuesday, platforms, startFundraiser, teamIdeas, checkCharity, taxDeductible];

/** The <title> for a post. */
export const docTitle = (p: Post) => `${p.title} | Outgive`;
