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
# C0b (PC4, .superpowers/sdd/2026-09-26-pr-c-ausgang/task-C0b-brief.md): je Fixture zusaetzlich
#   Angaben    state.details, state.sectionStartMs, state.breakStartedAt: SQL == TS (automatisch fuer
#              JEDE Fixture, nicht im serverState); expect.details (falls vorhanden) exakt
#   Zwischensp. match_engine.cache_columns(state, ctx) == cacheColumns(state, ctx) (TS, vollstaendig);
#              expect.liveState (falls vorhanden): null exakt, sonst Teilvergleich je Schluessel
#   Regeln     src/core/match/__fixtures__/rules/*.json: match_engine.server_rules(input) ==
#              serverRules(input) (TS) == expect
# Zusaetzlich (Abschnitt "compute_match_state-Probe"): fuer drei Fixtures (einfaches Spiel,
# Korrektur-Stapel, Strafstossschiessen) werden die angenommenen Ereignisse als Engine-Zeilen
# (event_format = 1) ueber eine SECURITY-DEFINER-Testfunktion eingefuegt (Muster B2-Harness
# scripts/match-event-log-check.sh), dann liefert public.compute_match_state(match_id) als echte
# RLS-Rolle den erwarteten serverState (Ruling S1: actor = 'leitung', S2: at aus client_time).
# Eine Alt-Zeile (event_format IS NULL) und eine Engine-Zeile mit review_state = 'pending' im
# selben Spiel muessen dabei ignoriert werden; Fremder/anon sehen NULL (R17: RLS gilt).
# Seed-Gleichheit (Review M9): public.match_transitions im Container == matchTransitions.json.
# Zuletzt laeuft scripts/db_privilege_assertions.sql gegen den migrierten Container (alle Zeilen |t).
#
# Aufrufoptionen:
#   bash scripts/match-engine-parity.sh               normaler Lauf -- 0 Abweichungen, Exit 0
#   bash scripts/match-engine-parity.sh --gegenprobe  Mutationen im Container (Review M4, C0b):
#                                                     Phase A (C0b, eine gezielte Mutation je
#                                                     Kategorie in 20261001_001_amend_event.sql):
#                                                     (4) details_from_payload uebernimmt playerNumber
#                                                     nicht (auch nicht per AMEND) -> Angaben rot; (5) cache_columns schreibt
#                                                     breakStartedAt immer null -> Zwischenspeicher rot;
#                                                     (6) cfg_num mit \s (Unicode-Leerraum, vor PC5)
#                                                     -> Regeln rot. Phase A2 (C0b-Fixrunde 1, M7):
#                                                     (7) AMEND-Schritte 5/6 vertauscht -> genau
#                                                     Fixture 55d rot (Pruefreihenfolge). Phase B (B3a):
#                                                     (1) Tabellenzeile (running, GOAL) verlangt
#                                                     'leitung' statt 'helper' -> Fixtures + Seed rot;
#                                                     (2) compute_match_state ohne den review_state-
#                                                     Filter -> compute_match_state-Probe rot;
#                                                     (3) match_engine.num(jsonb) bekommt EXECUTE fuer
#                                                     PUBLIC -> Rechte-Assertion rot. Die Phasen sind
#                                                     getrennt, damit (1) die Kategorien Angaben/
#                                                     Zwischenspeicher nicht verdeckt rot faerbt.
#                                                     Exit 0 NUR, wenn JEDE der acht Kategorien
#                                                     einzeln rot ist; sonst Exit 1 (zahnlos).
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
APPEND_MIGRATION="20260928_003_append_match_events.sql"
AMEND_MIGRATION="20261001_001_amend_event.sql"
FIXTURES_DIR="$REPO_ROOT/src/core/match/__fixtures__"
RULES_DIR="$FIXTURES_DIR/rules"
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
APPEND_FILE=""
AMEND_FILE=""
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  NEWER_MIGRATIONS+=("$line")
  case "$(basename "$line")" in
    "$ENGINE_MIGRATION") ENGINE_FILE="$line" ;;
    "$APPEND_MIGRATION") APPEND_FILE="$line" ;;
    "$AMEND_MIGRATION") AMEND_FILE="$line" ;;
  esac
done <<< "$NEWER_MIGRATIONS_RAW"
if [[ -z "$ENGINE_FILE" || -z "$APPEND_FILE" || -z "$AMEND_FILE" ]]; then
  echo "::error::$ENGINE_MIGRATION, $APPEND_MIGRATION oder $AMEND_MIGRATION nicht in der Liste 'neuer als Baseline' gefunden." >&2
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
node "$REPO_ROOT/scripts/match-engine-ts-dump.ts" --rules > "$WORKDIR/ts-rules.json"
for f in "$FIXTURES_DIR"/rules/*.json; do jq -c --arg file "$(basename "$f")" '{file: $file, expect}' "$f"; done | jq -cs . > "$WORKDIR/expect-rules.json"
RULES_COUNT="$(find "$RULES_DIR" -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')"
if [[ "$(jq 'length' "$WORKDIR/ts-rules.json")" -ne "$RULES_COUNT" || "$RULES_COUNT" -eq 0 ]]; then
  echo "::error::TS-Regel-Dump passt nicht zu den $RULES_COUNT Regel-Fixtures." >&2
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
# C0b: 002 allein erneut einzuspielen ersetzte die in 20261001 geaenderten Funktionen durch den
# PR-B-Stand -- die Idempotenz wird deshalb fuer die ganze Kette 002 -> 003 -> 20261001 belegt.
echo "Idempotenz: $ENGINE_MIGRATION, $APPEND_MIGRATION, $AMEND_MIGRATION ein zweites Mal einspielen..." >&2
psql_stdin < "$ENGINE_FILE"
psql_stdin < "$APPEND_FILE"
psql_stdin < "$AMEND_FILE"

# C0b-Gegenprobe Phase A: je Kategorie genau eine gezielte Mutation in 20261001 (grep belegt je
# Muster genau einen Treffer). (4) wirkt auf state.details (und damit auch auf die Nachtrag-Regel,
# z. B. Fixture 47b -- Ergebnisse werden in Phase A deshalb NICHT gezaehlt), (5) nur auf
# cache_columns, (6) nur auf server_rules; die Kategorien Angaben/Zwischenspeicher/Regeln faerbt
# jeweils nur ihre eigene Mutation rot.
MUT_DETAILS="   WHERE p_payload ? f.name;"
MUT_DETAILS_TO="   WHERE p_payload ? f.name AND f.name <> 'playerNumber';"
MUT_CACHE="      'breakStartedAt', coalesce(p_state -> 'breakStartedAt', 'null'::jsonb))"
MUT_CACHE_TO="      'breakStartedAt', 'null'::jsonb)"
MUT_RULES="    WHEN 'string' THEN CASE WHEN (p_value #>> '{}') ~ '^[ \\t\\n\\r\\f\\v]*-?[0-9]+(\\.[0-9]+)?[ \\t\\n\\r\\f\\v]*\$'"
MUT_RULES_TO="    WHEN 'string' THEN CASE WHEN (p_value #>> '{}') ~ '^\\s*-?[0-9]+(\\.[0-9]+)?\\s*\$'"
# (7) C0b-Fixrunde 1 (Review M7): AMEND-Pruefschritte 5/6 vertauscht (ALREADY_RETRACTED vor der
# Zieltyp-/Feldpruefung). Erwartet rot: GENAU die Grenz-Fixture 55d (zurueckgenommenes Ziel +
# unzulaessiges Feld -> INVALID_PAYLOAD statt ALREADY_RETRACTED). Eigene Phase A2 auf einer sonst
# unveraenderten Migration -- jede weitere rote Fixture dort ist ein Abbruch (Liste stimmt nicht).
MUT_ORDER="  v_allowed := match_engine.detail_fields(v_target ->> 'type');"
MUT_ORDER_TO="  IF (p_state -> 'retracted') ? v_target_id THEN RETURN match_engine.reject('ALREADY_RETRACTED'); END IF;
  v_allowed := match_engine.detail_fields(v_target ->> 'type');"
ORDER_EXPECTED_RED="55d-pruefreihenfolge-zieltyp-vor-zurueckgenommen.json"
# apply_amend_mutations <Schluessel...>: 20261001 mit genau diesen Mutationen einspielen.
apply_amend_mutations() {
  local key pattern hits
  for key in "$@"; do
    pattern="${!key}"
    hits="$(grep -cF -- "$pattern" "$AMEND_FILE" || true)"
    if [[ "$hits" -ne 1 ]]; then
      echo "::error::Gegenprobe: Mutationszeile nicht genau einmal in $AMEND_MIGRATION ($hits): $pattern" >&2
      exit 1
    fi
  done
  MUT_KEYS="$*" MUT_DETAILS="$MUT_DETAILS" MUT_DETAILS_TO="$MUT_DETAILS_TO" MUT_CACHE="$MUT_CACHE" MUT_CACHE_TO="$MUT_CACHE_TO" \
  MUT_RULES="$MUT_RULES" MUT_RULES_TO="$MUT_RULES_TO" MUT_ORDER="$MUT_ORDER" MUT_ORDER_TO="$MUT_ORDER_TO" python3 -c '
import os, sys
s = sys.stdin.read()
for k in os.environ["MUT_KEYS"].split():
    s = s.replace(os.environ[k], os.environ[k + "_TO"])
sys.stdout.write(s)' < "$AMEND_FILE" | psql_stdin
}

if [[ "$MODE" == "gegenprobe" ]]; then
  echo "GEGENPROBE Phase A: (4) details ohne playerNumber; (5) live_state.breakStartedAt immer null;" \
       "(6) cfg_num mit \\s" >&2
  apply_amend_mutations MUT_DETAILS MUT_CACHE MUT_RULES
fi

# --- 2a. Zaehler, Seed-Gleichheit match_transitions == matchTransitions.json (Review M9) --------
FIX_DEV=0
SEED_DEV=0
PROBE_DEV=0
PRIV_DEV=0
DETAILS_DEV=0
CACHE_DEV=0
RULES_DEV=0
ORDER_DEV=0
ORDER_UNEXPECTED=0
check_seed() {
  local seed_db seed_json
  seed_db="$(psql_value <<'SQL'
SELECT from_status || '|' || event_type || '|' || actor || '|' || to_status FROM public.match_transitions ORDER BY 1;
SQL
)"
  seed_json="$(jq -r '.transitions[] | "\(.from)|\(.type)|\(.actor)|\(.to)"' "$REPO_ROOT/src/core/match/matchTransitions.json" | LC_ALL=C sort)"
  seed_db="$(LC_ALL=C sort <<<"$seed_db")"
  if [[ "$seed_db" == "$seed_json" ]]; then
    echo "OK          Seed: match_transitions == matchTransitions.json ($(wc -l <<<"$seed_db" | tr -d ' ') Zeilen)"
  else
    SEED_DEV=1
    echo "ABWEICHUNG  Seed: match_transitions (Container) != matchTransitions.json"
    diff -u --label "matchTransitions.json" --label "match_transitions" <(echo "$seed_json") <(echo "$seed_db") | sed 's/^/    /' || true
  fi
}

# --- 3. SQL-Seite (Harness-Hilfen) ------------------------------------------------------------
# Harness-Hilfen (nur im Wegwerf-Container): Fixture-Tabelle + Lauf je Fixture mit Fehlerfang,
# damit eine werfende Fixture nicht den ganzen Vergleich abbricht (sondern als ABWEICHUNG zaehlt).
# C0b: __parity_run liefert zusaetzlich details/sectionStartMs/breakStartedAt aus dem internen
# Zustand und match_engine.cache_columns(state, ctx); __parity_rules_run ruft server_rules.
psql_stdin <<'SQL'
CREATE TABLE public.__parity_fixtures (file text PRIMARY KEY, doc jsonb NOT NULL);
CREATE TABLE public.__parity_rules (file text PRIMARY KEY, doc jsonb NOT NULL);

CREATE FUNCTION public.__parity_run(p_doc jsonb, p_transitions jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $fn$
DECLARE
  v_prior jsonb;
  v_run jsonb;
BEGIN
  v_prior := public.match_reduce(coalesce(p_doc->'prior', '[]'::jsonb), p_doc->'ctx', p_transitions, 'log');
  v_run := public.match_continue(v_prior->'state', p_doc->'events', p_doc->'ctx', p_transitions, p_doc->>'mode');
  RETURN jsonb_build_object(
    'results', v_run->'results',
    'serverState', public.match_server_state(v_run->'state'),
    'details', coalesce(v_run->'state'->'details', 'null'::jsonb),
    'sectionStartMs', coalesce(v_run->'state'->'sectionStartMs', 'null'::jsonb),
    'breakStartedAt', coalesce(v_run->'state'->'breakStartedAt', '"fehlt"'::jsonb),
    'cacheColumns', match_engine.cache_columns(v_run->'state', p_doc->'ctx'));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLSTATE || ': ' || SQLERRM);
END;
$fn$;

CREATE FUNCTION public.__parity_rules_run(p_in jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $fn$
BEGIN
  RETURN jsonb_build_object('rules', match_engine.server_rules(
    (p_in->>'durationMinutes')::integer, p_in->>'phase', (p_in->>'groupPhaseDuration')::integer,
    (p_in->>'finalRoundDuration')::integer, p_in->'config', p_in->'finalsConfig'));
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
for f in "$RULES_DIR"/*.json; do
  doc="$(jq -c . "$f")"
  doc="${doc//$SQ/$SQ$SQ}"
  printf "INSERT INTO public.__parity_rules (file, doc) VALUES ('%s', '%s'::jsonb);\n" "$(basename "$f")" "$doc" >> "$WORKDIR/load.sql"
done
psql_stdin < "$WORKDIR/load.sql"

# --- 4. Vergleich (ein Durchgang; $1 = Fixtures zaehlen 1/0, $2 = Angaben/Zwischenspeicher/Regeln
#        zaehlen 1/0 -- die Gegenprobe zaehlt je Phase nur die Kategorien ihrer Mutationen) --------
TABLE_ROWS=()
OK_COUNT=0
compare_pass() {
  local count_fix="$1" count_extra="$2" count_order="${3:-0}"
  local pair file expect verdict sql_ts sql_expect details_ok cache_ok err sql_count
  psql_value > "$WORKDIR/sql.json" <<'SQL'
WITH tr AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object('from', from_status, 'type', event_type, 'actor', actor, 'to', to_status)
                            ORDER BY from_status, event_type), '[]'::jsonb) AS t
  FROM public.match_transitions
)
SELECT jsonb_agg(jsonb_build_object('file', f.file) || public.__parity_run(f.doc, tr.t) ORDER BY f.file)
FROM public.__parity_fixtures f CROSS JOIN tr;
SQL

  jq -cn --slurpfile ts "$WORKDIR/ts.json" --slurpfile sql "$WORKDIR/sql.json" '
    ($ts[0] | map({key: .file, value: .}) | from_entries) as $tsmap
    | $sql[0][]
    | . as $s
    | $tsmap[$s.file] as $t
    | {file: $s.file, sql: $s, ts: $t}
  ' > "$WORKDIR/pairs.jsonl"

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
                     and .sql.serverState == $e.serverState),
        details_ok: ((.sql.details == .ts.details)
                     and (.sql.sectionStartMs == .ts.sectionStartMs)
                     and (.sql.breakStartedAt == .ts.breakStartedAt)
                     and (if $e | has("details") then .sql.details == $e.details else true end)),
        cache_ok: ((.sql.cacheColumns == .ts.cacheColumns)
                   and (if ($e | has("liveState")) | not then true
                        elif $e.liveState == null then .sql.cacheColumns.live_state == null
                        else (.sql.cacheColumns.live_state as $l
                              | $l != null and ([$e.liveState | to_entries[] | $l[.key] == .value] | all)) end))
      }' <<<"$pair")"
    sql_ts="$(jq -r '.sql_ts' <<<"$verdict")"
    sql_expect="$(jq -r '.sql_expect' <<<"$verdict")"
    details_ok="$(jq -r '.details_ok' <<<"$verdict")"
    cache_ok="$(jq -r '.cache_ok' <<<"$verdict")"
    err="$(jq -r '.error // empty' <<<"$verdict")"
    if [[ "$count_fix" -eq 1 ]]; then
      if [[ "$sql_ts" == "true" && "$sql_expect" == "true" ]]; then
        OK_COUNT=$((OK_COUNT + 1))
        echo "OK          $file"
        TABLE_ROWS+=("| $file | = | = |")
      else
        FIX_DEV=$((FIX_DEV + 1))
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
    fi
    if [[ "$count_order" -eq 1 && ( "$sql_ts" != "true" || "$sql_expect" != "true" ) ]]; then
      # Gegenprobe Phase A2: rote Ergebnis-Fixtures stammen nur von Mutation (7).
      if [[ "$file" == "$ORDER_EXPECTED_RED" ]]; then
        ORDER_DEV=$((ORDER_DEV + 1))
        echo "ABWEICHUNG  Pruefreihenfolge $file (SQL==TS: $sql_ts, SQL==expect: $sql_expect) -- erwartet (Mutation 7)"
      else
        ORDER_UNEXPECTED=$((ORDER_UNEXPECTED + 1))
        echo "ABWEICHUNG  Pruefreihenfolge $file -- NICHT erwartet (Liste der roten Fixtures stimmt nicht)"
      fi
    fi
    if [[ "$count_extra" -eq 1 ]]; then
      if [[ "$details_ok" == "true" ]]; then
        echo "OK          Angaben $file"
      else
        DETAILS_DEV=$((DETAILS_DEV + 1))
        echo "ABWEICHUNG  Angaben $file (details/sectionStartMs/breakStartedAt: SQL != TS oder != expect.details)"
        [[ -n "$err" ]] && echo "    SQL-Fehler: $err"
        diff -u --label "TS/$file" --label "SQL/$file" \
          <(jq -S '{details: .ts.details, sectionStartMs: .ts.sectionStartMs, breakStartedAt: .ts.breakStartedAt}' <<<"$pair") \
          <(jq -S '{details: .sql.details, sectionStartMs: .sql.sectionStartMs, breakStartedAt: .sql.breakStartedAt}' <<<"$pair") | sed 's/^/    /' | head -40 || true
      fi
      if [[ "$cache_ok" == "true" ]]; then
        echo "OK          Zwischenspeicher $file"
      else
        CACHE_DEV=$((CACHE_DEV + 1))
        echo "ABWEICHUNG  Zwischenspeicher $file (cache_columns: SQL != TS oder != expect.liveState)"
        [[ -n "$err" ]] && echo "    SQL-Fehler: $err"
        diff -u --label "TS/$file" --label "SQL/$file" \
          <(jq -S '.ts.cacheColumns' <<<"$pair") <(jq -S '.sql.cacheColumns' <<<"$pair") | sed 's/^/    /' | head -40 || true
      fi
    fi
  done < "$WORKDIR/pairs.jsonl"

  sql_count="$(jq 'length' "$WORKDIR/sql.json")"
  if [[ "$sql_count" -ne "$FIXTURE_COUNT" ]]; then
    echo "ABWEICHUNG  SQL-Seite lieferte $sql_count statt $FIXTURE_COUNT Fixtures"
    [[ "$count_fix" -eq 1 ]] && FIX_DEV=$((FIX_DEV + 1))
    [[ "$count_extra" -eq 1 ]] && DETAILS_DEV=$((DETAILS_DEV + 1))
  fi

  if [[ "$count_extra" -eq 1 ]]; then
    # Regeln: server_rules (SQL) == serverRules (TS) == expect je Regel-Fixture.
    psql_value > "$WORKDIR/sql-rules.json" <<'SQL'
SELECT jsonb_agg(jsonb_build_object('file', r.file) || public.__parity_rules_run(r.doc->'input') ORDER BY r.file)
FROM public.__parity_rules r;
SQL
    while IFS= read -r rline; do
      file="$(jq -r '.file' <<<"$rline")"
      if jq -e '.ok' <<<"$rline" >/dev/null; then
        echo "OK          Regeln $file"
      else
        RULES_DEV=$((RULES_DEV + 1))
        echo "ABWEICHUNG  Regeln $file (SQL==TS: $(jq -r '.sql == .ts' <<<"$rline"), SQL==expect: $(jq -r '.sql == .expect' <<<"$rline"))"
        jq -c '{sql, ts, expect}' <<<"$rline" | sed 's/^/    /'
      fi
    done < <(jq -cn --slurpfile ts "$WORKDIR/ts-rules.json" --slurpfile sql "$WORKDIR/sql-rules.json" \
                   --slurpfile exp "$WORKDIR/expect-rules.json" '
      ($ts[0] | map({key: .file, value: .rules}) | from_entries) as $tsmap
      | ($exp[0] | map({key: .file, value: .expect}) | from_entries) as $emap
      | $sql[0][] | {file, sql: (.rules // .error), ts: $tsmap[.file], expect: $emap[.file]}
      | . + {ok: (.sql == .ts and .sql == .expect)}')
    if [[ "$(jq 'length' "$WORKDIR/sql-rules.json")" -ne "$RULES_COUNT" ]]; then
      RULES_DEV=$((RULES_DEV + 1))
      echo "ABWEICHUNG  Regeln: SQL-Seite lieferte nicht $RULES_COUNT Regel-Fixtures"
    fi
  fi
}

if [[ "$MODE" == "gegenprobe" ]]; then
  echo "--- Gegenprobe Phase A (Angaben, Zwischenspeicher, Regeln) ---"
  compare_pass 0 1
  echo "GEGENPROBE Phase A2: (7) AMEND-Schritte 5/6 vertauscht (sonst unveraenderte Migration)" >&2
  apply_amend_mutations MUT_ORDER
  echo "--- Gegenprobe Phase A2 (Pruefreihenfolge, erwartet rot genau: $ORDER_EXPECTED_RED) ---"
  compare_pass 0 0 1
  echo "GEGENPROBE Phase B: (1) match_transitions (running, GOAL) actor helper -> leitung;" \
       "(2) compute_match_state ohne review_state-Filter; (3) match_engine.num EXECUTE fuer PUBLIC" >&2
  # (2) zuerst: die Migration ohne den Filter erneut einspielen (setzt dabei auch die Rechte neu,
  # deshalb vor (3)). grep belegt, dass die Filterzeile wirklich getroffen wird. C0b: danach 003
  # und 20261001 erneut, sonst stuenden die PR-B-Fassungen der geaenderten Funktionen im Container
  # und (1) waere nicht mehr die einzige Ursache fuer rote Fixtures.
  if ! grep -q '^     AND e.review_state IS NULL;$' "$ENGINE_FILE"; then
    echo "::error::Gegenprobe (2): Filterzeile 'AND e.review_state IS NULL;' nicht gefunden." >&2
    exit 1
  fi
  sed 's/^     AND e.review_state IS NULL;$/     ;/' "$ENGINE_FILE" | psql_stdin
  psql_stdin < "$APPEND_FILE"
  psql_stdin < "$AMEND_FILE"
  psql_stdin <<'SQL'
UPDATE public.match_transitions SET actor = 'leitung' WHERE from_status = 'running' AND event_type = 'GOAL';
GRANT EXECUTE ON FUNCTION match_engine.num(jsonb) TO PUBLIC;
SQL
  echo "--- Gegenprobe Phase B (Seed, Fixtures, compute_match_state-Probe, Rechte) ---"
  check_seed
  compare_pass 1 0
else
  check_seed
  compare_pass 1 1
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
  insert_sql=""
  while IFS= read -r ev; do
    ev_escaped="${ev//$SQ/$SQ$SQ}"
    insert_sql+="SELECT public.__parity_insert_engine_event('$match_id', '$U_OWNER', '$ev_escaped'::jsonb);"$'\n'
  done < <(jq -c '.[]' <<<"$stored")
  run_as authenticated "$U_OWNER" "$insert_sql" >/dev/null
  if [[ "$PROBE_INDEX" -eq 1 ]]; then
    # Stoerzeilen, die compute_match_state ignorieren MUSS: eine Alt-Zeile (event_format IS NULL)
    # und eine Engine-Zeile mit review_state = 'pending' (beides je ein Tor fuer Team A). Sie
    # stehen NACH dem gespeicherten Log (hoeheres seq, Spiel laeuft dort noch) -- wuerde der Filter
    # fehlen, zaehlte das Tor (Gegenprobe (2) beweist das).
    psql_stdin <<SQL
INSERT INTO public.match_events (id, match_id, type, team_id, timestamp_seconds, score_home, score_away, owner_id)
VALUES ('$(uuid_for legacy-goal)', '$match_id', 'GOAL', '$team_a', 5, 1, 0, '$U_OWNER');
SQL
    run_as authenticated "$U_OWNER" "SELECT public.__parity_insert_engine_event('$match_id', '$U_OWNER', '{\"id\":\"$(uuid_for pending-goal)\",\"type\":\"GOAL\",\"teamId\":\"$team_a\",\"at\":999000,\"section\":1,\"clockMs\":50000,\"payload\":{}}'::jsonb, 'pending');" >/dev/null
  fi

  owner_state="$(run_as authenticated "$U_OWNER" "SELECT public.compute_match_state('$match_id');")"
  stranger_state="$(run_as authenticated "$U_STRANGER" "SELECT coalesce(public.compute_match_state('$match_id')::text, 'NULL');")"
  anon_state="$(run_as anon "" "SELECT coalesce(public.compute_match_state('$match_id')::text, 'NULL');")"

  if [[ -n "$owner_state" ]] && jq -e --argjson e "$expected_state" '. == $e' <<<"$owner_state" >/dev/null 2>&1; then
    echo "OK          compute_match_state $probe (Eigentuemer, $(jq 'length' <<<"$stored") gespeicherte Ereignisse)"
  else
    PROBE_DEV=$((PROBE_DEV + 1))
    echo "ABWEICHUNG  compute_match_state $probe (Eigentuemer)"
    diff -u --label "expect/$probe" --label "compute_match_state/$probe" \
      <(jq -S . <<<"$expected_state") <( (jq -S . <<<"$owner_state") 2>/dev/null || echo "$owner_state") | sed 's/^/    /' || true
  fi
  for who in stranger anon; do
    value="$stranger_state"; [[ "$who" == "anon" ]] && value="$anon_state"
    if [[ "$value" == "NULL" ]]; then
      echo "OK          compute_match_state $probe ($who sieht NULL -- RLS)"
    else
      PROBE_DEV=$((PROBE_DEV + 1))
      echo "ABWEICHUNG  compute_match_state $probe ($who sieht: $value)"
    fi
  done
done

# --- 6. Rechte-Assertion im migrierten Container ----------------------------------------------
# scripts/db_privilege_assertions.sql laeuft live im Drift-Check (nur mit SUPABASE_DB_READONLY_URL,
# ueber die Direktverbindung als ci_schema_reader). Hier derselbe Satz gegen den frisch migrierten
# Container, damit die B3a-Zeilen (SECURITY INVOKER, STABLE/IMMUTABLE, kein PUBLIC-EXECUTE, Anzahl
# 41, Positivkontrollen) schon vor dem Live-Apply bewiesen sind. Jede Zeile muss "|t" sein.
#
# Abschluss-Fixrunde (final-review-B.md, I2): SET ROLE ci_schema_reader VOR dem Einspielen der
# Datei -- vorher lief die Assertion hier als postgres, der USAGE-Fehlen auf dem Schema
# match_engine (fehlendes GRANT USAGE ... TO ci_schema_reader) waere NIE aufgefallen, weil
# has_function_privilege() als postgres jede Rechteprüfung umgeht. has_function_privilege() mit
# einer 'match_engine.f(...)'-Textsignatur loest die Funktion ueber regprocedure auf -- das prueft
# USAGE auf dem Schema fuer den AUFRUFENDEN Nutzer, live also ci_schema_reader (siehe I2-Fund).
# `postgres` ist im Supabase-Image (empirisch geprueft: rolsuper=false, rolcreaterole=true) KEIN
# echter Superuser -- SET ROLE allein liefert "permission denied to set role" ohne vorherige
# Mitgliedschaft. Da postgres ci_schema_reader selbst angelegt hat (20260924_002, bedingter
# DO-Block), hat es ADMIN OPTION darauf (Postgres vergibt das automatisch an den Ersteller einer
# Rolle mit CREATEROLE) und kann sich deshalb selbst per `GRANT ci_schema_reader TO postgres;`
# Mitgliedschaft geben, bevor SET ROLE greift. RESET ROLE am Verbindungsende ist unnoetig (die
# Verbindung wird sofort danach geschlossen); die GRANT-Mitgliedschaft bleibt im Wegwerf-Container
# bestehen, ist aber wirkungslos (kein zweiter Aufrufer, Container wird ohnehin entfernt).
PRIV_OUT="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || {
  echo "ABWEICHUNG  Rechte-Assertion nicht ausfuehrbar: $PRIV_OUT"
  PRIV_DEV=$((PRIV_DEV + 1))
  PRIV_OUT=""
}
if [[ -n "$PRIV_OUT" ]]; then
  PRIV_FAILED="$(grep -v '|t$' <<<"$PRIV_OUT" || true)"
  if [[ -n "$PRIV_FAILED" ]]; then
    echo "ABWEICHUNG  Rechte-Assertion: $PRIV_FAILED"
    PRIV_DEV=$((PRIV_DEV + 1))
  else
    echo "OK          Rechte-Assertion: $(wc -l <<<"$PRIV_OUT" | tr -d ' ') Zeilen |t (scripts/db_privilege_assertions.sql)"
  fi
fi

# --- 7. Ergebnis ------------------------------------------------------------------------------
echo ""
echo "Gleichlauf-Tabelle (Fixture | SQL==TS | SQL==expect):"
printf '%s\n' "${TABLE_ROWS[@]}"
echo ""
DEVIATIONS=$((FIX_DEV + SEED_DEV + PROBE_DEV + PRIV_DEV + DETAILS_DEV + CACHE_DEV + RULES_DEV + ORDER_DEV + ORDER_UNEXPECTED))
echo "Fixtures: $FIXTURE_COUNT, OK: $OK_COUNT, Regel-Fixtures: $RULES_COUNT, Abweichungen gesamt (inkl. compute_match_state-Probe): $DEVIATIONS"
echo "Abweichungen je Kategorie: Fixtures=$FIX_DEV Seed=$SEED_DEV compute_match_state-Probe=$PROBE_DEV Rechte=$PRIV_DEV Angaben=$DETAILS_DEV Zwischenspeicher=$CACHE_DEV Regeln=$RULES_DEV Pruefreihenfolge=$ORDER_DEV (unerwartet: $ORDER_UNEXPECTED)"

if [[ "$MODE" == "gegenprobe" ]]; then
  # Review M4: jede Kategorie muss EINZELN rot sein -- eine rote Kategorie darf eine zahnlos
  # gewordene andere nicht verdecken (C0b: deshalb zwei Phasen, siehe Kopfkommentar).
  TOOTHLESS=()
  [[ "$FIX_DEV" -gt 0 ]] || TOOTHLESS+=("Fixtures")
  [[ "$SEED_DEV" -gt 0 ]] || TOOTHLESS+=("Seed")
  [[ "$PROBE_DEV" -gt 0 ]] || TOOTHLESS+=("compute_match_state-Probe")
  [[ "$PRIV_DEV" -gt 0 ]] || TOOTHLESS+=("Rechte")
  [[ "$DETAILS_DEV" -gt 0 ]] || TOOTHLESS+=("Angaben")
  [[ "$CACHE_DEV" -gt 0 ]] || TOOTHLESS+=("Zwischenspeicher")
  [[ "$RULES_DEV" -gt 0 ]] || TOOTHLESS+=("Regeln")
  [[ "$ORDER_DEV" -gt 0 ]] || TOOTHLESS+=("Pruefreihenfolge")
  if [[ "$ORDER_UNEXPECTED" -gt 0 ]]; then
    echo "::error::Gegenprobe Phase A2: $ORDER_UNEXPECTED unerwartet rote Ergebnis-Fixture(s) -- Mutationen nicht unabhaengig." >&2
    exit 1
  fi
  if [[ "${#TOOTHLESS[@]}" -eq 0 ]]; then
    echo "Gegenprobe wie erwartet ROT in allen acht Kategorien ($DEVIATIONS Abweichung(en))."
    exit 0
  fi
  echo "::error::Gegenprobe: Mutation blieb UNBEMERKT in: ${TOOTHLESS[*]} -- dieser Teil des Checks ist zahnlos." >&2
  exit 1
fi

if [[ "$DEVIATIONS" -gt 0 ]]; then
  echo "::error::$DEVIATIONS Abweichung(en) zwischen SQL-Zwilling, TS-Rechenfunktion und Fixture-Erwartung." >&2
  exit 1
fi
echo "Gleichlauf gruen: SQL == TS == expect fuer alle $FIXTURE_COUNT Fixtures (Ergebnisse, serverState, Angaben, Zwischenspeicher) und $RULES_COUNT Regel-Fixtures, compute_match_state-Probe gruen."
exit 0
