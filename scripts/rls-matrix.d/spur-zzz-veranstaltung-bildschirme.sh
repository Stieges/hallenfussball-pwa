# shellcheck shell=bash
#
# rls-matrix.d/spur-zzz-veranstaltung-bildschirme.sh — Zeilen von 20261122_001_gathering_screens.sql (A1b Monitore der
# Veranstaltung, @VA-034, @VA-037, @VA-040, @VA-043) fuer scripts/rls-role-matrix.sh. Per `source` eingebunden, nutzt a27_sql
# (spur-geraete-a27.sh), user_id_for_id(), MATRIX_IDS und die Fixtures des Hauptskripts (T_MAIN gehoert U_OWNER, Co-Admin
# U_COADMIN).
#
# Je Identitaet aus MATRIX_IDS (und anon ohne Sitzung) eine nie committete Transaktion; Vorbereitung als Superuser: Ollis
# Veranstaltung „MATRX2“ mit T_MAIN (festgelegt, Ort „Halle“) und einem Bildschirm. Gemessen werden: Lesen und direktes
# Schreiben von gathering_screens, Lesen der neuen Spalte, Bildschirm anlegen, Ort setzen, Bildschirm-Abfrage per Schluessel
# und per Code, Status, Uebersicht, „Auf die Bildschirme“, Schluessel erneuern und das Turnier in der Halle danach.
# Einrichten nur der Eigentuemer mit echtem Konto (E8), umschalten Eigentuemer und Co-Admin (@VA-037), lesen per Schluessel
# jeder (der Schluessel ist die Berechtigung), nie per Code (@VA-043). Gegenprobe: --without-gathering-screens.

if [[ "${WITH_GS:-0}" -ne 1 && "${WITH_GS_REQ:-1}" -eq 1 ]]; then
  echo "gs: uebersprungen (Voraussetzungen von 20261122_001 fehlen in diesem Modus)"
  return 0
fi
GS_MISMATCHES=0
GS_CELLS=0
GS_G="$(uuid_for gathering:matrix-bildschirme)"
GS_SCREEN="$(uuid_for screen:matrix)"
GS_KEY="$(printf '%s' "rls-matrix:screen-key" | shasum -a 256 | cut -c1-32)"
GS_SETUP="INSERT INTO public.gatherings (id, owner_id, name, share_code) VALUES ('$GS_G', '$U_OWNER', 'Matrix-Bildschirme', 'MATRX2');
UPDATE public.tournaments SET gathering_id = '$GS_G', status = 'published', location_name = 'Halle' WHERE id = '$T_MAIN';
UPDATE public.gatherings SET screen_location_name = 'Halle' WHERE id = '$GS_G';
INSERT INTO public.gathering_screens (id, gathering_id, name, screen_key) VALUES ('$GS_SCREEN', '$GS_G', 'Halle', '$GS_KEY');"

gs_cell() { # gs_cell <Name> <erhalten> <erwartet>
  GS_CELLS=$((GS_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); GS_MISMATCHES=$((GS_MISMATCHES + 1))
    printf 'gs %-58s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

GS_PROBE="DO \$gs\$
DECLARE r text := ''; n bigint; v jsonb;
BEGIN
  BEGIN SELECT count(*) INTO n FROM public.gathering_screens; r := r || 'read=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'read=' || SQLSTATE || ';'; END;
  BEGIN INSERT INTO public.gathering_screens (gathering_id, name, screen_key) VALUES ('$GS_G', 'Direkt', repeat('a', 32));
        r := r || 'ins=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'ins=' || SQLSTATE || ';'; END;
  BEGIN SELECT count(*) INTO n FROM public.gatherings WHERE on_screen_tournament_id IS NULL AND id = '$GS_G'; r := r || 'col=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'col=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.create_gathering_screen('$GS_G', 'Eingang', '{}', '[]'); r := r || 'create=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'create=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.set_gathering_screen_location('$GS_G', 'Halle'); r := r || 'loc=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'loc=' || SQLSTATE || ';'; END;
  BEGIN v := public.gathering_screen_display('$GS_KEY'); r := r || 'disp=' || coalesce(v ->> 'state', 'leer') || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'disp=' || SQLSTATE || ';'; END;
  BEGIN v := public.gathering_screen_display('MATRX2'); r := r || 'code=' || coalesce(v ->> 'state', 'leer') || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'code=' || SQLSTATE || ';'; END;
  BEGIN v := public.gathering_screen_status('$T_MAIN'); r := r || 'status=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'status=' || SQLSTATE || ';'; END;
  BEGIN v := public.gathering_screens_overview('$GS_G'); r := r || 'overview=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'overview=' || SQLSTATE || ';'; END;
  BEGIN v := public.set_gathering_on_screen('$T_MAIN', true); r := r || 'on=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'on=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.rotate_gathering_screen_key('$GS_SCREEN'); r := r || 'rotate=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'rotate=' || SQLSTATE || ';'; END;
  RAISE NOTICE 'gsergebnis:%', r;
END
\$gs\$;
RESET ROLE;
SELECT 'gsfinal:' || coalesce((SELECT on_screen_tournament_id::text FROM public.gatherings WHERE id = '$GS_G'), 'NULL')
       || ':' || (SELECT CASE WHEN screen_key = '$GS_KEY' THEN 'alt' ELSE 'neu' END FROM public.gathering_screens WHERE id = '$GS_SCREEN');"

gs_probe() { # gs_probe <rolle> <uid|leer> -> "<ergebnis>final=<turnier|NULL>:<alt|neu>"
  local out
  out="$(a27_sql "$1" "$2" "$GS_PROBE" "$GS_SETUP")"
  echo "$( (grep -m1 -o 'gsergebnis:.*' <<<"$out" || echo "gsergebnis:fehler $out") | sed 's/^gsergebnis://')final=$( (grep -m1 -o 'gsfinal:.*' <<<"$out" || echo 'gsfinal:?') | sed 's/^gsfinal://')"
}

gs_expected() { # Erwartung aus dem Gherkin (E8: einrichten nur der Eigentuemer; @VA-037: umschalten Eigentuemer und Co-Admin)
  local base="read=42501;ins=42501;col=0"
  case "$1" in
    owner) echo "read=42501;ins=42501;col=1;create=ok;loc=ok;disp=gathering;code=invalid;status=ok;overview=ok;on=ok;rotate=ok;final=$T_MAIN:neu" ;;
    co-admin) echo "$base;create=HF006;loc=HF006;disp=gathering;code=invalid;status=ok;overview=HF006;on=ok;rotate=HF006;final=$T_MAIN:alt" ;;
    anon) echo "read=42501;ins=42501;col=42501;create=42501;loc=42501;disp=gathering;code=invalid;status=42501;overview=42501;on=42501;rotate=42501;final=NULL:alt" ;;
    *) echo "$base;create=HF006;loc=HF006;disp=gathering;code=invalid;status=HF006;overview=HF006;on=HF006;rotate=HF006;final=NULL:alt" ;;
  esac
}

for gs_id in "${MATRIX_IDS[@]}"; do
  gs_cell "@VA-034 @VA-037 Bildschirme: $gs_id" "$(gs_probe authenticated "$(user_id_for_id "$gs_id")")" "$(gs_expected "$gs_id")"
done
gs_cell "@VA-043 Bildschirme: anon ohne Sitzung" "$(gs_probe anon "")" "$(gs_expected anon)"

echo "gs: $GS_CELLS Zellen geprueft (${#MATRIX_IDS[@]} Identitaeten + anon), $GS_MISMATCHES Abweichung(en)"
