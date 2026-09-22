#!/usr/bin/env bash
# Checks the events seq trigger against a real race on the local database
# (`supabase start`). pgTAP runs in one session and can't show this.
#
# Writer A inserts into household one and holds its transaction open for 3s.
# Meanwhile a puller reads household one, writer B inserts into household one,
# and writer C into household two. Expected: C isn't held up, B waits for A,
# the puller sees nothing from household one until A commits, and A's seq is
# below B's. Without the lock, B commits a higher seq first and a pull in that
# moment moves its cursor past A's for good.
set -euo pipefail

DB=${DB_URL:-postgresql://postgres:postgres@127.0.0.1:55322/postgres}
U=00000000-0000-0000-0000-00000000000a
H1=00000000-0000-0000-0000-0000000000a1 B1=00000000-0000-0000-0000-0000000000b1
H2=00000000-0000-0000-0000-0000000000a2 B2=00000000-0000-0000-0000-0000000000b2

q() { psql "$DB" -qAt -v ON_ERROR_STOP=1 -c "$1"; }
ins() {
  echo "insert into public.events (id, household_id, baby_id, type, occurred_at, created_by,
    updated_by, client_created_at) values ('$1', '$2', '$3', 'diaper', now(), '$U', '$U', now());"
}
now_ms() { python3 -c 'import time; print(int(time.time() * 1000))'; }
cleanup() { q "delete from public.households where id in ('$H1', '$H2'); delete from auth.users where id = '$U';"; }

cleanup
trap cleanup EXIT
q "insert into auth.users (id, email) values ('$U', 'race@example.test');
   insert into public.households (id, name, created_by) values ('$H1', 'one', '$U'), ('$H2', 'two', '$U');
   insert into public.babies (id, household_id, name, born_at) values
     ('$B1', '$H1', 'b', now()), ('$B2', '$H2', 'b', now());"

E1=00000000-0000-0000-0000-0000000000e1 E2=00000000-0000-0000-0000-0000000000e2
E3=00000000-0000-0000-0000-0000000000e3
start=$(now_ms)
psql "$DB" -qAt -c "begin; $(ins $E1 $H1 $B1) select pg_sleep(3); commit;" >/dev/null &
sleep 0.5
(q "$(ins $E2 $H1 $B1)"; echo $(($(now_ms) - start)) > "${TMPDIR:-/tmp}/moraki-race-b") &
(q "$(ins $E3 $H2 $B2)"; echo $(($(now_ms) - start)) > "${TMPDIR:-/tmp}/moraki-race-c") &
sleep 1.5
seen=$(q "select count(*) from public.events where household_id = '$H1'")
wait

b_ms=$(cat "${TMPDIR:-/tmp}/moraki-race-b") c_ms=$(cat "${TMPDIR:-/tmp}/moraki-race-c")
a_seq=$(q "select seq from public.events where id = '$E1'")
b_seq=$(q "select seq from public.events where id = '$E2'")
echo "B waited ${b_ms}ms, C ${c_ms}ms; household one rows visible mid-way: $seen; seq A=$a_seq B=$b_seq"

fail=0
[ "$b_ms" -ge 2500 ] || { echo "FAIL: B didn't wait for A's commit"; fail=1; }
[ "$c_ms" -lt 2000 ] || { echo "FAIL: another household's write was held up"; fail=1; }
[ "$seen" -eq 0 ] || { echo "FAIL: a pull saw household one rows while A was uncommitted"; fail=1; }
[ "$a_seq" -lt "$b_seq" ] || { echo "FAIL: seq doesn't follow commit order"; fail=1; }
[ $fail -eq 0 ] && echo "PASS"
exit $fail
