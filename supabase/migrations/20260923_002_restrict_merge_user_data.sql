-- merge_user_data() nur noch für den Service-Role-Schlüssel ausführbar.
--
-- Anlass: Das adversariale Review von 20260923_001 (F1) fand, dass die SECURITY-DEFINER-Funktion
-- merge_user_data(p_source_user_id, p_target_user_id) keinerlei Berechtigungsprüfung enthält
-- und live von PUBLIC, anon und authenticated ausführbar ist (pg_proc.proacl am 23.09.2026:
-- "=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres").
--
-- Folge heute: Jeder, auch ohne Anmeldung, kann das Profil eines beliebigen Nutzers löschen, der
-- kein eigenes Turnier besitzt (die Funktion endet mit DELETE FROM profiles WHERE id = source).
-- Die Nutzer-IDs liefert profiles_select_all (USING true). Die Übernahme fremder Turniere
-- scheitert heute nur daran, dass die Funktion die nicht existierende Tabelle
-- tournament_members anspricht und alles zurückrollt; ein Aufräumen dieser Zeile hätte sie
-- vollständig geöffnet.
--
-- Einziger legitimer Aufrufer: die Edge Function supabase/functions/merge-accounts, und zwar
-- über den Admin-Client mit SUPABASE_SERVICE_ROLE_KEY (index.ts:140, supabaseAdmin.rpc). Die
-- App ruft die Funktion nirgends direkt auf. Der Entzug für anon/authenticated bricht also
-- keinen Pfad.
--
-- Bewusst NICHT angefasst: die fehlerhafte Zeile mit tournament_members. Sie wird getrennt
-- korrigiert, sobald der Merge-Ablauf wieder gebraucht wird. Mit dieser Migration ist die
-- Funktion ohnehin nur noch serverseitig erreichbar.

REVOKE ALL ON FUNCTION "public"."merge_user_data"("uuid", "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."merge_user_data"("uuid", "uuid") FROM "anon";
REVOKE ALL ON FUNCTION "public"."merge_user_data"("uuid", "uuid") FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."merge_user_data"("uuid", "uuid") TO "service_role";
