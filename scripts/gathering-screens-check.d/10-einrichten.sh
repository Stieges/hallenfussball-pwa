# shellcheck shell=bash
#
# gathering-screens-check.d/10-einrichten.sh — Kategorie B: Bildschirme der Veranstaltung einrichten (@VA-034), Schluessel
# erneuern (@VA-036 Z. 6), loeschen, aus einem Turnier-Monitor uebernehmen (@VA-042 Herkunft), Ort (@VA-041). Jede Zeile eine
# nie festgeschriebene Transaktion.

disp_state() { echo "$(who anon) SELECT 'k:' || (public.gathering_screen_display('$1') ->> 'state');"; }
G_ONLY="$(who super)
INSERT INTO public.gatherings (id, owner_id, name, share_code, screen_location_name)
VALUES ('$GS', '$U_OLLI', 'Nikolausturnier', 'HALLE1', '$ORT');"
CREATE_HALLE="public.create_gathering_screen('$GS', '  Halle  ', '$SCREEN_CONFIG'::jsonb, '$SCREEN_SPONSORS'::jsonb)"

check B "@VA-034 Olli legt den Bildschirm Halle an: Antwort {id, key}, Schluessel 32 Hex-Zeichen, Name ohne Raender, Folien und Sponsoren gespeichert" \
  "ok:true|Halle|2|2" \
  "$(tx "$G_ONLY $(who "$U_OLLI")
$(try "SELECT (r ->> 'key') ~ '^[0-9a-f]{32}\$' AND (r ->> 'id') IS NOT NULL FROM (SELECT $CREATE_HALLE AS r) x")
$(who super)
$(val "(SELECT name FROM public.gathering_screens WHERE gathering_id = '$GS')")
$(val "(SELECT jsonb_array_length(config -> 'slides') FROM public.gathering_screens WHERE gathering_id = '$GS')")
$(val "(SELECT jsonb_array_length(sponsors) FROM public.gathering_screens WHERE gathering_id = '$GS')")")"
check B "@VA-034 zwei Bildschirme bekommen verschiedene Schluessel" "ok:true" \
  "$(tx "$G_ONLY $(who "$U_OLLI") $(try "SELECT ($CREATE_HALLE ->> 'key') <> (public.create_gathering_screen('$GS', 'Eingang', '{}', '[]') ->> 'key')")")"
for who_id in "$U_MARIA:Maria (Co-Admin eines Turniers):HF006" "$U_CLARA:Clara (Konto ohne Rolle):HF006" \
              "$U_ANJA:Anja (anonyme Sitzung):HF006" "$U_SCREEN:Bildschirm-Rolle:HF006" "anon:anon ohne Sitzung:42501"; do
  IFS=: read -r w label code <<<"$who_id"
  check B "@VA-034 E8 $label legt keinen Bildschirm an ($code)" "err:$code|0" \
    "$(tx "$SETUP_S $(coadmin_sql "$U_MARIA" "$T_F1") $(who "$w") $(try "SELECT $CREATE_HALLE::text")
$(who super) $(val "(SELECT count(*) - 1 FROM public.gathering_screens WHERE gathering_id = '$GS')")")"
done
check B "unbekannte Veranstaltung -> HF008" "err:HF008" \
  "$(tx "$(who "$U_OLLI") $(try "SELECT public.create_gathering_screen('$GS2', 'Halle', '{}', '[]')::text")")"
for bad in "''#'{}'#'[]'#HF010#Name leer" "repeat('x', 81)#'{}'#'[]'#HF010#Name 81 Zeichen" \
           "'Hal' || chr(7) || 'le'#'{}'#'[]'#HF010#Name mit Steuerzeichen" \
           "'Halle'#'[]'#'[]'#HF014#config kein Objekt" "'Halle'#'{\"slides\":{}}'#'[]'#HF014#slides kein Array" \
           "'Halle'#'{}'#'{}'#HF014#sponsors kein Array" "'Halle'#'{}'#'[1]'#HF014#Sponsor kein Objekt" \
           "'Halle'#'{}'#NULL#HF014#sponsors fehlt" \
           "'Halle'#jsonb_build_object('slides', '[]'::jsonb, 'x', repeat('a', 1048577))#'[]'#HF014#ueber 1 MiB"; do
  IFS='#' read -r n c s code label <<<"$bad"
  check B "$label -> $code" "err:$code" \
    "$(tx "$G_ONLY $(who "$U_OLLI") $(try "SELECT public.create_gathering_screen('$GS', $n, $c::jsonb, $s::jsonb)::text")")"
done
check B "Grenze: der 11. Bildschirm einer Veranstaltung -> HF013" "err:HF013" \
  "$(tx "$G_ONLY INSERT INTO public.gathering_screens (gathering_id, name, screen_key)
SELECT '$GS', 'B' || n, lpad(to_hex(n), 32, '0') FROM generate_series(1, 10) AS n;
$(who "$U_OLLI") $(try "SELECT public.create_gathering_screen('$GS', 'Elfter', '{}', '[]')::text")")"

# --- aendern ------------------------------------------------------------------------------------------------------
check B "@VA-034 Olli aendert Name, Folien und Sponsoren; updated_at steigt" "ok:|Halle links|0|0|true" \
  "$(tx "$SETUP_S SET LOCAL session_replication_role = replica; UPDATE public.gathering_screens SET updated_at = now() - interval '1 hour' WHERE id = '$SC_HALLE'; SET LOCAL session_replication_role = origin;
$(who "$U_OLLI") $(try "SELECT public.update_gathering_screen('$SC_HALLE', 'Halle links', '{\"slides\":[]}', '[]')::text")
$(who super)
$(val "(SELECT name FROM public.gathering_screens WHERE id = '$SC_HALLE')")
$(val "(SELECT jsonb_array_length(config -> 'slides') FROM public.gathering_screens WHERE id = '$SC_HALLE')")
$(val "(SELECT jsonb_array_length(sponsors) FROM public.gathering_screens WHERE id = '$SC_HALLE')")
$(val "(SELECT updated_at > now() - interval '1 minute' FROM public.gathering_screens WHERE id = '$SC_HALLE')")")"
check B "Maria aendert nicht (HF006), unbekannter Bildschirm HF008, ungueltige Folien HF014" "err:HF006|err:HF008|err:HF014|Halle" \
  "$(tx "$SETUP_S $(who "$U_MARIA") $(try "SELECT public.update_gathering_screen('$SC_HALLE', 'Maria', '{}', '[]')::text")
$(who "$U_OLLI") $(try "SELECT public.update_gathering_screen('$SC_EINGANG', 'X', '{}', '[]')::text")
$(try "SELECT public.update_gathering_screen('$SC_HALLE', 'X', '[]', '[]')::text")
$(who super) $(val "(SELECT name FROM public.gathering_screens WHERE id = '$SC_HALLE')")")"

# --- Schluessel erneuern (@VA-036 Z. 6) ----------------------------------------------------------------------------
check B "@VA-036 Z. 6 Neuen Schluessel erzeugen: alter Schluessel 'invalid', neuer gueltig, Format 32 Hex" \
  "gathering|ok:true|invalid|gathering" \
  "$(tx "$SETUP_S $(disp_state "$KEY_HALLE")
$(who "$U_OLLI") $(try "SELECT (public.rotate_gathering_screen_key('$SC_HALLE') ->> 'key') ~ '^[0-9a-f]{32}\$'")
$(disp_state "$KEY_HALLE")
$(who super) SELECT set_config('gs.key', (SELECT screen_key FROM public.gathering_screens WHERE id = '$SC_HALLE'), true);
$(who anon) SELECT 'k:' || (public.gathering_screen_display(current_setting('gs.key')) ->> 'state');")"
check B "Maria erneuert nicht (HF006), unbekannter Bildschirm HF008; Schluessel unveraendert" "err:HF006|err:HF008|$KEY_HALLE" \
  "$(tx "$SETUP_S $(who "$U_MARIA") $(try "SELECT public.rotate_gathering_screen_key('$SC_HALLE')::text")
$(who "$U_OLLI") $(try "SELECT public.rotate_gathering_screen_key('$SC_EINGANG')::text")
$(who super) $(val "(SELECT screen_key FROM public.gathering_screens WHERE id = '$SC_HALLE')")")"

# --- loeschen -----------------------------------------------------------------------------------------------------
check B "Olli loescht den letzten Bildschirm: Schluessel ungueltig, kein Turnier mehr in der Halle, ein neuer Bildschirm holt es nicht zurueck" \
  "ok:|invalid|NULL|NULL" \
  "$(tx "$SETUP_S $(on_sql "$T_F2")
$(who "$U_OLLI") $(try "SELECT public.delete_gathering_screen('$SC_HALLE')::text")
$(disp_state "$KEY_HALLE")
$(who super) $(val "(SELECT on_screen_tournament_id FROM public.gatherings WHERE id = '$GS')")
$(who "$U_OLLI") SELECT public.create_gathering_screen('$GS', 'Neu', '{}', '[]');
$(who super) $(val "(SELECT on_screen_tournament_id FROM public.gatherings WHERE id = '$GS')")")"
check B "Loeschen eines von zwei Bildschirmen laesst das Turnier in der Halle stehen; Maria loescht nicht (HF006)" \
  "err:HF006|ok:|$T_F2" \
  "$(tx "$SETUP_S $(on_sql "$T_F2")
INSERT INTO public.gathering_screens (id, gathering_id, name, screen_key) VALUES ('$SC_EINGANG', '$GS', 'Eingang', '$KEY_EINGANG');
$(who "$U_MARIA") $(try "SELECT public.delete_gathering_screen('$SC_HALLE')::text")
$(who "$U_OLLI") $(try "SELECT public.delete_gathering_screen('$SC_HALLE')::text")
$(who super) $(val "(SELECT on_screen_tournament_id FROM public.gatherings WHERE id = '$GS')")")"
check B "Loeschen der Veranstaltung loescht ihre Bildschirme (Schluessel ungueltig)" "invalid|0" \
  "$(tx "$SETUP_S DELETE FROM public.gatherings WHERE id = '$GS'; $(disp_state "$KEY_HALLE")
$(who super) $(val "(SELECT count(*) FROM public.gathering_screens WHERE id = '$SC_HALLE')")")"

# --- uebernehmen (@VA-042 Herkunft; Server-Teil der Exklusivitaet bewusst nicht) -----------------------------------
F2_MON="$(who super) UPDATE public.tournaments SET config = config || jsonb_build_object(
  'monitors', '[{\"id\":\"mon-halle\",\"name\":\"Hallenmonitor\",\"defaultSlideDuration\":20,\"createdAt\":\"x\",\"slides\":[{\"id\":\"a\",\"type\":\"sponsor\",\"config\":{\"sponsorId\":\"sp-1\"},\"duration\":null,\"order\":0}]},{\"id\":\"mon-eingang\",\"name\":\"Eingang\",\"slides\":[]}]'::jsonb,
  'sponsors', '[{\"id\":\"sp-1\",\"name\":\"Bergader\"},{\"id\":\"sp-2\",\"name\":\"Nicht auf der Folie\"}]'::jsonb) WHERE id = '$T_F2';"
check B "@VA-042 Olli uebernimmt Hallenmonitor aus F2: Name, Einstellungen ohne id/Zeitstempel, nur Sponsoren seiner Folien, Herkunft gemerkt" \
  "ok:true|Hallenmonitor|20|false|sp-1|$T_F2:mon-halle" \
  "$(tx "$SETUP_S $F2_MON $(who "$U_OLLI")
$(try "SELECT (public.adopt_tournament_monitor('$GS', '$T_F2', 'mon-halle') ->> 'key') ~ '^[0-9a-f]{32}\$'")
$(who super)
$(val "(SELECT name FROM public.gathering_screens WHERE adopted_monitor_id = 'mon-halle')")
$(val "(SELECT config ->> 'defaultSlideDuration' FROM public.gathering_screens WHERE adopted_monitor_id = 'mon-halle')")
$(val "(SELECT config ?| ARRAY['id', 'name', 'createdAt'] FROM public.gathering_screens WHERE adopted_monitor_id = 'mon-halle')")
$(val "(SELECT string_agg(sp ->> 'id', ',') FROM public.gathering_screens s, jsonb_array_elements(s.sponsors) sp WHERE adopted_monitor_id = 'mon-halle')")
$(val "(SELECT adopted_tournament_id || ':' || adopted_monitor_id FROM public.gathering_screens WHERE adopted_monitor_id = 'mon-halle')")")"
check B "@VA-042 zweites Uebernehmen desselben Monitors HF015; anderer Monitor geht" "ok:true|err:HF015|ok:true" \
  "$(tx "$SETUP_S $F2_MON $(who "$U_OLLI")
$(try "SELECT (public.adopt_tournament_monitor('$GS', '$T_F2', 'mon-halle') ->> 'id') IS NOT NULL")
$(try "SELECT public.adopt_tournament_monitor('$GS', '$T_F2', 'mon-halle')::text")
$(try "SELECT (public.adopt_tournament_monitor('$GS', '$T_F2', 'mon-eingang') ->> 'id') IS NOT NULL")")"
check B "Uebernehmen: unbekannter Monitor HF008, Gretas Turnier HF006, Papierkorb HF008, Maria HF006" \
  "err:HF008|err:HF006|err:HF008|err:HF006" \
  "$(tx "$SETUP_S $F2_MON $(who "$U_OLLI")
$(try "SELECT public.adopt_tournament_monitor('$GS', '$T_F2', 'mon-gibt-es-nicht')::text")
$(try "SELECT public.adopt_tournament_monitor('$GS', '$T_GRETA', 'mon-halle')::text")
$(try "SELECT public.adopt_tournament_monitor('$GS', '$T_TRASH', 'mon-halle')::text")
$(who "$U_MARIA") $(try "SELECT public.adopt_tournament_monitor('$GS', '$T_F2', 'mon-halle')::text")")"
check B "@VA-042 auch aus einem abgeschlossenen Turnier (E-Junioren) uebernehmbar" "ok:true" \
  "$(tx "$SETUP_S SET LOCAL app.lifecycle_write = 'on';
UPDATE public.tournaments SET config = config || '{\"monitors\":[{\"id\":\"mon-e\",\"name\":\"E-Monitor\",\"slides\":[]}]}'::jsonb WHERE id = '$T_E';
RESET app.lifecycle_write; $(who "$U_OLLI") $(try "SELECT (public.adopt_tournament_monitor('$GS', '$T_E', 'mon-e') ->> 'id') IS NOT NULL")")"
check B "@VA-042 Status von F2 nennt den uebernommenen Monitor (fuer den Hinweis in der App)" "ok:[\"mon-halle\"]" \
  "$(tx "$SETUP_S $F2_MON $(who "$U_OLLI") SELECT public.adopt_tournament_monitor('$GS', '$T_F2', 'mon-halle');
$(try "SELECT (public.gathering_screen_status('$T_F2') -> 'handed_over_monitor_ids')::text")")"
check B "@VA-042 bewusst nicht am Server: display_tournament fuer den uebernommenen Monitor antwortet wie vorher" \
  "$(cat "$WORK/vorher_f2_screen.json")" \
  "$(tx "$SETUP_S $(who "$U_OLLI") SELECT public.adopt_tournament_monitor('$GS', '$T_F2', 'mon-halle');
$(who anon) SELECT 'k:' || public.display_tournament('$T_F2', 'mon-halle')::text;" | norm_payload 2>/dev/null | jq -cS 'del(.tournament.gathering_code)' 2>/dev/null || echo fehler)"

# --- Ort (@VA-041) ------------------------------------------------------------------------------------------------
check B "@VA-041 Olli legt den Ort fest (ohne Raender); NULL erlaubt; Maria HF006; Steuerzeichen HF010" \
  "ok:|Halle Sued|ok:|NULL|err:HF006|err:HF010" \
  "$(tx "$SETUP_S $(who "$U_OLLI") $(try "SELECT public.set_gathering_screen_location('$GS', ' Halle Sued ')::text")
$(who super) $(val "(SELECT screen_location_name FROM public.gatherings WHERE id = '$GS')")
$(who "$U_OLLI") $(try "SELECT public.set_gathering_screen_location('$GS', NULL)::text")
$(who super) $(val "(SELECT screen_location_name FROM public.gatherings WHERE id = '$GS')")
$(who "$U_MARIA") $(try "SELECT public.set_gathering_screen_location('$GS', 'Maria')::text")
$(who "$U_OLLI") $(try "SELECT public.set_gathering_screen_location('$GS', 'Hal' || chr(8203) || 'le')::text")")"
