#!/usr/bin/env bash
#
# match-origin-check.sh — Container-Beweis fuer supabase/migrations/20261026_001_match_origin.sql
# (A-36a, MVP-Bauplan § 23). Muster: scripts/match-slots-check.sh (Wegwerf-Container
# supabase/postgres, Baseline + Migrationen seit Baseline, Aufraeumen per trap).
#
# Was gemessen wird:
#   V  Vorab-Zaehlung (Prognose-SQL aus dem Brief) auf Bestandsdaten: keine ungueltige Herkunft.
#   B  Backfill: offene Seite -> origin = slot_x_source; automatisch besetzte Seite -> origin =
#      resolvedFrom (slot_x_source); von Hand besetzte Seite und Gruppenspiel -> NULL.
#   S  Schema: zwei Spalten, zwei gueltige Pruefregeln, Trigger aktiv; Katalogzaehlung
#      (scripts/db_catalog_counts.py) Spalten +2, Funktionen +1, Trigger +1; pg_constraint +2.
#   U  Unveraenderlich (Trigger matches_keep_origin):
#      U1 anderer Wert -> HF002; U2 NULL im Update -> alter Wert bleibt; U3 gleicher Wert -> ok;
#      U4 „Neu besetzen“ (team_a_id/slot_a_source aendern, origin nicht genannt) -> ok, origin bleibt;
#      U5 NULL -> Wert (Altzeile, einmal setzen) -> ok.
#   I  Pruefregel beim Anlegen: ungueltige Herkunft -> 23514, gueltige -> ok.
#   R  Rechte-Assertion scripts/db_privilege_assertions.sql als ci_schema_reader: alle Zeilen |t.
#   W  zweites Einspielen -> ok (idempotent), Werte unveraendert.
#   X  Rueckbau-Kommentar aus der Migration ausfuehren -> Schema (pg_dump public) = vor der Migration.
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener
# Wegwerf-Container, wird am Ende entfernt (trap). Keine Dateien ausserhalb des Containers.
#
set -euo pipefail

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie match-slots-check.sh / rls-role-matrix.sh
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261026_001_match_origin.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
CONTAINER_NAME="match-origin-check-$$"

[[ -f "$TARGET_FILE" ]] || { echo "::error::$TARGET_NAME fehlt." >&2; exit 1; }

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
[[ "$SEEN_TARGET" -eq 1 ]] || { echo "::error::$TARGET_NAME nicht in der Liste 'neuer als Baseline'." >&2; exit 1; }

cleanup() { docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=postgres -p 5432 "$POSTGRES_IMAGE" >/dev/null
READY=0
for _ in $(seq 1 90); do
  if [[ "$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "$READY" -ne 1 ]]; then
  echo "::error::Container wurde nach 90s nicht bereit." >&2
  docker logs "$CONTAINER_NAME" 2>&1 | tail -30 >&2
  exit 1
fi
for _ in $(seq 1 30); do
  docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

psql_stdin() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 -q
}
psql_value() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA
}
q() { psql_value <<<"$1"; }
# \restrict/\unrestrict tragen einen Zufallsschluessel je Lauf (pg_dump 17.6) -- fuer den Vergleich entfernt.
schema_dump() { docker exec "$CONTAINER_NAME" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }

DEV=0
OK=0
check() { # check <Name> <erwartet> <erhalten>
  if [[ "$2" == "$3" ]]; then
    OK=$((OK + 1)); echo "OK          $1"
  else
    DEV=$((DEV + 1)); echo "ABWEICHUNG  $1"; echo "    erwartet: $2"; echo "    erhalten: $3"
  fi
}

uuid_for() {
  local h
  h="$(printf '%s' "match-origin-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-4${h:9:3}-8${h:13:3}-${h:16:4}-${h:20:12}"
}

echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
psql_stdin < "$BASELINE_FILE"
for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done

# --- Bestandsdaten ------------------------------------------------------------------------------
U_OWNER="$(uuid_for user:owner)"
T1="$(uuid_for tournament:hallencup)"
TEAM_NORD="$(uuid_for team:nord)"; TEAM_SUED="$(uuid_for team:sued)"; TEAM_WEST="$(uuid_for team:west)"
M_GRP="$(uuid_for match:gruppe)"; M_OPEN="$(uuid_for match:hf1-offen)"
M_AUTO="$(uuid_for match:hf2-automatisch)"; M_HAND="$(uuid_for match:finale-von-hand)"
A1='{"kind":"groupRank","group":"A","rank":1}'
B2='{"kind":"groupRank","group":"B","rank":2}'
B1='{"kind":"groupRank","group":"B","rank":1}'
A2='{"kind":"groupRank","group":"A","rank":2}'
psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '$U_OWNER', 'authenticated', 'authenticated',
        'owner@match-origin.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration)
VALUES ('$T1', '$U_OWNER', 'Hallencup Nord', '2026-10-26', 3, 10);
INSERT INTO public.teams (id, tournament_id, name)
VALUES ('$TEAM_NORD', '$T1', 'FC Nord'), ('$TEAM_SUED', '$T1', 'SV Süd'), ('$TEAM_WEST', '$T1', 'TSV West');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, slot_a_source, slot_b_source, is_final, phase)
VALUES ('$M_GRP',  '$T1', 1, 1, '$TEAM_NORD', '$TEAM_SUED', NULL, NULL, false, 'groupStage'),
       ('$M_OPEN', '$T1', 2, 1, NULL, NULL, '$A1', '$B2', true, 'semifinal'),
       ('$M_AUTO', '$T1', 2, 2, '$TEAM_SUED', NULL, '$B1', '$A2', true, 'semifinal'),
       ('$M_HAND', '$T1', 3, 1, '$TEAM_WEST', '$TEAM_NORD', NULL, NULL, true, 'final');
SQL

# --- V: Prognose-Zaehlung aus dem Brief (nur lesen) --------------------------------------------
check "V Prognose: backfill_a|backfill_b|final_ohne_herkunft_a|final_ohne_herkunft_b|ungueltig_a|ungueltig_b" "2|2|1|1|0|0" \
  "$(q "SELECT
  count(*) FILTER (WHERE slot_a_source IS NOT NULL) || '|' ||
  count(*) FILTER (WHERE slot_b_source IS NOT NULL) || '|' ||
  count(*) FILTER (WHERE phase <> 'groupStage' AND slot_a_source IS NULL) || '|' ||
  count(*) FILTER (WHERE phase <> 'groupStage' AND slot_b_source IS NULL) || '|' ||
  count(*) FILTER (WHERE slot_a_source IS NOT NULL AND NOT match_engine.slot_source_valid(slot_a_source)) || '|' ||
  count(*) FILTER (WHERE slot_b_source IS NOT NULL AND NOT match_engine.slot_source_valid(slot_b_source))
FROM public.matches;")"

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
CONSTRAINTS_BEFORE="$(q "SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.matches'::regclass;")"

echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE"
# Spaetere Migrationen (AFTER) werden erst ganz am Ende eingespielt (A5, Review 17.10.): vorher
# wuerden sie S4 (Katalog-Delta) und X (Rueckbau-Vergleich) mitmessen, z. B. -3 Policies durch 20261028_002.

origin_of() { q "SELECT coalesce($2::text, 'NULL') FROM public.matches WHERE id = '$1';"; }

# --- B: Backfill ------------------------------------------------------------------------------------
check "B1 offene Seite: origin_a = slot_a_source (Erster A)" "$(q "SELECT '$A1'::jsonb::text;")" "$(origin_of "$M_OPEN" origin_a)"
check "B1 offene Seite: origin_b = slot_b_source (Zweiter B)" "$(q "SELECT '$B2'::jsonb::text;")" "$(origin_of "$M_OPEN" origin_b)"
check "B2 automatisch besetzt: origin_a = resolvedFrom (Erster B)" "$(q "SELECT '$B1'::jsonb::text;")" "$(origin_of "$M_AUTO" origin_a)"
check "B3 von Hand besetzt: origin_a/origin_b bleiben NULL (nie geraten)" "NULL|NULL" \
  "$(origin_of "$M_HAND" origin_a)|$(origin_of "$M_HAND" origin_b)"
check "B4 Gruppenspiel: keine Herkunft des Platzes" "NULL|NULL" "$(origin_of "$M_GRP" origin_a)|$(origin_of "$M_GRP" origin_b)"

# --- S: Schema ----------------------------------------------------------------------------------------
check "S1 Spalten origin_a/origin_b vom Typ jsonb" "origin_a:jsonb,origin_b:jsonb" \
  "$(q "SELECT string_agg(column_name || ':' || data_type, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema='public' AND table_name='matches' AND column_name IN ('origin_a','origin_b');")"
check "S2 Pruefregeln matches_origin_a_valid/_b_valid gueltig (convalidated)" "matches_origin_a_valid|true,matches_origin_b_valid|true" \
  "$(q "SELECT string_agg(conname || '|' || convalidated, ',' ORDER BY conname) FROM pg_constraint WHERE conname IN ('matches_origin_a_valid','matches_origin_b_valid');")"
check "S3 Trigger matches_keep_origin aktiv (tgenabled O)" "matches_keep_origin|O" \
  "$(q "SELECT tgname || '|' || tgenabled::text FROM pg_trigger WHERE tgname = 'matches_keep_origin';")"
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in columns functions triggers tables policies indexes rls_tables; do
  expected=0
  case "$dim" in columns) expected=2 ;; functions|triggers) expected=1 ;; esac
  check "S4 Katalogzaehlung $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
check "S5 pg_constraint an public.matches: Zuwachs" "2" \
  $(( $(q "SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.matches'::regclass;") - CONSTRAINTS_BEFORE ))

# --- U: unveraenderlich -------------------------------------------------------------------------------
psql_stdin <<'SQL'
-- Versuch in einer Untertransaktion: 'ok' (zurueckgerollt) oder der SQLSTATE.
CREATE FUNCTION public.__origin_try(p_sql text) RETURNS text
LANGUAGE plpgsql AS $fn$
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION USING ERRCODE = 'P0999', MESSAGE = 'probe-ok';
  EXCEPTION WHEN OTHERS THEN
    RETURN CASE WHEN SQLSTATE = 'P0999' THEN 'ok' ELSE SQLSTATE END;
  END;
END;
$fn$;
SQL
try_sql() { q "SELECT public.__origin_try(\$S\$$1\$S\$);"; }

check "U1 anderer Wert fuer origin_a -> HF002" "HF002" \
  "$(try_sql "UPDATE public.matches SET origin_a = '$A2' WHERE id = '$M_OPEN'")"
check "U1 anderer Wert fuer origin_b -> HF002" "HF002" \
  "$(try_sql "UPDATE public.matches SET origin_b = '$A1' WHERE id = '$M_OPEN'")"
q "UPDATE public.matches SET origin_a = NULL, origin_b = NULL WHERE id = '$M_OPEN';" >/dev/null
check "U2 NULL im Update -> alter Wert bleibt (beide Seiten)" "$(q "SELECT '$A1'::jsonb::text;")|$(q "SELECT '$B2'::jsonb::text;")" \
  "$(origin_of "$M_OPEN" origin_a)|$(origin_of "$M_OPEN" origin_b)"
check "U3 gleicher Wert -> ok" "ok" "$(try_sql "UPDATE public.matches SET origin_a = '$A1' WHERE id = '$M_OPEN'")"
q "UPDATE public.matches SET team_a_id = '$TEAM_WEST', slot_a_source = NULL WHERE id = '$M_OPEN';" >/dev/null
check "U4 Neu besetzen (team_a_id/slot_a_source) laesst origin_a stehen" "$TEAM_WEST|NULL|$(q "SELECT '$A1'::jsonb::text;")" \
  "$(q "SELECT team_a_id FROM public.matches WHERE id = '$M_OPEN';")|$(origin_of "$M_OPEN" slot_a_source)|$(origin_of "$M_OPEN" origin_a)"
check "U5 Altzeile ohne Herkunft: NULL -> Wert ist erlaubt (einmal setzen)" "ok" \
  "$(try_sql "UPDATE public.matches SET origin_a = '$A1' WHERE id = '$M_HAND'")"

# --- I: Pruefregel beim Anlegen ------------------------------------------------------------------------
insert_with_origin() {
  try_sql "INSERT INTO public.matches (id, tournament_id, round, field, slot_a_source, slot_b_source, origin_a, is_final)
           VALUES (gen_random_uuid(), '$T1', 9, 1, '$A1', '$B2', '$1', true)"
}
check "I1 ungueltige Herkunft (rank 0) -> 23514" "23514" "$(insert_with_origin '{"kind":"groupRank","group":"A","rank":0}')"
check "I1 ungueltige Herkunft (matchId semi1) -> 23514" "23514" "$(insert_with_origin '{"kind":"matchResult","matchId":"semi1","role":"winner"}')"
check "I2 gueltige Herkunft -> ok" "ok" "$(insert_with_origin "$A1")"

# --- R: Rechte-Assertion (alle Zeilen |t, inkl. der zwei neuen) ---------------------------------------
PRIV_OUT="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || PRIV_OUT="nicht ausfuehrbar: $PRIV_OUT"
# A5: Zeilen aus SPAETEREN Migrationen (20261028_002, Rechte auf match_events) sind in diesem Stand
# erwartungsgemaess f -- sie gehoeren nicht zum Ziel. Alles andere muss |t sein.
check "R Rechte-Assertion: keine Zeile |f (ausser Zeilen der spaeteren Migration 20261028_002)" "" "$(grep -v '|t$' <<<"$PRIV_OUT" | grep -v 'match-events' | grep -vE '^(matches-guard-engine-columns-forfeit-absent|group-completion-[a-z-]+|complete-group-locks-matches-before-tournament|ci-schema-reader-select-group-completion)\|' || true)"
check "R neue Zeilen vorhanden und |t" "matches-keep-origin-no-public-execute|t,matches-keep-origin-trigger-active|t" \
  "$(grep '^matches-keep-origin' <<<"$PRIV_OUT" | sort | paste -sd, -)"
check "R Engine-Zaehlung bleibt 52" "match-engine-function-count-52|t" "$(grep '^match-engine-function-count-52|' <<<"$PRIV_OUT" || true)"
q "DROP FUNCTION public.__origin_try(text);" >/dev/null

# --- W: idempotent ------------------------------------------------------------------------------------
set +e
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
W_EXIT=$?
set -e
check "W zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check "W danach genau 1 Trigger, 2 gueltige Pruefregeln" "1|2" \
  "$(q "SELECT count(*) FROM pg_trigger WHERE tgname = 'matches_keep_origin';")|$(q "SELECT count(*) FROM pg_constraint WHERE conname IN ('matches_origin_a_valid','matches_origin_b_valid') AND convalidated;")"
check "W Werte unveraendert (origin_a offenes HF1)" "$(q "SELECT '$A1'::jsonb::text;")" "$(origin_of "$M_OPEN" origin_a)"

# --- X: Rueckbau laut Kommentar ----------------------------------------------------------------------
ROLLBACK_SQL="$(awk '/^-- RUECKBAU/{f=1; next} f && /^--   Danach/{exit} f && /^--   /{sub(/^--   /, ""); print}' "$TARGET_FILE")"
check "X Rueckbau-Block gefunden (BEGIN ... COMMIT)" "BEGIN;|COMMIT;" "$(head -1 <<<"$ROLLBACK_SQL")|$(tail -1 <<<"$ROLLBACK_SQL")"
psql_stdin <<<"$ROLLBACK_SQL"
DUMP_ROLLED_BACK="$(schema_dump)"
check "X nach Rueckbau: Schema public = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi

# A5: spaetere Migrationen auf dem Zustand NACH dem Rueckbau einspielen -- nur als Lauffaehigkeits-
# Nachweis (psql_stdin bricht bei einem Fehler ab). Die Messungen oben sind davon unabhaengig.
for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f"
  echo "OK    A5 spaetere Migration laeuft nach dem Rueckbau: $(basename "$f")" >&2
done

echo
echo "Ergebnis: $OK OK, $DEV Abweichung(en)."
[[ "$DEV" -eq 0 ]]
