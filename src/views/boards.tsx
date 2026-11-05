import type { FC, ReactNode } from "react";
import { ArrowUp, Award01, Plus, Star01, Trophy01 } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { type BoardKey, type Supporter, VARIANTS, initials } from "@/data";
import { cx } from "@/utils/cx";

/** Twenty more ways to draw the ranking. Each takes the rows already ranked and filtered, plus what the leaderboard knows how to do with a row. */
export type Row = Supporter & { rank: number };
export interface BoardCtx {
    /** The row's figure on the current board, formatted ("$1,200", "14 recruited"). */
    val: (o: Supporter) => string;
    money: (usd: number) => string;
    /** Opens the claim dialog for this row's rank. */
    claim: (o: Row) => void;
    /** Hover pill and touch-screen link. Both render nothing on boards that are not ranked by money. */
    pill: (o: Row, className?: string) => ReactNode;
    link: (o: Row) => ReactNode;
    badge: (o: Row) => ReactNode;
    /** What the row needs to pass the one above it, as a number in the board's own unit. */
    gap: (o: Row) => number;
    fmt: (n: number) => string;
    you: string | null;
    metric: BoardKey;
    canClaim: boolean;
    label: string;
}
type B = FC<{ rows: Row[]; c: BoardCtx }>;

const YOU = "ring-2 ring-brand ring-offset-2 ring-offset-bg-primary";
const NAME = "truncate font-semibold transition-colors";
const li = (c: BoardCtx, o: Row, className: string, you = YOU) => ({ id: `row-${o.id}`, className: cx("group relative", className, c.you === o.id && you) });
const one = (kind: string) => ({ Individuals: "Individual", Teams: "Team", Companies: "Company", Schools: "School" })[kind] ?? kind;
const top = (rows: Row[], c: BoardCtx) => Math.max(1, ...rows.map((o) => o[c.metric]));
/** Name, a second line and the touch-screen claim link. `light` is for rows on a dark or brand-coloured surface. */
const Who = ({ o, c, sub, light, big }: { o: Row; c: BoardCtx; sub?: ReactNode; light?: boolean; big?: boolean }) => (
    <div className={cx("min-w-0 flex-1", light && "[&_button]:text-white [&_button]:underline")}>
        <div className="flex items-center gap-2"><span className={cx(NAME, big ? "text-md" : "text-sm", light ? "text-white group-hover:underline" : "text-primary group-hover:text-brand-secondary")}>{o.name}</span>{c.badge(o)}</div>
        <div className={cx("truncate text-xs", light ? "text-white/70" : "text-tertiary")}>{sub ?? o.tagline}</div>
        <span className="text-xs md:hidden">{c.link(o)}</span>
    </div>
);
const Disc = ({ o, className }: { o: Row; className?: string }) => <span aria-hidden="true" className={cx("flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800", className)}>{initials(o.name)}</span>;
const claimBtn = (c: BoardCtx, o: Row, className: string, children: ReactNode) => c.canClaim && <button type="button" aria-label={`Claim rank ${o.rank}`} onClick={() => c.claim(o)} className={cx("shrink-0 cursor-pointer outline-focus-ring transition focus-visible:outline-2", className)}>{children}</button>;

/** Plain numbered list with one round action per row. Ref: Doji "Top Creators". */
const Minimal: B = ({ rows, c }) => (
    <ol className="flex flex-col">
        {rows.map((o) => (
            <li key={o.id} {...li(c, o, "flex items-center gap-3.5 rounded-2xl px-1 py-3")}>
                {c.pill(o)}<span className="w-6 text-center text-sm text-tertiary tabular-nums">{o.rank}</span><Avatar size="lg" initials={initials(o.name)} /><Who o={o} c={c} big />
                <span className="shrink-0 text-sm font-semibold text-secondary tabular-nums">{c.val(o)}</span>
                {claimBtn(c, o, "flex size-8 items-center justify-center rounded-full bg-brand-solid text-white hover:bg-brand-solid_hover", <Plus className="size-4" />)}
            </li>
        ))}
    </ol>
);

/** Frosted rows on a brand gradient, figure stacked over its unit. Ref: Sweatcoin clubs. */
const Glass: B = ({ rows, c }) => (
    <ol className="flex flex-col gap-1.5 rounded-3xl bg-gradient-to-b from-brand-600 to-brand-900 p-3 md:p-5">
        {rows.map((o) => (
            <li key={o.id} {...li(c, o, "flex items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-3 text-white transition-colors hover:bg-white/20", "ring-2 ring-white")}>
                {c.pill(o, "bg-neutral-950")}<span className="w-6 text-sm font-semibold text-white/80 tabular-nums">{o.rank}</span><Disc o={o} className="size-9 text-xs" /><Who o={o} c={c} light sub={`${one(o.kind)} · ${o.country}`} />
                <span className="shrink-0 text-right"><span className="block text-md font-bold tabular-nums">{c.val(o)}</span><span className="block text-[11px] text-white/70">{c.label.toLowerCase()}</span></span>
            </li>
        ))}
    </ol>
);

/** One card, medals for the first three. Ref: Jomo squads. */
const Medals: B = ({ rows, c }) => (
    <ol className="overflow-hidden rounded-3xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
        {rows.map((o, i) => (
            <li key={o.id} {...li(c, o, "flex items-center gap-3 border-b border-secondary px-4 py-3.5 last:border-0", cx(YOU, "rounded-2xl"))}>
                {c.pill(o, "top-0.5")}
                <span className="flex w-7 justify-center">{i < 3 ? <Award01 aria-label={`Place ${i + 1}`} className={cx("size-6", ["text-[#c9960c]", "text-[#8b95a1]", "text-[#b9703a]"][i])} /> : <span className="text-sm text-tertiary tabular-nums">{o.rank}</span>}</span>
                <Avatar size="md" initials={initials(o.name)} /><Who o={o} c={c} big />
                <span className={cx("shrink-0 text-lg font-bold tabular-nums", i === 0 ? "text-brand-secondary" : "text-primary")}>{c.val(o)}</span>
            </li>
        ))}
    </ol>
);

/** Fat pill cards, avatar flush to the left edge, a pressed rank coin on the right. Ref: corner leader board. */
const Capsule: B = ({ rows, c }) => (
    <ol className="flex flex-col gap-3">
        {rows.map((o, i) => (
            <li key={o.id} {...li(c, o, "flex items-center gap-4 rounded-full bg-primary py-1.5 pr-5 pl-1.5 shadow-sm ring-1 ring-secondary ring-inset transition hover:shadow-md")}>
                {c.pill(o)}<Disc o={o} className="size-16 text-lg md:size-20 md:text-xl" />
                <Who o={o} c={c} big sub={<><b className="font-semibold text-secondary">{c.val(o)}</b> {c.label.toLowerCase()} · {o.country}</>} />
                {i < 3 ? <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-solid text-md font-extrabold text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.22)]">{o.rank}</span> : <span className="shrink-0 text-lg font-extrabold text-quaternary tabular-nums">#{o.rank}</span>}
            </li>
        ))}
    </ol>
);

/** A results table with a header row. Ref: Fixtured standings, Strava challenge. */
const Standings: B = ({ rows, c }) => (
    <div className="rounded-2xl ring-1 ring-secondary ring-inset">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-secondary px-4 py-2.5 text-xs font-semibold tracking-wide text-tertiary uppercase md:grid-cols-[2.25rem_minmax(0,1fr)_7rem_9rem_6rem]"><span>#</span><span>Supporter</span><span className="max-md:hidden">Type</span><span className="max-md:hidden">Country</span><span className="text-right">{c.label}</span></div>
        <ol>
            {rows.map((o) => (
                <li key={o.id} {...li(c, o, "grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-secondary px-4 py-2.5 transition-colors last:border-0 hover:bg-secondary md:grid-cols-[2.25rem_minmax(0,1fr)_7rem_9rem_6rem]", cx(YOU, "rounded-xl"))}>
                    {c.pill(o)}<span className="text-sm font-bold text-primary tabular-nums">{o.rank}</span>
                    <span className="flex min-w-0 items-center gap-2.5"><Avatar size="sm" initials={initials(o.name)} /><Who o={o} c={c} /></span>
                    <span className="text-sm text-tertiary max-md:hidden">{one(o.kind)}</span><span className="truncate text-sm text-tertiary max-md:hidden">{o.country}</span>
                    <span className="text-right text-sm font-bold text-primary tabular-nums">{c.val(o)}</span>
                </li>
            ))}
        </ol>
    </div>
);

/** A season banner, then rows that show today's movement. Ref: Life Reset seasons. */
const Season: B = ({ rows, c }) => {
    const lead = rows[0]; const chase = rows[1];
    return (
        <div className="overflow-hidden rounded-2xl ring-1 ring-secondary ring-inset">
            <div className="flex items-center gap-3 bg-secondary px-4 py-3.5"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-solid text-white"><Trophy01 className="size-5" /></span>
                <div className="min-w-0 flex-1"><div className="text-sm font-bold text-primary">{c.label} season</div>
                    {chase && <><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-tertiary"><div className="h-full rounded-full bg-brand-solid" style={{ width: `${(chase[c.metric] / Math.max(1, lead[c.metric])) * 100}%` }} /></div><div className="mt-1 truncate text-xs text-tertiary"><b className="text-secondary">{c.fmt(c.gap(chase))}</b> puts {chase.name} ahead of {lead.name}</div></>}</div>
            </div>
            <ol>
                {rows.map((o) => (
                    <li key={o.id} {...li(c, o, "flex items-center gap-3 border-t border-secondary px-4 py-2.5", "bg-brand-secondary")}>
                        {c.pill(o)}<span className="w-6 text-xs text-tertiary tabular-nums">{o.rank}</span><Avatar size="md" initials={initials(o.name)} /><Who o={o} c={c} />
                        <span className="shrink-0 text-right"><span className="block text-sm font-bold text-primary tabular-nums">{c.val(o)}</span>{o.today > 0 && <span className="flex items-center justify-end gap-0.5 text-xs font-semibold text-success-primary tabular-nums"><ArrowUp className="size-3" />{c.money(o.today)} today</span>}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
};

/** Dark strip of leaders to swipe through, then cards with the rank set large. Ref: Fi rank. */
const Strip: B = ({ rows, c }) => (
    <div className="flex flex-col gap-3">
        <div className="rounded-3xl bg-neutral-950 px-4 py-5 text-center text-white">
            <ol className="no-scrollbar flex justify-start gap-4 overflow-x-auto pb-1 md:justify-center">{rows.slice(0, 8).map((o, i) => <li key={o.id} className="flex shrink-0 flex-col items-center"><Disc o={o} className={cx(i === 0 ? "size-16 bg-brand-500 text-lg text-white ring-4 ring-brand-300/40" : "size-12 text-sm")} /><span className="-mt-2 rounded-full bg-neutral-800 px-1.5 text-[11px] font-bold tabular-nums ring-2 ring-neutral-950">#{o.rank}</span></li>)}</ol>
            <div className="mt-3 text-sm font-bold tracking-wide uppercase">{c.label} leaders</div><div className="text-xs text-neutral-400">{rows.length} in the race</div>
        </div>
        <ol className="flex flex-col gap-2">
            {rows.map((o) => (
                <li key={o.id} {...li(c, o, "flex items-center gap-3.5 rounded-2xl bg-secondary px-4 py-3.5")}>
                    {c.pill(o)}<Avatar size="lg" initials={initials(o.name)} /><Who o={o} c={c} big sub={`${c.val(o)} · ${o.visits.toLocaleString("en")} visits`} />
                    <span className="shrink-0 font-extrabold text-primary tabular-nums"><sup className="text-xs text-tertiary">#</sup><span className="text-display-xs">{o.rank}</span></span>
                </li>
            ))}
        </ol>
    </div>
);

/** One list cut by a line: above it you are in the hall-of-fame places. Ref: Uxcel leagues "Promotion Zone". */
const Zones: B = ({ rows, c }) => (
    <ol className="flex flex-col">
        {rows.map((o, i) => (
            <li key={o.id} className="contents">
                <div {...li(c, o, cx("flex items-center gap-3 border-x border-b border-secondary px-4 py-3", i === 0 && "rounded-t-2xl border-t", (i === 2 || i === rows.length - 1) && "rounded-b-2xl", i === 3 && "rounded-t-2xl border-t", i < 3 && "bg-success-primary/40"))}>
                    {c.pill(o)}<span className={cx("w-6 text-xs font-semibold tabular-nums", i < 3 ? "text-success-primary" : "text-tertiary")}>{o.rank}</span><Avatar size="md" initials={initials(o.name)} /><Who o={o} c={c} sub={one(o.kind)} />
                    <span className="shrink-0 text-sm text-secondary tabular-nums">{c.val(o)}</span>
                </div>
                {i === 2 && rows.length > 3 && <div className="flex items-center justify-center gap-3 py-3 text-sm font-semibold text-success-primary"><ArrowUp className="size-4" />Hall of fame zone<ArrowUp className="size-4" /></div>}
            </li>
        ))}
    </ol>
);

/** Two newspaper columns of short entries. Ref: Vercel AI Gateway leaderboards. */
const Columns: B = ({ rows, c }) => (
    <ol className="gap-x-10 md:columns-2">
        {rows.map((o) => (
            <li key={o.id} {...li(c, o, "flex break-inside-avoid items-center gap-3 rounded-xl px-1 py-2.5")}>
                {c.pill(o)}<span className="w-5 font-mono text-xs text-tertiary tabular-nums">{o.rank}</span><Avatar size="sm" initials={initials(o.name)} /><Who o={o} c={c} />
                <span className="shrink-0 text-xs font-semibold text-secondary tabular-nums">{c.val(o)}</span>
            </li>
        ))}
    </ol>
);

/** Raised cards for the top three with the figure leading and stars for place, a quiet list under them. Ref: Whop "Top Earners". */
const Earners: B = ({ rows, c }) => (
    <div className="flex flex-col gap-3">
        <ol className="flex flex-col gap-2.5">
            {rows.slice(0, 3).map((o, i) => (
                <li key={o.id} {...li(c, o, "flex items-center gap-3 rounded-2xl bg-gradient-to-b from-bg-primary to-bg-secondary px-4 py-3 shadow-md ring-1 ring-secondary ring-inset")}>
                    {c.pill(o)}<div className="min-w-0 flex-1"><div className="text-xl font-extrabold tracking-tight text-primary tabular-nums">{c.val(o)}</div><div className="mt-1 flex items-center gap-2"><Avatar size="xs" initials={initials(o.name)} /><Who o={o} c={c} sub={false} /></div></div>
                    <span aria-label={`Place ${i + 1}`} className="flex shrink-0 gap-0.5">{Array.from({ length: 3 - i }, (_, k) => <Star01 key={k} className="size-5 fill-brand-400 text-brand-400" />)}</span>
                </li>
            ))}
        </ol>
        <ol className="flex flex-col">{rows.slice(3).map((o) => (
            <li key={o.id} {...li(c, o, "flex items-center gap-3 border-b border-secondary px-1 py-2.5 last:border-0")}>{c.pill(o)}<span className="w-6 text-xs text-tertiary tabular-nums">{o.rank}</span><Avatar size="sm" initials={initials(o.name)} /><Who o={o} c={c} sub={false} /><span className="shrink-0 text-sm font-semibold text-secondary tabular-nums">{c.val(o)}</span></li>
        ))}</ol>
    </div>
);

/** Always-dark, dense, with how long each has been on the board. Ref: Garmin Connect leaderboard. */
const Night: B = ({ rows, c }) => (
    <ol className="rounded-2xl bg-neutral-950 px-4 py-2 text-white">
        {rows.map((o) => (
            <li key={o.id} {...li(c, o, "flex items-center gap-3.5 border-b border-white/10 py-3 last:border-0", "rounded-xl bg-white/10 px-2")}>
                {c.pill(o)}<span className="w-5 text-xs text-neutral-400 tabular-nums">{o.rank}</span><Disc o={o} className="size-9 bg-neutral-800 text-xs text-white" />
                <Who o={o} c={c} light sub={o.days === 0 ? "Joined today" : `${o.days}d on the board`} /><span className="shrink-0 text-sm text-neutral-300 tabular-nums">{c.val(o)}</span>
            </li>
        ))}
    </ol>
);

/** Rank coin over the avatar and a button on every row. Ref: Deepstash "Top curators". */
const Follow: B = ({ rows, c }) => (
    <ol className="flex flex-col">
        {rows.map((o) => (
            <li key={o.id} {...li(c, o, "flex items-center gap-3.5 border-b border-secondary py-3.5 last:border-0", cx(YOU, "rounded-2xl"))}>
                <span className="relative ml-3 shrink-0"><Avatar size="lg" initials={initials(o.name)} /><span className="absolute top-1/2 -left-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white ring-2 ring-bg-primary tabular-nums">{o.rank}</span></span>
                <Who o={o} c={c} big sub={`${c.val(o)} · ${o.country}`} />
                {claimBtn(c, o, "rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 max-md:hidden", "Outgive")}
            </li>
        ))}
    </ol>
);

/** Tiles with the rank as a giant faded numeral behind each. Ref: canvas direction B, Skillshare achievement tiles. */
const Numerals: B = ({ rows, c }) => (
    <ol className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {rows.map((o, i) => (
            <li key={o.id} {...li(c, o, cx("flex min-h-36 min-w-0 flex-col justify-end gap-0.5 overflow-hidden rounded-2xl p-4 ring-1 ring-secondary ring-inset", i === 0 ? "bg-brand-solid text-white ring-transparent [&_button]:text-white" : "bg-primary"))}>
                {c.pill(o, cx("top-2", i === 0 && "bg-neutral-950"))}
                <span aria-hidden="true" className={cx("pointer-events-none absolute -top-4 right-2 text-[6.5rem] leading-none font-extrabold tabular-nums", i === 0 ? "text-white/20" : "text-brand-100")}>{o.rank}</span>
                <span className={cx("relative truncate text-sm font-semibold", i === 0 ? "text-white" : "text-primary")}>{o.name}</span>
                <span className={cx("relative text-xl font-extrabold tracking-tight tabular-nums", i !== 0 && "text-brand-secondary")}>{c.val(o)}</span>
                <span className={cx("relative truncate text-xs", i === 0 ? "text-white/80" : "text-tertiary")}>{one(o.kind)} · {o.country}</span>
                <span className="relative flex items-center gap-2 text-xs">{c.badge(o)}<span className="md:hidden">{c.link(o)}</span></span>
            </li>
        ))}
    </ol>
);

/** Cards to swipe sideways, one per rank. */
const Carousel: B = ({ rows, c }) => (
    <ol className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-3 pb-2">
        {rows.map((o, i) => (
            <li key={o.id} {...li(c, o, cx("flex w-52 shrink-0 snap-start flex-col items-center gap-1.5 rounded-3xl p-5 text-center ring-1 ring-secondary ring-inset", i === 0 ? "bg-brand-secondary" : "bg-primary"), "ring-2 ring-brand")}>
                {c.pill(o)}<span className="rounded-full bg-brand-solid px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">#{o.rank}</span>
                <Avatar size="2xl" initials={initials(o.name)} className="mt-1" />
                <span className="flex max-w-full items-center gap-1.5"><span className={cx(NAME, "text-md text-primary group-hover:text-brand-secondary")}>{o.name}</span>{c.badge(o)}</span>
                <span className="text-xl font-extrabold tracking-tight text-brand-secondary tabular-nums">{c.val(o)}</span>
                <span className="line-clamp-2 min-h-8 text-xs text-tertiary">{o.tagline}</span><span className="text-xs md:hidden">{c.link(o)}</span>
            </li>
        ))}
    </ol>
);

/** The top ten as a column chart you can read at a glance, the rest listed under it. */
const Skyline: B = ({ rows, c }) => {
    const max = top(rows, c);
    return (
        <div className="flex flex-col gap-3">
            <ol className="no-scrollbar flex h-72 items-end gap-2 overflow-x-auto rounded-3xl bg-secondary px-4 pt-10 pb-4">
                {rows.slice(0, 10).map((o, i) => (
                    <li key={o.id} {...li(c, o, "flex h-full min-w-12 flex-1 flex-col items-center justify-end gap-1.5", "rounded-xl ring-2 ring-brand")}>
                        {c.pill(o, "top-0")}<span className="text-[11px] font-bold whitespace-nowrap text-primary tabular-nums">{c.val(o)}</span>
                        <div className={cx("w-full rounded-t-xl transition-[height] duration-700", i === 0 ? "bg-brand-solid" : i < 3 ? "bg-brand-400" : "bg-brand-200")} style={{ height: `${Math.max(6, (o[c.metric] / max) * 100)}%` }} />
                        <Avatar size="sm" initials={initials(o.name)} /><span className="text-[11px] font-semibold text-tertiary tabular-nums">#{o.rank}</span>
                    </li>
                ))}
            </ol>
            <ol className="flex flex-col">{rows.map((o) => (
                <li key={o.id} className="group relative flex items-center gap-3 border-b border-secondary px-1 py-2.5 last:border-0"><span className="w-6 text-xs text-tertiary tabular-nums">{o.rank}</span><Who o={o} c={c} /><span className="shrink-0 text-sm font-semibold text-secondary tabular-nums">{c.val(o)}</span></li>
            ))}</ol>
        </div>
    );
};

/** A ladder: the space between two rungs grows with the gap between them. */
const Ladder: B = ({ rows, c }) => {
    const widest = Math.max(1, ...rows.map((o) => c.gap(o)));
    return (
        <ol className="relative flex flex-col before:absolute before:inset-y-4 before:left-[1.4rem] before:w-0.5 before:bg-tertiary">
            {rows.map((o, i) => (
                <li key={o.id} className="contents">
                    {i > 0 && <div className="relative flex items-center gap-3 pl-12" style={{ height: `${Math.round(18 + (c.gap(o) / widest) * 54)}px` }}><span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-tertiary tabular-nums">{c.fmt(c.gap(o))} to climb</span></div>}
                    <div {...li(c, o, "flex items-center gap-3 rounded-2xl py-1 pr-2")}>
                        {c.pill(o)}<span className={cx("relative flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold tabular-nums ring-4 ring-bg-primary", i === 0 ? "bg-brand-solid text-white" : "bg-brand-100 text-brand-800")}>{o.rank}</span>
                        <Who o={o} c={c} big /><span className="shrink-0 text-md font-bold text-brand-secondary tabular-nums">{c.val(o)}</span>
                    </div>
                </li>
            ))}
        </ol>
    );
};

/** Neighbours paired off head to head, with the split between them drawn as one bar. */
const Duel: B = ({ rows, c }) => (
    <ol className="flex flex-col gap-3">
        {Array.from({ length: Math.ceil(rows.length / 2) }, (_, k) => [rows[k * 2], rows[k * 2 + 1]] as const).map(([a, b]) => {
            const share = b ? (a[c.metric] / Math.max(1, a[c.metric] + b[c.metric])) * 100 : 100;
            const side = (o: Row, right?: boolean) => (
                <div {...li(c, o, cx("flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1", right && "sm:flex-row-reverse sm:text-right"))}>
                    {c.pill(o)}<Avatar size="md" initials={initials(o.name)} />
                    <div className="min-w-0"><div className={cx("flex items-center gap-1.5", right && "sm:justify-end")}><span className={cx(NAME, "text-sm text-primary group-hover:text-brand-secondary")}>{o.name}</span>{c.badge(o)}</div><div className="text-xs text-tertiary tabular-nums">#{o.rank} · <b className="font-semibold text-secondary">{c.val(o)}</b></div><span className="text-xs md:hidden">{c.link(o)}</span></div>
                </div>
            );
            return (
                <li key={a.id} className="rounded-2xl p-3 ring-1 ring-secondary ring-inset">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">{side(a)}{b && <><span className="shrink-0 self-center rounded-full bg-secondary px-2 py-1 text-[11px] font-extrabold text-tertiary">VS</span>{side(b, true)}</>}</div>
                    {b && <><div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-brand-200"><div className="h-full rounded-full bg-brand-solid" style={{ width: `${share}%` }} /></div><p className="mt-1.5 text-center text-xs text-tertiary">{b.name} needs <b className="font-semibold text-secondary">{c.fmt(c.gap(b))}</b> to take #{a.rank}</p></>}
                </li>
            );
        })}
    </ol>
);

/** A till receipt: monospace lines, dotted leaders, a total at the foot. */
const Receipt: B = ({ rows, c }) => (
    <div className="mx-auto w-full max-w-md bg-primary px-5 pt-6 pb-8 font-mono text-sm text-primary shadow-lg ring-1 ring-secondary [clip-path:polygon(0_0,100%_0,100%_calc(100%-8px),97.5%_100%,95%_calc(100%-8px),92.5%_100%,90%_calc(100%-8px),87.5%_100%,85%_calc(100%-8px),82.5%_100%,80%_calc(100%-8px),77.5%_100%,75%_calc(100%-8px),72.5%_100%,70%_calc(100%-8px),67.5%_100%,65%_calc(100%-8px),62.5%_100%,60%_calc(100%-8px),57.5%_100%,55%_calc(100%-8px),52.5%_100%,50%_calc(100%-8px),47.5%_100%,45%_calc(100%-8px),42.5%_100%,40%_calc(100%-8px),37.5%_100%,35%_calc(100%-8px),32.5%_100%,30%_calc(100%-8px),27.5%_100%,25%_calc(100%-8px),22.5%_100%,20%_calc(100%-8px),17.5%_100%,15%_calc(100%-8px),12.5%_100%,10%_calc(100%-8px),7.5%_100%,5%_calc(100%-8px),2.5%_100%,0_calc(100%-8px))]">
        <div className="border-b border-dashed border-primary pb-3 text-center"><div className="text-md font-bold tracking-[0.25em] uppercase">Leaderboard</div><div className="text-xs text-tertiary uppercase">{c.label} · {rows.length} entries</div></div>
        <ol className="py-2">
            {rows.map((o) => (
                <li key={o.id} {...li(c, o, "flex items-baseline gap-2 py-1.5", "bg-brand-secondary")}>
                    {c.pill(o)}<span className="w-6 text-tertiary tabular-nums">{String(o.rank).padStart(2, "0")}</span>
                    <span className="truncate uppercase group-hover:text-brand-secondary">{o.name}{c.you === o.id && " *"}</span><span aria-hidden="true" className="min-w-4 flex-1 border-b border-dotted border-primary" /><span className="shrink-0 font-bold tabular-nums">{c.val(o)}</span>
                </li>
            ))}
        </ol>
        <div className="flex justify-between border-t border-dashed border-primary pt-3 font-bold uppercase"><span>Total</span><span className="tabular-nums">{c.fmt(rows.reduce((n, o) => n + o[c.metric], 0))}</span></div>
        <p className="mt-4 text-center text-xs text-tertiary uppercase">Thank you for giving</p>
    </div>
);

/** A cloud of circles sized by the figure. Selecting one claims its rank. */
const Bubbles: B = ({ rows, c }) => {
    const max = top(rows, c);
    return (
        <ol className="flex flex-wrap items-center justify-center gap-2 rounded-3xl bg-secondary p-4">
            {rows.map((o, i) => { const d = Math.round(64 + Math.sqrt(o[c.metric] / max) * 112); return (
                <li key={o.id} id={`row-${o.id}`}>
                    <button type="button" onClick={() => c.canClaim && c.claim(o)} title={`#${o.rank} ${o.name}: ${c.val(o)}`} style={{ width: d, height: d }} className={cx("flex cursor-pointer flex-col items-center justify-center rounded-full p-2 text-center outline-focus-ring transition duration-200 hover:scale-105 focus-visible:outline-2", i === 0 ? "bg-brand-solid text-white" : i < 3 ? "bg-brand-300 text-brand-950" : "bg-primary text-primary ring-1 ring-secondary ring-inset", c.you === o.id && "ring-4 ring-brand")}>
                        <span className="text-[11px] font-bold opacity-70 tabular-nums">#{o.rank}</span>
                        <span className={cx("max-w-full truncate font-semibold", d > 120 ? "text-sm" : "text-[11px]")}>{d > 110 ? o.name : initials(o.name)}</span>
                        {d > 84 && <span className={cx("font-extrabold tabular-nums", d > 120 ? "text-md" : "text-xs")}>{c.val(o)}</span>}
                    </button>
                </li>
            ); })}
        </ol>
    );
};

/** A stadium board: every character of the figure sits in its own tile. */
const Scoreboard: B = ({ rows, c }) => (
    <ol className="flex flex-col gap-1.5 rounded-2xl bg-neutral-950 p-3 md:p-4">
        {rows.map((o, i) => (
            <li key={o.id} {...li(c, o, "flex items-center gap-2.5 rounded-lg bg-neutral-900 px-2.5 py-2 text-white", "ring-2 ring-brand-400")}>
                {c.pill(o)}<span className={cx("flex h-8 min-w-9 items-center justify-center rounded-md px-1 font-mono text-sm font-bold tabular-nums", i < 3 ? "bg-brand-500 text-white" : "bg-neutral-800 text-neutral-300")}>{o.rank}</span>
                <div className="min-w-0 flex-1 [&_button]:text-brand-300"><div className="truncate text-sm font-semibold tracking-wide uppercase group-hover:text-brand-300">{o.name}{c.you === o.id && " · you"}</div><span className="text-xs md:hidden">{c.link(o)}</span></div>
                <span aria-label={c.val(o)} className="flex shrink-0 gap-0.5">{[...c.val(o)].map((ch, k) => <span key={k} aria-hidden="true" className={cx("flex h-8 items-center justify-center rounded-[5px] font-mono text-sm font-bold", /\d/.test(ch) ? "w-4 bg-neutral-800 text-brand-300 shadow-[inset_0_-1px_0_rgb(0_0_0/0.6)] md:w-5" : "px-px text-neutral-400 md:px-0.5")}>{ch}</span>)}</span>
            </li>
        ))}
    </ol>
);

export const MORE_BOARDS: Record<string, { name: string; board: B }> = {
    minimal: { name: "Minimal", board: Minimal }, glass: { name: "Glass", board: Glass }, medals: { name: "Medals", board: Medals }, capsule: { name: "Capsule", board: Capsule },
    standings: { name: "Standings", board: Standings }, season: { name: "Season", board: Season }, strip: { name: "Leader strip", board: Strip }, zones: { name: "Zones", board: Zones },
    columns: { name: "Columns", board: Columns }, earners: { name: "Top earners", board: Earners }, night: { name: "Night", board: Night }, follow: { name: "Coins", board: Follow },
    numerals: { name: "Numerals", board: Numerals }, carousel: { name: "Carousel", board: Carousel }, skyline: { name: "Skyline", board: Skyline }, ladder: { name: "Ladder", board: Ladder },
    duel: { name: "Duels", board: Duel }, receipt: { name: "Receipt", board: Receipt }, bubbles: { name: "Bubbles", board: Bubbles }, scoreboard: { name: "Scoreboard", board: Scoreboard },
};
/** Every layout the ranking can be drawn in, as [key, name]. */
export const ALL_VARIANTS: [string, string][] = [...VARIANTS, ...Object.entries(MORE_BOARDS).map(([k, v]) => [k, v.name] as [string, string])];
