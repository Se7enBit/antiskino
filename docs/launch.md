# Launch guide (M7)

Step by step, in this order. Everything happens in web dashboards, so a phone is
enough. "Variables" and "secrets" are in GitHub → the repository → Settings →
Secrets and variables → Actions (two tabs).

What the workflows do:

| Workflow (GitHub → Actions) | When | What |
|---|---|---|
| CI | every push | checks; on `main` it then runs **Website** |
| Website | after CI on `main`, after Release, by hand, or when a camping goes live | builds and publishes the site on GitHub Pages |
| Release | by hand, on `main` | production database migrations and edge functions, tags the commit `production`, then Website |
| Android preview build | by hand | APK against the dev project (expo.dev → Builds) |
| Android release build | by hand, after a Release | app bundle (.aab) against production, for Google Play |
| Keep databases awake | daily | one small query to each project, so free projects don't pause |

Before launch the site is the preview at `https://se7enbit.github.io/antiskino/`.
After step 4 the domain's root is production and the preview moves to
`https://<domain>/preview/`.

## 1. Business details and legal texts

1. Edit `src/config/business.ts`: business name, tax ID (ΑΦΜ), address, contact
   email, and `LEGAL_UPDATED` (today's date).
2. Have a lawyer read `/terms` and `/privacy` (Account → Legal) and write the
   partner agreement.

## 2. Production database (Supabase, free plan)

1. supabase.com → New project, name `antiskino`, region **Frankfurt
   (eu-central-1)**. Save the database password.
2. Secrets: `SUPABASE_PROJECT_REF` (the part before `.supabase.co` in the
   project URL), `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`
   (supabase.com → Account → Access tokens → Generate).
3. Variables: `PROD_SUPABASE_URL` (`https://<ref>.supabase.co`) and
   `PROD_SUPABASE_KEY` (Project settings → API keys → publishable key).
4. GitHub → Actions → **Release** → Run workflow (branch `main`). It applies
   every migration (no demo data) and deploys the edge functions.
5. Production dashboard → Edge Functions → Secrets:
   - `NOTIFY_SECRET`: a new long random value (a password generator works)
   - `RESEND_API_KEY`: from resend.com → API keys
   - `EMAIL_FROM`: `Antiskino <bookings@<domain>>` (needs step 3)
   - `SITE_URL`: `https://<domain>`
   - `EXPO_ACCESS_TOKEN`: optional, the same as on dev
6. SQL editor (production), with your values:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<the NOTIFY_SECRET value>', 'notify_secret');
   ```
7. Authentication → URL configuration: Site URL `https://<domain>`; Redirect
   URLs `https://<domain>/**` and `antiskino://**`. Authentication → Emails:
   copy the sign-in (magic link / OTP) template from the dev project, so the
   email shows the 6-digit code. Authentication → SMTP: host `smtp.resend.com`,
   port 465, user `resend`, password a Resend API key, sender
   `noreply@<domain>`: sign-in emails then come from your domain without the
   built-in mailer's low limit.
8. Sign in once on the production site (after step 4), then make yourself admin
   in the SQL editor:
   ```sql
   update public.profiles set is_platform_admin = true
   where id = (select id from auth.users where email = '<your email>');
   ```

## 3. Domain and email sending

1. Buy the domain (check that antiskino.gr / .com are free).
2. resend.com → Domains → Add domain, then add the DNS records it shows at the
   domain's registrar. Wait for **Verified**. Guest emails go out from then on;
   set `EMAIL_FROM` on the dev project to the new address too.

## 4. Website on the domain

1. Variable `CUSTOM_DOMAIN` = the domain, e.g. `antiskino.gr` (no `https://`).
2. GitHub → Settings → Pages → Custom domain: the same domain. Add the DNS
   records GitHub shows (four `A` records for the domain, `CNAME www` →
   `se7enbit.github.io`). When the check passes, tick **Enforce HTTPS**.
3. Actions → **Website** → Run workflow. Production: `https://<domain>`;
   preview: `https://<domain>/preview/`.
4. Dev project: set its `SITE_URL` secret and Auth Site URL / Redirect URLs to
   `https://<domain>/preview` (the old github.io address now redirects).

From now on: merging to `main` updates the preview; **Release** updates
production. Run Release only when CI on `main` is green.

## Automatic website refresh (set up now; again for production)

Each live camping's page is built ahead of time, so a camping that goes live
(or changes its name, description or photos) needs a website rebuild. The
database asks GitHub for one, at most every 5 minutes, once you give it a token:

1. GitHub → your profile picture → Settings → Developer settings → Personal
   access tokens → Fine-grained tokens → Generate new token. Name
   `antiskino website refresh`; expiration: the longest offered (note the date);
   Repository access: Only select repositories → `antiskino`; Permissions →
   Repository permissions → **Actions: Read and write**. Copy the token.
2. Supabase dashboard (dev project now, production after step 2 above) →
   Integrations → Vault → Add new secret, twice:
   - name `github_repo`, value `Se7enBit/antiskino`
   - name `github_token`, value the token
3. Test: make a camping live (admin → partner → camping). Within about 7
   minutes Actions shows a **Website** run.

When the token expires, generate a new one and edit `github_token` in Vault.

## 5. Android on Google Play

1. play.google.com/console: developer account (one-time fee), then Create app
   "Antiskino", package `gr.antiskino.app`.
2. Set `version` in `app.json` to `1.0.0` (each later release: raise it).
3. Actions → **Android release build** → Run workflow. About 15 minutes later
   download the .aab from expo.dev → Projects → antiskino → Builds.
4. Play Console → Testing → Internal testing → Create release → upload the
   .aab. Test it, then promote it to Production.
5. Store listing: privacy policy `https://<domain>/privacy`; account deletion
   `https://<domain>/delete-account`; Data safety: personal info (name, email,
   phone), app activity (reviews), device IDs (the push token); no location;
   encrypted in transit; users can delete their data.
6. The preview APK and the Play app share the package name: uninstall the
   preview before installing from Play.

## 6. Afterwards

- **Keep databases awake** runs daily. If GitHub emails that it was turned off
  (no commits for 60 days), open it and press Run workflow.
- The free plan has no daily backups: move production to a paid plan before
  real traffic.
