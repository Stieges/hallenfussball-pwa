#!/usr/bin/env bash
#
# gatherings-check.sh — Container-Beweis fuer supabase/migrations/20261119_001_gatherings.sql (A1 Veranstaltung, Record
# docs/anforderungen/2026-11-06_veranstaltung-mehrere-turniere.md, „Umsetzungsvorgabe A1“). Muster: public-payload-check.sh
# (Wegwerf-Container supabase/postgres, Baseline + Migrationen seit Baseline, Wegwerf-PostgREST im eigenen Netz, trap).
# Die Pruefungen stehen in scripts/gatherings-check.d/*.sh (per source, gleiche Hilfen und Zaehler).
#
# Testwerte aus dem Gherkin: Olli (Eigentuemer, „Hallenturniere TSV Waging 28./29.11.“), Maria (Co-Admin in
# „F2-Junioren“), Tom (Helfer-Geraet), Bildschirm (Rolle screen), Clara (Konto ohne Rolle), Greta (eigenes Turnier),
# Anja (anonyme Sitzung), Mama Petra = anon ohne Sitzung.
#
# Kategorien:
#   V  Verwaltung: anlegen, umbenennen, loeschen, Grenze 50, Namen, Code ueber beide Tabellen (@VA-015, @VA-011)
#   Z  Zuordnung: Rechte, Konflikt, Papierkorb, wiederholbar, Wettlauf, Abschluss-Sperre, Optimistic Lock, Kopie
#      (@VA-016, @VA-019, @VA-020, @VA-021)
#   P  public_gathering: Zustaende, Positivliste, Ordnung, Zustand je Turnier (@VA-001..@VA-004, @VA-006)
#   A  Version ueber die echte Server-Antwort (PostgREST): monoton nach Loesen, Papierkorb, Loeschen, Anpfiff zurueck,
#      Umbenennen (@ZM-180, @VA-012, @VA-014)
#   T  Turnierantwort: gathering_code nur fuer Zuschauer, sonst Antwort vor = nach der Migration (@VA-013, @VA-005)
#   S  Schema/Rechte (SECURITY DEFINER, search_path, Grants, RLS, keine Client-Schreibrechte)
#   W  zweites Einspielen (idempotent)   X  Rueckweg -> Schema = vorher; Fail-fast bei fremder Fassung
#
# Aufrufoptionen:
#   bash scripts/gatherings-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/gatherings-check.sh --without-migration  Gegenprobe: ohne die Migration muessen V, Z, P, A, T ROT sein
#   bash scripts/gatherings-check.sh --gegenprobe         je Mutation (Liste in gatherings-check.d/mutationen.py) ein Lauf;
#                                                         Exit 0 NUR, wenn JEDE Mutation mindestens eine Pruefung rot faerbt
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigene Wegwerf-Container und ein
# eigenes Wegwerf-Netz, am Ende entfernt (trap).
#
set -euo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe)" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063"
POSTGREST_IMAGE="${POSTGREST_IMAGE:-public.ecr.aws/supabase/postgrest:v16.2}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARTS="$REPO_ROOT/scripts/gatherings-check.d"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261119_001_gatherings.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
ROLLBACK_FILE="$REPO_ROOT/supabase/rollbacks/20261119_001_gatherings_rollback.sql"
PREFIX="gatherings-check-$$"
NET="$PREFIX-net"
C="$PREFIX-db"
REST=""
REST_PORT=""
WORK="$(mktemp -d "${TMPDIR:-/tmp}/gatherings-check.XXXXXX")"
JWT_SECRET="gatherings-check-secret-0123456789abcdef0123"

command -v jq >/dev/null 2>&1 || { echo "::error::jq wird benoetigt." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "::error::curl wird benoetigt." >&2; exit 1; }
[[ -f "$TARGET_FILE" ]] || { echo "::error::$TARGET_NAME fehlt." >&2; exit 1; }

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
BEFORE=()
AFTER=()
SEEN=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if [[ "$(basename "$line")" == "$TARGET_NAME" ]]; then SEEN=1
  elif [[ "$SEEN" -eq 0 ]]; then BEFORE+=("$line")
  else AFTER+=("$line"); fi
done <<< "$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")"
[[ "$SEEN" -eq 1 ]] || { echo "::error::$TARGET_NAME nicht in der Liste 'neuer als Baseline'." >&2; exit 1; }

stop_rest() { [[ -n "$REST" ]] && docker rm -f "$REST" >/dev/null 2>&1 || true; REST=""; REST_PORT=""; }
cleanup() {
  local rc=$?
  stop_rest
  docker rm -f "$C" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$WORK"
  exit "$rc"
}
trap cleanup EXIT
docker network create "$NET" >/dev/null

start_db() {
  docker run -d --name "$C" --network "$NET" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 90); do
    if [[ "$(docker logs "$C" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
      ready=1; break
    fi
    sleep 1
  done
  [[ "$ready" -eq 1 ]] || { echo "::error::Container nicht bereit." >&2; docker logs "$C" 2>&1 | tail -30 >&2; exit 1; }
  for _ in $(seq 1 30); do docker exec "$C" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
}
# PostgREST erst NACH dem Einspielen starten (Schema-Cache); bei Schemawechsel neu starten.
start_rest() {
  stop_rest
  REST="$C-rest"
  docker run -d --name "$REST" --network "$NET" -p 127.0.0.1::3000 \
    -e PGRST_DB_URI="postgres://authenticator:postgres@$C:5432/postgres" \
    -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$JWT_SECRET" \
    -e PGRST_DB_CHANNEL_ENABLED=false "$POSTGREST_IMAGE" >/dev/null
  REST_PORT="$(docker port "$REST" 3000/tcp | head -1 | sed 's/.*://')"
  local code=""
  for _ in $(seq 1 60); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$REST_PORT/" || true)"
    [[ "$code" == "200" ]] && break
    sleep 1
  done
  [[ "$code" == "200" ]] || { echo "::error::PostgREST nicht bereit (HTTP $code)." >&2; docker logs "$REST" 2>&1 | tail -20 >&2; exit 1; }
}

psql_stdin() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -v ON_ERROR_STOP=1 -q "$@"; }
q() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 2>&1 <<<"$1" || true; }
as_admin() {
  docker exec -i -e PGPASSWORD=postgres -e PGOPTIONS="-c client_min_messages=warning" "$C" \
    psql -h localhost -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -q
}
schema_dump() { docker exec "$C" pg_dump -U postgres --schema-only --schema=public --schema=public_view postgres | grep -vE '^\\(un)?restrict '; }

# Zaehler je Kategorie (bash 3.2: keine assoziativen Arrays).
CATS=(V Z P A T S W X)
DEVS=(0 0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0 0)
cat_index() {
  local i
  for i in "${!CATS[@]}"; do [[ "${CATS[$i]}" == "$1" ]] && { echo "$i"; return 0; }; done
  echo "::error::Unbekannte Kategorie $1" >&2; exit 2
}
check() { # check <Kategorie> <Name> <erwartet> <erhalten>
  local i
  i="$(cat_index "$1")"
  if [[ "$3" == "$4" ]]; then
    OKS[i]=$((OKS[i] + 1)); [[ "${QUIET:-0}" == "1" ]] || echo "OK          [$1] $2"
  else
    DEVS[i]=$((DEVS[i] + 1)); echo "ABWEICHUNG  [$1] $2"; echo "    erwartet: $3"; echo "    erhalten: ${4:0:500}"
  fi
}
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
reset_counts() { DEVS=(0 0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0 0); }

uuid_for() {
  local h
  h="$(printf '%s' "gatherings-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
source "$PARTS/fixtures.sh"

# --- Ablauf eines Laufs ---------------------------------------------------------------------------------------------
# Container bis vor die Migration, Hilfen, Testdaten, Antworten und Schema "vorher" sichern.
prepare() {
  start_db
  echo "Baseline + ${#BEFORE[@]} Migrationen vor $TARGET_NAME einspielen ..." >&2
  psql_stdin < "$BASELINE_FILE" >/dev/null
  local f
  for f in "${BEFORE[@]}"; do psql_stdin < "$f" >/dev/null; done
  setup_helpers
  setup_data
  capture_before
  schema_dump > "$WORK/schema_vorher.sql"
}
# Gegenprobe: nach jeder Mutation zurueck ueber den Rueckweg (stellt Waechter und public_payload woertlich her, entfernt
# alles Neue); die Pruefungen raeumen ihre festgeschriebenen Daten selbst auf.
reset_db() {
  stop_rest
  if q "SELECT to_regclass('public.gatherings') IS NOT NULL;" | grep -qx t; then psql_stdin < "$ROLLBACK_FILE" >/dev/null; fi
}
apply_target() { # apply_target <datei|leer>
  if [[ -n "$1" ]]; then psql_stdin < "$1" >/dev/null; fi
  local f
  for f in ${AFTER[@]+"${AFTER[@]}"}; do psql_stdin < "$f" >/dev/null; done
  start_rest
}
run_checks() {
  local part
  for part in "$PARTS"/[0-9]*.sh; do
    # shellcheck source=/dev/null
    source "$part"
  done
}
summary() {
  local i
  echo ""
  for i in "${!CATS[@]}"; do echo "[${CATS[$i]}] ${OKS[$i]} ok, ${DEVS[$i]} Abweichung(en)"; done
}

prepare
case "$MODE" in
  normal)
    apply_target "$TARGET_FILE"
    WITH_MIGRATION=1 run_checks
    summary
    [[ "$(total_dev)" -eq 0 ]] || { echo "::error::$(total_dev) Abweichung(en)." >&2; exit 1; }
    echo "gatherings-check: alles gruen."
    ;;
  without-migration)
    apply_target ""
    QUIET=1 WITH_MIGRATION=0 run_checks
    summary
    red=0
    for c in V Z P A T; do [[ "${DEVS[$(cat_index "$c")]}" -gt 0 ]] || { echo "::error::Kategorie $c ohne Migration nicht rot." >&2; red=1; }; done
    [[ "$red" -eq 0 ]] || exit 1
    echo "gatherings-check --without-migration: V, Z, P, A und T sind ohne die Migration rot (erwartet)."
    ;;
  gegenprobe)
    failed=0
    LOGS="${GATHERINGS_CHECK_LOGS:-$WORK}"; mkdir -p "$LOGS"
    for id in ${GEGENPROBE_NUR:-$(python3 "$PARTS/mutationen.py" --list)}; do
      reset_db
      reset_counts
      python3 "$PARTS/mutationen.py" "$id" "$TARGET_FILE" > "$WORK/mutant.sql"
      if ! apply_target "$WORK/mutant.sql" >"$WORK/apply.log" 2>&1; then
        echo "::error::Mutation $id laesst sich nicht einspielen: $(tail -3 "$WORK/apply.log")" >&2; failed=1; continue
      fi
      MUTANT_FILE="$WORK/mutant.sql" QUIET=1 WITH_MIGRATION=1 SKIP_X=1 run_checks > "$LOGS/run-$id.log" 2>&1 || true
      if [[ "$(total_dev)" -gt 0 ]]; then
        echo "Mutation $id: rot ($(total_dev) Abweichung(en), z. B. $(grep -m1 '^ABWEICHUNG' "$LOGS/run-$id.log" || echo '?'))"
      else
        echo "::error::Mutation $id bleibt gruen -- keine Pruefung faengt sie." >&2; failed=1
      fi
    done
    [[ "$failed" -eq 0 ]] || exit 1
    echo "gatherings-check --gegenprobe: jede Mutation faerbt mindestens eine Pruefung rot."
    ;;
esac
