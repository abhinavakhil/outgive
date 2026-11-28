-- "Pledge now, pay later" from the phone give screen behind a live night's QR code. Anyone may call it, without signing in, so:
--  * Only while the charity has a live session going: orgs.live has been set by the presenter console and is not paused. The QR screen
--    is only shown in the room during one, and a pledge then belongs to that night (live.pledge_event, set by the host console).
--  * Rate limits: 3 pledges per email or phone per charity per hour, and 120 public pledges per charity per 10 minutes.
--  * Amount $1 to $1,000,000; a name; an email or a mobile number (US numbers normalised by phone_e164); pay by in 1 week, 1 month or 3 months.
-- It returns only the pay token, which the donor's own pay link is made of. Recovery reminders take the pledge from there.
-- Safe to run more than once.
create or replace function pledge_create_public(org_slug text, p jsonb) returns text language plpgsql security definer set search_path = public as $$
declare o orgs; email text := nullif(lower(trim(p ->> 'donor_email')), ''); raw_phone text := nullif(trim(p ->> 'donor_phone'), ''); ph text;
    nm text := trim(coalesce(p ->> 'donor_name', '')); amount bigint; due date; tok text;
begin
    select * into o from orgs where slug = lower(org_slug);
    if o.id is null then raise exception 'Charity not found'; end if;
    if o.live is null or o.live = '{}'::jsonb or coalesce((o.live ->> 'paused')::boolean, false) then raise exception 'Pledges open during a live night'; end if;
    if length(nm) not between 1 and 120 then raise exception 'Add your name'; end if;
    begin amount := (p ->> 'amount_cents')::bigint; exception when others then amount := null; end;
    if amount is null or amount < 100 or amount > 100000000 then raise exception 'Pledge between $1 and $1,000,000'; end if;
    if email is not null and email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'That email address does not look right'; end if;
    if raw_phone is not null then ph := phone_e164(raw_phone); if ph is null then raise exception 'That phone number does not look right'; end if; end if;
    if email is null and ph is null then raise exception 'Add a mobile number or an email so we can send your pay link'; end if;
    due := current_date + case p ->> 'pay_by' when '1w' then 7 when '1m' then 30 when '3m' then 90 end;
    if due is null then raise exception 'Choose when you will pay: 1w, 1m or 3m'; end if;
    -- pledged_at is now() for these rows, so the limits use the pledges_org index.
    if (select count(*) from pledges where org_id = o.id and pledged_at > now() - interval '1 hour' and ((email is not null and donor_email = email) or (ph is not null and donor_phone = ph))) >= 3
        then raise exception 'You have pledged a few times in the last hour. Please ask a volunteer to help.'; end if;
    if (select count(*) from pledges where org_id = o.id and created_by is null and pledged_at > now() - interval '10 minutes') >= 120
        then raise exception 'Lots of pledges right now. Please try again in a few minutes.'; end if;
    insert into pledges (org_id, donor_name, donor_email, donor_phone, event, amount_cents, currency, due_date, note)
    values (o.id, nm, email, ph, left(coalesce(nullif(trim(o.live ->> 'pledge_event'), ''), 'Live night'), 80), amount, o.currency, due, 'Pledged from the live screen')
    returning pay_token into tok;
    return tok;
end $$;
grant execute on function pledge_create_public(text, jsonb) to anon, authenticated;
