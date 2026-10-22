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
