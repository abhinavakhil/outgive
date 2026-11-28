/**
 * Pledge recovery: every pledge from the live nights and dinners, what has come in against it, and the reminder sequence that
 * collects the rest. Editors act (add, log a payment, pause, write off, edit the sequence, run recovery); viewers read, and the
 * database leaves out donors' contact details for them. Data: ./data (the SQL API, or the in-memory sample in the demo).
 */
import { type FormEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowsClockwise, DotsThreeVertical, HandCoins, MagnifyingGlass, Phone, Plus } from "@phosphor-icons/react";
import { useApp } from "@/shared/lib/app-context";
import { cx } from "@/shared/utils/cx";
import { Card, Empty, StatStrip } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import { type Store, usePledges } from "./data";
import { type Channel, type OfflineMethod, type Pledge, type PledgeStatus, type Reminder, type Step, METHOD_LABEL, STATUS_LABEL, STEP_LABEL, byEvent, isOpen, isTask, kpis, payUrl, remaining } from "./model";
import "./pledges.css";

const STATUS_ORDER: PledgeStatus[] = ["overdue", "part_paid", "open", "paid", "written_off"];
const OFFLINE: OfflineMethod[] = ["cash", "check", "zelle", "ach", "card", "other"];
const CHANNEL_SETS: [string, Channel[]][] = [["SMS", ["sms"]], ["Email", ["email"]], ["Email + SMS", ["email", "sms"]]];
const channelsLabel = (c: Channel[]) => (c.includes("task") ? "Task" : CHANNEL_SETS.find(([, v]) => v.length === c.length && v.every((x) => c.includes(x)))?.[0] ?? c.join(" + "));
const dayLabel = (d: number) => (d === 0 ? "Night 0" : `Day ${d}`);
/** +12125550101 reads as (212) 555-0101; other numbers stay as stored. */
const phone = (p: string) => p.match(/^\+1(\d{3})(\d{3})(\d{4})$/)?.slice(1).reduce((a, x, i) => a + [`(${x}) `, `${x}-`, x][i], "") ?? p;
const shortDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No date");

export const StatusTag = ({ s }: { s: PledgeStatus }) => <span className={cx("eg-tag", "eg-pl-st", s)}>{STATUS_LABEL[s]}</span>;

// ---------------------------------------------------------------- dialog (native <dialog>: focus trap, Escape and inert page for free)
const Dialog = ({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) => {
    const ref = useRef<HTMLDialogElement>(null), id = useId();
    useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
    return (
        <dialog ref={ref} className="eg-pl-dialog" aria-labelledby={id} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
            {open && <><h2 id={id}>{title}</h2>{children}</>}
        </dialog>
    );
};
const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => <label className="eg-pl-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;

type Modal = { kind: "add" } | { kind: "pay" | "off" | "history"; p: Pledge } | null;

// ---------------------------------------------------------------- the screen
export const Pledges = () => {
    const ws = useWorkspace(), { toast } = useApp();
    const store = usePledges();
    const can = ws.role !== "viewer";
    const c = (cents: number) => ws.money(cents / 100);
    const [modal, setModal] = useState<Modal>(null);
    const [busy, setBusy] = useState(false);
    const act = async (f: () => Promise<unknown>, done?: string) => {
        setBusy(true);
        try { await f(); if (done) toast(done); setModal(null); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };
    const run = () => act(async () => {
        const r = await store.run();
        toast(ws.sample ? `${r.sent} reminders queued; ${r.paid ?? 0} paid by the link (sample, nothing sent)` : r.sent + r.failed + r.skipped ? `${r.sent} sent, ${r.skipped} skipped${r.failed ? `, ${r.failed} failed` : ""}` : "Nothing due right now");
    });

    if (store.state === "loading") return <div className="eg-skeleton tall" aria-busy="true"><span className="eg-sr">Loading pledges</span></div>;
    if (store.state === "error") return <Card title="Pledge recovery"><Empty>Pledges could not be loaded: {store.error}</Empty></Card>;
    const t = kpis(store.pledges, store.today);

    return (
        <div className="eg-pl">
            <header className="eg-pl-head">
                <div>
                    <h1>Pledge recovery</h1>
                    <p className="eg-muted">Pledges from live nights and dinners get reminders and a one-tap pay link until they are paid or written off.</p>
                </div>
                {can && <div className="eg-pl-actions">
                    <button type="button" className="eg-btn white" onClick={() => setModal({ kind: "add" })}><Plus size={18} aria-hidden="true" />Add pledge</button>
                    <button type="button" className="eg-btn black" disabled={busy} onClick={run}><ArrowsClockwise size={18} aria-hidden="true" />Run recovery now</button>
                </div>}
            </header>

            <Card className="eg-card-strip eg-pl-kpis"><h2 className="eg-sr">Key numbers</h2><StatStrip items={[
                { label: "Pledged", value: ws.short(t.pledged_cents / 100), note: `${t.count} pledge${t.count === 1 ? "" : "s"}` },
                { label: "Collected", value: `${t.collected_pct}%`, note: `${c(t.collected_cents)} of ${c(t.pledged_cents)}` },
                { label: "Outstanding", value: ws.short(t.outstanding_cents / 100), note: `${t.outstanding_count} open, ${t.overdue_count} overdue` },
                { label: "Written off", value: ws.short(t.written_off_cents / 100), note: `${t.written_off_count} pledge${t.written_off_count === 1 ? "" : "s"}, reviewed by staff` },
            ]} /></Card>

            <div className="eg-pl-grid">
                <Progress store={store} c={c} />
                <CallList store={store} can={can} busy={busy} act={act} />
            </div>

            <Table store={store} can={can} c={c} setModal={setModal} act={act} />
            <Sequence store={store} can={can} act={act} />
            {ws.sample && <p className="eg-muted eg-pl-foot">Sample pledges. In the demo, reminders are simulated and nothing is sent.</p>}

            <Dialog title="Add a pledge" open={modal?.kind === "add"} onClose={() => setModal(null)}>
                <AddForm busy={busy} events={[...new Set(store.pledges.map((p) => p.event).filter(Boolean))]} onCancel={() => setModal(null)}
                    onSave={(p) => act(() => store.save(p), `Pledge from ${p.donor_name} added`)} />
            </Dialog>
            {modal && modal.kind !== "add" && <>
                <Dialog title={`Log a payment from ${modal.p.donor_name}`} open={modal.kind === "pay"} onClose={() => setModal(null)}>
                    <PayForm p={modal.p} c={c} busy={busy} onCancel={() => setModal(null)} onSave={(x) => act(() => store.pay(modal.p.id, x), `${c(x.amount_cents)} logged for ${modal.p.donor_name}`)} />
                </Dialog>
                <Dialog title={`Write off ${modal.p.donor_name}’s balance?`} open={modal.kind === "off"} onClose={() => setModal(null)}>
                    <p className="eg-muted">{c(remaining(modal.p))} of the {c(modal.p.amount_cents)} pledged at {modal.p.event || "the event"} moves to written off, and its reminders stop. You can undo this from the pledge’s menu.</p>
                    <div className="eg-pl-dlg-actions">
                        <button type="button" className="eg-btn white" onClick={() => setModal(null)}>Keep chasing</button>
                        <button type="button" className="eg-btn black" disabled={busy} onClick={() => act(() => store.save({ id: modal.p.id, written_off: true }), `${modal.p.donor_name}’s balance written off`)}>Write off {c(remaining(modal.p))}</button>
                    </div>
                </Dialog>
                <Dialog title={`Reminders to ${modal.p.donor_name}`} open={modal.kind === "history"} onClose={() => setModal(null)}>
                    <History load={() => store.history(modal.p.id)} />
                    <div className="eg-pl-dlg-actions"><button type="button" className="eg-btn white" onClick={() => setModal(null)}>Close</button></div>
                </Dialog>
            </>}
        </div>
    );
};

type Act = (f: () => Promise<unknown>, done?: string) => Promise<void>;

// ---------------------------------------------------------------- pledged against paid
const Progress = ({ store, c }: { store: Store; c: (n: number) => string }) => {
    const t = kpis(store.pledges, store.today), rows = byEvent(store.pledges);
    const pct = (n: number, of: number) => (of ? `${(n / of) * 100}%` : "0%");
    const Bar = ({ paid, out, off, of }: { paid: number; out: number; off: number; of: number }) => (
        <span className="eg-pl-bar" aria-hidden="true"><i className="paid" style={{ width: pct(paid, of) }} /><i className="out" style={{ width: pct(out, of) }} /><i className="off" style={{ width: pct(off, of) }} /></span>
    );
    return (
        <Card title="Pledged against paid">
            {t.count ? <>
                <div className="eg-pl-total">
                    <p><b>{c(t.collected_cents)}</b> paid of {c(t.pledged_cents)}</p>
                    <Bar paid={t.collected_cents} out={t.outstanding_cents} off={t.written_off_cents} of={t.pledged_cents} />
                    <ul className="eg-pl-key"><li><i className="paid" />Paid</li><li><i className="out" />Outstanding</li><li><i className="off" />Written off</li></ul>
                </div>
                <table className="eg-pl-events">
                    <caption className="eg-sr">Pledged and paid by event</caption>
                    <thead><tr><th scope="col">Event</th><th scope="col"><span className="eg-sr">Progress</span></th><th scope="col" className="n">Paid</th><th scope="col" className="n">Pledged</th></tr></thead>
                    <tbody>{rows.map((e) => (
                        <tr key={e.event || "none"}>
                            <th scope="row"><span>{e.event || "No event"}</span><small>{e.count} pledge{e.count === 1 ? "" : "s"}</small></th>
                            <td className="eg-pl-ev-bar"><Bar paid={e.collected_cents} out={e.outstanding_cents} off={e.written_off_cents} of={e.pledged_cents} /></td>
                            <td className="n">{c(e.collected_cents)} <small className="eg-pl-pct">{Math.round((e.collected_cents / e.pledged_cents) * 100)}%</small></td>
                            <td className="n">{c(e.pledged_cents)}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </> : <Empty>No pledges yet. Add the pledges from tonight’s dinner and the sequence starts collecting them.</Empty>}
        </Card>
    );
};

// ---------------------------------------------------------------- call list
const CallList = ({ store, can, busy, act }: { store: Store; can: boolean; busy: boolean; act: Act }) => {
    const open = store.reminders.filter((r) => r.channel === "task" && r.status === "open");
    return (
        <Card title="Call list" action={<span className="eg-chip">{open.length} to call</span>}>
            {open.length ? <ul className="eg-pl-calls">{open.map((r) => (
                <li key={r.id}>
                    <span className="eg-todo-ic" aria-hidden="true"><Phone size={18} /></span>
                    <span><b>{r.donor_name}</b><small>{STEP_LABEL[r.action]} · {r.event || "Pledge"}</small>{r.donor_phone && <a href={`tel:${r.donor_phone}`}>{phone(r.donor_phone)}</a>}</span>
                    {can && <button type="button" className="eg-btn white sm" disabled={busy} onClick={() => act(() => store.taskDone(r.id), `${r.donor_name} marked as called`)}>Done<span className="eg-sr"> calling {r.donor_name}</span></button>}
                </li>
            ))}</ul> : <Empty>Nobody to call. Pledges still open on day 21 of the sequence land here for a volunteer to phone.</Empty>}
        </Card>
    );
};

// ---------------------------------------------------------------- the pledges
const Table = ({ store, can, c, setModal, act }: { store: Store; can: boolean; c: (n: number) => string; setModal: (m: Modal) => void; act: Act }) => {
    const { toast } = useApp();
    const [q, setQ] = useState(""), [status, setStatus] = useState<PledgeStatus | "">(""), [event, setEvent] = useState("");
    const events = useMemo(() => [...new Set(store.pledges.map((p) => p.event).filter(Boolean))].sort(), [store.pledges]);
    const rows = store.pledges
        .filter((p) => (!status || p.status === status) && (!event || p.event === event) && (!q.trim() || `${p.donor_name} ${p.event}`.toLowerCase().includes(q.trim().toLowerCase())))
        .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || (a.due_date ?? "9").localeCompare(b.due_date ?? "9"));
    const copy = (p: Pledge) => { void navigator.clipboard?.writeText(payUrl(p.pay_token, location.origin)).then(() => toast(`Pay link for ${p.donor_name} copied`), () => toast("Could not copy the link")); };
    return (
        <Card title="Pledges" action={<span className="eg-chip">{rows.length} of {store.pledges.length}</span>}>
            <div className="eg-pl-filters" role="search">
                <label className="eg-search eg-pl-search"><MagnifyingGlass size={18} aria-hidden="true" /><span className="eg-sr">Search pledges</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search donor or event" /></label>
                <label className="eg-pl-select"><span className="eg-sr">Status</span><select value={status} onChange={(e) => setStatus(e.target.value as PledgeStatus | "")}><option value="">All statuses</option>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
                <label className="eg-pl-select"><span className="eg-sr">Event</span><select value={event} onChange={(e) => setEvent(e.target.value)}><option value="">All events</option>{events.map((e) => <option key={e}>{e}</option>)}</select></label>
            </div>
            {rows.length ? (
                <table className="eg-pl-table">
                    <caption className="eg-sr">Pledges, overdue first</caption>
                    <thead><tr><th scope="col">Donor</th><th scope="col" className="n">Pledged</th><th scope="col" className="n">Paid</th><th scope="col">Due</th><th scope="col">Status</th><th scope="col">Reminders</th><th scope="col"><span className="eg-sr">Actions</span></th></tr></thead>
                    <tbody>{rows.map((p) => (
                        <tr key={p.id}>
                            <th scope="row"><b>{p.donor_name}</b><small>{p.event || "No event"}{p.donor_phone ? ` · ${phone(p.donor_phone)}` : ""}</small></th>
                            <td className="n" data-label="Pledged">{c(p.amount_cents)}</td>
                            <td className="n" data-label="Paid">{c(p.paid_cents)}{p.method && <small>{METHOD_LABEL[p.method]}</small>}</td>
                            <td data-label="Due">{shortDate(p.due_date)}</td>
                            <td data-label="Status"><StatusTag s={p.status} />{p.reminders_paused && isOpen(p) && <small>Paused</small>}</td>
                            <td data-label="Reminders">{p.reminders_sent}</td>
                            <td className="eg-pl-act"><RowMenu p={p} can={can} open={isOpen(p)} onCopy={() => copy(p)} setModal={setModal}
                                onPause={() => act(() => store.save({ id: p.id, reminders_paused: !p.reminders_paused }), p.reminders_paused ? `Reminders to ${p.donor_name} resumed` : `Reminders to ${p.donor_name} paused`)}
                                onUndo={() => act(() => store.save({ id: p.id, written_off: false }), `${p.donor_name}’s pledge is open again`)} /></td>
                        </tr>
                    ))}</tbody>
                </table>
            ) : <Empty>{store.pledges.length ? "No pledge matches these filters." : "No pledges yet."}</Empty>}
        </Card>
    );
};

/** A row's actions in a native <details> menu, so it opens from the keyboard and closes with Escape. */
const RowMenu = ({ p, can, open, onCopy, onPause, onUndo, setModal }: { p: Pledge; can: boolean; open: boolean; onCopy: () => void; onPause: () => void; onUndo: () => void; setModal: (m: Modal) => void }) => {
    const ref = useRef<HTMLDetailsElement>(null);
    const close = (f: () => void) => () => { if (ref.current) ref.current.open = false; f(); };
    const items: [string, () => void][] = [
        ...(can && open ? [["Log cash, check or Zelle", () => setModal({ kind: "pay", p })] as [string, () => void]] : []),
        ...(open ? [["Copy pay link", onCopy] as [string, () => void]] : []),
        ...(can && open ? [[p.reminders_paused ? "Resume reminders" : "Pause reminders", onPause] as [string, () => void], ["Write off…", () => setModal({ kind: "off", p })] as [string, () => void]] : []),
        ...(can && p.written_off ? [["Undo write-off", onUndo] as [string, () => void]] : []),
        ["Reminder history", () => setModal({ kind: "history", p })],
    ];
    return (
        <details ref={ref} className="eg-kebab" onKeyDown={(e) => { if (e.key === "Escape" && ref.current) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); } }}>
            <summary aria-label={`Actions for ${p.donor_name}`} className="eg-icon-btn sm"><DotsThreeVertical size={20} weight="bold" aria-hidden="true" /></summary>
            <ul className="eg-menu wide">{items.map(([l, f]) => <li key={l}><button type="button" onClick={close(f)}>{l}</button></li>)}</ul>
        </details>
    );
};

const History = ({ load }: { load: () => Promise<Reminder[]> }) => {
    const [rs, setRs] = useState<Reminder[] | null>(null);
    useEffect(() => { load().then(setRs, () => setRs([])); }, []);
    if (!rs) return <p className="eg-muted" aria-busy="true">Loading…</p>;
    if (!rs.length) return <p className="eg-muted">No reminders yet. The first goes out on the night of the pledge.</p>;
    const label: Record<Reminder["status"], string> = { pending: "Queued", sending: "Sending", sent: "Sent", failed: "Failed", skipped: "Skipped", open: "To call", done: "Called" };
    return (
        <ol className="eg-pl-history">{rs.map((r) => (
            <li key={r.id}><b>{STEP_LABEL[r.action]}</b><span>{r.channel === "task" ? "Task" : r.channel === "sms" ? "SMS" : "Email"} · {label[r.status]}{r.provider === "console" ? " (not really sent)" : ""} · {new Date(r.sent_at ?? r.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>{r.error && <small>{r.error}</small>}</li>
        ))}</ol>
    );
};

// ---------------------------------------------------------------- forms
const dollars = (v: FormDataEntryValue | null) => Math.round(Number(String(v ?? "").replace(/[$,\s]/g, "")) * 100);

const AddForm = ({ events, busy, onSave, onCancel }: { events: string[]; busy: boolean; onSave: (p: { donor_name: string; event: string; amount_cents: number; due_date: string | null; donor_email: string | null; donor_phone: string | null }) => void; onCancel: () => void }) => {
    const list = useId();
    const submit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget), s = (k: string) => String(f.get(k) ?? "").trim();
        onSave({ donor_name: s("name"), event: s("event"), amount_cents: dollars(f.get("amount")), due_date: s("due") || null, donor_email: s("email") || null, donor_phone: s("phone") || null });
    };
    return (
        <form className="eg-pl-form" onSubmit={submit}>
            <Field label="Donor name"><input name="name" required maxLength={120} autoComplete="off" /></Field>
            <div className="eg-pl-row2">
                <Field label="Amount pledged ($)"><input name="amount" required inputMode="decimal" pattern="[0-9,]+(\.[0-9]{1,2})?" placeholder="1,000" /></Field>
                <Field label="Due date"><input name="due" type="date" /></Field>
            </div>
            <Field label="Event"><input name="event" list={list} maxLength={80} placeholder="Night 27 dinner" /><datalist id={list}>{events.map((e) => <option key={e} value={e} />)}</datalist></Field>
            <div className="eg-pl-row2">
                <Field label="Email"><input name="email" type="email" autoComplete="off" /></Field>
                <Field label="Mobile" hint="For the thank-you text and its pay link"><input name="phone" type="tel" autoComplete="off" placeholder="(212) 555-0100" /></Field>
            </div>
            <div className="eg-pl-dlg-actions"><button type="button" className="eg-btn white" onClick={onCancel}>Cancel</button><button className="eg-btn black" disabled={busy}>Add pledge</button></div>
        </form>
    );
};

const PayForm = ({ p, c, busy, onSave, onCancel }: { p: Pledge; c: (n: number) => string; busy: boolean; onSave: (x: { amount_cents: number; method: OfflineMethod; reference?: string }) => void; onCancel: () => void }) => {
    const left = remaining(p);
    const submit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({ amount_cents: dollars(f.get("amount")), method: f.get("method") as OfflineMethod, reference: String(f.get("ref") ?? "").trim() || undefined });
    };
    return (
        <form className="eg-pl-form" onSubmit={submit}>
            <p className="eg-muted">{c(left)} left of {c(p.amount_cents)}. A payment stops the reminders once the pledge is paid in full.</p>
            <div className="eg-pl-row2">
                <Field label="Amount ($)"><input name="amount" required inputMode="decimal" pattern="[0-9,]+(\.[0-9]{1,2})?" defaultValue={(left / 100).toFixed(left % 100 ? 2 : 0)} /></Field>
                <Field label="Paid by"><select name="method" defaultValue="cash">{OFFLINE.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</select></Field>
            </div>
            <Field label="Reference" hint="Check number or Zelle confirmation, optional"><input name="ref" maxLength={80} autoComplete="off" /></Field>
            <div className="eg-pl-dlg-actions"><button type="button" className="eg-btn white" onClick={onCancel}>Cancel</button><button className="eg-btn black" disabled={busy}><HandCoins size={18} aria-hidden="true" />Log payment</button></div>
        </form>
    );
};

// ---------------------------------------------------------------- recovery sequence
const Sequence = ({ store, can, act }: { store: Store; can: boolean; act: Act }) => {
    const [draft, setDraft] = useState<Step[]>(store.steps);
    useEffect(() => setDraft(store.steps), [store.steps]);
    const dirty = JSON.stringify(draft) !== JSON.stringify(store.steps);
    const set = (i: number, patch: Partial<Step>) => setDraft((d) => d.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    return (
        <Card title="Recovery sequence" action={can && dirty ? <span className="eg-pl-seq-save">
            <button type="button" className="eg-btn white sm" onClick={() => setDraft(store.steps)}>Discard</button>
            <button type="button" className="eg-btn black sm" onClick={() => act(() => store.saveSteps([...draft].sort((a, b) => a.day - b.day)), "Recovery sequence saved")}>Save changes</button>
        </span> : undefined}>
            <p className="eg-muted">Runs for every unpaid pledge, counted from the night it was made. A payment in full stops it at once.</p>
            <ol className="eg-pl-steps">{draft.map((s, i) => {
                const task = isTask(s.action), id = `eg-pl-step-${i}`;
                return (
                    <li key={s.id ?? i} className={cx(!s.enabled && "off")}>
                        <label className="eg-pl-day"><span className="eg-sr">Day after the pledge for {STEP_LABEL[s.action]}</span>
                            <span aria-hidden="true">{s.day === 0 ? "Night" : "Day"}</span>
                            <input type="number" min={0} max={365} value={s.day} disabled={!can} onChange={(e) => set(i, { day: Math.max(0, Math.min(365, Math.round(Number(e.target.value) || 0))) })} />
                        </label>
                        <span className="eg-pl-step-t"><b id={id}>{STEP_LABEL[s.action]}</b><small>{dayLabel(s.day)} · {channelsLabel(s.channels)}</small></span>
                        {task ? <span className="eg-chip">Task</span> : (
                            <label className="eg-pl-select sm"><span className="eg-sr">Channel for {STEP_LABEL[s.action]}</span>
                                <select value={channelsLabel(s.channels)} disabled={!can} onChange={(e) => set(i, { channels: CHANNEL_SETS.find(([l]) => l === e.target.value)![1] })}>{CHANNEL_SETS.map(([l]) => <option key={l}>{l}</option>)}</select>
                            </label>
                        )}
                        <input type="checkbox" role="switch" className="eg-pl-switch" aria-labelledby={id} checked={s.enabled} disabled={!can} onChange={(e) => set(i, { enabled: e.target.checked })} />
                    </li>
                );
            })}</ol>
            {!can && <p className="eg-muted">Only editors can change the sequence.</p>}
        </Card>
    );
};

