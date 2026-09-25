#!/usr/bin/env bash
#
# protect-matches-with-events-check.sh — Container-Beweis fuer den BEFORE-DELETE-Trigger
# `matches_protect_events_before_delete` (supabase/migrations/20260925_002_protect_matches_with_events.sql,
# A6, .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A6-brief.md, Befund C-K6).
#
# Nach dem Muster von scripts/rls-role-matrix.sh (Wegwerf-Container, echtes Postgres mit RLS,
# `SET LOCAL ROLE authenticated` + `request.jwt.claim.sub`) — hier bewusst NICHT die gesamte
# Rollenmatrix aus rls-role-matrix.sh wiederverwendet (andere Fragestellung: nicht "wer darf was",
# sondern "wird ein Spiel mit Ereignissen jemals still geloescht"), aber dieselbe
# Baseline-plus-neuere-Migrationen-Quelle (scripts/lib/migrations-since-baseline.sh) und dasselbe
# Wartemuster (zweimal "database system is ready to accept connections", siehe dortiger
# Kopfkommentar).
#
# Was gemessen wird:
#   1. Eigentuemer loescht DIREKT ein Spiel MIT Ereignis                -> muss ABGELEHNT werden.
#   2. Eigentuemer loescht DIREKT ein Spiel OHNE Ereignis                -> muss ERLAUBT sein.
#   3. Co-Admin (role='co-admin', 'restructure' laut role_permissions)
#      loescht DIREKT ein Spiel MIT Ereignis                            -> muss ABGELEHNT werden.
#   4. Co-Admin loescht DIREKT ein Spiel OHNE Ereignis                   -> muss ERLAUBT sein.
#   5. Eigentuemer loescht das GESAMTE Turnier (Spiele UND Ereignisse
#      vorhanden) ueber DELETE FROM tournaments (kein separates
#      Matches-DELETE mehr davor, siehe SupabaseRepository.delete()
#      nach diesem Task)                                                -> muss ERLAUBT sein
#      (Kaskade: pg_trigger_depth() > 1 im Trigger).
#   Co-Admin kann Turniere nicht loeschen (tournaments_delete_v2 ist Eigentuemer-only,
#   Baseline Zeile 1750) — dafuer gibt es hier bewusst keine Probe.
#
# Aendert NICHTS an der Produktionsdatenbank — Wegwerf-Container, wird am Ende entfernt (trap).
#
set -euo pipefail

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # muss zur Live-Postgres-Version passen (wie rls-role-matrix.sh)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
CONTAINER_NAME="protect-matches-check-$$"

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
# bash 3.2 (macOS-Standard) kennt kein mapfile — portable while-read-Schleife, wie
# rls-role-matrix.sh es an derselben Stelle macht.
NEWER_MIGRATIONS_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
NEWER_MIGRATIONS=()
if [[ -n "$NEWER_MIGRATIONS_RAW" ]]; then
  while IFS= read -r line; do
    NEWER_MIGRATIONS+=("$line")
  done <<< "$NEWER_MIGRATIONS_RAW"
fi

# Diese Migration muss unter den "neuer als Baseline"-Dateien auftauchen, sonst haette save()
# nichts zu pruefen und dieses Skript wuerde eine Umgebung ohne den Trigger testen, ohne es zu
# merken.
FOUND_A6=0
for f in "${NEWER_MIGRATIONS[@]}"; do
  [[ "$(basename "$f")" == 20260925_002_protect_matches_with_events.sql ]] && FOUND_A6=1
done
if [[ "$FOUND_A6" -ne 1 ]]; then
  echo "::error::20260925_002_protect_matches_with_events.sql nicht in der Liste 'neuer als Baseline' gefunden." >&2
  exit 1
fi

cleanup() { docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432 \
  "$POSTGRES_IMAGE" >/dev/null

READY=0
for _ in $(seq 1 90); do
  READY_COUNT="$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "database system is ready to accept connections" || true)"
  if [[ "$READY_COUNT" -ge 2 ]]; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "$READY" -ne 1 ]]; then
  echo "::error::Container wurde nach 90s nicht vollstaendig bereit." >&2
  docker logs "$CONTAINER_NAME" 2>&1 | tail -30 >&2
  exit 1
fi
for _ in $(seq 1 30); do
  docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

psql_stdin() {
  docker exec -i "$CONTAINER_NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"
}

echo "Baseline + $(( ${#NEWER_MIGRATIONS[@]} )) neuere Migration(en) einspielen..." >&2
psql_stdin < "$BASELINE_FILE"
for f in "${NEWER_MIGRATIONS[@]}"; do
  psql_stdin < "$f"
done

# Trigger + Funktion muessen jetzt existieren.
TRIGGER_EXISTS="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
  "SELECT count(*) FROM pg_trigger WHERE tgname = 'matches_protect_events_before_delete';")"
if [[ "$TRIGGER_EXISTS" -ne 1 ]]; then
  echo "::error::Trigger matches_protect_events_before_delete fehlt nach dem Einspielen." >&2
  exit 1
fi

uuid_for() {
  local h
  h="$(printf '%s' "protect-matches-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-${h:12:4}-${h:16:4}-${h:20:12}"
}

U_OWNER="$(uuid_for user:owner)"
U_COADMIN="$(uuid_for user:coadmin)"
T_MAIN="$(uuid_for tournament:main)"
T_CASCADE="$(uuid_for tournament:cascade)"
M_WITH_EVENT="$(uuid_for match:with-event)"
M_NO_EVENT="$(uuid_for match:no-event)"
M_COADMIN_WITH_EVENT="$(uuid_for match:coadmin-with-event)"
M_COADMIN_NO_EVENT="$(uuid_for match:coadmin-no-event)"
M_CASCADE_1="$(uuid_for match:cascade-1)"
M_CASCADE_2="$(uuid_for match:cascade-2)"
E_1="$(uuid_for event:1)"
E_2="$(uuid_for event:2)"
E_3="$(uuid_for event:3)"
E_CASCADE_1="$(uuid_for event:cascade-1)"
E_CASCADE_2="$(uuid_for event:cascade-2)"

echo "Fixtures anlegen..." >&2
psql_stdin <<SQL
BEGIN;

INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '$U_OWNER', 'authenticated', 'authenticated', 'owner@protect-matches.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_COADMIN', 'authenticated', 'authenticated', 'coadmin@protect-matches.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES
  ('$T_MAIN', '$U_OWNER', 'Protect Matches — main', '2026-09-25', 8, 15, '{}'::jsonb),
  ('$T_CASCADE', '$U_OWNER', 'Protect Matches — cascade', '2026-09-25', 8, 15, '{}'::jsonb);

INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at)
VALUES
  ('$(uuid_for membership:coadmin-main)', '$T_MAIN', '$U_COADMIN', 'co-admin', now());

INSERT INTO public.matches (id, tournament_id, round, field, match_status)
VALUES
  ('$M_WITH_EVENT', '$T_MAIN', 1, 1, 'scheduled'),
  ('$M_NO_EVENT', '$T_MAIN', 1, 2, 'scheduled'),
  ('$M_COADMIN_WITH_EVENT', '$T_MAIN', 1, 3, 'scheduled'),
  ('$M_COADMIN_NO_EVENT', '$T_MAIN', 1, 4, 'scheduled'),
  ('$M_CASCADE_1', '$T_CASCADE', 1, 1, 'scheduled'),
  ('$M_CASCADE_2', '$T_CASCADE', 1, 2, 'scheduled');

INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away)
VALUES
  ('$E_1', '$M_WITH_EVENT', 'GOAL', 10, 1, 0),
  ('$E_2', '$M_COADMIN_WITH_EVENT', 'GOAL', 10, 1, 0),
  ('$E_CASCADE_1', '$M_CASCADE_1', 'GOAL', 10, 1, 0),
  ('$E_CASCADE_2', '$M_CASCADE_2', 'GOAL', 20, 2, 0);
-- E_3 bewusst ungenutzt gelassen (keine dritte Probe braucht ein drittes Event) -- entfernt, um
-- keine tote Variable zu deklarieren.

COMMIT;
SQL

# run_write(): wie rls-role-matrix.sh — eigene, nie committete Transaktion pro Probe, echte RLS-
# Rolle + JWT-Claim, wertet den psql-Befehls-Tag aus ("DELETE 1" = durchgelassen, kein Tag/Fehler
# = abgelehnt).
run_delete() {
  local user_id="$1" sql="$2"
  local out ec
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$user_id';
$sql
SQL
)"
  ec=$?
  set -e
  if [[ $ec -ne 0 ]]; then
    echo "denied"
  elif grep -qE '^DELETE [1-9][0-9]*$' <<<"$out"; then
    echo "allowed"
  else
    echo "denied"
  fi
}

MISMATCHES=0
check() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "OK    $label -> $actual" >&2
  else
    echo "FAIL  $label -> erwartet $expected, gemessen $actual" >&2
    MISMATCHES=$((MISMATCHES + 1))
  fi
}

echo "Proben laufen..." >&2

R1="$(run_delete "$U_OWNER" "DELETE FROM public.matches WHERE id = '$M_WITH_EVENT';")"
check "1. Eigentuemer loescht Spiel MIT Ereignis (direkt)" "denied" "$R1"

R2="$(run_delete "$U_OWNER" "DELETE FROM public.matches WHERE id = '$M_NO_EVENT';")"
check "2. Eigentuemer loescht Spiel OHNE Ereignis (direkt)" "allowed" "$R2"

R3="$(run_delete "$U_COADMIN" "DELETE FROM public.matches WHERE id = '$M_COADMIN_WITH_EVENT';")"
check "3. Co-Admin loescht Spiel MIT Ereignis (direkt)" "denied" "$R3"

R4="$(run_delete "$U_COADMIN" "DELETE FROM public.matches WHERE id = '$M_COADMIN_NO_EVENT';")"
check "4. Co-Admin loescht Spiel OHNE Ereignis (direkt)" "allowed" "$R4"

# 5. Eigentuemer loescht das GESAMTE Turnier — matches_tournament_id_fkey/teams_tournament_id_fkey
# sind ON DELETE CASCADE (Baseline :1493/:1525), match_events/match_corrections haengen
# wiederum per ON DELETE CASCADE an matches (Baseline :1461/:1465) -- eine zweistufige Kaskade.
# tournaments_delete_v2 (Baseline :1750) ist Eigentuemer-only -- deshalb keine Co-Admin-Probe hier.
#
# run_delete() COMMITted bewusst NICHT (wie run_write() in rls-role-matrix.sh -- das reicht, um
# eine Policy/einen Trigger anhand des psql-Befehls-Tags zu messen). Fuer DIESE Probe reicht das
# nicht: "allowed" beweist nur, dass die Anweisung durchging, nicht dass die Kaskade wirklich
# etwas geloescht hat. Deshalb hier EIGENS mit COMMIT, danach in einer neuen Verbindung als
# Superuser nachgelesen -- der einzige Schreibzugriff in diesem Skript, der tatsaechlich
# committet wird (Wegwerf-Container, wird am Ende ohnehin entfernt).
set +e
R5_OUT="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$U_OWNER';
DELETE FROM public.tournaments WHERE id = '$T_CASCADE';
COMMIT;
SQL
)"
R5_EC=$?
set -e
if [[ $R5_EC -ne 0 ]]; then
  R5="denied"
else
  grep -qE '^DELETE [1-9][0-9]*$' <<<"$R5_OUT" && R5="allowed" || R5="denied"
fi
check "5. Eigentuemer loescht Turnier MIT Spielen+Ereignissen (Kaskade)" "allowed" "$R5"

# Beleg, dass Probe 5 tatsaechlich etwas geloescht hat, statt an RLS zu scheitern und dabei
# zufaellig wie "allowed" auszusehen (waere hier unmoeglich, aber die Gegenprobe kostet nichts).
REMAINING_MATCHES="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
  "SELECT count(*) FROM public.matches WHERE tournament_id = '$T_CASCADE';")"
REMAINING_EVENTS="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
  "SELECT count(*) FROM public.match_events WHERE id IN ('$E_CASCADE_1','$E_CASCADE_2');")"
check "5b. Kaskade hat matches von T_CASCADE tatsaechlich entfernt" "0" "$REMAINING_MATCHES"
check "5c. Kaskade hat match_events tatsaechlich entfernt" "0" "$REMAINING_EVENTS"

echo "" >&2
if [[ "$MISMATCHES" -gt 0 ]]; then
  echo "::error::$MISMATCHES Abweichung(en) von der erwarteten Rollentabelle." >&2
  exit 1
fi
echo "Alle Proben wie erwartet." >&2
exit 0
