-- The US checkout: the checkout builder's settings per organisation, the last-ten-nights schedules that nightly-charge takes night by
-- night, "pledge now, pay by a date" from the checkout, add-on take-up, A/B tests of ask amounts and layouts, and the one opt-in
-- reminder for an abandoned checkout. Direct charges: a donation can name the connected Stripe account it was made on.
-- Needs 20261128200000_receipts_ein_fraud.sql (orgs.legal_name, ein, address, ein_status). Money in integer cents. Safe to run more than once.

-- ---------------------------------------------------------------- donations made on the charity's own Stripe account (direct charges)
alter table donations add column if not exists stripe_account_id text;  -- null: a destination charge on the platform

-- ---------------------------------------------------------------- A/B tests of ask amounts and layouts
-- One running test per organisation, two to four variants: { id, label, layout? , presets? }. A donor's browser session sticks to one
-- variant (src/features/checkout/experiments.ts). Visitors are counted once per session; gifts come from donations.details
-- (experiment, variant), so a result is conversion (gifts / visitors) and the average gift.
create table if not exists checkout_experiments (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    name text not null check (length(trim(name)) between 1 and 60),
    kind text not null check (kind in ('amounts', 'layout')),
    variants jsonb not null check (jsonb_typeof(variants) = 'array' and jsonb_array_length(variants) between 2 and 4),
    status text not null default 'running' check (status in ('running', 'stopped')),
    started_at timestamptz not null default now(), stopped_at timestamptz,
    created_by uuid references profiles (id) on delete set null
);
create unique index if not exists checkout_experiments_one_running on checkout_experiments (org_id) where status = 'running';
create table if not exists checkout_experiment_visits (
    experiment_id uuid not null references checkout_experiments (id) on delete cascade,
    variant text not null check (length(variant) between 1 and 20),
    session text not null check (length(session) between 16 and 64),
    at timestamptz not null default now(),
    primary key (experiment_id, session)
);
alter table checkout_experiments enable row level security;
alter table checkout_experiment_visits enable row level security;
drop policy if exists "members see experiments" on checkout_experiments;
create policy "members see experiments" on checkout_experiments for select using (is_member(org_id));
grant select on checkout_experiments to authenticated;
grant all on checkout_experiments, checkout_experiment_visits to service_role;
create index if not exists donations_experiment on donations ((details ->> 'experiment')) where details ? 'experiment';

/** Public: this session saw this variant. Once per session; only for a running test and one of its variants. */
-- ponytail: anyone can add visits with made-up sessions; fine for a charity's own A/B readout. Add a per-IP cap if a test is gamed.
create or replace function checkout_experiment_visit(exp uuid, variant text, session text) returns void language sql security definer set search_path = public as $$
    insert into checkout_experiment_visits (experiment_id, variant, session)
    select e.id, checkout_experiment_visit.variant, checkout_experiment_visit.session from checkout_experiments e
    where e.id = exp and e.status = 'running' and exists (select 1 from jsonb_array_elements(e.variants) v where v ->> 'id' = checkout_experiment_visit.variant)
      and length(checkout_experiment_visit.session) between 16 and 64
    on conflict do nothing;
$$;
/** Admins start a test (any running one stops) or stop one: p = { name, kind, variants } or { stop: id }. */
create or replace function checkout_experiment_save(org uuid, p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare r uuid;
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can run checkout tests' using errcode = '42501'; end if;
    update checkout_experiments set status = 'stopped', stopped_at = now() where org_id = org and status = 'running' and (not (p ? 'stop') or id = (p ->> 'stop')::uuid);
    if p ? 'stop' then return (p ->> 'stop')::uuid; end if;
    if exists (select 1 from jsonb_array_elements(p -> 'variants') v where coalesce(v ->> 'id', '') !~ '^[a-z0-9]{1,20}$'
        or (v ? 'layout' and v ->> 'layout' not in ('hero', 'pledge', 'ticket', 'nights', 'compact', 'kiosk'))
        or (v ? 'presets' and (jsonb_typeof(v -> 'presets') <> 'array' or jsonb_array_length(v -> 'presets') not between 2 and 5))) then
        raise exception 'Each variant needs a short id, and a known layout or two to five amounts';
    end if;
    insert into checkout_experiments (org_id, name, kind, variants, created_by) values (org, trim(p ->> 'name'), p ->> 'kind', p -> 'variants', auth.uid()) returning id into r;
    return r;
end $$;
/** Viewer or higher: each test with, per variant, visitors, paid gifts and money raised (cents). */
create or replace function checkout_experiment_results(org uuid) returns jsonb language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'kind', e.kind, 'status', e.status, 'started_at', e.started_at, 'stopped_at', e.stopped_at,
        'variants', (select jsonb_agg(v || jsonb_build_object(
            'visitors', (select count(*) from checkout_experiment_visits x where x.experiment_id = e.id and x.variant = v ->> 'id'),
            'gifts', (select count(*) from donations d where d.org_id = org and d.status = 'succeeded' and d.details ->> 'experiment' = e.id::text and d.details ->> 'variant' = v ->> 'id'),
            'raised_cents', (select coalesce(sum(d.amount_cents), 0) from donations d where d.org_id = org and d.status = 'succeeded' and d.details ->> 'experiment' = e.id::text and d.details ->> 'variant' = v ->> 'id')))
            from jsonb_array_elements(e.variants) v)) order by e.started_at desc), '[]'::jsonb)
    from checkout_experiments e where e.org_id = org and has_role(org, 'viewer');
$$;

-- ---------------------------------------------------------------- the checkout builder
create or replace function checkout_addons_on_screen(a text[]) returns integer language sql immutable as $$
    select count(*)::integer from unnest(a) x where x not in ('nights', 'monthly', 'cover');
$$;
create table if not exists checkout_settings (
    org_id uuid primary key references orgs (id) on delete cascade,
    layout text not null default 'hero' check (layout in ('hero', 'pledge', 'ticket', 'nights', 'compact', 'kiosk')),
    addons text[] not null default '{cover,alfitr,dedication,nights,monthly}'
        check (addons <@ '{nights,alfitr,fidya,cover,match,dedication,roundup,bank,pledge,monthly}'::text[] and checkout_addons_on_screen(addons) <= 3),
    cover_default boolean not null default false,
    funds text[] not null default '{general,zakat,sadaqah,zakat_al_fitr,fidya}'
        check (cardinality(funds) between 1 and 5 and funds <@ '{general,zakat,sadaqah,zakat_al_fitr,fidya}'::text[]),
    appeal text not null default 'Ramadan appeal' check (length(trim(appeal)) between 1 and 40),
    nights_start date not null default '2027-02-27',            -- night 21's evening; moves with the moon sighting
    milestone_step integer check (milestone_step is null or milestone_step > 0),
    milestone_label text not null default '' check (length(milestone_label) <= 60),
    daf_address text not null default '' check (length(daf_address) <= 200),
    updated_by uuid references profiles (id) on delete set null,
    updated_at timestamptz not null default now()
);
alter table checkout_settings enable row level security;
drop policy if exists "members see checkout settings" on checkout_settings;
create policy "members see checkout settings" on checkout_settings for select using (is_member(org_id));
grant select on checkout_settings to authenticated;
grant all on checkout_settings to service_role;

create or replace function checkout_settings_get(org uuid) returns jsonb language sql stable security definer set search_path = public as $$
    select case when has_role(org, 'viewer') then (select to_jsonb(s) - 'org_id' - 'updated_by' from checkout_settings s where s.org_id = org) end;
$$;
/** Admins save the builder. The table's checks refuse a fourth add-on on the gift screen and anything unknown. */
create or replace function checkout_settings_save(org uuid, s jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can change the checkout' using errcode = '42501'; end if;
    insert into checkout_settings (org_id, layout, addons, cover_default, funds, appeal, nights_start, milestone_step, milestone_label, daf_address, updated_by, updated_at)
    values (org, coalesce(s ->> 'layout', 'hero'), coalesce(array(select jsonb_array_elements_text(s -> 'addons')), '{}'), coalesce((s ->> 'cover_default')::boolean, false),
        coalesce(array(select jsonb_array_elements_text(s -> 'funds')), '{general}'), coalesce(nullif(trim(s ->> 'appeal'), ''), 'Ramadan appeal'),
        coalesce((s ->> 'nights_start')::date, '2027-02-27'), nullif(s ->> 'milestone_step', '')::integer, coalesce(s ->> 'milestone_label', ''), coalesce(s ->> 'daf_address', ''), auth.uid(), now())
    on conflict (org_id) do update set layout = excluded.layout, addons = excluded.addons, cover_default = excluded.cover_default, funds = excluded.funds,
        appeal = excluded.appeal, nights_start = excluded.nights_start, milestone_step = excluded.milestone_step, milestone_label = excluded.milestone_label,
        daf_address = excluded.daf_address, updated_by = excluded.updated_by, updated_at = now();
end $$;
/** Public, for the hosted checkout and the embed: what a donor may see about the organisation, and its settings (null: the defaults). */
create or replace function checkout_settings_public(slug text) returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
        'org', jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name,
            -- The verified legal name and EIN when the charity has set them (Receipts and safety), else its display name and registration number.
            'legal_name', coalesce(nullif(trim(o.legal_name), ''), o.name), 'ein', coalesce(nullif(trim(o.ein), ''), o.registration_number), 'address', coalesce(o.address, ''),
            'verified', o.ein_status = 'verified' or o.verified,
            'raised_cents', coalesce((select sum(d.amount_cents) from donations d where d.org_id = o.id and d.status = 'succeeded'), 0),
            'stripe_account_id', o.stripe_account_id, 'charges_enabled', o.stripe_charges_enabled),
        'settings', (select to_jsonb(s) - 'org_id' - 'updated_by' from checkout_settings s where s.org_id = o.id),
        'experiment', (select jsonb_build_object('id', e.id, 'kind', e.kind, 'variants', e.variants) from checkout_experiments e where e.org_id = o.id and e.status = 'running'),
        -- Jumu'ah giving: offer "Every Friday" when one of the charity's appeals (orgs.bio -> appeals) is weekly.
        'weekly', coalesce((select bool_or(coalesce((a ->> 'weekly')::boolean, false)) from jsonb_array_elements(case when jsonb_typeof(o.bio -> 'appeals') = 'array' then o.bio -> 'appeals' else '[]'::jsonb end) a), false))
    from orgs o where o.slug = lower(checkout_settings_public.slug);
$$;
/** Share of paid gifts in the last `days` that carried each add-on line (details.lines from the checkout). Viewer or higher. */
create or replace function checkout_addon_takeup(org uuid, days integer default 7) returns table (key text, gifts bigint, share numeric) language sql stable security definer set search_path = public as $$
    with g as (select d.details from donations d where has_role(org, 'viewer') and d.org_id = org and d.status = 'succeeded' and d.created_at > now() - make_interval(days => greatest(1, least(days, 366)))),
         n as (select count(*)::numeric c from g)
    select case l ->> 'key' when 'fee' then 'cover' when 'round' then 'roundup' else l ->> 'key' end, count(*), round(count(*) / nullif((select c from n), 0), 4)
    from g, jsonb_array_elements(coalesce(g.details -> 'lines', '[]'::jsonb)) l where l ->> 'key' <> 'gift' group by 1;
$$;

-- ---------------------------------------------------------------- the last ten nights
-- One schedule per checkout attempt. The donor's payment method is saved on the charity's own Stripe account with their consent
-- (a SetupIntent); nightly-charge charges each night off-session and emails a reminder with a one-tap cancel link (/checkout?schedule=<token>).
create table if not exists gift_schedules (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    attempt_key text not null unique,
    status text not null default 'pending' check (status in ('pending', 'active', 'cancelled', 'completed')),  -- pending: method not saved yet
    stripe_account_id text not null,
    stripe_customer_id text not null,
    stripe_setup_intent_id text not null,
    stripe_payment_method_id text,
    pay_method text not null default 'card',
    donor_name text not null default 'Anonymous', donor_email text not null, anonymous boolean not null default false,
    fund text not null default '', currency text not null default 'USD' references fx_rates (currency),
    per_night_cents bigint not null check (per_night_cents > 0), extras_cents bigint not null default 0, odd boolean not null default false, cover boolean not null default false,
    details jsonb not null default '{}'::jsonb,
    consent_at timestamptz not null default now(),
    reminded_at timestamptz,
    -- The one-tap cancel link: 64 hex chars, unguessable, no sign-in needed.
    cancel_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists gift_schedule_charges (
    id uuid primary key default gen_random_uuid(),
    schedule_id uuid not null references gift_schedules (id) on delete cascade,
    night integer not null check (night between 1 and 30),
    night_date date not null,
    due_at timestamptz not null,
    gift_cents bigint not null, extras_cents bigint not null default 0, cover_cents bigint not null default 0, amount_cents bigint not null check (amount_cents > 0),
    status text not null default 'due' check (status in ('due', 'charging', 'succeeded', 'processing', 'failed', 'cancelled')),
    donation_id uuid references donations (id) on delete set null,
    stripe_payment_intent_id text, error text, claimed_at timestamptz, charged_at timestamptz,
    unique (schedule_id, night)
);
create index if not exists gift_schedule_charges_due on gift_schedule_charges (due_at) where status in ('due', 'charging');
drop trigger if exists gift_schedules_updated on gift_schedules;
create trigger gift_schedules_updated before update on gift_schedules for each row execute function set_updated_at();
alter table gift_schedules enable row level security;
alter table gift_schedule_charges enable row level security;
drop policy if exists "members see schedules" on gift_schedules;
create policy "members see schedules" on gift_schedules for select using (is_member(org_id));
drop policy if exists "members see schedule charges" on gift_schedule_charges;
create policy "members see schedule charges" on gift_schedule_charges for select using (exists (select 1 from gift_schedules s where s.id = schedule_id and is_member(s.org_id)));
grant select on gift_schedules, gift_schedule_charges to authenticated;
grant all on gift_schedules, gift_schedule_charges to service_role;

/** Public, by the cancel link's token: the schedule as the donor sees it. */
create or replace function gift_schedule_get(t text) returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object('org_name', o.name, 'fund', s.fund, 'currency', s.currency, 'per_night_cents', s.per_night_cents, 'odd', s.odd, 'status', s.status,
        'charges', coalesce((select jsonb_agg(jsonb_build_object('night', c.night, 'date', c.night_date, 'status', c.status, 'amount_cents', c.amount_cents) order by c.night) from gift_schedule_charges c where c.schedule_id = s.id), '[]'::jsonb))
    from gift_schedules s join orgs o on o.id = s.org_id where s.cancel_token = t;
$$;
/** Public, one tap: no more nights are charged. A night already being charged finishes. */
create or replace function gift_schedule_cancel(t text) returns boolean language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
    update gift_schedules set status = 'cancelled' where cancel_token = t and status in ('pending', 'active') returning id into sid;
    if sid is null then return false; end if;
    update gift_schedule_charges set status = 'cancelled' where schedule_id = sid and status = 'due';
    return true;
end $$;
/**
 * For nightly-charge: claims the nights now due on active schedules (and any claim older than 30 minutes, which the Stripe idempotency
 * key makes safe to retry), and closes schedules with nothing left to charge.
 */
create or replace function gift_schedule_claim(lim integer default 100) returns table (
    charge_id uuid, schedule_id uuid, org_id uuid, org_name text, night integer, night_date date, gift_cents bigint, extras_cents bigint, cover_cents bigint, amount_cents bigint,
    currency text, fund text, pay_method text, stripe_account_id text, stripe_customer_id text, stripe_payment_method_id text, donor_name text, donor_email text, anonymous boolean,
    details jsonb, cancel_token text, platform_fee_bps integer
) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
    update gift_schedules s set status = 'completed' where s.status = 'active' and not exists (select 1 from gift_schedule_charges c where c.schedule_id = s.id and c.status in ('due', 'charging'));
    return query
    with picked as (
        select c.id from gift_schedule_charges c join gift_schedules s on s.id = c.schedule_id
        where s.status = 'active' and s.stripe_payment_method_id is not null and c.due_at <= now()
          and (c.status = 'due' or (c.status = 'charging' and c.claimed_at < now() - interval '30 minutes'))
        order by c.due_at limit greatest(1, least(lim, 500)) for update of c skip locked
    ), upd as (update gift_schedule_charges c set status = 'charging', claimed_at = now() from picked where c.id = picked.id returning c.*)
    select u.id, s.id, s.org_id, o.name, u.night, u.night_date, u.gift_cents, u.extras_cents, u.cover_cents, u.amount_cents, s.currency, s.fund, s.pay_method,
        s.stripe_account_id, s.stripe_customer_id, s.stripe_payment_method_id, s.donor_name, s.donor_email, s.anonymous, s.details, s.cancel_token, o.platform_fee_bps
    from upd u join gift_schedules s on s.id = u.schedule_id join orgs o on o.id = s.org_id;
end $$;
revoke all on function gift_schedule_claim(integer) from public, anon, authenticated;
grant execute on function gift_schedule_claim(integer) to service_role;

-- ---------------------------------------------------------------- "pledge now, pay by a date" from the checkout
/**
 * The checks every anonymous pledge passes, whichever public door it comes through: pledge_create_public (a live night's QR screen,
 * 20261128000200) uses the same rules and limits, so pledge_create_public can call this too. Raises with words for the donor.
 * A name; $1 to $1,000,000; an email or mobile; 3 per email or phone per charity per hour; 120 public pledges per charity per 10 minutes.
 */
create or replace function pledge_public_guard(org uuid, nm text, email text, ph text, amount bigint) returns void language plpgsql stable security definer set search_path = public as $$
begin
    if length(coalesce(nm, '')) not between 1 and 120 then raise exception 'Add your name'; end if;
    if amount is null or amount < 100 or amount > 100000000 then raise exception 'Pledge between $1 and $1,000,000'; end if;
    if email is not null and email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'That email address does not look right'; end if;
    if email is null and ph is null then raise exception 'Add a mobile number or an email so we can send your pay link'; end if;
    if (select count(*) from pledges where org_id = org and pledged_at > now() - interval '1 hour' and ((email is not null and donor_email = email) or (ph is not null and donor_phone = ph))) >= 3
        then raise exception 'You have pledged a few times in the last hour. Please ask a volunteer to help.'; end if;
    if (select count(*) from pledges where org_id = org and created_by is null and pledged_at > now() - interval '10 minutes') >= 120
        then raise exception 'Lots of pledges right now. Please try again in a few minutes.'; end if;
end $$;
/**
 * Public: a donor pledges in the checkout instead of paying. Only for an organisation that switched the pledge add-on on (no live night
 * needed), due within 90 days, and through pledge_public_guard like every public pledge. The pledges' recovery sequence sends the pay link.
 */
create or replace function checkout_pledge_create(org uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare r pledges; due date := nullif(p ->> 'due_date', '')::date; email text := nullif(lower(trim(p ->> 'donor_email')), '');
    ph text := phone_e164(nullif(trim(p ->> 'donor_phone'), '')); nm text := trim(coalesce(p ->> 'donor_name', '')); amount bigint;
begin
    if not exists (select 1 from checkout_settings s where s.org_id = org and 'pledge' = any (s.addons)) then raise exception 'This charity does not take pledges here'; end if;
    if due is null or due < current_date or due > current_date + 90 then raise exception 'Choose a date in the next 90 days'; end if;
    begin amount := (p ->> 'amount_cents')::bigint; exception when others then amount := null; end;
    perform pledge_public_guard(org, nm, email, ph, amount);
    insert into pledges (org_id, donor_name, donor_email, donor_phone, event, amount_cents, currency, due_date, note)
    values (org, nm, email, ph, 'Checkout pledge', amount, coalesce(upper(p ->> 'currency'), (select currency from orgs where id = org)), due, left('Pledged in the checkout. Fund: ' || coalesce(p ->> 'fund', ''), 500))
    returning * into r;
    return jsonb_build_object('id', r.id);  -- the pay token is emailed, never returned to the page
end $$;
revoke all on function pledge_public_guard(uuid, text, text, text, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------- the one reminder for an abandoned checkout
-- checkout_recoveries (20261121000200) holds a draft only when the donor ticked "email me a link to finish this gift". nightly-charge
-- claims those an hour old, still open and in date, and sends one email with the resume link and a one-click unsubscribe. sent_at is
-- set as they are claimed, so there is never a second email.
create or replace function checkout_recovery_claim(lim integer default 100) returns table (token text, email text, campaign text, draft jsonb, expires_at timestamptz, org_name text, reply_to text, address text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
    return query
    with picked as (
        select r.id from checkout_recoveries r
        where r.sent_at is null and r.consumed_at is null and r.expires_at > now() and r.created_at < now() - interval '1 hour'
        order by r.created_at limit greatest(1, least(lim, 500)) for update skip locked
    ), upd as (update checkout_recoveries r set sent_at = now() from picked where r.id = picked.id returning r.*)
    select u.token, u.email, u.campaign, u.draft, u.expires_at, o.name, nullif(to_jsonb(o) ->> 'contact_email', ''), nullif(trim(o.address), '')
    from upd u left join orgs o on u.campaign like 'org/%' and o.slug = substr(u.campaign, 5);
end $$;
revoke all on function checkout_recovery_claim(integer) from public, anon, authenticated;
grant execute on function checkout_recovery_claim(integer) to service_role;

grant execute on function checkout_settings_public(text), gift_schedule_get(text), gift_schedule_cancel(text), checkout_pledge_create(uuid, jsonb), checkout_experiment_visit(uuid, text, text) to anon, authenticated;
grant execute on function checkout_settings_get(uuid), checkout_settings_save(uuid, jsonb), checkout_addon_takeup(uuid, integer), checkout_addons_on_screen(text[]), checkout_experiment_save(uuid, jsonb), checkout_experiment_results(uuid) to authenticated;

-- ---------------------------------------------------------------- the nightly charge, every 15 minutes (run once by hand after deploy; needs pg_cron + pg_net)
-- select cron.schedule('nightly-charge', '*/15 * * * *', $$
--   select net.http_post(url := 'https://ecsrbsiaocnyqxdnsfkz.supabase.co/functions/v1/nightly-charge',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
--     body := '{}'::jsonb) $$);
