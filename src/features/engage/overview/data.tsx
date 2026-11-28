/**
 * The Overview's data: one hook per card, so a feature can swap its card onto a real source without touching the others.
 * Real figures come from org_insights (paid gifts, by night and by fund) and bio_get (the Ramadan page's campaigns and goals).
 * Figures with no backend yet (pledges, the after-Eid journey, receipts, EIN checks) return an empty state that says where to set them up.
 * In the demo (ws.sample) every card shows the prototype's sample figures, and the shell labels the page "Sample data".
 */
import { useEffect, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import { type BioPage, type InsightStats, nightsFrom } from "@/features/launch";
import type { AgendaDay, Slice, Stat, Tone } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import { usePledgeSummary } from "../pledges/data";
import { useComplianceTodos } from "../compliance/data";
import { scheduleOf, useJourneyGlance } from "../journeys/data";
import { useTonight } from "../revenue/hooks";
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export type Load<T> = { state: "loading" } | { state: "ready"; data: T } | { state: "empty"; why: string; href?: string; cta?: string };
const DAY = 86400000;
/** Night 1 of Ramadan 1448 in the US, used until the charity's page sets its own. */
const RAMADAN_1448 = "2027-02-08";
/** The demo's "today": the Monday after Eid, as in the prototype. */
const SAMPLE_TODAY = new Date("2027-03-15T12:00:00");

// ---------------------------------------------------------------- the one fetch the real cards share
type Source = { insights: InsightStats | null; bio: BioPage | null; byCause: Record<string, { cents: number; donors: number }> };
type BioGet = { bio: BioPage | null; stats: { by_cause: Record<string, { cents: number; donors: number }> } } | null;
const cache = new Map<string, Promise<Source>>();
const useSource = (): Load<Source> => {
    const { db } = useApp();
    const ws = useWorkspace();
    const [s, setS] = useState<Load<Source>>({ state: "loading" });
    useEffect(() => {
        if (ws.sample) return;
        let off = false;
        const key = ws.org.id;
        if (!cache.has(key)) cache.set(key, Promise.all([
            db.rpc<InsightStats>("org_insights", { org: key }).catch((e) => { console.error("org_insights", e); return null; }),
            db.rpc<BioGet>("bio_get", { s: ws.org.slug }).catch(() => null),
        ]).then(([insights, b]) => ({ insights, bio: b?.bio ?? null, byCause: b?.stats.by_cause ?? {} })));
        cache.get(key)!.then((v) => !off && setS({ state: "ready", data: v }));
        return () => { off = true; };
    }, [db, ws.org.id, ws.org.slug, ws.sample]);
    return s;
};
/** Runs `pick` on the shared source; a null result means "no figures yet" and becomes the given empty state. */
const derive = <T,>(src: Load<Source>, pick: (s: Source) => T | null, empty: Omit<Extract<Load<T>, { state: "empty" }>, "state">): Load<T> => {
    if (src.state !== "ready") return src as Load<T>;
    const v = pick(src.data);
    return v === null ? { state: "empty", ...empty } : { state: "ready", data: v };
};
const NO_FIGURES = { why: "Figures could not be loaded. Only the charity’s team can see them." };

// ---------------------------------------------------------------- sample figures (the prototype's Hope Foundation)
const S_FUNDS: [string, number, number][] = [["Zakat", 176300, 1210], ["Sadaqah", 121480, 1630], ["Building fund", 66420, 142], ["Zakat al-Fitr", 38940, 702], ["Fidya", 9720, 188]];
const S_TOTAL = 412860, S_DONORS = 3872, S_GIFTS = 5240;
const S_NIGHTS = (() => {
    const w = Array.from({ length: 30 }, (_, i) => { const n = i + 1; let x = 0.7 + 0.025 * n + ((n * 37) % 7) / 30; if (n > 20) x *= 1.7; if (n > 20 && n % 2) x *= 1.35; if (n === 27) x *= 1.6; return x; });
    const sum = w.reduce((a, b) => a + b, 0);
    return w.map((x) => Math.round((x / sum) * S_TOTAL));
})();
/** Open pledges in the demo, before the pledge sample loads (it has 9). */
const S_PLEDGES_OPEN = 9;

// ---------------------------------------------------------------- greeting
export type Greeting = { today: Date; counters: { n: string; label: string }[] };
export const useGreeting = (): Load<Greeting> => {
    const ws = useWorkspace(), src = useSource(), pl = usePledgeSummary();
    if (ws.sample) return { state: "ready", data: { today: SAMPLE_TODAY, counters: [{ n: String(pl?.open ?? S_PLEDGES_OPEN), label: "Pledges open" }, { n: S_DONORS.toLocaleString("en-US"), label: "Donors" }] } };
    return derive(src, ({ insights: i }) => i && { today: new Date(), counters: [{ n: i.gifts.toLocaleString("en-US"), label: "Gifts" }, { n: i.donors.toLocaleString("en-US"), label: "Donors" }] }, NO_FIGURES);
};

// ---------------------------------------------------------------- 30 nights
export type Nights = { nights: number[]; start: Date; today?: number; goal: number };
const goalOf = (bio: BioPage | null) => (bio ? [...bio.campaigns, ...bio.causes].reduce((n, c) => n + (c.goal || 0), 0) : 0);
export const useNights = (): Load<Nights> => {
    const ws = useWorkspace(), src = useSource();
    if (ws.sample) return { state: "ready", data: { nights: S_NIGHTS, start: new Date(`${RAMADAN_1448}T00:00:00`), goal: 450000 } };
    return derive(src, ({ insights, bio }) => {
        if (!insights) return null;
        const start = bio?.ramadanStart ?? RAMADAN_1448, d = Math.floor((Date.now() - Date.parse(start)) / DAY);
        return { nights: nightsFrom(insights.by_day, start), start: new Date(`${start}T00:00:00`), today: d >= 0 && d < 30 ? d : undefined, goal: goalOf(bio) };
    }, NO_FIGURES);
};

// ---------------------------------------------------------------- raised by fund
export const useFunds = (): Load<Slice[]> => {
    const ws = useWorkspace(), src = useSource();
    const share = (v: number, total: number) => `${Math.round((v / total) * 100)}% of raised`;
    if (ws.sample) return { state: "ready", data: S_FUNDS.map(([label, value, donors]) => ({ label, value, note: `${donors.toLocaleString("en-US")} donors` })) };
    if (src.state === "ready" && !src.data.insights) return { state: "empty", ...NO_FIGURES };
    return derive(src, ({ insights }) => {
        if (!insights) return null;
        const rows = Object.entries(insights.by_fund).map(([label, c]) => ({ label, value: c / 100 })).sort((a, b) => b.value - a.value);
        const total = rows.reduce((n, r) => n + r.value, 0);
        if (!total) return null;
        // Five slices at most: the rest are folded into "Other" so the palette never repeats.
        const top = rows.length > 5 ? [...rows.slice(0, 4), { label: "Other", value: rows.slice(4).reduce((n, r) => n + r.value, 0) }] : rows;
        return top.map((r) => ({ ...r, note: share(r.value, total) }));
    }, { why: "No gifts yet. Each fund’s share shows here once gifts come in.", href: "/ramadhan/give", cta: "Open the give page" });
};

// ---------------------------------------------------------------- stat strip
/** Collected against pledged, from the pledge-recovery feature (pledge_report, or its sample in the demo). */
const pledgeStat = (pl: ReturnType<typeof usePledgeSummary>, m: (n: number) => string): Stat => pl && pl.pledged_cents
    ? { label: "Pledges collected", value: `${pl.collected_pct}%`, note: `${m(pl.collected_cents / 100)} of ${m(pl.pledged_cents / 100)}` }
    : { label: "Pledges collected", value: "–", note: <a href="/engage/pledges">{pl ? "Add pledges" : "Set up pledges"}</a> };
export const useStats = (): Load<Stat[]> => {
    const ws = useWorkspace(), src = useSource(), pl = usePledgeSummary(), tn = useTonight();
    const m = ws.money, s = ws.short;
    if (ws.sample) return { state: "ready", data: [
        { label: "Raised", value: s(S_TOTAL), note: `+${m(S_NIGHTS[29])} last night` },
        { label: "Donors", value: S_DONORS.toLocaleString("en-US"), note: "31% gave before" },
        pledgeStat(pl, m),
    ] };
    return derive(src, ({ insights: i }) => i && [
        // The latest night from revenue tracking (revenue_tonight), else the gift count.
        { label: "Raised", value: s(i.raised_cents / 100), note: tn.state === "ready" && tn.data.night && tn.data.raised_cents ? `+${m(tn.data.raised_cents / 100)} ${tn.data.live ? "tonight" : `on Night ${tn.data.night}`}` : `${i.gifts.toLocaleString("en-US")} gifts` },
        { label: "Donors", value: i.donors.toLocaleString("en-US"), note: i.gifts ? `${m(i.raised_cents / 100 / i.gifts)} average` : "No gifts yet" },
        pledgeStat(pl, m),
    ], NO_FIGURES);
};

// ---------------------------------------------------------------- campaign cards
export type CampaignCard = { id: string; title: string; status: string; tone: Tone; range: string; pct: number; people: string[]; more: string; href: string };
const short = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const statusOf = (raised: number, goal: number): [string, Tone] => (!raised ? ["Not started", "grey"] : goal && raised >= goal ? ["Done", "sage"] : ["In progress", "lilac"]);
const card = (id: string, title: string, raised: number, goal: number, start: Date, ends: Date, donors: number, href: string): CampaignCard => {
    const [status, tone] = statusOf(raised, goal);
    return { id, title, status, tone, range: `${short(start)} – ${short(ends)}`, pct: goal ? Math.min(100, Math.round((raised / goal) * 100)) : 0, people: donors ? ["A K", "Y R", "M A"].slice(0, Math.min(3, donors)) : [], more: `${donors.toLocaleString("en-US")} donor${donors === 1 ? "" : "s"}`, href };
};
export const useCampaigns = (): Load<CampaignCard[]> => {
    const ws = useWorkspace(), src = useSource();
    if (ws.sample) {
        const s = new Date(`${RAMADAN_1448}T00:00:00`), e = new Date("2027-03-09T00:00:00"), eid = new Date("2027-03-10T00:00:00");
        return { state: "ready", data: ([
            ["ramadan", "Ramadan appeal", 248190, 300000, s, e, 2410], ["ten", "Last ten nights", 98250, 100000, new Date("2027-02-28T00:00:00"), e, 1119], ["dinner", "Building fund dinner", 66420, 60000, s, new Date("2027-02-27T00:00:00"), 343],
            ["fitr", "Zakat al-Fitr drive", 38940, 45000, s, eid, 702], ["eid", "Eid gifts for orphans", 0, 20000, eid, new Date("2027-03-20T00:00:00"), 0], ["qurbani", "Qurbani 1448", 0, 80000, new Date("2027-04-01T00:00:00"), new Date("2027-05-17T00:00:00"), 0],
        ] as const).map(([id, t, r, g, a, b, d]) => card(id, t, r, g, a, b, d, "/ramadhan")) };
    }
    return derive(src, ({ bio, byCause }) => {
        if (!bio?.campaigns.length) return null;
        const start = new Date(`${bio.ramadanStart}T00:00:00`);
        return bio.campaigns.map((c) => card(c.id, c.title, (byCause[c.id]?.cents ?? 0) / 100, c.goal, start, new Date(`${c.ends}T00:00:00`), byCause[c.id]?.donors ?? 0, "/ramadhan"));
    }, { why: "No campaigns yet. Add them to your Ramadan page and each one gets a card here.", href: "/ramadhan/edit", cta: "Add a campaign" });
};

// ---------------------------------------------------------------- after-Eid journey (weekly agenda)
const weekOf = (d: Date) => { const m = new Date(d); m.setHours(12, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return Array.from({ length: 7 }, (_, i) => new Date(m.getTime() + i * DAY)); };
export type Journey = { days: AgendaDay[]; selected: number };
export const useJourney = (): Load<Journey> & { week: AgendaDay[] } => {
    const ws = useWorkspace(), j = useJourneyGlance();
    if (ws.sample) {
        const days = weekOf(SAMPLE_TODAY).map((date) => ({ date, events: date.getDate() === 17 ? [
            { title: "Receipt and year-to-date total", when: "Day 7 after Eid · 9:00 AM", people: ["Aisha Khan", "Yusuf Rahman", "Maryam Ali"], more: `${S_DONORS.toLocaleString("en-US")} donors`, tag: "Email", href: "/engage/journey" },
            { title: "Pledge reminder", when: "Day 7 of the pledge sequence · 6:30 PM", people: ["Bilal Ahmed", "Hana Yusuf"], more: `${S_PLEDGES_OPEN} open pledges`, tag: "Email + SMS", href: "/engage/pledges" },
        ] : date.getDate() === 19 ? [{ title: "Offer three monthly payments", when: "Day 14 of the pledge sequence · 10:00 AM", people: ["Sara Qureshi"], more: "5 pledges", tag: "Email", href: "/engage/pledges" }] : [] }));
        return { state: "ready", data: { days, selected: 2 }, week: days };
    }
    // The after-Eid journey's own schedule: each enabled Eid step on its date, for this week.
    const days = weekOf(new Date()).map((date) => ({ date, events: j ? scheduleOf(j).filter((x) => x.on === isoOf(date)).map(({ step }) => ({
        title: step.title, when: `${step.day ? `Day ${step.day} after Eid` : "Eid day"} · 10:00 AM`, more: `${j.audience[j.settings.audience].toLocaleString("en-US")} donors`,
        tag: `${step.channels.includes("sms") ? "Email + SMS" : "Email"}${j.settings.live ? "" : " · draft"}`, href: "/engage/journey" })) : [] }));
    if (j && days.some((d) => d.events.length)) return { state: "ready", data: { days, selected: (new Date().getDay() + 6) % 7 }, week: days };
    return { state: "empty", why: j?.settings.live ? "Nothing from the journey goes out this week." : "Nothing scheduled. Plan the messages that go out after Eid.", href: "/engage/journey", cta: j?.settings.live ? "See the journey" : "Plan the journey", week: days };
};

// ---------------------------------------------------------------- today's to-dos and the pledge badge
export type TodoCount = { key: "pledges" | "receipts" | "ein" | "journey"; title: string; note: string; href: string };
export const useTodos = (): TodoCount[] => {
    const ws = useWorkspace(), pl = usePledgeSummary(), cp = useComplianceTodos(), jr = useJourneyGlance();
    const on = jr ? jr.steps.filter((x) => x.enabled).length : 0;
    const due = (n: number) => `${n} due soon`;
    const rows: [TodoCount["key"], string, string, number][] = [
        ["pledges", "Pledges to chase", "/engage/pledges", 6], ["receipts", "Receipts to send", "/engage/receipts", 38],
        ["ein", "EINs to verify", "/engage/receipts", 2], ["journey", "After-Eid journey", "/engage/journey", 3],
    ];
    // Pledges read the pledge-recovery feature (overdue pledges); receipts and EINs read Receipts and safety. The journey reads the after-Eid journey (draft or live).
    const note = (key: TodoCount["key"], n: number) =>
        key === "pledges" && pl ? (pl.toChase ? `${pl.toChase} overdue` : pl.open ? `${pl.open} open, none overdue` : "None open")
        : key === "receipts" && cp ? (cp.unsent ? `${cp.unsent} not emailed yet` : "All sent")
        : key === "ein" && cp ? (cp.einToVerify ? "Payments off until verified" : "Verified")
        : key === "journey" && jr ? (jr.settings.live ? `Live, ${jr.enrolled.toLocaleString("en-US")} donors in it` : `Draft: ${on} steps ready to start`)
        : ws.sample ? due(n) : "Not set up yet";
    return rows.map(([key, title, href, n]) => ({ key, title, href: key === "ein" ? `${href}#ein` : href, note: note(key, n) }));
};
/** Open pledges for the sidebar badge; null (none, or not loaded) hides it. */
export const usePledgeBadge = (): number | null => usePledgeSummary()?.open || null;

