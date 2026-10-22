# shellcheck shell=bash
#
# rls-matrix.d/spur-wertung-a25.sh — Zeilen von A-25b (20261110_005_result_entry_forfeit.sql, Nichtantritt-Wertung) fuer
# scripts/rls-role-matrix.sh. Per `source` eingebunden NACH spur-geraete-a27.sh und spur-steuer-a34.sh (Glob-Reihenfolge
# "spur-g" < "spur-s" < "spur-w"), nutzt a27_sql (spur-geraete-a27.sh) und claims_line() (anonyme Geraetesitzungen).
#
# Je Identitaet aus MATRIX_IDS (Erwartung aus rolePermissions.json, Recht leadMatches wie fuer jeden Direkteintrag):
#   (i)  append_match_events RESULT_ENTRY {scores 0:2, forfeit {absent A}} auf ein geplantes Spiel (@W2A-022)
#        -> mit Recht "accepted|forfeit|A" (gewertet, Fehlender A), sonst "rejected:FORBIDDEN_ACTOR|-|-";
#   (ii) REST-UPDATE matches.forfeit_absent auf einem gewerteten Spiel -> fuer JEDE Identitaet unveraendert (Spaltenschutz
#        bzw. kein Update-Recht; auch Eigentuemer und Co-Admin schreiben die Spalte nie selbst).
# Dazu anon (ohne Sitzung): append_match_events nicht ausfuehrbar. Jede Probe in einer nie committeten Transaktion.
# Gegenprobe: --without-a25b (ohne Migration keine Wertung, keine Spalte -> rot).

A25B_MISMATCHES=0
A25B_CELLS=0
A25B_TEAM_C="$(uuid_for a25b-team:c)"
A25B_TEAM_D="$(uuid_for a25b-team:d)"
A25B_MATCH="$(uuid_for a25b-match:c-d)"
A25B_SETUP="INSERT INTO public.teams (id, tournament_id, name) VALUES ('$A25B_TEAM_C', '$T_MAIN', 'Team C'), ('$A25B_TEAM_D', '$T_MAIN', 'Team D');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, score_a, score_b)
VALUES ('$A25B_MATCH', '$T_MAIN', 9, 3, '$A25B_TEAM_C', '$A25B_TEAM_D', 90, NULL, NULL);"
# Gewertetes Spiel fuer (ii): Zwischenspeicher wie nach der Wertung (als Superuser, der Spalten-Schutz gilt nur Clients).
A25B_SETUP_FORFEIT="$A25B_SETUP
UPDATE public.matches SET score_a = 0, score_b = 2, match_status = 'finished', decided_by = 'forfeit', forfeit_absent = 'A'
 WHERE id = '$A25B_MATCH';"

a25b_cell() { # a25b_cell <Name> <erhalten> <erwartet>
  A25B_CELLS=$((A25B_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); A25B_MISMATCHES=$((A25B_MISMATCHES + 1))
    printf 'a25b %-60s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

A25B_EVENTS="[{\"id\": \"$(uuid_for a25b-event:wertung)\", \"type\": \"RESULT_ENTRY\", \"at\": 1000, \"section\": null, \"clockMs\": null, \"payload\": {\"scores\": {\"$A25B_TEAM_C\": 0, \"$A25B_TEAM_D\": 2}, \"forfeit\": {\"absent\": \"A\"}}}]"

for a25b_id in "${MATRIX_IDS[@]}"; do
  a25b_uid="$(user_id_for_id "$a25b_id")"
  a25b_allowed="$(perm_expected "$(role_for_id "$a25b_id")" "leadMatches")"

  # (i) Wertung ueber den Schreibweg
  a25b_out="$(a27_sql authenticated "$a25b_uid" \
    "SELECT 'r:' || coalesce((x -> 'results' -> 0 ->> 'status') || coalesce(':' || (x -> 'results' -> 0 ->> 'code'), ''), x::text)
       FROM public.append_match_events('$A25B_MATCH', \$J\$$A25B_EVENTS\$J\$::jsonb, 1, NULL) AS x;
     RESET ROLE;
     SELECT 'c:' || coalesce(decided_by, '-') || '|' || coalesce(forfeit_absent, '-') FROM public.matches WHERE id = '$A25B_MATCH';" \
    "$A25B_SETUP")"
  a25b_got="$( (grep -m1 '^r:' <<<"$a25b_out" || echo "r:fehler") | cut -c3-)|$( (grep -m1 '^c:' <<<"$a25b_out" || echo "c:fehler") | cut -c3-)"
  [[ "$a25b_allowed" == "true" ]] && a25b_exp="accepted|forfeit|A" || a25b_exp="rejected:FORBIDDEN_ACTOR|-|-"
  # A-35 (I-4, @FU-017): ein angenommenes, dann entzogenes Mitglied bekommt seine Eintraege zur Klaerung (zaehlt nicht).
  if [[ "${WITH_A35:-0}" -eq 1 && "$a25b_id" == "declined-membership" ]]; then a25b_exp="review:RIGHTS_REVOKED|-|-"; fi
  a25b_cell "@W2A-022 Wertung (append_match_events) $a25b_id" "$a25b_got" "$a25b_exp"

  # (ii) Spalte direkt
  # Fehler (Spalten-Schutz 42501) oder 0 Zeilen (kein Update-Recht) -> Wert bleibt 'A'; geprueft als Superuser danach.
  a25b_out="$(a27_sql authenticated "$a25b_uid" \
    "UPDATE public.matches SET forfeit_absent = 'B' WHERE id = '$A25B_MATCH';
     RESET ROLE;
     SELECT 'v:' || coalesce(forfeit_absent, '-') FROM public.matches WHERE id = '$A25B_MATCH';" "$A25B_SETUP_FORFEIT")"
  if grep -qE 'ERROR: .*(permission denied|Nicht erlaubt)' <<<"$a25b_out" || [[ "$(grep -m1 '^v:' <<<"$a25b_out" || true)" == "v:A" ]]; then
    a25b_got="unveraendert"
  else
    a25b_got="geschrieben:$(tr '\n' ' ' <<<"$a25b_out")"
  fi
  a25b_cell "forfeit_absent REST-UPDATE $a25b_id" "$a25b_got" "unveraendert"
done

# Ohne Sitzung (Rolle anon): kein EXECUTE auf den Schreibweg.
a25b_out="$(a27_sql anon "" "SELECT public.append_match_events('$A25B_MATCH', '[]'::jsonb, 1, NULL);" "$A25B_SETUP")"
a25b_cell "append_match_events anon (ohne Sitzung)" "$(grep -qE 'permission denied' <<<"$a25b_out" && echo fehler || echo "zugriff:$a25b_out")" "fehler"

echo "a25b: $A25B_CELLS Zellen geprueft (${#MATRIX_IDS[@]} Identitaeten x 2 + anon), $A25B_MISMATCHES Abweichung(en)"
