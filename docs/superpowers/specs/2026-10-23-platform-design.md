# Outgive platform design

Date: 23 October 2026. Turns the Outgive front-end demo into a sellable, white-label fundraising platform with a live-fundraising layer.

## Goal

A charity (or company, school, event) signs up, connects Stripe, brands its board, and runs campaigns, fundraiser pages, teams, events and live screens on its own domain. Donors pay by card, Apple Pay, Google Pay or Link, get a receipt by email, and see their name climb a live board. The platform runs on free tiers until there is revenue.

## Stack (cheapest that works)

| Need | Choice | Why |
|---|---|---|
| Database, auth, storage, realtime, functions | Supabase (free tier) | Postgres with RLS, 50k MAU auth, 200 concurrent realtime connections, 500k function calls/month, all free. One key to add. |
| Payments and payouts | Stripe Connect, destination charges with `on_behalf_of` | Charity is the settlement merchant; Stripe handles KYC and payouts; platform keeps tip + fee as the application fee. Checkout gives cards, wallets, Link and local methods with no PCI scope. |
| Receipts | Resend (free 3k/month) from the webhook | Stripe receipts lack charity acknowledgement wording. |
| Hosting | Vercel (existing config) | Static SPA, wildcard and custom domains. |
| Demo and tests without a backend | PGlite (Postgres in WASM) | The same migration runs in the browser for the public demo and in vitest. One schema, no second implementation. |

## Architecture

```
Browser (React SPA)
  └─ src/lib/db.ts       one interface: rpc(name,args), auth, realtime
       ├─ supabase mode   supabase-js → PostgREST RPC + Realtime + Auth   (VITE_SUPABASE_URL set)
       └─ demo mode       PGlite in the browser, seeded sample org        (no env: outgive.org/demo)
Supabase
  ├─ Postgres: supabase/migrations/*.sql  (tables, triggers, SQL API, RLS)
  └─ Edge functions: checkout, stripe-webhook, connect
Stripe Connect (charity accounts) ─ webhooks ─▶ stripe-webhook ─▶ donations table ─▶ Realtime ─▶ live screens
```

All reads and writes go through SQL functions (the "SQL API"). The app never queries tables directly, so the API is the list of functions in the migration, is tested in PGlite, and behaves identically in demo mode.

## Data model

- `orgs`: tenant. Brand (name, tagline, logo, colour, font, board variant, impact unit), currency, country, registration number, `custom_domain`, `remove_branding`, Stripe account and its status, `platform_fee_bps`, `tips_enabled`, `live` (presenter state), `verified`.
- `org_members`: owner / admin / editor.
- `supporters`: the rows on a board. A person, team, company or school, keyed by name per org. A fundraising page is also a supporter.
- `pages`: campaign, fundraiser, team, challenge, event, memory. `parent_id` nests fundraisers and teams under a campaign. `raised_cents` and `donor_count` are maintained by trigger and roll up to parents. `status` draft/live/paused/ended.
- `donations`: amount, currency, `usd_cents` (for boards), tip, cover-fees, platform fee, message, dedication, anonymous, recurring, source (card/offline/pledge/match/demo), status (pending/succeeded/refunded/disputed/failed), Stripe ids, ticket type and qty, `claimed_rank`.
- `ticket_types`, `page_updates`, `match_pledges` (a sponsor matches gifts up to a cap; the trigger inserts matching gifts), `fx_rates`, `stripe_events` (idempotency), `profiles`.

Row-level security: public reads of orgs, pages, supporters, updates, tickets, pledges and the `public_donations` view (no emails, anonymous names hidden). Donations are readable by their donor and org members. No public writes: all writes go through security-definer functions that check membership, or through the service role from the webhook.

## Money

- Gift `amount`, optional `tip` to the platform (0/5/10/15%, default 10% when `tips_enabled`), optional `cover` (estimated 2.9% + 30c) so the charity nets the gift.
- Stripe Checkout, destination charge: `transfer_data.destination = charity`, `on_behalf_of = charity`, `application_fee_amount = tip + platform fee`. The charity pays Stripe's processing fee out of its balance (covered when the donor ticks "cover fees").
- Monthly gifts: Checkout subscription mode with `application_fee_percent`; each `invoice.paid` becomes a donation row.
- Refunds and disputes flip the donation status; triggers recount; the board drops the rank (rule 8).

## Feature map (from the competitive research)

Core, built: donation form (amounts, once/monthly, cover fees, tip, anonymous, message, dedication, wallets via Checkout), campaign/fundraiser/team/challenge/event/memory pages in 12 layouts, nested P2P with roll-up, goal thermometer, updates, comments (gift messages), share + QR, embeds, organiser dashboard (stats, donations table, CSV, offline/pledge entry, refunds, members, branding, domain, Stripe onboarding, matching pledges, tickets), donor dashboard (history, pages, receipts), email receipts, 29 board layouts, custom domain and remove-branding, verification badge.

Differentiator, built: **Live**. A full-screen display per org or page (big total, thermometer, animated board, live gift ticker, confetti, milestone moments, QR, presenter "ask" banner), a transparent **overlay** for OBS/streams, a **presenter console** (set the ask, fire confetti, switch mode, record a pledge from the room), all pushed over Supabase Realtime.

Skipped for now (rare across competitors, or needs a vendor): auctions, raffles, text-to-give (Twilio), crypto/stock, Gift Aid claims, employer-match databases, SMS, CRM segments, Salesforce/QuickBooks. Each is a table plus a screen later; nothing in the schema blocks them.

## Routing and tenancy

Tenant is resolved from the host first (custom domain or `<slug>.outgive.org`), else from a `/o/<slug>` prefix. On a tenant host the prefix is dropped. Marketing site and `/demo` live on the bare domain with no tenant.

| Path (tenant-relative) | Screen |
|---|---|
| `/` | The org's board (29 layouts) |
| `/live`, `/overlay` | Live display and stream overlay |
| `/f/:slug`, `/c/:slug`, `/t/:slug`, `/ch/:slug`, `/e/:slug`, `/m/:slug` | Pages (+ `/live`, `/overlay`, `/manage`) |
| `/create` | Seven-step create flow |
| `/admin` | Organiser dashboard |
| `/thanks` | After Checkout |
| `/embed` | Widget routes |

Bare domain: `/`, `/demo`, `/layouts`, `/pricing`, `/start` (create an org), `/login`, `/dashboard`, `/about`, `/rules`, `/faq`, `/terms`, `/privacy`.

## Testing

- `tests/db.test.ts`: the schema, triggers, SQL API and RLS on real Postgres via PGlite (21 cases).
- `src/**/*.test.ts`: money maths, routing, board helpers.
- `supabase/functions/**/*_test.ts`: fee maths and webhook event mapping under Deno.
- Browser: the demo mode exercises every screen with the real schema; the Chrome run in this session is the smoke test.
- Not testable here: a real Stripe charge. The runbook covers Stripe test mode after keys are added.

## Decisions taken without asking

1. Supabase over a custom server: cheapest, and realtime is included.
2. Stripe Checkout (redirect) over an embedded Payment Element: no PCI scope, wallets for free, one fewer dependency. Swap later if conversion data says so.
3. Tip model by default with an optional per-org platform fee, matching the free tiers of Givebutter, Zeffy and Raisely.
4. Demo mode runs the real schema in the browser rather than a localStorage copy, so the public demo cannot drift from the product.
