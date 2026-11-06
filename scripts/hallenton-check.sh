#!/usr/bin/env bash
#
# hallenton-check.sh — Container-Beweis fuer supabase/migrations/20261121_001_hallenton.sql (Hallenton, Server-Teil;
# Record docs/anforderungen/2026-10-15_hallenton.md). Muster: scripts/monitor-heartbeat-check.sh (Wegwerf-Container
# supabase/postgres, nativ, per DOCKER_PLATFORM ueberschreibbar, Baseline + Migrationen seit Baseline, trap).
#
# Testwerte aus dem Gherkin: Turnierleitung Olli (Eigentuemer), Co-Admin Clara (@HT-022), Helfer Tom (Helfer-Zugang ohne
# Konto = Geraetesitzung, Rolle helper), „Hallenmonitor Halle“ (Geraetesitzung, Rolle screen), Mitarbeiterin Mia (Konto,
# Rolle collaborator), Lea (anonyme Sitzung ohne Rolle), Greta (Konto, nicht eingetragen), Maria (Co-Admin, widerrufen),
# ein Fremder ohne Anmeldung (Rolle anon, @HT-044). Turniere: „Hallencup Nord“ (2 Felder, nicht oeffentlich),
# „Hallencup Sued“ (Olli, Clara nicht eingetragen), „Altturnier“ (Papierkorb). Geraete: „Rechner der Turnierleitung“
# (R), ein zweites Geraet (Z, @HT-015/@HT-026), Toms Handy (H).
#
# Kategorien:
#   F  Fail-fast: die Migration auf der Baseline allein bricht ab und aendert nichts.
#   R  Rollen und Szenario-Zeilen: jede RPC fuer jede Identitaet (erlaubt/abgelehnt/kein EXECUTE), Zuordnen, Abloesen,
#      Ausschalten, Lebenszeichen nur vom zugeordneten Geraet, Alter vom Server, Testton mit 3-s-Sperre und Quittung,
#      Leitung nur mit Steuer, Tonwahl, Papierkorb, Widerruf, Tabellen ohne Direktzugriff, eigener Ton im Storage
#      (Hochladen nur manageScreens, Pfad, hoechstens 10, kein Ueberschreiben, Loeschen, Auflisten), Loeschen nach
#      Turnierende.
#   S  Schema: Funktionen (Definer, search_path, Rechte), Tabellen (RLS, keine Policy, keine Client-Rechte), Bucket,
#      Katalogzaehlung, Rechte-Assertion (vorher die neuen |f, nachher |t), Namensliste = db-drift-check.sh, Zuordnung.
#   W  zweites Einspielen: Exit 0, Schema und Daten wie nach dem ersten.
#   X  Rueckweg: Schema public = vor der Migration (pg_dump identisch), Storage-Policies weg, Bucket weg; danach erneut
#      einspielbar.
#
# Aufrufoptionen:
#   bash scripts/hallenton-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/hallenton-check.sh --without-migration  Gegenprobe: ohne die Migration -> R ROT (Exit 0)
#   bash scripts/hallenton-check.sh --gegenprobe         je Mutation (M1-M12) ein Lauf; Exit 0 NUR, wenn JEDE rot faerbt
#                                                        (GEGENPROBE_NUR="M1 M3" schraenkt ein)
#   bash scripts/hallenton-check.sh --print-rueckweg     Rueckweg ausgeben, ohne Container
#
# Aendert NICHTS an der Produktionsdatenbank und nichts an einem lokalen Supabase-Stack -- eigener Wegwerf-Container,
# wird am Ende entfernt (trap). Harness nur im Container: scripts/lib/hallenton-storage-stub.sql bildet
# storage.buckets/objects nach (das Image bringt das Schema leer mit).
#
set -euo pipefail

MODE="normal"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --without-migration) MODE="without-migration"; shift ;;
    --gegenprobe) MODE="gegenprobe"; shift ;;
    --print-rueckweg) MODE="print-rueckweg"; shift ;;
    *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe, --print-rueckweg)" >&2; exit 2 ;;
  esac
done

POSTGRES_IMAGE="supabase/postgres:17.6.1.063"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261121_001_hallenton.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
STORAGE_STUB="$REPO_ROOT/scripts/lib/hallenton-storage-stub.sql"
CONTAINER_PREFIX="hallenton-check-$$"
CURRENT_CONTAINER=""
NEW_ASSERTIONS="hallenton-tables-rls-no-client-access hallenton-rpcs-definer-authenticated-only hallenton-rpcs-check-permission hallenton-internal-no-client-execute hallenton-heartbeat-fixed-reasons-no-user-agent hallenton-storage-policies-manage-screens-no-update"

rueckweg_sql() {
  cat <<'RW'
-- supabase/rollbacks/20261121_001_hallenton_rollback.sql
-- RUECKWEG zu supabase/migrations/20261121_001_hallenton.sql (Hallenton, Server-Teil). Liegt bewusst NICHT in
-- supabase/migrations (wird nie nachgespielt). Erzeugt mit `bash scripts/hallenton-check.sh --print-rueckweg`; belegt in
-- scripts/hallenton-check.sh (Kategorie X: Schema public danach = Stand vor der Migration, Storage-Policies weg).
-- Vorher: App auf den Stand ohne Hallenton-Client. Wirkung: alle Zuordnungen, Lebenszeichen und die Tonwahl entfallen
-- (der Abpfiff-Ton config.matchCockpitSettings.soundId bleibt). Hochgeladene Dateien bleiben im Bucket; ist er leer,
-- entfaellt er, sonst bleibt er (Hinweis) und Daniel loescht die Dateien im Dashboard.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS hallenton_sounds_insert ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS hallenton_sounds_select ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS hallenton_sounds_delete ON storage.objects';
    BEGIN
      DELETE FROM storage.buckets b
       WHERE b.id = 'hallenton-sounds'
         AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = b.id);
      IF EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = 'hallenton-sounds') THEN
        RAISE NOTICE 'Rueckweg 20261121_001: Bucket hallenton-sounds enthaelt Dateien und bleibt -- im Dashboard leeren und loeschen';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Rueckweg 20261121_001: Bucket hallenton-sounds nicht geloescht (%) -- im Dashboard loeschen', SQLERRM;
    END;
  END IF;
END
$rw$;
DROP FUNCTION IF EXISTS public.hall_sound_object_allowed(text, boolean);
DROP FUNCTION IF EXISTS public.hall_sound_purge_ended();
DROP FUNCTION IF EXISTS public.hall_sound_status(uuid, uuid);
DROP FUNCTION IF EXISTS public.hall_sound_settings_set(uuid, text, text, text, integer[]);
DROP FUNCTION IF EXISTS public.hall_test_tone_ack(uuid, integer, uuid, uuid);
DROP FUNCTION IF EXISTS public.hall_test_tone_request(uuid, integer);
DROP FUNCTION IF EXISTS public.hall_field_lead_heartbeat(uuid, integer, uuid);
DROP FUNCTION IF EXISTS public.hall_speaker_heartbeat(uuid, uuid, integer[], text);
DROP FUNCTION IF EXISTS public.hall_speaker_release(uuid, integer[], uuid);
DROP FUNCTION IF EXISTS public.hall_speaker_assign(uuid, integer[], uuid, text, boolean);
DROP FUNCTION IF EXISTS public.hall_require(uuid, text);
DROP FUNCTION IF EXISTS public.hall_checked_fields(uuid, integer[]);
DROP FUNCTION IF EXISTS public.hall_ms(timestamptz);
DROP TABLE IF EXISTS public.hall_speakers;
DROP TABLE IF EXISTS public.hall_field_leads;
DROP TABLE IF EXISTS public.hall_sound_settings;
COMMIT;
RW
}
if [[ "$MODE" == "print-rueckweg" ]]; then
  rueckweg_sql
  exit 0
fi

[[ -f "$TARGET_FILE" ]] || { echo "::error::$TARGET_NAME fehlt." >&2; exit 1; }

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
NEWER_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
BEFORE=()
AFTER=()
SEEN_TARGET=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if [[ "$(basename "$line")" == "$TARGET_NAME" ]]; then SEEN_TARGET=1
  elif [[ "$SEEN_TARGET" -eq 1 ]]; then AFTER+=("$line")
  else BEFORE+=("$line"); fi
done <<< "$NEWER_RAW"
[[ "$SEEN_TARGET" -eq 1 ]] || { echo "::error::$TARGET_NAME nicht in der Liste 'neuer als Baseline'." >&2; exit 1; }

FERTIG=0
WORK_DIR="$(mktemp -d)"
cleanup() {
  local rc=$?
  [[ -n "$CURRENT_CONTAINER" ]] && docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1
  rm -rf "$WORK_DIR"
  if [[ "$FERTIG" != 1 && "$rc" -eq 0 ]]; then echo "::error::Lauf vor der Schlusswertung abgebrochen." >&2; rc=1; fi
  exit "$rc"
}
trap cleanup EXIT

start_container() {
  CURRENT_CONTAINER="$CONTAINER_PREFIX-$1"
  docker run -d ${DOCKER_PLATFORM:+--platform "$DOCKER_PLATFORM"} --name "$CURRENT_CONTAINER" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 120); do
    if [[ "$(docker logs "$CURRENT_CONTAINER" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
      ready=1; break
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

CATS=(F R S W X)
DEVS=(0 0 0 0 0)
OKS=(0 0 0 0 0)
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
reset_counts() { DEVS=(0 0 0 0 0); OKS=(0 0 0 0 0); }
summary() {
  local i
  echo
  for i in "${!CATS[@]}"; do echo "Kategorie ${CATS[$i]}: ${OKS[$i]} OK, ${DEVS[$i]} Abweichung(en)"; done
}

uuid_for() {
  local h
  h="$(printf '%s' "hallenton-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"; U_CLARA="$(uuid_for user:clara)"; U_MIA="$(uuid_for user:mia)"
U_GRETA="$(uuid_for user:greta)"; U_MARIA="$(uuid_for user:maria)"
U_TOM="$(uuid_for user:tom)"; U_SCREEN="$(uuid_for user:hallenmonitor)"; U_LEA="$(uuid_for user:lea)"
ANON_UIDS=" $U_TOM $U_SCREEN $U_LEA "
T_NORD="$(uuid_for tournament:hallencup-nord)"; T_SUED="$(uuid_for tournament:hallencup-sued)"
T_ALT="$(uuid_for tournament:altturnier)"
D_R="$(uuid_for device:rechner)"; D_Z="$(uuid_for device:zweites-geraet)"; D_H="$(uuid_for device:toms-handy)"
D_X="$(uuid_for device:andere)"
TEST_ID="$(uuid_for test:offen)"
SOUND1="$(uuid_for sound:vereinshupe)"
NAME_R="Rechner der Turnierleitung"

is_anon() { [[ "$ANON_UIDS" == *" $1 "* ]] && echo true || echo false; }
claims_sql() {
  [[ -z "$1" ]] && return 0
  echo "SET LOCAL request.jwt.claim.sub = '$1'; SET LOCAL request.jwt.claims = '{\"sub\":\"$1\",\"role\":\"authenticated\",\"is_anonymous\":$(is_anon "$1")}';"
}
# probe <uid|leer(=anon)> <vorbereitung> <aktion (Zeilen "r:...")> <pruef-SQL> -> "<ergebnis>|<pruefwert>"
probe() {
  local uid="$1" setup="$2" action="$3" check_sql="$4" role="authenticated" out res msg chk
  [[ -z "$uid" ]] && role="anon"
  set +e
  out="$(docker exec -i "$CURRENT_CONTAINER" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 <<SQL 2>&1
\\set VERBOSITY verbose
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
# Ergebnis kurz: 42501 der Rechtepruefung = abgelehnt; fehlendes EXECUTE = kein-execute; 22023 = ungueltig.
short() {
  local r="${1%%|*}" c="${1#*|}"
  case "$r" in
    "fehler:42501: hallenton: not allowed"*) r="abgelehnt" ;;
    "fehler:42501: permission denied for function"*) r="kein-execute" ;;
    "fehler:42501: permission denied for table"*) r="kein-tabellenrecht" ;;
    "fehler:42501: new row violates row-level security policy"*) r="rls" ;;
    "fehler:22023:"*) r="ungueltig" ;;
    "fehler:23514:"*) r="pruefregel" ;;
  esac
  echo "$r|$c"
}

# Aufrufe (Status aus der jsonb-Antwort)
ASSIGN() { echo "SELECT 'r:' || (public.hall_speaker_assign('$1'::uuid, '{$2}'::int[], '$3'::uuid, '$4', ${5:-false}) ->> 'status');"; }
RELEASE() { echo "SELECT 'r:' || (public.hall_speaker_release('$1'::uuid, '{$2}'::int[], '$3'::uuid) ->> 'status');"; }
HB() { echo "SELECT 'r:' || (public.hall_speaker_heartbeat('$1'::uuid, '$2'::uuid, '{$3}'::int[], '$4') ->> 'status');"; }
HB_FIELDS() { echo "SELECT 'r:' || (SELECT string_agg((f ->> 'field') || '=' || (f ->> 'status'), ';') FROM jsonb_array_elements(public.hall_speaker_heartbeat('$1'::uuid, '$2'::uuid, '{$3}'::int[], '$4') -> 'fields') f);"; }
LEAD() { echo "SELECT 'r:' || (public.hall_field_lead_heartbeat('$1'::uuid, $2, '$3'::uuid) ->> 'status');"; }
TEST() { echo "SELECT 'r:' || (public.hall_test_tone_request('$1'::uuid, $2) ->> 'status');"; }
ACK() { echo "SELECT 'r:' || (public.hall_test_tone_ack('$1'::uuid, $2, '$3'::uuid, '$4'::uuid) ->> 'status');"; }
SETTINGS() { echo "SELECT 'r:' || (public.hall_sound_settings_set('$1'::uuid, $2, $3, $4, '{$5}'::int[]) ->> 'status');"; }
STATUS_KIND() { echo "SELECT 'r:' || CASE WHEN r ? 'leads' THEN 'voll' ELSE 'knapp' END || ':' || coalesce((SELECT string_agg(s::text, ';') FROM jsonb_array_elements(r -> 'speakers') s), '-') FROM (SELECT public.hall_sound_status('$1'::uuid, '$D_R'::uuid) AS r) x;"; }
STATUS_HAS() { echo "SELECT 'r:' || CASE WHEN r ? 'leads' THEN 'voll' ELSE 'knapp' END FROM (SELECT public.hall_sound_status('$1'::uuid, '$D_R'::uuid) AS r) x;"; }

SPEAKER_R="INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name, state, last_seen)
VALUES ('$T_NORD', 1, '$D_R', '$NAME_R', 'not_activated', now() - interval '4 seconds');"
SPEAKER_R_TEST="$SPEAKER_R
UPDATE public.hall_speakers SET test_id = '$TEST_ID', test_requested_at = now() - interval '1 second' WHERE tournament_id = '$T_NORD' AND field_id = 1;"
HOLDER() { # HOLDER <uid> <device> -> Steuer von Feld 1 im Hallencup Nord
  echo "INSERT INTO public.field_control (tournament_id, field, epoch, holder_user_id, holder_device_id, holder_device_label)
VALUES ('$T_NORD', 1, 1, '$1', '$2', 'Handy') ON CONFLICT (tournament_id, field) DO UPDATE SET holder_user_id = EXCLUDED.holder_user_id, holder_device_id = EXCLUDED.holder_device_id, epoch = public.field_control.epoch + 1;"
}
ROW_R() { echo "SELECT coalesce((SELECT device_id::text || ':' || coalesce(state, 'NULL') FROM public.hall_speakers WHERE tournament_id = '$T_NORD' AND field_id = ${1:-1}), 'keine')"; }
REVOKED="DELETE FROM public.tournament_collaborators WHERE id = '$(uuid_for membership:maria)';
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at, declined_at, label)
VALUES ('$(uuid_for membership:maria)', '$T_NORD', '$U_MARIA', 'co-admin', now(), now(), 'Maria');"
OBJ() { echo "$T_NORD/$(uuid_for "obj:$1").${2:-mp3}"; }
UPLOAD() { echo "WITH i AS (INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('hallenton-sounds', '$1', auth.uid()) RETURNING 1) SELECT 'r:' || count(*) FROM i;"; }
TEN_FILES="INSERT INTO storage.objects (bucket_id, name) SELECT 'hallenton-sounds', '$T_NORD/' || md5('f' || g)::uuid || '.mp3' FROM generate_series(1, 10) g;"
ONE_FILE="INSERT INTO storage.objects (bucket_id, name) VALUES ('hallenton-sounds', '$T_NORD/$SOUND1.mp3');"

setup_data() {
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       CASE WHEN u.email IS NULL THEN '{"provider":"anonymous","providers":["anonymous"]}'::jsonb
            ELSE '{"provider":"email","providers":["email"]}'::jsonb END, '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@hallenton.test'), ('$U_CLARA'::uuid, 'clara@hallenton.test'),
             ('$U_MIA'::uuid, 'mia@hallenton.test'), ('$U_GRETA'::uuid, 'greta@hallenton.test'),
             ('$U_MARIA'::uuid, 'maria@hallenton.test'),
             ('$U_TOM'::uuid, NULL), ('$U_SCREEN'::uuid, NULL), ('$U_LEA'::uuid, NULL)) AS u(id, email);
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, number_of_fields, group_phase_duration, is_public, config, deleted_at) VALUES
  ('$T_NORD', '$U_OLLI', 'Hallencup Nord', '2026-11-28', 4, 2, 10, false, '{"publishedAt":"2026-10-20T00:00:00.000Z"}'::jsonb, NULL),
  ('$T_SUED', '$U_OLLI', 'Hallencup Sued', '2026-11-29', 4, 1, 10, false, '{"publishedAt":"2026-10-20T00:00:00.000Z"}'::jsonb, NULL),
  ('$T_ALT', '$U_OLLI', 'Altturnier', '2026-01-10', 4, 1, 10, false, '{}'::jsonb, now());
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at, label) VALUES
  ('$(uuid_for membership:clara)', '$T_NORD', '$U_CLARA', 'co-admin', now(), 'Clara'),
  ('$(uuid_for membership:mia)', '$T_NORD', '$U_MIA', 'collaborator', now(), 'Mia'),
  ('$(uuid_for membership:maria)', '$T_NORD', '$U_MARIA', 'co-admin', now(), 'Maria'),
  ('$(uuid_for membership:tom)', '$T_NORD', '$U_TOM', 'helper', now(), 'Tom'),
  ('$(uuid_for membership:screen)', '$T_NORD', '$U_SCREEN', 'screen', now(), 'Hallenmonitor Halle');
INSERT INTO public.teams (id, tournament_id, name) VALUES
  ('$(uuid_for team:fc-nord)', '$T_NORD', 'FC Nord'), ('$(uuid_for team:sv-sued)', '$T_NORD', 'SV Süd');
SQL
}

# Identitaeten: Name:uid:erwartet-verwalten:erwartet-leitung:erwartet-stand
IDS=(
  "Olli (Turnierleitung):$U_OLLI:ok:ok:voll"
  "Clara (Co-Admin):$U_CLARA:ok:ok:voll"
  "Mia (Mitarbeiterin):$U_MIA:abgelehnt:ok:knapp"
  "Tom (Helfer-Zugang):$U_TOM:abgelehnt:ok:knapp"
  "Hallenmonitor Halle (Bildschirm):$U_SCREEN:abgelehnt:abgelehnt:abgelehnt"
  "Lea (anonym, ohne Rolle):$U_LEA:abgelehnt:abgelehnt:abgelehnt"
  "Greta (Konto, fremd):$U_GRETA:abgelehnt:abgelehnt:abgelehnt"
  "Maria (Co-Admin, widerrufen):$U_MARIA:abgelehnt:abgelehnt:abgelehnt"
  "Fremder ohne Anmeldung (anon)::kein-execute:kein-execute:kein-execute"
)
pick() { [[ "$1" == ok ]] && echo "$2" || echo "$1|$3"; }

# ---------------------------------------------------------------------------------------------------------
run_probes() {
  local entry name uid e_manage e_lead e_status setup
  # --- @HT-022 / @HT-044: jede RPC fuer jede Identitaet --------------------------------------------------
  for entry in "${IDS[@]}"; do
    IFS=: read -r name uid e_manage e_lead e_status <<<"$entry"
    setup=""; [[ "$uid" == "$U_MARIA" ]] && setup="$REVOKED"
    check R "@HT-022 $name bestimmt einen Lautsprecher fuer Feld 2" "$(pick "$e_manage" "assigned|$D_Z" "keine")" \
      "$(short "$(probe "$uid" "$setup" "$(ASSIGN "$T_NORD" 2 "$D_Z" "Zweites Geraet")" "SELECT coalesce((SELECT device_id::text FROM public.hall_speakers WHERE tournament_id = '$T_NORD' AND field_id = 2), 'keine')")")"
    check R "@HT-044 $name meldet „bereit“ fuer den Rechner (Feld 1)" "$(pick "$e_manage" "ok|$D_R:ready" "$D_R:not_activated")" \
      "$(short "$(probe "$uid" "$setup $SPEAKER_R" "$(HB "$T_NORD" "$D_R" 1 ready)" "$(ROW_R 1)")")"
    check R "@HT-044 $name loest den Testton fuer Feld 1 aus" "$(pick "$e_manage" "requested|ja" "nein")" \
      "$(short "$(probe "$uid" "$setup $SPEAKER_R" "$(TEST "$T_NORD" 1)" "SELECT CASE WHEN test_id IS NULL THEN 'nein' ELSE 'ja' END FROM public.hall_speakers WHERE tournament_id = '$T_NORD' AND field_id = 1")")"
    check R "@HT-017 $name quittiert den Testton (Geraet R)" "$(pick "$e_manage" "acked|gespielt" "offen")" \
      "$(short "$(probe "$uid" "$setup $SPEAKER_R_TEST" "$(ACK "$T_NORD" 1 "$D_R" "$TEST_ID")" "SELECT CASE WHEN test_played_at IS NULL THEN 'offen' ELSE 'gespielt' END FROM public.hall_speakers WHERE tournament_id = '$T_NORD' AND field_id = 1")")"
    check R "@HT-022 $name waehlt den Ton (Halbzeit horn-2, Ton bei Tor Feld 1)" "$(pick "$e_manage" "saved|horn-2:{1}" "keine")" \
      "$(short "$(probe "$uid" "$setup" "$(SETTINGS "$T_NORD" "'horn-2'" NULL NULL 1)" "SELECT coalesce((SELECT halftime_sound || ':' || goal_tone_fields::text FROM public.hall_sound_settings WHERE tournament_id = '$T_NORD'), 'keine')")")"
    check R "@HT-038 $name schaltet den Rechner fuer Feld 1 aus" "$(pick "$e_manage" "released|keine" "$D_R:not_activated")" \
      "$(short "$(probe "$uid" "$setup $SPEAKER_R" "$(RELEASE "$T_NORD" 1 "$D_R")" "$(ROW_R 1)")")"
    check R "@HT-034 $name sendet das Lebenszeichen der Leitung (haelt die Steuer von Feld 1)" "$(pick "$e_lead" "ok|1" "0")" \
      "$(short "$(probe "$uid" "$setup ${uid:+$(HOLDER "$uid" "$D_H")}" "$(LEAD "$T_NORD" 1 "$D_H")" "SELECT count(*) FROM public.hall_field_leads WHERE tournament_id = '$T_NORD'")")"
    check R "@HT-039 $name liest den Stand" "$([[ "$e_status" == voll || "$e_status" == knapp ]] && echo "$e_status|1" || echo "$e_status|1")" \
      "$(short "$(probe "$uid" "$setup $SPEAKER_R" "$(STATUS_HAS "$T_NORD")" "1")")"
  done
  # Upload je Identitaet (Storage-Policy)
  for entry in "${IDS[@]}"; do
    IFS=: read -r name uid e_manage e_lead e_status <<<"$entry"
    setup=""; [[ "$uid" == "$U_MARIA" ]] && setup="$REVOKED"
    local exp_up="rls|0"
    [[ "$e_manage" == ok ]] && exp_up="1|1"
    check R "@HT-022 $name laedt einen eigenen Ton hoch" "$exp_up" \
      "$(short "$(probe "$uid" "$setup" "$(UPLOAD "$(OBJ upload)")" "SELECT count(*) FROM storage.objects WHERE bucket_id = 'hallenton-sounds'")")"
    local exp_list="0|1"
    [[ "$e_manage" == ok ]] && exp_list="1|1"
    check R "Auflisten: $name sieht die Dateien des Turniers" "$exp_list" \
      "$(short "$(probe "$uid" "$setup $ONE_FILE" "SELECT 'r:' || count(*) FROM storage.objects WHERE bucket_id = 'hallenton-sounds';" "1")")"
    local exp_del="0|1"
    [[ "$e_manage" == ok ]] && exp_del="1|0"
    check R "Loeschen: $name loescht einen eigenen Ton" "$exp_del" \
      "$(short "$(probe "$uid" "$setup $ONE_FILE" "WITH d AS (DELETE FROM storage.objects WHERE bucket_id = 'hallenton-sounds' RETURNING 1) SELECT 'r:' || count(*) FROM d;" "SELECT count(*) FROM storage.objects")")"
  done

  # --- Stand: Inhalte je Sicht (Helfer ohne Geraetename) --------------------------------------------------
  check R "@HT-001 Olli liest: Feld 1 „Rechner der Turnierleitung“, isThisDevice, Zustand, Alter 4000 ms vom Server" \
    "voll:{\"test\": null, \"ageMs\": 4000, \"field\": 1, \"state\": \"not_activated\", \"deviceName\": \"$NAME_R\", \"isThisDevice\": true}|1" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "SELECT 'r:voll:' || (s - 'assignedAt' - 'lastSeen')::text FROM jsonb_array_elements(public.hall_sound_status('$T_NORD'::uuid, '$D_R'::uuid) -> 'speakers') s;" "1")"
  check R "@HT-040 Tom (Helfer) liest nur Zustand und Alter, ohne Geraetename" \
    "knapp:{\"ageMs\": 4000, \"field\": 1, \"state\": \"not_activated\"}|1" \
    "$(probe "$U_TOM" "$SPEAKER_R" "$(STATUS_KIND "$T_NORD")" "1")"
  check R "@HT-016 Feld 2 ohne Lautsprecher fehlt in der Liste (neutral)" "1|1" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "SELECT 'r:' || jsonb_array_length(public.hall_sound_status('$T_NORD'::uuid) -> 'speakers');" "1")"
  check R "@HT-038 Z. 1 Turnier ohne Lautsprecher: leere Liste, Vorbelegung der Tonwahl horn-1" "0:horn-1:[]|1" \
    "$(probe "$U_OLLI" "" "SELECT 'r:' || jsonb_array_length(r -> 'speakers') || ':' || (r -> 'settings' ->> 'halftimeSound') || ':' || (r -> 'settings' ->> 'goalToneFields') FROM (SELECT public.hall_sound_status('$T_NORD'::uuid) r) x;" "1")"
  check R "@HT-042 Alter rechnet der Server: zuletzt vor 20 s -> ageMs 20000, lastSeen = Serverzeit" "20000:ja|1" \
    "$(probe "$U_OLLI" "$SPEAKER_R UPDATE public.hall_speakers SET last_seen = now() - interval '20 seconds';" \
       "SELECT 'r:' || (s ->> 'ageMs') || ':' || CASE WHEN (s ->> 'lastSeen')::bigint = floor(extract(epoch FROM now() - interval '20 seconds') * 1000)::bigint THEN 'ja' ELSE 'nein' END FROM jsonb_array_elements(public.hall_sound_status('$T_NORD'::uuid) -> 'speakers') s;" "1")"

  # --- Zuordnen, Abloesen, Ausschalten (@HT-001, @HT-002, @HT-015, @HT-026, @HT-038) ------------------------
  check R "@HT-001 Olli bestimmt den Rechner fuer Feld 1 -> Zeile mit Name, noch kein Lebenszeichen" "assigned|$D_R:$NAME_R:NULL:NULL" \
    "$(probe "$U_OLLI" "" "$(ASSIGN "$T_NORD" 1 "$D_R" "$NAME_R")" "SELECT device_id || ':' || device_name || ':' || coalesce(state, 'NULL') || ':' || coalesce(last_seen::text, 'NULL') FROM public.hall_speakers WHERE tournament_id = '$T_NORD'")"
  check R "@HT-001 danach „bereit“: Lebenszeichen ready -> Feld 1 ok, last_seen = Serverzeit" "assigned,1=ok|ready:jetzt" \
    "$(probe "$U_OLLI" "" "$(ASSIGN "$T_NORD" 1 "$D_R" "$NAME_R")
$(HB_FIELDS "$T_NORD" "$D_R" 1 ready)" "SELECT state || ':' || CASE WHEN last_seen = now() THEN 'jetzt' ELSE 'anders' END FROM public.hall_speakers WHERE tournament_id = '$T_NORD'")"
  check R "@HT-002 ein Geraet fuer Feld 1 und 2: zwei Zeilen, Lebenszeichen fuer beide ok" "assigned,1=ok;2=ok|2:ready,ready" \
    "$(probe "$U_OLLI" "" "$(ASSIGN "$T_NORD" "2,1,2" "$D_R" "$NAME_R")
$(HB_FIELDS "$T_NORD" "$D_R" "1,2" ready)" "SELECT count(*) || ':' || string_agg(state, ',' ORDER BY field_id) FROM public.hall_speakers WHERE tournament_id = '$T_NORD' AND device_id = '$D_R'")"
  check R "@HT-015 zweites Geraet fuer Feld 1 ohne Bestaetigen -> occupied mit Name des Rechners, nichts geaendert" \
    "occupied:$NAME_R|$D_R:not_activated" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "SELECT 'r:' || (r ->> 'status') || ':' || (r -> 'fields' -> 0 ->> 'deviceName') FROM (SELECT public.hall_speaker_assign('$T_NORD'::uuid, '{1}'::int[], '$D_Z'::uuid, 'Zweites Geraet', false) r) x;" "$(ROW_R 1)")"
  check R "@HT-015 nach Bestaetigen loest das zweite Geraet ab (Zustand beginnt neu)" "assigned|$D_Z:NULL" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "$(ASSIGN "$T_NORD" 1 "$D_Z" "Zweites Geraet" true)" "$(ROW_R 1)")"
  check R "@HT-015 der abgeloeste Rechner meldet „bereit“ -> superseded, Zeile des neuen Geraets unveraendert" "1=superseded|$D_Z:NULL" \
    "$(probe "$U_OLLI" "$SPEAKER_R UPDATE public.hall_speakers SET device_id = '$D_Z', device_name = 'Zweites Geraet', state = NULL, last_seen = NULL;" "$(HB_FIELDS "$T_NORD" "$D_R" 1 ready)" "$(ROW_R 1)")"
  check R "@HT-015 der abgeloeste Rechner quittiert einen Testton -> superseded" "superseded|offen" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R_TEST UPDATE public.hall_speakers SET device_id = '$D_Z';" "$(ACK "$T_NORD" 1 "$D_R" "$TEST_ID")" "SELECT CASE WHEN test_played_at IS NULL THEN 'offen' ELSE 'gespielt' END FROM public.hall_speakers WHERE field_id = 1")")"
  check R "@HT-015 kein Zurueckholen: erneut umlegen auf dem Rechner = wieder Bestaetigen noetig (occupied)" "occupied|$D_Z:NULL" \
    "$(probe "$U_OLLI" "$SPEAKER_R UPDATE public.hall_speakers SET device_id = '$D_Z', state = NULL, last_seen = NULL;" "$(ASSIGN "$T_NORD" 1 "$D_R" "$NAME_R")" "$(ROW_R 1)")"
  check R "@HT-026 Clara auf einem zweiten Rechner: dasselbe Recht wie Olli (assigned mit Bestaetigen)" "assigned|$D_Z:NULL" \
    "$(probe "$U_CLARA" "$SPEAKER_R" "$(ASSIGN "$T_NORD" 1 "$D_Z" "Rechner 2" true)" "$(ROW_R 1)")"
  check R "dasselbe Geraet erneut (Name geaendert): Zustand bleibt, Name neu" "assigned|$D_R:not_activated:Laptop Halle" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "$(ASSIGN "$T_NORD" 1 "$D_R" "  Laptop Halle  ")" "SELECT device_id || ':' || state || ':' || device_name FROM public.hall_speakers WHERE field_id = 1")"
  check R "@HT-038 Z. 2 Schalter aus auf einem anderen Geraet entfernt den Rechner nicht" "released|$D_R:not_activated" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "$(RELEASE "$T_NORD" 1 "$D_Z")" "$(ROW_R 1)")"
  check R "Lebenszeichen fuer ein Feld ohne Lautsprecher -> unassigned, keine Zeile" "2=unassigned|0" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "$(HB_FIELDS "$T_NORD" "$D_R" 2 ready)" "SELECT count(*) FROM public.hall_speakers WHERE field_id = 2")"
  # Gegenbeispiele Werte
  check R "gegen-Geraetename 61 Zeichen -> ungueltig" "ungueltig|0" \
    "$(short "$(probe "$U_OLLI" "" "$(ASSIGN "$T_NORD" 1 "$D_R" "$(printf 'x%.0s' $(seq 1 61))")" "SELECT count(*) FROM public.hall_speakers")")"
  check R "Geraetename 60 Zeichen -> assigned" "assigned|60" \
    "$(short "$(probe "$U_OLLI" "" "$(ASSIGN "$T_NORD" 1 "$D_R" "$(printf 'x%.0s' $(seq 1 60))")" "SELECT max(char_length(device_name)) FROM public.hall_speakers")")"
  check R "gegen-Geraetename nur Leerzeichen -> ungueltig" "ungueltig|0" \
    "$(short "$(probe "$U_OLLI" "" "$(ASSIGN "$T_NORD" 1 "$D_R" "   ")" "SELECT count(*) FROM public.hall_speakers")")"
  check R "gegen-Feld 3 (Turnier hat 2 Felder) -> ungueltig" "ungueltig|0" \
    "$(short "$(probe "$U_OLLI" "" "$(ASSIGN "$T_NORD" 3 "$D_R" "$NAME_R")" "SELECT count(*) FROM public.hall_speakers")")"
  check R "gegen-keine Felder -> ungueltig" "ungueltig|0" \
    "$(short "$(probe "$U_OLLI" "" "$(ASSIGN "$T_NORD" "" "$D_R" "$NAME_R")" "SELECT count(*) FROM public.hall_speakers")")"
  check R "gegen-Geraete-Kennung NULL -> ungueltig" "ungueltig|0" \
    "$(short "$(probe "$U_OLLI" "" "SELECT 'r:' || (public.hall_speaker_assign('$T_NORD'::uuid, '{1}'::int[], NULL, 'x') ->> 'status');" "SELECT count(*) FROM public.hall_speakers")")"
  check R "gegen-Papierkorb: Olli im geloeschten Altturnier -> abgelehnt" "abgelehnt|0" \
    "$(short "$(probe "$U_OLLI" "" "$(ASSIGN "$T_ALT" 1 "$D_R" "$NAME_R")" "SELECT count(*) FROM public.hall_speakers")")"
  check R "gegen-fremdes Turnier: Clara im „Hallencup Sued“ -> abgelehnt" "abgelehnt|0" \
    "$(short "$(probe "$U_CLARA" "" "$(ASSIGN "$T_SUED" 1 "$D_R" "$NAME_R")" "SELECT count(*) FROM public.hall_speakers")")"
  check R "gegen-unbekanntes Turnier -> abgelehnt (wie „darf nicht“)" "abgelehnt|0" \
    "$(short "$(probe "$U_OLLI" "" "$(ASSIGN "$(uuid_for tournament:gibt-es-nicht)" 1 "$D_R" "$NAME_R")" "SELECT count(*) FROM public.hall_speakers")")"

  # --- Lebenszeichen: Gruende aus fester Liste (@HT-039) ----------------------------------------------------
  local st
  for st in ready not_activated background slept custom_sound_failed volume_zero; do
    check R "@HT-039 Lebenszeichen mit Grund $st -> gespeichert" "ok|$D_R:$st" \
      "$(probe "$U_OLLI" "$SPEAKER_R" "$(HB "$T_NORD" "$D_R" 1 "$st")" "$(ROW_R 1)")"
  done
  check R "gegen-Grund 'maybe' -> ungueltig, Zustand unveraendert" "ungueltig|$D_R:not_activated" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R" "$(HB "$T_NORD" "$D_R" 1 maybe)" "$(ROW_R 1)")")"
  check R "gegen-Grund 'no_connection' (zeigt nur das Geraet selbst) -> ungueltig" "ungueltig|$D_R:not_activated" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R" "$(HB "$T_NORD" "$D_R" 1 no_connection)" "$(ROW_R 1)")")"
  check R "gegen-direkt: Pruefregel der Tabelle haelt auch ohne Funktion (Superuser schreibt 'maybe')" "pruefregel|1" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R" "RESET ROLE; UPDATE public.hall_speakers SET state = 'maybe';" "1")")"

  # --- Testton (@HT-017) --------------------------------------------------------------------------------------
  local tt t1 t2
  tt="$(probe "$U_OLLI" "$SPEAKER_R" "SELECT 'r:' || (public.hall_test_tone_request('$T_NORD'::uuid, 1) ->> 'testId');
SELECT 'r:' || (f -> 'test' ->> 'testId') || ':' || (f -> 'test' ->> 'ageMs') FROM jsonb_array_elements(public.hall_speaker_heartbeat('$T_NORD'::uuid, '$D_R'::uuid, '{1}'::int[], 'ready') -> 'fields') f;" \
    "SELECT test_id FROM public.hall_speakers WHERE field_id = 1")"
  t1="$(cut -d, -f1 <<<"${tt%%|*}")"; t2="$(cut -d, -f2 <<<"${tt%%|*}")"
  check R "@HT-017 Testton -> Kennung; das Lebenszeichen des Rechners bringt dieselbe Kennung mit, Alter 0 (Serverzeit)" \
    "gleich:0:gespeichert" "$([[ -n "$t1" && "$t2" == "$t1:0" ]] && echo gleich || echo "anders($tt)"):${t2##*:}:$([[ "${tt#*|}" == "$t1" ]] && echo gespeichert || echo nein)"
  check R "@HT-017 zweiter Testton innerhalb 3 s -> too_soon, Kennung bleibt" "too_soon:2000|$TEST_ID" \
    "$(probe "$U_OLLI" "$SPEAKER_R_TEST" "SELECT 'r:' || (r ->> 'status') || ':' || (r ->> 'retryInMs') FROM (SELECT public.hall_test_tone_request('$T_NORD'::uuid, 1) r) x;" "SELECT test_id FROM public.hall_speakers WHERE field_id = 1")"
  check R "@HT-017 nach mehr als 3 s wieder erlaubt -> requested, neue Kennung" "requested|neu" \
    "$(probe "$U_OLLI" "$SPEAKER_R_TEST UPDATE public.hall_speakers SET test_requested_at = now() - interval '3.001 seconds';" "$(TEST "$T_NORD" 1)" "SELECT CASE WHEN test_id <> '$TEST_ID' AND test_requested_at = now() AND test_played_at IS NULL THEN 'neu' ELSE 'alt' END FROM public.hall_speakers WHERE field_id = 1")"
  check R "@HT-017 Z. 5 laufendes Spiel auf Feld 1 sperrt den Testton am Server nicht" "requested|ja" \
    "$(probe "$U_OLLI" "$SPEAKER_R INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, match_status) VALUES ('$(uuid_for match:11)', '$T_NORD', 1, 1, '$(uuid_for team:fc-nord)', '$(uuid_for team:sv-sued)', 11, 'running');" "$(TEST "$T_NORD" 1)" "SELECT CASE WHEN test_id IS NULL THEN 'nein' ELSE 'ja' END FROM public.hall_speakers WHERE field_id = 1")"
  check R "@HT-017 Feld ohne Lautsprecher -> no_speaker" "no_speaker|0" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "$(TEST "$T_NORD" 2)" "SELECT count(*) FROM public.hall_speakers WHERE field_id = 2")"
  check R "@HT-017 Quittung des Rechners -> acked, gespielt zur Serverzeit; zweite Quittung aendert nichts" "acked,acked|jetzt" \
    "$(probe "$U_OLLI" "$SPEAKER_R_TEST" "$(ACK "$T_NORD" 1 "$D_R" "$TEST_ID")
$(ACK "$T_NORD" 1 "$D_R" "$TEST_ID")" "SELECT CASE WHEN test_played_at = now() THEN 'jetzt' ELSE coalesce(test_played_at::text, 'NULL') END FROM public.hall_speakers WHERE field_id = 1")"
  check R "@HT-017 Quittung mit fremder Kennung -> unknown_test" "unknown_test|offen" \
    "$(probe "$U_OLLI" "$SPEAKER_R_TEST" "$(ACK "$T_NORD" 1 "$D_R" "$D_X")" "SELECT CASE WHEN test_played_at IS NULL THEN 'offen' ELSE 'gespielt' END FROM public.hall_speakers WHERE field_id = 1")"
  check R "@HT-017 nach der Quittung bringt das Lebenszeichen keinen offenen Testton mehr" "1=ok:null|1" \
    "$(probe "$U_OLLI" "$SPEAKER_R_TEST UPDATE public.hall_speakers SET test_played_at = now();" "SELECT 'r:' || (f ->> 'field') || '=' || (f ->> 'status') || ':' || coalesce(f ->> 'test', 'null') FROM jsonb_array_elements(public.hall_speaker_heartbeat('$T_NORD'::uuid, '$D_R'::uuid, '{1}'::int[], 'ready') -> 'fields') f;" "1")"
  check R "@HT-017 Stand zeigt die Quittung („gespielt 14:02“ = playedAt vom Server)" "ja|1" \
    "$(probe "$U_OLLI" "$SPEAKER_R_TEST UPDATE public.hall_speakers SET test_played_at = now();" "SELECT 'r:' || CASE WHEN (s -> 'test' ->> 'playedAt')::bigint = floor(extract(epoch FROM now()) * 1000)::bigint THEN 'ja' ELSE 'nein' END FROM jsonb_array_elements(public.hall_sound_status('$T_NORD'::uuid) -> 'speakers') s;" "1")"

  # --- Leitung je Feld (@HT-034/@HT-035): nur mit Steuer ---------------------------------------------------------
  check R "@HT-034 Tom haelt die Steuer von Feld 1 mit seinem Handy -> ok, Zeile zur Serverzeit" "ok|$D_H:jetzt" \
    "$(probe "$U_TOM" "$(HOLDER "$U_TOM" "$D_H")" "$(LEAD "$T_NORD" 1 "$D_H")" "SELECT device_id || ':' || CASE WHEN last_seen = now() THEN 'jetzt' ELSE 'anders' END FROM public.hall_field_leads")"
  check R "gegen-Tom mit anderer Geraete-Kennung -> not_controller, keine Zeile" "not_controller|0" \
    "$(probe "$U_TOM" "$(HOLDER "$U_TOM" "$D_H")" "$(LEAD "$T_NORD" 1 "$D_X")" "SELECT count(*) FROM public.hall_field_leads")"
  check R "gegen-Tom fuer Feld 2 (Steuer hat er nicht) -> not_controller" "not_controller|0" \
    "$(probe "$U_TOM" "$(HOLDER "$U_TOM" "$D_H")" "$(LEAD "$T_NORD" 2 "$D_H")" "SELECT count(*) FROM public.hall_field_leads")"
  check R "gegen-Mia ohne Steuer (Tom haelt Feld 1) -> not_controller" "not_controller|0" \
    "$(probe "$U_MIA" "$(HOLDER "$U_TOM" "$D_H")" "$(LEAD "$T_NORD" 1 "$D_H")" "SELECT count(*) FROM public.hall_field_leads")"
  check R "@HT-040 Antwort an Tom bringt den Lautsprecher des Felds mit (Zustand, Alter vom Server)" "ok:not_activated:4000|1" \
    "$(probe "$U_TOM" "$(HOLDER "$U_TOM" "$D_H") $SPEAKER_R" "SELECT 'r:' || (r ->> 'status') || ':' || (r -> 'speaker' ->> 'state') || ':' || (r -> 'speaker' ->> 'ageMs') FROM (SELECT public.hall_field_lead_heartbeat('$T_NORD'::uuid, 1, '$D_H'::uuid) r) x;" "1")"
  check R "@HT-035 Lautsprecher sieht das Alter der Leitung (vor 16 s -> 16000)" "16000|1" \
    "$(probe "$U_OLLI" "$SPEAKER_R INSERT INTO public.hall_field_leads (tournament_id, field_id, device_id, last_seen) VALUES ('$T_NORD', 1, '$D_H', now() - interval '16 seconds');" "SELECT 'r:' || (f -> 'lead' ->> 'ageMs') FROM jsonb_array_elements(public.hall_speaker_heartbeat('$T_NORD'::uuid, '$D_R'::uuid, '{1}'::int[], 'ready') -> 'fields') f;" "1")"

  # --- Tonwahl (@HT-025, @HT-027, @HT-028) ---------------------------------------------------------------------
  check R "@HT-027 eigener Ton fuer Halbzeit und Abpfiff (Pfad im eigenen Turnier) -> saved" "saved|custom:ja" \
    "$(probe "$U_OLLI" "" "$(SETTINGS "$T_NORD" "'custom'" "'$T_NORD/$SOUND1.mp3'" "'$T_NORD/$SOUND1.wav'" "")" "SELECT halftime_sound || ':' || CASE WHEN end_custom_path = '$T_NORD/$SOUND1.wav' THEN 'ja' ELSE 'nein' END FROM public.hall_sound_settings")"
  check R "gegen-Pfad eines fremden Turniers -> ungueltig" "ungueltig|0" \
    "$(short "$(probe "$U_OLLI" "" "$(SETTINGS "$T_NORD" "'custom'" "'$T_SUED/$SOUND1.mp3'" NULL "")" "SELECT count(*) FROM public.hall_sound_settings")")"
  check R "gegen-Pfad .ogg -> ungueltig" "ungueltig|0" \
    "$(short "$(probe "$U_OLLI" "" "$(SETTINGS "$T_NORD" "'horn-1'" NULL "'$T_NORD/$SOUND1.ogg'" "")" "SELECT count(*) FROM public.hall_sound_settings")")"
  check R "gegen-'custom' ohne Pfad -> ungueltig" "ungueltig|0" \
    "$(short "$(probe "$U_OLLI" "" "$(SETTINGS "$T_NORD" "'custom'" NULL NULL "")" "SELECT count(*) FROM public.hall_sound_settings")")"
  check R "gegen-Ton 'horn-9' -> ungueltig" "ungueltig|0" \
    "$(short "$(probe "$U_OLLI" "" "$(SETTINGS "$T_NORD" "'horn-9'" NULL NULL "")" "SELECT count(*) FROM public.hall_sound_settings")")"
  check R "gegen-Ton bei Tor fuer Feld 3 -> ungueltig" "ungueltig|0" \
    "$(short "$(probe "$U_OLLI" "" "$(SETTINGS "$T_NORD" "'horn-1'" NULL NULL 3)" "SELECT count(*) FROM public.hall_sound_settings")")"
  check R "@HT-025 Tonwahl im Stand (fuer alle Lautsprecher des Turniers)" "horn-2:[1, 2]|1" \
    "$(probe "$U_OLLI" "INSERT INTO public.hall_sound_settings (tournament_id, halftime_sound, goal_tone_fields) VALUES ('$T_NORD', 'horn-2', '{1,2}');" "SELECT 'r:' || (r -> 'settings' ->> 'halftimeSound') || ':' || (r -> 'settings' ->> 'goalToneFields') FROM (SELECT public.hall_sound_status('$T_NORD'::uuid) r) x;" "1")"

  # --- Direkter Tabellenzugriff ---------------------------------------------------------------------------------
  check R "gegen-direkt: Olli schreibt ohne Funktion in hall_speakers -> kein Tabellenrecht" "kein-tabellenrecht|0" \
    "$(short "$(probe "$U_OLLI" "" "INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name) VALUES ('$T_NORD', 1, '$D_R', 'x');" "SELECT count(*) FROM public.hall_speakers")")"
  check R "gegen-direkt: Fremder (anon) liest hall_speakers -> kein Tabellenrecht" "kein-tabellenrecht|1" \
    "$(short "$(probe "" "$SPEAKER_R" "SELECT 'r:' || count(*) FROM public.hall_speakers;" "1")")"
  check R "gegen-direkt: Tom liest hall_field_leads -> kein Tabellenrecht" "kein-tabellenrecht|1" \
    "$(short "$(probe "$U_TOM" "" "SELECT 'r:' || count(*) FROM public.hall_field_leads;" "1")")"
  check R "gegen-direkt: Clara aendert hall_sound_settings ohne Funktion -> kein Tabellenrecht" "kein-tabellenrecht|0" \
    "$(short "$(probe "$U_CLARA" "" "INSERT INTO public.hall_sound_settings (tournament_id) VALUES ('$T_NORD');" "SELECT count(*) FROM public.hall_sound_settings")")"
  check R "gegen-Loeschen nach Turnierende per Client: Olli ruft hall_sound_purge_ended -> kein EXECUTE" "kein-execute|1" \
    "$(short "$(probe "$U_OLLI" "" "SELECT 'r:' || public.hall_sound_purge_ended();" "1")")"

  # --- Eigener Ton im Storage ------------------------------------------------------------------------------------
  check R "@HT-027 Olli laedt <tid>/<uuid>.wav hoch" "1|1" \
    "$(short "$(probe "$U_OLLI" "" "$(UPLOAD "$(OBJ wav wav)")" "SELECT count(*) FROM storage.objects")")"
  check R "@HT-028 gegen-.ogg -> abgelehnt (RLS)" "rls|0" \
    "$(short "$(probe "$U_OLLI" "" "$(UPLOAD "$(OBJ ogg ogg)")" "SELECT count(*) FROM storage.objects")")"
  check R "gegen-Name ohne uuid (vereinshupe.mp3) -> abgelehnt (RLS)" "rls|0" \
    "$(short "$(probe "$U_OLLI" "" "$(UPLOAD "$T_NORD/vereinshupe.mp3")" "SELECT count(*) FROM storage.objects")")"
  check R "gegen-Grossbuchstaben in der uuid -> abgelehnt (RLS)" "rls|0" \
    "$(short "$(probe "$U_OLLI" "" "$(UPLOAD "$(tr 'a-f' 'A-F' <<<"$(OBJ gross)")")" "SELECT count(*) FROM storage.objects")")"
  check R "gegen-Unterordner <tid>/x/<uuid>.mp3 -> abgelehnt (RLS)" "rls|0" \
    "$(short "$(probe "$U_OLLI" "" "$(UPLOAD "$T_NORD/x/$SOUND1.mp3")" "SELECT count(*) FROM storage.objects")")"
  check R "gegen-Clara in den Ordner des „Hallencup Sued“ -> abgelehnt (RLS)" "rls|0" \
    "$(short "$(probe "$U_CLARA" "" "$(UPLOAD "$T_SUED/$SOUND1.mp3")" "SELECT count(*) FROM storage.objects")")"
  check R "gegen-anderer Bucket mit gueltigem Namen -> abgelehnt (RLS)" "rls|0" \
    "$(short "$(probe "$U_OLLI" "INSERT INTO storage.buckets (id, name) VALUES ('anderes', 'anderes');" "WITH i AS (INSERT INTO storage.objects (bucket_id, name) VALUES ('anderes', '$(OBJ anders)') RETURNING 1) SELECT 'r:' || count(*) FROM i;" "SELECT count(*) FROM storage.objects")")"
  check R "begrenzte Anzahl: 10 Dateien vorhanden, die 11. -> abgelehnt (RLS)" "rls|10" \
    "$(short "$(probe "$U_OLLI" "$TEN_FILES" "$(UPLOAD "$(OBJ elf)")" "SELECT count(*) FROM storage.objects")")"
  check R "begrenzte Anzahl: 9 Dateien vorhanden, die 10. -> erlaubt" "1|10" \
    "$(short "$(probe "$U_OLLI" "$TEN_FILES DELETE FROM storage.objects WHERE name = '$T_NORD/' || md5('f1')::uuid || '.mp3';" "$(UPLOAD "$(OBJ zehn)")" "SELECT count(*) FROM storage.objects")")"
  check R "begrenzte Anzahl gilt je Turnier: 10 im „Hallencup Nord“, Olli laedt im „Hallencup Sued“ hoch" "1|11" \
    "$(short "$(probe "$U_OLLI" "$TEN_FILES" "$(UPLOAD "$T_SUED/$SOUND1.mp3")" "SELECT count(*) FROM storage.objects")")"
  check R "kein Ueberschreiben: Olli aendert eine Datei (UPDATE) -> 0 Zeilen" "0|NULL" \
    "$(probe "$U_OLLI" "$ONE_FILE" "WITH u AS (UPDATE storage.objects SET metadata = '{\"x\":1}' RETURNING 1) SELECT 'r:' || count(*) FROM u;" "SELECT metadata FROM storage.objects")"
  check R "kein Ueberschreiben: Olli laedt denselben Namen mit upsert hoch -> abgelehnt" "abgelehnt-upsert|NULL" \
    "$(probe "$U_OLLI" "$ONE_FILE" "INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('hallenton-sounds', '$T_NORD/$SOUND1.mp3', '{\"x\":1}') ON CONFLICT (bucket_id, name) DO UPDATE SET metadata = EXCLUDED.metadata;" "SELECT metadata FROM storage.objects" | sed -E 's/^fehler:42501: new row violates row-level security policy.*\|/abgelehnt-upsert|/')"
  check R "kein Ueberschreiben: derselbe Name ohne upsert -> doppelter Schluessel" "doppelt|1" \
    "$(probe "$U_OLLI" "$ONE_FILE" "$(UPLOAD "$T_NORD/$SOUND1.mp3")" "SELECT count(*) FROM storage.objects" | sed -E 's/^fehler:23505:.*\|/doppelt|/')"
  check R "Bucket: oeffentlich lesbar ueber den Namen, 1 MB, MP3/WAV" "true|1048576|{audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave,audio/vnd.wave}" \
    "$(q "SELECT public || '|' || file_size_limit || '|' || allowed_mime_types::text FROM storage.buckets WHERE id = 'hallenton-sounds';")"

  # --- Loeschen nach Turnierende (DSGVO) -------------------------------------------------------------------------
  check R "Loeschen nach Turnierende: Nord seit 2 Tagen beendet -> Zeilen weg, Sued (laeuft) bleibt, Tonwahl bleibt" "2|0:1:1" \
    "$(probe "$U_OLLI" "$SPEAKER_R
INSERT INTO public.hall_field_leads (tournament_id, field_id, device_id) VALUES ('$T_NORD', 1, '$D_H');
INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name) VALUES ('$T_SUED', 1, '$D_Z', 'Sued');
INSERT INTO public.hall_sound_settings (tournament_id) VALUES ('$T_NORD');
SET LOCAL app.lifecycle_write = 'on';
UPDATE public.tournaments SET lifecycle_status = 'finished', finished_at = now() - interval '2 days' WHERE id = '$T_NORD';
RESET app.lifecycle_write;" \
      "RESET ROLE; SELECT 'r:' || public.hall_sound_purge_ended();" \
      "SELECT ((SELECT count(*) FROM public.hall_speakers WHERE tournament_id = '$T_NORD') + (SELECT count(*) FROM public.hall_field_leads)) || ':' || (SELECT count(*) FROM public.hall_speakers WHERE tournament_id = '$T_SUED') || ':' || (SELECT count(*) FROM public.hall_sound_settings)")"
  check R "Loeschen nach Turnierende: erst seit 2 Stunden beendet -> bleibt" "0|1" \
    "$(probe "$U_OLLI" "$SPEAKER_R SET LOCAL app.lifecycle_write = 'on'; UPDATE public.tournaments SET lifecycle_status = 'finished', finished_at = now() - interval '2 hours' WHERE id = '$T_NORD'; RESET app.lifecycle_write;" \
      "RESET ROLE; SELECT 'r:' || public.hall_sound_purge_ended();" "SELECT count(*) FROM public.hall_speakers")"
}

# ---------------------------------------------------------------------------------------------------------
after_assertions() {
  awk -v pat="    $1)" '$0 == pat {f = 1; next} f && /echo "/ {sub(/^[^"]*"/, ""); sub(/".*$/, ""); print; exit} f && /;;/ {exit}' \
    "$REPO_ROOT/scripts/db-drift-check.sh"
}
run_assertions() { # <erwartet t|f fuer die neuen Zeilen>
  local priv names_sql names_sh a later="" f want="$1"
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  for f in ${AFTER[@]+"${AFTER[@]}"}; do later="$later $(after_assertions "$(basename "$f")")"; done
  for a in $NEW_ASSERTIONS; do later="$later $a"; done
  check S "Rechte-Assertion: keine fremde Zeile |f" "" "$(grep -v '|t$' <<<"$priv" | grep -vE "^($(echo $later | tr ' ' '|'))\\|" || true)"
  for a in $NEW_ASSERTIONS; do
    check S "Rechte-Assertion: $a |$want" "$a|$want" "$(grep -E "^$a\|" <<<"$priv" || true)"
  done
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
  check S "Drift-Check-Zuordnung: pending_assertions_for nennt fuer $TARGET_NAME genau die neuen Namen" "$NEW_ASSERTIONS" "$(after_assertions "$TARGET_NAME")"
}
FN_STATE_SQL="SELECT string_agg(p.proname || ':' || p.prosecdef || ':' || coalesce(p.proconfig::text, '-') || ':' || has_function_privilege('anon', p.oid, 'EXECUTE') || ':' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || ':' || has_function_privilege('service_role', p.oid, 'EXECUTE') || ':' || (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0))::text, ' # ' ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'hall\\_%';"
FN_STATE_EXP="hall_checked_fields:false:{\"search_path=public, pg_temp\"}:false:false:false:false # hall_field_lead_heartbeat:true:{\"search_path=public, pg_temp\"}:false:true:false:false # hall_ms:false:{\"search_path=public, pg_temp\"}:false:false:false:false # hall_require:false:{\"search_path=public, pg_temp\"}:false:false:false:false # hall_sound_object_allowed:true:{\"search_path=public, pg_temp\"}:false:true:false:false # hall_sound_purge_ended:true:{\"search_path=public, pg_temp\"}:false:false:false:false # hall_sound_settings_set:true:{\"search_path=public, pg_temp\"}:false:true:false:false # hall_sound_status:true:{\"search_path=public, pg_temp\"}:false:true:false:false # hall_speaker_assign:true:{\"search_path=public, pg_temp\"}:false:true:false:false # hall_speaker_heartbeat:true:{\"search_path=public, pg_temp\"}:false:true:false:false # hall_speaker_release:true:{\"search_path=public, pg_temp\"}:false:true:false:false # hall_test_tone_ack:true:{\"search_path=public, pg_temp\"}:false:true:false:false # hall_test_tone_request:true:{\"search_path=public, pg_temp\"}:false:true:false:false"
TABLE_STATE_SQL="SELECT string_agg(c.relname || ':' || c.relrowsecurity || ':' || (SELECT count(*) FROM pg_policy pol WHERE pol.polrelid = c.oid) || ':' || has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE') || ':' || has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE') || ':' || has_table_privilege('ci_schema_reader', c.oid, 'SELECT') || ':' || has_table_privilege('ci_schema_reader', c.oid, 'INSERT'), ' # ' ORDER BY c.relname) FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relname LIKE 'hall\\_%' AND c.relkind = 'r';"
STORAGE_POL_SQL="SELECT coalesce(string_agg(policyname || '|' || cmd || '|' || roles::text, ' # ' ORDER BY policyname), 'keine') FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';"
DATA_SQL="SELECT (SELECT count(*) FROM public.hall_speakers) || ':' || (SELECT count(*) FROM public.hall_field_leads) || ':' || (SELECT count(*) FROM public.hall_sound_settings) || ':' || (SELECT count(*) FROM storage.buckets) || ':' || (SELECT count(*) FROM storage.objects);"

apply_before() {
  local f
  echo "Storage-Nachbau + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  docker exec -i -e PGPASSWORD=postgres -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -h 127.0.0.1 -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -q < "$STORAGE_STUB"
  for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done
  setup_data
}

# ---------------------------------------------------------------------------------------------------------
if [[ "$MODE" == "gegenprobe" ]]; then
  # Jede Mutation: Rueckweg, Mutante einspielen, Zeilen + Assertions -> muss rot sein.
  MUTATIONS=(
    "M1|Lebenszeichen ohne Geraete-Pruefung (abgeloestes Geraet meldet „bereit“)|   WHERE s.tournament_id = p_tournament_id AND s.field_id = ANY (v_fields) AND s.device_id = p_device_id;\n\n  SELECT jsonb_agg|   WHERE s.tournament_id = p_tournament_id AND s.field_id = ANY (v_fields);\n\n  SELECT jsonb_agg"
    "M2|Zuordnen mit writeMatchData statt manageScreens (Helfer bestimmt den Lautsprecher)|  PERFORM public.hall_require(p_tournament_id, 'manageScreens');\n  IF p_device_id IS NULL OR char_length(v_name)|  PERFORM public.hall_require(p_tournament_id, 'writeMatchData');\n  IF p_device_id IS NULL OR char_length(v_name)"
    "M3|Testton behaelt EXECUTE fuer PUBLIC (anon erreicht die Funktion)|REVOKE ALL ON FUNCTION public.hall_test_tone_request(uuid, integer) FROM PUBLIC, anon, service_role;\n|"
    "M4|keine 3-s-Sperre beim Testton|  c_min_gap constant interval := interval '3 seconds';|  c_min_gap constant interval := interval '0 seconds';"
    "M5|Lebenszeichen der Leitung ohne Steuer-Pruefung|                    AND fc.holder_user_id = auth.uid() AND fc.holder_device_id = p_device_id) THEN|                    AND true) THEN"
    "M6|Grund nicht aus fester Liste in der Funktion (Tabelle meldet 23514 statt 22023)|     OR p_state IS NULL\n     OR p_state NOT IN ('ready', 'not_activated', 'background', 'slept', 'custom_sound_failed', 'volume_zero') THEN|     OR p_state IS NULL THEN"
    "M7|Helfer bekommt den vollen Stand (Geraetename, Testton, Tonwahl)|  IF NOT v_full THEN\n    RETURN|  IF false THEN\n    RETURN"
    "M8|Hochladen ohne Recht-Pruefung (nur Bucket)|    WITH CHECK (bucket_id = 'hallenton-sounds' AND public.hall_sound_object_allowed(name, true))|    WITH CHECK (bucket_id = 'hallenton-sounds')"
    "M9|11 statt 10 Dateien je Turnier|  c_max_files constant integer := 10;|  c_max_files constant integer := 11;"
    "M10|Abloesen ohne Rueckfrage (occupied entfaellt)|  IF v_occupied IS NOT NULL AND NOT coalesce(p_replace, false) THEN|  IF false THEN"
    "M11|Papierkorb-Pruefung weg|     OR NOT EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = p_tournament_id AND t.deleted_at IS NULL)\n     OR NOT public.has_tournament_permission(p_tournament_id, p_permission) THEN|     OR NOT public.has_tournament_permission(p_tournament_id, p_permission) THEN"
    "M12|Quittung ohne Geraete-Pruefung|  IF NOT FOUND OR v_row.device_id <> p_device_id THEN|  IF NOT FOUND THEN"
  )
  if [[ -n "${GEGENPROBE_NUR:-}" ]]; then
    SEL=()
    for mut in "${MUTATIONS[@]}"; do [[ " $GEGENPROBE_NUR " == *" ${mut%%|*} "* ]] && SEL+=("$mut"); done
    MUTATIONS=("${SEL[@]}")
  fi
  start_container gegenprobe
  psql_stdin < "$BASELINE_FILE"
  apply_before
  psql_stdin < "$TARGET_FILE"
  RED_TOTAL=0
  for mut in "${MUTATIONS[@]}"; do
    IFS='|' read -r mid mtext mfrom mto <<<"$mut"
    mutated="$WORK_DIR/$mid.sql"
    python3 - "$TARGET_FILE" "$mutated" "$mfrom" "$mto" <<'PY' || { echo "::error::Mutation $mid nicht anwendbar"; exit 1; }
import sys
src, dst = sys.argv[1], sys.argv[2]
frm = sys.argv[3].replace('\\n', '\n')
to = sys.argv[4].replace('\\n', '\n')
text = open(src, encoding='utf-8').read()
if text.count(frm) != 1:
    sys.exit(f"Mutation: Stelle nicht genau einmal gefunden: {frm!r} ({text.count(frm)}x)")
open(dst, 'w', encoding='utf-8').write(text.replace(frm, to))
PY
    rueckweg_sql | psql_stdin
    psql_stdin < "$mutated"
    reset_counts
    echo "--- GEGENPROBE $mid: $mtext ---"
    run_probes >"$WORK_DIR/$mid.out"
    run_assertions t >>"$WORK_DIR/$mid.out"
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "GEGENPROBE $mid: rot ($(total_dev) Abweichung(en)) -- wie verlangt"
      grep -m3 '^ABWEICHUNG' "$WORK_DIR/$mid.out" | sed 's/^/    /'
      RED_TOTAL=$((RED_TOTAL + 1))
    else
      echo "::error::GEGENPROBE $mid blieb gruen (zahnlos)"
    fi
  done
  rueckweg_sql | psql_stdin
  echo
  echo "Gegenprobe: $RED_TOTAL von ${#MUTATIONS[@]} Mutationen rot."
  FERTIG=1
  [[ "$RED_TOTAL" -eq "${#MUTATIONS[@]}" ]]
  exit $?
fi

start_container "$MODE"
echo "Baseline einspielen..." >&2
psql_stdin < "$BASELINE_FILE"

if [[ "$MODE" == "without-migration" ]]; then
  apply_before
  run_probes
  summary
  R_DEV="${DEVS[$(cat_index R)]}"
  FERTIG=1
  if [[ "$R_DEV" -gt 0 ]]; then
    echo "Ohne Migration: R rot ($R_DEV) -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (R=$R_DEV muss > 0 sein)."
  exit 1
fi

# --- F: Fail-fast -----------------------------------------------------------------------------------------
DUMP_PRE="$(schema_dump)"
set +e; F_OUT="$(psql_stdin < "$TARGET_FILE" 2>&1)"; F_RC=$?; set -e
check F "Migration auf der Baseline allein: bricht ab mit Hinweis" "abbruch|ja" \
  "$([[ "$F_RC" -ne 0 ]] && echo abbruch || echo "lief($F_RC)")|$([[ "$F_OUT" == *"20261121_001_hallenton: has_tournament_permission/is_real_account fehlen"* ]] && echo ja || echo "nein: $F_OUT")"
check F "Migration auf der Baseline allein: Schema unveraendert" "identisch" "$([[ "$(schema_dump)" == "$DUMP_PRE" ]] && echo identisch || echo verschieden)"

apply_before

# --- S vorher ---------------------------------------------------------------------------------------------
run_assertions f
DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
STORAGE_POL_BEFORE="$(q "$STORAGE_POL_SQL")"
check S "vorher: keine Policy auf storage.objects (Nachbau)" "keine" "$STORAGE_POL_BEFORE"
echo "Ziel: $TARGET_NAME" >&2
psql_stdin < "$TARGET_FILE"

# --- S nachher --------------------------------------------------------------------------------------------
check S "Funktionen: 13 hall_*, RPCs Definer + nur authenticated, Hilfen ohne Client-EXECUTE, nirgends PUBLIC" "$FN_STATE_EXP" "$(q "$FN_STATE_SQL")"
check S "Tabellen: RLS an, keine Policy, kein Recht fuer anon/authenticated, ci_schema_reader nur SELECT" \
  "hall_field_leads:true:0:false:false:true:false # hall_sound_settings:true:0:false:false:true:false # hall_speakers:true:0:false:false:true:false" "$(q "$TABLE_STATE_SQL")"
check S "Storage-Policies: insert/select/delete fuer authenticated, kein UPDATE" \
  "hallenton_sounds_delete|DELETE|{authenticated} # hallenton_sounds_insert|INSERT|{authenticated} # hallenton_sounds_select|SELECT|{authenticated}" "$(q "$STORAGE_POL_SQL")"
check S "Pruefregel Zustand: genau die sechs Gruende" \
  "CHECK (((state IS NULL) OR (state = ANY (ARRAY['ready'::text, 'not_activated'::text, 'background'::text, 'slept'::text, 'custom_sound_failed'::text, 'volume_zero'::text]))))" \
  "$(q "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'hall_speakers_state_check';")"
check S "keine Spalte fuer Browser-Kennzeichen" "0" "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name LIKE 'hall\\_%' AND column_name IN ('user_agent', 'ip', 'ip_address');")"
check S "Realtime: keine der neuen Tabellen in supabase_realtime (kein Kanal, @HT-044)" "0" \
  "$(q "SELECT count(*) FROM pg_publication_tables WHERE schemaname = 'public' AND tablename LIKE 'hall\\_%';")"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim_exp in tables:3 rls_tables:3 policies:0 functions:13 triggers:0; do
  dim="${dim_exp%%:*}"
  check S "Katalogzaehlung $dim: Zuwachs ${dim_exp#*:}" "${dim_exp#*:}" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
run_assertions t

run_probes

# --- W: zweites Einspielen --------------------------------------------------------------------------------
psql_stdin <<SQL
INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name, state, last_seen) VALUES ('$T_NORD', 1, '$D_R', '$NAME_R', 'ready', now());
INSERT INTO public.hall_sound_settings (tournament_id, halftime_sound) VALUES ('$T_NORD', 'horn-3');
INSERT INTO storage.objects (bucket_id, name) VALUES ('hallenton-sounds', '$T_NORD/$SOUND1.mp3');
SQL
W_DATA="$(q "$DATA_SQL")"
set +e; psql_stdin < "$TARGET_FILE" >/dev/null 2>&1; W_RC=$?; set -e
check W "zweites Einspielen: Exit 0, Schema wie nach dem ersten, Daten gleich" "0|identisch|gleich" \
  "$W_RC|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)|$([[ "$(q "$DATA_SQL")" == "$W_DATA" ]] && echo gleich || echo verschieden)"
check W "nach dem zweiten Einspielen: Funktionen und Storage-Policies gleich" "$FN_STATE_EXP|3" \
  "$(q "$FN_STATE_SQL")|$(q "SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE 'hallenton\\_%';")"

# --- X: Rueckweg ------------------------------------------------------------------------------------------
check X "Rueckweg-Datei supabase/rollbacks/20261121_001_hallenton_rollback.sql = --print-rueckweg" "identisch" \
  "$([[ "$(cat "$REPO_ROOT/supabase/rollbacks/20261121_001_hallenton_rollback.sql" 2>/dev/null)" == "$(rueckweg_sql)" ]] && echo identisch || echo verschieden)"
set +e; X_OUT="$(rueckweg_sql | docker exec -i "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q 2>&1)"; X_RC=$?; set -e
check X "Rueckweg mit Datei im Bucket: laeuft, Bucket bleibt mit Hinweis" "0|ja|1" \
  "$X_RC|$([[ "$X_OUT" == *"Bucket hallenton-sounds enthaelt Dateien und bleibt"* ]] && echo ja || echo "nein: $X_OUT")|$(q "SELECT count(*) FROM storage.buckets WHERE id = 'hallenton-sounds';")"
check X "nach dem Rueckweg: Schema public = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$(schema_dump)" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
[[ "$(schema_dump)" == "$DUMP_BEFORE" ]] || { diff <(echo "$DUMP_BEFORE") <(schema_dump) | head -40 || true; }
check X "nach dem Rueckweg: Storage-Policies weg" "$STORAGE_POL_BEFORE" "$(q "$STORAGE_POL_SQL")"
psql_stdin <<'SQL'
DELETE FROM storage.objects WHERE bucket_id = 'hallenton-sounds';
SQL
psql_stdin < "$TARGET_FILE"
check X "danach erneut einspielbar (Schema = erstes Einspielen)" "identisch" "$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"
rueckweg_sql | psql_stdin
check X "Rueckweg mit leerem Bucket: Bucket entfaellt" "0" "$(q "SELECT count(*) FROM storage.buckets WHERE id = 'hallenton-sounds';")"
psql_stdin < "$TARGET_FILE"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f"
  echo "OK    spaetere Migration laeuft: $(basename "$f")" >&2
done

summary
echo
echo "Ergebnis: $(total_dev) Abweichung(en)."
FERTIG=1
[[ "$(total_dev)" -eq 0 ]]
