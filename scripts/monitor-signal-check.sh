#!/usr/bin/env bash
#
# monitor-signal-check.sh — Container-Beweis fuer supabase/migrations/20261118_006_monitor_aenderungssignal.sql (R5 PR 1
# „Sofort-Kanal“, plan-R5-monitor.md § 4 PR 1 „SQL-Probe“). Muster: scripts/verschieben-server-check.sh (ein
# Wegwerf-Container, Baseline + Migrationen seit Baseline, trap, --without-migration, --gegenprobe, --print-rueckweg).
#
# Szenarien/Zone 1: Record 2026-10-02_zuschauer-und-monitor.md „Änderungssignal“ (Signal ohne Inhalt) und „Aktualität“
# (@ZM-084, @ZM-083, @ZM-178, @FU-001 Monitor-Teil): jede Aenderung an einem Spiel loest ein Signal aus, der Monitor holt
# den Stand danach ueber display_tournament.
#
# realtime.send und realtime.messages legt der Realtime-Dienst an, nicht das Postgres-Image. Das Skript legt sie deshalb
# vor den Migrationen an -- realtime.send WOERTLICH wie im Realtime-Image v2.130.0 (lokaler Stack; Migration
# 20251103001201_broadcast_send_include_payload_id), realtime.messages mit den Spalten, die send schreibt.
# Spike 29.10. (Report task-R5-1-report.md): echter Realtime-Dienst v2.130.0 + anon-Client -> Zustellung erst nach Commit,
# nichts nach Rollback, oeffentlicher Kanal ohne Anmeldung, privater Kanal fuer anon abgelehnt.
#
# Kategorien:
#   F  Fail-fast: ohne Schema public_view Abbruch ohne Aenderung.
#   S  Schema: Funktion SECURITY DEFINER, search_path fest, kein EXECUTE fuer PUBLIC/anon/authenticated; sieben Trigger
#      AFTER ... FOR EACH STATEMENT; Katalog +1 Funktion (public), +7 Trigger, sonst nichts.
#   A  Ein Signal je Anweisung und Turnier: Spiel-Update -> genau 1 Eintrag in realtime.messages mit Thema
#      display:<turnier>, Ereignis 'changed', oeffentlich, Inhalt nur {at, id}; Voll-Speichern mit 30 Spielen -> 1 Signal;
#      eine Anweisung ueber zwei Turniere -> je Turnier 1; 0 Zeilen -> 0; Rollback -> 0.
#   B  Jede Tabelle/jedes Ereignis: Spiel anlegen/loeschen, Team anlegen/aendern/loeschen, Turnier aendern -> je 1;
#      Turnier anlegen -> 0 (kein Monitor kennt es).
#   E  Schreibweg der App: Eigentuemer Olli aendert sein Turnier (authenticated, RLS) -> 1 Signal; Tor und Gelbe Karte
#      ueber append_match_events -> je Aufruf 1 Signal; anon darf nichts aendern (42501) -> 0 Signale; anon kann die
#      Signal-Funktion nicht aufrufen.
#   R  Robust: realtime.send fehlt (umbenannt) -> das Update gelingt trotzdem, Wert geaendert, kein Signal; auch ein
#      Fehler IN realtime.messages (Tabelle fehlt) kippt nichts.
#   P  Rechte-Assertion (scripts/db_privilege_assertions.sql als ci_schema_reader) alle |t, die zwei neuen vorhanden.
#   W  zweites Einspielen (idempotent).   X  Rueckweg -> Schema = vorher.
#
# Aufrufoptionen:
#   bash scripts/monitor-signal-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/monitor-signal-check.sh --without-migration  Gegenprobe: ohne die Migration muessen A, B und E rot sein
#   bash scripts/monitor-signal-check.sh --gegenprobe         je Lauf eine Mutation (M1-M6); Exit 0 NUR, wenn JEDE
#                                                             Mutation mindestens eine Pruefung rot faerbt
#   bash scripts/monitor-signal-check.sh --print-rueckweg     gibt den Rueckweg aus, ohne Container
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container
# (supabase/postgres:17.6.1.063 wie tournament-lifecycle-check.sh; DOCKER_PLATFORM waehlt die Plattform ausdruecklich),
# wird am Ende entfernt (trap).
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

POSTGRES_IMAGE="${POSTGRES_IMAGE:-supabase/postgres:17.6.1.063}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261118_006_monitor_aenderungssignal.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
CONTAINER_NAME="monitor-signal-check-$$"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/monitor-signal-check.XXXXXX")"

rueckweg_sql() {
  cat <<'SQL'
-- supabase/rollbacks/20261118_006_monitor_aenderungssignal_rollback.sql
-- RUECKWEG zu supabase/migrations/20261118_006_monitor_aenderungssignal.sql (R5 PR 1, Sofort-Kanal). Liegt bewusst NICHT in
-- supabase/migrations (wird nie nachgespielt). Erzeugt mit `bash scripts/monitor-signal-check.sh --print-rueckweg`; belegt
-- in scripts/monitor-signal-check.sh (Kategorie X: Schema danach = Stand vor der Migration).
-- Danach sendet die Datenbank kein Aenderungssignal mehr; Monitore holen den Stand wieder nur im Rueckfall-Takt (2 s).
-- Die App muss dafuer NICHT zurueckgesetzt werden. Keine Daten gehen verloren.
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP TRIGGER IF EXISTS matches_signal_display_insert ON public.matches;
DROP TRIGGER IF EXISTS matches_signal_display_update ON public.matches;
DROP TRIGGER IF EXISTS matches_signal_display_delete ON public.matches;
DROP TRIGGER IF EXISTS teams_signal_display_insert ON public.teams;
DROP TRIGGER IF EXISTS teams_signal_display_update ON public.teams;
DROP TRIGGER IF EXISTS teams_signal_display_delete ON public.teams;
DROP TRIGGER IF EXISTS tournaments_signal_display_update ON public.tournaments;
DROP FUNCTION IF EXISTS public.monitor_display_signal();
COMMIT;
-- Danach: Assertions monitor-signal-* in scripts/db_privilege_assertions.sql + PRIVILEGE_ASSERTION_NAMES +
-- pending_assertions_for in scripts/db-drift-check.sh zuruecknehmen, Drift-Check.
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

cleanup() { docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true; rm -rf "$WORKDIR"; }
trap cleanup EXIT

start_container() {
  docker run -d ${DOCKER_PLATFORM:+--platform "$DOCKER_PLATFORM"} --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 150); do
    if [[ "$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "::error::Container wurde nach 150s nicht bereit." >&2
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
qa() { # als supabase_admin (Eigentuemer des Schemas realtime im Image)
  docker exec -i -e PGPASSWORD=postgres -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" \
    psql -U supabase_admin -h localhost -d postgres -X -v ON_ERROR_STOP=1 -q -tA <<<"$1" 2>&1 || true
}
schema_dump() {
  docker exec "$CONTAINER_NAME" pg_dump -U postgres --schema-only --schema=public --schema=public_view postgres \
    | grep -vE '^\\(un)?restrict '
}
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }

CATS=(F S A B E R P W X)
DEVS=(0 0 0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0 0 0)
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
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
reset_counts() { DEVS=(0 0 0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0 0 0); }
summary() {
  local i line=""
  for i in "${!CATS[@]}"; do line="$line ${CATS[$i]} ${OKS[$i]}/$((OKS[i] + DEVS[i]))"; done
  echo "Zusammenfassung (OK/gesamt):$line -- Abweichungen: $(total_dev)"
}

uuid_for() {
  local h
  h="$(printf '%s' "monitor-signal-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"
D_OLLI="$(uuid_for device:olli-tablet)"

# realtime.send woertlich wie Realtime v2.130.0 (20251103001201_broadcast_send_include_payload_id); realtime.messages nur
# mit den Spalten, die send schreibt (der echte Dienst partitioniert die Tabelle nach inserted_at).
setup_realtime() {
  docker exec -i -e PGPASSWORD=postgres -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" \
    psql -U supabase_admin -h localhost -d postgres -X -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE TABLE realtime.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  extension text NOT NULL,
  payload jsonb,
  event text,
  private boolean DEFAULT false,
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  inserted_at timestamp without time zone NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true ) RETURNS void
AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();
    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;
    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);
    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
$$
LANGUAGE plpgsql;
-- Rechte wie beim echten Dienst (Spike 29.10.): postgres alles, Client-Rollen arw, send EXECUTE fuer PUBLIC.
GRANT USAGE ON SCHEMA realtime TO postgres, anon, authenticated, service_role;
GRANT ALL ON realtime.messages TO postgres;
GRANT SELECT, INSERT, UPDATE ON realtime.messages TO anon, authenticated, service_role;
ALTER FUNCTION realtime.send(jsonb, text, text, boolean) OWNER TO postgres;
ALTER TABLE realtime.messages OWNER TO postgres;
SQL
}

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
CREATE FUNCTION harness.call(p_user uuid, p_match uuid, p_events jsonb, p_device uuid) RETURNS jsonb
LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  PERFORM harness.claims(p_user, false, 'authenticated');
  BEGIN
    v := public.append_match_events(p_match, p_events, 2, p_device);
  EXCEPTION WHEN OTHERS THEN
    v := jsonb_build_object('exception', SQLSTATE, 'message', SQLERRM);
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA harness TO anon, authenticated, service_role;
SQL
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '$U_OLLI', 'authenticated', 'authenticated', 'olli@r5.test', 'x', now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now());
SQL
}

# Daten je Lauf: „Hallencup Nord“ (Spiel 7 auf Feld 1, Spiel 8 auf Feld 2, dazu 28 weitere Spiele = 30) und „Bambini-Cup“.
RUN=""
T_NORD=""; T_BAMBINI=""; TEAM_NORD=""; TEAM_BERG=""
m() { uuid_for "$RUN:match:$1"; }
setup_data() {
  RUN="$1"
  T_NORD="$(uuid_for "$RUN:tournament:nord")"; T_BAMBINI="$(uuid_for "$RUN:tournament:bambini")"
  TEAM_NORD="$(uuid_for "$RUN:team:fc-nord")"; TEAM_BERG="$(uuid_for "$RUN:team:djk-berg")"
  local tb1 tb2
  tb1="$(uuid_for "$RUN:team:bambini-a")"; tb2="$(uuid_for "$RUN:team:bambini-b")"
  psql_stdin <<SQL
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config, finals_config)
VALUES ('$T_NORD', '$U_OLLI', 'Hallencup Nord', (now() AT TIME ZONE 'Europe/Berlin')::date, 2, 10, '{}'::jsonb, '{}'::jsonb),
       ('$T_BAMBINI', '$U_OLLI', 'Bambini-Cup', (now() AT TIME ZONE 'Europe/Berlin')::date, 2, 10, '{}'::jsonb, '{}'::jsonb);
INSERT INTO public.teams (id, tournament_id, name) VALUES ('$TEAM_NORD', '$T_NORD', 'FC Nord'), ('$TEAM_BERG', '$T_NORD', 'DJK Berg'),
  ('$tb1', '$T_BAMBINI', 'Bambini A'), ('$tb2', '$T_BAMBINI', 'Bambini B');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, group_letter) VALUES
  ('$(m spiel7)', '$T_NORD', 1, 1, '$TEAM_NORD', '$TEAM_BERG', 7, 'A'),
  ('$(m spiel8)', '$T_NORD', 1, 2, '$TEAM_BERG', '$TEAM_NORD', 8, 'A'),
  ('$(m bambini)', '$T_BAMBINI', 1, 1, '$tb1', '$tb2', 1, 'A');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, group_letter)
SELECT gen_random_uuid(), '$T_NORD', 2 + g, 1, '$TEAM_NORD', '$TEAM_BERG', 100 + g, 'A' FROM generate_series(1, 28) g;
SQL
}

msg_count() { q "SELECT count(*) FROM realtime.messages;"; }
# Signale seit Marke <n>: "<Anzahl>|<Themen sortiert, Komma>"
since() { q "SELECT count(*) || '|' || coalesce(string_agg(topic, ',' ORDER BY topic), '') FROM (SELECT topic FROM realtime.messages ORDER BY inserted_at, id OFFSET $1) s;"; }
as_user() { q "SELECT harness.exec('$1'::uuid, false, 'authenticated', \$S\$$2\$S\$);"; }
as_anon() { q "SELECT harness.exec(NULL, true, 'anon', \$S\$$1\$S\$);"; }
ev_batch() { # ev_batch <Typ> [teamId] ... -> JSON-Stapel (je Typ ein Eintrag; MATCH_START ohne Team)
  local out="[]" i=0 type team
  while [[ $# -gt 0 ]]; do
    type="$1"; team="${2:-}"; shift; [[ $# -gt 0 ]] && shift
    i=$((i + 1))
    out="$(jq -c --arg type "$type" --arg id "$(uuid_for "$RUN:ev:$type:$i:$RANDOM")" --arg team "$team" \
      '. + [{id: $id, type: $type, at: 1000, section: 1, clockMs: 1000, teamId: (if $team == "" then null else $team end),
             targetId: null, payload: (if $type == "GOAL" then {} elif $type == "YELLOW_CARD" then {} else {} end)}]' <<<"$out")"
  done
  echo "$out"
}
call() { q "SELECT harness.call('$U_OLLI'::uuid, '$1'::uuid, \$J\$$2\$J\$::jsonb, '$D_OLLI'::uuid);"; }
results() { jq -r '[.results[]? | .status + (if .code then ":" + .code else "" end)] | join(",") | if . == "" then (.exception // "keine") else . end' <<<"$1" 2>/dev/null || echo "keine-json:$1"; }

run_probes() {
  setup_data "$1"
  local n out
  # --- A: ein Signal je Anweisung und Turnier ---
  n="$(msg_count)"
  q "UPDATE public.matches SET score_a = 1 WHERE id = '$(m spiel7)';" >/dev/null
  check A "Tor in Spiel 7 (Update einer Zeile): genau 1 Signal auf display:<Hallencup Nord>" "1|display:$T_NORD" "$(since "$n")"
  check A "Signal: Ereignis 'changed', oeffentlich (private false), Erweiterung broadcast, Inhalt nur {at, id}" \
    "changed|false|broadcast|at,id|number" \
    "$(q "SELECT event || '|' || private || '|' || extension || '|' || (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(payload) k) || '|' || jsonb_typeof(payload -> 'at') FROM realtime.messages ORDER BY inserted_at DESC, id DESC LIMIT 1;")"
  check A "Zeitpunkt im Signal = Serverzeit in ms (Abstand zu now() < 5 s)" "t" \
    "$(q "SELECT abs((payload ->> 'at')::numeric - extract(epoch FROM now()) * 1000) < 5000 FROM realtime.messages ORDER BY inserted_at DESC, id DESC LIMIT 1;")"
  n="$(msg_count)"
  q "UPDATE public.matches SET updated_at = now() WHERE tournament_id = '$T_NORD';" >/dev/null
  check A "Voll-Speichern: 30 Spiele in einer Anweisung -> 1 Signal, nicht 30" "1|display:$T_NORD" "$(since "$n")"
  n="$(msg_count)"
  q "UPDATE public.matches SET updated_at = now() WHERE id IN ('$(m spiel8)', '$(m bambini)');" >/dev/null
  check A "eine Anweisung ueber zwei Turniere -> je Turnier 1 Signal" \
    "2|$(printf '%s\n' "display:$T_BAMBINI" "display:$T_NORD" | sort | paste -sd, -)" "$(since "$n")"
  n="$(msg_count)"
  q "UPDATE public.matches SET score_a = 9 WHERE id = '00000000-0000-0000-0000-000000000000';" >/dev/null
  check A "Update ohne getroffene Zeile -> kein Signal" "0|" "$(since "$n")"
  n="$(msg_count)"
  q "BEGIN; UPDATE public.matches SET score_b = 3 WHERE id = '$(m spiel8)'; ROLLBACK;" >/dev/null
  check A "zurueckgerollte Aenderung -> kein Signal (Zustellung erst nach Commit)" "0|" "$(since "$n")"

  # --- B: jede Tabelle, jedes Ereignis ---
  local extra team_x
  extra="$(uuid_for "$RUN:match:extra")"; team_x="$(uuid_for "$RUN:team:x")"
  n="$(msg_count)"; q "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number)
                        VALUES ('$extra', '$T_NORD', 9, 1, '$TEAM_NORD', '$TEAM_BERG', 99);" >/dev/null
  check B "Spiel anlegen -> 1 Signal" "1|display:$T_NORD" "$(since "$n")"
  n="$(msg_count)"; q "DELETE FROM public.matches WHERE id = '$extra';" >/dev/null
  check B "Spiel loeschen -> 1 Signal" "1|display:$T_NORD" "$(since "$n")"
  n="$(msg_count)"; q "INSERT INTO public.teams (id, tournament_id, name) VALUES ('$team_x', '$T_NORD', 'SV Sued');" >/dev/null
  check B "Team anlegen -> 1 Signal" "1|display:$T_NORD" "$(since "$n")"
  n="$(msg_count)"; q "UPDATE public.teams SET name = 'SV Süd' WHERE id = '$team_x';" >/dev/null
  check B "Team umbenennen -> 1 Signal" "1|display:$T_NORD" "$(since "$n")"
  n="$(msg_count)"; q "DELETE FROM public.teams WHERE id = '$team_x';" >/dev/null
  check B "Team loeschen -> 1 Signal" "1|display:$T_NORD" "$(since "$n")"
  n="$(msg_count)"; q "UPDATE public.tournaments SET config = config || '{\"kidsMode\": true}'::jsonb WHERE id = '$T_BAMBINI';" >/dev/null
  check B "Turnier aendern (Kindermodus an) -> 1 Signal" "1|display:$T_BAMBINI" "$(since "$n")"
  n="$(msg_count)"
  q "INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config, finals_config)
     VALUES ('$(uuid_for "$RUN:tournament:neu")', '$U_OLLI', 'Neu', current_date, 2, 10, '{}'::jsonb, '{}'::jsonb);" >/dev/null
  check B "Turnier anlegen -> kein Signal (noch kein Monitor)" "0|" "$(since "$n")"

  # --- E: Schreibweg der App ---
  n="$(msg_count)"
  out="$(as_user "$U_OLLI" "UPDATE public.tournaments SET title = 'Hallencup Nord 2026' WHERE id = '$T_NORD'")"
  check E "Eigentuemer Olli (authenticated, RLS) aendert sein Turnier: ok:1 und 1 Signal" "ok:1|1|display:$T_NORD" "$out|$(since "$n")"
  n="$(msg_count)"
  out="$(call "$(m spiel8)" "$(ev_batch MATCH_START "" GOAL "$TEAM_BERG")")"
  check E "append_match_events: Anpfiff + Tor DJK Berg in Spiel 8 -> angenommen, 1 Signal (eine Zeile matches je Aufruf)" \
    "accepted,accepted|1|display:$T_NORD" "$(results "$out")|$(since "$n")"
  n="$(msg_count)"
  out="$(call "$(m spiel8)" "$(ev_batch YELLOW_CARD "$TEAM_BERG")")"
  check E "append_match_events: Gelbe Karte DJK Berg in Spiel 8 -> angenommen, 1 Signal" \
    "accepted|1|display:$T_NORD" "$(results "$out")|$(since "$n")"
  n="$(msg_count)"
  out="$(as_anon "UPDATE public.matches SET score_a = 5 WHERE id = '$(m spiel7)'")"
  check E "anon aendert ein Spiel: abgelehnt (kein UPDATE-Recht), kein Signal" "error:42501|0|" "$out|$(since "$n")"
  check E "anon kann die Signal-Funktion nicht aufrufen" "error:42501" "$(as_anon "SELECT public.monitor_display_signal()")"

  # --- R: robust ---
  qa "ALTER FUNCTION realtime.send(jsonb, text, text, boolean) RENAME TO send_r5_probe;" >/dev/null
  n="$(msg_count)"
  out="$(q "UPDATE public.matches SET score_a = 4 WHERE id = '$(m spiel7)' RETURNING score_a;")"
  check R "realtime.send fehlt: Update gelingt trotzdem (Stand 4), kein Signal" "4|0|" "$out|$(since "$n")"
  qa "ALTER FUNCTION realtime.send_r5_probe(jsonb, text, text, boolean) RENAME TO send;" >/dev/null
  qa "ALTER TABLE realtime.messages RENAME TO messages_r5_probe;" >/dev/null
  out="$(q "UPDATE public.teams SET name = 'FC Nord' WHERE id = '$TEAM_NORD' RETURNING name;" | tail -1)"
  check R "realtime.messages fehlt (send meldet nur eine Warnung): Team-Update gelingt trotzdem" "FC Nord" "$out"
  qa "ALTER TABLE realtime.messages_r5_probe RENAME TO messages;" >/dev/null
}

apply_target() { psql_stdin < "${1:-$TARGET_FILE}"; }
prepare() {
  start_container
  echo "Realtime-Stub + Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  setup_realtime
  psql_stdin < "$BASELINE_FILE"
  for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done
  setup_helpers
}

if [[ "$MODE" == "without-migration" ]]; then
  prepare
  run_probes ohne
  summary
  red=0
  for c in A B E; do [[ "${DEVS[$(cat_index "$c")]}" -gt 0 ]] || red=1; done
  if [[ "$red" -eq 0 ]]; then
    echo "Ohne Migration: A, B und E rot -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (A, B, E muessen je mindestens eine Abweichung haben)."
  exit 1
fi

if [[ "$MODE" == "gegenprobe" ]]; then
  prepare
  MUTATIONS=(
    "M1~ohne EXCEPTION-Zweig (Signal-Fehler kippt die Aenderung)~  EXCEPTION WHEN OTHERS THEN\n    -- Ein Signal darf nie eine Aenderung kippen; der Monitor holt im Rueckfall-Takt.\n    NULL;\n~"
    "M2~je Zeile statt je Anweisung (Voll-Speichern = 30 Signale)~CREATE TRIGGER matches_signal_display_update AFTER UPDATE ON public.matches\n  REFERENCING NEW TABLE AS new_rows\n  FOR EACH STATEMENT~CREATE TRIGGER matches_signal_display_update AFTER UPDATE ON public.matches\n  REFERENCING NEW TABLE AS new_rows\n  FOR EACH ROW"
    "M3~privater statt oeffentlicher Kanal (anon empfaengt nichts)~'changed', 'display:' || v_id, false);\n      END LOOP;\n    END IF;~'changed', 'display:' || v_id, true);\n      END LOOP;\n    END IF;"
    "M4~Inhalt mit Stand statt nur Zeitpunkt~PERFORM realtime.send(jsonb_build_object('at', v_at), 'changed', 'display:' || v_id, false);\n      END LOOP;\n    END IF;~PERFORM realtime.send(jsonb_build_object('at', v_at, 'row', v_id), 'changed', 'display:' || v_id, false);\n      END LOOP;\n    END IF;"
    "M5~kein Trigger fuer Turnier-Aenderungen~DROP TRIGGER IF EXISTS tournaments_signal_display_update ON public.tournaments;\nCREATE TRIGGER tournaments_signal_display_update AFTER UPDATE ON public.tournaments\n  REFERENCING NEW TABLE AS new_rows\n  FOR EACH STATEMENT EXECUTE FUNCTION public.monitor_display_signal('id');~"
    "M6~falsches Thema beim Loeschen (tournament: statt display:)~'changed', 'display:' || v_id, false);\n      END LOOP;\n    ELSE~'changed', 'tournament:' || v_id, false);\n      END LOOP;\n    ELSE"
  )
  not_killed=()
  for mut in "${MUTATIONS[@]}"; do
    IFS='~' read -r mid mtext mfrom mto <<<"$mut"
    mutated="$WORKDIR/$mid.sql"
    python3 - "$TARGET_FILE" "$mutated" "$mfrom" "$mto" <<'PY' || exit 1
import sys
src, dst, frm, to = sys.argv[1], sys.argv[2], sys.argv[3].encode().decode('unicode_escape'), sys.argv[4].encode().decode('unicode_escape')
text = open(src, encoding='utf-8').read()
if text.count(frm) != 1:
    sys.exit(f"Mutation: Stelle nicht genau einmal gefunden: {frm!r} ({text.count(frm)}x)")
open(dst, 'w', encoding='utf-8').write(text.replace(frm, to))
PY
    reset_counts
    echo "=== $mid: $mtext" >&2
    rueckweg_sql | psql_stdin >/dev/null 2>&1
    apply_target "$mutated"
    run_probes "$mid" > "$WORKDIR/$mid.log"
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "ROT   $mid $mtext ($(grep -c '^ABWEICHUNG' "$WORKDIR/$mid.log" | tr -d ' ') Abweichung(en); z. B. $(grep -m1 '^ABWEICHUNG' "$WORKDIR/$mid.log" | cut -c13-110))"
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
prepare

# --- F: Fail-fast ------------------------------------------------------------------------------------------------
q "ALTER SCHEMA public_view RENAME TO public_view_r5_probe;" >/dev/null
F_DUMP_BEFORE="$(docker exec "$CONTAINER_NAME" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict ')"
F_OUT="$(apply_target 2>&1)"
F_EXIT=$?
check F "ohne Schema public_view: Abbruch mit Hinweis, Schema public unveraendert" "abbruch|Schema public_view fehlt|identisch" \
  "$([[ "$F_EXIT" -ne 0 ]] && echo abbruch || echo "exit $F_EXIT")|$(grep -o 'Schema public_view fehlt' <<<"$F_OUT" | head -1)|$([[ "$(docker exec "$CONTAINER_NAME" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict ')" == "$F_DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
q "ALTER SCHEMA public_view_r5_probe RENAME TO public_view;" >/dev/null

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"

echo "Migration einspielen..." >&2
apply_target || { echo "::error::Einspielen fehlgeschlagen." >&2; exit 1; }

# --- S: Schema ----------------------------------------------------------------------------------------------------
check S "Funktion SECURITY DEFINER, search_path fest, kein EXECUTE fuer PUBLIC/anon/authenticated" \
  "true|{\"search_path=public, pg_temp\"}|false|false|false" \
  "$(q "SELECT p.prosecdef || '|' || p.proconfig::text || '|' || EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) || '|'
            || has_function_privilege('anon', p.oid, 'EXECUTE') || '|' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
          FROM pg_proc p WHERE p.oid = to_regprocedure('public.monitor_display_signal()');")"
check S "sieben Trigger AFTER ... FOR EACH STATEMENT auf matches (I/U/D), teams (I/U/D), tournaments (U), aktiv" \
  "matches:DELETE,matches:INSERT,matches:UPDATE,teams:DELETE,teams:INSERT,teams:UPDATE,tournaments:UPDATE|7" \
  "$(q "SELECT string_agg(x.k, ',' ORDER BY x.k) || '|' || count(*) FILTER (WHERE x.ok)
          FROM (SELECT c.relname || ':' || CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' WHEN t.tgtype & 8 = 8 THEN 'DELETE' ELSE 'UPDATE' END AS k,
                       (t.tgtype & 1 = 0 AND t.tgtype & 2 = 0 AND t.tgenabled = 'O') AS ok
                  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                 WHERE t.tgfoid = to_regprocedure('public.monitor_display_signal()') AND NOT t.tgisinternal) x;")"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in columns functions triggers tables policies indexes rls_tables; do
  expected=0
  case "$dim" in functions) expected=1 ;; triggers) expected=7 ;; esac
  check S "Katalogzaehlung $dim (public + public_view): Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
echo "    md5(prosrc) public.monitor_display_signal (Soll fuer Produktion): $(q "SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.monitor_display_signal()');")"

run_probes haupt

# --- P: Rechte-Assertion ------------------------------------------------------------------------------------------
PRIV_OUT="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || PRIV_OUT="nicht ausfuehrbar: $PRIV_OUT"
check P "Rechte-Assertion: keine Zeile |f" "" "$(grep -v '|t$' <<<"$PRIV_OUT" || true)"
check P "die zwei neuen Zeilen vorhanden und |t" \
  "monitor-signal-definer-no-client-execute|t,monitor-signal-triggers-statement-active|t" \
  "$(grep -E '^monitor-signal-' <<<"$PRIV_OUT" | sort | paste -sd, -)"
check P "db-drift-check.sh kennt die zwei Namen und die Zuordnung der Migration" "2|1" \
  "$(grep -cE '^  "(monitor-signal-definer-no-client-execute|monitor-signal-triggers-statement-active)"$' "$REPO_ROOT/scripts/db-drift-check.sh")|$(grep -c "^    $TARGET_NAME)" "$REPO_ROOT/scripts/db-drift-check.sh")"

# --- W: idempotent ------------------------------------------------------------------------------------------------
apply_target >/dev/null 2>&1
W_EXIT=$?
check W "zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check W "danach Schema (public + public_view) unveraendert" "identisch" "$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg --------------------------------------------------------------------------------------------------
rueckweg_sql | psql_stdin
check X "nach dem Rueckweg: Schema public + public_view = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$(schema_dump)" == "$DUMP_BEFORE" ]] && echo identisch || { diff <(echo "$DUMP_BEFORE") <(schema_dump) | head -20 >&2; echo verschieden; })"
check X "Rueckweg-Datei im Repo = --print-rueckweg" "gleich" \
  "$(diff -q <(rueckweg_sql) "$REPO_ROOT/supabase/rollbacks/20261118_006_monitor_aenderungssignal_rollback.sql" >/dev/null && echo gleich || echo verschieden)"
apply_target
check X "erneut eingespielt: Schema = nachher" "identisch" "$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f" || { echo "::error::spaetere Migration scheitert: $(basename "$f")" >&2; exit 1; }
  echo "OK    spaetere Migration laeuft: $(basename "$f")" >&2
done

echo
summary
[[ "$(total_dev)" -eq 0 ]]
