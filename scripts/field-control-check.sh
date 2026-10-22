#!/usr/bin/env bash
#
# field-control-check.sh — Container-Beweis fuer supabase/migrations/20261110_003_field_control.sql (A-34 Steuer je Feld,
# brief-A-34.md). Muster: scripts/event-author-names-check.sh (Wegwerf-Container supabase/postgres, Baseline +
# Migrationen seit Baseline, Aufraeumen per trap, --without-migration, --gegenprobe).
#
# Testwerte aus dem Gherkin (Fundament F1b, Helfer B, Spiel leiten): Turnierleitung Olli (Eigentuemer), Co-Admin Maria,
# Helfer Tom (Helfer-Zugang je Geraet: Handy und Tablet, @HE-049) und Clara; Feld 1/Feld 2; Spiel 9, 10, 11, 12, 13, 15.
# Jede Szenario-Gruppe hat ihr eigenes Turnier, damit das "Gegeben" woertlich gilt. Alle Eintraege laufen ueber
# append_match_events, jede Uebernahme ueber take_field_control (echte Wege, keine Direkt-Inserts in field_control).
#
# Kategorien:
#   K  Steuer: Szenario-Zeilen mit Kennung (@FU-026, @FU-027, @FU-028, @FU-030, @HE-049, @SL-015, @SL-046, @SL-116,
#      Zusammenspiel @FU-080/@FU-081, @SL-018, @HE-040) und Gegenbeispiele; Epoche; App ohne Geraete-ID (brief L7).
#   R  Rechte: take_field_control / field_control_state je Rolle, Tabelle direkt, Parameter, Papierkorb, Feld ohne Spiel.
#   S  Schema: Katalogzaehlung, Rechte-Assertion (alle |t, 3 neue), Namensliste = db-drift-check.sh.
#   W  zweites Einspielen (idempotent).  X  Rueckweg (append_match_events aus 20261028_003 + DROPs) -> Schema = vorher.
#   N  Nachfolger (A-25b, Review GA4 Auflage 4): nach ALLEN spaeteren Migrationen (u. a. 20261110_005, das
#      append_match_events erneut ersetzt) wirkt die Steuer je Feld weiter -- Anpfiff beansprucht, fremdes Tor und
#      fremdes Wiedereroeffnen eines gespielten Spiels NOT_CONTROLLER, Assertion append-match-events-checks-field-control |t.
#
# Aufrufoptionen:
#   bash scripts/field-control-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/field-control-check.sh --without-migration  Gegenprobe: ohne 20261110_003 -> K und R muessen ROT sein
#   bash scripts/field-control-check.sh --gegenprobe         je Lauf eine Mutation der Migration (M1-M15); Exit 0 NUR,
#                                                            wenn JEDE Mutation mindestens eine Pruefung rot faerbt
#   bash scripts/field-control-check.sh --print-rueckweg     gibt den Rueckweg (Anhang B der Freigabe) aus, ohne Container
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container
# (nativ, per DOCKER_PLATFORM ueberschreibbar), wird am Ende entfernt (trap). Harness-Hilfen liegen im Schema "harness".
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

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie event-author-names-check.sh
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}" # leer = Plattform des Rechners (nativ); z. B. linux/amd64 erzwingt Emulation
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261110_003_field_control.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
PREVIOUS_APPEND_FILE="$MIGRATIONS_DIR/20261028_003_result_entry_shootout.sql"
CONTAINER_PREFIX="field-control-check-$$"
CURRENT_CONTAINER=""

# Rueckweg (Anhang B): append_match_events woertlich aus 20261028_003 (Abschnitt 4 + Rechte), dann die neuen Objekte weg.
rueckweg_sql() {
  echo "-- Rueckweg A-34 (20261110_003_field_control.sql), erzeugt von scripts/field-control-check.sh --print-rueckweg"
  echo "-- Vorher: App ohne B-49 (ruft take_field_control/field_control_state nicht)."
  echo "BEGIN;"
  echo "SET LOCAL lock_timeout = '5s';"
  echo "-- append_match_events woertlich aus 20261028_003_result_entry_shootout.sql (Abschnitt 4)"
  awk '/^CREATE OR REPLACE FUNCTION public\.append_match_events\(/{f=1} f{print} f && $0=="$$;"{exit}' "$PREVIOUS_APPEND_FILE"
  echo "-- Rechte woertlich aus 20261028_003_result_entry_shootout.sql (Abschnitt 5)"
  grep -E '^(REVOKE ALL|GRANT EXECUTE) ON FUNCTION public\.append_match_events\(' "$PREVIOUS_APPEND_FILE"
  echo "DROP FUNCTION IF EXISTS public.field_control_state(uuid, uuid);"
  echo "DROP FUNCTION IF EXISTS public.take_field_control(uuid, integer, uuid, text, integer);"
  echo "DROP FUNCTION IF EXISTS public.field_control_info(uuid, integer, uuid);"
  echo "DROP TABLE IF EXISTS public.field_control;"
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
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }

# Zaehler je Kategorie (bash 3.2: keine assoziativen Arrays).
CATS=(K R S W X N)
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
  h="$(printf '%s' "field-control-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
# Personen: Konten (Olli, Maria, Trainer, Zuschauerin Vera, Fremde Frieda) und Geraetesitzungen ohne Konto (Tom Handy,
# Tom Tablet, Clara: Rolle helper; Lena: ohne Rolle; Hallen-Rechner: Rolle screen).
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_TRAINER="$(uuid_for user:trainer)"
U_VIEWER="$(uuid_for user:viewer)"; U_STRANGER="$(uuid_for user:stranger)"
U_TOM_HANDY="$(uuid_for user:tom-handy)"; U_TOM_TABLET="$(uuid_for user:tom-tablet)"; U_CLARA="$(uuid_for user:clara)"
U_LENA="$(uuid_for user:lena)"; U_SCREEN="$(uuid_for user:hallen-rechner)"
ANON_UIDS=" $U_TOM_HANDY $U_TOM_TABLET $U_CLARA $U_LENA $U_SCREEN "
# Geraete-IDs (p_device_id)
D_OLLI_TABLET="$(uuid_for device:olli-tablet)"; D_OLLI_HANDY="$(uuid_for device:olli-handy)"; D_MARIA="$(uuid_for device:maria)"
D_TOM_HANDY="$(uuid_for device:tom-handy)"; D_TOM_TABLET="$(uuid_for device:tom-tablet)"; D_CLARA="$(uuid_for device:clara)"
D_LENA="$(uuid_for device:lena)"; D_SCREEN="$(uuid_for device:hallen-rechner)"; D_TRAINER="$(uuid_for device:trainer)"
# Turniere je Szenario-Gruppe
T_RACE="$(uuid_for tournament:live-cup-anpfiff)"     # @FU-030, @HE-040
T_LIVE="$(uuid_for tournament:live-cup)"             # @FU-026, @FU-027, @FU-028, @HE-049, @FU-080/081, Epoche, R
T_SUED="$(uuid_for tournament:hallencup-sued)"       # @SL-015, @SL-046, @SL-018
T_SL116="$(uuid_for tournament:hallencup-sued-abpfiff)" # @SL-116
T_LEGACY="$(uuid_for tournament:alte-app)"           # brief L7
T_TRASH="$(uuid_for tournament:papierkorb)"
team() { uuid_for "team:$1:$2"; }
match() { uuid_for "match:$1:$2"; }
E() { uuid_for "event:$1"; }

# Ereignisse wie event-author-names-check.sh (ev sammelt in EVS, send schickt sie).
EVS=""
ev() {
  local extra="${3:-}" one
  [[ -z "$extra" ]] && extra='{}'
  one="$(jq -cn --arg type "$1" --arg id "$2" --argjson extra "$extra" \
    '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, teamId: null, targetId: null, payload: {}} + $extra')"
  EVS="$EVS$one"$'\n'
}
is_anon() { [[ "$ANON_UIDS" == *" $1 "* ]] && echo true || echo false; }
sqlnull() { [[ -z "$1" ]] && echo "NULL" || echo "'$1'"; }
# send <Nutzer> <Geraet|leer> <Spiel> -- append_match_events als authenticated (mit is_anonymous); Antwort in OUT.
OUT=""
send() {
  local events
  events="$(jq -cs '.' <<<"$EVS")"
  EVS=""
  OUT="$(q "SELECT harness.call('$1'::uuid, $(is_anon "$1"), '$3'::uuid, \$J\$$events\$J\$::jsonb, $(sqlnull "$2")::uuid);")"
}
# results <Antwort> -- "status[:code[:reason]]" je Ereignis, Komma
results() { jq -r '[.results[]? | .status + (if .code then ":" + .code else "" end) + (if .detail.reason then ":" + .detail.reason else "" end)] | join(",")' <<<"$1" 2>/dev/null || echo "keine-json:$1"; }
holder_of_reject() { jq -r '[.results[]? | select(.code == "NOT_CONTROLLER") | (.detail.holderName // "NULL") + "|" + (.detail.holderDeviceLabel // "NULL")] | first // "keine"' <<<"$1" 2>/dev/null || echo "keine-json"; }
# take <Nutzer> <Turnier> <Feld> <Geraet|leer> [Bezeichnung] [erwartete Epoche] -> rohes jsonb oder error:<SQLSTATE>
take() {
  local label expected
  label="$(sqlnull "${5:-}")"; expected="${6:-NULL}"
  q "SELECT harness.take('$1'::uuid, $(is_anon "$1"), '$2'::uuid, $3, $(sqlnull "$4")::uuid, $label, $expected, 'authenticated');"
}
take_short() { jq -r '.status + (if .code then ":" + .code else "" end) + "|" + ((.control.epoch // "NULL") | tostring) + "|" + (.control.holderName // "NULL") + "|" + (.previous.holderName // "NULL")' <<<"$1" 2>/dev/null || echo "$1"; }
# state <Nutzer> <Turnier> <Geraet|leer> [Rolle] -> rohes jsonb oder error:<SQLSTATE>
state() { q "SELECT harness.state($(sqlnull "$1")::uuid, $( [[ -n "$1" ]] && is_anon "$1" || echo false ), '$2'::uuid, $(sqlnull "$3")::uuid, '${4:-authenticated}');"; }
state_short() { jq -r '[.[] | "Feld \(.field): " + (.holderName // "frei") + (if .holderDeviceLabel then " (" + .holderDeviceLabel + ")" else "" end) + " e" + (.epoch | tostring) + (if .isMine then " mein" else "" end)] | join(";")' <<<"$1" 2>/dev/null || echo "$1"; }
# client <Nutzer|leer> <SQL> [Rolle] -- 'ok:<Zeilen>' oder 'error:<SQLSTATE>'
client() { q "SELECT harness.exec($(sqlnull "$1")::uuid, $( [[ -n "$1" ]] && is_anon "$1" || echo false ), \$S\$$2\$S\$, '${3:-authenticated}');"; }
holder() { q "SELECT coalesce(holder_user_id::text, 'frei') || '|' || coalesce(holder_device_id::text, '-') || '|' || epoch FROM public.field_control WHERE tournament_id = '$1' AND field = $2;"; }
events_count() { q "SELECT count(*) FROM public.match_events WHERE match_id = '$1' AND event_format IS NOT NULL;"; }
score() { q "SELECT coalesce(score_a::text, '-') || ':' || coalesce(score_b::text, '-') || '|' || coalesce(match_status, '-') FROM public.matches WHERE id = '$1';"; }

setup_helpers() {
  psql_stdin <<'SQL'
CREATE SCHEMA harness;
GRANT USAGE ON SCHEMA harness TO anon, authenticated, service_role;
-- Sitzung wie PostgREST: role, request.jwt.claim.sub und (fuer Geraetesitzungen) request.jwt.claims.is_anonymous.
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
-- take_field_control/field_control_state dynamisch (ohne Migration gibt es sie nicht -> error:42883).
CREATE FUNCTION harness.take(p_user uuid, p_anon boolean, p_t uuid, p_field integer, p_device uuid, p_label text,
                             p_expected integer, p_role text) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v text;
BEGIN
  PERFORM harness.claims(p_user, p_anon, p_role);
  BEGIN
    EXECUTE 'SELECT public.take_field_control($1, $2, $3, $4, $5)::text' INTO v USING p_t, p_field, p_device, p_label, p_expected;
  EXCEPTION WHEN OTHERS THEN
    v := 'error:' || SQLSTATE;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
CREATE FUNCTION harness.state(p_user uuid, p_anon boolean, p_t uuid, p_device uuid, p_role text) RETURNS text
LANGUAGE plpgsql AS $fn$
DECLARE v text;
BEGIN
  PERFORM harness.claims(p_user, p_anon, p_role);
  BEGIN
    EXECUTE 'SELECT public.field_control_state($1, $2)::text' INTO v USING p_t, p_device;
  EXCEPTION WHEN OTHERS THEN
    v := 'error:' || SQLSTATE;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
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
  local t sql=""
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@a34.test'), ('$U_MARIA'::uuid, 'maria.k@a34.test'), ('$U_TRAINER'::uuid, 'trainer@a34.test'),
             ('$U_VIEWER'::uuid, 'vera@a34.test'), ('$U_STRANGER'::uuid, 'frieda@a34.test'),
             ('$U_TOM_HANDY'::uuid, NULL), ('$U_TOM_TABLET'::uuid, NULL), ('$U_CLARA'::uuid, NULL), ('$U_LENA'::uuid, NULL),
             ('$U_SCREEN'::uuid, NULL)) AS u(id, email);
INSERT INTO public.profiles (id, display_name, email)
VALUES ('$U_OLLI', 'Olli', 'olli@a34.test'), ('$U_MARIA', 'maria.k', 'maria.k@a34.test'), ('$U_TRAINER', 'Trainer Rot', 'trainer@a34.test'),
       ('$U_VIEWER', 'Vera', 'vera@a34.test'), ('$U_STRANGER', 'Frieda', 'frieda@a34.test')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email;
SQL
  for t in "$T_RACE:Live-Cup" "$T_LIVE:Live-Cup" "$T_SUED:Hallencup Süd" "$T_SL116:Hallencup Süd" "$T_LEGACY:Live-Cup" "$T_TRASH:Alter Cup"; do
    sql="$sql
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES ('${t%%:*}', '$U_OLLI', '${t#*:}', '2026-11-28', 4, 10, '{}'::jsonb);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) VALUES
  ('${t%%:*}', '$U_MARIA', 'co-admin', now(), 'Maria'), ('${t%%:*}', '$U_TOM_HANDY', 'helper', now(), 'Tom'),
  ('${t%%:*}', '$U_TOM_TABLET', 'helper', now(), 'Tom'), ('${t%%:*}', '$U_CLARA', 'helper', now(), 'Clara'),
  ('${t%%:*}', '$U_SCREEN', 'screen', now(), 'Hallen-Rechner'), ('${t%%:*}', '$U_TRAINER', 'trainer', now(), 'Trainer Rot'),
  ('${t%%:*}', '$U_VIEWER', 'viewer', now(), 'Vera');
INSERT INTO public.teams (id, tournament_id, name) VALUES
  ('$(team "${t%%:*}" nord)', '${t%%:*}', 'FC Nord'), ('$(team "${t%%:*}" sued)', '${t%%:*}', 'SV Süd'),
  ('$(team "${t%%:*}" west)', '${t%%:*}', 'TSV West'), ('$(team "${t%%:*}" mitte)', '${t%%:*}', 'SG Mitte');"
  done
  # Spiele: Nummer, Feld, Paarung (Spiel 9/10/15/16 auf Feld 2, Spiel 11/13 auf Feld 1, Spiel 12 auf Feld 2).
  for t in "$T_RACE" "$T_LIVE" "$T_SUED" "$T_SL116" "$T_LEGACY" "$T_TRASH"; do
    sql="$sql
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start) VALUES
  ('$(match "$t" 9)', '$t', 3, 2, '$(team "$t" nord)', '$(team "$t" sued)', 9, '15:00'),
  ('$(match "$t" 10)', '$t', 4, 2, '$(team "$t" west)', '$(team "$t" mitte)', 10, '15:15'),
  ('$(match "$t" 11)', '$t', 4, 1, '$(team "$t" nord)', '$(team "$t" sued)', 11, '15:00'),
  ('$(match "$t" 12)', '$t', 4, 2, '$(team "$t" west)', '$(team "$t" mitte)', 12, '15:00'),
  ('$(match "$t" 13)', '$t', 5, 1, '$(team "$t" west)', '$(team "$t" mitte)', 13, '15:15'),
  ('$(match "$t" 15)', '$t', 6, 2, '$(team "$t" nord)', '$(team "$t" west)', 15, '15:30'),
  ('$(match "$t" 16)', '$t', 7, 2, '$(team "$t" sued)', '$(team "$t" mitte)', 16, '15:45');"
  done
  sql="$sql
UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_TRASH';"
  psql_stdin <<<"$sql"
}

goal() { jq -cn --arg t "$1" --argjson at "${2:-2000}" '{at: $at, clockMs: 130000, teamId: $t}'; }

# ---------------------------------------------------------------------------------------------------------
# Proben (gemeinsam fuer normalen Lauf, ohne Migration und Gegenprobe)
# ---------------------------------------------------------------------------------------------------------
run_probes() {
  local res res2 pid tmp s9 s10 s11 s13 s15 s16 nord sued

  # --- @FU-030 / @HE-040: gleichzeitiger Anpfiff, kein Geraet steuert Feld 2 (T_RACE) -----------------------
  s15="$(match "$T_RACE" 15)"; s16="$(match "$T_RACE" 16)"
  tmp="$(mktemp)"
  # Toms Handy pfeift an und haelt die Transaktion 2 s offen; Claras Anpfiff kommt in derselben Sekunde an.
  ev MATCH_START "$(E race-tom)" '{"clockMs":null}'
  res="$(jq -cs '.' <<<"$EVS")"; EVS=""
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -q -tA >"$tmp" 2>&1 <<SQL &
BEGIN;
SELECT harness.call('$U_TOM_HANDY'::uuid, true, '$s15'::uuid, \$J\$$res\$J\$::jsonb, '$D_TOM_HANDY'::uuid);
SELECT pg_sleep(2);
COMMIT;
SQL
  pid=$!
  sleep 0.8
  ev MATCH_START "$(E race-clara)" '{"clockMs":null}'
  send "$U_CLARA" "$D_CLARA" "$s15"; res2="$OUT"
  wait "$pid" || true
  res="$(grep -m1 '^{' "$tmp" || cat "$tmp")"; rm -f "$tmp"
  check K "@FU-030 @HE-040 Toms Anpfiff von Spiel 15 auf freiem Feld 2 gelingt" "accepted" "$(results "$res")"
  check K "@FU-030 Claras gleichzeitiger Anpfiff wird abgelehnt (anderes Geraet steuert)" "rejected:NOT_CONTROLLER:OTHER_DEVICE" "$(results "$res2")"
  check K "@FU-030 das andere Geraet sieht 'Feld 2 wird von Tom gesteuert'" "Tom|NULL" "$(holder_of_reject "$res2")"
  check K "@FU-030 genau ein Geraet steuert Feld 2 (Toms Handy, Epoche 1)" "$U_TOM_HANDY|$D_TOM_HANDY|1" "$(holder "$T_RACE" 2)"
  check K "@FU-030 Clara hat keinen eigenen Anpfiff eingetragen (genau 1 Ereignis)" "1" "$(events_count "$s15")"
  check K "@FU-030 Antwort an Tom traegt den Stand des Feldes (Epoche 1, mein)" "1|true" \
    "$(jq -r '"\(.control.epoch)|\(.control.isMine)"' <<<"$res" 2>/dev/null || echo "$res")"
  # Variante: zwei Erst-Ansprueche auf verschiedene Spiele desselben Feldes zugleich -> genau ein Halter.
  ev MATCH_START "$(E race-b-clara)" '{"clockMs":null}'
  res="$(jq -cs '.' <<<"$EVS")"; EVS=""
  tmp="$(mktemp)"
  q "UPDATE public.field_control SET holder_user_id = NULL WHERE tournament_id = '$T_RACE' AND field = 2;" >/dev/null
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -q -tA >"$tmp" 2>&1 <<SQL &
BEGIN;
SELECT harness.call('$U_CLARA'::uuid, true, '$s16'::uuid, \$J\$$res\$J\$::jsonb, '$D_CLARA'::uuid);
SELECT pg_sleep(2);
COMMIT;
SQL
  pid=$!
  sleep 0.8
  ev MATCH_START "$(E race-b-maria)" '{"clockMs":null}'
  send "$U_MARIA" "$D_MARIA" "$(match "$T_RACE" 10)"; res2="$OUT"
  wait "$pid" || true
  res="$(grep -m1 '^{' "$tmp" || cat "$tmp")"; rm -f "$tmp"
  check K "@FU-030 Variante: zwei Erst-Ansprueche (Spiel 16 Clara, Spiel 10 Maria) zugleich -> nur Clara" \
    "accepted/rejected:NOT_CONTROLLER:OTHER_DEVICE/$U_CLARA|$D_CLARA|2" "$(results "$res")/$(results "$res2")/$(holder "$T_RACE" 2)"

  # --- @FU-026, @HE-049, @FU-081/@FU-080 (T_LIVE): Toms Handy steuert Feld 2, Spiel 9 laeuft ------------------
  s9="$(match "$T_LIVE" 9)"; s10="$(match "$T_LIVE" 10)"; nord="$(team "$T_LIVE" nord)"; sued="$(team "$T_LIVE" sued)"
  ev MATCH_START "$(E live-s9-start)" '{"clockMs":null}'
  send "$U_TOM_HANDY" "$D_TOM_HANDY" "$s9"
  check K "Vorbereitung @FU-026: Toms Handy pfeift Spiel 9 an (steuert Feld 2)" "accepted" "$(results "$OUT")"
  ev GOAL "$(E live-olli-goal)" "$(goal "$nord")"
  send "$U_OLLI" "$D_OLLI_TABLET" "$s9"
  check K "@FU-026 Olli kann auf Feld 2 nicht eintragen (Tor abgelehnt)" "rejected:NOT_CONTROLLER:OTHER_DEVICE" "$(results "$OUT")"
  check K "@FU-026 Olli sieht 'Feld 2 wird von Tom gesteuert' (Detail)" "Tom|NULL" "$(holder_of_reject "$OUT")"
  check K "@FU-026 Ollis Tor steht nicht im Spiel (1 Ereignis, 0:0)" "1|0:0|running" "$(events_count "$s9")|$(score "$s9")"
  ev GOAL "$(E live-tom-goal-1)" "$(goal "$nord")"
  send "$U_TOM_HANDY" "$D_TOM_HANDY" "$s9"
  check K "@FU-026 Gegenbeispiel: Toms Handy (steuernd) traegt das Tor ein" "accepted|1:0|running" "$(results "$OUT")|$(score "$s9")"
  res="$(take "$U_TOM_HANDY" "$T_LIVE" 2 "$D_TOM_HANDY" "Handy" 1)"
  check K "@HE-049 Toms Handy nennt sich 'Handy' (steuert schon: Epoche bleibt)" "unchanged|1|Tom|NULL" "$(take_short "$res")"
  check K "@HE-049 Olli sieht in der Feldübersicht 'Feld 2: Tom (Handy)'" "Feld 2: Tom (Handy) e1" "$(state_short "$(state "$U_OLLI" "$T_LIVE" "$D_OLLI_TABLET")")"
  ev GOAL "$(E live-tablet-goal)" "$(goal "$nord")"
  send "$U_TOM_TABLET" "$D_TOM_TABLET" "$s9"
  check K "@HE-049 Gegenbeispiel: Toms Tablet (eigener Helfer-Zugang) steuert nicht und traegt nicht ein" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE|Tom|Handy" "$(results "$OUT")|$(holder_of_reject "$OUT")"
  ev RESULT_ENTRY "$(E live-s9-entry)" "{\"payload\":{\"scores\":{\"$nord\":3,\"$sued\":1}}}"
  send "$U_OLLI" "$D_OLLI_TABLET" "$s9"
  check K "@FU-081 Direkteintrag in Spiel 9 (laeuft, Tom steuert) abgelehnt mit 'Feld 2 wird von Tom gesteuert'" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE|Tom|Handy|1:0|running" "$(results "$OUT")|$(holder_of_reject "$OUT")|$(score "$s9")"
  ev RESULT_ENTRY "$(E live-s10-entry)" "{\"payload\":{\"scores\":{\"$(team "$T_LIVE" west)\":3,\"$(team "$T_LIVE" mitte)\":1}}}"
  send "$U_OLLI" "$D_OLLI_TABLET" "$s10"
  check K "@FU-080 Gegenbeispiel (Auflage § 20): Spiel 10 geplant auf Toms Feld 2, Olli traegt 3:1 ein -> beendet 3:1" \
    "accepted|3:1|finished" "$(results "$OUT")|$(score "$s10")"
  check K "@FU-080 der Direkteintrag aendert die Steuer nicht (Toms Handy, Epoche 1)" "$U_TOM_HANDY|$D_TOM_HANDY|1" "$(holder "$T_LIVE" 2)"

  # --- @FU-027: Olli uebernimmt (online) ------------------------------------------------------------------
  # Fixrunde 2: Uebernahme nur mit bekanntem Stand -- ohne erwartete Epoche abgelehnt (22023), Tom steuert weiter.
  check K "@FU-027 @FU-028 Uebernahme ohne bekannten Stand (erwartete Epoche fehlt) -> abgelehnt (22023), Tom steuert weiter" \
    "error:22023|$U_TOM_HANDY|$D_TOM_HANDY|1" "$(take "$U_OLLI" "$T_LIVE" 2 "$D_OLLI_TABLET" "Tablet")|$(holder "$T_LIVE" 2)"
  res="$(take "$U_OLLI" "$T_LIVE" 2 "$D_OLLI_TABLET" "Tablet" 1)"
  check K "@FU-027 Olli bestaetigt 'Spielleitung uebernehmen' -> steuert Feld 2 (Epoche 2, vorher Tom)" "taken|2|Olli|Tom" "$(take_short "$res")"
  ev GOAL "$(E live-tom-goal-2)" "$(goal "$nord" 3000)"
  send "$U_TOM_HANDY" "$D_TOM_HANDY" "$s9"
  check K "@FU-027 Toms Geraet kann nicht mehr eintragen ('Die Spielleitung hat jetzt Olli')" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE|Olli|Tablet|1:0" "$(results "$OUT")|$(holder_of_reject "$OUT")|$(score "$s9" | cut -d'|' -f1)"
  check K "@FU-027 Toms Feldübersicht: Feld 2 Olli (Tablet), nicht mein" "Feld 2: Olli (Tablet) e2" "$(state_short "$(state "$U_TOM_HANDY" "$T_LIVE" "$D_TOM_HANDY")")"
  ev GOAL "$(E live-olli-goal-2)" "$(goal "$nord" 3000)"
  send "$U_OLLI" "$D_OLLI_TABLET" "$s9"
  check K "@FU-027 Gegenbeispiel: Ollis Tor nach der Uebernahme zaehlt" "accepted|2:0" "$(results "$OUT")|$(score "$s9" | cut -d'|' -f1)"
  ev GOAL "$(E live-olli-handy-goal)" "$(goal "$nord" 3100)"
  send "$U_OLLI" "$D_OLLI_HANDY" "$s9"
  check K "@FU-027 Ollis Handy ist ein anderes Geraet als sein Tablet -> abgelehnt" "rejected:NOT_CONTROLLER:OTHER_DEVICE" "$(results "$OUT")"
  ev GOAL "$(E live-olli-null-goal)" "$(goal "$nord" 3200)"
  send "$U_OLLI" "" "$s9"
  check K "brief L7: ohne Geraete-ID kein Umgehen eines bestehenden Anspruchs (Olli ohne Geraete-ID abgelehnt)" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE" "$(results "$OUT")"
  res="$(take "$U_MARIA" "$T_LIVE" 2 "$D_MARIA" "Laptop" 2)"
  check K "@FU-027 auch Co-Admin Maria uebernimmt jederzeit (Epoche 3)" "taken|3|Maria|Olli" "$(take_short "$res")"

  # --- @FU-028: Uebernehmen braucht Netz (Server-Haelfte) --------------------------------------------------
  res="$(take "$U_CLARA" "$T_LIVE" 2 "$D_CLARA" "Handy" 2)"
  check K "@FU-028 (Server-Haelfte) Claras Uebernahme ohne Netz kommt spaeter an (sah Epoche 2) -> abgelehnt, Maria steuert weiter" \
    "rejected:CONTROL_CHANGED|3|Maria|NULL|$U_MARIA|$D_MARIA|3" "$(take_short "$res")|$(holder "$T_LIVE" 2)"
  ev TAKEOVER "$(E live-takeover-event)" '{}'
  send "$U_CLARA" "$D_CLARA" "$s9"
  check K "@FU-028 (Server-Haelfte) 'Spielleitung uebernehmen' ist kein Eintrag des Ausgangs (TAKEOVER -> INVALID_PAYLOAD), Steuer gleich" \
    "rejected:INVALID_PAYLOAD|$U_MARIA|$D_MARIA|3" "$(results "$OUT")|$(holder "$T_LIVE" 2)"
  res="$(take "$U_CLARA" "$T_LIVE" 2 "$D_CLARA" "Handy" 3)"
  check K "@FU-028 (Server-Haelfte) Gegenbeispiel: Clara mit Netz (aktuelle Epoche) uebernimmt (brief L3)" "taken|4|Clara|Maria" "$(take_short "$res")"

  # --- Epoche (Bauplan § 20 "Pruefung controlEpoch"): Toms Handy steuert wieder, alte Eintraege zaehlen nicht ---
  res="$(take "$U_TOM_HANDY" "$T_LIVE" 2 "$D_TOM_HANDY" "Handy" 4)"
  check K "Epoche: Toms Handy uebernimmt wieder (Epoche 5)" "taken|5|Tom|Clara" "$(take_short "$res")"
  ev GOAL "$(E live-tom-stale)" "$(jq -cn --arg t "$nord" '{at: 4000, clockMs: 200000, teamId: $t, controlEpoch: 1}')"
  send "$U_TOM_HANDY" "$D_TOM_HANDY" "$s9"
  check K "@FU-027 Eintrag aus Toms frueherer Steuer (controlEpoch 1) zaehlt nicht" "rejected:NOT_CONTROLLER:STALE_EPOCH|2:0" \
    "$(results "$OUT")|$(score "$s9" | cut -d'|' -f1)"
  ev GOAL "$(E live-tom-epoch5)" "$(jq -cn --arg t "$nord" '{at: 4000, clockMs: 200000, teamId: $t, controlEpoch: 5}')"
  ev GOAL "$(E live-tom-epochnull)" "$(jq -cn --arg t "$nord" '{at: 4100, clockMs: 201000, teamId: $t}')"
  send "$U_TOM_HANDY" "$D_TOM_HANDY" "$s9"
  check K "Epoche Gegenbeispiel: controlEpoch 5 (aktuell) und ohne Epoche -> beide angenommen" "accepted,accepted|4:0" \
    "$(results "$OUT")|$(score "$s9" | cut -d'|' -f1)"

  # --- @SL-018, @SL-046, @SL-015 (T_SUED): Toms Tablet steuert Feld 1 (Spiel 11), Clara Feld 2 (Spiel 12) ------
  s11="$(match "$T_SUED" 11)"; s13="$(match "$T_SUED" 13)"; nord="$(team "$T_SUED" nord)"
  ev MATCH_START "$(E sued-s11-start)" '{"clockMs":null}'
  ev GOAL "$(E sued-s11-goal)" "$(goal "$nord")"
  send "$U_TOM_TABLET" "$D_TOM_TABLET" "$s11"
  ev MATCH_START "$(E sued-s12-start)" '{"clockMs":null}'
  send "$U_CLARA" "$D_CLARA" "$(match "$T_SUED" 12)"
  check K "Vorbereitung Hallencup Süd: Tom steuert Feld 1 (Spiel 11, 1:0), Clara Feld 2 (Spiel 12)" \
    "1:0|running/$U_TOM_TABLET|$D_TOM_TABLET|1/$U_CLARA|$D_CLARA|1" "$(score "$s11")/$(holder "$T_SUED" 1)/$(holder "$T_SUED" 2)"
  ev MATCH_START "$(E sued-s13-clara)" '{"clockMs":null}'
  send "$U_CLARA" "$D_CLARA" "$s13"
  check K "@SL-018 Clara (steuert Feld 2) pfeift Spiel 13 auf Feld 1 an -> auch der Server nimmt es nicht an" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE|0|scheduled" "$(results "$OUT")|$(events_count "$s13")|$(score "$s13" | cut -d'|' -f2)"
  ev RETRACT "$(E sued-olli-retract-1)" "{\"at\":3000,\"targetId\":\"$(E sued-s11-goal)\"}"
  send "$U_OLLI" "$D_OLLI_TABLET" "$s11"
  check K "@SL-046 Olli nimmt Toms Tor ohne Uebernahme zurueck -> abgelehnt, Spiel 11 bleibt 1:0" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE|1:0" "$(results "$OUT")|$(score "$s11" | cut -d'|' -f1)"
  ev CLOCK_ADJUST "$(E sued-olli-clock-1)" '{"at":3000,"clockMs":180000}'
  send "$U_OLLI" "$D_OLLI_TABLET" "$s11"
  check K "@SL-015 Gegenbeispiel: ohne Uebernahme kann Olli die Spielzeit nicht anpassen" "rejected:NOT_CONTROLLER:OTHER_DEVICE" "$(results "$OUT")"
  res="$(take "$U_OLLI" "$T_SUED" 1 "$D_OLLI_TABLET" "Tablet" 1)"
  check K "@SL-015 Toms Tablet ist aus, Olli uebernimmt Spiel 11 (Feld 1)" "taken|2|Olli|Tom" "$(take_short "$res")"
  ev CLOCK_ADJUST "$(E sued-olli-clock-2)" '{"at":3000,"clockMs":180000}'
  send "$U_OLLI" "$D_OLLI_TABLET" "$s11"
  check K "@SL-015 Olli passt die Spielzeit vor seinem ersten Eintrag an" "accepted" "$(results "$OUT")"
  ev RETRACT "$(E sued-olli-retract-2)" "{\"at\":3100,\"targetId\":\"$(E sued-s11-goal)\"}"
  send "$U_OLLI" "$D_OLLI_TABLET" "$s11"
  check K "@SL-046 erst nach der Uebernahme kann Olli zuruecknehmen (Spiel 11 0:0)" "accepted|0:0" "$(results "$OUT")|$(score "$s11" | cut -d'|' -f1)"
  ev GOAL "$(E sued-olli-goal)" "$(goal "$nord" 3200)"
  send "$U_OLLI" "$D_OLLI_TABLET" "$s11"
  check K "@SL-015 Olli leitet Spiel 11 danach weiter (Tor)" "accepted|1:0" "$(results "$OUT")|$(score "$s11" | cut -d'|' -f1)"

  # --- @SL-116 (T_SL116): Spiel 11 abgepfiffen, Toms Tablet danach aus, Olli uebernimmt Feld 1 -----------------
  s11="$(match "$T_SL116" 11)"; s13="$(match "$T_SL116" 13)"
  ev MATCH_START "$(E sl116-start)" '{"clockMs":null}'
  ev MATCH_END "$(E sl116-end)" '{"at":2000,"clockMs":360000}'
  send "$U_TOM_TABLET" "$D_TOM_TABLET" "$s11"
  check K "Vorbereitung @SL-116: Tom pfeift Spiel 11 an und ab" "accepted,accepted|finished" "$(results "$OUT")|$(score "$s11" | cut -d'|' -f2)"
  res="$(take "$U_OLLI" "$T_SL116" 1 "$D_OLLI_TABLET" "Tablet" 1)"
  check K "@SL-116 kurz nach dem Abpfiff uebernimmt Olli Feld 1" "taken|2|Olli|Tom" "$(take_short "$res")"
  ev MATCH_START "$(E sl116-tom-13)" '{"clockMs":null}'
  send "$U_TOM_TABLET" "$D_TOM_TABLET" "$s13"
  check K "@SL-116 Gegenbeispiel: Toms Tablet pfeift Spiel 13 nicht mehr an" "rejected:NOT_CONTROLLER:OTHER_DEVICE|0" "$(results "$OUT")|$(events_count "$s13")"
  ev MATCH_START "$(E sl116-olli-13)" '{"clockMs":null}'
  send "$U_OLLI" "$D_OLLI_TABLET" "$s13"
  check K "@SL-116 danach steht Spiel 13 bei Olli bereit: Olli pfeift es an" "accepted|running" "$(results "$OUT")|$(score "$s13" | cut -d'|' -f2)"

  # --- brief L7 (T_LEGACY): App ohne Geraete-ID -- kein Anspruch, unveraendert ---------------------------------
  ev MATCH_START "$(E legacy-start)" '{"clockMs":null}'
  send "$U_OLLI" "" "$(match "$T_LEGACY" 9)"
  ev GOAL "$(E legacy-maria-goal)" "$(goal "$(team "$T_LEGACY" nord)")"
  send "$U_MARIA" "" "$(match "$T_LEGACY" 9)"
  check K "brief L7: ohne Geraete-ID pfeift Olli an und Maria traegt ein (wie heute), kein Anspruch entsteht" \
    "accepted|1:0||0" "$(results "$OUT")|$(score "$(match "$T_LEGACY" 9)" | cut -d'|' -f1)|$(holder "$T_LEGACY" 2)|$(q "SELECT count(*) FROM public.field_control WHERE tournament_id = '$T_LEGACY';")"

  # --- Fixrunde 1 (Review A-34, Auflage 1): @FU-071 Zeile 5 -- Wiedereroeffnen braucht die Steuer (T_SL116) --------
  # Spiel 11 ist beendet, Feld 1 steuert jetzt Ollis Tablet.
  s11="$(match "$T_SL116" 11)"
  ev REOPEN "$(E sl116-tom-reopen)" '{"at":5000,"clockMs":360000}'
  send "$U_TOM_TABLET" "$D_TOM_TABLET" "$s11"
  check K "@FU-071 Toms Tablet (steuert Feld 1 nicht mehr) eroeffnet Spiel 11 nicht wieder, es bleibt beendet" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE|finished" "$(results "$OUT")|$(score "$s11" | cut -d'|' -f2)"
  ev REOPEN "$(E sl116-olli-reopen)" '{"at":5000,"clockMs":360000}'
  send "$U_OLLI" "$D_OLLI_TABLET" "$s11"
  check K "@FU-071 Gegenbeispiel: Olli (steuert Feld 1) eroeffnet Spiel 11 wieder, es laeuft" "accepted|running" \
    "$(results "$OUT")|$(score "$s11" | cut -d'|' -f2)"

  # --- Fixrunde 1 (Auflage 2): isMine je Geraet -- Olli steuert Feld 1 im Hallencup Sued mit dem Tablet ----------
  check K "@FU-027 Ollis Handy ist nicht das steuernde Geraet (isMine nur am Tablet)" \
    "Feld 1: Olli (Tablet) e2;Feld 2: Clara e1" "$(state_short "$(state "$U_OLLI" "$T_SUED" "$D_OLLI_HANDY")")"
  check K "@HE-049 Gegenbeispiel: Ollis Tablet sieht Feld 1 als seins" \
    "Feld 1: Olli (Tablet) e2 mein;Feld 2: Clara e1" "$(state_short "$(state "$U_OLLI" "$T_SUED" "$D_OLLI_TABLET")")"

  # --- Fixrunde 1 (Auflage 3): Anspruch im selben Aufruf, danach Eintrag mit zuletzt bekannter (alter) Epoche -------
  # Freies Feld 1 im Turnier T_LEGACY; Toms Handy pfeift an und stempelt das Tor mit der Epoche 7 (z. B. ohne Netz).
  ev MATCH_START "$(E claim-same-call-start)" '{"clockMs":null}'
  ev GOAL "$(E claim-same-call-goal)" "$(jq -cn --arg t "$(team "$T_LEGACY" nord)" '{at: 2000, clockMs: 130000, teamId: $t, controlEpoch: 7}')"
  send "$U_TOM_HANDY" "$D_TOM_HANDY" "$(match "$T_LEGACY" 11)"
  check K "@FU-030 Anspruch im selben Aufruf: Anpfiff und Tor (mit alter Epoche 7) zaehlen, Toms Handy steuert Feld 1 (Epoche 1)" \
    "accepted,accepted|1:0|$U_TOM_HANDY|$D_TOM_HANDY|1" \
    "$(results "$OUT")|$(score "$(match "$T_LEGACY" 11)" | cut -d'|' -f1)|$(holder "$T_LEGACY" 1)"

  # --- R: Rechte -------------------------------------------------------------------------------------------
  res=""
  for who in trainer viewer stranger lena screen; do
    case "$who" in
      trainer) uid="$U_TRAINER"; dev="$D_TRAINER" ;; viewer) uid="$U_VIEWER"; dev="$D_TRAINER" ;;
      stranger) uid="$U_STRANGER"; dev="$D_TRAINER" ;; lena) uid="$U_LENA"; dev="$D_LENA" ;; screen) uid="$U_SCREEN"; dev="$D_SCREEN" ;;
    esac
    res="$res$who=$(take_short "$(take "$uid" "$T_LIVE" 2 "$dev" "" 5)");"
  done
  check R "take_field_control: Trainer, Zuschauerin, Fremde, Lena (ohne Rolle), Hallen-Rechner (screen) -> FORBIDDEN_ACTOR" \
    "trainer=rejected:FORBIDDEN_ACTOR|NULL|NULL|NULL;viewer=rejected:FORBIDDEN_ACTOR|NULL|NULL|NULL;stranger=rejected:FORBIDDEN_ACTOR|NULL|NULL|NULL;lena=rejected:FORBIDDEN_ACTOR|NULL|NULL|NULL;screen=rejected:FORBIDDEN_ACTOR|NULL|NULL|NULL;" "$res"
  check R "nach den abgelehnten Uebernahmen steuert weiter Toms Handy (Epoche 5)" "$U_TOM_HANDY|$D_TOM_HANDY|5" "$(holder "$T_LIVE" 2)"
  check R "take_field_control als anon (ohne Sitzung) -> kein EXECUTE (42501)" "error:42501" \
    "$(q "SELECT harness.take(NULL, false, '$T_LIVE'::uuid, 2, '$D_LENA'::uuid, NULL, NULL, 'anon');")"
  check R "take_field_control als service_role -> kein EXECUTE (42501)" "error:42501" \
    "$(q "SELECT harness.take(NULL, false, '$T_LIVE'::uuid, 2, '$D_LENA'::uuid, NULL, NULL, 'service_role');")"
  check R "Papierkorb: Olli uebernimmt im geloeschten Turnier -> FORBIDDEN_ACTOR" "rejected:FORBIDDEN_ACTOR|NULL|NULL|NULL" \
    "$(take_short "$(take "$U_OLLI" "$T_TRASH" 2 "$D_OLLI_TABLET" "" 0)")"
  check R "Feld 7 ohne Spiel -> UNKNOWN_FIELD, keine Zeile" "rejected:UNKNOWN_FIELD|NULL|NULL|NULL|0" \
    "$(take_short "$(take "$U_OLLI" "$T_LIVE" 7 "$D_OLLI_TABLET" "" 0)")|$(q "SELECT count(*) FROM public.field_control WHERE field = 7;")"
  check R "ohne Geraete-ID -> 22023" "error:22023" "$(take "$U_OLLI" "$T_LIVE" 2 "" "" 5)"
  check R "Bezeichnung laenger als 40 Zeichen -> 22023" "error:22023" "$(take "$U_OLLI" "$T_LIVE" 2 "$D_OLLI_TABLET" "Handy-mit-einer-viel-zu-langen-Bezeichnung-x" 5)"
  check R "field_control_state: Trainer und Zuschauerin sehen nichts ([])" "[]|[]" \
    "$(state "$U_TRAINER" "$T_LIVE" "")|$(state "$U_VIEWER" "$T_LIVE" "")"
  check R "field_control_state: Hallen-Rechner (screen) und Lena (ohne Rolle) sehen nichts ([])" "[]|[]" \
    "$(state "$U_SCREEN" "$T_LIVE" "$D_SCREEN")|$(state "$U_LENA" "$T_LIVE" "$D_LENA")"
  check R "field_control_state als anon -> kein EXECUTE (42501)" "error:42501" "$(state "" "$T_LIVE" "" anon)"
  check R "field_control_state Papierkorb -> []" "[]" "$(state "$U_OLLI" "$T_TRASH" "")"
  check R "Gegenbeispiel: Helferin Clara sieht den Stand (Feld 2: Tom (Handy))" "Feld 2: Tom (Handy) e5" "$(state_short "$(state "$U_CLARA" "$T_LIVE" "$D_CLARA")")"
  check R "Tabelle direkt: Olli liest field_control nicht (42501)" "error:42501" "$(client "$U_OLLI" "SELECT * FROM public.field_control")"
  check R "Tabelle direkt: Clara setzt sich nicht selbst als Halterin (42501)" "error:42501" \
    "$(client "$U_CLARA" "UPDATE public.field_control SET holder_user_id = '$U_CLARA', holder_device_id = '$D_CLARA' WHERE tournament_id = '$T_LIVE'")"
  check R "Tabelle direkt: Clara legt keine Zeile an (42501)" "error:42501" \
    "$(client "$U_CLARA" "INSERT INTO public.field_control (tournament_id, field, epoch, holder_user_id, holder_device_id) VALUES ('$T_LIVE', 1, 9, '$U_CLARA', '$D_CLARA')")"
  check R "Tabelle direkt: anon liest nicht (42501)" "error:42501" "$(client "" "SELECT * FROM public.field_control" anon)"
}

# run_assertions -- Rechte-Assertion als ci_schema_reader; 3 neue Namen; Namensliste = db-drift-check.sh.
run_assertions() {
  local priv names_sql names_sh
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  # CA-2: die drei Zeilen der spaeteren Migration 20261110_004 sind hier f (sie laeuft erst am Ende, AFTER).
  check S "Rechte-Assertion: keine Zeile |f (ausser Zeilen der spaeteren Migrationen 20261110_004, 20261110_005, 20261110_006)" "" \
    "$(grep -v '|t$' <<<"$priv" | grep -vE '^(share-rpcs-permission-based|make-public-keeps-existing-code|heartbeats-select-manage-screens|matches-guard-engine-columns-forfeit-absent|append-match-events-writes-forfeit-absent|group-completion-[a-z-]+|complete-group-locks-matches-before-tournament|ci-schema-reader-select-group-completion)\|' || true)"
  check S "Rechte-Assertion: die 3 A-34-Zeilen vorhanden und |t" \
    "append-match-events-checks-field-control|t,field-control-no-client-access|t,field-control-rpcs-execute-only-authenticated|t" \
    "$(grep -E '^(append-match-events-checks-field-control|field-control-)' <<<"$priv" | sort | paste -sd, -)"
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Lehre A-30a: Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
}

setup_before() {
  echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  psql_stdin < "$BASELINE_FILE"
  local f
  for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done
  setup_helpers
  setup_data
}

summary() {
  local i
  echo
  for i in "${!CATS[@]}"; do echo "Kategorie ${CATS[$i]}: ${OKS[$i]} OK, ${DEVS[$i]} Abweichung(en)"; done
}

# ---------------------------------------------------------------------------------------------------------
if [[ "$MODE" == "gegenprobe" ]]; then
  MUTATIONS=(M1 M2 M3 M4 M5 M6 M7 M8 M9 M10 M11 M12 M13 M14 M15)
  # Teilmenge fuer Nachproben: GEGENPROBE_NUR="M12 M13 M14"
  if [[ -n "${GEGENPROBE_NUR:-}" ]]; then read -r -a MUTATIONS <<<"$GEGENPROBE_NUR"; fi
  RED_TOTAL=0
  for mut in "${MUTATIONS[@]}"; do
    start_container "$mut"
    setup_before
    MUT_KEY="$mut" python3 -c '
import os, sys
M = {
  # M1 Halter-Pruefung weg: jedes Geraet gilt als steuernd
  "M1": [("          ELSIF v_fc.holder_user_id = v_uid AND v_fc.holder_device_id = p_device_id THEN\n", "          ELSIF true THEN\n")],
  # M2 Epochen-Vergleich weg
  "M2": [("            IF NOT v_claimed_in_call AND v_epoch_sent IS NOT NULL AND v_epoch_sent <> v_fc.epoch THEN\n", "            IF false THEN\n")],
  # M3 Uebernahme zaehlt die Epoche nicht hoch
  "M3": [("     SET epoch = epoch + 1,\n", "     SET epoch = epoch,\n")],
  # M4 Rechtepruefung der Uebernahme weg
  "M4": [("     OR NOT public.has_tournament_permission(p_tournament_id, '\''writeMatchData'\'') THEN\n", "     OR false THEN\n")],
  # M5 impliziter Anspruch auch ohne Geraete-ID (App vor B-49)
  "M5": [("  IF p_device_id IS NOT NULL THEN\n    INSERT INTO public.field_control", "  IF true THEN\n    INSERT INTO public.field_control"),
         ("            v_claim_pending := p_device_id IS NOT NULL;\n", "            v_claim_pending := true;\n")],
  # M6 Turnierleitung nie geprueft
  "M6": [("        IF v_state ->> '\''status'\'' = ANY (c_live_states) OR v_event ->> '\''type'\'' IN ('\''MATCH_START'\'', '\''REOPEN'\'') THEN\n",
          "        IF v_actor <> '\''leitung'\'' AND (v_state ->> '\''status'\'' = ANY (c_live_states) OR v_event ->> '\''type'\'' IN ('\''MATCH_START'\'', '\''REOPEN'\'')) THEN\n")],
  # M7 Auflage weg: auch an nicht laufenden Spielen immer geprueft
  "M7": [("        IF v_state ->> '\''status'\'' = ANY (c_live_states) OR v_event ->> '\''type'\'' IN ('\''MATCH_START'\'', '\''REOPEN'\'') THEN\n", "        IF true THEN\n")],
  # M8 p_expected_epoch ignoriert
  "M8": [("  IF p_expected_epoch <> v_fc.epoch THEN\n", "  IF false THEN\n")],
  # M9 EXECUTE der Uebernahme auch fuer anon
  "M9": [("GRANT EXECUTE ON FUNCTION public.take_field_control(uuid, integer, uuid, text, integer) TO authenticated;\n",
          "GRANT EXECUTE ON FUNCTION public.take_field_control(uuid, integer, uuid, text, integer) TO authenticated, anon;\n")],
  # M10 Tabellenrechte fuer authenticated bleiben
  "M10": [("REVOKE ALL ON TABLE public.field_control FROM PUBLIC, anon, authenticated;\n", "REVOKE ALL ON TABLE public.field_control FROM PUBLIC, anon;\n")],
  # M11 Stand fuer alle Mitglieder (ohne writeMatchData)
  "M11": [("     AND public.has_tournament_permission(p_tournament_id, '\''writeMatchData'\'');\n", "     AND true;\n")],
  # M15 (Fixrunde 2) Uebernahme ohne erwartete Epoche wieder erlaubt
  "M15": [("  IF p_tournament_id IS NULL OR p_field IS NULL OR p_device_id IS NULL OR p_expected_epoch IS NULL THEN\n",
           "  IF p_tournament_id IS NULL OR p_field IS NULL OR p_device_id IS NULL THEN\n")],
  # M12 (Review R3) REOPEN braucht keine Steuer mehr
  "M12": [("OR v_event ->> '\''type'\'' IN ('\''MATCH_START'\'', '\''REOPEN'\'') THEN\n", "OR v_event ->> '\''type'\'' IN ('\''MATCH_START'\'') THEN\n")],
  # M13 (Review R4) isMine ohne Geraete-Vergleich
  "M13": [("coalesce(fc.holder_user_id = auth.uid() AND fc.holder_device_id = p_device_id, false)", "coalesce(fc.holder_user_id = auth.uid(), false)")],
  # M14 (Review R5) Epochen-Ausnahme nach Anspruch im selben Aufruf entfernt
  "M14": [("            IF NOT v_claimed_in_call AND v_epoch_sent IS NOT NULL AND v_epoch_sent <> v_fc.epoch THEN\n",
           "            IF v_epoch_sent IS NOT NULL AND v_epoch_sent <> v_fc.epoch THEN\n")],
}
s = sys.stdin.read()
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
setup_before

if [[ "$MODE" == "without-migration" ]]; then
  run_probes
  summary
  K_DEV="${DEVS[$(cat_index K)]}"; R_DEV="${DEVS[$(cat_index R)]}"
  if [[ "$K_DEV" -gt 0 && "$R_DEV" -gt 0 ]]; then
    echo "Ohne Migration: K und R rot -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (K=$K_DEV, R=$R_DEV muessen > 0 sein)."
  exit 1
fi

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
DATA_BEFORE="$(q "SELECT (SELECT count(*) FROM public.match_events) || '|' || (SELECT count(*) FROM public.matches) || '|' || (SELECT count(*) FROM public.tournament_collaborators);")"
echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE"

# --- S: Schema ---------------------------------------------------------------------------------------------
check S "Bestand: Ereignisse, Spiele, Mitglieder unveraendert (keine Datenaenderung)" "$DATA_BEFORE" \
  "$(q "SELECT (SELECT count(*) FROM public.match_events) || '|' || (SELECT count(*) FROM public.matches) || '|' || (SELECT count(*) FROM public.tournament_collaborators);")"
check S "field_control leer nach dem Einspielen" "0" "$(q "SELECT count(*) FROM public.field_control;")"
check S "RPCs SECURITY DEFINER mit search_path; field_control_info nicht SECURITY DEFINER" \
  "field_control_info:false:{\"search_path=public, pg_temp\"}|field_control_state:true:{\"search_path=public, pg_temp\"}|take_field_control:true:{\"search_path=public, pg_temp\"}" \
  "$(q "SELECT string_agg(p.proname || ':' || p.prosecdef || ':' || p.proconfig::text, '|' ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('field_control_info', 'field_control_state', 'take_field_control');")"
check S "append_match_events: Signatur und Rechte unveraendert (authenticated ja, anon/service_role nein)" "true|false|false" \
  "$(q "SELECT has_function_privilege('authenticated', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE') || '|' || has_function_privilege('anon', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE') || '|' || has_function_privilege('service_role', 'public.append_match_events(uuid,jsonb,integer,uuid)', 'EXECUTE');")"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in tables columns functions triggers policies indexes rls_tables; do
  case "$dim" in tables|rls_tables) expected=1 ;; columns) expected=7 ;; functions) expected=3 ;; indexes) expected=1 ;; *) expected=0 ;; esac
  check S "Katalogzaehlung $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done

run_probes
run_assertions

# --- W: idempotent -----------------------------------------------------------------------------------------
STATE_BEFORE_W="$(q "SELECT string_agg(tournament_id || ':' || field || ':' || epoch || ':' || coalesce(holder_user_id::text, '-'), ',' ORDER BY tournament_id, field) FROM public.field_control;")"
set +e
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
W_EXIT=$?
set -e
check W "zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check W "danach Steuer-Stand unveraendert, Schema wie nach dem ersten Einspielen" "gleich|identisch" \
  "$([[ "$(q "SELECT string_agg(tournament_id || ':' || field || ':' || epoch || ':' || coalesce(holder_user_id::text, '-'), ',' ORDER BY tournament_id, field) FROM public.field_control;")" == "$STATE_BEFORE_W" ]] && echo gleich || echo verschieden)|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg (Anhang B) -------------------------------------------------------------------------------
rueckweg_sql | psql_stdin
DUMP_ROLLED_BACK="$(schema_dump)"
check X "nach dem Rueckweg: Schema public = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi
ev GOAL "$(E rollback-goal)" "$(goal "$(team "$T_LIVE" nord)" 5000)"
send "$U_OLLI" "$D_OLLI_TABLET" "$(match "$T_LIVE" 9)"
check X "nach dem Rueckweg: Olli traegt wieder ohne Steuer ein (Schreibweg wie 20261028_003)" "accepted" "$(results "$OUT")"
psql_stdin < "$TARGET_FILE"
check X "danach erneut einspielbar (Schema = erstes Einspielen)" "identisch" "$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f"
  echo "OK    spaetere Migration laeuft: $(basename "$f")" >&2
done

# --- N: Steuer je Feld nach allen spaeteren Migrationen (A-25b 20261110_005 ersetzt append_match_events erneut) --------
if [[ ${#AFTER[@]} -gt 0 ]]; then
  psql_stdin <<SQL
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start) VALUES
  ('$(match "$T_RACE" 31)', '$T_RACE', 8, 3, '$(team "$T_RACE" nord)', '$(team "$T_RACE" sued)', 31, '16:00'),
  ('$(match "$T_RACE" 32)', '$T_RACE', 8, 3, '$(team "$T_RACE" west)', '$(team "$T_RACE" mitte)', 32, '16:00');
SQL
  ev MATCH_START "$(E nach-start-31)" '{"clockMs":null}'
  send "$U_TOM_HANDY" "$D_TOM_HANDY" "$(match "$T_RACE" 31)"
  check N "nach $(basename "${AFTER[${#AFTER[@]}-1]}"): Toms Anpfiff von Spiel 31 beansprucht das freie Feld 3" "accepted|$U_TOM_HANDY|$D_TOM_HANDY|1" \
    "$(results "$OUT")|$(holder "$T_RACE" 3)"
  ev GOAL "$(E nach-olli-tor)" "$(goal "$(team "$T_RACE" nord)")"
  send "$U_OLLI" "$D_OLLI_TABLET" "$(match "$T_RACE" 31)"
  check N "@FU-026 nach den spaeteren Migrationen: Ollis Tor auf Toms Feld 3 abgelehnt (NOT_CONTROLLER)" "rejected:NOT_CONTROLLER:OTHER_DEVICE" "$(results "$OUT")"
  ev MATCH_START "$(E nach-start-32)" '{"clockMs":null}'
  ev MATCH_END "$(E nach-ende-32)" '{"at": 2000, "clockMs": 600000}'
  send "$U_TOM_HANDY" "$D_TOM_HANDY" "$(match "$T_RACE" 32)"
  ev REOPEN "$(E nach-olli-reopen)" '{"at": 3000}'
  send "$U_OLLI" "$D_OLLI_TABLET" "$(match "$T_RACE" 32)"
  check N "brief L5/L6 nach den spaeteren Migrationen: Olli oeffnet das gespielte Spiel 32 auf Toms Feld 3 nicht (NOT_CONTROLLER, bleibt beendet)" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE|finished" "$(results "$OUT")|$(score "$(match "$T_RACE" 32)" | cut -d'|' -f2)"
  priv_after="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || true
  check N "Rechte-Assertion nach allen Migrationen: append-match-events-checks-field-control |t, keine Zeile |f" "append-match-events-checks-field-control|t|" \
    "$(grep -E '^append-match-events-checks-field-control\|' <<<"$priv_after" || true)|$(grep -v '|t$' <<<"$priv_after" || true)"
fi

summary
echo
echo "Ergebnis: $(total_dev) Abweichung(en)."
[[ "$(total_dev)" -eq 0 ]]
