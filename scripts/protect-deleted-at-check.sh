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
# Was gemessen wird (sofern nicht anders vermerkt als Turnierleitung = authenticated, Besitzer):
#   (a) Turnier mit nur geplanten Spielen: deleted_at setzen           -> muss ERLAUBT sein.
#   (b) Turnier mit einem laufenden Spiel: deleted_at setzen           -> muss ABGELEHNT werden.
#   (c) Turnier mit einem pausierten Spiel: deleted_at setzen          -> muss ABGELEHNT werden.
#   (d) Turnier mit einem beendeten Spiel: deleted_at setzen           -> muss ABGELEHNT werden.
#   (e) Turnier, dessen Spiel geplant ist, aber schon match_events hat:
#       deleted_at setzen                                              -> muss ABGELEHNT werden.
#   (f) hartes DELETE FROM tournaments bei laufendem Spiel             -> muss ABGELEHNT werden
#       (die Policy tournaments_delete_v2 erlaubt dem Eigentuemer DELETE, die Sperre muss
#        deshalb als BEFORE-DELETE-Trigger greifen).
#   (f2) hartes DELETE bei pausiertem Spiel                            -> muss ABGELEHNT werden.
#   (f3) hartes DELETE bei beendetem Spiel                             -> muss ABGELEHNT werden.
#   (f4) hartes DELETE bei geplantem Spiel MIT Ereignis                -> muss ABGELEHNT werden
#        (E1/E6: dasselbe Kriterium wie auf dem Soft-Delete-Pfad -- tournament_has_started).
#   (f5) hartes DELETE eines Turniers nur mit geplanten Spielen OHNE Ereignisse
#        (eigene Fixture)                                              -> muss ERLAUBT sein,
#        Zustand danach pruefen (Turnier und Spiele tatsaechlich weg).
#   (g) deleted_at wieder auf NULL setzen (Wiederherstellen, eigene Fixture mit
#       vorbelegtem deleted_at)                                        -> muss ERLAUBT bleiben.
#   (h) Besitzer loescht DIREKT eine match_events-Alt-Zeile            -> muss ABGELEHNT werden
#       (E2/VR2: die Ereignisse belegen den Anpfiff, @SL-129 -- die Ablehnung muss vom
#        Trigger "Ereignis" kommen, nicht von einer RLS-Ablehnung).
#   (h2) danach Status-Reset plus Soft-Delete von T_EVENTS in einer Transaktion
#       (Spiel wieder auf 'scheduled', dann deleted_at setzen)          -> muss WEITER
#       ABGELEHNT werden (Meldung tournament_started): das Ereignis ist der dauerhafte
#       Beleg und ueberlebt den Status-Reset.
#   (i) als Wartungsrolle postgres: DELETE eines angepfiffenen Turniers MIT Ereignissen
#       -> muss ERLAUBT sein (E3), die Kaskade entfernt matches und match_events
#       (Zaehlung 0 je).
#   (k) Co-Admin setzt deleted_at an einem geplanten Turnier           -> muss ABGELEHNT
#       werden mit "Nicht erlaubt" (insufficient_privilege), NICHT mit tournament_started
#       (E4: die Rechtepruefung Block 1 muss greifen).
#   (l) Besitzer aendert den Titel eines angepfiffenen Turniers, deleted_at bleibt
#       unveraendert NULL                                               -> muss ERLAUBT sein
#       (die App schickt deleted_at bei jedem save() mit).
#
# Ausgabe je Fall: "OK <Fall>" oder "ABWEICHUNG <Fall>"; Exit != 0 bei jeder Abweichung.
# Laeuft das Skript OHNE die Migration 20261004_101 (Stand vor Paket b), muessen die
# Faelle (b)-(f), (f2)-(f4), (h) und (h2) als ABWEICHUNG erscheinen — genau das ist der
# ROT-Zustand.
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
  echo "::warn::20261004_101_protect_deleted_at.sql nicht in der Liste 'neuer als Baseline' — Lauf gegen den Stand ohne Sperre (Faelle (b)-(f), (f2)-(f4), (h), (h2) muessen dann ABWEICHUNG zeigen)." >&2
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
U_COADMIN="$(uuid_for user:coadmin)"
T_PLANNED="$(uuid_for tournament:planned)"
T_RUNNING="$(uuid_for tournament:running)"
T_PAUSED="$(uuid_for tournament:paused)"
T_FINISHED="$(uuid_for tournament:finished)"
T_EVENTS="$(uuid_for tournament:events)"
T_RESTORE="$(uuid_for tournament:restore)"
T_PLAIN="$(uuid_for tournament:plain-delete)"
T_MAINT="$(uuid_for tournament:maintenance)"
T_K="$(uuid_for tournament:coadmin)"
M_PLANNED="$(uuid_for match:planned)"
M_RUNNING="$(uuid_for match:running)"
M_PAUSED="$(uuid_for match:paused)"
M_FINISHED="$(uuid_for match:finished)"
M_EVENTS="$(uuid_for match:events)"
M_PLAIN="$(uuid_for match:plain-delete)"
M_MAINT="$(uuid_for match:maintenance)"
M_K="$(uuid_for match:coadmin)"
E_EVENTS="$(uuid_for event:on-planned)"
E_MAINT="$(uuid_for event:on-maintenance)"

echo "Fixtures anlegen..." >&2
psql_stdin <<SQL
BEGIN;

INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '$U_OWNER', 'authenticated', 'authenticated', 'owner@protect-deleted-at.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_COADMIN', 'authenticated', 'authenticated', 'coadmin@protect-deleted-at.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config, deleted_at)
VALUES
  ('$T_PLANNED', '$U_OWNER', 'Protect deleted_at — nur geplant', '2026-10-04', 8, 15, '{}'::jsonb, NULL),
  ('$T_RUNNING', '$U_OWNER', 'Protect deleted_at — laufend', '2026-10-04', 8, 15, '{}'::jsonb, NULL),
  ('$T_PAUSED', '$U_OWNER', 'Protect deleted_at — pausiert', '2026-10-04', 8, 15, '{}'::jsonb, NULL),
  ('$T_FINISHED', '$U_OWNER', 'Protect deleted_at — beendet', '2026-10-04', 8, 15, '{}'::jsonb, NULL),
  ('$T_EVENTS', '$U_OWNER', 'Protect deleted_at — Ereignisse', '2026-10-04', 8, 15, '{}'::jsonb, NULL),
  ('$T_RESTORE', '$U_OWNER', 'Protect deleted_at — Papierkorb', '2026-10-04', 8, 15, '{}'::jsonb, now()),
  ('$T_PLAIN', '$U_OWNER', 'Protect deleted_at — hart loeschbar', '2026-10-04', 8, 15, '{}'::jsonb, NULL),
  ('$T_MAINT', '$U_OWNER', 'Protect deleted_at — Wartung', '2026-10-04', 8, 15, '{}'::jsonb, NULL),
  ('$T_K', '$U_OWNER', 'Protect deleted_at — Co-Admin', '2026-10-04', 8, 15, '{}'::jsonb, NULL);

INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at)
VALUES
  ('$(uuid_for membership:coadmin-k)', '$T_K', '$U_COADMIN', 'co-admin', now());

INSERT INTO public.matches (id, tournament_id, round, field, match_status)
VALUES
  ('$M_PLANNED', '$T_PLANNED', 1, 1, 'scheduled'),
  ('$M_RUNNING', '$T_RUNNING', 1, 1, 'running'),
  ('$M_PAUSED', '$T_PAUSED', 1, 1, 'paused'),
  ('$M_FINISHED', '$T_FINISHED', 1, 1, 'finished'),
  ('$M_EVENTS', '$T_EVENTS', 1, 1, 'scheduled'),
  ('$M_PLAIN', '$T_PLAIN', 1, 1, 'scheduled'),
  ('$M_MAINT', '$T_MAINT', 1, 1, 'scheduled'),
  ('$M_K', '$T_K', 1, 1, 'scheduled');

INSERT INTO public.match_events (id, match_id, owner_id, type, timestamp_seconds, score_home, score_away)
VALUES
  ('$E_EVENTS', '$M_EVENTS', '$U_OWNER', 'GOAL', 10, 1, 0),
  ('$E_MAINT', '$M_MAINT', '$U_OWNER', 'GOAL', 10, 1, 0);

COMMIT;
SQL

# run_write(): eigene Transaktion je Probe mit echter RLS-Rolle + JWT-Claim. Zwei Ausgaenge
# (nie per Kommando-Substitution aufrufen, siehe Kommentar in protect-matches-with-events-check.sh):
#   LAST_WRITE_OUTPUT — volle psql-Ausgabe inkl. Fehlertext
#   LAST_WRITE_RESULT — "allowed" | "denied" (psql-Befehls-Tag "UPDATE 1"/"DELETE 1" = durchgelassen)
# p_commit=1 fuehrt COMMIT aus (fuer (a)/(f5)/(g)/(l): der Zustand soll danach wirklich stehen);
# p_commit=0 laesst die Transaktion offen (Rollback beim Verbindungs-Ende), damit eine falsch
# erlaubte Sperre-Probe nichts zerstoert.
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
check "(a) Turnier mit nur geplanten Spielen: deleted_at setzen erlaubt @LZ-090 „Aber ein Turnier, in dem noch kein Spiel angepfiffen wurde, lässt sich löschen“" "allowed" "$A_RESULT"

# (b) laufend: abgelehnt. Fehlertext muss die Sperre-Meldung 'tournament_started' tragen,
# nicht eine zufaellige RLS- oder Fremdschluessel-Ablehnung.
run_write "$U_OWNER" "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_RUNNING';" 0
B_RESULT="$LAST_WRITE_RESULT"
if [[ "$B_RESULT" == "denied" ]]; then
  B_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && B_REASON="sperre"
  check "(b) Turnier mit laufendem Spiel: deleted_at setzen abgelehnt (Meldung tournament_started) @LZ-090 „Tom hat das erste Gruppenspiel angepfiffen“" "sperre" "$B_REASON"
else
  check "(b) Turnier mit laufendem Spiel: deleted_at setzen abgelehnt @LZ-090 „Tom hat das erste Gruppenspiel angepfiffen“" "denied" "$B_RESULT"
fi

# (c) pausiert: abgelehnt.
run_write "$U_OWNER" "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_PAUSED';" 0
C_RESULT="$LAST_WRITE_RESULT"
if [[ "$C_RESULT" == "denied" ]]; then
  C_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && C_REASON="sperre"
  check "(c) Turnier mit pausiertem Spiel: deleted_at setzen abgelehnt (Meldung tournament_started) @LZ-090 „Tom hat das erste Gruppenspiel angepfiffen“" "sperre" "$C_REASON"
else
  check "(c) Turnier mit pausiertem Spiel: deleted_at setzen abgelehnt @LZ-090 „Tom hat das erste Gruppenspiel angepfiffen“" "denied" "$C_RESULT"
fi

# (d) beendet: abgelehnt.
run_write "$U_OWNER" "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_FINISHED';" 0
D_RESULT="$LAST_WRITE_RESULT"
if [[ "$D_RESULT" == "denied" ]]; then
  D_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && D_REASON="sperre"
  check "(d) Turnier mit beendetem Spiel: deleted_at setzen abgelehnt (Meldung tournament_started) @LZ-090 „das erste Gruppenspiel ist beendet“" "sperre" "$D_REASON"
else
  check "(d) Turnier mit beendetem Spiel: deleted_at setzen abgelehnt @LZ-090 „das erste Gruppenspiel ist beendet“" "denied" "$D_RESULT"
fi

# (e) Spiel geplant, aber match_events vorhanden: abgelehnt.
run_write "$U_OWNER" "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_EVENTS';" 0
E_RESULT="$LAST_WRITE_RESULT"
if [[ "$E_RESULT" == "denied" ]]; then
  E_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && E_REASON="sperre"
  check "(e) Turnier mit Ereignissen trotz geplantem Spiel: deleted_at setzen abgelehnt (Meldung tournament_started) @LZ-090 „Olli hat den Spielplan zurückgesetzt, die Ereignisse sind erhalten“" "sperre" "$E_REASON"
else
  check "(e) Turnier mit Ereignissen trotz geplantem Spiel: deleted_at setzen abgelehnt @LZ-090 „Olli hat den Spielplan zurückgesetzt, die Ereignisse sind erhalten“" "denied" "$E_RESULT"
fi

# (f) hartes DELETE bei laufendem Spiel: die Policy tournaments_delete_v2 erlaubt dem Eigentuemer
# DELETE — ohne BEFORE-DELETE-Trigger waere das hier "allowed" (rot). Ohne COMMIT, damit ein
# faelschliches Durchgehen die Fixtures nicht zerstoert.
run_write "$U_OWNER" "DELETE FROM public.tournaments WHERE id = '$T_RUNNING';" 0
F_RESULT="$LAST_WRITE_RESULT"
if [[ "$F_RESULT" == "denied" ]]; then
  F_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && F_REASON="sperre"
  check "(f) hartes DELETE bei laufendem Spiel abgelehnt (Meldung tournament_started) @LZ-090 „Tom hat das erste Gruppenspiel angepfiffen“" "sperre" "$F_REASON"
else
  check "(f) hartes DELETE bei laufendem Spiel abgelehnt @LZ-090 „Tom hat das erste Gruppenspiel angepfiffen“" "denied" "$F_RESULT"
fi

# (f2) hartes DELETE bei pausiertem Spiel: abgelehnt (Status-Kern des Kriteriums).
run_write "$U_OWNER" "DELETE FROM public.tournaments WHERE id = '$T_PAUSED';" 0
F2_RESULT="$LAST_WRITE_RESULT"
if [[ "$F2_RESULT" == "denied" ]]; then
  F2_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && F2_REASON="sperre"
  check "(f2) hartes DELETE bei pausiertem Spiel abgelehnt (Meldung tournament_started) @LZ-090 „Tom hat das erste Gruppenspiel angepfiffen“" "sperre" "$F2_REASON"
else
  check "(f2) hartes DELETE bei pausiertem Spiel abgelehnt @LZ-090 „Tom hat das erste Gruppenspiel angepfiffen“" "denied" "$F2_RESULT"
fi

# (f3) hartes DELETE bei beendetem Spiel: abgelehnt.
run_write "$U_OWNER" "DELETE FROM public.tournaments WHERE id = '$T_FINISHED';" 0
F3_RESULT="$LAST_WRITE_RESULT"
if [[ "$F3_RESULT" == "denied" ]]; then
  F3_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && F3_REASON="sperre"
  check "(f3) hartes DELETE bei beendetem Spiel abgelehnt (Meldung tournament_started) @LZ-090 „das erste Gruppenspiel ist beendet“" "sperre" "$F3_REASON"
else
  check "(f3) hartes DELETE bei beendetem Spiel abgelehnt @LZ-090 „das erste Gruppenspiel ist beendet“" "denied" "$F3_RESULT"
fi

# (f4) hartes DELETE bei geplantem Spiel MIT Ereignis: abgelehnt -- E1/E6, der Hard-Delete-Pfad
# zaehlt dasselbe wie der Soft-Delete-Pfad (tournament_has_started: Status ODER Ereignisse).
run_write "$U_OWNER" "DELETE FROM public.tournaments WHERE id = '$T_EVENTS';" 0
F4_RESULT="$LAST_WRITE_RESULT"
if [[ "$F4_RESULT" == "denied" ]]; then
  F4_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && F4_REASON="sperre"
  check "(f4) hartes DELETE bei geplantem Spiel MIT Ereignis abgelehnt (Meldung tournament_started) @LZ-090 „Olli hat den Spielplan zurückgesetzt, die Ereignisse sind erhalten“" "sperre" "$F4_REASON"
else
  check "(f4) hartes DELETE bei geplantem Spiel MIT Ereignis abgelehnt @LZ-090 „Olli hat den Spielplan zurückgesetzt, die Ereignisse sind erhalten“" "denied" "$F4_RESULT"
fi

# (f5) hartes DELETE eines Turniers nur mit geplanten Spielen OHNE Ereignisse (eigene Fixture):
# erlaubt — und der Zustand danach muss stimmen (Turnier und Kaskade-Spiele weg).
run_write "$U_OWNER" "DELETE FROM public.tournaments WHERE id = '$T_PLAIN';" 1
F5_RESULT="$LAST_WRITE_RESULT"
if [[ "$F5_RESULT" == "allowed" ]]; then
  F5_STATE="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
    "SELECT (SELECT count(*) FROM public.tournaments WHERE id = '$T_PLAIN') + (SELECT count(*) FROM public.matches WHERE tournament_id = '$T_PLAIN');")"
  LAST_WRITE_OUTPUT="$LAST_WRITE_OUTPUT
[Statusabfrage Turnier+Spiele nach Kaskade: $F5_STATE]"
  [[ "$F5_STATE" == "0" ]] || F5_RESULT="denied"
fi
check "(f5) hartes DELETE bei nur geplanten Spielen ohne Ereignisse erlaubt (Kaskade entfernt Turnier und Spiele) @LZ-090 „Aber ein Turnier, in dem noch kein Spiel angepfiffen wurde, lässt sich löschen“" "allowed" "$F5_RESULT"

# (g) Wiederherstellen: eigene Fixture mit VORBELEGTEM deleted_at (haengt nicht an (a)).
# deleted_at zurueck auf NULL bleibt erlaubt.
run_write "$U_OWNER" "UPDATE public.tournaments SET deleted_at = NULL WHERE id = '$T_RESTORE';" 1
G_RESULT="$LAST_WRITE_RESULT"
if [[ "$G_RESULT" == "allowed" ]]; then
  G_STATE="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
    "SELECT count(*) FROM public.tournaments WHERE id = '$T_RESTORE' AND deleted_at IS NULL;")"
  LAST_WRITE_OUTPUT="$LAST_WRITE_OUTPUT
[Statusabfrage deleted_at wieder NULL: $G_STATE]"
  [[ "$G_STATE" == "1" ]] || G_RESULT="denied"
fi
check "(g) deleted_at wieder auf NULL setzen (Wiederherstellen, eigene Fixture) erlaubt @LZ-090 „Und ein Turnier im Papierkorb lässt sich weiterhin wiederherstellen“" "allowed" "$G_RESULT"

# (h) Besitzer loescht DIREKT eine match_events-Alt-Zeile: abgelehnt. Die Ablehnung muss vom
# TRIGGER kommen (Fehlertext "Ereignis"), nicht von einer RLS-Ablehnung — die delete-Policy
# match_events_delete_v2 erlaubt dem Eigentuemer (owner_id) das Loeschen, ohne den Trigger
# waere das hier "allowed" (rot). Ohne COMMIT.
run_write "$U_OWNER" "DELETE FROM public.match_events WHERE id = '$E_EVENTS';" 0
H_RESULT="$LAST_WRITE_RESULT"
if [[ "$H_RESULT" == "denied" ]]; then
  H_REASON="fail"
  grep -q "Ereignis" <<<"$LAST_WRITE_OUTPUT" && H_REASON="trigger"
  check "(h) Besitzer loescht match_events-Alt-Zeile direkt: abgelehnt (Meldung Ereignis) @LZ-090 „Olli hat den Spielplan zurückgesetzt, die Ereignisse sind erhalten“" "trigger" "$H_REASON"
else
  check "(h) Besitzer loescht match_events-Alt-Zeile direkt: abgelehnt @LZ-090 „Olli hat den Spielplan zurückgesetzt, die Ereignisse sind erhalten“" "denied" "$H_RESULT"
fi

# (h2) Status-Reset plus Soft-Delete von T_EVENTS in einer Transaktion: weiter abgelehnt.
# Das Ereignis aus (h) ist geblieben (die Probe war abgelehnt) und belegt den Anpfiff auch
# dann, wenn der Besitzer den Spielstatus zuruecksetzt (@SL-129).
run_write "$U_OWNER" "UPDATE public.matches SET match_status = 'scheduled' WHERE id = '$M_EVENTS';
UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_EVENTS';" 0
H2_RESULT="$LAST_WRITE_RESULT"
if [[ "$H2_RESULT" == "denied" ]]; then
  H2_REASON="fail"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && H2_REASON="sperre"
  check "(h2) nach Status-Reset: Soft-Delete von T_EVENTS weiter abgelehnt (Meldung tournament_started) @LZ-090 „Olli hat den Spielplan zurückgesetzt, die Ereignisse sind erhalten“" "sperre" "$H2_REASON"
else
  check "(h2) nach Status-Reset: Soft-Delete von T_EVENTS weiter abgelehnt @LZ-090 „Olli hat den Spielplan zurückgesetzt, die Ereignisse sind erhalten“" "denied" "$H2_RESULT"
fi

# (i) Wartungsrolle postgres: DELETE eines angepfiffenen Turniers MIT Ereignissen muss erlaubt
# bleiben (E3 -- Seed, Konto-Loeschung, Admin). Mit COMMIT, damit die Zaehlung der Kaskade
# (5b/5c-Muster) in einer neuen Verbindung nachgelesen werden kann. Der einzige Schreibzugriff
# dieses Skripts, der tatsaechlich committet wird (Wegwerf-Container).
set +e
I_OUT="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
DELETE FROM public.tournaments WHERE id = '$T_MAINT';
COMMIT;
SQL
)"
I_EC=$?
set -e
LAST_WRITE_OUTPUT="$I_OUT"
if [[ $I_EC -ne 0 ]]; then
  I_RESULT="denied"
else
  grep -qE '^DELETE [1-9][0-9]*$' <<<"$I_OUT" && I_RESULT="allowed" || I_RESULT="denied"
fi
if [[ "$I_RESULT" == "allowed" ]]; then
  I_MATCHES="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
    "SELECT count(*) FROM public.matches WHERE tournament_id = '$T_MAINT';")"
  I_EVENTS="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
    "SELECT count(*) FROM public.match_events WHERE id = '$E_MAINT';")"
  LAST_WRITE_OUTPUT="$I_OUT
[Kaskade matches: $I_MATCHES, match_events: $I_EVENTS]"
  [[ "$I_MATCHES" == "0" && "$I_EVENTS" == "0" ]] || I_RESULT="denied"
fi
check "(i) postgres loescht angepfiffenes Turnier mit Ereignissen: erlaubt, Kaskade entfernt matches und match_events" "allowed" "$I_RESULT"

# (k) Co-Admin setzt deleted_at an einem geplanten Turnier: abgelehnt mit "Nicht erlaubt"
# (insufficient_privilege aus Block 1), NICHT mit tournament_started -- das Turnier ist geplant,
# die Rechtepruefung ist der einzige Grund fuer die Ablehnung (E4).
run_write "$U_COADMIN" "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_K';" 0
K_RESULT="$LAST_WRITE_RESULT"
if [[ "$K_RESULT" == "denied" ]]; then
  K_REASON="fail"
  grep -q "Nicht erlaubt" <<<"$LAST_WRITE_OUTPUT" && K_REASON="recht"
  grep -q "tournament_started" <<<"$LAST_WRITE_OUTPUT" && K_REASON="sperre"
  check "(k) Co-Admin setzt deleted_at an geplantem Turnier: abgelehnt mit Nicht erlaubt (Rechtepruefung)" "recht" "$K_REASON"
else
  check "(k) Co-Admin setzt deleted_at an geplantem Turnier: abgelehnt" "denied" "$K_RESULT"
fi

# (l) Besitzer aendert den Titel eines angepfiffenen Turniers (laufendes Spiel), deleted_at
# bleibt unveraendert NULL (die App schickt deleted_at bei jedem save() mit): erlaubt.
run_write "$U_OWNER" "UPDATE public.tournaments SET title = 'Protect deleted_at — Titel geaendert', deleted_at = NULL WHERE id = '$T_RUNNING';" 1
L_RESULT="$LAST_WRITE_RESULT"
if [[ "$L_RESULT" == "allowed" ]]; then
  L_STATE="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
    "SELECT count(*) FROM public.tournaments WHERE id = '$T_RUNNING' AND deleted_at IS NULL AND title = 'Protect deleted_at — Titel geaendert';")"
  LAST_WRITE_OUTPUT="$LAST_WRITE_OUTPUT
[Statusabfrage Titel geaendert, deleted_at NULL: $L_STATE]"
  [[ "$L_STATE" == "1" ]] || L_RESULT="denied"
fi
check "(l) Titel-Aenderung an angepfiffenem Turnier mit unveraendertem deleted_at=NULL erlaubt" "allowed" "$L_RESULT"

echo "" >&2
if [[ "$MISMATCHES" -gt 0 ]]; then
  echo "::error::$MISMATCHES Abweichung(en) von der erwarteten Sperre-Tabelle." >&2
  exit 1
fi
echo "Alle Proben wie erwartet." >&2
exit 0
