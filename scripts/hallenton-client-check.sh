#!/usr/bin/env bash
#
# hallenton-client-check.sh — der Hallenton-Client gegen die echten RPCs (H3b-3 Fixrunde 1). Ergänzt
# scripts/hallenton-check.sh (SQL-Seite): Hier laufen die Client-Funktionen aus src/core/repositories/hallentonRpc.ts samt
# zod-Prüfung und das Lebenszeichen des Lautsprechers (src/features/hallenton/runtime/lautsprecherLebenszeichen.ts) gegen
# die Funktionen der Migration 20261121_001_hallenton.sql in EINEM Wegwerf-Container (supabase/postgres, trap).
#
# Weg: Der Test (src/features/hallenton/__tests__/hallenton.echt.test.ts) ruft jede RPC über `docker exec … psql` als Rolle
# authenticated mit gesetzten JWT-Claims auf und gibt die jsonb-Antwort unverändert an den Client – dieselbe Form, die PostgREST
# liefert. Ohne die Umgebungsvariable HALLENTON_ECHT_CONTAINER überspringt die normale Suite den Test.
#
# Nachweise: (1) Lebenszeichen nach Turnierende antwortet ok (kein 55000), (2) getDeviceId() ist eine UUID und passt zu
# p_device_id, (3) volle und schmale Sicht von hall_sound_status bestehen die zod-Schemata, (4) Lebenszeichen → Testton →
# Quittung einmal komplett.
#
# Aufruf (über die Warteschlange): bash .superpowers/sdd/testlauf/testlauf2.sh <name> bash scripts/hallenton-client-check.sh
# Ändert NICHTS an der Produktion und nichts an einem lokalen Supabase-Stack; Port 127.0.0.1:5241 nur für Diagnose.
#
set -euo pipefail

POSTGRES_IMAGE="supabase/postgres:17.6.1.063"
PORT="${HALLENTON_CLIENT_PORT:-5241}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
STORAGE_STUB="$REPO_ROOT/scripts/lib/hallenton-storage-stub.sql"
NAME="hallenton-client-check-$$"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" -p "127.0.0.1:$PORT:5432" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
for _ in $(seq 1 120); do
  [[ "$(docker logs "$NAME" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]] && break
  sleep 1
done
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done

psql_stdin() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$NAME" psql -U postgres -X -v ON_ERROR_STOP=1 -q; }
psql_admin() {
  docker exec -i -e PGPASSWORD=postgres -e PGOPTIONS="-c client_min_messages=warning" "$NAME" psql -h 127.0.0.1 -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -q
}

uuid_for() {
  local h
  h="$(printf '%s' "hallenton-client:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-4${h:13:3}-8${h:17:3}-${h:20:12}"
}
U_OLLI="$(uuid_for user:olli)"; U_MIA="$(uuid_for user:mia)"; T_NORD="$(uuid_for tournament:hallencup-nord)"

echo "Baseline, Storage-Nachbau und Migrationen seit der Baseline einspielen..." >&2
psql_stdin < "$BASELINE_FILE"
psql_admin < "$STORAGE_STUB"
source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  psql_stdin < "$f"
done <<< "$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")"

psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}', now(), now()
FROM (VALUES ('$U_OLLI'::uuid, 'olli@hallenton.test'), ('$U_MIA'::uuid, 'mia@hallenton.test')) AS u(id, email);
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, number_of_fields, group_phase_duration, is_public, config, deleted_at)
VALUES ('$T_NORD', '$U_OLLI', 'Hallencup Nord', '2026-11-28', 4, 2, 10, false, '{"publishedAt":"2026-10-20T00:00:00.000Z"}'::jsonb, NULL);
INSERT INTO public.tournament_collaborators (id, tournament_id, user_id, role, accepted_at, label)
VALUES ('$(uuid_for membership:mia)', '$T_NORD', '$U_MIA', 'collaborator', now(), 'Mia');
SQL

echo "Client gegen die echten RPCs..." >&2
cd "$REPO_ROOT"
HALLENTON_ECHT_CONTAINER="$NAME" HALLENTON_ECHT_TURNIER="$T_NORD" HALLENTON_ECHT_OLLI="$U_OLLI" HALLENTON_ECHT_MIA="$U_MIA" \
  npx vitest run src/features/hallenton/__tests__/hallenton.echt.test.ts --reporter=verbose
