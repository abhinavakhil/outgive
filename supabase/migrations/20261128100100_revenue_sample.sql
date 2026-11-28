-- SAMPLE DATA, not real donors: Ramadan 2027 gifts and checkout visits for the SAMPLE US org Hope Foundation (hope-foundation,
-- 20261128000050), so the revenue dashboards have something to show. It reproduces the Outgive US prototype's figures: $412,860
-- from 3,872 donors across six sources, five funds and three campaigns, 30 nights with odd-night spikes in the last ten and
-- Night 27 the biggest, a $20,000 match with $6,240 left, and the prototype's add-on take-up. Emails are @example.com.
-- Deterministic (setseed), and only added while hope-foundation has no tagged gifts, so it is safe to run more than once.
-- To remove it:
--   delete from donations where org_id = (select id from orgs where slug = 'hope-foundation') and tags ->> 'session' like 'smp-%';
--   delete from funnel_events where org_id = (select id from orgs where slug = 'hope-foundation') and session_id like 'smp-%';
--   delete from match_pledges where org_id = (select id from orgs where slug = 'hope-foundation') and sponsor_name = 'Al-Noor Family Foundation (sample)';
do $$
declare org uuid := (select id from orgs where slug = 'hope-foundation');
begin
    if org is null or exists (select 1 from donations where donations.org_id = org and tags ->> 'session' like 'smp-%') then return; end if;
    update orgs set timezone = 'America/New_York', ramadan_start = '2027-02-08' where id = org;
    insert into revenue_settings (org_id, ad_spend) values (org, '{"Meta ads": 940000}') on conflict (org_id) do nothing;
    perform setseed(0.27);
    -- The tags below are built here, already clean, and there are no pages or active match pots on this org: skip the per-row
    -- tag cleaning, the realtime broadcast (5,000 messages) and page / match bookkeeping while seeding. Turned back on at the end.
    alter table donations disable trigger donations_tags, disable trigger donations_broadcast, disable trigger donations_after;
    alter table funnel_events disable trigger funnel_events_tags;

    create temp table _src (si int, channel text, dollars numeric, donors int, visitors int) on commit drop;
    insert into _src values (1, 'Live night QR', 128400, 1042, 2310), (2, 'Email', 84950, 702, 3900), (3, 'Meta ads', 61300, 588, 9800),
        (4, 'Fundraiser pages', 58210, 731, 3050), (5, 'Website direct', 46700, 390, 4100), (6, 'WhatsApp shares', 33300, 419, 1880);
    create temp table _fund (fi int, fund text, dollars numeric, donors int) on commit drop;
    insert into _fund values (1, 'Zakat', 176300, 1210), (2, 'Sadaqah', 121480, 1630), (3, 'Zakat al-Fitr', 38940, 702), (4, 'Fidya', 9720, 188), (5, 'Building fund', 66420, 142);
    -- The prototype's nightly weights.
    create temp table _nw (n int, cw numeric) on commit drop;
    insert into _nw select n, sum(w) over (order by n) / sum(w) over () from (
        select n, (0.7 + 0.025 * n + ((n * 37) % 7) / 30.0) * case when n > 20 then 1.7 else 1 end * case when n > 20 and n % 2 = 1 then 1.35 else 1 end * case when n = 27 then 1.6 else 1 end as w
        from generate_series(1, 30) n) x;

    -- Gifts: 5,240 in all, split source x fund by donors, each cell's dollars spread over its gifts (log-normal) in whole dollars.
    create temp table _g on commit drop as
    with cell as (
        select s.si, s.channel, s.donors as sdonors, f.fund, round(s.donors * 5240.0 / 3872 * f.donors / 3872)::int as n, round(s.dollars * 100 * f.dollars / 412860)::bigint as cents
        from _src s cross join _fund f),
    g0 as (select c.*, exp(0.9 * sqrt(-2 * ln(1 - random())) * cos(2 * pi() * random())) as w from cell c, generate_series(1, greatest(c.n, 1)) k),
    g1 as (select *, greatest(500, round(cents * w / sum(w) over (partition by si, fund) / 100) * 100)::bigint as amt, row_number() over (partition by si, fund order by w desc) as rk from g0)
    select si, channel, sdonors, fund, greatest(100, case when rk = 1 then amt + cents - sum(amt) over (partition by si, fund) else amt end)::bigint as amount, random() as r from g1;

    -- Nights: walk the gifts in random order and give each the night its running total falls in, so nights follow the weights.
    create temp table _g2 on commit drop as
    select g.*, (select min(n) from _nw where cw >= g.pos) as night from (
        select g.*, (sum(g.amount) over (order by g.r rows unbounded preceding) - g.amount / 2.0) / sum(g.amount) over () as pos,
            row_number() over (partition by g.si order by g.r) - 1 as j, row_number() over (order by g.r) as gid
        from _g g) g;

    insert into donations (org_id, donor_name, donor_email, anonymous, amount_cents, currency, cover_cents, fund, recurring, source, status, pay_method, provider, created_at, tags)
    select org, (array['Yusuf', 'Aisha', 'Omar', 'Fatima', 'Bilal', 'Hana', 'Ibrahim', 'Maryam', 'Zaid', 'Sara', 'Khalid', 'Noor', 'Amina', 'Hamza', 'Layla', 'Idris'])[1 + d % 16]
            || ' ' || (array['Rahman', 'Khan', 'Siddiqui', 'Malik', 'Ahmed', 'Yusuf', 'Patel', 'Ali', 'Hassan', 'Qureshi', 'Mansour', 'Abbas', 'Chaudhry', 'Haddad'])[1 + (d / 16) % 14],
        'donor' || d || '@example.com', d % 10 = 0, amount, 'USD',
        case when fee then round(amount * 0.0225 + 31)::bigint else 0 end,
        fund, false, 'card', 'succeeded', case when amount >= 50000 and d % 3 = 0 then 'bank' when d % 4 = 0 then 'wallet' else 'card' end, 'stripe',
        ((date '2027-02-08' + night - 2) + interval '12 hours' + case when d % 5 = 0 then random() * interval '24 hours' else interval '6 hours' + random() * interval '7 hours' end) at time zone 'America/New_York',
        jsonb_strip_nulls(jsonb_build_object(
            'session', 'smp-' || si || '-' || lpad(j::text, 5, '0'), 'channel', channel, 'campaign', campaign, 'rhythm', rhythm, 'layout', layout, 'device', device,
            'seconds', 35 + (d * 7919) % 260, 'state', (array['NY', 'NJ', 'TX', 'CA', 'IL', 'MI', 'VA', 'GA', 'PA', 'MD'])[1 + d % 10],
            'zip', (array['11201', '07306', '77072', '92612', '60659', '48126', '22041', '30044', '19143', '20850'])[1 + d % 10],
            'consent', jsonb_build_object('email', d % 5 < 3, 'sms', d % 4 = 0),
            'qr', case when si = 1 then case when d % 5 = 0 then 'screen-main' else 'table-' || (1 + d % 12) end end,
            'event', case when si = 1 then 'night-' || night end,
            'utm_source', case si when 2 then 'newsletter' when 3 then (array['facebook', 'instagram'])[1 + d % 2] when 6 then 'whatsapp' end,
            'utm_medium', case si when 2 then 'email' when 3 then 'paid_social' when 6 then 'social' end,
            'utm_campaign', case si when 2 then (array['night-21', 'last-ten', 'zakat-reminder', 'night-27'])[1 + d % 4] when 3 then (array['r27_zakat', 'r27_lastten', 'r27_building'])[1 + d % 3] end,
            'utm_content', case when si = 3 then (array['video-a', 'carousel-b', 'static-c'])[1 + d % 3] end,
            'click_id', case when si = 3 then 'fb.' || substr(md5(gid::text), 1, 16) end, 'click_type', case when si = 3 then 'fbclid' end,
            'referrer', case when si = 6 then 'https://wa.me/' end,
            'fundraiser', case when si = 4 then (array['aisha-runs-for-water', 'youth-team', 'sisters-iftar-circle', 'omar-30-nights', 'masjid-brothers'])[1 + d % 5] end,
            'team', case when si = 4 and d % 5 in (1, 4) then (array['youth', 'brothers'])[1 + d % 2] end,
            'addons_shown', '["zakat_al_fitr", "fidya", "last_ten", "monthly", "dedication", "roundup"]'::jsonb,
            'addons', nullif(jsonb_strip_nulls(jsonb_build_object(
                'zakat_al_fitr', case when (gid * 37) % 100 < 34 then least(1500 * (1 + d % 6), amount / 2) end,
                'fidya', case when (gid * 41) % 100 < 3 then least(1500 * (1 + d % 10), amount / 2) end,
                'last_ten', case when rhythm = 'nightly' then 0 end, 'monthly', case when rhythm = 'monthly' then 0 end,
                'dedication', case when (gid * 43) % 100 < 6 then 0 end, 'roundup', case when (gid * 47) % 1000 < 24 then least(4000, amount / 2) end)), '{}'::jsonb)))
    from (
        select g.*, (coalesce((select sum(donors) from _src s where s.si < g.si), 0) + g.j % g.sdonors)::int as d,
            case when g.fund = 'Building fund' then 'Building fund dinner' when g.night > 20 and g.gid % 2 = 0 then 'Last ten nights' else 'Ramadan appeal' end as campaign,
            case when (g.gid * 13) % 100 < 9 then 'monthly' when g.night >= 21 and (g.gid * 17) % 100 < 18 then 'nightly' else 'once' end as rhythm,
            (g.gid * 31) % 100 < 71 as fee,
            case when g.si = 1 then 'pledge' when g.gid % 3 = 0 then 'ticket' else 'hero' end as layout,
            case when g.si in (1, 6) then case when g.gid % 20 = 0 then 'tablet' else 'mobile' end when g.gid % 10 < 6 then 'mobile' when g.gid % 10 < 9 then 'desktop' else 'tablet' end as device
        from _g2 g
    ) x;

    -- The checkout funnel, one row per session at the furthest step it reached (the dashboards count a session for every step up to
    -- that one; paid comes from the gifts). Every gift's session reached payment; the other visitors stopped along the way.
    insert into funnel_events (org_id, session_id, step, tags, created_at)
    select org, d.tags ->> 'session', 'payment_attempted', jsonb_build_object('channel', d.tags ->> 'channel', 'device', d.tags ->> 'device', 'layout', d.tags ->> 'layout'),
        d.created_at - interval '20 seconds'
    from donations d where d.org_id = org and d.tags ->> 'session' like 'smp-%';
    insert into funnel_events (org_id, session_id, step, tags, created_at)
    select org, 'smp-' || v.si || '-' || lpad(v.j::text, 5, '0'), (array['visit', 'checkout_started', 'amount_chosen', 'payment_attempted'])[v.reached],
        jsonb_build_object('channel', v.channel, 'device', case when v.si in (1, 6) or v.j % 10 < 7 then 'mobile' when v.j % 10 < 9 then 'desktop' else 'tablet' end,
            'layout', case when v.si = 1 then 'pledge' when v.j % 3 = 0 then 'ticket' else 'hero' end),
        ((date '2027-02-08' + v.night - 2) + interval '18 hours' + v.t * interval '6 hours') at time zone 'America/New_York'
    from (
        select u.*, (select min(n) from _nw where cw >= u.p) as night from (
            select s.si, s.channel, j, random() as p, random() as t,
                case when j % 20 < 11 then 1 when j % 20 < 15 then 2 when j % 20 < 18 then 3 else 4 end as reached
            from _src s cross join lateral generate_series((select count(*) from _g2 g where g.si = s.si)::int, s.visitors - 1) j) u
    ) v;

    -- The sponsor's match pot: $20,000, $6,240 left. Inactive, so it never matches real gifts or the later journeys sample (20261128400100);
    -- revenue_tonight lists it under match_pots. Set active = true to try matching on the sample org.
    insert into match_pledges (org_id, sponsor_name, ratio, cap_cents, matched_cents, active)
    values (org, 'Al-Noor Family Foundation (sample)', 1, 2000000, 1376000, false);
    alter table donations enable trigger donations_tags, enable trigger donations_broadcast, enable trigger donations_after;
    alter table funnel_events enable trigger funnel_events_tags;
end $$;
