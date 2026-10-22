#!/usr/bin/env bash
#
# realtime-publication-check.sh — Container-Beweis fuer die Migration
# supabase/migrations/20261110_010_realtime_publication_baseline.sql (Befund C-PUB,
# docs/anforderungen/BEFUNDE-HEUTIGER-CODE.md).
#
# Wegwerf-Container mit supabase/postgres:17.6.1.063 (Live-Postgres-Version), Baseline eingespielt.
# Gemessen wird die Publikation supabase_realtime, die vier Tabellen match_events, matches, teams,
# monitor_heartbeats (public):
#   (a) Publikation hat alle vier Tabellen -> Migration aendert nichts (Vorher = Nachher).
#   (b) Publikation leer                   -> danach genau die vier Tabellen.
#   (c) Migration zweimal angewendet       -> idempotent (zweiter Lauf aendert nichts).
#   (d) Keine Publikation                  -> Migration laeuft ohne Fehler durch, legt keine an.
#   --gegenprobe: Ohne Migration schlaegt (b) fehl (Publikation bleibt leer).
#
# Aendert NICHTS an Produktion und startet/stoppt keinen lokalen Supabase-Stack. Der Container
# heisst kb6-check-$$, wird per trap entfernt; fremde Container werden nicht angefasst.
# Kein Port-Mapping, damit kein Konflikt mit einem laufenden lokalen Stack entsteht.
#
set -euo pipefail

POSTGRES_IMAGE="supabase/postgres:17.6.1.063"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$REPO_ROOT/supabase/migrations/20261110_010_realtime_publication_baseline.sql"
BASELINE="$REPO_ROOT/supabase/migrations/00000000000000_baseline_live_schema.sql"
CONTAINER_NAME="kb6-check-$$"
EXPECTED="$(printf '%s\n' public.match_events public.matches public.monitor_heartbeats public.teams | LC_ALL=C sort)"
FAILED=0

GEGENPROBE=0
if [[ "${1:-}" == "--gegenprobe" ]]; then
  GEGENPROBE=1
fi

cleanup() { docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql_q() { docker exec "$CONTAINER_NAME" psql -U postgres -v ON_ERROR_STOP=1 -tA -c "$1"; }
psql_stdin() { docker exec -i "$CONTAINER_NAME" psql -U postgres -v ON_ERROR_STOP=1 -q; }
psql_file() { docker exec -i "$CONTAINER_NAME" psql -U postgres -v ON_ERROR_STOP=1 -q < "$1"; }

# Aktuelle Mitglieder von supabase_realtime, sortiert (C-Locale), eine Zeile je Tabelle.
pub_tables() {
  psql_q "SELECT schemaname || '.' || tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY 1" \
    | LC_ALL=C sort
}

pub_present() {
  psql_q "SELECT count(*) FROM pg_publication WHERE pubname = 'supabase_realtime'"
}

# Setzt den Vorzustand: empty = Publikation ohne Tabellen, four = genau die vier, none = keine Publikation.
set_publication() {
  echo "DROP PUBLICATION IF EXISTS supabase_realtime;" | psql_stdin
  case "$1" in
    empty) echo "CREATE PUBLICATION supabase_realtime;" | psql_stdin ;;
    four)  echo "CREATE PUBLICATION supabase_realtime FOR TABLE public.match_events, public.matches, public.teams, public.monitor_heartbeats;" | psql_stdin ;;
    none)  : ;;
  esac
}

report() {
  # $1 = Name, $2 = ok|fail, $3 = Detail
  if [[ "$2" == ok ]]; then
    echo "PASS $1 — $3"
  else
    echo "FAIL $1 — $3"
    FAILED=1
  fi
}

echo "Starte Wegwerf-Container $CONTAINER_NAME (Image $POSTGRES_IMAGE)..."
docker run -d --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null

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
  echo "::error::Container nach 90s nicht vollstaendig bereit." >&2
  docker logs "$CONTAINER_NAME" 2>&1 | tail -30 >&2
  exit 1
fi
for _ in $(seq 1 30); do
  docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

echo "Baseline einspielen: $(basename "$BASELINE")"
psql_file "$BASELINE"

if [[ "$GEGENPROBE" -eq 1 ]]; then
  echo "--- Gegenprobe: (b) ohne Migration ---"
  set_publication empty
  G_AFTER="$(pub_tables)"
  if [[ "$G_AFTER" == "$EXPECTED" ]]; then
    echo "GEGENPROBE FEHLGESCHLAGEN: (b) ist ohne Migration bereits erfuellt; Test taugt nicht."
    exit 1
  fi
  echo "GEGENPROBE OK: (b) schlaegt ohne Migration fehl. Ist: [$(echo "$G_AFTER" | tr '\n' ' ')] (leer)."
  exit 0
fi

echo "Migration: $(basename "$MIGRATION")"

# (a) Alle vier vorhanden -> keine Aenderung
set_publication four
A_BEFORE="$(pub_tables)"
if psql_file "$MIGRATION"; then A_RC=0; else A_RC=1; fi
A_AFTER="$(pub_tables)"
if [[ "$A_RC" -eq 0 && "$A_BEFORE" == "$EXPECTED" && "$A_AFTER" == "$A_BEFORE" ]]; then
  report "(a) alle vier vorhanden: Migration aendert nichts" ok "vorher = nachher = vier Tabellen"
else
  report "(a) alle vier vorhanden: Migration aendert nichts" fail "rc=$A_RC vorher=[$(echo "$A_BEFORE" | tr '\n' ' ')] nachher=[$(echo "$A_AFTER" | tr '\n' ' ')]"
fi

# (b) Publikation leer -> genau die vier
set_publication empty
B_BEFORE="$(pub_tables)"
if psql_file "$MIGRATION"; then B_RC=0; else B_RC=1; fi
B_AFTER="$(pub_tables)"
if [[ "$B_RC" -eq 0 && -z "$B_BEFORE" && "$B_AFTER" == "$EXPECTED" ]]; then
  report "(b) Publikation leer: danach genau die vier" ok "vorher leer, nachher vier Tabellen"
else
  report "(b) Publikation leer: danach genau die vier" fail "rc=$B_RC vorher=[$(echo "$B_BEFORE" | tr '\n' ' ')] nachher=[$(echo "$B_AFTER" | tr '\n' ' ')]"
fi

# (c) zweimal anwenden -> idempotent
C_BEFORE="$(pub_tables)"
if psql_file "$MIGRATION"; then C_RC=0; else C_RC=1; fi
C_AFTER="$(pub_tables)"
if [[ "$C_RC" -eq 0 && "$C_BEFORE" == "$EXPECTED" && "$C_AFTER" == "$C_BEFORE" ]]; then
  report "(c) zweimal angewendet: idempotent" ok "zweiter Lauf aendert nichts"
else
  report "(c) zweimal angewendet: idempotent" fail "rc=$C_RC vorher=[$(echo "$C_BEFORE" | tr '\n' ' ')] nachher=[$(echo "$C_AFTER" | tr '\n' ' ')]"
fi

# (d) keine Publikation -> kein Fehler, keine Publikation entsteht
set_publication none
D_PRESENT_BEFORE="$(pub_present)"
if psql_file "$MIGRATION"; then D_RC=0; else D_RC=1; fi
D_PRESENT_AFTER="$(pub_present)"
if [[ "$D_RC" -eq 0 && "$D_PRESENT_BEFORE" == 0 && "$D_PRESENT_AFTER" == 0 ]]; then
  report "(d) ohne Publikation: kein Fehler" ok "rc=0, Publikation weiterhin nicht vorhanden"
else
  report "(d) ohne Publikation: kein Fehler" fail "rc=$D_RC vorher=$D_PRESENT_BEFORE nachher=$D_PRESENT_AFTER"
fi

if [[ "$FAILED" -eq 0 ]]; then
  echo "ERGEBNIS: alle Proben (a)-(d) bestanden"
else
  echo "ERGEBNIS: mindestens eine Probe fehlgeschlagen"
fi
exit "$FAILED"
