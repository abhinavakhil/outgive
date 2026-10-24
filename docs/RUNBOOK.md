# Outgive runbook: from repository to a live platform

Everything below runs on free tiers until there is revenue. Budget about an hour the first time.
You will add exactly three sets of keys: Supabase (frontend), Stripe (secrets), Resend (secret).

## 0. Local

    npm install
    npm run dev          # http://localhost:5173 runs the demo on an in-browser Postgres; no backend needed
    npm test             # vitest: schema, SQL API, RLS, seed, money, routing (PGlite)
    npm run test:fn      # Deno: fee maths and Stripe webhook mapping
    npm run build        # dist/ with prerendered marketing pages

## 1. Supabase project (database, auth, realtime, storage, functions)

1. Create a project at https://supabase.com/dashboard (free tier). Pick the region nearest your donors.
2. Install the CLI (`npm i -g supabase`) and link it:

        supabase login
        supabase link --project-ref <PROJECT_REF>
        supabase db push                 # applies supabase/migrations/*.sql: tables, triggers, SQL API, RLS, storage bucket
        supabase functions deploy        # checkout, stripe-webhook, connect (JWT settings come from supabase/config.toml)

3. Auth, URL configuration: set **Site URL** to your domain and add `https://<your-domain>/**` to the redirect URLs.
   Email magic links work out of the box. For "Continue with Google", enable the Google provider (Auth, Providers) with
   a Google OAuth client; otherwise leave it off and the button reports that the provider is disabled.
4. Auth, Email templates: optional, but change the sender name to your brand.
5. Project Settings, API: copy the **Project URL** and the **anon public** key. These are the two frontend variables.

Realtime: the migration adds `orgs` and `pages` to the publication and broadcasts every gift on a private per-org channel that
anyone can read and nobody can write. Nothing to click.

## 2. Stripe (payments, wallets, payouts to charities)

1. Stripe Dashboard, Connect, **Get started**. Choose the platform/marketplace setup; charities become connected accounts.
   Outgive uses controller properties (Stripe-hosted Express dashboard, platform pays fees and owns losses).
2. Developers, API keys: copy the **secret key**.
3. Developers, Webhooks, Add endpoint:
   `https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`, listening to **your account and connected accounts**, events:

        checkout.session.completed
        checkout.session.async_payment_succeeded
        checkout.session.async_payment_failed
        checkout.session.expired
        invoice.paid
        charge.refunded
        charge.dispute.created
        charge.dispute.closed
        account.updated

   Copy the **signing secret**.
4. Set the function secrets once:

        supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... SITE_URL=https://<your-domain>

Test first with `sk_test_` keys and a test-mode webhook, then repeat with live keys. Test card: 4242 4242 4242 4242.

## 3. Resend (donation receipts)

1. https://resend.com: add and verify your sending domain, create an API key.
2. `supabase secrets set RESEND_API_KEY=re_... RECEIPT_FROM="Outgive <receipts@your-domain>"`

Without this key gifts still work; receipts are not emailed and `receipt_sent_at` stays null.

## 4. Frontend on Vercel

1. Import the repository in Vercel. Build command `npm run build`, output `dist` (vercel.json already rewrites every path to the app shell).
2. Environment variables (Production and Preview):

        VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
        VITE_SUPABASE_ANON_KEY=<anon key>

3. Domains: add your apex (for example `outgive.org`) **and** the wildcard `*.outgive.org` so `<charity>.outgive.org` boards resolve.
   Update `SITE.url` in `src/seo.ts` if the domain is not outgive.org.

Any static host works (Netlify reads `public/_redirects`), but wildcard subdomains need a host that supports them.

## 5. Custom domains for charities

A charity types `give.theircharity.org` in Admin, Domain. To serve it:

1. They add a CNAME for that host pointing at your Vercel deployment (`cname.vercel-dns.com`).
2. You add the host to the Vercel project (Domains, Add). Vercel issues the certificate.

The app resolves the tenant by host (`org_by_host`), so no redeploy is needed. Automating step 2 is one call to the Vercel
Domains API from an admin action; not built yet because the first customers can be added by hand.

## 6. Go-live checklist

- [ ] `supabase db push` and `supabase functions deploy` succeeded; a POST with an empty body to `/functions/v1/checkout` returns a JSON error, not a 404.
- [ ] Sign in by magic link on the live site; create an org at `/start`; connect Stripe from Admin, Payments (test mode).
- [ ] Give to your own board and to a page with the test card. The gift lands on the board within a second, the Live screen fires confetti, the Thanks page shows the gift, the receipt email arrives.
- [ ] Refund the gift in Stripe. The board total drops and the gift shows as refunded in Admin.
- [ ] Switch Stripe secrets to live keys and the webhook to the live endpoint.
- [ ] Replace the draft Terms and Privacy pages (`LEGAL_DRAFT` in `src/seo.ts`) with reviewed text, then set the flag to false so they are indexed.
- [ ] Update `fx_rates` to current values. They only rank boards across currencies; charges are always in the gift's own currency.

## Operating

- **Fees**: default 0% platform fee plus an optional donor tip (10% suggested). `platform_fee_bps` on the `orgs` row changes the application fee for one charity. Stripe processing fees are paid by the charity unless the donor ticks "cover fees".
- **Refunds**: from Admin, Donations (calls Stripe) or from the Stripe dashboard; the webhook keeps both in sync.
- **Disputes**: `charge.dispute.created` marks the gift disputed and removes it from totals; a dispute closed in the charity's favour restores it.
- **Verification badge**: `update orgs set verified = true where slug = '...'` after checking the charity register. No UI yet.
- **Logs**: Supabase, Edge Functions, Logs. Every rejected webhook logs the reason; every processed Stripe event id is stored in `stripe_events`, so a replay is a no-op.
- **Backups**: the Supabase free tier keeps no automatic backups. Run `supabase db dump -f backup.sql` weekly, or upgrade to Pro ($25/month) when the first charity is live.
- **Free-tier ceilings**: 500 MB database, 1 GB storage, 200 concurrent realtime connections (a gala with 200+ open live screens needs Pro), 500k function calls a month.
