// Webhook signing and retry timing. No Deno or database, so the same code runs under deno test and vitest (tests/headless-api.test.ts).
//
// Every delivery is a POST of the event JSON with:
//   Outgive-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(endpoint secret, "<t>.<raw body>")>
//   Outgive-Event: donation.succeeded    Outgive-Event-Id: <event id>    Outgive-Delivery: <delivery id>
// Receivers recompute v1 over the raw body and reject a t older than five minutes (verify below), so a captured request cannot be replayed.

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

export const hmac = async (secret: string, msg: string) => {
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
};

export const sign = async (secret: string, body: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${await hmac(secret, `${t}.${body}`)}`;

/** What a receiver does. True when the header is ours, for this body, and at most `tolerance` seconds old. */
export const verify = async (secret: string, body: string, header: string, now = Math.floor(Date.now() / 1000), tolerance = 300) => {
    const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
    const t = Number(parts.t);
    if (!Number.isInteger(t) || !parts.v1 || Math.abs(now - t) > tolerance) return false;
    const want = await hmac(secret, `${t}.${body}`);
    // Constant time: compare every character.
    let diff = want.length ^ parts.v1.length;
    for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ (parts.v1.charCodeAt(i) || 0);
    return diff === 0;
};

/** Seconds to wait after failed attempt n (1-based): 1 min, 5 min, 30 min, 2 h, 6 h, 12 h, 24 h. Null after the 8th: give up (about two days in all). */
export const RETRY = [60, 300, 1800, 7200, 21600, 43200, 86400] as const;
export const backoff = (attempt: number): number | null => (attempt >= 1 && attempt <= RETRY.length ? RETRY[attempt - 1] : null);

export type Outcome = { ok: boolean; http: number | null; error: string | null };
/** The delivery row after an attempt: succeeded on any 2xx; otherwise pending with the next try, or failed for good. */
export const after = (attempts: number, o: Outcome, now = Date.now()) => {
    const n = attempts + 1, wait = o.ok ? null : backoff(n);
    return {
        attempts: n, last_status: o.http, last_error: o.ok ? null : (o.error ?? `HTTP ${o.http}`).slice(0, 300), last_at: new Date(now).toISOString(),
        status: o.ok ? "succeeded" : wait === null ? "failed" : "pending",
        next_at: new Date(now + (wait ?? 0) * 1000).toISOString(),
    };
};
