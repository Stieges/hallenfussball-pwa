#!/usr/bin/env bash
#
# protect-deleted-at-check.sh — Container-Beweis fuer die Server-Sperre
# "Turnier nach dem ersten Anpfiff nicht loeschbar" (B-01 Paket b, @LZ-003,
# supabase/migrations/20261004_101_protect_deleted_at.sql).
#
# Nach dem Muster von scripts/protect-matches-with-events-check.sh (Wegwerf-Container,
# Baseline plus neuere Migrationen ueber scripts/lib/migrations-since-baseline.sh,
# `SET LOCAL ROLE authenticated` + `request.jwt.claim.sub`, eigene Transaktion je Probe).
# Dasselbe Wartemuster wie dort: zweimal "database system is ready to accept connections".
#
# Was gemessen wird (jeweils als Turnierleitung = authenticated, Besitzer):
#   (a) Turnier mit nur geplanten Spielen: deleted_at setzen           -> muss ERLAUBT sein.
#   (b) Turnier mit einem laufenden Spiel: deleted_at setzen           -> muss ABGELEHNT werden.
#   (c) Turnier mit einem pausierten Spiel: deleted_at setzen          -> muss ABGELEHNT werden.
#   (d) Turnier mit einem beendeten Spiel: deleted_at setzen           -> muss ABGELEHNT werden.
#   (e) Turnier, dessen Spiel geplant ist, aber schon match_events hat:
#       deleted_at setzen                                              -> muss ABGELEHNT werden.
#   (f) hartes DELETE FROM tournaments im Fall (b)                      -> muss ABGELEHNT werden
#       (die Policy tournaments_delete_v2 erlaubt dem Eigentuemer DELETE, die Sperre muss
#        deshalb als BEFORE-DELETE-Trigger greifen).
#   (g) deleted_at wieder auf NULL setzen (Wiederherstellen)           -> muss ERLAUBT bleiben.
#
# Ausgabe je Fall: "OK <Fall>" oder "ABWEICHUNG <Fall>"; Exit != 0 bei jeder Abweichung.
# Laeuft das Skript OHNE die Migration 20261004_101 (Stand vor Paket b), muessen die
# Faelle (b)-(f) als ABWEICHUNG erscheinen — genau das ist der ROT-Zustand.
#
# Aendert NICHTS an der Produktionsdatenbank — Wegwerf-Container, wird am Ende entfernt (trap).
# Der laufende lokale Supabase-Stack wird nicht angeruehrt.
#
set -euo pipefail

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # muss zur Live-Postgres-Version passen (wie rls-role-matrix.sh)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
CONTAINER_NAME="protect-deleted-at-check-$$"

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
# bash 3.2 (macOS-Standard) kennt kein mapfile — portable while-read-Schleife, wie
# protect-matches-with-events-check.sh es an derselben Stelle macht.
NEWER_MIGRATIONS_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
NEWER_MIGRATIONS=()
if [[ -n "$NEWER_MIGRATIONS_RAW" ]]; then
  while IFS= read -r line; do
    NEWER_MIGRATIONS+=("$line")
  done <<< "$NEWER_MIGRATIONS_RAW"
fi

# Die Sperre-Migration sollte unter den "neuer als Baseline"-Dateien auftauchen. Fehlt sie
# (bewusst: Lauf gegen den Stand VOR Paket b), wird nur gewarnt — die Proben laufen trotzdem,
# damit die roten Faelle sichtbar werden. Ein hartes Abbruch hier wuerde den Rot-Zustand
# verschlucken.
FOUND_B01B=0
for f in "${NEWER_MIGRATIONS[@]}"; do
  [[ "$(basename "$f")" == 20261004_101_protect_deleted_at.sql ]] && FOUND_B01B=1
done
if [[ "$FOUND_B01B" -ne 1 ]]; then
  echo "::warn::20261004_101_protect_deleted_at.sql nicht in der Liste 'neuer als Baseline' — Lauf gegen den Stand ohne Sperre (Faelle (b)-(f) muessen dann ABWEICHUNG zeigen)." >&2
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

uuid_for() {
  local h
  h="$(printf '%s' "protect-deleted-at-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-${h:12:4}-${h:16:4}-${h:20:12}"
}

U_OWNER="$(uuid_for user:owner)"
T_PLANNED="$(uuid_for tournament:planned)"
T_RUNNING="$(uuid_for tournament:running)"
T_PAUSED="$(uuid_for tournament:paused)"
T_FINISHED="$(uuid_for tournament:finished)"
T_EVENTS="$(uuid_for tournament:events)"
M_PLANNED="$(uuid_for match:planned)"
M_RUNNING="$(uuid_for match:running)"
M_PAUSED="$(uuid_for match:paused)"
M_FINISHED="$(uuid_for match:finished)"
M_EVENTS="$(uuid_for match:events)"
E_EVENTS="$(uuid_for event:on-planned)"

echo "Fixtures anlegen..." >&2
psql_stdin <<SQL
BEGIN;

INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '$U_OWNER', 'authenticated', 'authenticated', 'owner@protect-deleted-at.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES
  ('$T_PLANNED', '$U_OWNER', 'Protect deleted_at — nur geplant', '2026-10-04', 8, 15, '{}'::jsonb),
  ('$T_RUNNING', '$U_OWNER', 'Protect deleted_at — laufend', '2026-10-04', 8, 15, '{}'::jsonb),
  ('$T_PAUSED', '$U_OWNER', 'Protect deleted_at — pausiert', '2026-10-04', 8, 15, '{}'::jsonb),
  ('$T_FINISHED', '$U_OWNER', 'Protect deleted_at — beendet', '2026-10-04', 8, 15, '{}'::jsonb),
  ('$T_EVENTS', '$U_OWNER', 'Protect deleted_at — Ereignisse', '2026-10-04', 8, 15, '{}'::jsonb);

INSERT INTO public.matches (id, tournament_id, round, field, match_status)
VALUES
  ('$M_PLANNED', '$T_PLANNED', 1, 1, 'scheduled'),
  ('$M_RUNNING', '$T_RUNNING', 1, 1, 'running'),
  ('$M_PAUSED', '$T_PAUSED', 1, 1, 'paused'),
  ('$M_FINISHED', '$T_FINISHED', 1, 1, 'finished'),
  ('$M_EVENTS', '$T_EVENTS', 1, 1, 'scheduled');

INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away)
VALUES
  ('$E_EVENTS', '$M_EVENTS', 'GOAL', 10, 1, 0);

COMMIT;
SQL

# run_write(): eigene Transaktion je Probe mit echter RLS-Rolle + JWT-Claim. Zwei Ausgaenge
# (nie per Kommando-Substitution aufrufen, siehe Kommentar in protect-matches-with-events-check.sh):
#   LAST_WRITE_OUTPUT — volle psql-Ausgabe inkl. Fehlertext
#   LAST_WRITE_RESULT — "allowed" | "denied" (psql-Befehls-Tag "UPDATE 1"/"DELETE 1" = durchgelassen)
# p_commit=1 fuehrt COMMIT aus (fuer (a)/(g): der Zustand deleted_at soll danach wirklich stehen);
# p_commit=0 laesst die Transaktion offen (Rollback beim Verbindungs-Ende), damit (f) nichts
# zerstoert, falls es faelschlich durchgeht.
LAST_WRITE_OUTPUT=""
LAST_WRITE_RESULT=""
run_write() {
  local user_id="$1" sql="$2" p_commit="$3"
  local out ec commit_line="COMMIT;"
  [[ "$p_commit" == "0" ]] && commit_line=""
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$user_id';
$sql
$commit_line
SQL
)"
  ec=$?
  set -e
  LAST_WRITE_OUTPUT="$out"
  if [[ $ec -ne 0 ]]; then
    LAST_WRITE_RESULT="denied"
  elif grep -qE '^(UPDATE|DELETE) [1-9][0-9]*$' <<<"$out"; then
    LAST_WRITE_RESULT="allowed"
  else
    LAST_WRITE_RESULT="denied"
  fi
}

MISMATCHES=0
check() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "OK $label" >&2
  else
    echo "ABWEICHUNG $label (erwartet $expected, gemessen $actual)" >&2
    if [[ -n "$LAST_WRITE_OUTPUT" ]]; then
      sed 's/^/    | /' <<<"$LAST_WRITE_OUTPUT" >&2
    fi
    MISMATCHES=$((MISMATCHES + 1))
  fi
}

echo "Proben laufen..." >&2

# (a) nur geplant: deleted_at setzen muss durchgehen — Ergebnis nur "allowed", wenn der
# Zustand danach tatsaechlich gesetzt ist (Gegenprobe gegen "UPDATE 1"-Tag ohne Wirkung).
run_write "$U_OWNER" "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_PLANNED';" 1
A_RESULT="$LAST_WRITE_RESULT"
if [[ "$A_RESULT" == "allowed" ]]; then
  A_STATE="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
    "SELECT count(*) FROM public.tournaments WHERE id = '$T_PLANNED' AND deleted_at IS NOT NULL;")"
  LAST_WRITE_OUTPUT="$LAST_WRITE_OUTPUT
[Statusabfrage deleted_at gesetzt: $A_STATE]"
  [[ "$A_STATE" == "1" ]] || A_RESULT="denied"
fi
check "(a) Turnier mit nur geplanten Spielen: deleted_at setzen erlaubt" "allowed" "$A_RESULT"

# (b) laufend: abgelehnt. Fehlertext muss die Sperre-Meldung 'tournament_started' tragen,
# nicht eine zufaellige RLS- oder Fremdschluessel-Ablehnung.
run_write "$U_OWNER" "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_RUNNING';" 1
B_RESULT="$LAST_WRITE_RESULT"
if [[ "$B_RESULT" == "denied" ]]; then
  B_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && B_REASON="sperre"
  check "(b) Turnier mit laufendem Spiel: deleted_at setzen abgelehnt (Meldung tournament_started)" "sperre" "$B_REASON"
else
  check "(b) Turnier mit laufendem Spiel: deleted_at setzen abgelehnt" "denied" "$B_RESULT"
fi

# (c) pausiert: abgelehnt.
run_write "$U_OWNER" "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_PAUSED';" 1
C_RESULT="$LAST_WRITE_RESULT"
if [[ "$C_RESULT" == "denied" ]]; then
  C_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && C_REASON="sperre"
  check "(c) Turnier mit pausiertem Spiel: deleted_at setzen abgelehnt (Meldung tournament_started)" "sperre" "$C_REASON"
else
  check "(c) Turnier mit pausiertem Spiel: deleted_at setzen abgelehnt" "denied" "$C_RESULT"
fi

# (d) beendet: abgelehnt.
run_write "$U_OWNER" "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_FINISHED';" 1
D_RESULT="$LAST_WRITE_RESULT"
if [[ "$D_RESULT" == "denied" ]]; then
  D_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && D_REASON="sperre"
  check "(d) Turnier mit beendetem Spiel: deleted_at setzen abgelehnt (Meldung tournament_started)" "sperre" "$D_REASON"
else
  check "(d) Turnier mit beendetem Spiel: deleted_at setzen abgelehnt" "denied" "$D_RESULT"
fi

# (e) Spiel geplant, aber match_events vorhanden: abgelehnt.
run_write "$U_OWNER" "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_EVENTS';" 1
E_RESULT="$LAST_WRITE_RESULT"
if [[ "$E_RESULT" == "denied" ]]; then
  E_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && E_REASON="sperre"
  check "(e) Turnier mit Ereignissen trotz geplantem Spiel: deleted_at setzen abgelehnt (Meldung tournament_started)" "sperre" "$E_REASON"
else
  check "(e) Turnier mit Ereignissen trotz geplantem Spiel: deleted_at setzen abgelehnt" "denied" "$E_RESULT"
fi

# (f) hartes DELETE im Fall (b): die Policy tournaments_delete_v2 erlaubt dem Eigentuemer
# DELETE — ohne BEFORE-DELETE-Trigger waere das hier "allowed" (rot). Ohne COMMIT, damit ein
# faelschliches Durchgehen die Fixtures nicht zerstoert.
run_write "$U_OWNER" "DELETE FROM public.tournaments WHERE id = '$T_RUNNING';" 0
F_RESULT="$LAST_WRITE_RESULT"
if [[ "$F_RESULT" == "denied" ]]; then
  F_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && F_REASON="sperre"
  check "(f) hartes DELETE bei laufendem Spiel abgelehnt (Meldung tournament_started)" "sperre" "$F_REASON"
else
  check "(f) hartes DELETE bei laufendem Spiel abgelehnt" "denied" "$F_RESULT"
fi

# (g) Wiederherstellen: deleted_at zurueck auf NULL bleibt erlaubt (Fall (a) hat es gesetzt).
run_write "$U_OWNER" "UPDATE public.tournaments SET deleted_at = NULL WHERE id = '$T_PLANNED';" 1
G_RESULT="$LAST_WRITE_RESULT"
if [[ "$G_RESULT" == "allowed" ]]; then
  G_STATE="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
    "SELECT count(*) FROM public.tournaments WHERE id = '$T_PLANNED' AND deleted_at IS NULL;")"
  LAST_WRITE_OUTPUT="$LAST_WRITE_OUTPUT
[Statusabfrage deleted_at wieder NULL: $G_STATE]"
  [[ "$G_STATE" == "1" ]] || G_RESULT="denied"
fi
check "(g) deleted_at wieder auf NULL setzen (Wiederherstellen) erlaubt" "allowed" "$G_RESULT"

echo "" >&2
if [[ "$MISMATCHES" -gt 0 ]]; then
  echo "::error::$MISMATCHES Abweichung(en) von der erwarteten Sperre-Tabelle." >&2
  exit 1
fi
echo "Alle Proben wie erwartet." >&2
exit 0