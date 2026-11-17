#!/usr/bin/env bash
#
# konto-loeschen-check.sh -- Container-Beweis fuer supabase/migrations/20261128_001_konto_loeschen.sql
# (Konto auf Anfrage loeschbar, Turniere geschuetzt: @RE-009, @RE-010, @RE-011; Record
# docs/anforderungen/2026-10-03_recht-impressum-datenschutz.md). Muster: zuschauer-zaehlung-check.sh und event-author-names-check.sh
# (Wegwerf-Container supabase/postgres, Baseline + Migrationen seit Baseline, trap). Ohne PostgREST: die Rollen werden per SET ROLE gespielt.
#
#   bash scripts/konto-loeschen-check.sh                       normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/konto-loeschen-check.sh --without-migration   Gegenprobe A: ohne die Migration muessen R, S, V rot sein
#   bash scripts/konto-loeschen-check.sh --gegenprobe          Gegenprobe B: je Mutation (eine zurueckgenommene Regel) ein Lauf; Exit 0 nur, wenn JEDE
#                                                              die dafuer vorgesehene Kategorie rot macht
#
# Kategorien: A Ausgangslage (heutiger Fehler belegt), R @RE-009 (Konto ohne Turnier loeschbar, Zeilen bleiben), S @RE-010 (Konto mit Turnier
# abgelehnt, Turniere unveraendert), V @RE-011 (Vorpruefung nur service_role, ohne Namen/E-Mail), H Hin-/Rueckweg, zweimal, Fail-fast, Sperre,
# naive Reparatur als Beleg der Gefahr.
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack: eigener Container, am Ende entfernt.
set -uo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  *) echo "::error::Unbekannte Option: $1" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261128_001_konto_loeschen.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
ROLLBACK_FILE="$REPO_ROOT/supabase/rollbacks/20261128_001_konto_loeschen_rollback.sql"
C="konto-loeschen-check-$$"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/konto-loeschen-check.XXXXXX")"
[[ -f "$TARGET_FILE" && -f "$ROLLBACK_FILE" ]] || { echo "::error::$TARGET_NAME oder sein Rueckweg fehlt." >&2; exit 1; }
source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
BEFORE=(); AFTER=(); SEEN=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if [[ "$(basename "$line")" == "$TARGET_NAME" ]]; then SEEN=1
  elif [[ "$SEEN" -eq 0 ]]; then BEFORE+=("$line")
  else AFTER+=("$line"); fi
done <<< "$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")"
[[ "$SEEN" -eq 1 ]] || { echo "::error::$TARGET_NAME nicht in der Liste 'neuer als Baseline'." >&2; exit 1; }

cleanup() { local rc=$?; docker rm -f "$C" >/dev/null 2>&1 || true; rm -rf "$WORK"; exit "$rc"; }
trap cleanup EXIT

psql_stdin() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -v ON_ERROR_STOP=1 -q "$@"; }
q() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 <<<"$1" 2>&1 | tr '\n' ' ' | sed 's/ *$//' || true; }
qfile() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 < "$1" 2>&1 | tr '\n' ' ' | sed 's/ *$//' || true; }
schema_dump() { docker exec "$C" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }
priv_run() { { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 2>&1; }
rowq() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -q -tA -F'|' -v ON_ERROR_STOP=0 < "$1" 2>&1 | tr '\n' ' ' | sed 's/ *$//'; }
sum_of() { if command -v md5sum >/dev/null 2>&1; then md5sum | cut -d' ' -f1; else md5 -q; fi; }

CATS=(A R S V H)
DEVS=(0 0 0 0 0)
OKS=(0 0 0 0 0)
cat_index() { local i; for i in "${!CATS[@]}"; do [[ "${CATS[$i]}" == "$1" ]] && { echo "$i"; return 0; }; done; exit 2; }
check() { # check <Kategorie> <Name> <erwartet> <erhalten>
  local i; i="$(cat_index "$1")"
  if [[ "$3" == "$4" ]]; then OKS[i]=$((OKS[i] + 1)); [[ "${QUIET:-0}" == "1" ]] || echo "OK          [$1] $2"
  else DEVS[i]=$((DEVS[i] + 1)); echo "ABWEICHUNG  [$1] $2"; echo "    erwartet: $3"; echo "    erhalten: ${4:0:400}"; fi
}
has() { # has <Kategorie> <Name> <Muster> <Text>
  local i; i="$(cat_index "$1")"
  if grep -qE -- "$3" <<<"$4"; then OKS[i]=$((OKS[i] + 1)); [[ "${QUIET:-0}" == "1" ]] || { echo "OK          [$1] $2"; echo "    -> ${4:0:300}"; }
  else DEVS[i]=$((DEVS[i] + 1)); echo "ABWEICHUNG  [$1] $2"; echo "    Muster: $3"; echo "    erhalten: ${4:0:400}"; fi
}
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
reset_counts() { DEVS=(0 0 0 0 0); OKS=(0 0 0 0 0); }

uuid_for() { local h; h="$(printf '%s' "konto-loeschen-check:$1" | shasum -a 256 | cut -c1-32)"; echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"; }
U_OLLI="$(uuid_for user:olli)"; U_MARIA="$(uuid_for user:maria)"; U_TOM="$(uuid_for user:tom)"; U_UDO="$(uuid_for user:udo)"
U_KIM="$(uuid_for user:kim)"; U_FREI="$(uuid_for user:frei)"; U_STRANGER="$(uuid_for user:stranger)"; U_TRASHONLY="$(uuid_for user:nurpapierkorb)"
T="$(uuid_for tournament:nikolaus)"; T_TRASH="$(uuid_for tournament:papierkorb)"; T_OTHER="$(uuid_for tournament:fremd)"; T_TRASHONLY="$(uuid_for tournament:nurpapierkorb)"
TA="$(uuid_for team:a)"; TB="$(uuid_for team:b)"; TC="$(uuid_for team:c)"; TD="$(uuid_for team:d)"
OA="$(uuid_for team:oa)"; OB="$(uuid_for team:ob)"; XA="$(uuid_for team:xa)"; XB="$(uuid_for team:xb)"; PA="$(uuid_for team:pa)"; PB="$(uuid_for team:pb)"
S1="$(uuid_for match:s1)"; S2="$(uuid_for match:s2-tom)"; S3="$(uuid_for match:s3-udo)"; M_OTHER="$(uuid_for match:fremd)"; M_TRASH="$(uuid_for match:papierkorb)"; M_PO="$(uuid_for match:nurpapierkorb)"
E() { uuid_for "event:$1"; }
EVS=""
ev() { local extra="${3:-}" one; [[ -z "$extra" ]] && extra='{}'
  one="$(jq -cn --arg type "$1" --arg id "$2" --argjson extra "$extra" '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, teamId: null, targetId: null, payload: {}} + $extra')"
  EVS="$EVS$one"$'\n'; }
OUT=""
send() { local events; events="$(jq -cs '.' <<<"$EVS")"; EVS=""; OUT="$(q "SELECT harness.call('$1'::uuid, '$2'::uuid, \$J\$$events\$J\$::jsonb);")"; }
statuses_of() { jq -r '[.results[]?.status] | join(",")' <<<"$1"; }
names() { q "SELECT harness.names('$1'::uuid, '$2'::uuid);"; }
deluser() { q "WITH d AS (DELETE FROM auth.users WHERE id='$1' RETURNING 1) SELECT 'DELETE ' || count(*) FROM d;"; }
rules() { q "SELECT string_agg(conname||'='||confdeltype::text, ' ' ORDER BY conname) FROM pg_constraint WHERE conname IN ('matches_last_modified_by_fkey','tournaments_last_modified_by_fkey','match_corrections_corrected_by_fkey','tournament_collaborators_invited_by_fkey','tournaments_owner_id_fkey');"; }

start_container() {
  docker rm -f "$C" >/dev/null 2>&1 || true
  docker run -d --name "$C" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 90); do [[ "$(docker logs "$C" 2>&1 | grep -c 'ready to accept connections' || true)" -ge 2 ]] && { ready=1; break; }; sleep 1; done
  [[ "$ready" -eq 1 ]] || { echo "::error::Container nicht bereit." >&2; exit 1; }
  for _ in $(seq 1 30); do docker exec "$C" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
}

prepare() { # Baseline + alle Migrationen VOR der Ziel-Migration, Harness, Testdaten
  start_container
  psql_stdin < "$BASELINE_FILE" >/dev/null
  local f; for f in "${BEFORE[@]}"; do psql_stdin < "$f" >/dev/null; done
  docker exec -i -e PGPASSWORD=postgres "$C" psql -h localhost -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
DO $do$ BEGIN IF to_regprocedure('auth.jwt()') IS NULL THEN
  EXECUTE $f$CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS 'SELECT coalesce(nullif(current_setting(''request.jwt.claims'', true), ''''), ''{}'')::jsonb'$f$;
  GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role; END IF; END $do$;
SQL
  psql_stdin <<'SQL'
CREATE SCHEMA harness;
GRANT USAGE ON SCHEMA harness TO anon, authenticated, service_role;
CREATE FUNCTION harness.call(p_user uuid, p_match uuid, p_events jsonb) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN v := public.append_match_events(p_match, p_events, 1, NULL);
  EXCEPTION WHEN OTHERS THEN v := jsonb_build_object('exception', SQLSTATE, 'message', SQLERRM); END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END; $fn$;
CREATE FUNCTION harness.names(p_user uuid, p_match uuid) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_n bigint; v_agg text; v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    EXECUTE 'SELECT count(*), coalesce(string_agg(coalesce(x.author_name, ''NULL'') || ''|'' || coalesce(x.author_role, ''NULL''), '';'' ORDER BY x.ord), '''')
               FROM public.match_event_author_names($1) WITH ORDINALITY AS x(event_id, author_name, author_role, ord)' INTO v_n, v_agg USING p_match;
    v := 'rows:' || v_n || ':' || v_agg;
  EXCEPTION WHEN OTHERS THEN v := 'error:' || SQLSTATE; END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END; $fn$;
-- Pruefsumme (Anzahl/md5) ueber ALLE Zeilen der Turniere in allen Turnier-Tabellen, reihenfolgeunabhaengig; ohne die Spalten, die ein Konto-Loeschen
-- erlaubterweise leert (p_ohne), damit "unveraendert ausser dem Verweis" pruefbar ist.
CREATE FUNCTION harness.cs(p_ids uuid[], p_ohne text[] DEFAULT ARRAY[]::text[]) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE r text := ''; t text; v text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tournaments','teams','matches','match_event_authors','tournament_collaborators','match_transitions','match_corrections','monitors','sponsors'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT count(*) || ''/'' || coalesce(md5(string_agg((to_jsonb(x) - $2)::text, ''|'' ORDER BY (to_jsonb(x) - $2)::text)), ''-'') FROM public.%I x WHERE %s = ANY($1)',
                   t, CASE WHEN t = 'tournaments' THEN 'x.id' ELSE 'x.tournament_id' END) INTO v USING p_ids, p_ohne;
    r := r || t || '=' || v || ';';
  END LOOP;
  EXECUTE 'SELECT count(*) || ''/'' || coalesce(md5(string_agg((to_jsonb(x) - $2)::text, ''|'' ORDER BY (to_jsonb(x) - $2)::text)), ''-'') FROM public.match_events x WHERE x.match_id IN (SELECT id FROM public.matches WHERE tournament_id = ANY($1))' INTO v USING p_ids, p_ohne;
  RETURN r || 'match_events=' || v;
END; $fn$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA harness TO anon, authenticated, service_role;
SQL
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(), '{}', '{}', now(), now(), u.anon
FROM (VALUES ('$U_OLLI'::uuid, 'eigentuemer@kl.test', false), ('$U_MARIA'::uuid, 'coadmin@kl.test', false), ('$U_TOM'::uuid, NULL, true),
             ('$U_UDO'::uuid, 'udo@kl.test', false), ('$U_FREI'::uuid, 'frei@kl.test', false), ('$U_STRANGER'::uuid, 'fremd@kl.test', false),
             ('$U_TRASHONLY'::uuid, 'nurpapierkorb@kl.test', false), ('$U_KIM'::uuid, 'kim@kl.test', false)) AS u(id, email, anon);
INSERT INTO public.profiles (id, display_name, email) VALUES
  ('$U_OLLI','Olli','eigentuemer@kl.test'), ('$U_MARIA','Maria','coadmin@kl.test'), ('$U_UDO','Udo','udo@kl.test'),
  ('$U_FREI','Frei','frei@kl.test'), ('$U_STRANGER','Fremd','fremd@kl.test'), ('$U_TRASHONLY','Karl','nurpapierkorb@kl.test'), ('$U_KIM','Kira','kim@kl.test')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config, status, is_public, share_code) VALUES
  ('$T','$U_OLLI','Nikolaus-Turnier','2026-11-28',4,10,'{"publishedAt":"2026-11-01T00:00:00.000Z"}','published',true,'NIKO26'),
  ('$T_TRASH','$U_OLLI','Alter Cup','2026-11-28',2,10,'{}','draft',false,NULL),
  ('$T_OTHER','$U_STRANGER','Fremder Cup','2026-11-28',2,10,'{}','draft',false,NULL),
  ('$T_TRASHONLY','$U_TRASHONLY','Nur Papierkorb','2026-11-28',2,10,'{}','draft',false,NULL);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label, invited_by) VALUES
  ('$T','$U_MARIA','co-admin',now(),'Maria','$U_OLLI'), ('$T','$U_UDO','co-admin',now(),'Udo','$U_MARIA'), ('$T','$U_TOM','collaborator',now(),'Tom','$U_MARIA'), ('$T','$U_KIM','co-admin',now(),'Kira','$U_MARIA');
INSERT INTO public.teams (id, tournament_id, name) VALUES ('$TA','$T','A'),('$TB','$T','B'),('$TC','$T','C'),('$TD','$T','D'),
  ('$OA','$T_OTHER','OA'),('$OB','$T_OTHER','OB'),('$XA','$T_TRASH','XA'),('$XB','$T_TRASH','XB'),('$PA','$T_TRASHONLY','PA'),('$PB','$T_TRASHONLY','PB');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, scheduled_start) VALUES
  ('$S1','$T',1,1,'$TA','$TB',1,'14:00'), ('$S2','$T',1,2,'$TC','$TD',2,'14:00'), ('$S3','$T',2,1,'$TA','$TC',3,'14:30'),
  ('$M_OTHER','$T_OTHER',1,1,'$OA','$OB',1,'14:00'), ('$M_TRASH','$T_TRASH',1,1,'$XA','$XB',1,'14:00'), ('$M_PO','$T_TRASHONLY',1,1,'$PA','$PB',1,'14:00');
SQL
  ev RESULT_ENTRY "$(E s1)" "{\"payload\":{\"scores\":{\"$TA\":2,\"$TB\":1}}}"; send "$U_OLLI" "$S1"; [[ "$(statuses_of "$OUT")" == "accepted" ]] || { echo "::error::Seed S1: $OUT" >&2; exit 1; }
  ev MATCH_START "$(E s2)" '{"clockMs":null}'; send "$U_TOM" "$S2"; [[ "$(statuses_of "$OUT")" == "accepted" ]] || { echo "::error::Seed S2 (Helfer): $OUT" >&2; exit 1; }
  ev RESULT_ENTRY "$(E s3)" "{\"payload\":{\"scores\":{\"$TA\":4,\"$TC\":2}}}"; send "$U_UDO" "$S3"; [[ "$(statuses_of "$OUT")" == "accepted" ]] || { echo "::error::Seed S3 (Udo): $OUT" >&2; exit 1; }
  ev RESULT_ENTRY "$(E o)" "{\"payload\":{\"scores\":{\"$OA\":1,\"$OB\":0}}}"; send "$U_STRANGER" "$M_OTHER"; [[ "$(statuses_of "$OUT")" == "accepted" ]] || { echo "::error::Seed fremd: $OUT" >&2; exit 1; }
  ev RESULT_ENTRY "$(E t)" "{\"payload\":{\"scores\":{\"$XA\":1,\"$XB\":0}}}"; send "$U_OLLI" "$M_TRASH"; [[ "$(statuses_of "$OUT")" == "accepted" ]] || { echo "::error::Seed Papierkorb: $OUT" >&2; exit 1; }
  psql_stdin <<SQL
-- Udo hat ein Ergebnis eingetragen (S3) UND eines berichtigt (match_corrections.corrected_by); Tom hat ein Spiel angepfiffen (S2, anonym)
INSERT INTO public.match_corrections (match_id, previous_score_a, previous_score_b, new_score_a, new_score_b, corrected_by) VALUES ('$S3',3,2,4,2,'$U_UDO');
UPDATE public.tournaments SET last_modified_by = '$U_TOM' WHERE id = '$T';
UPDATE public.tournaments SET deleted_at = now() WHERE id IN ('$T_TRASH', '$T_TRASHONLY');
SQL
}

apply_target() { psql_stdin < "$TARGET_FILE" >/dev/null; local f; for f in ${AFTER[@]+"${AFTER[@]}"}; do psql_stdin < "$f" >/dev/null; done; }

OLLI_IDS="ARRAY['$T','$T_TRASH']::uuid[]"
FREMD_IDS="ARRAY['$T_OTHER','$T_TRASHONLY']::uuid[]"

# --- die Pruefungen, Kategorien V R S -----------------------------------------------------------------------------------------------
run_RSV() {
  local CS_O1 CS_F0 CNT_M CNT_E CNT_A N0 CORR0 EV0 VER0 AUT0 res
  CS_F0="$(q "SELECT harness.cs($FREMD_IDS);")"
  # --- V: @RE-011 (Konto des Eigentuemers VOR seiner Loeschung) -------------------------------------------------------------------
  res="$(q "SET ROLE service_role; SELECT public.account_deletion_check('$U_OLLI');")"
  check V "@RE-011 service_role: Vorpruefung fuer Olli meldet 'blockiert'" "true" "$(jq -r '.blocked' <<<"$res" 2>/dev/null || echo "$res")"
  check V "@RE-011 sie nennt zwei Turniere (davon eines im Papierkorb), Mitgliedschaften und Eintraege als Zahlen" "2|1|0|2" "$(jq -r '"\(.owned_tournaments|length)|\([.owned_tournaments[]|select(.in_trash)]|length)|\(.memberships)|\(.refs_set_null.match_event_authors_user_id)"' <<<"$res" 2>/dev/null || echo "$res")"
  check V "@RE-011 weder Name noch E-Mail im Ergebnis (0 Treffer auf Anzeigenamen und Adressen)" "0" "$(grep -ciE 'kl\.test|@|Olli|Maria|Udo|Karl|Kira|Frei' <<<"$res" || true)"
  check V "@RE-011 unbelastetes Konto (Frei): nicht blockiert, keine Turniere" "false|0" "$(jq -r '"\(.blocked)|\(.owned_tournaments|length)"' <<<"$(q "SET ROLE service_role; SELECT public.account_deletion_check('$U_FREI');")" 2>/dev/null || echo "?")"
  has V "@RE-011 angemeldete Nutzer (authenticated) koennen die Vorpruefung nicht aufrufen" "permission denied" "$(q "SET ROLE authenticated; SELECT public.account_deletion_check('$U_FREI');")"
  has V "@RE-011 anon kann die Vorpruefung nicht aufrufen" "permission denied" "$(q "SET ROLE anon; SELECT public.account_deletion_check('$U_FREI');")"
  check V "@RE-011 nur postgres (Eigentuemer) und service_role haben EXECUTE" "{postgres,service_role}" "$(q "SELECT array_agg(DISTINCT r.rolname ORDER BY r.rolname)::text FROM pg_proc p, aclexplode(p.proacl) a JOIN pg_roles r ON r.oid = a.grantee WHERE p.oid = to_regprocedure('public.account_deletion_check(uuid)') AND a.privilege_type = 'EXECUTE';")"
  # --- R: @RE-009 -------------------------------------------------------------------------------------------------------------------
  CNT_M="$(q 'SELECT count(*) FROM public.matches;')"; CNT_E="$(q 'SELECT count(*) FROM public.match_events;')"; CNT_A="$(q 'SELECT count(*) FROM public.match_event_authors;')"
  N0="$(q "SELECT md5(string_agg((to_jsonb(m) - 'last_modified_by' - 'updated_at')::text, '|' ORDER BY m.id)) FROM public.matches m;")"
  CORR0="$(q "SELECT count(*) || '/' || md5(string_agg((to_jsonb(c) - 'corrected_by')::text, '|' ORDER BY c.id)) FROM public.match_corrections c;")"
  EV0="$(q "SELECT md5(string_agg(to_jsonb(e)::text, '|' ORDER BY e.id)) FROM public.match_events e;")"
  AUT0="$(q "SELECT md5(string_agg((to_jsonb(a) - 'user_id')::text, '|' ORDER BY a.event_id)) FROM public.match_event_authors a;")"
  VER0="$(q "SELECT string_agg(id || '=' || version, ',' ORDER BY id) FROM public.matches;")"
  check R "@RE-009 Udo (Ergebnis und Berichtigung): Konto wird geloescht" "DELETE 1" "$(deluser "$U_UDO")"
  check R "@RE-009 Udos Profil und Mitgliedschaft sind weg" "0|0" "$(q "SELECT (SELECT count(*) FROM public.profiles WHERE id='$U_UDO') || '|' || (SELECT count(*) FROM public.tournament_collaborators WHERE user_id='$U_UDO');")"
  check R "@RE-009 Maria (hat eingeladen): Konto wird geloescht" "DELETE 1" "$(deluser "$U_MARIA")"
  check R "@RE-009 Tom (anonymer Helfer, Anpfiff): Konto wird geloescht" "DELETE 1" "$(deluser "$U_TOM")"
  check R "@RE-009 Verweise der geloeschten Konten sind NULL (matches, tournaments, match_corrections)" "0|0|0" "$(q "SELECT (SELECT count(*) FROM public.matches WHERE last_modified_by IN ('$U_UDO','$U_TOM','$U_MARIA')) || '|' || (SELECT count(*) FROM public.tournaments WHERE last_modified_by IN ('$U_UDO','$U_TOM')) || '|' || (SELECT count(*) FROM public.match_corrections WHERE corrected_by='$U_UDO');")"
  check R "@RE-009 Zeilenzahl Spiele, Ereignisse, Urheberzeilen unveraendert" "$CNT_M|$CNT_E|$CNT_A" "$(q 'SELECT count(*)::text FROM public.matches;')|$(q 'SELECT count(*)::text FROM public.match_events;')|$(q 'SELECT count(*)::text FROM public.match_event_authors;')"
  check R "@RE-009 Spiele (Ergebnisse) bis auf den Verweis (und den Zeitstempel updated_at der Zeile) unveraendert" "$N0" "$(q "SELECT md5(string_agg((to_jsonb(m) - 'last_modified_by' - 'updated_at')::text, '|' ORDER BY m.id)) FROM public.matches m;")"
  check R "@RE-009 die Berichtigung bleibt (1 Zeile, Werte unveraendert)" "$CORR0" "$(q "SELECT count(*) || '/' || md5(string_agg((to_jsonb(c) - 'corrected_by')::text, '|' ORDER BY c.id)) FROM public.match_corrections c;")"
  check R "@RE-009 Ereignisse unveraendert (md5 ueber alle Spalten)" "$EV0" "$(q "SELECT md5(string_agg(to_jsonb(e)::text, '|' ORDER BY e.id)) FROM public.match_events e;")"
  check R "@RE-009 Urheberzeilen bis auf user_id unveraendert" "$AUT0" "$(q "SELECT md5(string_agg((to_jsonb(a) - 'user_id')::text, '|' ORDER BY a.event_id)) FROM public.match_event_authors a;")"
  check R "@RE-009 Zaehler (matches.version) unveraendert" "$VER0" "$(q "SELECT string_agg(id || '=' || version, ',' ORDER BY id) FROM public.matches;")"
  check R "@RE-009 Ereignis von Udo bleibt lesbar, Name und Rolle fallen weg" "rows:1:NULL|NULL" "$(names "$U_OLLI" "$S3")"
  check R "@RE-009 Ereignis von Tom bleibt lesbar, Name und Rolle fallen weg" "rows:1:NULL|NULL" "$(names "$U_OLLI" "$S2")"
  check R "@RE-009 Einladungszeilen bleiben, Kennung des Einladenden bleibt stehen (Fremdschluessel entfaellt)" "0|$U_MARIA" "$(q "SELECT count(*) FILTER (WHERE user_id IN ('$U_UDO','$U_TOM')) || '|' || coalesce(max(invited_by::text) FILTER (WHERE user_id = '$U_KIM'), '') FROM public.tournament_collaborators;")"
  # --- S: @RE-010 -------------------------------------------------------------------------------------------------------------------
  CS_O1="$(q "SELECT harness.cs($OLLI_IDS);")"
  has S "@RE-010 Olli (veroeffentlichtes Turnier + Papierkorb-Turnier): Loeschen wird von der Datenbank abgelehnt" "ERROR.*violates foreign key constraint \"tournaments_owner_id_fkey\"" "$(q "DELETE FROM auth.users WHERE id='$U_OLLI';")"
  check S "@RE-010 Ollis Konto und Profil bestehen weiter" "1|1" "$(q "SELECT (SELECT count(*) FROM auth.users WHERE id='$U_OLLI') || '|' || (SELECT count(*) FROM public.profiles WHERE id='$U_OLLI');")"
  check S "@RE-010 beide Turniere mit Teams, Spielen, Ereignissen, Urhebern, Uebergaengen: Pruefsumme ueber alle Zeilen identisch" "$CS_O1" "$(q "SELECT harness.cs($OLLI_IDS);")"
  check S "@RE-010 das Turnier ist weiter veroeffentlicht und nicht im Papierkorb" "published|true|NIKO26|false" "$(q "SELECT status || '|' || is_public || '|' || share_code || '|' || (deleted_at IS NOT NULL) FROM public.tournaments WHERE id='$T';")"
  has S "@RE-010 ein Konto mit nur einem Papierkorb-Turnier wird ebenfalls abgelehnt" "tournaments_owner_id_fkey" "$(q "DELETE FROM auth.users WHERE id='$U_TRASHONLY';")"
  check S "@RE-010 fremde Turniere unveraendert (Pruefsumme)" "$CS_F0" "$(q "SELECT harness.cs($FREMD_IDS);")"
  check S "@RE-010 zuerst beide Turniere bewusst loeschen (Betreiber, postgres): 2 Zeilen" "DELETE 2" "$(q "WITH d AS (DELETE FROM public.tournaments WHERE owner_id='$U_OLLI' RETURNING 1) SELECT 'DELETE ' || count(*) FROM d;")"
  check S "@RE-010 danach laesst sich das Konto loeschen" "DELETE 1" "$(deluser "$U_OLLI")"
  check S "@RE-010 fremde Turniere weiter unveraendert" "$CS_F0" "$(q "SELECT harness.cs($FREMD_IDS);")"
}

# --- H: Hin- und Rueckweg, Fail-fast, Sperre --------------------------------------------------------------------------------------
run_H() {
  local RULES_1 RULES_0="$RULES_VORHER" d1 d2 E
  RULES_1="$(rules)"
  check H "nach der Migration: drei SET NULL, Eigentuemer RESTRICT, invited_by-Fremdschluessel entfernt" "match_corrections_corrected_by_fkey=n matches_last_modified_by_fkey=n tournaments_last_modified_by_fkey=n tournaments_owner_id_fkey=r" "$RULES_1"
  schema_dump > "$WORK/s1.sql"
  check H "zweimal einspielbar (keine Ausgabe, kein Fehler)" "" "$(qfile "$TARGET_FILE")"
  schema_dump > "$WORK/s2.sql"
  check H "zweites Einspielen: Schema unveraendert" "$(sum_of < "$WORK/s1.sql")" "$(sum_of < "$WORK/s2.sql")"
  check H "Schema-Diff: genau die vier Regeln (3 SET NULL, RESTRICT) + invited_by entfernt: 9 Zeilen mit ADD CONSTRAINT" "9" "$(diff "$WORK/schema_vorher.sql" "$WORK/s1.sql" | grep -cE '^[<>].*ADD CONSTRAINT' || true)"
  check H "Rueckweg: Ausgabe leer" "" "$(qfile "$ROLLBACK_FILE")"
  check H "Rueckweg: alle fuenf Regeln wie vorher" "$RULES_0" "$(rules)"
  check H "Rueckweg: invited_by-Fremdschluessel kommt als NOT VALID zurueck (Kennungen geloeschter Konten stehen darin)" "f" "$(q "SELECT convalidated::text FROM pg_constraint WHERE conname='tournament_collaborators_invited_by_fkey';" | sed 's/^false$/f/; s/^true$/t/')"
  schema_dump > "$WORK/s3.sql"
  check H "Rueckweg: Schema (public) = vorher, ohne Kommentare, NOT VALID normalisiert" "" "$(diff <(grep -v 'COMMENT ON' "$WORK/schema_vorher.sql") <(grep -v 'COMMENT ON' "$WORK/s3.sql" | sed 's/ NOT VALID;$/;/') | sed -n 1,5p | tr '\n' ' ')"
  check H "Rueckweg: Funktion entfernt" "" "$(q "SELECT to_regprocedure('public.account_deletion_check(uuid)');")"
  check H "Rueckweg zweimal einspielbar, Regeln gleich" "$RULES_0" "$(qfile "$ROLLBACK_FILE" >/dev/null; rules)"
  # naive Reparatur (nur die drei/vier Verweise, Eigentuemer bleibt CASCADE): belegt, warum RESTRICT noetig ist
  psql_stdin <<'SQL'
BEGIN;
ALTER TABLE public.matches DROP CONSTRAINT matches_last_modified_by_fkey, ADD CONSTRAINT matches_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tournaments DROP CONSTRAINT tournaments_last_modified_by_fkey, ADD CONSTRAINT tournaments_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.match_corrections DROP CONSTRAINT match_corrections_corrected_by_fkey, ADD CONSTRAINT match_corrections_corrected_by_fkey FOREIGN KEY (corrected_by) REFERENCES auth.users(id) ON DELETE SET NULL;
COMMIT;
SQL
  check H "Beleg der Gefahr: nur die Verweise repariert, CASCADE bleibt -> das Konto-Loeschen nimmt das Turnier mit (Transaktion mit ROLLBACK)" "turniere_danach=0 spiele_danach=0" "$(q "BEGIN; DELETE FROM auth.users WHERE id='$U_STRANGER'; SELECT 'turniere_danach=' || (SELECT count(*) FROM public.tournaments WHERE id='$T_OTHER') || ' spiele_danach=' || (SELECT count(*) FROM public.matches WHERE tournament_id='$T_OTHER'); ROLLBACK;" | sed 's/ *ROLLBACK.*//')"
  psql_stdin <<'SQL'
BEGIN;
ALTER TABLE public.matches DROP CONSTRAINT matches_last_modified_by_fkey, ADD CONSTRAINT matches_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES auth.users(id);
ALTER TABLE public.tournaments DROP CONSTRAINT tournaments_last_modified_by_fkey, ADD CONSTRAINT tournaments_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES auth.users(id);
ALTER TABLE public.match_corrections DROP CONSTRAINT match_corrections_corrected_by_fkey, ADD CONSTRAINT match_corrections_corrected_by_fkey FOREIGN KEY (corrected_by) REFERENCES auth.users(id);
COMMIT;
SQL
  # Fail-fast
  q "ALTER TABLE public.matches DROP CONSTRAINT matches_last_modified_by_fkey;" >/dev/null
  has H "Fail-fast: fehlender Fremdschluessel -> Abbruch mit Meldung" "20261128_001_konto_loeschen: Fremdschluessel matches_last_modified_by_fkey" "$(qfile "$TARGET_FILE")"
  q "ALTER TABLE public.matches ADD CONSTRAINT matches_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES auth.users(id) ON DELETE CASCADE;" >/dev/null
  has H "Fail-fast: unerwartete Regel (CASCADE) -> Abbruch" "unerwartete ON DELETE-Regel" "$(qfile "$TARGET_FILE")"
  q "ALTER TABLE public.matches DROP CONSTRAINT matches_last_modified_by_fkey; ALTER TABLE public.matches ADD CONSTRAINT matches_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES auth.users(id);" >/dev/null
  check H "Fail-fast: danach (Abbruch ohne Aenderung) Regeln wie vorher" "$RULES_0" "$(rules)"
  # Sperr-Timeout: eine offene Transaktion auf tournaments haelt die Migration auf
  docker exec -d "$C" psql -U postgres -X -q -c "BEGIN; SELECT count(*) FROM public.tournaments; SELECT pg_sleep(14); COMMIT;"
  sleep 2
  E="$(qfile "$TARGET_FILE")"
  has H "Sperre: Migration gibt nach lock_timeout (5 s) auf" "lock timeout|55P03" "$E"
  check H "Sperre: nach dem Abbruch nichts veraendert" "$RULES_0" "$(rules)"
  sleep 13
  check H "nach Freigabe der Sperre laeuft die Migration durch" "" "$(qfile "$TARGET_FILE")"
  check H "und der Zustand ist wieder 'nach der Migration'" "$RULES_1" "$(rules)"
}

RULES_VORHER=""
# Mutationen: je eine zurueckgenommene Regel bzw. ein Rechtefehler, NACH der echten Migration; die genannte Kategorie muss rot werden.
MUTATIONS=(
  "owner-cascade|S|ALTER TABLE public.tournaments DROP CONSTRAINT tournaments_owner_id_fkey, ADD CONSTRAINT tournaments_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;"
  "matches-no-action|R|ALTER TABLE public.matches DROP CONSTRAINT matches_last_modified_by_fkey, ADD CONSTRAINT matches_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES auth.users(id);"
  "tournaments-no-action|R|ALTER TABLE public.tournaments DROP CONSTRAINT tournaments_last_modified_by_fkey, ADD CONSTRAINT tournaments_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES auth.users(id);"
  "corrections-no-action|R|ALTER TABLE public.match_corrections DROP CONSTRAINT match_corrections_corrected_by_fkey, ADD CONSTRAINT match_corrections_corrected_by_fkey FOREIGN KEY (corrected_by) REFERENCES auth.users(id);"
  "invited-by-fk-bleibt|R|ALTER TABLE public.tournament_collaborators ADD CONSTRAINT tournament_collaborators_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);"
  "vorpruefung-fuer-angemeldete|V|GRANT EXECUTE ON FUNCTION public.account_deletion_check(uuid) TO authenticated;"
  "vorpruefung-fuer-anon|V|GRANT EXECUTE ON FUNCTION public.account_deletion_check(uuid) TO anon;"
  "vorpruefung-mit-adresse|V|CREATE OR REPLACE FUNCTION public.account_deletion_check(p_user_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS \$f\$ SELECT jsonb_build_object('blocked', EXISTS (SELECT 1 FROM public.tournaments t WHERE t.owner_id = p_user_id), 'owned_tournaments', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'in_trash', t.deleted_at IS NOT NULL)), '[]'::jsonb) FROM public.tournaments t WHERE t.owner_id = p_user_id), 'memberships', 0, 'refs_set_null', jsonb_build_object('match_event_authors_user_id', 2), 'email', (SELECT email FROM public.profiles WHERE id = p_user_id)) \$f\$;"
)

run_suite() { # <Mutation|""> <Umfang: rsv|rsvh>
  local mut="$1" full="$2"
  prepare
  schema_dump > "$WORK/schema_vorher.sql"
  RULES_VORHER="$(rules)"
  if [[ "$MODE" == "without-migration" ]]; then run_RSV; return 0; fi
  if [[ -z "$mut" ]]; then
    has A "Udo (Co-Admin mit Ergebnis und Berichtigung): Loeschen scheitert heute an einem Fremdschluessel" "ERROR.*violates foreign key constraint" "$(q "DELETE FROM auth.users WHERE id='$U_UDO';")"
    has A "Tom (anonymer Helfer mit Anpfiff): Loeschen scheitert heute an einem Fremdschluessel" "ERROR.*violates foreign key constraint" "$(q "DELETE FROM auth.users WHERE id='$U_TOM';")"
    has A "Olli (Eigentuemer): Loeschen scheitert heute ebenfalls (an den Verweisen), Turniere unveraendert" "ERROR.*violates foreign key constraint" "$(q "DELETE FROM auth.users WHERE id='$U_OLLI';")"
    check A "Turniere von Olli nach den abgelehnten Versuchen unveraendert (2 Turniere da)" "2" "$(q "SELECT count(*) FROM public.tournaments WHERE owner_id='$U_OLLI';")"
  fi
  local PV="" PN="" out PRIV0="" PRIV1=""
  if [[ -z "$mut" ]]; then PRIV0="$(priv_run)"; fi
  [[ -z "$mut" ]] && PV="$(rowq "$REPO_ROOT/scripts/konto-loeschen-vorher.sql")"
  out="$(psql_stdin < "$TARGET_FILE" 2>&1 | tr '\n' ' ')"
  [[ -z "$mut" ]] && check H "Migration spielt ohne Fehler ein (keine Ausgabe)" "" "$out"
  local f; for f in ${AFTER[@]+"${AFTER[@]}"}; do psql_stdin < "$f" >/dev/null; done
  [[ -n "$mut" ]] && q "$mut" >/dev/null
  if [[ -z "$mut" ]]; then
    PN="$(rowq "$REPO_ROOT/scripts/konto-loeschen-nachher.sql")"
    PRIV1="$(priv_run)"
    check H "Rechte-Zusicherungen (db_privilege_assertions.sql als ci_schema_reader) VOR der Migration: die zwei konto-loeschen-* sind |f" "konto-loeschen-check-function-service-role-only|f konto-loeschen-fk-rules|f" "$(grep '^konto-loeschen-' <<<"$PRIV0" | sort | tr '\n' ' ' | sed 's/ *$//')"
    check H "Rechte-Zusicherungen NACH der Migration: alle Zeilen |t, die zwei konto-loeschen-* dabei" "keine|2" "$(NF="$(grep -v '|t$' <<<"$PRIV1" | sed -n 1,3p | tr '\n' ';')"; echo "${NF:-keine}")|$(grep -c '^konto-loeschen-.*|t$' <<<"$PRIV1" || true)"
    check H "Pruefabfrage VORHER (scripts/konto-loeschen-vorher.sql) auf dem Stand vor der Migration: urteil OK" "OK" "${PV%%|*}"
    check H "Pruefabfrage NACHHER (scripts/konto-loeschen-nachher.sql): urteil OK" "OK" "${PN%%|*}"
    check H "Pruefsummen vorher = nachher (die Migration aendert und loescht keine Zeile)" "${PV##*|}" "${PN##*|}"
    check H "Pruefabfrage VORHER auf dem Stand NACH der Migration ist ABWEICHUNG (sie erkennt den Zustand)" "ABWEICHUNG" "$(rowq "$REPO_ROOT/scripts/konto-loeschen-vorher.sql" | cut -d'|' -f1)"
  fi
  run_RSV
  if [[ "$full" == "rsvh" ]]; then run_H; fi
  return 0
}

summary() { local i; for i in "${!CATS[@]}"; do echo "  Kategorie ${CATS[$i]}: ${OKS[$i]} in Ordnung, ${DEVS[$i]} Abweichungen"; done; }

case "$MODE" in
  normal)
    run_suite "" rsvh
    echo; echo "== Ergebnis =="; summary
    [[ "$(total_dev)" -eq 0 ]] || { echo "::error::Abweichungen: $(total_dev)" >&2; exit 1; }
    echo "Alles wie erwartet." ;;
  without-migration)
    run_suite "" rsv
    echo; echo "== Gegenprobe A (ohne Migration) =="; summary
    for k in R S V; do
      [[ "${DEVS[$(cat_index $k)]}" -gt 0 ]] || { echo "::error::Gegenprobe A: Kategorie $k ist ohne die Migration nicht rot -- der Check erkennt den Fehler nicht." >&2; exit 1; }
    done
    echo "Gegenprobe A bestanden: R, S, V sind ohne Migration rot." ;;
  gegenprobe)
    fail=0
    for m in "${MUTATIONS[@]}"; do
      name="${m%%|*}"; rest="${m#*|}"; kat="${rest%%|*}"; sql="${rest#*|}"
      reset_counts
      echo; echo "== Mutation $name (Kategorie $kat muss rot werden) =="
      QUIET=1 run_suite "$sql" rsv
      if [[ "${DEVS[$(cat_index "$kat")]}" -gt 0 ]]; then echo "  -> rot in $kat (${DEVS[$(cat_index "$kat")]} Abweichungen): Mutation erkannt"
      else echo "::error::Mutation $name: Kategorie $kat blieb gruen -- der Check erkennt die Mutation nicht." >&2; fail=1; fi
    done
    [[ "$fail" -eq 0 ]] || exit 1
    echo; echo "Gegenprobe B bestanden: jede Mutation macht ihre Kategorie rot." ;;
esac
