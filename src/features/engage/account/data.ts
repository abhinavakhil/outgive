/**
 * Team, Chapters and Billing data. Live: the SQL API (roles and invites from 20261127010000, chapters and billing from 20261128600000)
 * and the billing / invite-email edge functions. Demo (ws.sample): in-memory samples, so every button works and nothing is sent or charged.
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import type { Role } from "@/features/launch";
import { useWorkspace } from "../shell/workspace";
import type { Billing, Chapter, Interval, Invite, Member, Plan } from "./model";

type State = "loading" | "ready" | "error";
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Loads `get` for the current org, and reloads after each action. */
const useLoad = <T>(get: () => Promise<T>, initial: T, key: string) => {
    const [data, setData] = useState<T>(initial);
    const [state, setState] = useState<State>("loading");
    const [error, setError] = useState<string>();
    const load = useCallback(async () => {
        try { setData(await get()); setState("ready"); } catch (e) { setError((e as Error).message); setState("error"); }
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { void load(); }, [load]);
    return { data, setData, state, error, load };
};

// ---------------------------------------------------------------- billing
const SAMPLE_BILLING: Billing = {
    plan: "multi", billed_by_parent: false, appeals: 4, chapters: 3, subscribed_plan: "free", status: "none", interval: null, current_period_end: null,
    cancel_at_period_end: false, has_customer: false, pilot_until: "2027-03-31", post_pilot_plan: "multi", pilot_terms: "Pilot letter signed 2026-11-20: Multi-chapter at $249/month from April 2027",
};

export const useBilling = () => {
    const { db, toast } = useApp();
    const ws = useWorkspace();
    const { data, state, error } = useLoad<Billing | null>(() => (ws.sample ? Promise.resolve(SAMPLE_BILLING) : db.rpc<Billing>("billing_status", { org: ws.org.id })), null, `${ws.org.id}${ws.sample}`);
    /** Opens Stripe Checkout (subscribe) or the Customer Portal (card, invoices, cancel, plan change). */
    const open = async (action: "checkout" | "portal", plan?: Plan, interval?: Interval) => {
        if (ws.sample) { toast(action === "portal" ? "In the demo the Stripe billing portal does not open" : "In the demo Stripe Checkout does not open, and nothing is charged"); return; }
        try { const r = await db.fn<{ url: string }>("billing", { org_id: ws.org.id, action, plan, interval, origin: location.origin }); location.href = r.url; } catch (e) { toast((e as Error).message); }
    };
    return { billing: data, state, error, open, today: today() };
};

/** The org's plan for soft upgrade prompts on any screen; "free" until known. Never use it to stop a gift. */
export const usePlan = (): Plan => useBilling().billing?.plan ?? "free";

// ---------------------------------------------------------------- team
const SAMPLE_MEMBERS: Member[] = [
    { user_id: "me", email: "amina@clearwell.org", name: "Amina Siddiqui", role: "owner" },
    { user_id: "u2", email: "yusuf@clearwell.org", name: "Yusuf Rahman", role: "admin" },
    { user_id: "u3", email: "hana@clearwell.org", name: "Hana Yusuf", role: "editor" },
    { user_id: "u4", email: "omar.trustee@example.com", name: "Omar Siddiqui", role: "viewer" },
];
const SAMPLE_INVITES: Invite[] = [
    { email: "volunteers@clearwell.org", role: "editor", created_at: daysAgo(2), emailed_at: daysAgo(2), emails_sent: 1 },
    { email: "treasurer@clearwell.org", role: "viewer", created_at: daysAgo(6), emailed_at: daysAgo(6), emails_sent: 1 },
];

export const useTeam = () => {
    const { db, user } = useApp();
    const ws = useWorkspace(), org = ws.org.id, admin = ws.role === "owner" || ws.role === "admin";
    const { data, setData, state, error, load } = useLoad<{ members: Member[]; invites: Invite[] }>(async () => ws.sample ? { members: SAMPLE_MEMBERS, invites: SAMPLE_INVITES } : {
        members: (await db.rpc<Member[]>("org_members_list", { org })) ?? [],
        invites: admin ? ((await db.rpc<Invite[]>("org_invites_list", { org })) ?? []) : [],
    }, { members: [], invites: [] }, `${org}${ws.sample}${admin}`);
    const me = ws.sample ? "me" : user?.id;
    const set = (f: (d: typeof data) => typeof data) => setData(f);
    const email = (e: string) => db.fn<{ sent: boolean }>("invite-email", { org_id: org, email: e, origin: location.origin });

    /** Adds someone. Returns "added" (they had an account) or "invited" (invite saved and emailed, or "invited-unsent" if the email failed). */
    const add = async (e: string, role: Role): Promise<"added" | "invited" | "invited-unsent"> => {
        e = e.trim().toLowerCase();
        if (ws.sample) { set((d) => ({ ...d, invites: [{ email: e, role, created_at: new Date().toISOString(), emailed_at: new Date().toISOString(), emails_sent: 1 }, ...d.invites.filter((i) => i.email !== e)] })); return "invited"; }
        const added = await db.rpc<boolean>("member_add", { org, member_email: e, member_role: role });
        let r: "added" | "invited" | "invited-unsent" = added ? "added" : "invited";
        if (!added) await email(e).catch(() => { r = "invited-unsent"; });
        await load(); return r;
    };
    const setRole = async (m: Member, role: Role) => {
        if (ws.sample) return set((d) => ({ ...d, members: d.members.map((x) => (x.user_id === m.user_id ? { ...x, role } : x)) }));
        await db.rpc("member_set_role", { org, member: m.user_id, new_role: role }); await load();
    };
    const remove = async (m: Member) => {
        if (ws.sample) return set((d) => ({ ...d, members: d.members.filter((x) => x.user_id !== m.user_id) }));
        await db.rpc("member_remove", { org, member: m.user_id }); await load();
    };
    const resend = async (i: Invite) => {
        if (ws.sample) return set((d) => ({ ...d, invites: d.invites.map((x) => (x.email === i.email ? { ...x, emailed_at: new Date().toISOString(), emails_sent: (x.emails_sent ?? 0) + 1 } : x)) }));
        await email(i.email); await load();
    };
    const cancel = async (i: Invite) => {
        if (ws.sample) return set((d) => ({ ...d, invites: d.invites.filter((x) => x.email !== i.email) }));
        await db.rpc("invite_cancel", { org, invite_email: i.email }); await load();
    };
    return { ...data, state, error, me, add, setRole, remove, resend, cancel };
};

// ---------------------------------------------------------------- chapters
const ch = (slug: string, name: string, members: number, raised: number, gifts: number, donors: number, ago: number): Chapter =>
    ({ id: `sample-${slug}`, slug, name, created_at: daysAgo(ago), members, insights: { raised_cents: raised * 100, gifts, donors } });
const SAMPLE_CHAPTERS: Chapter[] = [
    ch("hope-foundation-dallas", "Hope Foundation Dallas", 4, 48250, 612, 401, 40), ch("hope-foundation-houston", "Hope Foundation Houston", 3, 36900, 455, 318, 32), ch("hope-foundation-austin", "Hope Foundation Austin", 2, 12400, 171, 129, 9),
];

export const useChapters = () => {
    const { db } = useApp();
    const ws = useWorkspace(), org = ws.org.id;
    const { data, setData, state, error, load } = useLoad<Chapter[]>(() => (ws.sample ? Promise.resolve(SAMPLE_CHAPTERS) : db.rpc<Chapter[]>("chapters_list", { parent: org })), [], `${org}${ws.sample}`);
    const create = async (name: string, slug: string) => {
        if (ws.sample) { setData((d) => [...d, ch(slug, name.trim(), 0, 0, 0, 0, 0)].sort((a, b) => a.name.localeCompare(b.name))); return; }
        await db.rpc("chapter_create", { parent: org, chapter_name: name.trim(), chapter_slug: slug }); await load();
    };
    return { chapters: data, state, error, create };
};
