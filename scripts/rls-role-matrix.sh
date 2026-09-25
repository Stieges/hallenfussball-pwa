#!/usr/bin/env bash
#
# rls-role-matrix.sh — Misst die Schreibrechte-Matrix aus rolePermissions.json gegen eine echte
# Postgres-Instanz mit aktivem RLS. Dauerhafte Absicherung für die Rollentabelle aus
# .superpowers/sdd/2026-09-22-rechte-und-cockpit-2/task-R1-brief.md (seit R5b:
# task-R5b-brief.md) — kein Wegwerf-Skript.
#
# Was gemessen wird (nicht behauptet): Für jede der sieben Test-Identitäten (owner,
# owner-anonymous, co-admin, collaborator, trainer, viewer, non-member — fest im Skript verankert,
# siehe MATRIX_IDS unten, KEIN Teil der JSON: das sind Testfixturen, keine Rechte) wird ein echter
# auth.users-Eintrag angelegt, ggf. eine
# tournament_collaborators-Zeile mit passender Rolle — und dann unter
# `SET LOCAL ROLE authenticated` (bzw. `anon`) mit passendem `request.jwt.claim.sub` jeder
# Schreibzugriff versucht: matches UPDATE, match_events INSERT/UPDATE/DELETE,
# tournaments UPDATE. Beide Richtungen zählen: was erlaubt sein soll, muss gelingen (der
# psql-Befehls-Tag meldet "UPDATE 1" / "INSERT 0 1" / "DELETE 1"); was verboten sein soll, muss
# scheitern (0 Zeilen durch die USING-Klausel — Tag "UPDATE 0" / "DELETE 0", kein Fehler — oder
# ein RLS-Fehler durch die WITH-CHECK-Klausel — beides zählt als "verweigert"). Bewusst KEIN
# RETURNING (Begründung bei run_write() weiter unten).
#
# Fixrunde 1: 20260922_001 ändert inzwischen auch EINE Lese-Policy (match_events_select_v3 —
# fehlender Mitarbeiter-Zweig, siehe Kopfkommentar der Migration) und 20260922_002 repariert
# einen unabhängigen Trigger-Bug (increment_match_event_version referenziert eine nicht
# existierende match_events.updated_at-Spalte, jedes UPDATE auf match_events scheiterte
# dadurch, auch für den Eigentümer). Dieses Skript prüft stichprobenartig, dass anonymes Lesen
# (kein JWT, Postgres-Rolle `anon`) eines öffentlichen Turniers (inkl. seiner match_events)
# weiter funktioniert — das wurde für Monitore/Public View kürzlich mühsam repariert
# (PRs #185/#186), und eine Policy-Migration ist die naheliegendste Stelle, es versehentlich
# wieder kaputtzumachen. Zusätzlich testet es explizit "Eigentümer bearbeitet/löscht ein
# Ereignis" als eigene, vom Rollen-Loop unabhängige Zeilen — das ist genau der Fall, den der
# kaputte Trigger vorher rot gefärbt hätte, und eine künftige Regression darauf muss sichtbar
# bleiben (der Trigger wird deshalb NICHT mehr deaktiviert, anders als in der ersten Fassung
# dieses Skripts).
#
# Fixrunde 2: Abschluss-Review von R1 fand zwei kritische Lücken — eine davon (K1) hatte
# 20260922_001 selbst geöffnet. 20260922_003 härtet: protect_owner_id() (BEFORE UPDATE auf
# jeder Tabelle mit owner_id-Spalte — hält den alten Wert fest, wenn eine App-Rolle
# owner_id per UPDATE ändern will) und protect_collaborator_row() (BEFORE UPDATE auf
# tournament_collaborators — Nicht-Eigentümer dürfen ausschließlich ihre eigene, offene
# Einladung annehmen, sonst Ablehnung). Details, Ursache und der Beleg für beide Lücken im
# Kopfkommentar der Migration und im Report, Abschnitt "Fixrunde 2".
#
# Fixrunde 3: Abschluss-Review von R2 fand K3 (LIVE, kritisch) — 003 prüfte in
# protect_collaborator_row nur OLD.tournament_id, nie NEW, ein Eigentümer konnte seine eigene
# Mitarbeiterzeile deshalb auf ein fremdes Turnier umhängen und sich so zum Co-Admin machen,
# ganz ohne Einladung. Dazu H5 (älter als der Branch): dieselbe Klasse Lücke bei
# matches/teams/match_events/tournament_id bzw. match_id. 20260923_001 schließt beide über
# einen Parent-Schlüssel-Schutz (protect_collaborator_row erweitert, protect_parent_keys()
# neu) plus zwei Präzisierungen (L5: use_count/accepted_at im Annahme-Zweig). Details im
# Kopfkommentar der Migration und im Report, Abschnitt "Fixrunde 3".
#
# L4: Der Default-Modus dieses Skripts endet jetzt mit Exit 1, wenn MISMATCHES > 0 ist (siehe
# Skriptende) — vorher endete es immer mit Exit 0 ("misst, urteilt nicht"), das reichte als
# CI-Gate nicht. Die Gegenprobe-Modi bleiben bei Exit 0, sie sollen Abweichungen zeigen dürfen.
#
# R6 (task-R6-brief.md, F3/F7): 20260924_001_restrict_profiles.sql schützt "public"."profiles" —
# Spalten-GRANTs statt der bisherigen ALL-Rechte für anon/authenticated, plus die SECURITY-
# DEFINER-Funktion auth_provider_for_email(). Die Baseline enthält KEINE GRANT-Anweisungen
# (siehe supabase/migrations/README.md — als Plattform-Boilerplate entfernt). Empirisch im
# Wegwerf-Container geprüft: das Postgres-Init-Verhalten dieses Images vergibt trotzdem beim
# CREATE TABLE automatisch ALL an anon/authenticated (ALTER DEFAULT PRIVILEGES, vom Image selbst
# gesetzt, nicht von der Baseline-Datei) — der "vorher"-Zustand (volles Tabellen-GRANT ALL) ist
# im Container also bereits der Ausgangszustand, ohne dass dieses Skript ihn erst herstellen
# müsste. Das ausdrückliche `GRANT ALL ON public.profiles TO anon, authenticated;` unten bleibt
# trotzdem stehen (schadet nicht, macht die Annahme explizit, statt sich auf Image-Verhalten zu
# verlassen, das sich ändern könnte).
#
# Zweiter Fund beim Bau dieses Abschnitts: der Trigger "on_auth_user_created" (AFTER INSERT ON
# auth.users, ruft public.handle_new_user() — ursprünglich 20260111_auth_hardening.sql) fehlt in
# JEDEM aus der Baseline rekonstruierten Container, mit oder ohne R6. Grund: Die Baseline wurde
# mit `pg_dump --schema public` erzeugt (siehe README.md) — ein Trigger AUF auth.users (Schema
# "auth", nicht "public") landet in so einem Dump nicht, selbst wenn die aufgerufene Funktion
# (im Schema "public") sehr wohl enthalten ist. Auf der echten Live-Instanz existiert dieser
# Trigger (er wurde nie über eine spätere Migration entfernt); dieses Skript bildet ihn deshalb
# hier NUR als Testaufbau nach, exakt wie er zuletzt definiert wurde — analog zum bereits
# bestehenden Nachbau von repro_security_definer_owner_transfer() weiter unten für ein
# vergleichbares Cross-Schema-Problem. Kein Teil irgendeiner committeten Migration.
#
# R5 (task-R5-brief.md, historisch): 20260924_002_coadmin_complete.sql schloss vier DB-Befunde
# (H4/M3/M4/M5). R5b (task-R5b-brief.md, AKTUELL) hat diese Datei umbenannt und komplett neu
# geschrieben -- 20260924_002_central_role_permissions.sql. Die vier R5-Befunde bleiben inhaltlich
# erhalten (Co-Admin-Upsert gelingt, Teams-Rollenfilter, Kaskade folgt Co-Admin-Publish, deleted_at
# nur Eigentümer), sind jetzt aber über EINE zentrale Tabelle (public.role_permissions) und EINE
# Funktion (public.has_tournament_permission) ausgedrückt statt über neun einzeln geschriebene
# EXISTS-Klauseln. Dazu R5-H1 (Auflage aus dem R5-Review): teams_delete_v2/matches_delete_v2
# bekommen jetzt ebenfalls einen Mitarbeiter-Zweig ('restructure', nur co-admin) -- vorher durfte
# NUR der Eigentümer löschen, ein Co-Admin traf beim Entfernen von Teams/Spielen still 0 Zeilen.
# Orthogonal zu R6 (profiles) -- läuft unabhängig von WITH_R6.
#
# Nutzung:
#   scripts/rls-role-matrix.sh                    # Baseline + alle sieben Migrationen ("nachher")
#   scripts/rls-role-matrix.sh --baseline-only     # nur Baseline ("vorher", R1-Gegenprobe) —
#                                                   # Abweichungen von der Rollentabelle sind
#                                                   # hier ERWARTET (siehe Report) und führen
#                                                   # NICHT zu einem Fehlschlag dieses Skripts —
#                                                   # es misst, es urteilt nicht.
#   scripts/rls-role-matrix.sh --without-hardening # Baseline + 001 + 002, OHNE 003 (und damit
#                                                   # ohne 004, das auf 003 aufbaut) — die
#                                                   # K1/K2-Angriffszeilen müssen hier GELINGEN,
#                                                   # sonst misst der Harness sie nicht.
#   scripts/rls-role-matrix.sh --without-004       # Baseline + 001 + 002 + 003, OHNE 004
#                                                   # ("vorher", Fixrunde-3-Gegenprobe) — die
#                                                   # K3/H5/L5-Angriffszeilen müssen hier
#                                                   # GELINGEN, sonst misst der Harness sie nicht.
#   scripts/rls-role-matrix.sh --without-r6        # Alles bis 20260923_002, OHNE
#                                                   # 20260924_001 (R6) — die Profile-Zeilen
#                                                   # müssen hier den "vorher"-Zustand zeigen
#                                                   # (E-Mail lesbar, Rolle selbst änderbar, RPC
#                                                   # fehlt), sonst misst der Harness die R6-Lücke
#                                                   # nicht.
#   scripts/rls-role-matrix.sh --without-r5        # Alles bis 20260924_001, OHNE 20260924_002
#                                                   # (R5b: central_role_permissions) — die
#                                                   # R5b-Zeilen müssen hier den "vorher"-Zustand
#                                                   # zeigen (Co-Admin-Upsert auf teams/matches
#                                                   # scheitert, viewer/trainer dürfen Teams
#                                                   # ändern, sponsors/monitors bleiben nach
#                                                   # Co-Admin-Publish unsichtbar, Co-Admin darf
#                                                   # deleted_at setzen, Co-Admin-DELETE auf
#                                                   # Teams/Spiele scheitert still statt zu
#                                                   # gelingen), sonst misst der Harness die
#                                                   # R5/R5b-Lücken nicht.
#   scripts/rls-role-matrix.sh --without-r7        # Alles bis 20260924_002, OHNE 20260924_003
#                                                   # (R7: is_active_tournament_member() +
#                                                   # declined_at/expires_at) — ein widerrufenes
#                                                   # Mitglied muss hier weiterhin
#                                                   # matches/teams/match_events/tournaments und
#                                                   # das Profil des Eigentümers lesen dürfen, und
#                                                   # eine widerrufene/abgelaufene Einladung muss
#                                                   # sich hier annehmen lassen (der "vorher"-
#                                                   # Zustand, F4 aus task-R3-review.md und der
#                                                   # Follow-up aus task-R5b-report.md "Fixrunde
#                                                   # 1", M3), sonst misst der Harness die R7-
#                                                   # Lücken nicht.
#
# Ändert NICHTS an der Produktionsdatenbank — der Container ist eine Wegwerf-Instanz, wird am
# Ende entfernt (trap).
#
set -euo pipefail

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # muss zur Live-Postgres-Version passen
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"

# T1 (Testumgebung, task-T1-brief.md): "die Liste welche Dateien in welcher Reihenfolge darf es
# nur EINMAL geben" — die Pfade unten werden nicht mehr fest verdrahtet, sondern aus der
# gemeinsamen, nach dem Baseline-Marker sortierten Liste herausgesucht (dieselbe Quelle wie
# scripts/db-drift-check.sh und scripts/local-db-apply.sh). Die Gruppierung/Toggle-Logik dieses
# Skripts (WITH_HARDENING, WITH_R6, ...) bleibt eigenständig — das ist Testszenario, keine
# Dateiliste.
source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
ALL_NEWER_MIGRATIONS_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
ALL_NEWER_MIGRATIONS=()
if [[ -n "$ALL_NEWER_MIGRATIONS_RAW" ]]; then
  # bash 3.2 (macOS-Standard) kennt kein mapfile — portable while-read-Schleife.
  while IFS= read -r line; do
    ALL_NEWER_MIGRATIONS+=("$line")
  done <<< "$ALL_NEWER_MIGRATIONS_RAW"
fi

find_migration() {
  local prefix="$1" f
  for f in "${ALL_NEWER_MIGRATIONS[@]}"; do
    [[ "$(basename "$f")" == "$prefix"* ]] && { echo "$f"; return 0; }
  done
  echo "::error::Migration mit Präfix '$prefix' nicht in der Liste 'neuer als Baseline' gefunden." >&2
  return 1
}

MIGRATION_FILES=(
  "$(find_migration 20260922_001)"
  "$(find_migration 20260922_002)"
)
HARDENING_FILE="$(find_migration 20260922_003)"
PARENT_KEYS_FILE="$(find_migration 20260923_001)"
MERGE_RESTRICT_FILE="$(find_migration 20260923_002)"
PROFILES_FILE="$(find_migration 20260924_001)"
CENTRAL_PERMISSIONS_FILE="$(find_migration 20260924_002)"
DECLINED_EXPIRED_FILE="$(find_migration 20260924_003)"
# T1: löst den früheren Behelf ab (siehe weiter unten) — der Trigger auf auth.users kommt jetzt
# aus einer echten Migration, wird unconditional (wie der Behelf vorher) angewendet.
AUTH_TRIGGER_FILE="$(find_migration 20260925_001)"
# B2 (.superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B2-brief.md): fügt u.a. die Berechtigung
# 'leadMatches' zu role_permissions hinzu (INSERT ('co-admin','leadMatches')) und seedet
# public.match_transitions aus src/core/match/matchTransitions.json. Läuft UNCONDITIONAL wie
# AUTH_TRIGGER_FILE (kein eigener WITH_*-Schalter) -- additiv, orthogonal zu R5/R6/R7, und die
# Gleichlauf-Prüfungen unten (role_permissions/match_transitions vs. JSON) brauchen sie in JEDEM
# Modus, sonst diffte rolePermissions.json (die 'leadMatches' jetzt enthält) sofort gegen eine DB
# ohne diese Zeile.
MATCH_EVENT_LOG_FILE="$(find_migration 20260928_001)"
MATCH_TRANSITIONS_FILE="$REPO_ROOT/src/core/match/matchTransitions.json"
ROLE_PERMISSIONS_FILE="$REPO_ROOT/src/features/auth/permissions/rolePermissions.json"
CONTAINER_NAME="rls-role-matrix-$$"
WITH_MIGRATION=1
WITH_HARDENING=1
WITH_PARENT_KEYS=1
WITH_R6=1
WITH_R5=1
WITH_R7=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline-only)
      WITH_MIGRATION=0
      WITH_HARDENING=0
      WITH_PARENT_KEYS=0
      WITH_R6=0
      WITH_R5=0
      WITH_R7=0
      shift
      ;;
    --without-hardening)
      WITH_HARDENING=0
      WITH_PARENT_KEYS=0
      shift
      ;;
    --without-004)
      WITH_PARENT_KEYS=0
      shift
      ;;
    --without-r6)
      WITH_R6=0
      shift
      ;;
    --without-r5)
      WITH_R5=0
      shift
      ;;
    --without-r7)
      WITH_R7=0
      shift
      ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^#//'
      exit 0
      ;;
    *)
      echo "Unbekannte Option: $1" >&2
      exit 2
      ;;
  esac
done

command -v jq >/dev/null 2>&1 || { echo "::error::jq wird benötigt." >&2; exit 1; }
[[ -f "$ROLE_PERMISSIONS_FILE" ]] || { echo "::error::Rechtetabelle fehlt: $ROLE_PERMISSIONS_FILE" >&2; exit 1; }
[[ -f "$BASELINE_FILE" ]] || { echo "::error::Baseline fehlt: $BASELINE_FILE" >&2; exit 1; }
for f in "${MIGRATION_FILES[@]}"; do
  [[ -f "$f" ]] || { echo "::error::Migration fehlt: $f" >&2; exit 1; }
done
[[ -f "$HARDENING_FILE" ]] || { echo "::error::Migration fehlt: $HARDENING_FILE" >&2; exit 1; }
[[ -f "$PARENT_KEYS_FILE" ]] || { echo "::error::Migration fehlt: $PARENT_KEYS_FILE" >&2; exit 1; }
[[ -f "$MERGE_RESTRICT_FILE" ]] || { echo "::error::Migration fehlt: $MERGE_RESTRICT_FILE" >&2; exit 1; }
[[ -f "$PROFILES_FILE" ]] || { echo "::error::Migration fehlt: $PROFILES_FILE" >&2; exit 1; }
[[ -f "$CENTRAL_PERMISSIONS_FILE" ]] || { echo "::error::Migration fehlt: $CENTRAL_PERMISSIONS_FILE" >&2; exit 1; }
[[ -f "$DECLINED_EXPIRED_FILE" ]] || { echo "::error::Migration fehlt: $DECLINED_EXPIRED_FILE" >&2; exit 1; }
[[ -f "$AUTH_TRIGGER_FILE" ]] || { echo "::error::Migration fehlt: $AUTH_TRIGGER_FILE" >&2; exit 1; }
[[ -f "$MATCH_EVENT_LOG_FILE" ]] || { echo "::error::Migration fehlt: $MATCH_EVENT_LOG_FILE" >&2; exit 1; }
[[ -f "$MATCH_TRANSITIONS_FILE" ]] || { echo "::error::Übergangstabelle fehlt: $MATCH_TRANSITIONS_FILE" >&2; exit 1; }

cleanup() { docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# --- 1. Container starten -------------------------------------------------------------
docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432 \
  "$POSTGRES_IMAGE" >/dev/null

# Dasselbe Wartemuster wie scripts/db-drift-check.sh (Zeilen 141-152 dort): Das offizielle
# Postgres-Entrypoint-Verhalten dieses Images startet den Server ZWEIMAL — einmal temporär für
# die Init-Skripte, dann Shutdown, dann der endgültige Start. `pg_isready` wird schon beim
# ERSTEN (temporären) Start grün. Zuverlässiges Signal: "database system is ready to accept
# connections" muss ZWEIMAL im Log stehen. Genau darauf ist der Controller beim
# Datenbank-Programm hereingefallen — ein abgeschnittener Lauf sieht aus wie "RLS ist aus".
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
  echo "::error::Container wurde nach 90s nicht vollständig bereit." >&2
  docker logs "$CONTAINER_NAME" 2>&1 | tail -30 >&2
  exit 1
fi
for _ in $(seq 1 30); do
  docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

psql_stdin() {
  docker exec -i "$CONTAINER_NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"
}

# --- 2. Baseline (+ Migration) einspielen ---------------------------------------------
echo "Baseline einspielen..." >&2
psql_stdin < "$BASELINE_FILE"

if [[ "$WITH_MIGRATION" -eq 1 ]]; then
  for f in "${MIGRATION_FILES[@]}"; do
    echo "Migration einspielen: $(basename "$f")" >&2
    psql_stdin < "$f"
  done
fi

if [[ "$WITH_HARDENING" -eq 1 ]]; then
  echo "Migration einspielen: $(basename "$HARDENING_FILE")" >&2
  psql_stdin < "$HARDENING_FILE"
fi

if [[ "$WITH_PARENT_KEYS" -eq 1 ]]; then
  echo "Migration einspielen: $(basename "$PARENT_KEYS_FILE")" >&2
  psql_stdin < "$PARENT_KEYS_FILE"
  echo "Migration einspielen: $(basename "$MERGE_RESTRICT_FILE")" >&2
  psql_stdin < "$MERGE_RESTRICT_FILE"
fi

# T1 (Testumgebung, task-T1-brief.md): Der frühere Testaufbau-Behelf hier ist ENTFALLEN.
# 20260925_001_auth_user_created_trigger.sql legt den Trigger jetzt als echte, eingecheckte
# Migration an (CREATE OR REPLACE TRIGGER — auf der Live-DB ein No-op, siehe Kopfkommentar der
# Datei). Grund, warum er hier überhaupt fehlte: Die Baseline wurde mit
# `--schema public` gedumpt und enthält deshalb keine Objekte im Schema "auth" — ohne diesen
# Trigger bliebe public.profiles nach den Fixture-Inserts in auth.users unten leer, und jede
# rollenabhängige profiles-Zeile würde etwas anderes messen als beabsichtigt (fehlende Zeile statt
# Rechte-Verweigerung). Läuft in JEDEM Modus, unabhängig von allen WITH_*-Schaltern — die
# auth.users→profiles-Kopplung ist orthogonal zu jeder einzelnen Migration.
echo "Migration einspielen: $(basename "$AUTH_TRIGGER_FILE")" >&2
psql_stdin < "$AUTH_TRIGGER_FILE"

# R5b-Fixrunde 1 (M2): Der frühere Nachbau der Rolle ci_schema_reader hier ist ENTFALLEN --
# 20260924_002_central_role_permissions.sql legt sie jetzt selbst bedingt an (Abschnitt 0 der
# Migration, NOLOGIN, DO-Block mit pg_roles-Abfrage). Dieser Container braucht sie ohnehin nur,
# damit die Migration einspielbar bleibt (CREATE POLICY/GRANT ... TO ci_schema_reader) -- niemand
# verbindet sich hier je ALS ci_schema_reader (die Gleichlauf-Prüfung weiter unten liest
# role_permissions als Superuser postgres, nicht über diese Rolle). M2 ist damit an der Quelle
# behoben, nicht mehr per Testaufbau kaschiert.

# R6-Testaufbau: den "vorher"-Zustand von public.profiles nachbilden — MUSS vor einer eventuellen
# R6-Migration laufen (siehe Kopfkommentar): R6 REVOKEt zuerst ALL und GRANTet danach nur die
# Spaltenliste; ein GRANT ALL NACH R6 würde die gerade erst entzogenen Rechte sofort wieder
# öffnen (Postgres vereinigt ACL-Einträge, es gibt kein implizites REVOKE danach). Empirisch
# bestätigt (siehe Report): Das Postgres-Init-Verhalten dieses Images vergibt das beim
# CREATE TABLE ohnehin automatisch (ALTER DEFAULT PRIVILEGES, vom Image gesetzt) — dieser GRANT
# ist deshalb schon vor R6 ein No-op, macht die Annahme aber explizit statt sich auf
# Image-Verhalten zu verlassen, das sich ändern könnte. Läuft in JEDEM Modus (auch --without-r6,
# wo es der tatsächliche Endzustand bleibt, nicht nur eine Zwischenstufe).
psql_stdin <<'SQL'
GRANT ALL ON public.profiles TO anon, authenticated;
SQL

if [[ "$WITH_R6" -eq 1 ]]; then
  echo "Migration einspielen: $(basename "$PROFILES_FILE")" >&2
  psql_stdin < "$PROFILES_FILE"
fi

# R5b (task-R5b-brief.md): public.role_permissions + public.has_tournament_permission() ersetzen
# neun einzeln geschriebene EXISTS-Klauseln durch EINE Tabelle + EINE Funktion. Inhaltlich
# weiterhin H4 (Co-Admin-INSERT-Zweig auf teams/matches), M3 (Teams-Rollenfilter), M4
# (cascade_tournament_visibility SECURITY DEFINER), M5 (deleted_at nur Eigentümer) -- dazu R5-H1
# (Co-Admin-DELETE auf teams/matches über das neue Recht 'restructure'). Orthogonal zu R6
# (profiles) -- läuft unabhängig von WITH_R6, nur von WITH_MIGRATION/HARDENING/PARENT_KEYS
# abhängig (siehe --baseline-only oben, das WITH_R5 mit auf 0 setzt).
if [[ "$WITH_R5" -eq 1 ]]; then
  echo "Migration einspielen: $(basename "$CENTRAL_PERMISSIONS_FILE")" >&2
  psql_stdin < "$CENTRAL_PERMISSIONS_FILE"
fi

# R7 (task-R7-brief.md): is_active_tournament_member() + declined_at/expires_at in den
# Lese-Policies, profile_visible_to_viewer() und protect_collaborator_row(). Unabhängig von
# WITH_R5/WITH_R6 anwendbar (referenziert weder role_permissions/has_tournament_permission noch
# etwas aus 20260924_001) -- eigener Schalter, wie die anderen Migrationen auch.
if [[ "$WITH_R7" -eq 1 ]]; then
  echo "Migration einspielen: $(basename "$DECLINED_EXPIRED_FILE")" >&2
  psql_stdin < "$DECLINED_EXPIRED_FILE"
fi

# B2 (siehe Kommentar an MATCH_EVENT_LOG_FILE oben): braucht has_tournament_permission()/
# role_permissions aus CENTRAL_PERMISSIONS_FILE (WITH_R5) -- deshalb erst HIER, nach allen
# R5/R6/R7-Bloecken, additiv und unabhaengig von WITH_R6/WITH_R7 (nur role_permissions-Zeile
# 'leadMatches' braucht die Tabelle, match_transitions/app_config/match_events-Aenderungen sind
# davon unabhaengig). Ohne WITH_R5 existiert public.role_permissions nicht -- die Migration
# scheitert dann an ihrem eigenen ALTER/INSERT auf role_permissions, deshalb an WITH_R5 gebunden.
if [[ "$WITH_R5" -eq 1 ]]; then
  echo "Migration einspielen: $(basename "$MATCH_EVENT_LOG_FILE")" >&2
  psql_stdin < "$MATCH_EVENT_LOG_FILE"
fi

if [[ "$WITH_MIGRATION" -eq 1 && "$WITH_HARDENING" -eq 1 && "$WITH_PARENT_KEYS" -eq 1 && "$WITH_R6" -eq 1 && "$WITH_R5" -eq 1 && "$WITH_R7" -eq 1 ]]; then
  MODE_LABEL="nachher (Baseline + alle acht Migrationen)"
elif [[ "$WITH_MIGRATION" -eq 1 && "$WITH_HARDENING" -eq 1 && "$WITH_PARENT_KEYS" -eq 1 && "$WITH_R6" -eq 1 && "$WITH_R5" -eq 1 ]]; then
  MODE_LABEL="vorher/R7-Gegenprobe (Baseline + 001..20260924_002, ohne R7)"
elif [[ "$WITH_MIGRATION" -eq 1 && "$WITH_HARDENING" -eq 1 && "$WITH_PARENT_KEYS" -eq 1 && "$WITH_R6" -eq 1 ]]; then
  MODE_LABEL="vorher/R5-Gegenprobe (Baseline + 001..20260924_001, ohne R5)"
elif [[ "$WITH_MIGRATION" -eq 1 && "$WITH_HARDENING" -eq 1 && "$WITH_PARENT_KEYS" -eq 1 ]]; then
  MODE_LABEL="vorher/R6-Gegenprobe (Baseline + 001..002-restrict, ohne R6)"
elif [[ "$WITH_MIGRATION" -eq 1 && "$WITH_HARDENING" -eq 1 ]]; then
  MODE_LABEL="vorher/Fixrunde-3-Gegenprobe (Baseline + 001 + 002 + 003, ohne 004)"
elif [[ "$WITH_MIGRATION" -eq 1 ]]; then
  MODE_LABEL="vorher/Fixrunde-2-Gegenprobe (Baseline + 001 + 002, ohne 003)"
else
  MODE_LABEL="vorher/R1-Gegenprobe (nur Baseline)"
fi

# --- 3. Vor der Matrix belegen: 44 Policies, 13 Tabellen mit RLS (R5b: +2/+1 mit role_permissions,
#        nur wenn WITH_R5=1 -- die neue Tabelle existiert sonst nicht) ------------------------
EXPECTED_POLICY_COUNT=44
EXPECTED_RLS_TABLE_COUNT=13
if [[ "$WITH_R5" -eq 1 ]]; then
  # role_permissions bringt zwei neue Policies mit (role_permissions_select für authenticated,
  # role_permissions_select_ci_schema_reader für die CI-Leserolle) und ist selbst RLS-aktiv.
  EXPECTED_POLICY_COUNT=$((EXPECTED_POLICY_COUNT + 2))
  EXPECTED_RLS_TABLE_COUNT=$((EXPECTED_RLS_TABLE_COUNT + 1))
  # B2 (MATCH_EVENT_LOG_FILE, an WITH_R5 gebunden -- siehe Kommentar an dessen Anwendung oben):
  # drei neue RLS-aktive Tabellen -- match_event_authors (1 Policy: match_event_authors_select),
  # match_transitions (2 Policies: match_transitions_select, match_transitions_select_ci_schema_reader),
  # app_config (2 Policies: app_config_select, app_config_select_ci_schema_reader).
  EXPECTED_POLICY_COUNT=$((EXPECTED_POLICY_COUNT + 5))
  EXPECTED_RLS_TABLE_COUNT=$((EXPECTED_RLS_TABLE_COUNT + 3))
fi
POLICY_COUNT="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
  "SELECT count(*) FROM pg_policies WHERE schemaname = 'public';")"
RLS_TABLE_COUNT="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity;")"
echo "Policies (public): $POLICY_COUNT (erwartet: $EXPECTED_POLICY_COUNT) — Tabellen mit aktivem RLS: $RLS_TABLE_COUNT (erwartet: $EXPECTED_RLS_TABLE_COUNT)" >&2
if [[ "$POLICY_COUNT" -ne "$EXPECTED_POLICY_COUNT" || "$RLS_TABLE_COUNT" -ne "$EXPECTED_RLS_TABLE_COUNT" ]]; then
  echo "::error::Erwartung verfehlt ($EXPECTED_POLICY_COUNT Policies, $EXPECTED_RLS_TABLE_COUNT RLS-Tabellen) — Baseline unvollständig eingespielt? Container-Neustart-Falle?" >&2
  exit 1
fi

# --- 4. Deterministische Test-UUIDs (kein externes uuidgen nötig) ---------------------
uuid_for() {
  local h
  h="$(printf '%s' "rls-role-matrix:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-${h:12:4}-${h:16:4}-${h:20:12}"
}

U_OWNER="$(uuid_for user:owner)"
U_OWNER_ANON="$(uuid_for user:owner-anonymous)"
U_COADMIN="$(uuid_for user:co-admin)"
U_COLLAB="$(uuid_for user:collaborator)"
U_TRAINER="$(uuid_for user:trainer)"
U_VIEWER="$(uuid_for user:viewer)"
U_NONMEMBER="$(uuid_for user:non-member)"
U_PUBLIC_OWNER="$(uuid_for user:public-owner)"
U_INVITEE="$(uuid_for user:invitee)"
INVITEE_EMAIL="invitee@rls-matrix.test"
C_PENDING_INVITE="$(uuid_for collaborator:pending-invite)"

# R7 (task-R7-brief.md, F4 aus task-R3-review.md): zwei weitere offene Einladungen -- eine vom
# Eigentümer widerrufene (declined_at gesetzt, NIE angenommen -- der F4-Fall, nicht zu
# verwechseln mit C_DECLINED_COADMIN oben, das eine bereits ANGENOMMENE, dann widerrufene
# Mitgliedschaft ist) und eine abgelaufene (expires_at in der Vergangenheit). Je ein eigener
# Nutzer/E-Mail-Claim, damit run_write() dieselbe invite_email-Annahme-Mechanik wie
# k2_accept_invitation (oben) nachbilden kann.
U_DECLINED_INVITEE="$(uuid_for user:declined-invitee)"
DECLINED_INVITEE_EMAIL="declined-invitee@rls-matrix.test"
C_DECLINED_INVITE="$(uuid_for collaborator:declined-invite)"
U_EXPIRED_INVITEE="$(uuid_for user:expired-invitee)"
EXPIRED_INVITEE_EMAIL="expired-invitee@rls-matrix.test"
C_EXPIRED_INVITE="$(uuid_for collaborator:expired-invite)"

# R5b-Fixrunde 1 (task-R5b-review.md, M1/M3): zwei weitere Identitäten für die Vollmatrix.
# U_PENDING hat eine ECHTE co-admin-Zeile mit user_id gesetzt, aber accepted_at IS NULL -- die
# Lücke, die MP2 im Review ausnutzte (Annahme fehlt, Recht greift trotzdem). U_DECLINED hat
# sowohl accepted_at ALS AUCH declined_at gesetzt -- genau der M3-Befund (Einladung angenommen,
# dann vom Eigentümer widerrufen, has_tournament_permission() ignorierte das bisher). Beide mit
# role='co-admin' (maximale Rechte in der Tabelle), damit ein fehlender Guard maximal sichtbar
# wird -- nicht mit einer schwächeren Rolle, die den Fehler verschleiern würde.
U_PENDING="$(uuid_for user:open-invitation)"
U_DECLINED="$(uuid_for user:declined-membership)"
C_OPEN_COADMIN="$(uuid_for collaborator:open-coadmin)"
C_DECLINED_COADMIN="$(uuid_for collaborator:declined-coadmin)"

# Explizite IDs für die vier Basis-Mitarbeiter-Zeilen auf T_MAIN (vorher ohne eigene id, per
# gen_random_uuid() vergeben) -- die neue Vollmatrix braucht ein deterministisches Ziel für
# collaborators UPDATE/DELETE, das NICHT die eigene Zeile der testenden Identität ist (sonst
# griffe der "Eigenzweig" von collaborators_update_v3/_delete_v3 -- user_id = auth.uid() --
# und würde manageMembers fälschlich als erlaubt zeigen, siehe target_membership_for_id() unten).
MEMBERSHIP_COADMIN_MAIN="$(uuid_for membership:coadmin-main)"
MEMBERSHIP_COLLAB_MAIN="$(uuid_for membership:collab-main)"
MEMBERSHIP_TRAINER_MAIN="$(uuid_for membership:trainer-main)"
MEMBERSHIP_VIEWER_MAIN="$(uuid_for membership:viewer-main)"
# Dummy-Mitgliedszeile in T_ANON, ausschließlich als Ziel für die manageMembers-UPDATE/DELETE-
# Sonden der Identität "owner-anonymous" (T_ANON hat sonst keine Mitarbeiter-Zeile).
U_DUMMY_ANON_MEMBER="$(uuid_for user:dummy-anon-member)"
MEMBERSHIP_VIEWER_ANON="$(uuid_for membership:viewer-anon)"

T_MAIN="$(uuid_for tournament:main)"
T_ANON="$(uuid_for tournament:anon)"
T_PUBLIC="$(uuid_for tournament:public)"

M_MAIN="$(uuid_for match:main)"
M_ANON="$(uuid_for match:anon)"
M_PUBLIC="$(uuid_for match:public)"

TEAM_MAIN="$(uuid_for team:main)"
# R5 (H4/M4-Beweise): TEAM_NEW existiert VOR dem jeweiligen Probe-Lauf noch nicht (INSERT-Zweig
# von teams_insert_v2), TEAM_ATTACK wird vom Co-Admin von T_MAIN gezielt gegen das FREMDE T_ANON
# versucht (K3-Lehre: der neue Co-Admin-INSERT-Zweig darf keinen Weg in ein fremdes Turnier
# öffnen).
TEAM_NEW="$(uuid_for team:coadmin-insert)"
TEAM_ATTACK="$(uuid_for team:coadmin-attack-foreign-tournament)"
# R5b: TEAM_ANON -- Gegenstück zu TEAM_MAIN im owner-anonymous-Turnier (T_ANON), gebraucht von
# der 'teams'-Spalte der Hauptmatrix (die Zeile "owner-anonymous" testet immer gegen T_ANON/
# M_ANON/E_ANON, nicht T_MAIN, siehe Zeile "tournament_id=..." weiter unten). TEAM_N4_INSERT ist
# die Zeile, mit der der N4-Angreifer (Eigentümer von T_ANON) versucht, per INSERT eine neue Zeile
# in das FREMDE T_MAIN zu legen -- der Angriff in die andere Richtung als K3-Lehre (dort: Co-Admin
# von T_MAIN gegen T_ANON).
TEAM_ANON="$(uuid_for team:anon)"
TEAM_N4_INSERT="$(uuid_for team:n4-attacker-insert-foreign-tournament)"
SPONSOR_MAIN="$(uuid_for sponsor:main)"
MONITOR_MAIN="$(uuid_for monitor:main)"

E_MAIN="$(uuid_for event:main)"
E_ANON="$(uuid_for event:anon)"
E_PUBLIC="$(uuid_for event:public)"

# --- 5. Fixtures anlegen (als Superuser postgres — umgeht RLS, Trigger feuern trotzdem) ----
echo "Fixtures anlegen..." >&2
psql_stdin <<SQL
BEGIN;

-- Spaltensatz an das, was dieses Image tatsächlich bereitstellt: eine ältere,
-- minimale auth.users-Variante (kein email_confirmed_at, kein is_anonymous-Spalte —
-- is_anonymous_user() in der Baseline liest das aus dem JWT-Claim, nicht aus der Spalte,
-- und wird von keiner der hier getesteten Policies aufgerufen, also unproblematisch).
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '$U_OWNER', 'authenticated', 'authenticated', 'owner@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_OWNER_ANON', 'authenticated', 'authenticated', NULL, 'x', now(), '{"provider":"anonymous","providers":["anonymous"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_COADMIN', 'authenticated', 'authenticated', 'co-admin@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_COLLAB', 'authenticated', 'authenticated', 'collaborator@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_TRAINER', 'authenticated', 'authenticated', 'trainer@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_VIEWER', 'authenticated', 'authenticated', 'viewer@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_NONMEMBER', 'authenticated', 'authenticated', 'nonmember@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_PUBLIC_OWNER', 'authenticated', 'authenticated', 'public-owner@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_INVITEE', 'authenticated', 'authenticated', '$INVITEE_EMAIL', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_PENDING', 'authenticated', 'authenticated', 'open-invitation@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_DECLINED', 'authenticated', 'authenticated', 'declined-membership@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_DUMMY_ANON_MEMBER', 'authenticated', 'authenticated', 'dummy-anon-member@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_DECLINED_INVITEE', 'authenticated', 'authenticated', '$DECLINED_INVITEE_EMAIL', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$U_EXPIRED_INVITEE', 'authenticated', 'authenticated', '$EXPIRED_INVITEE_EMAIL', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

-- R5 (M4-Beweis "Co-Admin veröffentlicht"): T_MAIN bekommt von Anfang an einen publishedAt-
-- Marker im config (is_public bleibt false) -- enforce_release_before_public (20260921_001,
-- SECURITY DEFINER, unverändert seit R1) verlangt genau das, BEVOR is_public auf true wechseln
-- darf. Ohne diesen Marker würde der spätere Co-Admin-Publish-Versuch schon an dieser
-- unabhängigen, älteren Regel scheitern, nicht an M4 -- das wäre kein Beleg für irgendetwas.
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES
  ('$T_MAIN', '$U_OWNER', 'RLS Matrix — main', '2026-09-22', 8, 15, '{"publishedAt":"2026-09-22T00:00:00.000Z"}'::jsonb),
  ('$T_ANON', '$U_OWNER_ANON', 'RLS Matrix — anon owner', '2026-09-22', 8, 15, '{}'::jsonb);

INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, is_public, config)
VALUES
  ('$T_PUBLIC', '$U_PUBLIC_OWNER', 'RLS Matrix — public read', '2026-09-22', 8, 15, true, '{"publishedAt":"2026-09-22T00:00:00.000Z"}'::jsonb);

INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at)
VALUES
  ('$MEMBERSHIP_COADMIN_MAIN', '$T_MAIN', '$U_COADMIN', 'co-admin', now()),
  ('$MEMBERSHIP_COLLAB_MAIN', '$T_MAIN', '$U_COLLAB', 'collaborator', now()),
  ('$MEMBERSHIP_TRAINER_MAIN', '$T_MAIN', '$U_TRAINER', 'trainer', now()),
  ('$MEMBERSHIP_VIEWER_MAIN', '$T_MAIN', '$U_VIEWER', 'viewer', now());
  -- Nicht-Mitglied ($U_NONMEMBER) bekommt bewusst KEINE Zeile.

-- R5b-Fixrunde 1 (M1/M3): dieselbe Dummy-Mitgliedszeile für owner-anonymous/T_ANON (Ziel der
-- manageMembers-UPDATE/DELETE-Sonden dieser Identität -- T_ANON hat sonst kein Mitglied).
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at)
VALUES
  ('$MEMBERSHIP_VIEWER_ANON', '$T_ANON', '$U_DUMMY_ANON_MEMBER', 'viewer', now());

-- R5b-Fixrunde 1 (M1, Beleg für MP2): offene Mitgliedschaft -- user_id ist bereits gesetzt
-- (kein reiner "unclaimed"-Einladungszustand wie C_PENDING_INVITE oben, sondern der Zustand, den
-- MP2 ausnutzte), aber accepted_at IS NULL. Erwartet: KEIN Recht, obwohl role='co-admin'.
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at, declined_at)
VALUES
  ('$C_OPEN_COADMIN', '$T_MAIN', '$U_PENDING', 'co-admin', NULL, NULL);

-- R5b-Fixrunde 1 (M3, Beleg): angenommene, aber vom Eigentuemer widerrufene Mitgliedschaft --
-- exakt der im Review belegte Zustand (Annahme UND Widerruf beide gesetzt). Erwartet: KEIN
-- Recht, obwohl role='co-admin' UND accepted_at gesetzt ist.
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at, declined_at)
VALUES
  ('$C_DECLINED_COADMIN', '$T_MAIN', '$U_DECLINED', 'co-admin', now(), now());

-- Fixrunde 2 / K2: offene (unclaimed) Einladung auf T_MAIN, exakt wie
-- invitationService.ts#createInvitation sie anlegt -- user_id NULL, invite_email gesetzt,
-- accepted_at NULL, use_count 0. Wird von "eingeladener nimmt Einladung an" beansprucht.
-- Fixrunde 1 (R6, M1): "invited_by" = U_OWNER ergänzt (vorher nicht gesetzt) — wird von den
-- neuen R6-Zeilen "Eingeladener sieht Einladenden vor/nach Annahme" gebraucht
-- (profile_visible_to_viewer()-Regel (ii)). Ändert an K2/L5 nichts, die lesen die Spalte nicht.
-- R7-Fixrunde 1 (M-1, final-review-2.md): "expires_at" = now() + 7 Tage ergänzt (vorher NULL) --
-- die App setzt bei JEDER Einladung immer ein zukünftiges expires_at (invitationService.ts:183),
-- eine Fixture ohne Ablaufdatum verschleiert DB-Mutationen an der expires_at-Prüfung im
-- Annahme-Zweig von protect_collaborator_row() (Review-Beleg DB-M2: blieb ohne diesen Fix
-- fälschlich grün). Betrifft ALLE Zeilen, die diese geteilte Fixture nutzen (k2/l5/R6/R7) --
-- keine ändert ihr erwartetes Ergebnis, alle waren und bleiben "allowed"/funktionierend.
INSERT INTO public.tournament_collaborators
  (id, tournament_id, user_id, invite_code, invite_email, role, invited_by, accepted_at, expires_at, use_count, max_uses)
VALUES
  ('$C_PENDING_INVITE', '$T_MAIN', NULL, 'RLSTESTCODE', '$INVITEE_EMAIL', 'collaborator', '$U_OWNER', NULL, now() + interval '7 days', 0, 5);

-- R7 (F4, task-R3-review.md): offene Einladung, die der Eigentümer per deactivateInvitation()
-- widerrufen hat, BEVOR sie je angenommen wurde -- declined_at gesetzt, accepted_at bleibt NULL.
-- Erwartet (R7): die Annahme darf nicht mehr gelingen.
INSERT INTO public.tournament_collaborators
  (id, tournament_id, user_id, invite_code, invite_email, role, invited_by, accepted_at, declined_at, use_count, max_uses)
VALUES
  ('$C_DECLINED_INVITE', '$T_MAIN', NULL, 'RLSDECLINEDCODE', '$DECLINED_INVITEE_EMAIL', 'viewer', '$U_OWNER', NULL, now(), 0, 5);

-- R7 (F4, task-R3-review.md): offene Einladung mit expires_at in der Vergangenheit -- nie
-- angenommen, nie widerrufen, einfach abgelaufen. Erwartet (R7): die Annahme darf nicht mehr
-- gelingen.
INSERT INTO public.tournament_collaborators
  (id, tournament_id, user_id, invite_code, invite_email, role, invited_by, accepted_at, expires_at, use_count, max_uses)
VALUES
  ('$C_EXPIRED_INVITE', '$T_MAIN', NULL, 'RLSEXPIREDCODE', '$EXPIRED_INVITEE_EMAIL', 'viewer', '$U_OWNER', NULL, now() - interval '7 days', 0, 5);

INSERT INTO public.matches (id, tournament_id, round, field)
VALUES
  ('$M_MAIN', '$T_MAIN', 1, 1),
  ('$M_ANON', '$T_ANON', 1, 1),
  ('$M_PUBLIC', '$T_PUBLIC', 1, 1);

-- Fixrunde 3 (K3/H5-Beweise, 20260923_001): ein Team im Haupt-Turnier, damit der
-- Eigentuemer-Upsert-Regressionscheck und der H5-Team-Angriff eine echte Zeile zum Umhaengen
-- haben. owner_id wird vom BEFORE-INSERT-Trigger teams_sync_owner aus tournaments.owner_id
-- abgeleitet (Baseline-Trigger, laeuft in JEDEM Modus, unabhaengig von 001/002/003/004).
INSERT INTO public.teams (id, tournament_id, name)
VALUES
  ('$TEAM_MAIN', '$T_MAIN', 'RLS Matrix Team');

-- R5b: Gegenstück im owner-anonymous-Turnier, gebraucht von der 'teams'-Spalte der Hauptmatrix
-- (Zeile "owner-anonymous" testet gegen T_ANON).
INSERT INTO public.teams (id, tournament_id, name)
VALUES
  ('$TEAM_ANON', '$T_ANON', 'RLS Matrix Team (anon owner)');

-- R5 (M4-Beweis): sponsors/monitors_sync_owner (Baseline, BEFORE INSERT) leiten owner_id UND
-- is_public von tournaments ab -- beide Zeilen starten also mit is_public=false (T_MAIN ist bei
-- den Fixtures noch nicht veröffentlicht), owner_id=$U_OWNER.
INSERT INTO public.sponsors (id, tournament_id, name)
VALUES
  ('$SPONSOR_MAIN', '$T_MAIN', 'RLS Matrix Sponsor');

INSERT INTO public.monitors (id, tournament_id, name)
VALUES
  ('$MONITOR_MAIN', '$T_MAIN', 'RLS Matrix Monitor');

INSERT INTO public.match_events (id, match_id, type, timestamp_seconds, score_home, score_away)
VALUES
  ('$E_MAIN', '$M_MAIN', 'GOAL', 10, 0, 0),
  ('$E_ANON', '$M_ANON', 'GOAL', 10, 0, 0),
  ('$E_PUBLIC', '$M_PUBLIC', 'GOAL', 10, 0, 0);

-- KEIN "ALTER TABLE ... DISABLE TRIGGER match_event_version_trigger" hier (Fixrunde 1,
-- anders als in der ersten Fassung dieses Skripts): 20260922_002 repariert den Trigger
-- (increment_match_event_version referenzierte NEW.updated_at, eine Spalte, die
-- match_events nicht hat — jedes UPDATE scheiterte, auch für den Eigentümer). Der Trigger
-- bleibt jetzt AKTIV, damit eine künftige Regression dieses Bugs von der Matrix erkannt
-- wird (siehe die dedizierten "owner-events-update/-delete"-Prüfungen weiter unten) statt
-- stillschweigend übersprungen zu werden.

COMMIT;
SQL

# Fixrunde 2 / K1-Beleg "Eigentümer-Übertragung über die SECURITY-DEFINER-Funktion muss
# funktionieren": Die tatsächliche Produktionsfunktion merge_user_data() (Baseline ab Zeile
# ~453) ist unabhängig von K1/K2 bereits kaputt — sie referenziert eine Tabelle
# "tournament_members", die es nicht gibt (vermutlich eine Altlast vor der Umbenennung zu
# tournament_collaborators). Empirisch im Container bestätigt: SELECT merge_user_data(...)
# schlägt mit "relation tournament_members does not exist" fehl, SOBALD der Quellnutzer
# tatsächlich ein Turnier besitzt — genau der Fall, um den es hier geht —, und die
# EXCEPTION-WHEN-OTHERS-Klausel der Funktion re-raised den Fehler, wodurch die gesamte
# Funktion (inklusive der zuvor erfolgreichen UPDATE ... SET owner_id-Schritte) zurückrollt.
# Nicht Gegenstand dieser Migration (siehe Report). Um TROTZDEM zu belegen, dass K1s
# current_user-Ausnahme für SECURITY-DEFINER-Aufrufe funktioniert, baut dieses Skript NUR
# hier im Wegwerf-Container eine originalgetreue Kopie der relevanten Anweisung
# (UPDATE tournaments SET owner_id = ... — Baseline Zeile 456) nach: gleicher Mechanismus
# (SECURITY DEFINER, Eigentümer postgres wie jede per Migration angelegte Funktion), ohne
# den unabhängigen tournament_members-Bug. Diese Funktion ist NICHT Teil der committeten
# Migration.
psql_stdin <<'SQL'
CREATE OR REPLACE FUNCTION public.repro_security_definer_owner_transfer(p_tournament_id uuid, p_new_owner uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $$
BEGIN
  UPDATE tournaments SET owner_id = p_new_owner WHERE id = p_tournament_id;
END;
$$;
SQL

# --- 6. Pro Zeile die Schreibversuche ausführen ---------------------------------------
# Jeder Versuch läuft in einer eigenen Transaktion, die NIE committet wird (die psql-Session
# endet ohne COMMIT und rollt implizit zurück) — der Container bleibt zwischen den Zeilen
# unverändert, jede Zeile testet gegen denselben Ausgangszustand.
# WICHTIG: Kein RETURNING in den SQL-Schnipseln, die hier durchgereicht werden. Grund (in der
# ersten Fassung dieses Skripts entdeckt, als match_events_select_v3 noch keinen
# Mitarbeiter-Zweig hatte, und seither als Prinzip beibehalten): ein INSERT/UPDATE/DELETE
# ... RETURNING prüft implizit auch, ob die betroffene Zeile per SELECT-Policy sichtbar wäre.
# Ist sie das nicht, wirft Postgres DIESELBE Fehlermeldung ("new row violates row-level
# security policy") wie eine echte Verweigerung durch die INSERT/UPDATE/DELETE-Policy selbst —
# RETURNING vermischt also zwei unterschiedliche Policies zu einem nicht unterscheidbaren
# Ergebnis. Stattdessen wird ohne RETURNING gearbeitet und der psql-Befehls-Tag
# ("INSERT 0 1" / "UPDATE 1" / "UPDATE 0" / "DELETE 1" / "DELETE 0") ausgewertet — das misst
# exakt die INSERT/UPDATE/DELETE-Policy, nichts sonst.
# $3 (optional): E-Mail-Claim. Fixrunde 2 / K2 braucht ihn für den echten Einladungs-Annahme-
# Pfad — vor dem Annehmen ist eine offene Einladung nicht über user_id sichtbar (der ist noch
# NULL), sondern über collaborators_update_v3s "invite_email = auth.email()"-Zweig. auth.email()
# liest request.jwt.claim.email (leerer GUC ohne diesen Parameter, wie auth.uid() bei sub).
run_write() {
  local user_id="$1" sql="$2" email_claim="${3:-}"
  local out ec
  local email_line=""
  [[ -n "$email_claim" ]] && email_line="SET LOCAL request.jwt.claim.email = '$email_claim';"
  set +e
  # Kein -q hier (anders als bei psql_stdin): -q unterdrückt auch die Befehls-Tags
  # ("UPDATE 1" etc.), auf die dieses Skript angewiesen ist — mit -q wäre die Ausgabe
  # bei JEDEM Versuch leer und alles würde fälschlich als "denied" gewertet (beobachtet).
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$user_id';
$email_line
$sql
SQL
)"
  ec=$?
  set -e
  if [[ $ec -ne 0 ]]; then
    echo "denied"
  elif grep -qE '^(INSERT [0-9]+ [1-9][0-9]*|UPDATE [1-9][0-9]*|DELETE [1-9][0-9]*)$' <<<"$out"; then
    echo "allowed"
  else
    echo "denied"
  fi
}

run_read_as_anon() {
  local sql="$1"
  local out ec
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE anon;
$sql
SQL
)"
  ec=$?
  set -e
  if [[ $ec -ne 0 || -z "$out" ]]; then
    echo "denied"
  else
    echo "allowed"
  fi
}

# Fixrunde 2 / K1: run_write() allein reicht nicht, um "owner_id wurde still beibehalten" zu
# messen — dafür muss der tatsächlich GESPEICHERTE Wert gelesen werden, nicht nur ob die
# Anweisung eine Zeile traf. Führt UPDATE und eine anschließende SELECT in DERSELBEN,
# nie committeten Transaktion/Rolle aus und gibt den gelesenen Wert zurück (oder "ERROR:..."
# bei einer Exception). -tA unterdrückt dabei die UPDATE-Befehls-Tags (wie in Fixrunde 1
# festgestellt) — genau das ist hier erwünscht, übrig bleibt nur das SELECT-Ergebnis.
# Nur für tournaments/matches genutzt, deren SELECT-Policies bereits einen
# Mitarbeiter-Zweig haben (matches_select_v3 seit der Baseline, tournaments_select_v3
# ebenso) — das RETURNING/SELECT-Policy-Problem aus Fixrunde 1 gilt hier nicht.
run_write_then_select() {
  local user_id="$1" update_sql="$2" select_sql="$3"
  local out ec
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$user_id';
$update_sql
$select_sql
SQL
)"
  ec=$?
  set -e
  if [[ $ec -ne 0 ]]; then
    echo "ERROR:$out"
  else
    echo "$out"
  fi
}

# --- R5b-Fixrunde 1 (M1, task-R5b-review.md): Vollmatrix, VOLLSTÄNDIG aus rolePermissions.json
# erzeugt -- jede Rolle × jedes Recht × jede zugehörige Operation (15 Operationen, siehe
# right_for_op()/op_sql() unten), über neun Identitäten. Ersetzt die vorherige Hauptmatrix, die
# nur vier von sieben Rechten und keine offene/abgelehnte Mitgliedschaft maß -- der Review belegte
# mit zwei Mutationen (MP2: accepted_at-Prüfung entfernt, MP3: matches_delete prüft 'teams' statt
# 'restructure'), dass genau diese Lücken wirksam waren und trotzdem grün blieben.
#
# Testidentitäten sind FEST im Skript verankert, nicht Teil der JSON (das sind Testfixturen,
# keine Rechte). Die JSON (rolePermissions.json) enthält NUR die Rechtetabelle selbst
# (Rolle -> Array erlaubter Rechte). 'owner'/'owner-anonymous' sind IMMER true (fest verankert,
# spiegelt hasPermission()/has_tournament_permission()s Eigentümer-Sonderfall). 'non-member'
# (kein Turnier-Bezug), 'open-invitation' (accepted_at IS NULL, aber role='co-admin' -- der MP2-
# Fall) und 'declined-membership' (accepted_at UND declined_at gesetzt -- der M3-Fall) sind IMMER
# false, UNABHÄNGIG von ihrer role-Spalte in tournament_collaborators -- das ist der Kern dessen,
# was M1/M3 beweisen sollen.
MATRIX_IDS=(owner owner-anonymous co-admin collaborator trainer viewer non-member open-invitation declined-membership)

role_for_id() {
  case "$1" in
    owner|owner-anonymous) echo "owner" ;;
    non-member|open-invitation|declined-membership) echo "" ;;
    *) echo "$1" ;;
  esac
}

# open-invitation/declined-membership haben eigene, dedizierte Nutzer (siehe Fixtures) -- alle
# anderen Identitäten leiten sich wie bisher deterministisch aus ihrem Label ab.
user_id_for_id() {
  case "$1" in
    open-invitation) echo "$U_PENDING" ;;
    declined-membership) echo "$U_DECLINED" ;;
    *) uuid_for "user:$1" ;;
  esac
}

# Ziel-Mitgliedszeile für die manageMembers-UPDATE/DELETE-Sonden: NIE die eigene Zeile der
# testenden Identität, sonst griffe der "Eigenzweig" von collaborators_update_v3/_delete_v3
# (user_id = auth.uid()) und würde manageMembers fälschlich als erlaubt zeigen, obwohl nur
# Selbstverwaltung (Einladung annehmen, eigene Zeile verlassen) greift, nicht das Recht, ANDERE zu
# verwalten. 'viewer' zielt deshalb auf die Co-Admin-Zeile, alle anderen auf die Viewer-Zeile.
# 'owner-anonymous' hat in T_MAIN kein Mitglied, deshalb die eigene Dummy-Zeile in T_ANON.
target_membership_for_id() {
  case "$1" in
    viewer) echo "$MEMBERSHIP_COADMIN_MAIN" ;;
    owner-anonymous) echo "$MEMBERSHIP_VIEWER_ANON" ;;
    *) echo "$MEMBERSHIP_VIEWER_MAIN" ;;
  esac
}

perm_expected() {
  local role="$1" perm="$2"
  if [[ -z "$role" ]]; then echo "false"; return; fi
  if [[ "$role" == "owner" ]]; then echo "true"; return; fi
  jq -r --arg role "$role" --arg perm "$perm" \
    '(.roles[$role] // []) | any(. == $perm)' "$ROLE_PERMISSIONS_FILE"
}

# mark() nur als reine Funktion (kein Kommandosubstitutions-Aufruf mit Seiteneffekt) —
# `x="$(f)"` startet eine Subshell; Änderungen an TOTAL/MISMATCHES darin gingen sonst verloren
# (beim ersten Anlauf dieses Skripts genau so passiert: "0 Abweichungen" trotz sichtbarer "!="
# in der Tabelle). Zählen passiert danach im Hauptprozess.
mark() {
  local exp="$1" got="$2"
  if [[ "$got" == "$exp" ]]; then
    echo "$got"
  else
    echo "${got}!=${exp}"
  fi
}

# 15 Operationen (task-R5b-review.md, M1-Fix): teams/matches/match_events je INSERT/UPDATE/DELETE
# (9), tournaments UPDATE/Soft-Delete/hartes DELETE (3), collaborators INSERT/UPDATE/DELETE (3).
# right_for_op() ordnet jede Operation ihrem Recht aus rolePermissions.json zu -- außer
# 'tournaments_hard_delete': das ist KEIN Recht aus der Tabelle (tournaments_delete_v2 bleibt seit
# der Baseline Eigentümer-only, siehe Migrationskommentar Abschnitt 6), sondern eine reine
# Owner-Only-Regression, deshalb der Sonderwert "ownerOnly".
OPERATIONS=(
  teams_insert teams_update teams_delete
  matches_insert matches_update matches_delete
  match_events_insert match_events_update match_events_delete
  tournaments_settings_update tournaments_deleted_at_update tournaments_hard_delete
  collaborators_insert collaborators_update collaborators_delete
)

right_for_op() {
  case "$1" in
    teams_insert|teams_delete|matches_insert|matches_delete) echo "restructure" ;;
    teams_update) echo "teams" ;;
    matches_update|match_events_insert) echo "writeMatchData" ;;
    match_events_update|match_events_delete) echo "correctEvents" ;;
    tournaments_settings_update) echo "tournamentSettings" ;;
    tournaments_deleted_at_update) echo "deleteTournament" ;;
    tournaments_hard_delete) echo "ownerOnly" ;;
    collaborators_insert|collaborators_update|collaborators_delete) echo "manageMembers" ;;
  esac
}

# Baut die Sonde je Operation -- echter App-Pfad, wo einer existiert (INSERT/DELETE wie
# SupabaseRepository.save(), UPDATE wie das jeweilige Formular). Jede INSERT-Sonde bekommt eine
# pro (Identität, Operation) eindeutige id (uuid_for "…:$id:$op"), damit keine zwei Zeilen im
# selben Lauf kollidieren -- unkritisch, da jede Sonde in einer eigenen, nie committeten
# Transaktion läuft, aber so bleibt jede Zeile im Log eindeutig einer Sonde zuordenbar.
op_sql() {
  local op="$1" tournament_id="$2" match_id="$3" team_id="$4" event_id="$5"
  local ins_team="$6" ins_match="$7" ins_invite="$8" target_membership="$9"
  case "$op" in
    teams_insert)
      echo "INSERT INTO public.teams (id,tournament_id,name) VALUES ('$ins_team','$tournament_id','Vollmatrix Team');" ;;
    teams_update)
      echo "UPDATE public.teams SET name='Vollmatrix Team (Update)' WHERE id='$team_id';" ;;
    teams_delete)
      echo "DELETE FROM public.teams WHERE id='$team_id';" ;;
    matches_insert)
      echo "INSERT INTO public.matches (id,tournament_id,round,field) VALUES ('$ins_match','$tournament_id',9,9);" ;;
    matches_update)
      echo "UPDATE public.matches SET score_a = score_a + 1 WHERE id='$match_id';" ;;
    matches_delete)
      echo "DELETE FROM public.matches WHERE id='$match_id';" ;;
    match_events_insert)
      echo "INSERT INTO public.match_events (match_id,type,timestamp_seconds,score_home,score_away) VALUES ('$match_id','GOAL',22,0,0);" ;;
    match_events_update)
      echo "UPDATE public.match_events SET is_deleted = NOT is_deleted WHERE id='$event_id';" ;;
    match_events_delete)
      echo "DELETE FROM public.match_events WHERE id='$event_id';" ;;
    tournaments_settings_update)
      echo "UPDATE public.tournaments SET location_name='RLS Vollmatrix' WHERE id='$tournament_id';" ;;
    tournaments_deleted_at_update)
      echo "UPDATE public.tournaments SET deleted_at = now() WHERE id='$tournament_id';" ;;
    tournaments_hard_delete)
      echo "DELETE FROM public.tournaments WHERE id='$tournament_id';" ;;
    collaborators_insert)
      echo "INSERT INTO public.tournament_collaborators (id,tournament_id,invite_code,invite_email,role,invited_by,max_uses) VALUES ('$ins_invite','$tournament_id','MTRX-$ins_invite','matrix-$ins_invite@rls-matrix.test','viewer','$U_OWNER',5);" ;;
    collaborators_update)
      echo "UPDATE public.tournament_collaborators SET role='trainer' WHERE id='$target_membership';" ;;
    collaborators_delete)
      echo "DELETE FROM public.tournament_collaborators WHERE id='$target_membership';" ;;
  esac
}

echo ""
echo "=== Vollmatrix (M1: alle Rechte × alle Operationen × alle Identitäten) — $MODE_LABEL ==="

MISMATCHES=0
TOTAL=0
VOLLMATRIX_MISMATCHES=0

for id in "${MATRIX_IDS[@]}"; do
  role="$(role_for_id "$id")"
  user_id="$(user_id_for_id "$id")"
  target_membership="$(target_membership_for_id "$id")"

  if [[ "$id" == "owner-anonymous" ]]; then
    tournament_id="$T_ANON"; match_id="$M_ANON"; event_id="$E_ANON"; team_id="$TEAM_ANON"
  else
    tournament_id="$T_MAIN"; match_id="$M_MAIN"; event_id="$E_MAIN"; team_id="$TEAM_MAIN"
  fi

  for op in "${OPERATIONS[@]}"; do
    right="$(right_for_op "$op")"
    if [[ "$right" == "ownerOnly" ]]; then
      exp="$([[ "$role" == "owner" ]] && echo true || echo false)"
    else
      exp="$(perm_expected "$role" "$right")"
    fi

    ins_team="$(uuid_for "vollmatrix-team:$id:$op")"
    ins_match="$(uuid_for "vollmatrix-match:$id:$op")"
    ins_invite="$(uuid_for "vollmatrix-invite:$id:$op")"

    sql="$(op_sql "$op" "$tournament_id" "$match_id" "$team_id" "$event_id" "$ins_team" "$ins_match" "$ins_invite" "$target_membership")"
    result="$(run_write "$user_id" "$sql")"
    got="$([[ "$result" == "allowed" ]] && echo true || echo false)"

    cell="$(mark "$exp" "$got")"
    TOTAL=$((TOTAL + 1))
    if [[ "$cell" == *"!="* ]]; then
      MISMATCHES=$((MISMATCHES + 1))
      VOLLMATRIX_MISMATCHES=$((VOLLMATRIX_MISMATCHES + 1))
      printf 'vollmatrix %-20s %-28s: %s\n' "$id" "$op" "$cell"
    fi
  done
done

echo "Vollmatrix: $((${#MATRIX_IDS[@]} * ${#OPERATIONS[@]})) Zellen geprüft (9 Identitäten × 15 Operationen), $VOLLMATRIX_MISMATCHES Abweichung(en) — nur abweichende Zellen werden einzeln aufgelistet (siehe oben), der Rest ist grün."

# --- 7. Dedizierte Regressionsprüfung: Eigentümer bearbeitet/löscht ein Ereignis ------
# Unabhängig vom Rollen-Loop oben (dort in "correctEvents" für die Zeile "owner" mit
# eingerechnet). Eigene, klar beschriftete Zeilen, damit eine Wiederkehr des
# Trigger-Bugs (20260922_002) nicht in einer zusammengefassten Zelle verschwindet — genau
# das wäre mit dem alten, kaputten Trigger hier "denied" gewesen, für den EIGENTÜMER, ganz
# ohne RLS-Beteiligung.
owner_event_update="$(run_write "$U_OWNER" "UPDATE public.match_events SET is_deleted = NOT is_deleted WHERE id = '$E_MAIN';")"
owner_event_delete="$(run_write "$U_OWNER" "DELETE FROM public.match_events WHERE id = '$E_MAIN';")"
echo ""
echo "=== Dedizierte Prüfung — $MODE_LABEL ==="
# Beschriftung (Review-Befund, task-R2-brief.md): "update"/"delete" suggerierten zwei
# gleichrangige SQL-Operationen. Tatsächlich ist NUR die erste ("update", is_deleted-Toggle)
# der Löschpfad, den die App wirklich geht (SupabaseLiveMatchRepository.deleteEvent →
# .update({ is_deleted: true })) — der zweite ("delete", hartes DELETE FROM) ist eine
# RLS-Policy, die zwar existiert, aber von der App NIE ausgeführt wird. Vor dieser Umbenennung
# hätte ein grünes "owner-events-delete" fälschlich suggeriert, "Löschen war nie kaputt" — dabei
# bewies nur der App-Pfad (Soft-Delete) etwas Relevantes; genau der war vom Trigger-Bug
# (20260922_002) betroffen. Reine Beschriftungsänderung, keine Logik.
for check in "owner-events-soft-delete-app-pfad:$owner_event_update" "owner-events-hard-delete-rls-ungenutzt-von-app:$owner_event_delete"; do
  label="${check%%:*}"; got="${check#*:}"
  exp="allowed"
  TOTAL=$((TOTAL + 1))
  if [[ "$got" == "$exp" ]]; then
    echo "$label: $got"
  else
    echo "$label: ${got}!=${exp}"
    MISMATCHES=$((MISMATCHES + 1))
  fi
done

# --- 7b. Fixrunde 2 — K1 (owner_id-Schutz) und K2 (Mitarbeiter-Zeilen-Schutz) --------------
# Sieben Zeilen, wie vom Controller verlangt, jede mit einem von WITH_HARDENING abhängigen
# erwarteten Ergebnis: mit 20260922_003 ("nachher") müssen die drei Angriffszeilen
# (K1 x2, K2 x2) blockiert sein und alle drei legitimen Zeilen weiter gelingen; OHNE
# 20260922_003, aber MIT 001+002 ("--without-hardening", die Fixrunde-2-Gegenprobe) müssen
# dieselben Angriffszeilen GELINGEN — sonst beweist der Harness die Lücke nicht, die er
# beweisen soll.
#
# Nur wenn WITH_MIGRATION=1 (001+002 sind live): K1 setzt voraus, dass ein co-admin
# tournaments überhaupt per UPDATE erreichen kann — das ist erst seit 001 der Fall (vorher
# tote Bedingung role='admin', Bug 3 aus R1). Unter reiner --baseline-only würde der
# UPDATE-Versuch schon an dieser UNABHÄNGIGEN, längst bekannten Lücke scheitern (0 Zeilen),
# nicht an K1 — das wäre kein Beleg für irgendetwas, nur Rauschen in der R1-Gegenprobe.
k1k2_mark_value() {
  local label="$1" got="$2" exp="$3"
  TOTAL=$((TOTAL + 1))
  if [[ "$got" == "$exp" ]]; then
    echo "$label: $got"
  else
    echo "$label: ${got}!=${exp}"
    MISMATCHES=$((MISMATCHES + 1))
  fi
}

if [[ "$WITH_MIGRATION" -ne 1 ]]; then
  echo ""
  echo "=== Fixrunde 2 — K1/K2 — übersprungen (WITH_MIGRATION=0, siehe Kommentar oben) ==="
else
  if [[ "$WITH_HARDENING" -eq 1 ]]; then
    exp_k1_tournament="$U_OWNER"      # owner_id bleibt der Eigentümer, Co-Admin-Hijack blockiert
    exp_k1_matches="$U_OWNER"
    exp_k2_role_escalation="denied"
    exp_k2_tournament_hijack="denied"
  else
    exp_k1_tournament="$U_COADMIN"    # Hijack gelingt — das IST die Lücke, die K1 schließt
    exp_k1_matches="$U_COADMIN"
    exp_k2_role_escalation="allowed"
    exp_k2_tournament_hijack="allowed"
  fi
  # Von der Härtung unberührt, in beiden Modi gleich:
  exp_k1_secdef="$U_COADMIN"          # SECURITY-DEFINER-Übertragung funktioniert immer
  exp_k2_accept="allowed"             # Einladung annehmen ist immer legitim
  exp_k2_owner_role="allowed"         # Eigentümer verwaltet Mitarbeiter immer

  # K1-1: Co-Admin speichert tournaments (wie der optimistic-locking Save-Pfad in
  # SupabaseRepository.save(), Zeilen 203-208) mit owner_id = sich selbst im Payload.
  k1_tournament_owner_id="$(run_write_then_select "$U_COADMIN" \
    "UPDATE public.tournaments SET owner_id = '$U_COADMIN', location_name = 'K1 Test' WHERE id = '$T_MAIN';" \
    "SELECT owner_id FROM public.tournaments WHERE id = '$T_MAIN';")"

  # K1-2: Mitarbeiter setzt owner_id auf matches per direktem UPDATE (kein Upsert, kein
  # *_sync_owner-Trigger beteiligt — der läuft nur BEFORE INSERT).
  k1_matches_owner_id="$(run_write_then_select "$U_COADMIN" \
    "UPDATE public.matches SET owner_id = '$U_COADMIN', score_a = score_a + 1 WHERE id = '$M_MAIN';" \
    "SELECT owner_id FROM public.matches WHERE id = '$M_MAIN';")"

  # K1-3: Eigentümer-Übertragung über eine SECURITY-DEFINER-Funktion (Nachbau, siehe Fixtures-
  # Kommentar oben) — current_user ist innerhalb der Funktion der Funktionseigentümer
  # (postgres), nicht authenticated/anon, protect_owner_id() darf hier NICHT eingreifen.
  # DO-Block statt "SELECT fn(...)": Eine void-Funktion per SELECT aufgerufen liefert in -tA
  # trotzdem eine (leere) Ergebniszeile zurück und hängt sich als zusätzliche Zeile vor das
  # eigentliche SELECT-Ergebnis (beobachtet: "\n<uuid>" statt "<uuid>", fälschlich als
  # Abweichung gewertet). DO liefert nie Zeilen.
  k1_secdef_owner_id="$(run_write_then_select "$U_COADMIN" \
    "DO \$\$ BEGIN PERFORM public.repro_security_definer_owner_transfer('$T_MAIN', '$U_COADMIN'); END \$\$;" \
    "SELECT owner_id FROM public.tournaments WHERE id = '$T_MAIN';")"

  # K2-1: viewer setzt die eigene role auf co-admin (Rechte-Eskalation).
  k2_role_escalation="$(run_write "$U_VIEWER" \
    "UPDATE public.tournament_collaborators SET role = 'co-admin' WHERE tournament_id = '$T_MAIN' AND user_id = '$U_VIEWER';")"

  # K2-2: co-admin hängt die eigene Zeile auf ein fremdes Turnier um (T_ANON, Eigentümer
  # U_OWNER_ANON — ein voellig anderer Nutzer als U_OWNER).
  k2_tournament_hijack="$(run_write "$U_COADMIN" \
    "UPDATE public.tournament_collaborators SET tournament_id = '$T_ANON' WHERE tournament_id = '$T_MAIN' AND user_id = '$U_COADMIN';")"

  # K2-3: Eingeladener nimmt die Einladung an — exakt das Spaltenmuster der App
  # (invitationService.ts#acceptInvitation): user_id, accepted_at, use_count. Der
  # E-Mail-Claim ist nötig, damit die BESTEHENDE (unveränderte) collaborators_update_v3
  # die noch nicht beanspruchte Zeile überhaupt sichtbar macht (invite_email = auth.email()).
  k2_accept_invitation="$(run_write "$U_INVITEE" \
    "UPDATE public.tournament_collaborators SET user_id = '$U_INVITEE', accepted_at = now(), use_count = use_count + 1 WHERE id = '$C_PENDING_INVITE';" \
    "$INVITEE_EMAIL")"

  # K2-4: Eigentümer ändert die Rolle eines Mitarbeiters (bestehende, legitime Verwaltung).
  k2_owner_changes_role="$(run_write "$U_OWNER" \
    "UPDATE public.tournament_collaborators SET role = 'collaborator' WHERE tournament_id = '$T_MAIN' AND user_id = '$U_VIEWER';")"

  echo ""
  echo "=== Fixrunde 2 — K1/K2 — $MODE_LABEL ==="
  k1k2_mark_value "k1-tournament-owner-id-nach-coadmin-save   " "$k1_tournament_owner_id" "$exp_k1_tournament"
  k1k2_mark_value "k1-matches-owner-id-nach-direktem-update   " "$k1_matches_owner_id" "$exp_k1_matches"
  k1k2_mark_value "k1-security-definer-transfer-owner-id      " "$k1_secdef_owner_id" "$exp_k1_secdef"
  k1k2_mark_value "k2-viewer-rollen-eskalation                " "$k2_role_escalation" "$exp_k2_role_escalation"
  k1k2_mark_value "k2-coadmin-turnier-umhaengen                " "$k2_tournament_hijack" "$exp_k2_tournament_hijack"
  k1k2_mark_value "k2-einladung-annehmen                       " "$k2_accept_invitation" "$exp_k2_accept"
  k1k2_mark_value "k2-eigentuemer-aendert-mitarbeiter-rolle    " "$k2_owner_changes_role" "$exp_k2_owner_role"
fi

# --- 7c. Fixrunde 3 — K3 (Parent-Schlüssel tournament_collaborators) und H5 (Parent-Schlüssel
# matches/teams/match_events) sowie L5-Präzisierung (use_count). Neun Zeilen, wie vom
# Controller verlangt (task-R3-brief.md). Nur sinnvoll mit mindestens 001+002+003 eingespielt —
# dieselbe Voraussetzung wie 7b, deshalb dieselbe Bedingung und (wo dort definiert) dieselbe
# k1k2_mark_value()-Hilfsfunktion (sie ist eine plain bash-Funktion, keine Block-lokale — einmal
# in 7b definiert, bleibt sie für den Rest des Skripts aufrufbar).
if [[ "$WITH_MIGRATION" -eq 1 && "$WITH_HARDENING" -eq 1 ]]; then
  if [[ "$WITH_PARENT_KEYS" -eq 1 ]]; then
    exp_k3_hijack="denied"
    exp_k3_followup="denied"
    exp_h5_match="denied"
    exp_h5_team="denied"
    exp_h5_event="denied"
    exp_l5_bad="denied"
  else
    exp_k3_hijack="allowed"
    exp_k3_followup="allowed"
    exp_h5_match="allowed"
    exp_h5_team="allowed"
    exp_h5_event="allowed"
    exp_l5_bad="allowed"
  fi
  # Immer gleich, in beiden Modi (Regression — die neuen Trigger duerfen legitime Pfade nicht
  # anfassen):
  exp_l5_good="allowed"
  exp_owner_upsert="allowed"
  exp_owner_role_change="allowed"

  # K3: U_OWNER_ANON (Eigentümer von T_ANON) hängt die eigene Mitarbeiterzeile auf T_MAIN um
  # (Eigentümer von T_MAIN ist U_OWNER, ein anderer Nutzer). Genau Sonde P1 des
  # Abschluss-Reviewers, hier als Harness-Zeile. INSERT + Hijack-UPDATE in EINER Transaktion —
  # bricht die Exception im nachher-Modus die Transaktion ab (ON_ERROR_STOP=1, run_write() liest
  # das als "denied"), bestätigen im ohne-004-Modus beide Befehls-Tags "allowed".
  k3_hijack="$(run_write "$U_OWNER_ANON" "
    INSERT INTO public.tournament_collaborators (tournament_id,user_id,role,accepted_at) VALUES ('$T_ANON','$U_OWNER_ANON','co-admin',now());
    UPDATE public.tournament_collaborators SET tournament_id='$T_MAIN' WHERE tournament_id='$T_ANON' AND user_id='$U_OWNER_ANON';
  ")"

  # K3-Folge: dieselbe Sequenz, plus der eigentliche Übernahme-Schritt (UPDATE tournaments).
  # Eigene Zeile statt Wiederverwendung von k3_hijack, weil jeder run_write()-Aufruf in einer
  # eigenen, isolierten Transaktion läuft (Fixtures bleiben zwischen Zeilen unverändert).
  k3_followup="$(run_write "$U_OWNER_ANON" "
    INSERT INTO public.tournament_collaborators (tournament_id,user_id,role,accepted_at) VALUES ('$T_ANON','$U_OWNER_ANON','co-admin',now());
    UPDATE public.tournament_collaborators SET tournament_id='$T_MAIN' WHERE tournament_id='$T_ANON' AND user_id='$U_OWNER_ANON';
    UPDATE public.tournaments SET location_name='RLS K3 Test' WHERE id='$T_MAIN';
  ")"

  # H5: U_OWNER (Eigentümer von T_MAIN) hängt eigene matches/teams/match_events-Zeilen in T_ANON
  # (Eigentümer U_OWNER_ANON) um. Sonde P5 des Reviewers.
  h5_match="$(run_write "$U_OWNER" "UPDATE public.matches SET tournament_id='$T_ANON' WHERE id='$M_MAIN';")"
  h5_team="$(run_write "$U_OWNER" "UPDATE public.teams SET tournament_id='$T_ANON' WHERE id='$TEAM_MAIN';")"
  h5_event="$(run_write "$U_OWNER" "UPDATE public.match_events SET match_id='$M_ANON' WHERE id='$E_MAIN';")"

  # L5: Einladung annehmen — einmal mit korrektem use_count+1 (muss IMMER gelingen), einmal mit
  # unverändertem use_count (darf NUR ohne 004 gelingen — die Präzisierung aus Punkt 1 des
  # Briefs). $INVITEE_EMAIL-Claim nötig, damit die noch nicht beanspruchte Zeile überhaupt
  # sichtbar ist (invite_email-Zweig von USING).
  l5_good="$(run_write "$U_INVITEE" \
    "UPDATE public.tournament_collaborators SET user_id='$U_INVITEE', accepted_at=now(), use_count=use_count+1 WHERE id='$C_PENDING_INVITE';" \
    "$INVITEE_EMAIL")"
  l5_bad="$(run_write "$U_INVITEE" \
    "UPDATE public.tournament_collaborators SET user_id='$U_INVITEE', accepted_at=now(), use_count=use_count WHERE id='$C_PENDING_INVITE';" \
    "$INVITEE_EMAIL")"

  # Regression: Eigentümer-Upsert (App-Pfad SupabaseRepository.save(), gleiches Muster wie Sonde
  # P3a/P3b) und Eigentümer ändert eine Mitarbeiter-Rolle müssen in BEIDEN Modi weiter gelingen.
  owner_upsert="$(run_write "$U_OWNER" "
    INSERT INTO public.teams (id,tournament_id,name,owner_id) VALUES ('$TEAM_MAIN','$T_MAIN','RLS Matrix Team (upsert)','$U_OWNER') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name;
    INSERT INTO public.matches (id,tournament_id,round,field,owner_id) VALUES ('$M_MAIN','$T_MAIN',1,2,'$U_OWNER') ON CONFLICT (id) DO UPDATE SET field=EXCLUDED.field;
  ")"
  owner_role_change="$(run_write "$U_OWNER" "UPDATE public.tournament_collaborators SET role='trainer' WHERE tournament_id='$T_MAIN' AND user_id='$U_VIEWER';")"

  echo ""
  echo "=== Fixrunde 3 — K3/H5/L5 — $MODE_LABEL ==="
  k1k2_mark_value "k3-eigentuemer-haengt-eigene-zeile-auf-fremdes-turnier   " "$k3_hijack" "$exp_k3_hijack"
  k1k2_mark_value "k3-folge-update-tournaments-nach-hijack                 " "$k3_followup" "$exp_k3_followup"
  k1k2_mark_value "h5-eigentuemer-haengt-eigenes-match-um                  " "$h5_match" "$exp_h5_match"
  k1k2_mark_value "h5-eigentuemer-haengt-eigenes-team-um                   " "$h5_team" "$exp_h5_team"
  k1k2_mark_value "h5-eigentuemer-haengt-eigenes-ereignis-um               " "$h5_event" "$exp_h5_event"
  k1k2_mark_value "l5-annahme-mit-use-count-plus-1                        " "$l5_good" "$exp_l5_good"
  k1k2_mark_value "l5-annahme-mit-use-count-unveraendert                  " "$l5_bad" "$exp_l5_bad"
  k1k2_mark_value "regression-eigentuemer-upsert-teams-matches            " "$owner_upsert" "$exp_owner_upsert"
  k1k2_mark_value "regression-eigentuemer-aendert-mitarbeiter-rolle       " "$owner_role_change" "$exp_owner_role_change"
else
  echo ""
  echo "=== Fixrunde 3 — K3/H5/L5 — übersprungen (WITH_MIGRATION=0 oder WITH_HARDENING=0, siehe Kommentar oben) ==="
fi

# --- 7c2. R5 (task-R5-brief.md) — H4 (Co-Admin-Upsert teams/matches), M3 (Teams-Rollenfilter),
# M4 (Kaskade folgt Co-Admin-Publish), M5 (deleted_at nur Eigentümer), plus K3-Lehre (der neue
# Co-Admin-INSERT-Zweig darf keinen Weg in ein fremdes Turnier öffnen). Dreizehn Zeilen. Nur
# sinnvoll mit mindestens 001+003+20260923_001 eingespielt (dieselbe Voraussetzung wie 7c: teams_
# update_v3 spiegelt den Rollenfilter, den 001 für matches_update_v3 eingeführt hat, und die
# tournamentSettings-Fähigkeit eines Co-Admin — Voraussetzung für die H4/M5-Zeilen — kommt
# ebenfalls erst mit 001).
if [[ "$WITH_MIGRATION" -eq 1 && "$WITH_HARDENING" -eq 1 && "$WITH_PARENT_KEYS" -eq 1 ]]; then
  if [[ "$WITH_R5" -eq 1 ]]; then
    exp_h4_team_upsert="allowed"
    exp_h4_match_upsert="allowed"
    exp_h4_new_team_owner="$U_OWNER"
    exp_m3_collab_upsert="denied"
    exp_m3_viewer_update="denied"
    exp_m3_trainer_update="denied"
    exp_m5_coadmin_sets_deleted_at="denied"
    exp_m4_sponsor_public="t"
    exp_m4_monitor_public="t"
    exp_k3_lehre_foreign_insert="denied"
    # R5-H1 (Auflage aus dem R5-Review, jetzt behoben über das Recht 'restructure'): Co-Admin darf
    # jetzt auch LÖSCHEN, nicht nur anlegen — genau die Symmetrie, die vorher fehlte.
    exp_h1_coadmin_delete_team="allowed"
    exp_h1_coadmin_delete_match="allowed"
  else
    exp_h4_team_upsert="denied"
    exp_h4_match_upsert="denied"
    exp_h4_new_team_owner="denied"
    exp_m3_collab_upsert="denied" # H4-Baseline: teams_insert_v2 war IMMER schon owner-only,
                                   # unabhängig von R5 (collaborator war da nie zugelassen).
    exp_m3_viewer_update="allowed"  # Baseline-Bug (M3): teams_update_v3 hatte KEINEN Rollenfilter.
    exp_m3_trainer_update="allowed"
    exp_m5_coadmin_sets_deleted_at="allowed" # tournaments_update_v3 (001) lässt Co-Admin schon
                                              # ALLE Spalten schreiben, ohne R5 auch deleted_at.
    exp_m4_sponsor_public="f"
    exp_m4_monitor_public="f"
    exp_k3_lehre_foreign_insert="denied" # unverändert: schon die Baseline-Owner-Prüfung lehnt ab.
    # R5-H1: ohne die Migration hatten teams_delete_v2/matches_delete_v2 GAR KEINEN
    # Mitarbeiter-Zweig — genau die Lücke, die den stillen Datenfehler verursachte.
    exp_h1_coadmin_delete_team="denied"
    exp_h1_coadmin_delete_match="denied"
  fi
  # Regressionen, in BEIDEN Modi gleich (M3 lässt collaborator UPDATE unverändert zu — das war
  # schon vor R5 so, siehe Baseline-Bug oben):
  exp_m3_collab_update="allowed"
  exp_m5_coadmin_unchanged_deleted_at="allowed"
  exp_m5_owner_sets_deleted_at="allowed"
  # R5-H1-Regression: Collaborator durfte NIE löschen — weder vor noch nach R5b (kein
  # 'restructure' in keiner Fassung der Tabelle). Dieselbe Sonde in BEIDEN Modi.
  exp_h1_collab_delete_team_denied="denied"
  # N4 (task-R5b-brief.md): Eigentümer eines ANDEREN Turniers (T_ANON) als Angreifer gegen T_MAIN
  # — in BEIDEN Modi abgelehnt, unabhängig von R5b (diese Angriffsklasse ist älter, siehe K3/H5).
  exp_n4_upsert_foreign_id="denied"
  exp_n4_insert_foreign_tournament="denied"
  exp_n4_delete_foreign_rows="denied"
  # manageMembers (R5b, neues Recht — aber die Grenze selbst ist unverändert seit K1/K2/M6:
  # tournament_collaborators-INSERT verlangte immer schon user_owns_tournament()). Co-Admin
  # bekommt es in KEINER Fassung der Tabelle zugewiesen, der Eigentümer hat es immer.
  exp_managemembers_coadmin_denied="denied"
  exp_managemembers_owner_allowed="allowed"

  # H4-1/H4-2: Co-Admin upserted eine BESTEHENDE teams-/matches-Zeile, exakt das Muster von
  # SupabaseRepository.save() ("INSERT ... ON CONFLICT (id) DO UPDATE") — nicht nur ein reines
  # UPDATE, siehe Kopfkommentar dieses Skripts ("Sonden bilden den echten App-Pfad nach").
  h4_team_upsert="$(run_write "$U_COADMIN" \
    "INSERT INTO public.teams (id,tournament_id,name) VALUES ('$TEAM_MAIN','$T_MAIN','RLS Matrix Team (coadmin upsert)') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;")"
  h4_match_upsert="$(run_write "$U_COADMIN" \
    "INSERT INTO public.matches (id,tournament_id,round,field) VALUES ('$M_MAIN','$T_MAIN',1,1) ON CONFLICT (id) DO UPDATE SET field = EXCLUDED.field;")"

  # H4-3: Co-Admin legt ein NEUES Team an (reiner INSERT-Zweig, TEAM_NEW existiert vorher nicht)
  # und der tatsächlich gespeicherte owner_id-Wert wird gelesen — teams_select_v3 hat einen
  # Mitarbeiter-Zweig, der Co-Admin kann die eigene neue Zeile also direkt lesen (anders als bei
  # sponsors/monitors weiter unten). ERROR:... (Transaktion abgebrochen, INSERT verweigert) wird
  # auf "denied" normalisiert, damit derselbe erwartete Wert in beiden Modi vergleichbar ist.
  h4_new_team_owner="$(run_write_then_select "$U_COADMIN" \
    "INSERT INTO public.teams (id,tournament_id,name) VALUES ('$TEAM_NEW','$T_MAIN','RLS Matrix Team (coadmin insert)') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;" \
    "SELECT owner_id FROM public.teams WHERE id = '$TEAM_NEW';")"
  [[ "$h4_new_team_owner" == ERROR:* ]] && h4_new_team_owner="denied"

  # M3: collaborator upserted TEAM_MAIN (trifft den INSERT-Zweig von teams_insert_v2 — der lässt
  # NUR co-admin zu, collaborator bleibt hier in BEIDEN Modi verweigert) vs. collaborator UPDATEt
  # TEAM_MAIN rein (kein ON CONFLICT — trifft nur teams_update_v3, das M3 rollenfiltert).
  m3_collab_upsert="$(run_write "$U_COLLAB" \
    "INSERT INTO public.teams (id,tournament_id,name) VALUES ('$TEAM_MAIN','$T_MAIN','RLS Matrix Team (collab upsert)') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;")"
  m3_collab_update="$(run_write "$U_COLLAB" "UPDATE public.teams SET name = 'RLS Matrix Team (collab update)' WHERE id = '$TEAM_MAIN';")"
  m3_viewer_update="$(run_write "$U_VIEWER" "UPDATE public.teams SET name = 'RLS Matrix Team (viewer update)' WHERE id = '$TEAM_MAIN';")"
  m3_trainer_update="$(run_write "$U_TRAINER" "UPDATE public.teams SET name = 'RLS Matrix Team (trainer update)' WHERE id = '$TEAM_MAIN';")"

  # M5: Co-Admin setzt deleted_at (echte Änderung, NULL -> now()) vs. Co-Admin speichert mit
  # UNVERÄNDERTEM deleted_at (NULL -> NULL, wie mapTournamentToSupabase es bei jedem save()
  # ungefragt mitschickt) vs. Eigentümer setzt deleted_at (muss immer gelingen).
  m5_coadmin_sets_deleted_at="$(run_write "$U_COADMIN" "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_MAIN';")"
  m5_coadmin_unchanged_deleted_at="$(run_write "$U_COADMIN" "UPDATE public.tournaments SET deleted_at = NULL, location_name = 'RLS Matrix R5 unchanged' WHERE id = '$T_MAIN';")"
  m5_owner_sets_deleted_at="$(run_write "$U_OWNER" "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_MAIN';")"

  # M4: Co-Admin veröffentlicht T_MAIN, danach RESET ROLE (zurück auf den Superuser der Session)
  # und Lesen des TATSÄCHLICH gespeicherten is_public-Werts von sponsors/monitors —
  # sponsors_select_v3/monitors_select_v3 haben KEINEN Mitarbeiter-Zweig (nur owner_id=self ODER
  # is_public=true), ein Co-Admin könnte den Erfolg der Kaskade über die eigene Rolle also gar
  # nicht zuverlässig beobachten. RESET ROLE ist Standard-Postgres (setzt für den Rest der
  # Transaktion auf die Session-Authorization zurück, hier "postgres", Superuser, umgeht RLS
  # vollständig) — dasselbe current_user/session_user-Prinzip, das 003/20260923_001 bereits für
  # SECURITY-DEFINER-Funktionen dokumentieren, hier nur ohne eigene Funktion. Nie committet (wie
  # jeder andere Versuch in diesem Skript) — T_MAIN bleibt für nachfolgende Zeilen unveröffentlicht.
  set +e
  m4_publish_out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$U_COADMIN';
UPDATE public.tournaments SET is_public = true WHERE id = '$T_MAIN';
RESET ROLE;
SELECT is_public FROM public.sponsors WHERE id = '$SPONSOR_MAIN';
SELECT is_public FROM public.monitors WHERE id = '$MONITOR_MAIN';
SQL
)"
  m4_publish_ec=$?
  set -e
  if [[ "$m4_publish_ec" -ne 0 ]]; then
    m4_sponsor_public="ERROR:$m4_publish_out"
    m4_monitor_public="ERROR:$m4_publish_out"
  else
    m4_sponsor_public="$(sed -n '1p' <<<"$m4_publish_out")"
    m4_monitor_public="$(sed -n '2p' <<<"$m4_publish_out")"
  fi

  # K3-Lehre: U_COADMIN ist legitimer Co-Admin von T_MAIN — versucht, über GENAU diese Rolle
  # eine NEUE Team-Zeile mit tournament_id = T_ANON (fremd, U_COADMIN hat dort KEINE Mitgliedschaft)
  # anzulegen. Prüft direkt, ob die EXISTS-Klausel des neuen Co-Admin-Zweigs korrekt an
  # NEW.tournament_id bindet (teams.tournament_id in der WITH-CHECK-Subquery ist die Spalte der
  # einzufügenden Zeile, nicht T_MAIN) — muss in BEIDEN Modi scheitern.
  k3_lehre_foreign_insert="$(run_write "$U_COADMIN" \
    "INSERT INTO public.teams (id,tournament_id,name) VALUES ('$TEAM_ATTACK','$T_ANON','RLS Matrix Team (foreign insert attempt)');")"

  # R5-H1 (Fix-Beweis): Co-Admin löscht ein bestehendes Team bzw. Match von T_MAIN — echter
  # App-Pfad (SupabaseRepository.save() löscht per ".delete().in('id', …)", ohne ON CONFLICT).
  # Collaborator dieselbe Sonde gegen ein Team → abgelehnt (kein 'restructure').
  h1_coadmin_delete_team="$(run_write "$U_COADMIN" "DELETE FROM public.teams WHERE id = '$TEAM_MAIN';")"
  h1_coadmin_delete_match="$(run_write "$U_COADMIN" "DELETE FROM public.matches WHERE id = '$M_MAIN';")"
  h1_collab_delete_team_denied="$(run_write "$U_COLLAB" "DELETE FROM public.teams WHERE id = '$TEAM_MAIN';")"

  # N4 (task-R5b-brief.md): U_OWNER_ANON ist Eigentümer von T_ANON — ein völlig fremdes Turnier
  # zu T_MAIN (Eigentümer U_OWNER). Er hat dort KEINE Mitgliedschaft. Drei Angriffe, alle über den
  # ECHTEN App-Pfad (Upsert wie save(), DELETE wie save()):
  #   - Upsert mit fremder id: ON CONFLICT trifft die BESTEHENDE Opfer-Zeile TEAM_MAIN — die
  #     UPDATE-USING-Klausel muss greifen (nicht die INSERT-WITH-CHECK, die für sein eigenes
  #     tournament_id im Payload sogar durchginge), siehe R5-Review Sonde A1/A2.
  #   - INSERT mit fremder tournament_id: eine NEUE Zeile, direkt gegen T_MAIN gerichtet.
  #   - DELETE fremder Zeilen: dieselbe Opfer-Zeile TEAM_MAIN.
  n4_upsert_foreign_id="$(run_write "$U_OWNER_ANON" \
    "INSERT INTO public.teams (id,tournament_id,name,owner_id) VALUES ('$TEAM_MAIN','$T_ANON','RLS Matrix N4 Hijack','$U_OWNER_ANON') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;")"
  n4_insert_foreign_tournament="$(run_write "$U_OWNER_ANON" \
    "INSERT INTO public.teams (id,tournament_id,name) VALUES ('$TEAM_N4_INSERT','$T_MAIN','RLS Matrix N4 Insert');")"
  n4_delete_foreign_rows="$(run_write "$U_OWNER_ANON" "DELETE FROM public.teams WHERE id = '$TEAM_MAIN';")"

  # manageMembers (R5b): Co-Admin versucht, einen neuen Mitarbeiter in T_MAIN einzuladen (echter
  # App-Pfad, invitationService.ts#createInvitation-Muster) → muss abgelehnt bleiben. Eigentümer
  # dieselbe Sonde → muss gelingen.
  managemembers_coadmin_denied="$(run_write "$U_COADMIN" \
    "INSERT INTO public.tournament_collaborators (id, tournament_id, invite_code, invite_email, role, invited_by, max_uses) VALUES ('$(uuid_for invite:n4-coadmin)', '$T_MAIN', 'RLSCOADMININV', 'nobody-coadmin@rls-matrix.test', 'viewer', '$U_COADMIN', 5);")"
  managemembers_owner_allowed="$(run_write "$U_OWNER" \
    "INSERT INTO public.tournament_collaborators (id, tournament_id, invite_code, invite_email, role, invited_by, max_uses) VALUES ('$(uuid_for invite:n4-owner)', '$T_MAIN', 'RLSOWNERINV', 'nobody-owner@rls-matrix.test', 'viewer', '$U_OWNER', 5);")"

  echo ""
  echo "=== R5b — zentrale Rechtetabelle (H4/M3/M4/M5, R5-H1, N4, manageMembers) — $MODE_LABEL ==="
  k1k2_mark_value "h4-coadmin-upsert-bestehendes-team                     " "$h4_team_upsert" "$exp_h4_team_upsert"
  k1k2_mark_value "h4-coadmin-upsert-bestehendes-match                    " "$h4_match_upsert" "$exp_h4_match_upsert"
  k1k2_mark_value "h4-coadmin-insert-neues-team-owner-id                  " "$h4_new_team_owner" "$exp_h4_new_team_owner"
  k1k2_mark_value "m3-collaborator-upsert-team-insert-zweig-nur-coadmin   " "$m3_collab_upsert" "$exp_m3_collab_upsert"
  k1k2_mark_value "regression-m3-collaborator-update-team                 " "$m3_collab_update" "$exp_m3_collab_update"
  k1k2_mark_value "m3-viewer-update-team                                  " "$m3_viewer_update" "$exp_m3_viewer_update"
  k1k2_mark_value "m3-trainer-update-team                                 " "$m3_trainer_update" "$exp_m3_trainer_update"
  k1k2_mark_value "m5-coadmin-setzt-deleted-at                            " "$m5_coadmin_sets_deleted_at" "$exp_m5_coadmin_sets_deleted_at"
  k1k2_mark_value "m5-coadmin-speichert-unveraendertes-deleted-at         " "$m5_coadmin_unchanged_deleted_at" "$exp_m5_coadmin_unchanged_deleted_at"
  k1k2_mark_value "m5-eigentuemer-setzt-deleted-at                        " "$m5_owner_sets_deleted_at" "$exp_m5_owner_sets_deleted_at"
  k1k2_mark_value "m4-coadmin-publish-sponsors-is-public                  " "$m4_sponsor_public" "$exp_m4_sponsor_public"
  k1k2_mark_value "m4-coadmin-publish-monitors-is-public                  " "$m4_monitor_public" "$exp_m4_monitor_public"
  k1k2_mark_value "k3-lehre-coadmin-insert-team-in-fremdes-turnier        " "$k3_lehre_foreign_insert" "$exp_k3_lehre_foreign_insert"
  k1k2_mark_value "r5h1-coadmin-loescht-bestehendes-team                  " "$h1_coadmin_delete_team" "$exp_h1_coadmin_delete_team"
  k1k2_mark_value "r5h1-coadmin-loescht-bestehendes-match                 " "$h1_coadmin_delete_match" "$exp_h1_coadmin_delete_match"
  k1k2_mark_value "r5h1-regression-collaborator-loescht-team-abgelehnt    " "$h1_collab_delete_team_denied" "$exp_h1_collab_delete_team_denied"
  k1k2_mark_value "n4-fremder-eigentuemer-upsert-mit-fremder-id           " "$n4_upsert_foreign_id" "$exp_n4_upsert_foreign_id"
  k1k2_mark_value "n4-fremder-eigentuemer-insert-mit-fremder-tournament_id" "$n4_insert_foreign_tournament" "$exp_n4_insert_foreign_tournament"
  k1k2_mark_value "n4-fremder-eigentuemer-delete-fremder-zeilen           " "$n4_delete_foreign_rows" "$exp_n4_delete_foreign_rows"
  k1k2_mark_value "managemembers-coadmin-invite-abgelehnt                 " "$managemembers_coadmin_denied" "$exp_managemembers_coadmin_denied"
  k1k2_mark_value "managemembers-eigentuemer-invite-erlaubt               " "$managemembers_owner_allowed" "$exp_managemembers_owner_allowed"
else
  echo ""
  echo "=== R5b — übersprungen (WITH_MIGRATION=0 oder WITH_HARDENING=0 oder WITH_PARENT_KEYS=0, siehe Kommentar oben) ==="
fi

# --- 7c3. R5b (task-R5b-brief.md, Abschnitt 4) — Gleichlauf: public.role_permissions (DB) MUSS
# byte-/zeilengleich zu rolePermissions.json (App) sein. Nur sinnvoll, wenn die Tabelle existiert
# (WITH_R5=1) -- ohne die Migration gibt es "public.role_permissions" schlicht nicht.
if [[ "$WITH_R5" -eq 1 ]]; then
  echo ""
  echo "=== Gleichlauf role_permissions (DB) vs. rolePermissions.json — $MODE_LABEL ==="
  DB_ROLE_PERMISSIONS="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
    "SELECT role || '|' || permission FROM public.role_permissions ORDER BY role, permission;" | sort)"
  JSON_ROLE_PERMISSIONS="$(jq -r '.roles | to_entries[] | .key as $role | .value[] | $role + "|" + .' "$ROLE_PERMISSIONS_FILE" | sort)"
  TOTAL=$((TOTAL + 1))
  if [[ "$DB_ROLE_PERMISSIONS" == "$JSON_ROLE_PERMISSIONS" ]]; then
    ROW_COUNT="$(wc -l <<<"$JSON_ROLE_PERMISSIONS" | tr -d ' ')"
    echo "gleichlauf-role_permissions-vs-json: allowed (identisch, $ROW_COUNT Zeilen)"
  else
    echo "gleichlauf-role_permissions-vs-json: denied (weicht ab)"
    echo "--- Diff (links: rolePermissions.json, rechts: DB) ---"
    diff <(echo "$JSON_ROLE_PERMISSIONS") <(echo "$DB_ROLE_PERMISSIONS") || true
    MISMATCHES=$((MISMATCHES + 1))
  fi
fi

# --- 7c4. B2 (task-B2-brief.md, Abschnitt 2) — Gleichlauf: public.match_transitions (DB) MUSS
# byte-/zeilengleich zu src/core/match/matchTransitions.json sein. Analog 7c3. Nur sinnvoll, wenn
# MATCH_EVENT_LOG_FILE eingespielt wurde (an WITH_R5 gebunden, siehe Kommentar an dessen
# Anwendung oben).
if [[ "$WITH_R5" -eq 1 ]]; then
  echo ""
  echo "=== Gleichlauf match_transitions (DB) vs. matchTransitions.json — $MODE_LABEL ==="
  DB_MATCH_TRANSITIONS="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
    "SELECT from_status || '|' || event_type || '|' || actor || '|' || to_status FROM public.match_transitions ORDER BY 1;" | sort)"
  JSON_MATCH_TRANSITIONS="$(jq -r '.transitions[] | [.from,.type,.actor,.to] | join("|")' "$MATCH_TRANSITIONS_FILE" | sort)"
  TOTAL=$((TOTAL + 1))
  if [[ "$DB_MATCH_TRANSITIONS" == "$JSON_MATCH_TRANSITIONS" ]]; then
    ROW_COUNT="$(wc -l <<<"$JSON_MATCH_TRANSITIONS" | tr -d ' ')"
    echo "gleichlauf-match_transitions-vs-json: allowed (identisch, $ROW_COUNT Zeilen)"
  else
    echo "gleichlauf-match_transitions-vs-json: denied (weicht ab)"
    echo "--- Diff (links: matchTransitions.json, rechts: DB) ---"
    diff <(echo "$JSON_MATCH_TRANSITIONS") <(echo "$DB_MATCH_TRANSITIONS") || true
    MISMATCHES=$((MISMATCHES + 1))
  fi
fi

# --- 7d. R6 (task-R6-brief.md) — F3 (E-Mail-Adressen öffentlich lesbar) und F7 (Rolle selbst
# änderbar). Läuft IMMER (unabhängig von WITH_MIGRATION/WITH_HARDENING/WITH_PARENT_KEYS) — die
# Profile-Rechte sind orthogonal zur Tournament-/Collaborator-Härtung der Fixrunden 1-3. Nutzt
# U_OWNER (Profil existiert dank des in Schritt 2 nachgebauten on_auth_user_created-Triggers,
# E-Mail 'owner@rls-matrix.test', auth_provider 'email') und U_COADMIN als "fremder" Leser.
run_select_as() {
  local role="$1" user_id="$2" sql="$3" email_claim="${4:-}"
  local out ec
  local sub_line="" email_line=""
  [[ -n "$user_id" ]] && sub_line="SET LOCAL request.jwt.claim.sub = '$user_id';"
  [[ -n "$email_claim" ]] && email_line="SET LOCAL request.jwt.claim.email = '$email_claim';"
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE $role;
$sub_line
$email_line
$sql
SQL
)"
  ec=$?
  set -e
  if [[ $ec -ne 0 || -z "$out" ]]; then
    echo "denied"
  else
    echo "allowed"
  fi
}

# Gibt den ROHEN Rückgabewert der RPC zurück statt allowed/denied — "NULL" für eine leere
# (aber fehlerfreie) Antwort, "Funktion fehlt" wenn die Funktion (noch) nicht existiert
# (--without-r6), sonst den Text nach "ERROR:" für alles andere Unerwartete.
run_rpc_value() {
  local sql="$1"
  local out ec
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE anon;
$sql
SQL
)"
  ec=$?
  set -e
  if [[ $ec -ne 0 ]]; then
    if grep -q "does not exist" <<<"$out"; then
      echo "Funktion fehlt"
    else
      echo "ERROR:$out"
    fi
  elif [[ -z "$out" ]]; then
    echo "NULL"
  else
    echo "$out"
  fi
}

if [[ "$WITH_R6" -eq 1 ]]; then
  exp_r6_anon_email="denied"
  exp_r6_auth_foreign_email="denied"
  exp_r6_auth_own_email="denied"
  # Fixrunde 1 (M1): anon verliert JEDES Recht auf profiles (vorher: id/display_name/avatar_url
  # erlaubt). Beleg im Report, dass kein funktionierender App-Pfad das braucht.
  exp_r6_anon_id_name="denied"
  exp_r6_anon_filter_email="denied"
  exp_r6_auth_update_role="denied"
  exp_r6_auth_update_display_name="allowed"
  exp_r6_rpc_known="email"
  exp_r6_rpc_unknown="NULL"
  # Fixrunde 1 (M1): profiles_select_all (USING true) → profiles_select_related.
  exp_r6_own_profile="allowed"
  exp_r6_stranger_sees_member="denied"
  exp_r6_invitee_sees_inviter_pending="allowed"
  exp_r6_invitee_sees_inviter_accepted="allowed"
  # Fixrunde 2 (Ruling K): Regel (iii) "Eigentümer sieht Mitglied" ENTFÄLLT ersatzlos — kein
  # App-Pfad braucht sie (useTournamentMembers.ts liest Mitgliedernamen über das deprecated
  # localStorage-getUserById, nie über profiles). Deshalb jetzt "denied", nicht mehr "allowed"
  # wie nach Fixrunde 1.
  exp_r6_owner_sees_member="denied"
  exp_r6_member_sees_owner="allowed"
  # Fixrunde 2 (Ruling K): Ein Angreifer mit EIGENEM Turnier (collaborators_insert_v3 verlangt
  # nur user_owns_tournament) darf dort beliebige invited_by/user_id-Werte einfügen —
  # Fixrunde-1-Regel (ii) prüfte nicht, ob die Zeile in einem Turnier DES OPFERS liegt. Beide
  # Angriffe müssen jetzt ins Leere laufen.
  exp_r6_attack_fake_invited_by="denied"
  exp_r6_attack_forced_membership="denied"
else
  exp_r6_anon_email="allowed"
  exp_r6_auth_foreign_email="allowed"
  exp_r6_auth_own_email="allowed"
  exp_r6_anon_id_name="allowed"
  exp_r6_anon_filter_email="allowed"
  exp_r6_auth_update_role="allowed"
  exp_r6_auth_update_display_name="allowed"
  exp_r6_rpc_known="Funktion fehlt"
  exp_r6_rpc_unknown="Funktion fehlt"
  # Vorher (profiles_select_all USING true): JEDE authenticated Person sieht JEDES Profil —
  # das IST die Lücke, die M1 schließt. Auch die beiden Ruling-K-Angriffszeilen sind hier
  # "allowed" — nicht weil der jeweilige INSERT etwas bewirkt, sondern weil VOR R6 ohnehin
  # jedes Profil für jeden sichtbar ist (dieselbe Lücke, aus der Warte von Ruling K gemessen).
  exp_r6_own_profile="allowed"
  exp_r6_stranger_sees_member="allowed"
  exp_r6_invitee_sees_inviter_pending="allowed"
  exp_r6_invitee_sees_inviter_accepted="allowed"
  exp_r6_owner_sees_member="allowed"
  exp_r6_member_sees_owner="allowed"
  exp_r6_attack_fake_invited_by="allowed"
  exp_r6_attack_forced_membership="allowed"
fi
exp_r6_handle_new_user="Profil angelegt"

r6_anon_email="$(run_select_as anon "" "SELECT email FROM public.profiles WHERE id = '$U_OWNER';")"
r6_auth_foreign_email="$(run_select_as authenticated "$U_COADMIN" "SELECT email FROM public.profiles WHERE id = '$U_OWNER';")"
r6_auth_own_email="$(run_select_as authenticated "$U_OWNER" "SELECT email FROM public.profiles WHERE id = '$U_OWNER';")"
r6_anon_id_name="$(run_select_as anon "" "SELECT id, display_name FROM public.profiles WHERE id = '$U_OWNER';")"
r6_anon_filter_email="$(run_select_as anon "" "SELECT id FROM public.profiles WHERE email = 'owner@rls-matrix.test';")"
r6_auth_update_role="$(run_write "$U_OWNER" "UPDATE public.profiles SET role = 'admin' WHERE id = '$U_OWNER';")"
r6_auth_update_display_name="$(run_write "$U_OWNER" "UPDATE public.profiles SET display_name = 'RLS Matrix Owner' WHERE id = '$U_OWNER';")"
r6_rpc_known="$(run_rpc_value "SELECT public.auth_provider_for_email('owner@rls-matrix.test');")"
r6_rpc_unknown="$(run_rpc_value "SELECT public.auth_provider_for_email('nobody-r6@rls-matrix.test');")"

# M1-Zeilen (Fixrunde 1): "Das eigene Profil bleibt lesbar" nutzt exakt AuthContext.tsx#fetchProfile
# (display_name, avatar_url, role, eigene id). Alle anderen nutzen bestehende Fixtures: U_NONMEMBER
# hat KEINE Zeile in tournament_collaborators (kein Bezug zu irgendwem); U_VIEWER ist akzeptiertes
# Mitglied von T_MAIN (Eigentümer U_OWNER); C_PENDING_INVITE/U_INVITEE für Regel (ii).
r6_own_profile="$(run_select_as authenticated "$U_OWNER" "SELECT display_name, avatar_url, role FROM public.profiles WHERE id = '$U_OWNER';")"
r6_stranger_sees_member="$(run_select_as authenticated "$U_NONMEMBER" "SELECT display_name FROM public.profiles WHERE id = '$U_VIEWER';")"
r6_invitee_sees_inviter_pending="$(run_select_as authenticated "$U_INVITEE" "SELECT display_name FROM public.profiles WHERE id = '$U_OWNER';" "$INVITEE_EMAIL")"
r6_owner_sees_member="$(run_select_as authenticated "$U_OWNER" "SELECT display_name FROM public.profiles WHERE id = '$U_VIEWER';")"
r6_member_sees_owner="$(run_select_as authenticated "$U_VIEWER" "SELECT display_name FROM public.profiles WHERE id = '$U_OWNER';")"

# "nach Annahme" kann keine Fixture sein (die Annahme selbst ist die Zustandsänderung) — Annahme
# und Sichtbarkeitsprüfung laufen deshalb in DERSELBEN, nie committeten Transaktion (Muster wie
# run_write_then_select() weiter oben), damit die Fixtures für andere Zeilen unverändert bleiben.
# set +e/-e wie in den run_*()-Helfern: eine scheiternde Anweisung hier darf den Lauf nicht per
# "set -e" sofort abbrechen, sie soll als "denied" gewertet werden.
set +e
r6_invitee_accept_and_read_out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$U_INVITEE';
SET LOCAL request.jwt.claim.email = '$INVITEE_EMAIL';
UPDATE public.tournament_collaborators SET user_id = '$U_INVITEE', accepted_at = now(), use_count = use_count + 1 WHERE id = '$C_PENDING_INVITE';
SELECT display_name FROM public.profiles WHERE id = '$U_OWNER';
SQL
)"
r6_invitee_accept_and_read_ec=$?
set -e
if [[ "$r6_invitee_accept_and_read_ec" -ne 0 || -z "$r6_invitee_accept_and_read_out" ]]; then
  r6_invitee_sees_inviter_accepted="denied"
else
  r6_invitee_sees_inviter_accepted="allowed"
fi

# Fixrunde 2 (Ruling K) — zwei Angriffszeilen. U_PUBLIC_OWNER besitzt T_PUBLIC (eigenes Turnier,
# "collaborators_insert_v3" lässt ihn dort per user_owns_tournament(T_PUBLIC) einfügen) und
# versucht, über eine dort selbst eingefügte Zeile das Profil von U_OWNER (kein Bezug zu
# U_PUBLIC_OWNER/T_PUBLIC) sichtbar zu machen. INSERT + SELECT in EINER, nie committeten
# Transaktion (Muster wie oben bei "nach Annahme").
set +e
r6_attack_fake_invited_by_out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$U_PUBLIC_OWNER';
INSERT INTO public.tournament_collaborators (tournament_id, user_id, invited_by, role, accepted_at)
VALUES ('$T_PUBLIC', '$U_PUBLIC_OWNER', '$U_OWNER', 'collaborator', now());
SELECT display_name FROM public.profiles WHERE id = '$U_OWNER';
SQL
)"
r6_attack_fake_invited_by_ec=$?
set -e
if [[ "$r6_attack_fake_invited_by_ec" -ne 0 || -z "$r6_attack_fake_invited_by_out" ]]; then
  r6_attack_fake_invited_by="denied"
else
  r6_attack_fake_invited_by="allowed"
fi

set +e
r6_attack_forced_membership_out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$U_PUBLIC_OWNER';
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at)
VALUES ('$T_PUBLIC', '$U_OWNER', 'collaborator', now());
SELECT display_name FROM public.profiles WHERE id = '$U_OWNER';
SQL
)"
r6_attack_forced_membership_ec=$?
set -e
if [[ "$r6_attack_forced_membership_ec" -ne 0 || -z "$r6_attack_forced_membership_out" ]]; then
  r6_attack_forced_membership="denied"
else
  r6_attack_forced_membership="allowed"
fi

# Regression, unabhängig von WITH_R6: Insert in auth.users muss weiterhin ein Profil anlegen
# (der Testaufbau-Trigger aus Schritt 2, plus handle_new_user() selbst — R6 rührt an keinem von
# beiden). Eigene Transaktion, eigener frischer User (nie committet, siehe Kopfkommentar zu
# run_write() weiter oben — hier von Hand nachgebaut, weil weder run_write() noch
# run_write_then_select() ein INSERT in auth.users unterstützen).
new_user_id="$(uuid_for user:handle-new-user-probe)"
handle_new_user_count="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '$new_user_id', 'authenticated', 'authenticated', 'handle-new-user-probe@rls-matrix.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
SELECT count(*) FROM public.profiles WHERE id = '$new_user_id';
SQL
)"
r6_handle_new_user="$([[ "$handle_new_user_count" == "1" ]] && echo "Profil angelegt" || echo "Profil fehlt ($handle_new_user_count)")"

echo ""
echo "=== R6 — Profile geschützt (F3/F7) — $MODE_LABEL ==="
k1k2_mark_value "anon-select-email                          " "$r6_anon_email" "$exp_r6_anon_email"
k1k2_mark_value "authenticated-select-email-fremdes-profil  " "$r6_auth_foreign_email" "$exp_r6_auth_foreign_email"
k1k2_mark_value "authenticated-select-email-eigenes-profil  " "$r6_auth_own_email" "$exp_r6_auth_own_email"
k1k2_mark_value "anon-select-id-display-name                " "$r6_anon_id_name" "$exp_r6_anon_id_name"
k1k2_mark_value "anon-select-gefiltert-nach-email            " "$r6_anon_filter_email" "$exp_r6_anon_filter_email"
k1k2_mark_value "authenticated-update-role-eigenes-profil   " "$r6_auth_update_role" "$exp_r6_auth_update_role"
k1k2_mark_value "authenticated-update-display-name-eigenes  " "$r6_auth_update_display_name" "$exp_r6_auth_update_display_name"
k1k2_mark_value "anon-rpc-auth-provider-for-email-bekannt   " "$r6_rpc_known" "$exp_r6_rpc_known"
k1k2_mark_value "anon-rpc-auth-provider-for-email-unbekannt " "$r6_rpc_unknown" "$exp_r6_rpc_unknown"
k1k2_mark_value "regression-handle-new-user-legt-profil-an  " "$r6_handle_new_user" "$exp_r6_handle_new_user"
k1k2_mark_value "m1-eigenes-profil-bleibt-lesbar-authcontext " "$r6_own_profile" "$exp_r6_own_profile"
k1k2_mark_value "m1-fremder-sieht-kein-fremdes-profil        " "$r6_stranger_sees_member" "$exp_r6_stranger_sees_member"
k1k2_mark_value "m1-eingeladener-sieht-einladenden-vor-annahme" "$r6_invitee_sees_inviter_pending" "$exp_r6_invitee_sees_inviter_pending"
k1k2_mark_value "m1-eingeladener-sieht-einladenden-nach-annahme" "$r6_invitee_sees_inviter_accepted" "$exp_r6_invitee_sees_inviter_accepted"
k1k2_mark_value "m1-eigentuemer-sieht-mitglied-entfaellt-k2  " "$r6_owner_sees_member" "$exp_r6_owner_sees_member"
k1k2_mark_value "m1-mitglied-sieht-eigentuemer               " "$r6_member_sees_owner" "$exp_r6_member_sees_owner"
k1k2_mark_value "k-angriff-invited-by-gefaelscht-opfer-verdeckt" "$r6_attack_fake_invited_by" "$exp_r6_attack_fake_invited_by"
k1k2_mark_value "k-angriff-zwangsmitgliedschaft-opfer-verdeckt" "$r6_attack_forced_membership" "$exp_r6_attack_forced_membership"

# --- 7e. R7 (task-R7-brief.md) — widerrufene/abgelaufene Mitgliedschaft und Einladungen -----
# Nutzt U_DECLINED (accepted_at UND declined_at gesetzt auf T_MAIN, bereits von R5b-Fixrunde-1
# angelegt, siehe C_DECLINED_COADMIN oben) für die Lese-Zeilen und zwei neue Einladungs-
# Fixturen (C_DECLINED_INVITE/C_EXPIRED_INVITE, siehe Fixtures-Block) für die Annahme-Zeilen.
# Läuft IMMER (unabhängig von WITH_MIGRATION/HARDENING/PARENT_KEYS/R6/R5) — R7 ist orthogonal zu
# allen vorherigen Fixrunden, nur von WITH_R7 selbst abhängig.
if [[ "$WITH_R7" -eq 1 ]]; then
  exp_r7_declined="denied"
  exp_r7_declined_profile="denied"
  exp_r7_accept_declined="denied"
  exp_r7_accept_expired="denied"
else
  exp_r7_declined="allowed"
  exp_r7_declined_profile="allowed"
  exp_r7_accept_declined="allowed"
  exp_r7_accept_expired="allowed"
fi
# Von R7 unberührt, in beiden Modi gleich: aktive Mitgliedschaft liest weiter, eine gültige
# Einladung lässt sich weiter annehmen, ein Nicht-Mitglied liest ein öffentliches Turnier weiter.
exp_r7_active="allowed"
exp_r7_accept_valid="allowed"
exp_r7_public_nonmember="allowed"
# R7-Fixrunde 1 (N-3, final-review-2.md): "accepted_at IS NOT NULL" ist NICHT Teil von R7 selbst
# (das prüften schon die alten Baseline-Select-Policies) -- eine offene, nie angenommene
# Mitgliedschaft (U_PENDING/C_OPEN_COADMIN, role='co-admin', accepted_at IS NULL) darf in BEIDEN
# Modi kein privates Turnier lesen. DB-Mutation M1 des Reviews (diese Bedingung aus
# is_active_tournament_member() entfernt) soll GENAU diese Zeile rot färben.
exp_r7_open_membership="denied"

r7_declined_tournaments="$(run_select_as authenticated "$U_DECLINED" "SELECT id FROM public.tournaments WHERE id = '$T_MAIN';")"
r7_declined_matches="$(run_select_as authenticated "$U_DECLINED" "SELECT id FROM public.matches WHERE id = '$M_MAIN';")"
r7_declined_teams="$(run_select_as authenticated "$U_DECLINED" "SELECT id FROM public.teams WHERE id = '$TEAM_MAIN';")"
r7_declined_match_events="$(run_select_as authenticated "$U_DECLINED" "SELECT id FROM public.match_events WHERE id = '$E_MAIN';")"

r7_active_tournaments="$(run_select_as authenticated "$U_COLLAB" "SELECT id FROM public.tournaments WHERE id = '$T_MAIN';")"
r7_active_matches="$(run_select_as authenticated "$U_COLLAB" "SELECT id FROM public.matches WHERE id = '$M_MAIN';")"
r7_active_teams="$(run_select_as authenticated "$U_COLLAB" "SELECT id FROM public.teams WHERE id = '$TEAM_MAIN';")"
r7_active_match_events="$(run_select_as authenticated "$U_COLLAB" "SELECT id FROM public.match_events WHERE id = '$E_MAIN';")"
r7_active_got="$([[ "$r7_active_tournaments" == "allowed" && "$r7_active_matches" == "allowed" && "$r7_active_teams" == "allowed" && "$r7_active_match_events" == "allowed" ]] && echo "allowed" || echo "denied")"

r7_declined_sees_owner_profile="$(run_select_as authenticated "$U_DECLINED" "SELECT display_name FROM public.profiles WHERE id = '$U_OWNER';")"

r7_nonmember_reads_public="$(run_select_as authenticated "$U_NONMEMBER" "SELECT id FROM public.tournaments WHERE id = '$T_PUBLIC';")"

# R7-Fixrunde 1 (N-3): offene, nie angenommene Mitgliedschaft liest kein privates Turnier.
r7_open_membership_reads_private="$(run_select_as authenticated "$U_PENDING" "SELECT id FROM public.tournaments WHERE id = '$T_MAIN';")"

# R7-Fixrunde 1 (N-1, N-2): profile_visible_to_viewer() für eine noch OFFENE (nie angenommene)
# Einladung, einmal widerrufen (C_DECLINED_INVITE), einmal abgelaufen (C_EXPIRED_INVITE). Beide
# Fixturen haben user_id IS NULL -- Regel (b) greift nur über "invite_email = auth.email()",
# deshalb der Email-Claim als vierter run_select_as()-Parameter (Muster wie die R6-Zeilen
# "eingeladener sieht einladenden vor Annahme").
r7_declined_invite_sees_inviter="$(run_select_as authenticated "$U_DECLINED_INVITEE" "SELECT display_name FROM public.profiles WHERE id = '$U_OWNER';" "$DECLINED_INVITEE_EMAIL")"
r7_expired_invite_sees_inviter="$(run_select_as authenticated "$U_EXPIRED_INVITEE" "SELECT display_name FROM public.profiles WHERE id = '$U_OWNER';" "$EXPIRED_INVITEE_EMAIL")"

# Annahme-Sonden: exakt derselbe Update-Pfad wie k2_accept_invitation oben
# (invitationService.ts#acceptInvitation), je eigene, nie committete Transaktion (run_write()).
r7_accept_declined_invite="$(run_write "$U_DECLINED_INVITEE" \
  "UPDATE public.tournament_collaborators SET user_id = '$U_DECLINED_INVITEE', accepted_at = now(), use_count = use_count + 1 WHERE id = '$C_DECLINED_INVITE';" \
  "$DECLINED_INVITEE_EMAIL")"
r7_accept_expired_invite="$(run_write "$U_EXPIRED_INVITEE" \
  "UPDATE public.tournament_collaborators SET user_id = '$U_EXPIRED_INVITEE', accepted_at = now(), use_count = use_count + 1 WHERE id = '$C_EXPIRED_INVITE';" \
  "$EXPIRED_INVITEE_EMAIL")"
r7_accept_valid_invite="$(run_write "$U_INVITEE" \
  "UPDATE public.tournament_collaborators SET user_id = '$U_INVITEE', accepted_at = now(), use_count = use_count + 1 WHERE id = '$C_PENDING_INVITE';" \
  "$INVITEE_EMAIL")"

echo ""
echo "=== R7 — Widerrufene/abgelaufene Mitgliedschaft und Einladungen (task-R7-brief.md) — $MODE_LABEL ==="
k1k2_mark_value "widerrufenes-mitglied-liest-tournaments    " "$r7_declined_tournaments" "$exp_r7_declined"
k1k2_mark_value "widerrufenes-mitglied-liest-matches        " "$r7_declined_matches" "$exp_r7_declined"
k1k2_mark_value "widerrufenes-mitglied-liest-teams          " "$r7_declined_teams" "$exp_r7_declined"
k1k2_mark_value "widerrufenes-mitglied-liest-match_events   " "$r7_declined_match_events" "$exp_r7_declined"
k1k2_mark_value "aktives-mitglied-liest-dasselbe            " "$r7_active_got" "$exp_r7_active"
k1k2_mark_value "widerrufenes-mitglied-sieht-eigentuemer-profil" "$r7_declined_sees_owner_profile" "$exp_r7_declined_profile"
k1k2_mark_value "nicht-mitglied-liest-oeffentliches-turnier " "$r7_nonmember_reads_public" "$exp_r7_public_nonmember"
k1k2_mark_value "annahme-widerrufene-einladung              " "$r7_accept_declined_invite" "$exp_r7_accept_declined"
k1k2_mark_value "annahme-abgelaufene-einladung              " "$r7_accept_expired_invite" "$exp_r7_accept_expired"
k1k2_mark_value "annahme-gueltige-einladung                 " "$r7_accept_valid_invite" "$exp_r7_accept_valid"

echo ""
echo "--- R7-Fixrunde 1 (final-review-2.md: M-1, N-1, N-2, N-3) — $MODE_LABEL ---"
k1k2_mark_value "n3-offene-mitgliedschaft-liest-privates-turnier-nicht" "$r7_open_membership_reads_private" "$exp_r7_open_membership"
k1k2_mark_value "n1-widerrufene-offene-einladung-sieht-einladenden-nicht" "$r7_declined_invite_sees_inviter" "$exp_r7_declined_profile"
k1k2_mark_value "n2-abgelaufene-offene-einladung-sieht-einladenden-nicht" "$r7_expired_invite_sees_inviter" "$exp_r7_declined_profile"

# --- 8. Stichprobe: anonymes Lesen eines öffentlichen Turniers (inkl. seiner Ereignisse) ---
# R5b: fest im Skript verankert (nicht mehr in der JSON) -- das ist kein "Recht" aus der
# Rechtetabelle (rolePermissions.json enthält nur Schreibrechte je Rolle), sondern eine
# unabhängige Regressions-Stichprobe für anonymes LESEN öffentlicher Turniere (siehe Fixrunde-1-
# Kommentar oben). Immer "true" erwartet.
pub_expect="true"
pub_tournament="$(run_read_as_anon "SELECT id FROM public.tournaments WHERE id = '$T_PUBLIC';")"
pub_match="$(run_read_as_anon "SELECT id FROM public.matches WHERE id = '$M_PUBLIC';")"
pub_event="$(run_read_as_anon "SELECT id FROM public.match_events WHERE id = '$E_PUBLIC';")"
pub_got="$([[ "$pub_tournament" == "allowed" && "$pub_match" == "allowed" && "$pub_event" == "allowed" ]] && echo true || echo false)"
echo ""
echo "Stichprobe — anonymes Lesen eines öffentlichen Turniers: erwartet=$pub_expect, gemessen=$pub_got (tournaments=$pub_tournament, matches=$pub_match, match_events=$pub_event)"
TOTAL=$((TOTAL + 1))
if [[ "$pub_got" != "$pub_expect" ]]; then
  MISMATCHES=$((MISMATCHES + 1))
fi

echo ""
echo "=== Zusammenfassung — $MODE_LABEL: $MISMATCHES Abweichung(en) von der Rollentabelle (von $TOTAL geprüften Zellen inkl. dedizierter Prüfung, K1/K2-Härtung, K3/H5/L5-Härtung, R5b (H4/M3/M4/M5, R5-H1, N4, manageMembers), R6 (F3/F7), R7 (declined_at/expires_at) und Public-Read-Stichprobe) ==="

# --- 9. L4: CI-Gate im Default-Modus ("nachher", alle Migrationen) ------------------------
# Vorher endete dieses Skript immer mit Exit 0 ("misst, urteilt nicht") — das reicht als
# CI-Gate nicht (final-review.md, L4). Ab jetzt: im vollen Default-Modus (Baseline + 001 + 002
# + 003 + 004 + R6) beendet eine Abweichung von der Rollentabelle den Lauf mit Exit 1. Die
# Gegenprobe-Modi (--baseline-only, --without-hardening, --without-004, --without-r6) sollen
# Abweichungen zeigen dürfen, ohne dass der Lauf selbst als fehlgeschlagen gilt — dort bleibt es
# bei Exit 0.
if [[ "$WITH_MIGRATION" -eq 1 && "$WITH_HARDENING" -eq 1 && "$WITH_PARENT_KEYS" -eq 1 && "$WITH_R6" -eq 1 && "$WITH_R5" -eq 1 && "$WITH_R7" -eq 1 && "$MISMATCHES" -gt 0 ]]; then
  echo "::error::Default-Modus (nachher) hat $MISMATCHES Abweichung(en) von der Rollentabelle — CI-Gate schlägt fehl." >&2
  exit 1
fi
