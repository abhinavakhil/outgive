-- Role-based access for charity teams, email invites, and the organiser view's real numbers.
-- Roles are ranked: owner > admin > editor > viewer. has_role(org, 'editor') means "editor or higher". Outgive staff
-- (profiles.is_platform_admin) pass every check. The database enforces all of this; the UI only hides what a role cannot do.
-- Safe to run more than once.

-- ---------------------------------------------------------------- roles
alter table org_members drop constraint if exists org_members_role_check;
alter table org_members add constraint org_members_role_check check (role in ('owner', 'admin', 'editor', 'viewer'));

create or replace function role_rank(r text) returns integer language sql immutable as $$
    select case r when 'owner' then 4 when 'admin' then 3 when 'editor' then 2 when 'viewer' then 1 else 0 end
$$;

create or replace function is_platform_admin() returns boolean language sql stable security definer set search_path = public as $$
    select coalesce((select is_platform_admin from profiles where id = auth.uid()), false)
$$;

/** The signed-in user holds `min` or a higher role in the org (or is Outgive staff). */
create or replace function has_role(org uuid, min text) returns boolean language sql stable security definer set search_path = public as $$
    select is_platform_admin() or exists (select 1 from org_members where org_id = org and user_id = auth.uid() and role_rank(role) >= role_rank(min))
$$;

-- is_member gates every existing write (page edits, campaigns, offline gifts, refunds) and the donor-level reads.
-- It now means "editor or higher", so the new viewer role can look but never change anything or see donors' details.
create or replace function is_member(org uuid) returns boolean language sql stable security definer set search_path = public as $$
    select has_role(org, 'editor')
$$;

-- Viewers see who is on the team.
drop policy if exists "members see members" on org_members;
create policy "members see members" on org_members for select using (has_role(org_id, 'viewer'));
create or replace function org_members_list(org uuid) returns table (user_id uuid, email text, name text, role text) language sql stable security definer set search_path = public as $$
    select m.user_id, p.email, p.name, m.role from org_members m join profiles p on p.id = m.user_id where m.org_id = org and has_role(org, 'viewer') order by role_rank(m.role) desc, m.created_at;
$$;

/** Every org the signed-in user is on, with their role: the app's nav and the organiser view read this. */
create or replace function my_roles() returns table (org_id uuid, slug text, name text, role text) language sql stable security definer set search_path = public as $$
    select o.id, o.slug, o.name, m.role from org_members m join orgs o on o.id = m.org_id where m.user_id = auth.uid()
    union all
    select o.id, o.slug, o.name, 'owner' from orgs o where is_platform_admin() and not exists (select 1 from org_members m where m.org_id = o.id and m.user_id = auth.uid())
$$;

-- ---------------------------------------------------------------- team: add, invite, change, remove (admins)
create table if not exists org_invites (
    org_id uuid not null references orgs (id) on delete cascade,
    email text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
    role text not null check (role in ('admin', 'editor', 'viewer')),
    invited_by uuid references profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    primary key (org_id, email)
);
alter table org_invites enable row level security;
drop policy if exists "admins see invites" on org_invites;
create policy "admins see invites" on org_invites for select using (has_role(org_id, 'admin'));
grant select on org_invites to authenticated;
grant all on org_invites to service_role;

/**
 * Adds someone to the team. True: they had an account and are on the team now. False: they have no account yet, so an invite is
 * kept and they join the moment they first sign in with that email. Admins only; only an owner can make another owner.
 */
create or replace function member_add(org uuid, member_email text, member_role text default 'admin') returns boolean language plpgsql security definer set search_path = public as $$
declare u uuid; e text := lower(trim(member_email));
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can add people to the team' using errcode = '42501'; end if;
    if member_role not in ('owner', 'admin', 'editor', 'viewer') then raise exception 'Unknown role %', member_role; end if;
    if member_role = 'owner' and not has_role(org, 'owner') then raise exception 'Only an owner can add another owner' using errcode = '42501'; end if;
    select id into u from profiles where lower(email) = e;
    if u is null then
        if member_role = 'owner' then raise exception 'Invite them as an admin; they can be made an owner once they have signed in'; end if;
        insert into org_invites (org_id, email, role, invited_by) values (org, e, member_role, auth.uid()) on conflict (org_id, email) do update set role = excluded.role;
        return false;
    end if;
    insert into org_members (org_id, user_id, role) values (org, u, member_role) on conflict (org_id, user_id) do update set role = excluded.role;
    return true;
end $$;

create or replace function org_invites_list(org uuid) returns setof org_invites language sql stable security definer set search_path = public as $$
    select * from org_invites where org_id = org and has_role(org, 'admin') order by created_at desc
$$;

create or replace function invite_cancel(org uuid, invite_email text) returns void language plpgsql security definer set search_path = public as $$
begin
    if not has_role(org, 'admin') then raise exception 'Only admins can change the team' using errcode = '42501'; end if;
    delete from org_invites where org_id = org and email = lower(trim(invite_email));
end $$;

/** Changes a member's role. Admins change editors and viewers; owners change anyone. The last owner can never be demoted. */
create or replace function member_set_role(org uuid, member uuid, new_role text) returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
    if new_role not in ('owner', 'admin', 'editor', 'viewer') then raise exception 'Unknown role %', new_role; end if;
    select role into cur from org_members where org_id = org and user_id = member;
    if cur is null then raise exception 'Not on the team'; end if;
    if not has_role(org, case when cur in ('owner', 'admin') or new_role in ('owner', 'admin') then 'owner' else 'admin' end) then raise exception 'You cannot make that change' using errcode = '42501'; end if;
    if cur = 'owner' and new_role <> 'owner' and (select count(*) from org_members where org_id = org and role = 'owner') = 1 then raise exception 'A team needs at least one owner'; end if;
    update org_members set role = new_role where org_id = org and user_id = member;
end $$;

/** Removes someone. Admins remove editors and viewers; owners remove anyone but the last owner. Anyone can leave. */
create or replace function member_remove(org uuid, member uuid) returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
    select role into cur from org_members where org_id = org and user_id = member;
    if cur is null then return; end if;
    if member <> auth.uid() and not has_role(org, case when cur in ('owner', 'admin') then 'owner' else 'admin' end) then raise exception 'You cannot remove them' using errcode = '42501'; end if;
    if cur = 'owner' and (select count(*) from org_members where org_id = org and role = 'owner') = 1 then raise exception 'A team needs at least one owner'; end if;
    delete from org_members where org_id = org and user_id = member;
end $$;

-- A new account joins every team it was invited to.
create or replace function accept_invites() returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.email is null then return new; end if;
    insert into org_members (org_id, user_id, role) select org_id, new.id, role from org_invites where email = lower(new.email) on conflict (org_id, user_id) do nothing;
    delete from org_invites where email = lower(new.email);
    return new;
end $$;
drop trigger if exists profiles_accept_invites on profiles;
create trigger profiles_accept_invites after insert on profiles for each row execute function accept_invites();

-- ---------------------------------------------------------------- the organiser view
/**
 * The appeal's numbers for its team (viewer or higher): totals, Gift Aid, money by day, by cause and by fund, and top supporters.
 * Anonymous donors stay anonymous here too; donors' contact details are only in org_donations (editor or higher).
 */
create or replace function org_insights(org uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
    if not has_role(org, 'viewer') then raise exception 'Only the charity''s team can see this' using errcode = '42501'; end if;
    with paid as (select * from donations where org_id = org and status = 'succeeded'),
    split as (select k as cause, sum(v::bigint) as cents from paid, jsonb_each_text(coalesce(paid.details -> 'split', '{}'::jsonb)) as e(k, v) group by k)
    select jsonb_build_object(
        'raised_cents', (select coalesce(sum(amount_cents), 0) from paid),
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

grant execute on function role_rank(text), is_platform_admin(), has_role(uuid, text), my_roles(), member_set_role(uuid, uuid, text), invite_cancel(uuid, text), org_invites_list(uuid), org_insights(uuid) to anon, authenticated;
revoke all on function accept_invites() from public, anon, authenticated;
