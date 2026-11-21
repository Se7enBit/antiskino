# Antiskino — SPEC

> Book a camping pitch in Greece in under a minute. (*αντίσκηνο* = tent)

Last updated: 2026-11-18 · Status: M1–M5 done (M4's emails carried over), M6 in progress (reviews, favorites, polish)

## 0. Decisions log

| Area | Decision | Notes |
|---|---|---|
| Product shape | Marketplace + a direct link per camping | `/c/<slug>` is shareable on the camping's own site/socials. If only one camping is live, Home opens it directly |
| Partners | A partner is a **company**; it can own one or more campings | Members belong to the partner and see all its campings |
| Bookables | **Pitches only** (tent / caravan / camper) | No bungalows or rentals in v1 |
| Spot assignment | Customer books a **pitch type**; reception assigns the pitch number | `assigned_pitch` free text on the booking |
| Confirmation | **Per camping**: instant or request-to-book | Requests expire after N hours (default 24) |
| Payment | **Per camping**: on site / deposit online / full online | Only "on site" until the provider is integrated (M8) |
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
| Migrations deploy | **Supabase GitHub integration** applies `supabase/migrations` to the dev project on push to `main` ("Deploy to production") | CI never runs `db push` for dev; it applies migrations to a local stack and runs pgTAP. Prod: manual `workflow_dispatch` (M7) |
| Supabase CLI | v3, pinned in CI | `gen types` and `test db` target the local stack by default. Types: `npm run db:types` (public schema, Prettier-formatted); CI fails when stale |
| UI language | Held in React state (`LanguageProvider`, `useT()`) | Static web HTML is Greek and switches to the browser language after hydration; changes run in a transition to avoid hydration mismatches |
| DB grants | Explicit per table/function | Supabase projects differ in default privileges, so migrations revoke from `anon`/`authenticated` and grant only what is needed |
| Camping status | Only admins change it, via `set_camping_status()` | Owners update profile columns only (not partner, slug or status). New campings start as `draft` |
| Payment mode in DB | A check constraint keeps `payment_mode = 'on_site'` until M8 | Drop the constraint when online payments ship |
| Camping defaults | `confirmation_mode` instant, `cancellation_policy` flexible, `request_expiry_hours` 24 | Changed per camping in the profile |
| Catalog integrity | Seasons of a camping and guest-category age ranges cannot overlap; a price must point at an item of the season's camping | Deleting a pitch type, guest category or extra deletes its prices |
| Sign-in timing | Email-code sign-in and the partner/admin gates move to **M2** | Partners and admins need them to use M2's screens. Claiming guest bookings and My bookings stay in M4 |
| Sign-in email | One bilingual (EL + EN) code template for both new and returning users | Hosted projects need **custom SMTP** before templates can be edited (default emails carry a link, not the code). Dev: Resend SMTP; then paste the template into Confirm signup and Magic link |
| Native session storage | `@react-native-async-storage/async-storage` | Web keeps using localStorage. Reusable for guest favorites (Zustand) |
| Photo uploads | `expo-image-picker` → Supabase Storage | Camping and pitch-type photos (M2) |
| Partner invites | **Copy-link invites** until a Resend sender domain is verified | The admin shares the invite link (Share sheet); email via Resend is added later |
| Invite mechanics | SQL functions `create_partner_invite()` / `accept_partner_invite()` | 7-day one-time token, only its SHA-256 stored; a new invite replaces the pending one for that email. Admins invite to any partner, owners to their own. Accepting needs a sign-in with the invited email and never demotes an owner. The `invite` edge function arrives only with invite emails |
| Partner area navigation | Sidebar ≥ 768 px wide, bottom tabs below; `/partner` opens Bookings until Today ships (M5) | Short tab labels on phones (Availability → "Calendar" / "Ημερολόγιο"); a camping switcher appears with more than one camping. Phone tabs: Today, Bookings, Profile, Calendar, Reviews, each with an icon and an 11 px label below it (like the customer tabs); Pitch types, Rates and Team have no phone tab (Profile links to them) and take no space (`tabBarItemStyle: display none`), or the bar squeezed the five into 45 px each |
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
| Maps (M3) | One `PinsMap` component: `react-native-maps` on native, Leaflet + OpenStreetMap tiles on web, loaded only in the browser after hydration (Leaflet needs `window`) | Results: a List / Map toggle with a price pin per camping (tap or Tab + Enter opens it); campings without coordinates are counted under the map. Camping page: a small map in Location. Leaflet's map-level keyboard handler is off: it focused the map on tap, the page scrolled and the tap was lost. OSM's public tiles are fine for previews; pick a tile provider before launch (M7). Native maps moved to MapLibre in M6 (see Maps on phones), the web map in M7 (see Web map) |
| Booking writes (M4) | `reserve_and_create_booking()` (secret key only) re-checks the §4.1 rules, locks the nights in order and takes one pitch each, all or nothing; `transition_booking()` is the only status change | Errors: `ANT01` not available / sold out, `ANT02` move not allowed. The reference is made in SQL (`new_booking_ref()`). Commission is snapshotted at creation: `round_half_up(total × bps / 10000)` with the partner's rate or the platform default |
| Guest and partner actions (M4) | SQL functions instead of the `guest-booking` and `booking-action` edge functions | `guest_booking()` / `guest_cancel_booking()` check the manage token's SHA-256 (anon may call them; 32 random bytes can't be guessed). `cancel_my_booking()` for signed-in guests, `claim_bookings()` on sign-in, `partner_booking_action()` for accept / decline / cancel (members and admins; a reason is required to cancel). Guests can cancel until the end of the arrival day |
| Notification queue (M4) | Rows say who (`audience`: guest or partner members) and how (email / push); addresses are looked up when sending | No guest data is copied into the queue. Guests without an account get no push rows. Rows wait until the `notify` function and a verified Resend domain exist |
| Last-pitch concurrency test | A script with 20 separate connections (`supabase/concurrency/`, outside `supabase/tests` so `supabase test db` leaves it alone), run in CI after pgTAP | pgTAP runs in one session, so it can't race connections. An advisory lock releases all attempts at once |
| create-booking (M4) | Prices the stay with the same code as `quote`, then calls `reserve_and_create_booking()` with the secret key (`SUPABASE_SERVICE_ROLE_KEY`, provided to edge functions) | Returns the reference, status and the manage token (shown once; only its SHA-256 is stored). A signed-in user's token links the booking to them. The price breakdown snapshot also keeps the item names at booking time. JWT verification is off: guests book without an account. Open risk: anyone can create bookings, so watch for spam holding inventory (rate limiting or a captcha later) |
| Booking route | `/book?pitchType=…&arrival=…` (query parameters) instead of `/c/[slug]/book` | Static hosting: no pre-rendered page per camping is needed for the flow |
| Booking flow (M4) | Stay (the party mapped to the camping's categories, extras priced for the whole stay, live breakdown) → details → review with the terms checkbox → Book / Send request | Details are prefilled for signed-in users. Country: a list of 20 common countries or a typed 2-letter code. The result shows the reference and the **manage link with a Share button**: until booking emails work (verified Resend domain) it is the guest's only copy. If the pitch was taken meanwhile, the flow goes back to step 1 with a notice |
| Manage page (M4) | `/m?ref=…&t=…` outside the tabs, shows status, stay, the price snapshot (names at booking time), terms and the camping's contact; Cancel with a second tap until the end of the arrival day | Shows "to change dates, cancel and book again" (F6). The same view is reused for My bookings |
| My bookings (M4) | The Bookings tab calls `claim_bookings()` each time it loads the list, then lists the user's bookings (upcoming first); details at `/bookings/detail?ref=` | Claiming on load covers sign-ins on any device and sessions restored from storage. `my_booking()` returns the same JSON as the manage link (both use `booking_view()`), plus the id for `cancel_my_booking()` |
| Partner Bookings (M4) | A Bookings tab (first in the partner area): requests to answer with their deadline (Accept; Decline after a second tap), upcoming stays (Cancel with a reason for the guest), past and cancelled on demand; guest phone and email as call / email buttons | The M4 slice of F11 Bookings, so the request flow works end to end. The list refreshes every minute until realtime (M5). Search, filters, detail, check-in and no-show come with M5. |
| Booking jobs (M4) | pg_cron, enabled by a migration: `expire-overdue-bookings` every 5 minutes, `complete-past-stays` daily at 01:00 UTC (03:00 or 04:00 in Athens, after the Athens date has changed) | Job names make `cron.schedule()` update rather than duplicate. "Request expiring in 2 h" pushes, arrival reminders and review invites come with emails and push (`notify`, pg_net) |
| Reception actions (M5) | `partner_booking_action()` also takes `check_in` and `no_show` (confirmed bookings, from the arrival day in Athens); `update_booking_desk()` sets `assigned_pitch` and `internal_note` (members and admins; empty text clears). Bookings are in the `supabase_realtime` publication. `push_tokens` is written only through `register_push_token()` / `unregister_push_token()`; a device registered by another user moves to them | One entry point for the camping's booking actions. A no-show keeps its nights: only cancel / decline / expire release them (§4.1). The app uses realtime events only as a signal to refetch, so RLS on select is the only gate on them |
| Booking detail (M5) | Bookings is a stack: the list and `/partner/bookings/detail?ref=` (guest, stay, price snapshot, payment, commission, history from `booking_events`, reception actions, pitch number and internal note). The list gains search by name/reference (case and accents ignored), a status filter (cancelled covers declined and expired) and a From/To range of overlapping stays (default: the last 60 days and everything ahead). Check-in and no-show buttons appear on cards and the detail from the arrival day | Search and status filter run on the loaded list; a date range reloads it from the server. The detail uses the booking's reference like the guest's pages |
| Today and realtime (M5) | `/partner` opens Today: counts of arrivals, departures and stays checked in tonight; requests by deadline with a minute-by-minute countdown; arrivals (late guests still to check in first, then by ETA) with a red "No pitch assigned" until reception sets one; departures (checked in, leaving today). The partner layout subscribes to `postgres_changes` on the selected camping's bookings and refetches the partner queries on any change; a 5-minute refetch is the fallback. On phones the Pitch types tab is hidden (six tabs don't fit at 360 px) and Profile links to it | Realtime payloads are not read, so they never need their own access rules. Hiding the tab button (not `href: null`) keeps the route reachable |
| Push delivery (M5) | pg_cron `deliver-push` runs `invoke_notify()` every minute: when pushes are due it calls the `notify` edge function through pg_net, using the Vault secrets `project_url` and `notify_secret` (nothing is called until both exist). `notify` checks `x-notify-secret` against `NOTIFY_SECRET`, claims up to 50 due pushes (`claim_push_notifications`: guest devices in the booking's language, team devices in each member's profile language), sends them with the Expo Push API and records each outcome (`finish_push_notification`). Claiming leases a push for 5, 10, 15… minutes; the fifth failed attempt is final; pushes queued over 2 hours ago and request pushes for answered requests are skipped; devices Expo reports as unregistered are deleted. `queue-expiring-requests` (every 5 minutes) queues one "request expiring" push for the team 2 hours before the deadline, unless the request arrived less than 3 hours before it. Emails stay pending until Resend | Postgres can only reach the function through pg_net; a shared secret avoids storing the service-role key in Vault. Pushes carry the booking's screen (`/bookings/detail?ref=` or `/partner/bookings/detail?ref=`) and no contact details |
| Push registration (M5) | `expo-notifications` (SPEC §5). While signed in, the iOS/Android app asks for notification permission once and registers its Expo push token (`register_push_token`); sign-out removes it first (`unregister_push_token`). Tapping a push opens `data.url`, only if it is a guest or partner booking page. Tokens need the EAS project id (`extra.eas.projectId`, set by `eas init`, M6); without it, and in Expo Go or on the web, the app simply registers nothing. Android delivery also needs FCM credentials in EAS | The token is tied to the user, so a shared reception phone gets the pushes of whoever is signed in |
| Reviews (M6) | `reviews` keeps what it shows (first name, country, month of stay, copied from the booking when written), so the public reads reviews without touching bookings. Anon reads the display columns of visible reviews of live campings; authenticated users also get `booking_id`, `hidden` and `hidden_reason` (RLS shows them only to the camping's team and admins); `user_id` is never exposed. Writes only through `submit_my_review()` (signed in), `guest_submit_review()` (manage link), `reply_to_review()` (team, one editable reply; empty removes it) and `set_review_hidden()` (admin, reason required). A completed booking without a review can be reviewed (`can_review()`, error ANT03 otherwise); `booking_view()` now returns `can_review` and the review. `camping_ratings` (security-invoker view) averages visible reviews; the app shows it from 3 reviews. A new review queues a `review_received` push for the team | No time limit on reviewing in v1 |
| Daily guest messages (M6) | `queue_daily_guest_messages()` runs hourly (`5 * * * *`) and does nothing before 10:00 Athens time, so it follows summer time: an `arrival_reminder` for confirmed stays arriving in 2 days and a `review_invite` for unreviewed stays that ended 1–3 days ago (catching up if the job was down), each once per booking (email always, push with an account). Push claims carry the review rating; reminders for cancelled stays and invites for reviewed stays are skipped | §4.5 asks for 10:00; pg_cron runs in UTC, so a fixed hour would drift by one in winter |
| Review form and display (M6) | Guests review on their booking page (My bookings detail or the manage link) once it can be reviewed: five stars (required) and an optional text up to 1000 characters; afterwards the page shows their review, the camping's reply and whether Antiskino hid it. The camping page lists the 30 latest visible reviews (stars, text, first name · country · month of stay, the camping's reply) under a note that only guests who stayed can review; the average ("4.6 · reviews: 12") appears under the camping name and on result cards from 3 reviews. `search` returns each camping's `rating` from `camping_ratings` | Reviews load in the browser, so a new review shows without a rebuild |
| Review replies and moderation (M6) | Partner **Reviews** tab (owner and staff): every review of the camping, hidden ones with Antiskino's reason, each with its booking (opens the detail) and one public reply (publish, edit, or empty it to remove it); the rating of visible reviews from 3, otherwise how many are visible. The "new review" push opens this tab. On phones the Rates tab is hidden too (Profile links to Pitch types and Rates), so the bar keeps five tabs: Today, Bookings, Profile, Calendar, Reviews ("Κριτικές"). Admin **Reviews** (`/admin/reviews`, linked from the admin home): the latest 100 reviews of all campings or only hidden ones; Hide asks for a reason (the camping's team sees it), Show again clears it | Rates and Pitch types change rarely and mostly from a computer |
| Favorites (M6) | A heart on result cards and on live camping pages. Guests' favorites live on the device (Zustand persisted to localStorage / AsyncStorage, validated when read); signed-in users' in `favorites` (own rows only; only live campings can be added; no updates). On sign-in `merge_favorites()` adds the device's live campings to the account, ignoring duplicates, and the device list is cleared (kept if the merge fails, to retry). The Favorites tab lists live saved campings newest first, with the heart to remove them; guests see a hint that signing in keeps favorites on all devices. Hearts render after hydration, since the static page can't know the device's list | Removing is a tap on the filled heart, so no confirmation |
| Error states (M6) | An unexpected error anywhere shows "Something went wrong" with Try again and Go to the start (the root layout's `ErrorBoundary`), instead of a blank page. Every screen that loads data shows a loading state, an empty state where a list can be empty, and an error with Try again (`ErrorState`), now also on partner Profile, Pitch types and Rates | — |
| Android preview APK (M6) | A manual GitHub workflow ("Android preview build") runs `eas init --non-interactive --force` (creates or links the EAS project under the `EXPO_TOKEN` account and puts its id in app.json for that build), writes the public Supabase settings into the checkout's eas.json, and starts `eas build --profile preview` (internal APK, version code kept by EAS) without waiting; the APK is installed from expo.dev. The first build creates the Android signing key on EAS. Android pushes need Firebase (see Android pushes) | Builds from the phone, with no local tools; nothing generated is committed |
| Native start-up fixes (M6) | The first Android APK closed on start: supabase-js sets `URL.protocol` when it creates its client, and React Native's `URL` has no setters. The app now starts from `index.ts`, which loads `react-native-url-polyfill` first (native only; the web keeps the browser's URL), then Expo Router. Preview builds (`EXPO_PUBLIC_SHOW_FATAL_ERRORS=1` in eas.json) show any fatal error in an alert before the app closes, so a screenshot from the phone says what broke; the alert text is an untranslated developer diagnostic | Phone-only testing has no logcat. Production builds leave the flag unset |
| Maps on phones (M6) | MapLibre replaces `react-native-maps`, whose Android version needs a Google Maps key (a Google Cloud account with billing) and also brought WorkManager. The map style is OpenFreeMap's "liberty" (OpenStreetMap data, free, no account or key); attribution stays on. Pins are price (results) or name (camping page) labels; tapping one opens the camping | Free and Google-free. If OpenFreeMap ever fails us, MapLibre takes any other style URL |
| Android pushes (M6) | Android delivers pushes only through Firebase Cloud Messaging (free; only FCM is used, no other Firebase product or SDK code). The build writes `google-services.json` from the `GOOGLE_SERVICES_JSON` GitHub secret (the file's content; without it the APK builds without Android pushes), and Expo sends with the FCM V1 service account key uploaded on expo.dev (Credentials). iOS pushes need an Apple Developer account (M7) | Keeps the Firebase file out of the repo and out of chat |
| Android release builds (M6) | SDK 58 shrinks release builds with R8. A local config plugin (`plugins/withAndroidKeepRules.js`) keeps the constructors of Room databases, which R8 removed: WorkManager's database could not be created and the second preview APK closed on start | One rule, added once to `proguard-rules.pro` at prebuild |
| Partner team (M6) | Owners manage their partner's team on **Team** (sidebar on wide screens; on phones Profile links to it, owners only): members with name, email and role (Make owner / Make staff, Remove after a confirmation), pending invites with Revoke, and invite links to share (staff by default) while emails are off. The admin's partner page uses the same component (owner by default). `partner_team()` returns names and emails to the partner's owners and admins only; `set_partner_member_role()`, `remove_partner_member()` and `revoke_partner_invite()` are for owners and admins, lock the team, and keep at least one owner (error ANT04) | Profiles and auth emails stay private to each user except through these functions |
| Admin bookings (M6) | `/admin/bookings` (button on the admin home) lists every camping's bookings, newest arrival first, read-only: camping and guest, dates, nights, people, reference, status, total and commission. It shares the partner list's search, status filter and date range (`BookingFilters`, default: stays ending in the last 60 days or later) and loads at most 500 stays, saying so when the list is cut | Admins act on bookings through the Supabase dashboard in v1 (§F12) |
| Milestone order (M6) | Launch comes before online payments: M7 is the launch with payment at the camping, M8 adds online payments | The whole app works with on-site payment; payments need a business account, an accountant's answer on invoicing and campings that want them, and are easier to choose and test once real campings use the app |
| Email delivery (M6) | The `notify` function also sends the queued emails through Resend (one batch per run; if Resend refuses the batch, one by one, so one bad address doesn't hold back the rest) when `RESEND_API_KEY`, `EMAIL_FROM` and `SITE_URL` are set: guests get booking confirmed, request sent / declined / expired, cancelled, arrival reminder and review invite; the camping's team gets new booking, new request (with the deadline) and cancelled, each member in their profile language. Texts are plain and simple HTML in Greek and English with every value escaped. The manage link's token is now also stored sealed (AES-GCM, key derived from the secret key that only edge functions hold; `bookings.manage_token_enc`, unreadable by app users), so guest emails carry the link; bookings made before have none and their emails point to sign-in. A guest email waits up to 2 minutes for the token. Emails queued before sending existed were skipped, and later ones queued over a day ago are skipped. Until a domain is verified in Resend, `EMAIL_FROM` must be Resend's test sender (`onboarding@resend.dev`), which only delivers to the Resend account's own address | Mute-by-event for partner emails (F10) comes later |
| Launch setup (M7) | Web: GitHub Pages with the custom domain (the spec's Cloudflare Pages is dropped; the domain is not chosen yet). Production: a separate Supabase project on the free plan, kept awake by a scheduled GitHub workflow that calls it daily (free projects pause after a week without activity; no daily backups on that plan). The web map moves to MapLibre (`maplibre-gl`) with OpenFreeMap, like the phones. Business details in the legal pages stay placeholders until the business is registered. Default commission stays 6%. Extras in M7: the website refreshes when a camping goes live, and partner members can turn off emails per kind | Free and simple until there are paying campings; upgrade the database plan before real traffic |
| Commission statements (M7) | `/admin/commission` (admin home → Commission) shows, for a month (last month by default, ‹ › to move), each partner's completed stays by departure date, their value and the commission due (the bookings' snapshots; no commission on cancellations or no-shows, §4.4), with the statement's status: Open, Sent or Paid. `set_commission_statement()` (admins) records the status and the total at that moment in `commission_statements` (one per partner and month); if the stays change later the screen shows the earlier total. Download CSV gives the month's stays per partner (semicolons, amounts in the language's decimal style, UTF-8 with BOM for Greek Excel); on phones it opens the share sheet. Partner owners can read their own statements; staff can't | Invoices themselves come from the accounting software |
| Account deletion (M7) | Account tab → Delete account, and the public page `/delete-account` (the link store listings ask for; sign in there first). After an inline confirm, the `delete-account` function (the signed-in user only) runs `prepare_account_deletion()` and then deletes the login, which removes the profile, favorites, devices and team memberships with it. The user's bookings (theirs or with their email) stay for the campings' records and the commission, anonymised: name "Deleted guest", a placeholder email and phone, and no plate, arrival time, note or manage link. Their reviews are deleted and their pending guest emails and pushes are skipped. The only owner of a partner team is refused until someone else is owner | GDPR erasure while keeping what the bookings and commission need; a team can't be left without an owner |
| Partner email settings (M7) | Partner members see **Booking emails** on the Account tab with three choices: new bookings, new requests to answer, cancellations (the team emails of §F10). Turning one off stores the kind in `profiles.muted_emails` (the member's own row only); `claim_email_notifications()` leaves those members out of that kind. Pushes are unaffected. If the whole team turned a kind off, the email is skipped | Per member, not per camping: a member gets the same emails for every camping of the partner |
| Terms and privacy (M7) | `/terms` and `/privacy` in Greek and English, linked from the Account tab (Legal) and under the terms checkbox of the booking review step. The business name, tax ID, address and contact email come from `src/config/business.ts` and are placeholders until the business is registered; `LEGAL_UPDATED` there is the date shown on both pages. The texts follow the platform model of §F5 (the camping is the seller of the stay) and the GDPR basics (controller, data, purposes, processors, retention, rights, the Hellenic DPA) | Drafts written for the product as built: have a lawyer review them, with the partner agreement, before launch (§10) |
| Web map (M7) | `maplibre-gl` replaces Leaflet: the same OpenFreeMap style as the phones, so the public OpenStreetMap tile servers (not meant for production) are no longer used. It loads after hydration in its own chunk (about 1 MB, only when a map shows). Pins are label buttons (Tab + Enter opens them); wheel zoom, arrow-key panning and rotation are off so the page scrolls normally; zoom buttons and compact attribution stay. maplibre-gl 6 (5.x and early 6.x have an XSS advisory) loads its worker as a separate module file that Metro can't bundle: `postinstall` copies it to `public/maplibre-gl-worker.js` (gitignored) and the map sets its URL under the site's base URL | One map style for web and phones, free and without keys |
| Release pipeline (M7) | One GitHub Pages site. Before launch it is the preview (main against the dev project). With the `CUSTOM_DOMAIN` variable set, the Website workflow builds production at the domain's root, from the commit tagged `production`, against `PROD_SUPABASE_URL` / `PROD_SUPABASE_KEY`, and the preview at `/preview/` (robots.txt asks search engines to skip it). Production changes only through the manual **Release** workflow: `supabase db push --remote` and `functions deploy` to the production project, then the tag, then the website, so the site is never ahead of its database. **Android release build** makes the Play Store app bundle against production (EAS `production` profile); the preview APK keeps the dev project. **Keep databases awake** queries both projects daily so free projects don't pause. Steps: `docs/launch.md` | Free hosting with a preview that survives launch; production releases are deliberate, and the dev project still migrates on every merge |
| Website refresh (M7) | Live campings' pages are pre-rendered (name, short description, cover photo), so the website is rebuilt when they change: triggers on `campings` (going live or leaving, or slug/name/description of a live one) and `camping_photos` (of a live one) mark `website_refresh`; the pg_cron job `refresh-website` (every 5 minutes) runs `send_website_refresh()`, which, once changes have been quiet for 2 minutes, asks GitHub to run the Website workflow (`workflow_dispatch` on `main`) through pg_net. It needs the Vault secrets `github_repo` and `github_token` (a fine-grained token limited to this repository with Actions read/write, less than the Contents write that `repository_dispatch` needs); without them nothing is sent. Both projects can have it: every rebuild publishes production and the preview | Partners see their camping online within minutes without anyone running a workflow |
| App icon (M7) | A first logo until a designer makes one: a white tent with crossed poles ("αντίσκηνο"), a sun and a sea wave on the app's green. `scripts/render-icons.js` draws it and renders the app icon, Android adaptive icon layers (background, foreground in the safe zone, monochrome for themed icons), favicon, and the Play Store icon and feature graphics (`assets/store/`, Greek and English); `assets/logo/*.svg` are the editable sources | Replacing Expo's placeholder icon is needed for the store listing; one script keeps every size consistent |
| Fake-booking limits (M7) | Booking needs no account and costs nothing on site, so one person could fill a camping's allotment. A `before insert` trigger on `bookings` (inside `reserve_and_create_booking`'s transaction) applies the §4.3 limits per guest email: 3 overlapping active bookings at a camping, 10 upcoming in all; the app explains and suggests contacting the camping. Emails are compared with `lower()`: with `search_path = ''`, citext's case-insensitive operators aren't found and `=` compares case-sensitively | Stops casual abuse without accounts or captchas; partners can still cancel fake bookings. A per-device or captcha check can come later if needed |
| Security review (M7) | Before launch: every `security definer` function pins `search_path`; anon can run only the RLS helpers, `sellable_pitch_types` and the token-checked guest functions; signed-in users can't call `reserve_and_create_booking` or `transition_booking`; the one view is `security_invoker`; pgTAP 022 checks every table for cross-partner and anon reads; emails escape all HTML; logs carry no personal data. Fixed: the commission CSV turned names starting with `=`, `+`, `-` or `@` into Excel formulas (now plain text), and the app now refuses a secret Supabase key in `EXPO_PUBLIC_SUPABASE_KEY` (it would ship to everyone) | The Content-Security-Policy came after (see Website security policy) |
| Search engines (M7) | Only the production website may be indexed: its build sets `EXPO_PUBLIC_INDEXABLE=1`; every other build (the github.io preview, `/preview/`) carries `<meta name="robots" content="noindex, nofollow">`, so test data never reaches Google. After the export, `scripts/seo.js` turns each pre-rendered camping page's schema.org `Campground` data (name, description, address, map position, cover photo, phone, rating from 3 reviews) into a JSON-LD script, and for production writes `sitemap.xml` (home, terms, privacy, each live camping at `c/<slug>/`) and `robots.txt` (pointing to it, disallowing `/preview/`). The data travels from `CampingHead` in a `<meta>` tag because React hoists meta tags without hydrating them, while an inline script wouldn't match in the browser. Camping pages' canonical and og:url end in `/`, as GitHub Pages serves the exported folders | Indexing starts with the domain; a sitemap and structured data help the first campings show up with details |
| Message previews (M7) | Admin home → **Messages** (`/admin/messages`) shows every email and push of §F10, to guests or to camping teams, in Greek or English, filled in with a sample booking. The admin-only `message-previews` edge function renders them with the same code that sends them (`_shared/messagePreviews.ts`), so the texts can't drift. On the web, emails render as HTML in a sandboxed frame; on phones, as their plain-text version | Reviewing the guest-facing texts needs no test bookings and no verified sending domain |
| Web speed and accessibility (M7) | Lighthouse at phone size on the home, camping and terms pages. The shared JavaScript every visitor downloads went from 1.8 MB to 1.05 MB: icons come from `src/ui/iconGlyphs.ts`, only the Material Community icons in use (generated by `scripts/icon-glyphs.js`; `IconName` is its keys, so an icon missing from it fails the typecheck), instead of every icon family's name tables (455 KB); and `metro.config.js` replaces zod's bundled error messages in ~40 languages (`z.locales`, 290 KB, unused) with an empty module. Screens were already split per route by Expo. Accessibility fixes: the loading spinner has an accessible name; home, terms, privacy and account deletion have a title and description in the static HTML (`PageHead`). Accessibility scores 96–100 | GitHub Pages compresses files itself; the rest of the start-up time is React Native Web and Supabase's client. Revisit with real traffic data |
| Crash reporting (M7) | Sentry's free plan, off until `EXPO_PUBLIC_SENTRY_DSN` is set (an Actions variable; workflows tag reports `production`, `preview` or the EAS profile). Apps: `@sentry/react-native` starts at launch for JS errors and native crashes. Web: small listeners wait for an error, then `@sentry/browser` loads (its own 1.2 MB chunk) and sends it, so visitors without errors download nothing. The crash screen reports what it catches. `src/lib/scrub.ts` removes the user, request headers and bodies, query strings (manage-link and invite tokens) and email addresses from events and breadcrumbs; no tracing, replays or screenshots. The privacy policy lists Sentry. Source maps: see the next row | Seeing errors guests hit before they report them, without sending their personal data |
| Dependency health (M7) | Packages stay on their current major versions, Expo ones matching SDK 58 (`@sentry/react-native` runs a little ahead of the SDK's suggestion, as before). `npm audit` shows only moderate findings in two packages, `glob` and `minimatch`, inside build and test tools (Jest, Expo's fingerprint, Sentry's bundler plugin): they matter only with untrusted glob patterns, and the fixed majors aren't used by those tools yet. npm overrides could force them but break `npm ci` (CI and EAS builds), so they wait for upstream. A monthly workflow (**Dependency check**) fails on high or critical findings and lists every finding, newer versions and the Expo SDK match in its summary | Real problems surface monthly without fighting npm; major upgrades (ESLint 10, TypeScript 7, Sentry 11, a new Expo SDK) are separate decisions |
| Website security policy (M7) | A post-export step (`scripts/csp.js`, after `seo.js`) puts a Content-Security-Policy `<meta>` first in every page's `<head>` (GitHub Pages sends no headers): scripts only from the site plus each page's inline scripts by SHA-256 (Expo Router's hydration flag), no eval; connections to the site, the Supabase project (HTTPS and realtime WebSocket), OpenFreeMap and Sentry's ingest host (origins from `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SENTRY_DSN`); images from the site, data:/blob: and Supabase Storage; inline styles allowed (React Native Web writes them at runtime); no plugins, `base-uri` and `form-action` self. zod's eval probe is turned off (`jitless`). The end-to-end booking test runs under the policy and fails on any violation | Limits the damage of injected content without breaking the app; a meta tag can't set `frame-ancestors`, which would need a host that sends headers |
| Production backups (M7) | The free plan has no backups. A nightly workflow (**Back up production**, also by hand) runs `supabase db dump` three times (roles, schema, data with COPY) against the linked production project, packs them, encrypts the archive with GnuPG (AES-256, passphrase from the `BACKUP_PASSPHRASE` secret) and keeps it as a 30-day run artifact; the plain dumps never leave the runner. Vault secrets are not dumped and Storage files are not included. Before production exists the run succeeds with a note. Restore steps: `docs/launch.md` | Guest data must survive a mistake or an outage without paying for a plan before there is traffic; artifacts of a public repository can be downloaded by others, hence the encryption |
| Partner guide (M7) | A "?" in the partner header (next to Exit, on phones and computers) opens `/partner/guide`: seven short topics (the area, Profile and Pitch types, Rates and Calendar, Bookings, Today at reception, Reviews/Team/notifications, payment and help), closed until tapped, one open at a time. Texts are in the locale files; the help line takes the contact email from `src/config/business.ts`. The route has no tab | Help where the campings work, without taking a tab; a printable copy lives outside the repo |
| iOS builds (M7, ready to run) | The build workflow is shared (`app-build.yml`, inputs `profile` and `platform`). **iOS build** (manual, preview or production) builds on EAS with store distribution for both profiles (no ad hoc device registration: testing is through TestFlight) and, with the `IOS_ASC_APP_ID` variable, submits to TestFlight. EAS logs in to Apple with an App Store Connect team API key (`APPLE_ASC_KEY_P8`, `APPLE_ASC_KEY_ID`, `APPLE_ASC_ISSUER_ID` secrets; `APPLE_TEAM_ID`, `APPLE_TEAM_TYPE` variables) and creates the certificate, profile and push key. The app is iPhone only (`supportsTablet: false`, no iPad screenshots) and declares no non-exempt encryption (no export compliance question per build). Untested until there is an Apple Developer account | Builds from the phone like Android; the store listing texts are shared |
| Readable stack traces (M7) | Off until the `SENTRY_AUTH_TOKEN` secret is set (variables `SENTRY_PROJECT`, default `antiskino`, and optional `SENTRY_ORG`). Website: exported with `--source-maps`; `scripts/sentry-sourcemaps.js` removes Expo's `//# debugId=` comments, runs `sentry-cli sourcemaps inject` (Sentry's debug-ID snippet, reusing each map's ID) and `upload`, then deletes every `.map` so the site never serves the source; a failed upload only warns. Apps: `scripts/eas-sentry.js` adds Sentry's Expo plugin to the build's app.json (not committed) and stores the token as a secret EAS variable of the profile's environment (`environment` in eas.json); the plugin's Gradle step uploads the Hermes source maps with the release and dist the SDK reports. Without the token the builds are unchanged | Readable errors without publishing the source; nothing in the app changes and no Metro config change is needed |

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
- With online payment (M8), request mode **authorizes** the card on request and **captures** it on accept. Decline or expiry voids the authorization.

### F5. Payment modes (per camping)
- **On site:** nothing is charged online and the guest pays at reception. This is the **only mode enabled until M8**.
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
- Each booking gets a **manage link** `/m?ref=<ref>&t=<token>` (query parameters: static web hosting can't serve unknown paths). The token is 32 random bytes and only its SHA-256 hash is stored. It lets the holder view, cancel and review that one booking, and it is sent in every booking email.
- **Sign-in** is by email one-time code (Supabase Auth OTP). There are no passwords and no social login in v1, which also avoids the Sign in with Apple requirement on iOS.
- On sign-in, every booking with that verified email is attached to the user (`claim_bookings()`).
- Signed-in users get a My bookings list, prefilled details, favorites sync and push notifications.
- Users can delete their account (Account tab or `/delete-account`); their past bookings are kept anonymised (see §0 Account deletion).

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
| **Camping profile** | Texts EL/EN, photos, amenities, map pin, check-in/out times, same-day cutoff, house rules, confirmation mode (+ expiry hours), payment mode (+ deposit %; online modes disabled until M8), cancellation preset | owner |
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
- Online payments until M8 (the interface exists, not the implementation).
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
- `held` (15-minute hold while paying online) only appears from M8.
- `requested` can also become `cancelled` (guest withdraws).
- Every transition goes through the SQL function `transition_booking(id, to_status, actor, note)`. It validates from → to, adjusts inventory, writes `booking_events` and enqueues notifications in the same transaction.
- Reference: `ANT-` + 6 characters of Crockford base32 (no ambiguous characters).
- Limits against fake bookings: one guest email (any letter case) holds at most **3** active bookings (held, requested, confirmed, checked in; not yet ended) at the same camping with overlapping stays, and at most **10** in total. A booking over a limit is refused (SQLSTATE `ANT05`, create-booking answers `too_many`) and takes no nights.

### 4.4 Commission
- `platform_settings.default_commission_bps` (e.g. 600 = 6%), overridable per partner with `partners.commission_bps`. Snapshotted on the booking at creation.
- **Earned** when the booking becomes `completed`, or on cancellation for the part the camping keeps (online modes only). No commission on `no_show` in v1 (trust-based; watch for abuse).
- **On-site mode:** commission accrues, and a monthly statement per partner is paid by bank transfer.
- **Online modes (M8):** commission is taken automatically as the platform fee on the online charge. That is why the deposit is at least 20%.

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
| Server state | TanStack Query over supabase-js; `react-native-url-polyfill` on native (React Native's `URL` lacks what supabase-js needs) |
| Local state | Zustand (search params, booking draft, guest favorites); AsyncStorage for native persistence (also the Supabase session) |
| Forms & validation | react-hook-form + zod (zod also validates edge function input) |
| i18n | i18next + react-i18next + expo-localization; `el.json`, `en.json`; DB texts as `jsonb {"el","en"}` |
| Dates | date-fns + small helpers in `src/lib/dates.ts`; nights as `YYYY-MM-DD` strings, Europe/Athens |
| Maps | MapLibre with OpenFreeMap's OpenStreetMap style (free, no key): `@maplibre/maplibre-react-native` on iOS and Android (`*.native.tsx`), `maplibre-gl` on web |
| Photos | `expo-image-picker` for choosing photos; files in Supabase Storage |
| Icons | `@expo/vector-icons` (Material Community Icons) |
| Backend | Supabase: Postgres + RLS, Auth (email OTP), Storage (photos), Edge Functions (Deno/TS), Realtime (partner Today/Bookings), pg_cron + pg_net |
| Email | Resend, called from edge functions; EL/EN templates |
| Push | expo-notifications + Expo Push API from edge functions |
| Payments | `PaymentProvider` interface only, until M8 |
| Monitoring | Sentry: `@sentry/react-native` in the apps (started at launch), `@sentry/browser` on the web (loaded only after an error); off without `EXPO_PUBLIC_SENTRY_DSN` |
| Tests | Jest (jest-expo) + React Native Testing Library; `deno test` for `_shared` logic (pricing, cancellation, refs); pgTAP via `supabase test db` (inventory, transitions, RLS); Playwright (`@playwright/test`, `e2e/`) for the end-to-end booking flow in a browser against the local stack |
| Lint/format | ESLint (expo config) + Prettier |
| CI | GitHub Actions: typecheck → lint → jest → deno test, `supabase start` + pgTAP + generated-types check → web export and the end-to-end booking test → deploy preview (from `main`). Migrations reach the dev project through the Supabase GitHub integration on push to `main`, not through CI |
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
      book.tsx                 # 3-step booking flow (?pitchType=&arrival=&departure=&adults=&children=&equipment=)
    favorites.tsx
    bookings/index.tsx         # My bookings (signed in)
    bookings/detail.tsx        # ?ref=: detail, cancel, review
    account.tsx                # sign in (email code), language, sign out
  m.tsx                        # guest manage link (?ref=&t=)
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
    _shared/                   # pricing.ts, party.ts, catalog.ts, payments/provider.ts, email/, push.ts
    search/                    # available pitch types (SQL) + prices (TS)
    quote/                     # price one stay
    create-booking/            # validate → price (shared with quote) → reserve_and_create_booking RPC → manage token
    booking-action/            # (M5 if needed) check-in, no-show, assign pitch; M4's accept/decline/cancel are SQL functions
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
         amount_cents, platform_fee_cents, status, raw jsonb, created_at)          -- M8

-- engagement & ops
reviews(id, booking_id unique, camping_id, user_id null, rating 1..5, body, locale,
        author_name, author_country, stay_month,           -- copied from the booking when written
        partner_reply, partner_replied_at, hidden bool, hidden_reason, created_at)
camping_ratings (view: camping_id, review_count, rating_avg over visible reviews)
favorites(user_id, camping_id, pk(user_id, camping_id))
push_tokens(user_id, token unique, platform, updated_at)
notification_queue(id, kind, booking_id, audience 'guest'|'partner', channel 'email'|'push',
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

### 6.3 Payment seam (M8)
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
- [x] 20 concurrent booking attempts for the last available pitch → exactly 1 succeeds and the rest get "no longer available". `booked` never exceeds `allotment` (concurrency script in CI, after pgTAP).
- [x] Pricing fixtures pass: a stay across a season boundary prices each night by its own season; per-stay extras count once; fees apply by unit (deno test).
- [x] Min nights, capacity, equipment and closed nights are enforced; nights without inventory or season are not sellable (pgTAP 008, 009).
- [x] Request mode: an unanswered request expires at its deadline, releases inventory and emails the guest (pgTAP 009).
- [x] A guest books without an account, gets the email in their language, opens the manage link, sees and cancels the booking. Refund amounts follow the preset (0 in on-site mode) (Playwright `e2e/booking.e2e.ts`; the email texts per language in deno tests).
- [x] Signing in with an email claims earlier guest bookings with that email (pgTAP 009).
- [x] RLS: a member of partner A can't read any row of partner B; anon can't read bookings (pgTAP 022 checks every table and view).
- [ ] Partner Today updates within seconds of a new booking (realtime), and the staff phone gets a push. *The realtime publication and the push queue are tested (pgTAP 012, 013; deno notify); seeing it on a phone is the field test.*
- [x] One live camping → Home opens its page; two or more → search (Jest Home).
- [x] Every UI string comes from locale files; a test fails if `el.json` and `en.json` keys differ (Jest locales).
- [x] Web `/c/<slug>` is pre-rendered with title, description and og:image (Jest CampingHead).
- [ ] CI green on `main`; the web preview deploys; the preview APK installs and receives a push. *CI and the preview are done; a push received on the APK still needs confirming on the phone.*

## 9. Milestones
1. **Skeleton:** Expo + Router + TS strict, i18n EL/EN, CI, web preview deploy, Supabase dev project with migrations applied by the GitHub integration, first migration (profiles, platform_settings, `is_admin()`), seed demo users.
2. **Partner setup:** schema (partners → campings → pitch types → seasons/prices → inventory), RLS + pgTAP, seed demo partner/camping, email-code sign-in with partner/admin gates, admin create/invite (copy link), partner Profile / Pitch types / Rates / Availability screens with photos.
3. **Search & quote:** `search` and `quote` functions + pricing tests, Home (with single-camping mode), results list/map, camping page.
4. **Booking (on-site payment):** `create-booking`, instant and request flows, `transition_booking`, jobs, emails, manage link, cancellations, claiming bookings on sign-in, My bookings. *Emails are sent since M6 (see Email delivery); guests receive them once the sending domain is verified (M7).*
5. **Reception:** Today, booking detail actions, assign pitch, check-in/no-show, realtime, push notifications. *Push delivery is live on the server; phones receive pushes once the EAS preview APK exists (M6).*
6. **Reviews, favorites, polish:** review invites, replies, moderation; favorites; empty/error states; Android preview APK. **Field test with the first camping** using its real pitch types, seasons and prices.
7. **Launch (on-site payment):** custom domain (also the Resend sending domain, so guest emails go out), Supabase production project and plan, terms/privacy, commission statements, store listings (Android first, then iOS).
8. **Online payments:** pick the provider, implement `PaymentProvider`, deposit/full modes, request-mode authorize/capture, refunds, platform fee, partner payout onboarding.

## 10. Open questions
- **Payment provider** (Stripe Connect vs Viva.com): decide before M8 on fees, payouts, local card coverage, and who is the merchant of record.
- **Commission rate**, and whether the first camping gets a founding rate.
- **Invoicing:** the camping issues receipts for stays; Antiskino invoices commission to partners. Confirm with an accountant (myDATA obligations, VAT on commission).
- **Local fees:** reports indicate campsites are exempt from Greece's Climate Crisis Resilience Fee. Confirm with the first camping; the `fees` table covers any charge that does apply.
- **The first camping's setup:** does it use a PMS or sell on other sites? This sets allotment sizes and whether sync is needed later.
- **Domain and store names:** check that antiskino.gr / .com and the app store name are available.
- **Legal:** terms of service, privacy policy (GDPR), partner agreement.
