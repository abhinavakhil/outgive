/**
 * After-Eid journey: the messages from Eid day to next Ramadan that bring donors back, plus the lapsed-donor and first-gift
 * anniversary triggers. Editors switch steps on and off, edit the words, preview them for any donor, send themselves a test and
 * start or pause the journey; viewers read. Data: ./data (the SQL API, or the in-memory sample in the demo).
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowsClockwise, PaperPlaneTilt, Pause, Play } from "@phosphor-icons/react";
import { useApp } from "@/shared/lib/app-context";
import { cx } from "@/shared/utils/cx";
import { Card, Empty, StatStrip, Tag } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import { type JStore, useJourneyStore } from "./data";
import { type Audience, type Channel, type Preview, type Step, type Trigger, render, unknownVars, varsFor } from "./model";
import "./journeys.css";

const TRIGGERS: [Trigger, string, string][] = [
    ["eid", "After Eid", "Counted from Eid al-Fitr, for this Ramadan's donors in the audience."],
    ["lapsed", "Lapsed donors", "Gave last Ramadan but not this one. Counted from Eid."],
    ["anniversary", "First-gift anniversary", "Counted from the anniversary of each donor's first gift."],
];
const AUDIENCES: [Audience, string][] = [["all", "All Ramadan donors"], ["first_time", "First-time donors"], ["returning", "Returning donors"]];
const CHANNELS: [string, Channel[]][] = [["Email", ["email"]], ["Email + SMS", ["email", "sms"]], ["SMS", ["sms"]]];
const chLabel = (c: Channel[]) => CHANNELS.find(([, v]) => v.length === c.length && v.every((x) => c.includes(x)))?.[0] ?? "Email";
const dayLabel = (s: Step) => (s.trigger === "anniversary" ? (s.day ? `Day ${s.day}` : "On the day") : s.day === 0 ? "Eid day" : `Day ${s.day}`);
const dateOf = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "0%");

export const Journey = () => {
    const ws = useWorkspace(), { toast } = useApp();
    const store = useJourneyStore();
    const can = ws.role !== "viewer";
    const [busy, setBusy] = useState(false);
    const act = async (f: () => Promise<unknown>, done?: string) => {
        setBusy(true);
        try { await f(); if (done) toast(done); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };

    if (store.state === "loading") return <div className="eg-skeleton tall" aria-busy="true"><span className="eg-sr">Loading the journey</span></div>;
    if (store.state === "error") return <Card title="After-Eid journey"><Empty>The journey could not be loaded: {store.error}</Empty></Card>;
    const { journey: j } = store, s = j.settings;
    const sent = j.steps.reduce((n, x) => n + (x.sent ?? 0), 0), clicked = j.steps.reduce((n, x) => n + (x.clicked ?? 0), 0);
    const back = j.steps.reduce((n, x) => n + (x.gave_again ?? 0) + (x.monthly ?? 0), 0), backCents = j.steps.reduce((n, x) => n + Number(x.converted_cents ?? 0), 0);
    const live = () => act(() => store.saveSettings({ live: !s.live }), s.live ? "Journey paused: nothing more goes out" : "Journey started");

    return (
        <div className="eg-jr">
            <header className="eg-jr-head">
                <div>
                    <h1>Bring Ramadan donors back</h1>
                    <p className="eg-muted">A planned year after Eid: thanks, proof of impact, then one clear ask at a time. A donor leaves the journey the moment they start a monthly gift.</p>
                </div>
                <div className="eg-jr-actions">
                    <Tag tone={s.live ? "sage" : "grey"}>{s.live ? "Live" : "Draft"}</Tag>
                    {can && s.live && <button type="button" className="eg-btn white" disabled={busy} onClick={() => act(async () => { const r = await store.run(); toast(r.sent + r.failed + r.skipped ? `${r.sent} sent, ${r.skipped} skipped${r.failed ? `, ${r.failed} failed` : ""}` : "Nothing due right now"); })}><ArrowsClockwise size={18} aria-hidden="true" />Run now</button>}
                    {can && <button type="button" className={cx("eg-btn", s.live ? "white" : "black")} disabled={busy} onClick={live}>{s.live ? <><Pause size={18} aria-hidden="true" />Pause journey</> : <><Play size={18} aria-hidden="true" />Start journey</>}</button>}
                </div>
            </header>

            <Card className="eg-card-strip"><h2 className="eg-sr">Key numbers</h2><StatStrip items={[
                { label: "Audience", value: j.audience[s.audience].toLocaleString("en-US"), note: `${AUDIENCES.find(([a]) => a === s.audience)![1]}, plus ${j.audience.lapsed.toLocaleString("en-US")} lapsed` },
                { label: "In the journey", value: j.enrolled.toLocaleString("en-US"), note: `${j.exited_monthly} went monthly, ${j.unsubscribed} opted out` },
                { label: "Messages sent", value: sent.toLocaleString("en-US"), note: `${pct(clicked, sent)} clicked through` },
                { label: "Came back", value: back.toLocaleString("en-US"), note: back ? `${ws.money(backCents / 100)} given after a message` : "Gifts after a message count here" },
            ]} /></Card>

            <Card title="Audience" action={<span className="eg-chip">Eid {dateOf(s.eid_date)}</span>}>
                <div className="eg-jr-seg" role="radiogroup" aria-label="Who gets the after-Eid steps">
                    {AUDIENCES.map(([a, l]) => (
                        <button key={a} type="button" role="radio" aria-checked={s.audience === a} disabled={!can || busy} className={cx(s.audience === a && "on")}
                            onClick={() => act(() => store.saveSettings({ audience: a }))}>{l}<small>{j.audience[a].toLocaleString("en-US")}</small></button>
                    ))}
                </div>
                <p className="eg-muted eg-jr-note">{s.season_label}: {dateOf(s.ramadan_start)} to Eid {dateOf(s.eid_date)}. Every email shows who it is from, your postal address{j.address ? ` (${j.address})` : ""} and a one-click unsubscribe.{!j.address && " Add your postal address in Receipts and safety before you start."}</p>
            </Card>

            <Steps store={store} can={can} act={act} />
            {store.sample && <p className="eg-muted eg-jr-foot">Sample journey. In the demo, nothing is sent and tests go nowhere.</p>}
        </div>
    );
};

type Act = (f: () => Promise<unknown>, done?: string) => Promise<void>;

// ---------------------------------------------------------------- the steps, and the editor with its preview
const Steps = ({ store, can, act }: { store: JStore; can: boolean; act: Act }) => {
    const [draft, setDraft] = useState<Step[]>(store.journey.steps);
    const [sel, setSel] = useState(() => Math.max(0, store.journey.steps.findIndex((x) => x.kind === "impact")));
    useEffect(() => setDraft(store.journey.steps), [store.journey.steps]);
    const dirty = JSON.stringify(draft) !== JSON.stringify(store.journey.steps);
    const set = (i: number, patch: Partial<Step>) => setDraft((d) => d.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    const save = () => act(() => store.saveSteps(draft.map(({ sent, clicked, gave_again, monthly, converted_cents, ...x }) => x)), "Journey saved");
    const step = draft[sel];

    return (
        <div className="eg-jr-split">
            <Card title="Steps" action={can && dirty ? <span className="eg-jr-save"><button type="button" className="eg-btn white sm" onClick={() => setDraft(store.journey.steps)}>Discard</button><button type="button" className="eg-btn black sm" onClick={save}>Save changes</button></span> : <span className="eg-chip">{draft.filter((x) => x.enabled).length} on</span>}>
                {TRIGGERS.map(([t, label, note]) => {
                    const rows = draft.map((x, i) => [x, i] as const).filter(([x]) => x.trigger === t);
                    if (!rows.length) return null;
                    return (
                        <section key={t} className="eg-jr-group" aria-label={label}>
                            <h3>{label}</h3><p className="eg-muted">{note}</p>
                            <ol className="eg-jr-steps">{rows.map(([x, i]) => {
                                const id = `eg-jr-step-${i}`;
                                return (
                                    <li key={x.id ?? i} className={cx(sel === i && "sel", !x.enabled && "off")}>
                                        <button type="button" className="eg-jr-pick" aria-pressed={sel === i} onClick={() => setSel(i)}>
                                            <span className="eg-jr-day">{dayLabel(x)}</span>
                                            <span className="eg-jr-t"><b id={id}>{x.title}</b><small>{chLabel(x.channels)}{x.sent ? ` · ${x.sent} sent · ${pct(x.clicked ?? 0, x.sent)} clicked` : ""}{(x.gave_again ?? 0) + (x.monthly ?? 0) ? ` · ${(x.gave_again ?? 0) + (x.monthly ?? 0)} came back` : ""}</small></span>
                                        </button>
                                        <input type="checkbox" role="switch" className="eg-jr-switch" aria-labelledby={id} checked={x.enabled} disabled={!can} onChange={(e) => set(i, { enabled: e.target.checked })} />
                                    </li>
                                );
                            })}</ol>
                        </section>
                    );
                })}
            </Card>
            {step && <Editor key={step.id ?? sel} step={step} store={store} can={can} act={act} onChange={(p) => set(sel, p)} />}
        </div>
    );
};

const Editor = ({ step, store, can, act, onChange }: { step: Step; store: JStore; can: boolean; act: Act; onChange: (p: Partial<Step>) => void }) => {
    const ws = useWorkspace();
    const pool = store.donors.filter((d) => step.trigger === "lapsed" ? d.segment === "lapsed" : d.segment !== "other");
    const [key, setKey] = useState(pool[0]?.key ?? "");
    const [p, setP] = useState<Preview | null>(null);
    useEffect(() => { if (!key) { setP(null); return; } let off = false; store.preview(key).then((x) => !off && setP(x), () => !off && setP(null)); return () => { off = true; }; }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
    const vars = useMemo(() => (p ? varsFor(p, p.org || ws.org.name, { site: location.origin, give_url: store.journey.settings.give_url }) : null), [p, ws.org.name, store.journey.settings.give_url]);
    const bad = [...new Set(unknownVars(`${step.subject} ${step.body} ${step.sms} ${step.cta_url}`))];
    const f = (k: "subject" | "body" | "sms" | "cta_label" | "cta_url", label: string, area = false) => (
        <label className="eg-jr-field"><span>{label}</span>
            {area ? <textarea value={step[k]} rows={k === "body" ? 5 : 2} disabled={!can} onChange={(e) => onChange({ [k]: e.target.value })} />
                : <input value={step[k]} disabled={!can} onChange={(e) => onChange({ [k]: e.target.value })} />}
        </label>
    );
    const r = (t: string) => (vars ? render(t, { ...vars, link: vars.give_url }) : t);
    return (
        <Card title={`${dayLabel(step)} · ${step.title}`} className="eg-jr-editor">
            <div className="eg-jr-row">
                <label className="eg-jr-field sm"><span>Day</span><input type="number" min={0} max={365} value={step.day} disabled={!can} onChange={(e) => onChange({ day: Math.max(0, Math.min(365, Math.round(Number(e.target.value) || 0))) })} /></label>
                <label className="eg-jr-field"><span>Sent by</span><select value={chLabel(step.channels)} disabled={!can} onChange={(e) => onChange({ channels: CHANNELS.find(([l]) => l === e.target.value)![1] })}>{CHANNELS.map(([l]) => <option key={l}>{l}</option>)}</select></label>
                <label className="eg-jr-field"><span>Preview for</span><select value={key} onChange={(e) => setKey(e.target.value)}>{pool.slice(0, 200).map((d) => <option key={d.key} value={d.key}>{d.donor_name}</option>)}</select></label>
            </div>

            <div className="eg-jr-mail" aria-label="Email preview">
                <p className="eg-jr-from">From {ws.org.name}</p>
                <h3>{r(step.subject) || "No subject"}</h3>
                <p>Assalamu alaikum {vars?.name ?? "friend"},</p>
                <p className="eg-jr-body">{r(step.body)}</p>
                {step.cta_label && step.cta_url && <span className="eg-jr-cta">{r(step.cta_label)}</span>}
                <p className="eg-jr-legal">You are receiving this because you gave to {ws.org.name}. {store.journey.address || "Your postal address goes here"}. Unsubscribe</p>
            </div>
            {step.channels.includes("sms") && <p className="eg-jr-sms" aria-label="Text message preview">{r(step.sms) || "No text message written"} Reply STOP to opt out.</p>}
            {bad.length > 0 && <p className="eg-jr-warn" role="status">Not a placeholder: {bad.map((b) => `{${b}}`).join(", ")}. Use {"{name}"}, {"{org}"}, {"{total}"}, {"{zakat}"}, {"{impact}"}, {"{report_url}"} and the like.</p>}

            <details className="eg-jr-edit" open={can}>
                <summary>Words and link</summary>
                {f("subject", "Subject")}
                {f("body", "Message", true)}
                {step.channels.includes("sms") && f("sms", "Text message ({link} is the tracked link)", true)}
                <div className="eg-jr-row">{f("cta_label", "Button")}{f("cta_url", "Button goes to")}</div>
            </details>
            {can && step.id && <div className="eg-jr-actions">
                <button type="button" className="eg-btn white sm" onClick={() => act(async () => { const x = await store.sendTest(step.id!, key || undefined); if (!x.ok) throw new Error(x.error ?? "The test did not send"); }, store.sample ? "Test sent (sample: nothing really sent)" : "Test sent to your email")}><PaperPlaneTilt size={16} aria-hidden="true" />Send me a test</button>
                <a className="eg-btn white sm" href="/engage/impact">Edit impact report</a>
            </div>}
        </Card>
    );
};
