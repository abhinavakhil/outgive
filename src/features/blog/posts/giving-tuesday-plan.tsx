import type { Post } from "../posts";
import { A, Note, Table } from "./kit";

export const givingTuesday: Post = {
    slug: "giving-tuesday-2026-plan",
    title: "GivingTuesday 2026 (December 1): a 25-day campaign plan for nonprofits",
    description: "GivingTuesday 2026 is Tuesday, December 1. A day-by-day plan for nonprofits in the US and Europe: goal, match, story, peer-to-peer teams, the day itself and the December follow-up, with the 2025 results and benchmark data behind each step.",
    audience: "charities",
    published: "2026-11-06",
    updated: "2026-11-06",
    minutes: 6,
    answer: "GivingTuesday 2026 is on Tuesday, December 1. With about 25 days to go, a nonprofit has time for one focused campaign: set a specific goal, secure a matching gift, recruit a handful of supporters to fundraise for you, and plan the follow-up for the rest of December. That's when the bigger share of online giving arrives.",
    takeaways: [
        "GivingTuesday 2025 raised an estimated $4.0 billion in the US, up 13% on 2024, from 38.1 million participants.",
        "December is bigger than the day: 37% of a typical nonprofit's annual online revenue comes in December, 10% in the last week of the year and 4% on December 31 (M+R Benchmarks 2026).",
        "A matching gift, a visible goal and a live progress display give donors a reason to act on the day rather than later.",
        "Most donor traffic is on phones (52%), but phones convert worse (8% vs 11% on desktop), so test your donation page on a phone first.",
        "Only 24% of new online donors give again the next year, against 66% of returning donors. Plan the thank-you before the ask.",
    ],
    body: (
        <>
            <p>
                GivingTuesday falls on the Tuesday after US Thanksgiving. In 2026 that's <strong>December 1</strong>. It started in the US in 2012 and is now a movement in more than 110 countries, with a regional hub for Europe. This plan works backwards from the day, and it assumes you're starting in early November with a small team.
            </p>

            <h2>How big is GivingTuesday?</h2>
            <Table
                head={["GivingTuesday 2025 (US)", "Figure"]}
                rows={[
                    ["Total donated on the day", "$4.0 billion, up 13%"],
                    ["People who took part", "38.1 million, up 6%"],
                    ["People who gave money", "19.1 million, up 3%"],
                    ["People who volunteered", "11.1 million, up 20%"],
                    ["Total donated on GivingTuesdays since 2012", "$22.5 billion"],
                ]}
            />
            <p>
                Source: <A href="https://www.givingtuesday.org/blog/2025-results/">GivingTuesday 2025 results</A>, published December 3, 2025.
            </p>
            <p>
                One day isn't the whole story, though. In the <A href="https://mrbenchmarks.com/fundraising/">M+R Benchmarks 2026</A> study, <strong>37% of nonprofits' annual online revenue came in December</strong>, 10% in the last week of the year and 4% on December 31 alone. Europe shows the same pattern: in Germany, December 2025 accounted for <strong>24% of all private donations for the year</strong> (€1.124 billion), according to the <A href="https://www.spendenrat.de/bilanz-des-helfens-2025/">Deutscher Spendenrat</A>. Treat GivingTuesday as the launch of your year-end campaign, not a one-off.
            </p>

            <h2>Days 25 to 18: what is your goal, and who will match it?</h2>
            <ul>
                <li>
                    <strong>Pick one specific goal.</strong> "$15,000 to fund 300 school lunches through spring" beats "support our work". Translate the money into units: a meal, a tree, a night of shelter. Donors give to things they can picture.
                </li>
                <li>
                    <strong>Ask for a matching gift now.</strong> Ask a board member, a local business or a major donor to match gifts made on the day, up to a cap. A match gives donors a deadline ("double your gift until midnight") and gives you a story to post every few hours.
                </li>
                <li>
                    <strong>Pick your platform.</strong> If you're choosing, see our <a href="/blog/best-crowdfunding-platforms-for-nonprofits">nonprofit crowdfunding fees comparison</a>. Make sure it shows progress live, takes Apple Pay and Google Pay, and offers monthly giving.
                </li>
            </ul>

            <h2>Days 17 to 10: story, page and fundraisers</h2>
            <ul>
                <li><strong>Write one story.</strong> One person or place, one problem, what the gift changes. Keep the page to a short story, a clear goal, a photo or 30-second video, and the donate button.</li>
                <li><strong>Test the page on a phone.</strong> In M+R's 2026 data, 52% of visits to nonprofit websites came from phones, but phones converted 8% of donation-page visitors against 11% on desktop. Phones also brought in only 28% of revenue, with an average gift of $88 against $168 on desktop. Cut form fields, turn on wallet payments, and pre-fill sensible amounts.</li>
                <li>
                    <strong>Recruit 5 to 20 peer-to-peer fundraisers.</strong> Board members, volunteers, past beneficiaries, loyal donors. Ask each to set up a personal page under your campaign with their own small goal. Each one reaches friends you'd never reach. Our guide to <a href="/blog/team-fundraising-ideas">team fundraising ideas</a> has formats that work.
                </li>
                <li><strong>Prepare your assets.</strong> Three emails, five social posts, a short video and a thank-you message, all drafted before December.</li>
            </ul>

            <h2>Days 9 to 2: warm up your supporters</h2>
            <ul>
                <li><strong>Tell people it's coming.</strong> A "save the date" email with the goal and the match. Ask your fundraisers to post the same week.</li>
                <li><strong>Line up early gifts.</strong> Ask a few close supporters to give in the first hour on December 1. A campaign that opens at 10% looks alive. One that opens at zero doesn't.</li>
                <li><strong>Plan the day hour by hour.</strong> Who posts what, and when? Who watches the total and announces milestones?</li>
            </ul>

            <h2>December 1: what should you do on the day?</h2>
            <Table
                head={["Time", "What to do"]}
                rows={[
                    ["Early morning", "Launch email: the goal, the match and one-click giving. Post on every channel. Fundraisers share their pages."],
                    ["Mid-morning", "First milestone update with the real total. Thank the first donors publicly, with permission."],
                    ["Lunchtime", "A short video from the field or a beneficiary. Remind people the match runs until midnight."],
                    ["Afternoon", "\"We're X% there\" update. Shout out your top fundraisers or teams."],
                    ["Evening", "Last-call email to everyone who hasn't opened or given. If you have an event, put the live total on screen."],
                    ["Before midnight", "Final push, then a thank-you post with the total, even if you didn't hit the goal."],
                ]}
            />
            <Note title="Show progress where people can see it">
                <p>
                    Progress is motivating when people can see it move. A live total, a thermometer, or a leaderboard of teams, classes or departments on a screen at your office, school or event turns a donation into a moment. That's what Outgive is built around: live leaderboards and big-screen giving modes for charities.
                </p>
            </Note>

            <h2>December 2 to 31: how do you keep the momentum?</h2>
            <ul>
                <li><strong>Thank everyone within 48 hours.</strong> In M+R's data, only <strong>24% of new online donors gave again the following year</strong>, against 66% of returning donors. A personal thank-you and an update on impact are the cheapest retention tools you have.</li>
                <li><strong>Ask new donors to go monthly.</strong> Monthly giving was 27% of online revenue in the 2026 benchmarks, and 71% of monthly donors were still giving after a year.</li>
                <li><strong>Plan your year-end appeal.</strong> The last week of December brings in 10% of the year's online revenue. Email your GivingTuesday non-responders around December 28 to 31 with a fresh angle, not a repeat.</li>
                <li><strong>Report back.</strong> In January, share what the money did. It's the strongest ask for next year.</li>
            </ul>

            <h2>GivingTuesday in Europe</h2>
            <p>
                GivingTuesday runs in many European countries under its own name or a translated one, often through national partner organizations. December is also the peak giving month in Europe. If you're outside the US, check whether there's a national GivingTuesday movement you can join. Make sure your platform takes SEPA payments and local wallets, and gives receipts your donors can use for tax relief. Our <a href="/blog/are-donations-tax-deductible">guide to tax-deductible donations</a> covers the main countries.
            </p>
        </>
    ),
    faq: [
        ["When is GivingTuesday 2026?", "Tuesday, December 1, 2026, the Tuesday after US Thanksgiving."],
        ["How much was raised on GivingTuesday 2025?", "An estimated $4.0 billion in the US, up 13% on 2024, from 38.1 million participants, according to GivingTuesday's own results."],
        ["Is it too late to plan a GivingTuesday campaign in November?", "No. Three to four weeks is enough for a focused campaign: one goal, one matching gift, a simple page, a few peer-to-peer fundraisers and a planned run of emails and posts. Keep it simple and put most of your effort into the follow-up."],
        ["Is GivingTuesday only in the US?", "No. GivingTuesday says it has movements in more than 110 countries, with regional hubs including Europe."],
        ["What makes a GivingTuesday campaign succeed?", "A specific goal, a matching gift with a deadline, progress updates through the day, supporters fundraising for you, and a thank-you and follow-up plan for the rest of December."],
    ],
    sources: [
        ["GivingTuesday: 2025 results", "https://www.givingtuesday.org/blog/2025-results/"],
        ["M+R Benchmarks 2026: fundraising", "https://mrbenchmarks.com/fundraising/"],
        ["M+R Benchmarks 2026: website performance", "https://mrbenchmarks.com/website-performance/"],
        ["Deutscher Spendenrat: Bilanz des Helfens 2025", "https://www.spendenrat.de/bilanz-des-helfens-2025/"],
    ],
};
