import { Copy01, LinkExternal01 } from "@untitledui/icons";
import type { FC, ReactNode } from "react";
import { useApp } from "@/shared/lib/app-context";
import { initials } from "@/shared/lib/format";
import { Button } from "@/shared/ui/base/buttons/button";
import { cx } from "@/shared/utils/cx";

type Icon = FC<{ className?: string }>;

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

/** KPI tile. */
export const Stat = ({ icon: I, label, value, trend, tone = "default" }: { icon: Icon; label: string; value: string; trend?: ReactNode; tone?: "default" | "brand" }) => (
    <div className={cx("flex min-w-0 flex-col gap-3 p-5", tone === "brand" ? "rounded-[28px] bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-xl" : "rounded-3xl bg-brand-primary text-primary")}>
        <div className="flex items-center justify-between gap-2"><span className={cx("text-[13px] font-semibold", tone === "brand" ? "text-white/80" : "text-tertiary")}>{label}</span><span className={cx("flex size-8 items-center justify-center", tone === "brand" ? "rounded-xl bg-white/15 backdrop-blur" : "rounded-full bg-brand-solid text-white")}><I className="size-4" /></span></div>
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
