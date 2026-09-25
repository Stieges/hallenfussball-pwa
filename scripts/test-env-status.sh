#!/usr/bin/env bash
#
# test-env-status.sh — zeigt URL und (öffentliche, lokale Standard-)Anon-Key der Testumgebung.
# Task T1 (test:env:status). Reine Anzeige, ändert nichts.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v jq >/dev/null 2>&1 || { echo "::error::jq wird benötigt." >&2; exit 1; }

STATUS_JSON="$(cd "$REPO_ROOT" && supabase status -o json 2>/dev/null)" || {
  echo "Testumgebung läuft nicht. Starten mit: npm run test:env:up" >&2
  exit 1
}

echo "$STATUS_JSON" | jq -r '
  "API URL:        " + .API_URL,
  "DB URL:          " + .DB_URL,
  "Functions URL:   " + .FUNCTIONS_URL,
  "Studio:          " + .STUDIO_URL,
  "Mailpit:         " + .MAILPIT_URL,
  "Anon-Key (JWT):  " + .ANON_KEY,
  "Publishable-Key: " + .PUBLISHABLE_KEY
'
echo ""
echo "Dies sind öffentlich bekannte lokale Standardwerte (Supabase-CLI-Dokumentation), keine" >&2
echo "Geheimnisse, und existieren ausschließlich im lokalen Docker-Stack." >&2
