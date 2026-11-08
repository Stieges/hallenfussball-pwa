# shellcheck shell=bash
#
# lib/hallenton-torhymne-check.sh — Kategorie T von scripts/hallenton-check.sh: Container-Beweis fuer
# supabase/migrations/20261123_001_hallenton_torhymne.sql (Torhymne, Record docs/anforderungen/2026-10-15_hallenton.md,
# @HT-024, @HT-046). Per `source` eingebunden; nutzt check/probe/short/q/schema_dump, die Identitaeten IDS und die
# Testdaten des Hauptskripts (Hallencup Nord mit 2 Feldern, Hallencup Sued, Altturnier im Papierkorb).
#
# T  Fail-fast (Baseline allein), Rollen (jede Identitaet setzt die Hymnen), Szenario-Zeilen (drei Hymnen in Reihenfolge,
#    Stand voll/schmal, Leeren, hoechstens 5, falscher Pfad, doppelt, NULL, nach Turnierende, Papierkorb), Lebenszeichen nach
#    Turnierende 55000, Schema (Funktion, Spalte, Pruefregel), Rechte-Assertions vorher |f / nachher |t, zweites Einspielen,
#    Rueckweg (Schema danach = vorher, danach erneut einspielbar).

FOLLOW_NAME="20261123_001_hallenton_torhymne.sql"
FOLLOW_FILE="$MIGRATIONS_DIR/$FOLLOW_NAME"
FOLLOW_RUECKWEG="$REPO_ROOT/supabase/rollbacks/20261123_001_hallenton_torhymne_rollback.sql"
FOLLOW_ASSERTIONS="hallenton-goal-anthems-rpc-authenticated-only hallenton-goal-anthems-column-checked hallenton-heartbeat-closed-tournament"

hymne() { echo "$T_NORD/$(uuid_for "hymne:$1").${2:-mp3}"; }
H_A="$(hymne a)"; H_B="$(hymne b wav)"; H_C="$(hymne c m4a)"
ANTHEMS() { echo "SELECT 'r:' || (public.hall_goal_anthems_set('$1'::uuid, $2) ->> 'status');"; }
ANTHEM_ROW="SELECT coalesce((SELECT goal_anthem_paths::text FROM public.hall_sound_settings WHERE tournament_id = '$T_NORD'), 'keine')"
arr() { local out="" p; for p in "$@"; do out="$out${out:+, }'$p'"; done; echo "ARRAY[$out]::text[]"; }

# Rueckweg ohne Versionspruefung (nur Gegenprobe: eine Mutante hat absichtlich eine andere Fassung)
follow_rueckweg_ohne_pruefung() { python3 -c "
import re, sys
t = open(sys.argv[1], encoding='utf-8').read()
print(re.sub(r'DO \\\$rw\\\$.*?\\\$rw\\\$;\n', '', t, count=1, flags=re.S))" "$FOLLOW_RUECKWEG"; }

follow_assertions() { # <erwartet t|f>
  local priv a
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  for a in $FOLLOW_ASSERTIONS; do
    check T "Rechte-Assertion: $a |$1" "$a|$1" "$(grep -E "^$a\|" <<<"$priv" || true)"
  done
  [[ "$1" == t ]] && check T "Rechte-Assertion nach der Torhymne: keine Zeile |f" "" "$(grep -v '|t$' <<<"$priv" || true)"
  [[ "$1" == t ]] && check T "Drift-Check-Zuordnung: pending_assertions_for nennt fuer $FOLLOW_NAME genau die neuen Namen" \
    "$FOLLOW_ASSERTIONS" "$(after_assertions "$FOLLOW_NAME")"
  return 0
}

run_torhymne_probes() {
  local entry name uid e_manage e_lead e_status setup exp
  # --- @HT-022/@HT-044: jede Identitaet setzt die Hymnen --------------------------------------------------------
  for entry in "${IDS[@]}"; do
    IFS=: read -r name uid e_manage e_lead e_status <<<"$entry"
    setup=""; [[ "$uid" == "$U_MARIA" ]] && setup="$REVOKED"
    exp="saved|{$H_A,$H_B}"; [[ "$e_manage" == ok ]] || exp="$e_manage|keine"
    check T "@HT-024 $name setzt die Torhymnen A und B" "$exp" \
      "$(short "$(probe "$uid" "$setup" "$(ANTHEMS "$T_NORD" "$(arr "$H_A" "$H_B")")" "$ANTHEM_ROW")")"
    check T "@HT-046 abgeschlossen: $name setzt die Torhymnen" "$([[ "$e_manage" == ok ]] && echo geschlossen || echo "$e_manage")|keine" \
      "$(short "$(probe "$uid" "$setup $CLOSED" "$(ANTHEMS "$T_NORD" "$(arr "$H_A")")" "$ANTHEM_ROW")")"
  done

  # --- @HT-024: Liste und Stand -----------------------------------------------------------------------------------
  check T "@HT-024 Olli laedt „Hymne A“, „Hymne B“, „Hymne C“ hoch -> gespeichert in dieser Reihenfolge" "saved|{$H_A,$H_B,$H_C}" \
    "$(probe "$U_OLLI" "" "$(ANTHEMS "$T_NORD" "$(arr "$H_A" "$H_B" "$H_C")")" "$ANTHEM_ROW")"
  check T "@HT-024 Stand (volle Sicht) liefert goalAnthemPaths in der Reihenfolge" "[\"$H_A\", \"$H_B\", \"$H_C\"]|1" \
    "$(probe "$U_OLLI" "INSERT INTO public.hall_sound_settings (tournament_id, goal_anthem_paths) VALUES ('$T_NORD', $(arr "$H_A" "$H_B" "$H_C"));" \
       "SELECT 'r:' || (public.hall_sound_status('$T_NORD'::uuid) -> 'settings' ->> 'goalAnthemPaths');" "1")"
  check T "@HT-024 ohne Zeile: goalAnthemPaths leer, Vorbelegung sonst wie bisher" "[]:horn-1:[]|1" \
    "$(probe "$U_OLLI" "" "SELECT 'r:' || (r -> 'settings' ->> 'goalAnthemPaths') || ':' || (r -> 'settings' ->> 'halftimeSound') || ':' || (r -> 'settings' ->> 'goalToneFields') FROM (SELECT public.hall_sound_status('$T_NORD'::uuid) r) x;" "1")"
  check T "@HT-040 Helfer Tom: schmale Sicht ohne Tonwahl und ohne Hymnen" "knapp:nein|1" \
    "$(probe "$U_TOM" "$SPEAKER_R INSERT INTO public.hall_sound_settings (tournament_id, goal_anthem_paths) VALUES ('$T_NORD', $(arr "$H_A"));" \
       "SELECT 'r:' || CASE WHEN r ? 'leads' THEN 'voll' ELSE 'knapp' END || ':' || CASE WHEN r::text LIKE '%$H_A%' OR r ? 'settings' THEN 'ja' ELSE 'nein' END FROM (SELECT public.hall_sound_status('$T_NORD'::uuid) r) x;" "1")"
  check T "@HT-024 leere Liste leert die Hymnen" "saved|{}" \
    "$(probe "$U_OLLI" "INSERT INTO public.hall_sound_settings (tournament_id, goal_anthem_paths) VALUES ('$T_NORD', $(arr "$H_A"));" "$(ANTHEMS "$T_NORD" "'{}'::text[]")" "$ANTHEM_ROW")"
  check T "hoechstens 5: fuenf Hymnen -> gespeichert" "saved|5" \
    "$(probe "$U_OLLI" "" "$(ANTHEMS "$T_NORD" "$(arr "$(hymne 1)" "$(hymne 2)" "$(hymne 3)" "$(hymne 4)" "$(hymne 5)")")" "SELECT cardinality(goal_anthem_paths) FROM public.hall_sound_settings")"
  check T "gegen-zu viele: sechs Hymnen -> ungueltig, nichts gespeichert" "ungueltig|keine" \
    "$(short "$(probe "$U_OLLI" "" "$(ANTHEMS "$T_NORD" "$(arr "$(hymne 1)" "$(hymne 2)" "$(hymne 3)" "$(hymne 4)" "$(hymne 5)" "$(hymne 6)")")" "$ANTHEM_ROW")")"
  check T "gegen-zu viele: bestehende Liste bleibt bei sechs unveraendert" "ungueltig|{$H_A}" \
    "$(short "$(probe "$U_OLLI" "INSERT INTO public.hall_sound_settings (tournament_id, goal_anthem_paths) VALUES ('$T_NORD', $(arr "$H_A"));" "$(ANTHEMS "$T_NORD" "$(arr "$(hymne 1)" "$(hymne 2)" "$(hymne 3)" "$(hymne 4)" "$(hymne 5)" "$(hymne 6)")")" "$ANTHEM_ROW")")"
  local falsch label
  for falsch in "fremdes Turnier:$T_SUED/$(uuid_for hymne:a).mp3" "Format .ogg:$(hymne a ogg)" "Grossbuchstaben:$(tr 'a-f' 'A-F' <<<"$(hymne a)")" \
                "Unterordner:$T_NORD/x/$(uuid_for hymne:a).mp3" "ohne uuid:$T_NORD/hymne-a.mp3" "leerer Pfad:"; do
    label="${falsch%%:*}"
    check T "gegen-falscher Pfad ($label) -> ungueltig" "ungueltig|keine" \
      "$(short "$(probe "$U_OLLI" "" "$(ANTHEMS "$T_NORD" "$(arr "${falsch#*:}" "$H_A")")" "$ANTHEM_ROW")")"
  done
  check T "gegen-Komma: ein Eintrag „A,B“ (zwei gueltige Pfade zusammengeklebt) -> ungueltig" "ungueltig|keine" \
    "$(short "$(probe "$U_OLLI" "" "$(ANTHEMS "$T_NORD" "ARRAY['$H_A,$H_B']::text[]")" "$ANTHEM_ROW")")"
  check T "gegen-Komma: Eintrag „A,B“ neben C -> ungueltig" "ungueltig|keine" \
    "$(short "$(probe "$U_OLLI" "" "$(ANTHEMS "$T_NORD" "ARRAY['$H_C', '$H_A,$H_B']::text[]")" "$ANTHEM_ROW")")"
  check T "gegen-direkt: Pruefregel haelt auch ohne Funktion (Superuser schreibt „A,B“ als einen Eintrag)" "pruefregel|1" \
    "$(short "$(probe "$U_OLLI" "" "RESET ROLE; INSERT INTO public.hall_sound_settings (tournament_id, goal_anthem_paths) VALUES ('$T_NORD', ARRAY['$H_A,$H_B']);" "1")")"
  check T "gegen-doppelte Hymne (A, B, A) -> ungueltig" "ungueltig|keine" \
    "$(short "$(probe "$U_OLLI" "" "$(ANTHEMS "$T_NORD" "$(arr "$H_A" "$H_B" "$H_A")")" "$ANTHEM_ROW")")"
  check T "gegen-Liste NULL -> ungueltig" "ungueltig|keine" \
    "$(short "$(probe "$U_OLLI" "" "$(ANTHEMS "$T_NORD" "NULL")" "$ANTHEM_ROW")")"
  check T "gegen-Eintrag NULL -> ungueltig" "ungueltig|keine" \
    "$(short "$(probe "$U_OLLI" "" "$(ANTHEMS "$T_NORD" "ARRAY['$H_A', NULL]::text[]")" "$ANTHEM_ROW")")"
  check T "gegen-mehrdimensionale Liste -> ungueltig" "ungueltig|keine" \
    "$(short "$(probe "$U_OLLI" "" "$(ANTHEMS "$T_NORD" "ARRAY[['$H_A'], ['$H_B']]::text[]")" "$ANTHEM_ROW")")"
  check T "gegen-Papierkorb: Olli im geloeschten Altturnier -> abgelehnt" "abgelehnt|0" \
    "$(short "$(probe "$U_OLLI" "" "$(ANTHEMS "$T_ALT" "ARRAY['$T_ALT/$(uuid_for hymne:a).mp3']::text[]")" "SELECT count(*) FROM public.hall_sound_settings")")"
  check T "gegen-unbekanntes Turnier -> abgelehnt (wie „darf nicht“)" "abgelehnt|0" \
    "$(short "$(probe "$U_OLLI" "" "$(ANTHEMS "$(uuid_for tournament:gibt-es-nicht)" "'{}'::text[]")" "SELECT count(*) FROM public.hall_sound_settings")")"
  check T "Tonwahl aendern laesst die Hymnen stehen (hall_sound_settings_set)" "saved|horn-2:{$H_A,$H_B}" \
    "$(probe "$U_OLLI" "INSERT INTO public.hall_sound_settings (tournament_id, goal_anthem_paths) VALUES ('$T_NORD', $(arr "$H_A" "$H_B"));" "$(SETTINGS "$T_NORD" "'horn-2'" NULL NULL 1)" \
       "SELECT halftime_sound || ':' || goal_anthem_paths::text FROM public.hall_sound_settings")"
  check T "Hymnen setzen laesst die Tonwahl stehen (Halbzeit horn-3, Ton bei Tor Feld 2)" "saved|horn-3:{2}:{$H_C}" \
    "$(probe "$U_OLLI" "INSERT INTO public.hall_sound_settings (tournament_id, halftime_sound, goal_tone_fields) VALUES ('$T_NORD', 'horn-3', '{2}');" "$(ANTHEMS "$T_NORD" "$(arr "$H_C")")" \
       "SELECT halftime_sound || ':' || goal_tone_fields::text || ':' || goal_anthem_paths::text FROM public.hall_sound_settings")"
  check T "gegen-direkt: Pruefregel haelt auch ohne Funktion (Superuser schreibt sechs Hymnen)" "pruefregel|1" \
    "$(short "$(probe "$U_OLLI" "" "RESET ROLE; INSERT INTO public.hall_sound_settings (tournament_id, goal_anthem_paths) VALUES ('$T_NORD', $(arr "$(hymne 1)" "$(hymne 2)" "$(hymne 3)" "$(hymne 4)" "$(hymne 5)" "$(hymne 6)"));" "1")")"
  check T "gegen-direkt: Pruefregel haelt auch ohne Funktion (Superuser schreibt einen fremden Pfad)" "pruefregel|1" \
    "$(short "$(probe "$U_OLLI" "" "RESET ROLE; INSERT INTO public.hall_sound_settings (tournament_id, goal_anthem_paths) VALUES ('$T_NORD', ARRAY['$T_SUED/$(uuid_for hymne:a).mp3']);" "1")")"
  check T "gegen-direkt: Clara schreibt die Hymnen ohne Funktion -> kein Tabellenrecht" "kein-tabellenrecht|0" \
    "$(short "$(probe "$U_CLARA" "" "INSERT INTO public.hall_sound_settings (tournament_id, goal_anthem_paths) VALUES ('$T_NORD', $(arr "$H_A"));" "SELECT count(*) FROM public.hall_sound_settings")")"

  # --- Lebenszeichen nach dem Turnierende (Ruling W1, @HT-046) ---------------------------------------------------------
  check T "@HT-046 abgeschlossen: Lebenszeichen des Rechners -> geschlossen (55000), Zustand unveraendert" "geschlossen|$D_R:not_activated" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R $CLOSED" "$(HB "$T_NORD" "$D_R" 1 ready)" "$(ROW_R 1)")")"
  check T "@HT-046 abgebrochen (cancelled): Lebenszeichen -> geschlossen" "geschlossen|$D_R:not_activated" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R SET LOCAL app.lifecycle_write = 'on'; UPDATE public.tournaments SET lifecycle_status = 'cancelled' WHERE id = '$T_NORD'; RESET app.lifecycle_write;" "$(HB "$T_NORD" "$D_R" 1 ready)" "$(ROW_R 1)")")"
  check T "@HT-046 abgeschlossen: Helfer Tom bleibt beim Lebenszeichen abgelehnt (Recht vor Sperre)" "abgelehnt|$D_R:not_activated" \
    "$(short "$(probe "$U_TOM" "$SPEAKER_R $CLOSED" "$(HB "$T_NORD" "$D_R" 1 ready)" "$(ROW_R 1)")")"
  check T "@HT-046 abgeschlossen: Quittung, Ausschalten und Lesen bleiben erlaubt" "acked,released,voll|0" \
    "$(probe "$U_OLLI" "$SPEAKER_R_TEST $CLOSED" "$(ACK "$T_NORD" 1 "$D_R" "$TEST_ID")
$(RELEASE "$T_NORD" 1 "$D_R")
$(STATUS_HAS "$T_NORD")" "SELECT count(*) FROM public.hall_speakers")"
  check T "@HT-046 abgeschlossen: Lebenszeichen der Leitung bleibt erlaubt (Tom haelt die Steuer)" "ok|1" \
    "$(probe "$U_TOM" "$(HOLDER "$U_TOM" "$D_H") $CLOSED" "$(LEAD "$T_NORD" 1 "$D_H")" "SELECT count(*) FROM public.hall_field_leads")"
  check T "Turnier offen: Lebenszeichen wie bisher (ok, bereit)" "ok|$D_R:ready" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "$(HB "$T_NORD" "$D_R" 1 ready)" "$(ROW_R 1)")"
}

TFN_STATE_SQL="SELECT p.proname || ':' || p.prosecdef || ':' || coalesce(p.proconfig::text, '-') || ':' || has_function_privilege('anon', p.oid, 'EXECUTE') || ':' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || ':' || has_function_privilege('service_role', p.oid, 'EXECUTE') || ':' || (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0))::text FROM pg_proc p WHERE p.oid = to_regprocedure('public.hall_goal_anthems_set(uuid,text[])');"
TCOL_SQL="SELECT format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull || ':' || pg_get_expr(d.adbin, d.adrelid) FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum WHERE a.attrelid = 'public.hall_sound_settings'::regclass AND a.attname = 'goal_anthem_paths';"
TDATA_SQL="SELECT coalesce(string_agg(tournament_id || '=' || goal_anthem_paths::text, ';' ORDER BY tournament_id), '-') FROM public.hall_sound_settings;"

# Fail-fast auf der Baseline allein (im F-Abschnitt des Hauptskripts aufgerufen, Container nur mit Baseline)
torhymne_fail_fast() {
  local dump out rc
  dump="$(schema_dump)"
  set +e; out="$(psql_stdin < "$FOLLOW_FILE" 2>&1)"; rc=$?; set -e
  check T "Torhymne auf der Baseline allein: bricht ab mit Hinweis" "abbruch|ja" \
    "$([[ "$rc" -ne 0 ]] && echo abbruch || echo "lief($rc)")|$([[ "$out" == *"20261123_001_hallenton_torhymne: Hallenton fehlt -- zuerst 20261121_001_hallenton einspielen"* ]] && echo ja || echo "nein: $out")"
  check T "Torhymne auf der Baseline allein: Schema unveraendert" "identisch" "$([[ "$(schema_dump)" == "$dump" ]] && echo identisch || echo verschieden)"
}

# Kategorie T im normalen Lauf: 20261121_001 und alle Migrationen davor/dazwischen sind eingespielt.
run_torhymne_section() {
  local dump_before dump_after data out rc
  follow_assertions f
  check T "vorher: Spalte goal_anthem_paths fehlt, Funktion fehlt" "0|" \
    "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hall_sound_settings' AND column_name = 'goal_anthem_paths';")|$(q "$TFN_STATE_SQL")"
  dump_before="$(schema_dump)"
  # Bestand: eine Tonwahl-Zeile aus der Zeit vor der Torhymne bekommt die leere Liste
  psql_stdin <<SQL
INSERT INTO public.hall_sound_settings (tournament_id, halftime_sound) VALUES ('$T_SUED', 'horn-2');
SQL
  echo "Ziel: $FOLLOW_NAME" >&2
  psql_stdin < "$FOLLOW_FILE"
  check T "Bestand: vorhandene Tonwahl-Zeile hat danach die leere Liste, Halbzeit-Ton bleibt" "horn-2:{}" \
    "$(q "SELECT halftime_sound || ':' || goal_anthem_paths::text FROM public.hall_sound_settings WHERE tournament_id = '$T_SUED';")"
  psql_stdin <<SQL
DELETE FROM public.hall_sound_settings WHERE tournament_id = '$T_SUED';
SQL
  check T "Funktion hall_goal_anthems_set: Definer, search_path fest, nur authenticated, kein PUBLIC" \
    "hall_goal_anthems_set:true:{\"search_path=public, pg_temp\"}:false:true:false:false" "$(q "$TFN_STATE_SQL")"
  check T "Spalte goal_anthem_paths: text[], NOT NULL, Vorbelegung leer" "text[]:true:'{}'::text[]" "$(q "$TCOL_SQL")"
  check T "Pruefregel hall_sound_settings_goal_anthems vorhanden" "1" \
    "$(q "SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.hall_sound_settings'::regclass AND conname = 'hall_sound_settings_goal_anthems';")"
  check T "hall_sound_settings_set: Signatur unveraendert, kein Ueberladen" "1:1" \
    "$(q "SELECT count(*) FROM pg_proc WHERE proname = 'hall_sound_settings_set';"):$(q "SELECT count(*) FROM pg_proc WHERE proname = 'hall_goal_anthems_set';")"
  check T "Tabellen: weiter RLS an, keine Policy, kein Recht fuer anon/authenticated" \
    "hall_field_leads:true:0:false:false:true:false # hall_sound_settings:true:0:false:false:true:false # hall_speakers:true:0:false:false:true:false" "$(q "$TABLE_STATE_SQL")"
  follow_assertions t
  run_torhymne_probes
  dump_after="$(schema_dump)"

  # --- zweites Einspielen ---------------------------------------------------------------------------------------
  psql_stdin <<SQL
INSERT INTO public.hall_sound_settings (tournament_id, goal_anthem_paths) VALUES ('$T_NORD', ARRAY['$H_A', '$H_B']);
SQL
  data="$(q "$TDATA_SQL")"
  set +e; psql_stdin < "$FOLLOW_FILE" >/dev/null 2>&1; rc=$?; set -e
  check T "zweites Einspielen: Exit 0, Schema wie nach dem ersten, Hymnen gleich" "0|identisch|gleich" \
    "$rc|$([[ "$(schema_dump)" == "$dump_after" ]] && echo identisch || echo verschieden)|$([[ "$(q "$TDATA_SQL")" == "$data" ]] && echo gleich || echo verschieden)"

  # --- Rueckweg ---------------------------------------------------------------------------------------------------
  set +e; out="$(psql_stdin < "$FOLLOW_RUECKWEG" 2>&1)"; rc=$?; set -e
  check T "Rueckweg: laeuft (Exit 0)" "0" "$rc${out:+ ($out)}"
  check T "nach dem Rueckweg: Schema public = vor der Torhymne (pg_dump identisch)" "identisch" \
    "$([[ "$(schema_dump)" == "$dump_before" ]] && echo identisch || echo verschieden)"
  [[ "$(schema_dump)" == "$dump_before" ]] || { diff <(echo "$dump_before") <(schema_dump) | head -40 || true; }
  check T "nach dem Rueckweg: Tonwahl-Zeile bleibt, Lebenszeichen nach Turnierende wieder ok (Fassung 20261121_001)" "1|ok" \
    "$(q "SELECT count(*) FROM public.hall_sound_settings WHERE tournament_id = '$T_NORD';")|$(short "$(probe "$U_OLLI" "$SPEAKER_R $CLOSED" "$(HB "$T_NORD" "$D_R" 1 ready)" "1")" | cut -d'|' -f1)"
  set +e; out="$(psql_stdin < "$FOLLOW_RUECKWEG" 2>&1)"; rc=$?; set -e
  check T "Rueckweg ein zweites Mal: bricht ab, nichts geaendert" "abbruch|ja|identisch" \
    "$([[ "$rc" -ne 0 ]] && echo abbruch || echo lief)|$([[ "$out" == *"Rueckweg 20261123_001: Torhymne nicht in der Fassung 20261123_001"* ]] && echo ja || echo "nein: $out")|$([[ "$(schema_dump)" == "$dump_before" ]] && echo identisch || echo verschieden)"
  psql_stdin <<SQL
DELETE FROM public.hall_sound_settings;
SQL
  psql_stdin < "$FOLLOW_FILE"
  check T "danach erneut einspielbar (Schema = erstes Einspielen)" "identisch" "$([[ "$(schema_dump)" == "$dump_after" ]] && echo identisch || echo verschieden)"
}

# Gegenprobe ohne die Torhymne (--without-migration): T muss rot sein.
run_torhymne_without() {
  run_torhymne_probes
}

# Gegenprobe je Mutation der Torhymne (--gegenprobe): Rueckweg ohne Versionspruefung, Mutante einspielen, T muss rot sein.
TORHYMNE_MUTATIONS=(
  "TM1|Lebenszeichen ohne Sperre nach dem Turnierende|  PERFORM public.hall_require(p_tournament_id, 'manageScreens');\n  PERFORM public.hall_require_open(p_tournament_id);\n  IF p_device_id IS NULL|  PERFORM public.hall_require(p_tournament_id, 'manageScreens');\n  IF p_device_id IS NULL"
  "TM2|Hymnen setzen mit writeMatchData (Helfer setzt die Hymnen)|  PERFORM public.hall_require(p_tournament_id, 'manageScreens');\n  PERFORM public.hall_require_open(p_tournament_id);\n  IF p_paths IS NULL|  PERFORM public.hall_require(p_tournament_id, 'writeMatchData');\n  PERFORM public.hall_require_open(p_tournament_id);\n  IF p_paths IS NULL"
  "TM3|Hymnen setzen nach dem Turnierende erlaubt|  PERFORM public.hall_require_open(p_tournament_id);\n  IF p_paths IS NULL|  IF p_paths IS NULL"
  "TM4|sechs statt fuenf Hymnen|cardinality(goal_anthem_paths) > 5 THEN false|cardinality(goal_anthem_paths) > 6 THEN false"
  "TM5|doppelte Hymnen erlaubt|     OR (SELECT count(DISTINCT u.x) FROM unnest(p_paths) AS u(x)) <> cardinality(p_paths) THEN|     THEN"
  "TM6|anon behaelt EXECUTE (PUBLIC)|REVOKE ALL ON FUNCTION public.hall_goal_anthems_set(uuid, text[]) FROM PUBLIC, anon, service_role;\n|"
  "TM7|Pfad ohne Turnier-Bindung (fremdes Turnier erlaubt)|('^(' || tournament_id::text\n                    || '/|('^([0-9a-f-]{36}'\n                    || '/"
  "TM9|Komma in einem Eintrag erlaubt (zusammengeklebte Pfade)|                AND position(',' IN array_to_string(goal_anthem_paths, '')) = 0\n|"
  "TM8|Stand ohne goalAnthemPaths|                                                    'goalAnthemPaths', to_jsonb(st.goal_anthem_paths))|                                                    'goalAnthemPaths', '[]'::jsonb)"
)
run_torhymne_gegenprobe() { # nach apply_before + apply_target + spaeteren Migrationen vor der Torhymne
  local mut mid mtext mfrom mto mutated red=0 sel=()
  for mut in "${TORHYMNE_MUTATIONS[@]}"; do
    [[ -z "${GEGENPROBE_NUR:-}" || " $GEGENPROBE_NUR " == *" ${mut%%|*} "* ]] && sel+=("$mut")
  done
  psql_stdin < "$FOLLOW_FILE"
  for mut in ${sel[@]+"${sel[@]}"}; do
    IFS='|' read -r mid mtext mfrom mto <<<"$mut"
    mutated="$WORK_DIR/$mid.sql"
    python3 - "$FOLLOW_FILE" "$mutated" "$mfrom" "$mto" <<'PY' || { echo "::error::Mutation $mid nicht anwendbar"; exit 1; }
import sys
src, dst = sys.argv[1], sys.argv[2]
frm = sys.argv[3].replace('\\n', '\n')
to = sys.argv[4].replace('\\n', '\n')
text = open(src, encoding='utf-8').read()
if text.count(frm) != 1:
    sys.exit(f"Mutation: Stelle nicht genau einmal gefunden: {frm!r} ({text.count(frm)}x)")
open(dst, 'w', encoding='utf-8').write(text.replace(frm, to))
PY
    follow_rueckweg_ohne_pruefung | psql_stdin
    # Fail-fast der Mutante mit der Fassung 20261121_001 erfuellt; eine Mutante des Lebenszeichens hat eine andere md5 ->
    # fuer die Gegenprobe den md5-Block ueberspringen
    python3 -c "
import re, sys
t = open(sys.argv[1], encoding='utf-8').read()
t = re.sub(r\"  IF coalesce\(md5.*?END IF;\n\", '', t, count=1, flags=re.S)
open(sys.argv[1], 'w', encoding='utf-8').write(t)" "$mutated"
    psql_stdin < "$mutated"
    reset_counts
    echo "--- GEGENPROBE $mid: $mtext ---"
    { run_torhymne_probes; follow_assertions t; } >"$WORK_DIR/$mid.out"
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "GEGENPROBE $mid: rot ($(total_dev) Abweichung(en)) -- wie verlangt"
      grep -m3 '^ABWEICHUNG' "$WORK_DIR/$mid.out" | sed 's/^/    /'
      red=$((red + 1))
    else
      echo "::error::GEGENPROBE $mid blieb gruen (zahnlos)"
    fi
  done
  follow_rueckweg_ohne_pruefung | psql_stdin
  echo "Gegenprobe Torhymne: $red von ${#sel[@]} Mutationen rot."
  [[ "$red" -eq "${#sel[@]}" ]]
}
