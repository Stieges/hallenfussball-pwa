#!/usr/bin/env bash
#
# require-local-stack.sh — Vorbedingung für `npm run test:e2e:cloud` (Task T3, Brief
# Abschnitt 1: "setzt einen laufenden Stack voraus und bricht mit klarer Meldung ab, wenn
# keiner läuft"). Reine Prüfung, startet/ändert nichts.
#
# A-23 (@OB-029, Durchstich nur lokal): verweigert zusätzlich jeden Lauf, dessen Supabase-URL
# nicht lokal ist. Geprüft werden `E2E_SUPABASE_URL` und `VITE_SUPABASE_URL` (falls gesetzt) und
# die API-URL des laufenden Stacks. Lokal heißt: http://127.0.0.1 oder http://localhost, danach
# nur Port und Pfad (kein "http://127.0.0.1.evil.example").
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

LOCAL_URL_PATTERN='^http://(127\.0\.0\.1|localhost)(:[0-9]+)?(/.*)?$'

require_local_url() {
  local label="$1" value="$2"
  if [[ ! "$value" =~ $LOCAL_URL_PATTERN ]]; then
    echo "::error::Produktions-Sperre: ${label} \"${value}\" ist nicht lokal (erlaubt: http://127.0.0.1 oder http://localhost)." >&2
    echo "E2E läuft nur gegen den lokalen Supabase-Stack. Abbruch, nichts wurde gestartet." >&2
    exit 1
  fi
}

# 1. Explizit gesetzte URLs (vor jeder Stack-Abfrage, damit die Sperre ohne Docker greift).
for var in E2E_SUPABASE_URL VITE_SUPABASE_URL; do
  if [ -n "${!var:-}" ]; then
    require_local_url "$var" "${!var}"
  fi
done

# 1b. Läuft jeder Dienst und gibt es keine festgeschriebenen Versionen? (@LT-001, @LT-003, @LT-004)
# Vor der Stack-Abfrage, damit „Docker nicht erreichbar“ als solches gemeldet wird.
# E2E_REQUIRE_LOCAL_STACK_SKIP_HEALTH=1 überspringt das nur für Tests ohne Docker.
if [ "${E2E_REQUIRE_LOCAL_STACK_SKIP_HEALTH:-}" != "1" ]; then
  npx tsx "$SCRIPT_DIR/test-env-check.ts" --gesund
fi

# 2. Läuft ein lokaler Stack?
# Nur für Tests: simulierte `supabase status -o json`-Ausgabe (Unit-Test ohne Docker).
# Produktiv ungesetzt; der Wert ersetzt ausschließlich die Statusausgabe, nichts sonst.
status_json="${E2E_REQUIRE_LOCAL_STACK_STATUS_JSON:-}"
if [ -z "$status_json" ]; then
  if ! status_json="$(supabase status -o json 2>/dev/null)"; then
    echo "::error::Kein laufender lokaler Supabase-Stack gefunden." >&2
    echo "'npm run test:e2e:cloud' braucht einen laufenden Stack mit eingespieltem Schema + Seed." >&2
    echo "Zuerst starten: npm run test:env:up   (oder für einen frischen Stand: npm run test:env:reset)" >&2
    exit 1
  fi
fi

# 3. Ist die API-URL des Stacks lokal?
api_url="$(printf '%s' "$status_json" | sed -n 's/.*"API_URL"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
if [ -z "$api_url" ]; then
  echo "::error::API_URL aus 'supabase status -o json' nicht lesbar." >&2
  exit 1
fi
require_local_url "API_URL des Stacks" "$api_url"
