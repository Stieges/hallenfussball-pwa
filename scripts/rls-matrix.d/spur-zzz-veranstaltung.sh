# shellcheck shell=bash
#
# rls-matrix.d/spur-zzz-veranstaltung.sh — Zeilen von 20261119_001_gatherings.sql (A1 Veranstaltung, @VA-011, @VA-021) fuer
# scripts/rls-role-matrix.sh. Per `source` eingebunden NACH spur-zz-*.sh (Glob-Reihenfolge), nutzt a27_sql
# (spur-geraete-a27.sh), user_id_for_id(), MATRIX_IDS und die Fixtures des Hauptskripts (T_MAIN gehoert U_OWNER, T_ANON der
# anonymen Sitzung owner-anonymous).
#
# Je Identitaet aus MATRIX_IDS (und anon ohne Sitzung) eine nie committete Transaktion; Vorbereitung als Superuser: Ollis
# Veranstaltung „MATRX1“ mit T_MAIN. Gemessen werden: Lesen gatherings / gathering_members, direktes INSERT in gatherings,
# direktes Umhaengen von tournaments.gathering_id, has_gathering_permission, rename/set (Loesen von T_MAIN)/create/delete
# und der oeffentliche Abruf. Nur der Eigentuemer mit echtem Konto aendert etwas; danach gehoert T_MAIN fuer alle anderen
# weiter zur Veranstaltung. Gegenprobe: --without-gatherings (Migration fehlt -> jede Zeile rot).

# Nur ohne die Migration zu messen, wenn das die Gegenprobe ist (--without-gatherings); fehlen ihre Voraussetzungen (andere
# Gegenproben), gibt es hier keine Zeilen.
if [[ "${WITH_GA:-0}" -ne 1 && "${WITH_GA_REQ:-1}" -eq 1 ]]; then
  echo "ga: uebersprungen (Voraussetzungen von 20261119_001 fehlen in diesem Modus)"
  return 0
fi
GA_MISMATCHES=0
GA_CELLS=0
GA_G="$(uuid_for gathering:matrix)"
GA_SETUP="INSERT INTO public.gatherings (id, owner_id, name, share_code) VALUES ('$GA_G', '$U_OWNER', 'Matrix-Veranstaltung', 'MATRX1');
UPDATE public.tournaments SET gathering_id = '$GA_G' WHERE id = '$T_MAIN';"

ga_cell() { # ga_cell <Name> <erhalten> <erwartet>
  GA_CELLS=$((GA_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); GA_MISMATCHES=$((GA_MISMATCHES + 1))
    printf 'ga %-58s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

GA_PROBE="DO \$ga\$
DECLARE r text := ''; n bigint; v jsonb;
BEGIN
  BEGIN SELECT count(*) INTO n FROM public.gatherings; r := r || 'read=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'read=' || SQLSTATE || ';'; END;
  BEGIN SELECT count(*) INTO n FROM public.gathering_members; r := r || 'mem=' || n || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'mem=' || SQLSTATE || ';'; END;
  BEGIN INSERT INTO public.gatherings (owner_id, name, share_code) VALUES (coalesce(auth.uid(), '$U_OWNER'), 'Direkt', 'DIREKT');
        r := r || 'ins=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'ins=' || SQLSTATE || ';'; END;
  BEGIN UPDATE public.tournaments SET gathering_id = NULL WHERE id = '$T_MAIN'; GET DIAGNOSTICS n = ROW_COUNT;
        r := r || 'direct=' || CASE WHEN n = 0 THEN 'abgelehnt' ELSE 'rows' || n END || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'direct=' || CASE WHEN SQLSTATE IN ('HF006', '42501') THEN 'abgelehnt' ELSE SQLSTATE END || ';'; END;
  BEGIN r := r || 'perm=' || public.has_gathering_permission('$GA_G', 'assignTournaments')::text || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'perm=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.rename_gathering('$GA_G', 'Umbenannt'); r := r || 'rename=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'rename=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.set_gathering_tournaments('$GA_G', '{}'::uuid[], ARRAY['$T_MAIN']::uuid[]); r := r || 'set=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'set=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.create_gathering('Eigene Veranstaltung'); r := r || 'create=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'create=' || SQLSTATE || ';'; END;
  BEGIN v := public.public_gathering('MATRX1'); r := r || 'pub=' || CASE WHEN v ? 'state' THEN 'ok' ELSE 'leer' END || ';';
  EXCEPTION WHEN OTHERS THEN r := r || 'pub=' || SQLSTATE || ';'; END;
  BEGIN PERFORM public.delete_gathering('$GA_G'); r := r || 'delete=ok;';
  EXCEPTION WHEN OTHERS THEN r := r || 'delete=' || SQLSTATE || ';'; END;
  RAISE NOTICE 'gaergebnis:%', r;
END
\$ga\$;
RESET ROLE;
SELECT 'gafinal:' || coalesce((SELECT gathering_id::text FROM public.tournaments WHERE id = '$T_MAIN'), 'NULL');"

ga_probe() { # ga_probe <rolle> <uid|leer> -> "<ergebnis>final=<gathering_id|NULL>"
  local out
  out="$(a27_sql "$1" "$2" "$GA_PROBE" "$GA_SETUP")"
  echo "$( (grep -m1 -o 'gaergebnis:.*' <<<"$out" || echo "gaergebnis:fehler $out") | sed 's/^gaergebnis://')final=$( (grep -m1 -o 'gafinal:.*' <<<"$out" || echo 'gafinal:?') | sed 's/^gafinal://')"
}

ga_expected() { # Erwartung aus dem Gherkin (@VA-011: nur der Eigentuemer; create: jedes echte Konto)
  local others="read=0;mem=42501;ins=42501;direct=abgelehnt;perm=false;rename=HF006;set=HF006"
  case "$1" in
    owner) echo "read=1;mem=42501;ins=42501;direct=abgelehnt;perm=true;rename=ok;set=ok;create=ok;pub=ok;delete=ok;final=NULL" ;;
    owner-anonymous|anon-device|helper-device|screen-device) echo "$others;create=HF006;pub=ok;delete=HF006;final=$GA_G" ;;
    anon) echo "read=42501;mem=42501;ins=42501;direct=abgelehnt;perm=42501;rename=42501;set=42501;create=42501;pub=ok;delete=42501;final=$GA_G" ;;
    *) echo "$others;create=ok;pub=ok;delete=HF006;final=$GA_G" ;;
  esac
}

for ga_id in "${MATRIX_IDS[@]}"; do
  ga_cell "@VA-011 @VA-021 Veranstaltung: $ga_id" "$(ga_probe authenticated "$(user_id_for_id "$ga_id")")" "$(ga_expected "$ga_id")"
done
ga_cell "@VA-011 @VA-021 Veranstaltung: anon ohne Sitzung" "$(ga_probe anon "")" "$(ga_expected anon)"

echo "ga: $GA_CELLS Zellen geprueft (${#MATRIX_IDS[@]} Identitaeten + anon), $GA_MISMATCHES Abweichung(en)"
