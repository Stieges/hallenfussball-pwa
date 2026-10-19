-- supabase/migrations/20261110_001_role_permissions_mvp.sql
-- A-11 (MVP-Bauplan, brief-A-11.md): Rechte fuer den MVP und die Policies, die sie pruefen
-- (@ZP-040, @ZP-041, @ZP-084, @LZ-022, @LZ-023, @TM-083, @TM-084, @ZM-019, @W5-017, @HE-042; Befund C-RECHTE-KORREKTUR).
--
-- Inhalt:
--   A. role_permissions_permission_check um manageSchedule, manageLifecycle, manageScreens, manageHelpers, readDisplay.
--   B. co-admin bekommt die vier manage*-Rechte; collaborator (Helfer) verliert teams und correctEvents.
--      readDisplay bekommt keine Rolle (Rolle screen kommt mit A-27).
--   C. matches_update_v3 (writeMatchData) -> matches_update_v4 (manageSchedule). Seit 20261028_005/004 aendert ein Client
--      an matches nur noch Spielplan-Spalten; die darf nur, wer den Zeitplan aendern darf (@ZP-041).
--   D. monitors: Schreiben und Lesen nicht-oeffentlicher Monitore ueber manageScreens statt nur Eigentuemer (@ZM-019).
--
-- Nicht geaendert: has_tournament_permission, append_match_events, reset_match_results, Rollen-CHECK (A-27),
-- alle uebrigen Policies. Keine Datenaenderung ausser role_permissions.
-- Idempotent: DROP CONSTRAINT/POLICY IF EXISTS + CREATE, INSERT ... ON CONFLICT DO NOTHING, DELETE.
--
-- RUECKWEG (zuerst die App zurueck -- die neue App blendet nach den neuen Rechten aus; DANN die DB, eigene Datei
-- <Datum>_<NNN>_role_permissions_mvp_rollback.sql, in EINEM Block):
--   BEGIN; SET LOCAL lock_timeout = '5s';
--   DROP POLICY IF EXISTS matches_update_v4 ON public.matches;
--   -- matches_update_v3 woertlich aus 20260924_002_central_role_permissions.sql (Abschnitt Policies, :347-356)
--   DROP POLICY IF EXISTS monitors_insert_v3 ON public.monitors; DROP POLICY IF EXISTS monitors_update_v3 ON public.monitors;
--   DROP POLICY IF EXISTS monitors_delete_v3 ON public.monitors; DROP POLICY IF EXISTS monitors_select_v4 ON public.monitors;
--   -- monitors_insert_v2/_update_v2/_delete_v2/_select_v3 woertlich aus 00000000000000_baseline_live_schema.sql:1628-1639
--   DELETE FROM public.role_permissions WHERE permission IN ('manageSchedule','manageLifecycle','manageScreens','manageHelpers','readDisplay');
--   INSERT INTO public.role_permissions (role, permission) VALUES ('collaborator','teams'), ('collaborator','correctEvents')
--     ON CONFLICT DO NOTHING;
--   -- CHECK woertlich aus 20260928_001_match_event_log.sql:614-621 (8 Namen)
--   COMMIT;
--   Danach: rolePermissions.json zurueck, Assertions + PRIVILEGE_ASSERTION_NAMES zurueck, Drift-Check, Typen-PR.
--
-- Produktion: nur im DB-Fenster F3 (Di 10.11.) durch den Controller nach Daniels Freigabe des woertlichen SQL
-- (A-11-sql-freigabe.md), vor A-27. Die Migration darf vor dem Code-Merge live gehen: die alte App schreibt
-- Spielplan-Spalten nur von Geraeten der Turnierleitung (Eigentuemer/Co-Admin haben manageSchedule), Monitore nur vom
-- Eigentuemer. Der Drift-Check (role_permissions live <-> JSON) ist zwischen Einspielen und Merge rot (erwartet).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ============================================================================================
-- 0. Voraussetzungen (Fail-fast; idempotent: v3 ODER v4 muss da sein)
-- ============================================================================================
DO $$
BEGIN
  IF to_regclass('public.role_permissions') IS NULL
     OR to_regclass('public.monitors') IS NULL
     OR to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR to_regprocedure('public.reset_match_results(uuid,uuid[])') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matches'
                     AND policyname IN ('matches_update_v3', 'matches_update_v4'))
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitors'
                     AND policyname IN ('monitors_update_v2', 'monitors_update_v3')) THEN
    RAISE EXCEPTION '20261110_001_role_permissions_mvp: Rechte-Tabelle, Policies oder A-10 (20261028_005) fehlen -- zuerst 20260924_002, 20260928_001 und 20261028_001..007 einspielen';
  END IF;
  -- Prognose-Waechter: keine unbekannte Rolle/Recht live (sonst scheitert die neue CHECK spaeter unerwartet)
  IF EXISTS (SELECT 1 FROM public.role_permissions
              WHERE permission NOT IN ('writeMatchData','correctEvents','tournamentSettings','teams','restructure',
                                       'deleteTournament','manageMembers','leadMatches','manageSchedule','manageLifecycle',
                                       'manageScreens','manageHelpers','readDisplay')) THEN
    RAISE EXCEPTION '20261110_001_role_permissions_mvp: role_permissions enthaelt ein unbekanntes Recht -- Drift, erst klaeren';
  END IF;
END;
$$;

-- ============================================================================================
-- A. Rechte-Namen
-- ============================================================================================
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_permission_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_permission_check
  CHECK (
    permission IN (
      'writeMatchData', 'correctEvents', 'tournamentSettings', 'teams',
      'restructure', 'deleteTournament', 'manageMembers', 'leadMatches',
      'manageSchedule', 'manageLifecycle', 'manageScreens', 'manageHelpers', 'readDisplay'
    )
  );

-- ============================================================================================
-- B. Rechte je Rolle (gleich src/features/auth/permissions/rolePermissions.json)
-- ============================================================================================
INSERT INTO public.role_permissions (role, permission) VALUES
  ('co-admin', 'manageSchedule'),
  ('co-admin', 'manageLifecycle'),
  ('co-admin', 'manageScreens'),
  ('co-admin', 'manageHelpers')
ON CONFLICT (role, permission) DO NOTHING;

-- @HE-042 "ein Team umbenennen -> nur Turnierleitung"; C-RECHTE-KORREKTUR: Helfer korrigieren nie.
DELETE FROM public.role_permissions
 WHERE role = 'collaborator' AND permission IN ('teams', 'correctEvents');

-- Endstand pruefen (Zwilling Z2): genau 11 Zeilen wie die JSON, sonst alles zurueck.
DO $$
DECLARE v_ist text; v_soll text := 'co-admin:correctEvents,co-admin:leadMatches,co-admin:manageHelpers,co-admin:manageLifecycle,'
  'co-admin:manageSchedule,co-admin:manageScreens,co-admin:restructure,co-admin:teams,co-admin:tournamentSettings,'
  'co-admin:writeMatchData,collaborator:writeMatchData';
BEGIN
  SELECT string_agg(role || ':' || permission, ',' ORDER BY role, permission) INTO v_ist FROM public.role_permissions;
  IF v_ist IS DISTINCT FROM v_soll THEN
    RAISE EXCEPTION '20261110_001_role_permissions_mvp: role_permissions weicht ab (ist: %)', v_ist;
  END IF;
END;
$$;

-- ============================================================================================
-- C. matches: Spielplan-Spalten nur mit manageSchedule (@ZP-041, @ZP-084)
-- ============================================================================================
DROP POLICY IF EXISTS matches_update_v3 ON public.matches;
DROP POLICY IF EXISTS matches_update_v4 ON public.matches;
CREATE POLICY matches_update_v4 ON public.matches
  FOR UPDATE TO authenticated, anon
  USING (public.has_tournament_permission(tournament_id, 'manageSchedule'))
  WITH CHECK (public.has_tournament_permission(tournament_id, 'manageSchedule'));
COMMENT ON POLICY matches_update_v4 ON public.matches IS
  'A-11: Clients aendern an matches nur Spielplan-Spalten (Ergebnis/Status/Uhr sperrt matches_guard_engine_columns,
   Farben matches_guard_kit_columns). Das darf nur, wer manageSchedule hat (Eigentuemer, Co-Admin). Helfer: @ZP-041.';

-- ============================================================================================
-- D. monitors: Turnierleitung und Co-Admin (@ZM-019 "Folienprogramm aendern")
-- ============================================================================================
DROP POLICY IF EXISTS monitors_insert_v2 ON public.monitors;
DROP POLICY IF EXISTS monitors_update_v2 ON public.monitors;
DROP POLICY IF EXISTS monitors_delete_v2 ON public.monitors;
DROP POLICY IF EXISTS monitors_select_v3 ON public.monitors;
DROP POLICY IF EXISTS monitors_insert_v3 ON public.monitors;
DROP POLICY IF EXISTS monitors_update_v3 ON public.monitors;
DROP POLICY IF EXISTS monitors_delete_v3 ON public.monitors;
DROP POLICY IF EXISTS monitors_select_v4 ON public.monitors;

CREATE POLICY monitors_insert_v3 ON public.monitors
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tournament_permission(tournament_id, 'manageScreens'));
CREATE POLICY monitors_update_v3 ON public.monitors
  FOR UPDATE TO authenticated
  USING (public.has_tournament_permission(tournament_id, 'manageScreens'))
  WITH CHECK (public.has_tournament_permission(tournament_id, 'manageScreens'));
CREATE POLICY monitors_delete_v3 ON public.monitors
  FOR DELETE TO authenticated
  USING (public.has_tournament_permission(tournament_id, 'manageScreens'));
-- Lesen: oeffentliche Monitore wie bisher fuer alle (Monitor-Anzeige ohne Konto), sonst wer sie verwaltet.
CREATE POLICY monitors_select_v4 ON public.monitors
  FOR SELECT TO authenticated, anon
  USING (is_public = true OR public.has_tournament_permission(tournament_id, 'manageScreens'));

COMMIT;
