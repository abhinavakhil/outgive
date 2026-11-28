-- Outgive Engage: the donor journey after Eid (plan item 21), personal impact reports (22), lapsed-donor and first-gift anniversary
-- reminders (23).
-- A donor is an email address that gave to the org (succeeded donations). Donors belong to the charity: every message goes out in
-- the charity's name, about the charity, and Outgive never markets to them.
-- Journey: one settings row per org (draft/live, audience, the Ramadan dates) and an editable list of steps per org, each on a
-- trigger: 'eid' (day N after Eid al-Fitr, for this Ramadan's donors in the chosen audience), 'lapsed' (day N after Eid, for donors
-- who gave last Ramadan but not this one) or 'anniversary' (day N after the anniversary of a donor's first gift).
-- journey_enroll() adds donors to journey_enrollments, journey_schedule() turns due steps into journey_sends (the outbox), and the
-- journey-run edge function claims and sends them through _shared/notify. A donor leaves when they start a monthly gift.
-- Every send carries a token: /unsubscribe/<token> on the site (contact_suppressions) and the tracked link
-- (journey-run?c=<token>, a 302 that records the click). Gifts after a send are conversions, attributed to that send's step.
-- Impact: impact_units turns a fund's money into things ("$60 = a family food pack for a month"); impact_reports holds each donor's
-- unguessable token for the public page /impact/<token>.
-- Reads: viewer or higher (donor contact details editor only). Writes: editor or higher through the functions below. Safe to rerun.

-- ---------------------------------------------------------------- the charity's contact email (Reply-To on every message sent in its name)
alter table orgs add column if not exists contact_email text not null default '' check (contact_email = '' or contact_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');

-- ---------------------------------------------------------------- settings, steps
create table if not exists journey_settings (
    org_id uuid primary key references orgs (id) on delete cascade,
    live boolean not null default false,
    audience text not null default 'all' check (audience in ('all', 'first_time', 'returning')),
    season_label text not null default 'Ramadan 1448' check (length(season_label) between 1 and 40),
    -- This Ramadan's first day and Eid al-Fitr (day 0 of the journey); last Ramadan's, for lapsed donors. Expected dates, editable.
    ramadan_start date not null default '2027-02-08',
    eid_date date not null default '2027-03-10',
    prev_ramadan_start date not null default '2026-02-18',
    prev_eid_date date not null default '2026-03-20',
    give_url text not null default '' check (give_url = '' or give_url ~ '^https://'),   -- '' = the site's /ramadhan/give
    updated_at timestamptz not null default now(),
    check (ramadan_start < eid_date and prev_ramadan_start < prev_eid_date and prev_eid_date < ramadan_start)
);

create table if not exists journey_steps (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    trigger text not null default 'eid' check (trigger in ('eid', 'lapsed', 'anniversary')),
    day integer not null check (day between 0 and 365),
    kind text not null check (kind in ('thanks', 'receipt', 'impact', 'monthly_ask', 'qurbani', 'field_update', 'warmup', 'lapsed', 'anniversary', 'custom')),
    title text not null check (length(title) between 1 and 80),          -- the team's name for it
    channels text[] not null check (cardinality(channels) > 0 and channels <@ '{email,sms}'),
    subject text not null default '' check (length(subject) <= 150),     -- templates: {name} {org} {total} ... (VARS in model.ts)
    body text not null default '' check (length(body) <= 4000),
    sms text not null default '' check (length(sms) <= 320),
    cta_label text not null default '' check (length(cta_label) <= 40),
    cta_url text not null default '' check (length(cta_url) <= 300),     -- a template: {report_url}, {give_url}, {monthly_url} or https://...
    enabled boolean not null default true,
    unique (org_id, trigger, day, kind)
);

-- ---------------------------------------------------------------- donors in the journey, the outbox, conversions, opt-outs
create table if not exists journey_enrollments (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    email text not null check (email = lower(email)),
    donor_name text not null default '',
    phone text,                                  -- E.164, only when the donor agreed to texts (donation details.sms_consent)
    trigger text not null check (trigger in ('eid', 'lapsed', 'anniversary')),
    anchor date not null,                        -- day 0: Eid, or the anniversary
    first_time boolean not null default false,   -- first gift this Ramadan
    monthly_at_start boolean not null default false,
    status text not null default 'active' check (status in ('active', 'exited')),
    exit_reason text check (exit_reason in ('monthly', 'unsubscribed', 'staff')),
    enrolled_at timestamptz not null default now(),
    exited_at timestamptz,
    unique (org_id, email, trigger, anchor)
);
create index if not exists journey_enrollments_org on journey_enrollments (org_id, status);

create table if not exists journey_sends (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    enrollment_id uuid not null references journey_enrollments (id) on delete cascade,
    step_id uuid references journey_steps (id) on delete set null,
    kind text not null,
    channel text not null check (channel in ('email', 'sms')),
    scheduled_at timestamptz not null,
    status text not null check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
    provider text, error text,
    sent_at timestamptz,                         -- while 'sending', when it was claimed
    -- 64 hex chars (two v4 UUIDs): the unsubscribe link and the tracked link of this message.
    token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    target_url text,                             -- where the tracked link goes, set when sent
    clicked_at timestamptz, clicks integer not null default 0,
    created_at timestamptz not null default now(),
    unique (enrollment_id, step_id, channel)
);
create index if not exists journey_sends_due on journey_sends (status, scheduled_at) where status in ('pending', 'sending');
create index if not exists journey_sends_org on journey_sends (org_id, created_at desc);

create table if not exists journey_conversions (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    enrollment_id uuid not null references journey_enrollments (id) on delete cascade,
    send_id uuid references journey_sends (id) on delete set null,   -- the message it is credited to; null = before any message
    step_id uuid references journey_steps (id) on delete set null,
    donation_id uuid not null references donations (id) on delete cascade,
    kind text not null check (kind in ('gave_again', 'monthly')),
    amount_cents bigint not null,
    at timestamptz not null default now(),
    unique (enrollment_id, donation_id)
);

-- Per charity: a donor who opts out of one charity's messages still hears from another they gave to.
create table if not exists contact_suppressions (
    org_id uuid not null references orgs (id) on delete cascade,
    channel text not null check (channel in ('email', 'sms')),
    address text not null,                       -- lower-case email, or E.164 phone
    reason text not null check (reason in ('unsubscribed', 'bounced', 'complained', 'staff')),
    send_id uuid references journey_sends (id) on delete set null,
    created_at timestamptz not null default now(),
    primary key (org_id, channel, address)
);

-- ---------------------------------------------------------------- impact
create table if not exists impact_units (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    fund text not null check (length(fund) between 1 and 60),             -- matches donations.fund, case-insensitively
    unit_cents bigint not null check (unit_cents > 0),
    label text not null check (length(label) between 1 and 80),           -- plural: "iftar meals"
    label_one text not null default '' check (length(label_one) <= 80),   -- singular: "iftar meal" ('' = label)
    note text not null default '' check (length(note) <= 300),            -- shown under the fund on the report
    sort integer not null default 0
);
create unique index if not exists impact_units_fund on impact_units (org_id, lower(fund));

create table if not exists impact_reports (
    token text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    org_id uuid not null references orgs (id) on delete cascade,
    email text not null check (email = lower(email)),
    season_label text not null,
    starts date not null, ends date not null,    -- the gifts it counts, inclusive; fixed so a link always shows the same season
    views integer not null default 0,
    viewed_at timestamptz,
    created_at timestamptz not null default now(),
    unique (org_id, email, starts)
);

alter table journey_settings enable row level security;
alter table journey_steps enable row level security;
alter table journey_enrollments enable row level security;
alter table journey_sends enable row level security;
alter table journey_conversions enable row level security;
alter table contact_suppressions enable row level security;
alter table impact_units enable row level security;
alter table impact_reports enable row level security;
drop policy if exists "team reads journey settings" on journey_settings;
create policy "team reads journey settings" on journey_settings for select using (has_role(org_id, 'viewer'));
drop policy if exists "team reads journey steps" on journey_steps;
create policy "team reads journey steps" on journey_steps for select using (has_role(org_id, 'viewer'));
drop policy if exists "team reads impact units" on impact_units;
create policy "team reads impact units" on impact_units for select using (has_role(org_id, 'viewer'));
-- These hold donors' contact details: editor only. Viewers read names and numbers through the functions below.
drop policy if exists "editors read journey enrollments" on journey_enrollments;
create policy "editors read journey enrollments" on journey_enrollments for select using (has_role(org_id, 'editor'));
drop policy if exists "editors read journey sends" on journey_sends;
create policy "editors read journey sends" on journey_sends for select using (has_role(org_id, 'editor'));
drop policy if exists "editors read journey conversions" on journey_conversions;
create policy "editors read journey conversions" on journey_conversions for select using (has_role(org_id, 'editor'));
drop policy if exists "editors read suppressions" on contact_suppressions;
create policy "editors read suppressions" on contact_suppressions for select using (has_role(org_id, 'editor'));
drop policy if exists "editors read impact reports" on impact_reports;
create policy "editors read impact reports" on impact_reports for select using (has_role(org_id, 'editor'));
-- No write policies: writes go through the functions below or the service role.
grant select on journey_settings, journey_steps, journey_enrollments, journey_sends, journey_conversions, contact_suppressions, impact_units, impact_reports to authenticated;
grant all on journey_settings, journey_steps, journey_enrollments, journey_sends, journey_conversions, contact_suppressions, impact_units, impact_reports to service_role;

-- ---------------------------------------------------------------- defaults for every org
create or replace function journey_seed(org uuid) returns void language sql security definer set search_path = public as $$
    insert into journey_settings (org_id) values (org) on conflict do nothing;
    insert into journey_steps (org_id, trigger, day, kind, title, channels, subject, body, sms, cta_label, cta_url, enabled)
    select org, d.* from (values
        ('eid', 0, 'thanks', 'Eid Mubarak, and thank you', '{email}'::text[], 'Eid Mubarak, {name}. Thank you for this Ramadan',
            'Your gifts to {org} this Ramadan reached families in need and fed our community every night of iftar. We will write again soon with exactly what your giving did.', '', '', '', true),
        ('eid', 7, 'receipt', 'Receipt and year-to-date total', '{email}'::text[], 'Your Ramadan giving summary',
            E'Here is your giving to {org} so far in {year}.\n\nTotal given: {ytd_total}\nZakat: {ytd_zakat}\n\nYour tax receipt for each gift was emailed when you gave. Keep this summary with them for your records.', '', '', '', true),
        ('eid', 14, 'impact', 'Personal impact report', '{email}'::text[], '{name}, here is what your gifts did',
            'We have counted it up: {impact}, because of you. Your personal report is one tap away.', '', 'See my report', '{report_url}', true),
        ('eid', 30, 'monthly_ask', 'Monthly giving ask', '{email,sms}'::text[], 'Keep Ramadan going all year',
            'Many of our supporters give a little each month so families are not only fed in Ramadan. $15 a month provides a family food pack every quarter.',
            '{org}: $15 a month provides a family food pack every quarter. Start here: {link}', 'Give $15 a month', '{monthly_url}', true),
        ('eid', 60, 'qurbani', 'Qurbani for Eid al-Adha', '{email}'::text[], 'Qurbani 1448: give a share',
            'Eid al-Adha is close. A Qurbani share through {org} is distributed fresh to families who rarely eat meat.', '', 'Give a Qurbani share', '{give_url}', true),
        ('eid', 180, 'field_update', 'Six-month field update', '{email}'::text[], 'Six months on: a letter from the field',
            'A short update from our team on the projects your Ramadan gifts funded, with photos from the distribution.', '', 'See my report', '{report_url}', false),
        ('eid', 320, 'warmup', 'Ramadan warm-up', '{email}'::text[], 'Ramadan is six weeks away',
            'Set up your last-ten-nights giving now and never miss an odd night. It takes one minute.', '', 'Schedule my ten nights', '{give_url}', true),
        ('lapsed', 3, 'lapsed', 'We missed you this Ramadan', '{email}'::text[], 'We missed you this Ramadan, {name}',
            'Last Ramadan you gave {last_total} to {org}, and it did real good. This year we did not hear from you, and that is alright. If you would still like to give before the year is out, it takes a minute.', '', 'Give now', '{give_url}', true),
        ('anniversary', 0, 'anniversary', 'Anniversary of first gift', '{email}'::text[], 'A year ago today, {name}',
            'It is a year since your first gift to {org}. Thank you for being part of this. Here is everything your giving has done this year.', '', 'See my report', '{report_url}', true)
    ) as d (trigger, day, kind, title, channels, subject, body, sms, cta_label, cta_url, enabled)
    on conflict (org_id, trigger, day, kind) do nothing;
    insert into impact_units (org_id, fund, unit_cents, label, label_one, note, sort)
    select org, u.* from (values
        ('Zakat', 6000, 'family food packs, a month each', 'family food pack for a month', 'Zakat gifts go only to zakat-eligible recipients, as set out in our zakat policy.', 1),
        ('Sadaqah', 400, 'iftar meals', 'iftar meal', '', 2),
        ('Zakat al-Fitr', 1500, 'people fed on Eid morning', 'person fed on Eid morning', '', 3),
        ('Fidya', 1500, 'days of meals for a person in need', 'day of meals for a person in need', '', 4),
        ('Building fund', 12000, 'sq ft of the new masjid', 'sq ft of the new masjid', '', 5)
    ) as u (fund, unit_cents, label, label_one, note, sort)
    on conflict (org_id, lower(fund)) do nothing;
$$;
create or replace function orgs_journey_seed() returns trigger language plpgsql security definer set search_path = public as $$
begin perform journey_seed(new.id); return new; end $$;
drop trigger if exists orgs_journey_seed on orgs;
create trigger orgs_journey_seed after insert on orgs for each row execute function orgs_journey_seed();
select journey_seed(id) from orgs where not exists (select 1 from journey_settings s where s.org_id = orgs.id);

-- ---------------------------------------------------------------- who the donors are (mirrors segment/enrollments in model.ts)
-- ponytail: days are counted in New York time and amounts summed as the org's one currency; use the org's timezone and group by
-- currency if charities outside US Eastern or with mixed currencies use the journey.
/** Zakat in the journey's sense: the Zakat fund and Zakat al-Fitr. */
create or replace function is_zakat(fund text) returns boolean language sql immutable as $$ select lower(coalesce(fund, '')) like 'zakat%' $$;

/**
 * Every donor of an org with their giving: this Ramadan (ramadan_start .. eid_date, inclusive), last Ramadan, before this Ramadan,
 * the first gift, and whether they have an active monthly gift. Internal: callers check the role.
 */
create or replace function journey_donors(org uuid) returns table (
    email text, donor_name text, phone text, season_cents bigint, prev_cents bigint, before_cents bigint, total_cents bigint,
    first_gift date, monthly boolean, segment text
) language sql stable security definer set search_path = public as $$
    with s as (select * from journey_settings where org_id = org),
    d as (select lower(x.donor_email) as email, x.donor_name, x.amount_cents, x.created_at, x.details, (x.created_at at time zone 'America/New_York')::date as day
          from donations x where x.org_id = org and x.status = 'succeeded' and x.donor_email is not null and x.source <> 'demo'),
    g as (
        select d.email, (array_agg(d.donor_name order by d.created_at desc))[1] as donor_name,
            (array_agg(phone_e164(d.details ->> 'phone') order by d.created_at desc) filter (where d.details ->> 'sms_consent' = 'true' and phone_e164(d.details ->> 'phone') is not null))[1] as phone,
            coalesce(sum(d.amount_cents) filter (where d.day between s.ramadan_start and s.eid_date), 0)::bigint as season_cents,
            coalesce(sum(d.amount_cents) filter (where d.day between s.prev_ramadan_start and s.prev_eid_date), 0)::bigint as prev_cents,
            coalesce(sum(d.amount_cents) filter (where d.day < s.ramadan_start), 0)::bigint as before_cents,
            sum(d.amount_cents)::bigint as total_cents, min(d.day) as first_gift
        from d cross join s group by d.email
    )
    select g.email, g.donor_name, g.phone, g.season_cents, g.prev_cents, g.before_cents, g.total_cents, g.first_gift,
        exists (select 1 from recurring_gifts r where r.org_id = org and lower(r.donor_email) = g.email and r.status = 'active'),
        case when g.season_cents > 0 then (case when g.before_cents > 0 then 'returning' else 'first_time' end) when g.prev_cents > 0 then 'lapsed' else 'other' end
    from g
$$;

/** The words a donor's messages and report are built from (VARS in model.ts). Internal. */
create or replace function journey_vars(org uuid, e text, today date default current_date) returns jsonb language sql stable security definer set search_path = public as $$
    with s as (select * from journey_settings where org_id = org),
    d as (select x.amount_cents, x.fund, (x.created_at at time zone 'America/New_York')::date as day from donations x
          where x.org_id = org and lower(x.donor_email) = lower(e) and x.status = 'succeeded' and x.source <> 'demo')
    select jsonb_build_object(
        'full_name', (select donor_name from donations where org_id = org and lower(donor_email) = lower(e) and status = 'succeeded' order by created_at desc limit 1),
        'currency', (select currency from orgs where id = org),
        'season', s.season_label,
        'year', extract(year from today)::int,
        'season_cents', (select coalesce(sum(amount_cents), 0) from d where day between s.ramadan_start and s.eid_date),
        'season_zakat_cents', (select coalesce(sum(amount_cents), 0) from d where day between s.ramadan_start and s.eid_date and is_zakat(fund)),
        'ytd_cents', (select coalesce(sum(amount_cents), 0) from d where day between make_date(extract(year from today)::int, 1, 1) and today),
        'ytd_zakat_cents', (select coalesce(sum(amount_cents), 0) from d where day between make_date(extract(year from today)::int, 1, 1) and today and is_zakat(fund)),
        'last_cents', (select coalesce(sum(amount_cents), 0) from d where day between s.prev_ramadan_start and s.prev_eid_date),
        'funds', (select coalesce(jsonb_object_agg(f, c), '{}'::jsonb) from (select coalesce(nullif(fund, ''), 'General') as f, sum(amount_cents) as c from d where day between s.ramadan_start and s.eid_date group by 1) x),
        'units', (select coalesce(jsonb_agg(jsonb_build_object('fund', fund, 'unit_cents', unit_cents, 'label', label, 'label_one', label_one, 'note', note) order by sort, fund), '[]'::jsonb) from impact_units where org_id = org)
    ) from s
$$;

/** A donor's report token for the org's current season, made on first use. Internal (service role, and the functions below). */
create or replace function impact_report_token(org uuid, e text) returns text language plpgsql security definer set search_path = public as $$
declare t text; s journey_settings;
begin
    select * into s from journey_settings where org_id = org;
    insert into impact_reports (org_id, email, season_label, starts, ends) values (org, lower(e), s.season_label, s.ramadan_start, s.eid_date)
    on conflict (org_id, email, starts) do update set season_label = excluded.season_label returning token into t;
    return t;
end $$;

-- ---------------------------------------------------------------- the SQL API for the team
/** Settings, steps (day order within trigger), the audience sizes and each step's results. Viewer or higher. */
create or replace function journey_get(org uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
    if not has_role(org, 'viewer') then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    with dn as (select * from journey_donors(org)),
    st as (select s.*, (select count(*) from journey_sends x where x.step_id = s.id and x.status = 'sent') as sent,
                (select count(*) from journey_sends x where x.step_id = s.id and x.clicked_at is not null) as clicked,
                (select count(*) from journey_conversions c where c.step_id = s.id and c.kind = 'gave_again') as gave_again,
                (select count(*) from journey_conversions c where c.step_id = s.id and c.kind = 'monthly') as monthly,
                (select coalesce(sum(amount_cents), 0) from journey_conversions c where c.step_id = s.id) as converted_cents
           from journey_steps s where s.org_id = org)
    select jsonb_build_object(
        'settings', (select to_jsonb(j) - 'org_id' from journey_settings j where j.org_id = org),
        'address', (select address from orgs where id = org),
        'contact_email', (select contact_email from orgs where id = org),
        'steps', (select coalesce(jsonb_agg(to_jsonb(st) - 'org_id' order by case trigger when 'eid' then 0 when 'lapsed' then 1 else 2 end, day, kind), '[]'::jsonb) from st),
        'audience', jsonb_build_object(
            'all', (select count(*) from dn where segment in ('first_time', 'returning')),
            'first_time', (select count(*) from dn where segment = 'first_time'),
            'returning', (select count(*) from dn where segment = 'returning'),
            'lapsed', (select count(*) from dn where segment = 'lapsed')),
        'enrolled', (select count(*) from journey_enrollments where org_id = org and status = 'active'),
        'exited_monthly', (select count(*) from journey_enrollments where org_id = org and exit_reason = 'monthly'),
        'unsubscribed', (select count(*) from contact_suppressions where org_id = org)
    ) into r;
    return r;
end $$;

/**
 * Changes the settings (only the keys given): {live, audience, season_label, ramadan_start, eid_date, prev_ramadan_start, prev_eid_date,
 * give_url}. Editor or higher. Going live needs the charity's postal address (CAN-SPAM), set in compliance settings.
 */
create or replace function journey_settings_save(org uuid, p jsonb) returns journey_settings language plpgsql security definer set search_path = public as $$
declare r journey_settings;
begin
    if not has_role(org, 'editor') then raise exception 'Only editors can change the journey' using errcode = '42501'; end if;
    if coalesce((p ->> 'live')::boolean, false) and coalesce((select trim(address) from orgs where id = org), '') = '' then
        raise exception 'Add your charity''s postal address before going live: every email has to show it';
    end if;
    update journey_settings set
        live = coalesce((p ->> 'live')::boolean, live),
        audience = coalesce(p ->> 'audience', audience),
        season_label = coalesce(trim(p ->> 'season_label'), season_label),
        ramadan_start = coalesce((p ->> 'ramadan_start')::date, ramadan_start),
        eid_date = coalesce((p ->> 'eid_date')::date, eid_date),
        prev_ramadan_start = coalesce((p ->> 'prev_ramadan_start')::date, prev_ramadan_start),
        prev_eid_date = coalesce((p ->> 'prev_eid_date')::date, prev_eid_date),
        give_url = coalesce(trim(p ->> 'give_url'), give_url),
        updated_at = now()
    where org_id = org returning * into r;
    return r;
end $$;

/** Replaces the org's steps with this list: [{id?, trigger, day, kind, title, channels, subject, body, sms, cta_label, cta_url, enabled}]. Editor or higher. */
create or replace function journey_steps_save(org uuid, steps jsonb) returns setof journey_steps language plpgsql security definer set search_path = public as $$
declare s jsonb; keep uuid[]; sid uuid;
begin
    if not has_role(org, 'editor') then raise exception 'Only editors can change the journey' using errcode = '42501'; end if;
    if jsonb_typeof(steps) <> 'array' or jsonb_array_length(steps) > 30 then raise exception 'steps must be a list of at most 30'; end if;
    select coalesce(array_agg((e ->> 'id')::uuid), '{}') into keep from jsonb_array_elements(steps) e where nullif(e ->> 'id', '') is not null;
    delete from journey_steps where org_id = org and id <> all (keep);
    for s in select * from jsonb_array_elements(steps) loop
        sid := nullif(s ->> 'id', '')::uuid;
        if sid is null then
            insert into journey_steps (org_id, trigger, day, kind, title, channels, subject, body, sms, cta_label, cta_url, enabled)
            values (org, coalesce(s ->> 'trigger', 'eid'), (s ->> 'day')::int, coalesce(s ->> 'kind', 'custom'), s ->> 'title', array(select jsonb_array_elements_text(s -> 'channels')),
                coalesce(s ->> 'subject', ''), coalesce(s ->> 'body', ''), coalesce(s ->> 'sms', ''), coalesce(s ->> 'cta_label', ''), coalesce(s ->> 'cta_url', ''), coalesce((s ->> 'enabled')::boolean, true));
        else
            update journey_steps set trigger = coalesce(s ->> 'trigger', trigger), day = coalesce((s ->> 'day')::int, day), kind = coalesce(s ->> 'kind', kind), title = coalesce(s ->> 'title', title),
                channels = case when s ? 'channels' then array(select jsonb_array_elements_text(s -> 'channels')) else channels end, subject = coalesce(s ->> 'subject', subject), body = coalesce(s ->> 'body', body),
                sms = coalesce(s ->> 'sms', sms), cta_label = coalesce(s ->> 'cta_label', cta_label), cta_url = coalesce(s ->> 'cta_url', cta_url), enabled = coalesce((s ->> 'enabled')::boolean, enabled)
            where id = sid and org_id = org;
            if not found then raise exception 'Step not found'; end if;
        end if;
    end loop;
    return query select * from journey_steps where org_id = org order by trigger, day, kind;
end $$;

/**
 * The donors the journey can reach, with their segment and journey state. `key` identifies a donor without their email (for
 * preview and reports). Viewer or higher; email and phone are null below editor.
 */
create or replace function journey_donors_list(org uuid) returns table (
    key text, donor_name text, email text, phone text, segment text, season_cents bigint, total_cents bigint, first_gift date, monthly boolean,
    suppressed boolean, enrollments jsonb, sends integer, conversions integer
) language sql stable security definer set search_path = public as $$
    select md5(org::text || d.email), d.donor_name, case when has_role(org, 'editor') then d.email end, case when has_role(org, 'editor') then d.phone end,
        d.segment, d.season_cents, d.total_cents, d.first_gift, d.monthly,
        exists (select 1 from contact_suppressions x where x.org_id = org and x.channel = 'email' and x.address = d.email),
        (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'trigger', e.trigger, 'anchor', e.anchor, 'status', e.status, 'exit_reason', e.exit_reason) order by e.anchor), '[]'::jsonb)
            from journey_enrollments e where e.org_id = org and e.email = d.email),
        (select count(*)::int from journey_sends s join journey_enrollments e on e.id = s.enrollment_id where e.org_id = org and e.email = d.email and s.status = 'sent'),
        (select count(*)::int from journey_conversions c join journey_enrollments e on e.id = c.enrollment_id where e.org_id = org and e.email = d.email)
    from journey_donors(org) d where has_role(org, 'viewer')
    order by d.season_cents desc, d.total_cents desc
$$;

create or replace function journey_email_of(org uuid, k text) returns text language sql stable security definer set search_path = public as $$
    select d.email from journey_donors(org) d where md5(org::text || d.email) = k
$$;

/** What a donor's messages are built from, for the preview (no contact details), plus their report token. Viewer or higher. */
create or replace function journey_preview(org uuid, k text, today date default current_date) returns jsonb language plpgsql security definer set search_path = public as $$
declare e text;
begin
    if not has_role(org, 'viewer') then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    e := journey_email_of(org, k);
    if e is null then raise exception 'Donor not found'; end if;
    return journey_vars(org, e, today) || jsonb_build_object('report_token', impact_report_token(org, e), 'org', (select name from orgs where id = org), 'address', (select address from orgs where id = org));
end $$;

/** A donor's report token, to open /impact/<token> from Engage. Viewer or higher. */
create or replace function impact_report_link(org uuid, k text) returns text language plpgsql security definer set search_path = public as $$
declare e text;
begin
    if not has_role(org, 'viewer') then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    e := journey_email_of(org, k);
    if e is null then raise exception 'Donor not found'; end if;
    return impact_report_token(org, e);
end $$;

/** Takes a donor out of the journey (staff), or back in. Editor or higher. */
create or replace function journey_enrollment_set(enrollment uuid, active boolean) returns void language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
    select org_id into o from journey_enrollments where id = enrollment;
    if o is null or not has_role(o, 'editor') then raise exception 'Only editors can change this' using errcode = '42501'; end if;
    update journey_enrollments set status = case when active then 'active' else 'exited' end, exit_reason = case when active then null else 'staff' end,
        exited_at = case when active then null else now() end where id = enrollment;
end $$;

/** Recent messages with their outcome, newest first. Viewer or higher; addresses only for editors. */
create or replace function journey_sends_list(org uuid, lim integer default 200) returns table (
    id uuid, donor_name text, email text, kind text, channel text, scheduled_at timestamptz, status text, provider text, error text, sent_at timestamptz, clicked_at timestamptz, clicks integer
) language sql stable security definer set search_path = public as $$
    select s.id, e.donor_name, case when has_role(org, 'editor') then e.email end, s.kind, s.channel, s.scheduled_at, s.status, s.provider, s.error, s.sent_at, s.clicked_at, s.clicks
    from journey_sends s join journey_enrollments e on e.id = s.enrollment_id where s.org_id = org and has_role(org, 'viewer') order by s.scheduled_at desc limit least(lim, 1000)
$$;

/** The charity's impact costs. Viewer or higher. */
create or replace function impact_units_list(org uuid) returns setof impact_units language sql stable security definer set search_path = public as $$
    select * from impact_units where org_id = org and has_role(org, 'viewer') order by sort, fund
$$;

/** Replaces the impact costs: [{id?, fund, unit_cents, label, label_one?, note?}]. Editor or higher. */
create or replace function impact_units_save(org uuid, units jsonb) returns setof impact_units language plpgsql security definer set search_path = public as $$
declare u jsonb; i integer := 0;
begin
    if not has_role(org, 'editor') then raise exception 'Only editors can change impact costs' using errcode = '42501'; end if;
    if jsonb_typeof(units) <> 'array' or jsonb_array_length(units) > 30 then raise exception 'units must be a list of at most 30'; end if;
    delete from impact_units where org_id = org;
    for u in select * from jsonb_array_elements(units) loop
        i := i + 1;
        insert into impact_units (id, org_id, fund, unit_cents, label, label_one, note, sort)
        values (coalesce(nullif(u ->> 'id', '')::uuid, gen_random_uuid()), org, trim(u ->> 'fund'), (u ->> 'unit_cents')::bigint, trim(u ->> 'label'), coalesce(trim(u ->> 'label_one'), ''), coalesce(u ->> 'note', ''), i);
    end loop;
    return query select * from impact_units where org_id = org order by sort;
end $$;

/** Sets the charity's contact email: the Reply-To of every journey and pledge message. '' clears it. Admin or higher. */
create or replace function org_contact_email_save(org uuid, email text) returns text language plpgsql security definer set search_path = public as $$
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can change the contact email' using errcode = '42501'; end if;
    update orgs set contact_email = lower(trim(coalesce(email, ''))) where id = org;
    return lower(trim(coalesce(email, '')));
end $$;

-- ---------------------------------------------------------------- public: the report page and the opt-out
/**
 * What /impact/<token> shows. Public, by unguessable token: the charity, the donor's first name, the season's gifts by fund and the
 * charity's impact costs. Never contact details. Counts a view. Null if unknown.
 */
create or replace function impact_report_by_token(token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r impact_reports; out jsonb;
begin
    if impact_report_by_token.token !~ '^[0-9a-f]{64}$' then return null; end if;
    update impact_reports x set views = views + 1, viewed_at = now() where x.token = impact_report_by_token.token returning * into r;
    if r.token is null then return null; end if;
    select jsonb_build_object(
        'org_name', o.name, 'org_slug', o.slug, 'logo_url', o.logo_url, 'currency', o.currency, 'season', r.season_label, 'starts', r.starts, 'ends', r.ends,
        'first_name', (select split_part(trim(donor_name), ' ', 1) from donations where org_id = r.org_id and lower(donor_email) = r.email and status = 'succeeded' and not anonymous order by created_at desc limit 1),
        'funds', (select coalesce(jsonb_object_agg(f, c), '{}'::jsonb) from (
            select coalesce(nullif(fund, ''), 'General') as f, sum(amount_cents) as c from donations
            where org_id = r.org_id and lower(donor_email) = r.email and status = 'succeeded' and source <> 'demo'
              and (created_at at time zone 'America/New_York')::date between r.starts and r.ends group by 1) x),
        'gifts', (select count(*) from donations where org_id = r.org_id and lower(donor_email) = r.email and status = 'succeeded' and source <> 'demo'
              and (created_at at time zone 'America/New_York')::date between r.starts and r.ends),
        'units', (select coalesce(jsonb_agg(jsonb_build_object('fund', fund, 'unit_cents', unit_cents, 'label', label, 'label_one', label_one, 'note', note) order by sort, fund), '[]'::jsonb) from impact_units where org_id = r.org_id),
        'monthly', exists (select 1 from recurring_gifts g where g.org_id = r.org_id and lower(g.donor_email) = r.email and g.status = 'active'),
        'give_url', (select give_url from journey_settings where org_id = r.org_id)
    ) into out from orgs o where o.id = r.org_id;
    return out;
end $$;

/** The unsubscribe page: who the message came from. Public, by token. Null if unknown. */
create or replace function journey_unsubscribe_info(token text) returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object('org_name', o.name, 'channel', s.channel,
        'unsubscribed', exists (select 1 from contact_suppressions x where x.org_id = s.org_id and x.channel = s.channel and x.address = case when s.channel = 'email' then e.email else e.phone end))
    from journey_sends s join journey_enrollments e on e.id = s.enrollment_id join orgs o on o.id = s.org_id
    where journey_unsubscribe_info.token ~ '^[0-9a-f]{64}$' and s.token = journey_unsubscribe_info.token
$$;

/** Opts the address a message went to out of this charity's journey messages on that channel. Public, by token. Idempotent. */
create or replace function journey_unsubscribe(token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare s journey_sends; e journey_enrollments;
begin
    select * into s from journey_sends x where journey_unsubscribe.token ~ '^[0-9a-f]{64}$' and x.token = journey_unsubscribe.token;
    if s.id is null then return null; end if;
    select * into e from journey_enrollments where id = s.enrollment_id;
    insert into contact_suppressions (org_id, channel, address, reason, send_id)
    values (s.org_id, s.channel, case when s.channel = 'email' then e.email else e.phone end, 'unsubscribed', s.id) on conflict do nothing;
    if s.channel = 'email' then
        update journey_enrollments set status = 'exited', exit_reason = 'unsubscribed', exited_at = now() where org_id = s.org_id and email = e.email and status = 'active';
    end if;
    return journey_unsubscribe_info(token);
end $$;

-- ---------------------------------------------------------------- engine (service role only: the journey-run function)
/**
 * Adds donors to the journey of live orgs (or one org) as of `today` (mirrors enrollments() in model.ts). Idempotent.
 *   eid:         from Eid on, this Ramadan's donors in the audience
 *   lapsed:      from Eid on, donors who gave last Ramadan and not this one
 *   anniversary: on (or within 7 days after) the anniversary of a donor's first gift, from the first anniversary on
 * Only for triggers that have an enabled step. Donors already giving monthly are enrolled but skip the monthly ask.
 */
create or replace function journey_enroll(org uuid default null, today date default current_date) returns integer language plpgsql security definer set search_path = public as $$
declare s journey_settings; n integer := 0; k integer;
begin
    for s in select j.* from journey_settings j where j.live and (org is null or j.org_id = org) loop
        with d as (select * from journey_donors(s.org_id)),
        t as (select distinct trigger from journey_steps where org_id = s.org_id and enabled),
        c as (
            select d.*, 'eid' as trigger, s.eid_date as anchor from d where today >= s.eid_date and d.segment in ('first_time', 'returning')
                and (s.audience = 'all' or s.audience = d.segment)
            union all
            select d.*, 'lapsed', s.eid_date from d where today >= s.eid_date and d.segment = 'lapsed'
            union all
            select d.*, 'anniversary', a.on_day from d cross join lateral (
                select (d.first_gift + make_interval(years => greatest(1, extract(year from age(today, d.first_gift))::int)))::date as on_day) a
                where a.on_day <= today and a.on_day > today - 7
        ),
        ins as (
            insert into journey_enrollments (org_id, email, donor_name, phone, trigger, anchor, first_time, monthly_at_start)
            select s.org_id, c.email, c.donor_name, c.phone, c.trigger, c.anchor, c.segment = 'first_time', c.monthly from c join t using (trigger)
            where not exists (select 1 from contact_suppressions x where x.org_id = s.org_id and x.channel = 'email' and x.address = c.email)
            on conflict (org_id, email, trigger, anchor) do nothing returning 1
        )
        select count(*) into k from ins;
        n := n + k;
    end loop;
    return n;
end $$;

/**
 * Turns due steps into sends for active enrollments of live orgs (mirrors dueSends() in model.ts). Idempotent. A step that a later
 * due step of the same enrollment has overtaken is recorded as skipped, so going live late sends the latest message, not a backlog.
 * The monthly ask is skipped for donors who already gave monthly when they joined. Returns how many were added.
 */
create or replace function journey_schedule(org uuid default null, today date default current_date) returns integer language sql security definer set search_path = public as $$
    with due as (
        select e.id as enrollment_id, e.org_id, st.id as step_id, st.kind, st.day, c.channel, (e.anchor + st.day)::timestamp at time zone 'America/New_York' + interval '10 hours' as at,
            e.monthly_at_start and st.kind = 'monthly_ask' as not_for_them
        from journey_enrollments e join journey_settings j on j.org_id = e.org_id and j.live
        join journey_steps st on st.org_id = e.org_id and st.trigger = e.trigger and st.enabled and e.anchor + st.day <= today
        cross join unnest(st.channels) as c (channel)
        where (org is null or e.org_id = org) and e.status = 'active' and (c.channel = 'email' or e.phone is not null)
    ),
    latest as (select enrollment_id, max(day) as day from due where not not_for_them group by enrollment_id),
    ins as (
        insert into journey_sends (org_id, enrollment_id, step_id, kind, channel, scheduled_at, status, error)
        select d.org_id, d.enrollment_id, d.step_id, d.kind, d.channel, d.at, case when d.not_for_them or d.day < l.day then 'skipped' else 'pending' end,
            case when d.not_for_them then 'already gives monthly' when d.day < l.day then 'overtaken by a later step' end
        from due d left join latest l using (enrollment_id)
        on conflict (enrollment_id, step_id, channel) do nothing returning 1
    )
    select count(*)::int from ins
$$;

/**
 * Claims due sends of live orgs (status 'sending') with everything the message needs. Sends whose donor has left the journey or
 * opted out become skipped. A claim older than 15 minutes (a crashed run) is claimed again.
 */
drop function if exists journey_sends_claim(uuid, integer);
create or replace function journey_sends_claim(org uuid default null, lim integer default 200) returns table (
    id uuid, token text, kind text, channel text, email text, phone text, org_id uuid, org_name text, org_address text, org_contact_email text, give_url text,
    subject text, body text, sms text, cta_label text, cta_url text, vars jsonb
) language plpgsql security definer set search_path = public as $$
begin
    update journey_sends s set status = 'skipped', error = case when e.status <> 'active' then 'left the journey' else 'opted out' end
    from journey_enrollments e where e.id = s.enrollment_id and s.status = 'pending' and (org is null or s.org_id = org)
      and (e.status <> 'active' or exists (select 1 from contact_suppressions x where x.org_id = s.org_id and x.channel = s.channel and x.address = case when s.channel = 'email' then e.email else e.phone end));
    return query
    with c as (
        select s.id from journey_sends s join journey_settings j on j.org_id = s.org_id and j.live
        where (org is null or s.org_id = org) and s.scheduled_at <= now() and (s.status = 'pending' or (s.status = 'sending' and s.sent_at < now() - interval '15 minutes'))
        order by s.scheduled_at limit lim for update of s skip locked
    ),
    u as (update journey_sends s set status = 'sending', sent_at = now() from c where s.id = c.id returning s.id, s.token, s.kind, s.channel, s.enrollment_id, s.step_id)
    select u.id, u.token, u.kind, u.channel, e.email, e.phone, o.id, o.name, o.address, o.contact_email, j.give_url, st.subject, st.body, st.sms, st.cta_label, st.cta_url,
        journey_vars(o.id, e.email) || jsonb_build_object('report_token', impact_report_token(o.id, e.email))
    from u join journey_enrollments e on e.id = u.enrollment_id join orgs o on o.id = e.org_id join journey_settings j on j.org_id = o.id
    left join journey_steps st on st.id = u.step_id;
end $$;

/** A click on a tracked link: counts it and answers where to go. Service role (journey-run). Null for an unknown token. */
create or replace function journey_click(token text) returns text language sql security definer set search_path = public as $$
    update journey_sends s set clicks = clicks + 1, clicked_at = coalesce(clicked_at, now())
    where journey_click.token ~ '^[0-9a-f]{64}$' and s.token = journey_click.token returning target_url
$$;

-- ---------------------------------------------------------------- conversions: a gift from a donor in the journey
-- Credited to the message they last clicked in the 30 days before the gift, else the last one sent to them. A monthly gift takes
-- them out of the journey (every trigger).
create or replace function journey_convert() returns trigger language plpgsql security definer set search_path = public as $$
declare e journey_enrollments; snd journey_sends; k text := case when new.recurring then 'monthly' else 'gave_again' end;
begin
    if new.status <> 'succeeded' or new.donor_email is null or new.source = 'demo' then return new; end if;
    for e in select * from journey_enrollments where org_id = new.org_id and email = lower(new.donor_email) and status = 'active' and enrolled_at <= new.created_at loop
        select * into snd from journey_sends s where s.enrollment_id = e.id and s.status = 'sent' and s.sent_at <= new.created_at and s.sent_at > new.created_at - interval '30 days'
        order by s.clicked_at desc nulls last, s.sent_at desc limit 1;
        insert into journey_conversions (org_id, enrollment_id, send_id, step_id, donation_id, kind, amount_cents, at)
        values (new.org_id, e.id, snd.id, snd.step_id, new.id, k, new.amount_cents, new.created_at) on conflict do nothing;
    end loop;
    if new.recurring then
        update journey_enrollments set status = 'exited', exit_reason = 'monthly', exited_at = now() where org_id = new.org_id and email = lower(new.donor_email) and status = 'active';
    end if;
    return new;
end $$;
drop trigger if exists donations_journey on donations;
create trigger donations_journey after insert or update of status on donations for each row execute function journey_convert();

grant execute on function journey_get(uuid), journey_settings_save(uuid, jsonb), journey_steps_save(uuid, jsonb), journey_donors_list(uuid),
    journey_preview(uuid, text, date), impact_report_link(uuid, text), journey_enrollment_set(uuid, boolean), journey_sends_list(uuid, integer),
    impact_units_list(uuid), impact_units_save(uuid, jsonb), org_contact_email_save(uuid, text), impact_report_by_token(text), journey_unsubscribe_info(text), journey_unsubscribe(text), is_zakat(text) to anon, authenticated;
revoke all on function journey_seed(uuid), orgs_journey_seed(), journey_donors(uuid), journey_vars(uuid, text, date), impact_report_token(uuid, text), journey_email_of(uuid, text),
    journey_enroll(uuid, date), journey_schedule(uuid, date), journey_sends_claim(uuid, integer), journey_click(text), journey_convert() from public, anon, authenticated;
grant execute on function journey_enroll(uuid, date), journey_schedule(uuid, date), journey_sends_claim(uuid, integer), journey_click(text), journey_vars(uuid, text, date), impact_report_token(uuid, text) to service_role;
