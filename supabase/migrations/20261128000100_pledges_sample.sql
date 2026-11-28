-- SAMPLE DATA, not real donors: twelve Ramadan 2027 pledges on the SAMPLE US org Hope Foundation (hope-foundation, 20261128000050), so the pledge screens have something to
-- show. Names are made up; emails are @example.com and phones are in the fictional 555-01xx range. Pledge dates assume Ramadan 1448
-- starts on 8 February 2027 (Night N is the evening of 7 Feb + N - 1 days). Only added while hope-foundation has no pledges, so it is
-- safe to run more than once and never touches real pledges. To remove them:
--   delete from pledges where org_id = (select id from orgs where slug = 'hope-foundation') and donor_email like '%@example.com';
do $$
declare org uuid := (select id from orgs where slug = 'hope-foundation'); r record; pid uuid;
begin
    if org is null or exists (select 1 from pledges where org_id = org) then return; end if;
    for r in select * from (values
        ('Yusuf Rahman',   'Night 27 dinner',       500000, 500000, 'pay_link', '2027-03-05', '2027-03-15', '+12125550101'),
        ('Aisha Khan',     'Night 27 dinner',       250000, 100000, 'pay_link', '2027-03-05', '2027-03-20', '+12125550102'),
        ('Omar Siddiqui',  'Night 21',             1000000,      0, null,       '2027-02-27', '2027-03-12', '+12125550103'),
        ('Fatima Malik',   'Night 25',              120000,      0, null,       '2027-03-03', '2027-03-25', '+12125550104'),
        ('Bilal Ahmed',    'Night 27 dinner',       300000, 300000, 'check',    '2027-03-05', null,         '+12125550105'),
        ('Hana Yusuf',     'Night 23',               75000,      0, null,       '2027-03-01', '2027-03-10', '+12125550106'),
        ('Ibrahim Patel',  'Building fund dinner', 1500000, 600000, 'ach',      '2027-02-20', '2027-04-30', '+12125550107'),
        ('Maryam Ali',     'Night 29',               50000,      0, null,       '2027-03-07', '2027-03-18', '+12125550108'),
        ('Zaid Hassan',    'Night 27 dinner',       200000,      0, null,       '2027-03-05', '2027-03-08', '+12125550109'),
        ('Sara Qureshi',   'Night 25',              100000, 100000, 'zelle',    '2027-03-03', null,         '+12125550110'),
        ('Khalid Mansour', 'Building fund dinner',  750000,      0, null,       '2027-02-20', '2027-04-30', '+12125550111'),
        ('Noor Abbas',     'Night 21',               30000,      0, null,       '2027-02-27', '2027-03-05', '+12125550112')
    ) as s (name, event, amount, paid, method, night, due, phone) loop
        insert into pledges (org_id, donor_name, donor_email, donor_phone, event, amount_cents, currency, pledged_at, due_date, note)
        values (org, r.name, lower(replace(r.name, ' ', '.')) || '@example.com', r.phone, r.event, r.amount, 'USD',
            (r.night || ' 21:00')::timestamp at time zone 'America/New_York', r.due::date, 'Sample pledge')
        returning id into pid;
        if r.paid > 0 then
            insert into pledge_payments (pledge_id, amount_cents, method, received_at) values (pid, r.paid, r.method, (r.night || ' 21:30')::timestamp at time zone 'America/New_York');
        end if;
    end loop;
end $$;
