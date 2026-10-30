#!/usr/bin/env bash
#
# public-payload-check.sh — Container-Beweis fuer supabase/migrations/20261117_104_public_payload.sql (B-14, E-A2,
# Review Focus 6). Muster: scripts/event-author-names-check.sh (Wegwerf-Container supabase/postgres, Baseline +
# Migrationen seit Baseline, Aufraeumen per trap). Zusaetzlich ein Wegwerf-PostgREST im selben Wegwerf-Netz: die
# Rollen-Zeilen sind ROHE REST-Aufrufe ohne App (curl auf /tournaments, /monitors, /rpc/public_tournament ... mit
# selbst signiertem JWT je Rolle), und die Byte-Messung zaehlt echte HTTP-Antworten (Statuszeile + Kopfzeilen + Body).
# PostgREST laeuft hier direkt (ohne Gateway); /rest/v1/<pfad> in der Cloud ist /<pfad> hier.
#
# Testwerte aus dem Gherkin (Record zuschauer-und-monitor, Beispielturnier „Hallencup Nord“): Spiel 1 13:00 FC Nord –
# TSV West beendet 2:0; Spiel 7 14:15 FC Nord – SV Süd laeuft 1:0 (Tor FC Nord Nr. 9 in der 3. Minute, Zeitstrafe SV Süd
# Nr. 5 in der 4. Minute); Spiel 8 14:15 Feld 2 SG Mitte – DJK Berg laeuft 0:0; Spiel 9 14:40 geplant (verschoben von
# 14:30); Halbfinale 1 „Erster Gruppe A gegen Zweiter Gruppe B“, FC Nord schon eingesetzt. „Wintercup“ festgelegt, nicht
# online geteilt. Olli = Eigentuemer, Maria = Co-Admin, Tom = Helfer-Geraet, Mama Petra = anon (ohne Sitzung),
# Lena = anonyme Sitzung ohne Rolle, Clara = Konto ohne Rolle, Hallenmonitor Feld 1 = mon-feld1.
#
# Kategorien:
#   P  Positivliste (@ZM-001, @ZM-096..099, @ZM-102, @W1-030..032, @W3-001, @ME-018, Ereignisse ohne Urheber)
#   A  Antwort und Versionen (@ZM-036, @ZM-063/065..069, @ZM-100, @ZM-101, @ZM-109; unchanged/delta/full,
#      server_now in ms, tournament_date im Delta, Voll-Antwort bei Schalter-Wechsel, original_start/forfeit_absent)
#   M  Monitor-Link display_tournament (Uebergang bis B-20/B-21; @ZM-066 Z. 2, @ZM-101, @ME-018)
#   R  Rollen-Matrix mit rohen REST-Aufrufen (Review Focus 6, § 2 Nr. 11): anon, anonyme Sitzung ohne Rolle, Konto
#      ohne Rolle, Helfer (zugelassen/entzogen/anderes Turnier), Bildschirm (gekoppelt/geloest/anderes Turnier),
#      Zuschauer-Mitglied, Co-Admin, Eigentuemer, fremder Eigentuemer
#   S  Schema/Rechte (SECURITY DEFINER, search_path, keine Client-Rechte auf public_view, Standardrechte neuer
#      Tabellen, Rechte-Assertion + Namensliste = db-drift-check.sh, Katalogzaehlung, Bestand unveraendert)
#   W  zweites Einspielen (idempotent)   X  Rueckweg (supabase/rollbacks/...) -> Schema = vorher
#   B  Messung (nur Ausgabe): Bytes je Antwort inkl. Kopfzeilen fuer Voll, Delta „1 Tor“, „keine Aenderung“
#
# Aufrufoptionen:
#   bash scripts/public-payload-check.sh                     normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/public-payload-check.sh --without-migration Gegenprobe: ohne die Migration muessen P, A, M und R
#                                                            ROT sein (Exit 0 nur dann)
#   PAYLOAD_DUMP_DIR=<ordner> bash scripts/public-payload-check.sh   zusaetzlich die gemessenen Antworten ablegen
#   bash scripts/public-payload-check.sh --gegenprobe        je Lauf eine Mutation der Migration; Exit 0 NUR, wenn
#                                                            JEDE Mutation mindestens eine Pruefung rot faerbt:
#     G1 alte SELECT-Policy mit is_public fuer anon zurueck (tournaments)        -> R rot
#     G2 Kontaktperson ohne Haekchen ausgeliefert                                -> P rot (@W1-032)
#     G3 Kindermodus blendet Spielstaende nicht aus                              -> P rot
#     G4 Ereignisse mit ganzer payload (Urheber, Freitext)                       -> P rot (@ZM-098)
#     G5 Monitor-Link ohne Pruefung des Monitors                                 -> M rot
#     G6 public_tournament ohne is_public                                        -> A rot (@ZM-100/@ZM-101)
#     G7 Schiedsrichter auch fuer Zuschauer (Einstellung Name)                   -> P rot (@W3-001)
#     G8 Schalter-Wechsel liefert nur ein Delta                                  -> A rot
#     G9 config ohne Positivliste (alle Schluessel)                              -> P rot (@ME-018, adminNotes)
#     G10 Loeschen merkt keine Strukturaenderung (langsames save())              -> A rot (A1)
#     G11 Einfuegen ohne Server-Zeit (Geraeteuhr in updated_at)                  -> A rot (A1)
#     G11B wie G11 fuer Teams (Team-INSERT-Trigger fehlt)                        -> A rot (A1, NB-2)
#     G12 Bildschirm bekommt SR-Namen trotz Vorgabe Nummer                       -> P rot (A2, @W3-032)
#     G13 Kindermodus mit Entscheidungs-Angaben in live_state                    -> P rot (N2)
#     G14 basis wieder leer (Fassung 20261117_104, mutiert in 20261118_007)       -> P rot (@W2A-059 Z. 3)
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigene Wegwerf-Container und ein
# eigenes Wegwerf-Netz, am Ende entfernt (trap). Harness-Hilfen liegen im Schema "harness".
#
set -euo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe)" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie event-author-names-check.sh
POSTGREST_IMAGE="${POSTGREST_IMAGE:-public.ecr.aws/supabase/postgrest:v16.2}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261117_104_public_payload.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
ROLLBACK_FILE="$REPO_ROOT/supabase/rollbacks/20261117_104_public_payload_rollback.sql"
# Spaetere Migration, die NUR public_view.config_for ersetzt (basis = gespeicherter Fingerabdruck, C-PUBLIC-ENTSCHEIDUNG-
# BASIS-LEER). Die Proben laufen gegen die Fassung MIT ihr; fehlt die Datei, laufen sie gegen 20261117_104 (Gegenprobe:
# die Pruefung „basis = gespeicherter Fingerabdruck“ wird rot).
BASIS_FOLLOWUP_FILE="$MIGRATIONS_DIR/20261118_007_public_entscheidung_basis.sql"
DEFAULTS_FILE="$REPO_ROOT/src/core/models/publicContentDefaults.json"
PREFIX="public-payload-check-$$"
NET="$PREFIX-net"
CURRENT_CONTAINER=""
CURRENT_REST=""
REST_PORT=""
WORK="$(mktemp -d "${TMPDIR:-/tmp}/public-payload-check.XXXXXX")"
JWT_SECRET="public-payload-check-secret-0123456789abcdef"

command -v jq >/dev/null 2>&1 || { echo "::error::jq wird benoetigt." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "::error::curl wird benoetigt." >&2; exit 1; }
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

stop_rest() { [[ -n "$CURRENT_REST" ]] && docker rm -f "$CURRENT_REST" >/dev/null 2>&1 || true; CURRENT_REST=""; REST_PORT=""; }
stop_container() {
  stop_rest
  [[ -n "$CURRENT_CONTAINER" ]] && docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1 || true
  CURRENT_CONTAINER=""
}
cleanup() {
  stop_container
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

docker network create "$NET" >/dev/null

start_container() {
  CURRENT_CONTAINER="$PREFIX-$1"
  docker run -d --name "$CURRENT_CONTAINER" --network "$NET" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 90); do
    if [[ "$(docker logs "$CURRENT_CONTAINER" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "::error::Container wurde nach 90s nicht bereit." >&2
    docker logs "$CURRENT_CONTAINER" 2>&1 | tail -30 >&2
    exit 1
  fi
  for _ in $(seq 1 30); do
    docker exec "$CURRENT_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
}

# PostgREST erst NACH dem Einspielen starten (liest den Schema-Cache beim Start); bei Schemawechsel neu starten.
start_rest() {
  stop_rest
  CURRENT_REST="$CURRENT_CONTAINER-rest"
  docker run -d --name "$CURRENT_REST" --network "$NET" -p 127.0.0.1::3000 \
    -e PGRST_DB_URI="postgres://authenticator:postgres@$CURRENT_CONTAINER:5432/postgres" \
    -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$JWT_SECRET" \
    -e PGRST_DB_CHANNEL_ENABLED=false "$POSTGREST_IMAGE" >/dev/null
  REST_PORT="$(docker port "$CURRENT_REST" 3000/tcp | head -1 | sed 's/.*://')"
  local code=""
  for _ in $(seq 1 60); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$REST_PORT/" || true)"
    [[ "$code" == "200" ]] && break
    sleep 1
  done
  if [[ "$code" != "200" ]]; then
    echo "::error::PostgREST nicht bereit (HTTP $code)." >&2
    docker logs "$CURRENT_REST" 2>&1 | tail -20 >&2
    exit 1
  fi
}

psql_stdin() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q
}
psql_value() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA
}
q() { psql_value <<<"$1" 2>&1 || true; }
as_admin() {
  docker exec -i -e PGPASSWORD=postgres -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" \
    psql -h localhost -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -q
}
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }

# Zaehler je Kategorie (bash 3.2: keine assoziativen Arrays).
CATS=(P A M R S W X)
DEVS=(0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0)
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
    DEVS[i]=$((DEVS[i] + 1)); echo "ABWEICHUNG  [$1] $2"; echo "    erwartet: $3"; echo "    erhalten: ${4:0:400}"
  fi
}
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
reset_counts() { DEVS=(0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0); }
has() { [[ "$1" == *"$2"* ]] && echo "enthalten" || echo "fehlt"; }

uuid_for() {
  local h
  h="$(printf '%s' "public-payload-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_TOM="$(uuid_for user:tom)"
U_THEO="$(uuid_for user:theo-entzogen)"; U_HANNA="$(uuid_for user:hanna-anderes-turnier)"
U_VERA="$(uuid_for user:vera-zuschauer)"; U_SCREEN="$(uuid_for user:bildschirm)"
U_SCREEN_FREE="$(uuid_for user:bildschirm-geloest)"; U_SCREEN_OTHER="$(uuid_for user:bildschirm-wintercup)"
U_LENA="$(uuid_for user:lena-anonym)"; U_CLARA="$(uuid_for user:clara-konto)"; U_FREMD="$(uuid_for user:fremd)"
ANON_UIDS=" $U_TOM $U_THEO $U_HANNA $U_VERA $U_SCREEN $U_SCREEN_FREE $U_SCREEN_OTHER $U_LENA "
T="$(uuid_for tournament:hallencup-nord)"; T_WINTER="$(uuid_for tournament:wintercup)"; T_DEL="$(uuid_for tournament:geloescht)"
FC_NORD="$(uuid_for team:fc-nord)"; SV_SUED="$(uuid_for team:sv-sued)"; TSV_WEST="$(uuid_for team:tsv-west)"
SC_OST="$(uuid_for team:sc-ost)"; SG_MITTE="$(uuid_for team:sg-mitte)"; DJK_BERG="$(uuid_for team:djk-berg)"
W_A="$(uuid_for team:winter-a)"; W_B="$(uuid_for team:winter-b)"; D_A="$(uuid_for team:del-a)"; D_B="$(uuid_for team:del-b)"
S1="$(uuid_for match:spiel-1)"; S7="$(uuid_for match:spiel-7)"; S8="$(uuid_for match:spiel-8)"; S9="$(uuid_for match:spiel-9)"
HF1="$(uuid_for match:halbfinale-1)"; HF2="$(uuid_for match:halbfinale-2)"; M_WINTER="$(uuid_for match:winter-1)"
M_DEL="$(uuid_for match:del-1)"; S_NEU="$(uuid_for match:spiel-15-neu)"; T_NEU="$(uuid_for team:fc-neu)"
E() { uuid_for "event:$1"; }
SHARE="HCNORD"
# Fingerabdruck der Grundlage einer Entscheidung wie src/core/standings/decisionBasis (JSON.stringify: points, criteria,
# matches[, forfeit]) -- d1 traegt ihn, d2 einen Alt-Text (frueher Begruendung) in basis.
BASIS_D1="{\"points\":[3,1,0],\"criteria\":[\"points\",\"directComparison\",\"goalDifference\",\"goalsFor\"],\"matches\":[[\"$S1\",2,0,\"finished\",null]]}"

# --- JWT (HS256) je Rolle, wie die App sie mitschickt -------------------------------------------------------------
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
jwt() {
  local h p s
  h="$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)"
  p="$(printf '%s' "$1" | b64url)"
  s="$(printf '%s' "$h.$p" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)"
  echo "$h.$p.$s"
}
tok_for() { # tok_for <uid|anon>
  if [[ "$1" == "anon" ]]; then
    jwt '{"role":"anon","exp":4102444800}'
  elif [[ "$ANON_UIDS" == *" $1 "* ]]; then
    jwt "{\"role\":\"authenticated\",\"sub\":\"$1\",\"is_anonymous\":true,\"exp\":4102444800}"
  else
    jwt "{\"role\":\"authenticated\",\"sub\":\"$1\",\"is_anonymous\":false,\"exp\":4102444800}"
  fi
}

# rest <uid|anon> <METHODE> <pfad> [body] -- Status, Kopfzeilen in $WORK/h, Body in $WORK/b
rest() {
  local tok
  tok="$(tok_for "$1")"
  if [[ -n "${4:-}" ]]; then
    curl -s -o "$WORK/b" -D "$WORK/h" -w '%{http_code}' -X "$2" "http://127.0.0.1:$REST_PORT$3" \
      -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' --data "$4" || echo "000"
  else
    curl -s -o "$WORK/b" -D "$WORK/h" -w '%{http_code}' -X "$2" "http://127.0.0.1:$REST_PORT$3" \
      -H "Authorization: Bearer $tok" || echo "000"
  fi
}
body() { cat "$WORK/b"; }
# rows <uid|anon> <pfad> -- Anzahl Zeilen einer GET-Antwort oder "http-<status>"
rows() {
  local st
  st="$(rest "$1" GET "$2")"
  if [[ "$st" == "200" ]]; then jq 'length' "$WORK/b"; else echo "http-$st"; fi
}
# pub <uid|anon> <since|null> [code] -- Antwort von public_tournament (Body), Status in $WORK/st
pub() {
  local st
  st="$(rest "$1" POST /rpc/public_tournament "{\"share_code\":\"${3:-$SHARE}\",\"since_version\":$2}")"
  echo "$st" > "$WORK/st"
  body
}
disp() { # disp <uid|anon> <tournament> <monitor> <since|null>
  local st
  st="$(rest "$1" POST /rpc/display_tournament "{\"tournament_id\":\"$2\",\"monitor_id\":\"$3\",\"since_version\":$4}")"
  echo "$st" > "$WORK/st"
  body
}
state_of() { jq -r '.state // ("http-" + (.code // "?"))' <<<"$1" 2>/dev/null || echo "kein-json"; }
match_of() { jq -c --arg id "$2" '[.matches[]? | select(.id == $id)][0] // null' <<<"$1"; }

# ev <typ> <id> [Zusatzfelder als JSON] -- Engine-Ereignis an EVS (Format wie event-author-names-check.sh)
EVS=""
ev() {
  local extra="${3:-}" one
  [[ -z "$extra" ]] && extra='{}'
  one="$(jq -cn --arg type "$1" --arg id "$2" --argjson extra "$extra" \
    '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, teamId: null, targetId: null, payload: {}} + $extra')"
  EVS="$EVS$one"$'\n'
}
OUT=""
send() {
  local events
  events="$(jq -cs '.' <<<"$EVS")"
  EVS=""
  OUT="$(q "SELECT harness.call('$1'::uuid, '$2'::uuid, \$J\$$events\$J\$::jsonb);")"
}
statuses_of() { jq -r '[.results[]?.status] | join(",")' <<<"$1"; }
need_accepted() { # need_accepted <Beschreibung> <erwartet>
  [[ "$(statuses_of "$OUT")" == "$2" ]] || { echo "::error::Vorbereitung $1: $OUT" >&2; exit 1; }
}
# Turnier/Teams/Spiele altern lassen (Versionen liegen danach > 5 s zurueck) -- nur Harness, Trigger aus.
age_rows() {
  psql_stdin <<SQL
SET session_replication_role = replica;
UPDATE public.tournaments SET updated_at = updated_at - interval '1 minute' WHERE id IN ('$T', '$T_WINTER');
UPDATE public.teams SET updated_at = updated_at - interval '1 minute' WHERE tournament_id IN ('$T', '$T_WINTER');
UPDATE public.matches SET updated_at = updated_at - interval '1 minute' WHERE tournament_id IN ('$T', '$T_WINTER');
DO \$\$ BEGIN
  IF to_regclass('public_view.structure_changes') IS NOT NULL THEN
    UPDATE public_view.structure_changes SET changed_at = changed_at - interval '1 minute';
  END IF;
END \$\$;
SQL
}
set_config() { # set_config <jsonb-Ausdruck, der config veraendert>
  psql_stdin <<<"UPDATE public.tournaments SET config = $1 WHERE id = '$T';"
}

setup_helpers() {
  # auth.uid()/auth.jwt() wie in der Cloud: Claims als JSON (PostgREST >= 10 setzt nur request.jwt.claims). Das
  # Schema auth gehoert nicht postgres -> als supabase_admin.
  as_admin <<'SQL'
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$f$;
DO $do$
BEGIN
  IF to_regprocedure('auth.jwt()') IS NULL THEN
    EXECUTE $f$CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      'SELECT coalesce(nullif(current_setting(''request.jwt.claims'', true), ''''), ''{}'')::jsonb'$f$;
    GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
  END IF;
END;
$do$;
ALTER ROLE authenticator WITH PASSWORD 'postgres';
SQL
  psql_stdin <<'SQL'
CREATE SCHEMA harness;
GRANT USAGE ON SCHEMA harness TO authenticated;
CREATE FUNCTION harness.call(p_user uuid, p_match uuid, p_events jsonb) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    v := public.append_match_events(p_match, p_events, 1, NULL);
  EXCEPTION WHEN OTHERS THEN
    v := jsonb_build_object('exception', SQLSTATE, 'message', SQLERRM);
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
SQL
}

setup_data() {
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       CASE WHEN u.email IS NULL THEN '{"provider":"anonymous","providers":["anonymous"]}'::jsonb
            ELSE '{"provider":"email","providers":["email"]}'::jsonb END, '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@hcn.test'), ('$U_MARIA'::uuid, 'maria@hcn.test'), ('$U_CLARA'::uuid, 'clara@hcn.test'),
             ('$U_FREMD'::uuid, 'fremd@hcn.test'), ('$U_TOM'::uuid, NULL), ('$U_THEO'::uuid, NULL), ('$U_HANNA'::uuid, NULL),
             ('$U_VERA'::uuid, NULL), ('$U_SCREEN'::uuid, NULL), ('$U_SCREEN_FREE'::uuid, NULL),
             ('$U_SCREEN_OTHER'::uuid, NULL), ('$U_LENA'::uuid, NULL)) AS u(id, email);
INSERT INTO public.profiles (id, display_name, email)
VALUES ('$U_OLLI', 'Olli Leitung', 'olli@hcn.test'), ('$U_MARIA', 'Maria Coadmin', 'maria@hcn.test')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email;

INSERT INTO public.tournaments (id, owner_id, title, date, start_time, number_of_teams, number_of_fields, group_phase_duration,
                                location_name, location_city, referee_config, config)
VALUES ('$T', '$U_OLLI', 'Hallencup Nord', '2026-11-21', '13:00', 6, 2, 10, 'Sporthalle Nord', 'Nordstadt',
        '{"mode":"organizer","numberOfReferees":2,"refereeNames":{"1":"Paul Schmidt"}}'::jsonb,
        jsonb_build_object(
          'publishedAt', '2026-11-01T00:00:00.000Z', 'ageClass', 'E-Jugend', 'organizer', 'TSV Veranstalter',
          'groups', '[{"id":"A","name":"Gruppe A"},{"id":"B","name":"Gruppe B"}]'::jsonb,
          'fields', '[{"id":"field-1","name":"Feld 1"},{"id":"field-2","name":"Feld 2"}]'::jsonb,
          'contactInfo', '{"name":"Olga Orga","email":"olga@orga.test","phone":"0171 1112223","website":"https://orga.test"}'::jsonb,
          'adminNotes', 'Schluessel bei Hausmeister Kurt',
          'dashboardStatus', 'intern-dashboard',
          'matchCockpitSettings', '{"internSetting":"cockpit-intern"}'::jsonb,
          'standingDecisions', jsonb_build_array(jsonb_build_object('id', 'd1', 'groupId', 'A',
              'teamIds', jsonb_build_array('$SV_SUED', '$TSV_WEST'), 'order', jsonb_build_array('$SV_SUED', '$TSV_WEST'),
              'kind', 'order', 'basis', '$BASIS_D1', 'decidedBy', 'Olli Leitung', 'reason', 'Losentscheid-Grund'),
            jsonb_build_object('id', 'd2', 'groupId', 'A',
              'teamIds', jsonb_build_array('$SC_OST', '$FC_NORD'), 'order', jsonb_build_array('$FC_NORD', '$SC_OST'),
              'kind', 'shootout', 'shootout', jsonb_build_object('winner', 4, 'loser', 3), 'basis', 'Los gezogen von Olli')),
          'monitors', '[{"id":"mon-feld1","name":"Hallenmonitor Feld 1","slides":[{"id":"s1","type":"live","config":{}},{"id":"s2","type":"sponsor","config":{"sponsorId":"sp-baecker"}}]},{"id":"mon-eingang","name":"Hallenmonitor Eingang","slides":[{"id":"s3","type":"sponsor","config":{"sponsorId":"sp-auto"}}]}]'::jsonb,
          'sponsors', '[{"id":"sp-baecker","name":"Baeckerei Korn","logoBase64":"data:image/png;base64,QkFFQ0tFUg==","websiteUrl":"https://korn.test","tier":"gold"},{"id":"sp-auto","name":"Autohaus Rad","logoBase64":"data:image/png;base64,QVVUTw=="}]'::jsonb)),
       ('$T_WINTER', '$U_FREMD', 'Wintercup', '2026-12-05', '10:00', 2, 1, 10, 'Halle Sued', NULL, NULL,
        '{"publishedAt":"2026-11-01T00:00:00.000Z","monitors":[{"id":"mon-winter","name":"Winter Monitor","slides":[]}]}'::jsonb),
       ('$T_DEL', '$U_OLLI', 'Alter Cup', '2026-11-20', '10:00', 2, 1, 10, 'Halle Alt', NULL, NULL,
        '{"publishedAt":"2026-11-01T00:00:00.000Z","monitors":[{"id":"mon-alt","name":"Alt","slides":[]}]}'::jsonb);
UPDATE public.tournaments SET is_public = true, share_code = '$SHARE', status = 'published' WHERE id = '$T';
UPDATE public.tournaments SET share_code = 'WINTER', status = 'published' WHERE id = '$T_WINTER';
UPDATE public.tournaments SET is_public = true, share_code = 'GELOES', status = 'published' WHERE id = '$T_DEL';

INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, declined_at, label)
VALUES ('$T', '$U_MARIA', 'co-admin', now(), NULL, 'Maria'),
       ('$T', '$U_TOM', 'helper', now(), NULL, 'Tom'),
       ('$T', '$U_THEO', 'helper', now(), now(), 'Theo'),
       ('$T', '$U_VERA', 'viewer', now(), NULL, 'Vera'),
       ('$T', '$U_SCREEN', 'screen', now(), NULL, 'Hallen-Rechner'),
       ('$T', '$U_SCREEN_FREE', 'screen', now(), now(), 'Hallen-Rechner alt'),
       ('$T_WINTER', '$U_HANNA', 'helper', now(), NULL, 'Hanna'),
       ('$T_WINTER', '$U_SCREEN_OTHER', 'screen', now(), NULL, 'Winter-Rechner');

INSERT INTO public.teams (id, tournament_id, name, group_letter, sort_order, contact_name, contact_email, contact_phone,
                          color_primary, removed_reason) VALUES
  ('$FC_NORD', '$T', 'FC Nord', 'A', 1, 'Trainer Nordmann', 'nord@verein.test', '0160 9998887', '#1565C0', NULL),
  ('$SV_SUED', '$T', 'SV Süd', 'A', 2, NULL, NULL, NULL, NULL, NULL),
  ('$TSV_WEST', '$T', 'TSV West', 'A', 3, NULL, NULL, NULL, NULL, NULL),
  ('$SC_OST', '$T', 'SC Ost', 'A', 4, NULL, NULL, NULL, NULL, 'Rueckzug intern begruendet'),
  ('$SG_MITTE', '$T', 'SG Mitte', 'B', 5, NULL, NULL, NULL, NULL, NULL),
  ('$DJK_BERG', '$T', 'DJK Berg', 'B', 6, NULL, NULL, NULL, NULL, NULL),
  ('$W_A', '$T_WINTER', 'FC Schnee', NULL, 1, NULL, NULL, NULL, NULL, NULL),
  ('$W_B', '$T_WINTER', 'SV Eis', NULL, 2, NULL, NULL, NULL, NULL, NULL),
  ('$D_A', '$T_DEL', 'Alt A', NULL, 1, NULL, NULL, NULL, NULL, NULL),
  ('$D_B', '$T_DEL', 'Alt B', NULL, 2, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.team_players (team_id, number, name) VALUES ('$FC_NORD', 9, 'Spieler Neun Nordmann');

INSERT INTO public.matches (id, tournament_id, round, field, match_number, scheduled_start, group_letter, phase,
                            team_a_id, team_b_id, slot_a_source, slot_b_source, origin_a, origin_b, is_final, final_type,
                            referee_number, skipped_reason) VALUES
  ('$S1', '$T', 1, 1, 1, '13:00', 'A', 'groupStage', '$FC_NORD', '$TSV_WEST', NULL, NULL, NULL, NULL, NULL, NULL, 2, NULL),
  ('$S7', '$T', 3, 1, 7, '14:15', 'A', 'groupStage', '$FC_NORD', '$SV_SUED', NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL),
  ('$S8', '$T', 3, 2, 8, '14:15', 'B', 'groupStage', '$SG_MITTE', '$DJK_BERG', NULL, NULL, NULL, NULL, NULL, NULL, 2, NULL),
  ('$S9', '$T', 4, 1, 9, '14:40', 'A', 'groupStage', '$TSV_WEST', '$SC_OST', NULL, NULL, NULL, NULL, NULL, NULL, 1, 'Halle zu spaet offen'),
  ('$HF1', '$T', 6, 1, 13, '15:35', NULL, 'semifinal', '$FC_NORD', NULL,
     '{"kind":"groupRank","group":"A","rank":1}', '{"kind":"groupRank","group":"B","rank":2}',
     '{"kind":"groupRank","group":"A","rank":1}', '{"kind":"groupRank","group":"B","rank":2}', true, 'semifinal', 1, NULL),
  ('$HF2', '$T', 6, 2, 14, '15:35', NULL, 'semifinal', NULL, NULL,
     '{"kind":"groupRank","group":"B","rank":1}', '{"kind":"groupRank","group":"A","rank":2}',
     '{"kind":"groupRank","group":"B","rank":1}', '{"kind":"groupRank","group":"A","rank":2}', true, 'semifinal', 2, NULL),
  ('$M_WINTER', '$T_WINTER', 1, 1, 1, '10:00', NULL, 'groupStage', '$W_A', '$W_B', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('$M_DEL', '$T_DEL', 1, 1, 1, '10:00', NULL, 'groupStage', '$D_A', '$D_B', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- Verwaiste Alt-Tabellen mit internen Werten (monitors.access_code, Sponsoren-Zaehler, Korrektur-Grund).
INSERT INTO public.monitors (id, tournament_id, name, type, config, access_code)
VALUES ('$(uuid_for monitor:alt)', '$T', 'Alt-Monitor', 'slideshow', '{}'::jsonb, 'ACC9Z1');
INSERT INTO public.sponsors (id, tournament_id, name, impressions, clicks)
VALUES ('$(uuid_for sponsor:alt)', '$T', 'Statistik-Sponsor', 4711, 815);
SQL
  # Spiel 1: Olli traegt 2:0 ein (Ergebnis-Eintrag), Maria korrigiert mit Grund (Korrektur-Zeile, Alt-Tabelle).
  ev RESULT_ENTRY "$(E s1-entry)" "{\"payload\":{\"scores\":{\"$FC_NORD\":2,\"$TSV_WEST\":0}}}"
  send "$U_OLLI" "$S1"; need_accepted "Spiel 1 (2:0)" "accepted"
  # Spiel 7: Anpfiff, Tor FC Nord Nr. 9 (3. Minute), Gelb FC Nord Nr. 4 -> per AMEND Nr. 14, Tor SV Süd Nr. 7
  # zurueckgenommen, Zeitstrafe SV Süd Nr. 5 (4. Minute, 120 s).
  ev MATCH_START "$(E s7-start)" '{"clockMs":null}'
  ev GOAL "$(E s7-goal-nord)" "{\"at\":2000,\"clockMs\":130000,\"teamId\":\"$FC_NORD\",\"payload\":{\"playerNumber\":9}}"
  ev YELLOW_CARD "$(E s7-yellow-nord)" "{\"at\":3000,\"clockMs\":150000,\"teamId\":\"$FC_NORD\",\"payload\":{\"playerNumber\":4}}"
  ev AMEND "$(E s7-amend-yellow)" "{\"at\":3500,\"clockMs\":155000,\"targetId\":\"$(E s7-yellow-nord)\",\"payload\":{\"playerNumber\":14}}"
  ev GOAL "$(E s7-goal-sued)" "{\"at\":4000,\"clockMs\":170000,\"teamId\":\"$SV_SUED\",\"payload\":{\"playerNumber\":7}}"
  ev RETRACT "$(E s7-retract-sued)" "{\"at\":4500,\"clockMs\":175000,\"targetId\":\"$(E s7-goal-sued)\"}"
  ev TIME_PENALTY "$(E s7-penalty-sued)" "{\"at\":5000,\"clockMs\":200000,\"teamId\":\"$SV_SUED\",\"payload\":{\"playerNumber\":5,\"durationSeconds\":120}}"
  send "$U_TOM" "$S7"; need_accepted "Spiel 7 (Tom)" "accepted,accepted,accepted,accepted,accepted,accepted,accepted"
  ev MATCH_START "$(E s8-start)" '{"clockMs":null}'
  send "$U_OLLI" "$S8"; need_accepted "Spiel 8 Anpfiff" "accepted"
  psql_stdin <<SQL
INSERT INTO public.match_corrections (match_id, previous_score_a, previous_score_b, new_score_a, new_score_b, reason_type,
                                      note, corrected_by)
VALUES ('$S1', 1, 0, 2, 0, 'input_error', 'Tor falsch zugeordnet', '$U_MARIA');
-- Ein Eintrag in der Klaerungsliste (review_state pending) -- nie oeffentlich (@ZM-098 Z. 3).
INSERT INTO public.match_events (id, match_id, type, team_id, payload, event_format, recorded_at, clock_ms, section, review_state,
                                 timestamp_seconds, score_home, score_away)
VALUES ('$(E s8-review)', '$S8', 'GOAL', '$DJK_BERG', '{"playerNumber":66}', 1, now(), 60000, 1, 'pending', 60, 0, 1);
-- Spiel 9 von 14:30 auf 14:40 verschoben (original_start schreibt erst B-26; bis dahin Harness).
SQL
}

setup_before() {
  echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  psql_stdin < "$BASELINE_FILE"
  local f
  for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done
  setup_helpers
  setup_data
}

# Nach der Migration (Spalte original_start existiert): Spiel 9 verschoben. forfeit_absent (A-25) bildet der Harness
# nach, wenn die Spalte noch fehlt (hier ohne CHECK), und setzt fuer Spiel 9 "B" (nur Lesepfad).
post_migration_data() {
  psql_stdin <<SQL
SET session_replication_role = replica;
UPDATE public.matches SET original_start = '14:30' WHERE id = '$S9';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS forfeit_absent text;
UPDATE public.matches SET forfeit_absent = 'B' WHERE id = '$S9';
SQL
}

# ---------------------------------------------------------------------------------------------------------------
# Proben
# ---------------------------------------------------------------------------------------------------------------
run_probes() {
  local full v viewer screen m7 events res st delta v2 v3 tmp exp who uid

  # --- P: Positivliste ------------------------------------------------------------------------------------------
  check P "@ZM-001 Vorbelegung am Server = src/core/models/publicContentDefaults.json" \
    "$(jq -cS . "$DEFAULTS_FILE" 2>/dev/null)" "$(q "SELECT public_view.switches('{}'::jsonb)::text;" | jq -cS . 2>/dev/null || echo fehlt)"
  full="$(pub anon null)"
  check P "Zuschauer-Link liefert das Turnier (anon, Voll-Antwort)" "full" "$(state_of "$full")"
  m7="$(match_of "$full" "$S7")"
  check P "@ZM-001 Vorbelegung: Live-Stand an -> laufendes Spiel 7 mit Stand 1:0" "1:0" "$(jq -r '"\(.score_a):\(.score_b)"' <<<"$m7" 2>/dev/null)"
  check P "@ZM-001 Vorbelegung: Ereignisse an -> Spiel 7 traegt Tor, Gelb, Zeitstrafe" "GOAL,YELLOW_CARD,TIME_PENALTY" \
    "$(jq -r '[.events[]?.type] | join(",")' <<<"$m7" 2>/dev/null)"
  check P "@ZM-001 Vorbelegung: Torschuetzen aus -> kein Schluessel scorers" "false" "$(jq 'has("scorers")' <<<"$full" 2>/dev/null)"
  check P "@ZM-001 Vorbelegung: Tabellen an -> Gleichstands-Entscheidung d1 da" "d1" \
    "$(jq -r '.tournament.config.standingDecisions[0].id // "fehlt"' <<<"$full" 2>/dev/null)"
  check P "Ereignis-Form: nur id, type, team_id, section, clock_ms, number[, duration_seconds]" \
    "clock_ms,id,number,section,team_id,type|clock_ms,id,number,section,team_id,type|clock_ms,duration_seconds,id,number,section,team_id,type" \
    "$(jq -r '[.events[]? | keys | join(",")] | join("|")' <<<"$m7" 2>/dev/null)"
  check P "@ZM-002 Tor FC Nord Nr. 9 in der 3. Minute (clock_ms 130000), Zeitstrafe SV Süd Nr. 5, 120 s" \
    "GOAL $FC_NORD 9 130000|TIME_PENALTY $SV_SUED 5 200000 120" \
    "$(jq -r '[.events[]? | select(.type != "YELLOW_CARD") | "\(.type) \(.team_id) \(.number) \(.clock_ms)\(if .duration_seconds then " \(.duration_seconds)" else "" end)"] | join("|")' <<<"$m7" 2>/dev/null)"
  check P "AMEND wirkt: Gelb FC Nord mit Nummer 14 statt 4" "14" "$(jq -r '[.events[]? | select(.type == "YELLOW_CARD")][0].number' <<<"$m7" 2>/dev/null)"
  check P "Zurueckgenommenes Tor SV Süd Nr. 7 fehlt" "fehlt" "$(has "$m7" "$(E s7-goal-sued)")"
  check P "@ZM-098 Z. 3 Eintrag der Klaerungsliste (Spiel 8, Nr. 66) fehlt" "fehlt" "$(has "$full" "$(E s8-review)")"
  check P "@ZM-098 Z. 2 keine Konto-Angabe zu Toms Eintraegen (actor, user_id, Geraet)" "fehlt|fehlt|fehlt|fehlt" \
    "$(has "$full" "$U_TOM")|$(has "$full" '"actor"')|$(has "$full" 'helper')|$(has "$full" 'device')"
  check P "@ZM-098 Z. 1 Korrektur: weder Grund noch korrigierende Person" "fehlt|fehlt|fehlt|fehlt" \
    "$(has "$full" 'Tor falsch zugeordnet')|$(has "$full" "$U_MARIA")|$(has "$full" 'Maria')|$(has "$full" 'input_error')"
  check P "@ZM-098 Z. 4 keine Sponsoren-Auswertung (Zaehler) und fuer Zuschauer keine Sponsoren" "fehlt|fehlt|fehlt" \
    "$(has "$full" '4711')|$(has "$full" 'impressions')|$(has "$full" 'sponsors')"
  check P "@ZM-096 Z. 1/@ZM-097 Ansprechpartner von FC Nord nie (Name, E-Mail, Telefon)" "fehlt|fehlt|fehlt" \
    "$(has "$full" 'Trainer Nordmann')|$(has "$full" 'nord@verein.test')|$(has "$full" '0160 9998887')"
  check P "@ZM-096 Z. 3/@W1-030/@W1-032 ohne Haekchen keine Kontaktperson des Veranstalters" "fehlt|fehlt|fehlt|fehlt" \
    "$(has "$full" 'Olga Orga')|$(has "$full" 'olga@orga.test')|$(has "$full" '0171 1112223')|$(has "$full" 'contactInfo')"
  check P "@ME-018 Zuschauer-Antwort ohne Monitor-Zugang (Monitor-IDs, access_code, Folien)" "fehlt|fehlt|fehlt|fehlt" \
    "$(has "$full" 'mon-feld1')|$(has "$full" 'mon-eingang')|$(has "$full" 'ACC9Z1')|$(has "$full" 'monitors')"
  check P "interne Angaben fehlen (adminNotes, dashboardStatus, Cockpit-Einstellungen, Rueckzugsgrund, Ausfallgrund)" \
    "fehlt|fehlt|fehlt|fehlt|fehlt" \
    "$(has "$full" 'Hausmeister Kurt')|$(has "$full" 'intern-dashboard')|$(has "$full" 'cockpit-intern')|$(has "$full" 'Rueckzug intern')|$(has "$full" 'Halle zu spaet')"
  check P "Gleichstands-Entscheidung ohne Begruendung, Person, Grund (decidedBy/decidedAt/reason und Alt-Text fehlen)" "fehlt|fehlt|fehlt|fehlt|fehlt" \
    "$(has "$full" 'Los gezogen')|$(has "$full" 'Olli Leitung')|$(has "$full" 'Losentscheid-Grund')|$(has "$full" 'decidedBy')|$(has "$full" 'reason')"
  check P "Gleichstands-Entscheidung: nur id, groupId, teamIds, order, kind[, shootout], basis" \
    "basis,groupId,id,kind,order,teamIds|basis,groupId,id,kind,order,shootout,teamIds" \
    "$(jq -r '[.tournament.config.standingDecisions[] | keys | join(",")] | join("|")' <<<"$full" 2>/dev/null)"
  # @W2A-059 Z. 3 / C-PUBLIC-ENTSCHEIDUNG-BASIS-LEER (20261118_007): der Fingerabdruck geht unveraendert durch, sonst
  # uebernimmt die Anzeige die Entscheidung nie; ein Alt-Text in basis (frueher Begruendung) wird zu "".
  check P "@W2A-059 basis = gespeicherter Fingerabdruck (Zuschauer, Monitor); Alt-Text in basis -> leer" "gleich|gleich|" \
    "$([[ "$(jq -r '.tournament.config.standingDecisions[0].basis' <<<"$full" 2>/dev/null)" == "$BASIS_D1" ]] && echo gleich || echo verschieden)|$([[ "$(jq -r '.tournament.config.standingDecisions[0].basis' <<<"$(disp anon "$T" mon-feld1 null)" 2>/dev/null)" == "$BASIS_D1" ]] && echo gleich || echo verschieden)|$(jq -r '.tournament.config.standingDecisions[1].basis' <<<"$full" 2>/dev/null)"
  check P "@W3-001 Zuschauer: kein Schiedsrichter, weder Name noch Nummer" "fehlt|fehlt|fehlt" \
    "$(has "$full" 'Paul Schmidt')|$(has "$full" 'referee_number')|$(has "$full" 'referee_config')"
  check P "Turnier: owner_id, version, Teams-Kontakte und Spieler fehlen" "fehlt|false|fehlt|fehlt" \
    "$(has "$full" "$U_OLLI")|$(jq '.tournament | has("version")' <<<"$full" 2>/dev/null)|$(has "$full" 'contact_')|$(has "$full" 'Spieler Neun')"
  check P "Spiel 9: original_start 14:30:00, forfeit_absent B (Positivliste)" "14:30:00|B" \
    "$(jq -r '"\(.original_start)|\(.forfeit_absent)"' <<<"$(match_of "$full" "$S9")" 2>/dev/null)"
  check P "Halbfinale 1: FC Nord mit Herkunft Erster Gruppe A, Gastseite offen (Zweiter Gruppe B)" "$FC_NORD|A1|B2|null" \
    "$(jq -r '"\(.team_a_id)|\(.slot_a_source.group)\(.slot_a_source.rank)|\(.slot_b_source.group)\(.slot_b_source.rank)|\(.team_b_id)"' <<<"$(match_of "$full" "$HF1")" 2>/dev/null)"

  # Haekchen gesetzt: Kontaktperson des Veranstalters ja, Team-Kontakt weiter nein (@ZM-097, @W1-031)
  set_config "jsonb_set(config, '{contactInfo,showPublic}', 'true'::jsonb)"
  viewer="$(pub anon null)"
  check P "@ZM-097/@W1-031 mit Haekchen: Name, Telefon, E-Mail der Kontaktperson" "Olga Orga|0171 1112223|olga@orga.test" \
    "$(jq -r '.tournament.config.contactInfo | "\(.name)|\(.phone)|\(.email)"' <<<"$viewer" 2>/dev/null)"
  check P "@ZM-097 mit Haekchen: nichts vom Ansprechpartner von FC Nord" "fehlt|fehlt" \
    "$(has "$viewer" 'Trainer Nordmann')|$(has "$viewer" 'nord@verein.test')"
  screen="$(disp anon "$T" mon-feld1 null)"
  check P "@ZM-096 Z. 2/4 Monitor-Link: keine Kontaktperson (auch mit Haekchen) und kein Team-Kontakt" "fehlt|fehlt|fehlt" \
    "$(has "$screen" 'Olga Orga')|$(has "$screen" 'Trainer Nordmann')|$(has "$screen" 'contactInfo')"
  set_config "config #- '{contactInfo,showPublic}'"

  # Bildschirm: Schiedsrichter, eigener Monitor, eigene Sponsoren (@W3-001, @W3-032, @ME-018, E-A2)
  check P "@W3-032 Monitor-Link Vorgabe Nummer: SR-Nummer fuer Spiel 7, kein Name (Regel 12)" "1|fehlt|false" \
    "$(jq -r '.matches[] | select(.id == "'"$S7"'") | .referee_number' <<<"$screen" 2>/dev/null)|$(has "$screen" 'Paul Schmidt')|$(jq '.tournament.referee_config | has("refereeNames")' <<<"$screen" 2>/dev/null)"
  set_config "config || '{\"monitorReferees\":\"name\"}'::jsonb"
  tmp="$(disp anon "$T" mon-feld1 null)"
  check P "@W3-032 Gegenbeispiel: Einstellung Name -> Paul Schmidt und Nummer 1" "Paul Schmidt|1" \
    "$(jq -r '"\(.tournament.referee_config.refereeNames."1")|\(.matches[] | select(.id == "'"$S7"'") | .referee_number)"' <<<"$tmp" 2>/dev/null)"
  check P "@W3-001 auch mit Einstellung Name: Zuschauer-Link ohne Schiedsrichter" "fehlt|fehlt" \
    "$(has "$(pub anon null)" 'Paul Schmidt')|$(has "$(pub anon null)" 'referee_number')"
  set_config "config || '{\"monitorReferees\":\"none\"}'::jsonb"
  tmp="$(disp anon "$T" mon-feld1 null)"
  check P "@W3-032 Einstellung gar nicht -> keine SR-Angaben am Monitor" "fehlt|fehlt|fehlt" \
    "$(has "$tmp" 'Paul Schmidt')|$(has "$tmp" 'referee_number')|$(has "$tmp" 'referee_config')"
  set_config "config - 'monitorReferees'"
  check P "@ME-018 Monitor-Link: nur der eigene Monitor, nur seine Sponsoren, kein access_code" "mon-feld1|sp-baecker|fehlt|fehlt|fehlt" \
    "$(jq -r '[.tournament.config.monitors[]?.id] | join(",")' <<<"$screen" 2>/dev/null)|$(jq -r '[.tournament.config.sponsors[]?.id] | join(",")' <<<"$screen" 2>/dev/null)|$(has "$screen" 'mon-eingang')|$(has "$screen" 'sp-auto')|$(has "$screen" 'ACC9Z1')"
  check P "Monitor-Link: keine internen Notizen, keine Sponsoren-Zaehler" "fehlt|fehlt" "$(has "$screen" 'Hausmeister Kurt')|$(has "$screen" '4711')"

  # @ZM-099 ausgeschaltete Inhalte (Zuschauer-Link und Monitor-Link)
  set_config "config || '{\"publicScorers\":true}'::jsonb"
  viewer="$(pub anon null)"
  check P "@ZM-099 Gegenbeispiel: Torschuetzen eingeschaltet -> FC Nord Nr. 9 mit 1 Tor" "$FC_NORD|9|1" \
    "$(jq -r '.scorers[0] | "\(.team_id)|\(.number)|\(.goals)"' <<<"$viewer" 2>/dev/null)"
  set_config "config - 'publicScorers'"
  viewer="$(pub anon null)"; screen="$(disp anon "$T" mon-feld1 null)"
  check P "@ZM-099 Z. 1 Torschuetzen aus -> keine Torschuetzen (Zuschauer, Monitor)" "false|false" \
    "$(jq 'has("scorers")' <<<"$viewer" 2>/dev/null)|$(jq 'has("scorers")' <<<"$screen" 2>/dev/null)"
  set_config "config || '{\"publicEvents\":false}'::jsonb"
  viewer="$(pub anon null)"; screen="$(disp anon "$T" mon-feld1 null)"
  check P "@ZM-099 Z. 2 Ereignisse aus -> keine Tore, Karten, Zeitstrafen (Zuschauer, Monitor)" "0|0" \
    "$(jq '[.matches[].events[]?] | length' <<<"$viewer" 2>/dev/null)|$(jq '[.matches[].events[]?] | length' <<<"$screen" 2>/dev/null)"
  check P "@ZM-099 Z. 2 Gegenbeispiel: Stand bleibt (Spiel 7 1:0)" "1:0" \
    "$(jq -r '"\(.score_a):\(.score_b)"' <<<"$(match_of "$viewer" "$S7")" 2>/dev/null)"
  set_config "(config - 'publicEvents') || '{\"hideRankingsForPublic\":true}'::jsonb"
  viewer="$(pub anon null)"; screen="$(disp anon "$T" mon-feld1 null)"
  check P "@ZM-099 Z. 3 Gruppentabellen aus -> keine Gleichstands-Entscheidungen (Zuschauer, Monitor)" "false|false" \
    "$(jq '.tournament.config | has("standingDecisions")' <<<"$viewer" 2>/dev/null)|$(jq '.tournament.config | has("standingDecisions")' <<<"$screen" 2>/dev/null)"
  check P "@ZM-102 Z. 2 Gruppentabellen aus: HF1 FC Nord ohne Herkunft Erster Gruppe A, Gast weiter offen B2" "$FC_NORD|null|null|B2" \
    "$(jq -r '"\(.team_a_id)|\(.slot_a_source)|\(.origin_a)|\(.slot_b_source.group)\(.slot_b_source.rank)"' <<<"$(match_of "$viewer" "$HF1")" 2>/dev/null)"
  set_config "(config - 'hideRankingsForPublic') || '{\"publicLiveScore\":false,\"publicScorers\":true}'::jsonb"
  viewer="$(pub anon null)"
  check P "@ZM-102 Z. 1 Live-Stand aus: laufendes Spiel 7 ohne Stand und ohne Tor-Ereignis" "null|null|YELLOW_CARD,TIME_PENALTY" \
    "$(jq -r '"\(.score_a)|\(.score_b)|\([.events[]?.type] | join(","))"' <<<"$(match_of "$viewer" "$S7")" 2>/dev/null)"
  check P "@ZM-102 Z. 1 Torschuetzen-Zwischenstand zaehlt Nr. 9 aus dem laufenden Spiel 7 nicht" "[]" \
    "$(jq -c '.scorers' <<<"$viewer" 2>/dev/null)"
  check P "@ZM-102 Z. 1 Gegenbeispiel: beendetes Spiel 1 behaelt 2:0" "2:0" \
    "$(jq -r '"\(.score_a):\(.score_b)"' <<<"$(match_of "$viewer" "$S1")" 2>/dev/null)"
  set_config "(config - 'publicLiveScore') || '{\"hideScoresForPublic\":true}'::jsonb"
  viewer="$(pub anon null)"; screen="$(disp anon "$T" mon-feld1 null)"
  check P "Kindermodus: kein Stand, keine Ereignisse, keine Torschuetzen, keine Wertung (Zuschauer)" "0|0|false|0" \
    "$(jq '[.matches[] | select(has("score_a") or has("penalty_score_a"))] | length' <<<"$viewer" 2>/dev/null)|$(jq '[.matches[].events[]?] | length' <<<"$viewer" 2>/dev/null)|$(jq 'has("scorers")' <<<"$viewer" 2>/dev/null)|$(jq '[.matches[] | select(has("decided_by") or has("forfeit_absent"))] | length' <<<"$viewer" 2>/dev/null)"
  check P "Kindermodus: Monitor-Link ebenso ohne Stand und Ereignisse" "0|0" \
    "$(jq '[.matches[] | select(has("score_a"))] | length' <<<"$screen" 2>/dev/null)|$(jq '[.matches[].events[]?] | length' <<<"$screen" 2>/dev/null)"
  check P "Kindermodus Gegenbeispiel: Phase und Uhr von Spiel 7 bleiben (live_state)" "running" \
    "$(jq -r '.live_state.status' <<<"$(match_of "$viewer" "$S7")" 2>/dev/null)"
  check P "N2 Kindermodus: live_state ohne Entscheidungs-Angaben (awaitingTiebreakerChoice, tiebreakerMode)" "false|false" \
    "$(jq -r '.live_state | "\(has("awaitingTiebreakerChoice"))|\(has("tiebreakerMode"))"' <<<"$(match_of "$viewer" "$S7")" 2>/dev/null)"
  set_config "config - 'hideScoresForPublic' - 'publicScorers'"

  # --- A: Antwort und Versionen ---------------------------------------------------------------------------------
  res="$(pub anon null ZZZZZZ)"; tmp="$(pub anon null WINTER)"
  check A "@ZM-068 unbekannter Code und nicht geteilter Wintercup: dieselbe Antwort not_found" \
    '{"state": "not_found"}|{"state": "not_found"}' "$res|$tmp"
  check A "@ZM-068 Code in falscher Form (Kleinschreibung erlaubt, Laenge 7 nicht)" "full|not_found" \
    "$(state_of "$(pub anon null hcnord)")|$(state_of "$(pub anon null HCNORD1)")"
  check A "@ZM-100 Wintercup: auch ohne Anmeldung direkt an der Tabelle nichts (GET /tournaments?share_code=eq.WINTER)" "0" \
    "$(rows anon "/tournaments?share_code=eq.WINTER&select=id")"
  check A "@ZM-063 vor dem Online-Teilen: Turnier ueber den Code nicht erreichbar" "not_found" "$(state_of "$tmp")"
  q "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_DEL';" >/dev/null
  check A "@ZM-036 Z. 4 geloeschtes Turnier: not_found" "not_found" "$(state_of "$(pub anon null GELOES)")"
  # Online-Teilen zuruecknehmen (make_tournament_private als Olli, roh per REST) und erneut teilen.
  st="$(rest "$U_OLLI" POST /rpc/make_tournament_private "{\"tournament_id\":\"$T\"}")"
  check A "@ZM-066 Olli nimmt das Online-Teilen zurueck (REST make_tournament_private)" "204" "$st"
  check A "@ZM-066/@ZM-101/@ZM-065 danach: Zuschauer-Link not_found (keine Angaben)" '{"state": "not_found"}' "$(pub anon null)"
  screen="$(disp anon "$T" mon-feld1 null)"
  check A "@ZM-066 Z. 2/@ZM-101 Hallenmonitor Feld 1 zeigt weiter Spiel 7 mit Stand" "full|1:0" \
    "$(state_of "$screen")|$(jq -r '"\(.score_a):\(.score_b)"' <<<"$(match_of "$screen" "$S7")" 2>/dev/null)"
  st="$(rest "$U_OLLI" POST /rpc/make_tournament_public "{\"tournament_id\":\"$T\"}")"
  check A "@ZM-067 erneut geteilt: derselbe Code, Zuschauer-Link liefert wieder" "200|$SHARE|full" \
    "$st|$(jq -r '.[0].share_code' "$WORK/b" 2>/dev/null)|$(state_of "$(pub anon null)")"
  check A "@ZM-069 nach Wiederoeffnen (completed_at gesetzt, dann zurueck) gilt der Link weiter" "full" \
    "$(q "UPDATE public.tournaments SET completed_at = now() WHERE id = '$T'; UPDATE public.tournaments SET completed_at = NULL WHERE id = '$T';" >/dev/null; state_of "$(pub anon null)")"
  # @ZM-109: eine Stoerung am Server ist nie not_found -- interner Baustein fehlt -> HTTP-Fehler statt not_found.
  q "ALTER FUNCTION public_view.public_payload(uuid, bigint, text, text) RENAME TO public_payload_weg;" >/dev/null
  res="$(pub anon null)"; st="$(cat "$WORK/st")"
  check A "@ZM-109 Stoerung (interner Fehler): HTTP-Fehler, nie {state:not_found}" "fehler|fehlt" \
    "$([[ "$st" -ge 400 ]] && echo fehler || echo "http-$st")|$(has "$res" 'not_found')"
  q "ALTER FUNCTION public_view.public_payload_weg(uuid, bigint, text, text) RENAME TO public_payload;" >/dev/null

  age_rows
  full="$(pub anon null)"
  v="$(jq -r '.version' <<<"$full")"
  res="$(pub anon "$v")"
  check A "keine Aenderung seit version -> {state:unchanged, version, server_now}" "unchanged|$v|server_now,state,version" \
    "$(state_of "$res")|$(jq -r '.version' <<<"$res" 2>/dev/null)|$(jq -r 'keys | join(",")' <<<"$res" 2>/dev/null)"
  tmp="$(python3 -c 'import time; print(int(time.time()*1000))')"
  check A "server_now in Millisekunden (|server_now - jetzt| < 10 s)" "ms" \
    "$(jq -r --argjson now "$tmp" 'if (.server_now - $now) * (.server_now - $now) < 100000000 then "ms" else "falsch:\(.server_now)" end' <<<"$res" 2>/dev/null)"
  check A "version ist eine ganze Zahl >= 0 (Mikrosekunden, < 2^53)" "ok" \
    "$(jq -r 'if (.version | type) == "number" and .version >= 0 and .version < 9007199254740991 and (.version | floor) == .version then "ok" else "falsch" end' <<<"$full" 2>/dev/null)"
  # Ein Tor in Spiel 8 -> Delta mit genau Spiel 8, tournament_date, base_version.
  ev GOAL "$(E s8-goal-berg)" "{\"at\":6000,\"clockMs\":240000,\"teamId\":\"$DJK_BERG\",\"payload\":{\"playerNumber\":11}}"
  send "$U_OLLI" "$S8"; need_accepted "Spiel 8 Tor" "accepted"
  delta="$(pub anon "$v")"
  check A "1 Tor -> {state:delta} nur mit Spiel 8, tournament_date, base_version (geloeschte Spiele kommen voll, A1)" \
    "delta|$S8|2026-11-21|$v|null" \
    "$(state_of "$delta")|$(jq -r '[.matches[].id] | join(",")' <<<"$delta" 2>/dev/null)|$(jq -r '.tournament_date' <<<"$delta" 2>/dev/null)|$(jq -r '.base_version' <<<"$delta" 2>/dev/null)|$(jq -c '.removed_match_ids' <<<"$delta" 2>/dev/null)"
  check A "Delta: Spiel 8 komplett (Stand 0:1, Tor DJK Berg Nr. 11), keine Teams, kein Turnierkopf" "0:1|11|false|false" \
    "$(jq -r '"\(.score_a):\(.score_b)"' <<<"$(match_of "$delta" "$S8")" 2>/dev/null)|$(jq -r '[.events[]? | select(.type == "GOAL")][0].number' <<<"$(match_of "$delta" "$S8")" 2>/dev/null)|$(jq 'has("teams")' <<<"$delta" 2>/dev/null)|$(jq 'has("tournament")' <<<"$delta" 2>/dev/null)"
  v2="$(jq -r '.version' <<<"$delta")"
  check A "Delta-Version steigt (version > base_version)" "true" "$(jq -r '.version > .base_version' <<<"$delta" 2>/dev/null)"
  # Nachlauf 5 s: innerhalb des Fensters kommt Spiel 8 noch einmal (spaet festgeschriebene Eintraege gehen nicht verloren).
  res="$(pub anon "$v2")"
  check A "Nachlauf: innerhalb von 5 s nach dem Tor kommt Spiel 8 noch einmal (Delta, keine Luecke)" "delta|$S8" \
    "$(state_of "$res")|$(jq -r '[.matches[].id] | join(",")' <<<"$res" 2>/dev/null)"
  age_rows
  v3="$(jq -r '.version' <<<"$(pub anon null)")"
  # Schalter-Wechsel (Kindermodus) -> Voll-Antwort statt Delta (Review #342 A5 Punkt 4), Stand weg.
  set_config "config || '{\"hideScoresForPublic\":true}'::jsonb"
  res="$(pub anon "$v3")"
  check A "@ZM-036 Z. 1 Schalter-Wechsel (Kindermodus) -> Voll-Antwort, kein Stand mehr" "full|0" \
    "$(state_of "$res")|$(jq '[.matches[]? | select(has("score_a"))] | length' <<<"$res" 2>/dev/null)"
  set_config "config - 'hideScoresForPublic'"
  age_rows
  v3="$(jq -r '.version' <<<"$(pub anon null)")"
  set_config "config || '{\"publicEvents\":false}'::jsonb"
  res="$(pub anon "$v3")"
  check A "Schalter-Wechsel (Ereignisse aus) -> Voll-Antwort" "full" "$(state_of "$res")"
  set_config "config - 'publicEvents'"
  q "UPDATE public.teams SET name = 'SC Ost 1919' WHERE id = '$SC_OST';" >/dev/null
  age_rows
  v3="$(jq -r '.version' <<<"$(pub anon null)")"
  q "UPDATE public.teams SET name = 'SC Ost' WHERE id = '$SC_OST';" >/dev/null
  res="$(pub anon "$v3")"
  check A "Team geaendert -> Voll-Antwort mit Teams" "full|SC Ost" \
    "$(state_of "$res")|$(jq -r --arg id "$SC_OST" '.teams[] | select(.id == $id) | .name' <<<"$res" 2>/dev/null)"
  check A "since voraus (Zukunft) oder negativ -> Voll-Antwort" "full|full" \
    "$(state_of "$(pub anon 99999999999999999)")|$(state_of "$(pub anon -1)")"
  check A "N5 since voraus: die Voll-Antwort traegt die eigene Version, nicht since" "true" \
    "$(jq -r '.version < 99999999999999999' <<<"$(pub anon 99999999999999999)" 2>/dev/null)"

  # A1 langsames save(): Turnier-Upsert, > 5 s Pause (Altern), dann Spiel einfuegen bzw. loeschen.
  q "UPDATE public.tournaments SET title = title WHERE id = '$T';" >/dev/null
  age_rows
  v3="$(jq -r '.version' <<<"$(pub anon null)")"
  q "INSERT INTO public.matches (id, tournament_id, round, field, match_number, scheduled_start, group_letter, phase, team_a_id, team_b_id, updated_at)
     VALUES ('$S_NEU', '$T', 5, 2, 15, '15:05', 'A', 'groupStage', '$SV_SUED', '$SC_OST', now() - interval '1 hour');" >/dev/null
  res="$(pub anon "$v3")"
  check A "A1 neues Spiel mit nachgehender Geraeteuhr (updated_at vor since) kommt an" "enthalten" \
    "$([[ "$(jq -r --arg id "$S_NEU" '[.matches[]?.id] | index($id) != null' <<<"$res" 2>/dev/null)" == "true" ]] && echo enthalten || echo "fehlt:$(state_of "$res")")"
  q "UPDATE public.tournaments SET title = title WHERE id = '$T';" >/dev/null
  age_rows
  v3="$(jq -r '.version' <<<"$(pub anon null)")"
  st="$(rest "$U_OLLI" DELETE "/matches?id=eq.$HF2")"
  res="$(pub anon "$v3")"
  check A "A1 Olli loescht Halbfinale 2 (REST) > 5 s nach dem Turnier-Upsert -> Voll-Antwort ohne HF2" "204|full|fehlt" \
    "$st|$(state_of "$res")|$(has "$(jq -c '[.matches[]?.id]' <<<"$res")" "$HF2")"
  age_rows
  v3="$(jq -r '.version' <<<"$(pub anon null)")"
  q "INSERT INTO public.teams (id, tournament_id, name, group_letter, sort_order, updated_at) VALUES ('$T_NEU', '$T', 'FC Neu', 'B', 7, now() - interval '1 hour');" >/dev/null
  res="$(pub anon "$v3")"
  check A "A1 neues Team mit alter Uhr -> Voll-Antwort mit FC Neu" "full|FC Neu" \
    "$(state_of "$res")|$(jq -r --arg id "$T_NEU" '.teams[]? | select(.id == $id) | .name' <<<"$res" 2>/dev/null)"
  age_rows
  v3="$(jq -r '.version' <<<"$(pub anon null)")"
  st="$(rest "$U_OLLI" DELETE "/teams?id=eq.$T_NEU")"
  res="$(pub anon "$v3")"
  check A "A1 Olli loescht das Team wieder (REST) -> Voll-Antwort ohne FC Neu" "204|full|fehlt" \
    "$st|$(state_of "$res")|$(has "$res" 'FC Neu')"

  # --- M: Monitor-Link -------------------------------------------------------------------------------------------
  check M "Hallenmonitor Feld 1 (anon, Monitor-Link) -> Voll-Antwort" "full" "$(state_of "$(disp anon "$T" mon-feld1 null)")"
  check M "unbekannter Monitor -> not_found" "not_found" "$(state_of "$(disp anon "$T" mon-unbekannt null)")"
  check M "Monitor eines anderen Turniers (mon-winter) am Hallencup -> not_found" "not_found" "$(state_of "$(disp anon "$T" mon-winter null)")"
  check M "@ZM-101 Wintercup (nicht geteilt) ueber den eigenen Monitor-Link -> Voll-Antwort" "full|Wintercup" \
    "$(state_of "$(disp anon "$T_WINTER" mon-winter null)")|$(jq -r '.tournament.title' "$WORK/b" 2>/dev/null)"
  check M "geloeschtes Turnier ueber seinen Monitor-Link -> not_found" "not_found" "$(state_of "$(disp anon "$T_DEL" mon-alt null)")"
  check M "Monitor-Link ohne Monitor-ID -> not_found" "not_found" "$(state_of "$(disp anon "$T" "" null)")"
  age_rows
  screen="$(disp anon "$T" mon-feld1 null)"; v="$(jq -r '.version' <<<"$screen")"
  check M "Monitor-Link: keine Aenderung -> unchanged" "unchanged" "$(state_of "$(disp anon "$T" mon-feld1 "$v")")"

  # --- R: rohe REST-Aufrufe je Rolle (Review Focus 6, § 2 Nr. 11) -------------------------------------------------
  # sicht <uid|anon> -> "t,te,m,e,mo,sp,tp,mc,rpc"
  sicht() {
    echo "$(rows "$1" "/tournaments?share_code=eq.$SHARE&select=id"),$(rows "$1" "/teams?tournament_id=eq.$T&select=id"),$(rows "$1" "/matches?tournament_id=eq.$T&select=id"),$(rows "$1" "/match_events?match_id=eq.$S7&select=id"),$(rows "$1" "/monitors?tournament_id=eq.$T&select=id"),$(rows "$1" "/sponsors?tournament_id=eq.$T&select=id"),$(rows "$1" "/team_players?select=id"),$(rows "$1" "/match_corrections?select=id"),$(state_of "$(pub "$1" null)")"
  }
  local leer="0,0,0,0,0,0,0,0,full"
  check R "Mama Petra (anon, kein JWT-Konto): GET tournaments?share_code=eq.HCNORD -> 0, monitors -> 0, alles 0; RPC full" "$leer" "$(sicht anon)"
  check R "Lena (anonyme Sitzung ohne Rolle): alles 0, RPC full" "$leer" "$(sicht "$U_LENA")"
  check R "Clara (Konto ohne Rolle): alles 0, RPC full" "$leer" "$(sicht "$U_CLARA")"
  check R "Fremder Eigentuemer (Wintercup): Hallencup alles 0" "$leer" "$(sicht "$U_FREMD")"
  check R "Helfer entzogen (Theo, declined): alles 0" "$leer" "$(sicht "$U_THEO")"
  check R "Helfer anderes Turnier (Hanna, Wintercup): Hallencup alles 0" "$leer" "$(sicht "$U_HANNA")"
  check R "Bildschirm gekoppelt (screen): direkt alles 0 (nur Positivliste)" "$leer" "$(sicht "$U_SCREEN")"
  check R "Bildschirm geloest (screen, declined): alles 0" "$leer" "$(sicht "$U_SCREEN_FREE")"
  check R "Bildschirm anderes Turnier (Wintercup): Hallencup alles 0" "$leer" "$(sicht "$U_SCREEN_OTHER")"
  check R "Helfer zugelassen (Tom, GA5 I-2): liest das ganze Turnier, keine Monitore" "1,6,6,7,0,1,1,1,full" "$(sicht "$U_TOM")"
  check R "Zuschauer-Mitglied (Vera, viewer): liest das Turnier, keine Monitore" "1,6,6,7,0,1,1,1,full" "$(sicht "$U_VERA")"
  check R "Co-Admin (Maria): liest alles inkl. Monitore" "1,6,6,7,1,1,1,1,full" "$(sicht "$U_MARIA")"
  check R "Eigentuemer (Olli): liest alles inkl. Monitore" "1,6,6,7,1,1,1,1,full" "$(sicht "$U_OLLI")"
  check R "Gegenbeispiel Fremder: eigenes Turnier (Wintercup) liest er" "1" "$(rows "$U_FREMD" "/tournaments?id=eq.$T_WINTER&select=id")"
  check R "anon: GET /tournaments (ohne Filter) zaehlt keine oeffentlichen Turniere auf" "0" "$(rows anon "/tournaments?select=id")"
}

# run_assertions -- Rechte-Assertion als ci_schema_reader; Namensliste = db-drift-check.sh.
run_assertions() {
  local priv names_sql names_sh
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  # Assertions spaeterer Migrationen (nach 20261117_104, hier nicht eingespielt) zaehlen nicht: Namen aus der festen
  # Zuordnung in db-drift-check.sh (pending_assertions_for).
  local later="" f
  for f in ${AFTER[@]+"${AFTER[@]}"}; do
    later="$later $(awk -v n="    $(basename "$f"))" '$0 == n { getline; if ($0 ~ /echo "/) { sub(/^[^"]*"/, ""); sub(/"[^"]*$/, ""); print } }' "$REPO_ROOT/scripts/db-drift-check.sh")"
  done
  check S "Rechte-Assertion: keine Zeile |f (ohne Assertions spaeterer Migrationen)" "" \
    "$(grep -v '|t$' <<<"$priv" | while IFS= read -r line; do [[ " $later " == *" ${line%%|*} "* ]] || echo "$line"; done || true)"
  check S "Rechte-Assertion: die B-14-Zeilen vorhanden und |t" \
    "public-read-core-unchanged|t,public-read-default-privileges-no-anon|t,public-read-functions-definer-execute-anon|t,public-read-no-anon-select-policies|t,public-read-reading-member-execute-only-authenticated|t,public-read-reshare-keeps-code|t,public-read-view-schema-no-client-access|t" \
    "$(grep -E '^public-read-' <<<"$priv" | sort | paste -sd, -)"
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
}

# Byte-Messung (nur Ausgabe): Statuszeile + Kopfzeilen + Body der echten HTTP-Antwort, Body gzip -9.
measure() { # measure <Bezeichnung> <uid|anon> <rpc> <body>
  local st hb bb gz
  st="$(rest "$2" POST "/rpc/$3" "$4")"
  hb="$(wc -c < "$WORK/h" | tr -d ' ')"
  bb="$(wc -c < "$WORK/b" | tr -d ' ')"
  gz="$(gzip -9 -c "$WORK/b" | wc -c | tr -d ' ')"
  if [[ -n "${PAYLOAD_DUMP_DIR:-}" ]]; then
    mkdir -p "$PAYLOAD_DUMP_DIR"
    cp "$WORK/b" "$PAYLOAD_DUMP_DIR/$(tr -c 'A-Za-z0-9' '_' <<<"$1").json"
    cp "$WORK/h" "$PAYLOAD_DUMP_DIR/$(tr -c 'A-Za-z0-9' '_' <<<"$1").headers"
  fi
  printf 'MESSUNG  %-44s HTTP %s  Kopf %5s B  Body %6s B  gesamt %6s B  Body gzip %5s B  gesamt(gzip) %6s B\n' \
    "$1" "$st" "$hb" "$bb" "$((hb + bb))" "$gz" "$((hb + gz))"
}
run_measurement() {
  local v vs
  age_rows
  v="$(jq -r '.version' <<<"$(pub anon null)")"
  vs="$(jq -r '.version' <<<"$(disp anon "$T" mon-feld1 null)")"
  echo
  echo "--- B: Messung (Wegwerf-PostgREST direkt, ohne Cloud-Gateway; Seed Hallencup Nord: 6 Teams, 6 Spiele, 2 laufend) ---"
  measure "Zuschauer Voll (public_tournament)" anon public_tournament "{\"share_code\":\"$SHARE\",\"since_version\":null}"
  measure "Zuschauer keine Aenderung" anon public_tournament "{\"share_code\":\"$SHARE\",\"since_version\":$v}"
  measure "Zuschauer not_found" anon public_tournament "{\"share_code\":\"ZZZZZZ\",\"since_version\":null}"
  measure "Bildschirm Voll (display_tournament)" anon display_tournament "{\"tournament_id\":\"$T\",\"monitor_id\":\"mon-feld1\",\"since_version\":null}"
  measure "Bildschirm keine Aenderung" anon display_tournament "{\"tournament_id\":\"$T\",\"monitor_id\":\"mon-feld1\",\"since_version\":$vs}"
  ev GOAL "$(E s7-goal-messung)" "{\"at\":7000,\"clockMs\":300000,\"teamId\":\"$FC_NORD\",\"payload\":{\"playerNumber\":10}}"
  send "$U_OLLI" "$S7"; need_accepted "Messung Tor" "accepted"
  measure "Zuschauer Delta 1 Tor (Spiel 7, 4 Ereignisse)" anon public_tournament "{\"share_code\":\"$SHARE\",\"since_version\":$v}"
  measure "Bildschirm Delta 1 Tor" anon display_tournament "{\"tournament_id\":\"$T\",\"monitor_id\":\"mon-feld1\",\"since_version\":$vs}"
}

apply_basis_followup() {
  if [[ -f "$BASIS_FOLLOWUP_FILE" ]]; then
    psql_stdin < "$BASIS_FOLLOWUP_FILE" >/dev/null || { echo "::error::$(basename "$BASIS_FOLLOWUP_FILE") scheitert" >&2; exit 1; }
    echo "Folge-Migration $(basename "$BASIS_FOLLOWUP_FILE") eingespielt (Proben gegen diese Fassung)." >&2
  else
    echo "Folge-Migration $(basename "$BASIS_FOLLOWUP_FILE") fehlt -- Proben gegen 20261117_104." >&2
  fi
}

summary() {
  local i
  echo
  for i in "${!CATS[@]}"; do echo "Kategorie ${CATS[$i]}: ${OKS[$i]} OK, ${DEVS[$i]} Abweichung(en)"; done
}

# ---------------------------------------------------------------------------------------------------------------
if [[ "$MODE" == "gegenprobe" ]]; then
  export G1_FROM="CREATE POLICY tournaments_select_v4 ON public.tournaments FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = owner_id) OR public.is_reading_member(id));"
  export G1_TO="CREATE POLICY tournaments_select_v4 ON public.tournaments FOR SELECT TO anon, authenticated
  USING ((is_public = true) OR ((SELECT auth.uid()) = owner_id) OR public.is_reading_member(id));"
  export G2_FROM="IF jsonb_typeof(v_contact) = 'object' AND v_contact -> 'showPublic' = 'true'::jsonb THEN"
  export G2_TO="IF jsonb_typeof(v_contact) = 'object' THEN"
  export G3_FROM="SELECT NOT v_kids AND (m.match_status IS NULL"
  export G3_TO="SELECT (m.match_status IS NULL"
  export G4_FROM="           'clock_ms', s.clock_ms,"
  export G4_TO="           'clock_ms', s.clock_ms, 'payload', s.payload, 'actor', 'helper',"
  export G5_FROM="     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_config -> 'monitors') AS x(m) WHERE m ->> 'id' = \$2) THEN"
  export G5_TO="     THEN"
  export G6_FROM="   WHERE t.share_code = v_code AND coalesce(t.is_public, false) AND t.deleted_at IS NULL;"
  export G6_TO="   WHERE t.share_code = v_code AND t.deleted_at IS NULL;"
  export G7_FROM="  v_referees := CASE WHEN NOT v_screen THEN 'none'"
  export G7_TO="  v_referees := CASE WHEN false THEN 'none'"
  export G10_FROM="              OR coalesce(v_structure_us, 0) > p_since_version;"
  export G10_TO="              ;"
  export G11_FROM="CREATE TRIGGER matches_updated_at_insert BEFORE INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();"
  export G11_TO=""
  export G11B_FROM="CREATE TRIGGER teams_updated_at_insert BEFORE INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();"
  export G11B_TO=""
  export G12_FROM="                               THEN v_t.referee_config - 'refereeNames' END,"
  export G12_TO="                               THEN v_t.referee_config END,"
  export G13_FROM="       AND NOT (p_kids AND e.key IN ('tiebreakerMode', 'awaitingTiebreakerChoice'))) END;"
  export G13_TO=") END;"
  export G8_FROM="    v_full := coalesce(v_tournament_us, 0) > p_since_version OR coalesce(v_teams_us, 0) > p_since_version
              OR coalesce(v_structure_us, 0) > p_since_version;"
  export G8_TO="    v_full := coalesce(v_teams_us, 0) > p_since_version
              OR coalesce(v_structure_us, 0) > p_since_version;"
  export G9_FROM="   WHERE e.key = ANY (c_config_keys) AND e.value <> 'null'::jsonb;"
  export G9_TO="   WHERE e.value <> 'null'::jsonb;"
  # G14 mutiert die Folge-Migration 20261118_007 (dort steht basis); alle anderen die Ziel-Migration.
  export G14_FROM="                               THEN d -> 'basis' ELSE '\"\"'::jsonb END"
  export G14_TO="                               THEN '\"\"'::jsonb ELSE '\"\"'::jsonb END"
  MUTS=(G1 G2 G3 G4 G5 G6 G7 G8 G9 G10 G11 G11B G12 G13 G14)
  RED_TOTAL=0
  for mut in "${MUTS[@]}"; do
    start_container "$(tr 'A-Z' 'a-z' <<<"$mut")"
    setup_before
    mutate() {
      MUT_KEY="$mut" python3 -c '
import os, sys
s = sys.stdin.read()
k = os.environ["MUT_KEY"]
frm = os.environ[k + "_FROM"]
if s.count(frm) != 1:
    sys.exit("Gegenprobe: Muster %s nicht genau einmal in der Migration (%d)" % (k, s.count(frm)))
sys.stdout.write(s.replace(frm, os.environ[k + "_TO"]))' < "$1" | psql_stdin
    }
    # Muster in public_view.config_for (G2, G9) stehen auch in 20261118_007, die die Funktion ersetzt: dort mit
    # mutieren, sonst ueberschriebe die Folge-Migration die Mutation. G14 steht nur in 20261118_007.
    if [[ "$mut" == "G14" ]]; then
      psql_stdin < "$TARGET_FILE"
      mutate "$BASIS_FOLLOWUP_FILE"
    else
      mutate "$TARGET_FILE"
      from_var="${mut}_FROM"
      if [[ -f "$BASIS_FOLLOWUP_FILE" ]] && grep -qF -- "${!from_var}" "$BASIS_FOLLOWUP_FILE"; then
        mutate "$BASIS_FOLLOWUP_FILE"
      else
        apply_basis_followup
      fi
    fi
    post_migration_data
    start_rest
    reset_counts
    echo "--- GEGENPROBE $mut ---"
    run_probes
    run_assertions
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "GEGENPROBE $mut: rot ($(total_dev) Abweichung(en): $(for i in "${!CATS[@]}"; do [[ "${DEVS[$i]}" -gt 0 ]] && printf '%s=%s ' "${CATS[$i]}" "${DEVS[$i]}"; done)) -- wie verlangt"
      RED_TOTAL=$((RED_TOTAL + 1))
    else
      echo "::error::GEGENPROBE $mut blieb gruen (zahnlos)"
    fi
    stop_container
  done
  echo
  echo "Gegenprobe: $RED_TOTAL von ${#MUTS[@]} Mutationen rot."
  [[ "$RED_TOTAL" -eq "${#MUTS[@]}" ]]
  exit $?
fi

start_container "$MODE"
setup_before

if [[ "$MODE" == "without-migration" ]]; then
  psql_stdin <<<"ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS original_start time;" # damit die Daten-Zeile laeuft
  post_migration_data
  start_rest
  run_probes
  summary
  P_DEV="${DEVS[$(cat_index P)]}"; A_DEV="${DEVS[$(cat_index A)]}"; M_DEV="${DEVS[$(cat_index M)]}"; R_DEV="${DEVS[$(cat_index R)]}"
  if [[ "$P_DEV" -gt 0 && "$A_DEV" -gt 0 && "$M_DEV" -gt 0 && "$R_DEV" -gt 0 ]]; then
    echo "Ohne Migration: P, A, M und R rot -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (P=$P_DEV, A=$A_DEV, M=$M_DEV, R=$R_DEV muessen > 0 sein)."
  exit 1
fi

DUMP_BEFORE="$(schema_dump)"
# forfeit_absent gibt es seit 20261110_005 (vor dieser Migration) echt; nur wenn sie fehlt, legt der Harness sie an
# (post_migration_data) und nimmt sie vor dem Rueckweg-Vergleich wieder weg.
FORFEIT_REAL="$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'forfeit_absent';")"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
ROWS_SQL="SELECT (SELECT count(*) FROM public.tournaments) || '|' || (SELECT count(*) FROM public.teams) || '|' || (SELECT count(*) FROM public.matches) || '|' || (SELECT count(*) FROM public.match_events) || '|' || (SELECT count(*) FROM public.tournament_collaborators);"
ROWS_BEFORE="$(q "$ROWS_SQL")"
echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE"

# --- S: Schema ---------------------------------------------------------------------------------------------------
check S "Bestand unveraendert (Turniere|Teams|Spiele|Ereignisse|Mitglieder)" "$ROWS_BEFORE" "$(q "$ROWS_SQL")"
check S "public_tournament/display_tournament: SECURITY DEFINER, search_path, anon+authenticated, nicht PUBLIC" \
  "2|true|true|true|false" \
  "$(q "SELECT count(*) || '|' || bool_and(p.prosecdef) || '|' || bool_and(p.proconfig @> ARRAY['search_path=public, pg_temp']) || '|' || bool_and(has_function_privilege('anon', p.oid, 'EXECUTE') AND has_function_privilege('authenticated', p.oid, 'EXECUTE')) || '|' || bool_or(EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)) FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.public_tournament(text,bigint)'), to_regprocedure('public.display_tournament(uuid,text,bigint)'));")"
check S "@ZM-109 kein EXCEPTION-Zweig in den oeffentlichen Funktionen (Fehler werden nie zu not_found)" "0" \
  "$(q "SELECT count(*) FROM pg_proc p WHERE (p.oid IN (to_regprocedure('public.public_tournament(text,bigint)'), to_regprocedure('public.display_tournament(uuid,text,bigint)')) OR p.pronamespace = 'public_view'::regnamespace) AND pg_get_functiondef(p.oid) ~* 'EXCEPTION\\s+WHEN';")"
check S "public_view: kein USAGE und kein EXECUTE fuer anon/authenticated" "false|false|0" \
  "$(q "SELECT has_schema_privilege('anon', 'public_view', 'USAGE') || '|' || has_schema_privilege('authenticated', 'public_view', 'USAGE') || '|' || (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public_view'::regnamespace AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE')));")"
check S "keine SELECT-Policy fuer anon/public und keine mit is_public auf den 8 Tabellen" "0|0|8" \
  "$(q "SELECT count(*) FILTER (WHERE roles && ARRAY['anon','public']::name[]) || '|' || count(*) FILTER (WHERE coalesce(qual,'') LIKE '%is_public%') || '|' || count(*) FROM pg_policies WHERE schemaname = 'public' AND cmd IN ('SELECT', 'ALL') AND tablename IN ('tournaments','teams','team_players','matches','match_events','monitors','sponsors','match_corrections');")"
psql_stdin <<<"CREATE TABLE public.harness_neue_tabelle (id int);"
check S "C-ANON-STANDARDRECHTE: neue Tabelle in public ohne Rechte fuer anon" "f" \
  "$(q "SELECT has_table_privilege('anon', 'public.harness_neue_tabelle', 'SELECT,INSERT,UPDATE,DELETE');")"
psql_stdin <<<"DROP TABLE public.harness_neue_tabelle;"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in columns functions triggers tables policies indexes rls_tables; do
  expected=0
  [[ "$dim" == "functions" ]] && expected=3
  [[ "$dim" == "columns" ]] && expected=1
  [[ "$dim" == "triggers" ]] && expected=4
  check S "Katalogzaehlung public $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done

apply_basis_followup
post_migration_data
start_rest
run_probes
run_assertions
run_measurement

# --- W: idempotent -----------------------------------------------------------------------------------------------
stop_rest
DUMP_W1="$(schema_dump)"
set +e
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
W_EXIT=$?
set -e
check W "zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check W "danach Schema unveraendert (pg_dump identisch)" "identisch" "$([[ "$(schema_dump)" == "$DUMP_W1" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg ----------------------------------------------------------------------------------------------------
[[ "$FORFEIT_REAL" == "1" ]] || psql_stdin <<<"ALTER TABLE public.matches DROP COLUMN IF EXISTS forfeit_absent;" # Harness-Spalte (A-25-Ersatz) weg
psql_stdin < "$ROLLBACK_FILE"
DUMP_ROLLED_BACK="$(schema_dump)"
check X "nach dem Rueckweg: Schema public = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi
check X "nach dem Rueckweg: Schema public_view weg, anon liest das oeffentliche Turnier wieder direkt" "f|t" \
  "$(q "SELECT to_regnamespace('public_view') IS NOT NULL;")|$(q "BEGIN; SET LOCAL ROLE anon; SELECT count(*) = 1 FROM public.tournaments WHERE share_code = '$SHARE'; ROLLBACK;" | grep -E '^[tf]$')"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  # Spaetere Migrationen laufen nach dem Rueckweg -- ausser sie brauchen 20261117_104 selbst (20261118_001 Zeitspalten,
  # 20261118_007 public_view.config_for): dann brechen sie mit Hinweis auf 20261117_104 ab, ohne etwas anzulegen.
  set +e
  after_out="$(psql_stdin < "$f" 2>&1)"
  after_exit=$?
  set -e
  if [[ "$after_exit" -eq 0 ]]; then
    echo "OK    spaetere Migration laeuft nach dem Rueckweg: $(basename "$f")" >&2
  else
    check X "$(basename "$f") nach dem Rueckweg von 20261117_104: bricht mit Hinweis auf 20261117_104 ab" "enthalten" \
      "$(has "$after_out" '20261117_104')"
  fi
done

summary
echo
echo "Ergebnis: $(total_dev) Abweichung(en)."
[[ "$(total_dev)" -eq 0 ]]
