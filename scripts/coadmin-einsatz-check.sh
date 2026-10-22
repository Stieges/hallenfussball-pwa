#!/usr/bin/env bash
#
# coadmin-einsatz-check.sh — Container-Beweis fuer supabase/migrations/20261110_004_coadmin_einsatz.sql (CA-2,
# plan-coadmin-einsatzfaehig.md § CA-2, review-plan-coadmin.md Auflagen 2-5, 14). Muster: scripts/field-control-check.sh
# (Wegwerf-Container supabase/postgres, nativ, per DOCKER_PLATFORM ueberschreibbar, Baseline + Migrationen seit Baseline, trap).
#
# Probelauf in Fenster-Reihenfolge (Do 22.10.): alles vor 20261110_001 -> _001 -> _002 -> (Hook an: im Container ohne
# Auth-Dienst nicht nachstellbar) -> _003 -> _004. Testwerte aus dem Gherkin (@BM-070, @ME-070, @HE-085): Turnierleitung
# Olli (Eigentuemer), Co-Admin Maria, Helfer Tom (Geraetesitzung, Rolle helper), Hallen-Rechner (Geraetesitzung, Rolle
# screen), Greta (Konto, nicht eingetragen), Mama Petra (anon, ohne Sitzung); "Hallencup Nord" (freigegeben), "Wintercup"
# (Nachbarturnier, auch Olli), "Nikolaus-Rauchtest" (Rauchtest mit der Betreiber-Vorlage aus CA-1).
#
# Kategorien:
#   F  Fail-fast: _004 ohne _001/_002 bricht ab und aendert nichts.
#   R  Rechte: Szenario-Zeilen @BM-070 (teilen, zuruecknehmen, Code erneuern, Entwurf HF001, Code bleibt) und @ME-070
#      (Lebenszeichen lesen) je Person, mit Gegenbeispielen; Vorher/Nachher der Turnierzeile als Superuser.
#   S  Schema: Katalogzaehlung, Funktionen (SECURITY DEFINER, search_path, EXECUTE unveraendert), Policy, Rechte-Assertion
#      (vorher die 3 neuen |f, nachher alle |t), Namensliste = db-drift-check.sh.
#   V  Rauchtest (Auflage 14): Test-Co-Admin per Betreiber-Vorlage (Block 1) eintragen, als Co-Admin teilen, Code
#      erneuern, Lebenszeichen lesen, Teilen zuruecknehmen; Nicht-Mitglied abgelehnt; Austragen (Block 3) sperrt sofort.
#   W  zweites Einspielen: _004 allein; _002, _003, _004 erneut in Reihenfolge (Exit 0, Schema gleich); _001 nach _002
#      bricht ohne Aenderung ab (Endstand-Pruefung von A-11, Befund fuer das Fenster).
#   X  Rueckweg (Anhang B): Schema public = vor _004 (pg_dump identisch), danach erneut einspielbar.
#
# Aufrufoptionen:
#   bash scripts/coadmin-einsatz-check.sh [--vorlage PFAD]                     normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/coadmin-einsatz-check.sh --without-migration [--vorlage PFAD]  Gegenprobe: ohne _004 -> R und V ROT
#   bash scripts/coadmin-einsatz-check.sh --gegenprobe [--vorlage PFAD]         je Lauf eine Mutation (M1-M10); Exit 0
#                                                                               NUR, wenn JEDE Mutation rot faerbt
#   bash scripts/coadmin-einsatz-check.sh --print-rueckweg                      Rueckweg (Anhang B) ausgeben, ohne Container
# --vorlage: Betreiber-Vorlage (CA-1, scripts/betrieb/co-admin-eintragen.sql); Standard ist die Datei im Repo. Fehlt sie,
# wird V als "uebersprungen" gemeldet (zaehlt als Abweichung -- ein Lauf ohne Rauchtest ist nicht gruen).
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container
# (nativ, per DOCKER_PLATFORM ueberschreibbar), wird am Ende entfernt (trap). Einzige Harness-Anpassung: auth.users bekommt im Container die
# Spalte email_confirmed_at (das Image hat eine aeltere, minimale auth.users; die Vorlage liest die Spalte).
#
set -euo pipefail

MODE="normal"
VORLAGE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --without-migration) MODE="without-migration"; shift ;;
    --gegenprobe) MODE="gegenprobe"; shift ;;
    --print-rueckweg) MODE="print-rueckweg"; shift ;;
    --vorlage) VORLAGE="${2:-}"; shift 2 ;;
    *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe, --print-rueckweg, --vorlage PFAD)" >&2; exit 2 ;;
  esac
done

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie field-control-check.sh
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}" # leer = Plattform des Rechners (nativ); z. B. linux/amd64 erzwingt Emulation
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261110_004_coadmin_einsatz.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
WINDOW_NAMES=(20261110_001_role_permissions_mvp.sql 20261110_002_device_roles.sql 20261110_003_field_control.sql)
[[ -z "$VORLAGE" ]] && VORLAGE="$REPO_ROOT/scripts/betrieb/co-admin-eintragen.sql"
CONTAINER_PREFIX="coadmin-einsatz-check-$$"
CURRENT_CONTAINER=""

# Rueckweg (Anhang B): die drei Funktionen woertlich aus der Baseline (Live-Fassung), Policy zurueck.
rueckweg_sql() {
  echo "-- Rueckweg CA-2 (20261110_004_coadmin_einsatz.sql), erzeugt von scripts/coadmin-einsatz-check.sh --print-rueckweg"
  echo "-- Vorher: nichts an der App (sie faellt bei \"Not authorized\" auf den lokalen Rueckfall zurueck)."
  echo "BEGIN;"
  echo "SET LOCAL lock_timeout = '5s';"
  local fn
  for fn in make_tournament_public make_tournament_private regenerate_share_code; do
    echo "-- $fn woertlich aus 00000000000000_baseline_live_schema.sql"
    awk -v head="CREATE OR REPLACE FUNCTION \"public\".\"$fn\"(" 'index($0, head) == 1 {f=1} f{print} f && $0=="$$;"{exit}' "$BASELINE_FILE"
  done
  echo "-- Policy woertlich aus 00000000000000_baseline_live_schema.sql"
  echo "DROP POLICY IF EXISTS heartbeats_select_v2 ON public.monitor_heartbeats;"
  echo "DROP POLICY IF EXISTS owner_select_heartbeats ON public.monitor_heartbeats;"
  awk 'index($0, "CREATE POLICY \"owner_select_heartbeats\"") == 1 {f=1} f{print} f && /;$/{exit}' "$BASELINE_FILE"
  echo "COMMIT;"
}
if [[ "$MODE" == "print-rueckweg" ]]; then
  rueckweg_sql
  exit 0
fi

[[ -f "$TARGET_FILE" ]] || { echo "::error::$TARGET_NAME fehlt." >&2; exit 1; }

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
NEWER_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
PRE_WINDOW=()   # alles vor 20261110_001
WINDOW=()       # _001, _002, _003 (Fenster-Reihenfolge)
AFTER=()        # alles nach _004
SEEN_TARGET=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  name="$(basename "$line")"
  if [[ "$name" == "$TARGET_NAME" ]]; then
    SEEN_TARGET=1
  elif [[ " ${WINDOW_NAMES[*]} " == *" $name "* ]]; then
    WINDOW+=("$line")
  elif [[ "$SEEN_TARGET" -eq 1 ]]; then
    AFTER+=("$line")
  elif [[ "${#WINDOW[@]}" -eq 0 ]]; then
    PRE_WINDOW+=("$line")
  else
    echo "::error::$name liegt zwischen den Fenster-Dateien -- Reihenfolge pruefen." >&2; exit 1
  fi
done <<< "$NEWER_RAW"
[[ "$SEEN_TARGET" -eq 1 && "${#WINDOW[@]}" -eq 3 ]] || { echo "::error::Fenster-Dateien nicht vollstaendig (${#WINDOW[@]}/3, Ziel $SEEN_TARGET)." >&2; exit 1; }

cleanup() { [[ -n "$CURRENT_CONTAINER" ]] && docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

start_container() {
  CURRENT_CONTAINER="$CONTAINER_PREFIX-$1"
  docker run -d ${DOCKER_PLATFORM:+--platform "$DOCKER_PLATFORM"} --name "$CURRENT_CONTAINER" -e POSTGRES_PASSWORD=postgres -p 5432 "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 120); do
    if [[ "$(docker logs "$CURRENT_CONTAINER" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "::error::Container wurde nach 120s nicht bereit." >&2
    docker logs "$CURRENT_CONTAINER" 2>&1 | tail -30 >&2
    exit 1
  fi
  for _ in $(seq 1 30); do
    docker exec "$CURRENT_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
}
stop_container() { docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1 || true; CURRENT_CONTAINER=""; }

psql_stdin() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q
}
psql_value() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA
}
q() { psql_value <<<"$1" 2>&1 || true; }
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }

# Zaehler je Kategorie (bash 3.2: keine assoziativen Arrays).
CATS=(F R S V W X)
DEVS=(0 0 0 0 0 0)
OKS=(0 0 0 0 0 0)
cat_index() {
  local i
  for i in "${!CATS[@]}"; do [[ "${CATS[$i]}" == "$1" ]] && { echo "$i"; return 0; }; done
  echo "::error::Unbekannte Kategorie $1" >&2; exit 2
}
check() { # check <Kategorie> <Name> <erwartet> <erhalten>
  local i
  i="$(cat_index "$1")"
  if [[ "$3" == "$4" ]]; then
    OKS[i]=$((OKS[i] + 1)); echo "OK          [$1] $2"
  else
    DEVS[i]=$((DEVS[i] + 1)); echo "ABWEICHUNG  [$1] $2"; echo "    erwartet: $3"; echo "    erhalten: $4"
  fi
}
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
reset_counts() { DEVS=(0 0 0 0 0 0); OKS=(0 0 0 0 0 0); }
summary() {
  local i
  echo
  for i in "${!CATS[@]}"; do echo "Kategorie ${CATS[$i]}: ${OKS[$i]} OK, ${DEVS[$i]} Abweichung(en)"; done
}

uuid_for() {
  local h
  h="$(printf '%s' "coadmin-einsatz-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_GRETA="$(uuid_for user:greta)"
U_RAUCH="$(uuid_for user:test-co-admin)"; U_TOM="$(uuid_for user:tom)"; U_SCREEN="$(uuid_for user:hallen-rechner)"
ANON_UIDS=" $U_TOM $U_SCREEN "
M_RAUCH="test-co-admin@ca2-rauchtest.test"   # nie eine echte Mail
T_NORD="$(uuid_for tournament:hallencup-nord)"; T_WINTER="$(uuid_for tournament:wintercup)"
T_RAUCH="$(uuid_for tournament:nikolaus-rauchtest)"
MON_NORD="$(uuid_for monitor:hallenmonitor-halle)"; MON_WINTER="$(uuid_for monitor:wintercup)"
MON_RAUCH="$(uuid_for monitor:rauchtest)"
C_MARIA="$(uuid_for membership:maria)"
ALPHABET_RE='^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
OLD_CODE="QWERTZ"; OLD_AT="2026-10-01 12:00:00+00"

is_anon() { [[ "$ANON_UIDS" == *" $1 "* ]] && echo true || echo false; }
claims_sql() { # Sitzung wie PostgREST: claim.sub + claims mit is_anonymous
  [[ -z "$1" ]] && return 0
  echo "SET LOCAL request.jwt.claim.sub = '$1'; SET LOCAL request.jwt.claims = '{\"sub\":\"$1\",\"role\":\"authenticated\",\"is_anonymous\":$(is_anon "$1")}';"
}
# probe <uid|leer(=anon)> <vorbereitung> <aktion (Zeilen "r:..."; psql-Variablen erlaubt)> <pruef-SQL> -> "<ergebnis>|<pruefwert>"
# Eine nie committete Transaktion; Pruefwert als Superuser nach der Aktion.
probe() {
  local uid="$1" setup="$2" action="$3" check_sql="$4" role="authenticated" out res msg chk
  [[ -z "$uid" ]] && role="anon"
  set +e
  out="$(docker exec -i "$CURRENT_CONTAINER" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 <<SQL 2>&1
BEGIN;
$setup
SET LOCAL ROLE $role;
$(claims_sql "$uid")
SAVEPOINT aktion;
$action
\\if :ERROR
ROLLBACK TO SAVEPOINT aktion;
\\endif
RESET ROLE;
SELECT 'p:' || coalesce(($check_sql)::text, 'NULL');
ROLLBACK;
SQL
)"
  set -e
  res="$( (grep '^r:' <<<"$out" || true) | cut -c3- | paste -sd, -)"
  msg="$( (grep -m1 'ERROR:' <<<"$out" || true) | sed 's/^.*ERROR: *//')"
  chk="$( (grep -m1 '^p:' <<<"$out" || true) | cut -c3-)"
  [[ -n "$msg" ]] && res="fehler:$msg"
  echo "${res:-?}|${chk:-?}"
}
# als <uid|leer> <sql>: eine committete Transaktion als Client -> "r:"-Zeilen (Komma) oder "fehler:<text>"
als() {
  local uid="$1" sql="$2" role="authenticated" out msg
  [[ -z "$uid" ]] && role="anon"
  set +e
  out="$(docker exec -i "$CURRENT_CONTAINER" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE $role;
$(claims_sql "$uid")
$sql
COMMIT;
SQL
)"
  set -e
  msg="$( (grep -m1 'ERROR:' <<<"$out" || true) | sed 's/^.*ERROR: *//')"
  if [[ -n "$msg" ]]; then echo "fehler:$msg"; else (grep '^r:' <<<"$out" || true) | cut -c3- | paste -sd, -; fi
}

ROW() { echo "SELECT t.is_public || '|' || coalesce(t.share_code, 'NULL') || '|' || CASE WHEN t.share_code_created_at IS NULL THEN 'NULL' WHEN t.share_code_created_at = '$OLD_AT'::timestamptz THEN 'alt' ELSE 'neu' END FROM public.tournaments t WHERE t.id = '$1'"; }
SHARED() { echo "UPDATE public.tournaments SET is_public = true, share_code = '$OLD_CODE', share_code_created_at = '$OLD_AT' WHERE id = '$1';"; }
DRAFT() { echo "UPDATE public.tournaments SET config = config - 'publishedAt' WHERE id = '$1';"; }
PUBLIC() { echo "SELECT 'r:' || x.share_code FROM public.make_tournament_public('$1') AS x;"; }
PRIVATE() { echo "SELECT 'r:ok' FROM (SELECT public.make_tournament_private('$1')) AS x;"; }
REGENERATE() { echo "SELECT 'r:' || x.share_code FROM public.regenerate_share_code('$1') AS x;"; }
READ_HB() { echo "SELECT 'r:' || count(*) FROM public.monitor_heartbeats WHERE tournament_id = '$1';"; }
NOT_AUTH="fehler:Not authorized to modify this tournament"
# Widerrufene Mitgliedschaft (angenommen, dann widerrufen). protect_collaborator_row lehnt ein UPDATE auch fuer postgres ab
# -> loeschen und mit declined_at neu anlegen (wie scripts/coadmin-vorlage-check.sh V2b).
REVOKED="DELETE FROM public.tournament_collaborators WHERE id = '$C_MARIA';
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at, declined_at, label)
VALUES ('$C_MARIA', '$T_NORD', '$U_MARIA', 'co-admin', now(), now(), 'Maria');"

# Urteile (Ergebnis UND Wert danach)
v_public() { local r="${1%%|*}" c="${1#*|}"
  if [[ "$r" =~ $ALPHABET_RE && "$c" == "true|$r|neu" ]]; then echo gelingt
  elif [[ "$r" == "$NOT_AUTH" && "$c" == "false|NULL|NULL" ]]; then echo abgelehnt; else echo "anders($1)"; fi; }
v_on_shared() { # private/regenerate/erneut teilen auf einem Turnier mit OLD_CODE
  local r="${1%%|*}" c="${1#*|}"
  if [[ "$r" == "ok" && "$c" == "false|NULL|NULL" ]]; then echo zurueckgenommen
  elif [[ "$r" == "$OLD_CODE" && "$c" == "true|$OLD_CODE|alt" ]]; then echo code-bleibt
  elif [[ "$r" =~ $ALPHABET_RE && "$r" != "$OLD_CODE" && "$c" == "true|$r|neu" ]]; then echo neuer-code
  elif [[ "$r" == "$NOT_AUTH" && "$c" == "true|$OLD_CODE|alt" ]]; then echo abgelehnt; else echo "anders($1)"; fi; }
v_read() { local r="${1%%|*}"; [[ "$r" == fehler:permission\ denied* ]] && r=0; echo "$r"; }

setup_data() {
  # auth.users gehoert nicht postgres -- die Harness-Spalte legt supabase_admin an (nur im Wegwerf-Container).
  docker exec -e PGPASSWORD=postgres "$CURRENT_CONTAINER" psql -U supabase_admin -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 \
    -c "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;" </dev/null
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       CASE WHEN u.email IS NULL THEN NULL ELSE now() END,
       CASE WHEN u.email IS NULL THEN '{"provider":"anonymous","providers":["anonymous"]}'::jsonb
            ELSE '{"provider":"email","providers":["email"]}'::jsonb END, '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@ca2.test'), ('$U_MARIA'::uuid, 'maria@ca2.test'), ('$U_GRETA'::uuid, 'greta@ca2.test'),
             ('$U_RAUCH'::uuid, '$M_RAUCH'), ('$U_TOM'::uuid, NULL), ('$U_SCREEN'::uuid, NULL)) AS u(id, email);
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config) VALUES
  ('$T_NORD', '$U_OLLI', 'Hallencup Nord', '2026-11-28', 4, 10, '{"publishedAt":"2026-10-20T00:00:00.000Z"}'::jsonb),
  ('$T_WINTER', '$U_OLLI', 'Wintercup', '2026-12-05', 4, 10, '{"publishedAt":"2026-10-20T00:00:00.000Z"}'::jsonb),
  ('$T_RAUCH', '$U_OLLI', 'Nikolaus-Rauchtest', '2026-11-28', 4, 10, '{"publishedAt":"2026-10-20T00:00:00.000Z"}'::jsonb);
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at, label) VALUES
  ('$C_MARIA', '$T_NORD', '$U_MARIA', 'co-admin', now(), 'Maria');
INSERT INTO public.monitors (id, tournament_id, name) VALUES
  ('$MON_NORD', '$T_NORD', 'Hallenmonitor Halle'), ('$MON_WINTER', '$T_WINTER', 'Hallenmonitor Wintercup'),
  ('$MON_RAUCH', '$T_RAUCH', 'Hallenmonitor Rauchtest');
INSERT INTO public.monitor_heartbeats (monitor_id, tournament_id, last_seen, slide_index, user_agent) VALUES
  ('$MON_NORD', '$T_NORD', now(), 1, 'ca2-check'), ('$MON_WINTER', '$T_WINTER', now(), 1, 'ca2-check');
SQL
}
# Geraete-Rollen gibt es erst ab _002 (Rollen-CHECK) -- nach dem Fenster anlegen.
setup_device_members() {
  psql_stdin <<SQL
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) VALUES
  ('$T_NORD', '$U_TOM', 'helper', now(), 'Tom'), ('$T_NORD', '$U_SCREEN', 'screen', now(), 'Hallen-Rechner');
SQL
}

# ---------------------------------------------------------------------------------------------------------
# R: Szenario-Zeilen (gemeinsam fuer normalen Lauf, ohne Migration und Gegenprobe)
run_probes() {
  local who uid exp
  # @BM-070 Beispiele: Olli und Maria teilen, Tom (Helfer) nicht; dazu Hallen-Rechner, Greta, Mama Petra.
  for who in "Olli:$U_OLLI:gelingt" "Maria:$U_MARIA:gelingt" "Tom:$U_TOM:abgelehnt" "Hallen-Rechner:$U_SCREEN:abgelehnt" \
             "Greta:$U_GRETA:abgelehnt" "Mama Petra (anon):"":abgelehnt"; do
    IFS=: read -r name uid exp <<<"$who"
    check R "@BM-070 $name teilt den „Hallencup Nord“ online" "$exp" "$(v_public "$(probe "$uid" "" "$(PUBLIC "$T_NORD")" "$(ROW "$T_NORD")")")"
  done
  # Maria teilt -> ein Zuschauer findet das Turnier sofort ueber den Code (Ollis Geraet zeigt denselben Code: eine Zeile)
  check R "@BM-070 Maria teilt: Zuschauer (anon) findet das Turnier ueber den Code" "1" \
    "$(probe "$U_MARIA" "" "SELECT x.share_code AS code FROM public.make_tournament_public('$T_NORD') AS x \\gset
RESET ROLE; SET LOCAL ROLE anon; SET LOCAL request.jwt.claim.sub = ''; SET LOCAL request.jwt.claims = '';
SELECT 'r:' || count(*) FROM public.tournaments WHERE share_code = :'code';" "1" | cut -d'|' -f1)"
  # Maria nimmt das Teilen zurueck -> der alte Code findet nichts mehr
  check R "@BM-070 Maria nimmt das Teilen zurueck (Code weg)" "zurueckgenommen" \
    "$(v_on_shared "$(probe "$U_MARIA" "$(SHARED "$T_NORD")" "$(PRIVATE "$T_NORD")" "$(ROW "$T_NORD")")")"
  check R "@BM-070 nach dem Zuruecknehmen: Zuschauer findet ueber den alten Code nichts" "0" \
    "$(probe "$U_MARIA" "$(SHARED "$T_NORD")" "$(PRIVATE "$T_NORD")
RESET ROLE; SET LOCAL ROLE anon; SET LOCAL request.jwt.claim.sub = ''; SET LOCAL request.jwt.claims = '';
SELECT 'r:' || count(*) FROM public.tournaments WHERE share_code = '$OLD_CODE';" "1" | cut -d'|' -f1 | sed 's/^ok,//')"
  check R "@BM-070 gegen-Tom nimmt das Teilen nicht zurueck" "abgelehnt" \
    "$(v_on_shared "$(probe "$U_TOM" "$(SHARED "$T_NORD")" "$(PRIVATE "$T_NORD")" "$(ROW "$T_NORD")")")"
  # Code erneuern
  check R "@BM-070 Maria erneuert den Code (neuer Code im Serveralphabet)" "neuer-code" \
    "$(v_on_shared "$(probe "$U_MARIA" "$(SHARED "$T_NORD")" "$(REGENERATE "$T_NORD")" "$(ROW "$T_NORD")")")"
  check R "@BM-070 gegen-Greta erneuert den Code nicht" "abgelehnt" \
    "$(v_on_shared "$(probe "$U_GRETA" "$(SHARED "$T_NORD")" "$(REGENERATE "$T_NORD")" "$(ROW "$T_NORD")")")"
  check R "Bestand (Auflage 4): Code erneuern auf nicht oeffentlichem Turnier erzeugt einen Code, is_public bleibt false" "neu-nicht-oeffentlich" \
    "$(r="$(probe "$U_MARIA" "" "$(REGENERATE "$T_NORD")" "$(ROW "$T_NORD")")"; c="${r%%|*}"; [[ "$c" =~ $ALPHABET_RE && "${r#*|}" == "false|$c|neu" ]] && echo neu-nicht-oeffentlich || echo "anders($r)")"
  # Code bleibt beim erneuten Teilen (Auflage 5)
  check R "@BM-070 Maria teilt ein schon geteiltes Turnier erneut: der Code bleibt" "code-bleibt" \
    "$(v_on_shared "$(probe "$U_MARIA" "$(SHARED "$T_NORD")" "$(PUBLIC "$T_NORD")" "$(ROW "$T_NORD")")")"
  check R "@BM-070 Olli teilt erneut: der Code bleibt" "code-bleibt" \
    "$(v_on_shared "$(probe "$U_OLLI" "$(SHARED "$T_NORD")" "$(PUBLIC "$T_NORD")" "$(ROW "$T_NORD")")")"
  check R "@BM-070 gegen-Tom bekommt auch den vorhandenen Code nicht" "abgelehnt" \
    "$(v_on_shared "$(probe "$U_TOM" "$(SHARED "$T_NORD")" "$(PUBLIC "$T_NORD")" "$(ROW "$T_NORD")")")"
  # Entwurf (HF001 bleibt)
  check R "@BM-070 gegen-Entwurf: Maria teilt ein nicht freigegebenes Turnier nicht (HF001, is_public bleibt false)" \
    "fehler:Tournament has not been released yet and cannot be made public|false|NULL|NULL" \
    "$(probe "$U_MARIA" "$(DRAFT "$T_NORD")" "$(PUBLIC "$T_NORD")" "$(ROW "$T_NORD")")"
  # Widerrufen: Maria nach Widerruf
  check R "@BM-070 gegen-widerrufen: Maria teilt nach dem Widerruf nicht mehr" "abgelehnt" \
    "$(v_public "$(probe "$U_MARIA" "$REVOKED" "$(PUBLIC "$T_NORD")" "$(ROW "$T_NORD")")")"

  # @ME-070: Lebenszeichen lesen
  for who in "Olli:$U_OLLI:1" "Maria:$U_MARIA:1" "Tom:$U_TOM:0" "Hallen-Rechner:$U_SCREEN:0" "Greta:$U_GRETA:0" "Mama Petra (anon):"":0"; do
    IFS=: read -r name uid exp <<<"$who"
    check R "@ME-070 $name liest das Lebenszeichen des „Hallenmonitor Halle“ (Zeilen)" "$exp" \
      "$(v_read "$(probe "$uid" "" "$(READ_HB "$T_NORD")" "1")")"
  done
  check R "@ME-070 gegen-Nachbarturnier: Maria sieht das Lebenszeichen des „Wintercup“ nicht" "0" \
    "$(v_read "$(probe "$U_MARIA" "" "$(READ_HB "$T_WINTER")" "1")")"
  check R "@ME-070 gegen-widerrufen: Maria sieht nach dem Widerruf nichts" "0" \
    "$(v_read "$(probe "$U_MARIA" "$REVOKED" "$(READ_HB "$T_NORD")" "1")")"
  check R "@ME-070 Maria sieht alle Lebenszeichen ohne Filter: nur die ihres Turniers" "1" \
    "$(v_read "$(probe "$U_MARIA" "" "SELECT 'r:' || count(*) FROM public.monitor_heartbeats;" "1")")"
}

# ---------------------------------------------------------------------------------------------------------
# R (Nebenlaeufigkeit, Review CA-2 Auflage 5b; Vorlage review-ca2/concurrency-check.sh): Maria teilt in einer offenen
# Transaktion und haelt sie 3 s; Olli teilt 1 s spaeter in einer zweiten Sitzung. Mit FOR UPDATE wartet Olli und bekommt
# Marias Code; ohne wuerfelt er neu und ueberschreibt ihn (Mutation M10). Committet -> Turnierzeile danach zuruecksetzen.
run_concurrency() {
  local a_file a b final
  a_file="$(mktemp)"
  q "UPDATE public.tournaments SET is_public = false, share_code = NULL, share_code_created_at = NULL WHERE id = '$T_NORD';" >/dev/null
  ( docker exec -i "$CURRENT_CONTAINER" psql -U postgres -X -q -tA <<SQL > "$a_file" 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
$(claims_sql "$U_MARIA")
SELECT 'A:' || x.share_code FROM public.make_tournament_public('$T_NORD') AS x;
SELECT pg_sleep(3);
COMMIT;
SQL
  ) &
  local a_pid=$!
  sleep 1
  b="$(als "$U_OLLI" "$(PUBLIC "$T_NORD")")"
  wait "$a_pid" || true
  a="$( (grep -m1 '^A:' "$a_file" || true) | cut -c3-)"
  rm -f "$a_file"
  final="$(q "SELECT coalesce(share_code, 'NULL') FROM public.tournaments WHERE id = '$T_NORD';")"
  check R "@BM-070 Maria und Olli teilen gleichzeitig: derselbe Code, Endstand = Marias Code (FOR UPDATE)" "gleich" \
    "$([[ -n "$a" && "$a" =~ $ALPHABET_RE && "$a" == "$b" && "$final" == "$a" ]] && echo gleich || echo "verschieden (Maria $a, Olli $b, Endstand $final)")"
  q "UPDATE public.tournaments SET is_public = false, share_code = NULL, share_code_created_at = NULL WHERE id = '$T_NORD';" >/dev/null
}

# ---------------------------------------------------------------------------------------------------------
# V: Rauchtest (Auflage 14) mit der Betreiber-Vorlage (CA-1). Committet -- eigenes Turnier "Nikolaus-Rauchtest".
vorlage_block() { # vorlage_block <n> -> SQL zwischen "-- ##### BLOCK n" und der naechsten "-- ##### "-Zeile, Platzhalter ersetzt
  awk -v n="$1" '$0 ~ "^-- ##### BLOCK " n "( |$)" {f=1; next} f && /^-- ##### / {exit} f {print}' "$VORLAGE" \
    | CA_TID="$T_RAUCH" CA_MAIL="$M_RAUCH" perl -pe 's/<turnier-id>/$ENV{CA_TID}/g; s/<mail>/$ENV{CA_MAIL}/g'
}
run_smoke() {
  if [[ ! -f "$VORLAGE" ]]; then
    check V "Rauchtest: Betreiber-Vorlage vorhanden ($VORLAGE)" "vorhanden" "fehlt -- Rauchtest uebersprungen"
    return 0
  fi
  local b1 b3 out code code2
  b1="$(vorlage_block 1)"; b3="$(vorlage_block 3)"
  check V "Vorlage: Block 1 und Block 3 gefunden" "ja|ja" "$([[ "$b1" == *"INSERT INTO public.tournament_collaborators"* ]] && echo ja || echo nein)|$([[ "$b3" == *"DELETE FROM public.tournament_collaborators"* ]] && echo ja || echo nein)"
  # Olli: Monitor sendet ein Lebenszeichen (record_monitor_heartbeat, heutiger Sendeweg)
  check V "Olli: Lebenszeichen des Rauchtest-Monitors gesendet" "ok" \
    "$(als "$U_OLLI" "SELECT 'r:ok' FROM (SELECT public.record_monitor_heartbeat('$MON_RAUCH', '$T_RAUCH', 1, 'fresh', 'ca2-rauchtest')) AS x;")"
  # Block 1 als Betreiber (SQL-Editor = postgres)
  set +e; out="$(psql_stdin <<<"$b1" 2>&1)"; local rc=$?; set -e
  check V "Betreiber: Block 1 traegt den Test-Co-Admin ein (Exit 0)" "0" "$rc"
  check V "danach genau eine co-admin-Zeile, angenommen, nicht widerrufen, vom Eigentuemer" "co-admin|t|t|t" \
    "$(q "SELECT c.role || '|' || (c.accepted_at IS NOT NULL)::text::char(1) || '|' || (c.declined_at IS NULL)::text::char(1) || '|' || (c.invited_by = '$U_OLLI')::text::char(1) FROM public.tournament_collaborators c WHERE c.tournament_id = '$T_RAUCH' AND c.user_id = '$U_RAUCH';")"
  # als Test-Co-Admin: teilen, Zuschauer findet, Code erneuern, Lebenszeichen lesen, erneut teilen, zuruecknehmen
  code="$(als "$U_RAUCH" "$(PUBLIC "$T_RAUCH")")"
  check V "Test-Co-Admin teilt online: Code im Serveralphabet" "ja" "$([[ "$code" =~ $ALPHABET_RE ]] && echo ja || echo "nein ($code)")"
  check V "Zuschauer (anon) findet das Turnier ueber diesen Code" "1" "$(als "" "SELECT 'r:' || count(*) FROM public.tournaments WHERE share_code = '$code';")"
  code2="$(als "$U_RAUCH" "$(REGENERATE "$T_RAUCH")")"
  check V "Test-Co-Admin erneuert den Code: neuer Code im Serveralphabet" "ja" \
    "$([[ "$code2" =~ $ALPHABET_RE && "$code2" != "$code" ]] && echo ja || echo "nein ($code -> $code2)")"
  check V "Test-Co-Admin teilt erneut: der erneuerte Code bleibt" "$code2" "$(als "$U_RAUCH" "$(PUBLIC "$T_RAUCH")")"
  check V "Test-Co-Admin liest die Lebenszeichen: 1 Zeile, ohne Fehler" "1" "$(als "$U_RAUCH" "$(READ_HB "$T_RAUCH")")"
  check V "@HE-086 gegen-Greta (nicht eingetragen): teilen abgelehnt" "$NOT_AUTH" "$(als "$U_GRETA" "$(PUBLIC "$T_RAUCH")")"
  check V "gegen-Greta: liest keine Lebenszeichen" "0" "$(als "$U_GRETA" "$(READ_HB "$T_RAUCH")")"
  check V "Test-Co-Admin nimmt das Teilen zurueck" "ok" "$(als "$U_RAUCH" "$(PRIVATE "$T_RAUCH")")"
  check V "danach: nicht oeffentlich, kein Code" "false|NULL" "$(q "SELECT is_public || '|' || coalesce(share_code, 'NULL') FROM public.tournaments WHERE id = '$T_RAUCH';")"
  # Block 3: Austragen sperrt sofort
  out="$(psql_value <<<"$b3" 2>&1 || true)"
  check V "@HE-087 Betreiber: Block 3 traegt aus (RETURNING genau eine co-admin-Zeile)" "1" "$(grep -c '|co-admin$' <<<"$out" || true)"
  check V "@HE-087 nach dem Austragen: Test-Co-Admin teilt nicht mehr" "$NOT_AUTH" "$(als "$U_RAUCH" "$(PUBLIC "$T_RAUCH")")"
  check V "@HE-087 nach dem Austragen: Test-Co-Admin liest keine Lebenszeichen" "0" "$(als "$U_RAUCH" "$(READ_HB "$T_RAUCH")")"
  check V "@HE-087 nach dem Austragen: Konto besteht weiter" "1" "$(q "SELECT count(*) FROM auth.users WHERE id = '$U_RAUCH';")"
}

# ---------------------------------------------------------------------------------------------------------
run_assertions() { # <erwartet t|f fuer die 3 CA-2-Zeilen>
  local priv names_sql names_sh want="$1"
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  check S "Rechte-Assertion: die 3 CA-2-Zeilen |$want" \
    "heartbeats-select-manage-screens|$want,make-public-keeps-existing-code|$want,share-rpcs-permission-based|$want" \
    "$(grep -E '^(share-rpcs-permission-based|make-public-keeps-existing-code|heartbeats-select-manage-screens)\|' <<<"$priv" | sort | paste -sd, -)"
  # A-16 (20261110_008): die helper-join-*-Zeilen der spaeteren Migration sind hier f (laeuft erst am Ende).
  # A-21a-S (20261113_003): die lifecycle-*-Zeilen der spaeteren Migration sind hier f (laeuft erst am Ende bzw. nie);
  check S "Rechte-Assertion: keine andere Zeile |f (ausser Zeilen der spaeteren Migrationen 20261110_005, 20261110_006)" "" \
    "$(grep -v '|t$' <<<"$priv" | grep -vE '^(lifecycle-[a-z0-9-]+)\|' | grep -vE '^(share-rpcs-permission-based|make-public-keeps-existing-code|heartbeats-select-manage-screens|matches-guard-engine-columns-forfeit-absent|append-match-events-writes-forfeit-absent|group-completion-[a-z-]+|complete-group-locks-matches-before-tournament|ci-schema-reader-select-group-completion|helper-join-[a-z0-9-]+)\|' || true)"
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
}
FN_STATE_SQL="SELECT string_agg(p.proname || ':' || p.prosecdef || ':' || p.proconfig::text || ':' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || ':' || has_function_privilege('anon', p.oid, 'EXECUTE') || ':' || pg_get_function_identity_arguments(p.oid) || ':' || pg_get_function_result(p.oid), ' # ' ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('make_tournament_public', 'make_tournament_private', 'regenerate_share_code');"

apply_pre_window() {
  echo "Baseline + ${#PRE_WINDOW[@]} Migration(en) vor dem Fenster einspielen..." >&2
  psql_stdin < "$BASELINE_FILE"
  local f
  for f in "${PRE_WINDOW[@]}"; do psql_stdin < "$f"; done
  setup_data
}
apply_window_before_target() {
  local f
  for f in "${WINDOW[@]}"; do echo "Fenster: $(basename "$f")" >&2; psql_stdin < "$f"; done
  setup_device_members
}

# ---------------------------------------------------------------------------------------------------------
if [[ "$MODE" == "gegenprobe" ]]; then
  MUTATIONS=(M1 M2 M3 M4 M5 M6 M7 M8 M9 M10)
  if [[ -n "${GEGENPROBE_NUR:-}" ]]; then read -r -a MUTATIONS <<<"$GEGENPROBE_NUR"; fi
  RED_TOTAL=0
  for mut in "${MUTATIONS[@]}"; do
    start_container "$mut"
    apply_pre_window
    apply_window_before_target
    MUT_KEY="$mut" python3 -c '
import os, sys
CHECK = "  IF NOT public.has_tournament_permission(tournament_id, '\''tournamentSettings'\'') THEN\n"
def nth(s, frm, to, n):
    parts = s.split(frm)
    if len(parts) != 4:
        sys.exit("Gegenprobe: Rechtepruefung nicht genau dreimal (%d)" % (len(parts) - 1))
    return frm.join(parts[:n]) + to + frm.join(parts[n:])
s = s0 = sys.stdin.read()
M = {
  # M1 Policy wieder an owner_id gebunden (Co-Admin-Zeilen rot)
  "M1": [("  USING (public.has_tournament_permission(tournament_id, '\''manageScreens'\''));\n",
          "  USING (tournament_id IN (SELECT id FROM public.tournaments WHERE owner_id = auth.uid()));\n")],
  # M2-M4 Rechtepruefung je Funktion weg (Fremd-/Helfer-Zeilen rot)
  "M2": "nth1", "M3": "nth2", "M4": "nth3",
  # M5 Freigabe-Sperre HF001 samt Block weg. Verhalten bleibt gleich (der Trigger tournaments_enforce_release_before_public,
  #    20260921_001, wirft denselben Fehler HF001 -- gleichwertige Mutante, im ersten Gegenprobe-Lauf belegt); die Assertion
  #    make-public-keeps-existing-code verlangt deshalb HF001 im Funktionstext und wird rot.
  "M5": [(s0[s0.index("  -- Freigabe-Backstop"):s0.index("  -- Code bleibt beim erneuten Teilen")], "")],
  # M6 Policy USING (true) (Nachbar-/Fremd-Zeilen rot)
  "M6": [("  USING (public.has_tournament_permission(tournament_id, '\''manageScreens'\''));\n", "  USING (true);\n")],
  # M7 manageScreens -> tournamentSettings in der Policy: Rechte-Zeilen bleiben gruen (beide Rollen haben beides),
  #    die Assertion am Policy-Text muss rot werden
  "M7": [("  USING (public.has_tournament_permission(tournament_id, '\''manageScreens'\''));\n",
          "  USING (public.has_tournament_permission(tournament_id, '\''tournamentSettings'\''));\n")],
  # M8 Code bleibt weg (Auflage 5): erneutes Teilen wuerfelt wieder neu
  "M8": [("  IF v_is_public AND v_existing_code IS NOT NULL THEN\n", "  IF false THEN\n")],
  # M9 Policy ohne TO authenticated (gilt fuer PUBLIC): Assertion rot
  "M9": [("  FOR SELECT TO authenticated\n", "  FOR SELECT\n")],
  # M10 FOR UPDATE weg (Kommentar bleibt): Nebenlaeufigkeitsprobe und Assertion rot (Review CA-2 Auflage 5)
  "M10": [("   WHERE t.id = tournament_id\n   FOR UPDATE;\n", "   WHERE t.id = tournament_id;\n")],
}
spec = M[os.environ["MUT_KEY"]]
if isinstance(spec, str):
    s = nth(s, CHECK, "  IF false THEN\n", int(spec[-1]))
else:
    for frm, to in spec:
        if s.count(frm) != 1:
            sys.exit("Gegenprobe: Muster in %s nicht genau einmal (%d): %r" % (os.environ["MUT_KEY"], s.count(frm), frm[:60]))
        s = s.replace(frm, to)
sys.stdout.write(s)' < "$TARGET_FILE" | psql_stdin
    reset_counts
    echo "--- GEGENPROBE $mut ---"
    run_probes
    run_concurrency
    run_assertions t
    run_smoke
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "GEGENPROBE $mut: rot ($(total_dev) Abweichung(en)) -- wie verlangt"
      RED_TOTAL=$((RED_TOTAL + 1))
    else
      echo "::error::GEGENPROBE $mut blieb gruen (zahnlos)"
    fi
    stop_container
  done
  echo
  echo "Gegenprobe: $RED_TOTAL von ${#MUTATIONS[@]} Mutationen rot."
  [[ "$RED_TOTAL" -eq "${#MUTATIONS[@]}" ]]
  exit $?
fi

start_container "$MODE"
apply_pre_window

if [[ "$MODE" == "without-migration" ]]; then
  apply_window_before_target
  run_probes
  run_concurrency
  run_smoke
  summary
  R_DEV="${DEVS[$(cat_index R)]}"; V_DEV="${DEVS[$(cat_index V)]}"
  if [[ "$R_DEV" -gt 0 && "$V_DEV" -gt 0 ]]; then
    echo "Ohne Migration: R und V rot -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (R=$R_DEV, V=$V_DEV muessen > 0 sein)."
  exit 1
fi

# --- F: Fail-fast ------------------------------------------------------------------------------------------
DUMP_PRE="$(schema_dump)"
set +e; F_OUT="$(psql_stdin < "$TARGET_FILE" 2>&1)"; F_RC=$?; set -e
check F "_004 vor _001/_002: bricht ab mit Hinweis" "abbruch|ja" \
  "$([[ "$F_RC" -ne 0 ]] && echo abbruch || echo "lief($F_RC)")|$([[ "$F_OUT" == *"zuerst _001 und _002 einspielen"* ]] && echo ja || echo "nein: $F_OUT")"
check F "_004 vor _001/_002: Schema unveraendert" "identisch" "$([[ "$(schema_dump)" == "$DUMP_PRE" ]] && echo identisch || echo verschieden)"
echo "Fenster: $(basename "${WINDOW[0]}")" >&2
psql_stdin < "${WINDOW[0]}"
DUMP_PRE="$(schema_dump)"
set +e; F_OUT="$(psql_stdin < "$TARGET_FILE" 2>&1)"; F_RC=$?; set -e
check F "_004 nach _001, vor _002: bricht ab mit Hinweis, Schema unveraendert" "abbruch|ja|identisch" \
  "$([[ "$F_RC" -ne 0 ]] && echo abbruch || echo "lief($F_RC)")|$([[ "$F_OUT" == *"zuerst _001 und _002 einspielen"* ]] && echo ja || echo nein)|$([[ "$(schema_dump)" == "$DUMP_PRE" ]] && echo identisch || echo verschieden)"
for f in "${WINDOW[@]:1}"; do echo "Fenster: $(basename "$f")" >&2; psql_stdin < "$f"; done
setup_device_members

# --- S vorher ---------------------------------------------------------------------------------------------
run_assertions f
DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
FN_BEFORE="$(q "$FN_STATE_SQL")"
DATA_SQL="SELECT (SELECT count(*) FROM public.tournaments) || '|' || (SELECT count(*) FROM public.tournament_collaborators) || '|' || (SELECT count(*) FROM public.monitor_heartbeats) || '|' || (SELECT string_agg(id || ':' || is_public || ':' || coalesce(share_code, '-'), ',' ORDER BY id) FROM public.tournaments);"
DATA_BEFORE="$(q "$DATA_SQL")"
echo "Fenster: $TARGET_NAME" >&2
psql_stdin < "$TARGET_FILE"

# --- S nachher --------------------------------------------------------------------------------------------
check S "Bestand: Turniere, Mitglieder, Lebenszeichen, Codes unveraendert (keine Datenaenderung)" "$DATA_BEFORE" "$(q "$DATA_SQL")"
check S "Funktionen: Signatur, Rueckgabe, SECURITY DEFINER, search_path, EXECUTE (authenticated/anon) unveraendert" "$FN_BEFORE" "$(q "$FN_STATE_SQL")"
check S "Policies auf monitor_heartbeats: genau heartbeats_select_v2 (SELECT, authenticated)" "heartbeats_select_v2|SELECT|{authenticated}" \
  "$(q "SELECT string_agg(policyname || '|' || cmd || '|' || roles::text, ',') FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitor_heartbeats';")"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in tables columns functions triggers policies indexes rls_tables; do
  check S "Katalogzaehlung $dim: Zuwachs 0" "0" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
run_assertions t

run_probes
run_concurrency
run_smoke

# --- W: zweites Einspielen --------------------------------------------------------------------------------
set +e; psql_stdin < "$TARGET_FILE" >/dev/null 2>&1; W_RC=$?; set -e
check W "_004 zweites Einspielen (Exit 0), Schema wie nach dem ersten" "0|identisch" "$W_RC|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"
W_DATA="$(q "$DATA_SQL")"
RP_SQL="SELECT string_agg(role || ':' || permission, ',' ORDER BY role, permission) FROM public.role_permissions;"
W_RP="$(q "$RP_SQL")"
# _001 (A-11) ist nach _002 NICHT wiederholbar: seine Endstand-Pruefung erwartet die 11 Zeilen vor A-27 (live dann 13)
# und bricht ab -- ohne Aenderung (eine Transaktion). Im Fenster deshalb kein zweites Einspielen von _001 nach _002.
set +e; W1_OUT="$(psql_stdin < "${WINDOW[0]}" 2>&1)"; W1_RC=$?; set -e
check W "_001 erneut nach _002: bricht ohne Aenderung ab (Endstand-Pruefung 11 statt 13 Zeilen)" "abbruch|weicht ab|identisch|gleich" \
  "$([[ "$W1_RC" -ne 0 ]] && echo abbruch || echo lief)|$([[ "$W1_OUT" == *"role_permissions weicht ab"* ]] && echo "weicht ab" || echo "anderer Text: $W1_OUT")|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)|$([[ "$(q "$RP_SQL")" == "$W_RP" ]] && echo gleich || echo verschieden)"
W_RCS=""
for f in "${WINDOW[@]:1}" "$TARGET_FILE"; do
  set +e; psql_stdin < "$f" >/dev/null 2>&1; rc=$?; set -e
  W_RCS="$W_RCS$(basename "$f" | cut -c1-12):$rc "
done
check W "_002, _003, _004 erneut in Fenster-Reihenfolge: je Exit 0" "20261110_002:0 20261110_003:0 20261110_004:0 " "$W_RCS"
check W "danach Schema wie nach dem ersten Einspielen, Daten und role_permissions gleich" "identisch|gleich|gleich" \
  "$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)|$([[ "$(q "$DATA_SQL")" == "$W_DATA" ]] && echo gleich || echo verschieden)|$([[ "$(q "$RP_SQL")" == "$W_RP" ]] && echo gleich || echo verschieden)"

# --- X: Rueckweg (Anhang B) -------------------------------------------------------------------------------
rueckweg_sql | psql_stdin
DUMP_ROLLED_BACK="$(schema_dump)"
check X "nach dem Rueckweg: Schema public = vor _004 (pg_dump identisch)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi
check X "nach dem Rueckweg: Maria (Co-Admin) teilt wieder nicht (alter Stand)" "abgelehnt" \
  "$(v_public "$(probe "$U_MARIA" "" "$(PUBLIC "$T_NORD")" "$(ROW "$T_NORD")")")"
check X "nach dem Rueckweg: Olli teilt weiter" "gelingt" "$(v_public "$(probe "$U_OLLI" "" "$(PUBLIC "$T_NORD")" "$(ROW "$T_NORD")")")"
psql_stdin < "$TARGET_FILE"
check X "danach erneut einspielbar (Schema = erstes Einspielen)" "identisch" "$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f"
  echo "OK    spaetere Migration laeuft: $(basename "$f")" >&2
done

summary
echo
echo "Ergebnis: $(total_dev) Abweichung(en)."
[[ "$(total_dev)" -eq 0 ]]
