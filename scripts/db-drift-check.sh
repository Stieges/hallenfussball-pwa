#!/usr/bin/env bash
#
# db-drift-check.sh — Vergleicht das LIVE-Schema gegen die Baseline-Migration
# (plus alle Migrationsdateien, die NACH der Baseline hinzugekommen sind).
#
# Warum es das gibt: Der alte Drift-Check (.github/workflows/supabase-drift-check.yml)
# verglich nur generierte TypeScript-Typen gegen src/types/supabase.ts. Eine fehlende
# Tabelle, Policy oder ein fehlender Trigger im Repo erzeugt dort KEINEN Typ-Unterschied —
# genau die Lücke, die von Mai bis September 2026 niemand bemerkt hat. Dieses Skript
# vergleicht das tatsächliche Schema, nicht Typen.
#
# Vergleichsziel ist NUR die Baseline (supabase/migrations/00000000000000_baseline_live_schema.sql)
# plus die Migrationsdateien, die nach ihr hinzukommen — NICHT alle 23 Bestandsmigrationen.
# Grund: Drei Bestandsdateien (20260121_005_anonymous_limit.sql,
# 20260128_002_consolidate_rls_v3.sql, 20260129_001_monitor_heartbeats.sql) versuchen Policies
# anzulegen, die in der Baseline bereits existieren — PostgreSQL kennt kein
# `CREATE POLICY IF NOT EXISTS`. Ein Prüfer, der an dieser bekannten Kollision scheitert, ist rot
# ohne Aussage. Details: supabase/migrations/README.md.
#
# Welche Migrationen "neuer als die Baseline" sind, wird NICHT fest verdrahtet (keine Dateiliste,
# kein Datum im Skript). Die Baseline-Datei trägt selbst einen maschinenlesbaren Marker
# ("baseline-includes-through: <dateiname>"), der den Namen der letzten bereits enthaltenen
# Bestandsmigration nennt. Jede Migrationsdatei, deren Name (lexikografisch = bei den hier
# verwendeten YYYYMMDD_NNN-Namen chronologisch) GRÖSSER ist als dieser Marker, wird nachgespielt.
# Künftige Migrationen werden dadurch automatisch erfasst, ohne dass dieses Skript geändert
# werden muss — nur wenn die Baseline selbst neu erzeugt wird, muss der Marker in ihr
# nachgezogen werden.
#
# Vergleich läuft auf zwei Beinen (beide müssen grün sein), plus einer optionalen Rechte-
# Assertion, die nur läuft, wenn SUPABASE_DB_READONLY_URL gesetzt ist:
#   1. Normalisierter Textdiff des Schemas.
#   2. Katalogzählung (Tabellen/Spalten/Policies/Funktionen/Trigger/Indizes/RLS-Tabellen),
#      dynamisch aus dem SQL-Text ermittelt (scripts/db_catalog_counts.py) — keine
#      fest verdrahteten Zahlen, sie ändern sich mit jeder Migration.
#   3. Rechte-Assertion (R6, scripts/db_privilege_assertions.sql): feste Liste von Spalten-/
#      Funktionsrechten, live per has_column_privilege()/has_function_privilege() geprüft — die
#      GRANT/REVOKE-Anweisungen, die Beine 1+2 wegen --no-privileges nie sehen.
#
# Beide Seiten werden mit DEMSELBEN pg_dump-Binary aus DEMSELBEN Container erzeugt — das ist
# entscheidend, weil unterschiedliche Dump-Werkzeuge allein durch Formatierung (Quoting,
# IF NOT EXISTS, Kommentarstil) einen Dauerunterschied erzeugen wuerden, der nichts mit Drift
# zu tun hat. `supabase db dump` scheidet fuer die Live-Seite aus: Es setzt intern
# SET ROLE "postgres", was die nur-lesende Rolle zu Recht nicht darf (belegt 2026-09-21).
#
# HINWEIS zu --live-dump-file: Die uebergebene Datei muss im pg_dump-Format vorliegen,
# nicht im Format von `supabase db dump`. (Frueher: Live --linked, Rekonstruiert --db-url
# gegen einen lokalen Vergleichscontainer) — bewusst DIESELBE CLI-Dump-Pipeline auf beiden Seiten,
# damit Formatierungsunterschiede (Identifier-Quoting, IF NOT EXISTS, Kommentarstil) gar nicht erst
# entstehen. Ein roher `pg_dump` direkt aus dem Container sieht spürbar anders aus (TOC-Kommentare,
# \restrict-Zeilen, keine IF-NOT-EXISTS-Klauseln) und würde einen dauerhaften Formatunterschied
# erzeugen, der nichts mit echtem Schema-Drift zu tun hat.
#
# Was noch normalisiert wird (dieselben Kategorien, die schon beim Bau der Baseline entfernt
# wurden — siehe deren Kopfkommentar): GRANT-Zeilen, ALTER ... OWNER TO-Zeilen,
# ALTER DEFAULT PRIVILEGES-Zeilen, REVOKE-Zeilen. Plattform-Boilerplate, die jedes
# Supabase-Projekt bei der Provisionierung selbst mitbringt und die pro Dump-Lauf leicht
# unterschiedlich sortiert sein kann.
#
# Nutzung:
#   scripts/db-drift-check.sh                       # normaler Lauf, braucht SUPABASE_ACCESS_TOKEN
#   scripts/db-drift-check.sh --live-dump-file FILE  # Testmodus: FILE wird statt eines echten
#                                                     # Live-Dumps als "Live-Schema" verwendet.
#                                                     # Für den Rot-Beweis (künstliche Abweichung),
#                                                     # NICHT für den normalen Betrieb.
#
# Ändert NICHTS an der Live-Datenbank (nur `supabase db dump`, ein reiner Lesevorgang).
#
set -euo pipefail

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # muss zur Live-Postgres-Version passen (siehe Baseline-Kopfkommentar)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
BASELINE_BASENAME="$(basename "$BASELINE_FILE")"
WORKDIR="$(mktemp -d)"
CONTAINER_NAME="db-drift-check-$$"
LIVE_DUMP_OVERRIDE=""
HOST_PORT=""

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --live-dump-file)
      LIVE_DUMP_OVERRIDE="$2"
      shift 2
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

if [[ ! -f "$BASELINE_FILE" ]]; then
  echo "::error::Baseline-Datei fehlt: $BASELINE_FILE" >&2
  exit 1
fi

# --- 1. Marker aus der Baseline lesen, neuere Migrationsdateien bestimmen -----------------
# Gemeinsame Logik mit scripts/rls-role-matrix.sh und scripts/local-db-apply.sh — siehe
# scripts/lib/migrations-since-baseline.sh (T1, "die Liste darf es nur EINMAL geben").
source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
NEWER_MIGRATIONS_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
NEWER_MIGRATIONS=()
if [[ -n "$NEWER_MIGRATIONS_RAW" ]]; then
  # bash 3.2 (macOS-Standard) kennt kein mapfile — portable while-read-Schleife.
  while IFS= read -r line; do
    NEWER_MIGRATIONS+=("$line")
  done <<< "$NEWER_MIGRATIONS_RAW"
fi

echo "Baseline enthält bereits bis einschließlich: $(grep -m1 -- '--   baseline-includes-through:' "$BASELINE_FILE" | sed -E 's/^--   baseline-includes-through:[[:space:]]*//')"
if [[ ${#NEWER_MIGRATIONS[@]} -eq 0 ]]; then
  echo "Keine neueren Migrationsdateien nachzuspielen."
else
  echo "Neuere Migrationsdateien (${#NEWER_MIGRATIONS[@]}), werden nach der Baseline angewendet:"
  printf '  %s\n' "${NEWER_MIGRATIONS[@]##*/}"
fi

# --- 2. Vergleichs-Container starten (exakt die Live-Postgres-Version) --------------------
docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432 \
  "$POSTGRES_IMAGE" >/dev/null
# Hinweis: bewusst NICHT an 127.0.0.1 gebunden (`-p 127.0.0.1::5432`). Die Supabase-CLI führt
# `db dump --db-url` intern über einen eigenen Docker-Hilfscontainer aus und erreicht den
# Zielport über `host.docker.internal`. Ein auf das Host-Loopback beschränkter Port ist von
# diesem Hilfscontainer aus nicht erreichbar ("Connection refused") — ausprobiert und bestätigt.

HOST_PORT="$(docker inspect -f '{{ (index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort }}' "$CONTAINER_NAME")"

# Das offizielle Postgres-Entrypoint-Verhalten (das dieses Image erbt) startet den Server
# ZWEIMAL: einmal temporär, um die Init-Skripte laufen zu lassen (Rollen, Erweiterungen wie
# pg_graphql, interne Supabase-Schemas), dann Shutdown, dann der endgültige Start. `pg_isready`
# wird schon beim ERSTEN (temporären) Start grün — wer in diesem Fenster verbindet, trifft
# entweder ein halb angelegtes Erweiterungsobjekt ("could not open relation ... graphql.seq_schema_version")
# oder den Moment des Shutdowns selbst ("the database system is shutting down"). Beides beobachtet
# und reproduziert. Zuverlässiges Signal ist deshalb die ZWEITE Log-Zeile
# "database system is ready to accept connections" (siehe docker-entrypoint.sh der Postgres-Images).
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
  echo "::error::Vergleichs-Container wurde nach 90s nicht vollständig bereit." >&2
  docker logs "$CONTAINER_NAME" 2>&1 | tail -30 >&2
  exit 1
fi
# Sicherheitsabstand: der endgültige Server ist laut Log bereit, aber `pg_isready` kann in der
# allerersten Sekunde danach noch kurz hinterherhinken.
for _ in $(seq 1 30); do
  docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

docker exec -i "$CONTAINER_NAME" psql -U postgres -v ON_ERROR_STOP=1 -q < "$BASELINE_FILE"

# R5b-Fixrunde 1 (M2): Der frühere Nachbau der Rolle ci_schema_reader hier ist ENTFALLEN --
# 20260924_002_central_role_permissions.sql legt sie jetzt selbst bedingt an (Abschnitt 0 der
# Migration, NOLOGIN, DO-Block mit pg_roles-Abfrage) -- dieser interne Vergleichs-Container
# verbindet sich ohnehin nie ALS ci_schema_reader (das passiert nur bei einer externen
# SUPABASE_DB_READONLY_URL, siehe unten), er braucht die Rolle nur, damit die Migration
# GRANT/CREATE POLICY ... TO "ci_schema_reader" einspielen kann.

for f in "${NEWER_MIGRATIONS[@]:-}"; do
  [[ -z "$f" ]] && continue
  docker exec -i "$CONTAINER_NAME" psql -U postgres -v ON_ERROR_STOP=1 -q < "$f"
done

# --- 3. Rekonstruierten Dump über dieselbe CLI-Pipeline ziehen ----------------------------
# `supabase db dump --db-url` startet intern einen eigenen Docker-Hilfscontainer, der den
# Zielport erreichen muss. `127.0.0.1` in der Connection-URL zeigt aus SEINER Netzwerk-Sicht auf
# sich selbst, nicht auf den Host — das schlägt zuverlässig mit "Connection refused" fehl
# (ausprobiert, reproduzierbar). `host.docker.internal` ist die von Docker (Desktop wie auch in
# GitHub-Actions-Runnern mit neueren Docker-Versionen) bereitgestellte Adresse, unter der ein
# Container den Host erreicht — darüber ist der auf allen Interfaces (`-p 5432`, kein
# `127.0.0.1::`-Präfix) veröffentlichte Port erreichbar.
RECON_RAW="$WORKDIR/reconstructed_raw.sql"
DUMP_OK=0
for attempt in 1 2 3 4 5; do
  if docker exec -e PGPASSWORD=postgres "$CONTAINER_NAME" \
    pg_dump -U postgres -h 127.0.0.1 -d postgres \
    --schema=public --schema-only --no-owner --no-privileges \
    > "$RECON_RAW" 2>"$WORKDIR/recon_dump.log"; then
    DUMP_OK=1
    break
  fi
  sleep 2
done
if [[ "$DUMP_OK" -ne 1 ]]; then
  echo "::error::Konnte rekonstruiertes Schema nicht dumpen (nach ${attempt} Versuchen):" >&2
  cat "$WORKDIR/recon_dump.log" >&2
  exit 1
fi

# --- 4. Live-Dump beschaffen ---------------------------------------------------------------
LIVE_RAW="$WORKDIR/live_raw.sql"
if [[ -n "$LIVE_DUMP_OVERRIDE" ]]; then
  echo "Testmodus: verwende $LIVE_DUMP_OVERRIDE anstelle eines echten Live-Dumps."
  cp "$LIVE_DUMP_OVERRIDE" "$LIVE_RAW"
elif [[ -n "${SUPABASE_DB_READONLY_URL:-}" ]]; then
  # Bevorzugter Weg: Direktverbindung als nur-lesende Rolle `ci_schema_reader`.
  #
  # Warum nicht --linked: Dieser Weg laesst die CLI ueber die Management-API eine temporaere
  # Anmelderolle anlegen. Mit einem eingeschraenkten Personal Access Token scheitert das an
  # "403: your account does not have the necessary privileges" — belegt am 2026-09-21. Einen
  # Token so weit aufzumachen, dass er das darf, waere mehr Recht als der Zweck verlangt.
  #
  # Die Rolle kann das Schema vollstaendig dumpen, aber keine Daten lesen: Auf allen Tabellen
  # ist RLS aktiv, und sie ist weder `anon` noch `authenticated` noch Eigentuemerin, also greift
  # keine Policy fuer sie. Im Container gegengeprueft — Schema-Dump byte-identisch zum
  # Superuser-Dump, sichtbare Datenzeilen: null.
  echo "Live-Schema ueber die nur-lesende Rolle (SUPABASE_DB_READONLY_URL)."
  docker exec "$CONTAINER_NAME" \
    pg_dump --dbname="$SUPABASE_DB_READONLY_URL" \
    --schema=public --schema-only --no-owner --no-privileges \
    > "$LIVE_RAW" 2>"$WORKDIR/live_dump.log" \
    || { echo "::error::Konnte Live-Schema nicht dumpen (nur-lesende Rolle):" >&2
         echo "::error::Faellt hier 'permission denied for table X' auf, ist X neu und die Rolle" >&2
         echo "::error::hat noch kein Leserecht darauf. Das ist Absicht (kein ALTER DEFAULT" >&2
         echo "::error::PRIVILEGES) — ein GRANT SELECT nachziehen, bewusst." >&2
         cat "$WORKDIR/live_dump.log" >&2; exit 1; }
else
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    echo "::error::Weder SUPABASE_DB_READONLY_URL noch SUPABASE_ACCESS_TOKEN ist gesetzt —" >&2
    echo "::error::der Drift-Check kann das Live-Schema nicht laden. Das ist eine offene Aktion" >&2
    echo "::error::des Repo-Inhabers (Settings → Secrets → Actions), KEIN Fehler dieses Skripts." >&2
    echo "::error::Ein uebersprungener Check darf niemals als gruen gelten — deshalb Abbruch." >&2
    exit 1
  fi
  echo "Hinweis: SUPABASE_DB_READONLY_URL nicht gesetzt, weiche auf --linked aus."
  echo "Hinweis: Das braucht einen Token mit weitergehenden Rechten als der Zweck verlangt."
  (cd "$REPO_ROOT" && supabase db dump --schema public --linked -f "$LIVE_RAW") \
    >"$WORKDIR/live_dump.log" 2>&1 \
    || { echo "::error::Konnte Live-Schema nicht dumpen:" >&2; cat "$WORKDIR/live_dump.log" >&2; exit 1; }
fi

# --- 4b. Live-Rechte-Assertion (R6) -------------------------------------------------------
# GRANT/REVOKE-Anweisungen sind fuer den Textdiff und die Katalogzaehlung unten unsichtbar
# (beide Dumps laufen mit --no-privileges, siehe Kopfkommentar). Ein Live-GRANT SELECT ON
# profiles TO anon (die Lücke, die 20260924_001_restrict_profiles.sql schliesst) würde vom
# Rest dieses Skripts NIE bemerkt. scripts/db_privilege_assertions.sql prüft deshalb live,
# über has_column_privilege()/has_function_privilege(), eine feste Liste von Spalten- und
# Funktionsrechten (Details und Positivkontrollen im Kopfkommentar dieser Datei).
#
# Nur mit SUPABASE_DB_READONLY_URL moeglich (derselbe Verbindungsweg wie Schritt 4 oben) — die
# rein CLI-basierte --linked-Alternative liefert keine Connection-URL, gegen die sich beliebiges
# SQL ausfuehren liesse. Kein Ausführen ohne diese Variable heisst NICHT automatisch grün: das
# Skript macht die Lücke im Log sichtbar, statt sie stillschweigend zu überspringen, faellt aber
# (anders als der Rest des Skripts) nicht deswegen mit Exit 1 — das waere ein Rueckschritt fuer
# den bestehenden --linked-Fallback-Pfad, der diese Variable nie gesetzt hat.
# Fixrunde 1 (task-R6-review.md, L2, Befund 1): Der reine "keine Zeile endet auf |f"-Check
# unten wäre vakuum-grün für eine geleerte oder auf Kommentare gekürzte
# db_privilege_assertions.sql (0 Zeilen Ausgabe, kein "|f" zu finden). Diese feste Namensliste
# erzwingt zusätzlich, dass GENAU diese Prüfungen (nicht mehr, nicht weniger) tatsächlich
# gelaufen sind — jede fehlende oder unerwartete Zeile ist ein eigener Fehler, unabhängig vom
# "|f"-Check. Muss 1:1 zu den Zeilen in scripts/db_privilege_assertions.sql passen.
PRIVILEGE_ASSERTION_NAMES=(
  "anon-no-insert-profiles"
  "authenticated-no-insert-profiles"
  "anon-no-delete-profiles"
  "authenticated-no-delete-profiles"
  "anon-no-truncate-profiles"
  "authenticated-no-truncate-profiles"
  "anon-no-maintain-profiles"
  "authenticated-no-maintain-profiles"
  "anon-no-select-profiles-email"
  "authenticated-no-select-profiles-email"
  "anon-no-select-profiles-auth-provider"
  "authenticated-no-select-profiles-auth-provider"
  "anon-no-select-profiles-preferences"
  "authenticated-no-select-profiles-preferences"
  "anon-no-select-profiles-display-name"
  "authenticated-no-update-profiles-role"
  "authenticated-no-update-profiles-email"
  "authenticated-no-update-profiles-auth-provider"
  "anon-no-execute-merge-user-data"
  "authenticated-no-execute-merge-user-data"
  "anon-no-select-role-permissions"
  "authenticated-no-insert-role-permissions"
  "authenticated-no-update-role-permissions"
  "authenticated-no-delete-role-permissions"
  "positive-authenticated-select-display-name"
  "positive-anon-execute-auth-provider-for-email"
  "positive-authenticated-select-role-permissions"
  "positive-ci-schema-reader-select-role-permissions"
  "positive-anon-execute-is-active-tournament-member"
  "positive-anon-execute-has-tournament-permission"
  "anon-no-select-match-event-authors"
  "authenticated-no-insert-match-event-authors"
  "authenticated-no-update-match-event-authors"
  "authenticated-no-delete-match-event-authors"
  "authenticated-no-insert-match-transitions"
  "authenticated-no-update-match-transitions"
  "authenticated-no-delete-match-transitions"
  "authenticated-no-insert-app-config"
  "authenticated-no-update-app-config"
  "authenticated-no-delete-app-config"
  "positive-authenticated-select-match-event-authors"
  "positive-anon-select-match-transitions"
  "positive-ci-schema-reader-select-match-transitions"
  "positive-anon-select-app-config"
  "positive-ci-schema-reader-select-app-config"
  "compute-match-state-security-invoker"
  "compute-match-state-stable"
  "match-apply-event-immutable"
  "match-engine-function-count-47"
  "match-engine-immutable-count-46"
  "match-engine-no-security-definer"
  "match-engine-search-path-all-47"
  "match-engine-functions-no-public-execute"
  "match-engine-schema-no-public-usage"
  "no-match-helpers-in-public"
  "positive-anon-execute-compute-match-state"
  "positive-authenticated-execute-compute-match-state"
  "positive-authenticated-execute-match-apply-event"
  "positive-anon-usage-match-engine"
  "positive-anon-execute-match-engine-payload-valid"
  "append-match-events-security-definer"
  "append-match-events-search-path"
  "append-match-events-no-public-execute"
  "anon-no-execute-append-match-events"
  "server-time-stable"
  "anon-no-execute-match-engine-envelope"
  "authenticated-no-execute-match-engine-cache-columns"
  "positive-authenticated-execute-append-match-events"
  "positive-anon-execute-server-time"
  "positive-authenticated-execute-server-time"
)

if [[ -n "${SUPABASE_DB_READONLY_URL:-}" ]]; then
  echo ""
  echo "--- Rechte-Assertion (R6, live über SUPABASE_DB_READONLY_URL) ---"
  PRIV_OUT="$WORKDIR/privilege_assertions.out"
  if ! { cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } \
    | docker exec -i "$CONTAINER_NAME" psql --dbname="$SUPABASE_DB_READONLY_URL" -X -v ON_ERROR_STOP=1 \
    > "$PRIV_OUT" 2>&1; then
    echo "::error::Rechte-Assertion konnte nicht ausgeführt werden (siehe Ausgabe):" >&2
    cat "$PRIV_OUT" >&2
    exit 1
  fi
  cat "$PRIV_OUT"

  PRIV_ASSERTION_FAILED=0

  # 1. Namensliste: jeder erwartete Name muss GENAU EINMAL vorkommen.
  for expected_name in "${PRIVILEGE_ASSERTION_NAMES[@]}"; do
    occurrences="$(grep -cE "^${expected_name}\|" "$PRIV_OUT" || true)"
    if [[ "$occurrences" -ne 1 ]]; then
      echo "::error::Rechte-Assertion unvollständig — '$expected_name' kommt ${occurrences}x vor (erwartet: 1). Datei geleert/gekürzt?" >&2
      PRIV_ASSERTION_FAILED=1
    fi
  done

  # 2. Keine unerwarteten Zeilen (z.B. Tippfehler, der eine Prüfung verdoppelt statt zu ersetzen).
  actual_line_count="$(grep -cE '^[a-z0-9-]+\|[tf]$' "$PRIV_OUT" || true)"
  expected_line_count="${#PRIVILEGE_ASSERTION_NAMES[@]}"
  if [[ "$actual_line_count" -ne "$expected_line_count" ]]; then
    echo "::error::Rechte-Assertion hat $actual_line_count Zeile(n), erwartet genau $expected_line_count." >&2
    PRIV_ASSERTION_FAILED=1
  fi

  # 3. Jede Zeile muss 't' sein.
  if grep -qE '\|f$' "$PRIV_OUT"; then
    echo "::error::Rechte-Assertion fehlgeschlagen — mindestens eine Zeile ist 'f':" >&2
    grep -E '\|f$' "$PRIV_OUT" | while IFS='|' read -r failed_name _; do
      echo "::error::  $failed_name" >&2
    done
    PRIV_ASSERTION_FAILED=1
  fi

  if [[ "$PRIV_ASSERTION_FAILED" -ne 0 ]]; then
    exit 1
  fi
  echo "Rechte-Assertion grün: alle $expected_line_count erwarteten Zeilen vorhanden und wie erwartet."
else
  echo ""
  echo "Rechte-Assertion (R6) übersprungen: SUPABASE_DB_READONLY_URL nicht gesetzt." >&2
fi

# --- 4c. R5b (task-R5b-brief.md, Abschnitt 4): role_permissions-Inhalt vs. rolePermissions.json --
# Textdiff und Katalogzählung unten laufen mit --no-privileges UND vergleichen nur die SCHEMA-
# Definition (Spalten, Constraints) der Tabelle role_permissions, NIE ihren Zeileninhalt (kein
# Dump-Werkzeug hier zieht Daten). Eine live geänderte Zeile in role_permissions (z.B. per
# Hand im SQL-Editor, an rolePermissions.json vorbei) würde von beiden Beinen NIE bemerkt. Dieser
# Abschnitt vergleicht deshalb den tatsächlichen INHALT der Tabelle -- über dieselbe nur-lesende
# Rolle wie die Rechte-Assertion oben (ci_schema_reader braucht dafür die eigene Policy
# "role_permissions_select_ci_schema_reader", siehe Migrationskommentar; die Positivkontrolle
# "positive-ci-schema-reader-select-role-permissions" oben belegt nur den GRANT, RLS könnte den
# Zeileninhalt trotzdem auf 0 filtern -- das würde hier als "0 Zeilen" sichtbar UND als Diff
# gegen die JSON rot, nicht stillschweigend als Erfolg gewertet).
if [[ -n "${SUPABASE_DB_READONLY_URL:-}" ]]; then
  echo ""
  echo "--- Gleichlauf role_permissions (DB, live) vs. rolePermissions.json ---"
  DB_ROLE_PERMISSIONS_LIVE="$(docker exec -i "$CONTAINER_NAME" psql --dbname="$SUPABASE_DB_READONLY_URL" -X -q -tA -v ON_ERROR_STOP=1 \
    -c "SELECT role || '|' || permission FROM public.role_permissions ORDER BY role, permission;" \
    2>"$WORKDIR/role_permissions_live.log" | sort)" \
    || { echo "::error::Konnte public.role_permissions nicht live lesen (ci_schema_reader):" >&2
         cat "$WORKDIR/role_permissions_live.log" >&2; exit 1; }
  JSON_ROLE_PERMISSIONS="$(jq -r '.roles | to_entries[] | .key as $role | .value[] | $role + "|" + .' \
    "$REPO_ROOT/src/features/auth/permissions/rolePermissions.json" | sort)"
  if [[ "$DB_ROLE_PERMISSIONS_LIVE" == "$JSON_ROLE_PERMISSIONS" ]]; then
    ROW_COUNT="$(wc -l <<<"$JSON_ROLE_PERMISSIONS" | tr -d ' ')"
    echo "Gleichlauf grün: role_permissions (live) und rolePermissions.json stimmen überein ($ROW_COUNT Zeilen)."
  else
    echo "::error::role_permissions (live) weicht von rolePermissions.json ab:" >&2
    echo "### Diff (links: rolePermissions.json, rechts: DB live)" >&2
    diff <(echo "$JSON_ROLE_PERMISSIONS") <(echo "$DB_ROLE_PERMISSIONS_LIVE") >&2 || true
    exit 1
  fi
else
  echo ""
  echo "Gleichlauf role_permissions vs. rolePermissions.json übersprungen: SUPABASE_DB_READONLY_URL nicht gesetzt." >&2
fi

# --- 4c2. B2 (task-B2-brief.md, Abschnitt 2): match_transitions-Inhalt vs.
# src/core/match/matchTransitions.json -- analog zu 4c (role_permissions), gleiches Muster:
# Textdiff/Katalogzählung sehen nur die Schema-Definition der Tabelle, nie ihren Zeileninhalt.
# ci_schema_reader braucht dafür die eigene Policy "match_transitions_select_ci_schema_reader"
# (supabase/migrations/20260928_001_match_event_log.sql).
if [[ -n "${SUPABASE_DB_READONLY_URL:-}" ]]; then
  echo ""
  echo "--- Gleichlauf match_transitions (DB, live) vs. matchTransitions.json ---"
  DB_MATCH_TRANSITIONS_LIVE="$(docker exec -i "$CONTAINER_NAME" psql --dbname="$SUPABASE_DB_READONLY_URL" -X -q -tA -v ON_ERROR_STOP=1 \
    -c "SELECT from_status || '|' || event_type || '|' || actor || '|' || to_status FROM public.match_transitions ORDER BY 1;" \
    2>"$WORKDIR/match_transitions_live.log" | sort)" \
    || { echo "::error::Konnte public.match_transitions nicht live lesen (ci_schema_reader):" >&2
         cat "$WORKDIR/match_transitions_live.log" >&2; exit 1; }
  JSON_MATCH_TRANSITIONS="$(jq -r '.transitions[] | [.from,.type,.actor,.to] | join("|")' \
    "$REPO_ROOT/src/core/match/matchTransitions.json" | sort)"
  if [[ "$DB_MATCH_TRANSITIONS_LIVE" == "$JSON_MATCH_TRANSITIONS" ]]; then
    ROW_COUNT="$(wc -l <<<"$JSON_MATCH_TRANSITIONS" | tr -d ' ')"
    echo "Gleichlauf grün: match_transitions (live) und matchTransitions.json stimmen überein ($ROW_COUNT Zeilen)."
  else
    echo "::error::match_transitions (live) weicht von matchTransitions.json ab:" >&2
    echo "### Diff (links: matchTransitions.json, rechts: DB live)" >&2
    diff <(echo "$JSON_MATCH_TRANSITIONS") <(echo "$DB_MATCH_TRANSITIONS_LIVE") >&2 || true
    exit 1
  fi
else
  echo ""
  echo "Gleichlauf match_transitions vs. matchTransitions.json übersprungen: SUPABASE_DB_READONLY_URL nicht gesetzt." >&2
fi

# --- 4d. Realtime-Publikation (Ruling W, .superpowers/sdd/2026-09-24-testumgebung/
# task-T4-review.md Fixrunde 1) ------------------------------------------------------------
# `supabase_realtime` ist eine Publication, kein Schema-Objekt in `public` -- Textdiff und
# Katalogzählung unten (beide --schema=public) sehen sie nie, ein fehlender oder zusätzlicher
# Tabelleneintrag wäre für den Rest dieses Skripts unsichtbar. Erwartete Liste ist die vom
# Auftraggeber gelieferte Live-Abfrage (2026-09-25, NICHT von diesem Skript selbst erhoben --
# Ruling W verbietet eine neue Live-Abfrage durch die Automatisierung): Produktion enthält
# GENAU public.match_events, public.matches, public.monitor_heartbeats, public.teams.
# scripts/local-db-apply.sh setzt denselben Satz lokal (idempotent), dieser Abschnitt prüft,
# dass Produktion nicht abgewichen ist.
#
# Fixrunde 2 (N10): Liste UND Abfrage jetzt schema-QUALIFIZIERT (`schema.tabelle`), OHNE
# `WHERE schemaname = 'public'`-Filter -- Ruling W verlangt wörtlich "Publikation = genau diese
# vier Tabellen". Der vorherige Filter blendete jede Tabelle aus einem ANDEREN Schema (z.B.
# `auth.users`), die zusätzlich zur Publikation hinzugefügt worden wäre, VOR dem Vergleich aus --
# genau so eine Abweichung wäre unsichtbar geblieben, nicht "grün, weil geprüft", sondern
# "grün, weil nie hingeschaut".
REALTIME_PUBLICATION_TABLES=(
  "public.match_events"
  "public.matches"
  "public.monitor_heartbeats"
  "public.teams"
)
if [[ -n "${SUPABASE_DB_READONLY_URL:-}" ]]; then
  echo ""
  echo "--- Realtime-Publikation supabase_realtime (live) ---"
  PUB_OUT="$WORKDIR/realtime_publication.out"
  docker exec "$CONTAINER_NAME" \
    psql --dbname="$SUPABASE_DB_READONLY_URL" -X -q -tA -v ON_ERROR_STOP=1 \
    -c "SELECT schemaname || '.' || tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY 1;" \
    > "$PUB_OUT" 2>"$WORKDIR/realtime_publication.log" \
    || { echo "::error::Konnte supabase_realtime nicht live lesen:" >&2
         cat "$WORKDIR/realtime_publication.log" >&2; exit 1; }
  ACTUAL_PUB_TABLES="$(sort "$PUB_OUT")"
  EXPECTED_PUB_TABLES="$(printf '%s\n' "${REALTIME_PUBLICATION_TABLES[@]}" | sort)"
  if [[ "$ACTUAL_PUB_TABLES" == "$EXPECTED_PUB_TABLES" ]]; then
    ROW_COUNT="$(printf '%s\n' "${REALTIME_PUBLICATION_TABLES[@]}" | wc -l | tr -d ' ')"
    echo "Realtime-Publikation grün: supabase_realtime enthält genau die erwarteten $ROW_COUNT Tabellen."
  else
    echo "::error::supabase_realtime weicht von der erwarteten Tabellenliste ab:" >&2
    echo "### Diff (links: erwartet, rechts: live)" >&2
    diff <(echo "$EXPECTED_PUB_TABLES") <(echo "$ACTUAL_PUB_TABLES") >&2 || true
    exit 1
  fi
else
  echo ""
  echo "Realtime-Publikation (supabase_realtime) übersprungen: SUPABASE_DB_READONLY_URL nicht gesetzt." >&2
fi

# --- 5. Beide Dumps normalisieren (Plattform-Boilerplate entfernen) -----------------------
normalize() {
  # Neben der Plattform-Boilerplate (GRANT/REVOKE/OWNER TO/DEFAULT PRIVILEGES) faellt hier
  # auch das pg_dump-eigene Rauschen weg:
  #   \restrict / \unrestrict tragen bei jedem Lauf ein frisches Zufallstoken,
  #   die '--'-Kommentarzeilen enthalten Dump-Zeitpunkt und TOC-Eintraege.
  # Beide wuerden den Vergleich dauerhaft rot faerben, ohne je echten Drift zu zeigen.
  grep -Ev '^(GRANT |REVOKE )' "$1" \
    | grep -Ev 'OWNER TO' \
    | grep -Ev '^ALTER DEFAULT PRIVILEGES' \
    | grep -Ev '^\\(restrict|unrestrict)' \
    | grep -Ev '^--' \
    | grep -Ev '^[[:space:]]*$'
}

LIVE_FILTERED="$WORKDIR/live_filtered.sql"
RECON_FILTERED="$WORKDIR/reconstructed_filtered.sql"
normalize "$LIVE_RAW" > "$LIVE_FILTERED"
normalize "$RECON_RAW" > "$RECON_FILTERED"

# --- 6. Textdiff -----------------------------------------------------------------------
TEXT_OK=1
if ! diff -u "$LIVE_FILTERED" "$RECON_FILTERED" > "$WORKDIR/text.diff"; then
  TEXT_OK=0
fi

# --- 7. Katalogzählung (dynamisch, nicht fest verdrahtet) --------------------------------
LIVE_COUNTS="$WORKDIR/live_counts.json"
RECON_COUNTS="$WORKDIR/reconstructed_counts.json"
python3 "$REPO_ROOT/scripts/db_catalog_counts.py" "$LIVE_FILTERED" > "$LIVE_COUNTS"
python3 "$REPO_ROOT/scripts/db_catalog_counts.py" "$RECON_FILTERED" > "$RECON_COUNTS"

COUNTS_OK=1
if ! diff -u "$LIVE_COUNTS" "$RECON_COUNTS" > "$WORKDIR/counts.diff"; then
  COUNTS_OK=0
fi

echo ""
echo "--- Katalogzählung: live ---"
cat "$LIVE_COUNTS"
echo "--- Katalogzählung: rekonstruiert (Baseline + neuere Migrationen) ---"
cat "$RECON_COUNTS"
echo ""

if [[ "$TEXT_OK" -eq 1 && "$COUNTS_OK" -eq 1 ]]; then
  echo "Kein Schema-Drift: Live-Schema stimmt mit Baseline + neueren Migrationen überein (Text und Katalogzählung)."
  exit 0
fi

echo "::error::Schema-Drift erkannt — Live-Schema weicht von Baseline + neueren Migrationen ab." >&2
if [[ "$TEXT_OK" -eq 0 ]]; then
  echo ""
  echo "### Textdiff (live vs. rekonstruiert)"
  cat "$WORKDIR/text.diff"
fi
if [[ "$COUNTS_OK" -eq 0 ]]; then
  echo ""
  echo "### Katalogzählung weicht ab (live vs. rekonstruiert)"
  cat "$WORKDIR/counts.diff"
fi
exit 1
