import { ArrowLeft } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Container, SiteHeader, useApp } from "@/components/outgive/shared";
import { CURRENCIES } from "@/data";

const RULES: [string, string][] = [
    ["Outgive to outrank.", "To take a rank, give at least one unit more than the supporter currently holding it."],
    ["The whole gift goes to the charity.", "The board keeps no share and charges no listing fee."],
    ["Anyone can hold a rank.", "A person, a team, a company or a school. Fundraising pages count every gift they receive toward their rank."],
    ["Ranks are never locked.", "Any rank, including #1, can be taken at any time."],
    ["Today resets at 00:00 UTC.", "The all-time board never resets."],
    ["Gifts are final.", "Being outranked later does not make a gift refundable."],
];
const FAQ: [string, string][] = [
    ["I'm already on the board. Can I climb?", "Yes. Claim with the same name and your new gift is added to your total."],
    ["Which currencies are supported?", `${Object.keys(CURRENCIES).join(", ")}. Ranks are compared in US dollars; other currencies use indicative rates.`],
    ["What can I set up?", "A fundraiser, campaign, team, challenge, event or in-memory page. All six use the same seven steps and the same 12 layouts."],
    ["Can my charity have one of these?", "Yes. The board is white-label: your name, logo, colour, font and ranking layout. Try it with the \"Your branding\" button on the leaderboard."],
    ["Is this live?", "This build is a working front-end demo. Supporters and figures are fictional and nothing leaves your browser."],
];

export const Info = ({ kind }: { kind: "about" | "rules" | "faq" }) => {
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
            {kind === "faq" && <article className="flex flex-col gap-4"><h1 className="text-display-sm font-semibold text-primary">FAQ</h1>
                {FAQ.map(([q, a]) => (<section key={q} className="border-t border-secondary pt-4"><h2 className="text-lg font-semibold text-primary">{q}</h2><p className="mt-1 text-tertiary">{a}</p></section>))}
            </article>}
        </Container></div>
    );
};
