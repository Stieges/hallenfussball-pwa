#!/usr/bin/env bash
#
# monitor-heartbeat-check.sh — Container-Beweis fuer supabase/migrations/20261113_101_monitor_heartbeat_wake_lock.sql
# (B-48b, brief-B-48.md § 2.3 und Schritt 3; Befund C-HEARTBEAT). Muster: scripts/coadmin-einsatz-check.sh
# (Wegwerf-Container supabase/postgres, --platform linux/amd64, Baseline + Migrationen seit Baseline, trap).
#
# Testwerte aus dem Gherkin (@ME-026, @ME-027, @ME-064, @ME-070): Turnierleitung Olli (Eigentuemer), Co-Admin Maria,
# Helfer Tom (Geraetesitzung, Rolle helper), Hallen-Rechner (Geraetesitzung, Rolle screen), Lea (anonyme Sitzung ohne
# Rolle), Greta (Konto, nicht eingetragen), Mama Petra (anon, ohne Sitzung). Turniere: "Hallencup Nord" (privat,
# Monitor "Hallenmonitor Halle" = mon-halle), "Hallencup Sued" (oeffentlich, mon-abc), seine "Kopie fuers Proben"
# (oeffentlich, dieselbe Kennung mon-abc), "Altturnier" (oeffentlich, im Papierkorb, mon-alt), "Leeres Turnier"
# (oeffentlich, ohne Monitore). Bestand: ein Lebenszeichen im alten Format (Monitor-UUID aus der Tabelle monitors).
#
# Kategorien:
#   F  Fail-fast: die Migration auf der Baseline allein (ohne has_tournament_permission) bricht ab und aendert nichts.
#   R  Szenario-Zeilen: Monitor sendet -> Zeile kommt an (mit wake_lock), zweiter Aufruf aktualisiert dieselbe Zeile,
#      Pruefung gegen config.monitors, Sichtbarkeit (oeffentlich: alle; privat: nur mit Recht), Gegenbeispiele (fremde
#      Kennung, fremdes/geloeschtes Turnier, wake_lock 'maybe', Kennung leer/zu lang, direkter Tabellenzugriff), Lesen
#      danach (Eigentuemer und Co-Admin ja, Helfer/Bildschirm/Fremde/anon nein).
#   S  Schema: Bestandszeilen erhalten, Katalogzaehlung (+1 Spalte), Funktion (Signatur, SECURITY DEFINER, search_path,
#      EXECUTE nur anon/authenticated), Pruefregeln, Primaerschluessel, Policies und Realtime-Publikation unveraendert,
#      Rechte-Assertion (vorher die 2 neuen |f, nachher alle |t), Namensliste = db-drift-check.sh.
#   W  zweites Einspielen: Exit 0, Schema und Daten wie nach dem ersten.
#   X  Rueckweg (Anhang B): Schema public = vor der Migration (pg_dump identisch), Bestandszeile bleibt, Zeilen mit
#      Kennung 'mon-…' entfallen, alte Funktion laeuft wieder; danach erneut einspielbar.
#
# Aufrufoptionen:
#   bash scripts/monitor-heartbeat-check.sh                     normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/monitor-heartbeat-check.sh --without-migration  Gegenprobe: ohne die Migration -> R ROT (Exit 0)
#   bash scripts/monitor-heartbeat-check.sh --gegenprobe         je Lauf eine Mutation (M1-M9); Exit 0 NUR, wenn JEDE rot
#                                                               faerbt (GEGENPROBE_NUR="M1 M3" schraenkt ein)
#   bash scripts/monitor-heartbeat-check.sh --print-rueckweg     Rueckweg (Anhang B) ausgeben, ohne Container
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container
# (--platform linux/amd64), wird am Ende entfernt (trap). Harness-Anpassungen nur im Container: die alte Funktion
# bekommt die Live-Rechte aus 20260716_001 (REVOKE PUBLIC, GRANT anon/authenticated; die Baseline enthaelt keine
# GRANTs), damit der Rueckweg gegen den Live-Stand und nicht gegen die Standard-ACL des Images gemessen wird.
#
set -euo pipefail

MODE="normal"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --without-migration) MODE="without-migration"; shift ;;
    --gegenprobe) MODE="gegenprobe"; shift ;;
    --print-rueckweg) MODE="print-rueckweg"; shift ;;
    *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe, --print-rueckweg)" >&2; exit 2 ;;
  esac
done

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie coadmin-einsatz-check.sh
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261113_101_monitor_heartbeat_wake_lock.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
CONTAINER_PREFIX="monitor-heartbeat-check-$$"
CURRENT_CONTAINER=""
NEW_ASSERTIONS_RE='^monitor-heartbeat-'

# Rueckweg (Anhang B): alte Funktion woertlich aus der Baseline (Live-Fassung), Tabelle zurueck auf den Baseline-Stand.
rueckweg_sql() {
  echo "-- Rueckweg B-48b (20261113_101_monitor_heartbeat_wake_lock.sql), erzeugt von scripts/monitor-heartbeat-check.sh --print-rueckweg"
  echo "-- Vorher: nichts an der App. Sie sendet dann wieder ins Leere (Zustand Befund C-HEARTBEAT, einmal je Seitenaufruf"
  echo "-- captureFeatureError), am Monitor ist nichts sichtbar."
  echo "-- ACHTUNG (Daniels Freigabe): loescht alle Lebenszeichen, deren Kennung kein monitors-Eintrag desselben Turniers ist"
  echo "-- (also alle Kennungen 'mon-…'). Das alte Schema (monitor_id uuid, FK auf monitors) kann sie nicht tragen."
  echo "BEGIN;"
  echo "SET LOCAL lock_timeout = '5s';"
  echo "DROP FUNCTION IF EXISTS public.record_monitor_heartbeat(text, uuid, integer, text, text, text);"
  echo "-- record_monitor_heartbeat woertlich aus 00000000000000_baseline_live_schema.sql, Rechte wie 20260716_001"
  awk 'index($0, "CREATE OR REPLACE FUNCTION \"public\".\"record_monitor_heartbeat\"(") == 1 {f=1} f{print} f && $0=="$$;"{exit}' "$BASELINE_FILE"
  echo "REVOKE ALL ON FUNCTION public.record_monitor_heartbeat(uuid, uuid, integer, text, text) FROM PUBLIC;"
  echo "GRANT EXECUTE ON FUNCTION public.record_monitor_heartbeat(uuid, uuid, integer, text, text) TO anon, authenticated;"
  echo "ALTER TABLE public.monitor_heartbeats DROP CONSTRAINT IF EXISTS monitor_heartbeats_wake_lock_check;"
  echo "ALTER TABLE public.monitor_heartbeats DROP COLUMN IF EXISTS wake_lock;"
  echo "ALTER TABLE public.monitor_heartbeats DROP CONSTRAINT IF EXISTS monitor_heartbeats_monitor_key_form;"
  echo "DELETE FROM public.monitor_heartbeats h"
  echo " WHERE NOT EXISTS (SELECT 1 FROM public.monitors m WHERE m.id::text = h.monitor_id AND m.tournament_id = h.tournament_id);"
  echo "ALTER TABLE public.monitor_heartbeats DROP CONSTRAINT IF EXISTS monitor_heartbeats_pkey;"
  echo "ALTER TABLE public.monitor_heartbeats ALTER COLUMN monitor_id TYPE uuid USING monitor_id::uuid;"
  echo "ALTER TABLE ONLY public.monitor_heartbeats ADD CONSTRAINT monitor_heartbeats_pkey PRIMARY KEY (monitor_id);"
  echo "ALTER TABLE ONLY public.monitor_heartbeats ADD CONSTRAINT monitor_heartbeats_monitor_id_fkey"
  echo "  FOREIGN KEY (monitor_id) REFERENCES public.monitors(id) ON DELETE CASCADE;"
  echo "COMMIT;"
}
if [[ "$MODE" == "print-rueckweg" ]]; then
  rueckweg_sql
  exit 0
fi

[[ -f "$TARGET_FILE" ]] || { echo "::error::$TARGET_NAME fehlt." >&2; exit 1; }

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
NEWER_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
BEFORE=()   # alles vor der Ziel-Migration
AFTER=()    # alles danach
SEEN_TARGET=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if [[ "$(basename "$line")" == "$TARGET_NAME" ]]; then
    SEEN_TARGET=1
  elif [[ "$SEEN_TARGET" -eq 1 ]]; then
    AFTER+=("$line")
  else
    BEFORE+=("$line")
  fi
done <<< "$NEWER_RAW"
[[ "$SEEN_TARGET" -eq 1 ]] || { echo "::error::$TARGET_NAME nicht in der Liste 'neuer als Baseline'." >&2; exit 1; }

# bash 3.2 (macOS) endet bei "unbound variable" trotz set -e mit Exit 0, wenn ein EXIT-Trap gesetzt ist -- ein Abbruch
# vor dem Ende zaehlt deshalb ausdruecklich als Fehler (FERTIG wird erst bei der Schlusswertung gesetzt).
FERTIG=0
cleanup() {
  local rc=$?
  [[ -n "$CURRENT_CONTAINER" ]] && docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1
  if [[ "$FERTIG" != 1 && "$rc" -eq 0 ]]; then echo "::error::Lauf vor der Schlusswertung abgebrochen." >&2; rc=1; fi
  exit "$rc"
}
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
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }

# Zaehler je Kategorie (bash 3.2: keine assoziativen Arrays).
CATS=(F R S W X)
DEVS=(0 0 0 0 0)
OKS=(0 0 0 0 0)
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
reset_counts() { DEVS=(0 0 0 0 0); OKS=(0 0 0 0 0); }
summary() {
  local i
  echo
  for i in "${!CATS[@]}"; do echo "Kategorie ${CATS[$i]}: ${OKS[$i]} OK, ${DEVS[$i]} Abweichung(en)"; done
}

uuid_for() {
  local h
  h="$(printf '%s' "monitor-heartbeat-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_GRETA="$(uuid_for user:greta)"
U_TOM="$(uuid_for user:tom)"; U_SCREEN="$(uuid_for user:hallen-rechner)"; U_LEA="$(uuid_for user:lea)"
ANON_UIDS=" $U_TOM $U_SCREEN $U_LEA "
T_NORD="$(uuid_for tournament:hallencup-nord)"; T_SUED="$(uuid_for tournament:hallencup-sued)"
T_KOPIE="$(uuid_for tournament:hallencup-sued-kopie)"; T_ALT="$(uuid_for tournament:altturnier)"
T_LEER="$(uuid_for tournament:leeres-turnier)"
MON_LEGACY="$(uuid_for monitor:alt-format)"
C_MARIA="$(uuid_for membership:maria)"
K_NORD="mon-halle"; K_SUED="mon-abc"; K_ALT="mon-alt"
UA_BROWSER="Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36"
UA_OBS="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/127.0 Safari/537.36 OBS/31.0.0"

is_anon() { [[ "$ANON_UIDS" == *" $1 "* ]] && echo true || echo false; }
claims_sql() { # Sitzung wie PostgREST: claim.sub + claims mit is_anonymous
  [[ -z "$1" ]] && return 0
  echo "SET LOCAL request.jwt.claim.sub = '$1'; SET LOCAL request.jwt.claims = '{\"sub\":\"$1\",\"role\":\"authenticated\",\"is_anonymous\":$(is_anon "$1")}';"
}
as_role() { # SQL-Zeilen, um innerhalb einer Probe die Identitaet zu wechseln (<uid|leer=anon>)
  local role="authenticated"
  [[ -z "$1" ]] && role="anon"
  echo "RESET ROLE; SET LOCAL ROLE $role; SET LOCAL request.jwt.claim.sub = ''; SET LOCAL request.jwt.claims = ''; $(claims_sql "$1")"
}
# probe <uid|leer(=anon)> <vorbereitung> <aktion (Zeilen "r:...")> <pruef-SQL> -> "<ergebnis>|<pruefwert>"
# Eine nie committete Transaktion; Pruefwert als Superuser nach der Aktion. Fehler als "fehler:<SQLSTATE>: <Text>".
probe() {
  local uid="$1" setup="$2" action="$3" check_sql="$4" role="authenticated" out res msg chk
  [[ -z "$uid" ]] && role="anon"
  set +e
  out="$(docker exec -i "$CURRENT_CONTAINER" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 <<SQL 2>&1
\\set VERBOSITY verbose
BEGIN;
$setup
SET LOCAL ROLE $role;
$(claims_sql "$uid")
SAVEPOINT aktion;
$action
\\if :ERROR
ROLLBACK TO SAVEPOINT aktion;
\\endif
RESET ROLE;
SELECT 'p:' || coalesce(($check_sql)::text, 'NULL');
ROLLBACK;
SQL
)"
  set -e
  res="$( (grep '^r:' <<<"$out" || true) | cut -c3- | paste -sd, -)"
  msg="$( (grep -m1 'ERROR:' <<<"$out" || true) | sed 's/^.*ERROR: *//')"
  chk="$( (grep -m1 '^p:' <<<"$out" || true) | cut -c3-)"
  [[ -n "$msg" ]] && res="fehler:$msg"
  echo "${res:-?}|${chk:-?}"
}
# als <uid|leer> <sql>: eine committete Transaktion als Client -> "r:"-Zeilen (Komma) oder "fehler:<SQLSTATE>: <text>"
als() {
  local uid="$1" sql="$2" role="authenticated" out msg
  [[ -z "$uid" ]] && role="anon"
  set +e
  out="$(docker exec -i "$CURRENT_CONTAINER" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
\\set VERBOSITY verbose
BEGIN;
SET LOCAL ROLE $role;
$(claims_sql "$uid")
$sql
COMMIT;
SQL
)"
  set -e
  msg="$( (grep -m1 'ERROR:' <<<"$out" || true) | sed 's/^.*ERROR: *//')"
  if [[ -n "$msg" ]]; then echo "fehler:$msg"; else (grep '^r:' <<<"$out" || true) | cut -c3- | paste -sd, -; fi
}

lit() { [[ "$1" == "NULL" ]] && echo "NULL" || echo "'$1'"; }
# SEND <turnier> <kennung> [wake_lock|NULL] [user_agent]: Aufruf wie useMonitorHeartbeat (Kennung als Text)
SEND() {
  echo "SELECT 'r:ok' FROM (SELECT public.record_monitor_heartbeat($(lit "$2"), '$1', 3, 'fresh', '${4:-$UA_BROWSER}', $(lit "${3:-granted}"))) AS x;"
}
# ROW <turnier> <kennung>: Zeilen und wake_lock (als Superuser)
ROW() { echo "SELECT count(*) || '|' || coalesce(max(wake_lock), 'NULL') FROM public.monitor_heartbeats WHERE tournament_id = '$1' AND monitor_id = '$2'"; }
READ_HB() { echo "SELECT 'r:' || coalesce(string_agg(monitor_id || '=' || coalesce(wake_lock, 'NULL'), ';' ORDER BY monitor_id), '0') FROM public.monitor_heartbeats WHERE tournament_id = '$1';"; }
REVOKED="DELETE FROM public.tournament_collaborators WHERE id = '$C_MARIA';
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at, declined_at, label)
VALUES ('$C_MARIA', '$T_NORD', '$U_MARIA', 'co-admin', now(), now(), 'Maria');"
DENIED="42501: monitor/tournament mismatch or not visible"

# Urteile (Ergebnis UND Zeile danach)
v_send() { # <probe> <erwarteter wake_lock-Wert>
  local r="${1%%|*}" c="${1#*|}"
  if [[ "$r" == "ok" && "$c" == "1|$2" ]]; then echo gelingt
  elif [[ "$r" == "fehler:$DENIED" && "$c" == "0|NULL" ]]; then echo abgelehnt; else echo "anders($1)"; fi; }
v_code() { # <probe> -> SQLSTATE bei Fehler und Zeilen danach, "ok|<pruef>" sonst
  local r="${1%%|*}" c="${1#*|}"
  if [[ "$r" == fehler:* ]]; then echo "$(cut -d: -f2 <<<"$r" | tr -d ' ')|$c"; else echo "$r|$c"; fi; }
v_read() { local r="${1%%|*}"; [[ "$r" == fehler:42501:\ permission\ denied* ]] && r=0; echo "$r"; }

setup_data() {
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       CASE WHEN u.email IS NULL THEN '{"provider":"anonymous","providers":["anonymous"]}'::jsonb
            ELSE '{"provider":"email","providers":["email"]}'::jsonb END, '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@b48b.test'), ('$U_MARIA'::uuid, 'maria@b48b.test'), ('$U_GRETA'::uuid, 'greta@b48b.test'),
             ('$U_TOM'::uuid, NULL), ('$U_SCREEN'::uuid, NULL), ('$U_LEA'::uuid, NULL)) AS u(id, email);
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, is_public, config, deleted_at) VALUES
  ('$T_NORD', '$U_OLLI', 'Hallencup Nord', '2026-11-28', 4, 10, false,
   '{"publishedAt":"2026-10-20T00:00:00.000Z","monitors":[{"id":"$K_NORD","name":"Hallenmonitor Halle"}]}'::jsonb, NULL),
  ('$T_SUED', '$U_OLLI', 'Hallencup Sued', '2026-11-29', 4, 10, true,
   '{"publishedAt":"2026-10-20T00:00:00.000Z","monitors":[{"id":"$K_SUED","name":"Hallenmonitor Sued"},{"id":"mon-xyz","name":"Kabine"}]}'::jsonb, NULL),
  ('$T_KOPIE', '$U_OLLI', 'Hallencup Sued (Kopie fuers Proben)', '2026-11-29', 4, 10, true,
   '{"publishedAt":"2026-10-20T00:00:00.000Z","monitors":[{"id":"$K_SUED","name":"Hallenmonitor Sued"}]}'::jsonb, NULL),
  ('$T_ALT', '$U_OLLI', 'Altturnier', '2026-01-10', 4, 10, true,
   '{"publishedAt":"2026-01-01T00:00:00.000Z","monitors":[{"id":"$K_ALT","name":"Alt"}]}'::jsonb, now()),
  ('$T_LEER', '$U_OLLI', 'Leeres Turnier', '2026-12-01', 4, 10, true,
   '{"publishedAt":"2026-10-20T00:00:00.000Z","monitors":{"id":"$K_SUED"}}'::jsonb, NULL);
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at, label) VALUES
  ('$C_MARIA', '$T_NORD', '$U_MARIA', 'co-admin', now(), 'Maria'),
  ('$(uuid_for membership:tom)', '$T_NORD', '$U_TOM', 'helper', now(), 'Tom'),
  ('$(uuid_for membership:screen)', '$T_NORD', '$U_SCREEN', 'screen', now(), 'Hallen-Rechner');
-- Bestand im alten Format: Monitor-UUID aus der Tabelle monitors (vor C-HEARTBEAT der einzige Weg)
INSERT INTO public.monitors (id, tournament_id, name) VALUES ('$MON_LEGACY', '$T_NORD', 'Alter Monitor');
INSERT INTO public.monitor_heartbeats (monitor_id, tournament_id, last_seen, slide_index, cache_status, user_agent)
VALUES ('$MON_LEGACY', '$T_NORD', '2026-07-16 10:00:00+00', 2, 'fresh', 'alt-format');
-- Harness: Live-Rechte der alten Funktion (20260716_001), die Baseline traegt keine GRANTs
REVOKE ALL ON FUNCTION public.record_monitor_heartbeat(uuid, uuid, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_monitor_heartbeat(uuid, uuid, integer, text, text) TO anon, authenticated;
SQL
}

# ---------------------------------------------------------------------------------------------------------
# R: Szenario-Zeilen (gemeinsam fuer normalen Lauf, ohne Migration und Gegenprobe)
run_probes() {
  local who name uid exp w
  # @ME-064 Datenteil: der Monitor des oeffentlichen Turniers sendet seinen Zustand, die Zeile traegt ihn.
  for w in granted denied no_answer released not_applicable NULL; do
    check R "@ME-064 Monitor „${K_SUED}“ (oeffentlich, Mama Petra ohne Sitzung) meldet wake_lock=$w -> Zeile mit diesem Wert" "gelingt" \
      "$(v_send "$(probe "" "" "$(SEND "$T_SUED" "$K_SUED" "$w")" "$(ROW "$T_SUED" "$K_SUED")")" "$w")"
  done
  # @ME-027 / @ME-064: zweiter Aufruf aktualisiert dieselbe Zeile (zuletzt gesehen, Zustand, Folie)
  check R "@ME-027 zweiter Aufruf aktualisiert dieselbe Zeile: 1 Zeile, last_seen jetzt, wake_lock released, Folie 3" "ok|1|frisch|released|3|fresh" \
    "$(v_code "$(probe "" \
      "INSERT INTO public.monitor_heartbeats (monitor_id, tournament_id, last_seen, slide_index, cache_status, wake_lock)
       VALUES ('$K_SUED', '$T_SUED', now() - interval '8 minutes', 0, 'stale', 'granted');" \
      "$(SEND "$T_SUED" "$K_SUED" released)" \
      "SELECT count(*) || '|' || CASE WHEN max(last_seen) = now() THEN 'frisch' ELSE 'alt' END || '|' || max(wake_lock) || '|' || max(slide_index) || '|' || max(cache_status) FROM public.monitor_heartbeats WHERE tournament_id = '$T_SUED' AND monitor_id = '$K_SUED'")")"
  check R "@ME-027 ohne neuen Aufruf bleibt „zuletzt gesehen“ stehen (Bestandszeile alt-format unveraendert)" "2026-07-16 10:00:00+00" \
    "$(q "SELECT last_seen AT TIME ZONE 'UTC' || '+00' FROM public.monitor_heartbeats WHERE monitor_id = '$MON_LEGACY'::text;" | sed 's/^\(....-..-.. ..:..:..\).*+00$/\1+00/')"
  # @ME-026 Datenteil: Browser-Quelle meldet sich (verbunden), Wachhalten entfaellt
  check R "@ME-026 Browser-Quelle (OBS) meldet sich mit not_applicable -> Zeile, Kennung des Geraets mitgespeichert" "ok|1|not_applicable|OBS" \
    "$(v_code "$(probe "" "" "$(SEND "$T_SUED" "$K_SUED" not_applicable "$UA_OBS")" \
      "SELECT count(*) || '|' || max(wake_lock) || '|' || CASE WHEN max(user_agent) LIKE '%OBS/%' THEN 'OBS' ELSE 'kein OBS' END FROM public.monitor_heartbeats WHERE tournament_id = '$T_SUED' AND monitor_id = '$K_SUED'")")"
  check R "user_agent wird auf 500 Zeichen gekuerzt" "ok|500" \
    "$(v_code "$(probe "" "" "$(SEND "$T_SUED" "$K_SUED" granted "$(printf 'x%.0s' $(seq 1 600))")" \
      "SELECT max(char_length(user_agent)) FROM public.monitor_heartbeats WHERE tournament_id = '$T_SUED' AND monitor_id = '$K_SUED'")")"

  # Oeffentliches Turnier: jede Identitaet darf senden (Restrisiko wie bisher, B-20 sichert ab)
  for who in "Olli:$U_OLLI" "Maria:$U_MARIA" "Tom:$U_TOM" "Hallen-Rechner:$U_SCREEN" "Lea:$U_LEA" "Greta:$U_GRETA" "Mama Petra (anon):"; do
    IFS=: read -r name uid <<<"$who"
    check R "@ME-064 oeffentliches Turnier: $name sendet fuer „${K_SUED}“" "gelingt" \
      "$(v_send "$(probe "$uid" "" "$(SEND "$T_SUED" "$K_SUED" granted)" "$(ROW "$T_SUED" "$K_SUED")")" granted)"
  done
  # Privates Turnier: nur mit Recht tournamentSettings (Eigentuemer mit Konto, Co-Admin)
  for who in "Olli:$U_OLLI:gelingt" "Maria:$U_MARIA:gelingt" "Tom:$U_TOM:abgelehnt" "Hallen-Rechner (bis B-20):$U_SCREEN:abgelehnt" \
             "Lea:$U_LEA:abgelehnt" "Greta:$U_GRETA:abgelehnt" "Mama Petra (anon)::abgelehnt"; do
    IFS=: read -r name uid exp <<<"$who"
    check R "@ME-064 privates Turnier „Hallencup Nord“: $name sendet fuer „${K_NORD}“" "$exp" \
      "$(v_send "$(probe "$uid" "" "$(SEND "$T_NORD" "$K_NORD" no_answer)" "$(ROW "$T_NORD" "$K_NORD")")" no_answer)"
  done
  check R "gegen-widerrufen: Maria sendet nach dem Widerruf nicht mehr (privat)" "abgelehnt" \
    "$(v_send "$(probe "$U_MARIA" "$REVOKED" "$(SEND "$T_NORD" "$K_NORD" granted)" "$(ROW "$T_NORD" "$K_NORD")")" granted)"
  # Pruefung gegen config.monitors
  check R "gegen-fremde-Kennung: „${K_NORD}“ (Nord) im oeffentlichen „Hallencup Sued“ -> 42501, keine Zeile" "abgelehnt" \
    "$(v_send "$(probe "" "" "$(SEND "$T_SUED" "$K_NORD" granted)" "$(ROW "$T_SUED" "$K_NORD")")" granted)"
  check R "gegen-fremdes-Turnier: Olli sendet „${K_SUED}“ fuer sein Turnier Nord (dort gibt es die Kennung nicht) -> 42501" "abgelehnt" \
    "$(v_send "$(probe "$U_OLLI" "" "$(SEND "$T_NORD" "$K_SUED" granted)" "$(ROW "$T_NORD" "$K_SUED")")" granted)"
  check R "gegen-alte-UUID: Monitor-UUID aus der Tabelle monitors (nicht in config) -> 42501, Bestandszeile nicht aufgefrischt" "abgelehnt" \
    "$(v_send "$(probe "$U_OLLI" "" "$(SEND "$T_NORD" "$MON_LEGACY" granted)" "SELECT count(*) FILTER (WHERE last_seen = now()) || '|' || coalesce(max(wake_lock), 'NULL') FROM public.monitor_heartbeats WHERE monitor_id = '$MON_LEGACY'::text")" granted)"
  check R "gegen-Turnier-ohne-Monitore (config.monitors kein Array) -> 42501" "abgelehnt" \
    "$(v_send "$(probe "" "" "$(SEND "$T_LEER" "$K_SUED" granted)" "$(ROW "$T_LEER" "$K_SUED")")" granted)"
  check R "gegen-geloeschtes Turnier (Papierkorb, oeffentlich): auch Olli -> 42501" "abgelehnt" \
    "$(v_send "$(probe "$U_OLLI" "" "$(SEND "$T_ALT" "$K_ALT" granted)" "$(ROW "$T_ALT" "$K_ALT")")" granted)"
  check R "gegen-unbekanntes Turnier -> 42501" "abgelehnt" \
    "$(v_send "$(probe "" "" "$(SEND "$(uuid_for tournament:gibt-es-nicht)" "$K_SUED" granted)" "$(ROW "$(uuid_for tournament:gibt-es-nicht)" "$K_SUED")")" granted)"
  # Werte
  check R "gegen-wake_lock 'maybe' -> 23514, keine Zeile" "23514|0|NULL" \
    "$(v_code "$(probe "" "" "$(SEND "$T_SUED" "$K_SUED" maybe)" "$(ROW "$T_SUED" "$K_SUED")")")"
  check R "gegen-cache_status 'online' (Altfehler Juli) -> 23514, keine Zeile" "23514|0|NULL" \
    "$(v_code "$(probe "" "" "SELECT 'r:ok' FROM (SELECT public.record_monitor_heartbeat('$K_SUED', '$T_SUED', 0, 'online', 'x', 'granted')) AS x;" "$(ROW "$T_SUED" "$K_SUED")")")"
  check R "gegen-leere Kennung -> 22023" "22023|0" \
    "$(v_code "$(probe "" "" "$(SEND "$T_SUED" "" granted)" "SELECT count(*) FROM public.monitor_heartbeats WHERE tournament_id = '$T_SUED'")")"
  check R "gegen-Kennung NULL -> 22023" "22023|0" \
    "$(v_code "$(probe "" "" "$(SEND "$T_SUED" NULL granted)" "SELECT count(*) FROM public.monitor_heartbeats WHERE tournament_id = '$T_SUED'")")"
  check R "gegen-Kennung mit 101 Zeichen -> 22023" "22023|0" \
    "$(v_code "$(probe "" "" "$(SEND "$T_SUED" "mon-$(printf 'a%.0s' $(seq 1 97))" granted)" "SELECT count(*) FROM public.monitor_heartbeats WHERE tournament_id = '$T_SUED'")")"
  # Kopie fuers Proben: dieselbe Kennung in zwei Turnieren -> zwei Zeilen (Schluessel je Turnier)
  check R "Kopie fuers Proben: „${K_SUED}“ sendet in Original und Kopie -> je eine Zeile" "ok,ok|2" \
    "$(probe "" "" "$(SEND "$T_SUED" "$K_SUED" granted)
$(SEND "$T_KOPIE" "$K_SUED" denied)" "SELECT count(*) FROM public.monitor_heartbeats WHERE monitor_id = '$K_SUED'")"
  # Direkt an der Funktion vorbei: kein Schreibweg
  check R "gegen-direkt: Olli schreibt ohne Funktion in monitor_heartbeats -> 42501, keine Zeile" "42501|0|NULL" \
    "$(v_code "$(probe "$U_OLLI" "" "INSERT INTO public.monitor_heartbeats (monitor_id, tournament_id, wake_lock) VALUES ('$K_NORD', '$T_NORD', 'granted');" "$(ROW "$T_NORD" "$K_NORD")")")"
  check R "gegen-direkt: Mama Petra (anon) schreibt ohne Funktion -> 42501, keine Zeile" "42501|0|NULL" \
    "$(v_code "$(probe "" "" "INSERT INTO public.monitor_heartbeats (monitor_id, tournament_id, wake_lock) VALUES ('$K_SUED', '$T_SUED', 'granted');" "$(ROW "$T_SUED" "$K_SUED")")")"

  # Monitor sendet -> Verwaltung liest (@ME-064 Datenteil, @ME-070): Olli sendet vom Hallen-Rechner (sein Konto)
  # Die Bestandszeile im alten Format (wake_lock unbekannt) steht im selben Turnier und gehoert mit zur Antwort.
  for who in "Olli:$U_OLLI:$MON_LEGACY=NULL;$K_NORD=no_answer" "Maria:$U_MARIA:$MON_LEGACY=NULL;$K_NORD=no_answer" "Tom:$U_TOM:0" "Hallen-Rechner:$U_SCREEN:0" \
             "Greta:$U_GRETA:0" "Mama Petra (anon)::0"; do
    IFS=: read -r name uid exp <<<"$who"
    check R "@ME-070 nach dem Senden liest $name im „Hallencup Nord“" "$exp" \
      "$(v_read "$(probe "$U_OLLI" "" "$(SEND "$T_NORD" "$K_NORD" no_answer)
$(as_role "$uid")
$(READ_HB "$T_NORD")" "1")" | sed 's/^ok,//')"
  done
}

# ---------------------------------------------------------------------------------------------------------
run_assertions() { # <erwartet t|f fuer die 2 neuen B-48b-Zeilen>
  local priv names_sql names_sh want="$1"
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  check S "Rechte-Assertion: die 2 B-48b-Zeilen |$want" \
    "monitor-heartbeat-key-per-tournament-wake-lock|$want,monitor-heartbeat-rpc-checks-config-monitors|$want" \
    "$(grep -E "$NEW_ASSERTIONS_RE" <<<"$priv" | sort | paste -sd, -)"
  check S "Rechte-Assertion: keine andere Zeile |f" "" \
    "$(grep -v '|t$' <<<"$priv" | grep -vE "$NEW_ASSERTIONS_RE" || true)"
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
}
FN_STATE_SQL="SELECT string_agg(pg_get_function_identity_arguments(p.oid) || ':' || p.prosecdef || ':' || p.proconfig::text || ':' || has_function_privilege('anon', p.oid, 'EXECUTE') || ':' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || ':' || (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0))::text, ' # ') FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'record_monitor_heartbeat';"
CONSTRAINTS_SQL="SELECT string_agg(conname || '=' || pg_get_constraintdef(oid), ' # ' ORDER BY conname) FROM pg_constraint WHERE conrelid = 'public.monitor_heartbeats'::regclass;"
POLICIES_SQL="SELECT string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || coalesce(qual, ''), ' # ' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitor_heartbeats';"
PUB_SQL="SELECT (SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'monitor_heartbeats') || '|' || (SELECT relreplident::text FROM pg_class WHERE oid = 'public.monitor_heartbeats'::regclass);"
# md5 des Rumpfs (prosrc) direkt aus der Datei gerechnet -- Soll-Werte der Vorab-Pruefung/Pruefung nachher (Freigabe-Unterlage)
body_md5() { # body_md5 <datei> <Kopf-Anfang der Funktion>
  python3 -c 'import hashlib, sys
s = open(sys.argv[1]).read(); i = s.index(sys.argv[2]); j = s.index("AS $$", i) + 5; k = s.index("$$;", j)
print(hashlib.md5(s[j:k].encode()).hexdigest())' "$1" "$2"
}
SRC_MD5_SQL="SELECT string_agg(md5(p.prosrc), ',') FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'record_monitor_heartbeat';"
DATA_SQL="SELECT coalesce(string_agg(monitor_id::text || ':' || tournament_id || ':' || last_seen || ':' || coalesce(slide_index::text, '-') || ':' || coalesce(cache_status, '-') || ':' || coalesce(user_agent, '-'), ',' ORDER BY monitor_id::text), '') FROM public.monitor_heartbeats;"

apply_before() {
  local f
  echo "${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done
  setup_data
}

# ---------------------------------------------------------------------------------------------------------
if [[ "$MODE" == "gegenprobe" ]]; then
  MUTATIONS=(M1 M2 M3 M4 M5 M6 M7 M8 M9)
  if [[ -n "${GEGENPROBE_NUR:-}" ]]; then read -r -a MUTATIONS <<<"$GEGENPROBE_NUR"; fi
  RED_TOTAL=0
  for mut in "${MUTATIONS[@]}"; do
    start_container "$mut"
    psql_stdin < "$BASELINE_FILE"
    apply_before
    MUT_KEY="$mut" python3 -c '
import os, sys
s = sys.stdin.read()
M = {
  # M1 Pruefung gegen config.monitors weg (Brief-Mutation): fremde Kennung kommt durch
  "M1": [("          WHERE m.item ->> '\''id'\'' = p_monitor_key)\n", "          WHERE true)\n")],
  # M2 Papierkorb-Pruefung weg
  "M2": [("       AND t.deleted_at IS NULL\n", "       AND true\n")],
  # M3 Sichtbarkeit weg: privates Turnier ohne Recht
  "M3": [("       AND (t.is_public = true OR public.has_tournament_permission(t.id, '\''tournamentSettings'\''))\n", "       AND (true)\n")],
  # M4 Pruefregel wake_lock offen
  "M4": [("  CHECK (wake_lock IS NULL OR wake_lock IN ('\''granted'\'', '\''denied'\'', '\''no_answer'\'', '\''released'\'', '\''not_applicable'\'')) NOT VALID;\n", "  CHECK (true) NOT VALID;\n")],
  # M5 zweiter Aufruf frischt last_seen nicht auf (@ME-027)
  "M5": [("    last_seen    = now(),\n", "    last_seen    = monitor_heartbeats.last_seen,\n")],
  # M6 PUBLIC behaelt EXECUTE
  "M6": [("REVOKE ALL ON FUNCTION public.record_monitor_heartbeat(text, uuid, integer, text, text, text) FROM PUBLIC;\n", "")],
  # M7 SECURITY INVOKER statt DEFINER: RLS sperrt das Schreiben
  "M7": [("SECURITY DEFINER\n", "SECURITY INVOKER\n")],
  # M8 Schluessel nur monitor_id (Kopie fuers Proben kollidiert, ON CONFLICT passt nicht)
  "M8": [("PRIMARY KEY (tournament_id, monitor_id);\n", "PRIMARY KEY (monitor_id);\n"),
         ("  ON CONFLICT (tournament_id, monitor_id) DO UPDATE SET\n", "  ON CONFLICT (monitor_id) DO UPDATE SET\n")],
  # M9 Recht writeMatchData statt tournamentSettings: Helfer sendet im privaten Turnier
  "M9": [("public.has_tournament_permission(t.id, '\''tournamentSettings'\'')", "public.has_tournament_permission(t.id, '\''writeMatchData'\'')")],
}
for frm, to in M[os.environ["MUT_KEY"]]:
    if s.count(frm) != 1:
        sys.exit("Gegenprobe: Muster in %s nicht genau einmal (%d): %r" % (os.environ["MUT_KEY"], s.count(frm), frm[:60]))
    s = s.replace(frm, to)
sys.stdout.write(s)' < "$TARGET_FILE" | psql_stdin
    reset_counts
    echo "--- GEGENPROBE $mut ---"
    run_probes
    run_assertions t
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
  FERTIG=1
  [[ "$RED_TOTAL" -eq "${#MUTATIONS[@]}" ]]
  exit $?
fi

start_container "$MODE"
echo "Baseline einspielen..." >&2
psql_stdin < "$BASELINE_FILE"

if [[ "$MODE" == "without-migration" ]]; then
  apply_before
  run_probes
  summary
  R_DEV="${DEVS[$(cat_index R)]}"
  if [[ "$R_DEV" -gt 0 ]]; then
    echo "Ohne Migration: R rot ($R_DEV) -- Gegenprobe wie verlangt."
    FERTIG=1
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (R=$R_DEV muss > 0 sein)."
  FERTIG=1
  exit 1
fi

# --- F: Fail-fast (Baseline allein: has_tournament_permission fehlt) ----------------------------------------
DUMP_PRE="$(schema_dump)"
set +e; F_OUT="$(psql_stdin < "$TARGET_FILE" 2>&1)"; F_RC=$?; set -e
check F "Migration auf der Baseline allein: bricht ab mit Hinweis" "abbruch|ja" \
  "$([[ "$F_RC" -ne 0 ]] && echo abbruch || echo "lief($F_RC)")|$([[ "$F_OUT" == *"20261113_101_monitor_heartbeat_wake_lock: has_tournament_permission fehlt"* ]] && echo ja || echo "nein: $F_OUT")"
check F "Migration auf der Baseline allein: Schema unveraendert" "identisch" "$([[ "$(schema_dump)" == "$DUMP_PRE" ]] && echo identisch || echo verschieden)"

apply_before

# --- S vorher ---------------------------------------------------------------------------------------------
run_assertions f
DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
DATA_BEFORE="$(q "$DATA_SQL")"
POLICIES_BEFORE="$(q "$POLICIES_SQL")"
PUB_BEFORE="$(q "$PUB_SQL")"
FN_BEFORE="$(q "$FN_STATE_SQL")"
check S "vorher: alte Funktion mit Live-Rechten (uuid-Kennung, kein PUBLIC)" \
  "p_monitor_id uuid, p_tournament_id uuid, p_slide_index integer, p_cache_status text, p_user_agent text:true:{\"search_path=public, pg_temp\"}:true:true:false" "$FN_BEFORE"
check S "vorher: Rumpf der alten Funktion = Baseline (md5 aus der Datei gerechnet)" \
  "$(body_md5 "$BASELINE_FILE" 'CREATE OR REPLACE FUNCTION "public"."record_monitor_heartbeat"(')" "$(q "$SRC_MD5_SQL")"
echo "Ziel: $TARGET_NAME" >&2
psql_stdin < "$TARGET_FILE"
check S "nachher: Rumpf der neuen Funktion = Migrationsdatei (md5 aus der Datei gerechnet)" \
  "$(body_md5 "$TARGET_FILE" 'CREATE OR REPLACE FUNCTION public.record_monitor_heartbeat(')" "$(q "$SRC_MD5_SQL")"

# --- S nachher --------------------------------------------------------------------------------------------
check S "Bestand: Zeile im alten Format erhalten (Kennung als Text, alle Werte gleich)" "$DATA_BEFORE" "$(q "$DATA_SQL")"
check S "Bestand: wake_lock der Altzeile ist NULL (unbekannt)" "NULL" "$(q "SELECT coalesce(wake_lock, 'NULL') FROM public.monitor_heartbeats WHERE monitor_id = '$MON_LEGACY';")"
check S "Funktion: genau eine, Kennung als Text + p_wake_lock, SECURITY DEFINER, search_path, EXECUTE anon/authenticated, kein PUBLIC" \
  "p_monitor_key text, p_tournament_id uuid, p_slide_index integer, p_cache_status text, p_user_agent text, p_wake_lock text:true:{\"search_path=public, pg_temp\"}:true:true:false" \
  "$(q "$FN_STATE_SQL")"
check S "Pruefregeln und Schluessel: PK (tournament_id, monitor_id), kein FK auf monitors, Kennung 1-100, wake_lock-Werte, cache_status unveraendert" \
  "monitor_heartbeats_cache_status_check=CHECK ((cache_status = ANY (ARRAY['fresh'::text, 'stale'::text, 'critical'::text]))) # monitor_heartbeats_monitor_key_form=CHECK (((char_length(monitor_id) >= 1) AND (char_length(monitor_id) <= 100))) # monitor_heartbeats_pkey=PRIMARY KEY (tournament_id, monitor_id) # monitor_heartbeats_tournament_id_fkey=FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE # monitor_heartbeats_wake_lock_check=CHECK (((wake_lock IS NULL) OR (wake_lock = ANY (ARRAY['granted'::text, 'denied'::text, 'no_answer'::text, 'released'::text, 'not_applicable'::text]))))" \
  "$(q "$CONSTRAINTS_SQL")"
check S "Policies auf monitor_heartbeats unveraendert (heartbeats_select_v2 aus _004)" "$POLICIES_BEFORE" "$(q "$POLICIES_SQL")"
check S "Policies: genau heartbeats_select_v2 (SELECT, authenticated, manageScreens)" "ja" \
  "$([[ "$(q "$POLICIES_SQL")" == "heartbeats_select_v2|SELECT|{authenticated}|has_tournament_permission(tournament_id, 'manageScreens'::text)" ]] && echo ja || echo "nein: $(q "$POLICIES_SQL")")"
check S "Realtime-Publikation und Replica-Identitaet (Standard = Primaerschluessel) unveraendert" "$PUB_BEFORE" "$(q "$PUB_SQL")"
check S "Realtime: Tabelle in supabase_realtime, Replica-Identitaet d" "1|d" "$(q "$PUB_SQL")"
check S "Kommentar an wake_lock (sagt nicht, ob der Fernseher an ist)" "ja" \
  "$([[ "$(q "SELECT col_description('public.monitor_heartbeats'::regclass, (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.monitor_heartbeats'::regclass AND attname = 'wake_lock'));")" == *"Sagt nicht, ob der Fernseher an ist."* ]] && echo ja || echo nein)"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim_exp in tables:0 columns:1 functions:0 triggers:0 policies:0 indexes:0 rls_tables:0; do
  dim="${dim_exp%%:*}"
  check S "Katalogzaehlung $dim: Zuwachs ${dim_exp#*:}" "${dim_exp#*:}" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
run_assertions t

run_probes

# --- W: zweites Einspielen --------------------------------------------------------------------------------
W_DATA="$(q "$DATA_SQL")"
set +e; psql_stdin < "$TARGET_FILE" >/dev/null 2>&1; W_RC=$?; set -e
check W "zweites Einspielen: Exit 0, Schema wie nach dem ersten, Daten gleich" "0|identisch|gleich" \
  "$W_RC|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)|$([[ "$(q "$DATA_SQL")" == "$W_DATA" ]] && echo gleich || echo verschieden)"
check W "nach dem zweiten Einspielen: Funktion weiter genau einmal, Rechte gleich" \
  "p_monitor_key text, p_tournament_id uuid, p_slide_index integer, p_cache_status text, p_user_agent text, p_wake_lock text:true:{\"search_path=public, pg_temp\"}:true:true:false" \
  "$(q "$FN_STATE_SQL")"

# --- X: Rueckweg (Anhang B) -------------------------------------------------------------------------------
# Committete Zeilen im neuen Format (die der Rueckweg verwerfen muss): Monitor im oeffentlichen und im privaten Turnier
check X "vorbereitend: Mama Petra (oeffentlich) und Olli (privat) senden, committet" "ok|ok" \
  "$(als "" "$(SEND "$T_SUED" "$K_SUED" granted)")|$(als "$U_OLLI" "$(SEND "$T_NORD" "$K_NORD" released)")"
rueckweg_sql | psql_stdin
DUMP_ROLLED_BACK="$(schema_dump)"
check X "nach dem Rueckweg: Schema public = vor der Migration (pg_dump identisch, inkl. Rechte)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi
check X "nach dem Rueckweg: Bestandszeile unveraendert, Zeilen 'mon-…' verworfen" "$DATA_BEFORE" "$(q "$DATA_SQL")"
check X "nach dem Rueckweg: alte Funktion laeuft wieder (Olli, Monitor-UUID)" "ok" \
  "$(probe "$U_OLLI" "" "SELECT 'r:ok' FROM (SELECT public.record_monitor_heartbeat('$MON_LEGACY'::uuid, '$T_NORD', 1, 'fresh', 'x')) AS x;" "1" | cut -d'|' -f1)"
psql_stdin < "$TARGET_FILE"
check X "danach erneut einspielbar (Schema = erstes Einspielen)" "identisch" "$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f"
  echo "OK    spaetere Migration laeuft: $(basename "$f")" >&2
done

summary
echo
echo "Ergebnis: $(total_dev) Abweichung(en)."
FERTIG=1
[[ "$(total_dev)" -eq 0 ]]
