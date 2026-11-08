# shellcheck shell=bash
#
# rls-matrix.d/spur-hallenton.sh — Rollen-Zeilen von 20261121_001_hallenton.sql (Hallenton, Record
# docs/anforderungen/2026-10-15_hallenton.md, @HT-022/@HT-044) fuer scripts/rls-role-matrix.sh. Per `source` eingebunden
# (Glob-Reihenfolge: nach spur-gruppe-a13b.sh, vor spur-helfer-a16.sh); nutzt claims_line(), user_id_for_id(),
# role_for_id(), perm_expected(), MATRIX_IDS, T_MAIN und die Zaehler TOTAL/MISMATCHES des Hauptskripts.
#
# Einspielen: Das Hauptskript spielt diese Migration nicht ein (eigene Spur, kein Eingriff in die gemeinsame Kette).
# Diese Datei spielt sie selbst ein, sobald die Kette davor steht: zuerst den Storage-Nachbau
# (scripts/lib/hallenton-storage-stub.sql, nur Wegwerf-Container), dann die Migration. Laesst sie sich nicht einspielen
# (Gegenprobe-Modi des Hauptskripts ohne die Voraussetzungen), zaehlt das als eine Abweichung und die Zeilen entfallen.
# Eigene Gegenprobe: HALLENTON_OHNE_MIGRATION=1 bash scripts/rls-role-matrix.sh -> alle Zeilen ROT (Funktion fehlt).
#
# Je Identitaet aus MATRIX_IDS (owner, owner-anonymous, co-admin, collaborator = Mitarbeiter, trainer, viewer,
# non-member, open-invitation, declined-membership, anon-device, helper-device = Helfer-Zugang, screen-device =
# Bildschirm) und anon ohne Sitzung eine nie committete Transaktion gegen T_MAIN, Feld 1. Erwartung aus
# rolePermissions.json (perm_expected): manageScreens -> Lautsprecher bestimmen/ausschalten, Lebenszeichen „bereit“,
# Testton, Quittung, Tonwahl, Hochladen; writeMatchData -> Lebenszeichen der Leitung (mit Steuer des Felds) und der
# knappe Stand mit Hinweis „Prüfen“ (@HT-050); manageScreens zusaetzlich „Gehört“ (@HT-049); nach dem Turnierende
# (@HT-046) jede aendernde Operation gesperrt; sonst abgelehnt (42501 aus der Rechtepruefung). anon: kein EXECUTE (42501 permission denied), beim
# Hochladen RLS. Zusaetzlich wird der Wert danach als Superuser geprueft (nichts geaendert = abgelehnt wirkt).
# Torhymne (20261123_001_hallenton_torhymne.sql, @HT-024, @HT-046): spielt diese Datei nach 20261121_001 ebenfalls ein;
# je Identitaet Hymnen setzen (manageScreens), nach dem Turnierende Hymnen setzen und Lebenszeichen gesperrt (55000).

HT_MISMATCHES=0
HT_CELLS=0
HT_FILE="$REPO_ROOT/supabase/migrations/20261121_001_hallenton.sql"
HT_FOLLOW="$REPO_ROOT/supabase/migrations/20261123_001_hallenton_torhymne.sql"
HT_STUB="$REPO_ROOT/scripts/lib/hallenton-storage-stub.sql"
HT_HANDSTEP="$REPO_ROOT/supabase/handschritte/20261121_001_hallenton_storage_policies.sql"
HT_DEV_R="$(uuid_for hallenton:device:rechner)"
HT_DEV_Z="$(uuid_for hallenton:device:zweites)"
HT_DEV_H="$(uuid_for hallenton:device:handy)"
HT_TEST="$(uuid_for hallenton:test)"
HT_SOUND="$(uuid_for hallenton:sound)"

ht_cell() { # ht_cell <Name> <erhalten> <erwartet>
  HT_CELLS=$((HT_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); HT_MISMATCHES=$((HT_MISMATCHES + 1))
    printf 'hallenton %-66s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

HT_READY=1
if [[ "${HALLENTON_OHNE_MIGRATION:-0}" == "1" ]]; then
  echo "hallenton: HALLENTON_OHNE_MIGRATION=1 -- Migration NICHT eingespielt (Gegenprobe, Zeilen muessen rot sein)"
elif [[ "$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT to_regclass('public.hall_speakers') IS NOT NULL;")" != "t" ]]; then
  if docker exec -i -e PGPASSWORD=postgres -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" \
       psql -h 127.0.0.1 -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 < "$HT_STUB" >/dev/null 2>&1 \
     && docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" \
       psql -U postgres -X -q -v ON_ERROR_STOP=1 < "$HT_FILE" >/dev/null 2>&1 \
     && docker exec -i -e PGPASSWORD=postgres -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" \
       psql -h 127.0.0.1 -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 < "$HT_HANDSTEP" >/dev/null 2>&1; then
    echo "hallenton: Storage-Nachbau + $(basename "$HT_FILE") + Handschritt Storage-Policies eingespielt"
  else
    HT_READY=0
    ht_cell "Migration einspielbar (Kette davor vollstaendig?)" "nein" "ja"
  fi
fi
if [[ "$HT_READY" -eq 1 && "${HALLENTON_OHNE_MIGRATION:-0}" != "1" ]] \
   && [[ "$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT to_regprocedure('public.hall_goal_anthems_set(uuid,text[])') IS NOT NULL;")" != "t" ]]; then
  if docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER_NAME" \
       psql -U postgres -X -q -v ON_ERROR_STOP=1 < "$HT_FOLLOW" >/dev/null 2>&1; then
    echo "hallenton: $(basename "$HT_FOLLOW") eingespielt"
  else
    HT_READY=0
    ht_cell "Torhymne einspielbar (20261121_001 vorhanden?)" "nein" "ja"
  fi
fi

# ht_probe <rolle authenticated|anon> <uid|leer> <vorbereitung> <aktion mit Zeilen 'htr:…'> <pruef-SQL>
#   -> "<ergebnis>|<pruefwert>"; Ergebnis kurz: abgelehnt (42501 der Rechtepruefung), kein-execute, rls, sonst der Wert.
ht_probe() {
  local role="$1" uid="$2" setup="$3" action="$4" chk="$5" sub="" out res msg val
  [[ -n "$uid" ]] && sub="SET LOCAL request.jwt.claim.sub = '$uid'; $(claims_line "$uid")"
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 <<SQL 2>&1
\\set VERBOSITY verbose
BEGIN;
$setup
SET LOCAL ROLE $role;
$sub
SAVEPOINT ht;
$action
\\if :ERROR
ROLLBACK TO SAVEPOINT ht;
\\endif
RESET ROLE;
SELECT 'htp:' || coalesce(($chk)::text, 'NULL');
ROLLBACK;
SQL
)"
  set -e
  res="$( (grep '^htr:' <<<"$out" || true) | cut -c5- | paste -sd, -)"
  msg="$( (grep -m1 'ERROR:' <<<"$out" || true) | sed 's/^.*ERROR: *//')"
  val="$( (grep -m1 '^htp:' <<<"$out" || true) | cut -c5-)"
  case "$msg" in
    "") ;;
    "42501: hallenton: not allowed"*) res="abgelehnt" ;;
    "42501: permission denied for function"*) res="kein-execute" ;;
    "42501: new row violates row-level security policy"*) res="rls" ;;
    "55000: TOURNAMENT_FINISHED"*) res="geschlossen" ;;
    *) res="fehler:$msg" ;;
  esac
  echo "${res:-?}|${val:-?}"
}

HT_SPEAKER="INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name, state, last_seen)
VALUES ('$T_MAIN', 1, '$HT_DEV_R', 'Rechner der Turnierleitung', 'not_activated', now());"
HT_SPEAKER_TEST="$HT_SPEAKER
UPDATE public.hall_speakers SET test_id = '$HT_TEST', test_requested_at = now() - interval '1 second' WHERE tournament_id = '$T_MAIN';"
ht_holder() { # Steuer von Feld 1 in T_MAIN fuer <uid> mit Toms Handy-Kennung
  echo "INSERT INTO public.field_control (tournament_id, field, epoch, holder_user_id, holder_device_id, holder_device_label)
VALUES ('$T_MAIN', 1, 1, '$1', '$HT_DEV_H', 'Handy')
ON CONFLICT (tournament_id, field) DO UPDATE SET holder_user_id = EXCLUDED.holder_user_id, holder_device_id = EXCLUDED.holder_device_id;"
}
HT_HINTED="INSERT INTO public.hall_speakers (tournament_id, field_id, device_id, device_name, state, last_seen, output_hint_at)
VALUES ('$T_MAIN', 1, '$HT_DEV_R', 'Rechner der Turnierleitung', 'ready', now(), now());"
HT_HINT="SELECT CASE WHEN output_hint_at IS NULL THEN 'weg' ELSE 'gesetzt' END FROM public.hall_speakers WHERE tournament_id = '$T_MAIN'"
HT_ROW="SELECT coalesce((SELECT device_id::text || ':' || coalesce(state, 'NULL') FROM public.hall_speakers WHERE tournament_id = '$T_MAIN' AND field_id = 1), 'keine')"
HT_ROW_R_NA="$HT_DEV_R:not_activated"

# @HT-046: T_MAIN abgeschlossen (Lebenszyklus-Schalter wie spur-zz-monitor-endstand.sh)
HT_CLOSED="SET LOCAL app.lifecycle_write = 'on';
UPDATE public.tournaments SET lifecycle_status = 'finished', finished_at = now() WHERE id = '$T_MAIN';
RESET app.lifecycle_write;"
HT_ONE_FILE="INSERT INTO storage.objects (bucket_id, name) VALUES ('hallenton-sounds', '$T_MAIN/$HT_SOUND.wav');"
HT_ANTHEM="ARRAY['$T_MAIN/$HT_SOUND.mp3']::text[]"
HT_ANTHEMS="SELECT coalesce((SELECT cardinality(goal_anthem_paths) FROM public.hall_sound_settings WHERE tournament_id = '$T_MAIN'), 0)"
# Erwartung: <erlaubt-Wert> wenn erlaubt, sonst <abgelehnt-Token>|<unveraendert>
ht_exp() { [[ "$1" == "true" ]] && echo "$2" || echo "$3|$4"; }

if [[ "$HT_READY" -eq 1 ]]; then
  for ht_id in "${MATRIX_IDS[@]}" anon; do
    if [[ "$ht_id" == anon ]]; then
      ht_role=anon; ht_uid=""; ht_manage=false; ht_write=false; ht_deny="kein-execute"
    else
      ht_role=authenticated; ht_uid="$(user_id_for_id "$ht_id")"
      ht_manage="$(perm_expected "$(role_for_id "$ht_id")" manageScreens)"
      ht_write="$(perm_expected "$(role_for_id "$ht_id")" writeMatchData)"
      ht_deny="abgelehnt"
    fi
    ht_cell "@HT-022 $ht_id bestimmt einen Lautsprecher (Feld 1)" \
      "$(ht_probe "$ht_role" "$ht_uid" "" "SELECT 'htr:' || (public.hall_speaker_assign('$T_MAIN'::uuid, '{1}'::int[], '$HT_DEV_Z'::uuid, 'Zweites Geraet', true) ->> 'status');" "$HT_ROW")" \
      "$(ht_exp "$ht_manage" "assigned|$HT_DEV_Z:NULL" "$ht_deny" keine)"
    ht_cell "@HT-044 $ht_id meldet „bereit“ fuer den Rechner" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_SPEAKER" "SELECT 'htr:' || (public.hall_speaker_heartbeat('$T_MAIN'::uuid, '$HT_DEV_R'::uuid, '{1}'::int[], 'ready', false) ->> 'status');" "$HT_ROW")" \
      "$(ht_exp "$ht_manage" "ok|$HT_DEV_R:ready" "$ht_deny" "$HT_ROW_R_NA")"
    ht_cell "@HT-044 $ht_id loest den Testton aus" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_SPEAKER" "SELECT 'htr:' || (public.hall_test_tone_request('$T_MAIN'::uuid, 1) ->> 'status');" "SELECT (test_id IS NOT NULL)::text FROM public.hall_speakers WHERE tournament_id = '$T_MAIN'")" \
      "$(ht_exp "$ht_manage" "requested|true" "$ht_deny" false)"
    ht_cell "@HT-017 $ht_id quittiert den Testton" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_SPEAKER_TEST" "SELECT 'htr:' || (public.hall_test_tone_ack('$T_MAIN'::uuid, 1, '$HT_DEV_R'::uuid, '$HT_TEST'::uuid) ->> 'status');" "SELECT (test_played_at IS NOT NULL)::text FROM public.hall_speakers WHERE tournament_id = '$T_MAIN'")" \
      "$(ht_exp "$ht_manage" "acked|true" "$ht_deny" false)"
    ht_cell "@HT-022 $ht_id waehlt den Ton" \
      "$(ht_probe "$ht_role" "$ht_uid" "" "SELECT 'htr:' || (public.hall_sound_settings_set('$T_MAIN'::uuid, 'horn-2', NULL, NULL, '{1}'::int[]) ->> 'status');" "SELECT count(*) FROM public.hall_sound_settings WHERE tournament_id = '$T_MAIN'")" \
      "$(ht_exp "$ht_manage" "saved|1" "$ht_deny" 0)"
    ht_cell "@HT-038 $ht_id schaltet den Rechner aus" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_SPEAKER" "SELECT 'htr:' || (public.hall_speaker_release('$T_MAIN'::uuid, '{1}'::int[], '$HT_DEV_R'::uuid) ->> 'status');" "$HT_ROW")" \
      "$(ht_exp "$ht_manage" "released|keine" "$ht_deny" "$HT_ROW_R_NA")"
    if [[ "$ht_manage" == "true" ]]; then ht_status="voll|1"
    elif [[ "$ht_write" == "true" ]]; then ht_status="knapp|1"
    else ht_status="$ht_deny|1"; fi
    ht_cell "@HT-039/@HT-050 $ht_id liest den Stand (Leitung: Zustand + Hinweis, ohne Geraetedaten)" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_HINTED" "SELECT 'htr:' || CASE WHEN r ? 'leads' THEN 'voll' WHEN (r -> 'speakers' -> 0) ? 'deviceName' THEN 'knapp-mit-name' WHEN (r -> 'speakers' -> 0 ->> 'outputHint') = 'true' THEN 'knapp' ELSE 'knapp-ohne-hinweis' END FROM (SELECT public.hall_sound_status('$T_MAIN'::uuid) r) x;" "1")" \
      "$ht_status"
    ht_cell "@HT-034 $ht_id sendet das Lebenszeichen der Leitung (haelt die Steuer)" \
      "$(ht_probe "$ht_role" "$ht_uid" "${ht_uid:+$(ht_holder "$ht_uid")}" "SELECT 'htr:' || (public.hall_field_lead_heartbeat('$T_MAIN'::uuid, 1, '$HT_DEV_H'::uuid) ->> 'status');" "SELECT count(*) FROM public.hall_field_leads WHERE tournament_id = '$T_MAIN'")" \
      "$(ht_exp "$ht_write" "ok|1" "$ht_deny" 0)"
    ht_cell "@HT-022 $ht_id laedt einen eigenen Ton hoch" \
      "$(ht_probe "$ht_role" "$ht_uid" "" "WITH i AS (INSERT INTO storage.objects (bucket_id, name) VALUES ('hallenton-sounds', '$T_MAIN/$HT_SOUND.mp3') RETURNING 1) SELECT 'htr:' || count(*) FROM i;" "SELECT count(*) FROM storage.objects WHERE bucket_id = 'hallenton-sounds'")" \
      "$(ht_exp "$ht_manage" "1|1" rls 0)"
    ht_cell "@HT-024 $ht_id setzt die Torhymnen" \
      "$(ht_probe "$ht_role" "$ht_uid" "" "SELECT 'htr:' || (public.hall_goal_anthems_set('$T_MAIN'::uuid, $HT_ANTHEM) ->> 'status');" "$HT_ANTHEMS")" \
      "$(ht_exp "$ht_manage" "saved|1" "$ht_deny" 0)"
    ht_cell "@HT-049 $ht_id waehlt „Gehört“ (Hinweis weg)" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_HINTED" "SELECT 'htr:' || (public.hall_output_heard('$T_MAIN'::uuid, 1) ->> 'status');" "$HT_HINT")" \
      "$(ht_exp "$ht_manage" "heard|weg" "$ht_deny" gesetzt)"
    # @HT-046: abgeschlossenes Turnier x jede aendernde Operation. Mit Recht: gesperrt (55000 bzw. RLS/0 Zeilen);
    # ohne Recht: wie oben abgelehnt (Recht vor Sperre). Lesen bleibt fuer die Berechtigten.
    ht_closed_deny="geschlossen"; [[ "$ht_manage" == true ]] || ht_closed_deny="$ht_deny"
    ht_cell "@HT-046 abgeschlossen: $ht_id bestimmt einen Lautsprecher" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_CLOSED" "SELECT 'htr:' || (public.hall_speaker_assign('$T_MAIN'::uuid, '{1}'::int[], '$HT_DEV_Z'::uuid, 'Zweites Geraet', true) ->> 'status');" "$HT_ROW")" \
      "$ht_closed_deny|keine"
    ht_cell "@HT-046 abgeschlossen: $ht_id waehlt den Ton" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_CLOSED" "SELECT 'htr:' || (public.hall_sound_settings_set('$T_MAIN'::uuid, 'horn-2', NULL, NULL, '{1}'::int[]) ->> 'status');" "SELECT count(*) FROM public.hall_sound_settings WHERE tournament_id = '$T_MAIN'")" \
      "$ht_closed_deny|0"
    ht_cell "@HT-046 abgeschlossen: $ht_id loest den Testton aus" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_SPEAKER $HT_CLOSED" "SELECT 'htr:' || (public.hall_test_tone_request('$T_MAIN'::uuid, 1) ->> 'status');" "SELECT (test_id IS NOT NULL)::text FROM public.hall_speakers WHERE tournament_id = '$T_MAIN'")" \
      "$ht_closed_deny|false"
    ht_cell "@HT-046 abgeschlossen: $ht_id setzt die Torhymnen" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_CLOSED" "SELECT 'htr:' || (public.hall_goal_anthems_set('$T_MAIN'::uuid, $HT_ANTHEM) ->> 'status');" "$HT_ANTHEMS")" \
      "$ht_closed_deny|0"
    ht_cell "@HT-046 abgeschlossen: $ht_id meldet „bereit“ (Lebenszeichen, 55000)" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_SPEAKER $HT_CLOSED" "SELECT 'htr:' || (public.hall_speaker_heartbeat('$T_MAIN'::uuid, '$HT_DEV_R'::uuid, '{1}'::int[], 'ready', false) ->> 'status');" "$HT_ROW")" \
      "$ht_closed_deny|$HT_ROW_R_NA"
    ht_cell "@HT-046 abgeschlossen: $ht_id waehlt „Gehört“" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_HINTED $HT_CLOSED" "SELECT 'htr:' || (public.hall_output_heard('$T_MAIN'::uuid, 1) ->> 'status');" "$HT_HINT")" \
      "$ht_closed_deny|gesetzt"
    ht_cell "@HT-046 abgeschlossen: $ht_id laedt einen eigenen Ton hoch" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_CLOSED" "WITH i AS (INSERT INTO storage.objects (bucket_id, name) VALUES ('hallenton-sounds', '$T_MAIN/$HT_SOUND.mp3') RETURNING 1) SELECT 'htr:' || count(*) FROM i;" "SELECT count(*) FROM storage.objects WHERE bucket_id = 'hallenton-sounds'")" \
      "rls|0"
    ht_cell "@HT-046 abgeschlossen: $ht_id loescht einen eigenen Ton" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_ONE_FILE $HT_CLOSED" "WITH d AS (DELETE FROM storage.objects WHERE bucket_id = 'hallenton-sounds' RETURNING 1) SELECT 'htr:' || count(*) FROM d;" "SELECT count(*) FROM storage.objects WHERE bucket_id = 'hallenton-sounds'")" \
      "0|1"
    if [[ "$ht_manage" == "true" ]]; then ht_closed_read="voll|1"
    elif [[ "$ht_write" == "true" ]]; then ht_closed_read="knapp|1"
    else ht_closed_read="$ht_deny|1"; fi
    ht_cell "@HT-046 abgeschlossen: $ht_id liest den Stand" \
      "$(ht_probe "$ht_role" "$ht_uid" "$HT_SPEAKER $HT_CLOSED" "SELECT 'htr:' || CASE WHEN r ? 'leads' THEN 'voll' ELSE 'knapp' END FROM (SELECT public.hall_sound_status('$T_MAIN'::uuid) r) x;" "1")" \
      "$ht_closed_read"
  done
fi

echo "hallenton: $HT_CELLS Zellen geprueft ((${#MATRIX_IDS[@]} Identitaeten + anon) x 20, davon 9 im abgeschlossenen Turnier), $HT_MISMATCHES Abweichung(en)"
