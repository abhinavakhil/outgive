// The donor journey after Eid: enrolls donors, schedules due steps into journey_sends, then claims and sends them through _shared/notify.
// Callers:
//   cron (every live org):  POST, header x-cron-secret: $CRON_SECRET, empty body (or {org_id})
//   "Run now":              POST {org_id} with the signed-in user's JWT (editor or higher)
//   "Send me a test":       POST {action: "test", org_id, step_id, key?} with the user's JWT (editor or higher); goes to the user's
//                           own email, filled with that donor's numbers (key from journey_donors_list) or sample ones. Not recorded.
//   tracked link:           GET ?c=<send token>  counts the click and redirects (302) to the step's link
//   one-click unsubscribe:  POST ?u=<send token> (RFC 8058, from the List-Unsubscribe header) opts the address out; GET ?u= goes
//                           to the site's /unsubscribe/<token> page, which asks first
// verify_jwt is off (config.toml) so the cron and the links work without a session; the user paths check has_role themselves.
import { admin, asUser, env, fail, json, serve, SITE_URL } from "../_shared/deps.ts";
import { drain, send, type Message, unsubscribeHeaders } from "../_shared/notify/index.ts";
import { compose, type DonorVars, type Step, varsFor } from "./model.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fnUrl = () => `${env("SUPABASE_URL")}/functions/v1/journey-run`;

/** A row from journey_sends_claim(). */
interface Due {
    id: string; token: string; kind: string; channel: string; email: string; phone: string | null; org_id: string; org_name: string; org_address: string; org_contact_email: string | null;
    give_url: string; subject: string | null; body: string | null; sms: string | null; cta_label: string | null; cta_url: string | null; vars: DonorVars;
}

const SAMPLE: DonorVars = {
    full_name: "Aisha Khan", currency: "USD", season: "Ramadan 1448", year: new Date().getUTCFullYear(), season_cents: 160000, season_zakat_cents: 126000,
    ytd_cents: 160000, ytd_zakat_cents: 126000, last_cents: 0, funds: { Zakat: 120000, Sadaqah: 34000, "Zakat al-Fitr": 6000 },
    units: [{ fund: "Zakat", unit_cents: 6000, label: "family food packs, a month each" }, { fund: "Sadaqah", unit_cents: 400, label: "iftar meals" }, { fund: "Zakat al-Fitr", unit_cents: 1500, label: "people fed on Eid morning" }],
};

/** The message for a claimed send, plus where its tracked link goes. Null when it cannot be sent (and why). */
export const build = (r: Due, site: string, fn: string): { m: Message | null; target: string | null; why?: string } => {
    const track = `${fn}?c=${r.token}`;
    if (!r.org_address?.trim()) return { m: null, target: null, why: "the charity has no postal address" };
    const st = { subject: r.subject ?? "", body: r.body ?? "", sms: r.sms ?? "", cta_label: r.cta_label ?? "", cta_url: r.cta_url ?? "" };
    const out = compose(st, varsFor(r.vars, r.org_name, { site, give_url: r.give_url }), { org: r.org_name, address: r.org_address, track, unsubscribe: `${site}/unsubscribe/${r.token}` });
    if (r.channel === "sms") return r.phone && out.sms ? { m: { to: r.phone, channel: "sms", body: out.sms, orgId: r.org_id }, target: out.target || null } : { m: null, target: null };
    return { m: { to: r.email, channel: "email", subject: out.subject, body: out.text, html: out.html, orgId: r.org_id, fromName: r.org_name,
        replyTo: r.org_contact_email || undefined, headers: unsubscribeHeaders(`${fn}?u=${r.token}`) }, target: out.target || null };
};

serve(async (req) => {
    const url = new URL(req.url), db = admin();
    const u = url.searchParams.get("u") ?? "";
    if (u) {
        if (!/^[0-9a-f]{64}$/.test(u)) return fail("Unknown link", 404);
        if (req.method === "GET") return new Response(null, { status: 302, headers: { Location: `${SITE_URL()}/unsubscribe/${u}` } });
        const { error } = await db.rpc("journey_unsubscribe", { token: u });
        if (error) throw error;
        return json({ unsubscribed: true });
    }
    if (req.method === "GET") {
        const c = url.searchParams.get("c") ?? "";
        const { data } = /^[0-9a-f]{64}$/.test(c) ? await db.rpc("journey_click", { token: c }) : { data: null };
        const to = typeof data === "string" && /^https?:\/\//.test(data) ? data : SITE_URL();
        return new Response(null, { status: 302, headers: { Location: to } });
    }
    const b = (await req.json().catch(() => ({}))) as { org_id?: string; action?: string; step_id?: string; key?: string };
    if (b.org_id !== undefined && !UUID.test(b.org_id)) return fail("org_id must be a uuid");
    const secret = Deno.env.get("CRON_SECRET");
    const cron = !!secret && req.headers.get("x-cron-secret") === secret;
    if (!cron || b.action === "test") {
        if (!b.org_id) return fail("org_id is required");
        const { data: ok } = await asUser(req).rpc("has_role", { org: b.org_id, min: "editor" });
        if (ok !== true) return fail("Only the charity's team can do this", 403);
    }

    if (b.action === "test") {
        if (!b.step_id || !UUID.test(b.step_id)) return fail("step_id must be a uuid");
        const me = asUser(req), { data: u } = await me.auth.getUser();
        if (!u.user?.email) return fail("Your account has no email address");
        const { data: st } = await db.from("journey_steps").select("*").eq("id", b.step_id).eq("org_id", b.org_id).maybeSingle<Step>();
        if (!st) return fail("Step not found", 404);
        const { data: o } = await db.from("orgs").select("name, address, contact_email").eq("id", b.org_id).single<{ name: string; address: string; contact_email: string }>();
        const { data: s } = await db.from("journey_settings").select("give_url").eq("org_id", b.org_id).single<{ give_url: string }>();
        let vars = SAMPLE;
        if (b.key) { const { data, error } = await me.rpc("journey_preview", { org: b.org_id, k: b.key }); if (error) return fail(error.message); vars = data as DonorVars; }
        const out = compose(st, varsFor(vars, o!.name, { site: SITE_URL(), give_url: s?.give_url }), { org: o!.name, address: o!.address || "(add your postal address)", track: "", unsubscribe: `${SITE_URL()}/unsubscribe/test` });
        const r = await send({ to: u.user.email, channel: "email", subject: `[Test] ${out.subject}`, body: out.text + (out.sms ? `\n\nText message: ${out.sms}` : ""), html: out.html, orgId: b.org_id, fromName: o!.name, replyTo: o!.contact_email || undefined });
        return json(r);
    }

    const org = b.org_id ?? null;
    const { data: enrolled, error: e0 } = await db.rpc("journey_enroll", { org });
    if (e0) throw e0;
    const { data: scheduled, error: e1 } = await db.rpc("journey_schedule", { org });
    if (e1) throw e1;
    const { data: due, error: e2 } = await db.rpc("journey_sends_claim", { org });
    if (e2) throw e2;
    const site = SITE_URL(), base = fnUrl(), targets = new Map<string, string | null>(), why = new Map<string, string>();
    const n = await drain((due ?? []) as Due[], (r) => {
        const x = build(r, site, base);
        targets.set(r.id, x.target); if (x.why) why.set(r.id, x.why);
        return x.m;
    }, async (id, m) => { await db.from("journey_sends").update({ ...m, error: why.get(id) ?? m.error, target_url: targets.get(id) ?? null }).eq("id", id); });
    return json({ enrolled: enrolled ?? 0, scheduled: scheduled ?? 0, ...n });
});
