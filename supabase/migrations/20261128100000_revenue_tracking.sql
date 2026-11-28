-- Outgive Engage: revenue tracking. Every gift tagged by source, night, fund and campaign; five dashboards; CSV export and import;
-- the morning report's outbox; per-org settings (Ramadan dates, report recipients, ad spend, opt-in GA4 / Meta ids).
--
-- Where each fact lives (one row per donation, nothing duplicated):
--   Money   amount_cents (gift + add-ons), fund, tags.addons {key: cents}, cover_cents (fee covered), processing_fee_cents (the provider's
--           fee when known, else estimated in revenue_facts), net = amount + cover - processing - platform fee, match unlocked = the
--           match rows pointing at the gift through match_for.
--   Rhythm  tags.rhythm (once / monthly / yearly / nightly), pledged = pledge_id set, method = pay_method.
--   Source  tags.channel (grouped on the client by src/shared/attribution.ts channelOf), utm_source / medium / campaign / content,
--           referrer, click_id + click_type, qr (which screen, poster or table), fundraiser, team.
--   Moment  local time from orgs.timezone, Ramadan night from orgs.ramadan_start (revenue_night), tags.event (live event id).
--   Donor   new or returning (computed from earlier paid gifts by email), tags.state, zip, device, consent {email, sms, ...}.
--   Journey tags.seconds (to complete), tags.layout (checkout layout shown), tags.session; abandoned journeys are in funnel_events.
-- tags is cleaned by a trigger (known keys only, short strings, numbers where numbers belong), so the views never fail on a cast.
-- Reads: viewer or higher, aggregates only. Export and import: editor or higher (export carries donors' contact details).
-- The data is the charity's: nothing here is shared with Outgive's own marketing, and GA4 / Meta only ever get a bare value.
-- Safe to run more than once.

-- ---------------------------------------------------------------- settings on the org
-- ramadan_start is 1 Ramadan, the first day of fasting. Night N is the evening of ramadan_start + N - 2 (Night 1 is the eve of the
-- first fast), the same convention as the pledge sample (20261128000100). 2027-02-08 is the expected US start of Ramadan 1448.
alter table orgs add column if not exists timezone text not null default 'America/New_York';
alter table orgs add column if not exists ramadan_start date default '2027-02-08';

-- ---------------------------------------------------------------- import batches (a batch is undone by deleting it)
create table if not exists import_batches (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    tool text not null check (tool in ('launchgood', 'donorbox', 'csv')),
    filename text not null default '' check (length(filename) <= 200),
    rows integer not null default 0,
    imported integer not null default 0,
    skipped integer not null default 0,
    total_cents bigint not null default 0,
    created_by uuid references profiles (id) on delete set null,
    created_at timestamptz not null default now()
);
create index if not exists import_batches_org on import_batches (org_id, created_at desc);

-- ---------------------------------------------------------------- donations: the tags
alter table donations add column if not exists tags jsonb not null default '{}'::jsonb;
alter table donations add column if not exists processing_fee_cents bigint check (processing_fee_cents is null or processing_fee_cents >= 0);
alter table donations add column if not exists match_for uuid references donations (id) on delete set null;   -- a match row: the gift it matched
alter table donations add column if not exists import_batch_id uuid references import_batches (id) on delete cascade;
alter table donations add column if not exists external_id text;                                              -- '<tool>:<id in that tool>'
create unique index if not exists donations_external on donations (org_id, external_id) where external_id is not null;
create index if not exists donations_match_for on donations (match_for) where match_for is not null;
create index if not exists donations_subscription on donations (stripe_subscription_id) where stripe_subscription_id is not null;
-- Imported gifts get their own source so the match trigger (card / offline / demo) never matches history from another tool.
alter table donations drop constraint if exists donations_source_check;
alter table donations add constraint donations_source_check check (source in ('card', 'offline', 'pledge', 'match', 'demo', 'import'));

/** Keeps only the known tag keys, strings cut to 200 characters, numbers only where numbers belong. Never raises. */
create or replace function revenue_tags_clean(t jsonb) returns jsonb language sql immutable as $$
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
        select e.key as k, case
            when e.key = 'night' then case when jsonb_typeof(e.value) = 'number' then case when (e.value::text)::numeric between 1 and 30 then to_jsonb(round((e.value::text)::numeric)::int) end end
            when e.key = 'seconds' then case when jsonb_typeof(e.value) = 'number' then case when (e.value::text)::numeric between 0 and 86400 then to_jsonb(round((e.value::text)::numeric)::int) end end
            when e.key = 'addons' then case when jsonb_typeof(e.value) = 'object' then (
                select jsonb_object_agg(left(a.key, 40), round((a.value::text)::numeric)::bigint) from jsonb_each(e.value) a
                where case when jsonb_typeof(a.value) = 'number' then (a.value::text)::numeric between 0 and 100000000 else false end) end
            when e.key = 'addons_shown' then case when jsonb_typeof(e.value) = 'array' then (
                select jsonb_agg(distinct left(x, 40)) from (select x from jsonb_array_elements_text(e.value) x limit 20) y) end
            when e.key = 'consent' then case when jsonb_typeof(e.value) = 'object' then (
                select jsonb_object_agg(left(c.key, 40), c.value) from jsonb_each(e.value) c where jsonb_typeof(c.value) = 'boolean') end
            when jsonb_typeof(e.value) in ('string', 'number', 'boolean') then to_jsonb(left(e.value #>> '{}', 200))
        end as v
        from jsonb_each(case when jsonb_typeof(t) = 'object' then t else '{}'::jsonb end) e
        where e.key = any (array['session', 'channel', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer', 'landing',
            'click_id', 'click_type', 'qr', 'fundraiser', 'team', 'night', 'event', 'device', 'layout', 'seconds', 'rhythm', 'campaign',
            'state', 'zip', 'consent', 'addons', 'addons_shown'])
    ) x where v is not null
$$;

create or replace function donation_tags_fill() returns trigger language plpgsql as $$
begin
    new.tags := revenue_tags_clean(new.tags);
    -- A monthly renewal (stripe-webhook insertRenewal) arrives without tags: it keeps the first gift's source.
    if tg_op = 'INSERT' and new.tags = '{}'::jsonb and new.stripe_subscription_id is not null then
        select d.tags into new.tags from donations d where d.stripe_subscription_id = new.stripe_subscription_id and d.tags <> '{}'::jsonb order by d.created_at limit 1;
        new.tags := coalesce(new.tags, '{}'::jsonb);
    end if;
    return new;
end $$;
drop trigger if exists donations_tags on donations;
create trigger donations_tags before insert or update of tags on donations for each row execute function donation_tags_fill();

-- Matching, as in 20261023000000_init.sql, now also recording which gift unlocked each match (match_for).
create or replace function apply_match(d donations) returns void language plpgsql as $$
declare m match_pledges; add bigint;
begin
    for m in select * from match_pledges where org_id = d.org_id and active and matched_cents < cap_cents and (page_id is null or page_id = d.page_id) order by created_at loop
        add := least(round(d.amount_cents * m.ratio)::bigint, m.cap_cents - m.matched_cents);
        if add > 0 then
            insert into donations (org_id, page_id, supporter_id, donor_name, amount_cents, currency, source, status, match_pledge_id, message, match_for)
            values (d.org_id, d.page_id, (select id from supporters where org_id = d.org_id and name_key = lower(m.sponsor_name)), m.sponsor_name, add, d.currency, 'match', 'succeeded', m.id, 'Matching ' || d.donor_name || '''s gift', d.id);
            update match_pledges set matched_cents = matched_cents + add where id = m.id;
        end if;
    end loop;
end $$;

-- ---------------------------------------------------------------- the checkout funnel (anonymous)
-- One row per session and step: visit -> checkout_started -> amount_chosen -> payment_attempted -> paid. Paid is also read from
-- paid donations carrying the same tags.session, so a closed tab after paying still counts. No donor details here.
create table if not exists funnel_events (
    id bigint generated always as identity primary key,
    org_id uuid not null references orgs (id) on delete cascade,
    session_id text not null check (session_id ~ '^[A-Za-z0-9_-]{8,64}$'),
    step text not null check (step in ('visit', 'checkout_started', 'amount_chosen', 'payment_attempted', 'paid')),
    tags jsonb not null default '{}'::jsonb,   -- the session's attribution: channel, device, layout, utm_*, qr, fundraiser
    created_at timestamptz not null default now(),
    unique (org_id, session_id, step)
);
create index if not exists funnel_events_org_time on funnel_events (org_id, created_at);

create or replace function funnel_tags_fill() returns trigger language plpgsql as $$
begin new.tags := revenue_tags_clean(new.tags); return new; end $$;
drop trigger if exists funnel_events_tags on funnel_events;
create trigger funnel_events_tags before insert on funnel_events for each row execute function funnel_tags_fill();

/**
 * The funnel endpoint: anyone may record a step for a session (the checkout calls it through src/shared/attribution.ts funnelStep).
 * A repeated step is a no-op. ponytail: no rate limit, a flood only adds rows; put it behind an edge function with a limit if abused.
 */
create or replace function funnel_track(org uuid, session_id text, step text, tags jsonb default '{}'::jsonb) returns void language sql security definer set search_path = public as $$
    insert into funnel_events (org_id, session_id, step, tags)
    select org, session_id, step, coalesce(tags, '{}'::jsonb) where length(coalesce(tags::text, '')) <= 4000
    on conflict do nothing
$$;

-- ---------------------------------------------------------------- settings and the morning report outbox
create table if not exists revenue_settings (
    org_id uuid primary key references orgs (id) on delete cascade,
    report_to text[] not null default '{}',                                            -- morning report recipients
    report_hour smallint not null default 8 check (report_hour between 0 and 23),       -- local hour it goes out
    ads_opt_in boolean not null default false,                                          -- send the bare donation event to GA4 / Meta
    ga4_id text check (ga4_id is null or ga4_id ~ '^G-[A-Z0-9]{4,20}$'),
    meta_pixel_id text check (meta_pixel_id is null or meta_pixel_id ~ '^[0-9]{5,20}$'),
    ad_spend jsonb not null default '{}'::jsonb,                                        -- cents by source key: {"Meta ads": 940000}
    updated_at timestamptz not null default now()
);
-- One row per org and night: claimed before sending, so a report is never sent twice.
create table if not exists revenue_reports (
    org_id uuid not null references orgs (id) on delete cascade,
    night integer not null,
    claimed_at timestamptz not null default now(),
    sent integer,
    failed integer,
    error text,
    primary key (org_id, night)
);

alter table import_batches enable row level security;
alter table funnel_events enable row level security;
alter table revenue_settings enable row level security;
alter table revenue_reports enable row level security;
drop policy if exists "viewers see imports" on import_batches;
create policy "viewers see imports" on import_batches for select using (has_role(org_id, 'viewer'));
drop policy if exists "viewers see the funnel" on funnel_events;
create policy "viewers see the funnel" on funnel_events for select using (has_role(org_id, 'viewer'));
drop policy if exists "viewers see revenue settings" on revenue_settings;
create policy "viewers see revenue settings" on revenue_settings for select using (has_role(org_id, 'viewer'));
drop policy if exists "viewers see reports" on revenue_reports;
create policy "viewers see reports" on revenue_reports for select using (has_role(org_id, 'viewer'));
grant select on import_batches, funnel_events, revenue_settings, revenue_reports to authenticated;
grant all on import_batches, funnel_events, revenue_settings, revenue_reports to service_role;

-- ---------------------------------------------------------------- the facts every dashboard reads
/** The Ramadan night a moment belongs to (1-30), or null. A night runs from local noon to the next noon, so a 1 a.m. gift is last night's. */
create or replace function revenue_night(ts timestamptz, start date, tz text) returns integer language sql stable as $$
    select case when n between 1 and 30 then n end from (select ((ts at time zone tz) - interval '12 hours')::date - start + 2 as n) x
$$;

-- One row per gift (matches excluded: they show as match_cents on the gift that unlocked them). Internal: read through the RPCs below.
create or replace view revenue_facts with (security_invoker = true) as
select x.*, x.amount_cents + x.cover_cents - x.processing_fee_cents - x.platform_fee_cents as net_cents from (
    select d.id, d.org_id, d.created_at, d.created_at at time zone o.timezone as local_at,
        coalesce((d.tags ->> 'night')::int, revenue_night(d.created_at, o.ramadan_start, o.timezone)) as night,
        d.status, d.status = 'succeeded' as paid, d.pledge_id is not null as pledged, d.source,
        d.amount_cents, d.cover_cents, d.tip_cents, d.platform_fee_cents,
        -- ponytail: estimated at Stripe's US nonprofit card rate (2.2% + 30c) until the webhook records the real fee.
        coalesce(d.processing_fee_cents, case when d.source = 'card' then round((d.amount_cents + d.cover_cents + d.tip_cents) * 0.022)::bigint + 30 else 0 end) as processing_fee_cents,
        coalesce(nullif(d.fund, ''), 'General') as fund,
        coalesce(d.tags ->> 'campaign', p.title, 'General') as campaign,
        coalesce(d.tags ->> 'channel', case when d.source = 'offline' then 'Offline' else 'Website direct' end) as channel,
        coalesce(d.tags ->> 'rhythm', case when d.recurring then 'monthly' else 'once' end) as rhythm,
        coalesce(d.pay_method, d.source) as method,
        coalesce(d.tags ->> 'device', 'unknown') as device,
        (select coalesce(sum(m.amount_cents), 0) from donations m where m.match_for = d.id and m.status = 'succeeded') ::bigint as match_cents,
        coalesce(count(*) filter (where d.status = 'succeeded' and d.donor_email is not null)
            over (partition by d.org_id, lower(d.donor_email) order by d.created_at rows between unbounded preceding and 1 preceding), 0) > 0 as returning_donor,
        coalesce(lower(d.donor_email), d.id::text) as donor_key, d.donor_name, d.donor_email, d.anonymous, d.tags
    from donations d join orgs o on o.id = d.org_id left join pages p on p.id = d.page_id
    where d.source <> 'match'
) x;
revoke all on revenue_facts from public, anon, authenticated;

/** The facts for one org, filtered. f: {from, to (local dates, inclusive), night, campaign, fund, channel}. Internal. */
create or replace function revenue_rows(org uuid, f jsonb default '{}'::jsonb) returns setof revenue_facts language sql stable security definer set search_path = public as $$
    select * from revenue_facts r where r.org_id = org
        and (f ->> 'from' is null or r.local_at >= (f ->> 'from')::date)
        and (f ->> 'to' is null or r.local_at < (f ->> 'to')::date + 1)
        and (f ->> 'night' is null or r.night = (f ->> 'night')::int)
        and (f ->> 'campaign' is null or r.campaign = f ->> 'campaign')
        and (f ->> 'fund' is null or r.fund = f ->> 'fund')
        and (f ->> 'channel' is null or r.channel = f ->> 'channel')
$$;

/** Funnel events for one org with the same filters (campaign and fund do not apply: a visit has neither yet). Internal. */
create or replace function funnel_rows(org uuid, f jsonb default '{}'::jsonb) returns table (session_id text, step_rank integer, tags jsonb, created_at timestamptz) language sql stable security definer set search_path = public as $$
    select e.session_id, array_position(array['visit', 'checkout_started', 'amount_chosen', 'payment_attempted', 'paid'], e.step), e.tags, e.created_at
    from funnel_events e join orgs o on o.id = e.org_id
    where e.org_id = org
        and (f ->> 'from' is null or (e.created_at at time zone o.timezone) >= (f ->> 'from')::date)
        and (f ->> 'to' is null or (e.created_at at time zone o.timezone) < (f ->> 'to')::date + 1)
        and (f ->> 'night' is null or revenue_night(e.created_at, o.ramadan_start, o.timezone) = (f ->> 'night')::int)
        and (f ->> 'channel' is null or coalesce(e.tags ->> 'channel', 'Website direct') = f ->> 'channel')
$$;

/** Viewer or higher, or the service role (the morning-report function). */
create or replace function revenue_can_read(org uuid) returns boolean language sql stable security definer set search_path = public as $$
    select coalesce(auth.role(), '') = 'service_role' or has_role(org, 'viewer')
$$;

-- ---------------------------------------------------------------- dashboards (viewer or higher)
/**
 * Tonight: the night in f.night, else the night in progress, else the last night with gifts. Raised, gifts, donors, gifts in the
 * last 10 minutes (of the last gift, for a past night), pledged vs collected (pledges made that night), match unlocked and left, top tables.
 */
create or replace function revenue_tonight(org uuid, f jsonb default '{}'::jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o orgs; n integer; cur integer; ref timestamptz; r jsonb;
begin
    if not revenue_can_read(org) then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    select * into o from orgs where id = org;
    cur := revenue_night(now(), o.ramadan_start, o.timezone);
    n := coalesce((f ->> 'night')::int, cur, (select max(night) from revenue_rows(org, f - 'night') where paid));
    if n is null then return jsonb_build_object('night', null, 'live', false); end if;
    f := f || jsonb_build_object('night', n);
    ref := case when n = cur then now() else (select max(created_at) from revenue_rows(org, f) where paid) end;
    with g as (select * from revenue_rows(org, f) where paid)
    select jsonb_build_object(
        'night', n, 'live', n is not distinct from cur,
        'raised_cents', coalesce(sum(amount_cents), 0), 'gifts', count(*), 'donors', count(distinct donor_key),
        'gifts_last_10_min', count(*) filter (where created_at > ref - interval '10 minutes' and created_at <= ref),
        'match_unlocked_cents', coalesce(sum(match_cents), 0),
        'top_tables', (select coalesce(jsonb_agg(t order by t.cents desc), '[]'::jsonb) from (
            select tags ->> 'qr' as qr, sum(amount_cents) as cents, count(*) as gifts from g where tags ? 'qr' group by 1 order by 2 desc limit 5) t)
    ) into r from g;
    return r
        || (select jsonb_build_object('pledges', count(*), 'pledged_cents', coalesce(sum(amount_cents), 0), 'pledge_collected_cents', coalesce(sum(least(paid_cents, amount_cents)), 0))
            from pledges where org_id = org and not written_off and revenue_night(pledged_at, o.ramadan_start, o.timezone) = n)
        || jsonb_build_object('match_remaining_cents', (select coalesce(sum(greatest(cap_cents - matched_cents, 0)), 0) from match_pledges where org_id = org and active),
            'match_pots', (select coalesce(jsonb_agg(jsonb_build_object('sponsor', sponsor_name, 'cap_cents', cap_cents, 'matched_cents', matched_cents, 'active', active) order by active desc, created_at desc), '[]'::jsonb) from match_pledges where org_id = org));
end $$;

/** Campaign: totals, average inputs and median, rhythm mix, and money by day, Ramadan night, fund and campaign. */
create or replace function revenue_campaign(org uuid, f jsonb default '{}'::jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
    if not revenue_can_read(org) then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    with g as (select * from revenue_rows(org, f) where paid)
    select jsonb_build_object(
        'raised_cents', coalesce(sum(amount_cents), 0), 'net_cents', coalesce(sum(net_cents), 0), 'cover_cents', coalesce(sum(cover_cents), 0),
        'gifts', count(*), 'donors', count(distinct donor_key), 'new_donors', count(distinct donor_key) filter (where not returning_donor),
        'median_cents', coalesce(percentile_cont(0.5) within group (order by amount_cents), 0),
        'monthly_gifts', count(*) filter (where rhythm = 'monthly'), 'nightly_gifts', count(*) filter (where rhythm = 'nightly'),
        'pledged_gifts', count(*) filter (where pledged),
        'by_day', (select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (select local_at::date as day, sum(amount_cents) as cents, count(*) as gifts from g group by 1) x),
        'by_night', (select coalesce(jsonb_agg(x order by x.night), '[]'::jsonb) from (select night, sum(amount_cents) as cents, count(*) as gifts from g where night is not null group by 1) x),
        'by_fund', (select coalesce(jsonb_agg(x order by x.cents desc), '[]'::jsonb) from (select fund as key, sum(amount_cents) as cents, count(*) as gifts, count(distinct donor_key) as donors from g group by 1) x),
        'by_campaign', (select coalesce(jsonb_agg(x order by x.cents desc), '[]'::jsonb) from (select campaign as key, sum(amount_cents) as cents, count(*) as gifts, count(distinct donor_key) as donors from g group by 1) x)
    ) into r from g;
    return r;
end $$;

/**
 * Sources: one row per channel (or per utm_source, utm_campaign, utm_content, qr, fundraiser, team) with dollars, gifts, donors, net,
 * visitors (sessions with any funnel step) and ad spend from settings. Conversion and average gift are worked out in model.ts.
 */
create or replace function revenue_sources(org uuid, f jsonb default '{}'::jsonb, grp text default 'channel') returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
    if not revenue_can_read(org) then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    if grp not in ('channel', 'utm_source', 'utm_campaign', 'utm_content', 'qr', 'fundraiser', 'team') then raise exception 'Unknown grouping %', grp; end if;
    with g as (select case when grp = 'channel' then channel else tags ->> grp end as key, * from revenue_rows(org, f) where paid),
    s as (select key, sum(amount_cents) as cents, count(*) as gifts, count(distinct donor_key) as donors, sum(net_cents) as net from g where key is not null group by key),
    v as (select case when grp = 'channel' then coalesce(tags ->> 'channel', 'Website direct') else tags ->> grp end as key, count(distinct session_id) as visitors
          from funnel_rows(org, f) group by 1)   -- any session with a step is a visitor
    select coalesce(jsonb_agg(jsonb_build_object('key', coalesce(s.key, v.key), 'cents', coalesce(s.cents, 0), 'gifts', coalesce(s.gifts, 0), 'donors', coalesce(s.donors, 0),
            'net_cents', coalesce(s.net, 0), 'visitors', coalesce(v.visitors, 0), 'spend_cents', (st.ad_spend ->> coalesce(s.key, v.key))::bigint) order by coalesce(s.cents, 0) desc), '[]'::jsonb)
    into r from s full join v on v.key = s.key left join revenue_settings st on st.org_id = org
    where coalesce(s.key, v.key) is not null;
    return r;
end $$;

/**
 * Funnel: sessions reaching each step, by device (or layout, or channel), with an 'all' row. A session counts for every step up to
 * the furthest it reached; the furthest step of a session that did not pay is where it was abandoned.
 */
create or replace function revenue_funnel(org uuid, f jsonb default '{}'::jsonb, grp text default 'device') returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
    if not revenue_can_read(org) then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    if grp not in ('device', 'layout', 'channel') then raise exception 'Unknown grouping %', grp; end if;
    with e as (select * from funnel_rows(org, f)),
    paid as (select distinct tags ->> 'session' as session_id from revenue_rows(org, f - 'campaign' - 'fund') where paid and tags ? 'session'),
    s as (select e.session_id, greatest(max(e.step_rank), case when p.session_id is not null then 5 else 0 end) as reached,
            max(coalesce(e.tags ->> grp, case when grp = 'channel' then 'Website direct' else 'unknown' end)) as key
          from e left join paid p on p.session_id = e.session_id group by e.session_id, p.session_id),
    c as (select coalesce(key, 'all') as key, count(*) as visit, count(*) filter (where reached >= 2) as checkout_started, count(*) filter (where reached >= 3) as amount_chosen,
            count(*) filter (where reached >= 4) as payment_attempted, count(*) filter (where reached >= 5) as paid
          from s group by rollup (key))
    select coalesce(jsonb_agg(c order by c.visit desc), '[]'::jsonb) into r from c;
    return r;
end $$;

/** Add-ons: for each add-on, gifts that were shown it, took it, and the extra dollars; and the fee-cover rate. Imported gifts left out. */
create or replace function revenue_addons(org uuid, f jsonb default '{}'::jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
    if not revenue_can_read(org) then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    with g as (select * from revenue_rows(org, f) where paid and source <> 'import'),
    k as (select x as key from g, jsonb_array_elements_text(coalesce(g.tags -> 'addons_shown', '[]'::jsonb)) x
          union select x from g, jsonb_object_keys(coalesce(g.tags -> 'addons', '{}'::jsonb)) x)
    select jsonb_build_object(
        'gifts', (select count(*) from g),
        'fee_covered', (select count(*) from g where cover_cents > 0),
        'fee_cover_cents', (select coalesce(sum(cover_cents), 0) from g),
        'addons', (select coalesce(jsonb_agg(a order by a.taken desc), '[]'::jsonb) from (
            select k.key, count(*) filter (where g.tags -> 'addons_shown' ? k.key or g.tags -> 'addons' ? k.key) as shown,
                count(*) filter (where g.tags -> 'addons' ? k.key) as taken, coalesce(sum((g.tags -> 'addons' ->> k.key)::numeric), 0)::bigint as cents
            from k cross join g group by k.key) a)
    ) into r;
    return r;
end $$;

-- ---------------------------------------------------------------- export, import (editor or higher)
/** Every gift with all its tags and the donor's details, for CSV (model.ts toCsv). Pending attempts left out. */
create or replace function revenue_export(org uuid, f jsonb default '{}'::jsonb) returns table (
    id uuid, created_at timestamptz, local_time timestamp, night integer, status text, amount_cents bigint, fund text, campaign text, channel text,
    utm_source text, utm_medium text, utm_campaign text, utm_content text, referrer text, click_id text, qr text, fundraiser text, team text, event text,
    rhythm text, method text, pledged boolean, cover_cents bigint, processing_fee_cents bigint, platform_fee_cents bigint, net_cents bigint, match_cents bigint,
    addons jsonb, donor_name text, donor_email text, anonymous boolean, returning_donor boolean, state text, zip text, device text, layout text, seconds integer, consent jsonb
) language sql stable security definer set search_path = public as $$
    select r.id, r.created_at, r.local_at, r.night, r.status, r.amount_cents, r.fund, r.campaign, r.channel,
        r.tags ->> 'utm_source', r.tags ->> 'utm_medium', r.tags ->> 'utm_campaign', r.tags ->> 'utm_content', r.tags ->> 'referrer', r.tags ->> 'click_id',
        r.tags ->> 'qr', r.tags ->> 'fundraiser', r.tags ->> 'team', r.tags ->> 'event',
        r.rhythm, r.method, r.pledged, r.cover_cents, r.processing_fee_cents, r.platform_fee_cents, r.net_cents, r.match_cents,
        r.tags -> 'addons', r.donor_name, r.donor_email, r.anonymous, r.returning_donor, r.tags ->> 'state', r.tags ->> 'zip', r.device, r.tags ->> 'layout',
        (r.tags ->> 'seconds')::int, r.tags -> 'consent'
    from revenue_rows(org, f) r where is_member(org) and r.status <> 'pending' order by r.created_at
$$;

/**
 * Gifts from another tool, already parsed by src/features/engage/revenue/importer.ts. rows: [{external_id, created_at (ISO),
 * amount_cents, currency, fund, campaign, donor_name, donor_email, anonymous, recurring, cover_cents, processing_fee_cents, state, zip,
 * utm_source, utm_medium, utm_campaign}]. dry (the default) only counts; dry = false keeps them as one batch. A gift already imported
 * (same tool and external_id) is skipped, so importing the same file twice is safe. Undo with revenue_import_undo.
 */
create or replace function revenue_import(org uuid, tool text, filename text, rows jsonb, dry boolean default true) returns jsonb language plpgsql security definer set search_path = public as $$
declare b uuid; total integer; valid integer; dup integer; cents bigint; added integer := 0;
    label text := case tool when 'launchgood' then 'LaunchGood' when 'donorbox' then 'Donorbox' else 'CSV import' end;
begin
    if not is_member(org) then raise exception 'Only editors can import gifts' using errcode = '42501'; end if;
    if tool not in ('launchgood', 'donorbox', 'csv') then raise exception 'Unknown tool %', tool; end if;
    if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) > 20000 then raise exception 'Send up to 20,000 rows at a time'; end if;
    create temp table if not exists _imp (ext text, ts timestamptz, amt bigint, cur text, r jsonb) on commit drop;
    truncate _imp;
    insert into _imp
    select tool || ':' || left(nullif(trim(r ->> 'external_id'), ''), 120),
        case when (r ->> 'created_at') ~ '^\d{4}-\d{2}-\d{2}' then (r ->> 'created_at')::timestamptz end,
        case when (r ->> 'amount_cents') ~ '^[0-9]{1,10}$' then (r ->> 'amount_cents')::bigint end,
        upper(coalesce(nullif(r ->> 'currency', ''), 'USD')), r
    from jsonb_array_elements(rows) r;
    total := (select count(*) from _imp);
    delete from _imp where ts is null or amt is null or amt <= 0 or cur not in (select currency from fx_rates);
    valid := (select count(*) from _imp);
    -- Already in the database, or twice in the file (first one kept).
    delete from _imp i where i.ext is not null and exists (select 1 from donations d where d.org_id = org and d.external_id = i.ext);
    delete from _imp i where i.ext is not null and i.ctid <> (select min(j.ctid) from _imp j where j.ext = i.ext);
    dup := valid - (select count(*) from _imp);
    cents := (select coalesce(sum(amt), 0) from _imp);
    if not dry then
        insert into import_batches (org_id, tool, filename, rows, created_by) values (org, tool, left(coalesce(filename, ''), 200), total, auth.uid()) returning id into b;
        insert into donations (org_id, donor_name, donor_email, anonymous, amount_cents, currency, cover_cents, processing_fee_cents, fund, recurring, source, status, created_at, import_batch_id, external_id, tags)
        select org, coalesce(nullif(left(trim(r ->> 'donor_name'), 80), ''), 'Anonymous'),
            case when (r ->> 'donor_email') ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then lower(r ->> 'donor_email') end,
            coalesce(r ->> 'anonymous', '') in ('true', 'yes', '1'), amt, cur,
            case when (r ->> 'cover_cents') ~ '^[0-9]{1,10}$' then (r ->> 'cover_cents')::bigint else 0 end,
            case when (r ->> 'processing_fee_cents') ~ '^[0-9]{1,10}$' then (r ->> 'processing_fee_cents')::bigint end,
            left(coalesce(r ->> 'fund', ''), 40), false, 'import', 'succeeded', ts, b, ext,
            jsonb_strip_nulls(jsonb_build_object('channel', coalesce(nullif(r ->> 'channel', ''), label), 'campaign', nullif(r ->> 'campaign', ''),
                'rhythm', case when coalesce(r ->> 'recurring', '') in ('true', 'yes', '1') then 'monthly' else 'once' end,
                'state', nullif(r ->> 'state', ''), 'zip', nullif(r ->> 'zip', ''), 'utm_source', nullif(r ->> 'utm_source', ''),
                'utm_medium', nullif(r ->> 'utm_medium', ''), 'utm_campaign', nullif(r ->> 'utm_campaign', '')))
        from _imp
        on conflict (org_id, external_id) where external_id is not null do nothing;
        get diagnostics added = row_count;
        update import_batches set imported = added, skipped = total - added, total_cents = cents where id = b;
    end if;
    return jsonb_build_object('batch_id', b, 'rows', total, 'invalid', total - valid, 'duplicates', dup, 'new', valid - dup, 'imported', added, 'total_cents', cents);
end $$;

/** Removes an import and every gift it added. */
create or replace function revenue_import_undo(batch uuid) returns void language plpgsql security definer set search_path = public as $$
declare o uuid := (select org_id from import_batches where id = batch);
begin
    if o is null or not is_member(o) then raise exception 'Only editors can undo an import' using errcode = '42501'; end if;
    delete from import_batches where id = batch;
end $$;

create or replace function revenue_imports_list(org uuid) returns setof import_batches language sql stable security definer set search_path = public as $$
    select * from import_batches where org_id = org and has_role(org, 'viewer') order by created_at desc
$$;

-- ---------------------------------------------------------------- settings
create or replace function revenue_settings_get(org uuid) returns jsonb language sql stable security definer set search_path = public as $$
    select case when has_role(org, 'viewer') then jsonb_build_object('timezone', o.timezone, 'ramadan_start', o.ramadan_start,
        'report_to', coalesce(to_jsonb(s.report_to), '[]'::jsonb), 'report_hour', coalesce(s.report_hour, 8), 'ads_opt_in', coalesce(s.ads_opt_in, false),
        'ga4_id', s.ga4_id, 'meta_pixel_id', s.meta_pixel_id, 'ad_spend', coalesce(s.ad_spend, '{}'::jsonb)) end
    from orgs o left join revenue_settings s on s.org_id = o.id where o.id = org
$$;

/** Admins. Only the keys given change. ad_spend is cents by source key; GA4 / Meta ids are checked by the table. */
create or replace function revenue_settings_save(org uuid, s jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can change revenue settings' using errcode = '42501'; end if;
    if s ? 'timezone' then
        perform now() at time zone (s ->> 'timezone');   -- raises on an unknown time zone
        update orgs set timezone = s ->> 'timezone' where id = org;
    end if;
    if s ? 'ramadan_start' then update orgs set ramadan_start = (s ->> 'ramadan_start')::date where id = org; end if;
    insert into revenue_settings (org_id) values (org) on conflict (org_id) do nothing;
    update revenue_settings set
        report_to = case when s ? 'report_to' then array(select distinct lower(trim(x)) from jsonb_array_elements_text(s -> 'report_to') x where trim(x) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' limit 10) else report_to end,
        report_hour = case when s ? 'report_hour' then (s ->> 'report_hour')::smallint else report_hour end,
        ads_opt_in = coalesce((s ->> 'ads_opt_in')::boolean, ads_opt_in),
        ga4_id = case when s ? 'ga4_id' then nullif(upper(trim(s ->> 'ga4_id')), '') else ga4_id end,
        meta_pixel_id = case when s ? 'meta_pixel_id' then nullif(trim(s ->> 'meta_pixel_id'), '') else meta_pixel_id end,
        ad_spend = case when s ? 'ad_spend' and jsonb_typeof(s -> 'ad_spend') = 'object' then (
            select coalesce(jsonb_object_agg(left(e.key, 80), round((e.value::text)::numeric)::bigint), '{}'::jsonb) from jsonb_each(s -> 'ad_spend') e
            where case when jsonb_typeof(e.value) = 'number' then (e.value::text)::numeric >= 0 else false end) else ad_spend end,
        updated_at = now()
    where org_id = org;
    return revenue_settings_get(org);
end $$;

/** Public: the GA4 / Meta ids the checkout may send a bare donation event to, or null when the charity has not opted in. */
create or replace function revenue_ads(org uuid) returns jsonb language sql stable security definer set search_path = public as $$
    select case when s.ads_opt_in and (s.ga4_id is not null or s.meta_pixel_id is not null) then jsonb_strip_nulls(jsonb_build_object('ga4', s.ga4_id, 'meta', s.meta_pixel_id)) end
    from revenue_settings s where s.org_id = org
$$;

-- ---------------------------------------------------------------- morning report (service role only)
/**
 * Claims the reports due now: orgs with recipients whose local hour has reached report_hour, for the night that ended this morning.
 * Called hourly by the morning-report edge function. A claimed night is never claimed again.
 */
create or replace function revenue_reports_claim() returns table (org_id uuid, night integer) language sql security definer set search_path = public as $$
    insert into revenue_reports as rr (org_id, night)
    select s.org_id, revenue_night(now() - interval '12 hours', o.ramadan_start, o.timezone)
    from revenue_settings s join orgs o on o.id = s.org_id
    where cardinality(s.report_to) > 0 and extract(hour from now() at time zone o.timezone) >= s.report_hour
        and revenue_night(now() - interval '12 hours', o.ramadan_start, o.timezone) is not null
    on conflict do nothing
    returning rr.org_id, rr.night
$$;

revoke all on function revenue_rows(uuid, jsonb), funnel_rows(uuid, jsonb), revenue_reports_claim() from public, anon, authenticated;
grant execute on function revenue_reports_claim() to service_role;
grant execute on function funnel_track(uuid, text, text, jsonb), revenue_ads(uuid) to anon, authenticated;
grant execute on function revenue_tonight(uuid, jsonb), revenue_campaign(uuid, jsonb), revenue_sources(uuid, jsonb, text), revenue_funnel(uuid, jsonb, text),
    revenue_addons(uuid, jsonb), revenue_export(uuid, jsonb), revenue_import(uuid, text, text, jsonb, boolean), revenue_import_undo(uuid),
    revenue_imports_list(uuid), revenue_settings_get(uuid), revenue_settings_save(uuid, jsonb), revenue_night(timestamptz, date, text) to authenticated;
