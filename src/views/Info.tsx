import { ArrowLeft } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Container, SiteHeader, useApp } from "@/components/outgive/shared";
import { CURRENCIES } from "@/data";
import { ANALYTICS, LEGAL, LEGAL_DRAFT, SITE } from "@/seo";

const RULES: [string, string][] = [
    ["Outgive to outrank.", "To take a rank, give at least one unit more than the supporter currently holding it."],
    ["The whole gift goes to the charity.", "The board keeps no share and charges no listing fee."],
    ["Anyone can hold a rank.", "A person, a team, a company or a school. Fundraising pages count every gift they receive toward their rank."],
    ["Ranks are never locked.", "Any rank, including #1, can be taken at any time."],
    ["Today resets at 00:00 UTC, the week every Monday.", "The all-time board never resets, and each week's winner stays in the hall of fame."],
    ["There is more than one race.", "Besides money given, boards rank donors recruited and months given in a row, so a small gift can still lead."],
    ["Your name is your choice.", "Show a name you pick, or give anonymously. An anonymous gift still counts toward its team, company or school."],
    ["A rank holds for cleared payments only.", "It appears when the payment clears and drops if the gift is refunded or disputed."],
    ["Gifts are final.", "Being outranked later does not make a gift refundable."],
];
const FAQ: [string, string][] = [
    ["I'm already on the board. Can I climb?", "Yes. Claim with the same name and your new gift is added to your total."],
    ["Which currencies are supported?", `${Object.keys(CURRENCIES).join(", ")}. Ranks are compared in US dollars; other currencies use indicative rates.`],
    ["What can I set up?", "A fundraiser, campaign, team, challenge, event or in-memory page. All six use the same seven steps and the same 12 layouts."],
    ["Can my charity have one of these?", "Yes. The board is white-label: your name, logo, colour, font and ranking layout. Try it with the \"Your branding\" button on the leaderboard."],
    ["Is this live?", "This build is a working front-end demo. Supporters and figures are fictional and nothing leaves your browser."],
];

/** Plain-language terms. A starting draft: have it checked for the countries you operate in before relying on it. */
const TERMS: [string, string[]][] = [
    ["Who we are", [`${SITE.name} is run by ${LEGAL.company}, ${LEGAL.address}. You can reach us at ${LEGAL.email}.`]],
    ["What this site is today", [`${SITE.name} is in early access. The leaderboards and fundraising pages on this site are a working demonstration: the supporters and figures shown are fictional unless a page says otherwise, and the site takes no payments.`, "Nothing you do here is a donation, and nothing shown here is a receipt or proof of a gift."]],
    ["Using the site", ["You may use the site to explore the product and to set up demonstration pages.", "Do not use it to break the law, to pretend to be another person or organisation, to post names or text that are offensive or misleading, or to interfere with how the site runs."]],
    ["What you add", ["Names, messages and pages you create are saved in your own browser and are your responsibility. Do not add personal details about someone else without their agreement.", "We may remove content from live boards that breaks these terms or that a charity asks us to remove."]],
    ["Charities and gifts", [`${SITE.name} is software, not a charity, and does not hold donations. When live boards launch, a gift will go from the supporter to the charity's own payment account, and the charity is responsible for how it is used and for any receipt.`, "A rank on a board is a form of recognition. It is not a purchase, and being outranked later does not make a gift refundable."]],
    ["Our content", ["The design, text and software of the site belong to us or to those who license them to us. Charities keep the rights to their own names, logos and content."]],
    ["No guarantees", ["The site is provided as it is. We work to keep it accurate and available but do not promise that it always will be.", "To the extent the law allows, we are not liable for losses that arise from using the site. Nothing in these terms limits liability that cannot be limited by law."]],
    ["Changes and governing law", [`We may update these terms and will change the date at the top when we do. They are governed by the law of ${LEGAL.law}.`]],
];
const privacy = (): [string, string[]][] => [
    ["Who we are", [`${SITE.name} is run by ${LEGAL.company}, ${LEGAL.address}. For anything about your data, write to ${LEGAL.email}.`]],
    ["What stays in your browser", ["What you type on the demo, such as a display name, a message, a gift amount, your theme and any fundraising page you set up, is saved in your browser's local storage so the site remembers it. It is not sent to our servers.", "Clearing your browser's site data removes all of it."]],
    ["Analytics", ANALYTICS.websiteId
        ? ["We use Umami, an open-source analytics tool, to count visits. It sets no cookies and does not build a profile of you. For each page view it records the page address, the referring site, your browser and device type, your screen size, your language and an approximate country.", "We also count a small number of actions, such as opening the claim dialog, without recording names or any text you typed. If your browser sends a Do Not Track signal, nothing is recorded."]
        : ["We do not run analytics on this site at present. If that changes we will update this page first."]],
    ["Fonts", ["The site loads its typeface from Google Fonts. When your browser fetches it, Google receives your IP address, as with any request to a website."]],
    ["Payments", ["The site takes no payments today, so we hold no card or bank details. When live boards launch, payments will be handled by a payment provider on behalf of the charity, and this page will be updated before then."]],
    ["Names on a board", ["Appearing on a leaderboard is your choice. You can give under a name you pick or as Anonymous."]],
    ["Your rights", [`Depending on where you live, you may have the right to see, correct or delete personal data held about you, and to object to how it is used. Write to ${LEGAL.email} and we will reply within one month.`]],
    ["Children", ["The site is not aimed at children, and we do not knowingly collect their data."]],
    ["Changes", ["We will update this page when what we collect changes, and change the date at the top."]],
];

export const Info = ({ kind }: { kind: "about" | "rules" | "faq" | "terms" | "privacy" }) => {
    const { go, brand } = useApp();
    return (
        <div className="min-h-dvh bg-primary"><Container className="flex max-w-3xl flex-col gap-10 py-5">
            <SiteHeader right={<Button color="secondary" size="sm" className="rounded-full" iconLeading={ArrowLeft} onPress={() => go({ name: "home" })}>Leaderboard</Button>} />
            {kind === "about" && <article className="flex flex-col gap-4 text-md text-tertiary">
                <h1 className="text-display-sm font-semibold text-primary">About</h1>
                <p>This is the <span className="font-semibold text-primary">{brand.name}</span> leaderboard, run on <span className="font-semibold text-primary">Outgive</span>. It has one rule: your rank is set by what you have given to {brand.name}. Anyone can move up by giving more than the supporter above them.</p>
                <p>Seeing your own name on the board, and knowing exactly what it takes to climb, is what makes people give again. The board takes nothing from a gift.</p>
                <p>Outgive is white-label. Any charity can run its own board with its own name, logo, colour, font and ranking layout. Supporters can also set up fundraising pages, in 12 layouts, and every gift to a page counts toward its rank.</p>
            </article>}
            {kind === "rules" && <article className="flex flex-col gap-4"><h1 className="text-display-sm font-semibold text-primary">Rules</h1>
                <ol className="flex flex-col gap-3">{RULES.map(([a, b], i) => (<li key={a} className="flex gap-4 rounded-2xl p-4 ring-1 ring-secondary ring-inset"><span className="font-semibold text-brand-secondary">{i + 1}</span><span className="text-tertiary"><span className="font-semibold text-primary">{a}</span> {b}</span></li>))}</ol>
            </article>}
            {(kind === "terms" || kind === "privacy") && <article className="flex flex-col gap-6 pb-12">
                <div><h1 className="text-display-sm font-semibold text-primary">{kind === "terms" ? "Terms of use" : "Privacy policy"}</h1><p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-tertiary">Last updated {LEGAL.updated}{LEGAL_DRAFT && <span className="rounded-full bg-warning-primary px-2 py-0.5 text-xs font-semibold text-warning-primary">Draft: company details to be added</span>}</p></div>
                {(kind === "terms" ? TERMS : privacy()).map(([t, ps], i) => <section key={t} className="border-t border-secondary pt-5"><h2 className="text-lg font-semibold text-primary">{i + 1}. {t}</h2>{ps.map((p) => <p key={p} className="mt-2 max-w-prose text-md text-tertiary">{p}</p>)}</section>)}
                <p className="text-sm text-tertiary">See also the {kind === "terms" ? <a href="/privacy" onClick={(e) => { e.preventDefault(); go({ name: "privacy" }); }} className="font-semibold text-primary underline underline-offset-2">privacy policy</a> : <a href="/terms" onClick={(e) => { e.preventDefault(); go({ name: "terms" }); }} className="font-semibold text-primary underline underline-offset-2">terms of use</a>} and the <a href="/rules" onClick={(e) => { e.preventDefault(); go({ name: "rules" }); }} className="font-semibold text-primary underline underline-offset-2">leaderboard rules</a>.</p>
            </article>}
            {kind === "faq" && <article className="flex flex-col gap-4"><h1 className="text-display-sm font-semibold text-primary">FAQ</h1>
                {FAQ.map(([q, a]) => (<section key={q} className="border-t border-secondary pt-4"><h2 className="text-lg font-semibold text-primary">{q}</h2><p className="mt-1 text-tertiary">{a}</p></section>))}
            </article>}
        </Container></div>
    );
};
