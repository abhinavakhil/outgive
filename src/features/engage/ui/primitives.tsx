/**
 * The back office's building blocks. Every screen in /engage is made from these and the classes in engage.css (eg-*).
 * Colours come from one chart palette (PALETTE) so a fund, a night or a status reads the same everywhere.
 */
import { type ReactNode, useId, useRef } from "react";
import { DotsThreeVertical } from "@phosphor-icons/react";
import { cx } from "@/shared/utils/cx";

/** The chart palette, in the order series take it: sage, ink, lilac, peach, orange. */
export const PALETTE = ["#C9D66E", "#191919", "#C6AEE8", "#FAD8C4", "#F0783C"] as const;
/** Text that reads on each palette colour. */
const ON = ["#191919", "#FFFFFF", "#191919", "#191919", "#191919"];

// ---------------------------------------------------------------- card
export type MenuItem = { label: string; href: string };
/** A white rounded card. `menu` adds the kebab with a list of links. */
export const Card = ({ title, menu, action, className, children, as: As = "section" }: { title?: ReactNode; menu?: MenuItem[]; action?: ReactNode; className?: string; children: ReactNode; as?: "section" | "article" | "div" }) => (
    <As className={cx("eg-card", className)}>
        {(title || menu || action) && (
            <header className="eg-card-head">
                {title && <h2 className="eg-card-title">{title}</h2>}
                {action}
                {menu && <Kebab label={typeof title === "string" ? `More for ${title}` : "More"} items={menu} />}
            </header>
        )}
        {children}
    </As>
);

/** Kebab menu on a native <details>, so it opens with the keyboard and closes on Escape without a library. */
export const Kebab = ({ label, items }: { label: string; items: MenuItem[] }) => {
    const ref = useRef<HTMLDetailsElement>(null);
    return (
        <details ref={ref} className="eg-kebab" onKeyDown={(e) => { if (e.key === "Escape" && ref.current) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); } }}>
            <summary aria-label={label} className="eg-icon-btn sm"><DotsThreeVertical size={20} weight="bold" aria-hidden="true" /></summary>
            <ul className="eg-menu">{items.map((i) => <li key={i.label}><a href={i.href}>{i.label}</a></li>)}</ul>
        </details>
    );
};

// ---------------------------------------------------------------- small pieces
export type Tone = "grey" | "lilac" | "sage" | "peach" | "forest";
/** Small status label: grey "Not started", lilac "In progress", sage "Done", peach "Test mode", forest "Live". */
export const Tag = ({ tone = "grey", children }: { tone?: Tone; children: ReactNode }) => <span className={cx("eg-tag", tone)}>{children}</span>;

/** A pill counter for the greeting: a sage number badge and a label. */
export const Counter = ({ n, label }: { n: ReactNode; label: string }) => <span className="eg-counter"><b>{n}</b>{label}</span>;

/** Overlapping initials, then a "+n" note. `people` are display names; initials are taken from them. */
export const AvatarStack = ({ people, more }: { people: string[]; more?: string }) => (
    <span className="eg-avatars">
        <span aria-hidden="true">{people.slice(0, 3).map((p, i) => <i key={i} style={{ background: [PALETTE[2], PALETTE[0], PALETTE[3]][i] }}>{p.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</i>)}</span>
        {more && <small>{more}</small>}
    </span>
);

/** Label / big value / small note, side by side with hairlines between. */
export type Stat = { label: string; value: ReactNode; note?: ReactNode };
export const StatStrip = ({ items }: { items: Stat[] }) => (
    <dl className="eg-stats">{items.map((s) => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd>{s.note && <dd className="eg-stat-note">{s.note}</dd>}</div>)}</dl>
);

/** What a card shows when its figure has no source yet: one line, and where to set it up. */
export const Empty = ({ children, href, cta }: { children: ReactNode; href?: string; cta?: string }) => (
    <div className="eg-empty"><p>{children}</p>{href && cta && <a className="eg-btn white sm" href={href}>{cta}</a>}</div>
);

// ---------------------------------------------------------------- tabs
export type TabItem<K extends string> = { id: K; label: string; icon?: ReactNode };
/** Icon tab row; the active tab is a white pill. Arrow keys move between tabs. Pair with role="tabpanel" content labelled by `${id}-tab-<key>`. */
export const Tabs = <K extends string>({ id, items, value, onChange, label }: { id: string; items: TabItem<K>[]; value: K; onChange: (k: K) => void; label: string }) => (
    <div className="eg-tabs" role="tablist" aria-label={label} onKeyDown={(e) => {
        const i = items.findIndex((t) => t.id === value), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        const next = items[(i + d + items.length) % items.length].id;
        onChange(next); document.getElementById(`${id}-tab-${next}`)?.focus();
    }}>
        {items.map((t) => (
            <button key={t.id} id={`${id}-tab-${t.id}`} type="button" role="tab" aria-selected={t.id === value} aria-controls={`${id}-panel`} tabIndex={t.id === value ? 0 : -1} className="eg-tab" onClick={() => onChange(t.id)}>{t.icon}{t.label}</button>
        ))}
    </div>
);

// ---------------------------------------------------------------- pie
export type Slice = { label: string; value: number; note?: string };
const arc = (r: number, a0: number, a1: number) => {
    const p = (a: number) => `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
    return `M0 0L${p(a0)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}Z`;
};
/** Pie with values printed in the big slices and a legend of colour bars with two-line labels. The legend is the text equivalent. */
export const Pie = ({ slices, format, label }: { slices: Slice[]; format: (n: number) => string; label: string }) => {
    const total = slices.reduce((n, s) => n + s.value, 0);
    let a = 0;
    const parts = slices.map((s, i) => { const a0 = a; a += (s.value / total) * Math.PI * 2; return { ...s, i, a0, a1: a }; });
    return (
        <figure className="eg-pie">
            <svg viewBox="-100 -100 200 200" role="img" aria-label={`${label}: ${slices.map((s) => `${s.label} ${format(s.value)}`).join(", ")}`}>
                {parts.length === 1 ? <circle r="96" fill={PALETTE[0]} /> : parts.map((p) => <path key={p.label} d={arc(96, p.a0, p.a1)} fill={PALETTE[p.i % PALETTE.length]} stroke="#fff" strokeWidth="1.5" />)}
                {parts.filter((p) => p.value / total >= 0.12).map((p) => {
                    const m = parts.length === 1 ? 0 : (p.a0 + p.a1) / 2, r = parts.length === 1 ? 0 : 56;
                    return <text key={p.label} x={r * Math.sin(m)} y={-r * Math.cos(m)} fill={ON[p.i % ON.length]} textAnchor="middle" dominantBaseline="central" className="eg-pie-val">{format(p.value)}</text>;
                })}
            </svg>
            <figcaption><ul className="eg-legend">{slices.map((s, i) => (
                <li key={s.label}><i style={{ background: PALETTE[i % PALETTE.length] }} /><b>{s.label}</b><span>{s.note ?? format(s.value)}</span></li>
            ))}</ul></figcaption>
        </figure>
    );
};

// ---------------------------------------------------------------- nights bar
export type NightMark = { label: ReactNode; sub: ReactNode };
/**
 * The 30 nights of Ramadan as one segmented bar, each segment shaded by what that night raised (lilac ramp).
 * Odd nights of the last ten carry an orange tick; `today` (0-based) gets an ink outline. Labels sit above and below, left / centre / right.
 */
export const NightsBar = ({ nights, today, top, bottom, format }: { nights: number[]; today?: number; top: [NightMark, NightMark, NightMark]; bottom: [NightMark, NightMark, NightMark]; format: (n: number) => string }) => {
    const max = Math.max(0, ...nights);
    const shade = (v: number) => (!max || !v ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999)));
    const row = (m: [NightMark, NightMark, NightMark]) => <div className="eg-nights-row">{m.map((x, i) => <div key={i}><b>{x.label}</b><span>{x.sub}</span></div>)}</div>;
    const odd = (i: number) => i >= 20 && i % 2 === 0; // night 21, 23 … 29 (0-based 20, 22 …)
    return (
        <div className="eg-nights">
            {row(top)}
            <ol className="eg-nights-bar" aria-label="Raised each night of Ramadan">
                {nights.map((v, i) => (
                    <li key={i} className={cx(`s${shade(v)}`, odd(i) && "odd", today === i && "today")} title={`Night ${i + 1}: ${format(v)}`}>
                        <span className="eg-sr">Night {i + 1}{odd(i) ? " (odd night of the last ten)" : ""}: {format(v)}</span>
                    </li>
                ))}
            </ol>
            {row(bottom)}
        </div>
    );
};

// ---------------------------------------------------------------- agenda
export type AgendaEvent = { title: string; when: string; note?: string; tag?: string; people?: string[]; more?: string; href?: string };
export type AgendaDay = { date: Date; events: AgendaEvent[] };
/** A week row (selected day is a filled ink pill) and the selected day's events, each with a left accent rule. */
export const Agenda = ({ days, selected, onSelect, empty }: { days: AgendaDay[]; selected: number; onSelect: (i: number) => void; empty: ReactNode }) => {
    const id = useId();
    const day = days[selected];
    return (
        <div className="eg-agenda">
            <div className="eg-week" role="group" aria-label="Pick a day">
                {days.map((d, i) => (
                    <button key={i} type="button" aria-pressed={i === selected} aria-controls={id} className={cx("eg-day", !d.events.length && "quiet")} onClick={() => onSelect(i)}>
                        <small>{d.date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}</small>
                        <b>{d.date.getDate()}</b>
                        <span className="eg-sr">{d.date.toLocaleDateString("en-US", { month: "long" })}, {d.events.length} scheduled</span>
                    </button>
                ))}
            </div>
            <div id={id} aria-live="polite">
                {day?.events.length ? day.events.map((e) => (
                    <article key={e.title} className="eg-event">
                        <header><h3>{e.href ? <a href={e.href}>{e.title}</a> : e.title}</h3></header>
                        <p className="eg-event-when">{e.when}</p>
                        <footer>{e.people && <AvatarStack people={e.people} more={e.more} />}{e.note && !e.people && <small>{e.note}</small>}{e.tag && <span className="eg-chip">{e.tag}</span>}</footer>
                    </article>
                )) : <div className="eg-event none">{empty}</div>}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------- to-do grid
export type Todo = { icon: ReactNode; title: string; note: string; href: string };
/** Today's actions, two by two: an icon, a title and how many are due. Each one is a link to where it gets done. */
export const TodoGrid = ({ items }: { items: Todo[] }) => (
    <ul className="eg-todo">{items.map((t) => (
        <li key={t.title}><a href={t.href}><span className="eg-todo-ic" aria-hidden="true">{t.icon}</span><span><b>{t.title}</b><small>{t.note}</small></span></a></li>
    ))}</ul>
);
