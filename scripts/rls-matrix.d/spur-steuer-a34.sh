# shellcheck shell=bash
#
# rls-matrix.d/spur-steuer-a34.sh — Zeilen von A-34 (brief-A-34.md, 20261110_003_field_control.sql) fuer
# scripts/rls-role-matrix.sh. Per `source` eingebunden NACH spur-geraete-a27.sh (Glob-Reihenfolge "spur-g" < "spur-s"),
# nutzt a27_sql/a11_mark und claims_line() (anonyme Geraetesitzungen tragen is_anonymous).
#
# Je Identitaet aus MATRIX_IDS (Erwartung aus rolePermissions.json, Recht writeMatchData, wie fuer Eintraege):
#   (i)   take_field_control(T_MAIN, Feld 1, eigene Geraete-ID) -> "taken" mit Recht, sonst "rejected:FORBIDDEN_ACTOR"
#         (@FU-027 Uebernahme durch Turnierleitung und Helfer; Trainer, Zuschauer, Fremde, Bildschirm, Geraet ohne
#         Rolle nie);
#   (ii)  field_control_state(T_MAIN) mit einem gesteuerten Feld -> 1 Feld mit Recht, sonst 0 (@HE-049);
#   (iii) Tabelle field_control direkt (SELECT, UPDATE) -> immer Fehler (nur Definer-Funktionen).
# Jede Probe in einer nie committeten Transaktion. Gegenprobe: --without-a34 (Funktionen/Tabelle fehlen -> rot).

A34_RIGHT="writeMatchData"
A34_MISMATCHES=0
A34_CELLS=0
A34_SETUP_ROW="INSERT INTO public.field_control (tournament_id, field, epoch, holder_user_id, holder_device_id, holder_device_label)
VALUES ('$T_MAIN', 1, 1, '$U_OWNER', '$(uuid_for a34-device:owner)', 'Tablet');"

a34_cell() { # a34_cell <Name> <erhalten> <erwartet>
  A34_CELLS=$((A34_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); A34_MISMATCHES=$((A34_MISMATCHES + 1))
    printf 'a34 %-62s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

for a34_id in "${MATRIX_IDS[@]}"; do
  a34_uid="$(user_id_for_id "$a34_id")"
  a34_dev="$(uuid_for "a34-device:$a34_id")"
  a34_allowed="$(perm_expected "$(role_for_id "$a34_id")" "$A34_RIGHT")"

  # (i) Uebernahme
  a34_out="$(a27_sql authenticated "$a34_uid" \
    "SELECT 'r:' || (x ->> 'status') || coalesce(':' || (x ->> 'code'), '') FROM public.take_field_control('$T_MAIN', 1, '$a34_dev', NULL, NULL) AS x;")"
  a34_got="$( (grep -m1 '^r:' <<<"$a34_out" || echo "r:fehler") | cut -c3-)"
  [[ "$a34_allowed" == "true" ]] && a34_exp="taken" || a34_exp="rejected:FORBIDDEN_ACTOR"
  a34_cell "@FU-027 take_field_control $a34_id" "$a34_got" "$a34_exp"

  # (ii) Stand lesen (ein Feld wird von Olli gesteuert)
  a34_out="$(a27_sql authenticated "$a34_uid" \
    "SELECT 's:' || jsonb_array_length(public.field_control_state('$T_MAIN', '$a34_dev'));" "$A34_SETUP_ROW")"
  a34_got="$( (grep -m1 '^s:' <<<"$a34_out" || echo "s:fehler") | cut -c3-)"
  [[ "$a34_allowed" == "true" ]] && a34_exp="1" || a34_exp="0"
  a34_cell "@HE-049 field_control_state $a34_id" "$a34_got" "$a34_exp"

  # (iii) Tabelle direkt
  a34_out="$(a27_sql authenticated "$a34_uid" "SELECT 't:' || count(*) FROM public.field_control;" "$A34_SETUP_ROW")"
  a34_cell "Tabelle field_control SELECT $a34_id" "$(grep -qE 'permission denied' <<<"$a34_out" && echo fehler || echo "zugriff:$a34_out")" "fehler"
  a34_out="$(a27_sql authenticated "$a34_uid" \
    "UPDATE public.field_control SET holder_user_id = '$a34_uid', holder_device_id = '$a34_dev' WHERE tournament_id = '$T_MAIN';" "$A34_SETUP_ROW")"
  a34_cell "Tabelle field_control UPDATE $a34_id" "$(grep -qE 'permission denied' <<<"$a34_out" && echo fehler || echo "zugriff:$a34_out")" "fehler"
done

# Ohne Sitzung (Rolle anon, Mama Petra): weder Uebernahme noch Stand noch Tabelle.
a34_out="$(a27_sql anon "" "SELECT public.take_field_control('$T_MAIN', 1, '$(uuid_for a34-device:anon)', NULL, NULL);")"
a34_cell "take_field_control anon (ohne Sitzung)" "$(grep -qE 'permission denied' <<<"$a34_out" && echo fehler || echo "zugriff:$a34_out")" "fehler"
a34_out="$(a27_sql anon "" "SELECT public.field_control_state('$T_MAIN', NULL);")"
a34_cell "field_control_state anon (ohne Sitzung)" "$(grep -qE 'permission denied' <<<"$a34_out" && echo fehler || echo "zugriff:$a34_out")" "fehler"
a34_out="$(a27_sql anon "" "SELECT count(*) FROM public.field_control;")"
a34_cell "Tabelle field_control SELECT anon" "$(grep -qE 'permission denied' <<<"$a34_out" && echo fehler || echo "zugriff:$a34_out")" "fehler"

echo "a34-steuer: $A34_CELLS Zellen geprueft (${#MATRIX_IDS[@]} Identitaeten x 4 + 3 anon), $A34_MISMATCHES Abweichung(en)"
