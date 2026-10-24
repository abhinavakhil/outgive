import { useEffect, useState } from "react";
import { Announcement01, ArrowLeft, Check, CoinsStacked01, Copy01, Edit05, Gift01, Heart, Plus, Share07, Target04, Ticket01, Trash01, Tv01, Users01 } from "@untitledui/icons";
import QRCode from "qrcode";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
import { TextArea } from "@/components/base/textarea/textarea";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { CoverMedia, DescriptionEditor, readImage, youtubeId } from "@/components/outgive/media";
import { ConsoleShell, CopyRow, Empty, Fieldset, LiveConsole, Panel, Stat, Who, ago, useApp } from "@/components/outgive/shared";
import { CAUSES, type Cover, LAYOUTS, PREFIX } from "@/data";
import { fmt } from "@/lib/money";
import type { DonationRow, LiveState, PageBundle, PageRow, TicketType } from "@/lib/types";
import { persistCover } from "@/lib/media";
import { cx } from "@/utils/cx";

type Tab = "edit" | "updates" | "gifts" | "tickets" | "fundraisers" | "live" | "share";
const field = "flex flex-col gap-1.5 text-sm font-medium text-secondary";

/** Everything the owner of a page does after publishing: edit, post updates, see gifts, sell tickets, invite fundraisers, run the live screen, share. */
export const PageManage = ({ bundle, reload }: { bundle: PageBundle; reload: () => void }) => {
    const { db, org, member, go, href, toast, money } = useApp();
    const p = bundle.page;
    const [tab, setTab] = useState<Tab>("edit");
    const tabs: [Tab, string, typeof Heart][] = [["edit", "Edit", Edit05], ["updates", "Updates", Announcement01], ["gifts", "Gifts", Heart], ...(p.type === "event" ? [["tickets", "Tickets", Ticket01] as [Tab, string, typeof Heart]] : []), ...(p.type === "campaign" || p.type === "team" ? [["fundraisers", p.type === "team" ? "Members" : "Fundraisers", Users01] as [Tab, string, typeof Heart]] : []), ["live", "Live screen", Tv01], ["share", "Share", Share07]];
    const ref = { type: p.type, slug: p.slug };
    const url = `${window.location.origin}${href({ name: "page", org: org!.slug, page: ref })}`;
    const pct = p.goal_cents ? Math.min(100, Math.round((p.raised_cents / p.goal_cents) * 100)) : 0;
    const inviteUrl = `${window.location.origin}${href({ name: "create", org: org!.slug, parent: p.id })}`;
    return (
        <ConsoleShell nav={tabs} current={tab} onNav={(k) => setTab(k as Tab)}
            crumb={<span className="hidden min-w-0 items-center gap-2 text-sm text-tertiary sm:flex"><span>/</span><span className="truncate font-medium text-primary">{p.title}</span></span>}
            badges={<Badge type="pill-color" color={p.status === "live" ? "success" : p.status === "draft" ? "warning" : "gray"} size="sm">{p.status}</Badge>}
            actions={<><Button size="sm" color="secondary" className="rounded-full" iconLeading={ArrowLeft} onPress={() => go({ name: "page", org: org!.slug, page: ref })}>View page</Button>{member && <Button size="sm" color="secondary" className="rounded-full max-sm:hidden" onPress={() => go({ name: "admin" })}>Dashboard</Button>}</>}>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat icon={CoinsStacked01} label="Raised" value={fmt(p.raised_cents, p.currency)} trend={p.goal_cents ? `of ${fmt(p.goal_cents, p.currency)}` : "no goal set"} tone="brand" />
                <Stat icon={Gift01} label="Gifts" value={String(p.donor_count)} trend={bundle.donations[0] ? `last ${ago(new Date(bundle.donations[0].created_at).getTime())}${ago(new Date(bundle.donations[0].created_at).getTime()) === "just now" ? "" : " ago"}` : "none yet"} />
                <Stat icon={Target04} label="Of goal" value={p.goal_cents ? `${pct}%` : "–"} trend={p.end_date ? `ends ${new Date(p.end_date).toLocaleDateString("en", { day: "numeric", month: "short" })}` : "no end date"} />
                <Stat icon={Users01} label={p.type === "team" ? "Members" : "Fundraisers"} value={String(bundle.children.length)} trend={bundle.children.length ? `${money(bundle.children.reduce((n, c) => n + c.raised_cents, 0) / 100)} raised by them` : "pages under this one"} />
            </div>
            {tab === "edit" && <EditForm p={p} onSaved={reload} />}
            {tab === "updates" && <Updates bundle={bundle} reload={reload} />}
            {tab === "gifts" && <Gifts bundle={bundle} reload={reload} />}
            {tab === "tickets" && <Tickets bundle={bundle} reload={reload} />}
            {tab === "fundraisers" && <Panel title={p.type === "team" ? "Team members" : "Fundraisers for this campaign"} sub="Anyone with this link can start a page under yours. Everything they raise rolls up into your total.">
                <CopyRow label="Invite link" url={inviteUrl} />
                <Checkbox size="md" isSelected={p.allow_fundraisers} onChange={async (v) => { await db.rpc("page_update", { page: p.id, p: { allow_fundraisers: v } }); reload(); }} label="Let supporters start their own pages under this one" />
                {bundle.children.length === 0 ? <Empty icon={Users01} title="No pages yet" sub="Share the invite link. Each page a supporter makes becomes a row here and on the board." /> : <ol className="flex flex-col divide-y divide-secondary">{bundle.children.map((c, i) => <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="w-6 text-sm font-semibold text-tertiary tabular-nums">{i + 1}</span><Who name={c.title} /><button type="button" onClick={() => go({ name: "page", org: org!.slug, page: { type: c.type, slug: c.slug } })} className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-semibold text-primary hover:underline">{c.title}</button><span className="text-xs text-tertiary">{c.donor_count} gifts</span><span className="text-sm font-semibold text-primary tabular-nums">{money(c.raised_cents / 100)}</span></li>)}</ol>}
            </Panel>}
            {tab === "live" && <PageLive p={p} reload={reload} />}
            {tab === "share" && <Share url={url} p={p} />}
        </ConsoleShell>
    );
};

/** The page's own presenter console. Saved on page.live; the page's live screen and give page read it. */
const PageLive = ({ p, reload }: { p: PageRow; reload: () => void }) => {
    const { db, org, href, toast } = useApp();
    const live: LiveState = p.live ?? {};
    const ref = { type: p.type, slug: p.slug };
    const abs = (x: string) => `${window.location.origin}${x}`;
    const push = async (patch: LiveState) => { try { await db.rpc("page_update", { page: p.id, p: { live: { ...live, ...patch } } }); reload(); } catch (e) { toast((e as Error).message); } };
    return <LiveConsole key={p.id} live={live} push={push} scope={p.title} liveUrl={abs(href({ name: "live", org: org!.slug, page: ref }))} overlayUrl={abs(href({ name: "overlay", org: org!.slug, page: ref }))} giveUrl={abs(href({ name: "give", org: org!.slug, page: ref }))} />;
};

const EditForm = ({ p, onSaved }: { p: PageRow; onSaved: () => void }) => {
    const { db, toast } = useApp();
    const [f, setF] = useState({ title: p.title, org_name: p.org_name, story: p.story, goal: String(p.goal_cents / 100), end_date: p.end_date ?? "", show_goal: p.show_goal, layout: p.layout, status: p.status, causes: p.causes, gifts: p.gifts.join(", "), allocation: p.allocation });
    const [cover, setCover] = useState<Cover>(p.cover);
    const [coverTab, setCoverTab] = useState<"image" | "video" | "youtube">(p.cover.kind === "youtube" ? "youtube" : p.cover.kind === "video" ? "video" : "image");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const save = async () => {
        setBusy(true); setErr("");
        try {
            const c = await persistCover(db, cover, `covers/${p.id}`);
            await db.rpc("page_update", { page: p.id, p: { title: f.title.trim(), org_name: f.org_name.trim(), story: f.story, cover: c, goal_cents: Math.round(Number(f.goal) * 100) || 0, end_date: f.end_date || "", show_goal: f.show_goal, layout: f.layout, status: f.status, causes: f.causes, gifts: f.gifts.split(/[,\s]+/).map(Number).filter((n) => n > 0).slice(0, 4), allocation: f.allocation.filter(([l, v]) => l.trim() && v > 0) } });
            toast("Saved"); onSaved();
        } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
    };
    const saveBtn = <Button type="submit" color="primary" size="md" className="rounded-full" isDisabled={busy || !f.title.trim()}>{busy ? "Saving…" : "Save changes"}</Button>;
    return (
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="contents">
            <Panel title="Page settings" sub="Everything here is live the moment you save." action={saveBtn}>
                <Fieldset title="Basics" sub="The title is the headline; the organisation is who the gifts go to.">
                    <Input label="Title" value={f.title} onChange={(v) => setF({ ...f, title: v })} isRequired />
                    <Input label="Organisation shown" value={f.org_name} onChange={(v) => setF({ ...f, org_name: v })} />
                    <NativeSelect label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as PageRow["status"] })} options={[["live", "Live: taking gifts"], ["paused", "Paused: visible, not taking gifts"], ["ended", "Ended"], ["draft", "Draft: hidden"]].map(([v, l]) => ({ label: l, value: v }))} />
                    <NativeSelect label="Layout" value={f.layout} onChange={(e) => setF({ ...f, layout: e.target.value as PageRow["layout"] })} options={LAYOUTS.map((l) => ({ label: l.name, value: l.id }))} />
                </Fieldset>
                <Fieldset title="Goal and gifts" sub="A visible goal lifts giving; suggested amounts set the anchors.">
                    <Input label={`Goal (${p.currency})`} type="number" value={f.goal} onChange={(v) => setF({ ...f, goal: v })} />
                    <Input label="End date" type="date" value={f.end_date} onChange={(v) => setF({ ...f, end_date: v })} />
                    <Input label="Suggested gifts (up to 4)" value={f.gifts} onChange={(v) => setF({ ...f, gifts: v })} hint="e.g. 10, 25, 50, 100" />
                    <div className="flex items-end pb-1"><Checkbox size="md" isSelected={f.show_goal} onChange={(v) => setF({ ...f, show_goal: v })} label="Show the goal and progress bar" /></div>
                </Fieldset>
                <Fieldset title="Causes" sub="Up to three. They tag the page in search and on the board." cols={1}>
                    <div className={field}><div className="flex flex-wrap gap-1.5">{CAUSES.map((c) => <button key={c} type="button" aria-pressed={f.causes.includes(c)} onClick={() => setF({ ...f, causes: f.causes.includes(c) ? f.causes.filter((x) => x !== c) : f.causes.length < 3 ? [...f.causes, c] : f.causes })} className={cx("cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition", f.causes.includes(c) ? "bg-brand-solid text-white ring-transparent" : "bg-primary text-secondary ring-secondary hover:bg-secondary")}>{c}</button>)}</div></div>
                </Fieldset>
                <Fieldset title="Cover" sub="A photo, a short video, or a YouTube link." cols={1}>
                    <div role="group" className="flex w-fit gap-1 rounded-full bg-secondary p-1 ring-1 ring-secondary ring-inset">{(["image", "video", "youtube"] as const).map((k) => <button key={k} type="button" aria-pressed={coverTab === k} onClick={() => { setCoverTab(k); if (cover.kind !== k) setCover({ kind: "none", src: "" }); }} className={cx("h-9 cursor-pointer rounded-full px-4 text-sm font-semibold transition", coverTab === k ? "bg-brand-solid text-white shadow-xs" : "text-tertiary hover:text-primary")}>{k === "youtube" ? "YouTube" : k[0].toUpperCase() + k.slice(1)}</button>)}</div>
                    {coverTab === "image" && cover.kind !== "image" && <FileUpload.DropZone className="min-h-40 justify-center" hint="JPG, PNG or WebP" accept="image/*" allowsMultiple={false} onDropFiles={async (files) => setCover({ kind: "image", src: await readImage(files[0]) })} />}
                    {coverTab === "video" && cover.kind !== "video" && <FileUpload.DropZone className="min-h-40 justify-center" hint="MP4 or WebM, up to 50 MB" accept="video/mp4,video/webm,video/quicktime" allowsMultiple={false} maxSize={50 * 1024 * 1024} onDropFiles={(files) => setCover({ kind: "video", src: URL.createObjectURL(files[0]) })} />}
                    {coverTab === "youtube" && <Input aria-label="YouTube link" placeholder="https://www.youtube.com/watch?v=…" value={cover.kind === "youtube" ? cover.src : ""} onChange={(v) => setCover({ kind: "youtube", src: v })} isInvalid={cover.kind === "youtube" && !!cover.src && !youtubeId(cover.src)} />}
                    {cover.kind !== "none" && (cover.kind !== "youtube" || youtubeId(cover.src)) && <div className="flex flex-col gap-2"><CoverMedia cover={cover} className="aspect-video max-w-md rounded-2xl" /><Button size="sm" color="secondary" className="w-fit rounded-full" iconLeading={Trash01} onPress={() => setCover({ kind: "none", src: "" })}>Remove</Button></div>}
                </Fieldset>
                <Fieldset title="Story" sub="Why this matters, in your words." cols={1}><DescriptionEditor value={f.story} onChange={(v) => setF({ ...f, story: v })} /></Fieldset>
                <Fieldset title="Where the money goes" sub="Optional split shown on the page." cols={1}>
                    <div className="flex flex-col gap-2">{f.allocation.map(([l, v], i) => <div key={i} className="grid grid-cols-[1fr_6rem_auto] gap-2"><Input aria-label="Use" placeholder="Boreholes" value={l} onChange={(x) => setF({ ...f, allocation: f.allocation.map((r, j) => (j === i ? [x, r[1]] : r)) })} /><Input aria-label="Percent" type="number" placeholder="%" value={String(v)} onChange={(x) => setF({ ...f, allocation: f.allocation.map((r, j) => (j === i ? [r[0], Number(x) || 0] : r)) })} /><Button size="md" color="tertiary" aria-label="Remove" iconLeading={Trash01} onPress={() => setF({ ...f, allocation: f.allocation.filter((_, j) => j !== i) })} /></div>)}<Button size="sm" color="secondary" className="w-fit rounded-full" iconLeading={Plus} onPress={() => setF({ ...f, allocation: [...f.allocation, ["", 0]] })}>Add a line</Button></div>
                </Fieldset>
                {err && <p className="text-sm text-error-primary">{err}</p>}
                <div className="flex justify-end border-t border-secondary pt-5">{saveBtn}</div>
            </Panel>
        </form>
    );
};

const Updates = ({ bundle, reload }: { bundle: PageBundle; reload: () => void }) => {
    const { db } = useApp();
    const [t, setT] = useState(""); const [b, setB] = useState("");
    return (
        <>
            <Panel title="Post an update" sub="Supporters who gave see it on the page; it is the best reason for them to share again.">
                <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); if (!t.trim()) return; await db.rpc("update_post", { page: bundle.page.id, t: t.trim(), b: b.trim() }); setT(""); setB(""); reload(); }}>
                    <Input aria-label="Title" placeholder="What happened?" value={t} onChange={setT} /><TextArea aria-label="Update" rows={3} placeholder="Tell supporters how their gifts are being used." value={b} onChange={setB} /><Button type="submit" size="md" color="primary" className="w-fit rounded-full" isDisabled={!t.trim()}>Post update</Button>
                </form>
            </Panel>
            <Panel title={<>Updates <span className="ml-1 text-tertiary">· {bundle.updates.length}</span></>}>
                {bundle.updates.length === 0 ? <Empty icon={Announcement01} title="No updates yet" sub="Even a two-line update doubles the chance a supporter shares the page." /> : <ol className="flex flex-col gap-3">{bundle.updates.map((u) => <li key={u.id} className="rounded-2xl bg-secondary p-4"><div className="text-xs text-tertiary">{new Date(u.created_at).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" })}</div><div className="mt-0.5 font-semibold text-primary">{u.title}</div><p className="mt-1 text-sm text-tertiary">{u.body}</p></li>)}</ol>}
            </Panel>
        </>
    );
};

const Gifts = ({ bundle, reload }: { bundle: PageBundle; reload: () => void }) => {
    const { db, member, money, toast } = useApp();
    const [f, setF] = useState({ donor_name: "", amount: "", source: "offline", message: "" });
    const record = async () => {
        if (!(Number(f.amount) > 0)) return;
        await db.rpc<DonationRow>("donation_record", { p: { page_id: bundle.page.id, donor_name: f.donor_name.trim(), amount_cents: Math.round(Number(f.amount) * 100), currency: bundle.page.currency, source: f.source, message: f.message.trim() } });
        setF({ donor_name: "", amount: "", source: "offline", message: "" }); toast("Gift recorded"); reload();
    };
    return (
        <>
            {member && <Panel title="Record a gift taken elsewhere" sub="Cash, a cheque, a bank transfer, or a pledge from the room at an event. It shows on the page and the live screen at once." action={<Button size="md" color="primary" className="rounded-full" iconLeading={Plus} isDisabled={!(Number(f.amount) > 0)} onPress={record}>Record</Button>}>
                <div className="grid gap-3 sm:grid-cols-4"><Input label="Name" value={f.donor_name} onChange={(v) => setF({ ...f, donor_name: v })} /><Input label={`Amount (${bundle.page.currency})`} type="number" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /><NativeSelect label="Kind" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} options={[{ label: "Offline gift", value: "offline" }, { label: "Pledge", value: "pledge" }]} /><Input label="Message" value={f.message} onChange={(v) => setF({ ...f, message: v })} /></div>
            </Panel>}
            <Panel title={<>Gifts <span className="ml-1 text-tertiary">· {bundle.page.donor_count}</span></>}>
                {bundle.donations.length === 0 ? <Empty icon={Heart} title="No gifts yet" sub="Share the page; the first gift is the hardest and the second comes fast." /> : <ul className="flex flex-col divide-y divide-secondary">{bundle.donations.map((d) => <li key={d.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><Who name={d.name} /><span className="min-w-0 flex-1"><span className="flex items-center gap-2 truncate font-semibold text-primary">{d.name}{d.recurring && <Badge type="pill-color" color="brand" size="sm">Monthly</Badge>}{d.source !== "card" && d.source !== "demo" && <Badge type="pill-color" color="gray" size="sm">{d.source}</Badge>}</span>{(d.cause || d.message) && <span className="block truncate text-sm text-tertiary">{[d.cause, d.message].filter(Boolean).join(" · ")}</span>}</span><span className="text-xs text-tertiary">{ago(new Date(d.created_at).getTime())}</span><span className="font-semibold text-primary tabular-nums">{money(d.usd_cents / 100)}</span></li>)}</ul>}
            </Panel>
        </>
    );
};

const Tickets = ({ bundle, reload }: { bundle: PageBundle; reload: () => void }) => {
    const { db, toast } = useApp();
    const [items, setItems] = useState<Partial<TicketType>[]>(bundle.tickets.length ? bundle.tickets : [{ name: "Seat", description: "", price_cents: 5000, quantity: null }]);
    const set = (i: number, patch: Partial<TicketType>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    return (
        <Panel title="Ticket types" sub="Leave the quantity blank for unlimited. Sold tickets cannot be deleted. Tickets are sold through the Give button on the page; a ticket counts as a gift of its price." action={<Button size="md" color="primary" className="rounded-full" onPress={async () => { await db.rpc("ticket_types_set", { page: bundle.page.id, items: items.filter((t) => t.name?.trim()) }); toast("Tickets saved"); reload(); }}>Save tickets</Button>}>
            {items.map((t, i) => <div key={t.id ?? i} className="grid gap-2 rounded-2xl bg-secondary p-3 sm:grid-cols-[1fr_1fr_7rem_6rem_auto] sm:items-end"><Input label="Name" placeholder="Seat" value={t.name ?? ""} onChange={(v) => set(i, { name: v })} /><Input label="Description" placeholder="Dinner and programme" value={t.description ?? ""} onChange={(v) => set(i, { description: v })} /><Input label="Price" type="number" value={String((t.price_cents ?? 0) / 100)} onChange={(v) => set(i, { price_cents: Math.round(Number(v) * 100) || 0 })} /><Input label="Quantity" type="number" placeholder="∞" value={t.quantity == null ? "" : String(t.quantity)} onChange={(v) => set(i, { quantity: v === "" ? null : Number(v) })} /><Button size="md" color="tertiary" aria-label="Remove" iconLeading={Trash01} isDisabled={!!t.sold} onPress={() => setItems((xs) => xs.filter((_, j) => j !== i))} />{!!t.sold && <span className="text-xs text-tertiary sm:col-span-5">{t.sold} sold</span>}</div>)}
            <Button size="sm" color="secondary" className="w-fit rounded-full" iconLeading={Plus} onPress={() => setItems((xs) => [...xs, { name: "", description: "", price_cents: 0, quantity: null }])}>Add a type</Button>
        </Panel>
    );
};

const Share = ({ url, p }: { url: string; p: PageRow }) => {
    const { toast, org, href } = useApp();
    const [qr, setQr] = useState("");
    useEffect(() => { QRCode.toDataURL(url, { width: 480, margin: 2 }).then(setQr).catch(() => setQr("")); }, [url]);
    const ref = { type: p.type, slug: p.slug };
    const embed = `<iframe src="${window.location.origin}${href({ name: "embed", org: org!.slug, page: ref })}" width="360" height="220" style="border:0;border-radius:16px" title="${p.title}"></iframe>`;
    return (
        <>
            <Panel title="Share the page" sub={<span className="flex items-center gap-1.5"><Check className="size-3.5" />Address: /{PREFIX[p.type]}/{p.slug}</span>}>
                <div className="flex flex-wrap items-center gap-5">{qr && <img src={qr} alt="QR code" className="size-32 shrink-0 rounded-2xl bg-white p-1.5 ring-1 ring-secondary" />}<div className="flex min-w-0 flex-1 flex-col gap-2"><CopyRow label="Page" url={url} /><CopyRow label="Give page (phone)" url={`${window.location.origin}${href({ name: "give", org: org!.slug, page: ref })}`} />{qr && <a href={qr} download={`${p.slug}-qr.png`} className="text-xs font-semibold text-brand-secondary hover:underline">Download QR as PNG</a>}</div></div>
            </Panel>
            <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Embed on your website"><pre className="rounded-2xl bg-secondary p-4 text-xs leading-relaxed break-all whitespace-pre-wrap text-secondary">{embed}</pre><Button size="sm" color="secondary" className="w-fit rounded-full" iconLeading={Copy01} onPress={() => { navigator.clipboard?.writeText(embed); toast("Embed code copied"); }}>Copy embed code</Button></Panel>
                <Panel title="Screens" sub="For a projector or a stream. Configure them under Live screen."><CopyRow label="Live screen" url={`${window.location.origin}${href({ name: "live", org: org!.slug, page: ref })}`} /><CopyRow label="Stream overlay" url={`${window.location.origin}${href({ name: "overlay", org: org!.slug, page: ref })}`} /></Panel>
            </div>
        </>
    );
};
