/**
 * The one door to data. Every read and write is a SQL function in supabase/migrations (the SQL API), called by name.
 * With VITE_SUPABASE_URL set it runs against Supabase (PostgREST RPC, Auth, Realtime, Storage, Edge Functions).
 * Without it, the same schema runs inside the browser on PGlite with a sample charity, so the public demo and local
 * development need no backend at all. ponytail: demo mode has no RLS and one fixed user; it is a demo, not a sandbox.
 */
import type { DonationRow, Org, User } from "@/lib/types";

export type Unsub = () => void;
export interface DB {
    mode: "supabase" | "demo";
    rpc: <T = unknown>(name: string, args?: Record<string, unknown>) => Promise<T>;
    user: () => Promise<User | null>;
    onAuth: (cb: (u: User | null) => void) => Unsub;
    signInEmail: (email: string, redirect: string) => Promise<void>;
    signInGoogle: (redirect: string) => Promise<void>;
    signOut: () => Promise<void>;
    /** New or changed gifts for an org, as they land. */
    onDonations: (orgId: string, cb: (d: DonationRow) => void) => Unsub;
    /** Changes to the org row (brand, live state). */
    onOrg: (orgId: string, cb: (o: Org) => void) => Unsub;
    /** Edge functions: checkout, connect. */
    fn: <T = unknown>(name: string, body: Record<string, unknown>) => Promise<T>;
    upload: (file: File, path: string) => Promise<string>;
}

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;

const err = (e: unknown) => new Error(typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e));

const supabaseDb = async (): Promise<DB> => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    const toUser = (u: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null): User | null => u ? { id: u.id, email: u.email ?? "", name: String(u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split("@")[0] ?? "") } : null;
    return {
        mode: "supabase",
        rpc: async (name, args = {}) => { const { data, error } = await sb.rpc(name, args); if (error) throw err(error); return data; },
        user: async () => toUser((await sb.auth.getUser()).data.user),
        onAuth: (cb) => { const { data } = sb.auth.onAuthStateChange((_e, s) => cb(toUser(s?.user ?? null))); return () => data.subscription.unsubscribe(); },
        signInEmail: async (email, redirect) => { const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } }); if (error) throw err(error); },
        signInGoogle: async (redirect) => { const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect } }); if (error) throw err(error); },
        signOut: async () => { await sb.auth.signOut(); },
        onDonations: (orgId, cb) => {
            // Broadcast by the donations_broadcast trigger (public-safe fields only), so viewers who cannot read the table still see gifts land.
            const ch = sb.channel(`donations:${orgId}`, { config: { private: true } }).on("broadcast", { event: "donation" }, (m) => cb(m.payload as DonationRow)).subscribe();
            return () => { sb.removeChannel(ch); };
        },
        onOrg: (orgId, cb) => {
            const ch = sb.channel(`org:${orgId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "orgs", filter: `id=eq.${orgId}` }, (p) => cb(p.new as Org)).subscribe();
            return () => { sb.removeChannel(ch); };
        },
        fn: async (name, body) => { const { data, error } = await sb.functions.invoke(name, { body }); if (error) { let msg = error.message; try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* plain error */ } throw new Error(msg); } return data; },
        upload: async (file, path) => { const { error } = await sb.storage.from("media").upload(path, file, { upsert: true, contentType: file.type }); if (error) throw err(error); return sb.storage.from("media").getPublicUrl(path).data.publicUrl; },
    };
};

let instance: Promise<DB> | null = null;
export const db = (): Promise<DB> => (instance ??= isDemo ? import("@/lib/demo").then((m) => m.demoDb()) : supabaseDb());
