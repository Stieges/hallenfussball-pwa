# shellcheck shell=bash
#
# lib/hallenton-ausgang-check.sh — Kategorie A von scripts/hallenton-check.sh: Container-Beweis fuer
# supabase/migrations/20261125_001_hallenton_ausgang_zustaende.sql (Zustaende output_lost und output_unconfirmed, Abmelden fremder
# Geraete; Record docs/anforderungen/2026-10-15_hallenton.md, @HT-053, @HT-054, @HT-055, @HT-057). Per `source` eingebunden; nutzt
# check/probe/short/q/schema_dump, die Identitaeten IDS und die Testdaten des Hauptskripts und die Torhymne-Datei (FOLLOW_FILE).
#
# A  Fail-fast (Baseline allein, fremde Fassung des Lebenszeichens, fremde Pruefregel), Rollen (jede Identitaet sendet die neuen
#    Zustaende und meldet ab), Szenario-Zeilen (neue Zustaende angenommen, unbekannte weiter 22023, Abmelden fremder Geraete,
#    Antwort ohne Geraete-Kennung, das abgemeldete Geraet sieht 'unassigned'), RUECKWAERTSVERTRAEGLICHKEIT (alter Ablauf mit den
#    sechs Zustaenden, Antwortform des Lebenszeichens, Rumpf des Lebenszeichens und des Stands bis auf die Zustandsliste gleich,
#    keine Funktion entfaellt), Schema, Rechte-Assertions vorher |f / nachher |t, zweites Einspielen, Rueckweg (Schema danach =
#    vorher, neue Zustaende werden NULL), danach erneut einspielbar.

AUSG_NAME="20261125_001_hallenton_ausgang_zustaende.sql"
AUSG_FILE="$MIGRATIONS_DIR/$AUSG_NAME"
AUSG_RUECKWEG="$REPO_ROOT/supabase/rollbacks/20261125_001_hallenton_ausgang_zustaende_rollback.sql"
AUSG_ASSERTIONS="hallenton-output-states-heartbeat hallenton-speaker-unassign-rpc-authenticated-only"
SIX_STATES="ready not_activated background slept custom_sound_failed volume_zero"
HB_MD5_TORHYMNE="223c2fcfc5c884d50400163f64c541bd"
STATUS_MD5_TORHYMNE="ad84e366133f55a3e515ed416915ec66"

UNASSIGN() { echo "SELECT 'r:' || (r ->> 'status') || ':' || (r -> 'fields')::text FROM (SELECT public.hall_speaker_unassign('$1'::uuid, $2) r) x;"; }
HB_ST() { echo "SELECT 'r:' || (public.hall_speaker_heartbeat('$1'::uuid, '$2'::uuid, '{$3}'::int[], $4) ->> 'status');"; }
SPEAKER_Z2="INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name, state, last_seen)
VALUES ('$T_NORD', 2, '$D_Z', 'Zweites Geraet', 'ready', now() - interval '2 seconds');"
ROWS_ALL="SELECT coalesce((SELECT string_agg(field_id::text || ':' || device_id::text, ',' ORDER BY field_id) FROM public.hall_speakers WHERE tournament_id = '$T_NORD'), 'keine')"
HB_BODY_MD5_SQL="SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.hall_speaker_heartbeat(uuid,uuid,integer[],text,boolean)');"
HB_BODY_ALT_SQL="SELECT md5(replace(prosrc, ', ''output_lost'', ''output_unconfirmed'')', ')')) FROM pg_proc WHERE oid = to_regprocedure('public.hall_speaker_heartbeat(uuid,uuid,integer[],text,boolean)');"
STATUS_MD5_SQL="SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.hall_sound_status(uuid,uuid)');"
HALL_SIGS_SQL="SELECT coalesce(string_agg(p.oid::regprocedure::text, ' # ' ORDER BY p.oid::regprocedure::text), '-') FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'hall\\_%';"
STATE_DEF_SQL="SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.hall_speakers'::regclass AND conname = 'hall_speakers_state_check';"
AFN_STATE_SQL="SELECT p.proname || ':' || p.prosecdef || ':' || coalesce(p.proconfig::text, '-') || ':' || has_function_privilege('anon', p.oid, 'EXECUTE') || ':' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || ':' || has_function_privilege('service_role', p.oid, 'EXECUTE') || ':' || (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0))::text FROM pg_proc p WHERE p.oid = to_regprocedure('public.hall_speaker_unassign(uuid,integer[])');"
EIGHT_DEF="CHECK (((state IS NULL) OR (state = ANY (ARRAY['ready'::text, 'not_activated'::text, 'background'::text, 'slept'::text, 'custom_sound_failed'::text, 'volume_zero'::text, 'output_lost'::text, 'output_unconfirmed'::text]))))"
SIX_DEF="CHECK (((state IS NULL) OR (state = ANY (ARRAY['ready'::text, 'not_activated'::text, 'background'::text, 'slept'::text, 'custom_sound_failed'::text, 'volume_zero'::text]))))"

# Rueckweg ohne Versionspruefung (nur Gegenprobe: eine Mutante hat absichtlich eine andere Fassung)
ausgang_rueckweg_ohne_pruefung() { python3 -c "
import re, sys
t = open(sys.argv[1], encoding='utf-8').read()
print(re.sub(r'DO \\\$rw\\\$.*?\\\$rw\\\$;\n', '', t, count=1, flags=re.S))" "$AUSG_RUECKWEG"; }

ausgang_assertions() { # <erwartet t|f>
  local priv a
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } | psql_value 2>&1)" || priv="nicht ausfuehrbar: $priv"
  for a in $AUSG_ASSERTIONS; do
    check A "Rechte-Assertion: $a |$1" "$a|$1" "$(grep -E "^$a\|" <<<"$priv" || true)"
  done
  check A "Rechte-Assertion hallenton-heartbeat-fixed-reasons-no-user-agent gilt vor und nach der Migration (|t)" \
    "hallenton-heartbeat-fixed-reasons-no-user-agent|t" "$(grep -E "^hallenton-heartbeat-fixed-reasons-no-user-agent\|" <<<"$priv" || true)"
  # Migrationen NACH 20261125_001 (z. B. 20261126_001 Zuschauer-Zaehlung Stufe 1b) sind zu diesem Zeitpunkt noch nicht eingespielt: ihre
  # Zeilen (Namen aus der Zuordnung in db-drift-check.sh) zaehlen hier nicht -- sie stehen im Pruefskript ihres eigenen Harness.
  local later="" lf
  for lf in ${AFTER[@]+"${AFTER[@]}"}; do [[ "$(basename "$lf")" > "$AUSG_NAME" ]] && later="$later $(after_assertions "$(basename "$lf")")"; done
  [[ "$1" == t ]] && check A "Rechte-Assertion nach der Migration: keine Zeile |f (ausser den Zeilen spaeterer Migrationen)" "" \
    "$(grep -v '|t$' <<<"$priv" | grep -vE "^($(echo $later | tr ' ' '|'))\\|" || true)"
  [[ "$1" == t ]] && check A "Drift-Check-Zuordnung: pending_assertions_for nennt fuer $AUSG_NAME genau die neuen Namen" \
    "$AUSG_ASSERTIONS" "$(after_assertions "$AUSG_NAME")"
  return 0
}

run_ausgang_probes() {
  local entry name uid e_manage e_lead e_status setup exp st
  # --- @HT-054/@HT-055: jede Identitaet sendet die neuen Zustaende --------------------------------------------------
  for entry in "${IDS[@]}"; do
    IFS=: read -r name uid e_manage e_lead e_status <<<"$entry"
    setup="$SPEAKER_R"; [[ "$uid" == "$U_MARIA" ]] && setup="$SPEAKER_R $REVOKED"
    for st in output_lost output_unconfirmed; do
      exp="ok|$D_R:$st"; [[ "$e_manage" == ok ]] || exp="$e_manage|$D_R:not_activated"
      check A "@HT-054/@HT-055 $name sendet „${st}“" "$exp" "$(short "$(probe "$uid" "$setup" "$(HB "$T_NORD" "$D_R" 1 "$st")" "$(ROW_R 1)")")"
    done
    exp="geschlossen|$D_R:not_activated"; [[ "$e_manage" == ok ]] || exp="$e_manage|$D_R:not_activated"
    check A "@HT-046 abgeschlossen: $name sendet „output_lost“" "$exp" "$(short "$(probe "$uid" "$setup $CLOSED" "$(HB "$T_NORD" "$D_R" 1 output_lost)" "$(ROW_R 1)")")"
    # --- @HT-057: jede Identitaet meldet ein fremdes Geraet ab --------------------------------------------------------
    exp="unassigned:[1]|keine"; [[ "$e_manage" == ok ]] || exp="$e_manage|$D_R:not_activated"
    check A "@HT-057 $name meldet den Lautsprecher von Feld 1 ab (Geraet D_R, nicht das eigene)" "$exp" \
      "$(short "$(probe "$uid" "$setup" "$(UNASSIGN "$T_NORD" "'{1}'::int[]")" "$(ROW_R 1)")")"
    exp="geschlossen|$D_R:not_activated"; [[ "$e_manage" == ok ]] || exp="$e_manage|$D_R:not_activated"
    check A "@HT-057 abgeschlossen: $name meldet ab" "$exp" "$(short "$(probe "$uid" "$setup $CLOSED" "$(UNASSIGN "$T_NORD" "'{1}'::int[]")" "$(ROW_R 1)")")"
  done

  # --- @HT-054/@HT-055: Zustaende ---------------------------------------------------------------------------------
  for st in $SIX_STATES; do
    check A "Rueckwaerts: der bisherige Zustand „${st}“ wird weiter angenommen" "ok|$D_R:$st" \
      "$(short "$(probe "$U_OLLI" "$SPEAKER_R" "$(HB "$T_NORD" "$D_R" 1 "$st")" "$(ROW_R 1)")")"
  done
  for st in output_gone OUTPUT_LOST 'output_lost ' '' fast_bereit; do
    check A "Zustand „${st}“ ausserhalb der Liste -> ungueltig (22023), nichts geschrieben" "ungueltig|$D_R:not_activated" \
      "$(short "$(probe "$U_OLLI" "$SPEAKER_R" "$(HB_ST "$T_NORD" "$D_R" 1 "'$st'")" "$(ROW_R 1)")")"
  done
  check A "Zustand NULL -> ungueltig (22023)" "ungueltig|$D_R:not_activated" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R" "$(HB_ST "$T_NORD" "$D_R" 1 "NULL::text")" "$(ROW_R 1)")")"
  check A "Antwort des Lebenszeichens mit neuem Zustand: dieselbe Form wie mit „ready“ (status, serverNow, fields[field,lead,status,test])" \
    "fields,serverNow,status|field,lead,status,test|1" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "SELECT 'r:' || (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(r) k) || '|' || (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(r -> 'fields' -> 0) k) FROM (SELECT public.hall_speaker_heartbeat('$T_NORD'::uuid, '$D_R'::uuid, '{1}'::int[], 'output_lost') r) x;" "1")"
  check A "Antwort des Lebenszeichens mit „output_unconfirmed“: Feld 1 „ok“" "1=ok|$D_R:output_unconfirmed" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "$(HB_FIELDS "$T_NORD" "$D_R" 1 output_unconfirmed)" "$(ROW_R 1)")"
  check A "Pruefregel haelt auch ohne Funktion: Superuser schreibt „output_foo“" "pruefregel|1" \
    "$(short "$(probe "$U_OLLI" "" "RESET ROLE; INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name, state) VALUES ('$T_NORD', 1, '$D_R', 'x', 'output_foo');" "1")")"
  check A "Pruefregel: Superuser schreibt „output_lost“ und „output_unconfirmed“ -> gueltig" "ok|2" \
    "$(probe "$U_OLLI" "" "RESET ROLE; INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name, state) VALUES ('$T_NORD', 1, '$D_R', 'x', 'output_lost'), ('$T_NORD', 2, '$D_Z', 'y', 'output_unconfirmed'); SELECT 'r:ok';" "SELECT count(*) FROM public.hall_speakers")"
  check A "Stand (volle Sicht) und Antwort der Leitung geben den neuen Zustand unveraendert weiter" "output_lost:output_lost|output_lost" \
    "$(probe "$U_OLLI" "INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name, state, last_seen) VALUES ('$T_NORD', 1, '$D_R', '$NAME_R', 'output_lost', now());$(HOLDER "$U_OLLI" "$D_H")" \
       "SELECT 'r:' || (public.hall_sound_status('$T_NORD'::uuid, '$D_R'::uuid) -> 'speakers' -> 0 ->> 'state') || ':' || (public.hall_field_lead_heartbeat('$T_NORD'::uuid, 1, '$D_H'::uuid) -> 'speaker' ->> 'state');" \
       "SELECT state FROM public.hall_speakers WHERE field_id = 1 AND tournament_id = '$T_NORD'")"
  check A "Stand (schmale Sicht, Helfer Tom) gibt den neuen Zustand weiter, ohne Geraetename" "output_unconfirmed|1" \
    "$(probe "$U_TOM" "INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name, state, last_seen) VALUES ('$T_NORD', 1, '$D_R', '$NAME_R', 'output_unconfirmed', now());" \
       "SELECT 'r:' || CASE WHEN r::text LIKE '%$NAME_R%' THEN 'name' ELSE (r -> 'speakers' -> 0 ->> 'state') END FROM (SELECT public.hall_sound_status('$T_NORD'::uuid) r) x;" "1")"

  # --- Rueckwaertsvertraeglichkeit: der heutige Ablauf der App ------------------------------------------------------
  check A "Rueckwaerts: alter Ablauf (zuordnen, Lebenszeichen bereit, Lautstaerke 0, schlafen, abschalten) wie bisher" "assigned,ok,1=ok,ok,released|keine" \
    "$(probe "$U_OLLI" "" "$(ASSIGN "$T_NORD" 1 "$D_R" "$NAME_R")
$(HB "$T_NORD" "$D_R" 1 ready)
$(HB_FIELDS "$T_NORD" "$D_R" 1 volume_zero)
$(HB "$T_NORD" "$D_R" 1 slept)
$(RELEASE "$T_NORD" 1 "$D_R")" "$(ROW_R 1)")"
  check A "Rueckwaerts: abgeloestes Geraet sieht weiter „superseded“, nicht zugeordnetes „unassigned“ (Antwortform wie 20261121_001)" "1=superseded;2=unassigned|$D_Z:ready" \
    "$(probe "$U_OLLI" "INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name, state, last_seen) VALUES ('$T_NORD', 1, '$D_Z', 'Zweites Geraet', 'ready', now());" \
       "$(HB_FIELDS "$T_NORD" "$D_R" "1,2" ready)" "SELECT device_id::text || ':' || state FROM public.hall_speakers WHERE tournament_id = '$T_NORD' AND field_id = 1")"

  # --- @HT-057: Abmelden --------------------------------------------------------------------------------------------
  check A "@HT-057 Olli meldet Feld 1 ab; Feld 2 (anderes Geraet) bleibt zugeordnet" "unassigned:[1]|2:$D_Z" \
    "$(probe "$U_OLLI" "$SPEAKER_R $SPEAKER_Z2" "$(UNASSIGN "$T_NORD" "'{1}'::int[]")" "$ROWS_ALL")"
  check A "@HT-057 beide Felder auf einmal (zwei verschiedene Geraete)" "unassigned:[1, 2]|keine" \
    "$(probe "$U_OLLI" "$SPEAKER_R $SPEAKER_Z2" "$(UNASSIGN "$T_NORD" "'{2,1,1}'::int[]")" "$ROWS_ALL")"
  check A "@HT-057 Feld ohne Lautsprecher: kein Fehler, nichts geaendert" "unassigned:[]|1:$D_R" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "$(UNASSIGN "$T_NORD" "'{2}'::int[]")" "$ROWS_ALL")"
  check A "@HT-057 die Antwort gibt keine Geraete-Kennung und keinen Namen heraus (nur status und fields)" "fields,status|1" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "SELECT 'r:' || (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(r) k) FROM (SELECT public.hall_speaker_unassign('$T_NORD'::uuid, '{1}'::int[]) r) x;" "1")"
  check A "@HT-057 das abgemeldete Geraet erfaehrt es beim naechsten Lebenszeichen: „unassigned“ (Marke abgemeldet)" "unassigned:[1],1=unassigned|keine" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "$(UNASSIGN "$T_NORD" "'{1}'::int[]")
$(HB_FIELDS "$T_NORD" "$D_R" 1 ready)" "$ROWS_ALL")"
  check A "@HT-057 ein anderes Geraet ordnet sich danach zu: das abgemeldete sieht „superseded“" "unassigned:[1],assigned,1=superseded|1:$D_Z" \
    "$(probe "$U_OLLI" "$SPEAKER_R" "$(UNASSIGN "$T_NORD" "'{1}'::int[]")
$(ASSIGN "$T_NORD" 1 "$D_Z" "Zweites Geraet")
$(HB_FIELDS "$T_NORD" "$D_R" 1 ready)" "$ROWS_ALL")"
  check A "@HT-057 Abmelden laesst Leitung (Steuer) und Tonwahl des Turniers stehen" "unassigned:[1]|1|1" \
    "$(probe "$U_OLLI" "$SPEAKER_R INSERT INTO public.hall_field_leads (tournament_id, field_id, device_id) VALUES ('$T_NORD', 1, '$D_H'); INSERT INTO public.hall_sound_settings (tournament_id, halftime_sound) VALUES ('$T_NORD', 'horn-2');" \
       "$(UNASSIGN "$T_NORD" "'{1}'::int[]")" "SELECT (SELECT count(*) FROM public.hall_field_leads WHERE tournament_id = '$T_NORD') || '|' || (SELECT count(*) FROM public.hall_sound_settings WHERE tournament_id = '$T_NORD')")"
  check A "@HT-057 Feld ausserhalb 1..2 -> ungueltig, nichts geloescht" "ungueltig|1:$D_R" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R" "$(UNASSIGN "$T_NORD" "'{1,3}'::int[]")" "$ROWS_ALL")")"
  check A "@HT-057 leere Feldliste -> ungueltig" "ungueltig|1:$D_R" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R" "$(UNASSIGN "$T_NORD" "'{}'::int[]")" "$ROWS_ALL")")"
  check A "@HT-057 Feldliste NULL -> ungueltig" "ungueltig|1:$D_R" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R" "$(UNASSIGN "$T_NORD" "NULL::int[]")" "$ROWS_ALL")")"
  check A "@HT-057 Papierkorb: Olli im geloeschten Altturnier -> abgelehnt" "abgelehnt|1:$D_R" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R" "$(UNASSIGN "$T_ALT" "'{1}'::int[]")" "$ROWS_ALL")")"
  check A "@HT-057 unbekanntes Turnier -> abgelehnt (wie „darf nicht“)" "abgelehnt|1:$D_R" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R" "$(UNASSIGN "$(uuid_for tournament:gibt-es-nicht)" "'{1}'::int[]")" "$ROWS_ALL")")"
  check A "@HT-057 Turnier NULL -> abgelehnt" "abgelehnt|1:$D_R" \
    "$(short "$(probe "$U_OLLI" "$SPEAKER_R" "SELECT 'r:' || (public.hall_speaker_unassign(NULL::uuid, '{1}'::int[]) ->> 'status');" "$ROWS_ALL")")"
  check A "@HT-057 Clara (Co-Admin) im fremden Turnier „Hallencup Sued“ (nicht eingetragen) -> abgelehnt, Zuordnung bleibt" "abgelehnt|1" \
    "$(short "$(probe "$U_CLARA" "INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name) VALUES ('$T_SUED', 1, '$D_Z', 'Sued');" "$(UNASSIGN "$T_SUED" "'{1}'::int[]")" "SELECT count(*) FROM public.hall_speakers WHERE tournament_id = '$T_SUED'")")"
}

# Fail-fast auf der Baseline allein (im F-Abschnitt des Hauptskripts aufgerufen, Container nur mit Baseline)
ausgang_fail_fast() {
  local dump out rc
  dump="$(schema_dump)"
  set +e; out="$(psql_stdin < "$AUSG_FILE" 2>&1)"; rc=$?; set -e
  check A "Ausgang-Zustaende auf der Baseline allein: bricht ab mit Hinweis" "abbruch|ja" \
    "$([[ "$rc" -ne 0 ]] && echo abbruch || echo "lief($rc)")|$([[ "$out" == *"20261125_001_hallenton_ausgang_zustaende: Hallenton (20261121_001) und Torhymne (20261123_001) fehlen -- zuerst einspielen"* ]] && echo ja || echo "nein: $out")"
  check A "Ausgang-Zustaende auf der Baseline allein: Schema unveraendert" "identisch" "$([[ "$(schema_dump)" == "$dump" ]] && echo identisch || echo verschieden)"
}

# Kategorie A im normalen Lauf: 20261121_001, 20261123_001 und alle Migrationen dazwischen sind eingespielt.
run_ausgang_section() {
  local dump_before dump_after data out rc def counts_b counts_a
  ausgang_assertions f
  check A "vorher: Pruefregel mit sechs Zustaenden, Funktion hall_speaker_unassign fehlt" "$SIX_DEF|" "$(q "$STATE_DEF_SQL")|$(q "$AFN_STATE_SQL")"
  # Fail-fast mit fremder Fassung des Lebenszeichens und mit fremder Pruefregel (nichts wird geaendert)
  dump_before="$(schema_dump)"
  counts_b="$(counts "$dump_before")"
  q "SELECT pg_get_functiondef('public.hall_speaker_heartbeat(uuid,uuid,integer[],text,boolean)'::regprocedure);" > "$WORK_DIR/hb_eigen.sql"
  psql_stdin <<<"$(sed 's/^BEGIN$/BEGIN -- fremde Fassung/' "$WORK_DIR/hb_eigen.sql");" >/dev/null
  set +e; out="$(psql_stdin < "$AUSG_FILE" 2>&1)"; rc=$?; set -e
  check A "Fail-fast: Lebenszeichen in fremder Fassung -> Abbruch, nichts geaendert" "abbruch|ja|f" \
    "$([[ "$rc" -ne 0 ]] && echo abbruch || echo lief)|$([[ "$out" == *"hall_speaker_heartbeat nicht in der Fassung 20261123_001"* ]] && echo ja || echo "nein: $out")|$(q "SELECT to_regprocedure('public.hall_speaker_unassign(uuid,integer[])') IS NOT NULL;")"
  psql_stdin <<<"$(cat "$WORK_DIR/hb_eigen.sql");" >/dev/null
  psql_stdin <<'SQL'
ALTER TABLE public.hall_speakers DROP CONSTRAINT hall_speakers_state_check;
ALTER TABLE public.hall_speakers ADD CONSTRAINT hall_speakers_state_check CHECK (state IS NULL OR state IN ('ready', 'not_activated', 'background', 'slept', 'custom_sound_failed', 'volume_zero', 'fremd'));
SQL
  set +e; out="$(psql_stdin < "$AUSG_FILE" 2>&1)"; rc=$?; set -e
  check A "Fail-fast: Pruefregel in fremder Fassung -> Abbruch, nichts geaendert" "abbruch|ja|f" \
    "$([[ "$rc" -ne 0 ]] && echo abbruch || echo lief)|$([[ "$out" == *"hall_speakers_state_check in unbekannter Fassung"* ]] && echo ja || echo "nein: $out")|$(q "SELECT to_regprocedure('public.hall_speaker_unassign(uuid,integer[])') IS NOT NULL;")"
  psql_stdin <<SQL
ALTER TABLE public.hall_speakers DROP CONSTRAINT hall_speakers_state_check;
ALTER TABLE public.hall_speakers ADD CONSTRAINT hall_speakers_state_check CHECK (state IS NULL OR state IN ('ready', 'not_activated', 'background', 'slept', 'custom_sound_failed', 'volume_zero'));
SQL
  check A "nach den Fail-fast-Proben: Schema = vorher" "identisch" "$([[ "$(schema_dump)" == "$dump_before" ]] && echo identisch || echo verschieden)"
  check A "vorher: Lebenszeichen und Stand in der Fassung 20261123_001" "$HB_MD5_TORHYMNE|$STATUS_MD5_TORHYMNE" "$(q "$HB_BODY_MD5_SQL")|$(q "$STATUS_MD5_SQL")"
  local sigs_before; sigs_before="$(q "$HALL_SIGS_SQL")"
  # Bestand: eine Zeile mit einem der sechs bisherigen Zustaende bleibt gueltig und unveraendert
  psql_stdin <<SQL
INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name, state, last_seen) VALUES ('$T_SUED', 1, '$D_Z', 'Sued', 'volume_zero', now());
SQL
  echo "Ziel: $AUSG_NAME" >&2
  psql_stdin < "$AUSG_FILE"
  check A "Bestand: Zeile mit „volume_zero“ bleibt unveraendert" "$D_Z:volume_zero" "$(q "SELECT device_id::text || ':' || state FROM public.hall_speakers WHERE tournament_id = '$T_SUED';")"
  psql_stdin <<SQL
DELETE FROM public.hall_speakers;
SQL
  check A "Pruefregel hall_speakers_state_check: genau die acht Zustaende" "$EIGHT_DEF" "$(q "$STATE_DEF_SQL")"
  check A "Funktion hall_speaker_unassign: Definer, search_path fest, nur authenticated, kein PUBLIC" \
    "hall_speaker_unassign:true:{\"search_path=public, pg_temp\"}:false:true:false:false" "$(q "$AFN_STATE_SQL")"
  check A "Spaltenkommentar nennt die neuen Zustaende" "t" "$(q "SELECT (col_description('public.hall_speakers'::regclass, (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.hall_speakers'::regclass AND attname = 'state')) LIKE '%output_lost%output_unconfirmed%');")"
  check A "Rueckwaerts: Rumpf des Lebenszeichens = Fassung 20261123_001 bis auf die Zustandsliste (md5 nach Zuruecksetzen der Liste)" "$HB_MD5_TORHYMNE" "$(q "$HB_BODY_ALT_SQL")"
  check A "Rueckwaerts: hall_sound_status unveraendert (Fassung 20261123_001)" "$STATUS_MD5_TORHYMNE" "$(q "$STATUS_MD5_SQL")"
  check A "Rueckwaerts: keine hall_*-Funktion entfaellt oder aendert die Signatur; neu ist nur hall_speaker_unassign" "$(echo "$sigs_before # hall_speaker_unassign(uuid,integer[])" | tr '#' '\n' | sed 's/^ *//; s/ *$//' | sort | paste -sd'#' - | sed 's/#/ # /g')" \
    "$(q "$HALL_SIGS_SQL" | tr '#' '\n' | sed 's/^ *//; s/ *$//' | sort | paste -sd'#' - | sed 's/#/ # /g')"
  check A "Tabellen: weiter RLS an, keine Policy, kein Recht fuer anon/authenticated" \
    "hall_field_leads:true:0:false:false:true:false # hall_sound_settings:true:0:false:false:true:false # hall_speakers:true:0:false:false:true:false" "$(q "$TABLE_STATE_SQL")"
  dump_after="$(schema_dump)"
  counts_a="$(counts "$dump_after")"
  for dim_exp in tables:0 rls_tables:0 policies:0 functions:1 triggers:0; do
    dim="${dim_exp%%:*}"
    check A "Katalogzaehlung $dim: Zuwachs ${dim_exp#*:}" "${dim_exp#*:}" $(( $(count_of "$counts_a" "$dim") - $(count_of "$counts_b" "$dim") ))
  done
  ausgang_assertions t
  run_ausgang_probes

  # --- zweites Einspielen ---------------------------------------------------------------------------------------
  psql_stdin <<SQL
INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name, state, last_seen) VALUES ('$T_NORD', 1, '$D_R', 'Eins', 'output_lost', now()), ('$T_NORD', 2, '$D_Z', 'Zwei', 'output_unconfirmed', now());
SQL
  data="$(q "SELECT string_agg(field_id || state, ',' ORDER BY field_id) FROM public.hall_speakers;")"
  set +e; psql_stdin < "$AUSG_FILE" >/dev/null 2>&1; rc=$?; set -e
  check A "zweites Einspielen: Exit 0, Schema wie nach dem ersten, Zeilen gleich" "0|identisch|gleich" \
    "$rc|$([[ "$(schema_dump)" == "$dump_after" ]] && echo identisch || echo verschieden)|$([[ "$(q "SELECT string_agg(field_id || state, ',' ORDER BY field_id) FROM public.hall_speakers;")" == "$data" ]] && echo gleich || echo verschieden)"

  # --- Rueckweg (Zeilen mit den neuen Zustaenden sind noch da) ---------------------------------------------------------
  set +e; out="$(psql_stdin < "$AUSG_RUECKWEG" 2>&1)"; rc=$?; set -e
  check A "Rueckweg: laeuft (Exit 0)" "0" "$rc${out:+ ($out)}"
  check A "nach dem Rueckweg: Schema public = vor der Migration (pg_dump identisch)" "identisch" \
    "$([[ "$(schema_dump)" == "$dump_before" ]] && echo identisch || echo verschieden)"
  [[ "$(schema_dump)" == "$dump_before" ]] || { diff <(echo "$dump_before") <(schema_dump) | head -40 || true; }
  check A "nach dem Rueckweg: die zwei Zeilen mit neuem Zustand haben Zustand NULL, Geraete bleiben zugeordnet" "2|2" \
    "$(q "SELECT count(*) FILTER (WHERE state IS NULL) || '|' || count(*) FROM public.hall_speakers;")"
  check A "nach dem Rueckweg: Lebenszeichen und Stand in der Fassung 20261123_001, „output_lost“ wird abgelehnt, „volume_zero“ gilt" "$HB_MD5_TORHYMNE|$STATUS_MD5_TORHYMNE|ungueltig|ok" \
    "$(q "$HB_BODY_MD5_SQL")|$(q "$STATUS_MD5_SQL")|$(short "$(probe "$U_OLLI" "" "$(HB "$T_NORD" "$D_R" 1 output_lost)" "1")" | cut -d'|' -f1)|$(short "$(probe "$U_OLLI" "" "$(HB "$T_NORD" "$D_R" 1 volume_zero)" "1")" | cut -d'|' -f1)"
  set +e; out="$(psql_stdin < "$AUSG_RUECKWEG" 2>&1)"; rc=$?; set -e
  check A "Rueckweg ein zweites Mal: bricht ab, nichts geaendert" "abbruch|ja|identisch" \
    "$([[ "$rc" -ne 0 ]] && echo abbruch || echo lief)|$([[ "$out" == *"Rueckweg 20261125_001: Hallenton nicht in der Fassung 20261125_001"* ]] && echo ja || echo "nein: $out")|$([[ "$(schema_dump)" == "$dump_before" ]] && echo identisch || echo verschieden)"
  psql_stdin <<SQL
DELETE FROM public.hall_speakers;
SQL
  psql_stdin < "$AUSG_FILE"
  check A "danach erneut einspielbar (Schema = erstes Einspielen)" "identisch" "$([[ "$(schema_dump)" == "$dump_after" ]] && echo identisch || echo verschieden)"
}

# Gegenprobe ohne die Migration (--without-migration): A muss rot sein (Torhymne ist eingespielt, die Migration nicht).
run_ausgang_without() {
  run_ausgang_probes
}

# Gegenprobe je Mutation (--gegenprobe): Rueckweg ohne Versionspruefung, Mutante einspielen, A muss rot sein.
AUSGANG_MUTATIONS=(
  "AM1|Lebenszeichen nimmt die neuen Zustaende nicht an|'volume_zero', 'output_lost', 'output_unconfirmed') THEN|'volume_zero') THEN"
  "AM2|Pruefregel ohne output_unconfirmed|'output_lost', 'output_unconfirmed'));|'output_lost'));"
  "AM3|Abmelden mit writeMatchData (Helfer meldet ab)|hall_require(p_tournament_id, 'manageScreens');\n  PERFORM public.hall_require_open(p_tournament_id);\n  v_fields := public.hall_checked_fields(p_tournament_id, p_fields);\n  PERFORM pg_advisory|hall_require(p_tournament_id, 'writeMatchData');\n  PERFORM public.hall_require_open(p_tournament_id);\n  v_fields := public.hall_checked_fields(p_tournament_id, p_fields);\n  PERFORM pg_advisory"
  "AM4|Abmelden nach dem Turnierende erlaubt|PERFORM public.hall_require_open(p_tournament_id);\n  v_fields := public.hall_checked_fields(p_tournament_id, p_fields);\n  PERFORM pg_advisory|v_fields := public.hall_checked_fields(p_tournament_id, p_fields);\n  PERFORM pg_advisory"
  "AM5|anon behaelt EXECUTE auf hall_speaker_unassign|REVOKE ALL ON FUNCTION public.hall_speaker_unassign(uuid, integer[]) FROM PUBLIC, anon, service_role;\n|"
  "AM6|Abmelden loescht alle Felder des Turniers, nicht nur die genannten|WHERE s.tournament_id = p_tournament_id AND s.field_id = ANY (v_fields)\n    RETURNING s.field_id)|WHERE s.tournament_id = p_tournament_id\n    RETURNING s.field_id)"
  "AM7|Antwort des Abmeldens fuehrt ein weiteres Feld mit (Geraete-Angabe)|'fields', to_jsonb(v_removed));|'fields', to_jsonb(v_removed), 'device', (SELECT min(device_name) FROM public.hall_speakers WHERE tournament_id = p_tournament_id));"
  "AM8|Lebenszeichen nach dem Turnierende erlaubt|PERFORM public.hall_require_open(p_tournament_id);\n  IF p_device_id IS NULL|IF p_device_id IS NULL"
  "AM9|Abmelden loescht nur Zeilen mit der Kennung eines Geraets (wie hall_speaker_release, fremde bleiben)|WHERE s.tournament_id = p_tournament_id AND s.field_id = ANY (v_fields)\n    RETURNING s.field_id)|WHERE s.tournament_id = p_tournament_id AND s.field_id = ANY (v_fields) AND s.device_id = '$D_R'\n    RETURNING s.field_id)"
)
run_ausgang_gegenprobe() { # nach apply_before + apply_target + spaeteren Migrationen + Torhymne
  local mut mid mtext mfrom mto mutated red=0 sel=()
  for mut in "${AUSGANG_MUTATIONS[@]}"; do
    [[ -z "${GEGENPROBE_NUR:-}" || " $GEGENPROBE_NUR " == *" ${mut%%|*} "* ]] && sel+=("$mut")
  done
  psql_stdin < "$AUSG_FILE"
  for mut in ${sel[@]+"${sel[@]}"}; do
    IFS='|' read -r mid mtext mfrom mto <<<"$mut"
    mutated="$WORK_DIR/$mid.sql"
    python3 - "$AUSG_FILE" "$mutated" "$mfrom" "$mto" <<'PY' || { echo "::error::Mutation $mid nicht anwendbar"; exit 1; }
import sys
src, dst = sys.argv[1], sys.argv[2]
frm = sys.argv[3].replace('\\n', '\n')
to = sys.argv[4].replace('\\n', '\n')
text = open(src, encoding='utf-8').read()
if text.count(frm) != 1:
    sys.exit(f"Mutation: Stelle nicht genau einmal gefunden: {frm!r} ({text.count(frm)}x)")
open(dst, 'w', encoding='utf-8').write(text.replace(frm, to))
PY
    ausgang_rueckweg_ohne_pruefung | psql_stdin
    psql_stdin < "$mutated"
    reset_counts
    echo "--- GEGENPROBE $mid: $mtext ---"
    { run_ausgang_probes; ausgang_assertions t; } >"$WORK_DIR/$mid.out"
    if [[ "$(total_dev)" -gt 0 ]]; then
      echo "GEGENPROBE $mid: rot ($(total_dev) Abweichung(en)) -- wie verlangt"
      grep -m3 '^ABWEICHUNG' "$WORK_DIR/$mid.out" | sed 's/^/    /'
      red=$((red + 1))
    else
      echo "::error::GEGENPROBE $mid blieb gruen (zahnlos)"
    fi
  done
  ausgang_rueckweg_ohne_pruefung | psql_stdin
  echo "Gegenprobe Ausgang-Zustaende: $red von ${#sel[@]} Mutationen rot."
  [[ "$red" -eq "${#sel[@]}" ]]
}
