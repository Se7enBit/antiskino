# CLAUDE.md — Antiskino

Camping pitch booking platform for Greece: a marketplace of partner campings with a customer app and a partner dashboard in one Expo codebase (iOS, Android, web), backed by Supabase.

**`SPEC.md` is the source of truth** for features, data model, business rules and milestones. Read the relevant section before starting a task. If a request contradicts the spec, stop and ask. When a decision changes, update `SPEC.md` (including §0 Decisions log) in the same change.

## Current milestone
**M6 — Reviews, favorites, polish** (see SPEC §9; M1–M5 done; M4's emails are carried over until a Resend sending domain is verified; pushes reach phones once the EAS preview APK exists). Update this line when a milestone is done.

## Stack
Expo (latest SDK) + Expo Router + TypeScript strict · Supabase (Postgres + RLS, Auth email OTP, Storage, Edge Functions in Deno/TS, Realtime, pg_cron + pg_net) · TanStack Query · Zustand · react-hook-form + zod · i18next · Resend · Expo push. Ask before adding any library not listed in SPEC §5.

## Commands
```bash
npm install
npx expo start                     # dev server (press w for web)
npm run typecheck                  # tsc --noEmit
npm run lint                       # eslint + prettier check
npm test                           # jest
npx expo export -p web             # static web build
supabase start                     # local stack (needs Docker)
supabase db reset                  # apply migrations + seed.sql
supabase test db                   # pgTAP tests in supabase/tests
deno test supabase/functions       # edge function unit tests
npm run db:types                   # regenerate src/api/database.types.ts from the local stack
npm run format                     # prettier --write + eslint --fix
```
The Supabase CLI is v3 (pinned in CI): `gen types` and `test db` target the local stack by default.

## Working from a phone
The owner mostly works from a phone, so:
- **CI is the test runner.** Keep `typecheck → lint → jest → deno test → pgTAP → web export` green, and add tests with every logic change.
- The web preview (https://se7enbit.github.io/antiskino/) deploys on push to `main`, and native checks use the EAS preview APK (GitHub → Actions → "Android preview build" → Run workflow; install from expo.dev → Builds). Push notifications don't work in Expo Go.
- Keep changes small. End each task with a short "how to check it on the phone" note (which screen, what to tap, what to expect).

## Rules

### Money, dates, prices
- Money is **integer cents** (`*_cents`) in EUR. Never use floats. Format only in UI via `src/lib/money.ts`.
- Stay dates are date-only strings `YYYY-MM-DD` in **Europe/Athens**. A stay covers the nights from arrival (inclusive) to departure (exclusive). Do night math with the helpers in `src/lib/dates.ts` (app) and `_shared` (functions), never with raw `Date` arithmetic.
- **Prices are computed only on the server** (`supabase/functions/_shared/pricing.ts`, a pure function). The app shows quotes from the `quote` / `search` functions and never sends a price to the server.
- Bookings keep a price/policy/commission **snapshot**. Never recompute existing bookings.

### Bookings & inventory
- Inventory and booking status change **only** through SQL functions: `reserve_and_create_booking`, `transition_booking`, `set_allotment`, `set_closed`. Never `UPDATE inventory_nights` or `bookings.status` anywhere else.
- Every status change goes through `transition_booking`, which also writes `booking_events` and enqueues notifications.
- Any change to these paths needs pgTAP tests, including the concurrency test (SPEC §8).

### Database & security
- Schema changes go in **new** files in `supabase/migrations/` (`supabase migration new <name>`). Never edit a migration that has been applied.
- Migrations reach the dev project only through the Supabase GitHub integration ("Deploy to production" on push to `main`). Never add `supabase db push` for dev to CI.
- Grant explicitly: every new table/function revokes all from `anon` and `authenticated` (functions also from `public`), then grants only what it needs. Supabase projects differ in default privileges.
- **RLS on every table.** Policies use `is_admin()`, `is_partner_member()`, `is_partner_owner()` (with `camping_partner()` / `camping_is_live()` for camping-scoped rows). Each new policy gets a pgTAP test.
- pgTAP files run against the seeded database: start each one by deleting partners and campings inside its transaction, as the existing files do.
- Storage blocks direct SQL deletes on `storage.objects`; tests that delete set `storage.allow_delete_query` to `'true'` like the Storage API does.
- Bookings have no direct insert/update policies; writes go through edge functions and `security definer` SQL functions.
- The Supabase secret (service role) key is used only inside edge functions. Never put it in the app. Never log secrets, tokens or guest personal data.
- Regenerate `src/api/database.types.ts` after every migration (`npm run db:types`). CI fails when it is stale.

### i18n
- No hard-coded user-facing strings. Use `t('…')` with keys in **both** `src/i18n/locales/el.json` and `en.json`. A test enforces matching keys.
- Get `t` from `useT()` and the language from `useLanguage()` (`@/i18n`), never `useTranslation` directly (ESLint enforces). This keeps language switches hydration-safe on static web.
- DB text fields are `jsonb {"el": …, "en": …}`. Display them with `localized()` (falls back to the other language).
- Emails and pushes use the booking's / user's `locale`.

### Code style
- TypeScript strict and no `any`. Use `unknown` + zod at every boundary (edge function input, URL params, storage).
- Components never call supabase directly. Data access goes through hooks in `src/api/`.
- Platform-specific code uses `*.native.tsx` / `*.web.tsx` (e.g. maps).
- Static web hosting can't serve unknown dynamic paths: screens with ids take query parameters (`/admin/partner?id=`); use `[param]` segments only with `generateStaticParams`.
- The partner area must work at 360 px wide and on desktop.
- Prefer small, readable modules over clever abstractions.

### Scope
- Build only what SPEC §2 lists for the current milestone. Anything in SPEC §3 (out of scope) needs explicit approval.
- Online payments: only the `PaymentProvider` interface exists until M7. Deposit/full payment modes stay disabled in the UI.

## Git
- **No AI attribution in commits or PRs.** No `Co-Authored-By` lines for Claude, no "Generated with Claude Code", no session links, no bot emoji.
- `CLAUDE.md` and `.claude/` **are committed** for this project, because cloud Claude Code sessions (used from the phone) work on a fresh copy of the repo. Only `.claude/settings.local.json` stays gitignored.
- Conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`), imperative mood, short subject line.
- Never commit `.env*` files except `.env.example`.

## Environment variables
- **App (public):** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (publishable/anon key), `EXPO_PUBLIC_SITE_URL`
- **Edge function secrets:** `SUPABASE_URL`, Supabase secret/service-role key (provided to functions), `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, `EXPO_ACCESS_TOKEN` (optional, push), `NOTIFY_SECRET` (push delivery; same value as the Vault secret `notify_secret`). From M7: `PAYMENT_PROVIDER`, provider API key, webhook secret.
- **CI web build (public values):** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` as Actions variables or secrets (either works), `EXPO_PUBLIC_SITE_URL` (optional variable; defaults to the Pages URL). The web job warns when the Supabase ones are missing.
- **CI secrets:** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` (prod migrations, M8), `EXPO_TOKEN` (EAS: the Android preview build workflow, from M6), `GOOGLE_SERVICES_JSON` (content of Firebase's google-services.json, for Android pushes in that workflow).
- Keep `.env.example` up to date with every variable (no values).
