import type { Post } from "../posts";
import { A, Note, Table } from "./kit";

export const platforms: Post = {
    slug: "best-crowdfunding-platforms-for-nonprofits",
    title: "Best crowdfunding platforms for nonprofits in 2026: fees compared (US and Europe)",
    description: "GoFundMe, GoFundMe Pro, Givebutter, Zeffy, Donorbox, JustGiving, betterplace.org and Outgive compared on platform fees, card processing, donor tips and payouts, with every figure checked against the platform's own pricing page.",
    audience: "charities",
    published: "2026-11-06",
    updated: "2026-11-06",
    minutes: 8,
    answer: "Most donation platforms now charge nonprofits no platform fee and make their money from optional donor tips. What a charity still pays is card processing, typically 2.2% to 2.9% plus 30¢ in the US and from 1.5% plus €0.25 on standard European cards. The right choice depends less on the headline fee than on where you are based, whether donors can cover fees, and whether the money goes straight to your own account.",
    takeaways: [
        "A platform's cost has three layers: a platform fee, payment processing, and optional tips asked of donors. Compare all three, not just the first.",
        "GoFundMe, Givebutter (with tips on), Zeffy, JustGiving's Start plan and betterplace.org all charge nonprofits 0% in platform fees as of November 2026.",
        "US card processing on GoFundMe runs 2.9% + $0.30 per gift, or 2.2% + $0.30 for certified nonprofits. Stripe's standard US rate is 2.9% + 30¢.",
        "In Europe, Stripe's standard rate for EEA consumer cards is 1.5% + €0.25, so a European nonprofit processing directly usually pays less per gift than a US one.",
        "Check the payout model: some platforms pay straight into your own account; others collect and then pay you out.",
    ],
    body: (
        <>
            <p>
                Comparison articles about crowdfunding sites usually list twenty platforms, half of which are for startups, real estate or musicians. This guide is only about raising donations for a <strong>charity or nonprofit</strong>, in the US and Europe. We read each platform's own pricing page in November 2026 and quote what it says. Where a page didn't state something, we say so rather than guess.
            </p>

            <h2>What does a crowdfunding platform cost a nonprofit?</h2>
            <p>Every donation platform makes money in some mix of three ways:</p>
            <ol>
                <li><strong>A platform fee</strong>: a percentage the platform keeps from each gift, or a monthly subscription.</li>
                <li><strong>Payment processing</strong>: what the card network and processor (Stripe, PayPal, Adyen and others) charge to move the money. Someone always pays this; the question is whether it's the charity or the donor.</li>
                <li><strong>Donor tips</strong>: an optional extra the donor adds at checkout that goes to the platform, not the charity. This is how "free" platforms are funded.</li>
            </ol>
            <p>
                A platform with a 0% platform fee isn't free to your donors, and one with a 3% fee may be cheaper overall if it lets donors cover processing. So compare the whole stack.
            </p>

            <h2>Nonprofit crowdfunding fees compared</h2>
            <p>All figures are from each platform's official pricing page, read on November 6, 2026. Links are in the sources at the end.</p>
            <Table
                head={["Platform", "Best for", "Platform fee", "Processing", "Donor tips"]}
                rows={[
                    ["GoFundMe", "Individuals, and certified nonprofits in the US, UK and Europe", "0%", "US: 2.9% + $0.30 (certified nonprofits 2.2% + $0.30). Euro countries: 2.9% + €0.25. UK certified charities: 1.9% + £0.20", "Optional"],
                    ["GoFundMe Pro (formerly Classy)", "Larger US-headquartered nonprofits", "Custom pricing: an annual subscription plus a per-donation fee. The Essentials plan for nonprofits under $1M in revenue advertises no subscription fee", "Not published", "Not stated"],
                    ["Givebutter", "US nonprofits wanting events, P2P and a free CRM", "0% with tips on; 3% with tips off", "With tips on: donors can cover it. With tips off: 2.9% + 30¢ cards, 1.9% + 30¢ ACH", "Yes (default)"],
                    ["Zeffy", "North American nonprofits that want zero fees", "0%", "Covered by Zeffy", "Yes, its only revenue"],
                    ["Donorbox", "Nonprofits wanting embeddable forms", "Percentage platform fee on the free plan; paid plans available", "Charged by Stripe or PayPal", "Donors can cover fees"],
                    ["JustGiving", "UK charities", "Start plan 0% with no monthly fee; Grow plan from £15/month + VAT", "1.9% + £0.30 (UK); 2.9% + £0.30 in other currencies", "Optional contribution"],
                    ["betterplace.org", "German nonprofits", "0%, no setup fee", "Standard transaction costs only (2.8% in its own illustration)", "Not stated"],
                    ["Outgive", "Charities that want leaderboards, team races and live giving moments", "0% with tips on; 3% with tips off", "Stripe's rate (2.9% + 30¢ on US cards); donors can cover it", "Optional"],
                ]}
            />
            <p>
                Donorbox's pricing page didn't load in a form we could read, so we haven't quoted its exact percentage. Check <A href="https://donorbox.org/pricing">donorbox.org/pricing</A> before you decide. Outgive is launching soon; the figures above are its published pricing.
            </p>

            <h2>Which platform fits which nonprofit?</h2>
            <h3>Small US nonprofits</h3>
            <p>
                If your priority is keeping every dollar, <strong>Zeffy</strong> covers card fees itself and asks donors for a tip instead. <strong>Givebutter</strong> works the same way with tips on, and adds events, text and peer-to-peer tools. If you want the largest audience of casual donors, <strong>GoFundMe</strong> brings its own traffic, and certified nonprofits get the lower 2.2% + $0.30 rate.
            </p>
            <h3>Larger US nonprofits</h3>
            <p>
                <strong>GoFundMe Pro</strong> is built for organizations with fundraising teams, and is priced by quote. Its pricing page says organizations must be headquartered in the United States, though their programs can run anywhere.
            </p>
            <h3>UK and Irish charities</h3>
            <p>
                <strong>JustGiving</strong> is the default in the UK: 0% platform fee on its Start plan, 1.9% + £0.30 processing, and a 5% fee on Gift Aid it claims for you (you can opt out and claim Gift Aid yourself). GoFundMe also supports UK and Irish charities, at 1.9% + £0.20 or 1.9% + €0.35 for certified charities.
            </p>
            <h3>German and other European nonprofits</h3>
            <p>
                <strong>betterplace.org</strong> charges German nonprofits no platform or setup fee, only market-rate transaction costs, and supports SEPA direct debit, PayPal, cards, Apple Pay, Google Pay and bank transfer. Across the euro area, GoFundMe charges 2.9% + €0.25 per gift.
            </p>
            <h3>Campaigns built on teams and competition</h3>
            <p>
                If your fundraising is driven by teams, schools, companies or events, look at how each platform handles <strong>peer-to-peer pages, team totals and leaderboards</strong>. That's the gap <strong>Outgive</strong> is built for: live leaderboards where supporters give to climb a rank, team and company races, and big-screen live modes for events. See our <a href="/blog/team-fundraising-ideas">team fundraising ideas</a> for how competition lifts giving.
            </p>

            <h2>What "free" really means: donor tips explained</h2>
            <p>
                A tip-funded platform shows donors an extra amount at checkout, often pre-selected, which goes to the platform. Zeffy says its tips are its only revenue and that two in three donors leave one. That's Zeffy's own figure, not an independent study.
            </p>
            <p>The trade-off is real on both sides:</p>
            <ul>
                <li><strong>For the charity</strong>, a tip model means 100% of the gift (or close to it) arrives.</li>
                <li><strong>For the donor</strong>, it's an extra cost, and a pre-ticked tip can feel like a trick if it isn't clear.</li>
            </ul>
            <p>
                If you choose a tip platform, make sure donors can see the tip and set it to zero easily. Trust is worth more than the fee.
            </p>

            <h2>How much of a $100 gift reaches the charity?</h2>
            <p>Here is one $100 card gift under three common setups. Processing is calculated at the listed rate.</p>
            <Table
                head={["Setup", "Platform fee", "Processing", "Charity receives"]}
                rows={[
                    ["0% platform fee, charity pays 2.9% + $0.30", "$0.00", "$3.20", "$96.80"],
                    ["0% platform fee, certified rate 2.2% + $0.30", "$0.00", "$2.50", "$97.50"],
                    ["3% platform fee plus 2.9% + $0.30", "$3.00", "$3.20", "$93.80"],
                    ["0% platform fee, donor covers processing", "$0.00", "Paid by donor", "$100.00"],
                ]}
            />
            <p>
                In Europe, the same maths on a €50 gift paid by a standard EEA consumer card at Stripe's list price of 1.5% + €0.25 comes to €1.00 in processing. Premium EEA cards cost 2.8% + €0.25, UK cards 2.5% + €0.25, and cards from outside Europe 3.15% + €0.25, plus 2% if a currency conversion is needed.
            </p>
            <Note title="Small gifts are where fixed fees bite">
                <p>The fixed 30¢ or €0.25 matters more on small gifts. On a $5 gift, 2.9% + $0.30 is $0.45, or 9% of the gift. If your campaign is built on lots of small gifts (classroom challenges, per-mile pledges), ask donors to cover fees or suggest a slightly higher minimum.</p>
            </Note>

            <h2>What to compare beyond fees</h2>
            <ul>
                <li><strong>Where the money goes.</strong> Does each gift land in your own payment account, or does the platform hold it and pay out later? Direct payouts mean no payout schedule to wait on and no platform holding your funds.</li>
                <li><strong>Countries and currencies.</strong> A US-only platform can't serve a European charity, and some charge conversion fees on foreign cards.</li>
                <li><strong>Peer-to-peer and teams.</strong> Can supporters create their own pages that roll up to a team and a campaign total?</li>
                <li><strong>Your brand.</strong> Is the page on your domain with your logo, or the platform's?</li>
                <li><strong>Donor data.</strong> Can you export supporters and use them in your own CRM?</li>
                <li><strong>Monthly giving.</strong> Recurring gifts are a growing share of online revenue: 27% in the 2026 M+R Benchmarks study. Make sure recurring is built in.</li>
                <li><strong>Tax receipts.</strong> Does it email receipts automatically, and does it handle Gift Aid (UK) or local receipts in your country?</li>
            </ul>

            <h2>How we checked</h2>
            <p>
                We read each platform's official pricing page on November 6, 2026 and copied the figures shown for nonprofits. We left out GlobalGiving because its site refused our request, and we didn't quote Donorbox's percentage because its pricing page didn't load in a readable form. Fees change, so treat this as a starting point and confirm on the pricing page before signing up. If you spot a figure that has changed, tell us and we'll update the date at the top.
            </p>
            <p>
                Next steps: plan your <a href="/blog/giving-tuesday-2026-plan">GivingTuesday 2026 campaign</a>, or read <a href="/blog/how-to-start-an-online-fundraiser">how to start an online fundraiser</a>.
            </p>
        </>
    ),
    faq: [
        ["Which crowdfunding platform has the lowest fees for nonprofits?", "Zeffy charges nonprofits nothing and covers card processing itself, funded by optional donor tips. Givebutter and Outgive are also 0% when donor tips are on. Among platforms where the charity pays processing, GoFundMe's certified nonprofit rate in the US is 2.2% + $0.30 per gift."],
        ["Is GoFundMe free for charities?", "GoFundMe charges no platform fee. A transaction fee is deducted from every donation: 2.9% + $0.30 in the US, or 2.2% + $0.30 for certified nonprofits. Donors are asked for an optional tip."],
        ["What is the best fundraising platform for a European charity?", "It depends on the country. JustGiving is the most used in the UK, betterplace.org is built for German nonprofits, and GoFundMe supports most euro-area countries at 2.9% + €0.25 per gift. Check that the platform supports SEPA and your local tax receipts."],
        ["Do donor tips reduce how much people give to the charity?", "Tips are added on top of the gift, so the charity receives the full donation. The risk is to trust: make the tip clearly optional and easy to set to zero."],
        ["Should a nonprofit use a crowdfunding site or its own donation page?", "Use both if you can. Your own branded page builds your donor list, while crowdfunding and peer-to-peer pages reach your supporters' friends. The best platforms do both, with every page rolling up to one campaign total."],
    ],
    sources: [
        ["GoFundMe: pricing (individual and certified nonprofit tabs)", "https://www.gofundme.com/pricing"],
        ["GoFundMe Pro: pricing", "https://pro.gofundme.com/c/pricing/"],
        ["GoFundMe Pro: solutions and plans", "https://pro.gofundme.com/c/solutions/"],
        ["Givebutter: pricing", "https://givebutter.com/pricing"],
        ["Zeffy: pricing", "https://www.zeffy.com/pricing"],
        ["Donorbox: pricing", "https://donorbox.org/pricing"],
        ["JustGiving: pricing for charities", "https://www.justgiving.com/about/pricing"],
        ["betterplace.org: fundraising for nonprofits", "https://www.betterplace.org/c/spenden-sammeln/als-verein"],
        ["Stripe: pricing (US)", "https://stripe.com/pricing"],
        ["Stripe: pricing (Ireland / EEA)", "https://stripe.com/ie/pricing"],
        ["M+R Benchmarks 2026: fundraising", "https://mrbenchmarks.com/fundraising/"],
    ],
};
