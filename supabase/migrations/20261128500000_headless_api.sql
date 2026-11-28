-- Headless API: API keys, the public REST API's reads (edge function `api`), and webhooks (an outbox filled by triggers,
-- delivered and retried by edge function `webhook-deliver`). Zapier subscribes through the same endpoints table (REST Hooks).
-- Admins (has_role 'admin') manage keys and endpoints; the edge functions use the service role. Safe to run more than once.

-- ---------------------------------------------------------------- API keys
-- A key is <pk|sk>_<test|live>_<48 hex>. Only its sha256 is kept; the full key is returned once, by api_key_create.
-- Publishable keys are public (they go in page code), so they are also kept in `token` to show again; secret keys never are.
create table if not exists api_keys (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    kind text not null check (kind in ('publishable', 'secret')),
    mode text not null check (mode in ('test', 'live')),
    name text not null default '' check (length(name) <= 60),
    hash text not null unique,
    hint text not null,                                  -- sk_test_…3f9a, for the list
    token text,                                          -- publishable keys only
    created_by uuid references profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    last_used_at timestamptz,
    revoked_at timestamptz
);
create index if not exists api_keys_org on api_keys (org_id, created_at desc);
alter table api_keys enable row level security;

-- Requests per key per minute: a fixed window. ponytail: fixed windows allow a 2x burst across a minute boundary; use a sliding log if that matters.
create table if not exists api_rate (key_id uuid not null references api_keys (id) on delete cascade, minute timestamptz not null, n integer not null default 0, primary key (key_id, minute));
alter table api_rate enable row level security;

create or replace function api_key_hash(k text) returns text language sql immutable as $$ select encode(sha256(convert_to(coalesce(k, ''), 'UTF8')), 'hex') $$;

/** Makes a key and returns it in full, the only time it is ever shown. Admins only. */
create or replace function api_key_create(org uuid, k_kind text, k_mode text, k_name text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare k text; r api_keys;
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can manage API keys'; end if;
    if k_kind not in ('publishable', 'secret') or k_mode not in ('test', 'live') then raise exception 'Unknown key type'; end if;
    k := case k_kind when 'secret' then 'sk_' else 'pk_' end || k_mode || '_' || left(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 48);
    insert into api_keys (org_id, kind, mode, name, hash, hint, token, created_by)
    values (org, k_kind, k_mode, left(trim(coalesce(k_name, '')), 60), api_key_hash(k), left(k, 8) || '…' || right(k, 4), case when k_kind = 'publishable' then k end, auth.uid())
    returning * into r;
    return jsonb_build_object('id', r.id, 'key', k, 'hint', r.hint, 'kind', r.kind, 'mode', r.mode);
end $$;

create or replace function api_key_revoke(org uuid, key uuid) returns boolean language plpgsql security definer set search_path = public as $$
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can manage API keys'; end if;
    update api_keys set revoked_at = now() where id = key and org_id = org and revoked_at is null;
    return found;
end $$;

/**
 * The api function's door (service role): the key's org, kind and mode, and whether this request is over the per-minute limit.
 * Null for an unknown or revoked key. Counts the request and stamps last_used_at (at most once a minute).
 */
create or replace function api_auth(k text, per_minute integer default 100) returns jsonb language plpgsql security definer set search_path = public as $$
declare r api_keys; used integer; w timestamptz := date_trunc('minute', now());
begin
    select * into r from api_keys where hash = api_key_hash(k) and revoked_at is null;
    if not found then return null; end if;
    insert into api_rate as a (key_id, minute, n) values (r.id, w, 1) on conflict (key_id, minute) do update set n = a.n + 1 returning a.n into used;
    if used = 1 then delete from api_rate where key_id = r.id and minute < w; end if;
    update api_keys set last_used_at = now() where id = r.id and (last_used_at is null or last_used_at < now() - interval '1 minute');
    return jsonb_build_object('key_id', r.id, 'org_id', r.org_id, 'kind', r.kind, 'mode', r.mode, 'limited', used > per_minute, 'remaining', greatest(per_minute - used, 0));
end $$;

-- ---------------------------------------------------------------- the API's objects
-- One shape per object, used by the REST API and by webhook payloads alike, so a donation reads the same both ways.
create or replace function api_donation(d donations) returns jsonb language sql stable as $$
    select jsonb_build_object('id', d.id, 'object', 'donation', 'status', d.status, 'amount_cents', d.amount_cents, 'currency', d.currency,
        'cover_cents', d.cover_cents, 'tip_cents', d.tip_cents, 'fund', d.fund, 'recurring', d.recurring, 'method', d.pay_method, 'source', d.source,
        'donor', jsonb_build_object('name', d.donor_name, 'email', d.donor_email, 'anonymous', d.anonymous),
        'dedication', d.dedication, 'page_id', d.page_id, 'pledge_id', d.pledge_id, 'tags', d.tags, 'details', d.details, 'created_at', d.created_at)
$$;
create or replace function api_pledge(p pledges) returns jsonb language sql stable as $$
    select jsonb_build_object('id', p.id, 'object', 'pledge',
        'status', case when p.written_off then 'written_off' when p.paid_cents >= p.amount_cents then 'paid' when p.paid_cents > 0 then 'part_paid' else 'open' end,
        'amount_cents', p.amount_cents, 'paid_cents', p.paid_cents, 'currency', p.currency, 'event', p.event, 'due_date', p.due_date,
        'donor', jsonb_build_object('name', p.donor_name, 'email', p.donor_email, 'phone', p.donor_phone),
        'pay_path', '/pledge/' || p.pay_token, 'pledged_at', p.pledged_at, 'created_at', p.created_at)
$$;
create or replace function api_receipt(r receipts) returns jsonb language sql stable as $$
    select jsonb_build_object('id', r.id, 'object', 'receipt', 'kind', r.kind, 'number', r.number, 'year', r.year, 'donation_id', r.donation_id,
        'donor', jsonb_build_object('name', r.donor_name, 'email', r.donor_email), 'currency', r.currency, 'total_cents', r.total_cents,
        'deductible_cents', r.deductible_cents, 'fund', r.fund, 'lines', r.lines, 'irs_ack', r.irs_ack, 'dated', r.dated, 'sent_at', r.sent_at, 'created_at', r.created_at)
$$;

/**
 * One page of a charity's donations, pledges, receipts or donors, newest first (service role; the api function passes the key's org).
 * The cursor is the last row's (created_at, id); donors are keyed by email and currency and ordered by their latest gift.
 * f: {status, since} for donations.
 */
create or replace function api_list(org uuid, kind text, cur_ts timestamptz default null, cur_id text default null, lim integer default 25, f jsonb default '{}'::jsonb)
returns setof jsonb language plpgsql stable security definer set search_path = public as $$
begin
    lim := least(greatest(coalesce(lim, 25), 1), 101);
    if kind = 'donations' then return query
        select api_donation(d) from donations d where d.org_id = org and d.source <> 'demo'
          and (cur_ts is null or (d.created_at, d.id) < (cur_ts, cur_id::uuid))
          and (f ->> 'status' is null or d.status = f ->> 'status') and (f ->> 'since' is null or d.created_at >= (f ->> 'since')::timestamptz)
        order by d.created_at desc, d.id desc limit lim;
    elsif kind = 'pledges' then return query
        select api_pledge(p) from pledges p where p.org_id = org and (cur_ts is null or (p.created_at, p.id) < (cur_ts, cur_id::uuid))
        order by p.created_at desc, p.id desc limit lim;
    elsif kind = 'receipts' then return query
        select api_receipt(r) from receipts r where r.org_id = org and (cur_ts is null or (r.created_at, r.id) < (cur_ts, cur_id::uuid))
        order by r.created_at desc, r.id desc limit lim;
    elsif kind = 'donors' then return query
        select jsonb_build_object('id', x.k, 'object', 'donor', 'email', x.email, 'name', x.name, 'currency', x.currency, 'gift_count', x.n,
            'total_cents', x.total, 'first_gift_at', x.first_at, 'last_gift_at', x.last_at)
        from (select lower(d.donor_email) || ':' || d.currency as k, lower(d.donor_email) as email, (array_agg(d.donor_name order by d.created_at desc))[1] as name,
                d.currency, count(*) as n, sum(d.amount_cents) as total, min(d.created_at) as first_at, max(d.created_at) as last_at
              from donations d where d.org_id = org and d.status = 'succeeded' and d.donor_email is not null and d.source <> 'demo'
              group by lower(d.donor_email), d.currency) x
        where cur_ts is null or (x.last_at, x.k) < (cur_ts, cur_id)
        order by x.last_at desc, x.k desc limit lim;
    else raise exception 'Unknown list %', kind;
    end if;
end $$;

create or replace function api_get(org uuid, kind text, oid uuid) returns jsonb language sql stable security definer set search_path = public as $$
    select case kind
        when 'donations' then (select api_donation(d) from donations d where d.id = oid and d.org_id = org and d.source <> 'demo')
        when 'pledges' then (select api_pledge(p) from pledges p where p.id = oid and p.org_id = org)
        when 'receipts' then (select api_receipt(r) from receipts r where r.id = oid and r.org_id = org)
    end
$$;

-- ---------------------------------------------------------------- webhooks
-- An endpoint receives the events it lists ('*' = all), signed with its secret (webhook-deliver/logic.ts sign).
create table if not exists webhook_endpoints (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    url text not null check (url ~ '^https://[^\s/]+[^\s]*$' and length(url) <= 500),
    events text[] not null default '{*}',
    secret text not null default 'whsec_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    description text not null default '' check (length(description) <= 120),
    source text not null default 'dashboard' check (source in ('dashboard', 'zapier')),   -- zapier: made by a Zap's REST Hook subscribe
    active boolean not null default true,
    created_by uuid references profiles (id) on delete set null,
    created_at timestamptz not null default now()
);
create index if not exists webhook_endpoints_org on webhook_endpoints (org_id);
alter table webhook_endpoints enable row level security;

-- The outbox. One row per event, written by the triggers below in the same transaction as the change, so an event is never lost.
create table if not exists webhook_events (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    type text not null,
    data jsonb not null,
    created_at timestamptz not null default now()
);
create index if not exists webhook_events_org on webhook_events (org_id, created_at desc);
alter table webhook_events enable row level security;

-- One row per event and endpoint: the delivery log. 'sending' is a claim with a lease (next_at), so a crashed run is retried.
create table if not exists webhook_deliveries (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    event_id uuid not null references webhook_events (id) on delete cascade,
    endpoint_id uuid not null references webhook_endpoints (id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'sending', 'succeeded', 'failed')),
    attempts integer not null default 0,
    next_at timestamptz not null default now(),
    last_status integer,                                  -- the endpoint's HTTP status; null when it could not be reached
    last_error text,
    last_at timestamptz,
    duration_ms integer,
    created_at timestamptz not null default now(),
    unique (event_id, endpoint_id)
);
create index if not exists webhook_deliveries_due on webhook_deliveries (next_at) where status in ('pending', 'sending');
create index if not exists webhook_deliveries_org on webhook_deliveries (org_id, created_at desc);
alter table webhook_deliveries enable row level security;

/** Asks webhook-deliver to run now, when pg_net and the vault secrets project_url and cron_secret exist; otherwise the cron picks it up within a minute. */
create or replace function webhook_kick() returns void language plpgsql security definer set search_path = public as $$
declare u text; s text;
begin
    if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then return; end if;
    execute $q$select (select decrypted_secret from vault.decrypted_secrets where name = 'project_url'), (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')$q$ into u, s;
    if u is null or s is null then return; end if;
    execute 'select net.http_post(url := $1, headers := $2, body := $3)' using rtrim(u, '/') || '/functions/v1/webhook-deliver', jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s), '{}'::jsonb;
exception when others then raise warning 'webhook_kick: %', sqlerrm;
end $$;

/** Puts an event in the outbox for every active endpoint of the org that wants it. Nothing is written when no endpoint wants it. */
create or replace function webhook_emit(org uuid, t text, d jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare e uuid;
begin
    if not exists (select 1 from webhook_endpoints w where w.org_id = org and w.active and (t = any (w.events) or '*' = any (w.events))) then return null; end if;
    insert into webhook_events (org_id, type, data) values (org, t, d) returning id into e;
    insert into webhook_deliveries (org_id, event_id, endpoint_id)
    select org, e, w.id from webhook_endpoints w where w.org_id = org and w.active and (t = any (w.events) or '*' = any (w.events));
    perform webhook_kick();
    return e;
end $$;

-- The emitters. A webhook problem must never undo a payment, so each one swallows its own errors.
create or replace function webhook_on_donation() returns trigger language plpgsql security definer set search_path = public as $$
declare t text;
begin
    if new.source = 'demo' or (tg_op = 'UPDATE' and old.status = new.status) then return null; end if;
    t := case new.status when 'succeeded' then 'donation.succeeded' when 'refunded' then 'donation.refunded' when 'disputed' then 'donation.disputed'
        when 'failed' then 'donation.failed' end;
    if t is not null then perform webhook_emit(new.org_id, t, api_donation(new)); end if;
    return null;
exception when others then raise warning 'webhook_on_donation: %', sqlerrm; return null;
end $$;
drop trigger if exists donations_webhooks on donations;
create trigger donations_webhooks after insert or update of status on donations for each row execute function webhook_on_donation();

create or replace function webhook_on_pledge() returns trigger language plpgsql security definer set search_path = public as $$
begin
    if tg_op = 'INSERT' then perform webhook_emit(new.org_id, 'pledge.created', api_pledge(new));
    elsif old.paid_cents < old.amount_cents and new.paid_cents >= new.amount_cents then perform webhook_emit(new.org_id, 'pledge.paid', api_pledge(new));
    end if;
    return null;
exception when others then raise warning 'webhook_on_pledge: %', sqlerrm; return null;
end $$;
drop trigger if exists pledges_webhooks on pledges;
create trigger pledges_webhooks after insert or update of paid_cents on pledges for each row execute function webhook_on_pledge();

create or replace function webhook_on_receipt() returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.sent_at is not null and (tg_op = 'INSERT' or old.sent_at is null) then perform webhook_emit(new.org_id, 'receipt.sent', api_receipt(new)); end if;
    return null;
exception when others then raise warning 'webhook_on_receipt: %', sqlerrm; return null;
end $$;
drop trigger if exists receipts_webhooks on receipts;
create trigger receipts_webhooks after insert or update of sent_at on receipts for each row execute function webhook_on_receipt();

/** webhook-deliver (service role): due deliveries, claimed for two minutes, with what is needed to send them. org null = every org. */
create or replace function webhook_claim(org uuid default null, lim integer default 50)
returns table (delivery_id uuid, attempts integer, url text, secret text, source text, endpoint_id uuid, event jsonb) language sql security definer set search_path = public as $$
    with due as (
        select d.id from webhook_deliveries d join webhook_endpoints w on w.id = d.endpoint_id
        where d.status in ('pending', 'sending') and d.next_at <= now() and w.active and (org is null or d.org_id = org)
        order by d.next_at limit lim for update of d skip locked
    )
    update webhook_deliveries d set status = 'sending', next_at = now() + interval '2 minutes'
    from due, webhook_endpoints w, webhook_events v
    where d.id = due.id and w.id = d.endpoint_id and v.id = d.event_id
    returning d.id, d.attempts, w.url, w.secret, w.source, w.id, jsonb_build_object('id', v.id, 'object', 'event', 'type', v.type, 'created_at', v.created_at, 'data', v.data)
$$;

-- ---------------------------------------------------------------- the Headless API screen (admins)
/** Keys, endpoints (with their signing secrets), the last 50 deliveries, and what the integrations grid needs. */
create or replace function developers_get(org uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can see API keys and webhooks'; end if;
    return jsonb_build_object(
        'keys', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'kind', k.kind, 'mode', k.mode, 'name', k.name, 'hint', k.hint, 'token', k.token,
            'created_at', k.created_at, 'last_used_at', k.last_used_at, 'revoked_at', k.revoked_at) order by k.revoked_at nulls first, k.created_at desc) from api_keys k where k.org_id = org), '[]'::jsonb),
        'endpoints', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'url', w.url, 'events', w.events, 'secret', w.secret, 'description', w.description,
            'source', w.source, 'active', w.active, 'created_at', w.created_at) order by w.created_at) from webhook_endpoints w where w.org_id = org), '[]'::jsonb),
        'deliveries', coalesce((select jsonb_agg(x order by x ->> 'created_at' desc) from (
            select jsonb_build_object('id', d.id, 'endpoint_id', d.endpoint_id, 'url', w.url, 'type', v.type, 'event_id', v.id, 'status', d.status, 'attempts', d.attempts,
                'last_status', d.last_status, 'last_error', d.last_error, 'last_at', d.last_at, 'next_at', d.next_at, 'created_at', d.created_at) as x
            from webhook_deliveries d join webhook_endpoints w on w.id = d.endpoint_id join webhook_events v on v.id = d.event_id
            where d.org_id = org order by d.created_at desc limit 50) y), '[]'::jsonb),
        'stripe', exists (select 1 from payment_accounts a where a.org_id = org and a.provider = 'stripe' and a.charges_enabled),
        'ads', (select jsonb_build_object('opt_in', s.ads_opt_in, 'ga4', s.ga4_id is not null, 'meta', s.meta_pixel_id is not null) from revenue_settings s where s.org_id = org),
        'imports', (select count(*) from import_batches b where b.org_id = org)
    );
end $$;

/** Adds an endpoint (no id) or changes one. p: {id?, url, events, description?, active?}. */
create or replace function webhook_save(org uuid, p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare r uuid; ev text[] := (select array_agg(distinct x) from jsonb_array_elements_text(coalesce(p -> 'events', '["*"]')) x);
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can manage webhooks'; end if;
    if coalesce(array_length(ev, 1), 0) = 0 then raise exception 'Choose at least one event'; end if;
    if p ->> 'id' is null then
        insert into webhook_endpoints (org_id, url, events, description, created_by) values (org, trim(p ->> 'url'), ev, left(coalesce(p ->> 'description', ''), 120), auth.uid()) returning id into r;
    else
        update webhook_endpoints set url = coalesce(trim(p ->> 'url'), url), events = ev, description = coalesce(left(p ->> 'description', 120), description), active = coalesce((p ->> 'active')::boolean, active)
        where id = (p ->> 'id')::uuid and org_id = org returning id into r;
    end if;
    return r;
end $$;

create or replace function webhook_delete(org uuid, endpoint uuid) returns boolean language plpgsql security definer set search_path = public as $$
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can manage webhooks'; end if;
    delete from webhook_endpoints where id = endpoint and org_id = org;
    return found;
end $$;

/** Sends a delivery again from the first try (a replay keeps the same event id, so receivers can de-duplicate). */
create or replace function webhook_replay(org uuid, delivery uuid) returns boolean language plpgsql security definer set search_path = public as $$
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can manage webhooks'; end if;
    update webhook_deliveries set status = 'pending', attempts = 0, next_at = now(), last_error = null where id = delivery and org_id = org;
    if found then perform webhook_kick(); end if;
    return found;
end $$;

/** A webhook.test event for one endpoint, whatever it subscribes to. */
create or replace function webhook_test(org uuid, endpoint uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare e uuid;
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can manage webhooks'; end if;
    if not exists (select 1 from webhook_endpoints where id = endpoint and org_id = org) then raise exception 'Endpoint not found'; end if;
    insert into webhook_events (org_id, type, data) values (org, 'webhook.test', jsonb_build_object('object', 'test', 'message', 'A test event from Outgive.')) returning id into e;
    insert into webhook_deliveries (org_id, event_id, endpoint_id) values (org, e, endpoint);
    perform webhook_kick();
    return e;
end $$;

-- ---------------------------------------------------------------- grants
revoke all on api_keys, api_rate, webhook_endpoints, webhook_events, webhook_deliveries from anon, authenticated;
grant all on api_keys, api_rate, webhook_endpoints, webhook_events, webhook_deliveries to service_role;
revoke all on function api_auth(text, integer), api_list(uuid, text, timestamptz, text, integer, jsonb), api_get(uuid, text, uuid), webhook_claim(uuid, integer),
    webhook_emit(uuid, text, jsonb), webhook_kick(), webhook_on_donation(), webhook_on_pledge(), webhook_on_receipt() from public, anon, authenticated;
grant execute on function api_auth(text, integer), api_list(uuid, text, timestamptz, text, integer, jsonb), api_get(uuid, text, uuid), webhook_claim(uuid, integer), webhook_emit(uuid, text, jsonb) to service_role;
grant execute on function developers_get(uuid), api_key_create(uuid, text, text, text), api_key_revoke(uuid, uuid), webhook_save(uuid, jsonb), webhook_delete(uuid, uuid),
    webhook_replay(uuid, uuid), webhook_test(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- delivery every minute (run once by hand after deploy; needs pg_cron + pg_net)
-- select vault.create_secret('https://ecsrbsiaocnyqxdnsfkz.supabase.co', 'project_url');   -- also lets webhook_kick deliver straight away
-- select cron.schedule('webhook-deliver', '* * * * *', $$
--   select net.http_post(url := 'https://ecsrbsiaocnyqxdnsfkz.supabase.co/functions/v1/webhook-deliver',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
--     body := '{}'::jsonb) $$);
