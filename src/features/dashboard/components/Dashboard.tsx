import { type ReactNode, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import { DASH_BG, DASH_THEME_KEY, dashDark } from "@/shared/lib/dash-theme";
import { BlurFade } from "@/shared/ui";
import { initials } from "@/shared/lib/format";
import { useApp } from "@/shared/lib/app-context";
import type { DASH_TABS } from "@/shared/lib/route";
import type { Org, PageRow } from "@/shared/domain/types";
import { SignIn } from "@/features/auth";
import { cx } from "@/shared/utils/cx";
import { Analytics, Donations, Overview, Subscriptions, useOrgData } from "./Charity";
import type { Gift, Regular } from "./Giving";
import { MyGiving } from "./MyGiving";
import { Field, Gateways, Profile, Sheet } from "./Setup";
import "../dashboard.css";

type Tab = (typeof DASH_TABS)[number];
type ViewId = "overview" | Tab;
interface Me { id: string; email: string; name: string; country: string }

const MUTED = "text-(--od-muted)";
const ICON: Record<ViewId, string> = {
    overview: "M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z",
    analytics: "M5 12.5h3.5V19H5zM10.25 5h3.5v14h-3.5zM15.5 9h3.5v10h-3.5z",
    donations: "", subscriptions: "",
    gateways: "M4 6h16v12H4zM4 9.5h16v2.5H4z",
    profile: "M12 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5 19.5c.8-3.4 3.6-5 7-5s6.2 1.6 7 5z",
    giving: "M6 3h12v18l-3-2-3 2-3-2-3 2z",
    account: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3h-1.5V8a2 2 0 00-4 0v3z",
};
const HEART = "M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z";
const TITLES: Record<ViewId, [string, string]> = {
    overview: ["Overview", "How your fundraising is doing."], donations: ["Donations", "Every gift, newest first."], subscriptions: ["Subscriptions", "Donors who give every month or year."],
    analytics: ["Analytics", "Who gives, when, and where the money comes from."], gateways: ["Payment gateways", "Connect the accounts donors pay into."], profile: ["Profile", "How your charity appears to donors."],
    giving: ["My giving", "Your own gifts, regular gifts and receipts."], account: ["Account", "Your name and sign-in."],
};
/** Views about the signed-in person, not an organisation. */
const OWN: ViewId[] = ["giving", "account"];
const Glyph = ({ d, filled = true }: { d: string; filled?: boolean }) => <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="flex-none"><path d={d} fill={filled ? "currentColor" : "none"} fillRule="evenodd" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" /></svg>;
/** The design's mark: two interlocking rings, one lime, one ink. */
const Rings = () => <svg width="34" height="24" viewBox="0 0 34 24" aria-hidden="true" className="flex-none"><circle cx="12" cy="12" r="10" fill="none" style={{ stroke: "var(--od-lime)" }} strokeWidth="3.5" /><circle cx="22" cy="12" r="10" fill="none" style={{ stroke: "var(--od-ink)" }} strokeWidth="3.5" /></svg>;
const THEMES: [boolean, string, string][] = [[false, "Light theme", "M12 16a4 4 0 100-8 4 4 0 000 8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"], [true, "Dark theme", "M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.500z"]];
const stored = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const store = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

/**
 * /dashboard: the charity's dashboard (overview, donations, subscriptions, analytics, payment gateways, profile) for an organisation
 * the signed-in person runs, with their own giving and account beside it. Each view is a path, so back and forward work.
 */
export const Dashboard = ({ tab }: { tab?: Tab }) => {
    const { db, user, go, href, toast, isDemo } = useApp();
    const view: ViewId = tab ?? "overview";
    const open = (v: ViewId) => { setMenu(false); go({ name: "dashboard", tab: v === "overview" ? undefined : v }); };
    const [menu, setMenu] = useState(false);
    /** The dashboard's own theme: the design's light palette unless its toggle chose dark. The site's and the OS's theme play no part. */
    const [dark, setDark] = useState(dashDark);
    const theme = (on: boolean) => { store(DASH_THEME_KEY, on ? "dark" : "light"); setDark(on); };
    // While the dashboard is open <html> follows it, so the shared components inside (the giving panels, dialogs) and the page behind match; leaving hands <html> back to the site's theme.
    useLayoutEffect(() => {
        const el = document.documentElement;
        el.classList.toggle("dark-mode", dark); el.style.background = DASH_BG[dark ? "dark" : "light"];
        return () => { const t = stored("theme"); el.classList.toggle("dark-mode", t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)); el.style.background = ""; };
    }, [dark]);

    const [orgs, setOrgs] = useState<Org[] | null>(null);
    const [orgId, setOrgId] = useState(() => stored("outgive.dash.org"));
    const org = orgs?.find((o) => o.id === orgId) ?? orgs?.[0] ?? null;
    const setOrg = useCallback((o: Org) => setOrgs((all) => all?.map((x) => (x.id === o.id ? o : x)) ?? all), []);
    const data = useOrgData(user ? org : null);

    const [gifts, setGifts] = useState<Gift[]>([]);
    const [regular, setRegular] = useState<Regular[]>([]);
    const [pages, setPages] = useState<PageRow[]>([]);
    const [me, setMe] = useState<Me | null>(null);
    const [name, setName] = useState("");
    /** Gifts and regular gifts, read again after the donor changes one. */
    const loadGiving = useCallback(() => Promise.all([db.rpc<Gift[]>("my_gifts"), db.rpc<Regular[]>("my_recurring")]).then(([g, r]) => { setGifts(g); setRegular(r); }).catch((e) => toast((e as Error).message)), [db, toast]);
    useEffect(() => {
        if (!user) return;
        loadGiving();
        Promise.all([db.rpc<Org[]>("my_orgs"), db.rpc<PageRow[]>("my_pages"), db.rpc<Me[]>("my_profile")]).then(([o, p, pr]) => { setOrgs(o); setPages(p); setMe(pr[0] ?? null); setName(pr[0]?.name ?? user.name); }).catch((e) => { setOrgs([]); toast((e as Error).message); });
    }, [db, user]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (!menu) return; const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [menu]);
    useEffect(() => { document.title = `${TITLES[view][0]} · ${org && !OWN.includes(view) ? org.name : "Outgive"}`; }, [view, org]);

    const logo = <button type="button" onClick={() => go({ name: "landing" })} aria-label="Outgive home" className="flex min-h-11 items-center gap-2.5 border-0 bg-transparent p-0 text-(--od-ink)"><Rings /><span className="text-2xl font-medium tracking-[-0.6px]">outgive</span></button>;
    if (!user) return <div className={cx("od", dark && "dark")}><div className="mx-auto flex max-w-md flex-col gap-8 px-4 py-6">{logo}<div className="od-card rounded-3xl p-6"><SignIn next={window.location.pathname} title="Your dashboard" sub="Sign in to see your fundraising, gifts and receipts." /></div></div></div>;

    const failed = data?.subs.filter((s) => s.failed && s.status === "active").length ?? 0;
    const who = me?.name || user.name;
    const item = (id: ViewId, sub?: "first" | "next") => (
        <button key={id} type="button" className={cx("od-nav", sub && "od-sub", sub === "first" && "first")} aria-current={view === id ? "page" : undefined} onClick={() => open(id)}>
            {!sub && <Glyph d={ICON[id]} />}{TITLES[id][0]}
            {id === "subscriptions" && failed > 0 && <span className="ml-auto text-xs font-semibold whitespace-nowrap text-(--od-bad-fg)">{failed} failed</span>}
        </button>
    );
    const loading = <p className={cx("py-10 text-center text-[15px]", MUTED)}>Loading…</p>;
    const noOrg = (
        <section className="od-card mx-auto flex w-full max-w-[760px] flex-col items-start gap-3 p-7 sm:p-9">
            <h2 className="od-h2 sm">You don't run an organisation yet</h2>
            <p className={cx("m-0 max-w-prose text-[15px] leading-normal", MUTED)}>Set one up to take gifts, see who gives and manage your payment gateways here. Your own gifts and receipts are under My giving.</p>
            <div className="mt-2 flex flex-wrap gap-2.5"><button type="button" className="od-btn cta" onClick={() => go({ name: "start" })}>Set up your organisation</button><button type="button" className="od-btn" onClick={() => open("giving")}>My giving</button></div>
        </section>
    );
    const account = (
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
            <Sheet>
                <Field first label="Name" hint="On your receipts and gifts"><input className="od-in" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Email" hint="Gifts made with this address are linked to your account, including ones made before you signed up."><input className="od-in" aria-label="Email" value={me?.email ?? user.email} disabled /></Field>
            </Sheet>
            <div className="flex flex-wrap items-center justify-end gap-2.5">
                {!isDemo && <button type="button" className="od-btn" onClick={() => db.signOut().then(() => go({ name: "landing" }))}>Sign out</button>}
                <button type="button" className="od-btn" onClick={() => go({ name: "start" })}>{orgs?.length ? "Add another organisation" : "Set up an organisation"}</button>
                <button type="button" className="od-btn cta" disabled={!name.trim() || name === me?.name} onClick={async () => { try { await db.rpc("profile_update", { p: { name: name.trim() } }); setMe((p) => (p ? { ...p, name: name.trim() } : p)); toast("Saved"); } catch (e) { toast((e as Error).message); } }}>Save changes</button>
            </div>
        </div>
    );
    const body = (): ReactNode => {
        if (view === "giving") return <MyGiving gifts={gifts} regular={regular} pages={pages} orgs={orgs ?? []} reload={loadGiving} />;
        if (view === "account") return account;
        if (!orgs) return loading;
        if (!org) return noOrg;
        if (view === "gateways") return <Gateways org={org} setOrg={setOrg} />;
        if (view === "profile") return <Profile org={org} setOrg={setOrg} />;
        if (!data) return loading;
        if (view === "donations") return <Donations d={data} org={org} />;
        if (view === "subscriptions") return <Subscriptions d={data} />;
        if (view === "analytics") return <Analytics d={data} org={org} />;
        return <Overview d={data} open={open} />;
    };
    const pill = "flex min-h-[54px] max-w-full items-center gap-2.5 rounded-full border border-(--od-edge) py-0 pr-[18px] pl-2 text-base font-normal text-(--od-ink) hover:bg-(--od-soft) sm:max-w-[300px]";
    const [pillName, pillTo]: [string, ViewId] = org ? [org.name, "profile"] : [who, "account"];
    return (
        <MotionConfig reducedMotion="user">
            <div className={cx("od lg:flex", dark && "dark")} data-theme={dark ? "dark" : "light"}>
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-(--od-line) bg-(--od-bg) px-4 lg:hidden">
                    {logo}
                    <button type="button" aria-label="Menu" aria-expanded={menu} aria-controls="od-nav" onClick={() => setMenu(!menu)} className="flex size-11 items-center justify-center rounded-full border border-(--od-edge) bg-transparent text-(--od-ink)"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d={menu ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button>
                </header>
                {menu && <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setMenu(false)} className="fixed inset-0 z-40 cursor-default border-0 bg-black/40 lg:hidden" />}

                <nav id="od-nav" aria-label="Dashboard" className={cx("flex w-[264px] flex-none flex-col gap-1 overflow-y-auto bg-(--od-bg) px-(--od-pad) pt-[30px] pb-[26px] whitespace-nowrap [--od-pad:16px] lg:sticky lg:top-0 lg:h-dvh lg:[--od-pad:20px] xl:w-[296px]", "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:shadow-2xl max-lg:transition-[translate,visibility] max-lg:duration-200", !menu && "max-lg:invisible max-lg:-translate-x-full")}>
                    <div className="px-3 pb-3.5 max-lg:hidden">{logo}</div>
                    {item("overview")}{item("analytics")}
                    <div className={cx("flex min-h-[50px] items-center gap-3 px-3 text-[17px]", MUTED)}><Glyph d={HEART} />Giving<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="ml-auto"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                    <div className="mb-1 ml-[22px] flex flex-col">{item("donations", "first")}{item("subscriptions", "next")}</div>
                    {item("gateways")}{item("profile")}
                    {/* Not in the design: the signed-in person's own giving and account, kept reachable as two more items. */}
                    {item("giving")}{item("account")}
                    <div className="mt-auto flex flex-col gap-1 pt-6">
                        {org && <a className="od-nav" href={href({ name: "board", org: org.slug })}><Glyph d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM9.5 8v2h3.1L8 14.6 9.4 16l4.600-4.600v3.100h2V8z" />My donation page</a>}
                        <div className="mt-3.5 flex flex-col items-center gap-2 border-t border-(--od-line) px-2 pt-7 text-center">
                            <strong className="text-2xl font-normal tracking-[-0.5px]">Need help?</strong>
                            <span className={cx("text-sm leading-[1.45] whitespace-normal", MUTED)}>Questions about gateways, Gift Aid and payouts.</span>
                            {/* ponytail: there is no support inbox yet (LEGAL.email is a placeholder), so Contact us opens the FAQ; point it at the inbox when one exists. */}
                            <button type="button" className="od-btn mt-2 bg-(--od-soft) px-[18px]" onClick={() => go({ name: "faq" })}>Contact us<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                        </div>
                        <div role="group" aria-label="Theme" className="mt-[22px] flex gap-0.5 self-start rounded-full border border-(--od-edge) p-[3px]">
                            {THEMES.map(([on, label, icon]) => <button key={label} type="button" onClick={() => theme(on)} aria-pressed={dark === on} aria-label={label} title={label} className="od-ic"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>)}
                        </div>
                    </div>
                </nav>

                <main className="flex min-w-0 flex-1 flex-col gap-[26px] px-4 pt-6 pb-12 lg:pt-[30px] lg:pr-9 lg:pl-5">
                    <header className="flex flex-wrap items-center justify-between gap-3.5">
                        <div className="flex min-w-0 flex-col gap-1"><h1 className="m-0 text-[clamp(30px,8vw,40px)] leading-[1.1] font-normal tracking-[-1px]">{TITLES[view][0]}</h1><p className={cx("m-0 text-[15px]", MUTED)}>{TITLES[view][1]}{isDemo && !OWN.includes(view) && " Sample charity, sample gifts."}</p></div>
                        <div className="relative max-w-full" style={{ background: "var(--od-card)", borderRadius: 999 }}>
                            <button type="button" className={cx(pill, "bg-transparent")} onClick={() => open(pillTo)} aria-label={org ? `${org.name}: edit profile` : `${who}: account`} {...(orgs && orgs.length > 1 ? { tabIndex: -1, "aria-hidden": true } : {})}>
                                <span aria-hidden="true" className="flex size-9 flex-none items-center justify-center rounded-full bg-(--od-soft) text-[13px]">{initials(pillName) || "?"}</span><span className="truncate">{pillName}</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="flex-none"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                            {orgs && orgs.length > 1 && org && <select aria-label="Organisation" value={org.id} onChange={(e) => { setOrgId(e.target.value); store("outgive.dash.org", e.target.value); }} className="absolute inset-0 size-full cursor-pointer rounded-full opacity-0">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}
                        </div>
                    </header>
                    <BlurFade key={view} duration={0.3} offset={8} direction="up" blur="4px">{body()}</BlurFade>
                </main>
            </div>
        </MotionConfig>
    );
};
