# Antiskino — SPEC

> Book a camping pitch in Greece in under a minute. (*αντίσκηνο* = tent)

Last updated: 2026-11-17 · Status: M1 done, M2 built (awaiting the owner's check), M3 built and awaiting the owner's check (search and quote functions, Home search, results list and map, camping page)

## 0. Decisions log

| Area | Decision | Notes |
|---|---|---|
| Product shape | Marketplace + a direct link per camping | `/c/<slug>` is shareable on the camping's own site/socials. If only one camping is live, Home opens it directly |
| Partners | A partner is a **company**; it can own one or more campings | Members belong to the partner and see all its campings |
| Bookables | **Pitches only** (tent / caravan / camper) | No bungalows or rentals in v1 |
| Spot assignment | Customer books a **pitch type**; reception assigns the pitch number | `assigned_pitch` free text on the booking |
| Confirmation | **Per camping**: instant or request-to-book | Requests expire after N hours (default 24) |
| Payment | **Per camping**: on site / deposit online / full online | Only "on site" until the provider is integrated (M7) |
| Revenue | Commission per booking | Platform default, override per partner |
| Payment provider | **Decide later** | Behind a `PaymentProvider` interface. Candidates: Stripe Connect, Viva.com |
| Pricing | Itemized: pitch + per guest (age categories) + extras, by season | Optional fixed fees for local charges |
| Customer accounts | Guest checkout; optional sign-in with an email code | Bookings are linked by email |
| Partner UI | Same app, `/partner` area, role-gated | Web for the office, phone for reception |
| Languages | Greek + English, i18n from day one | More languages later = new locale file |
| Cancellation | Presets: Flexible / Moderate / Strict | Snapshot stored on each booking |
| Frontend | Expo universal app (iOS, Android, web), Expo Router, static web | |
| Backend | Supabase | Postgres + RLS, Auth, Storage, Edge Functions, Realtime, pg_cron |
| Partner onboarding | Invite-only by the platform admin | |
| Inventory | **Online allotment** per pitch type per night | The camping keeps the rest for phone/walk-ins/other sites |
| Search | Dates + guests + equipment; list with map toggle | No other filters |
| v1 extras | Push notifications, reviews after stay, favorites | No partner reports in v1 |
| Partner staff | Owner + staff roles | |
| Name | **Antiskino** | |
| Migrations deploy | **Supabase GitHub integration** applies `supabase/migrations` to the dev project on push to `main` ("Deploy to production") | CI never runs `db push` for dev; it applies migrations to a local stack and runs pgTAP. Prod: manual `workflow_dispatch` (M8) |
| Supabase CLI | v3, pinned in CI | `gen types` and `test db` target the local stack by default. Types: `npm run db:types` (public schema, Prettier-formatted); CI fails when stale |
| UI language | Held in React state (`LanguageProvider`, `useT()`) | Static web HTML is Greek and switches to the browser language after hydration; changes run in a transition to avoid hydration mismatches |
| DB grants | Explicit per table/function | Supabase projects differ in default privileges, so migrations revoke from `anon`/`authenticated` and grant only what is needed |
| Camping status | Only admins change it, via `set_camping_status()` | Owners update profile columns only (not partner, slug or status). New campings start as `draft` |
| Payment mode in DB | A check constraint keeps `payment_mode = 'on_site'` until M7 | Drop the constraint when online payments ship |
| Camping defaults | `confirmation_mode` instant, `cancellation_policy` flexible, `request_expiry_hours` 24 | Changed per camping in the profile |
| Catalog integrity | Seasons of a camping and guest-category age ranges cannot overlap; a price must point at an item of the season's camping | Deleting a pitch type, guest category or extra deletes its prices |
| Sign-in timing | Email-code sign-in and the partner/admin gates move to **M2** | Partners and admins need them to use M2's screens. Claiming guest bookings and My bookings stay in M4 |
| Sign-in email | One bilingual (EL + EN) code template for both new and returning users | Hosted projects need **custom SMTP** before templates can be edited (default emails carry a link, not the code). Dev: Resend SMTP; then paste the template into Confirm signup and Magic link |
| Native session storage | `@react-native-async-storage/async-storage` | Web keeps using localStorage. Reusable for guest favorites (Zustand) |
| Photo uploads | `expo-image-picker` → Supabase Storage | Camping and pitch-type photos (M2) |
| Partner invites | **Copy-link invites** until a Resend sender domain is verified | The admin shares the invite link (Share sheet); email via Resend is added later |
| Invite mechanics | SQL functions `create_partner_invite()` / `accept_partner_invite()` | 7-day one-time token, only its SHA-256 stored; a new invite replaces the pending one for that email. Admins invite to any partner, owners to their own. Accepting needs a sign-in with the invited email and never demotes an owner. The `invite` edge function arrives only with invite emails |
| Partner area navigation | Sidebar ≥ 768 px wide, bottom tabs below; `/partner` opens Profile until Today ships (M5) | Short tab labels on phones (Availability → "Calendar" / "Ημερολόγιο"); a camping switcher appears with more than one camping |
| Amenities | Fixed list of 14 keys in `src/domain/amenities.ts` | The 11 from F2 plus bar, shared kitchen and barbecue area; labels in the locale files |
| Map pin (M2) | Typed or pasted as "latitude, longitude" | A map picker comes with maps in M3 |
| Photo storage | One public `photos` bucket; files under `<camping_id>/`; JPEG, PNG or WebP up to 5 MB | Owners and admins write (`can_manage_camping_files()` storage policies). `camping_photos` rows keep the gallery order (first = cover); pitch type photos are paths in `pitch_types.photos`. Files of deleted campings or pitch types are not cleaned up yet |
| Pitch type removal | Hidden (`active = false`), not deleted, in the partner UI | Keeps history once bookings reference pitch types (M4) |
| URLs with ids on web | Private screens take ids as query parameters (`/admin/partner?id=`, `/invite?t=`) | Static hosting can't pre-render unknown ids. Dynamic segments only for pages pre-rendered with `generateStaticParams` (e.g. `/c/[slug]`). Decide `/m/<ref>` in M4 |
| Allotment edits | `set_allotment` / `set_closed` take a night range with both ends included, at most 400 nights per call | `set_allotment` refuses (does not clamp) a value below `booked`, changing nothing; `set_closed` skips nights without inventory |
| Rates editing (M2) | Seasons are entered as first and last night (DD/MM/YYYY) and stored as `[first, last + 1)`; prices are typed in euros (`12`, `12,50`) and stored as cents | A season's price grid is saved in one call, `set_season_prices()` (owners and admins, all or nothing). An empty price field means "not set" for that season; how search and quotes treat items without a price is decided in M3 |
| Deleting rates items | Seasons, guest categories, extras and fees are deleted (with an inline "Delete for good?" confirm), not hidden | Deleting a season or item also deletes its prices. Extras can instead be hidden from guests (`active = false`). Revisit once bookings reference them (M4 snapshots keep booked prices) |
| Availability screen (M2) | Grid of pitch types × 14 nights from today (Athens), moved two weeks at a time; each cell shows `booked/allotment`, "—" without inventory; full and closed nights are coloured | Tapping a night fills in both forms. Allotment: one pitch type and night range per `set_allotment()` call (owners). Close/open: one or more pitch types, one `set_closed()` call each, not atomic across pitch types (whole team). Ranges over 400 nights are refused in the form |
| Guests in search (M3) | The party is **adults + each child's age** (0–17) | Each camping defines its own age categories, so each person is matched to the category covering their age (adults count as 18). A party with an age no category covers can't be priced at that camping. The booking step shows the camping's categories, pre-filled |
| Missing prices (M3) | A price the stay needs but the season lacks makes it **not sellable** | Missing pitch or guest price: the pitch type is unavailable for those dates. Missing extra price: the extra isn't offered. Partners type 0 for free |
| Search & quote functions (M3) | `sellable_pitch_types()` (SQL, security definer, callable by anon, returns ids only) applies §4.1; the edge functions price with `_shared/pricing.ts` | They read with the caller's public API key, so RLS limits them to live campings; no secret key needed. JWT verification is off for both (publishable keys aren't JWTs). Results are cheapest first. Arrival today only before the camping's same-day cutoff; at most 30 nights |
| Icons | `@expo/vector-icons` (Material Community Icons) | Equipment and amenity icons |
| Explore tab (M3) | A stack inside the tab: Home → results → camping page | expo-router redirects navigation to a tab hidden with `href: null`, so screens opened from Home live in the tab's own stack. The results URL carries the whole search (`/search?arrival=…&children=4,7…`), so it can be shared and reloaded |
| Static web and the browser | Output that differs between the build and the browser (icon fonts, URL parameters, today's date) renders after hydration (`useHydrated()`) | Avoids React hydration errors on GitHub Pages |
| Camping page (M3) | `/c/<slug>` carries the stay in its URL like the results (`?arrival=…`); without dates each pitch type shows "Pitch from €X / night", the lowest stored pitch rate of the seasons not yet over (display only; totals always come from `search`) | Book stays disabled until M4. A region filter from the results is dropped on the camping's own page. Single-camping mode: Home shows the page, and its search opens `/c/<slug>?…` |
| Pre-rendered camping pages | `generateStaticParams` loads the live campings at build time (`src/api/staticCampings.ts`); the page's `<title>`, description and og tags are plain React DOM tags, which React hoists into `<head>` in the static export | `expo-router/head` only applies in the browser in SDK 58, so link previews need the static tags. A camping that goes live after a deploy still opens (GitHub Pages serves 404.html and the app renders it) but has no link preview until the next deploy: re-run CI on `main` (Actions → CI → Run workflow). The automatic rebuild of §5 needs a GitHub token for Supabase and comes later |
| Maps (M3) | One `PinsMap` component: `react-native-maps` on native, Leaflet + OpenStreetMap tiles on web, loaded only in the browser after hydration (Leaflet needs `window`) | Results: a List / Map toggle with a price pin per camping (tap or Tab + Enter opens it); campings without coordinates are counted under the map. Camping page: a small map in Location. Leaflet's map-level keyboard handler is off: it focused the map on tap, the page scrolled and the tap was lost. OSM's public tiles are fine for previews; pick a tile provider before launch (M8). **Android builds need a Google Maps API key** (M6, with EAS); Expo Go works without |

## 1. Core problem

Booking a camping pitch in Greece usually means phoning or emailing the reception, or using big platforms built around hotels. Campings juggle phone calls, emails and walk-ins in a notebook or spreadsheet.

**Antiskino's job:** a camper picks dates, people and what they're bringing (tent, caravan or camper) and gets a confirmed or requested pitch in under a minute, with a clear itemized price. The camping gets the booking in a simple dashboard on the office PC or the reception phone.

It is deliberately small: only partner campings (possibly just one at launch), no heavy filters and none of the hotel-style complexity.

**Users**
- **Camper** (customer): books, and may never create an account.
- **Partner owner**: runs the camping company. Sets prices, availability, policies and the team.
- **Partner staff**: reception. Handles arrivals, assigns pitches, checks guests in.
- **Platform admin** (the founder): invites partners, sets commission, moderates reviews.

## 2. MVP features

### F1. Search & discovery
- Home shows a search bar with **Dates** (arrival → departure), **Guests** (by age category) and **Equipment** (Tent · Caravan · Camper). An optional **Region** dropdown appears only when live campings span more than one region.
- Results: campings that have at least one pitch type available for the whole stay. Each shows a photo, name, place, rating and "from €X total". A **List / Map** toggle switches views.
- **Single-camping mode:** if exactly one camping is live, Home shows that camping's page with the search fields on top. This is automatic, with no setting.
- No other filters or sorting in v1. Zero results shows "No availability for these dates — try other dates".

### F2. Camping page (`/c/[slug]`)
- Gallery, name, short and long description (EL/EN), amenity icons from a fixed list (hot showers, electricity, Wi-Fi, beach access, pool, restaurant, mini-market, laundry, pets allowed, playground, shade, …), map pin and address with a **Directions** button (opens the maps app), check-in/out times, house rules, policies in plain words (confirmation mode, payment, cancellation) and reviews.
- **Pitch types** for the selected dates: name, accepted equipment icons, max people, size, what's included, total price for the stay (or "from €X/night" without dates) and a **Book** button. Unavailable types are greyed out.
- On web the page is pre-rendered with title, description and og:image so shared links preview well.

### F3. Booking flow (3 steps)
1. **Stay:** pitch type (pre-selected), dates, guests per category, extras (car, motorbike, pet, extra tent, electricity if not included…). Live price breakdown with per-night lines, extras, fees and total.
2. **Your details:** full name, email, phone with country code, country, language (pre-filled), vehicle plate (optional), estimated arrival time (optional), note to the camping.
3. **Review:** summary, price breakdown, payment terms ("Pay at reception" / "Pay €X deposit now, €Y at reception" / "Pay €X now"), cancellation policy in plain words, accept-terms checkbox, then **Book** (instant mode) or **Send request** (request mode).
- Result screen: **Confirmed** with a reference like `ANT-7K3P9Q`, or **Request sent**, "the camping will answer within N hours".
- One booking = one pitch. Groups needing more pitches make more bookings (v1).
- Limits: arrival can be today until the camping's same-day cutoff (default 14:00). Max 30 nights per booking.

### F4. Confirmation modes (per camping)
- **Instant:** the booking is `confirmed` as soon as it is created (and paid, when online payment exists).
- **Request:** the booking is `requested` and holds inventory. The partner **Accepts** or **Declines** within `request_expiry_hours` (default 24, range 2–48). With no answer it becomes `expired`, inventory is released and the guest is emailed. Guests can withdraw a request for free at any time.
- With online payment (M7), request mode **authorizes** the card on request and **captures** it on accept. Decline or expiry voids the authorization.

### F5. Payment modes (per camping)
- **On site:** nothing is charged online and the guest pays at reception. This is the **only mode enabled until M7**.
- **Deposit online:** `deposit_percent` (20–100%) is charged at booking and the balance is paid at reception.
- **Full online:** the whole amount is charged at booking.
- All amounts are EUR in integer cents, and prices include VAT. Intended setup: the camping is the seller of the stay and issues the receipt; Antiskino invoices its commission to the partner (to be confirmed, see §10).

### F6. Cancellations
Each camping picks one preset. The preset is snapshotted on every booking. `days_before` = arrival date minus cancellation date, in Europe/Athens calendar days.

| Preset | 100% refund | 50% refund | No refund |
|---|---|---|---|
| Flexible | `days_before ≥ 1` | — | arrival day / no-show |
| Moderate | `≥ 7` | `1–6` | arrival day / no-show |
| Strict | `≥ 30` | `7–29` | `< 7` / no-show |

- Refunds apply to the amount paid online. In on-site mode nothing was charged, so the guest's cancellation is free. The policy text still shows, and the camping handles no-shows as it does today.
- The guest cancels from **My bookings** or the manage link (F7).
- The partner can cancel any booking (reason required). The guest always gets a full refund of anything paid.
- No modifications in v1: to change dates, cancel and rebook (the app shows this hint). Partners can edit only `assigned_pitch` and internal notes.

### F7. Guest checkout & accounts
- No sign-in is needed to book. The booking stores the guest's email.
- Each booking gets a **manage link** `/m/[ref]?t=<token>`. The token is 32 random bytes and only its SHA-256 hash is stored. It lets the holder view, cancel and review that one booking, and it is sent in every booking email.
- **Sign-in** is by email one-time code (Supabase Auth OTP). There are no passwords and no social login in v1, which also avoids the Sign in with Apple requirement on iOS.
- On sign-in, every booking with that verified email is attached to the user (`claim_bookings()`).
- Signed-in users get a My bookings list, prefilled details, favorites sync and push notifications.

### F8. Favorites
- A heart on camping cards and pages. Guests' favorites are stored on the device; signed-in users' favorites go in the `favorites` table, and local ones are merged on sign-in. A Favorites tab lists them.

### F9. Reviews
- The day after departure the booking becomes `completed`, and the guest gets an email (and a push if signed in) inviting a review.
- Only completed bookings can be reviewed (verified stays), one review per booking. Rating 1–5 plus optional text (≤ 1000 chars, any language). Shown with first name, country and month of stay.
- The partner can post one public reply per review. The admin can hide a review (with a reason).
- The camping rating is the average of visible reviews, shown once there are ≥ 3.

### F10. Notifications
Emails go through Resend, in the booking's language (EL/EN). Push goes through Expo Push to signed-in users with a registered device.

| Event | Guest | Partner members |
|---|---|---|
| Booking confirmed (instant / accepted) | email + push | email + push |
| Request received | email | email + push (with deadline) |
| Request expiring in 2 h | — | push |
| Request declined / expired | email + push | — |
| Cancelled (by guest / partner) | email + push (refund info) | email + push |
| Arrival in 2 days (directions, check-in time) | email + push | — |
| Review invite | email + push | — |
| New review | — | push |

Partner members can mute email per event type in their profile. Push is the main channel at reception.

### F11. Partner area (`/partner`)
Responsive: sidebar on wide screens, bottom tabs on phones (must work at 360 px wide). A camping switcher appears when the partner has more than one camping.

| Screen | Content | Who |
|---|---|---|
| **Today** | Arrivals (with assigned pitch or an "unassigned" warning), departures, in-house count, pending requests with countdown. Realtime | owner, staff |
| **Bookings** | List with date range, status filter, search by name/ref. Detail: guest, party, extras, price breakdown, payment status, timeline. Actions: Accept/Decline, assign pitch, Check in, Mark no-show, Cancel, internal note | owner, staff |
| **Availability** | Grid of pitch types × nights showing `booked / allotment`. Set allotment for a date range (never below `booked`). Close/open nights (stop-sell) | allotment: owner · close/open: owner, staff |
| **Rates** | Seasons (date ranges, min nights), pitch type prices, guest categories (e.g. Adult 12+, Child 4–11, Infant 0–3) with prices, extras (per night / per stay) with prices, fixed fees | owner |
| **Pitch types** | Name EL/EN, accepted equipment, max people, size m², included items, photos, active, sort order | owner |
| **Camping profile** | Texts EL/EN, photos, amenities, map pin, check-in/out times, same-day cutoff, house rules, confirmation mode (+ expiry hours), payment mode (+ deposit %; online modes disabled until M7), cancellation preset | owner |
| **Team** | Invite by email, role owner/staff, remove | owner |
| **Reviews** | List, reply | owner, staff |

### F12. Platform admin (`/admin`)
- **Partners & campings:** create partner + camping (draft), invite the owner by email, set the commission override, publish (live) or pause a camping.
- **Bookings:** read-only list across all partners.
- **Reviews:** hide/unhide with a reason.
- **Commission:** monthly statement per partner, CSV export.
- Everything else is done in the Supabase dashboard in v1.

## 3. Out of scope (v1)
- Bungalows, mobile homes, glamping or any rentals. The data model leaves room: `pitch_types.unit_category` defaults to `'pitch'`.
- Choosing a specific pitch and site maps.
- Several pitches in one booking.
- Changing dates or guests on a booking (cancel and rebook).
- Online payments until M7 (the interface exists, not the implementation).
- Partner reports or analytics beyond the Today screen and the commission statement.
- Channel manager / PMS / iCal sync with other sites. The allotment model covers coexistence.
- Self-signup for partners.
- Passwords and social login.
- In-app chat between guest and camping (note field, email and phone only).
- Discount codes, dynamic pricing, last-minute deals.
- Languages beyond EL/EN.
- Amenity filters and sort options.

## 4. Business rules

### 4.1 Availability (online allotment)
- Per pitch type and night, the partner sets how many pitches Antiskino may sell (`allotment`). The camping keeps the rest for phone, walk-ins and other sites, and closes nights when it is full.
- A stay covers the nights from arrival (inclusive) to departure (exclusive). It is **sellable** when **every** night has an `inventory_nights` row that is not closed and has `booked < allotment`, and is covered by a season, **and** the stay length ≥ the arrival night's season `min_nights`, **and** the party size ≤ `max_people` (infants count), **and** the pitch type accepts the requested equipment.
- **Atomic reservation**, inside one Postgres function:
  ```sql
  UPDATE inventory_nights SET booked = booked + 1
  WHERE pitch_type_id = $1 AND night >= $arrival AND night < $departure
    AND NOT closed AND booked < allotment;
  -- if row_count <> nights → RAISE (whole transaction rolls back)
  ```
  The constraint `CHECK (booked <= allotment)` is the last line of defence.
- Release (cancel / decline / expire) decrements the same rows.

### 4.2 Pricing
Computed **only on the server** in `supabase/functions/_shared/pricing.ts` (pure, no I/O):
- For each night *n*, *S* = the season containing *n*.
- `night_total = pitch_price(S) + Σ guests[c] × guest_price(c, S) + Σ per_night_extras[e] × qty × extra_price(e, S) + per-night fees`
- `stay_total = Σ night_total + Σ per_stay_extras × qty × extra_price(e, S_arrival) + per-stay fees`
- Fees are camping-defined fixed amounts (`per_person_night`, `per_pitch_night`, `per_stay`) for any local charge.
- All inputs are integer cents. Rounding happens only for derived amounts: deposit = `round_half_up(total × deposit_percent / 100)`, commission = `round_half_up(total × commission_bps / 10000)`.
- The booking stores `total_cents`, a `price_breakdown` JSON snapshot and the policy, payment and commission snapshots. Later rate changes never touch existing bookings.

### 4.3 Booking lifecycle

```
             ┌─────────► declined
requested ───┼─────────► expired
             │
             ▼
held ──────► confirmed ──► checked_in ──► completed
  │            │  │                         ▲
  ▼            │  └─────────────────────────┘ (cron, day after departure)
expired        ├──► cancelled (guest / partner / admin)
               └──► no_show (partner, from arrival day)
```
- v1 (on-site payment): instant → `confirmed` directly; request → `requested`.
- `held` (15-minute hold while paying online) only appears from M7.
- `requested` can also become `cancelled` (guest withdraws).
- Every transition goes through the SQL function `transition_booking(id, to_status, actor, note)`. It validates from → to, adjusts inventory, writes `booking_events` and enqueues notifications in the same transaction.
- Reference: `ANT-` + 6 characters of Crockford base32 (no ambiguous characters).

### 4.4 Commission
- `platform_settings.default_commission_bps` (e.g. 600 = 6%), overridable per partner with `partners.commission_bps`. Snapshotted on the booking at creation.
- **Earned** when the booking becomes `completed`, or on cancellation for the part the camping keeps (online modes only). No commission on `no_show` in v1 (trust-based; watch for abuse).
- **On-site mode:** commission accrues, and a monthly statement per partner is paid by bank transfer.
- **Online modes (M7):** commission is taken automatically as the platform fee on the online charge. That is why the deposit is at least 20%.

### 4.5 Jobs (pg_cron, times in Europe/Athens; pg_cron runs in UTC, so convert)
- Every 5 min: expire `held` and `requested` bookings past their deadline. Send "request expiring in 2 h" pushes.
- Daily 03:00: `confirmed` / `checked_in` with departure < today → `completed`.
- Daily 10:00: arrival reminders (arrival = today + 2) and review invites (completed yesterday).
- `notification_queue` rows are sent by the `notify` edge function, triggered via pg_net on insert. Cron retries failures with backoff (max 5 attempts).

## 5. Tech stack

| Concern | Choice |
|---|---|
| App | Expo (latest SDK) + React Native, **TypeScript strict**; one codebase for iOS, Android and web |
| Navigation | Expo Router; web `output: "static"`; `/c/[slug]` pre-rendered via `generateStaticParams` |
| UI | Small in-house component kit in `src/ui` (no UI framework in v1) |
| Server state | TanStack Query over supabase-js |
| Local state | Zustand (search params, booking draft, guest favorites); AsyncStorage for native persistence (also the Supabase session) |
| Forms & validation | react-hook-form + zod (zod also validates edge function input) |
| i18n | i18next + react-i18next + expo-localization; `el.json`, `en.json`; DB texts as `jsonb {"el","en"}` |
| Dates | date-fns + small helpers in `src/lib/dates.ts`; nights as `YYYY-MM-DD` strings, Europe/Athens |
| Maps | `react-native-maps` on native (`*.native.tsx`), `react-leaflet` + OpenStreetMap tiles on web (`*.web.tsx`) |
| Photos | `expo-image-picker` for choosing photos; files in Supabase Storage |
| Icons | `@expo/vector-icons` (Material Community Icons) |
| Backend | Supabase: Postgres + RLS, Auth (email OTP), Storage (photos), Edge Functions (Deno/TS), Realtime (partner Today/Bookings), pg_cron + pg_net |
| Email | Resend, called from edge functions; EL/EN templates |
| Push | expo-notifications + Expo Push API from edge functions |
| Payments | `PaymentProvider` interface only, until M7 |
| Tests | Jest (jest-expo) + React Native Testing Library; `deno test` for `_shared` logic (pricing, cancellation, refs); pgTAP via `supabase test db` (inventory, transitions, RLS) |
| Lint/format | ESLint (expo config) + Prettier |
| CI | GitHub Actions: typecheck → lint → jest → deno test, `supabase start` + pgTAP + generated-types check → web export → deploy preview (from `main`). Migrations reach the dev project through the Supabase GitHub integration on push to `main`, not through CI |
| Hosting | Web: GitHub Pages for previews, Cloudflare Pages + custom domain for production. Mobile: EAS Build. DB: Supabase dev + prod projects |

**Phone-first workflow** (no laptop needed):
1. **Web preview** on every push to `main`: open it on the phone.
2. **Android preview APK / dev build** via EAS for native checks (push, maps). Push doesn't work in Expo Go.
3. **CI is the test runner.** DB logic is covered by pgTAP and pricing by deno tests, so most correctness is verified without a device.
4. **Migrations** are applied to the dev project by the Supabase GitHub integration when `main` is pushed (CI only tests them). Prod uses a manual `workflow_dispatch`.
5. A camping going live triggers a web rebuild (`repository_dispatch`) so its static `/c/<slug>` page exists. In the native app it's live immediately.

## 6. Architecture

```
app/
  _layout.tsx                  # providers: i18n, QueryClient, auth session, theme
  (customer)/
    _layout.tsx                # tabs: Explore · Favorites · Bookings · Account
    (explore)/                 # the Explore tab is a stack (back button on results and camping pages)
      index.tsx                # Home: search, or the single live camping
      search.tsx               # results: list / map (?arrival=&departure=&adults=&children=4,7&equipment=&region=)
      c/[slug]/index.tsx       # camping page (static on web)
      c/[slug]/book.tsx        # 3-step booking flow
    favorites.tsx
    bookings/index.tsx         # My bookings (signed in)
    bookings/[ref].tsx         # detail, cancel, review
    account.tsx                # sign in (email code), language, sign out
  m/[ref].tsx                  # guest manage link (token)
  partner/
    _layout.tsx                # partner-member gate, sidebar/tabs, camping switcher
    index.tsx                  # Today (M5); redirects to profile until then
    bookings/index.tsx
    bookings/[id].tsx
    availability.tsx
    rates.tsx
    pitch-types.tsx
    profile.tsx
    team.tsx
    reviews.tsx
  admin/
    _layout.tsx                # platform-admin gate
    index.tsx                  # partners & campings
    new-partner.tsx
    partner.tsx                # ?id=: commission, campings + status, team + invites
    bookings.tsx
    reviews.tsx
    commission.tsx
  invite.tsx                   # ?t=: accept partner invite
src/
  api/                         # typed supabase calls + TanStack Query hooks; database.types.ts
  domain/                      # shared types, zod schemas, status labels, equipment, amenities
  features/                    # search/, camping/, booking/, partner/, admin/ components
  ui/                          # Button, Card, Stepper, DateRangePicker, GuestPicker, PriceBreakdown, Map
  i18n/                        # setup, localized() helper, locales/el.json, locales/en.json
  lib/                         # supabase client, dates, money, push registration
supabase/
  migrations/                  # schema, RLS, SQL functions, cron
  functions/
    _shared/                   # pricing.ts, cancellation.ts, ref.ts, payments/provider.ts, email/, push.ts, auth.ts
    search/                    # available pitch types (SQL) + prices (TS)
    quote/                     # price one stay
    create-booking/            # validate → price → reserve_and_create_booking RPC
    booking-action/            # accept, decline, cancel, check-in, no-show, assign pitch
    guest-booking/             # manage-link token: view / cancel / review
    notify/                    # email + push dispatcher for notification_queue
    invite/                    # partner invites
  tests/                       # pgTAP
  seed.sql                     # demo partner + camping for dev
```

### 6.1 Data model (condensed)

```sql
-- people & partners
profiles(id uuid pk → auth.users, full_name, phone, country, locale, is_platform_admin bool default false)
partners(id, name, legal_name, vat_number, billing_email, commission_bps int null,
         payout_account_ref text null, status 'active'|'suspended', created_at)
partner_members(partner_id, user_id, role 'owner'|'staff', email_prefs jsonb, pk(partner_id, user_id))
partner_invites(id, partner_id, email citext, role, token_hash, expires_at, accepted_at)

-- campings
campings(id, partner_id, slug unique, status 'draft'|'live'|'paused',
         name, short_descr jsonb, descr jsonb, house_rules jsonb,
         region, address, lat, lng, phone, email, amenities text[],
         check_in_from time, check_out_until time, same_day_cutoff time default '14:00',
         confirmation_mode 'instant'|'request', request_expiry_hours int default 24,
         payment_mode 'on_site'|'deposit'|'full' default 'on_site', deposit_percent int null,
         cancellation_policy 'flexible'|'moderate'|'strict', created_at)
camping_photos(id, camping_id, storage_path, sort)

-- product & prices
pitch_types(id, camping_id, unit_category default 'pitch', name jsonb, descr jsonb, included jsonb,
            accepts equipment[] /* 'tent'|'caravan'|'camper' */, max_people int, size_m2 int null,
            photos text[], active bool, sort int)
seasons(id, camping_id, name jsonb, dates daterange, min_nights int default 1,
        EXCLUDE USING gist (camping_id WITH =, dates WITH &&))
guest_categories(id, camping_id, name jsonb, min_age int, max_age int null, sort int)
extras(id, camping_id, name jsonb, unit 'per_night'|'per_stay', max_qty int, active bool, sort int)
fees(id, camping_id, name jsonb, unit 'per_person_night'|'per_pitch_night'|'per_stay', amount_cents int)
prices(season_id, item_type 'pitch'|'guest'|'extra', item_id, amount_cents int,
       pk(season_id, item_type, item_id))

-- availability
inventory_nights(pitch_type_id, night date, allotment int ≥ 0, booked int ≥ 0, closed bool default false,
                 pk(pitch_type_id, night), CHECK (booked <= allotment))

-- bookings
bookings(id, ref unique, camping_id, pitch_type_id, user_id null,
         guest_name, guest_email citext, guest_phone, guest_country, locale,
         vehicle_plate, arrival_eta, guest_note,
         arrival date, departure date, nights int generated,
         equipment, party jsonb /* {category_id: count} */, extras jsonb /* {extra_id: qty} */,
         status, hold_expires_at, request_expires_at,
         total_cents, price_breakdown jsonb, currency default 'EUR',
         payment_mode, due_online_cents, paid_cents default 0, refunded_cents default 0,
         cancellation_policy, commission_bps, commission_cents,
         assigned_pitch text, internal_note text, cancel_reason text,
         manage_token_hash text, created_at, updated_at)
booking_events(id, booking_id, at, actor_kind 'guest'|'partner'|'admin'|'system',
               actor_user_id null, from_status, to_status, note)
payments(id, booking_id, provider, provider_ref, kind 'authorization'|'capture'|'refund',
         amount_cents, platform_fee_cents, status, raw jsonb, created_at)          -- M7

-- engagement & ops
reviews(id, booking_id unique, camping_id, user_id null, rating 1..5, body, locale,
        partner_reply, partner_replied_at, hidden bool, hidden_reason, created_at)
favorites(user_id, camping_id, pk(user_id, camping_id))
push_tokens(user_id, token unique, platform, updated_at)
notification_queue(id, kind, booking_id null, recipient, channel 'email'|'push', payload jsonb,
                   status 'pending'|'sent'|'failed', attempts int, next_attempt_at, created_at)
commission_statements(id, partner_id, month date, total_cents, status 'open'|'sent'|'paid')
platform_settings(id = 1, default_commission_bps int)
```

### 6.2 Security (RLS)
- Helper SQL functions: `is_admin()`, `is_partner_member(partner_id)`, `is_partner_owner(partner_id)`, `camping_partner(camping_id)`, `camping_is_live(camping_id)`.
- **anon / everyone:** read `live` campings, their active pitch types, photos, seasons, prices, extras, fees, guest categories and visible reviews. Nothing else.
- **bookings:** signed-in guests read their own (`user_id = auth.uid()`); partner members read their campings' bookings; admin reads all. **No direct insert or update policy:** writes only via edge functions and SQL functions (`security definer`).
- **Partner config tables:** members read; owners write. Staff may only open/close nights (via `set_closed()`).
- Guest personal data is visible only to the booking's partner and the admin. Never log it.
- The service role key lives only in edge functions.

### 6.3 Payment seam (M7)
```ts
interface PaymentProvider {
  createPartnerAccount(p: Partner): Promise<{ accountRef: string; onboardingUrl: string }>;
  getPartnerStatus(accountRef: string): Promise<{ chargesEnabled: boolean; payoutsEnabled: boolean }>;
  createCharge(i: {
    bookingId: string; amountCents: number; platformFeeCents: number; accountRef: string;
    capture: 'now' | 'later'; customerEmail: string; returnUrl: string;
  }): Promise<{ chargeRef: string; checkoutUrl: string }>;
  capture(chargeRef: string): Promise<void>;
  voidAuthorization(chargeRef: string): Promise<void>;
  refund(chargeRef: string, amountCents: number): Promise<void>;
  parseWebhook(req: Request): Promise<PaymentEvent | null>;   // normalized events
}
```
Hosted checkout (redirect to `checkoutUrl`) keeps card data out of the app on all three platforms.

## 7. Monetization
- **Commission per completed booking**, suggested 5–8%, set per partner. A founding-partner rate for the first camping makes joining an easy yes.
- Later:
  - Rentals (bungalows, mobile homes) as v2, since `unit_category` is ready.
  - A white-label booking button or widget for camping websites (the `/c/<slug>` link is the first step).
  - Featured placement once there are many campings.
  - Paid partner tools (reports, channel sync).
- Honest expectation: big platforms (Booking.com, camping-specific ones like Pitchup) already list Greek campings. Antiskino's edge is being local, Greek-language, simple, cheaper and having a direct relationship with each camping. Growth is partner by partner, not through ads.

## 8. Acceptance criteria (MVP done when…)
- [ ] 20 concurrent booking attempts for the last available pitch → exactly 1 succeeds and the rest get "no longer available". `booked` never exceeds `allotment` (pgTAP).
- [ ] Pricing fixtures pass: a stay across a season boundary prices each night by its own season; per-stay extras count once; fees apply by unit (deno test).
- [ ] Min nights, capacity, equipment and closed nights are enforced; nights without inventory or season are not sellable.
- [ ] Request mode: an unanswered request expires at its deadline, releases inventory and emails the guest.
- [ ] A guest books without an account, gets the email in their language, opens the manage link, sees and cancels the booking. Refund amounts follow the preset (0 in on-site mode).
- [ ] Signing in with an email claims earlier guest bookings with that email.
- [ ] RLS: a member of partner A can't read any row of partner B; anon can't read bookings (pgTAP).
- [ ] Partner Today updates within seconds of a new booking (realtime), and the staff phone gets a push.
- [ ] One live camping → Home opens its page; two or more → search.
- [ ] Every UI string comes from locale files; a test fails if `el.json` and `en.json` keys differ.
- [ ] Web `/c/<slug>` is pre-rendered with title, description and og:image.
- [ ] CI green on `main`; the web preview deploys; the preview APK installs and receives a push.

## 9. Milestones
1. **Skeleton:** Expo + Router + TS strict, i18n EL/EN, CI, web preview deploy, Supabase dev project with migrations applied by the GitHub integration, first migration (profiles, platform_settings, `is_admin()`), seed demo users.
2. **Partner setup:** schema (partners → campings → pitch types → seasons/prices → inventory), RLS + pgTAP, seed demo partner/camping, email-code sign-in with partner/admin gates, admin create/invite (copy link), partner Profile / Pitch types / Rates / Availability screens with photos.
3. **Search & quote:** `search` and `quote` functions + pricing tests, Home (with single-camping mode), results list/map, camping page.
4. **Booking (on-site payment):** `create-booking`, instant and request flows, `transition_booking`, jobs, emails, manage link, cancellations, claiming bookings on sign-in, My bookings.
5. **Reception:** Today, booking detail actions, assign pitch, check-in/no-show, realtime, push notifications.
6. **Reviews, favorites, polish:** review invites, replies, moderation; favorites; empty/error states; Android preview APK. **Field test with the first camping** using its real pitch types, seasons and prices.
7. **Online payments:** pick the provider, implement `PaymentProvider`, deposit/full modes, request-mode authorize/capture, refunds, platform fee, partner payout onboarding.
8. **Launch:** commission statements, terms/privacy, custom domain, Supabase production plan, store listings (Android first, then iOS).

## 10. Open questions
- **Payment provider** (Stripe Connect vs Viva.com): decide before M7 on fees, payouts, local card coverage, and who is the merchant of record.
- **Commission rate**, and whether the first camping gets a founding rate.
- **Invoicing:** the camping issues receipts for stays; Antiskino invoices commission to partners. Confirm with an accountant (myDATA obligations, VAT on commission).
- **Local fees:** reports indicate campsites are exempt from Greece's Climate Crisis Resilience Fee. Confirm with the first camping; the `fees` table covers any charge that does apply.
- **The first camping's setup:** does it use a PMS or sell on other sites? This sets allotment sizes and whether sync is needed later.
- **Domain and store names:** check that antiskino.gr / .com and the app store name are available.
- **Legal:** terms of service, privacy policy (GDPR), partner agreement.
