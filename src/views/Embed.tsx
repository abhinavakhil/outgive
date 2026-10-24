import { useEffect, useState } from "react";
import { Avatar } from "@/components/base/avatar/avatar";
import { BrandMark, useApp } from "@/components/outgive/shared";
import { CURRENCIES, initials } from "@/data";
import type { PageRef } from "@/lib/route";
import type { PageBundle } from "@/lib/types";
import { cx } from "@/utils/cx";

/** Widgets for other sites: the top of the board, or one page's progress and give button. Links open the full page in the parent window. */
export const Embed = ({ pageRef }: { pageRef?: PageRef }) => {
    const { db, org, brand, board, money, href } = useApp();
    const [bundle, setBundle] = useState<PageBundle | null>(null);
    const q = new URLSearchParams(window.location.search);
    const limit = Math.max(3, Math.min(25, Number(q.get("limit")) || 5));
    useEffect(() => { if (q.get("theme") === "dark") document.documentElement.classList.add("dark-mode"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (org && pageRef) db.rpc<PageBundle | null>("page_get", { org: org.id, t: pageRef.type, s: pageRef.slug }).then(setBundle); }, [db, org, pageRef?.type, pageRef?.slug]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (!org) return; return db.onDonations(org.id, () => { if (pageRef) db.rpc<PageBundle | null>("page_get", { org: org.id, t: pageRef.type, s: pageRef.slug }).then(setBundle); }); }, [db, org, pageRef]);
    if (!org) return null;
    const base = window.location.origin;
    const link = (path: string) => <a href={base + path} target="_top" rel="noopener" className="inline-flex h-10 items-center justify-center rounded-full bg-brand-solid px-5 text-sm font-semibold text-white hover:bg-brand-solid_hover">Give</a>;
    if (pageRef) {
        if (!bundle) return <div className="p-4 text-sm text-tertiary">Loading…</div>;
        const p = bundle.page; const rate = CURRENCIES[p.currency] ?? 1; const raised = p.raised_cents / 100 / rate; const goal = p.goal_cents / 100 / rate; const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
        return (
            <div className="flex flex-col gap-3 bg-primary p-4 text-primary">
                <div className="flex items-center gap-3"><BrandMark className="size-9 rounded-xl text-sm" /><div className="min-w-0"><div className="truncate font-semibold">{p.title}</div><div className="text-xs text-tertiary">{p.org_name || brand.name}</div></div></div>
                <div><span className="text-xl font-semibold text-brand-secondary">{money(raised)}</span>{p.show_goal && goal > 0 && <span className="text-sm text-tertiary"> raised of {money(goal)}</span>}</div>
                {p.show_goal && goal > 0 && <div className="h-2 overflow-hidden rounded-full bg-tertiary"><div className="h-full rounded-full bg-brand-solid" style={{ width: `${pct}%` }} /></div>}
                <div className="flex items-center justify-between gap-3 text-xs text-tertiary"><span>{p.donor_count} supporters</span>{link(href({ name: "page", org: org.slug, page: pageRef }))}</div>
            </div>
        );
    }
    const rows = [...board].sort((a, b) => b.total - a.total).slice(0, limit);
    return (
        <div className="flex flex-col gap-2 bg-primary p-4 text-primary">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><BrandMark className="size-8 rounded-lg text-xs" /><span className="font-semibold">{brand.name}</span></div>{link(href({ name: "home" }))}</div>
            <ol className="flex flex-col gap-1">{rows.map((o, i) => <li key={o.id} className={cx("flex items-center gap-3 rounded-xl px-3 py-2", i < 3 && "bg-brand-primary")}><span className={cx("w-6 text-sm font-semibold tabular-nums", i < 3 ? "text-brand-secondary" : "text-tertiary")}>#{i + 1}</span><Avatar size="xs" initials={initials(o.name)} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{o.name}</span><span className="text-sm font-semibold text-brand-secondary tabular-nums">{money(o.total)}</span></li>)}{rows.length === 0 && <li className="py-4 text-center text-sm text-tertiary">Nobody on the board yet.</li>}</ol>
            {!org.remove_branding && <a href={base} target="_top" rel="noopener" className="text-right text-[11px] text-tertiary hover:underline">Powered by Outgive</a>}
        </div>
    );
};
