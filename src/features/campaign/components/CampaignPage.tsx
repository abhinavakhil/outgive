import { type FC, type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";

const ChildrenContext = createContext<PageBundle["children"] | undefined>(undefined);
import { Check, Flag01, Heart, Link01, Settings01, Share07, Tv01 } from "@untitledui/icons";
import { Tab, TabList, TabPanel, Tabs, Badge, Button, ProgressBarBase, BrandLogo, Logo, ThemeToggle, Card, Container, TwoCol, PillSelect, Ring, ShareDialog, shareTargets, Input, TextArea, Avatar } from "@/shared/ui";
import { Board, Cover, Donate, Levels, OrgLine, OrganizerLine, PageActions, PageContext, Protected, Raised, Stats, Story, TypeBadge } from "@/features/campaign/components/page-parts";
import { ago, dateOf, initials } from "@/shared/lib/format";
import { daysLeft, pct, typeOf, PREFIX, DEFAULT_ALLOCATION, type Donation, LAYOUTS, type LayoutId, type PageData, type PageUpdate, pageKey } from "@/shared/domain/model";
import { useApp } from "@/shared/lib/app-context";
import { DonateDialog, DonationsDialog } from "@/features/donate";
import type { Org, PageBundle, PageRow, TicketType } from "@/shared/domain/types";
import { LEGAL } from "@/shared/lib/seo";
import { cx } from "@/shared/utils/cx";

type L = FC<{ p: PageData }>;
const H1 = ({ children, className }: { children: string; className?: string }) => <h1 className={cx("max-w-3xl text-display-md leading-[0.95] font-extrabold tracking-[-0.045em] text-balance text-ink", className)}>{children}</h1>;
const Head = ({ p }: { p: PageData }) => (<div className="flex flex-col items-start gap-3"><TypeBadge p={p} /><H1>{p.title}</H1><OrgLine p={p} /></div>);
const ProgressCard = ({ p }: { p: PageData }) => (
    <Card className="flex flex-col gap-3"><div className="flex flex-wrap items-end justify-between gap-2"><Raised p={p} /><span className="text-sm text-ink-3">{p.supporters} supporters · {pct(p)}% funded</span></div><ProgressBarBase value={pct(p)} /></Card>
);
const Actions = ({ p }: { p: PageData }) => {
    const { donate, share } = useContext(PageActions);
    return <div className="flex flex-wrap gap-3"><Button size="lg" color="primary" className="rounded-full" onPress={() => donate()}>{typeOf(p).cta}</Button><Button size="lg" color="secondary" className="rounded-full" iconLeading={Share07} onPress={share}>Share</Button></div>;
};

/** Headline numbers. The sample page pads them with example figures; a published page shows only what is true of it. */
const facts = (p: PageData, lead: [string, string][], sample: [string, string][]): [string, string][] => [...lead, ...(p.isSample ? sample : daysLeft(p) !== null ? [[`${daysLeft(p)} days`, "left"] as [string, string]] : [])];

const ActionRow = ({ p }: { p: PageData }) => {
    const { donate, share } = useContext(PageActions);
    return <div className="grid grid-cols-2 gap-3"><Button size="xl" color="secondary" className="rounded-full" onPress={() => donate()}>{typeOf(p).cta === "Donate" ? "Donate" : typeOf(p).cta}</Button><Button size="xl" color="secondary" className="rounded-full" onPress={share}>Share</Button></div>;
};

/** The default layout follows the order donors know from large fundraising sites. */
const Classic: L = ({ p }) => (
    <Container className="flex flex-col gap-5 py-8">
        <H1 className="max-w-none text-display-sm md:text-display-lg">{p.title}</H1>
        <TwoCol main={<><Cover className="aspect-video min-h-64" /><OrganizerLine p={p} /><Protected /><Story p={p} bare /><ActionRow p={p} /><Details p={p} childPages={useContext(ChildrenContext)} /></>} side={<Donate p={p} />} />
    </Container>
);

const Split: L = ({ p }) => (
    <>
        <div className="grid lg:grid-cols-2">
            <div className="flex flex-col items-start justify-center gap-5 bg-tint-1 px-4 py-12 md:px-12 lg:min-h-[32rem]">
                <TypeBadge p={p} /><H1 className="max-w-xl">{p.title}</H1><OrgLine p={p} />
                <div className="flex w-full max-w-md flex-col gap-2"><Raised p={p} /><ProgressBarBase value={pct(p)} /></div>
                <Actions p={p} />
            </div>
            <Cover className="min-h-72 rounded-none ring-0" />
        </div>
        <Container className="py-10"><TwoCol main={<Story p={p} />} side={<Board title="Recent supporters" />} /></Container>
    </>
);

const FullBleed: L = ({ p }) => (
    <>
        <div className="bg-tint-1 pt-16 pb-32"><Container><div className="flex flex-col items-start gap-3"><TypeBadge p={p} /><H1 className="text-display-lg">{p.title}</H1><OrgLine p={p} /></div></Container></div>
        <Container className="pb-12"><TwoCol className="-mt-20" main={<div className="flex flex-col gap-7 pt-28 lg:pt-28"><Cover className="min-h-72" /><Story p={p} /><Levels /></div>} side={<div className="flex flex-col gap-5 [&>div:first-child]:bg-raised [&>div:first-child]:shadow-lift"><Donate p={p} /><Board /></div>} /></Container>
    </>
);

const Poster: L = ({ p }) => {
    const { money } = useApp();
    const { donate, share } = useContext(PageActions);
    return (
        <>
            <div className="bg-ink py-16 text-ink-inverse md:py-20"><Container className="flex flex-col items-start gap-6">
                <span className="text-[11px] font-semibold tracking-wide text-ink-inverse/70 uppercase">{typeOf(p).label} · {p.org}</span>
                <h1 className="max-w-4xl text-display-lg leading-[0.95] font-extrabold tracking-[-0.045em] text-balance text-ink-inverse md:text-display-2xl">{p.title}</h1>
                <div className="flex w-full max-w-xl flex-col gap-2.5"><p className="text-lg text-ink-inverse/80"><span className="font-semibold text-ink-inverse tabular-nums">{money(p.raised)}</span> raised of {money(p.goal)} by {p.supporters} people</p><ProgressBarBase value={pct(p)} className="bg-ink-inverse/20" progressClassName="bg-ink-inverse" /></div>
                <div className="flex flex-wrap gap-3"><Button size="xl" color="secondary" className="rounded-full" onPress={() => donate()}>{typeOf(p).cta}</Button><Button size="xl" color="secondary" className="rounded-full" iconLeading={Share07} onPress={share}>Share</Button></div>
            </Container></div>
            <Container className="py-10"><TwoCol main={<><Cover className="min-h-72" /><Story p={p} /><Stats items={facts(p, [[String(p.supporters), "supporters"], [`${pct(p)}%`, "of the goal"]], [["17", "teams (sample)"], ["19 days", "left (sample)"]])} /></>} side={<Board title="Top supporters" />} /></Container>
        </>
    );
};

const StoryLayout: L = ({ p }) => (
    <Container className="flex max-w-2xl flex-col gap-6 py-8">
        <Head p={p} /><Cover className="min-h-80" /><Story p={p} lead />
        <Card className="flex flex-col gap-4"><Raised p={p} /><ProgressBarBase value={pct(p)} /><Actions p={p} /></Card>
        <Board title="Messages and gifts" limit={3} />
    </Container>
);

const Dashboard: L = ({ p }) => {
    const { money } = useApp();
    return (
        <Container className="flex flex-col gap-6 py-8">
            <div className="flex flex-wrap items-end justify-between gap-4"><Head p={p} /><Actions p={p} /></div>
            <Stats items={facts(p, [[money(p.raised), `raised of ${money(p.goal)}`], [String(p.supporters), "supporters"]], [["36", "fundraisers (sample)"], ["19 days", "left (sample)"]])} />
            <ProgressCard p={p} />
            <TwoCol main={<><Cover className="min-h-72" /><Board /><Story p={p} /></>} side={<Card className="flex flex-col gap-1"><h2 className="pb-2 text-xl font-semibold tracking-tight text-ink">Latest gifts</h2>{p.donations.length === 0 && <p className="border-t border-hairline pt-3 text-sm text-ink-3">No gifts yet. The first one shows here.</p>}{p.donations.slice(0, 5).map((g, i) => (<div key={`${g.at}-${i}`} className="flex justify-between gap-3 border-t border-hairline py-2.5"><span className="min-w-0 truncate text-ink-2">{g.name}</span><span className="font-semibold text-ink tabular-nums">{money(g.usd)}</span></div>))}</Card>} />
        </Container>
    );
};

const LeaderboardLayout: L = ({ p }) => {
    const { go } = useApp();
    return (
        <Container className="flex flex-col gap-7 py-8">
            <Head p={p} />
            <TwoCol main={<>{p.isSample && <Card><Board title="Team ranking" items={[["Harbour Runners", 8410], ["Night Shift Walkers", 7950], ["Class of 2011", 5300], ["Office Stairs Club", 4120], ["Sunday Striders", 2870]]} /></Card>}<Cover className="min-h-72" /><Board title={p.isSample ? "Top individuals" : "Top supporters"} /><Story p={p} /></>}
                side={<><Donate p={p} cta={p.isSample ? "Back a team" : undefined} /><Card className="flex flex-col items-start gap-3"><h2 className="text-lg font-semibold tracking-tight text-ink">Start a team</h2><p className="text-sm text-ink-3">Pick a name, invite friends and share one total.</p><Button color="secondary" size="md" onPress={() => go({ name: "create" })}>Create a team</Button></Card></>} />
        </Container>
    );
};

const Ticket: L = ({ p }) => {
    const { money } = useApp();
    const { donate } = useContext(PageActions);
    const day = p.isSample ? new Date(new Date().getFullYear(), 10, 14) : p.endDate ? new Date(p.endDate) : null;
    return (
        <Container className="flex flex-col gap-7 py-8">
            <div className="flex flex-wrap items-center gap-5">
                {day && <div className="w-24 shrink-0 rounded-2xl bg-ink py-3.5 text-center text-ink-inverse"><div className="text-[11px] font-semibold tracking-wide uppercase opacity-70">{day.toLocaleDateString("en", { month: "short" })}</div><div className="font-bubble text-display-md leading-none font-bold tabular-nums">{day.getDate()}</div></div>}
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2"><TypeBadge p={p} /><H1>{p.title}</H1>{p.isSample ? <p className="text-ink-2">Thursday 14 November, 18:30 · Riverside Hall · also streamed online (sample details)</p> : <OrgLine p={p} />}</div>
            </div>
            {!p.isSample ? <TwoCol main={<><Cover className="min-h-72" /><Story p={p} /></>} side={<Donate p={p} />} /> : <TwoCol main={<><Cover className="min-h-72" /><section className="flex flex-col gap-2"><h2 className="text-xl font-semibold tracking-tight text-ink">Programme</h2>{[["18:30", "Doors and welcome drinks"], ["19:15", "Dinner is served"], ["20:30", "Field report from the team"], ["21:00", "Pledges and auction"]].map(([t, w]) => (<div key={t} className="flex gap-4 border-t border-hairline py-3"><span className="w-16 font-semibold text-ink tabular-nums">{t}</span><span className="text-ink-2">{w}</span></div>))}</section><Story p={p} /></>}
                side={<><div className="flex flex-col gap-3 rounded-3xl bg-tint-1 p-5"><h2 className="text-xl font-semibold tracking-tight text-ink">Tickets</h2>{([["Seat", "Dinner and programme", money(60)], ["Table of 8", "Reserved together", money(440)], ["Can't come", "Give instead", "Any"]] as string[][]).map(([a, b, c]) => (<div key={a} className="flex items-center justify-between rounded-2xl bg-raised px-3.5 py-3 shadow-edge"><span><span className="block font-semibold text-ink">{a}</span><span className="text-sm text-ink-3">{b}</span></span><span className="font-semibold text-ink tabular-nums">{c}</span></div>))}<Button size="lg" color="primary" className="w-full rounded-full" onPress={() => donate(60)}>Get tickets</Button><p className="text-center text-xs text-ink-3">64 of 120 seats left (sample)</p></div><ProgressCard p={p} /></>} />}
        </Container>
    );
};

const Tracker: L = ({ p }) => (
    <Container className="flex flex-col gap-6 py-8">
        <Head p={p} />
        {p.isSample && <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-2"><span><span className="font-bubble text-display-sm font-bold text-ink tabular-nums">62 km</span> <span className="text-ink-3">of 100 km (sample)</span></span><span className="text-ink-3">Day 12 of 31</span></div>
            <div className="flex gap-1.5">{Array.from({ length: 10 }, (_, i) => (<div key={i} className="flex flex-1 flex-col gap-1.5"><div className={cx("h-2 rounded-full", i < 6 ? "bg-ink" : "bg-tint-3")} /><span className="text-xs text-ink-3 tabular-nums max-sm:hidden">{(i + 1) * 10} km</span></div>))}</div>
        </Card>}
        <TwoCol main={<>{p.isSample && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["25 km", "Reached 6 Oct", true], ["50 km", "Reached 12 Oct", true], ["75 km", "13 km to go", false], ["100 km", "Finish by 31 Oct", false]].map(([a, b, done]) => (<Card key={String(a)} className={cx("rounded-3xl md:p-4", done && "bg-ink")}><div className={cx("font-bubble font-bold tabular-nums", done ? "text-ink-inverse" : "text-ink")}>{a}</div><div className={cx("text-sm", done ? "text-ink-inverse/70" : "text-ink-3")}>{b}</div></Card>))}</div>}<Cover className="min-h-72" /><Story p={p} /></>} side={<Donate p={p} cta="Sponsor" />} />
    </Container>
);

const Bento: L = ({ p }) => {
    const { money, go } = useApp();
    const { donate } = useContext(PageActions);
    const tile = "flex min-h-32 flex-col justify-end gap-2.5 rounded-3xl p-6 md:min-h-52";
    return (
        <Container className="flex flex-col gap-8 py-8">
            <div className="grid gap-4 md:grid-cols-6">
                <div className={cx(tile, "items-start bg-tint-1 md:col-span-4 md:min-h-72")}><TypeBadge p={p} /><H1>{p.title}</H1><OrgLine p={p} /></div>
                <Cover className="md:col-span-2 md:min-h-72" />
                <div className={cx(tile, "bg-tint-1 md:col-span-2")}><Raised p={p} size="xl" /><ProgressBarBase value={pct(p)} /><Button size="lg" color="primary" className="w-full rounded-full" onPress={() => donate()}>{typeOf(p).cta}</Button></div>
                <div className={cx(tile, "bg-ink md:col-span-1")}><div className="font-bubble text-display-sm font-bold text-ink-inverse tabular-nums">{pct(p)}%</div><div className="text-sm text-ink-inverse/70">of the goal</div></div>
                <div className={cx(tile, "bg-tint-1 md:col-span-1")}><div className="font-bubble text-display-sm font-bold text-ink tabular-nums">{p.supporters}</div><div className="text-sm text-ink-3">supporters</div></div>
                <div className={cx(tile, "items-start bg-tint-1 md:col-span-2")}><div className="font-semibold text-ink">Raise for this page</div><p className="text-sm text-ink-3">Start your own page in two minutes. Goal {money(p.goal)}.</p><Button color="secondary" size="md" onPress={() => go({ name: "create" })}>Fundraise</Button></div>
            </div>
            <TwoCol main={<Story p={p} />} side={<Board />} />
        </Container>
    );
};

const Chapters: L = ({ p }) => {
    const [tab, setTab] = useState("story");
    const tabs = [{ id: "story", label: "Story" }, { id: "impact", label: "Impact" }, { id: "fundraisers", label: "Fundraisers" }, { id: "supporters", label: "Supporters" }];
    return (
        <Container className="flex flex-col gap-7 py-8">
            <div className="grid items-center gap-8 lg:grid-cols-2"><div className="flex flex-col items-start gap-4"><Head p={p} /><Actions p={p} /></div><Cover className="min-h-72" /></div>
            <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
                <TabList type="button-gray" size="md" items={tabs} className="no-scrollbar max-w-full overflow-x-auto">{(t) => <Tab id={t.id} label={t.label} />}</TabList>
                <div className="pt-7"><TwoCol main={<><TabPanel id="story"><Story p={p} /></TabPanel><TabPanel id="impact"><Levels /></TabPanel><TabPanel id="fundraisers"><Board /></TabPanel><TabPanel id="supporters"><Board title="Recent supporters" /></TabPanel></>} side={<Donate p={p} />} /></div>
            </Tabs>
        </Container>
    );
};

const Impact: L = ({ p }) => (
    <Container className="flex flex-col gap-7 py-10">
        <div className="flex flex-col items-center gap-3 text-center"><TypeBadge p={p} /><H1 className="text-display-lg">Pick what your gift does</H1><p className="max-w-xl text-lg text-ink-3">{p.title}. Choose a level and see where it lands.</p><OrgLine p={p} /></div>
        <Levels /><ProgressCard p={p} />
        <TwoCol main={<><Cover className="min-h-72" /><Story p={p} /></>} side={<Board title="Recent supporters" />} />
    </Container>
);

export const LAYOUT_COMPONENTS: Record<LayoutId, L> = { classic: Classic, split: Split, "full-bleed": FullBleed, poster: Poster, story: StoryLayout, dashboard: Dashboard, leaderboard: LeaderboardLayout, ticket: Ticket, tracker: Tracker, bento: Bento, chapters: Chapters, impact: Impact };

const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-2xl bg-tint-1 px-4 py-5 text-sm text-ink-3">{children}</p>;

const Block = ({ title, count, children }: { title: string; count?: number; children: ReactNode }) => (
    <section className="flex flex-col gap-4 border-t border-hairline pt-8"><h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">{title}{count !== undefined && <span className="inline-flex h-6 items-center rounded-full bg-tint-2 px-2.5 font-semibold text-xs font-bold text-ink-2 tabular-nums">{count}</span>}</h2>{children}</section>
);

/** The sections under the story, in the order a donor expects: details, updates, sharing, organiser, comments, report. */
const Details = ({ p, childPages }: { p: PageData; childPages?: PageBundle["children"] }) => {
    const { money, go } = useApp();
    const { share, donate, postUpdate } = useContext(PageActions);
    const [copied, setCopied] = useState(false);
    const [liked, setLiked] = useState<number[]>([]);
    const { href } = useApp();
    const url = `${window.location.origin}${href({ name: "page", key: pageKey(p) })}`;
    const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } };
    const facts: [string, string][] = [
        ["Charity", p.org || "Not added"], ["Country", p.country],
        ...Object.entries(p.details).filter(([k, v]) => v && k !== "Charity").map(([k, v]) => [k, v] as [string, string]),
        ["Goal", `${money(p.goal)}${p.endDate ? ` by ${dateOf(p.endDate)}` : ""}`],
    ];
    const comments = p.donations.filter((d) => d.message);
    const alloc = p.allocation?.length ? p.allocation : DEFAULT_ALLOCATION;
    const allocTotal = alloc.reduce((n, [, v]) => n + v, 0) || 1;
    const supporters = Object.entries(p.donations.filter((d) => d.name !== "Anonymous").reduce<Record<string, number>>((m, d) => ({ ...m, [d.name]: (m[d.name] ?? 0) + d.usd }), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const [uTitle, setUTitle] = useState("");
    const [uBody, setUBody] = useState("");
    const publishUpdate = () => { if (!postUpdate || !uTitle.trim()) return; postUpdate({ title: uTitle.trim(), body: uBody.trim(), at: Date.now() }); setUTitle(""); setUBody(""); };

    const targets = shareTargets(url, p.title).filter(([n]) => ["WhatsApp", "Facebook", "X", "LinkedIn"].includes(n));
    return (
        <>
            <Block title="Details"><dl className="grid gap-1 rounded-3xl bg-tint-1 p-2 sm:grid-cols-2">{facts.map(([k, v]) => <div key={k} className="rounded-2xl px-4 py-3"><dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{k}</dt><dd className="mt-0.5 font-medium text-ink">{v}</dd></div>)}</dl></Block>

            {p.showGoal && <Block title="Where the money goes">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-tint-2">{alloc.map(([l, v], i) => <span key={l} title={`${l} ${Math.round(v / allocTotal * 100)}%`} className={cx("h-full", ["bg-ink", "bg-ink-3", "bg-ink-faint", "bg-tint-3"][i % 4])} style={{ width: `${v / allocTotal * 100}%` }} />)}</div>
                <ul className="grid gap-2 sm:grid-cols-3">{alloc.map(([l, v], i) => <li key={l} className="flex items-center gap-2 text-sm text-ink-2"><span className={cx("size-2.5 rounded-full", ["bg-ink", "bg-ink-3", "bg-ink-faint", "bg-tint-3"][i % 4])} /><span className="min-w-0 flex-1 truncate">{l}</span><span className="font-semibold text-ink tabular-nums">{Math.round(v / allocTotal * 100)}%</span></li>)}</ul>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[25, 50, 75, 100].map((m) => { const hit = pct(p) >= m; return <div key={m} className={cx("flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm", hit ? "bg-ink text-ink-inverse" : "bg-tint-1 text-ink-3")}><span className={cx("flex size-5 shrink-0 items-center justify-center rounded-full", hit ? "bg-ink-inverse text-ink" : "bg-tint-3")}>{hit && <Check className="size-3 stroke-[3px]" />}</span><span><span className="block font-semibold tabular-nums">{m}%</span><span className="text-xs tabular-nums">{money(p.goal * m / 100)}</span></span></div>; })}</div>
            </Block>}
            {(p.updates.length > 0 || postUpdate) && <Block title="Updates" count={p.updates.length}>{p.updates.length > 0 && <ol className="flex flex-col border-l border-hairline pl-5">{p.updates.map((u) => <li key={`${u.at}-${u.title}`} className="relative pb-6 last:pb-0"><span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-ink" /><div className="text-xs text-ink-3">{dateOf(u.at)}</div><div className="font-semibold text-ink">{u.title}</div><p className="mt-0.5 max-w-prose text-sm text-ink-3">{u.body}</p></li>)}</ol>}
                {postUpdate && <form className="flex flex-col gap-3 rounded-3xl bg-tint-1 p-5" onSubmit={(e) => { e.preventDefault(); publishUpdate(); }}><div className="font-semibold text-ink">Post an update</div><Input aria-label="Update title" placeholder="What happened?" value={uTitle} onChange={setUTitle} /><TextArea aria-label="Update" rows={3} placeholder="Tell supporters how their gifts are being used." value={uBody} onChange={setUBody} /><Button type="submit" size="md" color="primary" className="w-fit rounded-full" isDisabled={!uTitle.trim()}>Post update</Button></form>}</Block>}
            {childPages && childPages.length > 0 && <Block title="Fundraising for this page" count={childPages.length}><ol className="flex flex-col gap-0.5 rounded-3xl bg-tint-1 p-2">{childPages.slice(0, 10).map((c, i) => <li key={c.id}><button type="button" onClick={() => go({ name: "page", key: `${PREFIX[c.type]}/${c.slug}` })} className={cx("flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left outline-focus-ring transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2", i === 0 ? "bg-ink text-ink-inverse" : "text-ink hover:bg-tint-2")}><span className={cx("w-8 font-bubble font-bold tabular-nums", i === 0 ? "text-ink-inverse/70" : "text-ink-3")}>#{i + 1}</span><Avatar size="sm" initials={initials(c.title)} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.title}</span><span className={cx("block text-xs", i === 0 ? "text-ink-inverse/70" : "text-ink-3")}>{c.donor_count} supporters</span></span><span className="font-semibold tabular-nums">{money(c.raised_cents / 100)}</span></button></li>)}</ol></Block>}
            {supporters.length > 0 && <Block title="Top supporters"><ol className="flex flex-col gap-0.5 rounded-3xl bg-tint-1 p-2">{supporters.map(([name, usd], i) => <li key={name} className={cx("flex items-center gap-3 rounded-2xl px-4 py-3 transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]", i === 0 ? "bg-ink text-ink-inverse" : "text-ink hover:bg-tint-2")}><span className={cx("w-8 font-bubble font-bold tabular-nums", i === 0 ? "text-ink-inverse/70" : "text-ink-3")}>#{i + 1}</span><Avatar size="sm" initials={initials(name)} /><span className="min-w-0 flex-1 truncate font-medium">{name}</span><span className="font-semibold tabular-nums">{money(usd)}</span></li>)}</ol></Block>}


            <Block title="Sharing helps more than you think">
                <p className="text-[15px] text-ink-2">On average, <span className="font-semibold text-ink">each share can inspire {money(50)}</span> in donations by helping this {typeOf(p).label.toLowerCase()} reach more people.</p>
                <div className="flex flex-col items-center gap-5 rounded-3xl bg-tint-1 p-5 md:p-7">
                    <div className="grid w-full max-w-md grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-3 rounded-2xl bg-raised p-3 shadow-edge sm:gap-4 sm:p-4">
                        <div className="flex flex-col justify-between gap-3"><Logo /><div className="text-lg leading-snug font-semibold tracking-tight text-ink">{p.title}</div><div className="text-sm text-ink-3">Organised by <span className="font-medium text-ink-2">{p.org}</span></div></div>
                        <div className="relative"><Cover className="aspect-[4/3] size-full [&>span]:hidden" /><div className="absolute -bottom-3 left-2 flex items-center gap-2"><Ring value={pct(p)} size={52} /><span className="inline-flex h-6 items-center rounded-full bg-ink px-2.5 text-xs font-semibold text-ink-inverse"><span className="font-semibold tabular-nums">{money(p.raised)}</span>&nbsp;raised</span></div></div>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <button type="button" aria-label={copied ? "Link copied" : "Copy link"} onClick={copy} className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-raised text-ink shadow-edge outline-focus-ring transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-raised-hover focus-visible:outline-2">{copied ? <Check className="size-5" /> : <Link01 className="size-5" />}</button>
                        {targets.map(([name, icon, href]) => <a key={name} aria-label={`Share on ${name}`} href={href} target="_blank" rel="noopener noreferrer" className="flex size-10 items-center justify-center rounded-full bg-raised text-ink shadow-edge outline-focus-ring transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-raised-hover focus-visible:outline-2">{icon}</a>)}
                        <Button size="md" color="secondary" className="rounded-full" onPress={share}>More ways to share</Button>
                    </div>
                </div>
            </Block>

            <Block title="Organizer">
                <div className="flex items-start gap-4"><Avatar size="xl" initials={initials(p.org) || "?"} />
                    <div className="flex flex-col items-start gap-1"><span className="text-lg font-semibold tracking-tight text-ink">{p.org}</span><span className="text-sm text-ink-3">Organizer · {p.country}</span>
                        {p.details["Registration number"] && <span className="text-sm text-ink-3">Registered {p.details["Registration number"]}</span>}</div></div>
            </Block>

            <Block title="Comments" count={comments.length}>
                <p className="text-[15px] text-ink-2">Please <button type="button" onClick={() => donate()} className="cursor-pointer font-semibold text-ink underline underline-offset-4">donate</button> to comment.</p>
                {comments.length === 0 ? <Empty>No comments yet.</Empty> : <ul className="flex flex-col gap-5">{comments.map((d, i) => (
                    <li key={`${d.at}-${i}`} className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pop-100 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{(d.name[0] ?? "A").toUpperCase()}</span>
                        <div className="min-w-0 flex-1"><div className="font-semibold text-ink">{d.name}</div><div className="text-xs text-ink-3">{ago(d.at)}</div><p className="mt-1.5 text-[15px] text-ink-2">{d.message}</p>
                            <button type="button" aria-pressed={liked.includes(i)} onClick={() => setLiked((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i]))} className="mt-2 flex cursor-pointer items-center gap-1.5 text-sm text-ink-3 outline-focus-ring transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink focus-visible:outline-2"><Heart className={cx("size-4", liked.includes(i) && "fill-brand-600 text-brand-600")} />{liked.includes(i) ? 1 : 0}</button></div></li>
                ))}</ul>}
            </Block>

            <div className="flex flex-col gap-4 border-t border-hairline pt-6">
                <p className="text-sm text-ink-3">Created {dateOf(p.created)} · <span className="underline underline-offset-2">{p.causes[0] ?? typeOf(p).label}</span></p>
                <div className="flex flex-wrap items-center gap-4 border-t border-hairline pt-4">
                    <a href={`mailto:${LEGAL.email}?subject=${encodeURIComponent(`Report: ${p.title}`)}&body=${encodeURIComponent(url)}`} className="flex items-center gap-2 text-sm font-semibold text-ink-2 outline-focus-ring hover:text-ink focus-visible:outline-2"><Flag01 className="size-4" />Report this page</a>
                    <span className="flex-1" /><Button size="sm" color="link-gray" onPress={() => go({ name: "create" })}>Start your own page</Button>
                </div>
            </div>
        </>
    );
};

export const CampaignPage = ({ donate, pageKey: key, page, row, org, tickets, childPages, parent, canEdit, setPage, give, addUpdate }: { donate?: number | true; pageKey: string; page: PageData; row?: PageRow; org: Org | null; tickets?: TicketType[]; childPages?: PageBundle["children"]; parent?: PageBundle["parent"]; canEdit: boolean; setPage: (p: PageData) => Promise<void>; give?: (d: Donation) => void; addUpdate?: (u: PageUpdate) => void }) => {
    const { go, href, isDemo } = useApp();
    const [shareOpen, setShareOpen] = useState(false);
    const [gift, setGift] = useState<number | null>(null);
    // /c/<slug>/donate (or /donate/50) opens the gift form on arrival; the address then settles back to the page itself.
    useEffect(() => {
        if (donate === undefined) return;
        setGift(typeof donate === "number" && donate >= 1 ? donate : page.gifts[1] ?? 25);
        window.history.replaceState(null, "", href({ name: "page", key }));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const [list, setList] = useState<"all" | "top" | null>(null);
    const Layout = LAYOUT_COMPONENTS[page.layout];
    const actions = useMemo(() => ({ donate: (usd?: number) => setGift(usd ?? page.gifts[1] ?? 25), share: () => setShareOpen(true), donations: (m: "all" | "top") => setList(m), postUpdate: addUpdate ?? null }), [page.gifts, addUpdate]);
    const fundraise = () => go(row?.type === "campaign" && row.allow_fundraisers ? { name: "create", parent: `${PREFIX[row.type]}/${row.slug}` } : { name: "create" });
    return (
        <div className="min-h-dvh bg-primary">
            <header className="sticky top-0 z-30 border-b border-hairline bg-primary/90 backdrop-blur"><Container className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">{org && !page.isSample ? <BrandLogo onClick={() => go({ name: "home" })} /> : <Logo onClick={() => go({ name: "home" })} />}{page.isSample && <Badge type="pill-color" color="gray" size="sm">Sample page</Badge>}{row?.status === "draft" && <Badge type="pill-color" color="warning" size="sm">Draft</Badge>}{row?.status === "ended" && <Badge type="pill-color" color="gray" size="sm">Ended</Badge>}{parent && <a href={href({ name: "page", key: `${PREFIX[parent.type]}/${parent.slug}` })} onClick={(e) => { e.preventDefault(); go({ name: "page", key: `${PREFIX[parent.type]}/${parent.slug}` }); }} className="hidden truncate text-sm text-ink-3 hover:text-ink md:block">part of {parent.title}</a>}</div>
                <div className="flex items-center gap-2">
                    {(page.isSample || canEdit) && <PillSelect label="Layout" size="sm" className="w-40 max-sm:hidden" value={LAYOUTS.find((l) => l.id === page.layout)!.name} onChange={(v) => setPage({ ...page, layout: LAYOUTS.find((l) => l.name === v)!.id })} options={LAYOUTS.map((l) => l.name)} />}
                    <ThemeToggle />
                    {row && <Button size="sm" color="secondary" className="rounded-full max-sm:hidden" iconLeading={Tv01} onPress={() => go({ name: "live", org: org!.slug, page: { type: row.type, slug: row.slug } })}>Live</Button>}
                    {canEdit && row && <Button size="sm" color="secondary" className="rounded-full" iconLeading={Settings01} onPress={() => go({ name: "page", org: org!.slug, page: { type: row.type, slug: row.slug }, sub: "manage" })}>Manage</Button>}
                    <Button size="sm" color="secondary" className="rounded-full" iconLeading={Share07} onPress={() => setShareOpen(true)}>Share</Button>
                    {(!row || row.type === "campaign") && <Button size="sm" color="primary" className="rounded-full max-sm:hidden" onPress={fundraise}>{row ? "Fundraise for this" : "Start fundraising"}</Button>}
                </div>
            </Container></header>
            <PageContext.Provider value={page}><PageActions.Provider value={actions}><ChildrenContext.Provider value={childPages}>
                <Layout p={page} />
                {page.layout !== "classic" && <Container className={cx("pb-14", page.layout === "story" && "max-w-2xl")}><div className={cx("flex flex-col gap-8", page.layout !== "story" && "lg:max-w-[calc(100%-360px-2.5rem)]")}><Details p={page} childPages={childPages} /></div></Container>}
                <MobileBar p={page} />
            </ChildrenContext.Provider></PageActions.Provider></PageContext.Provider>
            <ShareDialog isOpen={shareOpen} onClose={() => setShareOpen(false)} url={`${window.location.origin}${href({ name: "page", key })}`} title={page.title} />
            {org && <DonateDialog target={{ org, page: row ?? null, title: page.title, gifts: page.gifts, tickets }} isOpen={gift !== null} initial={gift ?? 25} onClose={() => setGift(null)} onShare={() => setShareOpen(true)} onLocal={row ? undefined : give} />}
            <DonationsDialog p={page} mode={list} onClose={() => setList(null)} />
        </div>
    );
};

/** On phones the donate card is far down the page, so the two actions stay pinned to the bottom. */
const MobileBar = ({ p }: { p: PageData }) => {
    const { donate, share } = useContext(PageActions);
    return <div className="sticky bottom-0 z-30 grid grid-cols-2 gap-3 border-t border-hairline bg-primary px-4 py-3 lg:hidden"><Button size="lg" color="primary" className="rounded-full" onPress={() => donate()}>{typeOf(p).cta === "Donate" ? "Donate now" : typeOf(p).cta}</Button><Button size="lg" color="secondary" className="rounded-full" iconLeading={Share07} onPress={share}>Share</Button></div>;
};
