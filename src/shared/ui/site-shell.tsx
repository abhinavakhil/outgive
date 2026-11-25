/**
 * The public site's frame in the Outgive design system: the landing page's header and footer around a page,
 * plus the loading spinner every screen uses instead of "Loading…" text.
 */
import type { ReactNode } from "react";
import { Logo } from "@/shared/ui/og-logo";
import { cx } from "@/shared/utils/cx";
import { DemoRequest } from "@/shared/ui/demo-request";
import "./site-shell.css";

const NAV: [string, string][] = [["Features", "/#pages"], ["Live nights", "/#nights"], ["Pricing", "/pricing"], ["Leaderboard", "/leaderboard"]];
const FOOT: [string, [string, string][]][] = [
    ["Product", [["Donate page", "/checkout"], ["Fundraising pages", "/create"], ["Live screens", "/demo/live"], ["Leaderboards", "/leaderboard"]]],
    ["Resources", [["Pricing", "/pricing"], ["Blog", "/blog"], ["FAQ", "/faq"], ["Fundraising rules", "/rules"]]],
    ["Company", [["About", "/about"], ["Contact", "mailto:hello@outgive.tech"]]],
    ["Legal", [["Privacy policy", "/privacy"], ["Terms of service", "/terms"]]],
];

/** An orange arc turning on a quiet track. `label` is read to screen readers. */
export const Spinner = ({ size = 28, label = "Loading", className }: { size?: number; label?: string; className?: string }) => (
    <span role="status" aria-live="polite" className={cx("og-spin", className)} style={{ width: size, height: size }}><span className="sr-only">{label}</span></span>
);
/** A spinner centred in the space it is given; `full` fills the viewport. */
export const Loading = ({ full, label, className }: { full?: boolean; label?: string; className?: string }) => (
    <div className={cx("flex items-center justify-center", full ? "min-h-dvh" : "py-16", className)}><Spinner label={label} /></div>
);

export const SitePage = ({ children, narrow = true }: { children: ReactNode; narrow?: boolean }) => (
    <div className="og-site">
        <header className="og-wrap og-head">
            <a href="/" aria-label="Outgive home" className="flex"><Logo size={26} /></a>
            <nav aria-label="Main" className="og-nav">{NAV.map(([l, h]) => <a key={l} href={h}>{l}</a>)}</nav>
            <div className="flex items-center gap-4"><a className="og-navl max-sm:hidden" href="/login">Log in</a><a href="#demo" className="og-btn">Book a demo</a></div>
        </header>
        <main className={cx("og-wrap og-main", narrow && "og-narrow")}>{children}</main>
        <footer className="og-wrap og-foot">
            <div className="og-foot-row">
                <a href="/" aria-label="Outgive home" className="flex self-start"><Logo size={24} /></a>
                <div className="og-foot-cols">{FOOT.map(([t, links]) => <div key={t}><strong>{t}</strong>{links.map(([l, h]) => <a key={l} href={h}>{l}</a>)}</div>)}</div>
            </div>
            <p className="og-copy">© 2026 Outgive</p>
        </footer>
        <DemoRequest />
    </div>
);
