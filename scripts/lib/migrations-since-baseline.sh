#!/usr/bin/env bash
#
# migrations-since-baseline.sh — EINZIGE Quelle für "welche Migrationsdateien gehören zur
# Baseline-Rekonstruktion, in welcher Reihenfolge". Bisher stand dieselbe Logik (Marker lesen,
# neuere Dateien lexikografisch sortiert sammeln) zweimal im Repo (scripts/db-drift-check.sh und
# implizit als handgepflegte Konstantenliste in scripts/rls-role-matrix.sh) — siehe
# .superpowers/sdd/2026-09-24-testumgebung/task-T1-brief.md: "Die Liste ... darf es nur EINMAL
# geben". Dieses Skript wird von drei Stellen gesourced (nicht ausgeführt):
#   - scripts/db-drift-check.sh (Vergleichs-Container gegen das Live-Schema)
#   - scripts/rls-role-matrix.sh (Wegwerf-Container für die Rechte-Matrix)
#   - scripts/local-db-apply.sh (lokale Testumgebung, Task T1)
#
# Warum die Baseline nicht einfach die Bestandsmigrationen ersetzt: siehe
# supabase/migrations/README.md — drei ältere Dateien scheitern an Policy-Kollisionen, wenn man
# sie nach der Baseline nochmal einspielt (CREATE POLICY ohne vorheriges DROP, kein
# "IF NOT EXISTS" in Postgres). Maßgeblich ist deshalb NUR: Baseline + alles, was NEUER ist als
# ihr Marker "baseline-includes-through" (siehe Kopf der Baseline-Datei).
#
# Nutzung:
#   source ".../scripts/lib/migrations-since-baseline.sh"
#   mapfile -t NEWER < <(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")
#
# Gibt bei Erfolg die Pfade der neueren Migrationsdateien aus, eine pro Zeile, lexikografisch
# (= bei den hier verwendeten YYYYMMDD_NNN-Namen chronologisch) sortiert — Bash-Glob-Expansion
# liefert *.sql bereits in dieser Reihenfolge. Die Baseline-Datei selbst ist NICHT enthalten
# (Aufrufer spielen sie separat zuerst ein). Bei fehlendem Marker: Fehlermeldung auf stderr,
# Exit 1 — kein stillschweigendes "keine neueren Dateien".
#
migrations_newer_than_baseline() {
  local migrations_dir="$1"
  local baseline_file="$2"

  if [[ -z "$migrations_dir" || -z "$baseline_file" ]]; then
    echo "::error::migrations_newer_than_baseline: migrations_dir und baseline_file sind Pflichtargumente." >&2
    return 1
  fi
  if [[ ! -f "$baseline_file" ]]; then
    echo "::error::Baseline-Datei fehlt: $baseline_file" >&2
    return 1
  fi

  local baseline_basename
  baseline_basename="$(basename "$baseline_file")"

  local marker
  marker="$(grep -m1 -- '--   baseline-includes-through:' "$baseline_file" | sed -E 's/^--   baseline-includes-through:[[:space:]]*//')"
  if [[ -z "$marker" ]]; then
    echo "::error::Marker 'baseline-includes-through' fehlt im Kopf von $baseline_basename." >&2
    echo "::error::Ohne ihn kann nicht bestimmt werden, welche Migrationen bereits in der Baseline stecken." >&2
    return 1
  fi

  local f base
  for f in "$migrations_dir"/*.sql; do
    base="$(basename "$f")"
    [[ "$base" == "$baseline_basename" ]] && continue
    if [[ "$base" > "$marker" ]]; then
      echo "$f"
    fi
  done
}
