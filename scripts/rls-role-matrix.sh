#!/usr/bin/env bash
#
# rls-role-matrix.sh — Misst die Schreibrechte-Matrix aus roleMatrix.json gegen eine echte
# Postgres-Instanz mit aktivem RLS. Dauerhafte Absicherung für die Rollentabelle aus
# .superpowers/sdd/2026-09-22-rechte-und-cockpit-2/task-R1-brief.md — kein Wegwerf-Skript.
#
# Was gemessen wird (nicht behauptet): Für jede Zeile aus
# src/features/auth/__tests__/roleMatrix.json (der EINEN Quelle, gemeinsam mit dem
# Vitest-Folgetask genutzt) wird ein echter auth.users-Eintrag angelegt, ggf. eine
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
# R5 (task-R5-brief.md): 20260924_002_coadmin_complete.sql schließt vier DB-Befunde aus dem
# Abschluss-Review von R2/R3 (final-review.md, Abschnitte H4/M3/M4/M5): H4 (Co-Admin-Upsert auf
# teams/matches scheitert halb -- teams_insert_v2/matches_insert_v2 bekommen einen Co-Admin-
# Zweig), M3 (teams_update_v3 bekommt denselben Rollenfilter wie matches_update_v3: nur
# co-admin/collaborator), M4 (cascade_tournament_visibility() wird SECURITY DEFINER, damit
# sponsors/monitors einem Co-Admin-Publish folgen) und M5 (neuer BEFORE-UPDATE-Trigger
# protect_deleted_at: tournaments.deleted_at nur für den Eigentümer änderbar, IS DISTINCT FROM
# schützt den Normalfall "Co-Admin speichert mit unverändertem deleted_at"). Orthogonal zu R6
# (profiles) -- läuft unabhängig von WITH_R6.
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
#                                                   # (R5) — die H4/M3/M4/M5-Zeilen müssen hier
#                                                   # den "vorher"-Zustand zeigen (Co-Admin-Upsert
#                                                   # auf teams/matches scheitert, viewer/trainer
#                                                   # dürfen Teams ändern, sponsors/monitors
#                                                   # bleiben nach Co-Admin-Publish unsichtbar,
#                                                   # Co-Admin darf deleted_at setzen), sonst
#                                                   # misst der Harness die R5-Lücken nicht.
#
# Ändert NICHTS an der Produktionsdatenbank — der Container ist eine Wegwerf-Instanz, wird am
# Ende entfernt (trap).
#
set -euo pipefail

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # muss zur Live-Postgres-Version passen
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
MIGRATION_FILES=(
  "$MIGRATIONS_DIR/20260922_001_role_based_write_policies.sql"
  "$MIGRATIONS_DIR/20260922_002_fix_match_event_version_trigger.sql"
)
HARDENING_FILE="$MIGRATIONS_DIR/20260922_003_protect_owner_and_roles.sql"
PARENT_KEYS_FILE="$MIGRATIONS_DIR/20260923_001_protect_parent_keys.sql"
MERGE_RESTRICT_FILE="$MIGRATIONS_DIR/20260923_002_restrict_merge_user_data.sql"
PROFILES_FILE="$MIGRATIONS_DIR/20260924_001_restrict_profiles.sql"
COADMIN_COMPLETE_FILE="$MIGRATIONS_DIR/20260924_002_coadmin_complete.sql"
ROLE_MATRIX_FILE="$REPO_ROOT/src/features/auth/__tests__/roleMatrix.json"
CONTAINER_NAME="rls-role-matrix-$$"
WITH_MIGRATION=1
WITH_HARDENING=1
WITH_PARENT_KEYS=1
WITH_R6=1
WITH_R5=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline-only)
      WITH_MIGRATION=0
      WITH_HARDENING=0
      WITH_PARENT_KEYS=0
      WITH_R6=0
      WITH_R5=0
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
[[ -f "$ROLE_MATRIX_FILE" ]] || { echo "::error::Rollentabelle fehlt: $ROLE_MATRIX_FILE" >&2; exit 1; }
[[ -f "$BASELINE_FILE" ]] || { echo "::error::Baseline fehlt: $BASELINE_FILE" >&2; exit 1; }
for f in "${MIGRATION_FILES[@]}"; do
  [[ -f "$f" ]] || { echo "::error::Migration fehlt: $f" >&2; exit 1; }
done
[[ -f "$HARDENING_FILE" ]] || { echo "::error::Migration fehlt: $HARDENING_FILE" >&2; exit 1; }
[[ -f "$PARENT_KEYS_FILE" ]] || { echo "::error::Migration fehlt: $PARENT_KEYS_FILE" >&2; exit 1; }
[[ -f "$MERGE_RESTRICT_FILE" ]] || { echo "::error::Migration fehlt: $MERGE_RESTRICT_FILE" >&2; exit 1; }
[[ -f "$PROFILES_FILE" ]] || { echo "::error::Migration fehlt: $PROFILES_FILE" >&2; exit 1; }
[[ -f "$COADMIN_COMPLETE_FILE" ]] || { echo "::error::Migration fehlt: $COADMIN_COMPLETE_FILE" >&2; exit 1; }

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

# R6-Testaufbau (siehe Kopfkommentar): Trigger auf auth.users existiert live, fehlt aber in
# JEDEM aus der (public-schema-only) Baseline rekonstruierten Container — unabhängig von R6.
# Ohne ihn bliebe public.profiles nach den Fixture-Inserts in auth.users unten leer, und jede
# R6-Profile-Zeile würde etwas anderes messen als beabsichtigt (fehlende Zeile statt Rechte-
# Verweigerung). Kein Teil einer committeten Migration, siehe Kopfkommentar. Läuft in JEDEM
# Modus, unabhängig von WITH_R6 — die auth.users→profiles-Kopplung ist orthogonal zu R6.
psql_stdin <<'SQL'
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
SQL

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

# R5 (task-R5-brief.md): H4 (Co-Admin-INSERT-Zweig auf teams/matches), M3 (Teams-Rollenfilter),
# M4 (cascade_tournament_visibility SECURITY DEFINER), M5 (deleted_at nur Eigentümer). Orthogonal
# zu R6 (profiles) -- läuft unabhängig von WITH_R6, nur von WITH_MIGRATION/HARDENING/
# PARENT_KEYS abhängig (siehe --baseline-only oben, das WITH_R5 mit auf 0 setzt).
if [[ "$WITH_R5" -eq 1 ]]; then
  echo "Migration einspielen: $(basename "$COADMIN_COMPLETE_FILE")" >&2
  psql_stdin < "$COADMIN_COMPLETE_FILE"
fi

if [[ "$WITH_MIGRATION" -eq 1 && "$WITH_HARDENING" -eq 1 && "$WITH_PARENT_KEYS" -eq 1 && "$WITH_R6" -eq 1 && "$WITH_R5" -eq 1 ]]; then
  MODE_LABEL="nachher (Baseline + alle sieben Migrationen)"
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

# --- 3. Vor der Matrix belegen: 44 Policies, 13 Tabellen mit RLS ----------------------
POLICY_COUNT="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
  "SELECT count(*) FROM pg_policies WHERE schemaname = 'public';")"
RLS_TABLE_COUNT="$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity;")"
echo "Policies (public): $POLICY_COUNT — Tabellen mit aktivem RLS: $RLS_TABLE_COUNT" >&2
if [[ "$POLICY_COUNT" -ne 44 || "$RLS_TABLE_COUNT" -ne 13 ]]; then
  echo "::error::Erwartung verfehlt (44 Policies, 13 RLS-Tabellen) — Baseline unvollständig eingespielt? Container-Neustart-Falle?" >&2
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
  ('00000000-0000-0000-0000-000000000000', '$U_INVITEE', 'authenticated', 'authenticated', '$INVITEE_EMAIL', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

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

INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at)
VALUES
  ('$T_MAIN', '$U_COADMIN', 'co-admin', now()),
  ('$T_MAIN', '$U_COLLAB', 'collaborator', now()),
  ('$T_MAIN', '$U_TRAINER', 'trainer', now()),
  ('$T_MAIN', '$U_VIEWER', 'viewer', now());
  -- Nicht-Mitglied ($U_NONMEMBER) bekommt bewusst KEINE Zeile.

-- Fixrunde 2 / K2: offene (unclaimed) Einladung auf T_MAIN, exakt wie
-- invitationService.ts#createInvitation sie anlegt -- user_id NULL, invite_email gesetzt,
-- accepted_at NULL, use_count 0. Wird von "eingeladener nimmt Einladung an" beansprucht.
-- Fixrunde 1 (R6, M1): "invited_by" = U_OWNER ergänzt (vorher nicht gesetzt) — wird von den
-- neuen R6-Zeilen "Eingeladener sieht Einladenden vor/nach Annahme" gebraucht
-- (profile_visible_to_viewer()-Regel (ii)). Ändert an K2/L5 nichts, die lesen die Spalte nicht.
INSERT INTO public.tournament_collaborators
  (id, tournament_id, user_id, invite_code, invite_email, role, invited_by, accepted_at, use_count, max_uses)
VALUES
  ('$C_PENDING_INVITE', '$T_MAIN', NULL, 'RLSTESTCODE', '$INVITEE_EMAIL', 'collaborator', '$U_OWNER', NULL, 0, 5);

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

echo ""
echo "=== Gemessene Matrix — $MODE_LABEL ==="
printf '%-16s | %-14s | %-18s | %-18s\n' "Rolle" "Spieldaten" "Ereignisse korr." "Turniereinstell."
printf -- '-----------------+----------------+--------------------+--------------------\n'

MISMATCHES=0
TOTAL=0

while IFS= read -r row; do
  id="$(jq -r '.id' <<<"$row")"
  membership="$(jq -r '.membership' <<<"$row")"
  authMode="$(jq -r '.authMode' <<<"$row")"
  exp_write="$(jq -r '.writeMatchData' <<<"$row")"
  exp_correct="$(jq -r '.correctEvents' <<<"$row")"
  exp_settings="$(jq -r '.tournamentSettings' <<<"$row")"

  user_id="$(uuid_for "user:$id")"
  if [[ "$membership" == "owner" && "$authMode" == "anonymous" ]]; then
    tournament_id="$T_ANON"; match_id="$M_ANON"; event_id="$E_ANON"
  else
    tournament_id="$T_MAIN"; match_id="$M_MAIN"; event_id="$E_MAIN"
  fi

  # authMode (anonym angemeldet vs. regulär) wirkt hier nur über die Fixture-Zuordnung
  # (eigenes Turnier T_ANON statt T_MAIN) — auth.uid() in diesem Image liest den flachen
  # GUC request.jwt.claim.sub, keine JSON-Claims. Keine der fünf getesteten Policies ruft
  # is_anonymous_user() auf, das Attribut ist für die Matrix dokumentarisch (roleMatrix.json).

  # writeMatchData: matches UPDATE + match_events INSERT — beide müssen übereinstimmen,
  # sonst ist die Rollentabelle intern widersprüchlich (wird unten als eigener Befund markiert).
  res_matches_update="$(run_write "$user_id" "UPDATE public.matches SET score_a = score_a + 1 WHERE id = '$match_id';")"
  res_events_insert="$(run_write "$user_id" "INSERT INTO public.match_events (match_id, type, timestamp_seconds, score_home, score_away) VALUES ('$match_id','GOAL',20,0,0);")"
  if [[ "$res_matches_update" == "allowed" && "$res_events_insert" == "allowed" ]]; then
    got_write="true"
  elif [[ "$res_matches_update" == "denied" && "$res_events_insert" == "denied" ]]; then
    got_write="false"
  else
    got_write="inconsistent($res_matches_update/$res_events_insert)"
  fi

  # correctEvents: match_events UPDATE + DELETE
  res_events_update="$(run_write "$user_id" "UPDATE public.match_events SET is_deleted = NOT is_deleted WHERE id = '$event_id';")"
  res_events_delete="$(run_write "$user_id" "DELETE FROM public.match_events WHERE id = '$event_id';")"
  if [[ "$res_events_update" == "allowed" && "$res_events_delete" == "allowed" ]]; then
    got_correct="true"
  elif [[ "$res_events_update" == "denied" && "$res_events_delete" == "denied" ]]; then
    got_correct="false"
  else
    got_correct="inconsistent($res_events_update/$res_events_delete)"
  fi

  # tournamentSettings: tournaments UPDATE
  res_tournaments_update="$(run_write "$user_id" "UPDATE public.tournaments SET location_name = 'RLS Test' WHERE id = '$tournament_id';")"
  got_settings="$([[ "$res_tournaments_update" == "allowed" ]] && echo true || echo false)"

  # mark() nur als reine Funktion (kein Kommandosubstitutions-Aufruf mit Seiteneffekt) —
  # `x="$(f)"` startet eine Subshell; Änderungen an TOTAL/MISMATCHES darin gingen sonst
  # verloren (beim ersten Anlauf dieses Skripts genau so passiert: "0 Abweichungen"
  # trotz sichtbarer "!=" in der Tabelle). Zählen passiert danach im Hauptprozess.
  mark() {
    local exp="$1" got="$2"
    if [[ "$got" == "$exp" ]]; then
      echo "$got"
    else
      echo "${got}!=${exp}"
    fi
  }

  m_write="$(mark "$exp_write" "$got_write")"
  m_correct="$(mark "$exp_correct" "$got_correct")"
  m_settings="$(mark "$exp_settings" "$got_settings")"

  for cell in "$m_write" "$m_correct" "$m_settings"; do
    TOTAL=$((TOTAL + 1))
    [[ "$cell" == *"!="* ]] && MISMATCHES=$((MISMATCHES + 1))
  done

  printf '%-16s | %-14s | %-18s | %-18s\n' "$id" "$m_write" "$m_correct" "$m_settings"
done < <(jq -c '.rows[]' "$ROLE_MATRIX_FILE")

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
  fi
  # Regressionen, in BEIDEN Modi gleich (M3 lässt collaborator UPDATE unverändert zu — das war
  # schon vor R5 so, siehe Baseline-Bug oben):
  exp_m3_collab_update="allowed"
  exp_m5_coadmin_unchanged_deleted_at="allowed"
  exp_m5_owner_sets_deleted_at="allowed"

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

  echo ""
  echo "=== R5 — Co-Admin vollständig, Teams, Löschen, Mitgliederverwaltung — $MODE_LABEL ==="
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
else
  echo ""
  echo "=== R5 — übersprungen (WITH_MIGRATION=0 oder WITH_HARDENING=0 oder WITH_PARENT_KEYS=0, siehe Kommentar oben) ==="
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

# --- 8. Stichprobe: anonymes Lesen eines öffentlichen Turniers (inkl. seiner Ereignisse) ---
pub_expect="$(jq -r '.publicRead.expectCanRead' "$ROLE_MATRIX_FILE")"
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
echo "=== Zusammenfassung — $MODE_LABEL: $MISMATCHES Abweichung(en) von der Rollentabelle (von $TOTAL geprüften Zellen inkl. dedizierter Prüfung, K1/K2-Härtung, K3/H5/L5-Härtung, R5 (H4/M3/M4/M5), R6 (F3/F7) und Public-Read-Stichprobe) ==="

# --- 9. L4: CI-Gate im Default-Modus ("nachher", alle Migrationen) ------------------------
# Vorher endete dieses Skript immer mit Exit 0 ("misst, urteilt nicht") — das reicht als
# CI-Gate nicht (final-review.md, L4). Ab jetzt: im vollen Default-Modus (Baseline + 001 + 002
# + 003 + 004 + R6) beendet eine Abweichung von der Rollentabelle den Lauf mit Exit 1. Die
# Gegenprobe-Modi (--baseline-only, --without-hardening, --without-004, --without-r6) sollen
# Abweichungen zeigen dürfen, ohne dass der Lauf selbst als fehlgeschlagen gilt — dort bleibt es
# bei Exit 0.
if [[ "$WITH_MIGRATION" -eq 1 && "$WITH_HARDENING" -eq 1 && "$WITH_PARENT_KEYS" -eq 1 && "$WITH_R6" -eq 1 && "$WITH_R5" -eq 1 && "$MISMATCHES" -gt 0 ]]; then
  echo "::error::Default-Modus (nachher) hat $MISMATCHES Abweichung(en) von der Rollentabelle — CI-Gate schlägt fehl." >&2
  exit 1
fi
