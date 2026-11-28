-- US tax receipts, EIN verification and card-testing controls (Outgive Checkout plan items 9, 10, 11 and 24).
-- Receipts: one row per receipt issued (a gift receipt, or a donor's year-end statement), numbered per charity per year.
-- EIN check: the ein-check function looks a charity up (ProPublica Nonprofit Explorer, which mirrors the IRS EO BMF), caches the
-- answer in ein_checks, checks ein_revocations (the IRS auto-revocation list, loaded by hand) and sets orgs.ein_status.
-- A US charity (one with an EIN, or country US) takes no payments until ein_status is 'verified' (org_payments_ready).
-- Fraud: per-charity limits in fraud_settings; the pay guard (_shared/fraud) logs every attempt and block in fraud_events,
-- and a donations trigger logs each decline and raises a burst alert.
-- Safe to run more than once.

-- ---------------------------------------------------------------- the charity's legal identity and receipt settings
alter table orgs add column if not exists legal_name text not null default '';
alter table orgs add column if not exists ein text not null default '' check (ein ~ '^([0-9]{9})?$');      -- nine digits, no dash
alter table orgs add column if not exists address text not null default '';                                -- one line, as printed on receipts
alter table orgs add column if not exists ein_status text not null default 'unverified' check (ein_status in ('unverified', 'verified', 'review', 'failed', 'revoked'));
alter table orgs add column if not exists ein_checked_at timestamptz;
alter table orgs add column if not exists receipt_prefix text not null default '' check (receipt_prefix ~ '^[A-Z0-9]{0,6}$'); -- '' = the legal name's initials
alter table orgs add column if not exists receipt_now boolean not null default true;        -- email a receipt the moment a gift is paid
alter table orgs add column if not exists receipt_year_end boolean not null default true;   -- one statement per donor each January
alter table orgs add column if not exists receipt_goods_line boolean not null default true; -- "No goods or services were provided..."

/** A US charity must pass the EIN check before it can take a gift. Others (UK, demo) are not affected. */
create or replace function org_payments_ready(org uuid) returns boolean language sql stable security definer set search_path = public as $$
    select coalesce((select not (o.ein <> '' or upper(o.country) in ('US', 'USA', 'UNITED STATES')) or o.ein_status = 'verified' from orgs o where o.id = org), false)
$$;

-- ---------------------------------------------------------------- EIN lookups
create table if not exists ein_checks (
    ein text primary key check (ein ~ '^[0-9]{9}$'),
    source text not null,                      -- propublica | sandbox
    found boolean not null,
    name text not null default '',
    city text not null default '',
    state text not null default '',
    subsection integer,                        -- 3 = 501(c)(3)
    deductibility integer,                     -- 1 = contributions are deductible
    revoked boolean not null default false,
    raw jsonb not null default '{}'::jsonb,
    checked_at timestamptz not null default now()
);
alter table ein_checks enable row level security;
drop policy if exists "ein checks are public" on ein_checks;
create policy "ein checks are public" on ein_checks for select using (true); -- public IRS data

-- The IRS auto-revocation list (apps.irs.gov/pub/epostcard/data-download-revocation.zip, pipe-delimited, EIN first). Load it monthly:
--   \copy ein_revocations (ein, name) from program 'cut -d"|" -f1,2 revocations.txt' with (format csv, delimiter '|')
create table if not exists ein_revocations (ein text primary key, name text not null default '', revoked_on date, reinstated_on date, loaded_at timestamptz not null default now());
alter table ein_revocations enable row level security;

-- ---------------------------------------------------------------- receipts
create table if not exists receipt_counters (org_id uuid not null references orgs (id) on delete cascade, year integer not null, kind text not null, n integer not null default 0, primary key (org_id, year, kind));
alter table receipt_counters enable row level security;

create table if not exists receipts (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    donation_id uuid unique references donations (id) on delete set null,   -- a gift receipt; null for a year-end statement
    kind text not null default 'gift' check (kind in ('gift', 'year_end')),
    year integer not null,
    number text not null,                                                   -- HF-2027-04411, statements HF-2027-YE00012
    donor_name text not null default '',
    donor_email text,
    currency text not null,
    dated timestamptz not null,                                             -- the gift's date; a statement's issue date
    fund text not null default '',
    issuer jsonb not null default '{}'::jsonb,                              -- the charity as printed (legal name, EIN, address): a receipt never changes after issue
    lines jsonb not null default '[]'::jsonb,                               -- [{label, amount_cents, deductible, kind}], see _shared/receipts/lines.ts
    deductible_cents bigint not null default 0,
    total_cents bigint not null default 0,
    irs_ack boolean not null default false,                                 -- a single gift of $250 or more: the written acknowledgment the IRS asks for
    sent_at timestamptz,
    send_error text,
    created_at timestamptz not null default now(),
    unique (org_id, number)
);
create unique index if not exists receipts_year_end on receipts (org_id, year, lower(donor_email)) where kind = 'year_end';
create index if not exists receipts_org on receipts (org_id, created_at desc);
alter table receipts enable row level security;
drop policy if exists "team and donor read receipts" on receipts;
create policy "team and donor read receipts" on receipts for select using (has_role(org_id, 'viewer') or (auth.uid() is not null and lower(donor_email) = my_email()));

/** The next receipt number for a charity, year and kind (service role only). Gaps are possible when two webhooks race; numbers never repeat. */
create or replace function receipt_next(org uuid, yr integer, k text default 'gift') returns integer language sql security definer set search_path = public as $$
    insert into receipt_counters (org_id, year, kind, n) values (org, yr, k, 1)
    on conflict (org_id, year, kind) do update set n = receipt_counters.n + 1 returning n
$$;

/** Each donor's paid gifts in a calendar year (by email), with any gift receipt already issued: what a year-end statement lists. */
create or replace function year_end_donors(org uuid, yr integer) returns table (donor_email text, donor_name text, currency text, gifts jsonb) language sql stable security definer set search_path = public as $$
    select lower(d.donor_email), (array_agg(d.donor_name order by d.created_at desc))[1], d.currency,
        jsonb_agg(jsonb_build_object('donation_id', d.id, 'date', d.created_at, 'amount_cents', d.amount_cents, 'cover_cents', d.cover_cents, 'tip_cents', d.tip_cents,
            'fund', d.fund, 'details', d.details, 'number', r.number) order by d.created_at)
    from donations d left join receipts r on r.donation_id = d.id
    where d.org_id = org and d.status = 'succeeded' and d.donor_email is not null and d.source <> 'demo'
      and d.created_at >= make_timestamptz(yr, 1, 1, 0, 0, 0, 'UTC') and d.created_at < make_timestamptz(yr + 1, 1, 1, 0, 0, 0, 'UTC') -- UTC, as receipts print
    group by lower(d.donor_email), d.currency
$$;

create or replace function receipts_list(org uuid, yr integer default null, k text default null) returns setof receipts language sql stable security definer set search_path = public as $$
    select * from receipts where org_id = org and has_role(org, 'viewer') and (yr is null or year = yr) and (k is null or kind = k) order by created_at desc limit 500
$$;

-- ---------------------------------------------------------------- fraud
create table if not exists fraud_settings (
    org_id uuid primary key references orgs (id) on delete cascade,
    min_cents integer not null default 500 check (min_cents between 100 and 100000),
    ip_per_10min integer not null default 5 check (ip_per_10min between 1 and 100),
    card_per_hour integer not null default 3 check (card_per_hour between 1 and 100),
    challenge_after integer not null default 2 check (challenge_after between 0 and 20),
    block_disposable boolean not null default true,
    decline_alert integer not null default 10 check (decline_alert between 0 and 1000),
    radar boolean not null default true,
    updated_at timestamptz not null default now()
);
alter table fraud_settings enable row level security;
drop policy if exists "team reads fraud settings" on fraud_settings;
create policy "team reads fraud settings" on fraud_settings for select using (has_role(org_id, 'viewer'));

create table if not exists fraud_events (
    id uuid primary key default gen_random_uuid(),
    org_id uuid references orgs (id) on delete cascade,
    at timestamptz not null default now(),
    kind text not null check (kind in ('attempt', 'block', 'decline', 'challenge', 'alert')),
    reason text,                    -- block: rules.ts Reason; decline: the provider's code
    attempt_key text,
    ip_hash text,                   -- sha-256 of the IP, never the IP itself
    card_fp text,                   -- the card's fingerprint, when known
    email_domain text,
    amount_cents bigint
);
create index if not exists fraud_events_ip on fraud_events (ip_hash, at desc) where ip_hash is not null;
create index if not exists fraud_events_card on fraud_events (card_fp, at desc) where card_fp is not null;
create index if not exists fraud_events_org on fraud_events (org_id, at desc);
create index if not exists fraud_events_attempt on fraud_events (attempt_key) where attempt_key is not null;
alter table fraud_events enable row level security;
drop policy if exists "team reads fraud events" on fraud_events;
create policy "team reads fraud events" on fraud_events for select using (has_role(org_id, 'viewer'));

/** The charity's limits, with the defaults for any it never saved. */
create or replace function fraud_settings_get(org uuid) returns fraud_settings language sql stable security definer set search_path = public as $$
    select coalesce((select f from fraud_settings f where f.org_id = org), row(org, 500, 5, 3, 2, true, 10, true, now())::fraud_settings)
$$;

create or replace function fraud_settings_save(org uuid, p jsonb) returns fraud_settings language plpgsql security definer set search_path = public as $$
declare d fraud_settings := fraud_settings_get(org); f fraud_settings;
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can change fraud controls' using errcode = '42501'; end if;
    insert into fraud_settings as t (org_id, min_cents, ip_per_10min, card_per_hour, challenge_after, block_disposable, decline_alert, radar)
    values (org, coalesce((p ->> 'min_cents')::int, d.min_cents), coalesce((p ->> 'ip_per_10min')::int, d.ip_per_10min), coalesce((p ->> 'card_per_hour')::int, d.card_per_hour),
        coalesce((p ->> 'challenge_after')::int, d.challenge_after), coalesce((p ->> 'block_disposable')::boolean, d.block_disposable),
        coalesce((p ->> 'decline_alert')::int, d.decline_alert), coalesce((p ->> 'radar')::boolean, d.radar))
    on conflict (org_id) do update set min_cents = excluded.min_cents, ip_per_10min = excluded.ip_per_10min, card_per_hour = excluded.card_per_hour,
        challenge_after = excluded.challenge_after, block_disposable = excluded.block_disposable, decline_alert = excluded.decline_alert, radar = excluded.radar, updated_at = now()
    returning * into f;
    return f;
end $$;

/** The "blocked this week" card: totals by reason, the latest blocks, and burst alerts. */
create or replace function fraud_log(org uuid, days integer default 7) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    if not has_role(org, 'viewer') then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    return (with e as (select * from fraud_events where org_id = org and at > now() - make_interval(days => days))
    select jsonb_build_object(
        'blocked', (select count(*) from e where kind = 'block'),
        'challenged', (select count(*) from e where kind = 'challenge'),
        'declines', (select count(*) from e where kind = 'decline'),
        'by_reason', coalesce((select jsonb_agg(jsonb_build_object('reason', reason, 'n', n, 'last', last) order by n desc) from (select reason, count(*) n, max(at) last from e where kind = 'block' group by reason) r), '[]'::jsonb),
        'recent', coalesce((select jsonb_agg(jsonb_build_object('at', at, 'kind', kind, 'reason', reason, 'amount_cents', amount_cents, 'email_domain', email_domain) order by at desc) from (select * from e where kind in ('block', 'alert') order by at desc limit 50) x), '[]'::jsonb),
        'alerts', coalesce((select jsonb_agg(jsonb_build_object('at', at, 'reason', reason) order by at desc) from e where kind = 'alert'), '[]'::jsonb)));
end $$;

/** A gift that fails is a decline in the log (with the IP its attempt came from); enough of them in 10 minutes raises one alert an hour. */
create or replace function donation_decline_log() returns trigger language plpgsql security definer set search_path = public as $$
declare s fraud_settings;
begin
    insert into fraud_events (org_id, kind, reason, attempt_key, ip_hash, amount_cents)
    values (new.org_id, 'decline', new.pay_error, new.attempt_key, (select ip_hash from fraud_events where attempt_key = new.attempt_key and kind = 'attempt' order by at desc limit 1), new.amount_cents);
    s := fraud_settings_get(new.org_id);
    if s.decline_alert > 0 and (select count(*) from fraud_events where org_id = new.org_id and kind = 'decline' and at > now() - interval '10 minutes') >= s.decline_alert
       and not exists (select 1 from fraud_events where org_id = new.org_id and kind = 'alert' and at > now() - interval '1 hour') then
        insert into fraud_events (org_id, kind, reason) values (new.org_id, 'alert', 'decline_burst');
    end if;
    return new;
end $$;
drop trigger if exists donations_decline_log on donations;
create trigger donations_decline_log after update of status on donations for each row
    when (new.status = 'failed' and old.status is distinct from 'failed' and new.attempt_key is not null) execute function donation_decline_log();

-- ---------------------------------------------------------------- the Engage screen's API
/** Everything the Receipts and safety screen shows for a charity. */
create or replace function compliance_get(org uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o orgs;
begin
    if not has_role(org, 'viewer') then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    select * into o from orgs where id = org;
    return jsonb_build_object(
        'legal_name', o.legal_name, 'ein', o.ein, 'address', o.address,
        -- contact_email: the column and its save RPC (org_contact_email_save) come from 20261128400000_journeys_impact.sql
        'contact_email', coalesce(to_jsonb(o) ->> 'contact_email', ''), 'ein_status', o.ein_status, 'ein_checked_at', o.ein_checked_at,
        'ein_check', (select to_jsonb(c) - 'raw' from ein_checks c where c.ein = o.ein),
        'receipt_prefix', o.receipt_prefix, 'receipt_now', o.receipt_now, 'receipt_year_end', o.receipt_year_end, 'receipt_goods_line', o.receipt_goods_line,
        'receipts_unsent', (select count(*) from receipts r where r.org_id = org and r.sent_at is null and r.donor_email is not null),
        'payments_ready', org_payments_ready(org), 'fraud', to_jsonb(fraud_settings_get(org)) - 'org_id' - 'updated_at');
end $$;

/** Legal name, EIN, address and receipt settings (admin). A new EIN or legal name needs the EIN check again. */
create or replace function compliance_save(org uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare e text := case when p ? 'ein' then regexp_replace(p ->> 'ein', '[^0-9]', '', 'g') end;
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can change receipts and verification' using errcode = '42501'; end if;
    update orgs set
        legal_name = coalesce(trim(p ->> 'legal_name'), legal_name), ein = coalesce(e, ein), address = coalesce(trim(p ->> 'address'), address),
        receipt_prefix = coalesce(upper(p ->> 'receipt_prefix'), receipt_prefix),
        receipt_now = coalesce((p ->> 'receipt_now')::boolean, receipt_now), receipt_year_end = coalesce((p ->> 'receipt_year_end')::boolean, receipt_year_end),
        receipt_goods_line = coalesce((p ->> 'receipt_goods_line')::boolean, receipt_goods_line),
        ein_status = case when (e is not null and e <> ein) or (p ? 'legal_name' and trim(p ->> 'legal_name') <> legal_name) then 'unverified' else ein_status end
    where id = org;
    return compliance_get(org);
end $$;

grant execute on function org_payments_ready(uuid), receipts_list(uuid, integer, text), fraud_settings_get(uuid), fraud_settings_save(uuid, jsonb), fraud_log(uuid, integer),
    compliance_get(uuid), compliance_save(uuid, jsonb) to anon, authenticated;
revoke all on function receipt_next(uuid, integer, text), year_end_donors(uuid, integer), donation_decline_log() from public, anon, authenticated;
grant execute on function receipt_next(uuid, integer, text), year_end_donors(uuid, integer) to service_role;
grant select on ein_checks, receipts, fraud_settings, fraud_events to anon, authenticated;
grant all on ein_checks, ein_revocations, receipt_counters, receipts, fraud_settings, fraud_events to service_role;
