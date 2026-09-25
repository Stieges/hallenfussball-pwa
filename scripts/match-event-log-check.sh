#!/usr/bin/env bash
#
# match-event-log-check.sh — Container-Beweis fuer das Ereignis-Log-Schema
# (supabase/migrations/20260928_001_match_event_log.sql, B2,
# .superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B2-brief.md).
#
# Stil: scripts/protect-matches-with-events-check.sh (Wegwerf-Postgres, Baseline + neuere
# Migrationen ueber scripts/lib/migrations-since-baseline.sh, "SET LOCAL ROLE authenticated" +
# "request.jwt.claim.sub" fuer echte RLS-Proben, Testidentitaeten wie im Rechte-Harness
# scripts/rls-role-matrix.sh).
#
# Aufrufoptionen:
#   ./scripts/match-event-log-check.sh            normaler Lauf (Baseline + ALLE neueren
#                                                   Migrationen, inkl. 20260928_001) — die 10
#                                                   Proben muessen GRUEN sein.
#   ./scripts/match-event-log-check.sh --without-migration
#                                                   Gegenprobe (Probe 10): Baseline + alle
#                                                   neueren Migrationen AUSSER
#                                                   20260928_001_match_event_log.sql — Proben 1,
#                                                   2, 4 muessen ROT sein (erwarteter Fehlschlag,
#                                                   Exit 0 trotzdem, siehe unten).
#
# Aendert NICHTS an der Produktionsdatenbank — Wegwerf-Container, wird am Ende entfernt (trap).
#
set -euo pipefail

MODE="with-migration"
if [[ "${1:-}" == "--without-migration" ]]; then
  MODE="without-migration"
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
for f in "${NEWER_MIGRATIONS[@]}"; do
  [[ "$(basename "$f")" == "$TARGET_MIGRATION" ]] && FOUND_TARGET=1
done
if [[ "$FOUND_TARGET" -ne 1 ]]; then
  echo "::error::$TARGET_MIGRATION nicht in der Liste 'neuer als Baseline' gefunden." >&2
  exit 1
fi

TO_APPLY=("${NEWER_MIGRATIONS[@]}")
if [[ "$MODE" == "without-migration" ]]; then
  TO_APPLY=()
  for f in "${NEWER_MIGRATIONS[@]}"; do
    [[ "$(basename "$f")" == "$TARGET_MIGRATION" ]] && continue
    TO_APPLY+=("$f")
  done
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

echo "[$MODE] Baseline + $(( ${#TO_APPLY[@]} )) Migration(en) einspielen..." >&2
psql_stdin < "$BASELINE_FILE"
for f in "${TO_APPLY[@]}"; do
  psql_stdin < "$f"
done

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

echo "Fixtures anlegen..." >&2
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
# SPAETERE Probe stehen lassen muessen (z.B. Probe 3 legt die Engine-Zeile an, die Probe 4
# aktualisieren/loeschen will).
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

# run_sql_definer(): simuliert die kuenftige append_match_events-RPC (B3b existiert noch nicht) --
# eine im Harness selbst angelegte SECURITY-DEFINER-Testfunktion, die genau EIN INSERT mit
# event_format=1 ausfuehrt. Damit current_user innerhalb der Funktion NICHT authenticated/anon
# ist (Postgres-Funktionseigentuemer ist hier "postgres", siehe empirischer Beleg in
# 20260922_003_protect_owner_and_roles.sql).
setup_definer_probe_fn() {
  docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE OR REPLACE FUNCTION public.__test_insert_engine_event(
  p_id uuid, p_match_id uuid, p_type text, p_score_home int, p_score_away int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  INSERT INTO public.match_events
    (id, match_id, type, timestamp_seconds, score_home, score_away, event_format)
  VALUES
    (p_id, p_match_id, p_type, 10, p_score_home, p_score_away, 1);
END;
$fn$;
REVOKE ALL ON FUNCTION public.__test_insert_engine_event(uuid,uuid,text,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__test_insert_engine_event(uuid,uuid,text,int,int) TO authenticated;
SQL
}

# run_select_count(): SELECT count(*) als eine bestimmte Rolle (authenticated+Claim ODER anon).
# Gibt bei Erfolg die reine Zahl zurueck, bei RLS-/Rechte-Fehler "denied" -- sauber getrennt vom
# rohen Fehlertext, damit check() nicht an verunreinigtem Output scheitert (anders als ein simples
# "... || echo denied", das den Fehlertext UND "denied" gemeinsam einfangen wuerde).
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

echo "" >&2
echo "=== Proben ($MODE) ===" >&2

# --- Probe 1: Tor-INSERT mit team_id (alter Typ GOAL, event_format NULL, als Helfer/Collaborator)
# -> matches.score_a UNVERAENDERT (Alt-Trigger sync_match_score_from_event ist weg, R19). In
# "without-migration" bleibt der Alt-Trigger aktiv -> score_a wird HOCHGEZAEHLT -> Probe ROT
# (erwarteter Fehlschlag der Gegenprobe).
SCORE_BEFORE="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT COALESCE(score_a,0) FROM public.matches WHERE id = '$M_1';")"
run_sql_committed "$U_COLLAB" "INSERT INTO public.match_events (id, match_id, type, team_id, timestamp_seconds, score_home, score_away) VALUES ('$(uuid_for event:probe1)', '$M_1', 'GOAL', '$TEAM_A', 10, 1, 0);"
SCORE_AFTER="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT COALESCE(score_a,0) FROM public.matches WHERE id = '$M_1';")"
if [[ "$MODE" == "with-migration" ]]; then
  check "1. Tor-INSERT altes Format -> matches.score_a unveraendert (Alt-Trigger weg)" "$SCORE_BEFORE" "$SCORE_AFTER"
else
  # Gegenprobe: score_a MUSS sich aendern (Alt-Trigger noch da) -> das ist das erwartete ROT.
  if [[ "$SCORE_BEFORE" == "$SCORE_AFTER" ]]; then
    echo "FAIL(erwartet-rot)  1. ohne Migration haette score_a sich aendern muessen (Alt-Trigger) -> ist aber gleich geblieben" >&2
    MISMATCHES=$((MISMATCHES + 1))
  else
    echo "ROT(erwartet)  1. ohne Migration: score_a $SCORE_BEFORE -> $SCORE_AFTER (Alt-Trigger aktiv, wie erwartet ohne 20260928_001)" >&2
  fi
fi

# --- Probe 2: Helfer-INSERT type='CORRECTION' per Rolle authenticated -> abgelehnt.
# Ebenso event_format=1 mit altem Typ -> abgelehnt. In "without-migration" existiert weder der
# neue Typ CORRECTION (Typ-CHECK) noch die Spalte event_format -> beides scheitert schon an
# anderen Fehlern (Constraint bzw. unbekannte Spalte), NICHT am Guard-Trigger -- das ist die
# erwartete ROT-Ausgabe der Gegenprobe (dokumentiert im Report, siehe unten).
run_sql "$U_COLLAB" "INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away) VALUES ('$(uuid_for event:probe2a)', '$M_1', 'CORRECTION', 10, 1, 0);"
if [[ "$MODE" == "with-migration" ]]; then
  check "2a. Helfer-INSERT type=CORRECTION (authenticated) -> abgelehnt" "denied" "$LAST_RESULT"
else
  check "2a(ohne Migration, erwartet ROT weil Typ-CHECK den neuen Typ nicht kennt)" "denied" "$LAST_RESULT"
fi

if [[ "$MODE" == "with-migration" ]]; then
  run_sql "$U_COLLAB" "INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away, event_format) VALUES ('$(uuid_for event:probe2b)', '$M_1', 'GOAL', 10, 1, 0, 1);"
  check "2b. Helfer-INSERT event_format=1 mit altem Typ (authenticated) -> abgelehnt" "denied" "$LAST_RESULT"
else
  echo "SKIP  2b. ohne Migration: Spalte event_format existiert nicht -> kein sinnvoller Vergleich" >&2
fi

# --- Probe 3: Als SECURITY-DEFINER-Testfunktion (simuliert die RPC) -> INSERT mit event_format=1
# erlaubt.
if [[ "$MODE" == "with-migration" ]]; then
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

# --- Probe 4: UPDATE und DELETE auf diese Zeile (auch als Eigentuemer) -> abgelehnt.
# Loeschen des Spiels (Kaskade): matches_protect_events_before_delete (20260925_002) blockiert
# JEDES Spiel mit vorhandenen match_events direkt -- die einzige Route zu pg_trigger_depth() > 1
# fuer eine Engine-Zeile ist deshalb die TURNIER-Kaskade (tournaments -> matches -> match_events),
# nicht ein direktes DELETE FROM matches. Das wird unten separat geprueft (Probe 4c).
if [[ "$MODE" == "with-migration" ]]; then
  run_sql "$U_OWNER" "UPDATE public.match_events SET score_home = 9 WHERE id = '$E_DEFINER';"
  check "4a. UPDATE auf Engine-Zeile (Eigentuemer) -> abgelehnt" "denied" "$LAST_RESULT"

  run_sql "$U_OWNER" "DELETE FROM public.match_events WHERE id = '$E_DEFINER';"
  check "4b. DELETE auf Engine-Zeile (Eigentuemer, direkt) -> abgelehnt" "denied" "$LAST_RESULT"

  # 4c: direktes DELETE FROM matches ist wegen protect_matches_with_events (20260925_002) bereits
  # blockiert, BEVOR der neue Guard ueberhaupt zum Zug kaeme (Spiel hat match_events) -- das ist
  # das dokumentierte Zusammenspiel aus dem Brief ("pruefe stattdessen die Turnier-Kaskade oder
  # dokumentiere das Zusammenspiel"). Beleg hier:
  run_sql "$U_OWNER" "DELETE FROM public.matches WHERE id = '$M_1';"
  R4C_REASON="anders"
  [[ "$LAST_RESULT" == "denied" ]] && grep -q "Ereignis" <<<"$LAST_OUTPUT" && R4C_REASON="protect_matches_with_events"
  check "4c. Direktes DELETE FROM matches (Spiel mit Engine-Zeile) -> abgelehnt von protect_matches_with_events (nicht vom neuen Guard)" "protect_matches_with_events" "$R4C_REASON"

  # 4d: Turnier-Kaskade (DELETE FROM tournaments) entfernt Engine-Zeilen sehr wohl (pg_trigger_depth() > 1).
  run_sql_committed "$U_OWNER" "DELETE FROM public.tournaments WHERE id = '$T_MAIN';"
  check "4d. Turnier-Kaskade loescht Engine-Zeile mit (pg_trigger_depth() > 1)" "ok" "$LAST_RESULT"
  REMAINING="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT count(*) FROM public.match_events WHERE id = '$E_DEFINER';")"
  check "4e. Engine-Zeile nach Turnier-Kaskade tatsaechlich weg" "0" "$REMAINING"
else
  echo "SKIP  4. ohne Migration: Guard-Trigger existiert nicht -> kein sinnvoller Vergleich" >&2
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

if [[ "$MODE" == "with-migration" ]]; then
  run_sql "$U_COLLAB" "UPDATE public.match_events SET score_home = 2 WHERE id = '$E_LEGACY';"
  check "5b. correctEvents-UPDATE auf alte Zeile (event_format NULL) -> erlaubt" "ok" "$LAST_RESULT"
else
  echo "SKIP  5b. ohne Migration: kein sinnvoller Unterschied (Alt-Pfad war nie betroffen)" >&2
fi

# --- Probe 6: match_event_authors -- Eigentuemer/Co-Admin/Helfer sehen die Zeile; Trainer/Viewer/
# Fremder/anon nicht; niemand darf per authenticated schreiben. Nur sinnvoll mit Migration.
if [[ "$MODE" == "with-migration" ]]; then
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
if [[ "$MODE" == "with-migration" ]]; then
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

  run_sql "$U_OWNER" "INSERT INTO public.match_transitions (from_status, event_type, actor, to_status) VALUES ('x','x','helper','x');"
  check "7e. authenticated darf NICHT in match_transitions schreiben" "denied" "$LAST_RESULT"
  run_sql "$U_OWNER" "INSERT INTO public.app_config (key, value) VALUES ('x', '1');"
  check "7f. authenticated darf NICHT in app_config schreiben" "denied" "$LAST_RESULT"
else
  echo "SKIP  7. ohne Migration: match_transitions/app_config existieren nicht" >&2
fi

# --- Probe 8: match_event_authors NICHT in pg_publication_tables; die vier Tabellen sind drin.
if [[ "$MODE" == "with-migration" ]]; then
  PUB_TABLES="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
    "SELECT string_agg(tablename, ',' ORDER BY tablename) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public';")"
  for t in match_events matches teams monitor_heartbeats; do
    grep -q "$t" <<<"$PUB_TABLES" && echo "OK    8. $t in Publikation" >&2 || { echo "FAIL  8. $t fehlt in Publikation" >&2; MISMATCHES=$((MISMATCHES+1)); }
  done
  if grep -q "match_event_authors" <<<"$PUB_TABLES"; then
    echo "FAIL  8. match_event_authors darf NICHT in der Publikation sein" >&2
    MISMATCHES=$((MISMATCHES + 1))
  else
    echo "OK    8. match_event_authors nicht in Publikation" >&2
  fi
else
  echo "SKIP  8. ohne Migration: Publikations-Block ist Teil der Migration" >&2
fi

# --- Probe 9: seq fuer Bestandszeilen gesetzt, neue Zeilen streng steigend.
if [[ "$MODE" == "with-migration" ]]; then
  NULL_SEQ="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT count(*) FROM public.match_events WHERE seq IS NULL;")"
  check "9a. keine Zeile mit seq IS NULL (Bestandszeilen backgefuellt)" "0" "$NULL_SEQ"

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

echo "" >&2
if [[ "$MISMATCHES" -gt 0 ]]; then
  echo "::error::$MISMATCHES Abweichung(en) im Modus $MODE." >&2
  exit 1
fi
echo "Alle Proben im Modus $MODE wie erwartet." >&2
exit 0
