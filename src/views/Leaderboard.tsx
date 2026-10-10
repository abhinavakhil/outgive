import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Globe01, Minus, Plus } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
import { Container, FIELD, Logo, PillSelect, ThemeToggle, useApp } from "@/components/outgive/shared";
import { CAUSES, CURRENCIES, REGIONS, initials } from "@/data";
import { cx } from "@/utils/cx";

const ago = (m: number) => (m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`);
const opts = (xs: string[]) => xs.map((x) => ({ label: x, value: x }));

export const Leaderboard = () => {
    const { go, money, currency, setCurrency, orgs, setOrgs, activity, setActivity } = useApp();
    const [period, setPeriod] = useState<"total" | "today">("total");
    const [cause, setCause] = useState("All");
    const [region, setRegion] = useState("Worldwide");
    const [open, setOpen] = useState<number | null>(null);
    const [bump, setBump] = useState(1);
    const [heroName, setHeroName] = useState("");
    const [heroCause, setHeroCause] = useState("");
    const [claim, setClaim] = useState<{ usd: number; rank: number } | null>(null);
    const [form, setForm] = useState({ name: "", tagline: "", domain: "", country: "", cause: CAUSES[0], region: REGIONS[0], amount: "" });
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");

    useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 4000); return () => clearTimeout(id); }, [toast]);

    const rate = CURRENCIES[currency];
    const byTotal = useMemo(() => [...orgs].sort((a, b) => b.total - a.total), [orgs]);
    const ranked = useMemo(() => [...orgs].sort((a, b) => b[period] - a[period]).map((o, i) => ({ ...o, rank: i + 1 })), [orgs, period]);
    const shown = ranked.filter((o) => (cause === "All" || o.cause === cause) && (region === "Worldwide" || o.region === region));
    const todayTotal = money(orgs.reduce((n, o) => n + o.today, 0));
    const todayTop = useMemo(() => [...orgs].sort((a, b) => b.today - a.today).slice(0, 5), [orgs]);
    const heroUsd = byTotal[0].total + bump;
    const existing = orgs.find((o) => o.name.toLowerCase() === form.name.trim().toLowerCase());

    const openClaim = (usd: number, rank: number, name = "", causeName = "") => {
        setForm({ name, tagline: "", domain: "", country: "", cause: causeName || CAUSES[0], region: REGIONS[0], amount: String(Math.ceil(usd * rate)) });
        setError(""); setClaim({ usd, rank });
    };
    const submit = () => {
        if (!claim) return;
        const amount = Number(form.amount); const name = form.name.trim(); const usd = Math.round(amount / rate);
        if (!name) return setError("Enter the charity's name.");
        if (!(amount >= Math.ceil(claim.usd * rate))) return setError(`Rank #${claim.rank} needs at least ${money(claim.usd)}.`);
        if (existing && usd <= existing.total) return setError(`${existing.name} already stands at ${money(existing.total)}. Give more than that.`);
        setOrgs((prev) => existing
            ? prev.map((o) => (o.id === existing.id ? { ...o, total: usd, today: o.today + (usd - o.total) } : o))
            : [...prev, { id: Date.now(), name, tagline: form.tagline.trim() || "Newly listed", cause: form.cause, region: form.region, country: form.country.trim() || form.region, domain: form.domain.trim().replace(/^https?:\/\//, "") || "not added", total: usd, today: usd, clicks: 0, days: 0 }]);
        setActivity((a) => [{ who: name, usd, at: Date.now() }, ...a]);
        setClaim(null); setBump(1); setPeriod("total"); setCause("All"); setRegion("Worldwide"); setHeroName("");
        setToast(`${name} claimed its rank with ${money(usd)}`);
    };

    const pill = (on: boolean) => cx("shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold outline-focus-ring transition focus-visible:outline-2", on ? "bg-brand-solid text-white shadow-xs" : "text-tertiary hover:text-primary");
    return (
        <div className="flex min-h-dvh flex-col bg-primary">
            <Container className="flex flex-1 flex-col gap-4 py-5 lg:max-w-[1000px]">
                <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                    <div className="flex items-center gap-3"><Logo /><span className="hidden items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs text-tertiary ring-1 ring-secondary ring-inset sm:flex"><span className="size-1.5 rounded-full bg-success-solid" /><span className="font-semibold text-success-primary">{orgs.length} listed</span>· {todayTotal} given today</span></div>
                    <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium text-tertiary sm:gap-2">
                        {([["page", "Layouts"], ["about", "About"], ["rules", "Rules"]] as const).map(([n, l]) => <button key={n} type="button" onClick={() => go({ name: n })} className="cursor-pointer rounded-full px-2.5 py-1.5 outline-focus-ring transition hover:text-primary focus-visible:outline-2 max-sm:last:hidden">{l}</button>)}
                        <PillSelect label="Currency" size="sm" className="w-24" value={currency} onChange={setCurrency} options={Object.keys(CURRENCIES)} />
                        <ThemeToggle />
                        <Button color="primary" size="sm" className="rounded-full" onPress={() => go({ name: "create" })}>Start fundraising</Button>
                    </nav>
                </header>

                <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-secondary p-1.5 ring-1 ring-secondary ring-inset" role="group" aria-label="Cause">
                    {["All", ...CAUSES].map((c) => <button key={c} type="button" aria-pressed={cause === c} onClick={() => setCause(c)} className={pill(cause === c)}>{c}</button>)}
                </div>

                <section className="flex flex-col items-center gap-3 py-2">
                    <div role="group" aria-label="Period" className="flex gap-1 rounded-full bg-primary p-1 ring-1 ring-secondary ring-inset">
                        {([["total", "All-time"], ["today", "Today"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)} className={pill(period === k)}>{l}</button>)}
                    </div>
                    <h1 className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-display-sm font-semibold tracking-tight text-primary md:text-display-lg">
                        <span>Take #1 for</span>
                        <button type="button" aria-label="Lower amount" onClick={() => setBump((b) => Math.max(1, b - 100))} className="flex size-6 cursor-pointer items-center justify-center rounded-full bg-brand-secondary text-brand-secondary outline-focus-ring focus-visible:outline-2"><Minus className="size-3.5" /></button>
                        <span className="text-brand-secondary tabular-nums">{money(heroUsd)}</span>
                        <button type="button" aria-label="Raise amount" onClick={() => setBump((b) => (b === 1 ? 100 : b + 100))} className="flex size-6 cursor-pointer items-center justify-center rounded-full bg-brand-secondary text-brand-secondary outline-focus-ring focus-visible:outline-2"><Plus className="size-3.5" /></button>
                    </h1>
                    <form className="flex w-full max-w-3xl flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); openClaim(heroUsd, 1, heroName, heroCause); }}>
                        <label className="relative flex-1"><Globe01 aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-quaternary" /><input aria-label="Charity name or website" className={cx(FIELD, "w-full pl-10")} placeholder="Charity name or website" value={heroName} onChange={(e) => setHeroName(e.target.value)} /></label>
                        <PillSelect label="Cause" className="sm:w-52" value={heroCause} onChange={setHeroCause} options={CAUSES} placeholder="Choose a cause" />
                        <button type="submit" className="h-11 cursor-pointer rounded-full bg-brand-solid px-6 text-md font-semibold text-white shadow-xs outline-focus-ring transition hover:bg-brand-solid_hover focus-visible:outline-2 focus-visible:outline-offset-2">Claim rank</button>
                    </form>
                </section>

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_230px]">
                    <main className="flex min-w-0 flex-col gap-2">
                        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-tertiary">{period === "total" ? "All-time ranking" : "Today's ranking"} · {shown.length}</h2><PillSelect label="Region" size="sm" className="w-44" value={region} onChange={setRegion} options={["Worldwide", ...REGIONS]} /></div>
                        <ol className="flex flex-col gap-1.5">
                            {shown.length === 0 && <li className="rounded-2xl bg-secondary p-5 text-sm text-tertiary">No charities here yet. Be the first to list one for this cause and region.</li>}
                            {shown.map((o) => {
                                const top = o.rank <= 3; const totalRank = byTotal.findIndex((x) => x.id === o.id) + 1;
                                return (
                                    <li key={o.id} className={cx("shrink-0 px-4 py-3", o.rank === 1 ? "rounded-2xl bg-brand-secondary" : o.rank === 2 ? "rounded-2xl bg-brand-primary" : o.rank === 3 ? "rounded-2xl bg-brand-primary/60" : "border-b border-secondary")}>
                                        <div className="flex items-center gap-3.5">
                                            <span className={cx("w-8 text-md font-semibold tabular-nums", top ? "text-brand-secondary" : "text-tertiary")}>#{o.rank}</span>
                                            <Avatar size="md" initials={initials(o.name)} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-baseline justify-between gap-3"><span className="truncate text-md font-semibold text-primary">{o.name}</span><span className="shrink-0 text-md font-semibold text-brand-secondary tabular-nums">{money(o[period])}</span></div>
                                                <div className="truncate text-sm text-tertiary">{o.tagline}</div>
                                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-tertiary"><span className="font-semibold text-secondary">{o.cause}</span><span>·</span><span>{o.country}</span><span>·</span><span>{o.clicks.toLocaleString("en")} clicks</span><span>·</span>
                                                    <button type="button" aria-expanded={open === o.id} onClick={() => setOpen(open === o.id ? null : o.id)} className="cursor-pointer underline-offset-2 hover:text-primary hover:underline">{open === o.id ? "hide details" : "see details"}</button><span>·</span>
                                                    <button type="button" onClick={() => openClaim(o.total + 1, totalRank)} className="cursor-pointer font-semibold text-brand-secondary underline-offset-2 hover:underline">claim for {money(o.total + 1)}</button></div>
                                            </div>
                                        </div>
                                        {open === o.id && <p className="mt-2 ml-[3.25rem] max-w-prose text-sm text-tertiary">{o.name} works in {o.country} ({o.region}) on {o.cause.toLowerCase()}. All-time {money(o.total)}, today {money(o.today)}. Its listing links to {o.domain}, {o.days === 0 ? "and it was listed today" : `and it has been on the board for ${o.days} days`}.</p>}
                                    </li>
                                );
                            })}
                        </ol>
                    </main>

                    <aside className="flex min-w-0 flex-col gap-5">
                        <section className="flex flex-col gap-2.5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary"><span className="size-1.5 rounded-full bg-brand-solid" />Today's ranking</h2><button type="button" onClick={() => setPeriod("today")} className="cursor-pointer text-xs font-medium text-brand-secondary hover:underline">See all ›</button></div>
                            <ol className="flex flex-col gap-2 text-sm">{todayTop.map((o, i) => (<li key={o.id} className="flex items-center gap-2"><span className="w-5 text-xs font-semibold text-tertiary">#{i + 1}</span><Avatar size="xs" initials={initials(o.name)} /><span className="min-w-0 flex-1 truncate text-secondary">{o.name}</span><span className="text-xs font-semibold text-brand-secondary tabular-nums">{money(o.today)}</span></li>))}</ol>
                        </section>
                        <section className="flex flex-col gap-2.5"><h2 className="text-sm font-semibold text-primary">Latest activity</h2>
                            <ul className="flex flex-col gap-2 text-xs text-tertiary">{activity.slice(0, 4).map((a, i) => (<li key={i}><span className="font-semibold text-primary">{a.who}</span> claimed a rank with {money(a.usd)} · {ago(Math.round((Date.now() - a.at) / 60000))}</li>))}</ul>
                        </section>
                        <div className="flex flex-col items-start gap-2 rounded-2xl bg-brand-primary p-4">
                            <h2 className="text-sm font-semibold text-primary">Raising money yourself?</h2>
                            <p className="text-xs text-tertiary">Fundraiser, campaign, team, challenge or event, in 12 layouts.</p>
                            <Button color="primary" size="sm" className="rounded-full" iconTrailing={ArrowRight} onPress={() => go({ name: "create" })}>Start fundraising</Button>
                        </div>
                    </aside>
                </div>
                <footer className="mt-6 flex flex-col items-center gap-3 border-t border-secondary pt-6 pb-4 text-center text-sm text-tertiary">
                    <p>Since launch, <span className="font-semibold text-primary">{orgs.length}</span> charities have been listed and <span className="font-semibold text-primary">{money(orgs.reduce((n, o) => n + o.total, 0))}</span> has been given in their name.</p>
                    <p className="text-xs">Demo with fictional charities. No payments are taken.</p>
                    <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-1 text-xs font-medium">
                        {([["rules", "Rules"], ["faq", "FAQ"], ["about", "About"], ["create", "Start fundraising"]] as const).map(([n, l], i) => <span key={n} className="flex items-center gap-1">{i > 0 && <span>·</span>}<button type="button" onClick={() => go({ name: n })} className="cursor-pointer rounded px-1 hover:text-primary hover:underline">{l}</button></span>)}
                    </nav>
                </footer>
            </Container>

            <ModalOverlay isOpen={!!claim} isDismissable onOpenChange={(o) => { if (!o) setClaim(null); }}>
                <Modal className="max-w-md"><Dialog aria-label="Claim a rank">
                    <form className="flex flex-col gap-4 p-5 md:p-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                        <div><h2 className="text-lg font-semibold text-primary">Claim rank #{claim?.rank}</h2><p className="text-sm text-tertiary">Give at least {claim ? money(claim.usd) : ""} in a charity's name.</p></div>
                        <Input label="Charity name" autoFocus placeholder="Type a listed charity or a new one" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                        {existing ? <Badge type="pill-color" color="success" size="md">Already listed. Your gift raises its amount.</Badge> : <>
                            <Input label="One-line description" value={form.tagline} onChange={(v) => setForm({ ...form, tagline: v })} />
                            <div className="grid grid-cols-2 gap-3"><Input label="Website" placeholder="charity.org" value={form.domain} onChange={(v) => setForm({ ...form, domain: v })} /><Input label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} /></div>
                            <div className="grid grid-cols-2 gap-3"><NativeSelect label="Cause" value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })} options={opts(CAUSES)} /><NativeSelect label="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} options={opts(REGIONS)} /></div>
                        </>}
                        <Input label={`Gift amount (${currency})`} type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} isInvalid={!!error} hint={error || "Demo only. No payment is taken."} />
                        <div className="flex justify-end gap-3 pt-1"><Button size="md" color="secondary" onPress={() => setClaim(null)}>Cancel</Button><Button size="md" color="primary" type="submit">Give and claim</Button></div>
                    </form>
                </Dialog></Modal>
            </ModalOverlay>
            {toast && <div role="status" className="fixed bottom-5 left-1/2 z-40 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-primary-solid px-4 py-2.5 text-sm font-medium text-white shadow-lg">{toast}</div>}
        </div>
    );
};
