# shellcheck shell=bash
#
# rls-matrix.d/spur-y-klaerung-a35.sh — Zeilen von 20261117_005_klaerungsliste.sql (A-35 Klaerungsliste – Server) fuer
# scripts/rls-role-matrix.sh. Per `source` eingebunden NACH spur-x-spiel-beenden.sh (Glob-Reihenfolge "spur-x" < "spur-y"),
# nutzt a27_sql (spur-geraete-a27.sh), perm_expected(), user_id_for_id(), role_for_id(), MATRIX_IDS.
#
# Vorbereitung je Probe (nie committete Transaktion, als Superuser): Spiel 41 mit zwei Teams im Turnier T_MAIN, ein
# Klaerungseintrag (Tor in match_events mit review_state 'pending' + Zeile in match_reviews, Grund CONTROL_LOST) und eine
# Zeile in field_control_log. Je Identitaet aus MATRIX_IDS (Erwartung aus rolePermissions.json, Recht leadMatches):
#   (i)   list_match_reviews(T_MAIN): mit Recht 1 Eintrag, sonst 0 (Helfer, Helfer-Geraet, Bildschirm, anonyme Sitzung,
#         Fremde, Trainer, Zuschauer -- @FU-038 „Ollis Klaerungsliste“);
#   (ii)  SELECT match_reviews: mit Recht 1, sonst 0 (RLS);
#   (iii) INSERT INTO match_reviews: fuer jede Identitaet 42501 (nur append_match_events schreibt);
#   (iv)  SELECT field_control_log: fuer jede Identitaet 42501 (keine Client-Rechte);
#   (v)   append_match_events REVIEW_DISCARD auf den Klaerungseintrag: mit Recht accepted, sonst rejected (@FU-038:
#         „Uebernehmen“/„Verwerfen“ nur die Turnierleitung).
# Dazu anon ohne Sitzung: list_match_reviews -> 42501, SELECT match_reviews -> 42501.
# Gegenprobe: --without-a35 (Tabellen und Funktion fehlen -> rot fuer die Turnierleitung).

KL_MISMATCHES=0
KL_CELLS=0
KL_TEAM_A="$(uuid_for kl-team:nord)"
KL_TEAM_B="$(uuid_for kl-team:sued)"
KL_MATCH="$(uuid_for kl-match:spiel-41)"
KL_PENDING="$(uuid_for kl-event:tor-tom)"
KL_SETUP="INSERT INTO public.teams (id, tournament_id, name) VALUES ('$KL_TEAM_A', '$T_MAIN', 'FC Nord'), ('$KL_TEAM_B', '$T_MAIN', 'SV Süd');
INSERT INTO public.matches (id, tournament_id, round, field, team_a_id, team_b_id, match_number, score_a, score_b)
VALUES ('$KL_MATCH', '$T_MAIN', 41, 41, '$KL_TEAM_A', '$KL_TEAM_B', 41, NULL, NULL);
INSERT INTO public.match_events (id, match_id, type, team_id, timestamp_seconds, payload, score_home, score_away, event_format,
                                 client_time, clock_ms, section, review_state)
VALUES ('$KL_PENDING', '$KL_MATCH', 'GOAL', '$KL_TEAM_A', 60, '{}'::jsonb, 0, 0, 1, now(), 60000, 1, 'pending');
INSERT INTO public.match_reviews (event_id, tournament_id, match_id, field, kind, reason, user_id, detail)
VALUES ('$KL_PENDING', '$T_MAIN', '$KL_MATCH', 41, 'review', 'CONTROL_LOST', '$(uuid_for user:collaborator)', '{\"timing\": \"after\"}'::jsonb);
INSERT INTO public.field_control_log (tournament_id, field, epoch, holder_user_id, claimed_at) VALUES ('$T_MAIN', 41, 1, NULL, now());"
KL_DISCARD="[{\"id\": \"$(uuid_for kl-event:verwerfen)\", \"type\": \"REVIEW_DISCARD\", \"at\": 2000, \"section\": null, \"clockMs\": null, \"targetId\": \"$KL_PENDING\", \"payload\": {}}]"

kl_cell() { # kl_cell <Name> <erhalten> <erwartet>
  KL_CELLS=$((KL_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); KL_MISMATCHES=$((KL_MISMATCHES + 1))
    printf 'kl   %-62s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

# kl_probe <rolle> <uid|leer> -> "list=..;sel=..;ins=..;log=..;disc=.."
KL_PROBE="DO \$kl\$
DECLARE r text := ''; v jsonb; n bigint;
BEGIN
  BEGIN v := public.list_match_reviews('$T_MAIN'); r := r || 'list=' || jsonb_array_length(v) || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'list=' || SQLSTATE || ';'; END;
  BEGIN SELECT count(*) INTO n FROM public.match_reviews WHERE tournament_id = '$T_MAIN'; r := r || 'sel=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'sel=' || SQLSTATE || ';'; END;
  BEGIN INSERT INTO public.match_reviews (event_id, tournament_id, match_id, kind, reason)
        VALUES ('$KL_PENDING', '$T_MAIN', '$KL_MATCH', 'review', 'AFTER_END'); r := r || 'ins=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'ins=' || SQLSTATE || ';'; END;
  BEGIN SELECT count(*) INTO n FROM public.field_control_log; r := r || 'log=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'log=' || SQLSTATE || ';'; END;
  BEGIN v := public.append_match_events('$KL_MATCH', \$J\$$KL_DISCARD\$J\$::jsonb, 1, NULL);
        r := r || 'disc=' || coalesce(v -> 'results' -> 0 ->> 'status', 'keine') || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'disc=' || SQLSTATE || ';'; END;
  RAISE NOTICE 'klergebnis:%', r;
END
\$kl\$;"
kl_probe() {
  local out
  out="$(a27_sql "$1" "$2" "$KL_PROBE" "$KL_SETUP")"
  (grep -m1 -o 'klergebnis:.*' <<<"$out" || echo "klergebnis:fehler $out") | sed 's/^klergebnis://'
}

for kl_id in "${MATRIX_IDS[@]}"; do
  kl_uid="$(user_id_for_id "$kl_id")"
  kl_allowed="$(perm_expected "$(role_for_id "$kl_id")" "leadMatches")"
  if [[ "$kl_allowed" == "true" ]]; then
    kl_exp="list=1;sel=1;ins=42501;log=42501;disc=accepted;"
  else
    # auch declined-membership (angenommen, dann entzogen, I-4): die Entscheidung wird glatt abgelehnt
    # (FORBIDDEN_ACTOR RIGHTS_REVOKED, Review #355 M3/D15) -- nie selbst ein Klaerungseintrag, nie angewendet
    kl_exp="list=0;sel=0;ins=42501;log=42501;disc=rejected;"
  fi
  kl_cell "@FU-038 Klaerungsliste lesen/schreiben/entscheiden $kl_id" "$(kl_probe authenticated "$kl_uid")" "$kl_exp"
done

# anon ohne Sitzung: weder Liste noch Tabelle
kl_got="$(kl_probe anon "")"
kl_cell "anon ohne Sitzung: list_match_reviews und match_reviews gesperrt" "$(cut -d';' -f1-2 <<<"$kl_got")" "list=42501;sel=42501"

echo "kl: $KL_CELLS Zellen geprueft (${#MATRIX_IDS[@]} Identitaeten + anon), $KL_MISMATCHES Abweichung(en)"
