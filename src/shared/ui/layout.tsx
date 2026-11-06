import type { FC, ReactNode } from "react";
import { useApp } from "@/shared/lib/app-context";
import { BrandLogo, ThemeToggle } from "@/shared/ui/brand";
import { cx } from "@/shared/utils/cx";

type Icon = FC<{ className?: string }>;

export const Container = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cx("mx-auto w-full max-w-6xl px-4 md:px-8", className)}>{children}</div>;
export const Card = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cx("rounded-[28px] bg-primary p-5 shadow-xl ring-1 ring-secondary ring-inset md:p-6", className)}>{children}</div>;
export const TwoCol = ({ main, side, className }: { main: ReactNode; side: ReactNode; className?: string }) => (
    <div className={cx("grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10", className)}>
        <div className="flex min-w-0 flex-col gap-7">{main}</div>
        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:self-start">{side}</div>
    </div>
);

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

/** A card with a heading row. `action` sits top-right. */
export const Panel = ({ title, sub, action, children, className }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) => (
    <section className={cx("flex min-w-0 flex-col gap-5 rounded-3xl bg-primary p-5 shadow-md ring-1 ring-secondary ring-inset md:p-6", className)}>
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
