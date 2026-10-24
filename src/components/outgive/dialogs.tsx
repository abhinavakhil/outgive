import { type ReactNode, useEffect, useState } from "react";
import { Check, Copy01, Download01, Mail01, MessageCircle01, Share07 } from "@untitledui/icons";
import QRCode from "qrcode";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Facebook, LinkedIn, Reddit, Telegram, X } from "@/components/foundations/social-icons";
import { ago, typeOf, useApp } from "@/components/outgive/shared";
import { CURRENCIES, type Donation, type PageData } from "@/data";
import { DEFAULT_TIP_PCT, TIP_CHOICES, breakdown, coverFor, fmt, tipFor } from "@/lib/money";
import type { Org, PageRow, TicketType } from "@/lib/types";
import { cx } from "@/utils/cx";

const Shell = ({ isOpen, onClose, label, children }: { isOpen: boolean; onClose: () => void; label: string; children: ReactNode }) => (
    <ModalOverlay isOpen={isOpen} isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
        <Modal className="max-w-lg"><Dialog aria-label={label}><div className="flex flex-col gap-5 p-5 md:p-6">{children}</div></Dialog></Modal>
    </ModalOverlay>
);
const Head = ({ title, sub }: { title: string; sub?: string }) => <div><h2 className="text-lg font-semibold text-primary">{title}</h2>{sub && <p className="mt-0.5 text-sm text-tertiary">{sub}</p>}</div>;

/** Where a page can be sent: name, icon and the share link for each app. */
export const shareTargets = (url: string, title: string): [string, ReactNode, string][] => {
    const text = `${title} on Outgive`;
    const u = encodeURIComponent(url); const t = encodeURIComponent(text);
    return [
        ["WhatsApp", <MessageCircle01 key="w" className="size-5" />, `https://wa.me/?text=${t}%20${u}`],
        ["X", <X key="x" size={18} />, `https://twitter.com/intent/tweet?text=${t}&url=${u}`],
        ["Facebook", <Facebook key="f" size={20} />, `https://www.facebook.com/sharer/sharer.php?u=${u}`],
        ["LinkedIn", <LinkedIn key="l" size={20} />, `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
        ["Telegram", <Telegram key="t" size={20} />, `https://t.me/share/url?url=${u}&text=${t}`],
        ["Reddit", <Reddit key="r" size={20} />, `https://www.reddit.com/submit?url=${u}&title=${t}`],
        ["Email", <Mail01 key="e" className="size-5" />, `mailto:?subject=${t}&body=${u}`],
    ];
};

/** Link, QR code and the usual social and message shortcuts. */
export const ShareDialog = ({ isOpen, onClose, url, title }: { isOpen: boolean; onClose: () => void; url: string; title: string }) => {
    const [qr, setQr] = useState("");
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!isOpen) return;
        QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#1F1714", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(""));
        setCopied(false);
    }, [isOpen, url]);
    const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } };
    const targets = shareTargets(url, title);
    return (
        <Shell isOpen={isOpen} onClose={onClose} label="Share this page">
            <Head title="Share this page" sub="Pages that are shared in the first day raise the most." />
            <div className="flex items-center gap-2 rounded-full bg-secondary p-1.5 pl-4 ring-1 ring-secondary ring-inset">
                <span className="min-w-0 flex-1 truncate text-sm text-secondary">{url.replace(/^https?:\/\//, "")}</span>
                <Button size="sm" color="primary" className="rounded-full" iconLeading={copied ? Check : Copy01} onPress={copy}>{copied ? "Copied" : "Copy link"}</Button>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {targets.map(([name, icon, href]) => (
                    <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-xs font-medium text-secondary outline-focus-ring transition hover:bg-secondary focus-visible:outline-2">
                        <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary ring-1 ring-secondary ring-inset">{icon}</span>{name}
                    </a>
                ))}
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-brand-primary p-4">
                <div className="flex size-28 shrink-0 items-center justify-center rounded-xl bg-white p-1.5">{qr ? <img src={qr} alt={`QR code for ${url}`} className="size-full" /> : <span className="text-xs text-gray-500">QR</span>}</div>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                    <div className="font-semibold text-primary">Scan to open</div>
                    <p className="text-sm text-tertiary">Print it on a poster or show it on a screen at your event.</p>
                    <div className="flex flex-wrap gap-2">
                        {qr && <a href={qr} download="outgive-qr.png" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-semibold text-secondary ring-1 ring-primary ring-inset hover:bg-secondary"><Download01 className="size-4" />Download</a>}
                        {typeof navigator.share === "function" && <Button size="sm" color="secondary" className="rounded-full" iconLeading={Share07} onPress={() => navigator.share({ title, url }).catch(() => {})}>More</Button>}
                    </div>
                </div>
            </div>
        </Shell>
    );
};

/** Who or what a gift is for, and how the donor wants to appear on the board. */
export interface DonateTarget {
    org: Org; page?: PageRow | null; title: string; gifts: number[]; tickets?: TicketType[];
    /** What the gift funds, chosen on the give screen ("A borehole for a village"). Stored on the gift and shown on live screens. */
    cause?: string;
    /** Prefilled board identity, from the leaderboard's claim flow. */
    supporter?: { name?: string; kind?: string; tagline?: string; country?: string; region?: string; link?: string; claimedRank?: number; anonymous?: boolean; lockKind?: boolean };
}
const chip = (on: boolean) => cx("h-9 cursor-pointer rounded-full px-4 text-sm font-semibold ring-1 ring-inset outline-focus-ring focus-visible:outline-2", on ? "bg-brand-solid text-white ring-transparent" : "bg-primary text-secondary ring-primary hover:bg-secondary");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The gift form. Amount, once or monthly, an optional tip to Outgive, cover-the-fees, name, email, message, dedication, anonymity and the board identity.
 * Submitting creates a Stripe Checkout session and leaves the site; in the demo the gift is recorded at once. With `onLocal` (the sample page) nothing is stored.
 */
export const DonateDialog = ({ target, isOpen, initial, onClose, onShare, onLocal }: { target: DonateTarget; isOpen: boolean; initial: number; onClose: () => void; onShare: () => void; onLocal?: (d: Donation) => void }) => {
    const { db, money, currency, isDemo, user, setMe, toast, refresh } = useApp();
    const { org, page } = target;
    const rate = CURRENCIES[currency] ?? 1;
    const [amount, setAmount] = useState(String(Math.round(initial * rate)));
    const [monthly, setMonthly] = useState(false);
    const [tip, setTip] = useState<number>(DEFAULT_TIP_PCT);
    const [cover, setCover] = useState(false);
    const [name, setName] = useState(target.supporter?.name ?? user?.name ?? "");
    const [email, setEmail] = useState(user?.email ?? "");
    const [message, setMessage] = useState("");
    const [dedication, setDedication] = useState("");
    const [anon, setAnon] = useState(!!target.supporter?.anonymous);
    const [kind, setKind] = useState(target.supporter?.kind ?? "Individuals");
    const [team, setTeam] = useState(target.supporter?.kind && target.supporter.kind !== "Individuals" ? target.supporter.name ?? "" : "");
    const [ticket, setTicket] = useState<TicketType | null>(null);
    const [qty, setQty] = useState(1);
    const [more, setMore] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<Donation | null>(null);
    useEffect(() => { if (isOpen) { setAmount(String(Math.round(initial * rate))); setError(""); setDone(null); setMonthly(false); setDedication(""); setMessage(""); setTicket(null); setQty(1); setName(target.supporter?.name ?? user?.name ?? ""); setKind(target.supporter?.kind ?? "Individuals"); setTeam(target.supporter?.kind && target.supporter.kind !== "Individuals" ? target.supporter.name ?? "" : ""); setAnon(!!target.supporter?.anonymous); } }, [isOpen, initial, rate]); // eslint-disable-line react-hooks/exhaustive-deps
    const units = ticket ? (ticket.price_cents / 100) * qty : Number(amount) || 0;
    const cents = Math.round(units * 100);
    const b = breakdown(cents, { tipPct: org.tips_enabled ? tip : 0, cover, feeBps: org.platform_fee_bps });
    const show = (c: number) => fmt(c, currency);
    const canPay = org.stripe_charges_enabled || isDemo || !!onLocal;
    const submit = async () => {
        if (!(cents >= 100)) return setError("The minimum gift is 1.00.");
        if (!anon && !name.trim()) return setError("Add your name, or tick anonymous.");
        if (!onLocal && !isDemo && !EMAIL.test(email)) return setError("Add your email for the receipt.");
        if (kind !== "Individuals" && !team.trim()) return setError(`Name the ${kind.replace(/s$/, "").toLowerCase()} this gift counts for.`);
        setError("");
        if (onLocal) { const d: Donation = { name: anon ? "Anonymous" : name.trim(), usd: Math.max(1, Math.round(units / rate)), message: message.trim(), at: Date.now(), ...(monthly && { monthly }), ...(dedication.trim() && { dedication: dedication.trim() }) }; onLocal(d); setDone(d); return; }
        setBusy(true);
        try {
            const boardName = kind === "Individuals" ? (anon ? "" : name.trim()) : team.trim();
            const res = await db.fn<{ url: string; donation?: { id: string; supporter_id: string | null } }>("checkout", {
                org_id: org.id, page_id: page?.id, amount_cents: cents, currency, recurring: monthly, tip_pct: org.tips_enabled ? tip : 0, cover,
                donor_name: name.trim(), donor_email: email.trim() || undefined, anonymous: anon, message: message.trim(), dedication: dedication.trim(), cause: target.cause ?? "",
                supporter_name: boardName || undefined, supporter_kind: kind, supporter_tagline: target.supporter?.tagline || message.trim().slice(0, 80) || undefined, supporter_country: target.supporter?.country, supporter_region: target.supporter?.region, supporter_link: target.supporter?.link, claimed_rank: target.supporter?.claimedRank,
                ticket_type_id: ticket?.id, ticket_qty: ticket ? qty : undefined, return_to: window.location.pathname, origin: window.location.origin,
            });
            if (res.donation) { if (res.donation.supporter_id) setMe(res.donation.supporter_id); refresh(); setDone({ name: anon ? "Anonymous" : name.trim(), usd: Math.round(units / rate), message: message.trim(), at: Date.now() }); toast(`${anon ? "An anonymous gift" : name.trim()} gave ${show(cents)}${target.supporter?.claimedRank ? ` and took #${target.supporter.claimedRank}` : ""}`); }
            else if (res.url) window.location.assign(res.url);
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    if (done) {
        return (
            <Shell isOpen={isOpen} onClose={onClose} label="Thank you">
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-brand-solid text-white"><Check className="size-6" /></span>
                    <Head title={`Thank you${done.name === "Anonymous" ? "" : `, ${done.name.split(" ")[0]}`}`} sub={`Your ${money(done.usd)} gift now shows on the page.${isDemo || onLocal ? " Demo: nothing was charged." : ""}`} />
                    <div className="flex gap-3 pt-1"><Button size="md" color="primary" className="rounded-full" iconLeading={Share07} onPress={() => { onClose(); onShare(); }}>Share this page</Button><Button size="md" color="secondary" className="rounded-full" onPress={onClose}>Close</Button></div>
                </div>
            </Shell>
        );
    }
    const kinds = [["Individuals", "Individual"], ["Teams", "Team"], ["Companies", "Company"], ["Schools", "School"]];
    const cta = page ? typeOf({ type: page.type } as PageData).cta : "Give";
    return (
        <Shell isOpen={isOpen} onClose={onClose} label="Give">
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <Head title={target.cause ?? target.title} sub={target.cause ? `${money(initial)} funds this for ${target.title}. Paid straight to ${org.name}'s own account.` : `${page ? `${cta} to ${page.org_name || org.name}` : `Give to ${org.name}`}. Paid straight to ${org.name}'s own account.`} />
                {!canPay && <p className="rounded-xl bg-warning-primary px-4 py-3 text-sm text-warning-primary">{org.name} has not connected payouts yet, so gifts cannot be taken here for the moment.</p>}
                {target.tickets && target.tickets.length > 0 && <div className="flex flex-col gap-2"><span className="text-sm font-medium text-secondary">Tickets</span>{target.tickets.map((t) => { const left = t.quantity === null ? null : t.quantity - t.sold; const on = ticket?.id === t.id; return <button key={t.id} type="button" aria-pressed={on} disabled={left !== null && left <= 0} onClick={() => { setTicket(on ? null : t); setMonthly(false); }} className={cx("flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-3 text-left ring-1 ring-inset disabled:cursor-not-allowed disabled:opacity-50", on ? "bg-brand-primary ring-brand" : "ring-secondary hover:bg-secondary")}><span><span className="block font-semibold text-primary">{t.name}</span><span className="text-sm text-tertiary">{t.description}{left !== null && ` · ${left} left`}</span></span><span className="font-semibold text-brand-secondary">{t.price_cents ? show(t.price_cents) : "Free"}</span></button>; })}
                    {ticket && <label className="flex items-center gap-3 text-sm text-secondary">How many<input type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="h-9 w-20 rounded-lg px-3 ring-1 ring-primary ring-inset" /></label>}
                    <span className="text-xs text-tertiary">Or give without a ticket:</span></div>}
                {!ticket && <>
                    {!target.cause && <div className="flex flex-wrap gap-2">{target.gifts.map((g) => { const v = String(Math.round(g * rate)); return <button key={g} type="button" aria-pressed={amount === v} onClick={() => setAmount(v)} className={chip(amount === v)}>{money(g)}</button>; })}</div>}
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Input label={`Amount (${currency})`} type="number" value={amount} onChange={setAmount} isInvalid={!!error && !(cents >= 100)} />
                        <div role="group" aria-label="Frequency" className="flex h-fit gap-1 self-end rounded-full bg-secondary p-1 ring-1 ring-secondary ring-inset">{([[false, "Once"], [true, "Monthly"]] as const).map(([v, l]) => <button key={l} type="button" aria-pressed={monthly === v} onClick={() => setMonthly(v)} className={cx("h-9 cursor-pointer rounded-full px-4 text-sm font-semibold outline-focus-ring focus-visible:outline-2", monthly === v ? "bg-brand-solid text-white" : "text-tertiary hover:text-primary")}>{l}</button>)}</div></div>
                </>}
                {org.tips_enabled && !onLocal && <div className="flex flex-col gap-2 rounded-xl bg-secondary p-3.5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium text-primary">Add a tip to Outgive</span><span className="text-xs text-tertiary">Outgive is free for {org.name}. Tips keep it that way.</span></div><div className="flex flex-wrap gap-2">{TIP_CHOICES.map((t) => <button key={t} type="button" aria-pressed={tip === t} onClick={() => setTip(t)} className={chip(tip === t)}>{t === 0 ? "No tip" : `${t}% · ${show(tipFor(cents, t))}`}</button>)}</div></div>}
                {!onLocal && <Checkbox size="md" isSelected={cover} onChange={setCover} label={`Cover the card fees (${show(coverFor(cents))}) so ${org.name} gets the full gift`} />}
                <div className="grid gap-3 sm:grid-cols-2"><Input label="Your name" placeholder="Shown on the page" value={name} onChange={setName} isDisabled={anon} /><Input label="Email" type="email" placeholder="For your receipt" value={email} onChange={setEmail} isRequired={!onLocal && !isDemo} /></div>
                <TextArea label="Message (optional)" rows={2} value={message} onChange={setMessage} />
                <button type="button" onClick={() => setMore((m) => !m)} className="w-fit cursor-pointer text-sm font-semibold text-brand-secondary underline-offset-4 hover:underline">{more ? "Fewer options" : "Dedicate this gift, or give as a team, company or school"}</button>
                {more && <div className="flex flex-col gap-3">
                    <Input label="Dedicate this gift (optional)" placeholder="In honour of, or in memory of…" value={dedication} onChange={setDedication} />
                    {!target.supporter?.lockKind && <><div role="group" aria-label="On the board as" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">{kinds.map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cx("cursor-pointer rounded-xl px-2 py-2 text-sm font-semibold ring-1 outline-focus-ring transition ring-inset focus-visible:outline-2", kind === k ? "bg-brand-primary text-brand-secondary ring-brand" : "text-secondary ring-secondary hover:bg-secondary")}>{l}</button>)}</div>
                    {kind !== "Individuals" && <Input label={`${kind.replace(/ies$/, "y").replace(/s$/, "")} name on the board`} value={team} onChange={setTeam} placeholder="The gift counts toward this name's rank" />}</>}
                </div>}
                <Checkbox size="md" isSelected={anon} onChange={setAnon} label="Give anonymously" hint="Your name is hidden on the page and the board. The gift still counts for a team, company or school." />
                {error && <p className="text-sm text-error-primary">{error}</p>}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-primary px-4 py-3 text-sm"><span className="text-tertiary">{onLocal ? "Demo only, nothing is charged." : <>You pay <b className="text-primary">{show(b.total)}</b>{monthly && " a month"}. {org.name} receives {show(b.amount + (cover ? b.cover : 0))}{cover ? " before Stripe's fee" : ""}.</>}</span>
                    <div className="flex gap-2"><Button size="md" color="secondary" className="rounded-full" onPress={onClose}>Cancel</Button><Button size="md" color="primary" type="submit" className="rounded-full" isDisabled={busy || !canPay}>{busy ? "One moment…" : ticket ? `Get ${qty > 1 ? `${qty} tickets` : "ticket"}` : `${monthly ? "Give monthly" : "Give"} ${show(b.total)}`}</Button></div></div>
                {!onLocal && !isDemo && <p className="text-center text-xs text-tertiary">Cards, Apple Pay, Google Pay and Link, through Stripe. You will be sent to a secure checkout page.</p>}
            </form>
        </Shell>
    );
};

/** Every gift on the page, newest first or biggest first. */
export const DonationsDialog = ({ p, mode, onClose }: { p: PageData; mode: "all" | "top" | null; onClose: () => void }) => {
    const { money } = useApp();
    const [tab, setTab] = useState<"all" | "top">("all");
    useEffect(() => { if (mode) setTab(mode); }, [mode]);
    const rows = tab === "top" ? [...p.donations].sort((a, b) => b.usd - a.usd) : p.donations;
    return (
        <Shell isOpen={mode !== null} onClose={onClose} label="Donations">
            <Head title={`Donations · ${p.supporters}`} sub={p.donations.length < p.supporters ? `Showing the ${p.donations.length} most recent.` : undefined} />
            <div role="group" aria-label="Order" className="flex w-fit gap-1 rounded-full bg-secondary p-1 ring-1 ring-secondary ring-inset">
                {([["all", "Recent"], ["top", "Top"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={cx("h-9 cursor-pointer rounded-full px-4 text-sm font-semibold outline-focus-ring focus-visible:outline-2", tab === k ? "bg-brand-solid text-white" : "text-tertiary hover:text-primary")}>{l}</button>)}
            </div>
            <ul className="flex max-h-96 flex-col overflow-y-auto">
                {rows.length === 0 && <li className="py-6 text-center text-sm text-tertiary">No gifts yet. Be the first.</li>}
                {rows.map((d, i) => (
                    <li key={`${d.at}-${i}`} className="flex items-center gap-3 border-b border-secondary py-3 last:border-b-0">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary">{(d.name[0] ?? "A").toUpperCase()}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium text-primary">{d.name}</span><span className="block text-xs text-tertiary">{ago(d.at)}</span></span>
                        <span className="font-semibold text-primary">{money(d.usd)}</span>
                    </li>
                ))}
            </ul>
        </Shell>
    );
};
