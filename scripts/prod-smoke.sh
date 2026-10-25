#!/usr/bin/env bash
#
# prod-smoke.sh -- Rauchtest gegen die Produktion LOKAL starten.
#
# Das Testkonto-Passwort liest dieses Skript aus dem macOS-Schlüsselbund ("Hallenfussball Testkonto Produktion",
# Konto = E-Mail) in eine Prozess-Variable. Es wird weder ausgegeben noch in eine Datei geschrieben.
# Nutzung:  bash scripts/prod-smoke.sh [kurz|voll] [E-Mail]
#   kurz (Vorgabe): nur lesen, öffnet das dauerhafte Turnier "ZZ-Rauchtest-Dauer"
#   voll:           legt ein Wegwerf-Turnier "ZZ-Rauchtest-..." an und spielt es durch (hinterlässt eine Zeile)
# Erlaubt nur bis 15.11.2026 (Freigabe Daniel), nur Testkonto.
set -euo pipefail

if [ "$(date -u +%Y%m%d)" -gt 20261115 ]; then
  echo "Rauchtest gegen Produktion abgelaufen (Freigabe bis 15.11.)" >&2
  exit 1
fi

MODE="${1:-kurz}"
EMAIL="${2:-coadmin-test2@example.org}"
case "$MODE" in kurz|voll) ;; *) echo "Modus: kurz oder voll" >&2; exit 2 ;; esac
PASSWORD="$(security find-generic-password -s 'Hallenfussball Testkonto Produktion' -a "$EMAIL" -w)"
export PROD_SMOKE_MODE="$MODE"
export PROD_SMOKE_EMAIL="$EMAIL"
export PROD_SMOKE_PASSWORD="$PASSWORD"
exec npx playwright test -c playwright.prod-smoke.config.ts
