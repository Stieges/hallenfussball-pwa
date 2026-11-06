# shellcheck shell=bash
#
# gathering-screens-check.d/30-anzeige.sh — Kategorie D (und O fuer die Version der Zuschauer-Antwort): Bildschirm-Abfrage ueber
# die ECHTE Server-Antwort (Wegwerf-PostgREST, rohe HTTP-Aufrufe mit selbst signiertem JWT; Pruefregel @ZM-180: jeder
# Uebertragungsweg zum Monitor braucht einen Test ueber die echte Antwort). Festgeschriebene Daten (Veranstaltung „HALLE1“),
# danach aufgeraeumt. Vor Versions-Schritten altern die Zeitstempel (Trigger aus), damit die Kappung „jetzt - 5 s“ nicht
# zufaellig gleiche Werte liefert.

disp() { # disp <key> [since] -- echte Antwort des Bildschirms (anon ohne Sitzung)
  if [[ -n "${2:-}" ]]; then rpc anon gathering_screen_display "{\"p_key\":\"$1\",\"p_since_version\":$2}"
  else rpc anon gathering_screen_display "{\"p_key\":\"$1\"}"; fi
}
jqr() { jq -r "$1" <<<"$2" 2>/dev/null || echo "fehler: ${2:0:200}"; }
rises_s() { if [[ "$1" =~ ^[0-9]+$ && "$2" =~ ^[0-9]+$ && "$2" -gt "$1" ]]; then echo steigt; else echo "faellt($1 -> $2)"; fi; }
switch() { rpc "$U_OLLI" set_gathering_on_screen "{\"p_tournament_id\":\"$1\",\"p_on\":${2:-true}}" >/dev/null; cat "$WORK/st"; }
age_s() {
  psql_stdin <<SQL || true
SET session_replication_role = replica;
UPDATE public.gatherings SET updated_at = now() - interval '3 minutes' WHERE id = '$GS';
UPDATE public.gathering_screens SET updated_at = now() - interval '3 minutes' WHERE gathering_id = '$GS';
UPDATE public.tournaments SET updated_at = now() - interval '2 minutes' WHERE gathering_id = '$GS';
UPDATE public.teams SET updated_at = now() - interval '3 minutes' WHERE tournament_id IN (SELECT id FROM public.tournaments WHERE gathering_id = '$GS');
UPDATE public.matches SET updated_at = now() - interval '3 minutes' WHERE tournament_id IN (SELECT id FROM public.tournaments WHERE gathering_id = '$GS');
UPDATE public_view.structure_changes SET changed_at = now() - interval '3 minutes' WHERE tournament_id IN (SELECT id FROM public.tournaments WHERE gathering_id = '$GS');
SQL
}

if q "SELECT to_regclass('public.gathering_screens') IS NOT NULL;" | grep -qx t; then
  psql_stdin <<SQL || true
DROP TABLE IF EXISTS harness.screen_matches_sicherung, harness.screen_t_sicherung;
CREATE TABLE harness.screen_matches_sicherung AS
  SELECT id, match_status, score_a, score_b, actual_start, updated_at FROM public.matches WHERE tournament_id IN ('$T_F2', '$T_F1', '$T_E');
CREATE TABLE harness.screen_t_sicherung AS SELECT id, config, updated_at FROM public.tournaments WHERE id IN ('$T_F2', '$T_F1');
$(sed 's/SET LOCAL/SET/g' <<<"$SETUP_S")
RESET ROLE;
-- Gespeicherter Endstand von E (wie finish_tournament ihn schreibt), damit der Vergleich einen echten Endstand traegt.
INSERT INTO public.tournament_final_standings (tournament_id, snapshot, finished_at, finished_by, request_id)
VALUES ('$T_E', '{"groups":[{"groupId":"A","rows":[{"teamId":"$TEAM_W1","rank":1}]}]}'::jsonb, now() - interval '7 days', '$U_OLLI', gen_random_uuid())
ON CONFLICT (tournament_id) DO NOTHING;
SQL
  D_READY=1
else
  D_READY=0
fi

if [[ "$D_READY" -eq 1 ]]; then
  # --- @VA-043 und erneuerte/unbekannte Schluessel ---------------------------------------------------------------------
  out=""
  for k in "HALLE1" "F2JUNI" "halle1" "$(tr 'a-f' 'A-F' <<<"$KEY_HALLE")" " $KEY_HALLE" "${KEY_HALLE}0" "$(key_for unbekannt)" ""; do
    r="$(disp "$k")"; out="$out$(cat "$WORK/st"):$(jqr '.state + "|" + (keys | join(","))' "$r");"
  done
  check D "@VA-043 Code der Veranstaltung, Code eines Turniers, Gross-/Kleinschreibung, Raender, unbekannter Schluessel: nur {state:invalid}" \
    "$(for _ in 1 2 3 4 5 6 7 8; do printf '200:invalid|state;'; done)" "$out"
  r="$(rpc anon public_gathering "{\"p_code\":\"$KEY_HALLE\"}")"
  check D "@VA-043 Schluessel als Code der Zuschauer-Seite: not_found" "not_found" "$(jqr '.state' "$r")"

  # --- Folie der Veranstaltung (nichts in der Halle, @VA-036 Z. 2) -------------------------------------------------------
  R0="$(disp "$KEY_HALLE")"
  check D "@VA-036 Z. 2 Folie der Veranstaltung: HTTP 200, Zustand gathering, Schluessel der Antwort" \
    "200|gathering|gathering,screen,server_now,sponsors,state,tournaments,version" \
    "$(cat "$WORK/st")|$(jqr '.state + "|" + (keys | join(","))' "$R0")"
  check D "@VA-034 Folien des Bildschirms nach Positivliste (ohne interne Notiz), Sponsoren nur der Folien und ohne Kontakt" \
    "defaultSlideDuration,id,name,overscanPercent,performanceMode,slides,theme,transition,transitionDuration|2|sp-bergader|id,logoUrl,name,tier,websiteUrl" \
    "$(jqr '(.screen | keys | join(",")) + "|" + (.screen.slides | length | tostring) + "|" + ([.sponsors[].id] | join(",")) + "|" + (.sponsors[0] | keys | join(","))' "$R0")"
  check D "@VA-036 Z. 2 Turniere fuer „Als Naechstes“: alle zulaessigen am Ort, auch das nicht geteilte D, nach Tag und Beginn; kein Entwurf, keine andere Halle" \
    "E-Junioren Hallenturnier|F2-Junioren Hallenturnier|F1-Junioren Hallenturnier|D-Junioren Hallenturnier|Nikolausturnier|HALLE1" \
    "$(jqr '([.tournaments[].title] | join("|")) + "|" + .gathering.name + "|" + .gathering.share_code' "$R0")"
  leak=""
  for word in "$KEY_HALLE" "secretNote" "Hausmeister" "vertrieb@" "Unbenutzt" "$U_OLLI" "Halle Nord" "B-Junioren" "$SC_EINGANG" "adopted"; do
    [[ "$R0" == *"$word"* ]] && leak="${leak}[${word}]"
  done
  check D "@VA-043 keine Schluessel, internen Notizen, Sponsoren-Kontakte, Kennungen, Entwuerfe oder Herkunft in der Antwort" "" "$leak"

  # --- Turnier in der Halle (@VA-035, @VA-034) --------------------------------------------------------------------------
  age_s; v_idle="$(jqr '.version' "$(disp "$KEY_HALLE")")"
  st="$(switch "$T_F2")"
  R1="$(disp "$KEY_HALLE")"
  # Fuer unchanged: alles aelter als „jetzt - 5 s“, sonst ist jede Antwort im Fenster der Kappung (bewusst) voll.
  age_s; R1b="$(disp "$KEY_HALLE")"
  check D "@VA-035 Olli tippt bei F2 (HTTP 200): naechste Abfrage zeigt F2 als volle Monitor-Antwort, Version steigt" \
    "200|tournament|$T_F2|full|F2-Junioren Hallenturnier|steigt" \
    "$st|$(jqr '.state + "|" + .on_screen.tournament_id + "|" + .payload.state + "|" + .payload.tournament.title' "$R1")|$(rises_s "$v_idle" "$(jqr '.version' "$R1")")"
  check D "@VA-034 Monitor-Fassung: ohne Monitore und Sponsoren des Turniers, ohne gathering_code, ohne eigene Version; mit Folien des Bildschirms" \
    "false|false|false|false|Halle|true" \
    "$(jqr '(.payload.tournament.config | has("monitors") | tostring) + "|" + (.payload.tournament.config | has("sponsors") | tostring) + "|" + (.payload.tournament | has("gathering_code") | tostring) + "|" + (.payload | has("version") | tostring) + "|" + .screen.name + "|" + (has("on_screen") | tostring)' "$R1")"
  v1="$(jqr '.version' "$R1b")"
  R2="$(disp "$KEY_HALLE" "$v1")"
  check D "nichts geaendert: unchanged ohne Inhalt, Version nicht kleiner" "unchanged|server_now,state,version|ok" \
    "$(jqr '.state + "|" + (keys | join(","))' "$R2")|$([[ "$(jqr '.version' "$R2")" -ge "$v1" ]] 2>/dev/null && echo ok || echo kleiner)"
  age_s; v_a="$(jqr '.version' "$(disp "$KEY_HALLE")")"
  psql_stdin <<<"UPDATE public.matches SET match_status = 'running', score_a = 2, score_b = 1, actual_start = now() WHERE id = '$M_F2_2';" || true
  R3="$(disp "$KEY_HALLE" "$v_a")"
  check D "Tor in F2: Delta mit genau diesem Spiel (2:1), ohne Folien/Sponsoren, Version steigt" \
    "tournament|delta|$M_F2_2|2:1|false|steigt" \
    "$(jqr '.state + "|" + .payload.state + "|" + ([.payload.matches[].id] | join(",")) + "|" + ((.payload.matches[0].score_a | tostring) + ":" + (.payload.matches[0].score_b | tostring)) + "|" + (has("screen") | tostring)' "$R3")|$(rises_s "$v_a" "$(jqr '.version' "$R3")")"
  psql_stdin <<<"UPDATE public.tournaments SET config = config || '{\"hideScoresForPublic\": true}'::jsonb WHERE id = '$T_F2';" || true
  R4="$(disp "$KEY_HALLE")"
  check D "@VA-034 Kindermodus kommt aus dem Turnier: kein Spielstand in der Antwort des Bildschirms" "full|0" \
    "$(jqr '.payload.state + "|" + ([.payload.matches[] | select(has("score_a") or has("score_b"))] | length | tostring)' "$R4")"
  psql_stdin <<<"UPDATE public.tournaments t SET config = b.config FROM harness.screen_t_sicherung b WHERE b.id = t.id;" || true

  # --- @ZM-180 und @VA-044: Version ueber Wechsel hinweg ----------------------------------------------------------------
  age_s; A="$(disp "$KEY_HALLE")"; vA="$(jqr '.version' "$A")"; pA="$(jqr '.version' "$(rpc anon public_gathering '{"p_code":"HALLE1"}')")"
  switch "$T_F1" >/dev/null
  R5="$(disp "$KEY_HALLE" "$vA")"
  check D "@VA-044 Bildschirm fragt nach dem Wechsel mit dem alten Stand: volle Antwort F1 mit Folien, Version hoeher" \
    "tournament|$T_F1|full|true|steigt" \
    "$(jqr '.state + "|" + .on_screen.tournament_id + "|" + .payload.state + "|" + (has("screen") | tostring)' "$R5")|$(rises_s "$vA" "$(jqr '.version' "$R5")")"
  check O "@VA-035 @VA-014 Wechsel setzt die Version der Zuschauer-Antwort hoch (ein aelterer Stand ist erkennbar)" "steigt" \
    "$(rises_s "$pA" "$(jqr '.version' "$(rpc anon public_gathering '{"p_code":"HALLE1"}')")")"
  age_s; v5="$(jqr '.version' "$(disp "$KEY_HALLE")")"
  switch "$T_F1" false >/dev/null
  R6="$(disp "$KEY_HALLE" "$v5")"
  check D "@ZM-180 herunternehmen: Folie der Veranstaltung, Version steigt" "gathering|steigt" \
    "$(jqr '.state' "$R6")|$(rises_s "$v5" "$(jqr '.version' "$R6")")"
  age_s; v6="$(jqr '.version' "$R6")"
  switch "$T_F2" >/dev/null
  R7="$(disp "$KEY_HALLE" "$v6")"
  check D "@ZM-180 @VA-036 Z. 4 zurueck auf das laenger unveraenderte F2: voll, Version steigt trotzdem" "tournament|$T_F2|full|steigt" \
    "$(jqr '.state + "|" + .on_screen.tournament_id + "|" + .payload.state' "$R7")|$(rises_s "$v6" "$(jqr '.version' "$R7")")"
  age_s; v7="$(jqr '.version' "$(disp "$KEY_HALLE")")"
  rpc "$U_OLLI" update_gathering_screen "{\"p_screen_id\":\"$SC_HALLE\",\"p_name\":\"Halle\",\"p_config\":{\"slides\":[]},\"p_sponsors\":[]}" >/dev/null
  R8="$(disp "$KEY_HALLE" "$v7")"
  check D "@VA-034 Folien geaendert: volle Antwort mit den neuen Folien, Version steigt" "full|0|steigt" \
    "$(jqr '.payload.state + "|" + (.screen.slides | length | tostring)' "$R8")|$(rises_s "$v7" "$(jqr '.version' "$R8")")"

  # --- Endstand (@VA-036 Z. 4) ------------------------------------------------------------------------------------------
  switch "$T_E" >/dev/null
  fs="$(rpc anon gathering_screen_final_standings "{\"p_key\":\"$KEY_HALLE\"}")"
  check D "@VA-036 Z. 4 E in der Halle: Endstand (final) fuer den Bildschirm = Endstand der Zuschauer-Seite (gleicher Baustein)" \
    "final|$(rpc anon public_final_standings '{"p_share_code":"EJUNIO"}' | jq -cS . 2>/dev/null)" "$(jqr '.status' "$fs")|$(jq -cS . <<<"$fs" 2>/dev/null || echo "$fs")"
  # Abwehr in der Tiefe: E an den Funktionen vorbei aus der Veranstaltung geloest, steht aber noch in der Halle -> kein Endstand.
  psql_stdin <<<"SET session_replication_role = replica; UPDATE public.tournaments SET gathering_id = NULL WHERE id = '$T_E';" || true
  check D "E an den Funktionen vorbei aus der Veranstaltung geloest: Bildschirm ohne Endstand (none) und mit Folie der Veranstaltung" "none|gathering" \
    "$(jqr '.status' "$(rpc anon gathering_screen_final_standings "{\"p_key\":\"$KEY_HALLE\"}")")|$(jqr '.state' "$(disp "$KEY_HALLE")")"
  psql_stdin <<<"SET session_replication_role = replica; UPDATE public.tournaments SET gathering_id = '$GS' WHERE id = '$T_E';" || true
  check D "Endstand mit erneuertem/unbekanntem Schluessel und mit Code: none" "none|none" \
    "$(jqr '.status' "$(rpc anon gathering_screen_final_standings "{\"p_key\":\"$(key_for unbekannt)\"}")")|$(jqr '.status' "$(rpc anon gathering_screen_final_standings '{"p_key":"HALLE1"}')")"
  # Abwehr in der Tiefe: steht (an den Funktionen vorbei) ein Entwurf in der Halle, zeigt der Bildschirm ihn nicht.
  psql_stdin <<<"SET session_replication_role = replica; UPDATE public.gatherings SET on_screen_tournament_id = '$T_DRAFT' WHERE id = '$GS';" || true
  check D "Entwurf an den Funktionen vorbei in der Halle: Bildschirm zeigt die Folie der Veranstaltung, Endstand none" "gathering|none" \
    "$(jqr '.state' "$(disp "$KEY_HALLE")")|$(jqr '.status' "$(rpc anon gathering_screen_final_standings "{\"p_key\":\"$KEY_HALLE\"}")")"

  # --- Rechte ueber rohe REST-Aufrufe ------------------------------------------------------------------------------------
  rpc anon set_gathering_on_screen "{\"p_tournament_id\":\"$T_F2\",\"p_on\":true}" >/dev/null; a_anon="$(cat "$WORK/st")"
  b_tom="$(rpc "$U_TOM" set_gathering_on_screen "{\"p_tournament_id\":\"$T_F2\",\"p_on\":true}" | jq -r '.code' 2>/dev/null || true)"
  rows_or() { curl -s -o "$WORK/b" -w '%{http_code}' "http://127.0.0.1:$REST_PORT/$2" -H "Authorization: Bearer $(tok_for "$1")"; }
  c_read="$(rows_or "$U_OLLI" "gathering_screens")"; c_anon="$(rows_or anon "gathering_screens")"
  c_patch="$(curl -s -o "$WORK/b" -w '%{http_code}' -X PATCH "http://127.0.0.1:$REST_PORT/gatherings?id=eq.$GS" \
    -H "Authorization: Bearer $(tok_for "$U_OLLI")" -H 'Content-Type: application/json' --data "{\"on_screen_tournament_id\":\"$T_F1\"}")"
  check D "REST: anon schaltet nicht (401), Tom HF006, gathering_screens lesen weder Olli (403) noch anon (401), PATCH auf gatherings 403" \
    "401|HF006|403|401|403" "$a_anon|$b_tom|$c_read|$c_anon|$c_patch"

  psql_stdin <<SQL || true
SET session_replication_role = replica;
UPDATE public.matches m SET match_status = b.match_status, score_a = b.score_a, score_b = b.score_b, actual_start = b.actual_start,
       updated_at = b.updated_at FROM harness.screen_matches_sicherung b WHERE b.id = m.id;
UPDATE public.tournaments t SET config = b.config, updated_at = b.updated_at FROM harness.screen_t_sicherung b WHERE b.id = t.id;
SET session_replication_role = origin;
DROP TABLE harness.screen_matches_sicherung, harness.screen_t_sicherung;
DELETE FROM public.tournament_final_standings WHERE tournament_id = '$T_E';
DELETE FROM public.gatherings WHERE id = '$GS';
UPDATE public.tournaments SET gathering_id = NULL WHERE gathering_id IS NOT NULL;
SQL
else
  check D "Bildschirm ueber die echte Server-Antwort (Tabelle gathering_screens fehlt)" "vorhanden" "fehlt"
fi
