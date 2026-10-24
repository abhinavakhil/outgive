import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy01, Plus, Trash01 } from "@untitledui/icons";
import QRCode from "qrcode";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
import { TextArea } from "@/components/base/textarea/textarea";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { CoverMedia, DescriptionEditor, readImage, youtubeId } from "@/components/outgive/media";
import { BrandLogo, Container, ThemeToggle, ago, useApp } from "@/components/outgive/shared";
import { CAUSES, type Cover, LAYOUTS, PREFIX } from "@/data";
import { fmt } from "@/lib/money";
import type { DonationRow, PageBundle, PageRow, TicketType } from "@/lib/types";
import { persistCover } from "@/lib/media";
import { cx } from "@/utils/cx";

type Tab = "edit" | "updates" | "gifts" | "tickets" | "fundraisers" | "share";
const field = "flex flex-col gap-1.5 text-sm font-medium text-secondary";

/** Everything the owner of a page does after publishing: edit, post updates, see gifts, sell tickets, invite fundraisers, share. */
export const PageManage = ({ bundle, reload }: { bundle: PageBundle; reload: () => void }) => {
    const { db, org, member, go, href, toast, money } = useApp();
    const p = bundle.page;
    const [tab, setTab] = useState<Tab>("edit");
    const tabs: [Tab, string][] = [["edit", "Edit"], ["updates", "Updates"], ["gifts", "Gifts"], ...(p.type === "event" ? [["tickets", "Tickets"] as [Tab, string]] : []), ...(p.type === "campaign" || p.type === "team" ? [["fundraisers", p.type === "team" ? "Members" : "Fundraisers"] as [Tab, string]] : []), ["share", "Share"]];
    const ref = { type: p.type, slug: p.slug };
    const url = `${window.location.origin}${href({ name: "page", org: org!.slug, page: ref })}`;
    return (
        <div className="min-h-dvh bg-secondary">
            <header className="sticky top-0 z-30 border-b border-secondary bg-primary"><Container className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3"><BrandLogo onClick={() => go({ name: "home" })} /><span className="truncate text-sm text-tertiary">/ {p.title}</span><Badge type="pill-color" color={p.status === "live" ? "success" : p.status === "draft" ? "warning" : "gray"} size="sm">{p.status}</Badge></div>
                <div className="flex items-center gap-2"><ThemeToggle /><Button size="sm" color="secondary" className="rounded-full" iconLeading={ArrowLeft} onPress={() => go({ name: "page", org: org!.slug, page: ref })}>View page</Button>{member && <Button size="sm" color="secondary" className="rounded-full" onPress={() => go({ name: "admin" })}>Organiser dashboard</Button>}</div>
            </Container></header>
            <Container className="grid gap-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">{tabs.map(([k, l]) => <button key={k} type="button" aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)} className={cx("shrink-0 cursor-pointer rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold outline-focus-ring focus-visible:outline-2", tab === k ? "bg-primary text-primary shadow-xs" : "text-tertiary hover:text-primary")}>{l}</button>)}</nav>
                <main className="flex min-w-0 flex-col gap-5">
                    <div className="grid grid-cols-3 gap-3">{([[fmt(p.raised_cents, p.currency), "raised"], [String(p.donor_count), "gifts"], [p.goal_cents ? `${Math.min(100, Math.round((p.raised_cents / p.goal_cents) * 100))}%` : "–", "of goal"]] as [string, string][]).map(([v, l]) => <div key={l} className="rounded-2xl bg-primary p-4 ring-1 ring-secondary ring-inset"><div className="text-xl font-semibold text-primary tabular-nums">{v}</div><div className="text-xs text-tertiary">{l}</div></div>)}</div>
                    {tab === "edit" && <EditForm p={p} onSaved={reload} />}
                    {tab === "updates" && <Updates bundle={bundle} reload={reload} />}
                    {tab === "gifts" && <Gifts bundle={bundle} reload={reload} />}
                    {tab === "tickets" && <Tickets bundle={bundle} reload={reload} />}
                    {tab === "fundraisers" && <section className="flex flex-col gap-4 rounded-2xl bg-primary p-5 ring-1 ring-secondary ring-inset">
                        <div><h2 className="text-lg font-semibold text-primary">{p.type === "team" ? "Team members" : "Fundraisers for this campaign"}</h2><p className="text-sm text-tertiary">Anyone with this link can start a page under yours. Everything they raise rolls up into your total.</p></div>
                        <div className="flex items-center gap-2 rounded-full bg-secondary p-1.5 pl-4 ring-1 ring-secondary ring-inset"><span className="min-w-0 flex-1 truncate text-sm text-secondary">{window.location.origin}{href({ name: "create", org: org!.slug, parent: p.id })}</span><Button size="sm" color="primary" className="rounded-full" iconLeading={Copy01} onPress={() => { navigator.clipboard?.writeText(`${window.location.origin}${href({ name: "create", org: org!.slug, parent: p.id })}`); toast("Invite link copied"); }}>Copy</Button></div>
                        <Checkbox size="md" isSelected={p.allow_fundraisers} onChange={async (v) => { await db.rpc("page_update", { page: p.id, p: { allow_fundraisers: v } }); reload(); }} label="Let supporters start their own pages under this one" />
                        <ol className="flex flex-col">{bundle.children.map((c, i) => <li key={c.id} className="flex items-center gap-3 border-t border-secondary py-3"><span className="w-6 text-sm font-semibold text-tertiary">{i + 1}</span><button type="button" onClick={() => go({ name: "page", org: org!.slug, page: { type: c.type, slug: c.slug } })} className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-semibold text-primary hover:underline">{c.title}</button><span className="text-xs text-tertiary">{c.donor_count} gifts</span><span className="text-sm font-semibold text-brand-secondary">{money(c.raised_cents / 100)}</span></li>)}{bundle.children.length === 0 && <li className="py-4 text-sm text-tertiary">No pages yet. Share the invite link.</li>}</ol>
                    </section>}
                    {tab === "share" && <Share url={url} p={p} />}
                </main>
            </Container>
        </div>
    );
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
    return (
        <form className="flex flex-col gap-5 rounded-2xl bg-primary p-5 ring-1 ring-secondary ring-inset" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Title" value={f.title} onChange={(v) => setF({ ...f, title: v })} isRequired />
                <Input label="Organisation shown" value={f.org_name} onChange={(v) => setF({ ...f, org_name: v })} />
                <Input label={`Goal (${p.currency})`} type="number" value={f.goal} onChange={(v) => setF({ ...f, goal: v })} />
                <Input label="End date" type="date" value={f.end_date} onChange={(v) => setF({ ...f, end_date: v })} />
                <NativeSelect label="Layout" value={f.layout} onChange={(e) => setF({ ...f, layout: e.target.value as PageRow["layout"] })} options={LAYOUTS.map((l) => ({ label: l.name, value: l.id }))} />
                <NativeSelect label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as PageRow["status"] })} options={[["live", "Live: taking gifts"], ["paused", "Paused: visible, not taking gifts"], ["ended", "Ended"], ["draft", "Draft: hidden"]].map(([v, l]) => ({ label: l, value: v }))} />
                <Input label="Suggested gifts (up to 4)" value={f.gifts} onChange={(v) => setF({ ...f, gifts: v })} hint="e.g. 10, 25, 50, 100" />
                <div className={field}>Causes<div className="flex flex-wrap gap-1.5">{CAUSES.map((c) => <button key={c} type="button" aria-pressed={f.causes.includes(c)} onClick={() => setF({ ...f, causes: f.causes.includes(c) ? f.causes.filter((x) => x !== c) : f.causes.length < 3 ? [...f.causes, c] : f.causes })} className={cx("cursor-pointer rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset", f.causes.includes(c) ? "bg-brand-solid text-white ring-transparent" : "text-secondary ring-secondary hover:bg-secondary")}>{c}</button>)}</div></div>
            </div>
            <Checkbox size="md" isSelected={f.show_goal} onChange={(v) => setF({ ...f, show_goal: v })} label="Show the goal and progress bar" />
            <div className="flex flex-col gap-3"><span className="text-sm font-medium text-secondary">Cover</span>
                <div role="group" className="flex w-fit gap-1 rounded-full bg-secondary p-1 ring-1 ring-secondary ring-inset">{(["image", "video", "youtube"] as const).map((k) => <button key={k} type="button" aria-pressed={coverTab === k} onClick={() => { setCoverTab(k); if (cover.kind !== k) setCover({ kind: "none", src: "" }); }} className={cx("h-9 cursor-pointer rounded-full px-4 text-sm font-semibold", coverTab === k ? "bg-brand-solid text-white" : "text-tertiary")}>{k === "youtube" ? "YouTube" : k[0].toUpperCase() + k.slice(1)}</button>)}</div>
                {coverTab === "image" && cover.kind !== "image" && <FileUpload.DropZone className="min-h-40 justify-center" hint="JPG, PNG or WebP" accept="image/*" allowsMultiple={false} onDropFiles={async (files) => setCover({ kind: "image", src: await readImage(files[0]) })} />}
                {coverTab === "video" && cover.kind !== "video" && <FileUpload.DropZone className="min-h-40 justify-center" hint="MP4 or WebM, up to 50 MB" accept="video/mp4,video/webm,video/quicktime" allowsMultiple={false} maxSize={50 * 1024 * 1024} onDropFiles={(files) => setCover({ kind: "video", src: URL.createObjectURL(files[0]) })} />}
                {coverTab === "youtube" && <Input aria-label="YouTube link" placeholder="https://www.youtube.com/watch?v=…" value={cover.kind === "youtube" ? cover.src : ""} onChange={(v) => setCover({ kind: "youtube", src: v })} isInvalid={cover.kind === "youtube" && !!cover.src && !youtubeId(cover.src)} />}
                {cover.kind !== "none" && (cover.kind !== "youtube" || youtubeId(cover.src)) && <div className="flex flex-col gap-2"><CoverMedia cover={cover} className="aspect-video max-w-md" /><Button size="sm" color="secondary" className="w-fit rounded-full" iconLeading={Trash01} onPress={() => setCover({ kind: "none", src: "" })}>Remove</Button></div>}
            </div>
            <div className="flex flex-col gap-1.5"><span className="text-sm font-medium text-secondary">Story</span><DescriptionEditor value={f.story} onChange={(v) => setF({ ...f, story: v })} /></div>
            <div className="flex flex-col gap-2"><span className="text-sm font-medium text-secondary">Where the money goes</span>{f.allocation.map(([l, v], i) => <div key={i} className="grid grid-cols-[1fr_6rem_auto] gap-2"><Input aria-label="Use" value={l} onChange={(x) => setF({ ...f, allocation: f.allocation.map((r, j) => (j === i ? [x, r[1]] : r)) })} /><Input aria-label="Percent" type="number" value={String(v)} onChange={(x) => setF({ ...f, allocation: f.allocation.map((r, j) => (j === i ? [r[0], Number(x) || 0] : r)) })} /><Button size="md" color="tertiary" aria-label="Remove" iconLeading={Trash01} onPress={() => setF({ ...f, allocation: f.allocation.filter((_, j) => j !== i) })} /></div>)}<Button size="sm" color="secondary" className="w-fit rounded-full" iconLeading={Plus} onPress={() => setF({ ...f, allocation: [...f.allocation, ["", 0]] })}>Add a line</Button></div>
            {err && <p className="text-sm text-error-primary">{err}</p>}
            <Button type="submit" color="primary" size="lg" className="w-fit rounded-full" isDisabled={busy || !f.title.trim()}>{busy ? "Saving…" : "Save changes"}</Button>
        </form>
    );
};

const Updates = ({ bundle, reload }: { bundle: PageBundle; reload: () => void }) => {
    const { db } = useApp();
    const [t, setT] = useState(""); const [b, setB] = useState("");
    return (
        <section className="flex flex-col gap-4 rounded-2xl bg-primary p-5 ring-1 ring-secondary ring-inset">
            <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); if (!t.trim()) return; await db.rpc("update_post", { page: bundle.page.id, t: t.trim(), b: b.trim() }); setT(""); setB(""); reload(); }}>
                <h2 className="text-lg font-semibold text-primary">Post an update</h2><Input aria-label="Title" placeholder="What happened?" value={t} onChange={setT} /><TextArea aria-label="Update" rows={3} placeholder="Tell supporters how their gifts are being used." value={b} onChange={setB} /><Button type="submit" size="md" color="primary" className="w-fit rounded-full" isDisabled={!t.trim()}>Post update</Button>
            </form>
            <ol className="flex flex-col">{bundle.updates.map((u) => <li key={u.id} className="border-t border-secondary py-3"><div className="text-xs text-tertiary">{new Date(u.created_at).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" })}</div><div className="font-semibold text-primary">{u.title}</div><p className="text-sm text-tertiary">{u.body}</p></li>)}</ol>
        </section>
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
        <section className="flex flex-col gap-4 rounded-2xl bg-primary p-5 ring-1 ring-secondary ring-inset">
            {member && <form className="flex flex-col gap-3 rounded-xl bg-secondary p-4" onSubmit={(e) => { e.preventDefault(); record(); }}>
                <div><h2 className="font-semibold text-primary">Record a gift taken elsewhere</h2><p className="text-sm text-tertiary">Cash, a cheque, a bank transfer, or a pledge from the room at an event. It shows on the page and the live screen at once.</p></div>
                <div className="grid gap-3 sm:grid-cols-4"><Input label="Name" value={f.donor_name} onChange={(v) => setF({ ...f, donor_name: v })} /><Input label={`Amount (${bundle.page.currency})`} type="number" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /><NativeSelect label="Kind" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} options={[{ label: "Offline gift", value: "offline" }, { label: "Pledge", value: "pledge" }]} /><Input label="Message" value={f.message} onChange={(v) => setF({ ...f, message: v })} /></div>
                <Button type="submit" size="md" color="primary" className="w-fit rounded-full" isDisabled={!(Number(f.amount) > 0)}>Record</Button>
            </form>}
            <ul className="flex flex-col">{bundle.donations.map((d) => <li key={d.id} className="flex items-center gap-3 border-t border-secondary py-3"><span className="min-w-0 flex-1"><span className="block truncate font-medium text-primary">{d.name}{d.recurring && <Badge type="pill-color" color="brand" size="sm" className="ml-2">Monthly</Badge>}{d.source !== "card" && d.source !== "demo" && <span className="ml-2 text-xs text-tertiary">{d.source}</span>}</span>{d.message && <span className="block truncate text-sm text-tertiary">{d.message}</span>}</span><span className="text-xs text-tertiary">{ago(new Date(d.created_at).getTime())}</span><span className="font-semibold text-primary">{money(d.usd_cents / 100)}</span></li>)}{bundle.donations.length === 0 && <li className="py-4 text-sm text-tertiary">No gifts yet.</li>}</ul>
        </section>
    );
};

const Tickets = ({ bundle, reload }: { bundle: PageBundle; reload: () => void }) => {
    const { db, toast } = useApp();
    const [items, setItems] = useState<Partial<TicketType>[]>(bundle.tickets.length ? bundle.tickets : [{ name: "Seat", description: "", price_cents: 5000, quantity: null }]);
    const set = (i: number, patch: Partial<TicketType>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    return (
        <section className="flex flex-col gap-4 rounded-2xl bg-primary p-5 ring-1 ring-secondary ring-inset">
            <div><h2 className="text-lg font-semibold text-primary">Ticket types</h2><p className="text-sm text-tertiary">Leave the quantity blank for unlimited. Sold tickets cannot be deleted.</p></div>
            {items.map((t, i) => <div key={t.id ?? i} className="grid gap-2 rounded-xl bg-secondary p-3 sm:grid-cols-[1fr_1fr_7rem_6rem_auto]"><Input aria-label="Name" placeholder="Seat" value={t.name ?? ""} onChange={(v) => set(i, { name: v })} /><Input aria-label="Description" placeholder="Dinner and programme" value={t.description ?? ""} onChange={(v) => set(i, { description: v })} /><Input aria-label="Price" type="number" value={String((t.price_cents ?? 0) / 100)} onChange={(v) => set(i, { price_cents: Math.round(Number(v) * 100) || 0 })} /><Input aria-label="Quantity" type="number" placeholder="∞" value={t.quantity == null ? "" : String(t.quantity)} onChange={(v) => set(i, { quantity: v === "" ? null : Number(v) })} /><Button size="md" color="tertiary" aria-label="Remove" iconLeading={Trash01} isDisabled={!!t.sold} onPress={() => setItems((xs) => xs.filter((_, j) => j !== i))} />{!!t.sold && <span className="text-xs text-tertiary sm:col-span-5">{t.sold} sold</span>}</div>)}
            <div className="flex gap-2"><Button size="sm" color="secondary" className="rounded-full" iconLeading={Plus} onPress={() => setItems((xs) => [...xs, { name: "", description: "", price_cents: 0, quantity: null }])}>Add a type</Button><Button size="sm" color="primary" className="rounded-full" onPress={async () => { await db.rpc("ticket_types_set", { page: bundle.page.id, items: items.filter((t) => t.name?.trim()) }); toast("Tickets saved"); reload(); }}>Save tickets</Button></div>
            <p className="text-xs text-tertiary">Tickets are sold through the Give button on the page. A ticket counts as a gift of its price.</p>
        </section>
    );
};

const Share = ({ url, p }: { url: string; p: PageRow }) => {
    const { toast, org, href } = useApp();
    const [qr, setQr] = useState("");
    useEffect(() => { QRCode.toDataURL(url, { width: 480, margin: 2 }).then(setQr).catch(() => setQr("")); }, [url]);
    const embed = `<iframe src="${window.location.origin}${href({ name: "embed", org: org!.slug, page: { type: p.type, slug: p.slug } })}" width="360" height="220" style="border:0;border-radius:16px" title="${p.title}"></iframe>`;
    const copy = (s: string, what: string) => { navigator.clipboard?.writeText(s); toast(`${what} copied`); };
    return (
        <section className="flex flex-col gap-5 rounded-2xl bg-primary p-5 ring-1 ring-secondary ring-inset">
            <div className="flex items-center gap-2 rounded-full bg-secondary p-1.5 pl-4 ring-1 ring-secondary ring-inset"><span className="min-w-0 flex-1 truncate text-sm text-secondary">{url}</span><Button size="sm" color="primary" className="rounded-full" iconLeading={Copy01} onPress={() => copy(url, "Link")}>Copy</Button></div>
            <div className="flex flex-wrap items-center gap-5">{qr && <img src={qr} alt="QR code" className="size-36 rounded-xl bg-white p-1.5 ring-1 ring-secondary" />}<div className="flex flex-col gap-2"><div className="font-semibold text-primary">QR code</div><p className="text-sm text-tertiary">Print it on a poster or show it on screen.</p>{qr && <a href={qr} download={`${p.slug}-qr.png`} className="w-fit rounded-full bg-secondary px-3.5 py-2 text-sm font-semibold text-secondary ring-1 ring-primary ring-inset hover:bg-tertiary">Download PNG</a>}</div></div>
            <div className="flex flex-col gap-2"><div className="font-semibold text-primary">Embed on your website</div><pre className="overflow-x-auto rounded-xl bg-secondary p-3 text-xs text-secondary">{embed}</pre><Button size="sm" color="secondary" className="w-fit rounded-full" iconLeading={Copy01} onPress={() => copy(embed, "Embed code")}>Copy embed code</Button></div>
            <div className="flex flex-col gap-2"><div className="font-semibold text-primary">Live screen and stream overlay</div><p className="text-sm text-tertiary">Put <a className="font-semibold text-primary underline" href={`${window.location.origin}${href({ name: "live", org: org!.slug, page: { type: p.type, slug: p.slug } })}`} target="_blank" rel="noopener">the live screen</a> on a projector, or add <code className="rounded bg-secondary px-1">{`${window.location.origin}${href({ name: "overlay", org: org!.slug, page: { type: p.type, slug: p.slug } })}`}</code> as a browser source in OBS.</p></div>
            <p className="flex items-center gap-1.5 text-xs text-tertiary"><Check className="size-3.5" />Address: /{PREFIX[p.type]}/{p.slug}</p>
        </section>
    );
};
