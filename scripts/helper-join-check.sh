#!/usr/bin/env bash
#
# helper-join-check.sh — Container-Beweis fuer supabase/migrations/20261110_008_helper_join.sql (A-16 Helfer-Beitritt per
# QR ohne Konto; Plan GA5 v2.1 § 3.1, Sicherheits-Review GA5 S-1..S-4, K-2..K-4). Aus dem Pruefskript des Plans
# (A-16-check-v21.sh) entstanden, Muster scripts/field-control-check.sh (Wegwerf-Container supabase/postgres, Baseline +
# Migrationen seit Baseline, Aufraeumen per trap, --without-migration, --gegenprobe, --print-rueckweg).
#
# Testwerte aus dem Gherkin (helfer-am-turniertag, anmelden, turnier-lebenszyklus): Turnierleitung Olli (Eigentuemer),
# Co-Admin Maria, Greta (Konto, leitet nicht), Tom (Handy und Tablet ohne Konto), Clara, Lena, ein Fremder; „Live-Cup“
# (laeuft, zwei Felder, geteilt), „Wintercup“ (nicht geteilt), „Entwurf-Cup“, eigene Turniere fuer Ablauf, Abschluss,
# Flut und Wettlauf, damit das „Gegeben“ jeder Gruppe woertlich gilt.
#
# Kategorien:
#   P  Positiv-Kontrolle zuerst (B1): offene Turniere gelten als offen, ein Code entsteht.
#   F  Fail-fast: fremde Trigger-Fassung, fehlende Loesch-Policy, fehlende Voraussetzung -> Abbruch ohne Aenderung.
#   R  Ablauf: Szenario-Zeilen mit Kennung und Gegenbeispiele (Rechte, Pruefzahl, Namen, Entzug, Ablauf, Wettlauf).
#   S  Katalog: Definer/search_path/Eigentuemer, Rechte, Positivliste, Policy, md5, Katalogzaehlung, Rechte-Assertion.
#   W  zweites Einspielen (idempotent).   X  Rueckweg -> Schema = vorher; zweiter Rueckweg vom md5-Waechter gestoppt.
#
# Aufrufoptionen:
#   bash scripts/helper-join-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/helper-join-check.sh --without-migration  Gegenprobe: ohne 20261110_008 -> P und R muessen ROT sein
#   bash scripts/helper-join-check.sh --gegenprobe         je Lauf eine Mutation einer KOPIE der Migration (M1-M20);
#                                                          Exit 0 nur, wenn JEDE Mutation mindestens eine Pruefung rot
#                                                          faerbt. Die Datei im Repo wird nie veraendert.
#   bash scripts/helper-join-check.sh --print-rueckweg     gibt den Rueckweg (Anhang B der Freigabe) aus, ohne Container
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container
# (nativ; DOCKER_PLATFORM=linux/amd64 waehlt die Plattform ausdruecklich), wird am Ende entfernt (trap).
#
set -uo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  --print-rueckweg) MODE="print-rueckweg" ;;
  *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe, --print-rueckweg)" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}"   # leer = nativ (arm64 auf dem Mac); z. B. linux/amd64 fuer die Plattform der CI
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261110_008_helper_join.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
PCR_SOURCE_FILE="$MIGRATIONS_DIR/20260924_003_declined_and_expired.sql"
POLICY_SOURCE_FILE="$MIGRATIONS_DIR/20260924_002_central_role_permissions.sql"
MD5_PCR_LIVE="4e0f2b4d408477ec8681090ad1e42342"   # protect_collaborator_row aus 20260924_003 (live, vom Controller gelesen)
MD5_PCR_A16="378a7e1ed6b72381c9b6924e0e664bc3"    # protect_collaborator_row nach A-16 (Abschnitt 11a, Durchgang mit Schalter)
CONTAINER_PREFIX="helper-join-check-$$"
CURRENT_CONTAINER=""
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/helper-join-check.XXXXXX")"

# protect_collaborator_row woertlich aus 20260924_003 (Abschnitt 4) -- Rueckweg und Fail-fast-Wiederherstellung.
pcr_live_sql() {
  awk '/^CREATE OR REPLACE FUNCTION "public"."protect_collaborator_row"\(\)/{f=1} f{print} f && $0=="$$;"{exit}' "$PCR_SOURCE_FILE"
}

# Rueckweg (Anhang B): Geraete-Zugaenge sperren (Zeilen bleiben), neue Objekte weg, Loesch-Policy v3 und Trigger-Rumpf
# woertlich zurueck. md5-Waechter: nur gegen die A-16-Fassung (sonst gemeinsamer Rueckweg mit B-20, I-3).
rueckweg_sql() {
  cat <<SQL
-- Rueckweg A-16 (20261110_008_helper_join.sql), erzeugt von scripts/helper-join-check.sh --print-rueckweg
-- Vorher: App ohne GA5-Client deployt, anonyme Anmeldungen AUS. Ein Block. Ist B-20 schon live (protect_collaborator_row/
-- collaborators_delete_v4 mitgenutzt), gilt der gemeinsame Rueckweg (I-3) -- der md5-Waechter bricht dann ohne Aenderung ab.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO \$\$
BEGIN   -- M4(c): nur zuruecknehmen, wenn noch die A-16-Fassung live ist
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.protect_collaborator_row()'::regprocedure) <> '$MD5_PCR_A16'
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'collaborators_delete_v4') THEN
    RAISE EXCEPTION 'Rueckweg A-16: protect_collaborator_row bzw. collaborators_delete_v4 nicht in der A-16-Fassung -- gemeinsamer Rueckweg (I-3)';
  END IF;
END \$\$;
-- Der Durchgang in protect_collaborator_row gilt nur mit dem Schalter (Review M-1); ohne ihn lehnt der Trigger dieses
-- UPDATE ab. SET LOCAL gilt nur in diesem Block, RESET nimmt ihn direkt danach zurueck.
SET LOCAL hallenfussball.helper_access_write = 'on';
UPDATE public.tournament_collaborators c SET declined_at = coalesce(c.declined_at, now())   -- Zugaenge sperren, Zeilen bleiben (Verlauf)
 WHERE c.id IN (SELECT member_id FROM public.tournament_join_requests WHERE member_id IS NOT NULL);
RESET hallenfussball.helper_access_write;
DROP TRIGGER IF EXISTS protect_helper_access_row ON public.tournament_collaborators;
DROP POLICY IF EXISTS collaborators_delete_v4 ON public.tournament_collaborators;
DROP FUNCTION IF EXISTS public.protect_helper_access_row(), public.match_event_author_devices(uuid),
  public.helper_request_count(uuid), public.is_device_membership(uuid, text), public.change_helper_access(uuid, text),
  public.decide_join_request(uuid, boolean, integer, smallint), public.list_helper_access(uuid),
  public.rotate_helper_code(uuid, text), public.ensure_helper_code(uuid), public.helper_access_status(uuid),
  public.request_helper_access(text, text, text), public.join_code_info(text), public.generate_helper_code(),
  public.tournament_closed_for_helpers(uuid), public.helper_code_cutoff(date);
DROP TABLE IF EXISTS public.tournament_join_requests;
DROP TABLE IF EXISTS public.tournament_join_codes;
-- collaborators_delete_v3 woertlich aus 20260924_002_central_role_permissions.sql
SQL
  awk '/^CREATE POLICY "collaborators_delete_v3"/{f=1} f{print} f && /^  \);$/{exit}' "$POLICY_SOURCE_FILE"
  echo "-- protect_collaborator_row woertlich aus 20260924_003_declined_and_expired.sql (Abschnitt 4)"
  pcr_live_sql
  echo "COMMIT;"
}
if [[ "$MODE" == "print-rueckweg" ]]; then
  rueckweg_sql
  exit 0
fi

command -v jq >/dev/null 2>&1 || { echo "::error::jq wird benoetigt." >&2; exit 1; }
if [[ "$MODE" != "without-migration" && ! -f "$TARGET_FILE" ]]; then
  echo "::error::$TARGET_NAME fehlt." >&2
  exit 1
fi

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
NEWER_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
BEFORE=()
AFTER=()
SEEN_TARGET=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if [[ "$(basename "$line")" == "$TARGET_NAME" ]]; then
    SEEN_TARGET=1
  elif [[ "$SEEN_TARGET" -eq 0 ]]; then
    BEFORE+=("$line")
  else
    AFTER+=("$line")
  fi
done <<< "$NEWER_RAW"
if [[ "$MODE" != "without-migration" && "$SEEN_TARGET" -ne 1 ]]; then
  echo "::error::$TARGET_NAME nicht in der Liste 'neuer als Baseline'." >&2
  exit 1
fi

cleanup() {
  [[ -n "$CURRENT_CONTAINER" ]] && docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1
  rm -rf "$WORK_DIR"
  return 0
}
trap cleanup EXIT

start_container() {
  CURRENT_CONTAINER="$CONTAINER_PREFIX-$1"
  docker run -d ${DOCKER_PLATFORM:+--platform "$DOCKER_PLATFORM"} --name "$CURRENT_CONTAINER" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 150); do
    if [[ "$(docker logs "$CURRENT_CONTAINER" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "::error::Container wurde nach 150s nicht bereit." >&2
    docker logs "$CURRENT_CONTAINER" 2>&1 | tail -30 >&2
    exit 1
  fi
  for _ in $(seq 1 30); do
    docker exec "$CURRENT_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
}
stop_container() { docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1; CURRENT_CONTAINER=""; }

psql_stdin() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q; }
# q <SQL> -- Wert als Superuser (Fehler als Text)
q() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA <<<"$1" 2>&1; }
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }

# Zaehler je Kategorie (bash 3.2: keine assoziativen Arrays).
CATS=(P F R S W X)
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
  h="$(printf '%s' "helper-join-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
# Konten: Olli (Eigentuemer), Maria (Co-Admin), Greta (Konto ohne Rolle). Geraetesitzungen ohne Konto: Tom Handy,
# Tom Tablet, Clara, Lena, Kai, Fremder, Fremder 2; weitere per newanon.
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_GRETA="$(uuid_for user:greta)"
U_TOM="$(uuid_for user:tom-handy)"; U_TOM_TABLET="$(uuid_for user:tom-tablet)"; U_CLARA="$(uuid_for user:clara)"
U_LENA="$(uuid_for user:lena)"; U_KAI="$(uuid_for user:kai)"; U_FREMD="$(uuid_for user:fremder)"; U_FREMD2="$(uuid_for user:fremder-2)"
ANON_UIDS=" $U_TOM $U_TOM_TABLET $U_CLARA $U_LENA $U_KAI $U_FREMD $U_FREMD2 "
T_LIVE="$(uuid_for tournament:live-cup)"; T_WINTER="$(uuid_for tournament:wintercup)"; T_DRAFT="$(uuid_for tournament:entwurf-cup)"
T_ABLAUF="$(uuid_for tournament:herbst-cup)"; T_ENDE="$(uuid_for tournament:abschluss-cup)"; T_VOLL="$(uuid_for tournament:flut-cup)"
T_RACE="$(uuid_for tournament:wettlauf-cup)"; T_ROT="$(uuid_for tournament:rotations-cup)"
TEAM_NORD="$(uuid_for team:nord)"; TEAM_SUED="$(uuid_for team:sued)"; M_SPIEL3="$(uuid_for match:spiel-3)"
# Ereignis-Zusaetze vorab (bash 3.2 verliert verschachtelte \"…\" in $(…) innerhalb von "…")
START_EXTRA='{"clockMs":null}'
GOAL_EXTRA="$(jq -cn --arg t "$TEAM_NORD" '{at: 2000, clockMs: 130000, teamId: $t}')"
GOAL_EXTRA_2="$(jq -cn --arg t "$TEAM_NORD" '{at: 3000, clockMs: 140000, teamId: $t}')"

setup_data() {
  local t
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', '{}', '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@a16.test'), ('$U_MARIA'::uuid, 'maria@a16.test'), ('$U_GRETA'::uuid, 'greta@a16.test'),
             ('$U_TOM'::uuid, NULL), ('$U_TOM_TABLET'::uuid, NULL), ('$U_CLARA'::uuid, NULL), ('$U_LENA'::uuid, NULL),
             ('$U_KAI'::uuid, NULL), ('$U_FREMD'::uuid, NULL), ('$U_FREMD2'::uuid, NULL)) u(id, email);
INSERT INTO public.profiles (id, display_name) VALUES ('$U_OLLI', 'Olli'), ('$U_MARIA', 'Maria'), ('$U_GRETA', 'Greta')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, number_of_fields, config, status, is_public, share_code) VALUES
  ('$T_LIVE', '$U_OLLI', 'Live-Cup', current_date + 1, 4, 10, 2, '{"publishedAt":"2026-10-01T00:00:00.000Z"}', 'live', true, 'LIVE01'),
  ('$T_WINTER', '$U_OLLI', 'Wintercup', current_date + 1, 4, 10, 2, '{}', 'published', false, NULL),
  ('$T_DRAFT', '$U_OLLI', 'Entwurf-Cup', current_date + 1, 4, 10, 2, '{}', 'draft', false, NULL),
  ('$T_ABLAUF', '$U_OLLI', 'Herbst-Cup', current_date + 1, 4, 10, 2, '{}', 'live', false, NULL),
  ('$T_ENDE', '$U_OLLI', 'Abschluss-Cup', current_date + 1, 4, 10, 2, '{}', 'live', false, NULL),
  ('$T_VOLL', '$U_OLLI', 'Flut-Cup', current_date + 1, 4, 10, 2, '{}', 'live', false, NULL),
  ('$T_RACE', '$U_OLLI', 'Wettlauf-Cup', current_date + 1, 4, 10, 2, '{}', 'live', false, NULL),
  ('$T_ROT', '$U_OLLI', 'Rotations-Cup', current_date + 1, 4, 10, 2, '{}', 'live', false, NULL);
INSERT INTO public.teams (id, tournament_id, name) VALUES ('$TEAM_NORD', '$T_LIVE', 'FC Nord'), ('$TEAM_SUED', '$T_LIVE', 'SV Süd');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start)
VALUES ('$M_SPIEL3', '$T_LIVE', 1, 2, '$TEAM_NORD', '$TEAM_SUED', 3, '10:00');
SQL
  [[ $? -eq 0 ]] || { echo "::error::Testdaten konnten nicht angelegt werden." >&2; exit 1; }
  for t in "$T_LIVE" "$T_WINTER" "$T_DRAFT" "$T_ABLAUF" "$T_ENDE" "$T_VOLL" "$T_RACE" "$T_ROT"; do
    q "INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) VALUES ('$t', '$U_MARIA', 'co-admin', now(), 'Maria');" >/dev/null
  done
  # Konto-Mitgliedschaft (Gegenprobe M2/K-3): Greta ist Zuschauerin im Live-Cup (keine Zeile aus dem QR-Beitritt).
  q "INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) VALUES ('$T_LIVE', '$U_GRETA', 'viewer', now(), 'Greta');" >/dev/null
}

# als <uid|leer> <SQL> -- als Client (authenticated mit Claims; leer = anon ohne Sitzung). Fehler -> "ERR:<Meldung>".
als() {
  local uid="$1" sql="$2" role=authenticated an=false out cl=""
  [[ -z "$uid" ]] && role=anon
  [[ "$ANON_UIDS" == *" $uid "* ]] && an=true
  [[ -n "$uid" ]] && cl="SET LOCAL request.jwt.claim.sub = '$uid'; SET LOCAL request.jwt.claims = '{\"sub\":\"$uid\",\"role\":\"authenticated\",\"is_anonymous\":$an}';"
  out="$(docker exec -i "$CURRENT_CONTAINER" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<EOF 2>&1
BEGIN; SET LOCAL ROLE $role; $cl
$sql
COMMIT;
EOF
)"
  if grep -q 'ERROR:' <<<"$out"; then echo "ERR:$(grep -m1 'ERROR:' <<<"$out" | sed 's/^.*ERROR: *//')"; else echo "$out"; fi
}
newanon() {
  q "INSERT INTO auth.users (instance_id, id, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     VALUES ('00000000-0000-0000-0000-000000000000', '$1', 'authenticated', 'authenticated', 'x', '{}', '{}', now(), now());" >/dev/null
  ANON_UIDS="$ANON_UIDS$1 "
}
# j <JSON> <jq-Filter> -- Feld aus einer Antwort; keine JSON -> Antwort selbst (z. B. ERR:...)
j() { jq -cr "$2" <<<"$1" 2>/dev/null || echo "$1"; }
code_of() { als "$U_OLLI" "SELECT public.ensure_helper_code('$1') ->> 'code';"; }
req_id() { q "SELECT id FROM public.tournament_join_requests WHERE tournament_id = '$1' AND device_user_id = '$2' ORDER BY created_at DESC LIMIT 1;"; }
check_no() { q "SELECT check_number FROM public.tournament_join_requests WHERE id = '$1';"; }
member_of() { q "SELECT id FROM public.tournament_collaborators WHERE tournament_id = '$1' AND user_id = '$2';"; }
perm() { als "$1" "SELECT public.has_tournament_permission('$2', 'writeMatchData');"; }
# goal_by <uid> <Ereignis-Schluessel> -- Tor in Spiel 3 ueber append_match_events (echter Weg); Antwort: status[:code]
append_by() {
  local events="$2" out
  out="$(als "$1" "SELECT public.append_match_events('$M_SPIEL3', \$J\$$events\$J\$::jsonb, 1, NULL);")"
  jq -r '[.results[]? | .status + (if .code then ":" + .code else "" end)] | join(",")' <<<"$out" 2>/dev/null || echo "$out"
}
ev() {
  local extra="${3:-}"
  [[ -z "$extra" ]] && extra='{}'
  jq -cn --arg type "$1" --arg id "$(uuid_for "event:$2")" --argjson extra "$extra" \
    '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, teamId: null, targetId: null, payload: {}} + $extra'
}
decide() { # decide <uid> <Anfrage> <true|false> [Feld|NULL] [Pruefzahl|NULL] -- Pruefzahl als smallint wie PostgREST
  local nr="${5:-NULL}"
  [[ "$nr" != "NULL" ]] && nr="$nr::smallint"
  als "$1" "SELECT public.decide_join_request('$2', $3, ${4:-NULL}, $nr);"
}
# als_mit <Vorbereitung als Superuser> <uid> <SQL> -- wie als, aber in einer nie committeten Transaktion mit Vorbereitung.
als_mit() {
  local setup="$1" uid="$2" sql="$3" an=false out
  [[ "$ANON_UIDS" == *" $uid "* ]] && an=true
  out="$(docker exec -i "$CURRENT_CONTAINER" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<EOF 2>&1
BEGIN;
$setup
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '$uid';
SET LOCAL request.jwt.claims = '{"sub":"$uid","role":"authenticated","is_anonymous":$an}';
$sql
ROLLBACK;
EOF
)"
  if grep -q 'ERROR:' <<<"$out"; then echo "ERR:$(grep -m1 'ERROR:' <<<"$out" | sed 's/^.*ERROR: *//')"; else echo "$out"; fi
}
HIDDEN_ZWSP="E'To\\u200Bm'"   # S-4: Tom mit Breite-null-Leerzeichen (SQL-Escape, bash 3.2 kennt kein \u)
HIDDEN_RLO="E'Tom\\u202E'"    # S-4: Tom mit Rechts-nach-links-Umschaltung

# ---------------------------------------------------------------------------------------------------------
# Proben (gemeinsam fuer normalen Lauf, ohne Migration und Gegenprobe)
# ---------------------------------------------------------------------------------------------------------
run_probes() {
  local code res r r_tom r_tab r_fremd r_fremd2 r_clara r_lena r_kai m_tom m_clara n n2 new u u2 u3 i old_code r_w MH_SETUP
  # --- P: Positiv-Kontrolle zuerst (B1) ---
  check P "P1 Live-Cup ('live', ohne finished_at/lifecycle_status) ist fuer Helfer offen" "f" "$(q "SELECT public.tournament_closed_for_helpers('$T_LIVE');")"
  check P "P2 Entwurf-Cup ('draft') ist offen" "f" "$(q "SELECT public.tournament_closed_for_helpers('$T_DRAFT');")"
  check P "P3 unbekanntes Turnier gilt als geschlossen" "t" "$(q "SELECT public.tournament_closed_for_helpers(gen_random_uuid());")"
  check P "P4 mit Spalte finished_at (NULL) weiter offen (Stand nach A-21a)" "f" \
    "$(q "BEGIN; ALTER TABLE public.tournaments ADD COLUMN finished_at timestamptz, ADD COLUMN lifecycle_status text; SELECT public.tournament_closed_for_helpers('$T_LIVE'); ROLLBACK;" | tail -1)"
  check P "P5 mit finished_at gesetzt geschlossen" "t" \
    "$(q "BEGIN; ALTER TABLE public.tournaments ADD COLUMN finished_at timestamptz; UPDATE public.tournaments SET finished_at = now() WHERE id = '$T_LIVE'; SELECT public.tournament_closed_for_helpers('$T_LIVE'); ROLLBACK;" | tail -1)"
  code="$(code_of "$T_LIVE")"
  check P "P6 @HE-091 Olli bekommt einen Helfer-Code (10 Zeichen ohne 0/O/1/I)" "1" "$([[ "$code" =~ ^[A-HJ-NP-Z2-9]{10}$ ]] && echo 1 || echo "$code")"

  # --- R: Code, Scan, Anfrage ---
  check R "@HE-091 Maria (Co-Admin) bekommt denselben Code" "$code" "$(code_of_as "$U_MARIA" "$T_LIVE")"
  check R "@HE-062 Toms Geraet (ohne Zulassung) und Greta (Konto ohne Rolle) holen keinen Code (42501)" "ERR:Not authorized|ERR:Not authorized" \
    "$(als "$U_TOM" "SELECT public.ensure_helper_code('$T_LIVE');")|$(als "$U_GRETA" "SELECT public.ensure_helper_code('$T_LIVE');")"
  res="$(als "" "SELECT public.join_code_info('$code');")"
  check R "@HE-033 @HE-004 Scan ohne Sitzung: offen, Turniername, Weg zur Zuschauer-Ansicht, keine Beziehung" "open|Live-Cup|LIVE01|none" \
    "$(j "$res" '[.state, .tournament.title, .shareCode, .relation] | join("|")')"
  check R "@HE-033 Scan ohne Sitzung legt keine Anfrage an (anon darf request_helper_access nicht)" "ERR:permission denied for function request_helper_access|0" \
    "$(als "" "SELECT public.request_helper_access('$code', 'Zuschauer');")|$(q "SELECT count(*) FROM public.tournament_join_requests;")"
  check R "@HE-103 nie vergebener Code: nur {state: invalid}, kein Turniername; Anfrage -> INVALID, keine Zeile" '{"state":"invalid"}|INVALID|0' \
    "$(j "$(als "" "SELECT public.join_code_info('ZZZZZZZZZZ');")" '.')|$(j "$(als "$U_FREMD" "SELECT public.request_helper_access('ZZZZZZZZZZ', 'Tom');")" '.result')|$(q "SELECT count(*) FROM public.tournament_join_requests;")"
  check R "@HE-089 @HE-079 Greta (Konto) -> ACCOUNT_SESSION, keine Anfrage" "ACCOUNT_SESSION|0" \
    "$(j "$(als "$U_GRETA" "SELECT public.request_helper_access('$code', 'Greta');")" '.result')|$(q "SELECT count(*) FROM public.tournament_join_requests WHERE device_user_id = '$U_GRETA';")"
  check R "@HE-091 Olli und Maria scannen -> Beziehung leader, keine Anfrage" "leader|leader|0" \
    "$(j "$(als "$U_OLLI" "SELECT public.join_code_info('$code');")" '.relation')|$(j "$(als "$U_MARIA" "SELECT public.join_code_info('$code');")" '.relation')|$(q "SELECT count(*) FROM public.tournament_join_requests;")"
  res="$(als "$U_TOM" "SELECT public.request_helper_access('$code', ' Tom ', 'Handy');")"
  check R "@HE-001 Tom (Handy) fragt an -> PENDING, Warteschirm mit Pruefzahl 10..99" "PENDING|pending|1" \
    "$(j "$res" '.result')|$(j "$res" '.relation')|$(j "$res" 'if (.checkNumber >= 10 and .checkNumber <= 99) then 1 else 0 end')"
  r_tom="$(req_id "$T_LIVE" "$U_TOM")"
  check R "@HE-021 Toms Handy zeigt dieselbe Pruefzahl wie Toms Anfrage bei Olli" "$(check_no "$r_tom")" \
    "$(j "$(als "$U_OLLI" "SELECT public.list_helper_access('$T_LIVE');")" ".requests[] | select(.id == \"$r_tom\") | .checkNumber")"
  check R "@HE-073 Tom vor der Zulassung: kein Schreibrecht, Tor beim Server -> FORBIDDEN_ACTOR" "f|rejected:FORBIDDEN_ACTOR" \
    "$(perm "$U_TOM" "$T_LIVE")|$(append_by "$U_TOM" "[$(ev MATCH_START tom-vorher "$START_EXTRA")]")"
  check R "@HE-073 Tom sieht weiter 'Wartet auf Freigabe' (pending)" "pending" "$(j "$(als "$U_TOM" "SELECT public.helper_access_status('$T_LIVE');")" '.relation')"
  check R "@HE-095-Gegenstueck: Tom scannt noch einmal -> EXISTING, genau 1 Anfrage" "EXISTING|1" \
    "$(j "$(als "$U_TOM" "SELECT public.request_helper_access('$code', 'Tom2');")" '.result')|$(q "SELECT count(*) FROM public.tournament_join_requests WHERE device_user_id = '$U_TOM';")"
  check R "@HE-062 Tom laesst sich selbst zu -> 42501" "ERR:Not authorized" "$(decide "$U_TOM" "$r_tom" true 2 "$(check_no "$r_tom")")"
  check R "@HE-082 Tom traegt sich direkt als Helfer ein -> abgelehnt" "1" \
    "$([[ "$(als "$U_TOM" "INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at) VALUES ('$T_LIVE', '$U_TOM', 'helper', now());")" == ERR:* ]] && echo 1 || echo 0)"
  check R "@HE-062 Olli traegt Clara an der App vorbei als Helferin ein -> Datenbank lehnt ab" "1|0" \
    "$([[ "$(als "$U_OLLI" "INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) VALUES ('$T_LIVE', '$U_CLARA', 'helper', now(), 'Clara');")" == ERR:* ]] && echo 1 || echo 0)|$(q "SELECT count(*) FROM public.tournament_collaborators WHERE user_id = '$U_CLARA';")"
  check R "Tom liest die Anfrage-Tabelle nicht direkt (permission denied)" "ERR:permission denied for table tournament_join_requests" \
    "$(als "$U_TOM" "SELECT count(*) FROM public.tournament_join_requests;")"
  check R "@HE-062 Greta (Konto ohne Rolle): Uebersicht und Zaehler -> 42501" "ERR:Not authorized|ERR:Not authorized" \
    "$(als "$U_GRETA" "SELECT public.list_helper_access('$T_LIVE');")|$(als "$U_GRETA" "SELECT public.helper_request_count('$T_LIVE');")"
  check R "@HE-051 S5 Maria: Zaehler 1, Uebersicht 1 offene Anfrage" "1|1" \
    "$(als "$U_MARIA" "SELECT public.helper_request_count('$T_LIVE');")|$(j "$(als "$U_MARIA" "SELECT public.list_helper_access('$T_LIVE');")" '.requests | length')"
  # Ruestung in der Tiefe (M3): selbst wenn die Rechtetabelle einer Geraete-Rolle manageHelpers gaebe, verwaltet keine Geraetesitzung Helfer.
  MH_SETUP="INSERT INTO public.role_permissions (role, permission) VALUES ('helper', 'manageHelpers') ON CONFLICT DO NOTHING;
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) VALUES ('$T_LIVE', '$U_KAI', 'helper', now(), 'Kai');"
  check R "Gegenprobe (nur in der Probe): Rechtetabelle gaebe Kais Geraete-Zugang manageHelpers" "t" \
    "$(als_mit "$MH_SETUP" "$U_KAI" "SELECT public.has_tournament_permission('$T_LIVE', 'manageHelpers');")"
  check R "Trotzdem verwaltet keine Geraetesitzung Helfer (is_real_account): entscheiden, Uebersicht, Code -> 42501" "ERR:Not authorized|ERR:Not authorized|ERR:Not authorized" \
    "$(als_mit "$MH_SETUP" "$U_KAI" "SELECT public.decide_join_request('$r_tom', false);")|$(als_mit "$MH_SETUP" "$U_KAI" "SELECT public.list_helper_access('$T_LIVE');")|$(als_mit "$MH_SETUP" "$U_KAI" "SELECT public.ensure_helper_code('$T_LIVE');")"

  # --- S-1 / @HE-105: Pruefzahl am Server ---
  n="$(check_no "$r_tom")"; [[ "$n" =~ ^[0-9]+$ ]] || n=10; n2=$(( n == 99 ? 10 : n + 1 ))
  check R "@HE-105 Maria laesst Tom mit falscher Pruefzahl zu -> CHECK_MISMATCH, Anfrage offen, kein Zugang" "CHECK_MISMATCH|pending|0|f" \
    "$(j "$(decide "$U_MARIA" "$r_tom" true 2 "$n2")" '.result')|$(q "SELECT status FROM public.tournament_join_requests WHERE id = '$r_tom';")|$(q "SELECT count(*) FROM public.tournament_collaborators WHERE user_id = '$U_TOM';")|$(perm "$U_TOM" "$T_LIVE")"
  check R "@HE-105 Zulassen ohne Pruefzahl -> CHECK_MISMATCH, nichts aendert sich" "CHECK_MISMATCH|pending|<null>" \
    "$(j "$(decide "$U_MARIA" "$r_tom" true 2)" '.result')|$(q "SELECT status FROM public.tournament_join_requests WHERE id = '$r_tom';")|$(q "SELECT coalesce(decided_by::text, '<null>') FROM public.tournament_join_requests WHERE id = '$r_tom';")"
  check R "@HE-105 Gegenbeispiel: mit der Pruefzahl des Handys laesst Maria Tom zu (Feld 2)" "OK" "$(j "$(decide "$U_MARIA" "$r_tom" true 2 "$n")" '.result')"
  check R "@HE-078 @AN-007 Tom: Schreibrecht im Live-Cup, nicht im Wintercup" "t|f" "$(perm "$U_TOM" "$T_LIVE")|$(perm "$U_TOM" "$T_WINTER")"
  check R "@AN-007 @AN-045 Tom legt kein eigenes Cloud-Turnier an" "1" \
    "$([[ "$(als "$U_TOM" "INSERT INTO public.tournaments (owner_id, title, date, number_of_teams, group_phase_duration, config) VALUES ('$U_TOM', 'Toms Cup', current_date, 4, 10, '{}');")" == ERR:* ]] && echo 1 || echo 0)"
  check R "@HE-006 Olli lehnt danach ab -> ALREADY_DECIDED, bereits von Maria entschieden (zugelassen)" "ALREADY_DECIDED|accepted|Maria" \
    "$(j "$(decide "$U_OLLI" "$r_tom" false)" '[.result, .status, .decidedBy] | join("|")')"
  check R "@HE-095 Tom scannt denselben Code noch einmal -> EXISTING, zugelassen, Feld 2, genau ein Zugang" "EXISTING|accepted|2|1" \
    "$(j "$(als "$U_TOM" "SELECT public.request_helper_access('$code', 'Tom');")" '[.result, .relation, (.field|tostring)] | join("|")')|$(q "SELECT count(*) FROM public.tournament_collaborators WHERE user_id = '$U_TOM';")"
  check R "@HE-098 Z.3-Vorstufe: Zugangsstatus zugelassen, Feld 2, nicht abgeschlossen" "accepted|2|false" \
    "$(j "$(als "$U_TOM" "SELECT public.helper_access_status('$T_LIVE');")" '[.relation, (.field|tostring), (.closed|tostring)] | join("|")')"
  m_tom="$(member_of "$T_LIVE" "$U_TOM")"
  check R "@HE-081 Tom traegt in Spiel 3 Anpfiff und Tor ein (echter Schreibweg)" "accepted,accepted" \
    "$(append_by "$U_TOM" "[$(ev MATCH_START tom-start "$START_EXTRA"),$(ev GOAL tom-tor "$GOAL_EXTRA")]")"
  check R "@HE-081 Verlauf: beide Eintraege nennen das Geraet 'Handy'" "Handy,Handy" \
    "$(als "$U_OLLI" "SELECT string_agg(coalesce(device_label, '-'), ',') FROM public.match_event_author_devices('$M_SPIEL3');")"
  check R "@HE-081 Gegenbeispiel: Greta (ohne Recht) liest die Geraete nicht (0 Zeilen)" "0" \
    "$(als "$U_GRETA" "SELECT count(*) FROM public.match_event_author_devices('$M_SPIEL3');")"
  q "INSERT INTO public.field_control (tournament_id, field, epoch, holder_user_id, holder_device_id, holder_device_label) VALUES ('$T_LIVE', 2, 1, '$U_TOM', '$(uuid_for device:tom-handy)', 'Handy');" >/dev/null
  als "$U_TOM" "SELECT public.helper_access_status('$T_LIVE');" >/dev/null
  res="$(als "$U_OLLI" "SELECT public.list_helper_access('$T_LIVE');")"
  check R "@HE-052 Uebersicht: 'Tom – Feld 2 – steuert', Geraet Handy, zuletzt gesehen gesetzt" "Tom|2|[2]|Handy|true" \
    "$(j "$res" ".members[] | select(.memberId == \"$m_tom\") | [.name, (.field|tostring), (.controls|tostring), .deviceLabel, (.lastSeenAt != null|tostring)] | join(\"|\")")"

  # --- @HE-106 / S-2: Hinweis bei bekanntem Namen; @HE-105 Fremder vor Tom ---
  check R "@HE-106 Z.1 Fremder fragt als 'Tom' an (Tom ist mit Handy zugelassen) -> PENDING" "PENDING" \
    "$(j "$(als "$U_FREMD" "SELECT public.request_helper_access('$code', 'Tom', 'Fremdes Handy');")" '.result')"
  r_fremd="$(req_id "$T_LIVE" "$U_FREMD")"
  res="$(als "$U_OLLI" "SELECT public.list_helper_access('$T_LIVE');")"
  check R "@HE-106 Z.1 Olli sieht 'Tom ist schon zugelassen (Handy)': sameName 2, offen 1, Geraet Handy" "2|1|Handy|null" \
    "$(j "$res" ".requests[] | select(.id == \"$r_fremd\") | [(.sameName|tostring), (.sameNamePending|tostring), .sameNameMember.deviceLabel, (.sameNameDeclinedAt|tostring)] | join(\"|\")")"
  n="$(check_no "$r_fremd")"; [[ "$n" =~ ^[0-9]+$ ]] || n=10; n2=$(( n == 99 ? 10 : n + 1 ))
  check R "@HE-105 Olli waehlt die Zahl, die nicht zur Anfrage gehoert -> kein Zugang fuer den Fremden" "CHECK_MISMATCH|0|f" \
    "$(j "$(decide "$U_OLLI" "$r_fremd" true 1 "$n2")" '.result')|$(q "SELECT count(*) FROM public.tournament_collaborators WHERE user_id = '$U_FREMD';")|$(perm "$U_FREMD" "$T_LIVE")"
  check R "@HE-004 Olli lehnt den Fremden ab (per Tipp) -> OK" "OK" "$(j "$(decide "$U_OLLI" "$r_fremd" false)" '.result')"
  check R "@HE-004 Fremder sieht 'Anfrage abgelehnt', kein Zugriff, erneuter Scan -> EXISTING abgelehnt" "declined|f|EXISTING|declined" \
    "$(j "$(als "$U_FREMD" "SELECT public.join_code_info('$code');")" '.relation')|$(perm "$U_FREMD" "$T_LIVE")|$(j "$(als "$U_FREMD" "SELECT public.request_helper_access('$code', 'Tom');")" '[.result, .relation] | join("|")')"
  als "$U_FREMD2" "SELECT public.request_helper_access('$code', 'tom ', NULL);" >/dev/null
  r_fremd2="$(req_id "$T_LIVE" "$U_FREMD2")"
  res="$(als "$U_OLLI" "SELECT public.list_helper_access('$T_LIVE');")"
  check R "@HE-106 Z.2 zweiter Fremder fragt als 'tom ' an -> Hinweis 'Name um … abgelehnt' mit dem Zeitpunkt der Ablehnung" \
    "3|1|Handy|$(q "SELECT to_json(decided_at) #>> '{}' FROM public.tournament_join_requests WHERE id = '$r_fremd';")" \
    "$(j "$res" ".requests[] | select(.id == \"$r_fremd2\") | [(.sameName|tostring), (.sameNamePending|tostring), .sameNameMember.deviceLabel, .sameNameDeclinedAt] | join(\"|\")")"

  # --- @HE-077: zweites Geraet; @HE-021: zwei offene 'Tom' ---
  res="$(als "$U_TOM_TABLET" "SELECT public.request_helper_access('$code', 'Tom', 'Tablet-mit-einer-sehr-langen-Bezeichnung-ueber-vierzig-Zeichen');")"
  r_tab="$(req_id "$T_LIVE" "$U_TOM_TABLET")"
  check R "@HE-077 Toms Tablet: eigene Anfrage; S3 Geraetebezeichnung auf 40 Zeichen gekuerzt" "PENDING|40" \
    "$(j "$res" '.result')|$(q "SELECT char_length(device_label) FROM public.tournament_join_requests WHERE id = '$r_tab';")"
  res="$(als "$U_OLLI" "SELECT public.list_helper_access('$T_LIVE');")"
  check R "@HE-021 zwei offene Anfragen 'Tom' mit Uhrzeit und verschiedener Pruefzahl, Hinweis '2 Anfragen'" "2|2|2|2" \
    "$(j "$res" "[.requests[] | select(.id == \"$r_tab\" or .id == \"$r_fremd2\") | .sameNamePending] | map(tostring) | join(\"|\")")|$(j "$res" "[.requests[] | select(.id == \"$r_tab\" or .id == \"$r_fremd2\") | .checkNumber] | unique | length")|$(j "$res" "[.requests[] | select(.id == \"$r_tab\" or .id == \"$r_fremd2\") | .createdAt | select(. != null)] | length")"
  check R "@HE-077 nach der Zulassung zeigt die Uebersicht zwei Zugaenge von Tom, je mit Geraet" "OK|2|Handy,Tablet-mit-einer-sehr-langen-Bezeichnung" \
    "$(j "$(decide "$U_OLLI" "$r_tab" true 2 "$(check_no "$r_tab")")" '.result')|$(j "$(als "$U_OLLI" "SELECT public.list_helper_access('$T_LIVE');")" '[.members[] | select(.name == "Tom")] | length')|$(j "$(als "$U_OLLI" "SELECT public.list_helper_access('$T_LIVE');")" '[.members[] | select(.name == "Tom") | .deviceLabel[0:44]] | sort | join(",")')"
  decide "$U_OLLI" "$r_fremd2" false >/dev/null

  # --- S-4: Steuer- und Formatzeichen ---
  check R "S-4 Name mit Breite-null-Zeichen bzw. Richtungsumschaltung -> INVALID_NAME (22023), keine Zeile" "ERR:INVALID_NAME|ERR:INVALID_NAME|0" \
    "$(als "$U_LENA" "SELECT public.request_helper_access('$code', $HIDDEN_ZWSP);")|$(als "$U_LENA" "SELECT public.request_helper_access('$code', $HIDDEN_RLO);")|$(q "SELECT count(*) FROM public.tournament_join_requests WHERE device_user_id = '$U_LENA';")"
  check R "S-4 Tabelle selbst lehnt verborgene Zeichen ab (CHECK, auch am Definer vorbei)" "1" \
    "$(q "INSERT INTO public.tournament_join_requests (tournament_id, code, device_user_id, display_name, check_number) VALUES ('$T_LIVE', '$code', '$U_LENA', $HIDDEN_ZWSP, 11);" | grep -c 'violates check constraint')"
  check R "S-4 Gegenbeispiel: 'Zoë Müller' ist erlaubt; Steuerzeichen in der Geraetebezeichnung werden entfernt" "PENDING|Zoë Müller|Handy" \
    "$(j "$(als "$U_LENA" "SELECT public.request_helper_access('$code', 'Zoë Müller', E'Han\\tdy\\u200B');")" '.result')|$(q "SELECT display_name || '|' || device_label FROM public.tournament_join_requests WHERE device_user_id = '$U_LENA';")"
  r_lena="$(req_id "$T_LIVE" "$U_LENA")"

  # --- @HE-084 / K-3: Rolle von Zeilen aus dem QR-Beitritt ---
  check R "@HE-084 Olli macht Toms Zugang direkt zur Co-Admin -> Server lehnt ab, Tom bleibt Helfer" "1|helper" \
    "$([[ "$(als "$U_OLLI" "UPDATE public.tournament_collaborators SET role = 'co-admin' WHERE id = '$m_tom';")" == ERR:* ]] && echo 1 || echo 0)|$(q "SELECT role FROM public.tournament_collaborators WHERE id = '$m_tom';")"
  check R "@HE-084 Maria (Co-Admin) aendert Toms Rolle direkt -> 0 Zeilen, Rolle bleibt" "|helper" \
    "$(als "$U_MARIA" "UPDATE public.tournament_collaborators SET role = 'co-admin' WHERE id = '$m_tom' RETURNING 'r';")|$(q "SELECT role FROM public.tournament_collaborators WHERE id = '$m_tom';")"

  # --- @HE-104 / M2: nie loeschen ---
  check R "@HE-104 Olli (Eigentuemer) loescht Toms Zugang an der App vorbei -> 0 Zeilen, Zugang bleibt" "0|1" \
    "$(als "$U_OLLI" "WITH d AS (DELETE FROM public.tournament_collaborators WHERE id = '$m_tom' RETURNING 1) SELECT count(*) FROM d;")|$(q "SELECT count(*) FROM public.tournament_collaborators WHERE id = '$m_tom';")"
  check R "@HE-104 Tom loescht den eigenen Zugang per REST -> 0 Zeilen" "0|1" \
    "$(als "$U_TOM" "WITH d AS (DELETE FROM public.tournament_collaborators WHERE id = '$m_tom' RETURNING 1) SELECT count(*) FROM d;")|$(q "SELECT count(*) FROM public.tournament_collaborators WHERE id = '$m_tom';")"
  check R "@HE-104 Verlauf nennt beim Tor weiter 'Tom (Helfer)'" "Tom|helper" \
    "$(als "$U_OLLI" "SELECT author_name || '|' || author_role FROM public.match_event_author_names('$M_SPIEL3') LIMIT 1;")"

  # --- Clara: zugelassen ohne Feld, dann nur zusehen (@HE-055 Z.2, K-2, K-3) ---
  als "$U_CLARA" "SELECT public.request_helper_access('$code', 'Clara', 'Tablet');" >/dev/null
  r_clara="$(req_id "$T_LIVE" "$U_CLARA")"
  check R "L-5 Entscheidung ohne Wahl (p_accept NULL, auch mit Pruefzahl) -> INVALID_OPTION (22023), Anfrage bleibt offen" "ERR:INVALID_OPTION|ERR:INVALID_OPTION|pending" \
    "$(decide "$U_OLLI" "$r_clara" NULL)|$(decide "$U_OLLI" "$r_clara" NULL NULL "$(check_no "$r_clara")")|$(q "SELECT status FROM public.tournament_join_requests WHERE id = '$r_clara';")"
  decide "$U_OLLI" "$r_clara" true NULL "$(check_no "$r_clara")" >/dev/null
  m_clara="$(member_of "$T_LIVE" "$U_CLARA")"
  q "INSERT INTO public.field_control (tournament_id, field, epoch, holder_user_id, holder_device_id, holder_device_label) VALUES ('$T_LIVE', 1, 3, '$U_CLARA', '$(uuid_for device:clara)', 'Tablet');" >/dev/null
  check R "@HE-040 Clara ohne Feld: Zugangsstatus ohne Feld (App oeffnet Feld 1)" "accepted|null" \
    "$(j "$(als "$U_CLARA" "SELECT public.helper_access_status('$T_LIVE');")" '[.relation, (.field|tostring)] | join("|")')"
  check R "Tom (Helfer) stuft Clara herab -> 42501" "ERR:Not authorized" "$(als "$U_TOM" "SELECT public.change_helper_access('$m_clara', 'watch_only');")"
  check R "@HE-084 change_helper_access auf Marias Co-Admin-Zeile -> 42501" "ERR:Not authorized" \
    "$(als "$U_OLLI" "SELECT public.change_helper_access('$(member_of "$T_LIVE" "$U_MARIA")', 'revoke');")"
  check R "@HE-055 Z.2 Maria macht Clara zur Zuschauerin -> OK; Clara: kein Schreibrecht, 'Du kannst nur noch zusehen'" "OK|f|viewer" \
    "$(j "$(als "$U_MARIA" "SELECT public.change_helper_access('$m_clara', 'watch_only');")" '.result')|$(perm "$U_CLARA" "$T_LIVE")|$(j "$(als "$U_CLARA" "SELECT public.helper_access_status('$T_LIVE');")" '.relation')"
  check R "K-2 Herabstufen gibt Claras Feld frei (Halter leer, Epoche +1), Uebersicht ohne 'steuert'" "frei|-|4|[]" \
    "$(q "SELECT coalesce(holder_user_id::text, 'frei') || '|' || coalesce(holder_device_label, '-') || '|' || epoch FROM public.field_control WHERE tournament_id = '$T_LIVE' AND field = 1;")|$(j "$(als "$U_OLLI" "SELECT public.list_helper_access('$T_LIVE');")" ".members[] | select(.memberId == \"$m_clara\") | .controls | tostring")"
  check R "K-3 Olli macht Claras herabgestuften Zugang direkt zur Co-Admin/Helferin -> abgelehnt, Rolle bleibt viewer" "1|1|viewer" \
    "$([[ "$(als "$U_OLLI" "UPDATE public.tournament_collaborators SET role = 'co-admin' WHERE id = '$m_clara';")" == ERR:* ]] && echo 1 || echo 0)|$([[ "$(als "$U_OLLI" "UPDATE public.tournament_collaborators SET role = 'collaborator' WHERE id = '$m_clara';")" == ERR:* ]] && echo 1 || echo 0)|$(q "SELECT role FROM public.tournament_collaborators WHERE id = '$m_clara';")"
  check R "K-3 Gegenbeispiel: Olli aendert die Rolle der Konto-Zeile Greta weiter (viewer -> trainer)" "1" \
    "$(als "$U_OLLI" "WITH u AS (UPDATE public.tournament_collaborators SET role = 'trainer' WHERE user_id = '$U_GRETA' AND tournament_id = '$T_LIVE' RETURNING 1) SELECT count(*) FROM u;")"
  check R "@HE-104 herabgestufte Zeile (viewer) auch fuer Olli nicht loeschbar; Konto-Zeile Greta schon" "0|1" \
    "$(als "$U_OLLI" "WITH d AS (DELETE FROM public.tournament_collaborators WHERE id = '$m_clara' RETURNING 1) SELECT count(*) FROM d;")|$(als "$U_OLLI" "WITH d AS (DELETE FROM public.tournament_collaborators WHERE user_id = '$U_GRETA' AND tournament_id = '$T_LIVE' RETURNING 1) SELECT count(*) FROM d;")"

  # --- @HE-080 / @HE-055 Z.1: verlorenes Handy entziehen, Tablet bleibt; K-2 ---
  check R "@HE-080 Olli entzieht Toms Handy -> OK; Handy ohne Recht, Tor -> FORBIDDEN_ACTOR" "OK|f|rejected:FORBIDDEN_ACTOR" \
    "$(j "$(als "$U_OLLI" "SELECT public.change_helper_access('$m_tom', 'revoke');")" '.result')|$(perm "$U_TOM" "$T_LIVE")|$(append_by "$U_TOM" "[$(ev GOAL tom-nach-entzug "$GOAL_EXTRA_2")]")"
  check R "@HE-080 Toms Tablet behaelt den Zugang" "t" "$(perm "$U_TOM_TABLET" "$T_LIVE")"
  check R "@HE-098 Z.1 Handy: 'Du hast keinen Zugriff mehr'; erneuter Scan -> EXISTING revoked" "revoked|EXISTING|revoked" \
    "$(j "$(als "$U_TOM" "SELECT public.helper_access_status('$T_LIVE');")" '.relation')|$(j "$(als "$U_TOM" "SELECT public.request_helper_access('$code', 'Tom');")" '[.result, .relation] | join("|")')"
  check R "K-2 Entzug gibt Feld 2 frei (Epoche +1)" "frei|2" \
    "$(q "SELECT coalesce(holder_user_id::text, 'frei') || '|' || epoch FROM public.field_control WHERE tournament_id = '$T_LIVE' AND field = 2;")"
  check R "Entzogenes Handy hebt den eigenen Entzug auf -> Fehler, bleibt entzogen" "1|t" \
    "$(res="$(als "$U_TOM" "UPDATE public.tournament_collaborators SET declined_at = NULL WHERE id = '$m_tom' RETURNING 'r';")"; [[ "$res" == ERR:* || -z "$res" ]] && echo 1 || echo 0)|$(q "SELECT declined_at IS NOT NULL FROM public.tournament_collaborators WHERE id = '$m_tom';")"
  # --- Review M-1: Durchgang in protect_collaborator_row nur mit Schalter UND ausserhalb der Client-Rollen ---
  check R "M-1 Betreiber-UPDATE im SQL-Editor (postgres) ohne Schalter -> abgelehnt wie vor A-16, Zeile unveraendert" "1|Tom" \
    "$(q "BEGIN; UPDATE public.tournament_collaborators SET label = 'Editor' WHERE id = '$m_tom'; ROLLBACK;" | grep -c 'nur der Turnier-Eigentuemer')|$(q "SELECT label FROM public.tournament_collaborators WHERE id = '$m_tom';")"
  check R "M-1 Gegenbeispiel: mit Schalter (wie Rueckweg) laesst der Trigger das Betreiber-UPDATE durch" "Editor" \
    "$(q "BEGIN; SET LOCAL hallenfussball.helper_access_write = 'on'; UPDATE public.tournament_collaborators SET label = 'Editor' WHERE id = '$m_tom' RETURNING label; ROLLBACK;")"
  check R "M-1 Entzogenes Handy setzt den Schalter selbst und hebt den Entzug auf -> abgelehnt (Client-Rolle), bleibt entzogen" "1|t" \
    "$([[ "$(als_mit "" "$U_TOM" "SET LOCAL hallenfussball.helper_access_write = 'on'; UPDATE public.tournament_collaborators SET declined_at = NULL WHERE id = '$m_tom' RETURNING 'r';")" == ERR:* ]] && echo 1 || echo 0)|$(q "SELECT declined_at IS NOT NULL FROM public.tournament_collaborators WHERE id = '$m_tom';")"
  res="$(q "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '$U_OLLI'; SET LOCAL request.jwt.claims = '{\"sub\":\"$U_OLLI\",\"role\":\"authenticated\",\"is_anonymous\":false}';
SELECT public.change_helper_access('$(member_of "$T_LIVE" "$U_TOM_TABLET")', 'revoke') ->> 'result';
RESET ROLE; SET LOCAL request.jwt.claim.sub = ''; SET LOCAL request.jwt.claims = '';
UPDATE public.tournament_collaborators SET label = 'Editor' WHERE id = '$m_tom';
ROLLBACK;")"
  check R "M-1 nach change_helper_access ist der Schalter in derselben Transaktion wieder aus (Betreiber-UPDATE danach abgelehnt)" "1|1" \
    "$(grep -cx 'OK' <<<"$res")|$(grep -c 'nur der Turnier-Eigentuemer' <<<"$res")"

  # --- @HE-101 / M3: Pruefzahl eindeutig; BUSY; S-3 ---
  local vcode
  vcode="$(code_of "$T_VOLL")"
  for i in $(seq 1 40); do
    u="$(printf '9%07d-0000-4000-8000-%012d' "$i" "$i")"; newanon "$u"
    als "$u" "SELECT public.request_helper_access('$vcode', 'Tom');" >/dev/null
  done
  check R "@HE-101 40 offene Anfragen tragen 40 verschiedene Pruefzahlen" "40|40" \
    "$(q "SELECT count(*) FROM public.tournament_join_requests WHERE tournament_id = '$T_VOLL' AND status = 'pending';")|$(q "SELECT count(DISTINCT check_number) FROM public.tournament_join_requests WHERE tournament_id = '$T_VOLL' AND status = 'pending';")"
  u="$(uuid_for user:vierzig-eins)"; newanon "$u"
  als "$u" "SELECT public.request_helper_access('$vcode', 'Tom');" >/dev/null
  check R "@HE-101 die 41. Anfrage traegt eine Pruefzahl, die keine der 40 traegt" "41|41" \
    "$(q "SELECT count(*) FROM public.tournament_join_requests WHERE tournament_id = '$T_VOLL' AND status = 'pending';")|$(q "SELECT count(DISTINCT check_number) FROM public.tournament_join_requests WHERE tournament_id = '$T_VOLL' AND status = 'pending';")"
  check R "@HE-101 der Index verhindert eine doppelte Pruefzahl auch direkt" "1" \
    "$(q "UPDATE public.tournament_join_requests SET check_number = (SELECT check_number FROM public.tournament_join_requests WHERE tournament_id = '$T_VOLL' AND status = 'pending' ORDER BY created_at LIMIT 1) WHERE id = (SELECT id FROM public.tournament_join_requests WHERE tournament_id = '$T_VOLL' AND status = 'pending' ORDER BY created_at DESC LIMIT 1);" | grep -c 'duplicate key')"
  # Auffuellen auf 90 offene (alle Pruefzahlen vergeben) mit eigenen Geraeten (eine offene Anfrage je Geraet).
  q "WITH free AS (SELECT n, row_number() OVER (ORDER BY n) AS k FROM generate_series(10, 99) n
                    WHERE n NOT IN (SELECT check_number FROM public.tournament_join_requests WHERE tournament_id = '$T_VOLL' AND status = 'pending')),
          users AS (INSERT INTO auth.users (instance_id, id, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
                    SELECT '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'x', '{}', '{}', now(), now()
                      FROM free RETURNING id),
          numbered AS (SELECT id, row_number() OVER (ORDER BY id) AS k FROM users)
     INSERT INTO public.tournament_join_requests (tournament_id, code, device_user_id, display_name, check_number)
     SELECT '$T_VOLL', '$vcode', numbered.id, 'Flut', free.n FROM free JOIN numbered USING (k);" >/dev/null
  u="$(uuid_for user:einundneunzig)"; newanon "$u"
  check R "BUSY: bei 90 offenen Anfragen bekommt die 91. BUSY und es entsteht keine Zeile" "90|BUSY|0" \
    "$(q "SELECT count(*) FROM public.tournament_join_requests WHERE tournament_id = '$T_VOLL' AND status = 'pending';")|$(j "$(als "$u" "SELECT public.request_helper_access('$vcode', 'Neu');")" '.result')|$(q "SELECT count(*) FROM public.tournament_join_requests WHERE device_user_id = '$u';")"
  check R "@HE-011 S4 Zaehler/Uebersicht zaehlen die 90 offenen" "90|90" \
    "$(als "$U_OLLI" "SELECT public.helper_request_count('$T_VOLL');")|$(j "$(als "$U_OLLI" "SELECT public.ensure_helper_code('$T_VOLL');")" '.openRequests')"
  check R "@HE-008 Erneuern mit 'ablehnen' raeumt die Flut ab (90 abgelehnt), danach Zaehler 0" "90|0" \
    "$(j "$(als "$U_OLLI" "SELECT public.rotate_helper_code('$T_VOLL', 'decline');")" '.declined')|$(als "$U_OLLI" "SELECT public.helper_request_count('$T_VOLL');")"
  vcode="$(als "$U_OLLI" "SELECT public.ensure_helper_code('$T_VOLL') ->> 'code';")"   # nach dem Erneuern: neuer Code
  u="$(uuid_for user:s3)"; newanon "$u"
  res="$(als_mit "CREATE FUNCTION public.a16_probe_kollision() RETURNS trigger LANGUAGE plpgsql AS \$f\$ BEGIN RAISE EXCEPTION 'probe' USING ERRCODE = 'unique_violation'; END \$f\$;
CREATE TRIGGER a16_probe_kollision BEFORE INSERT ON public.tournament_join_requests FOR EACH ROW EXECUTE FUNCTION public.a16_probe_kollision();" "$u" \
    "SELECT 'r:' || (public.request_helper_access('$vcode', 'Neu') ->> 'result'); RESET ROLE; SELECT 'n:' || count(*) FROM public.tournament_join_requests WHERE device_user_id = '$u';")"
  check R "S-3 scheitern alle 5 Versuche an einer gleichzeitig vergebenen Pruefzahl -> BUSY, keine Zeile (nicht PENDING)" "BUSY|0" \
    "$(grep -E '^(r|n):' <<<"$res" | cut -c3- | paste -sd'|' -)"

  # --- @HE-007 @HE-037 @HE-008 @HE-102 @HE-076: Erneuern ---
  als "$U_KAI" "SELECT public.request_helper_access('$code', 'Kai');" >/dev/null
  r_kai="$(req_id "$T_LIVE" "$U_KAI")"
  decide "$U_OLLI" "$r_kai" false >/dev/null
  check R "@HE-008 @HE-102 Maria erneuert, offene Anfragen (Lena) ablehnen -> 1 abgelehnt" "1" \
    "$(j "$(als "$U_MARIA" "SELECT public.rotate_helper_code('$T_LIVE', 'decline');")" '.declined')"
  old_code="$code"; new="$(code_of "$T_LIVE")"
  check R "@HE-007 alter Code ohne Sitzung -> nur {state: rotated}, kein Turniername" '{"state":"rotated"}' "$(j "$(als "" "SELECT public.join_code_info('$old_code');")" '.')"
  check R "@HE-007 Toms Tablet bleibt Helfer; @HE-037 alter Code auf dem Tablet -> zugelassen" "t|accepted" \
    "$(perm "$U_TOM_TABLET" "$T_LIVE")|$(j "$(als "$U_TOM_TABLET" "SELECT public.join_code_info('$old_code');")" '.relation')"
  check R "@HE-102 Lena mit altem Code -> 'Anfrage abgelehnt'" "declined" "$(j "$(als "$U_LENA" "SELECT public.join_code_info('$old_code');")" '.relation')"
  check R "@HE-102 Lena mit neuem Code -> neue Anfrage, Olli kann sie zulassen" "PENDING|OK" \
    "$(j "$(als "$U_LENA" "SELECT public.request_helper_access('$new', 'Lena');")" '.result')|$(r_lena="$(req_id "$T_LIVE" "$U_LENA")"; j "$(decide "$U_OLLI" "$r_lena" true 1 "$(check_no "$r_lena")")" '.result')"
  check R "@HE-102 Aber: Kai (per Tipp abgelehnt) sieht auch beim neuen Code 'Anfrage abgelehnt'" "EXISTING|declined" \
    "$(j "$(als "$U_KAI" "SELECT public.request_helper_access('$new', 'Kai');")" '[.result, .relation] | join("|")')"
  u="$(uuid_for user:clara-neu)"; newanon "$u"
  check R "@HE-076 Clara mit geloeschten Daten: alter Code -> 'nicht mehr gueltig' (ohne Titel), Anfrage -> ROTATED" '{"state":"rotated"}|ROTATED|0' \
    "$(j "$(als "$u" "SELECT public.join_code_info('$old_code');")" '.')|$(j "$(als "$u" "SELECT public.request_helper_access('$old_code', 'Clara');")" '.result')|$(q "SELECT count(*) FROM public.tournament_join_requests WHERE device_user_id = '$u';")"
  check R "@HE-076 mit dem neuen Code und Zulassung kann Clara wieder eintragen" "t" \
    "$(als "$u" "SELECT public.request_helper_access('$new', 'Clara');" >/dev/null; r="$(req_id "$T_LIVE" "$u")"; decide "$U_OLLI" "$r" true 2 "$(check_no "$r")" >/dev/null; perm "$u" "$T_LIVE")"
  check R "S1f alter Code, Clara (herabgestuft) -> Turnier bekannt (viewer)" "viewer" "$(j "$(als "$U_CLARA" "SELECT public.join_code_info('$old_code');")" '.relation')"

  # --- M2(b): angenommen, Mitgliedschaft am Server geloescht (Betreiber/SQL) -> revoked ---
  q "DELETE FROM public.tournament_collaborators WHERE id = '$(member_of "$T_LIVE" "$U_LENA")';" >/dev/null
  check R "M2b Lenas Zeile per SQL geloescht -> 'Du hast keinen Zugriff mehr' (nicht zugelassen)" "revoked" \
    "$(j "$(als "$U_LENA" "SELECT public.join_code_info('$new');")" '.relation')"

  # --- Ablauf (@HE-009 @HE-010 @HE-011 @HE-098 Z.3) im Herbst-Cup ---
  code="$(code_of "$T_ABLAUF")"
  u="$(uuid_for user:herbst-tom)"; newanon "$u"; als "$u" "SELECT public.request_helper_access('$code', 'Tom', 'Handy');" >/dev/null
  r="$(req_id "$T_ABLAUF" "$u")"; decide "$U_OLLI" "$r" true 2 "$(check_no "$r")" >/dev/null
  u2="$(uuid_for user:herbst-lena)"; newanon "$u2"; als "$u2" "SELECT public.request_helper_access('$code', 'Lena');" >/dev/null
  q "UPDATE public.tournaments SET date = current_date - 1 WHERE id = '$T_ABLAUF';" >/dev/null
  check R "@HE-009 Code nach dem Turniertag: ohne Sitzung nur 'abgelaufen'" '{"state":"expired"}' "$(j "$(als "" "SELECT public.join_code_info('$code');")" '.')"
  check R "@HE-011 offene Anfrage zaehlt bei Olli nicht mehr (Zaehler, Code-Karte)" "0|0" \
    "$(als "$U_OLLI" "SELECT public.helper_request_count('$T_ABLAUF');")|$(j "$(als "$U_OLLI" "SELECT public.ensure_helper_code('$T_ABLAUF');")" '.openRequests')"
  check R "@HE-011 Lena sieht 'Anfrage verfallen'" "expired" "$(j "$(als "$u2" "SELECT public.join_code_info('$code');")" '.relation')"
  u3="$(uuid_for user:herbst-neu)"; newanon "$u3"
  check R "@HE-009 neue Anfrage nach Ablauf -> EXPIRED, keine Zeile" "EXPIRED|0" \
    "$(j "$(als "$u3" "SELECT public.request_helper_access('$code', 'Neu');")" '.result')|$(q "SELECT count(*) FROM public.tournament_join_requests WHERE device_user_id = '$u3';")"
  check R "@HE-098 Z.3 Code abgelaufen, Turnier laeuft -> Tom zugelassen, Feld 2, nicht abgeschlossen" "accepted|2|false|t" \
    "$(j "$(als "$u" "SELECT public.helper_access_status('$T_ABLAUF');")" '[.relation, (.field|tostring), (.closed|tostring)] | join("|")')|$(perm "$u" "$T_ABLAUF")"
  check R "@HE-010 Gueltigkeit endet 00:00 Ortszeit nach dem Turniertag (12.10. -> 22:00 UTC, 28.11. -> 23:00 UTC)" "2026-10-12 22:00:00+00|2026-11-28 23:00:00+00" \
    "$(q "SET timezone = 'UTC'; SELECT public.helper_code_cutoff('2026-10-12');" | tail -1)|$(q "SET timezone = 'UTC'; SELECT public.helper_code_cutoff('2026-11-28');" | tail -1)"

  # --- Abschluss (@HE-038 @LZ-044 @HE-098 Z.2) im Abschluss-Cup ---
  code="$(code_of "$T_ENDE")"
  u="$(uuid_for user:ende-tom)"; newanon "$u"; als "$u" "SELECT public.request_helper_access('$code', 'Tom');" >/dev/null
  r="$(req_id "$T_ENDE" "$u")"; decide "$U_OLLI" "$r" true 1 "$(check_no "$r")" >/dev/null
  q "UPDATE public.tournaments SET status = 'completed' WHERE id = '$T_ENDE';" >/dev/null
  u2="$(uuid_for user:ende-neu)"; newanon "$u2"
  check R "@HE-038 @LZ-044 abgeschlossen: Scan ohne Sitzung 'closed', neue Helferin -> CLOSED, keine Zeile" '{"state":"closed"}|CLOSED|0' \
    "$(j "$(als "" "SELECT public.join_code_info('$code');")" '.')|$(j "$(als "$u2" "SELECT public.request_helper_access('$code', 'Neu');")" '.result')|$(q "SELECT count(*) FROM public.tournament_join_requests WHERE device_user_id = '$u2';")"
  check R "@HE-038 Olli bekommt nach Abschluss keinen Code mehr (CLOSED)" "CLOSED" "$(j "$(als "$U_OLLI" "SELECT public.ensure_helper_code('$T_ENDE');")" '.result')"
  check R "@HE-098 Z.2 Tom nach Abschluss: zugelassen, abgeschlossen (Endstand)" "accepted|true" \
    "$(j "$(als "$u" "SELECT public.helper_access_status('$T_ENDE');")" '[.relation, (.closed|tostring)] | join("|")')"

  # --- @HE-006 Wettlauf (zwei Sitzungen) ---
  code="$(code_of "$T_RACE")"
  u="$(uuid_for user:wett)"; newanon "$u"; als "$u" "SELECT public.request_helper_access('$code', 'Wett');" >/dev/null
  r_w="$(req_id "$T_RACE" "$u")"; n="$(check_no "$r_w")"
  ( docker exec -i "$CURRENT_CONTAINER" psql -U postgres -X -q -tA <<EOF > "$WORK_DIR/wett-a.out" 2>&1
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '$U_OLLI'; SET LOCAL request.jwt.claims = '{"sub":"$U_OLLI","role":"authenticated","is_anonymous":false}';
SELECT public.decide_join_request('$r_w', true, 1, $n::smallint);
SELECT pg_sleep(2);
COMMIT;
EOF
  ) &
  sleep 0.8
  res="$(decide "$U_MARIA" "$r_w" false)"
  wait
  check R "@HE-006 Olli laesst zu, Maria lehnt kurz danach ab -> Ollis Entscheidung gilt, Maria: 'bereits von Olli entschieden'" "OK|ALREADY_DECIDED|accepted|Olli" \
    "$(j "$(grep -m1 '^{' "$WORK_DIR/wett-a.out")" '.result')|$(j "$res" '[.result, .status, .decidedBy] | join("|")')"
  check R "@HE-006 Endzustand: zugelassen, genau 1 Mitgliedschaft" "accepted|1" \
    "$(q "SELECT status FROM public.tournament_join_requests WHERE id = '$r_w';")|$(q "SELECT count(*) FROM public.tournament_collaborators WHERE user_id = '$u';")"

  # --- K-4: Anfrage waehrend des Erneuerns (Rotations-Restfenster) ---
  code="$(code_of "$T_ROT")"
  u="$(uuid_for user:rot)"; newanon "$u"
  ( docker exec -i "$CURRENT_CONTAINER" psql -U postgres -X -q -tA <<EOF > "$WORK_DIR/rot-a.out" 2>&1
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '$U_OLLI'; SET LOCAL request.jwt.claims = '{"sub":"$U_OLLI","role":"authenticated","is_anonymous":false}';
SELECT public.rotate_helper_code('$T_ROT', 'keep');
SELECT pg_sleep(2);
COMMIT;
EOF
  ) &
  sleep 0.8
  res="$(als "$u" "SELECT public.request_helper_access('$code', 'Spaet');")"
  wait
  check R "K-4 Anfrage mit dem alten Code waehrend des Erneuerns -> ROTATED, keine offene Anfrage mit altem Code" "ROTATED|0" \
    "$(j "$res" '.result')|$(q "SELECT count(*) FROM public.tournament_join_requests WHERE device_user_id = '$u';")"
}
code_of_as() { als "$1" "SELECT public.ensure_helper_code('$2') ->> 'code';"; }
# probe_writers <PL/pgSQL-Anweisung> -- legt in einer nie committeten Transaktion einen weiteren Definer in einem eigenen
# Schema an und liefert t/f der Assertion helper-join-definer-writers-tournament-collaborators (Review L-1).
probe_writers() {
  local sql
  sql="BEGIN; CREATE SCHEMA a16_probe;
CREATE FUNCTION a16_probe.w() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS \$x\$ BEGIN $1; END \$x\$;
$(cat "$REPO_ROOT/scripts/db_privilege_assertions.sql")
ROLLBACK;"
  q "$sql" | grep -E '^helper-join-definer-writers-tournament-collaborators\|' | cut -d'|' -f2
}

# Katalog (nach dem Einspielen)
run_catalog() {
  check S "11 Client-Funktionen SECURITY DEFINER, Eigentuemer postgres, search_path public, pg_temp" "11" \
    "$(q "SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('join_code_info','request_helper_access','helper_access_status','ensure_helper_code','rotate_helper_code','list_helper_access','helper_request_count','decide_join_request','change_helper_access','match_event_author_devices','is_device_membership') AND p.prosecdef AND pg_get_userbyid(p.proowner) = 'postgres' AND p.proconfig @> ARRAY['search_path=public, pg_temp'];")"
  check S "M4a Positivliste: Definer-Schreiber auf tournament_collaborators = change_helper_access, decide_join_request" "change_helper_access,decide_join_request" \
    "$(q "SELECT string_agg(p.proname, ',' ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace NOT IN ('pg_catalog'::regnamespace, 'information_schema'::regnamespace) AND p.prosecdef AND p.prosrc ~* '(insert\s+into|update(\s+only)?|delete\s+from(\s+only)?)\s+(\"?public\"?\s*\.\s*)?\"?tournament_collaborators';")"
  # Review L-1: die Assertion erkennt einen weiteren Definer-Schreiber auch in gequoteter Schreibweise, mit ONLY und
  # ausserhalb von public (je eine Probe -> Zeile |f); Gegenbeispiel: ein Definer, der nur liest, bleibt |t.
  check S "L-1 Positivliste erkennt UPDATE \"public\".\"tournament_collaborators\" / UPDATE ONLY / DELETE FROM ONLY, Lesen nicht" "f|f|f|t" \
    "$(probe_writers 'UPDATE "public"."tournament_collaborators" SET label = label WHERE false')|$(probe_writers 'UPDATE ONLY public.tournament_collaborators SET label = label WHERE false')|$(probe_writers 'DELETE FROM ONLY "tournament_collaborators" WHERE false')|$(probe_writers 'PERFORM 1 FROM "public"."tournament_collaborators" WHERE false FOR UPDATE')"
  check S "anon: EXECUTE nur join_code_info (keine andere neue Funktion)" "join_code_info" \
    "$(q "SELECT string_agg(p.proname, ',' ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('helper_code_cutoff','tournament_closed_for_helpers','generate_helper_code','join_code_info','request_helper_access','helper_access_status','ensure_helper_code','rotate_helper_code','list_helper_access','helper_request_count','decide_join_request','change_helper_access','match_event_author_devices','is_device_membership','protect_helper_access_row') AND has_function_privilege('anon', p.oid, 'EXECUTE');")"
  check S "authenticated: kein EXECUTE auf die internen Funktionen; PUBLIC auf keiner" "0|0" \
    "$(q "SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('helper_code_cutoff','tournament_closed_for_helpers','generate_helper_code','protect_helper_access_row') AND has_function_privilege('authenticated', p.oid, 'EXECUTE');")|$(q "SELECT count(*) FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE p.pronamespace = 'public'::regnamespace AND a.grantee = 0 AND p.proname IN ('helper_code_cutoff','tournament_closed_for_helpers','generate_helper_code','join_code_info','request_helper_access','helper_access_status','ensure_helper_code','rotate_helper_code','list_helper_access','helper_request_count','decide_join_request','change_helper_access','match_event_author_devices','is_device_membership','protect_helper_access_row');")"
  check S "Tabellen: RLS an, keine Policy, anon/authenticated ohne Recht, ci_schema_reader SELECT, ohne BYPASSRLS" "t|t|f" \
    "$(q "SELECT bool_and(c.relrowsecurity AND NOT EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = c.oid) AND NOT has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') AND NOT has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')) FROM pg_class c WHERE c.oid IN ('public.tournament_join_codes'::regclass, 'public.tournament_join_requests'::regclass);")|$(q "SELECT has_table_privilege('ci_schema_reader', 'public.tournament_join_codes', 'SELECT') AND has_table_privilege('ci_schema_reader', 'public.tournament_join_requests', 'SELECT');")|$(q "SELECT rolbypassrls FROM pg_roles WHERE rolname = 'ci_schema_reader';")"
  check S "Loesch-Policy: nur collaborators_delete_v4, nur authenticated, mit is_device_membership" "collaborators_delete_v4|{authenticated}|true" \
    "$(q "SELECT string_agg(policyname, ',') || '|' || string_agg(roles::text, ',') || '|' || bool_and(position('is_device_membership' IN qual) > 0) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tournament_collaborators' AND cmd = 'DELETE';")"
  check S "md5 protect_collaborator_row = A-16-Fassung" "$MD5_PCR_A16" "$(q "SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.protect_collaborator_row()'::regprocedure;")"
  check S "K-3 Trigger protect_helper_access_row: BEFORE UPDATE, aktiv" "protect_helper_access_row|O" \
    "$(q "SELECT tgname || '|' || tgenabled::text FROM pg_trigger WHERE tgrelid = 'public.tournament_collaborators'::regclass AND tgname = 'protect_helper_access_row' AND (tgtype & 2) = 2 AND (tgtype & 16) = 16;")"
  check S "@HE-079 keine A-16-Funktion legt etwas in auth.users an" "0" \
    "$(q "SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('join_code_info','request_helper_access','decide_join_request','change_helper_access') AND p.prosrc ~* 'insert\s+into\s+auth\.';")"
  run_assertions
}

# run_assertions -- Rechte-Assertion als ci_schema_reader: alle Zeilen |t, die A-16-Zeilen vorhanden, Namensliste = db-drift-check.sh.
run_assertions() {
  local priv names_sql names_sh
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | q "$(cat)" 2>&1)" || priv="nicht ausfuehrbar: $priv"
  check S "Rechte-Assertion: keine Zeile |f" "" "$(grep -v '|t$' <<<"$priv" || true)"
  check S "Rechte-Assertion: die 12 A-16-Zeilen vorhanden und |t" "12|12" \
    "$(grep -cE '^helper-join-[a-z0-9-]+\|' <<<"$priv")|$(grep -cE '^helper-join-[a-z0-9-]+\|t$' <<<"$priv")"
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
}

setup_before() {
  echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  psql_stdin < "$BASELINE_FILE" >/dev/null || { echo "::error::Baseline scheitert" >&2; exit 1; }
  local f
  for f in "${BEFORE[@]}"; do psql_stdin < "$f" >/dev/null || { echo "::error::Migration scheitert: $f" >&2; exit 1; }; done
  setup_data
}

# ---------------------------------------------------------------------------------------------------------
if [[ "$MODE" == "gegenprobe" ]]; then
  MUTATIONS=(M1 M2 M3 M4 M5 M6 M7 M8 M9 M10 M11 M12 M13 M14 M15 M16 M17 M18 M19 M20)
  if [[ -n "${GEGENPROBE_NUR:-}" ]]; then read -r -a MUTATIONS <<<"$GEGENPROBE_NUR"; fi
  RED_TOTAL=0
  RED_LIST=""
  for mut in "${MUTATIONS[@]}"; do
    MUTATED="$WORK_DIR/$mut-$TARGET_NAME"
    if ! MUT_KEY="$mut" python3 "$REPO_ROOT/scripts/lib/helper-join-mutations.py" < "$TARGET_FILE" > "$MUTATED"; then
      echo "::error::Mutation $mut nicht anwendbar"; exit 1
    fi
    start_container "$mut"
    setup_before
    if ! psql_stdin < "$MUTATED" >/dev/null 2>"$WORK_DIR/$mut.err"; then
      echo "GEGENPROBE $mut: Einspielen scheitert ($(head -c 160 "$WORK_DIR/$mut.err")) -- zaehlt als rot"
      RED_TOTAL=$((RED_TOTAL + 1)); RED_LIST="$RED_LIST $mut"
      stop_container
      continue
    fi
    reset_counts
    echo "--- GEGENPROBE $mut ---"
    run_probes
    run_catalog
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "GEGENPROBE $mut: rot ($(total_dev) Abweichung(en)) -- wie verlangt"
      RED_TOTAL=$((RED_TOTAL + 1)); RED_LIST="$RED_LIST $mut"
    else
      echo "::error::GEGENPROBE $mut blieb gruen (zahnlos)"
    fi
    stop_container
  done
  echo
  echo "Gegenprobe: $RED_TOTAL von ${#MUTATIONS[@]} Mutationen rot:$RED_LIST"
  [[ "$RED_TOTAL" -eq "${#MUTATIONS[@]}" ]]
  exit $?
fi

start_container "$MODE"
setup_before

if [[ "$MODE" == "without-migration" ]]; then
  run_probes
  summary
  P_DEV="${DEVS[$(cat_index P)]}"; R_DEV="${DEVS[$(cat_index R)]}"
  if [[ "$P_DEV" -gt 0 && "$R_DEV" -gt 0 ]]; then
    echo "Ohne Migration: P und R rot -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (P=$P_DEV, R=$R_DEV muessen > 0 sein)."
  exit 1
fi

# --- F: Fail-fast (ohne Aenderung) ------------------------------------------------------------------------
check F "Vorher: protect_collaborator_row hat die Live-Fassung (md5 wie Prod)" "$MD5_PCR_LIVE" \
  "$(q "SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.protect_collaborator_row()'::regprocedure;")"
FAILFAST="$(awk '/^-- 0\. Voraussetzungen/{f=1} /^-- 1\. Tabellen/{exit} f' "$TARGET_FILE")"
check F "F1 fremde Trigger-Fassung -> Abbruch mit 'unbekannte Fassung'" "1" \
  "$(q "BEGIN; CREATE OR REPLACE FUNCTION public.protect_collaborator_row() RETURNS trigger LANGUAGE plpgsql AS \$x\$ BEGIN RETURN NEW; END \$x\$;
$FAILFAST
ROLLBACK;" | grep -c 'unbekannte Fassung')"
check F "F2 Loesch-Policy fehlt -> Abbruch" "1" \
  "$(q "BEGIN; DROP POLICY collaborators_delete_v3 ON public.tournament_collaborators;
$FAILFAST
ROLLBACK;" | grep -c 'Loesch-Policy')"
check F "F3 Voraussetzung fehlt (role_permissions helper/writeMatchData) -> Abbruch" "1" \
  "$(q "BEGIN; DELETE FROM public.role_permissions WHERE role = 'helper' AND permission = 'writeMatchData';
$FAILFAST
ROLLBACK;" | grep -c 'fehlen')"
q "CREATE OR REPLACE FUNCTION public.protect_collaborator_row() RETURNS trigger LANGUAGE plpgsql AS \$x\$ BEGIN RETURN NEW; END \$x\$;" >/dev/null
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
F4_EXIT=$?
check F "F4 ganze Datei gegen fremde Trigger-Fassung: Abbruch, keine neue Tabelle, Policy v3 bleibt" "3|<null>|collaborators_delete_v3" \
  "$F4_EXIT|$(q "SELECT coalesce(to_regclass('public.tournament_join_codes')::text, '<null>');")|$(q "SELECT string_agg(policyname, ',') FROM pg_policies WHERE tablename = 'tournament_collaborators' AND cmd = 'DELETE';")"
pcr_live_sql | psql_stdin >/dev/null
check F "F4 danach Live-Fassung wiederhergestellt" "$MD5_PCR_LIVE" "$(q "SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.protect_collaborator_row()'::regprocedure;")"

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
DATA_SQL="SELECT (SELECT count(*) FROM public.tournament_collaborators) || '|' || (SELECT count(*) FROM public.tournaments) || '|' || (SELECT count(*) FROM public.matches);"
DATA_BEFORE="$(q "$DATA_SQL")"
echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE" >/dev/null || { echo "::error::$TARGET_NAME scheitert" >&2; exit 1; }
check S "Bestand: Mitglieder, Turniere, Spiele unveraendert (keine Datenaenderung)" "$DATA_BEFORE" "$(q "$DATA_SQL")"
check S "Spalten der neuen Tabellen laut Katalog: 6 + 14" "6|14" \
  "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournament_join_codes';")|$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournament_join_requests';")"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in tables columns functions triggers policies indexes rls_tables; do
  # columns: 20 Spalten (6 + 14); db_catalog_counts.py haelt "check_number" wegen des Praefixes "check" fuer eine
  # Tabellen-Bedingung und zaehlt sie nicht -> 19 (Werkzeug-Eigenheit, beide Seiten des Drift-Checks gleich betroffen).
  case "$dim" in tables|rls_tables) expected=2 ;; columns) expected=19 ;; functions) expected=15 ;; triggers) expected=1 ;; indexes) expected=7 ;; *) expected=0 ;; esac
  check S "Katalogzaehlung $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done

run_probes
run_catalog

# --- W: idempotent -----------------------------------------------------------------------------------------
STATE_SQL="SELECT (SELECT count(*) FROM public.tournament_join_requests) || '|' || (SELECT count(*) FROM public.tournament_join_codes) || '|' || (SELECT count(*) FROM public.tournament_collaborators WHERE declined_at IS NULL);"
STATE_BEFORE_W="$(q "$STATE_SQL")"
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
check W "zweites Einspielen laeuft (Exit 0)" "0" "$?"
check W "danach Daten unveraendert, Schema wie nach dem ersten Einspielen" "$STATE_BEFORE_W|identisch" \
  "$(q "$STATE_SQL")|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg (Anhang B) -------------------------------------------------------------------------------
HELPER_ROWS_SQL="SELECT count(*) FROM public.tournament_collaborators c WHERE c.declined_at IS NULL AND c.id IN (SELECT member_id FROM public.tournament_join_requests WHERE member_id IS NOT NULL);"
ACTIVE_HELPERS="$(q "$HELPER_ROWS_SQL")"
ACTIVE_IDS="$(q "SELECT string_agg(member_id::text, ',' ORDER BY member_id) FROM public.tournament_join_requests WHERE member_id IS NOT NULL;")"
check X "vor dem Rueckweg gibt es aktive Geraete-Zugaenge (sonst misst X2 nichts)" "1" "$([[ "$ACTIVE_HELPERS" -gt 0 ]] && echo 1 || echo "$ACTIVE_HELPERS")"
rueckweg_sql | psql_stdin >/dev/null 2>"$WORK_DIR/rueckweg.err"
check X "Rueckweg laeuft (Exit 0)" "0" "$?"
DUMP_ROLLED_BACK="$(schema_dump)"
check X "nach dem Rueckweg: Schema public = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi
check X "Geraete-Zugaenge nach dem Rueckweg gesperrt, Zeilen bleiben" "0|$(tr ',' '\n' <<<"$ACTIVE_IDS" | grep -c .)" \
  "$(q "SELECT count(*) FROM public.tournament_collaborators WHERE declined_at IS NULL AND id::text = ANY (string_to_array('$ACTIVE_IDS', ','));")|$(q "SELECT count(*) FROM public.tournament_collaborators WHERE id::text = ANY (string_to_array('$ACTIVE_IDS', ','));")"
check X "Rueckweg ein zweites Mal -> Abbruch durch den md5-Waechter (M4c)" "1" "$(rueckweg_sql | q "$(cat)" | grep -c 'gemeinsamer Rueckweg')"
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
check X "danach erneut einspielbar (Exit 0, Schema = erstes Einspielen)" "0|identisch" "$?|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f" >/dev/null || { check S "spaetere Migration laeuft: $(basename "$f")" "0" "1"; continue; }
  echo "OK    spaetere Migration laeuft: $(basename "$f")" >&2
done

summary
if [[ "$(total_dev)" -gt 0 ]]; then
  echo "::error::$(total_dev) Abweichung(en)."
  exit 1
fi
echo "Alle Pruefungen ohne Abweichung."
exit 0
