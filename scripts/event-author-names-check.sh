#!/usr/bin/env bash
#
# event-author-names-check.sh — Container-Beweis fuer supabase/migrations/20261028_006_event_author_names.sql
# (UR, Befund C-EREIGNIS-OHNE-URHEBER). Muster: scripts/guard-all-matches-check.sh (Wegwerf-Container
# supabase/postgres, Baseline + Migrationen seit Baseline, Aufraeumen per trap) und scripts/match-kit-check.sh
# (spaetere Migrationen erst nach dem Rueckweg, A5).
#
# Testwerte aus dem Gherkin: @FU-080 Spiel 9 geplant, Olli traegt 3:1 ein -> "Ergebnis eingetragen von Olli";
# @FU-082 Spiel 7 endete 2:1, eine Korrektur auf 2:2 -> "... von <Name> geaendert (jetzt 2:2)"; @FU-065
# Turnierleitung (Olli) und Helfer (Tom) sehen die Konto-Angabe, Trainer/Zuschauer/oeffentliche Ansicht nicht.
# Alle Eintraege entstehen ueber append_match_events (echter Weg, keine Direkt-Inserts in match_event_authors).
#
# Kategorien:
#   N  Namen: Eigentuemer -> profiles.display_name; Mitglied -> tournament_collaborators.label, sonst
#      display_name; Leerzeichen -> NULL; geloeschtes Konto -> Zeile bleibt, Name/Rolle NULL; widerrufene
#      Mitgliedschaft behaelt den Namen an alten Eintraegen.
#   R  Rechte (@FU-065): Olli, Maria, Tom lesen; Trainer, Viewer, Nicht-Mitglied -> 0 Zeilen; anon und
#      service_role -> kein EXECUTE (42501); Papierkorb, unbekanntes Spiel, widerrufener Helfer -> 0 Zeilen.
#   S  Schema: Funktion SECURITY DEFINER, STABLE, search_path; Rechte-Assertion (alle Zeilen |t, die 2 neuen
#      da), Namensliste = db-drift-check.sh, Katalogzaehlung (Funktionen +1, sonst 0), Bestand unveraendert.
#   W  zweites Einspielen (idempotent).  X  Rueckweg laut Kopfkommentar -> Schema = vor der Migration.
#
# Aufrufoptionen:
#   bash scripts/event-author-names-check.sh                     normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/event-author-names-check.sh --without-migration Gegenprobe: ohne 20261028_006 -> N und R muessen
#                                                                ROT sein (Exit 0 nur dann)
#   bash scripts/event-author-names-check.sh --gegenprobe        je Lauf eine Mutation der Migration; Exit 0 NUR,
#                                                                wenn JEDE Mutation mindestens eine Pruefung rot
#                                                                faerbt:
#     M1 Rechtepruefung has_tournament_permission(..., 'writeMatchData') entfernt -> R (Trainer sieht Namen) rot
#     M2 label ignoriert (nur display_name) -> N (maria.k statt Maria) rot
#     M3 Papierkorb-Bedingung (deleted_at IS NULL) entfernt -> R (Papierkorb) rot
#     M4 EXECUTE auch fuer anon -> R (anon) und S (Assertion) rot
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container,
# wird am Ende entfernt (trap). Harness-Hilfen liegen im Schema "harness" (nicht im Dump von public).
#
set -euo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe)" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie guard-all-matches-check.sh
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261028_006_event_author_names.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
CONTAINER_PREFIX="event-author-names-check-$$"
CURRENT_CONTAINER=""

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

cleanup() { [[ -n "$CURRENT_CONTAINER" ]] && docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

start_container() {
  CURRENT_CONTAINER="$CONTAINER_PREFIX-$1"
  docker run -d --name "$CURRENT_CONTAINER" -e POSTGRES_PASSWORD=postgres -p 5432 "$POSTGRES_IMAGE" >/dev/null
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
CATS=(N R S W X)
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

uuid_for() {
  local h
  h="$(printf '%s' "event-author-names-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_TOM="$(uuid_for user:tom)"
U_KIM="$(uuid_for user:kim)"; U_LEA="$(uuid_for user:lea)"; U_UDO="$(uuid_for user:udo)"
U_TRAINER="$(uuid_for user:trainer)"; U_VIEWER="$(uuid_for user:viewer)"; U_STRANGER="$(uuid_for user:stranger)"
T="$(uuid_for tournament:live-cup)"; T_OTHER="$(uuid_for tournament:fremd)"; T_TRASH="$(uuid_for tournament:papierkorb)"
SG_MITTE="$(uuid_for team:sg-mitte)"; VFB_UFER="$(uuid_for team:vfb-ufer)"
FC_NORD="$(uuid_for team:fc-nord)"; SV_SUED="$(uuid_for team:sv-sued)"
OTHER_A="$(uuid_for team:fremd-a)"; OTHER_B="$(uuid_for team:fremd-b)"
TRASH_A="$(uuid_for team:papierkorb-a)"; TRASH_B="$(uuid_for team:papierkorb-b)"
S5="$(uuid_for match:spiel-5)"; S7="$(uuid_for match:spiel-7)"; S9="$(uuid_for match:spiel-9)"
S10="$(uuid_for match:spiel-10-kim)"; S11="$(uuid_for match:spiel-11-lea)"; S12="$(uuid_for match:spiel-12-udo)"
M_OTHER="$(uuid_for match:fremd)"; M_TRASH="$(uuid_for match:papierkorb)"; M_UNKNOWN="$(uuid_for match:unbekannt)"
E() { uuid_for "event:$1"; }

# ev <typ> <id> [Zusatzfelder als JSON] -- haengt ein Engine-Ereignis an EVS an (Format wie
# scripts/guard-all-matches-check.sh; kein Ausdruck in $(...), bash 3.2 verschluckt \").
EVS=""
ev() {
  local extra="${3:-}" one
  [[ -z "$extra" ]] && extra='{}'
  one="$(jq -cn --arg type "$1" --arg id "$2" --argjson extra "$extra" \
    '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, teamId: null, targetId: null, payload: {}} + $extra')"
  EVS="$EVS$one"$'\n'
}
# send <Nutzer> <Spiel> -- append_match_events mit den gesammelten Ereignissen als authenticated; Antwort in OUT.
OUT=""
send() {
  local events
  events="$(jq -cs '.' <<<"$EVS")"
  EVS=""
  OUT="$(q "SELECT harness.call('$1'::uuid, '$2'::uuid, \$J\$$events\$J\$::jsonb);")"
}
statuses_of() { jq -r '[.results[]?.status] | join(",")' <<<"$1"; }
# client <Nutzer> <SQL> [Rolle] -- 'ok:<Zeilen>' oder 'error:<SQLSTATE>:<Meldung>'
client() {
  local u="NULL"
  [[ -n "$1" ]] && u="'$1'::uuid"
  q "SELECT harness.exec($u, \$S\$$2\$S\$, '${3:-authenticated}');"
}
# names <Nutzer|leer> <Spiel> [Rolle] -- 'rows:<n>:<Name|Rolle;...>' (Reihenfolge der Funktion) oder 'error:<SQLSTATE>'
names() {
  local u="NULL"
  [[ -n "$1" ]] && u="'$1'::uuid"
  q "SELECT harness.names($u, '$2'::uuid, '${3:-authenticated}');"
}
# ids <Nutzer> <Spiel> -- Ereignis-IDs der Zeilen, Komma
ids() { q "SELECT harness.ids('$1'::uuid, '$2'::uuid);"; }

setup_helpers() {
  psql_stdin <<'SQL'
CREATE SCHEMA harness;
GRANT USAGE ON SCHEMA harness TO anon, authenticated, service_role;
-- append_match_events als echte Client-Rolle (SET LOCAL role + request.jwt.claim.sub, wie PostgREST).
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
CREATE FUNCTION harness.exec(p_user uuid, p_sql text, p_role text) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_rows bigint; v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('role', p_role, true);
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v := 'ok:' || v_rows;
  EXCEPTION WHEN OTHERS THEN
    v := 'error:' || SQLSTATE || ':' || SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
-- match_event_author_names als Client-Rolle (dynamisch: ohne Migration gibt es die Funktion nicht -> 42883).
CREATE FUNCTION harness.names(p_user uuid, p_match uuid, p_role text) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_n bigint; v_agg text; v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('role', p_role, true);
  BEGIN
    EXECUTE 'SELECT count(*), coalesce(string_agg(coalesce(x.author_name, ''NULL'') || ''|'' || coalesce(x.author_role, ''NULL''), '';'' ORDER BY x.ord), '''')
               FROM public.match_event_author_names($1) WITH ORDINALITY AS x(event_id, author_name, author_role, ord)'
      INTO v_n, v_agg USING p_match;
    v := 'rows:' || v_n || ':' || v_agg;
  EXCEPTION WHEN OTHERS THEN
    v := 'error:' || SQLSTATE;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
CREATE FUNCTION harness.ids(p_user uuid, p_match uuid) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    EXECUTE 'SELECT coalesce(string_agg(x.event_id::text, '','' ORDER BY x.ord), '''')
               FROM public.match_event_author_names($1) WITH ORDINALITY AS x(event_id, author_name, author_role, ord)'
      INTO v USING p_match;
  EXCEPTION WHEN OTHERS THEN
    v := 'error:' || SQLSTATE;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA harness TO anon, authenticated, service_role;
SQL
  # auth.jwt(): Schema auth gehoert nicht postgres -> als supabase_admin anlegen (wie guard-all-matches-check.sh).
  docker exec -i -e PGPASSWORD=postgres -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -h localhost -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -q <<'SQL'
DO $do$
BEGIN
  IF to_regprocedure('auth.jwt()') IS NULL THEN
    EXECUTE $f$CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      'SELECT coalesce(nullif(current_setting(''request.jwt.claims'', true), ''''), ''{}'')::jsonb'$f$;
    GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
  END IF;
END;
$do$;
SQL
}

# Daten: Turnier "Live-Cup" (Eigentuemer Olli), Mitglieder mit Namen, Eintraege ueber append_match_events.
# Alles VOR der Ziel-Migration, damit der Lauf ohne Migration dieselben Daten hat (Bestand vor F2b).
setup_data() {
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@ur.test'), ('$U_MARIA'::uuid, 'maria.k@ur.test'), ('$U_TOM'::uuid, 'tom.h@ur.test'),
             ('$U_KIM'::uuid, 'kim@ur.test'), ('$U_LEA'::uuid, 'lea@ur.test'), ('$U_UDO'::uuid, 'udo@ur.test'),
             ('$U_TRAINER'::uuid, 'trainer@ur.test'), ('$U_VIEWER'::uuid, 'viewer@ur.test'),
             ('$U_STRANGER'::uuid, 'stranger@ur.test')) AS u(id, email);
-- Profilnamen: Olli "Olli"; Maria "maria.k" (E-Mail-Praefix, die Leitung vergab "Maria"); Tom "tom.h"; Kim ohne
-- label "Kim"; Lea nur Leerzeichen; die E-Mail steht in profiles.email und darf nie als Name erscheinen.
INSERT INTO public.profiles (id, display_name, email)
VALUES ('$U_OLLI', 'Olli', 'olli@ur.test'), ('$U_MARIA', 'maria.k', 'maria.k@ur.test'), ('$U_TOM', 'tom.h', 'tom.h@ur.test'),
       ('$U_KIM', 'Kim', 'kim@ur.test'), ('$U_LEA', '   ', 'lea@ur.test'), ('$U_UDO', 'udo', 'udo@ur.test'),
       ('$U_TRAINER', 'Trainer Rot', 'trainer@ur.test'), ('$U_VIEWER', 'Vera', 'viewer@ur.test'),
       ('$U_STRANGER', 'Fremd', 'stranger@ur.test')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES ('$T', '$U_OLLI', 'Live-Cup', '2026-10-28', 4, 10, '{}'::jsonb),
       ('$T_OTHER', '$U_STRANGER', 'Fremder Cup', '2026-10-28', 2, 10, '{}'::jsonb),
       ('$T_TRASH', '$U_OLLI', 'Alter Cup', '2026-10-28', 2, 10, '{}'::jsonb);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label)
VALUES ('$T', '$U_MARIA', 'co-admin', now(), 'Maria'), ('$T', '$U_TOM', 'collaborator', now(), 'Tom'),
       ('$T', '$U_KIM', 'co-admin', now(), NULL), ('$T', '$U_LEA', 'co-admin', now(), '  '),
       ('$T', '$U_UDO', 'co-admin', now(), 'Udo'),
       ('$T', '$U_TRAINER', 'trainer', now(), 'Trainer Rot'), ('$T', '$U_VIEWER', 'viewer', now(), 'Vera');
INSERT INTO public.teams (id, tournament_id, name) VALUES
  ('$SG_MITTE', '$T', 'SG Mitte'), ('$VFB_UFER', '$T', 'VfB Ufer'), ('$FC_NORD', '$T', 'FC Nord'), ('$SV_SUED', '$T', 'SV Süd'),
  ('$OTHER_A', '$T_OTHER', 'A'), ('$OTHER_B', '$T_OTHER', 'B'), ('$TRASH_A', '$T_TRASH', 'A'), ('$TRASH_B', '$T_TRASH', 'B');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start) VALUES
  ('$S5',  '$T', 2, 1, '$SG_MITTE', '$FC_NORD', 5, '14:30'),
  ('$S7',  '$T', 3, 1, '$FC_NORD', '$SV_SUED', 7, '15:00'),
  ('$S9',  '$T', 3, 2, '$SV_SUED', '$FC_NORD', 9, '15:00'),
  ('$S10', '$T', 4, 1, '$VFB_UFER', '$FC_NORD', 10, '15:30'),
  ('$S11', '$T', 4, 2, '$SG_MITTE', '$VFB_UFER', 11, '15:30'),
  ('$S12', '$T', 5, 1, '$FC_NORD', '$SG_MITTE', 12, '16:00'),
  ('$M_OTHER', '$T_OTHER', 1, 1, '$OTHER_A', '$OTHER_B', 1, '14:00'),
  ('$M_TRASH', '$T_TRASH', 1, 1, '$TRASH_A', '$TRASH_B', 1, '14:00');
SQL
  local out
  # @FU-080: Spiel 9 geplant, auf Papier geleitet -- Olli traegt im Spielplan 3:1 ein (RESULT_ENTRY).
  ev RESULT_ENTRY "$(E s9-entry)" "{\"payload\":{\"scores\":{\"$SV_SUED\":3,\"$FC_NORD\":1}}}"
  send "$U_OLLI" "$S9"; out="$OUT"
  [[ "$(statuses_of "$out")" == "accepted" ]] || { echo "::error::Vorbereitung Spiel 9 (Olli 3:1): $out" >&2; exit 1; }
  # @FU-082: Spiel 7 endete 2:1 (Ollis Direkteintrag), danach korrigiert Maria auf 2:2.
  ev RESULT_ENTRY "$(E s7-entry)" "{\"payload\":{\"scores\":{\"$FC_NORD\":2,\"$SV_SUED\":1}}}"
  send "$U_OLLI" "$S7"; out="$OUT"
  [[ "$(statuses_of "$out")" == "accepted" ]] || { echo "::error::Vorbereitung Spiel 7 (2:1): $out" >&2; exit 1; }
  ev CORRECTION "$(E s7-corr-maria)" "{\"at\":2000,\"payload\":{\"scores\":{\"$FC_NORD\":2,\"$SV_SUED\":2},\"reason\":\"input_error\",\"basedOn\":\"$(E s7-entry)\"}}"
  send "$U_MARIA" "$S7"; out="$OUT"
  [[ "$(statuses_of "$out")" == "accepted" ]] || { echo "::error::Vorbereitung Spiel 7 (Maria 2:2): $out" >&2; exit 1; }
  # Helfer Tom pfeift Spiel 5 an (Maria liest Toms Namen, den sie per RLS nicht sieht).
  ev MATCH_START "$(E s5-start)" '{"clockMs":null}'
  send "$U_TOM" "$S5"; out="$OUT"
  [[ "$(statuses_of "$out")" == "accepted" ]] || { echo "::error::Vorbereitung Spiel 5 (Tom pfeift an): $out" >&2; exit 1; }
  # Kim (Mitglied ohne label), Lea (nur Leerzeichen), Udo (Konto wird geloescht) tragen je ein Ergebnis ein.
  ev RESULT_ENTRY "$(E s10-entry)" "{\"payload\":{\"scores\":{\"$VFB_UFER\":1,\"$FC_NORD\":0}}}"
  send "$U_KIM" "$S10"; out="$OUT"
  [[ "$(statuses_of "$out")" == "accepted" ]] || { echo "::error::Vorbereitung Spiel 10 (Kim): $out" >&2; exit 1; }
  ev RESULT_ENTRY "$(E s11-entry)" "{\"payload\":{\"scores\":{\"$SG_MITTE\":0,\"$VFB_UFER\":0}}}"
  send "$U_LEA" "$S11"; out="$OUT"
  [[ "$(statuses_of "$out")" == "accepted" ]] || { echo "::error::Vorbereitung Spiel 11 (Lea): $out" >&2; exit 1; }
  ev RESULT_ENTRY "$(E s12-entry)" "{\"payload\":{\"scores\":{\"$FC_NORD\":4,\"$SG_MITTE\":2}}}"
  send "$U_UDO" "$S12"; out="$OUT"
  [[ "$(statuses_of "$out")" == "accepted" ]] || { echo "::error::Vorbereitung Spiel 12 (Udo): $out" >&2; exit 1; }
  # Papierkorb: Olli traegt im alten Cup ein, danach landet das Turnier im Papierkorb.
  ev RESULT_ENTRY "$(E trash-entry)" "{\"payload\":{\"scores\":{\"$TRASH_A\":1,\"$TRASH_B\":0}}}"
  send "$U_OLLI" "$M_TRASH"; out="$OUT"
  [[ "$(statuses_of "$out")" == "accepted" ]] || { echo "::error::Vorbereitung Papierkorb: $out" >&2; exit 1; }
  # Udo loescht sein Konto: match_event_authors.user_id -> NULL (ON DELETE SET NULL). matches.last_modified_by
  # verweist ohne ON DELETE auf auth.users -- wie ein Konto-Loeschweg der App vorher auf NULL setzen.
  psql_stdin <<SQL
UPDATE public.matches SET last_modified_by = NULL WHERE last_modified_by = '$U_UDO';
UPDATE public.tournaments SET last_modified_by = NULL WHERE last_modified_by = '$U_UDO';
DELETE FROM auth.users WHERE id = '$U_UDO';
UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_TRASH';
SQL
  out="$(q "SELECT count(*) || '|' || count(*) FILTER (WHERE user_id IS NULL) FROM public.match_event_authors;")"
  [[ "$out" == "8|1" ]] || { echo "::error::Vorbereitung: match_event_authors erwartet 8|1, erhalten $out" >&2; exit 1; }
}

# ---------------------------------------------------------------------------------------------------------
# Proben (gemeinsam fuer normalen Lauf, ohne Migration und Gegenprobe)
# ---------------------------------------------------------------------------------------------------------
run_probes() {
  local who uid res

  # --- N: Namen ------------------------------------------------------------------------------------------
  for who in olli maria tom; do
    case "$who" in olli) uid="$U_OLLI" ;; maria) uid="$U_MARIA" ;; tom) uid="$U_TOM" ;; esac
    check N "@FU-080 $who liest Spiel 9: eine Zeile, Ollis Direkteintrag 3:1 -> 'Olli', Rolle owner" "rows:1:Olli|owner" "$(names "$uid" "$S9")"
  done
  check N "@FU-080 die Zeile gehoert zum Eintrag von Spiel 9 (event_id)" "$(E s9-entry)" "$(ids "$U_OLLI" "$S9")"
  check N "@FU-082 Olli liest Spiel 7: 2:1 von Olli, Korrektur 2:2 von Maria (label 'Maria', nicht 'maria.k')" \
    "rows:2:Olli|owner;Maria|co-admin" "$(names "$U_OLLI" "$S7")"
  check N "@FU-082 Maria liest Spiel 7 genauso (eigene und fremde Zeile)" "rows:2:Olli|owner;Maria|co-admin" "$(names "$U_MARIA" "$S7")"
  check N "Mitglied: Maria liest Toms Anpfiff von Spiel 5 -> 'Tom' (label), Rolle collaborator" "rows:1:Tom|collaborator" "$(names "$U_MARIA" "$S5")"
  check N "Gegenbeispiel: Mitglied ohne label (Kim) -> display_name 'Kim'" "rows:1:Kim|co-admin" "$(names "$U_OLLI" "$S10")"
  check N "Gegenbeispiel: label und display_name nur Leerzeichen (Lea) -> Name NULL, Zeile bleibt" "rows:1:NULL|co-admin" "$(names "$U_OLLI" "$S11")"
  check N "Konto geloescht (Udo, user_id NULL): Zeile bleibt, Name und Rolle NULL" "rows:1:NULL|NULL" "$(names "$U_OLLI" "$S12")"
  res="$(names "$U_OLLI" "$S7")$(names "$U_OLLI" "$S9")$(names "$U_OLLI" "$S5")"
  check N "nie E-Mail: keine Antwort enthaelt '@'" "kein-at" "$([[ "$res" == *@* ]] && echo "mit-at:$res" || echo kein-at)"

  # --- R: Rechte (@FU-065) -------------------------------------------------------------------------------
  for who in trainer viewer stranger; do
    case "$who" in trainer) uid="$U_TRAINER" ;; viewer) uid="$U_VIEWER" ;; stranger) uid="$U_STRANGER" ;; esac
    check R "@FU-065 $who liest Spiel 9 -> 0 Zeilen (keine Konto-Angabe)" "rows:0:" "$(names "$uid" "$S9")"
  done
  check R "@FU-065 Zuschauer ohne Konto / oeffentliche Ansicht (anon) -> kein EXECUTE (42501)" "error:42501" "$(names "" "$S9" anon)"
  check R "service_role -> kein EXECUTE (42501)" "error:42501" "$(names "" "$S9" service_role)"
  check R "Turnier im Papierkorb -> 0 Zeilen (Olli ist Eigentuemer)" "rows:0:" "$(names "$U_OLLI" "$M_TRASH")"
  check R "unbekanntes Spiel -> 0 Zeilen, kein Fehler" "rows:0:" "$(names "$U_OLLI" "$M_UNKNOWN")"
  check R "fremdes Turnier: Olli liest Spiel des Fremden Cups -> 0 Zeilen" "rows:0:" "$(names "$U_OLLI" "$M_OTHER")"
  res="$(client "$U_OLLI" "UPDATE public.tournament_collaborators SET declined_at = now() WHERE tournament_id = '$T' AND user_id = '$U_TOM'")"
  check R "Olli entfernt Helfer Tom (declined_at)" "ok:1" "$res"
  check R "@FU-065 Gegenbeispiel: entfernter Tom liest Spiel 9 -> 0 Zeilen" "rows:0:" "$(names "$U_TOM" "$S9")"
  check N "entfernter Tom: sein alter Anpfiff von Spiel 5 behaelt den Namen 'Tom'" "rows:1:Tom|collaborator" "$(names "$U_OLLI" "$S5")"
  res="$(client "$U_OLLI" "UPDATE public.tournament_collaborators SET declined_at = NULL WHERE tournament_id = '$T' AND user_id = '$U_TOM'")"
  check R "Olli nimmt Tom wieder auf -> Tom liest Spiel 9 wieder 'Olli'" "ok:1|rows:1:Olli|owner" "$res|$(names "$U_TOM" "$S9")"
}

# run_assertions -- Rechte-Assertion als ci_schema_reader; 2 neue Namen; Namensliste = db-drift-check.sh.
run_assertions() {
  local priv names_sql names_sh
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  # A-11: die drei Zeilen der spaeteren Migration 20261110_001 sind hier f (sie laeuft erst in A5 nach dem Rueckweg).
  check S "Rechte-Assertion: keine Zeile |f (ausser Zeilen der spaeteren Migration 20261110_001)" "" \
    "$(grep -v '|t$' <<<"$priv" | grep -vE '^(role-permissions-check-mvp-rights|matches-update-only-manage-schedule|monitors-writes-manage-screens)' || true)"
  check S "Rechte-Assertion: die 2 UR-Zeilen vorhanden und |t" \
    "match-event-author-names-definer-search-path|t,match-event-author-names-execute-only-authenticated|t" \
    "$(grep -E '^match-event-author-names-' <<<"$priv" | sort | paste -sd, -)"
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Lehre A-30a: Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
}

setup_before() {
  echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  psql_stdin < "$BASELINE_FILE"
  local f
  for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done
  setup_helpers
  setup_data
}

summary() {
  local i
  echo
  for i in "${!CATS[@]}"; do echo "Kategorie ${CATS[$i]}: ${OKS[$i]} OK, ${DEVS[$i]} Abweichung(en)"; done
}

# ---------------------------------------------------------------------------------------------------------
if [[ "$MODE" == "gegenprobe" ]]; then
  export M1_FROM="     AND public.has_tournament_permission(t.id, 'writeMatchData')"
  export M1_TO="     AND true"
  export M2_FROM="           ELSE coalesce(nullif(btrim(tc.label), ''), nullif(btrim(p.display_name), ''))"
  export M2_TO="           ELSE nullif(btrim(p.display_name), '')"
  export M3_FROM=" AND t.deleted_at IS NULL"
  export M3_TO=""
  export M4_FROM="GRANT EXECUTE ON FUNCTION public.match_event_author_names(uuid) TO authenticated;"
  export M4_TO="GRANT EXECUTE ON FUNCTION public.match_event_author_names(uuid) TO authenticated, anon;"
  RED_TOTAL=0
  for mut in M1 M2 M3 M4; do
    start_container "$mut"
    setup_before
    MUT_KEY="$mut" python3 -c '
import os, sys
s = sys.stdin.read()
k = os.environ["MUT_KEY"]
frm = os.environ[k + "_FROM"]
if s.count(frm) != 1:
    sys.exit("Gegenprobe: Muster %s nicht genau einmal in der Migration (%d)" % (k, s.count(frm)))
sys.stdout.write(s.replace(frm, os.environ[k + "_TO"]))' < "$TARGET_FILE" | psql_stdin
    reset_counts
    echo "--- GEGENPROBE $mut ---"
    run_probes
    run_assertions
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "GEGENPROBE $mut: rot ($(total_dev) Abweichung(en)) -- wie verlangt"
      RED_TOTAL=$((RED_TOTAL + 1))
    else
      echo "::error::GEGENPROBE $mut blieb gruen (zahnlos)"
    fi
    stop_container
  done
  echo
  echo "Gegenprobe: $RED_TOTAL von 4 Mutationen rot."
  [[ "$RED_TOTAL" -eq 4 ]]
  exit $?
fi

start_container "$MODE"
setup_before

if [[ "$MODE" == "without-migration" ]]; then
  run_probes
  summary
  N_DEV="${DEVS[$(cat_index N)]}"; R_DEV="${DEVS[$(cat_index R)]}"
  if [[ "$N_DEV" -gt 0 && "$R_DEV" -gt 0 ]]; then
    echo "Ohne Migration: N und R rot -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (N=$N_DEV, R=$R_DEV muessen > 0 sein)."
  exit 1
fi

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
AUTHORS_BEFORE="$(q "SELECT count(*) || '|' || count(*) FILTER (WHERE user_id IS NULL) FROM public.match_event_authors;")"
echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE"
# A5 (wie match-kit-check.sh): spaetere Migrationen erst nach dem Rueckweg, sonst messen Katalog-Delta und
# Rueckweg-Vergleich sie mit.

# --- S: Schema ---------------------------------------------------------------------------------------------
check S "Bestand: match_event_authors unveraendert (Zeilen | user_id NULL), Prognose-Abfrage der Freigabe" \
  "$AUTHORS_BEFORE" "$(q "SELECT count(*) || '|' || count(*) FILTER (WHERE user_id IS NULL) FROM public.match_event_authors;")"
check S "Funktion: SECURITY DEFINER, STABLE, search_path=public, pg_temp, Rueckgabe event_id/author_name/author_role" \
  "true|s|{\"search_path=public, pg_temp\"}|TABLE(event_id uuid, author_name text, author_role text)" \
  "$(q "SELECT p.prosecdef::text || '|' || p.provolatile::text || '|' || p.proconfig::text || '|' || pg_get_function_result(p.oid) FROM pg_proc p WHERE p.oid = to_regprocedure('public.match_event_author_names(uuid)');")"
check S "Pruefabfrage der Freigabe: to_regprocedure(...) IS NOT NULL" "t" \
  "$(q "SELECT to_regprocedure('public.match_event_author_names(uuid)') IS NOT NULL;")"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in columns functions triggers tables policies indexes rls_tables; do
  expected=0
  [[ "$dim" == "functions" ]] && expected=1
  check S "Katalogzaehlung $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done

run_probes
run_assertions

# --- W: idempotent -----------------------------------------------------------------------------------------
set +e
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
W_EXIT=$?
set -e
check W "zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check W "danach genau eine Funktion, Antwort unveraendert" "1|rows:2:Olli|owner;Maria|co-admin" \
  "$(q "SELECT count(*) FROM pg_proc WHERE proname = 'match_event_author_names';")|$(names "$U_OLLI" "$S7")"

# --- X: Rueckweg laut Kopfkommentar -----------------------------------------------------------------------
ROLLBACK_SQL="$(awk '/^-- RUECKWEG/{f=1; next} f && /^--   DROP /{sub(/^--   /, ""); print; next} f && /^-- Produktion/{exit}' "$TARGET_FILE")"
check X "Rueckweg-Block: 1 DROP-Anweisung" "1" "$(grep -c ';$' <<<"$ROLLBACK_SQL" || true)"
psql_stdin <<<"BEGIN;
SET LOCAL lock_timeout = '5s';
$ROLLBACK_SQL
COMMIT;"
DUMP_ROLLED_BACK="$(schema_dump)"
check X "nach dem Rueckweg: Schema public = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi
check X "nach dem Rueckweg: Eintraege und Urheber unveraendert" "$AUTHORS_BEFORE" \
  "$(q "SELECT count(*) || '|' || count(*) FILTER (WHERE user_id IS NULL) FROM public.match_event_authors;")"

# A5: spaetere Migrationen auf dem Zustand NACH dem Rueckweg einspielen -- nur Lauffaehigkeits-Nachweis.
for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f"
  echo "OK    A5 spaetere Migration laeuft nach dem Rueckweg: $(basename "$f")" >&2
done

summary
echo
echo "Ergebnis: $(total_dev) Abweichung(en)."
[[ "$(total_dev)" -eq 0 ]]
