# shellcheck shell=bash
#
# gathering-screens-check.d/40-zuschauer.sh — Kategorie O („Jetzt in der Halle“ in public_gathering, @VA-045 bis @VA-047) und
# T (Turnier-, Monitor- und Endstand-Antwort unveraendert; public_gathering ohne Bildschirme wie vorher). Nie festgeschriebene
# Transaktionen; gerufen wird als anon ohne Sitzung (Lena, Mama Petra).

pgs() { echo "$(who anon) SELECT 'k:' || public.public_gathering('${1:-HALLE1}')::text;"; }
LIVE_F2="$(who super) UPDATE public.matches SET match_status = 'running', score_a = 2, score_b = 1, actual_start = now() WHERE id = '$M_F2_2';"
ons() { jq -c '.on_screen // "fehlt"' 2>/dev/null || echo fehler; }

check O "@VA-045 F2 in der Halle, Spiel 2 laeuft 2:1: on_screen mit Code, Titel und laufendem Spiel samt Stand" \
  '{"live_matches":[{"field":1,"match_number":2,"score_a":2,"score_b":1,"status":"running"}],"share_code":"F2JUNI","title":"F2-Junioren Hallenturnier"}' \
  "$(tx "$SETUP_S $LIVE_F2 $(on_sql "$T_F2") $(pgs)" | jq -cS '.on_screen // "fehlt"' 2>/dev/null || echo fehler)"
check O "@VA-045 Kindermodus: „Spiel 2 laeuft“ ohne Stand" '[{"field":1,"match_number":2,"status":"running"}]' \
  "$(tx "$SETUP_S $LIVE_F2 $(on_sql "$T_F2") UPDATE public.tournaments SET config = config || '{\"hideScoresForPublic\": true}'::jsonb WHERE id = '$T_F2'; $(pgs)" | jq -cS '.on_screen.live_matches // "fehlt"' 2>/dev/null || echo fehler)"
check O "Live-Stand fuer Zuschauer ausgeschaltet: ohne Stand" '[{"field":1,"match_number":2,"status":"running"}]' \
  "$(tx "$SETUP_S $LIVE_F2 $(on_sql "$T_F2") UPDATE public.tournaments SET config = config || '{\"publicLiveScore\": false}'::jsonb WHERE id = '$T_F2'; $(pgs)" | jq -cS '.on_screen.live_matches // "fehlt"' 2>/dev/null || echo fehler)"
check O "@VA-035 F1 ohne Anpfiff in der Halle: „Jetzt in der Halle: F1“ ohne laufendes Spiel" '{"live_matches":[],"share_code":"F1JUNI","title":"F1-Junioren Hallenturnier"}' \
  "$(tx "$SETUP_S $(on_sql "$T_F1") $(pgs)" | jq -cS '.on_screen // "fehlt"' 2>/dev/null || echo fehler)"
check O "@VA-036 Z. 5 nicht geteiltes D in der Halle: kein on_screen, Seite sonst voll" "full|fehlt" \
  "$(tx "$SETUP_S $(on_sql "$T_D") $(pgs)" | jq -r '.state + "|" + (.on_screen // "fehlt" | tostring)' 2>/dev/null || echo fehler)"
check O "Freigabe von F2 zurueckgenommen (Code bleibt): kein on_screen" '"fehlt"' \
  "$(tx "$SETUP_S $(on_sql "$T_F2") UPDATE public.tournaments SET is_public = false WHERE id = '$T_F2'; $(pgs)" | ons)"
check O "@VA-047 nichts in der Halle: kein on_screen (der Hinweis richtet sich nach der Uhrzeit)" '"fehlt"' \
  "$(tx "$SETUP_S $(pgs)" | ons)"
check O "ohne Bildschirme (an den Funktionen vorbei gesetzt): kein on_screen -- ohne Monitore gilt „was laeuft“" '"fehlt"' \
  "$(tx "$SETUP_S $(on_sql "$T_F2") DELETE FROM public.gathering_screens WHERE gathering_id = '$GS'; $(pgs)" | ons)"
check O "@VA-045 Positivliste: on_screen ohne Kennungen, Team- oder Kontaktdaten" "" \
  "$(R="$(tx "$SETUP_S $LIVE_F2 $(on_sql "$T_F2") $(pgs)")"; l=""; for w in "$T_F2" "$M_F2_2" "TSV Waging" "DJK" "Olli Kontakt" "$KEY_HALLE" "Nikolaus"; do
      [[ "$(jq -c '.on_screen' <<<"$R" 2>/dev/null)" == *"$w"* ]] && l="$l[$w]"; done; echo "$l")"
# @VA-046: wer E offen hat, bleibt dort -- der Wechsel aendert weder E noch seine Antwort (Zeitstempel unveraendert, also auch
# die Version nicht).
E_RAW() { tx "$SETUP_S $1 $(who anon) SELECT 'k:' || public.public_tournament('EJUNIO')::text;" | norm_payload 2>/dev/null || echo fehler; }
check O "@VA-046 E abgeschlossen, Olli setzt F2 auf die Bildschirme: Antwort von E gleich" \
  "$(E_RAW "")" "$(E_RAW "$(who "$U_OLLI") SELECT public.set_gathering_on_screen('$T_F2', true);")"
check O "@VA-046 der Wechsel beruehrt kein Turnier (updated_at von E und F2 unveraendert)" "t" \
  "$(tx "$SETUP_S $(who super) SELECT set_config('e.before', (SELECT string_agg(updated_at::text, ',' ORDER BY id) FROM public.tournaments WHERE id IN ('$T_E', '$T_F2')), true);
$(who "$U_OLLI") SELECT public.set_gathering_on_screen('$T_F2', true);
$(who super) $(val "(SELECT string_agg(updated_at::text, ',' ORDER BY id) FROM public.tournaments WHERE id IN ('$T_E', '$T_F2')) = current_setting('e.before')")" | sed 's/true/t/')"
check O "@VA-046 dieselbe Seite holt „Jetzt in der Halle: F2“ aus der Veranstaltung" "F2-Junioren Hallenturnier" \
  "$(tx "$SETUP_S $(on_sql "$T_F2") $(pgs)" | jq -r '.on_screen.title // "fehlt"' 2>/dev/null || echo fehler)"

# --- T: unveraendert ------------------------------------------------------------------------------------------------
GV_SCREEN="$(who super) INSERT INTO public.gathering_screens (gathering_id, name, screen_key) VALUES ('$GS2', 'Halle', '$KEY_EINGANG');"
check T "public_gathering einer Veranstaltung ohne Bildschirme: Antwort wie vor der Migration" "$(cat "$WORK/vorher_pg.json")" \
  "$(tx "$GV_SETUP $(pgs VERGL1)" | norm_payload 2>/dev/null || echo fehler)"
check T "Bildschirm vorhanden, nichts in der Halle: public_gathering wie vor der Migration" "$(cat "$WORK/vorher_pg.json")" \
  "$(tx "$GV_SETUP $GV_SCREEN $(pgs VERGL1)" | norm_payload 2>/dev/null || echo fehler)"
check T "Zuschauer-Antwort von F2 auf den Bildschirmen der Veranstaltung: wie vor der Migration (public_payload unveraendert)" \
  "$(cat "$WORK/vorher_f2_viewer_g.json")" \
  "$(tx "$GV_SETUP $GV_SCREEN UPDATE public.gatherings SET screen_location_name = '$ORT', on_screen_tournament_id = '$T_F2' WHERE id = '$GS2';
$(who anon) SELECT 'k:' || public.public_tournament('F2JUNI')::text;" | norm_payload 2>/dev/null || echo fehler)"
check T "@VA-042 bewusst nicht am Server: Monitor-Link von F2 waehrend F2 auf den Bildschirmen der Veranstaltung steht -- wie vorher" \
  "$(cat "$WORK/vorher_f2_screen.json")" \
  "$(tx "$GV_SETUP $GV_SCREEN UPDATE public.gatherings SET screen_location_name = '$ORT', on_screen_tournament_id = '$T_F2' WHERE id = '$GS2';
$(who anon) SELECT 'k:' || public.display_tournament('$T_F2', 'mon-halle')::text;" | norm_payload 2>/dev/null || echo fehler)"
check T "Endstand der Zuschauer-Seite von E: wie vor der Migration" "$(cat "$WORK/vorher_e_final.json")" \
  "$(tx "$GV_SETUP $GV_SCREEN $(who anon) SELECT 'k:' || public.public_final_standings('EJUNIO')::text;")"
