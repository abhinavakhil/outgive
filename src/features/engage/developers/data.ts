/**
 * The Headless API screen's data. Live: developers_get and friends (migration 20261128500000), and webhook-deliver to send a test or
 * replay at once. Demo (ws.sample): a small in-memory sample, so every button works and nothing is sent anywhere.
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import { useWorkspace } from "../shell/workspace";
import type { ApiKey, Delivery, Developers, Endpoint, KeyKind } from "./model";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const HOOK = "https://hopefoundation.org/hooks/outgive";
const sample = (): Developers => ({
    keys: [
        { id: "k1", kind: "publishable", mode: "test", name: "Website", hint: "pk_test_…a21c", token: "pk_test_51ad0c3e9b7f42d18a6e0b4c3f9d2e71a5b8c6d4e2f0a21c", created_at: ago(60 * 24 * 12), last_used_at: ago(3), revoked_at: null },
        { id: "k2", kind: "secret", mode: "test", name: "Mosque app", hint: "sk_test_…3f9a", token: null, created_at: ago(60 * 24 * 12), last_used_at: ago(2), revoked_at: null },
    ],
    endpoints: [{ id: "e1", url: HOOK, events: ["donation.succeeded", "pledge.created", "pledge.paid", "receipt.sent"], secret: "whsec_8c1f0e6a2b9d4c7e5f3a1b0c9d8e7f6a", description: "", source: "dashboard", active: true, created_at: ago(60 * 24 * 10) }],
    deliveries: ([["donation.succeeded", 2, 200, 1], ["pledge.paid", 14, 200, 1], ["receipt.sent", 14, 200, 1], ["donation.succeeded", 62, 500, 3], ["pledge.created", 180, 200, 1]] as const).map(([type, min, code, n], i) => ({
        id: `d${i}`, endpoint_id: "e1", url: HOOK, type, event_id: `ev${i}`, status: code === 200 ? "succeeded" : "pending", attempts: n, last_status: code,
        last_error: code === 200 ? null : "HTTP 500", last_at: ago(min), next_at: ago(-25), created_at: ago(min),
    })),
    stripe: true, ads: { opt_in: true, ga4: true, meta: false }, imports: 1,
});
let demo: Developers | undefined;
const rand = (n: number) => [...crypto.getRandomValues(new Uint8Array(n / 2))].map((b) => b.toString(16).padStart(2, "0")).join("");

export type Store = {
    state: "loading" | "ready" | "error" | "forbidden"; error?: string; d: Developers;
    createKey: (kind: KeyKind, name: string) => Promise<string>;
    revokeKey: (id: string) => Promise<void>;
    addEndpoint: (url: string, events: string[]) => Promise<void>;
    removeEndpoint: (id: string) => Promise<void>;
    test: (endpoint: string) => Promise<void>;
    replay: (delivery: string) => Promise<void>;
};

export const useDevelopers = (): Store => {
    const { db } = useApp();
    const ws = useWorkspace(), org = ws.org.id, admin = ws.role === "owner" || ws.role === "admin", mode = ws.mode === "live" ? "live" : "test";
    const [d, setD] = useState<Developers | null>(null);
    const [state, setState] = useState<Store["state"]>("loading");
    const [error, setError] = useState<string>();

    const load = useCallback(async () => {
        if (ws.sample) { setD({ ...(demo ??= sample()) }); setState("ready"); return; }
        if (!admin) { setState("forbidden"); return; }
        try { setD(await db.rpc<Developers>("developers_get", { org })); setState("ready"); } catch (e) { setError((e as Error).message); setState("error"); }
    }, [db, org, admin, ws.sample]);
    useEffect(() => { void load(); }, [load]);

    /** Live: change, then reload. Demo: change the sample. */
    const run = async <T,>(live: () => Promise<T>, local: (s: Developers) => T): Promise<T> => {
        if (ws.sample) { const r = local(demo!); setD({ ...demo! }); return r; }
        const r = await live(); await load(); return r;
    };
    /** Live: ask webhook-deliver to send what is due now instead of waiting for the cron. */
    const deliverNow = () => db.fn("webhook-deliver", { org_id: org }).catch(() => undefined);
    const queue = (s: Developers, ep: Endpoint, type: string) => s.deliveries.unshift({ id: `d${Date.now()}`, endpoint_id: ep.id, url: ep.url, type, event_id: `ev${Date.now()}`, status: "pending", attempts: 0, last_status: null, last_error: null, last_at: null, next_at: new Date().toISOString(), created_at: new Date().toISOString() });

    return {
        state, error, d: d ?? sample(),
        createKey: (kind, name) => run(
            async () => (await db.rpc<{ key: string }>("api_key_create", { org, k_kind: kind, k_mode: mode, k_name: name })).key,
            (s) => {
                const key = `${kind === "secret" ? "sk" : "pk"}_test_${rand(48)}`;
                s.keys.unshift({ id: `k${Date.now()}`, kind, mode: "test", name, hint: `${key.slice(0, 8)}…${key.slice(-4)}`, token: kind === "publishable" ? key : null, created_at: new Date().toISOString(), last_used_at: null, revoked_at: null } satisfies ApiKey);
                return key;
            }),
        revokeKey: (id) => run(async () => { await db.rpc("api_key_revoke", { org, key: id }); }, (s) => { s.keys = s.keys.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k)); }),
        addEndpoint: (url, events) => run(async () => { await db.rpc("webhook_save", { org, p: { url, events } }); }, (s) => {
            s.endpoints.push({ id: `e${Date.now()}`, url, events, secret: `whsec_${rand(32)}`, description: "", source: "dashboard", active: true, created_at: new Date().toISOString() });
        }),
        removeEndpoint: (id) => run(async () => { await db.rpc("webhook_delete", { org, endpoint: id }); }, (s) => { s.endpoints = s.endpoints.filter((e) => e.id !== id); s.deliveries = s.deliveries.filter((x) => x.endpoint_id !== id); }),
        test: (id) => run(async () => { await db.rpc("webhook_test", { org, endpoint: id }); await deliverNow(); }, (s) => { const ep = s.endpoints.find((e) => e.id === id); if (ep) queue(s, ep, "webhook.test"); }),
        replay: (id) => run(async () => { await db.rpc("webhook_replay", { org, delivery: id }); await deliverNow(); }, (s) => {
            s.deliveries = s.deliveries.map((x): Delivery => (x.id === id ? { ...x, status: "pending", attempts: 0, last_error: null, next_at: new Date().toISOString() } : x));
        }),
    };
};
