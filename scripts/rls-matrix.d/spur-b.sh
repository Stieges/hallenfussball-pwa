# shellcheck shell=bash
#
# rls-matrix.d/spur-b.sh — Zeilen der Spur B fuer scripts/rls-role-matrix.sh (Bauplan § 2 Nr. 7, A-11 R-A11-4).
# Wird vom Hauptskript per `source` eingebunden; in sich geschlossen (eigene Hilfe b48_probe), nutzt nur das Hauptskript
# (MATRIX_IDS, user_id_for_id, role_for_id, perm_expected, claims_line, T_MAIN/T_ANON, CONTAINER_NAME, WITH_A27,
# WITH_B48B, TOTAL/MISMATCHES).
#
# B-48b (brief-B-48.md Schritt 3, Bauplan § 2 Nr. 11; 20261113_101_monitor_heartbeat_wake_lock.sql; Befund C-HEARTBEAT):
# Lebenszeichen der Monitore senden ueber record_monitor_heartbeat(Kennung als Text, Turnier, ..., wake_lock). Erwartung
# aus rolePermissions.json (nicht aus dem Code): oeffentliches Turnier -> jede Identitaet (der Monitor laeuft ohne Konto;
# Restrisiko wie bisher, Absicherung mit B-20), privates Turnier -> nur mit tournamentSettings (Eigentuemer mit echtem
# Konto, Co-Admin); anonyme Sitzungen nie, auch nicht als Eigentuemer (owner-anonymous gegen sein T_ANON) oder mit
# Altbestand-Zeile co-admin (anon-coadmin). Je Identitaet:
#   (i)   oeffentliches Turnier, eigene Kennung        -> gelingt (Zeile mit wake_lock granted)
#   (ii)  privates Turnier, eigene Kennung             -> gelingt nur mit tournamentSettings, sonst 42501 ohne Zeile
#   (iii) oeffentliches Turnier, Kennung des Nachbarturniers (Pruefung gegen config.monitors) -> immer 42501
#   (iv)  privates Nachbarturnier                      -> immer 42501
# Dazu anon ohne Sitzung (i)-(iii) und der direkte Tabellenweg (Eigentuemer INSERT -> Fehler). Bildschirm (screen-device):
# heute wie Helfer abgelehnt bei privaten Turnieren -- B-20 ergaenzt die Rolle screen (Auflage im Brief), dann aendert
# sich genau die Zeile (ii) screen-device. Lesen misst rls-matrix.d/coadmin.sh (CA-2, manageScreens).
# Gegenprobe: scripts/rls-role-matrix.sh --without-b48b (alte Signatur) -> alle B-48b-Zeilen rot.

if [[ "${WITH_A27:-0}" -ne 1 ]]; then
  echo "b48b: uebersprungen (die Erwartungen setzen A-27 voraus, 20261110_002 ist in diesem Modus nicht eingespielt)"
  return 0
fi

B48_MISMATCHES=0
B48_CELLS=0
B48_KEY_MAIN="mon-b48b-main"
B48_KEY_ANON="mon-b48b-anon"

# Ausgangszustand je Probe (Superuser, nie committet): beide Turniere freigegeben, mit je einem Monitor in config.monitors.
b48_base() { # b48_base <T_MAIN oeffentlich true|false> <T_ANON oeffentlich true|false>
  echo "UPDATE public.tournaments SET is_public = $1,
       config = coalesce(config, '{}'::jsonb) || '{\"publishedAt\":\"2026-09-22T00:00:00.000Z\",\"monitors\":[{\"id\":\"$B48_KEY_MAIN\",\"name\":\"Hallenmonitor Halle\"}]}'::jsonb
 WHERE id = '$T_MAIN';
UPDATE public.tournaments SET is_public = $2,
       config = coalesce(config, '{}'::jsonb) || '{\"publishedAt\":\"2026-09-22T00:00:00.000Z\",\"monitors\":[{\"id\":\"$B48_KEY_ANON\",\"name\":\"Nachbar\"}]}'::jsonb
 WHERE id = '$T_ANON';"
}
B48_SEND() { echo "SELECT 'r:ok' FROM (SELECT public.record_monitor_heartbeat('$2', '$1', 1, 'fresh', 'rls-matrix', 'granted')) AS x;"; }
B48_ROW() { echo "SELECT count(*) || '|' || coalesce(max(wake_lock), 'NULL') FROM public.monitor_heartbeats WHERE tournament_id = '$1' AND monitor_id = '$2'"; }

# b48_probe <client-rolle authenticated|anon> <uid oder leer> <vorbereitung> <aktion> <pruef-SQL> -> "<ergebnis>|<pruefwert>"
b48_probe() {
  local role="$1" uid="$2" setup="$3" action="$4" check_sql="$5" sub_line="" out res msg chk
  [[ -n "$uid" ]] && sub_line="SET LOCAL request.jwt.claim.sub = '$uid'; $(claims_line "$uid")"
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 <<SQL 2>&1
\\set VERBOSITY verbose
BEGIN;
$setup
SET LOCAL ROLE $role;
$sub_line
SAVEPOINT b48_aktion;
$action
\\if :ERROR
ROLLBACK TO SAVEPOINT b48_aktion;
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
b48_verdict() { # gelingt nur mit Zeile (wake_lock granted), abgelehnt nur mit 42501 UND ohne Zeile
  local res="${1%%|*}" chk="${1#*|}"
  if [[ "$res" == "ok" && "$chk" == "1|granted" ]]; then echo "gelingt"
  elif [[ "$res" == "fehler:42501: monitor/tournament mismatch or not visible" && "$chk" == "0|NULL" ]]; then echo "abgelehnt"
  else echo "anders($1)"; fi
}
b48_cell() { # b48_cell <Name> <erhalten> <erwartet>
  B48_CELLS=$((B48_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" == "$3" ]]; then
    printf 'b48b %-72s: %s\n' "$1" "$2"
  else
    MISMATCHES=$((MISMATCHES + 1)); B48_MISMATCHES=$((B48_MISMATCHES + 1))
    printf 'b48b %-72s: %s!=%s\n' "$1" "$2" "$3"
  fi
}

for b48_id in "${MATRIX_IDS[@]}" anon-coadmin; do
  b48_uid="$(user_id_for_id "$b48_id")"
  if [[ "$b48_id" == "anon-coadmin" ]]; then
    b48_settings="false"   # Altbestand-Zeile co-admin zaehlt anonym nicht (A-27)
  else
    b48_settings="$(perm_expected "$(role_for_id "$b48_id")" tournamentSettings)"
  fi
  # owner-anonymous misst gegen sein eigenes Turnier T_ANON, alle anderen gegen T_MAIN.
  if [[ "$b48_id" == "owner-anonymous" ]]; then
    b48_t="$T_ANON"; b48_k="$B48_KEY_ANON"; b48_n="$T_MAIN"; b48_nk="$B48_KEY_MAIN"
    b48_pub="$(b48_base false true)"; b48_priv="$(b48_base false false)"
  else
    b48_t="$T_MAIN"; b48_k="$B48_KEY_MAIN"; b48_n="$T_ANON"; b48_nk="$B48_KEY_ANON"
    b48_pub="$(b48_base true false)"; b48_priv="$(b48_base false false)"
  fi
  [[ "$b48_settings" == "true" ]] && b48_exp="gelingt" || b48_exp="abgelehnt"

  b48_cell "@ME-064 oeffentlich senden $b48_id" \
    "$(b48_verdict "$(b48_probe authenticated "$b48_uid" "$b48_pub" "$(B48_SEND "$b48_t" "$b48_k")" "$(B48_ROW "$b48_t" "$b48_k")")")" "gelingt"
  b48_cell "@ME-064 privat senden $b48_id" \
    "$(b48_verdict "$(b48_probe authenticated "$b48_uid" "$b48_priv" "$(B48_SEND "$b48_t" "$b48_k")" "$(B48_ROW "$b48_t" "$b48_k")")")" "$b48_exp"
  b48_cell "gegen-fremde-kennung oeffentlich $b48_id" \
    "$(b48_verdict "$(b48_probe authenticated "$b48_uid" "$b48_pub" "$(B48_SEND "$b48_t" "$b48_nk")" "$(B48_ROW "$b48_t" "$b48_nk")")")" "abgelehnt"
  b48_cell "gegen-nachbarturnier privat $b48_id" \
    "$(b48_verdict "$(b48_probe authenticated "$b48_uid" "$b48_priv" "$(B48_SEND "$b48_n" "$b48_nk")" "$(B48_ROW "$b48_n" "$b48_nk")")")" "abgelehnt"
done

# anon ohne Sitzung (der Hallen-Rechner ohne Anmeldung): oeffentlich ja, privat nein, fremde Kennung nein
b48_cell "@ME-064 oeffentlich senden anon (ohne Sitzung)" \
  "$(b48_verdict "$(b48_probe anon "" "$(b48_base true false)" "$(B48_SEND "$T_MAIN" "$B48_KEY_MAIN")" "$(B48_ROW "$T_MAIN" "$B48_KEY_MAIN")")")" "gelingt"
b48_cell "@ME-064 privat senden anon (ohne Sitzung)" \
  "$(b48_verdict "$(b48_probe anon "" "$(b48_base false false)" "$(B48_SEND "$T_MAIN" "$B48_KEY_MAIN")" "$(B48_ROW "$T_MAIN" "$B48_KEY_MAIN")")")" "abgelehnt"
b48_cell "gegen-fremde-kennung oeffentlich anon (ohne Sitzung)" \
  "$(b48_verdict "$(b48_probe anon "" "$(b48_base true false)" "$(B48_SEND "$T_MAIN" "$B48_KEY_ANON")" "$(B48_ROW "$T_MAIN" "$B48_KEY_ANON")")")" "abgelehnt"

# Kein Schreibweg an der Funktion vorbei: auch der Eigentuemer schreibt nicht direkt in die Tabelle.
b48_out="$(b48_probe authenticated "$(user_id_for_id owner)" "$(b48_base true false)" \
  "INSERT INTO public.monitor_heartbeats (monitor_id, tournament_id, wake_lock) VALUES ('$B48_KEY_MAIN', '$T_MAIN', 'granted');" \
  "$(B48_ROW "$T_MAIN" "$B48_KEY_MAIN")")"
b48_cell "gegen-direkt monitor_heartbeats INSERT owner" "$([[ "$b48_out" == fehler:42501:*"|0|NULL" ]] && echo fehler || echo "zugriff($b48_out)")" "fehler"

echo "b48b-lebenszeichen: $B48_CELLS Zellen geprueft ($(( ${#MATRIX_IDS[@]} + 1 )) Identitaeten x 4 + 3 anon + 1 direkt), $B48_MISMATCHES Abweichung(en)"
