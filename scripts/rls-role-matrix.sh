#!/usr/bin/env bash
#
# rls-role-matrix.sh — Misst die Schreibrechte-Matrix aus roleMatrix.json gegen eine echte
# Postgres-Instanz mit aktivem RLS. Dauerhafte Absicherung für die Rollentabelle aus
# .superpowers/sdd/2026-09-22-rechte-und-cockpit-2/task-R1-brief.md — kein Wegwerf-Skript.
#
# Was gemessen wird (nicht behauptet): Für jede Zeile aus
# src/features/auth/__tests__/roleMatrix.json (der EINEN Quelle, gemeinsam mit dem
# Vitest-Folgetask genutzt) wird ein echter auth.users-Eintrag angelegt, ggf. eine
# tournament_collaborators-Zeile mit passender Rolle — und dann unter
# `SET LOCAL ROLE authenticated` (bzw. `anon`) mit passendem `request.jwt.claim.sub` jeder
# Schreibzugriff versucht: matches UPDATE, match_events INSERT/UPDATE/DELETE,
# tournaments UPDATE. Beide Richtungen zählen: was erlaubt sein soll, muss gelingen (der
# psql-Befehls-Tag meldet "UPDATE 1" / "INSERT 0 1" / "DELETE 1"); was verboten sein soll, muss
# scheitern (0 Zeilen durch die USING-Klausel — Tag "UPDATE 0" / "DELETE 0", kein Fehler — oder
# ein RLS-Fehler durch die WITH-CHECK-Klausel — beides zählt als "verweigert"). Bewusst KEIN
# RETURNING (Begründung bei run_write() weiter unten).
#
# Lese-Policies fasst dieses Skript nicht an (R1 ändert nur INSERT/UPDATE/DELETE), prüft aber
# stichprobenartig, dass anonymes Lesen (kein JWT, Postgres-Rolle `anon`) eines öffentlichen
# Turniers weiter funktioniert (Ruling D) — das wurde für Monitore/Public View kürzlich
# mühsam repariert (PRs #185/#186), und eine Policy-Migration ist die naheliegendste Stelle,
# es versehentlich wieder kaputtzumachen.
#
# Nutzung:
#   scripts/rls-role-matrix.sh                 # Baseline + neue Migration ("nachher")
#   scripts/rls-role-matrix.sh --baseline-only  # nur Baseline ("vorher") — für die Gegenprobe
#                                                # gegen den alten Stand. Abweichungen von der
#                                                # Rollentabelle sind hier ERWARTET (drei Stück,
#                                                # siehe Einordnung im Report) und führen NICHT
#                                                # zu einem Fehlschlag dieses Skripts — es misst,
#                                                # es urteilt nicht. Die Interpretation steht im
#                                                # Report.
#
# Ändert NICHTS an der Produktionsdatenbank — der Container ist eine Wegwerf-Instanz, wird am
# Ende entfernt (trap).
#
set -euo pipefail

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # muss zur Live-Postgres-Version passen
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
MIGRATION_FILE="$MIGRATIONS_DIR/20260922_001_role_based_write_policies.sql"
ROLE_MATRIX_FILE="$REPO_ROOT/src/features/auth/__tests__/roleMatrix.json"
CONTAINER_NAME="rls-role-matrix-$$"
WITH_MIGRATION=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline-only)
      WITH_MIGRATION=0
      shift
      ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^#//'
      exit 0
      ;;
    *)
      echo "Unbekannte Option: $1" >&2
      exit 2
      ;;
  esac
done

command -v jq >/dev/null 2>&1 || { echo "::error::jq wird benötigt." >&2; exit 1; }
[[ -f "$ROLE_MATRIX_FILE" ]] || { echo "::error::Rollentabelle fehlt: $ROLE_MATRIX_FILE" >&2; exit 1; }
[[ -f "$BASELINE_FILE" ]] || { echo "::error::Baseline fehlt: $BASELINE_FILE" >&2; exit 1; }
[[ -f "$MIGRATION_FILE" ]] || { echo "::error::Migration fehlt: $MIGRATION_FILE" >&2; exit 1; }

cleanup() { docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# --- 1. Container starten -------------------------------------------------------------
docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432 \
  "$POSTGRES_IMAGE" >/dev/null

# Dasselbe Wartemuster wie scripts/db-drift-check.sh (Zeilen 141-152 dort): Das offizielle
# Postgres-Entrypoint-Verhalten dieses Images startet den Server ZWEIMAL — einmal temporär für
# die Init-Skripte, dann Shutdown, dann der endgültige Start. `pg_isready` wird schon beim
# ERSTEN (temporären) Start grün. Zuverlässiges Signal: "database system is ready to accept
# connections" muss ZWEIMAL im Log stehen. Genau darauf ist der Controller beim
# Datenbank-Programm hereingefallen — ein abgeschnittener Lauf sieht aus wie "RLS ist aus".
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
  echo "::error::Container wurde nach 90s nicht vollständig bereit." >&2
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

# --- 2. Baseline (+ Migration) einspielen ---------------------------------------------
echo "Baseline einspielen..." >&2
psql_stdin < "$BASELINE_FILE"

if [[ "$WITH_MIGRATION" -eq 1 ]]; then
  echo "Migration einspielen: $(basename "$MIGRATION_FILE")" >&2
  psql_stdin < "$MIGRATION_FILE"
  MODE_LABEL="nachher (Baseline + Migration)"
else
  MODE_LABEL="vorher (nur Baseline)"
fi

# --- 3. Vor der Matrix belegen: 44 Policies, 13 Tabellen mit RLS ----------------------
POLICY_COUNT="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
  "SELECT count(*) FROM pg_policies WHERE schemaname = 'public';")"
RLS_TABLE_COUNT="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity;")"
echo "Policies (public): $POLICY_COUNT — Tabellen mit aktivem RLS: $RLS_TABLE_COUNT" >&2
if [[ "$POLICY_COUNT" -ne 44 || "$RLS_TABLE_COUNT" -ne 13 ]]; then
  echo "::error::Erwartung verfehlt (44 Policies, 13 RLS-Tabellen) — Baseline unvollständig eingespielt? Container-Neustart-Falle?" >&2
  exit 1
fi

# --- 4. Deterministische Test-UUIDs (kein externes uuidgen nötig) ---------------------
uuid_for() {
  local h
  h="$(printf '%s' "rls-role-matrix:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-${h:12:4}-${h:16:4}-${h:20:12}"
}

U_OWNER="$(uuid_for user:owner)"
U_OWNER_ANON="$(uuid_for user:owner-anonymous)"
U_COADMIN="$(uuid_for user:co-admin)"
U_COLLAB="$(uuid_for user:collaborator)"
U_TRAINER="$(uuid_for user:trainer)"
U_VIEWER="$(uuid_for user:viewer)"
U_NONMEMBER="$(uuid_for user:non-member)"
U_PUBLIC_OWNER="$(uuid_for user:public-owner)"

T_MAIN="$(uuid_for tournament:main)"
T_ANON="$(uuid_for tournament:anon)"
T_PUBLIC="$(uuid_for tournament:public)"

M_MAIN="$(uuid_for match:main)"
M_ANON="$(uuid_for match:anon)"
M_PUBLIC="$(uuid_for match:public)"

E_MAIN="$(uuid_for event:main)"
E_ANON="$(uuid_for event:anon)"

# --- 5. Fixtures anlegen (als Superuser postgres — umgeht RLS, Trigger feuern trotzdem) ----
echo "Fixtures anlegen..." >&2
psql_stdin <<SQL
BEGIN;

-- Spaltensatz an das, was dieses Image tatsächlich bereitstellt: eine ältere,
-- minimale auth.users-Variante (kein email_confirmed_at, kein is_anonymous-Spalte —
-- is_anonymous_user() in der Baseline liest das aus dem JWT-Claim, nicht aus der Spalte,
-- und wird von keiner der hier getesteten Policies aufgerufen, also unproblematisch).
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '$U_OWNER', 'authenticated', 'authenticated', 'owner@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_OWNER_ANON', 'authenticated', 'authenticated', NULL, 'x', now(), '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_COADMIN', 'authenticated', 'authenticated', 'co-admin@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_COLLAB', 'authenticated', 'authenticated', 'collaborator@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_TRAINER', 'authenticated', 'authenticated', 'trainer@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_VIEWER', 'authenticated', 'authenticated', 'viewer@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_NONMEMBER', 'authenticated', 'authenticated', 'nonmember@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_PUBLIC_OWNER', 'authenticated', 'authenticated', 'public-owner@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration)
VALUES
  ('$T_MAIN', '$U_OWNER', 'RLS Matrix — main', '2026-09-22', 8, 15),
  ('$T_ANON', '$U_OWNER_ANON', 'RLS Matrix — anon owner', '2026-09-22', 8, 15);

INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, is_public, config)
VALUES
  ('$T_PUBLIC', '$U_PUBLIC_OWNER', 'RLS Matrix — public read', '2026-09-22', 8, 15, true, '{"publishedAt":"2026-09-22T00:00:00.000Z"}'::jsonb);

INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at)
VALUES
  ('$T_MAIN', '$U_COADMIN', 'co-admin', now()),
  ('$T_MAIN', '$U_COLLAB', 'collaborator', now()),
  ('$T_MAIN', '$U_TRAINER', 'trainer', now()),
  ('$T_MAIN', '$U_VIEWER', 'viewer', now());
  -- Nicht-Mitglied ($U_NONMEMBER) bekommt bewusst KEINE Zeile.

INSERT INTO public.matches (id, tournament_id, round, field)
VALUES
  ('$M_MAIN', '$T_MAIN', 1, 1),
  ('$M_ANON', '$T_ANON', 1, 1),
  ('$M_PUBLIC', '$T_PUBLIC', 1, 1);

INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away)
VALUES
  ('$E_MAIN', '$M_MAIN', 'GOAL', 10, 0, 0),
  ('$E_ANON', '$M_ANON', 'GOAL', 10, 0, 0);

-- Nebenbefund (nicht Teil von R1, siehe Report): match_event_version_trigger
-- (increment_match_event_version) setzt "NEW.updated_at := NOW()", aber match_events hat
-- KEINE updated_at-Spalte — jedes UPDATE auf match_events schlägt deshalb IMMER fehl,
-- unabhängig von RLS/Rolle, auch für den Eigentümer. Das ist ein eigenständiger,
-- vorbestehender Fehler in der Baseline (= Live-Schema), nicht Gegenstand dieser Migration.
-- Für eine saubere RLS-Messung wird der Trigger hier deaktiviert, damit dieses Skript
-- ausschließlich die Policies misst, die R1 ändert — nicht diesen unabhängigen Bug.
ALTER TABLE public.match_events DISABLE TRIGGER match_event_version_trigger;

COMMIT;
SQL

# --- 6. Pro Zeile die Schreibversuche ausführen ---------------------------------------
# Jeder Versuch läuft in einer eigenen Transaktion, die NIE committet wird (die psql-Session
# endet ohne COMMIT und rollt implizit zurück) — der Container bleibt zwischen den Zeilen
# unverändert, jede Zeile testet gegen denselben Ausgangszustand.
# WICHTIG: Kein RETURNING in den SQL-Schnipseln, die hier durchgereicht werden. Grund:
# match_events_select_v3 (eine Lese-Policy — von R1 bewusst NICHT angefasst, Ruling D) hat
# KEINEN Rollenzweig, nur "is_public OR owner_id = auth.uid()". Ein INSERT/UPDATE/DELETE
# ... RETURNING auf match_events prüft implizit auch, ob die betroffene Zeile per
# SELECT-Policy sichtbar wäre — für einen co-admin/collaborator, der NICHT Eigentümer ist,
# wäre sie das nicht, und Postgres wirft dafür DIESELBE Fehlermeldung ("new row violates
# row-level security policy"), obwohl die INSERT/UPDATE/DELETE-Policy (die R1 tatsächlich
# ändert) den Zugriff erlaubt hätte. Das verfälschte eine frühere Version dieses Skripts
# (co-admin/collaborator zeigten fälschlich "denied"). Stattdessen wird ohne RETURNING
# gearbeitet und der psql-Befehls-Tag ("INSERT 0 1" / "UPDATE 1" / "UPDATE 0" / "DELETE 1" /
# "DELETE 0") ausgewertet — das misst exakt die INSERT/UPDATE/DELETE-Policy, nichts sonst.
run_write() {
  local user_id="$1" sql="$2"
  local out ec
  set +e
  # Kein -q hier (anders als bei psql_stdin): -q unterdrückt auch die Befehls-Tags
  # ("UPDATE 1" etc.), auf die dieses Skript angewiesen ist — mit -q wäre die Ausgabe
  # bei JEDEM Versuch leer und alles würde fälschlich als "denied" gewertet (beobachtet).
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
  elif grep -qE '^(INSERT [0-9]+ [1-9][0-9]*|UPDATE [1-9][0-9]*|DELETE [1-9][0-9]*)$' <<<"$out"; then
    echo "allowed"
  else
    echo "denied"
  fi
}

run_read_as_anon() {
  local sql="$1"
  local out ec
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE anon;
$sql
SQL
)"
  ec=$?
  set -e
  if [[ $ec -ne 0 || -z "$out" ]]; then
    echo "denied"
  else
    echo "allowed"
  fi
}

echo ""
echo "=== Gemessene Matrix — $MODE_LABEL ==="
printf '%-16s | %-14s | %-18s | %-18s\n' "Rolle" "Spieldaten" "Ereignisse korr." "Turniereinstell."
printf -- '-----------------+----------------+--------------------+--------------------\n'

MISMATCHES=0
TOTAL=0

while IFS= read -r row; do
  id="$(jq -r '.id' <<<"$row")"
  membership="$(jq -r '.membership' <<<"$row")"
  authMode="$(jq -r '.authMode' <<<"$row")"
  exp_write="$(jq -r '.writeMatchData' <<<"$row")"
  exp_correct="$(jq -r '.correctEvents' <<<"$row")"
  exp_settings="$(jq -r '.tournamentSettings' <<<"$row")"

  user_id="$(uuid_for "user:$id")"
  if [[ "$membership" == "owner" && "$authMode" == "anonymous" ]]; then
    tournament_id="$T_ANON"; match_id="$M_ANON"; event_id="$E_ANON"
  else
    tournament_id="$T_MAIN"; match_id="$M_MAIN"; event_id="$E_MAIN"
  fi

  # authMode (anonym angemeldet vs. regulär) wirkt hier nur über die Fixture-Zuordnung
  # (eigenes Turnier T_ANON statt T_MAIN) — auth.uid() in diesem Image liest den flachen
  # GUC request.jwt.claim.sub, keine JSON-Claims. Keine der fünf getesteten Policies ruft
  # is_anonymous_user() auf, das Attribut ist für die Matrix dokumentarisch (roleMatrix.json).

  # writeMatchData: matches UPDATE + match_events INSERT — beide müssen übereinstimmen,
  # sonst ist die Rollentabelle intern widersprüchlich (wird unten als eigener Befund markiert).
  res_matches_update="$(run_write "$user_id" "UPDATE public.matches SET score_a = score_a + 1 WHERE id = '$match_id';")"
  res_events_insert="$(run_write "$user_id" "INSERT INTO public.match_events (match_id, type, timestamp_seconds, score_home, score_away) VALUES ('$match_id','GOAL',20,0,0);")"
  if [[ "$res_matches_update" == "allowed" && "$res_events_insert" == "allowed" ]]; then
    got_write="true"
  elif [[ "$res_matches_update" == "denied" && "$res_events_insert" == "denied" ]]; then
    got_write="false"
  else
    got_write="inconsistent($res_matches_update/$res_events_insert)"
  fi

  # correctEvents: match_events UPDATE + DELETE
  res_events_update="$(run_write "$user_id" "UPDATE public.match_events SET is_deleted = NOT is_deleted WHERE id = '$event_id';")"
  res_events_delete="$(run_write "$user_id" "DELETE FROM public.match_events WHERE id = '$event_id';")"
  if [[ "$res_events_update" == "allowed" && "$res_events_delete" == "allowed" ]]; then
    got_correct="true"
  elif [[ "$res_events_update" == "denied" && "$res_events_delete" == "denied" ]]; then
    got_correct="false"
  else
    got_correct="inconsistent($res_events_update/$res_events_delete)"
  fi

  # tournamentSettings: tournaments UPDATE
  res_tournaments_update="$(run_write "$user_id" "UPDATE public.tournaments SET location_name = 'RLS Test' WHERE id = '$tournament_id';")"
  got_settings="$([[ "$res_tournaments_update" == "allowed" ]] && echo true || echo false)"

  # mark() nur als reine Funktion (kein Kommandosubstitutions-Aufruf mit Seiteneffekt) —
  # `x="$(f)"` startet eine Subshell; Änderungen an TOTAL/MISMATCHES darin gingen sonst
  # verloren (beim ersten Anlauf dieses Skripts genau so passiert: "0 Abweichungen"
  # trotz sichtbarer "!=" in der Tabelle). Zählen passiert danach im Hauptprozess.
  mark() {
    local exp="$1" got="$2"
    if [[ "$got" == "$exp" ]]; then
      echo "$got"
    else
      echo "${got}!=${exp}"
    fi
  }

  m_write="$(mark "$exp_write" "$got_write")"
  m_correct="$(mark "$exp_correct" "$got_correct")"
  m_settings="$(mark "$exp_settings" "$got_settings")"

  for cell in "$m_write" "$m_correct" "$m_settings"; do
    TOTAL=$((TOTAL + 1))
    [[ "$cell" == *"!="* ]] && MISMATCHES=$((MISMATCHES + 1))
  done

  printf '%-16s | %-14s | %-18s | %-18s\n' "$id" "$m_write" "$m_correct" "$m_settings"
done < <(jq -c '.rows[]' "$ROLE_MATRIX_FILE")

# --- 7. Stichprobe: anonymes Lesen eines öffentlichen Turniers (Ruling D) -------------
pub_expect="$(jq -r '.publicRead.expectCanRead' "$ROLE_MATRIX_FILE")"
pub_tournament="$(run_read_as_anon "SELECT id FROM public.tournaments WHERE id = '$T_PUBLIC';")"
pub_match="$(run_read_as_anon "SELECT id FROM public.matches WHERE id = '$M_PUBLIC';")"
pub_got="$([[ "$pub_tournament" == "allowed" && "$pub_match" == "allowed" ]] && echo true || echo false)"
echo ""
echo "Stichprobe — anonymes Lesen eines öffentlichen Turniers: erwartet=$pub_expect, gemessen=$pub_got (tournaments=$pub_tournament, matches=$pub_match)"
if [[ "$pub_got" != "$pub_expect" ]]; then
  MISMATCHES=$((MISMATCHES + 1))
fi

echo ""
echo "=== Zusammenfassung — $MODE_LABEL: $MISMATCHES Abweichung(en) von der Rollentabelle (von $((TOTAL + 1)) geprüften Zellen inkl. Public-Read-Stichprobe) ==="
