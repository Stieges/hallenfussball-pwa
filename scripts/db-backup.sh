#!/usr/bin/env bash
#
# db-backup.sh — Echte Sicherung (Schema + Daten) der Supabase-Produktions-DB.
#
# Warum dieses Skript existiert: Die Baseline-Migration im Repo (00000000000000_baseline_live_schema.sql)
# ist ein SCHEMA-Dump. Ein Schema-Dump enthält keine Zeilen — er sagt nichts darüber aus, ob nach einer
# destruktiven Migration die Daten von 361 Turnieren, 740 Teams und 419 Spielen wiederhergestellt werden
# könnten. Das Free-Plan-Projekt hat KEINE automatischen Backups. Dieses Skript ist die einzige Sicherung,
# die vor einer Datenänderung existiert.
#
# Was es tut:
#   1. Prüft VORHER, ob die Supabase-CLI authentifiziert ist (SUPABASE_ACCESS_TOKEN oder eine
#      bestehende `supabase login`-Sitzung) — bricht mit klarer Meldung ab statt mitten im Dump zu
#      scheitern.
#   2. Dumpt Schema (`--schema public`) und Daten (`--schema public --data-only --use-copy`) je in eine
#      temporäre Datei und fügt beide zu EINER Sicherungsdatei zusammen (Schema zuerst, damit ein
#      Restore in eine leere DB ohne manuelles Umsortieren funktioniert).
#   3. Schreibt die Sicherungsdatei AUSSERHALB des Repositories (Standard: $HOME), mit Zeitstempel im
#      Dateinamen.
#   4. Prüft die Dateigröße. Schwelle: 51200 Byte (50 KiB).
#      Begründung: Schon der reine Schema-Dump dieses Projekts (13 Tabellen, 28 Funktionen,
#      44 RLS-Policies) umfasst laut vorherigem Beleg 2523 Zeilen SQL — das allein liegt bereits deutlich
#      über 50 KiB reinem Text. Ein Dump, der die erwarteten Daten (361 Turniere, 740 Teams, 419 Spiele)
#      tatsächlich enthält, liegt nochmals klar darüber. 50 KiB ist damit hoch genug, um einen leeren
#      oder abgebrochenen Dump (typischerweise wenige hundert Byte Fehlermeldung oder ein Dump mit nur
#      Boilerplate-Statements) sicher durchfallen zu lassen, aber niedrig genug, dass ein korrekter Dump
#      dieser (kleinen) Datenbank nicht fälschlich als Fehlschlag gilt.
#
# Was es NICHT tut: Es ändert nichts an der Live-Datenbank (reiner Lesevorgang über `supabase db dump`).
# Es liest keine Verbindungsdaten aus Dateien im Repo (auch nicht aus .env.local) — die Verbindung wird
# ausschließlich von der Supabase-CLI über ihren eigenen authentifizierten Zustand (Umgebung/Login)
# aufgelöst.
#
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
MIN_BACKUP_BYTES=51200 # 50 KiB — Begründung siehe Kopfkommentar.

print_help() {
  cat <<EOF
Verwendung: ${SCRIPT_NAME} [ZIELVERZEICHNIS]

Erstellt eine vollständige Sicherung (Schema + Daten) der gelinkten Supabase-Produktions-DB
in EINER Datei außerhalb des Repositories.

Argumente:
  ZIELVERZEICHNIS   Verzeichnis für die Sicherungsdatei. Standard: \$HOME (~/).
                     Das Verzeichnis darf NICHT innerhalb dieses Repositories liegen.

Optionen:
  -h, --help        Diese Hilfe anzeigen und beenden.

Voraussetzungen:
  - Supabase-CLI (supabase) installiert und mit dem Projekt verbunden/angemeldet
    (SUPABASE_ACCESS_TOKEN gesetzt ODER eine bestehende 'supabase login'-Sitzung).
  - Docker läuft (die CLI nutzt intern einen Postgres-Container für den Dump).

Beispiel:
  ${SCRIPT_NAME} ~/db-backups
EOF
}

# --- Argumente -----------------------------------------------------------------------------

TARGET_DIR="${HOME}"

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      print_help
      exit 0
      ;;
  esac
done

if [ "$#" -gt 1 ]; then
  echo "Fehler: Zu viele Argumente. Erwartet wird höchstens ein Zielverzeichnis." >&2
  print_help
  exit 1
fi

if [ "$#" -eq 1 ]; then
  TARGET_DIR="$1"
fi

# --- Vorbedingungen -------------------------------------------------------------------------

if ! command -v supabase >/dev/null 2>&1; then
  echo "Fehler: 'supabase'-CLI wurde nicht gefunden. Installation erforderlich (z. B. via Homebrew: brew install supabase/tap/supabase)." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Zielpfad rein textuell auflösen (ohne ihn anzulegen), damit die Repo-Grenzprüfung VOR jeder
# Dateisystem-Änderung greift — sonst würde ein verbotenes Zielverzeichnis bereits angelegt, bevor
# der Fehler gemeldet wird.
TARGET_DIR_PARENT="$(dirname "${TARGET_DIR}")"
mkdir -p "${TARGET_DIR_PARENT}"
TARGET_DIR_PARENT_RESOLVED="$(cd "${TARGET_DIR_PARENT}" && pwd)"
TARGET_DIR_RESOLVED="${TARGET_DIR_PARENT_RESOLVED}/$(basename "${TARGET_DIR}")"

case "${TARGET_DIR_RESOLVED}" in
  "${REPO_ROOT}"|"${REPO_ROOT}"/*)
    echo "Fehler: Zielverzeichnis '${TARGET_DIR_RESOLVED}' liegt innerhalb des Repositories (${REPO_ROOT})." >&2
    echo "Ein Backup im Repo ist kein Backup — es liegt auf derselben Platte und landet womöglich in einem Commit." >&2
    exit 1
    ;;
esac

mkdir -p "${TARGET_DIR_RESOLVED}"

# Authentifizierung VORHER prüfen, statt mitten im Dump zu scheitern. `supabase projects list` ist
# ein reiner Management-API-Lesevorgang (keine DB-Verbindung, ändert nichts) und schlägt fehl, wenn
# weder SUPABASE_ACCESS_TOKEN noch eine bestehende Login-Sitzung vorhanden ist.
echo "Prüfe Supabase-CLI-Authentifizierung..."
if ! AUTH_CHECK_OUTPUT="$(supabase projects list --output json 2>&1)"; then
  echo "Fehler: Die Supabase-CLI ist nicht authentifiziert." >&2
  echo "Weder ist SUPABASE_ACCESS_TOKEN gesetzt, noch besteht eine gültige 'supabase login'-Sitzung." >&2
  echo "Abhilfe: 'export SUPABASE_ACCESS_TOKEN=<token>' setzen oder 'supabase login' ausführen." >&2
  echo "Ausgabe der Prüfung:" >&2
  echo "${AUTH_CHECK_OUTPUT}" >&2
  exit 1
fi
echo "  ok."

# --- Dump erzeugen ---------------------------------------------------------------------------

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${TARGET_DIR_RESOLVED}/hallenfussball-db-backup_${TIMESTAMP}.sql"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

SCHEMA_FILE="${WORK_DIR}/schema.sql"
DATA_FILE="${WORK_DIR}/data.sql"

echo "Dumpe Schema (public)..."
supabase db dump --schema public --linked -f "${SCHEMA_FILE}"

echo "Dumpe Daten (public, COPY-Format)..."
supabase db dump --schema public --data-only --use-copy --linked -f "${DATA_FILE}"

{
  echo "-- Vollständige Sicherung (Schema + Daten) der Hallenfussball-PWA-Produktions-DB"
  echo "-- Erzeugt: $(date -u +%Y-%m-%dT%H:%M:%SZ) UTC via ${SCRIPT_NAME}"
  echo "-- ACHTUNG: Enthält echte Nutzerdaten. Nicht ins Repository committen, nicht teilen."
  echo
  cat "${SCHEMA_FILE}"
  echo
  echo "-- === Daten ==="
  echo
  cat "${DATA_FILE}"
} > "${BACKUP_FILE}"

# --- Größenprüfung ---------------------------------------------------------------------------

BACKUP_BYTES="$(wc -c < "${BACKUP_FILE}" | tr -d ' ')"

if [ "${BACKUP_BYTES}" -lt "${MIN_BACKUP_BYTES}" ]; then
  echo "Fehler: Sicherungsdatei ist nur ${BACKUP_BYTES} Byte groß (Mindestgröße: ${MIN_BACKUP_BYTES} Byte)." >&2
  echo "Ein Dump dieser Größe ist ein Fehlschlag, keine Sicherung. Datei wird NICHT als gültig markiert." >&2
  echo "Fehlerhafte Datei liegt unter: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "Sicherung erfolgreich erstellt: ${BACKUP_FILE}"
echo "Größe: ${BACKUP_BYTES} Byte"
