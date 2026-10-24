import { type ReactNode, useEffect, useState } from "react";
import { Copy01, Download01, LinkExternal01, Plus, RefreshCw01, Tv01, Upload01, Zap } from "@untitledui/icons";
import QRCode from "qrcode";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
import { TextArea } from "@/components/base/textarea/textarea";
import { Toggle } from "@/components/base/toggle/toggle";
import { BrandLogo, BrandMark, Container, ThemeToggle, ago, useApp } from "@/components/outgive/shared";
import { CURRENCIES, FONTS, PREFIX, initials } from "@/data";
import { fmt } from "@/lib/money";
import type { DonationRow, LiveState, MatchPledge, Member, Org, OrgStats, PageRow } from "@/lib/types";
import { ALL_VARIANTS } from "@/views/boards";
import { SignIn } from "@/views/Login";
import { cx } from "@/utils/cx";

const TABS: [string, string][] = [["overview", "Overview"], ["donations", "Donations"], ["pages", "Pages"], ["live", "Live screen"], ["pledges", "Matching"], ["branding", "Branding"], ["payments", "Payments"], ["domain", "Domain & embeds"], ["members", "Team"]];
const Panel = ({ title, sub, children, className }: { title?: string; sub?: string; children: ReactNode; className?: string }) => <section className={cx("flex flex-col gap-4 rounded-2xl bg-primary p-5 ring-1 ring-secondary ring-inset", className)}>{title && <div><h2 className="text-lg font-semibold text-primary">{title}</h2>{sub && <p className="text-sm text-tertiary">{sub}</p>}</div>}{children}</section>;
const csv = (rows: Record<string, unknown>[]) => { if (!rows.length) return ""; const keys = Object.keys(rows[0]); const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`; return [keys.join(","), ...rows.map((r) => keys.map((k) => q(r[k])).join(","))].join("\n"); };
const download = (name: string, text: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };

/** The organiser's dashboard: money, gifts, pages, the live console, matching, brand, Stripe, domain and the team. */
export const Admin = ({ tab = "overview" }: { tab?: string }) => {
    const { org, user, member, go, isDemo } = useApp();
    if (!org) return null;
    if (!user) return <div className="min-h-dvh bg-primary"><Container className="max-w-md py-10"><div className="rounded-3xl p-6 ring-1 ring-secondary ring-inset"><SignIn title={`${org.name} dashboard`} sub="Sign in as a member of the organisation." /></div></Container></div>;
    if (!member) return <div className="min-h-dvh bg-primary"><Container className="max-w-md py-10 text-center"><h1 className="text-display-xs font-semibold text-primary">Members only</h1><p className="mt-2 text-tertiary">Your account is not on {org.name}'s team. Ask an organiser to add {user.email}.</p><Button color="secondary" className="mt-4 rounded-full" onPress={() => go({ name: "home" })}>Back to the board</Button></Container></div>;
    const current = TABS.some(([k]) => k === tab) ? tab : "overview";
    return (
        <div className="min-h-dvh bg-secondary">
            <header className="sticky top-0 z-30 border-b border-secondary bg-primary"><Container className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3"><BrandLogo onClick={() => go({ name: "home" })} /><Badge type="pill-color" color="gray" size="sm">Organiser</Badge>{isDemo && <Badge type="pill-color" color="warning" size="sm">Demo</Badge>}</div>
                <div className="flex items-center gap-2"><ThemeToggle /><Button size="sm" color="secondary" className="rounded-full" iconLeading={Tv01} onPress={() => window.open(`${window.location.origin}${useAppHref({ name: "live" })}`, "_blank")}>Open live screen</Button><Button size="sm" color="primary" className="rounded-full" onPress={() => go({ name: "create" })}>New campaign</Button></div>
            </Container></header>
            <Container className="grid gap-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">{TABS.map(([k, l]) => <button key={k} type="button" aria-current={current === k ? "page" : undefined} onClick={() => go({ name: "admin", org: org.slug, tab: k })} className={cx("shrink-0 cursor-pointer rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold outline-focus-ring focus-visible:outline-2", current === k ? "bg-primary text-primary shadow-xs" : "text-tertiary hover:text-primary")}>{l}</button>)}</nav>
                <main className="flex min-w-0 flex-col gap-5">
                    {!org.stripe_charges_enabled && current !== "payments" && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-primary px-4 py-3 text-sm text-warning-primary"><span><b>Payments are not connected.</b> Pages are visible but cannot take gifts until Stripe onboarding is complete.</span><Button size="sm" color="primary" className="rounded-full" onPress={() => go({ name: "admin", org: org.slug, tab: "payments" })}>Connect Stripe</Button></div>}
                    {current === "overview" && <Overview />}
                    {current === "donations" && <Donations />}
                    {current === "pages" && <Pages />}
                    {current === "live" && <LiveConsole />}
                    {current === "pledges" && <Pledges />}
                    {current === "branding" && <Branding />}
                    {current === "payments" && <Payments />}
                    {current === "domain" && <Domain />}
                    {current === "members" && <Members />}
                </main>
            </Container>
        </div>
    );
};
/** href for the current org, usable outside render order. */
const useAppHref = (v: Parameters<ReturnType<typeof useApp>["href"]>[0]) => useApp().href(v);

const Overview = () => {
    const { db, org, money } = useApp();
    const [s, setS] = useState<OrgStats | null>(null);
    useEffect(() => { db.rpc<OrgStats>("org_stats", { org: org!.id }).then(setS); }, [db, org]);
    if (!s) return <p className="text-sm text-tertiary">Loading…</p>;
    const days = s.by_day; const max = Math.max(1, ...days.map((d) => Number(d.usd_cents)));
    const kpis: [string, string][] = [["Raised (USD)", money(Number(s.raised_cents) / 100)], ["Gifts", String(s.donations)], ["Donors", String(s.donors)], ["Monthly gifts", String(s.recurring)], ["Live pages", String(s.pages)], ["Refunded", money(Number(s.refunded_cents) / 100)]];
    return (
        <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{kpis.map(([k, v]) => <div key={k} className="rounded-2xl bg-primary p-4 ring-1 ring-secondary ring-inset"><div className="text-xs font-semibold text-tertiary">{k}</div><div className="text-xl font-semibold text-primary tabular-nums">{v}</div></div>)}</div>
            <Panel title="Last 30 days" sub="Gifts per day in USD.">
                {days.length === 0 ? <p className="text-sm text-tertiary">No gifts in the last 30 days.</p> : <div className="flex h-40 items-end gap-1">{days.map((d) => <div key={d.day} title={`${d.day}: ${money(Number(d.usd_cents) / 100)}`} className="flex-1 rounded-t bg-brand-solid" style={{ height: `${(Number(d.usd_cents) / max) * 100}%` }} />)}</div>}
            </Panel>
        </>
    );
};

const Donations = () => {
    const { db, org, toast } = useApp();
    const [rows, setRows] = useState<DonationRow[]>([]);
    const [f, setF] = useState({ donor_name: "", donor_email: "", amount: "", source: "offline", supporter_kind: "Individuals", message: "" });
    const load = () => db.rpc<DonationRow[]>("org_donations", { org: org!.id, n: 500 }).then(setRows);
    useEffect(() => { load(); return db.onDonations(org!.id, () => load()); }, [db, org]); // eslint-disable-line react-hooks/exhaustive-deps
    const record = async () => {
        if (!(Number(f.amount) > 0)) return;
        await db.rpc("donation_record", { p: { org_id: org!.id, donor_name: f.donor_name.trim(), donor_email: f.donor_email.trim() || undefined, amount_cents: Math.round(Number(f.amount) * 100), currency: org!.currency, source: f.source, supporter_name: f.donor_name.trim(), supporter_kind: f.supporter_kind, message: f.message.trim() } });
        setF({ ...f, donor_name: "", donor_email: "", amount: "", message: "" }); toast("Gift recorded"); load();
    };
    const exportCsv = () => download(`${org!.slug}-donations.csv`, csv(rows.map((d) => ({ date: d.created_at, name: d.donor_name, email: d.donor_email ?? "", amount: d.amount_cents / 100, currency: d.currency, tip: d.tip_cents / 100, cover: d.cover_cents / 100, status: d.status, source: d.source, recurring: d.recurring, message: d.message, dedication: d.dedication, page_id: d.page_id ?? "", id: d.id }))));
    return (
        <>
            <Panel title="Record a gift" sub="Cash, cheques, bank transfers and pledges from the room. They count on the board and the live screen at once.">
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6"><Input label="Name" value={f.donor_name} onChange={(v) => setF({ ...f, donor_name: v })} /><Input label="Email (for a receipt)" value={f.donor_email} onChange={(v) => setF({ ...f, donor_email: v })} /><Input label={`Amount (${org!.currency})`} type="number" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /><NativeSelect label="Kind" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} options={[{ label: "Offline gift", value: "offline" }, { label: "Pledge", value: "pledge" }]} /><NativeSelect label="On the board as" value={f.supporter_kind} onChange={(e) => setF({ ...f, supporter_kind: e.target.value })} options={["Individuals", "Teams", "Companies", "Schools"].map((k) => ({ label: k, value: k }))} /><Input label="Message" value={f.message} onChange={(v) => setF({ ...f, message: v })} /></div>
                <Button size="md" color="primary" className="w-fit rounded-full" isDisabled={!(Number(f.amount) > 0)} onPress={record}>Record gift</Button>
            </Panel>
            <Panel title={`All gifts · ${rows.length}`}>
                <div className="flex flex-wrap gap-2"><Button size="sm" color="secondary" className="rounded-full" iconLeading={Download01} onPress={exportCsv}>Export CSV</Button></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[48rem] text-left text-sm"><thead className="text-xs text-tertiary"><tr><th className="py-2 pr-3 font-semibold">When</th><th className="py-2 pr-3 font-semibold">Donor</th><th className="py-2 pr-3 font-semibold">Amount</th><th className="py-2 pr-3 font-semibold">Tip</th><th className="py-2 pr-3 font-semibold">Status</th><th className="py-2 pr-3 font-semibold">Source</th><th className="py-2 font-semibold"> </th></tr></thead>
                    <tbody>{rows.map((d) => <tr key={d.id} className="border-t border-secondary"><td className="py-2 pr-3 whitespace-nowrap text-tertiary">{ago(new Date(d.created_at).getTime())}</td><td className="py-2 pr-3"><div className="font-medium text-primary">{d.donor_name}{d.anonymous && <span className="ml-1 text-xs text-tertiary">(anonymous)</span>}</div><div className="text-xs text-tertiary">{d.donor_email}{d.message && ` · ${d.message}`}</div></td><td className="py-2 pr-3 font-semibold text-primary tabular-nums">{fmt(d.amount_cents, d.currency)}{d.recurring && <span className="ml-1 text-xs text-tertiary">/mo</span>}</td><td className="py-2 pr-3 tabular-nums">{d.tip_cents ? fmt(d.tip_cents, d.currency) : "–"}</td><td className="py-2 pr-3"><Badge type="pill-color" color={d.status === "succeeded" ? "success" : d.status === "pending" ? "warning" : "error"} size="sm">{d.status}</Badge></td><td className="py-2 pr-3 text-tertiary">{d.source}</td><td className="py-2">{d.status === "succeeded" && d.source !== "card" && <Button size="sm" color="link-gray" onPress={async () => { await db.rpc("donation_set_status", { d: d.id, s: "refunded" }); load(); }}>Remove</Button>}{d.status === "succeeded" && d.source === "card" && <span className="text-xs text-tertiary">Refund in Stripe</span>}</td></tr>)}</tbody></table>
                    {rows.length === 0 && <p className="py-4 text-sm text-tertiary">No gifts yet.</p>}</div>
            </Panel>
        </>
    );
};

const Pages = () => {
    const { db, org, go } = useApp();
    const [rows, setRows] = useState<PageRow[]>([]);
    useEffect(() => { db.rpc<PageRow[]>("pages_list", { org: org!.id }).then(setRows); }, [db, org]);
    return (
        <Panel title={`Pages · ${rows.length}`} sub="Campaigns you run, and the fundraiser, team, challenge, event and in-memory pages supporters have made.">
            <ul className="flex flex-col">{rows.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-3 border-t border-secondary py-3"><span className="min-w-0 flex-1"><button type="button" onClick={() => go({ name: "page", org: org!.slug, page: { type: p.type, slug: p.slug } })} className="block cursor-pointer truncate text-left font-semibold text-primary hover:underline">{p.title}</button><span className="text-xs text-tertiary">{p.type} · /{PREFIX[p.type]}/{p.slug}{p.parent_id && " · nested"}</span></span><Badge type="pill-color" color={p.status === "live" ? "success" : p.status === "draft" ? "warning" : "gray"} size="sm">{p.status}</Badge><span className="w-28 text-right text-sm font-semibold text-primary tabular-nums">{fmt(p.raised_cents, p.currency)}</span><span className="w-16 text-right text-xs text-tertiary">{p.donor_count} gifts</span><Button size="sm" color="secondary" className="rounded-full" onPress={() => go({ name: "page", org: org!.slug, page: { type: p.type, slug: p.slug }, sub: "manage" })}>Manage</Button></li>)}</ul>
            {rows.length === 0 && <p className="text-sm text-tertiary">No pages yet.</p>}
            <Button size="md" color="primary" className="w-fit rounded-full" iconLeading={Plus} onPress={() => go({ name: "create" })}>New campaign</Button>
        </Panel>
    );
};

/** The presenter console: what every live screen shows right now. */
const LiveConsole = () => {
    const { db, org, setOrg, href, toast } = useApp();
    const live: LiveState = org!.live ?? {};
    const [ask, setAsk] = useState(live.ask ?? "");
    const [askUsd, setAskUsd] = useState(live.ask_usd ? String(live.ask_usd) : "");
    const [pages, setPages] = useState<PageRow[]>([]);
    useEffect(() => { db.rpc<PageRow[]>("pages_list", { org: org!.id }).then(setPages); }, [db, org]);
    const push = async (patch: LiveState) => { const o = await db.rpc<Org>("org_update", { org: org!.id, p: { live: { ...live, ...patch } } }); setOrg(o); };
    const liveUrl = `${window.location.origin}${href({ name: "live" })}`; const overlayUrl = `${window.location.origin}${href({ name: "overlay" })}`;
    return (
        <>
            <Panel title="Live screen" sub="Open it on a projector, a TV or a second monitor. It follows what you set here within a second.">
                <div className="flex flex-wrap gap-2"><Button size="sm" color="primary" className="rounded-full" iconLeading={LinkExternal01} onPress={() => window.open(liveUrl, "_blank")}>Open the live screen</Button><Button size="sm" color="secondary" className="rounded-full" iconLeading={Copy01} onPress={() => { navigator.clipboard?.writeText(liveUrl); toast("Link copied"); }}>Copy link</Button></div>
                <p className="text-sm text-tertiary">Each page has its own live screen and overlay too, under its Manage → Share tab.</p>
            </Panel>
            <Panel title="The ask" sub="A banner on every live screen. Use it for the moment: a matching challenge, a target for the next ten minutes, a thank-you.">
                <div className="grid gap-3 sm:grid-cols-[1fr_10rem]"><Input label="Message" value={ask} onChange={setAsk} placeholder="Who gives $500 for a borehole?" /><Input label="Amount (USD, optional)" type="number" value={askUsd} onChange={setAskUsd} /></div>
                <div className="flex flex-wrap gap-2"><Button size="md" color="primary" className="rounded-full" onPress={() => push({ ask: ask.trim(), ask_usd: Number(askUsd) || undefined })}>Show on screen</Button><Button size="md" color="secondary" className="rounded-full" onPress={() => { setAsk(""); setAskUsd(""); push({ ask: "", ask_usd: undefined }); }}>Clear</Button></div>
                <p className="text-xs text-tertiary">The amount also sets the thermometer goal on the organisation-wide screen (page screens use the page's own goal).</p>
            </Panel>
            <Panel title="Controls">
                <div className="flex flex-wrap gap-2">
                    <Button size="md" color="primary" className="rounded-full" iconLeading={Zap} onPress={() => push({ confetti_at: Date.now() })}>Fire confetti</Button>
                    <div role="group" aria-label="Mode" className="flex gap-1 rounded-full bg-secondary p-1 ring-1 ring-secondary ring-inset">{([["board", "Total + board"], ["thermo", "Total only"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={(live.mode ?? "board") === k} onClick={() => push({ mode: k })} className={cx("h-9 cursor-pointer rounded-full px-4 text-sm font-semibold", (live.mode ?? "board") === k ? "bg-brand-solid text-white" : "text-tertiary")}>{l}</button>)}</div>
                    <label className="flex items-center gap-2 text-sm text-secondary"><Toggle aria-label="Show QR code" isSelected={live.show_qr !== false} onChange={(v) => push({ show_qr: v })} />QR code</label>
                    <label className="flex items-center gap-2 text-sm text-secondary"><Toggle aria-label="Pause" isSelected={!!live.paused} onChange={(v) => push({ paused: v })} />Pause (blank the screen)</label>
                </div>
            </Panel>
            <Panel title="Stream overlay" sub="Transparent browser source for OBS, Streamlabs or any streaming tool. 1280×200 works well.">
                <div className="flex flex-col gap-2 text-sm">{[["Goal bar", overlayUrl], ["Alerts only", `${overlayUrl}?theme=alert`], ["Bar + recent gifts", `${overlayUrl}?theme=ticker`]].map(([l, u]) => <div key={l} className="flex items-center gap-2 rounded-full bg-secondary p-1.5 pl-4 ring-1 ring-secondary ring-inset"><span className="w-32 shrink-0 font-semibold text-primary">{l}</span><span className="min-w-0 flex-1 truncate text-secondary">{u}</span><Button size="sm" color="secondary" className="rounded-full" iconLeading={Copy01} onPress={() => { navigator.clipboard?.writeText(u); toast("Copied"); }}>Copy</Button></div>)}</div>
            </Panel>
            {pages.filter((p) => p.type === "campaign").length > 0 && <Panel title="Campaign screens"><ul className="flex flex-col">{pages.filter((p) => p.type === "campaign").map((p) => <li key={p.id} className="flex items-center gap-3 border-t border-secondary py-2.5 text-sm"><span className="min-w-0 flex-1 truncate font-medium text-primary">{p.title}</span><a className="font-semibold text-brand-secondary hover:underline" href={`${window.location.origin}${href({ name: "live", org: org!.slug, page: { type: p.type, slug: p.slug } })}`} target="_blank" rel="noopener">Live screen</a><a className="font-semibold text-brand-secondary hover:underline" href={`${window.location.origin}${href({ name: "overlay", org: org!.slug, page: { type: p.type, slug: p.slug } })}`} target="_blank" rel="noopener">Overlay</a></li>)}</ul></Panel>}
        </>
    );
};

const Pledges = () => {
    const { db, org, toast, refresh } = useApp();
    const [rows, setRows] = useState<MatchPledge[]>([]);
    const [f, setF] = useState({ sponsor_name: "", cap: "", ratio: "1" });
    const load = () => db.rpc<MatchPledge[]>("org_pledges", { org: org!.id }).then(setRows);
    useEffect(() => { load(); }, [db, org]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <Panel title="Matching pledges" sub="A company or donor matches every gift until their cap is reached. Each match is added as its own gift, so the board and the live screen show it at once.">
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem_6rem_auto]"><Input label="Sponsor" value={f.sponsor_name} onChange={(v) => setF({ ...f, sponsor_name: v })} placeholder="Bluefin Logistics" /><Input label={`Cap (${org!.currency})`} type="number" value={f.cap} onChange={(v) => setF({ ...f, cap: v })} /><Input label="Ratio" type="number" value={f.ratio} onChange={(v) => setF({ ...f, ratio: v })} /><Button size="md" color="primary" className="self-end rounded-full" isDisabled={!f.sponsor_name.trim() || !(Number(f.cap) > 0)} onPress={async () => { await db.rpc("match_pledge_set", { org: org!.id, p: { sponsor_name: f.sponsor_name.trim(), cap_cents: Math.round(Number(f.cap) * 100), ratio: Number(f.ratio) || 1 } }); setF({ sponsor_name: "", cap: "", ratio: "1" }); toast("Pledge added"); load(); refresh(); }}>Add</Button></div>
            <ul className="flex flex-col">{rows.map((m) => <li key={m.id} className="flex flex-wrap items-center gap-3 border-t border-secondary py-3 text-sm"><span className="min-w-0 flex-1"><span className="block font-semibold text-primary">{m.sponsor_name}</span><span className="text-xs text-tertiary">{m.ratio}× up to {fmt(m.cap_cents, org!.currency)} · matched {fmt(m.matched_cents, org!.currency)}</span></span><div className="h-2 w-40 overflow-hidden rounded-full bg-tertiary"><div className="h-full rounded-full bg-brand-solid" style={{ width: `${Math.min(100, (m.matched_cents / m.cap_cents) * 100)}%` }} /></div><label className="flex items-center gap-2"><Toggle aria-label="Active" isSelected={m.active} onChange={async (v) => { await db.rpc("match_pledge_set", { org: org!.id, p: { id: m.id, active: v } }); load(); }} />Active</label></li>)}</ul>
            {rows.length === 0 && <p className="text-sm text-tertiary">No pledges yet.</p>}
        </Panel>
    );
};

const Branding = () => {
    const { db, org, setOrg, toast, setBrand } = useApp();
    const [f, setF] = useState({ name: org!.name, tagline: org!.tagline, description: org!.description, color: org!.color, font: org!.font, variant: org!.variant, impact_unit: org!.impact_unit, impact_usd: org!.impact_usd ? String(org!.impact_usd) : "", logo_url: org!.logo_url, country: org!.country, registration_number: org!.registration_number, website: org!.website, currency: org!.currency });
    const [busy, setBusy] = useState(false);
    const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));
    const save = async () => { setBusy(true); try { const o = await db.rpc<Org>("org_update", { org: org!.id, p: { ...f, impact_usd: f.impact_usd || null } }); setOrg(o); setBrand(null as never); toast("Saved"); } catch (e) { toast((e as Error).message); } finally { setBusy(false); } };
    const logo = async (file?: File) => { if (!file) return; try { const url = await db.upload(file, `logos/${org!.id}/${Date.now()}-${file.name}`); set("logo_url")(url); } catch (e) { toast((e as Error).message); } };
    return (
        <Panel title="Branding" sub="Your name, colour and font recolour every screen: the board, pages, the live screen, receipts.">
            <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Organisation name" value={f.name} onChange={set("name")} /><Input label="Tagline" value={f.tagline} onChange={set("tagline")} />
                <label className="flex flex-col gap-1.5 text-sm font-medium text-secondary">Brand colour<span className="flex h-10 items-center gap-3 rounded-lg px-3 ring-1 ring-primary ring-inset"><input type="color" aria-label="Brand colour" value={f.color} onChange={(e) => set("color")(e.target.value)} className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0" /><span className="font-mono text-sm text-tertiary uppercase">{f.color}</span></span></label>
                <NativeSelect label="Font" value={f.font} onChange={(e) => set("font")(e.target.value)} options={FONTS.map((x) => ({ label: x, value: x }))} />
                <NativeSelect label="Board layout" value={f.variant} onChange={(e) => set("variant")(e.target.value)} options={ALL_VARIANTS.map(([v, l]) => ({ label: l, value: v }))} />
                <NativeSelect label="Currency" value={f.currency} onChange={(e) => set("currency")(e.target.value)} options={Object.keys(CURRENCIES).map((c) => ({ label: c, value: c }))} />
                <Input label="What gifts buy (plural)" value={f.impact_unit} onChange={set("impact_unit")} placeholder="boreholes" /><Input label="Cost of one (USD)" type="number" value={f.impact_usd} onChange={set("impact_usd")} />
                <Input label="Country" value={f.country} onChange={set("country")} /><Input label="Registration number" value={f.registration_number} onChange={set("registration_number")} hint="Shown on pages and receipts" />
                <Input label="Website" value={f.website} onChange={set("website")} />
                <label className="flex flex-col gap-1.5 text-sm font-medium text-secondary">Logo<span className="flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-tertiary ring-1 ring-primary ring-inset hover:bg-secondary">{f.logo_url ? <img src={f.logo_url} alt="" className="size-6 rounded object-cover" /> : <Upload01 className="size-4" />}{f.logo_url ? "Replace logo" : "Upload logo"}<input type="file" accept="image/*" className="sr-only" onChange={(e) => logo(e.target.files?.[0])} /></span></label>
            </div>
            <TextArea label="About" rows={3} value={f.description} onChange={set("description")} />
            <Button size="lg" color="primary" className="w-fit rounded-full" isDisabled={busy || !f.name.trim()} onPress={save}>{busy ? "Saving…" : "Save branding"}</Button>
        </Panel>
    );
};

const Payments = () => {
    const { db, org, setOrg, toast, isDemo, href } = useApp();
    const [country, setCountry] = useState("GB");
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState<{ connected: boolean; charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean; requirements?: string[] } | null>(null);
    const call = async (action: "onboard" | "status" | "dashboard") => {
        setBusy(true);
        try {
            const r = await db.fn<{ url?: string; connected?: boolean; charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean; requirements?: string[]; demo?: boolean }>("connect", { org_id: org!.id, action, country, return_to: href({ name: "admin", tab: "payments" }), origin: window.location.origin });
            if (r.url) { window.location.assign(r.url); return; }
            if (action === "status") { setStatus(r as typeof status); const o = (await db.rpc<Org[]>("org_by_slug", { s: org!.slug }))[0]; if (o) setOrg(o); }
            if (r.demo) { const o = (await db.rpc<Org[]>("org_by_slug", { s: org!.slug }))[0]; if (o) setOrg(o); toast("Demo: Stripe marked as connected"); }
        } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };
    useEffect(() => { if (org?.stripe_account_id && !isDemo) call("status"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const tips = org!.tips_enabled;
    return (
        <>
            <Panel title="Stripe" sub="Gifts are paid straight into your own Stripe account. Stripe verifies your organisation and pays out to your bank.">
                <div className="flex flex-wrap items-center gap-3">
                    <Badge type="pill-color" color={org!.stripe_charges_enabled ? "success" : "warning"} size="md">{org!.stripe_charges_enabled ? "Taking payments" : org!.stripe_account_id ? "Onboarding not finished" : "Not connected"}</Badge>
                    {org!.stripe_account_id && <Badge type="pill-color" color={org!.stripe_payouts_enabled ? "success" : "gray"} size="md">{org!.stripe_payouts_enabled ? "Payouts enabled" : "Payouts pending"}</Badge>}
                </div>
                {!org!.stripe_account_id && <div className="grid gap-3 sm:grid-cols-[10rem_auto] sm:items-end"><Input label="Country (ISO code)" value={country} onChange={(v) => setCountry(v.toUpperCase().slice(0, 2))} hint="Where the organisation is registered" /><Button size="lg" color="primary" className="rounded-full" isDisabled={busy} onPress={() => call("onboard")}>{isDemo ? "Connect Stripe (demo)" : "Connect with Stripe"}</Button></div>}
                {org!.stripe_account_id && <div className="flex flex-wrap gap-2">{!org!.stripe_charges_enabled && <Button size="md" color="primary" className="rounded-full" isDisabled={busy} onPress={() => call("onboard")}>Continue onboarding</Button>}<Button size="md" color="secondary" className="rounded-full" iconLeading={RefreshCw01} isDisabled={busy || isDemo} onPress={() => call("status")}>Refresh status</Button><Button size="md" color="secondary" className="rounded-full" iconLeading={LinkExternal01} isDisabled={busy || isDemo} onPress={() => call("dashboard")}>Open Stripe dashboard</Button></div>}
                {status?.requirements && status.requirements.length > 0 && <p className="text-sm text-warning-primary">Stripe still needs: {status.requirements.join(", ")}</p>}
                <p className="text-xs text-tertiary">Refunds and disputes are handled in your Stripe dashboard; the board updates by itself. Receipts are emailed by Outgive when a gift clears.</p>
            </Panel>
            <Panel title="Fees" sub="How Outgive is paid for.">
                <label className="flex items-center justify-between gap-4 rounded-xl bg-secondary px-4 py-3"><span><span className="block text-sm font-bold text-primary">Let donors add a tip to Outgive</span><span className="block text-[13px] text-tertiary">On: 0% platform fee; donors see an optional tip at checkout. Off: a {org!.platform_fee_bps / 100 || 3}% platform fee is taken from each gift.</span></span><Toggle aria-label="Tips" isSelected={tips} onChange={async (v) => { const o = await db.rpc<Org>("org_update", { org: org!.id, p: { tips_enabled: v } }); setOrg(o); }} /></label>
                <p className="text-xs text-tertiary">Platform fee when tips are off: {org!.platform_fee_bps / 100}% (set by Outgive). Stripe's card processing fee is paid from your Stripe balance, unless the donor covers it.</p>
            </Panel>
        </>
    );
};

const Domain = () => {
    const { db, org, setOrg, toast, href } = useApp();
    const [domain, setDomain] = useState(org!.custom_domain ?? "");
    const [qr, setQr] = useState("");
    const boardUrl = `${window.location.origin}${href({ name: "home" })}`;
    useEffect(() => { QRCode.toDataURL(boardUrl, { width: 480, margin: 2 }).then(setQr).catch(() => setQr("")); }, [boardUrl]);
    const embed = `<iframe src="${window.location.origin}${href({ name: "embed", org: org!.slug })}" width="360" height="420" style="border:0;border-radius:16px" title="${org!.name} leaderboard"></iframe>`;
    return (
        <>
            <Panel title="Your own domain" sub={`Your board is at ${org!.slug}.outgive.org and outgive.org/o/${org!.slug}. Add your own domain to replace both.`}>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><Input label="Domain" value={domain} onChange={(v) => setDomain(v.toLowerCase().trim())} placeholder="give.yourcharity.org" /><Button size="lg" color="primary" className="rounded-full" onPress={async () => { try { const o = await db.rpc<Org>("org_update", { org: org!.id, p: { custom_domain: domain } }); setOrg(o); toast(domain ? "Domain saved" : "Domain removed"); } catch (e) { toast((e as Error).message.includes("unique") ? "That domain is already in use" : (e as Error).message); } }}>Save</Button></div>
                <ol className="list-decimal pl-5 text-sm text-tertiary"><li>Add a CNAME record for <b className="text-primary">{domain || "give.yourcharity.org"}</b> pointing to <b className="text-primary">cname.vercel-dns.com</b>.</li><li>Email <b className="text-primary">hello@outgive.org</b> with the domain so it is added to the platform. Certificates are issued automatically.</li></ol>
                <label className="flex items-center justify-between gap-4 rounded-xl bg-secondary px-4 py-3"><span><span className="block text-sm font-bold text-primary">Remove "by Outgive"</span><span className="block text-[13px] text-tertiary">Hides the Outgive line on your board, pages and live screen.</span></span><Toggle aria-label="Remove branding" isSelected={org!.remove_branding} onChange={async (v) => { const o = await db.rpc<Org>("org_update", { org: org!.id, p: { remove_branding: v } }); setOrg(o); }} /></label>
            </Panel>
            <Panel title="Embed the board on your website">
                <pre className="overflow-x-auto rounded-xl bg-secondary p-3 text-xs text-secondary">{embed}</pre>
                <Button size="sm" color="secondary" className="w-fit rounded-full" iconLeading={Copy01} onPress={() => { navigator.clipboard?.writeText(embed); toast("Embed code copied"); }}>Copy embed code</Button>
                <p className="text-xs text-tertiary">Add <code>?limit=10</code> for more rows or <code>?theme=dark</code> for a dark widget. Each page has its own embed under Manage → Share.</p>
            </Panel>
            <Panel title="QR code to the board"><div className="flex flex-wrap items-center gap-5">{qr && <img src={qr} alt="QR code" className="size-36 rounded-xl bg-white p-1.5 ring-1 ring-secondary" />}<div className="flex flex-col gap-2"><p className="text-sm text-tertiary">{boardUrl}</p>{qr && <a href={qr} download={`${org!.slug}-board-qr.png`} className="w-fit rounded-full bg-secondary px-3.5 py-2 text-sm font-semibold text-secondary ring-1 ring-primary ring-inset hover:bg-tertiary">Download PNG</a>}</div></div></Panel>
        </>
    );
};

const Members = () => {
    const { db, org, user, toast } = useApp();
    const [rows, setRows] = useState<Member[]>([]);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("admin");
    const load = () => db.rpc<Member[]>("org_members_list", { org: org!.id }).then(setRows);
    useEffect(() => { load(); }, [db, org]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <Panel title="Team" sub="Members see every gift and can edit every page, branding and the live screen. They must have signed in to Outgive once before they can be added.">
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"><Input label="Email" value={email} onChange={setEmail} /><NativeSelect label="Role" value={role} onChange={(e) => setRole(e.target.value)} options={[{ label: "Admin", value: "admin" }, { label: "Editor", value: "editor" }]} /><Button size="lg" color="primary" className="rounded-full" isDisabled={!email.includes("@")} onPress={async () => { const ok = await db.rpc<boolean>("member_add", { org: org!.id, member_email: email.trim(), member_role: role }); toast(ok ? "Added" : "No Outgive account with that email yet. Ask them to sign in first."); if (ok) { setEmail(""); load(); } }}>Add</Button></div>
            <ul className="flex flex-col">{rows.map((m) => <li key={m.user_id} className="flex items-center gap-3 border-t border-secondary py-3 text-sm"><span className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary">{initials(m.name || m.email)}</span><span className="min-w-0 flex-1"><span className="block font-semibold text-primary">{m.name || m.email}</span><span className="text-xs text-tertiary">{m.email}</span></span><Badge type="pill-color" color="gray" size="sm">{m.role}</Badge>{m.role !== "owner" && m.user_id !== user?.id && <Button size="sm" color="link-gray" onPress={async () => { await db.rpc("member_remove", { org: org!.id, member: m.user_id }); load(); }}>Remove</Button>}</li>)}</ul>
        </Panel>
    );
};
export const AdminMark = BrandMark;
