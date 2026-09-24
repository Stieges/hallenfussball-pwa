#!/usr/bin/env bash
#
# local-db-apply.sh — Spielt Baseline + neuere Migrationen (dieselbe Liste wie
# scripts/db-drift-check.sh und scripts/rls-role-matrix.sh, siehe
# scripts/lib/migrations-since-baseline.sh) in die LOKALE Supabase-Testumgebung ein.
#
# Warum es das gibt (Task T1, .superpowers/sdd/2026-09-24-testumgebung/task-T1-brief.md):
# `supabase start`/`db reset` würden mit automatischem Migrations-Einspielen ALLE Dateien in
# supabase/migrations/ der Reihe nach anwenden und an drei bekannten Policy-Kollisionen scheitern
# (siehe supabase/migrations/README.md). Deshalb ist [db.migrations] enabled = false in
# supabase/config.toml gesetzt (empirisch geprüft: die deklarative Alternative `schema_paths`
# greift laut CLI-Dokumentation nur im experimentellen, versionslosen Reset-Pfad — für
# Datei-für-Datei-Replay mit fester Reihenfolge nicht das passendere Werkzeug, siehe Kommentar in
# config.toml) — dieses Skript übernimmt das Einspielen danach selbst, per `docker exec ... psql`
# direkt in den lokalen DB-Container, genau wie es scripts/rls-role-matrix.sh und
# scripts/db-drift-check.sh bereits für ihre Wegwerf-/Vergleichs-Container tun.
#
# Voraussetzung: Der lokale Stack läuft bereits (`supabase start`). Dieses Skript startet ihn
# NICHT selbst — das ist Aufgabe von `npm run test:env:up`/`test:env:reset`.
#
# Ändert NICHTS an der Produktion: Es verbindet sich ausschließlich mit dem lokalen Docker-
# Container des Projekts (Name über `supabase status -o json` ermittelt, kein fest verdrahteter
# Connection-String zu irgendeiner Cloud-Adresse).
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"

command -v jq >/dev/null 2>&1 || { echo "::error::jq wird benötigt." >&2; exit 1; }
[[ -f "$BASELINE_FILE" ]] || { echo "::error::Baseline fehlt: $BASELINE_FILE" >&2; exit 1; }

# --- 1. Laufenden lokalen Stack finden (kein fest verdrahteter Container-Name/Port) ---------
STATUS_JSON="$(cd "$REPO_ROOT" && supabase status -o json 2>/dev/null)" || {
  echo "::error::'supabase status' schlug fehl — läuft der lokale Stack? ('npm run test:env:up' zuerst)." >&2
  exit 1
}
DB_URL="$(echo "$STATUS_JSON" | jq -r '.DB_URL // empty')"
if [[ -z "$DB_URL" ]]; then
  echo "::error::Konnte DB_URL nicht aus 'supabase status -o json' lesen." >&2
  exit 1
fi

# Nur lokale Ziele erlauben — auch hier, nicht nur im Seed-Skript (T2): ein Tippfehler in der
# CLI-Verlinkung darf niemals dazu führen, dass dieses Skript gegen eine fremde Datenbank läuft.
case "$DB_URL" in
  *127.0.0.1*|*localhost*) ;;
  *)
    echo "::error::DB_URL zeigt nicht auf localhost/127.0.0.1 — Abbruch: $DB_URL" >&2
    exit 1
    ;;
esac

CONTAINER_NAME="$(docker ps --filter "label=com.supabase.cli.project=$(basename "$REPO_ROOT")" \
  --filter "name=supabase_db_" --format '{{.Names}}' | head -n1)"
if [[ -z "$CONTAINER_NAME" ]]; then
  # Fallback: Projekt-ID aus config.toml statt Verzeichnisname (können abweichen).
  PROJECT_ID="$(grep -m1 '^project_id' "$REPO_ROOT/supabase/config.toml" | sed -E 's/project_id[[:space:]]*=[[:space:]]*"([^"]+)"/\1/')"
  CONTAINER_NAME="$(docker ps --filter "name=supabase_db_${PROJECT_ID}" --format '{{.Names}}' | head -n1)"
fi
if [[ -z "$CONTAINER_NAME" ]]; then
  echo "::error::Kein laufender supabase_db_*-Container gefunden. Läuft 'supabase start'?" >&2
  exit 1
fi

psql_stdin() {
  docker exec -i "$CONTAINER_NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"
}

psql_scalar() {
  docker exec -i "$CONTAINER_NAME" psql -U postgres -v ON_ERROR_STOP=1 -qtA -c "$1"
}

# --- 1b. Idempotenz (Task T3, Vorspann): "test:env:up" nach einem bereits laufenden Stack -----
# `supabase start` ist selbst idempotent (No-Op, wenn der Stack schon läuft und dabei sein
# eingespieltes Schema aus dem Docker-Volume behält) — ohne diese Prüfung würde dieses Skript
# danach versuchen, die Baseline ein zweites Mal auf ein bereits vollständiges Schema
# einzuspielen und an Policy-/PK-Kollisionen scheitern ("multiple primary keys for table
# match_corrections"). Erkennungsmerkmal: existiert public.tournaments schon (eine Tabelle aus
# der Baseline, kein Migrations-Artefakt), ist das Schema vollständig eingespielt — dann NICHT
# erneut einspielen, nur Status melden. `supabase db reset --local` (test:env:reset) räumt die
# DB vorher leer, dort greift dieser Zweig nicht.
SCHEMA_EXISTS="$(psql_scalar "SELECT to_regclass('public.tournaments') IS NOT NULL;" 2>/dev/null || echo f)"
if [[ "$SCHEMA_EXISTS" == "t" ]]; then
  echo "Schema bereits vorhanden (public.tournaments existiert) — Einspielen übersprungen." >&2
  echo "Für ein sauberes Neu-Einspielen: npm run test:env:reset" >&2
  exit 0
fi

# --- 2. Baseline + neuere Migrationen einspielen, in dieser Reihenfolge ---------------------
echo "Container: $CONTAINER_NAME" >&2
echo "Baseline einspielen: $(basename "$BASELINE_FILE")" >&2
psql_stdin < "$BASELINE_FILE"

NEWER_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
if [[ -n "$NEWER_RAW" ]]; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    echo "Migration einspielen: $(basename "$f")" >&2
    psql_stdin < "$f"
  done <<< "$NEWER_RAW"
else
  echo "Keine neueren Migrationsdateien nachzuspielen." >&2
fi

echo "Fertig: Baseline + neuere Migrationen eingespielt." >&2
