// Outgive's public REST API, v1 (headless donations). Spec: GET /v1/openapi.json (openapi.ts). Reached at
//   https://<project>.supabase.co/functions/v1/api/v1/<resource>
// Auth: Authorization: Bearer sk_… (secret; everything) or pk_… (publishable; /me and /checkout_sessions only). Keys are made on the
// Headless API screen and checked by api_auth() (hashed, revocable, 100 requests a minute per key). A key works only in its own mode:
// test keys against test Stripe keys, live against live.
// Reads come from the SQL API (api_list / api_get), so a donation has the same shape here and in webhook payloads.
// POST /v1/donations hands the gift to the pay function (the payment service), so no payment code lives here. Its Idempotency-Key
// becomes pay's attempt_key, which pay already turns into one donation row and one provider charge.
// verify_jwt is off (config.toml): callers send their API key, not a Supabase JWT.
import { admin, env, SITE_URL } from "../_shared/deps.ts";
import { isDirect } from "../_shared/payments/stripe.ts";
import { type ErrType, EVENTS, type IntentBody, IDEM, LISTS, type List, attemptKey, bearer, checkoutUrl, decodeCursor, err, keyShape, page, parseLimit, route, toStart } from "./logic.ts";
import { spec } from "./openapi.ts";

const PER_MINUTE = 100;
const HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, idempotency-key", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Content-Type": "application/json" };
const out = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
const no = (status: number, type: ErrType, message: string, extra?: Record<string, string>) => out(err(type, message), status, extra);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODE = () => (Deno.env.get("STRIPE_SECRET_KEY")?.startsWith("sk_live") ? "live" : "test");
type Key = { key_id: string; org_id: string; kind: "secret" | "publishable"; mode: "test" | "live"; limited: boolean; remaining: number };
type DB = ReturnType<typeof admin>;

const body = async <T,>(req: Request): Promise<T | null> => { try { return (await req.json()) as T; } catch { return null; } };

const list = async (db: DB, k: Key, kind: List, q: URLSearchParams) => {
    const limit = parseLimit(q.get("limit")), cur = decodeCursor(q.get("cursor"));
    if (limit === null) return no(400, "invalid_request", "limit must be a whole number from 1 to 100");
    if (cur === "bad") return no(400, "invalid_request", "cursor is not valid; pass next_cursor from the previous page");
    const since = q.get("since"), status = q.get("status");
    if (since && Number.isNaN(Date.parse(since))) return no(400, "invalid_request", "since must be an ISO date-time");
    const { data, error } = await db.rpc("api_list", { org: k.org_id, kind, cur_ts: cur?.ts ?? null, cur_id: cur?.id ?? null, lim: limit + 1, f: { ...(since ? { since } : {}), ...(status ? { status } : {}) } });
    if (error) throw error;
    return out(page((data ?? []) as { id: string; created_at?: string }[], limit));
};

/** A donation intent: the pay function's answer, with the connected account Stripe.js needs for a direct charge. */
const createDonation = async (req: Request, db: DB, k: Key) => {
    const idem = req.headers.get("idempotency-key");
    if (!idem || !IDEM.test(idem)) return no(400, "invalid_request", "Send an Idempotency-Key header (any unique string, up to 255 characters) with every new gift");
    const b = await body<IntentBody>(req);
    const s = toStart(b as IntentBody, k.org_id, await attemptKey(k.key_id, idem));
    if (typeof s === "string") return no(400, "invalid_request", s);
    const res = await fetch(`${env("SUPABASE_URL")}/functions/v1/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "", "cf-connecting-ip": req.headers.get("cf-connecting-ip") ?? "" },
        body: JSON.stringify(s),
    });
    const r = await res.json().catch(() => ({})) as { status?: string; id?: string; clientSecret?: string; redirectUrl?: string; delayed?: boolean; error?: unknown };
    if (!res.ok) {
        const message = typeof r.error === "string" ? r.error : "The payment service could not start this gift";
        return no(res.status === 409 ? 409 : res.status === 404 ? 404 : res.status >= 500 ? 502 : 400, res.status === 409 ? "conflict" : res.status === 404 ? "not_found" : res.status >= 500 ? "api_error" : "invalid_request", message);
    }
    let stripe_account: string | null = null;
    if (r.clientSecret && isDirect({}, s.currency)) {
        const { data } = await db.from("payment_accounts").select("external_id").eq("org_id", k.org_id).eq("provider", "stripe").maybeSingle();
        stripe_account = data?.external_id ?? null;
    }
    return out({ object: "donation_intent", id: r.id || null, status: r.status, client_secret: r.clientSecret ?? null, redirect_url: r.redirectUrl ?? null, stripe_account, delayed: !!r.delayed, error: r.error ?? null });
};

/** Zapier REST Hooks: subscribe one URL to one event; the secret comes back for anyone who wants to check signatures. */
const subscribe = async (req: Request, db: DB, k: Key) => {
    const b = await body<{ target_url?: string; url?: string; event?: string }>(req);
    const url = b?.target_url ?? b?.url, ev = b?.event;
    if (!url || !/^https:\/\/[^\s/]+[^\s]*$/.test(url) || url.length > 500) return no(400, "invalid_request", "target_url must be an https URL");
    if (!ev || !(ev === "*" || (EVENTS as readonly string[]).includes(ev))) return no(400, "invalid_request", `event must be one of ${EVENTS.join(", ")}`);
    const { data, error } = await db.from("webhook_endpoints").insert({ org_id: k.org_id, url, events: [ev], source: "zapier", description: "Zapier" }).select("id, secret").single();
    if (error) throw error;
    return out({ id: data.id, object: "hook", event: ev, target_url: url, secret: data.secret }, 201);
};

const SAMPLE_OF: Record<string, [List, string | null]> = { "donation.succeeded": ["donations", "succeeded"], "donation.failed": ["donations", "failed"], "donation.refunded": ["donations", "refunded"], "donation.disputed": ["donations", "disputed"], "pledge.created": ["pledges", null], "pledge.paid": ["pledges", null], "receipt.sent": ["receipts", null] };

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });
    try {
        const url = new URL(req.url), r = route(url.pathname);
        if (!r) return no(404, "not_found", "Use /v1/... (see /v1/openapi.json)");
        const [res, id, more] = r, m = req.method;
        if (m === "GET" && res === "openapi.json") return out(spec(Deno.env.get("API_URL") ?? `${env("SUPABASE_URL")}/functions/v1/api/v1`));

        const token = bearer(req.headers.get("authorization")), shape = token ? keyShape(token) : null;
        if (!token || !shape) return no(401, "authentication", "Send your API key as Authorization: Bearer sk_test_...");
        const db = admin();
        const { data: k, error } = await db.rpc("api_auth", { k: token, per_minute: PER_MINUTE });
        if (error) throw error;
        const key = k as Key | null;
        if (!key) return no(401, "authentication", "This API key is not valid or has been revoked");
        const rate = { "X-RateLimit-Limit": String(PER_MINUTE), "X-RateLimit-Remaining": String(key.remaining) };
        if (key.limited) return no(429, "rate_limited", `More than ${PER_MINUTE} requests this minute. Try again shortly.`, { ...rate, "Retry-After": String(60 - new Date().getUTCSeconds()) });
        if (key.mode !== MODE()) return no(403, "permission", `This is a ${key.mode} key, and this is Outgive's ${MODE()} environment. Use a ${MODE()} key.`);
        const publicOk = (m === "GET" && res === "me") || (m === "POST" && res === "checkout_sessions");
        if (key.kind !== "secret" && !publicOk) return no(403, "permission", "This needs a secret key (sk_...). Publishable keys can only call /me and /checkout_sessions.");

        const send = async () => {
            if (m === "GET" && res === "me" && !id) {
                const { data: o } = await db.from("orgs").select("id, name, slug").eq("id", key.org_id).single();
                return out({ object: "account", ...o, mode: key.mode });
            }
            if ((LISTS as readonly string[]).includes(res) && m === "GET") {
                if (!id) return list(db, key, res as List, url.searchParams);
                if (res === "donors" || !UUID.test(id) || more) return no(404, "not_found", "Not found");
                const { data: o, error: e } = await db.rpc("api_get", { org: key.org_id, kind: res, oid: id });
                if (e) throw e;
                return o ? out(o) : no(404, "not_found", `No ${res.slice(0, -1)} ${id}`);
            }
            if (m === "POST" && res === "donations" && !id) return createDonation(req, db, key);
            if (m === "POST" && res === "checkout_sessions" && !id) {
                const b = (await body<{ amount_cents?: number; fund?: string; layout?: string }>(req)) ?? {};
                const { data: o } = await db.from("orgs").select("slug").eq("id", key.org_id).single();
                return out({ object: "checkout_session", url: checkoutUrl(SITE_URL(), o!.slug, b) });
            }
            if (res === "hooks") {
                if (m === "POST" && !id) return subscribe(req, db, key);
                if (m === "GET" && id === "sample") {
                    const [kind, status] = SAMPLE_OF[url.searchParams.get("event") ?? ""] ?? [];
                    if (!kind) return no(400, "invalid_request", `event must be one of ${EVENTS.join(", ")}`);
                    const { data: rows, error: e } = await db.rpc("api_list", { org: key.org_id, kind, lim: 3, f: status ? { status } : {} });
                    if (e) throw e;
                    return out(rows ?? []);
                }
                if (m === "DELETE" && id && UUID.test(id)) {
                    const { data: gone } = await db.from("webhook_endpoints").delete().eq("id", id).eq("org_id", key.org_id).select("id");
                    return gone?.length ? out({ id, object: "hook", deleted: true }) : no(404, "not_found", "No such hook");
                }
            }
            return no(404, "not_found", `${m} /v1/${r.join("/")} is not part of the API (see /v1/openapi.json)`);
        };
        const resp = await send();
        for (const [h, v] of Object.entries(rate)) resp.headers.set(h, v);
        return resp;
    } catch (e) {
        console.error(e);
        return no(500, "api_error", "Something went wrong on our side. It is safe to retry with the same Idempotency-Key.");
    }
});
