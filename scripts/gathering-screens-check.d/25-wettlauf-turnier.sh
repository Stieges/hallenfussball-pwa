# shellcheck shell=bash
#
# gathering-screens-check.d/25-wettlauf-turnier.sh — Kategorie R: „Auf die Bildschirme“ im Wettlauf mit einer noch offenen
# Aenderung am Turnier (zwei echte Sitzungen). Sitzung A macht F1 unzulaessig (Entwurf bzw. anderer Ort) und haelt die
# Transaktion offen; Sitzung B tippt bei F1 „Auf die Bildschirme“. Nach COMMIT von A muss B ablehnen (HF012) und nichts in
# der Halle stehen -- sonst kaeme F1 nach dem Waechter still zurueck (@VA-036, @VA-037; Opus-Review PR #452).
# Festgeschriebene Daten werden danach aufgeraeumt (Turnier ohne Trigger auf den alten Stand).

show_r() { echo "public.set_gathering_on_screen('$1', true)"; }

# race_turnier <Label> <Aenderung in Sitzung A>
race_turnier() {
  local label="$1" change="$2" saved marker out_b gs
  saved="$(q "SELECT concat_ws(',', quote_literal(status), quote_literal(lifecycle_status), quote_nullable(location_name),
                        quote_literal(updated_at)) FROM public.tournaments WHERE id = '$T_F1';")"
  psql_stdin <<<"$(sed 's/SET LOCAL/SET/g' <<<"$SETUP_S") RESET ROLE;" >/dev/null 2>&1 || true
  marker="wettlauf_r_$RANDOM$RANDOM"
  ( q "BEGIN; $change; SELECT pg_sleep(3) AS $marker; COMMIT;" >/dev/null ) &
  local pid_a=$!
  # Erst weiter, wenn A seine Aenderung gemacht hat und schlaeft (haelt die Zeilensperre am Turnier).
  local a_ready="timeout"
  for _ in $(seq 1 50); do
    if [[ "$(q "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%AS $marker%' AND pid <> pg_backend_pid();")" == "1" ]]; then
      a_ready="wartet"; break
    fi
    sleep 0.1
  done
  # Ohne wartende Sitzung A waere die Pruefung wertlos (B liefe nicht im Wettlauf): dann rot, nicht still weiter.
  check R "$label: Sitzung A haelt die Zeilensperre (Wettlauf steht)" "wartet" "$a_ready"
  out_b="$(q "BEGIN; $(who "$U_OLLI") $(try "SELECT $(show_r "$T_F1") -> 'on_screen' ->> 'tournament_id'") COMMIT;" \
           | { grep -E '^k:' || true; } | sed 's/^k://')"
  wait "$pid_a" || true
  gs="$(q "SELECT coalesce(on_screen_tournament_id::text, 'NULL') FROM public.gatherings WHERE id = '$GS';")"
  check R "$label: Sitzung B wartet auf A und lehnt danach ab (HF012), nichts in der Halle" "err:HF012|NULL" "$out_b|$gs"
  psql_stdin <<<"DELETE FROM public.gatherings WHERE id = '$GS';
UPDATE public.tournaments SET gathering_id = NULL WHERE gathering_id IS NOT NULL;
SET session_replication_role = replica;
UPDATE public.tournaments SET (status, lifecycle_status, location_name, updated_at) = ($saved) WHERE id = '$T_F1';
SET session_replication_role = origin;" >/dev/null 2>&1 || true
}

if q "SELECT to_regclass('public.gathering_screens') IS NOT NULL;" | grep -qx t; then
  race_turnier "@VA-036 Z. 3 F1 geht in Sitzung A zurueck auf Entwurf (noch offen)" \
    "UPDATE public.tournaments SET status = 'draft' WHERE id = '$T_F1'"
  race_turnier "@VA-041 F1 zieht in Sitzung A an einen anderen Ort (noch offen)" \
    "UPDATE public.tournaments SET location_name = 'Halle Nord' WHERE id = '$T_F1'"
else
  check R "Wettlauf mit Turnier-Aenderung (Tabelle gathering_screens fehlt)" "vorhanden" "fehlt"
fi
