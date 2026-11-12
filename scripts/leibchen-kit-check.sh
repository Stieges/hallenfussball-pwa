#!/usr/bin/env bash
#
# leibchen-kit-check.sh — Container-Beweis fuer supabase/migrations/20261124_002_leibchen_schritt2.sql
# (Leibchen Schritt 2a, Server: matches.kit_decision, match_kit_set, Waechter, Anpfiff-Projektion, Zuruecknahme bei Teamwechsel).
# Muster: scripts/field-control-check.sh (Wegwerf-Container supabase/postgres, Baseline + Migrationen seit Baseline,
# Aufraeumen per trap, --without-migration, --gegenprobe).
#
# Testwerte aus dem Gherkin (Spiel leiten, Zuschauer und Monitor): Turnierleitung Olli (Eigentuemer), Co-Admin Maria, Helfer Tom
# (Handy und Tablet) und Paul, Zuschauerin Petra (angemeldet ohne Rolle); Spiel 1 bis 7, Feld 1 bis 3; TSV Waging 1 / TSV Petting.
# Jede Gruppe hat ihr eigenes Turnier, damit das "Gegeben" woertlich gilt. Spiel 1 (Feld 1) und Spiel 5 (Feld 2) sind beendet,
# Spiel 2 ist das naechste Spiel auf Feld 1, Spiel 6 auf Feld 2, Spiel 3 und 4 folgen, Spiel 7 hat noch kein zweites Team.
#
# Kategorien (je Zeile eine Szenario-Kennung oder ein Gegenbeispiel im Namen):
#   R  Recht: wer darf ueberhaupt (@SL-213, @SL-227 letzte Zeile, @SL-150 Zeile 2), kein Recht / kein Spiel / Papierkorb gleich (42501).
#   Z  Zustand: offen / keine / bestaetigt (@SL-220), Aendern (@SL-208, @SL-209), Aufgeben (@SL-202), Normalisierung, Wiederholen.
#   C  Steuerung: nur das steuernde Geraet, Epoche, freies Feld ohne Anspruch (@SL-202, @SL-213, @SL-227, @SL-229).
#   O  Reihenfolge: zuletzt beim Server angekommen gewinnt, auch bei Gleichzeitigkeit (@SL-228).
#   V  Vorab-Festlegung fuer ein spaeteres Spiel (@SL-236), Anzeige-Spalten (@SL-215, @SL-216).
#   L  Laufendes Spiel: nur Turnierleitung, beendetes gesperrt (@SL-150).
#   T  Teams: Zuruecknahme bei Teamwechsel und Seitentausch (@SL-212, @SL-235), Trikotfarbe laesst die Wahl stehen (@W3-028),
#      erwartete Teams (@SL-229).
#   F  Form: strikte Pruefung der Parameter (22023).
#   A  Anpfiff-Zusammenspiel: Projektion, Anpfiff ohne Tipp, Anpfiff rueckgaengig (@SL-210, @SL-214).
#   G  Waechter: Client-Rollen setzen kit_decision weder im INSERT noch im UPDATE (HF003).
#   S  Schema/Rechte: Spalte, Pruefregel, Trigger, EXECUTE nur authenticated, Rechte-Assertion, Katalogzaehlung.
#   W  zweites Einspielen (idempotent).  X  Rueckweg -> Schema = vor der Migration.
#
# Aufrufoptionen:
#   bash scripts/leibchen-kit-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/leibchen-kit-check.sh --without-migration  Gegenprobe: ohne die Migration muessen R, Z, C, L rot sein
#   bash scripts/leibchen-kit-check.sh --gegenprobe         je Lauf eine Mutation der Migration (M1-M24); Exit 0 NUR, wenn
#                                                           JEDE Mutation mindestens eine Pruefung rot faerbt
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container (nativ, per
# DOCKER_PLATFORM ueberschreibbar), wird am Ende entfernt (trap). Harness-Hilfen liegen im Schema "harness".
#
set -euo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe)" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie field-control-check.sh
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261124_002_leibchen_schritt2.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
ROLLBACK_FILE="$REPO_ROOT/supabase/rollbacks/20261124_002_leibchen_schritt2_rollback.sql"
CONTAINER_PREFIX="leibchen-kit-check-$$"
CURRENT_CONTAINER=""

[[ -f "$TARGET_FILE" ]] || { echo "::error::$TARGET_NAME fehlt." >&2; exit 1; }

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
[[ "$SEEN_TARGET" -eq 1 ]] || { echo "::error::$TARGET_NAME nicht in der Liste 'neuer als Baseline'." >&2; exit 1; }

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

CATS=(R Z C O V L T F A G S W X)
DEVS=(0 0 0 0 0 0 0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0 0 0 0 0 0 0)
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
reset_counts() { DEVS=(0 0 0 0 0 0 0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0 0 0 0 0 0 0); }

uuid_for() {
  local h
  h="$(printf '%s' "leibchen-kit-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
# Personen: Konten (Olli, Maria, Trainer Rot, Vera, Frieda, Petra) und Geraetesitzungen ohne Konto (Tom Handy, Tom Tablet, Paul).
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_TRAINER="$(uuid_for user:trainer)"
U_VERA="$(uuid_for user:vera)"; U_FRIEDA="$(uuid_for user:frieda)"; U_PETRA="$(uuid_for user:petra)"
U_TOM_HANDY="$(uuid_for user:tom-handy)"; U_TOM_TABLET="$(uuid_for user:tom-tablet)"; U_PAUL="$(uuid_for user:paul)"
U_SCREEN="$(uuid_for user:hallen-rechner)"
ANON_UIDS=" $U_TOM_HANDY $U_TOM_TABLET $U_PAUL $U_SCREEN "
D_OLLI="$(uuid_for device:olli-tablet)"; D_MARIA="$(uuid_for device:maria)"
D_TOM="$(uuid_for device:tom-handy)"; D_TOM2="$(uuid_for device:tom-tablet)"; D_PAUL="$(uuid_for device:paul)"
GELB="#FFCC00"; ORANGE="#FF6600"
team() { uuid_for "team:$1:$2"; }
match() { uuid_for "match:$1:$2"; }
E() { uuid_for "event:$1"; }
tid() { uuid_for "tournament:$1"; }

is_anon() { [[ "$ANON_UIDS" == *" $1 "* ]] && echo true || echo false; }
sqlnull() { [[ -z "$1" ]] && echo "NULL" || echo "'$1'"; }
# kit <Nutzer|leer> <Geraet|leer> <Spiel> <decision> <kit-json|leer> [Epoche] [Rolle] -- Antwort: rohes jsonb oder error:<SQLSTATE>
kit() {
  local kitarg="NULL"
  [[ -n "${5:-}" ]] && kitarg="\$J\$${5}\$J\$::jsonb"
  q "SELECT harness.kit($(sqlnull "$1")::uuid, $( [[ -n "$1" ]] && is_anon "$1" || echo false ), '$3'::uuid, $(sqlnull "$4"), $kitarg, $(sqlnull "$2")::uuid, ${6:-NULL}, '${7:-authenticated}');"
}
bib() { jq -cn --arg s "$1" --arg c "$2" '{bibSide: $s, bibColor: $c}'; }
# bibt <Seite> <Farbe> <Team a> <Team b> -- wie bib, dazu die Teams, die das Geraet beim Waehlen sah; teams <a> <b> nur die Teams
bibt() { jq -cn --arg s "$1" --arg c "$2" --arg a "$3" --arg b "$4" '{bibSide: $s, bibColor: $c, teamA: $a, teamB: $b}'; }
teams() { jq -cn --arg a "$1" --arg b "$2" '{teamA: $a, teamB: $b}'; }
# res <Antwort> -- "saved:<phase>:<decision>" | "rejected:<code>[:<Grund>]" | "error:<SQLSTATE>"
res() {
  jq -r 'if .status == "saved" then "saved:" + .phase + ":" + .decision
         elif .status == "rejected" then "rejected:" + .code + (if .detail.reason then ":" + .detail.reason else "" end)
         else "?" end' <<<"$1" 2>/dev/null || echo "$1"
}
# row <Spiel> -- "Zustand|Seite|Farbe a|Farbe b" (leer = NULL)
row() { q "SELECT coalesce(kit_decision, '-') || '|' || coalesce(bib_side, '-') || '|' || coalesce(kit_color_a, '-') || '|' || coalesce(kit_color_b, '-') FROM public.matches WHERE id = '$1';"; }
rowmd5() { q "SELECT md5(m::text) FROM public.matches m WHERE id = '$1';"; }
# take <Nutzer> <Turnier> <Feld> <Geraet> <Bezeichnung> <erwartete Epoche> -- Feld uebernehmen (echter Weg)
take() { q "SELECT harness.run('$1'::uuid, $(is_anon "$1"), \$S\$SELECT public.take_field_control('$2'::uuid, $3, '$4'::uuid, '$5', $6)::text\$S\$, 'authenticated');" | jq -r '.status' 2>/dev/null || echo "take-fehlgeschlagen"; }
holder() { q "SELECT coalesce(holder_user_id::text, 'frei') || '|' || epoch FROM public.field_control WHERE tournament_id = '$1' AND field = $2;"; }
# client <Nutzer|leer> <SQL> [Rolle] -- 'ok:<Zeilen>' oder 'error:<SQLSTATE>'
client() { q "SELECT harness.exec($(sqlnull "$1")::uuid, $( [[ -n "$1" ]] && is_anon "$1" || echo false ), \$S\$$2\$S\$, '${3:-authenticated}');"; }
# state <Spiel> <Status> -- Spielstatus direkt setzen (Eigentuemer der Tabelle)
state() { q "UPDATE public.matches SET match_status = '$2' WHERE id = '$1';" >/dev/null; }

EVS=""
ev() {
  local extra="${3:-}" one
  [[ -z "$extra" ]] && extra='{}'
  one="$(jq -cn --arg type "$1" --arg id "$2" --argjson extra "$extra" \
    '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, teamId: null, targetId: null, payload: {}} + $extra')"
  EVS="$EVS$one"$'\n'
}
OUT=""
send() { # send <Nutzer> <Geraet|leer> <Spiel>
  local events
  events="$(jq -cs '.' <<<"$EVS")"
  EVS=""
  OUT="$(q "SELECT harness.call('$1'::uuid, $(is_anon "$1"), '$3'::uuid, \$J\$$events\$J\$::jsonb, $(sqlnull "$2")::uuid);")"
}
results() { jq -r '[.results[]? | .status + (if .code then ":" + .code else "" end)] | join(",")' <<<"$1" 2>/dev/null || echo "keine-json:$1"; }

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
-- match_kit_set dynamisch (ohne Migration gibt es sie nicht -> error:42883).
CREATE FUNCTION harness.kit(p_user uuid, p_anon boolean, p_match uuid, p_decision text, p_kit jsonb, p_device uuid,
                            p_epoch integer, p_role text) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v text;
BEGIN
  PERFORM harness.claims(p_user, p_anon, p_role);
  BEGIN
    EXECUTE 'SELECT public.match_kit_set($1, $2, $3, $4, $5)::text' INTO v USING p_match, p_decision, p_kit, p_device, p_epoch;
  EXCEPTION WHEN OTHERS THEN
    v := 'error:' || SQLSTATE;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
CREATE FUNCTION harness.run(p_user uuid, p_anon boolean, p_sql text, p_role text) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v text;
BEGIN
  PERFORM harness.claims(p_user, p_anon, p_role);
  BEGIN
    EXECUTE p_sql INTO v;
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

# Konten (VOR der Ziel-Migration, damit der Lauf ohne Migration dieselben Daten hat).
setup_users() {
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@kit.test'), ('$U_MARIA'::uuid, 'maria@kit.test'), ('$U_TRAINER'::uuid, 'trainer@kit.test'),
             ('$U_VERA'::uuid, 'vera@kit.test'), ('$U_FRIEDA'::uuid, 'frieda@kit.test'), ('$U_PETRA'::uuid, 'petra@kit.test'),
             ('$U_TOM_HANDY'::uuid, NULL), ('$U_TOM_TABLET'::uuid, NULL), ('$U_PAUL'::uuid, NULL), ('$U_SCREEN'::uuid, NULL)) AS u(id, email);
INSERT INTO public.profiles (id, display_name, email)
VALUES ('$U_OLLI', 'Olli', 'olli@kit.test'), ('$U_MARIA', 'Maria', 'maria@kit.test'), ('$U_TRAINER', 'Trainer Rot', 'trainer@kit.test'),
       ('$U_VERA', 'Vera', 'vera@kit.test'), ('$U_FRIEDA', 'Frieda', 'frieda@kit.test'), ('$U_PETRA', 'Petra', 'petra@kit.test')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email;
SQL
}

# neues Turnier mit Mitgliedern, vier Teams und sieben Spielen (siehe Kopf); Trikotfarben: Waging Blau, Petting Blau, West Rot, Mitte Weiss.
new_t() {
  local t m
  t="$(tid "$1")"
  psql_stdin <<SQL
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES ('$t', '$U_OLLI', 'Hallencup $1', '2026-11-28', 4, 10, '{}'::jsonb);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) VALUES
  ('$t', '$U_MARIA', 'co-admin', now(), 'Maria'), ('$t', '$U_TOM_HANDY', 'helper', now(), 'Tom'),
  ('$t', '$U_TOM_TABLET', 'helper', now(), 'Tom'), ('$t', '$U_PAUL', 'helper', now(), 'Paul'),
  ('$t', '$U_SCREEN', 'screen', now(), 'Hallen-Rechner'), ('$t', '$U_TRAINER', 'trainer', now(), 'Trainer Rot'),
  ('$t', '$U_VERA', 'viewer', now(), 'Vera');
INSERT INTO public.teams (id, tournament_id, name, color_primary) VALUES
  ('$(team "$t" waging)', '$t', 'TSV Waging 1', '#1565C0'), ('$(team "$t" petting)', '$t', 'TSV Petting', '#1565C0'),
  ('$(team "$t" west)', '$t', 'TSV West', '#C62828'), ('$(team "$t" mitte)', '$t', 'SG Mitte', '#FFFFFF');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start, match_status, slot_b_source) VALUES
  ('$(match "$t" 1)', '$t', 1, 1, '$(team "$t" west)', '$(team "$t" mitte)', 1, '15:00', 'finished', NULL),
  ('$(match "$t" 2)', '$t', 2, 1, '$(team "$t" waging)', '$(team "$t" petting)', 2, '15:15', 'scheduled', NULL),
  ('$(match "$t" 3)', '$t', 3, 1, '$(team "$t" west)', '$(team "$t" mitte)', 3, '15:30', 'scheduled', NULL),
  ('$(match "$t" 4)', '$t', 4, 1, '$(team "$t" waging)', '$(team "$t" west)', 4, '15:45', 'scheduled', NULL),
  ('$(match "$t" 5)', '$t', 1, 2, '$(team "$t" waging)', '$(team "$t" mitte)', 5, '15:00', 'finished', NULL),
  ('$(match "$t" 6)', '$t', 2, 2, '$(team "$t" petting)', '$(team "$t" west)', 6, '15:15', 'scheduled', NULL),
  ('$(match "$t" 7)', '$t', 2, 3, '$(team "$t" waging)', NULL, 7, '15:15', 'scheduled', '{"kind":"groupRank","group":"A","rank":2}'::jsonb);
SQL
}

setup_before() {
  echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  psql_stdin < "$BASELINE_FILE"
  local f
  for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done
  setup_helpers
  setup_users
  # Turniere VOR der Migration, damit der Lauf ohne Migration dieselben Daten hat (Spalte kit_decision gibt es dann noch nicht).
  for g in recht zustand steuer reihe vorab laufend team form anpfiff anpfiff2 waechter papierkorb abgeschlossen; do new_t "$g"; done
  q "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$(tid papierkorb)';" >/dev/null
}

# ---------------------------------------------------------------------------------------------------------
# Proben (gemeinsam fuer normalen Lauf, ohne Migration und Gegenprobe)
# ---------------------------------------------------------------------------------------------------------
run_probes() {
  local t m2 m3 m4 m6 m7 m1 m5 r r2 before tmp pid
  local WAGING PETTING WEST MITTE

  # ============================================================================================================
  # R: Recht
  # ============================================================================================================
  t="$(tid recht)"; m2="$(match "$t" 2)"; m4="$(match "$t" 4)"
  check R "@SL-213 Olli (Turnierleitung) darf bestaetigen" "saved:before:bib" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib a $GELB)")")"
  check R "@SL-213 Maria (Co-Admin) darf bestaetigen" "saved:before:bib" "$(res "$(kit "$U_MARIA" "$D_MARIA" "$m2" bib "$(bib a $ORANGE)")")"
  check R "@SL-213 Tom (Helfer, Feld frei) darf bestaetigen" "saved:before:none" "$(res "$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" none)")"
  before="$(rowmd5 "$m2")"
  for who in "Vera (Zuschauerin mit Mitgliedschaft)|$U_VERA" "Trainer Rot (Rolle ohne Recht)|$U_TRAINER" "Hallen-Rechner (Rolle screen)|$U_SCREEN" \
             "Frieda (kein Mitglied)|$U_FRIEDA" "Petra (angemeldet, ohne Rolle)|$U_PETRA"; do
    check R "@SL-227 Gegenbeispiel: ${who%%|*} weist der Server immer ab (42501), Spiel unveraendert" "error:42501|$before" \
      "$(res "$(kit "${who##*|}" "$D_TOM" "$m2" bib "$(bib a $GELB)")")|$(rowmd5 "$m2")"
  done
  check R "Gegenbeispiel: ohne Anmeldung (anon, kein Konto) 42501" "error:42501" "$(res "$(kit "" "" "$m2" none "" NULL anon)")"
  check R "Gegenbeispiel: unbekanntes Spiel -> derselbe Fehler 42501 (kein Hinweis, ob es das Spiel gibt)" "error:42501" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$(uuid_for match:gibt-es-nicht)" none)")"
  check R "Gegenbeispiel: Turnier im Papierkorb -> 42501" "error:42501" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$(match "$(tid papierkorb)" 2)" none)")"
  check R "Gegenbeispiel: anon-Rolle ohne EXECUTE -> 42501 (kein Zugriff auf die Funktion)" "error:42501" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" none "" NULL anon)")"
  check R "@SL-150 Gegenbeispiel: Fremdes Turnier -- Olli im Turnier 'recht' auf einem Spiel des Turniers 'zustand' ist Eigentuemer, aber Frieda nicht" "error:42501" \
    "$(res "$(kit "$U_FRIEDA" "$D_TOM" "$(match "$(tid zustand)" 2)" none)")"

  # ============================================================================================================
  # Z: Zustand
  # ============================================================================================================
  t="$(tid zustand)"; m2="$(match "$t" 2)"
  check Z "@SL-220 neues Spiel: nichts getippt = offen (NULL), keine Farbe" "-|-|-|-" "$(row "$m2")"
  r="$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib a $GELB)")"
  check Z "@SL-201 'Bestaetigen' (Waging, Heim, Gelb) wird angenommen und meldet den Zustand" "saved:before:bib" "$(res "$r")"
  check Z "@SL-220 bestaetigt: Zustand bib, Seite a, nur die Leibchen-Seite traegt eine Farbe" "bib|a|$GELB|-" "$(row "$m2")"
  check Z "@SL-201 die Antwort nennt die gespeicherte Wahl" "a|$GELB" "$(jq -r '.kit.bibSide + "|" + .kit.bibColor' <<<"$r" 2>/dev/null || echo "$r")"
  r="$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib b $ORANGE)")"
  check Z "@SL-209 'Aendern' auf die andere Seite (Petting, Orange): nur eine Seite traegt, die alte Farbspalte ist leer" "bib|b|-|$ORANGE" "$(row "$m2")"
  check Z "@SL-209 Gegenbeispiel: nie tragen beide Seiten Leibchen (genau eine Farbspalte gesetzt)" "1" \
    "$(q "SELECT (kit_color_a IS NOT NULL)::int + (kit_color_b IS NOT NULL)::int FROM public.matches WHERE id = '$m2';")"
  kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib b $GELB)" >/dev/null
  check Z "@SL-209 'Aendern' der Farbe auf derselben Seite: neue Farbe, kein Rest" "bib|b|-|$GELB" "$(row "$m2")"
  r="$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" none)"
  check Z "@SL-202 Aufgeben ueber 'Keine Leibchen': Zustand none, Seite und beide Farben leer" "saved:before:none|none|-|-|-" "$(res "$r")|$(row "$m2")"
  check Z "@SL-220 'Keine Leibchen' ist NICHT dasselbe wie nichts getippt (none statt NULL)" "none" "$(q "SELECT kit_decision FROM public.matches WHERE id = '$m2';")"
  kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib a '#ffcc00')" >/dev/null
  check Z "Normalisierung: '#ffcc00' wird als '#FFCC00' gespeichert" "bib|a|#FFCC00|-" "$(row "$m2")"
  before="$(rowmd5 "$m2")"
  kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib a '#ffcc00')" >/dev/null
  check Z "Wiederholen mit denselben Daten ist harmlos (Zeile unveraendert)" "bib|a|#FFCC00|-" "$(row "$m2")"
  check Z "@SL-220 andere Spiele bleiben offen (Spiel 3 und 6 unberuehrt)" "-|-|-|-;-|-|-|-" "$(row "$(match "$t" 3)");$(row "$(match "$t" 6)")"
  check Z "Gegenbeispiel: Spiel 7 hat noch kein zweites Team -> 22023 (Teams noch offen hat keine Karte)" "error:22023" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$(match "$t" 7)" bib "$(bib a $GELB)")")"

  # ============================================================================================================
  # C: Steuerung
  # ============================================================================================================
  t="$(tid steuer)"; m2="$(match "$t" 2)"; m6="$(match "$t" 6)"
  check C "@SL-227 freies Feld 1: kein Halter vor dem Aufruf" "" "$(holder "$t" 1)"
  r="$(kit "$U_PAUL" "$D_PAUL" "$m2" bib "$(bib a $GELB)")"
  check C "@SL-227 Paul (Helfer, haelt Feld 2) darf auf dem freien Feld 1 bestaetigen (Regel am Server)" "saved:before:bib" "$(res "$r")"
  check C "@SL-227 die Wahl begruendet keinen Anspruch: Feld 1 bleibt frei (field_control ohne Zeile)" "" "$(holder "$t" 1)"
  check C "@SL-202 Tom uebernimmt Feld 1 (take_field_control, Epoche 0 -> 1)" "taken|$U_TOM_HANDY|1" \
    "$(take "$U_TOM_HANDY" "$t" 1 "$D_TOM" "Tom Handy" 0)|$(holder "$t" 1)"
  EPOCH="1"
  check C "@SL-202 das steuernde Geraet (Toms Handy, richtige Epoche) darf bestaetigen" "saved:before:bib" \
    "$(res "$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib b $ORANGE)" $EPOCH)")"
  before="$(rowmd5 "$m2")"
  r="$(kit "$U_PAUL" "$D_PAUL" "$m2" bib "$(bib a $GELB)")"
  check C "@SL-227 Paul auf Feld 1, das Toms Geraet haelt: Server weist ab (NOT_CONTROLLER/OTHER_DEVICE)" "rejected:NOT_CONTROLLER:OTHER_DEVICE|$before" "$(res "$r")|$(rowmd5 "$m2")"
  check C "@SL-202 die Abweisung nennt den Halter (Tom) fuer das Angebot 'Feld uebernehmen'" "Tom|false" \
    "$(jq -r '.detail.holderName + "|" + (.detail.isMine | tostring)' <<<"$r" 2>/dev/null || echo "$r")"
  check C "@SL-213 Olli auf einem Tablet, das Feld 1 nicht steuert: abgewiesen (erst nach der Uebernahme)" "rejected:NOT_CONTROLLER:OTHER_DEVICE|$before" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib a $GELB)")")|$(rowmd5 "$m2")"
  check C "@SL-229 Gegenbeispiel: Toms zweites Geraet (Tablet, anderes Konto/Geraet) steuert nicht" "rejected:NOT_CONTROLLER:OTHER_DEVICE" \
    "$(res "$(kit "$U_TOM_TABLET" "$D_TOM2" "$m2" bib "$(bib a $GELB)")")"
  check C "@SL-229 Gegenbeispiel: dasselbe Konto mit anderer Geraete-ID steuert nicht" "rejected:NOT_CONTROLLER:OTHER_DEVICE" \
    "$(res "$(kit "$U_TOM_HANDY" "$D_TOM2" "$m2" bib "$(bib a $GELB)")")"
  check C "@SL-229 Gegenbeispiel: ohne Geraete-ID (App vor B-49) steuert nicht, wo ein Halter steht" "rejected:NOT_CONTROLLER:OTHER_DEVICE" \
    "$(res "$(kit "$U_TOM_HANDY" "" "$m2" bib "$(bib a $GELB)")")"
  check C "@SL-229 Toms Handy mit veralteter Epoche 0: STALE_EPOCH" "rejected:NOT_CONTROLLER:STALE_EPOCH" \
    "$(res "$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib a $GELB)" 0)")"
  check C "@SL-229 Toms Handy ohne Epoche (Halter, Epoche null) gilt" "saved:before:none" "$(res "$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" none)")"
  check C "@SL-229 Olli uebernimmt Feld 1 von Tom (Epoche 1 -> 2)" "taken|$U_OLLI|2" "$(take "$U_OLLI" "$t" 1 "$D_OLLI" "Ollis Tablet" 1)|$(holder "$t" 1)"
  before="$(rowmd5 "$m2")"
  check C "@SL-229 Toms spaet eintreffende Bestaetigung wird abgewiesen, Spiel unveraendert" "rejected:NOT_CONTROLLER:OTHER_DEVICE|$before" \
    "$(res "$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib a $GELB)" 1)")|$(rowmd5 "$m2")"
  check C "@SL-213 nach der Uebernahme darf Olli bestaetigen" "saved:before:bib" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib a $GELB)" 2)")"
  check C "@SL-227 Feld 2 ist unabhaengig: Paul auf Feld 2 (frei) darf bestaetigen" "saved:before:bib" "$(res "$(kit "$U_PAUL" "$D_PAUL" "$m6" bib "$(bib b $GELB)")")"

  # ============================================================================================================
  # O: Reihenfolge
  # ============================================================================================================
  t="$(tid reihe)"; m2="$(match "$t" 2)"; m6="$(match "$t" 6)"
  kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib a $GELB)" >/dev/null
  kit "$U_PAUL" "$D_PAUL" "$m2" bib "$(bib b $ORANGE)" >/dev/null
  check O "@SL-228 Zeile 1: Tom (Gelb, Waging) dann Paul (Orange, Petting) -- die spaeter angekommene gilt" "bib|b|-|$ORANGE" "$(row "$m2")"
  kit "$U_PAUL" "$D_PAUL" "$m2" bib "$(bib b $ORANGE)" >/dev/null
  kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib a $GELB)" >/dev/null
  check O "@SL-228 Zeile 2: Pauls zuerst, Toms kommt danach an -- Toms Bestaetigung gilt (zuletzt angekommen)" "bib|a|$GELB|-" "$(row "$m2")"
  # Gleichzeitig: Pauls Aufruf haelt die Zeilensperre 2 s, Toms kommt in dieser Zeit an und wartet; er ist der letzte.
  tmp="$(mktemp)"
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -q -tA >"$tmp" 2>&1 <<SQL &
BEGIN;
SELECT harness.kit('$U_PAUL'::uuid, true, '$m6'::uuid, 'bib', \$J\${"bibSide":"b","bibColor":"$ORANGE"}\$J\$::jsonb, '$D_PAUL'::uuid, NULL, 'authenticated');
SELECT pg_sleep(2);
COMMIT;
SQL
  pid=$!
  sleep 0.8
  r="$(kit "$U_TOM_HANDY" "$D_TOM" "$m6" bib "$(bib a $GELB)")"
  wait "$pid" || true
  rm -f "$tmp"
  check O "@SL-228 gleichzeitig: Pauls Aufruf haelt die Zeile, Toms kommt waehrenddessen an -- Tom ist der letzte und gewinnt, kein Mischzustand" \
    "saved:before:bib|bib|a|$GELB|-" "$(res "$r")|$(row "$m6")"
  check O "@SL-228 nirgends ein stiller Widerspruch: genau eine Farbspalte gesetzt" "1" \
    "$(q "SELECT (kit_color_a IS NOT NULL)::int + (kit_color_b IS NOT NULL)::int FROM public.matches WHERE id = '$m6';")"

  # ============================================================================================================
  # V: Vorab-Festlegung (@SL-236) und das naechste Spiel
  # ============================================================================================================
  t="$(tid vorab)"; m1="$(match "$t" 1)"; m2="$(match "$t" 2)"; m3="$(match "$t" 3)"; m4="$(match "$t" 4)"; m7="$(match "$t" 7)"
  state "$m1" running                       # Toms Gerät leitet Spiel 1 auf Feld 1
  check V "@SL-236 Toms Handy uebernimmt Feld 1 (leitet Spiel 1)" "taken|$U_TOM_HANDY|1" "$(take "$U_TOM_HANDY" "$t" 1 "$D_TOM" "Tom Handy" 0)|$(holder "$t" 1)"
  before="$(rowmd5 "$m4")"
  check V "@SL-236 Olli (Turnierleitung) legt Spiel 4 vorab fest, ohne Feld 1 zu uebernehmen (anderes Geraet haelt es)" "saved:before:bib" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m4" bib "$(bib a $GELB)")")"
  check V "@SL-236 Olli hat das Feld dafuer nicht uebernommen (Halter weiter Tom, Epoche 1)" "$U_TOM_HANDY|1" "$(holder "$t" 1)"
  check V "@SL-236 Maria (Co-Admin) legt Spiel 3 vorab fest, ohne Feld 1 zu uebernehmen" "saved:before:none" "$(res "$(kit "$U_MARIA" "$D_MARIA" "$m3" none)")"
  before="$(rowmd5 "$m3")"
  check V "@SL-236 Gegenbeispiel: Paul (Helfer, haelt Feld 2) fuer Spiel 3: abgewiesen" "rejected:NOT_NEXT_MATCH|$before" \
    "$(res "$(kit "$U_PAUL" "$D_PAUL" "$m3" bib "$(bib a $GELB)")")|$(rowmd5 "$m3")"
  check V "@SL-236 Tom (Helfer, sein Gerät hält Feld 1) fuer Spiel 4, das nicht das naechste ist: abgewiesen" "rejected:NOT_NEXT_MATCH" \
    "$(res "$(kit "$U_TOM_HANDY" "$D_TOM" "$m4" bib "$(bib b $GELB)" 1)")"
  check V "@SL-236 Mama Petra (Zuschauerin) fuer Spiel 4: abgewiesen (42501)" "error:42501" "$(res "$(kit "$U_PETRA" "$D_TOM" "$m4" bib "$(bib a $GELB)")")"
  check V "@SL-236 'Keine Leibchen' vorab gilt wie 'Bestaetigen' (Olli, Spiel 4)" "saved:before:none" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m4" none)")"
  check V "@SL-216 Zeile bleibt: die Vorab-Wahl von Spiel 3 steht als none fuer jedes Geraet im Zustand (Neuladen, Uebernahme)" "none|-|-|-" "$(row "$m3")"
  check V "@SL-215 waehrend Spiel 1 laeuft, ist Spiel 2 nicht das naechste: Tom wird abgewiesen (im laufenden Spiel keine Karte fuer das naechste)" \
    "rejected:NOT_NEXT_MATCH" "$(res "$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib a $GELB)" 1)")"
  check V "@SL-236 Olli darf Spiel 2 schon waehrend Spiel 1 vorab festlegen (Halter ist Tom)" "saved:before:bib" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib a $GELB)")")"
  state "$m1" finished                       # Abpfiff von Spiel 1: Spiel 2 ist jetzt das naechste Spiel (Endstand-Cockpit)
  check V "@SL-215 Endstand von Spiel 1: das Gerät, das Feld 1 haelt (Tom), setzt das naechste Spiel 2" "saved:before:bib" \
    "$(res "$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib b $ORANGE)" 1)")"
  check V "@SL-215 die Wahl im Endstand ersetzt Ollis Vorab-Wahl: die spaeter angekommene gilt (@SL-228 Zeile 3)" "bib|b|-|$ORANGE" "$(row "$m2")"
  check V "@SL-213 nach dem Abpfiff gilt fuer Spiel 2 wieder die Steuerung: Olli (Tablet, nicht Halter) wird abgewiesen" \
    "rejected:NOT_CONTROLLER:OTHER_DEVICE" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" none)")"
  check V "@SL-215 Gegenbeispiel: Spiel 7 (zweites Team noch offen) laesst auch die Turnierleitung nicht setzen (22023)" "error:22023" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m7" bib "$(bib a $GELB)")")"

  # ============================================================================================================
  # L: Laufendes und beendetes Spiel (@SL-150)
  # ============================================================================================================
  t="$(tid laufend)"; m1="$(match "$t" 1)"; m2="$(match "$t" 2)"; m3="$(match "$t" 3)"; m4="$(match "$t" 4)"
  # Spiel 2 laeuft ohne Leibchen (Anpfiff hat beide Trikotfarben festgehalten: Waging Blau, Petting Blau)
  state "$m2" running
  q "UPDATE public.matches SET kit_color_a = '#1565C0', kit_color_b = '#1565C0', kit_decision = NULL WHERE id = '$m2';" >/dev/null
  take "$U_TOM_HANDY" "$t" 1 "$D_TOM" "Tom Handy" 0 >/dev/null     # Toms Gerät hält das Feld von Spiel 2
  check L "@SL-150 Zeile 3: Olli (eigenes Tablet, Toms Gerät haelt das Feld) traegt Orange fuer Petting im laufenden Spiel ohne Uebernahme ein" \
    "saved:live:bib|bib|b|#1565C0|$ORANGE" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib b $ORANGE)")")|$(row "$m2" | sed 's/|b|/|b|/')"
  check L "@SL-150 das Feld gehoert weiter Toms Geraet (kein Anspruch, Epoche 1)" "$U_TOM_HANDY|1" "$(holder "$t" 1)"
  check L "@SL-150 Zeile 6: Olli wechselt die Leibchen auf Waging -- Waging traegt Gelb, Petting wieder seine Teamfarbe (Blau), nie tragen beide Leibchen" \
    "saved:live:bib|bib|a|$GELB|#1565C0" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib a $GELB)")")|$(row "$m2" | sed 's/^bib|a|/bib|a|/')"
  before="$(rowmd5 "$m2")"
  check L "@SL-150 Zeile 2: Tom (Helfer, steuerndes Geraet) darf im laufenden Spiel keine Leibchen aendern (LEAD_ONLY), Spiel unveraendert" \
    "rejected:LEAD_ONLY|$before" "$(res "$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib b $GELB)" 1)")|$(rowmd5 "$m2")"
  check L "@SL-150 Gegenbeispiel: auch ein Helfer ohne Halterschaft (Paul) und 'Keine Leibchen' vom Helfer sind abgewiesen" "rejected:LEAD_ONLY;rejected:LEAD_ONLY" \
    "$(res "$(kit "$U_PAUL" "$D_PAUL" "$m2" bib "$(bib b $GELB)")");$(res "$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" none)")"
  check L "@SL-150 Maria (Co-Admin) darf wie die Turnierleitung (Seite b, Orange)" "saved:live:bib|bib|b|#1565C0|$ORANGE" \
    "$(res "$(kit "$U_MARIA" "$D_MARIA" "$m2" bib "$(bib b $ORANGE)")")|$(row "$m2")"
  check L "@SL-150 Zeile 5: Olli entfernt die Leibchen (Keine Leibchen) -- beide Teams tragen wieder ihr Trikot (Blau/Blau), Seite leer" \
    "saved:live:none|none|-|#1565C0|#1565C0" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" none)")|$(row "$m2")"
  check L "@SL-150 Olli braucht keine Epoche: auch mit veralteter Epoche 0 wird im laufenden Spiel angenommen" "saved:live:bib" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib a $GELB)" 0)")"
  state "$m2" paused
  check L "@SL-150 pausiertes Spiel (Halbzeit) zaehlt als laufend: Olli darf" "saved:live:bib" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib b $GELB)")")"
  check L "@SL-150 Gegenbeispiel: pausiertes Spiel, Helfer abgewiesen" "rejected:LEAD_ONLY" "$(res "$(kit "$U_PAUL" "$D_PAUL" "$m2" none)")"
  state "$m2" finished
  before="$(rowmd5 "$m2")"
  check L "@SL-150 Zeile 4: Olli will ein Leibchen im beendeten Spiel aendern -- der Server weist ab (MATCH_FINISHED), Spiel unveraendert" \
    "rejected:MATCH_FINISHED|$before" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib a $ORANGE)")")|$(rowmd5 "$m2")"
  check L "@SL-150 Gegenbeispiel: beendetes Spiel, Helfer" "rejected:MATCH_FINISHED" "$(res "$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" none)")"
  state "$m3" skipped
  check L "@SL-150 ausgefallenes Spiel: abgewiesen (MATCH_SKIPPED), keine Karte, keine Zeile" "rejected:MATCH_SKIPPED" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m3" none)")"
  state "$m4" running
  q "UPDATE public.matches SET kit_color_a = '#1565C0', kit_color_b = NULL WHERE id = '$m4';" >/dev/null
  kit "$U_OLLI" "$D_OLLI" "$m4" bib "$(bib b $GELB)" >/dev/null
  check L "@SL-150 laufend ohne festgehaltene Farbe der anderen Seite: bleibt leer (Anzeige nimmt die Teamfarbe), Leibchen-Seite hat Gelb" "bib|b|#1565C0|$GELB" "$(row "$m4")"

  # ============================================================================================================
  # T: Teams
  # ============================================================================================================
  t="$(tid team)"; m2="$(match "$t" 2)"; m3="$(match "$t" 3)"; m4="$(match "$t" 4)"
  WAGING="$(team "$t" waging)"; PETTING="$(team "$t" petting)"; WEST="$(team "$t" west)"; MITTE="$(team "$t" mitte)"
  kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib a $GELB)" >/dev/null
  check T "@W3-028 Olli aendert die Trikotfarbe von Waging (teams.color_primary): die bestaetigte Wahl bleibt stehen" "bib|a|$GELB|-" \
    "$(client "$U_OLLI" "UPDATE public.teams SET color_primary = '#000000' WHERE id = '$WAGING'" >/dev/null; row "$m2")"
  check T "@SL-212 Gegenbeispiel: die Trikotfarbe von Petting aendern nimmt auch nichts zurueck" "bib|a|$GELB|-" \
    "$(client "$U_OLLI" "UPDATE public.teams SET color_primary = '#FFEB3B' WHERE id = '$PETTING'" >/dev/null; row "$m2")"
  check T "@SL-212 anderes Team auf die Seite von Petting (Olli als Konto-Client, Spiel noch nicht angepfiffen): Wahl zurueckgenommen, kein HF003" \
    "ok:1|-|-|-|-" "$(client "$U_OLLI" "UPDATE public.matches SET team_b_id = '$MITTE' WHERE id = '$m2'")|$(row "$m2")"
  kit "$U_OLLI" "$D_OLLI" "$m2" none >/dev/null
  check T "@SL-212 war 'Keine Leibchen' getippt, ist auch diese Wahl zurueckgenommen (Seitentausch: beide Teams wechseln die Seite)" "ok:1|-|-|-|-" \
    "$(client "$U_OLLI" "UPDATE public.matches SET team_a_id = team_b_id, team_b_id = team_a_id WHERE id = '$m2'")|$(row "$m2")"
  kit "$U_OLLI" "$D_OLLI" "$m3" bib "$(bib b $ORANGE)" >/dev/null
  check T "@SL-212 Gegenbeispiel: Spiel-Update, das die Teams nicht aendert (Uhrzeit), laesst die Wahl stehen" "ok:1|bib|b|-|$ORANGE" \
    "$(client "$U_OLLI" "UPDATE public.matches SET team_a_id = team_a_id, scheduled_start = '15:31' WHERE id = '$m3'")|$(row "$m3")"
  check T "@SL-212 Gegenbeispiel: anderes Team im laufenden Spiel nimmt nichts zurueck (nur vor dem Anpfiff)" "bib|b|-|$ORANGE" \
    "$(state "$m3" running; q "UPDATE public.matches SET team_b_id = '$WEST' WHERE id = '$m3';" >/dev/null; row "$m3")"
  kit "$U_OLLI" "$D_OLLI" "$m4" bib "$(bib a $GELB)" >/dev/null
  check T "@SL-235 Eigentuemer (Server) tauscht das Team: Wahl zurueckgenommen" "-|-|-|-" "$(q "UPDATE public.matches SET team_a_id = '$MITTE' WHERE id = '$m4';" >/dev/null; row "$m4")"
  # erwartete Teams (@SL-229 Zeile 2)
  q "UPDATE public.matches SET team_a_id = '$WAGING', team_b_id = '$PETTING', match_status = 'scheduled', kit_decision = NULL, bib_side = NULL, kit_color_a = NULL, kit_color_b = NULL WHERE id = '$m4';" >/dev/null
  check T "@SL-229 Zeile 2: Tom bestaetigt mit den Teams Waging/Petting, die noch dort stehen -- angenommen" "saved:before:bib" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m4" bib "$(bibt a $GELB "$WAGING" "$PETTING")")")"
  before="$(rowmd5 "$m4")"
  check T "@SL-229 Zeile 2: inzwischen steht ein anderes Team auf Seite b -- der Server weist ab (TEAMS_CHANGED), Spiel unveraendert" "rejected:TEAMS_CHANGED|$before" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m4" bib "$(bibt a $ORANGE "$WAGING" "$WEST")")")|$(rowmd5 "$m4")"
  check T "@SL-229 Gegenbeispiel: auch 'Keine Leibchen' mit veralteten Teams wird abgewiesen" "rejected:TEAMS_CHANGED" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m4" none "$(teams "$PETTING" "$WAGING")")")"
  check T "@SL-229 'Keine Leibchen' mit den richtigen Teams wird angenommen" "saved:before:none" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m4" none "$(teams "$WAGING" "$PETTING")")")"

  # ============================================================================================================
  # F: Form
  # ============================================================================================================
  t="$(tid form)"; m2="$(match "$t" 2)"
  before="$(rowmd5 "$m2")"
  check F "decision fehlt -> 22023" "error:22023" "$(res "$(q "SELECT harness.kit('$U_OLLI'::uuid, false, '$m2'::uuid, NULL, NULL, '$D_OLLI'::uuid, NULL, 'authenticated');")")"
  check F "decision 'x' -> 22023" "error:22023" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" x)")"
  check F "bib ohne kit -> 22023" "error:22023" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib)")"
  check F "bibSide 'c' -> 22023" "error:22023" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib c $GELB)")")"
  check F "bibSide fehlt -> 22023" "error:22023" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(jq -cn --arg c "$GELB" '{bibColor: $c}')")")"
  check F "bibColor '#12345' (5 Stellen) -> 22023" "error:22023" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib a '#12345')")")"
  check F "bibColor 'red' -> 22023" "error:22023" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib a red)")")"
  check F "bibColor Kurzform '#fc0' -> 22023 (nur die normalisierte Langform)" "error:22023" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(bib a '#fc0')")")"
  check F "fremder Schluessel im kit -> 22023" "error:22023" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "$(jq -cn --arg c "$GELB" '{bibSide: "a", bibColor: $c, x: 1}')")")"
  check F "none mit bibSide im kit -> 22023" "error:22023" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" none "$(jq -cn '{bibSide: "a"}')")")"
  check F "kit ist ein Array -> 22023" "error:22023" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" bib "[1]")")"
  check F "teamA ohne teamB -> 22023" "error:22023" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" none "$(jq -cn --arg a "$(team "$t" waging)" '{teamA: $a}')")")"
  check F "teamA keine Kennung -> 22023" "error:22023" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" none '{"teamA":"x","teamB":"y"}')")"
  check F "keine der fehlerhaften Eingaben hat das Spiel veraendert" "$before" "$(rowmd5 "$m2")"
  check F "kit 'null' (JSON) bei none gilt als kein kit -> angenommen" "saved:before:none" "$(res "$(kit "$U_OLLI" "$D_OLLI" "$m2" none null)")"

  # ============================================================================================================
  # A: Anpfiff-Zusammenspiel (append_match_events -> matches_kit_from_match_start)
  # ============================================================================================================
  t="$(tid anpfiff)"; m2="$(match "$t" 2)"; m3="$(match "$t" 3)"; m4="$(match "$t" 4)"; m6="$(match "$t" 6)"
  # A1 mit Leibchen bestaetigt, dann Anpfiff mit demselben kit
  kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib a $GELB)" >/dev/null
  ev MATCH_START "$(E start-2)" "{\"clockMs\":null,\"payload\":{\"kit\":{\"a\":\"$GELB\",\"b\":\"#1565C0\",\"bibSide\":\"a\"}}}"
  send "$U_TOM_HANDY" "$D_TOM" "$m2"
  check A "@SL-201 Anpfiff mit dem bestaetigten Kit: angenommen, Zustand bleibt bib, beide Farben festgehalten" "accepted|bib|a|$GELB|#1565C0" "$(results "$OUT")|$(row "$m2")"
  check A "@SL-150 nach dem Anpfiff nimmt match_kit_set von Toms Geraet nichts mehr an (LEAD_ONLY)" "rejected:LEAD_ONLY" \
    "$(res "$(kit "$U_TOM_HANDY" "$D_TOM" "$m2" bib "$(bib b $ORANGE)" 1)")"
  # A2 bestaetigt, Anpfiff ohne Angabe zum Leibchen -> die Wahl bleibt stehen (Ableitung, gilt nach Vorschlag; nicht @SL-210)
  kit "$U_PAUL" "$D_PAUL" "$m6" bib "$(bib a $GELB)" >/dev/null
  ev MATCH_START "$(E start-6)" '{"clockMs":null,"payload":{"kit":{"a":"#1565C0","b":"#C62828"}}}'
  send "$U_PAUL" "$D_PAUL" "$m6"
  check A "Ableitung: bestaetigte Wahl (Heim Gelb) und Anpfiff ohne Angabe zum Leibchen: sie bleibt (bib, Seite a, Leibchenfarbe Gelb), die andere Seite bekommt die Trikotfarbe des Anpfiffs" "accepted|bib|a|$GELB|#C62828" "$(results "$OUT")|$(row "$m6")"
  # A2b dasselbe auf der Gastseite
  t2="$(tid anpfiff2)"; n2="$(match "$t2" 2)"; n6="$(match "$t2" 6)"
  kit "$U_OLLI" "$D_OLLI" "$n2" bib "$(bib b $ORANGE)" >/dev/null
  ev MATCH_START "$(E start-n2)" '{"clockMs":null,"payload":{"kit":{"a":"#C62828","b":"#1565C0"}}}'
  send "$U_TOM_HANDY" "$D_TOM" "$n2"
  check A "Ableitung: bestaetigte Wahl auf der Gastseite (Orange) bleibt beim Anpfiff ohne Angabe, Heim bekommt die Trikotfarbe" "accepted|bib|b|#C62828|$ORANGE" "$(results "$OUT")|$(row "$n2")"
  # A2c ausdruecklich keine Leibchen im Anpfiff (kit.bibSide = JSON null) -> none
  kit "$U_PAUL" "$D_PAUL" "$n6" bib "$(bib a $GELB)" >/dev/null
  ev MATCH_START "$(E start-n6)" '{"clockMs":null,"payload":{"kit":{"a":"#1565C0","b":"#C62828","bibSide":null}}}'
  send "$U_PAUL" "$D_PAUL" "$n6"
  check A "Ableitung: der Anpfiff sendet ausdruecklich keine Leibchen (bibSide null) nach einer Bestaetigung: Zustand none, Seite leer, beide Trikotfarben" "accepted|none|-|#1565C0|#C62828" "$(results "$OUT")|$(row "$n6")"
  # A3 nichts getippt, Anpfiff ohne Leibchen -> bleibt offen (NULL)
  ev MATCH_START "$(E start-3)" '{"clockMs":null,"payload":{"kit":{"a":"#C62828","b":"#FFFFFF"}}}'
  send "$U_TOM_HANDY" "$D_TOM" "$m3"
  check A "@SL-210 Anpfiff ohne Tipp: Zustand bleibt offen (NULL), keine Leibchen, Trikotfarben festgehalten" "accepted|-|-|#C62828|#FFFFFF" "$(results "$OUT")|$(row "$m3")"
  # A4 'Keine Leibchen' getippt, Anpfiff ohne Leibchen -> bleibt none
  kit "$U_OLLI" "$D_OLLI" "$m4" none >/dev/null
  ev MATCH_START "$(E start-4)" '{"clockMs":null,"payload":{"kit":{"a":"#1565C0","b":"#C62828"}}}'
  send "$U_TOM_HANDY" "$D_TOM" "$m4"
  check A "@SL-210 'Keine Leibchen' getippt, Anpfiff ohne Leibchen: bleibt none" "accepted|none|-|#1565C0|#C62828" "$(results "$OUT")|$(row "$m4")"
  # A5 Anpfiff rueckgaengig (RETRACT des Anpfiffs) -> Stand davor
  ev RETRACT "$(E retract-start-2)" "{\"targetId\":\"$(E start-2)\",\"at\":2000}"
  send "$U_TOM_HANDY" "$D_TOM" "$m2"
  check A "@SL-214 Anpfiff rueckgaengig: Spiel wieder angesetzt und die bestaetigte Wahl steht (Stand davor: bib/a/Gelb)" \
    "accepted|scheduled|bib|a|$GELB" "$(results "$OUT")|$(q "SELECT match_status FROM public.matches WHERE id = '$m2';")|$(row "$m2" | cut -d'|' -f1-3)"

  # ============================================================================================================
  # G: Waechter
  # ============================================================================================================
  t="$(tid waechter)"; m2="$(match "$t" 2)"; m3="$(match "$t" 3)"
  check G "G1 Olli (Client-Rolle, Eigentuemer) setzt kit_decision direkt per UPDATE -> HF003" "error:HF003" "$(client "$U_OLLI" "UPDATE public.matches SET kit_decision = 'bib' WHERE id = '$m2'")"
  check G "G1 Maria (Co-Admin) ebenso -> HF003" "error:HF003" "$(client "$U_MARIA" "UPDATE public.matches SET kit_decision = 'none' WHERE id = '$m2'")"
  check G "G1 Gegenbeispiel: bib_side direkt -> weiter HF003" "error:HF003" "$(client "$U_OLLI" "UPDATE public.matches SET bib_side = 'a' WHERE id = '$m2'")"
  check G "G1 Gegenbeispiel: kit_color_a direkt -> weiter HF003" "error:HF003" "$(client "$U_OLLI" "UPDATE public.matches SET kit_color_a = '#FFCC00' WHERE id = '$m2'")"
  check G "G2 derselbe Wert (NULL) und eine andere Spalte -> ok" "ok:1" "$(client "$U_OLLI" "UPDATE public.matches SET kit_decision = NULL, scheduled_start = '15:20' WHERE id = '$m2'")"
  check G "G3 Client-INSERT mit kit_decision: Wert wird zu NULL" "ok:1|-" \
    "$(client "$U_OLLI" "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, kit_decision) VALUES ('$(uuid_for match:g3)', '$(tid waechter)', 9, 1, '$(team "$(tid waechter)" west)', '$(team "$(tid waechter)" mitte)', 'bib')")|$(q "SELECT coalesce(kit_decision, '-') FROM public.matches WHERE id = '$(uuid_for match:g3)';")"
  check G "G4 Server (Tabelleneigentuemer) darf die Spalte setzen" "bib" "$(q "UPDATE public.matches SET kit_decision = 'bib' WHERE id = '$m3'; SELECT kit_decision FROM public.matches WHERE id = '$m3';" | tail -1)"
  q "UPDATE public.matches SET kit_decision = NULL WHERE id = '$m3';" >/dev/null
  check G "C Pruefregel: ungueltiger Wert auch fuer den Server -> 23514" "23514" \
    "$(q "UPDATE public.matches SET kit_decision = 'xyz' WHERE id = '$m3';" | grep -o 'violates check constraint' >/dev/null && echo 23514 || echo kein-fehler)"
  check G "Anwendung: Client-Rollen koennen match_kit_team_color (intern) nicht aufrufen" "error:42501" \
    "$(client "$U_OLLI" "SELECT public.match_kit_team_color('$(team "$t" west)')")"

  # ============================================================================================================
  # Abgeschlossenes Turnier
  # ============================================================================================================
  t="$(tid abgeschlossen)"
  q "BEGIN; SET LOCAL app.lifecycle_write = 'on'; UPDATE public.tournaments SET lifecycle_status = 'finished', finished_at = now() WHERE id = '$t'; COMMIT;" >/dev/null
  check R "Gegenbeispiel: abgeschlossenes Turnier -> 55000 (wie Hallenton), Spiel unveraendert" "error:55000|-|-|-|-" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$(match "$t" 2)" bib "$(bib a $GELB)")")|$(row "$(match "$t" 2)")"
  check R "Gegenbeispiel: abgeschlossenes Turnier, beendetes Spiel -> 55000 vor der Spielabweisung (die Turniersperre steht vor dem Spielzustand)" "error:55000" \
    "$(res "$(kit "$U_OLLI" "$D_OLLI" "$(match "$t" 1)" none)")"
}

# run_assertions -- Rechte-Assertion als ci_schema_reader; neue Namen; Namensliste = db-drift-check.sh.
run_assertions() {
  local priv names_sql names_sh
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  check S "Rechte-Assertion: die zwei Leibchen-Zeilen vorhanden und |t" \
    "leibchen-kit-set-rpc-authenticated-only|t,leibchen-kit-set-shape|t" \
    "$(grep -E '^leibchen-kit-' <<<"$priv" | sort | paste -sd, -)"
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Lehre A-30a: Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
}

# ---------------------------------------------------------------------------------------------------------
summary() {
  local i
  echo
  for i in "${!CATS[@]}"; do echo "Kategorie ${CATS[$i]}: ${OKS[$i]} OK, ${DEVS[$i]} Abweichung(en)"; done
}

if [[ "$MODE" == "gegenprobe" ]]; then
  # Jede Mutation ersetzt GENAU EINE Stelle der Migration (Muster muss genau einmal vorkommen).
  MUTATIONS=(M1 M2 M3 M4 M5 M6 M7 M8 M9 M10 M11 M12 M13 M14 M15 M16 M17 M18 M19 M20 M21 M22 M23 M24)
  if [[ -n "${GEGENPROBE_NUR:-}" ]]; then read -r -a MUTATIONS <<<"$GEGENPROBE_NUR"; fi
  RED_TOTAL=0
  for mut in "${MUTATIONS[@]}"; do
    start_container "$mut"
    setup_before
    MUT_KEY="$mut" python3 -c '
import os, sys
M = {
  # M1 Rechtepruefung weg: jedes Konto darf
  "M1": [("  IF NOT (v_write OR v_lead OR v_sched) THEN\n", "  IF false THEN\n")],
  # M2 laufendes Spiel: Helfer duerfen auch
  "M2": [("    IF NOT v_lead THEN\n      RETURN jsonb_build_object('\''status'\'', '\''rejected'\'', '\''code'\'', '\''LEAD_ONLY'\'');\n", "    IF false THEN\n      RETURN jsonb_build_object('\''status'\'', '\''rejected'\'', '\''code'\'', '\''LEAD_ONLY'\'');\n")],
  # M3 beendetes Spiel nicht gesperrt
  "M3": [("  IF v_match.match_status = '\''finished'\'' THEN\n", "  IF false THEN\n")],
  # M4 Halter-Pruefung weg: jedes Geraet gilt als steuernd
  "M4": [("        IF NOT coalesce(v_fc.holder_user_id = v_uid AND v_fc.holder_device_id = p_device_id, false) THEN\n", "        IF false THEN\n")],
  # M5 Epochen-Vergleich weg
  "M5": [("        ELSIF p_control_epoch IS NOT NULL AND p_control_epoch <> v_fc.epoch THEN\n", "        ELSIF false THEN\n")],
  # M6 Vorab-Festlegung: auch Helfer duerfen ein spaeteres Spiel setzen
  "M6": [("      IF NOT v_sched THEN\n        RETURN jsonb_build_object('\''status'\'', '\''rejected'\'', '\''code'\'', '\''NOT_NEXT_MATCH'\'');\n", "      IF false THEN\n        RETURN jsonb_build_object('\''status'\'', '\''rejected'\'', '\''code'\'', '\''NOT_NEXT_MATCH'\'');\n")],
  # M7 jedes Spiel gilt als naechstes: die Turnierleitung braucht das steuernde Geraet auch fuer die Vorab-Festlegung
  "M7": [("    IF v_next IS DISTINCT FROM p_match_id THEN\n", "    IF false THEN\n")],
  # M8 erwartete Teams werden nicht verglichen
  "M8": [("  IF v_team_a IS NOT NULL AND (v_team_a <> v_match.team_a_id OR v_team_b <> v_match.team_b_id) THEN\n", "  IF false THEN\n")],
  # M9 Zuruecknahme bei Teamwechsel nie
  "M9": [("  IF (NEW.team_a_id IS DISTINCT FROM OLD.team_a_id OR NEW.team_b_id IS DISTINCT FROM OLD.team_b_id)\n", "  IF false AND (NEW.team_a_id IS DISTINCT FROM OLD.team_a_id OR NEW.team_b_id IS DISTINCT FROM OLD.team_b_id)\n")],
  # M10 Waechter schuetzt kit_decision nicht
  "M10": [("       OR NEW.bib_side     IS DISTINCT FROM OLD.bib_side\n       OR NEW.kit_decision IS DISTINCT FROM OLD.kit_decision THEN\n", "       OR NEW.bib_side     IS DISTINCT FROM OLD.bib_side THEN\n")],
  # M11 bestaetigte Wahl bleibt beim Anpfiff ohne Angabe nicht stehen (Anpfiff ueberschreibt Seite und Farben)
  "M11": [("  v_keep := v_old = '\''bib'\'' AND v_bib IS NULL AND NOT v_none;\n", "  v_keep := false;\n")],
  # M12 EXECUTE auch fuer anon
  "M12": [("GRANT EXECUTE ON FUNCTION public.match_kit_set(uuid, text, jsonb, uuid, integer) TO authenticated;\n", "GRANT EXECUTE ON FUNCTION public.match_kit_set(uuid, text, jsonb, uuid, integer) TO authenticated, anon;\n")],
  # M13 laufend: die Seite, die ihr Leibchen verliert, bekommt ihre Teamfarbe nicht zurueck
  "M13": [("                    WHEN v_match.bib_side = '\''a'\'' THEN public.match_kit_team_color(v_match.team_a_id)\n", "                    WHEN v_match.bib_side = '\''a'\'' THEN v_match.kit_color_a\n")],
  # M14 vor dem Anpfiff loescht Keine Leibchen die Farben nicht
  "M14": [("         SET kit_color_a = NULL, kit_color_b = NULL, bib_side = NULL, kit_decision = '\''none'\''\n", "         SET kit_decision = '\''none'\''\n")],
  # M15 zwei Teams werden nicht verlangt
  "M15": [("  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN\n", "  IF false THEN\n")],
  # M16 abgeschlossenes Turnier nicht gesperrt
  "M16": [("  IF public.tournament_is_closed(v_tid) THEN\n", "  IF false THEN\n")],
  # M17 Farbform wird nicht geprueft
  "M17": [("    IF v_side NOT IN ('\''a'\'', '\''b'\'') OR v_color !~ '\''^#[0-9A-F]{6}$'\'' THEN\n", "    IF v_side NOT IN ('\''a'\'', '\''b'\'') THEN\n")],
  # M18 Aendern: die alte Farbspalte bleibt stehen (beide Seiten tragen)
  "M18": [("             kit_color_a  = CASE WHEN v_side = '\''a'\'' THEN v_color END,\n", "             kit_color_a  = coalesce(CASE WHEN v_side = '\''a'\'' THEN v_color END, kit_color_a),\n")],
  # M19 ausgefallenes Spiel nicht gesperrt
  "M19": [("  ELSIF v_match.match_status = '\''skipped'\'' THEN\n", "  ELSIF false THEN\n")],
  # M20 Trigger-Name sortiert vor dem Waechter: der Waechter sieht die Zuruecknahme und lehnt sie als HF003 ab
  "M20": [("DROP TRIGGER IF EXISTS matches_kit_reset_on_team_change ON public.matches;\nCREATE TRIGGER matches_kit_reset_on_team_change\n", "DROP TRIGGER IF EXISTS matches_kit_reset_on_team_change ON public.matches;\nCREATE TRIGGER matches_aa_kit_reset_on_team_change\n")],
  # M21 Zeilensperre weg: gleichzeitige Aufrufe koennen sich mischen
  "M21": [("  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;\n", "  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;\n")],
  # M22 nach dem Anpfiff gilt die Steuerung nicht mehr als Sperre: laufende Spiele nehmen auch Helfer an (zaehlt wie M2 fuer pausiert)
  # M23 ausdrueckliches "keine Leibchen" im Anpfiff wird ignoriert (bestaetigte Wahl bleibt)
  "M23": [("  v_none := v_kit ? '\''bibSide'\'' AND jsonb_typeof(v_kit -> '\''bibSide'\'') = '\''null'\'';\n", "  v_none := false;\n")],
  # M24 beim Behalten gilt die Trikotfarbe des Anpfiffs auch fuer die Leibchen-Seite (Leibchenfarbe geht verloren)
  "M24": [("SET kit_color_a  = CASE WHEN v_keep AND bib_side = '\''a'\'' THEN kit_color_a ELSE v_a END,\n", "SET kit_color_a  = v_a,\n")],
  "M22": [("  ELSIF v_match.match_status IN ('\''running'\'', '\''paused'\'') THEN\n", "  ELSIF v_match.match_status IN ('\''running'\'') THEN\n")],
}
s = sys.stdin.read()
for frm, to in M[os.environ["MUT_KEY"]]:
    if s.count(frm) != 1:
        sys.exit("Gegenprobe: Muster in %s nicht genau einmal (%d): %r" % (os.environ["MUT_KEY"], s.count(frm), frm[:70]))
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
  R_DEV="${DEVS[$(cat_index R)]}"; Z_DEV="${DEVS[$(cat_index Z)]}"; C_DEV="${DEVS[$(cat_index C)]}"; L_DEV="${DEVS[$(cat_index L)]}"
  if [[ "$R_DEV" -gt 0 && "$Z_DEV" -gt 0 && "$C_DEV" -gt 0 && "$L_DEV" -gt 0 ]]; then
    echo "Ohne Migration: R, Z, C und L rot -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (R=$R_DEV, Z=$Z_DEV, C=$C_DEV, L=$L_DEV muessen > 0 sein)."
  exit 1
fi

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
DATA_BEFORE="$(q "SELECT (SELECT count(*) FROM public.match_events) || '|' || (SELECT count(*) FROM public.matches) || '|' || (SELECT count(*) FROM public.teams);")"
echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE"

# --- S: Schema ---------------------------------------------------------------------------------------------
check S "Bestand: Ereignisse, Spiele, Teams unveraendert (keine Datenaenderung)" "$DATA_BEFORE" \
  "$(q "SELECT (SELECT count(*) FROM public.match_events) || '|' || (SELECT count(*) FROM public.matches) || '|' || (SELECT count(*) FROM public.teams);")"
check S "Bestand: kein Spiel hat einen Zustand (alle offen, NULL)" "0" "$(q "SELECT count(*) FROM public.matches WHERE kit_decision IS NOT NULL;")"
check S "Spalte matches.kit_decision: text, nullbar, ohne Vorgabe" "text|YES|" \
  "$(q "SELECT data_type || '|' || is_nullable || '|' || coalesce(column_default, '') FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'kit_decision';")"
check S "Pruefregel matches_kit_decision_valid (NULL, bib, none) validiert" "t" \
  "$(q "SELECT convalidated FROM pg_constraint WHERE conname = 'matches_kit_decision_valid' AND conrelid = 'public.matches'::regclass;")"
check S "match_kit_set: SECURITY DEFINER, fester search_path; Hilfsbaustein nicht" "match_kit_set:true:{\"search_path=public, pg_temp\"}|match_kit_team_color:false:{\"search_path=public, pg_temp\"}" \
  "$(q "SELECT string_agg(p.proname || ':' || p.prosecdef || ':' || p.proconfig::text, '|' ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('match_kit_set', 'match_kit_team_color');")"
check S "match_kit_set: EXECUTE authenticated ja, anon nein, service_role nein, PUBLIC nein" "true|false|false|false" \
  "$(q "SELECT has_function_privilege('authenticated', 'public.match_kit_set(uuid,text,jsonb,uuid,integer)', 'EXECUTE') || '|' || has_function_privilege('anon', 'public.match_kit_set(uuid,text,jsonb,uuid,integer)', 'EXECUTE') || '|' || has_function_privilege('service_role', 'public.match_kit_set(uuid,text,jsonb,uuid,integer)', 'EXECUTE') || '|' || EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = 'public.match_kit_set(uuid,text,jsonb,uuid,integer)'::regprocedure AND a.grantee = 0);")"
check S "Hilfsbaustein match_kit_team_color: kein EXECUTE fuer Client-Rollen" "false|false|false" \
  "$(q "SELECT has_function_privilege('authenticated', 'public.match_kit_team_color(uuid)', 'EXECUTE') || '|' || has_function_privilege('anon', 'public.match_kit_team_color(uuid)', 'EXECUTE') || '|' || has_function_privilege('service_role', 'public.match_kit_team_color(uuid)', 'EXECUTE');")"
check S "Trigger matches_kit_reset_on_team_change: BEFORE UPDATE OF team_a_id, team_b_id, aktiv, und er sortiert nach dem Waechter" "true|true" \
  "$(q "SELECT (t.tgenabled = 'O' AND t.tgtype & 2 = 2 AND t.tgtype & 16 = 16 AND pg_get_triggerdef(t.oid) LIKE '%UPDATE OF team_a_id, team_b_id%') || '|' || ('matches_guard_kit_columns' < t.tgname) FROM pg_trigger t WHERE t.tgrelid = 'public.matches'::regclass AND t.tgname = 'matches_kit_reset_on_team_change';")"
check S "Monitor-Signal: der Anweisungs-Trigger auf matches (UPDATE) ist aktiv -- die Wahl erreicht Monitor und Zuschauer ueber den vorhandenen Weg" "O" \
  "$(q "SELECT tgenabled FROM pg_trigger WHERE tgrelid = 'public.matches'::regclass AND tgname = 'matches_signal_display_update';")"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in tables columns functions triggers policies indexes rls_tables; do
  case "$dim" in columns) expected=1 ;; functions) expected=3 ;; triggers) expected=1 ;; *) expected=0 ;; esac
  check S "Katalogzaehlung $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done

run_probes
run_assertions

# --- W: idempotent -----------------------------------------------------------------------------------------
STATE_BEFORE_W="$(q "SELECT md5(string_agg(m::text, ',' ORDER BY m.id)) FROM public.matches m;")"
set +e
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
W_EXIT=$?
set -e
check W "zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check W "danach Spiele unveraendert, Schema wie nach dem ersten Einspielen" "gleich|identisch" \
  "$([[ "$(q "SELECT md5(string_agg(m::text, ',' ORDER BY m.id)) FROM public.matches m;")" == "$STATE_BEFORE_W" ]] && echo gleich || echo verschieden)|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg -------------------------------------------------------------------------------------------
psql_stdin < "$ROLLBACK_FILE"
DUMP_ROLLED_BACK="$(schema_dump)"
check X "nach dem Rueckweg: Schema public = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi
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
