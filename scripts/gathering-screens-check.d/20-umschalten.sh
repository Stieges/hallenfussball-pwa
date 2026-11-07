# shellcheck shell=bash
#
# gathering-screens-check.d/20-umschalten.sh — Kategorie U: „Auf die Bildschirme“ / „Von den Bildschirmen nehmen“, Rechte,
# letzter Tipp gilt, Zulaessigkeit und Ort, Waechter-Trigger, Status fuer Cockpit und Uebersicht der Verwaltung
# (@VA-035 bis @VA-041). Nie festgeschriebene Transaktionen, ausser dem Wettlauf (zwei echte Sitzungen, danach aufgeraeumt).

show() { echo "public.set_gathering_on_screen('$1', ${2:-true})"; }
onscreen() { echo "$(who super) $(val "(SELECT coalesce(on_screen_tournament_id::text, 'NULL') FROM public.gatherings WHERE id = '$GS')")"; }

check U "@VA-035 Olli tippt bei F1 „Auf die Bildschirme“: Antwort nennt F1 mit Titel, F1 steht in der Halle, seit jetzt (ohne Anpfiff)" \
  "ok:$T_F1|F1-Junioren Hallenturnier|$T_F1|true" \
  "$(tx "$SETUP_S $(on_sql "$T_F2") UPDATE public.gatherings SET on_screen_since = now() - interval '1 hour' WHERE id = '$GS';
$(who "$U_OLLI") $(try "SELECT $(show "$T_F1") -> 'on_screen' ->> 'tournament_id'")
$(val "($(show "$T_F1") -> 'on_screen' ->> 'title')")
$(onscreen)
$(val "(SELECT on_screen_since > now() - interval '1 minute' FROM public.gatherings WHERE id = '$GS')")")"
check U "dasselbe Turnier noch einmal: keine Aenderung, kein neuer Zeitpunkt" "t|t" \
  "$(tx "$SETUP_S $(on_sql "$T_F1") SET LOCAL session_replication_role = replica;
UPDATE public.gatherings SET on_screen_since = now() - interval '1 hour', updated_at = now() - interval '1 hour' WHERE id = '$GS';
SET LOCAL session_replication_role = origin;
$(who "$U_OLLI") SELECT $(show "$T_F1");
$(who super) $(val "(SELECT on_screen_since < now() - interval '59 minutes' FROM public.gatherings WHERE id = '$GS')")
$(val "(SELECT updated_at < now() - interval '59 minutes' FROM public.gatherings WHERE id = '$GS')")" | sed 's/true/t/g')"

# --- @VA-037 Wer darf ------------------------------------------------------------------------------------------------
check U "@VA-037 Z. 2 Maria als Co-Admin von F1 tippt: gelingt" "ok:$T_F1|$T_F1" \
  "$(tx "$SETUP_S $(coadmin_sql "$U_MARIA" "$T_F1") $(who "$U_MARIA") $(try "SELECT $(show "$T_F1") -> 'on_screen' ->> 'tournament_id'") $(onscreen)")"
COLLAB="$(who super) INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at) VALUES ('$T_F2', '$U_CLARA', 'collaborator', now());"
for row in "$U_TOM|Tom als Helfer-Geraet von F2|HF006" "$U_CLARA|Clara als Helferin mit Konto in F2|HF006" \
           "$U_SCREEN|Bildschirm-Rolle in F2|HF006" "$U_GRETA|Greta ohne Rolle|HF006" "$U_ANJA|Anja anonyme Sitzung|HF006" \
           "anon|anon ohne Sitzung|42501"; do
  IFS='|' read -r w label code <<<"$row"
  check U "@VA-037 $label: geht nicht ($code), F1 bleibt in der Halle" "err:$code|$T_F1" \
    "$(tx "$SETUP_S $COLLAB $(on_sql "$T_F1") $(who "$w") $(try "SELECT $(show "$T_F2")::text") $(onscreen)")"
done
check U "@VA-037 Maria ist Co-Admin von F2, nicht von F1: bei F1 geht nicht (HF006), auch nicht herunternehmen" "err:HF006|err:HF006|$T_F2" \
  "$(tx "$SETUP_S $(on_sql "$T_F2") $(who "$U_MARIA") $(try "SELECT $(show "$T_F1")::text") $(try "SELECT $(show "$T_F1" false)::text") $(onscreen)")"
check U "unbekanntes Turnier HF008, Turnier im Papierkorb HF008, p_on fehlt 22023" "err:HF008|err:HF008|err:22023" \
  "$(tx "$SETUP_S $(who "$U_OLLI") $(try "SELECT $(show "$GS2")::text") $(try "SELECT $(show "$T_TRASH")::text")
$(try "SELECT $(show "$T_F1" NULL)::text")")"

# --- @VA-036 was geht --------------------------------------------------------------------------------------------------
check U "@VA-036 Z. 1 bei D tippen, waehrend F1 steht: D" "$T_D" \
  "$(tx "$SETUP_S $(on_sql "$T_F1") $(who "$U_OLLI") SELECT $(show "$T_D"); $(onscreen)")"
check U "@VA-036 Z. 2 „Von den Bildschirmen nehmen“ bei F1: nichts in der Halle, Antwort on_screen null" "ok:null|NULL" \
  "$(tx "$SETUP_S $(on_sql "$T_F1") $(who "$U_OLLI") $(try "SELECT ($(show "$T_F1" false) -> 'on_screen')::text") $(onscreen)")"
check U "@VA-036 Z. 3 Entwurf: HF012 (Grund draft), F1 bleibt" "err:HF012|draft|$T_F1" \
  "$(tx "$SETUP_S $(on_sql "$T_F1") $(who "$U_OLLI") $(try "SELECT $(show "$T_DRAFT")::text")
$(who super) $(val "public.gathering_screen_reason('$GS', '$T_DRAFT')") $(onscreen)")"
check U "abgebrochen (MVP+): HF012 (Grund cancelled)" "err:HF012|cancelled" \
  "$(tx "$SETUP_S SET LOCAL app.lifecycle_write = 'on'; UPDATE public.tournaments SET lifecycle_status = 'cancelled' WHERE id = '$T_F2'; RESET app.lifecycle_write;
$(who "$U_OLLI") $(try "SELECT $(show "$T_F2")::text") $(who super) $(val "public.gathering_screen_reason('$GS', '$T_F2')")")"
check U "@VA-036 Z. 4 beim abgeschlossenen E tippen: E steht wieder in der Halle" "$T_E" \
  "$(tx "$SETUP_S $(on_sql "$T_F1") $(who "$U_OLLI") SELECT $(show "$T_E"); $(onscreen)")"
check U "@VA-036 Z. 5 nicht online geteiltes D: gelingt" "ok:$T_D" \
  "$(tx "$SETUP_S $(who "$U_OLLI") $(try "SELECT $(show "$T_D") -> 'on_screen' ->> 'tournament_id'")")"

# --- @VA-041 nur Turniere der Veranstaltung an ihrem Ort ---------------------------------------------------------------
check U "@VA-041 Wintercup ohne Veranstaltung: HF012 not_in_gathering; andere Halle: HF012 other_location" \
  "err:HF012|not_in_gathering|err:HF012|other_location" \
  "$(tx "$SETUP_S $(who "$U_OLLI") $(try "SELECT $(show "$T_OHNE")::text")
$(who super) $(val "public.gathering_screen_reason('$GS', '$T_OHNE')")
$(who "$U_OLLI") $(try "SELECT $(show "$T_LOC")::text")
$(who super) $(val "public.gathering_screen_reason('$GS', '$T_LOC')")")"
check U "@VA-041 Ort nur anders geschrieben (Gross/Klein, Raender, doppelte Leerzeichen): zulaessig" "ok:$T_F1" \
  "$(tx "$SETUP_S UPDATE public.tournaments SET location_name = '  bergader   SPORTARENA ' WHERE id = '$T_F1';
$(who "$U_OLLI") $(try "SELECT $(show "$T_F1") -> 'on_screen' ->> 'tournament_id'")")"
check U "ohne Ort der Veranstaltung: HF012 no_location; Turnier ohne Ort: other_location; ohne Bildschirme: no_screens" \
  "no_location|other_location|no_screens" \
  "$(tx "$SETUP_S UPDATE public.gatherings SET screen_location_name = NULL WHERE id = '$GS';
$(val "public.gathering_screen_reason('$GS', '$T_F1')")
UPDATE public.gatherings SET screen_location_name = '$ORT' WHERE id = '$GS';
UPDATE public.tournaments SET location_name = NULL WHERE id = '$T_F1';
$(val "public.gathering_screen_reason('$GS', '$T_F1')")
DELETE FROM public.gathering_screens WHERE gathering_id = '$GS';
$(val "public.gathering_screen_reason('$GS', '$T_F2')")")"

# --- @VA-038 letzter Tipp gilt -------------------------------------------------------------------------------------------
check U "@VA-038 Olli bei F1, Maria danach bei D: D; Marias und Ollis Sicht nennen D" "D-Junioren Hallenturnier|D-Junioren Hallenturnier|$T_D" \
  "$(tx "$SETUP_S $(coadmin_sql "$U_MARIA" "$T_D") $(on_sql "$T_F2") $(who "$U_OLLI") SELECT $(show "$T_F1");
$(who "$U_MARIA") $(val "($(show "$T_D") -> 'on_screen' ->> 'title')")
$(who "$U_OLLI") $(val "(public.gathering_screen_status('$T_F2') -> 'on_screen' ->> 'title')") $(onscreen)")"
check U "„Von den Bildschirmen nehmen“ fuer F1, waehrend schon D steht: D bleibt (kein Fehler)" "ok:D-Junioren Hallenturnier|$T_D" \
  "$(tx "$SETUP_S $(on_sql "$T_D") $(who "$U_OLLI") $(try "SELECT $(show "$T_F1" false) -> 'on_screen' ->> 'title'") $(onscreen)")"
# Wettlauf mit zwei echten Sitzungen: Sitzung 1 tippt F1 und haelt die Sperre 2 s, Sitzung 2 tippt D und wartet.
RACE_SQL1="BEGIN; $(who "$U_OLLI") SELECT $(show "$T_F1"); SELECT pg_sleep(2); COMMIT;"
RACE_SQL2="BEGIN; $(who "$U_OLLI") SELECT $(show "$T_D"); COMMIT;"
if q "SELECT to_regclass('public.gathering_screens') IS NOT NULL;" | grep -qx t; then
  psql_stdin <<<"$(sed 's/SET LOCAL/SET/g' <<<"$SETUP_S") RESET ROLE;" >/dev/null 2>&1 || true
  ( q "$RACE_SQL1" >/dev/null ) &
  race_pid=$!
  sleep 0.5
  q "$RACE_SQL2" >/dev/null
  wait "$race_pid" || true
  check U "@VA-038 zwei Sitzungen fast gleichzeitig (F1 haelt die Sperre, D wartet): D gilt, keine Sitzung scheitert" "$T_D" \
    "$(q "SELECT coalesce(on_screen_tournament_id::text, 'NULL') FROM public.gatherings WHERE id = '$GS';")"
  psql_stdin <<<"DELETE FROM public.gatherings WHERE id = '$GS'; UPDATE public.tournaments SET gathering_id = NULL WHERE gathering_id IS NOT NULL;" >/dev/null 2>&1 || true
else
  check U "@VA-038 Wettlauf (Tabelle gathering_screens fehlt)" "vorhanden" "fehlt"
fi

# --- Waechter: das Turnier in der Halle kommt nie still zurueck ----------------------------------------------------------
for ev in "UPDATE public.tournaments SET gathering_id = NULL WHERE id = '$T_F1'|aus der Veranstaltung geloest" \
          "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_F1'|in den Papierkorb" \
          "UPDATE public.tournaments SET status = 'draft' WHERE id = '$T_F1'|zurueck auf Entwurf (ohne Anpfiff)" \
          "UPDATE public.tournaments SET location_name = 'Halle Nord' WHERE id = '$T_F1'|an einen anderen Ort" \
          "DELETE FROM public.tournaments WHERE id = '$T_F1'|endgueltig geloescht"; do
  check U "Waechter: F1 ${ev#*|} -> nichts mehr in der Halle" "NULL" \
    "$(tx "$SETUP_S $(on_sql "$T_F1") $(who super) ${ev%%|*}; $(onscreen)")"
done
check U "Waechter: zurueck aus dem Papierkorb bzw. wieder zugeordnet -> F1 kommt nicht von selbst zurueck" "NULL|NULL" \
  "$(tx "$SETUP_S $(on_sql "$T_F1") UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_F1';
UPDATE public.tournaments SET deleted_at = NULL WHERE id = '$T_F1'; $(onscreen)
UPDATE public.tournaments SET gathering_id = NULL WHERE id = '$T_F1'; UPDATE public.tournaments SET gathering_id = '$GS' WHERE id = '$T_F1'; $(onscreen)")"
check U "Waechter: nur anders geschriebener Ort, Speichern ohne Aenderung -> F1 bleibt" "$T_F1|$T_F1" \
  "$(tx "$SETUP_S $(on_sql "$T_F1") UPDATE public.tournaments SET location_name = 'BERGADER  SportARENA' WHERE id = '$T_F1'; $(onscreen)
UPDATE public.tournaments SET title = title, location_name = location_name WHERE id = '$T_F1'; $(onscreen)")"
check U "@VA-041 Olli aendert den Ort der Veranstaltung: F1 an der alten Halle steht nicht mehr dort" "NULL" \
  "$(tx "$SETUP_S $(on_sql "$T_F1") $(who "$U_OLLI") SELECT public.set_gathering_screen_location('$GS', 'Halle Nord'); $(onscreen)")"

# --- Status (@VA-039, @VA-040) und Uebersicht (@VA-040) ------------------------------------------------------------------
check U "@VA-039 Status fuer Clara (nur Co-Admin von F1), F2 in der Halle: zulaessig, nicht selbst, anderes Turnier ohne Titel" \
  "true|true|true|false|{\"other\": true}" \
  "$(tx "$SETUP_S $(coadmin_sql "$U_CLARA" "$T_F1") $(on_sql "$T_F2")
$(who "$U_CLARA") SELECT 'k:' || concat_ws('|', s ->> 'in_gathering', s ->> 'has_screens', s ->> 'eligible', s ->> 'on_screen_self', (s -> 'on_screen') - 'since') FROM (SELECT public.gathering_screen_status('$T_F1') AS s) x;")"
check U "Status fuer Olli: F2 selbst in der Halle, mit Titel; Turnier ohne Veranstaltung: nicht zulaessig, Grund" \
  "true|F2-Junioren Hallenturnier|false|false|not_in_gathering" \
  "$(tx "$SETUP_S $(on_sql "$T_F2") $(who "$U_OLLI")
SELECT 'k:' || concat_ws('|', s ->> 'on_screen_self', s -> 'on_screen' ->> 'title') FROM (SELECT public.gathering_screen_status('$T_F2') AS s) x;
SELECT 'k:' || concat_ws('|', s ->> 'in_gathering', s ->> 'eligible', s ->> 'reason') FROM (SELECT public.gathering_screen_status('$T_OHNE') AS s) x;")"
check U "@VA-040 Tom (Helfer) und Clara bekommen keinen Status (HF006) -> keine Rueckfrage beim Helfer" "err:HF006|err:HF006" \
  "$(tx "$SETUP_S $(who "$U_TOM") $(try "SELECT public.gathering_screen_status('$T_F2')::text") $(who "$U_CLARA") $(try "SELECT public.gathering_screen_status('$T_F2')::text")")"
OV="public.gathering_screens_overview('$GS')"
check U "@VA-040 Uebersicht fuer Olli: Ort, F2 in der Halle, F1 laeuft (angepfiffen), Schluessel des Bildschirms, Zulaessigkeit je Turnier" \
  "$ORT|$T_F2|live|$KEY_HALLE|Halle|true|false:draft|false:other_location" \
  "$(tx "$SETUP_S $(on_sql "$T_F2") $(who super) SET LOCAL session_replication_role = replica;
UPDATE public.matches SET tournament_id = '$T_F1' WHERE id = '$M_F2_3'; UPDATE public.matches SET match_status = 'running' WHERE id = '$M_F2_3';
SET LOCAL session_replication_role = origin;
$(who "$U_OLLI") SELECT 'k:' || concat_ws('|', o ->> 'screen_location_name', o -> 'on_screen' ->> 'tournament_id',
  (SELECT t ->> 'state' FROM jsonb_array_elements(o -> 'tournaments') t WHERE t ->> 'id' = '$T_F1'),
  o -> 'screens' -> 0 ->> 'key', o -> 'screens' -> 0 ->> 'name',
  (SELECT t ->> 'eligible' FROM jsonb_array_elements(o -> 'tournaments') t WHERE t ->> 'id' = '$T_E'),
  (SELECT (t ->> 'eligible') || ':' || (t ->> 'reason') FROM jsonb_array_elements(o -> 'tournaments') t WHERE t ->> 'id' = '$T_DRAFT'),
  (SELECT (t ->> 'eligible') || ':' || (t ->> 'reason') FROM jsonb_array_elements(o -> 'tournaments') t WHERE t ->> 'id' = '$T_LOC'))
  FROM (SELECT $OV AS o) x;")"
check U "Uebersicht: Maria HF006, Clara HF006, anon 42501, unbekannte Veranstaltung HF008" "err:HF006|err:HF006|err:42501|err:HF008" \
  "$(tx "$SETUP_S $(who "$U_MARIA") $(try "SELECT $OV::text") $(who "$U_CLARA") $(try "SELECT $OV::text")
$(who anon) $(try "SELECT $OV::text") $(who "$U_OLLI") $(try "SELECT public.gathering_screens_overview('$GS2')::text")")"
