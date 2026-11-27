-- The payment service (supabase/functions/_shared/payments) and the live Ramadan page (/ramadhan).
-- Safe to run more than once.

-- ---------------------------------------------------------------- payment accounts
-- One row per provider a charity is connected to. The pay function routes each gift to one of these (registry.ts route()).
-- A new provider needs no schema change: it is a new `provider` value. The charity is always the payee.
create table if not exists payment_accounts (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    provider text not null check (provider ~ '^[a-z0-9_]{2,30}$'),
    external_id text not null,
    charges_enabled boolean not null default false,
    payouts_enabled boolean not null default false,
    enabled boolean not null default true,
    priority integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (org_id, provider),
    unique (provider, external_id)
);
alter table payment_accounts enable row level security;
drop policy if exists "members see accounts" on payment_accounts;
create policy "members see accounts" on payment_accounts for select using (is_member(org_id));
grant select on payment_accounts to authenticated;
grant all on payment_accounts to service_role;
drop trigger if exists payment_accounts_updated on payment_accounts;
create trigger payment_accounts_updated before update on payment_accounts for each row execute function set_updated_at();

-- The connect function and stripe-webhook still write orgs.stripe_* and orgs.paypal_merchant_id; this keeps payment_accounts in step.
create or replace function org_accounts_sync() returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.stripe_account_id is not null then
        insert into payment_accounts (org_id, provider, external_id, charges_enabled, payouts_enabled)
        values (new.id, 'stripe', new.stripe_account_id, new.stripe_charges_enabled, new.stripe_payouts_enabled)
        on conflict (org_id, provider) do update set external_id = excluded.external_id, charges_enabled = excluded.charges_enabled, payouts_enabled = excluded.payouts_enabled;
    end if;
    if new.paypal_merchant_id is not null then
        insert into payment_accounts (org_id, provider, external_id, charges_enabled, payouts_enabled, priority)
        values (new.id, 'paypal', new.paypal_merchant_id, true, true, 10)
        on conflict (org_id, provider) do update set external_id = excluded.external_id;
    elsif tg_op = 'UPDATE' and old.paypal_merchant_id is not null then
        delete from payment_accounts where org_id = new.id and provider = 'paypal';
    end if;
    return new;
end $$;
drop trigger if exists orgs_accounts_sync on orgs;
create trigger orgs_accounts_sync after insert or update of stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, paypal_merchant_id on orgs
    for each row execute function org_accounts_sync();
revoke all on function org_accounts_sync() from public, anon, authenticated;
-- Backfill what is already connected.
update orgs set stripe_account_id = stripe_account_id where stripe_account_id is not null or paypal_merchant_id is not null;

-- ---------------------------------------------------------------- donations: what the payment service records
alter table donations add column if not exists provider text;
alter table donations add column if not exists fund text not null default '';            -- Zakat, Sadaqah, Sadaqah Jariyah, Lillah
alter table donations add column if not exists gift_aid boolean not null default false;
alter table donations add column if not exists details jsonb not null default '{}'::jsonb; -- basket, nights, Gift Aid address, split by cause
create index if not exists donations_fund on donations (org_id, fund) where fund <> '';

-- ---------------------------------------------------------------- the charity's Ramadan page
-- The page's content and look (BioPage in src/features/launch/bio/model.ts); the numbers on it come from donations, below.
alter table orgs add column if not exists bio jsonb;

/** The Ramadan page for an org: its saved content, and live totals from paid gifts. Public: names respect anonymity, no emails. */
create or replace function bio_get(s text) returns jsonb language sql stable security definer set search_path = public as $$
    with o as (select * from orgs where slug = lower(s)),
    paid as (select d.* from donations d join o on d.org_id = o.id where d.status = 'succeeded'),
    split as (select k as cause, sum(v::bigint) as cents, count(distinct coalesce(lower(paid.donor_email), paid.id::text)) as donors from paid, jsonb_each_text(coalesce(paid.details -> 'split', '{}'::jsonb)) as e(k, v) group by k)
    select jsonb_build_object(
        'org_id', o.id, 'slug', o.slug, 'name', o.name, 'currency', o.currency, 'bio', o.bio, 'stripe_account', o.stripe_account_id,
        'accepts', (select coalesce(jsonb_agg(distinct a.provider), '[]'::jsonb) from payment_accounts a where a.org_id = o.id and a.enabled and a.charges_enabled),
        'stats', jsonb_build_object(
            'raised_cents', (select coalesce(sum(amount_cents), 0) from paid),
            'gifts', (select count(*) from paid),
            'donors', (select count(distinct coalesce(lower(donor_email), id::text)) from paid),
            'by_cause', (select coalesce(jsonb_object_agg(cause, jsonb_build_object('cents', cents, 'donors', donors)), '{}'::jsonb) from split),
            'recent', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (select case when anonymous then 'Anonymous' else donor_name end as name, amount_cents, coalesce(nullif(cause, ''), nullif(fund, ''), 'Ramadan') as cause, created_at from paid order by created_at desc limit 8) r),
            'top', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select donor_name as name, sum(amount_cents) as amount_cents from paid where not anonymous group by donor_name order by 2 desc limit 6) t)
        )
    ) from o
$$;

/** Saves the Ramadan page. Members only. */
create or replace function bio_save(org uuid, b jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
    if not is_member(org) then raise exception 'Not a member of this organisation' using errcode = '42501'; end if;
    if jsonb_typeof(b) <> 'object' or length(b::text) > 200000 then raise exception 'That page is not valid'; end if;
    update orgs set bio = b where id = org;
end $$;
grant execute on function bio_get(text), bio_save(uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- the charity behind /ramadhan
insert into orgs (slug, name, tagline, currency, country)
values ('clearwell', 'Clearwell Trust', 'Clean water for 40 villages', 'GBP', 'GB')
on conflict (slug) do nothing;
