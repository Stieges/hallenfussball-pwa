#!/usr/bin/env bash
#
# tournament-lifecycle-check.sh — Container-Beweis fuer supabase/migrations/20261113_003_tournament_lifecycle.sql (A-21a-S,
# plan-endstand-abschluss.md Fassung 2 § 3 „A-21a-S“ Punkte 1-11, Pflichttests P-0 … P-13, Mutationen ME1 … ME20).
# Muster: scripts/helper-join-check.sh und scripts/group-completion-check.sh (Wegwerf-Container supabase/postgres, nativ;
# Baseline + Migrationen seit Baseline; trap). Hilfen: scripts/lib/group-completion-harness.sql (echt erzeugte Turniere
# aus src/core/standings/__fixtures__/group-state.json) und scripts/lib/tournament-lifecycle-harness.sql.
#
# Testwerte aus dem Gherkin: Nikolaus-Turnier (Jeder gegen jeden, 6 Teams; Petting und Otting „Ergebnis so akzeptieren“
# -> Plaetze 1, 2, 3, 3, 5, 6 wie final-standings-roundrobin.json) und „Hallencup Nord“ (2 x 4, Halbfinale, Spiel um
# Platz 3, Finale). Olli = Eigentuemer, Maria = Co-Admin, Tom = Helfer-Geraet (anonyme Sitzung, Rolle helper), Kai =
# Konto-Helfer (Rolle collaborator), Hallen-Monitor = Bildschirm (Rolle screen), ein Fremder ohne Rolle, anon = Eltern.
#
# Kategorien:
#   P  Positiv-Kontrolle zuerst (P-0): Nikolaus abschliessen gelingt.
#   F  Fail-fast: fehlende Voraussetzung / fremde append-Fassung -> Abbruch ohne Aenderung.
#   G  Gleichlauf-Fixtures (SQL-Seite): final-standings-shapes.json, final-standings-roundrobin.json, tournament-state.json.
#   R  Pflichttests P-1 … P-13 mit Gegenbeispielen.
#   S  Katalog, Rechte, Backfill, Rechte-Assertions (Wächter R-EA-8), Namensliste.
#   M  Mehrere Sitzungen: Sperrreihenfolge (K4, ME7) und gleichzeitiger Doppel-Abschluss.
#   W  zweites Einspielen (idempotent).   X  Rueckweg -> Schema = vorher; zweiter Rueckweg vom Waechter gestoppt.
#
# Aufrufoptionen:
#   bash scripts/tournament-lifecycle-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/tournament-lifecycle-check.sh --without-migration  Gegenprobe: ohne 20261113_003 -> P und R ROT
#   bash scripts/tournament-lifecycle-check.sh --gegenprobe         je Lauf eine Mutation einer KOPIE (ME1-ME20);
#                                                                   Exit 0 nur, wenn JEDE Mutation rot faerbt
#                                                                   (GEGENPROBE_NUR="ME3 ME7" schraenkt ein)
#   bash scripts/tournament-lifecycle-check.sh --print-rueckweg     Rueckweg (Anhang B der Freigabe), ohne Container
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container
# (nativ; DOCKER_PLATFORM=linux/amd64 waehlt die Plattform ausdruecklich), wird am Ende entfernt (trap).
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

POSTGRES_IMAGE="supabase/postgres:17.6.1.063"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261113_003_tournament_lifecycle.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
APPEND_SOURCE_FILE="$MIGRATIONS_DIR/20261110_009_spiel_beenden.sql"
APPEND_005_FILE="$MIGRATIONS_DIR/20261110_005_result_entry_forfeit.sql"
HELPERS_SOURCE_FILE="$MIGRATIONS_DIR/20261110_008_helper_join.sql"
# R3-5b: spaetere Migration, die NUR final_standing_row_valid ersetzt (tableValues). Kategorie G liest dieselbe Gleichlauf-Datei
# und prueft sie deshalb gegen die Fassung MIT dieser Migration; fehlt die Datei, laeuft G gegen die A-21a-Fassung (Gegenprobe).
ROW_FOLLOWUP_FILE="$MIGRATIONS_DIR/20261118_002_endstand_tabellenwerte.sql"
FIX_DIR="$REPO_ROOT/src/core/standings/__fixtures__"
CONTAINER_PREFIX="tournament-lifecycle-check-$$"
CURRENT_CONTAINER=""
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tournament-lifecycle-check.XXXXXX")"

# append_match_events woertlich aus 20261110_009 (Spiel beenden, juengste Fassung vor A-21a) bzw. aus 20261110_005 (nur
# Fail-fast-Probe) und tournament_closed_for_helpers aus 20261110_008.
append_009_sql() {
  awk '/^CREATE OR REPLACE FUNCTION public.append_match_events\(/{f=1} f{print} f && $0=="$$;"{exit}' "$APPEND_SOURCE_FILE"
}
append_005_sql() {
  awk '/^CREATE OR REPLACE FUNCTION public.append_match_events\(/{f=1} f{print} f && $0=="$$;"{exit}' "$APPEND_005_FILE"
}
helpers_008_sql() {
  awk '/^CREATE OR REPLACE FUNCTION public.tournament_closed_for_helpers\(/{f=1} f{print} f && /^\$\$;/{exit}' "$HELPERS_SOURCE_FILE"
}

# Rueckweg (Anhang B): Sperre und neue Objekte weg, append_match_events und tournament_closed_for_helpers woertlich zurueck,
# Spalten weg. Waechter: nur gegen die A-21a-Fassung.
rueckweg_sql() {
  cat <<'SQL'
-- Rueckweg A-21a (20261113_003_tournament_lifecycle.sql), erzeugt von scripts/tournament-lifecycle-check.sh --print-rueckweg
-- Vorher: App ohne A-21a-Client deployt; gespeicherte Endstaende, Verlauf und spaete Eintraege per COPY gesichert (die
-- Tabellen gehen mit). Ein Block. Laeuft nur gegen die A-21a-Fassung (sonst Abbruch ohne Aenderung).
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF to_regprocedure('match_engine.closed_intake(uuid,uuid,jsonb,uuid,uuid)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'lifecycle_status')
     OR position('match_engine.closed_intake(' IN (SELECT prosrc FROM pg_proc
                   WHERE oid = 'public.append_match_events(uuid,jsonb,integer,uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Rueckweg A-21a: nicht in der A-21a-Fassung -- nichts geaendert';
  END IF;
END
$rw$;
-- 1. Sperre weg (Trigger zuerst, damit die folgenden Schritte nichts sperrt)
DROP TRIGGER IF EXISTS matches_guard_closed ON public.matches;
DROP TRIGGER IF EXISTS teams_guard_closed ON public.teams;
DROP TRIGGER IF EXISTS team_players_guard_closed ON public.team_players;
DROP TRIGGER IF EXISTS sponsors_guard_closed ON public.sponsors;
DROP TRIGGER IF EXISTS match_events_guard_closed ON public.match_events;
DROP TRIGGER IF EXISTS match_corrections_guard_closed ON public.match_corrections;
DROP TRIGGER IF EXISTS group_completions_guard_closed ON public.group_completions;
DROP TRIGGER IF EXISTS bracket_notices_guard_closed ON public.bracket_notices;
DROP TRIGGER IF EXISTS clarifications_guard_closed ON public.clarifications;
DROP TRIGGER IF EXISTS bracket_log_guard_closed ON public.bracket_log;
DROP TRIGGER IF EXISTS field_control_guard_closed ON public.field_control;
DROP TRIGGER IF EXISTS tournaments_guard_lifecycle ON public.tournaments;
DROP TRIGGER IF EXISTS tournaments_lifecycle_follow_status ON public.tournaments;
-- 2. append_match_events woertlich aus 20261110_009_spiel_beenden.sql (juengste Fassung vor A-21a)
SQL
  append_009_sql
  cat <<'SQL'
-- 3. tournament_closed_for_helpers woertlich aus 20261110_008_helper_join.sql (nur, wenn vorhanden)
DO $rw$
BEGIN
  IF to_regprocedure('public.tournament_closed_for_helpers(uuid)') IS NOT NULL THEN
    EXECUTE $fn8$
SQL
  helpers_008_sql
  cat <<'SQL'
$fn8$;
  END IF;
END
$rw$;
-- 4. Neue Funktionen, Tabellen, Spalten
DROP FUNCTION IF EXISTS public.guard_closed_tournament(), public.tournaments_lifecycle_follow_status(),
  public.tournaments_guard_lifecycle(), public.report_device_outbox(uuid, uuid, integer, integer),
  public.display_final_standings(uuid), public.public_final_standings(text), public.reopen_tournament(uuid, text, uuid),
  public.finish_preflight(uuid), public.finish_tournament(uuid, jsonb, jsonb, uuid),
  match_engine.final_standings_payload(public.tournaments), match_engine.actor_name(uuid, uuid),
  match_engine.closed_intake(uuid, uuid, jsonb, uuid, uuid), match_engine.final_standings_consistent(uuid, jsonb),
  match_engine.place_numbers_valid(integer[]), match_engine.final_standings_shape_valid(jsonb),
  match_engine.scorer_row_valid(jsonb), match_engine.final_standing_row_valid(jsonb),
  match_engine.json_text_length_between(jsonb, integer, integer), match_engine.json_int_between(jsonb, numeric, numeric),
  match_engine.finish_warnings(uuid), match_engine.finish_open_items(uuid), match_engine.match_winner(public.matches),
  match_engine.tournament_state(uuid), public.tournament_is_closed(uuid), public.tournament_lifecycle(uuid);
DROP TABLE IF EXISTS public.device_outbox_reports, public.late_entries, public.tournament_lifecycle_log,
  public.tournament_final_standings;
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_lifecycle_status_check;
ALTER TABLE public.tournaments DROP COLUMN IF EXISTS finished_at;
ALTER TABLE public.tournaments DROP COLUMN IF EXISTS lifecycle_status;
COMMIT;
-- Danach: Assertions lifecycle-* + PRIVILEGE_ASSERTION_NAMES + pending_assertions_for zurueck, Drift-Check, Typen-PR.
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
  docker run -d ${DOCKER_PLATFORM:+--platform "$DOCKER_PLATFORM"} --name "$CURRENT_CONTAINER" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
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
stop_container() { docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1; CURRENT_CONTAINER=""; }

psql_stdin() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q; }
q() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA <<<"$1" 2>&1; }
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public --schema=match_engine postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }

apply_row_followup() { [[ -f "$ROW_FOLLOWUP_FILE" ]] && { psql_stdin < "$ROW_FOLLOWUP_FILE" >/dev/null || { echo "::error::$(basename "$ROW_FOLLOWUP_FILE") scheitert" >&2; exit 1; }; }; return 0; }

CATS=(P F G R S M W X)
DEVS=(0 0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0 0)
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
    FAILED="$FAILED"$'\n'"$2"
  fi
}
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
reset_counts() { DEVS=(0 0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0 0); FAILED=""; }
summary() {
  local i
  echo
  for i in "${!CATS[@]}"; do echo "Kategorie ${CATS[$i]}: ${OKS[$i]} OK, ${DEVS[$i]} Abweichung(en)"; done
}

source "$REPO_ROOT/scripts/lib/tournament-lifecycle-probes.sh"

setup_before() {
  echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  psql_stdin < "$BASELINE_FILE" >/dev/null || { echo "::error::Baseline scheitert" >&2; exit 1; }
  local f
  for f in "${BEFORE[@]}"; do psql_stdin < "$f" >/dev/null || { echo "::error::Migration scheitert: $f" >&2; exit 1; }; done
  setup_data
}

# ---------------------------------------------------------------------------------------------------------
if [[ "$MODE" == "gegenprobe" ]]; then
  MUTATIONS=(ME1 ME2 ME3 ME4 ME5 ME6 ME7 ME8 ME9 ME10 ME11 ME12 ME13 ME14 ME15 ME16 ME17 ME18 ME19 ME20 ME21 ME22)
  if [[ -n "${GEGENPROBE_NUR:-}" ]]; then read -r -a MUTATIONS <<<"$GEGENPROBE_NUR"; fi
  RED_TOTAL=0
  RED_LIST=""
  for mut in "${MUTATIONS[@]}"; do
    MUTATED="$WORK_DIR/$mut-$TARGET_NAME"
    if ! MUT_KEY="$mut" python3 "$REPO_ROOT/scripts/lib/tournament-lifecycle-mutations.py" < "$TARGET_FILE" > "$MUTATED"; then
      echo "::error::Mutation $mut nicht anwendbar"; exit 1
    fi
    start_container "$mut"
    setup_before
    if ! psql_stdin < "$MUTATED" >/dev/null 2>"$WORK_DIR/$mut.err"; then
      echo "GEGENPROBE $mut: Einspielen scheitert ($(head -c 160 "$WORK_DIR/$mut.err")) -- zaehlt als rot"
      RED_TOTAL=$((RED_TOTAL + 1)); RED_LIST="$RED_LIST $mut"
      stop_container
      continue
    fi
    apply_row_followup
    reset_counts
    echo "--- GEGENPROBE $mut ---"
    setup_after
    run_probes
    run_races
    run_assertions
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "GEGENPROBE $mut: rot ($(total_dev) Abweichung(en)) -- wie verlangt; rote Pruefungen:$(sed 's/^/ | /' <<<"$FAILED" | tr -d '\n' | cut -c1-600)"
      RED_TOTAL=$((RED_TOTAL + 1)); RED_LIST="$RED_LIST $mut"
    else
      echo "::error::GEGENPROBE $mut blieb gruen (zahnlos)"
    fi
    stop_container
  done
  echo
  echo "Gegenprobe: $RED_TOTAL von ${#MUTATIONS[@]} Mutationen rot:$RED_LIST"
  [[ "$RED_TOTAL" -eq "${#MUTATIONS[@]}" ]]
  exit $?
fi

start_container "$MODE"
setup_before

if [[ "$MODE" == "without-migration" ]]; then
  setup_after
  run_probes
  summary
  P_DEV="${DEVS[$(cat_index P)]}"; R_DEV="${DEVS[$(cat_index R)]}"
  if [[ "$P_DEV" -gt 0 && "$R_DEV" -gt 0 ]]; then
    echo "Ohne Migration: P und R rot -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (P=$P_DEV, R=$R_DEV muessen > 0 sein)."
  exit 1
fi

# --- F: Fail-fast (ohne Aenderung) ------------------------------------------------------------------------
FAILFAST="$(awk '/^-- 0\. Voraussetzungen/{f=1} /^-- 1\. Spalten/{exit} f' "$TARGET_FILE")"
check F "F1 ohne 20261110_006 (clarifications fehlt) -> Abbruch 'Voraussetzungen fehlen'" "1" \
  "$(q "BEGIN; DROP TABLE public.clarifications CASCADE;
$FAILFAST
ROLLBACK;" | grep -c 'Voraussetzungen fehlen')"
check F "F2 ohne Recht manageLifecycle (co-admin) -> Abbruch" "1" \
  "$(q "BEGIN; DELETE FROM public.role_permissions WHERE role = 'co-admin' AND permission = 'manageLifecycle';
$FAILFAST
ROLLBACK;" | grep -c 'Voraussetzungen fehlen')"
check F "F3 fremde Fassung von append_match_events (ohne Feldsteuerung) -> Abbruch 'unbekannte Fassung'" "1" \
  "$(q "BEGIN; CREATE OR REPLACE FUNCTION public.append_match_events(p_match_id uuid, p_events jsonb, p_client_format integer, p_device_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS \$x\$ SELECT '{}'::jsonb \$x\$;
$FAILFAST
ROLLBACK;" | grep -c 'unbekannte Fassung')"
check F "F3b Fassung 20261110_005 ohne „Spiel beenden“ (v_end_by_lead) -> Abbruch 'unbekannte Fassung' (die _009-Ausnahme ginge sonst still verloren)" "1" \
  "$(q "BEGIN; $(append_005_sql)
$FAILFAST
ROLLBACK;" | grep -c 'unbekannte Fassung')"
APPEND_009_SHA="4613616212c19d8d6b040c932eb505121016440929814cd2a70d7a378bbb74f6"   # 20261110_009 nach Fixrunde (c1454cc7/cd3cd8bb)
check S "Waechter: Basis 20261110_009_spiel_beenden.sql hat die freigegebene Fassung (SHA-256 4613616…74f6)" "$APPEND_009_SHA" \
  "$(shasum -a 256 "$APPEND_SOURCE_FILE" | cut -d' ' -f1)"
check S "Diff-Waechter: append_match_events = Fassung 20261110_009 plus genau der closed_intake-Block (5 Zeilen, vor dem Feld-INSERT)" "0|5" \
  "$(python3 - "$APPEND_SOURCE_FILE" "$TARGET_FILE" <<'PY'
import sys, difflib
def fn(p):
    L = open(p).read().split('\n')
    i = next(k for k, l in enumerate(L) if l.startswith('CREATE OR REPLACE FUNCTION public.append_match_events('))
    j = next(k for k in range(i, len(L)) if L[k] == '$$;')
    return L[i:j + 1]
d = [l for l in difflib.ndiff(fn(sys.argv[1]), fn(sys.argv[2])) if l[:2] in ('- ', '+ ')]
print(f"{sum(1 for l in d if l.startswith('- '))}|{sum(1 for l in d if l.startswith('+ '))}")
PY
)"
q "DELETE FROM public.role_permissions WHERE role = 'screen' AND permission = 'readDisplay';" >/dev/null
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
F4_EXIT=$?
check F "F4 ganze Datei ohne Voraussetzung: Abbruch, keine neue Spalte, keine neue Tabelle" "3|0|<null>" \
  "$F4_EXIT|$(q "SELECT count(*) FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'lifecycle_status';")|$(q "SELECT coalesce(to_regclass('public.late_entries')::text, '<null>');")"
q "INSERT INTO public.role_permissions (role, permission) VALUES ('screen', 'readDisplay');" >/dev/null

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
DATA_SQL="SELECT (SELECT count(*) FROM public.tournaments) || '|' || (SELECT count(*) FROM public.matches) || '|' || (SELECT count(*) FROM public.match_events) || '|' || (SELECT count(*) FROM public.teams);"
DATA_BEFORE="$(q "$DATA_SQL")"
UPDATED_BEFORE="$(q "SELECT string_agg(updated_at::text, ',' ORDER BY id) FROM public.tournaments;")"
echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE" >/dev/null || { echo "::error::$TARGET_NAME scheitert" >&2; exit 1; }
check S "Bestand: Turniere, Spiele, Ereignisse, Teams unveraendert; updated_at der Turniere unveraendert (Backfill ohne Zeitstempel)" \
  "$DATA_BEFORE|$UPDATED_BEFORE" "$(q "$DATA_SQL")|$(q "SELECT string_agg(updated_at::text, ',' ORDER BY id) FROM public.tournaments;")"
check S "R-EA-11 Backfill: published -> fixed, draft/live/completed (auch mit manuallyCompleted) -> draft, finished_at leer" \
  "fixed|draft|draft|draft|0" \
  "$(q "SELECT string_agg(lifecycle_status, '|' ORDER BY title) FROM public.tournaments WHERE title LIKE 'Alt-%';")|$(q "SELECT count(*) FROM public.tournaments WHERE finished_at IS NOT NULL;")"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in tables rls_tables triggers policies; do
  case "$dim" in tables|rls_tables) expected=4 ;; triggers) expected=13 ;; policies) expected=3 ;; esac
  check S "Katalogzaehlung $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done

apply_row_followup
setup_after
run_probes
run_races
run_catalog
run_assertions

# --- W: idempotent -----------------------------------------------------------------------------------------
STATE_SQL="SELECT (SELECT count(*) FROM public.tournament_final_standings) || '|' || (SELECT count(*) FROM public.tournament_lifecycle_log) || '|' || (SELECT count(*) FROM public.late_entries) || '|' || (SELECT string_agg(lifecycle_status, ',' ORDER BY id) FROM public.tournaments);"
STATE_W="$(q "$STATE_SQL")"
DUMP_W="$(schema_dump)"
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
W_EXIT=$?
apply_row_followup   # die A-21a-Datei setzt die Zeilenpruefung auf ihre Fassung zurueck; die spaetere Migration stellt sie wieder her
check W "zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check W "danach Daten unveraendert (abgeschlossene Turniere bleiben abgeschlossen), Schema wie nach dem ersten Einspielen" \
  "$STATE_W|identisch" "$(q "$STATE_SQL")|$([[ "$(schema_dump)" == "$DUMP_W" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg (Anhang B) -------------------------------------------------------------------------------
rueckweg_sql | psql_stdin >/dev/null 2>"$WORK_DIR/rueckweg.err"
check X "Rueckweg laeuft (Exit 0)" "0|" "$?|$(head -c 200 "$WORK_DIR/rueckweg.err")"
DUMP_ROLLED_BACK="$(schema_dump)"
check X "nach dem Rueckweg: Schema public + match_engine = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi
check X "nach dem Rueckweg: Turniere, Spiele, Ereignisse, Teams vollzaehlig" "$(cut -d'|' -f1-4 <<<"$(q "$DATA_SQL")")" "$(q "$DATA_SQL")"
check X "Rueckweg ein zweites Mal -> Abbruch durch den Waechter, nichts geaendert" "1" \
  "$(rueckweg_sql | q "$(cat)" | grep -c 'nicht in der A-21a-Fassung')"
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
check X "danach erneut einspielbar (Exit 0, Schema = erstes Einspielen)" "0|identisch" "$?|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f" >/dev/null || { check S "spaetere Migration laeuft: $(basename "$f")" "0" "1"; continue; }
  echo "OK    spaetere Migration laeuft: $(basename "$f")" >&2
done

summary
if [[ "$(total_dev)" -gt 0 ]]; then
  echo "::error::$(total_dev) Abweichung(en)."
  exit 1
fi
echo "Alle Pruefungen ohne Abweichung."
exit 0
