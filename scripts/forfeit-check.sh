#!/usr/bin/env bash
#
# forfeit-check.sh — Container-Beweis fuer supabase/migrations/20261110_005_result_entry_forfeit.sql (A-25b, SQL-Zwilling
# der Nichtantritt-Wertung A-25n und Platz 5/7; task-GA4-plan-v2.md "A-25b", Anhang B.1). Muster:
# scripts/field-control-check.sh (Wegwerf-Container supabase/postgres, Baseline + Migrationen seit Baseline, Aufraeumen
# per trap, --without-migration, --gegenprobe, --print-rueckweg).
#
# Testwerte aus dem Gherkin: „Hallencup Nord“, Turnierleitung Olli (Eigentuemer), Co-Admin Maria, Helfer Tom (Handy,
# Geraetesitzung), Trainer Rot; Team C gegen Team D (@W2A-022/@W2A-026), TSV West gegen SC Ost (@TM-063, @W2A-024),
# Halbfinale 1 FC Nord gegen DJK Berg (K.-o.). Alle Eintraege laufen ueber append_match_events (echter Weg).
#
# Kategorien:
#   F  Fail-fast: ohne die Vorgaenger (A-34 20261110_003) bricht 20261110_005 mit Meldung ab und aendert nichts.
#   N  Nichtantritt: @W2A-022, @W2A-024, @TM-063, @W2A-026 mit Gegenbeispielen; R-A25b-1 (Zuruecknehmen ohne
#      Feldsteuerung), R-A25b-2 (Wertung ohne SHOOTOUT_REQUIRED); compute_match_state = Zwischenspeicher;
#      Review M1 (@SL-074/@SL-075): nach zurueckgenommener Wertung setzt Tom einmal fort, ein zweites Mal nicht.
#   P  Platz 5/7 (@TM-004 Server-Teil, C-FINALTYPE-PLATZ5-7): Spiele um Platz 5 und 7 speicherbar, Unbekanntes nicht.
#   R  Rechte und Spaltenschutz: forfeit_absent schreibt nur der Server (UPDATE 42501, INSERT neutral), Helfer/Trainer.
#   A  A-34 nach 20261110_005 (Review-Auflage 4): Steuer je Feld wirkt weiter, Assertion append-match-events-checks-field-control.
#   S  Schema: Katalogzaehlung, Rechte-Assertion (alle |t, 2 neue), Namensliste und Zuordnung in db-drift-check.sh (pending_assertions_for).
#   W  zweites Einspielen (idempotent): Exit 0, Schema (public + match_engine) und Daten gleich.
#   X  Rueckweg (Vorlage 20261110_005-rueckweg.sql): haelt bei Spielen um Platz 5/7 an; danach Schema = vor der Migration,
#      REOPEN wieder 'running', Wertungen 'regular'; danach erneut einspielbar.
#
# Aufrufoptionen:
#   bash scripts/forfeit-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/forfeit-check.sh --without-migration  Gegenprobe: ohne 20261110_005 -> N, P und R muessen ROT sein
#   bash scripts/forfeit-check.sh --gegenprobe         je Lauf eine Mutation der Migration (M1-M10); Exit 0 NUR, wenn
#                                                      JEDE Mutation mindestens eine Pruefung rot faerbt
#   bash scripts/forfeit-check.sh --print-rueckweg     gibt den Rueckweg (Anhang B der Freigabe) aus, ohne Container
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container
# (--platform linux/amd64), wird am Ende entfernt (trap). Harness-Hilfen liegen im Schema "harness".
#
set -euo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  --print-rueckweg) MODE="print-rueckweg" ;;
  *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe, --print-rueckweg)" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie field-control-check.sh
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261110_005_result_entry_forfeit.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
CONTAINER_PREFIX="forfeit-check-$$"
CURRENT_CONTAINER=""

# Vorfassungen der ersetzten Funktionen (Basis je Funktion, siehe Kopf der Migration).
F_002="$MIGRATIONS_DIR/20260928_002_match_engine.sql"
F_AMEND="$MIGRATIONS_DIR/20261001_001_amend_event.sql"
F_ZA3="$MIGRATIONS_DIR/20261028_001_transitions_za3.sql"
F_A25A="$MIGRATIONS_DIR/20261028_003_result_entry_shootout.sql"
F_A10="$MIGRATIONS_DIR/20261028_005_guard_all_matches.sql"
F_SW="$MIGRATIONS_DIR/20261028_007_entered_shootout_needs_draw.sql"
F_A34="$MIGRATIONS_DIR/20261110_003_field_control.sql"

# fn_block <Datei> <Funktionsanfang> -- die Funktion woertlich (CREATE OR REPLACE ... bis zur Zeile "$$;").
fn_block() { awk -v pat="$2" 'index($0, pat) == 1 {f = 1} f {print} f && $0 == "$$;" {exit}' "$1"; }

# Rueckweg (Anhang B): Daten passend machen, CHECKs und Funktionen woertlich aus den Vorfassungen, Spalte weg.
rueckweg_sql() {
  echo "-- Rueckweg A-25b (20261110_005_result_entry_forfeit.sql), erzeugt von scripts/forfeit-check.sh --print-rueckweg"
  echo "-- Vorher: App ohne A-25n (kennt '@reopen' nicht, sendet keine Wertung). Vorab zaehlen (Freigabe-Unterlage § 7)."
  echo "BEGIN;"
  echo "SET LOCAL lock_timeout = '5s';"
  echo "DO \$\$"
  echo "BEGIN"
  echo "  IF EXISTS (SELECT 1 FROM public.matches WHERE final_type IN ('fifthSixth', 'seventhEighth')) THEN"
  echo "    RAISE EXCEPTION 'Rueckweg 20261110_005: Spiele um Platz 5/7 vorhanden -- der alte CHECK kennt sie nicht; vorher klaeren';"
  echo "  END IF;"
  echo "END;"
  echo "\$\$;"
  echo "-- Wertungen: Zwischenspeicher wie die alte Rechenfunktion (ein Direkteintrag ist 'regular')."
  echo "UPDATE public.matches SET decided_by = 'regular' WHERE decided_by = 'forfeit';"
  echo "UPDATE public.match_transitions SET to_status = 'running' WHERE from_status = 'finished' AND event_type = 'REOPEN';"
  echo "ALTER TABLE public.match_transitions DROP CONSTRAINT IF EXISTS match_transitions_to_status_check;"
  echo "ALTER TABLE public.match_transitions ADD CONSTRAINT match_transitions_to_status_check CHECK ("
  echo "  to_status IN ('scheduled', 'running', 'paused', 'section_break', 'decision_pending', 'shootout',"
  echo "                'finished', 'skipped', '=', '@endcheck'));"
  echo "ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_decided_by_check;"
  echo "ALTER TABLE public.matches ADD CONSTRAINT matches_decided_by_check"
  echo "  CHECK (decided_by = ANY (ARRAY['regular'::text, 'overtime'::text, 'goldenGoal'::text, 'penalty'::text]));"
  echo "ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_final_type_check;"
  echo "ALTER TABLE public.matches ADD CONSTRAINT matches_final_type_check"
  echo "  CHECK (final_type = ANY (ARRAY['quarterfinal'::text, 'semifinal'::text, 'thirdPlace'::text, 'final'::text]));"
  echo "-- payload_valid, apply_result_entry woertlich aus 20261028_003_result_entry_shootout.sql"
  fn_block "$F_A25A" "CREATE OR REPLACE FUNCTION match_engine.payload_valid("
  fn_block "$F_A25A" "CREATE OR REPLACE FUNCTION match_engine.apply_result_entry("
  echo "-- decided_by woertlich aus 20260928_002_match_engine.sql"
  fn_block "$F_002" "CREATE OR REPLACE FUNCTION match_engine.decided_by("
  echo "-- apply_effect woertlich aus 20261028_001_transitions_za3.sql"
  fn_block "$F_ZA3" "CREATE OR REPLACE FUNCTION match_engine.apply_effect("
  echo "-- match_apply_event woertlich aus 20261001_001_amend_event.sql"
  fn_block "$F_AMEND" "CREATE OR REPLACE FUNCTION public.match_apply_event("
  echo "-- cache_columns woertlich aus 20261028_007_entered_shootout_needs_draw.sql"
  fn_block "$F_SW" "CREATE OR REPLACE FUNCTION match_engine.cache_columns("
  echo "-- append_match_events woertlich aus 20261110_003_field_control.sql (A-34)"
  fn_block "$F_A34" "CREATE OR REPLACE FUNCTION public.append_match_events("
  echo "-- matches_guard_engine_columns und COMMENT woertlich aus 20261028_005_guard_all_matches.sql"
  fn_block "$F_A10" "CREATE OR REPLACE FUNCTION public.matches_guard_engine_columns("
  awk '/^COMMENT ON FUNCTION public\.matches_guard_engine_columns\(\) IS/{f=1} f{print} f && /;$/{exit}' "$F_A10"
  echo "-- Rechte wie vorher (unveraendert)"
  echo "REVOKE ALL ON FUNCTION match_engine.payload_valid(jsonb, jsonb), match_engine.apply_result_entry(jsonb, jsonb, jsonb),"
  echo "  match_engine.decided_by(jsonb), match_engine.apply_effect(jsonb, jsonb, jsonb), public.match_apply_event(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;"
  echo "GRANT EXECUTE ON FUNCTION match_engine.payload_valid(jsonb, jsonb), match_engine.apply_result_entry(jsonb, jsonb, jsonb),"
  echo "  match_engine.decided_by(jsonb), match_engine.apply_effect(jsonb, jsonb, jsonb), public.match_apply_event(jsonb, jsonb, jsonb, jsonb)"
  echo "  TO authenticated, anon, service_role;"
  echo "REVOKE ALL ON FUNCTION match_engine.cache_columns(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;"
  echo "REVOKE ALL ON FUNCTION public.matches_guard_engine_columns() FROM PUBLIC, anon, authenticated, service_role;"
  echo "REVOKE ALL ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) FROM PUBLIC, anon, service_role;"
  echo "GRANT EXECUTE ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) TO authenticated;"
  echo "ALTER TABLE public.matches DROP COLUMN IF EXISTS forfeit_absent;"
  echo "COMMIT;"
}
if [[ "$MODE" == "print-rueckweg" ]]; then
  rueckweg_sql
  exit 0
fi

if [[ "$MODE" != "without-migration" && ! -f "$TARGET_FILE" ]]; then
  echo "::error::$TARGET_NAME fehlt." >&2
  exit 1
fi

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
NEWER_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
BEFORE=()
AFTER=()
SEEN_TARGET=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if [[ "$(basename "$line")" == "$TARGET_NAME" ]]; then
    SEEN_TARGET=1
  elif [[ "$SEEN_TARGET" -eq 0 ]]; then
    BEFORE+=("$line")
  else
    AFTER+=("$line")
  fi
done <<< "$NEWER_RAW"
if [[ "$MODE" != "without-migration" && "$SEEN_TARGET" -ne 1 ]]; then
  echo "::error::$TARGET_NAME nicht in der Liste 'neuer als Baseline'." >&2
  exit 1
fi

cleanup() { [[ -n "$CURRENT_CONTAINER" ]] && docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

start_container() {
  CURRENT_CONTAINER="$CONTAINER_PREFIX-$1"
  docker run -d --platform "$DOCKER_PLATFORM" --name "$CURRENT_CONTAINER" -e POSTGRES_PASSWORD=postgres -p 5432 "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 120); do
    if [[ "$(docker logs "$CURRENT_CONTAINER" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "::error::Container wurde nach 120s nicht bereit." >&2
    docker logs "$CURRENT_CONTAINER" 2>&1 | tail -30 >&2
    exit 1
  fi
  for _ in $(seq 1 30); do
    docker exec "$CURRENT_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
}
stop_container() { docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1 || true; CURRENT_CONTAINER=""; }

psql_stdin() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q
}
psql_value() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA
}
q() { psql_value <<<"$1" 2>&1 || true; }
schema_public() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }
# Identitaetsvergleich ueber beide betroffenen Schemata (die Rechenfunktion liegt in match_engine).
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public --schema=match_engine postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }
transitions_state() { q "SELECT string_agg(from_status || '/' || event_type || '/' || actor || '/' || to_status, ',' ORDER BY from_status, event_type) FROM public.match_transitions;"; }

# Zaehler je Kategorie (bash 3.2: keine assoziativen Arrays).
CATS=(F N P R A S W X)
DEVS=(0 0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0 0)
cat_index() {
  local i
  for i in "${!CATS[@]}"; do [[ "${CATS[$i]}" == "$1" ]] && { echo "$i"; return 0; }; done
  echo "::error::Unbekannte Kategorie $1" >&2; exit 2
}
check() { # check <Kategorie> <Name> <erwartet> <erhalten>
  local i
  i="$(cat_index "$1")"
  if [[ "$3" == "$4" ]]; then
    OKS[i]=$((OKS[i] + 1)); echo "OK          [$1] $2"
  else
    DEVS[i]=$((DEVS[i] + 1)); echo "ABWEICHUNG  [$1] $2"; echo "    erwartet: $3"; echo "    erhalten: $4"
  fi
}
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
reset_counts() { DEVS=(0 0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0 0); }

uuid_for() {
  local h
  h="$(printf '%s' "forfeit-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_TRAINER="$(uuid_for user:trainer)"
U_TOM="$(uuid_for user:tom-handy)"
ANON_UIDS=" $U_TOM "
D_OLLI="$(uuid_for device:olli-tablet)"; D_TOM="$(uuid_for device:tom-handy)"
T_NORD="$(uuid_for tournament:hallencup-nord)"
team() { uuid_for "team:$1"; }
TC="$(team team-c)"; TD="$(team team-d)"; TW="$(team tsv-west)"; TO="$(team sc-ost)"; TN="$(team fc-nord)"
TB="$(team djk-berg)"; TM="$(team sg-mitte)"; TU="$(team vfb-ufer)"
match() { uuid_for "match:$1"; }
M_CD="$(match c-d)"; M_HELPER="$(match helfer)"; M_FORM="$(match form)"; M_WO="$(match west-ost)"; M_HF1="$(match hf1)"
M_HF2="$(match hf2)"; M_LIVE="$(match feld1-live)"; M_F1="$(match feld1-wertung)"; M_PLAYED="$(match feld1-gespielt)"
M_PLAIN="$(match direkteintrag)"; M_TRAINER="$(match trainer)"; M_REOPEN_H="$(match helfer-zurueck)"
M_CONT="$(match fortsetzen-nach-ruecknahme)"
E() { uuid_for "event:$1"; }

EVS=""
ev() {
  local extra="${3:-}" one
  [[ -z "$extra" ]] && extra='{}'
  one="$(jq -cn --arg type "$1" --arg id "$2" --argjson extra "$extra" \
    '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, teamId: null, targetId: null, payload: {}} + $extra')"
  EVS="$EVS$one"$'\n'
}
# forfeit <A-Team> <B-Team> <a> <b> <absent|leer> -- Payload eines RESULT_ENTRY (absent leer: ohne Wertung)
forfeit() {
  jq -cn --arg a "$1" --arg b "$2" --argjson sa "$3" --argjson sb "$4" --arg absent "${5:-}" \
    '{payload: ({scores: {($a): $sa, ($b): $sb}} + (if $absent == "" then {} else {forfeit: {absent: $absent}} end))}'
}
is_anon() { [[ "$ANON_UIDS" == *" $1 "* ]] && echo true || echo false; }
sqlnull() { [[ -z "$1" ]] && echo "NULL" || echo "'$1'"; }
OUT=""
send() { # send <Nutzer> <Geraet|leer> <Spiel>
  local events
  events="$(jq -cs '.' <<<"$EVS")"
  EVS=""
  OUT="$(q "SELECT harness.call('$1'::uuid, $(is_anon "$1"), '$3'::uuid, \$J\$$events\$J\$::jsonb, $(sqlnull "$2")::uuid);")"
}
results() { jq -r '[.results[]? | .status + (if .code then ":" + .code else "" end) + (if .detail.reason then ":" + .detail.reason else "" end)] | join(",")' <<<"$1" 2>/dev/null || echo "keine-json:$1"; }
client() { q "SELECT harness.exec($(sqlnull "$1")::uuid, $( [[ -n "$1" ]] && is_anon "$1" || echo false ), \$S\$$2\$S\$, '${3:-authenticated}');"; }
row() { q "SELECT coalesce(score_a::text, '-') || ':' || coalesce(score_b::text, '-') || '|' || coalesce(match_status, '-') || '|' || coalesce(decided_by, '-') || '|' || coalesce(forfeit_absent, '-') FROM public.matches WHERE id = '$1';"; }
# row_old: ohne Spalte forfeit_absent (Lauf ohne Migration bzw. nach dem Rueckweg)
row_old() { q "SELECT coalesce(score_a::text, '-') || ':' || coalesce(score_b::text, '-') || '|' || coalesce(match_status, '-') || '|' || coalesce(decided_by, '-') FROM public.matches WHERE id = '$1';"; }
events_count() { q "SELECT count(*) FROM public.match_events WHERE match_id = '$1' AND event_format IS NOT NULL;"; }
cms() { q "SELECT harness.cms('$1'::uuid, '$2'::uuid);"; }

setup_helpers() {
  psql_stdin <<'SQL'
CREATE SCHEMA harness;
GRANT USAGE ON SCHEMA harness TO anon, authenticated, service_role;
CREATE FUNCTION harness.claims(p_user uuid, p_anon boolean, p_role text) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '' ELSE
    json_build_object('sub', p_user, 'role', p_role, 'is_anonymous', coalesce(p_anon, false))::text END, true);
  PERFORM set_config('role', p_role, true);
END;
$fn$;
CREATE FUNCTION harness.call(p_user uuid, p_anon boolean, p_match uuid, p_events jsonb, p_device uuid) RETURNS jsonb
LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  PERFORM harness.claims(p_user, p_anon, 'authenticated');
  BEGIN
    v := public.append_match_events(p_match, p_events, 1, p_device);
  EXCEPTION WHEN OTHERS THEN
    v := jsonb_build_object('exception', SQLSTATE, 'message', SQLERRM);
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
-- compute_match_state als Eigentuemer: Status|decidedBy|effektiver Stand
CREATE FUNCTION harness.cms(p_user uuid, p_match uuid) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  PERFORM harness.claims(p_user, false, 'authenticated');
  v := public.compute_match_state(p_match);
  PERFORM set_config('role', 'postgres', true);
  RETURN (v ->> 'status') || '|' || coalesce(v ->> 'decidedBy', '-');
END;
$fn$;
CREATE FUNCTION harness.exec(p_user uuid, p_anon boolean, p_sql text, p_role text) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_rows bigint; v text;
BEGIN
  PERFORM harness.claims(p_user, p_anon, p_role);
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v := 'ok:' || v_rows;
  EXCEPTION WHEN OTHERS THEN
    v := 'error:' || SQLSTATE;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA harness TO anon, authenticated, service_role;
SQL
}

# Daten (VOR der Ziel-Migration, damit der Lauf ohne Migration dieselben Daten hat).
setup_data() {
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@a25b.test'), ('$U_MARIA'::uuid, 'maria@a25b.test'), ('$U_TRAINER'::uuid, 'trainer@a25b.test'),
             ('$U_TOM'::uuid, NULL)) AS u(id, email);
INSERT INTO public.profiles (id, display_name, email)
VALUES ('$U_OLLI', 'Olli', 'olli@a25b.test'), ('$U_MARIA', 'Maria', 'maria@a25b.test'), ('$U_TRAINER', 'Trainer Rot', 'trainer@a25b.test')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES ('$T_NORD', '$U_OLLI', 'Hallencup Nord', '2026-11-28', 8, 10, '{}'::jsonb);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) VALUES
  ('$T_NORD', '$U_MARIA', 'co-admin', now(), 'Maria'), ('$T_NORD', '$U_TOM', 'helper', now(), 'Tom'),
  ('$T_NORD', '$U_TRAINER', 'trainer', now(), 'Trainer Rot');
INSERT INTO public.teams (id, tournament_id, name) VALUES
  ('$TC', '$T_NORD', 'Team C'), ('$TD', '$T_NORD', 'Team D'), ('$TW', '$T_NORD', 'TSV West'), ('$TO', '$T_NORD', 'SC Ost'),
  ('$TN', '$T_NORD', 'FC Nord'), ('$TB', '$T_NORD', 'DJK Berg'), ('$TM', '$T_NORD', 'SG Mitte'), ('$TU', '$T_NORD', 'VfB Ufer');
-- Wie ein neues Spiel der App: ohne Stand (score NULL, sonst stuende der Tabellen-Standard 0:0 im Zwischenspeicher).
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start, group_letter) VALUES
  ('$M_CD', '$T_NORD', 1, 2, '$TC', '$TD', 3, '14:00', 'A'),
  ('$M_HELPER', '$T_NORD', 1, 2, '$TN', '$TB', 4, '14:10', 'B'),
  ('$M_FORM', '$T_NORD', 2, 2, '$TM', '$TU', 5, '14:20', 'B'),
  ('$M_WO', '$T_NORD', 2, 2, '$TW', '$TO', 6, '14:30', 'A'),
  ('$M_LIVE', '$T_NORD', 3, 1, '$TN', '$TM', 7, '14:40', 'B'),
  ('$M_F1', '$T_NORD', 3, 1, '$TC', '$TW', 8, '14:50', 'A'),
  ('$M_PLAYED', '$T_NORD', 4, 1, '$TD', '$TO', 9, '15:00', 'A'),
  ('$M_PLAIN', '$T_NORD', 4, 2, '$TB', '$TU', 10, '15:10', 'B'),
  ('$M_TRAINER', '$T_NORD', 5, 2, '$TN', '$TU', 11, '15:20', 'B'),
  ('$M_REOPEN_H', '$T_NORD', 5, 2, '$TB', '$TM', 12, '15:30', 'B'),
  ('$M_CONT', '$T_NORD', 5, 3, '$TW', '$TU', 19, '15:40', 'A');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start, is_final, final_type, phase) VALUES
  ('$M_HF1', '$T_NORD', 6, 1, '$TN', '$TB', 13, '16:00', true, 'semifinal', 'final'),
  ('$M_HF2', '$T_NORD', 6, 2, '$TM', '$TU', 14, '16:00', true, 'semifinal', 'final');
UPDATE public.matches SET score_a = NULL, score_b = NULL WHERE tournament_id = '$T_NORD';
SQL
}

# ---------------------------------------------------------------------------------------------------------
# Proben N, P, R, A (gemeinsam fuer normalen Lauf, ohne Migration und Gegenprobe)
# ---------------------------------------------------------------------------------------------------------
run_probes() {
  local res

  # --- @W2A-022: Team C tritt gegen Team D nicht an ---------------------------------------------------------
  ev RESULT_ENTRY "$(E cd-wertung)" "$(forfeit "$TC" "$TD" 0 2 A)"
  send "$U_OLLI" "$D_OLLI" "$M_CD"
  check N "@W2A-022 „nicht angetreten“ für Team C: Spiel 0:2 für Team D gewertet, beendet, als Wertung gekennzeichnet (decided_by forfeit, fehlend A)" \
    "accepted|0:2|finished|forfeit|A" "$(results "$OUT")|$(row "$M_CD")"
  check N "@W2A-022 compute_match_state liest dasselbe (beendet, forfeit)" "finished|forfeit" "$(cms "$U_OLLI" "$M_CD")"
  ev RESULT_ENTRY "$(E helfer-wertung)" "$(forfeit "$TN" "$TB" 0 2 A)"
  send "$U_TOM" "$D_TOM" "$M_HELPER"
  check N "@W2A-022 Gegenbeispiel: Helfer Tom darf nicht werten (FORBIDDEN_ACTOR), nichts gespeichert" \
    "rejected:FORBIDDEN_ACTOR|0|-:-|scheduled|-|-" "$(results "$OUT")|$(events_count "$M_HELPER")|$(row "$M_HELPER")"
  ev RESULT_ENTRY "$(E trainer-wertung)" "$(forfeit "$TN" "$TU" 0 2 A)"
  send "$U_TRAINER" "" "$M_TRAINER"
  check N "@W2A-022 Gegenbeispiel: Trainer Rot ohne Recht -> FORBIDDEN_ACTOR" "rejected:FORBIDDEN_ACTOR|0" "$(results "$OUT")|$(events_count "$M_TRAINER")"
  ev RESULT_ENTRY "$(E form-sieger)" "$(forfeit "$TM" "$TU" 2 0 A)"
  ev RESULT_ENTRY "$(E form-beide)" "$(forfeit "$TM" "$TU" 2 0 both)"
  ev RESULT_ENTRY "$(E form-seite)" "$(forfeit "$TM" "$TU" 0 2 C)"
  ev RESULT_ENTRY "$(E form-strafstoss)" "$(jq -cn --arg a "$TM" --arg b "$TU" '{payload: {scores: {($a): 0, ($b): 0}, forfeit: {absent: "both"}, shootout: {($a): 4, ($b): 3}}}')"
  ev RESULT_ENTRY "$(E form-zusatz)" "$(jq -cn --arg a "$TM" --arg b "$TU" '{payload: {scores: {($a): 0, ($b): 2}, forfeit: {absent: "A", grund: "Bus"}}}')"
  send "$U_OLLI" "$D_OLLI" "$M_FORM"
  check N "@W2A-022 Gegenbeispiele der Form (falscher Sieger, beide 2:0, Seite C, mit Strafstoß, Zusatzschlüssel) -> je INVALID_PAYLOAD, nichts gespeichert" \
    "rejected:INVALID_PAYLOAD,rejected:INVALID_PAYLOAD,rejected:INVALID_PAYLOAD,rejected:INVALID_PAYLOAD,rejected:INVALID_PAYLOAD|0|-:-|scheduled|-|-" \
    "$(results "$OUT")|$(events_count "$M_FORM")|$(row "$M_FORM")"
  ev RESULT_ENTRY "$(E direkteintrag)" "$(forfeit "$TB" "$TU" 3 1 "")"
  send "$U_OLLI" "$D_OLLI" "$M_PLAIN"
  check N "@W2A-022 Gegenbeispiel: ein Direkteintrag 3:1 ohne Nichtantritt ist ein gespieltes Ergebnis (regular, kein Fehlender)" \
    "accepted|3:1|finished|regular|-" "$(results "$OUT")|$(row "$M_PLAIN")"

  # --- @W2A-024 / @TM-063: TSV West und SC Ost treten beide nicht an ----------------------------------------
  ev RESULT_ENTRY "$(E west-ost)" "$(forfeit "$TW" "$TO" 0 0 both)"
  send "$U_OLLI" "$D_OLLI" "$M_WO"
  check N "@W2A-024 @TM-063 „nicht angetreten“ für beide: das Spiel gilt als entschieden (beendet), Wertung 0:0, fehlend both" \
    "accepted|0:0|finished|forfeit|both" "$(results "$OUT")|$(row "$M_WO")"

  # --- R-A25b-2: K.-o. (Halbfinale 1), beide fehlen -> keine Strafstoss-Pflicht -----------------------------
  ev RESULT_ENTRY "$(E hf1-beide)" "$(forfeit "$TN" "$TB" 0 0 both)"
  send "$U_OLLI" "$D_OLLI" "$M_HF1"
  check N "@W2A-024 R-A25b-2: Halbfinale 1, beide treten nicht an -> angenommen (kein SHOOTOUT_REQUIRED), kein Sieger" \
    "accepted|0:0|finished|forfeit|both" "$(results "$OUT")|$(row "$M_HF1")"
  ev RESULT_ENTRY "$(E hf2-remis)" "$(forfeit "$TM" "$TU" 0 0 "")"
  send "$U_OLLI" "$D_OLLI" "$M_HF2"
  check N "@W2A-024 Gegenbeispiel: Halbfinale 2 mit 0:0 ohne Wertung und ohne Strafstoß -> SHOOTOUT_REQUIRED (A-25a unverändert)" \
    "rejected:INVALID_PAYLOAD:SHOOTOUT_REQUIRED|0" "$(results "$OUT")|$(events_count "$M_HF2")"

  # --- Rechte/Spaltenschutz (R) auf dem gewerteten Spiel TSV West - SC Ost ------------------------------------
  check R "Olli (Eigentuemer) aendert forfeit_absent per REST nicht (Spaltenschutz 42501), Wert bleibt" \
    "error:42501|0:0|finished|forfeit|both" "$(client "$U_OLLI" "UPDATE public.matches SET forfeit_absent = 'A' WHERE id = '$M_WO'")|$(row "$M_WO")"
  check R "Co-Admin Maria setzt forfeit_absent per REST nicht zurueck (42501)" \
    "error:42501|0:0|finished|forfeit|both" "$(client "$U_MARIA" "UPDATE public.matches SET forfeit_absent = NULL WHERE id = '$M_WO'")|$(row "$M_WO")"
  check R "Helfer Tom aendert forfeit_absent nicht (kein Update-Recht bzw. Spaltenschutz)" "abgelehnt|0:0|finished|forfeit|both" \
    "$(res="$(client "$U_TOM" "UPDATE public.matches SET forfeit_absent = 'B' WHERE id = '$M_WO'")"; [[ "$res" == "ok:0" || "$res" == error:* ]] && echo abgelehnt || echo "$res")|$(row "$M_WO")"
  res="$(client "$U_OLLI" "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, forfeit_absent, decided_by) VALUES ('$(match neu-eingefuegt)', '$T_NORD', 9, 2, '$TC', '$TO', 30, 'A', 'forfeit')")"
  check R "Olli legt ein Spiel mit forfeit_absent per REST an -> neutral gespeichert (NULL, ohne Entscheidung)" \
    "ok:1|-:-|scheduled|-|-" "$res|$(row "$(match neu-eingefuegt)")"
  check R "anon (ohne Sitzung) ruft append_match_events nicht auf (kein EXECUTE)" "error:42501" \
    "$(client "" "SELECT public.append_match_events('$M_CD', '[]'::jsonb, 1, NULL)" anon)"

  # --- @W2A-026: Olli nimmt die Wertung Team C - Team D zurueck ---------------------------------------------
  ev REOPEN "$(E cd-zurueck)" '{"at": 5000}'
  send "$U_OLLI" "$D_OLLI" "$M_CD"
  check N "@W2A-026 die Turnierleitung nimmt die Wertung zurück: das Spiel ist wieder offen (geplant, ohne Stand, ohne Entscheidung)" \
    "accepted|-:-|scheduled|-|-" "$(results "$OUT")|$(row "$M_CD")"
  check N "@W2A-026 compute_match_state: geplant, ohne Entscheidung; Ereignisse bleiben (2)" "scheduled|-|2" "$(cms "$U_OLLI" "$M_CD")|$(events_count "$M_CD")"
  check N "@W2A-026 tatsaechlicher Beginn/Ende leer" "|" "$(q "SELECT coalesce(actual_start::text, '') || '|' || coalesce(actual_end::text, '') FROM public.matches WHERE id = '$M_CD';")"
  ev RESULT_ENTRY "$(E cd-neu)" "$(forfeit "$TC" "$TD" 2 0 B)"
  send "$U_MARIA" "" "$M_CD"
  check N "@W2A-026 danach wertet Co-Admin Maria richtig (Team D fehlte): 2:0, fehlend B" "accepted|2:0|finished|forfeit|B" "$(results "$OUT")|$(row "$M_CD")"
  ev RESULT_ENTRY "$(E reopen-h-wertung)" "$(forfeit "$TB" "$TM" 0 2 A)"
  send "$U_OLLI" "$D_OLLI" "$M_REOPEN_H"
  ev REOPEN "$(E reopen-h)" '{"at": 6000}'
  send "$U_TOM" "$D_TOM" "$M_REOPEN_H"
  check N "@W2A-026 Gegenbeispiel: Helfer Tom nimmt eine Wertung nicht zurück (FORBIDDEN_ACTOR), Wertung bleibt" \
    "rejected:FORBIDDEN_ACTOR:NOT_ENDED_BY_CLOCK|0:2|finished|forfeit|A" "$(results "$OUT")|$(row "$M_REOPEN_H")"

  # --- Review M1 (@SL-074/@SL-075 nach @W2A-026): Wertung zurueckgenommen, danach gespielt (Feld 3, ohne Geraete-ID) --
  ev RESULT_ENTRY "$(E cont-wertung)" "$(forfeit "$TW" "$TU" 0 2 A)"
  ev REOPEN "$(E cont-zurueck)" '{"at": 2000}'
  send "$U_OLLI" "" "$M_CONT"
  ev MATCH_START "$(E cont-start)" '{"at": 10000, "clockMs": null}'
  ev MATCH_END "$(E cont-ende)" '{"at": 610000, "clockMs": 600000}'
  send "$U_TOM" "" "$M_CONT"
  ev REOPEN "$(E cont-fortsetzen)" '{"at": 630000, "clockMs": 560000}'
  send "$U_TOM" "" "$M_CONT"
  check N "@SL-074 Review M1: Wertung zurückgenommen, gespielt, von selbst beendet -> Tom setzt 20 s nach dem Abpfiff einmal fort (läuft wieder, ohne Entscheidung)" \
    "accepted|running|-" "$(results "$OUT")|$(row "$M_CONT" | cut -d'|' -f2-3)"
  ev MATCH_END "$(E cont-ende-2)" '{"at": 670000, "clockMs": 600000}'
  send "$U_TOM" "" "$M_CONT"
  ev REOPEN "$(E cont-fortsetzen-2)" '{"at": 680000, "clockMs": 590000}'
  send "$U_TOM" "" "$M_CONT"
  check N "@SL-075 Gegenbeispiel: nach dem Fortsetzen wieder von selbst beendet -> ein zweites Mal setzt Tom nicht fort (ALREADY_CONTINUED, bleibt beendet)" \
    "rejected:FORBIDDEN_ACTOR:ALREADY_CONTINUED|finished|regular" "$(results "$OUT")|$(row "$M_CONT" | cut -d'|' -f2-3)"

  # --- R-A25b-1 + A-34 (A): Tom steuert Feld 1; Olli nimmt eine Wertung auf Feld 1 ohne Steuer zurueck ----
  ev MATCH_START "$(E live-start)" '{"clockMs": null}'
  send "$U_TOM" "$D_TOM" "$M_LIVE"
  check A "Vorbereitung: Toms Handy pfeift Spiel 7 auf Feld 1 an (steuert Feld 1)" "accepted|$U_TOM|$D_TOM" \
    "$(results "$OUT")|$(q "SELECT coalesce(holder_user_id::text, '-') || '|' || coalesce(holder_device_id::text, '-') FROM public.field_control WHERE tournament_id = '$T_NORD' AND field = 1;")"
  ev GOAL "$(E live-olli-tor)" "$(jq -cn --arg t "$TN" '{at: 2000, clockMs: 60000, teamId: $t}')"
  send "$U_OLLI" "$D_OLLI" "$M_LIVE"
  check A "A-34 nach 20261110_005: Ollis Tablet traegt im laufenden Spiel auf Toms Feld 1 nicht ein (NOT_CONTROLLER)" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE" "$(results "$OUT")"
  ev RESULT_ENTRY "$(E f1-wertung)" "$(forfeit "$TC" "$TW" 0 2 A)"
  send "$U_OLLI" "$D_OLLI" "$M_F1"
  ev REOPEN "$(E f1-zurueck)" '{"at": 7000}'
  send "$U_OLLI" "$D_OLLI" "$M_F1"
  check N "@W2A-026 R-A25b-1: Olli nimmt die Wertung von Spiel 8 auf Toms Feld 1 ohne Übernahme zurück (wieder geplant), Tom steuert weiter" \
    "accepted|-:-|scheduled|-|-|$U_TOM" "$(results "$OUT")|$(row "$M_F1")|$(q "SELECT holder_user_id FROM public.field_control WHERE tournament_id = '$T_NORD' AND field = 1;")"
  ev MATCH_START "$(E played-start)" '{"clockMs": null}'
  ev MATCH_END "$(E played-end)" '{"at": 2000, "clockMs": 600000}'
  send "$U_TOM" "$D_TOM" "$M_PLAYED"
  ev REOPEN "$(E played-reopen)" '{"at": 8000}'
  send "$U_OLLI" "$D_OLLI" "$M_PLAYED"
  check A "Gegenbeispiel R-A25b-1: ein gespieltes Spiel auf Toms Feld 1 öffnet Olli ohne Übernahme nicht (NOT_CONTROLLER, bleibt beendet)" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE|0:0|finished" "$(results "$OUT")|$(row_old "$M_PLAYED" | cut -d'|' -f1-2)"

  # --- @TM-004 (P): Spiele um Platz 5 und 7 ---------------------------------------------------------------
  check P "@TM-004 Olli legt das Spiel um Platz 5 (fifthSixth) an" "ok:1" \
    "$(client "$U_OLLI" "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, is_final, final_type, phase) VALUES ('$(match platz5)', '$T_NORD', 7, 1, '$TC', '$TD', 15, true, 'fifthSixth', 'final')")"
  check P "@TM-004 Olli legt das Spiel um Platz 7 (seventhEighth) an" "ok:1" \
    "$(client "$U_OLLI" "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, is_final, final_type, phase) VALUES ('$(match platz7)', '$T_NORD', 7, 2, '$TW', '$TO', 16, true, 'seventhEighth', 'final')")"
  check P "@TM-004 Gegenbeispiel: unbekannte Platzierung (ninthTenth) -> CHECK (23514)" "error:23514" \
    "$(client "$U_OLLI" "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, is_final, final_type, phase) VALUES ('$(match platz9)', '$T_NORD', 7, 2, '$TW', '$TO', 17, true, 'ninthTenth', 'final')")"
  check P "@TM-004 Gegenbeispiel: Spiel um Platz 3 (thirdPlace) bleibt erlaubt" "ok:1" \
    "$(client "$U_OLLI" "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, is_final, final_type, phase) VALUES ('$(match platz3)', '$T_NORD', 7, 1, '$TN', '$TB', 18, true, 'thirdPlace', 'final')")"
}

# run_assertions -- Rechte-Assertion als ci_schema_reader; 2 neue Namen; Namensliste = db-drift-check.sh.
A25B_ASSERTIONS="append-match-events-writes-forfeit-absent|t,matches-guard-engine-columns-forfeit-absent|t"
run_assertions() {
  local priv names_sql names_sh
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  # Spiel beenden: die Zeile der spaeteren Migration 20261110_009 ist hier f (sie laeuft erst am Ende, AFTER).
  # A-13b-S: die sechs Zeilen der spaeteren Migration 20261110_006 sind hier f (sie laeuft erst am Ende, AFTER).
  check S "Rechte-Assertion: keine Zeile |f (ausser Zeilen der spaeteren Migrationen 20261110_006 und 20261110_009)" "" \
    "$(grep -v '|t$' <<<"$priv" | grep -vE '^(append-match-events-end-by-lead-without-claim\||group-completion-|complete-group-locks-matches-before-tournament|ci-schema-reader-select-group-completion)' || true)"
  check S "Rechte-Assertion: die 2 A-25b-Zeilen vorhanden und |t" "$A25B_ASSERTIONS" \
    "$(grep -E '^(append-match-events-writes-forfeit-absent|matches-guard-engine-columns-forfeit-absent)\|' <<<"$priv" | sort | paste -sd, -)"
  check A "Rechte-Assertion append-match-events-checks-field-control bleibt |t (A-34 nicht zurueckgedreht, Auflage 4)" \
    "append-match-events-checks-field-control|t" "$(grep -E '^append-match-events-checks-field-control\|' <<<"$priv" || true)"
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Lehre A-30a: Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
  check S "Drift-Check-Zuordnung: pending_assertions_for nennt fuer $TARGET_NAME genau die 2 neuen Namen" \
    "append-match-events-writes-forfeit-absent matches-guard-engine-columns-forfeit-absent" \
    "$(awk -v n="    $TARGET_NAME)" 'index($0, n) == 1 {getline; print; exit}' "$REPO_ROOT/scripts/db-drift-check.sh" | sed -E 's/^ *echo "//; s/"$//' | tr ' ' '\n' | sort | paste -sd' ' -)"
}

summary() {
  local i
  echo
  for i in "${!CATS[@]}"; do echo "Kategorie ${CATS[$i]}: ${OKS[$i]} OK, ${DEVS[$i]} Abweichung(en)"; done
}

# setup_before [ohne_a34] -- Baseline + Migrationen vor der Ziel-Migration. Mit "fail-fast": zuerst ohne 20261110_003
# und 20261110_004, dann die Ziel-Migration (muss abbrechen), dann der Rest.
setup_before() {
  local f probe="${1:-}" held=()
  echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  psql_stdin < "$BASELINE_FILE"
  for f in "${BEFORE[@]}"; do
    if [[ "$probe" == "fail-fast" && ( "$(basename "$f")" == 20261110_003_* || "$(basename "$f")" == 20261110_004_* ) ]]; then
      held+=("$f")
      continue
    fi
    psql_stdin < "$f"
  done
  if [[ "$probe" == "fail-fast" ]]; then
    local out ec
    set +e
    out="$(psql_stdin < "$TARGET_FILE" 2>&1)"
    ec=$?
    set -e
    check F "ohne A-34 (20261110_003) bricht 20261110_005 mit Fail-fast-Meldung ab (psql Exit 3)" "3|ja" \
      "$ec|$(grep -q '20261110_005_result_entry_forfeit: Vorgaenger fehlen' <<<"$out" && echo ja || echo "nein: $out")"
    check F "dabei nichts geaendert (keine Spalte forfeit_absent, REOPEN-Ziel running)" "0|running" \
      "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'forfeit_absent';")|$(q "SELECT to_status FROM public.match_transitions WHERE from_status = 'finished' AND event_type = 'REOPEN';")"
    for f in "${held[@]}"; do psql_stdin < "$f"; done
  fi
  setup_helpers
  setup_data
}

# ---------------------------------------------------------------------------------------------------------
if [[ "$MODE" == "gegenprobe" ]]; then
  MUTATIONS=(M1 M2 M3 M4 M5 M6 M7 M8 M9 M10)
  if [[ -n "${GEGENPROBE_NUR:-}" ]]; then read -r -a MUTATIONS <<<"$GEGENPROBE_NUR"; fi
  RED_TOTAL=0
  for mut in "${MUTATIONS[@]}"; do
    start_container "$mut"
    setup_before
    MUT_KEY="$mut" F_A25A="$F_A25A" python3 -c '
import os, sys
s = sys.stdin.read()
def block(text, start):
    i = text.index(start)
    j = text.index("\n$$;\n", i) + len("\n$$;\n")
    return text[i:j]
M = {
  # M1 forfeit_absent nicht im Spaltenschutz (UPDATE-Zweig)
  "M1": [("\n       OR NEW.forfeit_absent IS DISTINCT FROM OLD.forfeit_absent THEN", " THEN")],
  # M2 REOPEN nimmt eine Wertung nicht zurueck (laeuft wie ein normales REOPEN) -- "@reopen wie running"
  "M2": [("      IF coalesce(p_state -> '\''overrides'\'', '\''[]'\''::jsonb) -> -1 ->> '\''kind'\'' = '\''forfeit'\'' THEN\n        RETURN match_engine.ok(p_state || jsonb_build_object(\n          '\''status'\'', '\''scheduled'\'',",
          "      IF false THEN\n        RETURN match_engine.ok(p_state || jsonb_build_object(\n          '\''status'\'', '\''scheduled'\'',")],
  # M3 CHECK final_type ohne seventhEighth
  "M3": [("'\''fifthSixth'\'', '\''seventhEighth'\'', '\''final'\''))", "'\''fifthSixth'\'', '\''final'\''))")],
  # M5 Wertungs-Pruefung in payload_valid weg (falscher Sieger angenommen)
  "M5": [("      IF v_payload ? '\''forfeit'\''\n         AND NOT coalesce(", "      IF false\n         AND NOT coalesce(")],
  # M6 decided_by kennt forfeit nicht (Wertung zaehlt als Direkteintrag)
  "M6": [("    WHEN p_state -> '\''overrides'\'' -> -1 ->> '\''kind'\'' = '\''forfeit'\'' THEN '\''\"forfeit\"'\''::jsonb\n", "")],
  # M7 R-A25b-1 weg: Zuruecknehmen braucht wieder die Feldsteuerung
  "M7": [("           OR (v_event ->> '\''type'\'' IN ('\''MATCH_START'\'', '\''REOPEN'\'') AND NOT v_forfeit_reopen) THEN",
          "           OR (v_event ->> '\''type'\'' IN ('\''MATCH_START'\'', '\''REOPEN'\'')) THEN")],
  # M8 R-A25b-2 weg: Wertung im K.-o. verlangt ein Strafstossergebnis
  "M8": [(" AND NOT ((v_event -> '\''payload'\'') ? '\''forfeit'\'')\n", "\n")],
  # M9 INSERT-Zweig setzt forfeit_absent nicht neutral
  "M9": [("      NEW.forfeit_absent := NULL;\n", "")],
  # M10 (Review M1) alte Zaehlung: jedes REOPEN im Spiel verbraucht das Fortsetzen, auch die Ruecknahme einer Wertung
  "M10": [("'\''REOPEN'\'') > coalesce(match_engine.num(v_undo -> '\''reopensBeforeStart'\''), 0) THEN",
           "'\''REOPEN'\'') > 0 THEN")],
}
if os.environ["MUT_KEY"] == "M4":
    # M4 (Auflage 4) append_match_events auf der Basis 20261028_003 (ohne Feldsteuerung) statt 20261110_003
    old = open(os.environ["F_A25A"], encoding="utf-8").read()
    base = block(old, "CREATE OR REPLACE FUNCTION public.append_match_events(")
    base = base.replace("      decided_by = v_cache ->> '\''decided_by'\'',\n",
                        "      decided_by = v_cache ->> '\''decided_by'\'',\n      forfeit_absent = v_cache ->> '\''forfeit_absent'\'',\n")
    cur = block(s, "CREATE OR REPLACE FUNCTION public.append_match_events(")
    s = s.replace(cur, base)
else:
    for frm, to in M[os.environ["MUT_KEY"]]:
        if s.count(frm) != 1:
            sys.exit("Gegenprobe: Muster in %s nicht genau einmal (%d): %r" % (os.environ["MUT_KEY"], s.count(frm), frm[:60]))
        s = s.replace(frm, to)
sys.stdout.write(s)' < "$TARGET_FILE" | psql_stdin
    reset_counts
    echo "--- GEGENPROBE $mut ---"
    run_probes
    run_assertions
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "GEGENPROBE $mut: rot ($(total_dev) Abweichung(en)) -- wie verlangt"
      RED_TOTAL=$((RED_TOTAL + 1))
    else
      echo "::error::GEGENPROBE $mut blieb gruen (zahnlos)"
    fi
    stop_container
  done
  echo
  echo "Gegenprobe: $RED_TOTAL von ${#MUTATIONS[@]} Mutationen rot."
  [[ "$RED_TOTAL" -eq "${#MUTATIONS[@]}" ]]
  exit $?
fi

start_container "$MODE"

if [[ "$MODE" == "without-migration" ]]; then
  setup_before
  run_probes
  summary
  N_DEV="${DEVS[$(cat_index N)]}"; P_DEV="${DEVS[$(cat_index P)]}"; R_DEV="${DEVS[$(cat_index R)]}"
  if [[ "$N_DEV" -gt 0 && "$P_DEV" -gt 0 && "$R_DEV" -gt 0 ]]; then
    echo "Ohne Migration: N, P und R rot -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (N=$N_DEV, P=$P_DEV, R=$R_DEV muessen > 0 sein)."
  exit 1
fi

setup_before fail-fast

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$(schema_public)")"
TRANS_BEFORE="$(transitions_state)"
DATA_BEFORE="$(q "SELECT (SELECT count(*) FROM public.match_events) || '|' || (SELECT count(*) FROM public.matches) || '|' || (SELECT count(*) FROM public.match_transitions);")"
echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE"

# --- S: Schema ---------------------------------------------------------------------------------------------
check S "Bestand: Ereignisse, Spiele, Uebergaenge gleich viele (nur eine Uebergangszeile geaendert)" "$DATA_BEFORE" \
  "$(q "SELECT (SELECT count(*) FROM public.match_events) || '|' || (SELECT count(*) FROM public.matches) || '|' || (SELECT count(*) FROM public.match_transitions);")"
check S "Uebergang (finished, REOPEN) zeigt auf @reopen (Akteur helper bleibt), sonst Tabelle unveraendert" \
  "$(sed 's#finished/REOPEN/helper/running#finished/REOPEN/helper/@reopen#' <<<"$TRANS_BEFORE")" "$(transitions_state)"
check S "Seed = matchTransitions.json (Zeile REOPEN)" "finished|REOPEN|helper|@reopen" \
  "$(jq -r '.transitions[] | select(.from == "finished" and .type == "REOPEN") | "\(.from)|\(.type)|\(.actor)|\(.to)"' "$REPO_ROOT/src/core/match/matchTransitions.json")"
check S "Spalte forfeit_absent: text, NULL im Bestand, CHECK A|B|both" "text|0|CHECK (((forfeit_absent IS NULL) OR (forfeit_absent = ANY (ARRAY['A'::text, 'B'::text, 'both'::text]))))" \
  "$(q "SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'forfeit_absent';")|$(q "SELECT count(*) FROM public.matches WHERE forfeit_absent IS NOT NULL;")|$(q "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'matches_forfeit_absent_check';")"
check S "Engine-Zaehlung bleibt 52 (keine neue Funktion, R-A25b-3) und append_match_events-Rechte unveraendert" "52|true|false|false" \
  "$(q "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'match_engine' OR (n.nspname = 'public' AND p.proname IN ('match_initial_state', 'match_apply_event', 'match_continue', 'match_reduce', 'match_server_state', 'compute_match_state'));")|$(q "SELECT has_function_privilege('authenticated', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE') || '|' || has_function_privilege('anon', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE') || '|' || has_function_privilege('service_role', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE');")"
COUNTS_AFTER="$(counts "$(schema_public)")"
for dim in tables columns functions triggers policies indexes rls_tables; do
  case "$dim" in columns) expected=1 ;; *) expected=0 ;; esac
  check S "Katalogzaehlung $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
DUMP_AFTER="$(schema_dump)"

run_probes
run_assertions

# --- W: idempotent -----------------------------------------------------------------------------------------
DATA_W="$(q "SELECT string_agg(id || ':' || coalesce(score_a::text, '-') || ':' || coalesce(score_b::text, '-') || ':' || match_status || ':' || coalesce(decided_by, '-') || ':' || coalesce(forfeit_absent, '-') || ':' || coalesce(final_type, '-'), ',' ORDER BY id) FROM public.matches;")"
TRANS_W="$(transitions_state)"
set +e
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
W_EXIT=$?
set -e
check W "zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check W "danach Spiele und Uebergaenge unveraendert, Schema (public + match_engine) wie nach dem ersten Einspielen" "gleich|gleich|identisch" \
  "$([[ "$(q "SELECT string_agg(id || ':' || coalesce(score_a::text, '-') || ':' || coalesce(score_b::text, '-') || ':' || match_status || ':' || coalesce(decided_by, '-') || ':' || coalesce(forfeit_absent, '-') || ':' || coalesce(final_type, '-'), ',' ORDER BY id) FROM public.matches;")" == "$DATA_W" ]] && echo gleich || echo verschieden)|$([[ "$(transitions_state)" == "$TRANS_W" ]] && echo gleich || echo verschieden)|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg (Anhang B) -------------------------------------------------------------------------------
set +e
X_OUT="$(rueckweg_sql 2>/dev/null | psql_stdin 2>&1)"
X_EXIT=$?
set -e
check X "Rueckweg haelt bei Spielen um Platz 5/7 an (Meldung), nichts geaendert" "3|ja|identisch" \
  "$X_EXIT|$(grep -q 'Spiele um Platz 5/7 vorhanden' <<<"$X_OUT" && echo ja || echo "nein: $X_OUT")|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"
q "DELETE FROM public.matches WHERE final_type IN ('fifthSixth', 'seventhEighth');" >/dev/null
rueckweg_sql | psql_stdin
DUMP_ROLLED_BACK="$(schema_dump)"
check X "nach dem Rueckweg: Schema public + match_engine = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi
check X "nach dem Rueckweg: Uebergaenge wie vorher (REOPEN -> running), Wertungen im Zwischenspeicher 'regular'" "gleich|0|0:0|finished|regular" \
  "$([[ "$(transitions_state)" == "$TRANS_BEFORE" ]] && echo gleich || echo verschieden)|$(q "SELECT count(*) FROM public.matches WHERE decided_by = 'forfeit';")|$(row_old "$M_WO")"
ev RESULT_ENTRY "$(E rollback-direkt)" "$(forfeit "$TN" "$TU" 1 0 "")"
send "$U_OLLI" "$D_OLLI" "$M_TRAINER"
check X "nach dem Rueckweg: ein Direkteintrag geht wieder den alten Weg (1:0, regular)" "accepted|1:0|finished|regular" "$(results "$OUT")|$(row_old "$M_TRAINER")"
psql_stdin < "$TARGET_FILE"
check X "danach erneut einspielbar (Schema = erstes Einspielen)" "identisch" "$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f"
  echo "OK    spaetere Migration laeuft: $(basename "$f")" >&2
done

summary
echo
echo "Ergebnis: $(total_dev) Abweichung(en)."
[[ "$(total_dev)" -eq 0 ]]
