# shellcheck shell=bash
#
# rls-matrix.d/spur-zz-monitor-endstand.sh — Zeilen von 20261118_008_monitor_endstand.sql (Monitor-Endstand ueber den
# Monitor-Link, @ZM-121 Z. 1/2) fuer scripts/rls-role-matrix.sh. Per `source` eingebunden NACH spur-z-abschluss-nachzug.sh
# (Glob-Reihenfolge "spur-z-" < "spur-zz"), nutzt a27_sql (spur-geraete-a27.sh), a21a_finish_setup
# (spur-lebenszyklus-a21a.sh), user_id_for_id(), MATRIX_IDS.
#
# Je Identitaet aus MATRIX_IDS (und anon ohne Sitzung) eine nie committete Transaktion gegen T_MAIN (nicht oeffentlich);
# Vorbereitung als Superuser: Monitor „mon-zz“ in config.monitors, dann abgeschlossen mit gespeichertem Endstand.
#   display_final_standings(T_MAIN, 'mon-zz'): fuer JEDE Identitaet 'final' -- der Link haengt nicht an Rolle oder Anmeldung
#     (wie display_tournament, @ZM-101: auch ohne Online-Teilen); ohne Torschuetzen (Schalter aus, @ZM-012 Z. 2).
#   display_final_standings(T_MAIN, 'mon-fremd'): 'none' (Kennung steht nicht in config.monitors).
#   nach dem Wiederoeffnen (lifecycle_status 'fixed', finished_at NULL; Endstand bleibt gespeichert, @LZ-091):
#     weiter 'final' (@ZM-121 Z. 2).
# Dazu anon: im Kindermodus 'none' (@ZM-121 Z. 4); Zuschauer-Endstand des oeffentlichen T_PUBLIC nach dem Wiederoeffnen
# weiter 'final' (@LZ-077 Z. 2), ohne Teilen 'none'. Gegenprobe: --without-mend (Funktion fehlt -> 42883 bzw. none, rot).

MEND_MISMATCHES=0
MEND_CELLS=0
MEND_MONITOR="UPDATE public.tournaments SET config = coalesce(config, '{}'::jsonb) || '{\"monitors\": [{\"id\": \"mon-zz\", \"name\": \"Hallenmonitor Eingang\", \"slides\": []}]}'::jsonb WHERE id = '$T_MAIN';"
MEND_SETUP_FIN="$MEND_MONITOR
$(a21a_finish_setup "$T_MAIN")"
MEND_SETUP_REOPEN="$MEND_SETUP_FIN
SET LOCAL app.lifecycle_write = 'on';
UPDATE public.tournaments SET lifecycle_status = 'fixed', finished_at = NULL WHERE id = '$T_MAIN';
RESET app.lifecycle_write;"

mend_cell() { # mend_cell <Name> <erhalten> <erwartet>
  MEND_CELLS=$((MEND_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); MEND_MISMATCHES=$((MEND_MISMATCHES + 1))
    printf 'mend %-62s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

MEND_PROBE="DO \$mend\$
DECLARE r text := ''; v jsonb;
BEGIN
  BEGIN v := public.display_final_standings('$T_MAIN'::uuid, 'mon-zz');
        r := r || 'mon=' || (v ->> 'status') || ':' || (coalesce(v -> 'standings' ? 'scorers', false))::text || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'mon=' || SQLSTATE || ';'; END;
  BEGIN v := public.display_final_standings('$T_MAIN'::uuid, 'mon-fremd'); r := r || 'fremd=' || (v ->> 'status') || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'fremd=' || SQLSTATE || ';'; END;
  RAISE NOTICE 'mendergebnis:%', r;
END
\$mend\$;"
mend_probe() { # mend_probe <rolle> <uid|leer> <vorbereitung>
  local out
  out="$(a27_sql "$1" "$2" "$MEND_PROBE" "$3")"
  (grep -m1 -o 'mendergebnis:.*' <<<"$out" || echo "mendergebnis:fehler $out") | sed 's/^mendergebnis://'
}

for mend_id in "${MATRIX_IDS[@]}"; do
  mend_uid="$(user_id_for_id "$mend_id")"
  mend_cell "@ZM-121 Z. 1 Monitor-Link nach dem Abschluss $mend_id" "$(mend_probe authenticated "$mend_uid" "$MEND_SETUP_FIN")" "mon=final:false;fremd=none;"
  mend_cell "@ZM-121 Z. 2 Monitor-Link nach dem Wiederoeffnen $mend_id" "$(mend_probe authenticated "$mend_uid" "$MEND_SETUP_REOPEN")" "mon=final:false;fremd=none;"
done

mend_cell "anon ohne Sitzung: Monitor-Link nach dem Abschluss (nicht geteilt)" "$(mend_probe anon "" "$MEND_SETUP_FIN")" "mon=final:false;fremd=none;"
mend_cell "anon ohne Sitzung: Monitor-Link nach dem Wiederoeffnen" "$(mend_probe anon "" "$MEND_SETUP_REOPEN")" "mon=final:false;fremd=none;"
mend_cell "@ZM-121 Z. 4 anon: Kindermodus -> kein Endstand" \
  "$(mend_probe anon "" "UPDATE public.tournaments SET config = coalesce(config, '{}'::jsonb) || '{\"hideScoresForPublic\": true}'::jsonb WHERE id = '$T_MAIN'; $MEND_SETUP_FIN")" \
  "mon=none:false;fremd=none;"

# Zuschauer (anon, Teilen-Code): T_PUBLIC abgeschlossen, dann wieder geoeffnet -> final; dasselbe ohne Teilen -> none.
MEND_PUB_SETUP="UPDATE public.tournaments SET share_code = 'PUBME1' WHERE id = '$T_PUBLIC';
$(a21a_finish_setup "$T_PUBLIC")
SET LOCAL app.lifecycle_write = 'on';
UPDATE public.tournaments SET lifecycle_status = 'fixed', finished_at = NULL WHERE id = '$T_PUBLIC';
RESET app.lifecycle_write;"
mend_pub() { a27_sql anon "" "SELECT 'mendpub:' || (public.public_final_standings('PUBME1') ->> 'status');" "$1" | grep -m1 -oE 'mendpub:[a-z0-9]+' || echo "mendpub:fehler"; }
mend_cell "@LZ-077 Z. 2 anon: Zuschauer-Endstand nach dem Wiederoeffnen" "$(mend_pub "$MEND_PUB_SETUP")" "mendpub:final"
mend_cell "@LZ-077 Z. 2 anon: wieder geoeffnet, aber nicht (mehr) geteilt -> kein Endstand" \
  "$(mend_pub "$MEND_PUB_SETUP
UPDATE public.tournaments SET is_public = false WHERE id = '$T_PUBLIC';")" "mendpub:none"

echo "mend: $MEND_CELLS Zellen geprueft (${#MATRIX_IDS[@]} Identitaeten x 2 + anon 5), $MEND_MISMATCHES Abweichung(en)"
