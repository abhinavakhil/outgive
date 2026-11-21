import type { Post } from "../posts";
import { A, Note, Table } from "./kit";

export const checkCharity: Post = {
    slug: "how-to-check-a-charity-is-legitimate",
    title: "How to check a charity is legitimate before you donate (US and Europe)",
    description: "A five-minute check before you give: official charity registers and trust seals in the US, UK, Ireland, Germany, the Netherlands and France, the red flags the FTC warns about, and how to vet a crowdfunding page.",
    audience: "donors",
    published: "2026-11-06",
    updated: "2026-11-06",
    minutes: 6,
    answer: "To check a charity is legitimate, look it up in its country's official register. In the US that's the IRS Tax Exempt Organization Search; in Europe it's the national charity register or a trust seal such as Germany's DZI or the Netherlands' CBF. Then check how it asks for money. Pressure to give immediately, or requests for cash, gift cards, crypto or wire transfers, are classic scam signs.",
    takeaways: [
        "US: confirm the organization in the IRS Tax Exempt Organization Search, then read its profile on Charity Navigator, the BBB Wise Giving Alliance or Candid.",
        "Europe: use the national register or trust seal, such as the Charity Commission (England and Wales), Charities Regulator (Ireland), DZI Spenden-Siegel (Germany), CBF and the ANBI list (Netherlands) and Don en Confiance (France).",
        "Red flags from the FTC: pressure to give right now, vague answers about how money is used, look-alike names, and requests for cash, gift cards, cryptocurrency or wire transfers.",
        "For a crowdfunding page, check who the organizer is, how they know the beneficiary, and where the money is paid.",
        "Pay by card or a secure checkout, never by gift card or wire, and keep your receipt.",
    ],
    body: (
        <>
            <p>
                Most charities are what they say they are. But scammers know that people give fast when there's a disaster, a moving story or a deadline. Five minutes of checking protects your money and makes sure it reaches people who need it.
            </p>

            <h2>Step 1: Is it a registered charity?</h2>
            <p>Every country below keeps an official list. Search for the exact name and check that the registration number matches what the charity shows on its website or receipts.</p>
            <Table
                head={["Country", "Where to check", "What it tells you"]}
                rows={[
                    ["United States", <A key="us" href="https://www.irs.gov/teos">IRS Tax Exempt Organization Search</A>, "Whether the organization is tax-exempt and eligible to receive tax-deductible gifts"],
                    ["England and Wales", <A key="uk" href="https://register-of-charities.charitycommission.gov.uk/">Charity Commission register</A>, "Registration, trustees and annual accounts"],
                    ["Ireland", <A key="ie" href="https://www.charitiesregulator.ie/">Charities Regulator</A>, "Whether the charity is on the public register"],
                    ["Germany", <A key="de" href="https://www.dzi.de/spendenberatung/spenden-siegel/was-sagt-das-spenden-siegel-aus/">DZI Spenden-Siegel</A>, "A voluntary seal; standards are checked every year"],
                    ["Netherlands", <A key="nl" href="https://cbf.nl/register-erkende-goede-doelen">CBF register</A>, "CBF recognition, plus ANBI status on the tax office's website (needed for tax relief)"],
                    ["France", <A key="fr" href="https://www.donenconfiance.org/">Don en Confiance</A>, "A label for organizations that meet its ethics and transparency rules"],
                ]}
            />
            <p>
                A seal is voluntary, so a small, honest charity may not have one. But a registration is the floor. If an organization claims to be a charity and you can't find it in the official register, don't give until you can.
            </p>

            <h2>Step 2: Read its profile</h2>
            <p>
                In the US, <A href="https://www.charitynavigator.org/">Charity Navigator</A> rates charities using data from the IRS, partners and the charities themselves. The BBB Wise Giving Alliance (give.org) and Candid (formerly GuideStar) publish standards checks and filings. Most US states also require charities and their fundraisers to register with the state charity regulator, which you can find through <A href="https://www.nasconet.org/">NASCO</A>. In Germany, the DZI seal has its own cap on advertising and administration spending and checks governance, audited accounts and reasonable pay every year. In the Netherlands, the CBF lists more than 700 recognized charities.
            </p>
            <p>When you read a profile, look for:</p>
            <ul>
                <li>Recent annual accounts or a recent tax filing.</li>
                <li>A clear description of programs and where they run.</li>
                <li>Named leaders and a board.</li>
                <li>A physical address and a way to contact a real person.</li>
            </ul>

            <h2>What are the red flags of a charity scam?</h2>
            <p>The US Federal Trade Commission's guide to <A href="https://consumer.ftc.gov/features/how-donate-wisely-and-avoid-charity-scams">donating safely</A> names these warning signs:</p>
            <ul>
                <li><strong>They want cash, gift cards, cryptocurrency, a wire transfer or a payment app.</strong> The FTC says a request to donate this way is a likely sign of a scam.</li>
                <li><strong>They pressure you to give right now.</strong> Legitimate charities will take your gift tomorrow.</li>
                <li><strong>They're vague about how money is used.</strong> "Helping victims" with no detail on who, where or how.</li>
                <li><strong>They appeared overnight after a disaster.</strong> Be extra careful with brand-new groups tied to current events.</li>
                <li><strong>They promise a prize.</strong> Guaranteeing sweepstakes winnings in exchange for a donation is illegal.</li>
                <li><strong>The name is almost right.</strong> Scammers use names that sound like well-known charities. Check the spelling and the web address.</li>
                <li><strong>A friend shared it.</strong> A share doesn't make a cause legitimate. Check where the donation link actually goes before you give.</li>
            </ul>
            <p>
                In the US, report a suspected charity scam to the FTC at <A href="https://reportfraud.ftc.gov/">ReportFraud.ftc.gov</A>. In Europe, report it to the national police fraud line or the charity regulator.
            </p>

            <h2>How do you vet a crowdfunding page?</h2>
            <p>Personal fundraisers aren't charities, so there's no register to check. Instead, ask:</p>
            <ul>
                <li><strong>Who is the organizer, and how do they know the beneficiary?</strong> The page should say.</li>
                <li><strong>Where does the money go?</strong> Directly to a named charity's account, or to an individual? If it says it's for a charity, check that the charity knows about it.</li>
                <li><strong>Are there updates?</strong> Real fundraisers usually post progress, receipts or photos.</li>
                <li><strong>Can you reach the organizer?</strong> Through the platform, or through someone you know who knows them?</li>
            </ul>
            <p>
                Remember that gifts to individuals aren't tax-deductible in the US, even on a crowdfunding site. If a tax deduction matters to you, give through a registered charity. Our <a href="/blog/are-donations-tax-deductible">tax guide for US and European donors</a> explains the rules.
            </p>

            <Note title="The five-minute checklist">
                <p>1. Find the charity in the official register for its country.</p>
                <p>2. Check that the name and number match its website and receipts.</p>
                <p>3. Read a recent annual report or rating profile.</p>
                <p>4. Give through its own website or a known platform, by card or a secure checkout.</p>
                <p>5. Keep the receipt or confirmation email for your records and taxes.</p>
            </Note>

            <h2>Safer ways to give</h2>
            <ul>
                <li><strong>Go to the charity yourself.</strong> Type the address or search for it, rather than clicking a link in an unexpected message.</li>
                <li><strong>Pay by card or a trusted checkout.</strong> Card payments can be disputed; gift cards and wires can't.</li>
                <li><strong>Check where the money lands.</strong> On platforms where gifts are paid straight into the charity's own account, as on Outgive, the money doesn't sit with a middleman. Your receipt names the charity you actually gave to.</li>
            </ul>
        </>
    ),
    faq: [
        ["How do I check if a charity is legitimate in the US?", "Search for it in the IRS Tax Exempt Organization Search at irs.gov/teos to confirm it's tax-exempt and eligible for deductible gifts. Then read its profile on Charity Navigator, the BBB Wise Giving Alliance or Candid."],
        ["How do I check a charity in Europe?", "Use the national register or trust seal: the Charity Commission register for England and Wales, the Charities Regulator in Ireland, the DZI Spenden-Siegel in Germany, the CBF register and ANBI list in the Netherlands, and the Don en Confiance label in France."],
        ["What are the signs of a charity scam?", "Requests for cash, gift cards, crypto or wire transfers, pressure to give immediately, vague answers about how money is used, a name that imitates a well-known charity, and promises of prizes in exchange for a donation."],
        ["Is it safe to donate through a crowdfunding site?", "Generally, yes, through a well-known platform. Check who the organizer is, how they know the beneficiary, and whether the money goes to a person or directly to a charity."],
        ["Where do I report a charity scam?", "In the US, report it to the FTC at ReportFraud.ftc.gov. In Europe, contact your national police fraud reporting line or the charity regulator."],
    ],
    sources: [
        ["IRS: Tax Exempt Organization Search", "https://www.irs.gov/teos"],
        ["FTC: Donating safely and avoiding scams", "https://consumer.ftc.gov/features/how-donate-wisely-and-avoid-charity-scams"],
        ["NASCO: state charity regulators", "https://www.nasconet.org/"],
        ["FTC: ReportFraud", "https://reportfraud.ftc.gov/"],
        ["Charity Navigator", "https://www.charitynavigator.org/"],
        ["Charity Commission for England and Wales: register of charities", "https://register-of-charities.charitycommission.gov.uk/"],
        ["Charities Regulator (Ireland)", "https://www.charitiesregulator.ie/"],
        ["DZI: what the Spenden-Siegel means", "https://www.dzi.de/spendenberatung/spenden-siegel/was-sagt-das-spenden-siegel-aus/"],
        ["CBF: register of recognized charities", "https://cbf.nl/register-erkende-goede-doelen"],
        ["Don en Confiance", "https://www.donenconfiance.org/"],
    ],
};
