-- ============================================================================
-- 20261028_002_match_events_only_rpc.sql
-- A-08h (Befund C-MATCH-EVENTS-DIREKTWEG; Anforderungen @FU-084 und @FU-085):
-- Clients schreiben match_events nur noch über public.append_match_events (SECURITY DEFINER).
-- Entfernt die drei Client-Schreib-Policies auf match_events und entzieht anon/authenticated
-- INSERT/UPDATE/DELETE/TRUNCATE. Lesen bleibt (match_events_select_v3, Realtime).
-- Direktwege werden von der Datenbank mit 42501 abgelehnt, auch für den Eigentümer.
-- Unberührt: service_role, postgres (Seeds, Aufräumen), SECURITY-DEFINER-Schreiber
-- (append_match_events, cascade_tournament_visibility, merge_user_data), FK-Kaskaden.
-- Idempotent: DROP POLICY IF EXISTS und REVOKE sind beliebig oft wiederholbar.
--
-- RUECKBAU (nur wenn eine alte App-Fassung direkt schreiben muss; seit A-08d2a schreibt kein
-- Client-Code mehr direkt). NICHT diese Datei bearbeiten, sondern eine neue Rueckbau-Migration
-- anlegen. Die Policies stehen wörtlich aus 20260924_002_central_role_permissions.sql:363-400:
--   GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.match_events TO anon, authenticated;
--   CREATE POLICY "match_events_insert_v3" ON "public"."match_events"
--     FOR INSERT TO "authenticated", "anon"
--     WITH CHECK (
--       "public"."has_tournament_permission"(
--         ( SELECT "tournament_id" FROM "public"."matches" WHERE "id" = "match_events"."match_id" ),
--         'writeMatchData'
--       )
--     );
--   CREATE POLICY "match_events_update_v2" ON "public"."match_events"
--     FOR UPDATE TO "authenticated", "anon"
--     USING (
--       "public"."has_tournament_permission"(
--         ( SELECT "tournament_id" FROM "public"."matches" WHERE "id" = "match_events"."match_id" ),
--         'correctEvents'
--       )
--     )
--     WITH CHECK (
--       "public"."has_tournament_permission"(
--         ( SELECT "tournament_id" FROM "public"."matches" WHERE "id" = "match_events"."match_id" ),
--         'correctEvents'
--       )
--     );
--   CREATE POLICY "match_events_delete_v2" ON "public"."match_events"
--     FOR DELETE TO "authenticated", "anon"
--     USING (
--       "public"."has_tournament_permission"(
--         ( SELECT "tournament_id" FROM "public"."matches" WHERE "id" = "match_events"."match_id" ),
--         'correctEvents'
--       )
--     );
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

DROP POLICY IF EXISTS "match_events_insert_v3" ON "public"."match_events";
DROP POLICY IF EXISTS "match_events_update_v2" ON "public"."match_events";
DROP POLICY IF EXISTS "match_events_delete_v2" ON "public"."match_events";

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "public"."match_events" FROM "anon", "authenticated";

COMMIT;
