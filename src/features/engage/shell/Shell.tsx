/**
 * The back office frame: one frosted-glass panel on a soft Outgive wash, with the sidebar (logo, the charity, the nav),
 * a top bar (give page, search, create, help, account) and the screen. Under 900px the sidebar becomes a scrolling row of links.
 */
import { type FormEvent, type MouseEvent, type ReactNode, useRef } from "react";
import { ArrowUpRight, CaretDown, MagnifyingGlass, Plus, Question } from "@phosphor-icons/react";
import { OgLogo } from "@/shared/ui";
import { useApp } from "@/shared/lib/app-context";
import { cx } from "@/shared/utils/cx";
import type { EngageSection } from "@/shared/lib/route";
import { ROLE_INFO, atLeast } from "@/features/launch";
import { Tag } from "../ui/primitives";
import { GROUPS, OVERVIEW, SECTIONS, type Section, hrefOf } from "./sections";
import { useWorkspace } from "./workspace";
import { usePledgeBadge } from "../overview/data";

/** Links inside /engage change the screen without a page load; modified clicks open as usual. */
const useNav = () => {
    const { go } = useApp();
    return (section: EngageSection | undefined) => (e: MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault(); go({ name: "engage", section });
    };
};

const NavItem = ({ s, current, badge }: { s: Section; current: boolean; badge?: number | null }) => {
    const nav = useNav();
    return (
        <li><a className="eg-nav-item" href={hrefOf(s.id)} aria-current={current ? "page" : undefined} onClick={nav(s.id)}>
            {s.icon}<span>{s.label}</span>{!!badge && <b className="eg-badge" aria-label={`${badge} open`}>{badge}</b>}
        </a></li>
    );
};

const ModeTag = () => {
    const { mode, sample } = useWorkspace();
    if (mode === "live") return <Tag tone="forest"><i className="eg-live-dot" aria-hidden="true" />Live</Tag>;
    return <Tag tone="peach">{mode === "demo" ? (sample ? "Demo · sample data" : "Demo") : "Test mode"}</Tag>;
};

const Search = () => {
    const nav = useApp().go, input = useRef<HTMLInputElement>(null);
    const submit = (e: FormEvent) => {
        e.preventDefault();
        const q = input.current?.value.trim().toLowerCase() ?? "";
        const hit = q && SECTIONS.find((s) => s.label.toLowerCase().includes(q));
        if (hit) { nav({ name: "engage", section: hit.id }); input.current!.value = ""; }
    };
    return (
        <form role="search" className="eg-search" onSubmit={submit}>
            <MagnifyingGlass size={18} aria-hidden="true" />
            <label className="eg-sr" htmlFor="eg-q">Search the back office</label>
            <input id="eg-q" ref={input} list="eg-q-list" placeholder="Search tools, campaigns or donors" autoComplete="off" />
            <datalist id="eg-q-list">{SECTIONS.map((s) => <option key={s.label} value={s.label} />)}</datalist>
        </form>
    );
};

const Account = () => {
    const { db, user, isDemo } = useApp();
    const ws = useWorkspace();
    const who = user?.name || user?.email || (isDemo ? "Demo owner" : "You");
    return (
        <details className="eg-account">
            <summary aria-label={`Account: ${who}`}><span className="eg-me" aria-hidden="true">{who.slice(0, 2).toUpperCase()}</span><CaretDown size={14} weight="bold" aria-hidden="true" /></summary>
            <div className="eg-menu wide">
                <p><b>{who}</b><small>{ROLE_INFO[ws.role][0]} at {ws.org.name}</small></p>
                <ul>
                    <li><a href="/ramadhan/account">Your account</a></li>
                    {atLeast(ws.role, "admin") && <li><a href="/ramadhan/team">Team</a></li>}
                    {!isDemo && <li><button type="button" onClick={async () => { await db.signOut(); location.href = "/ramadhan/login?next=/engage"; }}>Sign out</button></li>}
                </ul>
            </div>
        </details>
    );
};

export const Shell = ({ section, children }: { section: Section; children: ReactNode }) => {
    const ws = useWorkspace(), pledges = usePledgeBadge();
    return (
        <div className="eg">
            <div className="eg-panel">
                <aside className="eg-side">
                    <a href="/" className="eg-logo" aria-label="Outgive home"><OgLogo size={24} /></a>
                    <div className="eg-ws">
                        <p className="eg-label">Charity</p>
                        <div className="eg-ws-card">
                            <span><b>{ws.org.name}</b><small>{ws.org.ein ? `EIN ${ws.org.ein}` : "EIN not added"} · {ws.mode === "live" ? "Live" : "Sandbox"}</small></span>
                            {ws.roles.length > 1 ? (
                                <label className="eg-ws-switch"><span className="eg-sr">Switch charity</span><CaretDown size={16} aria-hidden="true" />
                                    <select value={ws.org.slug} onChange={(e) => { location.search = `?org=${e.target.value}`; }}>{ws.roles.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}</select>
                                </label>
                            ) : <CaretDown size={16} aria-hidden="true" className="eg-ws-caret" />}
                        </div>
                    </div>
                    <nav aria-label="Back office">
                        <ul className="eg-nav"><NavItem s={OVERVIEW} current={!section.id} /></ul>
                        {GROUPS.map((g) => (
                            <div key={g.label} className="eg-nav-group">
                                <p className="eg-label"><i className={cx("eg-sq", g.tone)} aria-hidden="true" />{g.label}</p>
                                <ul className="eg-nav">{g.items.map((s) => <NavItem key={s.label} s={s} current={s.id === section.id} badge={s.id === "pledges" ? pledges : null} />)}</ul>
                            </div>
                        ))}
                    </nav>
                </aside>
                <header className="eg-top">
                    <a className="eg-btn black" href="/ramadhan">Give page<ArrowUpRight size={16} weight="bold" aria-hidden="true" /></a>
                    <ModeTag />
                    <Search />
                    <a className="eg-btn white" href="/ramadhan/edit"><Plus size={16} weight="bold" aria-hidden="true" />Create</a>
                    <a className="eg-icon-btn" href="/faq" aria-label="Help"><Question size={20} aria-hidden="true" /></a>
                    <Account />
                </header>
                <main className="eg-body" id="eg-main">{children}</main>
            </div>
        </div>
    );
};
