import type { PageRef } from "@/lib/route";
import { ChevronDown, Copy01, LinkExternal01, Moon01, Plus, QrCode01, ShieldTick, Star01, Sun, Trash01, TrendUp01, Zap } from "@untitledui/icons";
import { type FC, type ReactNode, createContext, useContext, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ProgressBarBase } from "@/components/base/progress-indicators/progress-indicators";
import { cx } from "@/utils/cx";
import { CoverMedia, DescriptionView } from "@/components/outgive/media";
import { type Activity, type Brand, type Supporter, CURRENCIES, LEVELS, PAGE_TYPES, PEOPLE, type LayoutId, type PageData, type PageUpdate, initials } from "@/data";

import type { DB } from "@/lib/db";
import { LIVE_LAYOUTS, type LiveItem, type LiveLayout, type LiveState, type Org, type User } from "@/lib/types";
import { type Tenant, type View } from "@/lib/route";
export type { View } from "@/lib/route";

/** Navigation targets. Short forms leave out the organisation: it is the one on screen (or the demo). */
export type Go = View | { name: "home" } | { name: "create"; parent?: string } | { name: "page"; key: string } | { name: "admin"; tab?: string } | { name: "live" } | { name: "overlay" } | { name: "give"; page?: PageRef } | { name: "thanks" };
export interface AppCtx {
    db: DB; user: User | null; tenant: Tenant; org: Org | null; member: boolean; isDemo: boolean;
    currency: string; setCurrency: (c: string) => void; money: (usd: number) => string;
    go: (v: Go) => void; href: (v: Go) => string;
    board: Supporter[]; activity: Activity[]; hall: [string, string, number][]; refresh: () => void;
    brand: Brand; setBrand: (b: Brand) => void; setOrg: (o: Org) => void;
    /** The board row this browser claimed, if any. */
    me: string | null; setMe: (id: string | null) => void;
    toast: (m: string) => void;
}
export const AppContext = createContext<AppCtx>(null!);
export const useApp = () => useContext(AppContext);

/** The charity's mark: its uploaded logo, or its initials in the brand colour. */
export const BrandMark = ({ className }: { className?: string }) => {
    const { brand } = useApp();
    return brand.logo
        ? <img src={brand.logo} alt="" className={cx("size-9 shrink-0 rounded-xl object-cover", className)} />
        : <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-solid text-sm font-bold text-white", className)}>{initials(brand.name) || "?"}</span>;
};
/** The charity's name and mark; links home. */
export const BrandLogo = ({ onClick }: { onClick?: () => void }) => {
    const { brand } = useApp();
    return (
        <button type="button" onClick={onClick} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md text-left outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
            <BrandMark className="size-7 rounded-lg text-xs" />
            <span className="truncate text-[22px] leading-tight font-medium tracking-[-0.04em] text-primary">{brand.name}</span>
        </button>
    );
};
/** The page being viewed. Lets shared sections show an empty state on a newly published page instead of sample people. */
export const PageContext = createContext<PageData | null>(null);
export const makeMoney = (currency: string) => (usd: number) =>
    new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.round(usd * CURRENCIES[currency]));

export const Logo = ({ onClick }: { onClick?: () => void }) => (
    <button type="button" onClick={onClick} className="flex cursor-pointer items-center gap-2 rounded-md text-xl font-semibold tracking-tight text-primary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
        <svg width="28" height="24" viewBox="0 0 28 24" aria-hidden="true" fill="none" strokeLinecap="round" strokeWidth="4.2">
            <path d="M7 5h18" className="stroke-brand-600" /><path d="M7 12h12" className="stroke-fg-primary" /><path d="M7 19h6" className="stroke-fg-primary" /><path d="M3 5v14" className="stroke-fg-primary" />
        </svg>
        outgive
    </button>
);

const useTheme = () => {
    const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark-mode"));
    const toggle = () => {
        const next = !dark;
        document.documentElement.classList.toggle("dark-mode", next);
        try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* storage unavailable */ }
        setDark(next);
    };
    return [dark, toggle] as const;
};
export const ThemeToggle = () => {
    const [dark, toggle] = useTheme();
    return (
        <button type="button" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={toggle} className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-tertiary outline-focus-ring transition hover:bg-secondary hover:text-primary focus-visible:outline-2">
            {dark ? <Sun className="size-4" /> : <Moon01 className="size-4" />}
        </button>
    );
};

/** Header used by every screen except the landing page. */
export const SiteHeader = ({ right }: { right?: ReactNode }) => {
    const { go } = useApp();
    return (
        <header className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4"><BrandLogo onClick={() => go({ name: "home" })} /></div>
            <nav aria-label="Main" className="flex shrink-0 items-center gap-1 text-sm font-medium text-tertiary sm:gap-2">
                {(["about", "rules", "faq"] as const).map((n) => (
                    <button key={n} type="button" onClick={() => go({ name: n })} className="hidden cursor-pointer rounded-full px-3 py-1.5 capitalize outline-focus-ring transition hover:text-primary focus-visible:outline-2 sm:block">{n === "faq" ? "FAQ" : n}</button>
                ))}
                {right}<ThemeToggle />
            </nav>
        </header>
    );
};

/** The one select style for toolbars and filters: pill, same font and height as the other controls, custom chevron. */
export const FIELD = "h-11 rounded-full bg-primary px-4 text-md text-primary ring-1 ring-primary ring-inset outline-focus-ring placeholder:text-placeholder focus:outline-2";
export const PillSelect = ({ label, value, onChange, options, placeholder, className, size = "md" }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; className?: string; size?: "sm" | "md" }) => (
    <span className={cx("relative inline-flex", className)}>
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cx(FIELD, "w-full cursor-pointer appearance-none pr-9", size === "sm" && "h-9 text-sm", !value && placeholder && "text-placeholder")}>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-quaternary" />
    </span>
);

export const Container = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cx("mx-auto w-full max-w-6xl px-4 md:px-8", className)}>{children}</div>;
export const Card = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cx("rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset md:p-6", className)}>{children}</div>;
export const PageActions = createContext<{ donate: (usd?: number) => void; share: () => void; donations: (mode: "all" | "top") => void; postUpdate: ((u: PageUpdate) => void) | null }>({ donate: () => {}, share: () => {}, donations: () => {}, postUpdate: null });
export const ago = (t: number) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? "just now" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} hrs` : `${Math.round(m / 1440)} d`; };
export const dateOf = (t: number | string) => new Date(t).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });

/** Circular progress with the percentage in the middle, as on the donate card. */
export const Ring = ({ value, size = 64 }: { value: number; size?: number }) => {
    const r = (size - 8) / 2; const c = 2 * Math.PI * r;
    return (
        <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${value}% funded`}>
            <svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" className="stroke-bg-tertiary" /><circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="stroke-brand-600" /></svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-primary">{value}%</span>
        </span>
    );
};

export const Cover = ({ className }: { className?: string }) => {
    const page = useContext(PageContext);
    return <CoverMedia cover={page?.cover ?? { kind: "none", src: "" }} className={cx("aspect-video max-w-full min-w-0", className)} />;
};
export const typeOf = (p: PageData) => PAGE_TYPES.find((t) => t.id === p.type)!;
export const pct = (p: PageData) => Math.min(100, Math.round((p.raised / Math.max(1, p.goal)) * 100));
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
export const daysLeft = (p: PageData) => (p.endDate ? Math.max(0, Math.ceil((new Date(p.endDate).getTime() - Date.now()) / 86400000)) : null);

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
export const TwoCol = ({ main, side, className }: { main: ReactNode; side: ReactNode; className?: string }) => (
    <div className={cx("grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10", className)}>
        <div className="flex min-w-0 flex-col gap-7">{main}</div>
        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:self-start">{side}</div>
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

/* ------------------------------------------------------------------ organiser console primitives (Admin, PageManage) */

type Icon = FC<{ className?: string }>;
/** A card with a heading row. `action` sits top-right. */
export const Panel = ({ title, sub, action, children, className }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) => (
    <section className={cx("flex min-w-0 flex-col gap-5 rounded-3xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset md:p-6", className)}>
        {(title || action) && <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0">{title && <h2 className="text-lg font-semibold tracking-tight text-primary">{title}</h2>}{sub && <p className="mt-0.5 max-w-2xl text-sm text-tertiary">{sub}</p>}</div>{action}</div>}
        {children}
    </section>
);
/** A labelled group of fields inside a Panel: heading + one line on the left, the fields on the right. */
export const Fieldset = ({ title, sub, children, cols = 2 }: { title: string; sub?: string; children: ReactNode; cols?: 1 | 2 }) => (
    <div className="grid gap-4 border-t border-secondary pt-5 first:border-0 first:pt-0 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <div><h3 className="text-sm font-semibold text-primary">{title}</h3>{sub && <p className="mt-0.5 text-[13px] text-tertiary">{sub}</p>}</div>
        <div className={cx("grid gap-4", cols === 2 && "sm:grid-cols-2")}>{children}</div>
    </div>
);
/** KPI tile. */
export const Stat = ({ icon: I, label, value, trend, tone = "default" }: { icon: Icon; label: string; value: string; trend?: ReactNode; tone?: "default" | "brand" }) => (
    <div className={cx("flex min-w-0 flex-col gap-3 rounded-3xl p-5 shadow-xs ring-1 ring-inset", tone === "brand" ? "bg-brand-solid text-white ring-transparent" : "bg-primary ring-secondary")}>
        <div className="flex items-center justify-between gap-2"><span className={cx("text-[13px] font-semibold", tone === "brand" ? "text-white/80" : "text-tertiary")}>{label}</span><span className={cx("flex size-8 items-center justify-center rounded-xl", tone === "brand" ? "bg-white/20" : "bg-brand-secondary text-brand-secondary")}><I className="size-4" /></span></div>
        <span className="truncate text-[28px] leading-none font-semibold tracking-tight tabular-nums">{value}</span>
        {trend && <span className={cx("text-xs font-medium", tone === "brand" ? "text-white/80" : "text-tertiary")}>{trend}</span>}
    </div>
);
export const Empty = ({ icon: I, title, sub, action }: { icon: Icon; title: string; sub?: string; action?: ReactNode }) => (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-secondary px-6 py-10 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-brand-secondary text-brand-secondary"><I className="size-5" /></span><div><div className="font-semibold text-primary">{title}</div>{sub && <p className="mt-1 max-w-sm text-sm text-tertiary">{sub}</p>}</div>{action}</div>
);
/** Initials in a tinted circle. */
export const Who = ({ name, className }: { name: string; className?: string }) => <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-brand-secondary", className)}>{initials(name) || "?"}</span>;
/** A URL with copy and open buttons. */
export const CopyRow = ({ label, url, hint }: { label: string; url: string; hint?: string }) => {
    const { toast } = useApp();
    return (
        <div className="flex items-center gap-2 rounded-2xl bg-secondary p-2 pl-4 ring-1 ring-secondary ring-inset">
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-primary">{label}</span><span className="block truncate text-xs text-tertiary">{hint ?? url.replace(/^https?:\/\//, "")}</span></span>
            <Button size="sm" color="secondary" className="rounded-xl" aria-label={`Copy ${label} link`} iconLeading={Copy01} onPress={() => { navigator.clipboard?.writeText(url); toast("Link copied"); }} />
            <Button size="sm" color="secondary" className="rounded-xl" aria-label={`Open ${label}`} iconLeading={LinkExternal01} onPress={() => window.open(url, "_blank")} />
        </div>
    );
};
/** Sticky header + icon sidebar + main column for the organiser screens. */
export const ConsoleShell = ({ crumb, badges, actions, nav, current, onNav, children }: { crumb?: ReactNode; badges?: ReactNode; actions?: ReactNode; nav: [string, string, Icon][]; current: string; onNav: (k: string) => void; children: ReactNode }) => {
    const { go } = useApp();
    return (
        <div className="min-h-dvh overflow-x-clip bg-secondary">
            <header className="sticky top-0 z-30 border-b border-secondary bg-primary/85 backdrop-blur"><Container className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3"><BrandLogo onClick={() => go({ name: "home" })} />{crumb}{badges}</div>
                <div className="flex items-center gap-2"><ThemeToggle />{actions}</div>
            </Container></header>
            <Container className="grid gap-6 py-6 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 lg:py-8">
                <nav aria-label="Sections" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:self-start lg:px-0">
                    {nav.map(([k, l, I]) => <button key={k} type="button" aria-current={current === k ? "page" : undefined} onClick={() => onNav(k)} className={cx("flex shrink-0 cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold outline-focus-ring transition focus-visible:outline-2", current === k ? "bg-brand-secondary text-brand-secondary shadow-xs" : "text-tertiary hover:bg-primary hover:text-primary")}><I className="size-[18px] shrink-0" />{l}</button>)}
                </nav>
                <main className="flex min-w-0 flex-col gap-5">{children}</main>
            </Container>
        </div>
    );
};

/** Little illustration of each live layout. */
const LayoutThumbLive = ({ k }: { k: LiveLayout }) => (
    <span aria-hidden="true" className="relative block h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
        {k === "classic" && <><span className="absolute top-2 left-2 h-3 w-8 rounded-sm bg-white/90" /><span className="absolute top-6 left-2 h-1.5 w-9 rounded-full bg-brand-500" /><span className="absolute top-9 left-2 h-1.5 w-6 rounded-full bg-white/30" />{[0, 1, 2, 3].map((i) => <span key={i} className={cx("absolute right-2 h-2 w-9 rounded-sm", i === 0 ? "bg-brand-500" : "bg-white/25")} style={{ top: 8 + i * 11 }} />)}</>}
        {k === "thermo" && <><span className="absolute top-3 left-1/2 h-4 w-14 -translate-x-1/2 rounded-sm bg-white/90" /><span className="absolute top-9 right-3 left-3 h-2 rounded-full bg-white/20"><span className="block h-full w-2/3 rounded-full bg-brand-500" /></span><span className="absolute bottom-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/30" /></>}
        {k === "impact" && <><span className="absolute top-1.5 left-2 h-1.5 w-8 rounded-full bg-white/60" />{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={cx("absolute h-4 w-6 rounded-sm", i % 3 === 0 ? "bg-brand-500" : "bg-white/25")} style={{ left: 8 + (i % 3) * 28, top: 18 + Math.floor(i / 3) * 18 }} />)}</>}
        {k === "podium" && <>{([[34, 20, "bg-brand-500"], [8, 12, "bg-white/40"], [60, 8, "bg-white/25"]] as const).map(([x, h, c], i) => <span key={i} className={cx("absolute bottom-1.5 w-6 rounded-t-sm", c)} style={{ left: x, height: h }} />)}<span className="absolute top-2 right-2 h-2 w-8 rounded-sm bg-white/80" /></>}
        {k === "wall" && <>{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={cx("absolute h-3.5 w-9 rounded-sm", i === 0 ? "bg-brand-500" : "bg-white/25")} style={{ left: 6 + (i % 2) * 44, top: 6 + Math.floor(i / 2) * 16 }} />)}<span className="absolute top-1 right-2 h-2 w-5 rounded-sm bg-white/80" /></>}
    </span>
);

/**
 * The presenter console. Used for the organisation (Admin) and for one page (PageManage); the caller saves `live` through `push`.
 * Control labels: "Layout" group, "Theme" group, "Goal (USD)" + "Save goal", "Message" + "Amount (USD)" + "Show on screen" + "Clear",
 * "Item n" / "Amount n" + "Add item" + "Save items", "Fire confetti", "QR code" toggle, "Pause" toggle, "Open live screen", "Copy give link".
 */
export const LiveConsole = ({ live, push, liveUrl, overlayUrl, giveUrl, scope }: { live: LiveState; push: (patch: LiveState) => Promise<void> | void; liveUrl: string; overlayUrl: string; giveUrl: string; scope: string }) => {
    const { toast } = useApp();
    const [ask, setAsk] = useState(live.ask ?? "");
    const [askUsd, setAskUsd] = useState(live.ask_usd ? String(live.ask_usd) : "");
    const [goal, setGoal] = useState(live.goal_usd ? String(live.goal_usd) : "");
    const [items, setItems] = useState<LiveItem[]>(live.items?.length ? live.items : [{ label: "", usd: 0 }]);
    const [qr, setQr] = useState("");
    useEffect(() => { QRCode.toDataURL(giveUrl, { width: 480, margin: 2 }).then(setQr).catch(() => setQr("")); }, [giveUrl]);
    const layout = live.layout ?? "classic"; const theme = live.theme ?? "dark";
    const seg = (on: boolean) => cx("h-9 cursor-pointer rounded-full px-4 text-sm font-semibold transition", on ? "bg-brand-solid text-white shadow-xs" : "text-tertiary hover:text-primary");
    const saveItems = () => { const clean = items.map((i) => ({ label: i.label.trim(), usd: Math.round(Number(i.usd)) })).filter((i) => i.label && i.usd > 0); push({ items: clean }); toast(`${clean.length} ${clean.length === 1 ? "item" : "items"} saved`); };
    return (
        <>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
                <Panel title="Live screen" sub={`What ${scope} shows on a projector, TV or stream. Changes land on every open screen within a second.`} action={<Button size="sm" color="primary" className="rounded-full" iconLeading={LinkExternal01} onPress={() => window.open(liveUrl, "_blank")}>Open live screen</Button>}>
                    <div role="group" aria-label="Layout" className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                        {LIVE_LAYOUTS.map(([k, l, d]) => <button key={k} type="button" aria-pressed={layout === k} onClick={() => push({ layout: k })} className={cx("flex cursor-pointer items-center gap-3 rounded-2xl p-2.5 text-left ring-1 ring-inset transition outline-focus-ring focus-visible:outline-2", layout === k ? "bg-brand-secondary ring-brand" : "bg-secondary ring-secondary hover:ring-primary")}><LayoutThumbLive k={k} /><span className="min-w-0"><span className="block text-sm font-semibold text-primary">{l}</span><span className="block text-xs leading-snug text-tertiary">{d}</span></span></button>)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        <div className="flex items-center gap-3"><span className="text-sm font-semibold text-primary">Theme</span><div role="group" aria-label="Theme" className="flex gap-1 rounded-full bg-secondary p-1 ring-1 ring-secondary ring-inset">{(["dark", "light"] as const).map((t) => <button key={t} type="button" aria-pressed={theme === t} onClick={() => push({ theme: t })} className={seg(theme === t)}>{t === "dark" ? "Dark" : "Light"}</button>)}</div></div>
                        <label className="flex items-center gap-2 text-sm font-medium text-secondary"><Toggle aria-label="QR code" isSelected={live.show_qr !== false} onChange={(v) => push({ show_qr: v })} />QR code</label>
                        <label className="flex items-center gap-2 text-sm font-medium text-secondary"><Toggle aria-label="Pause" isSelected={!!live.paused} onChange={(v) => push({ paused: v })} />Pause</label>
                        <Button size="sm" color="secondary" className="rounded-full" iconLeading={Zap} onPress={() => push({ confetti_at: Date.now() })}>Fire confetti</Button>
                    </div>
                </Panel>
                <Panel title="Give from a phone" sub="The QR code on the live screen opens this page. Donors pick an impact item and give in a few taps.">
                    <div className="flex items-center gap-4">{qr ? <img src={qr} alt="QR code to the give screen" className="size-28 shrink-0 rounded-2xl bg-white p-1.5 ring-1 ring-secondary" /> : <span className="flex size-28 shrink-0 items-center justify-center rounded-2xl bg-secondary"><QrCode01 className="size-8 text-quaternary" /></span>}<div className="flex min-w-0 flex-col gap-2"><span className="truncate text-xs text-tertiary">{giveUrl.replace(/^https?:\/\//, "")}</span><Button size="sm" color="secondary" className="w-fit rounded-full" iconLeading={Copy01} onPress={() => { navigator.clipboard?.writeText(giveUrl); toast("Link copied"); }}>Copy give link</Button>{qr && <a href={qr} download="give-qr.png" className="text-xs font-semibold text-brand-secondary hover:underline">Download QR</a>}</div></div>
                </Panel>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Goal for tonight" sub="The thermometer on the live screen fills toward this. Leave it empty to hide the bar.">
                    <div className="flex items-end gap-3"><Input label="Goal (USD)" type="number" value={goal} onChange={setGoal} placeholder="25000" /><Button size="md" color="primary" className="rounded-full" onPress={() => push({ goal_usd: Number(goal) || undefined })}>Save goal</Button></div>
                </Panel>
                <Panel title="The ask" sub="A banner across every live screen: a matching challenge, a target for the next ten minutes, a thank-you.">
                    <div className="grid gap-3 sm:grid-cols-[1fr_9rem]"><Input label="Message" value={ask} onChange={setAsk} placeholder="Who gives $500 for a borehole?" /><Input label="Amount (USD)" type="number" value={askUsd} onChange={setAskUsd} /></div>
                    <div className="flex flex-wrap gap-2"><Button size="md" color="primary" className="rounded-full" onPress={() => push({ ask: ask.trim(), ask_usd: Number(askUsd) || undefined })}>Show on screen</Button><Button size="md" color="secondary" className="rounded-full" onPress={() => { setAsk(""); setAskUsd(""); push({ ask: "", ask_usd: undefined }); }}>Clear</Button></div>
                </Panel>
            </div>
            <Panel title="Impact items" sub="What a gift buys. These are the tappable choices on the phone give screen and the tiles of the Impact layout." action={<Button size="sm" color="primary" className="rounded-full" onPress={saveItems}>Save items</Button>}>
                <div className="flex flex-col gap-2">
                    {items.map((it, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]"><Input aria-label={`Item ${i + 1}`} label={i === 0 ? "Item" : undefined} placeholder="A borehole for a village" value={it.label} onChange={(v) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, label: v } : x)))} /><Input aria-label={`Amount ${i + 1}`} label={i === 0 ? "USD" : undefined} type="number" placeholder="6000" value={it.usd ? String(it.usd) : ""} onChange={(v) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, usd: Number(v) || 0 } : x)))} /><Button size="md" color="tertiary" aria-label="Remove item" iconLeading={Trash01} onPress={() => setItems((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : [{ label: "", usd: 0 }]))} /></div>)}
                    <Button size="sm" color="secondary" className="w-fit rounded-full" iconLeading={Plus} onPress={() => setItems((xs) => [...xs, { label: "", usd: 0 }])}>Add item</Button>
                </div>
            </Panel>
            <Panel title="Stream overlay" sub="Transparent browser source for OBS, Streamlabs or any streaming tool. 1280×200 works well.">
                <div className="grid gap-2 md:grid-cols-3"><CopyRow label="Goal bar" url={overlayUrl} /><CopyRow label="Alerts only" url={`${overlayUrl}?theme=alert`} /><CopyRow label="Bar + recent gifts" url={`${overlayUrl}?theme=ticker`} /></div>
            </Panel>
        </>
    );
};
