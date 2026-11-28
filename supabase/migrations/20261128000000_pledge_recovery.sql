-- Outgive Engage: pledges from live nights and dinners, the payments against them, and automated recovery of unpaid pledges.
-- A pledge is a promise in the room. Payments land in pledge_payments: offline ones (cash, check, Zelle, a card on a terminal) entered by
-- staff, online ones from the pledge's pay link (a donation row with pledge_id, linked by a trigger when it succeeds). paid_cents on
-- the pledge is kept in step by a trigger, so "paid" is never set by hand.
-- Recovery: each org has an editable list of steps (day after the pledge, what to do, on which channel). pledge_recovery_schedule()
-- turns due steps into rows in pledge_reminders (the outbox); the pledge-recovery edge function claims and sends them.
-- Reads: viewer or higher. Writes: editor or higher, through the functions below. Money in integer cents. Safe to run more than once.

-- ---------------------------------------------------------------- pledges
create table if not exists pledges (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    donor_name text not null check (length(donor_name) between 1 and 120),
    donor_email text check (donor_email is null or donor_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
    donor_phone text check (donor_phone is null or donor_phone ~ '^\+[1-9][0-9]{7,14}$'),  -- E.164, for SMS
    event text not null default '' check (length(event) <= 80),                              -- "Night 27 dinner"
    amount_cents bigint not null check (amount_cents > 0),
    paid_cents bigint not null default 0,                                                   -- sum of pledge_payments, kept by trigger
    currency text not null default 'USD' references fx_rates (currency),
    pledged_at timestamptz not null default now(),                                          -- day 0 of the recovery sequence
    due_date date,
    written_off boolean not null default false,
    reminders_paused boolean not null default false,                                        -- the donor asked us to stop
    note text not null default '' check (length(note) <= 500),
    -- The one-tap pay link: /pledge/<pay_token>. 64 hex chars from two v4 UUIDs (244 random bits), unguessable, no sign-in needed.
    pay_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    created_by uuid references profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists pledges_org on pledges (org_id, pledged_at desc);
drop trigger if exists pledges_updated on pledges;
create trigger pledges_updated before update on pledges for each row execute function set_updated_at();

create table if not exists pledge_payments (
    id uuid primary key default gen_random_uuid(),
    pledge_id uuid not null references pledges (id) on delete cascade,
    amount_cents bigint not null check (amount_cents > 0),
    method text not null check (method in ('pay_link', 'card', 'ach', 'check', 'cash', 'zelle', 'other')),
    donation_id uuid unique references donations (id) on delete cascade,  -- set for pay-link payments; null for staff-entered ones
    reference text not null default '',                                  -- check number, Zelle confirmation
    received_at timestamptz not null default now(),
    recorded_by uuid references profiles (id) on delete set null,
    created_at timestamptz not null default now()
);
create index if not exists pledge_payments_pledge on pledge_payments (pledge_id);

alter table donations add column if not exists pledge_id uuid references pledges (id) on delete set null;

-- ---------------------------------------------------------------- recovery steps and the outbox
create table if not exists pledge_steps (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    day integer not null check (day between 0 and 365),
    action text not null check (action in ('thank_you', 'pay_link', 'reminder', 'split_offer', 'call_list', 'write_off_review')),
    -- Messages go out on sms and/or email; call_list and write_off_review are tasks for the team.
    channels text[] not null check (case when action in ('call_list', 'write_off_review') then channels = '{task}' else cardinality(channels) > 0 and channels <@ '{sms,email}' end),
    enabled boolean not null default true,
    unique (org_id, day, action)
);

create table if not exists pledge_reminders (
    id uuid primary key default gen_random_uuid(),
    pledge_id uuid not null references pledges (id) on delete cascade,
    org_id uuid not null references orgs (id) on delete cascade,
    step_id uuid references pledge_steps (id) on delete set null,
    action text not null,
    channel text not null check (channel in ('sms', 'email', 'task')),
    scheduled_at timestamptz not null,
    -- Messages: pending -> sending -> sent | failed | skipped. Tasks: open -> done.
    status text not null check (status in ('pending', 'sending', 'sent', 'failed', 'skipped', 'open', 'done')),
    provider text,             -- who sent it: resend, console (nothing really sent)
    error text,
    sent_at timestamptz,       -- while 'sending', when it was claimed
    created_at timestamptz not null default now(),
    unique (pledge_id, step_id, channel)
);
create index if not exists pledge_reminders_due on pledge_reminders (status, scheduled_at) where status in ('pending', 'sending');
create index if not exists pledge_reminders_org on pledge_reminders (org_id, created_at desc);

alter table pledges enable row level security;
alter table pledge_payments enable row level security;
alter table pledge_steps enable row level security;
alter table pledge_reminders enable row level security;
drop policy if exists "team reads pledges" on pledges;
-- The table itself is editor-only because it holds donors' contact details; viewers read names and amounts through pledges_list.
create policy "team reads pledges" on pledges for select using (has_role(org_id, 'editor'));
drop policy if exists "team reads pledge payments" on pledge_payments;
create policy "team reads pledge payments" on pledge_payments for select using (exists (select 1 from pledges p where p.id = pledge_id and has_role(p.org_id, 'viewer')));
drop policy if exists "team reads pledge steps" on pledge_steps;
create policy "team reads pledge steps" on pledge_steps for select using (has_role(org_id, 'viewer'));
drop policy if exists "team reads pledge reminders" on pledge_reminders;
create policy "team reads pledge reminders" on pledge_reminders for select using (has_role(org_id, 'viewer'));
-- No write policies: writes go through the functions below or the service role.
grant select on pledges, pledge_payments, pledge_steps, pledge_reminders to authenticated;
grant all on pledges, pledge_payments, pledge_steps, pledge_reminders to service_role;

-- ---------------------------------------------------------------- default steps for every org
create or replace function pledge_steps_seed(org uuid) returns void language sql security definer set search_path = public as $$
    insert into pledge_steps (org_id, day, action, channels, enabled)
    select org, d.day, d.action, d.channels, d.enabled from (values
        (0, 'thank_you', '{sms}'::text[], true),          -- Night 0: thank-you SMS with the one-tap pay link
        (2, 'pay_link', '{email}'::text[], true),         -- Day 2: "your pledge, pay in one tap"
        (7, 'reminder', '{email,sms}'::text[], true),     -- Day 7: reminder
        (14, 'split_offer', '{email}'::text[], true),     -- Day 14: offer three monthly payments
        (21, 'call_list', '{task}'::text[], true),        -- Day 21: onto the volunteer call list
        (45, 'write_off_review', '{task}'::text[], false) -- Day 45: review for write-off (off by default)
    ) as d (day, action, channels, enabled)
    on conflict (org_id, day, action) do nothing
$$;
create or replace function orgs_pledge_steps() returns trigger language plpgsql security definer set search_path = public as $$
begin perform pledge_steps_seed(new.id); return new; end $$;
drop trigger if exists orgs_pledge_steps on orgs;
create trigger orgs_pledge_steps after insert on orgs for each row execute function orgs_pledge_steps();
select pledge_steps_seed(id) from orgs where not exists (select 1 from pledge_steps s where s.org_id = orgs.id);

-- ---------------------------------------------------------------- paid is derived, never typed
create or replace function pledge_paid_sync() returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid := case when tg_op = 'DELETE' then old.pledge_id else new.pledge_id end;
begin
    update pledges set paid_cents = (select coalesce(sum(amount_cents), 0) from pledge_payments where pledge_id = pid) where id = pid;
    if tg_op = 'UPDATE' and old.pledge_id <> new.pledge_id then
        update pledges set paid_cents = (select coalesce(sum(amount_cents), 0) from pledge_payments where pledge_id = old.pledge_id) where id = old.pledge_id;
    end if;
    return null;
end $$;
drop trigger if exists pledge_payments_sync on pledge_payments;
create trigger pledge_payments_sync after insert or update or delete on pledge_payments for each row execute function pledge_paid_sync();

-- A pay-link gift that succeeds (pay function or stripe-webhook, whichever marks it first) becomes a payment on its pledge; a refund or
-- a dispute takes it off again, and a won dispute puts it back.
create or replace function donation_pledge_sync() returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.pledge_id is null then return new; end if;
    if new.status = 'succeeded' then
        insert into pledge_payments (pledge_id, amount_cents, method, donation_id) values (new.pledge_id, new.amount_cents, 'pay_link', new.id) on conflict (donation_id) do nothing;
    elsif new.status in ('refunded', 'disputed') then
        delete from pledge_payments where donation_id = new.id;
    end if;
    return new;
end $$;
drop trigger if exists donations_pledge on donations;
create trigger donations_pledge after insert or update of status on donations for each row execute function donation_pledge_sync();

-- ---------------------------------------------------------------- status (mirrors pledgeStatus in src/features/engage/pledges/model.ts)
-- ponytail: "today" is the database's date (UTC); pass the org's local date as `today` if a day's difference matters.
create or replace function pledge_status(amount bigint, paid bigint, due date, off boolean, today date default current_date) returns text language sql immutable as $$
    select case when off then 'written_off' when paid >= amount then 'paid' when due < today then 'overdue' when paid > 0 then 'part_paid' else 'open' end
$$;

/** US numbers typed any way become +1XXXXXXXXXX; a number starting with + keeps its country code. Null when it is not a phone number. */
create or replace function phone_e164(t text) returns text language sql immutable as $$
    select case
        when d = '' then null
        when trim(t) like '+%' and length(d) between 8 and 15 then '+' || d
        when length(d) = 10 then '+1' || d
        when length(d) = 11 and left(d, 1) = '1' then '+' || d
    end from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as d) x
$$;

-- ---------------------------------------------------------------- the SQL API for the team
/** Every pledge of an org with its status, reminders sent, latest payment method and payments. Viewer or higher; email and phone are null below editor. */
create or replace function pledges_list(org uuid, today date default current_date) returns table (
    id uuid, donor_name text, donor_email text, donor_phone text, event text, amount_cents bigint, paid_cents bigint, currency text,
    pledged_at timestamptz, due_date date, written_off boolean, reminders_paused boolean, note text, pay_token text, created_at timestamptz,
    status text, reminders_sent integer, method text, payments jsonb
) language sql stable security definer set search_path = public as $$
    select p.id, p.donor_name, case when has_role(org, 'editor') then p.donor_email end, case when has_role(org, 'editor') then p.donor_phone end, p.event, p.amount_cents, p.paid_cents, p.currency,
        p.pledged_at, p.due_date, p.written_off, p.reminders_paused, p.note, p.pay_token, p.created_at,
        pledge_status(p.amount_cents, p.paid_cents, p.due_date, p.written_off, today),
        (select count(*)::int from pledge_reminders r where r.pledge_id = p.id and r.status = 'sent'),
        (select x.method from pledge_payments x where x.pledge_id = p.id order by x.received_at desc limit 1),
        (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'amount_cents', x.amount_cents, 'method', x.method, 'reference', x.reference, 'received_at', x.received_at, 'online', x.donation_id is not null) order by x.received_at), '[]'::jsonb) from pledge_payments x where x.pledge_id = p.id)
    from pledges p where p.org_id = org and has_role(org, 'viewer') order by p.pledged_at desc, p.created_at desc
$$;

/**
 * Creates a pledge (no id) or changes one (id; only the keys given change). Write-off and pausing reminders are changes too:
 * {id, written_off: true}. Editor or higher. Currency defaults to the org's and cannot change later.
 */
create or replace function pledge_save(org uuid, p jsonb) returns pledges language plpgsql security definer set search_path = public as $$
declare r pledges; pid uuid := nullif(p ->> 'id', '')::uuid; ph text;
begin
    if not has_role(org, 'editor') then raise exception 'Only editors can change pledges' using errcode = '42501'; end if;
    if p ? 'donor_phone' then
        ph := phone_e164(p ->> 'donor_phone');
        if ph is null and trim(coalesce(p ->> 'donor_phone', '')) <> '' then raise exception 'That phone number does not look right'; end if;
    end if;
    if pid is null then
        insert into pledges (org_id, donor_name, donor_email, donor_phone, event, amount_cents, currency, pledged_at, due_date, note, created_by)
        values (org, trim(p ->> 'donor_name'), nullif(lower(trim(p ->> 'donor_email')), ''), ph, coalesce(trim(p ->> 'event'), ''), (p ->> 'amount_cents')::bigint,
            coalesce(upper(p ->> 'currency'), (select currency from orgs where id = org)), coalesce((p ->> 'pledged_at')::timestamptz, now()),
            nullif(p ->> 'due_date', '')::date, coalesce(p ->> 'note', ''), auth.uid())
        returning * into r;
    else
        update pledges set
            donor_name = coalesce(trim(p ->> 'donor_name'), donor_name),
            donor_email = case when p ? 'donor_email' then nullif(lower(trim(p ->> 'donor_email')), '') else donor_email end,
            donor_phone = case when p ? 'donor_phone' then ph else donor_phone end,
            event = coalesce(trim(p ->> 'event'), event),
            amount_cents = coalesce((p ->> 'amount_cents')::bigint, amount_cents),
            pledged_at = coalesce((p ->> 'pledged_at')::timestamptz, pledged_at),
            due_date = case when p ? 'due_date' then nullif(p ->> 'due_date', '')::date else due_date end,
            written_off = coalesce((p ->> 'written_off')::boolean, written_off),
            reminders_paused = coalesce((p ->> 'reminders_paused')::boolean, reminders_paused),
            note = coalesce(p ->> 'note', note)
        where id = pid and org_id = org returning * into r;
        if r.id is null then raise exception 'Pledge not found'; end if;
    end if;
    return r;
end $$;

/** Staff record money that came in another way: {amount_cents, method: card|ach|check|cash|zelle|other, reference?, received_at?}. Editor or higher. */
create or replace function pledge_payment_add(pledge uuid, p jsonb) returns pledge_payments language plpgsql security definer set search_path = public as $$
declare r pledge_payments; o uuid;
begin
    select org_id into o from pledges where id = pledge;
    if o is null or not has_role(o, 'editor') then raise exception 'Only editors can record payments' using errcode = '42501'; end if;
    if coalesce(p ->> 'method', '') not in ('card', 'ach', 'check', 'cash', 'zelle', 'other') then raise exception 'method must be card, ach, check, cash, zelle or other'; end if;
    insert into pledge_payments (pledge_id, amount_cents, method, reference, received_at, recorded_by)
    values (pledge, (p ->> 'amount_cents')::bigint, p ->> 'method', left(coalesce(p ->> 'reference', ''), 80), coalesce((p ->> 'received_at')::timestamptz, now()), auth.uid())
    returning * into r;
    return r;
end $$;

/** Removes a payment staff entered by mistake. Pay-link payments come off only through a refund. Editor or higher. */
create or replace function pledge_payment_remove(payment uuid) returns void language plpgsql security definer set search_path = public as $$
declare o uuid; online boolean;
begin
    select p.org_id, x.donation_id is not null into o, online from pledge_payments x join pledges p on p.id = x.pledge_id where x.id = payment;
    if o is null or not has_role(o, 'editor') then raise exception 'Only editors can change payments' using errcode = '42501'; end if;
    if online then raise exception 'This was paid online; refund it instead'; end if;
    delete from pledge_payments where id = payment;
end $$;

/**
 * The KPIs and the pledged-against-paid report (mirrors kpis/byEvent in model.ts). Viewer or higher.
 * outstanding = unpaid balance of pledges not written off; written_off = the unpaid balance that was written off.
 * ponytail: sums across currencies as if one; an org takes pledges in one currency. Group by currency if that changes.
 */
create or replace function pledge_report(org uuid, today date default current_date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
    if not has_role(org, 'viewer') then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    with p as (select *, greatest(amount_cents - paid_cents, 0) as left_cents from pledges where org_id = org)
    select jsonb_build_object(
        'totals', (select jsonb_build_object(
            'count', count(*),
            'pledged_cents', coalesce(sum(amount_cents), 0),
            'collected_cents', coalesce(sum(paid_cents), 0),
            'collected_pct', case when sum(amount_cents) > 0 then round(100.0 * sum(paid_cents) / sum(amount_cents))::int else 0 end,
            'outstanding_cents', coalesce(sum(left_cents) filter (where not written_off), 0),
            'outstanding_count', count(*) filter (where not written_off and left_cents > 0),
            'overdue_count', count(*) filter (where pledge_status(amount_cents, paid_cents, due_date, written_off, today) = 'overdue'),
            'written_off_cents', coalesce(sum(left_cents) filter (where written_off), 0),
            'written_off_count', count(*) filter (where written_off)) from p),
        'by_event', (select coalesce(jsonb_agg(e order by e.pledged_cents desc, e.event), '[]'::jsonb) from (
            select event, count(*) as count, sum(amount_cents) as pledged_cents, sum(paid_cents) as collected_cents,
                coalesce(sum(left_cents) filter (where not written_off), 0) as outstanding_cents, coalesce(sum(left_cents) filter (where written_off), 0) as written_off_cents
            from p group by event) e),
        'by_method', (select coalesce(jsonb_object_agg(method, cents), '{}'::jsonb) from (select x.method, sum(x.amount_cents) as cents from pledge_payments x join p on p.id = x.pledge_id group by 1) m)
    ) into r;
    return r;
end $$;

/** The org's recovery steps, in day order. Viewer or higher. */
create or replace function pledge_steps_list(org uuid) returns setof pledge_steps language sql stable security definer set search_path = public as $$
    select * from pledge_steps where org_id = org and has_role(org, 'viewer') order by day, action
$$;

/** Replaces the org's steps with this list: [{id?, day, action, channels, enabled}]. Steps left out are removed. Editor or higher. */
create or replace function pledge_steps_save(org uuid, steps jsonb) returns setof pledge_steps language plpgsql security definer set search_path = public as $$
declare s jsonb; keep uuid[]; sid uuid;
begin
    if not has_role(org, 'editor') then raise exception 'Only editors can change the recovery steps' using errcode = '42501'; end if;
    if jsonb_typeof(steps) <> 'array' or jsonb_array_length(steps) > 20 then raise exception 'steps must be a list of at most 20'; end if;
    select coalesce(array_agg((e ->> 'id')::uuid), '{}') into keep from jsonb_array_elements(steps) e where nullif(e ->> 'id', '') is not null;
    delete from pledge_steps where org_id = org and id <> all (keep);
    for s in select * from jsonb_array_elements(steps) loop
        sid := nullif(s ->> 'id', '')::uuid;
        if sid is null then
            insert into pledge_steps (org_id, day, action, channels, enabled)
            values (org, (s ->> 'day')::int, s ->> 'action', array(select jsonb_array_elements_text(s -> 'channels')), coalesce((s ->> 'enabled')::boolean, true));
        else
            update pledge_steps set day = (s ->> 'day')::int, action = s ->> 'action', channels = array(select jsonb_array_elements_text(s -> 'channels')), enabled = coalesce((s ->> 'enabled')::boolean, true)
            where id = sid and org_id = org;
            if not found then raise exception 'Step not found'; end if;
        end if;
    end loop;
    return query select * from pledge_steps where org_id = org order by day, action;
end $$;

/** Reminders and tasks for an org (or one pledge), newest first: the history, and the call list (channel 'task', status 'open'). Viewer or higher; email and phone are null below editor. */
create or replace function pledge_reminders_list(org uuid, pledge uuid default null) returns table (
    id uuid, pledge_id uuid, donor_name text, donor_phone text, donor_email text, event text, action text, channel text,
    scheduled_at timestamptz, status text, provider text, error text, sent_at timestamptz
) language sql stable security definer set search_path = public as $$
    select r.id, r.pledge_id, p.donor_name, case when has_role(org, 'editor') then p.donor_phone end, case when has_role(org, 'editor') then p.donor_email end, p.event, r.action, r.channel, r.scheduled_at, r.status, r.provider, r.error, r.sent_at
    from pledge_reminders r join pledges p on p.id = r.pledge_id
    where r.org_id = org and (pledge is null or r.pledge_id = pledge) and has_role(org, 'viewer') order by r.scheduled_at desc limit 500
$$;

/** Ticks a call-list or write-off-review task done (or reopens it). Editor or higher. */
create or replace function pledge_task_done(reminder uuid, done boolean default true) returns void language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
    select org_id into o from pledge_reminders where id = reminder and channel = 'task';
    if o is null or not has_role(o, 'editor') then raise exception 'Only editors can change tasks' using errcode = '42501'; end if;
    update pledge_reminders set status = case when done then 'done' else 'open' end where id = reminder;
end $$;

-- ---------------------------------------------------------------- the pay link (public)
/** What the pay-link page shows. Public, by unguessable token; only the donor's first name, never their contact details. Null if unknown. */
create or replace function pledge_by_token(token text) returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
        'org_id', o.id, 'org_slug', o.slug, 'org_name', o.name, 'first_name', split_part(p.donor_name, ' ', 1), 'event', p.event,
        'amount_cents', p.amount_cents, 'paid_cents', p.paid_cents, 'remaining_cents', greatest(p.amount_cents - p.paid_cents, 0), 'currency', p.currency,
        'due_date', p.due_date, 'status', pledge_status(p.amount_cents, p.paid_cents, p.due_date, p.written_off),
        'accepts', (select coalesce(jsonb_agg(distinct a.provider), '[]'::jsonb) from payment_accounts a where a.org_id = o.id and a.enabled and a.charges_enabled))
    from pledges p join orgs o on o.id = p.org_id where token ~ '^[0-9a-f]{64}$' and p.pay_token = token
$$;

-- ---------------------------------------------------------------- recovery engine (service role only: the pledge-recovery function)
/**
 * Turns due steps into reminders for open pledges (not paid, not written off, not paused), for one org or all. Idempotent.
 * A message step that a later message step has already overtaken is recorded as skipped, so a pledge entered late, or a missed
 * cron run, sends only the latest message instead of the whole backlog. Tasks are always created, as open. Returns how many were added.
 */
create or replace function pledge_recovery_schedule(org uuid default null) returns integer language sql security definer set search_path = public as $$
    with due as (
        select p.id as pledge_id, p.org_id, s.id as step_id, s.action, s.day, c.channel, p.pledged_at + make_interval(days => s.day) as at
        from pledges p join pledge_steps s on s.org_id = p.org_id and s.enabled and p.pledged_at + make_interval(days => s.day) <= now()
        cross join unnest(s.channels) as c (channel)
        where (org is null or p.org_id = org) and not p.written_off and not p.reminders_paused and p.paid_cents < p.amount_cents
    ),
    latest as (select pledge_id, max(day) as day from due where channel <> 'task' group by pledge_id),
    ins as (
        insert into pledge_reminders (pledge_id, org_id, step_id, action, channel, scheduled_at, status)
        select d.pledge_id, d.org_id, d.step_id, d.action, d.channel, d.at, case when d.channel = 'task' then 'open' when d.day < l.day then 'skipped' else 'pending' end
        from due d left join latest l using (pledge_id)
        on conflict (pledge_id, step_id, channel) do nothing
        returning 1
    )
    select count(*)::int from ins
$$;

/**
 * Claims due messages for sending (status 'sending'), with what the message needs. Messages whose pledge has since been paid,
 * written off or paused become skipped. A claim older than 15 minutes (a crashed run) is claimed again.
 */
create or replace function pledge_reminders_claim(org uuid default null, lim integer default 200) returns table (
    id uuid, action text, channel text, donor_name text, donor_email text, donor_phone text, event text,
    amount_cents bigint, paid_cents bigint, currency text, due_date date, pay_token text, org_name text
) language plpgsql security definer set search_path = public as $$
begin
    update pledge_reminders r set status = 'skipped', error = 'pledge closed' from pledges p
    where p.id = r.pledge_id and r.status = 'pending' and (org is null or r.org_id = org) and (p.written_off or p.reminders_paused or p.paid_cents >= p.amount_cents);
    return query
    with c as (
        select r.id from pledge_reminders r
        where (org is null or r.org_id = org) and r.scheduled_at <= now() and (r.status = 'pending' or (r.status = 'sending' and r.sent_at < now() - interval '15 minutes'))
        order by r.scheduled_at limit lim for update skip locked
    ),
    u as (update pledge_reminders r set status = 'sending', sent_at = now() from c where r.id = c.id returning r.id, r.pledge_id, r.action, r.channel)
    select u.id, u.action, u.channel, p.donor_name, p.donor_email, p.donor_phone, p.event, p.amount_cents, p.paid_cents, p.currency, p.due_date, p.pay_token, o.name
    from u join pledges p on p.id = u.pledge_id join orgs o on o.id = p.org_id;
end $$;

grant execute on function pledge_status(bigint, bigint, date, boolean, date), phone_e164(text), pledges_list(uuid, date), pledge_save(uuid, jsonb),
    pledge_payment_add(uuid, jsonb), pledge_payment_remove(uuid), pledge_report(uuid, date), pledge_steps_list(uuid), pledge_steps_save(uuid, jsonb),
    pledge_reminders_list(uuid, uuid), pledge_task_done(uuid, boolean), pledge_by_token(text) to anon, authenticated;
revoke all on function pledge_steps_seed(uuid), orgs_pledge_steps(), pledge_paid_sync(), donation_pledge_sync(), pledge_recovery_schedule(uuid), pledge_reminders_claim(uuid, integer) from public, anon, authenticated;
grant execute on function pledge_recovery_schedule(uuid), pledge_reminders_claim(uuid, integer) to service_role;

-- ---------------------------------------------------------------- org_insights counts money staff took against pledges
-- Same as in 20261127010000, plus pledge payments entered by staff (cash, check, Zelle, ACH, card; not pay-link ones, which are
-- already donations) in raised_cents and as offline_pledge_cents. by_day, by_fund and top stay donations-only.
-- ponytail: the public board and bio_get still count donations only; mirror offline pledge payments into donations if they should show there.
create or replace function org_insights(org uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; offline bigint;
begin
    if not has_role(org, 'viewer') then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    select coalesce(sum(x.amount_cents), 0) into offline from pledge_payments x join pledges p on p.id = x.pledge_id where p.org_id = org and x.method <> 'pay_link';
    with paid as (select * from donations where org_id = org and status = 'succeeded'),
    split as (select k as cause, sum(v::bigint) as cents from paid, jsonb_each_text(coalesce(paid.details -> 'split', '{}'::jsonb)) as e(k, v) group by k)
    select jsonb_build_object(
        'raised_cents', (select coalesce(sum(amount_cents), 0) from paid) + offline,
        'offline_pledge_cents', offline,
        'gifts', (select count(*) from paid),
        'donors', (select count(distinct coalesce(lower(donor_email), id::text)) from paid),
        'gift_aid_cents', (select coalesce(round(sum(amount_cents) * 0.25), 0) from paid where gift_aid),
        'tips_cents', (select coalesce(sum(tip_cents), 0) from paid),
        'by_day', (select coalesce(jsonb_object_agg(day, cents), '{}'::jsonb) from (select (created_at at time zone 'Europe/London')::date as day, sum(amount_cents) as cents from paid group by 1) d),
        'by_cause', (select coalesce(jsonb_object_agg(cause, cents), '{}'::jsonb) from split),
        'by_fund', (select coalesce(jsonb_object_agg(fund, cents), '{}'::jsonb) from (select coalesce(nullif(fund, ''), 'General') as fund, sum(amount_cents) as cents from paid group by 1) f),
        'top', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select case when anonymous then 'Anonymous' else donor_name end as name, sum(amount_cents) as amount_cents from paid group by 1 order by 2 desc limit 5) t)
    ) into r;
    return r;
end $$;
