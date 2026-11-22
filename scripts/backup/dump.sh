#!/usr/bin/env bash
# Makes one encrypted backup of a Supabase database: roles, schema and data from
# `supabase db dump`, in a tar.gz encrypted with BACKUP_PASSPHRASE (AES-256).
# The plain dumps exist only in a temporary folder, until they are encrypted.
#
# Usage: BACKUP_PASSPHRASE=… scripts/backup/dump.sh <out.tar.gz.gpg> [target flags]
#   production (the Back up production workflow):
#     dump.sh antiskino-<date>.tar.gz.gpg --remote --password "$SUPABASE_DB_PASSWORD"
#   the local stack (the Backup restore test): dump.sh test.tar.gz.gpg
set -euo pipefail

out="${1:?usage: dump.sh <out.tar.gz.gpg> [supabase db dump target flags]}"
shift
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"

dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT

supabase db dump "$@" --role-only -f "$dir/roles.sql"
supabase db dump "$@" -f "$dir/schema.sql"
# Storage's vector tables (a feature the app doesn't use) can't be written by the
# postgres role, so a restore would fail on them.
supabase db dump "$@" --data-only --use-copy \
  -x storage.buckets_vectors -x storage.vector_indexes -f "$dir/data.sql"
for file in roles schema data; do
  [ -s "$dir/$file.sql" ] || { echo "::error::$file.sql is empty."; exit 1; }
done

tar -C "$dir" -czf - roles.sql schema.sql data.sql \
  | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
      --symmetric --cipher-algo AES256 -o "$out" \
      3<<< "$BACKUP_PASSPHRASE"
ls -l "$out"
