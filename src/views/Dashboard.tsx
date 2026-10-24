import { type FC, type ReactNode, useEffect, useState } from "react";
import { AlertCircle, Announcement01, ArrowRight, ArrowUp, Building07, Check, Heart, HelpCircle, HomeLine, Lock01, Trophy01, User01, Zap } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { BrandLogo, Logo, ThemeToggle, ago, useApp } from "@/components/outgive/shared";
import { CURRENCIES, PREFIX, type PageType, initials } from "@/data";
import { fmt } from "@/lib/money";
import type { Org, PageRow } from "@/lib/types";
import { SignIn } from "@/views/Login";
import { cx } from "@/utils/cx";

type Tab = "home" | "giving" | "pages" | "orgs" | "account";
const NAV: [Tab, string, FC<{ className?: string }>][] = [["home", "Home", HomeLine], ["giving", "Giving", Heart], ["pages", "Pages", Announcement01], ["orgs", "Organisations", Building07], ["account", "Account", User01]];
/** Badges earned by months given in a row. */
const BADGES: [string, number][] = [["Spark", 1], ["Giver", 3], ["Champion", 6], ["Hero", 9], ["Legend", 12], ["Evergreen", 24]];
interface Gift { id: string; org_id: string; org_name: string; org_slug: string; page_id: string | null; page_title: string | null; page_type: PageType | null; page_slug: string | null; amount_cents: number; currency: string; usd_cents: number; tip_cents: number; recurring: boolean; status: string; source: string; message: string; created_at: string; receipt_sent_at: string | null }
interface Profile { id: string; email: string; name: string; country: string }

const Tile = ({ className, children }: { className?: string; children: ReactNode }) => <div className={cx("flex min-w-0 flex-col gap-1.5 rounded-3xl bg-primary p-[18px] shadow-xs ring-1 ring-secondary ring-inset", className)}>{children}</div>;
const Eyebrow = ({ children }: { children: ReactNode }) => <span className="text-[11px] font-bold tracking-wider text-tertiary uppercase">{children}</span>;
const More = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => <button type="button" onClick={onClick} className="mt-auto flex w-fit cursor-pointer items-center gap-1 pt-2.5 text-sm font-bold text-brand-secondary underline underline-offset-4 outline-focus-ring focus-visible:outline-2">{children}<ArrowRight className="size-3.5" /></button>;

/** Cumulative giving as a filled line. Needs at least two points. */
const AreaChart = ({ values }: { values: number[] }) => {
    const w = 600; const h = 110; const max = Math.max(...values) * 1.1 || 1;
    const pts = values.map((v, i) => [Math.round(20 + (i * (w - 40)) / (values.length - 1)), Math.round(h - 8 - (v / max) * (h - 26))] as const);
    const line = pts.map(([x, y]) => `${x},${y}`).join(" "); const [lx, ly] = pts[pts.length - 1];
    return <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Giving over time" className="block h-auto w-full"><defs><linearGradient id="dash-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--color-brand-500)" stopOpacity="0.3" /><stop offset="1" stopColor="var(--color-brand-500)" stopOpacity="0" /></linearGradient></defs><polygon points={`${line} ${lx},${h} ${pts[0][0]},${h}`} fill="url(#dash-area)" /><polyline points={line} fill="none" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx={lx} cy={ly} r="5" fill="var(--color-bg-primary)" stroke="var(--color-brand-600)" strokeWidth="2.5" /></svg>;
};

/** Months in a row with a gift, counting back from this month or last. */
const streakOf = (gifts: Gift[]) => { const months = new Set(gifts.filter((g) => g.status === "succeeded").map((g) => g.created_at.slice(0, 7))); let n = 0; const d = new Date(); d.setDate(1); if (!months.has(d.toISOString().slice(0, 7))) d.setMonth(d.getMonth() - 1); while (months.has(d.toISOString().slice(0, 7))) { n++; d.setMonth(d.getMonth() - 1); } return n; };

/** The supporter's own space: gifts and receipts, pages, organisations they run, and where they stand on the board on screen. */
export const Dashboard = () => {
    const { db, user, org, go, money, board, brand, me, isDemo, toast } = useApp();
    const [tab, setTab] = useState<Tab>("home");
    const [gifts, setGifts] = useState<Gift[]>([]);
    const [pages, setPages] = useState<PageRow[]>([]);
    const [orgs, setOrgs] = useState<Org[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [name, setName] = useState("");
    useEffect(() => {
        if (!user) return;
        Promise.all([db.rpc<Gift[]>("my_giving"), db.rpc<PageRow[]>("my_pages"), db.rpc<Org[]>("my_orgs"), db.rpc<Profile[]>("my_profile")]).then(([g, p, o, pr]) => { setGifts(g); setPages(p); setOrgs(o); setProfile(pr[0] ?? null); setName(pr[0]?.name ?? user.name); }).catch((e) => toast((e as Error).message));
    }, [db, user]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!user) return <div className="min-h-dvh bg-primary"><div className="mx-auto flex max-w-md flex-col gap-8 px-4 py-6"><div className="flex items-center justify-between"><Logo onClick={() => go({ name: "landing" })} /><ThemeToggle /></div><div className="rounded-3xl p-6 ring-1 ring-secondary ring-inset"><SignIn next="/dashboard" title="Your dashboard" sub="Sign in to see your gifts, receipts and pages." /></div></div></div>;

    const ok = gifts.filter((g) => g.status === "succeeded");
    const totalUsd = ok.reduce((n, g) => n + g.usd_cents, 0) / 100;
    const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weekUsd = ok.filter((g) => new Date(g.created_at) >= monday).reduce((n, g) => n + g.usd_cents, 0) / 100;
    const streak = streakOf(gifts);
    const byTotal = [...board].sort((a, b) => b.total - a.total);
    const rank = me ? byTotal.findIndex((o) => o.id === me) + 1 : 0;
    const mine = rank ? byTotal[rank - 1] : null;
    const above = rank > 1 ? byTotal[rank - 2] : null;
    const gap = above && mine ? above.total + 1 - mine.total : 0;
    const series = ok.length >= 2 ? [...ok].reverse().reduce<number[]>((acc, g) => [...acc, (acc[acc.length - 1] ?? 0) + g.usd_cents / 100], []) : [];
    const unit = brand.impact && brand.impact.usd > 0 && mine ? Math.floor(mine.total / brand.impact.usd) : 0;
    const first = (profile?.name || user.name).split(" ")[0];

    const needs: [string, FC<{ className?: string }>, string, string, string, () => void][] = [
        ...(org && above && mine ? [["bg-error-primary text-error-primary", Trophy01, `${above.name} is ${money(gap)} ahead of you on the ${org.name} board`, `Give ${money(gap)} to take #${rank - 1}`, `Take #${rank - 1}`, () => go({ name: "home" })] as (typeof needs)[number]] : []),
        ["bg-warning-primary text-warning-primary", Zap, streak > 0 ? `Keep your ${streak}-month streak` : "Start a giving streak", "Give any amount before the month ends", "Give", () => go({ name: "home" })],
        pages.length === 0 ? ["bg-tertiary text-primary", Announcement01, "Start a fundraising page", "Friends give in your name; every gift counts toward your rank", "Start a page", () => go({ name: "create" })] : ["bg-success-primary text-success-primary", Check, `${pages.length} ${pages.length === 1 ? "page is" : "pages are"} live`, "Share them to climb without paying the gap yourself", "View", () => setTab("pages")],
        ...(orgs.length === 0 ? [["bg-tertiary text-primary", Building07, "Run a board for your organisation", "Your name, colours, Stripe payouts and a live screen", "Start", () => go({ name: "start" })] as (typeof needs)[number]] : []),
    ];
    const kpis: [string, string, string, boolean][] = [
        ["Given all-time", money(totalUsd), rank ? `#${rank} of ${byTotal.length} on the ${org?.name} board` : `${ok.length} gifts`, false],
        ["This week", money(weekUsd), weekUsd > 0 ? "since Monday" : "Resets Monday", weekUsd > 0],
        ["Monthly gifts", String(ok.filter((g) => g.recurring).length), "running", false],
        [unit > 0 && brand.impact ? "Impact" : "Streak", unit > 0 && brand.impact ? unit.toLocaleString("en") : `${streak} mo`, unit > 0 && brand.impact ? `${brand.impact.unit} funded` : "months given in a row", false],
    ];
    const giftRow = (g: Gift) => <li key={g.id} className="flex items-center gap-3 border-t border-secondary py-3 first:border-0"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tertiary text-secondary"><Heart className="size-4" /></span><span className="min-w-0 flex-1"><button type="button" onClick={() => (g.page_type && g.page_slug ? go({ name: "page", org: g.org_slug, page: { type: g.page_type, slug: g.page_slug } }) : go({ name: "board", org: g.org_slug }))} className="block cursor-pointer truncate text-left text-sm font-bold text-primary hover:underline">{g.page_title ?? g.org_name}</button><span className="block text-xs text-tertiary">{g.org_name} · {ago(new Date(g.created_at).getTime())}{ago(new Date(g.created_at).getTime()) !== "just now" && " ago"}{g.recurring && " · monthly"}{g.status !== "succeeded" && ` · ${g.status}`}</span></span><span className="text-sm font-bold text-primary tabular-nums">{fmt(g.amount_cents, g.currency)}</span></li>;
    const pageList = pages.length === 0
        ? <p className="rounded-2xl bg-secondary px-4 py-5 text-sm text-tertiary">No pages yet.</p>
        : <div className="flex flex-col gap-4">{pages.slice(0, 50).map((p) => { const pct = p.goal_cents ? Math.min(100, Math.round((p.raised_cents / p.goal_cents) * 100)) : 0; return <div key={p.id} className="flex flex-col gap-1.5"><div className="flex items-center justify-between gap-3 text-sm"><button type="button" onClick={() => go({ name: "page", page: { type: p.type, slug: p.slug }, org: orgs.find((o) => o.id === p.org_id)?.slug ?? org?.slug ?? "" })} className="min-w-0 cursor-pointer truncate text-left font-bold text-primary hover:underline">{p.title}</button><span className="flex shrink-0 items-center gap-2"><Badge type="pill-color" color={p.status === "live" ? "success" : "gray"} size="sm">{p.status}</Badge><span className="text-tertiary tabular-nums">{pct}%</span></span></div><div className="h-1.5 overflow-hidden rounded-full bg-tertiary"><div className="h-full rounded-full bg-brand-solid" style={{ width: `${pct}%` }} /></div><p className="text-xs text-tertiary tabular-nums">{fmt(p.raised_cents, p.currency)} of {fmt(p.goal_cents, p.currency)} · {p.donor_count} gifts</p></div>; })}</div>;

    const home = (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile className="col-span-full gap-0 p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-3.5"><span className="flex items-center gap-2 text-sm font-extrabold text-primary"><AlertCircle className="size-4" />Needs you · {needs.length}</span></div>
                {needs.map(([tone, Icon, t, d, cta, run], i) => <div key={t} className="flex items-center gap-3.5 border-t border-secondary px-[18px] py-3.5"><span className={cx("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}><Icon className="size-[18px]" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-primary">{t}</span><span className="block text-[13px] text-tertiary">{d}</span></span><Button size="sm" color={i === 0 ? "primary" : "secondary"} className="shrink-0 rounded-full" onPress={run}>{cta}</Button></div>)}
            </Tile>
            {kpis.map(([k, v, ctx, up], i) => <Tile key={k} className={cx(i === 0 && "bg-brand-secondary ring-transparent")}><span className="text-xs font-bold text-tertiary">{k}</span><span className="text-[26px] leading-tight font-bold tracking-tight text-primary tabular-nums">{v}</span><span className={cx("flex items-start gap-1 text-xs font-semibold", up ? "text-success-primary" : "text-tertiary")}>{up && <ArrowUp className="mt-0.5 size-3" />}{ctx}</span></Tile>)}
            <Tile className="col-span-2"><Eyebrow>Given over time</Eyebrow><span className="text-[30px] leading-tight font-bold tracking-tight text-primary tabular-nums">{money(totalUsd)}</span>{series.length >= 2 ? <div className="mt-2 rounded-xl bg-secondary py-1"><AreaChart values={series} /></div> : <p className="mt-2 rounded-xl bg-secondary px-4 py-6 text-sm text-tertiary">Your chart appears after your second gift.</p>}<More onClick={() => setTab("giving")}>See all giving</More></Tile>
            <Tile className="col-span-2"><div className="flex items-center justify-between gap-2"><Eyebrow>Your pages</Eyebrow>{pages.length > 0 && <Badge type="pill-color" color="brand" size="sm">{pages.length}</Badge>}</div>{pageList}<More onClick={() => (pages.length ? setTab("pages") : go({ name: "create" }))}>{pages.length ? "All pages" : "Start a page"}</More></Tile>
            <Tile className="col-span-2 bg-brand-secondary ring-transparent">
                <div className="flex items-center justify-between gap-2"><Eyebrow>Giving streak</Eyebrow><Badge type="pill-color" color="brand" size="sm">{BADGES.filter(([, m]) => streak >= m).length} of {BADGES.length} badges</Badge></div>
                <span className="text-[26px] leading-tight font-bold tracking-tight text-primary"><span className="tabular-nums">{streak}</span> {streak === 1 ? "month" : "months"}</span>
                <ol aria-label="Badges" className="mt-3.5 grid grid-cols-6 gap-2">{BADGES.map(([n, m]) => { const on = streak >= m; return <li key={n} title={`${n}: ${m} ${m === 1 ? "month" : "months"} in a row`} className="flex flex-col items-center gap-1 text-center"><span className={cx("relative flex size-11 items-center justify-center rounded-full", on ? "bg-primary text-brand-secondary ring-[1.5px] ring-brand ring-inset" : "border-[1.5px] border-dashed border-primary text-quaternary")}><Trophy01 className="size-5" />{!on && <Lock01 className="absolute -right-1 -bottom-1 size-4 rounded-full bg-tertiary p-0.5 text-tertiary" />}</span><span className="text-[10px] leading-tight font-semibold text-tertiary">{n}</span></li>; })}</ol>
            </Tile>
            <Tile className="col-span-2"><div className="flex items-center justify-between gap-2"><Eyebrow>Recent gifts</Eyebrow><span className="text-xs font-bold text-tertiary">{ok.length} gifts</span></div>{ok.length === 0 ? <p className="rounded-2xl bg-secondary px-4 py-5 text-sm text-tertiary">{isDemo ? "Gifts you make in the demo as the organiser appear here." : "No gifts yet. Gifts made with this email address appear here."}</p> : <ul className="flex flex-col">{ok.slice(0, 3).map(giftRow)}</ul>}<More onClick={() => setTab("giving")}>All activity</More></Tile>
        </div>
    );
    const giving = <Tile><Eyebrow>Every gift</Eyebrow><p className="text-sm text-tertiary">{isDemo ? "No emails are sent in the demo." : "Receipts were emailed when each gift cleared."}</p>{gifts.length === 0 ? <p className="py-4 text-sm text-tertiary">Nothing yet.</p> : <ul className="flex flex-col">{gifts.map(giftRow)}</ul>}</Tile>;
    const pagesTab = <div className="flex flex-col gap-3"><Tile>{pageList}</Tile><button type="button" onClick={() => go({ name: "create" })} className="flex min-h-15 cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-primary bg-primary p-3.5 text-sm font-bold text-secondary outline-focus-ring hover:border-brand hover:text-brand-secondary focus-visible:outline-2">Start another page</button></div>;
    const orgsTab = <div className="flex flex-col gap-3">{orgs.map((o) => <Tile key={o.id} className="flex-row items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: o.color }}>{initials(o.name)}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold text-primary">{o.name}</span><span className="block text-xs text-tertiary">{o.stripe_charges_enabled ? "Taking gifts" : "Stripe not connected yet"}{o.verified && " · Verified"}</span></span><Button size="sm" color="secondary" className="rounded-full" onPress={() => go({ name: "board", org: o.slug })}>Board</Button><Button size="sm" color="primary" className="rounded-full" onPress={() => go({ name: "admin", org: o.slug })}>Dashboard</Button></Tile>)}<button type="button" onClick={() => go({ name: "start" })} className="flex min-h-15 cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-primary bg-primary p-3.5 text-sm font-bold text-secondary hover:border-brand hover:text-brand-secondary">{orgs.length ? "Add another organisation" : "Run a board for your organisation"}</button></div>;
    const account = <Tile className="gap-4 p-5"><Eyebrow>Profile</Eyebrow><div className="grid gap-3.5 sm:grid-cols-2"><Input label="Name" value={name} onChange={setName} /><Input label="Email" value={profile?.email ?? user.email} isDisabled /></div><Button color="primary" className="w-fit rounded-full" isDisabled={!name.trim() || name === profile?.name} onPress={async () => { await db.rpc("profile_update", { p: { name: name.trim() } }); setProfile((p) => (p ? { ...p, name: name.trim() } : p)); toast("Saved"); }}>Save</Button><p className="text-xs text-tertiary">Gifts made with your email address are linked to this account, including ones made before you signed up.</p>{!isDemo && <Button color="secondary" className="w-fit rounded-full" onPress={() => db.signOut().then(() => go({ name: "landing" }))}>Sign out</Button>}</Tile>;
    const titles: Record<Tab, [string, string]> = { home: [`Hello, ${first}`, org && rank ? `You hold #${rank} on the ${org.name} board.` : "Your giving, pages and organisations."], giving: ["Giving", "What you have given, and the receipts."], pages: ["Pages", "Pages you have set up."], orgs: ["Organisations", "Boards you run."], account: ["Account", "Your name and sign-in."] };
    return (
        <div className="flex min-h-dvh flex-col bg-secondary">
            <header className="sticky top-0 z-30 flex h-16 items-center gap-2.5 bg-secondary px-4 md:h-[76px] md:px-7">
                <div className="mr-auto min-w-0">{org ? <BrandLogo onClick={() => go({ name: "home" })} /> : <Logo onClick={() => go({ name: "landing" })} />}</div>
                <ThemeToggle />
                {org && <Button size="sm" color="secondary" className="rounded-full max-sm:hidden" onPress={() => go({ name: "home" })}>Leaderboard</Button>}
                <Button size="sm" color="primary" className="rounded-full" onPress={() => go({ name: "create" })}><span className="max-sm:hidden">Start fundraising</span><span className="sm:hidden">Fundraise</span></Button>
            </header>
            <div className="mx-auto grid w-full max-w-[1100px] flex-1 items-start gap-6 px-4 pt-2 pb-16 md:px-6 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-7">
                <aside className="flex flex-col gap-3.5 lg:sticky lg:top-[92px]">
                    <div className="flex flex-col items-center gap-0.5 rounded-[20px] bg-brand-secondary px-4 pt-5 pb-4 text-center">
                        <span className="mb-3 rounded-full ring-8 ring-white/50"><Avatar size="2xl" initials={initials(profile?.name || user.name || "?")} /></span>
                        <span className="text-[17px] font-bold text-primary">{profile?.name || user.name}</span><span className="text-[12.5px] font-semibold text-tertiary">{user.email}</span>
                        <dl className="my-3.5 grid w-full grid-cols-3 rounded-xl bg-primary px-1.5 py-3">{([[rank ? `#${rank}` : "–", "Rank"], [money(totalUsd), "Given"], [String(streak), "Streak"]] as [string, string][]).map(([v, l], i) => <div key={l} className={cx("flex min-w-0 flex-col items-center", i > 0 && "border-l border-secondary")}><dd className="max-w-full truncate text-md font-bold text-primary tabular-nums">{v}</dd><dt className="text-[10.5px] font-semibold text-tertiary">{l}</dt></div>)}</dl>
                        {org && <button type="button" onClick={() => go({ name: "home" })} className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-primary-solid text-[13.5px] font-bold text-white hover:opacity-90">{rank ? "See my place on the board" : "Claim a rank"}</button>}
                    </div>
                    <nav aria-label="Dashboard" className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">{NAV.map(([id, label, Icon]) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)} className={cx("flex min-h-12 shrink-0 cursor-pointer items-center gap-3 rounded-full py-1 pr-4 pl-1 text-[15px] outline-focus-ring transition focus-visible:outline-2", tab === id ? "font-bold text-primary" : "font-semibold text-secondary hover:bg-primary/60")}><span className={cx("flex size-10 shrink-0 items-center justify-center rounded-full shadow-xs", tab === id ? "bg-brand-solid text-white ring-4 ring-brand-200" : "bg-primary text-primary")}><Icon className="size-[18px]" /></span>{label}</button>)}</nav>
                    <button type="button" onClick={() => go({ name: "faq" })} className="flex min-h-15 cursor-pointer items-center gap-3 rounded-2xl bg-primary/60 py-2.5 pr-4 pl-2.5 text-left text-sm font-bold text-primary hover:bg-primary max-lg:hidden"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary"><HelpCircle className="size-[18px]" /></span><span>Need a hand?<span className="block text-[11.5px] font-semibold text-tertiary">Rules and common questions</span></span></button>
                </aside>
                <main className="flex min-w-0 flex-col gap-4">
                    <div><h1 className="text-display-xs font-bold tracking-tight text-primary md:text-display-sm">{titles[tab][0]}</h1><p className="mt-1 text-sm text-tertiary">{titles[tab][1]}</p></div>
                    {{ home, giving, pages: pagesTab, orgs: orgsTab, account }[tab]}
                </main>
            </div>
        </div>
    );
};
export const pagePathOf = (p: PageRow) => `/${PREFIX[p.type]}/${p.slug}`;
export { CURRENCIES };
