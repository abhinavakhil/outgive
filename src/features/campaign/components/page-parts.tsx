import { ShieldTick, Star01, TrendUp01 } from "@untitledui/icons";
import { createContext, useContext, useState } from "react";
import { type LayoutId, type PageData, type PageUpdate, type Supporter, daysLeft, pct, typeOf } from "@/shared/domain/model";
import { useApp } from "@/shared/lib/app-context";
import { LEVELS, PEOPLE } from "@/shared/lib/demo-data";
import { ago, initials } from "@/shared/lib/format";
import { Avatar, Badge, Button, Ring, Card, CoverMedia, DescriptionView } from "@/shared/ui";
import { cx } from "@/shared/utils/cx";

/** The page being viewed. Lets shared sections show an empty state on a newly published page instead of sample people. */
export const PageContext = createContext<PageData | null>(null);
export const PageActions = createContext<{ donate: (usd?: number) => void; share: () => void; donations: (mode: "all" | "top") => void; postUpdate: ((u: PageUpdate) => void) | null }>({ donate: () => {}, share: () => {}, donations: () => {}, postUpdate: null });

export const Cover = ({ className }: { className?: string }) => {
    const page = useContext(PageContext);
    return <CoverMedia cover={page?.cover ?? { kind: "none", src: "" }} className={cx("aspect-video max-w-full min-w-0", className)} />;
};
export const TypeBadge = ({ p }: { p: PageData }) => <Badge type="pill-color" color="brand" size="md">{typeOf(p).label}</Badge>;
export const OrgLine = ({ p }: { p: PageData }) => (
    <div className="flex items-center gap-2.5 text-sm text-tertiary">
        <Avatar size="sm" initials={initials(p.org) || "?"} />
        <span>by <span className="font-semibold text-primary">{p.org}</span> · Registered charity · {p.country}</span>
    </div>
);
export const Raised = ({ p, size = "lg" }: { p: PageData; size?: "lg" | "xl" }) => {
    const { money } = useApp();
    return (
        <div>
            <span className={cx("font-semibold tracking-tight text-brand-secondary", size === "xl" ? "text-display-md" : "text-display-sm")}>{money(p.raised)}</span>{" "}
            <span className="text-tertiary">raised of {money(p.goal)}</span>
        </div>
    );
};

/** Where this page stands on the charity's board, and what it takes to climb one place. */
export const boardRank = (p: PageData, board: Supporter[]) => {
    const sorted = [...board].sort((a, b) => b.total - a.total);
    const i = sorted.findIndex((c) => c.name.toLowerCase() === p.title.toLowerCase());
    const total = i >= 0 ? sorted[i].total : p.raised;
    const next = i >= 0 ? sorted[i - 1] : sorted.filter((c) => c.total >= p.raised).pop();
    return { rank: i >= 0 ? i + 1 : sorted.filter((c) => c.total >= p.raised).length + 1, listed: i >= 0, next, gap: next ? next.total + 1 - total : 0 };
};

/** The sticky donate card: progress, the two actions and the live feed of gifts. */
export const Donate = ({ p, cta }: { p: PageData; cta?: string }) => {
    const { money, board, brand } = useApp();
    const { donate, share, donations } = useContext(PageActions);
    const topUsd = Math.max(0, ...p.donations.map((d) => d.usd));
    const rank = boardRank(p, board);
    const label = cta ?? (typeOf(p).cta === "Donate" ? "Donate now" : typeOf(p).cta);
    return (
        <Card className="flex flex-col gap-4 md:p-5">
            <div className="flex items-center gap-4">
                {p.showGoal && <Ring value={pct(p)} />}
                <div className="min-w-0">
                    <div className="text-xl font-semibold tracking-tight text-primary">{money(p.raised)} raised{p.showGoal && <span className="font-normal text-tertiary"> of {money(p.goal)}</span>}</div>
                    <div className="text-sm text-tertiary">{p.supporters} donations{daysLeft(p) !== null && <> · {daysLeft(p)} days left</>}</div>
                </div>
            </div>
            <Button size="xl" color="primary" className="w-full rounded-full" onPress={() => donate()}>{label}</Button>
            <button type="button" onClick={share} className="h-14 w-full cursor-pointer rounded-full bg-primary-solid text-md font-semibold text-white outline-focus-ring transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2">Share</button>
            <div className="flex items-center gap-3 rounded-2xl bg-brand-primary p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-solid text-sm font-semibold text-white">#{rank.rank}</span>
                <div className="min-w-0 flex-1 text-sm"><div className="font-semibold text-primary">{rank.listed ? `On the ${brand.name} leaderboard` : `Would rank on the ${brand.name} board`}</div><div className="text-xs text-tertiary">{rank.next ? `${money(rank.gap)} more takes #${rank.rank - 1} from ${rank.next.name}` : "This is the top rank"}</div></div>
                {rank.next && <Button size="sm" color="secondary" className="rounded-full" onPress={() => donate(rank.gap)}>Outbid</Button>}
            </div>
            {p.donations.length > 0 && <>
                <div className="flex items-center gap-3 text-sm font-semibold text-brand-secondary"><span className="flex size-10 items-center justify-center rounded-full bg-brand-secondary"><TrendUp01 className="size-5" /></span>{p.donations.length} recent donations</div>
                <ul className="flex flex-col gap-3">{p.donations.slice(0, 5).map((d, i) => (
                    <li key={`${d.at}-${i}`} className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary">{(initials(d.name) || "A")[0]}</span>
                        <span className="min-w-0"><span className="block truncate text-sm font-medium text-primary">{d.name}</span><span className="block text-xs text-tertiary"><span className="font-semibold text-secondary">{money(d.usd)}</span> · {d.usd === topUsd && p.donations.length > 1 ? "Top donation" : ago(d.at)}{d.monthly && " · Monthly"}</span></span>
                    </li>
                ))}</ul>
                <div className="grid grid-cols-2 gap-2"><Button size="md" color="secondary" className="rounded-full" onPress={() => donations("all")}>See all</Button><Button size="md" color="secondary" className="rounded-full" iconLeading={Star01} onPress={() => donations("top")}>See top</Button></div>
            </>}
            <p className="text-center text-xs text-tertiary">The full gift goes to the charity</p>
        </Card>
    );
};

export const Board = ({ title = "Top fundraisers", items = PEOPLE, limit = 5 }: { title?: string; items?: [string, number][]; limit?: number }) => {
    const { money } = useApp();
    const page = useContext(PageContext);
    const rows = page && !page.isSample ? [...page.donations].sort((a, b) => b.usd - a.usd).map((d) => [d.name, d.usd] as [string, number]) : items;
    if (rows.length === 0) {
        return (
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold text-primary">{title}</h2>
                <p className="rounded-xl bg-secondary px-4 py-5 text-sm text-tertiary ring-1 ring-secondary ring-inset">Nobody here yet. The first gift puts a name on this list.</p>
            </section>
        );
    }
    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-primary">{title}</h2>
            <ol className="flex flex-col gap-1">
                {rows.slice(0, limit).map(([name, amount], i) => (
                    <li key={`${name}-${i}`} className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5", i < 3 && "bg-brand-primary")}>
                        <span className={cx("w-8 font-semibold", i < 3 ? "text-brand-secondary" : "text-tertiary")}>#{i + 1}</span>
                        <Avatar size="sm" initials={initials(name)} />
                        <span className="flex-1 font-medium text-primary">{name}</span>
                        <span className="font-semibold text-brand-secondary">{money(amount)}</span>
                    </li>
                ))}
            </ol>
        </section>
    );
};
export const Story = ({ p, lead, bare }: { p: PageData; lead?: boolean; bare?: boolean }) => {
    const [open, setOpen] = useState(false);
    const text = p.story.replace(/<[^>]*>/g, "").trim();
    const long = bare && text.length > 700;
    return (
        <section className="flex flex-col gap-3">
            {!bare && <h2 className="text-xl font-semibold text-primary">The story</h2>}
            {text
                ? <div className="relative"><DescriptionView html={p.story} className={cx("max-w-prose", lead && "text-lg", long && !open && "max-h-80 overflow-hidden")} />{long && !open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-primary to-transparent" />}</div>
                : <p className="max-w-prose text-md text-tertiary">The story has not been written yet.</p>}
            {long && <button type="button" onClick={() => setOpen((o) => !o)} className="w-fit cursor-pointer text-sm font-semibold text-primary underline underline-offset-4">{open ? "Show less" : "Read more"}</button>}
        </section>
    );
};
export const OrganizerLine = ({ p }: { p: PageData }) => (
    <div className="flex items-center gap-3 border-y border-secondary py-4"><Avatar size="md" initials={initials(p.org) || "?"} /><span className="font-semibold text-primary">{p.org}</span><span className="text-sm text-tertiary">is organising this {typeOf(p).label.toLowerCase()}</span></div>
);
export const Protected = () => <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-brand-secondary px-2.5 py-1 text-sm font-semibold text-primary"><ShieldTick className="size-4" />Donation protected</span>;
/** Giving levels. The sample page names what each buys; a published page offers its own gift amounts and claims nothing about them. */
export const Levels = () => {
    const { money } = useApp();
    const { donate } = useContext(PageActions);
    const page = useContext(PageContext);
    const levels: [number, string, string][] = page && !page.isSample ? page.gifts.slice(0, 3).map((g) => [g, "Give once", `Goes to ${page.org || page.title}`]) : LEVELS;
    return (
        <div className="grid gap-3 sm:grid-cols-3">
            {levels.map(([amount, name, what]) => (
                <Card key={amount} className="flex flex-col gap-2 md:p-5">
                    <span className="text-display-xs font-semibold text-brand-secondary">{money(amount)}</span>
                    <span className="font-semibold text-primary">{name}</span>
                    <span className="flex-1 text-sm text-tertiary">{what}</span>
                    <Button size="sm" color="secondary" className="rounded-full" onPress={() => donate(amount)}>Give {money(amount)}</Button>
                </Card>
            ))}
        </div>
    );
};
export const Stats = ({ items }: { items: [string, string][] }) => (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map(([value, label]) => (
            <Card key={label} className="md:p-5"><div className="text-display-xs font-semibold text-primary">{value}</div><div className="text-sm text-tertiary">{label}</div></Card>
        ))}
    </div>
);

/** Small wireframe of each layout, drawn from percentage boxes. k = ink, a = accent, t = tint, g = grey, w = white card. */
type Box = [number, number, number, number, "k" | "a" | "t" | "g" | "w"];
const WF: Record<LayoutId, Box[]> = {
    classic: [[4, 6, 40, 6, "k"], [4, 18, 56, 46, "t"], [64, 18, 32, 60, "w"], [68, 24, 24, 5, "a"], [68, 66, 24, 8, "a"], [4, 70, 56, 4, "g"], [4, 78, 44, 4, "g"]],
    split: [[0, 0, 50, 100, "t"], [6, 28, 34, 7, "k"], [6, 40, 26, 5, "k"], [6, 56, 34, 4, "a"], [6, 68, 16, 9, "a"], [50, 0, 50, 100, "g"]],
    "full-bleed": [[0, 0, 100, 46, "g"], [6, 18, 46, 8, "k"], [6, 30, 30, 5, "k"], [62, 26, 32, 60, "w"], [66, 32, 24, 5, "a"], [66, 74, 24, 8, "a"], [6, 56, 48, 4, "g"], [6, 64, 40, 4, "g"]],
    poster: [[0, 0, 100, 100, "a"], [8, 14, 70, 13, "w"], [8, 31, 48, 13, "w"], [8, 58, 84, 5, "w"], [8, 72, 24, 11, "k"]],
    story: [[28, 6, 44, 7, "k"], [28, 18, 44, 30, "t"], [28, 54, 44, 3, "g"], [28, 60, 44, 3, "g"], [28, 66, 36, 3, "g"], [28, 80, 20, 9, "a"]],
    dashboard: [[4, 6, 40, 7, "k"], [4, 20, 21, 18, "t"], [28, 20, 21, 18, "t"], [52, 20, 21, 18, "t"], [76, 20, 20, 18, "t"], [4, 44, 92, 6, "a"], [4, 56, 56, 38, "w"], [64, 56, 32, 38, "w"]],
    leaderboard: [[4, 6, 44, 8, "k"], [4, 22, 58, 10, "a"], [4, 35, 58, 10, "t"], [4, 48, 58, 10, "t"], [4, 61, 58, 10, "g"], [4, 74, 58, 10, "g"], [66, 22, 30, 50, "w"], [70, 60, 22, 8, "a"]],
    ticket: [[4, 8, 15, 24, "a"], [23, 10, 40, 7, "k"], [23, 22, 30, 4, "g"], [4, 40, 56, 26, "t"], [4, 72, 56, 4, "g"], [4, 80, 56, 4, "g"], [66, 40, 30, 52, "w"], [70, 78, 22, 8, "a"]],
    tracker: [[4, 6, 44, 7, "k"], [4, 22, 92, 22, "w"], [8, 34, 50, 5, "a"], [60, 34, 32, 5, "g"], [4, 50, 21, 16, "t"], [27, 50, 21, 16, "t"], [50, 50, 10, 16, "g"], [66, 50, 30, 44, "w"], [70, 80, 22, 8, "a"]],
    bento: [[4, 6, 58, 40, "t"], [8, 30, 36, 7, "k"], [66, 6, 30, 40, "g"], [4, 50, 30, 44, "w"], [8, 80, 22, 8, "a"], [38, 50, 26, 44, "t"], [68, 50, 28, 44, "w"]],
    chapters: [[4, 8, 40, 7, "k"], [4, 20, 26, 5, "g"], [4, 32, 16, 9, "a"], [56, 6, 40, 34, "t"], [4, 48, 92, 9, "g"], [6, 50, 14, 5, "a"], [4, 64, 56, 4, "g"], [4, 72, 48, 4, "g"], [66, 62, 30, 32, "w"]],
    impact: [[26, 6, 48, 8, "k"], [34, 18, 32, 4, "g"], [4, 30, 29, 34, "w"], [35.5, 30, 29, 34, "w"], [67, 30, 29, 34, "w"], [8, 54, 20, 6, "a"], [39.5, 54, 20, 6, "a"], [71, 54, 20, 6, "a"], [4, 70, 92, 7, "a"], [4, 82, 56, 12, "t"]],
};
const WF_FILL = { k: "bg-fg-primary", a: "bg-brand-400", t: "bg-brand-100", g: "bg-tertiary", w: "bg-primary ring-1 ring-secondary ring-inset" };
export const LayoutThumb = ({ id, className }: { id: LayoutId; className?: string }) => (
    <div aria-hidden="true" className={cx("relative h-24 w-full overflow-hidden rounded-lg bg-secondary_alt ring-1 ring-secondary ring-inset", className)}>
        {WF[id].map(([x, y, w, h, c], i) => (
            <div key={i} className={cx("absolute rounded-[3px]", WF_FILL[c])} style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }} />
        ))}
    </div>
);
