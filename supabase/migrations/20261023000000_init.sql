-- Outgive schema. One file: tables, triggers, the SQL API the app calls (RPC) and row-level security.
-- Money is stored in integer cents. Boards compare in USD cents using fx_rates.

-- ---------------------------------------------------------------- reference data
create table fx_rates (currency text primary key, per_usd numeric not null check (per_usd > 0), updated_at timestamptz not null default now());
insert into fx_rates (currency, per_usd) values ('USD', 1), ('EUR', 0.92), ('GBP', 0.78), ('INR', 84), ('AED', 3.67), ('CAD', 1.37), ('AUD', 1.53);

create function to_usd_cents(amount_cents bigint, cur text) returns bigint language sql stable as $$
    select round(amount_cents / coalesce((select per_usd from fx_rates where currency = upper(cur)), 1))::bigint;
$$;

-- ---------------------------------------------------------------- people
create table profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text,
    name text not null default '',
    avatar_url text not null default '',
    country text not null default '',
    is_platform_admin boolean not null default false,
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- organisations (tenants)
create table orgs (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'),
    name text not null check (length(name) between 1 and 80),
    tagline text not null default '',
    description text not null default '',
    logo_url text not null default '',
    color text not null default '#e0603f' check (color ~ '^#[0-9a-fA-F]{6}$'),
    font text not null default 'Poppins',
    variant text not null default 'list',
    impact_usd numeric,
    impact_unit text not null default '',
    currency text not null default 'USD' references fx_rates (currency),
    country text not null default '',
    registration_number text not null default '',
    website text not null default '',
    custom_domain text unique,
    remove_branding boolean not null default false,
    verified boolean not null default false,
    stripe_account_id text unique,
    stripe_charges_enabled boolean not null default false,
    stripe_payouts_enabled boolean not null default false,
    platform_fee_bps integer not null default 0 check (platform_fee_bps between 0 and 2000),
    tips_enabled boolean not null default true,
    live jsonb not null default '{}'::jsonb,
    owner_id uuid references profiles (id) on delete set null,
    created_at timestamptz not null default now()
);
create index orgs_custom_domain on orgs (lower(custom_domain));

create table org_members (
    org_id uuid not null references orgs (id) on delete cascade,
    user_id uuid not null references profiles (id) on delete cascade,
    role text not null default 'admin' check (role in ('owner', 'admin', 'editor')),
    created_at timestamptz not null default now(),
    primary key (org_id, user_id)
);

create function is_member(org uuid) returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from org_members where org_id = org and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- supporters: the rows on a board
-- A supporter is whoever holds a rank: a person, team, company or school. A fundraising page is a supporter too (page_id set).
create table supporters (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    name text not null check (length(name) between 1 and 80),
    name_key text generated always as (lower(regexp_replace(name, '\s+', ' ', 'g'))) stored,
    kind text not null default 'Individuals' check (kind in ('Individuals', 'Teams', 'Companies', 'Schools')),
    tagline text not null default '',
    region text not null default '',
    country text not null default '',
    link text not null default '',
    user_id uuid references profiles (id) on delete set null,
    match_cap_cents bigint,
    visits integer not null default 0,
    created_at timestamptz not null default now(),
    unique (org_id, name_key)
);

-- ---------------------------------------------------------------- pages
create table pages (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    owner_id uuid references profiles (id) on delete set null,
    parent_id uuid references pages (id) on delete set null,
    supporter_id uuid references supporters (id) on delete set null,
    type text not null check (type in ('fundraiser', 'campaign', 'team', 'challenge', 'event', 'memory')),
    slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$'),
    title text not null check (length(title) between 1 and 120),
    org_name text not null default '',
    country text not null default '',
    story text not null default '',
    cover jsonb not null default '{"kind":"none","src":""}'::jsonb,
    layout text not null default 'classic',
    goal_cents bigint not null default 0 check (goal_cents >= 0),
    currency text not null default 'USD' references fx_rates (currency),
    end_date date,
    show_goal boolean not null default true,
    causes text[] not null default '{}',
    details jsonb not null default '{}'::jsonb,
    gifts integer[] not null default '{10,25,50,100}',
    allocation jsonb not null default '[]'::jsonb,
    allow_fundraisers boolean not null default true,
    status text not null default 'live' check (status in ('draft', 'live', 'paused', 'ended')),
    raised_cents bigint not null default 0,
    donor_count integer not null default 0,
    live jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (org_id, type, slug)
);
create index pages_org on pages (org_id, status);
create index pages_parent on pages (parent_id);
create index pages_owner on pages (owner_id);

create table ticket_types (
    id uuid primary key default gen_random_uuid(),
    page_id uuid not null references pages (id) on delete cascade,
    name text not null,
    description text not null default '',
    price_cents bigint not null check (price_cents >= 0),
    quantity integer,
    sold integer not null default 0,
    sort integer not null default 0
);

create table page_updates (
    id uuid primary key default gen_random_uuid(),
    page_id uuid not null references pages (id) on delete cascade,
    author_id uuid references profiles (id) on delete set null,
    title text not null,
    body text not null default '',
    created_at timestamptz not null default now()
);

-- A company (or anyone) pledging to match gifts up to a cap. Matching rows are added by the match trigger.
create table match_pledges (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    page_id uuid references pages (id) on delete cascade,
    sponsor_name text not null,
    ratio numeric not null default 1 check (ratio > 0 and ratio <= 5),
    cap_cents bigint not null check (cap_cents > 0),
    matched_cents bigint not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- donations
create table donations (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs (id) on delete cascade,
    page_id uuid references pages (id) on delete set null,
    supporter_id uuid references supporters (id) on delete set null,
    donor_id uuid references profiles (id) on delete set null,
    donor_name text not null default 'Anonymous',
    donor_email text,
    anonymous boolean not null default false,
    amount_cents bigint not null check (amount_cents > 0),
    currency text not null references fx_rates (currency),
    usd_cents bigint not null,
    tip_cents bigint not null default 0 check (tip_cents >= 0),
    cover_cents bigint not null default 0 check (cover_cents >= 0),
    platform_fee_cents bigint not null default 0 check (platform_fee_cents >= 0),
    message text not null default '',
    dedication text not null default '',
    recurring boolean not null default false,
    source text not null default 'card' check (source in ('card', 'offline', 'pledge', 'match', 'demo')),
    status text not null default 'pending' check (status in ('pending', 'succeeded', 'refunded', 'disputed', 'failed')),
    stripe_checkout_session_id text unique,
    stripe_payment_intent_id text unique,
    stripe_subscription_id text,
    stripe_invoice_id text unique,
    ticket_type_id uuid references ticket_types (id) on delete set null,
    ticket_qty integer not null default 0,
    claimed_rank integer,
    match_pledge_id uuid references match_pledges (id) on delete set null,
    receipt_sent_at timestamptz,
    created_at timestamptz not null default now()
);
create index donations_org_time on donations (org_id, created_at desc);
create index donations_page on donations (page_id, created_at desc);
create index donations_supporter on donations (supporter_id);
create index donations_donor on donations (donor_id);
create index donations_email on donations (lower(donor_email));

create table stripe_events (id text primary key, type text not null, received_at timestamptz not null default now());

-- ---------------------------------------------------------------- triggers
create function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger pages_updated before update on pages for each row execute function set_updated_at();

-- auth.users -> profiles, and claim any earlier gifts made with that email.
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into profiles (id, email, name, avatar_url)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)), coalesce(new.raw_user_meta_data ->> 'avatar_url', ''))
    on conflict (id) do nothing;
    update donations set donor_id = new.id where donor_id is null and new.email is not null and lower(donor_email) = lower(new.email);
    return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create function donation_fill() returns trigger language plpgsql as $$
begin
    new.currency = upper(new.currency);
    new.usd_cents = to_usd_cents(new.amount_cents, new.currency);
    if new.anonymous then new.donor_name = 'Anonymous'; end if;
    if new.page_id is not null then
        select org_id, coalesce(new.supporter_id, supporter_id) into new.org_id, new.supporter_id from pages where id = new.page_id;
    end if;
    return new;
end $$;
create trigger donations_fill before insert on donations for each row execute function donation_fill();

-- Page totals count succeeded gifts only and roll up to the parent page (a fundraiser under a campaign, a member under a team).
create function page_recount(p uuid) returns void language plpgsql as $$
declare cur uuid := p; own_cents bigint; own_count integer; kids_cents bigint; kids_count integer;
begin
    while cur is not null loop
        select coalesce(sum(amount_cents), 0), count(*) into own_cents, own_count from donations where page_id = cur and status = 'succeeded';
        select coalesce(sum(raised_cents), 0), coalesce(sum(donor_count), 0) into kids_cents, kids_count from pages where parent_id = cur;
        update pages set raised_cents = own_cents + kids_cents, donor_count = own_count + kids_count where id = cur;
        select parent_id into cur from pages where id = cur;
    end loop;
end $$;

create function donation_after() returns trigger language plpgsql as $$
begin
    if tg_op = 'DELETE' then perform page_recount(old.page_id); return old; end if;
    perform page_recount(new.page_id);
    if tg_op = 'UPDATE' and old.page_id is distinct from new.page_id then perform page_recount(old.page_id); end if;
    if new.ticket_type_id is not null and new.status = 'succeeded' and (tg_op = 'INSERT' or old.status <> 'succeeded') then
        update ticket_types set sold = sold + new.ticket_qty where id = new.ticket_type_id;
    end if;
    -- Matching: an active pledge on this org (and page, if it names one) adds a matching gift until its cap is reached.
    if new.status = 'succeeded' and new.source in ('card', 'offline', 'demo') and (tg_op = 'INSERT' or old.status <> 'succeeded') then
        perform apply_match(new);
    end if;
    return new;
end $$;

create function apply_match(d donations) returns void language plpgsql as $$
declare m match_pledges; add bigint;
begin
    for m in select * from match_pledges where org_id = d.org_id and active and matched_cents < cap_cents and (page_id is null or page_id = d.page_id) order by created_at loop
        add := least(round(d.amount_cents * m.ratio)::bigint, m.cap_cents - m.matched_cents);
        if add > 0 then
            insert into donations (org_id, page_id, supporter_id, donor_name, amount_cents, currency, source, status, match_pledge_id, message)
            values (d.org_id, d.page_id, (select id from supporters where org_id = d.org_id and name_key = lower(m.sponsor_name)), m.sponsor_name, add, d.currency, 'match', 'succeeded', m.id, 'Matching ' || d.donor_name || '''s gift');
            update match_pledges set matched_cents = matched_cents + add where id = m.id;
        end if;
    end loop;
end $$;
create trigger donations_after after insert or update or delete on donations for each row execute function donation_after();

-- A page is a supporter on its charity's board: its gifts count toward its rank.
create function page_supporter() returns trigger language plpgsql as $$
declare s uuid; k text;
begin
    k := case new.type when 'team' then 'Teams' else 'Individuals' end;
    insert into supporters (org_id, name, kind, tagline, country, user_id, link)
    values (new.org_id, new.title, k, initcap(new.type) || ' page', new.country, new.owner_id, '/' || (case new.type when 'fundraiser' then 'f' when 'campaign' then 'c' when 'team' then 't' when 'challenge' then 'ch' when 'event' then 'e' else 'm' end) || '/' || new.slug)
    on conflict (org_id, name_key) do update set link = excluded.link, user_id = coalesce(supporters.user_id, excluded.user_id)
    returning id into s;
    new.supporter_id = s;
    return new;
end $$;
create trigger pages_supporter before insert on pages for each row when (new.type <> 'campaign') execute function page_supporter();

-- ---------------------------------------------------------------- the board
-- recruited = distinct named donors to this supporter's pages; streak = months in a row with a gift, counting back from this or last month.
create function streak_months(s uuid) returns integer language sql stable as $$
    with m as (select distinct date_trunc('month', created_at) mo from donations where supporter_id = s and status = 'succeeded'),
    r as (select mo, date_trunc('month', now()) - (row_number() over (order by mo desc) - 1) * interval '1 month' as expect from m)
    select count(*)::int from r where mo = expect or mo = expect - interval '1 month'
    -- a run broken this month still counts if it reaches last month
    and not exists (select 1 from r r2 where r2.mo < r.mo and r2.mo <> r2.expect and r2.mo <> r2.expect - interval '1 month');
$$;

create function board(org uuid) returns table (
    id uuid, name text, tagline text, kind text, region text, country text, page text, total numeric, today numeric, week numeric, recruited integer, streak integer, visits integer, days integer, match numeric, user_id uuid
) language sql stable security definer set search_path = public as $$
    with gifts as (
        select supporter_id, sum(usd_cents) total, sum(usd_cents) filter (where created_at >= date_trunc('day', now())) today, sum(usd_cents) filter (where created_at >= date_trunc('week', now())) week
        from donations where org_id = org and status = 'succeeded' and supporter_id is not null group by supporter_id
    ),
    rec as (
        select p.supporter_id, count(distinct lower(coalesce(d.donor_email, d.donor_name))) n
        from pages p join donations d on d.page_id = p.id and d.status = 'succeeded' and d.source <> 'match' where p.org_id = org and p.supporter_id is not null group by p.supporter_id
    )
    select s.id, s.name, s.tagline, s.kind, s.region, s.country, s.link, g.total / 100.0, coalesce(g.today, 0) / 100.0, coalesce(g.week, 0) / 100.0,
        coalesce(r.n, 0)::int, streak_months(s.id), s.visits, greatest(0, (now()::date - s.created_at::date))::int, s.match_cap_cents / 100.0, s.user_id
    from supporters s join gifts g on g.supporter_id = s.id left join rec r on r.supporter_id = s.id
    where s.org_id = org order by g.total desc;
$$;

create function hall_of_fame(org uuid) returns table (week_of date, name text, usd numeric) language sql stable security definer set search_path = public as $$
    select week_of, name, usd from (
        select date_trunc('week', d.created_at)::date week_of, s.name, sum(d.usd_cents) / 100.0 usd, row_number() over (partition by date_trunc('week', d.created_at)::date order by sum(d.usd_cents) desc) rn
        from donations d join supporters s on s.id = d.supporter_id
        where d.org_id = org and d.status = 'succeeded' and d.created_at < date_trunc('week', now()) group by 1, 2
    ) x where rn = 1 order by week_of desc limit 8;
$$;

-- Public view of gifts: no emails, anonymous names hidden.
create view public_donations with (security_invoker = false) as
    select id, org_id, page_id, supporter_id, donor_name as name, amount_cents, currency, usd_cents, message, dedication, recurring, source, ticket_qty, created_at
    from donations where status = 'succeeded';

-- ---------------------------------------------------------------- SQL API (called as RPC from the app)
create function org_by_slug(s text) returns setof orgs language sql stable security definer set search_path = public as $$ select * from orgs where slug = lower(s) limit 1 $$;
create function org_by_host(h text) returns setof orgs language sql stable security definer set search_path = public as $$ select * from orgs where lower(custom_domain) = lower(h) limit 1 $$;

create function org_create(p jsonb) returns orgs language plpgsql security definer set search_path = public as $$
declare o orgs;
begin
    if auth.uid() is null then raise exception 'Sign in to create an organisation' using errcode = '42501'; end if;
    insert into orgs (slug, name, tagline, color, font, variant, impact_usd, impact_unit, currency, country, registration_number, website, description, owner_id)
    values (lower(p ->> 'slug'), p ->> 'name', coalesce(p ->> 'tagline', ''), coalesce(p ->> 'color', '#e0603f'), coalesce(p ->> 'font', 'Poppins'), coalesce(p ->> 'variant', 'list'),
        nullif(p ->> 'impact_usd', '')::numeric, coalesce(p ->> 'impact_unit', ''), coalesce(upper(p ->> 'currency'), 'USD'), coalesce(p ->> 'country', ''), coalesce(p ->> 'registration_number', ''), coalesce(p ->> 'website', ''), coalesce(p ->> 'description', ''), auth.uid())
    returning * into o;
    insert into org_members (org_id, user_id, role) values (o.id, auth.uid(), 'owner');
    return o;
end $$;

create function org_update(org uuid, p jsonb) returns orgs language plpgsql security definer set search_path = public as $$
declare o orgs;
begin
    if not is_member(org) then raise exception 'Not a member of this organisation' using errcode = '42501'; end if;
    update orgs set
        name = coalesce(p ->> 'name', name), tagline = coalesce(p ->> 'tagline', tagline), description = coalesce(p ->> 'description', description), logo_url = coalesce(p ->> 'logo_url', logo_url),
        color = coalesce(p ->> 'color', color), font = coalesce(p ->> 'font', font), variant = coalesce(p ->> 'variant', variant),
        impact_usd = case when p ? 'impact_usd' then nullif(p ->> 'impact_usd', '')::numeric else impact_usd end, impact_unit = coalesce(p ->> 'impact_unit', impact_unit),
        currency = coalesce(upper(p ->> 'currency'), currency), country = coalesce(p ->> 'country', country), registration_number = coalesce(p ->> 'registration_number', registration_number), website = coalesce(p ->> 'website', website),
        custom_domain = case when p ? 'custom_domain' then nullif(lower(p ->> 'custom_domain'), '') else custom_domain end,
        remove_branding = coalesce((p ->> 'remove_branding')::boolean, remove_branding), tips_enabled = coalesce((p ->> 'tips_enabled')::boolean, tips_enabled),
        live = case when p ? 'live' then p -> 'live' else live end
    where id = org returning * into o;
    return o;
end $$;

create function member_add(org uuid, member_email text, member_role text default 'admin') returns boolean language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
    if not is_member(org) then raise exception 'Not a member of this organisation' using errcode = '42501'; end if;
    select id into u from profiles where lower(email) = lower(member_email);
    if u is null then return false; end if;
    insert into org_members (org_id, user_id, role) values (org, u, member_role) on conflict (org_id, user_id) do update set role = excluded.role;
    return true;
end $$;

create function member_remove(org uuid, member uuid) returns void language plpgsql security definer set search_path = public as $$
begin
    if not is_member(org) then raise exception 'Not a member of this organisation' using errcode = '42501'; end if;
    if (select owner_id from orgs where id = org) = member then raise exception 'The owner cannot be removed'; end if;
    delete from org_members where org_id = org and user_id = member;
end $$;

create function page_create(p jsonb) returns pages language plpgsql security definer set search_path = public as $$
declare pg pages; base text; s text; n int := 2; org uuid := (p ->> 'org_id')::uuid; t text := p ->> 'type';
begin
    if auth.uid() is null then raise exception 'Sign in to publish a page' using errcode = '42501'; end if;
    if t = 'campaign' and not is_member(org) then raise exception 'Only the organisation can create a campaign' using errcode = '42501'; end if;
    base := coalesce(nullif(p ->> 'slug', ''), 'page'); s := base;
    while exists (select 1 from pages where org_id = org and type = t and slug = s) loop s := base || '-' || n; n := n + 1; end loop;
    insert into pages (org_id, owner_id, parent_id, type, slug, title, org_name, country, story, cover, layout, goal_cents, currency, end_date, show_goal, causes, details, gifts, allocation, allow_fundraisers, status)
    values (org, auth.uid(), nullif(p ->> 'parent_id', '')::uuid, t, s, p ->> 'title', coalesce(p ->> 'org_name', ''), coalesce(p ->> 'country', ''), coalesce(p ->> 'story', ''),
        coalesce(p -> 'cover', '{"kind":"none","src":""}'::jsonb), coalesce(p ->> 'layout', 'classic'), coalesce((p ->> 'goal_cents')::bigint, 0), coalesce(upper(p ->> 'currency'), 'USD'), nullif(p ->> 'end_date', '')::date,
        coalesce((p ->> 'show_goal')::boolean, true), coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'causes', '[]'::jsonb)) x), '{}'),
        coalesce(p -> 'details', '{}'::jsonb), coalesce((select array_agg(x::int) from jsonb_array_elements_text(coalesce(p -> 'gifts', '[10,25,50,100]'::jsonb)) x), '{10,25,50,100}'),
        coalesce(p -> 'allocation', '[]'::jsonb), coalesce((p ->> 'allow_fundraisers')::boolean, true), coalesce(p ->> 'status', 'live'))
    returning * into pg;
    return pg;
end $$;

create function can_edit_page(pg pages) returns boolean language sql stable security definer set search_path = public as $$
    select coalesce(pg.owner_id = auth.uid(), false) or is_member(pg.org_id);
$$;

create function page_update(page uuid, p jsonb) returns pages language plpgsql security definer set search_path = public as $$
declare pg pages;
begin
    select * into pg from pages where id = page;
    if pg.id is null or not can_edit_page(pg) then raise exception 'You cannot edit this page' using errcode = '42501'; end if;
    update pages set
        title = coalesce(p ->> 'title', title), org_name = coalesce(p ->> 'org_name', org_name), country = coalesce(p ->> 'country', country), story = coalesce(p ->> 'story', story),
        cover = coalesce(p -> 'cover', cover), layout = coalesce(p ->> 'layout', layout), goal_cents = coalesce((p ->> 'goal_cents')::bigint, goal_cents),
        end_date = case when p ? 'end_date' then nullif(p ->> 'end_date', '')::date else end_date end, show_goal = coalesce((p ->> 'show_goal')::boolean, show_goal),
        causes = coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'causes') x), causes), details = coalesce(p -> 'details', details),
        gifts = coalesce((select array_agg(x::int) from jsonb_array_elements_text(p -> 'gifts') x), gifts), allocation = coalesce(p -> 'allocation', allocation),
        allow_fundraisers = coalesce((p ->> 'allow_fundraisers')::boolean, allow_fundraisers), status = coalesce(p ->> 'status', status),
        live = case when p ? 'live' then p -> 'live' else live end
    where id = page returning * into pg;
    if p ? 'title' then update supporters set name = pg.title where id = pg.supporter_id and not exists (select 1 from supporters where org_id = pg.org_id and name_key = lower(pg.title) and id <> pg.supporter_id); end if;
    return pg;
end $$;

create function update_post(page uuid, t text, b text) returns page_updates language plpgsql security definer set search_path = public as $$
declare pg pages; u page_updates;
begin
    select * into pg from pages where id = page;
    if pg.id is null or not can_edit_page(pg) then raise exception 'You cannot post to this page' using errcode = '42501'; end if;
    insert into page_updates (page_id, author_id, title, body) values (page, auth.uid(), t, coalesce(b, '')) returning * into u;
    return u;
end $$;

create function ticket_types_set(page uuid, items jsonb) returns setof ticket_types language plpgsql security definer set search_path = public as $$
declare pg pages; it jsonb; i int := 0; keep uuid[] := '{}'; tid uuid;
begin
    select * into pg from pages where id = page;
    if pg.id is null or not can_edit_page(pg) then raise exception 'You cannot edit this page' using errcode = '42501'; end if;
    for it in select * from jsonb_array_elements(items) loop
        tid := nullif(it ->> 'id', '')::uuid;
        if tid is not null and exists (select 1 from ticket_types where id = tid and page_id = page) then
            update ticket_types set name = it ->> 'name', description = coalesce(it ->> 'description', ''), price_cents = (it ->> 'price_cents')::bigint, quantity = nullif(it ->> 'quantity', '')::int, sort = i where id = tid;
        else
            insert into ticket_types (page_id, name, description, price_cents, quantity, sort) values (page, it ->> 'name', coalesce(it ->> 'description', ''), (it ->> 'price_cents')::bigint, nullif(it ->> 'quantity', '')::int, i) returning id into tid;
        end if;
        keep := keep || tid; i := i + 1;
    end loop;
    delete from ticket_types where page_id = page and not (id = any (keep)) and sold = 0;
    return query select * from ticket_types where page_id = page order by sort;
end $$;

create function match_pledge_set(org uuid, p jsonb) returns match_pledges language plpgsql security definer set search_path = public as $$
declare m match_pledges;
begin
    if not is_member(org) then raise exception 'Not a member of this organisation' using errcode = '42501'; end if;
    if nullif(p ->> 'id', '') is not null then
        update match_pledges set active = coalesce((p ->> 'active')::boolean, active), cap_cents = coalesce((p ->> 'cap_cents')::bigint, cap_cents), ratio = coalesce((p ->> 'ratio')::numeric, ratio) where id = (p ->> 'id')::uuid and org_id = org returning * into m;
    else
        insert into match_pledges (org_id, page_id, sponsor_name, ratio, cap_cents) values (org, nullif(p ->> 'page_id', '')::uuid, p ->> 'sponsor_name', coalesce((p ->> 'ratio')::numeric, 1), (p ->> 'cap_cents')::bigint) returning * into m;
        insert into supporters (org_id, name, kind, tagline, match_cap_cents) values (org, m.sponsor_name, 'Companies', 'Matching gifts', m.cap_cents) on conflict (org_id, name_key) do update set match_cap_cents = excluded.match_cap_cents;
    end if;
    return m;
end $$;

-- Finds or creates the board row a gift should count for. Anonymous gifts with no team never make a row.
create function supporter_for(org uuid, s_name text, s_kind text, s_tagline text, s_country text, s_region text, s_link text) returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
    if s_name is null or btrim(s_name) = '' then return null; end if;
    insert into supporters (org_id, name, kind, tagline, country, region, link, user_id)
    values (org, btrim(s_name), coalesce(nullif(s_kind, ''), 'Individuals'), coalesce(s_tagline, ''), coalesce(s_country, ''), coalesce(s_region, ''), coalesce(s_link, ''), auth.uid())
    on conflict (org_id, name_key) do update set tagline = case when excluded.tagline <> '' then excluded.tagline else supporters.tagline end, country = case when excluded.country <> '' then excluded.country else supporters.country end, link = case when excluded.link <> '' then excluded.link else supporters.link end
    returning id into sid;
    return sid;
end $$;

-- A gift recorded by the organisation itself: cash, cheque, a pledge from the room, or a demo gift on the sample board.
create function donation_record(p jsonb) returns donations language plpgsql security definer set search_path = public as $$
declare d donations; org uuid := (p ->> 'org_id')::uuid; pg uuid := nullif(p ->> 'page_id', '')::uuid; src text := coalesce(p ->> 'source', 'offline');
begin
    if pg is not null then select org_id into org from pages where id = pg; end if;
    if not is_member(org) then raise exception 'Only the organisation can record a gift' using errcode = '42501'; end if;
    if src not in ('offline', 'pledge', 'demo') then raise exception 'source must be offline, pledge or demo'; end if;
    insert into donations (org_id, page_id, supporter_id, donor_name, donor_email, anonymous, amount_cents, currency, message, dedication, recurring, source, status, claimed_rank)
    values (org, pg, supporter_for(org, p ->> 'supporter_name', p ->> 'supporter_kind', p ->> 'supporter_tagline', p ->> 'supporter_country', p ->> 'supporter_region', p ->> 'supporter_link'),
        coalesce(nullif(p ->> 'donor_name', ''), 'Anonymous'), nullif(p ->> 'donor_email', ''), coalesce((p ->> 'anonymous')::boolean, false), (p ->> 'amount_cents')::bigint, coalesce(upper(p ->> 'currency'), 'USD'),
        coalesce(p ->> 'message', ''), coalesce(p ->> 'dedication', ''), coalesce((p ->> 'recurring')::boolean, false), src, 'succeeded', nullif(p ->> 'claimed_rank', '')::int)
    returning * into d;
    return d;
end $$;

create function donation_set_status(d uuid, s text) returns void language plpgsql security definer set search_path = public as $$
begin
    if not exists (select 1 from donations where id = d and is_member(org_id)) then raise exception 'Not a member of this organisation' using errcode = '42501'; end if;
    if s not in ('succeeded', 'refunded', 'failed') then raise exception 'bad status'; end if;
    update donations set status = s where id = d;
end $$;

create function visit(page uuid) returns void language sql security definer set search_path = public as $$
    update supporters set visits = visits + 1 where id = (select supporter_id from pages where id = page);
$$;

create function my_orgs() returns setof orgs language sql stable security definer set search_path = public as $$
    select o.* from orgs o join org_members m on m.org_id = o.id where m.user_id = auth.uid() order by o.created_at;
$$;

-- Everything a page screen needs in one call.
create function page_get(org uuid, t text, s text) returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
        'page', to_jsonb(p),
        'donations', (select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at desc), '[]'::jsonb) from (select * from public_donations where page_id = p.id order by created_at desc limit 100) d),
        'updates', (select coalesce(jsonb_agg(to_jsonb(u) order by u.created_at desc), '[]'::jsonb) from page_updates u where u.page_id = p.id),
        'tickets', (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort), '[]'::jsonb) from ticket_types x where x.page_id = p.id),
        'children', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'type', c.type, 'slug', c.slug, 'title', c.title, 'raised_cents', c.raised_cents, 'donor_count', c.donor_count, 'goal_cents', c.goal_cents) order by c.raised_cents desc), '[]'::jsonb) from pages c where c.parent_id = p.id and c.status <> 'draft'),
        'parent', (select jsonb_build_object('id', q.id, 'type', q.type, 'slug', q.slug, 'title', q.title) from pages q where q.id = p.parent_id),
        'can_edit', can_edit_page(p)
    )
    from pages p where p.org_id = org and p.type = t and p.slug = s and (p.status <> 'draft' or can_edit_page(p)) limit 1;
$$;

create function pages_list(org uuid) returns setof pages language sql stable security definer set search_path = public as $$
    select * from pages where org_id = org and (status in ('live', 'ended', 'paused') or can_edit_page(pages)) order by created_at desc;
$$;
create function my_pages() returns setof pages language sql stable security definer set search_path = public as $$
    select * from pages where owner_id = auth.uid() order by created_at desc;
$$;
create function my_donations() returns setof donations language sql stable security definer set search_path = public as $$
    select * from donations where donor_id = auth.uid() and status <> 'pending' order by created_at desc;
$$;
create function my_supporters() returns setof supporters language sql stable security definer set search_path = public as $$
    select * from supporters where user_id = auth.uid();
$$;

create function activity(org uuid, n integer default 20) returns table (who text, usd numeric, at timestamptz, message text, page_id uuid) language sql stable security definer set search_path = public as $$
    select coalesce(s.name, d.name), d.usd_cents / 100.0, d.created_at, d.message, d.page_id from public_donations d left join supporters s on s.id = d.supporter_id
    where d.org_id = org and d.source <> 'match' order by d.created_at desc limit n;
$$;

-- Admin: the organisation's gifts with donor details.
create function org_donations(org uuid, n integer default 200, skip integer default 0) returns setof donations language sql stable security definer set search_path = public as $$
    select * from donations where org_id = org and is_member(org) and status <> 'pending' order by created_at desc limit n offset skip;
$$;
create function org_members_list(org uuid) returns table (user_id uuid, email text, name text, role text) language sql stable security definer set search_path = public as $$
    select m.user_id, p.email, p.name, m.role from org_members m join profiles p on p.id = m.user_id where m.org_id = org and is_member(org) order by m.created_at;
$$;
create function org_pledges(org uuid) returns setof match_pledges language sql stable security definer set search_path = public as $$
    select * from match_pledges where org_id = org order by created_at desc;
$$;
create function org_stats(org uuid) returns jsonb language sql stable security definer set search_path = public as $$
    select case when is_member(org) then jsonb_build_object(
        'raised_cents', coalesce(sum(usd_cents) filter (where status = 'succeeded'), 0),
        'tips_cents', coalesce(sum(tip_cents) filter (where status = 'succeeded'), 0),
        'donations', count(*) filter (where status = 'succeeded'),
        'donors', count(distinct lower(coalesce(donor_email, donor_name))) filter (where status = 'succeeded'),
        'recurring', count(*) filter (where status = 'succeeded' and recurring),
        'refunded_cents', coalesce(sum(usd_cents) filter (where status in ('refunded', 'disputed')), 0),
        'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'usd_cents', c) order by d), '[]'::jsonb) from (select created_at::date as d, sum(usd_cents) c from donations where org_id = org and status = 'succeeded' and created_at > now() - interval '30 days' group by 1) x),
        'pages', (select count(*) from pages where org_id = org and status = 'live')
    ) else null end from donations where org_id = org;
$$;

-- ---------------------------------------------------------------- row-level security
alter table profiles enable row level security;
alter table orgs enable row level security;
alter table org_members enable row level security;
alter table supporters enable row level security;
alter table pages enable row level security;
alter table ticket_types enable row level security;
alter table page_updates enable row level security;
alter table match_pledges enable row level security;
alter table donations enable row level security;
alter table stripe_events enable row level security;
alter table fx_rates enable row level security;

create policy "own profile" on profiles for select using (id = auth.uid());
create policy "edit own profile" on profiles for update using (id = auth.uid());
create policy "orgs are public" on orgs for select using (true);
create policy "members see members" on org_members for select using (is_member(org_id));
create policy "supporters are public" on supporters for select using (true);
create policy "pages are public" on pages for select using (status <> 'draft' or owner_id = auth.uid() or is_member(org_id));
create policy "tickets are public" on ticket_types for select using (true);
create policy "updates are public" on page_updates for select using (true);
create policy "pledges are public" on match_pledges for select using (true);
create policy "rates are public" on fx_rates for select using (true);
-- Donations: donors see their own, members see their org's. The public reads public_donations (a security-definer view) or the RPCs above.
create policy "own donations" on donations for select using (donor_id = auth.uid() or is_member(org_id));
-- No insert/update/delete policies: writes go through the RPCs (security definer) or the service role (Stripe webhook).

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
-- Internal helpers: only triggers (running as the table owner) and the service role may call them.
revoke all on function apply_match(donations) from public, anon, authenticated;
revoke all on function page_recount(uuid) from public, anon, authenticated;
revoke all on function supporter_for(uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- Live boards listen for new gifts.
do $$ begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        alter publication supabase_realtime add table donations;
        alter publication supabase_realtime add table orgs;
        alter publication supabase_realtime add table pages;
    end if;
end $$;
