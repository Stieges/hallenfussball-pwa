#!/usr/bin/env bash
#
# monitor-endstand-check.sh — Container-Beweis fuer supabase/migrations/20261118_008_monitor_endstand.sql (Review #414 🟡1/🔵2,
# Befunde C-MONITOR-ENDSTAND-OHNE-TEILEN und C-MONITOR-ENDSTAND-WIEDEROEFFNEN). Muster: scripts/abschluss-nachzug-check.sh
# (ein Wegwerf-Container, Baseline + alle Migrationen seit der Baseline, trap, --without-migration, --gegenprobe,
# --print-rueckweg) mit den Turnieren und Hilfen aus scripts/lib/tournament-lifecycle-probes.sh (Nikolaus-Turnier,
# Olli/Maria/Tom/Kai/Hallen-Monitor/Fremder, Abschluss ueber finish_tournament, Wiederoeffnen ueber reopen_tournament und
# die Betriebs-Vorlage scripts/betrieb/turnier-wieder-oeffnen.sql).
#
# Testwerte aus dem Gherkin: @ZM-121 Z. 1 (Hallenmonitor Eingang zeigt nach dem Abschluss die Folie „Endstand“ mit Platz und
# Teamname), Z. 2 (nach dem Wiederoeffnen ueber den Betreiber, Notweg @LZ-091, „den Endstand von vor dem Wiederoeffnen
# unveraendert, bis Olli neu abschliesst“), Z. 4 (Kindermodus: kein Platz); @LZ-076 (Monitor nach dem Abschluss wie die
# Zuschaueransicht), @ZM-101 (ein eingerichteter Monitor zeigt ohne Online-Teilen weiter), @ZM-012 Z. 2 (Torschuetzen nur
# mit Schalter), @LZ-075 (vor dem Abschluss kein Endstand).
#
# Kategorien:
#   P  Positiv-Kontrolle: bisherige Wege unveraendert (public_final_standings, display_final_standings(uuid) mit is_public).
#   F  Fail-fast (Block 0 der Datei unter Test, zurueckgerollt; plus ganze Datei): ohne display_tournament, ohne Kindermodus im
#      Endstand (final_standings_payload aus 20261113_003), fremde Fassung von public_final_standings -> Abbruch ohne Aenderung.
#   A  (A) Monitor-Link ohne Teilen: final fuer jeden Aufrufer mit tournament_id + monitor_id; Gegenbeispiele wie
#      display_tournament (fremde/leere/zu lange Kennung, Monitor eines anderen Turniers, geloescht, oeffentlich aber fremde
#      Kennung), vor dem Abschluss none, Teilen zurueckgenommen weiter final.
#   K  nichts preisgeben, was der Monitor-Link nicht schon sieht: Kindermodus none, Torschuetzen nur mit Schalter (wie
#      display_tournament), gleiche Antwort wie die Zuschaueransicht.
#   B  (B) Wiederoeffnen: Monitor-Link UND Zuschauer-Endstand (@LZ-077 Z. 2, Entscheidung 30.10.) liefern dieselbe Antwort wie
#      vor dem Wiederoeffnen (Betriebs-Vorlage Block 1 woertlich und reopen_tournament), bis neu abgeschlossen; Kindermodus
#      danach none; Teilen zurueckgenommen -> Zuschauer none; der alte Monitor-Weg display_final_standings(uuid) bleibt none.
#   C  Abbruch (MVP+): 'cancelled' mit gespeichertem Stand -> none (kein Teil-Endstand; nur Dokumentation des Ist-Stands).
#   S  Rechte und Katalog: DEFINER/search_path/EXECUTE anon+authenticated, nicht PUBLIC; +1 Funktion, nichts sonst; die
#      bisherigen Funktionen wortgleich; Rechte-Assertion als ci_schema_reader, Namensliste, Drift-Check-Zuordnung.
#   W  zweites Einspielen (idempotent).   X  Rueckweg -> Schema = vorher; Waechter stoppt den zweiten Rueckweg.
#
# Aufrufoptionen:
#   bash scripts/monitor-endstand-check.sh                      normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/monitor-endstand-check.sh --without-migration  Gegenprobe: ohne die Migration muessen A und B rot sein, P gruen
#   bash scripts/monitor-endstand-check.sh --gegenprobe         je Lauf eine Mutation der Migration (M1-M12); Exit 0 NUR, wenn
#                                                               JEDE Mutation mindestens eine Pruefung rot faerbt
#   bash scripts/monitor-endstand-check.sh --print-rueckweg     gibt den Rueckweg aus, ohne Container
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
TARGET_NAME="20261118_008_monitor_endstand.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
ROLLBACK_FILE="$REPO_ROOT/supabase/rollbacks/20261118_008_monitor_endstand_rollback.sql"
LIFECYCLE_FILE="$MIGRATIONS_DIR/20261113_003_tournament_lifecycle.sql"
FIX_DIR="$REPO_ROOT/src/core/standings/__fixtures__"
CONTAINER_PREFIX="monitor-endstand-check-$$"
CURRENT_CONTAINER=""
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/monitor-endstand-check.XXXXXX")"
NEW_ASSERTIONS="monitor-endstand-display-link monitor-endstand-public-reopen"
MON="mon-eingang"   # „Hallenmonitor Eingang“ (@ZM-121)

# Funktionstext woertlich aus 20261113_003 (Rueckweg und Fail-fast-Probe)
fn_003_sql() { awk -v head="CREATE OR REPLACE FUNCTION $1(" 'index($0, head) == 1 {f=1} f{print} f && $0=="$$;"{exit}' "$LIFECYCLE_FILE"; }

# Rueckweg (Anhang der Freigabe): public_final_standings woertlich aus 20261113_003, die neue Fassung
# display_final_standings(uuid, text) weg. EIN Block, Waechter: nur, wenn genau diese Fassungen (Kennzeichen) da sind.
rueckweg_sql() {
  cat <<'SQL'
-- supabase/rollbacks/20261118_008_monitor_endstand_rollback.sql
-- RUECKWEG zu supabase/migrations/20261118_008_monitor_endstand.sql. Liegt bewusst NICHT in supabase/migrations (wird nie
-- nachgespielt). Erzeugt mit `bash scripts/monitor-endstand-check.sh --print-rueckweg`; belegt in
-- scripts/monitor-endstand-check.sh (Kategorie X: Schema danach = Stand vor der Migration).
-- Reihenfolge: ZUERST die App auf den Stand ohne diesen Client-Teil (sie ruft dann wieder display_final_standings(uuid)),
-- DANN dieser Block. Danach zeigt ein Monitor ohne Online-Teilen nach dem Abschluss keinen Endstand, und nach dem
-- Wiederoeffnen fallen Monitor und Zuschauer-Seite in die laufende Ansicht zurueck (Befunde C-MONITOR-ENDSTAND-OHNE-TEILEN,
-- C-MONITOR-ENDSTAND-WIEDEROEFFNEN, @LZ-077 Z. 2 wieder offen). Keine Daten gehen verloren.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF to_regprocedure('public.display_final_standings(uuid,text)') IS NULL
     OR position('20261118_008' IN coalesce(obj_description(to_regprocedure('public.display_final_standings(uuid,text)'), 'pg_proc'), '')) = 0
     OR position('20261118_008 (B)' IN coalesce((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.public_final_standings(text)')), '')) = 0 THEN
    RAISE EXCEPTION 'Rueckweg 20261118_008: Monitor-Endstand nicht in der Fassung 20261118_008 -- nichts geaendert';
  END IF;
END
$rw$;
-- public_final_standings woertlich aus 20261113_003_tournament_lifecycle.sql
SQL
  fn_003_sql public.public_final_standings
  cat <<'SQL'
REVOKE ALL ON FUNCTION public.public_final_standings(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_final_standings(text) TO anon, authenticated;
DROP FUNCTION public.display_final_standings(uuid, text);
COMMIT;
-- Danach: Assertion monitor-endstand-display-link + PRIVILEGE_ASSERTION_NAMES + pending_assertions_for zurueck, Drift-Check.
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
  docker run -d --rm ${DOCKER_PLATFORM:+--platform "$DOCKER_PLATFORM"} --name "$CURRENT_CONTAINER" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
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

CATS=(P F A K B C S W X)
DEVS=(0 0 0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0 0 0)
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
reset_counts() { DEVS=(0 0 0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0 0 0); FAILED=""; }
summary() {
  local i line=""
  for i in "${!CATS[@]}"; do line="$line ${CATS[$i]} ${OKS[$i]}/$((OKS[i] + DEVS[i]))"; done
  echo "Zusammenfassung (OK/gesamt):$line -- Abweichungen: $(total_dev)"
}

# Turniere, Personen und Hilfen (setup_data, niko_ready, fin_niko, make_public, code_of, as_val, anon_val, life ...) wie im
# A-21a-Beweis.
source "$REPO_ROOT/scripts/lib/tournament-lifecycle-probes.sh"

# ---------------------------------------------------------------------------------------------------------
# Hilfen dieses Beweises
# ---------------------------------------------------------------------------------------------------------
# Monitor in config.monitors eintragen (vor dem Abschluss -- danach sperrt der Server config bis auf publicScorers)
add_monitor() { # add_monitor <Turnier> <Kennung> [Name]
  q "UPDATE public.tournaments SET config = coalesce(config, '{}'::jsonb) || jsonb_build_object('monitors',
       coalesce(config -> 'monitors', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', '$2', 'name', '${3:-Hallenmonitor Eingang}',
         'slides', jsonb_build_array(jsonb_build_object('id', 's1', 'type', 'final-standings', 'config', '{}'::jsonb)))))
      WHERE id = '$1';" >/dev/null
}
set_config_on() { q "UPDATE public.tournaments SET config = config || '$2'::jsonb WHERE id = '$1';" >/dev/null; }
# Endstand ueber den Monitor-Link: anon (ohne Anmeldung) bzw. als Person -> JSON-Text oder error:SQLSTATE
mon() { anon_val "SELECT public.display_final_standings('$1'::uuid, \$m\$$2\$m\$)::text"; }
mon_as() { as_val "$1" "SELECT public.display_final_standings('$2'::uuid, \$m\$$3\$m\$)::text"; }
jstatus() { jq -r '.status // "kein-status"' <<<"$1" 2>/dev/null || echo "kein-json:$(head -c 40 <<<"$1")"; }
jnames() { jq -r '[.standings.ranking[].teamName] | join(",")' <<<"$1" 2>/dev/null || echo "kein-json:$(head -c 40 <<<"$1")"; }
jhas_scorers() { jq -r '(.standings // {}) | has("scorers")' <<<"$1" 2>/dev/null || echo "kein-json"; }
dt_state() { anon_val "SELECT public.display_tournament('$1'::uuid, \$m\$$2\$m\$) ->> 'state'"; }
dt_has_scorers() { anon_val "SELECT (public.display_tournament('$1'::uuid, \$m\$$2\$m\$) ? 'scorers')::text"; }
fin_at_ms() { q "SELECT finished_at FROM public.tournaments WHERE id = '$1';"; }
jeq() { # jeq <json1> <json2> -> gleich|verschieden (jsonb-Vergleich)
  q "SELECT CASE WHEN \$a\$$1\$a\$::jsonb = \$b\$$2\$b\$::jsonb THEN 'gleich' ELSE 'verschieden' END;" 2>/dev/null | head -1
}
reopen_by_operator() { # Block 1 der Betriebs-Vorlage woertlich (Platzhalter ersetzt), wie tournament-lifecycle-probes.sh
  local s
  s="$(awk '/^-- ##### BLOCK 1/{f=1} /^-- ##### BLOCK 2/{exit} f' "$REPO_ROOT/scripts/betrieb/turnier-wieder-oeffnen.sql" \
         | sed -e "s/<turnier-id>/$1/g" -e "s/<grund>/versehentlich abgeschlossen/g")"
  q "$s" | grep -c 'ERROR'
}
# Niko-Turnier mit Monitor, nicht geteilt (is_public false), optional mit Schaltern, abgeschlossen
niko_fin_with_monitor() { # niko_fin_with_monitor [config-json] [oeffentlich] -> Turnier-Kennung (geteilt nur VOR dem Abschluss moeglich)
  local t
  t="$(niko_ready)"
  add_monitor "$t" "$MON"
  [[ -n "${1:-}" ]] && set_config_on "$t" "$1"
  [[ -n "${2:-}" ]] && make_public "$t"
  [[ "$(fin_niko olli "$t")" == "ok" ]] || { echo "::error::Vorbereitung: Abschluss gescheitert ($t)" >&2; exit 1; }
  echo "$t"
}

# ---------------------------------------------------------------------------------------------------------
# F: Fail-fast (Block 0 der Datei unter Test, zurueckgerollt)
# ---------------------------------------------------------------------------------------------------------
run_failfast() { # run_failfast <Datei>
  local file="$1" ff
  ff="$(awk '/^-- 0\. Voraussetzungen/{f=1} /^-- 1\. Endstand/{exit} f' "$file")"
  check F "F1 ohne display_tournament (20261117_104 fehlt) -> Abbruch 'Voraussetzungen fehlen'" "1" \
    "$(q "BEGIN; DROP FUNCTION public.display_tournament(uuid, text, bigint);
$ff
ROLLBACK;" | grep -c 'Voraussetzungen fehlen')"
  check F "F2 final_standings_payload ohne Kindermodus (Fassung 20261113_003, 20261118_004 fehlt) -> Abbruch 'ohne Kindermodus'" "1" \
    "$(q "BEGIN; $(fn_003_sql match_engine.final_standings_payload)
$ff
ROLLBACK;" | grep -c 'ohne Kindermodus')"
  check F "F4 fremde Fassung von public_final_standings (ein Leerzeichen anders) -> Abbruch 'unbekannte Fassung'" "1" \
    "$(q "BEGIN; $(fn_003_sql public.public_final_standings | sed 's/^  RETURN match_engine.final_standings_payload(v_t);/  RETURN  match_engine.final_standings_payload(v_t);/')
$ff
ROLLBACK;" | grep -c 'public_final_standings hat eine unbekannte Fassung')"
}

# ---------------------------------------------------------------------------------------------------------
# P, A, K, B, C: Proben (Erwartungen aus dem Gherkin, nie aus dem Code abgelesen)
# ---------------------------------------------------------------------------------------------------------
run_probes() {
  local t t2 t3 code out before after fa

  # --- P Positiv-Kontrolle: bisherige Wege unveraendert ----------------------------------------------------------
  t="$(niko_fin_with_monitor '' oeffentlich)"
  code="$(code_of "$t")"
  check P "P1 @LZ-074 oeffentliches Turnier: Zuschauer (Teilen-Code) und bisheriger Monitor-Weg display_final_standings(uuid) -> final" \
    "final|final" \
    "$(anon_val "SELECT public.public_final_standings('$code') ->> 'status'")|$(anon_val "SELECT public.display_final_standings('$t'::uuid) ->> 'status'")"

  # --- A (A) Monitor-Link ohne Teilen -----------------------------------------------------------------------------
  t="$(niko_fin_with_monitor)"
  out="$(mon "$t" "$MON")"
  check A "A1 @ZM-121 Z. 1 @LZ-076 nicht geteilt, Hallenmonitor Eingang ohne Anmeldung: Endstand mit 6 Plaetzen in gespeicherter Reihenfolge" \
    "final|$R_NIKO" "$(jstatus "$out")|$(jnames "$out")"
  check A "A1 finishedAt = Zeitpunkt des Abschlusses" "gleich" \
    "$(q "SELECT CASE WHEN (\$j\$$out\$j\$::jsonb ->> 'finishedAt')::timestamptz = finished_at THEN 'gleich' ELSE 'verschieden' END FROM public.tournaments WHERE id = '$t';")"
  check A "A1 Gegenprobe Ist-Zustand: der bisherige Weg ohne Kennung (anon, nicht geteilt) liefert weiter none" "none" \
    "$(anon_val "SELECT public.display_final_standings('$t'::uuid) ->> 'status'")"
  check A "A2 der Link haengt nicht an einer Anmeldung: Fremder, Helfer Tom, Olli -> dieselbe Antwort wie ohne Anmeldung" \
    "gleich|gleich|gleich" \
    "$(jeq "$(mon_as fremd "$t" "$MON")" "$out")|$(jeq "$(mon_as tom "$t" "$MON")" "$out")|$(jeq "$(mon_as olli "$t" "$MON")" "$out")"
  check A "A3 Gegenbeispiele wie display_tournament: fremde Kennung, leere Kennung, 101 Zeichen, Gross-/Kleinschreibung -> none" \
    "none|none|none|none" \
    "$(jstatus "$(mon "$t" mon-fremd)")|$(jstatus "$(mon "$t" '')")|$(jstatus "$(mon "$t" "$(printf 'm%.0s' $(seq 1 101))")")|$(jstatus "$(mon "$t" MON-EINGANG)")"
  check A "A3 display_tournament antwortet in genau diesen Faellen not_found, mit der richtigen Kennung full" \
    "not_found|not_found|not_found|full" \
    "$(dt_state "$t" mon-fremd)|$(dt_state "$t" '')|$(dt_state "$t" MON-EINGANG)|$(dt_state "$t" "$MON")"
  check A "A3 Kennung NULL -> none" "none" "$(anon_val "SELECT public.display_final_standings('$t'::uuid, NULL::text) ->> 'status'")"
  t2="$(niko_ready)"
  add_monitor "$t2" mon-feld1 "Hallenmonitor Feld 1"
  check A "A4 Monitor eines ANDEREN Turniers (mon-feld1 gehoert zum Wintercup) -> none" "none" "$(jstatus "$(mon "$t" mon-feld1)")"
  check A "A5 @LZ-075 vor dem Abschluss (Monitor eingerichtet, alles entschieden) -> none, kein vorlaeufiger Endstand" "none" \
    "$(jstatus "$(mon "$t2" mon-feld1)")"
  t3="$(niko_fin_with_monitor '' oeffentlich)"
  check A "A6 oeffentlich, aber fremde Kennung -> none (Teilen ersetzt die Kennung nicht)" "none" "$(jstatus "$(mon "$t3" mon-fremd)")"
  q "UPDATE public.tournaments SET is_public = false WHERE id = '$t3';" >/dev/null
  check A "A7 @ZM-101 Teilen nach dem Abschluss zurueckgenommen: Monitor zeigt weiter den Endstand" "final" "$(jstatus "$(mon "$t3" "$MON")")"
  q "BEGIN; SET LOCAL app.lifecycle_write = 'on'; UPDATE public.tournaments SET deleted_at = now() WHERE id = '$t3'; COMMIT;" >/dev/null
  check A "A8 geloeschtes Turnier -> none (wie display_tournament not_found)" "none|not_found" \
    "$(jstatus "$(mon "$t3" "$MON")")|$(dt_state "$t3" "$MON")"

  # --- K nichts preisgeben, was der Link nicht schon sieht -------------------------------------------------------
  t="$(niko_fin_with_monitor '{"hideScoresForPublic": true, "publicScorers": true}')"
  check K "K1 @ZM-121 Z. 4 Kindermodus (Torschuetzen-Schalter an): genau {status: none}, kein Platz" '{"status": "none"}' "$(mon "$t" "$MON")"
  t="$(niko_fin_with_monitor)"
  out="$(mon "$t" "$MON")"
  check K "K2 @ZM-012 Z. 2 Schalter aus: keine Torschuetzenliste -- display_tournament liefert ebenfalls keine" "false|false" \
    "$(jhas_scorers "$out")|$(dt_has_scorers "$t" "$MON")"
  t="$(niko_fin_with_monitor '{"publicScorers": true}' oeffentlich)"
  out="$(mon "$t" "$MON")"
  check K "K3 @ZM-011 Schalter an: Torschuetzenliste (2 Zeilen) -- display_tournament liefert ebenfalls Torschuetzen" "true|2|true" \
    "$(jhas_scorers "$out")|$(jq -r '.standings.scorers | length' <<<"$out" 2>/dev/null)|$(dt_has_scorers "$t" "$MON")"
  check K "K4 @LZ-076 dieselbe Antwort wie die Zuschaueransicht (oeffentlich, Schalter an)" "gleich" \
    "$(jeq "$out" "$(anon_val "SELECT public.public_final_standings('$(code_of "$t")')::text")")"
  check K "K5 keine internen Angaben: oberste Schluessel nur status, finishedAt, standings" "finishedAt,standings,status" \
    "$(jq -r 'keys | join(",")' <<<"$out" 2>/dev/null)"

  # --- B (B) Wiederoeffnen ueber den Betreiber (@LZ-091) ---------------------------------------------------------
  t="$(niko_fin_with_monitor '{"publicScorers": true}' oeffentlich)"
  code="$(code_of "$t")"
  before="$(mon "$t" "$MON")"
  pub_before="$(anon_val "SELECT public.public_final_standings('$code')::text")"
  fa="$(fin_at_ms "$t")"
  check B "B0 vor dem Wiederoeffnen: Monitor und Zuschauer final" "final|final" "$(jstatus "$before")|$(jstatus "$pub_before")"
  check B "B1 @LZ-091 Betriebs-Vorlage Block 1 laeuft, Turnier laeuft wieder, der gespeicherte Endstand ist noch da" "0|running|1" \
    "$(reopen_by_operator "$t")|$(life "$t")|$(q "SELECT count(*) FROM public.tournament_final_standings WHERE tournament_id = '$t';")"
  after="$(mon "$t" "$MON")"
  check B "B2 @ZM-121 Z. 2 Hallenmonitor Eingang zeigt den Endstand von vor dem Wiederoeffnen UNVERAENDERT (gleiche Antwort)" "gleich" \
    "$(jeq "$after" "$before")"
  check B "B2 auch nach 2 weiteren Abrufen und fuer einen angemeldeten Aufrufer gleich" "gleich|gleich" \
    "$(mon "$t" "$MON" >/dev/null; jeq "$(mon "$t" "$MON")" "$before")|$(jeq "$(mon_as kai "$t" "$MON")" "$before")"
  check B "B3 @LZ-077 Z. 2 Zuschauer (Teilen-Code) sehen den bisherigen Endstand unveraendert (gleiche Antwort wie vorher)" "gleich" \
    "$(jeq "$(anon_val "SELECT public.public_final_standings('$code')::text")" "$pub_before")"
  check B "B3 Zuschauer-Antwort = Monitor-Antwort nach dem Wiederoeffnen; der alte Monitor-Weg display_final_standings(uuid) bleibt none" \
    "gleich|none" \
    "$(jeq "$(anon_val "SELECT public.public_final_standings('$code')::text")" "$after")|$(anon_val "SELECT public.display_final_standings('$t'::uuid) ->> 'status'")"
  check B "B4 @LZ-091 Olli schliesst erneut ab -> neuer Endstand mit neuem Zeitpunkt, Monitor zeigt ihn" "ok|final|neu" \
    "$(fin_niko olli "$t")|$(jstatus "$(mon "$t" "$MON")")|$(q "SELECT CASE WHEN finished_at > '$fa'::timestamptz AND (\$j\$$(mon "$t" "$MON")\$j\$::jsonb ->> 'finishedAt')::timestamptz = finished_at THEN 'neu' ELSE 'alt' END FROM public.tournaments WHERE id = '$t';")"
  t="$(niko_fin_with_monitor)"
  before="$(mon "$t" "$MON")"
  check B "B5 Wiederoeffnen ueber reopen_tournament (Maria, Co-Admin) -> gleiche Antwort wie vorher" "ok|gleich" \
    "$(q "SELECT lc.reopen('maria', '$t', 'versehentlich abgeschlossen', gen_random_uuid());")|$(jeq "$(mon "$t" "$MON")" "$before")"
  set_config_on "$t" '{"hideScoresForPublic": true}'
  check B "B6 nach dem Wiederoeffnen Kindermodus eingeschaltet -> none (Kindermodus ueberstimmt alles)" "none" "$(jstatus "$(mon "$t" "$MON")")"
  check B "B7 wieder geoeffnet, fremde Kennung -> none" "none" "$(jstatus "$(mon "$t" mon-fremd)")"
  t="$(niko_fin_with_monitor '' oeffentlich)"
  code="$(code_of "$t")"
  q "SELECT lc.reopen('olli', '$t', 'versehentlich abgeschlossen', gen_random_uuid());" >/dev/null
  check B "B8 Zuschauer nach dem Wiederoeffnen: final; Teilen zurueckgenommen -> none (Teilen-Pruefung unveraendert)" "final|none" \
    "$(anon_val "SELECT public.public_final_standings('$code') ->> 'status'")|$(q "UPDATE public.tournaments SET is_public = false WHERE id = '$t';" >/dev/null; anon_val "SELECT public.public_final_standings('$code') ->> 'status'")"
  t="$(niko_fin_with_monitor '{"publicScorers": true}' oeffentlich)"
  code="$(code_of "$t")"
  q "SELECT lc.reopen('olli', '$t', 'versehentlich abgeschlossen', gen_random_uuid());" >/dev/null
  set_config_on "$t" '{"hideScoresForPublic": true}'
  check B "B9 Zuschauer nach dem Wiederoeffnen mit Kindermodus -> genau {status: none}" '{"status": "none"}' \
    "$(anon_val "SELECT public.public_final_standings('$code')::text")"
  t="$(niko_ready)"
  make_public "$t"
  check B "B10 @LZ-075 nie abgeschlossen (alles entschieden, Zustand fixed) -> Zuschauer none, kein vorlaeufiger Endstand" "none" \
    "$(anon_val "SELECT public.public_final_standings('$(code_of "$t")') ->> 'status'")"

  # --- C Abbruch (MVP+, nur Ist-Stand) ---------------------------------------------------------------------------
  t="$(niko_fin_with_monitor '' oeffentlich)"
  q "BEGIN; SET LOCAL app.lifecycle_write = 'on'; UPDATE public.tournaments SET lifecycle_status = 'cancelled' WHERE id = '$t'; COMMIT;" >/dev/null
  check C "C1 'cancelled' (im MVP nicht erreichbar) mit gespeichertem Stand -> Monitor und Zuschauer none, kein Teil-Endstand" "none|none" \
    "$(jstatus "$(mon "$t" "$MON")")|$(anon_val "SELECT public.public_final_standings('$(code_of "$t")') ->> 'status'")"
  check C "C2 keine Server-Funktion setzt lifecycle_status auf 'cancelled' (Abbrechen gibt es im MVP nicht)" "0" \
    "$(q "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname IN ('public', 'match_engine') AND p.prosrc ~ 'lifecycle_status\\s*=\\s*''cancelled''';")"
}

run_rights() {
  check S "S1 display_final_standings(uuid,text): SECURITY DEFINER, search_path fest, EXECUTE anon + authenticated, nicht PUBLIC" \
    "true|{\"search_path=public, pg_temp\"}|true|true|false" \
    "$(q "SELECT p.prosecdef || '|' || p.proconfig::text || '|' || has_function_privilege('anon', p.oid, 'EXECUTE') || '|'
              || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '|'
              || EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.display_final_standings(uuid,text)');")"
  check S "S2 public_final_standings: weiter SECURITY DEFINER, search_path fest, EXECUTE anon + authenticated, nicht PUBLIC" \
    "true|{\"search_path=public, pg_temp\"}|true|true|false" \
    "$(q "SELECT p.prosecdef || '|' || p.proconfig::text || '|' || has_function_privilege('anon', p.oid, 'EXECUTE') || '|'
              || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '|'
              || EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.public_final_standings(text)');")"
}

run_assertions() {
  local priv names_sql names_sh a
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  check S "Rechte-Assertion als ci_schema_reader: keine Zeile |f" "" "$(grep -v '|t$' <<<"$priv" || true)"
  for a in $NEW_ASSERTIONS; do
    check S "Rechte-Assertion: $a vorhanden und |t" "$a|t" "$(grep -E "^$a\|" <<<"$priv" || true)"
  done
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
  check S "Drift-Check-Zuordnung: pending_assertions_for nennt fuer $TARGET_NAME genau die neuen Namen" "$NEW_ASSERTIONS" \
    "$(awk -v n="    $TARGET_NAME)" 'index($0, n) == 1 {getline; print; exit}' "$REPO_ROOT/scripts/db-drift-check.sh" | sed -E 's/^ *echo "//; s/"$//')"
}

old_md5() {
  q "SELECT string_agg(p.oid::regprocedure::text || '=' || md5(p.prosrc), ',' ORDER BY 1) FROM pg_proc p
      WHERE p.oid IN (to_regprocedure('public.display_final_standings(uuid)'),
                      to_regprocedure('match_engine.final_standings_payload(public.tournaments)'),
                      to_regprocedure('public.display_tournament(uuid,text,bigint)'));"
}

# ---------------------------------------------------------------------------------------------------------
start_container "$MODE"
echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
psql_stdin < "$BASELINE_FILE" >/dev/null || { echo "::error::Baseline scheitert" >&2; exit 1; }
for f in "${BEFORE[@]}"; do psql_stdin < "$f" >/dev/null || { echo "::error::Migration scheitert: $f" >&2; exit 1; }; done
setup_data

if [[ "$MODE" == "without-migration" ]]; then
  run_probes
  summary
  A_DEV="$(dev_of A)"; B_DEV="$(dev_of B)"
  if [[ "$A_DEV" -gt 0 && "$B_DEV" -gt 0 && "$(dev_of P)" -eq 0 ]]; then
    echo "Ohne Migration: A und B rot, P gruen -- Gegenprobe wie verlangt."
    exit 0
  fi
  echo "::error::Ohne Migration nicht wie verlangt (A=$A_DEV, B=$B_DEV muessen > 0 sein, P=$(dev_of P) muss 0 sein)."
  exit 1
fi

if [[ "$MODE" == "gegenprobe" ]]; then
  MUTATIONS=(
    "M1|Monitor-Kennung nicht geprueft (jeder Link)|                     WHERE m ->> 'id' = p_monitor_id) THEN|                     WHERE true) THEN"
    "M2|Monitor: Wiederoeffnen nicht beachtet (Zweig B fehlt)|  IF v_t.lifecycle_status = 'fixed' THEN@@2|  IF false THEN"
    "M3|Monitor: nach dem Wiederoeffnen finishedAt nicht vom gespeicherten Stand (Zeitpunkt leer)|      v_t.finished_at := v_finished_at;@@2|      v_t.finished_at := NULL;"
    "M4|Monitor: Endstand an final_standings_payload vorbei (Kindermodus/Schalter nicht beachtet)|  RETURN match_engine.final_standings_payload(v_t);@@2|  RETURN CASE WHEN v_t.lifecycle_status = 'finished' THEN jsonb_build_object('status', 'final', 'finishedAt', v_t.finished_at, 'standings', (SELECT snapshot FROM public.tournament_final_standings WHERE tournament_id = v_t.id)) ELSE jsonb_build_object('status', 'none') END;"
    "M5|oeffentlich ersetzt die Monitor-Kennung|  IF NOT FOUND\n     OR NOT EXISTS|  IF NOT FOUND\n     OR NOT coalesce(v_t.is_public, false) AND NOT EXISTS"
    "M6|kein EXECUTE fuer anon|GRANT EXECUTE ON FUNCTION public.display_final_standings(uuid, text) TO anon, authenticated;|GRANT EXECUTE ON FUNCTION public.display_final_standings(uuid, text) TO authenticated;"
    "M7|Fail-fast laesst Endstand ohne Kindermodus durch|  IF position('W-M (b)' IN|  IF false AND position('W-M (b)' IN"
    "M8|Monitor: Wiederoeffnen auch nach Abbruch ('cancelled' liefert Teil-Endstand)|  IF v_t.lifecycle_status = 'fixed' THEN@@2|  IF v_t.lifecycle_status IN ('fixed', 'cancelled') THEN"
    "M9|Zuschauer: Wiederoeffnen nicht beachtet (Zweig B fehlt)|  IF v_t.lifecycle_status = 'fixed' THEN@@1|  IF false THEN"
    "M10|Zuschauer: nach dem Wiederoeffnen finishedAt nicht vom gespeicherten Stand|      v_t.finished_at := v_finished_at;@@1|      v_t.finished_at := now();"
    "M11|Zuschauer: Teilen-Pruefung entfallen (is_public nicht beachtet)|   WHERE t.share_code = p_share_code AND coalesce(t.is_public, false) AND t.deleted_at IS NULL;|   WHERE t.share_code = p_share_code AND t.deleted_at IS NULL;"
    "M12|Fail-fast laesst fremde Fassung von public_final_standings durch|     OR (md5((SELECT prosrc|     OR false AND (md5((SELECT prosrc"
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
# „Muster@@N“: genau die N-te Stelle (die Zweige (B) stehen in beiden Funktionen gleich; 1 = Zuschauer, 2 = Monitor-Link)
nth = 0
if '@@' in frm:
    frm, nth = frm.rsplit('@@', 1)
    nth = int(nth)
    if text.count(frm) < nth:
        sys.exit(f"Mutation: Stelle {nth} nicht gefunden: {frm!r} ({text.count(frm)}x)")
    pos = -1
    for _ in range(nth):
        pos = text.index(frm, pos + 1)
    text = text[:pos] + to + text[pos + len(frm):]
elif text.count(frm) != 1:
    sys.exit(f"Mutation: Stelle nicht genau einmal gefunden: {frm!r} ({text.count(frm)}x)")
else:
    text = text.replace(frm, to)
open(dst, 'w', encoding='utf-8').write(text)
PY
    then
      echo "::error::Mutation $mid nicht anwendbar"; exit 1
    fi
    reset_counts
    echo "=== $mid: $mtext" >&2
    # Jede Mutation in einer eigenen Wegwerf-Kopie der Datenbank (Vorlage + Mutation), damit keine Mutation die naechste stoert
    q "DROP FUNCTION IF EXISTS public.display_final_standings(uuid, text);" >/dev/null
    if ! apply_target "$mutated" >"$WORK_DIR/$mid.apply" 2>&1; then
      echo "ROT   $mid $mtext (Einspielen scheitert: $(head -c 160 "$WORK_DIR/$mid.apply"))"
      continue
    fi
    { run_failfast "$mutated"; run_probes; run_rights; } > "$WORK_DIR/$mid.log" 2>&1
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "ROT   $mid $mtext ($(total_dev) Abweichung(en): $(grep '^ABWEICHUNG' "$WORK_DIR/$mid.log" | cut -c13-40 | sed 's/ *$//' | paste -sd',' -))"
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
q "ALTER FUNCTION match_engine.final_standings_payload(public.tournaments) RENAME TO final_standings_payload_probe;" >/dev/null
F_DUMP="$(schema_dump)"
F_APPLY="$(apply_target 2>&1)"
F_EXIT=$?
check F "F3 ganze Datei ohne final_standings_payload: Abbruch 'Voraussetzungen fehlen', neue Fassung nicht angelegt, Schema unveraendert" \
  "abbruch|1|<null>|identisch" \
  "$([[ "$F_EXIT" -ne 0 ]] && echo abbruch || echo "exit $F_EXIT")|$(grep -c 'Voraussetzungen fehlen' <<<"$F_APPLY")|$(q "SELECT coalesce(to_regprocedure('public.display_final_standings(uuid,text)')::text, '<null>');")|$([[ "$(schema_dump)" == "$F_DUMP" ]] && echo identisch || echo verschieden)"
q "ALTER FUNCTION match_engine.final_standings_payload_probe(public.tournaments) RENAME TO final_standings_payload;" >/dev/null

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$DUMP_BEFORE")"
MD5_BEFORE="$(old_md5)"
echo "Migration einspielen..." >&2
apply_target >/dev/null || { echo "::error::$TARGET_NAME scheitert" >&2; exit 1; }
DUMP_AFTER="$(schema_dump)"
COUNTS_AFTER="$(counts "$DUMP_AFTER")"
for dim in tables columns functions triggers policies indexes rls_tables; do
  expected=0
  [[ "$dim" == "functions" ]] && expected=1
  check S "Katalogzaehlung $dim: Zuwachs" "$expected" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
check S "bisherige Funktionen wortgleich (display_final_standings(uuid), final_standings_payload, display_tournament)" \
  "$MD5_BEFORE" "$(old_md5)"
echo "md5(prosrc) nachher (Soll fuer Produktion):"
q "SELECT '    ' || p.oid::regprocedure::text || ' ' || md5(p.prosrc) FROM pg_proc p
    WHERE p.oid IN (to_regprocedure('public.display_final_standings(uuid,text)'), to_regprocedure('public.display_final_standings(uuid)'),
                    to_regprocedure('public.public_final_standings(text)'),
                    to_regprocedure('match_engine.final_standings_payload(public.tournaments)')) ORDER BY 1;"

run_probes
run_rights
run_assertions

# --- W: idempotent -----------------------------------------------------------------------------------------------
STATE_SQL="SELECT (SELECT count(*) FROM public.tournament_final_standings) || '|' || (SELECT string_agg(lifecycle_status, ',' ORDER BY id) FROM public.tournaments);"
STATE_W="$(q "$STATE_SQL")"
apply_target >/dev/null 2>&1
check W "zweites Einspielen laeuft (Exit 0)" "0" "$?"
check W "danach Daten und Schema unveraendert" "$STATE_W|identisch" "$(q "$STATE_SQL")|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg --------------------------------------------------------------------------------------------------
check X "Rueckweg-Datei im Repo = Ausgabe von --print-rueckweg" "identisch" \
  "$(diff -q <(rueckweg_sql) "$ROLLBACK_FILE" >/dev/null 2>&1 && echo identisch || echo verschieden)"
rueckweg_sql | psql_stdin >/dev/null 2>"$WORK_DIR/rueckweg.err"
check X "Rueckweg laeuft (Exit 0)" "0|" "$?|$(head -c 200 "$WORK_DIR/rueckweg.err")"
check X "nach dem Rueckweg: Schema public + match_engine = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$(schema_dump)" == "$DUMP_BEFORE" ]] && echo identisch || { diff <(echo "$DUMP_BEFORE") <(schema_dump) | head -20 >&2; echo verschieden; })"
check X "nach dem Rueckweg: Daten unveraendert" "$STATE_W" "$(q "$STATE_SQL")"
check X "Rueckweg ein zweites Mal -> Abbruch durch den Waechter, nichts geaendert" "1|identisch" \
  "$(rueckweg_sql | psql_value 2>&1 | grep -c 'nicht in der Fassung 20261118_008')|$([[ "$(schema_dump)" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
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
