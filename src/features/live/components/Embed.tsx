import { useEffect, useState } from "react";
import { Avatar, BrandMark, Loading } from "@/shared/ui";
import { useApp } from "@/shared/lib/app-context";
import { CURRENCIES } from "@/shared/domain/model";
import { initials } from "@/shared/lib/format";
import type { PageRef } from "@/shared/lib/route";
import type { PageBundle } from "@/shared/domain/types";
import { cx } from "@/shared/utils/cx";

/** Widgets for other sites: the top of the board, or one page's progress and give button. Links open the full page in the parent window. */
export const Embed = ({ pageRef, theme, limit: rowCount }: { pageRef?: PageRef; theme?: "dark"; limit?: number }) => {
    const { db, org, brand, board, money, href } = useApp();
    const [bundle, setBundle] = useState<PageBundle | null>(null);
    const limit = Math.max(3, Math.min(25, rowCount || 5));
    useEffect(() => { if (theme === "dark") document.documentElement.classList.add("dark-mode"); }, [theme]);
    useEffect(() => { if (org && pageRef) db.rpc<PageBundle | null>("page_get", { org: org.id, t: pageRef.type, s: pageRef.slug }).then(setBundle); }, [db, org, pageRef?.type, pageRef?.slug]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (!org) return; return db.onDonations(org.id, () => { if (pageRef) db.rpc<PageBundle | null>("page_get", { org: org.id, t: pageRef.type, s: pageRef.slug }).then(setBundle); }); }, [db, org, pageRef]);
    if (!org) return null;
    const base = window.location.origin;
    const link = (path: string) => <a href={base + path} target="_top" rel="noopener" className="inline-flex h-10 items-center justify-center rounded-full bg-cta shadow-press hover:bg-cta-hover px-5 text-sm font-semibold text-cta-ink transition">Give</a>;
    if (pageRef) {
        if (!bundle) return <Loading />;
        const p = bundle.page; const rate = CURRENCIES[p.currency] ?? 1; const raised = p.raised_cents / 100 / rate; const goal = p.goal_cents / 100 / rate; const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
        return (
            <div className="flex flex-col gap-3 rounded-3xl bg-tint-1 p-5 text-ink">
                <div className="flex items-center gap-3"><BrandMark className="size-9 rounded-xl text-sm" /><div className="min-w-0"><div className="truncate font-extrabold tracking-[-0.03em]">{p.title}</div><div className="text-xs text-ink-3">{p.org_name || brand.name}</div></div></div>
                <div><span className="font-bubble text-2xl font-bold tabular-nums">{money(raised)}</span>{p.show_goal && goal > 0 && <span className="text-sm text-ink-3"> raised of {money(goal)}</span>}</div>
                {p.show_goal && goal > 0 && <div className="h-2 overflow-hidden rounded-full bg-tint-3"><div className="h-full rounded-full bg-brand-solid" style={{ width: `${pct}%` }} /></div>}
                <div className="flex items-center justify-between gap-3 text-xs text-ink-3"><span><span className="font-semibold tabular-nums">{p.donor_count}</span> supporters</span>{link(href({ name: "page", org: org.slug, page: pageRef, sub: "donate" }))}</div>
            </div>
        );
    }
    const rows = [...board].sort((a, b) => b.total - a.total).slice(0, limit);
    return (
        <div className="flex flex-col gap-3 rounded-3xl bg-tint-1 p-5 text-ink">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><BrandMark className="size-8 rounded-lg text-xs" /><span className="font-extrabold tracking-[-0.03em]">{brand.name}</span></div>{link(href({ name: "give" }))}</div>
            <ol className="flex flex-col gap-1">{rows.map((o, i) => <li key={o.id} className={cx("flex items-center gap-3 rounded-2xl px-3 py-2", i === 0 ? "bg-brand-solid text-white" : i < 3 ? "bg-tint-2" : "hover:bg-tint-2")}><span className={cx("font-bubble w-6 text-sm font-bold tabular-nums", i === 0 ? "text-white/80" : "text-ink-3")}>#{i + 1}</span><Avatar size="xs" initials={initials(o.name)} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{o.name}</span><span className="font-bubble text-sm font-bold tabular-nums">{money(o.total)}</span></li>)}{rows.length === 0 && <li className="py-4 text-center text-sm text-ink-3">Nobody on the board yet.</li>}</ol>
            {!org.remove_branding && <a href={base} target="_top" rel="noopener" className="text-right text-[11px] text-ink-faint hover:underline">Powered by Outgive</a>}
        </div>
    );
};
