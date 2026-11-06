import type { Post } from "../posts";
import { A, Note, Table } from "./kit";

export const startFundraiser: Post = {
    slug: "how-to-start-an-online-fundraiser",
    title: "How to start an online fundraiser that reaches its goal: a step-by-step guide",
    description: "Ten steps to start an online fundraiser for a charity or a cause in the US or Europe: who the money goes to, choosing a platform, setting a goal, writing the story, sharing it, posting updates and thanking donors.",
    audience: "fundraisers",
    published: "2026-11-06",
    updated: "2026-11-06",
    minutes: 6,
    answer: "To start an online fundraiser, decide who receives the money (a registered charity or a person), pick a platform with low fees, set a specific goal, and write a short story with a photo. Give first, then ask your closest supporters before you share it widely. After that, post updates regularly and thank every donor.",
    takeaways: [
        "Decide first whether you're raising for a registered charity or for a person. It changes the platform, the fees and whether donors get a tax deduction.",
        "A specific goal tied to something people can picture raises more confidence than a round number.",
        "Your first donors should be the people closest to you. A page that already has gifts on it is easier to give to.",
        "GoFundMe recommends posting your first update within seven days, and says fundraisers with updates can raise up to 3x more (its own data).",
        "Most visitors arrive on a phone. Check your page on one before you share it.",
    ],
    body: (
        <>
            <p>
                Most fundraisers that stall don't fail on the cause. They fail on the basics: a vague goal, a page nobody sees, and silence after the first week. Here's how to avoid all three, whether you're running a marathon for a charity, raising for a neighbor, or rallying your company behind a cause.
            </p>

            <h2>1. Who is the money for?</h2>
            <p>There are two kinds of fundraiser, and the difference matters to your donors:</p>
            <Table
                head={["", "For a registered charity", "For a person or family"]}
                rows={[
                    ["Where money goes", "To the charity, often straight to its account", "To you or the person you name"],
                    ["Tax deduction for donors (US)", "Usually yes, if the charity qualifies", "No: the IRS doesn't allow deductions for gifts to individuals"],
                    ["Tax relief in Europe", "Usually yes, for locally recognized charities", "Generally no"],
                    ["Typical platforms", "Charity fundraising pages (JustGiving, Givebutter, Outgive)", "Personal crowdfunding (GoFundMe)"],
                ]}
            />
            <p>
                If you're raising for a charity, start from the charity's own campaign page so your gifts count toward its total. See our guide to <a href="/blog/are-donations-tax-deductible">which donations are tax-deductible</a>.
            </p>

            <h2>2. Which platform should you use?</h2>
            <p>
                Compare what it costs, whether it supports your country and currency, and whether donors can pay with Apple Pay or Google Pay. Our <a href="/blog/best-crowdfunding-platforms-for-nonprofits">fees comparison</a> covers the main platforms in the US and Europe. As a rule of thumb, card processing costs around 2.9% + 30¢ per gift in the US. Many platforms add no fee of their own and ask donors for an optional tip instead.
            </p>

            <h2>3. How much should your goal be?</h2>
            <ul>
                <li><strong>Make it specific.</strong> "$2,400 to cover a year of meals for one family" is easier to give to than "$2,500 for the food bank".</li>
                <li><strong>Make it reachable.</strong> A goal you hit and then raise looks better than one you miss. You can always set a stretch goal later.</li>
                <li><strong>Break it into units.</strong> "$25 plants a tree", "$50 pays for one class". Units help donors choose an amount and let you post milestones like "we've funded 40 trees".</li>
            </ul>

            <h2>4. How do you write a fundraiser story?</h2>
            <p>Answer four questions in about 150 to 300 words:</p>
            <ol>
                <li><strong>Who</strong> are you, and who will this help?</li>
                <li><strong>What</strong> is the problem, in one concrete example?</li>
                <li><strong>Why now?</strong> What's the deadline or moment?</li>
                <li><strong>How</strong> will the money be used, down to the unit?</li>
            </ol>
            <p>Write the way you'd talk to a friend. Use one strong photo of a person's face over a logo, and add a short video if you can.</p>

            <h2>5. Make it work on a phone</h2>
            <p>
                In the <A href="https://mrbenchmarks.com/website-performance/">M+R Benchmarks 2026</A> study, 52% of visits to nonprofit sites came from phones, but phones converted fewer visitors into donors than desktop (8% vs 11%). Open your page on your phone before sharing. Check that the story is short, the donate button is visible, and wallet payments work.
            </p>

            <h2>6. Who should give first?</h2>
            <p>
                <strong>You.</strong> Then ask five to ten people who'll say yes, by direct message or in person, before you post publicly. A page with a few gifts and a percentage already filled in tells the next visitor that this is real and moving.
            </p>

            <h2>7. How do you share a fundraiser?</h2>
            <ul>
                <li><strong>Personal messages beat broadcast posts.</strong> A direct message to one person with a specific ask ("could you give $20 toward the next tree?") converts far better than a general post.</li>
                <li><strong>Share in more than one way.</strong> Try email, WhatsApp, a team chat, LinkedIn, Instagram stories, and a QR code on a poster or at an event. GoFundMe says that sharing a fundraiser in a new way can lead to a 2.5x increase in its visibility (its own figure).</li>
                <li><strong>Recruit co-fundraisers.</strong> Ask friends to start their own pages under yours, or join as a team. Teams consistently out-raise solo fundraisers. See our <a href="/blog/team-fundraising-ideas">team fundraising ideas</a>.</li>
            </ul>

            <h2>8. Post updates</h2>
            <p>
                <A href="https://www.gofundme.com/c/fundraising-tips">GoFundMe's own guidance</A> is to post your first update within seven days of starting, then weekly or at milestones. It says that text, photo and video updates can help a fundraiser raise up to 3x more. Good updates are short and concrete: "We just passed 50%! Here's the first 20 trees going into the ground."
            </p>

            <h2>9. Thank every donor</h2>
            <p>
                Thank people individually within a day if you can, and publicly if they're happy to be named. A donor who feels noticed is more likely to share your page and give again.
            </p>

            <h2>10. Close it out</h2>
            <p>
                When you hit the goal or the deadline, post a final update: what you raised, what it pays for, and a thank-you. If the money goes to a charity, share the impact report when it arrives. This step turns one-time donors into next year's supporters.
            </p>

            <Note title="A one-week launch checklist">
                <p><strong>Day 1:</strong> set the goal, write the story, add a photo, make your own gift.</p>
                <p><strong>Day 2:</strong> message your 10 closest supporters personally.</p>
                <p><strong>Day 3:</strong> share publicly on two channels; ask three friends to fundraise with you.</p>
                <p><strong>Day 5:</strong> post your first update with a real number.</p>
                <p><strong>Day 7:</strong> thank every donor so far, then share again in a new way.</p>
            </Note>
        </>
    ),
    faq: [
        ["How do I start a fundraiser for free?", "Most platforms let you start a page at no cost. Card processing, around 2.9% + 30¢ per gift in the US, is usually deducted from each donation. Some platforms cover it and ask donors for an optional tip instead."],
        ["Are donations to my personal fundraiser tax-deductible?", "In the US, no. The IRS doesn't allow a deduction for gifts to individuals, even through a crowdfunding site. Donations to a qualifying charity's fundraising page generally are. European countries have similar rules."],
        ["How long should a fundraiser run?", "Long enough to reach your network two or three times, and short enough to feel urgent. Four to six weeks suits most personal fundraisers. Event-based fundraisers often run for a month before the event."],
        ["What should I write in a fundraiser story?", "Who you are, who it helps, what the problem is, why now, and exactly what the money pays for, in about 150 to 300 words with one strong photo."],
        ["How do I get strangers to donate?", "Most donations to a personal fundraiser come from the organizer's network and their friends' networks. Get those people to share, recruit co-fundraisers, and post updates that give people a reason to pass it on."],
    ],
    sources: [
        ["IRS: Publication 526, Charitable Contributions", "https://www.irs.gov/publications/p526"],
        ["IRS: Charitable contribution deductions", "https://www.irs.gov/charities-non-profits/charitable-organizations/charitable-contribution-deductions"],
        ["GoFundMe: fundraising tips", "https://www.gofundme.com/c/fundraising-tips"],
        ["GoFundMe: pricing", "https://www.gofundme.com/pricing"],
        ["M+R Benchmarks 2026: website performance", "https://mrbenchmarks.com/website-performance/"],
    ],
};
