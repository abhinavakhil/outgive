/**
 * The host console for a fundraising night (/demo/host, /o/<org>/host): staff on a phone log a pledge at a table in a few taps,
 * record cash, checks and Zelle as they come in, and watch tonight's pledged against paid. Editors and above only.
 * Every change also pushes tonight's numbers into the organisation's live state (org.live.pledged_usd / offline_usd), so the
 * live screen adds offline money to its total and shows what is pledged on its own line.
 * Pledges go through the pledge SQL API (savePledge, addPayment); in demo mode through the fixture in features/pledge-pay/source.ts.
 */
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowSquareOut, X } from "@phosphor-icons/react";
import { type OfflineMethod, type Pledge, METHOD_LABEL, STATUS_LABEL, pledgeUnpaid as unpaid, isoDay, payUrl, remaining } from "@/features/engage";
import { atLeast, useRoles } from "@/features/launch";
import { Frame, demoSource, liveSource, tonight } from "@/features/pledge-pay";
import type { Org } from "@/shared/domain/types";
import { useApp } from "@/shared/lib/app-context";
import { initials } from "@/shared/lib/format";
import { fmt } from "@/shared/lib/money";
import { cx } from "@/shared/utils/cx";

/** What the host console adds to the live state. In USD, like the rest of it. */
export type PledgeLive = { pledged_usd?: number; offline_usd?: number; pledge_event?: string };

const EVENT_KEY = "outgive.host.event";
const AMOUNTS = [100, 250, 500, 1000, 2500, 5000];
const DUE: [string, number][] = [["1 week", 7], ["1 month", 30], ["3 months", 90]];
const PAID_NOW: ["later" | OfflineMethod, string][] = [["later", "Pay later"], ["cash", "Cash"], ["check", "Check"], ["zelle", "Zelle"]];
const OFFLINE: OfflineMethod[] = ["cash", "check", "zelle", "card", "ach"];
const usd = (c: number) => fmt(c, "USD");
const dollars = (s: string) => Math.round(Number(s.replace(/[^0-9.]/g, "")) * 100) || 0;
const inDays = (n: number) => isoDay(new Date(Date.now() + n * 86400000));
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

/** A bottom sheet on the native <dialog>: focus trap, Escape and the backdrop come with it. */
const Sheet = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const d = ref.current; d?.showModal(); return () => d?.close(); }, []);
    return (
        <dialog ref={ref} className="hc-sheet" aria-label={title} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => e.target === ref.current && onClose()}>
            <div><div className="hc-sheet-top"><h2>{title}</h2><button type="button" className="hc-x" aria-label="Close" onClick={onClose}><X size={18} weight="bold" /></button></div>{children}</div>
        </dialog>
    );
};

const Chips = <T extends string | number>({ label, options, value, onPick }: { label: string; options: [T, string][]; value: T | null; onPick: (v: T) => void }) => (
    <div role="group" aria-label={label} className="hc-chips">{options.map(([v, l]) => <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onPick(v)}>{l}</button>)}</div>
);

export const HostConsole = () => {
    const { db, org, user, isDemo, setOrg, href, toast } = useApp();
    const roles = useRoles(), role = roles?.find((r) => r.slug === org!.slug)?.role ?? null;
    const src = useMemo(() => (isDemo ? demoSource() : liveSource(db)), [db, isDemo]);
    const [pledges, setPledges] = useState<Pledge[] | null>(null);
    const [loadError, setLoadError] = useState("");
    const [event, setEvent] = useState(() => store.get(EVENT_KEY) ?? "");
    const [sheet, setSheet] = useState<null | { kind: "pledge" } | { kind: "pay"; id?: string } | { kind: "saved"; p: Pledge; paid: boolean }>(null);
    const allowed = isDemo || atLeast(role, "editor");

    const load = useCallback(() => src.list(org!.id).then((ps) => { setPledges(ps); setLoadError(""); return ps; }, (e) => { setLoadError((e as Error).message); return null; }), [src, org]);
    useEffect(() => { if (allowed) void load(); }, [allowed, load]);
    // No event typed yet: tonight is the most recent pledge's event.
    useEffect(() => { if (!event && pledges?.[0]) setEvent(pledges[0].event); }, [pledges]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (event) store.set(EVENT_KEY, event); }, [event]);

    const t = useMemo(() => tonight(pledges ?? [], event), [pledges, event]);
    const events = useMemo(() => [...new Set((pledges ?? []).map((p) => p.event).filter(Boolean))], [pledges]);
    const list = (pledges ?? []).filter((p) => p.event === event);

    /** Reload, then put tonight's pledged and offline money on the live screen. Failing that (not a member) leaves the screen as it was. */
    const changed = async () => {
        const ps = await load(); if (!ps) return;
        const n = tonight(ps, event), live = { ...(org!.live ?? {}), pledged_usd: n.remaining_cents / 100, offline_usd: n.offline_cents / 100, pledge_event: event } as Org["live"] & PledgeLive;
        db.rpc<Org>("org_update", { org: org!.id, p: { live } }).then(setOrg, () => {});
    };

    if (!isDemo && !user) return <Frame><section className="pp-card pp-note"><h1 className="pp-h">Sign in to host</h1><p className="pp-sub">The host console is for {org!.name}’s team. Sign in with the email you were invited with.</p><a className="pp-btn black" href={`/ramadhan/login?next=${encodeURIComponent(location.pathname)}`}>Sign in</a></section></Frame>;
    if (!isDemo && roles === null) return <Frame><div className="pp-card pp-skel" aria-busy="true" aria-label="Checking your access" /></Frame>;
    if (!allowed) return <Frame><section className="pp-card pp-note"><h1 className="pp-h">You don’t have access</h1><p className="pp-sub">Logging pledges needs an editor role at {org!.name}. Ask an admin to change your role on the team page.</p><a className="pp-btn white" href="/ramadhan/team">Team page</a></section></Frame>;

    return (
        <div className="pp">
            <header className="pp-top"><b style={{ fontWeight: 500, letterSpacing: "-.03em", fontSize: 18 }}>{org!.name}</b><span style={{ flex: 1 }} /><a className="pp-btn white" href={href({ name: "live", org: org!.slug })} target="_blank" rel="noreferrer">Live screen<ArrowSquareOut size={16} aria-hidden="true" /></a></header>
            <main className="hc-main">
                <label className="pp-field"><span>Tonight’s event</span><input list="hc-events" value={event} placeholder="Night 27 dinner" onChange={(e) => setEvent(e.target.value)} /><datalist id="hc-events">{events.map((e) => <option key={e} value={e} />)}</datalist></label>
                <section className="hc-live" aria-label="Tonight">
                    <div className="hc-live-top"><span>Pledged tonight · {t.count} {t.count === 1 ? "pledge" : "pledges"}</span><span>{t.pledged_cents ? Math.round((100 * t.paid_cents) / t.pledged_cents) : 0}% paid</span></div>
                    <div className="hc-big">{usd(t.pledged_cents)}</div>
                    <div className="pp-bar" aria-hidden="true"><span style={{ width: `${t.pledged_cents ? (100 * t.paid_cents) / t.pledged_cents : 0}%` }} /></div>
                    <dl className="hc-row"><div><dt>Paid</dt><dd>{usd(t.paid_cents)}</dd></div><div><dt>Cash, check, Zelle</dt><dd>{usd(t.offline_cents)}</dd></div><div><dt>Still to pay</dt><dd>{usd(t.remaining_cents)}</dd></div></dl>
                </section>
                <section className="hc-list" aria-label="Pledges tonight">
                    <h2>Tonight’s pledges</h2>
                    {loadError ? <p className="hc-empty" role="alert">Couldn’t load pledges: {loadError}</p>
                        : pledges === null ? <p className="hc-empty">Loading…</p>
                        : !list.length ? <p className="hc-empty">No pledges for {event || "this event"} yet. Tap New pledge when someone pledges at a table.</p>
                        : list.map((p) => (
                            <button key={p.id} type="button" className="hc-item" onClick={() => setSheet(unpaid(p) ? { kind: "pay", id: p.id } : { kind: "saved", p, paid: true })}>
                                <span className="hc-av" aria-hidden="true">{initials(p.donor_name) || "?"}</span>
                                <span className="hc-who"><b>{p.donor_name}</b><span>{[p.note, p.due_date && unpaid(p) ? `due ${new Date(`${p.due_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""].filter(Boolean).join(" · ") || "No table"}</span></span>
                                <span className="hc-amt"><b>{usd(p.amount_cents)}</b><span className={cx("hc-tag", p.status)}>{p.status === "part_paid" ? `${usd(remaining(p))} left` : STATUS_LABEL[p.status]}</span></span>
                            </button>
                        ))}
                </section>
            </main>
            <div className="hc-dock"><button type="button" className="pp-btn white" onClick={() => setSheet({ kind: "pay" })}>Record payment</button><button type="button" className="pp-btn black" onClick={() => setSheet({ kind: "pledge" })}>New pledge</button></div>
            {sheet?.kind === "pledge" && <PledgeSheet event={event} onClose={() => setSheet(null)} onSave={async (input, paidWith) => {
                const p = await src.save(org!.id, { ...input, event: event.trim() || "Fundraising night", currency: "USD" });
                if (paidWith !== "later") await src.pay(p.id, { amount_cents: input.amount_cents!, method: paidWith });
                await changed();
                setSheet({ kind: "saved", p: { ...(p as Pledge), donor_name: input.donor_name!, amount_cents: input.amount_cents! }, paid: paidWith !== "later" });
            }} />}
            {sheet?.kind === "pay" && <PaySheet pledges={(pledges ?? []).filter(unpaid)} event={event} start={sheet.id} onClose={() => setSheet(null)} onSave={async (id, x) => { await src.pay(id, x); await changed(); toast(`${usd(x.amount_cents)} ${METHOD_LABEL[x.method].toLowerCase()} recorded`); setSheet(null); }} />}
            {sheet?.kind === "saved" && <SavedSheet p={sheet.p} paid={sheet.paid} onClose={() => setSheet(null)} />}
        </div>
    );
};

type NewPledge = { donor_name?: string; donor_phone?: string; donor_email?: string; amount_cents?: number; due_date?: string | null; note?: string };

const PledgeSheet = ({ event, onClose, onSave }: { event: string; onClose: () => void; onSave: (p: NewPledge, paid: "later" | OfflineMethod) => Promise<void> }) => {
    const [amount, setAmount] = useState(""); const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
    const [table, setTable] = useState(() => store.get("outgive.host.table") ?? ""); const [due, setDue] = useState(inDays(30)); const [paid, setPaid] = useState<"later" | OfflineMethod>("later");
    const [busy, setBusy] = useState(false); const [error, setError] = useState("");
    const cents = dollars(amount);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!cents) return setError("Enter the amount pledged.");
        if (!name.trim()) return setError("Add the donor’s name.");
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("That email doesn’t look right.");
        setBusy(true); setError(""); store.set("outgive.host.table", table);
        try { await onSave({ donor_name: name.trim(), donor_phone: phone.trim() || undefined, donor_email: email.trim() || undefined, amount_cents: cents, due_date: paid === "later" ? due : null, note: table.trim() ? `Table ${table.trim().replace(/^table\s*/i, "")}` : "" }, paid); }
        catch (x) { setError((x as Error).message); setBusy(false); }
    };
    return (
        <Sheet title="New pledge" onClose={onClose}>
            <form noValidate onSubmit={submit} style={{ padding: 0 }}>
                <span className="hc-lbl">{event || "Fundraising night"}</span>
                <Chips label="Amount" options={AMOUNTS.map((a) => [String(a), usd(a * 100)] as [string, string])} value={amount} onPick={setAmount} />
                <label className="pp-field hc-money"><span>Amount</span><input inputMode="decimal" placeholder="Other amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} /></label>
                <label className="pp-field"><span>Name</span><input autoComplete="off" autoCapitalize="words" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></label>
                <div className="hc-grid2">
                    <label className="pp-field"><span>Phone</span><input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(212) 555-0101" /></label>
                    <label className="pp-field"><span>Table</span><input inputMode="numeric" value={table} onChange={(e) => setTable(e.target.value)} placeholder="12" /></label>
                </div>
                <label className="pp-field"><span>Email (optional)</span><input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></label>
                <span className="hc-lbl">Paid now?</span>
                <Chips label="Paid now" options={PAID_NOW} value={paid} onPick={setPaid} />
                {paid === "later" && <>
                    <span className="hc-lbl">Pay by</span>
                    <Chips label="Pay by" options={DUE.map(([l, n]) => [inDays(n), l] as [string, string])} value={due} onPick={setDue} />
                    <label className="pp-field"><span>Or pick a date</span><input type="date" min={isoDay(new Date())} value={due} onChange={(e) => setDue(e.target.value)} /></label>
                </>}
                {error && <p role="alert" className="pp-error">{error}</p>}
                <button type="submit" className="pp-btn black lg" disabled={busy}>{busy ? "Saving…" : paid === "later" ? `Save ${cents ? usd(cents) : ""} pledge` : `Save and mark ${cents ? usd(cents) : ""} paid`}</button>
            </form>
        </Sheet>
    );
};

const PaySheet = ({ pledges, event, start, onClose, onSave }: { pledges: Pledge[]; event: string; start?: string; onClose: () => void; onSave: (id: string, x: { amount_cents: number; method: OfflineMethod; reference?: string }) => Promise<void> }) => {
    const [id, setId] = useState(start ?? ""); const [q, setQ] = useState("");
    const p = pledges.find((x) => x.id === id);
    const [amount, setAmount] = useState(p ? String(remaining(p) / 100) : ""); const [method, setMethod] = useState<OfflineMethod>("cash"); const [ref, setRef] = useState("");
    const [busy, setBusy] = useState(false); const [error, setError] = useState("");
    const pick = (x: Pledge) => { setId(x.id); setAmount(String(remaining(x) / 100)); };
    // Tonight's first, then the rest; a name search finds anyone with an open pledge.
    const shown = pledges.filter((x) => (!q ? x.event === event : x.donor_name.toLowerCase().includes(q.toLowerCase()))).slice(0, 30);
    const cents = dollars(amount);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!p) return setError("Pick whose payment this is.");
        if (!cents) return setError("Enter the amount received.");
        if (cents > remaining(p)) return setError(`That is more than the ${usd(remaining(p))} left on this pledge.`);
        setBusy(true); setError("");
        try { await onSave(p.id, { amount_cents: cents, method, reference: ref.trim() || undefined }); } catch (x) { setError((x as Error).message); setBusy(false); }
    };
    return (
        <Sheet title={p ? p.donor_name : "Record payment"} onClose={onClose}>
            <form noValidate onSubmit={submit} style={{ padding: 0 }}>
                {p ? <div className="hc-sheet-top"><span className="hc-lbl">Pledged {usd(p.amount_cents)} · {usd(remaining(p))} left{p.note && ` · ${p.note}`}</span><button type="button" className="pp-btn white" onClick={() => setId("")}>Change</button></div> : <>
                    <label className="pp-field"><span>Find a pledge</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Donor name" /></label>
                    <div className="hc-pick">{shown.length ? shown.map((x) => <button key={x.id} type="button" className="hc-item" aria-pressed={x.id === id} onClick={() => pick(x)}><span className="hc-av" aria-hidden="true">{initials(x.donor_name) || "?"}</span><span className="hc-who"><b>{x.donor_name}</b><span>{x.note || x.event}</span></span><span className="hc-amt"><b>{usd(remaining(x))}</b><span className="hc-tag">left</span></span></button>) : <p className="hc-empty">No open pledges{q ? ` match “${q}”` : " tonight"}.</p>}</div>
                </>}
                {p && <>
                    <label className="pp-field hc-money"><span>Amount received</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} /></label>
                    <Chips label="Method" options={OFFLINE.map((m) => [m, m === "card" ? "Card machine" : METHOD_LABEL[m]] as [OfflineMethod, string])} value={method} onPick={setMethod} />
                    {(method === "check" || method === "zelle") && <label className="pp-field"><span>{method === "check" ? "Check number" : "Zelle confirmation"} (optional)</span><input value={ref} onChange={(e) => setRef(e.target.value)} /></label>}
                </>}
                {error && <p role="alert" className="pp-error">{error}</p>}
                <button type="submit" className="pp-btn green lg" disabled={busy || !p}>{busy ? "Saving…" : `Record ${cents && p ? usd(cents) : "payment"}`}</button>
            </form>
        </Sheet>
    );
};

/** After saving: the donor's pay link as a QR, to scan at the table and pay now, or later from the reminder. */
const SavedSheet = ({ p, paid, onClose }: { p: Pledge; paid: boolean; onClose: () => void }) => {
    const url = payUrl(p.pay_token);
    const [qr, setQr] = useState("");
    useEffect(() => { if (!paid) QRCode.toDataURL(url, { width: 320, margin: 1 }).then(setQr, () => setQr("")); }, [url, paid]);
    return (
        <Sheet title={paid ? "Paid in full" : "Pledge saved"} onClose={onClose}>
            <p className="pp-sub">{p.donor_name} · {usd(p.amount_cents)}{paid ? " received." : ". They can scan this to pay now, or use the link we send them."}</p>
            {!paid && qr && <div className="hc-qr"><img src={qr} alt={`QR code for ${p.donor_name}’s pay link`} /><span>{url.replace(/^https?:\/\//, "")}</span></div>}
            <div className="hc-grid2">
                {!paid ? <button type="button" className="pp-btn white" onClick={() => navigator.clipboard?.writeText(url)}>Copy link</button> : <span />}
                <button type="button" className="pp-btn black" onClick={onClose}>Done</button>
            </div>
        </Sheet>
    );
};
