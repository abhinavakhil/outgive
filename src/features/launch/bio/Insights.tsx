/**
 * The appeal's insights: key figures, raised over Ramadan, gifts per night, causes ranked and top supporters.
 * Shown in the editor's Insights tab and on the live page in organiser view. One hue per chart, the page colour.
 */
import { type ReactNode, useState } from "react";
import { cx } from "@/shared/utils/cx";
import { type BioPage, PER_NIGHT, SUPPORTERS, money } from "./model";
import "./insights.css";

const Box = ({ title, children }: { title: string; children: ReactNode }) => <section className="bi-box"><h3>{title}</h3>{children}</section>;

export const Insights = ({ page }: { page: BioPage }) => {
    const [hover, setHover] = useState<{ chart: string; i: number } | null>(null);
    const raised = page.campaigns.reduce((n, x) => n + x.raised, 0) + page.causes.reduce((n, x) => n + x.raised, 0);
    const cum = PER_NIGHT.reduce<number[]>((a, v) => [...a, (a.at(-1) ?? 0) + v], []);
    const maxN = Math.max(...PER_NIGHT), maxC = cum.at(-1)!;
    const W = 320, H = 120;
    const pts = cum.map((v, i) => [(i / (cum.length - 1)) * W, H - (v / maxC) * (H - 8)] as const);
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const causes = [...page.campaigns, ...page.causes].sort((a, b) => b.raised - a.raised);
    const best = PER_NIGHT.indexOf(maxN);
    return (
        <div className="bi" style={{ ["--c" as string]: page.theme.colour }}>
            <dl className="bi-kpis">{[[money(raised), "raised"], ["3,412", "supporters"], ["£75", "average gift"], [money(raised * 0.18), "Gift Aid to claim"]].map(([v, k]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>

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
                        {PER_NIGHT.map((v, i) => <span key={i} className={cx(i >= 20 && "l10", hover?.chart === "night" && hover.i === i && "hot")} style={{ height: `${(v / maxN) * 100}%` }} onMouseEnter={() => setHover({ chart: "night", i })} />)}
                    </div>
                    <div className="bi-axis-row"><span>Night 1</span><span>Last ten nights</span><span>30</span></div>
                    {hover?.chart === "night" && <figcaption className="bi-tip" style={{ left: `${((hover.i + 0.5) / 30) * 100}%` }}>Night {hover.i + 1}<b>{money(PER_NIGHT[hover.i])}</b></figcaption>}
                </figure>
                <p className="bi-help">Busiest night: <b>night {best + 1}</b>, {money(maxN)}.</p>
            </Box>

            <Box title="Campaigns and causes">
                <ul className="bi-rank">{causes.map((c) => <li key={c.id}><span className="bi-rank-name">{c.title}</span><span className="bi-rank-bar"><i style={{ width: `${(c.raised / causes[0].raised) * 100}%` }} /></span><b>{money(c.raised)}</b></li>)}</ul>
            </Box>

            <Box title="Top supporters">
                <ol className="bi-sup">{SUPPORTERS.slice(0, 5).map(([n, v, k], i) => <li key={n}><span>{i + 1}</span><span className="flex-1">{n}<small>{k}</small></span><b>{money(v)}</b></li>)}</ol>
            </Box>
            <p className="bi-help">Sample figures. Real donations appear here once payments are connected.</p>
        </div>
    );
};
