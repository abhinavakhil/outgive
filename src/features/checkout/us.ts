/**
 * The US checkout: a per-campaign switch (CheckoutCampaign.region), not a fork. Dollars, EIN and tax-deductible wording, no Gift Aid,
 * no PayPal; funds on every gift (Zakat, Sadaqah, Zakat al-Fitr, Fidya, the appeal); the add-ons a charity picks in the checkout
 * builder; and the builder's settings as stored in checkout_settings (supabase/migrations/20261128300000_us_checkout.sql).
 * Pure, so the layouts, the builder, the embed and the tests share it.
 */
import { NIGHT_21, nightPlan } from "../../../supabase/functions/nightly-charge/plan";
import { type CheckoutCampaign, type Extra, ICONS, type Trust, regionOf } from "./model";

export type Layout = "hero" | "pledge" | "ticket" | "nights" | "compact" | "kiosk";
/** The six layouts, as the builder lists them: [name, what it is for]. */
export const LAYOUTS: Record<Layout, [string, string]> = {
    hero: ["Hero stage", "The default donate page"],
    pledge: ["Pledge", "Events and dinners"],
    ticket: ["Gift ticket", "Receipt-style stub"],
    nights: ["Ten nights", "Odd nights featured"],
    compact: ["Compact", "Inline on any page"],
    kiosk: ["Kiosk", "Tablet at the masjid door"],
};
export const LAYOUT_IDS = Object.keys(LAYOUTS) as Layout[];
/** Gift, details and payment on as few screens as possible: the short layouts are gift → pay → thank you. */
export const SHORT: Layout[] = ["nights", "compact", "kiosk"];

export const ADDONS = {
    nights: ["Last-ten-nights schedule", "One decision becomes ten gifts"],
    alfitr: ["Zakat al-Fitr per person", "$15 a person, counted for the household"],
    fidya: ["Fidya by days missed", "$15 for each missed fast"],
    cover: ["Cover the fees", "2.2% + 30c, on its own line"],
    match: ["Match banner", "Shows what is left in the sponsor pot"],
    dedication: ["Dedication", "In honour or memory of a loved one"],
    roundup: ["Round up to a milestone", "“$40 more closes table 6”"],
    bank: ["Bank debit for large gifts", "Shown from $500, lower fees"],
    pledge: ["Pledge now, pay by a date", "For donors who will not pay at the table"],
    monthly: ["Monthly upgrade", "Offered on the thank-you screen"],
} as const;
export type AddonId = keyof typeof ADDONS;
export const ADDON_IDS = Object.keys(ADDONS) as AddonId[];
/** Not on the gift screen, so not counted in the three: nights is a choice of how often, monthly is asked after paying, the fee is its own line. */
export const OFF_SCREEN: AddonId[] = ["nights", "monthly", "cover"];
export const MAX_SHOWN = 3;
/** Bank debit is offered from this gift up. */
export const BANK_FROM = 500;
export const PER_PERSON = 15, PER_DAY = 15;

/** Which add-ons are on the gift screen right now, in the charity's order, never more than MAX_SHOWN. */
export const shownAddons = (enabled: readonly string[] = [], x: { total: number; layout: string; matchLive: boolean; roundGap: number; fund?: string }): AddonId[] =>
    enabled.filter((id): id is AddonId => id in ADDONS && !OFF_SCREEN.includes(id as AddonId)).filter((id) =>
        id === "bank" ? x.total >= BANK_FROM
        : id === "pledge" ? x.layout === "pledge" || x.layout === "kiosk"
        : id === "match" ? x.matchLive
        : id === "roundup" ? x.roundGap > 0
        : id === "alfitr" ? x.fund !== "zakat_al_fitr"
        : id === "fidya" ? x.fund !== "fidya"
        : true).slice(0, MAX_SHOWN);

/** "$40 more closes table 6": what takes the appeal to its next milestone, offered only when it is no more than the gift itself. 0: no ask. */
export const roundGap = (c: Pick<CheckoutCampaign, "milestone" | "raised">, total: number) => {
    if (!c.milestone || !(c.milestone.step > 0) || !(total > 0)) return 0;
    const gap = Math.ceil((c.raised + total) / c.milestone.step) * c.milestone.step - c.raised - total;
    return gap > 0 && gap <= total ? Math.round(gap * 100) / 100 : 0;
};

// ---------------------------------------------------------------- the builder's settings (a checkout_settings row)
export interface CheckoutSettings {
    layout: Layout;
    addons: AddonId[];
    /** Pre-tick "cover the fees" (it is then always shown). */
    cover_default: boolean;
    /** Fund ids offered, first is the default. "general" is the appeal, named by `appeal`. */
    funds: string[];
    appeal: string;
    /** Night 21's evening. */
    nights_start: string;
    milestone_step: number | null;
    milestone_label: string;
    daf_address: string;
}
export const FUND_IDS = ["general", "zakat", "sadaqah", "zakat_al_fitr", "fidya"] as const;
export const DEFAULT_SETTINGS: CheckoutSettings = {
    layout: "hero", addons: ["cover", "alfitr", "dedication", "nights", "monthly"], cover_default: false,
    funds: ["general", "zakat", "sadaqah", "zakat_al_fitr", "fidya"], appeal: "Ramadan appeal", nights_start: NIGHT_21,
    milestone_step: null, milestone_label: "", daf_address: "",
};
/** What is wrong with a builder's settings, in plain words, or null. The database checks the same (checkout_settings_save). */
export const settingsProblem = (s: CheckoutSettings): string | null => {
    if (!LAYOUT_IDS.includes(s.layout)) return "Pick one of the six layouts.";
    if (s.addons.some((a) => !ADDON_IDS.includes(a))) return "One of those add-ons is not one we have.";
    if (s.addons.filter((a) => !OFF_SCREEN.includes(a)).length > MAX_SHOWN) return `Up to ${MAX_SHOWN} add-ons can sit on the gift screen. Switch one off first.`;
    if (!s.funds.length || s.funds.some((f) => !(FUND_IDS as readonly string[]).includes(f))) return "Offer at least one fund.";
    if (!s.appeal.trim() || s.appeal.length > 40) return "Name the appeal in 40 characters or fewer.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.nights_start)) return "Night 21 needs a date.";
    return null;
};
/** A row from the database (or a query string) as settings: anything unknown falls back to the defaults. */
export const toSettings = (raw: Partial<Record<keyof CheckoutSettings, unknown>> | null | undefined): CheckoutSettings => {
    const r = raw ?? {}, d = DEFAULT_SETTINGS;
    const list = (v: unknown, ok: readonly string[]) => (Array.isArray(v) ? [...new Set(v.map(String).filter((x) => ok.includes(x)))] : null);
    return {
        layout: LAYOUT_IDS.includes(r.layout as Layout) ? (r.layout as Layout) : d.layout,
        addons: (list(r.addons, ADDON_IDS) as AddonId[] | null) ?? d.addons,
        cover_default: typeof r.cover_default === "boolean" ? r.cover_default : d.cover_default,
        funds: list(r.funds, FUND_IDS)?.length ? list(r.funds, FUND_IDS)! : d.funds,
        appeal: typeof r.appeal === "string" && r.appeal.trim() ? r.appeal.trim().slice(0, 40) : d.appeal,
        nights_start: typeof r.nights_start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.nights_start) ? r.nights_start : d.nights_start,
        milestone_step: Number(r.milestone_step) > 0 ? Number(r.milestone_step) : null,
        milestone_label: typeof r.milestone_label === "string" ? r.milestone_label.slice(0, 60) : "",
        daf_address: typeof r.daf_address === "string" ? r.daf_address.slice(0, 200) : "",
    };
};

// ---------------------------------------------------------------- a US campaign from an organisation and its settings
const FUND_LABEL: Record<string, (appeal: string) => [string, string]> = {
    general: (a) => [a, `the ${a}`], zakat: () => ["Zakat", "Zakat"], sadaqah: () => ["Sadaqah", "Sadaqah"],
    zakat_al_fitr: () => ["Zakat al-Fitr", "Zakat al-Fitr"], fidya: () => ["Fidya", "Fidya"],
};
export const ICON_PEOPLE = "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c1-3.3 3.6-5 6.5-5s5.5 1.7 6.5 5M16 11a3 3 0 100-6M18 15c2 .6 3.2 2.2 3.5 5";
export const ICON_MOON = "M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z";
export const extrasFor = (addons: readonly string[], coverDefault: boolean, charity: string): Extra[] => [
    ...(addons.includes("cover") || coverDefault ? [{ id: "cover", name: "Cover the fees", desc: `So ${charity} receives your whole gift`, price: "fee" as const, tone: "violet" as const, icon: ICONS.card }] : []),
    ...(addons.includes("alfitr") ? [{ id: "alfitr", name: "Zakat al-Fitr", desc: `$${PER_PERSON} for each person in your household`, price: PER_PERSON, tone: "green" as const, icon: ICON_PEOPLE, unit: { one: "person", many: "people", max: 20 }, fund: "zakat_al_fitr" }] : []),
    ...(addons.includes("fidya") ? [{ id: "fidya", name: "Fidya", desc: `$${PER_DAY} for each fast missed`, price: PER_DAY, tone: "gold" as const, icon: ICON_MOON, unit: { one: "day", many: "days", max: 30 }, fund: "fidya" }] : []),
    ...(addons.includes("dedication") ? [{ id: "tribute", name: "Dedicate this gift", desc: "In honour or in memory of someone", price: 0, tone: "coral" as const, icon: ICONS.heart, tribute: true }] : []),
];
const PLACEHOLDER = /^\s*(\[.*\])?\s*$/;
export interface UsOrg { id: string; name: string; legalName?: string; ein?: string; verifiedAt?: string | null; raised?: number; goal?: number; title?: string; beneficiary?: string }
export const usCampaign = (o: UsOrg, s: CheckoutSettings, match: CheckoutCampaign["match"] = null): CheckoutCampaign => {
    const trust: Trust = {
        legalName: o.legalName || o.name, regNo: o.ein ?? "", regulator: "IRS, 501(c)(3)", verified: !!o.verifiedAt && !PLACEHOLDER.test(o.ein ?? ""),
        verifiedAt: o.verifiedAt ?? undefined, taxReceipts: true, fund: { name: s.appeal, restricted: false },
    };
    return {
        id: o.id, title: o.title || s.appeal, charity: o.name, beneficiary: o.beneficiary || o.name,
        raised: o.raised ?? 0, goal: o.goal || 0, currency: "USD", locale: "en-US", region: "US",
        presets: [25, 50, 100, 250], fundPresets: { zakat: [100, 250, 500, 1000] }, giftAid: false, match,
        funds: s.funds.map((id) => [id, ...FUND_LABEL[id](s.appeal)] as [string, string, string]),
        perUnitFunds: { zakat_al_fitr: { price: PER_PERSON, one: "person", many: "people", max: 20 }, fidya: { price: PER_DAY, one: "day", many: "days", max: 30 } },
        extras: extrasFor(s.addons, s.cover_default, o.name), addons: s.addons, coverDefault: s.cover_default,
        impact: [[1000, "school fees for a year"], [500, "a month of food for 8 families"], [250, "four family food packs"], [100, "a family food pack"], [50, "12 iftar meals"], [25, "food for a family for a week"], [0, "the work of this appeal"]],
        trust, payments: { card: true, wallets: true, bank: true, dd: false, paypal: false },
        fee: { rate: 0.022, fixed: 0.3 }, nights: { start: s.nights_start },
        milestone: s.milestone_step ? { step: s.milestone_step, label: s.milestone_label } : undefined,
        daf: { address: s.daf_address },
    };
};

/** The US sample: a fictional charity in test mode, for /checkout?region=us, the builder's preview and the embed without a database. */
export const US_SAMPLE_ORG: UsOrg = { id: "us-sample", name: "Hope Foundation", legalName: "Hope Foundation Inc.", ein: "12-3456789", raised: 412860, goal: 600000, title: "Feed a family this Ramadan" };
export const usSample = (s: CheckoutSettings = DEFAULT_SETTINGS): CheckoutCampaign => ({
    weekly: true,
    ...usCampaign(US_SAMPLE_ORG, { ...s, milestone_step: s.milestone_step ?? 500, milestone_label: s.milestone_label || "table 6's goal", daf_address: s.daf_address || "410 Park Ave, Plainfield, NJ 07060" },
        { sponsor: "[Sponsor name]", status: "confirmed", deadline: "2027-03-10", remaining: 6240, perGiftMax: 1000, ratio: 1 }),
});

/** Is this a US campaign, and may it offer the ten nights now (the add-on is on and a night is still to come)? */
export const isUs = (c: CheckoutCampaign) => regionOf(c) === "US";
export const nightsOpen = (c: CheckoutCampaign, now = new Date()) => !!c.addons?.includes("nights") && nightPlan(c.nights?.start, false, now).length > 0;
/** "27 February" for an ISO date, in the campaign's language. */
export const dayName = (iso: string, locale = "en-US") => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long", timeZone: "UTC" });

/** The prototype's embed snippet, filled from the builder's settings. `origin` is where the loader is served. */
export const embedSnippet = (charity: string, s: CheckoutSettings, origin = "https://www.outgive.tech") => `<script src="${origin}/embed/v1.js"></script>
<div id="give"></div>
<script>
  Outgive.checkout({
    el: "#give",
    charity: "${charity}",
    layout: "${s.layout}",
    funds: [${s.funds.map((f) => `"${f}"`).join(", ")}],
    addons: [${s.addons.map((a) => `"${a}"`).join(", ")}],
    coverFees: ${s.cover_default},
    source: { utm: true }
  });
</script>`;
