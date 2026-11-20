# End-to-end tests

`booking.e2e.ts` books the seed's demo camping in a real browser and cancels it
with the manage link, checking the database after each step (SPEC §8). It runs
in CI (job "End-to-end"):

1. `supabase start` (database with migrations and seed, API, edge functions);
2. `npx expo export -p web` against that stack, with
   `EXPO_PUBLIC_SITE_URL=http://127.0.0.1:8081/antiskino`;
3. `npx playwright test -c e2e/playwright.config.ts`, which serves `dist/`
   like GitHub Pages (`e2e/serve.js`).

On failure, the job uploads the Playwright report (screenshots and a trace of
each step) as the `e2e-report` artifact: GitHub → Actions → the run → Artifacts.
