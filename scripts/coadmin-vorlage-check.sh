#!/usr/bin/env bash
#
# coadmin-vorlage-check.sh -- Beweis fuer die Betreiber-Vorlage scripts/betrieb/co-admin-eintragen.sql
# (Paket CA, Task CA-1; Szenarien @HE-085, @HE-084, @HE-062, @W5-026).
#
# Die Vorlage wird WOERTLICH aus der SQL-Datei gelesen (Bloecke 0-3, Platzhalter <turnier-id> und <mail>
# werden nur ersetzt) und als Rolle postgres ausgefuehrt -- so wie im Dashboard-SQL-Editor.
#
# Zwei Betriebsarten:
#   (Standard)  LOKALER Supabase-Stack (Docker-Container supabase_db_*, localhost:54322). Der Stack wird NICHT
#               gestartet, gestoppt oder zurueckgesetzt. Konten entstehen ueber die Admin-Schnittstelle des
#               lokalen Auth-Dienstes (email_confirm: true = der Weg von "Add user"). Alle Testdaten
#               (Konten @example.org, Turniere "CA1-Pruefung ...") raeumt ein trap am Ende wieder ab.
#   --wegwerf   frischer Wegwerf-Container (supabase/postgres, nativ, per DOCKER_PLATFORM ueberschreibbar): Baseline + Migrationen bis VOR
#               20261110 (Stand vor A-11). Mit --mit-a11 zusaetzlich alle Migrationen ab 20261110 aus
#               supabase/migrations/ (Zielzustand A-11; A-27 liegt erst auf seinem Branch: ueber
#               --zusatz <datei.sql> nachspielen). Container wird am Ende entfernt (trap).
#
# Optionen:
#   --wegwerf             Wegwerf-Container statt lokalem Stack
#   --mit-a11             wie --wegwerf, dazu alle Migrationen mit Namen >= 20261110_
#   --zusatz <datei>      (wiederholbar, impliziert --wegwerf) weitere Migrationsdatei nach den uebrigen einspielen
#   --mutation <Mn>       (wiederholbar) Mutationsprobe: die Vorlage wird veraendert, der Lauf MUSS rot werden
#   --alle-mutationen     M1..M10 nacheinander
#   --bereitstellen       (nur lokaler Stack) legt die Testkonten und -turniere an, LAESST sie stehen und nennt die
#                         Platzhalterwerte -- fuer die Handprobe im SQL-Editor des lokalen Studio. Danach --aufraeumen.
#   --aufraeumen          (nur lokaler Stack) entfernt alle Testdaten dieses Skripts (Muster CA1-Pruefung / ca1-check-)
#   -h | --hilfe          diese Hilfe
#
# Pflichttests V1-V6 (je mit Gegenbeispiel), Mutationsproben M1-M5 aus dem Plan (plan-coadmin-einsatzfaehig.md,
# CA-1) plus M6 (Gaestesitzung), M7 (Austragen ohne Rollenfilter), M8 (unbestaetigtes Konto),
# M9 (aktive Zeile wird ersetzt), M10 (Konto-Suche ohne STRICT):
#   V1 Eintragen     V2/V2b Idempotenz + widerrufene Zeile   V3 Abbrueche ohne Nebenwirkung
#   V4 Austragen     V5 Kopie fuers Proben                   V6 Schnittstelle lehnt ab (@HE-062)
#
# Stand vor A-11 / vor A-27 wird erkannt und ausgewiesen ("erwartet vor F3"); die Erwartung der Rechte
# stammt aus src/features/auth/permissions/rolePermissions.json, nie aus dem Code der Vorlage.
#
# Exit 0 = alles wie erwartet (Basislauf gruen, jede Mutation rot). Exit != 0 sonst.
# Fasst die Produktion nie an: keine .env-Dateien, keine Cloud-URL, kein MCP.
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$REPO_ROOT/scripts/betrieb/co-admin-eintragen.sql"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
ROLES_JSON="$REPO_ROOT/src/features/auth/permissions/rolePermissions.json"
POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie rls-role-matrix.sh (Live-Version)
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}" # leer = Plattform des Rechners (nativ)
A11_PRAEFIX="20261110_"

MODE="stack"
AKTION="pruefen"
MIT_A11=0
ZUSATZ=()
MUTATIONEN=()

usage() { sed -n '2,/^set -uo/p' "${BASH_SOURCE[0]}" | sed -e '$d' -e 's/^# \{0,1\}//'; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wegwerf) MODE="wegwerf" ;;
    --mit-a11) MODE="wegwerf"; MIT_A11=1 ;;
    --zusatz) shift; [[ $# -gt 0 ]] || { echo "::error::--zusatz braucht eine Datei" >&2; exit 2; }
              MODE="wegwerf"; ZUSATZ+=("$1") ;;
    --mutation) shift; [[ $# -gt 0 ]] || { echo "::error::--mutation braucht Mn" >&2; exit 2; }
                MUTATIONEN+=("$1") ;;
    --bereitstellen) AKTION="bereitstellen" ;;
    --aufraeumen) AKTION="aufraeumen" ;;
    --alle-mutationen) MUTATIONEN=(M1 M2 M3 M4 M5 M6 M7 M8 M9 M10) ;;
    -h|--hilfe|--help) usage; exit 0 ;;
    *) echo "::error::Unbekannte Option: $1" >&2; exit 2 ;;
  esac
  shift
done

for tool in docker jq perl awk; do
  command -v "$tool" >/dev/null 2>&1 || { echo "::error::$tool wird benoetigt." >&2; exit 1; }
done
[[ -f "$TEMPLATE" ]] || { echo "::error::Vorlage fehlt: $TEMPLATE" >&2; exit 1; }

RAND="$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 8)"
CONTAINER=""
WEGWERF_CONTAINER=""
SERVICE_KEY=""
API_URL=""
CREATED_USER_IDS=()
KEEP=0
MUTLOG="$(mktemp "${TMPDIR:-/tmp}/ca1-mut.XXXXXX")"

# ------------------------------------------------------------------------------------------------
# Datenbank-Zugriff
# ------------------------------------------------------------------------------------------------
# Vorlage und Pruefungen laufen als postgres (wie der Dashboard-SQL-Editor); Aufbau-DDL im Wegwerf-Container
# als supabase_admin (Besitzer von auth.users).
psql_run() { docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -qtA -F'|' "$@"; }
psql_admin() { docker exec -i -e PGPASSWORD=postgres "$CONTAINER" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -qtA -F'|' "$@"; }
sq() { psql_run -c "$1"; }
# Migrationen: Hinweise (NOTICE) unterdruecken, Fehler bleiben sichtbar (Eingabe kommt per Umleitung)
# shellcheck disable=SC2119,SC2120
psql_mig() { docker exec -i -e PGOPTIONS='-c client_min_messages=warning' "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -qtA "$@"; }

# Fuehrt SQL-Text (stdin) aus; setzt OUT (stdout+stderr) und RC.
OUT=""; RC=0
run_text() {
  OUT="$(printf '%s\n' "$1" | psql_run 2>&1)"
  RC=$?
}

# ------------------------------------------------------------------------------------------------
# Aufraeumen (trap). Raeumt nur eigene Testdaten ab; im Wegwerf-Modus entfernt es den Container.
# ------------------------------------------------------------------------------------------------
sweep_testdata() {
  [[ -n "$CONTAINER" ]] || return 0
  sq "DELETE FROM public.tournament_collaborators WHERE tournament_id IN (SELECT id FROM public.tournaments WHERE title LIKE 'CA1-Pruefung %');" >/dev/null 2>&1
  sq "DELETE FROM public.tournaments WHERE title LIKE 'CA1-Pruefung %';" >/dev/null 2>&1
  local id
  if [[ -n "$SERVICE_KEY" ]]; then
    for id in ${CREATED_USER_IDS[@]+"${CREATED_USER_IDS[@]}"}; do
      curl -sS -o /dev/null -X DELETE "$API_URL/auth/v1/admin/users/$id" \
        -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" 2>/dev/null
    done
  fi
  # Reste frueherer, abgebrochener Laeufe (nur unser Mail-Muster)
  sq "DELETE FROM public.tournament_collaborators WHERE user_id IN (SELECT id FROM auth.users WHERE email ILIKE 'ca1-check-%@example.org') OR invited_by IN (SELECT id FROM auth.users WHERE email ILIKE 'ca1-check-%@example.org');" >/dev/null 2>&1
  sq "DELETE FROM auth.users WHERE email ILIKE 'ca1-check-%@example.org';" >/dev/null 2>&1
  return 0
}

# shellcheck disable=SC2329
cleanup() {
  local rc=$?
  trap - EXIT
  rm -f "$MUTLOG"
  if [[ "$KEEP" -eq 1 ]]; then
    echo "Testdaten bleiben stehen (--bereitstellen)." >&2
  elif [[ "$MODE" == "stack" ]]; then
    sweep_testdata
    if [[ -n "$CONTAINER" ]]; then
      local rest
      rest="$(sq "SELECT (SELECT count(*) FROM public.tournaments WHERE title LIKE 'CA1-Pruefung %') + (SELECT count(*) FROM auth.users WHERE email ILIKE 'ca1-check-%@example.org') + (SELECT count(*) FROM public.profiles WHERE email ILIKE 'ca1-check-%@example.org');" 2>/dev/null || echo '?')"
      if [[ "$rest" != "0" ]]; then
        echo "::warn::Aufraeumen unvollstaendig (Reste: $rest) -- Muster: Turniere 'CA1-Pruefung %', Konten 'ca1-check-%@example.org'." >&2
        [[ $rc -eq 0 ]] && rc=1
      else
        echo "Aufgeraeumt: keine Testdaten im lokalen Stack zurueckgeblieben." >&2
      fi
    fi
  elif [[ -n "$WEGWERF_CONTAINER" ]]; then
    docker rm -f "$WEGWERF_CONTAINER" >/dev/null 2>&1 || true
  fi
  exit "$rc"
}
trap cleanup EXIT

# ------------------------------------------------------------------------------------------------
# Umgebung herstellen
# ------------------------------------------------------------------------------------------------
setup_stack() {
  # Sperre: nur lokal (gleiche Pruefung wie fuer die Cloud-E2E)
  bash "$REPO_ROOT/scripts/require-local-stack.sh" || exit 1
  command -v supabase >/dev/null 2>&1 || { echo "::error::supabase-CLI wird benoetigt (nur 'supabase status')." >&2; exit 1; }
  local status
  status="$(cd "$REPO_ROOT" && supabase status -o json 2>/dev/null)" || { echo "::error::Kein laufender lokaler Stack." >&2; exit 1; }
  API_URL="$(printf '%s' "$status" | jq -r '.API_URL // empty')"
  SERVICE_KEY="$(printf '%s' "$status" | jq -r '.SERVICE_ROLE_KEY // .SECRET_KEY // empty')"
  local db_url
  db_url="$(printf '%s' "$status" | jq -r '.DB_URL // empty')"
  case "$db_url" in *127.0.0.1*|*localhost*) ;; *) echo "::error::DB_URL nicht lokal: abgebrochen." >&2; exit 1 ;; esac
  case "$API_URL" in http://127.0.0.1*|http://localhost*) ;; *) echo "::error::API_URL nicht lokal: abgebrochen." >&2; exit 1 ;; esac
  [[ -n "$SERVICE_KEY" ]] || { echo "::error::Kein lokaler Service-Key im Status." >&2; exit 1; }
  local project_id
  project_id="$(grep -m1 '^project_id' "$REPO_ROOT/supabase/config.toml" | sed -E 's/project_id[[:space:]]*=[[:space:]]*"([^"]+)"/\1/')"
  CONTAINER="$(docker ps --filter "name=supabase_db_${project_id}" --format '{{.Names}}' | head -n1)"
  [[ -n "$CONTAINER" ]] || { echo "::error::Kein laufender supabase_db_${project_id}-Container." >&2; exit 1; }
  echo "Betriebsart: lokaler Stack (Container $CONTAINER), Konten ueber die lokale Admin-Schnittstelle." >&2
  sweep_testdata
}

setup_wegwerf() {
  command -v shasum >/dev/null 2>&1 || true
  [[ -f "$BASELINE_FILE" ]] || { echo "::error::Baseline fehlt." >&2; exit 1; }
  local zf
  for zf in ${ZUSATZ[@]+"${ZUSATZ[@]}"}; do
    [[ -f "$zf" ]] || { echo "::error::--zusatz-Datei fehlt: $zf" >&2; exit 1; }
  done
  # shellcheck source=lib/migrations-since-baseline.sh
  # shellcheck disable=SC1091
  source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
  local raw
  raw="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1

  WEGWERF_CONTAINER="coadmin-vorlage-check-$$"
  CONTAINER="$WEGWERF_CONTAINER"
  docker run -d --name "$CONTAINER" ${DOCKER_PLATFORM:+--platform "$DOCKER_PLATFORM"} \
    -e POSTGRES_PASSWORD=postgres -p 5432 "$POSTGRES_IMAGE" >/dev/null || { echo "::error::Container-Start schlug fehl." >&2; exit 1; }
  local ready=0 n
  for _ in $(seq 1 180); do
    n="$(docker logs "$CONTAINER" 2>&1 | grep -c 'database system is ready to accept connections' || true)"
    if [[ "$n" -ge 2 ]]; then ready=1; break; fi
    sleep 1
  done
  [[ "$ready" -eq 1 ]] || { echo "::error::Container wurde nicht bereit." >&2; exit 1; }
  for _ in $(seq 1 30); do docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done

  echo "Baseline einspielen..." >&2
  psql_mig < "$BASELINE_FILE" >/dev/null || { echo "::error::Baseline schlug fehl." >&2; exit 1; }
  local f base
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    base="$(basename "$f")"
    if [[ "$MIT_A11" -eq 0 && "$base" > "$A11_PRAEFIX" ]]; then
      echo "  uebersprungen (Stand vor A-11): $base" >&2
      continue
    fi
    echo "  Migration: $base" >&2
    psql_mig < "$f" >/dev/null || { echo "::error::Migration schlug fehl: $base" >&2; exit 1; }
  done <<< "$raw"
  for zf in ${ZUSATZ[@]+"${ZUSATZ[@]}"}; do
    echo "  Zusatz: $(basename "$zf")" >&2
    psql_mig < "$zf" >/dev/null || { echo "::error::Zusatzdatei schlug fehl: $zf" >&2; exit 1; }
  done
  # Das Image bringt eine aeltere, minimale auth.users mit (ohne email_confirmed_at/is_anonymous). Der lokale
  # Stack und das Dashboard haben beide Spalten -- fuer die Vorlage nachbilden (nach den Migrationen,
  # wie ein echtes GoTrue-Schema).
  psql_admin -c "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz, ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;" >/dev/null \
    || { echo "::error::auth.users-Spalten konnten nicht ergaenzt werden." >&2; exit 1; }
  echo "Betriebsart: Wegwerf-Container $CONTAINER (mit A-11: $([[ $MIT_A11 -eq 1 ]] && echo ja || echo nein))." >&2
}

# Konto anlegen; setzt NEW_ID (kein Unterprozess, damit Merker und Abbrueche wirken).
# $1 = Mail, $2 = bestaetigt (true|false), $3 = Name
NEW_ID=""
make_user() {
  local mail="$1" confirmed="$2" name="$3"
  if [[ "$MODE" == "stack" ]]; then
    NEW_ID="$(curl -sS -X POST "$API_URL/auth/v1/admin/users" \
            -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H 'Content-Type: application/json' \
            -d "$(jq -nc --arg e "$mail" --arg p "Ca1-Pruefung-$RAND" --argjson c "$confirmed" --arg n "$name" \
                  '{email:$e,password:$p,email_confirm:$c,user_metadata:{name:$n}}')" | jq -r '.id // empty')"
    [[ -n "$NEW_ID" ]] || { echo "::error::Konto $mail konnte nicht angelegt werden." >&2; exit 1; }
    CREATED_USER_IDS+=("$NEW_ID")
  else
    NEW_ID="$(uuid_new)"
    local conf="now()"; [[ "$confirmed" == "true" ]] || conf="NULL"
    psql_run -c "INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES ('00000000-0000-0000-0000-000000000000', '$NEW_ID', 'authenticated', 'authenticated', '$mail', 'x', $conf, '{\"provider\":\"email\",\"providers\":[\"email\"]}', jsonb_build_object('name','$name'), now(), now());" >/dev/null \
      || { echo "::error::Konto $mail konnte nicht angelegt werden." >&2; exit 1; }
  fi
}
uuid_new() { docker exec "$CONTAINER" psql -U postgres -qtA -c "SELECT gen_random_uuid();"; }

# ------------------------------------------------------------------------------------------------
# Vorlage lesen, Platzhalter ersetzen, Mutationen
# ------------------------------------------------------------------------------------------------
MUT=""

# Teil der Vorlage zwischen zwei Markierungen
extract() {
  awk -v s="$1" -v e="$2" 'on && $0 ~ e {exit} !on && $0 ~ s {on=1} on' "$TEMPLATE"
}

raw_part() {
  case "$1" in
    0)  extract '^-- ##### BLOCK 0' '^-- ##### BLOCK 1' ;;
    1)  extract '^-- ##### BLOCK 1' '^-- ##### BLOCK 2a' ;;
    2a) extract '^-- ##### BLOCK 2a' '^-- ##### BLOCK 2b' ;;
    2b) extract '^-- ##### BLOCK 2b' '^-- 2c ' ;;
    3)  extract '^-- ##### BLOCK 3' '^-- ##### ENDE' ;;
    *)  echo "::error::Unbekannter Teil $1" >&2; return 1 ;;
  esac
}

# Mutation anwenden; bricht ab, wenn sie nichts veraendert (sonst waere die Probe wirkungslos)
mutate() {
  local m="$1" part="$2" text="$3" new
  case "$m" in
    M1) # UPDATE statt DELETE+INSERT
      new="$(printf '%s' "$text" | perl -0777 -pe "
        s/DELETE FROM public\.tournament_collaborators c\s+WHERE (c\.tournament_id = v_turnier AND c\.user_id = v_user AND c\.role = 'co-admin');/UPDATE public.tournament_collaborators c SET declined_at = NULL, accepted_at = now(), invited_by = v_owner WHERE \$1;\n  IF NOT FOUND THEN/;
        s/(\(v_turnier, v_user, 'co-admin', v_owner, now\(\), now\(\), v_name\);)/\$1\n  END IF;/;")" ;;
    M2) # ohne accepted_at
      new="$(printf '%s' "$text" | perl -0777 -pe "
        s/\(tournament_id, user_id, role, invited_by, invited_at, accepted_at, label\)/(tournament_id, user_id, role, invited_by, invited_at, label)/;
        s/\(v_turnier, v_user, 'co-admin', v_owner, now\(\), now\(\), v_name\);/(v_turnier, v_user, 'co-admin', v_owner, now(), v_name);/;")" ;;
    M3) # ohne invited_by
      new="$(printf '%s' "$text" | perl -0777 -pe "
        s/\(tournament_id, user_id, role, invited_by, invited_at, accepted_at, label\)/(tournament_id, user_id, role, invited_at, accepted_at, label)/;
        s/\(v_turnier, v_user, 'co-admin', v_owner, now\(\), now\(\), v_name\);/(v_turnier, v_user, 'co-admin', now(), now(), v_name);/;")" ;;
    M4) # Fremdrolle-Pruefung entfernt
      new="$(printf '%s' "$text" | perl -0777 -pe "
        s/  IF EXISTS \(SELECT 1 FROM public\.tournament_collaborators c\s+WHERE c\.tournament_id = v_turnier AND c\.user_id = v_user AND c\.role <> 'co-admin'\) THEN\s+RAISE EXCEPTION [^;]*;\s+END IF;\n//;")" ;;
    M5) # Eigentuemer-Pruefung entfernt
      new="$(printf '%s' "$text" | perl -0777 -pe "s/  IF v_user = v_owner THEN\s+RAISE EXCEPTION [^;]*;\s+END IF;\n//;")" ;;
    M6) # Gaestesitzung-Pruefung entfernt
      new="$(printf '%s' "$text" | perl -0777 -pe "s/  IF v_anonym THEN\s+RAISE EXCEPTION [^;]*;\s+END IF;\n//;")" ;;
    M7) # Austragen ohne Rollenfilter
      new="$(printf '%s' "$text" | perl -0777 -pe "s/   AND c\.role = 'co-admin'\n//;")" ;;
    M8) # Bestaetigungs-Pruefung entfernt
      new="$(printf '%s' "$text" | perl -0777 -pe "s/  IF v_bestaetigt IS NULL THEN\s+RAISE EXCEPTION [^;]*;\s+END IF;\n//;")" ;;
    M9) # aktive Zeile wird nicht mehr in Ruhe gelassen (immer ersetzen)
      new="$(printf '%s' "$text" | perl -0777 -pe "s/  IF EXISTS \(SELECT 1 FROM public\.tournament_collaborators c\s+WHERE c\.tournament_id = v_turnier AND c\.user_id = v_user AND c\.role = 'co-admin'\s+AND c\.accepted_at IS NOT NULL AND c\.declined_at IS NULL\) THEN\s+RAISE NOTICE [^;]*;\s+RETURN;\s+END IF;\n//;")" ;;
    M10) # Konto-Suche ohne STRICT (mehrdeutige Mail wird nicht bemerkt)
      new="$(printf '%s' "$text" | perl -0777 -pe "s/INTO STRICT/INTO/;")" ;;
    *) echo "::error::Unbekannte Mutation $m" >&2; exit 2 ;;
  esac
  if [[ "$new" == "$text" ]]; then
    echo "::error::Mutation $m aendert den Text von Teil $part nicht -- Vorlage und Probe passen nicht mehr zusammen." >&2
    exit 2
  fi
  printf '%s' "$new"
}

mutation_part() { case "$1" in M7) echo 3 ;; *) echo 1 ;; esac; }

# tpl <teil> <mail> <turnier-id>  -> fertiger SQL-Text
tpl() {
  local part="$1" mail="$2" tid="$3" text
  text="$(raw_part "$part")"
  [[ -n "$text" ]] || { echo "::error::Teil $part der Vorlage nicht gefunden." >&2; exit 2; }
  if [[ -n "$MUT" && "$(mutation_part "$MUT")" == "$part" ]]; then
    text="$(mutate "$MUT" "$part" "$text")"
  fi
  CA_MAIL="$mail" CA_TID="$tid" perl -pe 's/<turnier-id>/$ENV{CA_TID}/g; s/<mail>/$ENV{CA_MAIL}/g' <<< "$text"
}

# Fuehrt einen Teil der Vorlage aus: OUT/RC gesetzt
run_tpl() { run_text "$(tpl "$1" "$2" "$3")"; }

# ------------------------------------------------------------------------------------------------
# Pruef-Helfer
# ------------------------------------------------------------------------------------------------
PASS=0; FAIL=0; GAPS=0
ok()  { PASS=$((PASS+1)); [[ -n "$MUT" ]] || echo "  OK  $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ABWEICHUNG  $1${2:+ -- $2}"; }
gap() { GAPS=$((GAPS+1)); [[ -n "$MUT" ]] || echo "  BEKANNTE LUECKE  $1"; }
eq()  { if [[ "$2" == "$3" ]]; then ok "$1"; else bad "$1" "erwartet [$2], war [$3]"; fi; }
contains() { if [[ "$3" == *"$2"* ]]; then ok "$1"; else bad "$1" "Text '$2' fehlt in: $(printf '%s' "$3" | head -c 300)"; fi; }

RIGHTS_ALL="writeMatchData correctEvents leadMatches tournamentSettings teams restructure manageSchedule manageLifecycle manageScreens manageHelpers deleteTournament manageMembers"
RIGHTS_CO_ADMIN_IMMER="writeMatchData correctEvents leadMatches tournamentSettings teams restructure"
RIGHTS_CO_ADMIN_A11="manageSchedule manageLifecycle manageScreens manageHelpers"
# deleteTournament und manageMembers hat die Co-Admin nie (Erwartung "f" in co_admin_expect)

# Erwartung je Recht fuer die Co-Admin: t|f
co_admin_expect() {
  local r="$1"
  case " $RIGHTS_CO_ADMIN_IMMER " in *" $r "*) echo t; return ;; esac
  case " $RIGHTS_CO_ADMIN_A11 " in *" $r "*) [[ "$A11_LIVE" -eq 1 ]] && echo t || echo f; return ;; esac
  echo f
}

# check_rights <name> <ausgabe-von-2b> <person-id> <co|keine>
check_rights() {
  local name="$1" out="$2" person="$3" mode="$4" r line exp got bad_n=0
  for r in $RIGHTS_ALL; do
    line="$(printf '%s\n' "$out" | grep -F "|$r|" | head -n1)"
    if [[ "$mode" == "co" ]]; then exp="$(co_admin_expect "$r")"; else exp="f"; fi
    got="${line##*|}"
    if [[ "${line%%|*}" != "$person" ]]; then
      bad "$name: Recht $r" "Kontrollspalte geprueft_person [${line%%|*}] ist nicht [$person]"; bad_n=1
    elif [[ "$got" != "$exp" ]]; then
      bad "$name: Recht $r" "erwartet $exp, war [$got]"; bad_n=1
    fi
  done
  [[ $bad_n -eq 0 ]] && ok "$name: alle 12 Rechte wie erwartet"
}

collab_rows() { sq "SELECT count(*) FROM public.tournament_collaborators WHERE tournament_id = '$1' AND user_id = '$2';"; }
snapshot() { # Zeilenzahl + Pruefsumme aller Zeilen der drei Test-Turniere
  sq "SELECT count(*) || ':' || coalesce(md5(string_agg(c::text, ',' ORDER BY c.id)), '-') FROM public.tournament_collaborators c WHERE c.tournament_id IN ('$T_ORIG','$T_KOPIE','$T_DEL');"
}
fremd_snapshot() { # alle Zeilen ANDERER Turniere (nie anfassen)
  sq "SELECT count(*) || ':' || coalesce(md5(string_agg(c::text, ',' ORDER BY c.id)), '-') FROM public.tournament_collaborators c WHERE c.tournament_id NOT IN ('$T_ORIG','$T_KOPIE','$T_DEL');"
}
reset_rows() { sq "DELETE FROM public.tournament_collaborators WHERE tournament_id IN ('$T_ORIG','$T_KOPIE','$T_DEL');" >/dev/null; }

# ------------------------------------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------------------------------------
setup_fixtures() {
  local tag="ca1-check-$RAND"
  M_OLLI="$tag-olli@example.org"; M_MARIA="$tag-maria@example.org"; M_GRETA="$tag-greta@example.org"
  M_UNBEST="$tag-unbest@example.org"; M_ANON="$tag-geraet@example.org"; M_NIEMAND="$tag-niemand@example.org"
  make_user "$M_OLLI" true Olli; U_OLLI="$NEW_ID"
  make_user "$M_MARIA" true Maria; U_MARIA="$NEW_ID"
  make_user "$M_GRETA" true ""; U_GRETA="$NEW_ID"
  make_user "$M_UNBEST" false Unbestaetigt
  make_user "$M_ANON" true Geraet; U_ANON="$NEW_ID"
  # Zwei Konten, deren Mail sich nur in der Gross-/Kleinschreibung unterscheidet (Mehrdeutigkeit)
  M_DUP="$tag-dup@example.org"
  make_user "$M_DUP" true Dup1
  sq "INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', upper('$M_DUP'), 'x', now(), '{\"provider\":\"email\",\"providers\":[\"email\"]}', '{}', now(), now());" >/dev/null \
    || { echo "::error::Zweites Konto (Gross-/Kleinschreibung) konnte nicht angelegt werden." >&2; exit 1; }
  sq "UPDATE auth.users SET is_anonymous = true WHERE id = '$U_ANON';" >/dev/null \
    || { echo "::error::is_anonymous konnte nicht gesetzt werden." >&2; exit 1; }
  # Konten mit Fremdrolle (je Rolle eins); helper/screen gibt es erst mit A-27 (Rollen-CHECK)
  FR_ROLE=(collaborator trainer viewer); FR_UID=(); FR_MAIL=()
  if [[ "$(sq "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.tournament_collaborators'::regclass AND conname='tournament_collaborators_role_check';")" == *helper* ]]; then
    FR_ROLE+=(helper screen)
  fi
  local r
  for r in "${FR_ROLE[@]}"; do
    make_user "$tag-f-$r@example.org" true "Fremd-$r"
    FR_MAIL+=("$tag-f-$r@example.org"); FR_UID+=("$NEW_ID")
  done
  T_ORIG="$(uuid_new)"; T_KOPIE="$(uuid_new)"; T_DEL="$(uuid_new)"
  sq "INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, deleted_at) VALUES
        ('$T_ORIG',  '$U_OLLI', 'CA1-Pruefung $RAND Original',   '2026-11-28', 4, 10, NULL),
        ('$T_KOPIE', '$U_OLLI', 'CA1-Pruefung $RAND Kopie',      '2026-11-28', 4, 10, NULL),
        ('$T_DEL',   '$U_OLLI', 'CA1-Pruefung $RAND Geloescht',  '2026-11-28', 4, 10, now());" >/dev/null \
    || { echo "::error::Test-Turniere konnten nicht angelegt werden." >&2; exit 1; }
}

detect_state() {
  local n
  n="$(sq "SELECT count(*) FROM public.role_permissions WHERE role='co-admin' AND permission IN ('manageSchedule','manageLifecycle','manageScreens','manageHelpers');")"
  case "$n" in
    4) A11_LIVE=1 ;;
    0) A11_LIVE=0 ;;
    *) echo "::error::role_permissions gemischt (A-11 teilweise): $n von 4 manage*-Rechten bei co-admin." >&2; exit 1 ;;
  esac
  A27_GUARD="$(sq "SELECT count(*) FROM pg_trigger WHERE tgrelid='public.tournament_collaborators'::regclass AND tgname='protect_device_roles' AND NOT tgisinternal;")"
  if [[ "$A11_LIVE" -eq 1 ]]; then
    echo "Stand: A-11 LIVE (vier manage*-Rechte bei co-admin); A-27-Guard: $([[ $A27_GUARD -eq 1 ]] && echo ja || echo nein)." >&2
  else
    echo "Stand: VOR A-11 (erwartet vor F3: manageSchedule, manageLifecycle, manageScreens, manageHelpers = false); A-27-Guard: $([[ $A27_GUARD -eq 1 ]] && echo ja || echo nein)." >&2
  fi
}

# ------------------------------------------------------------------------------------------------
# Die Pruefungen V1-V6
# ------------------------------------------------------------------------------------------------
run_suite() {
  PASS=0; FAIL=0; GAPS=0
  local fremd_vorher fremd_nachher snap_v r exp_json
  fremd_vorher="$(fremd_snapshot)"
  reset_rows

  [[ -n "$MUT" ]] || echo "-- V0 Vorbedingungen"
  # Die Erwartung stammt aus der JSON, nicht aus dem Code: co-admin hat genau die zehn Rechte der Vorlage
  exp_json="$(jq -r '.roles["co-admin"] | sort | join(" ")' "$ROLES_JSON")"
  eq "V0 rolePermissions.json: co-admin hat genau die zehn erwarteten Rechte" \
     "$(printf '%s\n' "$RIGHTS_CO_ADMIN_IMMER $RIGHTS_CO_ADMIN_A11" | tr ' ' '\n' | sort | tr '\n' ' ' | sed 's/ $//')" "$exp_json"
  run_tpl 0 "$M_MARIA" "$T_ORIG"
  eq "V0 Block 0 (Maria, noch nicht eingetragen): genau eine Zeile" "1" "$(printf '%s\n' "$OUT" | grep -c .)"
  contains "V0 Block 0: Titel des Turniers" "CA1-Pruefung $RAND Original" "$OUT"
  contains "V0 Block 0: Konto gefunden" "|$U_MARIA|" "$OUT"
  eq "V0 Block 0: bestaetigt, anonym = f, keine bestehende Rolle" "f|||" "$(printf '%s' "$OUT" | awk -F'|' '{print $6 "|" $7 "|" $8 "|" $9}')"
  run_tpl 0 "$M_ANON" "$T_ORIG"; eq "V0 Block 0: Gaestesitzung wird als anonym = t gezeigt" "t" "$(printf '%s' "$OUT" | cut -d'|' -f6)"
  run_tpl 0 "$M_NIEMAND" "$T_ORIG"; eq "V0 Block 0 Gegenbeispiel: Mail ohne Konto zeigt leeres Konto-Feld" "" "$(printf '%s' "$OUT" | cut -d'|' -f4)"
  run_tpl 0 "$M_MARIA" "00000000-0000-4000-8000-0000000000ff"; eq "V0 Block 0 Gegenbeispiel: unbekanntes Turnier zeigt leeres Turnier-Feld" "" "$(printf '%s' "$OUT" | cut -d'|' -f1)"

  [[ -n "$MUT" ]] || echo "-- V1 Eintragen (@HE-085)"
  run_tpl 1 "$M_MARIA" "$T_ORIG"
  local out_b1="$OUT"
  eq "V1 Block 1 laeuft ohne Fehler" "0" "$RC"
  contains "V1 Meldung 'Eingetragen'" "Eingetragen: $U_MARIA" "$out_b1"
  contains "V1 Block 1 endet mit der Ergebniszeile (co-admin, label)" "|co-admin|Maria|" "$out_b1"
  eq "V1 genau eine Zeile" "1" "$(collab_rows "$T_ORIG" "$U_MARIA")"
  run_tpl 2a "$M_MARIA" "$T_ORIG"
  eq "V1 Block 2a: co-admin | angenommen | nicht widerrufen | vom Eigentuemer" "co-admin|t|t|t" "$OUT"
  eq "V1 invited_by ist der Eigentuemer, invite_email bleibt leer" "$U_OLLI|" \
     "$(sq "SELECT invited_by || '|' || coalesce(invite_email,'') FROM public.tournament_collaborators WHERE tournament_id='$T_ORIG' AND user_id='$U_MARIA';")"
  eq "V1 label = Name aus den Benutzer-Metadaten" "Maria" "$(sq "SELECT label FROM public.tournament_collaborators WHERE tournament_id='$T_ORIG' AND user_id='$U_MARIA';")"
  run_tpl 2b "$M_MARIA" "$T_ORIG"
  eq "V1 Block 2b laeuft ohne Fehler" "0" "$RC"
  check_rights "V1 Rechte der Co-Admin (Block 2b)" "$OUT" "$U_MARIA" co
  local out_b2b="$OUT"
  # Gegenbeispiel: Konto ohne Eintrag hat keines der zwoelf Rechte (@HE-086)
  run_tpl 2b "$M_GRETA" "$T_ORIG"
  check_rights "V1 Gegenbeispiel Konto ohne Eintrag (Greta)" "$OUT" "$U_GRETA" keine
  run_tpl 2a "$M_GRETA" "$T_ORIG"; eq "V1 Gegenbeispiel: Block 2a fuer Greta ist leer" "" "$OUT"
  # Gegenprobe zur Plan-Variante (BEGIN ... SET LOCAL ROLE authenticated ... ROLLBACK): gleiches Ergebnis
  run_text "BEGIN;
SELECT set_config('request.jwt.claim.sub', '$U_MARIA', true);
SET LOCAL ROLE authenticated;
SELECT auth.uid() AS geprueft_person, p AS recht, public.has_tournament_permission('$T_ORIG', p) AS hat_es
  FROM unnest(ARRAY['writeMatchData','correctEvents','leadMatches','tournamentSettings','teams','restructure','manageSchedule','manageLifecycle','manageScreens','manageHelpers','deleteTournament','manageMembers']) AS p;
ROLLBACK;"
  eq "V1 Block 2b (ein Befehl) = Plan-Variante mit Rollenwechsel und ROLLBACK" \
     "$(printf '%s\n' "$out_b2b" | grep -F '|' | sort)" "$(printf '%s\n' "$OUT" | grep -E '^[0-9a-f-]{36}\|' | sort)"

  [[ -n "$MUT" ]] || echo "-- V2 Idempotenz"
  local zeile_vorher
  zeile_vorher="$(sq "SELECT c::text FROM public.tournament_collaborators c WHERE tournament_id='$T_ORIG' AND user_id='$U_MARIA';")"
  run_tpl 1 "$(printf '%s' "$M_MARIA" | tr '[:lower:]' '[:upper:]')" "$T_ORIG"
  eq "V2 zweite Ausfuehrung (Mail in Grossbuchstaben) laeuft ohne Fehler" "0" "$RC"
  contains "V2 Meldung 'Schon eingetragen'" "Schon eingetragen: $U_MARIA" "$OUT"
  eq "V2 weiterhin genau eine Zeile" "1" "$(collab_rows "$T_ORIG" "$U_MARIA")"
  eq "V2 aktive Zeile bleibt unveraendert (gleiche id, gleiche Daten)" "$zeile_vorher" \
     "$(sq "SELECT c::text FROM public.tournament_collaborators c WHERE tournament_id='$T_ORIG' AND user_id='$U_MARIA';")"
  run_tpl 2b "$M_MARIA" "$T_ORIG"; check_rights "V2 Rechte nach zweitem Lauf" "$OUT" "$U_MARIA" co
  # V2b: widerrufene Zeile (vorab als Wartungsrolle, ohne Trigger-Umweg: loeschen + mit declined_at neu anlegen)
  sq "DELETE FROM public.tournament_collaborators WHERE tournament_id='$T_ORIG' AND user_id='$U_MARIA';
      INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, invited_by, invited_at, accepted_at, declined_at)
        VALUES ('$T_ORIG','$U_MARIA','co-admin','$U_OLLI', now(), now(), now());" >/dev/null
  run_tpl 2b "$M_MARIA" "$T_ORIG"; check_rights "V2b Vorbedingung: widerrufene Zeile gibt keine Rechte" "$OUT" "$U_MARIA" keine
  run_tpl 1 "$M_MARIA" "$T_ORIG"
  eq "V2b Block 1 ersetzt die widerrufene Zeile ohne Fehler" "0" "$RC"
  eq "V2b weiterhin genau eine Zeile" "1" "$(collab_rows "$T_ORIG" "$U_MARIA")"
  eq "V2b declined_at ist wieder leer" "" "$(sq "SELECT coalesce(declined_at::text,'') FROM public.tournament_collaborators WHERE tournament_id='$T_ORIG' AND user_id='$U_MARIA';")"
  run_tpl 2b "$M_MARIA" "$T_ORIG"; check_rights "V2b Rechte wieder da" "$OUT" "$U_MARIA" co

  [[ -n "$MUT" ]] || echo "-- V3 Abbrueche ohne Nebenwirkung (@HE-084 = Gaestesitzung/Fremdrolle)"
  abbruch() { # name mail tid fragment
    snap_v="$(snapshot)"
    run_tpl 1 "$2" "$3"
    if [[ "$RC" -ne 0 ]]; then ok "V3 $1: Block 1 bricht ab"; else bad "V3 $1: Block 1 bricht ab" "Exit 0"; fi
    contains "V3 $1: Meldung" "$4" "$OUT"
    eq "V3 $1: Zeilen vorher = nachher" "$snap_v" "$(snapshot)"
  }
  abbruch "Mail ohne Konto" "$M_NIEMAND" "$T_ORIG" "Kein Konto mit dieser Mail"
  abbruch "Konto unbestaetigt" "$M_UNBEST" "$T_ORIG" "nicht bestätigt"
  abbruch "Gaestesitzung (anonym)" "$M_ANON" "$T_ORIG" "Gerätesitzung"
  abbruch "Eigentuemer-Konto" "$M_OLLI" "$T_ORIG" "Eigentümer dieses Turniers"
  abbruch "unbekannte Turnier-Kennung" "$M_GRETA" "00000000-0000-4000-8000-0000000000ff" "gibt es nicht"
  abbruch "geloeschtes Turnier" "$M_GRETA" "$T_DEL" "gelöscht"
  abbruch "mehrdeutige Mail (zwei Konten, nur Gross-/Kleinschreibung verschieden)" "$M_DUP" "$T_ORIG" "gehört mehreren Konten"
  abbruch "ungueltige Turnier-Kennung (Tippfehler)" "$M_GRETA" "kein-uuid" "invalid input syntax"
  local i
  for i in "${!FR_ROLE[@]}"; do
    r="${FR_ROLE[$i]}"
    sq "INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, invited_by, invited_at, accepted_at) VALUES ('$T_ORIG','${FR_UID[$i]}','$r','$U_OLLI', now(), now());" >/dev/null
    abbruch "vorhandene Fremdrolle '$r'" "${FR_MAIL[$i]}" "$T_ORIG" "Es gibt schon einen Eintrag mit anderer Rolle"
    eq "V3 Fremdrolle '$r' unveraendert" "$r" "$(sq "SELECT role FROM public.tournament_collaborators WHERE tournament_id='$T_ORIG' AND user_id='${FR_UID[$i]}';")"
  done
  eq "V3 Gegenbeispiel: Maria ist durch die Abbrueche nicht zusaetzlich eingetragen worden (weiter genau eine Zeile)" "1" "$(collab_rows "$T_ORIG" "$U_MARIA")"

  [[ -n "$MUT" ]] || echo "-- V4 Austragen (@HE-087)"
  # Gegenbeispiel zuerst: Block 3 fuer eine Person mit Fremdrolle loescht nichts
  snap_v="$(snapshot)"
  run_tpl 3 "${FR_MAIL[0]}" "$T_ORIG"
  eq "V4 Gegenbeispiel: Austragen bei Fremdrolle 'collaborator' liefert keine Zeile" "" "$OUT"
  eq "V4 Gegenbeispiel: Zeilen unveraendert" "$snap_v" "$(snapshot)"
  run_tpl 3 "$M_MARIA" "$T_ORIG"
  eq "V4 Block 3: RETURNING genau eine Zeile (co-admin)" "1" "$(printf '%s\n' "$OUT" | grep -c '|co-admin$')"
  eq "V4 keine Zeile mehr fuer Maria" "0" "$(collab_rows "$T_ORIG" "$U_MARIA")"
  run_tpl 2a "$M_MARIA" "$T_ORIG"; eq "V4 Block 2a danach: 0 Zeilen" "" "$OUT"
  run_tpl 2b "$M_MARIA" "$T_ORIG"; check_rights "V4 Rechte nach dem Austragen" "$OUT" "$U_MARIA" keine
  eq "V4 Konto besteht weiter" "1" "$(sq "SELECT count(*) FROM auth.users WHERE id='$U_MARIA';")"
  eq "V4 Profil besteht weiter" "1" "$(sq "SELECT count(*) FROM public.profiles WHERE id='$U_MARIA';")"
  eq "V4 Gegenbeispiel: die Vorlage enthaelt keinen Befehl, der Konten oder Profile loescht" "0" \
     "$(grep -v '^[[:space:]]*--' "$TEMPLATE" | grep -ciE 'delete[[:space:]]+from[[:space:]]+(auth\.|public\.profiles)|drop[[:space:]]+user|truncate' || true)"
  run_tpl 3 "$M_MARIA" "$T_ORIG"; eq "V4 zweites Austragen: keine Zeile, kein Fehler" "0:" "$RC:$OUT"

  [[ -n "$MUT" ]] || echo "-- V5 Kopie fuers Proben (@HE-085 'Aber', @W5-026)"
  run_tpl 1 "$M_MARIA" "$T_ORIG"
  local orig_id
  orig_id="$(sq "SELECT id FROM public.tournament_collaborators WHERE tournament_id='$T_ORIG' AND user_id='$U_MARIA';")"
  eq "V5 Eintrag im Original aendert nichts an der Kopie (keine Zeile dort)" "0" "$(collab_rows "$T_KOPIE" "$U_MARIA")"
  run_tpl 2b "$M_MARIA" "$T_KOPIE"; check_rights "V5 Gegenbeispiel: in der Kopie hat Maria keines der Rechte" "$OUT" "$U_MARIA" keine
  run_tpl 1 "$M_MARIA" "$T_KOPIE"
  eq "V5 zweiter Lauf mit der Kopie-Kennung traegt sie dort ein" "1" "$(collab_rows "$T_KOPIE" "$U_MARIA")"
  run_tpl 2b "$M_MARIA" "$T_KOPIE"; check_rights "V5 Rechte in der Kopie nach eigenem Eintrag" "$OUT" "$U_MARIA" co
  eq "V5 die Zeile im Original blieb dieselbe" "$orig_id" "$(sq "SELECT id FROM public.tournament_collaborators WHERE tournament_id='$T_ORIG' AND user_id='$U_MARIA';")"
  run_tpl 3 "$M_MARIA" "$T_KOPIE"
  eq "V5 Austragen aus der Kopie: genau eine Zeile" "1" "$(printf '%s\n' "$OUT" | grep -c '|co-admin$')"
  eq "V5 Maria bleibt im Original" "1" "$(collab_rows "$T_ORIG" "$U_MARIA")"
  run_tpl 2b "$M_MARIA" "$T_ORIG"; check_rights "V5 Rechte im Original nach Austragen aus der Kopie" "$OUT" "$U_MARIA" co

  [[ -n "$MUT" ]] || echo "-- V6 Gegenprobe Schnittstelle (@HE-062)"
  run_text "BEGIN;
SELECT set_config('request.jwt.claim.sub', '$U_OLLI', true);
SET LOCAL ROLE authenticated;
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, invited_by, invited_at, accepted_at)
  VALUES ('$T_ORIG', '$U_GRETA', 'co-admin', '$U_OLLI', now(), now());
ROLLBACK;"
  if [[ "$A27_GUARD" -eq 1 ]]; then
    if [[ "$RC" -ne 0 ]]; then ok "V6 Olli traegt Greta ueber die Schnittstelle ein: abgelehnt (A-27-Guard)"; else bad "V6 Schnittstelle lehnt ab" "INSERT als Eigentuemer fuer ein fremdes Konto gelang trotz A-27-Guard"; fi
    contains "V6 Ablehnungsgrund" "niemand wird ohne eigene Anfrage Mitglied" "$OUT"
  else
    if [[ "$RC" -ne 0 ]]; then
      ok "V6 Olli traegt Greta ueber die Schnittstelle ein: abgelehnt"
    else
      gap "V6 @HE-062 vor A-27: die Schnittstelle NIMMT den Eintrag des Eigentuemers fuer ein fremdes Konto an (collaborators_insert_v3 = manageMembers); schliesst mit A-27 (protect_device_roles)"
    fi
  fi
  eq "V6 nach dem Versuch ist keine Zeile fuer Greta uebrig (immer zurueckgerollt)" "0" "$(collab_rows "$T_ORIG" "$U_GRETA")"
  # Gegenstueck: die Vorlage als Wartungsrolle gelingt (V1) -- hier noch einmal fuer ein weiteres Konto, danach austragen
  run_tpl 1 "$M_GRETA" "$T_ORIG"; eq "V6 Vorlage (Wartungsrolle) traegt Greta ein" "0:1" "$RC:$(collab_rows "$T_ORIG" "$U_GRETA")"
  eq "V6 ohne Namen in den Metadaten: label = Anfang der Mail" "${M_GRETA%%@*}" "$(sq "SELECT label FROM public.tournament_collaborators WHERE tournament_id='$T_ORIG' AND user_id='$U_GRETA';")"
  run_tpl 3 "$M_GRETA" "$T_ORIG"; eq "V6 und wieder aus" "0" "$(collab_rows "$T_ORIG" "$U_GRETA")"

  [[ -n "$MUT" ]] || echo "-- V0b Nebenwirkungen"
  fremd_nachher="$(fremd_snapshot)"
  eq "V0b Zeilen fremder Turniere unveraendert (Pruefsumme)" "$fremd_vorher" "$fremd_nachher"
  reset_rows
  return 0
}

# ------------------------------------------------------------------------------------------------
# Hauptlauf
# ------------------------------------------------------------------------------------------------
if [[ "$AKTION" != "pruefen" && "$MODE" != "stack" ]]; then
  echo "::error::--bereitstellen/--aufraeumen gibt es nur fuer den lokalen Stack." >&2; exit 2
fi
if [[ "$MODE" == "stack" ]]; then setup_stack; else setup_wegwerf; fi
if [[ "$AKTION" == "aufraeumen" ]]; then exit 0; fi
setup_fixtures
detect_state
if [[ "$AKTION" == "bereitstellen" ]]; then
  KEEP=1
  echo "Bereitgestellt (bleibt stehen bis --aufraeumen):"
  echo "  turnier-id Original : $T_ORIG   (Kopie: $T_KOPIE, geloescht: $T_DEL)"
  echo "  mail Maria          : $M_MARIA   (Eigentuemer Olli: $M_OLLI)"
  echo "  mail Greta/Geraet/unbestaetigt/dup: $M_GRETA / $M_ANON / $M_UNBEST / $M_DUP"
  exit 0
fi

echo "== Basislauf (Vorlage unveraendert) =="
MUT=""
run_suite
BASE_FAIL=$FAIL
echo "Basislauf: $PASS OK, $FAIL Abweichung(en), $GAPS bekannte Luecke(n)."

SURVIVORS=()
if [[ ${#MUTATIONEN[@]} -gt 0 ]]; then
  echo "== Mutationsproben (jede MUSS rot werden) =="
  for m in "${MUTATIONEN[@]}"; do
    MUT="$m"
    run_suite >"$MUTLOG" 2>&1
    if [[ $FAIL -gt 0 ]]; then
      echo "  $m: ROT wie erwartet ($FAIL Abweichung(en); erste: $(grep -m1 ABWEICHUNG "$MUTLOG" | cut -c1-110))"
    else
      echo "  $m: UEBERLEBT -- die Pruefungen haben die Mutation nicht bemerkt!"
      SURVIVORS+=("$m")
    fi
  done
  MUT=""
fi

MUT_TEXT=""
[[ ${#MUTATIONEN[@]} -gt 0 ]] && MUT_TEXT=", Mutationen ${MUTATIONEN[*]} alle rot"
EXIT=0
if [[ $BASE_FAIL -ne 0 ]]; then echo "ERGEBNIS: Basislauf ROT."; EXIT=1; fi
if [[ ${#SURVIVORS[@]} -gt 0 ]]; then echo "ERGEBNIS: ueberlebende Mutationen: ${SURVIVORS[*]}"; EXIT=1; fi
[[ $EXIT -eq 0 ]] && echo "ERGEBNIS: GRUEN (Basislauf gruen$MUT_TEXT)."
exit $EXIT
