/**
 * /leaderboard/v2: the board as a game stage. A light stage in the /v2 landing colours, an orange/sage/lilac podium,
 * the claim bar under it, then the ranks as dark tiles beside a live feed. Always light, whatever the site theme.
 * The data, claim dialog and branding panel stay in Leaderboard.tsx.
 */
import type { ReactNode } from "react";
import { ArrowRight, Brush03, Minus, Plus, Settings01, Tv01 } from "@untitledui/icons";
import { BrandLogo } from "@/shared/ui";
import type { Go } from "@/shared/lib/app-context";
import { BOARDS, type BoardKey, KINDS, REGIONS } from "@/features/leaderboard/model";
import { CURRENCIES, type Supporter } from "@/shared/domain/model";
import { initials } from "@/shared/lib/format";
import { cx } from "@/shared/utils/cx";

type Row = Supporter & { rank: number };
export type BoardV2Props = {
    shown: Row[]; boardSize: number; boardTitle: string; period: BoardKey; setPeriod: (k: BoardKey) => void;
    kind: string; setKind: (k: string) => void; region: string; setRegion: (r: string) => void; currency: string; setCurrency: (c: string) => void;
    val: (o: Supporter) => string; money: (n: number) => string; fmt: (n: number) => string; gap: (o: Row) => number; canClaim: boolean; claimRow: (o: Row) => void;
    heroUsd: number; setBump: (f: (b: number) => number) => void; heroName: string; setHeroName: (s: string) => void; heroKind: string; setHeroKind: (s: string) => void; onHeroClaim: () => void;
    you: string | null; todayTop: Supporter[]; activity: { who: string; usd: number; at: number }[]; todayTotal: string; raised: string;
    brandName: string; tagline: string; nextUp: { text: ReactNode; cta: string; run: () => void } | null;
    go: (v: Go) => void; member: boolean; openBranding: () => void; footNote: string;
};

const ago = (m: number) => (m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`);
const one = (kind: string) => ({ Individuals: "Individual", Teams: "Team", Companies: "Company", Schools: "School" })[kind] ?? kind;
const ICON = "grid size-9 cursor-pointer place-items-center rounded-full text-[#202020]/55 transition-colors hover:bg-black/5 hover:text-[#202020]";
const PLACE = ["1st", "2nd", "3rd"];
/** 2nd, 1st, 3rd: the stand order. */
const stand = (rows: Row[]) => { const t = rows.slice(0, 3); return t.length === 3 ? [t[1], t[0], t[2]] : t; };

export const BoardV2 = (c: BoardV2Props) => {
    const label = BOARDS.find((b) => b.key === c.period)?.label ?? "";
    return (
        <div className="lbg">
            <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-8">
                <header className="flex items-center justify-between gap-4 py-5">
                    <div className="flex min-w-0 items-center gap-3"><BrandLogo /><span className="lbg-live max-sm:hidden"><span className="lbg-dot" />Live · {c.boardSize} on the board</span></div>
                    <div className="flex items-center gap-1 sm:gap-5">
                        <nav aria-label="Main" className="hidden items-center gap-5 text-[14px] text-[#202020]/60 sm:flex">{([["dashboard", "Dashboard"], ["about", "About"], ["rules", "Rules"]] as const).map(([n, l]) => <button key={n} type="button" onClick={() => c.go({ name: n })} className="cursor-pointer transition-colors hover:text-[#202020]">{l}</button>)}</nav>
                        <span className="flex items-center">
                            <button type="button" aria-label="Live screen" title="Live screen" onClick={() => c.go({ name: "live" })} className={ICON}><Tv01 className="size-4" /></button>
                            {c.member && <button type="button" aria-label="Organiser dashboard" title="Organiser dashboard" onClick={() => c.go({ name: "admin" })} className={ICON}><Settings01 className="size-4" /></button>}
                            <button type="button" aria-label="Your branding" title="Your branding" onClick={c.openBranding} className={ICON}><Brush03 className="size-4" /></button>
                        </span>
                    </div>
                </header>

                {/* ---------- The stage ---------- */}
                <section className="pt-8 text-center sm:pt-12">
                    <p className="text-[14px] text-[#202020]/55">{c.brandName} · {c.tagline}</p>
                    <h1 className="lbg-title mt-3">{label} champions</h1>
                    <div role="group" aria-label="Board" className="lbg-seg no-scrollbar mx-auto mt-6">{BOARDS.map((b) => <button key={b.key} type="button" aria-pressed={c.period === b.key} onClick={() => c.setPeriod(b.key)}>{b.label}</button>)}</div>

                    {c.shown.length === 0 ? <p className="py-24 text-[#202020]/55">Nobody here yet. Be the first to claim a rank.</p> : (
                        <ol className="mx-auto mt-14 flex max-w-[760px] items-end justify-center gap-2 sm:gap-4">
                            {stand(c.shown).map((o) => (
                                <li key={o.id} id={`row-${o.id}`} className={cx("lbg-spot", `lbg-m${o.rank}`, c.you === o.id && "lbg-you")}>
                                    <span className="lbg-ring"><span>{initials(o.name)}</span></span>
                                    <span className="mt-3 block w-full truncate px-1 text-[13px] font-semibold text-[#202020] sm:text-[15px]">{o.name}</span>
                                    <span className="lbg-prize">{c.val(o)}</span>
                                    <div className="lbg-plinth">
                                        <span className="sr-only">{PLACE[o.rank - 1]} place</span><span aria-hidden="true">{o.rank}</span>
                                        {c.canClaim && <button type="button" onClick={() => c.claimRow(o)} className="lbg-pass">{o.rank === 1 ? "Take #1" : `Pass for ${c.money(o.total + 1)}`}</button>}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>

                {/* ---------- Claim bar ---------- */}
                <form className="lbg-bar" onSubmit={(e) => { e.preventDefault(); c.onHeroClaim(); }}>
                    <div className="flex items-center gap-3">
                        <div className="text-left"><span className="block text-[12px] text-[#202020]/55">Take #1 for</span><span className="lbg-take tabular-nums">{c.money(c.heroUsd)}</span></div>
                        <span className="flex gap-1.5"><button type="button" aria-label="Lower amount" onClick={() => c.setBump((b) => Math.max(1, b - 100))} className="lbg-step"><Minus className="size-4" /></button><button type="button" aria-label="Raise amount" onClick={() => c.setBump((b) => (b === 1 ? 100 : b + 100))} className="lbg-step"><Plus className="size-4" /></button></span>
                    </div>
                    <input aria-label="Your name or team" placeholder="Your name or team" value={c.heroName} onChange={(e) => c.setHeroName(e.target.value)} className="lbg-input min-w-0 lg:flex-1" />
                    <select aria-label="Giving as" value={c.heroKind} onChange={(e) => c.setHeroKind(e.target.value)} className="lbg-input lbg-select lg:w-40"><option value="">Giving as</option>{KINDS.map((k) => <option key={k} value={k}>{one(k)}</option>)}</select>
                    <button type="submit" className="lbg-cta">Claim #1<ArrowRight className="size-4" /></button>
                </form>
                {c.nextUp && <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-[14px] text-[#202020]/60"><span>{c.nextUp.text}</span>{c.nextUp.cta && <button type="button" onClick={c.nextUp.run} className="cursor-pointer font-semibold text-[#c0541f] hover:underline">{c.nextUp.cta}</button>}</p>}

                {/* ---------- Ranks + live feed ---------- */}
                <div className="grid items-start gap-6 pt-16 pb-16 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <main className="min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div role="group" aria-label="Who" className="no-scrollbar flex gap-1.5 overflow-x-auto">{["All", ...KINDS].map((k) => <button key={k} type="button" aria-pressed={c.kind === k} onClick={() => c.setKind(k)} className="lbg-chip">{k}</button>)}</div>
                            <div className="flex gap-2"><select aria-label="Region" value={c.region} onChange={(e) => c.setRegion(e.target.value)} className="lbg-mini">{["Worldwide", ...REGIONS].map((r) => <option key={r}>{r}</option>)}</select><select aria-label="Currency" value={c.currency} onChange={(e) => c.setCurrency(e.target.value)} className="lbg-mini">{Object.keys(CURRENCIES).map((r) => <option key={r}>{r}</option>)}</select></div>
                        </div>
                        <ol className="mt-4 flex flex-col gap-1.5">
                            {c.shown.slice(3).map((o) => (
                                <li key={o.id} id={`row-${o.id}`} className={cx("lbg-row group", c.you === o.id && "lbg-you")}>
                                    <span className="w-7 shrink-0 text-center text-[14px] font-bold text-[#202020]/45 tabular-nums">{o.rank}</span>
                                    <span className="lbg-avatar">{initials(o.name)}</span>
                                    <div className="min-w-0 flex-1"><p className="flex items-center gap-2 truncate text-[15px] font-semibold text-[#202020]">{o.name}{c.you === o.id && <span className="lbg-tag">You</span>}</p><p className="truncate text-[12px] text-[#202020]/45">{one(o.kind)} · {o.country}</p></div>
                                    <span className="lbg-gap hidden md:inline-flex">{c.fmt(c.gap(o))} to #{o.rank - 1}</span>
                                    <span className="shrink-0 text-[15px] font-bold text-[#202020] tabular-nums">{c.val(o)}</span>
                                    {c.canClaim && <button type="button" onClick={() => c.claimRow(o)} aria-label={`Claim #${o.rank} for ${c.money(o.total + 1)}`} className="lbg-claim max-sm:hidden">Claim</button>}
                                </li>
                            ))}
                        </ol>
                    </main>
                    <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
                        <section className="lbg-panel">
                            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#202020]"><span className="lbg-dot" />Live gifts</h2>
                            <ul className="mt-4 flex flex-col gap-3 text-[14px]">{c.activity.slice(0, 5).map((a, i) => <li key={i} className="lbg-feed flex items-center gap-2.5" style={{ animationDelay: `${i * 70}ms` }}><span className="lbg-avatar lbg-avatar-sm">{initials(a.who)}</span><span className="min-w-0 flex-1 truncate text-[#202020]/85">{a.who}</span><b className="font-bold text-[#c0541f] tabular-nums">+{c.money(a.usd)}</b><span className="w-8 text-right text-[12px] text-[#202020]/40">{ago(Math.round((Date.now() - a.at) / 60000))}</span></li>)}</ul>
                        </section>
                        <section className="lbg-panel">
                            <h2 className="flex items-center justify-between text-[14px] font-semibold text-[#202020]">Top today<button type="button" onClick={() => c.setPeriod("today")} className="cursor-pointer text-[12px] font-medium text-[#202020]/50 hover:text-[#202020]">See all</button></h2>
                            <ol className="mt-4 flex flex-col gap-3 text-[14px]">{c.todayTop.map((o, i) => <li key={o.id} className="flex items-center gap-2.5"><span className={cx("lbg-medal", i < 3 && `lbg-medal-${i + 1}`)}>{i + 1}</span><span className="min-w-0 flex-1 truncate text-[#202020]/85">{o.name}</span><b className="font-bold text-[#202020] tabular-nums">{c.money(o.today)}</b></li>)}</ol>
                        </section>
                        <section className="lbg-panel lbg-panel-glow">
                            <h2 className="text-[18px] leading-tight font-bold text-[#202020]">Raise for {c.brandName}</h2>
                            <p className="mt-2 text-[13px] leading-relaxed text-[#202020]/60">Start a page and every gift to it counts toward your rank.</p>
                            <button type="button" onClick={() => c.go({ name: "create" })} className="lbg-cta mt-4 w-full justify-center">Start fundraising</button>
                            <button type="button" onClick={c.openBranding} className="mt-3 w-full cursor-pointer text-center text-[12px] text-[#202020]/50 hover:text-[#202020]">Run a board for your charity</button>
                        </section>
                    </aside>
                </div>

                <footer className="flex flex-col gap-4 border-t border-[#ececec] py-8 text-[13px] text-[#202020]/45 sm:flex-row sm:items-center sm:justify-between">
                    <p><b className="text-[#202020]/80">{c.boardSize}</b> supporters have given <b className="text-[#202020]/80">{c.raised}</b> to {c.brandName}. {c.footNote}</p>
                    <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">{([["rules", "Rules"], ["faq", "FAQ"], ["about", "About"], ["terms", "Terms"], ["privacy", "Privacy"]] as const).map(([n, l]) => <button key={n} type="button" onClick={() => c.go({ name: n })} className="cursor-pointer hover:text-[#202020]">{l}</button>)}</nav>
                </footer>
            </div>
        </div>
    );
};
