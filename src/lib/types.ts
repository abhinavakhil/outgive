/** Rows as the SQL API returns them (snake_case, cents), and adapters to the shapes the screens were built on. */
import { type Brand, type Donation, type PageData, type PageType, type PageUpdate, type Supporter, type LayoutId, type Cover } from "@/data";

export interface Org {
    id: string; slug: string; name: string; tagline: string; description: string; logo_url: string; color: string; font: string; variant: string;
    impact_usd: number | null; impact_unit: string; currency: string; country: string; registration_number: string; website: string;
    custom_domain: string | null; remove_branding: boolean; verified: boolean;
    stripe_account_id: string | null; stripe_charges_enabled: boolean; stripe_payouts_enabled: boolean; platform_fee_bps: number; tips_enabled: boolean;
    live: LiveState; owner_id: string | null; created_at: string;
}
/** What the presenter console pushes to every live screen. */
export interface LiveState { ask?: string; ask_usd?: number; mode?: "board" | "thermo" | "ticker"; page_id?: string | null; show_qr?: boolean; confetti_at?: number; paused?: boolean; variant?: string }

export interface PageRow {
    id: string; org_id: string; owner_id: string | null; parent_id: string | null; supporter_id: string | null; type: PageType; slug: string; title: string; org_name: string; country: string;
    story: string; cover: Cover; layout: LayoutId; goal_cents: number; currency: string; end_date: string | null; show_goal: boolean; causes: string[]; details: Record<string, string>;
    gifts: number[]; allocation: [string, number][]; allow_fundraisers: boolean; status: "draft" | "live" | "paused" | "ended"; raised_cents: number; donor_count: number; live: LiveState; created_at: string; updated_at: string;
}
export interface PublicDonation { id: string; org_id: string; page_id: string | null; supporter_id: string | null; name: string; amount_cents: number; currency: string; usd_cents: number; message: string; dedication: string; recurring: boolean; source: string; ticket_qty: number; created_at: string }
export interface DonationRow extends Omit<PublicDonation, "name"> { donor_name: string; donor_email: string | null; donor_id: string | null; anonymous: boolean; tip_cents: number; cover_cents: number; platform_fee_cents: number; status: string; stripe_payment_intent_id: string | null; stripe_subscription_id: string | null; ticket_type_id: string | null; claimed_rank: number | null; receipt_sent_at: string | null }
export interface UpdateRow { id: string; page_id: string; title: string; body: string; created_at: string }
export interface TicketType { id: string; page_id: string; name: string; description: string; price_cents: number; quantity: number | null; sold: number; sort: number }
export interface PageBundle { page: PageRow; donations: PublicDonation[]; updates: UpdateRow[]; tickets: TicketType[]; children: { id: string; type: PageType; slug: string; title: string; raised_cents: number; donor_count: number; goal_cents: number }[]; parent: { id: string; type: PageType; slug: string; title: string } | null; can_edit: boolean }
export interface BoardRow { id: string; name: string; tagline: string; kind: string; region: string; country: string; page: string; total: number | string; today: number | string; week: number | string; recruited: number; streak: number; visits: number; days: number; match: number | string | null; user_id: string | null }
export interface MatchPledge { id: string; org_id: string; page_id: string | null; sponsor_name: string; ratio: number; cap_cents: number; matched_cents: number; active: boolean; created_at: string }
export interface OrgStats { raised_cents: number; tips_cents: number; donations: number; donors: number; recurring: number; refunded_cents: number; by_day: { day: string; usd_cents: number }[]; pages: number }
export interface Member { user_id: string; email: string; name: string; role: string }
export interface User { id: string; email: string; name: string }

const n = (x: number | string | null | undefined) => Number(x ?? 0);
const ms = (iso: string) => new Date(iso).getTime();

export const toBrand = (o: Org): Brand => ({ name: o.name, tagline: o.tagline, logo: o.logo_url, color: o.color, font: o.font, variant: o.variant, impact: o.impact_usd ? { usd: n(o.impact_usd), unit: o.impact_unit } : undefined });
export const toSupporter = (r: BoardRow): Supporter => ({ id: r.id, name: r.name, tagline: r.tagline, kind: r.kind, region: r.region, country: r.country, page: r.page, total: n(r.total), today: n(r.today), week: n(r.week), recruited: r.recruited, streak: r.streak, visits: r.visits, days: r.days, match: r.match ? n(r.match) : undefined });
export const toDonation = (d: PublicDonation): Donation => ({ name: d.name, usd: d.usd_cents / 100, message: d.message, at: ms(d.created_at), ...(d.recurring && { monthly: true }), ...(d.dedication && { dedication: d.dedication }) });
export const toUpdate = (u: UpdateRow): PageUpdate => ({ title: u.title, body: u.body, at: ms(u.created_at) });
/** The page as the 12 layouts expect it. Amounts become USD units so every existing component keeps working. */
export const toPageData = (b: PageBundle, usdRate: (c: string) => number): PageData => {
    const p = b.page; const rate = usdRate(p.currency);
    return {
        type: p.type, slug: p.slug, title: p.title, org: p.org_name, country: p.country, goal: p.goal_cents / 100 / rate, raised: p.raised_cents / 100 / rate, supporters: p.donor_count,
        story: p.story, cover: p.cover, layout: p.layout, isSample: false, causes: p.causes, details: p.details, gifts: p.gifts, endDate: p.end_date ?? "", showGoal: p.show_goal, created: ms(p.created_at),
        donations: b.donations.map(toDonation), updates: b.updates.map(toUpdate), allocation: p.allocation,
    };
};
