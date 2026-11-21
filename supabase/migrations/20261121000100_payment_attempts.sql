-- Checkout attempts: one donation row per attempt key, so retrying the same attempt finds its row (and its PaymentIntent) instead of charging again.
-- Safe to run more than once.
alter table donations add column if not exists attempt_key text;
alter table donations add column if not exists pay_method text;      -- card, wallet, dd, bank, paypal
alter table donations add column if not exists pay_error text;       -- the provider's last decline / error code, for support
alter table donations add column if not exists paypal_order_id text;
create unique index if not exists donations_attempt_key on donations (attempt_key);
create unique index if not exists donations_paypal_order on donations (paypal_order_id);
