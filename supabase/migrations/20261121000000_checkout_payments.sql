-- Payment providers and the methods each organisation offers at checkout.
-- Stripe (card, Apple Pay / Google Pay, pay by bank, Bacs Direct Debit) is connected through Stripe Connect (stripe_account_id).
-- PayPal is connected by the organisation's PayPal merchant id, which PayPal Checkout pays straight to.
-- Safe to run more than once: the demo applies it on every start.
alter table orgs add column if not exists paypal_merchant_id text;
alter table orgs add column if not exists pay_methods jsonb not null default '{"card": true, "wallets": true, "bank": true, "dd": true, "paypal": true}';

create or replace function org_update(org uuid, p jsonb) returns orgs language plpgsql security definer set search_path = public as $$
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
        live = case when p ? 'live' then p -> 'live' else live end,
        paypal_merchant_id = case when p ? 'paypal_merchant_id' then nullif(trim(p ->> 'paypal_merchant_id'), '') else paypal_merchant_id end,
        pay_methods = case when p ? 'pay_methods' then pay_methods || (p -> 'pay_methods') else pay_methods end
    where id = org returning * into o;
    return o;
end $$;
