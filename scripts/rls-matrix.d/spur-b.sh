# shellcheck shell=bash
#
# rls-matrix.d/spur-b.sh — Zeilen der Spur B fuer scripts/rls-role-matrix.sh (Bauplan § 2 Nr. 7, A-11 R-A11-4).
# Wird vom Hauptskript per `source` eingebunden; gleiche Hilfsfunktionen und Zaehler wie scripts/rls-matrix.d/spur-a.sh
# (a11_mark usw. aus _hilfen.sh, claims_line aus dem Hauptskript).
#
# B-14 (20261117_104_public_payload.sql, E-A2, Review Focus 6, § 2 Nr. 11): wer liest die Turnier-Tabellen direkt?
# Je Identitaet eine Zeile "<tournaments T_MAIN>,<matches T_MAIN>,<match_events E_MAIN>,<monitors T_MAIN>,
# <sponsors T_MAIN>,<tournaments T_PUBLIC>,<public_tournament(Code von T_PUBLIC)>" -- t/f = sieht mindestens eine Zeile.
# Erwartung: Eigentuemer, Co-Admin, Helfer (zugelassen) und Zuschauer-Mitglied lesen ihr Turnier (Monitore nur mit
# manageScreens); anon, anonyme Sitzung ohne Rolle, Konto ohne Rolle, entzogener Helfer, Helfer/Bildschirm eines anderen
# Turniers und jeder Bildschirm (gekoppelt oder geloest) lesen nichts direkt -- auch das oeffentliche T_PUBLIC nicht;
# die Positivliste (public_tournament) beantwortet alle mit "full". Ohne 20261117_104 (--without-b14) sind diese Zeilen
# ROT (anon liest T_PUBLIC, die Funktion fehlt).
# "fremdes Feld": Lesen haengt nicht am Feld (allowed_fields regelt nur das Schreiben, A-16) -- gleiche Zeile wie
# "Helfer zugelassen".

B14_CODE="B14PUB"
# Je Abfrage eine nie committete Transaktion: Vorbereitung als Superuser (Code fuer T_PUBLIC, ggf. Mitgliedschaft),
# dann als Client-Rolle zaehlen.
b14_sicht() { # b14_sicht <client-rolle anon|authenticated> <uid oder leer> [vorbereitung-SQL]
  local role="$1" uid="$2" setup="${3:-}" sub_line="" out
  [[ -n "$uid" ]] && sub_line="SET LOCAL request.jwt.claim.sub = '$uid'; $(claims_line "$uid")"
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 <<SQL 2>&1
BEGIN;
UPDATE public.tournaments SET share_code = '$B14_CODE' WHERE id = '$T_PUBLIC';
$setup
SET LOCAL ROLE $role;
$sub_line
SELECT 'b14:' || concat_ws(',',
  (SELECT count(*) > 0 FROM public.tournaments WHERE id = '$T_MAIN')::text,
  (SELECT count(*) > 0 FROM public.matches WHERE tournament_id = '$T_MAIN')::text,
  (SELECT count(*) > 0 FROM public.match_events WHERE id = '$E_MAIN')::text,
  (SELECT count(*) > 0 FROM public.monitors WHERE tournament_id = '$T_MAIN')::text,
  (SELECT count(*) > 0 FROM public.sponsors WHERE tournament_id = '$T_MAIN')::text,
  (SELECT count(*) > 0 FROM public.tournaments WHERE id = '$T_PUBLIC')::text);
SELECT 'b14rpc:' || coalesce(public.public_tournament('$B14_CODE', NULL) ->> 'state', 'NULL');
ROLLBACK;
SQL
)"
  set -e
  local rows rpc
  rows="$( (grep -m1 '^b14:' <<<"$out" || true) | sed 's/^b14://')"
  rpc="$( (grep -m1 '^b14rpc:' <<<"$out" || true) | sed 's/^b14rpc://')"
  echo "${rows:-fehler},${rpc:-fehler}"
}

B14_NICHTS="false,false,false,false,false,false,full"
B14_HELPER_ANDERES="INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at) VALUES ('$T_PUBLIC', '$U_ANON_DEVICE', 'helper', now());"
B14_SCREEN_ANDERES="INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at) VALUES ('$T_PUBLIC', '$U_ANON_DEVICE', 'screen', now());"

a11_mark "B-14 Eigentuemer liest sein Turnier inkl. Monitore, fremdes oeffentliches nicht   " \
  "$(b14_sicht authenticated "$U_OWNER")" "true,true,true,true,true,false,full"
a11_mark "B-14 Co-Admin liest das Turnier inkl. Monitore                                    " \
  "$(b14_sicht authenticated "$U_COADMIN")" "true,true,true,true,true,false,full"
a11_mark "B-14 Zuschauer-Mitglied (viewer) liest das Turnier, keine Monitore                " \
  "$(b14_sicht authenticated "$U_VIEWER")" "true,true,true,false,true,false,full"
a11_mark "B-14 Helfer-Geraet zugelassen (auch fremdes Feld) liest das Turnier, keine Monitore" \
  "$(b14_sicht authenticated "$U_HELPER_DEVICE")" "true,true,true,false,true,false,full"
a11_mark "B-14 Helfer-Geraet entzogen liest nichts                                          " \
  "$(b14_sicht authenticated "$U_HELPER_DEVICE" "SET LOCAL session_replication_role = replica; UPDATE public.tournament_collaborators SET declined_at = now() WHERE id = '$MEMBERSHIP_HELPER_DEVICE'; SET LOCAL session_replication_role = origin;")" "$B14_NICHTS"
a11_mark "B-14 Helfer-Geraet nicht zugelassen (anonyme Sitzung ohne Rolle) liest nichts     " \
  "$(b14_sicht authenticated "$U_ANON_DEVICE")" "$B14_NICHTS"
a11_mark "B-14 Helfer-Geraet eines anderen Turniers liest T_MAIN nicht, sein Turnier schon  " \
  "$(b14_sicht authenticated "$U_ANON_DEVICE" "$B14_HELPER_ANDERES")" "false,false,false,false,false,true,full"
a11_mark "B-14 Bildschirm gekoppelt liest nichts direkt (nur Positivliste)                  " \
  "$(b14_sicht authenticated "$U_SCREEN_DEVICE")" "$B14_NICHTS"
a11_mark "B-14 Bildschirm geloest liest nichts                                              " \
  "$(b14_sicht authenticated "$U_SCREEN_DEVICE" "SET LOCAL session_replication_role = replica; UPDATE public.tournament_collaborators SET declined_at = now() WHERE id = '$MEMBERSHIP_SCREEN_DEVICE'; SET LOCAL session_replication_role = origin;")" "$B14_NICHTS"
a11_mark "B-14 Bildschirm eines anderen Turniers liest weder T_MAIN noch sein Turnier direkt  " \
  "$(b14_sicht authenticated "$U_ANON_DEVICE" "$B14_SCREEN_ANDERES")" "$B14_NICHTS"
a11_mark "B-14 echtes Konto ohne Rolle liest nichts, auch nicht das oeffentliche Turnier     " \
  "$(b14_sicht authenticated "$U_NONMEMBER")" "$B14_NICHTS"
a11_mark "B-14 ohne Sitzung (anon) liest nichts, auch nicht das oeffentliche Turnier         " \
  "$(b14_sicht anon "")" "$B14_NICHTS"
a11_mark "B-14 Eigentuemer von T_PUBLIC liest sein oeffentliches Turnier (Gegenbeispiel)     " \
  "$(b14_sicht authenticated "$U_PUBLIC_OWNER")" "false,false,false,false,false,true,full"

# ---------------------------------------------------------------------------------------------------------------------
# B-48b-Teil (in sich geschlossen, eigene Hilfe b48_probe; nutzt MATRIX_IDS, user_id_for_id, role_for_id, perm_expected,
# claims_line, T_MAIN/T_ANON, CONTAINER_NAME, WITH_A27, WITH_B48B, TOTAL/MISMATCHES). Steht hinter dem B-14-Teil, weil er
# ohne A-27 per return endet.
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
