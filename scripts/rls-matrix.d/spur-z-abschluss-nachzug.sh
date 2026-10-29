# shellcheck shell=bash
#
# rls-matrix.d/spur-z-abschluss-nachzug.sh — Zeilen von 20261118_004_abschluss_nachzug.sql (W-M, Server-Nachzug Abschluss)
# fuer scripts/rls-role-matrix.sh. Per `source` eingebunden NACH spur-y-klaerung-a35.sh (Glob-Reihenfolge "spur-y" <
# "spur-z"), nutzt a27_sql (spur-geraete-a27.sh), A21A_SETUP (spur-lebenszyklus-a21a.sh), KL_SETUP (spur-y-klaerung-a35.sh),
# perm_expected(), user_id_for_id(), role_for_id(), MATRIX_IDS.
#
# Je Identitaet aus MATRIX_IDS zwei nie committete Transaktionen gegen T_MAIN (Vorbereitung als Superuser):
#   (i)  abgeschlossen im Kindermodus (config.hideScoresForPublic = true, dann A21A_SETUP: Endstand mit Torschuetzen,
#        ein spaeter Eintrag):
#        list_late_entries(T_MAIN): mit manageLifecycle 1 Eintrag, sonst 0 (@LZ-039 „Olli und Maria sehen den Eintrag“);
#        display_final_standings(T_MAIN): fuer JEDE Identitaet 'none' -- auch mit readDisplay (@ZM-121 Zeile Kindermodus,
#        „Kindermodus ueberstimmt alle Schalter“; ohne W-M bekaeme der Bildschirm 'final').
#   (ii) laufend mit einem offenen Klaerungseintrag (KL_SETUP): finish_preflight(T_MAIN): mit manageLifecycle steht der Punkt
#        review_open in der Liste (@LZ-010 Zeile Klaerung), sonst 42501.
# Dazu anon ohne Sitzung: list_late_entries -> 42501; public_final_standings des oeffentlichen T_PUBLIC im Kindermodus 'none'.
# Gegenprobe: --without-wm (list_late_entries fehlt, Kindermodus wird nicht geachtet, review_open fehlt -> rot).

WM_MISMATCHES=0
WM_CELLS=0
WM_SETUP_FIN="UPDATE public.tournaments SET config = coalesce(config, '{}'::jsonb) || '{\"hideScoresForPublic\": true}'::jsonb WHERE id = '$T_MAIN';
$A21A_SETUP"

wm_cell() { # wm_cell <Name> <erhalten> <erwartet>
  WM_CELLS=$((WM_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); WM_MISMATCHES=$((WM_MISMATCHES + 1))
    printf 'wm   %-62s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

WM_PROBE_FIN="DO \$wm\$
DECLARE r text := ''; v jsonb;
BEGIN
  BEGIN v := public.list_late_entries('$T_MAIN'); r := r || 'late=' || jsonb_array_length(v) || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'late=' || SQLSTATE || ';'; END;
  BEGIN v := public.display_final_standings('$T_MAIN'); r := r || 'display=' || (v ->> 'status') || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'display=' || SQLSTATE || ';'; END;
  RAISE NOTICE 'wmergebnis:%', r;
END
\$wm\$;"
WM_PROBE_RUN="DO \$wm\$
DECLARE r text := ''; v jsonb;
BEGIN
  BEGIN v := public.finish_preflight('$T_MAIN');
        r := r || 'pre=' || (SELECT count(*) FROM jsonb_array_elements(v -> 'items') x WHERE x ->> 'kind' = 'review_open') || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'pre=' || SQLSTATE || ';'; END;
  RAISE NOTICE 'wmergebnis:%', r;
END
\$wm\$;"
wm_probe() { # wm_probe <rolle> <uid|leer> <probe> <vorbereitung>
  local out
  out="$(a27_sql "$1" "$2" "$3" "$4")"
  (grep -m1 -o 'wmergebnis:.*' <<<"$out" || echo "wmergebnis:fehler $out") | sed 's/^wmergebnis://'
}

for wm_id in "${MATRIX_IDS[@]}"; do
  wm_uid="$(user_id_for_id "$wm_id")"
  wm_lead="$(perm_expected "$(role_for_id "$wm_id")" manageLifecycle)"
  if [[ "$wm_lead" == "true" ]]; then
    wm_exp_fin="late=1;display=none;"
    wm_exp_run="pre=1;"
  else
    wm_exp_fin="late=0;display=none;"
    wm_exp_run="pre=42501;"
  fi
  wm_cell "@LZ-039 @ZM-121 spaete Eintraege lesen, Monitor im Kindermodus $wm_id" "$(wm_probe authenticated "$wm_uid" "$WM_PROBE_FIN" "$WM_SETUP_FIN")" "$wm_exp_fin"
  wm_cell "@LZ-010 offene Klaerung in der Abschluss-Liste $wm_id" "$(wm_probe authenticated "$wm_uid" "$WM_PROBE_RUN" "$KL_SETUP")" "$wm_exp_run"
done

# anon ohne Sitzung: keine spaeten Eintraege; oeffentliches Turnier im Kindermodus ohne Endstand (Zuschauer).
wm_cell "anon ohne Sitzung: list_late_entries gesperrt" "$(cut -d';' -f1 <<<"$(wm_probe anon "" "$WM_PROBE_FIN" "$WM_SETUP_FIN")")" "late=42501"
wm_pub="$(a27_sql anon "" "SELECT 'wmpub:' || (public.public_final_standings('PUBWM1') ->> 'status') || ':' || (public.display_final_standings('$T_PUBLIC') ->> 'status');" \
  "UPDATE public.tournaments SET share_code = 'PUBWM1', config = coalesce(config, '{}'::jsonb) || '{\"hideScoresForPublic\": true, \"publicScorers\": true}'::jsonb WHERE id = '$T_PUBLIC'; $(a21a_finish_setup "$T_PUBLIC")" \
  | grep -m1 -oE 'wmpub:[a-z0-9]+:[a-z0-9]+' || true)"
wm_cell "@ZM-121 oeffentliches Turnier im Kindermodus: Zuschauer und Monitor ohne Endstand" "$wm_pub" "wmpub:none:none"

echo "wm: $WM_CELLS Zellen geprueft (${#MATRIX_IDS[@]} Identitaeten x 2 + anon 2), $WM_MISMATCHES Abweichung(en)"
