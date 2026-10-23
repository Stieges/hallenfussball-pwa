#!/usr/bin/env bash
#
# group-completion-check.sh — Container-Beweis fuer supabase/migrations/20261110_006_group_completion.sql (GA4 A-13b-S,
# task-GA4-plan-v2.md „A-13b-S“ Punkte 1-9, Anhang A, § 7 RT-*, Review „Nachreview A-13b-S“ N1-N3). Muster:
# scripts/forfeit-check.sh (Wegwerf-Container supabase/postgres, Baseline + Migrationen seit Baseline, trap).
#
# Testwerte aus dem Gherkin: „Hallencup Nord“ (@W2A-048, @TM-016/046/047; Gruppen A/B, Halbfinale 1 = Erster A gegen
# Zweiter B, Halbfinale 2 = Erster B gegen Zweiter A) und das Nikolaus-Turnier (@W2A-067, @TM-147; Jeder gegen jeden,
# Spiele group_letter 'all'). Beide Turniere sind ECHT ERZEUGT (Fixture src/core/standings/__fixtures__/group-state.json,
# publish -> mapTournamentToSupabase). Olli = Eigentuemer, Maria = Co-Admin, Tom = Helfer-Geraet (anonym, Rolle helper),
# Hallen-Monitor = Bildschirm (Rolle screen). Ergebnisse und Korrekturen laufen ueber append_match_events.
#
# Kategorien:
#   F  Migrationsprobe Fail-fast: 20261110_006 ohne 20261110_005 bricht mit „Voraussetzungen fehlen“ ab, aendert nichts.
#   S  Schema: Katalogzaehlung, Rechte (EXECUTE, Tabellen), Publication, 'all' nur in group_key, Rechte-Assertions.
#   G  Gleichlauf-Fixtures (SQL-Seite): group-key, group-state, placements-to-play-out, standing-decision-shapes,
#      shared-allowed (TS-Seite: src/core/standings/__tests__/groupCompletionTwins.test.ts).
#   P  Pflichttests P-1 ... P-11 mit Gegenbeispielen.
#   T  Mehrgeraete-Faelle RT-2, 2b, 5, 6, 9, 10, 10b, 12, 13, 14, 15, 16, 17, 18; Verklemmungs-Probe RT-2/12/15/16/17
#      je RACE_RUNS (Vorgabe 50) Wiederholungen in zwei echten Sitzungen, kein 40P01.
#   W  zweites Einspielen (idempotent): Exit 0, Schema (public + match_engine) und Daten gleich.
#   X  Rueckweg (Block aus dem Kopf der Migration): Schema = vor der Migration; danach erneut einspielbar.
#
# Aufruf:
#   bash scripts/group-completion-check.sh                  normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/group-completion-check.sh --gegenprobe     ohne Migration und je Mutation MG1-MG19, MB1, MB2 (Plan
#                                                           A-13b-S); Exit 0 NUR, wenn jede Variante ihre Pruefung rot
#                                                           faerbt (GEGENPROBE_NUR="MG3 MG14" schraenkt ein)
#   bash scripts/group-completion-check.sh --print-rueckweg gibt den Rueckweg-Block aus (ohne Container)
#   RACE_RUNS=10 bash scripts/group-completion-check.sh     weniger Wiederholungen der Verklemmungs-Probe
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack -- eigener Wegwerf-Container
# (--platform linux/amd64), wird am Ende entfernt (trap). Hilfen: scripts/lib/group-completion-harness.sql.
#
set -euo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --gegenprobe) MODE="gegenprobe" ;;
  --print-rueckweg) MODE="print-rueckweg" ;;
  *) echo "::error::Unbekannte Option: $1 (erlaubt: --gegenprobe, --print-rueckweg)" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063" # wie forfeit-check.sh
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
RACE_RUNS="${RACE_RUNS:-50}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261110_006_group_completion.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
PREREQ_NAME="20261110_005_result_entry_forfeit.sql"
HARNESS_SQL="$REPO_ROOT/scripts/lib/group-completion-harness.sql"
FIX_DIR="$REPO_ROOT/src/core/standings/__fixtures__"
CONTAINER_PREFIX="group-completion-check-$$"
CURRENT_CONTAINER=""
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/group-completion-check.XXXXXX")"

# Rueckweg = der Block im Kopf der Migration (Zeilen "--   BEGIN; ..." bis "--   COMMIT;"), ohne Kommentarzeichen.
rueckweg_sql() { awk '/^--   BEGIN; SET LOCAL lock_timeout/{f=1} f{sub(/^--   /, ""); print} f && /^COMMIT;$/{exit}' "$TARGET_FILE"; }
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
  [[ -n "$CURRENT_CONTAINER" ]] && docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

start_container() {
  CURRENT_CONTAINER="$CONTAINER_PREFIX-$1"
  docker run -d --platform "$DOCKER_PLATFORM" --name "$CURRENT_CONTAINER" -e POSTGRES_PASSWORD=postgres -p 5432 "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 240); do
    if [[ "$(docker logs "$CURRENT_CONTAINER" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "::error::Container wurde nach 240s nicht bereit." >&2
    docker logs "$CURRENT_CONTAINER" 2>&1 | tail -30 >&2
    exit 1
  fi
  for _ in $(seq 1 30); do
    docker exec "$CURRENT_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
}

psql_stdin() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q
}
psql_value() {
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -v ON_ERROR_STOP=1 -q -tA
}
q() { psql_value <<<"$1" 2>&1 || true; }
schema_public() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }
schema_dump() { docker exec "$CURRENT_CONTAINER" pg_dump -U postgres --schema-only --schema=public --schema=match_engine postgres | grep -vE '^\\(un)?restrict '; }
counts() { python3 "$REPO_ROOT/scripts/db_catalog_counts.py" /dev/stdin <<<"$1"; }
count_of() { python3 -c "import json,sys; print(json.load(sys.stdin)['$2'])" <<<"$1"; }

# Zaehler je Kategorie (bash 3.2: keine assoziativen Arrays). FAILED sammelt die Namen roter Pruefungen (Gegenprobe).
CATS=(F S G P T W X)
DEVS=(0 0 0 0 0 0 0)
OKS=(0 0 0 0 0 0 0)
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
    FAILED="$FAILED"$'\n'"$2"
  fi
}
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
reset_counts() { DEVS=(0 0 0 0 0 0 0); OKS=(0 0 0 0 0 0 0); FAILED=""; }
summary() {
  local i
  echo
  for i in "${!CATS[@]}"; do echo "Kategorie ${CATS[$i]}: ${OKS[$i]} OK, ${DEVS[$i]} Abweichung(en)"; done
}

# ---------------------------------------------------------------------------------------------------------
# Daten: Identitaeten, Fixture, Vorlagen (VOR der Migration -- sie brauchen nur _005; jede Probe kopiert ihre Vorlage)
# ---------------------------------------------------------------------------------------------------------
setup_data() {
  psql_stdin < "$HARNESS_SQL"
  { printf "INSERT INTO harness.doc VALUES ('group-state', \$J\$"; cat "$FIX_DIR/group-state.json"; printf "\$J\$::jsonb);\n"; } | psql_stdin
  local owner
  owner="$(jq -r '.owner' "$FIX_DIR/group-state.json")"
  psql_stdin <<SQL
INSERT INTO harness.people VALUES
  ('olli', '$owner', false, NULL, NULL),
  ('maria', md5('a13bs:maria')::uuid, false, 'co-admin', 'Maria'),
  ('tom', md5('a13bs:tom')::uuid, true, 'helper', 'Tom'),
  ('bildschirm', md5('a13bs:bildschirm')::uuid, true, 'screen', 'Hallen-Monitor'),
  ('fremd', md5('a13bs:fremd')::uuid, false, NULL, NULL);
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       CASE WHEN anon THEN NULL ELSE name || '@a13bs.test' END, 'x', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
  FROM harness.people;
INSERT INTO public.profiles (id, display_name, email)
SELECT id, initcap(name), name || '@a13bs.test' FROM harness.people WHERE NOT anon
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;
SQL
}

# entries <tid> <Person> "A|B|x|y;..." -- Ergebnisse ueber append_match_events; jede Zeile muss angenommen werden
entries() {
  local tid="$1" who="$2" spec="$3" a b x y out sql=""
  while IFS='|' read -r a b x y; do
    [[ -z "$a" ]] && continue
    sql="$sql SELECT harness.entry('$who', '$tid', '$a', '$b', $x, $y);"
  done <<< "$(tr ';' '\n' <<<"$spec")"
  out="$(q "$sql")"
  if grep -qv '^accepted$' <<<"$out"; then
    echo "::error::Vorbereitung: Ergebnis nicht angenommen ($out)" >&2
    exit 1
  fi
}
A_CLEAN="FC Nord|SV Süd|2|1;FC Nord|TSV West|2|1;FC Nord|SC Ost|0|0;SV Süd|TSV West|2|1;SV Süd|SC Ost|2|0;TSV West|SC Ost|2|0"
# @W2A-048: SV Sued und TSV West je 4 Punkte und 4:3 Tore
A_TIE="FC Nord|SV Süd|2|1;FC Nord|TSV West|2|1;FC Nord|SC Ost|0|0;SV Süd|TSV West|1|1;SV Süd|SC Ost|2|0;TSV West|SC Ost|2|0"
A_FIVE="FC Nord|SV Süd|2|1;FC Nord|TSV West|2|1;SV Süd|TSV West|2|1;SV Süd|SC Ost|2|0;TSV West|SC Ost|2|0"
# @W2A-067 Nikolaus-Lage (DATA.NIKOLAUS)
NIKO="DJK Kammer|TSV Waging rot|2|1;DJK Kammer|TSV Petting|2|2;DJK Otting|DJK Kammer|2|1;DJK Kammer|TSV 1921 Fridolfing|2|0"
NIKO="$NIKO;DJK Kammer|TSV Waging blau|3|0;TSV Waging rot|DJK Otting|2|2;TSV Waging rot|TSV Petting|4|0"
NIKO="$NIKO;TSV Waging rot|TSV 1921 Fridolfing|3|0;TSV Waging rot|TSV Waging blau|3|0;TSV Petting|DJK Otting|1|1"
NIKO="$NIKO;TSV Petting|TSV 1921 Fridolfing|3|1;TSV Petting|TSV Waging blau|3|1;DJK Otting|TSV Waging blau|3|1"
NIKO="$NIKO;TSV 1921 Fridolfing|DJK Otting|4|1;TSV 1921 Fridolfing|TSV Waging blau|1|1"
R_CLEAN="FC Nord,SV Süd,TSV West,SC Ost"
R_WEST="FC Nord,TSV West,SV Süd,SC Ost"
R_NIKO="DJK Kammer,TSV Waging rot,TSV Petting,DJK Otting,TSV 1921 Fridolfing,TSV Waging blau"

setup_templates() {
  TPL_CLEAN="$(q "SELECT harness.instantiate('hallencup', 'vorlage-sauber');")"
  entries "$TPL_CLEAN" olli "$A_CLEAN"
  TPL_TIE="$(q "SELECT harness.instantiate('hallencup', 'vorlage-gleichstand');")"
  entries "$TPL_TIE" olli "$A_TIE"
  TPL_FIVE="$(q "SELECT harness.instantiate('hallencup', 'vorlage-fuenf');")"
  entries "$TPL_FIVE" olli "$A_FIVE"
  TPL_NIKO="$(q "SELECT harness.instantiate('nikolaus', 'vorlage-nikolaus');")"
  entries "$TPL_NIKO" olli "$NIKO"
  # Ergebnisse ohne Engine-Eintraege (Altbestand bzw. per REST geschrieben): reset_match_results darf sie zuruecksetzen.
  TPL_DIRECT="$(q "SELECT harness.instantiate('hallencup', 'vorlage-direkt');")"
  q "UPDATE public.matches m SET score_a = CASE WHEN m.team_a_id = harness.team(m.tournament_id, 'SC Ost') THEN 0 ELSE 2 END,
                                 score_b = CASE WHEN m.team_a_id = harness.team(m.tournament_id, 'SC Ost') THEN 2 ELSE 1 END,
                                 match_status = 'finished', decided_by = 'regular'
      WHERE m.tournament_id = '$TPL_DIRECT' AND m.group_letter = 'A';" >/dev/null
}

# clone <Vorlage> -- frische Kopie (eigene IDs) je Probe; ein Fehler bricht den Lauf ab (keine Folgefehler).
clone() {
  local out
  out="$(q "SELECT harness.clone('$1', 'probe-' || md5(random()::text || clock_timestamp()::text));")"
  if [[ ! "$out" =~ ^[0-9a-f-]{36}$ ]]; then
    echo "::error::Kopie der Vorlage $1 gescheitert: $out" >&2
    exit 1
  fi
  echo "$out"
}
state() { q "SELECT harness.state('$1', '$2')::text;"; }
version() { q "SELECT harness.tversion('$1');"; }
dec() { # dec <id> <tid> <Gruppe> <Art> <Teams> <Reihenfolge> [Sieger Verlierer] [Grund]
  local reason="NULL"
  [[ -n "${9:-}" ]] && reason="'$9'"
  q "SELECT harness.dec('$1', '$2', '$3', '$4', '$5', '$6', ${7:-NULL}, ${8:-NULL}, $reason)::text;"
}
complete() { # complete <Person> <tid> <Gruppe> <Rangfolge> <offen> <Entscheidungen> <bekannt> <Stand> <aus Warteschlange>
  q "SELECT harness.complete('$1', '$2', '$3', '$4', '$5', \$J\$$6\$J\$::jsonb, '$7', \$J\$$8\$J\$::jsonb, $9);"
}
decide() { # decide <Person> <tid> <decide|withdraw> <Entscheidung> <Grund|leer> <Version>
  local reason="NULL"
  [[ -n "$5" ]] && reason="'$5'"
  q "SELECT harness.decide('$1', '$2', '$3', \$J\$$4\$J\$::jsonb, $reason, $6);"
}
lastres() { q "SELECT harness.last()::text;"; }
side() { q "SELECT harness.side(harness.hf('$1', '$2'), '$3');"; }
gc() { q "SELECT harness.gc('$1', '$2');"; }
nlog() { q "SELECT count(*) FROM public.bracket_log WHERE tournament_id = '$1' AND kind = '$2';"; }
ndec() { q "SELECT jsonb_array_length(harness.decisions('$1'));"; }
nclar() { q "SELECT count(*) FROM public.clarifications WHERE tournament_id = '$1';"; }
as_val() { q "SELECT harness.val(harness.p('$1'), harness.pa('$1'), \$S\$$2\$S\$);"; }
as_exec() { q "SELECT harness.exec(harness.p('$1'), harness.pa('$1'), \$S\$$2\$S\$);"; }
gm() { q "SELECT harness.gm('$1', '$2', '$3');"; }
team() { q "SELECT harness.team('$1', '$2');"; }

# ---------------------------------------------------------------------------------------------------------
# G: Gleichlauf-Fixtures, SQL-Seite
# ---------------------------------------------------------------------------------------------------------
TWIN_RUN=0
run_twins() {
  local got exp n i row name tid
  TWIN_RUN=$((TWIN_RUN + 1))
  # group-key.json
  n="$(jq '.rows | length' "$FIX_DIR/group-key.json")"
  for ((i = 0; i < n; i++)); do
    row="$(jq -c ".rows[$i]" "$FIX_DIR/group-key.json")"
    name="$(jq -r '.name' <<<"$row")"
    got="$(q "SELECT match_engine.group_key((\$J\$$row\$J\$::jsonb ->> 'in'));")"
    check G "group-key.json: $name" "$(jq -r '.out' <<<"$row")" "$got"
  done
  # group-state.json (echt erzeugte Zeilen, IDs unveraendert)
  for key in nikolaus hallencup; do
    tid="$(q "SELECT harness.instantiate('$key', NULL, true);")"
    n="$(jq '.cases | length' "$FIX_DIR/group-state.json")"
    for ((i = 0; i < n; i++)); do
      row="$(jq -c ".cases[$i]" "$FIX_DIR/group-state.json")"
      [[ "$(jq -r '.tournament' <<<"$row")" == "$key" ]] || continue
      exp="$(jq -c '.expected' <<<"$row")"
      got="$(q "SELECT CASE WHEN match_engine.group_state('$tid', \$J\$$row\$J\$::jsonb ->> 'group') = (\$J\$$row\$J\$::jsonb -> 'expected') THEN 'gleich' ELSE match_engine.group_state('$tid', \$J\$$row\$J\$::jsonb ->> 'group')::text END;")"
      check G "group-state.json: $key Gruppe '$(jq -r '.group' <<<"$row")' ($(jq -r '.note' <<<"$row"))" "gleich" "$got"
    done
  done
  # placements-to-play-out.json
  n="$(jq '.rows | length' "$FIX_DIR/placements-to-play-out.json")"
  for ((i = 0; i < n; i++)); do
    row="$(jq -c ".rows[$i]" "$FIX_DIR/placements-to-play-out.json")"
    got="$(q "SELECT to_jsonb(match_engine.places_to_play_out(\$J\$$row\$J\$::jsonb -> 'config'))::text;")"
    check G "placements-to-play-out.json: $(jq -r '.name' <<<"$row")" "$(jq -c '.expected' <<<"$row" | sed 's/,/, /g')" "$got"
  done
  # standing-decision-shapes.json (Erwartung 'sql')
  n="$(jq '.rows | length' "$FIX_DIR/standing-decision-shapes.json")"
  for ((i = 0; i < n; i++)); do
    row="$(jq -c ".rows[$i]" "$FIX_DIR/standing-decision-shapes.json")"
    got="$(q "SELECT match_engine.standing_decision_valid(\$J\$$row\$J\$::jsonb -> 'decision');")"
    check G "standing-decision-shapes.json: $(jq -r '.name' <<<"$row")" "$(jq -r 'if .sql then "t" else "f" end' <<<"$row")" "$got"
  done
  # shared-allowed.json: Turnier mit config und Folgespielen je Zeile, Plaetze place..place+size-1
  n="$(jq '.rows | length' "$FIX_DIR/shared-allowed.json")"
  for ((i = 0; i < n; i++)); do
    row="$(jq -c ".rows[$i]" "$FIX_DIR/shared-allowed.json")"
    got="$(q "SELECT harness.shared_allowed_row(\$J\$$row\$J\$::jsonb, 'geteilt-$TWIN_RUN-$i');")"
    check G "shared-allowed.json: $(jq -r '.name' <<<"$row")" "$(jq -r 'if .expected then "t" else "f" end' <<<"$row")" "$got"
  done
}

# ---------------------------------------------------------------------------------------------------------
# P: Pflichttests (Plan A-13b-S P-1 ... P-11)
# ---------------------------------------------------------------------------------------------------------
run_pflicht() {
  local t s r d dw dm v sp so m

  # --- P-1 @TM-046 @TM-047 @TM-016: Gruppe A abschliessen besetzt ihre Plaetze, Gruppe B bleibt offen -------------
  t="$(clone "$TPL_CLEAN")"; s="$(state "$t" A)"
  check P "P-1 @TM-016 Gegenbeispiel: Helfer Tom ruft complete_group -> 42501, nichts besetzt" "error:42501|-|A1|none" \
    "$(complete tom "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" false)|$(side "$t" A1 A)|$(gc "$t" A)"
  check P "P-1 @TM-046 Olli schliesst Gruppe A ab (ok, Gruppe abgeschlossen)" "ok|completed" \
    "$(complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" false)|$(gc "$t" A)"
  check P "P-1 @TM-016 Halbfinale 1 Heimseite FC Nord (Herkunft Erster A), Halbfinale 2 Gastseite SV Sued (Zweiter A)" \
    "FC Nord|A1|SV Süd|A2" "$(side "$t" A1 A)|$(side "$t" B1 B)"
  check P "P-1 @TM-047 Gastseite Halbfinale 1 bleibt offen mit Herkunft Zweiter B" "-|B2" "$(side "$t" A1 B)"
  check P "P-1 @TM-046 Verlauf: complete_group mit Person Olli, zwei Besetzungen" "complete_group:Olli,auto_advance:Olli,auto_advance:Olli" \
    "$(as_val olli "SELECT string_agg(kind || ':' || coalesce(actor_name, '-'), ',' ORDER BY id) FROM public.bracket_log_read('$t')")"

  # --- P-2 @TM-054: ein Spiel offen -> OPEN_MATCHES {open:1}, nichts geaendert ------------------------------------
  t="$(clone "$TPL_FIVE")"; s="$(state "$t" A)"
  r="$(complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" false)"
  check P "P-2 @TM-054 5 von 6 entschieden -> abgelehnt OPEN_MATCHES, 1 Spiel offen; keine Seite, kein Abschluss, kein Verlauf" \
    "rejected:OPEN_MATCHES|1|-|A1|-|A2|none|0" \
    "$r|$(lastres | jq -r '.open')|$(side "$t" A1 A)|$(side "$t" B1 B)|$(gc "$t" A)|$(q "SELECT count(*) FROM public.bracket_log WHERE tournament_id = '$t';")"

  # --- P-3 @TM-049: erster Abschluss mit offenen Plaetzen -> TIE_DECISION_REQUIRED -------------------------------
  t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
  check P "P-3 @TM-049 erster Abschluss mit offenen Plaetzen {2} -> TIE_DECISION_REQUIRED, nichts besetzt, kein Abschluss" \
    "rejected:TIE_DECISION_REQUIRED|-|A1|-|A2|none" \
    "$(complete olli "$t" A "$R_CLEAN" '{2}' '[]' '{}' "$s" false)|$(side "$t" A1 A)|$(side "$t" B1 B)|$(gc "$t" A)"

  # --- P-4 @W2A-048: Entscheidung 4:3 West in der Tabelle, dann Abschluss mit ihrer Kopie ----------------------------
  t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
  dw="$(dec tabelle-west "$t" A shootout "SV Süd,TSV West" "TSV West,SV Süd" 4 3)"
  check P "P-4 @W2A-048 Olli traegt 4:3 fuer TSV West ueber record_standing_decision ein" "ok" "$(decide olli "$t" decide "$dw" "" "$(version "$t")")"
  check P "P-4 @W2A-048 Abschluss mit der Kopie: Halbfinale 2 Gast TSV West, Halbfinale 1 Heim FC Nord" "ok|TSV West|A2|FC Nord|A1" \
    "$(complete olli "$t" A "$R_WEST" '{}' "[$dw]" '{tabelle-west}' "$s" false)|$(side "$t" B1 B)|$(side "$t" A1 A)"
  check P "P-4 tie_orders ohne Grund und Grundlage, config mit genau einer Entscheidung, Verlauf standing_decision einmal" "0|1|1" \
    "$(q "SELECT count(*) FROM public.group_completions gc, jsonb_array_elements(gc.tie_orders) x WHERE gc.tournament_id = '$t' AND (x ? 'reason' OR x ? 'basis');")|$(ndec "$t")|$(nlog "$t" standing_decision)"

  # --- P-5 @TM-145: Korrektur nach dem Abschluss, erneuter Abschluss mit offenen Plaetzen {2,3} -----------------------
  r="$(q "SELECT harness.correction('olli', '$t', 'SV Süd', 'TSV West', 2, 2);")"
  check P "P-5 @TM-145 Korrektur SV Sued - TSV West 1:1 -> 2:2 angenommen, Gruppe A 'stale' (Besetzung pruefen)" "accepted|stale" "$r|$(gc "$t" A)"
  s="$(state "$t" A)"
  check P "P-5 @TM-145 erneuter Abschluss mit offenen Plaetzen {2,3}: Halbfinale 2 zeigt wieder Zweiter A, Hinweis released (TSV West), stale bleibt" \
    "ok|-|A2|released:B:-/TSV West|stale" \
    "$(complete olli "$t" A "$R_CLEAN" '{3,2,3}' '[]' '{}' "$s" false)|$(side "$t" B1 B)|$(q "SELECT harness.notices('$t');")|$(gc "$t" A)"
  check P "P-5 offene Plaetze sortiert und ohne Doppelte gespeichert" "{2,3}" "$(q "SELECT open_ranks FROM public.group_completions WHERE tournament_id = '$t' AND group_id = 'A';")"
  # Gegenbeispiel: Halbfinale 2 schon angepfiffen -> bleibt, Hinweis started_follow_up
  t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
  dw="$(dec tabelle-west "$t" A shootout "SV Süd,TSV West" "TSV West,SV Süd" 4 3)"
  decide olli "$t" decide "$dw" "" "$(version "$t")" >/dev/null
  complete olli "$t" A "$R_WEST" '{}' "[$dw]" '{tabelle-west}' "$s" false >/dev/null
  q "SELECT harness.correction('olli', '$t', 'SV Süd', 'TSV West', 2, 2);" >/dev/null
  q "UPDATE public.matches SET match_status = 'running' WHERE id = harness.hf('$t', 'B1');" >/dev/null   # angepfiffen (Zwischenspeicher)
  s="$(state "$t" A)"
  check P "P-5 Gegenbeispiel: Halbfinale 2 laeuft schon -> TSV West bleibt, Hinweis started_follow_up" "ok|TSV West|A2|started_follow_up:B:-/TSV West" \
    "$(complete olli "$t" A "$R_CLEAN" '{2,3}' '[]' '{}' "$s" false)|$(side "$t" B1 B)|$(q "SELECT harness.notices('$t');")"

  # P-5b (Review M4, @TM-145/@TM-099 „angepfiffen“, C-FOLGESPIEL-PAUSIERT-UNGEPRUEFT): ein unterbrochenes Folgespiel (Halbzeit, paused) bleibt ebenfalls
  t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
  dw="$(dec tabelle-west "$t" A shootout "SV Süd,TSV West" "TSV West,SV Süd" 4 3)"
  decide olli "$t" decide "$dw" "" "$(version "$t")" >/dev/null
  complete olli "$t" A "$R_WEST" '{}' "[$dw]" '{tabelle-west}' "$s" false >/dev/null
  q "SELECT harness.correction('olli', '$t', 'SV Süd', 'TSV West', 2, 2);" >/dev/null
  q "UPDATE public.matches SET match_status = 'paused' WHERE id = harness.hf('$t', 'B1');" >/dev/null   # Halbzeit (Zwischenspeicher)
  s="$(state "$t" A)"
  check P "P-5b Gegenbeispiel @TM-145 @TM-099: Halbfinale 2 unterbrochen (paused) -> TSV West bleibt, Hinweis started_follow_up (C-FOLGESPIEL-PAUSIERT-UNGEPRUEFT)" "ok|TSV West|A2|started_follow_up:B:-/TSV West" \
    "$(complete olli "$t" A "$R_CLEAN" '{2,3}' '[]' '{}' "$s" true)|$(side "$t" B1 B)|$(q "SELECT harness.notices('$t');")"

  # --- P-6 @TM-099 Z1: von Hand gesetzte Seite bleibt nach Wiederoeffnen, Korrektur, erneutem Abschluss -------------
  t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
  dw="$(dec tabelle-west "$t" A shootout "SV Süd,TSV West" "TSV West,SV Süd" 4 3)"
  decide olli "$t" decide "$dw" "" "$(version "$t")" >/dev/null
  complete olli "$t" A "$R_WEST" '{}' "[$dw]" '{tabelle-west}' "$s" false >/dev/null
  check P "P-6 @TM-099 Olli setzt die Gastseite von Halbfinale 2 von Hand auf TSV West (vor dem Anpfiff)" "ok:1|TSV West|hand" \
    "$(as_exec olli "UPDATE public.matches SET team_b_id = harness.team('$t', 'TSV West'), slot_b_source = NULL WHERE id = harness.hf('$t', 'B1')")|$(side "$t" B1 B)"
  check P "P-6 @TM-099 Gruppe A wieder oeffnen mit Grund -> ok, Gruppe offen, Besetzung bleibt" "ok|reopened|TSV West|hand" \
    "$(q "SELECT harness.reopen('olli', '$t', 'A', 'Ergebnis falsch eingetragen');")|$(gc "$t" A)|$(side "$t" B1 B)"
  q "SELECT harness.correction('olli', '$t', 'FC Nord', 'TSV West', 1, 3);" >/dev/null
  s="$(state "$t" A)"
  check P "P-6 @TM-099 erneuter Abschluss (Zweiter A waere FC Nord): Halbfinale 2 bleibt TSV West, Hinweis manual_kept FC Nord/TSV West" \
    "ok|TSV West|hand|manual_kept:B:FC Nord/TSV West|completed" \
    "$(complete olli "$t" A "TSV West,FC Nord,SV Süd,SC Ost" '{}' '[]' '{}' "$s" false)|$(side "$t" B1 B)|$(q "SELECT harness.notices('$t');")|$(gc "$t" A)"
  check P "P-6 Gegenbeispiel: die nicht von Hand gesetzte Heimseite von Halbfinale 1 wird neu besetzt (TSV West)" "TSV West|A1" "$(side "$t" A1 A)"
  check P "P-6 reopen_group ohne Grund -> REASON_REQUIRED; nicht abgeschlossene Gruppe B -> NOT_COMPLETED" "rejected:REASON_REQUIRED|rejected:NOT_COMPLETED" \
    "$(q "SELECT harness.reopen('olli', '$t', 'A', '  ');")|$(q "SELECT harness.reopen('olli', '$t', 'B', 'Grund');")"

  # --- P-7 F9 aus der Warteschlange (p_from_queue = true) -----------------------------------------------------------
  # @TM-146 Z1: unveraendert -> gilt, Entscheidung im config, Verlauf
  t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
  dw="$(dec offline-west "$t" A shootout "SV Süd,TSV West" "TSV West,SV Süd" 4 3)"
  check P "P-7 @TM-146 Z1 nichts geaendert -> ok, Halbfinale 2 TSV West, Entscheidung im config, Verlauf standing_decision" "ok|TSV West|A2|1|1" \
    "$(complete olli "$t" A "$R_WEST" '{}' "[$dw]" '{}' "$s" true)|$(side "$t" B1 B)|$(ndec "$t")|$(nlog "$t" standing_decision)"
  # @TM-146 Z1 mit bekannter (verfallener) Entscheidung desselben Blocks -> kein Konflikt (MG5)
  t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
  sp="$(dec verfallen "$t" A shared "SV Süd,TSV West" "SV Süd,TSV West")"
  decide olli "$t" decide "$sp" "" "$(version "$t")" >/dev/null
  dw="$(dec offline-west "$t" A shootout "SV Süd,TSV West" "TSV West,SV Süd" 4 3)"
  check P "P-7 @TM-146 Z1 die bekannte, verfallene Annahme desselben Blocks ist kein Konflikt (bekannt: verfallen) -> ok" "ok|TSV West|A2" \
    "$(complete olli "$t" A "$R_WEST" '{}' "[$dw]" '{verfallen}' "$s" true)|$(side "$t" B1 B)"
  # Reihenfolge (3 Teams) aus der Warteschlange: Grund nur im Verlauf; ohne Grund abgelehnt (B1)
  t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
  d="$(dec offline-reihenfolge "$t" A order "SV Süd,TSV West,SC Ost" "TSV West,SV Süd,SC Ost")"
  check P "P-7 B1 neue Reihenfolge (3 Teams) ohne Grund -> REASON_REQUIRED, nichts geschrieben" "rejected:REASON_REQUIRED|0|none" \
    "$(complete olli "$t" A "$R_WEST" '{}' "[$d]" '{}' "$s" true)|$(ndec "$t")|$(gc "$t" A)"
  d="$(dec offline-reihenfolge "$t" A order "SV Süd,TSV West,SC Ost" "TSV West,SV Süd,SC Ost" "" "" "Strafstoßschießen nach Absprache")"
  check P "P-7 @TM-146 Z1 Reihenfolge mit Grund -> ok; Grund im Verlauf, nicht im config" "ok|Strafstoßschießen nach Absprache|0" \
    "$(complete olli "$t" A "$R_WEST" '{}' "[$d]" '{}' "$s" true)|$(q "SELECT reason FROM public.bracket_log WHERE tournament_id = '$t' AND kind = 'standing_decision';")|$(q "SELECT count(*) FROM jsonb_array_elements(harness.decisions('$t')) x WHERE x ? 'reason';")"
  # @TM-146 Z2: Marias Korrektur bei gleichem Status -> Klaerung STALE_VERSION ohne server_last
  t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
  q "SELECT harness.correction('maria', '$t', 'TSV West', 'SC Ost', 3, 0);" >/dev/null
  dw="$(dec offline-west "$t" A shootout "SV Süd,TSV West" "TSV West,SV Süd" 4 3)"
  check P "P-7 @TM-146 Z2 Korrektur bei gleichem Status (beendet) -> Klaerung STALE_VERSION, server_last leer, nichts besetzt, keine Entscheidung" \
    "clarification:STALE_VERSION|1|null|-|A2|0" \
    "$(complete olli "$t" A "$R_WEST" '{}' "[$dw]" '{}' "$s" true)|$(nclar "$t")|$(q "SELECT coalesce(server_last::text, 'null') FROM public.clarifications WHERE tournament_id = '$t';")|$(side "$t" B1 B)|$(ndec "$t")"
  check P "P-7 @TM-146 Z2 Klaerung haelt Abschluss und Entscheidung samt Rangfolge fest (requested)" "1|4" \
    "$(q "SELECT jsonb_array_length(requested -> 'tieDecisions') FROM public.clarifications WHERE tournament_id = '$t';")|$(q "SELECT jsonb_array_length(requested -> 'ranking') FROM public.clarifications WHERE tournament_id = '$t';")"
  # @TM-146 Z3: Marias 5:4 fuer SV Sued in der Tabelle -> DECIDED_ELSEWHERE mit last (5:4)
  t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
  dm="$(dec tabelle-maria "$t" A shootout "SV Süd,TSV West" "SV Süd,TSV West" 5 4)"
  decide maria "$t" decide "$dm" "" "$(version "$t")" >/dev/null
  dw="$(dec offline-west "$t" A shootout "SV Süd,TSV West" "TSV West,SV Süd" 4 3)"
  r="$(complete olli "$t" A "$R_WEST" '{}' "[$dw]" '{}' "$s" true)"
  check P "P-7 @TM-146 Z3 Marias 5:4 unbekannt -> Klaerung DECIDED_ELSEWHERE; last nennt Marias 5:4; config nur Marias Entscheidung" \
    "clarification:DECIDED_ELSEWHERE|standing_decision|5:4|tabelle-maria|1|none" \
    "$r|$(lastres | jq -r '.last.kind')|$(lastres | jq -r '"\(.last.detail.shootout.winner):\(.last.detail.shootout.loser)"')|$(q "SELECT harness.decisions('$t') -> 0 ->> 'id';")|$(ndec "$t")|$(gc "$t" A)"
  # @TM-147 Nikolaus (Gruppe ''), Annahme Petting/Otting ohne Netz
  for zeile in Z1 Z2 Z3 Z4 Z5; do
    t="$(clone "$TPL_NIKO")"; s="$(state "$t" '')"
    case "$zeile" in
      Z2) q "SELECT harness.correction('maria', '$t', 'TSV 1921 Fridolfing', 'TSV Waging blau', 2, 1);" >/dev/null ;;
      Z3) as_exec maria "UPDATE public.tournaments SET config = jsonb_set(config, '{placementsToPlayOut}', '[1,2,3]') WHERE id = '$t'" >/dev/null ;;
      Z4) dm="$(dec tabelle-otting "$t" '' shootout "TSV Petting,DJK Otting" "DJK Otting,TSV Petting" 4 3)"
          decide maria "$t" decide "$dm" "" "$(version "$t")" >/dev/null ;;
      Z5) as_exec maria "UPDATE public.tournaments SET config = jsonb_set(config, '{placementsToPlayOut}', '[1,2,5]') WHERE id = '$t'" >/dev/null ;;
    esac
    so="$(dec offline-annahme "$t" '' shared "TSV Petting,DJK Otting" "TSV Petting,DJK Otting")"
    r="$(complete olli "$t" '' "$R_NIKO" '{}' "[$so]" '{}' "$s" true)"
    case "$zeile" in
      Z1) check P "P-7/RT-13 @TM-147 Z1 nichts geaendert -> ok, Annahme im config, Gruppe '' abgeschlossen" "ok|1|completed" "$r|$(ndec "$t")|$(gc "$t" '')" ;;
      Z2) check P "P-7/RT-13 @TM-147 Z2 Marias Korrektur -> Klaerung STALE_VERSION" "clarification:STALE_VERSION|none" "$r|$(gc "$t" '')" ;;
      Z3) check P "P-7/RT-13 @TM-147 Z3 Platz 3 angehakt -> Klaerung SHARED_NOT_ALLOWED" "clarification:SHARED_NOT_ALLOWED|none|0" "$r|$(gc "$t" '')|$(ndec "$t")" ;;
      Z4) check P "P-7/RT-13 @TM-147 Z4 Marias 4:3 fuer DJK Otting -> Klaerung DECIDED_ELSEWHERE mit last (4:3)" "clarification:DECIDED_ELSEWHERE|4:3|none" \
            "$r|$(lastres | jq -r '"\(.last.detail.shootout.winner):\(.last.detail.shootout.loser)"')|$(gc "$t" '')" ;;
      Z5) check P "P-7/RT-13 @TM-147 Z5 Platz 5 angehakt -> Ollis Abschluss gilt" "ok|completed|1" "$r|$(gc "$t" '')|$(ndec "$t")" ;;
    esac
  done

  # --- P-8 @W2A-070: Zuruecknehmen bis zum Abschluss, Idempotenz ------------------------------------------------
  t="$(clone "$TPL_NIKO")"; s="$(state "$t" '')"
  sp="$(dec annahme-1 "$t" '' shared "TSV Petting,DJK Otting" "TSV Petting,DJK Otting")"
  decide olli "$t" decide "$sp" "" "$(version "$t")" >/dev/null
  v="$(version "$t")"
  check P "P-8 @W2A-070 Maria nimmt Ollis Annahme vor dem Abschluss zurueck -> ok, Verlauf standing_withdraw" "ok|1|0" \
    "$(decide maria "$t" withdraw "$sp" "" "$v")|$(nlog "$t" standing_withdraw)|$(ndec "$t")"
  check P "P-8 dieselbe Ruecknahme noch einmal -> ok ALREADY_APPLIED, kein zweiter Verlaufseintrag" "ok:ALREADY_APPLIED|1" \
    "$(decide maria "$t" withdraw "$sp" "" "$v")|$(nlog "$t" standing_withdraw)"
  sp="$(dec annahme-2 "$t" '' shared "TSV Petting,DJK Otting" "TSV Petting,DJK Otting")"
  v="$(version "$t")"
  check P "P-8 Olli akzeptiert erneut -> ok; derselbe Eintrag mit alter Version noch einmal -> ok ALREADY_APPLIED" "ok|ok:ALREADY_APPLIED|1" \
    "$(decide olli "$t" decide "$sp" "" "$v")|$(decide olli "$t" decide "$sp" "" "$v")|$(ndec "$t")"
  complete olli "$t" '' "$R_NIKO" '{}' "[$sp]" '{annahme-2}' "$s" false >/dev/null
  check P "P-8 @W2A-070 nach dem Abschluss -> WITHDRAW_NOT_ALLOWED, Annahme bleibt" "rejected:WITHDRAW_NOT_ALLOWED|1" \
    "$(decide olli "$t" withdraw "$sp" "" "$(version "$t")")|$(ndec "$t")"
  q "SELECT harness.reopen('olli', '$t', '', 'Annahme pruefen');" >/dev/null
  check P "P-8 @W2A-070 nach reopen_group wieder moeglich -> ok" "ok|0" "$(decide olli "$t" withdraw "$sp" "" "$(version "$t")")|$(ndec "$t")"
  check P "P-8 Reihenfolge ohne Grund -> REASON_REQUIRED; veraltete Version -> STALE; unbekannte Ruecknahme -> NOT_FOUND" \
    "rejected:REASON_REQUIRED|rejected:STALE|rejected:NOT_FOUND" \
    "$(decide olli "$t" decide "$(dec r3 "$t" '' order "TSV Petting,DJK Otting,TSV 1921 Fridolfing" "DJK Otting,TSV Petting,TSV 1921 Fridolfing")" "" "$(version "$t")")|$(decide olli "$t" decide "$(dec alt "$t" '' shared "TSV Petting,DJK Otting" "TSV Petting,DJK Otting")" "" 1)|$(decide olli "$t" withdraw "$(dec gibtsnicht "$t" '' shared "TSV Petting,DJK Otting" "TSV Petting,DJK Otting")" "" "$(version "$t")")"

  # --- P-9 @W2A-072 @TM-113: Verlauf nur fuer die Turnierleitung -------------------------------------------------
  t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
  dw="$(dec tabelle-west "$t" A shootout "SV Süd,TSV West" "TSV West,SV Süd" 4 3)"
  decide olli "$t" decide "$dw" "" "$(version "$t")" >/dev/null
  complete olli "$t" A "$R_WEST" '{}' "[$dw]" '{tabelle-west}' "$s" false >/dev/null
  check P "P-9 @W2A-072 anon: SELECT bracket_log und bracket_log_read -> 42501" "error:42501|error:42501" \
    "$(q "SELECT harness.val(NULL, false, \$S\$SELECT count(*)::text FROM public.bracket_log\$S\$, 'anon');")|$(q "SELECT harness.val(NULL, false, \$S\$SELECT count(*)::text FROM public.bracket_log_read('$t')\$S\$, 'anon');")"
  check P "P-9 @TM-113 Helfer Tom: bracket_log_read 0 Zeilen, bracket_log direkt 42501" "0|error:42501" \
    "$(as_val tom "SELECT count(*)::text FROM public.bracket_log_read('$t')")|$(as_val tom "SELECT count(*)::text FROM public.bracket_log")"
  check P "P-9 @TM-113 Co-Admin Maria sieht den Verlauf mit Ollis Namen (Entscheidung, Abschluss)" "standing_decision:Olli:owner,complete_group:Olli:owner" \
    "$(as_val maria "SELECT string_agg(kind || ':' || coalesce(actor_name, '-') || ':' || coalesce(actor_role, '-'), ',' ORDER BY id) FROM public.bracket_log_read('$t') WHERE kind IN ('standing_decision', 'complete_group')")"
  check P "P-9 @W2A-072 tournaments.config nach decide ohne Person, Zeit und Grund" "0" \
    "$(q "SELECT count(*) FROM jsonb_array_elements(harness.decisions('$t')) x WHERE x ?| ARRAY['decidedBy', 'decidedAt', 'reason', 'actor', 'at'];")"
  check P "P-9 Helfer Tom liest group_completions (1 Zeile), tie_orders ohne reason und basis; Hinweise/Klaerungen 0 Zeilen" "1|0|0|0" \
    "$(as_val tom "SELECT count(*)::text FROM public.group_completions WHERE tournament_id = '$t'")|$(as_val tom "SELECT count(*)::text FROM public.group_completions gc, jsonb_array_elements(gc.tie_orders) x WHERE gc.tournament_id = '$t' AND (x ? 'reason' OR x ? 'basis')")|$(as_val tom "SELECT count(*)::text FROM public.bracket_notices")|$(as_val tom "SELECT count(*)::text FROM public.clarifications")"
  check P "P-9 anon: group_completions, bracket_notices, clarifications -> 42501" "error:42501|error:42501|error:42501" \
    "$(q "SELECT harness.val(NULL, false, \$S\$SELECT count(*)::text FROM public.group_completions\$S\$, 'anon');")|$(q "SELECT harness.val(NULL, false, \$S\$SELECT count(*)::text FROM public.bracket_notices\$S\$, 'anon');")|$(q "SELECT harness.val(NULL, false, \$S\$SELECT count(*)::text FROM public.clarifications\$S\$, 'anon');")"

  # --- P-10 @TM-057 @TM-058: Jeder gegen jeden (Spiele 'all', Teams NULL) -------------------------------------------
  t="$(clone "$TPL_NIKO")"; s="$(state "$t" '')"
  so="$(dec annahme "$t" '' shared "TSV Petting,DJK Otting" "TSV Petting,DJK Otting")"
  check P "P-10 @TM-057 Nikolaus: 15 Spiele 'all' bilden Gruppe '' (Stand mit 15 Spielen)" "15" "$(jq 'length' <<<"$s")"
  check P "P-10 @TM-057 complete_group('') -> ok, group_completions.group_id = ''" "ok|1" \
    "$(complete olli "$t" '' "$R_NIKO" '{}' "[$so]" '{}' "$s" false)|$(q "SELECT count(*) FROM public.group_completions WHERE tournament_id = '$t' AND group_id = '';")"
  check P "P-10 Gegenbeispiel: 'all' ist keine Gruppe -> UNKNOWN_GROUP" "rejected:UNKNOWN_GROUP" \
    "$(complete olli "$t" all "$R_NIKO" '{}' '[]' '{}' '[]' false)"
  check P "P-10 Korrektur eines Nikolaus-Spiels setzt den Abschluss auf stale (Trigger bildet 'all' ab)" "accepted|stale" \
    "$(q "SELECT harness.correction('olli', '$t', 'TSV 1921 Fridolfing', 'TSV Waging blau', 2, 1);")|$(gc "$t" '')"

  # --- P-11 (Soll 12): Voll-Speichern schreibt keine Entscheidungen; reassigned_at nur der Server ---------------------
  t="$(clone "$TPL_NIKO")"
  so="$(dec annahme "$t" '' shared "TSV Petting,DJK Otting" "TSV Petting,DJK Otting")"
  decide olli "$t" decide "$so" "" "$(version "$t")" >/dev/null
  check P "P-11 Eigentuemer-REST-Update config mit geaenderten standingDecisions und placementsToPlayOut -> Zeile aktualisiert" "ok:1" \
    "$(as_exec olli "UPDATE public.tournaments SET config = jsonb_set(jsonb_set(config, '{standingDecisions}', '[]'), '{placementsToPlayOut}', '[1,2,5]') WHERE id = '$t'")"
  check P "P-11 standingDecisions bleibt der Serverwert; placementsToPlayOut im selben Update uebernommen; kein Verlaufseintrag" "annahme|[1, 2, 5]|1" \
    "$(q "SELECT harness.decisions('$t') -> 0 ->> 'id';")|$(q "SELECT (config -> 'placementsToPlayOut')::text FROM public.tournaments WHERE id = '$t';")|$(q "SELECT count(*) FROM public.bracket_log WHERE tournament_id = '$t';")"
  check P "P-11 Voll-Speichern kann keine Entscheidung hinzufuegen" "ok:1|1" \
    "$(as_exec olli "UPDATE public.tournaments SET config = jsonb_set(config, '{standingDecisions}', config -> 'standingDecisions' || '[{\"id\":\"rest\"}]') WHERE id = '$t'")|$(ndec "$t")"
  m="$(gm "$t" 'DJK Kammer' 'TSV Waging rot')"
  check P "P-11 Eigentuemer und Co-Admin: REST-UPDATE matches.reassigned_at -> 42501" "error:42501|error:42501" \
    "$(as_exec olli "UPDATE public.matches SET reassigned_at = now() WHERE id = '$m'")|$(as_exec maria "UPDATE public.matches SET reassigned_at = now() WHERE id = '$m'")"
  check P "P-11 INSERT mit reassigned_at -> neutral (NULL)" "ok:1|null" \
    "$(as_exec olli "INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, reassigned_at) VALUES (md5('p11-neu')::uuid, '$t', 20, 1, harness.team('$t', 'DJK Kammer'), harness.team('$t', 'DJK Otting'), 40, now())")|$(q "SELECT coalesce(reassigned_at::text, 'null') FROM public.matches WHERE id = md5('p11-neu')::uuid;")"
}

# ---------------------------------------------------------------------------------------------------------
# T: Mehrgeraete-Faelle (§ 7) -- erst nacheinander (Semantik), dann gleichzeitig (Verklemmungs-Probe)
# ---------------------------------------------------------------------------------------------------------
run_rt_seq() {
  local t s r m e

  # RT-2 online: Geraet 1 rechnet (Stand s), Maria korrigiert, Geraet 1 sendet -> STALE_VERSION, keine Klaerung (MG11)
  t="$(clone "$TPL_CLEAN")"; s="$(state "$t" A)"
  q "SELECT harness.correction('maria', '$t', 'SV Süd', 'TSV West', 1, 1);" >/dev/null
  check T "RT-2 @TM-116 Z1 online: Korrektur zwischen Rechnen und Senden -> abgelehnt STALE_VERSION, nichts besetzt, keine Klaerung" \
    "rejected:STALE_VERSION|-|A1|none|0" "$(complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" false)|$(side "$t" A1 A)|$(gc "$t" A)|$(nclar "$t")"
  check T "RT-2 @TM-117 aus der Warteschlange: dieselbe Lage -> Klaerung STALE_VERSION (eine Zeile)" "clarification:STALE_VERSION|1" \
    "$(complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" true)|$(nclar "$t")"

  # RT-2b: reset_match_results statt Korrektur (matches.version bleibt gleich) -> ebenfalls STALE_VERSION
  t="$(clone "$TPL_DIRECT")"; s="$(state "$t" A)"; m="$(gm "$t" 'SV Süd' 'TSV West')"
  check T "RT-2b reset_match_results eines Gruppenspiels (Version unveraendert) -> STALE_VERSION" "ok|rejected:STALE_VERSION" \
    "$(q "SELECT harness.rpc(harness.p('olli'), false, \$S\$SELECT public.reset_match_results('$t', ARRAY['$m']::uuid[])\$S\$);")|$(complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" false)"

  # RT-6: zwei Abschluesse mit unterschiedlicher Reihenfolge -> COMPLETED_DIFFERENTLY mit dem, der abgeschlossen hat
  t="$(clone "$TPL_CLEAN")"; s="$(state "$t" A)"
  complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" false >/dev/null
  r="$(complete maria "$t" A "SV Süd,FC Nord,TSV West,SC Ost" '{}' '[]' '{}' "$s" false)"
  check T "RT-6 @TM-120 zweiter Abschluss mit anderer Reihenfolge -> COMPLETED_DIFFERENTLY, last = complete_group von Olli; Besetzung bleibt" \
    "rejected:COMPLETED_DIFFERENTLY|complete_group|$(q "SELECT harness.p('olli');")|FC Nord|A1" \
    "$r|$(lastres | jq -r '.last.kind')|$(lastres | jq -r '.last.actor')|$(side "$t" A1 A)"
  check T "RT-5 (nacheinander) gleicher Abschluss noch einmal -> ok ALREADY_COMPLETED, ein Verlaufseintrag" "ok:ALREADY_COMPLETED|1" \
    "$(complete maria "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" false)|$(nlog "$t" complete_group)"

  # RT-9 @TM-071: Korrektur in abgeschlossener Gruppe, kein erneuter Abschluss -> stale bleibt, Besetzung unveraendert
  q "SELECT harness.correction('maria', '$t', 'FC Nord', 'SV Süd', 1, 2);" >/dev/null
  check T "RT-9 @TM-071 Korrektur nach dem Abschluss, Geraet stuerzt ab -> Gruppe stale (Banner), Halbfinale unveraendert" "stale|FC Nord|A1|SV Süd|A2" \
    "$(gc "$t" A)|$(side "$t" A1 A)|$(side "$t" B1 B)"
  check T "RT-9 Turnierleitung liest stale (Banner beim naechsten Oeffnen), Helfer auch" "t|t" \
    "$(as_val olli "SELECT stale::text FROM public.group_completions WHERE tournament_id = '$t' AND group_id = 'A'" | cut -c1)|$(as_val tom "SELECT stale::text FROM public.group_completions WHERE tournament_id = '$t' AND group_id = 'A'" | cut -c1)"

  # RT-10 @TM-116 Z4: Offline-Abschluss gegen reopen_group des Co-Admins -> Klaerung GROUP_REOPENED, Gruppe bleibt offen
  t="$(clone "$TPL_CLEAN")"; s="$(state "$t" A)"
  complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" false >/dev/null
  q "SELECT harness.reopen('maria', '$t', 'A', 'Ergebnis pruefen');" >/dev/null
  check T "RT-10 @TM-116 Z4 Abschluss aus der Warteschlange nach Marias Wiederoeffnen -> Klaerung GROUP_REOPENED, Gruppe bleibt offen" \
    "clarification:GROUP_REOPENED|reopened|reopen_group" \
    "$(complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" true)|$(gc "$t" A)|$(lastres | jq -r '.last.kind')"

  # RT-10b @TM-148 (Gegenbeispiel zu @TM-116, Review M2, C-EIGENES-WIEDEROEFFNEN-KONFLIKT): Olli oeffnet selbst wieder, schliesst ohne Netz ab -> kein Konflikt
  t="$(clone "$TPL_CLEAN")"; s="$(state "$t" A)"
  complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" false >/dev/null
  q "SELECT harness.reopen('olli', '$t', 'A', 'Ergebnis pruefen');" >/dev/null
  check T "RT-10b @TM-148 Gegenbeispiel: eigenes Wiederoeffnen, dann Abschluss aus der Warteschlange -> ok, abgeschlossen, keine Klaerung (C-EIGENES-WIEDEROEFFNEN-KONFLIKT)" \
    "ok|completed|0" "$(complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" true)|$(gc "$t" A)|$(nclar "$t")"

  # RT-14: eigenes letztes Ergebnis ohne Netz + Abschluss ohne Netz; Engine-Warteschlange zuerst -> kein Konflikt
  t="$(clone "$TPL_FIVE")"; s="$(state "$t" A)"; m="$(gm "$t" 'FC Nord' 'SC Ost')"
  # Sicht des Geraets: der eigene Eintrag 0:0 ist im Stand (aus dem alten Stand berechnet, nicht vom Server gelesen)
  e="$(jq -c --arg m "$m" 'map(if .id == $m then . + {a: 0, b: 0, s: "finished"} else . end)' <<<"$s" 2>/dev/null || echo '[]')"
  r="$(q "SELECT harness.entry('olli', '$t', 'FC Nord', 'SC Ost', 0, 0);")"
  check T "RT-14 Wiederverbindung: erst das Ergebnis (angenommen), dann der Abschluss aus der Warteschlange -> ok, kein Konflikt" "accepted|ok|0" \
    "$r|$(complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$e" true)|$(nclar "$t")"

  # RT-18: Team-Tausch in einem Gruppenspiel zwischen Rechnen und Senden -> STALE_VERSION (MG13)
  t="$(clone "$TPL_DIRECT")"; s="$(state "$t" A)"; m="$(gm "$t" 'FC Nord' 'SC Ost')"
  check T "RT-18 Olli tauscht die Teams eines Gruppenspiels (Spielplan) -> ok; danach Abschluss mit altem Stand -> STALE_VERSION, nichts besetzt" \
    "ok:1|rejected:STALE_VERSION|-|A1" \
    "$(as_exec olli "UPDATE public.matches SET team_a_id = team_b_id, team_b_id = team_a_id WHERE id = '$m'")|$(complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" false)|$(side "$t" A1 A)"

  # RT-17 (nacheinander, MG10): Team im Gruppenspiel tauschen NACH dem Abschluss -> gelingt und markiert stale
  t="$(clone "$TPL_DIRECT")"; s="$(state "$t" A)"; m="$(gm "$t" 'FC Nord' 'SC Ost')"
  complete olli "$t" A "$R_CLEAN" '{}' '[]' '{}' "$s" false >/dev/null
  check T "RT-17 @TM-071 Team im Gruppenspiel tauschen nach dem Abschluss (Turnierleitung) -> gelingt, Gruppe stale" "ok:1|stale" \
    "$(as_exec olli "UPDATE public.matches SET team_a_id = team_b_id, team_b_id = team_a_id WHERE id = '$m'")|$(gc "$t" A)"

  # B2: Kopie einer am Server schon zurueckgenommenen Entscheidung -> DECIDED_ELSEWHERE statt still wieder eintragen
  t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
  e="$(dec tabelle-west "$t" A shootout "SV Süd,TSV West" "TSV West,SV Süd" 4 3)"
  decide olli "$t" decide "$e" "" "$(version "$t")" >/dev/null
  decide maria "$t" withdraw "$e" "" "$(version "$t")" >/dev/null
  check T "RT-15 B2 @TM-116 Abschluss mit Kopie einer inzwischen von Maria zurueckgenommenen Entscheidung -> DECIDED_ELSEWHERE, nichts eingetragen" \
    "rejected:DECIDED_ELSEWHERE|standing_withdraw|0|none" \
    "$(complete olli "$t" A "$R_WEST" '{}' "[$e]" '{tabelle-west}' "$s" false)|$(lastres | jq -r '.last.kind')|$(ndec "$t")|$(gc "$t" A)"
}

# race <SQL Sitzung A> <SQL Sitzung B> -> RACE_A / RACE_B (Ausgaben, gleichzeitig in zwei psql-Sitzungen)
race() {
  local fa="$WORK_DIR/race-a.out" fb="$WORK_DIR/race-b.out" pa pb
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 <<<"$1" >"$fa" 2>&1 &
  pa=$!
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CURRENT_CONTAINER" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 <<<"$2" >"$fb" 2>&1 &
  pb=$!
  wait "$pa" || true
  wait "$pb" || true
  RACE_A="$(cat "$fa")"; RACE_B="$(cat "$fb")"
}
rnd() { printf '0.%02d' $((RANDOM % ${1:-30})); }
deadlocked() { grep -qE '40P01|deadlock detected' <<<"$RACE_A$RACE_B" && echo ja || echo nein; }
pick() { grep -m1 "^$1:" <<<"$2" | cut -d: -f2- || true; }

# Ein Fall der Verklemmungs-Probe; zaehlt Verklemmungen (RACE_DEADLOCKS) und unerlaubte Ausgaenge (RACE_BAD).
race_case() { # race_case <RT> <Lauf>
  local rt="$1" i="$2" t s m ra rb d g v
  case "$rt" in
    RT-2)
      t="$(clone "$TPL_CLEAN")"; s="$(state "$t" A)"; m="$(gm "$t" 'SV Süd' 'TSV West')"
      race "SELECT pg_sleep($(rnd)); BEGIN; SELECT 1 FROM public.matches WHERE id = '$m' FOR UPDATE; SELECT pg_sleep(0.3);
            SELECT 'A:' || harness.correction('maria', '$t', 'SV Süd', 'TSV West', 1, 1); COMMIT;" \
           "SELECT pg_sleep($(rnd)); SELECT 'B:' || harness.complete('olli', '$t', 'A', '$R_CLEAN', '{}', '[]', '{}', \$J\$$s\$J\$::jsonb, false);"
      ra="$(pick A "$RACE_A")"; rb="$(pick B "$RACE_B")"; g="$(gc "$t" A)"
      [[ "$ra" == "accepted" && ( ( "$rb" == "rejected:STALE_VERSION" && "$g" == "none" ) || ( "$rb" == "ok" && "$g" == "stale" ) ) ]] || RACE_BAD="$RACE_BAD $rt#$i($ra/$rb/$g)" ;;
    RT-12)
      t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"; v="$(version "$t")"
      d="$(dec offline-west "$t" A shootout "SV Süd,TSV West" "TSV West,SV Süd" 4 3)"
      race "SELECT pg_sleep($(rnd)); BEGIN; SELECT 1 FROM public.tournaments WHERE id = '$t' FOR UPDATE; SELECT pg_sleep(0.3);
            SELECT 'A:' || harness.decide('maria', '$t', 'decide', harness.dec('tabelle-maria', '$t', 'A', 'shootout', 'SV Süd,TSV West', 'SV Süd,TSV West', 5, 4), NULL, $v); COMMIT;" \
           "SELECT pg_sleep($(rnd)); SELECT 'B:' || harness.complete('olli', '$t', 'A', '$R_WEST', '{}', \$J\$[$d]\$J\$::jsonb, '{}', \$J\$$s\$J\$::jsonb, true);"
      ra="$(pick A "$RACE_A")"; rb="$(pick B "$RACE_B")"; g="$(gc "$t" A)"
      [[ "$(ndec "$t")" == "1" && ( ( "$ra" == "ok" && "$rb" == "clarification:DECIDED_ELSEWHERE" && "$g" == "none" ) \
         || ( "$rb" == "ok" && "$ra" == "rejected:STALE" && "$g" == "completed" ) ) ]] || RACE_BAD="$RACE_BAD $rt#$i($ra/$rb/$g)" ;;
    RT-15)
      t="$(clone "$TPL_TIE")"; s="$(state "$t" A)"
      d="$(dec tabelle-west "$t" A shootout "SV Süd,TSV West" "TSV West,SV Süd" 4 3)"
      decide olli "$t" decide "$d" "" "$(version "$t")" >/dev/null; v="$(version "$t")"
      race "SELECT pg_sleep($(rnd)); BEGIN; SELECT 1 FROM public.tournaments WHERE id = '$t' FOR UPDATE; SELECT pg_sleep(0.3);
            SELECT 'A:' || harness.decide('maria', '$t', 'withdraw', \$J\$$d\$J\$::jsonb, NULL, $v); COMMIT;" \
           "SELECT pg_sleep($(rnd)); SELECT 'B:' || harness.complete('olli', '$t', 'A', '$R_WEST', '{}', \$J\$[$d]\$J\$::jsonb, '{tabelle-west}', \$J\$$s\$J\$::jsonb, false);"
      ra="$(pick A "$RACE_A")"; rb="$(pick B "$RACE_B")"; g="$(gc "$t" A)"
      [[ ( "$ra" == "ok" && "$rb" == "rejected:DECIDED_ELSEWHERE" && "$g" == "none" && "$(ndec "$t")" == "0" ) \
         || ( "$rb" == "ok" && "$ra" == "rejected:WITHDRAW_NOT_ALLOWED" && "$g" == "completed" && "$(ndec "$t")" == "1" ) ]] || RACE_BAD="$RACE_BAD $rt#$i($ra/$rb/$g)" ;;
    RT-16)
      t="$(clone "$TPL_DIRECT")"; s="$(state "$t" A)"; m="$(gm "$t" 'SV Süd' 'TSV West')"
      race "SELECT pg_sleep($(rnd)); BEGIN; SELECT 1 FROM public.matches WHERE id = '$m' FOR UPDATE; SELECT pg_sleep(0.3);
            SELECT 'A:' || harness.rpc(harness.p('olli'), false, \$S\$SELECT public.reset_match_results('$t', ARRAY['$m']::uuid[])\$S\$); COMMIT;" \
           "SELECT pg_sleep($(rnd)); SELECT 'B:' || harness.complete('olli', '$t', 'A', '$R_CLEAN', '{}', '[]', '{}', \$J\$$s\$J\$::jsonb, false);"
      ra="$(pick A "$RACE_A")"; rb="$(pick B "$RACE_B")"; g="$(gc "$t" A)"
      [[ "$ra" == "ok" && ( ( "$rb" == "rejected:STALE_VERSION" && "$g" == "none" ) || ( "$rb" == "ok" && "$g" == "stale" ) ) ]] || RACE_BAD="$RACE_BAD $rt#$i($ra/$rb/$g)" ;;
    RT-17a)
      t="$(clone "$TPL_DIRECT")"; s="$(state "$t" A)"; m="$(gm "$t" 'FC Nord' 'SC Ost')"
      race "SELECT pg_sleep($(rnd)); BEGIN; SELECT 1 FROM public.matches WHERE id = '$m' FOR UPDATE; SELECT pg_sleep(0.3);
            SELECT 'A:' || harness.exec(harness.p('olli'), false, \$S\$UPDATE public.matches SET team_a_id = team_b_id, team_b_id = team_a_id WHERE id = '$m'\$S\$); COMMIT;" \
           "SELECT pg_sleep($(rnd)); SELECT 'B:' || harness.complete('olli', '$t', 'A', '$R_CLEAN', '{}', '[]', '{}', \$J\$$s\$J\$::jsonb, false);"
      ra="$(pick A "$RACE_A")"; rb="$(pick B "$RACE_B")"; g="$(gc "$t" A)"
      [[ "$ra" == "ok:1" && ( ( "$rb" == "rejected:STALE_VERSION" && "$g" == "none" ) || ( "$rb" == "ok" && "$g" == "stale" ) ) ]] || RACE_BAD="$RACE_BAD $rt#$i($ra/$rb/$g)" ;;
    RT-17b)
      t="$(clone "$TPL_DIRECT")"; s="$(state "$t" A)"; m="$(q "SELECT harness.hf('$t', 'B1');")"
      race "SELECT pg_sleep($(rnd)); BEGIN; SELECT 1 FROM public.matches WHERE id = '$m' FOR UPDATE; SELECT pg_sleep(0.3);
            SELECT 'A:' || harness.exec(harness.p('olli'), false, \$S\$UPDATE public.matches SET team_b_id = harness.team('$t', 'SC Ost'), slot_b_source = NULL WHERE id = '$m'\$S\$); COMMIT;" \
           "SELECT pg_sleep($(rnd)); SELECT 'B:' || harness.complete('olli', '$t', 'A', '$R_CLEAN', '{}', '[]', '{}', \$J\$$s\$J\$::jsonb, false);"
      ra="$(pick A "$RACE_A")"; rb="$(pick B "$RACE_B")"; g="$(side "$t" B1 B)"
      [[ "$ra" == "ok:1" && "$rb" == "ok" && "$g" == "SC Ost|hand" ]] || RACE_BAD="$RACE_BAD $rt#$i($ra/$rb/$g)" ;;
    RT-5)
      t="$(clone "$TPL_CLEAN")"; s="$(state "$t" A)"
      race "SELECT pg_sleep($(rnd 10)); SELECT 'A:' || harness.complete('olli', '$t', 'A', '$R_CLEAN', '{}', '[]', '{}', \$J\$$s\$J\$::jsonb, false);" \
           "SELECT pg_sleep($(rnd 10)); SELECT 'B:' || harness.complete('maria', '$t', 'A', '$R_CLEAN', '{}', '[]', '{}', \$J\$$s\$J\$::jsonb, false);"
      ra="$(pick A "$RACE_A")"; rb="$(pick B "$RACE_B")"
      [[ "$(printf '%s\n%s\n' "$ra" "$rb" | sort | paste -sd/ -)" == "ok/ok:ALREADY_COMPLETED" && "$(nlog "$t" complete_group)" == "1" && "$(nlog "$t" auto_advance)" == "2" ]] \
        || RACE_BAD="$RACE_BAD $rt#$i($ra/$rb)" ;;
  esac
  [[ "$(deadlocked)" == "ja" ]] && RACE_DEADLOCKS=$((RACE_DEADLOCKS + 1))
  RACE_SEEN="$RACE_SEEN"$'\n'"${ra:-?}/${rb:-?}"
  return 0
}

run_races() { # run_races <Laeufe> <RT ...>
  local runs="$1" rt i
  shift
  for rt in "$@"; do
    RACE_DEADLOCKS=0; RACE_BAD=""; RACE_SEEN=""
    for ((i = 1; i <= runs; i++)); do race_case "$rt" "$i"; done
    echo "    $rt Ausgaenge (Sitzung A/Sitzung B, Anzahl): $(grep -v '^$' <<<"$RACE_SEEN" | sort | uniq -c | awk '{printf "%s x%s; ", $2, $1}')"
    check T "$rt Verklemmungs-Probe: $runs Laeufe in zwei Sitzungen ohne 40P01" "0" "$RACE_DEADLOCKS"
    check T "$rt Verklemmungs-Probe: jeder Ausgang erlaubt (Invariante)" "" "$RACE_BAD"
  done
}

# ---------------------------------------------------------------------------------------------------------
# S: Schema, Rechte, Rechte-Assertions
# ---------------------------------------------------------------------------------------------------------
G1_ASSERTIONS="ci-schema-reader-select-group-completion complete-group-locks-matches-before-tournament group-completion-helpers-no-client-execute group-completion-rpcs-definer-authenticated-only group-completion-tables-no-client-writes group-completion-triggers"
run_schema() {
  local priv names_sql names_sh fn
  check S "Rechte: anon fuehrt keine der 6 RPCs aus, authenticated alle; keine Hilfe in match_engine fuer Client-Rollen" "0|6|0" \
    "$(q "SELECT count(*) FROM unnest(ARRAY['public.record_standing_decision(uuid,text,jsonb,text,integer)', 'public.complete_group(uuid,text,uuid[],integer[],jsonb,text[],jsonb,boolean)', 'public.reopen_group(uuid,text,text,boolean)', 'public.resolve_bracket_notice(bigint)', 'public.resolve_clarification(bigint)', 'public.bracket_log_read(uuid)']) f WHERE has_function_privilege('anon', f, 'EXECUTE');")|$(q "SELECT count(*) FROM unnest(ARRAY['public.record_standing_decision(uuid,text,jsonb,text,integer)', 'public.complete_group(uuid,text,uuid[],integer[],jsonb,text[],jsonb,boolean)', 'public.reopen_group(uuid,text,text,boolean)', 'public.resolve_bracket_notice(bigint)', 'public.resolve_clarification(bigint)', 'public.bracket_log_read(uuid)']) f WHERE has_function_privilege('authenticated', f, 'EXECUTE');")|$(q "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'match_engine' AND p.proname IN ('group_key', 'group_state', 'places_to_play_out', 'same_team_set', 'standing_decision_valid', 'shared_allowed', 'write_side', 'add_notice', 'apply_follow_up', 'conflict_or_reject') AND (has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('anon', p.oid, 'EXECUTE'));")"
  check S "Realtime: group_completions, bracket_notices, clarifications in supabase_realtime, bracket_log nicht" "bracket_notices,clarifications,group_completions" \
    "$(q "SELECT string_agg(tablename, ',' ORDER BY tablename) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('group_completions', 'bracket_notices', 'clarifications', 'bracket_log');")"
  check S "Pruefpunkt 5: 'all' steht im SQL (ohne Kommentare) nur in match_engine.group_key" "1" \
    "$(sed -E 's/--.*$//' "$TARGET_FILE" | grep -c "'all'" || true)"
  check S "Sperrreihenfolge (R-GA4v2-8): reopen_group sperrt Spiele vor dem Abschluss, record_standing_decision nur das Turnier" "ja|ja" \
    "$(q "SELECT CASE WHEN position('ORDER BY m.id FOR UPDATE' IN prosrc) BETWEEN 1 AND position('FROM public.group_completions' IN prosrc) THEN 'ja' ELSE 'nein' END FROM pg_proc WHERE oid = to_regprocedure('public.reopen_group(uuid,text,text,boolean)');")|$(q "SELECT CASE WHEN position('public.matches' IN prosrc) = 0 THEN 'ja' ELSE 'nein' END FROM pg_proc WHERE oid = to_regprocedure('public.record_standing_decision(uuid,text,jsonb,text,integer)');")"
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  # A-16 (20261110_008), Spiel beenden (20261110_009), B-48b (20261113_101) und B-14 (20261117_104) laufen hier erst am Ende
  # (AFTER) -- ihre Zeilen helper-join-*, append-match-events-end-by-lead-without-claim, monitor-heartbeat-* und public-read-*
  # sind an dieser Stelle f (wie in den uebrigen Container-Skripten).
  check S "Rechte-Assertion: keine Zeile |f (ausser Zeilen der spaeteren Migrationen 20261110_008, 20261110_009, 20261113_101, 20261117_104)" "" \
    "$(grep -v '|t$' <<<"$priv" | grep -vE '^(helper-join-|append-match-events-end-by-lead-without-claim\||public-read-|monitor-heartbeat-)' || true)"
  check S "Rechte-Assertion: die 6 A-13b-S-Zeilen vorhanden und |t" "$(tr ' ' '\n' <<<"$G1_ASSERTIONS" | sed 's/$/|t/' | sort | paste -sd, -)" \
    "$(grep -E "^($(tr ' ' '|' <<<"$G1_ASSERTIONS"))\|" <<<"$priv" | sort | paste -sd, -)"
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Lehre A-30a: Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
  check S "Drift-Check-Zuordnung: pending_assertions_for nennt fuer $TARGET_NAME genau die 6 neuen Namen" "$G1_ASSERTIONS" \
    "$(awk -v n="    $TARGET_NAME)" 'index($0, n) == 1 {getline; print; exit}' "$REPO_ROOT/scripts/db-drift-check.sh" | sed -E 's/^ *echo "//; s/"$//' | tr ' ' '\n' | sort | paste -sd' ' -)"
  # Leserolle des Drift-Checks (Daniel 21.10.): pg_dump --schema-only als Login-Rolle IN ROLE ci_schema_reader (per TCP wie
  # der Drift-Check) ueber die vier neuen Tabellen. Nur diese vier: in der Migrationskette fehlt der Rolle das SELECT auf die
  # Baseline-Tabellen, das live das Datenbank-Programm (21.09.) vergeben hat. Vorher-Zustand: SELECT kurz entzogen -> rot; danach wieder vergeben -> gruen; Rechte danach wie vorher.
  local acl_before dump_rc
  q "DO \$r\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'drift_probe') THEN
       CREATE ROLE drift_probe LOGIN PASSWORD 'drift' IN ROLE ci_schema_reader; END IF; END \$r\$;" >/dev/null
  acl_before="$(q "SELECT string_agg(relname || ':' || relacl::text, ',' ORDER BY relname) FROM pg_class WHERE oid IN ('public.group_completions'::regclass, 'public.bracket_log'::regclass, 'public.bracket_notices'::regclass, 'public.clarifications'::regclass);")"
  q "REVOKE SELECT ON TABLE public.group_completions, public.bracket_log, public.bracket_notices, public.clarifications FROM ci_schema_reader;" >/dev/null
  dump_rc="$(docker exec -e PGPASSWORD=drift "$CURRENT_CONTAINER" pg_dump -h 127.0.0.1 -U drift_probe --schema-only -t public.group_completions -t public.bracket_log -t public.bracket_notices -t public.clarifications postgres >/dev/null 2>"$WORK_DIR/dump.err"; echo "$?|$(grep -o 'permission denied for table [a-z_]*' "$WORK_DIR/dump.err" | head -1)")"
  check S "Leserolle vorher (ohne GRANT): pg_dump --schema-only als Login-Rolle IN ROLE ci_schema_reader bricht ab" "1|permission denied for table group_completions" "$dump_rc"
  q "GRANT SELECT ON TABLE public.group_completions, public.bracket_log, public.bracket_notices, public.clarifications TO ci_schema_reader;" >/dev/null
  dump_rc="$(docker exec -e PGPASSWORD=drift "$CURRENT_CONTAINER" pg_dump -h 127.0.0.1 -U drift_probe --schema-only -t public.group_completions -t public.bracket_log -t public.bracket_notices -t public.clarifications postgres >/dev/null 2>"$WORK_DIR/dump.err"; echo "$?")"
  check S "Leserolle mit dem GRANT aus 20261110_006: pg_dump --schema-only der vier Tabellen laeuft (Exit 0), Rechte wie vorher" "0|gleich" \
    "$dump_rc|$([[ "$(q "SELECT string_agg(relname || ':' || relacl::text, ',' ORDER BY relname) FROM pg_class WHERE oid IN ('public.group_completions'::regclass, 'public.bracket_log'::regclass, 'public.bracket_notices'::regclass, 'public.clarifications'::regclass);")" == "$acl_before" ]] && echo gleich || echo verschieden)"
  check S "Leserolle sieht keine Zeile (RLS an, keine Policy fuer ci_schema_reader)" "0" \
    "$(q "SET ROLE ci_schema_reader; SELECT (SELECT count(*) FROM public.group_completions) + (SELECT count(*) FROM public.bracket_log) + (SELECT count(*) FROM public.bracket_notices) + (SELECT count(*) FROM public.clarifications);" | tail -1)"
  for fn in record_standing_decision complete_group reopen_group resolve_bracket_notice resolve_clarification bracket_log_read; do
    check S "plpgsql/sql-Rumpf $fn: SECURITY DEFINER, search_path gesetzt" "true|{\"search_path=public, pg_temp\"}" \
      "$(q "SELECT prosecdef || '|' || proconfig::text FROM pg_proc WHERE proname = '$fn' AND pronamespace = 'public'::regnamespace;")"
  done
}

# ---------------------------------------------------------------------------------------------------------
# Ablauf
# ---------------------------------------------------------------------------------------------------------
# setup_before [fail-fast] -- Baseline + alle Migrationen vor der Ziel-Migration; mit "fail-fast" zuerst ohne _005,
# dann die Ziel-Migration (muss abbrechen und nichts aendern), dann _005.
setup_before() {
  local f held=""
  echo "Baseline + ${#BEFORE[@]} Migration(en) vor $TARGET_NAME einspielen..." >&2
  psql_stdin < "$BASELINE_FILE"
  for f in "${BEFORE[@]}"; do
    if [[ "${1:-}" == "fail-fast" && "$(basename "$f")" == "$PREREQ_NAME" ]]; then
      held="$f"
      continue
    fi
    psql_stdin < "$f"
  done
  if [[ "${1:-}" == "fail-fast" ]]; then
    local out ec
    set +e
    out="$(psql_stdin < "$TARGET_FILE" 2>&1)"
    ec=$?
    set -e
    check F "Migrationsprobe: ohne 20261110_005 bricht 20261110_006 mit „Voraussetzungen fehlen“ ab (psql Exit 3)" "3|ja" \
      "$ec|$(grep -q '20261110_006_group_completion: Voraussetzungen fehlen' <<<"$out" && echo ja || echo "nein: $out")"
    check F "dabei nichts geaendert (keine Tabelle group_completions, keine Spalte reassigned_at, keine Funktion complete_group)" "f|0|f" \
      "$(q "SELECT to_regclass('public.group_completions') IS NOT NULL;")|$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'reassigned_at';")|$(q "SELECT to_regprocedure('public.complete_group(uuid,text,uuid[],integer[],jsonb,text[],jsonb,boolean)') IS NOT NULL;")"
    psql_stdin < "$held"
  fi
  echo "Daten und Vorlagen anlegen..." >&2
  setup_data
  setup_templates
}

run_all_sequential() {
  run_twins
  run_pflicht
  run_rt_seq
}

data_fingerprint() {
  q "SELECT md5(coalesce((SELECT string_agg(id::text || coalesce(team_a_id::text, '-') || coalesce(team_b_id::text, '-') || coalesce(slot_a_source::text, '-') || coalesce(slot_b_source::text, '-') || coalesce(reassigned_at::text, '-'), ',' ORDER BY id) FROM public.matches), '')
          || coalesce((SELECT string_agg(to_jsonb(g)::text, ',' ORDER BY tournament_id, group_id) FROM public.group_completions g), '')
          || (SELECT count(*) FROM public.bracket_log)::text || (SELECT count(*) FROM public.bracket_notices)::text
          || (SELECT count(*) FROM public.clarifications)::text);"
}

# ---------------------------------------------------------------------------------------------------------
# Gegenprobe: ohne Migration und je Mutation (Plan A-13b-S MG1-MG16, Bau MB1/MB2) -- ein Container, zwischen den
# Varianten der Rueckweg (Kategorie X belegt, dass er das Schema genau zuruecksetzt)
# ---------------------------------------------------------------------------------------------------------
# mutate <Name> -- Migration mit genau einer Aenderung auf stdout (jede Ersetzung muss genau einmal greifen)
mutate() {
  MUT_KEY="$1" python3 -c '
import os, sys
s = sys.stdin.read()
M = {
  "MG1": [("  IF v_open > 0 THEN\n    RETURN jsonb_build_object(\x27status\x27, \x27rejected\x27, \x27code\x27, \x27OPEN_MATCHES\x27, \x27open\x27, v_open);\n  END IF;\n", "")],
  "MG2": [("  IF v_expected IS DISTINCT FROM v_state THEN", "  IF false THEN")],
  "MG3": [("\x27a\x27, m.score_a, \x27b\x27, m.score_b,", "")],
  "MG4": [("  SELECT NOT (p_places && match_engine.places_to_play_out(p_config))\n     AND NOT EXISTS (", "  SELECT NOT EXISTS (")],
  "MG5": [("\n                    AND NOT ((x ->> \x27id\x27) = ANY (coalesce(p_known_decision_ids, \x27{}\x27::text[])))) THEN", ") THEN")],
  "MG6": [("    IF EXISTS (SELECT 1 FROM public.group_completions gc\n                WHERE gc.tournament_id = p_tournament_id AND gc.group_id = v_old ->> \x27groupId\x27\n                  AND gc.reopened_at IS NULL) THEN", "    IF false THEN")],
  "MG7": [("\nCOMMIT;\n", "\nGRANT SELECT ON public.bracket_log TO anon;\nCOMMIT;\n")],
  "MG8": [("  IF v_manual OR v_started THEN", "  IF v_started THEN")],
  "MG9": [("  IF cardinality(v_open_ranks) > 0 AND NOT (v_had_prev AND v_prev.stale AND NOT v_reopened) THEN", "  IF false THEN")],
  "MG10": [("CREATE OR REPLACE FUNCTION public.matches_mark_group_stale() RETURNS trigger\nLANGUAGE plpgsql SECURITY DEFINER", "CREATE OR REPLACE FUNCTION public.matches_mark_group_stale() RETURNS trigger\nLANGUAGE plpgsql")],
  "MG11": [("  IF NOT coalesce(p_from_queue, false) THEN\n    RETURN jsonb_build_object(\x27status\x27, \x27rejected\x27, \x27code\x27, p_code, \x27last\x27, v_last);   -- MG11: hier nie eine Klärung\n  END IF;\n", "")],
  "MG12": [("p_group_letter IN (\x27\x27, \x27all\x27)", "p_group_letter IN (\x27\x27)")],
  "MG13": [("\x27ta\x27, m.team_a_id::text, \x27tb\x27, m.team_b_id::text, ", "")],
  "MG14": [("  PERFORM 1 FROM public.matches m\n   WHERE m.tournament_id = p_tournament_id\n     AND (   (NOT", "  PERFORM 1 FROM public.tournaments WHERE id = p_tournament_id FOR UPDATE;\n  PERFORM 1 FROM public.matches m\n   WHERE m.tournament_id = p_tournament_id\n     AND (   (NOT")],
  "MG15": [("CREATE TRIGGER tournaments_keep_standing_decisions\n  BEFORE UPDATE OF config ON public.tournaments\n  FOR EACH ROW EXECUTE FUNCTION public.tournaments_keep_standing_decisions();\n", "")],
  "MG16": [("    AND CASE WHEN jsonb_array_length(p -> \x27teamIds\x27) = 2 THEN p ->> \x27kind\x27 IN (\x27shootout\x27, \x27shared\x27)\n             ELSE p ->> \x27kind\x27 IN (\x27order\x27, \x27shared\x27) END\n", "    AND p ->> \x27kind\x27 IN (\x27shootout\x27, \x27order\x27, \x27shared\x27)\n")],
  "MG17": [("NOT IN (\x27scheduled\x27, \x27waiting\x27);  -- paused", "NOT IN (\x27scheduled\x27, \x27waiting\x27, \x27paused\x27);  -- MUT paused")],
  "MG18": [("  IF p_from_queue AND v_reopened AND v_prev.reopened_by IS DISTINCT FROM v_uid THEN", "  IF p_from_queue AND v_reopened THEN")],
  "MG19": [("GRANT SELECT ON TABLE public.group_completions, public.bracket_log, public.bracket_notices, public.clarifications\n  TO ci_schema_reader;\n", "")],
  "MB1": [("      IF d ->> \x27kind\x27 = \x27order\x27 AND NOT (d ? \x27reason\x27) THEN", "      IF false THEN")],
  "MB2": [("      IF EXISTS (SELECT 1 FROM public.bracket_log l\n                  WHERE l.tournament_id = p_tournament_id AND l.kind = \x27standing_withdraw\x27\n                    AND l.detail ->> \x27id\x27 = d ->> \x27id\x27) THEN", "      IF false THEN")],
}
for frm, to in M[os.environ["MUT_KEY"]]:
    if s.count(frm) != 1:
        sys.exit("Gegenprobe: Muster in %s nicht genau einmal (%d): %r" % (os.environ["MUT_KEY"], s.count(frm), frm[:70]))
    s = s.replace(frm, to)
sys.stdout.write(s)' < "$TARGET_FILE"
}

# Erwartete rote Pruefung je Variante (Plan A-13b-S, Spalte „wird rot“; Teil des Pruefungsnamens)
expected_red() {
  case "$1" in
    OHNE) echo "P-1 @TM-046 Olli schliesst Gruppe A ab" ;;
    MG1) echo "P-2 @TM-054" ;;
    MG2) echo "RT-2 @TM-116 Z1 online" ;;
    MG3) echo "P-7 @TM-146 Z2" ;;
    MG4) echo "P-7/RT-13 @TM-147 Z3" ;;
    MG5) echo "P-7 @TM-146 Z1 die bekannte" ;;
    MG6) echo "P-8 @W2A-070 nach dem Abschluss" ;;
    MG7) echo "P-9 @W2A-072 anon: SELECT bracket_log" ;;
    MG8) echo "P-6 @TM-099 erneuter Abschluss" ;;
    MG9) echo "P-3 @TM-049" ;;
    MG10) echo "RT-17 @TM-071 Team im Gruppenspiel tauschen" ;;
    MG11) echo "RT-2 @TM-116 Z1 online" ;;
    MG12) echo "P-10 @TM-057 complete_group('')" ;;
    MG13) echo "RT-18" ;;
    MG14) echo "Verklemmungs-Probe: $RACE_RUNS Laeufe in zwei Sitzungen ohne 40P01" ;;
    MG15) echo "P-11 standingDecisions bleibt der Serverwert" ;;
    MG16) echo "standing-decision-shapes.json: 2 Teams Reihenfolge" ;;
    MG17) echo "P-5b Gegenbeispiel" ;;
    MG18) echo "RT-10b @TM-148 Gegenbeispiel" ;;
    MG19) echo "Rechte-Assertion: die 6 A-13b-S-Zeilen vorhanden und |t" ;;
    MB1) echo "P-7 B1 neue Reihenfolge" ;;
    MB2) echo "RT-15 B2" ;;
  esac
}

if [[ "$MODE" == "gegenprobe" ]]; then
  VARIANTS=(OHNE MG1 MG2 MG3 MG4 MG5 MG6 MG7 MG8 MG9 MG10 MG11 MG12 MG13 MG14 MG15 MG16 MG17 MG18 MG19 MB1 MB2)
  if [[ -n "${GEGENPROBE_NUR:-}" ]]; then read -r -a VARIANTS <<<"$GEGENPROBE_NUR"; fi
  start_container gegenprobe
  setup_before
  RED_OK=0
  APPLIED=0
  for variant in "${VARIANTS[@]}"; do
    if [[ "$APPLIED" -eq 1 ]]; then rueckweg_sql | psql_stdin >/dev/null; APPLIED=0; fi
    if [[ "$variant" != "OHNE" ]]; then
      mutate "$variant" > "$WORK_DIR/mutation.sql"
      psql_stdin < "$WORK_DIR/mutation.sql" >/dev/null
      APPLIED=1
    fi
    reset_counts
    echo "--- GEGENPROBE $variant ---"
    if [[ "$variant" == "MG14" ]]; then
      run_races "$RACE_RUNS" RT-16 RT-17a
    else
      run_all_sequential
      [[ "$variant" == "MB2" ]] && run_races 5 RT-15
      [[ "$variant" == "MG19" ]] && run_schema
    fi
    want="$(expected_red "$variant")"
    if grep -qF -- "$want" <<<"$FAILED"; then
      echo "GEGENPROBE $variant: rot ($(total_dev) Abweichung(en)), erwartete Pruefung rot: $want"
      RED_OK=$((RED_OK + 1))
    else
      echo "::error::GEGENPROBE $variant: erwartete Pruefung blieb gruen ($want); rot waren: $(tr '\n' ';' <<<"$FAILED")"
    fi
  done
  echo
  echo "Gegenprobe: $RED_OK von ${#VARIANTS[@]} Varianten an der erwarteten Pruefung rot."
  [[ "$RED_OK" -eq "${#VARIANTS[@]}" ]]
  exit $?
fi

start_container normal
setup_before fail-fast

DUMP_BEFORE="$(schema_dump)"
COUNTS_BEFORE="$(counts "$(schema_public)")"
DATA_BEFORE="$(q "SELECT (SELECT count(*) FROM public.matches) || '|' || (SELECT count(*) FROM public.match_events) || '|' || (SELECT count(*) FROM public.tournaments);")"
echo "Migration einspielen..." >&2
psql_stdin < "$TARGET_FILE"

check S "Bestand: Spiele, Ereignisse, Turniere gleich viele (keine Aenderung an Bestandszeilen)" "$DATA_BEFORE" \
  "$(q "SELECT (SELECT count(*) FROM public.matches) || '|' || (SELECT count(*) FROM public.match_events) || '|' || (SELECT count(*) FROM public.tournaments);")"
COUNTS_AFTER="$(counts "$(schema_public)")"
# Erwartung aus der Migration: 4 Tabellen; Spalten 1 (reassigned_at) + 11 + 9 + 10 + 12; 9 Funktionen in public;
# 3 Trigger; 3 Policies; Indizes 4 Primaerschluessel + 3 explizite; 4 Tabellen mit RLS.
for pair in tables:4 columns:43 functions:9 triggers:3 policies:3 indexes:7 rls_tables:4; do
  dim="${pair%%:*}"
  check S "Katalogzaehlung $dim: Zuwachs" "${pair#*:}" $(( $(count_of "$COUNTS_AFTER" "$dim") - $(count_of "$COUNTS_BEFORE" "$dim") ))
done
check S "match_engine: 10 neue Hilfen" "10" \
  "$(q "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'match_engine' AND p.proname IN ('group_key', 'group_state', 'places_to_play_out', 'same_team_set', 'standing_decision_valid', 'shared_allowed', 'write_side', 'add_notice', 'apply_follow_up', 'conflict_or_reject');")"
DUMP_AFTER="$(schema_dump)"

run_schema
run_all_sequential
run_races 10 RT-5
run_races "$RACE_RUNS" RT-2 RT-12 RT-15 RT-16 RT-17a RT-17b

# --- W: idempotent -----------------------------------------------------------------------------------------
DATA_W="$(data_fingerprint)"
set +e
psql_stdin < "$TARGET_FILE" >/dev/null 2>&1
W_EXIT=$?
set -e
check W "Migrationsprobe: zweites Einspielen laeuft (Exit 0)" "0" "$W_EXIT"
check W "danach Daten (Spiele, Abschluesse, Verlauf, Hinweise, Klaerungen) und Schema (public + match_engine) unveraendert" "gleich|identisch" \
  "$([[ "$(data_fingerprint)" == "$DATA_W" ]] && echo gleich || echo verschieden)|$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

# --- X: Rueckweg ---------------------------------------------------------------------------------------------
set +e
X_OUT="$(rueckweg_sql | psql_stdin 2>&1)"
X_EXIT=$?
set -e
check X "Migrationsprobe: Rueckweg-Block aus dem Kopf der Migration laeuft (Exit 0)" "0" "$X_EXIT"
[[ "$X_EXIT" -eq 0 ]] || echo "$X_OUT" | tail -5
DUMP_ROLLED_BACK="$(schema_dump)"
check X "nach dem Rueckweg: Schema public + match_engine = vor der Migration (pg_dump identisch)" "identisch" \
  "$([[ "$DUMP_ROLLED_BACK" == "$DUMP_BEFORE" ]] && echo identisch || echo verschieden)"
if [[ "$DUMP_ROLLED_BACK" != "$DUMP_BEFORE" ]]; then
  diff <(echo "$DUMP_BEFORE") <(echo "$DUMP_ROLLED_BACK") | head -40 || true
fi
check X "nach dem Rueckweg: Publication ohne die drei Tabellen" "0" \
  "$(q "SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('group_completions', 'bracket_notices', 'clarifications');")"
psql_stdin < "$TARGET_FILE"
check X "danach erneut einspielbar (Schema = erstes Einspielen)" "identisch" "$([[ "$(schema_dump)" == "$DUMP_AFTER" ]] && echo identisch || echo verschieden)"

for f in ${AFTER[@]+"${AFTER[@]}"}; do
  psql_stdin < "$f"
  echo "OK    spaetere Migration laeuft: $(basename "$f")" >&2
done

# --- 20261110_010 (Cloud-E2E N6d, @ET-055, @W2A-067): ein Turnier ohne Version (version IS NULL, etwa vom Seed) gilt als
# Version 0. Vorher lehnte record_standing_decision jede Entscheidung dafuer als STALE ab (NULL IS DISTINCT FROM 0).
if [[ -f "$MIGRATIONS_DIR/20261110_010_standing_decision_null_version.sql" ]]; then
  t="$(clone "$TPL_NIKO")"
  q "UPDATE public.tournaments SET version = NULL WHERE id = '$t';" >/dev/null
  dn="$(dec ohne-version "$t" '' shootout "TSV Petting,DJK Otting" "DJK Otting,TSV Petting" 4 3)"
  check P "P-12 @ET-055 Nikolaus ohne Version: Gegenbeispiel erwartete Version 5 -> STALE (gemeldete Version 0), nichts geschrieben" "rejected:STALE|0|0" \
    "$(decide olli "$t" decide "$dn" "" 5)|$(lastres | jq -r '.version')|$(ndec "$t")"
  check P "P-12 @ET-055 Nikolaus ohne Version: 4:3 fuer Otting mit erwarteter Version 0 wird angenommen, danach Version 1" "ok|1|1" \
    "$(decide olli "$t" decide "$dn" "" 0)|$(ndec "$t")|$(version "$t")"
  check P "P-12 @ET-055 Wiederholung nach verlorener Antwort: ALREADY_APPLIED mit Zahl als Version" "ok:ALREADY_APPLIED|1" \
    "$(decide olli "$t" decide "$dn" "" 0)|$(lastres | jq -r '.version')"
  # Review #361 (Luecke P-12): beide ALREADY_APPLIED-Zweige auch auf einer Zeile OHNE Version -- die Antwort traegt die Zahl 0
  # (coalesce), nie null (der Client verlangt eine Zahl).
  q "UPDATE public.tournaments SET version = NULL WHERE id = '$t';" >/dev/null
  check P "P-12 @ET-055 ohne Version: Wiederholung des Eintragens -> ALREADY_APPLIED mit Version 0 (Zahl)" "ok:ALREADY_APPLIED|0|number" \
    "$(decide olli "$t" decide "$dn" "" 0)|$(lastres | jq -r '.version')|$(lastres | jq -r '.version | type')"
  check P "P-12 @ET-055 ohne Version: Zuruecknehmen mit erwarteter Version 0 wird angenommen" "ok|0" \
    "$(decide olli "$t" withdraw "$dn" "" 0)|$(ndec "$t")"
  q "UPDATE public.tournaments SET version = NULL WHERE id = '$t';" >/dev/null
  check P "P-12 @ET-055 ohne Version: Wiederholung des Zuruecknehmens -> ALREADY_APPLIED mit Version 0 (Zahl)" "ok:ALREADY_APPLIED|0|number" \
    "$(decide olli "$t" withdraw "$dn" "" 0)|$(lastres | jq -r '.version')|$(lastres | jq -r '.version | type')"
fi

summary
echo
echo "Ergebnis: $(total_dev) Abweichung(en)."
[[ "$(total_dev)" -eq 0 ]]
