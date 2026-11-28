/**
 * Overview: the greeting and the 30 nights on the left with the campaign board under them; raised by fund, the key numbers,
 * the after-Eid week and today's actions on the right. Each card reads its own hook in ./data.
 */
import { useState } from "react";
import { CalendarCheck, HandCoins, IdentificationCard, Kanban, ListChecks, Receipt, Wallet } from "@phosphor-icons/react";
import { Agenda, AvatarStack, Card, Counter, Empty, Pie, NightsBar, StatStrip, Tabs, Tag, TodoGrid } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import { type Load, type TodoCount, useCampaigns, useFunds, useGreeting, useJourney, useNights, useStats, useTodos } from "./data";

/** Loading, empty or ready: one switch every card uses. */
const Show = <T,>({ load, children }: { load: Load<T>; children: (d: T) => React.ReactNode }) =>
    load.state === "loading" ? <div className="eg-skeleton" aria-busy="true"><span className="eg-sr">Loading</span></div>
    : load.state === "empty" ? <Empty href={load.href} cta={load.cta}>{load.why}</Empty>
    : <>{children(load.data)}</>;

const Greeting = () => {
    const ws = useWorkspace(), g = useGreeting();
    const today = g.state === "ready" ? g.data.today : new Date();
    return (
        <div className="eg-hello">
            <p className="eg-date">{today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · Ramadan 1448, at a glance</p>
            <h1>Hi, {ws.org.name}</h1>
            {g.state === "ready" && <p className="eg-counters">{g.data.counters.map((c) => <Counter key={c.label} n={c.n} label={c.label} />)}</p>}
        </div>
    );
};

const Nights = () => {
    const { money } = useWorkspace(), n = useNights();
    return (
        <Show load={n}>{({ nights, start, today, goal }) => {
            const at = (i: number) => new Date(start.getTime() + i * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const raised = nights.reduce((a, b) => a + b, 0), best = nights.indexOf(Math.max(...nights));
            const last = today ?? nights.reduce((k, v, i) => (v > 0 ? i : k), -1);
            const change = last > 0 && nights[last - 1] ? Math.round(((nights[last] - nights[last - 1]) / nights[last - 1]) * 100) : null;
            return (
                <NightsBar nights={nights} today={today} format={money}
                    top={[{ label: "Night 1", sub: at(0) }, { label: "Night 21", sub: "Last ten begin" }, { label: "Night 30", sub: at(29) }]}
                    bottom={[
                        { label: change === null ? "–" : `${change >= 0 ? "+" : ""}${change}%`, sub: change === null ? "No two nights to compare yet" : `Night ${last + 1} vs the night before` },
                        { label: raised ? money(nights[best]) : "–", sub: raised ? `Night ${best + 1}, the biggest night` : "No gifts on Ramadan nights yet" },
                        { label: goal ? `${Math.round((raised / goal) * 100)}%` : money(raised), sub: goal ? "Of the goal" : "Raised over Ramadan" },
                    ]} />
            );
        }}</Show>
    );
};

const Board = () => {
    const { money } = useWorkspace();
    const [tab, setTab] = useState<"campaigns" | "funds">("campaigns");
    const campaigns = useCampaigns(), funds = useFunds();
    return (
        <section aria-label="Campaigns and funds">
            <Tabs id="eg-board" label="Show" value={tab} onChange={setTab} items={[
                { id: "campaigns", label: "Campaigns", icon: <Kanban size={18} aria-hidden="true" /> },
                { id: "funds", label: "Funds", icon: <Wallet size={18} aria-hidden="true" /> },
            ]} />
            <div id="eg-board-panel" role="tabpanel" aria-labelledby={`eg-board-tab-${tab}`} className="eg-board">
                {tab === "campaigns" ? <Show load={campaigns}>{(cs) => cs.map((c) => (
                    <Card key={c.id} as="article" title={c.title} menu={[{ label: "Open the page", href: c.href }, { label: "Edit", href: "/ramadhan/edit" }]}>
                        <p className="eg-meta"><Tag tone={c.tone}>{c.status}</Tag><span>{c.range}</span></p>
                        <p className="eg-big" aria-label={`${c.pct}% of goal`}>{c.pct}%</p>
                        <AvatarStack people={c.people} more={c.more} />
                    </Card>
                ))}</Show> : <Show load={funds}>{(fs) => fs.map((f) => (
                    <Card key={f.label} as="article" title={f.label}>
                        <p className="eg-meta"><Tag tone="lilac">Fund</Tag><span>{f.note}</span></p>
                        <p className="eg-big">{money(f.value)}</p>
                    </Card>
                ))}</Show>}
            </div>
        </section>
    );
};

const TODO_ICON: Record<TodoCount["key"], React.ReactNode> = {
    pledges: <HandCoins size={20} />, receipts: <Receipt size={20} />, ein: <IdentificationCard size={20} />, journey: <ListChecks size={20} />,
};

export const Overview = () => {
    const { short } = useWorkspace();
    const funds = useFunds(), stats = useStats(), journey = useJourney(), todos = useTodos();
    const [day, setDay] = useState<number | null>(null);
    const days = journey.state === "ready" ? journey.data.days : journey.week;
    return (
        <div className="eg-overview">
            <div className="eg-main">
                <div className="eg-stage">
                    <Greeting />
                    <Nights />
                </div>
                <Board />
            </div>
            <aside className="eg-aside" aria-label="At a glance">
                <Card title="Raised by fund"><Show load={funds}>{(s) => <Pie slices={s} format={short} label="Raised by fund" />}</Show></Card>
                <Card className="eg-card-strip"><h2 className="eg-sr">Key numbers</h2><Show load={stats}>{(s) => <StatStrip items={s} />}</Show></Card>
                <Card title="After-Eid week" action={<a className="eg-head-link" href="/engage/journey"><CalendarCheck size={16} aria-hidden="true" />Journey</a>}>
                    <Agenda days={days} selected={day ?? (journey.state === "ready" ? journey.data.selected : (new Date().getDay() + 6) % 7)} onSelect={setDay}
                        empty={journey.state === "empty" ? <Empty href={journey.href} cta={journey.cta}>{journey.why}</Empty> : "Nothing goes out this day."} />
                </Card>
                <Card title="Today’s to-do"><TodoGrid items={todos.map((t) => ({ ...t, icon: TODO_ICON[t.key] }))} /></Card>
            </aside>
        </div>
    );
};
