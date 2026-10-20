# shellcheck shell=bash
#
# rls-matrix.d/spur-a.sh — Zeilen der Spur A fuer scripts/rls-role-matrix.sh (A-11, brief-A-11.md R-A11-4).
# Per `source` eingebunden (nach _hilfen.sh: a11_mark, a11_probe, a11_denied_verdict, a11_allowed_verdict); nutzt
# die Variablen und Hilfen des Hauptskripts. Erwartungen aus rolePermissions.json bzw. dem Gherkin der Kennung.
#
# (i) has_tournament_permission fuer die fuenf MVP-Rechte x neun Identitaeten; (ii) Vollmatrix im Hauptskript;
# (iii) Szenario-Zeilen mit Kennung: Vorher-SELECT als dieselbe Identitaet (sichtbar -- "UPDATE 0" allein sagt nichts,
# Lehre A-10), Schreiben, Wertevergleich als Superuser; Gegenbeispiele (Maria, Olli) muessen gelingen.
# Testwerte aus dem Gherkin: „Hallencup Ost“ (= T_MAIN), es ist 15:05; Olli = Eigentuemer (U_OWNER), Maria = Co-Admin
# (U_COADMIN), Tom = Helfer (U_COLLAB), Mama Petra = ohne Konto (Rolle anon). Spiel 13 um 15:15.

A11_RIGHTS=(manageSchedule manageLifecycle manageScreens manageHelpers readDisplay)

# --- (i) has_tournament_permission fuer die fuenf MVP-Rechte x neun Identitaeten -----------------------------
A11_I_MISMATCHES=0
for id in "${MATRIX_IDS[@]}"; do
  role="$(role_for_id "$id")"
  uid="$(user_id_for_id "$id")"
  t_id="$T_MAIN"; [[ "$id" == "owner-anonymous" ]] && t_id="$T_ANON"
  for right in "${A11_RIGHTS[@]}"; do
    exp="$(perm_expected "$role" "$right")"
    set +e
    got="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$uid';
$(claims_line "$uid")
SELECT public.has_tournament_permission('$t_id', '$right');
ROLLBACK;
SQL
)"
    set -e
    case "$got" in t) got="true" ;; f) got="false" ;; *) got="fehler" ;; esac
    TOTAL=$((TOTAL + 1))
    if [[ "$got" != "$exp" ]]; then
      MISMATCHES=$((MISMATCHES + 1))
      A11_I_MISMATCHES=$((A11_I_MISMATCHES + 1))
      printf 'a11-recht %-20s %-16s: %s!=%s\n' "$id" "$right" "$got" "$exp"
    fi
  done
done
echo "a11-rechte: $((${#MATRIX_IDS[@]} * ${#A11_RIGHTS[@]})) Zellen geprueft (${#MATRIX_IDS[@]} Identitaeten x ${#A11_RIGHTS[@]} Rechte), $A11_I_MISMATCHES Abweichung(en)"

# --- (iii) Szenario-Zeilen ------------------------------------------------------------------------------------
# Fixture „Hallencup Ost“ (committet, als Superuser -- laeuft nach allen anderen Pruefungen des Hauptskripts):
# Teams SG Mitte, VfB Ufer, TSV West, DJK Berg; Spiele 11 (15:00 Feld 1), 13 (15:15 Feld 1, SG Mitte - VfB Ufer),
# 14 (15:15 Feld 2), 15 (15:30 Feld 1), 17 (15:45 Feld 1), 18 (15:45 Feld 2). Nicht-oeffentlicher Monitor
# „Hallenmonitor Feld 1“ in T_MAIN, oeffentlicher Monitor in T_PUBLIC.
A11_TEAM_SG="$(uuid_for a11-team:sg-mitte)"
A11_TEAM_VFB="$(uuid_for a11-team:vfb-ufer)"
A11_TEAM_TSV="$(uuid_for a11-team:tsv-west)"
A11_TEAM_DJK="$(uuid_for a11-team:djk-berg)"
A11_M11="$(uuid_for a11-match:11)"
A11_M13="$(uuid_for a11-match:13)"
A11_M14="$(uuid_for a11-match:14)"
A11_M15="$(uuid_for a11-match:15)"
A11_M17="$(uuid_for a11-match:17)"
A11_M18="$(uuid_for a11-match:18)"
A11_MONITOR_FELD1="$(uuid_for a11-monitor:feld-1)"
A11_MONITOR_PUBLIC="$(uuid_for a11-monitor:public)"

docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
BEGIN;
INSERT INTO public.teams (id, tournament_id, name) VALUES
  ('$A11_TEAM_SG', '$T_MAIN', 'SG Mitte'), ('$A11_TEAM_VFB', '$T_MAIN', 'VfB Ufer'),
  ('$A11_TEAM_TSV', '$T_MAIN', 'TSV West'), ('$A11_TEAM_DJK', '$T_MAIN', 'DJK Berg');
INSERT INTO public.matches (id, tournament_id, round, field, match_number, scheduled_start, team_a_id, team_b_id) VALUES
  ('$A11_M11', '$T_MAIN', 3, 1, 11, '15:00', '$A11_TEAM_TSV', '$A11_TEAM_DJK'),
  ('$A11_M13', '$T_MAIN', 4, 1, 13, '15:15', '$A11_TEAM_SG', '$A11_TEAM_VFB'),
  ('$A11_M14', '$T_MAIN', 4, 2, 14, '15:15', '$A11_TEAM_TSV', '$A11_TEAM_DJK'),
  ('$A11_M15', '$T_MAIN', 5, 1, 15, '15:30', '$A11_TEAM_SG', '$A11_TEAM_TSV'),
  ('$A11_M17', '$T_MAIN', 6, 1, 17, '15:45', '$A11_TEAM_TSV', '$A11_TEAM_VFB'),
  ('$A11_M18', '$T_MAIN', 6, 2, 18, '15:45', '$A11_TEAM_SG', '$A11_TEAM_DJK');
INSERT INTO public.monitors (id, tournament_id, name, type, config) VALUES
  ('$A11_MONITOR_FELD1', '$T_MAIN', 'Hallenmonitor Feld 1', 'slideshow', '{"slides":[{"type":"standings"}]}'::jsonb),
  ('$A11_MONITOR_PUBLIC', '$T_PUBLIC', 'Hallenmonitor Eingang', 'slideshow', '{"slides":[{"type":"schedule"}]}'::jsonb);
COMMIT;
SQL

A11_AB_1515="SELECT count(*) FROM public.matches WHERE tournament_id = '$T_MAIN' AND scheduled_start >= '15:15'"
A11_SHIFT="UPDATE public.matches SET scheduled_start = scheduled_start + interval '10 minutes' WHERE tournament_id = '$T_MAIN' AND scheduled_start >= '15:15';"
A11_ZEITEN="SELECT string_agg(match_number || '=' || to_char(scheduled_start, 'HH24:MI'), ',' ORDER BY match_number) FROM public.matches WHERE tournament_id = '$T_MAIN' AND match_number IS NOT NULL"
A11_ZEITEN_VORHER="11=15:00,13=15:15,14=15:15,15=15:30,17=15:45,18=15:45"
A11_SPIEL13="SELECT to_char(scheduled_start, 'HH24:MI') FROM public.matches WHERE id = '$A11_M13'"

# @ZP-041: Tom verschiebt „alle Felder ab 15:15 um 10 Minuten nach hinten“ direkt an der Schnittstelle.
r="$(a11_probe authenticated "$U_COLLAB" "$A11_AB_1515" "$A11_SHIFT" "$A11_ZEITEN")"
a11_mark "@ZP-041 tom-verschiebt-ab-1515-abgelehnt-uhrzeiten-gleich      " "$(a11_denied_verdict "$r" "$A11_ZEITEN_VORHER")" "abgelehnt"
# Gegenbeispiel: Maria (Co-Admin) dieselbe Anfrage -> 5 Spiele ab 15:15 um 10 Minuten, Spiel 13 um 15:25.
r="$(a11_probe authenticated "$U_COADMIN" "$A11_AB_1515" "$A11_SHIFT" "$A11_SPIEL13")"
a11_mark "@ZP-041 gegen-maria-verschiebt-spiel-13-auf-1525               " "$(a11_allowed_verdict "$r" 5 "15:25")" "gelingt"
r="$(a11_probe authenticated "$U_OWNER" "$A11_AB_1515" "$A11_SHIFT" "$A11_SPIEL13")"
a11_mark "@ZP-040 gegen-olli-verschiebt-spiel-13-auf-1525                " "$(a11_allowed_verdict "$r" 5 "15:25")" "gelingt"

# @ZP-084 Toms Konto: Spiel 15 und Spiel 17 tauschen (zwei UPDATEs der Spielplan-Spalten).
A11_SWAP="UPDATE public.matches SET scheduled_start = '15:45', slot = 6 WHERE id = '$A11_M15'; UPDATE public.matches SET scheduled_start = '15:30', slot = 5 WHERE id = '$A11_M17';"
r="$(a11_probe authenticated "$U_COLLAB" "SELECT count(*) FROM public.matches WHERE id IN ('$A11_M15', '$A11_M17')" "$A11_SWAP" "$A11_ZEITEN")"
a11_mark "@ZP-084 tom-tauscht-spiel-15-und-17-abgelehnt                  " "$(a11_denied_verdict "$r" "$A11_ZEITEN_VORHER")" "abgelehnt"
r="$(a11_probe authenticated "$U_OWNER" "SELECT count(*) FROM public.matches WHERE id IN ('$A11_M15', '$A11_M17')" "$A11_SWAP" "SELECT to_char(scheduled_start, 'HH24:MI') FROM public.matches WHERE id = '$A11_M15'")"
a11_mark "@ZP-084 gegen-olli-tauscht-spiel-15-und-17                     " "$(a11_allowed_verdict "$r" 2 "15:45")" "gelingt"
# @ZP-084 Toms Konto: Uhrzeit eines Spiels zuruecksetzen (Wiederherstellen ist ein UPDATE derselben Spalte).
r="$(a11_probe authenticated "$U_COLLAB" "SELECT count(*) FROM public.matches WHERE id = '$A11_M18'" "UPDATE public.matches SET scheduled_start = '15:50' WHERE id = '$A11_M18';" "$A11_ZEITEN")"
a11_mark "@ZP-084 tom-setzt-uhrzeit-spiel-18-abgelehnt                   " "$(a11_denied_verdict "$r" "$A11_ZEITEN_VORHER")" "abgelehnt"
# @ZP-084 Toms Konto: Pause/Termin liegen heute im Turnier (tournaments.config) -> tournaments-UPDATE (tournamentSettings).
r="$(a11_probe authenticated "$U_COLLAB" "SELECT count(*) FROM public.tournaments WHERE id = '$T_MAIN'" \
  "UPDATE public.tournaments SET config = config || '{\"scheduleBreaks\":[{\"start\":\"15:30\",\"minutes\":10}]}'::jsonb WHERE id = '$T_MAIN';" \
  "SELECT coalesce(config->>'scheduleBreaks', 'keine') FROM public.tournaments WHERE id = '$T_MAIN'")"
a11_mark "@ZP-084 tom-fuegt-pause-im-turnier-ein-abgelehnt               " "$(a11_denied_verdict "$r" "keine")" "abgelehnt"
# @ZP-084 Mama Petras Zuschauer-Seite (ohne Konto, Rolle anon) verschiebt ab 15:15 -> abgelehnt. Sichtbar: anon liest
# das oeffentliche Turnier; T_MAIN ist nicht oeffentlich, deshalb dieselbe Anfrage gegen T_PUBLIC (oeffentlich).
r="$(a11_probe anon "" "SELECT count(*) FROM public.matches WHERE tournament_id = '$T_PUBLIC'" \
  "UPDATE public.matches SET scheduled_start = coalesce(scheduled_start, '15:15') + interval '10 minutes' WHERE tournament_id = '$T_PUBLIC';" \
  "SELECT coalesce(to_char(scheduled_start, 'HH24:MI'), 'leer') FROM public.matches WHERE id = '$M_PUBLIC'")"
a11_mark "@ZP-084 mama-petra-anon-verschiebt-abgelehnt                   " "$(a11_denied_verdict "$r" "leer")" "abgelehnt"
# Gegenbeispiel: oeffentliches Lesen des Spielplans als anon geht weiter (Bestand).
r="$(a11_probe anon "" "SELECT count(*) FROM public.matches WHERE tournament_id = '$T_PUBLIC'" "SELECT 1;" "SELECT 'ok'")"
a11_mark "@ZP-084 gegen-mama-petra-liest-oeffentlichen-spielplan         " "$(cut -d'|' -f1 <<<"$r")" "1"

# @LZ-023: Tom schickt den Abschluss-Patch (wie buildFinishTournamentPatch: config.manuallyCompleted/dashboardStatus,
# completed_at) direkt an die Schnittstelle -> abgelehnt, Turnier weiter „Läuft“.
A11_FINISH="UPDATE public.tournaments SET config = config || '{\"manuallyCompleted\":true,\"dashboardStatus\":\"finished\"}'::jsonb, completed_at = now() WHERE id = '$T_MAIN';"
A11_FINISH_STATE="SELECT coalesce(config->>'manuallyCompleted', 'laeuft') FROM public.tournaments WHERE id = '$T_MAIN'"
r="$(a11_probe authenticated "$U_COLLAB" "SELECT count(*) FROM public.tournaments WHERE id = '$T_MAIN'" "$A11_FINISH" "$A11_FINISH_STATE")"
a11_mark "@LZ-023 tom-schliesst-turnier-ab-abgelehnt                     " "$(a11_denied_verdict "$r" "laeuft")" "abgelehnt"
r="$(a11_probe authenticated "$U_COLLAB" "SELECT count(*) FROM public.tournaments WHERE id = '$T_MAIN'" \
  "UPDATE public.tournaments SET config = config || '{\"dashboardStatus\":\"cancelled\"}'::jsonb WHERE id = '$T_MAIN';" \
  "SELECT coalesce(config->>'dashboardStatus', 'laeuft') FROM public.tournaments WHERE id = '$T_MAIN'")"
a11_mark "@LZ-023 tom-bricht-turnier-ab-abgelehnt                        " "$(a11_denied_verdict "$r" "laeuft")" "abgelehnt"
# „Abgeschlossen“ -> „wieder öffnen“: Vorbereitung als Superuser (abgeschlossen), Tom setzt manuallyCompleted zurueck.
r="$(a11_probe authenticated "$U_COLLAB" "SELECT count(*) FROM public.tournaments WHERE id = '$T_MAIN'" \
  "UPDATE public.tournaments SET config = config || '{\"manuallyCompleted\":false}'::jsonb, completed_at = NULL WHERE id = '$T_MAIN';" \
  "$A11_FINISH_STATE" "$A11_FINISH")"
a11_mark "@LZ-023 tom-oeffnet-abgeschlossenes-turnier-abgelehnt          " "$(a11_denied_verdict "$r" "true")" "abgelehnt"
r="$(a11_probe authenticated "$U_COADMIN" "SELECT count(*) FROM public.tournaments WHERE id = '$T_MAIN'" "$A11_FINISH" "$A11_FINISH_STATE")"
a11_mark "@LZ-023 gegen-maria-schliesst-turnier-ab                       " "$(a11_allowed_verdict "$r" 1 "true")" "gelingt"

# @TM-084: Gruppen-Abschluss hat heute kein Server-Feld (complete_group kommt mit A-13). Regression „Helfer aendert
# tournaments nicht“: Tom setzt einen Gruppen-Abschluss-Vermerk im Turnier -> abgelehnt, Gruppe A nicht abgeschlossen.
r="$(a11_probe authenticated "$U_COLLAB" "SELECT count(*) FROM public.tournaments WHERE id = '$T_MAIN'" \
  "UPDATE public.tournaments SET config = config || '{\"completedGroups\":[\"A\"]}'::jsonb WHERE id = '$T_MAIN';" \
  "SELECT coalesce(config->>'completedGroups', 'offen') FROM public.tournaments WHERE id = '$T_MAIN'")"
a11_mark "@TM-084 tom-schliesst-gruppe-a-ab-abgelehnt                    " "$(a11_denied_verdict "$r" "offen")" "abgelehnt"

# @HE-042 „ein Team umbenennen -> nur Turnierleitung“: Tom benennt SG Mitte um -> abgelehnt, Name gleich.
A11_RENAME="UPDATE public.teams SET name = 'SG Mitte 2' WHERE id = '$A11_TEAM_SG';"
A11_TEAMNAME="SELECT name FROM public.teams WHERE id = '$A11_TEAM_SG'"
r="$(a11_probe authenticated "$U_COLLAB" "SELECT count(*) FROM public.teams WHERE id = '$A11_TEAM_SG'" "$A11_RENAME" "$A11_TEAMNAME")"
a11_mark "@HE-042 tom-benennt-sg-mitte-um-abgelehnt                      " "$(a11_denied_verdict "$r" "SG Mitte")" "abgelehnt"
r="$(a11_probe authenticated "$U_COADMIN" "SELECT count(*) FROM public.teams WHERE id = '$A11_TEAM_SG'" "$A11_RENAME" "$A11_TEAMNAME")"
a11_mark "@HE-042 gegen-maria-benennt-sg-mitte-um                        " "$(a11_allowed_verdict "$r" 1 "SG Mitte 2")" "gelingt"
# @HE-042 „Turniereinstellungen ändern -> nur Turnierleitung“ (Regression tournaments_update_v3).
r="$(a11_probe authenticated "$U_COLLAB" "SELECT count(*) FROM public.tournaments WHERE id = '$T_MAIN'" \
  "UPDATE public.tournaments SET location_name = 'Halle Ost' WHERE id = '$T_MAIN';" \
  "SELECT coalesce(location_name, 'leer') FROM public.tournaments WHERE id = '$T_MAIN'")"
a11_mark "@HE-042 tom-aendert-turniereinstellungen-abgelehnt             " "$(a11_denied_verdict "$r" "leer")" "abgelehnt"
# Gegenbeispiel: Tom traegt weiter Tore ein (append_match_events, writeMatchData bleibt): MATCH_START + GOAL auf Spiel 13.
A11_EVENTS="[{\"id\":\"$(uuid_for a11-event:start)\",\"type\":\"MATCH_START\",\"at\":1000,\"section\":1,\"clockMs\":0,\"payload\":{}},{\"id\":\"$(uuid_for a11-event:goal)\",\"type\":\"GOAL\",\"at\":2000,\"section\":1,\"clockMs\":1000,\"payload\":{},\"teamId\":\"$A11_TEAM_SG\"}]"
# Ausgewertet wird die Antwort der RPC (je Ereignis "accepted"); die Transaktion wird nie committet.
set +e
a11_append_out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$U_COLLAB';
SELECT string_agg(e ->> 'status', ',') FROM jsonb_array_elements(public.append_match_events('$A11_M13', '$A11_EVENTS'::jsonb, 1, NULL) -> 'results') AS e;
ROLLBACK;
SQL
)"
set -e
a11_mark "@HE-042 gegen-tom-traegt-weiter-tor-ein-append-match-events    " "$a11_append_out" "accepted,accepted"

# @ZM-019 „das Folienprogramm des Hallenmonitor Feld 1 ändern“ (monitors.config).
A11_SLIDES="UPDATE public.monitors SET config = '{\"slides\":[{\"type\":\"live\"},{\"type\":\"standings\"}]}'::jsonb WHERE id = '$A11_MONITOR_FELD1';"
A11_SLIDES_NOW="SELECT jsonb_array_length(config->'slides') FROM public.monitors WHERE id = '$A11_MONITOR_FELD1'"
A11_FELD1_VISIBLE="SELECT count(*) FROM public.monitors WHERE id = '$A11_MONITOR_FELD1'"
r="$(a11_probe authenticated "$U_COADMIN" "$A11_FELD1_VISIBLE" "$A11_SLIDES" "$A11_SLIDES_NOW")"
a11_mark "@ZM-019 maria-aendert-folienprogramm-feld-1                    " "$(a11_allowed_verdict "$r" 1 "2")" "gelingt"
r="$(a11_probe authenticated "$U_OWNER" "$A11_FELD1_VISIBLE" "$A11_SLIDES" "$A11_SLIDES_NOW")"
a11_mark "@ZM-019 gegen-olli-aendert-folienprogramm-feld-1               " "$(a11_allowed_verdict "$r" 1 "2")" "gelingt"
# Tom: der Monitor ist fuer ihn nicht lesbar (nicht oeffentlich, kein manageScreens) -- "sichtbar" ist hier 0, deshalb
# zaehlt die Ablehnung nur ueber Zeilen und Wert (eigene Auswertung statt a11_denied_verdict).
r="$(a11_probe authenticated "$U_COLLAB" "$A11_FELD1_VISIBLE" "$A11_SLIDES" "$A11_SLIDES_NOW")"
IFS='|' read -r _a11_vis a11_rows a11_val <<<"$r"
a11_mark "@ZM-019 tom-aendert-folienprogramm-feld-1-abgelehnt            " "zeilen=$a11_rows,folien=$a11_val" "zeilen=0,folien=1"
# Folienprogramm im Turnier (heutiger App-Weg: tournaments.config.monitors) -- Tom abgelehnt, Maria gelingt.
A11_CFG_MON="UPDATE public.tournaments SET config = config || '{\"monitors\":[{\"id\":\"feld-1\",\"name\":\"Hallenmonitor Feld 1\",\"slides\":[]}]}'::jsonb WHERE id = '$T_MAIN';"
A11_CFG_MON_NOW="SELECT coalesce(config->'monitors'->0->>'name', 'keiner') FROM public.tournaments WHERE id = '$T_MAIN'"
r="$(a11_probe authenticated "$U_COLLAB" "SELECT count(*) FROM public.tournaments WHERE id = '$T_MAIN'" "$A11_CFG_MON" "$A11_CFG_MON_NOW")"
a11_mark "@ZM-019 tom-aendert-folienprogramm-im-turnier-abgelehnt        " "$(a11_denied_verdict "$r" "keiner")" "abgelehnt"
r="$(a11_probe authenticated "$U_COADMIN" "SELECT count(*) FROM public.tournaments WHERE id = '$T_MAIN'" "$A11_CFG_MON" "$A11_CFG_MON_NOW")"
a11_mark "@ZM-019 gegen-maria-aendert-folienprogramm-im-turnier          " "$(a11_allowed_verdict "$r" 1 "Hallenmonitor Feld 1")" "gelingt"
# Mama Petra (anon): nicht-oeffentlicher Monitor nicht lesbar, oeffentlicher lesbar (Monitor-Anzeige ohne Konto).
r="$(a11_probe anon "" "$A11_FELD1_VISIBLE" "SELECT 1;" "SELECT 'ok'")"
a11_mark "@ZM-019 mama-petra-liest-nicht-oeffentlichen-monitor-nicht     " "$(cut -d'|' -f1 <<<"$r")" "0"
r="$(a11_probe anon "" "SELECT count(*) FROM public.monitors WHERE id = '$A11_MONITOR_PUBLIC'" "SELECT 1;" "SELECT 'ok'")"
a11_mark "@ZM-019 gegen-mama-petra-liest-oeffentlichen-monitor           " "$(cut -d'|' -f1 <<<"$r")" "1"
# Maria liest den nicht-oeffentlichen Monitor (Editor der Co-Admin, monitors_select_v4).
r="$(a11_probe authenticated "$U_COADMIN" "$A11_FELD1_VISIBLE" "SELECT 1;" "SELECT 'ok'")"
a11_mark "@ZM-019 maria-liest-nicht-oeffentlichen-monitor                " "$(cut -d'|' -f1 <<<"$r")" "1"
