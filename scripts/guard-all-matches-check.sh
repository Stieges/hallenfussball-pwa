#!/usr/bin/env bash
#
# guard-all-matches-check.sh — Container-Beweis fuer supabase/migrations/20261028_005_guard_all_matches.sql
# (A-10, brief-A-10.md). Muster: scripts/match-kit-check.sh (Wegwerf-Container supabase/postgres, Baseline +
# Migrationen seit Baseline, Aufraeumen per trap). Testwerte aus dem Gherkin: Spiel 3 SG Mitte gegen VfB Ufer
# 3:1 ohne Eintraege (@EK-060), Spiel 7 beendet 2:1 mit 5 Eintraegen (@EK-031, @FU-055, @FU-090), Tom = Helfer
# (collaborator), Olli = Eigentuemer, Maria = Co-Admin, Spiel 5 Anstoss 14:40 (@FU-089), Rueckennummer 9 (@FU-056).
#
# Kategorien:
#   A  Spalten-Schutz (Teil A): Client-Rollen aendern die 16 Schutzspalten bei KEINEM Spiel (auch ohne
#      Engine-Ereignisse, @EK-060), Eigentuemer/Co-Admin eingeschlossen; Gegenbeispiele (freie Spalte,
#      gleicher Wert, Server-Rollen); INSERT neutral (L7).
#   E  Engine-Weg (Bestand, Regression mit den Gherkin-Werten): @EK-031, @FU-055, @FU-056, @HE-042.
#   B  reset_match_results (Teil B): @FU-090 Server-Zwilling (alles oder nichts, HAS_ENTRIES), Z4-Faelle
#      (nur SKIP, nur zurueckgenommenes Tor, Direkteintrag), Rechte, Papierkorb, fremdes Spiel, Neutralwerte,
#      matches.version bleibt, change_revision +1.
#   C  tournaments.change_revision (Teil C): Spielplan-Spalte +1 (auch durch den Helfer), Ergebnis ueber
#      append_match_events +0, is_public-Kaskade +0, gleicher Wert +0, Client setzt Zaehlung -> HF004,
#      Client-INSERT -> 0, Voll-Speichern bleibt konfliktfrei (version genau +1).
#   S  Schema, Trigger, Rechte-Assertion (alle Zeilen |t, die 8 neuen da), Namensliste = db-drift-check.sh,
#      Katalogzaehlung (Funktionen +3, Trigger +2, Spalten +1).
#   W  zweites Einspielen (idempotent).  X  Rueckweg laut Kopfkommentar -> Schema = vor der Migration.
#
# Aufrufoptionen:
#   bash scripts/guard-all-matches-check.sh                     normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/guard-all-matches-check.sh --without-migration Gegenprobe: ohne 20261028_005 -> A, B und C
#                                                               muessen ROT sein, E gruen (Exit 0 nur dann)
#   bash scripts/guard-all-matches-check.sh --gegenprobe        je Lauf eine Mutation der Migration; Exit 0 NUR,
#                                                               wenn JEDE Mutation mindestens eine Pruefung rot
#                                                               faerbt (M1..M7, siehe unten)
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container,
# wird am Ende entfernt (trap). Harness-Hilfen liegen im Schema "harness" (nicht im Dump von public).
#
set -euo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe)" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie match-kit-check.sh
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261028_005_guard_all_matches.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
AMEND_FILE="$MIGRATIONS_DIR/20261001_001_amend_event.sql"
CONTAINER_PREFIX="guard-all-matches-check-$$"
CURRENT_CONTAINER=""

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
  elif [[ "$(basename "$line")" == 20261110_* ]]; then
    # A-11 (20261110_001) setzt A-10 voraus (Fail-fast: reset_match_results) -- ein Rueckweg von A-10 setzt den
    # Rueckweg von A-11 voraus. Deshalb nicht in A5 (Lauf nach dem Rueckweg) und nicht ohne die Migration.
    # A-27 (_002) und A-34 (_003) haengen per Fail-fast an _001 bzw. _002 -- ebenso nicht in A5.
    continue
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
q() { psql_value <<<"$1" 2>&1 || true; }
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }

# Zaehler je Kategorie (bash 3.2: keine assoziativen Arrays).
CATS=(A E B C S W X)
DEVS=(0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0)
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
reset_counts() { DEVS=(0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0); }

uuid_for() {
  local h
  h="$(printf '%s' "guard-all-matches-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_TOM="$(uuid_for user:tom)"
U_TRAINER="$(uuid_for user:trainer)"; U_VIEWER="$(uuid_for user:viewer)"; U_STRANGER="$(uuid_for user:stranger)"
T="$(uuid_for tournament:live-cup)"; T_OTHER="$(uuid_for tournament:fremd)"; T_TRASH="$(uuid_for tournament:papierkorb)"
SG_MITTE="$(uuid_for team:sg-mitte)"; VFB_UFER="$(uuid_for team:vfb-ufer)"
FC_NORD="$(uuid_for team:fc-nord)"; SV_SUED="$(uuid_for team:sv-sued)"
OTHER_A="$(uuid_for team:fremd-a)"; OTHER_B="$(uuid_for team:fremd-b)"
TRASH_A="$(uuid_for team:papierkorb-a)"; TRASH_B="$(uuid_for team:papierkorb-b)"
S3="$(uuid_for match:spiel-3)"; S4="$(uuid_for match:spiel-4)"; S5="$(uuid_for match:spiel-5)"
S6="$(uuid_for match:spiel-6)"; S7="$(uuid_for match:spiel-7)"; S9="$(uuid_for match:spiel-9)"
S10="$(uuid_for match:spiel-10-nur-skip)"; S11="$(uuid_for match:spiel-11-nur-zurueckgenommen)"
S12="$(uuid_for match:spiel-12-direkteintrag)"
M_OTHER="$(uuid_for match:fremd)"; M_TRASH="$(uuid_for match:papierkorb)"
M_INS="$(uuid_for match:client-insert)"; M_INS_NEUTRAL="$(uuid_for match:client-insert-neutral)"
T_INS="$(uuid_for tournament:client-insert)"
E() { uuid_for "event:$1"; }

# ev <typ> <id> [Zusatzfelder als JSON] -- haengt ein Engine-Ereignis an EVS an (Format wie
# scripts/append-match-events-check.sh). Kein Ausdruck in $(...): bash 3.2 verschluckt \" in verschachtelten
# Kommandosubstitutionen (beobachtet: Ereignisse fehlten still im Aufruf).
EVS=""
ev() {
  local extra="${3:-}" one
  [[ -z "$extra" ]] && extra='{}'
  one="$(jq -cn --arg type "$1" --arg id "$2" --argjson extra "$extra" \
    '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, teamId: null, targetId: null, payload: {}} + $extra')"
  EVS="$EVS$one"$'\n'
}
# send <Nutzer> <Spiel> -- append_match_events mit den gesammelten Ereignissen als authenticated; Antwort in OUT.
OUT=""
send() {
  local events
  events="$(jq -cs '.' <<<"$EVS")"
  EVS=""
  OUT="$(q "SELECT harness.call('$1'::uuid, '$2'::uuid, \$J\$$events\$J\$::jsonb);")"
}
status_of() { jq -r '.results[0].status // .exception // "?"' <<<"$1"; }
statuses_of() { jq -r '[.results[]?.status] | join(",")' <<<"$1"; }
code_of() { jq -r '.results[0].code // .exception // "-"' <<<"$1"; }
# client <Nutzer> <SQL> [Rolle] -- 'ok:<Zeilen>' oder 'error:<SQLSTATE>:<Meldung>'
client() {
  local u="NULL"
  [[ -n "$1" ]] && u="'$1'::uuid"
  q "SELECT harness.exec($u, \$S\$$2\$S\$, '${3:-authenticated}');"
}
# plus1 <Wert> -- Wert + 1; ohne Zahl (Spalte fehlt, Lauf ohne Migration) ein Platzhalter statt Abbruch (set -u).
plus1() { if [[ "$1" =~ ^[0-9]+$ ]]; then echo $(( $1 + 1 )); else echo "kein-Wert($1)"; fi; }
# guard_class <Ergebnis> -- '42501+guard', wenn die Ablehnung vom Spalten-Schutz kommt (Meldung nennt append_match_events).
guard_class() { if [[ "$1" == error:42501:*append_match_events* ]]; then echo "42501+guard"; else echo "$1"; fi; }
# reset <Nutzer|leer> <Turnier> <Spiel-IDs, Komma> [Rolle] -- reset_match_results, Antwort jsonb oder {"exception": SQLSTATE}
reset() {
  local u="NULL"
  [[ -n "$1" ]] && u="'$1'::uuid"
  q "SELECT harness.reset($u, '$2'::uuid, '{$3}'::uuid[], '${4:-authenticated}');"
}
score_of() { q "SELECT coalesce(score_a::text, 'NULL') || '|' || coalesce(score_b::text, 'NULL') || '|' || match_status FROM public.matches WHERE id = '$1';"; }
events_of() { q "SELECT count(*) FROM public.match_events WHERE match_id = '$1';"; }
version_of() { q "SELECT version FROM public.matches WHERE id = '$1';"; }
cr() { q "SELECT change_revision FROM public.tournaments WHERE id = '${1:-$T}';"; }
neutral_of() {
  q "SELECT concat_ws('|', coalesce(score_a::text,'NULL'), coalesce(score_b::text,'NULL'), coalesce(overtime_score_a::text,'NULL'),
     coalesce(overtime_score_b::text,'NULL'), coalesce(penalty_score_a::text,'NULL'), coalesce(penalty_score_b::text,'NULL'),
     match_status, coalesce(decided_by,'NULL'), coalesce(timer_start_time::text,'NULL'), coalesce(timer_paused_at::text,'NULL'),
     coalesce(timer_elapsed_seconds::text,'NULL'), coalesce(live_state::text,'NULL'), coalesce(actual_start::text,'NULL'),
     coalesce(actual_end::text,'NULL'), coalesce(skipped_at::text,'NULL'), coalesce(skipped_reason,'NULL'))
     FROM public.matches WHERE id = '$1';"
}
NEUTRAL="NULL|NULL|NULL|NULL|NULL|NULL|scheduled|NULL|NULL|NULL|0|NULL|NULL|NULL|NULL|NULL"

setup_helpers() {
  psql_stdin <<'SQL'
CREATE SCHEMA harness;
GRANT USAGE ON SCHEMA harness TO anon, authenticated, service_role;
-- append_match_events als echte Client-Rolle (SET LOCAL role + request.jwt.claim.sub, wie PostgREST).
CREATE FUNCTION harness.call(p_user uuid, p_match uuid, p_events jsonb) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
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
-- Beliebige SQL als Client-Rolle; 'ok:<Zeilen>' oder 'error:<SQLSTATE>:<Meldung>'.
CREATE FUNCTION harness.exec(p_user uuid, p_sql text, p_role text) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_rows bigint; v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('role', p_role, true);
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v := 'ok:' || v_rows;
  EXCEPTION WHEN OTHERS THEN
    v := 'error:' || SQLSTATE || ':' || SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
-- reset_match_results als Client-Rolle (dynamisch: vor der Migration gibt es die Funktion nicht -> 42883).
CREATE FUNCTION harness.reset(p_user uuid, p_tournament uuid, p_ids uuid[], p_role text) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('role', p_role, true);
  BEGIN
    EXECUTE 'SELECT public.reset_match_results($1, $2)' INTO v USING p_tournament, p_ids;
  EXCEPTION WHEN OTHERS THEN
    v := jsonb_build_object('exception', SQLSTATE, 'message', SQLERRM);
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA harness TO anon, authenticated, service_role;
SQL
  # auth.jwt(): Schema auth gehoert nicht postgres -> als supabase_admin anlegen.
  docker exec -i -e PGPASSWORD=postgres -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -h localhost -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -q <<'SQL'
-- Das Image kennt auth.jwt() nicht (die INSERT-Policy auf tournaments ruft sie); Nachbau nur im Wegwerf-Container,
-- liest die Claims wie PostgREST (leer = kein anonymes Konto).
DO $do$
BEGIN
  IF to_regprocedure('auth.jwt()') IS NULL THEN
    EXECUTE $f$CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      'SELECT coalesce(nullif(current_setting(''request.jwt.claims'', true), ''''), ''{}'')::jsonb'$f$;
    GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
  END IF;
END;
$do$;
SQL
}

# Daten: Turnier "Live-Cup" (Eigentuemer Olli), Mitglieder, Spiele. Alles VOR der Ziel-Migration, damit der Lauf
# ohne Migration dieselben Daten hat.
setup_data() {
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@a10.test'), ('$U_MARIA'::uuid, 'maria@a10.test'), ('$U_TOM'::uuid, 'tom@a10.test'),
             ('$U_TRAINER'::uuid, 'trainer@a10.test'), ('$U_VIEWER'::uuid, 'viewer@a10.test'),
             ('$U_STRANGER'::uuid, 'stranger@a10.test')) AS u(id, email);
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES ('$T', '$U_OLLI', 'Live-Cup', '2026-10-28', 4, 10, '{}'::jsonb),
       ('$T_OTHER', '$U_STRANGER', 'Fremder Cup', '2026-10-28', 2, 10, '{}'::jsonb),
       ('$T_TRASH', '$U_OLLI', 'Alter Cup', '2026-10-28', 2, 10, '{}'::jsonb);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at)
VALUES ('$T', '$U_MARIA', 'co-admin', now()), ('$T', '$U_TOM', 'collaborator', now()),
       ('$T', '$U_TRAINER', 'trainer', now()), ('$T', '$U_VIEWER', 'viewer', now());
INSERT INTO public.teams (id, tournament_id, name) VALUES
  ('$SG_MITTE', '$T', 'SG Mitte'), ('$VFB_UFER', '$T', 'VfB Ufer'), ('$FC_NORD', '$T', 'FC Nord'), ('$SV_SUED', '$T', 'SV Süd'),
  ('$OTHER_A', '$T_OTHER', 'A'), ('$OTHER_B', '$T_OTHER', 'B'), ('$TRASH_A', '$T_TRASH', 'A'), ('$TRASH_B', '$T_TRASH', 'B');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start, score_a, score_b) VALUES
  ('$S3',  '$T', 1, 1, '$SG_MITTE', '$VFB_UFER', 3, '14:00', NULL, NULL),
  ('$S4',  '$T', 1, 2, '$FC_NORD', '$SV_SUED', 4, '14:00', NULL, NULL),
  ('$S5',  '$T', 2, 1, '$SG_MITTE', '$FC_NORD', 5, '14:30', NULL, NULL),
  ('$S6',  '$T', 2, 2, '$VFB_UFER', '$SV_SUED', 6, '14:30', NULL, NULL),
  ('$S7',  '$T', 3, 1, '$FC_NORD', '$SV_SUED', 7, '15:00', NULL, NULL),
  ('$S9',  '$T', 3, 2, '$SG_MITTE', '$SV_SUED', 9, '15:00', NULL, NULL),
  ('$S10', '$T', 4, 1, '$VFB_UFER', '$FC_NORD', 10, '15:30', NULL, NULL),
  ('$S11', '$T', 4, 2, '$SG_MITTE', '$VFB_UFER', 11, '15:30', NULL, NULL),
  ('$S12', '$T', 5, 1, '$FC_NORD', '$SG_MITTE', 12, '16:00', NULL, NULL),
  ('$M_OTHER', '$T_OTHER', 1, 1, '$OTHER_A', '$OTHER_B', 1, '14:00', 1, 0),
  ('$M_TRASH', '$T_TRASH', 1, 1, '$TRASH_A', '$TRASH_B', 1, '14:00', 1, 0);
SQL
  # @EK-060 Gegeben: Olli hat Spiel 3 direkt 3:1 eingetragen, ohne Eintraege (vor A-10 erlaubt); dazu Spiel 4 1:0 (Maria-Fall).
  local out
  out="$(client "$U_OLLI" "UPDATE public.matches SET score_a = 3, score_b = 1, match_status = 'finished' WHERE id = '$S3'")"
  [[ "$out" == "ok:1" ]] || { echo "::error::Vorbereitung Spiel 3 (Olli traegt 3:1 ein): $out" >&2; exit 1; }
  out="$(client "$U_OLLI" "UPDATE public.matches SET score_a = 1, score_b = 0, match_status = 'finished' WHERE id = '$S4'")"
  [[ "$out" == "ok:1" ]] || { echo "::error::Vorbereitung Spiel 4: $out" >&2; exit 1; }
  # Spiel 7: Tom pfeift, FC Nord 2 Tore (das zweite ohne Rueckennummer), SV Sued 1 Tor, Abpfiff = 5 Eintraege, 2:1.
  ev MATCH_START "$(E s7-start)" '{"clockMs":null}'
  ev GOAL "$(E s7-goal1)" "{\"at\":2000,\"clockMs\":1000,\"teamId\":\"$FC_NORD\",\"payload\":{\"playerNumber\":10}}"
  ev GOAL "$(E s7-goal2)" "{\"at\":3000,\"clockMs\":2000,\"teamId\":\"$FC_NORD\"}"
  ev GOAL "$(E s7-goal3)" "{\"at\":4000,\"clockMs\":3000,\"teamId\":\"$SV_SUED\"}"
  ev MATCH_END "$(E s7-end)" '{"at":601000,"clockMs":600000}'
  send "$U_TOM" "$S7"; out="$OUT"
  [[ "$(statuses_of "$out")" == "accepted,accepted,accepted,accepted,accepted" ]] || { echo "::error::Vorbereitung Spiel 7: $out" >&2; exit 1; }
  # Z4-Faelle: nur SKIP (Spiel 10), nur zurueckgenommenes Tor (Spiel 11), Direkteintrag (Spiel 12).
  ev SKIP "$(E s10-skip)"
  send "$U_OLLI" "$S10"; out="$OUT"
  [[ "$(status_of "$out")" == "accepted" ]] || { echo "::error::Vorbereitung Spiel 10: $out" >&2; exit 1; }
  ev MATCH_START "$(E s11-start)" '{"clockMs":null}'
  ev GOAL "$(E s11-goal)" "{\"at\":2000,\"clockMs\":1000,\"teamId\":\"$SG_MITTE\"}"
  ev RETRACT "$(E s11-retract)" "{\"at\":3000,\"clockMs\":2000,\"targetId\":\"$(E s11-goal)\"}"
  send "$U_OLLI" "$S11"; out="$OUT"
  [[ "$(statuses_of "$out")" == "accepted,accepted,accepted" ]] || { echo "::error::Vorbereitung Spiel 11: $out" >&2; exit 1; }
  ev RESULT_ENTRY "$(E s12-entry)" "{\"payload\":{\"scores\":{\"$FC_NORD\":2,\"$SG_MITTE\":0}}}"
  send "$U_OLLI" "$S12"; out="$OUT"
  [[ "$(status_of "$out")" == "accepted" ]] || { echo "::error::Vorbereitung Spiel 12: $out" >&2; exit 1; }
}

# ---------------------------------------------------------------------------------------------------------
# Proben (gemeinsam fuer normalen Lauf, ohne Migration und Gegenprobe)
# ---------------------------------------------------------------------------------------------------------
run_probes() {
  local out res before after v_before

  # --- A: Spalten-Schutz ---------------------------------------------------------------------------------
  res="$(client "$U_TOM" "UPDATE public.matches SET score_a = 1, score_b = 1 WHERE id = '$S3'")"
  check A "@EK-060 Tom aendert Spiel 3 (3:1, ohne Eintraege) direkt auf 1:1 -> Server lehnt ab (42501, Spalten-Schutz)" "42501+guard" "$(guard_class "$res")"
  check A "@EK-060 Spiel 3 steht weiter mit 3:1" "3|1|finished" "$(score_of "$S3")"
  check A "@EK-060 Verlauf von Spiel 3 enthaelt keine Aenderung (0 Eintraege)" "0" "$(events_of "$S3")"
  res="$(client "$U_OLLI" "UPDATE public.matches SET score_a = 4 WHERE id = '$S3'")"
  check A "Eigentuemer Olli aendert score_a von Spiel 3 direkt -> 42501 (unbedingt)" "42501+guard" "$(guard_class "$res")"
  res="$(client "$U_MARIA" "UPDATE public.matches SET score_b = 0 WHERE id = '$S3'")"
  check A "Co-Admin Maria aendert score_b von Spiel 3 direkt -> 42501" "42501+guard" "$(guard_class "$res")"
  res="$(client "$U_TOM" "UPDATE public.matches SET score_b = 2 WHERE id = '$S7'")"
  check A "@EK-031 Tom korrigiert Spiel 7 direkt an der Schnittstelle (score_b 2) -> 42501" "42501+guard" "$(guard_class "$res")"
  check A "@EK-031 Spiel 7 steht weiter mit 2:1" "2|1|finished" "$(score_of "$S7")"
  res="$(client "$U_TOM" "UPDATE public.matches SET match_status = 'skipped' WHERE id = '$S5'")"
  check A "@HE-042 Tom markiert das geplante Spiel 5 als ausgefallen (match_status) -> 42501" "42501+guard" "$(guard_class "$res")"
  res="$(client "$U_TOM" "UPDATE public.matches SET skipped_at = now(), skipped_reason = 'Halle' WHERE id = '$S5'")"
  check A "@HE-042 Tom setzt skipped_at/skipped_reason an Spiel 5 -> 42501" "42501+guard" "$(guard_class "$res")"
  local denied=0 detail="" assignment
  for assignment in "score_a = 5" "score_b = 5" "overtime_score_a = 1" "overtime_score_b = 1" "penalty_score_a = 1" \
      "penalty_score_b = 1" "match_status = 'running'" "decided_by = 'regular'" "timer_start_time = '2020-01-01T00:00:00Z'" \
      "timer_paused_at = '2020-01-01T00:00:00Z'" "timer_elapsed_seconds = 99" "live_state = '{\"x\":1}'" \
      "actual_start = '2020-01-01T00:00:00Z'" "actual_end = '2020-01-01T00:00:00Z'" "skipped_at = '2020-01-01T00:00:00Z'" \
      "skipped_reason = 'x'"; do
    res="$(client "$U_TOM" "UPDATE public.matches SET $assignment WHERE id = '$S3'")"
    if [[ "$(guard_class "$res")" == "42501+guard" ]]; then denied=$((denied + 1)); else detail+="[$assignment -> $res] "; fi
  done
  check A "Tom: jede der 16 Schutzspalten am Altspiel 3 -> 42501 $detail" "16" "$denied"
  check A "Gegenbeispiel: Tom aendert die freie Spalte referee_number an Spiel 3 (writeMatchData bleibt)" "ok:1" \
    "$(client "$U_TOM" "UPDATE public.matches SET referee_number = 3 WHERE id = '$S3'")"
  check A "Gegenbeispiel: Tom schreibt score_a mit gleichem Wert (keine Aenderung) -> ok" "ok:1" \
    "$(client "$U_TOM" "UPDATE public.matches SET score_a = score_a, match_status = match_status WHERE id = '$S3'")"
  check A "Gegenbeispiel: service_role (Server) darf Schutzspalten schreiben" "ok:1" \
    "$(client "" "UPDATE public.matches SET penalty_score_a = NULL, score_a = 0 WHERE id = '$S6'" service_role)"
  q "UPDATE public.matches SET score_a = NULL WHERE id = '$S6';" >/dev/null
  # L7: INSERT neutral.
  res="$(client "$U_OLLI" "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, score_a, score_b, overtime_score_a, overtime_score_b, penalty_score_a, penalty_score_b, match_status, decided_by, timer_start_time, timer_paused_at, timer_elapsed_seconds, live_state, actual_start, actual_end, skipped_at, skipped_reason) VALUES ('$M_INS', '$T', 9, 1, '$SG_MITTE', '$VFB_UFER', 3, 2, 1, 1, 4, 3, 'finished', 'regular', now(), now(), 50, '{\"x\":1}', now(), now(), now(), 'x')")"
  check A "L7 Olli legt ein Spiel mit Ergebnis an -> angelegt (kein Fehler)" "ok:1" "$res"
  check A "L7 gespeichert neutral (NULL, scheduled, Uhr 0)" "$NEUTRAL" "$(neutral_of "$M_INS")"
  res="$(client "$U_OLLI" "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, score_a, score_b, match_status, timer_elapsed_seconds) VALUES ('$M_INS_NEUTRAL', '$T', 9, 2, '$SG_MITTE', '$VFB_UFER', NULL, NULL, 'scheduled', 0)")"
  check A "L7 Gegenbeispiel: neutral angelegtes Spiel (wie mapMatchToSupabase) bleibt neutral" "ok:1|$NEUTRAL" "$res|$(neutral_of "$M_INS_NEUTRAL")"

  # --- E: Engine-Weg (Bestand) ---------------------------------------------------------------------------
  before="$(events_of "$S7")"
  ev CORRECTION "$(E s7-corr-tom)" "{\"at\":700000,\"clockMs\":600000,\"payload\":{\"scores\":{\"$FC_NORD\":2,\"$SV_SUED\":2},\"reason\":\"Eingabefehler\",\"basedOn\":\"$(E s7-goal3)\"}}"
  send "$U_TOM" "$S7"; out="$OUT"
  check E "@EK-031 Toms Korrektur von Spiel 7 auf 2:2 ueber append_match_events -> FORBIDDEN_ACTOR" "FORBIDDEN_ACTOR" "$(code_of "$out")"
  ev RETRACT "$(E s7-retract-tom)" "{\"at\":700000,\"clockMs\":600000,\"targetId\":\"$(E s7-goal1)\"}"
  send "$U_TOM" "$S7"; out="$OUT"
  check E "@FU-055 Tom nimmt ein Tor des beendeten Spiels 7 zurueck -> FORBIDDEN_ACTOR" "FORBIDDEN_ACTOR" "$(code_of "$out")"
  ev REOPEN "$(E s7-reopen-tom)" '{"at":801000,"clockMs":600000}'
  send "$U_TOM" "$S7"; out="$OUT"
  check E "@HE-042 Tom eroeffnet das beendete Spiel 7 nach der Frist wieder -> FORBIDDEN_ACTOR" "FORBIDDEN_ACTOR" "$(code_of "$out")"
  check E "@EK-031 Spiel 7 steht weiter 2:1, Verlauf ohne Korrektur (Eintraege unveraendert)" "2|1|finished|$before" "$(score_of "$S7")|$(events_of "$S7")"
  ev RESULT_ENTRY "$(E s6-entry-tom)" "{\"payload\":{\"scores\":{\"$VFB_UFER\":1,\"$SV_SUED\":0}}}"
  send "$U_TOM" "$S6"; out="$OUT"
  check E "@HE-042 Tom traegt ein Ergebnis direkt im Spielplan ein (RESULT_ENTRY) -> FORBIDDEN_ACTOR" "FORBIDDEN_ACTOR" "$(code_of "$out")"
  ev SKIP "$(E s5-skip-tom)"
  send "$U_TOM" "$S5"; out="$OUT"
  check E "@HE-042 Tom markiert Spiel 5 als ausgefallen (SKIP) -> FORBIDDEN_ACTOR" "FORBIDDEN_ACTOR" "$(code_of "$out")"
  before="$(cr)"
  ev MATCH_START "$(E s9-start)" '{"clockMs":null}'
  send "$U_TOM" "$S9"; out="$OUT"
  check E "@HE-042 Gegenbeispiel: Tom pfeift Spiel 9 an" "accepted" "$(status_of "$out")"
  ev GOAL "$(E s9-goal1)" "{\"at\":2000,\"clockMs\":1000,\"teamId\":\"$SG_MITTE\"}"
  send "$U_TOM" "$S9"; out="$OUT"
  check E "@EK-060 Gegenbeispiel: Tom traegt ein Tor ueber append_match_events ein -> angenommen, Zwischenspeicher score_a 1" \
    "accepted|1|0|running" "$(status_of "$out")|$(score_of "$S9")"
  ev RETRACT "$(E s9-retract)" "{\"at\":3000,\"clockMs\":2000,\"targetId\":\"$(E s9-goal1)\"}"
  ev GOAL "$(E s9-goal2)" "{\"at\":4000,\"clockMs\":3000,\"teamId\":\"$SG_MITTE\"}"
  ev MATCH_END "$(E s9-end)" '{"at":601000,"clockMs":600000}'
  send "$U_TOM" "$S9"; out="$OUT"
  check E "@HE-042 Gegenbeispiel: Tor zuruecknehmen, neues Tor, Spiel beenden -> angenommen, 1:0 beendet" \
    "accepted,accepted,accepted|1|0|finished" "$(statuses_of "$out")|$(score_of "$S9")"
  check C "Ergebnis ueber append_match_events (Anpfiff bis Abpfiff Spiel 9) -> change_revision unveraendert" "$before" "$(cr)"

  # --- B: reset_match_results ----------------------------------------------------------------------------
  before="$(cr)"
  out="$(reset "$U_OLLI" "$T" "$S3,$S7")"
  check B "@FU-090 Olli setzt [Spiel 3, Spiel 7] zurueck -> rejected HAS_ENTRIES, matchIds = [Spiel 7]" \
    "rejected|HAS_ENTRIES|[\"$S7\"]" "$(jq -r '"\(.status // .exception)|\(.code // "-")|\(.matchIds // [] | tojson)"' <<<"$out")"
  check B "@FU-090 alles oder nichts: Spiel 3 bleibt 3:1" "3|1|finished" "$(score_of "$S3")"
  check B "@FU-090 Spiel 7 behaelt alle 5 Eintraege und 2:1" "2|1|finished|5" "$(score_of "$S7")|$(events_of "$S7")"
  check B "@FU-090 abgelehnt -> change_revision unveraendert" "$before" "$(cr)"
  # Zwilling Z4: TS liest "hat Eintraege" an der Server-Revision (matches.version > 1, useMatchEntryGuard); dieselben
  # Spiele haben hier Engine-Ereignisse. Altbestand ohne Ereignisse steht auf Revision 1.
  res="$(q "SELECT (SELECT version FROM public.matches WHERE id = '$S10') || '|' || (SELECT version FROM public.matches WHERE id = '$S11') || '|' || (SELECT version FROM public.matches WHERE id = '$S12') || '|' || (SELECT version FROM public.matches WHERE id = '$S3');")"
  check B "Z4: Revision > 1 bei nur SKIP / nur zurueckgenommenem Tor / Direkteintrag, Altbestand Spiel 3 = 1 ($res)" "true" \
    "$(awk -F'|' '{print ($1 > 1 && $2 > 1 && $3 > 1 && $4 == 1) ? "true" : "false"}' <<<"$res")"
  out="$(reset "$U_OLLI" "$T" "$S10")"
  check B "Z4: Spiel nur mit SKIP gilt als 'hat Eintraege' -> HAS_ENTRIES" "HAS_ENTRIES" "$(jq -r '.code // .exception' <<<"$out")"
  out="$(reset "$U_OLLI" "$T" "$S11")"
  check B "Z4: Spiel nur mit zurueckgenommenem Tor gilt als 'hat Eintraege' -> HAS_ENTRIES" "HAS_ENTRIES" "$(jq -r '.code // .exception' <<<"$out")"
  out="$(reset "$U_OLLI" "$T" "$S12")"
  check B "Z4: Spiel mit Direkteintrag gilt als 'hat Eintraege' -> HAS_ENTRIES" "HAS_ENTRIES" "$(jq -r '.code // .exception' <<<"$out")"
  for who in tom trainer viewer stranger; do
    local uid
    case "$who" in tom) uid="$U_TOM" ;; trainer) uid="$U_TRAINER" ;; viewer) uid="$U_VIEWER" ;; stranger) uid="$U_STRANGER" ;; esac
    out="$(reset "$uid" "$T" "$S3")"
    check B "Rechte: $who setzt Spiel 3 zurueck -> 42501 (nur Turnierleitung)" "42501" "$(jq -r '.exception // .status' <<<"$out")"
  done
  out="$(reset "" "$T" "$S3" anon)"
  check B "Rechte: anon hat kein EXECUTE -> 42501" "42501" "$(jq -r '.exception // .status' <<<"$out")"
  check B "Rechte: nach den Ablehnungen steht Spiel 3 weiter 3:1" "3|1|finished" "$(score_of "$S3")"
  q "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_TRASH';" >/dev/null
  out="$(reset "$U_OLLI" "$T_TRASH" "$M_TRASH")"
  check B "Turnier im Papierkorb -> 42501 wie fehlendes Recht, Spiel unveraendert" "42501|1|0|scheduled" "$(jq -r '.exception // .status' <<<"$out")|$(score_of "$M_TRASH")"
  out="$(reset "$U_OLLI" "$T" "$M_OTHER")"
  check B "Spiel eines fremden Turniers -> 22023" "22023" "$(jq -r '.exception // .status' <<<"$out")"
  out="$(reset "$U_OLLI" "$T" "")"
  check B "Leere Spielliste -> 22023" "22023" "$(jq -r '.exception // .status' <<<"$out")"
  v_before="$(version_of "$S3")"
  before="$(cr)"
  out="$(reset "$U_OLLI" "$T" "$S3")"
  check B "Gegenbeispiel @EK-060/@FU-090: Olli setzt Spiel 3 (ohne Eintraege) zurueck -> ok, 1 Spiel" "ok|1" "$(jq -r '"\(.status // .exception)|\(.reset // "-")"' <<<"$out")"
  check B "Spiel 3 danach neutral (Zwilling Z3)" "$NEUTRAL" "$(neutral_of "$S3")"
  check B "Z4/F3: matches.version von Spiel 3 unveraendert" "$v_before" "$(version_of "$S3")"
  check B "Z4: Verlauf von Spiel 3 weiter leer (match_events unberuehrt)" "0" "$(events_of "$S3")"
  check B "change_revision +1 nach dem Zuruecksetzen" "$(plus1 "$before")" "$(cr)"
  out="$(reset "$U_OLLI" "$T" "$S3")"
  check B "Zweites Zuruecksetzen ohne Aenderung -> ok, 0 Spiele, change_revision unveraendert" "ok|0|$(plus1 "$before")" "$(jq -r '"\(.status // .exception)|\(.reset // "-")"' <<<"$out")|$(cr)"
  out="$(reset "$U_MARIA" "$T" "$S4")"
  check B "Gegenbeispiel Rechte: Co-Admin Maria setzt Spiel 4 zurueck -> ok" "ok|1|NULL|NULL|scheduled" "$(jq -r '"\(.status // .exception)|\(.reset // "-")"' <<<"$out")|$(score_of "$S4")"

  # --- E (Fortsetzung, aendert Spiel 7): @FU-056 und Korrektur der Turnierleitung ------------------------
  ev AMEND "$(E s7-amend-9)" "{\"at\":700000,\"clockMs\":600000,\"targetId\":\"$(E s7-goal2)\",\"payload\":{\"playerNumber\":9}}"
  send "$U_TOM" "$S7"; out="$OUT"
  check E "@FU-056 Tom traegt Rueckennummer 9 nach -> gelingt, Spielstand bleibt 2:1" "accepted|2|1|finished" "$(status_of "$out")|$(score_of "$S7")"
  ev CORRECTION "$(E s7-corr-olli)" "{\"at\":700100,\"clockMs\":600000,\"payload\":{\"scores\":{\"$FC_NORD\":2,\"$SV_SUED\":2},\"reason\":\"Eingabefehler\",\"basedOn\":\"$(E s7-goal3)\"}}"
  send "$U_OLLI" "$S7"; out="$OUT"
  check E "@EK-031 Gegenbeispiel: Ollis Korrektur von Spiel 7 auf 2:2 -> angenommen" "accepted|2|2|finished" "$(status_of "$out")|$(score_of "$S7")"

  # --- C: change_revision --------------------------------------------------------------------------------
  check C "Spalte tournaments.change_revision bigint NOT NULL DEFAULT 0" "bigint|NO|0" \
    "$(q "SELECT data_type || '|' || is_nullable || '|' || coalesce(column_default, '') FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'change_revision';")"
  before="$(cr)"
  res="$(client "$U_MARIA" "UPDATE public.matches SET scheduled_start = '14:40' WHERE id = '$S5'")"
  check C "@FU-089/@TM-027 Maria verschiebt Spiel 5 auf 14:40 (ohne Versions-CAS) -> change_revision +1" "ok:1|$(plus1 "$before")" "$res|$(cr)"
  before="$(cr)"
  res="$(client "$U_TOM" "UPDATE public.matches SET referee_number = 7 WHERE id = '$S5'")"
  check C "Helfer Tom (ohne Schreibrecht auf tournaments) aendert eine Spielplan-Spalte -> change_revision +1" "ok:1|$(plus1 "$before")" "$res|$(cr)"
  before="$(cr)"
  res="$(client "$U_TOM" "UPDATE public.matches SET referee_number = 7 WHERE id = '$S5'")"
  check C "Gegenbeispiel: gleicher Wert -> change_revision unveraendert" "ok:1|$before" "$res|$(cr)"
  before="$(cr)"
  res="$(client "$U_MARIA" "UPDATE public.matches SET team_a_id = '$FC_NORD', team_b_id = '$SG_MITTE' WHERE id = '$S5'")"
  check C "@TM-027 Seiten von Spiel 5 neu besetzt (team_a_id/team_b_id, eine Zeile) -> change_revision +1" "ok:1|$(plus1 "$before")" "$res|$(cr)"
  before="$(cr)"
  res="$(client "$U_OLLI" "UPDATE public.tournaments SET config = config || '{\"publishedAt\":\"2026-10-28T00:00:00Z\"}'::jsonb, is_public = true WHERE id = '$T'")"
  check C "Olli gibt das Turnier frei (is_public-Kaskade auf matches) -> change_revision unveraendert" "ok:1|$before|t" \
    "$res|$(cr)|$(q "SELECT bool_and(is_public) FROM public.matches WHERE tournament_id = '$T';")"
  res="$(client "$U_OLLI" "UPDATE public.tournaments SET change_revision = 99 WHERE id = '$T'")"
  check C "Client setzt die Zaehlung -> HF004, Wert unveraendert" "error:HF004|$before" "${res%%:*}:$(cut -d: -f2 <<<"$res")|$(cr)"
  check C "Client schreibt die Zaehlung mit gleichem Wert -> ok" "ok:1" "$(client "$U_OLLI" "UPDATE public.tournaments SET change_revision = change_revision WHERE id = '$T'")"
  res="$(client "$U_OLLI" "INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config, change_revision) VALUES ('$T_INS', '$U_OLLI', 'Neu', '2026-10-28', 2, 10, '{}'::jsonb, 5)")"
  check C "Client-INSERT mit change_revision 5 -> gespeichert 0" "ok:1|0" "$res|$(cr "$T_INS")"
  # Voll-Speichern (SupabaseRepository.save): erst CAS version V -> V+1, danach Spiel-Updates.
  local v
  v="$(q "SELECT version FROM public.tournaments WHERE id = '$T';")"
  before="$(cr)"
  res="$(client "$U_OLLI" "UPDATE public.tournaments SET version = $((v + 1)), location_name = 'Halle Zwei' WHERE id = '$T' AND version = $v")"
  res+="|$(client "$U_OLLI" "UPDATE public.matches SET scheduled_start = '14:50' WHERE id = '$S6'")"
  check C "Voll-Speichern: CAS version V->V+1, dann Anstosszeit Spiel 6 -> version genau V+1, change_revision +1" \
    "ok:1|ok:1|$((v + 1))|$(plus1 "$before")" "$res|$(q "SELECT version FROM public.tournaments WHERE id = '$T';")|$(cr)"
  check C "Voll-Speichern: zweites Speichern mit Basis V+1 gelingt (kein OptimisticLockError)" "ok:1" \
    "$(client "$U_OLLI" "UPDATE public.tournaments SET version = $((v + 2)), location_name = 'Halle Drei' WHERE id = '$T' AND version = $((v + 1))")"
}

# run_assertions -- Rechte-Assertion als ci_schema_reader; 8 neue Namen; Namensliste = db-drift-check.sh.
run_assertions() {
  local priv names_sql names_sh
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  # CA-2: ebenso die drei Zeilen von 20261110_004 (laeuft hier erst nach dem Rueckweg).
  # UR: Zeilen SPAETERER Migrationen (20261028_006) sind im normalen Lauf erwartungsgemaess f -- dort laufen die
  # spaeteren Migrationen erst nach dem Rueckweg (A5, wie match-kit-check.sh). A-11 (20261110_001) laeuft hier nie (s. o.).
  # A-16 (20261110_008): die helper-join-*-Zeilen der spaeteren Migration sind hier f (laeuft erst am Ende).
  # B-48b: die zwei Zeilen monitor-heartbeat-* der spaeteren Migration 20261113_101 sind hier f (laeuft erst am Ende).
  check S "Rechte-Assertion: keine Zeile |f (ausser Zeilen der spaeteren Migrationen 20261028_006, 20261110_001)" "" \
    "$(grep -v '|t$' <<<"$priv" | grep -vE '^(positive-ci-schema-reader-select-field-control|positive-ci-schema-reader-select-match-corrections|match-event-author-names-|role-permissions-check-mvp-rights|matches-update-only-manage-schedule|monitors-writes-manage-screens|role-checks-device-roles|has-permission-device-roles-for-anonymous|tournaments-insert-real-account-only|anon-no-write-public-tables|device-roles-guard-trigger|hook-before-user-created-auth-admin-only|auth-users-block-anonymous-upgrade|field-control-|append-match-events-checks-field-control|share-rpcs-permission-based|make-public-keeps-existing-code|heartbeats-select-manage-screens|helper-join-[a-z0-9-]+|monitor-heartbeat-[a-z0-9-]+|matches-guard-engine-columns-forfeit-absent|append-match-events-writes-forfeit-absent|group-completion-|complete-group-locks-matches-before-tournament|ci-schema-reader-select-group-completion)' || true)"
  check S "Rechte-Assertion: die 8 A-10-Zeilen vorhanden und |t" \
    "matches-bump-change-revision-definer-no-client-execute|t,matches-bump-change-revision-trigger-active|t,matches-guard-engine-columns-insert-and-update|t,matches-guard-engine-columns-unconditional|t,reset-match-results-definer-search-path|t,reset-match-results-execute-only-authenticated|t,tournaments-guard-change-revision-invoker-no-client-execute|t,tournaments-guard-change-revision-trigger-active|t" \
    "$(grep -E '^(matches-guard-engine-columns-(insert-and-update|unconditional)|reset-match-results|matches-bump-change-revision|tournaments-guard-change-revision)' <<<"$priv" | sort | paste -sd, -)"
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
  # Mutationen der Migration (Brief A-10 Abschnitt 9). Muster je genau einmal vorhanden, sonst Abbruch.
  export M1_FROM=$'      RAISE EXCEPTION\n        \'Nicht erlaubt: Spielstand'
  export M1_TO=$'      IF public.match_has_engine_events(OLD.id) THEN RAISE EXCEPTION\n        \'Nicht erlaubt: Spielstand'
  export M1B_FROM=$'        USING ERRCODE = \'insufficient_privilege\';\n    END IF;'
  export M1B_TO=$'        USING ERRCODE = \'insufficient_privilege\'; END IF;\n    END IF;'
  export M2_FROM=$'  BEFORE INSERT OR UPDATE ON public.matches\n  FOR EACH ROW EXECUTE FUNCTION public.matches_guard_engine_columns();'
  export M2_TO=$'  BEFORE UPDATE ON public.matches\n  FOR EACH ROW EXECUTE FUNCTION public.matches_guard_engine_columns();'
  export M3_FROM="  IF cardinality(v_with_entries) > 0 THEN"
  export M3_TO="  IF false THEN"
  export M4_FROM="OR NOT public.has_tournament_permission(p_tournament_id, 'leadMatches') THEN"
  export M4_TO="OR NOT public.has_tournament_permission(p_tournament_id, 'writeMatchData') THEN"
  export M5_FROM="  UPDATE public.tournaments SET change_revision = change_revision + 1 WHERE id = NEW.tournament_id;"
  export M5_TO="  NULL;"
  export M6_FROM="$M5_FROM"
  export M6_TO="  UPDATE public.tournaments SET version = coalesce(version, 1) + 1 WHERE id = NEW.tournament_id;"
  export M7_FROM=$'    updated_at = now()\n   WHERE m.id = ANY (v_ids)'
  export M7_TO=$'    updated_at = now(), version = m.version + 1\n   WHERE m.id = ANY (v_ids)'
  RED_TOTAL=0
  for mut in M1 M2 M3 M4 M5 M6 M7; do
    start_container "$mut"
    setup_before
    keys="$mut"; [[ "$mut" == "M1" ]] && keys="M1 M1B"
    MUT_KEYS="$keys" python3 -c '
import os, sys
s = sys.stdin.read()
for k in os.environ["MUT_KEYS"].split():
    frm = os.environ[k + "_FROM"]
    if s.count(frm) != 1:
        sys.exit("Gegenprobe: Muster %s nicht genau einmal in der Migration (%d)" % (k, s.count(frm)))
    s = s.replace(frm, os.environ[k + "_TO"])
sys.stdout.write(s)' < "$TARGET_FILE" | psql_stdin
    for f in ${AFTER[@]+"${AFTER[@]}"}; do psql_stdin < "$f"; done
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
  echo "Gegenprobe: $RED_TOTAL von 7 Mutationen rot."
  [[ "$RED_TOTAL" -eq 7 ]]
  exit $?
fi

start_container "$MODE"
setup_before

if [[ "$MODE" == "without-migration" ]]; then
  for f in ${AFTER[@]+"${AFTER[@]}"}; do psql_stdin < "$f"; done
  run_probes
  summary
  A_DEV="${DEVS[$(cat_index A)]}"; B_DEV="${DEVS[$(cat_index B)]}"; C_DEV="${DEVS[$(cat_index C)]}"; E_DEV="${DEVS[$(cat_index E)]}"
  if [[ "$A_DEV" -gt 0 && "$B_DEV" -gt 0 && "$C_DEV" -gt 0 && "$E_DEV" -eq 0 ]]; then
    echo "Ohne Migration: A, B, C rot, E gruen -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (A=$A_DEV, B=$B_DEV, C=$C_DEV muessen > 0 sein, E=$E_DEV muss 0 sein)."
  exit 1
fi

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE"
# UR: spaetere Migrationen (AFTER, z. B. 20261028_006) erst nach dem Rueckweg (A5, wie match-kit-check.sh) --
# vorher wuerden die Katalogzaehlung (S) und der Rueckweg-Vergleich (X) sie mitmessen.
check C "Bestand: change_revision aller Turniere 0, Spiel 3 unveraendert 3:1" "0|3|1|finished" \
  "$(q "SELECT count(*) FROM public.tournaments WHERE change_revision <> 0;")|$(score_of "$S3")"

# --- S: Schema ---------------------------------------------------------------------------------------------
check S "Trigger: matches_guard_engine_columns BEFORE INSERT OR UPDATE ROW (23), matches_bump_change_revision AFTER UPDATE ROW (17), tournaments_guard_change_revision BEFORE INSERT OR UPDATE ROW (23), alle aktiv" \
  "matches_bump_change_revision|17|O,matches_guard_engine_columns|23|O,tournaments_guard_change_revision|23|O" \
  "$(q "SELECT string_agg(tgname || '|' || tgtype || '|' || tgenabled::text, ',' ORDER BY tgname) FROM pg_trigger WHERE tgname IN ('matches_guard_engine_columns','matches_bump_change_revision','tournaments_guard_change_revision');")"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in columns functions triggers tables policies indexes rls_tables; do
  expected=0
  # Funktionen +3 (Schutz change_revision, Bump, reset_match_results), Trigger +2 (der Spalten-Schutz-Trigger besteht
  # schon und wird nur ersetzt), Spalten +1.
  case "$dim" in columns) expected=1 ;; functions) expected=3 ;; triggers) expected=2 ;; esac
  check S "Katalogzaehlung $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done

run_probes
run_assertions

# --- W: idempotent -----------------------------------------------------------------------------------------
set +e
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
W_EXIT=$?
set -e
check W "zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check W "danach genau 3 Trigger, Werte unveraendert (Spiel 7 2:2, Spiel 3 neutral)" "3|2|2|finished|$NEUTRAL" \
  "$(q "SELECT count(*) FROM pg_trigger WHERE tgname IN ('matches_guard_engine_columns','matches_bump_change_revision','tournaments_guard_change_revision');")|$(score_of "$S7")|$(neutral_of "$S3")"

# --- X: Rueckweg laut Kopfkommentar -----------------------------------------------------------------------
ROLLBACK_DROPS="$(awk '/^-- RUECKWEG/{f=1; next} f && /^--   (DROP|ALTER) /{sub(/^--   /, ""); print; next} f && /^-- Produktion/{exit}' "$TARGET_FILE")"
check X "Rueckweg-Block: 6 DROP/ALTER-Anweisungen" "6" "$(grep -c ';$' <<<"$ROLLBACK_DROPS" || true)"
GUARD_OLD="$(awk '/^CREATE OR REPLACE FUNCTION "public"."matches_guard_engine_columns"\(\)/{f=1} f{print} f && /FOR EACH ROW EXECUTE FUNCTION "public"."matches_guard_engine_columns"\(\);/{exit}' "$AMEND_FILE")"
GUARD_REVOKE="$(grep -E '^REVOKE ALL ON FUNCTION "public"."matches_guard_engine_columns"\(\)' "$AMEND_FILE")"
psql_stdin <<<"BEGIN;
SET LOCAL lock_timeout = '5s';
$ROLLBACK_DROPS
$GUARD_OLD
$GUARD_REVOKE
COMMIT;"
DUMP_ROLLED_BACK="$(schema_dump)"
check X "nach dem Rueckweg: Schema public = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi

# A5: spaetere Migrationen auf dem Zustand NACH dem Rueckweg einspielen -- nur Lauffaehigkeits-Nachweis
# (psql_stdin bricht bei einem Fehler ab). Die Messungen oben sind davon unabhaengig.
for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f"
  echo "OK    A5 spaetere Migration laeuft nach dem Rueckweg: $(basename "$f")" >&2
done

summary
echo
echo "Ergebnis: $(total_dev) Abweichung(en)."
[[ "$(total_dev)" -eq 0 ]]
