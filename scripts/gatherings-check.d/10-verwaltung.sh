# shellcheck shell=bash
#
# gatherings-check.d/10-verwaltung.sh — Kategorien V (Verwaltung) und Z (Zuordnung). Jede Zeile eine nie
# festgeschriebene Transaktion (tx), ausser dem Wettlauf (zwei echte Sitzungen, danach aufgeraeumt).

G1="$(uuid_for gathering:olli)"; G2="$(uuid_for gathering:olli-zweite)"; G_GRETA="$(uuid_for gathering:greta)"
G_ANJA="$(uuid_for gathering:anja)"; GR1="$(uuid_for gathering:wettlauf-1)"; GR2="$(uuid_for gathering:wettlauf-2)"
SETUP_G="$(who super)
INSERT INTO public.gatherings (id, owner_id, name, share_code)
VALUES ('$G1', '$U_OLLI', '$G_NAME', 'WAGING'), ('$G2', '$U_OLLI', 'Sommerturniere', 'WAGIN2'),
       ('$G_GRETA', '$U_GRETA', 'Gretas Wochenende', 'GRETAV'), ('$G_ANJA', '$U_ANJA', 'Anjas Probe', 'ANJAVA');"
assign() { echo "$(who super) UPDATE public.tournaments SET gathering_id = '$1' WHERE id IN ($2);"; }
setg() { echo "public.set_gathering_tournaments('$1', $2, $3)::text"; }
ids() { local s="" i; for i in "$@"; do s="$s,'$i'"; done; echo "ARRAY[${s#,}]::uuid[]"; }
NOIDS="'{}'::uuid[]"

# --- V: anlegen (@VA-015 Z. 1) ---------------------------------------------------------------------------------------
check V "@VA-015 Z. 1 Olli legt die Veranstaltung ${G_NAME} an: Name ohne Raender, Code ^[A-Z0-9]{6}\$, Olli Eigentuemer" "ok:true|true" \
  "$(tx "$(who "$U_OLLI")
$(try "SELECT (public.create_gathering('  $G_NAME  ') ->> 'share_code') ~ '^[A-Z0-9]{6}\$'")
$(who super)
$(val "(SELECT bool_and(name = '$G_NAME' AND share_code_created_at IS NOT NULL) AND count(*) = 1 FROM public.gatherings WHERE owner_id = '$U_OLLI')")")"
check V "anonyme Sitzung (Anja) legt keine Veranstaltung an (HF006)" "err:HF006" \
  "$(tx "$(who "$U_ANJA") $(try "SELECT public.create_gathering('Anjas Wochenende')::text")")"
check V "anon ohne Sitzung darf create_gathering nicht ausfuehren (42501)" "err:42501" \
  "$(tx "$(who anon) $(try "SELECT public.create_gathering('Petras Wochenende')::text")")"
for bad in "''" "'   '" "repeat('x', 81)" "'TSV' || chr(7) || 'Waging'" "'TSV' || chr(8203) || 'Waging'"; do
  check V "Name $bad -> HF010" "err:HF010" "$(tx "$(who "$U_OLLI") $(try "SELECT public.create_gathering($bad)::text")")"
done
check V "Name mit 80 Zeichen gelingt" "ok:true|80" \
  "$(tx "$(who "$U_OLLI") $(try "SELECT (public.create_gathering(repeat('x', 80)) ->> 'id') IS NOT NULL")
$(who super) $(val "(SELECT max(char_length(name)) FROM public.gatherings WHERE owner_id = '$U_OLLI')")")"
LIMIT_SETUP="$(who super)
INSERT INTO public.gatherings (owner_id, name, share_code)
SELECT '$U_OLLI', 'Probe ' || n, 'LIM' || lpad(n::text, 3, '0') FROM generate_series(1, 50) AS n;"
check V "Grenze: die 51. Veranstaltung Ollis -> HF009, Clara (anderes Konto) legt weiter an" "err:HF009|ok:true" \
  "$(tx "$LIMIT_SETUP
$(who "$U_OLLI") $(try "SELECT public.create_gathering('Nummer 51')::text")
$(who "$U_CLARA") $(try "SELECT (public.create_gathering('Claras erste') ->> 'id') IS NOT NULL")")"
# Code ueber beide Tabellen: dieselbe Zufallsfolge (setseed) liefert zuerst den Code eines Turniers bzw. einer Veranstaltung.
CODE_SETUP="$(who super)
SELECT setseed(0.42); SELECT set_config('va.code', public.generate_share_code(), true);
UPDATE public.tournaments SET share_code = current_setting('va.code') WHERE id = '$T_D';
SELECT setseed(0.42);"
check V "Code-Eindeutigkeit: der naechste Zufallscode gehoert schon einem Turnier -> die Veranstaltung bekommt einen anderen" "ok:true|true" \
  "$(tx "$CODE_SETUP
$(who "$U_OLLI") $(try "SELECT (public.create_gathering('Code-Probe') ->> 'share_code') <> current_setting('va.code')")
$(who super) SELECT setseed(0.42);
$(val "public.generate_share_code() = current_setting('va.code')")")"
check V "Code-Eindeutigkeit: der naechste Zufallscode gehoert schon einer Veranstaltung -> anderer Code" "ok:true" \
  "$(tx "$(who super)
SELECT setseed(0.7); INSERT INTO public.gatherings (owner_id, name, share_code) VALUES ('$U_GRETA', 'Belegt', public.generate_share_code());
SELECT setseed(0.7);
$(who "$U_OLLI") $(try "SELECT (public.create_gathering('Code-Probe 2') ->> 'share_code') NOT IN (SELECT share_code FROM public.gatherings WHERE owner_id = '$U_GRETA')")")"

# --- V: umbenennen (@VA-015 Z. 2) und loeschen (@VA-015 Z. 3, @VA-006) ----------------------------------------------------
check V "@VA-015 Z. 2 Olli benennt um: neuer Name, Code bleibt WAGING" "ok:|Hallenturniere TSV Waging 2026:WAGING" \
  "$(tx "$SETUP_G
$(who "$U_OLLI") $(try "SELECT public.rename_gathering('$G1', ' Hallenturniere TSV Waging 2026 ')::text")
$(who super) $(val "(SELECT name || ':' || share_code FROM public.gatherings WHERE id = '$G1')")")"
for who_id in "$U_MARIA:Maria Co-Admin" "$U_GRETA:Greta" "$U_TOM:Tom Helfer" "$U_SCREEN:Bildschirm" "$U_CLARA:Clara"; do
  check V "@VA-011 ${who_id#*:} benennt Ollis Veranstaltung nicht um (HF006), Name bleibt" "err:HF006|$G_NAME" \
    "$(tx "$SETUP_G
$(who "${who_id%%:*}") $(try "SELECT public.rename_gathering('$G1', 'Fremdname')::text")
$(who super) $(val "(SELECT name FROM public.gatherings WHERE id = '$G1')")")"
done
check V "anonyme Sitzung als Eigentuemerin (Anja) benennt nicht um (nur echtes Konto, HF006)" "err:HF006" \
  "$(tx "$SETUP_G $(who "$U_ANJA") $(try "SELECT public.rename_gathering('$G_ANJA', 'Neu')::text")")"
check V "umbenennen: unbekannte Veranstaltung HF008, leerer Name HF010" "err:HF008|err:HF010" \
  "$(tx "$SETUP_G $(who "$U_OLLI")
$(try "SELECT public.rename_gathering('$(uuid_for gathering:gibt-es-nicht)', 'X')::text")
$(try "SELECT public.rename_gathering('$G1', ' ')::text")")"
DEL_SETUP="$SETUP_G
$(assign "$G1" "'$T_F2', '$T_E'")
INSERT INTO public.gathering_members (gathering_id, user_id, role, accepted_at) VALUES ('$G1', '$U_MARIA', 'co-admin', now());
SELECT set_config('va.e', (SELECT md5(string_agg(m::text, '' ORDER BY m.id)) FROM public.matches m WHERE m.tournament_id = '$T_E'), true);"
check V "@VA-015 Z. 3 Olli loescht: Turniere ohne Veranstaltung, sonst unveraendert (auch abgeschlossenes), Mitglieder weg" \
  "ok:|0|0|2|finished|true|1" \
  "$(tx "$DEL_SETUP
$(who "$U_OLLI") $(try "SELECT public.delete_gathering('$G1')::text")
$(who super)
$(val "(SELECT count(*) FROM public.gatherings WHERE id = '$G1')")
$(val "(SELECT count(*) FROM public.gathering_members WHERE gathering_id = '$G1')")
$(val "(SELECT count(*) FROM public.tournaments WHERE id IN ('$T_F2', '$T_E') AND gathering_id IS NULL AND deleted_at IS NULL)")
$(val "(SELECT lifecycle_status FROM public.tournaments WHERE id = '$T_E')")
$(val "(SELECT md5(string_agg(m::text, '' ORDER BY m.id)) FROM public.matches m WHERE m.tournament_id = '$T_E') = current_setting('va.e')")
$(val "(SELECT version FROM public.tournaments WHERE id = '$T_F2')")")"
check V "@VA-011 Maria loescht Ollis Veranstaltung nicht (HF006); unbekannte HF008" "err:HF006|1|err:HF008" \
  "$(tx "$SETUP_G $(who "$U_MARIA") $(try "SELECT public.delete_gathering('$G1')::text")
$(who super) $(val "(SELECT count(*) FROM public.gatherings WHERE id = '$G1')")
$(who "$U_OLLI") $(try "SELECT public.delete_gathering('$(uuid_for gathering:gibt-es-nicht)')::text")")"
check V "R0: Co-Admin der Veranstaltung nur mit echtem Konto (Trigger, auch als Server)" "err:HF006" \
  "$(tx "$SETUP_G $(who super) $(run "INSERT INTO public.gathering_members (gathering_id, user_id, role) VALUES ('$G1', '$U_ANJA', 'co-admin')")")"
check V "R0: auch mit Tabellenrecht legt ein Client keine Mitglieder an (Trigger HF006)" "err:HF006" \
  "$(tx "$SETUP_G GRANT INSERT ON public.gathering_members TO authenticated;
$(who "$U_OLLI") $(run "INSERT INTO public.gathering_members (gathering_id, user_id, role) VALUES ('$G1', '$U_OLLI', 'helper')")")"

# --- Z: zuordnen (@VA-016, @VA-019, @VA-021, @VA-020) --------------------------------------------------------------------
check Z "@VA-016 Olli ordnet drei Turniere mit einem Aufruf zu; erneut senden aendert nichts" \
  'ok:{"added": 3, "removed": 0}|ok:{"added": 0, "removed": 0}|3' \
  "$(tx "$SETUP_G $(who "$U_OLLI")
$(try "SELECT $(setg "$G1" "$(ids "$T_F2" "$T_F1" "$T_D")" "$NOIDS")")
$(try "SELECT $(setg "$G1" "$(ids "$T_F2" "$T_F1" "$T_D")" "$NOIDS")")
$(who super) $(val "(SELECT count(*) FROM public.tournaments WHERE gathering_id = '$G1')")")"
check Z "@VA-016 Loesen ist wiederholbar: zweites Loesen aendert nichts, ist kein Fehler" \
  'ok:{"added": 0, "removed": 1}|ok:{"added": 0, "removed": 0}|NULL' \
  "$(tx "$SETUP_G $(assign "$G1" "'$T_F1'") $(who "$U_OLLI")
$(try "SELECT $(setg "$G1" "$NOIDS" "$(ids "$T_F1")")")
$(try "SELECT $(setg "$G1" "$NOIDS" "$(ids "$T_F1")")")
$(who super) $(val "(SELECT gathering_id FROM public.tournaments WHERE id = '$T_F1')")")"
check Z "@VA-016 Turnier einer anderen Veranstaltung -> HF007, Zuordnung bleibt (ganz oder gar nicht: F1 bleibt frei)" \
  "err:HF007|$G2|NULL" \
  "$(tx "$SETUP_G $(assign "$G2" "'$T_F2'") $(who "$U_OLLI")
$(try "SELECT $(setg "$G1" "$(ids "$T_F1" "$T_F2")" "$NOIDS")")
$(who super) $(val "(SELECT gathering_id FROM public.tournaments WHERE id = '$T_F2')")
$(val "(SELECT gathering_id FROM public.tournaments WHERE id = '$T_F1')")")"
check Z "Papierkorb und unbekanntes Turnier -> HF008; dasselbe Turnier in add und remove -> 22023" \
  "err:HF008|err:HF008|err:22023|0" \
  "$(tx "$SETUP_G $(who "$U_OLLI")
$(try "SELECT $(setg "$G1" "$(ids "$T_F1" "$T_TRASH")" "$NOIDS")")
$(try "SELECT $(setg "$G1" "$(ids "$(uuid_for tournament:gibt-es-nicht)")" "$NOIDS")")
$(try "SELECT $(setg "$G1" "$(ids "$T_F1")" "$(ids "$T_F1")")")
$(who super) $(val "(SELECT count(*) FROM public.tournaments WHERE gathering_id = '$G1')")")"
check Z "@VA-021 Z. 4 Olli ordnet Gretas Turnier nicht zu (HF006); Greta Ollis Turnier nicht (HF006)" "err:HF006|err:HF006|0" \
  "$(tx "$SETUP_G
$(who "$U_OLLI") $(try "SELECT $(setg "$G1" "$(ids "$T_GRETA")" "$NOIDS")")
$(who "$U_GRETA") $(try "SELECT $(setg "$G_GRETA" "$(ids "$T_F2")" "$NOIDS")")
$(who super) $(val "(SELECT count(*) FROM public.tournaments WHERE gathering_id IS NOT NULL)")")"
for who_id in "$U_MARIA:Maria Co-Admin" "$U_TOM:Tom Helfer" "$U_SCREEN:Bildschirm" "$U_CLARA:Clara"; do
  check Z "@VA-011 @VA-021 ${who_id#*:} fuegt F2 nicht hinzu und entfernt es nicht (HF006); F2 bleibt bei Olli" \
    "err:HF006|err:HF006|$G1" \
    "$(tx "$SETUP_G $(assign "$G1" "'$T_F2'") $(who "${who_id%%:*}")
$(try "SELECT $(setg "$G1" "$NOIDS" "$(ids "$T_F2")")")
$(try "SELECT $(setg "$G1" "$(ids "$T_F1")" "$NOIDS")")
$(who super) $(val "(SELECT gathering_id FROM public.tournaments WHERE id = '$T_F2')")")"
done
check Z "anon ohne Sitzung darf set_gathering_tournaments nicht ausfuehren (42501)" "err:42501" \
  "$(tx "$SETUP_G $(who anon) $(try "SELECT $(setg "$G1" "$(ids "$T_F2")" "$NOIDS")")")"
check Z "@VA-021 Z. 1/2 Maria unter Umgehung der App: gathering_id direkt umhaengen oder loeschen -> HF006, bleibt bei Olli" \
  "err:HF006|err:HF006|$G1" \
  "$(tx "$SETUP_G $(assign "$G1" "'$T_F2'") $(who "$U_MARIA")
$(run "UPDATE public.tournaments SET gathering_id = '$G2' WHERE id = '$T_F2'")
$(run "UPDATE public.tournaments SET gathering_id = NULL WHERE id = '$T_F2'")
$(who super) $(val "(SELECT gathering_id FROM public.tournaments WHERE id = '$T_F2')")")"
check Z "auch Olli schreibt das Feld nicht direkt (nur ueber die Server-Funktion, HF006)" "err:HF006|NULL" \
  "$(tx "$SETUP_G $(who "$U_OLLI") $(run "UPDATE public.tournaments SET gathering_id = '$G1' WHERE id = '$T_F1'")
$(who super) $(val "(SELECT gathering_id FROM public.tournaments WHERE id = '$T_F1')")")"
check Z "@VA-019 abgeschlossenes Turnier zuordnen und loesen gelingt, Endstand/Spiele/Zustand unveraendert" \
  'ok:{"added": 1, "removed": 0}|ok:{"added": 0, "removed": 1}|finished|true' \
  "$(tx "$SETUP_G
SELECT set_config('va.e', (SELECT md5(string_agg(m::text, '' ORDER BY m.id)) FROM public.matches m WHERE m.tournament_id = '$T_E'), true);
$(who "$U_OLLI")
$(try "SELECT $(setg "$G1" "$(ids "$T_E")" "$NOIDS")")
$(try "SELECT $(setg "$G1" "$NOIDS" "$(ids "$T_E")")")
$(who super) $(val "(SELECT lifecycle_status FROM public.tournaments WHERE id = '$T_E')")
$(val "(SELECT md5(string_agg(m::text, '' ORDER BY m.id)) FROM public.matches m WHERE m.tournament_id = '$T_E') = current_setting('va.e')")")"
# Optimistic Lock (@VA-021 Z. 3): Ollis Tablet hat F2 vor der Zuordnung geladen (version v), speichert danach per CAS und
# per Upsert ohne das Feld -- kein Konflikt, die Zuordnung bleibt.
OL_SETUP="$SETUP_G
SELECT set_config('va.v', (SELECT version || '/' || change_revision FROM public.tournaments WHERE id = '$T_F2'), true);"
check Z "@VA-021 Z. 3 Zuordnen aendert version/change_revision nicht; altes Geraet speichert ohne Konflikt, Zuordnung bleibt" \
  "true|rows:1|rows:1|$G1" \
  "$(tx "$OL_SETUP $(who "$U_OLLI") $(try "SELECT $(setg "$G1" "$(ids "$T_F2")" "$NOIDS")")
$(who super) $(val "(SELECT version || '/' || change_revision FROM public.tournaments WHERE id = '$T_F2') = current_setting('va.v')")
$(who "$U_OLLI")
$(run "UPDATE public.tournaments SET title = 'F2-Junioren (Tablet)', version = version + 1 WHERE id = '$T_F2' AND version = split_part(current_setting('va.v'), '/', 1)::int")
$(run "INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration) VALUES ('$T_F2', '$U_OLLI', 'F2-Junioren (Upsert)', current_date + 1, 2, 10) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title")
$(who super) $(val "(SELECT gathering_id FROM public.tournaments WHERE id = '$T_F2')")" | sed 's/^ok:[^|]*|//')"
check Z "@VA-020 Kopie (INSERT eines Clients mit gathering_id) gehoert zu keiner Veranstaltung, Original bleibt" "rows:1|NULL|$G1" \
  "$(tx "$SETUP_G $(assign "$G1" "'$T_F2'") $(who "$U_OLLI")
$(run "INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, gathering_id) VALUES ('$(uuid_for tournament:kopie)', '$U_OLLI', 'F2-Junioren (Kopie)', current_date + 30, 2, 10, '$G1')")
$(who super) $(val "(SELECT coalesce(gathering_id::text, 'NULL') FROM public.tournaments WHERE id = '$(uuid_for tournament:kopie)')")
$(val "(SELECT gathering_id FROM public.tournaments WHERE id = '$T_F2')")")"

# --- Z: Wettlauf (@VA-016): zwei Veranstaltungen ordnen dasselbe Turnier gleichzeitig zu -> eine gewinnt, die andere HF007.
if q "SELECT to_regclass('public.gatherings') IS NOT NULL;" | grep -qx t; then
  psql_stdin <<<"INSERT INTO public.gatherings (id, owner_id, name, share_code) VALUES ('$GR1', '$U_OLLI', 'Wettlauf eins', 'RACE01'), ('$GR2', '$U_OLLI', 'Wettlauf zwei', 'RACE02');" || true
  q "BEGIN; $(who "$U_OLLI") SELECT public.set_gathering_tournaments('$GR1', ARRAY['$T_RACE']::uuid[], '{}'); SELECT pg_sleep(3); COMMIT;" > "$WORK/race_a.txt" &
  RACE_PID=$!
  sleep 1
  RACE_T0="$(date +%s)"
  RACE_B="$(q "BEGIN; $(who "$U_OLLI") $(try "SELECT $(setg "$GR2" "$(ids "$T_RACE")" "$NOIDS")") COMMIT;" | { grep -E '^k:' || true; } | sed 's/^k://')"
  RACE_WAIT=$(( $(date +%s) - RACE_T0 ))
  wait "$RACE_PID" || true
  check Z "@VA-016 Wettlauf: die zweite Veranstaltung wartet auf die Sperre und bekommt HF007; das Turnier gehoert der ersten" \
    "err:HF007|wartete|$GR1" \
    "$RACE_B|$([[ "$RACE_WAIT" -ge 1 ]] && echo wartete || echo "wartete-nicht($RACE_WAIT s)")|$(q "SELECT gathering_id FROM public.tournaments WHERE id = '$T_RACE';")"
  psql_stdin <<<"DELETE FROM public.gatherings WHERE id IN ('$GR1', '$GR2');" || true
else
  check Z "@VA-016 Wettlauf (Tabelle gatherings fehlt)" "vorhanden" "fehlt"
fi
