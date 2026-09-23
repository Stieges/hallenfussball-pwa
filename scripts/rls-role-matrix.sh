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
# Nutzung:
#   scripts/rls-role-matrix.sh                    # Baseline + alle vier Migrationen ("nachher")
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
ROLE_MATRIX_FILE="$REPO_ROOT/src/features/auth/__tests__/roleMatrix.json"
CONTAINER_NAME="rls-role-matrix-$$"
WITH_MIGRATION=1
WITH_HARDENING=1
WITH_PARENT_KEYS=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline-only)
      WITH_MIGRATION=0
      WITH_HARDENING=0
      WITH_PARENT_KEYS=0
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
fi

if [[ "$WITH_MIGRATION" -eq 1 && "$WITH_HARDENING" -eq 1 && "$WITH_PARENT_KEYS" -eq 1 ]]; then
  MODE_LABEL="nachher (Baseline + alle vier Migrationen)"
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

INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration)
VALUES
  ('$T_MAIN', '$U_OWNER', 'RLS Matrix — main', '2026-09-22', 8, 15),
  ('$T_ANON', '$U_OWNER_ANON', 'RLS Matrix — anon owner', '2026-09-22', 8, 15);

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
INSERT INTO public.tournament_collaborators
  (id, tournament_id, user_id, invite_code, invite_email, role, accepted_at, use_count, max_uses)
VALUES
  ('$C_PENDING_INVITE', '$T_MAIN', NULL, 'RLSTESTCODE', '$INVITEE_EMAIL', 'collaborator', NULL, 0, 5);

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
echo "=== Zusammenfassung — $MODE_LABEL: $MISMATCHES Abweichung(en) von der Rollentabelle (von $TOTAL geprüften Zellen inkl. dedizierter Prüfung, K1/K2-Härtung, K3/H5/L5-Härtung und Public-Read-Stichprobe) ==="

# --- 9. L4: CI-Gate im Default-Modus ("nachher", alle vier Migrationen) -------------------
# Vorher endete dieses Skript immer mit Exit 0 ("misst, urteilt nicht") — das reicht als
# CI-Gate nicht (final-review.md, L4). Ab jetzt: im vollen Default-Modus (Baseline + 001 + 002
# + 003 + 004) beendet eine Abweichung von der Rollentabelle den Lauf mit Exit 1. Die
# Gegenprobe-Modi (--baseline-only, --without-hardening, --without-004) sollen Abweichungen
# zeigen dürfen, ohne dass der Lauf selbst als fehlgeschlagen gilt — dort bleibt es bei Exit 0.
if [[ "$WITH_MIGRATION" -eq 1 && "$WITH_HARDENING" -eq 1 && "$WITH_PARENT_KEYS" -eq 1 && "$MISMATCHES" -gt 0 ]]; then
  echo "::error::Default-Modus (nachher) hat $MISMATCHES Abweichung(en) von der Rollentabelle — CI-Gate schlägt fehl." >&2
  exit 1
fi
