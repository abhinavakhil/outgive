// A real Postgres (PGlite) with the Supabase bits the migration relies on, so the schema and its SQL API can be tested without Docker.
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

export const MIGRATIONS = path.resolve("supabase/migrations");

/** Just enough of Supabase: the auth schema, auth.uid() reading the JWT claim, and the three API roles. */
const SUPABASE_STUB = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
`;

export const migrate = async (db: PGlite) => {
    await db.exec(SUPABASE_STUB);
    for (const f of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(path.join(MIGRATIONS, f), "utf8"));
};

export const fresh = async () => { const db = new PGlite(); await migrate(db); return db; };

/** Runs `fn` as a signed-in user (or anon when uid is null), the way PostgREST does: role switch plus the JWT claim. */
export const as = async <T>(db: PGlite, uid: string | null, fn: () => Promise<T>) => {
    await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
    try { return await fn(); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
};

export const signUp = async (db: PGlite, email: string) => (await db.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email])).rows[0].id;
