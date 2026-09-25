#!/usr/bin/env bash
#
# require-local-stack.sh — Vorbedingung für `npm run test:e2e:cloud` (Task T3, Brief
# Abschnitt 1: "setzt einen laufenden Stack voraus und bricht mit klarer Meldung ab, wenn
# keiner läuft"). Reine Prüfung, startet/ändert nichts.
#
set -euo pipefail

if ! supabase status -o json >/dev/null 2>&1; then
  echo "::error::Kein laufender lokaler Supabase-Stack gefunden." >&2
  echo "'npm run test:e2e:cloud' braucht einen laufenden Stack mit eingespieltem Schema + Seed." >&2
  echo "Zuerst starten: npm run test:env:up   (oder für einen frischen Stand: npm run test:env:reset)" >&2
  exit 1
fi
