#!/usr/bin/env bash
#
# prod-smoke.sh -- Rauchtest gegen die Produktion LOKAL starten.
#
# Das Testkonto-Passwort liest dieses Skript aus dem macOS-Schlüsselbund ("Hallenfussball Testkonto Produktion",
# Konto = E-Mail) in eine Prozess-Variable. Es wird weder ausgegeben noch in eine Datei geschrieben.
# Nutzung:  bash scripts/prod-smoke.sh [coadmin-test2@example.org]
# Erlaubt nur bis 15.11.2026 (Freigabe Daniel), nur Testkonto + Wegwerf-Turnier "ZZ-Rauchtest-...".
set -euo pipefail

EMAIL="${1:-coadmin-test2@example.org}"
PASSWORD="$(security find-generic-password -s 'Hallenfussball Testkonto Produktion' -a "$EMAIL" -w)"
export PROD_SMOKE_EMAIL="$EMAIL"
export PROD_SMOKE_PASSWORD="$PASSWORD"
exec npx playwright test -c playwright.prod-smoke.config.ts
