// Delivers the webhook outbox (migration 20261128500000): claims due deliveries, POSTs each signed event, records the result, and
// schedules a retry with backoff (logic.ts). A 410 Gone switches the endpoint off, as Zapier's REST Hooks expect when a Zap is turned off.
// Callers:
//   cron, every minute, and webhook_kick() straight after an event: POST, header x-cron-secret: $CRON_SECRET, empty body
//   the Headless API screen after "Send test" or "Replay": POST {org_id} with an admin's JWT
// verify_jwt is off (config.toml) so the cron can call it with only the secret; the admin path checks has_role itself.
import { admin, asUser, fail, json, serve } from "../_shared/deps.ts";
import { after, sign } from "./logic.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Due = { delivery_id: string; attempts: number; url: string; secret: string; source: string; endpoint_id: string; event: { id: string; type: string } };

const send = async (d: Due) => {
    const body = JSON.stringify(d.event), t0 = Date.now();
    try {
        const res = await fetch(d.url, {
            method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000),
            headers: { "Content-Type": "application/json", "User-Agent": "Outgive-Webhooks/1", "Outgive-Signature": await sign(d.secret, body), "Outgive-Event": d.event.type, "Outgive-Event-Id": d.event.id, "Outgive-Delivery": d.delivery_id },
            body,
        });
        await res.body?.cancel();
        return { ok: res.status >= 200 && res.status < 300, http: res.status, error: null, ms: Date.now() - t0 };
    } catch (e) {
        return { ok: false, http: null, error: (e as Error).name === "TimeoutError" ? "Timed out after 10 seconds" : (e as Error).message, ms: Date.now() - t0 };
    }
};

serve(async (req) => {
    const b = (await req.json().catch(() => ({}))) as { org_id?: string };
    if (b.org_id !== undefined && !UUID.test(b.org_id)) return fail("org_id must be a uuid");
    const secret = Deno.env.get("CRON_SECRET");
    if (!(secret && req.headers.get("x-cron-secret") === secret)) {
        if (!b.org_id) return fail("org_id is required");
        const { data: ok } = await asUser(req).rpc("has_role", { org: b.org_id, min: "admin" });
        if (ok !== true) return fail("Only the charity's admins can send webhooks", 403);
    }
    const db = admin();
    const { data, error } = await db.rpc("webhook_claim", { org: b.org_id ?? null, lim: 50 });
    if (error) throw error;
    const due = (data ?? []) as Due[];
    let sent = 0, failed = 0;
    // ponytail: 50 per run, 6 at a time; raise the batch or run more often if an org outgrows a minute's worth.
    for (let i = 0; i < due.length; i += 6) {
        await Promise.all(due.slice(i, i + 6).map(async (d) => {
            const o = await send(d);
            await db.from("webhook_deliveries").update({ ...after(d.attempts, o), duration_ms: o.ms }).eq("id", d.delivery_id);
            if (o.http === 410) await db.from("webhook_endpoints").update({ active: false }).eq("id", d.endpoint_id);
            o.ok ? sent++ : failed++;
        }));
    }
    return json({ claimed: due.length, sent, failed });
});
