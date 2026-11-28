-- SAMPLE DATA for the SAMPLE US org Hope Foundation (hope-foundation): its legal name and address, receipts for its 40 latest sample
-- gifts (six still to send), and a week of blocked card-testing attempts matching the prototype's "Blocked this week" (412).
-- Fraud events are dated from now(), so they age out of "this week" a week after this runs. Safe to run more than once:
-- receipts only while it has none, fraud events only while it has none.
-- To remove it:
--   delete from receipts where org_id = (select id from orgs where slug = 'hope-foundation') and number like 'HF-2027-%';
--   delete from fraud_events where org_id = (select id from orgs where slug = 'hope-foundation');
do $$
declare org uuid := (select id from orgs where slug = 'hope-foundation');
begin
    if org is null then return; end if;
    update orgs set legal_name = 'Hope Foundation Inc.', address = '410 Park Ave, Plainfield, NJ 07060' where id = org and legal_name = '';

    if not exists (select 1 from receipts r where r.org_id = org) then
        insert into receipts (org_id, donation_id, kind, year, number, donor_name, donor_email, currency, dated, fund, issuer, lines, deductible_cents, total_cents, irs_ack, sent_at, send_error)
        select org, d.id, 'gift', 2027, 'HF-2027-' || lpad((4370 + rn)::text, 5, '0'), d.donor_name, d.donor_email, d.currency, d.created_at, d.fund,
            jsonb_build_object('name', o.name, 'legal_name', o.legal_name, 'ein', o.ein, 'address', o.address, 'receipt_prefix', '', 'receipt_goods_line', true, 'color', o.color),
            jsonb_build_array(jsonb_build_object('label', coalesce(nullif(d.fund, ''), 'Gift'), 'amount_cents', d.amount_cents, 'deductible', true, 'kind', 'gift'))
                || case when d.cover_cents > 0 then jsonb_build_array(jsonb_build_object('label', 'Fees covered by donor', 'amount_cents', d.cover_cents, 'deductible', true, 'kind', 'fees')) else '[]'::jsonb end,
            d.amount_cents + d.cover_cents, d.amount_cents + d.cover_cents, d.amount_cents + d.cover_cents >= 25000,
            case when rn > 6 then d.created_at + interval '1 minute' end, case when rn <= 6 then 'not sent (console)' end
        from (select *, row_number() over (order by created_at desc) rn from donations where donations.org_id = org and status = 'succeeded' and donor_email is not null order by created_at desc limit 40) d
        cross join orgs o where o.id = org;
        insert into receipt_counters (org_id, year, kind, n) values (org, 2027, 'gift', 4410) on conflict (org_id, year, kind) do update set n = greatest(receipt_counters.n, 4410);
    end if;

    if not exists (select 1 from fraud_events f where f.org_id = org) then
        perform setseed(0.41);
        insert into fraud_events (org_id, at, kind, reason, attempt_key, ip_hash, email_domain, amount_cents)
        select org, now() - (random() * interval '6 days 20 hours'), 'block', reason, 'smp-' || reason || '-' || k,
            md5(reason || (k % 23)::text), case when reason = 'disposable_email' then 'mailinator.com' else 'gmail.com' end,
            case when reason = 'below_minimum' then 100 else 2500 end
        from (values ('below_minimum', 188), ('ip_rate', 96), ('card_rate', 57), ('challenge_failed', 41), ('disposable_email', 30)) r(reason, n), generate_series(1, n) k;
        insert into fraud_events (org_id, at, kind, reason, attempt_key, ip_hash, amount_cents)
        select org, now() - (random() * interval '6 days'), kind, reason, 'smp-' || kind || '-' || k, md5('d' || (k % 9)::text), 2500
        from (values ('decline', 'card_declined', 64), ('challenge', null, 23)) r(kind, reason, n), generate_series(1, n) k;
        insert into fraud_events (org_id, at, kind, reason) values (org, now() - interval '2 days 3 hours', 'alert', 'decline_burst');
    end if;
end $$;
