/**
 * Account: Outgive's plans, what each includes, and the chapter roll-up. Pure, so it is tested without a database.
 * The database has the same rules (plan_allows in supabase/migrations/20261128600000); keep FEATURES in step with it.
 * Prices here are the list prices shown on screen. What Stripe charges comes from the price IDs in the billing function's secrets.
 */
import type { Role } from "@/features/launch";

export type Plan = "free" | "standard" | "multi";
export type Interval = "month" | "year";
export type Feature = "appeals_unlimited" | "pledge_recovery" | "analytics" | "chapters";

const RANK: Record<Plan, number> = { free: 1, standard: 2, multi: 3 };
/** The lowest plan that includes each feature. */
export const FEATURES: Record<Feature, Plan> = { appeals_unlimited: "standard", pledge_recovery: "standard", analytics: "standard", chapters: "multi" };
export const planAllows = (plan: Plan, f: Feature) => RANK[plan] >= RANK[FEATURES[f]];
/** The plan to suggest for a feature this plan lacks, or null when it has it. */
export const upgradeFor = (plan: Plan, f: Feature): Plan | null => (planAllows(plan, f) ? null : FEATURES[f]);

export const PLANS: Record<Plan, { name: string; month: number; year: number; blurb: string; points: string[] }> = {
    free: { name: "Free", month: 0, year: 0, blurb: "One small appeal.", points: ["One appeal", "Card, Apple Pay, Google Pay and ACH", "Tax receipts", "Basic totals"] },
    standard: { name: "Standard", month: 79, year: 790, blurb: "Every appeal you run.", points: ["Unlimited appeals", "Pledge recovery", "Revenue analytics and reports", "After-Eid journey and impact reports"] },
    multi: { name: "Multi-chapter", month: 249, year: 2490, blurb: "A national body and its chapters.", points: ["Everything in Standard", "Chapters with their own teams", "Roll-up totals across chapters", "Parent admins manage every chapter"] },
};

/** What billing_status returns. Stripe and pilot fields are there for admins of a top-level org only. */
export type Billing = {
    plan: Plan; billed_by_parent: boolean; appeals: number; chapters: number;
    subscribed_plan?: Plan; status?: string; interval?: Interval | null; current_period_end?: string | null; cancel_at_period_end?: boolean; has_customer?: boolean;
    pilot_until?: string | null; post_pilot_plan?: Plan | null; pilot_terms?: string;
};

/** Days left in a founding pilot (0 on its last day), or null when there is none or it has ended. */
export const pilotDaysLeft = (b: Billing, today: string) => {
    if (!b.pilot_until || b.pilot_until < today) return null;
    return Math.round((Date.parse(b.pilot_until) - Date.parse(today)) / 86_400_000);
};

/** The headline state of the subscription, for the tag on the plan card. */
export const statusLabel = (b: Billing, today: string): { text: string; tone: "grey" | "sage" | "peach" | "lilac" } => {
    if (b.billed_by_parent) return { text: "Billed by parent", tone: "lilac" };
    if (b.status === "past_due" || b.status === "unpaid") return { text: "Payment failed", tone: "peach" };
    if (b.status === "active" || b.status === "trialing") return b.cancel_at_period_end ? { text: "Ends at period end", tone: "peach" } : { text: b.status === "trialing" ? "Card on file" : "Active", tone: "sage" };
    if (pilotDaysLeft(b, today) !== null) return { text: "Founding pilot", tone: "lilac" };
    return { text: "Free plan", tone: "grey" };
};

// ---------------------------------------------------------------- team
export type Member = { user_id: string; email: string; name: string; role: Role };
export type Invite = { email: string; role: Role; created_at: string; emailed_at?: string | null; emails_sent?: number };

/** Roles the signed-in person can hand out: owners any, admins editor and viewer, others none. */
export const rolesOffered = (me: Role): Role[] => (me === "owner" ? ["owner", "admin", "editor", "viewer"] : me === "admin" ? ["editor", "viewer"] : []);
/** Whether `me` may change or remove `m` (the database checks again). Nobody changes themselves here. */
export const canManage = (me: Role, m: Member, myId: string | undefined) => m.user_id !== myId && (me === "owner" || (me === "admin" && (m.role === "editor" || m.role === "viewer")));

// ---------------------------------------------------------------- chapters
export type Insights = { raised_cents: number; gifts: number; donors: number };
export type Chapter = { id: string; slug: string; name: string; created_at: string; members: number; insights: Insights };

export const rollUp = (cs: Chapter[]) => cs.reduce((t, c) => ({ raised_cents: t.raised_cents + c.insights.raised_cents, gifts: t.gifts + c.insights.gifts, donors: t.donors + c.insights.donors }), { raised_cents: 0, gifts: 0, donors: 0 });

/** A web address from a chapter name: "Clearwell Dallas" under clearwell -> clearwell-dallas. */
export const chapterSlug = (parent: string, name: string) => {
    const s = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const tail = s.startsWith(`${parent}-`) ? s.slice(parent.length + 1) : s;
    return `${parent}-${tail}`.slice(0, 40).replace(/-$/, "");
};
