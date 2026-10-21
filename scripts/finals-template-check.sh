#!/usr/bin/env bash
#
# finals-template-check.sh — Container-Beweis für A-12a (Plan GA4 v2 § 5, @TM-004 Zeile „alle“, @TM-142):
# „Hallencup Nord“ mit der Vorlage „Alle Plätze“ (2 × 4) über den echten App-Weg (scripts/finals-template-fixture.ts:
# TournamentCreationService.publish → mapTournamentToSupabase) in eine Datenbank aus Baseline + allen Migrationen
# einfügen. Muster: scripts/match-slots-check.sh (Wegwerf-Container supabase/postgres).
#
# Was gemessen wird:
#   K1 Gruppenspiele, Halbfinale, Spiel um Platz 3 und Finale lassen sich einfügen.
#   K2 Halbfinale stehen mit phase = 'semifinal' in der Cloud (C-FINALPHASE-AUS-ID), Platz 3 und Finale mit 'final'.
#   K3 jede Seite eines Finalspiels hat eine Herkunft (origin_a/origin_b, @TM-004 „auf jeder Seite eine Herkunft“).
#   K4 Spiele um Platz 5 und 7 (final_type fifthSixth/seventhEighth) lassen sich einfügen.
#      Seit PR G1a (A-25b, `20261110_005` im Branch) scharf: PLATZ57_ERWARTET=gruen ist die Vorgabe (Befund
#      C-FINALTYPE-PLATZ5-7 behoben). `PLATZ57_ERWARTET=rot` prüft weiter den alten Stand (Ablehnung durch
#      `matches_final_type_check`), etwa gegen einen Stand ohne `_005`.
#
# Ändert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container, wird am
# Ende entfernt (trap).
#
set -euo pipefail

PLATZ57_ERWARTET="${PLATZ57_ERWARTET:-gruen}" # gruen seit G1a (20261110_005, C-FINALTYPE-PLATZ5-7)

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie match-slots-check.sh / rls-role-matrix.sh
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
CONTAINER_NAME="finals-template-check-$$"

command -v jq >/dev/null 2>&1 || { echo "::error::jq wird benoetigt." >&2; exit 1; }
[[ "$PLATZ57_ERWARTET" == "rot" || "$PLATZ57_ERWARTET" == "gruen" ]] || { echo "::error::PLATZ57_ERWARTET = rot|gruen" >&2; exit 1; }

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
NEWER_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
MIGRATIONS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && MIGRATIONS+=("$line")
done <<< "$NEWER_RAW"

uuid_for() {
  local h
  h="$(printf '%s' "finals-template-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-4${h:9:3}-8${h:13:3}-${h:16:4}-${h:20:12}"
}
U_OWNER="$(uuid_for user:owner)"
# Fixture ZUERST erzeugen (braucht nur Node) -- scheitert es, wird kein Container gestartet.
FIXTURE_JSON="$(cd "$REPO_ROOT" && npx --yes tsx scripts/finals-template-fixture.ts "$U_OWNER")"

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
q() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA <<<"$1"; }

DEV=0
OK=0
check() { # check <Name> <erwartet> <erhalten>
  if [[ "$2" == "$3" ]]; then
    OK=$((OK + 1)); echo "OK          $1"
  else
    DEV=$((DEV + 1)); echo "ABWEICHUNG  $1"; echo "    erwartet: $2"; echo "    erhalten: $3"
  fi
}

echo "Baseline + ${#MIGRATIONS[@]} Migration(en) einspielen..." >&2
psql_stdin < "$BASELINE_FILE"
for f in "${MIGRATIONS[@]}"; do psql_stdin < "$f"; done

T_ID="$(jq -r '.tournamentId' <<<"$FIXTURE_JSON")"
FINALS="$(jq -r '.finalCount' <<<"$FIXTURE_JSON")"
PLACES57="$(jq -r '.places57Count' <<<"$FIXTURE_JSON")"
psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '$U_OWNER', 'authenticated', 'authenticated',
        'owner@finals-template.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
SQL

echo "K1: Turnier ohne Platz 5/7 einfügen..." >&2
set +e
K1_OUT="$(jq -r '.sqlBase' <<<"$FIXTURE_JSON" | psql_stdin 2>&1)"
K1_EXIT=$?
set -e
check "K1 Gruppenspiele, Halbfinale, Platz 3 und Finale lassen sich einfügen" "0" "$K1_EXIT"
[[ "$K1_EXIT" -eq 0 ]] || echo "    $(printf '%s' "$K1_OUT" | grep -m1 ERROR || true)"
check "K1 Finalspiele ohne Platz 5/7 in der Cloud" "$((FINALS - PLACES57))" \
  "$(q "SELECT count(*) FROM public.matches WHERE tournament_id='$T_ID' AND is_final;")"
check "K2 Halbfinale tragen phase 'semifinal' (C-FINALPHASE-AUS-ID)" "1. Halbfinale:semifinal|2. Halbfinale:semifinal" \
  "$(q "SELECT string_agg(label || ':' || phase, '|' ORDER BY match_number) FROM public.matches WHERE tournament_id='$T_ID' AND label LIKE '%Halbfinale';")"
check "K2 Platz 3 und Finale tragen phase 'final'" "thirdPlace:final|final:final" \
  "$(q "SELECT string_agg(final_type || ':' || phase, '|' ORDER BY match_number) FROM public.matches WHERE tournament_id='$T_ID' AND final_type IS NOT NULL;")"
check "K3 jede Seite eines Finalspiels hat eine Herkunft (origin_a/origin_b)" "0" \
  "$(q "SELECT count(*) FROM public.matches WHERE tournament_id='$T_ID' AND is_final AND (origin_a IS NULL OR origin_b IS NULL);")"

echo "K4: Spiele um Platz 5 und 7 einfügen (erwartet: $PLATZ57_ERWARTET)..." >&2
set +e
K4_OUT="$(jq -r '.sqlPlaces57' <<<"$FIXTURE_JSON" | psql_stdin 2>&1)"
K4_EXIT=$?
set -e
if [[ "$PLATZ57_ERWARTET" == "rot" ]]; then
  K4_GOT="$([[ "$K4_EXIT" -ne 0 ]] && grep -q 'matches_final_type_check' <<<"$K4_OUT" && echo abgelehnt || echo durchgelaufen)"
  check "K4 ERWARTET ROT C-FINALTYPE-PLATZ5-7: Platz 5/7 scheitert an matches_final_type_check (bis G1; geht er durch: Marker entfernen)" \
    "abgelehnt" "$K4_GOT"
else
  check "K4 Spiele um Platz 5 und 7 lassen sich einfügen" "0" "$K4_EXIT"
  check "K4 Platz 7, 5, 3, Finale in der Cloud (final_type in Spielfolge)" "seventhEighth|fifthSixth|thirdPlace|final" \
    "$(q "SELECT string_agg(final_type, '|' ORDER BY match_number) FROM public.matches WHERE tournament_id='$T_ID' AND final_type IS NOT NULL;")"
fi

echo
echo "Ergebnis: $OK OK, $DEV Abweichung(en)."
[[ "$DEV" -eq 0 ]]
