#!/usr/bin/env bash
#
# verschieben-server-check.sh — Container-Beweis fuer supabase/migrations/20261118_001_verschieben_server.sql (R8, Befund
# C-VERSCHIEBEN-NUR-CLIENT: der Server prueft das Verschieben von Spielzeiten). Muster: scripts/spiel-beenden-check.sh
# (Wegwerf-Container, Baseline + Migrationen seit Baseline in Dateireihenfolge, Aufraeumen per trap, --without-migration,
# --gegenprobe, --print-rueckweg).
#
# Testwerte aus dem Record 2026-10-02_zeitplan-rueckt-nach: Turnierleitung Olli (Eigentuemer), Co-Admin Maria, Helfer Tom
# (Handy, Geraetesitzung), Helfer Hans (Konto, Rolle collaborator), Trainer Rot. Turnier "Hallencup Ost" heute (Datum in
# Europe/Berlin), "Hallencup Morgen" morgen, "Hallencup Gestern" gestern. Alle Schreibversuche laufen als echte
# Client-Rolle (SET LOCAL role authenticated/anon + request.jwt.claims wie PostgREST); Anpfiffe ueber append_match_events.
#
# Kategorien:
#   F  Fail-fast: ohne matches.original_start bricht die Migration mit "Voraussetzungen fehlen" ab, Schema unveraendert.
#   S  Schema: Trigger BEFORE UPDATE OF scheduled_start, original_start (ROW) aktiv, Funktion SECURITY INVOKER mit festem
#      search_path und ohne EXECUTE fuer Client-Rollen, Aenderungszaehlung zaehlt original_start; Katalog +1 Funktion,
#      +1 Trigger; md5 nach dem Einspielen.
#   K  Kern (@ZP-016, @ZP-062): geplantes Spiel verschieben ok; laufend/unterbrochen/beendet -> HF005; Voll-Speichern mit
#      unveraenderten Zeitplan-Spalten (auch laufende/beendete Spiele) ok; ausgefallenes Spiel nicht gesperrt;
#      veraltetes Geraet (laufendes Spiel mit neuer Uhrzeit) -> nur diese Zeile HF005.
#   V  Vergangenheit (@ZP-057): Vorziehen am Turniertag vor die laufende Minute -> HF005; in die Zukunft ok; Grenze
#      laufende Minute ok, eine Minute davor HF005; nach hinten schieben eines ueberfaelligen Spiels ok; morgen und
#      gestern (Nacharbeit) ohne Pruefung.
#   R  Rechte (@ZP-041, @ZP-084): Helfer (Geraet und Konto), Trainer, anon -> nichts geaendert; mit einer Probe-Policy, die
#      Helfern UPDATE gaebe, lehnt der Trigger mit 42501 ab (unveraenderte Uhrzeit geht durch); Co-Admin und Eigentuemer
#      ok; Server-Rolle (postgres) frei.
#   A  Anpfiff (@ZP-008, @ZP-009): frueher Anpfiff durch Helfer Tom und Turnierleitung Olli angenommen, scheduled_start
#      und original_start bleiben; keine Server-Funktion schreibt scheduled_start.
#   B  Aenderungszaehlung (@TM-027): nur original_start geaendert -> change_revision +1; Voll-Speichern ohne Aenderung +0.
#   P  Rechte-Assertion scripts/db_privilege_assertions.sql als ci_schema_reader: alle Zeilen |t, die drei neuen vorhanden.
#   W  zweites Einspielen (idempotent): Exit 0, md5 und Schema unveraendert.
#   X  Rueckweg (--print-rueckweg, Anhang B der Freigabe): Schema (public) und md5 = vorher; erneut einspielbar (= nachher).
#
# Aufrufoptionen:
#   bash scripts/verschieben-server-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/verschieben-server-check.sh --without-migration  Gegenprobe: ohne die Migration muessen K, V, R, B rot sein
#   bash scripts/verschieben-server-check.sh --gegenprobe         je Lauf eine Mutation der Migration (M1-M9); Exit 0 NUR,
#                                                                 wenn JEDE Mutation mindestens eine Pruefung rot faerbt
#   bash scripts/verschieben-server-check.sh --print-rueckweg     gibt den Rueckweg aus, ohne Container
#
# Umgebung: POSTGRES_IMAGE (Vorgabe ghcr.io/supabase/postgres:17.6.1.167, nativ arm64/amd64 wie Produktion PG 17.6),
#   DOCKER_PLATFORM (leer = Plattform des Rechners), MIGRATIONS_DIR_OVERRIDE (anderer Migrationsordner, z. B. mit einer
#   live schon eingespielten Datei, die noch nicht auf main ist).
# V5/V6 (Grenze laufende Minute) und V2 werden zwischen 23:56 und 00:02 Uhr (Europe/Berlin) sichtbar uebersprungen.
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container, wird am
# Ende entfernt (trap). Harness-Hilfen liegen im Schema "harness".
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

POSTGRES_IMAGE="${POSTGRES_IMAGE:-ghcr.io/supabase/postgres:17.6.1.167}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR_OVERRIDE:-$REPO_ROOT/supabase/migrations}"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261118_001_verschieben_server.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
CONTAINER_NAME="verschieben-server-check-$$"
WORKDIR="$(mktemp -d)"

# Rueckweg (Anhang B der Freigabe-Unterlage): Trigger und Funktion weg, matches_bump_change_revision woertlich wie 20261028_005.
rueckweg_sql() {
  cat <<'SQL'
-- Rueckweg zu supabase/migrations/20261118_001_verschieben_server.sql (R8). EIN Block.
-- Erzeugt mit `bash scripts/verschieben-server-check.sh --print-rueckweg`. Danach gilt wieder nur die Pruefung der App.
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP TRIGGER IF EXISTS matches_guard_schedule_times ON public.matches;
DROP FUNCTION IF EXISTS public.matches_guard_schedule_times();

-- matches_bump_change_revision woertlich wie 20261028_005 (ohne original_start)
DROP TRIGGER IF EXISTS matches_bump_change_revision ON public.matches;
CREATE TRIGGER matches_bump_change_revision
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  WHEN (OLD.team_a_id IS DISTINCT FROM NEW.team_a_id
     OR OLD.team_b_id IS DISTINCT FROM NEW.team_b_id
     OR OLD.slot_a_source IS DISTINCT FROM NEW.slot_a_source
     OR OLD.slot_b_source IS DISTINCT FROM NEW.slot_b_source
     OR OLD.round IS DISTINCT FROM NEW.round
     OR OLD.field IS DISTINCT FROM NEW.field
     OR OLD.slot IS DISTINCT FROM NEW.slot
     OR OLD.group_letter IS DISTINCT FROM NEW.group_letter
     OR OLD.is_final IS DISTINCT FROM NEW.is_final
     OR OLD.final_type IS DISTINCT FROM NEW.final_type
     OR OLD.label IS DISTINCT FROM NEW.label
     OR OLD.scheduled_start IS DISTINCT FROM NEW.scheduled_start
     OR OLD.match_number IS DISTINCT FROM NEW.match_number
     OR OLD.phase IS DISTINCT FROM NEW.phase
     OR OLD.referee_number IS DISTINCT FROM NEW.referee_number)
  EXECUTE FUNCTION public.matches_bump_change_revision();

COMMIT;
SQL
}

if [[ "$MODE" == "print-rueckweg" ]]; then
  rueckweg_sql
  exit 0
fi

[[ -f "$TARGET_FILE" ]] || { echo "::error::$TARGET_NAME fehlt in $MIGRATIONS_DIR." >&2; exit 1; }

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

cleanup() { docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true; rm -rf "$WORKDIR"; }
trap cleanup EXIT

start_container() {
  docker run -d ${DOCKER_PLATFORM:+--platform "$DOCKER_PLATFORM"} --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 120); do
    if [[ "$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "::error::Container wurde nach 120s nicht bereit." >&2
    docker logs "$CONTAINER_NAME" 2>&1 | tail -30 >&2
    exit 1
  fi
  for _ in $(seq 1 30); do
    docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
}

psql_stdin() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 -q
}
psql_value() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA
}
q() { psql_value <<<"$1" 2>&1 || true; }
schema_dump() { docker exec "$CONTAINER_NAME" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }
# md5 der Trigger auf matches (Name|md5 Funktion|md5 Definition) und der neuen Funktion -- Vergleich vorher/nachher/live.
md5_state() {
  q "SELECT string_agg(t.tgname || '|' || md5(p.prosrc) || '|' || md5(pg_get_triggerdef(t.oid)), E'\n' ORDER BY t.tgname)
       FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE t.tgrelid = 'public.matches'::regclass AND NOT t.tgisinternal;"
}

CATS=(F S K V R A B P W X)
DEVS=(0 0 0 0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0 0 0 0)
cat_index() { local i; for i in "${!CATS[@]}"; do [[ "${CATS[$i]}" == "$1" ]] && { echo "$i"; return; }; done; echo "::error::Kategorie $1" >&2; exit 2; }
check() { # check <Kategorie> <Name> <erwartet> <erhalten>
  local i
  i="$(cat_index "$1")"
  if [[ "$3" == "$4" ]]; then
    OKS[i]=$((OKS[i] + 1)); echo "OK          [$1] $2"
  else
    DEVS[i]=$((DEVS[i] + 1)); echo "ABWEICHUNG  [$1] $2"; echo "    erwartet: $3"; echo "    erhalten: $4"
  fi
}
skip() { echo "UEBERSPRUNGEN [$1] $2"; }
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
reset_counts() { DEVS=(0 0 0 0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0 0 0 0); }
summary() {
  local i line=""
  for i in "${!CATS[@]}"; do line="$line ${CATS[$i]} ${OKS[$i]}/$((OKS[i] + DEVS[i]))"; done
  echo "Zusammenfassung (OK/gesamt):$line -- Abweichungen: $(total_dev)"
}

uuid_for() {
  local h
  h="$(printf '%s' "verschieben-server-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_TOM="$(uuid_for user:tom-handy)"
U_HANS="$(uuid_for user:hans)"; U_TRAINER="$(uuid_for user:trainer)"
D_OLLI="$(uuid_for device:olli-tablet)"; D_TOM="$(uuid_for device:tom-handy)"

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
-- Beliebige SQL als Client-Rolle; 'ok:<Zeilen>' oder 'error:<SQLSTATE>'.
CREATE FUNCTION harness.exec(p_user uuid, p_anon boolean, p_role text, p_sql text) RETURNS text LANGUAGE plpgsql AS $fn$
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
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA harness TO anon, authenticated, service_role;
SQL
}

setup_users() {
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@r8.test'), ('$U_MARIA'::uuid, 'maria@r8.test'), ('$U_HANS'::uuid, 'hans@r8.test'),
             ('$U_TRAINER'::uuid, 'trainer@r8.test'), ('$U_TOM'::uuid, NULL)) AS u(id, email);
SQL
}

# Daten je Lauf (eigene Kennungen je Bezeichnung, damit Gegenprobe-Laeufe auf frischen Zeilen messen).
RUN=""
T_HEUTE=""; T_MORGEN=""; T_GESTERN=""
m() { uuid_for "$RUN:match:$1"; }
setup_data() {
  RUN="$1"
  T_HEUTE="$(uuid_for "$RUN:tournament:heute")"; T_MORGEN="$(uuid_for "$RUN:tournament:morgen")"
  T_GESTERN="$(uuid_for "$RUN:tournament:gestern")"
  local ta tb tc td te tf
  ta="$(uuid_for "$RUN:team:fc-nord")"; tb="$(uuid_for "$RUN:team:sv-sued")"
  tc="$(uuid_for "$RUN:team:morgen-a")"; td="$(uuid_for "$RUN:team:morgen-b")"
  te="$(uuid_for "$RUN:team:gestern-a")"; tf="$(uuid_for "$RUN:team:gestern-b")"
  psql_stdin <<SQL
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config, finals_config)
VALUES ('$T_HEUTE', '$U_OLLI', 'Hallencup Ost', (now() AT TIME ZONE 'Europe/Berlin')::date, 2, 10, '{}'::jsonb, '{}'::jsonb),
       ('$T_MORGEN', '$U_OLLI', 'Hallencup Morgen', (now() AT TIME ZONE 'Europe/Berlin')::date + 1, 2, 10, '{}'::jsonb, '{}'::jsonb),
       ('$T_GESTERN', '$U_OLLI', 'Hallencup Gestern', (now() AT TIME ZONE 'Europe/Berlin')::date - 1, 2, 10, '{}'::jsonb, '{}'::jsonb);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label)
SELECT t.id, c.uid, c.role, now(), c.label
FROM (VALUES ('$T_HEUTE'::uuid), ('$T_MORGEN'::uuid), ('$T_GESTERN'::uuid)) AS t(id)
CROSS JOIN (VALUES ('$U_MARIA'::uuid, 'co-admin', 'Maria'), ('$U_TOM'::uuid, 'helper', 'Tom'),
                   ('$U_HANS'::uuid, 'collaborator', 'Hans'), ('$U_TRAINER'::uuid, 'trainer', 'Trainer Rot')) AS c(uid, role, label);
INSERT INTO public.teams (id, tournament_id, name) VALUES ('$ta', '$T_HEUTE', 'FC Nord'), ('$tb', '$T_HEUTE', 'SV Süd'),
  ('$tc', '$T_MORGEN', 'FC Nord'), ('$td', '$T_MORGEN', 'SV Süd'), ('$te', '$T_GESTERN', 'FC Nord'), ('$tf', '$T_GESTERN', 'SV Süd');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start, group_letter) VALUES
  ('$(m plan)',    '$T_HEUTE', 1, 1, '$ta', '$tb', 13, '23:50', 'A'),
  ('$(m lauf)',    '$T_HEUTE', 1, 2, '$ta', '$tb', 11, '23:40', 'A'),
  ('$(m lauf2)',   '$T_HEUTE', 1, 3, '$ta', '$tb', 12, '23:41', 'A'),
  ('$(m pause)',   '$T_HEUTE', 1, 4, '$ta', '$tb', 14, '23:30', 'A'),
  ('$(m ende)',    '$T_HEUTE', 1, 5, '$ta', '$tb', 9,  '23:20', 'A'),
  ('$(m aus)',     '$T_HEUTE', 1, 6, '$ta', '$tb', 15, '23:10', 'A'),
  ('$(m verg)',    '$T_HEUTE', 2, 1, '$ta', '$tb', 16, '23:59', 'A'),
  ('$(m zukunft)', '$T_HEUTE', 2, 2, '$ta', '$tb', 17, '23:59', 'A'),
  ('$(m ueber)',   '$T_HEUTE', 2, 3, '$ta', '$tb', 18, '00:00', 'A'),
  ('$(m grenze)',  '$T_HEUTE', 2, 4, '$ta', '$tb', 19, '23:59', 'A'),
  ('$(m grenze2)', '$T_HEUTE', 2, 5, '$ta', '$tb', 20, '23:59', 'A'),
  ('$(m ohne)',    '$T_HEUTE', 2, 6, '$ta', '$tb', 21, NULL,    'A'),
  ('$(m helfer)',  '$T_HEUTE', 3, 1, '$ta', '$tb', 22, '23:45', 'A');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start, group_letter) VALUES
  ('$(m morgen)',  '$T_MORGEN', 1, 1, '$tc', '$td', 1, '10:00', 'A'),
  ('$(m gestern)', '$T_GESTERN', 1, 1, '$te', '$tf', 1, '10:00', 'A');
UPDATE public.matches SET score_a = NULL, score_b = NULL WHERE tournament_id IN ('$T_HEUTE', '$T_MORGEN', '$T_GESTERN');
-- Server-Stand (wie append_match_events ihn schreibt): unterbrochen, beendet, ausgefallen.
UPDATE public.matches SET match_status = 'paused', actual_start = now() - interval '20 minutes' WHERE id = '$(m pause)';
UPDATE public.matches SET match_status = 'finished', score_a = 2, score_b = 1, actual_start = now() - interval '40 minutes',
                          actual_end = now() - interval '25 minutes' WHERE id = '$(m ende)';
UPDATE public.matches SET match_status = 'skipped', skipped_at = now() WHERE id = '$(m aus)';
SQL
}

as_user() { q "SELECT harness.exec('$1'::uuid, $2, 'authenticated', \$S\$$3\$S\$);"; } # as_user <uid> <anon true|false> <sql>
as_anon() { q "SELECT harness.exec(NULL, true, 'anon', \$S\$$1\$S\$);"; }
maria() { as_user "$U_MARIA" false "$1"; }
start_of() { q "SELECT coalesce(scheduled_start::text, 'NULL') FROM public.matches WHERE id = '$1';"; }
orig_of() { q "SELECT coalesce(original_start::text, 'NULL') FROM public.matches WHERE id = '$1';"; }
status_of() { q "SELECT match_status FROM public.matches WHERE id = '$1';"; }
rev_of() { q "SELECT change_revision FROM public.tournaments WHERE id = '$1';"; }
set_start() { echo "UPDATE public.matches SET scheduled_start = '$2' WHERE id = '$1'"; }
# Voll-Speichern der App fuer EIN bestehendes Spiel (mapMatchToScheduleUpdate: alle Zeitplan-Spalten, Uhrzeit als Text).
full_save_row() { # full_save_row <Spiel> <scheduled_start-Text|NULL> <original_start-Text|NULL>
  local s o
  s="$([[ "$2" == "NULL" ]] && echo NULL || echo "'$2'")"; o="$([[ "$3" == "NULL" ]] && echo NULL || echo "'$3'")"
  echo "UPDATE public.matches SET team_a_id = team_a_id, slot_a_source = slot_a_source, team_b_id = team_b_id,
          slot_b_source = slot_b_source, team_a_placeholder = team_a_placeholder, team_b_placeholder = team_b_placeholder,
          round = round, field = field, slot = slot, group_letter = group_letter, is_final = is_final,
          final_type = final_type, label = label, scheduled_start = $s, original_start = $o,
          match_number = match_number, phase = phase, referee_number = referee_number, updated_at = now()
        WHERE id = '$1' AND tournament_id = '$T_HEUTE'"
}
EVS=""
ev() { EVS="$(jq -cn --arg type "$1" --arg id "$2" '[{id: $id, type: $type, at: 1000, section: 1, clockMs: null, teamId: null, targetId: null, payload: {}}]')"; }
send() { q "SELECT harness.call('$1'::uuid, $2, '$3'::uuid, \$J\$$EVS\$J\$::jsonb, '$4'::uuid);"; } # send <uid> <anon> <Spiel> <Geraet>
results() { jq -r '[.results[]? | .status + (if .code then ":" + .code else "" end)] | join(",") | if . == "" then "keine" else . end' <<<"$1" 2>/dev/null || echo "keine-json:$1"; }
berlin_hhmm() { q "SELECT to_char(now() AT TIME ZONE 'Europe/Berlin', 'HH24:MI');"; }

run_probes() {
  setup_data "$1"
  local out r0 r1 now_hm in_window

  # --- A: frueher Anpfiff (@ZP-008, @ZP-009) -- vor allen Verschiebe-Proben, damit Spiel 11 wirklich laeuft ---------
  ev MATCH_START "$(uuid_for "$RUN:event:lauf-start")"
  out="$(send "$U_TOM" true "$(m lauf)" "$D_TOM")"
  check A "@ZP-008 Helfer Tom pfeift Spiel 11 (geplant 23:40) frueher an: angenommen, laeuft" "accepted|running" \
    "$(results "$out")|$(status_of "$(m lauf)")"
  check A "@ZP-009 nach dem fruehen Anpfiff bleiben scheduled_start und original_start" "23:40:00|NULL" \
    "$(start_of "$(m lauf)")|$(orig_of "$(m lauf)")"
  ev MATCH_START "$(uuid_for "$RUN:event:lauf2-start")"
  out="$(send "$U_OLLI" false "$(m lauf2)" "$D_OLLI")"
  check A "@ZP-008 Turnierleitung Olli pfeift Spiel 12 frueher an: angenommen, Uhrzeit bleibt 23:41" "accepted|running|23:41:00" \
    "$(results "$out")|$(status_of "$(m lauf2)")|$(start_of "$(m lauf2)")"
  check A "keine Server-Funktion (public, match_engine) weist scheduled_start oder original_start zu" "" \
    "$(q "SELECT coalesce(string_agg(n.nspname || '.' || p.proname, ',' ORDER BY 1), '') FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname IN ('public', 'match_engine') AND p.prosrc ~ '(scheduled_start|original_start)\s*:?=';")"

  # --- K: Kern (@ZP-016, @ZP-062) ---------------------------------------------------------------------------------
  r0="$(rev_of "$T_HEUTE")"
  check K "@ZP-016 Co-Admin Maria verschiebt das geplante Spiel 13 von 23:50 auf 23:55: ok" "ok:1|23:55:00" \
    "$(maria "$(set_start "$(m plan)" '23:55')")|$(start_of "$(m plan)")"
  check K "@TM-027 das Verschieben zaehlt change_revision +1" "1" "$(( $(rev_of "$T_HEUTE") - r0 ))"
  check K "@ZP-016 laufendes Spiel 11 (frueh angepfiffen) bekommt keine neue Uhrzeit: HF005, bleibt 23:40" "error:HF005|23:40:00" \
    "$(maria "$(set_start "$(m lauf)" '23:50')")|$(start_of "$(m lauf)")"
  check K "@ZP-062 unterbrochenes Spiel 14 (paused) bekommt keine neue Uhrzeit: HF005, bleibt 23:30" "error:HF005|23:30:00" \
    "$(maria "$(set_start "$(m pause)" '23:40')")|$(start_of "$(m pause)")"
  check K "@ZP-016 beendetes Spiel 9 bekommt keine neue Uhrzeit (auch nicht frueher): HF005, bleibt 23:20" "error:HF005|error:HF005|23:20:00" \
    "$(maria "$(set_start "$(m ende)" '23:30')")|$(maria "$(set_start "$(m ende)" '23:10')")|$(start_of "$(m ende)")"
  check K "@ZP-016 auch die Turnierleitung Olli verschiebt das laufende Spiel 11 nicht: HF005" "error:HF005" \
    "$(as_user "$U_OLLI" false "$(set_start "$(m lauf)" '23:45')")"
  check K "@ZP-016 ein Zuruecksetzen der Uhrzeit des laufenden Spiels auf NULL: HF005" "error:HF005|23:40:00" \
    "$(maria "UPDATE public.matches SET scheduled_start = NULL WHERE id = '$(m lauf)'")|$(start_of "$(m lauf)")"
  check K "@ZP-062 ausgefallenes Spiel 15 ist nicht gesperrt (die App verschiebt es nicht mit): ok" "ok:1|23:15:00" \
    "$(maria "$(set_start "$(m aus)" '23:15')")|$(start_of "$(m aus)")"
  check K "Spiel ohne Uhrzeit bekommt eine (NULL -> 12:00): ok" "ok:1|12:00:00" \
    "$(maria "$(set_start "$(m ohne)" '12:00')")|$(start_of "$(m ohne)")"

  # Voll-Speichern (Ort geaendert): jede Zeile einzeln mit unveraenderten Zeitplan-Spalten, wie SupabaseRepository.save()
  r0="$(rev_of "$T_HEUTE")"
  local all_ok="" id
  for id in plan lauf lauf2 pause ende aus verg zukunft ueber grenze grenze2 ohne helfer; do
    all_ok="$all_ok$(maria "$(full_save_row "$(m $id)" "$(start_of "$(m $id)")" "$(orig_of "$(m $id)")")")"
  done
  check K "Voll-Speichern aller 13 Spiele mit unveraenderten Uhrzeiten (auch laufend, unterbrochen, beendet): jede Zeile ok" \
    "$(printf 'ok:1%.0s' $(seq 1 13))" "$all_ok"
  check K "@TM-027 Voll-Speichern ohne Aenderung zaehlt nichts (change_revision +0)" "0" "$(( $(rev_of "$T_HEUTE") - r0 ))"
  check K "Voll-Speichern des laufenden Spiels mit Uhrzeit als 'HH:MM' (gleicher Wert): ok" "ok:1" \
    "$(maria "$(full_save_row "$(m lauf)" '23:40' 'NULL')")"
  check K "veraltetes Geraet: Voll-Speichern mit neuer Uhrzeit fuer das laufende Spiel 11 -> nur diese Zeile HF005, Spiel 13 ok" \
    "error:HF005|ok:1|23:40:00|23:58:00" \
    "$(maria "$(full_save_row "$(m lauf)" '23:50' 'NULL')")|$(maria "$(full_save_row "$(m plan)" '23:58' 'NULL')")|$(start_of "$(m lauf)")|$(start_of "$(m plan)")"

  # --- B: Aenderungszaehlung um original_start (@TM-027) -------------------------------------------------------------
  r0="$(rev_of "$T_HEUTE")"
  check B "nur original_start des laufenden Spiels 11 gesetzt (Uhrzeit gleich): ok, nicht gesperrt" "ok:1|23:40:00" \
    "$(maria "UPDATE public.matches SET original_start = '23:40' WHERE id = '$(m lauf)'")|$(orig_of "$(m lauf)")"
  check B "@TM-027 eine Aenderung nur an original_start zaehlt change_revision +1" "1" "$(( $(rev_of "$T_HEUTE") - r0 ))"

  # --- V: Vergangenheit (@ZP-057) ------------------------------------------------------------------------------------
  now_hm="$(berlin_hhmm)"
  in_window=1; [[ "$now_hm" < "00:02" || "$now_hm" > "23:56" ]] && in_window=0
  if [[ "$now_hm" > "00:00" ]]; then
    check V "@ZP-057 Spiel 16 von 23:59 auf 00:00 heute vorziehen (Vergangenheit): HF005, bleibt 23:59" "error:HF005|23:59:00" \
      "$(maria "$(set_start "$(m verg)" '00:00')")|$(start_of "$(m verg)")"
    check V "@ZP-057 auch die Turnierleitung Olli zieht nicht in die Vergangenheit vor: HF005" "error:HF005" \
      "$(as_user "$U_OLLI" false "$(set_start "$(m verg)" '00:00')")"
  else
    skip V "@ZP-057 Vergangenheit (genau 00:00 Uhr in Berlin)"
  fi
  if [[ "$in_window" -eq 1 ]]; then
    check V "Spiel 17 von 23:59 auf 23:58 heute vorziehen (Zukunft): ok" "ok:1|23:58:00" \
      "$(maria "$(set_start "$(m zukunft)" '23:58')")|$(start_of "$(m zukunft)")"
    check V "Grenze: Spiel 19 auf die laufende Minute $now_hm vorziehen: ok" "ok:1" \
      "$(maria "$(set_start "$(m grenze)" "$now_hm")")"
    local before_hm
    before_hm="$(q "SELECT to_char((now() AT TIME ZONE 'Europe/Berlin') - interval '1 minute', 'HH24:MI');")"
    check V "Grenze: Spiel 20 auf eine Minute vor jetzt ($before_hm) vorziehen: HF005" "error:HF005|23:59:00" \
      "$(maria "$(set_start "$(m grenze2)" "$before_hm")")|$(start_of "$(m grenze2)")"
  else
    skip V "Zukunft und Grenze laufende Minute (Berlin $now_hm, Fenster 00:02-23:56)"
  fi
  check V "ueberfaelliges Spiel 18 (00:00) nach hinten auf 00:05 schieben: ok (nur Vorziehen wird geprueft)" "ok:1|00:05:00" \
    "$(maria "$(set_start "$(m ueber)" '00:05')")|$(start_of "$(m ueber)")"
  check V "morgen: Spiel von 10:00 auf 09:00 vorziehen: ok" "ok:1|09:00:00" \
    "$(maria "$(set_start "$(m morgen)" '09:00')")|$(start_of "$(m morgen)")"
  check V "gestern (Nacharbeit): Spiel von 10:00 auf 09:00 vorziehen: ok (keine Pruefung ausserhalb des Turniertags)" "ok:1|09:00:00" \
    "$(maria "$(set_start "$(m gestern)" '09:00')")|$(start_of "$(m gestern)")"

  # --- R: Rechte (@ZP-041, @ZP-084) --------------------------------------------------------------------------------
  check R "@ZP-041 Helfer Tom (Geraet) verschiebt Spiel 22 direkt an der Schnittstelle: nichts geaendert" "ok:0|23:45:00" \
    "$(as_user "$U_TOM" true "$(set_start "$(m helfer)" '23:55')")|$(start_of "$(m helfer)")"
  check R "@ZP-084 Helfer Hans (Konto) setzt original_start: nichts geaendert" "ok:0|NULL" \
    "$(as_user "$U_HANS" false "UPDATE public.matches SET original_start = '23:30' WHERE id = '$(m helfer)'")|$(orig_of "$(m helfer)")"
  check R "@ZP-084 Trainer: nichts geaendert" "ok:0|23:45:00" \
    "$(as_user "$U_TRAINER" false "$(set_start "$(m helfer)" '23:55')")|$(start_of "$(m helfer)")"
  out="$(as_anon "$(set_start "$(m helfer)" '23:55')")"
  check R "@ZP-084 ohne Sitzung (anon): abgelehnt oder 0 Zeilen, nichts geaendert" "abgelehnt|23:45:00" \
    "$([[ "$out" == "ok:0" || "$out" == "error:42501" ]] && echo abgelehnt || echo "$out")|$(start_of "$(m helfer)")"
  # Probe-Policy: gaebe eine spaetere Policy Helfern UPDATE, haelt der Trigger die Uhrzeiten trotzdem fest.
  q "CREATE POLICY r8_probe_helper_update ON public.matches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);" >/dev/null
  check R "mit Probe-Policy: Helfer Hans verschiebt Spiel 22 -> 42501 vom Trigger, bleibt 23:45" "error:42501|23:45:00" \
    "$(as_user "$U_HANS" false "$(set_start "$(m helfer)" '23:55')")|$(start_of "$(m helfer)")"
  check R "mit Probe-Policy: Helfer Tom (Geraet) setzt original_start -> 42501" "error:42501" \
    "$(as_user "$U_TOM" true "UPDATE public.matches SET original_start = '23:30' WHERE id = '$(m helfer)'")"
  check R "mit Probe-Policy: Helfer Hans speichert Spiel 22 mit unveraenderter Uhrzeit (Voll-Speichern): ok" "ok:1" \
    "$(as_user "$U_HANS" false "$(full_save_row "$(m helfer)" '23:45:00' 'NULL')")"
  q "DROP POLICY r8_probe_helper_update ON public.matches;" >/dev/null
  check R "Eigentuemer Olli verschiebt Spiel 22 auf 23:46: ok" "ok:1|23:46:00" \
    "$(as_user "$U_OLLI" false "$(set_start "$(m helfer)" '23:46')")|$(start_of "$(m helfer)")"
  q "UPDATE public.matches SET scheduled_start = '23:42' WHERE id = '$(m lauf)';" >/dev/null
  check R "Server-Rolle (postgres, z. B. Betrieb) aendert die Uhrzeit des laufenden Spiels: frei" "23:42:00" "$(start_of "$(m lauf)")"
}

apply_target() { psql_stdin < "${1:-$TARGET_FILE}"; }

if [[ "$MODE" == "without-migration" ]]; then
  start_container
  echo "Baseline + ${#BEFORE[@]} Migration(en) einspielen, OHNE $TARGET_NAME..." >&2
  psql_stdin < "$BASELINE_FILE"
  for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done
  setup_helpers; setup_users
  run_probes ohne
  summary
  red=0
  for c in K V R B; do [[ "${DEVS[$(cat_index "$c")]}" -gt 0 ]] || red=1; done
  if [[ "$red" -eq 0 ]]; then
    echo "Ohne Migration: K, V, R und B rot -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (K, V, R, B muessen je mindestens eine Abweichung haben)."
  exit 1
fi

if [[ "$MODE" == "gegenprobe" ]]; then
  start_container
  psql_stdin < "$BASELINE_FILE"
  for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done
  setup_helpers; setup_users
  MUTATIONS=(
    "M1|Sperre fuer angepfiffene Spiele entfernt|IF OLD.match_status IN ('running', 'paused', 'finished') THEN|IF false THEN"
    "M2|paused (unterbrochen) nicht gesperrt|IN ('running', 'paused', 'finished')|IN ('running', 'finished')"
    "M3|Vergangenheitspruefung entfernt|IF v_new_at < date_trunc('minute', now()) THEN|IF false THEN"
    "M4|Rechtepruefung entfernt|IF NOT public.has_tournament_permission(OLD.tournament_id, 'manageSchedule') THEN|IF false THEN"
    "M5|Vergangenheit an jedem Tag statt nur am Turniertag|IF v_day = (now() AT TIME ZONE 'Europe/Berlin')::date THEN|IF true THEN"
    "M6|Aenderungszaehlung ohne original_start|     OR OLD.original_start IS DISTINCT FROM NEW.original_start\n|"
    "M7|Server-Rollen nicht mehr ausgenommen|IF current_user NOT IN ('authenticated', 'anon') THEN|IF false THEN"
    "M8|unveraenderte Uhrzeiten nicht mehr vorab durchgelassen|IF NEW.scheduled_start IS NOT DISTINCT FROM OLD.scheduled_start\n     AND NEW.original_start IS NOT DISTINCT FROM OLD.original_start THEN|IF false THEN"
    "M9|Wanduhr in UTC statt Europe/Berlin|v_new_at := (v_day + NEW.scheduled_start) AT TIME ZONE 'Europe/Berlin';|v_new_at := (v_day + NEW.scheduled_start) AT TIME ZONE 'UTC';"
  )
  not_killed=()
  for mut in "${MUTATIONS[@]}"; do
    IFS='|' read -r mid mtext mfrom mto <<<"$mut"
    mutated="$WORKDIR/$mid.sql"
    python3 - "$TARGET_FILE" "$mutated" "$mfrom" "$mto" <<'PY'
import sys
src, dst, frm, to = sys.argv[1], sys.argv[2], sys.argv[3].encode().decode('unicode_escape'), sys.argv[4].encode().decode('unicode_escape')
text = open(src, encoding='utf-8').read()
if text.count(frm) != 1:
    sys.exit(f"Mutation: Stelle nicht genau einmal gefunden: {frm!r} ({text.count(frm)}x)")
open(dst, 'w', encoding='utf-8').write(text.replace(frm, to))
PY
    reset_counts
    echo "=== $mid: $mtext" >&2
    apply_target "$mutated"
    run_probes "$mid" > "$WORKDIR/$mid.log"
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "ROT   $mid $mtext ($(total_dev) Abweichung(en): $(grep -c '^ABWEICHUNG' "$WORKDIR/$mid.log" | tr -d ' '); z. B. $(grep -m1 '^ABWEICHUNG' "$WORKDIR/$mid.log" | cut -c13-90))"
    else
      echo "GRUEN $mid $mtext -- Mutation nicht erkannt"
      not_killed+=("$mid")
    fi
  done
  if [[ ${#not_killed[@]} -eq 0 ]]; then
    echo "Gegenprobe: ${#MUTATIONS[@]} von ${#MUTATIONS[@]} Mutationen rot."
    exit 0
  fi
  echo "::error::Gegenprobe: nicht erkannt: ${not_killed[*]}"
  exit 1
fi

# --- normaler Lauf ------------------------------------------------------------------------------------------------
start_container
echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
psql_stdin < "$BASELINE_FILE"
for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done
setup_helpers; setup_users

# --- F: Fail-fast ------------------------------------------------------------------------------------------------
q "ALTER TABLE public.matches RENAME COLUMN original_start TO original_start_r8_probe;" >/dev/null
F_DUMP_BEFORE="$(schema_dump)"
set +e
F_OUT="$(apply_target 2>&1)"
F_EXIT=$?
set -e
grep -q 'Voraussetzungen fehlen' <<<"$F_OUT" || echo "F-Ausgabe: $(head -c 400 <<<"$F_OUT")" >&2
check F "ohne matches.original_start: Abbruch mit 'Voraussetzungen fehlen', Schema unveraendert" "abbruch|Voraussetzungen fehlen|identisch" \
  "$([[ "$F_EXIT" -ne 0 ]] && echo abbruch || echo "exit $F_EXIT")|$(grep -o 'Voraussetzungen fehlen' <<<"$F_OUT" | head -1)|$([[ "$(schema_dump)" == "$F_DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
q "ALTER TABLE public.matches RENAME COLUMN original_start_r8_probe TO original_start;" >/dev/null

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
MD5_BEFORE="$(md5_state)"
echo "md5 vorher (Trigger auf matches: Name|md5 Funktion|md5 Definition):"
sed 's/^/    /' <<<"$MD5_BEFORE"

echo "Migration einspielen..." >&2
apply_target

# --- S: Schema ----------------------------------------------------------------------------------------------------
check S "Trigger matches_guard_schedule_times: BEFORE UPDATE OF scheduled_start, original_start, ROW, aktiv" \
  "O|19|CREATE TRIGGER matches_guard_schedule_times BEFORE UPDATE OF scheduled_start, original_start ON public.matches FOR EACH ROW EXECUTE FUNCTION matches_guard_schedule_times()" \
  "$(q "SELECT tgenabled::text || '|' || tgtype::text || '|' || pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'matches_guard_schedule_times';")"
check S "Funktion SECURITY INVOKER, search_path fest, kein EXECUTE fuer PUBLIC/anon/authenticated" "false|{\"search_path=public, pg_temp\"}|false|false|false" \
  "$(q "SELECT p.prosecdef || '|' || p.proconfig::text || '|' || EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) || '|'
            || has_function_privilege('anon', p.oid, 'EXECUTE') || '|' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
          FROM pg_proc p WHERE p.oid = to_regprocedure('public.matches_guard_schedule_times()');")"
check S "matches_bump_change_revision zaehlt original_start (WHEN-Liste)" "t" \
  "$(q "SELECT pg_get_triggerdef(oid) LIKE '%(old.original_start IS DISTINCT FROM new.original_start)%' FROM pg_trigger WHERE tgname = 'matches_bump_change_revision';")"
check S "Funktion matches_bump_change_revision() unveraendert (md5 = vorher)" \
  "$(grep '^matches_bump_change_revision|' <<<"$MD5_BEFORE" | cut -d'|' -f2)" \
  "$(q "SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.matches_bump_change_revision()');")"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in columns functions triggers tables policies indexes rls_tables; do
  expected=0
  case "$dim" in functions|triggers) expected=1 ;; esac
  check S "Katalogzaehlung $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
MD5_AFTER="$(md5_state)"
echo "md5 nachher (Soll fuer Produktion):"
sed 's/^/    /' <<<"$MD5_AFTER"
echo "    md5(prosrc) matches_guard_schedule_times: $(q "SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.matches_guard_schedule_times()');")"

run_probes haupt

# --- P: Rechte-Assertion ------------------------------------------------------------------------------------------
PRIV_OUT="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || PRIV_OUT="nicht ausfuehrbar: $PRIV_OUT"
check P "Rechte-Assertion: keine Zeile |f" "" "$(grep -v '|t$' <<<"$PRIV_OUT" || true)"
check P "die drei neuen Zeilen vorhanden und |t" \
  "matches-bump-change-revision-counts-original-start|t,matches-guard-schedule-times-invoker-no-client-execute|t,matches-guard-schedule-times-trigger-active|t" \
  "$(grep -E '^(matches-guard-schedule-times|matches-bump-change-revision-counts)' <<<"$PRIV_OUT" | sort | paste -sd, -)"
check P "db-drift-check.sh kennt die drei Namen und die Zuordnung der Migration" "3|1" \
  "$(grep -cE '^  "(matches-guard-schedule-times-trigger-active|matches-guard-schedule-times-invoker-no-client-execute|matches-bump-change-revision-counts-original-start)"$' "$REPO_ROOT/scripts/db-drift-check.sh")|$(grep -c "^    $TARGET_NAME)" "$REPO_ROOT/scripts/db-drift-check.sh")"

# --- W: idempotent ------------------------------------------------------------------------------------------------
set +e
apply_target >/dev/null 2>&1
W_EXIT=$?
set -e
check W "zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check W "danach md5 der Trigger unveraendert und genau 1 Trigger matches_guard_schedule_times" "gleich|1" \
  "$([[ "$(md5_state)" == "$MD5_AFTER" ]] && echo gleich || echo verschieden)|$(q "SELECT count(*) FROM pg_trigger WHERE tgname = 'matches_guard_schedule_times';")"
check W "danach Schema (public) unveraendert" "identisch" "$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg --------------------------------------------------------------------------------------------------
rueckweg_sql | psql_stdin
check X "nach dem Rueckweg: Schema public = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$(schema_dump)" == "$DUMP_BEFORE" ]] && echo identisch || { diff <(echo "$DUMP_BEFORE") <(schema_dump) | head -20 >&2; echo verschieden; })"
check X "nach dem Rueckweg: md5 der Trigger = vorher" "gleich" "$([[ "$(md5_state)" == "$MD5_BEFORE" ]] && echo gleich || echo verschieden)"
apply_target
check X "erneut eingespielt: md5 = nachher, Schema = nachher" "gleich|identisch" \
  "$([[ "$(md5_state)" == "$MD5_AFTER" ]] && echo gleich || echo verschieden)|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f"
  echo "OK    spaetere Migration laeuft: $(basename "$f")" >&2
done

echo
summary
[[ "$(total_dev)" -eq 0 ]]
