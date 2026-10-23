# shellcheck shell=bash
#
# rls-matrix.d/spur-x-spiel-beenden.sh — Zeilen von 20261110_009_spiel_beenden.sql (Spiel im Spielplan beenden und Ergebnis
# eintragen) fuer scripts/rls-role-matrix.sh. Per `source` eingebunden NACH spur-geraete-a27.sh, spur-steuer-a34.sh und
# spur-wertung-a25.sh (Glob-Reihenfolge "spur-g" < "spur-s" < "spur-w" < "spur-x"), nutzt a27_sql (spur-geraete-a27.sh).
#
# Je Identitaet aus MATRIX_IDS (Erwartung aus rolePermissions.json, Recht leadMatches):
#   (i)  laufendes Spiel auf einem freien Feld: append_match_events RESULT_ENTRY {scores 3:1, basedOn null} ohne Geraete-ID
#        -> mit Recht "accepted|finished" (@FU-112), sonst "rejected|running" (@FU-113: Helfer FORBIDDEN_ACTOR, Fremde ebenso);
#   (ii) dasselbe, aber ein anderes Geraet steuert das Feld (Halter Eigentuemer, fremde Geraete-ID, Epoche 3); die Identitaet
#        sendet mit eigener Geraete-ID -> mit Recht "accepted|finished|<Halter unveraendert>" (@FU-115, Review M3), sonst
#        "rejected|running|<Halter unveraendert>" (Helfer NOT_CONTROLLER bzw. FORBIDDEN_ACTOR).
# Den Anpfiff setzt die Vorbereitung als Eigentuemer ueber den echten Schreibweg. Jede Probe in einer nie committeten
# Transaktion. Gegenprobe: --without-sb (ohne Migration bleibt das Spiel laufend -> rot fuer die Turnierleitung).

SB_MISMATCHES=0
SB_CELLS=0
SB_TEAM_A="$(uuid_for sb-team:nord)"
SB_TEAM_B="$(uuid_for sb-team:sued)"
SB_MATCH="$(uuid_for sb-match:spiel-9)"
SB_HOLDER_DEVICE="$(uuid_for sb-device:fremd)"
SB_OWN_DEVICE="$(uuid_for sb-device:eigen)"
SB_START="[{\"id\": \"$(uuid_for sb-event:start)\", \"type\": \"MATCH_START\", \"at\": 1000, \"section\": 1, \"clockMs\": null, \"payload\": {}}]"
SB_SETUP="INSERT INTO public.teams (id, tournament_id, name) VALUES ('$SB_TEAM_A', '$T_MAIN', 'FC Nord'), ('$SB_TEAM_B', '$T_MAIN', 'SV Süd');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, score_a, score_b)
VALUES ('$SB_MATCH', '$T_MAIN', 9, 7, '$SB_TEAM_A', '$SB_TEAM_B', 99, NULL, NULL);
SET LOCAL request.jwt.claim.sub = '$U_OWNER';
SELECT public.append_match_events('$SB_MATCH', \$J\$$SB_START\$J\$::jsonb, 1, NULL);
RESET request.jwt.claim.sub;"
SB_SETUP_HELD="$SB_SETUP
INSERT INTO public.field_control (tournament_id, field, epoch, holder_user_id, holder_device_id, holder_device_label)
VALUES ('$T_MAIN', 7, 3, '$U_OWNER', '$SB_HOLDER_DEVICE', 'Tablet')
ON CONFLICT (tournament_id, field) DO UPDATE SET epoch = 3, holder_user_id = EXCLUDED.holder_user_id,
  holder_device_id = EXCLUDED.holder_device_id, holder_device_label = EXCLUDED.holder_device_label;"
SB_END="[{\"id\": \"$(uuid_for sb-event:ende)\", \"type\": \"RESULT_ENTRY\", \"at\": 2000, \"section\": null, \"clockMs\": null, \"payload\": {\"scores\": {\"$SB_TEAM_A\": 3, \"$SB_TEAM_B\": 1}, \"basedOn\": null}}]"
SB_HOLDER_EXP="$U_OWNER|$SB_HOLDER_DEVICE|3"

sb_cell() { # sb_cell <Name> <erhalten> <erwartet>
  SB_CELLS=$((SB_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); SB_MISMATCHES=$((SB_MISMATCHES + 1))
    printf 'sb   %-60s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

# sb_send <uid> <Geraet|NULL> <Vorbereitung> -> "<status>|<match_status>|<Halter>"
sb_send() {
  local out
  out="$(a27_sql authenticated "$1" \
    "SELECT 'r:' || coalesce(x -> 'results' -> 0 ->> 'status', x::text)
       FROM public.append_match_events('$SB_MATCH', \$J\$$SB_END\$J\$::jsonb, 1, $2) AS x;
     RESET ROLE;
     SELECT 'c:' || coalesce(match_status, '-') FROM public.matches WHERE id = '$SB_MATCH';
     SELECT 'h:' || coalesce((SELECT coalesce(holder_user_id::text, '-') || '|' || coalesce(holder_device_id::text, '-') || '|' || epoch
                               FROM public.field_control WHERE tournament_id = '$T_MAIN' AND field = 7), 'keine-zeile');" "$3")"
  echo "$( (grep -m1 '^r:' <<<"$out" || echo "r:fehler") | cut -c3-)|$( (grep -m1 '^c:' <<<"$out" || echo "c:fehler") | cut -c3-)|$( (grep -m1 '^h:' <<<"$out" || echo "h:fehler") | cut -c3-)"
}

for sb_id in "${MATRIX_IDS[@]}"; do
  sb_uid="$(user_id_for_id "$sb_id")"
  sb_allowed="$(perm_expected "$(role_for_id "$sb_id")" "leadMatches")"
  [[ "$sb_allowed" == "true" ]] && sb_exp="accepted|finished" || sb_exp="rejected|running"

  # (i) freies Feld, ohne Geraete-ID (kein Anspruch moeglich)
  sb_got="$(sb_send "$sb_uid" "NULL" "$SB_SETUP")"
  sb_cell "@FU-112 @FU-113 Beenden im Spielplan, freies Feld $sb_id" "$(cut -d'|' -f1-2 <<<"$sb_got")" "$sb_exp"

  # (ii) ein anderes Geraet steuert das Feld; eigene Geraete-ID
  sb_got="$(sb_send "$sb_uid" "'$SB_OWN_DEVICE'::uuid" "$SB_SETUP_HELD")"
  sb_cell "@FU-115 Beenden ohne Uebernahme, fremdes Geraet steuert $sb_id" "$sb_got" "$sb_exp|$SB_HOLDER_EXP"
done

echo "sb: $SB_CELLS Zellen geprueft (${#MATRIX_IDS[@]} Identitaeten x 2), $SB_MISMATCHES Abweichung(en)"
