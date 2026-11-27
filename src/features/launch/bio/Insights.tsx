/**
 * The appeal's insights: key figures, raised over Ramadan, gifts per night, causes ranked and top supporters.
 * Shown in the editor's Insights tab and on the live page in organiser view. One hue per chart, the page colour.
 */
import { type ReactNode, useState } from "react";
import { cx } from "@/shared/utils/cx";
import { type BioPage, PER_NIGHT, SUPPORTERS, money } from "./model";

/** org_insights: the appeal's real numbers, for its team. Amounts in pence; by_day is keyed by UK date (YYYY-MM-DD). */
export type InsightStats = { raised_cents: number; gifts: number; donors: number; gift_aid_cents: number; tips_cents: number; by_day: Record<string, number>; by_cause: Record<string, number>; by_fund: Record<string, number>; top: { name: string; amount_cents: number }[] };

/** Pounds given on each of the 30 nights, from gifts by date and the date of night 1. */
export const nightsFrom = (byDay: Record<string, number>, startIso: string) =>
    Array.from({ length: 30 }, (_, i) => (byDay[new Date(Date.parse(startIso) + i * 86400000).toISOString().slice(0, 10)] ?? 0) / 100);
import "./insights.css";

const Box = ({ title, children }: { title: string; children: ReactNode }) => <section className="bi-box"><h3>{title}</h3>{children}</section>;

export const Insights = ({ page, live }: { page: BioPage; live?: InsightStats | null }) => {
    const [hover, setHover] = useState<{ chart: string; i: number } | null>(null);
    const raised = live ? live.raised_cents / 100 : page.campaigns.reduce((n, x) => n + x.raised, 0) + page.causes.reduce((n, x) => n + x.raised, 0);
    const PER = live ? nightsFrom(live.by_day, page.ramadanStart) : PER_NIGHT;
    const top: [string, number, string][] = live ? live.top.map((t) => [t.name, t.amount_cents / 100, ""]) : SUPPORTERS.slice(0, 5);
    const kpis = live
        ? [[money(raised), "raised"], [live.donors.toLocaleString("en-GB"), "supporters"], [live.gifts ? money(raised / live.gifts) : "–", "average gift"], [money(live.gift_aid_cents / 100), "Gift Aid to claim"]]
        : [[money(raised), "raised"], ["3,412", "supporters"], ["£75", "average gift"], [money(raised * 0.18), "Gift Aid to claim"]];
    const cum = PER.reduce<number[]>((a, v) => [...a, (a.at(-1) ?? 0) + v], []);
    const maxN = Math.max(1, ...PER), maxC = Math.max(1, cum.at(-1)!);
    const W = 320, H = 120;
    const pts = cum.map((v, i) => [(i / (cum.length - 1)) * W, H - (v / maxC) * (H - 8)] as const);
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const causes = [...page.campaigns, ...page.causes].sort((a, b) => b.raised - a.raised);
    const best = PER.indexOf(Math.max(...PER));
    return (
        <div className="bi" style={{ ["--c" as string]: page.theme.colour }}>
            <dl className="bi-kpis">{kpis.map(([v, k]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>

            <Box title="Raised over Ramadan">
                <figure className="bi-chart" onMouseLeave={() => setHover(null)}>
                    <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`Raised over Ramadan: ${money(maxC)} by night 30`}>
                        {[0.5, 1].map((f) => <line key={f} x1="0" x2={W} y1={H - f * (H - 8)} y2={H - f * (H - 8)} className="bi-grid" />)}
                        <path d={`${line} L${W} ${H} L0 ${H}Z`} className="bi-area" />
                        <path d={line} className="bi-line" />
                        {pts.map(([x], i) => <rect key={i} x={x - W / 60} y="0" width={W / 30} height={H} fill="transparent" onMouseEnter={() => setHover({ chart: "cum", i })} />)}
                        {hover?.chart === "cum" && <><line x1={pts[hover.i][0]} x2={pts[hover.i][0]} y1="0" y2={H} className="bi-cross" /><circle cx={pts[hover.i][0]} cy={pts[hover.i][1]} r="4.5" className="bi-dot" /></>}
                        <text x="0" y={H + 15} className="bi-axis">Night 1</text><text x={W} y={H + 15} textAnchor="end" className="bi-axis">Night 30</text>
                    </svg>
                    {hover?.chart === "cum" && <figcaption className="bi-tip" style={{ left: `${(pts[hover.i][0] / W) * 100}%` }}>Night {hover.i + 1}<b>{money(cum[hover.i])}</b></figcaption>}
                </figure>
            </Box>

            <Box title="Gifts per night">
                <figure className="bi-chart" onMouseLeave={() => setHover(null)}>
                    <div className="bi-bars" role="img" aria-label={`Gifts per night; the busiest was night ${best + 1} with ${money(maxN)}`}>
                        {PER.map((v, i) => <span key={i} className={cx(i >= 20 && "l10", hover?.chart === "night" && hover.i === i && "hot")} style={{ height: `${(v / maxN) * 100}%` }} onMouseEnter={() => setHover({ chart: "night", i })} />)}
                    </div>
                    <div className="bi-axis-row"><span>Night 1</span><span>Last ten nights</span><span>30</span></div>
                    {hover?.chart === "night" && <figcaption className="bi-tip" style={{ left: `${((hover.i + 0.5) / 30) * 100}%` }}>Night {hover.i + 1}<b>{money(PER[hover.i])}</b></figcaption>}
                </figure>
                {PER.some((v) => v > 0) ? <p className="bi-help">Busiest night: <b>night {best + 1}</b>, {money(PER[best])}.</p> : <p className="bi-help">No gifts on Ramadan nights yet.</p>}
            </Box>

            <Box title="Campaigns and causes">
                <ul className="bi-rank">{causes.map((c) => <li key={c.id}><span className="bi-rank-name">{c.title}</span><span className="bi-rank-bar"><i style={{ width: `${(c.raised / Math.max(1, causes[0].raised)) * 100}%` }} /></span><b>{money(c.raised)}</b></li>)}</ul>
            </Box>

            <Box title="Top supporters">
                {top.length ? <ol className="bi-sup">{top.map(([n, v, k], i) => <li key={n + i}><span>{i + 1}</span><span className="flex-1">{n}{k && <small>{k}</small>}</span><b>{money(v)}</b></li>)}</ol> : <p className="bi-help">No gifts yet.</p>}
            </Box>
            {live && Object.keys(live.by_fund).length > 0 && (
                <Box title="By type of giving">
                    <ul className="bi-rank">{Object.entries(live.by_fund).sort((a, b) => b[1] - a[1]).map(([f, c], _i, all) => <li key={f}><span className="bi-rank-name">{f}</span><span className="bi-rank-bar"><i style={{ width: `${(c / all[0][1]) * 100}%` }} /></span><b>{money(c / 100)}</b></li>)}</ul>
                    <p className="bi-help">Zakat is a restricted fund: keep it apart in your accounts.</p>
                </Box>
            )}
            <p className="bi-help">{live ? "Live figures from paid gifts." : "Sample figures. Real donations appear here once payments are connected."}</p>
        </div>
    );
};
