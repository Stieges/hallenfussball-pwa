#!/usr/bin/env bash
#
# abschluss-nachzug-check.sh — Container-Beweis fuer supabase/migrations/20261118_004_abschluss_nachzug.sql (W-M,
# plan-R3-abschluss-v3.md § 2 „W-M“, V1, S3). Muster: scripts/verschieben-server-check.sh (ein Wegwerf-Container,
# Baseline + Migrationen seit Baseline, trap, --without-migration, --gegenprobe, --print-rueckweg) mit den Turnieren und
# Hilfen aus scripts/lib/tournament-lifecycle-probes.sh (Nikolaus-Turnier, „Hallencup Nord“, Olli/Maria/Tom/Kai/
# Hallen-Monitor/Fremder, Ergebnisse ueber append_match_events).
#
# Testwerte aus dem Gherkin: @LZ-010 Zeile „in der Klaerungsliste ist ein Eintrag ‚Tor Heim, von Tom‘ zum Halbfinale 2
# offen“, @LZ-012 „Spiel um Platz 3 laeuft, 2 Klaerungen offen -> 3 Eintraege“, @LZ-009 (nichts offen -> abgeschlossen),
# @LZ-008 (offen -> kein Vorschlag = canFinish false), @ZM-121 Zeile „Bambini-Cup mit eingeschaltetem Kindermodus“,
# @LZ-039 „Olli und Maria sehen den Eintrag als ‚nach dem Ende eingetroffen‘“. Ein Klaerungseintrag entsteht wie in
# rls-matrix.d/spur-y-klaerung-a35.sh (Superuser-Vorbereitung: Tor in match_events mit review_state 'pending' + Zeile in
# match_reviews, Grund CONTROL_LOST); entschieden wird ueber append_match_events (REVIEW_DISCARD der Turnierleitung).
#
# Kategorien:
#   P  Positiv-Kontrolle zuerst: Hallencup Nord und Nikolaus ohne offene Klaerung -> abschliessen gelingt.
#   F  Fail-fast (Block 0 der Datei unter Test, in einer zurueckgerollten Transaktion; plus ganze Datei): fremde Fassung
#      von finish_open_items / final_standings_payload / list_match_reviews, fehlende match_reviews / public_view.switches
#      -> Abbruch ohne Aenderung.
#   A  (a) Klaerungsliste haelt den Abschluss auf: @LZ-010 Z. 4, @LZ-012, @LZ-008, Luecke zwischen Liste und Abschluss
#      (V1/S2), Gegenbeispiele (entschieden per Verwerfen/Uebernehmen, Hinweis, anderes Turnier, Entscheidung selbst noch
#      in der Klaerung).
#   K  (b) Kindermodus: Zuschauer und Monitor erhalten keinen Endstand (auch nicht mit Torschuetzen-Schalter);
#      Gegenbeispiele ohne Kindermodus bzw. Schalter als Text "true".
#   L  (c) list_late_entries: Olli und Maria sehen die Eintraege mit Namen (nie E-Mail), alle anderen nichts, anon 42501.
#   S  Rechte und Katalog: DEFINER/search_path/EXECUTE; +1 Funktion, keine Tabelle/Policy/Trigger; Rechte-Assertion als
#      ci_schema_reader (alle |t, die drei neuen vorhanden), Namensliste und Zuordnung in db-drift-check.sh.
#   W  zweites Einspielen (idempotent).   X  Rueckweg -> Schema = vorher; Waechter stoppt den zweiten Rueckweg.
#
# Aufrufoptionen:
#   bash scripts/abschluss-nachzug-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/abschluss-nachzug-check.sh --without-migration  Gegenprobe: ohne die Migration muessen A, K und L rot sein
#   bash scripts/abschluss-nachzug-check.sh --gegenprobe         je Lauf eine Mutation der Migration (M1-M10); Exit 0 NUR,
#                                                                wenn JEDE Mutation mindestens eine Pruefung rot faerbt
#   bash scripts/abschluss-nachzug-check.sh --print-rueckweg     gibt den Rueckweg aus, ohne Container
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container
# (supabase/postgres:17.6.1.063, nativ; DOCKER_PLATFORM waehlt die Plattform ausdruecklich), wird am Ende entfernt (trap).
#
set -uo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  --print-rueckweg) MODE="print-rueckweg" ;;
  *) echo "::error::Unbekannte Option: $1 (erlaubt: --without-migration, --gegenprobe, --print-rueckweg)" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie tournament-lifecycle-check.sh
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261118_004_abschluss_nachzug.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
LIFECYCLE_FILE="$MIGRATIONS_DIR/20261113_003_tournament_lifecycle.sql"
FIX_DIR="$REPO_ROOT/src/core/standings/__fixtures__"
CONTAINER_PREFIX="abschluss-nachzug-check-$$"
CURRENT_CONTAINER=""
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/abschluss-nachzug-check.XXXXXX")"
NEW_ASSERTIONS="abschluss-nachzug-open-items-review-open abschluss-nachzug-payload-kids-mode abschluss-nachzug-late-entries-rpc"

# Funktionstext woertlich aus 20261113_003 (Rueckweg und Fail-fast-Probe)
fn_003_sql() { # fn_003_sql <Funktionsname mit Schema, ohne Klammer>
  awk -v head="CREATE OR REPLACE FUNCTION $1(" 'index($0, head) == 1 {f=1} f{print} f && $0=="$$;"{exit}' "$LIFECYCLE_FILE"
}

# Rueckweg (Anhang B der Freigabe): beide Funktionen woertlich aus 20261113_003, list_late_entries weg. EIN Block,
# Waechter: nur gegen die W-M-Fassung.
rueckweg_sql() {
  cat <<'SQL'
-- supabase/rollbacks/20261118_004_abschluss_nachzug_rollback.sql
-- RUECKWEG zu supabase/migrations/20261118_004_abschluss_nachzug.sql (W-M). Liegt bewusst NICHT in supabase/migrations
-- (wird nie nachgespielt). Erzeugt mit `bash scripts/abschluss-nachzug-check.sh --print-rueckweg`; belegt in
-- scripts/abschluss-nachzug-check.sh (Kategorie X: Schema danach = Stand vor der Migration).
-- Reihenfolge: ZUERST die App auf den Stand ohne W-M-Client (sie haelt den Abschluss dann wieder nur selbst auf, E5),
-- DANN dieser Block. Danach haelt die Klaerungsliste den Abschluss am Server NICHT mehr auf, und der oeffentliche
-- Endstand eines Turniers im Kindermodus ist wieder lesbar (Befunde C-ABSCHLUSS-OHNE-KLAERUNG,
-- C-ENDSTAND-KINDERMODUS-OEFFENTLICH). Keine Daten gehen verloren.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF to_regprocedure('public.list_late_entries(uuid)') IS NULL
     OR position('W-M (a)' IN coalesce((SELECT prosrc FROM pg_proc
                                        WHERE oid = to_regprocedure('match_engine.finish_open_items(uuid)')), '')) = 0 THEN
    RAISE EXCEPTION 'Rueckweg W-M: nicht in der W-M-Fassung -- nichts geaendert';
  END IF;
END
$rw$;
-- finish_open_items und final_standings_payload woertlich aus 20261113_003_tournament_lifecycle.sql
SQL
  fn_003_sql match_engine.finish_open_items
  echo
  fn_003_sql match_engine.final_standings_payload
  cat <<'SQL'
REVOKE ALL ON FUNCTION match_engine.finish_open_items(uuid),
                       match_engine.final_standings_payload(public.tournaments)
  FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.list_late_entries(uuid);
COMMIT;
-- Danach: Assertions abschluss-nachzug-* + PRIVILEGE_ASSERTION_NAMES + pending_assertions_for zurueck, Drift-Check.
SQL
}
if [[ "$MODE" == "print-rueckweg" ]]; then
  rueckweg_sql
  exit 0
fi

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
[[ "$SEEN_TARGET" -eq 1 ]] || { echo "::error::$TARGET_NAME nicht in der Liste 'neuer als Baseline'." >&2; exit 1; }

cleanup() {
  [[ -n "$CURRENT_CONTAINER" ]] && docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1
  rm -rf "$WORK_DIR"
  return 0
}
trap cleanup EXIT

start_container() {
  CURRENT_CONTAINER="$CONTAINER_PREFIX-$1"
  docker run -d ${DOCKER_PLATFORM:+--platform "$DOCKER_PLATFORM"} --name "$CURRENT_CONTAINER" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 150); do
    if [[ "$(docker logs "$CURRENT_CONTAINER" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "::error::Container wurde nach 150s nicht bereit." >&2
    docker logs "$CURRENT_CONTAINER" 2>&1 | tail -30 >&2
    exit 1
  fi
  for _ in $(seq 1 30); do
    docker exec "$CURRENT_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
}

psql_stdin() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q; }
psql_value() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA; }
q() { psql_value <<<"$1" 2>&1; }
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public --schema=match_engine postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }
apply_target() { psql_stdin < "${1:-$TARGET_FILE}"; }

CATS=(P F A K L S W X)
DEVS=(0 0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0 0)
FAILED=""
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
    FAILED="$FAILED"$'\n'"[$1] $2"
  fi
}
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
dev_of() { echo "${DEVS[$(cat_index "$1")]}"; }
reset_counts() { DEVS=(0 0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0 0); FAILED=""; }
summary() {
  local i line=""
  for i in "${!CATS[@]}"; do line="$line ${CATS[$i]} ${OKS[$i]}/$((OKS[i] + DEVS[i]))"; done
  echo "Zusammenfassung (OK/gesamt):$line -- Abweichungen: $(total_dev)"
}

# Turniere, Personen und Hilfen (setup_data, niko_ready, hc_ready, fin_niko, fin_hc, make_public, code_of, as_val,
# anon_val, life, gm ...) wie im A-21a-Beweis.
source "$REPO_ROOT/scripts/lib/tournament-lifecycle-probes.sh"

# ---------------------------------------------------------------------------------------------------------
# Hilfen dieses Beweises
# ---------------------------------------------------------------------------------------------------------
# Klaerungseintrag, wie append_match_events ihn ablegt (Tor Heim, von Tom; Grund CONTROL_LOST). Art review|notice.
review_add() { # review_add <Turnier> <Spiel> <Schluessel> [review|notice] -> Kennung des Eintrags
  local e kind="${4:-review}"
  e="$(q "SELECT harness.u('wm-review:$3');")"
  q "INSERT INTO public.match_events (id, match_id, type, team_id, timestamp_seconds, payload, score_home, score_away, event_format,
                                   client_time, clock_ms, section, review_state)
     SELECT '$e', m.id, 'GOAL', m.team_a_id, 60, '{}'::jsonb, 0, 0, 1, now(), 60000, 1,
            CASE WHEN '$kind' = 'review' THEN 'pending' END
       FROM public.matches m WHERE m.id = '$2';
     INSERT INTO public.match_reviews (event_id, tournament_id, match_id, field, kind, reason, user_id, detail)
     SELECT '$e', '$1', m.id, m.field, '$kind', 'CONTROL_LOST', harness.p('tom'), '{\"timing\": \"after\"}'::jsonb
       FROM public.matches m WHERE m.id = '$2';" >/dev/null
  echo "$e"
}
# Entscheidung der Turnierleitung ueber den Schreibweg (append_match_events): <Typ> = REVIEW_DISCARD | REVIEW_ACCEPT
decide() { # decide <Person> <Spiel> <Eintrag> <Typ> -> status[:code]
  q "SELECT lc.append('$1', '$2', jsonb_build_array(jsonb_build_object('id', harness.u('wm-decide:$3:$4'), 'type', '$4',
       'at', 2000, 'section', NULL, 'clockMs', NULL, 'teamId', NULL, 'targetId', '$3', 'payload', '{}'::jsonb)));"
}
# Entscheidung als gespeicherte Zeile (Superuser-Vorbereitung): <Typ>, review_state NULL = gueltig, 'pending' = selbst noch
# in der Klaerung (zaehlt nicht als entschieden). Fuer „Uebernehmen“: die Kopie in ein Spiel ohne Anpfiff lehnt der
# Schreibweg ab (NOT_STARTED, 20261117_005 § 4) -- die Harness-Spiele sind ohne Anpfiff erfasst.
decide_row() { # decide_row <Spiel> <Eintrag> <Typ> <review_state|NULL>
  q "INSERT INTO public.match_events (id, match_id, type, team_id, timestamp_seconds, payload, score_home, score_away, event_format,
                                   client_time, clock_ms, section, review_state, target_event_id)
     VALUES (harness.u('wm-decide-row:$2:$3'), '$1', '$3', NULL, 0, '{}'::jsonb, 0, 0, 1, now(), NULL, NULL, $4, '$2');" >/dev/null
}
items_kinds() { q "SELECT coalesce(string_agg(x ->> 'kind', ',' ORDER BY o), '') FROM jsonb_array_elements(harness.last() -> 'items') WITH ORDINALITY AS y(x, o);"; }
fs_rows() { q "SELECT count(*) FROM public.tournament_final_standings WHERE tournament_id = '$1';"; }
semi2() { q "SELECT lc.semi('$1', 'B1');"; }         # Halbfinale 2 (Erster der Gruppe B)
third() { q "SELECT lc.final('$1', 'thirdPlace');"; }
final_of() { q "SELECT lc.final('$1', 'final');"; }
anon_json() { q "SELECT harness.val(NULL, false, \$S\$$1\$S\$, 'anon');"; }
late_list() { # late_list <Person> <Turnier> -> JSON-Text oder error:SQLSTATE
  if [[ "$1" == "anon" ]]; then
    anon_json "SELECT public.list_late_entries('$2')::text"
  else
    as_val "$1" "SELECT public.list_late_entries('$2')::text"
  fi
}
jlen() { jq -r 'if type == "array" then length else "kein-array" end' <<<"$1" 2>/dev/null || echo "kein-json:$(head -c 60 <<<"$1")"; }

# ---------------------------------------------------------------------------------------------------------
# F: Fail-fast (Block 0 der Datei unter Test, zurueckgerollt)
# ---------------------------------------------------------------------------------------------------------
run_failfast() { # run_failfast <Datei>
  local file="$1" ff
  ff="$(awk '/^-- 0\. Voraussetzungen/{f=1} /^-- 1\. \(a\)/{exit} f' "$file")"
  check F "F1 fremde Fassung von finish_open_items (z. B. aus R2-M2, ein Leerzeichen anders) -> Abbruch 'unbekannte Fassung'" "1" \
    "$(q "BEGIN; $(fn_003_sql match_engine.finish_open_items | sed 's/^  SELECT coalesce(jsonb_agg(item ORDER BY ord, sortkey)/  SELECT coalesce(jsonb_agg(item ORDER BY ord,  sortkey)/')
$ff
ROLLBACK;" | grep -c 'finish_open_items hat eine unbekannte Fassung')"
  check F "F2 fremde Fassung von final_standings_payload -> Abbruch 'unbekannte Fassung'" "1" \
    "$(q "BEGIN; $(fn_003_sql match_engine.final_standings_payload | sed "s/jsonb_build_object('status', 'none')/jsonb_build_object('status', 'keiner')/")
$ff
ROLLBACK;" | grep -c 'final_standings_payload hat eine unbekannte Fassung')"
  check F "F3 ohne match_reviews (20261117_005 fehlt) -> Abbruch 'Voraussetzungen fehlen'" "1" \
    "$(q "BEGIN; DROP TABLE public.match_reviews CASCADE;
$ff
ROLLBACK;" | grep -c 'Voraussetzungen fehlen')"
  check F "F4 ohne public_view.switches (20261117_104 fehlt) -> Abbruch 'Voraussetzungen fehlen'" "1" \
    "$(q "BEGIN; DROP FUNCTION public_view.switches(jsonb) CASCADE;
$ff
ROLLBACK;" | grep -c 'Voraussetzungen fehlen')"
  check F "F5 list_match_reviews mit anderer Lesart „entschieden“ (ohne review_state) -> Abbruch 'unbekannte Fassung'" "1" \
    "$(q "BEGIN; CREATE OR REPLACE FUNCTION public.list_match_reviews(p_tournament_id uuid) RETURNS jsonb LANGUAGE sql STABLE AS \$x\$ SELECT '[]'::jsonb \$x\$;
$ff
ROLLBACK;" | grep -c 'list_match_reviews hat eine unbekannte Fassung')"
  check F "F6 match_reviews ohne Spalte field -> Abbruch 'unbekannte Form'" "1" \
    "$(q "BEGIN; ALTER TABLE public.match_reviews DROP COLUMN field;
$ff
ROLLBACK;" | grep -c 'match_reviews hat eine unbekannte Form')"
}

# ---------------------------------------------------------------------------------------------------------
# P, A, K, L, S: Proben (Erwartungen aus dem Gherkin bzw. dem Plan, nie aus dem Code abgelesen)
# ---------------------------------------------------------------------------------------------------------
run_wm_probes() {
  local t t2 e e1 e2 e3 e4 m s code d fa out out2 tl tl2

  # --- P Positiv-Kontrolle: nichts offen -> abschliessen gelingt (@LZ-009) -------------------------------------
  t="$(hc_ready)"
  check P "P1 @LZ-009 Hallencup Nord, alles entschieden, keine Klaerung offen: Liste leer, Vorschlag moeglich (canFinish)" "|true" \
    "$(q "SELECT lc.preflight('olli', '$t');")$(q "SELECT harness.last() ->> 'canFinish';")"
  check P "P2 @LZ-009 Olli schliesst ab -> ok, Zustand abgeschlossen" "ok|finished" "$(fin_hc olli "$t")|$(life "$t")"
  t="$(niko_ready)"
  check P "P3 @LZ-009 Nikolaus-Turnier ohne Klaerung -> ok" "ok" "$(fin_niko olli "$t")"

  # --- A (a) Klaerungsliste haelt den Abschluss auf --------------------------------------------------------------
  t="$(hc_ready)"
  m="$(semi2 "$t")"
  e="$(review_add "$t" "$m" "a1-$t")"
  check A "A1 @LZ-010 Z. 4 offener Eintrag „Tor Heim, von Tom“ zum Halbfinale 2: Abschluss-Liste zeigt genau einen Punkt review_open" "review_open|" \
    "$(q "SELECT lc.preflight('olli', '$t');")"
  check A "A1 der Punkt fuehrt zum Eintrag in der Klaerungsliste: Kennung des Eintrags, Spiel, Spielnummer, Feld" "t" \
    "$(q "SELECT (harness.last() -> 'items' -> 0) = jsonb_build_object('kind', 'review_open', 'eventId', '$e', 'matchId', '$m',
                   'matchNumber', (SELECT match_number FROM public.matches WHERE id = '$m'), 'field', (SELECT field FROM public.matches WHERE id = '$m'));")"
  check A "A1 @LZ-008 solange der Eintrag offen ist: kein Vorschlag zum Abschluss (canFinish false)" "false" \
    "$(q "SELECT lc.preflight('olli', '$t'); SELECT harness.last() ->> 'canFinish';" | tail -1)"
  check A "A1 @LZ-010 Olli waehlt „Turnier abschliessen“ -> abgelehnt mit dem offenen Punkt, Turnier bleibt „Laeuft“, kein Endstand" \
    "rejected:OPEN_ITEMS|review_open|running|0" "$(fin_hc olli "$t")|$(items_kinds)|$(life "$t")|$(fs_rows "$t")"
  check A "A1 Maria (Co-Admin) sieht denselben Punkt" "review_open|" "$(q "SELECT lc.preflight('maria', '$t');")"
  check A "A1 Gegenprobe: Olli verwirft den Eintrag (REVIEW_DISCARD) -> der Punkt zur Klaerung ist weg" "accepted|0" \
    "$(decide olli "$m" "$e" REVIEW_DISCARD)|$(q "SELECT lc.preflight('olli', '$t');" | grep -c review_open)"

  t="$(hc_ready)"
  q "UPDATE public.matches SET match_status = 'running', decided_by = NULL, forfeit_absent = NULL, score_a = 0, score_b = 0
      WHERE id = lc.final('$t', 'thirdPlace');" >/dev/null
  review_add "$t" "$(semi2 "$t")" "a2a-$t" >/dev/null
  review_add "$t" "$(final_of "$t")" "a2b-$t" >/dev/null
  check A "A2 @LZ-012 Spiel um Platz 3 laeuft und 2 Klaerungen offen -> die Liste zeigt 3 Eintraege, Turnier bleibt „Laeuft“" \
    "rejected:OPEN_ITEMS|match_running,review_open,review_open|running" "$(fin_hc olli "$t")|$(items_kinds)|$(life "$t")"

  # V1/S2: Luecke zwischen Liste und Abschluss -- die App hat geprueft (nichts offen), dann kommt ein Klaerungseintrag
  t="$(hc_ready)"
  check A "A3 V1 Olli prueft: nichts offen (die App wuerde jetzt bestaetigen lassen)" "|true" \
    "$(q "SELECT lc.preflight('olli', '$t');")$(q "SELECT harness.last() ->> 'canFinish';")"
  s="$(q "SELECT (harness.last() -> 'state')::text;")"
  review_add "$t" "$(semi2 "$t")" "a3-$t" >/dev/null
  check A "A3 V1 danach landet ein Helfer-Eintrag in der Klaerung; der Spielstand bleibt gleich (STALE_STATE faengt das nicht)" "t" \
    "$(q "SELECT match_engine.tournament_state('$t') = \$J\$$s\$J\$::jsonb;")"
  check A "A3 V1 Abschluss mit dem eben geprueften Stand -> abgelehnt OPEN_ITEMS (review_open), kein Endstand, „Laeuft“" \
    "rejected:OPEN_ITEMS|review_open|0|running" \
    "$(q "SELECT lc.finish('olli', '$t', lc.snap('$t', '$R_HC', '$P_HC', 'hc'), gen_random_uuid(), \$J\$$s\$J\$::jsonb);")|$(items_kinds)|$(fs_rows "$t")|$(life "$t")"

  # Gegenbeispiele: entschieden (verwerfen, uebernehmen), Hinweis, anderes Turnier. Nikolaus-Turnier: seine Ergebnisse
  # kamen ueber append_match_events, eine Entscheidung dort laesst den Spielstand stehen.
  t="$(niko_ready)"
  t2="$(niko_ready)"
  m="$(gm "$t" 'DJK Kammer' 'TSV Waging rot')"
  e1="$(review_add "$t" "$m" "a4-verwerfen-$t")"
  review_add "$t" "$(gm "$t" 'TSV Petting' 'DJK Otting')" "a4-hinweis-$t" notice >/dev/null
  review_add "$t2" "$(gm "$t2" 'DJK Kammer' 'TSV Waging rot')" "a4-fremd-$t2" >/dev/null
  s="$(q "SELECT match_engine.tournament_state('$t')::text;")"
  out="$(decide olli "$m" "$e1" REVIEW_DISCARD)"
  check A "A4 Olli verwirft den Eintrag (Turnierleitung, Schreibweg) -> angenommen, Spielstand unveraendert" "accepted|t" \
    "$out|$(q "SELECT match_engine.tournament_state('$t') = \$J\$$s\$J\$::jsonb;")"
  check A "A4 Gegenbeispiel: ein verworfener Eintrag, ein Hinweis (kind notice) und ein offener Eintrag eines ANDEREN Turniers halten nicht auf" \
    "|true" "$(q "SELECT lc.preflight('olli', '$t');")$(q "SELECT harness.last() ->> 'canFinish';")"
  check A "A4 Gegenbeispiel: Abschluss gelingt; das andere Turnier bleibt mit seinem offenen Eintrag aufgehalten" \
    "ok|rejected:OPEN_ITEMS|review_open" "$(fin_niko olli "$t")|$(fin_niko olli "$t2")|$(items_kinds)"
  t="$(niko_ready)"
  m="$(gm "$t" 'DJK Kammer' 'TSV Waging rot')"
  e2="$(review_add "$t" "$m" "a4-uebernehmen-$t")"
  check A "A4b ein uebernommener Eintrag (gespeicherte Entscheidung REVIEW_ACCEPT) steht nicht mehr als offene Klaerung in der Liste" "1|0" \
    "$(q "SELECT lc.preflight('olli', '$t');" | grep -c review_open)|$(decide_row "$m" "$e2" REVIEW_ACCEPT NULL; q "SELECT lc.preflight('olli', '$t');" | grep -c review_open)"

  t="$(hc_ready)"
  m="$(semi2 "$t")"
  e="$(review_add "$t" "$m" "a5-$t")"
  decide_row "$m" "$e" REVIEW_DISCARD "'pending'"
  check A "A5 eine Entscheidung, die selbst noch in der Klaerung liegt (review_state pending), entscheidet nicht -> weiter offen" \
    "rejected:OPEN_ITEMS|review_open" "$(fin_hc olli "$t")|$(items_kinds)"

  # --- K (b) Kindermodus im oeffentlichen Endstand ----------------------------------------------------------------
  t="$(niko_ready)"
  q "UPDATE public.tournaments SET config = config || '{\"hideScoresForPublic\": true, \"publicScorers\": true}'::jsonb WHERE id = '$t';" >/dev/null
  make_public "$t"
  code="$(code_of "$t")"
  check K "K0 Bambini-Fall (Kindermodus an, Torschuetzen-Schalter an) abschliessen -> ok, Endstand gespeichert" "ok|1" \
    "$(fin_niko olli "$t")|$(fs_rows "$t")"
  check K "K1 @ZM-121 Z. 4 Zuschauer (Teilen-Code) erhalten keinen Endstand: genau {status: none}, keine Plaetze, keine Torschuetzen" \
    '{"status": "none"}' "$(anon_json "SELECT public.public_final_standings('$code')::text")"
  check K "K2 @ZM-121 Z. 4 Monitor ohne Anmeldung und Hallen-Monitor (readDisplay) erhalten keinen Endstand" "none|none|f|f" \
    "$(anon_json "SELECT public.display_final_standings('$t') ->> 'status'")|$(as_val bildschirm "SELECT public.display_final_standings('$t') ->> 'status'")|$(anon_json "SELECT (public.display_final_standings('$t') ? 'standings')::text" | cut -c1)|$(as_val bildschirm "SELECT (public.display_final_standings('$t') ? 'standings')::text" | cut -c1)"
  t2="$(niko_ready)"
  q "UPDATE public.tournaments SET config = config || '{\"publicScorers\": true}'::jsonb WHERE id = '$t2';" >/dev/null
  make_public "$t2"
  fin_niko olli "$t2" >/dev/null
  check K "K3 Gegenbeispiel ohne Kindermodus: Zuschauer und Monitor erhalten den Endstand (6 Plaetze) mit Torschuetzen (Schalter an)" \
    "final|6|true|final" \
    "$(anon_json "SELECT public.public_final_standings('$(code_of "$t2")') ->> 'status'")|$(anon_json "SELECT jsonb_array_length(public.public_final_standings('$(code_of "$t2")') -> 'standings' -> 'ranking')::text")|$(anon_json "SELECT (public.public_final_standings('$(code_of "$t2")') -> 'standings' ? 'scorers')::text")|$(as_val bildschirm "SELECT public.display_final_standings('$t2') ->> 'status'")"
  t2="$(niko_ready)"
  q "UPDATE public.tournaments SET config = config || '{\"hideScoresForPublic\": \"true\"}'::jsonb WHERE id = '$t2';" >/dev/null
  make_public "$t2"
  fin_niko olli "$t2" >/dev/null
  check K "K4 Gegenbeispiel: Schalter als Text \"true\" ist kein Kindermodus (gleiche Lesart wie public_payload) -> final" "final|false" \
    "$(anon_json "SELECT public.public_final_standings('$(code_of "$t2")') ->> 'status'")|$(q "SELECT public_view.switches(config) ->> 'kidsMode' FROM public.tournaments WHERE id = '$t2';")"

  # --- L (c) list_late_entries -----------------------------------------------------------------------------------
  t="$(niko_ready)"
  q "INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) SELECT '$t', harness.p('kai'), 'collaborator', now(), 'Kai' WHERE NOT EXISTS (SELECT 1 FROM public.tournament_collaborators WHERE tournament_id = '$t' AND user_id = harness.p('kai'));
     INSERT INTO public.tournament_join_codes (code, tournament_id, created_by)
     VALUES (translate(upper(substr(md5('$t'), 1, 10)), '01', 'GH'), '$t', harness.p('olli'));
     INSERT INTO public.tournament_join_requests (tournament_id, code, device_user_id, display_name, device_label, check_number, status, decided_at, decided_by)
     VALUES ('$t', translate(upper(substr(md5('$t'), 1, 10)), '01', 'GH'), harness.p('tom'), 'Tom', 'Handy Feld 1', 42, 'accepted', now(), harness.p('olli'));" >/dev/null
  fin_niko olli "$t" >/dev/null
  fa="$(q "SELECT (extract(epoch FROM finished_at) * 1000)::bigint FROM public.tournaments WHERE id = '$t';")"
  m="$(gm "$t" 'DJK Kammer' 'TSV Waging rot')"
  d="$(q "SELECT md5('wm-tom-handy-$t')::uuid;")"
  check L "L0 @LZ-039 Toms Handy (18:10, nach dem Abschluss) und Kai senden je ein Tor -> beide „nach dem Ende eingetroffen“" \
    "review:AFTER_FINISH|review:AFTER_FINISH" \
    "$(q "SELECT lc.append('tom', '$m', jsonb_build_array(lc.ev('GOAL', 'wm-l-tom-$t', jsonb_build_object('at', $fa + 600000, 'clockMs', 140000, 'teamId', harness.team('$t', 'DJK Kammer')))), '$d');")|$(q "SELECT lc.append('kai', '$m', jsonb_build_array(lc.ev('GOAL', 'wm-l-kai-$t', jsonb_build_object('at', $fa + 660000, 'clockMs', 150000, 'teamId', harness.team('$t', 'TSV Waging rot')))));")"
  tl="$(late_list olli "$t")"
  check L "L1 @LZ-039 Olli sieht beide Eintraege mit Namen: Tom (Geraet „Handy Feld 1“), dann Kai; Spiel, Spielnummer, Tor, Geraetezeit" \
    "2|Tom|Handy Feld 1|Kai|null|$m|$(q "SELECT match_number FROM public.matches WHERE id = '$m';")|GOAL|$((fa + 600000))|$(q "SELECT harness.u('lc-event:wm-l-tom-$t');")" \
    "$(jq -r '[length, .[0].author, .[0].deviceLabel, .[1].author, (.[1].deviceLabel | tostring), .[0].matchId, (.[0].matchNumber | tostring), .[0].entry.type, (.[0].entry.deviceAt | tostring), .[0].eventId] | map(tostring) | join("|")' <<<"$tl" 2>/dev/null || echo "kein-json:$tl")"
  check L "L2 @LZ-039 Maria (Co-Admin) sieht dieselben zwei Eintraege" "$tl" "$(late_list maria "$t")"
  check L "L3 alle anderen sehen nichts: Tom (Helfer-Geraet), Kai (Helfer), Hallen-Monitor, Fremder -> []; ohne Anmeldung 42501" \
    "0|0|0|0|error:42501" \
    "$(jlen "$(late_list tom "$t")")|$(jlen "$(late_list kai "$t")")|$(jlen "$(late_list bildschirm "$t")")|$(jlen "$(late_list fremd "$t")")|$(late_list anon "$t")"
  check L "L4 nie eine E-Mail in der Antwort" "0" "$(grep -c '@a21as.test' <<<"$tl")"
  t2="$(niko_ready)"
  fin_niko olli "$t2" >/dev/null
  q "SELECT lc.append('kai', '$(gm "$t2" 'DJK Kammer' 'TSV Waging rot')', jsonb_build_array(lc.ev('GOAL', 'wm-l-fremd-$t2', '{}'::jsonb)));" >/dev/null
  check L "L5 Gegenbeispiel: Eintraege eines anderen Turniers erscheinen nicht (hier 2, dort 1)" "2|1" \
    "$(jlen "$(late_list olli "$t")")|$(jlen "$(late_list olli "$t2")")"

  # --- S Rechte (auch in der Gegenprobe gemessen) -----------------------------------------------------------------
  check S "S1 list_late_entries: SECURITY DEFINER, search_path fest, EXECUTE nur authenticated (nicht anon, service_role, PUBLIC)" \
    "true|{\"search_path=public, pg_temp\"}|true|false|false|false" \
    "$(q "SELECT p.prosecdef || '|' || p.proconfig::text || '|' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '|'
              || has_function_privilege('anon', p.oid, 'EXECUTE') || '|' || has_function_privilege('service_role', p.oid, 'EXECUTE') || '|'
              || EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.list_late_entries(uuid)');")"
  check S "S2 finish_open_items und final_standings_payload: kein EXECUTE fuer anon und authenticated" "2" \
    "$(q "SELECT count(*) FROM pg_proc p WHERE p.oid IN (to_regprocedure('match_engine.finish_open_items(uuid)'), to_regprocedure('match_engine.final_standings_payload(public.tournaments)'))
            AND NOT has_function_privilege('anon', p.oid, 'EXECUTE') AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');")"
}

run_assertions() {
  local priv names_sql names_sh a
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  # Assertions spaeterer Migrationen (nach 20261118_004, hier erst im AFTER-Block): Namen aus der festen Zuordnung in
  # db-drift-check.sh (pending_assertions_for), wie public-payload-check.sh.
  local later="" f
  for f in ${AFTER[@]+"${AFTER[@]}"}; do
    later="$later $(awk -v n="    $(basename "$f"))" '$0 == n { getline; if ($0 ~ /echo "/) { sub(/^[^"]*"/, ""); sub(/"[^"]*$/, ""); print } }' "$REPO_ROOT/scripts/db-drift-check.sh")"
  done
  check S "Rechte-Assertion als ci_schema_reader: keine Zeile |f (ohne Assertions spaeterer Migrationen)" "" \
    "$(grep -v '|t$' <<<"$priv" | while IFS= read -r line; do [[ " $later " == *" ${line%%|*} "* ]] || echo "$line"; done || true)"
  for a in $NEW_ASSERTIONS; do
    check S "Rechte-Assertion: $a vorhanden und |t" "$a|t" "$(grep -E "^$a\|" <<<"$priv" || true)"
  done
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
  check S "Drift-Check-Zuordnung: pending_assertions_for nennt fuer $TARGET_NAME genau die neuen Namen" "$NEW_ASSERTIONS" \
    "$(awk -v n="    $TARGET_NAME)" 'index($0, n) == 1 {getline; print; exit}' "$REPO_ROOT/scripts/db-drift-check.sh" | sed -E 's/^ *echo "//; s/"$//')"
}

# ---------------------------------------------------------------------------------------------------------
start_container "$MODE"
echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
psql_stdin < "$BASELINE_FILE" >/dev/null || { echo "::error::Baseline scheitert" >&2; exit 1; }
for f in "${BEFORE[@]}"; do psql_stdin < "$f" >/dev/null || { echo "::error::Migration scheitert: $f" >&2; exit 1; }; done
setup_data

if [[ "$MODE" == "without-migration" ]]; then
  run_wm_probes
  summary
  A_DEV="$(dev_of A)"; K_DEV="$(dev_of K)"; L_DEV="$(dev_of L)"
  if [[ "$A_DEV" -gt 0 && "$K_DEV" -gt 0 && "$L_DEV" -gt 0 && "$(dev_of P)" -eq 0 ]]; then
    echo "Ohne Migration: A, K und L rot, P gruen -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (A=$A_DEV, K=$K_DEV, L=$L_DEV muessen > 0 sein, P=$(dev_of P) muss 0 sein)."
  exit 1
fi

if [[ "$MODE" == "gegenprobe" ]]; then
  MUTATIONS=(
    "M1|offene Klaerung wird nicht gemeldet (Block 5 leer)|       WHERE r.tournament_id = p_tournament_id AND r.kind = 'review'|       WHERE false AND r.tournament_id = p_tournament_id AND r.kind = 'review'"
    "M2|Entscheidung zaehlt auch, wenn sie selbst noch in der Klaerung liegt|AND d.type IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD')\n                            AND d.review_state IS NULL)|AND d.type IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD'))"
    "M3|Hinweise (kind notice) halten auf|AND r.kind = 'review'\n|AND r.kind IN ('review', 'notice')\n"
    "M4|nur Uebernehmen zaehlt als Entscheidung|AND d.type IN ('REVIEW_ACCEPT', 'REVIEW_DISCARD')\n                            AND d.review_state IS NULL)|AND d.type IN ('REVIEW_ACCEPT')\n                            AND d.review_state IS NULL)"
    "M5|Klaerungen aller Turniere statt nur dieses|       WHERE r.tournament_id = p_tournament_id AND r.kind = 'review'|       WHERE r.kind = 'review'"
    "M6|Kindermodus nicht geprueft|         OR (public_view.switches(p_tournament.config) ->> 'kidsMode')::boolean\n|"
    "M7|list_late_entries ohne Rechtepruefung|     AND public.has_tournament_permission(p_tournament_id, 'manageLifecycle');|     ;"
    "M8|list_late_entries ohne Namen|           'author', match_engine.actor_name(le.tournament_id, le.actor),|           'author', NULL,"
    "M9|list_late_entries auch fuer anon|GRANT EXECUTE ON FUNCTION public.list_late_entries(uuid) TO authenticated;|GRANT EXECUTE ON FUNCTION public.list_late_entries(uuid) TO authenticated, anon;"
    "M10|Fail-fast laesst fremde Fassung von finish_open_items durch|  IF md5(v_items) <> |  IF false AND md5(v_items) <> "
  )
  not_killed=()
  for mut in "${MUTATIONS[@]}"; do
    IFS='|' read -r mid mtext mfrom mto <<<"$mut"
    mutated="$WORK_DIR/$mid.sql"
    if ! python3 - "$TARGET_FILE" "$mutated" "$mfrom" "$mto" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
frm = sys.argv[3].replace('\\n', '\n')
to = sys.argv[4].replace('\\n', '\n')
text = open(src, encoding='utf-8').read()
if text.count(frm) != 1:
    sys.exit(f"Mutation: Stelle nicht genau einmal gefunden: {frm!r} ({text.count(frm)}x)")
open(dst, 'w', encoding='utf-8').write(text.replace(frm, to))
PY
    then
      echo "::error::Mutation $mid nicht anwendbar"; exit 1
    fi
    reset_counts
    echo "=== $mid: $mtext" >&2
    if ! apply_target "$mutated" >"$WORK_DIR/$mid.apply" 2>&1; then
      echo "ROT   $mid $mtext (Einspielen scheitert: $(head -c 160 "$WORK_DIR/$mid.apply"))"
      continue
    fi
    { run_failfast "$mutated"; run_wm_probes; } > "$WORK_DIR/$mid.log" 2>&1
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "ROT   $mid $mtext ($(total_dev) Abweichung(en): $(grep '^ABWEICHUNG' "$WORK_DIR/$mid.log" | cut -c13-28 | sed 's/ *$//' | paste -sd',' -))"
    else
      echo "GRUEN $mid $mtext -- Mutation nicht erkannt"
      not_killed+=("$mid")
    fi
  done
  if [[ ${#not_killed[@]} -eq 0 ]]; then
    echo "Gegenprobe: ${#MUTATIONS[@]} von ${#MUTATIONS[@]} Mutationen rot."
    exit 0
  fi
  echo "::error::Gegenprobe: nicht erkannt: ${not_killed[*]}"
  exit 1
fi

# --- normaler Lauf ------------------------------------------------------------------------------------------------
run_failfast "$TARGET_FILE"
q "ALTER TABLE public.match_reviews RENAME TO match_reviews_wm_probe;" >/dev/null
F_DUMP="$(schema_dump)"
F_APPLY="$(apply_target 2>&1)"
F_EXIT=$?
check F "F7 ganze Datei ohne match_reviews: Abbruch 'Voraussetzungen fehlen', list_late_entries nicht angelegt, Schema unveraendert" \
  "abbruch|1|<null>|identisch" \
  "$([[ "$F_EXIT" -ne 0 ]] && echo abbruch || echo "exit $F_EXIT")|$(grep -c 'Voraussetzungen fehlen' <<<"$F_APPLY")|$(q "SELECT coalesce(to_regprocedure('public.list_late_entries(uuid)')::text, '<null>');")|$([[ "$(schema_dump)" == "$F_DUMP" ]] && echo identisch || echo verschieden)"
q "ALTER TABLE public.match_reviews_wm_probe RENAME TO match_reviews;" >/dev/null

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
echo "Migration einspielen..." >&2
apply_target >/dev/null || { echo "::error::$TARGET_NAME scheitert" >&2; exit 1; }
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in tables columns functions triggers policies indexes rls_tables; do
  expected=0
  [[ "$dim" == "functions" ]] && expected=1
  check S "Katalogzaehlung $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
echo "md5(prosrc) nachher (Soll fuer Produktion):"
q "SELECT '    ' || p.oid::regprocedure::text || ' ' || md5(p.prosrc) FROM pg_proc p
    WHERE p.oid IN (to_regprocedure('match_engine.finish_open_items(uuid)'), to_regprocedure('match_engine.final_standings_payload(public.tournaments)'),
                    to_regprocedure('public.list_late_entries(uuid)')) ORDER BY 1;"

run_wm_probes
run_assertions

# --- W: idempotent -----------------------------------------------------------------------------------------------
STATE_SQL="SELECT (SELECT count(*) FROM public.tournament_final_standings) || '|' || (SELECT count(*) FROM public.match_reviews) || '|' || (SELECT count(*) FROM public.late_entries) || '|' || (SELECT string_agg(lifecycle_status, ',' ORDER BY id) FROM public.tournaments);"
STATE_W="$(q "$STATE_SQL")"
apply_target >/dev/null 2>&1
check W "zweites Einspielen laeuft (Exit 0)" "0" "$?"
check W "danach Daten und Schema unveraendert" "$STATE_W|identisch" "$(q "$STATE_SQL")|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg --------------------------------------------------------------------------------------------------
check X "Rueckweg-Datei im Repo = Ausgabe von --print-rueckweg" "identisch" \
  "$(diff -q <(rueckweg_sql) "$REPO_ROOT/supabase/rollbacks/20261118_004_abschluss_nachzug_rollback.sql" >/dev/null 2>&1 && echo identisch || echo verschieden)"
rueckweg_sql | psql_stdin >/dev/null 2>"$WORK_DIR/rueckweg.err"
check X "Rueckweg laeuft (Exit 0)" "0|" "$?|$(head -c 200 "$WORK_DIR/rueckweg.err")"
check X "nach dem Rueckweg: Schema public + match_engine = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$(schema_dump)" == "$DUMP_BEFORE" ]] && echo identisch || { diff <(echo "$DUMP_BEFORE") <(schema_dump) | head -20 >&2; echo verschieden; })"
check X "nach dem Rueckweg: Daten unveraendert" "$STATE_W" "$(q "$STATE_SQL")"
check X "Rueckweg ein zweites Mal -> Abbruch durch den Waechter, nichts geaendert" "1|identisch" \
  "$(rueckweg_sql | psql_value 2>&1 | grep -c 'nicht in der W-M-Fassung')|$([[ "$(schema_dump)" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
apply_target >/dev/null 2>&1
check X "danach erneut einspielbar (Exit 0, Schema = erstes Einspielen)" "0|identisch" "$?|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f" >/dev/null || { check S "spaetere Migration laeuft: $(basename "$f")" "0" "1"; continue; }
  echo "OK    spaetere Migration laeuft: $(basename "$f")" >&2
done

echo
summary
if [[ "$(total_dev)" -gt 0 ]]; then
  echo "::error::$(total_dev) Abweichung(en):$FAILED"
  exit 1
fi
echo "Alle Pruefungen ohne Abweichung."
exit 0
