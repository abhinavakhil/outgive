-- SAMPLE DATA, not real donors: the six Ramadan 1448 donors from the Engage prototype, plus one lapsed donor, on the shared US sample
-- charity (hope-foundation, from 20261128000050), so the journey and impact screens have something to show. Names are made up;
-- emails are @example.com and phones are in the fictional 555-01xx range. Returning donors also gave in Ramadan 1447 (2026).
-- Every row carries details.sample = 'journeys'. Only added once, and only if hope-foundation exists. Remove with:
--   delete from donations where org_id = (select id from orgs where slug = 'hope-foundation') and details ->> 'sample' = 'journeys';
do $$
declare org uuid := (select id from orgs where slug = 'hope-foundation'); r record;
begin
    if org is null or exists (select 1 from donations where org_id = org and details ->> 'sample' = 'journeys') then return; end if;
    for r in select * from (values
        -- name,          fund,            dollars, day (NY),     phone with SMS consent
        ('Aisha Khan',    'Zakat',           1200, '2027-03-02', '+12125550102'),
        ('Aisha Khan',    'Sadaqah',          340, '2027-02-20', null),
        ('Aisha Khan',    'Zakat al-Fitr',     60, '2027-03-07', null),
        ('Yusuf Rahman',  'Zakat',           3000, '2027-03-04', '+12125550101'),
        ('Yusuf Rahman',  'Building fund',   5000, '2027-03-05', null),
        ('Yusuf Rahman',  'Sadaqah',          500, '2027-02-27', null),
        ('Yusuf Rahman',  'Zakat',           2500, '2026-03-14', null),
        ('Maryam Ali',    'Sadaqah',          280, '2027-02-15', null),
        ('Maryam Ali',    'Zakat al-Fitr',     75, '2027-03-08', null),
        ('Maryam Ali',    'Fidya',            150, '2027-02-24', null),
        ('Bilal Ahmed',   'Building fund',   3000, '2027-03-05', '+12125550105'),
        ('Bilal Ahmed',   'Zakat',            950, '2027-03-01', null),
        ('Bilal Ahmed',   'Sadaqah',          400, '2026-03-12', null),
        ('Hana Yusuf',    'Sadaqah',          120, '2027-02-28', null),
        ('Hana Yusuf',    'Zakat al-Fitr',     45, '2027-03-08', null),
        ('Sara Qureshi',  'Zakat',           2400, '2027-03-03', null),
        ('Sara Qureshi',  'Sadaqah',         1000, '2027-03-05', null),
        ('Sara Qureshi',  'Zakat al-Fitr',     90, '2027-03-07', null),
        ('Sara Qureshi',  'Zakat',           2000, '2026-03-16', null),
        ('Omar Siddiqui', 'Sadaqah',          250, '2026-03-15', null)   -- lapsed: gave in Ramadan 1447, not 1448
    ) as s (name, fund, dollars, day, phone) loop
        insert into donations (org_id, donor_name, donor_email, amount_cents, currency, usd_cents, fund, status, source, created_at, details)
        values (org, r.name, lower(replace(r.name, ' ', '.')) || '@example.com', r.dollars * 100, 'USD', r.dollars * 100, r.fund, 'succeeded', 'card',
            (r.day || ' 21:00')::timestamp at time zone 'America/New_York',
            jsonb_build_object('sample', 'journeys') || case when r.phone is null then '{}'::jsonb else jsonb_build_object('phone', r.phone, 'sms_consent', true) end);
    end loop;
end $$;
