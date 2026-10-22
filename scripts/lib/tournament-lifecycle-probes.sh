# shellcheck shell=bash
#
# scripts/lib/tournament-lifecycle-probes.sh — Proben fuer scripts/tournament-lifecycle-check.sh (A-21a-S). Per `source`
# eingebunden; nutzt q, psql_stdin, check, CURRENT_CONTAINER, REPO_ROOT, FIX_DIR, WORK_DIR des Hauptskripts.
# Erwartungen aus dem Gherkin der genannten Kennungen bzw. dem Plan (P-0 … P-13), nie aus dem Code abgelesen.

NIKO="DJK Kammer|TSV Waging rot|2|1;DJK Kammer|TSV Petting|2|2;DJK Otting|DJK Kammer|2|1;DJK Kammer|TSV 1921 Fridolfing|2|0"
NIKO="$NIKO;DJK Kammer|TSV Waging blau|3|0;TSV Waging rot|DJK Otting|2|2;TSV Waging rot|TSV Petting|4|0"
NIKO="$NIKO;TSV Waging rot|TSV 1921 Fridolfing|3|0;TSV Waging rot|TSV Waging blau|3|0;TSV Petting|DJK Otting|1|1"
NIKO="$NIKO;TSV Petting|TSV 1921 Fridolfing|3|1;TSV Petting|TSV Waging blau|3|1;DJK Otting|TSV Waging blau|3|1"
NIKO="$NIKO;TSV 1921 Fridolfing|DJK Otting|4|1;TSV 1921 Fridolfing|TSV Waging blau|1|1"
R_NIKO="DJK Kammer,TSV Waging rot,TSV Petting,DJK Otting,TSV 1921 Fridolfing,TSV Waging blau"
P_NIKO="{1,2,3,3,5,6}"   # Petting und Otting „Ergebnis so akzeptieren“ (final-standings-roundrobin.json, 2. Fall)
A_CLEAN="FC Nord|SV Süd|2|1;FC Nord|TSV West|2|1;FC Nord|SC Ost|0|0;SV Süd|TSV West|2|1;SV Süd|SC Ost|2|0;TSV West|SC Ost|2|0"
B_CLEAN="SG Mitte|DJK Berg|2|1;SG Mitte|VfB Ufer|2|1;SG Mitte|TuS Tal|3|0;DJK Berg|VfB Ufer|2|1;DJK Berg|TuS Tal|2|0;VfB Ufer|TuS Tal|2|0"
R_A="FC Nord,SV Süd,TSV West,SC Ost"
R_B="SG Mitte,DJK Berg,VfB Ufer,TuS Tal"
# Endstand Hallencup Nord: Finale Nord 2:1 Mitte, Spiel um Platz 3 DJK Berg gewertet (SV Süd nicht angetreten, @LZ-016)
R_HC="FC Nord,SG Mitte,DJK Berg,SV Süd,TSV West,VfB Ufer,SC Ost,TuS Tal"
P_HC="{1,2,3,4,5,6,7,8}"

setup_data() {
  psql_stdin < "$REPO_ROOT/scripts/lib/group-completion-harness.sql" >/dev/null
  { printf "INSERT INTO harness.doc VALUES ('group-state', \$J\$"; cat "$FIX_DIR/group-state.json"; printf "\$J\$::jsonb);\n"; } | psql_stdin
  local owner
  owner="$(jq -r '.owner' "$FIX_DIR/group-state.json")"
  psql_stdin <<SQL
INSERT INTO harness.people VALUES
  ('olli', '$owner', false, NULL, NULL),
  ('maria', md5('a21as:maria')::uuid, false, 'co-admin', 'Maria'),
  ('tom', md5('a21as:tom')::uuid, true, 'helper', 'Tom'),
  ('kai', md5('a21as:kai')::uuid, false, 'collaborator', 'Kai'),
  ('bildschirm', md5('a21as:bildschirm')::uuid, true, 'screen', 'Hallen-Monitor'),
  ('fremd', md5('a21as:fremd')::uuid, false, NULL, NULL);
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       CASE WHEN anon THEN NULL ELSE name || '@a21as.test' END, 'x', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
  FROM harness.people;
INSERT INTO public.profiles (id, display_name, email)
SELECT id, initcap(name), name || '@a21as.test' FROM harness.people WHERE NOT anon
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;
-- Altbestand fuer den Backfill (R-EA-11, F9)
INSERT INTO public.tournaments (owner_id, title, date, number_of_teams, group_phase_duration, status, config) VALUES
  ('$owner', 'Alt-1-published', '2026-09-01', 4, 10, 'published', '{}'),
  ('$owner', 'Alt-2-draft', '2026-09-01', 4, 10, 'draft', '{}'),
  ('$owner', 'Alt-3-live', '2026-09-01', 4, 10, 'live', '{}'),
  ('$owner', 'Alt-4-completed', '2026-09-01', 4, 10, 'completed', '{"manuallyCompleted": true, "dashboardStatus": "finished"}');
SQL
  psql_stdin < "$REPO_ROOT/scripts/lib/tournament-lifecycle-harness.sql" >/dev/null
  setup_templates
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
complete_group_as() { # complete_group_as <tid> <Gruppe> <Rangfolge>
  q "SELECT harness.complete('olli', '$1', '$2', '$3', '{}', '[]', '{}', harness.state('$1', '$2'), false);"
}

setup_templates() {
  TPL_NIKO="$(q "SELECT harness.instantiate('nikolaus', 'vorlage-nikolaus');")"
  entries "$TPL_NIKO" olli "$NIKO"
  TPL_HC="$(q "SELECT harness.instantiate('hallencup', 'vorlage-hallencup');")"
  entries "$TPL_HC" olli "$A_CLEAN"
  entries "$TPL_HC" olli "$B_CLEAN"
  [[ "$(complete_group_as "$TPL_HC" A "$R_A")|$(complete_group_as "$TPL_HC" B "$R_B")" == "ok|ok" ]] \
    || { echo "::error::Vorlage Hallencup: Gruppen nicht abgeschlossen" >&2; exit 1; }
  q "SELECT lc.set_result(harness.hf('$TPL_HC', 'A1'), 2, 1);
     SELECT lc.set_result(harness.hf('$TPL_HC', 'B1'), 3, 1);
     UPDATE public.matches SET team_a_id = harness.team('$TPL_HC', 'DJK Berg'), team_b_id = harness.team('$TPL_HC', 'SV Süd'),
            score_a = 2, score_b = 0, match_status = 'finished', decided_by = 'forfeit', forfeit_absent = 'B'
      WHERE id = lc.final('$TPL_HC', 'thirdPlace');
     UPDATE public.matches SET team_a_id = harness.team('$TPL_HC', 'FC Nord'), team_b_id = harness.team('$TPL_HC', 'SG Mitte')
      WHERE id = lc.final('$TPL_HC', 'final');
     SELECT lc.set_result(lc.final('$TPL_HC', 'final'), 2, 1);" >/dev/null
}
setup_after() { :; }

clone() {
  local out
  out="$(q "SELECT harness.clone('$1', 'probe-' || md5(random()::text || clock_timestamp()::text));")"
  if [[ ! "$out" =~ ^[0-9a-f-]{36}$ ]]; then
    echo "::error::Kopie der Vorlage $1 gescheitert: $out" >&2
    exit 1
  fi
  echo "$out"
}
niko_ready() { # Nikolaus, alle 15 Spiele entschieden, Gruppe '' abgeschlossen (Petting/Otting geteilt)
  local t
  t="$(clone "$TPL_NIKO")"
  [[ "$(q "SELECT lc.complete_niko('$t');")" == "ok" ]] || { echo "::error::Nikolaus: Gruppe nicht abgeschlossen" >&2; exit 1; }
  echo "$t"
}
hc_ready() { # Hallencup Nord, alles entschieden, Gruppen A und B abgeschlossen
  local t
  t="$(clone "$TPL_HC")"
  [[ "$(complete_group_as "$t" A "$R_A")|$(complete_group_as "$t" B "$R_B")" == "ok|ok" ]] \
    || { echo "::error::Hallencup: Gruppen nicht abgeschlossen" >&2; exit 1; }
  echo "$t"
}
rid() { q "SELECT gen_random_uuid();"; }
make_public() {
  q "UPDATE public.tournaments SET is_public = true, share_code = upper(substr(md5(id::text), 1, 6)), share_code_created_at = now(),
            config = config || '{\"publishedAt\": \"2026-10-01T00:00:00.000Z\"}'::jsonb WHERE id = '$1';" >/dev/null
}
code_of() { q "SELECT share_code FROM public.tournaments WHERE id = '$1';"; }
fin_niko() { # fin_niko <Person> <tid> [Plaetze] [Rangfolge] [request_id] -> Kurzform
  q "SELECT lc.finish('$1', '$2', lc.snap('$2', '${4:-$R_NIKO}', '${3:-$P_NIKO}', 'group', lc.scorers('$2')), '${5:-$(rid)}');"
}
fin_hc() { q "SELECT lc.finish('$1', '$2', lc.snap('$2', '${3:-$R_HC}', '$P_HC', '${4:-hc}'), '$(rid)');"; }
last() { q "SELECT harness.last()::text;"; }
reason() { q "SELECT harness.last() ->> 'reason';"; }
as_exec() { q "SELECT harness.exec(harness.p('$1'), harness.pa('$1'), \$S\$$2\$S\$);"; }
as_val() { q "SELECT harness.val(harness.p('$1'), harness.pa('$1'), \$S\$$2\$S\$);"; }
anon_val() { q "SELECT harness.val(NULL, false, \$S\$$1\$S\$, 'anon');"; }
life() { q "SELECT lc.life('$1');"; }
fs_md5() { q "SELECT coalesce(md5(snapshot::text), 'kein') FROM (SELECT 1) x LEFT JOIN public.tournament_final_standings ON tournament_id = '$1';"; }
nlog() { q "SELECT count(*) FROM public.tournament_lifecycle_log WHERE tournament_id = '$1'${2:+ AND kind = '$2'};"; }
nlate() { q "SELECT count(*) FROM public.late_entries WHERE tournament_id = '$1';"; }
gm() { q "SELECT harness.gm('$1', '$2', '$3');"; }

# ---------------------------------------------------------------------------------------------------------
# G: Gleichlauf-Fixtures, SQL-Seite
# ---------------------------------------------------------------------------------------------------------
run_twins() {
  local n i row got exp name
  # final-standings-shapes.json (A-20a-Vertrag, jede Grenzzeile)
  n="$(jq '.rows | length' "$FIX_DIR/final-standings-shapes.json")"
  for ((i = 0; i < n; i++)); do
    row="$(jq -c ".rows[$i]" "$FIX_DIR/final-standings-shapes.json")"
    name="$(jq -r '.name' <<<"$row")"
    got="$(q "SELECT match_engine.final_standings_shape_valid(\$J\$$row\$J\$::jsonb -> 'snapshot');")"
    check G "final-standings-shapes.json: $name" "$(jq -r 'if .valid then "t" else "f" end' <<<"$row")" "$got"
  done
  # final-standings-roundrobin.json 'validity' (Platzziffern-Regel)
  n="$(jq '.validity | length' "$FIX_DIR/final-standings-roundrobin.json")"
  for ((i = 0; i < n; i++)); do
    row="$(jq -c ".validity[$i]" "$FIX_DIR/final-standings-roundrobin.json")"
    got="$(q "SELECT match_engine.place_numbers_valid(ARRAY(SELECT jsonb_array_elements_text(\$J\$$row\$J\$::jsonb -> 'places')::integer));")"
    check G "final-standings-roundrobin.json validity: $(jq -r '.name' <<<"$row")" "$(jq -r 'if .valid then "t" else "f" end' <<<"$row")" "$got"
  done
  # final-standings-roundrobin.json 'cases': Gruppenabschluss + geteilte Bloecke -> Platzziffern (Server-Pruefung P-8)
  n="$(jq '.cases | length' "$FIX_DIR/final-standings-roundrobin.json")"
  for ((i = 0; i < n; i++)); do
    row="$(jq -c ".cases[$i]" "$FIX_DIR/final-standings-roundrobin.json")"
    got="$(q "BEGIN; SELECT lc.rr_case(\$J\$$row\$J\$::jsonb); ROLLBACK;" | grep -v '^$' | tail -1)"
    check G "final-standings-roundrobin.json case: $(jq -r '.name' <<<"$row") (Platzziffern stimmig | Sprung entfernt -> GROUP_PLACES)" \
      "$(jq -r 'if (.places | . == [range(1; length + 1)]) then "ok|ok" else "ok|GROUP_PLACES" end' <<<"$row")" "$got"
  done
  # tournament-state.json (Zwilling expectedTournamentState, A-21a-C1)
  n="$(jq '.cases | length' "$FIX_DIR/tournament-state.json")"
  for ((i = 0; i < n; i++)); do
    row="$(jq -c ".cases[$i]" "$FIX_DIR/tournament-state.json")"
    got="$(q "BEGIN; SELECT CASE WHEN lc.state_case(\$J\$$row\$J\$::jsonb) = (\$J\$$row\$J\$::jsonb -> 'expected') THEN 'gleich' ELSE lc.state_case(\$J\$$row\$J\$::jsonb)::text END; ROLLBACK;" | grep -v '^$' | tail -1)"
    check G "tournament-state.json: $(jq -r '.name' <<<"$row")" "gleich" "$got"
  done
}

# ---------------------------------------------------------------------------------------------------------
# P und R: Pflichttests
# ---------------------------------------------------------------------------------------------------------
run_probes() {
  local t t2 th r s m d rid1 code u fa cnt rows out tf before
  # --- P-0 Positiv-Kontrolle: Nikolaus, 15/15 entschieden, Gruppe '' abgeschlossen -> abschliessen ---------------
  T_FIN="$(niko_ready)"; make_public "$T_FIN"
  before="$(q "SELECT change_revision FROM public.tournaments WHERE id = '$T_FIN';")"
  check P "P-0 @LZ-009 Olli schliesst das Nikolaus-Turnier ab -> ok" "ok" "$(fin_niko olli "$T_FIN")"
  check P "P-0 @LZ-009 danach: abgeschlossen, finished_at gesetzt, ein Endstand, ein Verlaufseintrag, change_revision + 1" \
    "finished|t|1|1|$((before + 1))" \
    "$(life "$T_FIN")|$(q "SELECT finished_at IS NOT NULL FROM public.tournaments WHERE id = '$T_FIN';")|$(q "SELECT count(*) FROM public.tournament_final_standings WHERE tournament_id = '$T_FIN';")|$(nlog "$T_FIN" finish)|$(q "SELECT change_revision FROM public.tournaments WHERE id = '$T_FIN';")"
  check P "P-0 @ET-045 gespeichert ist genau der gesendete Endstand (Plaetze 1, 2, 3, 3, 5, 6, App-Version)" "1,2,3,3,5,6|2.3.0" \
    "$(q "SELECT string_agg(r ->> 'place', ',' ORDER BY o) FROM public.tournament_final_standings, jsonb_array_elements(snapshot -> 'ranking') WITH ORDINALITY AS x(r, o) WHERE tournament_id = '$T_FIN';")|$(q "SELECT snapshot ->> 'appVersion' FROM public.tournament_final_standings WHERE tournament_id = '$T_FIN';")"
  FS_FIN="$(fs_md5 "$T_FIN")"

  run_twins

  # --- P-1 @LZ-010 @LZ-012 @LZ-013: offene Punkte -------------------------------------------------------------
  th="$(hc_ready)"
  check R "P-1 Gegenbeispiel: Hallencup alles entschieden -> keine offenen Punkte, keine Warnung" "|" "$(q "SELECT lc.preflight('olli', '$th');")"
  check R "P-1 Gegenbeispiel @LZ-016 @LZ-017: Spiel um Platz 3 gewertet (SV Süd nicht angetreten), Gleichstand West/Ufer zwischen Gruppen -> abschliessen gelingt" \
    "ok|finished|3:DJK Berg|4:SV Süd" \
    "$(fin_hc olli "$th")|$(life "$th")|$(q "SELECT (r ->> 'place') || ':' || (r ->> 'teamName') FROM public.tournament_final_standings, jsonb_array_elements(snapshot -> 'ranking') r WHERE tournament_id = '$th' AND r ->> 'place' = '3';")|$(q "SELECT (r ->> 'place') || ':' || (r ->> 'teamName') FROM public.tournament_final_standings, jsonb_array_elements(snapshot -> 'ranking') r WHERE tournament_id = '$th' AND r ->> 'place' = '4';")"
  T_HC_FIN="$th"
  for zeile in laeuft nicht-angepfiffen finale-ohne-strafstoss entscheidung-offen klaerung hinweis gruppe-offen gruppe-stale gleichstand-offen; do
    t="$(hc_ready)"
    case "$zeile" in
      laeuft) q "UPDATE public.matches SET match_status = 'running' WHERE id = lc.final('$t', 'thirdPlace');" >/dev/null; exp="match_running" ;;
      nicht-angepfiffen) q "UPDATE public.matches SET match_status = 'scheduled', score_a = NULL, score_b = NULL, decided_by = NULL, forfeit_absent = NULL WHERE id = lc.final('$t', 'thirdPlace');" >/dev/null; exp="match_undecided" ;;
      finale-ohne-strafstoss) q "SELECT lc.set_result(lc.final('$t', 'final'), 1, 1);" >/dev/null; exp="match_undecided" ;;
      entscheidung-offen) q "UPDATE public.matches SET match_status = 'paused', live_state = '{\"status\": \"decision_pending\"}' WHERE id = lc.final('$t', 'final');" >/dev/null; exp="match_undecided" ;;
      klaerung) q "INSERT INTO public.clarifications (tournament_id, match_id, kind, requested, conflict_code, requested_by) VALUES ('$t', harness.hf('$t', 'B1'), 'set_slot', '{}', 'STALE_VERSION', harness.p('tom'));" >/dev/null; exp="clarification_open" ;;
      hinweis) q "INSERT INTO public.bracket_notices (tournament_id, match_id, side, kind, origin_team_id, current_team_id) VALUES ('$t', harness.hf('$t', 'A1'), 'A', 'manual_kept', harness.team('$t', 'SV Süd'), harness.team('$t', 'FC Nord'));" >/dev/null; exp="notice_open" ;;
      gruppe-offen) q "SELECT harness.reopen('olli', '$t', 'B', 'Besetzung pruefen');" >/dev/null; exp="group_open" ;;
      gruppe-stale) q "UPDATE public.group_completions SET stale = true WHERE tournament_id = '$t' AND group_id = 'B';" >/dev/null; exp="group_stale" ;;
      gleichstand-offen) q "UPDATE public.group_completions SET stale = true, open_ranks = '{3,4}' WHERE tournament_id = '$t' AND group_id = 'B';" >/dev/null; exp="tie_open" ;;
    esac
    check R "P-1 @LZ-010 $zeile -> Liste mit genau diesem Punkt ($exp); Abschluss OPEN_ITEMS, Turnier laeuft weiter" \
      "$exp||rejected:OPEN_ITEMS|1|running" \
      "$(q "SELECT lc.preflight('olli', '$t');")|$(fin_hc olli "$t")|$(q "SELECT jsonb_array_length(harness.last() -> 'items');")|$(life "$t")"
  done
  check R "H3 offener Gleichstand nennt Plaetze und Teams (Sprungziel Tabelle der Gruppe)" '[3,4]|["VfB Ufer","TuS Tal"]' \
    "$(q "SELECT (i -> 'places')::text FROM jsonb_array_elements(harness.last() -> 'items') i;" | jq -c .)|$(q "SELECT jsonb_agg(harness.tname(x::uuid))::text FROM jsonb_array_elements(harness.last() -> 'items') i, jsonb_array_elements_text(i -> 'teamIds') x;" | jq -c .)"
  t="$(hc_ready)"
  q "UPDATE public.matches SET match_status = 'running' WHERE id = lc.final('$t', 'thirdPlace');
     INSERT INTO public.clarifications (tournament_id, kind, group_id, requested, conflict_code, requested_by)
     VALUES ('$t', 'complete_group', 'A', '{}', 'STALE_VERSION', harness.p('olli')), ('$t', 'complete_group', 'B', '{}', 'STALE_VERSION', harness.p('olli'));" >/dev/null
  check R "P-1 @LZ-012 Spiel um Platz 3 laeuft + 2 Klaerungen -> 3 Eintraege, Turnier laeuft" \
    "match_running,clarification_open,clarification_open||running" "$(q "SELECT lc.preflight('olli', '$t');")|$(life "$t")"
  t="$(clone "$TPL_NIKO")"
  check R "P-1 @LZ-013 Nikolaus alle Spiele entschieden, Gruppe nicht abgeschlossen -> 'group_open', Abschluss abgelehnt, Gruppe bleibt offen" \
    "group_open||rejected:OPEN_ITEMS|running|0" \
    "$(q "SELECT lc.preflight('olli', '$t');")|$(fin_niko olli "$t")|$(life "$t")|$(q "SELECT count(*) FROM public.group_completions WHERE tournament_id = '$t';")"

  # --- P-2 @LZ-029 @LZ-030 ------------------------------------------------------------------------------------
  t="$(niko_ready)"; s="$(q "SELECT match_engine.tournament_state('$t')::text;")"
  q "SELECT harness.correction('maria', '$t', 'TSV 1921 Fridolfing', 'TSV Waging blau', 2, 1);" >/dev/null
  check R "P-2 @LZ-029 Marias Korrektur kommt vor dem Abschluss an -> OPEN_ITEMS (Gruppe 'Besetzung pruefen'), Turnier laeuft" \
    "rejected:OPEN_ITEMS|group_stale|running" \
    "$(q "SELECT lc.finish('olli', '$t', lc.snap('$t', '$R_NIKO', '$P_NIKO'), gen_random_uuid(), \$J\$$s\$J\$::jsonb);")|$(q "SELECT string_agg(i ->> 'kind', ',') FROM jsonb_array_elements(harness.last() -> 'items') i;")|$(life "$t")"
  t="$(hc_ready)"; s="$(q "SELECT match_engine.tournament_state('$t')::text;")"
  q "UPDATE public.matches SET score_a = 3 WHERE id = lc.final('$t', 'final');" >/dev/null
  check R "P-2 @LZ-029 Finale geaendert (3:1 statt 2:1), Endstand auf altem Stand gerechnet -> STALE_STATE, Turnier laeuft" \
    "rejected:STALE_STATE|running|kein" \
    "$(q "SELECT lc.finish('olli', '$t', lc.snap('$t', '$R_HC', '$P_HC', 'hc'), gen_random_uuid(), \$J\$$s\$J\$::jsonb);")|$(life "$t")|$(fs_md5 "$t")"
  check R "P-2 Gegenbeispiel: mit aktuellem Stand -> ok" "ok" "$(fin_hc olli "$t")"
  m="$(gm "$T_FIN" 'TSV 1921 Fridolfing' 'TSV Waging blau')"
  before="$(q "SELECT score_a || ':' || score_b FROM public.matches WHERE id = '$m';")"
  check R "P-2 @LZ-030 Marias Korrektur kommt nach dem Abschluss an -> review AFTER_FINISH, Ergebnis und Endstand unveraendert, 1 spaeter Eintrag" \
    "review:AFTER_FINISH|$before|$FS_FIN|1" \
    "$(q "SELECT harness.correction('maria', '$T_FIN', 'TSV 1921 Fridolfing', 'TSV Waging blau', 2, 1);")|$(q "SELECT score_a || ':' || score_b FROM public.matches WHERE id = '$m';")|$(fs_md5 "$T_FIN")|$(nlate "$T_FIN")"

  # --- P-3 @LZ-024 ganz oder gar nicht -------------------------------------------------------------------------
  t="$(niko_ready)"
  q "CREATE FUNCTION lc.wegwerf() RETURNS trigger LANGUAGE plpgsql AS \$x\$ BEGIN RAISE EXCEPTION 'Abbruch nach dem Setzen des Zustands'; END \$x\$;
     CREATE TRIGGER wegwerf BEFORE INSERT ON public.tournament_lifecycle_log FOR EACH ROW EXECUTE FUNCTION lc.wegwerf();" >/dev/null
  r="$(fin_niko olli "$t")"
  q "DROP TRIGGER IF EXISTS wegwerf ON public.tournament_lifecycle_log; DROP FUNCTION IF EXISTS lc.wegwerf();" >/dev/null
  check R "P-3 @LZ-024 Abbruch beim Verlauf -> Fehler, Turnier laeuft, kein Endstand, kein Verlauf; Eintraege gehen weiter (Maria korrigiert)" \
    "error:P0001|running|kein|0|accepted" \
    "$r|$(life "$t")|$(fs_md5 "$t")|$(nlog "$t")|$(q "SELECT harness.correction('maria', '$t', 'TSV 1921 Fridolfing', 'TSV Waging blau', 2, 1);")"

  # --- P-4 @LZ-021 nicht doppelt -------------------------------------------------------------------------------
  t="$(niko_ready)"; rid1="$(rid)"
  check R "P-4 @LZ-021 erster Abschluss ok; dieselbe request_id noch einmal -> ok alreadyApplied; genau ein Verlaufseintrag" \
    "ok|ok|true|1" "$(fin_niko olli "$t" "" "" "$rid1")|$(fin_niko olli "$t" "" "" "$rid1")|$(q "SELECT harness.last() ->> 'alreadyApplied';")|$(nlog "$t" finish)"
  check R "P-4 andere request_id (Maria) -> ALREADY_FINISHED von Olli mit Zeitpunkt; weiter ein Verlaufseintrag" \
    "rejected:ALREADY_FINISHED|Olli|t|1" \
    "$(fin_niko maria "$t")|$(q "SELECT harness.last() ->> 'by';")|$(q "SELECT (harness.last() ->> 'at') IS NOT NULL;")|$(nlog "$t" finish)"
  check R "P-4 request_id eines Abschlusses fuer ein anderes Turnier -> REQUEST_ID_CONFLICT" "rejected:REQUEST_ID_CONFLICT" \
    "$(fin_niko olli "$(niko_ready)" "" "" "$rid1")"

  # --- P-9 @ZM-012 @LZ-075 @LZ-074 @LZ-076 B5 (vor P-5: Schalter noch aus) -------------------------------------
  t="$(niko_ready)"; make_public "$t"; code="$(code_of "$t")"
  check R "P-9 @LZ-075 vor dem Abschluss: Zuschauer (Teilen-Code) und Monitor sehen keinen Endstand, auch keinen vorlaeufigen" "none|none" \
    "$(anon_val "SELECT public.public_final_standings('$code') ->> 'status'")|$(anon_val "SELECT public.display_final_standings('$t') ->> 'status'")"
  code="$(code_of "$T_FIN")"
  check R "P-9 @ZM-012 @LZ-074 nach dem Abschluss, Schalter aus: Zuschauer sehen Plaetze (6 Zeilen), keine Torschuetzenliste" "final|6|false" \
    "$(anon_val "SELECT public.public_final_standings('$code') ->> 'status'")|$(anon_val "SELECT jsonb_array_length(public.public_final_standings('$code') -> 'standings' -> 'ranking')::text")|$(anon_val "SELECT (public.public_final_standings('$code') -> 'standings' ? 'scorers')::text")"
  check R "P-9 @LZ-076 @ZM-012 Hallen-Monitor (Bildschirm-Konto) zeigt den Endstand wie die Zuschaueransicht, ohne Torschuetzen" "true" \
    "$(as_val bildschirm "SELECT (public.display_final_standings('$T_FIN') = public.public_final_standings('$code'))::text")"
  check R "P-9 B5 SELECT tournament_final_standings: anon kein Recht; Bildschirm 0 Zeilen; Olli, Maria, Tom (Helfer-Geraet), Kai je 1; Fremder 0" \
    "error:42501|0|1|1|1|1|0" \
    "$(anon_val "SELECT count(*)::text FROM public.tournament_final_standings")|$(as_val bildschirm "SELECT count(*)::text FROM public.tournament_final_standings WHERE tournament_id = '$T_FIN'")|$(as_val olli "SELECT count(*)::text FROM public.tournament_final_standings WHERE tournament_id = '$T_FIN'")|$(as_val maria "SELECT count(*)::text FROM public.tournament_final_standings WHERE tournament_id = '$T_FIN'")|$(as_val tom "SELECT count(*)::text FROM public.tournament_final_standings WHERE tournament_id = '$T_FIN'")|$(as_val kai "SELECT count(*)::text FROM public.tournament_final_standings WHERE tournament_id = '$T_FIN'")|$(as_val fremd "SELECT count(*)::text FROM public.tournament_final_standings WHERE tournament_id = '$T_FIN'")"
  check R "P-9 Monitor eines nicht oeffentlichen Turniers: anon -> none, Bildschirm-Konto (readDisplay) -> final" "none|final" \
    "$(anon_val "SELECT public.display_final_standings('$T_HC_FIN') ->> 'status'")|$(q "INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) SELECT '$T_HC_FIN', harness.p('bildschirm'), 'screen', now(), 'Hallen-Monitor' WHERE NOT EXISTS (SELECT 1 FROM public.tournament_collaborators WHERE tournament_id = '$T_HC_FIN' AND user_id = harness.p('bildschirm'));" >/dev/null; as_val bildschirm "SELECT public.display_final_standings('$T_HC_FIN') ->> 'status'")"
  check R "P-9 Verlauf und spaete Eintraege: nur Turnierleitung (Olli/Maria), Tom und Bildschirm 0, anon kein Recht" "1|1|0|0|error:42501|1|0" \
    "$(as_val olli "SELECT count(*)::text FROM public.tournament_lifecycle_log WHERE tournament_id = '$T_FIN'")|$(as_val maria "SELECT count(*)::text FROM public.tournament_lifecycle_log WHERE tournament_id = '$T_FIN'")|$(as_val tom "SELECT count(*)::text FROM public.tournament_lifecycle_log WHERE tournament_id = '$T_FIN'")|$(as_val bildschirm "SELECT count(*)::text FROM public.tournament_lifecycle_log WHERE tournament_id = '$T_FIN'")|$(anon_val "SELECT count(*)::text FROM public.late_entries")|$(as_val olli "SELECT count(*)::text FROM public.late_entries WHERE tournament_id = '$T_FIN'")|$(as_val tom "SELECT count(*)::text FROM public.late_entries WHERE tournament_id = '$T_FIN'")"

  # --- P-5 @LZ-036 @LZ-037 @LZ-038 @ZP-087 @SA-005: Sperre nach dem Abschluss ---------------------------------
  m="$(gm "$T_FIN" 'DJK Kammer' 'TSV Waging rot')"
  check R "P-5 @ZP-087 Olli verschiebt Spiele (PATCH matches) -> 55000" "error:55000" \
    "$(as_exec olli "UPDATE public.matches SET scheduled_start = scheduled_start + interval '10 minutes' WHERE tournament_id = '$T_FIN'")"
  check R "P-5 @LZ-037 Turniername / @LZ-036 Punkteschema 2/1/0 / @LZ-037 Kindermodus / Sponsor entfernen (config) -> je 55000" \
    "error:55000|error:55000|error:55000|error:55000" \
    "$(as_exec olli "UPDATE public.tournaments SET title = 'Nikolaus neu' WHERE id = '$T_FIN'")|$(as_exec olli "UPDATE public.tournaments SET point_system = '{\"win\": 2, \"draw\": 1, \"loss\": 0}' WHERE id = '$T_FIN'")|$(as_exec olli "UPDATE public.tournaments SET config = config || '{\"isKidsTournament\": true}' WHERE id = '$T_FIN'")|$(as_exec olli "UPDATE public.tournaments SET config = config || '{\"sponsors\": []}' WHERE id = '$T_FIN'")"
  check R "P-5 Maria benennt ein Team um / traegt einen Spieler ein / Olli loescht ein Spiel -> je 55000" "error:55000|error:55000|error:55000" \
    "$(as_exec maria "UPDATE public.teams SET name = name || ' II' WHERE tournament_id = '$T_FIN' AND name = 'DJK Kammer'")|$(as_exec maria "INSERT INTO public.team_players (team_id, number, name) VALUES (harness.team('$T_FIN', 'DJK Kammer'), 9, 'Neu')")|$(as_exec olli "DELETE FROM public.matches WHERE id = '$m'")"
  check R "P-5 @LZ-036 Maria oeffnet die Gruppe wieder / traegt eine Gleichstands-Entscheidung ein -> 55000" "error:55000|error:55000" \
    "$(q "SELECT harness.reopen('maria', '$T_FIN', '', 'Pruefen');")|$(q "SELECT harness.decide('maria', '$T_FIN', 'decide', harness.dec('neu', '$T_FIN', '', 'shared', 'TSV 1921 Fridolfing,TSV Waging blau', 'TSV 1921 Fridolfing,TSV Waging blau'), NULL, harness.tversion('$T_FIN'));")"
  check R "P-5 complete_group nach dem Abschluss schreibt nichts (gleich -> ALREADY_COMPLETED; Klaerung/Hinweis direkt anlegen -> 55000)" \
    "ok:ALREADY_COMPLETED|error:55000|error:55000" \
    "$(q "SELECT lc.complete_niko('$T_FIN');")|$(q "DO \$x\$ BEGIN INSERT INTO public.clarifications (tournament_id, kind, requested, conflict_code, requested_by) VALUES ('$T_FIN', 'complete_group', '{}', 'STALE_VERSION', harness.p('olli')); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'sqlstate=%', SQLSTATE; END \$x\$;" 2>&1 | grep -o 'sqlstate=[0-9A-Z]*' | sed 's/sqlstate=/error:/')|$(q "DO \$x\$ BEGIN INSERT INTO public.bracket_notices (tournament_id, match_id, side, kind) VALUES ('$T_FIN', '$m', 'A', 'released'); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'sqlstate=%', SQLSTATE; END \$x\$;" 2>&1 | grep -o 'sqlstate=[0-9A-Z]*' | sed 's/sqlstate=/error:/')"
  check R "P-5 @SA-005 Spielplan auf Anfang (reset_match_results) am Hallencup-Finale ohne Eintraege -> 55000; Tom uebernimmt Feld 1 -> 55000" \
    "error:55000|error:55000" \
    "$(q "SELECT harness.rpc(harness.p('maria'), false, format('SELECT public.reset_match_results(%L::uuid, ARRAY[%L::uuid])', '$T_HC_FIN', lc.final('$T_HC_FIN', 'final')));")|$(q "SELECT harness.rpc(harness.p('tom'), true, format('SELECT public.take_field_control(%L::uuid, 1, %L::uuid, %L, 0)', '$T_FIN', md5('tom-geraet')::uuid, 'Tom'));")"
  check R "P-5 Zustand per REST (Olli) und mit selbst gesetztem Schalter (ME12) -> 42501; auch der Superuser ohne Schalter -> 42501" \
    "error:42501|error:42501|error:42501" \
    "$(as_exec olli "UPDATE public.tournaments SET lifecycle_status = 'fixed', finished_at = NULL WHERE id = '$T_FIN'")|$(as_exec olli "SELECT set_config('app.lifecycle_write', 'on', true); UPDATE public.tournaments SET lifecycle_status = 'fixed', finished_at = NULL WHERE id = '$T_FIN'")|$(q "DO \$x\$ BEGIN UPDATE public.tournaments SET lifecycle_status = 'fixed' WHERE id = '$T_FIN'; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'sqlstate=%', SQLSTATE; END \$x\$;" 2>&1 | grep -o 'sqlstate=[0-9A-Z]*' | sed 's/sqlstate=/error:/')"
  check R "P-5 @LZ-036 nach allen Versuchen: Endstand unveraendert, weiter abgeschlossen" "$FS_FIN|finished" "$(fs_md5 "$T_FIN")|$(life "$T_FIN")"
  # Gegenbeispiele @LZ-037 (B1/B2)
  check R "P-5 @LZ-037 Gegenbeispiel: Torschuetzen-Schalter (config.publicScorers) per Metadaten-Update -> gelingt; Zuschauer sehen jetzt Torschuetzen (@ZM-011)" \
    "ok:1|true|2" \
    "$(as_exec olli "UPDATE public.tournaments SET config = config || '{\"publicScorers\": true}' WHERE id = '$T_FIN'")|$(anon_val "SELECT (public.public_final_standings('$(code_of "$T_FIN")') -> 'standings' ? 'scorers')::text")|$(anon_val "SELECT jsonb_array_length(public.public_final_standings('$(code_of "$T_FIN")') -> 'standings' -> 'scorers')::text")"
  rows="$(q "SELECT lc.rows('$T_FIN')::text;")"
  out="$(cd "$REPO_ROOT" && npx --yes tsx scripts/tournament-lifecycle-fixture.ts <<<"$rows" 2>"$WORK_DIR/fixture.err")"
  if [[ -z "$out" ]]; then
    check R "P-5 B2 echter save()-Ablauf: Fixture erzeugt" "ja" "nein ($(head -c 200 "$WORK_DIR/fixture.err"))"
  else
    r="$(as_exec olli "$(jq -r '.tournament' <<<"$out")")"
    s="$(as_exec olli "$(jq -r '.teams' <<<"$out")")"
    cnt=0; fa=0
    while IFS= read -r m; do
      [[ "$(as_exec olli "$m")" == "ok:1" ]] && cnt=$((cnt + 1)) || fa=$((fa + 1))
    done < <(jq -r '.matches[]' <<<"$out")
    check R "P-5 @LZ-037 B2 echter save()-Ablauf ohne inhaltliche Aenderung (Turnier version+1, 6 Teams Upsert, 15 Spiele Update) -> alles gelingt, Endstand gleich" \
      "ok:1|ok:6|15|0|$FS_FIN" "$r|$s|$cnt|$fa|$(fs_md5 "$T_FIN")"
  fi
  check R "P-5 @LZ-037 B1 Gegenbeispiel: oeffentliche Ansicht beenden (Kaskade ueber Teams, Spiele, Ereignisse) -> gelingt, alle Kinder nicht mehr oeffentlich" \
    "ok:1|f|0" \
    "$(as_exec olli "SELECT public.make_tournament_private('$T_FIN')")|$(q "SELECT is_public FROM public.tournaments WHERE id = '$T_FIN';")|$(q "SELECT (SELECT count(*) FROM public.teams WHERE tournament_id = '$T_FIN' AND is_public) + (SELECT count(*) FROM public.matches WHERE tournament_id = '$T_FIN' AND is_public) + (SELECT count(*) FROM public.match_events e JOIN public.matches m ON m.id = e.match_id WHERE m.tournament_id = '$T_FIN' AND e.is_public);")"
  u="$code"; t2="$(niko_ready)"; make_public "$t2"; fin_niko olli "$t2" >/dev/null; code="$(code_of "$t2")"
  check R "P-9 Review A3: abgeschlossen, Teilen-Code bleibt, is_public per Metadaten-Update aus -> Zuschauer none (vorher final)" \
    "final|ok:1|$code|none" \
    "$(anon_val "SELECT public.public_final_standings('$code') ->> 'status'")|$(as_exec olli "UPDATE public.tournaments SET is_public = false WHERE id = '$t2'")|$(code_of "$t2")|$(anon_val "SELECT public.public_final_standings('$code') ->> 'status'")"
  code="$u"
  check R "P-9 nicht geteilt -> Zuschauer: none (Teilen-Code weg)" "none" "$(anon_val "SELECT public.public_final_standings('$code') ->> 'status'")"
  check R "P-5 @LZ-037 Gegenbeispiel: wieder oeffentlich (make_tournament_public) und Teilen-Code erneuern -> gelingt; Kinder wieder oeffentlich" \
    "ok:1|ok:1|t|0" \
    "$(as_exec olli "SELECT public.make_tournament_public('$T_FIN')")|$(as_exec olli "SELECT public.regenerate_share_code('$T_FIN')")|$(q "SELECT is_public FROM public.tournaments WHERE id = '$T_FIN';")|$(q "SELECT count(*) FROM public.teams WHERE tournament_id = '$T_FIN' AND NOT is_public;")"
  check R "P-5 F13 Gegenbeispiel: Helfer entziehen bleibt moeglich (Ausnahmeliste)" "ok:1" \
    "$(q "SELECT harness.exec(harness.p('olli'), false, \$S\$DELETE FROM public.tournament_collaborators WHERE tournament_id = '$T_FIN' AND user_id = harness.p('kai')\$S\$);")"

  # --- P-6 @LZ-039 @LZ-040 @FU-018 @HE-070: spaete Eintraege als Helfer-Geraet und Konto-Helfer ------------------
  t="$(niko_ready)"
  q "INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label) SELECT '$t', harness.p('kai'), 'collaborator', now(), 'Kai' WHERE NOT EXISTS (SELECT 1 FROM public.tournament_collaborators WHERE tournament_id = '$t' AND user_id = harness.p('kai'));" >/dev/null
  fin_niko olli "$t" >/dev/null
  fa="$(q "SELECT (extract(epoch FROM finished_at) * 1000)::bigint FROM public.tournaments WHERE id = '$t';")"
  m="$(gm "$t" 'DJK Kammer' 'TSV Waging rot')"
  d="$(q "SELECT md5('tom-handy-$t')::uuid;")"
  before="$(q "SELECT count(*) FROM public.field_control WHERE tournament_id = '$t';")|$(fs_md5 "$t")|$(q "SELECT score_a || ':' || score_b FROM public.matches WHERE id = '$m';")"
  check R "P-6 @LZ-039 @FU-018 Toms Geraet (anonyme Sitzung, Geraete-ID) sendet zwei Tore (17:55 vor, 18:10 nach dem Abschluss gestempelt) -> review AFTER_FINISH" \
    "review:AFTER_FINISH,review:AFTER_FINISH" \
    "$(q "SELECT lc.append('tom', '$m', jsonb_build_array(lc.ev('GOAL', 'p6-tor-vor-$t', jsonb_build_object('at', $fa - 900000, 'clockMs', 130000, 'teamId', harness.team('$t', 'DJK Kammer'))), lc.ev('GOAL', 'p6-tor-nach-$t', jsonb_build_object('at', $fa + 600000, 'clockMs', 140000, 'teamId', harness.team('$t', 'DJK Kammer')))), '$d');")"
  check R "P-6 @LZ-040 Konto-Helfer Kai sendet ein Tor -> review AFTER_FINISH" "review:AFTER_FINISH" \
    "$(q "SELECT lc.append('kai', '$m', jsonb_build_array(lc.ev('GOAL', 'p6-kai-$t', jsonb_build_object('at', $fa + 60000, 'clockMs', 150000, 'teamId', harness.team('$t', 'TSV Waging rot')))));")"
  check R "_009 Spiel beenden nach dem Abschluss: Ollis RESULT_ENTRY (mit basedOn, Leitung ohne Feldsteuerung) -> review AFTER_FINISH, Ergebnis gleich" \
    "review:AFTER_FINISH|$(q "SELECT score_a || ':' || score_b FROM public.matches WHERE id = '$m';")" \
    "$(q "SELECT lc.append('olli', '$m', jsonb_build_array(lc.ev('RESULT_ENTRY', 'p6-ende-$t', jsonb_build_object('at', $fa + 120000, 'section', NULL, 'clockMs', NULL, 'payload', jsonb_build_object('scores', jsonb_build_object(harness.team('$t', 'DJK Kammer'), 5, harness.team('$t', 'TSV Waging rot'), 0), 'basedOn', NULL)))));")|$(q "SELECT score_a || ':' || score_b FROM public.matches WHERE id = '$m';")"
  q "DELETE FROM public.late_entries WHERE tournament_id = '$t' AND event_id = harness.u('lc-event:p6-ende-$t');" >/dev/null
  check R "P-6 danach: keine neue field_control-Zeile, Endstand und Ergebnis gleich, 3 Zeilen 'nach dem Ende eingetroffen'" "$before|3" \
    "$(q "SELECT count(*) FROM public.field_control WHERE tournament_id = '$t';")|$(fs_md5 "$t")|$(q "SELECT score_a || ':' || score_b FROM public.matches WHERE id = '$m';")|$(nlate "$t")"
  check R "P-6 @LZ-039 Olli und Maria sehen die drei Eintraege, Tom und Kai nicht" "3|3|0|0" \
    "$(as_val olli "SELECT count(*)::text FROM public.late_entries WHERE tournament_id = '$t'")|$(as_val maria "SELECT count(*)::text FROM public.late_entries WHERE tournament_id = '$t'")|$(as_val tom "SELECT count(*)::text FROM public.late_entries WHERE tournament_id = '$t'")|$(as_val kai "SELECT count(*)::text FROM public.late_entries WHERE tournament_id = '$t'")"
  check R "P-6b dieselbe spaete Meldung noch einmal -> review, weiter eine Zeile (UNIQUE match_id, event_id)" "review:AFTER_FINISH|3" \
    "$(q "SELECT lc.append('kai', '$m', jsonb_build_array(lc.ev('GOAL', 'p6-kai-$t', jsonb_build_object('at', $fa + 60000, 'clockMs', 150000, 'teamId', harness.team('$t', 'TSV Waging rot')))));")|$(nlate "$t")"
  check R "P-6b B3 ein vor dem Abschluss angenommenes Ereignis kommt nach dem Abschluss erneut -> duplicate, keine Zeile" "duplicate|3" \
    "$(q "SELECT lc.append('olli', '$m', jsonb_build_array(lc.stored_event('$m')));")|$(nlate "$t")"
  check R "H-10 MX3: Ereignis-ID aus einem anderen Spiel nach dem Abschluss -> ID_CONFLICT, keine Zeile" "rejected:ID_CONFLICT|3" \
    "$(q "SELECT lc.append('olli', '$m', jsonb_build_array(lc.stored_event(harness.gm('$t', 'TSV Petting', 'DJK Otting'))));")|$(nlate "$t")"
  check R "P-6 @HE-070 Tom liest den Endstand weiter (writeMatchData)" "1" \
    "$(as_val tom "SELECT count(*)::text FROM public.tournament_final_standings WHERE tournament_id = '$t'")"

  # --- P-7 @LZ-022 @LZ-023 -----------------------------------------------------------------------------------
  t="$(niko_ready)"
  check R "P-7 @LZ-023 Tom (Helfer-Geraet), Kai (Konto-Helfer), Bildschirm, Fremder: abschliessen -> 42501; Turnier laeuft" \
    "error:42501|error:42501|error:42501|error:42501|running" \
    "$(fin_niko tom "$t")|$(fin_niko kai "$t")|$(fin_niko bildschirm "$t")|$(fin_niko fremd "$t")|$(life "$t")"
  check R "P-7 @LZ-023 Tom, Kai: wieder oeffnen / Abschluss-Liste -> 42501; Turnier bleibt abgeschlossen" \
    "error:42501|error:42501|error:42501|finished" \
    "$(q "SELECT lc.reopen('tom', '$T_FIN', 'Grund', gen_random_uuid());")|$(q "SELECT lc.reopen('kai', '$T_FIN', 'Grund', gen_random_uuid());")|$(q "SELECT lc.preflight('tom', '$t');")|$(life "$T_FIN")"
  check R "P-7 @LZ-022 Gegenbeispiel: Maria (Co-Admin) schliesst ab -> ok" "ok" "$(fin_niko maria "$t")"

  # --- P-8 R-EA-4 W4 -----------------------------------------------------------------------------------------
  t="$(niko_ready)"
  for zeile in fehlt doppelt ohne-sprung falsche-ziffer reihenfolge; do
    case "$zeile" in
      fehlt) r="$(fin_niko olli "$t" "{1,2,3,3,5}" "DJK Kammer,TSV Waging rot,TSV Petting,DJK Otting,TSV 1921 Fridolfing")"; exp="TEAM_SET" ;;
      doppelt) r="$(fin_niko olli "$t" "{1,2,3,3,5,6,7}" "$R_NIKO,DJK Kammer")"; exp="SHAPE" ;;
      ohne-sprung) r="$(fin_niko olli "$t" "{1,2,3,3,4,5}")"; exp="PLACE_NUMBERS" ;;
      falsche-ziffer) r="$(fin_niko olli "$t" "{1,2,3,4,5,6}")"; exp="GROUP_PLACES" ;;
      reihenfolge) r="$(fin_niko olli "$t" "$P_NIKO" "TSV Waging rot,DJK Kammer,TSV Petting,DJK Otting,TSV 1921 Fridolfing,TSV Waging blau")"; exp="GROUP_ORDER" ;;
    esac
    check R "P-8 R-EA-4 $zeile -> INVALID_STANDINGS $exp, Turnier laeuft" "rejected:INVALID_STANDINGS|$exp|running" "$r|$(reason)|$(life "$t")"
  done
  check R "P-8 W4 Positivfall: geteilter Platz 3 (Petting/Otting, final-standings-roundrobin.json) -> ok" "ok" "$(fin_niko olli "$t")"
  t="$(hc_ready)"
  check R "P-8 Finale-Verlierer (SG Mitte) vor Finale-Sieger (FC Nord) -> INVALID_STANDINGS PLACEMENT_GAME" "rejected:INVALID_STANDINGS|PLACEMENT_GAME" \
    "$(fin_hc olli "$t" "SG Mitte,FC Nord,DJK Berg,SV Süd,TSV West,VfB Ufer,SC Ost,TuS Tal")|$(reason)"
  check R "P-8 Review A1: vorlaeufiger Endstand (Herkunft 'open', Platzierungsspiele offen) -> INVALID_STANDINGS PROVISIONAL, Turnier laeuft" \
    "rejected:INVALID_STANDINGS|PROVISIONAL|running" "$(fin_hc olli "$t" "$R_HC" open)|$(reason)|$(life "$t")"
  check R "P-8 Review A1 Gegenbeispiel: derselbe Endstand mit echten Herkuenften (Finale, Spiel um Platz 3, Gruppenplaetze) -> ok" "ok" \
    "$(fin_hc olli "$t")"
  t="$(clone "$TPL_NIKO")"
  q "UPDATE public.teams SET is_removed = true, removed_at = now() WHERE tournament_id = '$t' AND name = 'TSV Waging blau';" >/dev/null
  complete_group_as "$t" '' "$(sed 's/,TSV Waging blau//' <<<"$R_NIKO")" >/dev/null
  q "UPDATE public.group_completions SET tie_orders = jsonb_build_array(harness.dec('annahme', '$t', '', 'shared', 'TSV Petting,DJK Otting', 'TSV Petting,DJK Otting') - 'basis') WHERE tournament_id = '$t';" >/dev/null
  r="$(fin_niko olli "$t")|$(reason)"
  s="$(sed 's/,TSV Waging blau//' <<<"$R_NIKO")"; u='{1,2,3,3,5}'
  check R "P-8 @ET-058 entferntes Team mitgeschickt -> TEAM_SET; ohne das entfernte Team (Plaetze 1, 2, 3, 3, 5) -> ok" "rejected:INVALID_STANDINGS|TEAM_SET|ok" \
    "$r|$(fin_niko olli "$t" "$u" "$s")"

  # --- P-10 @LZ-001 @LZ-004 @LZ-006 K1 K2 ---------------------------------------------------------------------
  t="$(q "SELECT harness.instantiate('nikolaus', 'p10-' || md5(random()::text));")"
  m="$(q "SELECT id FROM public.matches WHERE tournament_id = '$t' ORDER BY match_number LIMIT 1;")"
  check R "P-10 @LZ-001 festgelegt (status published, kein Anpfiff) -> fixed; Olli setzt Entwurf -> draft; wieder festlegen -> fixed" \
    "fixed|ok:1|draft|ok:1|fixed" \
    "$(life "$t")|$(as_exec olli "UPDATE public.tournaments SET status = 'draft' WHERE id = '$t'")|$(life "$t")|$(as_exec olli "UPDATE public.tournaments SET status = 'published' WHERE id = '$t'")|$(life "$t")"
  check R "P-10 @LZ-001 erster Anpfiff -> running (gelesen, nicht gespeichert: Spalte bleibt fixed)" "accepted|running|fixed" \
    "$(q "SELECT lc.append('olli', '$m', jsonb_build_array(lc.ev('MATCH_START', 'p10-start-$t', '{\"clockMs\": null}')));")|$(life "$t")|$(q "SELECT lifecycle_status FROM public.tournaments WHERE id = '$t';")"
  check R "P-10 K2 Anpfiff in 30 s zurueckgenommen -> wieder fixed; abschliessen -> NOT_RUNNING" "accepted|fixed|rejected:NOT_RUNNING" \
    "$(q "SELECT lc.append('olli', '$m', jsonb_build_array(lc.ev('RETRACT', 'p10-undo-$t', jsonb_build_object('at', 11000, 'clockMs', null, 'targetId', harness.u('lc-event:p10-start-$t')))));")|$(life "$t")|$(fin_niko olli "$t")"
  q "SELECT lc.append('olli', '$m', jsonb_build_array(lc.ev('MATCH_START', 'p10-start2-$t', '{\"clockMs\": null}')));" >/dev/null
  check R "P-10 @LZ-004 nach dem Anpfiff setzt Olli status 'draft' (Bearbeiten nach dem Anlegen) -> Zustand bleibt running" "ok:1|running" \
    "$(as_exec olli "UPDATE public.tournaments SET status = 'draft' WHERE id = '$t'")|$(life "$t")"
  check R "P-10 W3 Client setzt status 'completed' bzw. 'live' -> 42501; Zustand unveraendert" "error:42501|error:42501|running" \
    "$(as_exec olli "UPDATE public.tournaments SET status = 'completed' WHERE id = '$t'")|$(as_exec maria "UPDATE public.tournaments SET status = 'live' WHERE id = '$t'")|$(life "$t")"
  check R "P-10 @LZ-090 Regression: angepfiffenes Turnier loeschen -> abgelehnt (P0001)" "error:P0001" \
    "$(as_exec olli "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$t'")"
  t="$(clone "$TPL_NIKO")"
  check R "P-10 @LZ-006 alle 15 Spiele entschieden, nicht abgeschlossen -> running, nicht finished; kein Endstand" "running|kein" "$(life "$t")|$(fs_md5 "$t")"
  u="$(q "SELECT gen_random_uuid();")"
  q "INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, status, lifecycle_status, finished_at)
     VALUES ('$u', harness.p('olli'), 'Probe-Kopie', current_date, 4, 10, 'draft', 'finished', now());" >/dev/null
  check R "P-10 K1 INSERT mit lifecycle_status 'finished' (Probe-Kopie) -> draft, finished_at leer" "draft|t" \
    "$(life "$u")|$(q "SELECT finished_at IS NULL FROM public.tournaments WHERE id = '$u';")"
  check R "P-10 K1 Client-INSERT mit status 'completed' -> 42501" "error:42501" \
    "$(as_exec olli "INSERT INTO public.tournaments (owner_id, title, date, number_of_teams, group_phase_duration, status) VALUES (harness.p('olli'), 'Fremdstatus', current_date, 4, 10, 'completed')")"

  # --- P-11 @ET-046 @LZ-091 F1 W3: wieder oeffnen ------------------------------------------------------------
  t="$(niko_ready)"; make_public "$t"; fin_niko olli "$t" >/dev/null
  fa="$(q "SELECT finished_at FROM public.tournaments WHERE id = '$t';")"
  check R "P-11 ohne Grund -> REASON_REQUIRED, weiter abgeschlossen" "rejected:REASON_REQUIRED|finished" \
    "$(q "SELECT lc.reopen('olli', '$t', '   ', gen_random_uuid());")|$(life "$t")"
  check R "P-11 @LZ-091 mit Grund 'versehentlich abgeschlossen' -> Laeuft, finished_at leer, Verlauf haelt Grund und Abschlusszeit, Endstand bleibt gespeichert" \
    "ok|running|t|versehentlich abgeschlossen|$fa|1" \
    "$(q "SELECT lc.reopen('olli', '$t', 'versehentlich abgeschlossen', gen_random_uuid());")|$(life "$t")|$(q "SELECT finished_at IS NULL FROM public.tournaments WHERE id = '$t';")|$(q "SELECT reason FROM public.tournament_lifecycle_log WHERE tournament_id = '$t' AND kind = 'reopen';")|$(q "SELECT finished_at_before FROM public.tournament_lifecycle_log WHERE tournament_id = '$t' AND kind = 'reopen';")|$(q "SELECT count(*) FROM public.tournament_final_standings WHERE tournament_id = '$t';")"
  check R "P-11 nach dem Wiederoeffnen: Zuschauer sehen keinen Endstand (laeuft wieder)" "none" \
    "$(anon_val "SELECT public.public_final_standings('$(code_of "$t")') ->> 'status'")"
  check R "P-11 @ET-046 erneut abschliessen mit neuer App-Version -> ok, Endstand ersetzt (2.4.0), Verlauf finish, reopen, finish" \
    "ok|2.4.0|finish,reopen,finish" \
    "$(q "SELECT lc.finish('olli', '$t', lc.snap('$t', '$R_NIKO', '$P_NIKO') || '{\"appVersion\": \"2.4.0\"}', gen_random_uuid());")|$(q "SELECT snapshot ->> 'appVersion' FROM public.tournament_final_standings WHERE tournament_id = '$t';")|$(q "SELECT string_agg(kind, ',' ORDER BY id) FROM public.tournament_lifecycle_log WHERE tournament_id = '$t';")"
  check R "P-11 wieder oeffnen eines nicht abgeschlossenen Turniers -> NOT_FINISHED" "rejected:NOT_FINISHED" \
    "$(q "SELECT lc.reopen('olli', '$(niko_ready)', 'Grund', gen_random_uuid());")"
  t2="$(niko_ready)"; fin_niko olli "$t2" >/dev/null; q "SELECT lc.reopen('maria', '$t2', 'Strafstossschiessen im Finale falsch erfasst', gen_random_uuid());" >/dev/null
  check R "P-11 @LZ-091 nach dem Wiederoeffnen traegt Maria wieder ein (accepted, kein AFTER_FINISH)" "accepted" \
    "$(q "SELECT harness.correction('maria', '$t2', 'TSV 1921 Fridolfing', 'TSV Waging blau', 2, 1);")"

  # @LZ-091 Notweg: Block 1 der Betriebs-Vorlage scripts/betrieb/turnier-wieder-oeffnen.sql woertlich (Platzhalter ersetzt)
  t="$(niko_ready)"; fin_niko olli "$t" >/dev/null
  s="$(awk '/^-- ##### BLOCK 1/{f=1} /^-- ##### BLOCK 2/{exit} f' "$REPO_ROOT/scripts/betrieb/turnier-wieder-oeffnen.sql" | sed -e "s/<turnier-id>/$t/g" -e "s/<grund>/versehentlich abgeschlossen (Betreiber)/g")"
  check R "@LZ-091 Betriebs-Vorlage Block 1: laeuft ohne Fehler, Turnier laeuft wieder, Verlauf reopen mit Grund (Person Olli)" \
    "0|running|reopen|versehentlich abgeschlossen (Betreiber)|Olli" \
    "$(q "$s" | grep -c 'ERROR')|$(life "$t")|$(q "SELECT kind FROM public.tournament_lifecycle_log WHERE tournament_id = '$t' ORDER BY id DESC LIMIT 1;")|$(q "SELECT reason FROM public.tournament_lifecycle_log WHERE tournament_id = '$t' AND kind = 'reopen';")|$(q "SELECT match_engine.actor_name('$t', actor) FROM public.tournament_lifecycle_log WHERE tournament_id = '$t' AND kind = 'reopen';")"
  check R "@LZ-091 Betriebs-Vorlage Block 1 ein zweites Mal (nicht mehr abgeschlossen) -> Abbruch, nichts geaendert" "1|1" \
    "$(q "$s" | grep -c 'nicht abgeschlossen')|$(nlog "$t" reopen)"

  # --- P-12 @HE-038 @LZ-044 (mit 20261110_008) ---------------------------------------------------------------
  if [[ -n "$(q "SELECT to_regprocedure('public.request_helper_access(text,text,text)');")" ]]; then
    t="$(clone "$TPL_NIKO")"
    q "UPDATE public.tournaments SET date = current_date WHERE id = '$t';" >/dev/null
    q "SELECT lc.complete_niko('$t');" >/dev/null
    code="$(q "SELECT harness.rpc(harness.p('olli'), false, format('SELECT public.ensure_helper_code(%L::uuid)', '$t'));" >/dev/null; q "SELECT harness.last() ->> 'code';")"
    fin_niko olli "$t" >/dev/null
    u="$(q "SELECT gen_random_uuid();")"
    q "INSERT INTO auth.users (instance_id, id, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES ('00000000-0000-0000-0000-000000000000', '$u', 'authenticated', 'authenticated', 'x', '{}', '{}', now(), now());" >/dev/null
    check R "P-12 @HE-038 @LZ-044 nach dem Abschluss: Scan 'closed', neue Helferin -> CLOSED" "closed|CLOSED" \
      "$(anon_val "SELECT public.join_code_info('$code') ->> 'state'")|$(q "SELECT harness.rpc('$u', true, format('SELECT public.request_helper_access(%L, %L, NULL)', '$code', 'Lena'));" >/dev/null; q "SELECT harness.last() ->> 'result';")"
    q "SELECT lc.reopen('olli', '$t', 'versehentlich abgeschlossen', gen_random_uuid());" >/dev/null
    check R "P-12 @LZ-091 nach dem Wiederoeffnen am selben Tag: Scan 'open', Anfrage moeglich" "open|PENDING" \
      "$(anon_val "SELECT public.join_code_info('$code') ->> 'state'")|$(q "SELECT harness.rpc('$u', true, format('SELECT public.request_helper_access(%L, %L, NULL)', '$code', 'Lena'));" >/dev/null; q "SELECT harness.last() ->> 'result';")"
    t="$(niko_ready)"
    q "UPDATE public.tournaments SET status = 'completed' WHERE id = '$t';" >/dev/null
    check R "P-12 W3 status 'completed' (Superuser) schliesst den Helfer-Code nicht mehr nebenbei" "f" \
      "$(q "SELECT public.tournament_closed_for_helpers('$t');")"
  else
    check R "P-12 @HE-038 braucht 20261110_008 im Lauf" "vorhanden" "fehlt"
  fi

  # --- P-13 F3 @FU-068 @LZ-018: Warnungen sperren nicht -------------------------------------------------------
  t="$(niko_ready)"
  d="$(q "SELECT md5('p13-geraet-$t')::uuid;")"
  check R "P-13 @FU-068 Tom meldet 3 wartende Eintraege an Feld 1 -> Warnung outbox_pending (Feld 1, 3), kein offener Punkt" "ok|outbox_pending|1:3" \
    "$(q "SELECT harness.exec(harness.p('tom'), true, format('SELECT public.report_device_outbox(%L::uuid, %L::uuid, 1, 3)', '$t', '$d'));" | sed 's/ok:1/ok/')|$(q "SELECT lc.preflight('olli', '$t');" | cut -d'|' -f2)|$(q "SELECT (w ->> 'field') || ':' || (w ->> 'pending') FROM jsonb_array_elements(harness.last() -> 'warnings') w;")"
  q "INSERT INTO public.field_control (tournament_id, field, epoch, holder_user_id, holder_device_id, holder_device_label, claimed_at) VALUES ('$t', 2, 1, harness.p('tom'), md5('p13-still-$t')::uuid, 'Toms Tablet', now() - interval '5 minutes');" >/dev/null
  check R "P-13 Geraet mit Feldsteuerung (Feld 2) seit 5 min ohne Meldung -> device_silent" "|outbox_pending,device_silent" \
    "$(q "SELECT lc.preflight('olli', '$t');")"
  check R "P-13 @LZ-018 Warnungen sperren nicht: abschliessen -> ok" "ok" "$(fin_niko olli "$t")"
  check R "P-13 Gegenbeispiel: Meldung 0 -> keine outbox-Warnung (anderes Turnier); Fremder meldet -> 42501" "||error:42501" \
    "$(t2="$(niko_ready)"; q "SELECT harness.exec(harness.p('tom'), true, format('SELECT public.report_device_outbox(%L::uuid, %L::uuid, 1, 0)', '$t2', '$d'));" >/dev/null; q "SELECT lc.preflight('olli', '$t2');")|$(q "SELECT harness.exec(harness.p('fremd'), false, format('SELECT public.report_device_outbox(%L::uuid, %L::uuid, 1, 3)', '$t', '$d'));")"
}

# ---------------------------------------------------------------------------------------------------------
# M: Mehrere Sitzungen -- Sperrreihenfolge (K4, Muster RT-4) und Doppel-Abschluss
# ---------------------------------------------------------------------------------------------------------
run_races() {
  local t m outb
  t="$(niko_ready)"
  m="$(q "SELECT id FROM public.matches WHERE tournament_id = '$t' ORDER BY id DESC LIMIT 1;")"
  ( docker exec -i "$CURRENT_CONTAINER" psql -U postgres -X -q -tA <<EOF > "$WORK_DIR/race-a.out" 2>&1
BEGIN;
SELECT 1 FROM public.matches WHERE id = '$m' FOR UPDATE;
SELECT pg_sleep(1.5);
UPDATE public.tournaments SET location_name = 'Halle' WHERE id = '$t';
COMMIT;
EOF
  ) &
  sleep 0.6
  outb="$(q "SET lock_timeout = '8s'; SELECT lc.finish('olli', '$t', lc.snap('$t', '$R_NIKO', '$P_NIKO'), gen_random_uuid(), match_engine.tournament_state('$t'));" | tail -1)"
  wait
  check M "K4 (ME7) Sitzung A haelt ein Spiel und schreibt dann die Turnierzeile, B schliesst zugleich ab -> A ohne Fehler, B wartet und gelingt (kein 40P01/55P03)" \
    "0|ok|finished" "$(grep -c 'ERROR' "$WORK_DIR/race-a.out")|$outb|$(life "$t")"
  t="$(niko_ready)"
  ( q "SELECT lc.finish('olli', '$t', lc.snap('$t', '$R_NIKO', '$P_NIKO'), gen_random_uuid());" > "$WORK_DIR/race-c.out" 2>&1 ) &
  outb="$(q "SELECT lc.finish('maria', '$t', lc.snap('$t', '$R_NIKO', '$P_NIKO'), gen_random_uuid());")"
  wait
  check M "@LZ-021 Olli und Maria schliessen gleichzeitig ab -> genau einer ok, der andere ALREADY_FINISHED; ein Verlaufseintrag" \
    "ok,rejected:ALREADY_FINISHED|1" "$(printf '%s\n%s\n' "$(tail -1 "$WORK_DIR/race-c.out")" "$outb" | sort | paste -sd, -)|$(nlog "$t" finish)"
}

# ---------------------------------------------------------------------------------------------------------
# S: Katalog und Rechte-Assertions
# ---------------------------------------------------------------------------------------------------------
run_catalog() {
  check S "RPCs finish_tournament, finish_preflight, reopen_tournament, report_device_outbox: SECURITY DEFINER, search_path, nur authenticated" "4" \
    "$(q "SELECT count(*) FROM pg_proc p WHERE p.oid IN ('public.finish_tournament(uuid,jsonb,jsonb,uuid)'::regprocedure, 'public.finish_preflight(uuid)'::regprocedure, 'public.reopen_tournament(uuid,text,uuid)'::regprocedure, 'public.report_device_outbox(uuid,uuid,integer,integer)'::regprocedure) AND p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp'] AND has_function_privilege('authenticated', p.oid, 'EXECUTE') AND NOT has_function_privilege('anon', p.oid, 'EXECUTE');")"
  check S "public_final_standings, display_final_standings: anon und authenticated; tournament_lifecycle: INVOKER, anon und authenticated" "2|t" \
    "$(q "SELECT count(*) FROM pg_proc p WHERE p.oid IN ('public.public_final_standings(text)'::regprocedure, 'public.display_final_standings(uuid)'::regprocedure) AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE') AND has_function_privilege('authenticated', p.oid, 'EXECUTE');")|$(q "SELECT NOT prosecdef AND has_function_privilege('anon', oid, 'EXECUTE') FROM pg_proc WHERE oid = 'public.tournament_lifecycle(uuid)'::regprocedure;")"
  check S "Hilfen (match_engine) und tournament_is_closed: kein EXECUTE fuer Client-Rollen" "0" \
    "$(q "SELECT count(*) FROM pg_proc p WHERE (p.pronamespace = 'match_engine'::regnamespace AND p.proname IN ('tournament_state', 'match_winner', 'finish_open_items', 'finish_warnings', 'json_int_between', 'json_text_length_between', 'final_standing_row_valid', 'scorer_row_valid', 'final_standings_shape_valid', 'place_numbers_valid', 'final_standings_consistent', 'closed_intake', 'actor_name', 'final_standings_payload') OR p.oid IN ('public.tournament_is_closed(uuid)'::regprocedure, 'public.guard_closed_tournament()'::regprocedure, 'public.tournaments_guard_lifecycle()'::regprocedure, 'public.tournaments_lifecycle_follow_status()'::regprocedure)) AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));")"
  check S "W5 Trigger-Reihenfolge auf matches (BEFORE, alphabetisch): matches_guard_closed zuerst" \
    "matches_guard_closed,matches_guard_engine_columns,matches_guard_ga4_columns,matches_guard_kit_columns,matches_keep_origin" \
    "$(q "SELECT string_agg(tgname, ',' ORDER BY tgname) FROM pg_trigger WHERE tgrelid = 'public.matches'::regclass AND NOT tgisinternal AND (tgtype & 2) = 2 AND (tgtype & 16) = 16 AND tgname IN ('matches_guard_closed', 'matches_guard_engine_columns', 'matches_guard_ga4_columns', 'matches_guard_kit_columns', 'matches_keep_origin');")"
  check S "neue Tabellen: anon nichts, authenticated nur SELECT (Endstand, Verlauf, spaete Eintraege), device_outbox_reports gar nichts" "t" \
    "$(q "SELECT bool_and(NOT has_table_privilege('anon', ('public.' || t)::regclass, 'SELECT,INSERT,UPDATE,DELETE') AND NOT has_table_privilege('authenticated', ('public.' || t)::regclass, 'INSERT,UPDATE,DELETE') AND has_table_privilege('authenticated', ('public.' || t)::regclass, 'SELECT') = (t <> 'device_outbox_reports')) FROM unnest(ARRAY['tournament_final_standings', 'tournament_lifecycle_log', 'late_entries', 'device_outbox_reports']) t;")"
}

run_assertions() {
  local priv names_sql names_sh
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | q "$(cat)" 2>&1)" || priv="nicht ausfuehrbar: $priv"
  check S "Rechte-Assertion: keine Zeile |f" "" "$(grep -v '|t$' <<<"$priv" || true)"
  check S "Rechte-Assertion: die A-21a-Zeilen (lifecycle-*) vorhanden und |t" "16|16" \
    "$(grep -cE '^lifecycle-[a-z0-9-]+\|' <<<"$priv")|$(grep -cE '^lifecycle-[a-z0-9-]+\|t$' <<<"$priv")"
  names_sql="$(grep -E '^[a-z0-9-]+\|[tf]$' <<<"$priv" | cut -d'|' -f1 | sort)"
  names_sh="$(awk '/^PRIVILEGE_ASSERTION_NAMES=\(/{f=1; next} f && /^\)/{exit} f' "$REPO_ROOT/scripts/db-drift-check.sh" | grep -oE '^  "[a-z0-9-]+"' | tr -d ' "' | sort)"
  check S "Namensliste PRIVILEGE_ASSERTION_NAMES = Namen der SQL-Datei (diff leer)" "" "$(diff <(echo "$names_sh") <(echo "$names_sql") || true)"
}
