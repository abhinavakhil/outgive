/**
 * Checkout builder (/engage/checkout): the charity picks a layout and up to three add-ons, previewed as the real checkout in test
 * mode, copies the embed, and runs A/B tests of ask amounts or layouts. Data and rules come from the checkout feature
 * (`@/features/checkout`); the demo shows labelled sample figures and saves nothing. Admins change things; everyone else reads.
 */
import { useEffect, useMemo, useState } from "react";
import { Copy, Flask, Layout as LayoutIcon, Code } from "@phosphor-icons/react";
import { useApp } from "@/shared/lib/app-context";
import { cx } from "@/shared/utils/cx";
import {
    ADDONS, ADDON_IDS, type AddonId, type Arm, type CheckoutLayout, type CheckoutSettings, DEFAULT_SETTINGS, type ExperimentResult, FUND_IDS, LAYOUTS, LAYOUT_IDS, MAX_SHOWN, OFF_SCREEN,
    SAMPLE_EXPERIMENTS, SAMPLE_TAKEUP, addonTakeup, averageGift, conversion, embedSnippet, listExperiments, loadSettings, perVisitor, saveSettings, settingsProblem, startExperiment, stopExperiment, verdict,
} from "@/features/checkout";
import { Card, Empty, Tabs, Tag } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import "./checkout-builder.css";

type Tab = "build" | "tests" | "embed";
const FUND_NAME: Record<string, string> = { general: "The appeal", zakat: "Zakat", sadaqah: "Sadaqah", zakat_al_fitr: "Zakat al-Fitr", fidya: "Fidya" };
const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

export const CheckoutBuilder = () => {
    const ws = useWorkspace(), { db, toast } = useApp();
    const admin = ws.role === "owner" || ws.role === "admin";
    const [s, setS] = useState<CheckoutSettings>(DEFAULT_SETTINGS);
    const [saved, setSaved] = useState<CheckoutSettings>(DEFAULT_SETTINGS);
    const [takeup, setTakeup] = useState<{ key: string; share: number }[]>(ws.sample ? SAMPLE_TAKEUP : []);
    const [tests, setTests] = useState<ExperimentResult[]>(ws.sample ? SAMPLE_EXPERIMENTS : []);
    const [tab, setTab] = useState<Tab>(() => (["tests", "embed"].includes(location.hash.slice(1)) ? (location.hash.slice(1) as Tab) : "build"));
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (ws.sample) return;
        loadSettings(db, ws.org.id).then((x) => { setS(x); setSaved(x); }).catch(() => {});
        addonTakeup(db, ws.org.id).then(setTakeup).catch(() => {});
        listExperiments(db, ws.org.id).then(setTests).catch(() => {});
    }, [db, ws.org.id, ws.sample]);
    const go = (t: Tab) => { setTab(t); history.replaceState(null, "", `#${t}`); };
    const onScreen = s.addons.filter((a) => !OFF_SCREEN.includes(a));
    const problem = settingsProblem(s), dirty = JSON.stringify(s) !== JSON.stringify(saved);
    const toggle = (a: AddonId) => setS((o) => ({ ...o, addons: o.addons.includes(a) ? o.addons.filter((x) => x !== a) : [...o.addons, a] }));
    const preview = useMemo(() => `/checkout?${new URLSearchParams({ embed: "1", charity: ws.org.slug, layout: s.layout, funds: s.funds.join(","), addons: s.addons.join(","), coverFees: s.cover_default ? "1" : "0" })}`, [s, ws.org.slug]);
    const snippet = embedSnippet(ws.org.slug, s, location.origin);
    const save = async () => {
        if (problem) return toast(problem);
        if (ws.sample) { setSaved(s); return toast("Saved in this demo only. Nothing is stored."); }
        setBusy(true);
        try { await saveSettings(db, ws.org.id, s); setSaved(s); toast("Saved. Your checkout and every embed use these settings now."); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };

    return (
        <div className="eg-cb">
            <header className="eg-cb-head">
                <div>
                    <h1>Checkout builder</h1>
                    <p className="eg-muted">Pick a layout and up to three add-ons. The preview is the real donate flow in test mode: try a gift.</p>
                </div>
                <p className="eg-cb-actions">
                    {ws.sample && <Tag tone="peach">Sample figures</Tag>}
                    {admin && <button type="button" className="eg-btn sage" disabled={busy || !dirty} onClick={save}>{dirty ? "Save checkout" : "Saved"}</button>}
                </p>
            </header>
            <Tabs id="cb" label="Checkout builder" value={tab} onChange={go} items={[{ id: "build", label: "Layout and add-ons", icon: <LayoutIcon size={18} aria-hidden="true" /> }, { id: "tests", label: "A/B tests", icon: <Flask size={18} aria-hidden="true" /> }, { id: "embed", label: "Embed", icon: <Code size={18} aria-hidden="true" /> }]} />

            <div className="eg-cb-split">
                <div className="eg-cb-main">
                    {tab === "build" && <>
                        <Card title="Layout">
                            <div className="eg-cb-layouts" role="radiogroup" aria-label="Layout">
                                {LAYOUT_IDS.map((l) => <button key={l} type="button" role="radio" aria-checked={s.layout === l} disabled={!admin} className={cx("eg-cb-tile", `t-${l}`)} onClick={() => setS({ ...s, layout: l })}><i aria-hidden="true" /><b>{LAYOUTS[l][0]}</b><span>{LAYOUTS[l][1]}</span></button>)}
                            </div>
                        </Card>
                        <Card title="Add-ons" action={<Tag tone="lilac">{onScreen.length} of {MAX_SHOWN} on the gift screen</Tag>}>
                            <p className="eg-muted eg-cb-note">Nothing that costs money is pre-ticked. Fees and add-ons sit on their own receipt lines, so a Zakat amount stays exact.</p>
                            <ul className="eg-cb-list">
                                {ADDON_IDS.map((a) => {
                                    const on = s.addons.includes(a), full = !on && !OFF_SCREEN.includes(a) && onScreen.length >= MAX_SHOWN, t = takeup.find((x) => x.key === a);
                                    return (
                                        <li key={a}>
                                            <label className={cx("eg-cb-toggle", on && "on", (full || !admin) && "off")}>
                                                <span><b>{ADDONS[a][0]}</b><small>{ADDONS[a][1]}{OFF_SCREEN.includes(a) ? " · not counted in the three" : ""}{full ? " · switch one off first" : ""}</small></span>
                                                <input type="checkbox" role="switch" className="eg-cb-switch" checked={on} disabled={full || !admin} onChange={() => toggle(a)} />
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                            <label className="eg-cb-check"><input type="checkbox" checked={s.cover_default} disabled={!admin} onChange={(e) => setS({ ...s, cover_default: e.target.checked })} />Pre-tick “cover the fees”. It stays visible, and donors can untick it.</label>
                        </Card>
                        <Card title="Add-on take-up" action={<span className="eg-muted">Last 7 days</span>}>
                            {takeup.length ? (
                                <ul className="eg-cb-bars">{[...takeup].sort((x, y) => y.share - x.share).map((t) => <li key={t.key}><span>{ADDONS[t.key as AddonId]?.[0] ?? t.key}</span><i><b style={{ width: `${Math.min(100, t.share * 100)}%` }} className={t.share < 0.03 ? "low" : ""} /></i><span className="n">{pct(t.share)}</span></li>)}</ul>
                            ) : <Empty>No paid gifts with add-ons yet. Take-up shows here once gifts come in.</Empty>}
                            {takeup.some((t) => t.share < 0.03) && <p className="eg-muted eg-cb-note">Under 3% is worth swapping for another add-on.</p>}
                        </Card>
                        <Card title="Funds and details">
                            <div className="eg-cb-funds">{FUND_IDS.map((f) => { const on = s.funds.includes(f); return <button key={f} type="button" aria-pressed={on} disabled={!admin} className={cx("eg-cb-chip", on && "on")} onClick={() => setS({ ...s, funds: on ? s.funds.filter((x) => x !== f) : [...s.funds, f] })}>{f === "general" ? s.appeal : FUND_NAME[f]}</button>; })}</div>
                            <div className="eg-cb-fields">
                                <Field label="Appeal name (the default fund)" value={s.appeal} onChange={(v) => setS({ ...s, appeal: v })} disabled={!admin} />
                                <Field label="Night 21 (the evening)" type="date" value={s.nights_start} onChange={(v) => setS({ ...s, nights_start: v })} disabled={!admin} />
                                <Field label="Round up: a milestone every ($)" inputMode="numeric" value={s.milestone_step ? String(s.milestone_step) : ""} onChange={(v) => setS({ ...s, milestone_step: Number(v.replace(/\D/g, "")) || null })} disabled={!admin} />
                                <Field label="Milestone name" placeholder="table 6's goal" value={s.milestone_label} onChange={(v) => setS({ ...s, milestone_label: v })} disabled={!admin} />
                                <Field label="Mailing address for donor-advised fund grants" wide value={s.daf_address} onChange={(v) => setS({ ...s, daf_address: v })} disabled={!admin} />
                            </div>
                            {problem && <p role="alert" className="eg-cb-err">{problem}</p>}
                        </Card>
                    </>}
                    {tab === "tests" && <Tests tests={tests} setTests={setTests} admin={admin} settings={s} />}
                    {tab === "embed" && (
                        <Card title="Embed on any site" action={<button type="button" className="eg-btn white sm" onClick={() => { void navigator.clipboard?.writeText(snippet); toast("Embed code copied"); }}><Copy size={16} aria-hidden="true" />Copy</button>}>
                            <p className="eg-muted eg-cb-note">Paste this where the checkout should appear. It follows the settings on the first tab, and the charity’s saved settings win for anything you leave out.</p>
                            <pre className="eg-cb-code"><code>{snippet}</code></pre>
                            <p className="eg-muted eg-cb-note">Or link straight to it: <code>{location.origin}/o/{ws.org.slug}/checkout</code>. Add <code>?amount=120.50&amp;fund=zakat</code> to fill the gift (the Zakat calculator does).</p>
                        </Card>
                    )}
                </div>
                <aside className="eg-cb-preview">
                    <Card title="Preview" action={<Tag tone="peach">Test mode</Tag>}>
                        <iframe key={preview} title="Checkout preview" src={preview} />
                    </Card>
                </aside>
            </div>
        </div>
    );
};

const Field = ({ label, value, onChange, wide, ...p }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean; type?: string; placeholder?: string; inputMode?: "numeric"; disabled?: boolean }) => (
    <label className={cx("eg-cb-field", wide && "wide")}><span>{label}</span><input {...p} value={value} onChange={(e) => onChange(e.target.value)} /></label>
);

/** A/B tests: the running one with its readout, past ones, and a form to start one (amounts or layout). */
const Tests = ({ tests, setTests, admin, settings }: { tests: ExperimentResult[]; setTests: (t: ExperimentResult[]) => void; admin: boolean; settings: CheckoutSettings }) => {
    const ws = useWorkspace(), { db, toast } = useApp();
    const running = tests.find((t) => t.status === "running");
    const [kind, setKind] = useState<"amounts" | "layout">("amounts");
    const [amounts, setAmounts] = useState("50, 100, 250, 500");
    const [layout, setLayout] = useState<CheckoutLayout>(settings.layout === "compact" ? "hero" : "compact");
    const reload = () => (ws.sample ? Promise.resolve() : listExperiments(db, ws.org.id).then(setTests));
    const start = async () => {
        const b = amounts.split(/[,\s]+/).map(Number).filter((n) => n >= 2 && n <= 10000);
        if (kind === "amounts" && (b.length < 2 || b.length > 5)) return toast("Give two to five amounts, like 50, 100, 250, 500.");
        if (kind === "layout" && layout === settings.layout) return toast("Pick a layout other than the one you use now.");
        const variants = kind === "amounts"
            ? [{ id: "a", label: "Your amounts", presets: [25, 50, 100, 250] }, { id: "b", label: b.map((n) => `$${n}`).join(" · "), presets: b }]
            : [{ id: "a", label: LAYOUTS[settings.layout][0], layout: settings.layout }, { id: "b", label: LAYOUTS[layout][0], layout }];
        const name = kind === "amounts" ? "Ask amounts" : `${LAYOUTS[settings.layout][0]} vs ${LAYOUTS[layout][0]}`;
        if (ws.sample) { setTests([{ id: `demo-${Date.now()}`, name, kind, status: "running", started_at: new Date().toISOString(), stopped_at: null, variants: variants.map((v) => ({ ...v, visitors: 0, gifts: 0, raised_cents: 0 })) }, ...tests.map((t) => ({ ...t, status: "stopped" as const }))]); return toast("Test started in this demo only."); }
        try { await startExperiment(db, ws.org.id, { name, kind, variants }); await reload(); toast("Test started. Each donor sees one version for their whole visit."); } catch (e) { toast((e as Error).message); }
    };
    const stop = async (id: string) => {
        if (ws.sample) { setTests(tests.map((t) => (t.id === id ? { ...t, status: "stopped" as const } : t))); return; }
        try { await stopExperiment(db, ws.org.id, id); await reload(); } catch (e) { toast((e as Error).message); }
    };
    return (
        <>
            {running ? <Readout t={running} admin={admin} onStop={() => stop(running.id)} /> : (
                <Card title="Start a test">
                    <p className="eg-muted eg-cb-note">Half of donors see your checkout as it is, half see the change. A donor keeps the same version for their whole visit. Run one test at a time, for at least a week or a few hundred visitors.</p>
                    <div className="eg-cb-seg" role="radiogroup" aria-label="What to test">
                        {(["amounts", "layout"] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>{k === "amounts" ? "Ask amounts" : "Layout"}</button>)}
                    </div>
                    {kind === "amounts"
                        ? <Field label="Amounts for the new version (dollars)" value={amounts} onChange={setAmounts} />
                        : <label className="eg-cb-field"><span>Layout for the new version</span><select value={layout} onChange={(e) => setLayout(e.target.value as CheckoutLayout)}>{LAYOUT_IDS.map((l) => <option key={l} value={l}>{LAYOUTS[l][0]}</option>)}</select></label>}
                    {admin && <p><button type="button" className="eg-btn black" onClick={start}>Start the test</button></p>}
                </Card>
            )}
            {tests.filter((t) => t.status === "stopped").map((t) => <Readout key={t.id} t={t} admin={false} />)}
        </>
    );
};

const Readout = ({ t, admin, onStop }: { t: ExperimentResult; admin: boolean; onStop?: () => void }) => {
    const ws = useWorkspace(), arms: Arm[] = t.variants.map((v) => ({ id: v.id, label: v.label, visitors: v.visitors, gifts: v.gifts, raised_cents: v.raised_cents }));
    return (
        <Card title={t.name} action={<>{t.status === "running" ? <Tag tone="forest">Running</Tag> : <Tag>Stopped</Tag>}{admin && onStop && <button type="button" className="eg-btn white sm" onClick={onStop}>Stop test</button>}</>}>
            <p className="eg-muted eg-cb-note">Since {new Date(t.started_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Conversion is paid gifts for every visitor who saw that version.</p>
            <div className="eg-cb-scroll">
                <table className="eg-cb-table">
                    <thead><tr><th>Version</th><th className="n">Visitors</th><th className="n">Gifts</th><th className="n">Conversion</th><th className="n">Average gift</th><th className="n">Per visitor</th><th>Readout</th></tr></thead>
                    <tbody>{arms.map((a, i) => { const v = i === 0 ? null : verdict(arms[0], a); return (
                        <tr key={a.id}><td><b>{i === 0 ? "A" : "B"}</b> {a.label}</td><td className="n">{a.visitors.toLocaleString("en-US")}</td><td className="n">{a.gifts.toLocaleString("en-US")}</td><td className="n">{pct(conversion(a))}</td><td className="n">{ws.money(averageGift(a))}</td><td className="n">{ws.money(perVisitor(a))}</td><td>{v ? <Tag tone={v.tone}>{v.text}</Tag> : <span className="eg-muted">The baseline</span>}</td></tr>
                    ); })}</tbody>
                </table>
            </div>
            <p className="eg-muted eg-cb-note">“Likely” means a 95% two-sided test on conversion, with at least 100 visitors per version. Average gift and per-visitor money are shown for judgement, not tested.</p>
        </Card>
    );
};
