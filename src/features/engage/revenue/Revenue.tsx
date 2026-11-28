/**
 * Revenue tracking (/engage/revenue): where every dollar came from. Five tabs over the revenue_* SQL dashboards (./hooks):
 * Tonight, Campaign, Sources, Funnel and Add-ons, one filter bar for all of them, CSV export and import, and the settings for the
 * morning report, ad spend and the opt-in GA4 / Meta event. Viewers read; editors export and import; admins change settings.
 * In the demo (ws.sample) every figure is the prototype's sample (./sample) and nothing is saved.
 */
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowCounterClockwise, ChartBar, DownloadSimple, Funnel as FunnelIcon, GearSix, Moon, PuzzlePiece, ShareNetwork, UploadSimple } from "@phosphor-icons/react";
import { useApp } from "@/shared/lib/app-context";
import { cx } from "@/shared/utils/cx";
import { Card, Empty, NightsBar, PALETTE, Pie, StatStrip, Tabs, Tag } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import type { Load } from "../overview/data";
import { type ImportBatch, type ImportResult, type RevenueSettings, exportCsv, getSettings, importGifts, listImports, saveSettings, undoImport, useAddons, useCampaign, useFunnel, useSources, useTonight } from "./hooks";
import { type Filters, type FunnelGroup, type SourceGroup, STEPS, addonStats, bestConverter, biggestDrop, campaignStats, funnelStats, nightSeries, nightSplit, perMinute, rate, sourceStats, toCsv } from "./model";
import { type Parsed, parseImport } from "./importer";
import { SAMPLE_SOURCES } from "./sample";
import "./revenue.css";

type TabId = "tonight" | "campaign" | "sources" | "funnel" | "addons";
const pct = (x: number, d = 0) => `${(x * 100).toFixed(x > 0 && x < 0.1 && !d ? 1 : d)}%`;
const n = (x: number) => x.toLocaleString("en-US");
const ADDON_LABEL: Record<string, string> = { zakat_al_fitr: "Zakat al-Fitr per person", fidya: "Fidya by days missed", last_ten: "Last-ten-nights schedule", monthly: "Monthly upgrade", dedication: "Dedication", roundup: "Round up to close a goal" };
const STEP_LABEL: Record<(typeof STEPS)[number], string> = { visit: "Visited", checkout_started: "Started checkout", amount_chosen: "Chose an amount", payment_attempted: "Tried to pay", paid: "Paid" };

/** Loading, empty or ready. */
const Show = <T,>({ load, children }: { load: Load<T>; children: (d: T) => ReactNode }) =>
    load.state === "loading" ? <div className="eg-skeleton" aria-busy="true"><span className="eg-sr">Loading</span></div>
    : load.state === "empty" ? <Empty href={load.href} cta={load.cta}>{load.why}</Empty>
    : <>{children(load.data)}</>;

/** A table whose middle column is a bar: the table is the chart's text equivalent. */
/** Bar colours: the palette without orange, which is kept for the odd-night tick. `optional` cell columns hide on phones. */
const TONES = [PALETTE[0], PALETTE[1], PALETTE[2], PALETTE[3]];
const BarTable = ({ caption, head, rows, max, optional = [] }: { caption: string; head: string[]; rows: { key: string; label: ReactNode; value: number; cells: ReactNode[]; tone?: number; flag?: ReactNode }[]; max?: number; optional?: number[] }) => {
    const top = max ?? Math.max(1, ...rows.map((r) => r.value));
    return (
        <div className="eg-rv-scroll">
            <table className="eg-rv-table">
                <caption className="eg-sr">{caption}</caption>
                <thead><tr><th scope="col">{head[0]}</th><th scope="col" className="bar"><span className="eg-sr">Bar</span></th>{head.slice(1).map((h, j) => <th key={h} scope="col" className={cx("n", optional.includes(j) && "opt")}>{h}</th>)}</tr></thead>
                <tbody>{rows.map((r, i) => (
                    <tr key={r.key}>
                        <th scope="row"><span>{r.label}</span>{r.flag}</th>
                        <td className="bar"><span className="eg-rv-bar" aria-hidden="true"><i style={{ width: `${Math.max(1.5, (r.value / top) * 100)}%`, background: TONES[(r.tone ?? i) % TONES.length] }} /></span></td>
                        {r.cells.map((c, j) => <td key={j} className={cx("n", optional.includes(j) && "opt")}>{c}</td>)}
                    </tr>
                ))}</tbody>
            </table>
        </div>
    );
};

/** Thirty columns: first twenty lilac, last ten sage, odd nights of the last ten in ink. The hidden list is the text equivalent. */
const NightColumns = ({ nights, format }: { nights: number[]; format: (c: number) => string }) => {
    const max = Math.max(1, ...nights), best = nights.indexOf(Math.max(...nights));
    const W = 1000, H = 200, bw = W / 30;
    return (
        <figure className="eg-rv-cols">
            <svg viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label={`Raised each night. The biggest was Night ${best + 1}, ${format(nights[best])}.`}>
                {[0.5, 1].map((g) => <line key={g} x1="0" x2={W} y1={H - g * (H - 20)} y2={H - g * (H - 20)} stroke="#EEEEEE" />)}
                {nights.map((v, i) => {
                    const h = Math.max(v ? 2 : 0, (v / max) * (H - 20)), odd = i >= 20 && i % 2 === 0;
                    return <rect key={i} x={i * bw + 2} y={H - h} width={bw - 4} height={h} rx="3" fill={i < 20 ? PALETTE[2] : odd ? PALETTE[1] : PALETTE[0]} />;
                })}
                {nights[best] > 0 && <text x={best * bw + bw / 2} y={H - ((nights[best] / max) * (H - 20)) - 6} textAnchor="middle" className="eg-rv-cols-val">{format(nights[best])}</text>}
                {[1, 10, 21, 27, 30].map((k) => <text key={k} x={(k - 1) * bw + bw / 2} y={H + 16} textAnchor="middle" className="eg-rv-cols-axis">{k}</text>)}
            </svg>
            <figcaption>
                <ul className="eg-rv-key"><li><i style={{ background: PALETTE[2] }} />First twenty nights</li><li><i style={{ background: PALETTE[0] }} />Last ten</li><li><i style={{ background: PALETTE[1] }} />Odd nights of the last ten</li></ul>
                <ol className="eg-sr">{nights.map((v, i) => <li key={i}>Night {i + 1}: {format(v)}</li>)}</ol>
            </figcaption>
        </figure>
    );
};

/** A segmented control (aria-pressed buttons). */
const Seg = <K extends string>({ label, value, items, onChange }: { label: string; value: K; items: [K, string][]; onChange: (k: K) => void }) => (
    <div className="eg-rv-seg" role="group" aria-label={label}>{items.map(([k, l]) => <button key={k} type="button" aria-pressed={k === value} onClick={() => onChange(k)}>{l}</button>)}</div>
);

// ---------------------------------------------------------------- dialog (native <dialog>: focus trap and Escape for free)
const Dialog = ({ title, open, onClose, children, wide }: { title: string; open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) => {
    const ref = useRef<HTMLDialogElement>(null), id = useId();
    useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
    return (
        <dialog ref={ref} className={cx("eg-rv-dialog", wide && "wide")} aria-labelledby={id} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
            {open && <><h2 id={id}>{title}</h2>{children}</>}
        </dialog>
    );
};
const Field = ({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) => <label className="eg-rv-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;

const download = (name: string, text: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

// ---------------------------------------------------------------- the screen
export const Revenue = () => {
    const ws = useWorkspace(), { db, toast } = useApp();
    const [tab, setTab] = useState<TabId>("tonight");
    const [f, setF] = useState<Filters>({});
    const [modal, setModal] = useState<"import" | "settings" | null>(null);
    const canEdit = ws.role !== "viewer", isAdmin = ws.role === "owner" || ws.role === "admin";
    const c = (cents: number) => ws.money(cents / 100);
    const sc = (cents: number) => ws.short(cents / 100);

    const doExport = async () => {
        try {
            const csv = ws.sample ? toCsv(sourceStats(SAMPLE_SOURCES).map((r) => ({ source: r.key, raised: r.cents / 100, gifts: r.gifts, donors: r.donors, visitors: r.visitors, conversion: r.conversion.toFixed(3) }))) : await exportCsv(db, ws.org.id, f);
            download(`${ws.org.slug}-gifts-${new Date().toISOString().slice(0, 10)}${ws.sample ? "-sample" : ""}.csv`, csv);
            toast(ws.sample ? "Sample: the sources table was exported; real data exports every gift" : "Export ready");
        } catch (e) { toast((e as Error).message); }
    };

    return (
        <div className="eg-rv">
            <header className="eg-rv-head">
                <div>
                    <h1>Revenue tracking</h1>
                    <p className="eg-muted">Every gift carries its source, night, fund and campaign. The data is {ws.org.name}’s; Outgive never markets to its donors.</p>
                </div>
                <div className="eg-rv-actions">
                    {isAdmin && <button type="button" className="eg-btn white" onClick={() => setModal("settings")}><GearSix size={18} aria-hidden="true" />Settings</button>}
                    {canEdit && <button type="button" className="eg-btn white" onClick={() => setModal("import")}><UploadSimple size={18} aria-hidden="true" />Import CSV</button>}
                    {canEdit && <button type="button" className="eg-btn black" onClick={doExport}><DownloadSimple size={18} aria-hidden="true" />Export CSV</button>}
                </div>
            </header>

            <FilterBar f={f} setF={setF} />

            <Tabs id="eg-rv" label="Dashboards" value={tab} onChange={setTab} items={[
                { id: "tonight", label: "Tonight", icon: <Moon size={18} aria-hidden="true" /> },
                { id: "campaign", label: "Campaign", icon: <ChartBar size={18} aria-hidden="true" /> },
                { id: "sources", label: "Sources", icon: <ShareNetwork size={18} aria-hidden="true" /> },
                { id: "funnel", label: "Funnel", icon: <FunnelIcon size={18} aria-hidden="true" /> },
                { id: "addons", label: "Add-ons", icon: <PuzzlePiece size={18} aria-hidden="true" /> },
            ]} />
            <div id="eg-rv-panel" role="tabpanel" aria-labelledby={`eg-rv-tab-${tab}`} className="eg-rv-panel">
                {tab === "tonight" && <Tonight f={f} c={c} sc={sc} />}
                {tab === "campaign" && <CampaignTab f={f} c={c} sc={sc} />}
                {tab === "sources" && <Sources f={f} c={c} sc={sc} />}
                {tab === "funnel" && <FunnelTab f={f} />}
                {tab === "addons" && <AddonsTab f={f} c={c} />}
            </div>
            {ws.sample && <p className="eg-muted eg-rv-foot">Sample figures from a made-up US charity. Filters change real data; the sample stays as it is.</p>}

            <Dialog title="Import gifts from another tool" open={modal === "import"} onClose={() => setModal(null)} wide><ImportFlow onDone={() => setModal(null)} /></Dialog>
            <Dialog title="Revenue settings" open={modal === "settings"} onClose={() => setModal(null)} wide><SettingsForm onDone={() => setModal(null)} /></Dialog>
        </div>
    );
};

type Money = { c: (cents: number) => string; sc: (cents: number) => string };

// ---------------------------------------------------------------- filters
const FilterBar = ({ f, setF }: { f: Filters; setF: (f: Filters) => void }) => {
    const camp = useCampaign(), src = useSources();
    const campaigns = camp.state === "ready" ? camp.data.by_campaign.map((x) => x.key) : [];
    const funds = camp.state === "ready" ? camp.data.by_fund.map((x) => x.key) : [];
    const channels = src.state === "ready" ? src.data.map((x) => x.key) : [];
    const set = (k: keyof Filters, v: string) => { const next = { ...f, [k]: k === "night" ? (v ? Number(v) : undefined) : v || undefined }; for (const key of Object.keys(next) as (keyof Filters)[]) if (next[key] === undefined) delete next[key]; setF(next); };
    const any = Object.keys(f).length > 0;
    const sel = (k: keyof Filters, label: string, opts: string[], all: string) => (
        <label className="eg-rv-filter"><span>{label}</span>
            <select value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value)}>
                <option value="">{all}</option>{opts.map((o) => <option key={o} value={o}>{k === "night" ? `Night ${o}` : o}</option>)}
            </select>
        </label>
    );
    return (
        <Card className="eg-rv-filters">
            <h2 className="eg-sr">Filters</h2>
            <label className="eg-rv-filter"><span>From</span><input type="date" value={f.from ?? ""} onChange={(e) => set("from", e.target.value)} /></label>
            <label className="eg-rv-filter"><span>To</span><input type="date" value={f.to ?? ""} min={f.from} onChange={(e) => set("to", e.target.value)} /></label>
            {sel("night", "Night", Array.from({ length: 30 }, (_, i) => String(i + 1)), "All nights")}
            {sel("campaign", "Campaign", campaigns, "All campaigns")}
            {sel("fund", "Fund", funds, "All funds")}
            {sel("channel", "Source", channels, "All sources")}
            <button type="button" className="eg-btn white sm eg-rv-clear" disabled={!any} onClick={() => setF({})}>Clear</button>
        </Card>
    );
};

// ---------------------------------------------------------------- Tonight
const Tonight = ({ f, c, sc }: { f: Filters } & Money) => {
    const t = useTonight(f);
    return (
        <Show load={t}>{(d) => d.night === null ? <Card><Empty>No Ramadan night yet. Tonight’s numbers start with Night 1; set the start date in Settings.</Empty></Card> : (
            <div className="eg-rv-grid">
                <Card className="eg-card-strip eg-rv-span">
                    <h2 className="eg-sr">Night {d.night}</h2>
                    <StatStrip items={[
                        { label: `Night ${d.night}`, value: sc(d.raised_cents), note: <>{d.live ? <Tag tone="forest"><span className="eg-live-dot" />Live</Tag> : "Final"} {n(d.gifts)} gifts, {n(d.donors)} donors</> },
                        { label: "Gifts a minute", value: perMinute(d).toFixed(1), note: d.live ? "Last 10 minutes" : "Last 10 minutes of the night" },
                        { label: "Pledged", value: sc(d.pledged_cents), note: d.pledges ? `${c(d.pledge_collected_cents)} paid of ${n(d.pledges)} pledges` : "No pledges this night" },
                        { label: "Match left", value: sc(d.match_remaining_cents), note: d.match_unlocked_cents ? `${c(d.match_unlocked_cents)} unlocked ${d.live ? "tonight" : "this night"}` : d.match_pots.length ? "No active pot" : "No match pot" },
                    ]} />
                </Card>
                <Card title="Top tables and screens" action={<span className="eg-chip">QR codes</span>}>
                    {d.top_tables.length ? <BarTable caption="Raised by QR code tonight" head={["QR code", "Raised", "Gifts"]}
                        rows={d.top_tables.map((x) => ({ key: x.qr, label: x.qr.replace(/-/g, " ").replace(/^./, (s) => s.toUpperCase()), value: x.cents, cells: [c(x.cents), n(x.gifts)], tone: 2 }))} />
                        : <Empty>No QR gifts this night. Put a code on each table or screen (?qr=table-6) to see which one raises most.</Empty>}
                </Card>
                <div className="eg-rv-stack">
                    <Card title="Pledged against paid">
                        {d.pledges ? <>
                            <p className="eg-rv-total"><b>{c(d.pledge_collected_cents)}</b> paid of {c(d.pledged_cents)} pledged</p>
                            <span className="eg-rv-meter" role="img" aria-label={`${pct(rate(d.pledge_collected_cents, d.pledged_cents))} of pledges paid`}><i style={{ width: pct(rate(d.pledge_collected_cents, d.pledged_cents)) }} /></span>
                            <p className="eg-muted eg-rv-small">Plus {c(d.raised_cents)} given and paid on the night. <a href="/engage/pledges">Pledge recovery</a></p>
                        </> : <Empty href="/engage/pledges" cta="Pledge recovery">No pledges were made this night.</Empty>}
                    </Card>
                    <Card title="Match pots">
                        {d.match_pots.length ? <ul className="eg-rv-pots">{d.match_pots.map((p) => (
                            <li key={p.sponsor}>
                                <p><b>{p.sponsor}</b>{p.active ? <Tag tone="sage">Active</Tag> : <Tag>Closed</Tag>}</p>
                                <span className="eg-rv-meter" role="img" aria-label={`${c(p.matched_cents)} of ${c(p.cap_cents)} matched`}><i style={{ width: pct(rate(p.matched_cents, p.cap_cents)) }} /></span>
                                <small>{c(p.cap_cents - p.matched_cents)} of {c(p.cap_cents)} left</small>
                            </li>
                        ))}</ul> : <Empty>No match pot. A sponsor’s pot doubles gifts until it runs out.</Empty>}
                    </Card>
                </div>
            </div>
        )}</Show>
    );
};

// ---------------------------------------------------------------- Campaign
const CampaignTab = ({ f, c, sc }: { f: Filters } & Money) => {
    const load = useCampaign(f), { short } = useWorkspace();
    return (
        <Show load={load}>{(d) => {
            if (!d.gifts) return <Card><Empty>No paid gifts match these filters yet.</Empty></Card>;
            const s = campaignStats(d), nights = nightSeries(d.by_night), split = nightSplit(nights), best = nights.indexOf(Math.max(...nights));
            return (
                <div className="eg-rv-grid">
                    <Card className="eg-card-strip eg-rv-span"><h2 className="eg-sr">Totals</h2><StatStrip items={[
                        { label: "Raised", value: sc(d.raised_cents), note: `${c(d.net_cents)} to the charity after fees` },
                        { label: "Donors", value: n(d.donors), note: `${n(d.new_donors)} new, ${pct(1 - s.new_share)} returning` },
                        { label: "Average gift", value: c(s.avg_cents), note: `Median ${c(d.median_cents)}` },
                        { label: "Monthly", value: pct(s.monthly_share), note: `${pct(s.nightly_share)} on the nightly schedule` },
                    ]} /></Card>
                    <Card title="Raised each night" className="eg-rv-span">
                        <NightsBar nights={nights} format={c}
                            top={[{ label: "First twenty", sub: `${c(split.first20)}, ${pct(rate(split.first20, d.raised_cents))}` }, { label: "Last ten", sub: `${c(split.last10)}, ${pct(rate(split.last10, d.raised_cents))}` }, { label: "Odd nights", sub: `${c(split.oddLast10)} of the last ten` }]}
                            bottom={[{ label: "Night 1", sub: "Starts the eve of the first fast" }, { label: nights[best] ? `Night ${best + 1}` : "–", sub: nights[best] ? `Biggest, ${c(nights[best])}` : "No nights yet" }, { label: "Night 30", sub: "Then Eid" }]} />
                        <NightColumns nights={nights} format={c} />
                    </Card>
                    <Card title="By fund"><Pie slices={d.by_fund.map((x) => ({ label: x.key, value: x.cents / 100, note: `${short(x.cents / 100)}, ${n(x.donors)} donors` }))} format={short} label="Raised by fund" /></Card>
                    <Card title="By campaign">
                        <BarTable caption="Raised by campaign" head={["Campaign", "Raised", "Avg gift"]}
                            rows={d.by_campaign.map((x) => ({ key: x.key, label: x.key, value: x.cents, cells: [c(x.cents), c(rate(x.cents, x.gifts))] }))} />
                    </Card>
                </div>
            );
        }}</Show>
    );
};

// ---------------------------------------------------------------- Sources
const GROUPS: [SourceGroup, string][] = [["channel", "Channel"], ["utm_campaign", "Ad or email campaign"], ["qr", "QR code"], ["fundraiser", "Fundraiser"]];
const Sources = ({ f, c, sc }: { f: Filters } & Money) => {
    const [by, setBy] = useState<SourceGroup>("channel");
    const load = useSources(f, by);
    return (
        <Card title="Where the money came from" action={<Seg label="Group by" value={by} items={GROUPS} onChange={setBy} />}>
            <Show load={load}>{(rows) => {
                if (!rows.length) return <Empty>{by === "channel" ? "No gifts match these filters yet." : "No gifts carry this tag yet. Add it to your links (utm_campaign, ?qr=, ?fundraiser=) and it shows here."}</Empty>;
                const st = sourceStats(rows), best = bestConverter(rows), meta = st.find((r) => r.roas !== null);
                return <>
                    {by === "channel" && (best || meta) && <p className="eg-rv-lead">
                        {best && <>{best.key} converts best, at {pct(best.conversion)} of visitors.</>} {meta && <>{meta.key} returned {meta.roas!.toFixed(1)} times its {c(meta.spend_cents!)} spend.</>}
                    </p>}
                    <BarTable caption="Raised by source" head={[GROUPS.find((g) => g[0] === by)![1], "Raised", "Share", "Donors", "Avg gift", "Converts", "Return"]}
                        optional={[1, 2, 3]} rows={st.map((r) => ({ key: r.key, label: r.key, value: r.cents,
                            cells: [sc(r.cents), pct(r.share), n(r.donors), c(r.avg_cents), r.visitors ? pct(r.conversion) : "–", r.roas === null ? "–" : `${r.roas.toFixed(1)}x`] }))} />
                    <p className="eg-muted eg-rv-small">Converts: donors as a share of visitors from that source. Return: dollars raised per ad dollar, from the spend in Settings.</p>
                </>;
            }}</Show>
        </Card>
    );
};

// ---------------------------------------------------------------- Funnel
const FunnelTab = ({ f }: { f: Filters }) => {
    const [by, setBy] = useState<FunnelGroup>("device");
    const load = useFunnel(f, by);
    return (
        <Show load={load}>{(rows) => {
            const all = rows.find((r) => r.key === "all");
            if (!all || !all.visit) return <Card><Empty>No checkout visits recorded yet. They appear as soon as the checkout is live.</Empty></Card>;
            const steps = funnelStats(all), drop = biggestDrop(all);
            return (
                <div className="eg-rv-grid">
                    <Card title="From visit to paid" className="eg-rv-span">
                        <ol className="eg-rv-funnel">{steps.map((s, i) => (
                            <li key={s.step}>
                                <span className="eg-rv-fn-label"><b>{STEP_LABEL[s.step]}</b>{i > 0 && <small>{pct(s.ofPrevious)} of the step before{s.step === drop && <Tag tone="peach">Most people leave here</Tag>}</small>}</span>
                                <span className="eg-rv-fn-bar" aria-hidden="true"><i style={{ width: `${Math.max(1, s.ofVisits * 100)}%`, background: PALETTE[i === 4 ? 0 : 2] }} /></span>
                                <span className="eg-rv-fn-n"><b>{n(s.sessions)}</b><small>{pct(s.ofVisits)} of visits</small></span>
                            </li>
                        ))}</ol>
                    </Card>
                    <Card title="By group" className="eg-rv-span" action={<Seg label="Group by" value={by} items={[["device", "Device"], ["layout", "Checkout layout"], ["channel", "Source"]]} onChange={setBy} />}>
                        <BarTable caption="Visit to paid, by group" head={[by === "device" ? "Device" : by === "layout" ? "Layout" : "Source", "Visits", "Started", "Paid", "Visit to paid"]}
                            optional={[1]} rows={rows.filter((r) => r.key !== "all").map((r) => ({ key: r.key, label: r.key.replace(/^./, (x) => x.toUpperCase()), value: rate(r.paid, r.visit), tone: 0,
                                cells: [n(r.visit), n(r.checkout_started), n(r.paid), pct(rate(r.paid, r.visit))] }))} max={Math.max(...rows.filter((r) => r.key !== "all").map((r) => rate(r.paid, r.visit)), 0.01)} />
                    </Card>
                </div>
            );
        }}</Show>
    );
};

// ---------------------------------------------------------------- Add-ons
const AddonsTab = ({ f, c }: { f: Filters; c: (cents: number) => string }) => {
    const load = useAddons(f);
    return (
        <Show load={load}>{(a) => {
            if (!a.gifts) return <Card><Empty>No checkout gifts match these filters yet.</Empty></Card>;
            const s = addonStats(a), extra = a.addons.reduce((x, y) => x + y.cents, 0);
            return (
                <div className="eg-rv-grid">
                    <Card className="eg-card-strip eg-rv-span"><h2 className="eg-sr">Fees and add-ons</h2><StatStrip items={[
                        { label: "Cover the fees", value: pct(s.feeCover), note: `${n(a.fee_covered)} of ${n(a.gifts)} gifts` },
                        { label: "Fees covered", value: c(a.fee_cover_cents), note: "Paid by donors, not the charity" },
                        { label: "Add-on dollars", value: c(extra), note: `Across ${s.addons.filter((x) => x.taken).length} add-ons` },
                    ]} /></Card>
                    <Card title="Add-on take-up" className="eg-rv-span">
                        {s.addons.length ? <BarTable caption="Take-up by add-on" head={["Add-on", "Took it", "Shown", "Extra"]} max={1}
                            rows={s.addons.map((x) => ({ key: x.key, label: ADDON_LABEL[x.key] ?? x.key, value: x.takeUp, tone: 2,
                                flag: x.shown >= 50 && x.takeUp < 0.03 ? <Tag tone="peach">Under 3%: try another</Tag> : undefined,
                                cells: [pct(x.takeUp), n(x.shown), x.cents ? c(x.cents) : "–"] }))} />
                            : <Empty href="/engage/checkout" cta="Checkout builder">No add-ons shown yet. Nothing that costs money is ever pre-ticked.</Empty>}
                        <p className="eg-muted eg-rv-small">Take-up is out of the gifts that were shown the add-on. One under 3% is taking space on the gift screen; swap it for another.</p>
                    </Card>
                </div>
            );
        }}</Show>
    );
};

// ---------------------------------------------------------------- import
const ImportFlow = ({ onDone }: { onDone: () => void }) => {
    const ws = useWorkspace(), { db, toast } = useApp();
    const [file, setFile] = useState("");
    const [parsed, setParsed] = useState<Parsed | null>(null);
    const [check, setCheck] = useState<ImportResult | null>(null);
    const [busy, setBusy] = useState(false);
    const [past, setPast] = useState<ImportBatch[]>([]);
    const reload = () => { if (!ws.sample) listImports(db, ws.org.id).then(setPast, () => setPast([])); };
    useEffect(reload, [db, ws.org.id, ws.sample]);
    const c = (cents: number) => ws.money(cents / 100);
    const read = async (fl: File | undefined) => {
        setCheck(null); setParsed(null); if (!fl) return;
        setFile(fl.name); setParsed(parseImport(await fl.text()));
    };
    const run = async (dry: boolean) => {
        if (!parsed) return;
        setBusy(true);
        try {
            if (ws.sample) {
                const total = parsed.rows.reduce((x, r) => x + r.amount_cents, 0);
                const r = { batch_id: null, rows: parsed.rows.length, invalid: 0, duplicates: 0, new: parsed.rows.length, imported: dry ? 0 : parsed.rows.length, total_cents: total };
                if (dry) setCheck(r); else { toast(`Sample: ${n(r.imported)} gifts would be imported; nothing was saved`); onDone(); }
            } else {
                const r = await importGifts(db, ws.org.id, parsed.tool, file, parsed.rows, dry);
                if (dry) setCheck(r); else { toast(`${n(r.imported)} gifts imported, ${c(r.total_cents)}`); reload(); setParsed(null); setCheck(null); }
            }
        } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };
    const undo = async (b: ImportBatch) => {
        setBusy(true);
        try { await undoImport(db, b.id); toast(`Import of ${b.filename || "the file"} undone`); reload(); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };
    const TOOL = { launchgood: "LaunchGood", donorbox: "Donorbox", csv: "Outgive CSV" };
    return (
        <div className="eg-rv-form">
            <p className="eg-muted">Bring last year’s gifts from LaunchGood or Donorbox so returning donors and year-on-year numbers are right. Use the tool’s own CSV export. Importing the same file twice is safe: gifts already here are skipped.</p>
            <Field label="CSV file"><input type="file" accept=".csv,text/csv" onChange={(e) => void read(e.target.files?.[0])} /></Field>
            {parsed && <div className="eg-rv-preview" aria-live="polite">
                <p><Tag tone="lilac">{TOOL[parsed.tool]}</Tag> {n(parsed.rows.length)} gifts read, {c(parsed.rows.reduce((x, r) => x + r.amount_cents, 0))}{parsed.errors.length ? `, ${n(parsed.errors.length)} row${parsed.errors.length === 1 ? "" : "s"} skipped` : ""}.</p>
                {parsed.errors.length > 0 && <ul className="eg-rv-errors">{parsed.errors.slice(0, 5).map((e) => <li key={e.line}>Line {e.line}: {e.why}</li>)}{parsed.errors.length > 5 && <li>and {n(parsed.errors.length - 5)} more</li>}</ul>}
                {parsed.rows.length > 0 && <div className="eg-rv-scroll"><table className="eg-rv-mini">
                    <caption className="eg-sr">First gifts in the file</caption>
                    <thead><tr><th scope="col">Date</th><th scope="col">Donor</th><th scope="col">Fund</th><th scope="col" className="n">Amount</th></tr></thead>
                    <tbody>{parsed.rows.slice(0, 4).map((r, i) => <tr key={i}><td>{r.created_at.slice(0, 10)}</td><td>{r.anonymous ? "Anonymous" : r.donor_name ?? r.donor_email ?? "–"}</td><td>{r.fund ?? "–"}</td><td className="n">{c(r.amount_cents)}</td></tr>)}</tbody>
                </table></div>}
                {parsed.unmapped.length > 0 && <p className="eg-muted eg-rv-small">Not imported: {parsed.unmapped.join(", ")}.</p>}
                {check && <p className="eg-rv-check"><b>{n(check.new)} new gifts, {c(check.total_cents)}.</b> {n(check.duplicates)} already here{check.invalid ? `, ${n(check.invalid)} unreadable` : ""}.</p>}
            </div>}
            <div className="eg-rv-dlg-actions">
                <button type="button" className="eg-btn white" onClick={onDone}>Close</button>
                {parsed && !check && <button type="button" className="eg-btn black" disabled={busy || !parsed.rows.length} onClick={() => run(true)}>Check for duplicates</button>}
                {check && <button type="button" className="eg-btn black" disabled={busy || !check.new} onClick={() => run(false)}>Import {n(check.new)} gifts</button>}
            </div>
            {past.length > 0 && <section className="eg-rv-past"><h3>Earlier imports</h3><ul>{past.map((b) => (
                <li key={b.id}><span><b>{b.filename || TOOL[b.tool]}</b><small>{new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, {n(b.imported)} gifts, {c(b.total_cents)}</small></span>
                    <button type="button" className="eg-btn white sm" disabled={busy} onClick={() => undo(b)}><ArrowCounterClockwise size={16} aria-hidden="true" />Undo</button></li>
            ))}</ul></section>}
        </div>
    );
};

// ---------------------------------------------------------------- settings
const DEFAULTS: RevenueSettings = { timezone: "America/New_York", ramadan_start: "2027-02-08", report_to: [], report_hour: 8, ads_opt_in: false, ga4_id: null, meta_pixel_id: null, ad_spend: {} };
const SPEND_KEYS = ["Meta ads", "Google ads"];
const SettingsForm = ({ onDone }: { onDone: () => void }) => {
    const ws = useWorkspace(), { db, toast } = useApp();
    const [s, setS] = useState<RevenueSettings | null>(ws.sample ? { ...DEFAULTS, report_to: ["ops@example.org"], ad_spend: { "Meta ads": 940000 } } : null);
    const [to, setTo] = useState(ws.sample ? "ops@example.org" : "");
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (ws.sample) return;
        const got = (x: RevenueSettings | null) => { const v = x ?? DEFAULTS; setS(v); setTo(v.report_to.join(", ")); };
        getSettings(db, ws.org.id).then(got, () => got(null));
    }, [db, ws.org.id, ws.sample]);
    const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => [h, new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" })] as const), []);
    if (!s) return <div className="eg-skeleton" aria-busy="true"><span className="eg-sr">Loading settings</span></div>;
    const up = (p: Partial<RevenueSettings>) => setS({ ...s, ...p });
    const save = async () => {
        const next = { ...s, report_to: to.split(/[\s,;]+/).filter(Boolean), ga4_id: s.ga4_id || null, meta_pixel_id: s.meta_pixel_id || null };
        setBusy(true);
        try { if (!ws.sample) await saveSettings(db, ws.org.id, next); toast(ws.sample ? "Sample: settings not saved" : "Settings saved"); onDone(); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };
    return (
        <form className="eg-rv-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <fieldset><legend>Ramadan</legend><div className="eg-rv-row">
                <Field label="First day of fasting" hint="Night 1 is the evening before."><input type="date" value={s.ramadan_start ?? ""} onChange={(e) => up({ ramadan_start: e.target.value || null })} /></Field>
                <Field label="Time zone"><input value={s.timezone} onChange={(e) => up({ timezone: e.target.value })} list="eg-rv-tz" /></Field>
                <datalist id="eg-rv-tz">{["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu"].map((z) => <option key={z} value={z} />)}</datalist>
            </div></fieldset>
            <fieldset><legend>Morning report</legend><div className="eg-rv-row">
                <Field label="Send to" hint="Email addresses, separated by commas. Up to 10."><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@charity.org" /></Field>
                <Field label="At"><select value={s.report_hour} onChange={(e) => up({ report_hour: Number(e.target.value) })}>{hours.map(([h, l]) => <option key={h} value={h}>{l}</option>)}</select></Field>
            </div><p className="eg-muted eg-rv-small">The morning after each night: what it raised, against the night before, the top sources, funds and tables.</p></fieldset>
            <fieldset><legend>Ad spend</legend><div className="eg-rv-row">
                {SPEND_KEYS.map((k) => <Field key={k} label={`${k}, total $`}><input type="number" min="0" step="1" inputMode="numeric" value={s.ad_spend[k] ? s.ad_spend[k] / 100 : ""} onChange={(e) => up({ ad_spend: { ...s.ad_spend, [k]: Math.round(Number(e.target.value || 0) * 100) } })} /></Field>)}
            </div><p className="eg-muted eg-rv-small">Used for the return on ad spend in Sources.</p></fieldset>
            <fieldset><legend>Google Analytics and Meta</legend>
                <label className="eg-rv-check-row"><input type="checkbox" checked={s.ads_opt_in} onChange={(e) => up({ ads_opt_in: e.target.checked })} /><span>Send a donation event to our GA4 and Meta accounts</span></label>
                <div className="eg-rv-row">
                    <Field label="GA4 measurement ID"><input value={s.ga4_id ?? ""} onChange={(e) => up({ ga4_id: e.target.value })} placeholder="G-XXXXXXX" disabled={!s.ads_opt_in} /></Field>
                    <Field label="Meta pixel ID"><input value={s.meta_pixel_id ?? ""} onChange={(e) => up({ meta_pixel_id: e.target.value })} inputMode="numeric" disabled={!s.ads_opt_in} /></Field>
                </div>
                <p className="eg-rv-note">Only a bare donation event with the amount and currency is sent. No religious detail is ever sent: no fund, no Zakat status, no name, email or anything else about the donor.</p>
            </fieldset>
            <div className="eg-rv-dlg-actions">
                <button type="button" className="eg-btn white" onClick={onDone}>Cancel</button>
                <button type="submit" className="eg-btn black" disabled={busy}>Save settings</button>
            </div>
        </form>
    );
};
