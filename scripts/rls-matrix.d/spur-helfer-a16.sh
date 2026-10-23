# shellcheck shell=bash
#
# rls-matrix.d/spur-helfer-a16.sh — Zeilen von A-16 (Plan GA5 v2.1, 20261110_008_helper_join.sql) fuer
# scripts/rls-role-matrix.sh. Per `source` eingebunden NACH spur-geraete-a27.sh (Glob-Reihenfolge "spur-g" < "spur-h"
# < "spur-s"); nutzt a27_sql/a11_mark und claims_line() (anonyme Geraetesitzungen tragen is_anonymous).
#
# Eigenes Turnier „Live-Cup“ (Olli = U_OWNER, Maria = U_COADMIN als Co-Admin, Konto-Helfer = U_COLLAB als collaborator,
# morgen, damit der Code offen ist; 1 Spiel, 2 Teams). Die Geraete entstehen ueber den echten Weg (ensure_helper_code,
# request_helper_access, decide_join_request mit Pruefzahl, change_helper_access): zugelassen (Tom), offen (Lena),
# abgelehnt (Fremder), entzogen (verlorenes Handy), herabgestuft (Clara, „Nur zusehen“). Dazu Greta = U_NONMEMBER
# (Konto ohne Rolle), anon = Mama Petra ohne Sitzung.
# Je Identitaet: (i) writeMatchData, (ii) Code holen, (iii) Uebersicht, (iv) Zaehler, (v) offene Anfrage entscheiden,
# (vi) Zugang herabstufen, (vii) Tabellen direkt lesen, (viii) Spiele/Teams lesen (I-2: Helfer und herabgestuftes Geraet
# lesen weiter), (ix) Zugangsstatus. Dazu M2/K-3 fuer den Eigentuemer. Gegenprobe: --without-a16 (Funktionen fehlen ->
# rot).

A16_MISMATCHES=0
A16_CELLS=0
a16_cell() { # a16_cell <Name> <erhalten> <erwartet>
  A16_CELLS=$((A16_CELLS + 1))
  TOTAL=$((TOTAL + 1))
  if [[ "$2" != "$3" ]]; then
    MISMATCHES=$((MISMATCHES + 1)); A16_MISMATCHES=$((A16_MISMATCHES + 1))
    printf 'a16 %-66s: %s!=%s\n' "$1" "$2" "$3"
  fi
}
# a16_commit <uid> <sql> -- als Client, COMMIT (Fixtures ueber den echten Weg); Ausgabe roh
a16_commit() {
  local uid="$1" sql="$2" out
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$uid'; $(claims_line "$uid")
$sql
COMMIT;
SQL
)"
  set -e
  echo "$out"
}
a16_su() { docker exec -i "$CONTAINER_NAME" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 <<<"$1" 2>&1 || true; }
a16_err() { grep -qE '^ERROR:' <<<"$1" && echo "fehler:$(grep -m1 '^ERROR:' <<<"$1" | sed -E 's/^ERROR: +//' | cut -c1-40)" || echo "$1"; }

T_A16="$(uuid_for a16-tournament:live-cup)"
A16_TEAM_1="$(uuid_for a16-team:nord)"; A16_TEAM_2="$(uuid_for a16-team:sued)"; A16_MATCH="$(uuid_for a16-match:spiel-3)"
U_A16_TOM="$(uuid_for a16-user:tom-zugelassen)"; U_A16_LENA="$(uuid_for a16-user:lena-offen)"
U_A16_FREMD="$(uuid_for a16-user:fremder-abgelehnt)"; U_A16_HANDY="$(uuid_for a16-user:verlorenes-handy)"
U_A16_CLARA="$(uuid_for a16-user:clara-herabgestuft)"
ANONYMOUS_UIDS="$ANONYMOUS_UIDS$U_A16_TOM $U_A16_LENA $U_A16_FREMD $U_A16_HANDY $U_A16_CLARA "
a16_su "BEGIN;
INSERT INTO auth.users (instance_id, id, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'x', '{}', '{}', now(), now()
  FROM unnest(ARRAY['$U_A16_TOM', '$U_A16_LENA', '$U_A16_FREMD', '$U_A16_HANDY', '$U_A16_CLARA']::uuid[]) u;
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, number_of_fields, status, config)
VALUES ('$T_A16', '$U_OWNER', 'Live-Cup', current_date + 1, 4, 10, 2, 'live', '{}'::jsonb);
INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at, label)
VALUES ('$T_A16', '$U_COADMIN', 'co-admin', now(), 'Maria'), ('$T_A16', '$U_COLLAB', 'collaborator', now(), 'Kim');
INSERT INTO public.teams (id, tournament_id, name) VALUES ('$A16_TEAM_1', '$T_A16', 'FC Nord'), ('$A16_TEAM_2', '$T_A16', 'SV Süd');
INSERT INTO public.matches (id, tournament_id, round, field, match_number, scheduled_start, team_a_id, team_b_id$SLOT_COLS)
VALUES ('$A16_MATCH', '$T_A16', 1, 2, 3, '10:00', '$A16_TEAM_1', '$A16_TEAM_2'$SLOT_VALS);
COMMIT;" >/dev/null

A16_CODE="$(a16_commit "$U_OWNER" "SELECT public.ensure_helper_code('$T_A16') ->> 'code';")"
for a16_pair in "$U_A16_TOM:Tom" "$U_A16_LENA:Lena" "$U_A16_FREMD:Tom" "$U_A16_HANDY:Tom" "$U_A16_CLARA:Clara"; do
  a16_commit "${a16_pair%%:*}" "SELECT public.request_helper_access('$A16_CODE', '${a16_pair#*:}', 'Handy');" >/dev/null
done
a16_req() { a16_su "SELECT id FROM public.tournament_join_requests WHERE tournament_id = '$T_A16' AND device_user_id = '$1';"; }
a16_no() { a16_su "SELECT check_number FROM public.tournament_join_requests WHERE id = '$1';"; }
for a16_u in "$U_A16_TOM" "$U_A16_HANDY" "$U_A16_CLARA"; do
  a16_r="$(a16_req "$a16_u")"
  a16_commit "$U_OWNER" "SELECT public.decide_join_request('$a16_r', true, 2, '$(a16_no "$a16_r")'::smallint);" >/dev/null
done
a16_commit "$U_OWNER" "SELECT public.decide_join_request('$(a16_req "$U_A16_FREMD")', false);" >/dev/null
a16_mem() { a16_su "SELECT id FROM public.tournament_collaborators WHERE tournament_id = '$T_A16' AND user_id = '$1';"; }
a16_commit "$U_COADMIN" "SELECT public.change_helper_access('$(a16_mem "$U_A16_HANDY")', 'revoke');" >/dev/null
a16_commit "$U_COADMIN" "SELECT public.change_helper_access('$(a16_mem "$U_A16_CLARA")', 'watch_only');" >/dev/null
A16_PENDING="$(a16_req "$U_A16_LENA")"
A16_PENDING_NO="$(a16_no "$A16_PENDING")"
A16_TOM_MEMBER="$(a16_mem "$U_A16_TOM")"
A16_CLARA_MEMBER="$(a16_mem "$U_A16_CLARA")"

# Identitaet -> uid | Erwartung writeMatchData | darf verwalten (manageHelpers + echtes Konto) | liest Spiele | Status
for a16_id in olli maria konto-helfer greta tom lena fremder handy clara; do
  case "$a16_id" in
    olli) a16_uid="$U_OWNER"; a16_w=t; a16_m=1; a16_read=1; a16_status="none" ;;
    maria) a16_uid="$U_COADMIN"; a16_w=t; a16_m=1; a16_read=1; a16_status="none" ;;
    konto-helfer) a16_uid="$U_COLLAB"; a16_w=t; a16_m=0; a16_read=1; a16_status="none" ;;
    greta) a16_uid="$U_NONMEMBER"; a16_w=f; a16_m=0; a16_read=0; a16_status="none" ;;
    tom) a16_uid="$U_A16_TOM"; a16_w=t; a16_m=0; a16_read=1; a16_status="accepted" ;;
    lena) a16_uid="$U_A16_LENA"; a16_w=f; a16_m=0; a16_read=0; a16_status="pending" ;;
    fremder) a16_uid="$U_A16_FREMD"; a16_w=f; a16_m=0; a16_read=0; a16_status="declined" ;;
    handy) a16_uid="$U_A16_HANDY"; a16_w=f; a16_m=0; a16_read=0; a16_status="revoked" ;;
    clara) a16_uid="$U_A16_CLARA"; a16_w=f; a16_m=0; a16_read=1; a16_status="viewer" ;;
  esac
  a16_cell "@HE-073/@HE-080/@HE-055 writeMatchData $a16_id" \
    "$(a27_sql authenticated "$a16_uid" "SELECT public.has_tournament_permission('$T_A16', 'writeMatchData');")" "$a16_w"
  if [[ "$a16_m" == 1 ]]; then
    a16_exp_code="code"; a16_exp_list="2"; a16_exp_count="1"; a16_exp_dec="OK"; a16_exp_chg="OK"
  else
    a16_exp_code="fehler:Not authorized"; a16_exp_list="fehler:Not authorized"; a16_exp_count="fehler:Not authorized"
    a16_exp_dec="fehler:Not authorized"; a16_exp_chg="fehler:Not authorized"
  fi
  a16_out="$(a16_err "$(a27_sql authenticated "$a16_uid" "SELECT public.ensure_helper_code('$T_A16') ->> 'code';")")"
  [[ "$a16_out" == "$A16_CODE" ]] && a16_out="code"
  a16_cell "@HE-062 ensure_helper_code $a16_id" "$a16_out" "$a16_exp_code"
  a16_cell "@HE-052 list_helper_access (Mitglieder aus dem QR-Beitritt ohne Entzug) $a16_id" \
    "$(a16_err "$(a27_sql authenticated "$a16_uid" "SELECT count(*) FROM jsonb_array_elements(public.list_helper_access('$T_A16') -> 'members') m WHERE m ->> 'revokedAt' IS NULL;")")" "$a16_exp_list"
  a16_cell "@HE-051 helper_request_count $a16_id" \
    "$(a16_err "$(a27_sql authenticated "$a16_uid" "SELECT public.helper_request_count('$T_A16');")")" "$a16_exp_count"
  a16_cell "@HE-001/@HE-105 decide_join_request (richtige Pruefzahl) $a16_id" \
    "$(a16_err "$(a27_sql authenticated "$a16_uid" "SELECT public.decide_join_request('$A16_PENDING', true, 1, '$A16_PENDING_NO'::smallint) ->> 'result';")")" "$a16_exp_dec"
  a16_cell "@HE-055 change_helper_access watch_only (Tom) $a16_id" \
    "$(a16_err "$(a27_sql authenticated "$a16_uid" "SELECT public.change_helper_access('$A16_TOM_MEMBER', 'watch_only') ->> 'result';")")" "$a16_exp_chg"
  a16_cell "Tabellen tournament_join_codes/_requests direkt $a16_id" \
    "$(a16_err "$(a27_sql authenticated "$a16_uid" "SELECT count(*) FROM public.tournament_join_requests;")" | cut -c1-24)" "fehler:permission denied"
  a16_out="$(a27_sql authenticated "$a16_uid" "SELECT (SELECT count(*) FROM public.matches WHERE tournament_id = '$T_A16') || '|' || (SELECT count(*) FROM public.teams WHERE tournament_id = '$T_A16');")"
  [[ "$a16_read" == 1 ]] && a16_exp="1|2" || a16_exp="0|0"
  a16_cell "I-2 Spiele/Teams des Live-Cup lesen $a16_id" "$a16_out" "$a16_exp"
  a16_cell "@HE-098 helper_access_status $a16_id" \
    "$(a27_sql authenticated "$a16_uid" "SELECT public.helper_access_status('$T_A16') ->> 'relation';")" "$a16_status"
done

# Ohne Sitzung (Mama Petra): Scan ja, sonst nichts.
a16_cell "@HE-033 anon join_code_info (Turniername)" "$(a27_sql anon "" "SELECT public.join_code_info('$A16_CODE') -> 'tournament' ->> 'title';")" "Live-Cup"
for a16_fn in "request_helper_access('$A16_CODE', 'Petra')" "list_helper_access('$T_A16')" "ensure_helper_code('$T_A16')" "helper_request_count('$T_A16')" "helper_access_status('$T_A16')"; do
  a16_cell "anon ohne EXECUTE ${a16_fn%%(*}" "$(a16_err "$(a27_sql anon "" "SELECT public.$a16_fn;")" | cut -c1-24)" "fehler:permission denied"
done
# M2/@HE-104 und K-3/@HE-084: Eigentuemer per REST
a16_cell "@HE-104 Olli loescht Toms Zugang per REST -> 0 Zeilen" \
  "$(a27_sql authenticated "$U_OWNER" "WITH d AS (DELETE FROM public.tournament_collaborators WHERE id = '$A16_TOM_MEMBER' RETURNING 1) SELECT count(*) FROM d;")" "0"
a16_cell "@HE-084 K-3 Olli macht Claras herabgestuften Zugang zur Co-Admin -> Fehler" \
  "$(a16_err "$(a27_sql authenticated "$U_OWNER" "UPDATE public.tournament_collaborators SET role = 'co-admin' WHERE id = '$A16_CLARA_MEMBER';")" | cut -c1-14)" "fehler:Nicht e"
a16_cell "@HE-104 Gegenbeispiel: Olli loescht die Konto-Zeile Kim (collaborator) weiter" \
  "$(a27_sql authenticated "$U_OWNER" "WITH d AS (DELETE FROM public.tournament_collaborators WHERE tournament_id = '$T_A16' AND user_id = '$U_COLLAB' RETURNING 1) SELECT count(*) FROM d;")" "1"

echo "a16-helfer: $A16_CELLS Zellen geprueft (9 Identitaeten x 9 + 6 ohne Sitzung + 3 Eigentuemer), $A16_MISMATCHES Abweichung(en)"
