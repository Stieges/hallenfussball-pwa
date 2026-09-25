#!/usr/bin/env bash
#
# match-event-log-check.sh — Container-Beweis fuer das Ereignis-Log-Schema
# (supabase/migrations/20260928_001_match_event_log.sql, B2,
# .superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B2-brief.md, Fixrunde 1 nach
# task-B2-review.md: Ruling G3).
#
# Stil: scripts/protect-matches-with-events-check.sh (Wegwerf-Postgres, Baseline + neuere
# Migrationen ueber scripts/lib/migrations-since-baseline.sh, "SET LOCAL ROLE authenticated" +
# "request.jwt.claim.sub" fuer echte RLS-Proben, Testidentitaeten wie im Rechte-Harness
# scripts/rls-role-matrix.sh).
#
# Aufrufoptionen:
#   ./scripts/match-event-log-check.sh            normaler Lauf (Baseline + ALLE neueren
#                                                   Migrationen, inkl. 20260928_001, Guard aktiv)
#                                                   — alle Proben muessen GRUEN sein.
#   ./scripts/match-event-log-check.sh --without-migration
#                                                   Gegenprobe A: Baseline + alle neueren
#                                                   Migrationen AUSSER 20260928_001 — Proben 1, 2a
#                                                   muessen ROT sein (erwarteter Fehlschlag,
#                                                   Exit 0 trotzdem). Beweist NUR den Alt-Trigger/
#                                                   Typ-CHECK, NICHT den Guard (siehe Review I3) --
#                                                   dafuer --without-guard.
#   ./scripts/match-event-log-check.sh --without-guard
#                                                   Gegenprobe B (Ruling G3): Migration vollstaendig
#                                                   einspielen, danach
#                                                   `DROP TRIGGER match_events_guard_engine_rows`.
#                                                   ALLE Guard-Proben (2a-2e, 4a-4b, 4f-Direktweg)
#                                                   muessen jetzt auf "ok" kippen (ROT) — beweist,
#                                                   dass tatsaechlich der GUARD und nicht ein
#                                                   anderer Mechanismus (CHECK/FK) die Proben im
#                                                   Normalmodus ablehnt.
#
# Aendert NICHTS an der Produktionsdatenbank — Wegwerf-Container, wird am Ende entfernt (trap).
#
set -euo pipefail

MODE="with-migration"
if [[ "${1:-}" == "--without-migration" ]]; then
  MODE="without-migration"
elif [[ "${1:-}" == "--without-guard" ]]; then
  MODE="without-guard"
fi

POSTGRES_IMAGE="supabase/postgres:17.6.1.063"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_MIGRATION="20260928_001_match_event_log.sql"
CONTAINER_NAME="match-event-log-check-$$"

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
NEWER_MIGRATIONS_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
NEWER_MIGRATIONS=()
if [[ -n "$NEWER_MIGRATIONS_RAW" ]]; then
  while IFS= read -r line; do
    NEWER_MIGRATIONS+=("$line")
  done <<< "$NEWER_MIGRATIONS_RAW"
fi

FOUND_TARGET=0
BEFORE_TARGET=()
TARGET_FILE=""
for f in "${NEWER_MIGRATIONS[@]}"; do
  if [[ "$(basename "$f")" == "$TARGET_MIGRATION" ]]; then
    FOUND_TARGET=1
    TARGET_FILE="$f"
  elif [[ "$FOUND_TARGET" -ne 1 ]]; then
    BEFORE_TARGET+=("$f")
  fi
done
if [[ "$FOUND_TARGET" -ne 1 ]]; then
  echo "::error::$TARGET_MIGRATION nicht in der Liste 'neuer als Baseline' gefunden." >&2
  exit 1
fi

cleanup() { docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432 \
  "$POSTGRES_IMAGE" >/dev/null

READY=0
for _ in $(seq 1 90); do
  READY_COUNT="$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "database system is ready to accept connections" || true)"
  if [[ "$READY_COUNT" -ge 2 ]]; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "$READY" -ne 1 ]]; then
  echo "::error::Container wurde nach 90s nicht vollstaendig bereit." >&2
  docker logs "$CONTAINER_NAME" 2>&1 | tail -30 >&2
  exit 1
fi
for _ in $(seq 1 30); do
  docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

psql_stdin() {
  docker exec -i "$CONTAINER_NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"
}

uuid_for() {
  local h
  h="$(printf '%s' "match-event-log-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-${h:12:4}-${h:16:4}-${h:20:12}"
}

U_OWNER="$(uuid_for user:owner)"
U_COADMIN="$(uuid_for user:coadmin)"
U_COLLAB="$(uuid_for user:collaborator)"
U_TRAINER="$(uuid_for user:trainer)"
U_VIEWER="$(uuid_for user:viewer)"
U_STRANGER="$(uuid_for user:stranger)"
T_MAIN="$(uuid_for tournament:main)"
M_1="$(uuid_for match:1)"
M_2="$(uuid_for match:2)"
M_LEGACY_UPDATE="$(uuid_for match:legacy-update)"
TEAM_A="$(uuid_for team:a)"
TEAM_B="$(uuid_for team:b)"
T_BESTAND="$(uuid_for tournament:bestand)"
M_BESTAND="$(uuid_for match:bestand)"
EB1="$(uuid_for event:bestand-1)"
EB2="$(uuid_for event:bestand-2)"
EB3="$(uuid_for event:bestand-3)"
T_TEAMDEL="$(uuid_for tournament:teamdel)"
M_TEAMDEL="$(uuid_for match:teamdel)"
TEAM_C="$(uuid_for team:c)"
TEAM_D="$(uuid_for team:d)"
E_TEAMDEL="$(uuid_for event:teamdel)"

echo "[$MODE] Baseline + $(( ${#BEFORE_TARGET[@]} )) Migration(en) vor $TARGET_MIGRATION einspielen..." >&2
psql_stdin < "$BASELINE_FILE"
for f in "${BEFORE_TARGET[@]}"; do
  psql_stdin < "$f"
done

# M1 (task-B2-review.md, Fixrunde 1): "Bestandszeilen" MUESSEN vor 20260928_001 existieren, sonst
# beweist der Backfill-Test nichts (eine frische ADD-COLUMN-Tabelle hat nie Bestandszeilen). Hier
# also VOR dem Einspielen der Zielmigration: Testnutzer + ein eigenes Turnier/Spiel + drei
# Alt-Ereignis-Zeilen (direkt als postgres, so wie echte historische Produktionsdaten -- keine
# RLS-Rolle noetig, das ist Bootstrap, keine Probe).
psql_stdin <<SQL
BEGIN;

INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '$U_OWNER', 'authenticated', 'authenticated', 'owner@match-event-log.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_COADMIN', 'authenticated', 'authenticated', 'coadmin@match-event-log.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_COLLAB', 'authenticated', 'authenticated', 'collab@match-event-log.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_TRAINER', 'authenticated', 'authenticated', 'trainer@match-event-log.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_VIEWER', 'authenticated', 'authenticated', 'viewer@match-event-log.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_STRANGER', 'authenticated', 'authenticated', 'stranger@match-event-log.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES ('$T_BESTAND', '$U_OWNER', 'Match-Event-Log — Bestand', '2026-09-28', 8, 15, '{}'::jsonb);

INSERT INTO public.matches (id, tournament_id, round, field, match_status)
VALUES ('$M_BESTAND', '$T_BESTAND', 1, 1, 'running');

INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away)
VALUES
  ('$EB1', '$M_BESTAND', 'GOAL', 5, 1, 0),
  ('$EB2', '$M_BESTAND', 'GOAL', 15, 2, 0),
  ('$EB3', '$M_BESTAND', 'FOUL', 25, 2, 0);

COMMIT;
SQL

TO_APPLY_TARGET=1
[[ "$MODE" == "without-migration" ]] && TO_APPLY_TARGET=0

if [[ "$TO_APPLY_TARGET" -eq 1 ]]; then
  echo "Zielmigration einspielen: $TARGET_MIGRATION" >&2
  psql_stdin < "$TARGET_FILE"

  # M1: Idempotenz jetzt IM Harness belegen (vorher nur manuell behauptet) -- zweite Anwendung auf
  # einer Tabelle, die bereits Bestandszeilen UND vom ersten Lauf vergebene seq-Werte hat, muss
  # Exit 0 liefern und darf die bestehenden seq-Werte nicht veraendern.
  SEQ_BEFORE_REAPPLY="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT string_agg(id || ':' || seq, ',' ORDER BY id) FROM public.match_events;")"
  echo "Zielmigration ZUM ZWEITEN MAL einspielen (Idempotenz, M1)..." >&2
  psql_stdin < "$TARGET_FILE"
  SEQ_AFTER_REAPPLY="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT string_agg(id || ':' || seq, ',' ORDER BY id) FROM public.match_events;")"
  if [[ "$SEQ_BEFORE_REAPPLY" != "$SEQ_AFTER_REAPPLY" ]]; then
    echo "::error::Idempotenz-Probe (M1): seq-Werte haben sich durch die zweite Anwendung veraendert." >&2
    exit 1
  fi
  echo "OK    M1-Idempotenz: zweite Anwendung Exit 0, seq-Werte unveraendert." >&2
fi

if [[ "$MODE" == "without-guard" ]]; then
  echo "Ruling G3 (Gegenprobe B): DROP TRIGGER match_events_guard_engine_rows..." >&2
  psql_stdin <<'SQL'
DROP TRIGGER match_events_guard_engine_rows ON public.match_events;
SQL
fi

echo "Fixtures anlegen..." >&2
psql_stdin <<SQL
BEGIN;

INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES
  ('$T_MAIN', '$U_OWNER', 'Match-Event-Log — main', '2026-09-28', 8, 15, '{}'::jsonb);

INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at)
VALUES
  ('$(uuid_for membership:coadmin)', '$T_MAIN', '$U_COADMIN', 'co-admin', now()),
  ('$(uuid_for membership:collab)', '$T_MAIN', '$U_COLLAB', 'collaborator', now()),
  ('$(uuid_for membership:trainer)', '$T_MAIN', '$U_TRAINER', 'trainer', now()),
  ('$(uuid_for membership:viewer)', '$T_MAIN', '$U_VIEWER', 'viewer', now());

INSERT INTO public.teams (id, tournament_id, name)
VALUES
  ('$TEAM_A', '$T_MAIN', 'Team A'),
  ('$TEAM_B', '$T_MAIN', 'Team B');

INSERT INTO public.matches (id, tournament_id, round, field, match_status, team_a_id, team_b_id)
VALUES
  ('$M_1', '$T_MAIN', 1, 1, 'running', '$TEAM_A', '$TEAM_B'),
  ('$M_2', '$T_MAIN', 1, 2, 'running', '$TEAM_A', '$TEAM_B'),
  ('$M_LEGACY_UPDATE', '$T_MAIN', 1, 3, 'running', '$TEAM_A', '$TEAM_B');

COMMIT;
SQL

LAST_OUTPUT=""
LAST_RESULT=""
run_sql() {
  # Ausfuehrung als echte RLS-Rolle (authenticated + JWT-Claim sub), eigene, nie committete
  # Transaktion je Aufruf — Muster protect-matches-with-events-check.sh/rls-role-matrix.sh.
  local user_id="$1" sql="$2"
  local out ec
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$user_id';
$sql
SQL
)"
  ec=$?
  set -e
  LAST_OUTPUT="$out"
  if [[ $ec -ne 0 ]]; then
    LAST_RESULT="denied"
  else
    LAST_RESULT="ok"
  fi
}

# run_sql_committed(): wie run_sql, aber COMMIT statt Rollback am Transaktionsende (implizites
# ROLLBACK durch den Verbindungsabbau bei run_sql) -- fuer Proben, die eine Zeile fuer eine
# SPAETERE Probe stehen lassen muessen.
run_sql_committed() {
  local user_id="$1" sql="$2"
  local out ec
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$user_id';
$sql
COMMIT;
SQL
)"
  ec=$?
  set -e
  LAST_OUTPUT="$out"
  if [[ $ec -ne 0 ]]; then
    LAST_RESULT="denied"
  else
    LAST_RESULT="ok"
  fi
}

# setup_definer_probe_fn(): simuliert die kuenftige append_match_events-RPC (B3b existiert noch
# nicht) -- eine im Harness selbst angelegte SECURITY-DEFINER-Testfunktion, die genau EIN INSERT
# mit event_format=1 ausfuehrt (optional mit team_id, fuer die Kaskaden-Proben 4d/4h). Damit
# current_user innerhalb der Funktion NICHT authenticated/anon ist (Postgres-Funktionseigentuemer
# ist hier "postgres", siehe empirischer Beleg in 20260922_003_protect_owner_and_roles.sql).
setup_definer_probe_fn() {
  docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE OR REPLACE FUNCTION public.__test_insert_engine_event(
  p_id uuid, p_match_id uuid, p_type text, p_score_home int, p_score_away int,
  p_team_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  INSERT INTO public.match_events
    (id, match_id, type, team_id, timestamp_seconds, score_home, score_away, event_format)
  VALUES
    (p_id, p_match_id, p_type, p_team_id, 10, p_score_home, p_score_away, 1);
END;
$fn$;
REVOKE ALL ON FUNCTION public.__test_insert_engine_event(uuid,uuid,text,int,int,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__test_insert_engine_event(uuid,uuid,text,int,int,uuid) TO authenticated;

-- I2-Fix-Beleg (Ruling G2c): Proxy fuer den relevanten Teil von merge_user_data() (Baseline
-- :476, "UPDATE match_events SET owner_id = p_target_user_id WHERE owner_id = p_source_user_id"),
-- top-level (pg_trigger_depth() = 1 innerhalb der Funktion). merge_user_data() selbst laesst sich
-- NICHT end-to-end mit einer Engine-Zeile durchtesten: sie referenziert weiter unten (Baseline
-- :481) die Tabelle "tournament_members", die es nicht gibt (bekannter, VON B2 UNABHAENGIGER Bug,
-- dokumentiert in 20260922_003_protect_owner_and_roles.sql) -- jeder Aufruf mit einem Quellnutzer,
-- der ein Turnier besitzt (Voraussetzung, damit ueberhaupt eine match_events-Zeile getroffen
-- wird), scheitert dort IMMER, unabhaengig vom Guard. Dieser Proxy isoliert deshalb GENAU die
-- Zeile, die der Guard bewertet.
CREATE OR REPLACE FUNCTION public.__test_update_engine_event_owner(
  p_id uuid, p_new_owner uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  UPDATE public.match_events SET owner_id = p_new_owner WHERE id = p_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.__test_update_engine_event_owner(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__test_update_engine_event_owner(uuid,uuid) TO authenticated;
SQL
}

# run_select_count(): SELECT count(*) als eine bestimmte Rolle (authenticated+Claim ODER anon).
# Gibt bei Erfolg die reine Zahl zurueck, bei RLS-/Rechte-Fehler "denied" -- sauber getrennt vom
# rohen Fehlertext, damit check() nicht an verunreinigtem Output scheitert.
run_select_count() {
  local role="$1" user_id="$2" sql="$3"
  local out ec claim=""
  if [[ -n "$user_id" ]]; then
    claim="SET LOCAL request.jwt.claim.sub = '$user_id';"
  fi
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA <<SQL 2>/dev/null
BEGIN;
SET LOCAL ROLE $role;
$claim
$sql
ROLLBACK;
SQL
)"
  ec=$?
  set -e
  if [[ $ec -ne 0 || -z "$out" ]]; then
    echo "denied"
  else
    echo "$out"
  fi
}

MISMATCHES=0
check() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "OK    $label -> $actual" >&2
  else
    echo "FAIL  $label -> erwartet $expected, gemessen $actual" >&2
    MISMATCHES=$((MISMATCHES + 1))
  fi
}

# assert_guard_message(): I3/Ruling G3 — eine abgelehnte Anweisung im Normalmodus muss NACHWEISLICH
# vom GUARD kommen (Text "append_match_events" oder "unveraenderlich"), nicht von einem anderen
# Mechanismus (CHECK/FK). Nur im Modus "with-migration" sinnvoll (im Gegenprobe-Modus
# "without-guard" wird dieselbe Anweisung erwartungsgemaess NICHT mehr abgelehnt; im Modus
# "without-migration" fehlt der Guard komplett und andere Mechanismen greifen aus anderem Grund,
# siehe Kopfkommentar).
assert_guard_message() {
  local label="$1"
  if [[ "$MODE" != "with-migration" ]]; then
    return 0
  fi
  if grep -qE 'append_match_events|Rechenfunktion' <<<"$LAST_OUTPUT"; then
    echo "OK    $label -> Guard-Meldung vorhanden" >&2
  else
    echo "FAIL  $label -> Guard-Meldung FEHLT in der Fehlerausgabe (moeglicherweise ein anderer Mechanismus)" >&2
    MISMATCHES=$((MISMATCHES + 1))
  fi
}

echo "" >&2
echo "=== Proben ($MODE) ===" >&2

# --- Probe 1: Tor-INSERT mit team_id (alter Typ GOAL, event_format NULL, als Helfer/Collaborator)
# -> matches.score_a UNVERAENDERT (Alt-Trigger sync_match_score_from_event ist weg, R19). In
# "without-migration" bleibt der Alt-Trigger aktiv -> score_a wird HOCHGEZAEHLT -> Probe ROT
# (erwarteter Fehlschlag der Gegenprobe A).
SCORE_BEFORE="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT COALESCE(score_a,0) FROM public.matches WHERE id = '$M_1';")"
run_sql_committed "$U_COLLAB" "INSERT INTO public.match_events (id, match_id, type, team_id, timestamp_seconds, score_home, score_away) VALUES ('$(uuid_for event:probe1)', '$M_1', 'GOAL', '$TEAM_A', 10, 1, 0);"
SCORE_AFTER="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT COALESCE(score_a,0) FROM public.matches WHERE id = '$M_1';")"
if [[ "$MODE" != "without-migration" ]]; then
  check "1. Tor-INSERT altes Format -> matches.score_a unveraendert (Alt-Trigger weg)" "$SCORE_BEFORE" "$SCORE_AFTER"
else
  if [[ "$SCORE_BEFORE" == "$SCORE_AFTER" ]]; then
    echo "FAIL(erwartet-rot)  1. ohne Migration haette score_a sich aendern muessen (Alt-Trigger) -> ist aber gleich geblieben" >&2
    MISMATCHES=$((MISMATCHES + 1))
  else
    echo "ROT(erwartet)  1. ohne Migration: score_a $SCORE_BEFORE -> $SCORE_AFTER (Alt-Trigger aktiv, wie erwartet ohne 20260928_001)" >&2
  fi
fi

# --- Probe 2a/2b: Ruling G2(a) — Client-INSERT: neuer Typ bzw. event_format gesetzt -> abgelehnt.
run_sql "$U_COLLAB" "INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away) VALUES ('$(uuid_for event:probe2a)', '$M_1', 'CORRECTION', 10, 1, 0);"
if [[ "$MODE" == "without-migration" ]]; then
  check "2a(ohne Migration, erwartet ROT weil Typ-CHECK den neuen Typ nicht kennt, NICHT der Guard)" "denied" "$LAST_RESULT"
elif [[ "$MODE" == "without-guard" ]]; then
  check "2a(Gegenprobe B, Guard weg): INSERT type=CORRECTION -> jetzt erlaubt" "ok" "$LAST_RESULT"
else
  check "2a. Helfer-INSERT type=CORRECTION (authenticated) -> abgelehnt" "denied" "$LAST_RESULT"
  assert_guard_message "2a"
fi

if [[ "$MODE" != "without-migration" ]]; then
  run_sql "$U_COLLAB" "INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away, event_format) VALUES ('$(uuid_for event:probe2b)', '$M_1', 'GOAL', 10, 1, 0, 1);"
  if [[ "$MODE" == "without-guard" ]]; then
    check "2b(Gegenprobe B, Guard weg): INSERT event_format=1 mit altem Typ -> jetzt erlaubt" "ok" "$LAST_RESULT"
  else
    check "2b. Helfer-INSERT event_format=1 mit altem Typ (authenticated) -> abgelehnt" "denied" "$LAST_RESULT"
    assert_guard_message "2b"
  fi
else
  echo "SKIP  2b. ohne Migration: Spalte event_format existiert nicht -> kein sinnvoller Vergleich" >&2
fi

# --- Probe 2c/2d: C1-Fix (Ruling G2b) — UPDATE einer bestehenden Alt-Zeile (Bestand EB1/EB2) zu
# einer Engine-Zeile per Client-Rolle -> abgelehnt. Das war GENAU der C1-Umgehungsweg.
if [[ "$MODE" != "without-migration" ]]; then
  run_sql "$U_OWNER" "UPDATE public.match_events SET event_format = 1 WHERE id = '$EB1';"
  if [[ "$MODE" == "without-guard" ]]; then
    check "2c(Gegenprobe B, C1): UPDATE Alt-Zeile event_format=1 -> jetzt erlaubt" "ok" "$LAST_RESULT"
  else
    check "2c. (C1-Fix) UPDATE Alt-Zeile auf event_format=1 (authenticated) -> abgelehnt" "denied" "$LAST_RESULT"
    assert_guard_message "2c"
  fi

  run_sql "$U_OWNER" "UPDATE public.match_events SET type = 'CORRECTION' WHERE id = '$EB2';"
  if [[ "$MODE" == "without-guard" ]]; then
    check "2d(Gegenprobe B, C1): UPDATE Alt-Zeile type=CORRECTION -> jetzt erlaubt" "ok" "$LAST_RESULT"
  else
    check "2d. (C1-Fix) UPDATE Alt-Zeile auf type=CORRECTION (authenticated) -> abgelehnt" "denied" "$LAST_RESULT"
    assert_guard_message "2d"
  fi

  # --- Probe 2e: I1-Fix (Ruling G2a) — Client-INSERT eines ALTEN Typs mit target_event_id gesetzt
  # (Wert ist eine tatsaechlich existierende Zeile -- EB3 -- die FK allein wuerde das durchlassen)
  # -> abgelehnt, weil ALLE Engine-Spalten NULL sein muessen.
  run_sql "$U_COLLAB" "INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away, target_event_id) VALUES ('$(uuid_for event:probe2e)', '$M_1', 'NOTE', 10, 0, 0, '$EB3');"
  if [[ "$MODE" == "without-guard" ]]; then
    check "2e(Gegenprobe B, I1): INSERT Alt-Typ mit target_event_id -> jetzt erlaubt" "ok" "$LAST_RESULT"
  else
    check "2e. (I1-Fix) INSERT Alt-Typ mit target_event_id gesetzt (authenticated) -> abgelehnt" "denied" "$LAST_RESULT"
    assert_guard_message "2e"
  fi
else
  echo "SKIP  2c-2e. ohne Migration: Spalten/Guard existieren nicht -> kein sinnvoller Vergleich" >&2
fi

# --- Probe 3: Als SECURITY-DEFINER-Testfunktion (simuliert die RPC) -> INSERT mit event_format=1
# erlaubt (auch ohne Guard -- der war nie das Hindernis fuer Definer-Aufrufe).
E_DEFINER=""
if [[ "$MODE" != "without-migration" ]]; then
  setup_definer_probe_fn
  E_DEFINER="$(uuid_for event:probe3-definer)"
  set +e
  OUT3="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$U_COLLAB';
SELECT public.__test_insert_engine_event('$E_DEFINER', '$M_1', 'MATCH_START', 0, 0);
COMMIT;
SQL
)"
  EC3=$?
  set -e
  R3="ok"; [[ $EC3 -ne 0 ]] && R3="denied"
  check "3. SECURITY-DEFINER-Funktion (simuliert append_match_events) INSERT event_format=1" "ok" "$R3"
else
  echo "SKIP  3. ohne Migration: Guard-Trigger/Spalten existieren nicht -> kein sinnvoller Vergleich" >&2
fi

# --- Probe 4a/4b: UPDATE und DELETE auf eine Engine-Zeile (auch als Eigentuemer) -> abgelehnt
# (ausser den in Ruling G2c erlaubten Spalten, hier NICHT betroffen: score_home ist keine davon).
if [[ "$MODE" != "without-migration" ]]; then
  run_sql "$U_OWNER" "UPDATE public.match_events SET score_home = 9 WHERE id = '$E_DEFINER';"
  if [[ "$MODE" == "without-guard" ]]; then
    check "4a(Gegenprobe B): UPDATE auf Engine-Zeile -> jetzt erlaubt" "ok" "$LAST_RESULT"
  else
    check "4a. UPDATE auf Engine-Zeile (Eigentuemer, unerlaubte Spalte score_home) -> abgelehnt" "denied" "$LAST_RESULT"
    assert_guard_message "4a"
  fi

  run_sql "$U_OWNER" "DELETE FROM public.match_events WHERE id = '$E_DEFINER';"
  if [[ "$MODE" == "without-guard" ]]; then
    check "4b(Gegenprobe B): DELETE auf Engine-Zeile (direkt) -> jetzt erlaubt" "ok" "$LAST_RESULT"
  else
    check "4b. DELETE auf Engine-Zeile (Eigentuemer, direkt) -> abgelehnt" "denied" "$LAST_RESULT"
    assert_guard_message "4b"
  fi

  # 4c: direktes DELETE FROM matches ist wegen protect_matches_with_events (20260925_002) bereits
  # blockiert, BEVOR der neue Guard ueberhaupt zum Zug kaeme (Spiel hat match_events) -- dieses
  # Zusammenspiel gilt unabhaengig vom Guard-Zustand (without-guard aendert daran nichts, deshalb
  # keine Sonderbehandlung fuer diesen Modus).
  run_sql "$U_OWNER" "DELETE FROM public.matches WHERE id = '$M_1';"
  R4C_REASON="anders"
  [[ "$LAST_RESULT" == "denied" ]] && grep -q "Ereignis" <<<"$LAST_OUTPUT" && R4C_REASON="protect_matches_with_events"
  check "4c. Direktes DELETE FROM matches (Spiel mit Engine-Zeile) -> abgelehnt von protect_matches_with_events (nicht vom neuen Guard)" "protect_matches_with_events" "$R4C_REASON"

  # 4d: Turnier-Kaskade (DELETE FROM tournaments) entfernt Engine-Zeilen (pg_trigger_depth() > 1)
  # -- auch mit team_id gesetzt (Coordinator-Auftrag: "tournament deletion with engine rows incl.
  # team_id set"). Neue Engine-Zeile MIT team_id=TEAM_A anlegen (E_DEFINER wurde in 4b evtl.
  # bereits geloescht -- ohne Guard in without-guard-Mode, sonst abgelehnt und existiert noch).
  E_CASCADE="$(uuid_for event:probe4d-cascade)"
  docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 >/dev/null <<SQL
SELECT public.__test_insert_engine_event('$E_CASCADE', '$M_2', 'GOAL', 1, 0, '$TEAM_A');
SQL
  run_sql_committed "$U_OWNER" "DELETE FROM public.tournaments WHERE id = '$T_MAIN';"
  check "4d. Turnier-Kaskade loescht Engine-Zeile MIT team_id gesetzt (pg_trigger_depth() > 1)" "ok" "$LAST_RESULT"
  REMAINING="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT count(*) FROM public.match_events WHERE id IN ('$E_CASCADE','$E_DEFINER');")"
  check "4e. Engine-Zeilen nach Turnier-Kaskade tatsaechlich weg" "0" "$REMAINING"
else
  echo "SKIP  4a-4e. ohne Migration: Guard-Trigger existiert nicht -> kein sinnvoller Vergleich" >&2
fi

# --- Probe 4f: I2-Fix (Ruling G2c) — Team loeschen setzt team_id auf einer Engine-Zeile via FK
# ON DELETE SET NULL auf NULL. Das laeuft SELBST ALS TOP-LEVEL "DELETE FROM teams" verschachtelt
# (die FK-Trigger-Ausfuehrung zaehlt fuer pg_trigger_depth()) -- muss deshalb ERLAUBT sein (auch
# mit aktivem Guard), NICHT erst ohne Guard.
if [[ "$MODE" != "without-migration" ]]; then
  psql_stdin <<SQL
BEGIN;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES ('$T_TEAMDEL', '$U_OWNER', 'Match-Event-Log — Team-Delete', '2026-09-28', 8, 15, '{}'::jsonb);
INSERT INTO public.teams (id, tournament_id, name)
VALUES ('$TEAM_C', '$T_TEAMDEL', 'Team C'), ('$TEAM_D', '$T_TEAMDEL', 'Team D');
INSERT INTO public.matches (id, tournament_id, round, field, match_status, team_a_id, team_b_id)
VALUES ('$M_TEAMDEL', '$T_TEAMDEL', 1, 1, 'running', '$TEAM_C', '$TEAM_D');
COMMIT;
SQL
  docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 >/dev/null <<SQL
SELECT public.__test_insert_engine_event('$E_TEAMDEL', '$M_TEAMDEL', 'GOAL', 1, 0, '$TEAM_C');
SQL
  run_sql_committed "$U_OWNER" "DELETE FROM public.teams WHERE id = '$TEAM_C';"
  check "4f. (I2-Fix) Team mit Engine-Tor loeschen -> erlaubt (FK ON DELETE SET NULL, depth > 1)" "ok" "$LAST_RESULT"
  TEAM_ID_AFTER="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT team_id FROM public.match_events WHERE id = '$E_TEAMDEL';")"
  check "4f2. team_id der Engine-Zeile danach NULL" "" "$TEAM_ID_AFTER"

  # 4f3 (Gegenprobe zum Gegenprobe-Konzept, ohne ein eigenes --without-guard noetig): derselbe
  # Aufbau, aber DIREKT (kein FK-Trigger, Tiefe 1) -- ein Client darf team_id NICHT direkt auf
  # einer Engine-Zeile setzen.
  E_TEAMDEL_DIRECT="$(uuid_for event:teamdel-direct)"
  docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 >/dev/null <<SQL
SELECT public.__test_insert_engine_event('$E_TEAMDEL_DIRECT', '$M_TEAMDEL', 'GOAL', 1, 0, '$TEAM_D');
SQL
  run_sql "$U_OWNER" "UPDATE public.match_events SET team_id = NULL WHERE id = '$E_TEAMDEL_DIRECT';"
  if [[ "$MODE" == "without-guard" ]]; then
    check "4f3(Gegenprobe B): direktes team_id=NULL auf Engine-Zeile -> jetzt erlaubt" "ok" "$LAST_RESULT"
  else
    check "4f3. Direktes team_id=NULL auf Engine-Zeile (Tiefe 1, kein FK) -> abgelehnt" "denied" "$LAST_RESULT"
    assert_guard_message "4f3"
  fi

  # --- Probe 4g: I2-Fix (Ruling G2c) — owner_id einer Engine-Zeile aendern (Proxy fuer
  # merge_user_data, siehe Kommentar an __test_update_engine_event_owner oben) -> erlaubt, TROTZ
  # aktivem Guard (das war die "zu streng"-Haelfte von I2).
  E_OWNERCHG="$(uuid_for event:probe4g-owner)"
  docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 >/dev/null <<SQL
SELECT public.__test_insert_engine_event('$E_OWNERCHG', '$M_TEAMDEL', 'MATCH_START', 0, 0);
SQL
  set +e
  OUT4G="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 <<SQL 2>&1
SELECT public.__test_update_engine_event_owner('$E_OWNERCHG', '$U_STRANGER');
SQL
)"
  EC4G=$?
  set -e
  R4G="ok"; [[ $EC4G -ne 0 ]] && R4G="denied"
  check "4g. (I2-Fix) owner_id einer Engine-Zeile per Definer-UPDATE (Proxy merge_user_data) -> erlaubt" "ok" "$R4G"
  OWNER_AFTER="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT owner_id FROM public.match_events WHERE id = '$E_OWNERCHG';")"
  check "4g2. owner_id tatsaechlich uebernommen" "$U_STRANGER" "$OWNER_AFTER"

  # --- Probe 4h: Ruling G5 (Fixrunde 2, MR1) — ein Collaborator (Client-Rolle, current_user =
  # authenticated) darf is_public einer Engine-Zeile NICHT direkt setzen -- vorher (G2c ohne G5)
  # war das erlaubt, weil owner_id/is_public fuer JEDE Rolle ausgenommen waren. Braucht ein
  # eigenes Turnier/Spiel mit U_COLLAB als 'collaborator' (correctEvents), damit RLS die Zeile
  # ueberhaupt durchlaesst -- sonst (wie im ersten Fixrunde-1-Bug) ein stilles "UPDATE 0" statt
  # einer echten Ablehnung.
  T_MR1="$(uuid_for tournament:mr1)"
  M_MR1="$(uuid_for match:mr1)"
  E_MR1="$(uuid_for event:mr1)"
  psql_stdin <<SQL
BEGIN;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config, is_public)
VALUES ('$T_MR1', '$U_OWNER', 'Match-Event-Log — MR1', '2026-09-28', 8, 15, '{"publishedAt":"2026-09-28T00:00:00.000Z"}'::jsonb, false);
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at)
VALUES ('$(uuid_for membership:mr1-collab)', '$T_MR1', '$U_COLLAB', 'collaborator', now());
INSERT INTO public.matches (id, tournament_id, round, field, match_status)
VALUES ('$M_MR1', '$T_MR1', 1, 1, 'running');
COMMIT;
SQL
  docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 >/dev/null <<SQL
SELECT public.__test_insert_engine_event('$E_MR1', '$M_MR1', 'MATCH_START', 0, 0);
SQL
  # run_sql_committed (nicht run_sql!): eine denied-Probe rollt ohnehin nichts zurueck, aber eine
  # FAELSCHLICH erlaubte Probe MUSS committen, sonst zeigt die Nachprobe 4h2 (separate Abfrage)
  # immer den Ausgangswert -- unabhaengig davon, ob der Guard tatsaechlich blockiert hat.
  run_sql_committed "$U_COLLAB" "UPDATE public.match_events SET is_public = true WHERE id = '$E_MR1';"
  if [[ "$MODE" == "without-guard" ]]; then
    check "4h(Gegenprobe B, MR1/G5): Collaborator UPDATE is_public auf Engine-Zeile -> jetzt erlaubt" "ok" "$LAST_RESULT"
  else
    check "4h. (MR1-Fix, Ruling G5) Collaborator UPDATE is_public direkt auf Engine-Zeile -> abgelehnt" "denied" "$LAST_RESULT"
    assert_guard_message "4h"
  fi
  IS_PUBLIC_AFTER_4H="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT is_public FROM public.match_events WHERE id = '$E_MR1';")"
  if [[ "$MODE" == "without-guard" ]]; then
    check "4h2. is_public tatsaechlich auf true gesetzt (ohne Guard)" "t" "$IS_PUBLIC_AFTER_4H"
  else
    check "4h2. is_public unveraendert (Guard hat abgelehnt)" "f" "$IS_PUBLIC_AFTER_4H"
  fi

  # --- Probe 4i: Regression -- die Sichtbarkeits-Kaskade (cascade_tournament_visibility,
  # SECURITY DEFINER, current_user NICHT authenticated/anon) muss Engine-Zeilen WEITERHIN
  # erreichen -- G5 schraenkt nur Client-Rollen ein. Echter App-Pfad (kein Proxy): Eigentuemer
  # veroeffentlicht das MR1-Turnier (tournamentSettings) -> AFTER-UPDATE-Trigger auf tournaments
  # setzt is_public auf allen Kindern, inkl. der Engine-Zeile E_MR1.
  run_sql_committed "$U_OWNER" "UPDATE public.tournaments SET is_public = true WHERE id = '$T_MR1';"
  check "4i. Eigentuemer veroeffentlicht Turnier (tournamentSettings) -> erlaubt" "ok" "$LAST_RESULT"
  IS_PUBLIC_AFTER_CASCADE="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT is_public FROM public.match_events WHERE id = '$E_MR1';")"
  check "4i2. Sichtbarkeits-Kaskade erreicht die Engine-Zeile (is_public=true)" "t" "$IS_PUBLIC_AFTER_CASCADE"
else
  echo "SKIP  4f-4i. ohne Migration: Guard-Trigger/Spalten existieren nicht -> kein sinnvoller Vergleich" >&2
fi

# --- Probe 5: Alte App-Wege unveraendert -- Helfer-INSERT alter Typ ohne event_format erlaubt;
# correctEvents-UPDATE auf alte Zeile erlaubt. Braucht eigenes, unberuehrtes Fixture (T_MAIN wurde
# in Probe 4d ggf. geloescht) -- neues Turnier/Spiel anlegen.
T_LEGACY="$(uuid_for tournament:legacy)"
M_LEGACY="$(uuid_for match:legacy)"
psql_stdin <<SQL
BEGIN;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES ('$T_LEGACY', '$U_OWNER', 'Match-Event-Log — legacy', '2026-09-28', 8, 15, '{}'::jsonb);
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at)
VALUES ('$(uuid_for membership:legacy-collab)', '$T_LEGACY', '$U_COLLAB', 'collaborator', now());
INSERT INTO public.matches (id, tournament_id, round, field, match_status)
VALUES ('$M_LEGACY', '$T_LEGACY', 1, 1, 'running');
COMMIT;
SQL

E_LEGACY="$(uuid_for event:legacy)"
run_sql_committed "$U_COLLAB" "INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away) VALUES ('$E_LEGACY', '$M_LEGACY', 'GOAL', 10, 1, 0);"
check "5a. Helfer/Collaborator-INSERT alter Typ ohne event_format -> erlaubt" "ok" "$LAST_RESULT"

if [[ "$MODE" != "without-migration" ]]; then
  run_sql "$U_COLLAB" "UPDATE public.match_events SET score_home = 2 WHERE id = '$E_LEGACY';"
  check "5b. correctEvents-UPDATE auf alte Zeile (event_format NULL, keine Engine-Spalte geaendert) -> erlaubt" "ok" "$LAST_RESULT"
else
  echo "SKIP  5b. ohne Migration: kein sinnvoller Unterschied (Alt-Pfad war nie betroffen)" >&2
fi

# --- Probe 6: match_event_authors -- Eigentuemer/Co-Admin/Helfer sehen die Zeile; Trainer/Viewer/
# Fremder/anon nicht; niemand darf per authenticated schreiben. Nur sinnvoll mit Migration.
if [[ "$MODE" != "without-migration" ]]; then
  T_AUTH="$(uuid_for tournament:authors)"
  M_AUTH="$(uuid_for match:authors)"
  E_AUTH="$(uuid_for event:authors)"
  psql_stdin <<SQL
BEGIN;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES ('$T_AUTH', '$U_OWNER', 'Match-Event-Log — authors', '2026-09-28', 8, 15, '{}'::jsonb);
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at) VALUES
  ('$(uuid_for membership:authors-coadmin)', '$T_AUTH', '$U_COADMIN', 'co-admin', now()),
  ('$(uuid_for membership:authors-collab)', '$T_AUTH', '$U_COLLAB', 'collaborator', now()),
  ('$(uuid_for membership:authors-trainer)', '$T_AUTH', '$U_TRAINER', 'trainer', now()),
  ('$(uuid_for membership:authors-viewer)', '$T_AUTH', '$U_VIEWER', 'viewer', now());
INSERT INTO public.matches (id, tournament_id, round, field, match_status)
VALUES ('$M_AUTH', '$T_AUTH', 1, 1, 'running');
INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away)
VALUES ('$E_AUTH', '$M_AUTH', 'GOAL', 10, 1, 0);
INSERT INTO public.match_event_authors (event_id, tournament_id, user_id)
VALUES ('$E_AUTH', '$T_AUTH', '$U_COLLAB');
COMMIT;
SQL

  for pair in "$U_OWNER:owner" "$U_COADMIN:co-admin" "$U_COLLAB:collaborator"; do
    uid="${pair%%:*}"; label="${pair##*:}"
    CNT="$(run_select_count authenticated "$uid" "SELECT count(*) FROM public.match_event_authors WHERE event_id = '$E_AUTH';")"
    check "6. $label sieht match_event_authors-Zeile" "1" "$CNT"
  done
  for pair in "$U_TRAINER:trainer" "$U_VIEWER:viewer" "$U_STRANGER:stranger"; do
    uid="${pair%%:*}"; label="${pair##*:}"
    CNT="$(run_select_count authenticated "$uid" "SELECT count(*) FROM public.match_event_authors WHERE event_id = '$E_AUTH';")"
    check "6. $label sieht match_event_authors-Zeile NICHT" "0" "$CNT"
  done
  ANON_CNT="$(run_select_count anon "" "SELECT count(*) FROM public.match_event_authors WHERE event_id = '$E_AUTH';")"
  check "6. anon sieht match_event_authors-Zeile NICHT" "denied" "$ANON_CNT"

  run_sql "$U_OWNER" "INSERT INTO public.match_event_authors (event_id, tournament_id, user_id) VALUES ('$(uuid_for event:authors-write-attempt)', '$T_AUTH', '$U_OWNER');"
  check "6. Eigentuemer darf NICHT per authenticated in match_event_authors schreiben" "denied" "$LAST_RESULT"
else
  echo "SKIP  6. ohne Migration: Tabelle match_event_authors existiert nicht" >&2
fi

# --- Probe 7: match_transitions = JSON (jq-Diff); app_config.min_client_format = 1; anon kann
# beide lesen, nicht schreiben.
if [[ "$MODE" != "without-migration" ]]; then
  DB_TRANSITIONS="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
    "SELECT from_status || '|' || event_type || '|' || actor || '|' || to_status FROM public.match_transitions ORDER BY 1;" | sort)"
  JSON_TRANSITIONS="$(jq -r '.transitions[] | [.from,.type,.actor,.to] | join("|")' "$REPO_ROOT/src/core/match/matchTransitions.json" | sort)"
  if [[ "$DB_TRANSITIONS" == "$JSON_TRANSITIONS" ]]; then
    echo "OK    7a. match_transitions (DB) == matchTransitions.json ($(wc -l <<<"$JSON_TRANSITIONS" | tr -d ' ') Zeilen)" >&2
  else
    echo "FAIL  7a. match_transitions (DB) weicht von matchTransitions.json ab" >&2
    diff <(echo "$JSON_TRANSITIONS") <(echo "$DB_TRANSITIONS") >&2 || true
    MISMATCHES=$((MISMATCHES + 1))
  fi

  MIN_FORMAT="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT value FROM public.app_config WHERE key = 'min_client_format';")"
  check "7b. app_config.min_client_format" "1" "$MIN_FORMAT"

  ANON_TRANS="$(run_select_count anon "" "SELECT count(*) FROM public.match_transitions;")"
  check "7c. anon kann match_transitions lesen" "$(wc -l <<<"$JSON_TRANSITIONS" | tr -d ' ')" "$ANON_TRANS"
  ANON_CONFIG="$(run_select_count anon "" "SELECT count(*) FROM public.app_config;")"
  check "7d. anon kann app_config lesen" "1" "$ANON_CONFIG"

  run_sql "$U_OWNER" "INSERT INTO public.match_transitions (from_status, event_type, actor, to_status) VALUES ('scheduled','NOTE','helper','running');"
  check "7e. authenticated darf NICHT in match_transitions schreiben" "denied" "$LAST_RESULT"
  run_sql "$U_OWNER" "INSERT INTO public.app_config (key, value) VALUES ('x', '1');"
  check "7f. authenticated darf NICHT in app_config schreiben" "denied" "$LAST_RESULT"
else
  echo "SKIP  7. ohne Migration: match_transitions/app_config existieren nicht" >&2
fi

# --- Probe 8: match_event_authors NICHT in pg_publication_tables; die vier Tabellen sind drin.
# M4 (task-B2-review.md): exakter Zeilenvergleich (grep -qx auf einer eigenen Zeile je Tabelle)
# statt Teilstring-Suche auf einer kommaseparierten Liste.
if [[ "$MODE" != "without-migration" ]]; then
  PUB_TABLES_LINES="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
    "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' ORDER BY 1;")"
  for t in match_events matches teams monitor_heartbeats; do
    if grep -qx "$t" <<<"$PUB_TABLES_LINES"; then
      echo "OK    8. $t in Publikation" >&2
    else
      echo "FAIL  8. $t fehlt in Publikation" >&2
      MISMATCHES=$((MISMATCHES + 1))
    fi
  done
  if grep -qx "match_event_authors" <<<"$PUB_TABLES_LINES"; then
    echo "FAIL  8. match_event_authors darf NICHT in der Publikation sein" >&2
    MISMATCHES=$((MISMATCHES + 1))
  else
    echo "OK    8. match_event_authors nicht in Publikation" >&2
  fi
else
  echo "SKIP  8. ohne Migration: Publikations-Block ist Teil der Migration" >&2
fi

# --- Probe 9: seq fuer Bestandszeilen (EB1-EB3, vor der Migration angelegt, M1) gesetzt und
# eindeutig, neue Zeilen streng steigend.
if [[ "$MODE" != "without-migration" ]]; then
  TOTAL_ROWS="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT count(*) FROM public.match_events;")"
  DISTINCT_SEQ="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT count(DISTINCT seq) FROM public.match_events;")"
  check "9a. count(DISTINCT seq) = count(*) -- auch fuer die drei Bestandszeilen EB1-EB3 (M1)" "$TOTAL_ROWS" "$DISTINCT_SEQ"
  BESTAND_NULL_SEQ="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT count(*) FROM public.match_events WHERE id IN ('$EB1','$EB2','$EB3') AND seq IS NULL;")"
  check "9a2. Bestandszeilen EB1-EB3 haben KEIN seq IS NULL" "0" "$BESTAND_NULL_SEQ"

  E9A="$(uuid_for event:probe9a)"; E9B="$(uuid_for event:probe9b)"
  run_sql_committed "$U_COLLAB" "INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away) VALUES ('$E9A', '$M_LEGACY', 'FOUL', 20, 1, 0);"
  run_sql_committed "$U_COLLAB" "INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away) VALUES ('$E9B', '$M_LEGACY', 'FOUL', 21, 1, 0);"
  SEQ_A="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT seq FROM public.match_events WHERE id = '$E9A';")"
  SEQ_B="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT seq FROM public.match_events WHERE id = '$E9B';")"
  if [[ "$SEQ_B" -gt "$SEQ_A" ]]; then
    echo "OK    9b. neue Zeilen streng steigend ($SEQ_A -> $SEQ_B)" >&2
  else
    echo "FAIL  9b. seq nicht streng steigend ($SEQ_A -> $SEQ_B)" >&2
    MISMATCHES=$((MISMATCHES + 1))
  fi
else
  echo "SKIP  9. ohne Migration: Spalte seq existiert nicht" >&2
fi

# --- Probe 10 (Ruling S13, B3b-Fixrunde 1): match_events_section_check erlaubt 1-5 -- die
# Verlaengerung ist Abschnitt sections+1, bei vier Abschnitten also 5. 0 und 6 bleiben verboten.
# Direkt als postgres (Nicht-Client-Rolle, Guard laesst Engine-Zeilen zu), Transaktion wird
# zurueckgerollt.
if [[ "$MODE" != "without-migration" ]]; then
  for sec_case in "5:ok" "6:denied" "0:denied"; do
    sec="${sec_case%%:*}"; want="${sec_case##*:}"
    set +e
    OUT10="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 -q 2>&1 <<SQL
BEGIN;
INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away, event_format, section)
VALUES ('$(uuid_for "event:probe10-$sec")', '$M_LEGACY', 'PAUSE', 1, 0, 0, 1, $sec);
ROLLBACK;
SQL
)"
    ec=$?
    set -e
    got="ok"
    if [[ $ec -ne 0 ]]; then
      got="denied"
      # Abgelehnt werden darf nur durch den CHECK, nicht durch etwas anderes.
      grep -q "match_events_section_check" <<<"$OUT10" || got="denied-anders: $OUT10"
    fi
    check "10. section = $sec (CHECK 1-5, S13)" "$want" "$got"
  done
else
  echo "SKIP  10. ohne Migration: Spalte section existiert nicht" >&2
fi

# --- Probe 11 (Abschluss-Fixrunde, final-review-B.md I1): pg_dump --table=public.match_event_authors
# --schema-only als eine echte LOGIN-Rolle mit den Rechten von ci_schema_reader (Mitgliedschaft,
# keine eigenen Tabellenrechte) muss gelingen -- scripts/db-drift-check.sh dumpt das Live-Schema
# so (dort ohne --table, ueber die ganze Datenbank). Vor dem I1-Fix schlug das mit "permission
# denied for table match_event_authors" fehl (reproduziert im Review), weil match_event_authors
# kein GRANT SELECT fuer ci_schema_reader hatte. ci_schema_reader selbst ist NOLOGIN (20260924_002,
# bedingt angelegt) -- pg_dump braucht eine echte Anmelderolle, deshalb eine eigens angelegte,
# temporaere LOGIN-Rolle IN ROLE ci_schema_reader (erbt exakt deren Rechte, keine eigenen).
#
# BEWUSST auf `--table=public.match_event_authors` eingeschraenkt, NICHT `--schema=public` ohne
# Tabellenfilter: unser Wegwerf-Container ist NUR Baseline + Migrationsdateien, ohne die von
# Supabase bei der Projekt-Provisionierung automatisch vergebenen Plattform-Grants (siehe
# supabase/migrations/README.md: "127 GRANT-Statements ... die jede Supabase-Instanz bei der
# Provisionierung selbst erzeugt" wurden bewusst aus der Baseline entfernt). Ein voller
# `--schema=public`-Dump als ci_schema_reader scheitert deshalb HIER an Tabellen wie
# match_corrections, die live (ueber die Plattform-Grants) fuer diese Rolle lesbar sein koennen,
# in unserem rekonstruierten Container aber nie ein explizites GRANT bekommen haben -- das waere
# ein falsches ROT, das nichts mit I1 zu tun hat. Die eine Tabelle, die WIR per Migration
# kontrollieren (match_event_authors), reicht als Beweis.
if [[ "$MODE" != "without-migration" ]]; then
  docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
DROP ROLE IF EXISTS __pgdump_probe;
CREATE ROLE __pgdump_probe LOGIN PASSWORD 'probe' IN ROLE ci_schema_reader;
SQL
  set +e
  PGDUMP_OUT="$(docker exec -e PGPASSWORD=probe -i "$CONTAINER_NAME" \
    pg_dump -U __pgdump_probe -h 127.0.0.1 -d postgres --table=public.match_event_authors --schema-only --no-owner --no-privileges 2>&1 >/dev/null)"
  PGDUMP_EC=$?
  set -e
  docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
DROP ROLE IF EXISTS __pgdump_probe;
SQL
  if [[ $PGDUMP_EC -eq 0 ]]; then
    echo "OK    11. pg_dump --table=match_event_authors --schema-only als ci_schema_reader-Mitglied -> Exit 0" >&2
  else
    echo "FAIL  11. pg_dump --table=match_event_authors --schema-only als ci_schema_reader-Mitglied -> Exit $PGDUMP_EC: $PGDUMP_OUT" >&2
    MISMATCHES=$((MISMATCHES + 1))
  fi
else
  echo "SKIP  11. ohne Migration: match_event_authors existiert nicht -> kein sinnvoller Vergleich" >&2
fi

echo "" >&2
if [[ "$MISMATCHES" -gt 0 ]]; then
  echo "::error::$MISMATCHES Abweichung(en) im Modus $MODE." >&2
  exit 1
fi
echo "Alle Proben im Modus $MODE wie erwartet." >&2
exit 0
