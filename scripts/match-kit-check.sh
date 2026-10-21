#!/usr/bin/env bash
#
# match-kit-check.sh — Container-Beweis fuer supabase/migrations/20261028_004_match_kit_colors.sql
# (A-30a, Brief A-30 § 2.3 + Delta 2026-10-17). Muster: scripts/match-origin-check.sh (Wegwerf-Container
# supabase/postgres, Baseline + Migrationen seit Baseline, Aufraeumen per trap).
#
# Was gemessen wird (Anforderungen @W3-028, @SL-137, @ZM-140):
#   P  Projektion beim Anpfiff ueber append_match_events (echte Client-Rolle, Turnierleitung):
#      P1 MATCH_START mit kit -> Spalten gesetzt, Kleinbuchstaben normalisiert, Ereignis angenommen;
#      P2 ungueltiges kit -> NULL, Anpfiff trotzdem angenommen; P3 Anpfiff ohne kit / kit kein Objekt
#      -> Spalten unveraendert; P4 Gegenbeispiel: GOAL/PAUSE (auch mit kit in der Payload) aendern nichts;
#      P5 Wiederholung desselben MATCH_START -> duplicate, gleiche ID mit anderer Farbe -> ID_CONFLICT,
#      Spalten unveraendert.
#   G  Schutz (Trigger matches_guard_kit_columns): G1 Client-Update kit_color_a/kit_color_b/bib_side -> HF003;
#      G2 gleicher Wert und andere Spalte -> ok; G3 Client-Insert mit kit -> NULL; G4 Server (postgres) darf.
#   C  Pruefregeln: ungueltige Form auch fuer den Server -> 23514.
#   S  Schema: drei Spalten, drei gueltige Pruefregeln, zwei Trigger aktiv; Katalogzaehlung
#      (scripts/db_catalog_counts.py) Spalten +3, Funktionen +2, Trigger +2; pg_constraint +3.
#   R  Rechte-Assertion scripts/db_privilege_assertions.sql als ci_schema_reader: alle Zeilen |t.
#   W  zweites Einspielen -> ok (idempotent), Werte unveraendert.
#   X  Rueckbau-Kommentar aus der Migration ausfuehren -> Schema (pg_dump public) = vor der Migration.
#
# Aufrufoptionen:
#   bash scripts/match-kit-check.sh               normaler Lauf -- 0 Abweichungen, Exit 0
#   bash scripts/match-kit-check.sh --gegenprobe  je Lauf eine Mutation der Migration im Container; Exit 0 NUR,
#                                                 wenn JEDE Mutation mindestens eine Pruefung rot faerbt:
#     M1 WHEN-Bedingung des Projektions-Triggers + Typpruefung (jsonb_typeof) entfernt -> P3/P4 rot
#     M2 Schutz-Trigger matches_guard_kit_columns nicht angelegt -> G1/G3 rot
#     M3 upper() entfernt (keine Normalisierung) -> P1 rot
#     M4 Leibchen-Seite ohne Pruefung uebernommen -> P2 rot (Pruefregel 23514 bricht den Anpfiff ab)
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener
# Wegwerf-Container, wird am Ende entfernt (trap). Keine Dateien ausserhalb des Containers.
#
set -euo pipefail

MODE="normal"
if [[ "${1:-}" == "--gegenprobe" ]]; then
  MODE="gegenprobe"
elif [[ -n "${1:-}" ]]; then
  echo "::error::Unbekannte Option: $1 (erlaubt: --gegenprobe)" >&2
  exit 2
fi

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie match-origin-check.sh
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261028_004_match_kit_colors.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
CONTAINER_PREFIX="match-kit-check-$$"
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
  docker run -d --name "$CURRENT_CONTAINER" -e POSTGRES_PASSWORD=postgres -p 5432 "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 90); do
    if [[ "$(docker logs "$CURRENT_CONTAINER" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "::error::Container wurde nach 90s nicht bereit." >&2
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
q() { psql_value <<<"$1"; }
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }

DEV=0
OK=0
check() { # check <Name> <erwartet> <erhalten>
  if [[ "$2" == "$3" ]]; then
    OK=$((OK + 1)); echo "OK          $1"
  else
    DEV=$((DEV + 1)); echo "ABWEICHUNG  $1"; echo "    erwartet: $2"; echo "    erhalten: $3"
  fi
}

uuid_for() {
  local h
  h="$(printf '%s' "match-kit-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}

U_OWNER="$(uuid_for user:owner)"
T1="$(uuid_for tournament:hallencup)"
TEAM_NORD="$(uuid_for team:nord)"; TEAM_SUED="$(uuid_for team:sued)"
M_KIT="$(uuid_for match:spiel-12-leibchen)"; M_BAD="$(uuid_for match:spiel-13-ungueltig)"
M_NONE="$(uuid_for match:spiel-14-ohne-kit)"; M_OBJ="$(uuid_for match:spiel-15-kein-objekt)"
M_FREE="$(uuid_for match:spiel-16-frei)"
RULES='{"sections":2,"sectionSeconds":600,"breakSeconds":60,"knockout":false,"tiebreak":null,"overtimeSeconds":0,"shootersPerTeam":5,"suddenDeathAfter":5,"penaltySeconds":120}'

# ev <typ> <id> <payload-json> [teamId] -- Engine-Ereignis (Format wie scripts/append-match-events-check.sh).
ev() {
  local team="null"
  [[ -n "${4:-}" ]] && team="\"$4\""
  jq -cn --arg type "$1" --arg id "$2" --argjson payload "$3" --argjson team "$team" \
    '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, teamId: $team, targetId: null, payload: $payload}'
}
# call <Spiel> <Ereignis-JSON> -- append_match_events als Turnierleitung (authenticated), Antwort als jsonb.
call() { q "SELECT public.__kit_call('$U_OWNER'::uuid, '$1'::uuid, \$J\$[$2]\$J\$::jsonb);"; }
status_of() { jq -r '.results[0].status // .exception // "?"' <<<"$1"; }
code_of() { jq -r '.results[0].code // .exception // "-"' <<<"$1"; }
kit_of() { q "SELECT coalesce(kit_color_a, 'NULL') || '|' || coalesce(kit_color_b, 'NULL') || '|' || coalesce(bib_side, 'NULL') FROM public.matches WHERE id = '$1';"; }
client_sql() { q "SELECT public.__kit_exec('$U_OWNER'::uuid, \$S\$$1\$S\$);"; }

# setup_db [mutierte Migration auf stdin? 0|1] -- Baseline, Vorlauf, Daten, Ziel-Migration (ggf. mutiert), Rest.
setup_before() {
  echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  psql_stdin < "$BASELINE_FILE"
  for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '$U_OWNER', 'authenticated', 'authenticated',
        'owner@match-kit.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES ('$T1', '$U_OWNER', 'Hallencup Süd', '2026-10-28', 2, 20, '{"gamePeriods":2,"halftimeBreak":1}'::jsonb);
INSERT INTO public.teams (id, tournament_id, name) VALUES ('$TEAM_NORD', '$T1', 'FC Nord'), ('$TEAM_SUED', '$T1', 'SV Süd');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, is_final, phase, match_number)
VALUES ('$M_KIT',  '$T1', 1, 1, '$TEAM_SUED', '$TEAM_NORD', false, 'groupStage', 12),
       ('$M_BAD',  '$T1', 1, 2, '$TEAM_SUED', '$TEAM_NORD', false, 'groupStage', 13),
       ('$M_NONE', '$T1', 2, 1, '$TEAM_SUED', '$TEAM_NORD', false, 'groupStage', 14),
       ('$M_OBJ',  '$T1', 2, 2, '$TEAM_SUED', '$TEAM_NORD', false, 'groupStage', 15),
       ('$M_FREE', '$T1', 3, 1, '$TEAM_SUED', '$TEAM_NORD', false, 'groupStage', 16);
SQL
}

setup_helpers() {
  psql_stdin <<'SQL'
-- append_match_events als echte Client-Rolle (SET LOCAL role + request.jwt.claim.sub, wie PostgREST).
CREATE FUNCTION public.__kit_call(p_user uuid, p_match uuid, p_events jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $fn$
DECLARE
  v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    v := public.append_match_events(p_match, p_events, 1, NULL);
  EXCEPTION WHEN OTHERS THEN
    v := jsonb_build_object('exception', SQLSTATE, 'message', SQLERRM);
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
-- Beliebige SQL als Client-Rolle (authenticated); 'ok:<Zeilen>' oder 'error:<SQLSTATE>'.
CREATE FUNCTION public.__kit_exec(p_user uuid, p_sql text) RETURNS text
LANGUAGE plpgsql AS $fn$
DECLARE
  v_rows bigint;
  v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('role', 'authenticated', true);
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
SQL
}

# run_probes -- P, G, C (gemeinsam fuer normalen Lauf und Gegenprobe).
run_probes() {
  local out
  # P1 @SL-137: Heimseite Leibchen Gelb (klein geschrieben gesendet), Gast Rot.
  E_START="$(uuid_for event:start-12)"
  START_12="$(ev MATCH_START "$E_START" "{\"rules\":$RULES,\"kit\":{\"a\":\"#ffcc00\",\"b\":\"#C62828\",\"bibSide\":\"a\"}}")"
  out="$(call "$M_KIT" "$START_12")"
  check "P1 @SL-137 MATCH_START mit kit angenommen" "accepted" "$(status_of "$out")"
  check "P1 @SL-137 Spalten = getragene Farben, normalisiert (#FFCC00|#C62828|a)" "#FFCC00|#C62828|a" "$(kit_of "$M_KIT")"
  check "P1 Payload unveraendert gespeichert (kit wie gesendet)" '{"a":"#ffcc00","b":"#C62828","bibSide":"a"}' \
    "$(q "SELECT (payload -> 'kit')::text FROM public.match_events WHERE id = '$E_START';" | jq -c .)"

  # P2: ungueltiges kit -> NULL, nie Abbruch des Anpfiffs.
  local e_payload e_event
  e_payload="{\"rules\":$RULES,\"kit\":{\"a\":\"gelb\",\"b\":\"#fc0\",\"bibSide\":\"x\"}}"
  e_event="$(ev MATCH_START "$(uuid_for event:start-13)" "$e_payload")"
  out="$(call "$M_BAD" "$e_event")"
  check "P2 ungueltiges kit: Anpfiff angenommen" "accepted" "$(status_of "$out")"
  check "P2 ungueltiges kit: Spalten NULL" "NULL|NULL|NULL" "$(kit_of "$M_BAD")"
  check "P2 ungueltiges kit: Spiel laeuft" "running" "$(q "SELECT match_status FROM public.matches WHERE id = '$M_BAD';")"

  # P3: ohne kit / kit kein Objekt -> Spalten bleiben (vorher vom Server gesetzt).
  q "UPDATE public.matches SET kit_color_a = '#000000', kit_color_b = '#FFFFFF', bib_side = 'b' WHERE id IN ('$M_NONE', '$M_OBJ');" >/dev/null
  e_event="$(ev MATCH_START "$(uuid_for event:start-14)" "{\"rules\":$RULES}")"
  out="$(call "$M_NONE" "$e_event")"
  check "P3 Anpfiff ohne kit angenommen" "accepted" "$(status_of "$out")"
  check "P3 Anpfiff ohne kit: Spalten unveraendert" "#000000|#FFFFFF|b" "$(kit_of "$M_NONE")"
  e_event="$(ev MATCH_START "$(uuid_for event:start-15)" "{\"rules\":$RULES,\"kit\":\"gelb\"}")"
  out="$(call "$M_OBJ" "$e_event")"
  check "P3 kit kein Objekt: Anpfiff angenommen" "accepted" "$(status_of "$out")"
  check "P3 kit kein Objekt: Spalten unveraendert" "#000000|#FFFFFF|b" "$(kit_of "$M_OBJ")"

  # P4 @W3-028 Gegenbeispiel: andere Ereignistypen (auch mit kit in der Payload) aendern nichts.
  e_event="$(ev GOAL "$(uuid_for event:goal-12)" '{"kit":{"a":"#000000","b":"#000000"}}' "$TEAM_SUED")"
  out="$(call "$M_KIT" "$e_event")"
  check "P4 GOAL (mit kit in der Payload) angenommen" "accepted" "$(status_of "$out")"
  e_event="$(ev PAUSE "$(uuid_for event:pause-12)" '{"kit":{"a":"#000000"}}')"
  out="$(call "$M_KIT" "$e_event")"
  check "P4 PAUSE angenommen" "accepted" "$(status_of "$out")"
  check "P4 @W3-028 nach GOAL/PAUSE: Farben unveraendert" "#FFCC00|#C62828|a" "$(kit_of "$M_KIT")"

  # P5: Wiederholung -> duplicate; gleiche ID, andere Farbe -> ID_CONFLICT (Ruling R-A30-1: gewollt).
  out="$(call "$M_KIT" "$START_12")"
  check "P5 derselbe MATCH_START erneut -> duplicate" "duplicate" "$(status_of "$out")"
  e_payload="{\"rules\":$RULES,\"kit\":{\"a\":\"#000000\",\"b\":\"#C62828\",\"bibSide\":\"a\"}}"
  e_event="$(ev MATCH_START "$E_START" "$e_payload")"
  out="$(call "$M_KIT" "$e_event")"
  check "P5 gleiche ID, andere Farbe -> ID_CONFLICT" "ID_CONFLICT" "$(code_of "$out")"
  check "P5 Farben unveraendert" "#FFCC00|#C62828|a" "$(kit_of "$M_KIT")"
  check "P5 genau ein MATCH_START gespeichert" "1" "$(q "SELECT count(*) FROM public.match_events WHERE match_id = '$M_KIT' AND type = 'MATCH_START';")"

  # G1-G4 Schutz (Fehlercode HF003).
  check "G1 Client-Update kit_color_a -> HF003" "error:HF003" "$(client_sql "UPDATE public.matches SET kit_color_a = '#000000' WHERE id = '$M_KIT'")"
  check "G1 Client-Update kit_color_b -> HF003" "error:HF003" "$(client_sql "UPDATE public.matches SET kit_color_b = NULL WHERE id = '$M_KIT'")"
  check "G1 Client-Update bib_side -> HF003" "error:HF003" "$(client_sql "UPDATE public.matches SET bib_side = 'b' WHERE id = '$M_KIT'")"
  check "G2 Client-Update mit gleichem Wert -> ok" "ok:1" "$(client_sql "UPDATE public.matches SET kit_color_a = '#FFCC00' WHERE id = '$M_KIT'")"
  check "G2 Client-Update einer anderen Spalte -> ok, Farben unveraendert" "ok:1|#FFCC00|#C62828|a" \
    "$(client_sql "UPDATE public.matches SET label = 'Spiel 12' WHERE id = '$M_KIT'")|$(kit_of "$M_KIT")"
  M_INS="$(uuid_for match:client-insert)"
  check "G3 Client-Insert mit kit -> angelegt" "ok:1" \
    "$(client_sql "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, kit_color_a, kit_color_b, bib_side) VALUES ('$M_INS', '$T1', 9, 1, '$TEAM_SUED', '$TEAM_NORD', '#000000', '#FFFFFF', 'a')")"
  check "G3 Client-Insert: Farben NULL" "NULL|NULL|NULL" "$(kit_of "$M_INS")"
  q "UPDATE public.matches SET kit_color_a = '#123456' WHERE id = '$M_FREE';" >/dev/null
  check "G4 Server (postgres) darf schreiben" "#123456|NULL|NULL" "$(kit_of "$M_FREE")"

  # C Pruefregeln gelten auch fuer den Server.
  set +e
  local c_out
  c_out="$(q "UPDATE public.matches SET kit_color_a = '#ffcc00' WHERE id = '$M_FREE';" 2>&1)"
  set -e
  check "C Pruefregel: Kleinbuchstaben auch fuer den Server abgelehnt (23514)" "1" "$(grep -c 'matches_kit_color_a_form' <<<"$c_out" || true)"
}

if [[ "$MODE" == "gegenprobe" ]]; then
  # Mutationen der Migration: Muster je genau einmal vorhanden, sonst Abbruch (zahnlose Probe).
  M1_FROM=$'  FOR EACH ROW WHEN (NEW.type = \'MATCH_START\')\n'
  M1_TO=$'  FOR EACH ROW\n'
  M1B_FROM="  IF v_kit IS NULL OR jsonb_typeof(v_kit) <> 'object' THEN"
  M1B_TO="  IF v_kit IS NULL THEN"
  M2_FROM=$'CREATE TRIGGER matches_guard_kit_columns\n  BEFORE INSERT OR UPDATE ON public.matches\n  FOR EACH ROW EXECUTE FUNCTION public.matches_guard_kit_columns();\n'
  M2_TO=$'-- (Gegenprobe M2: Schutz-Trigger nicht angelegt)\n'
  M3_FROM="  v_a   := upper(v_kit ->> 'a');"
  M3_TO="  v_a   := v_kit ->> 'a';"
  M4_FROM="  IF v_bib IS NOT NULL AND v_bib NOT IN ('a', 'b') THEN v_bib := NULL; END IF;"
  M4_TO="  -- (Gegenprobe M4: Leibchen-Seite ungeprueft)"
  RED_TOTAL=0
  for mut in M1 M2 M3 M4; do
    start_container "$mut"
    setup_before
    case "$mut" in
      M1) keys="M1 M1B" ;;
      *) keys="$mut" ;;
    esac
    MUT_KEYS="$keys" M1_FROM="$M1_FROM" M1_TO="$M1_TO" M1B_FROM="$M1B_FROM" M1B_TO="$M1B_TO" M2_FROM="$M2_FROM" M2_TO="$M2_TO" \
    M3_FROM="$M3_FROM" M3_TO="$M3_TO" M4_FROM="$M4_FROM" M4_TO="$M4_TO" python3 -c '
import os, sys
s = sys.stdin.read()
for k in os.environ["MUT_KEYS"].split():
    frm = os.environ[k + "_FROM"]
    if s.count(frm) != 1:
        sys.exit("Gegenprobe: Muster %s nicht genau einmal in der Migration" % k)
    s = s.replace(frm, os.environ[k + "_TO"])
sys.stdout.write(s)' < "$TARGET_FILE" | psql_stdin
    for f in ${AFTER[@]+"${AFTER[@]}"}; do psql_stdin < "$f"; done
    setup_helpers
    DEV=0; OK=0
    echo "--- GEGENPROBE $mut ---"
    run_probes
    if [[ "$DEV" -gt 0 ]]; then
      echo "GEGENPROBE $mut: rot ($DEV Abweichung(en)) -- wie verlangt"
      RED_TOTAL=$((RED_TOTAL + 1))
    else
      echo "::error::GEGENPROBE $mut blieb gruen (zahnlos)"
    fi
    stop_container
  done
  echo
  echo "Gegenprobe: $RED_TOTAL von 4 Mutationen rot."
  [[ "$RED_TOTAL" -eq 4 ]]
  exit $?
fi

start_container normal
setup_before
check "V Prognose-Zaehlung (nur lesen): spiele|angepfiffen" "5|0" \
  "$(q "SELECT count(*) || '|' || count(*) FILTER (WHERE match_status <> 'scheduled') FROM public.matches;")"
DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
CONSTRAINTS_BEFORE="$(q "SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.matches'::regclass;")"

echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE"
# A-10: Spaetere Migrationen (AFTER, z. B. 20261028_005) laufen erst ganz am Ende (A5, wie match-origin-check.sh) --
# vorher wuerden S4 (Katalog-Delta) und X (Rueckbau-Vergleich) sie mitmessen.
check "V Bestand: keine Zeile betroffen (alle Spalten NULL)" "0" \
  "$(q "SELECT count(*) FROM public.matches WHERE kit_color_a IS NOT NULL OR kit_color_b IS NOT NULL OR bib_side IS NOT NULL;")"

# --- S: Schema ----------------------------------------------------------------------------------------
check "S1 Spalten kit_color_a/kit_color_b/bib_side vom Typ text" "bib_side:text,kit_color_a:text,kit_color_b:text" \
  "$(q "SELECT string_agg(column_name || ':' || data_type, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema='public' AND table_name='matches' AND column_name IN ('kit_color_a','kit_color_b','bib_side');")"
check "S2 Pruefregeln gueltig (convalidated)" "matches_bib_side_valid|true,matches_kit_color_a_form|true,matches_kit_color_b_form|true" \
  "$(q "SELECT string_agg(conname || '|' || convalidated, ',' ORDER BY conname) FROM pg_constraint WHERE conname IN ('matches_kit_color_a_form','matches_kit_color_b_form','matches_bib_side_valid');")"
check "S3 Trigger aktiv (tgenabled O)" "match_events_kit_from_match_start|O,matches_guard_kit_columns|O" \
  "$(q "SELECT string_agg(tgname || '|' || tgenabled::text, ',' ORDER BY tgname) FROM pg_trigger WHERE tgname IN ('match_events_kit_from_match_start','matches_guard_kit_columns');")"
check "S3 Projektions-Trigger nur fuer MATCH_START (WHEN)" "1" \
  "$(q "SELECT count(*) FROM pg_trigger WHERE tgname = 'match_events_kit_from_match_start' AND pg_get_triggerdef(oid) LIKE '%WHEN ((new.type = ''MATCH_START''::text))%';")"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in columns functions triggers tables policies indexes rls_tables; do
  expected=0
  case "$dim" in columns) expected=3 ;; functions|triggers) expected=2 ;; esac
  check "S4 Katalogzaehlung $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
check "S5 pg_constraint an public.matches: Zuwachs" "3" \
  $(( $(q "SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.matches'::regclass;") - CONSTRAINTS_BEFORE ))

setup_helpers
run_probes

# --- R: Rechte-Assertion (alle Zeilen |t, inkl. der vier neuen) ---------------------------------------
PRIV_OUT="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || PRIV_OUT="nicht ausfuehrbar: $PRIV_OUT"
# A5: Zeilen aus SPAETEREN Migrationen (20261028_005, A-10) sind in diesem Stand erwartungsgemaess f.
# UR: ebenso die Zeilen von 20261028_006 (match_event_author_names).
# A-11: auch die drei Zeilen von 20261110_001 (laeuft hier erst in A5 nach dem Rueckbau).
# CA-2: ebenso die drei Zeilen von 20261110_004 (share-rpcs-, make-public-keeps-, heartbeats-select-).
# 20261110_007: ebenso die Zeile positive-ci-schema-reader-select-field-control.
A10_ROWS='^(matches-guard-engine-columns-(insert-and-update|unconditional)|reset-match-results-|matches-bump-change-revision-|tournaments-guard-change-revision-|match-event-author-names-|role-permissions-check-mvp-rights|matches-update-only-manage-schedule|monitors-writes-manage-screens|role-checks-device-roles|has-permission-device-roles-for-anonymous|tournaments-insert-real-account-only|anon-no-write-public-tables|device-roles-guard-trigger|hook-before-user-created-auth-admin-only|auth-users-block-anonymous-upgrade|field-control-|append-match-events-checks-field-control|share-rpcs-permission-based|make-public-keeps-existing-code|heartbeats-select-manage-screens|positive-ci-schema-reader-select-field-control)'
check "R Rechte-Assertion: keine Zeile |f (ausser Zeilen der spaeteren Migrationen 20261028_005/_006, 20261110_001)" "" \
  "$(grep -v '|t$' <<<"$PRIV_OUT" | grep -vE "$A10_ROWS" || true)"
check "R neue Zeilen vorhanden und |t" \
  "match-events-kit-from-match-start-trigger-active|t,matches-guard-kit-columns-invoker-no-client-execute|t,matches-guard-kit-columns-trigger-active|t,matches-kit-from-match-start-definer-no-client-execute|t" \
  "$(grep -E '^(match-events-kit|matches-guard-kit|matches-kit-from)' <<<"$PRIV_OUT" | sort | paste -sd, -)"
check "R Engine-Zaehlung bleibt 52" "match-engine-function-count-52|t" "$(grep '^match-engine-function-count-52|' <<<"$PRIV_OUT" || true)"
q "DROP FUNCTION public.__kit_call(uuid, uuid, jsonb); DROP FUNCTION public.__kit_exec(uuid, text);" >/dev/null

# --- W: idempotent ------------------------------------------------------------------------------------
set +e
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
W_EXIT=$?
set -e
check "W zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check "W danach genau 2 Trigger, 3 gueltige Pruefregeln" "2|3" \
  "$(q "SELECT count(*) FROM pg_trigger WHERE tgname IN ('match_events_kit_from_match_start','matches_guard_kit_columns');")|$(q "SELECT count(*) FROM pg_constraint WHERE conname IN ('matches_kit_color_a_form','matches_kit_color_b_form','matches_bib_side_valid') AND convalidated;")"
check "W Werte unveraendert (Spiel 12)" "#FFCC00|#C62828|a" "$(kit_of "$M_KIT")"

# --- X: Rueckbau laut Kommentar ----------------------------------------------------------------------
ROLLBACK_SQL="$(awk '/^-- RUECKBAU/{f=1; next} f && /^--   /{sub(/^--   /, ""); print; next} f{exit}' "$TARGET_FILE")"
check "X Rueckbau-Block gefunden (6 Anweisungen)" "6" "$(grep -c ';$' <<<"$ROLLBACK_SQL" || true)"
psql_stdin <<<"BEGIN;
$ROLLBACK_SQL
COMMIT;"
DUMP_ROLLED_BACK="$(schema_dump)"
check "X nach Rueckbau: Schema public = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi

# A5: spaetere Migrationen auf dem Zustand NACH dem Rueckbau einspielen -- nur als Lauffaehigkeits-
# Nachweis (psql_stdin bricht bei einem Fehler ab). Die Messungen oben sind davon unabhaengig.
for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f"
  echo "OK    A5 spaetere Migration laeuft nach dem Rueckbau: $(basename "$f")" >&2
done

echo
echo "Ergebnis: $OK OK, $DEV Abweichung(en)."
[[ "$DEV" -eq 0 ]]
