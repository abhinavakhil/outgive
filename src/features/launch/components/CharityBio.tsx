/**
 * /ramadhan: the charity's Ramadan giving page, as its organiser set it up in /ramadhan/edit.
 * "Organiser view" shows the appeal's insights on the page itself. ?date=YYYY-MM-DD previews the banner on another day;
 * ?insights opens organiser view.
 */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import { BioView, type GiveHref } from "../bio/BioView";
import { type InsightStats, Insights } from "../bio/Insights";
import { atLeast, useRoleAt } from "../account/roles";
import { useBioPage } from "../bio/model";
import { RAMADAN_ORG, useLive, withStats } from "../bio/live";

/**
 * Give buttons open the Ramadan donate flow. The page and the flow share one basket (give/store.ts), so whatever was picked
 * here is already there; a button for one cause (Pay your Zakat) adds it on the way.
 */
const giveHref: GiveHref = (_summary, start = {}) => (start.add?.length === 1 ? `/ramadhan/give?add=${start.add[0]}` : "/ramadhan/give");

export const CharityBio = () => {
    const { page: local } = useBioPage();
    // With Supabase connected: the saved page (or this one until it is saved) with real totals, supporters and gifts.
    const live = useLive();
    const shown = useMemo(() => (live ? withStats(live.bio ?? local, live.stats) : { page: local, supporters: undefined, gifts: undefined }), [live, local]);
    const page = shown.page;
    const q = new URLSearchParams(window.location.search);
    const date = q.get("date");
    const { db, user, isDemo } = useApp();
    // The organiser view is for the charity's team (viewer or higher). The database checks this too: org_insights refuses anyone else.
    const role = useRoleAt(RAMADAN_ORG);
    const team = atLeast(role, "viewer");
    const [organiser, setOrganiser] = useState(q.has("insights"));
    const [stats, setStats] = useState<InsightStats | null>(null);
    useEffect(() => { if (organiser && team && live && !isDemo) db.rpc<InsightStats>("org_insights", { org: live.org_id }).then(setStats, () => setStats(null)); }, [organiser, team, live, isDemo, db]);
    const showDash = organiser && team;
    return (
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", overflowX: "clip" }}>
            <div className="bp-tools">
                {team && <button type="button" aria-pressed={showDash} onClick={() => setOrganiser(!showDash)} className="bp-tool">{showDash ? "Back to page" : "Organiser view"}</button>}
                {!isDemo && <a href={user ? "/ramadhan/account" : `/ramadhan/login?next=${encodeURIComponent(organiser ? "/ramadhan?insights" : "/ramadhan")}`} className="bp-tool">{user ? "Your account" : "Sign in"}</a>}
                {/* The editor (/ramadhan/edit) is closed for now; see isOpen in App.tsx. */}
                {import.meta.env.VITE_ALL_PAGES === "true" && <a href="/ramadhan/edit" className="bp-tool">Edit page</a>}
            </div>
            {showDash ? (
                <main className="bp-dash">
                    <div className="bp-dash-in">
                        <header className="bp-dash-head"><span className="bp-pav">{page.avatar || page.name.slice(0, 2).toUpperCase()}</span><div><h1>{page.name}</h1><p>Ramadan appeal insights. Only your team sees this.</p></div></header>
                        <Insights page={page} live={isDemo ? null : stats} />
                    </div>
                </main>
            ) : organiser && !isDemo ? (
                // ?insights without a team role: say who it is for, and how to get in.
                <main className="bp-dash"><div className="bp-dash-in"><header className="bp-dash-head"><div><h1>Organiser view</h1><p>{user ? `You’re signed in as ${user.email}, which isn’t on ${page.name}’s team. Ask an admin to add you.` : `This is for ${page.name}’s team.`}</p></div></header>
                    <p style={{ display: "flex", gap: 16 }}><button type="button" className="bp-tool" onClick={() => setOrganiser(false)}>Back to page</button></p>
                </div></main>
            ) : <div style={{ flex: 1, display: "flex", flexDirection: "column" }}><BioView page={page} now={date ? Date.parse(date) : undefined} giveHref={giveHref} supporters={shown.supporters} gifts={shown.gifts} /></div>}
        </div>
    );
};

export { BioEditor } from "../bio/BioEditor";
