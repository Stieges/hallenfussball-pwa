# shellcheck shell=bash
#
# rls-matrix.d/spur-gruppe-a13b.sh — Zeilen von A-13b-S (20261110_006_group_completion.sql, „Gruppe abschliessen“ am Server)
# fuer scripts/rls-role-matrix.sh (task-GA4-plan-v2.md § 8). Per `source` eingebunden NACH spur-geraete-a27.sh (Glob-
# Reihenfolge "spur-ge" < "spur-gr"), nutzt a27_sql (spur-geraete-a27.sh), claims_line(), perm_expected(), MATRIX_IDS.
#
# Je Identitaet aus MATRIX_IDS eine nie committete Transaktion gegen T_MAIN (Fixture: ein Abschluss, ein Verlaufseintrag,
# ein Folgen-Hinweis, eine Klaerung, als Superuser angelegt); Erwartung aus rolePermissions.json:
#   RPCs complete_group, reopen_group, record_standing_decision, resolve_bracket_notice, resolve_clarification:
#     mit manageLifecycle -> die Funktion antwortet (jsonb), sonst 42501 (auch Helfer, Bildschirm, anonyme Sitzung).
#   bracket_log_read: mit manageLifecycle Zeilen mit Namen, sonst 0 Zeilen (@TM-113, @W2A-071).
#   SELECT group_completions: sichtbar mit manageLifecycle oder writeMatchData (Helfer liest den Abschluss);
#   SELECT bracket_notices/clarifications: sichtbar nur mit manageLifecycle; SELECT bracket_log: fuer jede Identitaet 42501.
#   INSERT/UPDATE/DELETE auf die vier Tabellen: fuer jede Identitaet 42501 (nur der Server schreibt).
#   REST-UPDATE matches.reassigned_at: fuer jede Identitaet ohne Wirkung (42501 bzw. kein Update-Recht, Soll 13).
# Dazu anon (ohne Sitzung): kein EXECUTE auf die sechs RPCs, kein SELECT auf die vier Tabellen (@W2A-072), und der
# Eigentuemer per REST: tournaments.config mit geaenderten standingDecisions -> Zeile aktualisiert, Entscheidungen
# unveraendert (P-11, Soll 12). Gegenprobe: --without-a13bs (ohne Migration -> rot).

A13B_MISMATCHES=0
A13B_CELLS=0
A13B_TEAM_A="$(uuid_for a13b-team:fc-nord)"
A13B_TEAM_B="$(uuid_for a13b-team:sv-sued)"
A13B_SETUP="INSERT INTO public.teams (id, tournament_id, name, group_letter) VALUES ('$A13B_TEAM_A', '$T_MAIN', 'FC Nord', 'A'), ('$A13B_TEAM_B', '$T_MAIN', 'SV Süd', 'A');
INSERT INTO public.group_completions (tournament_id, group_id, ranking, completed_by, based_on_state)
VALUES ('$T_MAIN', 'A', ARRAY['$A13B_TEAM_A', '$A13B_TEAM_B']::uuid[], '$U_OWNER', '[]'::jsonb);
INSERT INTO public.bracket_log (tournament_id, group_id, kind, detail, actor) VALUES ('$T_MAIN', 'A', 'complete_group', '{}'::jsonb, '$U_OWNER');
INSERT INTO public.bracket_notices (id, tournament_id, match_id, side, kind, origin_team_id, current_team_id) OVERRIDING SYSTEM VALUE
VALUES (913001, '$T_MAIN', '$M_MAIN', 'A', 'manual_kept', '$A13B_TEAM_A', '$A13B_TEAM_B');
INSERT INTO public.clarifications (id, tournament_id, group_id, kind, requested, conflict_code, requested_by) OVERRIDING SYSTEM VALUE
VALUES (913002, '$T_MAIN', 'A', 'complete_group', '{}'::jsonb, 'STALE_VERSION', '$U_OWNER');
INSERT INTO public.profiles (id, display_name, email) VALUES ('$U_OWNER', 'Olli', 'owner@rls-matrix.test')
ON CONFLICT (id) DO UPDATE SET display_name = coalesce(nullif(btrim(public.profiles.display_name), ''), 'Olli');
UPDATE public.tournaments SET config = coalesce(config, '{}'::jsonb) || '{\"standingDecisions\": []}'::jsonb WHERE id = '$T_MAIN';"

a13b_cell() { # a13b_cell <Name> <erhalten> <erwartet>
  A13B_CELLS=$((A13B_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); A13B_MISMATCHES=$((A13B_MISMATCHES + 1))
    printf 'a13b %-62s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

# Ein DO-Block als die Identitaet: jede Probe in eigenem Ausnahmeblock; Ergebnis als NOTICE "a13b|k=v;k=v;..."
A13B_PROBE="DO \$a13b\$
DECLARE r text := ''; v text; n bigint;
BEGIN
  BEGIN SELECT count(*) || ':' || count(actor_name) INTO v FROM public.bracket_log_read('$T_MAIN'); r := r || 'bracket_log_read=' || v || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'bracket_log_read=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.complete_group('$T_MAIN', 'B', ARRAY['$A13B_TEAM_A']::uuid[], '{}', '[]', '{}', '[]', false); r := r || 'complete_group=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'complete_group=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.reopen_group('$T_MAIN', 'B', 'Grund', false); r := r || 'reopen_group=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'reopen_group=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.record_standing_decision('$T_MAIN', 'withdraw', '{\"id\": \"gibt-es-nicht\"}'::jsonb, NULL, 1); r := r || 'record_standing_decision=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'record_standing_decision=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.resolve_bracket_notice(913001); r := r || 'resolve_bracket_notice=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'resolve_bracket_notice=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.resolve_clarification(913002); r := r || 'resolve_clarification=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'resolve_clarification=' || SQLSTATE || ';'; END;
  BEGIN SELECT count(*) INTO n FROM public.group_completions WHERE tournament_id = '$T_MAIN'; r := r || 'sel_gc=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'sel_gc=' || SQLSTATE || ';'; END;
  BEGIN SELECT count(*) INTO n FROM public.bracket_notices WHERE tournament_id = '$T_MAIN'; r := r || 'sel_notices=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'sel_notices=' || SQLSTATE || ';'; END;
  BEGIN SELECT count(*) INTO n FROM public.clarifications WHERE tournament_id = '$T_MAIN'; r := r || 'sel_clar=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'sel_clar=' || SQLSTATE || ';'; END;
  BEGIN SELECT count(*) INTO n FROM public.bracket_log; r := r || 'sel_log=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'sel_log=' || SQLSTATE || ';'; END;
  BEGIN INSERT INTO public.group_completions (tournament_id, group_id, ranking, completed_by, based_on_state) VALUES ('$T_MAIN', 'Z', '{}', '$U_OWNER', '[]'); r := r || 'ins_gc=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'ins_gc=' || SQLSTATE || ';'; END;
  BEGIN UPDATE public.group_completions SET stale = true WHERE tournament_id = '$T_MAIN'; r := r || 'upd_gc=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'upd_gc=' || SQLSTATE || ';'; END;
  BEGIN DELETE FROM public.group_completions WHERE tournament_id = '$T_MAIN'; r := r || 'del_gc=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'del_gc=' || SQLSTATE || ';'; END;
  BEGIN INSERT INTO public.bracket_log (tournament_id, kind) VALUES ('$T_MAIN', 'complete_group'); r := r || 'ins_log=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'ins_log=' || SQLSTATE || ';'; END;
  BEGIN UPDATE public.bracket_log SET reason = 'x' WHERE tournament_id = '$T_MAIN'; r := r || 'upd_log=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'upd_log=' || SQLSTATE || ';'; END;
  BEGIN DELETE FROM public.bracket_log WHERE tournament_id = '$T_MAIN'; r := r || 'del_log=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'del_log=' || SQLSTATE || ';'; END;
  BEGIN INSERT INTO public.bracket_notices (tournament_id, match_id, side, kind) VALUES ('$T_MAIN', '$M_MAIN', 'B', 'released'); r := r || 'ins_notices=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'ins_notices=' || SQLSTATE || ';'; END;
  BEGIN UPDATE public.bracket_notices SET resolved_at = now() WHERE tournament_id = '$T_MAIN'; r := r || 'upd_notices=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'upd_notices=' || SQLSTATE || ';'; END;
  BEGIN DELETE FROM public.bracket_notices WHERE tournament_id = '$T_MAIN'; r := r || 'del_notices=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'del_notices=' || SQLSTATE || ';'; END;
  BEGIN INSERT INTO public.clarifications (tournament_id, kind, requested, conflict_code, requested_by) VALUES ('$T_MAIN', 'complete_group', '{}', 'STALE_VERSION', '$U_OWNER'); r := r || 'ins_clar=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'ins_clar=' || SQLSTATE || ';'; END;
  BEGIN UPDATE public.clarifications SET resolved_at = now() WHERE tournament_id = '$T_MAIN'; r := r || 'upd_clar=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'upd_clar=' || SQLSTATE || ';'; END;
  BEGIN DELETE FROM public.clarifications WHERE tournament_id = '$T_MAIN'; r := r || 'del_clar=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'del_clar=' || SQLSTATE || ';'; END;
  BEGIN UPDATE public.matches SET reassigned_at = now() WHERE id = '$M_MAIN'; GET DIAGNOSTICS n = ROW_COUNT; r := r || 'upd_reassigned=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'upd_reassigned=' || SQLSTATE || ';'; END;
  RAISE NOTICE 'a13b|%', r;
END
\$a13b\$;"

a13b_value() { # a13b_value <Ausgabe> <Schluessel>
  { grep -m1 -oE 'a13b\|[^ ]*' <<<"$1" || true; } | sed 's/^a13b|//' | tr ';' '\n' | awk -F= -v k="$2" '$1 == k {print substr($0, length(k) + 2); exit}'
}

for a13b_id in "${MATRIX_IDS[@]}"; do
  a13b_uid="$(user_id_for_id "$a13b_id")"
  a13b_role="$(role_for_id "$a13b_id")"
  a13b_lead="$(perm_expected "$a13b_role" manageLifecycle)"
  a13b_match="$(perm_expected "$a13b_role" writeMatchData)"
  a13b_out="$(a27_sql authenticated "$a13b_uid" "$A13B_PROBE" "$A13B_SETUP")"
  for rpc in complete_group reopen_group record_standing_decision resolve_bracket_notice resolve_clarification; do
    [[ "$a13b_lead" == "true" ]] && exp="ok" || exp="42501"
    a13b_cell "$rpc $a13b_id" "$(a13b_value "$a13b_out" "$rpc")" "$exp"
  done
  [[ "$a13b_lead" == "true" ]] && exp="1:1" || exp="0:0"
  a13b_cell "@TM-113 bracket_log_read $a13b_id (Zeilen:mit Namen)" "$(a13b_value "$a13b_out" bracket_log_read)" "$exp"
  [[ "$a13b_lead" == "true" || "$a13b_match" == "true" ]] && exp="1" || exp="0"
  a13b_cell "SELECT group_completions $a13b_id" "$(a13b_value "$a13b_out" sel_gc)" "$exp"
  [[ "$a13b_lead" == "true" ]] && exp="1" || exp="0"
  a13b_cell "SELECT bracket_notices $a13b_id" "$(a13b_value "$a13b_out" sel_notices)" "$exp"
  a13b_cell "SELECT clarifications $a13b_id" "$(a13b_value "$a13b_out" sel_clar)" "$exp"
  a13b_cell "@W2A-072 SELECT bracket_log $a13b_id (kein Tabellenrecht)" "$(a13b_value "$a13b_out" sel_log)" "42501"
  for op in ins upd del; do
    for tbl in gc log notices clar; do
      a13b_cell "$op $tbl $a13b_id (nur der Server schreibt)" "$(a13b_value "$a13b_out" "${op}_${tbl}")" "42501"
    done
  done
  a13b_got="$(a13b_value "$a13b_out" upd_reassigned)"
  [[ "$a13b_got" == "42501" || "$a13b_got" == "0" ]] && a13b_got="ohne-wirkung"
  a13b_cell "REST-UPDATE matches.reassigned_at $a13b_id" "$a13b_got" "ohne-wirkung"
done

# Ohne Sitzung (Rolle anon): kein EXECUTE, kein SELECT.
a13b_out="$(a27_sql anon "" "$A13B_PROBE" "$A13B_SETUP")"
for key in complete_group reopen_group record_standing_decision resolve_bracket_notice resolve_clarification bracket_log_read sel_gc sel_notices sel_clar sel_log; do
  a13b_cell "@W2A-072 anon $key" "$(a13b_value "$a13b_out" "$key")" "42501"
done

# P-11 (Soll 12): Voll-Speichern des Eigentuemers schreibt keine Entscheidungen, uebernimmt aber den Rest.
a13b_out="$(a27_sql authenticated "$U_OWNER" \
  "UPDATE public.tournaments SET config = jsonb_set(jsonb_set(config, '{standingDecisions}', '[{\"id\": \"per-rest\"}]'), '{placementsToPlayOut}', '[1,2]') WHERE id = '$T_MAIN';
   RESET ROLE;
   SELECT 'c:' || (config -> 'standingDecisions')::text || '|' || (config -> 'placementsToPlayOut')::text FROM public.tournaments WHERE id = '$T_MAIN';" \
  "$A13B_SETUP")"
a13b_cell "P-11 Eigentuemer REST config: standingDecisions bleibt, placementsToPlayOut uebernommen" \
  "$( (grep -m1 '^c:' <<<"$a13b_out" || echo "c:fehler $a13b_out") | cut -c3-)" "[]|[1, 2]"

# @W2A-050 (Eintragen ueber record_standing_decision: Olli/Maria gelingt, Tom/Zuschauer/anon 42501, REST-Gegenzeilen)
# steht gesammelt in rls-matrix.d/spur-a.sh (Review #330 S6).

echo "a13b: $A13B_CELLS Zellen geprueft (${#MATRIX_IDS[@]} Identitaeten x 23 + anon 10 + P-11 1), $A13B_MISMATCHES Abweichung(en)"
