#!/usr/bin/env bash
# Restores a backup made by dump.sh into a new Supabase project whose
# migrations are already applied (Release, or `supabase db push`). The schema
# comes from the migrations: they also make what a dump of the public schema
# leaves out (the scheduled jobs, the trigger that creates profiles, the photo
# rules in Storage). The backup brings the data: users, bookings, everything.
#
# It refuses a database that already has users or bookings. In one transaction
# (any error undoes everything): the backup's roles, then the rows the
# migrations added (settings, the photos bucket) are emptied and the backup's
# data loaded with triggers off. The decrypted files exist only in a temporary
# folder.
#
# Usage: BACKUP_PASSPHRASE=… scripts/backup/restore.sh <backup.tar.gz.gpg> <database URL>
#   the database URL: Supabase → the project → Connect → Session pooler.
set -euo pipefail

file="${1:?usage: restore.sh <backup.tar.gz.gpg> <database URL>}"
db="${2:?usage: restore.sh <backup.tar.gz.gpg> <database URL>}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"
# Warnings and errors only (no NOTICEs from truncate's cascades).
export PGOPTIONS='-c client_min_messages=warning'
psql_() { psql --no-psqlrc --quiet --set ON_ERROR_STOP=1 --dbname "$db" "$@"; }

if ! psql_ -tAc "select to_regclass('public.bookings') is not null" | grep -qx t; then
  echo "::error::No app tables in this database: apply the migrations first (Release, or supabase db push)."
  exit 1
fi
in_use=$(psql_ -tAc "select (select count(*) from auth.users) + (select count(*) from public.bookings)")
if [ "$in_use" != 0 ]; then
  echo "::error::This database already has users or bookings: restore only into a new project."
  exit 1
fi

dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$file" \
  3<<< "$BACKUP_PASSPHRASE" | tar -C "$dir" -xzf -

cat > "$dir/empty.sql" <<'SQL'
do $$
declare t record;
begin
  for t in select format('%I.%I', schemaname, tablename) as name from pg_tables where schemaname = 'public' loop
    execute 'truncate ' || t.name || ' cascade';
  end loop;
end;
$$;
truncate storage.buckets cascade;
SQL

psql_ --single-transaction \
  --file "$dir/roles.sql" --file "$dir/empty.sql" \
  --command 'SET session_replication_role = replica' --file "$dir/data.sql" > /dev/null
echo "Restored $(basename "$file")."
