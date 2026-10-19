# shellcheck shell=bash
#
# rls-matrix.d/spur-geraete-a27.sh — Zeilen von A-27 (brief-A-27.md, 20261110_002_device_roles.sql) fuer
# scripts/rls-role-matrix.sh. Per `source` eingebunden NACH spur-a.sh (Glob-Reihenfolge "spur-a" < "spur-g", in jeder
# Sortierung -- auch dort, wo Satzzeichen nicht zaehlen), damit
# die A-11-Fixtures (Spiele 11/13/14, Teams, „Hallenmonitor Feld 1“) schon stehen. Nutzt die Hilfen aus _hilfen.sh und
# claims_line() des Hauptskripts. Erwartungen aus rolePermissions.json bzw. dem Gherkin der Kennung.
#
# (i) has_tournament_permission: alle 13 Rechte x anonyme Identitaeten (owner-anonymous, anon-device, helper-device,
#     screen-device, anon-coadmin); (ii) Szenario-Zeilen mit Kennung, Vorher-Sicht / Schreiben / Wert als Superuser;
#     (iii) Guard protect_device_roles mit Fehlertext und Definer-Gegenprobe; (iv) Hook-Unit als supabase_auth_admin.
# Testwerte aus dem Gherkin: „Live-Cup“ (= T_MAIN, Spiel 13 um 15:15 SG Mitte - VfB Ufer, Spiel 14 auf Feld 2),
# „Wintercup“ (neu, Olli, nicht oeffentlich), „Hallenmonitor Halle“ (in T_MAIN = „Hallencup Nord“ fuer @ME-059).
# Olli = U_OWNER, Maria = U_COADMIN, Tom = helper-device, Lena = anon-device, Hallen-Rechner = screen-device,
# Clara = U_NONMEMBER (Konto, kein Mitglied), Mama Petra = Rolle anon.

A27_RIGHTS=()
while IFS= read -r a27_r; do A27_RIGHTS+=("$a27_r"); done < <(jq -r '.capabilities | keys[]' "$ROLE_PERMISSIONS_FILE")

# a27_sql <client-rolle authenticated|anon> <uid oder leer> <sql> [vorbereitung als Superuser] -> rohe Ausgabe (-tA)
a27_sql() {
  local role="$1" uid="$2" sql="$3" setup="${4:-}" sub_line="" out
  [[ -n "$uid" ]] && sub_line="SET LOCAL request.jwt.claim.sub = '$uid'; $(claims_line "$uid")"
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
$setup
SET LOCAL ROLE $role;
$sub_line
$sql
ROLLBACK;
SQL
)"
  set -e
  echo "$out"
}

# a27_probe <uid> <schreib-SQL> <pruef-SQL> [vorbereitung] -> "<zeilen|fehler>|<pruefwert>|<fehlertext>"
a27_probe() {
  local uid="$1" write_sql="$2" check_sql="$3" setup="${4:-}" sub_line="" out rows check msg
  [[ -n "$uid" ]] && sub_line="SET LOCAL request.jwt.claim.sub = '$uid'; $(claims_line "$uid")"
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -A -v ON_ERROR_STOP=0 <<SQL 2>&1
BEGIN;
$setup
SET LOCAL ROLE authenticated;
$sub_line
SAVEPOINT a27_schreiben;
SELECT 'a27schreiben:ab-hier';
$write_sql
\\if :ERROR
ROLLBACK TO SAVEPOINT a27_schreiben;
\\endif
RESET ROLE;
SELECT 'a27pruef:' || coalesce(($check_sql)::text, 'NULL');
ROLLBACK;
SQL
)"
  set -e
  check="$( (grep -m1 '^a27pruef:' <<<"$out" || true) | sed 's/^a27pruef://')"
  msg="$( (grep -m1 '^ERROR:' <<<"$out" || true) | sed 's/^ERROR: *//')"
  if [[ -n "$msg" ]]; then
    rows="fehler"
  else
    rows="$( (sed -n '/^a27schreiben:ab-hier$/,$p' <<<"$out" | grep -E '^(UPDATE|DELETE) [0-9]+$|^INSERT 0 [0-9]+$' || true) | awk '{s += $NF} END {print s + 0}')"
  fi
  echo "${rows}|${check:-?}|${msg}"
}

# Ereignis wie append-match-events-check.sh (ev): {id,type,at,section,clockMs,payload} + Zusatz
a27_ev() {
  local extra="${3:-}"
  [[ -z "$extra" ]] && extra='{}'
  jq -cn --arg type "$1" --arg id "$(uuid_for "a27-event:$2")" --argjson extra "$extra" \
    '{id: $id, type: $type, at: 1000, section: 1, clockMs: 0, payload: {}} + $extra'
}
a27_arr() { jq -cs '.' <<<"$(printf '%s\n' "$@")"; }

# a27_append <uid> <match> <events-json> [vorbereitung] -> "<status:code,...>|<ereignisse vorher>|<nachher>"
a27_append() {
  local uid="$1" match="$2" events="$3" setup="${4:-}" out
  out="$(a27_sql authenticated "$uid" "RESET ROLE; SELECT 'v:' || count(*) FROM public.match_events WHERE match_id = '$match';
SET LOCAL ROLE authenticated;
SELECT 'r:' || string_agg((e ->> 'status') || coalesce(':' || (e ->> 'code'), ''), ',') FROM jsonb_array_elements(public.append_match_events('$match', \$J\$$events\$J\$::jsonb, 1, NULL) -> 'results') AS e;
RESET ROLE; SELECT 'n:' || count(*) FROM public.match_events WHERE match_id = '$match';" "$setup")"
  echo "$( (grep -m1 '^r:' <<<"$out" || echo "r:FEHLER $(head -c 120 <<<"$out")") | cut -c3-)|$( (grep -m1 '^v:' <<<"$out" || true) | cut -c3-)|$( (grep -m1 '^n:' <<<"$out" || true) | cut -c3-)"
}

# Tor-Zusatz je Team (eigene Zuweisung: verschachtelte "{...}" in $(...) verliert unter bash 3.2 die Anfuehrungszeichen).
a27_goal_extra() { jq -cn --arg t "$1" '{at: 2000, clockMs: 1000, teamId: $t}'; }

# --- Fixtures (committet, Superuser): „Wintercup“ (Olli, nicht oeffentlich, 1 Spiel, 2 Teams), „Hallenmonitor Halle“ ---
T_WINTER="$(uuid_for a27-tournament:wintercup)"
A27_TEAM_W1="$(uuid_for a27-team:winter-1)"; A27_TEAM_W2="$(uuid_for a27-team:winter-2)"
M_WINTER="$(uuid_for a27-match:winter-1)"
A27_MONITOR_HALLE="$(uuid_for a27-monitor:halle)"
docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
BEGIN;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, config)
VALUES ('$T_WINTER', '$U_OWNER', 'Wintercup', '2026-12-05', 2, 10, '{}'::jsonb);
INSERT INTO public.teams (id, tournament_id, name) VALUES ('$A27_TEAM_W1', '$T_WINTER', 'FC Schnee'), ('$A27_TEAM_W2', '$T_WINTER', 'SV Eis');
INSERT INTO public.matches (id, tournament_id, round, field, match_number, scheduled_start, team_a_id, team_b_id)
VALUES ('$M_WINTER', '$T_WINTER', 1, 1, 1, '10:00', '$A27_TEAM_W1', '$A27_TEAM_W2');
INSERT INTO public.monitors (id, tournament_id, name, type, config)
VALUES ('$A27_MONITOR_HALLE', '$T_MAIN', 'Hallenmonitor Halle', 'slideshow', '{"slides":[{"type":"standings"}]}'::jsonb);
COMMIT;
SQL

# --- (i) has_tournament_permission: 13 Rechte x anonyme Identitaeten (R-A27-3, L9) ------------------------------------
A27_I_MISMATCHES=0
for a27_id in owner-anonymous anon-device helper-device screen-device anon-coadmin; do
  case "$a27_id" in
    owner-anonymous) a27_uid="$U_OWNER_ANON"; a27_t="$T_ANON"; a27_role="" ;;
    anon-device) a27_uid="$U_ANON_DEVICE"; a27_t="$T_MAIN"; a27_role="" ;;
    helper-device) a27_uid="$U_HELPER_DEVICE"; a27_t="$T_MAIN"; a27_role="helper" ;;
    screen-device) a27_uid="$U_SCREEN_DEVICE"; a27_t="$T_MAIN"; a27_role="screen" ;;
    anon-coadmin) a27_uid="$U_ANON_COADMIN"; a27_t="$T_MAIN"; a27_role="" ;;   # co-admin-Zeile zaehlt anonym nicht
  esac
  for a27_right in "${A27_RIGHTS[@]}"; do
    exp="$(perm_expected "$a27_role" "$a27_right")"
    got="$(a27_sql authenticated "$a27_uid" "SELECT public.has_tournament_permission('$a27_t', '$a27_right');")"
    case "$got" in t) got="true" ;; f) got="false" ;; *) got="fehler" ;; esac
    TOTAL=$((TOTAL + 1))
    if [[ "$got" != "$exp" ]]; then
      MISMATCHES=$((MISMATCHES + 1)); A27_I_MISMATCHES=$((A27_I_MISMATCHES + 1))
      printf 'a27-recht %-16s %-20s: %s!=%s\n' "$a27_id" "$a27_right" "$got" "$exp"
    fi
  done
done
echo "a27-rechte: $((5 * ${#A27_RIGHTS[@]})) Zellen geprueft (5 anonyme Identitaeten x ${#A27_RIGHTS[@]} Rechte), $A27_I_MISMATCHES Abweichung(en)"
# Gegenbeispiel L9: derselbe Claim-Mechanismus mit is_anonymous=false -> echtes Konto, Eigentuemer hat alle Rechte.
a11_mark "L9 gegen-olli-echtes-konto-hat-restructure                    " "$(a27_sql authenticated "$U_OWNER" "SELECT public.has_tournament_permission('$T_MAIN', 'restructure');")" "t"
a11_mark "L9 gegen-claim-is-anonymous-false-zaehlt-als-konto            " "$(A27_AS_REAL=1 a27_sql authenticated "$U_OWNER_ANON" "SELECT public.has_tournament_permission('$T_ANON', 'restructure');")" "t"

# --- @HE-006 (Rechte-Teil): Maria darf Helfer-Zugaenge verwalten, Toms Geraet nicht ----------------------------------
a11_mark "@HE-006 maria-hat-manageHelpers                               " "$(a27_sql authenticated "$U_COADMIN" "SELECT public.has_tournament_permission('$T_MAIN', 'manageHelpers');")" "t"
a11_mark "@HE-006 tom-geraet-hat-kein-manageHelpers                     " "$(a27_sql authenticated "$U_HELPER_DEVICE" "SELECT public.has_tournament_permission('$T_MAIN', 'manageHelpers');")" "f"

# --- @HE-082: Lena (gescannt, nicht zugelassen) legt weder Turnier noch Vorlage noch Mitgliedschaft an ---------------
A27_LENA_T="$(uuid_for a27-lena:turnier)"
r="$(a27_probe "$U_ANON_DEVICE" "INSERT INTO public.tournaments (id,owner_id,title,date,number_of_teams,group_phase_duration) VALUES ('$A27_LENA_T','$U_ANON_DEVICE','Lenas Cup','2026-11-10',4,10);" \
  "SELECT count(*) FROM public.tournaments WHERE owner_id = '$U_ANON_DEVICE'")"
a11_mark "@HE-082 lena-legt-turnier-an-abgelehnt-keins-entsteht         " "$(cut -d'|' -f1,2 <<<"$r")" "fehler|0"
r="$(a27_probe "$U_ANON_DEVICE" "INSERT INTO public.tournament_templates (owner_id,name,config) VALUES ('$U_ANON_DEVICE','Lenas Vorlage','{}'::jsonb);" \
  "SELECT count(*) FROM public.tournament_templates WHERE owner_id = '$U_ANON_DEVICE'")"
a11_mark "@HE-082 lena-legt-vorlage-an-abgelehnt-keine-entsteht         " "$(cut -d'|' -f1,2 <<<"$r")" "fehler|0"
r="$(a27_probe "$U_ANON_DEVICE" "INSERT INTO public.tournament_collaborators (tournament_id,user_id,role,accepted_at) VALUES ('$T_MAIN','$U_ANON_DEVICE','helper',now());" \
  "SELECT count(*) FROM public.tournament_collaborators WHERE user_id = '$U_ANON_DEVICE'")"
a11_mark "@HE-082 lena-traegt-sich-als-mitglied-ein-abgelehnt           " "$(cut -d'|' -f1,2 <<<"$r")" "fehler|0"
r="$(a27_probe "$U_ANON_DEVICE" "INSERT INTO public.tournament_collaborators (tournament_id,user_id,role,accepted_at) VALUES ('$T_MAIN','$U_ANON_DEVICE','collaborator',now());" \
  "SELECT count(*) FROM public.tournament_collaborators WHERE user_id = '$U_ANON_DEVICE'")"
a11_mark "@HE-082 lena-traegt-sich-als-collaborator-ein-abgelehnt       " "$(cut -d'|' -f1,2 <<<"$r")" "fehler|0"
r="$(a27_probe "$U_OWNER" "INSERT INTO public.tournaments (id,owner_id,title,date,number_of_teams,group_phase_duration) VALUES ('$A27_LENA_T','$U_OWNER','Ollis Cup','2026-11-10',4,10);" \
  "SELECT count(*) FROM public.tournaments WHERE id = '$A27_LENA_T'")"
a11_mark "@HE-082 gegen-olli-legt-turnier-an                            " "$(cut -d'|' -f1,2 <<<"$r")" "1|1"
r="$(a27_probe "$U_OWNER" "INSERT INTO public.tournament_templates (owner_id,name,config) VALUES ('$U_OWNER','Ollis Vorlage','{}'::jsonb);" \
  "SELECT count(*) FROM public.tournament_templates WHERE owner_id = '$U_OWNER'")"
a11_mark "@HE-082 gegen-olli-legt-vorlage-an                            " "$(cut -d'|' -f1,2 <<<"$r")" "1|1"
# T8: eigene Zeilen (Profil, sync_queue) nur mit echtem Konto
r="$(a27_probe "$U_ANON_DEVICE" "INSERT INTO public.sync_queue (user_id,table_name,record_id,operation,payload,local_timestamp) VALUES ('$U_ANON_DEVICE','matches','$M_MAIN','UPDATE','{}'::jsonb,now());" \
  "SELECT count(*) FROM public.sync_queue WHERE user_id = '$U_ANON_DEVICE'")"
a11_mark "@HE-082 lena-schreibt-sync-queue-abgelehnt                    " "$(cut -d'|' -f1,2 <<<"$r")" "fehler|0"
r="$(a27_probe "$U_OWNER" "INSERT INTO public.sync_queue (user_id,table_name,record_id,operation,payload,local_timestamp) VALUES ('$U_OWNER','matches','$M_MAIN','UPDATE','{}'::jsonb,now());" \
  "SELECT count(*) FROM public.sync_queue WHERE user_id = '$U_OWNER'")"
a11_mark "@HE-082 gegen-olli-schreibt-sync-queue                        " "$(cut -d'|' -f1,2 <<<"$r")" "1|1"
# Mama Petra (ohne Sitzung, Rolle anon) legt kein Turnier an: kein Tabellenrecht mehr (R-A27-4)
r="$(a27_sql anon "" "INSERT INTO public.tournaments (title,date,number_of_teams,group_phase_duration) VALUES ('Petras Cup','2026-11-10',4,10);")"
a11_mark "C-ANON-POLICIES mama-petra-anon-insert-tournaments-kein-recht " "$(grep -c 'permission denied for table tournaments' <<<"$r")" "1"

# --- @AN-045: Tom (Helfer-Zugang, ohne Konto) legt kein Turnier an ----------------------------------------------------
r="$(a27_probe "$U_HELPER_DEVICE" "INSERT INTO public.tournaments (owner_id,title,date,number_of_teams,group_phase_duration) VALUES ('$U_HELPER_DEVICE','Toms Cup','2026-11-10',4,10);" \
  "SELECT count(*) FROM public.tournaments WHERE owner_id = '$U_HELPER_DEVICE'")"
a11_mark "@AN-045 tom-geraet-legt-turnier-an-abgelehnt                  " "$(cut -d'|' -f1,2 <<<"$r")" "fehler|0"

# --- @HE-083: Tom (Live-Cup) liest nichts vom Wintercup und traegt dort kein Tor ein ----------------------------------
a11_mark "@HE-083 tom-liest-spiele-wintercup-nicht                      " "$(a27_sql authenticated "$U_HELPER_DEVICE" "SELECT count(*) FROM public.matches WHERE tournament_id = '$T_WINTER';")" "0"
a11_mark "@HE-083 tom-liest-teams-wintercup-nicht                       " "$(a27_sql authenticated "$U_HELPER_DEVICE" "SELECT count(*) FROM public.teams WHERE tournament_id = '$T_WINTER';")" "0"
a11_mark "@HE-083 gegen-olli-liest-wintercup                            " "$(a27_sql authenticated "$U_OWNER" "SELECT count(*) FROM public.teams WHERE tournament_id = '$T_WINTER';")" "2"
a11_mark "@HE-083 gegen-tom-liest-spiele-live-cup                       " "$(a27_sql authenticated "$U_HELPER_DEVICE" "SELECT (count(*) > 0)::text FROM public.matches WHERE tournament_id = '$T_MAIN';")" "true"
A27_GOAL_W1="$(a27_goal_extra "$A27_TEAM_W1")"
A27_START_GOAL_W="$(a27_arr "$(a27_ev MATCH_START w-start)" "$(a27_ev GOAL w-goal "$A27_GOAL_W1")")"
a11_mark "@HE-083 tom-tor-im-wintercup-abgelehnt-nichts-gespeichert     " "$(a27_append "$U_HELPER_DEVICE" "$M_WINTER" "$A27_START_GOAL_W")" "rejected:FORBIDDEN_ACTOR,rejected:FORBIDDEN_ACTOR|0|0"
A27_GOAL_SG="$(a27_goal_extra "$A11_TEAM_SG")"
A27_START_GOAL_13="$(a27_arr "$(a27_ev MATCH_START s13-start)" "$(a27_ev GOAL s13-goal "$A27_GOAL_SG")")"
a11_mark "@HE-083 gegen-tom-tor-im-live-cup-angenommen                  " "$(a27_append "$U_HELPER_DEVICE" "$A11_M13" "$A27_START_GOAL_13")" "accepted,accepted|0|2"
a11_mark "@HE-042 tom-geraet-traegt-tor-ein-akteur-helper-kein-lead     " "$(a27_sql authenticated "$U_HELPER_DEVICE" "SELECT public.has_tournament_permission('$T_MAIN','writeMatchData')::text || '/' || public.has_tournament_permission('$T_MAIN','leadMatches')::text;")" "true/false"

# --- @HE-073 (Server-Teil): vor der Zulassung kein Tor auf Feld 2 (Spiel 14) -------------------------------------------
A27_GOAL_TSV="$(a27_goal_extra "$A11_TEAM_TSV")"
A27_START_GOAL_14="$(a27_arr "$(a27_ev MATCH_START s14-start)" "$(a27_ev GOAL s14-goal "$A27_GOAL_TSV")")"
a11_mark "@HE-073 lena-tor-feld-2-abgelehnt                             " "$(a27_append "$U_ANON_DEVICE" "$A11_M14" "$A27_START_GOAL_14")" "rejected:FORBIDDEN_ACTOR,rejected:FORBIDDEN_ACTOR|0|0"
a11_mark "@HE-073 gegen-tom-zugelassen-tor-feld-2                       " "$(a27_append "$U_HELPER_DEVICE" "$A11_M14" "$A27_START_GOAL_14")" "accepted,accepted|0|2"

# --- Fixrunde 1 A2: Olli widerruft Toms Helfer-Zugang (declined_at) -> Toms Geraet hat kein Schreibrecht mehr -----------
# (sichert die Bedingung declined_at IS NULL im anonymen Zweig von has_tournament_permission; A-16 revoke_member baut darauf)
A27_OLLI_WIDERRUFT="SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '$U_OWNER';
UPDATE public.tournament_collaborators SET declined_at = now() WHERE id = '$MEMBERSHIP_HELPER_DEVICE';
RESET ROLE;"
a11_mark "@HE-006:teil widerrufener-helfer-zugang-hat-kein-schreibrecht " "$(a27_sql authenticated "$U_HELPER_DEVICE" "SELECT public.has_tournament_permission('$T_MAIN','writeMatchData');" "$A27_OLLI_WIDERRUFT")" "f"
a11_mark "@HE-006:teil widerrufener-helfer-tor-abgelehnt                " "$(a27_append "$U_HELPER_DEVICE" "$A11_M13" "$A27_START_GOAL_13" "$A27_OLLI_WIDERRUFT")" "rejected:FORBIDDEN_ACTOR,rejected:FORBIDDEN_ACTOR|0|0"
a11_mark "@HE-006:teil gegen-vor-dem-widerruf-tor-angenommen            " "$(a27_append "$U_HELPER_DEVICE" "$A11_M13" "$A27_START_GOAL_13")" "accepted,accepted|0|2"

# --- @HE-042 / L1: Tom oeffnet ein beendetes Spiel nicht wieder (nach der Fortsetzen-Frist), Team umbenennen nein -----
A27_OLLI_END_11="SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '$U_OWNER';
SELECT public.append_match_events('$A11_M11', \$J\$$(a27_arr "$(a27_ev MATCH_START s11-start)" "$(a27_ev MATCH_END s11-end '{"at":3000,"clockMs":600000}')")\$J\$::jsonb, 1, NULL);
RESET ROLE;"
a11_mark "@HE-042 tom-oeffnet-beendetes-spiel-11-nicht-wieder           " "$(a27_append "$U_HELPER_DEVICE" "$A11_M11" "$(a27_arr "$(a27_ev REOPEN s11-reopen-t '{"at":124000,"clockMs":600000}')")" "$A27_OLLI_END_11" | cut -d'|' -f1)" "rejected:FORBIDDEN_ACTOR"
a11_mark "@HE-042 gegen-olli-oeffnet-spiel-11-wieder                    " "$(a27_append "$U_OWNER" "$A11_M11" "$(a27_arr "$(a27_ev REOPEN s11-reopen-o '{"at":6000,"clockMs":600000}')")" "$A27_OLLI_END_11" | cut -d'|' -f1)" "accepted"
r="$(a11_probe authenticated "$U_HELPER_DEVICE" "SELECT count(*) FROM public.teams WHERE id = '$A11_TEAM_SG'" "UPDATE public.teams SET name = 'SG Mitte 2' WHERE id = '$A11_TEAM_SG';" "SELECT name FROM public.teams WHERE id = '$A11_TEAM_SG'")"
a11_mark "@HE-042 tom-geraet-benennt-sg-mitte-um-abgelehnt              " "$(a11_denied_verdict "$r" "SG Mitte")" "abgelehnt"

# --- @ME-059: der gekoppelte Hallen-Rechner traegt kein Tor ein, beendet kein Spiel, aendert den Monitor nicht ---------
a11_mark "@ME-059 bildschirm-tor-abgelehnt-nichts-gespeichert           " "$(a27_append "$U_SCREEN_DEVICE" "$A11_M13" "$A27_START_GOAL_13")" "rejected:FORBIDDEN_ACTOR,rejected:FORBIDDEN_ACTOR|0|0"
A27_OLLI_START_13="SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '$U_OWNER';
SELECT public.append_match_events('$A11_M13', \$J\$$(a27_arr "$(a27_ev MATCH_START s13-start-o)")\$J\$::jsonb, 1, NULL);
RESET ROLE;"
a11_mark "@ME-059 bildschirm-beendet-spiel-13-abgelehnt                 " "$(a27_append "$U_SCREEN_DEVICE" "$A11_M13" "$(a27_arr "$(a27_ev MATCH_END s13-end-b '{"at":3000,"clockMs":600000}')")" "$A27_OLLI_START_13")" "rejected:FORBIDDEN_ACTOR|1|1"
A27_HALLE_SLIDES="UPDATE public.monitors SET config = '{\"slides\":[{\"type\":\"live\"},{\"type\":\"schedule\"}]}'::jsonb WHERE id = '$A27_MONITOR_HALLE';"
A27_HALLE_NOW="SELECT jsonb_array_length(config->'slides') FROM public.monitors WHERE id = '$A27_MONITOR_HALLE'"
r="$(a27_probe "$U_SCREEN_DEVICE" "$A27_HALLE_SLIDES" "$A27_HALLE_NOW")"
a11_mark "@ME-059 bildschirm-aendert-hallenmonitor-halle-abgelehnt      " "$(cut -d'|' -f1,2 <<<"$r")" "0|1"
r="$(a11_probe authenticated "$U_SCREEN_DEVICE" "SELECT count(*) FROM public.tournaments WHERE id = '$T_MAIN'" \
  "UPDATE public.tournaments SET config = config || '{\"monitors\":[{\"id\":\"halle\",\"name\":\"Hallenmonitor Halle\",\"slides\":[]}]}'::jsonb WHERE id = '$T_MAIN';" \
  "SELECT coalesce(config->'monitors'->0->>'name', 'keiner') FROM public.tournaments WHERE id = '$T_MAIN'")"
a11_mark "@ME-059 bildschirm-aendert-folien-im-turnier-abgelehnt        " "$(a11_denied_verdict "$r" "keiner")" "abgelehnt"
r="$(a27_probe "$U_COADMIN" "$A27_HALLE_SLIDES" "$A27_HALLE_NOW")"
a11_mark "@ME-059 gegen-maria-aendert-hallenmonitor-halle               " "$(cut -d'|' -f1,2 <<<"$r")" "1|2"

# --- @ZP-084 „Link des Hallenmonitor“: der Bildschirm verschiebt Spiel 13 nicht ----------------------------------------
r="$(a11_probe authenticated "$U_SCREEN_DEVICE" "SELECT count(*) FROM public.matches WHERE id = '$A11_M13'" \
  "UPDATE public.matches SET scheduled_start = scheduled_start + interval '10 minutes' WHERE id = '$A11_M13';" \
  "SELECT to_char(scheduled_start, 'HH24:MI') FROM public.matches WHERE id = '$A11_M13'")"
a11_mark "@ZP-084 bildschirm-verschiebt-spiel-13-abgelehnt              " "$(a11_denied_verdict "$r" "15:15")" "abgelehnt"
r="$(a11_probe authenticated "$U_COADMIN" "SELECT count(*) FROM public.matches WHERE id = '$A11_M13'" \
  "UPDATE public.matches SET scheduled_start = scheduled_start + interval '10 minutes' WHERE id = '$A11_M13';" \
  "SELECT to_char(scheduled_start, 'HH24:MI') FROM public.matches WHERE id = '$A11_M13'")"
a11_mark "@ZP-084 gegen-maria-verschiebt-spiel-13-auf-1525              " "$(a11_allowed_verdict "$r" 1 "15:25")" "gelingt"

# --- (iii) Guard protect_device_roles: @HE-062, @HE-084 (V1), @ME-069 (V2) ---------------------------------------------
A27_GUARD_FREMD="Nicht erlaubt: niemand wird ohne eigene Anfrage Mitglied."
A27_GUARD_ROLLE="Nicht erlaubt: Helfer- und Bildschirm-Zugaenge entstehen nur ueber Beitritt bzw. Kopplung."
A27_GUARD_GERAET="Nicht erlaubt: Rolle oder Geraet eines Helfer-/Bildschirm-Zugangs aendert sich nicht direkt."
# Wegwerf-Definer (nur in dieser nie committeten Transaktion): simuliert A-16 (Beitritt) bzw. B-20 (Kopplung).
A27_DEFINER="CREATE FUNCTION public.a27_test_insert_member(p_t uuid, p_u uuid, p_role text) RETURNS void LANGUAGE sql SECURITY DEFINER
  SET search_path = public, pg_temp AS \$F\$ INSERT INTO public.tournament_collaborators (tournament_id,user_id,role,accepted_at) VALUES (p_t,p_u,p_role,now()) \$F\$;
GRANT EXECUTE ON FUNCTION public.a27_test_insert_member(uuid,uuid,text) TO authenticated;"
A27_CLARA_ROWS="SELECT count(*) FROM public.tournament_collaborators WHERE user_id = '$U_NONMEMBER'"
A27_LENA_ROWS="SELECT count(*) FROM public.tournament_collaborators WHERE user_id = '$U_ANON_DEVICE'"
r="$(a27_probe "$U_OWNER" "INSERT INTO public.tournament_collaborators (tournament_id,user_id,role,accepted_at) VALUES ('$T_MAIN','$U_NONMEMBER','collaborator',now());" "$A27_CLARA_ROWS")"
a11_mark "@HE-062 olli-traegt-clara-ohne-anfrage-ein-abgelehnt          " "$r" "fehler|0|$A27_GUARD_FREMD"
r="$(a27_probe "$U_OWNER" "INSERT INTO public.tournament_collaborators (tournament_id,user_id,role,accepted_at) VALUES ('$T_MAIN','$U_ANON_DEVICE','helper',now());" "$A27_LENA_ROWS")"
a11_mark "@HE-062 olli-legt-helfer-zugang-direkt-an-abgelehnt           " "$r" "fehler|0|$A27_GUARD_ROLLE"
r="$(a27_probe "$U_OWNER" "SELECT public.a27_test_insert_member('$T_MAIN','$U_ANON_DEVICE','helper');" "SELECT role FROM public.tournament_collaborators WHERE user_id = '$U_ANON_DEVICE'" "$A27_DEFINER")"
a11_mark "@HE-062 gegen-definer-beitritt-legt-helfer-an                 " "$(cut -d'|' -f2 <<<"$r")" "helper"
r="$(a27_probe "$U_OWNER" "INSERT INTO public.tournament_collaborators (tournament_id,invite_code,invite_email,role,invited_by,max_uses) VALUES ('$T_MAIN','A27CLARA','clara@rls-matrix.test','collaborator','$U_OWNER',1);" \
  "SELECT count(*) FROM public.tournament_collaborators WHERE invite_code = 'A27CLARA'")"
a11_mark "@HE-062 gegen-olli-einladung-mit-email-bestand                " "$(cut -d'|' -f1,2 <<<"$r")" "1|1"
r="$(a27_probe "$U_OWNER" "INSERT INTO public.tournament_collaborators (tournament_id,user_id,role,accepted_at) VALUES ('$T_MAIN','$U_ANON_DEVICE','screen',now());" "$A27_LENA_ROWS")"
a11_mark "@ME-069 olli-traegt-bildschirm-direkt-ein-abgelehnt           " "$r" "fehler|0|$A27_GUARD_ROLLE"
r="$(a27_probe "$U_OWNER" "SELECT public.a27_test_insert_member('$T_MAIN','$U_ANON_DEVICE','screen');" "SELECT role FROM public.tournament_collaborators WHERE user_id = '$U_ANON_DEVICE'" "$A27_DEFINER")"
a11_mark "@ME-069 gegen-definer-kopplung-legt-bildschirm-an             " "$(cut -d'|' -f2 <<<"$r")" "screen"
A27_TOM_ROLE="SELECT role FROM public.tournament_collaborators WHERE id = '$MEMBERSHIP_HELPER_DEVICE'"
r="$(a27_probe "$U_OWNER" "UPDATE public.tournament_collaborators SET role = 'co-admin' WHERE id = '$MEMBERSHIP_HELPER_DEVICE';" "$A27_TOM_ROLE")"
a11_mark "@HE-084 olli-macht-toms-zugang-zur-co-admin-abgelehnt         " "$r" "fehler|helper|$A27_GUARD_GERAET"
r="$(a27_probe "$U_OWNER" "UPDATE public.tournament_collaborators SET user_id = '$U_NONMEMBER' WHERE id = '$MEMBERSHIP_HELPER_DEVICE';" "SELECT role || '/' || (user_id = '$U_HELPER_DEVICE')::text FROM public.tournament_collaborators WHERE id = '$MEMBERSHIP_HELPER_DEVICE'")"
a11_mark "@HE-084 olli-haengt-toms-zugang-auf-konto-um-abgelehnt        " "$(cut -d'|' -f1,2 <<<"$r")" "fehler|helper/true"
r="$(a27_probe "$U_HELPER_DEVICE" "UPDATE public.tournament_collaborators SET role = 'co-admin' WHERE id = '$MEMBERSHIP_HELPER_DEVICE';" "$A27_TOM_ROLE")"
a11_mark "@HE-084 tom-macht-sich-selbst-zur-co-admin-abgelehnt          " "$(cut -d'|' -f1,2 <<<"$r")" "fehler|helper"
r="$(a27_probe "$U_OWNER" "UPDATE public.tournament_collaborators SET role = 'trainer' WHERE id = '$MEMBERSHIP_COLLAB_MAIN';" "SELECT role FROM public.tournament_collaborators WHERE id = '$MEMBERSHIP_COLLAB_MAIN'")"
a11_mark "@HE-084 gegen-olli-collaborator-konto-wird-trainer            " "$(cut -d'|' -f1,2 <<<"$r")" "1|trainer"

# --- (iv) Hook-Unit (T9, @AN-006, @AN-005): als supabase_auth_admin, nie Ausnahme -------------------------------------
a27_hook() {
  docker exec -i -e PGPASSWORD=postgres "$CONTAINER_NAME" psql -h 127.0.0.1 -U supabase_admin -d postgres -X -q -tA \
    -c "SET ROLE supabase_auth_admin; SELECT coalesce(public.hook_before_user_created($1)->'error'->>'http_code', 'ok');" 2>&1 | tail -1
}
a11_mark "@AN-006 hook-anonyme-geraetesitzung-entsteht                  " "$(a27_hook "'{\"user\":{\"is_anonymous\":true}}'::jsonb")" "ok"
a11_mark "@AN-006 hook-registrierung-email-abgelehnt                    " "$(a27_hook "'{\"user\":{\"is_anonymous\":false,\"app_metadata\":{\"provider\":\"email\"}}}'::jsonb")" "403"
a11_mark "@AN-006 hook-google-abgelehnt                                 " "$(a27_hook "'{\"user\":{\"is_anonymous\":false,\"app_metadata\":{\"provider\":\"google\"}}}'::jsonb")" "403"
a11_mark "@AN-005 hook-ereignis-ohne-user-kein-fehler-abgelehnt         " "$(a27_hook "'{}'::jsonb")" "403"
a11_mark "@AN-005 hook-ereignis-null-kein-fehler-abgelehnt              " "$(a27_hook "NULL")" "403"
r="$(a27_sql authenticated "$U_OWNER" "SELECT public.hook_before_user_created('{}'::jsonb);")"
a11_mark "@AN-006 hook-nicht-fuer-authenticated-ausfuehrbar             " "$(grep -c 'permission denied for function hook_before_user_created' <<<"$r")" "1"

# --- (v) Fixrunde 1 K1 (@AN-006, C-ANON-ZU-KONTO): aus einer Geraetesitzung wird kein Konto ----------------------------
# Das Pruef-Image hat keine Spalte auth.users.is_anonymous (ALTER auf auth.users nicht erlaubt). Gemessen wird deshalb
# (1) dass der Trigger auf auth.users haengt und (2) die Trigger-Funktion selbst an einer gleich gebauten Tabelle
# (nie committete Transaktion, als supabase_admin). Den Weg durch den Auth-Dienst belegt der Wegwerf-Stack
# (A-27-hook-beweis.log) und die Cloud-E2E @AN-006.
a27_admin() {
  docker exec -i -e PGPASSWORD=postgres "$CONTAINER_NAME" psql -h 127.0.0.1 -U supabase_admin -d postgres -X -q -tA <<SQL 2>&1 | grep -vE '^(BEGIN|ROLLBACK|CREATE TABLE|CREATE TRIGGER|INSERT 0 [0-9]+)?$' | sed 's/^ERROR: */fehler: /' | head -1
BEGIN;
CREATE TEMP TABLE a27_users (id uuid, email text, is_anonymous boolean) ON COMMIT DROP;
CREATE TRIGGER a27_block BEFORE UPDATE ON a27_users FOR EACH ROW EXECUTE FUNCTION public.block_anonymous_upgrade();
INSERT INTO a27_users VALUES ('$U_ANON_DEVICE', NULL, true), ('$U_OWNER', 'owner@rls-matrix.test', false);
$1
ROLLBACK;
SQL
}
a11_mark "@AN-006 trigger-block-anonymous-upgrade-haengt-an-auth-users  " \
  "$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT count(*) FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'block_anonymous_upgrade' AND tgenabled = 'O'")" "1"
a11_mark "@AN-006 lena-setzt-email-und-wird-konto-abgelehnt             " \
  "$(a27_admin "UPDATE a27_users SET email = 'lena@example.test', is_anonymous = false WHERE id = '$U_ANON_DEVICE'; SELECT 'durchgelassen';")" \
  "fehler: Nicht erlaubt: aus einer Geraetesitzung wird kein Konto (Konten legt der Betreiber an)."
a11_mark "@AN-006 gegen-lena-bleibt-anonym-andere-aenderung-gelingt     " \
  "$(a27_admin "UPDATE a27_users SET email = NULL WHERE id = '$U_ANON_DEVICE'; SELECT 'anonym=' || is_anonymous FROM a27_users WHERE id = '$U_ANON_DEVICE';")" "anonym=true"
a11_mark "@AN-006 gegen-olli-konto-aendert-email                        " \
  "$(a27_admin "UPDATE a27_users SET email = 'olli-neu@rls-matrix.test' WHERE id = '$U_OWNER'; SELECT email FROM a27_users WHERE id = '$U_OWNER';")" "olli-neu@rls-matrix.test"
a11_mark "@AN-006 gegen-auth-users-update-eines-kontos-gelingt          " \
  "$(docker exec -i -e PGPASSWORD=postgres "$CONTAINER_NAME" psql -h 127.0.0.1 -U supabase_admin -d postgres -X -q -tA -c "BEGIN; UPDATE auth.users SET email = 'olli-neu@rls-matrix.test' WHERE id = '$U_OWNER'; SELECT email FROM auth.users WHERE id = '$U_OWNER'; ROLLBACK;" 2>&1 | grep -vE '^(BEGIN|ROLLBACK)?$' | head -1)" "olli-neu@rls-matrix.test"
