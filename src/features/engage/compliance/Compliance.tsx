/**
 * Receipts and safety (/engage/receipts): US tax receipts and year-end statements, the EIN check that switches payments on, and the
 * card-testing limits with what they blocked this week. Admins change settings; editors can resend receipts; viewers read.
 * Data: ./data (the SQL API and edge functions, or the in-memory sample in the demo).
 */
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { Check, DownloadSimple, IdentificationCard, PaperPlaneTilt, Receipt, ShieldCheck, X } from "@phosphor-icons/react";
import { useApp } from "@/shared/lib/app-context";
import { cx } from "@/shared/utils/cx";
import { Card, Empty, StatStrip, Tabs, Tag, type Tone } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import { type Store, previewOf, useCompliance } from "./data";
import { type Compliance as C, type EinResult, type FraudSettings, type Receipt as Doc, type ReceiptRow, REASON_LABEL, type Reason, footNotes, formatEin, longDate, money } from "./model";
import "./compliance.css";

type Tab = "receipts" | "ein" | "fraud";
const EIN_TAG: Record<C["ein_status"], [Tone, string]> = { unverified: ["grey", "Not verified"], verified: ["sage", "Verified 501(c)(3)"], review: ["lilac", "In review"], failed: ["peach", "Not found"], revoked: ["peach", "Exemption revoked"] };
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const Compliance = () => {
    const ws = useWorkspace(), { toast } = useApp();
    const store = useCompliance();
    const [tab, setTab] = useState<Tab>(() => (["ein", "fraud"].includes(location.hash.slice(1)) ? location.hash.slice(1) as Tab : "receipts"));
    const [busy, setBusy] = useState(false);
    const admin = ws.role === "owner" || ws.role === "admin", editor = admin || ws.role === "editor";
    const act = async <T,>(f: () => Promise<T>, done?: (r: T) => string) => {
        setBusy(true);
        try { const r = await f(); if (done) toast(done(r)); return r; } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };
    const go = (t: Tab) => { setTab(t); history.replaceState(null, "", `#${t}`); };

    if (store.state === "loading") return <div className="eg-skeleton tall" aria-busy="true"><span className="eg-sr">Loading receipts and safety</span></div>;
    if (store.state === "error") return <Card title="Receipts and safety"><Empty>This screen could not be loaded: {store.error}</Empty></Card>;
    const { c, log, receipts } = store, [tone, label] = EIN_TAG[c.ein_status];
    const props = { store, admin, editor, busy, act };

    return (
        <div className="eg-cp">
            <header className="eg-cp-head">
                <div>
                    <h1>Receipts and safety</h1>
                    <p className="eg-muted">Tax receipts, charity verification and fraud limits: what has to work before a single live gift.</p>
                </div>
                <p className="eg-cp-pay">{c.payments_ready ? <Tag tone="forest"><ShieldCheck size={14} aria-hidden="true" />Payments on</Tag> : <Tag tone="peach">Payments off until the EIN is verified</Tag>}</p>
            </header>

            <Card className="eg-card-strip eg-cp-kpis"><h2 className="eg-sr">Key numbers</h2><StatStrip items={[
                { label: "Receipts issued", value: receipts.length.toLocaleString("en-US"), note: receipts.length ? `Latest ${receipts[0].number}` : "None yet" },
                { label: "To send", value: c.receipts_unsent, note: c.receipt_now ? "Sent the moment a gift is paid" : "Sending is off; $250+ still go" },
                { label: "EIN", value: <Tag tone={tone}>{label}</Tag>, note: c.ein ? `EIN ${formatEin(c.ein)}` : "No EIN yet" },
                { label: "Blocked this week", value: log.blocked.toLocaleString("en-US"), note: `${log.declines} declines, ${log.alerts.length} alert${log.alerts.length === 1 ? "" : "s"}` },
            ]} /></Card>

            <Tabs id="eg-cp" label="Section" value={tab} onChange={go} items={[
                { id: "receipts", label: "Receipts", icon: <Receipt size={18} aria-hidden="true" /> },
                { id: "ein", label: "EIN check", icon: <IdentificationCard size={18} aria-hidden="true" /> },
                { id: "fraud", label: "Fraud controls", icon: <ShieldCheck size={18} aria-hidden="true" /> },
            ]} />
            <div id="eg-cp-panel" role="tabpanel" aria-labelledby={`eg-cp-tab-${tab}`} className="eg-cp-panel">
                {tab === "receipts" ? <Receipts {...props} /> : tab === "ein" ? <Ein {...props} /> : <Fraud {...props} />}
            </div>
            {ws.sample && <p className="eg-muted eg-cp-foot">Sample receipts and blocked attempts. In the demo the EIN check uses the sandbox records and nothing is sent.</p>}
        </div>
    );
};

type Props = { store: Store; admin: boolean; editor: boolean; busy: boolean; act: <T>(f: () => Promise<T>, done?: (r: T) => string) => Promise<T | undefined> };

/** A switch row: title, a line of explanation, and a native checkbox styled as a switch. */
const Toggle = ({ title, note, checked, disabled, onChange }: { title: string; note: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) => {
    const id = useId();
    return (
        <div className="eg-cp-toggle">
            <span><b id={id}>{title}</b><small>{note}</small></span>
            <input type="checkbox" role="switch" className="eg-cp-switch" aria-labelledby={id} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        </div>
    );
};

// ---------------------------------------------------------------- receipts
const Receipts = ({ store, admin, editor, busy, act }: Props) => {
    const { c } = store, set = (p: Partial<C>) => act(() => store.save(p), () => "Receipt settings saved");
    return (
        <div className="eg-cp-grid">
            <Card title="Receipt settings">
                <Toggle title="Email a receipt the moment a gift is paid" note="Every gift, not only those of $250 or more" checked={c.receipt_now} disabled={!admin || busy} onChange={(v) => set({ receipt_now: v })} />
                <Toggle title="Year-end giving statement in January" note="One statement per donor for their tax return" checked={c.receipt_year_end} disabled={!admin || busy} onChange={(v) => set({ receipt_year_end: v })} />
                <Toggle title="Add the “no goods or services” line" note="Required wording on acknowledgments of $250 or more" checked={c.receipt_goods_line} disabled={!admin || busy} onChange={(v) => set({ receipt_goods_line: v })} />
                <p className="eg-muted eg-cp-note">IRS rules require a written acknowledgment for any single gift of $250 or more: it is always sent, even with instant receipts off. Receipts show the charity’s legal name, EIN, address, date, amount and fund; covered fees and add-ons are separate lines, so the Zakat amount stays exact.</p>
                {!admin && <p className="eg-muted eg-cp-note">Only admins can change these settings.</p>}
            </Card>
            <Card title="Receipt preview" action={<span className="eg-chip">Next receipt</span>}><ReceiptView doc={previewOf(store.issuer, store.receipts[0])} /></Card>
            <RecentReceipts store={store} editor={editor} busy={busy} act={act} />
            <YearEnd store={store} admin={admin} busy={busy} act={act} />
        </div>
    );
};

/** The receipt as the donor sees it, built by the same code as the email and the PDF. */
const ReceiptView = ({ doc }: { doc: Doc }) => {
    const o = doc.org, total = doc.lines.filter((l) => l.deductible).reduce((n, l) => n + l.amount_cents, 0);
    return (
        <article className="eg-cp-receipt" aria-label={`Receipt ${doc.number}`}>
            <header><b>{o.legal_name || o.name}</b><span>Receipt {doc.number}</span></header>
            <p className="eg-cp-r-sub">{[o.ein ? `EIN ${formatEin(o.ein)}` : "No EIN yet", o.address || "No address yet"].join(" · ")}</p>
            <p>Received from <b>{doc.donor_name}</b> on {longDate(doc.date)} (Night 27)</p>
            <dl>{doc.lines.map((l) => <div key={l.label}><dt>{l.label}</dt><dd>{money(l.amount_cents, doc.currency)}</dd></div>)}
                <div className="tot"><dt>{o.ein ? "Total tax-deductible" : "Total gift"}</dt><dd>{money(total, doc.currency)}</dd></div></dl>
            {footNotes(doc).map((f) => <p key={f} className="eg-cp-r-foot">{f}</p>)}
        </article>
    );
};

const RecentReceipts = ({ store, editor, busy, act }: Omit<Props, "admin">) => {
    const rows = store.receipts.slice(0, 8);
    const resend = (r: ReceiptRow) => act(() => store.resend(r.id), (sent) => (sent ? `Receipt ${r.number} sent to ${r.donor_email}` : `Receipt ${r.number} could not be sent: no email provider is set up`));
    return (
        <Card title="Recent receipts" className="eg-cp-wide" action={<span className="eg-chip">{store.receipts.length.toLocaleString("en-US")} issued</span>}>
            {rows.length ? (
                <table className="eg-cp-table">
                    <caption className="eg-sr">Latest receipts, newest first</caption>
                    <thead><tr><th scope="col">Receipt</th><th scope="col">Donor</th><th scope="col">Date</th><th scope="col" className="n">Deductible</th><th scope="col">Status</th><th scope="col"><span className="eg-sr">Actions</span></th></tr></thead>
                    <tbody>{rows.map((r) => (
                        <tr key={r.id}>
                            <th scope="row"><b>{r.number}</b><small>{r.kind === "year_end" ? `Statement ${r.year}` : r.fund || "Gift"}{r.irs_ack ? " · $250+" : ""}</small></th>
                            <td data-label="Donor">{r.donor_name}<small>{r.donor_email}</small></td>
                            <td data-label="Date">{shortDate(r.dated)}</td>
                            <td className="n" data-label="Deductible">{money(Number(r.deductible_cents), r.currency)}</td>
                            <td data-label="Status">{r.sent_at ? <Tag tone="sage">Sent</Tag> : <Tag tone="peach">To send</Tag>}</td>
                            <td className="eg-cp-act">
                                <button type="button" className="eg-btn white sm" onClick={() => store.pdf(r)}><DownloadSimple size={16} aria-hidden="true" />PDF<span className="eg-sr"> of receipt {r.number}</span></button>
                                {editor && r.donor_email && <button type="button" className="eg-btn white sm" disabled={busy} onClick={() => resend(r)}><PaperPlaneTilt size={16} aria-hidden="true" />{r.sent_at ? "Resend" : "Send"}<span className="eg-sr"> receipt {r.number}</span></button>}
                            </td>
                        </tr>
                    ))}</tbody>
                </table>
            ) : <Empty>No receipts yet. Each paid gift gets one, numbered {previewOf(store.issuer).number.replace(/\d+$/, "00001")} onwards.</Empty>}
        </Card>
    );
};

const YearEnd = ({ store, admin, busy, act }: Omit<Props, "editor">) => {
    const last = new Date().getFullYear() - 1, [year, setYear] = useState(Math.max(2027, last));
    const [result, setResult] = useState<string>();
    const run = async (dry: boolean) => {
        const r = await act(() => store.yearEnd(year, dry));
        if (r) setResult(dry ? `${r.donors.toLocaleString("en-US")} donors would get a ${year} statement.` : `${r.issued.toLocaleString("en-US")} statements issued, ${r.sent.toLocaleString("en-US")} emailed.`);
    };
    return (
        <Card title="Year-end statements" className="eg-cp-wide">
            <p className="eg-muted">One statement per donor listing every gift of the year, for their tax return. {store.c.receipt_year_end ? "They go out automatically in mid-January." : "Automatic sending is off; run them here."}</p>
            <div className="eg-cp-row">
                <label className="eg-cp-field sm"><span>Year</span><select value={year} onChange={(e) => setYear(Number(e.target.value))}>{[2027, 2028, 2029].filter((y) => y <= new Date().getFullYear()).concat(year).filter((y, i, a) => a.indexOf(y) === i).map((y) => <option key={y}>{y}</option>)}</select></label>
                <button type="button" className="eg-btn white" disabled={!admin || busy} onClick={() => run(true)}>Dry run</button>
                <button type="button" className="eg-btn black" disabled={!admin || busy} onClick={() => run(false)}><PaperPlaneTilt size={18} aria-hidden="true" />Send statements</button>
            </div>
            <p className="eg-muted" aria-live="polite">{result ?? (admin ? "A dry run counts the donors and sends nothing." : "Only admins can send statements.")}</p>
        </Card>
    );
};

// ---------------------------------------------------------------- EIN check
const Ein = ({ store, admin, busy, act }: Props) => {
    const { c } = store, [res, setRes] = useState<EinResult | null>(null), [tone, label] = EIN_TAG[c.ein_status];
    const submit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget), s = (k: string) => String(f.get(k) ?? "").trim();
        const saved = await act(() => store.save({ legal_name: s("legal"), address: s("address"), contact_email: s("contact") }).then(() => true));
        if (!saved) return;
        const r = await act(() => store.checkEin(s("ein")));
        if (r) setRes(r);
    };
    const shown: EinResult | null = res ?? (c.ein_check ? { ein: c.ein, status: c.ein_status === "unverified" ? "failed" : c.ein_status, record: null, steps: [], message: "" } : null);
    return (
        <div className="eg-cp-grid">
            <Card title="Verify the charity before it goes live" action={<Tag tone={tone}>{label}</Tag>}>
                <p className="eg-muted">Payments stay off until the EIN matches an exempt 501(c)(3) that is not on the IRS auto-revocation list.</p>
                <form className="eg-cp-form" onSubmit={submit}>
                    <label className="eg-cp-field"><span>EIN</span><input name="ein" defaultValue={c.ein ? formatEin(c.ein) : ""} placeholder="12-3456789" inputMode="numeric" autoComplete="off" required pattern="\d{2}-?\d{7}" disabled={!admin} /></label>
                    <label className="eg-cp-field"><span>Legal name</span><input name="legal" defaultValue={c.legal_name} placeholder="As on the IRS determination letter" autoComplete="organization" disabled={!admin} /></label>
                    <label className="eg-cp-field"><span>Address on receipts</span><input name="address" defaultValue={c.address} placeholder="410 Park Ave, Plainfield, NJ 07060" autoComplete="street-address" disabled={!admin} /></label>
                    <label className="eg-cp-field"><span>Contact email (donors’ replies go here)</span><input name="contact" type="email" defaultValue={c.contact_email} placeholder="donations@yourcharity.org" autoComplete="email" disabled={!admin} /><small>Receipts and journey emails go out as “{store.issuer.name} via Outgive”; a donor who replies reaches this inbox.</small></label>
                    {!c.contact_email && <p className="eg-cp-warn" role="note">No contact email yet, so donors’ replies to receipts go nowhere. Add an inbox someone reads.</p>}
                    {admin ? <button className="eg-btn black" disabled={busy}><ShieldCheck size={18} aria-hidden="true" />Save and check EIN</button> : <p className="eg-muted">Only admins can change the EIN.</p>}
                </form>
                <p className="eg-muted eg-cp-note">{store.c.ein_check?.source === "propublica" ? "Checked against IRS exempt-organization records (via ProPublica Nonprofit Explorer)." : "Sandbox: try 12-3456789 (passes) or 98-7654321 (revoked). Live mode checks IRS exempt-organization records."}</p>
            </Card>
            <Card title="Result" action={c.ein_checked_at ? <span className="eg-chip">Checked {shortDate(c.ein_checked_at)}</span> : undefined}>
                {shown ? <EinView r={shown} check={c.ein_check} /> : <Empty>No check yet. Enter the EIN and the result shows here, step by step.</Empty>}
            </Card>
        </div>
    );
};

const EinView = ({ r, check }: { r: EinResult; check: C["ein_check"] }) => {
    const rec = r.record ?? (check ? { name: check.name, city: check.city, state: check.state } : null);
    const steps = r.steps.length ? r.steps : check ? [
        { label: "Format: nine digits", ok: true }, { label: "Found in IRS exempt organization records", ok: check.found },
        ...(check.found ? [{ label: "501(c)(3) status current", ok: check.subsection === 3 && !check.revoked }, { label: "Not on the auto-revocation list", ok: !check.revoked }] : []),
    ] : [];
    const ok = r.status === "verified";
    return (
        <div className="eg-cp-ein" aria-live="polite">
            <div className={cx("eg-cp-ein-head", ok ? "ok" : "no")}>
                <span aria-hidden="true">{ok ? <Check size={20} weight="bold" /> : <X size={20} weight="bold" />}</span>
                <div><b>{rec?.name || (r.status === "failed" ? "No match" : "Unknown")}</b><small>{[rec?.city, rec?.state].filter(Boolean).join(", ") || `EIN ${formatEin(r.ein)}`}</small></div>
            </div>
            <ol className="eg-cp-steps">{steps.map((s) => (
                <li key={s.label} className={s.ok ? "ok" : "no"}><span aria-hidden="true">{s.ok ? <Check size={14} weight="bold" /> : <X size={14} weight="bold" />}</span>{s.label}<span className="eg-sr">{s.ok ? ": passed" : ": failed"}</span></li>
            ))}</ol>
            {r.message && <p className="eg-muted">{r.message}</p>}
        </div>
    );
};

// ---------------------------------------------------------------- fraud controls
const NUMS: [keyof FraudSettings, string, string, number, number][] = [
    ["min_cents", "Minimum gift ($)", "Card testers try tiny amounts", 1, 1000], ["ip_per_10min", "Attempts per IP in 10 minutes", "The next one is blocked", 1, 100],
    ["card_per_hour", "Attempts per card in an hour", "Also set as a Radar rule", 1, 100], ["challenge_after", "Challenge after declines", "0 turns the challenge off", 0, 20],
    ["decline_alert", "Alert after declines in 10 minutes", "0 turns alerts off", 0, 1000],
];
const Fraud = ({ store, admin, busy, act }: Props) => {
    const { c, log } = store;
    const [draft, setDraft] = useState<FraudSettings>(c.fraud);
    const dirty = JSON.stringify(draft) !== JSON.stringify(c.fraud);
    const val = (k: keyof FraudSettings) => (k === "min_cents" ? Number(draft[k]) / 100 : Number(draft[k]));
    const setNum = (k: keyof FraudSettings, v: number) => setDraft((d) => ({ ...d, [k]: k === "min_cents" ? Math.round(v * 100) : Math.round(v) }));
    return (
        <div className="eg-cp-grid">
            <Card title="Card-testing protection" action={admin && dirty ? <span className="eg-cp-save">
                <button type="button" className="eg-btn white sm" onClick={() => setDraft(c.fraud)}>Discard</button>
                <button type="button" className="eg-btn black sm" disabled={busy} onClick={() => act(() => store.saveFraud(draft), () => "Fraud controls saved")}>Save changes</button>
            </span> : undefined}>
                <p className="eg-muted">Donation forms attract stolen-card testing. These limits apply before a charge reaches Stripe.</p>
                <div className="eg-cp-nums">{NUMS.map(([k, l, note, min, max]) => (
                    <label key={k} className="eg-cp-field"><span>{l}</span><input type="number" min={min} max={max} step={1} value={val(k)} disabled={!admin} onChange={(e) => setNum(k, Math.max(min, Math.min(max, Number(e.target.value) || 0)))} /><small>{note}</small></label>
                ))}</div>
                <Toggle title="Block disposable email addresses" note="Throwaway inboxes never get the receipt anyway" checked={draft.block_disposable} disabled={!admin} onChange={(v) => setDraft((d) => ({ ...d, block_disposable: v }))} />
                <Toggle title="Stripe Radar on each connected account" note="A platform’s own Radar rules do not cover direct charges" checked={draft.radar} disabled={!admin} onChange={(v) => setDraft((d) => ({ ...d, radar: v }))} />
                {!admin && <p className="eg-muted eg-cp-note">Only admins can change these limits.</p>}
            </Card>
            <Card title="Blocked this week" action={<span className="eg-cp-big">{log.blocked.toLocaleString("en-US")}</span>}>
                {log.by_reason.length ? (
                    <table className="eg-cp-table compact">
                        <caption className="eg-sr">Blocked attempts by reason, this week</caption>
                        <thead><tr><th scope="col">Last</th><th scope="col">Reason</th><th scope="col" className="n">Tries</th></tr></thead>
                        <tbody>{log.by_reason.map((r) => (
                            <tr key={r.reason}><td data-label="Last">{when(r.last)}</td><th scope="row">{reasonText(r.reason, c.fraud)}</th><td className="n" data-label="Tries">{r.n}</td></tr>
                        ))}</tbody>
                    </table>
                ) : <Empty>Nothing blocked this week.</Empty>}
                {log.alerts.length > 0 && <p className="eg-cp-alert"><Tag tone="peach">Alert</Tag>A burst of declines on {when(log.alerts[0].at)}. Check Stripe for a card-testing run.</p>}
                <p className="eg-muted eg-cp-note">{log.declines} declines and {log.challenged} challenges in the same week.</p>
            </Card>
        </div>
    );
};

const reasonText = (r: Reason, s: FraudSettings): ReactNode => ({
    below_minimum: `Under the $${s.min_cents / 100} minimum`, ip_rate: `Same IP over ${s.ip_per_10min} attempts`, card_rate: `Same card over ${s.card_per_hour} attempts`,
    challenge_failed: `Challenge failed after ${s.challenge_after} declines`, disposable_email: REASON_LABEL.disposable_email,
}[r] ?? REASON_LABEL[r]);
