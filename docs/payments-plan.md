# Online payments (M8): build plan

A plan for adding deposit and full online payment, written before the provider
is chosen. It assumes **Stripe Connect** (the recommendation of the provider
research, November 2026); the provider-specific parts are marked, and
everything else stays the same with Everypay or Viva behind the
`PaymentProvider` seam (SPEC §6.3). Nothing here is built yet.

## 1. Decide first

| Question | Default in this plan | Who decides |
|---|---|---|
| Provider | Stripe Connect, Express accounts | Owner, after a quote from Everypay |
| Who is the seller on the card statement | The camping (destination charges `on_behalf_of` the camping) | Owner + accountant |
| Who pays the card fee | The camping, out of its share | Owner |
| Commission on a cancellation | Refunded in the same proportion as the guest's refund (SPEC §4.4: earned only on the part the camping keeps) | Owner |
| Hold while paying | 30 minutes (Stripe Checkout sessions last at least 30 minutes; SPEC says 15, to change) | — |
| IRIS | Not in the first version (Stripe has none) | Accountant |

Prerequisites: the business is registered, a Stripe account exists (test mode
is enough to build), and the accountant has answered the questions in the
research document.

## 2. What exists today

- `bookings` already has `payment_mode`, `due_online_cents`, `paid_cents`,
  `refunded_cents` and `hold_expires_at`; the status `held` exists, with
  `held → confirmed | expired | cancelled` allowed by `transition_booking`, and
  the expiry job already expires `held` bookings past `hold_expires_at`.
- `partners.payout_account_ref` exists (empty).
- `campings.payment_mode` exists with the constraint
  `campings_on_site_payment_until_m7` keeping it `on_site`.
- The `PaymentProvider` interface is only in the SPEC; there is no payments
  code, no `payments` table and no webhook.

## 3. Money rules

All in integer cents, computed on the server only.

- `due_online` = full total (`full`) or `round_half_up(total × deposit_percent / 100)` (`deposit`, 20–100%).
- `platform_fee` = the booking's `commission_cents`, never more than `due_online` (a 20% deposit always covers a 6% commission).
- Guest cancellation: refund = `paid × preset share` (100%, 50% or 0% by
  `days_before`, SPEC F6). The platform fee is refunded in the same share.
- Camping cancellation, decline, expiry: full refund (or void), whole fee back.
- No-show: nothing refunded; the fee is kept.

Example: a €200 stay, 30% deposit, 6% commission. €60 is charged online, of
which €12 is Antiskino's fee and €48 goes to the camping (less the card fee).
The guest cancels 3 days before arrival on a moderate policy: 50% back, so the
guest gets €30, Antiskino keeps €6, the camping keeps €24, and the remaining
€140 was never charged.

## 4. Flows

**Instant camping, online payment**
1. `create-booking` reserves the nights with status `held`
   (`hold_expires_at` = now + 30 min), creates the provider checkout for
   `due_online` with `platform_fee`, stores a `payments` row (`pending`) and
   returns `checkoutUrl`.
2. The app opens the checkout (web: same tab; phones: the system browser) and
   comes back to `/m?ref=…&t=…` (web) or `antiskino://m?…` (apps).
3. The webhook `checkout.session.completed` / `payment_intent.succeeded` marks
   the payment `succeeded`, sets `paid_cents` and calls
   `transition_booking(held → confirmed)`. Emails go out as today.
4. No payment by `hold_expires_at`: the expiry job moves `held → expired` and
   releases the nights. A payment that arrives after that is refunded in full
   automatically.

**Request camping**: as above, but the checkout only **authorizes**
(`capture_method=manual`) and the booking goes to `requested` once authorized.
Accept captures; decline or expiry voids. Stripe keeps an online authorization
about 7 days, far more than the 48-hour maximum answer time.

**Cancellations**: `transition_booking` computes the refund and the fee share
and enqueues a refund action; the worker calls the provider; the webhook
confirms and sets `refunded_cents`. Emails already show the policy; they gain
the refunded amount.

**Camping onboarding**: an owner taps *Set up payouts* (Profile → Payment);
`partner-onboarding` creates the connected account (once) and returns Stripe's
hosted onboarding link; the `account.updated` webhook stores
`charges_enabled` / `payouts_enabled`. Online payment modes can be chosen only
when both are true.

## 5. Database (new migrations)

- Drop `campings_on_site_payment_until_m7`; keep `deposit_percent` between 20
  and 100; refuse `deposit` / `full` unless the partner's payouts are enabled
  (in `update_camping_profile`, with a pgTAP test).
- `partners`: `charges_enabled`, `payouts_enabled`, `payouts_updated_at`.
- `payments(id, booking_id, provider, provider_ref, kind
  'authorization'|'capture'|'refund', amount_cents, platform_fee_cents, status
  'pending'|'succeeded'|'failed'|'canceled', raw jsonb, created_at)` as in SPEC
  §6.1. RLS: the booking's partner members and admins read; nobody writes
  except the service role.
- `payment_actions` (outbox): `booking_id, kind 'capture'|'void'|'refund',
  amount_cents, fee_cents, status, attempts, next_attempt_at,
  idempotency_key`. Written only by `transition_booking`, in the same
  transaction as the status change, so a status never changes without its
  money action.
- `reserve_and_create_booking`: online modes create `held` (instant) or a
  pre-request `held` that becomes `requested` on authorization; `due_online`
  and the fee are snapshotted.
- `transition_booking`: enqueue capture (accept), void (decline/expiry of an
  authorized request), refund (cancellations of paid bookings).
- `payment_webhook_events(provider_event_id unique)`: so a replayed webhook
  does nothing.

Every change to these paths gets pgTAP tests, including the concurrency test
(two payments for the last pitch: the second checkout is never created).

## 6. Edge functions

- `_shared/payments/provider.ts`: the interface from SPEC §6.3 plus
  `createRefund(…, feeShare)` and `getPartnerStatus`.
- `_shared/payments/stripe.ts` *(provider-specific)*: plain `fetch` calls to
  Stripe's REST API with idempotency keys (no SDK, so no new library), and
  webhook signature checking (HMAC-SHA256 of the raw body).
- `_shared/payments/fake.ts`: an in-memory provider for Deno tests and the
  local stack (`PAYMENT_PROVIDER=fake`), with a tiny fake checkout page that
  "pays" on a click, so Playwright can test the whole flow in CI.
- `create-booking`: returns `checkoutUrl` for online modes.
- `payments-webhook` (`verify_jwt = false`, signature required): normalizes
  events, stores them once, updates `payments`, calls `transition_booking`.
- `payments-worker`: runs `payment_actions` (pg_cron + pg_net every minute,
  like `notify`, with the same shared-secret pattern), retrying with backoff;
  the fifth failure alerts the admin.
- `partner-onboarding`: account creation, onboarding link, status refresh.

Secrets: `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
(test keys on dev, live keys on production). The webhook host and the checkout
host (`checkout.stripe.com`) need no change to the website's
Content-Security-Policy: the browser navigates there, it doesn't fetch.

## 7. App

- **Profile → Payment**: *Set up payouts* (owners), status, then the payment
  mode and deposit % (today disabled).
- **Booking flow**: the review step already shows the payment terms; *Book*
  becomes *Pay €X now* for online modes and opens the checkout; the return
  screen polls the booking until the webhook has confirmed it ("Payment
  received", "Payment didn't go through, try again" while the hold lasts).
- **Booking pages** (guest, partner, admin): paid, refunded and the fee.
- **Emails**: amounts paid and refunded; a payment receipt from Stripe.
- **Commission statements**: online bookings' commission was already taken,
  so the statement lists it as collected and the amount due drops to the
  on-site bookings.
- Possible new libraries (ask first, SPEC §5): `expo-web-browser` for a
  smoother checkout on phones (otherwise `Linking.openURL`).

## 8. Tests

- Deno: money rules (deposit, fee, refund shares for every preset and day),
  Stripe request building, webhook signature checks, event normalization,
  idempotency.
- pgTAP: `held` flow, outbox rows for each transition, RLS on `payments`,
  refusing online modes without payouts, late payment after expiry, the
  concurrency test.
- Playwright (CI, fake provider): pay a deposit, confirm, cancel with a 50%
  refund; a request authorized then declined.
- Manual, on the dev project in Stripe test mode: test cards (success, 3-D
  Secure, decline), a real webhook, onboarding a test camping.

## 9. Work order (one PR each)

1. Database: `payments`, `payment_actions`, webhook events table, `held` and
   outbox in the SQL functions, constraints; pgTAP.
2. Provider seam: interface, fake and Stripe clients, money rules; Deno tests.
3. `payments-webhook` and `payments-worker`, cron job; tests.
4. Camping onboarding: function, Profile → Payment screen.
5. Guest checkout: `create-booking`, review step, return screen; Playwright
   with the fake provider.
6. Cancellations and refunds end to end; emails.
7. Commission statements, admin and partner booking pages; legal texts
   (payments section in the terms, Stripe in the privacy policy, Play Data
   safety: purchase history).
8. Pilot: one camping on deposit mode on the dev project, then production keys.

SPEC changes to make in step 1: hold 30 minutes (§4.3), the outbox and webhook
tables (§6.1), and the decisions in section 1 above (§0).
