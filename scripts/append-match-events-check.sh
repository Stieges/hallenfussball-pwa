#!/usr/bin/env bash
#
# append-match-events-check.sh — Container-Beweis fuer den Server-Schreibweg
# public.append_match_events + public.server_time (B3b,
# supabase/migrations/20260928_003_append_match_events.sql,
# .superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B3b-brief.md, Abschnitt 3).
#
# Wegwerf-Postgres (supabase/postgres), Baseline + ALLE neueren Migrationen (die B3b-Migration
# zweimal -- Idempotenz). Testnutzer je Rolle: owner, coadmin (co-admin), helper (collaborator),
# trainer, stranger (kein Mitglied) + anon.
#
# Kategorien (jede Probe zaehlt in genau eine):
#   Fixtures    Jede Fixture unter src/core/match/__fixtures__/ laeuft durch die RPC: Turnier,
#               Teams, Spiel werden so angelegt, dass die SERVERGESETZTEN Regeln (Brief 5d) den
#               Fixture-Regeln entsprechen (Umkehrung der Regelableitung). `prior` als owner (je
#               Ereignis ein Aufruf), `events` im Modus log je Ereignis ein Aufruf als actorUser,
#               im Modus batch ein Aufruf. Verlangt: results (id, status, code; detail wenn
#               erwartet) == expect.results, compute_match_state (als owner) == expect.serverState
#               == Zustand der letzten RPC-Antwort (S11: Anhaengen == Nachrechnen), und der
#               Zwischenspeicher auf matches passt zum Zustand.
#               IDs: Fixture-Team-IDs ("teamA") und Nicht-UUID-Kennungen sind keine uuids, und
#               Ereignis-IDs wiederholen sich zwischen Fixtures (match_events.id ist global
#               eindeutig) -- deshalb bildet der Harness je Fixture JEDE Kennung (ctx-Teams, id,
#               targetId, teamId, payload.basedOn) bijektiv auf eine fixture-eigene uuid ab, auch
#               in expect (Schluessel und Werte). Dass Nicht-UUID-Kennungen am Server
#               INVALID_PAYLOAD sind, belegt die Probe S10 separat.
#               Ausnahmen: actorUser trainer/stranger -> erwartet FORBIDDEN_ACTOR (kein Recht;
#               B1c-Allowlist 07-idempotency.json#2500). Fixtures, deren Regeln nicht ueber die
#               Konfiguration herstellbar sind, werden mit Grund gelistet (Ziel: keine).
#   Rechte      Helfer: Spielbetrieb ja, CORRECTION/SKIP/UNSKIP/REOPEN/RESULT_ENTRY nein
#               (FORBIDDEN_ACTOR), mitgesendetes actor wird ignoriert; Co-Admin/Owner duerfen;
#               Trainer/Fremder und widerrufene/offene/viewer-Mitgliedschaften: alles FORBIDDEN_ACTOR,
#               nichts gespeichert, kein Zustand; nicht existierendes Spiel und soft-geloeschtes
#               Turnier: dieselbe Antwort (M6, M3); anon: kein EXECUTE; ohne auth.uid() Fehler;
#               Autorenzeile (user_id, device_id, base_state).
#   Idempotenz  gleicher Aufruf zweimal -> alle duplicate mit seq des Originals, 1 Zeile je ID;
#               gleiche ID anderer Inhalt -> ID_CONFLICT; gleiche ID anderes Spiel -> ID_CONFLICT;
#               MATCH_START-Wiederholung mit anderen Client-Regeln -> duplicate; noop nie gespeichert.
#   Kaskade     log: Ablehnung haelt die anderen nicht auf; batch: DEPENDS_ON_REJECTED (R12),
#               auch nach Umschlag-Ablehnung.
#   Nebenlaeufig zwei Sitzungen senden gleichzeitig MATCH_START (erste haelt die Sperre per
#               pg_sleep) -> genau eine angenommen, seq lueckenlos steigend; zwei gleichzeitige
#               Tore -> beide angenommen, Stand 2.
#   Sonstiges   CLIENT_OUTDATED (p_client_format = 0), server_time() fuer anon, Guard aus B2
#               (Engine-Zeilen der RPC per Client weder aenderbar noch loeschbar), S10
#               (Grossbuchstaben-IDs), S11 (echte Epoch-ms, Klemmung), Umschlag (S9), Fehler bei
#               ungueltigem p_events, servergesetzte Regeln (5d, S14), Zwischenspeicher (I1: nicht
#               gespielt -> NULL; M4: live_state zusammengefuehrt), section 5 in der Verlaengerung
#               (S13) mit spaltenweisem R14-Vergleich, Groessen- und Anzahlgrenzen (M1).
#               Fixtures mit K.o.-Regeln und tiebreak null sind ueber die Konfiguration nicht
#               herstellbar (S14: der Server setzt tiebreak nie null) -- nur dieser Grund ist als
#               Auslassung erlaubt, jeder andere zaehlt als Abweichung.
#   Rechte-Assertion  scripts/db_privilege_assertions.sql gegen den migrierten Container.
# Zusaetzlich (nur Ausgabe): Laufzeit eines Aufrufs mit 1 Ereignis bei 100 gespeicherten.
#
# Aufrufoptionen:
#   bash scripts/append-match-events-check.sh                     normaler Lauf, Exit 0 nur ohne
#                                                                 Abweichung
#   bash scripts/append-match-events-check.sh --without-migration Gegenprobe A: ohne die
#                                                                 B3b-Migration -> JEDE Kategorie
#                                                                 muss ROT sein (Exit 0 nur dann)
#   bash scripts/append-match-events-check.sh --gegenprobe        Gegenprobe B: B3b-Migration mit
#                                                                 bewusst falscher Akteursermittlung
#                                                                 ('leadMatches' -> 'writeMatchData',
#                                                                 Helfer wird Turnierleitung) ->
#                                                                 Fixtures und Rechte muessen ROT
#                                                                 sein (Exit 0 nur dann)
#
# Aendert NICHTS an der Produktionsdatenbank -- Wegwerf-Container, wird am Ende entfernt (trap).
#
set -euo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe)" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_MIGRATION="20260928_003_append_match_events.sql"
FIXTURES_DIR="$REPO_ROOT/src/core/match/__fixtures__"
CONTAINER_NAME="append-match-events-check-$$"
WORKDIR="$(mktemp -d)"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm -f "$CONTAINER_NAME-a" "$CONTAINER_NAME-b" >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
NEWER_MIGRATIONS_RAW="$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")" || exit 1
NEWER_MIGRATIONS=()
TARGET_FILE=""
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if [[ "$(basename "$line")" == "$TARGET_MIGRATION" ]]; then
    TARGET_FILE="$line"
    [[ "$MODE" == "without-migration" ]] && continue
  fi
  NEWER_MIGRATIONS+=("$line")
done <<< "$NEWER_MIGRATIONS_RAW"
if [[ "$MODE" != "without-migration" && -z "$TARGET_FILE" ]]; then
  echo "::error::$TARGET_MIGRATION nicht in der Liste 'neuer als Baseline' gefunden." >&2
  exit 1
fi

# --- 1. Wegwerf-Postgres ----------------------------------------------------------------------
docker run -d --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=postgres -p 5432 "$POSTGRES_IMAGE" >/dev/null
READY=0
for _ in $(seq 1 90); do
  READY_COUNT="$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "database system is ready to accept connections" || true)"
  if [[ "$READY_COUNT" -ge 2 ]]; then READY=1; break; fi
  sleep 1
done
if [[ "$READY" -ne 1 ]]; then
  echo "::error::Container wurde nach 90s nicht vollstaendig bereit." >&2
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

echo "[$MODE] Baseline + ${#NEWER_MIGRATIONS[@]} neuere Migration(en) einspielen..." >&2
psql_stdin < "$BASELINE_FILE"
for f in "${NEWER_MIGRATIONS[@]}"; do
  psql_stdin < "$f"
done
if [[ "$MODE" != "without-migration" ]]; then
  echo "Idempotenz: $TARGET_MIGRATION ein zweites Mal einspielen..." >&2
  psql_stdin < "$TARGET_FILE"
fi
if [[ "$MODE" == "gegenprobe" ]]; then
  # Genau die Akteursermittlung verfaelschen: wer writeMatchData hat, gilt als Turnierleitung.
  HITS="$(grep -c "has_tournament_permission(v_tournament_id, 'leadMatches')" "$TARGET_FILE" || true)"
  if [[ "$HITS" -ne 1 ]]; then
    echo "::error::Gegenprobe: Akteurszeile nicht genau einmal gefunden ($HITS)." >&2
    exit 1
  fi
  echo "GEGENPROBE: Akteursermittlung leadMatches -> writeMatchData" >&2
  sed "s/has_tournament_permission(v_tournament_id, 'leadMatches')/has_tournament_permission(v_tournament_id, 'writeMatchData')/" "$TARGET_FILE" | psql_stdin
fi

# --- 2. Harness-Hilfen (nur im Wegwerf-Container) --------------------------------------------
# __b3b_call: ein RPC-Aufruf als echte Client-Rolle (SET LOCAL role + request.jwt.claim.sub, wie
# PostgREST), Fehler werden als {"exception": SQLSTATE} zurueckgegeben statt den Lauf abzubrechen.
psql_stdin <<'SQL'
CREATE FUNCTION public.__b3b_call(p_user uuid, p_match uuid, p_events jsonb, p_format integer DEFAULT 1,
                                  p_device uuid DEFAULT NULL, p_role text DEFAULT 'authenticated')
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
  v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('role', p_role, true);
  BEGIN
    v := public.append_match_events(p_match, p_events, p_format, p_device);
  EXCEPTION WHEN OTHERS THEN
    v := jsonb_build_object('exception', SQLSTATE, 'message', SQLERRM);
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;

-- compute_match_state als echte Rolle (RLS gilt, R17).
CREATE FUNCTION public.__b3b_state(p_user uuid, p_match uuid) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
  v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    v := public.compute_match_state(p_match);
  EXCEPTION WHEN OTHERS THEN
    v := jsonb_build_object('exception', SQLSTATE, 'message', SQLERRM);
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;

-- Beliebige SQL als Client-Rolle; liefert 'ok:<Zeilen>' oder 'error:<SQLSTATE>'.
CREATE FUNCTION public.__b3b_exec(p_user uuid, p_sql text, p_role text DEFAULT 'authenticated')
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  v_rows bigint;
  v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('role', p_role, true);
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v := 'ok:' || v_rows;
  EXCEPTION WHEN OTHERS THEN
    v := 'error:' || SQLSTATE;
  END;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END;
$fn$;

-- Zwischenspeicher eines Spiels als jsonb (timer_start_time/actual_end als Epoch-ms).
CREATE FUNCTION public.__b3b_cache(p_match uuid) RETURNS jsonb LANGUAGE sql AS $fn$
  SELECT jsonb_build_object(
    'score_a', m.score_a, 'score_b', m.score_b,
    'overtime_score_a', m.overtime_score_a, 'overtime_score_b', m.overtime_score_b,
    'penalty_score_a', m.penalty_score_a, 'penalty_score_b', m.penalty_score_b,
    'match_status', m.match_status, 'decided_by', m.decided_by,
    'timer_elapsed_seconds', m.timer_elapsed_seconds,
    'timer_start_ms', floor(extract(epoch FROM m.timer_start_time) * 1000)::bigint,
    'timer_paused_at', m.timer_paused_at, 'actual_start', m.actual_start,
    'actual_end_ms', floor(extract(epoch FROM m.actual_end) * 1000)::bigint,
    'live_state', m.live_state, 'version', m.version, 'last_modified_by', m.last_modified_by,
    'team_a', m.team_a_id, 'team_b', m.team_b_id)
  FROM public.matches m WHERE m.id = p_match;
$fn$;
SQL

uuid_for() {
  local h
  h="$(printf '%s' "append-match-events-check:$1" | shasum -a 256 | cut -c1-32)"
  echo "${h:0:8}-${h:8:4}-${h:12:4}-${h:16:4}-${h:20:12}"
}
U_OWNER="$(uuid_for user:owner)"
U_COADMIN="$(uuid_for user:coadmin)"
U_HELPER="$(uuid_for user:helper)"
U_TRAINER="$(uuid_for user:trainer)"
U_STRANGER="$(uuid_for user:stranger)"
U_DECLINED="$(uuid_for user:declined)"
U_PENDING="$(uuid_for user:pending)"
U_VIEWER="$(uuid_for user:viewer)"

psql_stdin <<SQL
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'x', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
FROM (VALUES ('$U_OWNER'::uuid, 'owner@b3b.test'), ('$U_COADMIN'::uuid, 'coadmin@b3b.test'),
             ('$U_HELPER'::uuid, 'helper@b3b.test'), ('$U_TRAINER'::uuid, 'trainer@b3b.test'),
             ('$U_STRANGER'::uuid, 'stranger@b3b.test'), ('$U_DECLINED'::uuid, 'declined@b3b.test'),
             ('$U_PENDING'::uuid, 'pending@b3b.test'), ('$U_VIEWER'::uuid, 'viewer@b3b.test')) AS u(id, email);
SQL

# Legt ein Turnier (Eigentuemer owner) mit den drei Mitgliedschaften an.
# $1 Turnier-ID, $2 config (jsonb), $3 finals_config (jsonb oder NULL), $4 group_phase_duration
tournament_sql() {
  local finals="NULL"
  [[ "$3" != "null" ]] && finals="\$J\$$3\$J\$::jsonb"
  cat <<SQL
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config, finals_config)
VALUES ('$1', '$U_OWNER', 'B3b-Harness', '2026-09-28', 2, $4, \$J\$$2\$J\$::jsonb, $finals);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at)
VALUES ('$1', '$U_COADMIN', 'co-admin', now()), ('$1', '$U_HELPER', 'collaborator', now()),
       ('$1', '$U_TRAINER', 'trainer', now()), ('$1', '$U_VIEWER', 'viewer', now()),
       ('$1', '$U_PENDING', 'collaborator', NULL);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, declined_at)
VALUES ('$1', '$U_DECLINED', 'co-admin', now(), now());
SQL
}

# Zaehler je Kategorie (indexierte Arrays -- macOS liefert bash 3.2 ohne assoziative Arrays).
CATS=(Fixtures Rechte Idempotenz Kaskade Nebenlaeufig Sonstiges Rechte-Assertion)
DEV=(0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0)
cat_index() {
  local i
  for i in "${!CATS[@]}"; do
    if [[ "${CATS[$i]}" == "$1" ]]; then echo "$i"; return 0; fi
  done
  echo "::error::Unbekannte Kategorie: $1" >&2
  exit 2
}
count_ok() { local i; i="$(cat_index "$1")"; OKS[i]=$((OKS[i] + 1)); }
count_dev() { local i; i="$(cat_index "$1")"; DEV[i]=$((DEV[i] + 1)); }

# check <Kategorie> <Name> <jq-Ausdruck (liefert true)> <JSON>
check() {
  local cat="$1" name="$2" expr="$3" json="$4"
  if [[ -n "$json" ]] && jq -e "$expr" <<<"$json" >/dev/null 2>&1; then
    count_ok "$cat"
    echo "OK          [$cat] $name"
  else
    count_dev "$cat"
    echo "ABWEICHUNG  [$cat] $name"
    echo "    erwartet: $expr"
    echo "    erhalten: $(printf '%s' "$json" | head -c 1500)"
  fi
}

# call <Rolle> <Nutzer-ID|leer> <Spiel-ID> <Ereignisse-JSON> [client_format] [device_id]
call() {
  local role="$1" user="$2" match="$3" events="$4" fmt="${5:-1}" device="${6:-}"
  local u="NULL" d="NULL"
  [[ -n "$user" ]] && u="'$user'::uuid"
  [[ -n "$device" ]] && d="'$device'::uuid"
  psql_value <<SQL
SELECT public.__b3b_call($u, '$match'::uuid, \$J\$$events\$J\$::jsonb, $fmt, $d, '$role');
SQL
}
state_of() { psql_value <<<"SELECT public.__b3b_state('$U_OWNER'::uuid, '$1'::uuid);"; }
cache_of() { psql_value <<<"SELECT public.__b3b_cache('$1'::uuid);"; }
q() { psql_value <<<"$1" 2>&1 || true; }

# ev <typ> <id> [weitere Felder als JSON] -- Ereignis mit at/section/clockMs-Standardwerten.
# Platzhalter im JSON (statt \"-Escapes in verschachtelten $(...), an denen bash 3.2 scheitert):
#   @V:NAME@ Wert der Shell-Variablen NAME, @U:NAME@ derselbe in Grossbuchstaben,
#   @E:key@ uuid_for event:key, @T:key@ uuid_for team:key.
ev() {
  local extra="${3:-}" re='@([VEUT]):([A-Za-z0-9_:-]+)@' key val
  [[ -z "$extra" ]] && extra='{}'
  while [[ "$extra" =~ $re ]]; do
    key="${BASH_REMATCH[2]}"
    case "${BASH_REMATCH[1]}" in
      V) val="${!key}" ;;
      U) val="$(tr '[:lower:]' '[:upper:]' <<<"${!key}")" ;;
      E) val="$(uuid_for "event:$key")" ;;
      T) val="$(uuid_for "team:$key")" ;;
    esac
    extra="${extra/"${BASH_REMATCH[0]}"/$val}"
  done
  jq -cn --arg type "$1" --arg id "$2" --argjson extra "$extra" \
    '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, payload: {}} + $extra'
}
arr() { jq -cs '.' <<<"$(printf '%s\n' "$@")"; }

# --- 3. Fixtures durch die RPC ----------------------------------------------------------------
echo "Fixtures durch die RPC..." >&2
FIX_INDEX=0
: > "$WORKDIR/plans.jsonl"
for f in "$FIXTURES_DIR"/*.json; do
  FIX_INDEX=$((FIX_INDEX + 1))
  jq -c --arg file "$(basename "$f")" --argjson idx "$FIX_INDEX" \
     --arg owner "$U_OWNER" --arg coadmin "$U_COADMIN" --arg helper "$U_HELPER" \
     --arg trainer "$U_TRAINER" --arg stranger "$U_STRANGER" '
    def pad($n; $w): ("000000000000" + ($n | tostring))[-$w:];
    . as $f
    | pad($idx; 8) as $fx
    | ([(.prior // [])[], .events[]]) as $all
    # Alle Kennungen der Fixture -> fixture-eigene uuids (bijektiv).
    | ([.ctx.teamAId, .ctx.teamBId]
       + [$all[] | .id, .targetId, .teamId,
          (.payload | if type == "object" then .basedOn else null end)]
       | map(strings) | unique) as $keys
    | ([range(0; $keys | length) as $i | {key: $keys[$i], value: ($fx + "-0000-4000-8000-" + pad($i + 1; 12))}]
       | from_entries) as $m
    | def mp: . as $s | if type == "string" and ($m | has($s)) then $m[$s] else . end;
      (walk(if type == "object" then with_entries(.key |= mp) elif type == "string" then mp else . end)) as $mf
    | ([$all[] | select(.type == "MATCH_START") | .payload.rules | select(type == "object")]) as $rs
    | ($rs[0] // null) as $r
    | ([$rs[] | . == $r] | all) as $same
    | (if $r == null then null
       elif ($same | not) then "mehrere MATCH_START mit unterschiedlichen Regeln"
       elif $r.penaltySeconds != 120 then "penaltySeconds != 120 (fest am Server)"
       elif ($r.breakSeconds % 60) != 0 then "breakSeconds kein Minutenvielfaches"
       elif ($r.overtimeSeconds % 60) != 0 then "overtimeSeconds kein Minutenvielfaches"
       elif (($r.sections * $r.sectionSeconds) % 60) != 0 then "Gesamtdauer kein Minutenvielfaches"
       elif $r.knockout and $r.tiebreak == null then "S14: der Server setzt tiebreak nie null (fehlender/ungueltiger tiebreaker -> shootout); decision_pending bleibt reine Engine-Semantik (match-engine-parity.sh)"
       else null end) as $not_derivable
    | {users: {owner: $owner, coadmin: $coadmin, helper: $helper, trainer: $trainer, stranger: $stranger}} as $u
    | (if $f.mode == "batch" then ([$f.events[] | .actorUser] | unique) else [] end) as $batch_users
    | {
        file: $file,
        tournament: ($fx + "-0000-4000-b000-000000000001"),
        match: ($fx + "-0000-4000-a000-000000000001"),
        team_a: $m[$f.ctx.teamAId], team_b: $m[$f.ctx.teamBId],
        not_derivable: (if $not_derivable != null then $not_derivable
                        elif ($batch_users | length) > 1 then "Stapel mit mehreren actorUser"
                        else null end),
        config: (if $r == null then {} else {gamePeriods: $r.sections, halftimeBreak: ($r.breakSeconds / 60),
                  matchCockpitSettings: {penaltyShootersPerTeam: $r.shootersPerTeam,
                                         penaltySuddenDeathAfter: $r.suddenDeathAfter}} end),
        finals: (if $r == null then null else ({tiebreakerDuration: ($r.overtimeSeconds / 60)}
                  + (if $r.tiebreak != null then {tiebreaker: $r.tiebreak} else {} end)) end),
        phase: (if $r != null and $r.knockout then "final" else "groupStage" end),
        duration: (if $r == null then 10 else ($r.sections * $r.sectionSeconds / 60) end),
        calls: ([($mf.prior // [])[] | {kind: "prior", user: $u.users.owner, events: [.]}]
                + (if $f.mode == "log"
                   then [$mf.events[] | {kind: "event", user: $u.users[.actorUser], events: [.]}]
                   else [{kind: "event", user: $u.users[$mf.events[0].actorUser], events: $mf.events}] end)),
        expected_results: ([range(0; $mf.events | length) as $i
          | ($f.events[$i].actorUser) as $au
          | (if $f.mode == "batch" then $f.events[0].actorUser else $au end) as $caller
          | if ($caller == "trainer" or $caller == "stranger")
            then {id: $mf.events[$i].id, status: "rejected", code: "FORBIDDEN_ACTOR"}
            else $mf.expect.results[$i] end]),
        forbidden_override: ([$f.events[] | .actorUser] | map(select(. == "trainer" or . == "stranger")) | length > 0),
        expected_state: $mf.expect.serverState
      }' "$f" >> "$WORKDIR/plans.jsonl"
done

# Ein SQL-Skript fuer alle Fixtures; jede Ausgabezeile traegt Art|Datei|Nummer|JSON.
: > "$WORKDIR/fixtures.sql"
SKIPPED=()
while IFS= read -r plan; do
  file="$(jq -r '.file' <<<"$plan")"
  reason="$(jq -r '.not_derivable // empty' <<<"$plan")"
  if [[ -n "$reason" ]]; then
    SKIPPED+=("$file: $reason")
    continue
  fi
  t="$(jq -r '.tournament' <<<"$plan")"; m="$(jq -r '.match' <<<"$plan")"
  ta="$(jq -r '.team_a' <<<"$plan")"; tb="$(jq -r '.team_b' <<<"$plan")"
  dur="$(jq -r '.duration' <<<"$plan")"; phase="$(jq -r '.phase' <<<"$plan")"
  tournament_sql "$t" "$(jq -c '.config' <<<"$plan")" "$(jq -c '.finals' <<<"$plan")" "$dur" >> "$WORKDIR/fixtures.sql"
  cat >> "$WORKDIR/fixtures.sql" <<SQL
INSERT INTO public.teams (id, tournament_id, name) VALUES ('$ta', '$t', 'A'), ('$tb', '$t', 'B');
INSERT INTO public.matches (id, tournament_id, round, field, phase, team_a_id, team_b_id, duration_minutes, score_a, score_b)
VALUES ('$m', '$t', 1, 1, '$phase', '$ta', '$tb', $dur, NULL, NULL);
SQL
  k=0
  while IFS= read -r c; do
    k=$((k + 1))
    kind="$(jq -r '.kind' <<<"$c")"; user="$(jq -r '.user' <<<"$c")"; evs="$(jq -c '.events' <<<"$c")"
    echo "SELECT '$kind|$file|$k|' || public.__b3b_call('$user'::uuid, '$m'::uuid, \$J\$$evs\$J\$::jsonb)::text;" >> "$WORKDIR/fixtures.sql"
  done < <(jq -c '.calls[]' <<<"$plan")
  echo "SELECT 'state|$file|0|' || coalesce(public.__b3b_state('$U_OWNER'::uuid, '$m'::uuid)::text, 'null');" >> "$WORKDIR/fixtures.sql"
  echo "SELECT 'cache|$file|0|' || public.__b3b_cache('$m'::uuid)::text;" >> "$WORKDIR/fixtures.sql"
done < "$WORKDIR/plans.jsonl"
psql_value < "$WORKDIR/fixtures.sql" > "$WORKDIR/fixtures.out"

FIXTURE_COUNT="$(wc -l < "$WORKDIR/plans.jsonl" | tr -d ' ')"
while IFS= read -r plan; do
  file="$(jq -r '.file' <<<"$plan")"
  [[ -n "$(jq -r '.not_derivable // empty' <<<"$plan")" ]] && continue
  lines="$(grep -F "|$file|" "$WORKDIR/fixtures.out" | grep -E "^(prior|event|state|cache)\|" || true)"
  outcome="$(jq -cRs --argjson plan "$plan" '
    split("\n") | map(select(length > 0) | capture("^(?<kind>[a-z]+)\\|[^|]*\\|(?<n>[0-9]+)\\|(?<json>.*)$")
                      | {kind, json: (.json | fromjson)}) as $rows
    | ([$rows[] | select(.kind == "prior" or .kind == "event") | .json]) as $calls
    | ([$rows[] | select(.kind == "event") | .json.results // [] | .[]]) as $results
    | ([$calls[] | select(.exception != null)]) as $exc
    | ([$calls[] | .state | select(. != null)] | last) as $rpc_state
    | ([$rows[] | select(.kind == "state") | .json][0]) as $state
    | ([$rows[] | select(.kind == "cache") | .json][0]) as $cache
    | $plan.expected_results as $exp
    | {
        exceptions: $exc,
        results_ok: (($results | length) == ($exp | length)
          and ([range(0; $exp | length) as $i | ($exp[$i]) as $x | ($results[$i]) as $a
                | {id: $a.id, status: $a.status, code: $a.code} + (if $x | has("detail") then {detail: $a.detail} else {} end)]
               == [$exp[] | {id, status, code} + (if has("detail") then {detail} else {} end)])),
        state_ok: ($state == $plan.expected_state),
        s11_ok: ($rpc_state == $state),
        cache_ok: (
          ($state.status) as $st
          | ($cache.match_status == ({"running": "running", "paused": "paused", "section_break": "paused",
                                      "decision_pending": "paused", "shootout": "paused", "finished": "finished",
                                      "scheduled": "scheduled", "skipped": "skipped"}[$st]))
          # I1 (Fixrunde 1): nicht gespielt (scheduled/skipped) -> kein Stand (NULL), wie der alte Weg.
          and (if ($st == "scheduled" or $st == "skipped")
               then ([$cache.score_a, $cache.score_b, $cache.overtime_score_a, $cache.overtime_score_b,
                      $cache.penalty_score_a, $cache.penalty_score_b] | all(. == null))
               else (($cache.score_a + ($cache.overtime_score_a // 0) == $state.effectiveScores[$plan.team_a])
                 and ($cache.score_b + ($cache.overtime_score_b // 0) == $state.effectiveScores[$plan.team_b])
                 and (($cache.penalty_score_a // 0) == $state.scores[$plan.team_a].shootout)
                 and (($cache.penalty_score_b // 0) == $state.scores[$plan.team_b].shootout)) end)
          and ($cache.decided_by == (if $st == "finished"
                 then ({"shootout": "penalty", "correction": "regular", "direct": "regular"}[$state.decidedBy // ""] // $state.decidedBy)
                 else null end))
          and ($cache.timer_elapsed_seconds == ($state.clock.elapsedMs / 1000 | floor))
          and ($cache.timer_start_ms == (if $state.clock.running then $state.clock.anchorAt else null end))
          and (if ($st == "scheduled" or $st == "skipped" or $st == "finished") then $cache.live_state == null
               else ($cache.live_state.engine == true and $cache.live_state.phase == $state.phase
                     and $cache.live_state.status == $st and $cache.live_state.elapsedMs == $state.clock.elapsedMs) end)),
        results: $results, expected: $exp, state: $state, rpc_state: $rpc_state, cache: $cache
      }' <<<"$lines")"
  label="$file"
  [[ "$(jq -r '.forbidden_override' <<<"$plan")" == "true" ]] && label="$file (trainer/stranger -> FORBIDDEN_ACTOR)"
  check Fixtures "$label" '(.exceptions | length) == 0 and .results_ok and .state_ok and .s11_ok and .cache_ok' "$outcome"
  if ! jq -e '(.exceptions | length) == 0 and .results_ok and .state_ok and .s11_ok and .cache_ok' <<<"$outcome" >/dev/null 2>&1; then
    jq -c '{exceptions: (.exceptions[:2]), results_ok, state_ok, s11_ok, cache_ok}' <<<"$outcome" | sed 's/^/    /'
    if ! jq -e '.results_ok' <<<"$outcome" >/dev/null 2>&1; then
      jq -c '{results: [.results[] | {id, status, code, detail}], expected}' <<<"$outcome" | head -c 3000 | sed 's/^/    /'; echo
    fi
    if ! jq -e '.state_ok and .s11_ok' <<<"$outcome" >/dev/null 2>&1; then
      diff -u --label expect --label compute_match_state <(jq -S '.state' <<<"$outcome") <(jq -S . <<<"$(jq -c '.state' <<<"$outcome")") >/dev/null || true
      jq -c '{state, rpc_state}' <<<"$outcome" | head -c 3000 | sed 's/^/    /'; echo
      jq -c '.expected_state' <<<"$plan" | sed 's/^/    expected_state: /'
    fi
    if ! jq -e '.cache_ok' <<<"$outcome" >/dev/null 2>&1; then
      jq -c '.cache' <<<"$outcome" | sed 's/^/    cache: /'
    fi
  fi
done < "$WORKDIR/plans.jsonl"
if [[ "${#SKIPPED[@]}" -gt 0 ]]; then
  echo "Nicht ueber die Konfiguration herstellbar (uebersprungen, ${#SKIPPED[@]}):"
  printf '    %s\n' "${SKIPPED[@]}"
  # Nur S14 ist ein erlaubter Grund -- jeder andere Ausfall zaehlt als Abweichung.
  OTHER_SKIPS="$(printf '%s\n' "${SKIPPED[@]}" | grep -vc ': S14: ' || true)"
  check Fixtures "uebersprungen nur aus Grund S14 (andere: $OTHER_SKIPS)" '. == 0' "$OTHER_SKIPS"
else
  echo "Alle $FIXTURE_COUNT Fixtures ueber die Konfiguration herstellbar (keine uebersprungen)."
fi

# --- 4. Proben-Turnier ------------------------------------------------------------------------
T_P="$(uuid_for tournament:probe)"
TA="$(uuid_for team:a)"
TB="$(uuid_for team:b)"
{
  tournament_sql "$T_P" '{}' 'null' 10
  echo "INSERT INTO public.teams (id, tournament_id, name) VALUES ('$TA', '$T_P', 'A'), ('$TB', '$T_P', 'B');"
  for name in r1 r2 r3 r4 i1 i2 c1 c2 k1 k2 s10 s11 g1 perf o1 e1 m4 m1; do
    echo "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, score_a, score_b) VALUES ('$(uuid_for "match:$name")', '$T_P', 1, 1, '$TA', '$TB', NULL, NULL);"
  done
} | psql_stdin
M() { uuid_for "match:$1"; }
E() { uuid_for "event:$1"; }
DEVICE="$(uuid_for device:1)"

# K.o.-Turnier ohne tiebreaker (S14) und K.o.-Turnier mit 4 Abschnitten + Verlaengerung (S13/R14).
T_KO0="$(uuid_for tournament:ko-default)"
T_KO4="$(uuid_for tournament:ko-4)"
{
  tournament_sql "$T_KO0" '{}' 'null' 10
  tournament_sql "$T_KO4" '{"gamePeriods":4,"halftimeBreak":1}' '{"tiebreaker":"overtime-then-shootout","tiebreakerDuration":5}' 20
  echo "INSERT INTO public.teams (id, tournament_id, name) VALUES ('$(uuid_for team:ko0-a)', '$T_KO0', 'A'), ('$(uuid_for team:ko0-b)', '$T_KO0', 'B');"
  echo "INSERT INTO public.matches (id, tournament_id, round, field, phase, team_a_id, team_b_id) VALUES ('$(M s14)', '$T_KO0', 1, 1, 'final', '$(uuid_for team:ko0-a)', '$(uuid_for team:ko0-b)');"
  echo "INSERT INTO public.teams (id, tournament_id, name) VALUES ('$(uuid_for team:ko4-a)', '$T_KO4', 'A'), ('$(uuid_for team:ko4-b)', '$T_KO4', 'B');"
  echo "INSERT INTO public.matches (id, tournament_id, round, field, phase, team_a_id, team_b_id) VALUES ('$(M ko)', '$T_KO4', 1, 1, 'final', '$(uuid_for team:ko4-a)', '$(uuid_for team:ko4-b)');"
} | psql_stdin

# --- 5. Rechte --------------------------------------------------------------------------------
echo "Rechte..." >&2
out="$(call authenticated "$U_HELPER" "$(M r1)" "$(arr "$(ev MATCH_START "$(E r1-start)" '{"baseState":{"v":1}}')")" 1 "$DEVICE")"
check Rechte "Helfer: MATCH_START angenommen" '.results[0].status == "accepted" and (.results[0].seq | type) == "number"' "$out"
out="$(q "SELECT jsonb_build_object('user', a.user_id, 'device', a.device_id, 'base', a.base_state, 'tournament', a.tournament_id) FROM public.match_event_authors a WHERE a.event_id = '$(E r1-start)';")"
check Rechte "Autorenzeile: user_id = Helfer, device_id, base_state" ".user == \"$U_HELPER\" and .device == \"$DEVICE\" and .base == {\"v\":1} and .tournament == \"$T_P\"" "$out"
out="$(call authenticated "$U_HELPER" "$(M r1)" "$(arr "$(ev GOAL "$(E r1-goal)" '{"at":2000,"clockMs":1000,"teamId":"@V:TA@"}')" "$(ev MATCH_END "$(E r1-end)" '{"at":3000,"clockMs":600000}')")")"
check Rechte "Helfer: GOAL + MATCH_END angenommen" '[.results[].status] == ["accepted","accepted"] and .state.status == "finished"' "$out"
out="$(call authenticated "$U_HELPER" "$(M r1)" "$(arr "$(ev CORRECTION "$(E r1-corr-h)" '{"at":4000,"actor":"leitung","payload":{"scores":{"@V:TA@":3,"@V:TB@":0},"reason":"x","basedOn":"@E:r1-goal@"}}')")")"
check Rechte "Helfer: CORRECTION (mit mitgesendetem actor=leitung) -> FORBIDDEN_ACTOR" '.results[0].code == "FORBIDDEN_ACTOR"' "$out"
out="$(call authenticated "$U_HELPER" "$(M r1)" "$(arr "$(ev REOPEN "$(E r1-reopen-h)" '{"at":4000}')")")"
check Rechte "Helfer: REOPEN -> FORBIDDEN_ACTOR" '.results[0].code == "FORBIDDEN_ACTOR"' "$out"
out="$(call authenticated "$U_COADMIN" "$(M r1)" "$(arr "$(ev CORRECTION "$(E r1-corr-c)" '{"at":4000,"payload":{"scores":{"@V:TA@":3,"@V:TB@":0},"reason":"x","basedOn":"@E:r1-goal@"}}')")")"
check Rechte "Co-Admin: CORRECTION angenommen" ".results[0].status == \"accepted\" and .state.effectiveScores[\"$TA\"] == 3 and .state.decidedBy == \"correction\"" "$out"
out="$(call authenticated "$U_HELPER" "$(M r1)" "$(arr "$(ev RETRACT "$(E r1-retract-h)" '{"at":5000,"targetId":"@E:r1-corr-c@"}')")")"
check Rechte "Helfer: RETRACT der Korrektur (finished) -> FORBIDDEN_ACTOR" '.results[0].code == "FORBIDDEN_ACTOR"' "$out"
cache="$(cache_of "$(M r1)")"
check Sonstiges "Zwischenspeicher nach Korrektur: finished, regular, 3:0, actual_end, live_state NULL, version 4" \
  ".match_status == \"finished\" and .decided_by == \"regular\" and .score_a == 3 and .score_b == 0 and .actual_end_ms != null and .actual_start != null and .live_state == null and .version == 4 and .last_modified_by == \"$U_COADMIN\"" "$cache"
out="$(call authenticated "$U_OWNER" "$(M r1)" "$(arr "$(ev REOPEN "$(E r1-reopen-o)" '{"at":6000,"clockMs":600000}')")")"
check Rechte "Owner: REOPEN angenommen" '.results[0].status == "accepted" and .state.status == "running"' "$out"
cache="$(cache_of "$(M r1)")"
check Sonstiges "Zwischenspeicher nach REOPEN: running, Uhr laeuft, live_state engine, actual_end NULL" \
  '.match_status == "running" and .timer_start_ms == 6000 and .timer_elapsed_seconds == 600 and .live_state.engine == true and .live_state.running == true and .live_state.elapsedSeconds == 600 and .actual_end_ms == null and .decided_by == null' "$cache"

out="$(call authenticated "$U_HELPER" "$(M r2)" "$(arr "$(ev SKIP "$(E r2-skip-h)")")")"
check Rechte "Helfer: SKIP -> FORBIDDEN_ACTOR" '.results[0].code == "FORBIDDEN_ACTOR"' "$out"
out="$(call authenticated "$U_COADMIN" "$(M r2)" "$(arr "$(ev SKIP "$(E r2-skip-c)")")")"
check Rechte "Co-Admin: SKIP angenommen" '.results[0].status == "accepted" and .state.status == "skipped"' "$out"
cache="$(cache_of "$(M r2)")"
check Sonstiges "I1: Zwischenspeicher nach SKIP: skipped, kein Stand (NULL)" \
  '.match_status == "skipped" and .score_a == null and .score_b == null and .overtime_score_a == null and .penalty_score_a == null and .live_state == null' "$cache"
out="$(call authenticated "$U_HELPER" "$(M r2)" "$(arr "$(ev UNSKIP "$(E r2-unskip-h)" '{"at":2000}')")")"
check Rechte "Helfer: UNSKIP -> FORBIDDEN_ACTOR" '.results[0].code == "FORBIDDEN_ACTOR"' "$out"
out="$(call authenticated "$U_OWNER" "$(M r2)" "$(arr "$(ev UNSKIP "$(E r2-unskip-o)" '{"at":2000}')")")"
check Rechte "Owner: UNSKIP angenommen" '.results[0].status == "accepted" and .state.status == "scheduled"' "$out"
cache="$(cache_of "$(M r2)")"
check Sonstiges "I1: Zwischenspeicher nach UNSKIP: scheduled, kein Stand (NULL)" \
  '.match_status == "scheduled" and .score_a == null and .score_b == null and .live_state == null' "$cache"
out="$(call authenticated "$U_HELPER" "$(M r3)" "$(arr "$(ev RESULT_ENTRY "$(E r3-re-h)" '{"payload":{"scores":{"@V:TA@":1,"@V:TB@":2}}}')")")"
check Rechte "Helfer: RESULT_ENTRY -> FORBIDDEN_ACTOR" '.results[0].code == "FORBIDDEN_ACTOR"' "$out"
out="$(call authenticated "$U_OWNER" "$(M r3)" "$(arr "$(ev RESULT_ENTRY "$(E r3-re-o)" '{"payload":{"scores":{"@V:TA@":1,"@V:TB@":2}}}')")")"
check Rechte "Owner: RESULT_ENTRY angenommen" ".results[0].status == \"accepted\" and .state.status == \"finished\" and .state.effectiveScores[\"$TB\"] == 2" "$out"
cache="$(cache_of "$(M r3)")"
check Sonstiges "Zwischenspeicher nach Direkteintrag: finished, regular (direct), 1:2" \
  '.match_status == "finished" and .decided_by == "regular" and .score_a == 1 and .score_b == 2 and .live_state == null' "$cache"
for who in trainer stranger; do
  uid="$U_TRAINER"; [[ "$who" == "stranger" ]] && uid="$U_STRANGER"
  out="$(call authenticated "$uid" "$(M r4)" "$(arr "$(ev MATCH_START "$(E "r4-$who")")" "$(ev GOAL "$(E "r4-$who-goal")" '{"teamId":"@V:TA@"}')")")"
  check Rechte "$who: alle Ereignisse FORBIDDEN_ACTOR, kein Zustand" '[.results[].code] == ["FORBIDDEN_ACTOR","FORBIDDEN_ACTOR"] and .state == null' "$out"
done
for who in declined pending viewer; do
  case "$who" in declined) uid="$U_DECLINED" ;; pending) uid="$U_PENDING" ;; *) uid="$U_VIEWER" ;; esac
  out="$(call authenticated "$uid" "$(M r4)" "$(arr "$(ev MATCH_START "$(E "r4-$who")")")")"
  check Rechte "M2: $who-Mitgliedschaft: FORBIDDEN_ACTOR, kein Zustand" '[.results[].code] == ["FORBIDDEN_ACTOR"] and .state == null' "$out"
done
out="$(q "SELECT count(*) FROM public.match_events WHERE match_id = '$(M r4)';")"
check Rechte "trainer/stranger/declined/pending/viewer: nichts gespeichert" '. == 0' "$out"
out="$(call authenticated "$U_OWNER" "$(uuid_for match:gibt-es-nicht)" "$(arr "$(ev MATCH_START "$(E r4-nomatch)")")")"
check Rechte "M6: Spiel existiert nicht -> dieselbe Antwort wie fehlendes Recht (FORBIDDEN_ACTOR, state null)" \
  '[.results[].code] == ["FORBIDDEN_ACTOR"] and .state == null and .exception == null' "$out"
T_DEL="$(uuid_for tournament:deleted)"
{
  tournament_sql "$T_DEL" '{}' 'null' 10
  echo "INSERT INTO public.teams (id, tournament_id, name) VALUES ('$(uuid_for team:del-a)', '$T_DEL', 'A'), ('$(uuid_for team:del-b)', '$T_DEL', 'B');"
  echo "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id) VALUES ('$(M del)', '$T_DEL', 1, 1, '$(uuid_for team:del-a)', '$(uuid_for team:del-b)');"
  echo "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_DEL';"
} | psql_stdin
for who in owner helper; do
  uid="$U_OWNER"; [[ "$who" == "helper" ]] && uid="$U_HELPER"
  out="$(call authenticated "$uid" "$(M del)" "$(arr "$(ev MATCH_START "$(E "del-$who")")")")"
  check Rechte "M3: soft-geloeschtes Turnier ($who) -> FORBIDDEN_ACTOR, state null" '[.results[].code] == ["FORBIDDEN_ACTOR"] and .state == null' "$out"
done
out="$(q "SELECT count(*) FROM public.match_events WHERE match_id = '$(M del)';")"
check Rechte "M3: soft-geloeschtes Turnier: nichts gespeichert" '. == 0' "$out"
out="$(call anon "" "$(M r4)" "$(arr "$(ev MATCH_START "$(E r4-anon)")")")"
check Rechte "anon: kein EXECUTE (42501)" '.exception == "42501"' "$out"
out="$(call authenticated "" "$(M r4)" "$(arr "$(ev MATCH_START "$(E r4-nouid)")")")"
check Rechte "authenticated ohne auth.uid(): Fehler 42501 (auth.uid)" '.exception == "42501" and (.message | test("auth\\.uid"))' "$out"

# --- 6. Idempotenz ----------------------------------------------------------------------------
echo "Idempotenz..." >&2
call authenticated "$U_OWNER" "$(M i1)" "$(arr "$(ev MATCH_START "$(E i1-start)")")" >/dev/null
call authenticated "$U_OWNER" "$(M i2)" "$(arr "$(ev MATCH_START "$(E i2-start)")")" >/dev/null
BATCH="$(arr "$(ev GOAL "$(E i1-g1)" '{"at":2000,"clockMs":1000,"teamId":"@V:TA@"}')" "$(ev FOUL "$(E i1-f1)" '{"at":2100,"clockMs":1100,"teamId":"@V:TB@","payload":{"playerNumber":4}}')")"
first="$(call authenticated "$U_HELPER" "$(M i1)" "$BATCH")"
check Idempotenz "erster Aufruf: accepted, accepted" '[.results[].status] == ["accepted","accepted"]' "$first"
second="$(call authenticated "$U_HELPER" "$(M i1)" "$BATCH")"
first_seqs="$(jq -c '[.results[]?.seq]' <<<"$first" 2>/dev/null || echo '[]')"
check Idempotenz "gleicher Aufruf zweimal: duplicate mit seq des Originals" \
  "[.results[].status] == [\"duplicate\",\"duplicate\"] and [.results[].seq] == $first_seqs" "$second"
out="$(q "SELECT count(*) FROM public.match_events WHERE id IN ('$(E i1-g1)', '$(E i1-f1)');")"
check Idempotenz "1 Zeile je ID" '. == 2' "$out"
out="$(call authenticated "$U_HELPER" "$(M i1)" "$(arr "$(ev GOAL "$(E i1-g1)" '{"at":2000,"clockMs":9999,"teamId":"@V:TA@"}')")")"
check Idempotenz "gleiche ID, anderer Inhalt -> ID_CONFLICT" '.results[0].code == "ID_CONFLICT"' "$out"
out="$(call authenticated "$U_HELPER" "$(M i2)" "$(arr "$(ev GOAL "$(E i1-g1)" '{"at":2000,"clockMs":1000,"teamId":"@V:TA@"}')")")"
check Idempotenz "gleiche ID, anderes Spiel -> ID_CONFLICT" '.results[0].code == "ID_CONFLICT"' "$out"
out="$(call authenticated "$U_HELPER" "$(M i1)" "$(arr "$(ev MATCH_START "$(E i1-start)" '{"payload":{"rules":{"sections":4,"sectionSeconds":1}}}')")")"
check Idempotenz "MATCH_START-Wiederholung mit anderen Client-Regeln -> duplicate" '.results[0].status == "duplicate"' "$out"
out="$(call authenticated "$U_HELPER" "$(M i1)" "$(arr "$(ev MATCH_END "$(E i1-end1)" '{"at":3000,"clockMs":600000}')" "$(ev MATCH_END "$(E i1-end2)" '{"at":3100,"clockMs":600000}')")")"
check Idempotenz "zweites MATCH_END -> noop" '[.results[].status] == ["accepted","noop"]' "$out"
out="$(call authenticated "$U_HELPER" "$(M i1)" "$(arr "$(ev MATCH_END "$(E i1-end2)" '{"at":3100,"clockMs":600000}')")")"
rows="$(q "SELECT count(*) FROM public.match_events WHERE id = '$(E i1-end2)';")"
check Idempotenz "noop nie gespeichert (Wiederholung wieder noop, 0 Zeilen)" \
  "(.results[0].status == \"noop\") and ($rows == 0)" "$out"

# --- 7. Kaskade -------------------------------------------------------------------------------
echo "Kaskade..." >&2
call authenticated "$U_OWNER" "$(M c1)" "$(arr "$(ev MATCH_START "$(E c1-start)")")" >/dev/null
out="$(call authenticated "$U_HELPER" "$(M c1)" "$(arr "$(ev GOAL "$(E c1-bad)" '{"at":2000,"teamId":"@T:fremd@"}')" "$(ev GOAL "$(E c1-good)" '{"at":2100,"teamId":"@V:TA@"}')")")"
check Kaskade "abgelehnter Eintrag haelt die anderen nicht auf" '[.results[] | [.status, .code]] == [["rejected","INVALID_PAYLOAD"],["accepted",null]]' "$out"
out="$(call authenticated "$U_HELPER" "$(M c1)" "$(arr "$(ev RESUME "$(E c1-resume)" '{"at":2200}')" "$(ev GOAL "$(E c1-after)" '{"at":2300,"teamId":"@V:TA@"}')")")"
rows="$(q "SELECT count(*) FROM public.match_events WHERE id = '$(E c1-after)';")"
check Kaskade "abgelehnter RESUME -> Folge DEPENDS_ON_REJECTED, nicht gespeichert" \
  "([.results[] | [.status, .code]] == [[\"rejected\",\"INVALID_TRANSITION\"],[\"rejected\",\"DEPENDS_ON_REJECTED\"]]) and ($rows == 0)" "$out"
out="$(call authenticated "$U_HELPER" "$(M c2)" "$(arr "$(ev MATCH_START "kein-uuid")" "$(ev GOAL "$(E c2-goal)" '{"teamId":"@V:TA@"}')")")"
check Kaskade "Umschlag-Ablehnung eines MATCH_START kaskadiert" '[.results[] | [.id, .code]] == [["kein-uuid","INVALID_PAYLOAD"],[.results[1].id,"DEPENDS_ON_REJECTED"]]' "$out"

# --- 8. Nebenlaeufigkeit ----------------------------------------------------------------------
echo "Nebenlaeufigkeit..." >&2
conc_session() {
  # $1 Ausgabedatei, $2 Nutzer, $3 Spiel, $4 Ereignisse, $5 Schlafdauer (s) nach dem Aufruf
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" psql -U postgres -X -q -tA > "$1" 2>&1 <<SQL
BEGIN;
SELECT public.__b3b_call('$2'::uuid, '$3'::uuid, \$J\$$4\$J\$::jsonb);
SELECT pg_sleep($5);
COMMIT;
SQL
}
conc_session "$WORKDIR/k1a.out" "$U_HELPER" "$(M k1)" "$(arr "$(ev MATCH_START "$(E k1-a)")" "$(ev GOAL "$(E k1-a-goal)" '{"at":1500,"teamId":"@V:TA@"}')")" 3 &
PID_A=$!
sleep 1
conc_session "$WORKDIR/k1b.out" "$U_COADMIN" "$(M k1)" "$(arr "$(ev MATCH_START "$(E k1-b)")" "$(ev GOAL "$(E k1-b-goal)" '{"at":1500,"teamId":"@V:TB@"}')")" 0 &
PID_B=$!
wait "$PID_A" "$PID_B"
a="$(grep '^{' "$WORKDIR/k1a.out" | head -1)"; b="$(grep '^{' "$WORKDIR/k1b.out" | head -1)"
check Nebenlaeufig "gleichzeitiger Anpfiff: erste Sitzung angenommen" '[.results[].status] == ["accepted","accepted"]' "$a"
check Nebenlaeufig "gleichzeitiger Anpfiff: zweite Sitzung INVALID_TRANSITION + DEPENDS_ON_REJECTED" \
  '[.results[].code] == ["INVALID_TRANSITION","DEPENDS_ON_REJECTED"]' "$b"
out="$(q "SELECT jsonb_agg(seq ORDER BY seq) FROM public.match_events WHERE match_id = '$(M k1)';")"
check Nebenlaeufig "genau 2 Zeilen, seq lueckenlos steigend" 'length == 2 and .[1] == .[0] + 1' "$out"
call authenticated "$U_OWNER" "$(M k2)" "$(arr "$(ev MATCH_START "$(E k2-start)")")" >/dev/null
conc_session "$WORKDIR/k2a.out" "$U_HELPER" "$(M k2)" "$(arr "$(ev GOAL "$(E k2-a)" '{"at":2000,"teamId":"@V:TA@"}')")" 2 &
PID_A=$!
sleep 1
conc_session "$WORKDIR/k2b.out" "$U_COADMIN" "$(M k2)" "$(arr "$(ev GOAL "$(E k2-b)" '{"at":2000,"teamId":"@V:TA@"}')")" 0 &
PID_B=$!
wait "$PID_A" "$PID_B"
b="$(grep '^{' "$WORKDIR/k2b.out" | head -1)"
check Nebenlaeufig "zwei gleichzeitige Tore: beide angenommen, zweite Sitzung sieht Stand 2" ".results[0].status == \"accepted\" and .state.effectiveScores[\"$TA\"] == 2" "$b"
out="$(q "SELECT jsonb_agg(id ORDER BY seq) FROM public.match_events WHERE match_id = '$(M k2)' AND type = 'GOAL';")"
check Nebenlaeufig "Tore in Commit-Reihenfolge (seq)" ". == [\"$(E k2-a)\", \"$(E k2-b)\"]" "$out"

# --- 9. Sonstiges -----------------------------------------------------------------------------
echo "Sonstiges..." >&2
out="$(call authenticated "$U_OWNER" "$(M o1)" "$(arr "$(ev MATCH_START "$(E o1-start)")")" 0)"
check Sonstiges "p_client_format = 0 -> CLIENT_OUTDATED" '.error == "CLIENT_OUTDATED" and .minClientFormat == 1 and (.results == null)' "$out"
out="$(q "SELECT count(*) FROM public.match_events WHERE match_id = '$(M o1)';")"
check Sonstiges "CLIENT_OUTDATED ohne Wirkung" '. == 0' "$out"
out="$(q "SELECT public.__b3b_exec(NULL, 'SELECT public.server_time()', 'anon');")"
check Sonstiges "server_time() fuer anon ausfuehrbar" '. == "ok:1"' "\"$out\""
out="$(q "SELECT jsonb_build_object('diff', abs((public.server_time()->>'serverTime')::bigint - floor(extract(epoch FROM now()) * 1000)::bigint));")"
check Sonstiges "server_time() liefert Epoch-ms" '.diff < 5000' "$out"

GUARD_ID="$(E r1-goal)"
for who in owner helper; do
  uid="$U_OWNER"; [[ "$who" == "helper" ]] && uid="$U_HELPER"
  out="$(q "SELECT public.__b3b_exec('$uid', \$S\$UPDATE public.match_events SET payload = '{\"x\":1}'::jsonb WHERE id = '$GUARD_ID'\$S\$);")"
  check Sonstiges "Guard: $who kann RPC-Zeile nicht aendern" '. == "error:42501"' "\"$out\""
  out="$(q "SELECT public.__b3b_exec('$uid', \$S\$DELETE FROM public.match_events WHERE id = '$GUARD_ID'\$S\$);")"
  check Sonstiges "Guard: $who kann RPC-Zeile nicht loeschen" '. == "error:42501"' "\"$out\""
done
out="$(q "SELECT count(*) FROM public.match_events WHERE id = '$GUARD_ID' AND payload = '{}'::jsonb AND event_format = 1;")"
check Sonstiges "Guard: RPC-Zeile unveraendert" '. == 1' "$out"

# S10: Grossbuchstaben-IDs werden kanonisch klein gespeichert; Nachrechnen == Anhaengen.
UP() { tr '[:lower:]' '[:upper:]' <<<"$1"; }
S_START="$(E s10-start)"; S_GOAL="$(E s10-goal)"; S_END="$(E s10-end)"; S_CORR="$(E s10-corr)"
out="$(call authenticated "$U_HELPER" "$(M s10)" "$(arr "$(ev MATCH_START "$(UP "$S_START")")" \
  "$(ev GOAL "$(UP "$S_GOAL")" '{"at":2000,"clockMs":1000,"teamId":"@U:TA@"}')" \
  "$(ev MATCH_END "$(UP "$S_END")" '{"at":3000,"clockMs":600000}')")")"
check Sonstiges "S10: Grossbuchstaben-IDs angenommen, Ergebnis-IDs klein" \
  "[.results[].status] == [\"accepted\",\"accepted\",\"accepted\"] and [.results[].id] == [\"$S_START\",\"$S_GOAL\",\"$S_END\"]" "$out"
out="$(call authenticated "$U_OWNER" "$(M s10)" "$(arr "$(ev CORRECTION "$(UP "$S_CORR")" '{"at":4000,"payload":{"scores":{"@V:TA@":2,"@V:TB@":0},"reason":"x","basedOn":"@U:S_GOAL@"}}')")")"
check Sonstiges "S10: Korrektur mit basedOn in Grossbuchstaben angenommen (nicht STALE_BASE)" '.results[0].status == "accepted"' "$out"
rpc_state="$(jq -c '.state' <<<"$out")"
check Sonstiges "S10: compute_match_state == Zustand beim Anhaengen" ". == $rpc_state" "$(state_of "$(M s10)")"
out="$(q "SELECT jsonb_agg(jsonb_build_object('id', id, 'team', team_id, 'basedOn', payload->>'basedOn') ORDER BY seq) FROM public.match_events WHERE match_id = '$(M s10)';")"
check Sonstiges "S10: gespeichert klein (id, team_id, payload.basedOn)" \
  ".[1].id == \"$S_GOAL\" and .[1].team == \"$TA\" and .[3].basedOn == \"$S_GOAL\"" "$out"
out="$(call authenticated "$U_HELPER" "$(M s10)" "$(arr "$(ev GOAL "$(UP "$S_GOAL")" '{"at":2000,"clockMs":1000,"teamId":"@U:TA@"}')")")"
check Sonstiges "S10: erneutes Senden in Grossbuchstaben -> duplicate" '.results[0].status == "duplicate"' "$out"
out="$(call authenticated "$U_OWNER" "$(M s10)" "$(arr "$(ev RETRACT "$(E s10-r1)" '{"at":5000,"targetId":"constructor"}')" \
  "$(ev GOAL "g-kein-uuid" '{"teamId":"@V:TA@"}')" "$(ev CORRECTION "$(E s10-c2)" '{"at":5000,"payload":{"scores":{"@V:TA@":2,"@V:TB@":0},"reason":"x","basedOn":"nicht-uuid"}}')")")"
check Sonstiges "S10: Nicht-UUID in targetId/id/basedOn -> INVALID_PAYLOAD" '[.results[].code] == ["INVALID_PAYLOAD","INVALID_PAYLOAD","INVALID_PAYLOAD"]' "$out"

# S11 + R2: echte Epoch-ms (Rundreise ueber to_timestamp), Klemmung nach oben und unten.
NOW_MS="$(q "SELECT floor(extract(epoch FROM now()) * 1000)::bigint;")"
A1=$((NOW_MS - 600123))
A2=$((NOW_MS - 300457))
# FUTURE/A1M werden nur ueber @V:...@-Platzhalter in ev() gelesen.
# shellcheck disable=SC2034
FUTURE=$((NOW_MS + 3600000))
# shellcheck disable=SC2034
A1M=$((A1 - 5000))
out="$(call authenticated "$U_HELPER" "$(M s11)" "$(arr "$(ev MATCH_START "$(E s11-start)" '{"at":@V:A1@,"clockMs":null}')" \
  "$(ev PAUSE "$(E s11-pause)" '{"at":@V:A2@,"clockMs":299999}')" "$(ev RESUME "$(E s11-resume)" '{"at":@V:A1M@,"clockMs":299999}')")")"
check Sonstiges "S11/R2: at vor dem Vorgaenger wird auf dessen at geklemmt" \
  "[.results[].status] == [\"accepted\",\"accepted\",\"accepted\"] and .state.clock.anchorAt == $A2" "$out"
out="$(call authenticated "$U_HELPER" "$(M s11)" "$(arr "$(ev CLOCK_ADJUST "$(E s11-adj)" '{"at":@V:FUTURE@,"clockMs":300001}')")")"
check Sonstiges "S11/R2: at in der Zukunft wird auf die Serverzeit geklemmt" \
  '.results[0].status == "accepted" and .state.clock.anchorAt <= .serverTime and .state.clock.anchorAt > (.serverTime - 60000)' "$out"
rpc_state="$(jq -c '.state' <<<"$out")"
check Sonstiges "S11: compute_match_state == Zustand beim Anhaengen (echte Epoch-ms)" ". == $rpc_state" "$(state_of "$(M s11)")"

# S9: Umschlag.
out="$(call authenticated "$U_OWNER" "$(M e1)" "$(arr '"kein Objekt"' \
  "$(ev MATCH_START "$(E e1-at)" '{"at":1.5}')" "$(ev FOO "$(E e1-type)")" \
  "$(ev PAUSE "$(E e1-sec0)" '{"section":0}')" "$(ev PAUSE "$(E e1-sec6)" '{"section":6}')" \
  "$(ev PAUSE "$(E e1-clock)" '{"clockMs":-1}')" "$(ev PAUSE "$(E e1-clockbig)" '{"clockMs":2147483648}')" \
  "$(ev PAUSE "$(E e1-payload)" '{"payload":[]}')" "$(ev PAUSE "$(E e1-epoch)" '{"controlEpoch":"x"}')" \
  "$(ev PAUSE "$(E e1-target)" '{"targetId":"@E:e1-at@"}')")")"
check Sonstiges "S9: kein Objekt -> INVALID_PAYLOAD (id null); MATCH_START mit at 1.5 -> INVALID_PAYLOAD und Kaskade" \
  '[.results[].code] == ["INVALID_PAYLOAD","INVALID_PAYLOAD","DEPENDS_ON_REJECTED","DEPENDS_ON_REJECTED","DEPENDS_ON_REJECTED","DEPENDS_ON_REJECTED","DEPENDS_ON_REJECTED","DEPENDS_ON_REJECTED","DEPENDS_ON_REJECTED","DEPENDS_ON_REJECTED"] and .results[0].id == null' "$out"
call authenticated "$U_OWNER" "$(M e1)" "$(arr "$(ev MATCH_START "$(E e1-start)")")" >/dev/null
out="$(call authenticated "$U_OWNER" "$(M e1)" "$(arr "$(ev FOO "$(E e1-type2)")" \
  "$(ev PAUSE "$(E e1-sec0b)" '{"section":0}')" "$(ev PAUSE "$(E e1-sec6b)" '{"section":6}')" \
  "$(ev PAUSE "$(E e1-clockb)" '{"clockMs":-1}')" "$(ev PAUSE "$(E e1-clockbigb)" '{"clockMs":2147483648}')" \
  "$(ev PAUSE "$(E e1-payloadb)" '{"payload":[]}')" "$(ev PAUSE "$(E e1-epochb)" '{"controlEpoch":"x"}')" \
  "$(ev PAUSE "$(E e1-targetb)" '{"targetId":"@E:e1-start@"}')" "$(ev PAUSE "$(E e1-atb)" '{"at":"1000"}')")")"
check Sonstiges "S9: Typ/section/clockMs/payload/controlEpoch/targetId/at ungueltig -> je INVALID_PAYLOAD" \
  '[.results[].code] | length == 9 and all(. == "INVALID_PAYLOAD")' "$out"
out="$(q "SELECT count(*) FROM public.match_events WHERE match_id = '$(M e1)';")"
check Sonstiges "S9: nur der gueltige MATCH_START gespeichert" '. == 1' "$out"

for bad in '{}' '[]' "$(jq -cn '[range(0; 201) | {}]')" 'null'; do
  out="$(call authenticated "$U_OWNER" "$(M e1)" "$bad")"
  check Sonstiges "p_events $(head -c 12 <<<"$bad")...: Fehler 22023" '.exception == "22023"' "$out"
done

# 5d: servergesetzte Regeln (Client-Regeln verworfen) + Ableitung inkl. Standardwerten.
out="$(q "SELECT payload FROM public.match_events WHERE id = '$(E i1-start)';")"
check Sonstiges "5d: MATCH_START speichert Server-Regeln (Standard: 1 Abschnitt, Turnierdauer, Pause 60, shootout (S14), 300, 5, 6, 120)" \
  '.rules == {"sections":1,"sectionSeconds":600,"breakSeconds":60,"knockout":false,"tiebreak":"shootout","overtimeSeconds":300,"shootersPerTeam":5,"suddenDeathAfter":6,"penaltySeconds":120}' "$out"
out="$(q "SELECT jsonb_build_array(
  match_engine.server_rules(NULL, 'groupStage', 12, 20, '{}'::jsonb, NULL),
  match_engine.server_rules(NULL, 'final', 12, 20, '{\"gamePeriods\":9,\"halftimeBreak\":\"2\"}'::jsonb, '{\"tiebreaker\":\"goldenGoal\",\"tiebreakerDuration\":3}'::jsonb),
  match_engine.server_rules(7, 'semifinal', 12, NULL, '{\"gamePeriods\":\"2\",\"matchCockpitSettings\":{\"penaltyShootersPerTeam\":3,\"penaltySuddenDeathAfter\":4}}'::jsonb, '{\"tiebreaker\":\"bogus\"}'::jsonb),
  match_engine.server_rules(NULL, NULL, 12, 20, '{\"gamePeriods\":0}'::jsonb, NULL));" 2>&1 || true)"
check Sonstiges "5d: Regelableitung (Standard, Begrenzung 1-4, Zahl als Text, duration_minutes vor Turnierdauer, K.o., fehlender/ungueltiger tiebreaker -> shootout (S14))" \
  '.[0] == {"sections":1,"sectionSeconds":720,"breakSeconds":60,"knockout":false,"tiebreak":"shootout","overtimeSeconds":300,"shootersPerTeam":5,"suddenDeathAfter":6,"penaltySeconds":120}
   and .[1] == {"sections":4,"sectionSeconds":300,"breakSeconds":120,"knockout":true,"tiebreak":"goldenGoal","overtimeSeconds":180,"shootersPerTeam":5,"suddenDeathAfter":6,"penaltySeconds":120}
   and .[2] == {"sections":2,"sectionSeconds":210,"breakSeconds":60,"knockout":true,"tiebreak":"shootout","overtimeSeconds":300,"shootersPerTeam":3,"suddenDeathAfter":4,"penaltySeconds":120}
   and .[3].sections == 1 and .[3].knockout == false and .[3].sectionSeconds == 720' "$out"

# --- 9b. Fixrunde 1: S14, S13 + R14-Spalten, M4, M1 ------------------------------------------
echo "Fixrunde 1 (S13, S14, R14, M1, M4)..." >&2
# S14: K.o.-Spiel ohne finals_config.tiebreaker -> Remis nach Spielende geht ins Strafstossschiessen.
out="$(call authenticated "$U_HELPER" "$(M s14)" "$(arr "$(ev MATCH_START "$(E s14-start)")" "$(ev MATCH_END "$(E s14-end)" '{"at":2000,"clockMs":600000}')")")"
check Sonstiges "S14: K.o.-Remis ohne tiebreaker-Einstellung -> shootout (nicht decision_pending)" \
  '[.results[].status] == ["accepted","accepted"] and .state.status == "shootout" and .state.phase == "shootout"' "$out"

# S13 + R14: K.o.-Spiel mit 4 Abschnitten -- Verlaengerung ist Abschnitt 5; Spaltenvergleich je Zeile.
R14_1="$(arr "$(ev MATCH_START "$(E ko-01)" '{"at":1000,"clockMs":null}')" \
  "$(ev GOAL "$(E ko-02)" '{"at":2000,"clockMs":61500,"teamId":"@T:ko4-a@","controlEpoch":3}')" \
  "$(ev SECTION_END "$(E ko-03)" '{"at":3000,"clockMs":300000}')" "$(ev SECTION_START "$(E ko-04)" '{"at":3100,"section":2,"clockMs":300000}')" \
  "$(ev SECTION_END "$(E ko-05)" '{"at":4000,"section":2,"clockMs":600000}')" "$(ev SECTION_START "$(E ko-06)" '{"at":4100,"section":3,"clockMs":600000}')" \
  "$(ev SECTION_END "$(E ko-07)" '{"at":5000,"section":3,"clockMs":900000}')" "$(ev SECTION_START "$(E ko-08)" '{"at":5100,"section":4,"clockMs":900000}')" \
  "$(ev GOAL "$(E ko-09)" '{"at":5500,"section":4,"clockMs":1000000,"teamId":"@T:ko4-b@"}')" \
  "$(ev MATCH_END "$(E ko-10)" '{"at":6000,"section":4,"clockMs":1200000}')")"
out="$(call authenticated "$U_HELPER" "$(M ko)" "$R14_1")"
check Sonstiges "S13: 4 Abschnitte, Remis -> Pause vor der Verlaengerung in Abschnitt 5" \
  '([.results[].status] | all(. == "accepted")) and .state.status == "section_break" and .state.phase == "overtime" and .state.section == 5' "$out"
R14_2="$(arr "$(ev SECTION_START "$(E ko-11)" '{"at":7000,"section":5,"clockMs":1200000}')" \
  "$(ev GOAL "$(E ko-12)" '{"at":7100,"section":5,"clockMs":1260000,"teamId":"@T:ko4-a@"}')" \
  "$(ev GOAL "$(E ko-13)" '{"at":7200,"section":5,"clockMs":1320000,"teamId":"@T:ko4-b@"}')" \
  "$(ev MATCH_END "$(E ko-14)" '{"at":7300,"section":5,"clockMs":1500000}')" \
  "$(ev SHOOTOUT_KICK "$(E ko-15)" '{"at":7400,"section":null,"clockMs":null,"teamId":"@T:ko4-a@","payload":{"scored":true}}')")"
out="$(call authenticated "$U_HELPER" "$(M ko)" "$R14_2")"
check Sonstiges "S13: Ereignisse mit section 5 in der Verlaengerung angenommen, danach Strafstossschiessen" \
  '([.results[].status] | all(. == "accepted")) and .state.status == "shootout" and .state.section == 5' "$out"
out="$(q "SELECT jsonb_agg(jsonb_build_array(type, period, score_home, score_away, section, timestamp_seconds, base_seq > 0, control_epoch) ORDER BY seq) FROM public.match_events WHERE match_id = '$(M ko)';")"
check Sonstiges "R14: period/score_home/score_away/section/timestamp_seconds/base_seq/control_epoch je Zeile" \
  '. == [["MATCH_START","regular",0,0,1,0,false,null],["GOAL","regular",1,0,1,61.5,false,3],
         ["SECTION_END","regular",1,0,1,300,false,null],["SECTION_START","regular",1,0,2,300,false,null],
         ["SECTION_END","regular",1,0,2,600,false,null],["SECTION_START","regular",1,0,3,600,false,null],
         ["SECTION_END","regular",1,0,3,900,false,null],["SECTION_START","regular",1,0,4,900,false,null],
         ["GOAL","regular",1,1,4,1000,false,null],["MATCH_END","regular",1,1,4,1200,false,null],
         ["SECTION_START","overtime",1,1,5,1200,true,null],["GOAL","overtime",2,1,5,1260,true,null],
         ["GOAL","overtime",2,2,5,1320,true,null],["MATCH_END","overtime",2,2,5,1500,true,null],
         ["SHOOTOUT_KICK","penalty",2,2,null,0,true,null]]' "$out"
out="$(q "SELECT count(DISTINCT base_seq) = 2 AND min(base_seq) = 0 AND max(base_seq) = (SELECT max(seq) FROM public.match_events WHERE match_id = '$(M ko)' AND id IN ('$(E ko-01)','$(E ko-02)','$(E ko-03)','$(E ko-04)','$(E ko-05)','$(E ko-06)','$(E ko-07)','$(E ko-08)','$(E ko-09)','$(E ko-10)')) FROM public.match_events WHERE match_id = '$(M ko)';")"
check Sonstiges "R14: base_seq = max(seq) des Spiels vor dem Aufruf (0, dann letzte seq des ersten Aufrufs)" '. == "t"' "\"$out\""

# M4: live_state wird zusammengefuehrt -- fremde Schluessel (refereeName) bleiben.
psql_stdin <<<"UPDATE public.matches SET live_state = '{\"refereeName\":\"Anna\",\"engine\":false}'::jsonb WHERE id = '$(M m4)';"
call authenticated "$U_HELPER" "$(M m4)" "$(arr "$(ev MATCH_START "$(E m4-start)")")" >/dev/null
cache="$(cache_of "$(M m4)")"
check Sonstiges "M4: live_state zusammengefuehrt (refereeName bleibt, Engine-Schluessel gesetzt)" \
  '.live_state.refereeName == "Anna" and .live_state.engine == true and .live_state.status == "running"' "$cache"

# M1: payload/baseState je Ereignis hoechstens 16 KB; hoechstens 2000 gespeicherte Engine-Ereignisse.
# BIG/OKSIZE werden nur ueber @V:...@-Platzhalter in ev() gelesen.
# shellcheck disable=SC2034
BIG="$(head -c 17000 /dev/zero | tr '\0' 'x')"
# shellcheck disable=SC2034
OKSIZE="$(head -c 15000 /dev/zero | tr '\0' 'x')"
call authenticated "$U_HELPER" "$(M m1)" "$(arr "$(ev MATCH_START "$(E m1-start)")")" >/dev/null
out="$(call authenticated "$U_HELPER" "$(M m1)" "$(arr "$(ev FOUL "$(E m1-bigp)" '{"at":2000,"teamId":"@V:TA@","payload":{"junk":"@V:BIG@"}}')" \
  "$(ev FOUL "$(E m1-bigb)" '{"at":2000,"teamId":"@V:TA@","baseState":{"junk":"@V:BIG@"}}')" \
  "$(ev FOUL "$(E m1-okp)" '{"at":2000,"teamId":"@V:TA@","payload":{"junk":"@V:OKSIZE@"},"baseState":{"junk":"@V:OKSIZE@"}}')")")"
check Sonstiges "M1: payload bzw. baseState > 16 KB -> INVALID_PAYLOAD, 15 KB angenommen" \
  '[.results[] | .status + ":" + (.code // "")] == ["rejected:INVALID_PAYLOAD","rejected:INVALID_PAYLOAD","accepted:"]' "$out"
psql_stdin <<SQL
INSERT INTO public.match_events (id, match_id, type, team_id, timestamp_seconds, score_home, score_away, event_format, client_time, clock_ms, section)
SELECT gen_random_uuid(), '$(M m1)', 'FOUL', '$TA', 1, 0, 0, 1, to_timestamp(3), 1000, 1 FROM generate_series(1, 1998);
SQL
out="$(q "SELECT count(*) FROM public.match_events WHERE match_id = '$(M m1)' AND event_format IS NOT NULL AND review_state IS NULL;")"
check Sonstiges "M1: Vorbereitung 2000 gespeicherte Engine-Ereignisse" '. == 2000' "$out"
out="$(call authenticated "$U_HELPER" "$(M m1)" "$(arr "$(ev FOUL "$(E m1-over)" '{"at":4000,"teamId":"@V:TA@"}')")")"
rows="$(q "SELECT count(*) FROM public.match_events WHERE id = '$(E m1-over)';")"
check Sonstiges "M1: 2001. Ereignis -> Aufruf-Fehler 54000, nichts gespeichert" \
  ".exception == \"54000\" and ($rows == 0)" "$out"
out="$(call authenticated "$U_HELPER" "$(M m1)" "$(arr "$(ev FOUL "$(E m1-okp)" '{"at":2000,"teamId":"@V:TA@","payload":{"junk":"@V:OKSIZE@"},"baseState":{"junk":"@V:OKSIZE@"}}')")")"
check Sonstiges "M1: Wiederholung am Limit bleibt duplicate (kein Fehler)" '.results[0].status == "duplicate"' "$out"

# --- 10. Laufzeit: 1 Ereignis bei 100 gespeicherten (nur Ausgabe) -----------------------------
if [[ "$MODE" == "normal" ]]; then
  PERF_EVENTS="$(jq -cn --arg a "$TA" --arg p "$(E perf)" '
    [{id: ($p[0:24] + "000000000000"), type: "MATCH_START", at: 1000, section: 1, clockMs: null, payload: {}}]
    + [range(1; 100) as $i | {id: ($p[0:24] + ("000000000000" + ($i | tostring))[-12:]), type: "FOUL",
       at: (1000 + $i), section: 1, clockMs: ($i * 1000), teamId: $a, payload: {playerNumber: ($i % 10)}}]')"
  call authenticated "$U_HELPER" "$(M perf)" "$PERF_EVENTS" >/dev/null
  STORED="$(q "SELECT count(*) FROM public.match_events WHERE match_id = '$(M perf)';")"
  PERF_OUT="$(psql_value <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub', '$U_HELPER', true), set_config('role', 'authenticated', true);
EXPLAIN (ANALYZE, TIMING OFF, SUMMARY ON) SELECT public.append_match_events('$(M perf)'::uuid,
  \$J\$[{"id":"$(E perf-goal)","type":"GOAL","at":5000,"section":1,"clockMs":200000,"teamId":"$TA","payload":{}}]\$J\$::jsonb, 1);
ROLLBACK;
SQL
)"
  echo "Laufzeit: $STORED gespeicherte Ereignisse, 1 neues: $(grep -E 'Execution Time' <<<"$PERF_OUT" | sed 's/^ *//')"
fi

# --- 11. Rechte-Assertion ---------------------------------------------------------------------
PRIV_OUT="$(psql_value < "$REPO_ROOT/scripts/db_privilege_assertions.sql" 2>&1)" || {
  count_dev Rechte-Assertion
  echo "ABWEICHUNG  [Rechte-Assertion] nicht ausfuehrbar: $(head -c 300 <<<"$PRIV_OUT")"
  PRIV_OUT=""
}
if [[ -n "$PRIV_OUT" ]]; then
  PRIV_FAILED="$(grep -v '|t$' <<<"$PRIV_OUT" || true)"
  if [[ -n "$PRIV_FAILED" ]]; then
    count_dev Rechte-Assertion
    echo "ABWEICHUNG  [Rechte-Assertion] $PRIV_FAILED"
  else
    count_ok Rechte-Assertion
    echo "OK          [Rechte-Assertion] $(wc -l <<<"$PRIV_OUT" | tr -d ' ') Zeilen |t"
  fi
fi

# --- 12. Ergebnis -----------------------------------------------------------------------------
echo ""
TOTAL_DEV=0
SUMMARY=""
for i in "${!CATS[@]}"; do
  TOTAL_DEV=$((TOTAL_DEV + DEV[i]))
  SUMMARY+="${CATS[$i]}=${OKS[$i]}ok/${DEV[$i]}rot "
done
echo "Ergebnis je Kategorie: $SUMMARY"

red_required() {
  local missing=()
  local cat
  for cat in "$@"; do
    [[ "${DEV[$(cat_index "$cat")]}" -gt 0 ]] || missing+=("$cat")
  done
  if [[ "${#missing[@]}" -eq 0 ]]; then
    echo "Gegenprobe ($MODE) wie erwartet ROT in: $*"
    exit 0
  fi
  echo "::error::Gegenprobe ($MODE): Mutation blieb UNBEMERKT in: ${missing[*]} -- dieser Teil ist zahnlos." >&2
  exit 1
}
case "$MODE" in
  without-migration) red_required Fixtures Rechte Idempotenz Kaskade Nebenlaeufig Sonstiges Rechte-Assertion ;;
  gegenprobe) red_required Fixtures Rechte ;;
esac
if [[ "$TOTAL_DEV" -gt 0 ]]; then
  echo "::error::$TOTAL_DEV Abweichung(en) im Schreibweg-Harness." >&2
  exit 1
fi
echo "Schreibweg-Harness gruen: alle Proben wie erwartet."
exit 0
