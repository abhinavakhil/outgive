/**
 * Impact reports: each donor's own page (/impact/<token>) showing what their gifts became, using the costs the charity sets here.
 * The team previews any donor's report, opens or copies their personal link, and edits the costs; viewers read.
 */
import { type FormEvent, useEffect, useState } from "react";
import { ArrowSquareOut, Copy, Plus, Trash } from "@phosphor-icons/react";
import { useApp } from "@/shared/lib/app-context";
import { cx } from "@/shared/utils/cx";
import { Card, Empty } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import { CITY, useJourneyStore } from "../journeys/data";
import type { Preview } from "../journeys/model";
import { type Unit, impactLines, money } from "./model";
import "../journeys/journeys.css";

const SEGMENT = { first_time: "First Ramadan", returning: "Returning", lapsed: "Lapsed", other: "Earlier donor" } as const;

export const Impact = () => {
    const ws = useWorkspace(), { toast } = useApp();
    const store = useJourneyStore();
    const can = ws.role !== "viewer";
    const [sel, setSel] = useState("");
    const [p, setP] = useState<Preview | null>(null);
    const donors = store.donors.filter((d) => d.season_cents > 0);
    const key = sel || donors[0]?.key || "";
    useEffect(() => { if (!key || store.state !== "ready") return; let off = false; store.preview(key).then((x) => !off && setP(x), () => !off && setP(null)); return () => { off = true; }; }, [key, store.state, store.units]); // eslint-disable-line react-hooks/exhaustive-deps

    if (store.state === "loading") return <div className="eg-skeleton tall" aria-busy="true"><span className="eg-sr">Loading impact reports</span></div>;
    if (store.state === "error") return <Card title="Impact reports"><Empty>Impact reports could not be loaded: {store.error}</Empty></Card>;
    const link = async () => `${location.origin}/impact/${await store.reportLink(key)}`;
    const lines = p ? impactLines(p.funds, store.units) : [], first = p?.full_name?.split(" ")[0] ?? "";

    return (
        <div className="eg-jr">
            <header className="eg-jr-head">
                <div>
                    <h1>A report for every donor</h1>
                    <p className="eg-muted">Each donor gets their own page: what they gave this Ramadan, and what it became, using the costs your charity sets below. It goes out with the Day 14 email.</p>
                </div>
            </header>

            <div className="eg-jr-split rev">
                <Card title="Donors" action={<span className="eg-chip">{donors.length.toLocaleString("en-US")}</span>}>
                    {donors.length ? <ul className="eg-jr-donors">{donors.slice(0, 200).map((d) => (
                        <li key={d.key}><button type="button" aria-pressed={d.key === key} className={cx(d.key === key && "on")} onClick={() => setSel(d.key)}>
                            <span><b>{d.donor_name}</b><small>{SEGMENT[d.segment]}{CITY[d.donor_name] && store.sample ? ` · ${CITY[d.donor_name]}` : ""}</small></span>
                            <span className="n">{ws.money(d.season_cents / 100)}</span>
                        </button></li>
                    ))}</ul> : <Empty>No gifts this Ramadan yet. Each donor's report appears here after their first gift.</Empty>}
                </Card>

                <div className="eg-jr-stack">
                    {p && <section className="eg-jr-report" aria-label={`${p.full_name}'s report`}>
                        <p className="eg-jr-kicker"><span aria-hidden="true" />{p.season} · {ws.org.name}</p>
                        <h2>{first ? `${first}, your` : "Your"} giving <span className="eg-jr-sc">did this</span></h2>
                        <p>{money(p.season_cents, p.currency)} across {lines.length} {lines.length === 1 ? "fund" : "funds"} this Ramadan</p>
                        <ul>{lines.filter((l) => l.count).map((l) => <li key={l.fund}><small>{l.fund} · {money(l.cents, p.currency)}</small><b>{l.count.toLocaleString("en-US")}</b><span>{l.label}</span></li>)}</ul>
                        {lines.some((l) => l.note) && <p className="eg-jr-fine">{lines.find((l) => l.note)!.note}</p>}
                    </section>}
                    {key && <div className="eg-jr-actions">
                        <button type="button" className="eg-btn white sm" onClick={async () => { const w = window.open("", "_blank"); const u = await link(); if (w) w.location.href = u; else location.href = u; }}><ArrowSquareOut size={16} aria-hidden="true" />Open personal page</button>
                        <button type="button" className="eg-btn white sm" onClick={async () => { try { await navigator.clipboard.writeText(await link()); toast("Personal link copied"); } catch { toast("Could not copy the link"); } }}><Copy size={16} aria-hidden="true" />Copy personal link</button>
                    </div>}
                    <Costs units={store.units} can={can} onSave={async (u) => { try { await store.saveUnits(u); toast("Impact costs saved"); } catch (e) { toast((e as Error).message); } }} />
                    {store.sample && <p className="eg-muted eg-jr-foot">Sample donors. In the demo every personal page shows the same sample report.</p>}
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------- the charity's impact costs
const Costs = ({ units, can, onSave }: { units: Unit[]; can: boolean; onSave: (u: Unit[]) => Promise<void> }) => {
    const [rows, setRows] = useState(units);
    useEffect(() => setRows(units), [units]);
    const dirty = JSON.stringify(rows) !== JSON.stringify(units);
    const set = (i: number, p: Partial<Unit>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
    const submit = (e: FormEvent) => { e.preventDefault(); void onSave(rows.map(({ fund, unit_cents, label, label_one, note }) => ({ fund: fund.trim(), unit_cents, label: label.trim(), label_one: label_one ?? "", note: note ?? "" }))); };
    return (
        <Card title="Impact costs">
            <p className="eg-muted">What one thing costs your charity to deliver. Each report divides a donor's gifts to a fund by it and rounds down.</p>
            <form onSubmit={submit}>
                <table className="eg-jr-costs">
                    <thead><tr><th scope="col">Fund</th><th scope="col" className="n">Cost of one ($)</th><th scope="col">Becomes</th><th scope="col"><span className="eg-sr">Remove</span></th></tr></thead>
                    <tbody>{rows.map((u, i) => (
                        <tr key={i}>
                            <td><input aria-label="Fund" value={u.fund} required maxLength={60} disabled={!can} onChange={(e) => set(i, { fund: e.target.value })} /></td>
                            <td className="n"><input aria-label={`Cost of one, ${u.fund}`} inputMode="decimal" required pattern="[0-9]+(\.[0-9]{1,2})?" value={u.unit_cents / 100} disabled={!can}
                                onChange={(e) => set(i, { unit_cents: Math.max(1, Math.round(Number(e.target.value) * 100) || 0) })} /></td>
                            <td><input aria-label={`What ${u.fund} becomes`} value={u.label} required maxLength={80} disabled={!can} onChange={(e) => set(i, { label: e.target.value })} /></td>
                            <td>{can && <button type="button" className="eg-icon-btn sm" aria-label={`Remove ${u.fund}`} onClick={() => setRows((r) => r.filter((_, k) => k !== i))}><Trash size={16} aria-hidden="true" /></button>}</td>
                        </tr>
                    ))}</tbody>
                </table>
                {can && <div className="eg-jr-actions">
                    <button type="button" className="eg-btn white sm" onClick={() => setRows((r) => [...r, { fund: "", unit_cents: 1000, label: "", label_one: "", note: "" }])}><Plus size={16} aria-hidden="true" />Add a fund</button>
                    {dirty && <><button type="button" className="eg-btn white sm" onClick={() => setRows(units)}>Discard</button><button className="eg-btn black sm">Save costs</button></>}
                </div>}
            </form>
        </Card>
    );
};
