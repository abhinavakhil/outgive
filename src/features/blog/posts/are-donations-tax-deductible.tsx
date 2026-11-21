import type { Post } from "../posts";
import { A, Note, Table } from "./kit";

export const taxDeductible: Post = {
    slug: "are-donations-tax-deductible",
    title: "Are donations tax-deductible? A 2026 guide for US and European donors",
    description: "How tax relief on charitable donations works in 2026: the new US deduction for people who don't itemize, the 0.5% floor for itemizers, and the rules in Germany, France, the Netherlands, Spain and Ireland, with the receipts you need.",
    audience: "donors",
    published: "2026-11-06",
    updated: "2026-11-06",
    minutes: 7,
    answer: "Donations to registered charities are tax-deductible in the US and most European countries, but gifts to individuals, including personal crowdfunding, generally aren't. From tax year 2026, US donors who take the standard deduction can deduct up to $1,000 in cash gifts to charity ($2,000 for married couples filing jointly). In Europe the relief ranges from a deduction from income (Germany, the Netherlands) to a credit of 66% or more of the gift (France, Spain).",
    takeaways: [
        "US, from 2026: non-itemizers can deduct up to $1,000 ($2,000 joint) of cash gifts to qualifying charities. Gifts to donor-advised funds don't qualify.",
        "US itemizers can only deduct the part of their gifts above 0.5% of adjusted gross income, starting in 2026.",
        "Keep a bank record or receipt for every cash gift, and a written acknowledgment from the charity for any single gift of $250 or more.",
        "Europe: Germany deducts gifts up to 20% of income, France gives a 66% tax reduction (75% for some causes), Spain gives 80% on the first €250, the Netherlands deducts above a threshold, and Irish charities reclaim tax on gifts of €250 or more.",
        "Relief usually only applies to charities recognized in your own country. Check before giving abroad.",
    ],
    body: (
        <>
            <Note title="Not tax advice">
                <p>This guide explains the general rules as published by tax authorities and reported in November 2026. Your situation may differ, and rules change. Check with your tax authority or a tax adviser before you file.</p>
            </Note>

            <h2>Are donations tax-deductible in the US in 2026?</h2>
            <p>
                Yes, if you give to a qualifying charity, usually a 501(c)(3) organization. You can check eligibility in the <A href="https://www.irs.gov/teos">IRS Tax Exempt Organization Search</A>. What changes in 2026 is <em>who</em> can deduct and <em>how much</em>.
            </p>
            <h3>If you take the standard deduction</h3>
            <p>
                Starting with tax year 2026, you can deduct cash gifts to qualifying charities of up to <strong>$1,000</strong>, or <strong>$2,000</strong> on a joint return, even though you don't itemize. The IRS describes this as a permanent provision. The fine print:
            </p>
            <ul>
                <li>Only <strong>cash</strong> gifts count (including card, check and bank transfer). Clothing, stock and other property don't.</li>
                <li>Gifts to <strong>donor-advised funds</strong> generally don't qualify.</li>
                <li>Gifts to <strong>individuals</strong> don't qualify, including personal crowdfunding.</li>
            </ul>
            <h3>If you itemize</h3>
            <p>
                From 2026 you can only deduct charitable gifts above <strong>0.5% of your adjusted gross income</strong>. If your AGI is $100,000, the first $500 of gifts isn't deductible. The IRS says amounts you can't deduct are added to any charitable carryover. Cash gifts to public charities remain limited to 60% of AGI.
            </p>
            <h3>What records do you need?</h3>
            <ul>
                <li><strong>Any cash gift:</strong> a bank record (statement or card record showing the charity, date and amount) or a written receipt from the charity.</li>
                <li><strong>Any single gift of $250 or more:</strong> a contemporaneous written acknowledgment from the charity. An emailed receipt that states the amount and whether you received anything in return usually does it.</li>
            </ul>
            <p>
                Gifts to <strong>foreign charities</strong> generally aren't deductible for US taxpayers, with limited exceptions. Some international charities have a US affiliate you can give through.
            </p>

            <h2>How does tax relief on donations work in Europe?</h2>
            <p>Every country does it differently. Here are five of the largest systems.</p>
            <Table
                head={["Country", "How relief works", "Limits and paperwork"]}
                rows={[
                    ["Germany", "Deducted from taxable income as Sonderausgaben", "Up to 20% of total income. Gifts up to €300: a bank statement is enough. Above that you need a Zuwendungsbestätigung from the charity"],
                    ["France", "66% of the gift comes off your income tax; 75% for organizations helping people in difficulty", "66% relief is capped at gifts worth 20% of taxable income, with the excess carried forward five years. The 75% rate applies to gifts up to €2,000, a cap raised by the 2026 Finance Law"],
                    ["Netherlands", "One-off gifts to an ANBI are deductible above a threshold", "Threshold is 1% of income (minimum €60); maximum 10% of income. Periodic gifts under a 5-year agreement have no threshold. Cash gifts aren't deductible"],
                    ["Spain", "Tax credit: 80% on the first €250, 40% above that", "45% instead of 40% if you gave the same or more to the same charity in the two previous years. The base is limited to 10% of taxable income"],
                    ["Ireland", "The charity claims the tax back under the Charitable Donation Scheme", "Gifts of €250 or more a year to one approved body. The charity reclaims tax at a 31% grossed-up rate"],
                ]}
            />

            <h3>Germany</h3>
            <p>
                Under <A href="https://www.gesetze-im-internet.de/estg/__10b.html">§ 10b EStG</A>, donations to tax-privileged causes are deductible as special expenses (Sonderausgaben) up to 20% of your total income. For smaller gifts, up to €300, a bank statement or transfer record that clearly shows the gift usually replaces a formal receipt. Above that, ask the charity for a Zuwendungsbestätigung.
            </p>

            <h3>France</h3>
            <p>
                A gift to a qualifying organization gives you a <strong>66% income tax reduction</strong>. €100 costs you €34 after tax, within a cap of 20% of taxable income, and any excess can be carried forward five years. Gifts to organizations providing meals, housing or care to people in difficulty get <strong>75%</strong>. The 2026 Finance Law raised the cap for that rate from €1,000 to €2,000, and the amount above it falls back to 66%.
            </p>

            <h3>Netherlands</h3>
            <p>
                Only gifts to an <strong>ANBI</strong> (a recognized public-benefit institution) count. You can check status on the Belastingdienst's ANBI search. One-off gifts are deductible for the part above 1% of your threshold income, with a minimum threshold of €60, up to 10% of income. Periodic gifts, made under a written agreement for at least five years, are deductible without the threshold. Cash handed over in person isn't deductible.
            </p>

            <h3>Spain</h3>
            <p>
                Gifts to organizations covered by Law 49/2002 earn a credit of <strong>80% on the first €250</strong> and 40% on the rest. That rises to 45% if you gave at least as much to the same organization in each of the two previous years. Some regions add their own credit on top.
            </p>

            <h3>Ireland</h3>
            <p>
                Under the <A href="https://www.revenue.ie/en/tax-professionals/tdm/income-tax-capital-gains-tax-corporation-tax/part-36/36-00-17.pdf">Charitable Donation Scheme</A>, if you give an approved body at least €250 in a year, the charity can reclaim the tax you paid on it. Revenue's own example: a €1,000 gift is grossed up to €1,449.28, so the charity receives an extra €449.28. The donor doesn't get a refund directly.
            </p>

            <h2>Can you deduct a gift to a charity in another country?</h2>
            <p>
                Usually only if the charity is recognized in your own country. EU law says a cross-border gift to an equivalent charity in another member state shouldn't be treated worse than a domestic one, but in practice each tax office sets its own proof requirements. Many international charities have local branches or partner foundations so donors in each country get relief. Ask the charity before you give.
            </p>

            <h2>Is a donation to a GoFundMe-style fundraiser tax-deductible?</h2>
            <p>
                Only when the money goes to a registered charity. A personal fundraiser for a person or family isn't a charitable donation for tax purposes in the US, and generally isn't in Europe. If tax relief matters to you, give through the charity's own fundraising page. Our guide on <a href="/blog/how-to-check-a-charity-is-legitimate">checking that a charity is legitimate</a> shows how to confirm its status.
            </p>
        </>
    ),
    faq: [
        ["Can I deduct charitable donations if I don't itemize in 2026?", "Yes. Starting in tax year 2026, US taxpayers who take the standard deduction can deduct up to $1,000 of cash gifts to qualifying charities, or $2,000 for married couples filing jointly. Gifts to donor-advised funds don't count."],
        ["What is the 0.5% floor for charitable deductions?", "From 2026, US taxpayers who itemize can only deduct charitable gifts above 0.5% of their adjusted gross income. With an AGI of $100,000, the first $500 isn't deductible."],
        ["Is a GoFundMe donation tax-deductible?", "Not if it goes to an individual. It's deductible only when the fundraiser pays a registered, qualifying charity."],
        ["What receipt do I need for a donation?", "In the US, a bank record or receipt for any cash gift, and a written acknowledgment from the charity for single gifts of $250 or more. In Germany, a bank statement is enough up to €300; above that you need a Zuwendungsbestätigung."],
        ["How much tax relief do I get on donations in France?", "66% of the gift comes off your income tax, up to gifts worth 20% of taxable income, or 75% for organizations that help people in difficulty, on gifts up to €2,000."],
        ["Can I get tax relief for donating to a charity in another EU country?", "Sometimes. Countries must not discriminate against equivalent charities in other member states, but the proof required varies. The simplest route is to give through a branch or partner foundation in your own country."],
    ],
    sources: [
        ["IRS: Working Families Tax Cuts (2026 charitable provisions)", "https://www.irs.gov/newsroom/working-families-tax-cuts"],
        ["IRS: Charitable contribution deduction tips for non-itemizers (Pub. 6196)", "https://www.irs.gov/pub/irs-pdf/p6196.pdf"],
        ["IRS: Topic 506, Charitable contributions", "https://www.irs.gov/taxtopics/tc506"],
        ["IRS: Publication 526", "https://www.irs.gov/publications/p526"],
        ["IRS: Tax Exempt Organization Search", "https://www.irs.gov/teos"],
        ["Germany: § 10b Einkommensteuergesetz", "https://www.gesetze-im-internet.de/estg/__10b.html"],
        ["France: Légifiscal, réduction d'impôt pour les dons des particuliers", "https://www.legifiscal.fr/impots-personnels/impot-revenu/reductions-impot/la-reduction-dimpot-pour-les-dons-realises-par-les-particuliers.html"],
        ["Netherlands: Belastingdienst, giften aftrekken", "https://belastingdienst.nl/giften"],
        ["Spain: Consejo General de Gestores, incentivos fiscales al mecenazgo", "https://www.consejogestores.org/?p=10557"],
        ["Ireland: Revenue, Charitable Donation Scheme (Tax and Duty Manual 36-00-17)", "https://www.revenue.ie/en/tax-professionals/tdm/income-tax-capital-gains-tax-corporation-tax/part-36/36-00-17.pdf"],
    ],
};
