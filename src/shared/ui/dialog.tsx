import { type ReactNode, useEffect, useState } from "react";
import { Check, Copy01, Download01, Mail01, MessageCircle01, Share07 } from "@untitledui/icons";
import QRCode from "qrcode";
import { Dialog, Modal, ModalOverlay } from "@/shared/ui/application/modals/modal";
import { Button } from "@/shared/ui/base/buttons/button";
import { Facebook, LinkedIn, Reddit, Telegram, X } from "@/shared/ui/foundations/social-icons";

/** The one modal frame: overlay, panel and padding. */
export const DialogShell = ({ isOpen, onClose, label, children }: { isOpen: boolean; onClose: () => void; label: string; children: ReactNode }) => (
    <ModalOverlay isOpen={isOpen} isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
        <Modal className="max-w-lg"><Dialog aria-label={label}><div className="flex flex-col gap-5 p-5 md:p-6">{children}</div></Dialog></Modal>
    </ModalOverlay>
);
export const DialogHead = ({ title, sub }: { title: string; sub?: string }) => <div><h2 className="text-lg font-semibold text-primary">{title}</h2>{sub && <p className="mt-0.5 text-sm text-tertiary">{sub}</p>}</div>;

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
        <DialogShell isOpen={isOpen} onClose={onClose} label="Share this page">
            <DialogHead title="Share this page" sub="Pages that are shared in the first day raise the most." />
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
        </DialogShell>
    );
};

