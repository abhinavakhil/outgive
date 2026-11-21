-- Donor self-service (gift history, receipts, regular gifts) and consented checkout recovery.
-- Safe to run more than once: the demo applies it on every start.

-- ---------------------------------------------------------------- gifts
-- How it was paid (pay_method, also added by the payment_attempts migration: card, wallet, dd, bank, paypal) and the Gift Aid claimed on it.
-- Older rows have neither; lists fall back to `source`. TODO(payments): the pay function should set gift_aid_cents when it records a Gift Aid gift.
alter table donations add column if not exists pay_method text;
alter table donations add column if not exists gift_aid_cents bigint not null default 0;

-- The signed-in user's email, from auth (verified by the magic link or Google), not from the editable profile.
create or replace function my_email() returns text language sql stable security definer set search_path = public as $$
    select lower(email) from auth.users where id = auth.uid();
$$;

-- Demo gifts are made by the visitor, so they belong to the visitor. Real gifts are linked by the checkout function and the webhook.
create or replace function donation_claim() returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.donor_id is null and new.source = 'demo' then new.donor_id := auth.uid(); end if;
    return new;
end $$;
drop trigger if exists donations_claim on donations;
create trigger donations_claim before insert on donations for each row execute function donation_claim();

-- The donor's gifts across every organisation: theirs by account, or made with their email before they had one.
create or replace function my_gifts() returns table (id uuid, org_id uuid, org_name text, org_slug text, page_id uuid, page_title text, page_type text, page_slug text, amount_cents bigint, currency text, usd_cents bigint, tip_cents bigint, cover_cents bigint, gift_aid_cents bigint, recurring boolean, status text, method text, source text, message text, created_at timestamptz, receipt_sent_at timestamptz)
language sql stable security definer set search_path = public as $$
    select d.id, d.org_id, o.name, o.slug, d.page_id, p.title, p.type, p.slug, d.amount_cents, d.currency, d.usd_cents, d.tip_cents, d.cover_cents, d.gift_aid_cents, d.recurring, d.status, coalesce(nullif(d.pay_method, ''), d.source), d.source, d.message, d.created_at, d.receipt_sent_at
    from donations d join orgs o on o.id = d.org_id left join pages p on p.id = d.page_id
    where auth.uid() is not null and (d.donor_id = auth.uid() or lower(d.donor_email) = my_email()) and d.status <> 'pending' order by d.created_at desc;
$$;

-- One gift as a receipt. Null unless it is the caller's own.
create or replace function my_receipt(gift uuid) returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object('id', d.id, 'donor_name', d.donor_name, 'donor_email', d.donor_email, 'amount_cents', d.amount_cents, 'currency', d.currency, 'tip_cents', d.tip_cents, 'cover_cents', d.cover_cents,
        'gift_aid_cents', d.gift_aid_cents, 'recurring', d.recurring, 'status', d.status, 'method', coalesce(nullif(d.pay_method, ''), d.source), 'cause', d.cause, 'dedication', d.dedication, 'created_at', d.created_at,
        'page_title', (select p.title from pages p where p.id = d.page_id),
        'org', (select jsonb_build_object('name', o.name, 'slug', o.slug, 'country', o.country, 'registration_number', o.registration_number, 'website', o.website) from orgs o where o.id = d.org_id))
    from donations d where d.id = gift and auth.uid() is not null and (d.donor_id = auth.uid() or lower(d.donor_email) = my_email()) and d.status <> 'pending';
$$;

-- ---------------------------------------------------------------- regular gifts
-- One row per standing gift; each payment is still a row in donations. Made by the trigger below from the first recurring payment.
create table if not exists recurring_gifts (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    page_id uuid references pages (id) on delete set null,
    donation_id uuid references donations (id) on delete set null,
    donor_id uuid references profiles (id) on delete set null,
    donor_email text,
    amount_cents bigint not null check (amount_cents > 0),
    currency text not null references fx_rates (currency),
    every text not null default 'monthly' check (every in ('monthly', 'yearly')),
    status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
    stripe_subscription_id text unique,
    started_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    cancelled_at timestamptz
);
create index if not exists recurring_gifts_donor on recurring_gifts (donor_id);
create index if not exists recurring_gifts_email on recurring_gifts (lower(donor_email));

-- What the donor asked for, in order. It is also the outbox for Stripe: a row with applied_at null still has to reach the subscription.
-- TODO(stripe): a function (cron, or a database webhook on insert) takes rows where applied_at is null, joined to
-- recurring_gifts.stripe_subscription_id, and calls Stripe on the organisation's connected account:
--   pause  -> subscriptions.update(sub, { pause_collection: { behavior: 'void' } })
--   resume -> subscriptions.update(sub, { pause_collection: '' })
--   amount -> subscriptions.update(sub, { items: [{ id, price_data: { unit_amount: amount_cents, ... } }], proration_behavior: 'none' })
--   cancel -> subscriptions.cancel(sub)
-- then sets applied_at (service role). The webhook should also write Stripe-side changes (customer.subscription.updated / deleted) back to recurring_gifts.
create table if not exists recurring_changes (
    id uuid primary key default gen_random_uuid(),
    recurring_id uuid not null references recurring_gifts (id) on delete cascade,
    user_id uuid references profiles (id) on delete set null,
    action text not null check (action in ('pause', 'resume', 'amount', 'cancel')),
    amount_cents bigint,
    created_at timestamptz not null default now(),
    applied_at timestamptz
);
create index if not exists recurring_changes_todo on recurring_changes (created_at) where applied_at is null;

-- The first succeeded payment of a regular gift opens it; later invoices of the same subscription change nothing.
create or replace function recurring_track() returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.recurring and new.status = 'succeeded' and new.source <> 'match' and (tg_op = 'INSERT' or old.status <> 'succeeded') then
        insert into recurring_gifts (org_id, page_id, donation_id, donor_id, donor_email, amount_cents, currency, stripe_subscription_id, started_at)
        values (new.org_id, new.page_id, new.id, new.donor_id, new.donor_email, new.amount_cents, new.currency, new.stripe_subscription_id, new.created_at)
        on conflict (stripe_subscription_id) do nothing;
    end if;
    return new;
end $$;
drop trigger if exists donations_recurring on donations;
create trigger donations_recurring after insert or update on donations for each row execute function recurring_track();

-- Regular gifts that started before this table existed.
insert into recurring_gifts (org_id, page_id, donation_id, donor_id, donor_email, amount_cents, currency, stripe_subscription_id, started_at)
select distinct on (coalesce(d.stripe_subscription_id, d.id::text)) d.org_id, d.page_id, d.id, d.donor_id, d.donor_email, d.amount_cents, d.currency, d.stripe_subscription_id, d.created_at
from donations d
where d.recurring and d.status = 'succeeded' and d.source <> 'match'
    and not exists (select 1 from recurring_gifts r where r.donation_id = d.id or r.stripe_subscription_id = d.stripe_subscription_id)
order by coalesce(d.stripe_subscription_id, d.id::text), d.created_at
on conflict (stripe_subscription_id) do nothing;

-- The donor's regular gifts. pending: a change is recorded but has not reached Stripe yet.
create or replace function my_recurring() returns table (id uuid, org_id uuid, org_name text, org_slug text, page_title text, amount_cents bigint, currency text, every text, status text, started_at timestamptz, next_at timestamptz, cancelled_at timestamptz, pending boolean)
language sql stable security definer set search_path = public as $$
    select r.id, r.org_id, o.name, o.slug, p.title, r.amount_cents, r.currency, r.every, r.status, r.started_at,
        case when r.status <> 'active' then null
            when r.every = 'yearly' then r.started_at + make_interval(years => extract(year from age(now(), r.started_at))::int + 1)
            else r.started_at + make_interval(months => (extract(year from age(now(), r.started_at)) * 12 + extract(month from age(now(), r.started_at)))::int + 1) end,
        r.cancelled_at, exists (select 1 from recurring_changes c where c.recurring_id = r.id and c.applied_at is null)
    from recurring_gifts r join orgs o on o.id = r.org_id left join pages p on p.id = r.page_id
    where auth.uid() is not null and (r.donor_id = auth.uid() or lower(r.donor_email) = my_email())
    order by (r.status = 'cancelled'), r.started_at desc;
$$;

-- An organisation's regular gifts, for its members (the dashboard's Subscriptions). failed: the latest payment on the subscription did not go through.
create or replace function org_recurring(org uuid) returns table (id uuid, donor_name text, amount_cents bigint, currency text, every text, status text, method text, started_at timestamptz, next_at timestamptz, cancelled_at timestamptz, failed boolean)
language sql stable security definer set search_path = public as $$
    select r.id, coalesce(d.donor_name, 'Anonymous'), r.amount_cents, r.currency, r.every, r.status, coalesce(nullif(d.pay_method, ''), d.source, ''), r.started_at,
        case when r.status <> 'active' then null
            when r.every = 'yearly' then r.started_at + make_interval(years => extract(year from age(now(), r.started_at))::int + 1)
            else r.started_at + make_interval(months => (extract(year from age(now(), r.started_at)) * 12 + extract(month from age(now(), r.started_at)))::int + 1) end,
        r.cancelled_at,
        coalesce((select l.status = 'failed' from donations l where r.stripe_subscription_id is not null and l.stripe_subscription_id = r.stripe_subscription_id order by l.created_at desc limit 1), false)
    from recurring_gifts r left join donations d on d.id = r.donation_id
    where r.org_id = org and is_member(org)
    order by (r.status = 'cancelled'), r.started_at desc;
$$;

-- Pause, resume, change the amount of, or cancel one of the caller's own regular gifts. act: pause | resume | amount | cancel.
create or replace function recurring_change(gift uuid, act text, amount bigint default null) returns recurring_gifts language plpgsql security definer set search_path = public as $$
declare r recurring_gifts;
begin
    if auth.uid() is null then raise exception 'Sign in to manage your gifts' using errcode = '42501'; end if;
    select * into r from recurring_gifts where id = gift and (donor_id = auth.uid() or lower(donor_email) = my_email()) for update;
    if r.id is null then raise exception 'That gift is not yours to change' using errcode = '42501'; end if;
    if r.status = 'cancelled' then raise exception 'This gift has been cancelled. Start a new one from the page.'; end if;
    if act = 'pause' then
        if r.status <> 'active' then raise exception 'This gift is already paused'; end if;
        update recurring_gifts set status = 'paused', updated_at = now() where id = gift returning * into r;
    elsif act = 'resume' then
        if r.status <> 'paused' then raise exception 'This gift is already running'; end if;
        update recurring_gifts set status = 'active', updated_at = now() where id = gift returning * into r;
    elsif act = 'amount' then
        if amount is null or amount < 200 or amount > 1000000 then raise exception 'Choose an amount between 2 and 10,000'; end if;
        update recurring_gifts set amount_cents = amount, updated_at = now() where id = gift returning * into r;
    elsif act = 'cancel' then
        update recurring_gifts set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = gift returning * into r;
    else
        raise exception 'Unknown change';
    end if;
    -- With no subscription behind it (a demo or offline gift) there is nothing to sync, so the change is applied already.
    insert into recurring_changes (recurring_id, user_id, action, amount_cents, applied_at)
    values (gift, auth.uid(), act, case when act = 'amount' then amount end, case when r.stripe_subscription_id is null then now() end);
    return r;
end $$;

-- ---------------------------------------------------------------- checkout recovery
-- A donor who ticked "email me a link to finish this gift" and then left. Only what the link needs to rebuild the form: never card or bank details.
-- TODO(email): sending is not built. A scheduled function (service role) would take
--   select * from checkout_recoveries where sent_at is null and consumed_at is null and expires_at > now() and created_at < now() - interval '1 hour'
-- send one email each and set sent_at. Payload:
--   { to: email, first: draft ->> 'first', campaign, amount: draft -> 'amount', freq: draft ->> 'freq', resume_url: resumeLink(campaign, token), expires_at }
-- (resumeLink is in src/features/checkout/recovery.ts). No second email, and none once consumed_at is set.
create table if not exists checkout_recoveries (
    id uuid primary key default gen_random_uuid(),
    token text not null unique check (length(token) between 16 and 64),
    email text not null,
    campaign text not null check (length(campaign) between 1 and 200),
    draft jsonb not null default '{}'::jsonb,
    consented_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default now() + interval '7 days',
    sent_at timestamptz,
    consumed_at timestamptz
);
create index if not exists checkout_recoveries_email on checkout_recoveries (email, created_at desc);

-- Stores (or refreshes) a recovery request. p: { token, email, campaign, consent: true, draft }. Refuses without consent.
-- False when the request was not stored: three are already open for that address today, or the token is used up.
create or replace function checkout_recovery_save(p jsonb) returns boolean language plpgsql security definer set search_path = public as $$
declare e text := lower(btrim(coalesce(p ->> 'email', ''))); t text := p ->> 'token'; d jsonb := coalesce(p -> 'draft', '{}'::jsonb); n int;
begin
    if (p ->> 'consent')::boolean is not true then raise exception 'A recovery email needs the donor''s consent'; end if;
    if e !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(e) > 254 then raise exception 'That email address does not look right'; end if;
    if (select count(*) from checkout_recoveries where email = e and token <> t and consumed_at is null and created_at > now() - interval '1 day') >= 3 then return false; end if;
    -- Keep only the fields a draft may hold, whatever was sent.
    d := jsonb_strip_nulls(jsonb_build_object('amount', d -> 'amount', 'freq', d -> 'freq', 'extras', d -> 'extras', 'fund', d -> 'fund', 'ga', d -> 'ga', 'first', left(d ->> 'first', 80), 'step', d -> 'step'));
    insert into checkout_recoveries (token, email, campaign, draft) values (t, e, p ->> 'campaign', d)
    on conflict (token) do update set email = excluded.email, draft = excluded.draft where checkout_recoveries.consumed_at is null;
    get diagnostics n = row_count;
    return n > 0;
end $$;

-- The draft behind a resume link, while it is unused and in date. The token is the only key.
create or replace function checkout_recovery_get(t text) returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object('campaign', campaign, 'email', email, 'draft', draft, 'created_at', created_at) from checkout_recoveries where token = t and consumed_at is null and expires_at > now();
$$;

-- Closes a request: the gift was made, or the donor withdrew consent. No email goes out afterwards.
create or replace function checkout_recovery_done(t text) returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
    update checkout_recoveries set consumed_at = now() where token = t and consumed_at is null;
    get diagnostics n = row_count;
    return n > 0;
end $$;

-- ---------------------------------------------------------------- row-level security
alter table recurring_gifts enable row level security;
alter table recurring_changes enable row level security;
alter table checkout_recoveries enable row level security;
-- Donors see their own regular gifts, members their organisation's. Writes go through recurring_change or the service role.
drop policy if exists "own recurring gifts" on recurring_gifts;
create policy "own recurring gifts" on recurring_gifts for select using (donor_id = auth.uid() or lower(donor_email) = my_email() or is_member(org_id));
drop policy if exists "own recurring changes" on recurring_changes;
create policy "own recurring changes" on recurring_changes for select using (exists (select 1 from recurring_gifts r where r.id = recurring_id));
-- checkout_recoveries has no policy: only the functions above and the service role reach it.
revoke all on recurring_gifts, recurring_changes, checkout_recoveries from anon, authenticated;
grant select on recurring_gifts, recurring_changes to anon, authenticated;
grant all on recurring_gifts, recurring_changes, checkout_recoveries to service_role;
grant execute on function my_email(), my_gifts(), my_receipt(uuid), my_recurring(), org_recurring(uuid), recurring_change(uuid, text, bigint), checkout_recovery_save(jsonb), checkout_recovery_get(text), checkout_recovery_done(text) to anon, authenticated, service_role;
