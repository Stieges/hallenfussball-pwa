# shellcheck shell=bash
#
# rls-matrix.d/spur-zz-fortsetzen-spaet.sh — Zeilen von 20261118_009_fortsetzen_spaet.sql (spaetes „Spiel fortsetzen“ ->
# Klaerungsliste, Befund C-REOPEN-NACH-ABPFIFF-SPAET) fuer scripts/rls-role-matrix.sh. Per `source` eingebunden NACH
# spur-z-abschluss-nachzug.sh (Glob-Reihenfolge "spur-z-" < "spur-zz"), nutzt a27_sql (spur-geraete-a27.sh), perm_expected(),
# user_id_for_id(), role_for_id(), MATRIX_IDS.
#
# Vorbereitung je Probe (nie committete Transaktion, als Superuser bzw. als Eigentuemer ueber den echten Schreibweg): Spiel 11
# im Turnier T_MAIN, angepfiffen, 2:1, mit Ablauf der Spielzeit von selbst beendet; das Eintreffen des Abpfiffs (recorded_at)
# liegt N Sekunden zurueck (Schutz-Trigger dafuer kurz aus). Je Identitaet aus MATRIX_IDS sendet „Spiel fortsetzen“ (REOPEN,
# Geraetezeit 20 s nach dem Abpfiff, ohne Geraete-ID) -- Erwartung aus rolePermissions.json:
#   (i)  Ankunft nach 1 Minute (@SL-147 Z. 1): mit leadMatches oder writeMatchData „accepted|running“, sonst abgelehnt.
#   (ii) Ankunft nach 5 Minuten (@SL-147 Z. 2, @ZM-180): mit leadMatches „accepted|running“ (die Turnierleitung oeffnet ohne
#        Frist, @FU-071); nur writeMatchData (Helfer) „review:AFTER_END|finished“ -- das Spiel bleibt beendet, das Fortsetzen
#        liegt in der Klaerungsliste; ohne Recht abgelehnt.
# Ein angenommenes, dann entzogenes Mitglied (declined-membership) bekommt mit A-35 „review:RIGHTS_REVOKED“ (I-4).
# Gegenprobe: --without-fs (der Helfer oeffnet nach 5 Minuten wieder -> rot).

FS_MISMATCHES=0
FS_CELLS=0
FS_TEAM_A="$(uuid_for fs-team:nord)"
FS_TEAM_B="$(uuid_for fs-team:sued)"
FS_MATCH="$(uuid_for fs-match:spiel-11)"
FS_END="$(uuid_for fs-event:ende)"

fs_setup() { # fs_setup <Sekunden seit dem Eintreffen des Abpfiffs>
  cat <<SQL
INSERT INTO public.teams (id, tournament_id, name) VALUES ('$FS_TEAM_A', '$T_MAIN', 'FC Nord'), ('$FS_TEAM_B', '$T_MAIN', 'SV Süd');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, score_a, score_b)
VALUES ('$FS_MATCH', '$T_MAIN', 11, 43, '$FS_TEAM_A', '$FS_TEAM_B', 11, NULL, NULL);
SET LOCAL request.jwt.claim.sub = '$U_OWNER';
SELECT public.append_match_events('$FS_MATCH', jsonb_build_array(
  jsonb_build_object('id', '$(uuid_for fs-event:start)', 'type', 'MATCH_START', 'at', e - 900000 - $1 * 1000, 'section', 1, 'clockMs', NULL, 'payload', '{}'::jsonb),
  jsonb_build_object('id', '$(uuid_for fs-event:tor1)', 'type', 'GOAL', 'at', e - 840000 - $1 * 1000, 'section', 1, 'clockMs', 60000, 'teamId', '$FS_TEAM_A', 'payload', '{}'::jsonb),
  jsonb_build_object('id', '$(uuid_for fs-event:tor2)', 'type', 'GOAL', 'at', e - 780000 - $1 * 1000, 'section', 1, 'clockMs', 120000, 'teamId', '$FS_TEAM_B', 'payload', '{}'::jsonb),
  jsonb_build_object('id', '$(uuid_for fs-event:tor3)', 'type', 'GOAL', 'at', e - 720000 - $1 * 1000, 'section', 1, 'clockMs', 180000, 'teamId', '$FS_TEAM_A', 'payload', '{}'::jsonb),
  jsonb_build_object('id', '$FS_END', 'type', 'MATCH_END', 'at', e - $1 * 1000, 'section', 1, 'clockMs', 900000, 'payload', '{}'::jsonb)), 1, NULL)
  FROM (SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS e) AS jetzt;
RESET request.jwt.claim.sub;
ALTER TABLE public.match_events DISABLE TRIGGER match_events_guard_engine_rows;
UPDATE public.match_events SET recorded_at = clock_timestamp() - interval '$1 seconds' WHERE id = '$FS_END';
ALTER TABLE public.match_events ENABLE TRIGGER match_events_guard_engine_rows;
-- Geraetezeit des Fortsetzens (Abpfiff + 20 s) als Superuser festhalten: die Identitaet sieht match_events je nach Recht nicht.
SELECT set_config('fs.reopen_at', (SELECT (floor(extract(epoch FROM coalesce(e.client_time, e.recorded_at)) * 1000)::bigint + 20000)::text
                                     FROM public.match_events e WHERE e.id = '$FS_END'), true);
SQL
}

fs_cell() { # fs_cell <Name> <erhalten> <erwartet>
  FS_CELLS=$((FS_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); FS_MISMATCHES=$((FS_MISMATCHES + 1))
    printf 'fs   %-62s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

# fs_send <uid> <Sekunden> -> "<status>:<code>|<match_status>"
fs_send() {
  local out
  out="$(a27_sql authenticated "$1" \
    "SELECT 'r:' || coalesce(x -> 'results' -> 0 ->> 'status', x::text) || ':' || coalesce(x -> 'results' -> 0 ->> 'code', '')
       FROM public.append_match_events('$FS_MATCH', jsonb_build_array(jsonb_build_object(
              'id', '$(uuid_for fs-event:fortsetzen)', 'type', 'REOPEN', 'section', 1, 'clockMs', 860000, 'payload', '{}'::jsonb,
              'at', current_setting('fs.reopen_at')::bigint)), 1, NULL) AS x;
     RESET ROLE;
     SELECT 'c:' || coalesce(match_status, '-') FROM public.matches WHERE id = '$FS_MATCH';" "$(fs_setup "$2")")"
  echo "$( (grep -m1 '^r:' <<<"$out" || echo "r:fehler $(tr '\n' ' ' <<<"$out" | cut -c1-160)") | cut -c3-)|$( (grep -m1 '^c:' <<<"$out" || echo "c:fehler") | cut -c3-)"
}

for fs_id in "${MATRIX_IDS[@]}"; do
  fs_uid="$(user_id_for_id "$fs_id")"
  fs_lead="$(perm_expected "$(role_for_id "$fs_id")" leadMatches)"
  fs_write="$(perm_expected "$(role_for_id "$fs_id")" writeMatchData)"
  if [[ "$fs_lead" == "true" ]]; then
    fs_exp_1="accepted:|running"; fs_exp_5="accepted:|running"
  elif [[ "$fs_write" == "true" ]]; then
    fs_exp_1="accepted:|running"; fs_exp_5="review:AFTER_END|finished"
  elif [[ "${WITH_A35:-0}" -eq 1 && "$fs_id" == "declined-membership" ]]; then
    fs_exp_1="review:RIGHTS_REVOKED|finished"; fs_exp_5="review:RIGHTS_REVOKED|finished"
  else
    fs_exp_1="rejected:FORBIDDEN_ACTOR|finished"; fs_exp_5="rejected:FORBIDDEN_ACTOR|finished"
  fi
  fs_cell "@SL-147 Z. 1 Fortsetzen nach 1 Minute angekommen $fs_id" "$(fs_send "$fs_uid" 60)" "$fs_exp_1"
  fs_cell "@SL-147 Z. 2 @ZM-180 Fortsetzen nach 5 Minuten angekommen $fs_id" "$(fs_send "$fs_uid" 300)" "$fs_exp_5"
done

echo "fs: $FS_CELLS Zellen geprueft (${#MATRIX_IDS[@]} Identitaeten x 2), $FS_MISMATCHES Abweichung(en)"
