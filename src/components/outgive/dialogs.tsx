import { type ReactNode, useEffect, useState } from "react";
import { Check, Copy01, Download01, Mail01, MessageCircle01, Share07 } from "@untitledui/icons";
import QRCode from "qrcode";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Facebook, LinkedIn, Reddit, Telegram, X } from "@/components/foundations/social-icons";
import { Raised, ago, pct, typeOf, useApp } from "@/components/outgive/shared";
import { CURRENCIES, type Donation, type PageData } from "@/data";
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

/** Gift form for a published page. Demo only: nothing is charged, the gift is recorded on the page. */
export const DonateDialog = ({ p, isOpen, initial, onClose, onGive, onShare }: { p: PageData; isOpen: boolean; initial: number; onClose: () => void; onGive: (d: Donation) => void; onShare: () => void }) => {
    const { money, currency } = useApp();
    const rate = CURRENCIES[currency];
    const [amount, setAmount] = useState(String(Math.round(initial * rate)));
    const [name, setName] = useState("");
    const [message, setMessage] = useState("");
    const [anon, setAnon] = useState(false);
    const [monthly, setMonthly] = useState(false);
    const [dedication, setDedication] = useState("");
    const topUsd = Math.max(0, ...p.donations.map((x) => x.usd));
    const [error, setError] = useState("");
    const [done, setDone] = useState<Donation | null>(null);
    useEffect(() => { if (isOpen) { setAmount(String(Math.round(initial * rate))); setError(""); setDone(null); setMonthly(false); setDedication(""); } }, [isOpen, initial, rate]);
    const submit = () => {
        const n = Number(amount);
        if (!(n > 0)) return setError("Enter an amount above zero.");
        const d: Donation = { name: anon || !name.trim() ? "Anonymous" : name.trim(), usd: Math.max(1, Math.round(n / rate)), message: message.trim(), at: Date.now(), ...(monthly && { monthly }), ...(dedication.trim() && { dedication: dedication.trim() }) };
        onGive(d); setDone(d);
    };
    if (done) {
        return (
            <Shell isOpen={isOpen} onClose={onClose} label="Thank you">
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-brand-solid text-white"><Check className="size-6" /></span>
                    <Head title={`Thank you${done.name === "Anonymous" ? "" : `, ${done.name.split(" ")[0]}`}`} sub={`Your ${money(done.usd)} gift now shows on the page. Demo only: nothing was charged.`} />
                    <div className="flex gap-3 pt-1"><Button size="md" color="primary" className="rounded-full" iconLeading={Share07} onPress={() => { onClose(); onShare(); }}>Share this page</Button><Button size="md" color="secondary" className="rounded-full" onPress={onClose}>Close</Button></div>
                </div>
            </Shell>
        );
    }
    return (
        <Shell isOpen={isOpen} onClose={onClose} label="Give">
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <Head title={p.title} sub={`${typeOf(p).cta} to ${p.org}. The full gift goes to the charity.`} />
                {p.showGoal && <div className="flex flex-col gap-2"><Raised p={p} /><div className="h-2 overflow-hidden rounded-full bg-tertiary"><div className="h-full rounded-full bg-brand-solid" style={{ width: `${pct(p)}%` }} /></div></div>}
                <div className="flex flex-wrap gap-2">{[...p.gifts, ...(topUsd > 0 ? [topUsd + 1] : [])].map((g, gi) => { const v = String(Math.round(g * rate)); return <button key={g} type="button" aria-pressed={amount === v} onClick={() => setAmount(v)} className={cx("h-9 cursor-pointer rounded-full px-4 text-sm font-semibold ring-1 ring-inset outline-focus-ring focus-visible:outline-2", amount === v ? "bg-brand-solid text-white ring-transparent" : "bg-primary text-secondary ring-primary hover:bg-secondary")}>{gi === p.gifts.length ? `Beat the top gift · ${money(g)}` : money(g)}</button>; })}</div>
                <Input label={`Amount (${currency})`} type="number" value={amount} onChange={setAmount} isInvalid={!!error} hint={error || undefined} />
                <Input label="Your name" placeholder="Shown on the page" value={name} onChange={setName} isDisabled={anon} />
                <TextArea label="Message (optional)" rows={2} value={message} onChange={setMessage} />
                <Input label="Dedicate this gift (optional)" placeholder="In honour of, or in memory of…" value={dedication} onChange={setDedication} />
                <div className="flex flex-col gap-3"><Checkbox size="md" isSelected={monthly} onChange={setMonthly} label="Repeat this gift every month" /><Checkbox size="md" isSelected={anon} onChange={setAnon} label="Give anonymously" /></div>
                <div className="flex justify-end gap-3"><Button size="md" color="secondary" className="rounded-full" onPress={onClose}>Cancel</Button><Button size="md" color="primary" type="submit" className="rounded-full">{typeOf(p).cta} {money(Math.max(1, Number(amount) / rate || 0))}</Button></div>
                <p className="rounded-xl bg-secondary px-4 py-3 text-center text-sm text-tertiary"><span className="font-semibold text-primary">No tip. No fee.</span> 100% of your gift reaches {p.org}. Demo only, nothing is charged.</p>
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
