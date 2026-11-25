/**
 * The charity's Ramadan page, drawn from a BioPage. Used full-screen at /ramadhan and inside the editor's phone preview.
 * Blocks render in the order and visibility the editor sets; the theme sets colour, style, corners and font.
 */
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/shared/utils/cx";
import { type BioPage, type BlockId, GIFTS, SUPPORTERS, money, onColour } from "./model";
import { CauseArt, ILLUSTRATION_BG } from "./illustrations";
import { type Mode, fridaysFrom, nightsFor } from "../give/model";
import { useGive } from "../give/store";
import "./bio.css";

const DAY = 86400000, NIGHTS = 30;
type Phase = { kind: "before"; days: number } | { kind: "during"; night: number; last10: boolean } | { kind: "eid" } | { kind: "after" };
const phaseOf = (startIso: string, now: number): Phase => {
    const start = Date.parse(startIso), eid = start + NIGHTS * DAY;
    if (now < start) return { kind: "before", days: Math.ceil((start - now) / DAY) };
    const night = Math.floor((now - start) / DAY) + 1;
    if (night <= NIGHTS) return { kind: "during", night, last10: night > 20 };
    return now < eid + 3 * DAY ? { kind: "eid" } : { kind: "after" };
};
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const Ico = ({ d, size = 18 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const SOCIAL: Record<string, string> = { instagram: "M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zM12 8a4 4 0 100 8 4 4 0 000-8zM17.5 6.5h.01", whatsapp: "M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1z", website: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18", email: "M3 6h18v12H3zM3 7l9 6 9-6" };
/** The Ramadan ways to give, each straight into the donate flow. */
const WAYS = [
    { title: "Pay your Zakat", text: "100% to those eligible", cta: "Give", appeal: "Zakat", add: "zakat", icon: "M3 7h18v10H3zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6 10v4M18 10v4", tone: "sage" },
    { title: "Sponsor iftar", text: "£4 feeds one person at sunset", cta: "Give", appeal: "Iftar meals", add: "food", icon: "M3 11h18a9 6 0 01-18 0zM9 4c-1 1.5 1 2.5 0 4M13 4c-1 1.5 1 2.5 0 4", tone: "peach" },
];
const FONT_STACK: Record<string, string> = { Outfit: '"Outfit"', "DM Sans": '"DM Sans"', "Space Grotesk": '"Space Grotesk"', Fraunces: '"Fraunces"' };

/** Where a Give button goes: a summary line, plus the basket and nights to start the donate flow with. */
export type GiveHref = (summary: string, start?: { add?: string[]; nights?: string; days?: number[] }) => string;

export const BioView = ({ page, now = Date.now(), giveHref }: { page: BioPage; now?: number; giveHref: GiveHref }) => {
    // The basket is shared with the give flow: what's picked here is already in the basket there, and the other way round.
    const [give, setGive] = useGive();
    const basket: Record<string, boolean> = Object.fromEntries(Object.entries(give.qty).map(([k, v]) => [k, v > 0]));
    const [tab, setTab] = useState<"campaigns" | "causes">("campaigns");
    const t = page.theme;
    // Load the chosen font from Google Fonts the first time a page uses it (Outfit is always loaded).
    useEffect(() => {
        if (t.font === "Outfit" || document.querySelector(`link[data-bp-font="${t.font}"]`)) return;
        const l = document.createElement("link"); l.rel = "stylesheet"; l.dataset.bpFont = t.font;
        l.href = `https://fonts.googleapis.com/css2?family=${t.font.replace(/ /g, "+")}:wght@400;500;600&display=swap`; document.head.appendChild(l);
    }, [t.font]);
    const phase = useMemo(() => phaseOf(page.ramadanStart, now), [page.ramadanStart, now]);
    const style = { "--c": t.colour, "--on-c": onColour(t.colour), "--font": `${FONT_STACK[t.font]}, "Outfit", system-ui, sans-serif` } as CSSProperties;
    const raised = page.campaigns.reduce((n, x) => n + x.raised, 0) + page.causes.reduce((n, x) => n + x.raised, 0);
    const goal = page.campaigns.reduce((n, x) => n + x.goal, 0) + page.causes.reduce((n, x) => n + x.goal, 0);
    const named = [...page.campaigns, ...page.causes];
    // Visitors pick any number of campaigns and causes here; the amount is chosen in the donate flow.
    const picked = Object.keys(basket).filter((id) => basket[id]);
    const pick = (id: string) => setGive((g) => { const qty = { ...g.qty }; if (qty[id]) delete qty[id]; else qty[id] = 1; return { qty }; });
    const summary = picked.length ? `Ramadan basket: ${picked.map((id) => named.find((x) => x.id === id)?.title).join(", ")}` : `${page.name} Ramadan appeal`;

    // Campaigns and causes share one tabbed section when both are on the page.
    const tabbed = page.campaigns.length > 0 && page.causes.length > 0 && ["campaigns", "causes"].every((id) => page.blocks.find((b) => b.id === id)?.on);
    const tabs = (
        <div role="tablist" aria-label="Campaigns and causes" className="bp-tabs">
            {(["campaigns", "causes"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} id={k === "campaigns" ? "bp-camp" : "bp-causes"} onClick={() => setTab(k)}>{k === "campaigns" ? "Campaigns" : "Causes"} · {page[k].length}</button>)}
        </div>
    );

    const blocks: Record<BlockId, () => React.ReactNode> = {
        banner: () => <Banner key="banner" p={phase} start={page.ramadanStart} />,
        totals: () => (
            <section key="totals" aria-label="Appeal goal" className="bp-goal-wrap">
                <div className="bp-card bp-totals">
                    <div className="bp-row"><p className="bp-kicker">Our Ramadan goal</p>{phase.kind === "before" ? <span className="bp-due">{phase.days} days to go</span> : phase.kind === "during" ? <span className="bp-due">Night {phase.night} of 30</span> : null}</div>
                    <b className="bp-big">{money(goal)}</b>
                    <p className="bp-mute bp-goal-text">{page.tagline}</p>
                    <Bar pct={(raised / goal) * 100} />
                    <div className="bp-row bp-goal-nums"><span><b>{money(raised)}</b> <span className="bp-mute">raised</span></span><span><b>{money(Math.max(0, goal - raised))}</b> <span className="bp-mute">to go</span></span></div>
                    <Nights giveHref={giveHref} start={page.ramadanStart} />
                </div>
            </section>
        ),
        ways: () => (
            <section key="ways" aria-labelledby="bp-ways">
                <h2 id="bp-ways" className="bp-h2">Give the Ramadan way</h2>
                <ul className="bp-ways">
                    {WAYS.map((w) => (
                        <li key={w.title} className="bp-card bp-way">
                            <span className={`bp-way-ico ${w.tone}`}><Ico d={w.icon} size={22} /></span>
                            <span className="min-w-0 flex-1"><b>{w.title}</b><small>{w.text}</small></span>
                            <a href={giveHref(w.appeal, { add: [w.add] })} className="bp-way-go">{w.cta}</a>
                        </li>
                    ))}
                </ul>
            </section>
        ),
        campaigns: () => page.campaigns.length > 0 && (!tabbed || tab === "campaigns") && (
            <section key="campaigns" aria-labelledby="bp-camp">
                {tabbed ? tabs : <h2 id="bp-camp" className="bp-h2">Campaigns</h2>}
                <Featured>
                    {page.campaigns.slice(0, 3).map((c) => (
                        <li key={c.id} className={cx("bp-card bp-camp", basket[c.id] && "on")}>
                            <div className="bp-art" style={{ background: tile(c.illo) }}>
                                {c.illo && <CauseArt name={c.illo} className="bp-art-illo" />}
                                <span className="bp-art-tag">Ends {shortDate(c.ends)}</span>
                                {c.impact && <span className="bp-art-tag dark">{c.impact}</span>}
                            </div>
                            <div className="bp-camp-body">
                                <Ring pct={pct(c)} />
                                <div className="min-w-0 flex-1">
                                    <h3>{c.title}</h3><p className="bp-mute">{c.text}</p>
                                    <span className="bp-camp-sum"><b>{money(c.raised)}</b> of {money(c.goal)}{c.price && c.per ? ` · ${money(c.price)} ${c.per}` : ""}</span>
                                </div>
                            </div>
                            <div className="bp-camp-foot">
                                <span className="bp-gave"><span className="bp-stack" aria-hidden="true">{SUPPORTERS.slice(0, 3).map(([n], i) => <i key={n} className={`s${i}`}>{initials(n)}</i>)}</span>{c.donors ? `${c.donors.toLocaleString("en-GB")} gave` : "Be the first to give"}</span>
                                <Pick title={c.title} on={!!basket[c.id]} onClick={() => pick(c.id)} label={c.price ? `Give ${money(c.price)}` : "Give"} />
                            </div>
                        </li>
                    ))}
                </Featured>
                {page.campaigns.length > 3 && (
                    <>
                        <h3 className="bp-more">More campaigns</h3>
                        <ul className="bp-rows">
                            {page.campaigns.slice(3).map((c) => (
                                <li key={c.id} className={cx("bp-card bp-crow", basket[c.id] && "on")}>
                                    <span className="bp-thumb" style={{ background: tile(c.illo) }}>{c.illo && <CauseArt name={c.illo} />}<em>{pct(c)}% funded</em></span>
                                    <div className="min-w-0 flex-1">
                                        <div className="bp-crow-top"><h3>{c.title}</h3>{c.tag && <span className="bp-crow-tag">{c.tag}</span>}</div>
                                        <Bar pct={pct(c)} />
                                        <span className="bp-crow-meta"><b>{money(c.raised)}</b> of {money(c.goal)}{c.price && c.per ? ` · ${money(c.price)} ${c.per}` : ""}</span>
                                    </div>
                                    <Pick title={c.title} on={!!basket[c.id]} onClick={() => pick(c.id)} label="Give" />
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </section>
        ),
        causes: () => page.causes.length > 0 && (!tabbed || tab === "causes") && (
            <section key="causes" aria-labelledby="bp-causes">
                {tabbed ? tabs : <h2 id="bp-causes" className="bp-h2">Causes</h2>}
                <p className="bp-help">Pick one or more. They go into one gift.</p>
                <ul className="bp-causes grid">
                    {page.causes.map((x) => (
                        <li key={x.id} className={cx("bp-card bp-cause", basket[x.id] && "on")}>
                            <span className="bp-illo" style={{ background: ILLUSTRATION_BG[x.icon as keyof typeof ILLUSTRATION_BG] ?? "var(--soft)" }}><CauseArt name={x.icon} /></span>
                            <h3>{x.title}</h3><p className="bp-mute">{x.note}</p>
                            <Pick title={x.title} on={!!basket[x.id]} onClick={() => pick(x.id)} label="Give" />
                        </li>
                    ))}
                </ul>
            </section>
        ),
        supporters: () => (
            <section key="supporters" aria-labelledby="bp-sup" className="bp-card">
                <div className="bp-row"><h2 id="bp-sup" className="bp-h3">Top supporters</h2><a href="/leaderboard" className="bp-link">See all</a></div>
                <ol className="bp-podium">{SUPPORTERS.slice(0, 3).map(([n, v, k], i) => <li key={n} className={`p${i + 1}`}><span className="bp-medal">{i + 1}</span><span className="bp-pav">{initials(n)}</span><b>{n}</b><small>{k}</small><strong>{money(v)}</strong></li>)}</ol>
                <ol className="bp-list" start={4}>{SUPPORTERS.slice(3).map(([n, v, k], i) => <li key={n}><span className="bp-rank">{i + 4}</span><span className="bp-av">{initials(n)}</span><span className="flex-1 min-w-0"><b>{n}</b><small>{k}</small></span><b>{money(v)}</b></li>)}</ol>
            </section>
        ),
        gifts: () => (
            <section key="gifts" aria-labelledby="bp-gifts" className="bp-gifts-wrap">
                <div className="bp-row bp-gifts-head"><h2 id="bp-gifts" className="bp-h3">Recent gifts</h2><span className="bp-live"><i />Live</span></div>
                <div className="bp-card bp-gifts">
                    <ul>{GIFTS.map(([who, v, to, ago], i) => <li key={who + ago}><span className={`bp-gav g${i % 4}`}>{who === "Anonymous" ? "?" : initials(who)}</span><span className="min-w-0 flex-1"><b>{who}</b><span className="bp-gmeta"><em className={`g${i % 4}`}>{to}</em>{ago}</span></span><strong>{money(v)}</strong></li>)}</ul>
                    <div className="bp-gifts-foot"><span>Top fundraiser: <b>{SUPPORTERS[0][0]} · {money(SUPPORTERS[0][1])}</b></span><a href="/leaderboard" className="bp-link">Leaderboard</a></div>
                </div>
                <div className="bp-join">
                    <span className="bp-stack" aria-hidden="true">{SUPPORTERS.slice(0, 3).map(([n], i) => <i key={n} className={`s${i}`}>{initials(n)}</i>)}</span>
                    <span className="min-w-0 flex-1"><b>Join 48 fundraisers</b><small>Top page has raised {money(SUPPORTERS[0][1])}</small></span>
                    <a href="/create" className="bp-join-go">Start a page</a>
                </div>
            </section>
        ),
        journey: () => page.journey.length > 0 && (
            <section key="journey" aria-labelledby="bp-j" className="bp-card">
                <h2 id="bp-j" className="bp-h3">Our journey</h2>
                <ol className="bp-journey">{page.journey.map((s) => <li key={s.id} className={cx(s.done && "done")}><i /><div><b>{s.title}</b><p className="bp-mute">{s.text}</p></div></li>)}</ol>
            </section>
        ),
        links: () => page.links.length > 0 && <nav key="links" aria-label="Links" className="bp-links">{page.links.map((l) => <a key={l.id} href={l.url} className="bp-btn">{l.label}<Ico d="M7 17L17 7M9 7h8v8" size={16} /></a>)}</nav>,
    };

    return (
        <div className={cx("bp", `s-${t.style}`, `k-${t.corners}`)} style={style}>
            <div className="bp-bg" aria-hidden="true" />
            <main className="bp-col">
                <header className="bp-profile">
                    {page.logo ? <img src={page.logo} alt="" className="bp-avatar" /> : <span className="bp-avatar">{page.avatar || initials(page.name)}</span>}
                    <h1>{page.name}</h1>
                    <p>{page.tagline}</p>
                    {page.charityNo && <small>{page.charityNo}</small>}
                    <nav aria-label="Follow us" className="bp-socials">{Object.entries(SOCIAL).map(([k, d]) => <a key={k} href={(page.socials as Record<string, string>)[k] || "#"} aria-label={k}><Ico d={d} /></a>)}</nav>
                </header>
                {page.blocks.filter((b) => b.on).map((b) => blocks[b.id]())}
                <footer className="bp-foot"><a href="/">Made with <b>outgive</b></a><span>Sample figures</span></footer>
            </main>
            <div className="bp-basket">
                <div className="bp-dock">
                    <span className="min-w-0 flex-1">{picked.length ? <><b>{picked.length} in your basket</b> · one gift</> : <><b>{money(Math.max(0, goal - raised))} to go</b> · matched £1 for £1</>}</span>
                    <a href={giveHref(summary, { add: picked })} className="bp-give">{picked.length ? "View basket" : "Give now"}</a>
                </div>
            </div>
        </div>
    );
};

/** Share of the goal raised, as a small ring with the percentage inside. */
const Ring = ({ pct: p }: { pct: number }) => {
    const r = 21, c = 2 * Math.PI * r;
    return (
        <span className="bp-ring" role="img" aria-label={`${p}% of the goal`}>
            <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r={r} className="bg" /><circle cx="26" cy="26" r={r} className="fg" strokeDasharray={`${(p / 100) * c} ${c}`} /></svg>
            <b>{p}%</b>
        </span>
    );
};
const pct = (c: { raised: number; goal: number }) => Math.min(100, Math.round((c.raised / c.goal) * 100));
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const tile = (illo?: string) => ILLUSTRATION_BG[illo as keyof typeof ILLUSTRATION_BG] ?? "var(--soft)";
const Bar = ({ pct }: { pct: number }) => <div className="bp-bar" role="presentation"><span style={{ width: `${Math.min(100, pct)}%` }} /></div>;
/** The featured campaigns: a swipeable row that moves on by itself every few seconds, until the visitor touches it. */
const Featured = ({ children }: { children: React.ReactNode }) => {
    const ref = useRef<HTMLUListElement>(null);
    const [i, setI] = useState(0);
    const [held, setHeld] = useState(false);
    const n = Array.isArray(children) ? children.length : 1;
    const go = (k: number) => { const el = ref.current; const card = el?.children[k] as HTMLElement | undefined; if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 16, behavior: "smooth" }); };
    useEffect(() => {
        if (held || n < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const id = setInterval(() => go((i + 1) % n), 4500);
        return () => clearInterval(id);
    }, [i, held, n]);
    const onScroll = () => { const el = ref.current; if (!el) return; const w = (el.children[0] as HTMLElement)?.offsetWidth || 1; setI(Math.round(el.scrollLeft / (w + 12))); };
    return (
        <div className="bp-feat" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onTouchStart={() => setHeld(true)} onFocus={() => setHeld(true)}>
            <ul ref={ref} onScroll={onScroll} className="bp-feat-row">{children}</ul>
            {n > 1 && <div className="bp-dots">{Array.from({ length: n }, (_, k) => <button key={k} type="button" aria-label={`Show campaign ${k + 1}`} aria-current={k === i} onClick={() => go(k)} />)}</div>}
        </div>
    );
};

/** Adds a campaign or cause to the gift; press again to take it out. */
const Pick = ({ title, on, onClick, label }: { title: string; on: boolean; onClick: () => void; label?: string }) => (
    <button type="button" aria-pressed={on} aria-label={`${on ? "Remove" : label ?? "Donate to"} ${title}`} onClick={onClick} className={cx("bp-pick", label && "plain")}>
        {on ? <><Ico d="M5 12.5l4.5 4.5L19 7.5" /> Added</> : label ?? <>Donate <Ico d="M12 5v14M5 12h14" /></>}
    </button>
);

/** Give every night of Ramadan: all 30, the last 10, or the nights the donor picks. One payment, split across the nights. */
const Nights = ({ giveHref, start }: { giveHref: GiveHref; start: string }) => {
    const [give, setGive] = useGive();
    const mode = give.mode, days = give.picked;
    const setMode = (m: Mode) => setGive({ mode: m });
    const nights = mode === "once" ? 0 : nightsFor(mode, days, fridaysFrom(start)).length;
    const summary = mode === "30" ? "All 30 nights of Ramadan, given nightly" : mode === "10" ? "Last 10 Nights: one payment, given nightly" : `Ramadan nights ${days.join(", ")}, given nightly`;
    const flip = (n: number) => setGive((g) => ({ picked: g.picked.includes(n) ? g.picked.filter((x) => x !== n) : [...g.picked, n].sort((a, b) => a - b) }));
    return (
        <div className="bp-nights-pick">
            <div className="bp-nights-lead"><span className="bp-moon"><Ico d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" size={20} /></span><span className="min-w-0 flex-1"><b>Give every night</b>One payment, given nightly, so you catch Laylat al-Qadr</span></div>
            <div role="radiogroup" aria-label="Which nights" className="bp-seg">
                {([["30", "All 30 nights"], ["10", "Last 10 nights"], ["pick", "Pick nights"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)}>{l}</button>)}
            </div>
            {mode === "pick" && (
                <div role="group" aria-label="Pick the nights to give" className="bp-cal">
                    {Array.from({ length: NIGHTS }, (_, i) => i + 1).map((n) => <button key={n} type="button" aria-pressed={days.includes(n)} aria-label={`Night ${n}`} onClick={() => flip(n)} className={cx(n > 20 && "l10")}>{n}</button>)}
                </div>
            )}
            <a href={nights ? giveHref(summary, { nights: mode, days: mode === "pick" ? days : undefined }) : undefined} aria-disabled={!nights} className="bp-cta">{nights ? `Give on ${nights} ${nights === 1 ? "night" : "nights"}` : "Pick at least one night"}</a>
        </div>
    );
};
const Banner = ({ p, start }: { p: Phase; start: string }) => {
    const body = p.kind === "before" ? { tag: "Ramadan 1448", big: <>{p.days} <span>days to go</span></>, sub: `Starts ${longDate(start)}. Pledge your Zakat early.` }
        : p.kind === "during" ? { tag: p.last10 ? "The last ten nights" : "Ramadan Mubarak", big: <>Night {p.night} <span>of 30</span></>, sub: p.last10 ? "Seek Laylat al-Qadr: a gift on any of the last ten nights." : "Every gift tonight lands on the live board." }
            : p.kind === "eid" ? { tag: "Eid al-Fitr", big: <>Eid <span>Mubarak</span></>, sub: "Thank you for a month of giving. Zakat al-Fitr is open until Eid prayer." }
                : { tag: "Ramadan has ended", big: <>Thank <span>you</span></>, sub: "Our appeal is closed for this year. You can still give to our year-round causes." };
    return (
        <section aria-label="Ramadan" className="bp-banner">
            <span className="bp-pill">{body.tag}</span>
            <p className="bp-banner-big">{body.big}</p>
            {p.kind === "during" && <div className="bp-nights" aria-hidden="true">{Array.from({ length: NIGHTS }, (_, i) => <i key={i} className={cx(i < p.night && "on", i >= 20 && "l10")} />)}</div>}
            <p className="bp-banner-sub">{body.sub}</p>
        </section>
    );
};
