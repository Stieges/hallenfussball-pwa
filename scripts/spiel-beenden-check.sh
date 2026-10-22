#!/usr/bin/env bash
#
# spiel-beenden-check.sh — Container-Beweis fuer supabase/migrations/20261110_009_spiel_beenden.sql (Spiel im Spielplan
# beenden und Ergebnis eintragen, Variante A mit Review-Auflagen M1-M4). Muster: scripts/forfeit-check.sh (Wegwerf-
# Container supabase/postgres, nativ, Baseline + Migrationen seit Baseline, Aufraeumen per trap, --without-migration,
# --gegenprobe, --print-rueckweg).
#
# Testwerte aus dem Gherkin: „Hallencup Nord“, Turnierleitung Olli (Eigentuemer, Tablet und Handy), Co-Admin Maria, Helfer
# Tom (Handy, Geraetesitzung), Trainer Rot; Spiel 9 auf Feld 2 (Toms Handy steuert), Halbfinale 1/2 (K.-o., Strafstoss).
# Alle Eintraege laufen ueber append_match_events (echter Weg), Uhrzeiten wie forfeit-check.sh (kleine `at`, Server klemmt).
#
# Kategorien:
#   F  Fail-fast: ohne 20261110_005 bricht 20261110_009 mit Meldung ab und aendert nichts.
#   E  Ende im Spielplan: @FU-112 (laufend, eigenes zweites Geraet, Uhr steht, Protokoll „von Olli“), @FU-114 (Spielzeit
#      abgelaufen, Zuschauer-Spalten), @FU-115 (Toms Geraet steuert -- ohne Uebernahme, Tom pfeift das naechste Spiel an,
#      Olli nicht), Co-Admin aus der Pause, K.-o.-Unentschieden mit Strafstoss (@FU-094), @FU-080 (geplant wie bisher).
#   G  Gegenbeispiele: @FU-113 Helfer (Halter -> FORBIDDEN_ACTOR, nicht Halter -> NOT_CONTROLLER, freies Feld ohne
#      Anspruch), Trainer, @FU-116 (Tor vorher -> STALE_BASE, ohne basedOn -> STALE_BASE, Tor danach -> MATCH_FINISHED),
#      @FU-118 (Strafstossschiessen -> abgelehnt), @FU-119 (Wertung aus running -> FORFEIT_NOT_SCHEDULED), Review M3
#      (freies Feld: kein Anspruch), K.-o.-Unentschieden ohne Strafstoss -> SHOOTOUT_REQUIRED.
#   S  Schema: genau vier neue Uebergaenge, Funktionszahl gleich, Rechte unveraendert, Rechte-Assertion |t, Namensliste
#      und Zuordnung in db-drift-check.sh.
#   W  zweites Einspielen (idempotent): Exit 0, Schema (public + match_engine) und Uebergaenge gleich.
#   X  Rueckweg (--print-rueckweg, Anhang B der Freigabe): haelt an, solange ein Ergebnis mit basedOn gespeichert ist;
#      danach Schema und Uebergaenge = vor der Migration, ein laufendes Spiel laesst sich nicht mehr beenden; erneut einspielbar.
#
# Aufrufoptionen:
#   bash scripts/spiel-beenden-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/spiel-beenden-check.sh --without-migration  Gegenprobe: ohne 20261110_009 -> E muss ROT sein
#   bash scripts/spiel-beenden-check.sh --gegenprobe         je Lauf eine Mutation der Migration (M1-M9); Exit 0 NUR, wenn
#                                                            JEDE Mutation mindestens eine Pruefung rot faerbt
#   bash scripts/spiel-beenden-check.sh --print-rueckweg     gibt den Rueckweg (Anhang B der Freigabe) aus, ohne Container
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container (nativ,
# per DOCKER_PLATFORM ueberschreibbar), wird am Ende entfernt (trap). Harness-Hilfen liegen im Schema "harness".
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

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie forfeit-check.sh
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}" # leer = Plattform des Rechners (nativ)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261110_009_spiel_beenden.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
BASE_FILE="$MIGRATIONS_DIR/20261110_005_result_entry_forfeit.sql"
CONTAINER_PREFIX="spiel-beenden-check-$$"
CURRENT_CONTAINER=""

# fn_block <Datei> <Funktionsanfang> -- die Funktion woertlich (CREATE OR REPLACE ... bis zur Zeile "$$;").
fn_block() { awk -v pat="$2" 'index($0, pat) == 1 {f = 1} f {print} f && $0 == "$$;" {exit}' "$1"; }

# Rueckweg (Anhang B): anhalten bei gespeicherten Ergebnissen mit basedOn, vier Uebergaenge weg, Funktionen woertlich aus
# 20261110_005, Rechte wie vorher.
rueckweg_sql() {
  echo "-- Rueckweg Spiel beenden (20261110_009_spiel_beenden.sql), erzeugt von scripts/spiel-beenden-check.sh --print-rueckweg"
  echo "-- Vorher: App ohne „Spiel beenden“ (sendet kein RESULT_ENTRY mit basedOn). Vorab zaehlen (Freigabe-Unterlage § 7)."
  echo "BEGIN;"
  echo "SET LOCAL lock_timeout = '5s';"
  echo "DO \$\$"
  echo "BEGIN"
  echo "  IF EXISTS (SELECT 1 FROM public.match_events WHERE type = 'RESULT_ENTRY' AND event_format IS NOT NULL AND payload ? 'basedOn') THEN"
  echo "    RAISE EXCEPTION 'Rueckweg 20261110_009: im Spielplan beendete Spiele vorhanden -- sie liefen nach dem Rueckweg beim Nachrechnen wieder; vorher klaeren';"
  echo "  END IF;"
  echo "END;"
  echo "\$\$;"
  echo "DELETE FROM public.match_transitions WHERE event_type = 'RESULT_ENTRY'"
  echo "   AND from_status IN ('running', 'paused', 'section_break', 'decision_pending');"
  echo "-- payload_valid, apply_result_entry, apply_effect, append_match_events woertlich aus 20261110_005_result_entry_forfeit.sql"
  fn_block "$BASE_FILE" "CREATE OR REPLACE FUNCTION match_engine.payload_valid("
  fn_block "$BASE_FILE" "CREATE OR REPLACE FUNCTION match_engine.apply_result_entry("
  fn_block "$BASE_FILE" "CREATE OR REPLACE FUNCTION match_engine.apply_effect("
  fn_block "$BASE_FILE" "CREATE OR REPLACE FUNCTION public.append_match_events("
  echo "-- Rechte wie vorher (unveraendert)"
  echo "REVOKE ALL ON FUNCTION match_engine.payload_valid(jsonb, jsonb), match_engine.apply_result_entry(jsonb, jsonb, jsonb),"
  echo "  match_engine.apply_effect(jsonb, jsonb, jsonb) FROM PUBLIC;"
  echo "GRANT EXECUTE ON FUNCTION match_engine.payload_valid(jsonb, jsonb), match_engine.apply_result_entry(jsonb, jsonb, jsonb),"
  echo "  match_engine.apply_effect(jsonb, jsonb, jsonb) TO authenticated, anon, service_role;"
  echo "REVOKE ALL ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) FROM PUBLIC, anon, service_role;"
  echo "GRANT EXECUTE ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) TO authenticated;"
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
  docker run -d ${DOCKER_PLATFORM:+--platform "$DOCKER_PLATFORM"} --name "$CURRENT_CONTAINER" -e POSTGRES_PASSWORD=postgres -p 5432 "$POSTGRES_IMAGE" >/dev/null
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
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public --schema=match_engine postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }
transitions_state() { q "SELECT string_agg(from_status || '/' || event_type || '/' || actor || '/' || to_status, ',' ORDER BY from_status, event_type) FROM public.match_transitions;"; }

# Zaehler je Kategorie (bash 3.2: keine assoziativen Arrays).
CATS=(F E G S W X)
DEVS=(0 0 0 0 0 0)
OKS=(0 0 0 0 0 0)
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
reset_counts() { DEVS=(0 0 0 0 0 0); OKS=(0 0 0 0 0 0); }

uuid_for() {
  local h
  h="$(printf '%s' "spiel-beenden-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_TRAINER="$(uuid_for user:trainer)"
U_TOM="$(uuid_for user:tom-handy)"
ANON_UIDS=" $U_TOM "
D_OLLI="$(uuid_for device:olli-tablet)"; D_OLLI_HANDY="$(uuid_for device:olli-handy)"; D_TOM="$(uuid_for device:tom-handy)"
T_NORD="$(uuid_for tournament:hallencup-nord)"
team() { uuid_for "team:$1"; }
TN="$(team fc-nord)"; TS="$(team sv-sued)"; TW="$(team tsv-west)"; TO="$(team sc-ost)"; TB="$(team djk-berg)"; TM="$(team sg-mitte)"
match() { uuid_for "match:$1"; }
M9="$(match spiel-9)"; M10="$(match spiel-10)"; M11="$(match spiel-11)"; M12="$(match spiel-12)"; M13="$(match spiel-13)"
M14="$(match spiel-14)"; M15="$(match spiel-15)"; M16="$(match spiel-16)"; M17="$(match spiel-17)"
M_HF1="$(match hf1)"; M_HF2="$(match hf2)"
E() { uuid_for "event:$1"; }

EVS=""
ev() {
  local extra="${3:-}" one
  [[ -z "$extra" ]] && extra='{}'
  one="$(jq -cn --arg type "$1" --arg id "$2" --argjson extra "$extra" \
    '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, teamId: null, targetId: null, payload: {}} + $extra')"
  EVS="$EVS$one"$'\n'
}
# ende <A> <B> <a> <b> <at> <basedOn|leer=null|-=fehlt> [Zusatz-Payload-JSON] -- RESULT_ENTRY ohne Uhrstand (Server rechnet)
ende() {
  local extra="${7:-}"
  [[ -z "$extra" ]] && extra='{}'
  jq -cn --arg a "$1" --arg b "$2" --argjson sa "$3" --argjson sb "$4" --argjson at "$5" --arg based "$6" --argjson extra "$extra" \
    '{at: $at, clockMs: null, section: null,
      payload: ({scores: {($a): $sa, ($b): $sb}}
                + (if $based == "-" then {} elif $based == "" then {basedOn: null} else {basedOn: $based} end)
                + $extra)}'
}
goal() { jq -cn --arg t "$1" --argjson at "$2" '{at: $at, clockMs: ($at - 1000), teamId: $t}'; }
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
row() { q "SELECT coalesce(score_a::text, '-') || ':' || coalesce(score_b::text, '-') || '|' || coalesce(match_status, '-') || '|' || coalesce(decided_by, '-') FROM public.matches WHERE id = '$1';"; }
# Zuschauer-Sicht: was Realtime/public_payload aus der Zeile lesen (Uhr, Live-Zustand, Ende).
viewer() { q "SELECT coalesce(match_status, '-') || '|' || (timer_start_time IS NULL) || '|' || (live_state IS NULL) || '|' || (actual_end IS NOT NULL) FROM public.matches WHERE id = '$1';"; }
holder() { q "SELECT coalesce(holder_user_id::text, '-') || '|' || coalesce(holder_device_id::text, '-') || '|' || epoch FROM public.field_control WHERE tournament_id = '$T_NORD' AND field = $1;"; }
cms() { q "SELECT harness.cms('$1'::uuid, '$2'::uuid);"; }
author() { q "SELECT harness.author('$1'::uuid, '$2'::uuid, '$3'::uuid);"; }

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
-- compute_match_state als Nutzer: Status|Uhr laeuft|effektiver Stand
CREATE FUNCTION harness.cms(p_user uuid, p_match uuid) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb; m public.matches%ROWTYPE;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match;
  PERFORM harness.claims(p_user, false, 'authenticated');
  v := public.compute_match_state(p_match);
  PERFORM set_config('role', 'postgres', true);
  RETURN (v ->> 'status') || '|' || coalesce(v -> 'clock' ->> 'running', '-') || '|'
         || coalesce(v -> 'effectiveScores' ->> m.team_a_id::text, '-') || ':' || coalesce(v -> 'effectiveScores' ->> m.team_b_id::text, '-');
END;
$fn$;
-- Protokoll: Name|Rolle des Urhebers eines Eintrags (match_event_author_names als Nutzer)
CREATE FUNCTION harness.author(p_user uuid, p_match uuid, p_event uuid) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v text;
BEGIN
  PERFORM harness.claims(p_user, false, 'authenticated');
  SELECT coalesce(a.author_name, '-') || '|' || coalesce(a.author_role, '-') INTO v
    FROM public.match_event_author_names(p_match) a WHERE a.event_id = p_event;
  PERFORM set_config('role', 'postgres', true);
  RETURN coalesce(v, 'kein-eintrag');
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
FROM (VALUES ('$U_OLLI'::uuid, 'olli@sb.test'), ('$U_MARIA'::uuid, 'maria@sb.test'), ('$U_TRAINER'::uuid, 'trainer@sb.test'),
             ('$U_TOM'::uuid, NULL)) AS u(id, email);
INSERT INTO public.profiles (id, display_name, email)
VALUES ('$U_OLLI', 'Olli', 'olli@sb.test'), ('$U_MARIA', 'Maria', 'maria@sb.test'), ('$U_TRAINER', 'Trainer Rot', 'trainer@sb.test')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config, finals_config)
VALUES ('$T_NORD', '$U_OLLI', 'Hallencup Nord', '2026-11-28', 6, 10, '{}'::jsonb, '{"tiebreaker": "shootout"}'::jsonb);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) VALUES
  ('$T_NORD', '$U_MARIA', 'co-admin', now(), 'Maria'), ('$T_NORD', '$U_TOM', 'helper', now(), 'Tom'),
  ('$T_NORD', '$U_TRAINER', 'trainer', now(), 'Trainer Rot');
INSERT INTO public.teams (id, tournament_id, name) VALUES
  ('$TN', '$T_NORD', 'FC Nord'), ('$TS', '$T_NORD', 'SV Süd'), ('$TW', '$T_NORD', 'TSV West'), ('$TO', '$T_NORD', 'SC Ost'),
  ('$TB', '$T_NORD', 'DJK Berg'), ('$TM', '$T_NORD', 'SG Mitte');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start, group_letter) VALUES
  ('$M9', '$T_NORD', 1, 2, '$TN', '$TS', 9, '14:00', 'A'),
  ('$M10', '$T_NORD', 2, 2, '$TW', '$TO', 10, '14:15', 'A'),
  ('$M11', '$T_NORD', 3, 2, '$TB', '$TM', 11, '14:30', 'B'),
  ('$M12', '$T_NORD', 1, 1, '$TB', '$TM', 12, '14:00', 'B'),
  ('$M13', '$T_NORD', 1, 3, '$TN', '$TW', 13, '14:00', 'A'),
  ('$M14', '$T_NORD', 1, 4, '$TS', '$TO', 14, '14:00', 'A'),
  ('$M15', '$T_NORD', 1, 5, '$TN', '$TO', 15, '14:00', 'A'),
  ('$M16', '$T_NORD', 1, 6, '$TS', '$TW', 16, '14:00', 'A'),
  ('$M17', '$T_NORD', 1, 9, '$TB', '$TN', 17, '14:00', 'A');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start, is_final, final_type, phase) VALUES
  ('$M_HF1', '$T_NORD', 6, 7, '$TN', '$TB', 21, '16:00', true, 'semifinal', 'final'),
  ('$M_HF2', '$T_NORD', 6, 8, '$TS', '$TM', 22, '16:00', true, 'semifinal', 'final');
UPDATE public.matches SET score_a = NULL, score_b = NULL WHERE tournament_id = '$T_NORD';
SQL
}

# ---------------------------------------------------------------------------------------------------------
# Proben E und G (gemeinsam fuer normalen Lauf, ohne Migration und Gegenprobe)
# ---------------------------------------------------------------------------------------------------------
run_probes() {
  local epoch_before

  # --- @FU-115 / @FU-116: Toms Handy steuert Feld 2, Spiel 9 laeuft, Toms Tor zum 1:0 ------------------------
  ev MATCH_START "$(E m9-start)" '{"clockMs": null}'
  ev GOAL "$(E m9-tor)" "$(goal "$TN" 60000)"
  send "$U_TOM" "$D_TOM" "$M9"
  epoch_before="$(holder 2)"
  ev RESULT_ENTRY "$(E m9-alt)" "$(ende "$TN" "$TS" 3 1 61000 "")"
  send "$U_OLLI" "$D_OLLI" "$M9"
  check G "@FU-116 Toms Tor kam vor Ollis Eintrag an: Eintrag auf dem alten Stand -> STALE_BASE, Spiel 9 läuft weiter" \
    "rejected:STALE_BASE|1:0|running" "$(results "$OUT")|$(row "$M9" | cut -d'|' -f1-2)"
  ev RESULT_ENTRY "$(E m9-ohne-basis)" "$(ende "$TN" "$TS" 3 1 61000 "-")"
  send "$U_OLLI" "$D_OLLI" "$M9"
  check G "@FU-116 Review M4: ohne basedOn aus einem laufenden Spiel -> STALE_BASE (Pflicht)" "rejected:STALE_BASE" "$(results "$OUT")"
  ev RESULT_ENTRY "$(E m9-ende)" "$(ende "$TN" "$TS" 3 1 62000 "$(E m9-tor)")"
  send "$U_OLLI" "$D_OLLI" "$M9"
  check E "@FU-115 Toms Gerät steuert Feld 2: Olli beendet Spiel 9 im Spielplan mit 3:1 (ohne Übernahme) -> beendet 3:1" \
    "accepted|3:1|finished|regular" "$(results "$OUT")|$(row "$M9")"
  check E "@FU-115 Feld 2 wird weiter von Toms Gerät gesteuert (Halter, Gerät und Epoche unverändert)" "$epoch_before" "$(holder 2)"
  check E "@FU-112 @FU-114 Zuschauer: Spiel 9 ist „Ende“ -- Uhr weg, kein Live-Zustand, Spielende gesetzt" "finished|true|true|true" "$(viewer "$M9")"
  check E "@FU-112 Uhr steht (compute_match_state), Stand 3:1" "finished|false|3:1" "$(cms "$U_OLLI" "$M9")"
  check E "@FU-112 Protokoll: „Ergebnis eingetragen von Olli“ (Urheber des Eintrags)" "Olli|owner" "$(author "$U_OLLI" "$M9" "$(E m9-ende)")"
  ev GOAL "$(E m9-tor-spaet)" "$(goal "$TN" 63000)"
  send "$U_TOM" "$D_TOM" "$M9"
  check G "@FU-116 Toms Tor kam nach Ollis Eintrag an -> MATCH_FINISHED (Klärungsliste), Spiel 9 bleibt 3:1" \
    "rejected:MATCH_FINISHED|3:1|finished" "$(results "$OUT")|$(row "$M9" | cut -d'|' -f1-2)"

  # --- @FU-115: das naechste Spiel auf Feld 2 pfeift Tom an wie gewohnt; Olli muesste uebernehmen ------------
  ev MATCH_START "$(E m10-start)" '{"at": 70000, "clockMs": null}'
  send "$U_TOM" "$D_TOM" "$M10"
  check E "@FU-115 Tom pfeift das nächste Spiel 10 auf Feld 2 an wie gewohnt" "accepted" "$(results "$OUT")"
  ev MATCH_START "$(E m11-olli)" '{"at": 70000, "clockMs": null}'
  send "$U_OLLI" "$D_OLLI" "$M11"
  check E "@FU-115 will Olli ein Spiel auf Feld 2 selbst anpfeifen, muss er übernehmen (NOT_CONTROLLER, @FU-081)" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE" "$(results "$OUT")"

  # --- @FU-113: Helfer Tom (Halter von Feld 2) beendet Spiel 10 nicht -----------------------------------------
  ev RESULT_ENTRY "$(E m10-tom)" "$(ende "$TW" "$TO" 2 0 71000 "")"
  ev RESULT_ENTRY "$(E m10-tom-wertung)" "$(ende "$TW" "$TO" 0 2 71000 "" '{"forfeit": {"absent": "A"}}')"
  send "$U_TOM" "$D_TOM" "$M10"
  check G "@FU-113 Helfer Tom (steuert Feld 2) beendet Spiel 10 nicht -- auch nicht als Wertung (FORBIDDEN_ACTOR), läuft weiter" \
    "rejected:FORBIDDEN_ACTOR,rejected:FORBIDDEN_ACTOR|0:0|running" "$(results "$OUT")|$(row "$M10" | cut -d'|' -f1-2)"
  ev RESULT_ENTRY "$(E m10-trainer)" "$(ende "$TW" "$TO" 2 0 71000 "")"
  send "$U_TRAINER" "" "$M10"
  check G "Trainer Rot ohne Recht -> FORBIDDEN_ACTOR, nichts gespeichert" "rejected:FORBIDDEN_ACTOR|running" "$(results "$OUT")|$(row "$M10" | cut -d'|' -f2)"
  ev RESULT_ENTRY "$(E m10-olli-ohne-basis)" "$(ende "$TW" "$TO" 2 0 72000 "-")"
  send "$U_OLLI" "$D_OLLI" "$M10"
  check G "@FU-081 präzisiert: der einfache Eintrag (ohne Stand) in ein laufendes Spiel bleibt abgelehnt (STALE_BASE)" \
    "rejected:STALE_BASE|running" "$(results "$OUT")|$(row "$M10" | cut -d'|' -f2)"

  # --- @FU-112: Olli hat Spiel 12 mit dem Tablet angepfiffen (steuert Feld 1), beendet es mit dem Handy ------
  ev MATCH_START "$(E m12-start)" '{"clockMs": null}'
  send "$U_OLLI" "$D_OLLI" "$M12"
  epoch_before="$(holder 1)"
  ev RESULT_ENTRY "$(E m12-tom)" "$(ende "$TB" "$TM" 1 0 2000 "")"
  send "$U_TOM" "$D_TOM" "$M12"
  check G "@FU-113 Helfer Tom ist nicht Halter von Feld 1 -> NOT_CONTROLLER, Spiel 12 läuft weiter" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE|running" "$(results "$OUT")|$(row "$M12" | cut -d'|' -f2)"
  ev RESULT_ENTRY "$(E m12-ende)" "$(ende "$TB" "$TM" 2 0 121000 "")"
  send "$U_OLLI" "$D_OLLI_HANDY" "$M12"
  check E "@FU-112 Ollis Akku: er beendet Spiel 12 mit dem Handy im Spielplan mit 2:0 -> beendet, Uhr steht" \
    "accepted|2:0|finished|regular|finished|false|2:0" "$(results "$OUT")|$(row "$M12")|$(cms "$U_OLLI" "$M12")"
  check E "@FU-112 Feld 1 behält Ollis Tablet als Halter (das Handy beansprucht nichts)" "$epoch_before" "$(holder 1)"

  # --- Co-Admin Maria beendet ein pausiertes Spiel (leadMatches, ohne Geraete-ID) -------------------------------
  ev MATCH_START "$(E m13-start)" '{"clockMs": null}'
  ev PAUSE "$(E m13-pause)" '{"at": 61000, "clockMs": null}'
  send "$U_OLLI" "$D_OLLI" "$M13"
  ev RESULT_ENTRY "$(E m13-ende)" "$(ende "$TN" "$TW" 1 1 90000 "")"
  send "$U_MARIA" "" "$M13"
  check E "@FU-112 Co-Admin Maria beendet das pausierte Spiel 13 mit 1:1 (Gruppenspiel, kein Strafstoß)" \
    "accepted|1:1|finished|regular|finished|true|true|true" "$(results "$OUT")|$(row "$M13")|$(viewer "$M13")"

  # --- @FU-114: Spielzeit abgelaufen, Abpfiff vergessen (Toms Handy steuert Feld 4) ---------------------------
  ev MATCH_START "$(E m14-start)" '{"clockMs": null}'
  send "$U_TOM" "$D_TOM" "$M14"
  check E "@FU-114 vorher: Spiel 14 läuft weiter (live), Uhr läuft" "running|false|false|false" "$(viewer "$M14")"
  ev RESULT_ENTRY "$(E m14-ende)" "$(ende "$TS" "$TO" 2 2 1300000 "")"
  send "$U_OLLI" "$D_OLLI" "$M14"
  check E "@FU-114 nach abgelaufener Spielzeit beendet Olli Spiel 14 mit 2:2 -> beendet, für Zuschauer „Ende“ statt „Live“" \
    "accepted|2:2|finished|regular|finished|true|true|true" "$(results "$OUT")|$(row "$M14")|$(viewer "$M14")"

  # --- Review M3: freies Feld 5 (Anpfiff ohne Geraete-ID) -- das Beenden beansprucht es nicht ---------------
  ev MATCH_START "$(E m15-start)" '{"clockMs": null}'
  send "$U_OLLI" "" "$M15"
  ev RESULT_ENTRY "$(E m15-tom)" "$(ende "$TN" "$TO" 0 1 2000 "")"
  send "$U_TOM" "$D_TOM" "$M15"
  check G "@FU-113 Helfer Tom auf dem freien Feld 5 -> FORBIDDEN_ACTOR, kein Anspruch (Feld bleibt frei)" \
    "rejected:FORBIDDEN_ACTOR|running|-|-|0" "$(results "$OUT")|$(row "$M15" | cut -d'|' -f2)|$(holder 5)"
  ev RESULT_ENTRY "$(E m15-ende)" "$(ende "$TN" "$TO" 0 1 3000 "")"
  send "$U_OLLI" "$D_OLLI_HANDY" "$M15"
  check G "Review M3: Olli beendet Spiel 15 auf dem freien Feld 5 mit Geräte-ID -> angenommen, Feld bleibt frei (kein verdeckter Anspruch)" \
    "accepted|finished|-|-|0" "$(results "$OUT")|$(row "$M15" | cut -d'|' -f2)|$(holder 5)"

  # --- @FU-119: ein angepfiffenes Spiel laesst sich nicht als Nichtantritt werten ----------------------------
  ev MATCH_START "$(E m16-start)" '{"clockMs": null}'
  send "$U_OLLI" "$D_OLLI" "$M16"
  ev RESULT_ENTRY "$(E m16-wertung)" "$(ende "$TS" "$TW" 0 2 2000 "" '{"forfeit": {"absent": "A"}}')"
  send "$U_OLLI" "$D_OLLI" "$M16"
  check G "@FU-119 Olli wertet das laufende Spiel 16 nicht als Nichtantritt (INVALID_TRANSITION FORFEIT_NOT_SCHEDULED), läuft weiter" \
    "rejected:INVALID_TRANSITION:FORFEIT_NOT_SCHEDULED|0:0|running" "$(results "$OUT")|$(row "$M16" | cut -d'|' -f1-2)"

  # --- @FU-094 analog: K.-o.-Unentschieden aus dem laufenden Halbfinale 2 -------------------------------------
  ev MATCH_START "$(E hf2-start)" '{"clockMs": null}'
  send "$U_TOM" "$D_TOM" "$M_HF2"
  ev RESULT_ENTRY "$(E hf2-remis)" "$(ende "$TS" "$TM" 1 1 2000 "")"
  send "$U_OLLI" "$D_OLLI" "$M_HF2"
  check G "@FU-094 Halbfinale 2 mit 1:1 ohne Strafstoß beenden -> SHOOTOUT_REQUIRED, läuft weiter" \
    "rejected:INVALID_PAYLOAD:SHOOTOUT_REQUIRED|running" "$(results "$OUT")|$(row "$M_HF2" | cut -d'|' -f2)"
  ev RESULT_ENTRY "$(E hf2-ende)" "$(ende "$TS" "$TM" 1 1 3000 "" "$(jq -cn --arg a "$TS" --arg b "$TM" '{shootout: {($a): 4, ($b): 3}}')")"
  send "$U_OLLI" "$D_OLLI" "$M_HF2"
  check E "@FU-094 @FU-112 Halbfinale 2 mit 1:1 und Strafstoß 4:3 beendet (Sieger Heim, decided_by penalty)" \
    "accepted|1:1|finished|penalty|4:3" "$(results "$OUT")|$(row "$M_HF2")|$(q "SELECT penalty_score_a || ':' || penalty_score_b FROM public.matches WHERE id = '$M_HF2';")"

  # --- @FU-118: waehrend des Strafstossschiessens nicht im Spielplan beenden ---------------------------------
  ev MATCH_START "$(E hf1-start)" '{"clockMs": null}'
  ev MATCH_END "$(E hf1-ende)" '{"at": 2000, "clockMs": 600000}'
  send "$U_TOM" "$D_TOM" "$M_HF1"
  check G "Vorbereitung @FU-118: Halbfinale 1 endet 0:0 -> Strafstoßschießen" "accepted,accepted|shootout" "$(results "$OUT")|$(cms "$U_OLLI" "$M_HF1" | cut -d'|' -f1)"
  ev RESULT_ENTRY "$(E hf1-olli)" "$(ende "$TN" "$TB" 0 0 3000 "" "$(jq -cn --arg a "$TN" --arg b "$TB" '{shootout: {($a): 4, ($b): 3}}')")"
  send "$U_OLLI" "$D_OLLI" "$M_HF1"
  check G "@FU-118 im laufenden Strafstoßschießen beendet Olli das Halbfinale 1 nicht (abgelehnt), es bleibt im Strafstoßschießen" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE|shootout" "$(results "$OUT")|$(cms "$U_OLLI" "$M_HF1" | cut -d'|' -f1)"

  # --- @FU-080: ein geplantes Spiel wie bisher (ohne basedOn, kein Anspruch) ----------------------------------
  ev RESULT_ENTRY "$(E m17-direkt)" "$(ende "$TB" "$TN" 3 1 2000 "-")"
  send "$U_OLLI" "$D_OLLI" "$M17"
  check E "@FU-080 Gegenbeispiel: geplantes Spiel 17 direkt 3:1 eintragen wie bisher (ohne Stand), kein Feldanspruch" \
    "accepted|3:1|finished|regular|-|-|0" "$(results "$OUT")|$(row "$M17")|$(holder 9)"
}

# run_assertions -- Rechte-Assertion als ci_schema_reader; 1 neuer Name; Namensliste = db-drift-check.sh.
SB_ASSERTION="append-match-events-end-by-lead-without-claim"
run_assertions() {
  local priv names_sql names_sh
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  check S "Rechte-Assertion: keine Zeile |f" "" "$(grep -v '|t$' <<<"$priv" || true)"
  check S "Rechte-Assertion: $SB_ASSERTION vorhanden und |t" "$SB_ASSERTION|t" "$(grep -E "^$SB_ASSERTION\|" <<<"$priv" || true)"
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Lehre A-30a: Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
  check S "Drift-Check-Zuordnung: pending_assertions_for nennt fuer $TARGET_NAME genau den neuen Namen" "$SB_ASSERTION" \
    "$(awk -v n="    $TARGET_NAME)" 'index($0, n) == 1 {getline; print; exit}' "$REPO_ROOT/scripts/db-drift-check.sh" | sed -E 's/^ *echo "//; s/"$//')"
}

summary() {
  local i
  echo
  for i in "${!CATS[@]}"; do echo "Kategorie ${CATS[$i]}: ${OKS[$i]} OK, ${DEVS[$i]} Abweichung(en)"; done
}

# setup_before [fail-fast] -- Baseline + Migrationen vor der Ziel-Migration. Mit "fail-fast": zuerst ohne 20261110_005,
# dann die Ziel-Migration (muss abbrechen), dann der Rest.
setup_before() {
  local f probe="${1:-}" held=()
  echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  psql_stdin < "$BASELINE_FILE"
  for f in "${BEFORE[@]}"; do
    if [[ "$probe" == "fail-fast" && "$(basename "$f")" > "20261110_004_~" ]]; then
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
    check F "ohne 20261110_005 bricht 20261110_009 mit Fail-fast-Meldung ab (psql Exit 3)" "3|ja" \
      "$ec|$(grep -q '20261110_009_spiel_beenden: Vorgaenger fehlen' <<<"$out" && echo ja || echo "nein: $out")"
    check F "dabei nichts geaendert (kein Uebergang RESULT_ENTRY aus running)" "0" \
      "$(q "SELECT count(*) FROM public.match_transitions WHERE from_status = 'running' AND event_type = 'RESULT_ENTRY';")"
    for f in ${held[@]+"${held[@]}"}; do psql_stdin < "$f"; done
  fi
  setup_helpers
  setup_data
}

# ---------------------------------------------------------------------------------------------------------
if [[ "$MODE" == "gegenprobe" ]]; then
  MUTATIONS=(M1 M2 M3 M4 M5 M6 M7 M8 M9)
  if [[ -n "${GEGENPROBE_NUR:-}" ]]; then read -r -a MUTATIONS <<<"$GEGENPROBE_NUR"; fi
  RED_TOTAL=0
  for mut in "${MUTATIONS[@]}"; do
    start_container "$mut"
    setup_before
    MUT_KEY="$mut" python3 -c '
import os, sys
s = sys.stdin.read()
M = {
  # M1 Rolle nicht geprueft (c3): die Ausnahme gilt fuer jeden Akteur -- ein Helfer ohne Steuer kommt an c3 vorbei
  "M1": [("        v_end_by_lead := coalesce(v_actor = '\''leitung'\'' AND v_event", "        v_end_by_lead := coalesce(v_event")],
  # M2 Rolle nicht geprueft (Uebergaenge): RESULT_ENTRY aus running auch fuer Helfer
  "M2": [("  ('\''running'\'', '\''RESULT_ENTRY'\'', '\''leitung'\'', '\''finished'\''),", "  ('\''running'\'', '\''RESULT_ENTRY'\'', '\''helper'\'', '\''finished'\''),")],
  # M3 Abpfiff ohne Ergebnis: aus einem laufenden Zustand nur Uhr anhalten und beenden, der Stand faellt weg
  "M3": [("      RETURN match_engine.ok(match_engine.apply_result_entry(p_state, p_event, p_ctx));\n    WHEN '\''AMEND'\''",
          "      IF p_state ->> '\''status'\'' <> '\''scheduled'\'' THEN\n        RETURN match_engine.ok(p_state || jsonb_build_object('\''clock'\'', match_engine.stop_clock(p_state -> '\''clock'\'', p_event), '\''finishedAt'\'', match_engine.num(p_event -> '\''at'\'')));\n      END IF;\n      RETURN match_engine.ok(match_engine.apply_result_entry(p_state, p_event, p_ctx));\n    WHEN '\''AMEND'\''")],
  # M4 Ergebnis ohne Abpfiff: der Uebergang laesst das Spiel laufen (Ziel "=")
  "M4": [("  ('\''running'\'', '\''RESULT_ENTRY'\'', '\''leitung'\'', '\''finished'\''),", "  ('\''running'\'', '\''RESULT_ENTRY'\'', '\''leitung'\'', '\''='\''),")],
  # M5 Uhr laeuft weiter (Review M2 weg)
  "M5": [("    '\''clock'\'', match_engine.stop_clock(p_state -> '\''clock'\'', p_event),\n", "")],
  # M6 Feldanspruch (Review M3 weg): die Ausnahme beansprucht ein freies Feld
  "M6": [("        IF NOT v_end_by_lead\n", "        v_claim_pending := v_end_by_lead AND v_fc.holder_user_id IS NULL AND p_device_id IS NOT NULL;\n        IF NOT v_end_by_lead\n")],
  # M7 ohne basedOn (Review M4 weg): veralteter Stand wird still ueberschrieben
  "M7": [("        IF (p_event -> '\''payload'\'' -> '\''basedOn'\'') IS DISTINCT FROM coalesce(p_state -> '\''lastScoreEventId'\'', '\''null'\''::jsonb) THEN",
          "        IF false THEN")],
  # M8 Wertung aus running erlaubt (Review M1 weg)
  "M8": [("        IF (p_event -> '\''payload'\'') ? '\''forfeit'\'' THEN", "        IF false THEN")],
  # M9 Strafstossschiessen erlaubt (@FU-118): Uebergang und Ausnahme auch aus shootout
  "M9": [("  ('\''decision_pending'\'', '\''RESULT_ENTRY'\'', '\''leitung'\'', '\''finished'\'')\n",
          "  ('\''decision_pending'\'', '\''RESULT_ENTRY'\'', '\''leitung'\'', '\''finished'\''),\n  ('\''shootout'\'', '\''RESULT_ENTRY'\'', '\''leitung'\'', '\''finished'\'')\n"),
         ("('\''running'\'', '\''paused'\'', '\''section_break'\'', '\''decision_pending'\''), false);",
          "('\''running'\'', '\''paused'\'', '\''section_break'\'', '\''decision_pending'\'', '\''shootout'\''), false);")],
}
for frm, to in M[os.environ["MUT_KEY"]]:
    if s.count(frm) != 1:
        sys.exit("Gegenprobe: Muster in %s nicht genau einmal (%d): %r" % (os.environ["MUT_KEY"], s.count(frm), frm[:60]))
    s = s.replace(frm, to)
sys.stdout.write(s)' < "$TARGET_FILE" | psql_stdin
    reset_counts
    echo "--- GEGENPROBE $mut ---"
    run_probes
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
  E_DEV="${DEVS[$(cat_index E)]}"
  if [[ "$E_DEV" -gt 0 ]]; then
    echo "Ohne Migration: E rot -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (E=$E_DEV muss > 0 sein)."
  exit 1
fi

setup_before fail-fast

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$(schema_public)")"
TRANS_BEFORE="$(transitions_state)"
FN_BEFORE="$(q "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname IN ('public', 'match_engine');")"
echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE"

# --- S: Schema ---------------------------------------------------------------------------------------------
check S "Übergänge: genau vier neue Zeilen RESULT_ENTRY (leitung -> finished) aus running, paused, section_break, decision_pending" \
  "$(python3 -c 'import sys; rows = sys.argv[1].split(","); rows += ["%s/RESULT_ENTRY/leitung/finished" % s for s in ("running", "paused", "section_break", "decision_pending")]; print(",".join(sorted(rows)))' "$TRANS_BEFORE")" \
  "$(python3 -c 'import sys; print(",".join(sorted(sys.argv[1].split(","))))' "$(transitions_state)")"
check S "Seed = matchTransitions.json (alle RESULT_ENTRY-Zeilen)" \
  "$(q "SELECT string_agg(from_status || '|' || actor || '|' || to_status, ',' ORDER BY from_status) FROM public.match_transitions WHERE event_type = 'RESULT_ENTRY';")" \
  "$(jq -r '[.transitions[] | select(.type == "RESULT_ENTRY") | "\(.from)|\(.actor)|\(.to)"] | sort | join(",")' "$REPO_ROOT/src/core/match/matchTransitions.json")"
check S "Funktionszahl (public + match_engine) unverändert und append_match_events-Rechte unverändert" "$FN_BEFORE|true|false|false" \
  "$(q "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname IN ('public', 'match_engine');")|$(q "SELECT has_function_privilege('authenticated', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE') || '|' || has_function_privilege('anon', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE') || '|' || has_function_privilege('service_role', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE');")"
COUNTS_AFTER="$(counts "$(schema_public)")"
for dim in tables columns functions triggers policies indexes rls_tables; do
  check S "Katalogzaehlung $dim: Zuwachs" "0" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
DUMP_AFTER="$(schema_dump)"

run_probes
run_assertions

# --- W: idempotent -----------------------------------------------------------------------------------------
TRANS_W="$(transitions_state)"
DATA_W="$(q "SELECT string_agg(id || ':' || coalesce(score_a::text, '-') || ':' || coalesce(score_b::text, '-') || ':' || match_status, ',' ORDER BY id) FROM public.matches;")"
set +e
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
W_EXIT=$?
set -e
check W "zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check W "danach Spiele und Uebergaenge unveraendert, Schema (public + match_engine) wie nach dem ersten Einspielen" "gleich|gleich|identisch" \
  "$([[ "$(q "SELECT string_agg(id || ':' || coalesce(score_a::text, '-') || ':' || coalesce(score_b::text, '-') || ':' || match_status, ',' ORDER BY id) FROM public.matches;")" == "$DATA_W" ]] && echo gleich || echo verschieden)|$([[ "$(transitions_state)" == "$TRANS_W" ]] && echo gleich || echo verschieden)|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg (Anhang B) -------------------------------------------------------------------------------
set +e
X_OUT="$(rueckweg_sql 2>/dev/null | psql_stdin 2>&1)"
X_EXIT=$?
set -e
check X "Rueckweg haelt an, solange im Spielplan beendete Spiele gespeichert sind (Meldung), nichts geaendert" "3|ja|identisch|gleich" \
  "$X_EXIT|$(grep -q 'im Spielplan beendete Spiele vorhanden' <<<"$X_OUT" && echo ja || echo "nein: $X_OUT")|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)|$([[ "$(transitions_state)" == "$TRANS_W" ]] && echo gleich || echo verschieden)"
# Nur im Wegwerf-Container: die betroffenen Spiele samt Eintraegen entfernen (Schutz-Trigger fuer diesen Schritt aus).
psql_stdin <<'SQL'
SET session_replication_role = replica;
DELETE FROM public.match_events WHERE match_id IN (SELECT match_id FROM public.match_events WHERE type = 'RESULT_ENTRY' AND payload ? 'basedOn');
SET session_replication_role = origin;
SQL
rueckweg_sql | psql_stdin
check X "nach dem Rueckweg: Schema public + match_engine = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$(schema_dump)" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
check X "nach dem Rueckweg: Uebergaenge wie vor der Migration" "gleich" "$([[ "$(transitions_state)" == "$TRANS_BEFORE" ]] && echo gleich || echo verschieden)"
ev RESULT_ENTRY "$(E rollback-ende)" "$(ende "$TW" "$TO" 2 0 80000 "")"
send "$U_OLLI" "$D_OLLI" "$M10"
check X "nach dem Rueckweg: Olli beendet Spiel 10 auf Toms Feld 2 nicht mehr (NOT_CONTROLLER wie vor der Migration), läuft weiter" \
  "rejected:NOT_CONTROLLER:OTHER_DEVICE|running" "$(results "$OUT")|$(row "$M10" | cut -d'|' -f2)"
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
