# shellcheck shell=bash
#
# gatherings-check.d/25-version.sh — Kategorie A: Version und Rechte ueber die ECHTE Server-Antwort (Wegwerf-PostgREST,
# rohe HTTP-Aufrufe mit selbst signiertem JWT je Rolle; Pruefregel @ZM-180: jeder Uebertragungsweg zu Zuschauern braucht
# einen Test ueber die echte Antwort). Festgeschriebene Daten (Veranstaltung „AVERS1“), danach aufgeraeumt.
#
# Vor jedem Schritt altern die Zeitstempel (Harness, Trigger aus): Veranstaltung und Spiele -3 min, F1 -2 min, F2 -1 min.
# Dann entfernt der Schritt den juengsten Zeitstempel aus dem Maximum (Loesen, Papierkorb, Loeschen, Anpfiff zurueck) --
# die Version darf trotzdem nicht sinken (sonst verwirft die Seite den neueren Stand, @ZM-180, @VA-012, @VA-014).

G_A="$(uuid_for gathering:version)"; T_TMP="$(uuid_for tournament:probe-loeschen)"
if q "SELECT to_regclass('public.gatherings') IS NOT NULL;" | grep -qx t; then
  psql_stdin <<SQL || true
-- Spielzeiten sichern: age() verschiebt sie, danach exakt zurueck (die Antworten "vorher" der Kategorie T bleiben gueltig,
-- auch fuer die naechste Mutation der Gegenprobe).
DROP TABLE IF EXISTS harness.matches_sicherung, harness.turnier_sicherung;
CREATE TABLE harness.matches_sicherung AS
  SELECT id, actual_start, match_status, updated_at FROM public.matches WHERE tournament_id IN ('$T_F2', '$T_F1');
CREATE TABLE harness.turnier_sicherung AS
  SELECT id, lifecycle_status, finished_at FROM public.tournaments WHERE id IN ('$T_F2', '$T_F1');
INSERT INTO public.gatherings (id, owner_id, name, share_code) VALUES ('$G_A', '$U_OLLI', '$G_NAME', 'AVERS1');
UPDATE public.tournaments SET gathering_id = '$G_A' WHERE id IN ('$T_F2', '$T_F1');
SQL
  A_READY=1
else
  A_READY=0
fi
age() {
  psql_stdin <<SQL || true
SET session_replication_role = replica;
UPDATE public.gatherings SET updated_at = now() - interval '3 minutes' WHERE id = '$G_A';
UPDATE public.tournaments SET updated_at = now() - interval '2 minutes' WHERE id = '$T_F1';
UPDATE public.tournaments SET updated_at = now() - interval '1 minute' WHERE id = '$T_F2';
UPDATE public.matches SET updated_at = now() - interval '3 minutes',
                          actual_start = CASE WHEN actual_start IS NULL THEN NULL ELSE now() - interval '3 minutes' END
 WHERE tournament_id IN ('$T_F2', '$T_F1');
UPDATE public_view.structure_changes SET changed_at = now() - interval '3 minutes' WHERE tournament_id IN ('$T_F2', '$T_F1');
SQL
}
vers() { rpc anon public_gathering '{"p_code":"AVERS1"}' | jq -r '.version // "keine"' 2>/dev/null || echo keine; }
rises() { # rises <vorher> <nachher> -> "steigt" | "faellt(v0 -> v1)"
  if [[ "$1" =~ ^[0-9]+$ && "$2" =~ ^[0-9]+$ && "$2" -gt "$1" ]]; then echo steigt; else echo "faellt($1 -> $2)"; fi
}

if [[ "$A_READY" -eq 1 ]]; then
  R0="$(rpc anon public_gathering '{"p_code":"AVERS1"}')"
  check A "echte Antwort (HTTP) fuer anon ohne Sitzung: 200, full, zwei Turniere" "200|full|2" \
    "$(cat "$WORK/st")|$(jq -r '.state + "|" + (.tournaments | length | tostring)' <<<"$R0" 2>/dev/null || echo "$R0")"

  age; v0="$(vers)"
  rpc "$U_OLLI" set_gathering_tournaments "{\"p_gathering_id\":\"$G_A\",\"p_add\":[],\"p_remove\":[\"$T_F2\"]}" >/dev/null
  st="$(cat "$WORK/st")"; v1="$(vers)"
  check A "@ZM-180 @VA-014 Olli loest F2 ueber die Schnittstelle (HTTP 200): Version steigt, obwohl F2 aus dem Maximum faellt" \
    "200|steigt" "$st|$(rises "$v0" "$v1")"
  psql_stdin <<<"UPDATE public.tournaments SET gathering_id = '$G_A' WHERE id = '$T_F2';" || true

  age; v0="$(vers)"
  psql_stdin <<<"UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_F2';" || true
  v1="$(vers)"
  check A "@ZM-180 F2 in den Papierkorb: Version steigt" "steigt" "$(rises "$v0" "$v1")"
  age; v0="$(vers)"
  psql_stdin <<<"UPDATE public.tournaments SET deleted_at = NULL WHERE id = '$T_F2';" || true
  check A "@ZM-180 F2 aus dem Papierkorb zurueck: Version steigt" "steigt" "$(rises "$v0" "$(vers)")"

  psql_stdin <<SQL || true
INSERT INTO public.tournaments (id, owner_id, title, date, number_of_teams, group_phase_duration, is_public, share_code, config, status)
VALUES ('$T_TMP', '$U_OLLI', 'Probe zum Loeschen', current_date + 5, 2, 10, true, 'PROBE1', '{"publishedAt":"2026-11-01"}', 'published');
UPDATE public.tournaments SET gathering_id = '$G_A' WHERE id = '$T_TMP';
SQL
  age
  psql_stdin <<<"SET session_replication_role = replica; UPDATE public.tournaments SET updated_at = now() - interval '30 seconds' WHERE id = '$T_TMP';" || true
  v0="$(vers)"
  psql_stdin <<<"DELETE FROM public.tournaments WHERE id = '$T_TMP';" || true
  check A "@ZM-180 zugeordnetes Turnier endgueltig geloescht: Version steigt" "steigt" "$(rises "$v0" "$(vers)")"

  age
  psql_stdin <<<"SET session_replication_role = replica; UPDATE public.matches SET match_status = 'running', actual_start = now() - interval '30 seconds' WHERE id = '$M_F2_2';" || true
  v0="$(vers)"
  psql_stdin <<<"UPDATE public.matches SET match_status = 'scheduled', actual_start = NULL WHERE id = '$M_F2_2';" || true
  check A "@ZM-180 zurueckgenommener Anpfiff (actual_start wieder leer): Version steigt" "steigt" "$(rises "$v0" "$(vers)")"

  age; v0="$(vers)"
  rpc "$U_OLLI" rename_gathering "{\"p_gathering_id\":\"$G_A\",\"p_name\":\"Hallenturniere TSV Waging 2026\"}" >/dev/null
  st="$(cat "$WORK/st")"
  R5="$(rpc anon public_gathering '{"p_code":"AVERS1"}')"
  check A "@VA-015 Z. 2 Umbenennen ueber die Schnittstelle: beim naechsten Abruf neuer Name, gleicher Code, Version steigt" \
    "204|Hallenturniere TSV Waging 2026|steigt" "$st|$(jq -r '.name' <<<"$R5" 2>/dev/null)|$(rises "$v0" "$(jq -r '.version' <<<"$R5" 2>/dev/null)")"

  age; v0="$(vers)"
  psql_stdin <<<"SET app.lifecycle_write = 'on'; UPDATE public.tournaments SET lifecycle_status = 'finished', finished_at = now() WHERE id = '$T_F2'; RESET app.lifecycle_write;" || true
  R6="$(rpc anon public_gathering '{"p_code":"AVERS1"}')"
  check A "@VA-012 F2 abgeschlossen: Zustand finished mit hoeherer Version (ein aelterer Stand ist am Client erkennbar)" \
    "finished|steigt" "$(jq -r '[.tournaments[] | select(.share_code == "F2JUNI") | .state][0]' <<<"$R6" 2>/dev/null)|$(rises "$v0" "$(jq -r '.version' <<<"$R6" 2>/dev/null)")"

  # Rechte ueber rohe REST-Aufrufe (@VA-011, @VA-021).
  rpc anon set_gathering_tournaments "{\"p_gathering_id\":\"$G_A\",\"p_add\":[\"$T_D\"],\"p_remove\":[]}" >/dev/null
  a_anon="$(cat "$WORK/st")"
  b_maria="$(rpc "$U_MARIA" set_gathering_tournaments "{\"p_gathering_id\":\"$G_A\",\"p_add\":[],\"p_remove\":[\"$T_F2\"]}" | jq -r '.code' 2>/dev/null || true)"
  b_patch="$(curl -s -o "$WORK/b" -w '%{http_code}' -X PATCH "http://127.0.0.1:$REST_PORT/tournaments?id=eq.$T_F2" \
    -H "Authorization: Bearer $(tok_for "$U_MARIA")" -H 'Content-Type: application/json' --data '{"gathering_id":null}')"
  b_patch="$b_patch:$(jq -r '.code' "$WORK/b" 2>/dev/null || true)"
  check A "@VA-011 @VA-021 REST: anon 401, Maria per RPC HF006, Maria per PATCH auf tournaments HF006; F2 bleibt" \
    "401|HF006|400:HF006|$G_A" "$a_anon|$b_maria|$b_patch|$(q "SELECT gathering_id FROM public.tournaments WHERE id = '$T_F2';")"
  rows_of() { curl -s -w '\n%{http_code}' "http://127.0.0.1:$REST_PORT/$2" -H "Authorization: Bearer $(tok_for "$1")" \
    | { read -r body; read -r code; if [[ "$code" == "200" ]]; then jq 'length' <<<"$body"; else echo "http-$code"; fi; }; }
  check A "REST lesen: Olli sieht seine Veranstaltung, Clara und Maria nicht, anon gar nicht, Mitglieder fuer niemanden" \
    "1|0|0|http-401|http-403" \
    "$(rows_of "$U_OLLI" "gatherings?id=eq.$G_A")|$(rows_of "$U_CLARA" "gatherings")|$(rows_of "$U_MARIA" "gatherings")|$(rows_of anon "gatherings")|$(rows_of "$U_OLLI" "gathering_members")"

  # Aufraeumen (auch unter Mutationen; ein Fehler bricht nur seinen eigenen Schritt ab): Spiele und Zustand exakt zurueck,
  # dann Zuordnung loesen und die Veranstaltung loeschen.
  psql_stdin <<<"SET session_replication_role = replica;
UPDATE public.matches m SET actual_start = b.actual_start, match_status = b.match_status, updated_at = b.updated_at
  FROM harness.matches_sicherung b WHERE b.id = m.id;
DROP TABLE harness.matches_sicherung;" || true
  psql_stdin <<<"SET app.lifecycle_write = 'on';
UPDATE public.tournaments t SET lifecycle_status = b.lifecycle_status, finished_at = b.finished_at
  FROM harness.turnier_sicherung b WHERE b.id = t.id;
DROP TABLE harness.turnier_sicherung;" || true
  psql_stdin <<<"UPDATE public.tournaments SET gathering_id = NULL WHERE gathering_id = '$G_A';
DELETE FROM public.gatherings WHERE id = '$G_A';" || true
else
  check A "Veranstaltung ueber die echte Server-Antwort (Tabelle gatherings fehlt)" "vorhanden" "fehlt"
fi
