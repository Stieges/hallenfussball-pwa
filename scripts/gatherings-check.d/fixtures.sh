# shellcheck shell=bash
#
# gatherings-check.d/fixtures.sh — Identitaeten, Testdaten und Hilfen fuer scripts/gatherings-check.sh (per source, vor den
# Pruefungen [0-9]*.sh). Testwerte aus dem Gherkin des Records Veranstaltung (Turnierwochenende 28./29.11., Bergader
# SportARENA). Daten relativ zu „heute“ (Europe/Berlin), damit „steht bevor“ und die Kappung nicht vom Lauftag abhaengen.

U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria-coadmin)"; U_TOM="$(uuid_for user:tom-helfer)"
U_SCREEN="$(uuid_for user:bildschirm)"; U_CLARA="$(uuid_for user:clara-konto)"; U_GRETA="$(uuid_for user:greta-eigenes)"
U_ANJA="$(uuid_for user:anja-anonym)"
ANON_UIDS=" $U_TOM $U_SCREEN $U_ANJA "
T_F2="$(uuid_for tournament:f2)"; T_F1="$(uuid_for tournament:f1)"; T_D="$(uuid_for tournament:d)"
T_E="$(uuid_for tournament:e-abgeschlossen)"; T_TRASH="$(uuid_for tournament:papierkorb)"
T_OHNE="$(uuid_for tournament:ohne-veranstaltung)"; T_OLD="$(uuid_for tournament:vorgestern)"
T_RACE="$(uuid_for tournament:wettlauf)"; T_GRETA="$(uuid_for tournament:greta)"; T_ANJA="$(uuid_for tournament:anja)"
TEAM_W1="$(uuid_for team:tsv-waging-1)"; TEAM_DJK="$(uuid_for team:djk-otting)"
M_F2_1="$(uuid_for match:f2-1)"; M_F2_2="$(uuid_for match:f2-2)"; M_F2_3="$(uuid_for match:f2-3)"
M_OLD_1="$(uuid_for match:vorgestern-1)"; M_E_1="$(uuid_for match:e-1)"
G_NAME="Hallenturniere TSV Waging 28./29.11."

# --- JWT (HS256) je Rolle, wie die App ihn mitschickt ---------------------------------------------------------------
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
jwt() {
  local h p s
  h="$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)"
  p="$(printf '%s' "$1" | b64url)"
  s="$(printf '%s' "$h.$p" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)"
  echo "$h.$p.$s"
}
tok_for() {
  if [[ "$1" == "anon" ]]; then jwt '{"role":"anon","exp":4102444800}'
  elif [[ "$ANON_UIDS" == *" $1 "* ]]; then jwt "{\"role\":\"authenticated\",\"sub\":\"$1\",\"is_anonymous\":true,\"exp\":4102444800}"
  else jwt "{\"role\":\"authenticated\",\"sub\":\"$1\",\"is_anonymous\":false,\"exp\":4102444800}"; fi
}
# rpc <uid|anon> <funktion> <json> -- echte HTTP-Antwort von PostgREST; Status in $WORK/st, Body auf stdout
rpc() {
  local st
  st="$(curl -s -o "$WORK/b" -w '%{http_code}' -X POST "http://127.0.0.1:$REST_PORT/rpc/$2" \
    -H "Authorization: Bearer $(tok_for "$1")" -H 'Content-Type: application/json' --data "$3" || echo "000")"
  echo "$st" > "$WORK/st"
  cat "$WORK/b"
}

# who <uid|anon|super> -- SQL, das die Sitzung auf diese Identitaet stellt (nur innerhalb einer Transaktion)
who() {
  case "$1" in
    super) echo "RESET ROLE; SET LOCAL request.jwt.claim.sub = ''; SET LOCAL request.jwt.claims = '';" ;;
    anon) echo "RESET ROLE; SET LOCAL request.jwt.claim.sub = ''; SET LOCAL request.jwt.claims = ''; SET LOCAL ROLE anon;" ;;
    *)
      local anon=false
      [[ "$ANON_UIDS" == *" $1 "* ]] && anon=true
      echo "RESET ROLE; SET LOCAL request.jwt.claim.sub = '$1';
SET LOCAL request.jwt.claims = '{\"sub\":\"$1\",\"role\":\"authenticated\",\"is_anonymous\":$anon}';
SET LOCAL ROLE authenticated;" ;;
  esac
}
# tx <sql> -- eine nie festgeschriebene Transaktion; Ausgabe nur Zeilen der Form k:<wert> (ohne k:)
tx() { q "BEGIN;
$1
ROLLBACK;" | { grep -E '^k:' || true; } | sed 's/^k://' | paste -sd'|' -; }
# try <sql-ausdruck> -- SQL-Zeile, die 'k:ok:<wert>' oder 'k:err:<SQLSTATE>' ausgibt (Rechte des Aufrufers)
try() { echo "SELECT 'k:' || harness.try(\$q\$$1\$q\$);"; }
run() { echo "SELECT 'k:' || harness.run(\$q\$$1\$q\$);"; }
val() { echo "SELECT 'k:' || coalesce(($1)::text, 'NULL');"; }

setup_helpers() {
  as_admin <<'SQL'
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$f$;
ALTER ROLE authenticator WITH PASSWORD 'postgres';
-- Live traegt auth.users.is_anonymous (GoTrue); dieses Image noch nicht.
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
SQL
  psql_stdin <<'SQL'
CREATE SCHEMA harness;
GRANT USAGE ON SCHEMA harness TO authenticated, anon;
CREATE FUNCTION harness.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v text;
BEGIN
  EXECUTE p_sql INTO v;
  RETURN 'ok:' || coalesce(v, 'NULL');
EXCEPTION WHEN OTHERS THEN
  RETURN 'err:' || SQLSTATE;
END;
$fn$;
CREATE FUNCTION harness.run(p_sql text) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows:' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN 'err:' || SQLSTATE;
END;
$fn$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA harness TO authenticated, anon;
SQL
}

setup_data() {
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       '{}'::jsonb, '{}', now(), now(), u.email IS NULL
FROM (VALUES ('$U_OLLI'::uuid, 'olli@va.test'), ('$U_MARIA'::uuid, 'maria@va.test'), ('$U_CLARA'::uuid, 'clara@va.test'),
             ('$U_GRETA'::uuid, 'greta@va.test'), ('$U_TOM'::uuid, NULL), ('$U_SCREEN'::uuid, NULL),
             ('$U_ANJA'::uuid, NULL)) AS u(id, email);

-- Turniere Ollis; Datum relativ zu heute (Europe/Berlin). F2 und F1 am Tag d+1, D am Tag d+2.
CREATE TEMP TABLE d AS SELECT (now() AT TIME ZONE 'Europe/Berlin')::date AS heute;
INSERT INTO public.tournaments (id, owner_id, title, date, start_time, number_of_teams, number_of_fields, group_phase_duration,
                                location_name, location_city, status, is_public, share_code, config, deleted_at)
SELECT x.id, x.owner, x.title, (SELECT heute FROM d) + x.tag, x.st::time, 2, 1, 10, x.ort, 'Waging am See', 'published',
       x.pub, x.code,
       jsonb_build_object('publishedAt', '2026-11-01T00:00:00.000Z',
                          'contactInfo', jsonb_build_object('name', 'Olli Kontakt', 'phone', '0171 999', 'showPublic', true),
                          'adminNotes', 'Schluessel beim Hausmeister'),
       x.del
FROM (VALUES ('$T_F2'::uuid, '$U_OLLI'::uuid, 'F2-Junioren Hallenturnier', 1, '08:30', 'Bergader SportARENA', true, 'F2JUNI', NULL::timestamptz),
             ('$T_F1'::uuid, '$U_OLLI'::uuid, 'F1-Junioren Hallenturnier', 1, '13:00', 'Bergader SportARENA', true, 'F1JUNI', NULL),
             ('$T_D'::uuid, '$U_OLLI'::uuid, 'D-Junioren Hallenturnier', 2, NULL, 'Bergader SportARENA', false, NULL, NULL),
             ('$T_E'::uuid, '$U_OLLI'::uuid, 'E-Junioren Hallenturnier', -7, '09:00', 'Bergader SportARENA', true, 'EJUNIO', NULL),
             ('$T_TRASH'::uuid, '$U_OLLI'::uuid, 'Probe im Papierkorb', 3, NULL, 'Halle', false, NULL, now()),
             ('$T_OHNE'::uuid, '$U_OLLI'::uuid, 'Hallencup ohne Veranstaltung', 1, '10:00', 'Halle Nord', true, 'OHNE01', NULL),
             ('$T_OLD'::uuid, '$U_OLLI'::uuid, 'G-Junioren vorgestern', -2, '08:30', 'Bergader SportARENA', true, 'GJUNIO', NULL),
             ('$T_RACE'::uuid, '$U_OLLI'::uuid, 'Wettlauf-Turnier', 4, NULL, 'Halle', false, NULL, NULL),
             ('$T_GRETA'::uuid, '$U_GRETA'::uuid, 'Gretas Cup', 1, '09:00', 'Halle Sued', true, 'GRETA1', NULL),
             ('$T_ANJA'::uuid, '$U_ANJA'::uuid, 'Anjas Probe', 1, NULL, 'Halle', false, NULL, NULL)) AS x(id, owner, title, tag, st, ort, pub, code, del);

INSERT INTO public.teams (id, tournament_id, name, contact_name, contact_email)
VALUES ('$TEAM_W1', '$T_F2', 'TSV Waging 1', 'Trainer Wagner', 'wagner@tsv.test'),
       ('$TEAM_DJK', '$T_F2', 'DJK Otting', 'Trainerin Ott', 'ott@djk.test');
-- F2: Spiel 1 08:30 beendet 2:1, Spiel 2 und 3 um 08:50 (letzter Anstoss, zwei Felder) geplant.
INSERT INTO public.matches (id, tournament_id, match_number, round, field, team_a_id, team_b_id, scheduled_start,
                            match_status, score_a, score_b, actual_start)
VALUES ('$M_F2_1', '$T_F2', 1, 1, 1, '$TEAM_W1', '$TEAM_DJK', '08:30', 'finished', 2, 1, now() - interval '3 hours'),
       ('$M_F2_2', '$T_F2', 2, 2, 1, '$TEAM_DJK', '$TEAM_W1', '08:50', 'scheduled', NULL, NULL, NULL),
       ('$M_F2_3', '$T_F2', 3, 2, 2, '$TEAM_W1', '$TEAM_DJK', '08:50', 'scheduled', NULL, NULL, NULL),
       ('$M_OLD_1', '$T_OLD', 1, 1, 1, '$TEAM_W1', '$TEAM_DJK', '08:30', 'running', NULL, NULL, now() - interval '2 days'),
       ('$M_E_1', '$T_E', 1, 1, 1, '$TEAM_W1', '$TEAM_DJK', '09:00', 'finished', 1, 0, now() - interval '7 days');
-- E-Junioren abgeschlossen (Server-Schalter wie finish_tournament).
SET app.lifecycle_write = 'on';
UPDATE public.tournaments SET lifecycle_status = 'finished', finished_at = now() - interval '7 days' WHERE id = '$T_E';
RESET app.lifecycle_write;
-- Maria Co-Admin, Tom Helfer, Bildschirm in F2 (angenommen).
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label)
VALUES ('$T_F2', '$U_MARIA', 'co-admin', now(), NULL), ('$T_F2', '$U_TOM', 'helper', now(), 'Tom'),
       ('$T_F2', '$U_SCREEN', 'screen', now(), 'Hallenrechner');
UPDATE public.tournaments SET config = config || '{"monitors":[{"id":"mon-halle","name":"Hallenmonitor","slides":[]}]}'::jsonb
 WHERE id = '$T_F2';
SQL
}

# Turnierantwort vor der Migration (ohne server_now/version): Vergleich in Kategorie T.
norm_payload() { jq -cS 'del(.server_now, .version)'; }
capture_before() {
  q "SELECT public.public_tournament('F2JUNI');" | norm_payload > "$WORK/vorher_f2_viewer.json"
  q "SELECT public.public_tournament('OHNE01');" | norm_payload > "$WORK/vorher_ohne_viewer.json"
  q "SELECT public.display_tournament('$T_F2', 'mon-halle');" | norm_payload > "$WORK/vorher_f2_screen.json"
}
