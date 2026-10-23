// Shared by every edge function: clients, CORS and a JSON helper. Secrets come from `supabase secrets set` (see docs/RUNBOOK.md).
import Stripe from "npm:stripe@22.6.2";
import { createClient } from "jsr:@supabase/supabase-js@2";

export const env = (k: string) => { const v = Deno.env.get(k); if (!v) throw new Error(`Missing secret ${k}`); return v; };

export const stripe = () => new Stripe(env("STRIPE_SECRET_KEY"), { httpClient: Stripe.createFetchHttpClient() });

/** Service role: bypasses RLS. Only for the webhook and for writes the user is not allowed to make directly. */
export const admin = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
/** The caller's own session, so RLS and auth.uid() apply. */
export const asUser = (req: Request) => createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
export const fail = (message: string, status = 400) => json({ error: message }, status);

/** Wraps a handler with CORS preflight and error reporting. */
export const serve = (handler: (req: Request) => Promise<Response>) =>
    Deno.serve(async (req) => {
        if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
        try { return await handler(req); } catch (e) { console.error(e); return fail((e as Error).message ?? "Something went wrong", 500); }
    });

export const SITE_URL = () => Deno.env.get("SITE_URL") ?? "https://outgive.org";
