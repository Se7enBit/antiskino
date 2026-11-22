# End-to-end tests

They use the app in a real browser against the local Supabase stack and its
seed (`supabase/seed.sql`), checking the database after each step (SPEC §8):

- `booking.e2e.ts`: a guest books the demo camping "demo-thalassa" without an
  account and cancels with the manage link; the camping pages are pre-rendered
  in both languages under the Content-Security-Policy.
- `reception.e2e.ts`: the camping's and Antiskino's side. The owner accepts a
  guest's request at "demo-pefka" (bookings by request) from Today and checks
  a guest in on the arrival day; a new request shows on the open Today screen
  within seconds (Realtime); the admin opens a booking from Admin → Bookings,
  corrects the guest's phone and cancels it with a reason.

`helpers.ts` holds the database query and the sign-in: the owner and the admin
are signed in without email, with a one-time code from the local stack's auth
admin API (the stack's own service key, `E2E_SERVICE_KEY`), so the job needs no
mail server.

They run in CI (job "End-to-end"):

1. `supabase start` (database with migrations and seed, API, edge functions,
   Realtime);
2. `npx expo export -p web` against that stack, with
   `EXPO_PUBLIC_SITE_URL=http://127.0.0.1:8081/antiskino`;
3. `npx playwright test -c e2e/playwright.config.ts`, which serves `dist/`
   like GitHub Pages (`e2e/serve.js`).

On failure, the job uploads the Playwright report (screenshots and a trace of
each step) as the `e2e-report` artifact: GitHub → Actions → the run → Artifacts.
