// The donor journey and impact maths, pure: shared by the journey-run edge function (Deno) and the web app (re-exported from
// src/features/engage/journeys/model.ts and src/features/engage/impact/model.ts). No imports, so both runtimes load it as is.
// The SQL in 20261128400000_journeys_impact.sql mirrors enrollments() and dueSends(); tests/journeys.test.ts checks they agree.

export type Trigger = "eid" | "lapsed" | "anniversary";
export type Audience = "all" | "first_time" | "returning";
export type Segment = "first_time" | "returning" | "lapsed" | "other";
export type Channel = "email" | "sms";
export type Kind = "thanks" | "receipt" | "impact" | "monthly_ask" | "qurbani" | "field_update" | "warmup" | "lapsed" | "anniversary" | "custom";

export interface Step {
    id?: string; trigger: Trigger; day: number; kind: Kind; title: string; channels: Channel[];
    subject: string; body: string; sms: string; cta_label: string; cta_url: string; enabled: boolean;
    /** From journey_get: results credited to this step. */
    sent?: number; clicked?: number; gave_again?: number; monthly?: number; converted_cents?: number;
}
export interface Settings {
    live: boolean; audience: Audience; season_label: string; give_url: string;
    ramadan_start: string; eid_date: string; prev_ramadan_start: string; prev_eid_date: string;
}
/** A succeeded gift: day is the YYYY-MM-DD it was given (New York time). */
export interface Gift { day: string; cents: number; fund: string }
export interface Unit { fund: string; unit_cents: number; label: string; label_one?: string; note?: string }

// ---------------------------------------------------------------- dates (YYYY-MM-DD, UTC arithmetic)
export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const addYears = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCFullYear(t.getUTCFullYear() + n); return t.toISOString().slice(0, 10); };
const yearsBetween = (from: string, to: string) => { let n = +to.slice(0, 4) - +from.slice(0, 4); if (to.slice(5) < from.slice(5)) n--; return n; };

// ---------------------------------------------------------------- who a donor is to the journey
export const segment = (gifts: Gift[], s: Pick<Settings, "ramadan_start" | "eid_date" | "prev_ramadan_start" | "prev_eid_date">): Segment => {
    const sum = (f: (g: Gift) => boolean) => gifts.filter(f).reduce((n, g) => n + g.cents, 0);
    const season = sum((g) => g.day >= s.ramadan_start && g.day <= s.eid_date);
    if (season > 0) return sum((g) => g.day < s.ramadan_start) > 0 ? "returning" : "first_time";
    return sum((g) => g.day >= s.prev_ramadan_start && g.day <= s.prev_eid_date) > 0 ? "lapsed" : "other";
};
export const inAudience = (seg: Segment, a: Audience) => (seg === "first_time" || seg === "returning") && (a === "all" || a === seg);

/** The journeys a donor joins as of `today` (the SQL is journey_enroll). `triggers`: those with an enabled step. */
export const enrollments = (gifts: Gift[], s: Settings, today: string, triggers: Trigger[] = ["eid", "lapsed", "anniversary"]): { trigger: Trigger; anchor: string }[] => {
    if (!s.live || !gifts.length) return [];
    const seg = segment(gifts, s), out: { trigger: Trigger; anchor: string }[] = [];
    if (today >= s.eid_date && inAudience(seg, s.audience)) out.push({ trigger: "eid", anchor: s.eid_date });
    if (today >= s.eid_date && seg === "lapsed") out.push({ trigger: "lapsed", anchor: s.eid_date });
    const first = gifts.map((g) => g.day).sort()[0];
    const on = addYears(first, Math.max(1, yearsBetween(first, today)));
    if (on <= today && on > addDays(today, -7)) out.push({ trigger: "anniversary", anchor: on });
    return out.filter((e) => triggers.includes(e.trigger));
};

/**
 * What to do with each due step of one enrollment (the SQL is journey_schedule): the latest due step is sent, earlier ones that
 * were never scheduled are skipped (overtaken), and the monthly ask is skipped for donors who already give monthly.
 */
export const dueSends = (steps: Step[], e: { trigger: Trigger; anchor: string; monthly_at_start?: boolean }, today: string) => {
    const due = steps.filter((st) => st.enabled && st.trigger === e.trigger && addDays(e.anchor, st.day) <= today);
    const notForThem = (st: Step) => !!e.monthly_at_start && st.kind === "monthly_ask";
    const latest = Math.max(-1, ...due.filter((st) => !notForThem(st)).map((st) => st.day));
    return due.map((step) => ({ step, on: addDays(e.anchor, step.day), status: notForThem(step) || step.day < latest ? ("skipped" as const) : ("pending" as const) }));
};

/** The next step a donor will get after `today`, or null when the journey has nothing more for them. */
export const nextStep = (steps: Step[], e: { trigger: Trigger; anchor: string; monthly_at_start?: boolean }, today: string) => {
    const st = steps.filter((x) => x.enabled && x.trigger === e.trigger && addDays(e.anchor, x.day) > today && !(e.monthly_at_start && x.kind === "monthly_ask")).sort((a, b) => a.day - b.day)[0];
    return st ? { step: st, on: addDays(e.anchor, st.day) } : null;
};

// ---------------------------------------------------------------- money and impact
export const money = (cents: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: cents % 100 ? 2 : 0, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export interface ImpactLine { fund: string; cents: number; count: number; label: string; note: string }
/** Each fund's gifts as things: floor(cents / unit). Funds without a unit keep their money and a count of 0. Largest gift first. */
export const impactLines = (funds: Record<string, number>, units: Unit[]): ImpactLine[] =>
    Object.entries(funds).filter(([, c]) => c > 0).map(([fund, cents]) => {
        const u = units.find((x) => x.fund.toLowerCase() === fund.toLowerCase());
        const count = u ? Math.floor(cents / u.unit_cents) : 0;
        return { fund, cents, count, label: u ? (count === 1 && u.label_one ? u.label_one : u.label) : "", note: u?.note ?? "" };
    }).sort((a, b) => b.cents - a.cents);

/** "20 family food packs, a month each, 85 iftar meals and 4 people fed on Eid morning". */
export const impactSentence = (lines: ImpactLine[]) => {
    const parts = lines.filter((l) => l.count > 0).map((l) => `${l.count.toLocaleString("en-US")} ${l.label}`);
    return parts.length < 2 ? parts[0] ?? "" : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
};

// ---------------------------------------------------------------- templates
/** What journey_vars / journey_preview return. */
export interface DonorVars {
    full_name: string | null; currency: string; season: string; year: number;
    season_cents: number; season_zakat_cents: number; ytd_cents: number; ytd_zakat_cents: number; last_cents: number;
    funds: Record<string, number>; units: Unit[]; report_token?: string;
}
export interface Links { site: string; give_url?: string; link?: string }

export const VARS = ["name", "full_name", "org", "season", "year", "total", "zakat", "ytd_total", "ytd_zakat", "last_total", "impact", "report_url", "give_url", "monthly_url", "link"] as const;
export type Var = (typeof VARS)[number];

export const firstName = (full: string | null | undefined) => (full ?? "").trim().split(/\s+/)[0] || "friend";

export const varsFor = (v: DonorVars, org: string, l: Links): Record<Var, string> => {
    const give = l.give_url || `${l.site}/ramadhan/give`, m = (c: number) => money(Number(c), v.currency);
    return {
        name: firstName(v.full_name), full_name: v.full_name || "friend", org, season: v.season, year: String(v.year),
        total: m(v.season_cents), zakat: m(v.season_zakat_cents), ytd_total: m(v.ytd_cents), ytd_zakat: m(v.ytd_zakat_cents), last_total: m(v.last_cents),
        impact: impactSentence(impactLines(v.funds, v.units)) || "every gift you made",
        report_url: v.report_token ? `${l.site}/impact/${v.report_token}` : `${l.site}/impact`,
        give_url: give, monthly_url: `${give}${give.includes("?") ? "&" : "?"}monthly=1`, link: l.link ?? "",
    };
};

/** Fills {name}-style placeholders; unknown ones are left as typed so a mistake shows in the preview. */
export const render = (t: string, vars: Partial<Record<string, string>>) => t.replace(/\{([a-z_]+)\}/g, (all, k: string) => vars[k] ?? all);
/** Placeholders in a template that are not in VARS, for the editor to flag. */
export const unknownVars = (t: string) => [...t.matchAll(/\{([a-z_]+)\}/g)].map((x) => x[1]).filter((k) => !(VARS as readonly string[]).includes(k));

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface Rendered { subject: string; text: string; html: string; sms: string; target: string }
/**
 * One message, ready for notify. `track` is the tracked-link URL (it redirects to `target`; '' links straight to it); `unsubscribe` the opt-out page.
 * Emails say who they are from, carry the charity's postal address and a working opt-out (CAN-SPAM); texts end with STOP.
 */
export const compose = (st: Pick<Step, "subject" | "body" | "sms" | "cta_label" | "cta_url">, vars: Record<Var, string>, o: { org: string; address: string; track: string; unsubscribe: string }): Rendered => {
    const target = render(st.cta_url, vars).trim();
    const link = target ? o.track || target : "";
    const all = { ...vars, link: link || vars.give_url };
    const subject = render(st.subject, all), body = render(st.body, all);
    const why = `You are receiving this because you gave to ${o.org}.`;
    const text = [`Assalamu alaikum ${all.name},`, body, st.cta_label && link ? `${render(st.cta_label, all)}: ${link}` : "", o.org, `${why}\n${o.org}, ${o.address}\nUnsubscribe: ${o.unsubscribe}`].filter(Boolean).join("\n\n");
    const p = (s: string) => esc(s).replace(/\n/g, "<br>");
    const html = `<!doctype html><html><body style="margin:0;background:#F4F3F0;font-family:Helvetica,Arial,sans-serif;color:#191919">`
        + `<div style="max-width:560px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border-radius:16px;padding:28px">`
        + `<p style="margin:0 0 16px;font-size:13px;color:#666">${esc(o.org)}</p>`
        + `<p style="margin:0 0 12px;font-size:16px;line-height:1.5">Assalamu alaikum ${esc(all.name)},</p>`
        + `<p style="margin:0 0 20px;font-size:16px;line-height:1.5">${p(body)}</p>`
        + (st.cta_label && link ? `<p style="margin:0 0 8px"><a href="${esc(link)}" style="display:inline-block;background:#D2DBA0;color:#191919;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">${esc(render(st.cta_label, all))}</a></p>` : "")
        + `</div><p style="margin:16px 8px 0;font-size:12px;line-height:1.5;color:#666">${esc(why)}<br>${esc(o.org)}, ${esc(o.address)}<br><a href="${esc(o.unsubscribe)}" style="color:#666">Unsubscribe</a></p></div></body></html>`;
    const sms = st.sms ? `${render(st.sms, all)} Reply STOP to opt out.` : "";
    return { subject, text, html, sms, target };
};
