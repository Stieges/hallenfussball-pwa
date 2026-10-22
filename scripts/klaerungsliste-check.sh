#!/usr/bin/env bash
#
# klaerungsliste-check.sh — Container-Beweis fuer supabase/migrations/20261117_005_klaerungsliste.sql (A-35 Klaerungsliste –
# Server). Muster: scripts/spiel-beenden-check.sh (Wegwerf-Container supabase/postgres, nativ, Baseline + Migrationen seit
# Baseline, Aufraeumen per trap, --without-migration, --gegenprobe, --print-rueckweg).
#
# Testwerte aus dem Gherkin (Fundament F1b, Helfer am Turniertag): „Live-Cup“, Turnierleitung Olli (Eigentuemer, Tablet),
# Co-Admin Maria, Helfer Tom (Handy) und Clara, Trainer Rot; Tom mit verlorenem Zugang (drei Wege, @FU-017) und Ersatzhandy
# (@HE-080). Alle Eintraege laufen ueber append_match_events, die Uebernahme ueber take_field_control (echter Weg).
# Geraetezeiten (`at`) relativ zur Serverzeit des Containers (vor/nach der Uebernahme), wie ein Geraet sie senden wuerde.
#
# Kategorien:
#   F  Fail-fast: ohne 20261113_003 (append_match_events in der Fassung 20261110_009) bricht die Migration ab und aendert
#      nichts.
#   K  Klaerung: @FU-038 (Pflichttest echter Weg), @FU-036, @FU-095, @FU-096 (Server-Teil), @FU-116 Z. 2, @FU-017 (drei
#      Zeilen), @HE-056, @HE-080, Entscheiden und Wiederholen, Klaerungsliste fuer die Turnierleitung.
#   G  Gegenbeispiele: @FU-037 (eindeutig -> ohne Liste einsortiert), @FU-030 (gleichzeitiger Anpfiff bleibt NOT_CONTROLLER),
#      Doppelung und Statuseintrag vor der Uebernahme, Helfer/Trainer entscheiden nicht, falsches Ziel, schon entschieden,
#      K.-o.-Spiel beendet, Trainer ohne Schreibvergangenheit bleibt FORBIDDEN_ACTOR, Liste nur fuer die Turnierleitung.
#   S  Schema: Uebergaenge = JSON, append_match_events = 20261113_003 + nur hinzugefuegte Zeilen, match_apply_event =
#      20261110_005 + nur hinzugefuegte Zeilen, Rechte, RLS, Katalog, Rechte-Assertions, Drift-Check-Zuordnung.
#   W  zweites Einspielen (idempotent).
#   X  Rueckweg (--print-rueckweg, Anhang B der Freigabe): haelt an, solange Klaerungseintraege oder Entscheidungen
#      gespeichert sind; danach Schema (public + match_engine) und Uebergaenge = vorher; erneut einspielbar.
#
# Aufrufoptionen:
#   bash scripts/klaerungsliste-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/klaerungsliste-check.sh --without-migration  Gegenprobe: ohne 20261117_005 -> K muss ROT sein
#   bash scripts/klaerungsliste-check.sh --gegenprobe         je Lauf eine Mutation der Migration (M1-M13); Exit 0 NUR, wenn
#                                                             JEDE Mutation mindestens eine Pruefung rot faerbt
#   bash scripts/klaerungsliste-check.sh --print-rueckweg     gibt den Rueckweg (Anhang B der Freigabe) aus, ohne Container
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

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie spiel-beenden-check.sh
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}" # leer = Plattform des Rechners (nativ)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261117_005_klaerungsliste.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
APPEND_BASE_FILE="$MIGRATIONS_DIR/20261113_003_tournament_lifecycle.sql"
APPLY_BASE_FILE="$MIGRATIONS_DIR/20261110_005_result_entry_forfeit.sql"
CONTAINER_PREFIX="klaerungsliste-check-$$"
CURRENT_CONTAINER=""

# fn_block <Datei> <Funktionsanfang> -- die Funktion woertlich (CREATE OR REPLACE ... bis zur Zeile "$$;").
fn_block() { awk -v pat="$2" 'index($0, pat) == 1 {f = 1} f {print} f && $0 == "$$;" {exit}' "$1"; }

# Rueckweg (Anhang B): anhalten bei gespeicherten Klaerungseintraegen oder Entscheidungen; Uebergaenge weg; append_match_events
# woertlich aus 20261113_003, match_apply_event woertlich aus 20261110_005; neue Funktionen, Trigger und Tabellen weg.
rueckweg_sql() {
  echo "-- Rueckweg Klaerungsliste (20261117_005_klaerungsliste.sql), erzeugt von scripts/klaerungsliste-check.sh --print-rueckweg"
  echo "-- Vorher: App ohne Klaerungsliste (B-50). Vorab zaehlen (Freigabe-Unterlage § 7)."
  echo "BEGIN;"
  echo "SET LOCAL lock_timeout = '5s';"
  echo "DO \$\$"
  echo "BEGIN"
  echo "  IF to_regclass('public.match_reviews') IS NOT NULL AND EXISTS (SELECT 1 FROM public.match_reviews) THEN"
  echo "    RAISE EXCEPTION 'Rueckweg 20261117_005: Klaerungseintraege vorhanden -- sie zaehlten nach dem Rueckweg nie und waeren nicht mehr sichtbar; vorher klaeren';"
  echo "  END IF;"
  echo "  IF EXISTS (SELECT 1 FROM public.match_events WHERE type IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD') AND event_format IS NOT NULL) THEN"
  echo "    RAISE EXCEPTION 'Rueckweg 20261117_005: Entscheidungen aus der Klaerungsliste gespeichert -- sie liessen sich ohne die Uebergaenge nicht mehr nachrechnen; vorher klaeren';"
  echo "  END IF;"
  echo "END;"
  echo "\$\$;"
  echo "DELETE FROM public.match_transitions WHERE event_type IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD');"
  echo "-- append_match_events woertlich aus 20261113_003_tournament_lifecycle.sql, match_apply_event aus 20261110_005_result_entry_forfeit.sql"
  fn_block "$APPEND_BASE_FILE" "CREATE OR REPLACE FUNCTION public.append_match_events("
  fn_block "$APPLY_BASE_FILE" "CREATE OR REPLACE FUNCTION public.match_apply_event("
  echo "DROP FUNCTION IF EXISTS public.list_match_reviews(uuid);"
  echo "DROP FUNCTION IF EXISTS match_engine.revoked_intake(uuid, uuid, jsonb, uuid, uuid);"
  echo "DROP FUNCTION IF EXISTS match_engine.review_copy(jsonb, bigint);"
  echo "DROP FUNCTION IF EXISTS match_engine.review_target_check(uuid, jsonb);"
  echo "DROP FUNCTION IF EXISTS match_engine.review_route(public.matches, integer, jsonb, bigint, uuid, uuid, text, text);"
  echo "DROP FUNCTION IF EXISTS match_engine.review_repeat(jsonb);"
  echo "DROP FUNCTION IF EXISTS match_engine.review_store(public.matches, jsonb, uuid, uuid, text, jsonb, bigint);"
  echo "DROP FUNCTION IF EXISTS match_engine.rights_change(uuid, uuid);"
  echo "DROP TRIGGER IF EXISTS field_control_log_write ON public.field_control;"
  echo "DROP FUNCTION IF EXISTS public.field_control_log_write();"
  echo "DROP TABLE IF EXISTS public.match_reviews;"
  echo "DROP TABLE IF EXISTS public.field_control_log;"
  echo "-- Rechte wie vorher (unveraendert)"
  echo "REVOKE ALL ON FUNCTION public.match_apply_event(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;"
  echo "GRANT EXECUTE ON FUNCTION public.match_apply_event(jsonb, jsonb, jsonb, jsonb) TO authenticated, anon, service_role;"
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
CATS=(F K G S W X)
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
  h="$(printf '%s' "klaerungsliste-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_TRAINER="$(uuid_for user:trainer)"
U_TOM="$(uuid_for user:tom-handy)"; U_CLARA="$(uuid_for user:clara)"; U_STRANGER="$(uuid_for user:fremd)"
U_TOM_A="$(uuid_for user:tom-entzogen)"; U_TOM_B="$(uuid_for user:tom-entfernt)"; U_TOM_C="$(uuid_for user:tom-zuschauer)"
U_TOM_D="$(uuid_for user:tom-he056)"; U_TOM_LOST="$(uuid_for user:tom-verlorenes-handy)"; U_TOM_NEW="$(uuid_for user:tom-ersatzhandy)"
ANON_UIDS=" $U_TOM_LOST $U_TOM_NEW "
D_OLLI="$(uuid_for device:olli-tablet)"; D_TOM="$(uuid_for device:tom-handy)"; D_CLARA="$(uuid_for device:clara)"
D_TOM_A="$(uuid_for device:tom-a)"; D_TOM_B="$(uuid_for device:tom-b)"; D_TOM_C="$(uuid_for device:tom-c)"
D_TOM_D="$(uuid_for device:tom-d)"; D_TOM_LOST="$(uuid_for device:tom-verloren)"; D_TOM_NEW="$(uuid_for device:tom-ersatz)"
T_CUP="$(uuid_for tournament:live-cup)"
team() { uuid_for "team:$1"; }
TN="$(team fc-nord)"; TS="$(team sv-sued)"; TW="$(team tsv-west)"; TO="$(team sc-ost)"; TB="$(team djk-berg)"; TM="$(team sg-mitte)"
match() { uuid_for "match:$1"; }
M9="$(match spiel-9)"; M13="$(match spiel-13)"; M14="$(match spiel-14)"; M15="$(match spiel-15)"; M16="$(match spiel-16)"
M_R1="$(match recht-1)"; M_R2="$(match recht-2)"; M_R3="$(match recht-3)"; M_R4="$(match recht-4)"; M_R5="$(match recht-5)"
M_HF1="$(match hf1)"
E() { uuid_for "event:$1"; }

EVS=""
ev() { # ev <Typ> <ID> [Zusatz-JSON]
  local extra="${3:-}" one
  [[ -z "$extra" ]] && extra='{}'
  one="$(jq -cn --arg type "$1" --arg id "$2" --argjson extra "$extra" \
    '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, teamId: null, targetId: null, payload: {}} + $extra')"
  EVS="$EVS$one"$'\n'
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
# Geraetezeit relativ zur Serverzeit (ms), Spielzeit fuer Tore.
at_rel() { echo $(( NOW_MS + $1 )); }
goal() { jq -cn --arg t "$1" --argjson at "$2" --argjson ep "$3" '{at: $at, clockMs: 60000, teamId: $t, controlEpoch: $ep}'; }
row() { q "SELECT coalesce(score_a::text, '-') || ':' || coalesce(score_b::text, '-') || '|' || coalesce(match_status, '-') FROM public.matches WHERE id = '$1';"; }
cms() { q "SELECT harness.cms('$1'::uuid, '$2'::uuid);"; }
take() { q "SELECT harness.take('$1'::uuid, $(is_anon "$1"), '$T_CUP'::uuid, $2, '$3'::uuid, $4);"; }
holder() { q "SELECT coalesce(holder_user_id::text, '-') || '|' || epoch FROM public.field_control WHERE tournament_id = '$T_CUP' AND field = $1;"; }
taken_ms() { q "SELECT floor(extract(epoch FROM claimed_at) * 1000)::bigint FROM public.field_control_log WHERE tournament_id = '$T_CUP' AND field = $1 AND epoch = $2;"; }
review_list() { q "SELECT harness.list('$1'::uuid, $(is_anon "$1"));"; }
# Klaerungsliste als Text: je Eintrag kind:reason:Typ:Autor:Entscheidung (Turnierleitung, Reihenfolge des Eingangs)
list_for() { jq -r --arg ev "$2" '[.[]? | select($ev == "" or .eventId == $ev) | .kind + ":" + .reason + ":" + .entry.type + ":" + (.author // "-") + ":" + (if .decision then .decision.type + "/" + (.decision.by // "-") else "offen" end)] | join(",")' <<<"$1" 2>/dev/null || echo "keine-json:$1"; }
pending_count() { q "SELECT count(*) FROM public.match_events WHERE match_id = '$1' AND review_state = 'pending';"; }
copies() { q "SELECT count(*) || '|' || coalesce(string_agg(type || ':' || coalesce(payload ->> 'playerNumber', '-'), ',' ORDER BY seq), '-') FROM public.match_events WHERE match_id = '$1' AND target_event_id IS NOT NULL AND type NOT IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD', 'RETRACT', 'AMEND');"; }

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
CREATE FUNCTION harness.take(p_user uuid, p_anon boolean, p_tournament uuid, p_field integer, p_device uuid, p_epoch integer)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  PERFORM harness.claims(p_user, p_anon, 'authenticated');
  BEGIN
    v := public.take_field_control(p_tournament, p_field, p_device, NULL, p_epoch);
  EXCEPTION WHEN OTHERS THEN
    v := jsonb_build_object('status', 'exception:' || SQLSTATE);
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN coalesce(v ->> 'status', '-') || coalesce(':' || (v ->> 'code'), '');
END;
$fn$;
CREATE FUNCTION harness.list(p_user uuid, p_anon boolean) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  PERFORM harness.claims(p_user, p_anon, 'authenticated');
  BEGIN
    v := public.list_match_reviews((SELECT id FROM public.tournaments WHERE title = 'Live-Cup'));
  EXCEPTION WHEN OTHERS THEN
    v := jsonb_build_object('exception', SQLSTATE);
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
-- compute_match_state als Nutzer: Status|effektiver Stand
CREATE FUNCTION harness.cms(p_user uuid, p_match uuid) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb; m public.matches%ROWTYPE;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match;
  PERFORM harness.claims(p_user, false, 'authenticated');
  v := public.compute_match_state(p_match);
  PERFORM set_config('role', 'postgres', true);
  RETURN (v ->> 'status') || '|' || coalesce(v -> 'effectiveScores' ->> m.team_a_id::text, '-') || ':'
         || coalesce(v -> 'effectiveScores' ->> m.team_b_id::text, '-');
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
FROM (VALUES ('$U_OLLI'::uuid, 'olli@kl.test', false), ('$U_MARIA'::uuid, 'maria@kl.test', false),
             ('$U_TRAINER'::uuid, 'trainer@kl.test', false), ('$U_TOM'::uuid, 'tom@kl.test', false),
             ('$U_CLARA'::uuid, 'clara@kl.test', false), ('$U_STRANGER'::uuid, 'fremd@kl.test', false),
             ('$U_TOM_A'::uuid, 'tom-a@kl.test', false), ('$U_TOM_B'::uuid, 'tom-b@kl.test', false),
             ('$U_TOM_C'::uuid, 'tom-c@kl.test', false), ('$U_TOM_D'::uuid, 'tom-d@kl.test', false),
             ('$U_TOM_LOST'::uuid, NULL, true),
             ('$U_TOM_NEW'::uuid, NULL, true)) AS u(id, email, anon);
INSERT INTO public.profiles (id, display_name, email)
VALUES ('$U_OLLI', 'Olli', 'olli@kl.test'), ('$U_MARIA', 'Maria', 'maria@kl.test'), ('$U_TRAINER', 'Trainer Rot', 'trainer@kl.test'),
       ('$U_STRANGER', 'Fremd', 'fremd@kl.test'), ('$U_TOM', 'Tom', 'tom@kl.test'), ('$U_TOM_A', 'Tom', 'tom-a@kl.test'),
       ('$U_TOM_B', 'Tom', 'tom-b@kl.test'), ('$U_TOM_C', 'Tom', 'tom-c@kl.test'), ('$U_TOM_D', 'Tom', 'tom-d@kl.test')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config, finals_config)
VALUES ('$T_CUP', '$U_OLLI', 'Live-Cup', '2026-11-28', 6, 10, '{}'::jsonb, '{"tiebreaker": "shootout"}'::jsonb);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) VALUES
  ('$T_CUP', '$U_MARIA', 'co-admin', now(), 'Maria'), ('$T_CUP', '$U_TOM', 'collaborator', now(), 'Tom'),
  ('$T_CUP', '$U_CLARA', 'collaborator', now(), 'Clara'), ('$T_CUP', '$U_TRAINER', 'trainer', now(), 'Trainer Rot'),
  ('$T_CUP', '$U_TOM_A', 'collaborator', now(), 'Tom'), ('$T_CUP', '$U_TOM_B', 'collaborator', now(), 'Tom'),
  ('$T_CUP', '$U_TOM_C', 'collaborator', now(), 'Tom'), ('$T_CUP', '$U_TOM_D', 'collaborator', now(), 'Tom'),
  ('$T_CUP', '$U_TOM_LOST', 'helper', now(), 'Tom'),
  ('$T_CUP', '$U_TOM_NEW', 'helper', now(), 'Tom (Ersatz)');
INSERT INTO public.teams (id, tournament_id, name) VALUES
  ('$TN', '$T_CUP', 'FC Nord'), ('$TS', '$T_CUP', 'SV Süd'), ('$TW', '$T_CUP', 'TSV West'), ('$TO', '$T_CUP', 'SC Ost'),
  ('$TB', '$T_CUP', 'DJK Berg'), ('$TM', '$T_CUP', 'SG Mitte');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start, group_letter) VALUES
  ('$M9', '$T_CUP', 1, 2, '$TN', '$TS', 9, '14:00', 'A'),
  ('$M15', '$T_CUP', 2, 2, '$TN', '$TO', 15, '14:15', 'A'),
  ('$M13', '$T_CUP', 1, 3, '$TN', '$TW', 13, '14:00', 'A'),
  ('$M14', '$T_CUP', 1, 4, '$TS', '$TO', 14, '14:00', 'A'),
  ('$M16', '$T_CUP', 1, 5, '$TB', '$TM', 16, '14:00', 'B'),
  ('$M_R1', '$T_CUP', 3, 11, '$TN', '$TS', 31, '15:00', 'A'),
  ('$M_R2', '$T_CUP', 3, 12, '$TW', '$TO', 32, '15:00', 'A'),
  ('$M_R3', '$T_CUP', 3, 13, '$TB', '$TM', 33, '15:00', 'B'),
  ('$M_R4', '$T_CUP', 3, 14, '$TN', '$TO', 34, '15:00', 'A'),
  ('$M_R5', '$T_CUP', 3, 15, '$TS', '$TW', 35, '15:00', 'A');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start, is_final, final_type, phase) VALUES
  ('$M_HF1', '$T_CUP', 6, 7, '$TN', '$TB', 21, '16:00', true, 'semifinal', 'final');
UPDATE public.matches SET score_a = NULL, score_b = NULL WHERE tournament_id = '$T_CUP';
SQL
  NOW_MS="$(q "SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;")"
}

# ---------------------------------------------------------------------------------------------------------
# Proben K und G (gemeinsam fuer normalen Lauf, ohne Migration und Gegenprobe)
# ---------------------------------------------------------------------------------------------------------
run_probes() {
  local taken list g038 g_dup pause e

  # --- Spiel 9 auf Feld 2: Tom steuert (Epoche 1), Tor zum 1:0; Olli uebernimmt (Epoche 2), waehrend Tom kein Netz hat ----
  ev MATCH_START "$(E m9-start)" "$(jq -cn --argjson at "$(at_rel -600000)" '{at: $at, clockMs: null, controlEpoch: 0}')"
  ev GOAL "$(E m9-tor-1)" "$(goal "$TN" "$(at_rel -590000)" 1)"
  send "$U_TOM" "$D_TOM" "$M9"
  check K "Vorbereitung: Tom pfeift Spiel 9 an und trägt das 1:0 ein (steuert Feld 2, Epoche 1)" "accepted,accepted|1:0|running|$U_TOM|1" \
    "$(results "$OUT")|$(row "$M9")|$(holder 2)"
  check K "Vorbereitung: Olli übernimmt Feld 2 („Spielleitung übernehmen“, echter Weg) -> Epoche 2" "taken" "$(take "$U_OLLI" 2 "$D_OLLI" 1)"
  taken="$(taken_ms 2 2)"
  [[ -z "$taken" || "$taken" == *ERROR* ]] && taken="$NOW_MS"

  # --- @FU-038 Pflichttest: Tor nach dem Steuerverlust, offline -> Klaerungsliste, zaehlt nicht, Toms Geraet „wird geprueft“
  g038="$(E m9-tor-nach-uebernahme)"
  ev GOAL "$g038" "$(goal "$TS" $((taken + 120000)) 1)"
  send "$U_TOM" "$D_TOM" "$M9"
  check K "@FU-038 Toms Tor von 12:08 (Steuer um 12:06 an Olli verloren) -> „wird geprüft“ (review CONTROL_LOST)" \
    "review:CONTROL_LOST" "$(results "$OUT")"
  check K "@FU-038 das Tor ist nicht im Spielstand (Spiel 9 bleibt 1:0, auch nachgerechnet)" "1:0|running|running|1:0" \
    "$(row "$M9")|$(cms "$U_OLLI" "$M9")"
  list="$(review_list "$U_OLLI")"
  check K "@FU-038 Olli sieht in der Klärungsliste „1 Eintrag von Tom nach Übernahme“ (offen, Tor)" \
    "review:CONTROL_LOST:GOAL:Tom:offen" "$(list_for "$list" "$g038")"
  check K "@FU-038 der Eintrag trägt „nach Übernahme“ und Toms Gerätezeit (Detail timing=after)" "after" \
    "$(jq -r --arg ev "$g038" '.[] | select(.eventId == $ev) | .detail.timing' <<<"$list" 2>/dev/null || echo fehlt)"
  ev GOAL "$g038" "$(goal "$TS" $((taken + 120000)) 1)"
  send "$U_TOM" "$D_TOM" "$M9"
  check K "Toms Gerät sendet erneut: bleibt „wird geprüft“ (review, nie duplicate = angenommen), kein zweiter Eintrag" \
    "review:CONTROL_LOST|1" "$(results "$OUT")|$(pending_count "$M9")"

  # --- @FU-037 Gegenbeispiel: eindeutiger Eintrag vor der Uebernahme -> ohne Liste einsortiert, Hinweis an Olli ----------
  e="$(E m9-tor-vor-uebernahme)"
  ev GOAL "$e" "$(goal "$TN" $((taken - 120000)) 1)"
  send "$U_TOM" "$D_TOM" "$M9"
  check G "@FU-037 Toms Tor von 12:04 (vor Ollis Übernahme um 12:06, kein Heimtor von Olli seitdem) zählt: angenommen, 2:0" \
    "accepted|2:0|running" "$(results "$OUT")|$(row "$M9")"
  list="$(review_list "$U_OLLI")"
  check G "@FU-037 Olli sieht den Hinweis „1 Tor von Tom (Feld 2) nachträglich eingefügt“ (Hinweis, keine offene Klärung)" \
    "notice:CONTROL_LOST:GOAL:Tom:offen|$(q "SELECT count(*) FROM public.match_events WHERE id = '$e' AND review_state IS NULL;")" \
    "$(list_for "$list" "$e")|1"

  # --- Doppelung (K2) und Statuseintrag (W1) vor der Uebernahme -> Klaerung ------------------------------------------------
  ev GOAL "$(E m9-olli-tor)" "$(goal "$TS" "$(at_rel 1000)" 2)"
  send "$U_OLLI" "$D_OLLI" "$M9"
  check G "Vorbereitung K2: Olli trägt nach der Übernahme ein Tor für SV Süd ein -> 2:1" "accepted|2:1" "$(results "$OUT")|$(row "$M9" | cut -d'|' -f1)"
  g_dup="$(E m9-tor-doppelt)"
  ev GOAL "$g_dup" "$(goal "$TS" $((taken - 60000)) 1)"
  pause="$(E m9-pause-vorher)"
  ev PAUSE "$pause" "$(jq -cn --argjson at $((taken - 50000)) '{at: $at, clockMs: null, controlEpoch: 1}')"
  send "$U_TOM" "$D_TOM" "$M9"
  check G "K2/W1: Toms Süd-Tor vor der Übernahme (Olli trug seitdem eins ein) und seine Pause vor der Übernahme zählen nicht von selbst" \
    "review:CONTROL_LOST,review:CONTROL_LOST|2:1|running" "$(results "$OUT")|$(row "$M9")"
  list="$(review_list "$U_OLLI")"
  check G "K2/W1: Grund im Detail (mögliche Doppelung, Uhr-/Statuseintrag)" "DUPLICATE|STATUS_EVENT" \
    "$(jq -r --arg a "$g_dup" --arg b "$pause" '([.[] | select(.eventId == $a) | .detail.why][0] // "-") + "|" + ([.[] | select(.eventId == $b) | .detail.why][0] // "-")' <<<"$list" 2>/dev/null || echo fehlt)"

  # --- Entscheiden: Maria (Co-Admin, ohne Feldsteuerung) uebernimmt das Tor aus @FU-038 -----------------------------------
  ev REVIEW_ACCEPT "$(E m9-accept-038)" "$(jq -cn --arg t "$g038" --argjson at "$(at_rel 2000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  send "$U_MARIA" "" "$M9"
  check K "@FU-038 „Übernehmen“ (Maria, Spiel läuft auf Ollis Feld) -> angenommen, das Tor zählt jetzt: 2:2" \
    "accepted|2:2|running|running|2:2" "$(results "$OUT")|$(row "$M9")|$(cms "$U_OLLI" "$M9")"
  check K "@FU-038 Kopie im Verlauf: ein Tor mit Verweis auf den Klärungseintrag, Urheber Tom" "1|GOAL:-|Tom" \
    "$(copies "$M9")|$(q "SELECT coalesce(c.label, '-') FROM public.match_events e JOIN public.match_event_authors a ON a.event_id = e.id LEFT JOIN public.tournament_collaborators c ON c.user_id = a.user_id AND c.tournament_id = '$T_CUP' WHERE e.target_event_id = '$g038' AND e.type = 'GOAL';")"
  list="$(review_list "$U_OLLI")"
  check K "@FU-038 Klärungsliste: entschieden „übernommen von Maria“" "review:CONTROL_LOST:GOAL:Tom:REVIEW_ACCEPT/Maria" "$(list_for "$list" "$g038")"
  ev REVIEW_ACCEPT "$(E m9-accept-038)" "$(jq -cn --arg t "$g038" --argjson at "$(at_rel 2000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  send "$U_MARIA" "" "$M9"
  check G "dieselbe Entscheidung noch einmal gesendet -> duplicate, keine zweite Kopie, Stand 2:2" "duplicate|1|2:2" \
    "$(results "$OUT")|$(copies "$M9" | cut -d'|' -f1)|$(row "$M9" | cut -d'|' -f1)"
  ev REVIEW_DISCARD "$(E m9-discard-038-olli)" "$(jq -cn --arg t "$g038" --argjson at "$(at_rel 3000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  send "$U_OLLI" "$D_OLLI" "$M9"
  check G "Olli verwirft denselben Eintrag danach -> abgelehnt (schon entschieden), Stand 2:2" "rejected:UNKNOWN_TARGET:ALREADY_DECIDED|2:2" \
    "$(results "$OUT")|$(row "$M9" | cut -d'|' -f1)"
  ev REVIEW_ACCEPT "$(E m9-accept-pause)" "$(jq -cn --arg t "$pause" --argjson at "$(at_rel 4000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  ev REVIEW_DISCARD "$(E m9-discard-pause)" "$(jq -cn --arg t "$pause" --argjson at "$(at_rel 4000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  ev REVIEW_DISCARD "$(E m9-discard-dup)" "$(jq -cn --arg t "$g_dup" --argjson at "$(at_rel 4000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  ev REVIEW_ACCEPT "$(E m9-accept-normal)" "$(jq -cn --arg t "$(E m9-tor-1)" --argjson at "$(at_rel 4000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  send "$U_OLLI" "$D_OLLI" "$M9"
  check G "Pause übernehmen geht nicht (nur verwerfen), Doppelung verwerfen, ein normales Tor ist kein Klärungseintrag; Stand 2:2" \
    "rejected:INVALID_PAYLOAD:NOT_ACCEPTABLE,accepted,accepted,rejected:UNKNOWN_TARGET:NOT_IN_REVIEW|2:2|running" \
    "$(results "$OUT")|$(row "$M9")"
  ev REVIEW_DISCARD "$(E m9-tom-discard)" "$(jq -cn --arg t "$g038" --argjson at "$(at_rel 5000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  send "$U_TOM" "$D_TOM" "$M9"
  check G "Helfer Tom entscheidet nicht (abgelehnt), nichts gespeichert" "rejected|0" \
    "$(results "$OUT" | cut -d: -f1)|$(q "SELECT count(*) FROM public.match_events WHERE id = '$(E m9-tom-discard)';")"

  # --- @FU-096 (Server-Teil): ein Tor und seine Ruecknahme nach der Uebernahme -> zwei Klaerungseintraege, die Ruecknahme
  #     verweist auf das Tor (die Liste koppelt sie, B-50); die Ruecknahme selbst laesst sich nicht uebernehmen.
  ev GOAL "$(E m9-paar-tor)" "$(goal "$TN" $((taken + 200000)) 1)"
  ev RETRACT "$(E m9-paar-zurueck)" "$(jq -cn --arg t "$(E m9-paar-tor)" --argjson at $((taken + 210000)) '{at: $at, clockMs: null, targetId: $t, controlEpoch: 1}')"
  send "$U_TOM" "$D_TOM" "$M9"
  list="$(review_list "$U_OLLI")"
  check K "@FU-096 Tor und Rücknahme nach der Übernahme: beide zur Klärung, die Rücknahme zeigt auf das Tor (gekoppelt), Stand 2:2"     "review:CONTROL_LOST,review:CONTROL_LOST|$(E m9-paar-tor)|2:2"     "$(results "$OUT")|$(jq -r --arg ev "$(E m9-paar-zurueck)" '.[] | select(.eventId == $ev) | .entry.targetId' <<<"$list" 2>/dev/null || echo fehlt)|$(row "$M9" | cut -d'|' -f1)"

  # --- @FU-036: Tom pfeift offline Spiel 15 auf Feld 2 an (Olli steuert) -> Klaerungsliste, Spiel 15 gehoert Ollis Steuer ---
  ev MATCH_START "$(E m15-tom-start)" "$(jq -cn --argjson at $((taken + 300000)) '{at: $at, clockMs: null, controlEpoch: 1}')"
  ev GOAL "$(E m15-tom-tor)" "$(goal "$TN" $((taken + 360000)) 1)"
  send "$U_TOM" "$D_TOM" "$M15"
  check K "@FU-036 Toms Anpfiff und Tor zu Spiel 15 (offline, nach der Übernahme) gehen in die Klärungsliste, Spiel 15 bleibt geplant" \
    "review:CONTROL_LOST,review:CONTROL_LOST|-:-|scheduled|$U_OLLI|2" "$(results "$OUT")|$(row "$M15")|$(holder 2)"
  ev REVIEW_ACCEPT "$(E m15-accept-start)" "$(jq -cn --arg t "$(E m15-tom-start)" --argjson at "$(at_rel 6000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  send "$U_OLLI" "$D_OLLI" "$M15"
  check G "@FU-036 Toms Anpfiff lässt sich nicht übernehmen (nur verwerfen)" "rejected:INVALID_PAYLOAD:NOT_ACCEPTABLE|scheduled" \
    "$(results "$OUT")|$(row "$M15" | cut -d'|' -f2)"
  ev MATCH_START "$(E m15-olli-start)" "$(jq -cn --argjson at "$(at_rel 7000)" '{at: $at, clockMs: null, controlEpoch: 2}')"
  send "$U_OLLI" "$D_OLLI" "$M15"
  check K "@FU-036 Spiel 15 gehört weiterhin Ollis Steuer: Olli pfeift an" "accepted|running|$U_OLLI|2" \
    "$(results "$OUT")|$(row "$M15" | cut -d'|' -f2)|$(holder 2)"

  # --- @FU-095: Fall mit drei Eintraegen nach der Uebernahme; Olli uebernimmt nur die Gelbe Karte (beendetes Spiel 13) ----
  ev MATCH_START "$(E m13-start)" "$(jq -cn --argjson at "$(at_rel -600000)" '{at: $at, clockMs: null, controlEpoch: 0}')"
  send "$U_TOM" "$D_TOM" "$M13"
  check K "Vorbereitung @FU-095: Olli übernimmt Feld 3 und pfeift Spiel 13 ab (0:0)" "taken|accepted|0:0|finished" \
    "$(take "$U_OLLI" 3 "$D_OLLI" 1)|$(ev MATCH_END "$(E m13-ende)" "$(jq -cn --argjson at "$(at_rel 1000)" '{at: $at, clockMs: 600000, controlEpoch: 2}')"; send "$U_OLLI" "$D_OLLI" "$M13"; results "$OUT")|$(row "$M13")"
  taken="$(taken_ms 3 2)"
  [[ -z "$taken" || "$taken" == *ERROR* ]] && taken="$NOW_MS"
  ev GOAL "$(E m13-tor-nord)" "$(goal "$TN" $((taken + 10000)) 1)"
  ev GOAL "$(E m13-tor-west)" "$(goal "$TW" $((taken + 20000)) 1)"
  ev YELLOW_CARD "$(E m13-gelb)" "$(jq -cn --arg t "$TW" --argjson at $((taken + 30000)) '{at: $at, clockMs: 300000, teamId: $t, controlEpoch: 1, payload: {playerNumber: 5}}')"
  send "$U_TOM" "$D_TOM" "$M13"
  check K "@FU-095 „3 Einträge von Tom nach Übernahme“ (zwei Tore, eine Gelbe Karte Nr. 5) stehen zur Klärung, Stand 0:0" \
    "review:CONTROL_LOST,review:CONTROL_LOST,review:CONTROL_LOST|0:0|finished" "$(results "$OUT")|$(row "$M13")"
  ev REVIEW_DISCARD "$(E m13-d1)" "$(jq -cn --arg t "$(E m13-tor-nord)" --argjson at "$(at_rel 8000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  ev REVIEW_DISCARD "$(E m13-d2)" "$(jq -cn --arg t "$(E m13-tor-west)" --argjson at "$(at_rel 8000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  ev REVIEW_ACCEPT "$(E m13-a3)" "$(jq -cn --arg t "$(E m13-gelb)" --argjson at "$(at_rel 8000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  send "$U_OLLI" "$D_OLLI" "$M13"
  check K "@FU-095 beide Tore verwerfen, Gelbe Karte übernehmen (je Eintrag) -> nur die Karte zählt, Stand bleibt 0:0" \
    "accepted,accepted,accepted|0:0|finished|1|YELLOW_CARD:5" "$(results "$OUT")|$(row "$M13")|$(copies "$M13")"
  list="$(review_list "$U_OLLI")"
  check K "@FU-095 im Verlauf: die beiden Tore stehen als verworfen, die Karte als übernommen" \
    "review:CONTROL_LOST:GOAL:Tom:REVIEW_DISCARD/Olli,review:CONTROL_LOST:GOAL:Tom:REVIEW_DISCARD/Olli,review:CONTROL_LOST:YELLOW_CARD:Tom:REVIEW_ACCEPT/Olli" \
    "$(jq -r --arg m "$M13" '[.[] | select(.matchId == $m) | .kind + ":" + .reason + ":" + .entry.type + ":" + (.author // "-") + ":" + (if .decision then .decision.type + "/" + (.decision.by // "-") else "offen" end)] | join(",")' <<<"$list" 2>/dev/null || echo fehlt)"
  ev GOAL "$(E m13-tor-west-2)" "$(goal "$TW" $((taken + 40000)) 1)"
  send "$U_TOM" "$D_TOM" "$M13"
  ev REVIEW_ACCEPT "$(E m13-a4)" "$(jq -cn --arg t "$(E m13-tor-west-2)" --argjson at "$(at_rel 9000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  send "$U_OLLI" "$D_OLLI" "$M13"
  check K "@FU-095 ein übernommenes Tor zählt auch im beendeten Gruppenspiel: 0:1, beendet, nachgerechnet gleich" \
    "accepted|0:1|finished|finished|0:1" "$(results "$OUT")|$(row "$M13")|$(cms "$U_OLLI" "$M13")"

  # --- @FU-116 Z. 2: Toms Tor kommt an, nachdem Ollis Eintrag im Spielplan gilt -> Klaerungsliste; Uebernehmen zaehlt -----
  ev MATCH_START "$(E m14-start)" "$(jq -cn --argjson at "$(at_rel -600000)" '{at: $at, clockMs: null, controlEpoch: 0}')"
  ev GOAL "$(E m14-tor)" "$(goal "$TS" "$(at_rel -500000)" 1)"
  send "$U_TOM" "$D_TOM" "$M14"
  ev RESULT_ENTRY "$(E m14-ende)" "$(jq -cn --arg a "$TS" --arg b "$TO" --arg based "$(E m14-tor)" --argjson at "$(at_rel 1000)" \
    '{at: $at, clockMs: null, section: null, payload: {scores: {($a): 2, ($b): 1}, basedOn: $based}}')"
  send "$U_OLLI" "$D_OLLI" "$M14"
  check K "Vorbereitung @FU-116: Olli beendet Spiel 9 (hier Spiel 14) im Spielplan mit 2:1, Tom steuert weiter" "accepted|2:1|finished" \
    "$(results "$OUT")|$(row "$M14")"
  ev GOAL "$(E m14-tor-spaet)" "$(goal "$TS" "$(at_rel 2000)" 1)"
  send "$U_TOM" "$D_TOM" "$M14"
  check K "@FU-116 Z. 2 Toms Tor zum 3:1 kommt danach an -> Spiel bleibt 2:1 beendet, Tor in der Klärungsliste (AFTER_END)" \
    "review:AFTER_END|2:1|finished" "$(results "$OUT")|$(row "$M14")"
  ev REVIEW_ACCEPT "$(E m14-accept)" "$(jq -cn --arg t "$(E m14-tor-spaet)" --argjson at "$(at_rel 3000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  send "$U_OLLI" "$D_OLLI" "$M14"
  check K "@FU-116 Olli übernimmt das Tor -> 3:1 (zählt auf den eingetragenen Stand weiter)" "accepted|3:1|finished" \
    "$(results "$OUT")|$(row "$M14")"

  # --- K.-o.-Spiel beendet: Uebernehmen eines Tores wird abgelehnt (Sieger koennte sich drehen, @FU-052 ist MVP+) --------
  ev MATCH_START "$(E hf1-start)" "$(jq -cn --argjson at "$(at_rel -600000)" '{at: $at, clockMs: null, controlEpoch: 0}')"
  ev GOAL "$(E hf1-tor)" "$(goal "$TN" "$(at_rel -500000)" 1)"
  send "$U_TOM" "$D_TOM" "$M_HF1"
  take "$U_OLLI" 7 "$D_OLLI" 1 >/dev/null
  ev MATCH_END "$(E hf1-ende)" "$(jq -cn --argjson at "$(at_rel 1000)" '{at: $at, clockMs: 600000, controlEpoch: 2}')"
  send "$U_OLLI" "$D_OLLI" "$M_HF1"
  ev GOAL "$(E hf1-tor-tom)" "$(goal "$TB" "$(at_rel 2000)" 1)"
  send "$U_TOM" "$D_TOM" "$M_HF1"
  ev REVIEW_ACCEPT "$(E hf1-accept)" "$(jq -cn --arg t "$(E hf1-tor-tom)" --argjson at "$(at_rel 3000)" '{at: $at, clockMs: null, section: null, targetId: $t}')"
  send "$U_OLLI" "$D_OLLI" "$M_HF1"
  check G "beendetes Halbfinale: Toms Tor zur Klärung, Übernehmen abgelehnt (KNOCKOUT_FINISHED), nichts gespeichert, 1:0" \
    "rejected:INVALID_TRANSITION:KNOCKOUT_FINISHED|1:0|finished|0" \
    "$(results "$OUT")|$(row "$M_HF1")|$(q "SELECT count(*) FROM public.match_events WHERE id = '$(E hf1-accept)' OR target_event_id = '$(E hf1-tor-tom)';")"

  # --- @FU-030 Gegenbeispiel: gleichzeitiger Anpfiff auf freiem Feld bleibt NOT_CONTROLLER (keine Klaerung) --------------
  ev MATCH_START "$(E m16-tom)" "$(jq -cn --argjson at "$(at_rel 0)" '{at: $at, clockMs: null, controlEpoch: 0}')"
  send "$U_TOM" "$D_TOM" "$M16"
  ev MATCH_START "$(E m16-clara)" "$(jq -cn --argjson at "$(at_rel 0)" '{at: $at, clockMs: null, controlEpoch: 0}')"
  send "$U_CLARA" "$D_CLARA" "$M16"
  check G "@FU-030 Clara pfeift in derselben Sekunde an: „Feld 5 wird von Tom gesteuert“ (NOT_CONTROLLER), kein Klärungseintrag" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE|0" "$(results "$OUT")|$(pending_count "$M16")"

  # --- @FU-017 Grundriss: Recht entzogen / entfernt / zum Zuschauer gemacht, waehrend Tom kein Netz hatte ---------------
  local u d m label i ta tb
  i=0
  for label in "das Schreibrecht entzogen" "aus dem Turnier entfernt" "zum Zuschauer gemacht"; do
    i=$((i + 1))
    case "$i" in
      1) u="$U_TOM_A"; d="$D_TOM_A"; m="$M_R1"; ta="$TN"; tb="$TS" ;;
      2) u="$U_TOM_B"; d="$D_TOM_B"; m="$M_R2"; ta="$TW"; tb="$TO" ;;
      3) u="$U_TOM_C"; d="$D_TOM_C"; m="$M_R3"; ta="$TB"; tb="$TM" ;;
    esac
    ev MATCH_START "$(E "r$i-start")" "$(jq -cn --argjson at "$(at_rel -600000)" '{at: $at, clockMs: null, controlEpoch: 0}')"
    ev GOAL "$(E "r$i-tor")" "$(goal "$ta" "$(at_rel -590000)" 1)"
    send "$u" "$d" "$m"
    case "$i" in
      1) q "SET session_replication_role = replica; UPDATE public.tournament_collaborators SET declined_at = now() + interval '1 hour' WHERE tournament_id = '$T_CUP' AND user_id = '$u'; SET session_replication_role = origin;" >/dev/null ;;
      2) q "SET session_replication_role = replica; DELETE FROM public.tournament_collaborators WHERE tournament_id = '$T_CUP' AND user_id = '$u'; SET session_replication_role = origin;" >/dev/null ;;
      3) q "SET session_replication_role = replica; UPDATE public.tournament_collaborators SET role = 'viewer' WHERE tournament_id = '$T_CUP' AND user_id = '$u'; SET session_replication_role = origin;" >/dev/null ;;
    esac
    ev GOAL "$(E "r$i-offline-1")" "$(goal "$tb" "$(at_rel -300000)" 1)"
    ev YELLOW_CARD "$(E "r$i-offline-2")" "$(jq -cn --arg t "$tb" --argjson at "$(at_rel -200000)" '{at: $at, clockMs: 120000, teamId: $t, controlEpoch: 1, payload: {playerNumber: 4}}')"
    send "$u" "$d" "$m"
    list="$(review_list "$U_OLLI")"
    check K "@FU-017 ($label): beide wartenden Einträge „von Tom, Recht entzogen“ in Ollis Klärungsliste, nichts zählt (1:0), Toms Gerät: übergeben" \
      "review:RIGHTS_REVOKED,review:RIGHTS_REVOKED|1:0|review:RIGHTS_REVOKED:GOAL:Tom:offen,review:RIGHTS_REVOKED:YELLOW_CARD:Tom:offen|null" \
      "$(results "$OUT")|$(row "$m" | cut -d'|' -f1)|$(jq -r --arg m "$m" '[.[] | select(.matchId == $m) | .kind + ":" + .reason + ":" + .entry.type + ":" + (.author // "-") + ":" + (if .decision then "entschieden" else "offen" end)] | join(",")' <<<"$list" 2>/dev/null || echo fehlt)|$(jq -c '.state' <<<"$OUT" 2>/dev/null || echo fehlt)"
  done

  # --- @HE-056: Olli uebernimmt Feld 14 und entfernt Tom (Konto), Tom traegt um 12:07 offline ein Tor ein -----------------
  ev MATCH_START "$(E he56-start)" "$(jq -cn --argjson at "$(at_rel -600000)" '{at: $at, clockMs: null, controlEpoch: 0}')"
  send "$U_TOM_D" "$D_TOM_D" "$M_R4"
  take "$U_OLLI" 14 "$D_OLLI" 1 >/dev/null
  q "SET session_replication_role = replica; DELETE FROM public.tournament_collaborators WHERE tournament_id = '$T_CUP' AND user_id = '$U_TOM_D'; SET session_replication_role = origin;" >/dev/null
  ev GOAL "$(E he56-tor)" "$(goal "$TN" "$(at_rel 60000)" 1)"
  send "$U_TOM_D" "$D_TOM_D" "$M_R4"
  check K "@HE-056 Tor nach Übernahme UND Entfernen -> „von Tom, Recht entzogen“ (RIGHTS_REVOKED geht vor), Spiel 0:0" \
    "review:RIGHTS_REVOKED|0:0" "$(results "$OUT")|$(row "$M_R4" | cut -d'|' -f1)"

  # --- @HE-080: Zugang des verlorenen Handys entzogen; vorher offline gemacht -> Klaerung, danach -> nicht angenommen; ------
  #     Ersatzhandy schreibt weiter.
  ev MATCH_START "$(E he80-start)" "$(jq -cn --argjson at "$(at_rel -600000)" '{at: $at, clockMs: null, controlEpoch: 0}')"
  send "$U_TOM_LOST" "$D_TOM_LOST" "$M_R5"
  q "SET session_replication_role = replica; UPDATE public.tournament_collaborators SET declined_at = now() WHERE tournament_id = '$T_CUP' AND user_id = '$U_TOM_LOST'; SET session_replication_role = origin;" >/dev/null
  ev GOAL "$(E he80-vorher)" "$(goal "$TS" "$(at_rel -120000)" 1)"
  ev GOAL "$(E he80-nachher)" "$(goal "$TS" "$(at_rel 600000)" 1)"
  send "$U_TOM_LOST" "$D_TOM_LOST" "$M_R5"
  check K "@HE-080 verlorenes Handy: Eintrag von vorher -> Klärungsliste, Eintrag nach dem Entziehen -> nicht angenommen" \
    "review:RIGHTS_REVOKED,rejected:FORBIDDEN_ACTOR:RIGHTS_REVOKED|0:0" "$(results "$OUT")|$(row "$M_R5" | cut -d'|' -f1)"
  q "UPDATE public.field_control SET holder_user_id = NULL, holder_device_id = NULL, epoch = epoch + 1 WHERE tournament_id = '$T_CUP' AND field = 15;" >/dev/null
  ev GOAL "$(E he80-ersatz)" "$(goal "$TW" "$(at_rel 700000)" "$(q "SELECT epoch FROM public.field_control WHERE tournament_id = '$T_CUP' AND field = 15;")")"
  send "$U_TOM_NEW" "$D_TOM_NEW" "$M_R5"
  check K "@HE-080 Toms Zugang auf dem Ersatzhandy bleibt: sein Tor zählt (0:1)" "accepted|0:1" "$(results "$OUT")|$(row "$M_R5" | cut -d'|' -f1)"

  # --- Gegenbeispiele Rechte: Trainer (nie Schreiber) und Fremde bleiben FORBIDDEN_ACTOR; Liste nur fuer die Leitung -----
  ev GOAL "$(E trainer-tor)" "$(goal "$TN" "$(at_rel 0)" 1)"
  send "$U_TRAINER" "" "$M_R1"
  check G "Trainer Rot (nie eingetragen) -> FORBIDDEN_ACTOR wie bisher, kein Klärungseintrag" "rejected:FORBIDDEN_ACTOR|0" \
    "$(results "$OUT")|$(q "SELECT count(*) FROM public.match_events WHERE id = '$(E trainer-tor)';")"
  ev GOAL "$(E fremd-tor)" "$(goal "$TN" "$(at_rel 0)" 1)"
  send "$U_STRANGER" "" "$M_R1"
  check G "fremdes Konto -> FORBIDDEN_ACTOR wie bisher, kein Klärungseintrag" "rejected:FORBIDDEN_ACTOR|0" \
    "$(results "$OUT")|$(q "SELECT count(*) FROM public.match_events WHERE id = '$(E fremd-tor)';")"
  check G "Klärungsliste nur für die Turnierleitung: Maria = Olli, Helferin Clara und Trainer sehen nichts" \
    "gleich|0|0" "$([[ "$(review_list "$U_MARIA")" == "$(review_list "$U_OLLI")" && "$(review_list "$U_OLLI")" != "[]" ]] && echo gleich || echo verschieden)|$(review_list "$U_CLARA" | jq 'length' 2>/dev/null || echo fehlt)|$(review_list "$U_TRAINER" | jq 'length' 2>/dev/null || echo fehlt)"
  check G "Klärungseinträge zählen in keiner Rechnung: compute_match_state Spiel 9 = Zwischenspeicher (2:2)" "running|2:2|2:2" \
    "$(cms "$U_OLLI" "$M9")|$(row "$M9" | cut -d'|' -f1)"
}

# run_assertions -- Rechte-Assertions als ci_schema_reader; neue Namen; Namensliste = db-drift-check.sh.
A35_ASSERTIONS="klaerungsliste-tables-rls-no-client-writes klaerungsliste-select-policy klaerungsliste-helpers-no-client-execute klaerungsliste-rpc-definer-authenticated-only klaerungsliste-append-routes-reviews"
run_assertions() {
  local priv names_sql names_sh a
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  check S "Rechte-Assertion: keine Zeile |f" "" "$(grep -v '|t$' <<<"$priv" || true)"
  for a in $A35_ASSERTIONS; do
    check S "Rechte-Assertion: $a vorhanden und |t" "$a|t" "$(grep -E "^$a\|" <<<"$priv" || true)"
  done
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
  check S "Drift-Check-Zuordnung: pending_assertions_for nennt fuer $TARGET_NAME genau die neuen Namen" "$A35_ASSERTIONS" \
    "$(awk -v n="    $TARGET_NAME)" 'index($0, n) == 1 {getline; print; exit}' "$REPO_ROOT/scripts/db-drift-check.sh" | sed -E 's/^ *echo "//; s/"$//')"
}

summary() {
  local i
  echo
  for i in "${!CATS[@]}"; do echo "Kategorie ${CATS[$i]}: ${OKS[$i]} OK, ${DEVS[$i]} Abweichung(en)"; done
}

# setup_before [fail-fast] -- Baseline + Migrationen vor der Ziel-Migration. Mit "fail-fast": zuerst ohne 20261113_003
# (append_match_events in der Fassung 20261110_009), dann die Ziel-Migration (muss abbrechen), dann der Rest.
setup_before() {
  local f probe="${1:-}" held=()
  echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  psql_stdin < "$BASELINE_FILE"
  for f in "${BEFORE[@]}"; do
    if [[ "$probe" == "fail-fast" && "$(basename "$f")" > "20261113_002_~" ]]; then
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
    check F "ohne 20261113_003 (append in der Fassung 20261110_009) bricht 20261117_005 ab (psql Exit 3, Meldung)" "3|ja" \
      "$ec|$(grep -qE 'Voraussetzungen fehlen|unbekannte Fassung' <<<"$out" && echo ja || echo "nein: $out")"
    check F "dabei nichts geaendert (keine Tabelle match_reviews, kein Uebergang REVIEW_ACCEPT)" "|0" \
      "$(q "SELECT to_regclass('public.match_reviews');")|$(q "SELECT count(*) FROM public.match_transitions WHERE event_type = 'REVIEW_ACCEPT';")"
    for f in ${held[@]+"${held[@]}"}; do psql_stdin < "$f"; done
  fi
  setup_helpers
  setup_data
}

# ---------------------------------------------------------------------------------------------------------
if [[ "$MODE" == "gegenprobe" ]]; then
  MUTATIONS=(M1 M2 M3 M4 M5 M6 M7 M8 M9 M10 M11 M12 M13)
  if [[ -n "${GEGENPROBE_NUR:-}" ]]; then read -r -a MUTATIONS <<<"$GEGENPROBE_NUR"; fi
  RED_TOTAL=0
  for mut in "${MUTATIONS[@]}"; do
    start_container "$mut"
    setup_before
    MUT_KEY="$mut" python3 -c '
import os, re, sys
s = sys.stdin.read()
M = {
  # M1 (Plan-Mutation) Uebergaenge REVIEW_* entfernen
  "M1": [(re.compile(r"INSERT INTO \"public\".\"match_transitions\".*?ON CONFLICT \(\"from_status\", \"event_type\"\) DO NOTHING;", re.S), "SELECT 1;")],
  # M2 Steuer verloren wird nicht erkannt (Weiche immer NULL)
  "M2": [("  IF p_device_id IS NULL OR v_epoch IS NULL OR p_epoch_now IS NULL OR v_epoch >= p_epoch_now\n", "  IF true OR p_device_id IS NULL OR v_epoch IS NULL OR p_epoch_now IS NULL OR v_epoch >= p_epoch_now\n")],
  # M3 nie automatisch einsortiert (@FU-037)
  "M3": [("  RETURN jsonb_build_object('\''route'\'', '\''auto'\''", "  RETURN jsonb_build_object('\''route'\'', '\''review'\''")],
  # M4 Doppelung (K2) nicht geprueft
  "M4": [("                AND e.recorded_at >= v_taken AND e.type = v_type\n", "                AND false AND e.type = v_type\n")],
  # M5 Recht verloren -> wieder FORBIDDEN_ACTOR (Weiche weg)
  "M5": [("  ELSIF v_tournament_id IS NOT NULL AND match_engine.rights_change(v_tournament_id, v_uid) IS NOT NULL THEN", "  ELSIF false THEN")],
  # M6 Zeitpunkt des Entziehens nicht geprueft (@HE-080)
  "M6": [("      ELSIF v_since IS NOT NULL AND (v_event ->> '\''at'\'')::numeric > v_since THEN", "      ELSIF false THEN")],
  # M7 schon entschieden nicht geprueft
  "M7": [("              WHERE d.target_event_id = v_target AND d.type IN ('\''REVIEW_ACCEPT'\'', '\''REVIEW_DISCARD'\'') AND d.review_state IS NULL) THEN", "              WHERE false) THEN")],
  # M8 Uebernehmen ohne Wirkung (keine Kopie)
  "M8": [("          IF v_copy IS NOT NULL THEN\n            IF v_stored_count >= 2000 THEN", "          IF false THEN\n            IF v_stored_count >= 2000 THEN")],
  # M9 Kopie auch im beendeten K.-o.-Spiel
  "M9": [("    IF coalesce((state -> '\''rules'\'' ->> '\''knockout'\'')::boolean, false) THEN", "    IF false THEN")],
  # M10 Wiederholung eines Klaerungseintrags wird duplicate (= angenommen)
  "M10": [("          v_result := coalesce(match_engine.review_repeat(v_event), v_result);\n", "          NULL;\n")],
  # M11 nach dem Ende keine Klaerung (@FU-116 Z. 2)
  "M11": [("        ELSIF v_result ->> '\''status'\'' = '\''rejected'\'' AND v_result ->> '\''code'\'' = '\''MATCH_FINISHED'\''", "        ELSIF false")],
  # M12 Liste ohne Rechtepruefung
  "M12": [("     AND public.has_tournament_permission(p_tournament_id, '\''leadMatches'\'');\n$$;", "     AND true;\n$$;")],
  # M13 Entscheidungen brauchen die Feldsteuerung (c3 nicht umgangen)
  "M13": [("          v_control_reject := NULL;\n          v_claim_pending := false;\n          v_review_reject := match_engine.review_target_check(p_match_id, v_event);", "          v_review_reject := match_engine.review_target_check(p_match_id, v_event);")],
}
for frm, to in M[os.environ["MUT_KEY"]]:
    if isinstance(frm, str):
        if s.count(frm) != 1:
            sys.exit("Gegenprobe: Muster in %s nicht genau einmal (%d): %r" % (os.environ["MUT_KEY"], s.count(frm), frm[:60]))
        s = s.replace(frm, to)
    else:
        s, n = frm.subn(to, s)
        if n != 1:
            sys.exit("Gegenprobe: Muster in %s nicht genau einmal (%d)" % (os.environ["MUT_KEY"], n))
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
  K_DEV="${DEVS[$(cat_index K)]}"
  if [[ "$K_DEV" -gt 0 ]]; then
    echo "Ohne Migration: K rot -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (K=$K_DEV muss > 0 sein)."
  exit 1
fi

setup_before fail-fast

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$(schema_public)")"
TRANS_BEFORE="$(transitions_state)"
FN_BEFORE="$(q "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname IN ('public', 'match_engine');")"
DATA_BEFORE="$(q "SELECT string_agg(id || ':' || coalesce(score_a::text, '-') || ':' || coalesce(score_b::text, '-') || ':' || coalesce(match_status, '-'), ',' ORDER BY id) FROM public.matches;")|$(q "SELECT count(*) FROM public.match_events;")"
echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE"

# --- S: Schema ---------------------------------------------------------------------------------------------
check S "Bestand: Spiele und Ereignisse durch das Einspielen unverändert" "$DATA_BEFORE" \
  "$(q "SELECT string_agg(id || ':' || coalesce(score_a::text, '-') || ':' || coalesce(score_b::text, '-') || ':' || coalesce(match_status, '-'), ',' ORDER BY id) FROM public.matches;")|$(q "SELECT count(*) FROM public.match_events;")"
check S "Übergänge: genau 16 neue Zeilen REVIEW_ACCEPT/REVIEW_DISCARD (leitung, '=') aus allen acht Zuständen" \
  "$(python3 -c 'import sys; rows = sys.argv[1].split(","); rows += ["%s/%s/leitung/=" % (s, t) for s in ("scheduled", "running", "paused", "section_break", "decision_pending", "shootout", "finished", "skipped") for t in ("REVIEW_ACCEPT", "REVIEW_DISCARD")]; print(",".join(sorted(rows)))' "$TRANS_BEFORE")" \
  "$(python3 -c 'import sys; print(",".join(sorted(sys.argv[1].split(","))))' "$(transitions_state)")"
check S "Seed = matchTransitions.json (alle Zeilen)" \
  "$(q "SELECT string_agg(from_status || '|' || event_type || '|' || actor || '|' || to_status, ',' ORDER BY from_status, event_type) FROM public.match_transitions;")" \
  "$(jq -r '[.transitions[] | "\(.from)|\(.type)|\(.actor)|\(.to)"] | sort_by(split("|")[0] + "|" + split("|")[1]) | join(",")' "$REPO_ROOT/src/core/match/matchTransitions.json")"
diff_removed() { # diff_removed <Basisdatei> <Funktionsanfang> -> Zahl entfernter|hinzugefuegter Zeilen (Container-Text gegen Basis)
  local before after
  before="$(fn_block "$1" "$2")"
  after="$(fn_block "$TARGET_FILE" "$2")"
  echo "$(diff <(echo "$before") <(echo "$after") | grep -c '^<' || true)|$(diff <(echo "$before") <(echo "$after") | grep -c '^>' || true)"
}
check S "Diff-Wächter: append_match_events = 20261113_003 + nur hinzugefügte Zeilen (entfernt 0)" "0" \
  "$(diff_removed "$APPEND_BASE_FILE" "CREATE OR REPLACE FUNCTION public.append_match_events(" | cut -d'|' -f1)"
check S "Diff-Wächter: match_apply_event = 20261110_005 + nur hinzugefügte Zeilen (entfernt 0, hinzugefügt 17)" "0|17" \
  "$(diff_removed "$APPLY_BASE_FILE" "CREATE OR REPLACE FUNCTION public.match_apply_event(")"
check S "Funktionen (public + match_engine): +9 (7 Hilfen, Trigger, Liste); append/match_apply_event-Rechte unverändert" "$((FN_BEFORE + 9))|true|false|false|true|true" \
  "$(q "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname IN ('public', 'match_engine');")|$(q "SELECT has_function_privilege('authenticated', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE') || '|' || has_function_privilege('anon', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE') || '|' || has_function_privilege('service_role', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE') || '|' || has_function_privilege('anon', 'public.match_apply_event(jsonb,jsonb,jsonb,jsonb)', 'EXECUTE') || '|' || has_function_privilege('authenticated', 'public.match_apply_event(jsonb,jsonb,jsonb,jsonb)', 'EXECUTE');")"
check S "Rechte: Liste nur authenticated, Hilfen ohne Client-EXECUTE, Tabellen ohne Client-Schreibrechte" "true|false|false|false|false|false|false|false" \
  "$(q "SELECT has_function_privilege('authenticated', 'public.list_match_reviews(uuid)', 'EXECUTE') || '|' || has_function_privilege('anon', 'public.list_match_reviews(uuid)', 'EXECUTE') || '|' || has_function_privilege('authenticated', 'match_engine.review_store(public.matches,jsonb,uuid,uuid,text,jsonb,bigint)', 'EXECUTE') || '|' || has_function_privilege('authenticated', 'match_engine.revoked_intake(uuid,uuid,jsonb,uuid,uuid)', 'EXECUTE') || '|' || has_table_privilege('authenticated', 'public.match_reviews', 'INSERT') || '|' || has_table_privilege('authenticated', 'public.match_reviews', 'UPDATE') || '|' || has_table_privilege('authenticated', 'public.field_control_log', 'SELECT') || '|' || has_table_privilege('anon', 'public.match_reviews', 'SELECT');")"
COUNTS_AFTER="$(counts "$(schema_public)")"
check S "Katalog: Tabellen +2, RLS-Tabellen +2, Policies +1, Trigger +1, Indizes +4 (2 Primärschlüssel, 2 Suchindizes)" "2|2|1|1|4" \
  "$(( $(count_of "$COUNTS_AFTER" tables) - $(count_of "$COUNTS_BEFORE" tables) ))|$(( $(count_of "$COUNTS_AFTER" rls_tables) - $(count_of "$COUNTS_BEFORE" rls_tables) ))|$(( $(count_of "$COUNTS_AFTER" policies) - $(count_of "$COUNTS_BEFORE" policies) ))|$(( $(count_of "$COUNTS_AFTER" triggers) - $(count_of "$COUNTS_BEFORE" triggers) ))|$(( $(count_of "$COUNTS_AFTER" indexes) - $(count_of "$COUNTS_BEFORE" indexes) ))"
DUMP_AFTER="$(schema_dump)"

run_probes
run_assertions

# --- W: idempotent -----------------------------------------------------------------------------------------
TRANS_W="$(transitions_state)"
DATA_W="$(q "SELECT count(*) || '|' || (SELECT count(*) FROM public.match_reviews) || '|' || (SELECT count(*) FROM public.field_control_log) FROM public.match_events;")"
set +e
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
W_EXIT=$?
set -e
check W "zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check W "danach Daten und Uebergaenge unveraendert, Schema (public + match_engine) wie nach dem ersten Einspielen" "gleich|gleich|identisch" \
  "$([[ "$(q "SELECT count(*) || '|' || (SELECT count(*) FROM public.match_reviews) || '|' || (SELECT count(*) FROM public.field_control_log) FROM public.match_events;")" == "$DATA_W" ]] && echo gleich || echo verschieden)|$([[ "$(transitions_state)" == "$TRANS_W" ]] && echo gleich || echo verschieden)|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg (Anhang B) -------------------------------------------------------------------------------
set +e
X_OUT="$(rueckweg_sql 2>/dev/null | psql_stdin 2>&1)"
X_EXIT=$?
set -e
check X "Rueckweg haelt an, solange Klaerungseintraege gespeichert sind (Meldung), nichts geaendert" "3|ja|identisch|gleich" \
  "$X_EXIT|$(grep -q 'Klaerungseintraege vorhanden' <<<"$X_OUT" && echo ja || echo "nein: $X_OUT")|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)|$([[ "$(transitions_state)" == "$TRANS_W" ]] && echo gleich || echo verschieden)"
# Nur im Wegwerf-Container: Klaerungseintraege, Entscheidungen und Kopien entfernen (Schutz-Trigger fuer diesen Schritt aus).
psql_stdin <<'SQL'
SET session_replication_role = replica;
DELETE FROM public.match_reviews;
DELETE FROM public.match_events WHERE review_state IS NOT NULL OR target_event_id IS NOT NULL AND type NOT IN ('RETRACT', 'AMEND');
SET session_replication_role = origin;
SQL
set +e
X_OUT="$(rueckweg_sql 2>/dev/null | psql_stdin 2>&1)"
X_EXIT=$?
set -e
check X "Rueckweg laeuft ohne Klaerungseintraege und Entscheidungen (Exit 0)" "0" "$X_EXIT"
check X "nach dem Rueckweg: Schema public + match_engine = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$(schema_dump)" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
check X "nach dem Rueckweg: Uebergaenge wie vor der Migration" "gleich" "$([[ "$(transitions_state)" == "$TRANS_BEFORE" ]] && echo gleich || echo verschieden)"
ev GOAL "$(E rueckweg-tor)" "$(goal "$TN" "$(( $(q "SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;") + 600000 ))" 1)"
send "$U_TOM" "$D_TOM" "$M15"
check X "nach dem Rueckweg: Toms Eintrag mit verlorener Steuer wird wieder abgelehnt (NOT_CONTROLLER wie vor der Migration)" \
  "rejected:NOT_CONTROLLER:OTHER_DEVICE" "$(results "$OUT")"
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
