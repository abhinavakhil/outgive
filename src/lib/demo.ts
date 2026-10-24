/**
 * Demo mode: the real schema on PGlite (Postgres compiled to WASM) inside the browser, persisted to IndexedDB, with a sample charity.
 * Loaded only when no Supabase keys are configured. The visitor acts as the sample charity's owner, so recording a gift works.
 */
import init from "../../supabase/migrations/20261023000000_init.sql?raw";
import storage from "../../supabase/migrations/20261023000001_storage.sql?raw";
import type { PGlite } from "@electric-sql/pglite";
import type { DB } from "@/lib/db";
import type { DonationRow, Org, User } from "@/lib/types";
import { DEFAULT_BRAND, SAMPLE_PAGE, SUPPORTERS, type Supporter } from "@/data";

export const DEMO_USER: User = { id: "00000000-0000-4000-8000-000000000001", email: "demo@outgive.org", name: "Demo organiser" };
export const DEMO_SLUG = "clearwell";
export const DATA_DIR = "idb://outgive-demo-v3";

const STUB = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;`;

const MIN = 60000; const DAY = 86400000;
/** name -> [weeks ago, USD] */
const HALL_WEEKS: Record<string, [number, number]> = { "Northfield Rotary": [1, 3120], "Amara Okafor": [2, 2890], "St Hilda's Primary": [3, 2415] };
const iso = (t: number) => new Date(t).toISOString();
const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** What a donor can fund from the phone give screen behind the live screen's QR code. Gifts of exactly these amounts are tagged with the item. */
export const DEMO_ITEMS = [{ label: "A water filter for one family", usd: 40 }, { label: "A handwashing station at a school", usd: 250 }, { label: "A hand-pump repair", usd: 600 }, { label: "A borehole for a village", usd: 6000 }];

/** Builds the sample charity so the board shows the same supporters as the original demo, with gifts dated to give each row its today, week, streak and recruited figures. */
export const seed = async (pg: Pick<PGlite, "query" | "exec">) => {
    await pg.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [DEMO_USER.id, DEMO_USER.email, { full_name: DEMO_USER.name }]);
    await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [DEMO_USER.id]);
    const org = (await pg.query<Org>("select * from org_create($1)", [{ slug: DEMO_SLUG, name: DEFAULT_BRAND.name, tagline: DEFAULT_BRAND.tagline, color: DEFAULT_BRAND.color, font: DEFAULT_BRAND.font, variant: DEFAULT_BRAND.variant, impact_usd: DEFAULT_BRAND.impact?.usd, impact_unit: DEFAULT_BRAND.impact?.unit, currency: "USD", country: "Kenya", registration_number: "CT-20418 (sample)", description: "Clean water for 40 villages in Kitui county." }])).rows[0];
    await pg.query("update orgs set verified = true, live = $2 where id = $1", [org.id, { layout: "classic", goal_usd: 200000, items: DEMO_ITEMS }]);
    const s = SAMPLE_PAGE;
    const camp = (await pg.query<{ id: string }>("select * from page_create($1)", [{ org_id: org.id, type: s.type, slug: s.slug, title: s.title, org_name: s.org, country: s.country, goal_cents: s.goal * 100, currency: "USD", story: s.story, causes: s.causes, details: s.details, gifts: s.gifts, allocation: s.allocation, layout: s.layout }])).rows[0];
    await pg.query("update pages set created_at = $2, live = $3 where id = $1", [camp.id, iso(s.created), { layout: "impact", items: DEMO_ITEMS }]);
    for (const u of s.updates) await pg.query("insert into page_updates (page_id, author_id, title, body, created_at) values ($1, $2, $3, $4, $5)", [camp.id, DEMO_USER.id, u.title, u.body, iso(u.at)]);
    const now = Date.now(); const monday = new Date(now); monday.setUTCHours(0, 0, 0, 0); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const gift = (page: string | null, supporter: string | null, name: string, usd: number, at: number, message = "") =>
        pg.query("insert into donations (org_id, page_id, supporter_id, donor_name, amount_cents, currency, status, source, message, cause, created_at) values ($1, $2, $3, $4, $5, 'USD', 'succeeded', 'demo', $6, $7, $8)", [org.id, page, supporter, name, Math.max(1, Math.round(usd * 100)), message, DEMO_ITEMS.find((i) => i.usd === usd)?.label ?? "", iso(at)]);
    for (const o of SUPPORTERS as Supporter[]) {
        const joined = now - o.days * DAY;
        let pageId: string | null = null; let sid: string;
        if (o.kind === "Individuals" || o.kind === "Teams") {
            const p = (await pg.query<{ id: string; supporter_id: string }>("select * from page_create($1)", [{ org_id: org.id, type: o.kind === "Teams" ? "team" : "fundraiser", slug: slugOf(o.name), title: o.name, org_name: DEFAULT_BRAND.name, country: o.country, parent_id: camp.id, goal_cents: Math.round(o.total * 1.4) * 100, currency: "USD", story: `<p>${o.tagline}.</p>`, layout: o.kind === "Teams" ? "leaderboard" : "classic" }])).rows[0];
            pageId = p.id; sid = p.supporter_id;
            await pg.query("update pages set created_at = $2 where id = $1", [p.id, iso(joined)]);
        } else {
            sid = (await pg.query<{ id: string }>("insert into supporters (org_id, name, kind) values ($1, $2, $3) returning id", [org.id, o.name, o.kind])).rows[0].id;
        }
        await pg.query("update supporters set tagline = $2, region = $3, country = $4, visits = $5, created_at = $6, match_cap_cents = $7, user_id = null where id = $1", [sid, o.tagline, o.region, o.country, o.visits, iso(joined), o.match ? o.match * 100 : null]);
        // Friends recruited through the page: small named gifts in the past.
        let left = o.total;
        const friends = pageId ? Math.min(o.recruited, Math.floor(left / 10)) : 0;
        for (let k = 0; k < friends; k++) { await gift(pageId, sid, `Supporter ${k + 1}`, 5, joined + ((k * 37) % Math.max(1, o.days)) * DAY + k * MIN); left -= 5; }
        // Today and the rest of this week.
        const today = Math.min(o.today, left); if (today > 0) { await gift(pageId, sid, o.name, today, now - (((Number(o.id) * 7) % 50) + 3) * MIN); left -= today; }
        const weekRest = Math.min(Math.max(0, o.week - o.today), left); const weekAt = monday.getTime() + 9 * 3600000;
        if (weekRest > 0 && weekAt < now - 2 * MIN) { await gift(pageId, sid, o.name, weekRest, weekAt + Number(o.id) * MIN); left -= weekRest; }
        // One gift per month of the streak, then whatever is left on the day they joined.
        // Past weekly winners for the hall of fame: part of their total, given in an earlier week.
        const hall = HALL_WEEKS[o.name]; if (hall && left > hall[1]) { await gift(pageId, sid, o.name, hall[1], monday.getTime() - hall[0] * 7 * DAY + 2 * DAY); left -= hall[1]; }
        for (let m = 1; m < o.streak && left > 1; m++) { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() - m, 15); const usd = Math.min(left - 1, Math.max(1, Math.round(left / (o.streak - m + 1)))); await gift(pageId, sid, o.name, usd, d.getTime()); left -= usd; }
        if (left > 0) await gift(pageId, sid, o.name, left, joined + 2 * 3600000);
    }
    for (const d of s.donations) await gift(camp.id, null, d.name, d.usd, d.at, d.message);
};

/** Runs inside the worker, next to Postgres: creates the schema and seeds the sample charity on first start, in one transaction. */
export const prepare = async (pg: PGlite) => {
    const ready = (await pg.query<{ ok: boolean }>("select exists (select 1 from pg_tables where tablename = 'orgs') as ok")).rows[0].ok;
    if (!ready) await pg.transaction(async (tx) => { await tx.exec(STUB); await tx.exec(init); await tx.exec(storage); await seed(tx as unknown as PGlite); });
};

export const demoDb = async (): Promise<DB> => {
    // One Postgres shared by every tab (see demo-worker.ts). Each query is a message; the worker answers by id.
    // Both constructor calls spell out `new URL(...)` so Vite emits the worker as its own chunk in the production build.
    const port: MessagePort | Worker = typeof SharedWorker !== "undefined"
        ? new SharedWorker(new URL("./demo-worker.ts", import.meta.url), { type: "module", name: "outgive-demo" }).port
        : new Worker(new URL("./demo-worker.ts", import.meta.url), { type: "module" });
    const pending = new Map<number, { resolve: (rows: unknown[]) => void; reject: (e: Error) => void }>();
    let seq = 0;
    port.onmessage = (e: MessageEvent<{ id: number; rows?: unknown[]; error?: string }>) => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.error !== undefined ? p.reject(new Error(e.data.error)) : p.resolve(e.data.rows ?? []); };
    if ("start" in port) port.start();
    const pg = { query: <T,>(sql: string, params: unknown[] = []) => new Promise<{ rows: T[] }>((resolve, reject) => { const id = ++seq; pending.set(id, { resolve: (rows) => resolve({ rows: rows as T[] }), reject }); port.postMessage({ id, sql, params }); }) };
    await pg.query("select 1"); // surfaces a start-up failure on the splash instead of on the first screen
    const setof = new Map<string, boolean>();
    const isSetof = async (name: string) => { if (!setof.has(name)) setof.set(name, (await pg.query<{ proretset: boolean }>("select proretset from pg_proc where proname = $1 limit 1", [name])).rows[0]?.proretset ?? false); return setof.get(name)!; };
    const donationListeners = new Set<(d: DonationRow) => void>(); const orgListeners = new Set<(o: Org) => void>();
    // Realtime across tabs: BroadcastChannel stands in for Supabase Realtime.
    const bus = new BroadcastChannel("outgive-demo");
    const emit = (type: "donation" | "org" | "page", data: unknown) => { bus.postMessage({ type, data }); dispatch(type, data); };
    const dispatch = (type: string, data: unknown) => { if (type === "donation") donationListeners.forEach((cb) => cb(data as DonationRow)); else if (type === "org") orgListeners.forEach((cb) => cb(data as Org)); };
    bus.onmessage = (e: MessageEvent<{ type: string; data: unknown }>) => dispatch(e.data.type, e.data.data);
    const emitOrg = async (id: string) => { const o = (await pg.query<Org>("select * from orgs where id = $1", [id])).rows[0]; if (o) emit("org", o); };
    const rpc = async <T,>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
        const keys = Object.keys(args);
        const params = keys.map((k) => (typeof args[k] === "object" && args[k] !== null ? JSON.stringify(args[k]) : args[k]));
        const call = `${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})`;
        try {
            const data = (await isSetof(name))
                ? (await pg.query<{ v: T }>(`select to_jsonb(x) as v from ${call} x`, params)).rows.map((r) => r.v) as T
                : (await pg.query<{ v: T }>(`select to_jsonb(${call}) as v`, params)).rows[0]?.v as T;
            if (name === "donation_record" && data) emit("donation", data);
            if (name === "org_update" && data) emit("org", data);
            if (name === "page_update" && data) emit("page", data);
            return data;
        } catch (e) { throw new Error((e as Error).message.replace(/^error: /, "")); }
    };
    return {
        mode: "demo", rpc,
        user: async () => DEMO_USER,
        onAuth: () => () => {},
        signInEmail: async () => {}, signInGoogle: async () => {}, signOut: async () => {},
        onDonations: (_org, cb) => { donationListeners.add(cb); return () => donationListeners.delete(cb); },
        onOrg: (_org, cb) => { orgListeners.add(cb); return () => orgListeners.delete(cb); },
        fn: async <T,>(name: string, body: Record<string, unknown>): Promise<T> => {
            if (name === "checkout") {
                // No card in the demo: the gift is recorded straight away as a demo gift.
                // Same tip and fee maths as the real checkout, so the receipt page shows what would have been charged.
                const { breakdown } = await import("@/lib/money");
                const m = breakdown(Number(body.amount_cents), { tipPct: Number(body.tip_pct) || 0, cover: !!body.cover });
                const d = await rpc<DonationRow>("donation_record", { p: { ...body, tip_cents: m.tip, cover_cents: m.cover, source: "demo" } });
                return { url: `/thanks?demo=1&donation=${d.id}`, donation: d } as T;
            }
            if (name === "connect") { const o = await rpc<Org>("org_update", { org: body.org_id, p: {} }); await pg.query("update orgs set stripe_account_id = 'acct_demo', stripe_charges_enabled = true, stripe_payouts_enabled = true where id = $1", [o.id]); await emitOrg(o.id); return { url: "", demo: true } as T; }
            throw new Error(`No demo for function ${name}`);
        },
        upload: (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("Could not read the file")); r.readAsDataURL(file); }),
    };
};

/** Wipes the browser copy of the demo so the next load reseeds it. */
export const resetDemo = async () => { for (const v of ["v1", "v2", "v3"]) { indexedDB.deleteDatabase(`/pglite/outgive-demo-${v}`); indexedDB.deleteDatabase(`outgive-demo-${v}`); } };
