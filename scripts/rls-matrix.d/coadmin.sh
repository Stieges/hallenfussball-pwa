# shellcheck shell=bash
#
# rls-matrix.d/coadmin.sh — Zeilen von CA-2 (plan-coadmin-einsatzfaehig.md § CA-2, review-plan-coadmin.md Auflagen 3-5;
# 20261110_004_coadmin_einsatz.sql) fuer scripts/rls-role-matrix.sh. Per `source` eingebunden; die Datei ist in sich
# geschlossen (eigene Hilfe ca2_probe) und nutzt nur das Hauptskript (MATRIX_IDS, user_id_for_id, role_for_id,
# perm_expected, claims_line, uuid_for, T_MAIN/T_ANON, MONITOR_MAIN/MONITOR_ANON, TOTAL/MISMATCHES) -- deshalb ist die
# Glob-Reihenfolge gegenueber _hilfen.sh und spur-*.sh egal. Jede Probe laeuft in einer nie committeten Transaktion,
# der Ausgangszustand wird darin als Superuser gesetzt (T_MAIN freigegeben, nicht oeffentlich, ohne Code; je ein
# Lebenszeichen in T_MAIN und im Nachbarturnier T_ANON).
#
# Erwartung aus rolePermissions.json (nicht aus dem Code): die drei RPCs nach tournamentSettings, Lebenszeichen lesen
# nach manageScreens; Eigentuemer immer; anonyme Sitzungen (A-27) nie, auch nicht als Eigentuemer (owner-anonymous,
# gegen das eigene Turnier T_ANON, dafuer mit publishedAt) und nicht mit Altbestand-Zeile co-admin (anon-coadmin).
# Je Identitaet (@HE-085, NEU-CA3 "Wer das Turnier online teilen darf", NEU-CA5 "Wer den Verbindungsstatus der
# Monitore sieht"):
#   (i)   make_tournament_public  -> "gelingt" (Code im Serveralphabet, is_public, Zeitpunkt gesetzt) bzw.
#         "abgelehnt" (Not authorized, Turnierzeile unveraendert -- Vorher/Nachher als Superuser)
#   (ii)  make_tournament_private (Turnier oeffentlich mit Code) -> gelingt (Code weg) bzw. abgelehnt (unveraendert)
#   (iii) regenerate_share_code   (Turnier oeffentlich mit Code) -> gelingt (neuer Code) bzw. abgelehnt (unveraendert)
#   (iv)  monitor_heartbeats lesen -> 1 Zeile des eigenen Turniers bzw. 0; (v) Nachbarturnier immer 0.
# Dazu: anon ohne Sitzung (alle fuenf abgelehnt), Entwurf (HF001, @NEU-CA3-Gegenbeispiel), Code bleibt beim erneuten
# Teilen (Auflage 5), regenerate_share_code auf nicht oeffentlichem Turnier erzeugt einen Code (Bestand, Auflage 4).
# Gegenprobe: scripts/rls-role-matrix.sh --without-coadmin (ohne 20261110_004) -> Co-Admin- und owner-anonymous-Zeilen
# sowie "Code bleibt" zeigen die alten Werte (rot).

CA2_MISMATCHES=0
CA2_CELLS=0
CA2_CODE="QWERTZ"                        # vorhandener Code (Serveralphabet, ohne 0/O/1/I)
CA2_CODE_AT="2026-10-01 12:00:00+00"     # sein Zeitpunkt
CA2_ALPHABET_RE='^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'

# Ausgangszustand je Probe (Superuser, nie committet): beide Turniere freigegeben, nicht oeffentlich, ohne Code;
# Lebenszeichen fuer den Monitor in T_MAIN und im Nachbarturnier T_ANON.
CA2_BASE="UPDATE public.tournaments SET is_public = false, share_code = NULL, share_code_created_at = NULL,
       config = coalesce(config, '{}'::jsonb) || '{\"publishedAt\":\"2026-09-22T00:00:00.000Z\"}'::jsonb
 WHERE id IN ('$T_MAIN', '$T_ANON');
INSERT INTO public.monitor_heartbeats (monitor_id, tournament_id, last_seen, slide_index, user_agent)
VALUES ('$MONITOR_MAIN', '$T_MAIN', now(), 1, 'ca2-matrix'), ('$MONITOR_ANON', '$T_ANON', now(), 1, 'ca2-matrix');"
ca2_public_setup() { # Turnier $1 ist schon oeffentlich mit CA2_CODE
  echo "UPDATE public.tournaments SET is_public = true, share_code = '$CA2_CODE', share_code_created_at = '$CA2_CODE_AT' WHERE id = '$1';"
}
ca2_row() { # Turnierzeile als Superuser: is_public|share_code|Zeitpunkt (NULL/alt/neu)
  echo "SELECT t.is_public || '|' || coalesce(t.share_code, 'NULL') || '|' || CASE WHEN t.share_code_created_at IS NULL THEN 'NULL' WHEN t.share_code_created_at = '$CA2_CODE_AT'::timestamptz THEN 'alt' ELSE 'neu' END FROM public.tournaments t WHERE t.id = '$1'"
}

# ca2_probe <client-rolle authenticated|anon> <uid oder leer> <vorbereitung> <aktion (gibt "r:..." aus)> <pruef-SQL>
# -> "<ergebnis oder fehler:text>|<pruefwert als Superuser nach der Aktion>"
ca2_probe() {
  local role="$1" uid="$2" setup="$3" action="$4" check_sql="$5" sub_line="" out res msg chk
  [[ -n "$uid" ]] && sub_line="SET LOCAL request.jwt.claim.sub = '$uid'; $(claims_line "$uid")"
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 <<SQL 2>&1
BEGIN;
$CA2_BASE
$setup
SET LOCAL ROLE $role;
$sub_line
SAVEPOINT ca2_aktion;
$action
\\if :ERROR
ROLLBACK TO SAVEPOINT ca2_aktion;
\\endif
RESET ROLE;
SELECT 'p:' || coalesce(($check_sql)::text, 'NULL');
ROLLBACK;
SQL
)"
  set -e
  res="$( (grep -m1 '^r:' <<<"$out" || true) | cut -c3-)"
  msg="$( (grep -m1 'ERROR:' <<<"$out" || true) | sed 's/^.*ERROR: *//')"
  chk="$( (grep -m1 '^p:' <<<"$out" || true) | cut -c3-)"
  [[ -n "$msg" ]] && res="fehler:$msg"
  echo "${res:-?}|${chk:-?}"
}

ca2_cell() { # ca2_cell <Name> <erhalten> <erwartet>
  CA2_CELLS=$((CA2_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" == "$3" ]]; then
    printf 'ca2 %-66s: %s\n' "$1" "$2"
  else
    MISMATCHES=$((MISMATCHES + 1)); CA2_MISMATCHES=$((CA2_MISMATCHES + 1))
    printf 'ca2 %-66s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

# Urteile: "gelingt" nur mit dem erwarteten Ergebnis UND dem erwarteten Wert danach; "abgelehnt" nur mit
# "Not authorized" (bzw. bei anon "permission denied") UND unveraenderter Zeile. Alles andere zeigt die Rohwerte.
ca2_verdict_public() { # <probe> -- vorher: nicht oeffentlich, ohne Code
  local res="${1%%|*}" chk="${1#*|}"
  if [[ "$res" =~ $CA2_ALPHABET_RE && "$chk" == "true|$res|neu" ]]; then echo "gelingt"
  elif [[ "$res" == "fehler:Not authorized to modify this tournament" && "$chk" == "false|NULL|NULL" ]]; then echo "abgelehnt"
  else echo "anders($1)"; fi
}
ca2_verdict_private() { # vorher: oeffentlich mit CA2_CODE
  local res="${1%%|*}" chk="${1#*|}"
  if [[ "$res" == "ok" && "$chk" == "false|NULL|NULL" ]]; then echo "gelingt"
  elif [[ "$res" == "fehler:Not authorized to modify this tournament" && "$chk" == "true|$CA2_CODE|alt" ]]; then echo "abgelehnt"
  else echo "anders($1)"; fi
}
ca2_verdict_regenerate() { # vorher: oeffentlich mit CA2_CODE
  local res="${1%%|*}" chk="${1#*|}"
  if [[ "$res" =~ $CA2_ALPHABET_RE && "$res" != "$CA2_CODE" && "$chk" == "true|$res|neu" ]]; then echo "gelingt"
  elif [[ "$res" == "fehler:Not authorized to modify this tournament" && "$chk" == "true|$CA2_CODE|alt" ]]; then echo "abgelehnt"
  else echo "anders($1)"; fi
}
ca2_verdict_read() { # <probe> -- Zahl der sichtbaren Zeilen; anon ohne Tabellenrecht zaehlt als 0
  local res="${1%%|*}"
  [[ "$res" == fehler:permission\ denied* ]] && res="0"
  echo "$res"
}

CA2_PUBLIC_ACTION() { echo "SELECT 'r:' || x.share_code FROM public.make_tournament_public('$1') AS x;"; }
CA2_PRIVATE_ACTION() { echo "SELECT 'r:ok' FROM (SELECT public.make_tournament_private('$1')) AS x;"; }
CA2_REGENERATE_ACTION() { echo "SELECT 'r:' || x.share_code FROM public.regenerate_share_code('$1') AS x;"; }
CA2_READ_ACTION() { echo "SELECT 'r:' || count(*) FROM public.monitor_heartbeats WHERE tournament_id = '$1';"; }

for ca2_id in "${MATRIX_IDS[@]}" anon-coadmin; do
  ca2_uid="$(user_id_for_id "$ca2_id")"
  if [[ "$ca2_id" == "anon-coadmin" ]]; then
    ca2_settings="false"; ca2_screens="false"   # Altbestand-Zeile co-admin zaehlt anonym nicht (A-27)
  else
    ca2_settings="$(perm_expected "$(role_for_id "$ca2_id")" tournamentSettings)"
    ca2_screens="$(perm_expected "$(role_for_id "$ca2_id")" manageScreens)"
  fi
  # owner-anonymous misst gegen sein eigenes Turnier T_ANON, alle anderen gegen T_MAIN.
  if [[ "$ca2_id" == "owner-anonymous" ]]; then ca2_t="$T_ANON"; ca2_n="$T_MAIN"; else ca2_t="$T_MAIN"; ca2_n="$T_ANON"; fi
  [[ "$ca2_settings" == "true" ]] && ca2_exp="gelingt" || ca2_exp="abgelehnt"

  ca2_got="$(ca2_verdict_public "$(ca2_probe authenticated "$ca2_uid" "" "$(CA2_PUBLIC_ACTION "$ca2_t")" "$(ca2_row "$ca2_t")")")"
  ca2_cell "@HE-085 NEU-CA3 make_tournament_public $ca2_id" "$ca2_got" "$ca2_exp"

  ca2_got="$(ca2_verdict_private "$(ca2_probe authenticated "$ca2_uid" "$(ca2_public_setup "$ca2_t")" "$(CA2_PRIVATE_ACTION "$ca2_t")" "$(ca2_row "$ca2_t")")")"
  ca2_cell "@HE-085 NEU-CA3 make_tournament_private $ca2_id" "$ca2_got" "$ca2_exp"

  ca2_got="$(ca2_verdict_regenerate "$(ca2_probe authenticated "$ca2_uid" "$(ca2_public_setup "$ca2_t")" "$(CA2_REGENERATE_ACTION "$ca2_t")" "$(ca2_row "$ca2_t")")")"
  ca2_cell "@HE-085 NEU-CA3 regenerate_share_code $ca2_id" "$ca2_got" "$ca2_exp"

  [[ "$ca2_screens" == "true" ]] && ca2_exp_read="1" || ca2_exp_read="0"
  ca2_got="$(ca2_verdict_read "$(ca2_probe authenticated "$ca2_uid" "" "$(CA2_READ_ACTION "$ca2_t")" "1")")"
  ca2_cell "@HE-085 NEU-CA5 monitor_heartbeats lesen (eigenes Turnier) $ca2_id" "$ca2_got" "$ca2_exp_read"
  ca2_got="$(ca2_verdict_read "$(ca2_probe authenticated "$ca2_uid" "" "$(CA2_READ_ACTION "$ca2_n")" "1")")"
  ca2_cell "NEU-CA5 gegen-nachbarturnier monitor_heartbeats $ca2_id" "$ca2_got" "0"
done

# anon ohne Sitzung (Mama Petra): nichts
ca2_cell "NEU-CA3 make_tournament_public anon (ohne Sitzung)" \
  "$(ca2_verdict_public "$(ca2_probe anon "" "" "$(CA2_PUBLIC_ACTION "$T_MAIN")" "$(ca2_row "$T_MAIN")")")" "abgelehnt"
ca2_cell "NEU-CA3 make_tournament_private anon (ohne Sitzung)" \
  "$(ca2_verdict_private "$(ca2_probe anon "" "$(ca2_public_setup "$T_MAIN")" "$(CA2_PRIVATE_ACTION "$T_MAIN")" "$(ca2_row "$T_MAIN")")")" "abgelehnt"
ca2_cell "NEU-CA3 regenerate_share_code anon (ohne Sitzung)" \
  "$(ca2_verdict_regenerate "$(ca2_probe anon "" "$(ca2_public_setup "$T_MAIN")" "$(CA2_REGENERATE_ACTION "$T_MAIN")" "$(ca2_row "$T_MAIN")")")" "abgelehnt"
ca2_cell "NEU-CA5 monitor_heartbeats lesen anon (ohne Sitzung)" \
  "$(ca2_verdict_read "$(ca2_probe anon "" "" "$(CA2_READ_ACTION "$T_MAIN")" "1")")" "0"

# Entwurf (NEU-CA3 Gegenbeispiel, HF001 bleibt): Co-Admin und Eigentuemer teilen ein nicht freigegebenes Turnier nicht.
CA2_DRAFT="UPDATE public.tournaments SET config = config - 'publishedAt' WHERE id = '$T_MAIN';"
for ca2_id in co-admin owner; do
  ca2_probe_out="$(ca2_probe authenticated "$(user_id_for_id "$ca2_id")" "$CA2_DRAFT" "$(CA2_PUBLIC_ACTION "$T_MAIN")" "$(ca2_row "$T_MAIN")")"
  if [[ "$ca2_probe_out" == "fehler:Tournament has not been released yet and cannot be made public|false|NULL|NULL" ]]; then
    ca2_got="HF001-abgelehnt"
  else
    ca2_got="anders($ca2_probe_out)"
  fi
  ca2_cell "NEU-CA3 gegen-entwurf make_tournament_public $ca2_id (HF001)" "$ca2_got" "HF001-abgelehnt"
done

# Code bleibt beim erneuten Teilen (Auflage 5): schon oeffentlich mit Code -> derselbe Code, Zeile unveraendert.
for ca2_id in co-admin owner; do
  ca2_probe_out="$(ca2_probe authenticated "$(user_id_for_id "$ca2_id")" "$(ca2_public_setup "$T_MAIN")" "$(CA2_PUBLIC_ACTION "$T_MAIN")" "$(ca2_row "$T_MAIN")")"
  [[ "$ca2_probe_out" == "$CA2_CODE|true|$CA2_CODE|alt" ]] && ca2_got="code-bleibt" || ca2_got="anders($ca2_probe_out)"
  ca2_cell "NEU-CA3 erneut-teilen make_tournament_public $ca2_id (Code bleibt)" "$ca2_got" "code-bleibt"
done
# Gegenbeispiel: der Helfer bekommt auch den vorhandenen Code nicht (Pruefung vor der Rueckgabe).
ca2_got="$(ca2_verdict_private "$(ca2_probe authenticated "$(user_id_for_id collaborator)" "$(ca2_public_setup "$T_MAIN")" "$(CA2_PUBLIC_ACTION "$T_MAIN")" "$(ca2_row "$T_MAIN")")")"
ca2_cell "NEU-CA3 gegen-erneut-teilen make_tournament_public collaborator" "$ca2_got" "abgelehnt"

# regenerate_share_code auf nicht oeffentlichem Turnier: Bestand (Auflage 4) -- es entsteht ein Code, is_public bleibt false.
ca2_probe_out="$(ca2_probe authenticated "$U_COADMIN" "" "$(CA2_REGENERATE_ACTION "$T_MAIN")" "$(ca2_row "$T_MAIN")")"
ca2_res="${ca2_probe_out%%|*}"
if [[ "$ca2_res" =~ $CA2_ALPHABET_RE && "${ca2_probe_out#*|}" == "false|$ca2_res|neu" ]]; then ca2_got="code-entsteht-nicht-oeffentlich"; else ca2_got="anders($ca2_probe_out)"; fi
ca2_cell "Bestand regenerate_share_code co-admin auf nicht oeffentlichem Turnier" "$ca2_got" "code-entsteht-nicht-oeffentlich"

echo "ca2-coadmin: $CA2_CELLS Zellen geprueft ($(( ${#MATRIX_IDS[@]} + 1 )) Identitaeten x 5 + 4 anon + 6 Sonderzeilen), $CA2_MISMATCHES Abweichung(en)"
