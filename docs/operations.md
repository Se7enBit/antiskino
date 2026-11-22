# Running Antiskino

What runs by itself, what a failure email from GitHub means, and what to do
when something goes wrong. Setting things up the first time is in
`docs/launch.md`. Almost everything here happens in web dashboards, so a phone
is enough; only restoring a backup needs a computer.

## What checks itself

GitHub emails you when one of these fails (Settings → Notifications → Actions:
failed workflows). Open the run from the email: its first red step says what
broke.

| Workflow (GitHub → Actions) | When | A failure means | First step |
|---|---|---|---|
| CI | every push | a change broke a check | send Claude the run's link |
| Uptime check | every 3 hours | the website or the search didn't answer | [Site or search down](#site-or-search-down) |
| Back up production | nightly | no backup tonight | the run says why; usually a changed database password or access token (secrets `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`) |
| Backup restore test | the 8th of each month | the latest backup couldn't be restored | send Claude the run's link; backups keep being made meanwhile |
| Dependency check | the 1st of each month | a serious security issue in a package | ask Claude for a dependency update |
| Keep databases awake | daily | — | nothing, unless GitHub says it was turned off |

GitHub turns a scheduled workflow off after 60 days without commits. If an
email says so: Actions → that workflow → **Enable workflow**, then **Run
workflow**.

Crashes in the app and on the website go to **Sentry**, which emails each new
problem. Open it: the screen, the steps before it and the line of code are
there. Send Claude the issue's link or a screenshot.

## When something goes wrong

### Site or search down

1. Open the Uptime check run: it names what didn't answer (the website, the
   dev search or the production search) and the HTTP status.
2. **Website**: githubstatus.com (Pages). If GitHub is fine, Actions →
   **Website** → Run workflow publishes the site again.
3. **Search**: Supabase → the project. A **Paused** project (free projects
   pause after a week without use) → Restore project. Otherwise
   status.supabase.com, and Edge Functions → `search` → Logs.
4. Actions → **Uptime check** → Run workflow to confirm it's back.

### Emails don't arrive

1. Supabase (production) → Table editor → `notification_queue`. Rows with
   status `failed` show the reason in `last_error`; `pending` rows with many
   `attempts` are being retried.
2. Usual causes, in order:
   - Resend: the domain is no longer **Verified**, or the API key was deleted (resend.com).
   - The Edge Function secrets `RESEND_API_KEY` or `EMAIL_FROM` are wrong.
   - `NOTIFY_SECRET` (Edge Function secret) differs from `notify_secret` (Vault):
     nothing gets sent at all.
3. Sign-in codes are sent by Supabase Auth itself: Authentication → SMTP
   (launch step 2.7).

### Pushes don't arrive

Same table, rows with channel `push`. Pushes reach only the installed app
(the preview APK or the store app, not Expo Go), and the phone must allow
notifications for it. `EXPO_ACCESS_TOKEN` (Edge Function secret) must be
valid if it is set.

### A guest or a camping needs help with a booking

Admin → **Bookings** → search the name or the reference → tap the booking. You
see what the camping sees, with the history, and you can cancel it with a reason
(the guest gets the email) or correct the guest's name, email, phone, country or
language. Everything you do shows in the history as Antiskino's.

### A key or password leaked

Make a new one where it comes from, delete the old one, then put the new one
where it's used. Afterwards check that the next CI, Website and backup runs
are green.

| What | New one at | Then update |
|---|---|---|
| Supabase secret key | Supabase → Project settings → API keys: create a secret key, delete the old | nothing: edge functions get it by themselves (it's never in the app) |
| Database password | Supabase → Database → Settings → Reset password | secret `SUPABASE_DB_PASSWORD` |
| Supabase access token | supabase.com → Account → Access tokens | secret `SUPABASE_ACCESS_TOKEN` |
| Resend API key | resend.com → API keys | Edge Function secret `RESEND_API_KEY`, and the Auth SMTP password if it was the same key |
| Notify secret | any long random value | Edge Function secret `NOTIFY_SECRET` and Vault `notify_secret`, both the same (SQL below) |
| GitHub token for the website refresh | GitHub → Settings → Developer settings → Fine-grained tokens | Vault `github_token` (SQL below) |
| Expo token | expo.dev → Account settings → Access tokens | secret `EXPO_TOKEN`; Edge Function secret `EXPO_ACCESS_TOKEN` if it's the same |
| Sentry token | sentry.io → Settings → Auth tokens | secret `SENTRY_AUTH_TOKEN` |
| Backup passphrase | a new long random password | secret `BACKUP_PASSPHRASE`; keep the old one for 30 days, until the backups made with it expire |
| App Store Connect key | appstoreconnect.apple.com → Users and access → Integrations | secrets `APPLE_ASC_KEY_P8`, `APPLE_ASC_KEY_ID` |

The publishable key (`PROD_SUPABASE_KEY`, `EXPO_PUBLIC_SUPABASE_KEY`) is public
by design: it's in the website and the app, and the database rules protect
the data. It needs no change.

Changing a Vault secret (Supabase → SQL editor, production):

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'notify_secret'), '<the new value>');
```

## Restore a backup

Only when production's data is lost or damaged. Needs a computer with the
Supabase CLI, `psql` and `gpg`. The monthly **Backup restore test** does steps 3
and 4 on a test database, so the steps are known to work.

1. **A new production project.** Follow `docs/launch.md` step 2 for it,
   including **Release**: the migrations make the tables, the scheduled jobs,
   the trigger that creates profiles and the photo rules. Then step 2.5–2.7
   (Edge Function secrets, Vault, Authentication settings), and in Vault also
   `github_repo` and `github_token` (Automatic website refresh).
2. **The backup.** Actions → **Back up production** → the newest green run →
   Artifacts → `backup-<date>`.
3. **Restore**, in the repository folder:
   ```bash
   unzip backup-<date>.zip
   BACKUP_PASSPHRASE='<from the password manager>' scripts/backup/restore.sh \
     antiskino-<date>.tar.gz.gpg '<new project → Connect → Session pooler URL>'
   ```
   It loads users, bookings and everything else in one go: all or nothing.
   It refuses a database that already has users or bookings.
4. **Check**: sign in on the site, open Admin → Bookings and a camping page.
5. **Point everything at the new project**: variables `PROD_SUPABASE_URL` and
   `PROD_SUPABASE_KEY`, then Actions → **Website**, and a new Android release
   build (the app has the address built in).
6. **Photos** aren't in the backup (only the list of them). If the old
   project's Storage is gone too, the camping owners upload them again and
   delete the empty ones.
7. The next morning, check that **Back up production** ran green.
