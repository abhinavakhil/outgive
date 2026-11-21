import type { ReactNode } from "react";
import { ArrowUp, Lock01, Trophy01 } from "@untitledui/icons";
import { Badge } from "@/shared/ui";
import { useApp } from "@/shared/lib/app-context";
import { fmt } from "@/shared/lib/money";
import type { Org, PageRow } from "@/shared/domain/types";
import { cx } from "@/shared/utils/cx";
import { type Gift, Giving, type Regular } from "./Giving";

/** Badges earned by months given in a row. */
const BADGES: [string, number][] = [["Spark", 1], ["Giver", 3], ["Champion", 6], ["Hero", 9], ["Legend", 12], ["Evergreen", 24]];
const Tile = ({ className, children }: { className?: string; children: ReactNode }) => <div className={cx("flex min-w-0 flex-col gap-1.5 rounded-3xl bg-tint-1 p-[18px]", className)}>{children}</div>;
const Eyebrow = ({ children }: { children: ReactNode }) => <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{children}</span>;

/** Months in a row with a gift, counting back from this month or last. */
const streakOf = (gifts: Gift[]) => { const months = new Set(gifts.filter((g) => g.status === "succeeded").map((g) => g.created_at.slice(0, 7))); let n = 0; const d = new Date(); d.setDate(1); if (!months.has(d.toISOString().slice(0, 7))) d.setMonth(d.getMonth() - 1); while (months.has(d.toISOString().slice(0, 7))) { n++; d.setMonth(d.getMonth() - 1); } return n; };

/** The signed-in person's own giving: totals and streak, regular gifts and every payment with its receipt, and the pages they set up. */
export const MyGiving = ({ gifts, regular, pages, orgs, reload }: { gifts: Gift[]; regular: Regular[]; pages: PageRow[]; orgs: Org[]; reload: () => void }) => {
    const { go, money } = useApp();
    const ok = gifts.filter((g) => g.status === "succeeded");
    const totalUsd = ok.reduce((n, g) => n + g.usd_cents, 0) / 100;
    const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weekUsd = ok.filter((g) => new Date(g.created_at) >= monday).reduce((n, g) => n + g.usd_cents, 0) / 100;
    const streak = streakOf(gifts);
    const kpis: [string, string, string, boolean][] = [
        ["Given all-time", money(totalUsd), `${ok.length} ${ok.length === 1 ? "gift" : "gifts"}`, false],
        ["This week", money(weekUsd), weekUsd > 0 ? "since Monday" : "Resets Monday", weekUsd > 0],
        ["Regular gifts", String(regular.filter((r) => r.status === "active").length), "running", false],
        ["Streak", `${streak} mo`, "months given in a row", false],
    ];
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{kpis.map(([k, v, ctx, up]) => <Tile key={k}><span className="text-xs font-medium text-ink-3">{k}</span><span className="text-[28px] leading-tight font-semibold text-ink tabular-nums">{v}</span><span className={cx("flex items-start gap-1 text-xs font-medium", up ? "text-success-primary" : "text-ink-3")}>{up && <ArrowUp className="mt-0.5 size-3" />}{ctx}</span></Tile>)}</div>
            <Giving gifts={gifts} regular={regular} reload={reload} />
            <div className="grid gap-4 lg:grid-cols-2">
                <Tile>
                    <div className="flex items-center justify-between gap-2"><Eyebrow>Your pages</Eyebrow>{pages.length > 0 && <Badge type="pill-color" color="gray" size="sm">{pages.length}</Badge>}</div>
                    {pages.length === 0 ? <p className="rounded-2xl bg-tint-2 px-4 py-5 text-sm text-ink-3">No pages yet.</p>
                        : <div className="flex flex-col gap-4">{pages.slice(0, 50).map((p) => { const pct = p.goal_cents ? Math.min(100, Math.round((p.raised_cents / p.goal_cents) * 100)) : 0; return <div key={p.id} className="flex flex-col gap-1.5"><div className="flex items-center justify-between gap-3 text-sm"><button type="button" onClick={() => go({ name: "page", page: { type: p.type, slug: p.slug }, org: orgs.find((o) => o.id === p.org_id)?.slug ?? "" })} className="min-w-0 cursor-pointer truncate text-left font-medium text-ink hover:underline">{p.title}</button><span className="flex shrink-0 items-center gap-2"><Badge type="pill-color" color={p.status === "live" ? "success" : "gray"} size="sm">{p.status}</Badge><span className="font-semibold text-ink-3 tabular-nums">{pct}%</span></span></div><div className="h-1.5 overflow-hidden rounded-full bg-tint-3"><div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} /></div><p className="text-xs text-tertiary tabular-nums">{fmt(p.raised_cents, p.currency)} of {fmt(p.goal_cents, p.currency)} · {p.donor_count} gifts</p></div>; })}</div>}
                    <button type="button" onClick={() => go({ name: "create" })} className="mt-auto flex min-h-11 w-fit cursor-pointer items-center pt-2.5 text-sm font-semibold text-ink underline decoration-ink-faint underline-offset-4 hover:decoration-ink">{pages.length ? "Start another page" : "Start a page"}</button>
                </Tile>
                <Tile>
                    <div className="flex items-center justify-between gap-2"><Eyebrow>Giving streak</Eyebrow><Badge type="pill-color" color="gray" size="sm">{BADGES.filter(([, m]) => streak >= m).length} of {BADGES.length} badges</Badge></div>
                    <span className="text-[28px] leading-tight font-semibold text-ink"><span className="tabular-nums">{streak}</span> {streak === 1 ? "month" : "months"}</span>
                    <ol aria-label="Badges" className="mt-3.5 grid grid-cols-6 gap-2">{BADGES.map(([n, m]) => { const on = streak >= m; return <li key={n} title={`${n}: ${m} ${m === 1 ? "month" : "months"} in a row`} className="flex flex-col items-center gap-1 text-center"><span className={cx("relative flex size-11 items-center justify-center rounded-full", on ? "bg-ink text-ink-inverse" : "bg-tint-2 text-ink-faint")}><Trophy01 className="size-5" />{!on && <Lock01 className="absolute -right-1 -bottom-1 size-4 rounded-full bg-raised p-0.5 text-ink-3 shadow-edge" />}</span><span className="text-[10px] leading-tight font-medium text-ink-3">{n}</span></li>; })}</ol>
                </Tile>
            </div>
        </div>
    );
};
