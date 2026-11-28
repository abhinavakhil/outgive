-- Outgive Engage: text-to-give keywords (plan item 32) and SMS opt-outs from the inbound webhook (sms-inbound edge function).
-- One Outgive number serves every charity, so a keyword ("IFTAR") is unique across Outgive. Texting it replies with a one-tap give
-- link (amount and fund filled in); nothing is billed to the phone.
-- STOP from a number: pauses that number's pledge reminders (pledges.reminders_paused) and suppresses SMS for it at every charity
-- that has it (contact_suppressions, which journeys honour), and remembers both in sms_optouts so START undoes exactly that.
-- Campaign templates need no SQL: they are saved on the page with bio_save (src/features/engage/campaigns/templates.ts).
-- Reads: viewer or higher. Writes: editor or higher through the functions below; the webhook uses the service role. Safe to rerun.

create table if not exists sms_keywords (
    keyword text primary key check (keyword ~ '^[A-Z][A-Z0-9]{2,14}$'
        and keyword not in ('STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'REVOKE', 'START', 'UNSTOP', 'YES', 'OPTIN', 'HELP', 'INFO')),
    org_id uuid not null references orgs (id) on delete cascade,
    fund text not null default '' check (fund in ('', 'general', 'zakat', 'sadaqah', 'zakat_al_fitr', 'fidya')),  -- checkout fund ids
    amount_cents integer check (amount_cents is null or amount_cents between 100 and 1000000),                -- when the text has no amount
    appeal text not null default '' check (length(appeal) <= 60),                                             -- "Iftar 1448", said in the reply
    created_at timestamptz not null default now()
);
create index if not exists sms_keywords_org on sms_keywords (org_id);

create table if not exists sms_optouts (
    phone text primary key check (phone ~ '^\+[1-9][0-9]{7,14}$'),
    opted_out boolean not null default true,
    paused_pledges uuid[] not null default '{}',   -- pledges this STOP paused, resumed on START
    suppressed_orgs uuid[] not null default '{}',  -- charities this STOP suppressed
    updated_at timestamptz not null default now()
);

alter table sms_keywords enable row level security;
alter table sms_optouts enable row level security;
drop policy if exists "team reads keywords" on sms_keywords;
create policy "team reads keywords" on sms_keywords for select using (has_role(org_id, 'viewer'));
grant select on sms_keywords to authenticated;
grant all on sms_keywords, sms_optouts to service_role;

/** The org's keywords. Viewer or higher. */
create or replace function sms_keywords_list(org uuid) returns setof sms_keywords language sql stable security definer set search_path = public as $$
    select * from sms_keywords where org_id = org and has_role(org, 'viewer') order by keyword
$$;

/** Adds or changes one of the org's keywords: {keyword, fund, amount_cents, appeal}. Editor or higher. A keyword another charity has is refused. */
create or replace function sms_keyword_save(org uuid, k jsonb) returns sms_keywords language plpgsql security definer set search_path = public as $$
declare kw text := upper(trim(coalesce(k ->> 'keyword', ''))); r sms_keywords;
begin
    if not has_role(org, 'editor') then raise exception 'Only editors can change keywords' using errcode = '42501'; end if;
    if exists (select 1 from sms_keywords where keyword = kw and org_id <> org) then raise exception 'Another charity already uses %. Pick another word.', kw; end if;
    insert into sms_keywords (keyword, org_id, fund, amount_cents, appeal)
    values (kw, org, coalesce(k ->> 'fund', ''), nullif(k ->> 'amount_cents', '')::integer, coalesce(k ->> 'appeal', ''))
    on conflict (keyword) do update set fund = excluded.fund, amount_cents = excluded.amount_cents, appeal = excluded.appeal
    returning * into r;
    return r;
end $$;

create or replace function sms_keyword_delete(org uuid, kw text) returns void language plpgsql security definer set search_path = public as $$
begin
    if not has_role(org, 'editor') then raise exception 'Only editors can change keywords' using errcode = '42501'; end if;
    delete from sms_keywords where keyword = upper(kw) and org_id = org;
end $$;

/** For the webhook (service role): the keyword with its charity's slug and name. */
create or replace function sms_keyword_find(kw text) returns table (keyword text, org_slug text, org_name text, fund text, amount_cents integer, appeal text)
language sql stable security definer set search_path = public as $$
    select k.keyword, o.slug, o.name, k.fund, k.amount_cents, k.appeal from sms_keywords k join orgs o on o.id = k.org_id where k.keyword = upper(kw)
$$;

/**
 * STOP (stop = true) or START (false) from a phone, for the webhook (service role). Returns what changed.
 * STOP pauses the number's open pledge reminders and suppresses SMS at each charity that holds the number; START undoes only what STOP did
 * (a pledge staff paused stays paused; a 'staff' or 'complained' suppression stays).
 */
create or replace function sms_opt(raw_phone text, stop boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare ph text := phone_e164(raw_phone); paused uuid[]; orgs_ uuid[]; o sms_optouts;
begin
    if ph is null then raise exception 'Not a phone number'; end if;
    if stop then
        with p as (update pledges set reminders_paused = true where donor_phone = ph and not reminders_paused returning id) select coalesce(array_agg(id), '{}') into paused from p;
        select coalesce(array_agg(distinct x), '{}') into orgs_ from (
            select org_id as x from pledges where donor_phone = ph
            union select org_id from journey_enrollments where phone = ph
            union select org_id from donations where phone_e164(details ->> 'phone') = ph) s;
        with i as (insert into contact_suppressions (org_id, channel, address, reason) select unnest(orgs_), 'sms', ph, 'unsubscribed' on conflict do nothing returning org_id)
        select coalesce(array_agg(org_id), '{}') into orgs_ from i;
        insert into sms_optouts (phone, opted_out, paused_pledges, suppressed_orgs) values (ph, true, paused, orgs_)
        on conflict (phone) do update set opted_out = true, paused_pledges = sms_optouts.paused_pledges || excluded.paused_pledges,
            suppressed_orgs = sms_optouts.suppressed_orgs || excluded.suppressed_orgs, updated_at = now();
        -- Texts already queued for this number, at any charity, are not sent. (New ones are skipped by the triggers below.)
        update pledge_reminders r set status = 'skipped', error = 'opted_out' from pledges p where p.id = r.pledge_id and p.donor_phone = ph and r.channel = 'sms' and r.status = 'pending';
        update journey_sends s set status = 'skipped', error = 'opted_out' from journey_enrollments e where e.id = s.enrollment_id and e.phone = ph and s.channel = 'sms' and s.status = 'pending';
        return jsonb_build_object('phone', ph, 'paused', cardinality(paused), 'suppressed', cardinality(orgs_));
    end if;
    select * into o from sms_optouts where phone = ph;
    if not found then return jsonb_build_object('phone', ph, 'resumed', 0, 'unsuppressed', 0); end if;
    update pledges set reminders_paused = false where id = any (o.paused_pledges);
    delete from contact_suppressions where channel = 'sms' and address = ph and reason = 'unsubscribed' and org_id = any (o.suppressed_orgs);
    update sms_optouts set opted_out = false, paused_pledges = '{}', suppressed_orgs = '{}', updated_at = now() where phone = ph;
    return jsonb_build_object('phone', ph, 'resumed', cardinality(o.paused_pledges), 'unsuppressed', cardinality(o.suppressed_orgs));
end $$;

-- ---------------------------------------------------------------- our own texts skip opted-out numbers, at every charity
-- A text queued for a number that replied STOP (to any charity: one Outgive number) goes in as skipped, error 'opted_out', so
-- pledge_reminders_claim and journey_sends_claim never take it. Together with the sweep in sms_opt, nothing pending is left for it.
-- START does not bring skipped texts back; later ones are queued as normal.
create or replace function sms_opted_out(ph text) returns boolean language sql stable security definer set search_path = public as $$
    select ph is not null and exists (select 1 from sms_optouts where phone = ph and opted_out)
$$;
create or replace function pledge_reminders_sms_optout() returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.channel = 'sms' and new.status = 'pending' and sms_opted_out((select donor_phone from pledges where id = new.pledge_id)) then
        new.status := 'skipped'; new.error := 'opted_out';
    end if;
    return new;
end $$;
create or replace function journey_sends_sms_optout() returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.channel = 'sms' and new.status = 'pending' and sms_opted_out((select phone from journey_enrollments where id = new.enrollment_id)) then
        new.status := 'skipped'; new.error := 'opted_out';
    end if;
    return new;
end $$;
drop trigger if exists sms_optout on pledge_reminders;
create trigger sms_optout before insert or update of status on pledge_reminders for each row execute function pledge_reminders_sms_optout();
drop trigger if exists sms_optout on journey_sends;
create trigger sms_optout before insert or update of status on journey_sends for each row execute function journey_sends_sms_optout();
revoke execute on function sms_opted_out(text), pledge_reminders_sms_optout(), journey_sends_sms_optout() from public, anon, authenticated;

grant execute on function sms_keywords_list(uuid), sms_keyword_save(uuid, jsonb), sms_keyword_delete(uuid, text) to authenticated;
revoke execute on function sms_keyword_find(text), sms_opt(text, boolean) from public, anon, authenticated;
grant execute on function sms_keyword_find(text), sms_opt(text, boolean) to service_role;

-- ---------------------------------------------------------------- the sample charity's keywords (Hope Foundation, not a real charity)
insert into sms_keywords (keyword, org_id, fund, amount_cents, appeal)
select v.k, o.id, v.f, v.a, v.ap from orgs o, (values ('IFTAR', 'general', 5000, 'Iftar 1448'), ('ZAKAT', 'zakat', null, 'Zakat'), ('BUILD', 'general', 2500, 'the building fund')) v(k, f, a, ap)
where o.slug = 'hope-foundation'
on conflict (keyword) do nothing;
