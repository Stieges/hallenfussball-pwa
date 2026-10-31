#!/usr/bin/env bash
#
# fortsetzen-spaet-check.sh — Container-Beweis fuer supabase/migrations/20261118_009_fortsetzen_spaet.sql (Befund
# C-REOPEN-NACH-ABPFIFF-SPAET, Daniel 30.10.). Muster: scripts/klaerungsliste-check.sh (Wegwerf-Container, Baseline +
# Migrationen seit Baseline, trap, --without-migration, --gegenprobe, --print-rueckweg).
#
# Testwerte aus dem Gherkin @SL-147 (Spiel 11, mit Ablauf von selbst beendet; Tom hat „Spiel fortsetzen“ 20 Sekunden nach dem
# Abpfiff gewaehlt): Ankunft nach 1 Minute -> laeuft weiter; ohne Netz, Ankunft nach 5 Minuten -> bleibt beendet, die
# Turnierleitung findet das Fortsetzen in der Klaerungsliste; angeblich 20 Sekunden (Geraetezeit zurueckgestellt), Ankunft
# nach 15 Minuten -> abgelehnt, bleibt beendet. Dazu @ZM-180 ueber die echte Server-Antwort (append-Antwort, Spielzeile,
# Monitor-Lesefunktion display_tournament): beendet bleibt beendet, bis die Turnierleitung korrigiert. Personen wie im
# Record: Turnierleitung Olli (Eigentuemer), Helfer Tom (Handy). Stand 2:1 wie @SL-074.
# Die Ankunft „N Minuten nach dem Abpfiff“ entsteht wie in append-match-events-check.sh 9g: der Abpfiff wird mit einer
# Geraetezeit N Minuten in der Vergangenheit gesendet und sein Eintreffen (recorded_at) im Wegwerf-Container um N Minuten
# zurueckgestellt (Schutz-Trigger dafuer kurz aus, eine Transaktion).
#
# Kategorien:
#   P  Positiv-Kontrolle (gilt mit und ohne Migration): @SL-147 Z. 1 (1 Minute) -> laeuft weiter.
#   F  Fail-fast: fremde Fassung von append_match_events, fehlende Klaerungsliste -> Abbruch ohne Aenderung.
#   A  @SL-147 Z. 2 + @ZM-180: spaetes Fortsetzen -> Klaerungsliste, Spiel bleibt beendet (Antwort, Zeile, Monitor),
#      Wiederholung bleibt „review“, die Turnierleitung verwirft bzw. oeffnet selbst; Grenze knapp ueber 2 Minuten.
#   G  Gegenbeispiele: @SL-147 Z. 3 (15 Minuten -> abgelehnt, kein Klaerungseintrag), Grenzen 1:57 / 11:54 / 12:06,
#      Turnierleitung oeffnet auch spaet (@FU-071), Abpfiff von Hand bleibt NOT_ENDED_BY_CLOCK ohne Klaerung (@SL-146).
#   S  Schema: nur hinzugefuegte Zeilen gegenueber 20261117_005, Katalog unveraendert, Rechte unveraendert, Rechte-Assertion
#      und Drift-Check-Zuordnung (die Liste der noch nicht eingespielten Migrationen prueft fortsetzenSpaetTwins.test.ts).
#   W  zweites Einspielen (idempotent).   X  Rueckweg -> Schema = vorher; Waechter stoppt den zweiten Rueckweg.
#
# Aufrufoptionen:
#   bash scripts/fortsetzen-spaet-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/fortsetzen-spaet-check.sh --without-migration  Gegenprobe: ohne die Migration muss A rot und P gruen sein
#   bash scripts/fortsetzen-spaet-check.sh --gegenprobe         je Lauf eine Mutation der Migration (M1-M6); Exit 0 NUR,
#                                                               wenn JEDE Mutation mindestens eine Pruefung rot faerbt
#   bash scripts/fortsetzen-spaet-check.sh --print-rueckweg     gibt den Rueckweg aus, ohne Container
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container
# (supabase/postgres:17.6.1.063, nativ; DOCKER_PLATFORM waehlt die Plattform ausdruecklich), wird am Ende entfernt (trap).
#
set -uo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  --print-rueckweg) MODE="print-rueckweg" ;;
  *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe, --print-rueckweg)" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie klaerungsliste-check.sh
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261118_009_fortsetzen_spaet.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
BASE_FILE="$MIGRATIONS_DIR/20261117_005_klaerungsliste.sql"
ROLLBACK_FILE="$REPO_ROOT/supabase/rollbacks/20261118_009_fortsetzen_spaet_rollback.sql"
APPEND_HEAD="CREATE OR REPLACE FUNCTION public.append_match_events("
CONTAINER_PREFIX="fortsetzen-spaet-check-$$"
CURRENT_CONTAINER=""
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/fortsetzen-spaet-check.XXXXXX")"
NEW_ASSERTIONS="fortsetzen-spaet-append-reopen-review"

# fn_block <Datei> <Funktionsanfang> -- die Funktion woertlich (CREATE OR REPLACE ... bis zur Zeile "$$;").
fn_block() { awk -v pat="$2" 'index($0, pat) == 1 {f = 1} f {print} f && $0 == "$$;" {exit}' "$1"; }

# Rueckweg (Anhang der Freigabe): append_match_events woertlich aus 20261117_005 (letzte Fassung vor dieser Datei, live seit
# 24.10.). EIN Block, Waechter: nur gegen die Fassung dieser Datei.
rueckweg_sql() {
  cat <<'SQL'
-- supabase/rollbacks/20261118_009_fortsetzen_spaet_rollback.sql
-- RUECKWEG zu supabase/migrations/20261118_009_fortsetzen_spaet.sql (C-REOPEN-NACH-ABPFIFF-SPAET). Liegt bewusst NICHT in
-- supabase/migrations (wird nie nachgespielt). Erzeugt mit `bash scripts/fortsetzen-spaet-check.sh --print-rueckweg`; belegt
-- in scripts/fortsetzen-spaet-check.sh (Kategorie X: Schema danach = Stand vor der Migration).
-- Wirkung: append_match_events wieder woertlich in der Fassung 20261117_005 -- ein „Spiel fortsetzen“ des Helfers wird bis
-- 2 Minuten + 10 Minuten Nachsende-Spielraum nach dem Eintreffen des Abpfiffs wieder angewendet (Befund
-- C-REOPEN-NACH-ABPFIFF-SPAET wieder offen). Schon zur Klaerung gelegte Fortsetzen-Eintraege bleiben in der Klaerungsliste
-- (Grund AFTER_END, die Fassung 20261117_005 kennt ihn); keine Daten gehen verloren. Reihenfolge zur App beliebig.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF position('20261118_009' IN coalesce((SELECT prosrc FROM pg_proc
                                           WHERE oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)')), '')) = 0 THEN
    RAISE EXCEPTION 'Rueckweg 20261118_009: append_match_events nicht in der Fassung 20261118_009 -- nichts geaendert';
  END IF;
END
$rw$;
-- append_match_events woertlich aus 20261117_005_klaerungsliste.sql
SQL
  fn_block "$BASE_FILE" "$APPEND_HEAD"
  cat <<'SQL'
COMMIT;
-- Danach: Assertion fortsetzen-spaet-append-reopen-review + PRIVILEGE_ASSERTION_NAMES + pending_assertions_for zurueck,
-- Drift-Check.
SQL
}
if [[ "$MODE" == "print-rueckweg" ]]; then
  rueckweg_sql
  exit 0
fi

command -v jq >/dev/null 2>&1 || { echo "::error::jq wird benoetigt." >&2; exit 1; }
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

cleanup() {
  [[ -n "$CURRENT_CONTAINER" ]] && docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1
  rm -rf "$WORK_DIR"
  return 0
}
trap cleanup EXIT

start_container() {
  CURRENT_CONTAINER="$CONTAINER_PREFIX-$1"
  docker run -d --rm ${DOCKER_PLATFORM:+--platform "$DOCKER_PLATFORM"} --name "$CURRENT_CONTAINER" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 150); do
    if [[ "$(docker logs "$CURRENT_CONTAINER" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "::error::Container wurde nach 150s nicht bereit." >&2
    docker logs "$CURRENT_CONTAINER" 2>&1 | tail -30 >&2
    exit 1
  fi
  for _ in $(seq 1 30); do
    docker exec "$CURRENT_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
}

psql_stdin() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q; }
psql_value() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA; }
q() { psql_value <<<"$1" 2>&1; }
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public --schema=match_engine postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }
apply_target() { psql_stdin < "${1:-$TARGET_FILE}"; }

CATS=(P F A G S W X)
DEVS=(0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0)
FAILED=""
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
    FAILED="$FAILED"$'\n'"[$1] $2"
  fi
}
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
dev_of() { echo "${DEVS[$(cat_index "$1")]}"; }
reset_counts() { DEVS=(0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0); FAILED=""; }
summary() {
  local i line=""
  for i in "${!CATS[@]}"; do line="$line ${CATS[$i]} ${OKS[$i]}/$((OKS[i] + DEVS[i]))"; done
  echo "Zusammenfassung (OK/gesamt):$line -- Abweichungen: $(total_dev)"
}

uuid_for() {
  local h
  h="$(printf '%s' "fortsetzen-spaet-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"; U_TOM="$(uuid_for user:tom)"
D_OLLI="$(uuid_for device:olli-tablet)"; D_TOM="$(uuid_for device:tom-handy)"
T_CUP="$(uuid_for tournament:live-cup)"
TN="$(uuid_for team:fc-nord)"; TS="$(uuid_for team:sv-sued)"
MONITOR_ID="halle-feld-1"
SHARE_CODE="LIVE11"
E() { uuid_for "event:$1"; }
M() { uuid_for "match:$1"; }

setup_data() {
  psql_stdin <<SQL
CREATE SCHEMA harness;
GRANT USAGE ON SCHEMA harness TO anon, authenticated, service_role;
CREATE FUNCTION harness.call(p_user uuid, p_match uuid, p_events jsonb, p_device uuid) RETURNS jsonb
LANGUAGE plpgsql AS \$fn\$
DECLARE v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    v := public.append_match_events(p_match, p_events, 1, p_device);
  EXCEPTION WHEN OTHERS THEN
    v := jsonb_build_object('exception', SQLSTATE, 'message', SQLERRM);
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
\$fn\$;
CREATE FUNCTION harness.list(p_user uuid) RETURNS jsonb LANGUAGE plpgsql AS \$fn\$
DECLARE v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  PERFORM set_config('role', 'authenticated', true);
  v := public.list_match_reviews('$T_CUP');
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
\$fn\$;
-- Monitor-Link wie die App ihn liest (anon, display_tournament) -- Status und Stand eines Spiels
CREATE FUNCTION harness.monitor(p_match uuid) RETURNS text LANGUAGE plpgsql AS \$fn\$
DECLARE v jsonb; m jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'anon', true);
  v := public.display_tournament('$T_CUP', '$MONITOR_ID', NULL);
  PERFORM set_config('role', 'postgres', true);
  SELECT x INTO m FROM jsonb_array_elements(v -> 'matches') x WHERE x ->> 'id' = p_match::text;
  RETURN coalesce(m ->> 'match_status', m ->> 'status', '-') || '|' || coalesce(m ->> 'score_a', '-') || ':' || coalesce(m ->> 'score_b', '-');
END;
\$fn\$;
-- Zuschauer-Seite wie die App sie liest (anon, public_tournament mit Teilen-Code) -- Status und Stand eines Spiels (@ZM-180)
CREATE FUNCTION harness.viewer(p_match uuid) RETURNS text LANGUAGE plpgsql AS \$fn\$
DECLARE v jsonb; m jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'anon', true);
  v := public.public_tournament('$SHARE_CODE', NULL);
  PERFORM set_config('role', 'postgres', true);
  SELECT x INTO m FROM jsonb_array_elements(v -> 'matches') x WHERE x ->> 'id' = p_match::text;
  RETURN coalesce(m ->> 'match_status', m ->> 'status', '-') || '|' || coalesce(m ->> 'score_a', '-') || ':' || coalesce(m ->> 'score_b', '-');
END;
\$fn\$;
-- Feldsteuerung uebernehmen (echter Weg take_field_control, wie „Spielleitung uebernehmen“ der Turnierleitung)
CREATE FUNCTION harness.take(p_user uuid, p_field integer, p_device uuid) RETURNS text LANGUAGE plpgsql AS \$fn\$
DECLARE v jsonb; v_epoch integer;
BEGIN
  SELECT epoch INTO v_epoch FROM public.field_control WHERE tournament_id = '$T_CUP' AND field = p_field;
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  PERFORM set_config('role', 'authenticated', true);
  v := public.take_field_control('$T_CUP', p_field, p_device, NULL, coalesce(v_epoch, 0));
  PERFORM set_config('role', 'postgres', true);
  RETURN coalesce(v ->> 'status', '-');
END;
\$fn\$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA harness TO anon, authenticated, service_role;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@fs.test'), ('$U_TOM'::uuid, 'tom@fs.test')) AS u(id, email);
INSERT INTO public.profiles (id, display_name, email) VALUES ('$U_OLLI', 'Olli', 'olli@fs.test'), ('$U_TOM', 'Tom', 'tom@fs.test')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, is_public, share_code, config)
VALUES ('$T_CUP', '$U_OLLI', 'Live-Cup', '2026-11-28', 2, 10, true, '$SHARE_CODE', '{"publishedAt": "2026-10-01T00:00:00.000Z", "monitors": [{"id": "$MONITOR_ID", "name": "Halle"}]}'::jsonb);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label)
VALUES ('$T_CUP', '$U_TOM', 'collaborator', now(), 'Tom');
INSERT INTO public.teams (id, tournament_id, name) VALUES ('$TN', '$T_CUP', 'FC Nord'), ('$TS', '$T_CUP', 'SV Süd');
SQL
}

# Spiel <name> auf eigenem Feld <n> (Spielnummer 11 wie im Gherkin; je Fall ein eigenes Spiel).
add_match() { # add_match <name> <feld>
  q "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start, group_letter)
     VALUES ('$(M "$1")', '$T_CUP', 1, $2, '$TN', '$TS', 11, '14:00', 'A');" >/dev/null
}
now_ms() { q "SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;"; }
# Ereignis als JSON (ohne verschachtelte Anfuehrungszeichen -- bash 3.2 zerlegt sie in $(...) als Klammer-Erweiterung).
evj() { # evj <Typ> <ID> <at> <clockMs|null> [teamId] [targetId] [section|null]
  jq -cn --arg type "$1" --arg id "$2" --argjson at "$3" --argjson clock "$4" --arg team "${5:-}" --arg target "${6:-}" \
    --argjson section "${7:-1}" \
    '{id: $id, type: $type, at: $at, section: $section, clockMs: $clock, teamId: (if $team == "" then null else $team end),
      targetId: (if $target == "" then null else $target end), payload: {}}'
}
send() { # send <Nutzer> <Geraet> <Spiel> <Ereignis-JSON>...
  local user="$1" dev="$2" match="$3" events
  shift 3
  events="$(printf '%s\n' "$@" | jq -cs '.')"
  q "SELECT harness.call('$user'::uuid, '$match'::uuid, \$J\$$events\$J\$::jsonb, '$dev'::uuid);"
}
results() { jq -r '[.results[]? | .status + (if .code then ":" + .code else "" end) + (if .detail.reason then ":" + .detail.reason else "" end)] | join(",")' <<<"$1" 2>/dev/null || echo "keine-json:$1"; }
state_of() { jq -r --arg a "$TN" --arg b "$TS" '(.state.status // "-") + "|" + ((.state.effectiveScores[$a] // "-") | tostring) + ":" + ((.state.effectiveScores[$b] // "-") | tostring)' <<<"$1" 2>/dev/null || echo "keine-json"; }
row() { q "SELECT coalesce(score_a::text, '-') || ':' || coalesce(score_b::text, '-') || '|' || coalesce(match_status, '-') FROM public.matches WHERE id = '$1';"; }
reviews_of() { # Klaerungseintraege eines Spiels: Grund:Typ:why
  q "SELECT coalesce(string_agg(r.reason || ':' || e.type || ':' || coalesce(r.detail ->> 'why', '-'), ',' ORDER BY r.created_at), '')
       FROM public.match_reviews r JOIN public.match_events e ON e.id = r.event_id
      WHERE r.match_id = '$1' AND r.kind = 'review';"
}
list_for() { # Klaerungsliste der Turnierleitung (list_match_reviews) fuer ein Ereignis: kind:reason:Typ:Autor:Entscheidung
  jq -r --arg ev "$2" '[.[]? | select(.eventId == $ev) | .kind + ":" + .reason + ":" + .entry.type + ":" + (.author // "-") + ":" + (if .decision then .decision.type else "offen" end)] | join(",")' \
    <<<"$(q "SELECT harness.list('$1'::uuid);")" 2>/dev/null
}

# Spiel 11: Tom pfeift an, 2:1, das Spiel endet von selbst (Ablauf, Spielzeit 10:00) -- Geraetezeit des Abpfiffs <sek>
# Sekunden in der Vergangenheit; danach wird das Eintreffen des Abpfiffs (recorded_at) um <sek> Sekunden zurueckgestellt.
# Mit "hand" endet es von Hand bei 3:00 (kein Ende durch Ablauf). Gibt die Geraetezeit des Abpfiffs aus.
end_match() { # end_match <name> <feld> <sek> [hand]
  local name="$1" now end_at start_at clock=600000 out
  add_match "$name" "$2"
  now="$(now_ms)"
  end_at=$(( now - $3 * 1000 ))
  start_at=$(( end_at - 600000 ))
  [[ "${4:-}" == "hand" ]] && { clock=180000; start_at=$(( end_at - 180000 )); }
  out="$(send "$U_TOM" "$D_TOM" "$(M "$name")" \
    "$(evj MATCH_START "$(E "$name-start")" "$start_at" null)" \
    "$(evj GOAL "$(E "$name-tor1")" "$(( start_at + 60000 ))" 60000 "$TN")" \
    "$(evj GOAL "$(E "$name-tor2")" "$(( start_at + 90000 ))" 90000 "$TS")" \
    "$(evj GOAL "$(E "$name-tor3")" "$(( start_at + 120000 ))" 120000 "$TN")" \
    "$(evj MATCH_END "$(E "$name-ende")" "$end_at" "$clock")")"
  if [[ "$(results "$out")" != "accepted,accepted,accepted,accepted,accepted" ]]; then
    echo "::error::Vorbereitung $name: $(results "$out") $out" >&2
  fi
  psql_stdin <<<"BEGIN; ALTER TABLE public.match_events DISABLE TRIGGER match_events_guard_engine_rows;
UPDATE public.match_events SET recorded_at = clock_timestamp() - interval '$3 seconds' WHERE id = '$(E "$name-ende")';
ALTER TABLE public.match_events ENABLE TRIGGER match_events_guard_engine_rows; COMMIT;"
  echo "$end_at"
}
# „Spiel fortsetzen“ (REOPEN) mit Geraetezeit <Abpfiff + 20 s>, Restzeit 0:40 (Spielzeit 9:20).
reopen() { # reopen <Nutzer> <Geraet> <name> <Abpfiff-Geraetezeit> [ID-Zusatz]
  send "$1" "$2" "$(M "$3")" "$(evj REOPEN "$(E "$3-fortsetzen${5:-}")" "$(( $4 + 20000 ))" 560000)"
}

# ---------------------------------------------------------------------------------------------------------
# F: Fail-fast (Block 0 der Datei unter Test, zurueckgerollt)
# ---------------------------------------------------------------------------------------------------------
run_failfast() { # run_failfast <Datei>
  local file="$1" ff
  ff="$(awk '/^-- 0\. Voraussetzungen/{f=1} /^-- 1\. append_match_events/{exit} f' "$file")"
  check F "F1 fremde Fassung von append_match_events (ein Leerzeichen anders) -> Abbruch 'unbekannte Fassung'" "1" \
    "$(q "BEGIN; $(fn_block "$BASE_FILE" "$APPEND_HEAD" | sed 's/^  v_now := clock_timestamp();/  v_now :=  clock_timestamp();/')
$ff
ROLLBACK;" | grep -c 'append_match_events hat eine unbekannte Fassung')"
  check F "F2 ohne match_engine.review_store (20261117_005 fehlt) -> Abbruch 'Voraussetzungen fehlen'" "1" \
    "$(q "BEGIN; DROP FUNCTION match_engine.review_store(public.matches, jsonb, uuid, uuid, text, jsonb, bigint) CASCADE;
$ff
ROLLBACK;" | grep -c 'Voraussetzungen fehlen')"
  check F "F3 match_reviews ohne Grund AFTER_END -> Abbruch 'Voraussetzungen fehlen'" "1" \
    "$(q "BEGIN; ALTER TABLE public.match_reviews DROP CONSTRAINT IF EXISTS match_reviews_reason_check;
$ff
ROLLBACK;" | grep -c 'Voraussetzungen fehlen')"
}

# ---------------------------------------------------------------------------------------------------------
# P, A, G: Proben (Erwartungen aus dem Gherkin, nie aus dem Code abgelesen)
# ---------------------------------------------------------------------------------------------------------
run_probes() {
  local end out e take

  # --- P @SL-147 Z. 1: 20 s nach dem Abpfiff gewaehlt, nach 1 Minute angekommen -> Spiel 11 laeuft weiter --------------
  end="$(end_match p1 1 60)"
  out="$(reopen "$U_TOM" "$D_TOM" p1 "$end")"
  check P "P1 @SL-147 Z. 1 Ankunft nach 1 Minute: Fortsetzen angenommen, Server-Antwort „laeuft“ 2:1" "accepted|running|2:1" \
    "$(results "$out")|$(state_of "$out")"
  check P "P1 Spielzeile laeuft, Stand 2:1; Monitor (display_tournament) zeigt das Spiel wieder laufend" "2:1|running|running|2:1" \
    "$(row "$(M p1)")|$(q "SELECT harness.monitor('$(M p1)');")"
  check P "P1 Zuschauer-Seite (public_tournament, anon) zeigt das Spiel wieder laufend 2:1" "running|2:1" "$(q "SELECT harness.viewer('$(M p1)');")"
  check P "P1 kein Klaerungseintrag" "" "$(reviews_of "$(M p1)")"

  # --- A @SL-147 Z. 2 + @ZM-180: ohne Netz, nach 5 Minuten angekommen -> bleibt beendet, Klaerungsliste -------------------
  end="$(end_match a1 2 300)"
  out="$(reopen "$U_TOM" "$D_TOM" a1 "$end")"
  check A "A1 @SL-147 Z. 2 Ankunft nach 5 Minuten: Antwort review AFTER_END, Server-Stand bleibt „beendet“ 2:1" "review:AFTER_END|finished|2:1" \
    "$(results "$out")|$(state_of "$out")"
  check A "A1 @ZM-180 Spielzeile bleibt beendet 2:1; Monitor (display_tournament, anon) zeigt weiter „beendet“ 2:1" "2:1|finished|finished|2:1" \
    "$(row "$(M a1)")|$(q "SELECT harness.monitor('$(M a1)');")"
  check A "A1 @ZM-180 Zuschauer-Seite (public_tournament, anon) zeigt weiter „beendet“ 2:1" "finished|2:1" "$(q "SELECT harness.viewer('$(M a1)');")"
  check A "A1 das Fortsetzen liegt zur Klaerung (AFTER_END, REOPEN, CONTINUE_LATE), zaehlt nicht (review_state pending)" "AFTER_END:REOPEN:CONTINUE_LATE|pending" \
    "$(reviews_of "$(M a1)")|$(q "SELECT coalesce(review_state, 'NULL') FROM public.match_events WHERE id = '$(E a1-fortsetzen)';")"
  check A "A1 @SL-147 Z. 2 die Turnierleitung (Olli) findet das Fortsetzen von Tom in der Klaerungsliste, offen" "review:AFTER_END:REOPEN:Tom:offen" \
    "$(list_for "$U_OLLI" "$(E a1-fortsetzen)")"
  check A "A1 Abstand Abpfiff -> Ankunft steht im Eintrag (arrivedAfterMs ueber 2 Minuten, unter 6 Minuten)" "t" \
    "$(q "SELECT (detail ->> 'arrivedAfterMs')::bigint BETWEEN 120001 AND 360000 FROM public.match_reviews WHERE event_id = '$(E a1-fortsetzen)';")"
  out="$(reopen "$U_TOM" "$D_TOM" a1 "$end")"
  check A "A2 Toms Geraet sendet das Fortsetzen erneut (Warteschlange): wieder review AFTER_END, Spiel bleibt beendet, kein zweiter Eintrag" \
    "review:AFTER_END|finished|1" "$(results "$out")|$(state_of "$out" | cut -d'|' -f1)|$(q "SELECT count(*) FROM public.match_reviews WHERE match_id = '$(M a1)';")"
  check A "A2 @ZM-180 nach der Wiederholung: Monitor und Zuschauer-Seite weiter „beendet“ 2:1" "finished|2:1|finished|2:1" \
    "$(q "SELECT harness.monitor('$(M a1)');")|$(q "SELECT harness.viewer('$(M a1)');")"
  out="$(send "$U_TOM" "$D_TOM" "$(M a1)" \
    "$(evj REOPEN "$(E a1-fortsetzen-b)" "$(( end + 25000 ))" 560000)" \
    "$(evj GOAL "$(E a1-tor-danach)" "$(( end + 40000 ))" 575000 "$TS")")"
  check A "A3 Fortsetzen und danach ein Tor im selben Aufruf (5 Minuten zu spaet): beides zur Klaerung, Stand bleibt 2:1 beendet" \
    "review:AFTER_END,review:AFTER_END|2:1|finished" "$(results "$out")|$(row "$(M a1)")"
  check A "A3 @ZM-180 danach: Monitor und Zuschauer-Seite weiter „beendet“ 2:1 (das Tor zaehlt nicht)" "finished|2:1|finished|2:1" \
    "$(q "SELECT harness.monitor('$(M a1)');")|$(q "SELECT harness.viewer('$(M a1)');")"
  out="$(send "$U_OLLI" "$D_OLLI" "$(M a1)" "$(evj REVIEW_DISCARD "$(E a1-verwerfen)" "$(now_ms)" null "" "$(E a1-fortsetzen)" null)")"
  check A "A4 Olli verwirft den Eintrag: angenommen, Spiel bleibt beendet 2:1" "accepted|2:1|finished" "$(results "$out")|$(row "$(M a1)")"
  take="$(q "SELECT harness.take('$U_OLLI', 2, '$D_OLLI');")"
  out="$(send "$U_OLLI" "$D_OLLI" "$(M a1)" "$(evj REOPEN "$(E a1-olli-oeffnet)" "$(now_ms)" 560000)")"
  check A "A5 @FU-071 wieder oeffnen kann Spiel 11 die Turnierleitung (uebernimmt das Feld, oeffnet): angenommen, Spiel laeuft" "taken|accepted|running" \
    "$take|$(results "$out")|$(state_of "$out" | cut -d'|' -f1)"
  end="$(end_match a6 3 123)"
  out="$(reopen "$U_TOM" "$D_TOM" a6 "$end")"
  check A "A6 Grenze: Ankunft 2:03 nach dem Abpfiff -> review AFTER_END, bleibt beendet" "review:AFTER_END|finished" \
    "$(results "$out")|$(state_of "$out" | cut -d'|' -f1)"
  end="$(end_match a7 4 714)"
  out="$(reopen "$U_TOM" "$D_TOM" a7 "$end")"
  check A "A7 Grenze: Ankunft 11:54 (noch im Nachsende-Spielraum) -> review AFTER_END, bleibt beendet" "review:AFTER_END|finished" \
    "$(results "$out")|$(state_of "$out" | cut -d'|' -f1)"

  # --- G Gegenbeispiele ---------------------------------------------------------------------------------------------
  end="$(end_match g1 5 900)"
  out="$(reopen "$U_TOM" "$D_TOM" g1 "$end")"
  check G "G1 @SL-147 Z. 3 Geraetezeit zurueckgestellt, Ankunft nach 15 Minuten: abgelehnt (CONTINUE_WINDOW_EXPIRED), bleibt beendet 2:1" \
    "rejected:FORBIDDEN_ACTOR:CONTINUE_WINDOW_EXPIRED|finished|2:1|2:1|finished" "$(results "$out")|$(state_of "$out")|$(row "$(M g1)")"
  check G "G1 kein Klaerungseintrag bei der Ablehnung" "" "$(reviews_of "$(M g1)")"
  end="$(end_match g2 6 117)"
  out="$(reopen "$U_TOM" "$D_TOM" g2 "$end")"
  check G "G2 Grenze: Ankunft 1:57 nach dem Abpfiff -> angenommen, laeuft weiter" "accepted|running" \
    "$(results "$out")|$(state_of "$out" | cut -d'|' -f1)"
  end="$(end_match g3 7 726)"
  out="$(reopen "$U_TOM" "$D_TOM" g3 "$end")"
  check G "G3 Grenze: Ankunft 12:06 -> abgelehnt, kein Klaerungseintrag" "rejected:FORBIDDEN_ACTOR:CONTINUE_WINDOW_EXPIRED|" \
    "$(results "$out")|$(reviews_of "$(M g3)")"
  end="$(end_match g4 8 300)"
  take="$(q "SELECT harness.take('$U_OLLI', 8, '$D_OLLI');")"
  out="$(reopen "$U_OLLI" "$D_OLLI" g4 "$end")"
  check G "G4 @FU-071 Turnierleitung (uebernimmt das Feld) oeffnet 5 Minuten nach dem Abpfiff: angenommen, laeuft, keine Klaerung" "taken|accepted|running|" \
    "$take|$(results "$out")|$(state_of "$out" | cut -d'|' -f1)|$(reviews_of "$(M g4)")"
  end="$(end_match g5 9 300 hand)"
  out="$(reopen "$U_TOM" "$D_TOM" g5 "$end")"
  check G "G5 @SL-146 Abpfiff von Hand bei 3:00, Fortsetzen nach 5 Minuten: abgelehnt NOT_ENDED_BY_CLOCK, keine Klaerung" \
    "rejected:FORBIDDEN_ACTOR:NOT_ENDED_BY_CLOCK|finished|" "$(results "$out")|$(state_of "$out" | cut -d'|' -f1)|$(reviews_of "$(M g5)")"
  e="$(end_match g6 10 300)"
  out="$(send "$U_TOM" "$D_TOM" "$(M g6)" "$(evj REOPEN "$(E g6-fortsetzen)" "$(( e + 150000 ))" 560000)")"
  check G "G6 @SL-075 Fortsetzen 2:30 nach dem Abpfiff gewaehlt (Geraetefrist vorbei), Ankunft nach 5 Minuten: abgelehnt, keine Klaerung" \
    "rejected:FORBIDDEN_ACTOR:CONTINUE_WINDOW_EXPIRED|" "$(results "$out")|$(reviews_of "$(M g6)")"
}

# Rechte-Assertions als ci_schema_reader; neue Namen; Namensliste = db-drift-check.sh; Zuordnung.
after_assertions() {
  awk -v pat="    $1)" '$0 == pat {f = 1; next} f && /echo "/ {sub(/^[^"]*"/, ""); sub(/".*$/, ""); print; exit} f && /;;/ {exit}' \
    "$REPO_ROOT/scripts/db-drift-check.sh"
}
run_assertions() {
  local priv names_sql names_sh a later="" f
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  for f in ${AFTER[@]+"${AFTER[@]}"}; do later="$later $(after_assertions "$(basename "$f")")"; done
  check S "Rechte-Assertion: keine Zeile |f" "" "$(grep -v '|t$' <<<"$priv" | { if [[ -n "${later// /}" ]]; then grep -vE "^($(echo $later | tr ' ' '|'))\\|"; else cat; fi; } || true)"
  for a in $NEW_ASSERTIONS; do
    check S "Rechte-Assertion: $a vorhanden und |t" "$a|t" "$(grep -E "^$a\|" <<<"$priv" || true)"
  done
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
  check S "Drift-Check-Zuordnung: pending_assertions_for nennt fuer $TARGET_NAME genau die neuen Namen" "$NEW_ASSERTIONS" "$(after_assertions "$TARGET_NAME")"
}

# ---------------------------------------------------------------------------------------------------------
start_container "$MODE"
echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
psql_stdin < "$BASELINE_FILE" >/dev/null || { echo "::error::Baseline scheitert" >&2; exit 1; }
for f in "${BEFORE[@]}"; do psql_stdin < "$f" >/dev/null || { echo "::error::Migration scheitert: $f" >&2; exit 1; }; done
setup_data

if [[ "$MODE" == "without-migration" ]]; then
  run_probes
  summary
  if [[ "$(dev_of A)" -gt 0 && "$(dev_of P)" -eq 0 ]]; then
    echo "Ohne Migration: A rot, P gruen -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (A=$(dev_of A) muss > 0 sein, P=$(dev_of P) muss 0 sein)."
  exit 1
fi

if [[ "$MODE" == "gegenprobe" ]]; then
  MUTATIONS=(
    "M1|Frist 2 Minuten nie erreicht (immer Spielraum dazu)|             AND v_now_ms - floor(extract(epoch FROM v_server_mark) * 1000)::bigint > c_continue_window_ms THEN\n            v_reopen_late_ms|             AND v_now_ms - floor(extract(epoch FROM v_server_mark) * 1000)::bigint > c_continue_window_ms + c_server_clock_tolerance_ms THEN\n            v_reopen_late_ms"
    "M2|Frist 4 statt 2 Minuten|             AND v_now_ms - floor(extract(epoch FROM v_server_mark) * 1000)::bigint > c_continue_window_ms THEN\n            v_reopen_late_ms|             AND v_now_ms - floor(extract(epoch FROM v_server_mark) * 1000)::bigint > 2 * c_continue_window_ms THEN\n            v_reopen_late_ms"
    "M3|auch eine Ablehnung der Rechenfunktion geht zur Klaerung|        IF v_result ->> 'status' = 'accepted' AND v_reopen_late_ms IS NOT NULL THEN|        IF v_reopen_late_ms IS NOT NULL THEN"
    "M4|falscher Grund (CONTROL_LOST statt AFTER_END)|                                                v_uid, p_device_id, 'AFTER_END',\n                                                jsonb_build_object('why', 'CONTINUE_LATE'|                                                v_uid, p_device_id, 'CONTROL_LOST',\n                                                jsonb_build_object('why', 'CONTINUE_LATE'"
    "M5|Klaerungseintrag ohne Angaben (Grund CONTINUE_LATE und Abstand fehlen)|                                                jsonb_build_object('why', 'CONTINUE_LATE', 'arrivedAfterMs', v_reopen_late_ms),|                                                '{}'::jsonb,"
    "M6|Fail-fast laesst fremde Fassung durch|  IF md5(v_append) <> |  IF false AND md5(v_append) <> "
  )
  not_killed=()
  for mut in "${MUTATIONS[@]}"; do
    IFS='|' read -r mid mtext mfrom mto <<<"$mut"
    mutated="$WORK_DIR/$mid.sql"
    if ! python3 - "$TARGET_FILE" "$mutated" "$mfrom" "$mto" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
frm = sys.argv[3].replace('\\n', '\n')
to = sys.argv[4].replace('\\n', '\n')
text = open(src, encoding='utf-8').read()
if text.count(frm) != 1:
    sys.exit(f"Mutation: Stelle nicht genau einmal gefunden: {frm!r} ({text.count(frm)}x)")
open(dst, 'w', encoding='utf-8').write(text.replace(frm, to))
PY
    then
      echo "::error::Mutation $mid nicht anwendbar"; exit 1
    fi
    reset_counts
    echo "=== $mid: $mtext" >&2
    # je Mutation ein frischer Stand: zuruecksetzen auf die Fassung 20261117_005 (Rueckweg) und die Mutante einspielen
    if [[ "$(q "SELECT position('20261118_009' IN prosrc) > 0 FROM pg_proc WHERE oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)');")" == "t" ]]; then
      rueckweg_sql | psql_stdin >/dev/null 2>&1
    fi
    if ! apply_target "$mutated" >"$WORK_DIR/$mid.apply" 2>&1; then
      echo "ROT   $mid $mtext (Einspielen scheitert: $(head -c 160 "$WORK_DIR/$mid.apply"))"
      continue
    fi
    { run_failfast "$mutated"; run_probes; } > "$WORK_DIR/$mid.log" 2>&1
    # Wegwerf-Container: Spiele und Eintraege der Proben entfernen (Schutz-Trigger fuer diesen Schritt aus), naechste Mutante
    q "SET session_replication_role = replica;
       DELETE FROM public.match_reviews; DELETE FROM public.match_event_authors; DELETE FROM public.match_events;
       DELETE FROM public.matches; DELETE FROM public.field_control_log; DELETE FROM public.field_control;
       SET session_replication_role = origin;" >/dev/null
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "ROT   $mid $mtext ($(total_dev) Abweichung(en): $(grep '^ABWEICHUNG' "$WORK_DIR/$mid.log" | cut -c13-22 | sed 's/ *$//' | paste -sd',' -))"
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
run_failfast "$TARGET_FILE"
q "ALTER TABLE public.match_reviews RENAME TO match_reviews_fs_probe;" >/dev/null
F_DUMP="$(schema_dump)"
F_APPLY="$(apply_target 2>&1)"
F_EXIT=$?
check F "F4 ganze Datei ohne match_reviews: Abbruch 'Voraussetzungen fehlen', append_match_events unveraendert (Schema identisch)" \
  "abbruch|1|identisch" \
  "$([[ "$F_EXIT" -ne 0 ]] && echo abbruch || echo "exit $F_EXIT")|$(grep -c 'Voraussetzungen fehlen' <<<"$F_APPLY")|$([[ "$(schema_dump)" == "$F_DUMP" ]] && echo identisch || echo verschieden)"
q "ALTER TABLE public.match_reviews_fs_probe RENAME TO match_reviews;" >/dev/null

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
MD5_BEFORE="$(q "SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)');")"
check S "md5 vorher = Fassung 20261117_005 (Soll der lesenden Vorpruefung live)" "c01362f8ce15bf9a76847371e657e29f" "$MD5_BEFORE"
echo "Migration einspielen..." >&2
apply_target >/dev/null || { echo "::error::$TARGET_NAME scheitert" >&2; exit 1; }
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in tables columns functions triggers policies indexes rls_tables; do
  check S "Katalogzaehlung $dim: Zuwachs 0" "0" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
check S "Diff-Waechter: append_match_events = 20261117_005 + nur hinzugefuegte Zeilen (entfernt 0, hinzugefuegt > 0)" "0|ja" \
  "$(diff <(fn_block "$BASE_FILE" "$APPEND_HEAD") <(fn_block "$TARGET_FILE" "$APPEND_HEAD") | grep -c '^<' || true)|$([[ "$(diff <(fn_block "$BASE_FILE" "$APPEND_HEAD") <(fn_block "$TARGET_FILE" "$APPEND_HEAD") | grep -c '^>' || true)" -gt 0 ]] && echo ja || echo nein)"
check S "Rechte von append_match_events unveraendert (authenticated ja, anon nein), SECURITY DEFINER, search_path fest" 'true|false|true|{"search_path=public, pg_temp"}' \
  "$(q "SELECT has_function_privilege('authenticated', p.oid, 'EXECUTE') || '|' || has_function_privilege('anon', p.oid, 'EXECUTE') || '|' || p.prosecdef || '|' || p.proconfig::text FROM pg_proc p WHERE p.oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)');")"
echo "md5(prosrc) nachher (Soll fuer Produktion):"
q "SELECT '    public.append_match_events ' || md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)');"

run_probes
run_assertions

# --- W: idempotent -----------------------------------------------------------------------------------------------
STATE_SQL="SELECT (SELECT count(*) FROM public.match_events) || '|' || (SELECT count(*) FROM public.match_reviews) || '|' || (SELECT string_agg(coalesce(match_status, '-'), ',' ORDER BY id) FROM public.matches);"
STATE_W="$(q "$STATE_SQL")"
apply_target >/dev/null 2>&1
check W "zweites Einspielen laeuft (Exit 0)" "0" "$?"
check W "danach Daten und Schema unveraendert" "$STATE_W|identisch" "$(q "$STATE_SQL")|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg --------------------------------------------------------------------------------------------------
check X "Rueckweg-Datei im Repo = Ausgabe von --print-rueckweg" "identisch" \
  "$(diff -q <(rueckweg_sql) "$ROLLBACK_FILE" >/dev/null 2>&1 && echo identisch || echo verschieden)"
rueckweg_sql | psql_stdin >/dev/null 2>"$WORK_DIR/rueckweg.err"
check X "Rueckweg laeuft (Exit 0)" "0|" "$?|$(head -c 200 "$WORK_DIR/rueckweg.err")"
check X "nach dem Rueckweg: Schema public + match_engine = vor der Migration (pg_dump identisch), md5 = 20261117_005" "identisch|$MD5_BEFORE" \
  "$([[ "$(schema_dump)" == "$DUMP_BEFORE" ]] && echo identisch || { diff <(echo "$DUMP_BEFORE") <(schema_dump) | head -20 >&2; echo verschieden; })|$(q "SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)');")"
check X "nach dem Rueckweg: Daten unveraendert (Klaerungseintraege bleiben)" "$STATE_W" "$(q "$STATE_SQL")"
check X "Rueckweg ein zweites Mal -> Abbruch durch den Waechter, nichts geaendert" "1|identisch" \
  "$(rueckweg_sql | psql_value 2>&1 | grep -c 'nicht in der Fassung 20261118_009')|$([[ "$(schema_dump)" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
end="$(end_match x1 20 300)"
out="$(reopen "$U_TOM" "$D_TOM" x1 "$end")"
check X "nach dem Rueckweg: spaetes Fortsetzen (5 Minuten) wird wieder angewendet (Verhalten 20261117_005)" "accepted|running" \
  "$(results "$out")|$(state_of "$out" | cut -d'|' -f1)"
apply_target >/dev/null 2>&1
check X "danach erneut einspielbar (Exit 0, Schema = erstes Einspielen)" "0|identisch" "$?|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f" >/dev/null || { check S "spaetere Migration laeuft: $(basename "$f")" "0" "1"; continue; }
  echo "OK    spaetere Migration laeuft: $(basename "$f")" >&2
done

echo
summary
if [[ "$(total_dev)" -gt 0 ]]; then
  echo "::error::$(total_dev) Abweichung(en):$FAILED"
  exit 1
fi
echo "Alle Pruefungen ohne Abweichung."
exit 0
