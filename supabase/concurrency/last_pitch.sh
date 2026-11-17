#!/usr/bin/env bash
# SPEC §8: 20 concurrent attempts to book the last pitch → exactly one succeeds,
# the others are refused, and booked never exceeds allotment.
#
# pgTAP runs in a single session, so this test uses separate connections. It
# needs a database with the migrations applied (CI: the local Supabase stack)
# and cleans up its own rows.
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
ATTEMPTS="${ATTEMPTS:-20}"
DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"

run_sql() { psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }
cleanup() {
  run_sql -f "$DIR/last_pitch_cleanup.sql" >/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

run_sql -f "$DIR/last_pitch_cleanup.sql" >/dev/null
run_sql -f "$DIR/last_pitch_setup.sql" >/dev/null

# The gate: every attempt waits for this lock, so they all start together.
psql "$DB_URL" -X -q -c "select pg_advisory_lock(424242); select pg_sleep(3);" >/dev/null &
sleep 1
for i in $(seq 1 "$ATTEMPTS"); do
  psql "$DB_URL" -X -qtA -v token="token-$i" -f "$DIR/last_pitch_attempt.sql" \
    >"$WORK/$i.out" 2>"$WORK/$i.err" &
done
wait

booked=$(cat "$WORK"/*.out | grep -c '^ANT-' || true)
refused=$(cat "$WORK"/*.err | grep -c 'ANT01' || true)
state=$(run_sql -tA -f "$DIR/last_pitch_state.sql")

echo "attempts: $ATTEMPTS, booked: $booked, refused as unavailable: $refused, nights (booked/allotment) and bookings: $state"
if [ "$booked" -ne 1 ] || [ "$refused" -ne $((ATTEMPTS - 1)) ] || [ "$state" != "1/1,1/1|1" ]; then
  echo "FAIL: expected exactly one booking, $((ATTEMPTS - 1)) refusals, and 1/1,1/1|1" >&2
  cat "$WORK"/*.err >&2
  exit 1
fi
echo "ok: exactly one attempt got the last pitch"
