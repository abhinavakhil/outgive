import { useEffect, useState } from "react";
import { ArrowLeft, Heart, Printer, Repeat04 } from "@untitledui/icons";
import { Badge, Button, DialogHead, DialogShell, Empty, Input, Logo, Panel, ThemeToggle } from "@/shared/ui";
import { useApp } from "@/shared/lib/app-context";
import { fmt } from "@/shared/lib/money";
import type { PageType } from "@/shared/domain/model";
import { SignIn } from "@/features/auth";

/** A row of my_gifts: one payment, with the names a list needs. */
export interface Gift { id: string; org_id: string; org_name: string; org_slug: string; page_id: string | null; page_title: string | null; page_type: PageType | null; page_slug: string | null; amount_cents: number; currency: string; usd_cents: number; tip_cents: number; cover_cents: number; gift_aid_cents: number; recurring: boolean; status: string; method: string; source: string; message: string; created_at: string; receipt_sent_at: string | null }
/** A row of my_recurring: a standing monthly or yearly gift. pending: a change has not reached the payment provider yet. */
export interface Regular { id: string; org_id: string; org_name: string; org_slug: string; page_title: string | null; amount_cents: number; currency: string; every: "monthly" | "yearly"; status: "active" | "paused" | "cancelled"; started_at: string; next_at: string | null; cancelled_at: string | null; pending: boolean }
interface ReceiptData { id: string; donor_name: string; donor_email: string | null; amount_cents: number; currency: string; tip_cents: number; cover_cents: number; gift_aid_cents: number; recurring: boolean; status: string; method: string; cause: string; dedication: string; created_at: string; page_title: string | null; org: { name: string; slug: string; country: string; registration_number: string; website: string } }

const METHOD: Record<string, string> = { card: "Card", wallet: "Apple Pay / Google Pay", wallets: "Apple Pay / Google Pay", bank: "Pay by bank", dd: "Direct Debit", paypal: "PayPal", offline: "Cash or cheque", pledge: "Pledge", match: "Matched gift", demo: "Demo gift" };
const STATUS: Record<string, [string, "success" | "gray" | "error" | "warning"]> = { succeeded: ["Paid", "success"], refunded: ["Refunded", "gray"], failed: ["Failed", "error"], disputed: ["Disputed", "warning"], active: ["Active", "success"], paused: ["Paused", "warning"], cancelled: ["Cancelled", "gray"] };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const methodOf = (m: string) => METHOD[m] ?? m;
const Status = ({ s }: { s: string }) => <Badge type="pill-color" color={STATUS[s]?.[1] ?? "gray"} size="sm">{STATUS[s]?.[0] ?? s}</Badge>;
const per = (r: Pick<Regular, "every">) => (r.every === "yearly" ? "a year" : "a month");

/** The Giving tab: regular gifts the donor can pause, resume, resize or cancel, then every payment with its receipt. */
export const Giving = ({ gifts, regular, reload }: { gifts: Gift[]; regular: Regular[]; reload: () => void }) => {
    const { db, go, toast, isDemo } = useApp();
    const [busy, setBusy] = useState("");
    const [edit, setEdit] = useState<Regular | null>(null);
    const [amount, setAmount] = useState("");
    const [cancel, setCancel] = useState<Regular | null>(null);
    const [error, setError] = useState("");
    /** The server decides; the list is read again after every change. */
    const change = async (r: Regular, act: "pause" | "resume" | "amount" | "cancel", done: string, cents?: number) => {
        setBusy(r.id); setError("");
        try { await db.rpc("recurring_change", { gift: r.id, act, ...(cents ? { amount: cents } : {}) }); toast(done); setEdit(null); setCancel(null); reload(); return true; }
        catch (e) { if (act === "amount" || act === "cancel") setError((e as Error).message); else toast((e as Error).message); return false; }
        finally { setBusy(""); }
    };
    const to = (r: { page_title: string | null; org_name: string }) => r.page_title ?? r.org_name;
    const cents = Math.round(Number(amount) * 100);
    const receipt = (g: Gift) => <Button size="sm" color="link-color" onPress={() => go({ name: "dashboard", gift: g.id })} aria-label={`Receipt for ${fmt(g.amount_cents, g.currency)} to ${to(g)}`}>Receipt</Button>;

    return (
        <>
            <Panel title="Regular gifts" sub="Pause, change or cancel any time. Changes apply from the next payment.">
                {regular.length === 0 ? <Empty icon={Repeat04} title="No regular gifts" sub="A monthly gift you start on any page appears here, with the controls to change it." action={<Button size="sm" color="secondary" className="rounded-full" onPress={() => go({ name: "home" })}>Find a cause</Button>} /> : (
                    <ul className="flex flex-col gap-3">{regular.map((r) => (
                        <li key={r.id} data-regular={r.status} className="flex flex-col gap-3 rounded-2xl bg-raised p-4 shadow-edge lg:flex-row lg:items-center">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tint-2 text-ink-2"><Repeat04 className="size-[18px]" /></span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="truncate font-semibold text-ink">{to(r)}</span><Status s={r.status} /></div>
                                    <div className="text-sm text-tertiary"><b className="font-bubble font-bold text-ink tabular-nums">{fmt(r.amount_cents, r.currency)}</b> {per(r)}{r.page_title && ` · ${r.org_name}`} · {r.status === "active" && r.next_at ? `next payment ${day(r.next_at)}` : r.status === "paused" ? "no payments while paused" : r.cancelled_at ? `cancelled ${day(r.cancelled_at)}` : `since ${day(r.started_at)}`}</div>
                                    {r.pending && <div className="mt-0.5 text-xs text-warning-primary">Your change is on its way to the payment provider.</div>}
                                </div>
                            </div>
                            {r.status !== "cancelled" && <div className="flex flex-wrap items-center gap-2">
                                <Button size="sm" color="secondary" className="rounded-full" isDisabled={busy === r.id} onPress={() => (r.status === "active" ? change(r, "pause", "Paused. No payments until you resume.") : change(r, "resume", "Resumed. Thank you."))}>{r.status === "active" ? "Pause" : "Resume"}</Button>
                                <Button size="sm" color="secondary" className="rounded-full" isDisabled={busy === r.id} onPress={() => { setError(""); setAmount(String(r.amount_cents / 100)); setEdit(r); }}>Change amount</Button>
                                <Button size="sm" color="tertiary-destructive" className="rounded-full" isDisabled={busy === r.id} onPress={() => { setError(""); setCancel(r); }}>Cancel</Button>
                            </div>}
                        </li>
                    ))}</ul>
                )}
            </Panel>

            <Panel title={<>Every gift{gifts.length > 0 && <span className="ml-1 text-tertiary">· {gifts.length}</span>}</>} sub={isDemo ? "Gifts you make in the demo. Nothing is charged and no emails are sent." : "Across every organisation you have given to with this email address."}>
                {gifts.length === 0 ? <Empty icon={Heart} title="No gifts yet" sub="Gifts made with your email address appear here, each with a receipt you can print." action={<Button size="sm" color="secondary" className="rounded-full" onPress={() => go({ name: "home" })}>Find a cause</Button>} /> : <>
                    <table className="w-full text-left text-sm max-md:hidden">
                        <thead className="text-xs text-ink-3"><tr>{["Date", "To", "Method", "Gift Aid", "Status"].map((h) => <th key={h} className="pb-2 pr-3 font-semibold">{h}</th>)}<th className="pb-2 pr-3 text-right font-semibold">Amount</th><th className="pb-2"><span className="sr-only">Receipt</span></th></tr></thead>
                        <tbody>{gifts.map((g) => (
                            <tr key={g.id} className="border-t border-hairline">
                                <td className="py-3 pr-3 whitespace-nowrap text-tertiary tabular-nums">{day(g.created_at)}</td>
                                <td className="max-w-56 py-3 pr-3"><div className="truncate font-semibold text-ink">{to(g)}</div><div className="truncate text-xs text-tertiary">{g.page_title ? g.org_name : ""}{g.recurring && `${g.page_title ? " · " : ""}regular gift`}</div></td>
                                <td className="py-3 pr-3 text-tertiary">{methodOf(g.method)}</td>
                                <td className="py-3 pr-3 text-tertiary tabular-nums">{g.gift_aid_cents > 0 ? `+${fmt(g.gift_aid_cents, g.currency)}` : "–"}</td>
                                <td className="py-3 pr-3"><Status s={g.status} /></td>
                                <td className="py-3 pr-3 text-right font-bubble font-bold text-ink tabular-nums">{fmt(g.amount_cents, g.currency)}</td>
                                <td className="py-3 text-right">{receipt(g)}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                    <ul className="flex flex-col md:hidden">{gifts.map((g) => (
                        <li key={g.id} className="flex flex-col gap-1.5 border-t border-hairline py-3 first:border-0 first:pt-0">
                            <div className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate font-semibold text-ink">{to(g)}</span><span className="shrink-0 font-bubble font-bold text-ink tabular-nums">{fmt(g.amount_cents, g.currency)}</span></div>
                            <div className="text-xs text-tertiary">{day(g.created_at)} · {methodOf(g.method)}{g.recurring && " · regular gift"}{g.gift_aid_cents > 0 && ` · Gift Aid +${fmt(g.gift_aid_cents, g.currency)}`}</div>
                            <div className="flex items-center justify-between gap-3"><Status s={g.status} />{receipt(g)}</div>
                        </li>
                    ))}</ul>
                </>}
            </Panel>

            <DialogShell isOpen={!!edit} onClose={() => setEdit(null)} label="Change amount">
                {edit && <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); if (!(cents >= 200 && cents <= 1000000)) return setError(`Choose between ${fmt(200, edit.currency)} and ${fmt(1000000, edit.currency)}.`); change(edit, "amount", `Now ${fmt(cents, edit.currency)} ${per(edit)}.`, cents); }}>
                    <DialogHead title="Change the amount" sub={`Your gift to ${to(edit)} is ${fmt(edit.amount_cents, edit.currency)} ${per(edit)}. The new amount applies from the next payment.`} />
                    <Input label={`New amount (${edit.currency})`} inputMode="decimal" autoFocus value={amount} onChange={(v) => { setAmount(v.replace(/[^0-9.]/g, "")); setError(""); }} isInvalid={!!error} hint={error || undefined} />
                    <div className="flex flex-wrap justify-end gap-2"><Button color="secondary" className="rounded-full" onPress={() => setEdit(null)}>Keep {fmt(edit.amount_cents, edit.currency)}</Button><Button type="submit" color="primary" className="rounded-full" isDisabled={busy === edit.id || cents === edit.amount_cents}>Save amount</Button></div>
                </form>}
            </DialogShell>
            <DialogShell isOpen={!!cancel} onClose={() => setCancel(null)} label="Cancel regular gift">
                {cancel && <>
                    <DialogHead title={`Cancel your gift to ${to(cancel)}?`} sub={`No more payments of ${fmt(cancel.amount_cents, cancel.currency)} ${per(cancel)} will be taken. This cannot be undone, though you can start a new gift any time. To take a break instead, pause it.`} />
                    {error && <p role="alert" className="text-sm text-error-primary">{error}</p>}
                    <div className="flex flex-wrap justify-end gap-2"><Button color="secondary" className="rounded-full" onPress={() => setCancel(null)}>Keep giving</Button><Button color="primary-destructive" className="rounded-full" isDisabled={busy === cancel.id} onPress={() => change(cancel, "cancel", "Cancelled. Thank you for every gift.")}>Cancel gift</Button></div>
                </>}
            </DialogShell>
        </>
    );
};

/** /dashboard/receipt/<gift id>: one gift on a page made to print. Only the donor who made it can open it. */
export const Receipt = ({ gift }: { gift: string }) => {
    const { db, user, go, isDemo } = useApp();
    const [r, setR] = useState<ReceiptData | null | undefined>(undefined);
    useEffect(() => { if (!user) return; db.rpc<ReceiptData | null>("my_receipt", { gift }).then((x) => setR(x ?? null)).catch(() => setR(null)); }, [db, user, gift]);
    useEffect(() => { if (r) document.title = `Receipt ${r.id.slice(0, 8).toUpperCase()} · ${r.org.name}`; }, [r]);
    // Paper is white: the dark theme steps aside while the receipt prints.
    useEffect(() => {
        const el = document.documentElement; let dark = false;
        const before = () => { dark = el.classList.contains("dark-mode"); el.classList.remove("dark-mode"); };
        const after = () => { if (dark) el.classList.add("dark-mode"); dark = false; };
        window.addEventListener("beforeprint", before); window.addEventListener("afterprint", after);
        return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); after(); };
    }, []);
    const total = r ? r.amount_cents + r.tip_cents + r.cover_cents : 0;
    const line = (k: string, v: string, strong = false) => <div className="flex justify-between gap-4 py-2.5"><dt className={strong ? "font-semibold text-ink" : "text-ink-3"}>{k}</dt><dd className={strong ? "font-bubble text-lg font-bold text-ink tabular-nums" : "text-right font-medium text-ink tabular-nums"}>{v}</dd></div>;
    return (
        <div className="min-h-dvh bg-primary print:bg-white">
            <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
                <div className="flex items-center justify-between gap-3 print:hidden"><Logo onClick={() => go({ name: "landing" })} /><ThemeToggle /></div>
                {!user ? <div className="rounded-3xl bg-tint-1 p-6"><SignIn next={window.location.pathname} title="Your receipt" sub="Sign in with the email address you gave with to see this receipt." /></div>
                : r === undefined ? <div className="rounded-3xl bg-tint-1 px-6 py-8 text-sm text-ink-3">Finding your receipt…</div>
                : r === null ? <div className="flex flex-col gap-3 rounded-3xl bg-tint-1 p-8"><h1 className="text-display-xs leading-[0.95] font-extrabold tracking-[-0.045em] text-ink">We could not find that receipt</h1><p className="text-ink-3">It may belong to a different email address. Your receipts are listed with your gifts.</p><Button color="secondary" className="w-fit rounded-full" onPress={() => go({ name: "dashboard", tab: "giving" })}>Your giving</Button></div>
                : <>
                    <div className="flex flex-wrap items-center justify-between gap-2 print:hidden"><Button size="sm" color="secondary" className="rounded-full" iconLeading={ArrowLeft} onPress={() => go({ name: "dashboard", tab: "giving" })}>Your giving</Button><Button size="sm" color="primary" className="rounded-full" iconLeading={Printer} onPress={() => window.print()}>Print or save as PDF</Button></div>
                    <article aria-label="Receipt" className="flex flex-col gap-6 rounded-3xl bg-raised p-6 shadow-edge md:p-9 print:rounded-none print:p-0 print:shadow-none">
                        <header className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0"><div className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Donation receipt</div><h1 className="mt-1 text-display-xs leading-none font-extrabold tracking-[-0.03em] text-ink">{r.org.name}</h1><p className="mt-1.5 text-sm text-tertiary">{[r.org.registration_number && `Registered no. ${r.org.registration_number}`, r.org.country, r.org.website].filter(Boolean).join(" · ")}</p></div>
                            <div className="text-sm sm:text-right"><div className="font-mono font-semibold text-ink">No. {r.id.slice(0, 8).toUpperCase()}</div><div className="text-tertiary">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div><div className="mt-1.5"><Status s={r.status} /></div></div>
                        </header>
                        <div className="grid gap-4 border-y border-hairline py-4 text-sm sm:grid-cols-2">
                            <div><div className="text-xs font-semibold text-ink-3">Received from</div><div className="mt-0.5 font-semibold text-ink">{r.donor_name}</div>{r.donor_email && <div className="truncate text-tertiary">{r.donor_email}</div>}</div>
                            <div><div className="text-xs font-semibold text-ink-3">For</div><div className="mt-0.5 font-semibold text-ink">{r.page_title ?? r.org.name}</div><div className="text-tertiary">{[r.cause, r.dedication && `Dedicated: ${r.dedication}`].filter(Boolean).join(" · ") || (r.recurring ? "Regular gift" : "One-off gift")}</div></div>
                        </div>
                        <dl className="flex flex-col divide-y divide-hairline text-sm">
                            {line(r.recurring ? "Gift (regular)" : "Gift", fmt(r.amount_cents, r.currency))}
                            {r.tip_cents > 0 && line("Tip to Outgive", fmt(r.tip_cents, r.currency))}
                            {r.cover_cents > 0 && line("Card fees covered", fmt(r.cover_cents, r.currency))}
                            {line(isDemo ? "Total (demo, not charged)" : r.status === "refunded" ? "Total paid, since refunded" : "Total paid", fmt(total, r.currency), true)}
                            {r.gift_aid_cents > 0 && line("Gift Aid the charity claims on top", `+${fmt(r.gift_aid_cents, r.currency)}`)}
                            {line("Paid by", methodOf(r.method))}
                            <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-3">Reference</dt><dd className="min-w-0 font-mono text-xs break-all text-ink-2">{r.id}</dd></div>
                        </dl>
                        <p className="text-xs text-ink-3">{isDemo ? "This is a demo receipt: nothing was charged. " : ""}Paid to {r.org.name} through Outgive. Whether a gift is tax-deductible depends on the charity and where you live. Keep this receipt for your records.</p>
                    </article>
                </>}
            </div>
        </div>
    );
};
