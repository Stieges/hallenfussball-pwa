#!/usr/bin/env bash
#
# gathering-screens-check.sh — Container-Beweis fuer supabase/migrations/20261122_001_gathering_screens.sql (A1b Monitore der
# Veranstaltung, Record docs/anforderungen/2026-11-06_veranstaltung-mehrere-turniere.md, Funktionalitaet G). Muster und
# Hilfen wie scripts/gatherings-check.sh (Wegwerf-Container supabase/postgres, Baseline + Migrationen seit Baseline,
# Wegwerf-PostgREST im eigenen Netz, trap); Identitaeten und Grunddaten aus scripts/gatherings-check.d/fixtures.sh, dazu
# scripts/gathering-screens-check.d/fixtures.sh. Die Pruefungen stehen in scripts/gathering-screens-check.d/[0-9]*.sh.
#
# Testwerte aus dem Gherkin (G): Olli (Eigentuemer), Maria (Co-Admin in „F2-Junioren“), Tom (Helfer-Geraet), Bildschirm
# (Rolle screen), Clara (Konto ohne Rolle), Greta (eigenes Konto), Anja (anonyme Sitzung), Lena/Mama Petra = anon.
# Veranstaltung „Nikolausturnier“ in der Bergader SportARENA, Bildschirm „Halle“.
#
# Kategorien:
#   B  Bildschirme einrichten: anlegen, aendern, Schluessel erneuern, loeschen, uebernehmen, Ort (@VA-034, @VA-036 Z. 6,
#      @VA-041, @VA-042 Herkunft)
#   U  Umschalten, Rechte, Status, Uebersicht, Waechter (@VA-035 bis @VA-041)
#   R  Wettlauf: Umschalten gegen eine noch offene Aenderung am Turnier (zwei Sitzungen; @VA-036, @VA-037, @VA-041)
#   D  Bildschirm-Abfrage ueber die echte Server-Antwort (PostgREST): Zustaende, Positivliste, Delta, Version ueber Wechsel
#      (@VA-034 bis @VA-036, @VA-043, @VA-044, @ZM-180)
#   O  Zuschauer: on_screen in public_gathering (@VA-045 bis @VA-047)
#   T  unveraendert: Turnier- und Monitor-Antwort Byte fuer Byte wie vor der Migration (public_payload, display_tournament;
#      @VA-042 Server-Teil bewusst nicht)
#   V Z P A  Rueckfall-Pruefung: die Pruefungen von A1 (scripts/gatherings-check.d/10, 20, 25) gegen den Stand MIT dieser
#      Migration (public_gathering ist ersetzt)
#   S  Schema/Rechte   W  zweites Einspielen   X  Rueckweg -> Schema = vorher; Fail-fast bei fremder Fassung
#
# Aufrufoptionen:
#   bash scripts/gathering-screens-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/gathering-screens-check.sh --without-migration  Gegenprobe: ohne die Migration muessen B, U, D, O ROT sein
#   bash scripts/gathering-screens-check.sh --gegenprobe         je Mutation (gathering-screens-check.d/mutationen.py) ein
#                                                                Lauf; Exit 0 NUR, wenn JEDE Mutation eine Pruefung aus
#                                                                B, U, R, D, O, T oder S rot faerbt (ohne W, X und A1-Rueckfall)
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigene Wegwerf-Container und ein
# eigenes Wegwerf-Netz, am Ende entfernt (trap). Lokal ueber die Sperre (testlauf2.sh) starten.
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
PARTS="$REPO_ROOT/scripts/gathering-screens-check.d"
A1_PARTS="$REPO_ROOT/scripts/gatherings-check.d"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261122_001_gathering_screens.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
ROLLBACK_FILE="$REPO_ROOT/supabase/rollbacks/20261122_001_gathering_screens_rollback.sql"
PREFIX="gathering-screens-check-$$"
NET="$PREFIX-net"
C="$PREFIX-db"
REST=""
REST_PORT=""
WORK="$(mktemp -d "${TMPDIR:-/tmp}/gathering-screens-check.XXXXXX")"
JWT_SECRET="gathering-screens-check-secret-0123456789abcd"

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
# Spaetere Migrationen, die public_view.* aendern (der Sicherheitskern bleibt in DIESEM Harness "unveraendert", Schema "vorher" =
# nach dem Rueckweg), laufen in ihrem eigenen Harness und bleiben hier ausser Betracht; ihre Rechte-Assertion zaehlt nicht mit
# (Namen aus der festen Zuordnung in db-drift-check.sh, wie gatherings-check.sh).
#   20261124_001_zeitstrafe_endet_bei_gegentor.sql (public_view.match_events) -> scripts/public-payload-check.sh
# Ebenso spaetere Migrationen mit eigenem Harness, die das Schema aendern (sonst stuenden sie nach dem Rueckweg als Unterschied
# zu "vorher" da, Pruefung X):
#   20261123_001_hallenton_torhymne.sql (hall_sound_settings.goal_anthem_paths, hall_goal_anthems_set) -> scripts/hallenton-check.sh
OWN_HARNESS_LATER=" 20261123_001_hallenton_torhymne.sql 20261124_001_zeitstrafe_endet_bei_gegentor.sql "
KEPT=()
for f in ${AFTER[@]+"${AFTER[@]}"}; do [[ "$OWN_HARNESS_LATER" == *" $(basename "$f") "* ]] || KEPT+=("$f"); done
AFTER=(${KEPT[@]+"${KEPT[@]}"})

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
CATS=(B U R D O T V Z P A S W X)
DEVS=(0 0 0 0 0 0 0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0 0 0 0 0 0 0)
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
reset_counts() { DEVS=(0 0 0 0 0 0 0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0 0 0 0 0 0 0); }

uuid_for() {
  local h
  h="$(printf '%s' "gatherings-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
source "$A1_PARTS/fixtures.sh"
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
  setup_screens_data
  capture_before
  capture_before_screens
  schema_dump > "$WORK/schema_vorher.sql"
}
# Gegenprobe: nach jeder Mutation zurueck ueber den Rueckweg (stellt Waechter und public_payload woertlich her, entfernt
# alles Neue); die Pruefungen raeumen ihre festgeschriebenen Daten selbst auf.
reset_db() {
  stop_rest
  if q "SELECT to_regclass('public.gathering_screens') IS NOT NULL;" | grep -qx t; then
    # Eine Mutation kann public_gathering veraendert haben; der Rueckweg prueft genau die Fassung dieser Migration.
    python3 "$PARTS/mutationen.py" --public-gathering "$TARGET_FILE" | psql_stdin >/dev/null
    psql_stdin < "$ROLLBACK_FILE" >/dev/null
  fi
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
  # Rueckfall-Pruefung A1 (nicht in der Gegenprobe: sie prueft A1-Regeln, nicht diese Migration).
  if [[ "${SKIP_A1:-0}" -ne 1 ]]; then
    for part in "$A1_PARTS"/10-verwaltung.sh "$A1_PARTS"/20-oeffentlich.sh "$A1_PARTS"/25-version.sh; do
      # shellcheck source=/dev/null
      source "$part"
    done
  fi
  # shellcheck source=/dev/null
  source "$PARTS/schema.sh"
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
    echo "gathering-screens-check: alles gruen."
    ;;
  without-migration)
    apply_target ""
    QUIET=1 WITH_MIGRATION=0 SKIP_A1=1 run_checks
    summary
    red=0
    for c in B U D O; do [[ "${DEVS[$(cat_index "$c")]}" -gt 0 ]] || { echo "::error::Kategorie $c ohne Migration nicht rot." >&2; red=1; }; done
    [[ "$red" -eq 0 ]] || exit 1
    echo "gathering-screens-check --without-migration: B, U, D und O sind ohne die Migration rot (erwartet)."
    ;;
  gegenprobe)
    failed=0
    LOGS="${GATHERING_SCREENS_CHECK_LOGS:-$WORK}"; mkdir -p "$LOGS"
    for id in ${GEGENPROBE_NUR:-$(python3 "$PARTS/mutationen.py" --list)}; do
      reset_db
      reset_counts
      python3 "$PARTS/mutationen.py" "$id" "$TARGET_FILE" > "$WORK/mutant.sql"
      if ! apply_target "$WORK/mutant.sql" >"$WORK/apply.log" 2>&1; then
        echo "::error::Mutation $id laesst sich nicht einspielen: $(tail -3 "$WORK/apply.log")" >&2; failed=1; continue
      fi
      MUTANT_FILE="$WORK/mutant.sql" QUIET=1 WITH_MIGRATION=1 SKIP_X=1 SKIP_W=1 SKIP_A1=1 run_checks > "$LOGS/run-$id.log" 2>&1 || true
      if [[ "$(total_dev)" -gt 0 ]]; then
        echo "Mutation $id: rot ($(total_dev) Abweichung(en), z. B. $(grep -m1 '^ABWEICHUNG' "$LOGS/run-$id.log" || echo '?'))"
      else
        echo "::error::Mutation $id bleibt gruen -- keine Pruefung faengt sie." >&2; failed=1
      fi
    done
    [[ "$failed" -eq 0 ]] || exit 1
    echo "gathering-screens-check --gegenprobe: jede Mutation faerbt mindestens eine Pruefung rot."
    ;;
esac
