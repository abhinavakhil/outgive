// Unpaid-pledge recovery: schedules due steps into pledge_reminders, then claims and sends them through _shared/notify.
// Two callers:
//   cron (every org):  POST with header x-cron-secret: $CRON_SECRET and an empty body (or {org_id} for one org)
//   "Run recovery now": POST {org_id} with the signed-in user's JWT; they must be an editor or higher of that org.
//   one-click unsubscribe: POST ?u=<pay token> (RFC 8058, from the List-Unsubscribe header) pauses that pledge's reminders;
//                          GET ?u= goes to the pledge's pay page.
// Emails go out as "<charity> via Outgive", with Reply-To the charity's contact email (orgs.contact_email) when set.
// verify_jwt is off (config.toml) so the cron can call it with only the secret; the user path checks has_role itself.
import { admin, asUser, env, fail, json, serve, SITE_URL } from "../_shared/deps.ts";
import { drain, unsubscribeHeaders } from "../_shared/notify/index.ts";
import { type Due, message } from "./messages.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
    const u = new URL(req.url).searchParams.get("u") ?? "";
    if (u) {
        if (!/^[0-9a-f]{64}$/.test(u)) return fail("Unknown link", 404);
        if (req.method === "GET") return new Response(null, { status: 302, headers: { Location: `${SITE_URL()}/pledge/${u}` } });
        const { error } = await admin().from("pledges").update({ reminders_paused: true }).eq("pay_token", u);
        if (error) throw error;
        return json({ unsubscribed: true });
    }
    const b = (await req.json().catch(() => ({}))) as { org_id?: string };
    if (b.org_id !== undefined && !UUID.test(b.org_id)) return fail("org_id must be a uuid");
    const secret = Deno.env.get("CRON_SECRET");
    const cron = !!secret && req.headers.get("x-cron-secret") === secret;
    if (!cron) {
        if (!b.org_id) return fail("org_id is required");
        const { data: ok } = await asUser(req).rpc("has_role", { org: b.org_id, min: "editor" });
        if (ok !== true) return fail("Only the charity's team can run recovery", 403);
    }
    const db = admin(), org = b.org_id ?? null;
    const { data: scheduled, error: e1 } = await db.rpc("pledge_recovery_schedule", { org });
    if (e1) throw e1;
    const { data: due, error: e2 } = await db.rpc("pledge_reminders_claim", { org });
    if (e2) throw e2;
    const rows = (due ?? []) as Due[], fn = `${env("SUPABASE_URL")}/functions/v1/pledge-recovery`;
    const { data: orgs } = rows.length ? await db.from("pledge_reminders").select("id, orgs(contact_email)").in("id", rows.map((r) => r.id)) : { data: [] };
    const reply = new Map((orgs ?? []).map((x: { id: string; orgs: { contact_email?: string } | { contact_email?: string }[] | null }) => [x.id, (Array.isArray(x.orgs) ? x.orgs[0] : x.orgs)?.contact_email || undefined]));
    const n = await drain(rows, (r) => {
        const m = message(r, SITE_URL());
        return m?.channel === "email" ? { ...m, fromName: r.org_name, replyTo: reply.get(r.id), headers: unsubscribeHeaders(`${fn}?u=${r.pay_token}`) } : m;
    }, async (id, m) => { await db.from("pledge_reminders").update(m).eq("id", id); });
    return json({ scheduled: scheduled ?? 0, ...n });
});
