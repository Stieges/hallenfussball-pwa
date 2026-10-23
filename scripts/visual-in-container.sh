#!/usr/bin/env bash
#
# visual-in-container.sh — Bildvergleich-Läufe (Task T5/I1) im offiziellen Playwright-Container,
# OHNE dass `.env.local` (oder irgendeine andere `.env*`-Datei) in den Build gelangen kann.
#
# Nach-Review (final-rereview.md, I-R1): Die vorherigen `test:visual`/`test:visual:update`-
# Einzeiler in package.json haben das ganze Repo per Bind-Mount (`-v "$(pwd):/work"`) in den
# Container gegeben. Die zwei Docker-`-e`-Flags (VITE_SUPABASE_URL=/VITE_SUPABASE_ANON_KEY=)
# überschreiben zwar zuverlässig die Supabase-Werte, aber Vite lädt beim Build ALLE `VITE_*`-
# Variablen aus einer sichtbaren `.env.local` (Vite `loadEnv`, `envDir`-Default = Projektwurzel).
# Beispiele aus `.env.example`: VITE_FF_LIMIT/VITE_FF_ANON_AUTH/VITE_FF_OFFLINE/VITE_FF_MERGE
# würden lokale Vorlagen anders bauen als die CI (die auf einem sauberen Checkout ohne
# `.env.local` läuft), und ein gesetztes VITE_SENTRY_DSN würde sogar einen echten PROD-Sentry-
# Report auslösen (initSentry, src/lib/sentry.ts — die Visual-Fixtures setzen errorTracking:true).
#
# Deshalb hier: `/src` ist NUR lesbar gemountet (`-v "$REPO_ROOT:/src:ro"`). Im Container entsteht
# daraus per `tar`-Kopie (kein Bind-Mount) eine eigene Arbeitskopie unter `/work`, die die
# Exclude-Muster unten kategorisch aus der Kopie herauslässt — `.env*` kann so gar nicht in den
# Build gelangen, unabhängig davon, was auf dem Host liegt oder ob die Docker-`-e`-Flags stimmen.
# Exclude-Muster (Beleg für den Review): '.env*' 'node_modules' 'dist' 'test-results'
# 'playwright-report'. Das Host-`node_modules` wird dabei nie berührt — die Kopie installiert ihre
# eigene Kopie im Dateisystem des Containers, das mit `--rm` verworfen wird; jeder Lauf macht
# deshalb einen vollen `npm ci` (bewusst in Kauf genommen, siehe final-fix-report.md, I1).
#
# Nutzung:
#   scripts/visual-in-container.sh compare   # --update-snapshots=none (Standard-Vergleichslauf)
#   scripts/visual-in-container.sh update    # --update-snapshots=all, schreibt neue Vorlagen
#                                             # zurück nach tests/e2e/visual/__screenshots__
#
# NICHT ausgeführt (Docker-Platte fast voll, final-fix-brief.md: "nichts löschen") — nur per
# `bash -n`/`shellcheck` geprüft. Ein CI-Lauf mit dem Label `visual-update` bleibt bis auf
# Weiteres der praktisch genutzte Weg, neue Vorlagen zu erzeugen.

set -euo pipefail

MODE="${1:-}"
case "$MODE" in
  compare) UPDATE_FLAG="none" ;;
  update) UPDATE_FLAG="all" ;;
  *)
    echo "Nutzung: $0 <compare|update>" >&2
    exit 1
    ;;
esac

# Exakt dieselbe Version wie @playwright/test in package.json — Pin-Check-Schritt dafür in
# .github/workflows/visual.yml. Bei einem Dependabot-Bump von @playwright/test IMMER gemeinsam
# mit visual.yml#container.image UND dieser Zeile anheben (final-review.md, M9).
PLAYWRIGHT_IMAGE="mcr.microsoft.com/playwright:v1.63.0-noble"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAPSHOT_DIR="$REPO_ROOT/tests/e2e/visual/__screenshots__"

# Läuft im Container per `bash -c`. Einfache Anführungszeichen bewusst: $MODE/$UPDATE_FLAG sollen
# hier NICHT von der Host-Shell expandiert werden, sondern erst von der Container-Shell, aus den
# per `docker run -e` gesetzten Umgebungsvariablen (siehe DOCKER_ARGS unten).
# shellcheck disable=SC2016
CONTAINER_SCRIPT='
set -euo pipefail
mkdir -p /work
tar --exclude=".env*" --exclude="node_modules" --exclude="dist" --exclude="test-results" --exclude="playwright-report" -C /src -cf - . | tar -C /work -xf -
cd /work
npm ci
CI=true CI_E2E_USE_PREVIEW=1 VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npm run build
CI=true CI_E2E_USE_PREVIEW=1 npx playwright test --project=visual-mobile --project=visual-tablet --project=visual-desktop --update-snapshots="$UPDATE_FLAG"
if [ "$MODE" = "update" ]; then
  mkdir -p /out
  cp -r /work/tests/e2e/visual/__screenshots__/. /out/
fi
'

DOCKER_ARGS=(--rm -e "MODE=$MODE" -e "UPDATE_FLAG=$UPDATE_FLAG" -v "$REPO_ROOT:/src:ro")
if [ "$MODE" = "update" ]; then
  mkdir -p "$SNAPSHOT_DIR"
  DOCKER_ARGS+=(-v "$SNAPSHOT_DIR:/out")
fi

echo "docker run ${DOCKER_ARGS[*]} $PLAYWRIGHT_IMAGE bash -c '…'" >&2
docker run "${DOCKER_ARGS[@]}" "$PLAYWRIGHT_IMAGE" bash -c "$CONTAINER_SCRIPT"
