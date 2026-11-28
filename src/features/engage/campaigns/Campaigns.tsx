/**
 * Campaigns: every appeal of the year on the charity's page, a gallery of templates to start the next one, and text-to-give keywords.
 * A template adds its funds, suggested gifts and dates to the page (bio_save); nothing already there changes. Editors and up make changes.
 */
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { useApp } from "@/shared/lib/app-context";
import { Card, Empty, Tag, type Tone } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import { useCampaigns, type Keyword } from "./data";
import { ADDON_NAME, BUILDING_UNITS, type BuildingUnit, type Status, TEMPLATES, type Template, type TemplateId, buildingAsks, datesOf, rowsOf } from "./templates";
import { MAX_GIFT, MIN_GIFT, keywordProblem } from "../../../../supabase/functions/sms-inbound/logic";
import "../pledges/pledges.css";
import "./campaigns.css";

const TONE: Record<Status, Tone> = { "Not started": "grey", "In progress": "lilac", Done: "sage", "Every Friday": "peach" };
const NAME: Record<TemplateId, string> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.name])) as Record<TemplateId, string>;
const FUNDS: [string, string][] = [["general", "The appeal"], ["zakat", "Zakat"], ["sadaqah", "Sadaqah"], ["zakat_al_fitr", "Zakat al-Fitr"], ["fidya", "Fidya"]];
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const span = (a: string | null, b: string | null) => (a && b ? `${day(a)} – ${day(b)}` : a ? `From ${day(a)}` : b ? `Until ${day(b)}` : "");

export const Campaigns = () => {
    const ws = useWorkspace(), { toast } = useApp();
    const s = useCampaigns();
    const can = ws.role !== "viewer";
    const [pick, setPick] = useState<Template | null>(null);
    if (s.state === "loading") return <div className="eg-skeleton tall" aria-busy="true"><span className="eg-sr">Loading campaigns</span></div>;
    if (s.state === "error") return <Card title="Campaigns"><Empty>Campaigns could not be loaded: {s.error}</Empty></Card>;
    const rows = rowsOf(s.page, s.today, s.raised);

    return (
        <div className="eg-cp">
            <header className="eg-cp-head">
                <h1>Every appeal of the year</h1>
                <p className="eg-muted">Ramadan is one season. Start the next appeal from a template: it adds the funds, suggested gifts and dates to your giving page, and keeps everything already there.</p>
            </header>

            <Card title="Your campaigns" action={<span className="eg-chip">{rows.length}</span>}>
                {rows.length ? <ul className="eg-cp-grid">{rows.map((r) => {
                    const pct = r.goal ? Math.min(100, Math.round((r.raised / r.goal) * 100)) : null;
                    return (
                        <li key={r.id} className="eg-cp-row">
                            <h3>{r.title}</h3>
                            <p className="eg-cp-meta"><Tag tone={TONE[r.status]}>{r.status}</Tag><span>{span(r.starts, r.ends)}</span></p>
                            <p className="eg-cp-big">{pct === null ? ws.short(r.raised) : `${pct}%`}</p>
                            {pct !== null && <div className="eg-cp-bar" role="img" aria-label={`${pct}% of the goal`}><i style={{ width: `${pct}%` }} /></div>}
                            <p className="eg-cp-sub">{pct === null ? "raised so far" : `${ws.short(r.raised)} of ${ws.short(r.goal)}`}{r.template ? ` · ${NAME[r.template]}` : ""}</p>
                        </li>
                    );
                })}</ul> : <Empty>No campaigns on your page yet. Start one from a template below.</Empty>}
            </Card>

            <section aria-labelledby="cp-templates">
                <h2 id="cp-templates" className="eg-cp-h2">Start from a template</h2>
                <ul className="eg-cp-gallery">{TEMPLATES.map((t) => (
                    <li key={t.id} className="eg-card eg-cp-tpl">
                        <header><h3>{t.name}</h3><small>{t.season}</small></header>
                        <p className="eg-muted">{t.summary}</p>
                        <ul className="eg-cp-asks" aria-label="Suggested gifts">{t.asks.map((a) => <li key={a.amount}><b>{ws.money(a.amount)}</b><span>{a.outcome}</span></li>)}</ul>
                        <p className="eg-cp-addons"><span className="eg-sr">Add-ons that fit: </span>{t.addons.map((a) => <span key={a} className="eg-cp-addon">{ADDON_NAME[a]}</span>)}</p>
                        <button type="button" className="eg-btn black sm" disabled={!can} onClick={() => setPick(t)} aria-label={`Use the ${t.name} template`}>Use template</button>
                    </li>
                ))}</ul>
                {!can && <p className="eg-muted eg-cp-foot">Viewers can look; an editor or admin adds campaigns.</p>}
            </section>

            <TextToGive keywords={s.keywords} number={s.number} can={can}
                onSave={async (k) => { try { await s.saveKeyword(k); toast(`${k.keyword} saved`); return true; } catch (e) { toast((e as Error).message); return false; } }}
                onRemove={async (kw) => { try { await s.removeKeyword(kw); toast(`${kw} removed`); } catch (e) { toast((e as Error).message); } }} />
            {s.sample && <p className="eg-muted eg-cp-foot">Sample campaigns and keywords. In the demo nothing is saved or texted.</p>}

            <Dialog open={!!pick} onClose={() => setPick(null)} title={pick ? `New ${pick.name} campaign` : ""}>
                {pick && <UseTemplate t={pick} today={s.today} onCancel={() => setPick(null)} onApply={async (o) => {
                    try { await s.apply(pick, o); toast(`${o.title || pick.name} added to your page`); setPick(null); } catch (e) { toast((e as Error).message); }
                }} />}
            </Dialog>
        </div>
    );
};

// ---------------------------------------------------------------- the template dialog
const Dialog = ({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) => {
    const ref = useRef<HTMLDialogElement>(null), id = useId();
    useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
    return <dialog ref={ref} className="eg-pl-dialog" aria-labelledby={id} onClose={onClose}><h2 id={id}>{title}</h2>{children}</dialog>;
};

const UseTemplate = ({ t, today, onApply, onCancel }: { t: Template; today: string; onApply: (o: { title: string; goal?: number; unit?: BuildingUnit }) => Promise<void>; onCancel: () => void }) => {
    const ws = useWorkspace();
    const [title, setTitle] = useState(t.name);
    const [goal, setGoal] = useState(String(t.goal || ""));
    const [unit, setUnit] = useState<BuildingUnit>("bricks");
    const [busy, setBusy] = useState(false);
    const { starts, ends } = datesOf(t, today);
    const asks = t.id === "building" ? buildingAsks(unit) : t.asks;
    const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); await onApply({ title: title.trim(), goal: Number(goal) || 0, unit }); setBusy(false); };
    return (
        <form className="eg-pl-form" onSubmit={submit}>
            <p className="eg-muted">{t.summary}</p>
            <label className="eg-pl-field"><span>Campaign name</span><input value={title} required maxLength={60} onChange={(e) => setTitle(e.target.value)} /></label>
            {t.id !== "jumuah" && <label className="eg-pl-field"><span>Goal ($)</span><input inputMode="numeric" pattern="[0-9]*" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, ""))} /><small>Leave empty for no goal.</small></label>}
            {t.id === "building" && <fieldset className="eg-cp-units"><legend>Count the building in</legend>
                {(Object.keys(BUILDING_UNITS) as BuildingUnit[]).map((u) => <label key={u}><input type="radio" name="cp-unit" checked={unit === u} onChange={() => setUnit(u)} />{BUILDING_UNITS[u].many} at {ws.money(BUILDING_UNITS[u].price)} each</label>)}
            </fieldset>}
            <div className="eg-cp-plan">
                <h3>Suggested gifts</h3>
                <ul>{asks.map((a) => <li key={a.amount}><b>{ws.money(a.amount)}</b> {a.outcome}</li>)}</ul>
                <h3>Schedule</h3>
                {t.schedule.kind === "season" ? <>
                    <ul>{t.schedule.days.map((d) => <li key={d.date}><b>{day(d.date)}</b> {d.label}</li>)}</ul>
                    <p className="eg-cp-fine">{t.schedule.note}</p>
                </> : t.schedule.kind === "weekly"
                    ? <p>Every Friday from {day(starts)}. Donors choose a weekly gift; it is taken each Friday until they stop it.</p>
                    : <p>{span(starts, ends) || `From ${day(starts)}`}{ends ? "" : ", until the goal is met"}.</p>}
                <h3>Funds added</h3>
                <p>{t.funds.map((f) => f.title).join(", ")}</p>
            </div>
            <div className="eg-pl-dlg-actions">
                <button type="button" className="eg-btn white" onClick={onCancel}>Cancel</button>
                <button className="eg-btn black" disabled={busy}>{busy ? "Adding…" : "Add to my page"}</button>
            </div>
        </form>
    );
};

// ---------------------------------------------------------------- text to give
const TextToGive = ({ keywords, number, can, onSave, onRemove }: { keywords: Keyword[]; number: string | null; can: boolean; onSave: (k: Keyword) => Promise<boolean>; onRemove: (kw: string) => void }) => {
    const ws = useWorkspace();
    const [k, setK] = useState({ keyword: "", fund: "general", amount: "", appeal: "" });
    const [tried, setTried] = useState(false);
    const kw = k.keyword.trim().toUpperCase(), problem = keywordProblem(kw), amount = Number(k.amount) || 0;
    const amountProblem = k.amount && (amount < MIN_GIFT || amount > MAX_GIFT) ? `Between ${ws.money(MIN_GIFT)} and ${ws.money(MAX_GIFT)}.` : null;
    const add = async (e: FormEvent) => {
        e.preventDefault(); setTried(true);
        if (problem || amountProblem) return;
        if (await onSave({ keyword: kw, fund: k.fund, amount_cents: amount ? Math.round(amount * 100) : null, appeal: k.appeal.trim() })) { setK({ keyword: "", fund: "general", amount: "", appeal: "" }); setTried(false); }
    };
    const example = keywords[0]?.keyword ?? "IFTAR";
    return (
        <Card title="Text to give" action={<span className="eg-chip">{number ?? "Number not set up"}</span>}>
            <p className="eg-muted">Donors text a keyword and an amount, like <b>{example} 50</b>{number ? <> to <b>{number}</b></> : ""}. They get a link back with the amount and fund filled in, and give in one tap. Nothing goes on their phone bill. STOP, START and HELP are handled for you.</p>
            {keywords.length ? (
                <table className="eg-cp-kw">
                    <thead><tr><th scope="col">Keyword</th><th scope="col">Fund</th><th scope="col" className="n">If no amount</th><th scope="col">Reply names</th><th scope="col"><span className="eg-sr">Remove</span></th></tr></thead>
                    <tbody>{keywords.map((x) => (
                        <tr key={x.keyword}>
                            <td><b>{x.keyword}</b></td><td>{FUNDS.find(([id]) => id === x.fund)?.[1] ?? "The appeal"}</td>
                            <td className="n">{x.amount_cents ? ws.money(x.amount_cents / 100) : "Donor chooses"}</td><td>{x.appeal || "Your charity"}</td>
                            <td>{can && <button type="button" className="eg-icon-btn sm" aria-label={`Remove ${x.keyword}`} onClick={() => onRemove(x.keyword)}><Trash size={16} aria-hidden="true" /></button>}</td>
                        </tr>
                    ))}</tbody>
                </table>
            ) : <Empty>No keywords yet. Add one for each appeal you put on a poster or a screen.</Empty>}
            {can && <form className="eg-cp-kwform" onSubmit={add} noValidate>
                <label className="eg-pl-field"><span>Keyword</span><input value={k.keyword} maxLength={15} autoCapitalize="characters" aria-invalid={tried && !!problem} aria-describedby="cp-kw-err" onChange={(e) => setK({ ...k, keyword: e.target.value.replace(/\s/g, "").toUpperCase() })} placeholder="IFTAR" /></label>
                <label className="eg-pl-field"><span>Fund</span><select value={k.fund} onChange={(e) => setK({ ...k, fund: e.target.value })}>{FUNDS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
                <label className="eg-pl-field"><span>Amount if none ($)</span><input inputMode="decimal" value={k.amount} aria-invalid={tried && !!amountProblem} onChange={(e) => setK({ ...k, amount: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="50" /></label>
                <label className="eg-pl-field"><span>Reply names</span><input value={k.appeal} maxLength={60} onChange={(e) => setK({ ...k, appeal: e.target.value })} placeholder="Iftar 1448" /></label>
                <button className="eg-btn black"><Plus size={16} aria-hidden="true" />Add keyword</button>
                <p id="cp-kw-err" className="eg-cp-err" role="status">{tried ? problem ?? amountProblem ?? "" : ""}</p>
            </form>}
        </Card>
    );
};
