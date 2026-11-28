// The public API's pure parts: routes, cursors, idempotency keys, errors and the donation-intent input. No Deno or database,
// so they run under deno test and vitest (tests/headless-api.test.ts).
import { type StartInput, validate } from "../pay/logic.ts";

export const LISTS = ["donations", "pledges", "receipts", "donors"] as const;
export type List = (typeof LISTS)[number];
export const EVENTS = ["donation.succeeded", "donation.failed", "donation.refunded", "donation.disputed", "pledge.created", "pledge.paid", "receipt.sent"] as const;

export type ErrType = "invalid_request" | "authentication" | "permission" | "not_found" | "conflict" | "rate_limited" | "api_error";
export const err = (type: ErrType, message: string) => ({ error: { type, message } });

/** "/functions/v1/api/v1/donations/abc" or "/api/v1/donations/abc" -> ["donations", "abc"]; null when it is not a /v1 path. */
export const route = (pathname: string): string[] | null => {
    const p = pathname.replace(/^(\/functions\/v1)?\/api(?=\/|$)/, "").replace(/\/+$/, "");
    if (!/^\/v1(\/|$)/.test(p)) return null;
    return p.split("/").slice(2).filter(Boolean).map(decodeURIComponent);
};

/** The key's own kind of secret: "sk_test_…" -> { kind: "secret", mode: "test" }. Null when it is not shaped like a key. */
export const keyShape = (k: string) => {
    const m = /^(pk|sk)_(test|live)_[0-9a-f]{48}$/.exec(k);
    return m ? { kind: m[1] === "sk" ? "secret" as const : "publishable" as const, mode: m[2] as "test" | "live" } : null;
};
export const bearer = (h: string | null) => /^Bearer\s+(\S+)$/i.exec(h ?? "")?.[1] ?? null;

// Cursors: the last row's created_at and id, base64url, opaque to callers.
const b64 = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
export const encodeCursor = (ts: string, id: string) => b64(JSON.stringify([ts, id]));
export const decodeCursor = (c: string | null): { ts: string; id: string } | null | "bad" => {
    if (!c) return null;
    try {
        const [ts, id] = JSON.parse(unb64(c));
        return typeof ts === "string" && !Number.isNaN(Date.parse(ts)) && typeof id === "string" && id.length <= 200 ? { ts, id } : "bad";
    } catch { return "bad"; }
};
export const parseLimit = (v: string | null) => {
    if (v === null) return 25;
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 100 ? n : null;
};
type Row = { id: string; created_at?: string; last_gift_at?: string };
/** rows were fetched with limit + 1: the extra one only says there is more. Donors page by their latest gift, the rest by created_at. */
export const page = <T extends Row>(rows: T[], limit: number) => {
    const data = rows.slice(0, limit), more = rows.length > limit, last = data[data.length - 1];
    return { object: "list" as const, data, has_more: more, next_cursor: more ? encodeCursor((last.last_gift_at ?? last.created_at)!, last.id) : null };
};

/** Idempotency-Key -> the pay function's attempt_key. Scoped to the API key, so two charities can use the same idempotency key. */
export const attemptKey = async (keyId: string, idem: string) => {
    const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${keyId}:${idem}`));
    return "api_" + [...new Uint8Array(h)].slice(0, 20).map((x) => x.toString(16).padStart(2, "0")).join("");
};
export const IDEM = /^[\x21-\x7e]{1,255}$/;

/** POST /v1/donations body. The org always comes from the key; everything else is checked by the pay function's own validate. */
export interface IntentBody {
    amount_cents: number; currency?: string; method?: StartInput["method"]; frequency?: "once" | "monthly" | "yearly";
    cover_cents?: number; tip_cents?: number; fund?: string; page_id?: string;
    donor?: { name?: string; email?: string; anonymous?: boolean }; dedication?: string;
    tags?: Record<string, unknown>; metadata?: Record<string, unknown>;
}
export const toStart = (b: IntentBody, org_id: string, attempt_key: string): StartInput | string => {
    if (!b || typeof b !== "object") return "The body must be a JSON object";
    if (b.page_id !== undefined && !/^[0-9a-f-]{36}$/i.test(b.page_id)) return "page_id must be a uuid";
    const s: StartInput = {
        action: "start", attempt_key, org_id, page_id: b.page_id, method: b.method ?? "card", currency: (b.currency ?? "USD").toUpperCase(), freq: b.frequency ?? "once",
        amount_cents: b.amount_cents, cover_cents: b.cover_cents, tip_cents: b.tip_cents ?? 0, fund: b.fund,
        donor_name: b.donor?.name, donor_email: b.donor?.email, anonymous: b.donor?.anonymous, dedication: b.dedication,
        // Gifts made through the API are tagged channel "api" unless the caller says otherwise; the database keeps known keys only.
        tags: { channel: "api", ...(b.tags ?? {}) }, details: b.metadata ? { metadata: b.metadata } : undefined,
    };
    if ((b.frequency as string) === "nights") return "frequency must be once, monthly or yearly";
    return validate(s) ?? s;
};

/** The hosted checkout (public/embed/v1.js serves the same page in an iframe), as a link the caller can redirect a donor to. */
export const checkoutUrl = (site: string, slug: string, b: { amount_cents?: number; fund?: string; layout?: string }) => {
    const q = new URLSearchParams({ embed: "1", charity: slug });
    if (b.layout) q.set("layout", b.layout);
    if (Number.isInteger(b.amount_cents) && b.amount_cents! >= 100) q.set("amount", String(b.amount_cents! / 100));
    if (b.fund) q.set("fund", b.fund);
    q.set("source", JSON.stringify({ channel: "api" }));
    return `${site.replace(/\/$/, "")}/checkout?${q}`;
};
