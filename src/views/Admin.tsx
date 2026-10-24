import { useEffect, useState } from "react";
import { Announcement01, BankNote01, CoinsStacked01, CreditCard01, Download01, Gift01, Globe01, Heart, LinkExternal01, Palette, Plus, PresentationChart01, RefreshCw01, Repeat01, Tv01, Upload01, Users01, UsersPlus, Zap } from "@untitledui/icons";
import QRCode from "qrcode";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
import { TextArea } from "@/components/base/textarea/textarea";
import { Toggle } from "@/components/base/toggle/toggle";
import { BrandMark, ConsoleShell, Container, CopyRow, Empty, Fieldset, LiveConsole, Panel, Stat, Who, ago, useApp } from "@/components/outgive/shared";
import { CURRENCIES, FONTS, PREFIX } from "@/data";
import { fmt } from "@/lib/money";
import type { DonationRow, LiveState, MatchPledge, Member, Org, OrgStats, PageRow } from "@/lib/types";
import { ALL_VARIANTS } from "@/views/boards";
import { SignIn } from "@/views/Login";
import { cx } from "@/utils/cx";

const TABS: [string, string, typeof Heart][] = [["overview", "Overview", PresentationChart01], ["donations", "Donations", Heart], ["pages", "Pages", Announcement01], ["live", "Live screen", Tv01], ["pledges", "Matching", Repeat01], ["branding", "Branding", Palette], ["payments", "Payments", CreditCard01], ["domain", "Domain & embeds", Globe01], ["members", "Team", Users01]];
const csv = (rows: Record<string, unknown>[]) => { if (!rows.length) return ""; const keys = Object.keys(rows[0]); const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`; return [keys.join(","), ...rows.map((r) => keys.map((k) => q(r[k])).join(","))].join("\n"); };
const download = (name: string, text: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
const status = (s: string) => (s === "succeeded" ? "success" : s === "pending" ? "warning" : s === "live" ? "success" : s === "draft" ? "warning" : s === "refunded" || s === "disputed" || s === "failed" ? "error" : "gray") as "success" | "warning" | "error" | "gray";

/** The organiser's dashboard: money, gifts, pages, the live console, matching, brand, Stripe, domain and the team. */
export const Admin = ({ tab = "overview" }: { tab?: string }) => {
    const { db, org, user, member, go, href, isDemo } = useApp();
    // App resolves membership asynchronously; until it has, show nothing rather than flash "Members only".
    const [known, setKnown] = useState<boolean | null>(member ? true : null);
    useEffect(() => { if (member) { setKnown(true); return; } if (!org || !user) return; let live = true; db.rpc<boolean>("is_member", { org: org.id }).then((v) => { if (live) setKnown(v); }).catch(() => { if (live) setKnown(false); }); return () => { live = false; }; }, [db, org, user, member]);
    if (!org) return null;
    if (user && known === null) return <div className="min-h-dvh bg-secondary" />;
    if (!user) return <div className="min-h-dvh bg-primary"><Container className="max-w-md py-10"><div className="rounded-3xl p-6 ring-1 ring-secondary ring-inset"><SignIn title={`${org.name} dashboard`} sub="Sign in as a member of the organisation." /></div></Container></div>;
    if (!member && !known) return <div className="min-h-dvh bg-primary"><Container className="max-w-md py-10 text-center"><h1 className="text-display-xs font-semibold text-primary">Members only</h1><p className="mt-2 text-tertiary">Your account is not on {org.name}'s team. Ask an organiser to add {user.email}.</p><Button color="secondary" className="mt-4 rounded-full" onPress={() => go({ name: "home" })}>Back to the board</Button></Container></div>;
    const current = TABS.some(([k]) => k === tab) ? tab : "overview";
    return (
        <ConsoleShell nav={TABS} current={current} onNav={(k) => go({ name: "admin", org: org.slug, tab: k })}
            badges={<><Badge type="pill-color" color="gray" size="sm">Organiser</Badge>{isDemo && <Badge type="pill-color" color="warning" size="sm">Demo</Badge>}</>}
            actions={<><Button size="sm" color="secondary" className="rounded-full" iconLeading={Tv01} onPress={() => window.open(`${window.location.origin}${href({ name: "live" })}`, "_blank")}><span className="max-sm:hidden">Live screen</span></Button><Button size="sm" color="primary" className="rounded-full" iconLeading={Plus} onPress={() => go({ name: "create" })}>New campaign</Button></>}>
            {!org.stripe_charges_enabled && current !== "payments" && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-primary px-4 py-3 text-sm text-warning-primary ring-1 ring-warning-secondary ring-inset"><span className="flex items-center gap-2"><CreditCard01 className="size-4 shrink-0" /><span><b>Payments are not connected.</b> Pages are visible but cannot take gifts until Stripe onboarding is complete.</span></span><Button size="sm" color="primary" className="rounded-full" onPress={() => go({ name: "admin", org: org.slug, tab: "payments" })}>Connect Stripe</Button></div>}
            {current === "overview" && <Overview />}
            {current === "donations" && <Donations />}
            {current === "pages" && <Pages />}
            {current === "live" && <OrgLive />}
            {current === "pledges" && <Pledges />}
            {current === "branding" && <Branding />}
            {current === "payments" && <Payments />}
            {current === "domain" && <Domain />}
            {current === "members" && <Members />}
        </ConsoleShell>
    );
};

const Overview = () => {
    const { db, org, money, go, brand } = useApp();
    const [s, setS] = useState<OrgStats | null>(null);
    useEffect(() => { db.rpc<OrgStats>("org_stats", { org: org!.id }).then(setS); }, [db, org]);
    if (!s) return <p className="text-sm text-tertiary">Loading…</p>;
    const days = s.by_day; const max = Math.max(1, ...days.map((d) => Number(d.usd_cents)));
    const week = days.slice(-7).reduce((n, d) => n + Number(d.usd_cents), 0) / 100;
    const raised = Number(s.raised_cents) / 100;
    const units = brand.impact && brand.impact.usd > 0 ? Math.floor(raised / brand.impact.usd) : 0;
    return (
        <>
            <section className="relative overflow-hidden rounded-3xl p-6 text-white shadow-md md:p-8" style={{ background: "linear-gradient(135deg, var(--color-brand-600) 0%, var(--color-brand-800) 100%)" }}>
                <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex flex-wrap items-end justify-between gap-6">
                    <div className="flex items-center gap-4"><BrandMark className="size-14 rounded-2xl text-xl ring-4 ring-white/20" /><div><div className="text-sm font-medium text-white/75">{org!.name}</div><div className="text-[clamp(2rem,5vw,3rem)] leading-none font-semibold tracking-tight tabular-nums">{money(raised)}</div><div className="mt-1.5 text-sm text-white/80">raised all-time{units > 0 && brand.impact && <> · enough for <b className="text-white">{units.toLocaleString("en")} {brand.impact.unit}</b></>}</div></div></div>
                    <div className="flex flex-wrap gap-2"><Button size="md" color="secondary" className="rounded-full" iconLeading={Tv01} onPress={() => go({ name: "admin", org: org!.slug, tab: "live" })}>Live screen</Button><Button size="md" color="secondary" className="rounded-full" iconLeading={Heart} onPress={() => go({ name: "admin", org: org!.slug, tab: "donations" })}>Record a gift</Button></div>
                </div>
            </section>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat icon={CoinsStacked01} label="Last 7 days" value={money(week)} trend={week > 0 ? "gifts in the last week" : "no gifts this week"} tone="brand" />
                <Stat icon={Gift01} label="Gifts" value={String(s.donations)} trend={`${s.donors} ${s.donors === 1 ? "donor" : "donors"}`} />
                <Stat icon={Repeat01} label="Monthly gifts" value={String(s.recurring)} trend="running subscriptions" />
                <Stat icon={Announcement01} label="Live pages" value={String(s.pages)} trend={Number(s.refunded_cents) ? `${money(Number(s.refunded_cents) / 100)} refunded` : "nothing refunded"} />
            </div>
            <Panel title="Last 30 days" sub="Gifts per day in USD.">
                {days.length === 0 ? <Empty icon={Heart} title="No gifts in the last 30 days" sub="Record an offline gift, or share your board and pages." action={<Button size="sm" color="primary" className="rounded-full" onPress={() => go({ name: "admin", org: org!.slug, tab: "donations" })}>Record a gift</Button>} /> : (
                    <div className="flex h-44 items-stretch gap-1 md:gap-1.5">{days.map((d, i) => <div key={d.day} title={`${d.day}: ${money(Number(d.usd_cents) / 100)}`} className="group relative flex h-full flex-1 flex-col justify-end"><div className={cx("rounded-t-md transition group-hover:opacity-80", i === days.length - 1 ? "bg-brand-solid" : "bg-brand-400")} style={{ height: `${Math.max(3, (Number(d.usd_cents) / max) * 100)}%` }} /></div>)}</div>
                )}
                {days.length > 0 && <div className="flex justify-between text-xs text-tertiary"><span>{days[0].day}</span><span>{days[days.length - 1].day}</span></div>}
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
    const exportCsv = () => download(`${org!.slug}-donations.csv`, csv(rows.map((d) => ({ date: d.created_at, name: d.donor_name, email: d.donor_email ?? "", amount: d.amount_cents / 100, currency: d.currency, tip: d.tip_cents / 100, cover: d.cover_cents / 100, status: d.status, source: d.source, recurring: d.recurring, message: d.message, dedication: d.dedication, cause: d.cause ?? "", page_id: d.page_id ?? "", id: d.id }))));
    const total = rows.filter((d) => d.status === "succeeded").reduce((n, d) => n + d.usd_cents, 0);
    return (
        <>
            <Panel title="Record a gift" sub="Cash, cheques, bank transfers and pledges from the room. They count on the board and the live screen at once." action={<Button size="md" color="primary" className="rounded-full" iconLeading={Plus} isDisabled={!(Number(f.amount) > 0)} onPress={record}>Record gift</Button>}>
                <Fieldset title="Donor" sub="Email only if they want a receipt."><Input label="Name" value={f.donor_name} onChange={(v) => setF({ ...f, donor_name: v })} placeholder="Amara Okafor" /><Input label="Email" type="email" value={f.donor_email} onChange={(v) => setF({ ...f, donor_email: v })} placeholder="optional" /></Fieldset>
                <Fieldset title="Gift" sub="Pledges count on the board like gifts."><Input label={`Amount (${org!.currency})`} type="number" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /><NativeSelect label="Kind" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} options={[{ label: "Offline gift", value: "offline" }, { label: "Pledge", value: "pledge" }]} /><NativeSelect label="On the board as" value={f.supporter_kind} onChange={(e) => setF({ ...f, supporter_kind: e.target.value })} options={["Individuals", "Teams", "Companies", "Schools"].map((k) => ({ label: k, value: k }))} /><Input label="Message" value={f.message} onChange={(v) => setF({ ...f, message: v })} placeholder="optional" /></Fieldset>
            </Panel>
            <Panel title={<>All gifts <span className="ml-1 text-tertiary">· {rows.length}</span></>} sub={rows.length ? `${fmt(total, "USD")} received in total.` : undefined} action={<Button size="sm" color="secondary" className="rounded-full" iconLeading={Download01} onPress={exportCsv} isDisabled={!rows.length}>Export CSV</Button>}>
                {rows.length === 0 ? <Empty icon={Heart} title="No gifts yet" sub="Gifts from pages, the board and the live screen appear here as they clear." /> : (
                    <div className="-mx-5 overflow-x-auto px-5 md:-mx-6 md:px-6"><table className="w-full min-w-[46rem] text-left text-sm"><thead className="text-xs text-tertiary"><tr><th className="pb-2 font-semibold">Donor</th><th className="pb-2 font-semibold">Amount</th><th className="pb-2 font-semibold">Tip</th><th className="pb-2 font-semibold">Status</th><th className="pb-2 font-semibold">When</th><th className="pb-2 font-semibold"> </th></tr></thead>
                        <tbody>{rows.map((d) => <tr key={d.id} className="border-t border-secondary"><td className="py-2.5 pr-3"><div className="flex items-center gap-3"><Who name={d.donor_name} /><div className="min-w-0"><div className="truncate font-semibold text-primary">{d.donor_name}{d.anonymous && <span className="ml-1 text-xs font-normal text-tertiary">(anonymous)</span>}</div><div className="truncate text-xs text-tertiary">{[d.donor_email, d.cause, d.message].filter(Boolean).join(" · ") || (d.recurring ? "monthly" : "one-off")}</div></div></div></td><td className="py-2.5 pr-3 font-semibold text-primary tabular-nums">{fmt(d.amount_cents, d.currency)}{d.recurring && <span className="ml-1 text-xs font-normal text-tertiary">/mo</span>}</td><td className="py-2.5 pr-3 text-tertiary tabular-nums">{d.tip_cents ? fmt(d.tip_cents, d.currency) : "–"}</td><td className="py-2.5 pr-3"><Badge type="pill-color" color={status(d.status)} size="sm">{d.status}</Badge><span className="ml-2 text-xs text-tertiary">{d.source}</span></td><td className="py-2.5 pr-3 whitespace-nowrap text-tertiary">{ago(new Date(d.created_at).getTime())}</td><td className="py-2.5 text-right">{d.status === "succeeded" && d.source !== "card" && <Button size="sm" color="link-gray" onPress={async () => { await db.rpc("donation_set_status", { d: d.id, s: "refunded" }); load(); }}>Remove</Button>}{d.status === "succeeded" && d.source === "card" && <span className="text-xs text-tertiary">Refund in Stripe</span>}</td></tr>)}</tbody></table></div>
                )}
            </Panel>
        </>
    );
};

const Pages = () => {
    const { db, org, go } = useApp();
    const [rows, setRows] = useState<PageRow[]>([]);
    useEffect(() => { db.rpc<PageRow[]>("pages_list", { org: org!.id }).then(setRows); }, [db, org]);
    return (
        <Panel title={<>Pages <span className="ml-1 text-tertiary">· {rows.length}</span></>} sub="Campaigns you run, and the fundraiser, team, challenge, event and in-memory pages supporters have made." action={<Button size="sm" color="primary" className="rounded-full" iconLeading={Plus} onPress={() => go({ name: "create" })}>New campaign</Button>}>
            {rows.length === 0 ? <Empty icon={Announcement01} title="No pages yet" sub="A campaign page gives supporters something to rally around, and their own pages roll up into it." action={<Button size="sm" color="primary" className="rounded-full" onPress={() => go({ name: "create" })}>Create a campaign</Button>} /> : (
                <ul className="flex flex-col divide-y divide-secondary">{rows.map((p) => { const pct = p.goal_cents ? Math.min(100, Math.round((p.raised_cents / p.goal_cents) * 100)) : 0; return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <Who name={p.title} className="size-10 rounded-xl" />
                        <span className="min-w-0 flex-1 basis-48"><button type="button" onClick={() => go({ name: "page", org: org!.slug, page: { type: p.type, slug: p.slug } })} className="block cursor-pointer truncate text-left font-semibold text-primary hover:underline">{p.title}</button><span className="text-xs text-tertiary">{p.type} · /{PREFIX[p.type]}/{p.slug}{p.parent_id && " · nested"}</span></span>
                        <span className="hidden w-36 flex-col gap-1 md:flex"><span className="h-1.5 overflow-hidden rounded-full bg-tertiary"><span className="block h-full rounded-full bg-brand-solid" style={{ width: `${pct}%` }} /></span><span className="text-xs text-tertiary tabular-nums">{fmt(p.raised_cents, p.currency)} · {p.donor_count} gifts{p.goal_cents ? ` · ${pct}%` : ""}</span></span>
                        <Badge type="pill-color" color={status(p.status)} size="sm">{p.status}</Badge>
                        <Button size="sm" color="secondary" className="rounded-full" onPress={() => go({ name: "page", org: org!.slug, page: { type: p.type, slug: p.slug }, sub: "manage" })}>Manage</Button>
                    </li>
                ); })}</ul>
            )}
        </Panel>
    );
};

/** The organisation-wide presenter console, plus links to each campaign's own screens. */
const OrgLive = () => {
    const { db, org, setOrg, href } = useApp();
    const live: LiveState = org!.live ?? {};
    const [pages, setPages] = useState<PageRow[]>([]);
    useEffect(() => { db.rpc<PageRow[]>("pages_list", { org: org!.id }).then(setPages); }, [db, org]);
    const push = async (patch: LiveState) => { const o = await db.rpc<Org>("org_update", { org: org!.id, p: { live: { ...live, ...patch } } }); setOrg(o); };
    const abs = (p: string) => `${window.location.origin}${p}`;
    const campaigns = pages.filter((p) => p.type === "campaign");
    return (
        <>
            <LiveConsole key={org!.id} live={live} push={push} scope={org!.name} liveUrl={abs(href({ name: "live" }))} overlayUrl={abs(href({ name: "overlay" }))} giveUrl={abs(href({ name: "give", org: org!.slug }))} />
            {campaigns.length > 0 && <Panel title="Campaign screens" sub="Each campaign has its own live screen, overlay and give page, configured from the campaign's Manage → Live screen tab.">
                <ul className="flex flex-col divide-y divide-secondary">{campaigns.map((p) => { const ref = { type: p.type, slug: p.slug }; return <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"><Who name={p.title} className="rounded-xl" /><span className="min-w-0 flex-1 truncate font-semibold text-primary">{p.title}</span><Button size="sm" color="secondary" className="rounded-full" iconLeading={Tv01} onPress={() => window.open(abs(href({ name: "live", org: org!.slug, page: ref })), "_blank")}>Live</Button><Button size="sm" color="secondary" className="rounded-full" iconLeading={LinkExternal01} onPress={() => window.open(abs(href({ name: "give", org: org!.slug, page: ref })), "_blank")}>Give page</Button></li>; })}</ul>
            </Panel>}
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
        <>
            <Panel title="Add a matching pledge" sub="A company or donor matches every gift until their cap is reached. Each match is added as its own gift, so the board and the live screen show it at once.">
                <div className="grid gap-3 sm:grid-cols-[1fr_9rem_7rem_auto] sm:items-end"><Input label="Sponsor" value={f.sponsor_name} onChange={(v) => setF({ ...f, sponsor_name: v })} placeholder="Bluefin Logistics" /><Input label={`Cap (${org!.currency})`} type="number" value={f.cap} onChange={(v) => setF({ ...f, cap: v })} /><Input label="Ratio" type="number" value={f.ratio} onChange={(v) => setF({ ...f, ratio: v })} hint="1 = pound for pound" /><Button size="md" color="primary" className="rounded-full sm:mb-6" isDisabled={!f.sponsor_name.trim() || !(Number(f.cap) > 0)} onPress={async () => { await db.rpc("match_pledge_set", { org: org!.id, p: { sponsor_name: f.sponsor_name.trim(), cap_cents: Math.round(Number(f.cap) * 100), ratio: Number(f.ratio) || 1 } }); setF({ sponsor_name: "", cap: "", ratio: "1" }); toast("Pledge added"); load(); refresh(); }}>Add pledge</Button></div>
            </Panel>
            <Panel title={<>Pledges <span className="ml-1 text-tertiary">· {rows.length}</span></>}>
                {rows.length === 0 ? <Empty icon={Repeat01} title="No pledges yet" sub="Matching is the single biggest lift to a giving night: gifts double on the screen as they land." /> : (
                    <ul className="flex flex-col divide-y divide-secondary">{rows.map((m) => { const pct = Math.min(100, (m.matched_cents / m.cap_cents) * 100); return <li key={m.id} className="flex flex-wrap items-center gap-4 py-3 first:pt-0 last:pb-0 text-sm"><Who name={m.sponsor_name} className="rounded-xl" /><span className="min-w-0 flex-1 basis-40"><span className="block font-semibold text-primary">{m.sponsor_name}</span><span className="text-xs text-tertiary">{m.ratio}× up to {fmt(m.cap_cents, org!.currency)}</span></span><span className="flex w-48 flex-col gap-1"><span className="h-2 overflow-hidden rounded-full bg-tertiary"><span className="block h-full rounded-full bg-brand-solid" style={{ width: `${pct}%` }} /></span><span className="text-xs text-tertiary tabular-nums">{fmt(m.matched_cents, org!.currency)} matched · {Math.round(pct)}%</span></span><label className="flex items-center gap-2 text-secondary"><Toggle aria-label="Active" isSelected={m.active} onChange={async (v) => { await db.rpc("match_pledge_set", { org: org!.id, p: { id: m.id, active: v } }); load(); }} />Active</label></li>; })}</ul>
                )}
            </Panel>
        </>
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
        <Panel title="Branding" sub="Your name, colour and font recolour every screen: the board, pages, the live screen, receipts." action={<Button size="md" color="primary" className="rounded-full" isDisabled={busy || !f.name.trim()} onPress={save}>{busy ? "Saving…" : "Save branding"}</Button>}>
            <Fieldset title="Identity" sub="How you appear everywhere.">
                <Input label="Organisation name" value={f.name} onChange={set("name")} /><Input label="Tagline" value={f.tagline} onChange={set("tagline")} />
                <label className="flex flex-col gap-1.5 text-sm font-medium text-secondary sm:col-span-2">Logo<span className="flex items-center gap-3 rounded-2xl bg-secondary p-3 ring-1 ring-secondary ring-inset">{f.logo_url ? <img src={f.logo_url} alt="" className="size-12 rounded-xl object-cover" /> : <span className="flex size-12 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: f.color }}>{f.name.slice(0, 2).toUpperCase()}</span>}<span className="flex min-w-0 flex-1 flex-col"><span className="text-sm font-semibold text-primary">{f.logo_url ? "Replace logo" : "Upload a logo"}</span><span className="text-xs text-tertiary">Square PNG or SVG works best. Without one, your initials in your colour are used.</span></span><span className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-primary px-3.5 text-sm font-semibold text-secondary ring-1 ring-primary ring-inset hover:bg-tertiary"><Upload01 className="size-4" />Choose<input type="file" accept="image/*" className="sr-only" onChange={(e) => logo(e.target.files?.[0])} /></span></span></label>
                <TextArea label="About" rows={3} value={f.description} onChange={set("description")} className="sm:col-span-2" />
            </Fieldset>
            <Fieldset title="Look" sub="One colour becomes the whole palette, in light and dark mode.">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-secondary">Brand colour<span className="flex h-10 items-center gap-3 rounded-lg px-3 ring-1 ring-primary ring-inset"><input type="color" aria-label="Brand colour" value={f.color} onChange={(e) => set("color")(e.target.value)} className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0" /><span className="font-mono text-sm text-tertiary uppercase">{f.color}</span></span></label>
                <NativeSelect label="Font" value={f.font} onChange={(e) => set("font")(e.target.value)} options={FONTS.map((x) => ({ label: x, value: x }))} />
                <NativeSelect label="Board layout" value={f.variant} onChange={(e) => set("variant")(e.target.value)} options={ALL_VARIANTS.map(([v, l]) => ({ label: l, value: v }))} />
                <NativeSelect label="Currency" value={f.currency} onChange={(e) => set("currency")(e.target.value)} options={Object.keys(CURRENCIES).map((c) => ({ label: c, value: c }))} />
            </Fieldset>
            <Fieldset title="Impact" sub="Turns totals into things: “enough for 29 boreholes”.">
                <Input label="What gifts buy (plural)" value={f.impact_unit} onChange={set("impact_unit")} placeholder="boreholes" /><Input label="Cost of one (USD)" type="number" value={f.impact_usd} onChange={set("impact_usd")} />
            </Fieldset>
            <Fieldset title="Legal" sub="Shown on pages and receipts.">
                <Input label="Country" value={f.country} onChange={set("country")} /><Input label="Registration number" value={f.registration_number} onChange={set("registration_number")} /><Input label="Website" value={f.website} onChange={set("website")} className="sm:col-span-2" />
            </Fieldset>
        </Panel>
    );
};

const Payments = () => {
    const { db, org, setOrg, toast, isDemo, href } = useApp();
    const [country, setCountry] = useState("GB");
    const [busy, setBusy] = useState(false);
    const [st, setSt] = useState<{ connected: boolean; charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean; requirements?: string[] } | null>(null);
    const call = async (action: "onboard" | "status" | "dashboard") => {
        setBusy(true);
        try {
            const r = await db.fn<{ url?: string; connected?: boolean; charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean; requirements?: string[]; demo?: boolean }>("connect", { org_id: org!.id, action, country, return_to: href({ name: "admin", tab: "payments" }), origin: window.location.origin });
            if (r.url) { window.location.assign(r.url); return; }
            if (action === "status") { setSt(r as typeof st); const o = (await db.rpc<Org[]>("org_by_slug", { s: org!.slug }))[0]; if (o) setOrg(o); }
            if (r.demo) { const o = (await db.rpc<Org[]>("org_by_slug", { s: org!.slug }))[0]; if (o) setOrg(o); toast("Demo: Stripe marked as connected"); }
        } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };
    useEffect(() => { if (org?.stripe_account_id && !isDemo) call("status"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const on = org!.stripe_charges_enabled;
    return (
        <>
            <Panel>
                <div className="flex flex-wrap items-center gap-4">
                    <span className={cx("flex size-14 shrink-0 items-center justify-center rounded-2xl", on ? "bg-success-secondary text-success-primary" : "bg-warning-secondary text-warning-primary")}><CreditCard01 className="size-6" /></span>
                    <div className="min-w-0 flex-1"><div className="text-lg font-semibold text-primary">{on ? "Taking payments" : org!.stripe_account_id ? "Onboarding not finished" : "Stripe is not connected"}</div><p className="text-sm text-tertiary">Gifts are paid straight into your own Stripe account. Stripe verifies your organisation and pays out to your bank.</p></div>
                    <div className="flex flex-wrap gap-2"><Badge type="pill-color" color={on ? "success" : "warning"} size="md">{on ? "Charges on" : "Charges off"}</Badge>{org!.stripe_account_id && <Badge type="pill-color" color={org!.stripe_payouts_enabled ? "success" : "gray"} size="md">{org!.stripe_payouts_enabled ? "Payouts on" : "Payouts pending"}</Badge>}</div>
                </div>
                {!org!.stripe_account_id && <div className="grid gap-3 rounded-2xl bg-secondary p-4 sm:grid-cols-[10rem_auto] sm:items-end"><Input label="Country (ISO code)" value={country} onChange={(v) => setCountry(v.toUpperCase().slice(0, 2))} hint="Where the organisation is registered" /><Button size="lg" color="primary" className="rounded-full sm:mb-6" isDisabled={busy} onPress={() => call("onboard")}>{isDemo ? "Connect Stripe (demo)" : "Connect with Stripe"}</Button></div>}
                {org!.stripe_account_id && <div className="flex flex-wrap gap-2">{!on && <Button size="md" color="primary" className="rounded-full" isDisabled={busy} onPress={() => call("onboard")}>Continue onboarding</Button>}<Button size="md" color="secondary" className="rounded-full" iconLeading={RefreshCw01} isDisabled={busy || isDemo} onPress={() => call("status")}>Refresh status</Button><Button size="md" color="secondary" className="rounded-full" iconLeading={LinkExternal01} isDisabled={busy || isDemo} onPress={() => call("dashboard")}>Open Stripe dashboard</Button></div>}
                {st?.requirements && st.requirements.length > 0 && <p className="text-sm text-warning-primary">Stripe still needs: {st.requirements.join(", ")}</p>}
                <p className="text-xs text-tertiary">Refunds and disputes are handled in your Stripe dashboard; the board updates by itself. Receipts are emailed by Outgive when a gift clears.</p>
            </Panel>
            <Panel title="Fees" sub="How Outgive is paid for.">
                <label className="flex items-center justify-between gap-4 rounded-2xl bg-secondary px-4 py-3"><span className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-brand-secondary"><BankNote01 className="size-5" /></span><span><span className="block text-sm font-semibold text-primary">Let donors add a tip to Outgive</span><span className="block text-[13px] text-tertiary">On: 0% platform fee; donors see an optional tip at checkout. Off: a {org!.platform_fee_bps / 100 || 3}% platform fee is taken from each gift.</span></span></span><Toggle aria-label="Tips" isSelected={org!.tips_enabled} onChange={async (v) => { const o = await db.rpc<Org>("org_update", { org: org!.id, p: { tips_enabled: v } }); setOrg(o); }} /></label>
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
                <ol className="grid gap-2 sm:grid-cols-2">{[["Add a CNAME record", <>for <b className="text-primary">{domain || "give.yourcharity.org"}</b> pointing to <b className="text-primary">cname.vercel-dns.com</b>.</>], ["Tell us the domain", <>Email <b className="text-primary">hello@outgive.org</b> so it is added to the platform. Certificates are issued automatically.</>]].map(([t, d], i) => <li key={i} className="flex gap-3 rounded-2xl bg-secondary p-4 text-sm text-tertiary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-solid text-xs font-bold text-white">{i + 1}</span><span><span className="block font-semibold text-primary">{t}</span>{d}</span></li>)}</ol>
                <label className="flex items-center justify-between gap-4 rounded-2xl bg-secondary px-4 py-3"><span><span className="block text-sm font-semibold text-primary">Remove "by Outgive"</span><span className="block text-[13px] text-tertiary">Hides the Outgive line on your board, pages and live screen.</span></span><Toggle aria-label="Remove branding" isSelected={org!.remove_branding} onChange={async (v) => { const o = await db.rpc<Org>("org_update", { org: org!.id, p: { remove_branding: v } }); setOrg(o); }} /></label>
            </Panel>
            <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Embed the board" sub="Drop this into any website. ?limit=10 shows more rows; ?theme=dark for a dark widget.">
                    <pre className="rounded-2xl bg-secondary p-4 text-xs leading-relaxed break-all whitespace-pre-wrap text-secondary">{embed}</pre>
                    <Button size="sm" color="secondary" className="w-fit rounded-full" onPress={() => { navigator.clipboard?.writeText(embed); toast("Embed code copied"); }}>Copy embed code</Button>
                </Panel>
                <Panel title="Links and QR" sub="Print the QR on posters, table cards and programmes.">
                    <div className="flex items-center gap-4">{qr && <img src={qr} alt="QR code to the board" className="size-28 shrink-0 rounded-2xl bg-white p-1.5 ring-1 ring-secondary" />}<div className="flex min-w-0 flex-1 flex-col gap-2"><CopyRow label="Board" url={boardUrl} /><CopyRow label="Give page" url={`${window.location.origin}${href({ name: "give", org: org!.slug })}`} />{qr && <a href={qr} download={`${org!.slug}-board-qr.png`} className="text-xs font-semibold text-brand-secondary hover:underline">Download QR as PNG</a>}</div></div>
                </Panel>
            </div>
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
        <>
            <Panel title="Invite a team member" sub="Members see every gift and can edit every page, branding and the live screen. They must have signed in to Outgive once before they can be added.">
                <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"><Input label="Email" type="email" value={email} onChange={setEmail} placeholder="name@yourcharity.org" /><NativeSelect label="Role" value={role} onChange={(e) => setRole(e.target.value)} options={[{ label: "Admin", value: "admin" }, { label: "Editor", value: "editor" }]} /><Button size="lg" color="primary" className="rounded-full" iconLeading={UsersPlus} isDisabled={!email.includes("@")} onPress={async () => { const ok = await db.rpc<boolean>("member_add", { org: org!.id, member_email: email.trim(), member_role: role }); toast(ok ? "Added" : "No Outgive account with that email yet. Ask them to sign in first."); if (ok) { setEmail(""); load(); } }}>Add</Button></div>
            </Panel>
            <Panel title={<>Team <span className="ml-1 text-tertiary">· {rows.length}</span></>}>
                <ul className="flex flex-col divide-y divide-secondary">{rows.map((m) => <li key={m.user_id} className="flex items-center gap-3 py-3 text-sm first:pt-0 last:pb-0"><Who name={m.name || m.email} className="size-10" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-primary">{m.name || m.email}{m.user_id === user?.id && <span className="ml-1.5 text-xs font-normal text-tertiary">(you)</span>}</span><span className="block truncate text-xs text-tertiary">{m.email}</span></span><Badge type="pill-color" color={m.role === "owner" ? "brand" : "gray"} size="sm">{m.role}</Badge>{m.role !== "owner" && m.user_id !== user?.id && <Button size="sm" color="link-gray" onPress={async () => { await db.rpc("member_remove", { org: org!.id, member: m.user_id }); load(); }}>Remove</Button>}</li>)}</ul>
            </Panel>
        </>
    );
};
export const AdminMark = BrandMark;
