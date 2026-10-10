import { ArrowLeft } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Container, SiteHeader, useApp } from "@/components/outgive/shared";
import { CAUSES, CURRENCIES } from "@/data";

const RULES: [string, string][] = [
    ["Outgive to outrank.", "To take a rank, give at least one unit more than the charity currently holding it."],
    ["The gift goes to the charity.", "The board keeps no share and charges no listing fee."],
    ["Registered charities only.", "A listing needs a registration number from the charity's home regulator, checked before it appears."],
    ["Ranks are never locked.", "Any rank, including #1, can be taken at any time."],
    ["Today resets at 00:00 UTC.", "The all-time board never resets."],
    ["Gifts are final.", "Being outranked later does not make a gift refundable."],
];
const FAQ: [string, string][] = [
    ["Can I give to a charity that's already listed?", "Yes. Enter its exact name when you claim, and its amount is raised to yours."],
    ["Which currencies are supported?", `${Object.keys(CURRENCIES).join(", ")}. Ranks are compared in US dollars; other currencies use indicative rates.`],
    ["What can I set up?", "A fundraiser, campaign, team, challenge, event or in-memory page. All six use the same seven steps and the same 12 layouts."],
    ["Is this live?", "This build is a working front-end demo. Charities and figures are fictional and nothing is stored after you reload."],
];

export const Info = ({ kind }: { kind: "about" | "rules" | "faq" }) => {
    const { go } = useApp();
    return (
        <div className="min-h-dvh bg-primary"><Container className="flex max-w-3xl flex-col gap-10 py-5">
            <SiteHeader right={<Button color="secondary" size="sm" className="rounded-full" iconLeading={ArrowLeft} onPress={() => go({ name: "home" })}>Leaderboard</Button>} />
            {kind === "about" && <article className="flex flex-col gap-4 text-md text-tertiary">
                <h1 className="text-display-sm font-semibold text-primary">About</h1>
                <p><span className="font-semibold text-primary">Outgive</span> is a leaderboard with one rule: a charity's rank is set by the largest gift made in its name. Anyone can move a charity up by giving more than the charity above it.</p>
                <p>There are no ads and no sponsored slots. The board takes nothing from a gift, and each listing sends visitors straight to the charity's own site.</p>
                <p>Charities from any country can be listed under any of {CAUSES.length} causes. Supporters can also set up their own fundraising pages and choose how they look.</p>
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
