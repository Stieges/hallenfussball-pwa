#!/usr/bin/env bash
#
# zuschauer-zaehlung-check.sh -- Container-Beweis fuer supabase/migrations/20261124_003_zuschauer_zaehlung.sql
# (Zuschauer-Seite zaehlen, intern, Stufe 1: @RZ-024, @RZ-025, @RZ-028, @RZ-030; Record
# docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md). Muster: gatherings-check.sh (Wegwerf-Container
# supabase/postgres, Baseline + Migrationen seit Baseline, trap). Ohne PostgREST: die Rollen anon/authenticated
# werden per SET ROLE gespielt (dieselben Rechte wie ueber die Schnittstelle).
#
#   bash scripts/zuschauer-zaehlung-check.sh                 normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/zuschauer-zaehlung-check.sh --without-migration   Gegenprobe: ohne die Migration muessen Z, R rot sein
#   bash scripts/zuschauer-zaehlung-check.sh --without-1b    Gegenprobe: Stand 003+004 ohne 20261126_001 -- die Pruefungen der Stufe 1b muessen rot sein
#   bash scripts/zuschauer-zaehlung-check.sh --gegenprobe    je Mutation ein Lauf; Exit 0 nur, wenn JEDE eine Pruefung rot macht
#
# Betriebsnotiz (live seit 2026-11-24): Schalter am Turniertag
# Zaehlung abstellen, ohne Zahlen zu verlieren:
#   REVOKE EXECUTE ON FUNCTION public.count_public_view(text,text,text,text,boolean) FROM anon, authenticated;
# Der Client bleibt dabei still (401/404 wird verschluckt, durch Test belegt). Wieder einschalten:
#   GRANT EXECUTE ON FUNCTION public.count_public_view(text,text,text,text,boolean) TO anon, authenticated;
# ACHTUNG: Das REVOKE laesst die Zusicherung "zuschauer-zaehlung-rpc-definer-anon" auf f springen; der naechtliche
# Drift-Check auf main wird dann rot, bis das GRANT wieder gesetzt ist.
#
# Auswertung (Stufe 1b): "chrome" umfasst alle Chromium-Browser ausser Edge, Opera und Samsung (auch Brave u. a., die sich als Chrome melden).
# Zeilen von VOR dem Einspielen von 20261126_001 stehen unter sonstige/sonstige: nach window_start ab dem Einspiel-Zeitpunkt filtern.
# Kleine Zellen (wenige Aufrufe je Kombination) bei der Auswertung zusammenfassen, sonst sind einzelne Geraete erkennbar.
#
# Zweite Migration (20261124_004_zuschauer_zaehlung_ci_leser.sql, Werkzeugkette): Leserecht der Drift-Check-Rolle ci_schema_reader auf
# die Tabelle. Ohne sie scheitert pg_dump --schema-only live ("permission denied for table public_view_counts"). Hier mit bewiesen:
# mit dem Recht kann die Rolle die Tabelle sperren/dumpen und liest per SELECT 0 Zeilen (RLS, keine Policy), ohne es scheitert genau
# das; nur SELECT, nichts Schreibendes; Rueckweg in beiden Reihenfolgen sauber (siehe run_rueckweg).
#
# Dritte Migration (20261126_001_zuschauer_zaehlung_os_browser.sql, Stufe 1b: @RZ-031, @RZ-032): Summen zusaetzlich nach Betriebssystem-
# und Browser-Familie, serverseitig aus der Kennung des Aufrufs (Kopfzeile user-agent). Hier mit bewiesen: (H) die Kennung kommt ueber ein
# ECHTES PostgREST an (Wegwerf-PostgREST im selben Netz, curl mit Kennung; dazu eine Probe-Funktion, die die Kopfzeilen so zeigt, wie
# PostgREST sie setzt), die Ableitung je Beispielzeile und Falle, fehlende/leere/ueberlange/unsinnige Kennung -> sonstige ohne Fehler;
# (V) der heute ausgelieferte Client (gleiche fuenf Argumente) zaehlt VOR und NACH dem Einspielen; Bestandszeilen behalten ihre Summen;
# (R) Rueckweg fuehrt die Summen wieder zusammen (Summe vorher = nachher), Schema danach = Stand 004, Fail-fast bei Sperre / fehlender
# Voraussetzung / fremder Fassung der Funktion.
#
# Vierte Migration (20261127_001_zuschauer_zaehlung_netzstoerung.sql, Stufe 1c: @RZ-033, @RZ-034, @RZ-035, @RZ-036): ueberstandene
# Netzstoerungen (kurz/lang) als zwei neue Spalten und zwei neue Arten 'stoerung_kurz' / 'stoerung_lang' in count_public_view. Hier mit
# bewiesen (Kategorie N, dazu V und R): beide Arten zaehlen in der Zeile der Aufrufe derselben Kombination, nichts zaehlt als Aufruf oder
# Lebenszeichen, unbekannte Arten und alles, was schon bei Aufruf nicht zaehlt, bleiben still; Bestandszeilen behalten ihre Summen; der
# ausgelieferte Client zaehlt vor UND nach dem Einspielen; ein neuer Client gegen den Server OHNE die Migration wird still verworfen; ein
# waehrend der Migration wartender Aufruf geht nicht verloren; Rueckweg, Idempotenz, Fail-fast; nur ergaenzend (Primaerschluessel gleich).
#   bash scripts/zuschauer-zaehlung-check.sh --without-ns    Gegenprobe: Stand 003+004+1b ohne 20261127_001 -- die Pruefungen N muessen rot sein
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack: eigener Container, am Ende entfernt.
set -euo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  --without-1b) MODE="without-1b" ;;
  --without-ns) MODE="without-ns" ;;
  *) echo "::error::Unbekannte Option: $1" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261124_003_zuschauer_zaehlung.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
ROLLBACK_FILE="$REPO_ROOT/supabase/rollbacks/20261124_003_zuschauer_zaehlung_rollback.sql"
GRANT_NAME="20261124_004_zuschauer_zaehlung_ci_leser.sql"
GRANT_FILE="$MIGRATIONS_DIR/$GRANT_NAME"
GRANT_ROLLBACK_FILE="$REPO_ROOT/supabase/rollbacks/20261124_004_zuschauer_zaehlung_ci_leser_rollback.sql"
NEW_NAME="20261126_001_zuschauer_zaehlung_os_browser.sql"
NEW_FILE="$MIGRATIONS_DIR/$NEW_NAME"
NEW_ROLLBACK_FILE="$REPO_ROOT/supabase/rollbacks/20261126_001_zuschauer_zaehlung_os_browser_rollback.sql"
NS_NAME="20261127_001_zuschauer_zaehlung_netzstoerung.sql"
NS_FILE="$MIGRATIONS_DIR/$NS_NAME"
NS_ROLLBACK_FILE="$REPO_ROOT/supabase/rollbacks/20261127_001_zuschauer_zaehlung_netzstoerung_rollback.sql"
MD5_1B="814b327fa1dc1e8e92a03fd7031ff0b8"   # prosrc-md5 von count_public_view in der Fassung 20261126_001
PREFIX="zaehlung-check-$$"
NET="$PREFIX-net"
C="$PREFIX-db"
REST=""
REST_PORT=""
POSTGREST_IMAGE="${POSTGREST_IMAGE:-public.ecr.aws/supabase/postgrest:v16.2}"
JWT_SECRET="zaehlung-check-secret-0123456789abcdef0123"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/zaehlung-check.XXXXXX")"
[[ -f "$TARGET_FILE" ]] || { echo "::error::$TARGET_NAME fehlt." >&2; exit 1; }
[[ -f "$NEW_FILE" && -f "$NEW_ROLLBACK_FILE" ]] || { echo "::error::$NEW_NAME oder sein Rueckweg fehlt." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "::error::curl wird benoetigt." >&2; exit 1; }
[[ -f "$NS_FILE" && -f "$NS_ROLLBACK_FILE" ]] || { echo "::error::$NS_NAME oder sein Rueckweg fehlt." >&2; exit 1; }
[[ -f "$GRANT_FILE" && -f "$GRANT_ROLLBACK_FILE" ]] || { echo "::error::$GRANT_NAME oder sein Rueckweg fehlt." >&2; exit 1; }

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
# Spaetere Migration mit eigenem Harness (hallenton-check.sh): sie aendert hall_speaker_heartbeat und stuende nach dem Rueckweg als
# Unterschied zu "vorher" da (Pruefung R "Schema wie vorher"); hier ohne Belang, weil sie die Zaehlung nicht beruehrt.
OWN_HARNESS_LATER="20261125_001_hallenton_ausgang_zustaende.sql"
BEFORE=()
AFTER=()
SEEN=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if [[ "$(basename "$line")" == "$TARGET_NAME" ]]; then SEEN=1
  elif [[ "$SEEN" -eq 0 ]]; then BEFORE+=("$line")
  elif [[ "$(basename "$line")" == "$OWN_HARNESS_LATER" ]]; then :
  elif [[ "$(basename "$line")" == "$NEW_NAME" ]]; then :   # Stufe 1b: wird gesondert eingespielt (Vorher-/Nachher-Pruefung)
  elif [[ "$(basename "$line")" == "$NS_NAME" ]]; then :   # Stufe 1c: wird gesondert eingespielt (Vorher-/Nachher-Pruefung)
  elif [[ "$(basename "$line")" == "$GRANT_NAME" ]]; then :   # wird gesondert eingespielt (apply_target), damit --without-migration sie nicht braucht
  else AFTER+=("$line"); fi
done <<< "$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")"
[[ "$SEEN" -eq 1 ]] || { echo "::error::$TARGET_NAME nicht in der Liste 'neuer als Baseline'." >&2; exit 1; }

stop_rest() { [[ -n "$REST" ]] && docker rm -f "$REST" >/dev/null 2>&1 || true; REST=""; REST_PORT=""; }
cleanup() {
  local rc=$?
  stop_rest
  docker rm -f "$C" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$WORK"
  exit "$rc"
}
trap cleanup EXIT
docker network create "$NET" >/dev/null

# Wegwerf-PostgREST im selben Netz (erst NACH dem Einspielen starten: Schema-Cache; nach jedem Schemawechsel neu starten).
start_rest() {
  stop_rest
  REST="$C-rest"
  docker run -d --name "$REST" --network "$NET" -p 127.0.0.1::3000 \
    -e PGRST_DB_URI="postgres://authenticator:postgres@$C:5432/postgres" \
    -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$JWT_SECRET" \
    -e PGRST_DB_CHANNEL_ENABLED=false "$POSTGREST_IMAGE" >/dev/null
  REST_PORT="$(docker port "$REST" 3000/tcp | head -1 | sed 's/.*://')"
  local code=""
  for _ in $(seq 1 60); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$REST_PORT/" || true)"
    [[ "$code" == "200" ]] && break
    sleep 1
  done
  [[ "$code" == "200" ]] || { echo "::error::PostgREST nicht bereit (HTTP $code)." >&2; docker logs "$REST" 2>&1 | tail -20 >&2; exit 1; }
}
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
jwt() {
  local h p sg
  h="$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)"
  p="$(printf '%s' "$1" | b64url)"
  sg="$(printf '%s' "$h.$p" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)"
  echo "$h.$p.$sg"
}
tok_for() { # anon | authenticated
  if [[ "$1" == "anon" ]]; then jwt '{"role":"anon","exp":4102444800}'
  else jwt "{\"role\":\"authenticated\",\"sub\":\"$U\",\"is_anonymous\":false,\"exp\":4102444800}"; fi
}

psql_stdin() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -v ON_ERROR_STOP=1 -q "$@"; }
q() {
  local out
  out="$(docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 2>&1 <<<"$1" || true)"
  if grep -q '^ERROR' <<<"$out"; then grep -m1 '^ERROR' <<<"$out"; else tail -1 <<<"$out"; fi
}
as_role() { q "SET ROLE $1; $2"; }  # letzte Ausgabezeile des Aufrufers
dump_as_reader() { # Ausgabe "<Exitcode>|<Anzahl CREATE TABLE public_view_counts>" bzw. die erste Fehlermeldung von pg_dump
  local out rc
  out="$(docker exec "$C" pg_dump -U postgres --role=ci_schema_reader --schema-only --table=public.public_view_counts postgres 2>&1)" && rc=0 || rc=$?
  if [[ "$rc" -ne 0 ]]; then grep -m1 'permission denied' <<<"$out" || echo "rc=$rc $out" | head -1; else echo "$rc|$(grep -c 'CREATE TABLE public.public_view_counts' <<<"$out" || true)"; fi
}
schema_dump() { docker exec "$C" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }

CATS=(Z S R H V N)   # Z zaehlen/nicht zaehlen, S Schema/Rechte, R Rueckweg/idempotent, H Kennung ueber PostgREST/Ableitung, V Vertraeglichkeit alter Client, N Netzstoerung (Stufe 1c)
DEVS=(0 0 0 0 0 0)
OKS=(0 0 0 0 0 0)
cat_index() { local i; for i in "${!CATS[@]}"; do [[ "${CATS[$i]}" == "$1" ]] && { echo "$i"; return 0; }; done; exit 2; }
check() { # check <Kategorie> <Name> <erwartet> <erhalten>
  local i; i="$(cat_index "$1")"
  if [[ "$3" == "$4" ]]; then
    OKS[i]=$((OKS[i] + 1)); [[ "${QUIET:-0}" == "1" ]] || echo "OK          [$1] $2"
  else
    DEVS[i]=$((DEVS[i] + 1)); echo "ABWEICHUNG  [$1] $2"; echo "    erwartet: $3"; echo "    erhalten: ${4:0:300}"
  fi
}
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
reset_counts() { DEVS=(0 0 0 0 0 0); OKS=(0 0 0 0 0 0); }

U='00000000-0000-4000-8000-0000000000a1'
T_PUB='00000000-0000-4000-8000-0000000000b1'
T_PRIV='00000000-0000-4000-8000-0000000000b2'
T_TRASH='00000000-0000-4000-8000-0000000000b3'
T_FIN='00000000-0000-4000-8000-0000000000b4'

prepare() {
  docker run -d --name "$C" --network "$NET" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 90); do
    if [[ "$(docker logs "$C" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then ready=1; break; fi
    sleep 1
  done
  [[ "$ready" -eq 1 ]] || { echo "::error::Container nicht bereit." >&2; exit 1; }
  for _ in $(seq 1 30); do docker exec "$C" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
  echo "Baseline + ${#BEFORE[@]} Migrationen vor $TARGET_NAME einspielen ..." >&2
  psql_stdin < "$BASELINE_FILE" >/dev/null
  local f; for f in "${BEFORE[@]}"; do psql_stdin < "$f" >/dev/null; done
  docker exec -i -e PGPASSWORD=postgres "$C" psql -h localhost -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 \
    <<<"ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false; ALTER ROLE authenticator WITH PASSWORD 'postgres';"
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '$U', 'authenticated', 'authenticated', 'olli@zaehlung.test', 'x', now(), '{}', '{}', now(), now());
SQL
  # Probe fuer die Kopfzeilen (nur Testaufbau, nicht Teil der Migration): gibt zurueck, was PostgREST in request.headers gesetzt hat.
  # Vor dem Schema-Abzug angelegt, damit sie in allen Abzuegen gleich vorkommt.
  psql_stdin <<'SQL'
CREATE FUNCTION public.zz_probe_headers() RETURNS text LANGUAGE sql STABLE AS $f$ SELECT current_setting('request.headers', true) $f$;
GRANT EXECUTE ON FUNCTION public.zz_probe_headers() TO anon, authenticated;
SQL
  schema_dump > "$WORK/schema_vorher.sql"
}

seed_tournaments() {
  psql_stdin <<SQL
DELETE FROM public.tournaments WHERE id IN ('$T_PUB', '$T_PRIV', '$T_TRASH', '$T_FIN');
INSERT INTO public.tournaments (id, owner_id, title, date, start_time, number_of_teams, number_of_fields, group_phase_duration,
                                location_name, location_city, status, is_public, share_code, config, deleted_at)
VALUES ('$T_PUB',   '$U', 'Nikolaus-Turnier', current_date, '09:00', 2, 1, 10, 'Halle', 'Waging', 'published', true,  'NIKO26', '{"publishedAt":"2026-11-01T00:00:00.000Z"}', NULL),
       ('$T_PRIV',  '$U', 'Privat',           current_date, '09:00', 2, 1, 10, 'Halle', 'Waging', 'published', false, 'PRIV01', '{}', NULL),
       ('$T_TRASH', '$U', 'Papierkorb',       current_date, '09:00', 2, 1, 10, 'Halle', 'Waging', 'published', true,  'TRASH1', '{"publishedAt":"2026-11-01T00:00:00.000Z"}', now()),
       ('$T_FIN',   '$U', 'Abgeschlossen',    current_date, '09:00', 2, 1, 10, 'Halle', 'Waging', 'published', true,  'FIN001', '{"publishedAt":"2026-11-01T00:00:00.000Z"}', NULL);
-- Abschluss wie in der Server-Funktion finish_tournament: Schalter app.lifecycle_write (transaktionslokal, nur ausserhalb der Client-Rollen)
BEGIN;
SET LOCAL app.lifecycle_write = 'on';
UPDATE public.tournaments SET lifecycle_status = 'finished', finished_at = now() WHERE id = '$T_FIN';
COMMIT;
SQL
}
apply_target() { # <datei003|leer> [datei004] [datei1b | - (ohne Stufe 1b)]
  if [[ -n "$1" ]]; then psql_stdin < "$1" >/dev/null; fi
  local f; for f in ${AFTER[@]+"${AFTER[@]}"}; do psql_stdin < "$f" >/dev/null; done
  if [[ -n "$1" ]]; then psql_stdin < "${2:-$GRANT_FILE}" >/dev/null; fi   # 004: Leserecht der Drift-Check-Rolle (setzt die Tabelle voraus)
  if [[ -n "$1" && "${3:-$NEW_FILE}" != "-" ]]; then psql_stdin < "${3:-$NEW_FILE}" >/dev/null; fi   # 20261126_001: Stufe 1b
  start_rest
}

count() { q "SELECT $2 FROM public.public_view_counts WHERE tournament_id = '$1';"; }
zaehle() { as_role "${6:-anon}" "SELECT 1 FROM (SELECT public.count_public_view('$1', '$2', '$3', '$4', $5)) x;" >/dev/null; }

# --- Aufrufe ueber das ECHTE PostgREST (Kopfzeilen kommen so an wie im Betrieb) ------------------------------------------
# rest_zaehle <kennung | --keine-- | --leer--> [anon|authenticated] [code] [art] [geraet] [installiert] [kanal]
# gibt den HTTP-Status aus, der Antwortkoerper liegt in $WORK/b. Die Argumente sind die fuenf des ausgelieferten Clients.
rest_zaehle() {
  local ua="$1" wer="${2:-anon}" code="${3:-NIKO26}" art="${4:-aufruf}" geraet="${5:-handy}" inst="${6:-false}" kanal="${7:-qr}" st
  local hdr=(-H "User-Agent: $ua")
  [[ "$ua" == "--keine--" ]] && hdr=(-H "User-Agent:")
  [[ "$ua" == "--leer--" ]] && hdr=(-H "User-Agent;")
  st="$(curl -s -o "$WORK/b" -w '%{http_code}' -X POST "http://127.0.0.1:$REST_PORT/rpc/count_public_view" \
    -H "Authorization: Bearer $(tok_for "$wer")" -H 'Content-Type: application/json' "${hdr[@]}" \
    --data "{\"p_share_code\":\"$code\",\"p_art\":\"$art\",\"p_kanal\":\"$kanal\",\"p_geraet\":\"$geraet\",\"p_installiert\":$inst}" || echo 000)"
  echo "$st"
}
# fam -- die Summen je Familien-Kombination des Turniers T_PUB, z. B. "ios/safari=1"
fam() { q "SELECT coalesce(string_agg(os_family || '/' || browser_family || '=' || views, ',' ORDER BY os_family, browser_family), '-') FROM public.public_view_counts WHERE tournament_id = '$T_PUB';"; }
ok2xx() { [[ "$1" == "200" || "$1" == "201" || "$1" == "204" ]] && echo ok || echo "HTTP $1"; }
# ua_fall <Name> <erwartet os/browser> <Kennung>: ein echter Aufruf, genau eine Summe in der erwarteten Kombination
ua_fall() {
  local st
  q "TRUNCATE public.public_view_counts;" >/dev/null
  st="$(rest_zaehle "$3")"
  check H "@RZ-031 $1: Aufruf ueber PostgREST zaehlt unter $2" "ok|$2=1" "$(ok2xx "$st")|$(fam)"
}

# Kennungen (oeffentlich uebliche Beispiele, keine echten Personen)
UA_IPHONE_SAFARI='Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
UA_ANDROID_CHROME='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
UA_ANDROID_SAMSUNG='Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36'
UA_WIN_FIREFOX='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'
UA_MAC_SAFARI='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
UA_UNBEKANNT='Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Beispiel/1.0'
UA_WIN_CHROME='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
UA_WIN_EDGE='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
UA_ANDROID_EDGE='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0.0.0'
UA_IOS_EDGE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/120.0.0.0 Mobile/15E148 Safari/605.1.15'
UA_WIN_OPERA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0'
UA_IOS_CHROME='Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1'
UA_IOS_FIREFOX='Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15'
UA_IPAD_SAFARI='Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
UA_IPAD_ALS_MAC='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
UA_ANDROID_FIREFOX='Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0'
UA_ANDROID_WEBVIEW='Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SD1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36'
UA_ANDROID_ALT='Mozilla/5.0 (Linux; U; Android 4.4; de-de; Nexus 5) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30'
UA_IOS_WEBVIEW='Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
UA_LINUX_CHROME='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
UA_SAFARI_OHNE_VERSION='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36'
UA_MIT_ZEICHEN='Mozilla/5.0 "x" \\ (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'

# V: der heute ausgelieferte Client (genau diese fuenf Argumente, ohne Kennung-Bezug) zaehlt -- vor UND nach Stufe 1b
alt_client_zaehlt() { # <Marke>
  local s1 s2 s3
  q "TRUNCATE public.public_view_counts;" >/dev/null
  s1="$(rest_zaehle "$UA_ANDROID_CHROME" anon NIKO26 aufruf handy false qr)"
  s2="$(rest_zaehle "$UA_ANDROID_CHROME" anon NIKO26 lebenszeichen handy false qr)"
  s3="$(rest_zaehle "$UA_WIN_FIREFOX" authenticated NIKO26 aufruf gross true direkt)"
  check V "$1: Aufruf mit den Argumenten des ausgelieferten Clients (anon, authenticated) liefert 2xx" "ok|ok|ok" "$(ok2xx "$s1")|$(ok2xx "$s2")|$(ok2xx "$s3")"
  check V "$1: der Aufruf zaehlt (2 Aufrufe, 1 Lebenszeichen, 2 Zeilen)" "2/1/2" \
    "$(q "SELECT coalesce(sum(views),0) || '/' || coalesce(sum(heartbeats),0) || '/' || count(*) FROM public.public_view_counts WHERE tournament_id = '$T_PUB';")"
}

run_checks() {
  local ROW="coalesce(sum(views),0) || '/' || coalesce(sum(heartbeats),0) || '/' || count(*)"
  seed_tournaments
  q "TRUNCATE public.public_view_counts;" >/dev/null
  q "GRANT ci_schema_reader TO postgres;" >/dev/null   # damit SET ROLE ci_schema_reader / pg_dump --role gehen (Testaufbau, nicht Teil der Migration)

  # @RZ-024 Aufruf zaehlt, je Beispielzeile eine Kombination
  zaehle NIKO26 aufruf qr handy false
  check Z "@RZ-024 Aufruf (QR, Handy, nicht installiert) zaehlt eine Summe" "1/0/1" "$(count $T_PUB "$ROW")"
  check Z "@RZ-024 Zeile traegt Kanal qr, Geraeteart handy, installiert false" "qr|handy|false" \
    "$(q "SELECT channel||'|'||device_class||'|'||installed FROM public.public_view_counts WHERE tournament_id='$T_PUB';")"
  zaehle NIKO26 aufruf qr handy false authenticated
  check Z "@RZ-024 derselbe Schluessel im Fenster erhoeht die Summe (auch fuer authenticated), keine zweite Zeile" "2/0/1" "$(count $T_PUB "$ROW")"
  zaehle NIKO26 aufruf link gross false
  zaehle NIKO26 aufruf direkt handy true
  zaehle NIKO26 aufruf irgendwas tablet false
  check Z "@RZ-024 vier Beispielzeilen = vier Schluessel" "5/0/4" "$(count $T_PUB "$ROW")"
  check Z "@RZ-024 unbekannter Kanal wird direkt, Tablet bleibt Tablet" "direkt|tablet|false" \
    "$(q "SELECT channel||'|'||device_class||'|'||installed FROM public.public_view_counts WHERE tournament_id='$T_PUB' AND device_class='tablet';")"
  zaehle niko26 aufruf direkt handy false
  check Z "@RZ-024 Code in Kleinbuchstaben gilt wie die Zuschauer-Adresse (normalisiert)" "6/0/5" "$(count $T_PUB "$ROW")"

  # @RZ-025 Lebenszeichen
  zaehle NIKO26 lebenszeichen qr handy false
  check Z "@RZ-025 Lebenszeichen zaehlt in derselben Zeile als heartbeats, nicht als Aufruf" "6/1/5" "$(count $T_PUB "$ROW")"

  # Abgeschlossenes Turnier: Zuschauer sehen den Endstand weiter an, also zaehlt der Aufruf weiter (kein Sperr-Trigger, kein Abweisen)
  check Z "Vorbedingung: das Turnier FIN001 ist abgeschlossen (lifecycle_status finished)" "finished" \
    "$(q "SELECT lifecycle_status FROM public.tournaments WHERE id = '$T_FIN';")"
  zaehle FIN001 aufruf qr handy false
  zaehle FIN001 lebenszeichen qr handy false
  check Z "@RZ-024 abgeschlossenes Turnier (finished): Aufruf und Lebenszeichen zaehlen weiter, ohne Fehler" "1/1/1" "$(count $T_FIN "$ROW")"
  check Z "abgeschlossenes Turnier: kein Fehler 55000 fuer anon" "1" \
    "$(as_role anon "SELECT 1 FROM (SELECT public.count_public_view('FIN001','aufruf','link','tablet',false)) x;")"

  # Fenster
  check Z "@RZ-024 Fensterbeginn liegt auf voller 5-Minuten-Marke (kein genauerer Zeitpunkt)" "0" \
    "$(q "SELECT count(*) FILTER (WHERE (extract(epoch FROM window_start)::bigint % 300) <> 0) FROM public.public_view_counts;")"

  # @RZ-028 nicht gezaehlt
  q "TRUNCATE public.public_view_counts;" >/dev/null
  zaehle PRIV01 aufruf qr handy false
  zaehle TRASH1 aufruf qr handy false
  zaehle NOPE99 aufruf qr handy false
  zaehle NIKO26 aufruf qr smartwatch false
  zaehle NIKO26 anderes qr handy false
  zaehle "" aufruf qr handy false
  zaehle "NIKO26;DROP" aufruf qr handy false
  check Z "@RZ-028 nicht oeffentliches Turnier, Papierkorb, unbekannter Code, falsche Geraeteart/Art, leerer/zu langer Code: nichts gezaehlt" "0" \
    "$(q "SELECT count(*) FROM public.public_view_counts;")"
  check Z "@RZ-028 unbekannter Code wirft keinen Fehler (still)" "1" \
    "$(as_role anon "SELECT 1 FROM (SELECT public.count_public_view('NOPE99','aufruf','qr','handy',false)) x;")"
  check Z "@RZ-024 unbekannte Geraeteart und unbekannte Art werden ohne Fehler abgelehnt" "1|1" \
    "$(as_role anon "SELECT (SELECT 1 FROM (SELECT public.count_public_view('NIKO26','aufruf','qr','smartwatch',false)) x) || '|' || (SELECT 1 FROM (SELECT public.count_public_view('NIKO26','anderes','qr','handy',false)) y);")"
  check Z "@RZ-028 NULL-Werte werfen keinen Fehler" "1" \
    "$(as_role anon "SELECT 1 FROM (SELECT public.count_public_view(NULL,NULL,NULL,NULL,NULL)) x;")"
  zaehle NIKO26 aufruf qr handy NULL
  check Z "installiert NULL zaehlt als nein" "f" "$(q "SELECT installed FROM public.public_view_counts WHERE tournament_id='$T_PUB';")"

  # 004: Drift-Check-Rolle ci_schema_reader -- pg_dump sperrt jede Tabelle (ACCESS SHARE), das braucht SELECT; Zeilen sieht sie nicht
  # (RLS an, keine Policy, Rolle ohne BYPASSRLS). Hier liegt genau eine Zaehlzeile.
  check S "004: Zaehlzeile vorhanden (Vorbedingung fuer die RLS-Probe)" "1" "$(q "SELECT count(*) FROM public.public_view_counts;")"
  check S "004: ci_schema_reader kann die Tabelle sperren (LOCK ... ACCESS SHARE MODE, wie pg_dump)" "gesperrt" \
    "$(as_role ci_schema_reader "BEGIN; LOCK TABLE public.public_view_counts IN ACCESS SHARE MODE; SELECT 'gesperrt';")"
  check S "004: ci_schema_reader liest per SELECT 0 Zeilen, obwohl Zaehlzeilen existieren (RLS, keine Policy)" "0" \
    "$(as_role ci_schema_reader "SELECT count(*) FROM public.public_view_counts;")"
  check S "004: pg_dump --schema-only der Tabelle als ci_schema_reader gelingt und enthaelt sie" "0|1" \
    "$(dump_as_reader)"
  check S "004: ci_schema_reader kann nicht schreiben (INSERT)" "ERROR:  permission denied for table public_view_counts" \
    "$(as_role ci_schema_reader "INSERT INTO public.public_view_counts VALUES ('$T_PUB', now(), 'qr', 'handy', true, 1, 1);")"
  check S "004: ci_schema_reader kann nicht aendern oder loeschen (DELETE)" "ERROR:  permission denied for table public_view_counts" \
    "$(as_role ci_schema_reader "DELETE FROM public.public_view_counts;")"
  check S "004: Rolle ci_schema_reader hat nur SELECT (kein INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN), kein BYPASSRLS" "true|false|false" \
    "$(q "SELECT has_table_privilege('ci_schema_reader', 'public.public_view_counts', 'SELECT') || '|' || has_table_privilege('ci_schema_reader', 'public.public_view_counts', 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN') || '|' || (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'ci_schema_reader');")"

  # @RZ-030 niemand liest ueber die Schnittstelle
  check S "@RZ-030 anon kann die Tabelle nicht lesen" "ERROR:  permission denied for table public_view_counts" \
    "$(as_role anon "SELECT count(*) FROM public.public_view_counts;")"
  check S "@RZ-030 authenticated kann die Tabelle nicht lesen" "ERROR:  permission denied for table public_view_counts" \
    "$(as_role authenticated "SELECT count(*) FROM public.public_view_counts;")"
  check S "@RZ-030 anon kann nicht schreiben" "ERROR:  permission denied for table public_view_counts" \
    "$(as_role anon "INSERT INTO public.public_view_counts VALUES ('$T_PUB', now(), 'qr', 'handy', false, 99, 99);")"
  check S "@RZ-030 anon kann Zahlen nicht aendern oder loeschen" "ERROR:  permission denied for table public_view_counts" \
    "$(as_role anon "DELETE FROM public.public_view_counts;")"
  check S "RLS ist an, keine Policy auf der Tabelle" "true|0" \
    "$(q "SELECT relrowsecurity || '|' || (SELECT count(*) FROM pg_policies WHERE tablename='public_view_counts') FROM pg_class WHERE oid='public.public_view_counts'::regclass;")"
  check S "Funktion: SECURITY DEFINER, fester search_path, nur anon/authenticated/service_role duerfen sie rufen" "true|{\"search_path=public, pg_temp\"}|true|true|false" \
    "$(q "SELECT prosecdef || '|' || proconfig::text || '|' || has_function_privilege('anon', oid, 'EXECUTE') || '|' || has_function_privilege('authenticated', oid, 'EXECUTE') || '|' || has_function_privilege('public', oid, 'EXECUTE') FROM pg_proc WHERE oid = to_regprocedure('public.count_public_view(text,text,text,text,boolean)');")"
  check S "Funktion gibt nichts zurueck (void)" "void" "$(q "SELECT prorettype::regtype FROM pg_proc WHERE proname='count_public_view';")"
  check S "Tabelle traegt keine Spalte fuer IP, Kennung oder genauen Zeitpunkt, nur die zwei Familien (@RZ-031)" "tournament_id,window_start,channel,device_class,installed,views,heartbeats,os_family,browser_family" \
    "$(q "SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='public_view_counts';")"

  # @RZ-030 letzte Zeile: endgueltiges Loeschen nimmt die Zahlen mit; Papierkorb nicht
  q "TRUNCATE public.public_view_counts;" >/dev/null
  zaehle NIKO26 aufruf qr handy false
  q "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_PUB';" >/dev/null
  check Z "Papierkorb (deleted_at) laesst die bisherigen Zahlen stehen" "1" "$(q "SELECT count(*) FROM public.public_view_counts;")"
  zaehle NIKO26 aufruf qr handy false
  check Z "im Papierkorb zaehlt nichts mehr dazu" "1" "$(q "SELECT sum(views) FROM public.public_view_counts;")"
  q "DELETE FROM public.tournaments WHERE id = '$T_PUB';" >/dev/null
  check Z "@RZ-030 endgueltiges Loeschen des Turniers loescht seine Zahlen" "0" "$(q "SELECT count(*) FROM public.public_view_counts;")"

  # ---- H: Stufe 1b -- Betriebssystem- und Browser-Familie aus der Kennung des Aufrufs (@RZ-031, @RZ-032) ----
  seed_tournaments
  q "TRUNCATE public.public_view_counts;" >/dev/null
  alt_client_zaehlt "V nach Stufe 1b: ausgelieferter Client"
  # Beleg, dass die Kopfzeile ueber PostgREST ankommt: die Probe zeigt request.headers, wie PostgREST es setzt (Schluessel klein)
  local probe
  probe="$(curl -s "http://127.0.0.1:$REST_PORT/rpc/zz_probe_headers" -H "Authorization: Bearer $(tok_for anon)" -H "User-Agent: $UA_IPHONE_SAFARI" || true)"
  check H "PostgREST setzt request.headers als JSON mit dem kleingeschriebenen Schluessel user-agent und der Kennung des Aufrufs" "ja" \
    "$(grep -qF '\"user-agent\":\"Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X)' <<<"$probe" && echo ja || echo "nein: ${probe:0:200}")"
  [[ "${QUIET:-0}" == "1" ]] || echo "Beleg Kopfzeilen (request.headers ueber PostgREST, nur der Schluessel user-agent gezeigt): $(grep -oE '\\"user-agent\\":\\"[^\\]*' <<<"$probe" | head -1)"

  ua_fall "iPhone in Safari" "ios/safari" "$UA_IPHONE_SAFARI"
  ua_fall "Android-Handy in Chrome" "android/chrome" "$UA_ANDROID_CHROME"
  ua_fall "Samsung-Handy im Samsung-Browser (Kennung traegt auch Chrome und Safari)" "android/samsung" "$UA_ANDROID_SAMSUNG"
  ua_fall "Windows-Laptop in Firefox" "windows/firefox" "$UA_WIN_FIREFOX"
  ua_fall "Mac in Safari" "macos/safari" "$UA_MAC_SAFARI"
  ua_fall "unbekannte Kennung" "sonstige/sonstige" "$UA_UNBEKANNT"
  ua_fall "Windows in Chrome (Kennung traegt auch Safari)" "windows/chrome" "$UA_WIN_CHROME"
  ua_fall "Windows in Edge (Kennung traegt auch Chrome und Safari)" "windows/sonstige" "$UA_WIN_EDGE"
  ua_fall "Android in Edge" "android/sonstige" "$UA_ANDROID_EDGE"
  ua_fall "iPhone in Edge (Kennung traegt auch Version und Safari)" "ios/sonstige" "$UA_IOS_EDGE"
  ua_fall "Windows in Opera" "windows/sonstige" "$UA_WIN_OPERA"
  ua_fall "iPhone in Chrome (CriOS, Kennung traegt auch Safari)" "ios/chrome" "$UA_IOS_CHROME"
  ua_fall "iPhone in Firefox (FxiOS, Kennung traegt auch Safari)" "ios/firefox" "$UA_IOS_FIREFOX"
  ua_fall "iPad in Safari (Mobilfassung)" "ios/safari" "$UA_IPAD_SAFARI"
  ua_fall "iPad, das sich als Mac ausgibt, zaehlt als macos (bekannte Unschaerfe, @RZ-032)" "macos/safari" "$UA_IPAD_ALS_MAC"
  ua_fall "Android in Firefox" "android/firefox" "$UA_ANDROID_FIREFOX"
  ua_fall "Android-WebView (Kennung traegt Version, Chrome und Safari) ist kein Chrome" "android/sonstige" "$UA_ANDROID_WEBVIEW"
  ua_fall "alter Android-Standardbrowser (Version und Safari, aber Android) ist kein Safari" "android/sonstige" "$UA_ANDROID_ALT"
  ua_fall "App-Anzeige auf iOS ohne Version und Safari" "ios/sonstige" "$UA_IOS_WEBVIEW"
  ua_fall "Linux in Chrome: System sonstige, Browser chrome" "sonstige/chrome" "$UA_LINUX_CHROME"
  ua_fall "Safari-Zeichen ohne Version und ohne Chrome auf Linux ist kein Safari" "sonstige/sonstige" "$UA_SAFARI_OHNE_VERSION"
  ua_fall "Kennung mit Anfuehrungszeichen und Gegenschraegstrichen (JSON-Maskierung)" "ios/safari" "$UA_MIT_ZEICHEN"

  # @RZ-032: fehlende, leere, ueberlange, unsinnige Kennung -> sonstige/sonstige, kein Fehler, nichts Sichtbares fuer den Zuschauer
  local lang unsinn st
  lang="$UA_IPHONE_SAFARI$(printf 'x%.0s' $(seq 1 9900))"   # gueltige iPhone-Kennung + Fuellung, ueber 10000 Zeichen
  unsinn="%%%%;;;'--DROP TABLE public_view_counts; ((((\\\\ 0000"
  local fall name erw kennung
  for fall in "ohne Kennung (Kopfzeile fehlt)|--keine--" "leere Kennung|--leer--" "ueberlange Kennung (ueber 10000 Zeichen, vorn eine gueltige iPhone-Kennung)|$lang" "unsinnige Kennung|$unsinn"; do
    name="${fall%%|*}"; kennung="${fall#*|}"
    q "TRUNCATE public.public_view_counts;" >/dev/null
    st="$(rest_zaehle "$kennung")"
    check H "@RZ-032 $name: zaehlt unter sonstige/sonstige, anon sieht 2xx und keinen Fehlertext" "ok|sonstige/sonstige=1|leer" \
      "$(ok2xx "$st")|$(fam)|$(grep -qiE 'error|message|exception|code' "$WORK/b" && echo "Text: $(head -c 120 "$WORK/b")" || echo leer)"
  done
  # Grenze 512 Zeichen (Hilfsfunktion direkt): 512 gilt, 513 nicht
  check H "@RZ-032 Eingabegrenze: genau 512 Zeichen werden abgeleitet, 513 ergeben sonstige/sonstige" "ios/safari|sonstige/sonstige" \
    "$(q "SELECT (SELECT os_family || '/' || browser_family FROM public.public_view_agent_families(rpad('$UA_IPHONE_SAFARI', 512, 'x'))) || '|' || (SELECT os_family || '/' || browser_family FROM public.public_view_agent_families(rpad('$UA_IPHONE_SAFARI', 513, 'x')));")"
  check H "@RZ-032 Hilfsfunktion: NULL und leer ergeben sonstige/sonstige" "sonstige/sonstige|sonstige/sonstige" \
    "$(q "SELECT (SELECT os_family || '/' || browser_family FROM public.public_view_agent_families(NULL)) || '|' || (SELECT os_family || '/' || browser_family FROM public.public_view_agent_families(''));")"
  # Direkter Aufruf ohne PostgREST (psql): keine Einstellung request.headers -> sonstige/sonstige, kein Fehler
  q "TRUNCATE public.public_view_counts;" >/dev/null
  check H "@RZ-032 direkter Aufruf ohne PostgREST (Einstellung fehlt): kein Fehler, zaehlt unter sonstige/sonstige" "1|sonstige/sonstige=1" \
    "$(as_role anon "SELECT 1 FROM (SELECT public.count_public_view('NIKO26','aufruf','qr','handy',false)) x;")|$(fam)"
  # Unbrauchbare Einstellung (nicht PostgREST): leer, kein JSON, kein Objekt, Schluessel fehlt, kein Text, riesig
  local gucs g gname gval gres
  gucs=("leer||" "kein JSON|nicht json|" "Liste|[]|" "nur Text|\"x\"|" "Objekt ohne Schluessel|{}|" "Schluessel null|{\"user-agent\": null}|" "Schluessel Zahl|{\"user-agent\": 5}|" "Schluessel anders geschrieben|{\"User-Agent\": \"$UA_IPHONE_SAFARI\"}|")
  for g in "${gucs[@]}"; do
    gname="${g%%|*}"; gval="${g#*|}"; gval="${gval%|}"
    q "TRUNCATE public.public_view_counts;" >/dev/null
    gres="$(q "SET ROLE anon; SET request.headers = \$h\$$gval\$h\$; SELECT 1 FROM (SELECT public.count_public_view('NIKO26','aufruf','qr','handy',false)) x;")|$(fam)"
    check H "@RZ-032 Einstellung request.headers $gname: kein Fehler, sonstige/sonstige" "1|sonstige/sonstige=1" "$gres"
  done
  q "TRUNCATE public.public_view_counts;" >/dev/null
  gres="$(q "SET ROLE anon; SET request.headers = \$h\${\"user-agent\": \"$UA_IPHONE_SAFARI\", \"x\": \"$(printf 'y%.0s' $(seq 1 70000))\"}\$h\$; SELECT 1 FROM (SELECT public.count_public_view('NIKO26','aufruf','qr','handy',false)) x;")|$(fam)"
  check H "@RZ-032 uebergrosse Einstellung (ueber 64 KiB): kein Fehler, sonstige/sonstige" "1|sonstige/sonstige=1" "$gres"
  q "TRUNCATE public.public_view_counts;" >/dev/null
  gres="$(q "SET ROLE anon; SET request.headers = \$h\${\"user-agent\": \"$UA_IPHONE_SAFARI\"}\$h\$; SELECT 1 FROM (SELECT public.count_public_view('NIKO26','aufruf','qr','handy',false)) x;")|$(fam)"
  check H "Gegenprobe zur Einstellung: gueltige Kopfzeilen im selben Format zaehlen unter ios/safari" "1|ios/safari=1" "$gres"
  # Gleicher Schluessel zaehlt weiter in EINER Zeile, verschiedene Familien getrennt; Lebenszeichen derselben Kombination in derselben Zeile
  q "TRUNCATE public.public_view_counts;" >/dev/null
  rest_zaehle "$UA_IPHONE_SAFARI" >/dev/null; rest_zaehle "$UA_IPHONE_SAFARI" >/dev/null
  rest_zaehle "$UA_IPHONE_SAFARI" anon NIKO26 lebenszeichen >/dev/null
  rest_zaehle "$UA_WIN_FIREFOX" >/dev/null
  check H "@RZ-031 Summen je Kombination: zwei Aufrufe + ein Lebenszeichen iOS/Safari in einer Zeile, Windows/Firefox getrennt" "ios/safari=2,windows/firefox=1|2" \
    "$(fam)|$(q "SELECT count(*) FROM public.public_view_counts WHERE tournament_id='$T_PUB';")"
  check H "@RZ-031 Lebenszeichen derselben Kombination steht in derselben Zeile (heartbeats)" "1" \
    "$(q "SELECT heartbeats FROM public.public_view_counts WHERE tournament_id='$T_PUB' AND os_family='ios' AND browser_family='safari';")"
  # nur Familien gespeichert (nie Kennung, nie Version): alle gespeicherten Werte stammen aus den zwei festen Listen
  q "TRUNCATE public.public_view_counts;" >/dev/null
  rest_zaehle "$UA_IPHONE_SAFARI" >/dev/null; rest_zaehle "$UA_WIN_EDGE" >/dev/null; rest_zaehle "$UA_ANDROID_SAMSUNG" >/dev/null; rest_zaehle "$UA_MIT_ZEICHEN" >/dev/null
  check H "@RZ-031 gespeichert sind nur die Familien: keine Spalte enthaelt Kennung, Version oder Teile davon" "0|0" \
    "$(q "SELECT count(*) FILTER (WHERE os_family NOT IN ('ios','android','windows','macos','sonstige') OR browser_family NOT IN ('safari','chrome','firefox','samsung','sonstige')) || '|' || (SELECT count(*) FROM public.public_view_counts t WHERE t::text ~ '(Mozilla|AppleWebKit|[0-9]+\\.[0-9]+|Version|Gecko)') FROM public.public_view_counts;")"
  q "TRUNCATE public.public_view_counts;" >/dev/null

  # Rechte-Assertionen: db_privilege_assertions.sql vollstaendig als ci_schema_reader, jede Zeile |t (darunter die drei neuen;
  # die Ausnahme in lifecycle-guard-triggers-complete haengt an ihnen)
  local priv red own
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } \
    | docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 2>&1 || true)"
  # Die zwei hallenton-*-Zeilen von 20261125_001 sind hier ausser Betracht (Migration laeuft in hallenton-check.sh, siehe OWN_HARNESS_LATER)
  red="$( (grep -v '|t$' <<<"$priv" | grep -vE '^(hallenton-(output-states-heartbeat|speaker-unassign-rpc-authenticated-only)|zuschauer-zaehlung-netzstoerung-columns)\|f$' || true) | head -5 | tr '\n' ';')"
  own="$( (grep -E '^zuschauer-zaehlung-[a-z-]+\|t$' <<<"$priv" || true) | grep -c . || true)"
  check S "db_privilege_assertions.sql als ci_schema_reader: jede Zeile |t, darunter die fuenf zuschauer-zaehlung-* (inkl. ci-schema-reader-select, os-browser-*)" "keine|5" "${red:-keine}|$own"
}

sums() { q "SELECT coalesce(sum(views),0) || '/' || coalesce(sum(heartbeats),0) FROM public.public_view_counts;"; }
sums5() { # Summen je (Fenster, Kanal, Geraeteklasse, installiert) -- ohne Familien, wie der Schluessel vor Stufe 1b
  q "SELECT coalesce(string_agg(k, ';' ORDER BY k), '-') FROM (SELECT window_start::text || '/' || channel || '/' || device_class || '/' || installed || '=' || sum(views) || '/' || sum(heartbeats) AS k FROM public.public_view_counts GROUP BY window_start, channel, device_class, installed) x;"
}
keys5() { q "SELECT count(*) FROM (SELECT 1 FROM public.public_view_counts GROUP BY window_start, channel, device_class, installed, tournament_id) x;"; }
col_gone() { q "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='public_view_counts' AND column_name IN ('os_family','browser_family');"; }
fn_md5() { q "SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.count_public_view(text,text,text,text,boolean)');"; }

# Stufe 1b zurueck (<Rueckwegdatei>): Summen vorher = nachher, Schema danach = Stand 004, Funktion = Fassung 003. Zustand davor: 1b drauf.
# Nebenlaeufiger Schreiber: <Datei> laeuft im Hintergrund, nach 1,5 s ruft ein zweiter Client (anon) count_public_view.
# Ergebnis in F_RC (Datei), W_RC und W_ERR (Schreiber).
nebenlaeufig() { # <sqlfile>
  local bg
  psql_stdin < "$1" >/dev/null 2>"$WORK/nl_file.err" &
  bg=$!
  sleep 1.5
  W_RC=0
  W_ERR="$(docker exec -i "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 <<<"SET ROLE anon; SELECT public.count_public_view('NIKO26','aufruf','qr','handy',false);" 2>&1 >/dev/null)" || W_RC=$?
  F_RC=0
  wait "$bg" || F_RC=$?
}
# Rueckweg mit gleichzeitigem Schreiber (<Name> <sed-Ausdruck, der eine Pause einbaut> [Rueckwegdatei]): die Sperre haelt den Schreiber
# bis zum Ende; Summen bleiben, der Rueckweg bricht nicht ab, und ein Aufruf, der erfolgreich war, ist danach auch gezaehlt.
rueckweg_nebenlaeufig() {
  local name="$1" expr="$2" rbf="${3:-$NEW_ROLLBACK_FILE}" v_vor v_nach erw
  seed_tournaments
  q "TRUNCATE public.public_view_counts;" >/dev/null
  rest_zaehle "$UA_IPHONE_SAFARI" >/dev/null; rest_zaehle "$UA_IPHONE_SAFARI" >/dev/null; rest_zaehle "$UA_WIN_FIREFOX" >/dev/null
  v_vor="$(q "SELECT coalesce(sum(views),0) FROM public.public_view_counts;")"
  sed "$expr" "$rbf" > "$WORK/nl_rb.sql"
  cmp -s "$rbf" "$WORK/nl_rb.sql" && { echo "::error::nebenlaeufig $name: sed greift nicht" >&2; DEVS[2]=$((DEVS[2] + 1)); return 0; }
  nebenlaeufig "$WORK/nl_rb.sql"
  v_nach="$(q "SELECT coalesce(sum(views),0) FROM public.public_view_counts;")"
  [[ "$W_RC" == "0" ]] && erw=$((v_vor + 1)) || erw="$v_vor"
  [[ "${QUIET:-0}" == "1" ]] || echo "INFO        Schreiber waehrend des Rueckwegs ($name): Exit $W_RC ${W_ERR:0:120}; Summe $v_vor -> $v_nach"
  check R "1b Rueckweg mit gleichzeitigem Schreiber ($name): Rueckweg ohne Abbruch, Summe vorher = nachher, ein erfolgreicher Aufruf ist auch gezaehlt" "0|$erw" "$F_RC|$v_nach"
  psql_stdin < "$NEW_FILE" >/dev/null 2>&1 || true
  start_rest
}

rueckweg_1b() {
  local rbf="${1:-$NEW_ROLLBACK_FILE}" rc=0 s_vor k_vor n_vor
  seed_tournaments
  q "TRUNCATE public.public_view_counts;" >/dev/null
  # gleiche Fuenferkombination mit verschiedenen Familien (muss addiert werden), dazu Lebenszeichen und andere Kombinationen
  rest_zaehle "$UA_IPHONE_SAFARI" >/dev/null; rest_zaehle "$UA_IPHONE_SAFARI" >/dev/null; rest_zaehle "$UA_WIN_FIREFOX" >/dev/null
  rest_zaehle "$UA_ANDROID_CHROME" anon NIKO26 lebenszeichen >/dev/null; rest_zaehle "$UA_MAC_SAFARI" >/dev/null
  rest_zaehle "$UA_ANDROID_SAMSUNG" anon NIKO26 aufruf gross true link >/dev/null; rest_zaehle "$UA_ANDROID_SAMSUNG" anon NIKO26 aufruf gross true link >/dev/null
  s_vor="$(sums)"; k_vor="$(sums5)"; n_vor="$(keys5)"
  check R "1b Rueckweg: Ausgangslage (Summen je Familie getrennt, mehr Zeilen als Fuenferkombinationen)" "ja" \
    "$([[ "$(q "SELECT count(*) FROM public.public_view_counts;")" -gt "$n_vor" ]] && echo ja || echo nein)"
  psql_stdin < "$rbf" >/dev/null 2>"$WORK/rb1b.err" || rc=$?
  check R "1b Rueckweg laeuft sauber (Exit 0)" "0" "$rc"
  check R "1b Rueckweg: Summen vorher = nachher (Aufrufe/Lebenszeichen), je Fuenferkombination gleich" "$s_vor|$k_vor" "$(sums)|$(sums5)"
  check R "1b Rueckweg: eine Zeile je Fuenferkombination (Zeilen mit verschiedenen Familien zusammengefuehrt)" "$n_vor" "$(q "SELECT count(*) FROM public.public_view_counts;")"
  check R "1b Rueckweg: Spalten und Hilfsfunktion sind weg, count_public_view = Fassung 003 (md5)" "0|859971c10b8dfb7bc30ed9ac8444df14|" \
    "$(col_gone)|$(fn_md5)|$(q "SELECT coalesce(to_regprocedure('public.public_view_agent_families(text)')::text,'');")"
  schema_dump > "$WORK/schema_nach_1b_rueckweg.sql"
  check R "1b Rueckweg: Schema danach = Stand 004 (Tabelle, Schluessel, Funktion, Rechte, Kommentare)" "" "$(diff "$WORK/schema_004.sql" "$WORK/schema_nach_1b_rueckweg.sql" || true)"
  start_rest
  alt_client_zaehlt "V nach Rueckweg 1b: ausgelieferter Client"
}

run_rueckweg() {
  local sql_pv="SELECT coalesce(has_table_privilege('ci_schema_reader', to_regclass('public.public_view_counts'), 'SELECT')::text, 'keine Tabelle');"
  # ---- Stufe 1b: Rueckweg, Idempotenz, wieder vorwaerts (Zustand beim Eintritt: 1b eingespielt) ----
  rueckweg_nebenlaeufig "Schreiber nach dem Zusammenfuehren" 's#^         GROUP BY tournament_id, window_start, channel, device_class, installed;#& PERFORM pg_sleep(4);#'
  rueckweg_nebenlaeufig "Schreiber nach dem Leeren der Tabelle" 's#^      DELETE FROM public.public_view_counts;#& PERFORM pg_sleep(4);#'
  rueckweg_1b
  check R "1b Rueckweg zweimal hintereinander laeuft sauber, nichts aendert sich" "0|" \
    "$(psql_stdin < "$NEW_ROLLBACK_FILE" >/dev/null 2>&1; echo -n "$?|"; schema_dump | diff "$WORK/schema_004.sql" - || true)"
  local s_mitte; s_mitte="$(sums)"
  check R "1b wieder vorwaerts nach dem Rueckweg: laeuft sauber, Summen bleiben, alle Zeilen sonstige/sonstige" "0|$s_mitte|sonstige/sonstige" \
    "$(psql_stdin < "$NEW_FILE" >/dev/null 2>&1; echo -n "$?|"; echo -n "$(sums)|"; q "SELECT string_agg(DISTINCT os_family || '/' || browser_family, ',') FROM public.public_view_counts;")"
  psql_stdin < "$NEW_ROLLBACK_FILE" >/dev/null   # zurueck auf Stand 004 fuer die Pruefungen der Stufe 1
  check R "zweites Einspielen der Migration laeuft sauber (idempotent)" "0" "$(psql_stdin < "$TARGET_FILE" >/dev/null 2>&1; echo $?)"
  check R "004: zweites Einspielen laeuft sauber (idempotent), Recht bleibt" "0|true" \
    "$(psql_stdin < "$GRANT_FILE" >/dev/null 2>&1; echo -n "$?|"; q "$sql_pv")"
  # Rueckweg 004 allein: Recht weg, Tabelle und Zeilen bleiben, andere Rechte unberuehrt; danach wieder vorwaerts: Recht da
  check R "004: Rueckweg laeuft sauber, Recht ist weg, service_role behaelt SELECT, Tabelle bleibt" "0|false|true|true" \
    "$(psql_stdin < "$GRANT_ROLLBACK_FILE" >/dev/null 2>&1; echo -n "$?|"; q "SELECT has_table_privilege('ci_schema_reader', 'public.public_view_counts', 'SELECT') || '|' || has_table_privilege('service_role', 'public.public_view_counts', 'SELECT') || '|' || (to_regclass('public.public_view_counts') IS NOT NULL);")"
  check R "004 ohne Recht: pg_dump der Tabelle als ci_schema_reader scheitert (genau der Fehler aus dem Drift-Check)" "pg_dump: error: query failed: ERROR:  permission denied for table public_view_counts" \
    "$(dump_as_reader)"
  check R "004: Rueckweg zweimal hintereinander laeuft sauber" "0" "$(psql_stdin < "$GRANT_ROLLBACK_FILE" >/dev/null 2>&1; echo $?)"
  check R "004: wieder vorwaerts -- Recht ist da, pg_dump gelingt" "0|true|0|1" \
    "$(psql_stdin < "$GRANT_FILE" >/dev/null 2>&1; echo -n "$?|"; q "$sql_pv" | tr -d '\n'; echo -n "|"; dump_as_reader)"
  # Rueckweg 003 bei eingespielter 004: das Recht verschwindet mit der Tabelle
  check R "Rueckweg von 003 laeuft sauber, auch wenn 004 schon eingespielt ist" "0" "$(psql_stdin < "$ROLLBACK_FILE" >/dev/null 2>&1; echo $?)"
  schema_dump > "$WORK/schema_nachher.sql"
  check R "nach dem Rueckweg (004 war drauf) ist das Schema wie vorher" "" "$(diff "$WORK/schema_vorher.sql" "$WORK/schema_nachher.sql" || true)"
  check R "nach dem Rueckweg gibt es weder Tabelle noch Funktion" "||" \
    "$(q "SELECT coalesce(to_regclass('public.public_view_counts')::text,'') || '|' || coalesce(to_regprocedure('public.count_public_view(text,text,text,text,boolean)')::text,'') || '|';")"
  # Rueckweg 004 NACH dem von 003: nichts zu tun, kein Fehler, nichts halb zurueckgelassen
  check R "004: Rueckweg NACH dem von 003 laeuft sauber (Tabelle fehlt, nichts zu tun)" "0" "$(psql_stdin < "$GRANT_ROLLBACK_FILE" >/dev/null 2>&1; echo $?)"
  schema_dump > "$WORK/schema_nachher2.sql"
  check R "004: nach beiden Rueckwegen ist das Schema wie vorher" "" "$(diff "$WORK/schema_vorher.sql" "$WORK/schema_nachher2.sql" || true)"
  # 004 vorwaerts ohne Tabelle: Fail-fast, keine Aenderung
  check R "004 ohne Tabelle: Fail-fast (Einspielen scheitert) und es bleibt nichts zurueck" "3|" \
    "$(psql_stdin < "$GRANT_FILE" >/dev/null 2>&1; echo -n "$?|"; schema_dump | diff "$WORK/schema_vorher.sql" - || true)"
  # 1b ohne Tabelle: Fail-fast; Rueckweg 1b ohne Tabelle: nichts zu tun und KEINE Funktion neu angelegt
  check R "1b ohne Tabelle: Fail-fast (Einspielen scheitert) und es bleibt nichts zurueck" "3|" \
    "$(psql_stdin < "$NEW_FILE" >/dev/null 2>&1; echo -n "$?|"; schema_dump | diff "$WORK/schema_vorher.sql" - || true)"
  check R "1b Rueckweg ohne Tabelle: laeuft sauber, legt count_public_view nicht neu an, nichts bleibt zurueck" "0||" \
    "$(psql_stdin < "$NEW_ROLLBACK_FILE" >/dev/null 2>&1; echo -n "$?|"; echo -n "$(q "SELECT coalesce(to_regprocedure('public.count_public_view(text,text,text,text,boolean)')::text,'');")|"; schema_dump | diff "$WORK/schema_vorher.sql" - || true)"
  psql_stdin < "$TARGET_FILE" >/dev/null   # wieder herstellen
  psql_stdin < "$GRANT_FILE" >/dev/null
  psql_stdin < "$NEW_FILE" >/dev/null
  start_rest
}

summary() { local i; echo ""; for i in "${!CATS[@]}"; do echo "[${CATS[$i]}] ${OKS[$i]} ok, ${DEVS[$i]} Abweichung(en)"; done; }

# Mutationen (Gegenprobe): jede muss mindestens eine Pruefung rot machen. sed-Ausdruecke auf Kopien der Migration.
# An 003 (Tabelle und Rechte der Stufe 1):
MUTATIONEN_003=(
  "M3|s/ON DELETE CASCADE/ON DELETE NO ACTION/"
  "M4|s/GRANT SELECT ON TABLE public.public_view_counts TO service_role;/GRANT SELECT ON TABLE public.public_view_counts TO service_role, anon;/"
  "M9|s/ALTER TABLE public.public_view_counts ENABLE ROW LEVEL SECURITY;/ALTER TABLE public.public_view_counts DISABLE ROW LEVEL SECURITY;\nGRANT SELECT ON public.public_view_counts TO anon;/"
  "M11|s/^COMMIT;/CREATE TRIGGER public_view_counts_guard_closed BEFORE INSERT OR UPDATE OR DELETE ON public.public_view_counts FOR EACH ROW EXECUTE FUNCTION public.guard_closed_tournament('tournament_id');\nCOMMIT;/"
)
# An 20261126_001 (Stufe 1b; die Funktion count_public_view der Stufe 1 steht dort in der endgueltigen Fassung):
MUTATIONEN_1B=(
  "M1|s/AND t.deleted_at IS NULL;/;/"
  "M2|s/coalesce(t.is_public, false) AND //"
  "M5|s/v_kanal := CASE WHEN p_kanal IN ('qr', 'link', 'direkt') THEN p_kanal ELSE 'direkt' END;/v_kanal := coalesce(p_kanal, 'direkt');/"
  "M6|s/v_views := 0; v_beats := 1;/v_views := 1; v_beats := 1;/"
  "M7|s/date_bin('5 minutes', now(), timestamptz '2000-01-01 00:00:00+00')/now()/"
  "M8|s/IF v_id IS NULL THEN RETURN; END IF;/IF v_id IS NULL THEN RAISE EXCEPTION 'x'; END IF;/"
  "M10|s/IF p_geraet IS NULL OR p_geraet NOT IN ('handy', 'tablet', 'gross') THEN RETURN; END IF;//"
  "M12|s/AND t.deleted_at IS NULL;/AND t.deleted_at IS NULL AND t.lifecycle_status <> 'finished';/"
  "M17|s#WHEN position('SamsungBrowser' IN ua) > 0 THEN 'samsung'#WHEN position('Chrome/' IN ua) > 0 THEN 'chrome' WHEN position('SamsungBrowser' IN ua) > 0 THEN 'samsung'#"
  "M18|s#WHEN position('Chrome/' IN ua) > 0 OR position('CriOS/' IN ua) > 0 THEN 'chrome'#WHEN position('Safari/' IN ua) > 0 THEN 'safari' WHEN position('Chrome/' IN ua) > 0 OR position('CriOS/' IN ua) > 0 THEN 'chrome'#"
  "M19|s#WHEN position('iPhone' IN ua) > 0 OR#WHEN position('Mac OS X' IN ua) > 0 THEN 'macos' WHEN position('iPhone' IN ua) > 0 OR#"
  "M20|s#v_os, v_browser, v_views#v_os, left(coalesce(v_agent, 'sonstige'), 200), v_views#;s#CONSTRAINT public_view_counts_browser_family_check CHECK (browser_family IN ([^)]*))##"
  "M21|s#v_headers := nullif(current_setting('request.headers', true), '');#v_headers := current_setting('request.headers');#"
  "M22|s#v_agent := v_headers::jsonb ->> 'user-agent';#v_agent := v_headers::jsonb ->> 'user-agent'; IF v_agent IS NULL THEN RAISE EXCEPTION 'keine Kennung'; END IF;#"
  "M23|s# OR char_length(p_agent) > 512##"
  "M24|s#->> 'user-agent'#->> 'User-Agent'#"
  "M25|s# AND pg_input_is_valid(v_headers, 'jsonb')##"
  "M26|s#PRIMARY KEY (tournament_id, window_start, channel, device_class, installed, os_family, browser_family);#PRIMARY KEY (tournament_id, window_start, channel, device_class, installed);#"
  "M27|s#REVOKE ALL ON FUNCTION public.public_view_agent_families(text) FROM PUBLIC, anon, authenticated;#REVOKE ALL ON FUNCTION public.public_view_agent_families(text) FROM PUBLIC;#"
  "M28|s#WHEN position('; wv)' IN ua) > 0 THEN 'sonstige'##"
  "M29|s# AND position('Android' IN ua) = 0 THEN 'safari'# THEN 'safari'#"
  "M30|s#position('Edg/' IN ua) > 0 OR ##"
  "M31|s# OR position('iPad' IN ua) > 0##"
  "M32|s# OR position('OPR/' IN ua) > 0##"
  "M33|s# OR position('FxiOS' IN ua) > 0##"
  "M34|s# OR position('CriOS/' IN ua) > 0##"
  "M35|s#WHEN position('Windows' IN ua) > 0 THEN 'windows'#WHEN false THEN 'windows'#"
  "M36|s# AND position('Version/' IN ua) > 0##"
  "M37|s# OR position('EdgA/' IN ua) > 0##"
  "M38|s#position('Mac OS X' IN ua) > 0 THEN 'macos'#position('Mac OS X' IN ua) > 0 THEN 'macos' WHEN position('Linux' IN ua) > 0 THEN 'macos'#"
)
# An 004: GRANT weglassen / zu viel vergeben / Policy dazu (dann sieht die Rolle Zeilen)
MUTATIONEN_004=(
  "M13|/^GRANT SELECT ON TABLE public.public_view_counts TO ci_schema_reader;/d"
  "M14|s/^GRANT SELECT ON TABLE public.public_view_counts TO ci_schema_reader;/GRANT SELECT, INSERT ON TABLE public.public_view_counts TO ci_schema_reader;/"
  "M15|s/^GRANT SELECT ON TABLE public.public_view_counts TO ci_schema_reader;/GRANT SELECT ON TABLE public.public_view_counts TO ci_schema_reader, anon;/"
  "M16|s/^GRANT SELECT ON TABLE public.public_view_counts TO ci_schema_reader;/GRANT SELECT ON TABLE public.public_view_counts TO ci_schema_reader;\nCREATE POLICY ci_leser ON public.public_view_counts FOR SELECT TO ci_schema_reader USING (true);/"
)
# Am Rueckweg von 20261126_001: Summen nicht addiert / Funktionsrechte nicht wiederhergestellt / Hilfsfunktion bleibt
MUTATIONEN_RB1B=(
  "M39|s#sum(views)::bigint AS views#max(views)::bigint AS views#"
  "M40|s#GRANT EXECUTE ON FUNCTION public.count_public_view(text, text, text, text, boolean) TO anon, authenticated, service_role;##"
  "M41|s#DROP FUNCTION IF EXISTS public.public_view_agent_families(text);##"
  "M42|/LOCK TABLE public.public_view_counts IN ACCESS EXCLUSIVE MODE;/d"
)

# Vor dem Einspielen von 20261126_001 (Stand 003 + 004): der ausgelieferte Client zaehlt; Bestandszeilen; Fail-fast; Sperre
vor_1b() {
  seed_tournaments
  q "TRUNCATE public.public_view_counts;" >/dev/null
  alt_client_zaehlt "V vor Stufe 1b: ausgelieferter Client"
  check V "vor Stufe 1b gibt es die Spalten der Stufe 1b noch nicht" "0" "$(col_gone)"
  schema_dump > "$WORK/schema_004.sql"
  # Bestandszeilen (Zeilen aus der Zeit vor Stufe 1b)
  local b_sum b_keys b_n
  b_sum="$(sums)"; b_keys="$(sums5)"; b_n="$(q "SELECT count(*) FROM public.public_view_counts;")"
  # Fail-fast: fremde Fassung von count_public_view (nicht 003, nicht 1b) -> Einspielen scheitert, nichts aendert sich
  sed "s/RETURN; END IF;/RETURN; END IF; /" "$TARGET_FILE" > "$WORK/fremd003.sql"
  psql_stdin < "$WORK/fremd003.sql" >/dev/null
  schema_dump > "$WORK/schema_fremd.sql"
  check R "1b: fremde Fassung von count_public_view -> Fail-fast (Exit 3), nichts geaendert" "3|" \
    "$(psql_stdin < "$NEW_FILE" >/dev/null 2>&1; echo -n "$?|"; schema_dump | diff "$WORK/schema_fremd.sql" - || true)"
  psql_stdin < "$TARGET_FILE" >/dev/null   # Fassung 003 wieder herstellen
  schema_dump > "$WORK/schema_004b.sql"
  check R "1b: nach dem Wiederherstellen der Fassung 003 ist das Schema wieder wie vor dem Versuch" "" "$(diff "$WORK/schema_004.sql" "$WORK/schema_004b.sql" || true)"
  # Fail-fast bei Sperre: eine andere Sitzung haelt die Tabelle (ACCESS SHARE), die Migration wartet hoechstens 5 s und bricht ab
  docker exec -i "$C" psql -U postgres -X -q -c "BEGIN; LOCK TABLE public.public_view_counts IN ACCESS SHARE MODE; SELECT pg_sleep(10); COMMIT;" >/dev/null 2>&1 &
  local bg=$! t0 t1 rc=0
  sleep 2
  t0=$(date +%s)
  psql_stdin < "$NEW_FILE" >/dev/null 2>"$WORK/lock.err" || rc=$?
  t1=$(date +%s)
  wait "$bg" || true
  check R "1b: Sperre gehalten -> Einspielen bricht nach hoechstens ~5 s mit Sperr-Zeitueberschreitung ab (Exit 3)" "3|ja|ja" \
    "$rc|$([[ $((t1 - t0)) -le 8 ]] && echo ja || echo "nein: $((t1 - t0)) s")|$(grep -qi 'lock timeout' "$WORK/lock.err" && echo ja || echo "nein: $(head -c 150 "$WORK/lock.err")")"
  schema_dump > "$WORK/schema_004c.sql"
  check R "1b: nach dem Sperr-Abbruch ist nichts geaendert" "" "$(diff "$WORK/schema_004.sql" "$WORK/schema_004c.sql" || true)"
  # Einspielen -- mit einem ALTEN Aufruf, der waehrend der Migration startet und hinter ihr wartet (Migration haelt ihre Sperre 4 s)
  sed 's/^COMMIT;/SELECT pg_sleep(4); COMMIT;/' "$NEW_FILE" > "$WORK/neu_mit_pause.sql"
  nebenlaeufig "$WORK/neu_mit_pause.sql"
  rc="$F_RC"
  [[ "${QUIET:-0}" == "1" ]] || echo "INFO        alter Aufruf (Fassung 003) wartet hinter der Migration: Exit $W_RC ${W_ERR:0:200}"
  check R "1b: Einspielen mit wartendem alten Aufruf: Migration ohne Fehler; der wartende Aufruf der Fassung 003 scheitert nach dem COMMIT mit 42P10 (ON CONFLICT auf den alten Schluessel), diese eine Zaehlung geht verloren" "0|3 42P10" "$rc|$W_RC $([[ "$W_ERR" == *"no unique or exclusion constraint matching the ON CONFLICT"* ]] && echo 42P10 || echo "$W_ERR")"
  check V "1b wird auf dem Bestand eingespielt (Exit 0)" "0" "$rc"
  start_rest
  check V "Bestandszeilen behalten ihre Summen (Aufrufe/Lebenszeichen je Fuenferkombination) und bekommen sonstige/sonstige" "$b_sum|$b_keys|$b_n|sonstige/sonstige" \
    "$(sums)|$(sums5)|$(q "SELECT count(*) FROM public.public_view_counts;")|$(q "SELECT string_agg(DISTINCT os_family || '/' || browser_family, ',') FROM public.public_view_counts;")"
  schema_dump > "$WORK/schema_1b.sql"
  rc=0; psql_stdin < "$NEW_FILE" >/dev/null 2>&1 || rc=$?
  schema_dump > "$WORK/schema_1b2.sql"
  check R "1b: zweites Einspielen laeuft sauber (idempotent), Schema und Summen unveraendert" "0||$b_sum" \
    "$rc|$(diff "$WORK/schema_1b.sql" "$WORK/schema_1b2.sql" || true)|$(sums)"
  alt_client_zaehlt "V nach dem Einspielen von Stufe 1b: ausgelieferter Client"
}

# Stand 003 + 004 (+ Stufe 1b) neu aufbauen, mit je einer Datei (Gegenprobe). Rueckgabe 1 = eine Datei laesst sich nicht einspielen.
INSTALL_MSG=""
install_stack() { # <003> <004> <1b | -> ; bei Fehler steht der Grund in INSTALL_MSG
  q "DROP TABLE IF EXISTS public.public_view_counts CASCADE; DROP FUNCTION IF EXISTS public.count_public_view(text,text,text,text,boolean); DROP FUNCTION IF EXISTS public.public_view_agent_families(text);" >/dev/null
  reset_counts
  local f
  for f in "$1" "$2"; do
    if ! psql_stdin < "$f" >/dev/null 2>"$WORK/apply.log"; then INSTALL_MSG="Einspielen scheitert ($(tail -1 "$WORK/apply.log"))"; return 1; fi
  done
  schema_dump > "$WORK/schema_004.sql"
  if [[ "$3" != "-" ]] && ! psql_stdin < "$3" >/dev/null 2>"$WORK/apply.log"; then INSTALL_MSG="Einspielen scheitert ($(tail -1 "$WORK/apply.log"))"; return 1; fi
  start_rest
  return 0
}
mutation_lauf() { # <id> <Beschreibung der Datei> -- run_checks im aktuellen Stand, Ergebnis rot/gruen
  local id="$1"
  QUIET=1 run_checks > "$WORK/run-$id.log" 2>&1 || true
  if [[ "$(total_dev)" -gt 0 ]]; then
    [[ -z "${ZAEHLUNG_DEBUG:-}" ]] || head -12 "$WORK/run-$id.log"
    echo "Mutation $id: rot ($(total_dev) Abweichung(en), z. B. $(grep -m1 '^ABWEICHUNG' "$WORK/run-$id.log" || echo '?'))"
  else
    echo "::error::Mutation $id bleibt gruen -- keine Pruefung faengt sie." >&2; failed=1
  fi
}

# =====================================================================================================================================
# Stufe 1c (20261127_001_zuschauer_zaehlung_netzstoerung.sql): ueberstandene Netzstoerungen (@RZ-033 bis @RZ-036). Kategorie N.
# =====================================================================================================================================
NS_USE="$NS_FILE"   # die Datei, die vor_ns einspielt (Gegenprobe: eine Mutation)
ns_cols() { q "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='public_view_counts' AND column_name IN ('outages_short','outages_long');"; }
# Bestand ohne die neuen Spalten: Pruefsumme ueber alle Zeilen (nur die Spalten der Stufe 1b) -- Bestandszeilen duerfen sich nie aendern
bestand_md5() { q "SELECT coalesce(md5(string_agg(concat_ws('|', tournament_id, window_start, channel, device_class, installed, os_family, browser_family, views, heartbeats), ';' ORDER BY tournament_id, window_start, channel, device_class, installed, os_family, browser_family)), '-') FROM public.public_view_counts WHERE ${1:-true};"; }
# Summen der Stoerungen (kurz/lang) ueber alle Zeilen
outsums() { q "SELECT coalesce(sum(outages_short),0) || '/' || coalesce(sum(outages_long),0) FROM public.public_view_counts;"; }
# nsf -- Zeilen des Turniers T_PUB: "os/browser/kanal v<Aufrufe> h<Lebenszeichen> k<kurz> l<lang>"
nsf() { q "SELECT coalesce(string_agg(os_family || '/' || browser_family || '/' || channel || ' v' || views || ' h' || heartbeats || ' k' || outages_short || ' l' || outages_long, ',' ORDER BY os_family, browser_family, channel), '-') FROM public.public_view_counts WHERE tournament_id = '$T_PUB';"; }

# Vor dem Einspielen von 20261127_001 (Stand 003 + 004 + 1b): neuer Client gegen alten Server, Bestand, Fail-fast, Sperre, Einspielen.
vor_ns() {
  local rc=0 b_md5 b_n s_k s_l
  seed_tournaments
  q "TRUNCATE public.public_view_counts;" >/dev/null
  check V "Vorbedingung: count_public_view ist die Fassung 20261126_001 (prosrc-md5)" "$MD5_1B" "$(fn_md5)"
  check V "Vorbedingung: die Spalten der Stufe 1c gibt es noch nicht" "0" "$(ns_cols)"
  alt_client_zaehlt "V vor Stufe 1c: ausgelieferter Client"
  schema_dump > "$WORK/schema_1b_vor_ns.sql"
  # Bestandszeilen (aus der Zeit vor Stufe 1c): verschiedene Familien, Kanaele, Lebenszeichen
  rest_zaehle "$UA_IPHONE_SAFARI" >/dev/null; rest_zaehle "$UA_IPHONE_SAFARI" >/dev/null; rest_zaehle "$UA_WIN_FIREFOX" anon NIKO26 aufruf gross true direkt >/dev/null
  rest_zaehle "$UA_IPHONE_SAFARI" anon NIKO26 lebenszeichen >/dev/null; rest_zaehle "$UA_ANDROID_SAMSUNG" anon NIKO26 aufruf tablet false link >/dev/null
  b_md5="$(bestand_md5)"; b_n="$(q "SELECT count(*) FROM public.public_view_counts;")"
  # @RZ-036: ein neuer Client (Art stoerung_kurz / stoerung_lang) trifft den Server OHNE die Erweiterung: 2xx, still verworfen, nichts gezaehlt
  s_k="$(rest_zaehle "$UA_IPHONE_SAFARI" anon NIKO26 stoerung_kurz handy false qr)"
  s_l="$(rest_zaehle "$UA_WIN_FIREFOX" authenticated NIKO26 stoerung_lang gross true direkt)"
  check N "@RZ-036 neuer Client gegen den Server ohne Erweiterung: Meldung 'stoerung_kurz' und 'stoerung_lang' ergibt 2xx (kein Fehler), Zaehlung unveraendert" "ok|ok|$b_md5|$b_n" \
    "$(ok2xx "$s_k")|$(ok2xx "$s_l")|$(bestand_md5)|$(q "SELECT count(*) FROM public.public_view_counts;")"
  # Fail-fast: fremde Fassung von count_public_view -> Einspielen scheitert (Exit 3), nichts aendert sich
  sed "s/RETURN; END IF;/RETURN; END IF; /" "$NEW_FILE" > "$WORK/fremd1b.sql"
  psql_stdin < "$WORK/fremd1b.sql" >/dev/null
  schema_dump > "$WORK/schema_fremd_ns.sql"
  check R "1c: fremde Fassung von count_public_view -> Fail-fast (Exit 3), nichts geaendert" "3|" \
    "$(psql_stdin < "$NS_USE" >/dev/null 2>&1; echo -n "$?|"; schema_dump | diff "$WORK/schema_fremd_ns.sql" - || true)"
  psql_stdin < "$NEW_FILE" >/dev/null   # Fassung 1b wieder herstellen
  schema_dump > "$WORK/schema_1b_b.sql"
  check R "1c: nach dem Wiederherstellen der Fassung 1b ist das Schema wieder wie vor dem Versuch, die Funktion ist die Fassung 1b" "|$MD5_1B" \
    "$(diff "$WORK/schema_1b_vor_ns.sql" "$WORK/schema_1b_b.sql" || true)|$(fn_md5)"
  # Fail-fast bei Sperre
  docker exec -i "$C" psql -U postgres -X -q -c "BEGIN; LOCK TABLE public.public_view_counts IN ACCESS SHARE MODE; SELECT pg_sleep(10); COMMIT;" >/dev/null 2>&1 &
  local bg=$! t0 t1
  sleep 2
  t0=$(date +%s)
  psql_stdin < "$NS_USE" >/dev/null 2>"$WORK/lock_ns.err" || rc=$?
  t1=$(date +%s)
  wait "$bg" || true
  check R "1c: Sperre gehalten -> Einspielen bricht nach hoechstens ~5 s mit Sperr-Zeitueberschreitung ab (Exit 3)" "3|ja|ja" \
    "$rc|$([[ $((t1 - t0)) -le 8 ]] && echo ja || echo "nein: $((t1 - t0)) s")|$(grep -qi 'lock timeout' "$WORK/lock_ns.err" && echo ja || echo "nein: $(head -c 150 "$WORK/lock_ns.err")")"
  schema_dump > "$WORK/schema_1b_c.sql"
  check R "1c: nach dem Sperr-Abbruch ist nichts geaendert" "" "$(diff "$WORK/schema_1b_vor_ns.sql" "$WORK/schema_1b_c.sql" || true)"
  # Einspielen, mit einem ALTEN Aufruf (Fassung 1b), der waehrend der Migration startet und hinter ihr wartet
  local pause_sum_vor; pause_sum_vor="$(q "SELECT coalesce(sum(views),0) FROM public.public_view_counts;")"
  sed 's/^COMMIT;/SELECT pg_sleep(4); COMMIT;/' "$NS_USE" > "$WORK/ns_mit_pause.sql"
  nebenlaeufig "$WORK/ns_mit_pause.sql"
  rc="$F_RC"
  [[ "${QUIET:-0}" == "1" ]] || echo "INFO        alter Aufruf (Fassung 1b) wartet hinter der Migration: Exit $W_RC ${W_ERR:0:200}"
  start_rest
  check V "1c wird auf dem Bestand eingespielt (Exit 0); der waehrend der Migration wartende Aufruf der Fassung 1b geht nicht verloren (kein Fehler, +1 Aufruf)" "0|0|$((pause_sum_vor + 1))" \
    "$rc|$W_RC|$(q "SELECT coalesce(sum(views),0) FROM public.public_view_counts;")"
  # Die Zeile des wartenden Aufrufs (sonstige/sonstige, ohne Kennung) ist neu; alle Bestandszeilen sind unveraendert
  check V "@RZ-036 Bestandszeilen behalten ihre Summen und alle anderen Werte, tragen 0 Stoerungen; keine Zeile geloescht oder umgeschrieben" "$b_md5|0/0|$((b_n + 1))" \
    "$(bestand_md5 "NOT (os_family = 'sonstige' AND browser_family = 'sonstige')")|$(outsums)|$(q "SELECT count(*) FROM public.public_view_counts;")"
  schema_dump > "$WORK/schema_ns.sql"
  rc=0; psql_stdin < "$NS_USE" >/dev/null 2>&1 || rc=$?
  schema_dump > "$WORK/schema_ns2.sql"
  check R "1c: zweites Einspielen laeuft sauber (idempotent), Schema unveraendert" "0|" "$rc|$(diff "$WORK/schema_ns.sql" "$WORK/schema_ns2.sql" || true)"
  alt_client_zaehlt "V nach dem Einspielen von Stufe 1c: ausgelieferter Client"
}

# Pruefungen im Stand 003 + 004 + 1b + 1c
run_ns_checks() {
  local st s1 s2 s3
  seed_tournaments
  q "TRUNCATE public.public_view_counts;" >/dev/null
  # ---- Schema: nur ergaenzend ----
  check N "1c Spalten: genau die elf (die neun der Stufe 1b, dazu outages_short und outages_long)" "tournament_id,window_start,channel,device_class,installed,views,heartbeats,os_family,browser_family,outages_short,outages_long" \
    "$(q "SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='public_view_counts';")"
  check N "1c die zwei Spalten: integer, NOT NULL, Vorgabe 0 (wie views und heartbeats: Pruefregel >= 0)" "outages_long:integer:NO:0,outages_short:integer:NO:0" \
    "$(q "SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable || ':' || column_default, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema='public' AND table_name='public_view_counts' AND column_name LIKE 'outages_%';")"
  check N "1c Primaerschluessel unveraendert (dieselben sieben Spalten wie in Stufe 1b)" "tournament_id,window_start,channel,device_class,installed,os_family,browser_family" \
    "$(q "SELECT string_agg(a.attname, ',' ORDER BY k.ord) FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum WHERE c.conrelid = 'public.public_view_counts'::regclass AND c.contype = 'p';")"
  check N "1c Pruefregel: eine negative Zahl wird abgewiesen (kurz und lang)" "ja|ja" \
    "$([[ "$(q "INSERT INTO public.public_view_counts (tournament_id, window_start, channel, device_class, installed, outages_short) VALUES ('$T_PUB', now(), 'qr', 'handy', false, -1);")" == *'public_view_counts_outages_short_check'* ]] && echo ja || echo nein)|$([[ "$(q "INSERT INTO public.public_view_counts (tournament_id, window_start, channel, device_class, installed, outages_long) VALUES ('$T_PUB', now(), 'qr', 'handy', false, -1);")" == *'public_view_counts_outages_long_check'* ]] && echo ja || echo nein)"
  check N "1c Funktion: gleiche Signatur und Rueckgabetyp (void), SECURITY DEFINER, fester search_path, nur anon/authenticated/service_role duerfen sie rufen, kein RAISE" "true|{\"search_path=public, pg_temp\"}|true|true|true|false|void|0" \
    "$(q "SELECT prosecdef || '|' || proconfig::text || '|' || has_function_privilege('anon', oid, 'EXECUTE') || '|' || has_function_privilege('authenticated', oid, 'EXECUTE') || '|' || has_function_privilege('service_role', oid, 'EXECUTE') || '|' || has_function_privilege('public', oid, 'EXECUTE') || '|' || prorettype::regtype || '|' || position('RAISE' IN prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.count_public_view(text,text,text,text,boolean)');")"
  check N "1c Funktion ist nicht mehr die Fassung 1b, kennt die zwei neuen Arten" "ja|ja" \
    "$([[ "$(fn_md5)" != "$MD5_1B" ]] && echo ja || echo nein)|$(q "SELECT (position('stoerung_kurz' IN prosrc) > 0 AND position('stoerung_lang' IN prosrc) > 0) FROM pg_proc WHERE oid = to_regprocedure('public.count_public_view(text,text,text,text,boolean)');" | sed 's/^t$/ja/;s/^f$/nein/')"
  [[ "${QUIET:-0}" == "1" ]] || echo "INFO        prosrc-md5 von count_public_view in Stufe 1c: $(fn_md5)"
  check N "@RZ-030 anon und authenticated koennen die neuen Spalten nicht lesen und nichts schreiben (kein Tabellenrecht, RLS an, keine Policy)" "ERROR:  permission denied for table public_view_counts|ERROR:  permission denied for table public_view_counts|t|0" \
    "$(as_role anon "SELECT sum(outages_short) FROM public.public_view_counts;")|$(as_role authenticated "UPDATE public.public_view_counts SET outages_long = 99;")|$(q "SELECT relrowsecurity FROM pg_class WHERE oid='public.public_view_counts'::regclass;")|$(q "SELECT count(*) FROM pg_policies WHERE tablename='public_view_counts';")"

  # ---- @RZ-033: die zwei Arten zaehlen, in der Zeile der Aufrufe derselben Kombination ----
  st="$(rest_zaehle "$UA_IPHONE_SAFARI" anon NIKO26 stoerung_kurz handy false qr)"
  check N "@RZ-033 kurze Stoerung (iPhone/Safari, QR, Handy) ueber PostgREST: 2xx, eine Zeile, kurz 1, lang 0, kein Aufruf und kein Lebenszeichen" "ok|ios/safari/qr v0 h0 k1 l0" "$(ok2xx "$st")|$(nsf)"
  st="$(rest_zaehle "$UA_IPHONE_SAFARI" anon NIKO26 stoerung_lang handy false qr)"
  check N "@RZ-033 lange Stoerung derselben Kombination: gleiche Zeile, lang 1 (kurz bleibt 1)" "ok|ios/safari/qr v0 h0 k1 l1" "$(ok2xx "$st")|$(nsf)"
  rest_zaehle "$UA_IPHONE_SAFARI" anon NIKO26 stoerung_kurz handy false qr >/dev/null
  check N "@RZ-033 eine zweite kurze Stoerung addiert (kurz 2): zwei getrennte Stoerungen = zwei Meldungen = Summe 2, keine zweite Zeile" "ios/safari/qr v0 h0 k2 l1" "$(nsf)"
  rest_zaehle "$UA_IPHONE_SAFARI" anon NIKO26 aufruf handy false qr >/dev/null
  rest_zaehle "$UA_IPHONE_SAFARI" anon NIKO26 lebenszeichen handy false qr >/dev/null
  check N "@RZ-033 'aufgeteilt wie die Aufrufe': Aufruf und Lebenszeichen derselben Kombination stehen in derselben Zeile, ihre Summen bleiben von Stoerungen unberuehrt" "ios/safari/qr v1 h1 k2 l1" "$(nsf)"
  rest_zaehle "$UA_WIN_FIREFOX" authenticated NIKO26 stoerung_lang gross true direkt >/dev/null
  rest_zaehle "$UA_IPHONE_SAFARI" anon NIKO26 stoerung_kurz handy false link >/dev/null
  rest_zaehle "$UA_ANDROID_SAMSUNG" anon NIKO26 stoerung_kurz tablet false qr >/dev/null
  check N "@RZ-033 aufgeteilt nach Betriebssystem und Browser, Kanal, Geraeteart, installiert (auch fuer authenticated): je Kombination eine Zeile" "android/samsung/qr v0 h0 k1 l0,ios/safari/link v0 h0 k1 l0,ios/safari/qr v1 h1 k2 l1,windows/firefox/direkt v0 h0 k0 l1" "$(nsf)"
  check N "@RZ-033 Fenster: Beginn liegt auf voller 5-Minuten-Marke, im laufenden Fenster" "0|1" \
    "$(q "SELECT count(*) FILTER (WHERE (extract(epoch FROM window_start)::bigint % 300) <> 0) FROM public.public_view_counts;")|$(q "SELECT count(DISTINCT window_start) FROM public.public_view_counts WHERE window_start > now() - interval '5 minutes' AND window_start <= now();")"
  q "TRUNCATE public.public_view_counts;" >/dev/null
  zaehle FIN001 stoerung_kurz qr handy false
  check N "@RZ-033 abgeschlossenes Turnier (finished): eine Stoerung zaehlt wie ein Aufruf, ohne Fehler" "1/0" "$(q "SELECT coalesce(sum(outages_short),0) || '/' || coalesce(sum(outages_long),0) FROM public.public_view_counts WHERE tournament_id = '$T_FIN';")"

  # ---- @RZ-034: ohne Stoerung keine Stoerung; Unbekanntes bleibt still ----
  q "TRUNCATE public.public_view_counts;" >/dev/null
  zaehle NIKO26 aufruf qr handy false; zaehle NIKO26 lebenszeichen qr handy false; zaehle NIKO26 aufruf link gross true authenticated
  check N "@RZ-034 nur Aufrufe und Lebenszeichen: keine Stoerung gezaehlt (0/0), Aufrufe 2, Lebenszeichen 1" "0/0|2/1" "$(outsums)|$(sums)"
  q "TRUNCATE public.public_view_counts;" >/dev/null
  local art
  for art in "stoerung" "stoerung_mittel" "STOERUNG_KURZ" "stoerung_kurz " "stoerung_kurz;DROP" "" "stoerung_kurz_lang"; do
    zaehle NIKO26 "$art" qr handy false
  done
  as_role anon "SELECT 1 FROM (SELECT public.count_public_view('NIKO26', NULL, 'qr', 'handy', false)) x;" >/dev/null
  check N "@RZ-034 unbekannte Arten (abweichend geschrieben, mit Zusatz, leer, NULL) zaehlen nichts und werfen keinen Fehler" "0|1" \
    "$(q "SELECT count(*) FROM public.public_view_counts;")|$(as_role anon "SELECT 1 FROM (SELECT public.count_public_view('NIKO26','stoerung_mittel','qr','handy',false)) x;")"
  zaehle PRIV01 stoerung_kurz qr handy false
  zaehle TRASH1 stoerung_lang qr handy false
  zaehle NOPE99 stoerung_kurz qr handy false
  zaehle NIKO26 stoerung_kurz qr smartwatch false
  zaehle NIKO26 stoerung_kurz qr NULL false
  zaehle "" stoerung_kurz qr handy false
  zaehle "NIKO26;DROP" stoerung_lang qr handy false
  check N "@RZ-028 gilt auch fuer Stoerungen: nicht oeffentliches Turnier, Papierkorb, unbekannter Code, falsche oder fehlende Geraeteart, leerer oder zu langer Code: nichts gezaehlt, kein Fehler" "0|1|1" \
    "$(q "SELECT count(*) FROM public.public_view_counts;")|$(as_role anon "SELECT 1 FROM (SELECT public.count_public_view('NOPE99','stoerung_lang','qr','handy',false)) x;")|$(as_role anon "SELECT 1 FROM (SELECT public.count_public_view('NIKO26','stoerung_kurz','qr','smartwatch',false)) x;")"
  check N "@RZ-035 Fehlerfreiheit fuer die Seite: NULL-Werte und Stoerung mit unbekanntem Kanal werfen keinen Fehler (Kanal wird direkt)" "1|direkt" \
    "$(as_role anon "SELECT 1 FROM (SELECT public.count_public_view(NULL,'stoerung_kurz',NULL,NULL,NULL)) x;")|$(zaehle NIKO26 stoerung_kurz irgendwas handy false; q "SELECT channel FROM public.public_view_counts WHERE tournament_id='$T_PUB';")"
  q "TRUNCATE public.public_view_counts;" >/dev/null
  zaehle NIKO26 stoerung_lang qr handy NULL
  check N "@RZ-033 installiert NULL zaehlt als nein (wie bei Aufrufen)" "f" "$(q "SELECT installed FROM public.public_view_counts WHERE tournament_id='$T_PUB';")"

  # ---- @RZ-036: der ausgelieferte Client und die Kennung (Stufe 1b) arbeiten unveraendert weiter ----
  alt_client_zaehlt "V mit Stufe 1c: ausgelieferter Client"
  ua_fall "1c: iPhone in Safari" "ios/safari" "$UA_IPHONE_SAFARI"
  ua_fall "1c: Windows in Edge" "windows/sonstige" "$UA_WIN_EDGE"
  ua_fall "1c: Samsung-Browser" "android/samsung" "$UA_ANDROID_SAMSUNG"
  q "TRUNCATE public.public_view_counts;" >/dev/null
  st="$(rest_zaehle --keine-- anon NIKO26 stoerung_lang)"
  check N "@RZ-032 gilt auch fuer Stoerungen: ohne Kennung zaehlt sie unter sonstige/sonstige, 2xx" "ok|sonstige/sonstige/qr v0 h0 k0 l1" "$(ok2xx "$st")|$(nsf)"
  q "TRUNCATE public.public_view_counts;" >/dev/null

  # Rechte-Assertionen als ci_schema_reader: jede Zeile |t, jetzt auch die der Stufe 1c
  local priv red own
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } \
    | docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 2>&1 || true)"
  red="$( (grep -v '|t$' <<<"$priv" | grep -vE '^hallenton-(output-states-heartbeat|speaker-unassign-rpc-authenticated-only)\|f$' || true) | head -5 | tr '\n' ';')"
  own="$( (grep -E '^zuschauer-zaehlung-[a-z-]+\|t$' <<<"$priv" || true) | grep -c . || true)"
  check N "db_privilege_assertions.sql: jede Zeile |t, darunter die sechs zuschauer-zaehlung-* (inkl. netzstoerung-columns)" "keine|6" "${red:-keine}|$own"
}

# Rueckweg von 1c: Summen der Aufrufe und Lebenszeichen vorher = nachher, Schema danach = Stand 1b, Funktion = Fassung 1b
rueckweg_ns() { # [Rueckwegdatei]
  local rbf="${1:-$NS_ROLLBACK_FILE}" rc=0 s_vor n_vor md5_vor s_k s_l
  seed_tournaments
  q "TRUNCATE public.public_view_counts;" >/dev/null
  rest_zaehle "$UA_IPHONE_SAFARI" >/dev/null; rest_zaehle "$UA_IPHONE_SAFARI" >/dev/null; rest_zaehle "$UA_WIN_FIREFOX" anon NIKO26 aufruf gross true direkt >/dev/null
  rest_zaehle "$UA_IPHONE_SAFARI" anon NIKO26 lebenszeichen >/dev/null
  rest_zaehle "$UA_IPHONE_SAFARI" anon NIKO26 stoerung_kurz >/dev/null; rest_zaehle "$UA_ANDROID_CHROME" anon NIKO26 stoerung_lang >/dev/null
  s_vor="$(sums)"; md5_vor="$(bestand_md5)"; n_vor="$(q "SELECT count(*) FROM public.public_view_counts;")"
  check R "1c Rueckweg: Ausgangslage (Stoerungen gezaehlt: 1/1)" "1/1" "$(outsums)"
  psql_stdin < "$rbf" >/dev/null 2>"$WORK/rbns.err" || rc=$?
  check R "1c Rueckweg laeuft sauber (Exit 0)" "0" "$rc"
  check R "1c Rueckweg: Summen der Aufrufe und Lebenszeichen vorher = nachher, alle Zeilen der Stufe 1b gleich" "$s_vor|$md5_vor" "$(sums)|$(bestand_md5)"
  check R "1c Rueckweg: die zwei Spalten sind weg, count_public_view = Fassung 1b (md5)" "0|$MD5_1B" "$(ns_cols)|$(fn_md5)"
  schema_dump > "$WORK/schema_nach_ns_rueckweg.sql"
  check R "1c Rueckweg: Schema danach = Stand 1b (Tabelle, Schluessel, Funktion, Rechte, Kommentare)" "" "$(diff "$WORK/schema_1b_vor_ns.sql" "$WORK/schema_nach_ns_rueckweg.sql" || true)"
  start_rest
  s_k="$(rest_zaehle "$UA_IPHONE_SAFARI" anon NIKO26 stoerung_kurz)"
  s_l="$(rest_zaehle "$UA_WIN_FIREFOX" authenticated NIKO26 stoerung_lang)"
  check V "@RZ-036 nach dem Rueckweg: ein neuer Client (stoerung_kurz/stoerung_lang) wird still verworfen (2xx), nichts gezaehlt" "ok|ok|$s_vor|$n_vor" \
    "$(ok2xx "$s_k")|$(ok2xx "$s_l")|$(sums)|$(q "SELECT count(*) FROM public.public_view_counts;")"
  alt_client_zaehlt "V nach Rueckweg 1c: ausgelieferter Client"
}

run_rueckweg_ns() {
  # Rueckweg, zweimal, wieder vorwaerts (Zustand beim Eintritt: 1c eingespielt)
  rueckweg_ns
  check R "1c Rueckweg zweimal hintereinander laeuft sauber, nichts aendert sich" "0|" \
    "$(psql_stdin < "$NS_ROLLBACK_FILE" >/dev/null 2>&1; echo -n "$?|"; schema_dump | diff "$WORK/schema_1b_vor_ns.sql" - || true)"
  local s_mitte; s_mitte="$(sums)"
  check R "1c wieder vorwaerts nach dem Rueckweg: laeuft sauber, Summen bleiben, Schema = erstes Einspielen, Stoerungen 0/0" "0|$s_mitte||0/0" \
    "$(psql_stdin < "$NS_FILE" >/dev/null 2>&1; echo -n "$?|"; echo -n "$(sums)|"; schema_dump | diff "$WORK/schema_ns.sql" - || true; echo -n "|"; outsums)"
  start_rest
  # Rueckweg mit gleichzeitigem Schreiber: die Sperre haelt den Schreiber bis zum Ende; Summe bleibt, der Aufruf ist gezaehlt
  seed_tournaments
  q "TRUNCATE public.public_view_counts;" >/dev/null
  rest_zaehle "$UA_IPHONE_SAFARI" >/dev/null; rest_zaehle "$UA_WIN_FIREFOX" >/dev/null
  local v_vor v_nach erw
  v_vor="$(q "SELECT coalesce(sum(views),0) FROM public.public_view_counts;")"
  sed 's#^    LOCK TABLE public.public_view_counts IN ACCESS EXCLUSIVE MODE;#&\n    PERFORM pg_sleep(4);#' "$NS_ROLLBACK_FILE" > "$WORK/nl_rb_ns.sql"
  cmp -s "$NS_ROLLBACK_FILE" "$WORK/nl_rb_ns.sql" && { echo "::error::nebenlaeufig 1c: sed greift nicht" >&2; DEVS[2]=$((DEVS[2] + 1)); }
  nebenlaeufig "$WORK/nl_rb_ns.sql"
  v_nach="$(q "SELECT coalesce(sum(views),0) FROM public.public_view_counts;")"
  [[ "$W_RC" == "0" ]] && erw=$((v_vor + 1)) || erw="$v_vor"   # ein Aufruf, der gerade unterwegs ist, darf scheitern (der Client verschluckt das); gelingt er, ist er auch gezaehlt
  [[ "${QUIET:-0}" == "1" ]] || echo "INFO        Schreiber waehrend des Rueckwegs 1c: Exit $W_RC ${W_ERR:0:160}; Summe $v_vor -> $v_nach"
  check R "1c Rueckweg mit gleichzeitigem Schreiber: Rueckweg ohne Abbruch, Summe vorher = nachher, ein erfolgreicher Aufruf ist auch gezaehlt" "0|$erw" "$F_RC|$v_nach"
  psql_stdin < "$NS_FILE" >/dev/null 2>&1 || true
  start_rest
}

# Letzter Schritt (zerstoerend): ohne Tabelle scheitert 1c (Fail-fast), und sein Rueckweg legt die Funktion nicht neu an
ns_ohne_tabelle() {
  psql_stdin < "$NS_ROLLBACK_FILE" >/dev/null; psql_stdin < "$NEW_ROLLBACK_FILE" >/dev/null
  psql_stdin < "$GRANT_ROLLBACK_FILE" >/dev/null; psql_stdin < "$ROLLBACK_FILE" >/dev/null
  schema_dump > "$WORK/schema_ohne.sql"
  check R "1c ohne Tabelle: Fail-fast (Einspielen scheitert, Exit 3) und es bleibt nichts zurueck" "3|" \
    "$(psql_stdin < "$NS_FILE" >/dev/null 2>&1; echo -n "$?|"; schema_dump | diff "$WORK/schema_ohne.sql" - || true)"
  check R "1c Rueckweg ohne Tabelle: laeuft sauber, legt count_public_view nicht neu an, nichts bleibt zurueck" "0||" \
    "$(psql_stdin < "$NS_ROLLBACK_FILE" >/dev/null 2>&1; echo -n "$?|"; echo -n "$(q "SELECT coalesce(to_regprocedure('public.count_public_view(text,text,text,text,boolean)')::text,'');")|"; schema_dump | diff "$WORK/schema_ohne.sql" - || true)"
}

# Mutationen an 1c (Gegenprobe): jede muss in vor_ns oder run_ns_checks mindestens eine Pruefung rot machen
MUTATIONEN_NS=(
  "N1|s/v_views := 0; v_beats := 0; v_short := 0; v_long := 1;/v_views := 0; v_beats := 0; v_short := 1; v_long := 0;/"
  "N2|s/v_views := 0; v_beats := 0; v_short := 1; v_long := 0;/v_views := 1; v_beats := 0; v_short := 1; v_long := 0;/"
  "N3|s/outages_short = c.outages_short + EXCLUDED.outages_short, outages_long = c.outages_long + EXCLUDED.outages_long/outages_short = EXCLUDED.outages_short, outages_long = EXCLUDED.outages_long/"
  "N4|s/CHECK (outages_short >= 0)/CHECK (true)/"
  "N5|s/outages_long integer NOT NULL DEFAULT 0/outages_long integer NOT NULL DEFAULT 1/"
  "N6|s/^    RETURN;\$/    RAISE EXCEPTION 'x';/"
  "N7|s/AND t.deleted_at IS NULL;/;/"
  "N8|s/coalesce(t.is_public, false) AND //"
  "N9|s/TO anon, authenticated, service_role;/TO anon, authenticated, service_role, PUBLIC;/"
  "N10|s/coalesce(p_installiert, false), v_os, v_browser,/coalesce(p_installiert, false), 'sonstige', 'sonstige',/"
  "N11|s/814b327fa1dc1e8e92a03fd7031ff0b8/00000000000000000000000000000000/"
  "N12|s/date_bin('5 minutes', now(), timestamptz '2000-01-01 00:00:00+00')/now()/"
  "N13|/SET LOCAL lock_timeout/d"
  "N14|s/ELSIF p_art = 'stoerung_lang' THEN/ELSIF p_art = 'stoerung_mittel' THEN/"
  "N15|s/ELSIF p_art = 'stoerung_kurz' THEN/ELSIF p_art ILIKE 'stoerung_k%' THEN/"
  "N16|s/AND position('outages_short' IN coalesce(v_src, '')) = 0//"
  "N17|s/IF p_geraet IS NULL OR p_geraet NOT IN ('handy', 'tablet', 'gross') THEN RETURN; END IF;//"
  "N18|s/v_views := 0; v_beats := 1; v_short := 0; v_long := 0;/v_views := 0; v_beats := 1; v_short := 1; v_long := 0;/"
  "N19|s/outages_long integer NOT NULL DEFAULT 0/outages_long integer DEFAULT 0/"
)
# Mutationen am Rueckweg von 1c
MUTATIONEN_RBNS=(
  "N20|s/DROP COLUMN IF EXISTS outages_short, DROP COLUMN IF EXISTS outages_long/DROP COLUMN IF EXISTS outages_short/"
  "N21|s#GRANT EXECUTE ON FUNCTION public.count_public_view(text, text, text, text, boolean) TO anon, authenticated, service_role;##"
  "N23|s#^    LOCK TABLE public.public_view_counts IN ACCESS EXCLUSIVE MODE;#    DELETE FROM public.public_view_counts; &#"
  "N24|s#v_headers := nullif(current_setting('request.headers', true), '');#v_headers := current_setting('request.headers');#"
)

# Stand 003 + 004 + 1b aufbauen, dann 1c mit <Datei> (vor_ns) und die Pruefungen N
ns_aufbauen() { # <1c-Datei>; Rueckgabe 1 = Aufbau scheitert (gilt bei Mutationen als rot)
  install_stack "$TARGET_FILE" "$GRANT_FILE" "$NEW_FILE" || return 1
  NS_USE="$1"
  vor_ns
}

ns_mutation_lauf() { # <id> -- vor_ns und run_ns_checks mit der Mutation (NS_USE), Ergebnis rot/gruen
  local id="$1"
  { QUIET=1 vor_ns; QUIET=1 run_ns_checks; } > "$WORK/run-$id.log" 2>&1 || true
  if [[ "$(total_dev)" -gt 0 ]]; then
    echo "Mutation $id: rot ($(total_dev) Abweichung(en), z. B. $(grep -m1 '^ABWEICHUNG' "$WORK/run-$id.log" || echo '?'))"
  else
    echo "::error::Mutation $id bleibt gruen -- keine Pruefung faengt sie." >&2; failed=1
  fi
}

prepare
case "$MODE" in
  normal)
    apply_target "$TARGET_FILE" "$GRANT_FILE" "-"
    vor_1b
    run_checks
    run_rueckweg
    vor_ns
    run_ns_checks
    run_rueckweg_ns
    ns_ohne_tabelle
    summary
    [[ "$(total_dev)" -eq 0 ]] || { echo "::error::$(total_dev) Abweichung(en)." >&2; exit 1; }
    echo "zuschauer-zaehlung-check: alles gruen."
    ;;
  without-migration)
    apply_target ""
    QUIET=1 run_checks
    summary
    [[ "$(total_dev)" -gt 0 ]] || { echo "::error::ohne Migration nicht rot." >&2; exit 1; }
    echo "zuschauer-zaehlung-check --without-migration: ohne die Migration rot (erwartet)."
    ;;
  without-1b)
    apply_target "$TARGET_FILE" "$GRANT_FILE" "-"
    QUIET=1 run_checks
    summary
    [[ "$(total_dev)" -gt 0 ]] || { echo "::error::ohne Stufe 1b nicht rot." >&2; exit 1; }
    echo "zuschauer-zaehlung-check --without-1b: Stand 003+004 ohne Stufe 1b ist rot (erwartet)."
    ;;
  without-ns)
    apply_target "$TARGET_FILE" "$GRANT_FILE" "$NEW_FILE"
    QUIET=1 run_ns_checks
    summary
    [[ "$(total_dev)" -gt 0 ]] || { echo "::error::ohne Stufe 1c nicht rot." >&2; exit 1; }
    echo "zuschauer-zaehlung-check --without-ns: Stand 003+004+1b ohne Stufe 1c ist rot (erwartet)."
    ;;
  gegenprobe)
    failed=0
    # GEGENPROBE_NUR=ns: nur die Mutationen der Stufe 1c (lokale Abkuerzung; CI und Vorgabe laufen immer alle)
    if [[ "${GEGENPROBE_NUR:-}" != "ns" ]]; then
    for m in "${MUTATIONEN_003[@]}"; do
      id="${m%%|*}"; expr="${m#*|}"
      sed "$expr" "$TARGET_FILE" > "$WORK/mutant.sql"
      if cmp -s "$TARGET_FILE" "$WORK/mutant.sql"; then echo "::error::Mutation $id aendert nichts (sed greift nicht)." >&2; failed=1; continue; fi
      if ! install_stack "$WORK/mutant.sql" "$GRANT_FILE" "$NEW_FILE"; then echo "Mutation $id: $INSTALL_MSG -- gilt als rot"; continue; fi
      mutation_lauf "$id"
    done
    for m in "${MUTATIONEN_1B[@]}"; do
      id="${m%%|*}"; expr="${m#*|}"
      sed "$expr" "$NEW_FILE" > "$WORK/mutant.sql"
      if cmp -s "$NEW_FILE" "$WORK/mutant.sql"; then echo "::error::Mutation $id aendert nichts (sed greift nicht)." >&2; failed=1; continue; fi
      if ! install_stack "$TARGET_FILE" "$GRANT_FILE" "$WORK/mutant.sql"; then echo "Mutation $id: $INSTALL_MSG -- gilt als rot"; continue; fi
      mutation_lauf "$id"
    done
    # Mutationen an 004 (003 und 1b unveraendert): jede muss mindestens eine Pruefung rot machen
    for m in "${MUTATIONEN_004[@]}"; do
      id="${m%%|*}"; expr="${m#*|}"
      sed "$expr" "$GRANT_FILE" > "$WORK/mutant4.sql"
      if cmp -s "$GRANT_FILE" "$WORK/mutant4.sql"; then echo "::error::Mutation $id aendert nichts (sed greift nicht)." >&2; failed=1; continue; fi
      if ! install_stack "$TARGET_FILE" "$WORK/mutant4.sql" "$NEW_FILE"; then echo "Mutation $id: $INSTALL_MSG -- gilt als rot"; continue; fi
      mutation_lauf "$id"
    done
    # Mutationen am Rueckweg von 1b: Stand 003+004+1b original, dann der veraenderte Rueckweg; die Pruefungen R muessen rot werden
    for m in "${MUTATIONEN_RB1B[@]}"; do
      id="${m%%|*}"; expr="${m#*|}"
      sed "$expr" "$NEW_ROLLBACK_FILE" > "$WORK/mutant_rb.sql"
      if cmp -s "$NEW_ROLLBACK_FILE" "$WORK/mutant_rb.sql"; then echo "::error::Mutation $id aendert nichts (sed greift nicht)." >&2; failed=1; continue; fi
      install_stack "$TARGET_FILE" "$GRANT_FILE" "-" || { echo "::error::Grundaufbau fuer $id scheitert." >&2; failed=1; continue; }
      psql_stdin < "$NEW_FILE" >/dev/null; start_rest
      if [[ "$id" == "M42" ]]; then
        QUIET=1 rueckweg_nebenlaeufig "M42" 's#^         GROUP BY tournament_id, window_start, channel, device_class, installed;#& PERFORM pg_sleep(4);#' "$WORK/mutant_rb.sql" > "$WORK/run-$id.log" 2>&1 || true
      else
        QUIET=1 rueckweg_1b "$WORK/mutant_rb.sql" > "$WORK/run-$id.log" 2>&1 || true
      fi
      if [[ "$(total_dev)" -gt 0 ]]; then
        echo "Mutation $id: rot ($(total_dev) Abweichung(en), z. B. $(grep -m1 '^ABWEICHUNG' "$WORK/run-$id.log" || echo '?'))"
      else
        echo "::error::Mutation $id bleibt gruen -- keine Pruefung faengt sie." >&2; failed=1
      fi
    done
    fi
    # Mutationen an 20261127_001 (Stufe 1c): Stand 003+004+1b, dann die veraenderte Migration (vor_ns) und die Pruefungen N
    for m in "${MUTATIONEN_NS[@]}"; do
      id="${m%%|*}"; expr="${m#*|}"
      [[ -z "${GEGENPROBE_ID:-}" || "$id" == "$GEGENPROBE_ID" ]] || continue   # lokale Abkuerzung: nur eine Mutation
      sed "$expr" "$NS_FILE" > "$WORK/mutant_ns.sql"
      if cmp -s "$NS_FILE" "$WORK/mutant_ns.sql"; then echo "::error::Mutation $id aendert nichts (sed greift nicht)." >&2; failed=1; continue; fi
      if ! install_stack "$TARGET_FILE" "$GRANT_FILE" "$NEW_FILE"; then echo "::error::Grundaufbau fuer $id scheitert." >&2; failed=1; continue; fi
      NS_USE="$WORK/mutant_ns.sql"
      ns_mutation_lauf "$id"
    done
    NS_USE="$NS_FILE"
    # Mutationen am Rueckweg von 1c: Stand mit eingespielter 1c, dann der veraenderte Rueckweg; die Pruefungen R muessen rot werden
    for m in "${MUTATIONEN_RBNS[@]}"; do
      id="${m%%|*}"; expr="${m#*|}"
      sed "$expr" "$NS_ROLLBACK_FILE" > "$WORK/mutant_rb_ns.sql"
      if cmp -s "$NS_ROLLBACK_FILE" "$WORK/mutant_rb_ns.sql"; then echo "::error::Mutation $id aendert nichts (sed greift nicht)." >&2; failed=1; continue; fi
      install_stack "$TARGET_FILE" "$GRANT_FILE" "$NEW_FILE" || { echo "::error::Grundaufbau fuer $id scheitert." >&2; failed=1; continue; }
      schema_dump > "$WORK/schema_1b_vor_ns.sql"
      psql_stdin < "$NS_FILE" >/dev/null; schema_dump > "$WORK/schema_ns.sql"; start_rest
      QUIET=1 rueckweg_ns "$WORK/mutant_rb_ns.sql" > "$WORK/run-$id.log" 2>&1 || true
      if [[ "$(total_dev)" -gt 0 ]]; then
        echo "Mutation $id: rot ($(total_dev) Abweichung(en), z. B. $(grep -m1 '^ABWEICHUNG' "$WORK/run-$id.log" || echo '?'))"
      else
        echo "::error::Mutation $id bleibt gruen -- keine Pruefung faengt sie." >&2; failed=1
      fi
    done
    [[ "$failed" -eq 0 ]] || exit 1
    echo "zuschauer-zaehlung-check --gegenprobe: jede Mutation faerbt mindestens eine Pruefung rot."
    ;;
esac
