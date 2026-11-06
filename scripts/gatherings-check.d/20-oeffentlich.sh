# shellcheck shell=bash
#
# gatherings-check.d/20-oeffentlich.sh — Kategorien P (public_gathering: Zustaende, Positivliste) und T (Turnierantwort mit
# gathering_code nur fuer Zuschauer, sonst Antwort vor = nach der Migration). Nie festgeschriebene Transaktionen; gerufen
# wird als anon ohne Sitzung (Mama Petra), wie die Zuschauer-Seite.

pg() { echo "$(who anon) SELECT 'k:' || public.public_gathering('$1')::text;"; }
pg_tx() { tx "$1
$(pg "${2:-WAGING}")"; }
FULL_SETUP="$SETUP_G $(assign "$G1" "'$T_F2', '$T_F1', '$T_D', '$T_E', '$T_OLD'")"

R="$(pg_tx "$FULL_SETUP")"
check P "@VA-001 Zustand full mit Namen der Veranstaltung" "full|$G_NAME" "$(jq -r '.state + "|" + .name' <<<"$R" 2>/dev/null || echo "$R")"
check P "@VA-002 @VA-004 nur die oeffentlichen, nach Tag und Beginn geordnet (D-Junioren nie geteilt fehlt)" \
  "E-Junioren Hallenturnier|G-Junioren vorgestern|F2-Junioren Hallenturnier|F1-Junioren Hallenturnier" \
  "$(jq -r '[.tournaments[]?.title] | join("|")' <<<"$R" 2>/dev/null || echo "$R")"
check P "@VA-002 Zustand je Turnier: abgeschlossen, gekappt (angepfiffen, Datum vorgestern), laeuft, geplant" \
  "finished|finished|live|planned" "$(jq -r '[.tournaments[]?.state] | join("|")' <<<"$R" 2>/dev/null || echo "$R")"
check P "@VA-002 Beginn = erster geplanter Anstoss, sonst start_time" "09:00:00|08:30:00|08:30:00|13:00:00" \
  "$(jq -r '[.tournaments[]?.begin // "ohne"] | join("|")' <<<"$R" 2>/dev/null || echo "$R")"
check P "last_match_started: alle Spiele mit dem spaetesten Anstoss angepfiffen (F2: 08:50 auf zwei Feldern offen; F1 ohne Spiele)" \
  "true|true|false|false" "$(jq -r '[.tournaments[]? | .last_match_started | tostring] | join("|")' <<<"$R" 2>/dev/null || echo "$R")"
check P "@VA-001 jeder Eintrag traegt den Code seiner Zuschauer-Seite" "EJUNIO|GJUNIO|F2JUNI|F1JUNI" \
  "$(jq -r '[.tournaments[]?.share_code] | join("|")' <<<"$R" 2>/dev/null || echo "$R")"
check P "@VA-003 Positivliste: Schluessel oben und je Turnier" \
  'name,server_now,state,tournaments,version|begin,date,last_match_started,location_name,share_code,state,title' \
  "$(jq -r '(keys | join(",")) + "|" + ([.tournaments[]? | keys[]] | unique | join(","))' <<<"$R" 2>/dev/null || echo "$R")"
leak=""
for word in "TSV Waging 1" "DJK Otting" "Olli Kontakt" "0171" "Hausmeister" "Trainer" "D-Junioren" "score" "$U_OLLI" "$T_F2"; do
  [[ "$R" == *"$word"* ]] && leak="${leak}[${word}]"
done
check P "@VA-003 keine Teamnamen, Spielstaende, Kontakte, Notizen, Kennungen oder nicht freigegebene Turniere in der Antwort" "" "$leak"
check P "Code ohne Gross-/Kleinschreibung und Raender" "full" \
  "$(pg_tx "$FULL_SETUP" " waging " | jq -r '.state' 2>/dev/null || echo fehler)"

# @VA-004: Freigabe zurueck, entfernt, vor dem Anpfiff geloescht -> fehlt ohne Spur; Rest unveraendert.
for ev in "UPDATE public.tournaments SET is_public = false WHERE id = '$T_F2':F2 Freigabe zurueckgenommen" \
          "UPDATE public.tournaments SET gathering_id = NULL WHERE id = '$T_F2':F2 aus der Veranstaltung entfernt" \
          "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_F1':vor dem ersten Anpfiff geloescht (F1, Papierkorb)" \
          "DELETE FROM public.tournaments WHERE id = '$T_F1':vor dem ersten Anpfiff endgueltig geloescht (F1)"; do
  R4="$(pg_tx "$FULL_SETUP $(who super) ${ev%%:*};")"
  if [[ "$ev" == *"'$T_F1'"* ]]; then gone="F1-Junioren"; code="F1JUNI"; rest="F2-Junioren Hallenturnier"; else gone="F2-Junioren"; code="F2JUNI"; rest="F1-Junioren Hallenturnier"; fi
  check P "@VA-004 ${ev#*:}: fehlt ohne Namen, die anderen bleiben" "full|E-Junioren Hallenturnier|G-Junioren vorgestern|$rest|fehlt" \
    "$(jq -r '.state + "|" + ([.tournaments[]?.title] | join("|"))' <<<"$R4" 2>/dev/null || echo "$R4")|$([[ "$R4" == *"$gone"* || "$R4" == *"$code"* ]] && echo enthalten || echo fehlt)"
done

# @VA-006: ohne sichtbare Turniere.
R6="$(pg_tx "$SETUP_G $(assign "$G1" "'$T_D'")")"
check P "@VA-006 Z. 1 keins freigegeben, eins steht bevor -> pending mit Namen, ohne Turniername und ohne Anzahl" \
  "pending|$G_NAME|name,server_now,state,version|fehlt" \
  "$(jq -r '.state + "|" + .name + "|" + (keys | join(","))' <<<"$R6" 2>/dev/null || echo "$R6")|$([[ "$R6" == *D-Junioren* ]] && echo enthalten || echo fehlt)"
check P "@VA-006 Z. 2 noch kein Turnier zugeordnet -> pending mit Namen" "pending|$G_NAME" \
  "$(pg_tx "$SETUP_G" | jq -r '.state + "|" + .name' 2>/dev/null || echo fehler)"
check P "@VA-006 Z. 2 nur ein Turnier im Papierkorb -> wie ohne Turnier (pending)" "pending" \
  "$(pg_tx "$SETUP_G $(assign "$G1" "'$T_TRASH'")" | jq -r '.state' 2>/dev/null || echo fehler)"
check P "@VA-006 Z. 3 Olli hat die Veranstaltung geloescht -> not_found" '{"state": "not_found"}' \
  "$(pg_tx "$SETUP_G $(who super) DELETE FROM public.gatherings WHERE id = '$G1';")"
check P "@VA-006 Z. 4 alle vorbei und keins mehr oeffentlich -> not_found" '{"state": "not_found"}' \
  "$(pg_tx "$SETUP_G $(assign "$G1" "'$T_E', '$T_OLD'") UPDATE public.tournaments SET is_public = false WHERE id IN ('$T_E', '$T_OLD');")"
check P "@VA-006 Z. 5 Code gab es nie / kein Code-Format -> not_found" '{"state": "not_found"}|{"state": "not_found"}' \
  "$(tx "$SETUP_G $(pg ZZZZZZ) $(pg "ab-12")")"
check P "Zustand cancelled (auf dem Server vorbereitet, MVP+) und laufend am Vortag (noch nicht gekappt)" "live|cancelled" \
  "$(pg_tx "$SETUP_G $(assign "$G1" "'$T_F1', '$T_OLD'")
SET LOCAL app.lifecycle_write = 'on'; UPDATE public.tournaments SET lifecycle_status = 'cancelled' WHERE id = '$T_F1'; RESET app.lifecycle_write;
UPDATE public.tournaments SET date = date + 1 WHERE id = '$T_OLD';" | jq -r '[.tournaments[]?.state] | join("|")' 2>/dev/null || echo fehler)"
check P "authentifizierte Konten (Clara) bekommen dieselbe oeffentliche Antwort" "full" \
  "$(tx "$FULL_SETUP $(who "$U_CLARA") SELECT 'k:' || (public.public_gathering('WAGING') ->> 'state');")"

# --- T: Turnierantwort (public_payload) -------------------------------------------------------------------------------
pt() { echo "$(who anon) SELECT 'k:' || public.public_tournament('$1')::text;"; }
dt() { echo "$(who anon) SELECT 'k:' || public.display_tournament('$T_F2', 'mon-halle')::text;"; }
check T "@VA-005 Turnier ohne Veranstaltung: Zuschauer-Antwort wie vor der Migration" "$(cat "$WORK/vorher_ohne_viewer.json")" \
  "$(tx "$(pt OHNE01)" | norm_payload 2>/dev/null || echo fehler)"
check T "@VA-013 Z. 4 F2 noch ohne Veranstaltung: Zuschauer-Antwort wie vor der Migration (kein gathering_code)" \
  "$(cat "$WORK/vorher_f2_viewer.json")" "$(tx "$(pt F2JUNI)" | norm_payload 2>/dev/null || echo fehler)"
RT="$(tx "$SETUP_G $(assign "$G1" "'$T_F2'") $(pt F2JUNI)")"
check T "@VA-013 @VA-014 F2 in der Veranstaltung: Zuschauer-Antwort traegt gathering_code WAGING, sonst wie vorher" \
  "WAGING|$(cat "$WORK/vorher_f2_viewer.json")" \
  "$(jq -r '.tournament.gathering_code // "fehlt"' <<<"$RT" 2>/dev/null)|$(norm_payload <<<"$RT" 2>/dev/null | jq -cS 'del(.tournament.gathering_code)' 2>/dev/null)"
check T "Bildschirm (display_tournament) bekommt keinen gathering_code, Antwort wie vorher" "$(cat "$WORK/vorher_f2_screen.json")" \
  "$(tx "$SETUP_G $(assign "$G1" "'$T_F2'") $(dt)" | norm_payload 2>/dev/null || echo fehler)"
check T "nicht geteiltes Turnier einer Veranstaltung: weiter not_found, kein Code" '{"state": "not_found"}' \
  "$(tx "$SETUP_G $(assign "$G1" "'$T_F2'") UPDATE public.tournaments SET is_public = false WHERE id = '$T_F2'; $(pt F2JUNI)")"
check T "nach dem Loeschen der Veranstaltung: Antwort wieder ohne gathering_code (@VA-015 Z. 3, @VA-005)" "fehlt" \
  "$(tx "$SETUP_G $(assign "$G1" "'$T_F2'") DELETE FROM public.gatherings WHERE id = '$G1'; $(pt F2JUNI)" | jq -r '.tournament.gathering_code // "fehlt"' 2>/dev/null || echo fehler)"
