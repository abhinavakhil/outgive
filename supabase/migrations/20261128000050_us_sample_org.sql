-- SAMPLE ORG, not a real charity: "Hope Foundation", the US mosque/charity from the Outgive US prototype. Shared sample data for the
-- US features (pledges, revenue, receipts) lives here so the real demo charity (clearwell) stays clean. EIN 12-3456789 is a
-- placeholder and is never verified. Safe to run more than once.
-- The ein column belongs to 20261128200000_receipts_ein_fraud.sql; it is added here with the identical definition because this
-- runs first, which makes that migration's `add column if not exists` a no-op.
alter table orgs add column if not exists ein text not null default '' check (ein ~ '^([0-9]{9})?$');
insert into orgs (slug, name, tagline, description, currency, country, registration_number, ein)
values ('hope-foundation', 'Hope Foundation', 'SAMPLE charity for demos', 'SAMPLE DATA: a made-up US charity used to show Outgive Engage. Not a real organization.', 'USD', 'US', 'EIN 12-3456789', '123456789')
on conflict (slug) do nothing;
