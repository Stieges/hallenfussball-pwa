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
MARKER="$(grep -m1 -- '--   baseline-includes-through:' "$BASELINE_FILE" | sed -E 's/^--   baseline-includes-through:[[:space:]]*//')"
if [[ -z "$MARKER" ]]; then
  echo "::error::Marker 'baseline-includes-through' fehlt im Kopf von $BASELINE_BASENAME." >&2
  echo "::error::Ohne ihn kann dieses Skript nicht wissen, welche Migrationen bereits in der Baseline stecken." >&2
  exit 1
fi

NEWER_MIGRATIONS=()
for f in "$MIGRATIONS_DIR"/*.sql; do
  base="$(basename "$f")"
  [[ "$base" == "$BASELINE_BASENAME" ]] && continue
  if [[ "$base" > "$MARKER" ]]; then
    NEWER_MIGRATIONS+=("$f")
  fi
done

echo "Baseline enthält bereits bis einschließlich: $MARKER"
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
  if grep -qE '\|f$' "$PRIV_OUT"; then
    echo "::error::Rechte-Assertion fehlgeschlagen — mindestens eine Zeile ist 'f':" >&2
    grep -E '\|f$' "$PRIV_OUT" | while IFS='|' read -r failed_name _; do
      echo "::error::  $failed_name" >&2
    done
    exit 1
  fi
  echo "Rechte-Assertion grün: alle geprüften Spalten-/Funktionsrechte wie erwartet."
else
  echo ""
  echo "Rechte-Assertion (R6) übersprungen: SUPABASE_DB_READONLY_URL nicht gesetzt." >&2
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
