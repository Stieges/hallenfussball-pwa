#!/usr/bin/env bash
#
# match-engine-parity.sh — Gleichlauf-Beweis TS-Rechenfunktion <-> SQL-Zwilling (B3a,
# .superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B3a-brief.md, Abschnitt 2; Rulings R1, P2, P3).
#
# Jede Fixture unter src/core/match/__fixtures__/*.json laeuft durch BEIDE Seiten:
#   - TS:  scripts/match-engine-ts-dump.ts (continueLog/applyBatch + toServerState, wie der
#          Vitest-Runner src/core/match/__tests__/fixtures.test.ts)
#   - SQL: public.match_reduce (prior, Modus log) + public.match_continue (events, Modus der
#          Fixture) + public.match_server_state aus supabase/migrations/20260928_002_match_engine.sql,
#          mit den Uebergaengen aus der TABELLE public.match_transitions (nicht aus der JSON -- so
#          wird der Seed aus 20260928_001 mitgeprueft).
# Verglichen wird (jq, Gleichheit ist schluesselordnungsfrei):
#   SQL == TS      results (id, status, code, detail) vollstaendig, serverState vollstaendig
#   SQL == expect  results: id, status, code (fehlt im expect => muss fehlen), detail nur wenn im
#                  expect angegeben -- exakt die Regel des Vitest-Runners; serverState vollstaendig
# Ausgabe je Fixture OK/ABWEICHUNG (mit Diff), Exit != 0 bei jeder Abweichung.
#
# Zusaetzlich (Abschnitt "compute_match_state-Probe"): fuer drei Fixtures (einfaches Spiel,
# Korrektur-Stapel, Strafstossschiessen) werden die angenommenen Ereignisse als Engine-Zeilen
# (event_format = 1) ueber eine SECURITY-DEFINER-Testfunktion eingefuegt (Muster B2-Harness
# scripts/match-event-log-check.sh), dann liefert public.compute_match_state(match_id) als echte
# RLS-Rolle den erwarteten serverState (Ruling S1: actor = 'leitung', S2: at aus client_time).
# Eine Alt-Zeile (event_format IS NULL) und eine Engine-Zeile mit review_state = 'pending' im
# selben Spiel muessen dabei ignoriert werden; Fremder/anon sehen NULL (R17: RLS gilt).
# Zuletzt laeuft scripts/db_privilege_assertions.sql gegen den migrierten Container (alle Zeilen |t).
#
# Aufrufoptionen:
#   bash scripts/match-engine-parity.sh               normaler Lauf -- 0 Abweichungen, Exit 0
#   bash scripts/match-engine-parity.sh --gegenprobe  Mutationen im Container: die Tabellenzeile
#                                                     (running, GOAL) verlangt 'leitung' statt
#                                                     'helper', und match__num(jsonb) bekommt EXECUTE
#                                                     fuer PUBLIC. Das Skript MUSS Abweichungen melden
#                                                     (ROT); Exit 0 nur, wenn es das tut, Exit 1 wenn
#                                                     die Mutationen unbemerkt blieben.
#
# Aendert NICHTS an der Produktionsdatenbank -- Wegwerf-Container, wird am Ende entfernt (trap).
#
set -euo pipefail

MODE="normal"
if [[ "${1:-}" == "--gegenprobe" ]]; then
  MODE="gegenprobe"
elif [[ -n "${1:-}" ]]; then
  echo "::error::Unbekannte Option: $1 (erlaubt: --gegenprobe)" >&2
  exit 2
fi

POSTGRES_IMAGE="supabase/postgres:17.6.1.063"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
ENGINE_MIGRATION="20260928_002_match_engine.sql"
FIXTURES_DIR="$REPO_ROOT/src/core/match/__fixtures__"
CONTAINER_NAME="match-engine-parity-$$"
WORKDIR="$(mktemp -d)"
SQ="'"

# Fixtures fuer die compute_match_state-Probe (Brief: einfaches Spiel, Korrektur-Stapel, Strafstoss).
PROBE_FIXTURES=(
  "06-goal-owngoal-retract.json"
  "05b-retract-second-of-two-corrections.json"
  "26a-shootout-early-winner.json"
)

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
NEWER_MIGRATIONS_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
NEWER_MIGRATIONS=()
ENGINE_FILE=""
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  NEWER_MIGRATIONS+=("$line")
  [[ "$(basename "$line")" == "$ENGINE_MIGRATION" ]] && ENGINE_FILE="$line"
done <<< "$NEWER_MIGRATIONS_RAW"
if [[ -z "$ENGINE_FILE" ]]; then
  echo "::error::$ENGINE_MIGRATION nicht in der Liste 'neuer als Baseline' gefunden." >&2
  exit 1
fi

# --- 1. TS-Seite ------------------------------------------------------------------------------
echo "[$MODE] TS-Rechenfunktion ueber alle Fixtures (node scripts/match-engine-ts-dump.ts)..." >&2
node "$REPO_ROOT/scripts/match-engine-ts-dump.ts" > "$WORKDIR/ts.json"
FIXTURE_COUNT="$(find "$FIXTURES_DIR" -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')"
TS_COUNT="$(jq 'length' "$WORKDIR/ts.json")"
if [[ "$TS_COUNT" -ne "$FIXTURE_COUNT" ]]; then
  echo "::error::TS-Dump hat $TS_COUNT Eintraege, es gibt $FIXTURE_COUNT Fixtures." >&2
  exit 1
fi

# --- 2. Wegwerf-Postgres ----------------------------------------------------------------------
docker run -d --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=postgres -p 5432 "$POSTGRES_IMAGE" >/dev/null

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
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 -q
}
psql_value() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA
}

echo "Baseline + ${#NEWER_MIGRATIONS[@]} neuere Migration(en) einspielen..." >&2
psql_stdin < "$BASELINE_FILE"
for f in "${NEWER_MIGRATIONS[@]}"; do
  psql_stdin < "$f"
done
echo "Idempotenz: $ENGINE_MIGRATION ein zweites Mal einspielen..." >&2
psql_stdin < "$ENGINE_FILE"

if [[ "$MODE" == "gegenprobe" ]]; then
  echo "GEGENPROBE: match_transitions (running, GOAL) actor helper -> leitung; match__num EXECUTE fuer PUBLIC" >&2
  psql_stdin <<'SQL'
UPDATE public.match_transitions SET actor = 'leitung' WHERE from_status = 'running' AND event_type = 'GOAL';
GRANT EXECUTE ON FUNCTION public.match__num(jsonb) TO PUBLIC;
SQL
fi

# --- 3. SQL-Seite -----------------------------------------------------------------------------
# Harness-Hilfen (nur im Wegwerf-Container): Fixture-Tabelle + Lauf je Fixture mit Fehlerfang,
# damit eine werfende Fixture nicht den ganzen Vergleich abbricht (sondern als ABWEICHUNG zaehlt).
psql_stdin <<'SQL'
CREATE TABLE public.__parity_fixtures (file text PRIMARY KEY, doc jsonb NOT NULL);

CREATE FUNCTION public.__parity_run(p_doc jsonb, p_transitions jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $fn$
DECLARE
  v_prior jsonb;
  v_run jsonb;
BEGIN
  v_prior := public.match_reduce(coalesce(p_doc->'prior', '[]'::jsonb), p_doc->'ctx', p_transitions, 'log');
  v_run := public.match_continue(v_prior->'state', p_doc->'events', p_doc->'ctx', p_transitions, p_doc->>'mode');
  RETURN jsonb_build_object('results', v_run->'results', 'serverState', public.match_server_state(v_run->'state'));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLSTATE || ': ' || SQLERRM);
END;
$fn$;
SQL

: > "$WORKDIR/load.sql"
for f in "$FIXTURES_DIR"/*.json; do
  doc="$(jq -c . "$f")"
  doc="${doc//$SQ/$SQ$SQ}"
  printf "INSERT INTO public.__parity_fixtures (file, doc) VALUES ('%s', '%s'::jsonb);\n" "$(basename "$f")" "$doc" >> "$WORKDIR/load.sql"
done
psql_stdin < "$WORKDIR/load.sql"

psql_value > "$WORKDIR/sql.json" <<'SQL'
WITH tr AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object('from', from_status, 'type', event_type, 'actor', actor, 'to', to_status)
                            ORDER BY from_status, event_type), '[]'::jsonb) AS t
  FROM public.match_transitions
)
SELECT jsonb_agg(jsonb_build_object('file', f.file) || public.__parity_run(f.doc, tr.t) ORDER BY f.file)
FROM public.__parity_fixtures f CROSS JOIN tr;
SQL

# --- 4. Vergleich -----------------------------------------------------------------------------
jq -cn --slurpfile ts "$WORKDIR/ts.json" --slurpfile sql "$WORKDIR/sql.json" --arg dir "$FIXTURES_DIR" '
  ($ts[0] | map({key: .file, value: .}) | from_entries) as $tsmap
  | $sql[0][]
  | . as $s
  | $tsmap[$s.file] as $t
  | {file: $s.file, sql: $s, ts: $t}
' > "$WORKDIR/pairs.jsonl"

DEVIATIONS=0
OK_COUNT=0
TABLE_ROWS=()
while IFS= read -r pair; do
  file="$(jq -r '.file' <<<"$pair")"
  expect="$(jq -c '.expect' "$FIXTURES_DIR/$file")"
  verdict="$(jq -c --argjson e "$expect" '
    def project_expected($exp; $act):
      [range(0; $exp | length) as $i
        | ($exp[$i]) as $x | ($act[$i] // {}) as $a
        | {id: $a.id, status: $a.status, code: $a.code}
          + (if $x | has("detail") then {detail: $a.detail} else {} end)];
    def norm_expected($exp):
      [$exp[] | {id, status, code} + (if has("detail") then {detail} else {} end)];
    {
      error: (.sql.error // null),
      sql_ts: ((.sql.results == .ts.results) and (.sql.serverState == .ts.serverState)),
      sql_expect: (((.sql.results // []) | length) == ($e.results | length)
                   and project_expected($e.results; (.sql.results // [])) == norm_expected($e.results)
                   and .sql.serverState == $e.serverState)
    }' <<<"$pair")"
  sql_ts="$(jq -r '.sql_ts' <<<"$verdict")"
  sql_expect="$(jq -r '.sql_expect' <<<"$verdict")"
  err="$(jq -r '.error // empty' <<<"$verdict")"
  if [[ "$sql_ts" == "true" && "$sql_expect" == "true" ]]; then
    OK_COUNT=$((OK_COUNT + 1))
    echo "OK          $file"
    TABLE_ROWS+=("| $file | = | = |")
  else
    DEVIATIONS=$((DEVIATIONS + 1))
    echo "ABWEICHUNG  $file  (SQL==TS: $sql_ts, SQL==expect: $sql_expect)"
    TABLE_ROWS+=("| $file | $sql_ts | $sql_expect |")
    if [[ -n "$err" ]]; then
      echo "    SQL-Fehler: $err"
    else
      diff -u --label "TS/$file" --label "SQL/$file" \
        <(jq -S '{results: .ts.results, serverState: .ts.serverState}' <<<"$pair") \
        <(jq -S '{results: .sql.results, serverState: .sql.serverState}' <<<"$pair") | sed 's/^/    /' || true
    fi
  fi
done < "$WORKDIR/pairs.jsonl"

SQL_COUNT="$(jq 'length' "$WORKDIR/sql.json")"
if [[ "$SQL_COUNT" -ne "$FIXTURE_COUNT" ]]; then
  echo "ABWEICHUNG  SQL-Seite lieferte $SQL_COUNT statt $FIXTURE_COUNT Fixtures"
  DEVIATIONS=$((DEVIATIONS + 1))
fi

# --- 5. compute_match_state-Probe -------------------------------------------------------------
uuid_for() {
  local h
  h="$(printf '%s' "match-engine-parity:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-${h:12:4}-${h:16:4}-${h:20:12}"
}
U_OWNER="$(uuid_for user:owner)"
U_STRANGER="$(uuid_for user:stranger)"
T_PROBE="$(uuid_for tournament:probe)"

psql_stdin <<SQL
BEGIN;
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '$U_OWNER', 'authenticated', 'authenticated', 'owner@match-engine-parity.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_STRANGER', 'authenticated', 'authenticated', 'stranger@match-engine-parity.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES ('$T_PROBE', '$U_OWNER', 'Match-Engine-Gleichlauf', '2026-09-28', 8, 15, '{}'::jsonb);
COMMIT;

-- Simuliert den kuenftigen Schreibweg (B3b): SECURITY DEFINER, current_user = postgres, damit der
-- Guard (match_events_guard_engine_rows) die Engine-Zeile zulaesst -- Muster B2-Harness.
CREATE FUNCTION public.__parity_insert_engine_event(p_match_id uuid, p_owner uuid, p_event jsonb, p_review_state text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS \$fn\$
BEGIN
  INSERT INTO public.match_events
    (id, match_id, type, team_id, target_event_id, section, clock_ms, client_time, payload,
     timestamp_seconds, score_home, score_away, event_format, review_state, owner_id, is_public)
  VALUES
    ((p_event->>'id')::uuid, p_match_id, p_event->>'type', (p_event->>'teamId')::uuid,
     (p_event->>'targetId')::uuid, (p_event->>'section')::smallint, (p_event->>'clockMs')::integer,
     to_timestamp((p_event->>'at')::numeric / 1000), p_event->'payload',
     coalesce((p_event->>'clockMs')::numeric, 0) / 1000, 0, 0, 1, p_review_state, p_owner, false);
END;
\$fn\$;
REVOKE ALL ON FUNCTION public.__parity_insert_engine_event(uuid, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__parity_insert_engine_event(uuid, uuid, jsonb, text) TO authenticated;
SQL

run_as() {
  # $1 = Rolle (authenticated|anon), $2 = Nutzer-ID (leer bei anon), $3 = SQL
  local role="$1" user_id="$2" sql="$3" claim=""
  [[ -n "$user_id" ]] && claim="SET LOCAL request.jwt.claim.sub = '$user_id';"
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA <<SQL
BEGIN;
SET LOCAL ROLE $role;
$claim
$sql
COMMIT;
SQL
}

PROBE_INDEX=0
for probe in "${PROBE_FIXTURES[@]}"; do
  PROBE_INDEX=$((PROBE_INDEX + 1))
  fixture_path="$FIXTURES_DIR/$probe"
  team_a="$(uuid_for "team:$PROBE_INDEX:a")"
  team_b="$(uuid_for "team:$PROBE_INDEX:b")"
  match_id="$(uuid_for "match:$PROBE_INDEX")"
  # Team-IDs der Fixture ("teamA"/"teamB") sind keine uuids -- ueberall (auch als Schluessel in
  # scores/effectiveScores/CORRECTION.payload.scores) auf echte Team-uuids abbilden. Ereignis-IDs
  # wiederholen sich zwischen Fixtures (match_events.id ist Primaerschluessel) -- die ersten acht
  # Zeichen je Probe ersetzen, ueberall wo die ID vorkommt (targetId, basedOn, lastScoreEventId).
  mapped="$(jq -c --arg a "$team_a" --arg b "$team_b" --arg p "$(printf '%08d' "$PROBE_INDEX")" '
    .ctx as $c
    | ([(.prior // [])[], .events[] | .id] | map({key: ., value: true}) | from_entries) as $ids
    | def m: if . == $c.teamAId then $a elif . == $c.teamBId then $b
             elif $ids[.] then $p + .[8:] else . end;
      walk(if type == "object" then with_entries(.key |= m) elif type == "string" then m else . end)' "$fixture_path")"
  # Gespeicherter Log = prior (bereits gespeichert, K6) + die im expect angenommenen events.
  stored="$(jq -c '(.prior // []) + ([.events, .expect.results] | transpose | map(select(.[1].status == "accepted") | .[0]))' <<<"$mapped")"
  expected_state="$(jq -c '.expect.serverState' <<<"$mapped")"

  psql_stdin <<SQL
INSERT INTO public.teams (id, tournament_id, name) VALUES ('$team_a', '$T_PROBE', 'A$PROBE_INDEX'), ('$team_b', '$T_PROBE', 'B$PROBE_INDEX');
INSERT INTO public.matches (id, tournament_id, round, field, match_status, team_a_id, team_b_id, owner_id)
VALUES ('$match_id', '$T_PROBE', 1, $PROBE_INDEX, 'running', '$team_a', '$team_b', '$U_OWNER');
SQL
  if [[ "$PROBE_INDEX" -eq 1 ]]; then
    # Stoerzeilen, die compute_match_state ignorieren MUSS: eine Alt-Zeile (event_format IS NULL)
    # und eine Engine-Zeile mit review_state = 'pending' (beides je ein Tor fuer Team A).
    psql_stdin <<SQL
INSERT INTO public.match_events (id, match_id, type, team_id, timestamp_seconds, score_home, score_away, owner_id)
VALUES ('$(uuid_for legacy-goal)', '$match_id', 'GOAL', '$team_a', 5, 1, 0, '$U_OWNER');
SQL
    run_as authenticated "$U_OWNER" "SELECT public.__parity_insert_engine_event('$match_id', '$U_OWNER', '{\"id\":\"$(uuid_for pending-goal)\",\"type\":\"GOAL\",\"teamId\":\"$team_a\",\"at\":1500,\"section\":1,\"clockMs\":50000,\"payload\":{}}'::jsonb, 'pending');" >/dev/null
  fi
  insert_sql=""
  while IFS= read -r ev; do
    ev_escaped="${ev//$SQ/$SQ$SQ}"
    insert_sql+="SELECT public.__parity_insert_engine_event('$match_id', '$U_OWNER', '$ev_escaped'::jsonb);"$'\n'
  done < <(jq -c '.[]' <<<"$stored")
  run_as authenticated "$U_OWNER" "$insert_sql" >/dev/null

  owner_state="$(run_as authenticated "$U_OWNER" "SELECT public.compute_match_state('$match_id');")"
  stranger_state="$(run_as authenticated "$U_STRANGER" "SELECT coalesce(public.compute_match_state('$match_id')::text, 'NULL');")"
  anon_state="$(run_as anon "" "SELECT coalesce(public.compute_match_state('$match_id')::text, 'NULL');")"

  if [[ -n "$owner_state" ]] && jq -e --argjson e "$expected_state" '. == $e' <<<"$owner_state" >/dev/null 2>&1; then
    echo "OK          compute_match_state $probe (Eigentuemer, $(jq 'length' <<<"$stored") gespeicherte Ereignisse)"
  else
    DEVIATIONS=$((DEVIATIONS + 1))
    echo "ABWEICHUNG  compute_match_state $probe (Eigentuemer)"
    diff -u --label "expect/$probe" --label "compute_match_state/$probe" \
      <(jq -S . <<<"$expected_state") <( (jq -S . <<<"$owner_state") 2>/dev/null || echo "$owner_state") | sed 's/^/    /' || true
  fi
  for who in stranger anon; do
    value="$stranger_state"; [[ "$who" == "anon" ]] && value="$anon_state"
    if [[ "$value" == "NULL" ]]; then
      echo "OK          compute_match_state $probe ($who sieht NULL -- RLS)"
    else
      DEVIATIONS=$((DEVIATIONS + 1))
      echo "ABWEICHUNG  compute_match_state $probe ($who sieht: $value)"
    fi
  done
done

# --- 6. Rechte-Assertion im migrierten Container ----------------------------------------------
# scripts/db_privilege_assertions.sql laeuft live im Drift-Check (nur mit SUPABASE_DB_READONLY_URL);
# hier derselbe Satz gegen den frisch migrierten Container, damit die B3a-Zeilen (SECURITY INVOKER,
# STABLE/IMMUTABLE, kein PUBLIC-EXECUTE, Anzahl 41, Positivkontrollen) schon vor dem Live-Apply
# bewiesen sind. Jede Zeile muss "|t" sein.
PRIV_OUT="$(psql_value < "$REPO_ROOT/scripts/db_privilege_assertions.sql" 2>&1)" || {
  echo "ABWEICHUNG  Rechte-Assertion nicht ausfuehrbar: $PRIV_OUT"
  DEVIATIONS=$((DEVIATIONS + 1))
  PRIV_OUT=""
}
if [[ -n "$PRIV_OUT" ]]; then
  PRIV_FAILED="$(grep -v '|t$' <<<"$PRIV_OUT" || true)"
  if [[ -n "$PRIV_FAILED" ]]; then
    echo "ABWEICHUNG  Rechte-Assertion: $PRIV_FAILED"
    DEVIATIONS=$((DEVIATIONS + 1))
  else
    echo "OK          Rechte-Assertion: $(wc -l <<<"$PRIV_OUT" | tr -d ' ') Zeilen |t (scripts/db_privilege_assertions.sql)"
  fi
fi

# --- 7. Ergebnis ------------------------------------------------------------------------------
echo ""
echo "Gleichlauf-Tabelle (Fixture | SQL==TS | SQL==expect):"
printf '%s\n' "${TABLE_ROWS[@]}"
echo ""
echo "Fixtures: $FIXTURE_COUNT, OK: $OK_COUNT, Abweichungen gesamt (inkl. compute_match_state-Probe): $DEVIATIONS"

if [[ "$MODE" == "gegenprobe" ]]; then
  if [[ "$DEVIATIONS" -gt 0 ]]; then
    echo "Gegenprobe wie erwartet ROT: die Mutationen wurden erkannt ($DEVIATIONS Abweichung(en))."
    exit 0
  fi
  echo "::error::Gegenprobe: Mutationen blieben UNBEMERKT -- der Gleichlauf-Check ist zahnlos." >&2
  exit 1
fi

if [[ "$DEVIATIONS" -gt 0 ]]; then
  echo "::error::$DEVIATIONS Abweichung(en) zwischen SQL-Zwilling, TS-Rechenfunktion und Fixture-Erwartung." >&2
  exit 1
fi
echo "Gleichlauf gruen: SQL == TS == expect fuer alle $FIXTURE_COUNT Fixtures, compute_match_state-Probe gruen."
exit 0
