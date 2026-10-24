import type { ReactNode } from "react";
import { ArrowRight, Brush03, Calendar, Check, EyeOff, Heart, LayoutGrid01, Trophy01, Users01 } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { Container, type Go, Logo, ThemeToggle, useApp } from "@/components/outgive/shared";
import { SUPPORTERS, initials } from "@/data";
import { cx } from "@/utils/cx";

/** Questions a charity asks before trying a leaderboard. Shown on the page and published as FAQ structured data, so the two can never disagree. */
export const LANDING_FAQ: [string, string][] = [
    ["What is a charity leaderboard?", "A public ranking of the people, teams, companies and schools supporting a cause, ordered by what they have given or raised. Supporters see where they stand and what it takes to move up."],
    ["How is Outgive different from a leaderboard widget?", "A widget is a list beside a donate button. On an Outgive board the rank is the reason to give: every place shows the exact amount that takes it, one unit more than its current holder, and every visitor is shown the price of the next place up."],
    ["Do supporters have to appear in public?", "No. Showing a name is the supporter's choice at the moment of giving. An anonymous gift still counts toward its team, company or school."],
    ["Does ranking by money put off small donors?", "It can, so money is not the only race. Boards also rank by gifts this week, gifts today, donors recruited and months given in a row, and each can be filtered to individuals, teams, companies or schools."],
    ["Can the board carry our own name, logo and colours?", "Yes. The board is white-label: your charity's name, logo, colour, font and one of 29 ranking layouts. You can try that on the live demo in a few seconds."],
    ["Does Outgive take a share of donations?", "No. The board keeps no share of a gift and charges supporters nothing."],
    ["Is Outgive live?", "Outgive is in early access. The demo on this site is a working board with fictional supporters, and it takes no payments."],
];

const STEPS: [string, string][] = [
    ["Put your supporters on a board", "Your charity gets one public leaderboard on its own name and colours. Individuals, teams, companies and schools each have their own race."],
    ["Every rank shows its price", "\"Claim for $18,901\" sits on first place and a price sits on every place below it. Passing someone costs one unit more than they have given."],
    ["People climb by giving and by recruiting", "A supporter's rank is their own gifts plus everything their fundraising page brings in, so the fastest way up is to bring friends."],
];
const FEATURES: [typeof Trophy01, string, string][] = [
    [Trophy01, "Rank is the reason to give", "A live price on every place, and a \"next rank up\" ask for the donor in 27th as well as the one chasing first."],
    [Calendar, "A race anyone can win", "All-time, this week and today, plus boards for donors recruited and for months given in a row. The week resets every Monday."],
    [Brush03, "Your brand, not ours", "Your name, logo, colour and font. The board recolours to match and reads as part of your site."],
    [Users01, "Built for groups", "Companies, teams and schools are the natural competitors. A company can pledge to match gifts and show it on the board."],
    [EyeOff, "Recognition by choice", "Names are opt-in and anonymous giving is one tick. That is what the research on public recognition says works."],
    [LayoutGrid01, "29 ranking layouts", "From a plain list to a podium, a league table, a ladder or a stadium scoreboard. Pick the one that suits your campaign."],
];
const USES: [string, string][] = [
    ["Giving days", "A dated race with a final-hour push. Put the board on the big screen and let supporters outgive each other."],
    ["Schools and universities", "Class against class, house against house, one alumni year against the next."],
    ["Company challenges", "Offices or local firms competing for one charity, with matched giving shown on the board."],
    ["Galas and events", "A live board in the room, updating as pledges come in."],
    ["Faith and community appeals", "Boards for mosques, churches and community groups, with anonymous giving for those who prefer to give privately."],
];

const Section = ({ id, eyebrow, title, lead, children, className }: { id?: string; eyebrow: string; title: string; lead?: string; children: ReactNode; className?: string }) => (
    <section id={id} className={cx("scroll-mt-20 py-14 md:py-20", className)}><Container>
        <p className="text-sm font-semibold text-brand-secondary">{eyebrow}</p>
        <h2 className="mt-2 max-w-3xl text-display-xs font-semibold tracking-tight text-balance text-primary md:text-display-sm">{title}</h2>
        {lead && <p className="mt-3 max-w-2xl text-lg text-tertiary">{lead}</p>}
        <div className="mt-9">{children}</div>
    </Container></section>
);

/** The product page: what Outgive is, why it works and where to try it. Written for a charity deciding whether to run a board. */
export const Landing = () => {
    const { go, href, money } = useApp();
    /** Real links, so crawlers and "open in new tab" work, with in-app navigation on click. */
    const A = ({ to, className, children, event }: { to: Go; className?: string; children: ReactNode; event?: string }) => <a href={href(to)} data-umami-event={event} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(to); }} className={cx("outline-focus-ring focus-visible:outline-2", className)}>{children}</a>;
    const primary = "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-solid px-6 text-md font-semibold text-white shadow-xs transition hover:bg-brand-solid_hover";
    const secondary = "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-md font-semibold text-secondary ring-1 ring-primary transition ring-inset hover:bg-secondary";
    const top = SUPPORTERS.slice(0, 5);
    return (
        <div className="min-h-dvh bg-primary">
            <header className="sticky top-0 z-30 border-b border-secondary bg-primary/90 backdrop-blur"><Container className="flex items-center justify-between gap-3 py-3">
                <Logo onClick={() => go({ name: "landing" })} />
                <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium text-tertiary sm:gap-5">
                    <a href="#how" className="rounded hover:text-primary max-md:hidden">How it works</a>
                    <a href="#features" className="rounded hover:text-primary max-md:hidden">Features</a>
                    <a href="#faq" className="rounded hover:text-primary max-md:hidden">FAQ</a>
                    <ThemeToggle />
                    <A to={{ name: "home" }} className="inline-flex h-9 items-center rounded-full bg-brand-solid px-4 text-sm font-semibold text-white hover:bg-brand-solid_hover">Live demo</A>
                </nav>
            </Container></header>

            <main>
                <section className="pt-12 pb-14 md:pt-20 md:pb-20"><Container className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="flex flex-col items-start gap-5">
                        <span className="rounded-full bg-brand-secondary px-3 py-1 text-xs font-semibold text-brand-secondary">Charity leaderboard software · early access</span>
                        <h1 className="text-display-md font-semibold tracking-tight text-balance text-primary md:text-display-xl">The fundraising leaderboard that makes supporters give more</h1>
                        <p className="max-w-xl text-lg text-tertiary md:text-xl">Outgive puts your supporters on a public board under your own brand. Every rank has a price, so people give more to take it, and bring their friends to hold it.</p>
                        <div className="flex flex-wrap gap-3"><A to={{ name: "home" }} event="cta-demo-hero" className={primary}>See the live demo<ArrowRight className="size-5" /></A><A to={{ name: "create" }} event="cta-create-hero" className={secondary}>Start a fundraising page</A></div>
                        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-tertiary">{["No share taken from gifts", "Your name, logo and colours", "Names shown only by choice"].map((t) => <li key={t} className="flex items-center gap-1.5"><Check aria-hidden="true" className="size-4 text-brand-secondary" />{t}</li>)}</ul>
                    </div>
                    <figure className="rounded-3xl bg-secondary p-3 ring-1 ring-secondary ring-inset md:p-4">
                        <figcaption className="flex items-center justify-between px-2 pb-3 text-sm"><span className="font-semibold text-primary">Clearwell Trust · all-time ranking</span><span className="text-xs text-tertiary">demo data</span></figcaption>
                        <ol className="flex flex-col gap-1.5">{top.map((o, i) => (
                            <li key={o.id} className={cx("flex items-center gap-3 rounded-2xl px-3.5 py-3", i === 0 ? "bg-brand-secondary" : "bg-primary")}>
                                <span className={cx("w-7 text-sm font-semibold tabular-nums", i < 3 ? "text-brand-secondary" : "text-tertiary")}>#{i + 1}</span><Avatar size="sm" initials={initials(o.name)} />
                                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary">{o.name}</span><span className="block truncate text-xs text-tertiary">claim for {money(o.total + 1)}</span></span>
                                <span className="text-sm font-semibold text-brand-secondary tabular-nums">{money(o.total)}</span>
                            </li>
                        ))}</ol>
                        <A to={{ name: "home" }} className="mt-3 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold text-brand-secondary hover:underline">Open the full board<ArrowRight className="size-4" /></A>
                    </figure>
                </Container></section>

                <Section eyebrow="Why it works" title="One dollar more than the person above you" lead="The idea is older than this product. It has already raised millions when it happened by accident." className="bg-secondary">
                    <div className="grid gap-4 md:grid-cols-2">
                        <article className="rounded-3xl bg-primary p-6 ring-1 ring-secondary ring-inset md:p-7">
                            <h3 className="text-lg font-semibold text-primary">#TeamTrees, 2019</h3>
                            <p className="mt-2 text-md text-tertiary">Elon Musk gave $1,000,000 and took the top of the campaign's public donor board. Shopify's Tobias Lütke then gave <b className="font-semibold text-primary">$1,000,001</b> to pass him by a single dollar. The campaign raised $20 million in about 55 days.</p>
                            <p className="mt-3 text-sm text-tertiary">Outgive turns that moment into a button on every row. <a className="underline underline-offset-2 hover:text-primary" href="https://tubefilter.com/2019/12/19/mrbeast-mark-rober-youtube-teamtrees-20-million-dollars-arbor-day-foundation-elon-musk-donation/" target="_blank" rel="noopener noreferrer">Source: Tubefilter</a></p>
                        </article>
                        <article className="rounded-3xl bg-primary p-6 ring-1 ring-secondary ring-inset md:p-7">
                            <h3 className="text-lg font-semibold text-primary">What the research says</h3>
                            <p className="mt-2 text-md text-tertiary">In a field experiment with 4,168 past donors, offering public recognition raised the chance of any gift by 2.7 percentage points and of a gift of $100 or more by 1.8 points. Other work finds recognition backfires when it is forced, and the penalty goes when it is optional.</p>
                            <p className="mt-3 text-sm text-tertiary">That is why names on an Outgive board are always the supporter's choice. <a className="underline underline-offset-2 hover:text-primary" href="https://www.povertyactionlab.org/evaluation/public-recognition-and-fundraising-united-states" target="_blank" rel="noopener noreferrer">Source: J-PAL summary of Karlan and McConnell</a></p>
                        </article>
                    </div>
                </Section>

                <Section id="how" eyebrow="How it works" title="A leaderboard your supporters can act on">
                    <ol className="grid gap-4 md:grid-cols-3">{STEPS.map(([t, d], i) => <li key={t} className="rounded-3xl p-6 ring-1 ring-secondary ring-inset"><span className="flex size-9 items-center justify-center rounded-full bg-brand-solid text-sm font-bold text-white">{i + 1}</span><h3 className="mt-4 text-lg font-semibold text-primary">{t}</h3><p className="mt-1.5 text-md text-tertiary">{d}</p></li>)}</ol>
                </Section>

                <Section id="features" eyebrow="Features" title="Everything a ranked appeal needs" className="bg-secondary">
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{FEATURES.map(([Icon, t, d]) => <li key={t} className="rounded-3xl bg-primary p-6 ring-1 ring-secondary ring-inset"><span className="flex size-10 items-center justify-center rounded-xl bg-brand-secondary text-brand-secondary"><Icon className="size-5" /></span><h3 className="mt-4 text-md font-semibold text-primary">{t}</h3><p className="mt-1.5 text-sm text-tertiary">{d}</p></li>)}</ul>
                </Section>

                <Section eyebrow="Where a board earns its keep" title="Made for appeals with a deadline or a rival">
                    <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">{USES.map(([t, d]) => <li key={t} className="border-t border-primary pt-4"><h3 className="text-md font-semibold text-primary">{t}</h3><p className="mt-1 text-sm text-tertiary">{d}</p></li>)}</ul>
                </Section>

                <Section eyebrow="Compare" title="A leaderboard widget shows a list. Outgive sells the next place." className="bg-secondary">
                    <div className="overflow-x-auto rounded-3xl bg-primary ring-1 ring-secondary ring-inset"><table className="w-full min-w-[34rem] text-left text-sm">
                        <thead><tr className="border-b border-secondary text-tertiary"><th scope="col" className="px-5 py-3.5 font-semibold"> </th><th scope="col" className="px-5 py-3.5 font-semibold">Typical leaderboard widget</th><th scope="col" className="px-5 py-3.5 font-semibold text-brand-secondary">Outgive</th></tr></thead>
                        <tbody className="text-secondary">{([["What the board does", "Displays top donors beside a donate button", "Prices every rank and asks for the next one"], ["Who can win", "Whoever has given the most", "Weekly, daily, recruiter and streak boards, by supporter type"], ["Branding", "The platform's", "Your name, logo, colour and font"], ["How people climb", "By paying more", "By giving, and by what their fundraising page brings in"], ["Being seen", "Usually on by default", "The supporter's choice, with anonymous giving"]] as string[][]).map(([k, a, b]) => <tr key={k} className="border-b border-secondary last:border-0"><th scope="row" className="px-5 py-3.5 font-semibold text-primary">{k}</th><td className="px-5 py-3.5 text-tertiary">{a}</td><td className="px-5 py-3.5">{b}</td></tr>)}</tbody>
                    </table></div>
                </Section>

                <Section id="faq" eyebrow="FAQ" title="Questions charities ask first">
                    <div className="grid max-w-4xl gap-x-10 md:grid-cols-2">{LANDING_FAQ.map(([q, a]) => <div key={q} className="border-t border-secondary py-5"><h3 className="text-md font-semibold text-primary">{q}</h3><p className="mt-1.5 text-sm text-tertiary">{a}</p></div>)}</div>
                </Section>

                <section className="pb-16"><Container><div className="flex flex-col items-start gap-5 rounded-[2rem] bg-brand-solid p-8 text-white md:flex-row md:items-center md:justify-between md:p-12">
                    <div><h2 className="text-display-xs font-semibold tracking-tight md:text-display-sm">See it with your charity's name on it</h2><p className="mt-2 max-w-xl text-lg text-white/85">Open the demo, press the brush icon, and the board becomes yours in about ten seconds.</p></div>
                    <A to={{ name: "home" }} event="cta-demo-footer" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-white px-6 text-md font-semibold text-brand-700 transition hover:bg-brand-50"><Heart className="size-5" />Open the live demo</A>
                </div></Container></section>
            </main>

            <footer className="border-t border-secondary py-8"><Container className="flex flex-col items-start justify-between gap-4 text-sm text-tertiary md:flex-row md:items-center">
                <div className="flex items-center gap-3"><Logo /><span>White-label fundraising leaderboards for charities.</span></div>
                <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 font-medium">
                    <A to={{ name: "home" }} className="rounded hover:text-primary">Live demo</A><A to={{ name: "layouts" }} className="rounded hover:text-primary">Page layouts</A><A to={{ name: "rules" }} className="rounded hover:text-primary">Rules</A><A to={{ name: "faq" }} className="rounded hover:text-primary">FAQ</A><A to={{ name: "about" }} className="rounded hover:text-primary">About</A><A to={{ name: "terms" }} className="rounded hover:text-primary">Terms</A><A to={{ name: "privacy" }} className="rounded hover:text-primary">Privacy</A>
                </nav>
            </Container></footer>
        </div>
    );
};
