#!/usr/bin/env bash
#
# match-slots-check.sh — Container-Beweis fuer supabase/migrations/20261003_001_match_slots.sql
# (A-02, MVP-Bauplan Spur A, GA1; Vorlage V-TEAM-Plan A4). Muster: scripts/protect-matches-with-
# events-check.sh (Wegwerf-Container supabase/postgres, Baseline + Migrationen seit Baseline,
# `request.jwt.claim.sub` + `role` wie PostgREST).
#
# Was gemessen wird:
#   Bestandsdaten (Bauplan E-A5) -- Migration auf einer DB mit Altzeilen:
#     B1 Gegenbeispiel: Altzeile mit Platzhalter „Team X“ (keine UUID) -> Migration SCHEITERT,
#        und es bleibt NICHTS zurueck (keine neuen Spalten, kein Backfill der UUID-Altzeile).
#     B2 nach Entfernen der Zeile: Migration laeuft; Altzeile „Platzhalter = Team-UUID“ traegt jetzt
#        team_a_id/team_b_id, Platzhalter NULL.
#     B3 zweites Einspielen -> ok (idempotent).
#   Pflicht (@FU-001): ein FRISCH ANGELEGTES Turnier (echter App-Weg, scripts/match-slots-fixture.ts:
#     TournamentCreationService.publish -> mapTournamentToSupabase) wird eingefuegt;
#     P1 jedes Spiel hat je Seite Team-ID oder Herkunft, kein Platzhalter-Text,
#     P2 append_match_events (Eigentuemer) nimmt MATCH_START + GOAL im Gruppenspiel an,
#     P3 offenes Finalspiel -> 22023 (Bestand: Engine startet erst mit zwei Teams).
#   Pruefregeln (fast richtig -> 23514): beide Seiten leer, rank 0, rank als Text, matchId 'semi1',
#     Zusatzschluessel; gueltige Herkunft -> ok.
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener
# Wegwerf-Container, wird am Ende entfernt (trap).
#
set -euo pipefail

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie rls-role-matrix.sh / protect-matches-with-events-check.sh
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261003_001_match_slots.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
CONTAINER_NAME="match-slots-check-$$"

command -v jq >/dev/null 2>&1 || { echo "::error::jq wird benoetigt." >&2; exit 1; }
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
if [[ "$SEEN_TARGET" -ne 1 ]]; then
  echo "::error::$TARGET_NAME nicht in der Liste 'neuer als Baseline'." >&2
  exit 1
fi

# Fixture ZUERST erzeugen (braucht nur Node) -- scheitert es, wird kein Container gestartet.
uuid_for() {
  local h
  h="$(printf '%s' "match-slots-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-4${h:9:3}-8${h:13:3}-${h:16:4}-${h:20:12}"
}
U_OWNER="$(uuid_for user:owner)"
FIXTURE_JSON="$(cd "$REPO_ROOT" && npx --yes tsx scripts/match-slots-fixture.ts "$U_OWNER")"

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

DEV=0
OK=0
check() { # check <Name> <erwartet> <erhalten>
  if [[ "$2" == "$3" ]]; then
    OK=$((OK + 1)); echo "OK          $1"
  else
    DEV=$((DEV + 1)); echo "ABWEICHUNG  $1"; echo "    erwartet: $2"; echo "    erhalten: $3"
  fi
}

echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
psql_stdin < "$BASELINE_FILE"
for f in "${BEFORE[@]}"; do psql_stdin < "$f"; done

# --- Bestandsdaten (Altformat: Team-UUID als Text im Platzhalter, team_x_id NULL) ---------------
T_OLD="$(uuid_for tournament:old)"
TEAM_NORD="$(uuid_for team:nord)"
TEAM_SUED="$(uuid_for team:sued)"
M_OLD_UUID="$(uuid_for match:old-uuid)"
M_OLD_BAD="$(uuid_for match:old-team-x)"
psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '$U_OWNER', 'authenticated', 'authenticated',
        'owner@match-slots.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration)
VALUES ('$T_OLD', '$U_OWNER', 'Altbestand', '2026-09-20', 2, 10);
INSERT INTO public.teams (id, tournament_id, name) VALUES ('$TEAM_NORD', '$T_OLD', 'FC Nord'), ('$TEAM_SUED', '$T_OLD', 'SV Süd');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, team_a_placeholder, team_b_placeholder)
VALUES ('$M_OLD_UUID', '$T_OLD', 1, 1, NULL, NULL, '$TEAM_NORD', '$TEAM_SUED'),
       ('$M_OLD_BAD',  '$T_OLD', 2, 1, NULL, '$TEAM_SUED', 'Team X', NULL);
SQL

echo "B1: Migration mit Altzeile „Team X“..." >&2
set +e
B1_OUT="$(psql_stdin < "$TARGET_FILE" 2>&1)"
B1_EXIT=$?
set -e
echo "    psql-Exit $B1_EXIT: $(printf '%s' "$B1_OUT" | grep -m1 ERROR || true)"
check "B1 Gegenbeispiel: Migration scheitert an Altzeile ohne Team-ID/Herkunft (Exit != 0)" "fehlgeschlagen" \
  "$([[ "$B1_EXIT" -ne 0 ]] && echo fehlgeschlagen || echo durchgelaufen)"
check "B1 Fehler kommt von der Pruefregel matches_slot_a_present" "ja" \
  "$(grep -q 'matches_slot_a_present' <<<"$B1_OUT" && echo ja || echo nein)"
check "B1 nichts zurueckgeblieben: Spalte slot_a_source existiert nicht" "0" \
  "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='matches' AND column_name='slot_a_source';")"
check "B1 nichts zurueckgeblieben: Funktion match_engine.slot_source_valid existiert nicht" "f" \
  "$(q "SELECT to_regprocedure('match_engine.slot_source_valid(jsonb)') IS NOT NULL;")"
check "B1 nichts zurueckgeblieben: UUID-Altzeile unveraendert (team_a_id NULL, Platzhalter = UUID)" "|$TEAM_NORD" \
  "$(q "SELECT coalesce(team_a_id::text,'') || '|' || coalesce(team_a_placeholder,'') FROM public.matches WHERE id='$M_OLD_UUID';")"

echo "B2: Altzeile „Team X“ entfernen, Migration erneut..." >&2
q "DELETE FROM public.matches WHERE id='$M_OLD_BAD';" >/dev/null
psql_stdin < "$TARGET_FILE"
check "B2 Backfill: UUID-Altzeile traegt team_a_id/team_b_id, Platzhalter NULL" "$TEAM_NORD|$TEAM_SUED||" \
  "$(q "SELECT team_a_id || '|' || team_b_id || '|' || coalesce(team_a_placeholder,'') || '|' || coalesce(team_b_placeholder,'') FROM public.matches WHERE id='$M_OLD_UUID';")"
check "B2 alle vier Pruefregeln gueltig (convalidated)" "4" \
  "$(q "SELECT count(*) FROM pg_constraint WHERE conrelid='public.matches'::regclass AND convalidated AND conname IN ('matches_slot_a_present','matches_slot_b_present','matches_slot_a_source_valid','matches_slot_b_source_valid');")"

echo "B3: zweites Einspielen..." >&2
set +e
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
B3_EXIT=$?
set -e
check "B3 Idempotenz: zweites Einspielen laeuft (Exit 0)" "0" "$B3_EXIT"

for f in ${AFTER[@]+"${AFTER[@]}"}; do psql_stdin < "$f"; done

# --- Pflicht (@FU-001): frisch angelegtes Turnier ueber den App-Weg ----------------------------
echo "Pflicht: frisch angelegtes Turnier einspielen..." >&2
jq -r '.sql' <<<"$FIXTURE_JSON" | psql_stdin
T_NEW="$(jq -r '.tournamentId' <<<"$FIXTURE_JSON")"
M_GROUP="$(jq -r '.groupMatchId' <<<"$FIXTURE_JSON")"
M_TEAM_A="$(jq -r '.groupTeamAId' <<<"$FIXTURE_JSON")"
M_FINAL="$(jq -r '.finalMatchId' <<<"$FIXTURE_JSON")"
check "P1 alle $(jq -r '.matchCount' <<<"$FIXTURE_JSON") Spiele: je Seite Team-ID oder Herkunft, kein Platzhalter-Text" "0" \
  "$(q "SELECT count(*) FROM public.matches WHERE tournament_id='$T_NEW' AND ((team_a_id IS NULL AND slot_a_source IS NULL) OR (team_b_id IS NULL AND slot_b_source IS NULL) OR team_a_placeholder IS NOT NULL OR team_b_placeholder IS NOT NULL);")"
check "P1 Gruppenspiele tragen zwei Team-IDs desselben Turniers" "0" \
  "$(q "SELECT count(*) FROM public.matches m WHERE m.tournament_id='$T_NEW' AND m.is_final = false AND NOT EXISTS (SELECT 1 FROM public.teams a JOIN public.teams b ON b.tournament_id = a.tournament_id WHERE a.id = m.team_a_id AND b.id = m.team_b_id AND a.tournament_id = m.tournament_id);")"

psql_stdin <<'SQL'
CREATE FUNCTION public.__slots_call(p_user uuid, p_match uuid, p_events jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $fn$
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
E_START="$(uuid_for event:start)"
E_GOAL="$(uuid_for event:goal)"
EVENTS="[{\"id\":\"$E_START\",\"type\":\"MATCH_START\",\"at\":1000,\"section\":1,\"clockMs\":0,\"payload\":{}},{\"id\":\"$E_GOAL\",\"type\":\"GOAL\",\"at\":2000,\"section\":1,\"clockMs\":1000,\"teamId\":\"$M_TEAM_A\",\"payload\":{}}]"
P2_OUT="$(q "SELECT public.__slots_call('$U_OWNER', '$M_GROUP', \$J\$$EVENTS\$J\$::jsonb);")"
echo "    append_match_events (Gruppenspiel): $(jq -c '{exception, message, results: [.results[]? | {status, code}]}' <<<"$P2_OUT")"
check "P2 @FU-001 append_match_events nimmt MATCH_START + GOAL im frisch angelegten Turnier an" '["accepted","accepted"]' \
  "$(jq -c '[.results[]?.status]' <<<"$P2_OUT")"
check "P2 Tor zaehlt fuer das Heimteam (Zwischenspeicher score_a = 1)" "1|0" \
  "$(q "SELECT score_a || '|' || score_b FROM public.matches WHERE id='$M_GROUP';")"
P3_OUT="$(q "SELECT public.__slots_call('$U_OWNER', '$M_FINAL', \$J\$[{\"id\":\"$(uuid_for event:final-start)\",\"type\":\"MATCH_START\",\"at\":1000,\"section\":1,\"clockMs\":0,\"payload\":{}}]\$J\$::jsonb);")"
check "P3 offenes Finalspiel -> 22023 (Engine startet erst mit zwei Teams)" "22023" "$(jq -r '.exception // "keine"' <<<"$P3_OUT")"

# --- Pruefregeln: fast richtig -> 23514 ------------------------------------------------------
psql_stdin <<'SQL'
-- Versuchs-Insert in einer Untertransaktion: 'ok' (danach zurueckgerollt) oder der SQLSTATE.
CREATE FUNCTION public.__slots_try(p_tournament uuid, p_team_a uuid, p_team_b uuid, p_source jsonb) RETURNS text
LANGUAGE plpgsql AS $fn$
BEGIN
  BEGIN
    INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, slot_a_source)
    VALUES (gen_random_uuid(), p_tournament, 99, 1, p_team_a, p_team_b, p_source);
    RAISE EXCEPTION USING ERRCODE = 'P0999', MESSAGE = 'probe-ok';
  EXCEPTION WHEN OTHERS THEN
    RETURN CASE WHEN SQLSTATE = 'P0999' THEN 'ok' ELSE SQLSTATE END;
  END;
END;
$fn$;
SQL
probe() { # probe <Name> <erwartet ok|23514> <slot_a_source-SQL> <team_a_id-SQL>
  check "Pruefregel: $1" "$2" "$(q "SELECT public.__slots_try('$T_NEW', $4, '$M_TEAM_A', $3);")"
}
probe "beide leer (keine Team-ID, keine Herkunft)" 23514 "NULL::jsonb" "NULL::uuid"
probe "gueltige Herkunft groupRank" ok "'{\"kind\":\"groupRank\",\"group\":\"A\",\"rank\":1}'" "NULL::uuid"
probe "gueltige Herkunft matchResult (UUID)" ok "'{\"kind\":\"matchResult\",\"matchId\":\"$M_GROUP\",\"role\":\"winner\"}'" "NULL::uuid"
OTHER_TEAM="$(q "SELECT id FROM public.teams WHERE tournament_id='$T_NEW' AND id <> '$M_TEAM_A' LIMIT 1;")"
probe "aufgeloest: Team-ID + Herkunft" ok "'{\"kind\":\"groupRank\",\"group\":\"A\",\"rank\":2}'" "'$OTHER_TEAM'::uuid"
probe "rank 0" 23514 "'{\"kind\":\"groupRank\",\"group\":\"A\",\"rank\":0}'" "NULL::uuid"
probe "rank als Text" 23514 "'{\"kind\":\"groupRank\",\"group\":\"A\",\"rank\":\"1\"}'" "NULL::uuid"
probe "matchId 'semi1' (keine UUID)" 23514 "'{\"kind\":\"matchResult\",\"matchId\":\"semi1\",\"role\":\"winner\"}'" "NULL::uuid"
probe "Zusatzschluessel name" 23514 "'{\"kind\":\"groupRank\",\"group\":\"A\",\"rank\":1,\"name\":\"FC Nord\"}'" "NULL::uuid"
probe "role draw" 23514 "'{\"kind\":\"matchResult\",\"matchId\":\"$M_GROUP\",\"role\":\"draw\"}'" "NULL::uuid"

echo
echo "Ergebnis: $OK OK, $DEV Abweichung(en)."
[[ "$DEV" -eq 0 ]]
