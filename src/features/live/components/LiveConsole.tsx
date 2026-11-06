import { Copy01, LinkExternal01, Plus, QrCode01, Trash01, Zap } from "@untitledui/icons";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { LIVE_LAYOUTS, type LiveItem, type LiveLayout, type LiveState } from "@/shared/domain/types";
import { useApp } from "@/shared/lib/app-context";
import { Button } from "@/shared/ui/base/buttons/button";
import { Input } from "@/shared/ui/base/input/input";
import { Toggle } from "@/shared/ui/base/toggle/toggle";
import { CopyRow } from "@/shared/ui/display";
import { Panel } from "@/shared/ui/layout";
import { cx } from "@/shared/utils/cx";

/** Little illustration of each live layout. */
const LayoutThumbLive = ({ k }: { k: LiveLayout }) => (
    <span aria-hidden="true" className="relative block h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
        {k === "classic" && <><span className="absolute top-2 left-2 h-3 w-8 rounded-sm bg-white/90" /><span className="absolute top-6 left-2 h-1.5 w-9 rounded-full bg-brand-500" /><span className="absolute top-9 left-2 h-1.5 w-6 rounded-full bg-white/30" />{[0, 1, 2, 3].map((i) => <span key={i} className={cx("absolute right-2 h-2 w-9 rounded-sm", i === 0 ? "bg-brand-500" : "bg-white/25")} style={{ top: 8 + i * 11 }} />)}</>}
        {k === "thermo" && <><span className="absolute top-3 left-1/2 h-4 w-14 -translate-x-1/2 rounded-sm bg-white/90" /><span className="absolute top-9 right-3 left-3 h-2 rounded-full bg-white/20"><span className="block h-full w-2/3 rounded-full bg-brand-500" /></span><span className="absolute bottom-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/30" /></>}
        {k === "impact" && <><span className="absolute top-1.5 left-2 h-1.5 w-8 rounded-full bg-white/60" />{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={cx("absolute h-4 w-6 rounded-sm", i % 3 === 0 ? "bg-brand-500" : "bg-white/25")} style={{ left: 8 + (i % 3) * 28, top: 18 + Math.floor(i / 3) * 18 }} />)}</>}
        {k === "podium" && <>{([[34, 20, "bg-brand-500"], [8, 12, "bg-white/40"], [60, 8, "bg-white/25"]] as const).map(([x, h, c], i) => <span key={i} className={cx("absolute bottom-1.5 w-6 rounded-t-sm", c)} style={{ left: x, height: h }} />)}<span className="absolute top-2 right-2 h-2 w-8 rounded-sm bg-white/80" /></>}
        {k === "wall" && <>{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={cx("absolute h-3.5 w-9 rounded-sm", i === 0 ? "bg-brand-500" : "bg-white/25")} style={{ left: 6 + (i % 2) * 44, top: 6 + Math.floor(i / 2) * 16 }} />)}<span className="absolute top-1 right-2 h-2 w-5 rounded-sm bg-white/80" /></>}
    </span>
);

/**
 * The presenter console. Used for the organisation (Admin) and for one page (PageManage); the caller saves `live` through `push`.
 * Control labels: "Layout" group, "Theme" group, "Goal (USD)" + "Save goal", "Message" + "Amount (USD)" + "Show on screen" + "Clear",
 * "Item n" / "Amount n" + "Add item" + "Save items", "Fire confetti", "QR code" toggle, "Pause" toggle, "Open live screen", "Copy give link".
 */
export const LiveConsole = ({ live, push, liveUrl, overlayUrl, giveUrl, scope }: { live: LiveState; push: (patch: LiveState) => Promise<void> | void; liveUrl: string; overlayUrl: string; giveUrl: string; scope: string }) => {
    const { toast } = useApp();
    const [ask, setAsk] = useState(live.ask ?? "");
    const [askUsd, setAskUsd] = useState(live.ask_usd ? String(live.ask_usd) : "");
    const [goal, setGoal] = useState(live.goal_usd ? String(live.goal_usd) : "");
    const [items, setItems] = useState<LiveItem[]>(live.items?.length ? live.items : [{ label: "", usd: 0 }]);
    const [qr, setQr] = useState("");
    useEffect(() => { QRCode.toDataURL(giveUrl, { width: 480, margin: 2 }).then(setQr).catch(() => setQr("")); }, [giveUrl]);
    const layout = live.layout ?? "classic"; const theme = live.theme ?? "dark";
    const seg = (on: boolean) => cx("h-9 cursor-pointer rounded-full px-4 text-sm font-semibold transition", on ? "bg-brand-solid text-white shadow-xs" : "text-tertiary hover:text-primary");
    const saveItems = () => { const clean = items.map((i) => ({ label: i.label.trim(), usd: Math.round(Number(i.usd)) })).filter((i) => i.label && i.usd > 0); push({ items: clean }); toast(`${clean.length} ${clean.length === 1 ? "item" : "items"} saved`); };
    return (
        <>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
                <Panel title="Live screen" sub={`What ${scope} shows on a projector, TV or stream. Changes land on every open screen within a second.`} action={<Button size="sm" color="primary" className="rounded-full" iconLeading={LinkExternal01} onPress={() => window.open(liveUrl, "_blank")}>Open live screen</Button>}>
                    <div role="group" aria-label="Layout" className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                        {LIVE_LAYOUTS.map(([k, l, d]) => <button key={k} type="button" aria-pressed={layout === k} onClick={() => push({ layout: k })} className={cx("flex cursor-pointer items-center gap-3 rounded-2xl p-2.5 text-left ring-1 ring-inset transition outline-focus-ring focus-visible:outline-2", layout === k ? "bg-brand-secondary ring-brand" : "bg-secondary ring-secondary hover:ring-primary")}><LayoutThumbLive k={k} /><span className="min-w-0"><span className="block text-sm font-semibold text-primary">{l}</span><span className="block text-xs leading-snug text-tertiary">{d}</span></span></button>)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        <div className="flex items-center gap-3"><span className="text-sm font-semibold text-primary">Theme</span><div role="group" aria-label="Theme" className="flex gap-1 rounded-full bg-secondary p-1 ring-1 ring-secondary ring-inset">{(["dark", "light"] as const).map((t) => <button key={t} type="button" aria-pressed={theme === t} onClick={() => push({ theme: t })} className={seg(theme === t)}>{t === "dark" ? "Dark" : "Light"}</button>)}</div></div>
                        <label className="flex items-center gap-2 text-sm font-medium text-secondary"><Toggle aria-label="QR code" isSelected={live.show_qr !== false} onChange={(v) => push({ show_qr: v })} />QR code</label>
                        <label className="flex items-center gap-2 text-sm font-medium text-secondary"><Toggle aria-label="Pause" isSelected={!!live.paused} onChange={(v) => push({ paused: v })} />Pause</label>
                        <Button size="sm" color="secondary" className="rounded-full" iconLeading={Zap} onPress={() => push({ confetti_at: Date.now() })}>Fire confetti</Button>
                    </div>
                </Panel>
                <Panel title="Give from a phone" sub="The QR code on the live screen opens this page. Donors pick an impact item and give in a few taps.">
                    <div className="flex items-center gap-4">{qr ? <img src={qr} alt="QR code to the give screen" className="size-28 shrink-0 rounded-2xl bg-white p-1.5 ring-1 ring-secondary" /> : <span className="flex size-28 shrink-0 items-center justify-center rounded-2xl bg-secondary"><QrCode01 className="size-8 text-quaternary" /></span>}<div className="flex min-w-0 flex-col gap-2"><span className="truncate text-xs text-tertiary">{giveUrl.replace(/^https?:\/\//, "")}</span><Button size="sm" color="secondary" className="w-fit rounded-full" iconLeading={Copy01} onPress={() => { navigator.clipboard?.writeText(giveUrl); toast("Link copied"); }}>Copy give link</Button>{qr && <a href={qr} download="give-qr.png" className="text-xs font-semibold text-brand-secondary hover:underline">Download QR</a>}</div></div>
                </Panel>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Goal for tonight" sub="The thermometer on the live screen fills toward this. Leave it empty to hide the bar.">
                    <div className="flex items-end gap-3"><Input label="Goal (USD)" type="number" value={goal} onChange={setGoal} placeholder="25000" /><Button size="md" color="primary" className="rounded-full" onPress={() => push({ goal_usd: Number(goal) || undefined })}>Save goal</Button></div>
                </Panel>
                <Panel title="The ask" sub="A banner across every live screen: a matching challenge, a target for the next ten minutes, a thank-you.">
                    <div className="grid gap-3 sm:grid-cols-[1fr_9rem]"><Input label="Message" value={ask} onChange={setAsk} placeholder="Who gives $500 for a borehole?" /><Input label="Amount (USD)" type="number" value={askUsd} onChange={setAskUsd} /></div>
                    <div className="flex flex-wrap gap-2"><Button size="md" color="primary" className="rounded-full" onPress={() => push({ ask: ask.trim(), ask_usd: Number(askUsd) || undefined })}>Show on screen</Button><Button size="md" color="secondary" className="rounded-full" onPress={() => { setAsk(""); setAskUsd(""); push({ ask: "", ask_usd: undefined }); }}>Clear</Button></div>
                </Panel>
            </div>
            <Panel title="Impact items" sub="What a gift buys. These are the tappable choices on the phone give screen and the tiles of the Impact layout." action={<Button size="sm" color="primary" className="rounded-full" onPress={saveItems}>Save items</Button>}>
                <div className="flex flex-col gap-2">
                    {items.map((it, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]"><Input aria-label={`Item ${i + 1}`} label={i === 0 ? "Item" : undefined} placeholder="A borehole for a village" value={it.label} onChange={(v) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, label: v } : x)))} /><Input aria-label={`Amount ${i + 1}`} label={i === 0 ? "USD" : undefined} type="number" placeholder="6000" value={it.usd ? String(it.usd) : ""} onChange={(v) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, usd: Number(v) || 0 } : x)))} /><Button size="md" color="tertiary" aria-label="Remove item" iconLeading={Trash01} onPress={() => setItems((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : [{ label: "", usd: 0 }]))} /></div>)}
                    <Button size="sm" color="secondary" className="w-fit rounded-full" iconLeading={Plus} onPress={() => setItems((xs) => [...xs, { label: "", usd: 0 }])}>Add item</Button>
                </div>
            </Panel>
            <Panel title="Stream overlay" sub="Transparent browser source for OBS, Streamlabs or any streaming tool. 1280×200 works well.">
                <div className="grid gap-2 md:grid-cols-3"><CopyRow label="Goal bar" url={overlayUrl} /><CopyRow label="Alerts only" url={`${overlayUrl}/alert`} /><CopyRow label="Bar + recent gifts" url={`${overlayUrl}/ticker`} /></div>
            </Panel>
        </>
    );
};
