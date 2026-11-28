-- Outgive's own billing (the charity pays Outgive a flat subscription; donations never touch it), chapters under a parent
-- organisation, and invite emails. Safe to run more than once.
--
-- Plans: free (one appeal, basic numbers), standard (unlimited appeals, pledge recovery, analytics), multi (standard plus chapters).
-- No tips and no share of any gift on any plan. Founding pilots are free until pilot_until with the post-pilot plan recorded.
-- Gating is soft: plan_allows() is for upgrade prompts. Nothing on the donation path reads it, so a gift is never blocked.

-- ---------------------------------------------------------------- chapters
alter table orgs add column if not exists parent_org_id uuid references orgs (id) on delete set null;
create index if not exists orgs_parent on orgs (parent_org_id) where parent_org_id is not null;

/** One level only: a chapter has no chapters, a parent is never itself a chapter, and an org is not its own parent. */
create or replace function orgs_parent_check() returns trigger language plpgsql as $$
begin
    if new.parent_org_id is null then return new; end if;
    if new.parent_org_id = new.id then raise exception 'An organisation cannot be its own chapter'; end if;
    if exists (select 1 from orgs where id = new.parent_org_id and parent_org_id is not null) then raise exception 'A chapter cannot have chapters of its own'; end if;
    if exists (select 1 from orgs where parent_org_id = new.id) then raise exception 'This organisation has chapters, so it cannot become a chapter'; end if;
    return new;
end $$;
drop trigger if exists orgs_parent_check on orgs;
create trigger orgs_parent_check before insert or update of parent_org_id on orgs for each row execute function orgs_parent_check();

/**
 * The signed-in user holds `min` or higher in the org, or is Outgive staff. New: an admin or owner of the org's parent holds the same
 * role in each chapter. Editors and viewers of the parent get nothing in chapters, and nothing flows upward or between chapters.
 */
create or replace function has_role(org uuid, min text) returns boolean language sql stable security definer set search_path = public as $$
    select is_platform_admin() or exists (
        select 1 from org_members m
        where m.user_id = auth.uid() and role_rank(m.role) >= role_rank(min)
          and (m.org_id = org or (role_rank(m.role) >= 3 and m.org_id = (select parent_org_id from orgs where id = org)))
    )
$$;

/** Every org the signed-in user is on, with their role, now including the chapters they reach as a parent admin. */
create or replace function my_roles() returns table (org_id uuid, slug text, name text, role text) language sql stable security definer set search_path = public as $$
    select o.id, o.slug, o.name, m.role from org_members m join orgs o on o.id = m.org_id where m.user_id = auth.uid()
    union all
    select c.id, c.slug, c.name, m.role from org_members m join orgs c on c.parent_org_id = m.org_id
    where m.user_id = auth.uid() and role_rank(m.role) >= 3 and not exists (select 1 from org_members x where x.org_id = c.id and x.user_id = auth.uid())
    union all
    select o.id, o.slug, o.name, 'owner' from orgs o where is_platform_admin() and not exists (select 1 from org_members m where m.org_id = o.id and m.user_id = auth.uid())
$$;

/** Creates a chapter under `parent` (admins of the parent). The creator reaches it through the parent; it starts with no members of its own. */
create or replace function chapter_create(parent uuid, chapter_name text, chapter_slug text) returns uuid language plpgsql security definer set search_path = public as $$
declare p orgs; cid uuid;
begin
    if not has_role(parent, 'admin') then raise exception 'Only admins of the organisation can add chapters' using errcode = '42501'; end if;
    select * into p from orgs where orgs.id = parent;
    if p.parent_org_id is not null then raise exception 'A chapter cannot have chapters of its own'; end if;
    if exists (select 1 from orgs where slug = lower(trim(chapter_slug))) then raise exception 'That web address is taken'; end if;
    insert into orgs (slug, name, currency, country, parent_org_id, owner_id)
    values (lower(trim(chapter_slug)), trim(chapter_name), p.currency, p.country, parent, auth.uid()) returning orgs.id into cid;
    return cid;
end $$;

/** Each chapter with its organiser numbers (org_insights) and team size. Admins of the parent. */
create or replace function chapters_list(parent uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    if not has_role(parent, 'admin') then raise exception 'Only admins of the organisation can see its chapters' using errcode = '42501'; end if;
    return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'created_at', c.created_at,
        'members', (select count(*) from org_members m where m.org_id = c.id), 'insights', org_insights(c.id)) order by c.name)
        from orgs c where c.parent_org_id = parent), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- the subscription (synced from Stripe Billing by billing-webhook)
create table if not exists org_subscriptions (
    org_id uuid primary key references orgs (id) on delete cascade,
    plan text not null default 'free' check (plan in ('free', 'standard', 'multi')),
    billing_interval text check (billing_interval in ('month', 'year')),
    -- Stripe's subscription status, or 'none' before the first checkout.
    status text not null default 'none' check (status in ('none', 'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
    stripe_customer_id text unique,
    stripe_subscription_id text unique,
    current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    -- Founding pilot: free until this day, then the plan agreed in writing (post_pilot_plan, with a note of where it was agreed).
    pilot_until date,
    post_pilot_plan text check (post_pilot_plan in ('free', 'standard', 'multi')),
    pilot_terms text not null default '',
    updated_at timestamptz not null default now()
);
alter table org_subscriptions enable row level security;
drop policy if exists "admins see billing" on org_subscriptions;
create policy "admins see billing" on org_subscriptions for select using (has_role(org_id, 'admin'));
grant select on org_subscriptions to authenticated;
grant all on org_subscriptions to service_role;

create or replace function plan_rank(p text) returns integer language sql immutable as $$
    select case p when 'multi' then 3 when 'standard' then 2 when 'free' then 1 else 0 end
$$;

/**
 * The plan an org gets today: the better of a paid subscription in good standing (past_due keeps it while Stripe retries)
 * and an unexpired founding pilot (a pilot gets its agreed plan, at least standard). A chapter gets its parent's plan.
 */
create or replace function org_plan(org uuid) returns text language sql stable security definer set search_path = public as $$
    with s as (select * from org_subscriptions where org_id = coalesce((select parent_org_id from orgs where id = org), org))
    select coalesce((select p from (
        select case when s.status in ('active', 'trialing', 'past_due') then s.plan else 'free' end as p from s
        union all
        select case when s.post_pilot_plan = 'multi' then 'multi' else 'standard' end from s where s.pilot_until >= current_date
    ) x order by plan_rank(p) desc limit 1), 'free')
$$;

/** What a plan includes. Mirrored in src/features/engage/account/model.ts (FEATURES). */
create or replace function plan_allows(org uuid, feature text) returns boolean language sql stable security definer set search_path = public as $$
    select case feature
        when 'appeals_unlimited' then plan_rank(org_plan(org)) >= 2
        when 'pledge_recovery' then plan_rank(org_plan(org)) >= 2
        when 'analytics' then plan_rank(org_plan(org)) >= 2
        when 'chapters' then plan_rank(org_plan(org)) >= 3
        else false end
$$;

/** The billing screen's data. Viewers get the plan (for upgrade prompts); admins also get the Stripe and pilot details. */
create or replace function billing_status(org uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s org_subscriptions; parent uuid; r jsonb;
begin
    if not has_role(org, 'viewer') then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    select parent_org_id into parent from orgs where id = org;
    select * into s from org_subscriptions where org_id = coalesce(parent, org);
    r := jsonb_build_object('plan', org_plan(org), 'billed_by_parent', parent is not null,
        'appeals', (select count(*) from pages where org_id = org and type = 'campaign'),
        'chapters', (select count(*) from orgs where parent_org_id = org));
    if has_role(org, 'admin') and parent is null then
        r := r || jsonb_build_object('subscribed_plan', coalesce(s.plan, 'free'), 'status', coalesce(s.status, 'none'), 'interval', s.billing_interval,
            'current_period_end', s.current_period_end, 'cancel_at_period_end', coalesce(s.cancel_at_period_end, false), 'has_customer', s.stripe_customer_id is not null,
            'pilot_until', s.pilot_until, 'post_pilot_plan', s.post_pilot_plan, 'pilot_terms', coalesce(s.pilot_terms, ''));
    end if;
    return r;
end $$;

/** Outgive staff record a founding pilot: free until `until`, then `post_plan` as agreed in writing (`terms` says where). */
create or replace function billing_set_pilot(org uuid, until date, post_plan text, terms text) returns void language plpgsql security definer set search_path = public as $$
begin
    if not is_platform_admin() then raise exception 'Only Outgive staff can record a pilot' using errcode = '42501'; end if;
    if post_plan not in ('free', 'standard', 'multi') then raise exception 'Unknown plan %', post_plan; end if;
    if coalesce(trim(terms), '') = '' then raise exception 'Record where the post-pilot price was agreed in writing'; end if;
    insert into org_subscriptions (org_id, pilot_until, post_pilot_plan, pilot_terms) values (org, until, post_plan, trim(terms))
    on conflict (org_id) do update set pilot_until = excluded.pilot_until, post_pilot_plan = excluded.post_pilot_plan, pilot_terms = excluded.pilot_terms, updated_at = now();
end $$;

-- ---------------------------------------------------------------- invite emails (sent by the invite-email function)
alter table org_invites add column if not exists emailed_at timestamptz;
alter table org_invites add column if not exists emails_sent integer not null default 0;

grant execute on function has_role(uuid, text), my_roles(), chapter_create(uuid, text, text), chapters_list(uuid), org_plan(uuid), plan_allows(uuid, text),
    billing_status(uuid), billing_set_pilot(uuid, date, text, text), plan_rank(text) to anon, authenticated;
revoke all on function orgs_parent_check() from public, anon, authenticated;

