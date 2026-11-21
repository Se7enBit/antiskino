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
| iOS build | by hand: preview or production | iPhone app, sent to TestFlight (step 7) |
| Keep databases awake | daily | one small query to each project, so free projects don't pause |
| Back up production | nightly, or by hand | encrypted copy of the production database, kept 30 days |
| Dependency check | monthly, or by hand | fails on high or critical vulnerabilities in the packages; lists all findings and newer versions |

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
   (supabase.com → Account → Access tokens → Generate), and
   `BACKUP_PASSPHRASE`: a long random password from your password manager,
   saved there too. Nightly backups are encrypted with it and can't be read
   without it (see Backups below).
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

## Error reports with Sentry (set up any time)

Until this is set, errors on guests' phones and on the website go unseen.

1. sentry.io → sign up (free Developer plan) → Create project → platform
   **React Native**, name `antiskino`. Copy the **DSN** it shows (also under
   Project settings → Client Keys). The DSN is public by design; it isn't a secret.
2. GitHub variables: `EXPO_PUBLIC_SENTRY_DSN` = the DSN.
3. The next website publish and the next Android build report errors, tagged
   `preview` or `production`. Sentry emails you about new problems.

Reports never include names, email addresses, phone numbers or link tokens.
On the website, Sentry only loads after an error, so visitors download nothing
extra.

Readable stack traces (optional): without this, reports show minified code.

1. sentry.io → Settings → Auth Tokens → Create New Token (an organization
   token: it already names your organization and the EU region). Copy it.
2. GitHub secret `SENTRY_AUTH_TOKEN` = the token. If the Sentry project isn't
   called `antiskino`, also add the variable `SENTRY_PROJECT` = its slug.
3. The next website publish and the next app build upload their source maps.
   The website never publishes them; the token stays in GitHub and, for app
   builds, as a secret variable on expo.dev.

## 5. Android on Google Play

1. play.google.com/console: developer account (one-time fee), then Create app
   "Antiskino", package `gr.antiskino.app`.
2. Set `version` in `app.json` to `1.0.0` (each later release: raise it).
3. Actions → **Android release build** → Run workflow. About 15 minutes later
   download the .aab from expo.dev → Projects → antiskino → Builds.
4. Play Console → Testing → Internal testing → Create release → upload the
   .aab. Test it, then promote it to Production.
5. Store listing: `assets/store/listing.md` has the texts in Greek and
   English (name, short and full description), the Data safety answers and
   the other App content answers, ready to paste. The graphics are next to it:
   the 512 px icon and the 1024×500 feature graphic in Greek and English. Take
   the phone screenshots on the installed app.
6. The preview APK and the Play app share the package name: uninstall the
   preview before installing from Play.

## 6. Afterwards

- **Dependency check** runs on the 1st of each month. If GitHub emails that it
  failed, ask Claude for a dependency update (the run lists what is affected).
- **Keep databases awake** runs daily. If GitHub emails that it was turned off
  (no commits for 60 days), open it and press Run workflow.
- The free plan has no backups of its own; the **Back up production** workflow
  covers that (below). A paid plan adds Supabase's daily backups and
  point-in-time restore once there is real traffic.

### Backups

Every night **Back up production** saves the production database in one file
encrypted with `BACKUP_PASSPHRASE` (users, bookings and everything else in the
database; not the Vault secrets, not the photo files in Storage). Each run keeps
its file for 30 days: Actions → Back up production → a run → Artifacts
(`backup-<date>`). Before production exists, each run just says there is
nothing to back up.

Check now and then that the latest runs are green. To restore (on a computer,
with the Supabase CLI and `psql`), into a new or emptied project:

```bash
unzip backup-<date>.zip
gpg -d antiskino-<date>.tar.gz.gpg | tar -xz   # asks for BACKUP_PASSPHRASE
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' --file data.sql \
  --dbname "<the project's connection string, Session pooler>"
```

Then set the edge function secrets and the Vault secrets again (step 2.5–2.6)
and redeploy the functions with Release.

## 7. iPhone app on the App Store (after Android)

Needs an Apple Developer account (99 USD a year; as a company once the
business is registered, so the store shows its name). Everything is in
browsers; EAS creates the signing certificate, provisioning profile and push
key itself.

1. developer.apple.com → enrol. Note the **Team ID** (Membership details).
2. appstoreconnect.apple.com → Apps → + New App: iOS, name "Antiskino",
   language Greek, bundle ID `gr.antiskino.app` (register it first under
   Certificates, Identifiers & Profiles → Identifiers if it isn't offered),
   SKU `antiskino`. Note the app's **Apple ID** (App Information).
3. App Store Connect → Users and Access → Integrations → App Store Connect
   API → Team Keys → + : name `EAS`, access **Admin**. Download the .p8 file
   (only once) and note the **Key ID** and the **Issuer ID** above the list.
4. GitHub secrets: `APPLE_ASC_KEY_P8` (the whole .p8 file, opened as text),
   `APPLE_ASC_KEY_ID`, `APPLE_ASC_ISSUER_ID`. Variables: `APPLE_TEAM_ID`,
   `IOS_ASC_APP_ID` (the app's Apple ID), and `APPLE_TEAM_TYPE` =
   `COMPANY_OR_ORGANIZATION` for a company account (default `INDIVIDUAL`).
5. Actions → **iOS build** → Run workflow → `preview` (against the dev
   project). About 30–45 minutes later it is in TestFlight: install the
   TestFlight app on the iPhone and accept the invitation App Store Connect
   sends (add yourself under TestFlight → Internal Testing).
6. For the store: run it again with `production` (after a Release), then in
   App Store Connect fill in the listing (the texts in
   `assets/store/listing.md` fit; screenshots from the iPhone), App Privacy
   (the same answers as Play's Data safety), and submit the build for review.
   The app is iPhone only, so no iPad screenshots are needed.
