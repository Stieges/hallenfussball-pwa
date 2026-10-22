# shellcheck shell=bash
#
# rls-matrix.d/spur-lebenszyklus-a21a.sh — Zeilen von A-21a-S (20261113_003_tournament_lifecycle.sql, Lebenszyklus und
# Abschluss-Sperre am Server; plan-endstand-abschluss.md § 3 Punkt 9) fuer scripts/rls-role-matrix.sh. Per `source`
# eingebunden NACH spur-geraete-a27.sh (Glob-Reihenfolge "spur-ge" < "spur-le"), nutzt a27_sql, claims_line(),
# perm_expected(), MATRIX_IDS.
#
# Je Identitaet aus MATRIX_IDS eine nie committete Transaktion gegen T_MAIN (erst lesen, dann die RPCs -- das
# Wiederoeffnen aendert den Zustand); Vorbereitung als Superuser: T_MAIN
# abgeschlossen (Schalter wie der Server), ein gespeicherter Endstand mit Torschuetzen, ein Verlaufseintrag, ein spaeter
# Eintrag. Erwartung aus rolePermissions.json bzw. dem Gherkin:
#   finish_tournament, finish_preflight, reopen_tournament: mit manageLifecycle antwortet die Funktion, sonst 42501
#     (@LZ-022, @LZ-023; Helfer, Helfer-Geraet, Bildschirm, anonyme Sitzung, Fremde -> 42501).
#   report_device_outbox: mit writeMatchData ok, sonst 42501 (F3).
#   SELECT tournament_final_standings: mit writeMatchData 1 Zeile (Olli liest, @HE-070 Z. 2), sonst 0 -- auch der
#     Bildschirm (screen) liest die Tabelle NICHT (Review B5), sondern nur ueber display_final_standings.
#   SELECT tournament_lifecycle_log, late_entries: nur manageLifecycle (Gruende und spaete Eintraege nur fuer die Leitung).
#   display_final_standings (T_MAIN nicht oeffentlich): mit readDisplay 'final' ohne Torschuetzen (Schalter aus), sonst 'none'.
#   Schreiben auf die vier Tabellen: fuer jede Identitaet 42501.
# Dazu anon (ohne Sitzung) und Vorher/Nachher an T_PUBLIC (oeffentlich): vor dem Abschluss 'none' (@LZ-075), nachher
# 'final' ohne Torschuetzen (@ZM-012), mit Schalter mit Torschuetzen (@ZM-011). Gegenprobe: --without-a21as (rot).

A21A_MISMATCHES=0
A21A_CELLS=0
A21A_SNAPSHOT='{"format": 1, "ranking": [{"place": 1, "teamId": "00000000-0000-4000-8000-000000000910", "teamName": "FC Nord", "origin": {"kind": "groupPlace", "group": "", "place": 1}}], "scorers": [{"kind": "player", "rank": 1, "teamId": "00000000-0000-4000-8000-000000000910", "teamName": "FC Nord", "number": 7, "goals": 3}], "appVersion": "2.3.0", "computedAt": "2026-11-28T15:30:00.000Z"}'
a21a_finish_setup() { # a21a_finish_setup <Turnier> [Schalter publicScorers]
  echo "SET LOCAL app.lifecycle_write = 'on';
UPDATE public.tournaments SET lifecycle_status = 'finished', finished_at = now()
       ${2:+, config = coalesce(config, '{}'::jsonb) || '{\"publicScorers\": true}'::jsonb} WHERE id = '$1';
RESET app.lifecycle_write;
INSERT INTO public.tournament_final_standings (tournament_id, snapshot, finished_at, finished_by, request_id)
VALUES ('$1', '$A21A_SNAPSHOT'::jsonb, now(), '$U_OWNER', gen_random_uuid());
INSERT INTO public.tournament_lifecycle_log (tournament_id, kind, request_id, actor) VALUES ('$1', 'finish', gen_random_uuid(), '$U_OWNER');"
}
A21A_SETUP="$(a21a_finish_setup "$T_MAIN")
INSERT INTO public.late_entries (tournament_id, match_id, event_id, event, actor) VALUES ('$T_MAIN', '$M_MAIN', gen_random_uuid(), '{}'::jsonb, '$U_COLLAB');"

a21a_cell() { # a21a_cell <Name> <erhalten> <erwartet>
  A21A_CELLS=$((A21A_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); A21A_MISMATCHES=$((A21A_MISMATCHES + 1))
    printf 'a21a %-62s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

A21A_PROBE="DO \$a21a\$
DECLARE r text := ''; v jsonb; n bigint;
BEGIN
  BEGIN v := public.display_final_standings('$T_MAIN'); r := r || 'display=' || (v ->> 'status') || ':' || (coalesce(v -> 'standings' ? 'scorers', false))::text || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'display=' || SQLSTATE || ';'; END;
  BEGIN SELECT count(*) INTO n FROM public.tournament_final_standings WHERE tournament_id = '$T_MAIN'; r := r || 'sel_fs=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'sel_fs=' || SQLSTATE || ';'; END;
  BEGIN SELECT count(*) INTO n FROM public.tournament_lifecycle_log WHERE tournament_id = '$T_MAIN'; r := r || 'sel_log=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'sel_log=' || SQLSTATE || ';'; END;
  BEGIN SELECT count(*) INTO n FROM public.late_entries WHERE tournament_id = '$T_MAIN'; r := r || 'sel_late=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'sel_late=' || SQLSTATE || ';'; END;
  BEGIN v := public.finish_tournament('$T_MAIN', '[]'::jsonb, '{}'::jsonb, gen_random_uuid()); r := r || 'finish=antwort;';
  EXCEPTION WHEN OTHERS THEN r := r || 'finish=' || SQLSTATE || ';'; END;
  BEGIN v := public.finish_preflight('$T_MAIN'); r := r || 'preflight=antwort;';
  EXCEPTION WHEN OTHERS THEN r := r || 'preflight=' || SQLSTATE || ';'; END;
  BEGIN v := public.reopen_tournament('$T_MAIN', 'Grund', gen_random_uuid()); r := r || 'reopen=antwort;';
  EXCEPTION WHEN OTHERS THEN r := r || 'reopen=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.report_device_outbox('$T_MAIN', gen_random_uuid(), 1, 2); r := r || 'report=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'report=' || SQLSTATE || ';'; END;
  BEGIN UPDATE public.tournament_final_standings SET snapshot = '{}' WHERE tournament_id = '$T_MAIN'; r := r || 'upd_fs=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'upd_fs=' || SQLSTATE || ';'; END;
  BEGIN INSERT INTO public.tournament_lifecycle_log (tournament_id, kind, request_id, actor) VALUES ('$T_MAIN', 'reopen', gen_random_uuid(), '$U_OWNER'); r := r || 'ins_log=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'ins_log=' || SQLSTATE || ';'; END;
  BEGIN DELETE FROM public.late_entries WHERE tournament_id = '$T_MAIN'; r := r || 'del_late=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'del_late=' || SQLSTATE || ';'; END;
  BEGIN INSERT INTO public.device_outbox_reports (tournament_id, device_id, user_id, pending) VALUES ('$T_MAIN', gen_random_uuid(), '$U_OWNER', 1); r := r || 'ins_outbox=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'ins_outbox=' || SQLSTATE || ';'; END;
  RAISE NOTICE 'a21a|%', r;
END
\$a21a\$;"

a21a_value() { # a21a_value <Ausgabe> <Schluessel>
  { grep -m1 -oE 'a21a\|[^ ]*' <<<"$1" || true; } | sed 's/^a21a|//' | tr ';' '\n' | awk -F= -v k="$2" '$1 == k {print substr($0, length(k) + 2); exit}'
}

for a21a_id in "${MATRIX_IDS[@]}"; do
  a21a_uid="$(user_id_for_id "$a21a_id")"
  a21a_role="$(role_for_id "$a21a_id")"
  a21a_lead="$(perm_expected "$a21a_role" manageLifecycle)"
  a21a_match="$(perm_expected "$a21a_role" writeMatchData)"
  a21a_display="$(perm_expected "$a21a_role" readDisplay)"
  a21a_out="$(a27_sql authenticated "$a21a_uid" "$A21A_PROBE" "$A21A_SETUP")"
  for rpc in finish preflight reopen; do
    [[ "$a21a_lead" == "true" ]] && exp="antwort" || exp="42501"
    a21a_cell "@LZ-022/@LZ-023 $rpc $a21a_id" "$(a21a_value "$a21a_out" "$rpc")" "$exp"
  done
  [[ "$a21a_match" == "true" ]] && exp="ok" || exp="42501"
  a21a_cell "F3 report_device_outbox $a21a_id" "$(a21a_value "$a21a_out" report)" "$exp"
  [[ "$a21a_display" == "true" ]] && exp="final:false" || exp="none:false"
  a21a_cell "@LZ-076 @ZM-012 display_final_standings $a21a_id (nicht oeffentlich, Schalter aus)" "$(a21a_value "$a21a_out" display)" "$exp"
  [[ "$a21a_match" == "true" ]] && exp="1" || exp="0"
  a21a_cell "B5 @HE-070 SELECT tournament_final_standings $a21a_id" "$(a21a_value "$a21a_out" sel_fs)" "$exp"
  [[ "$a21a_lead" == "true" ]] && exp="1" || exp="0"
  a21a_cell "SELECT tournament_lifecycle_log $a21a_id (nur Leitung)" "$(a21a_value "$a21a_out" sel_log)" "$exp"
  a21a_cell "@LZ-039 SELECT late_entries $a21a_id (nur Leitung)" "$(a21a_value "$a21a_out" sel_late)" "$exp"
  for key in upd_fs ins_log del_late ins_outbox; do
    a21a_cell "$key $a21a_id (nur der Server schreibt)" "$(a21a_value "$a21a_out" "$key")" "42501"
  done
done

# Ohne Sitzung (Rolle anon): keine RPC der Leitung, keine Tabelle; Monitor eines nicht oeffentlichen Turniers 'none'.
a21a_out="$(a27_sql anon "" "$A21A_PROBE" "$A21A_SETUP")"
for key in finish preflight reopen report sel_fs sel_log sel_late upd_fs ins_log del_late ins_outbox; do
  a21a_cell "anon $key" "$(a21a_value "$a21a_out" "$key")" "42501"
done
a21a_cell "anon display_final_standings (nicht oeffentlich)" "$(a21a_value "$a21a_out" display)" "none:false"

# Vorher/Nachher an T_PUBLIC (oeffentlich, Teilen-Code), als anon (Eltern): @LZ-075, @ZM-012, @ZM-011.
a21a_pub() { # a21a_pub <Vorbereitung> -> "<public-status>:<scorers>|<display-status>:<scorers>"
  a27_sql anon "" "SELECT (public.public_final_standings(t.share_code) ->> 'status') || ':' || coalesce(public.public_final_standings(t.share_code) -> 'standings' ? 'scorers', false)::text
       || '|' || (public.display_final_standings(t.id) ->> 'status') || ':' || coalesce(public.display_final_standings(t.id) -> 'standings' ? 'scorers', false)::text
  FROM public.tournaments t WHERE t.id = '$T_PUBLIC';" \
    "UPDATE public.tournaments SET share_code = coalesce(share_code, 'PUBA21') WHERE id = '$T_PUBLIC'; $1" | grep -E '^[a-z]+:(true|false)\|' | tail -1
}
a21a_cell "@LZ-075 T_PUBLIC vor dem Abschluss: Zuschauer und Monitor 'none'" "$(a21a_pub "")" "none:false|none:false"
a21a_cell "@ZM-012 T_PUBLIC nach dem Abschluss, Schalter aus: 'final' ohne Torschuetzen" "$(a21a_pub "$(a21a_finish_setup "$T_PUBLIC")")" "final:false|final:false"
a21a_cell "@ZM-011 T_PUBLIC nach dem Abschluss, Schalter an: 'final' mit Torschuetzen" "$(a21a_pub "$(a21a_finish_setup "$T_PUBLIC" an)")" "final:true|final:true"

echo "a21a: $A21A_CELLS Zellen geprueft (${#MATRIX_IDS[@]} Identitaeten x 13 + anon 12 + T_PUBLIC 3), $A21A_MISMATCHES Abweichung(en)"
