# Checkout

`src/features/checkout` is the donate flow as a library. Any app can drop it in, whether that's a campaign page, a Ramadan appeal or an embed:

```tsx
import { Checkout, type CheckoutCampaign } from "@/features/checkout";

const ramadan: CheckoutCampaign = {
  id: "ramadan-2027", title: "Feed a family this Ramadan", charity: "…", beneficiary: "families in Gaza",
  raised: 12000, goal: 50000, currency: "GBP", presets: [10, 25, 50, 100], giftAid: true,
  impact: [[50, "a food parcel for a family of five"], [0, "part of a food parcel"]],
};
<Checkout campaign={ramadan} onPay={async (order) => { /* Stripe: throw an Error(message) if it fails */ }} />
```

- **Layouts:** `hero` (Hero stage), `pledge` (Pledge sentence), `ticket` (Gift ticket). Each one has an amount step, a boost step (Gift Aid and extras), a details step, a payment step and a thank-you screen, and they all share the payment animation.
- **Choosing a layout:** the `checkout_layout` flag (`src/shared/lib/flags.ts`):
  - `?checkout_layout=pledge` sets it in your browser and keeps it there. `?checkout_layout=` clears it.
  - Setting `VITE_FF_CHECKOUT_LAYOUT=ticket` in Vercel makes it the default for everyone (redeploy to apply).
  - Passing `layout="hero"` to `<Checkout>` fixes the layout for that one use.
- **Routes:**
  - `/checkout` shows the sample campaign from the designs.
  - `/checkout?campaign=f/<slug>` shows a campaign made in `/create` and records the gift on it.
- **Theming:** override any `--ck-*` variable on `.ck` (see `checkout.css`).

## Flags

Both live in `src/shared/lib/flags.ts` and work the same way: `?name=value` on the address (remembered in the browser), or `VITE_FF_<NAME>` at build time.

| Flag | Values | What it does |
|---|---|---|
| `checkout_layout` | `hero` (default), `pledge`, `ticket` | Which layout is shown. |
| `checkout_presets` | `smart` (default), `control`, `ask-up` | Which amounts are offered (`presets.ts`). `control` is the campaign's own list with the second one selected. `smart` scales the list for a monthly gift. `ask-up` is `smart` with the next amount up selected. Every event carries the value as `preset_variant`. |

## Payment

One state machine runs every payment (`payments.ts`): idle → pending → authorised → **succeeded** (the thank-you), or → **processing** for Direct Debit and pay by bank, which end on an "on its way" screen and are never called paid. A failure returns to the payment step with the reason, a **Try again** button when the same attempt can be retried, and a pointer to the other ways to pay when it can't. Each attempt has a key, so a double click, a retry or a reload never charges twice.

Which provider runs depends on what `<Checkout>` is given:

| Prop | Provider | Used by |
|---|---|---|
| none | `demoPayments()`: simulated. Stripe's test cards pick the outcome (`4000 0000 0000 0002` is declined). | `/checkout` sample |
| `payments` | any `PaymentProvider` | `/checkout?campaign=…` uses `demoPayments({ record })` to record the gift |
| `onPay` | your handler, wrapped by `hostPayments`. Resolve when paid, throw an `Error` with words for the donor. It gets an `Order` with no card data. | library users |
| `live` | `livePayments`: Stripe and PayPal through the `pay` edge function, with Stripe's own fields (`StripeFields.tsx`) in place of our card, Direct Debit and bank forms. | `/o/<org>/checkout` |

`live` is only used on a real backend (`VITE_SUPABASE_URL` set) with `VITE_STRIPE_PUBLISHABLE_KEY` set and an organisation with Stripe connected. **Without all three the payment is simulated**, so set the key before sending donors to an organisation's checkout.

After a redirect (PayPal, a bank's page) the checkout reads `?ck_pay=<id>` on the way back, asks the server how the payment ended and shows the thank-you, the pending screen or "not completed" from that answer.

### Go-live checklist

1. Run the migrations `20261121000000_checkout_payments.sql`, `20261121000100_payment_attempts.sql` and `20261121000200_donor_self_service.sql`.
2. Deploy the `pay` function (`supabase functions deploy pay`). It needs `STRIPE_SECRET_KEY`, and `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` for PayPal.
3. Set `VITE_STRIPE_PUBLISHABLE_KEY` in Vercel and redeploy.
4. Add `payment_intent.succeeded` and `payment_intent.payment_failed` to the Stripe webhook's events (`stripe-webhook` marks the gift paid and sends the receipt).
5. Ask Stripe for the `bacs_debit_payments` and `pay_by_bank_payments` capabilities on each connected account that offers Direct Debit or pay by bank.
6. Register the site's domain with Stripe for Apple Pay and Google Pay. Live, the wallets appear inside Stripe's card fields; our own wallet buttons are demo only.

**Not done yet:**
- Pausing or cancelling a regular gift writes to `recurring_changes` but does not yet change the Stripe subscription. Sync it before telling donors they can manage a live gift.
- The live `pay` request carries no Gift Aid declaration (postcode, address), so a live Gift Aid claim is not stored.
- PayPal has no webhook, so PayPal gifts get no emailed receipt.
- A one-tap wallet button for live payments needs Stripe's Express Checkout Element.

## What the donor is shown

- **Money:** every line of today's payment comes from `quote().today`. On a regular gift each line is tagged as repeating or "today only", and a "Then £X every month, next on …" block comes from `quote().later`. Gift Aid is worked out per line, so a covered card fee never attracts it.
- **Match:** counted only for a confirmed, in-date pledge with money left (`matchFor`). The sponsor is named unless the name is a `[placeholder]`, and a capped, ended or used-up match is explained.
- **Trust:** the "Verified" badge and the trust panel (legal name, registration and regulator, fund, tax-receipt wording) appear only for an organisation with `trust.verified` and a `verifiedAt` date, and each claim only when it is filled in (`trustClaims`). The sample's trust details are placeholders, so it shows none.
- **Fast path:** the Apple Pay shortcut on the amount step goes straight to payment, skipping the boost and details steps. If the campaign has Gift Aid, a yes/no is asked there, with the home address only for a yes.
- **Monthly nudge:** a one-off gift of £20 or more gets a small inline "Give £X a month instead?" card on the boost step. "Keep it one-off" is remembered for the session.
- **Next step:** the thank-you screen offers one thing, chosen by `nextAction()`: a monthly gift, a related-cause add-on (`addOn` prop), one verified campaign (`recommended` prop), sharing, or a fundraiser. The add-on is a separate payment behind its own confirm button. "No thanks" closes the ask and is remembered for the session.
- **Unfinished gifts:** the gift so far (never card, bank or address details) is kept in the browser for 7 days and restored on the next visit. If the donor ticks "Email me a link to finish this gift", it is also saved with `checkout_recovery_save`, and `?resume=<id>` reopens it from any browser. Sending that email is not built yet: it needs a scheduled job that reads `checkout_recoveries`.

## Analytics (Umami: open source, free, cookieless)

Every step sends an event through `track()`. Each event carries `layout`, `campaign`, `amount`, `freq` and `preset_variant`, plus `method` from the payment step on, and nothing that identifies a person.

| Event | When |
|---|---|
| `checkout_view` | the checkout opens |
| `checkout_resumed` | an unfinished gift is restored (`source`: browser, link or server) |
| `checkout_step_boost`, `_details`, `_pay` | a step opens (`dir` is forward or back) |
| `checkout_amount` | the amount is confirmed (`source`: default, preset, dial, typed, pill, nudge, upsell or resumed) |
| `checkout_freq`, `checkout_giftaid`, `checkout_extra`, `checkout_fund`, `checkout_method` | a choice changes |
| `checkout_invalid` | a step is blocked (`field`) |
| `checkout_express` | the Apple Pay shortcut is used (`from`: the step it was pressed on) |
| `checkout_nudge_shown`, `_accepted`, `_declined`, `_undone` | the monthly nudge is seen, taken, turned down, or taken and changed back (`suggest`) |
| `checkout_pay_start` | a payment starts (`method`, `total`, `giftaid`, `extras`) |
| `checkout_paid` | the server confirmed the payment |
| `checkout_pending` | a Direct Debit or bank payment is on its way. It is not counted as paid. |
| `checkout_pay_failed` | the payment failed (`reason`: card_declined, insufficient_funds, expired_card, authentication_required, network, not_configured or unknown) |
| `checkout_pay_unconfirmed` | the bank had not answered in time; the donor is asked to check again, not pay again |
| `checkout_next_shown`, `_accepted`, `_declined` | the thank-you screen's next step (`kind`: monthly, addon, campaign, share or fundraiser) |
| `checkout_addon_pay_start`, `_paid`, `_pending`, `_failed` | the add-on's own payment (`id`, `total`) |
| `checkout_abandon` | the donor leaves before paying (`step`) |
| `checkout_upsell_monthly`, `checkout_restart` | a new gift is started from the thank-you screen |

**Setup:**
1. Create a site in Umami Cloud (free tier) or a self-hosted Umami (MIT licence).
2. Put its id in `ANALYTICS.websiteId` in `src/shared/lib/seo.ts`.
3. In Umami, go to Reports → Funnel and add these steps: `checkout_view` → `checkout_step_boost` → `checkout_step_details` → `checkout_step_pay` → `checkout_pay_start` → `checkout_paid`. Wallet donors skip the boost and details steps, so for them use `checkout_view` → `checkout_express` → `checkout_pay_start` → `checkout_paid`. Count `checkout_pending` beside `checkout_paid` when Direct Debit is on.
4. Filter by `layout` to compare the three designs, and by `preset_variant` to compare the amount experiments.
5. For the asks, compare `_shown` with `_accepted`: `checkout_nudge_*` for the monthly nudge and `checkout_next_*` by `kind` for the thank-you screen.

In dev, or with `?debug` on the address, an **events** pill in the corner lists every event as it's sent and lets you switch layouts.
