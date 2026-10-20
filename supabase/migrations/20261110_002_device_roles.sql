-- supabase/migrations/20261110_002_device_roles.sql
-- A-27 (MVP-Bauplan, brief-A-27.md): Geraete-Rollen helper/screen, anonyme Sitzungen eingrenzen, Registrierung nur
-- ueber den Betreiber (@HE-082, @HE-083, @AN-045, @AN-006, @AN-005, @ME-059, @HE-062, @HE-084, @ME-069, @FT-006;
-- Befunde C-ANON-POLICIES, C-REG, C-HELFER-OHNE-KONTO).
--
-- Inhalt:
--   T0. Rollen helper (Helfer-Zugang, Geraet) und screen (gekoppelter Bildschirm) in beiden Rollen-CHECKs;
--       role_permissions: helper -> writeMatchData, screen -> readDisplay (Endstand 13 Zeilen).
--   T1. public.is_real_account(): angemeldet und NICHT anonym (Claim is_anonymous; fehlender Claim = echtes Konto).
--   T2. Guard protect_device_roles (BEFORE INSERT OR UPDATE auf tournament_collaborators): ueber die Schnittstelle
--       (authenticated/anon) entsteht keine Geraete-Rolle, niemand traegt eine fremde user_id ein, eine Geraete-Zeile
--       aendert weder Rolle noch Geraet. Definer-Funktionen (A-16, B-20), Service-Rolle und Migrationen sind frei.
--   T3. has_tournament_permission: eine anonyme Sitzung zaehlt NUR mit angenommener, nicht widerrufener
--       Mitgliedschaft helper/screen; der Eigentuemer-Zweig gilt fuer anonyme Sitzungen nicht.
--   T4. anon (ohne Sitzung) hat kein INSERT/UPDATE/DELETE/TRUNCATE auf public-Tabellen.
--   T5-T8. Policies, die eine anonyme Sitzung bisher fuer sich selbst erfuellte: tournaments INSERT,
--       tournament_templates, team_players (jetzt Recht teams), profiles UPDATE, sync_queue.
--   R-A27-8. Die fuenf toten Funktionen der 3-Turniere-Regel entfallen.
--   T9. public.hook_before_user_created(event): Auth-Hook "Before User Created" -- nur anonyme Geraetesitzungen
--       entstehen ueber die Schnittstelle; Konten legt der Betreiber an.
--   T10. Trigger block_anonymous_upgrade auf auth.users: eine anonyme Sitzung wird nie per updateUser/linkIdentity
--       zum Konto (Review K1, C-ANON-ZU-KONTO).
--
-- Abweichung vom Brief-Entwurf (Schritt-0-Beleg 4): is_real_account() liest die Claims ueber current_setting wie
-- auth.jwt() selbst (request.jwt.claim, sonst request.jwt.claims) statt auth.jwt() aufzurufen -- das Pruef-Image
-- (supabase/postgres) hat kein auth.jwt(), eine SQL-Funktion mit diesem Aufruf liesse sich dort nicht anlegen.
--
-- Nicht geaendert: append_match_events, reset_match_results, alle SELECT-Policies (B-14), is_active_tournament_member,
-- record_monitor_heartbeat, alle uebrigen Schreib-Policies. Keine Datenaenderung ausser role_permissions (+2).
-- Idempotent: DROP ... IF EXISTS + CREATE, CREATE OR REPLACE, INSERT ... ON CONFLICT DO NOTHING, REVOKE.
--
-- RUECKWEG: eigene Datei <Datum>_<NNN>_device_roles_rollback.sql (Anhang B von A-27-sql-freigabe.md), in EINEM
-- Block. Vorher: Daniel schaltet im Dashboard anonyme Anmeldungen und den Hook aus; A-16/B-20 sind zurueckgenommen
-- (keine helper/screen-Zeilen mehr). Danach: rolePermissions.json, Assertions, config.toml zurueck, Drift-Check.
--
-- Produktion: nur im DB-Fenster F3 (Di 10.11.) NACH 20261110_001 durch den Controller nach Daniels Freigabe
-- (A-27-sql-freigabe.md). Danach schaltet Daniel im Dashboard den Hook ein (Auth > Hooks > Before User Created >
-- public.hook_before_user_created).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ============================================================================================
-- 0. Voraussetzungen (A-11 _001 live, Rolle des Auth-Dienstes vorhanden)
-- ============================================================================================
DO $$
BEGIN
  IF to_regclass('public.role_permissions') IS NULL
     OR to_regclass('public.tournament_collaborators') IS NULL
     OR to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR to_regprocedure('public.user_owns_tournament(uuid)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matches'
                     AND policyname = 'matches_update_v4')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_permission_check'
                     AND pg_get_constraintdef(oid) LIKE '%readDisplay%')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    RAISE EXCEPTION '20261110_002_device_roles: 20261110_001 (A-11) fehlt oder Rolle supabase_auth_admin fehlt -- zuerst _001 einspielen';
  END IF;
END;
$$;

-- 0b. Altbestand (nur Auskunft im Protokoll; Wegwerf-Container haben auth.users.is_anonymous evtl. nicht)
DO $$
DECLARE v_owner integer; v_member integer;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous') THEN
    EXECUTE 'SELECT count(*) FROM public.tournaments t JOIN auth.users u ON u.id = t.owner_id WHERE u.is_anonymous'
      INTO v_owner;
    EXECUTE 'SELECT count(*) FROM public.tournament_collaborators c JOIN auth.users u ON u.id = c.user_id WHERE u.is_anonymous'
      INTO v_member;
    RAISE NOTICE '20261110_002: Turniere anonymer Eigentuemer: %, Mitgliedschaften anonymer Sitzungen: % (ab jetzt ohne Recht ausser helper/screen)',
      v_owner, v_member;
  END IF;
END;
$$;

-- ============================================================================================
-- T1. Echtes Konto (nicht anonym). Fehlender Claim = echtes Konto (wie is_anonymous_user() seit der Baseline).
--     Claims wie auth.jwt(): request.jwt.claim, sonst request.jwt.claims (PostgREST).
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.is_real_account() RETURNS boolean
  LANGUAGE sql STABLE
  SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
     AND coalesce(
           (coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                     nullif(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'is_anonymous')::boolean,
           false) = false;
$$;
COMMENT ON FUNCTION public.is_real_account() IS
  'A-27: true, wenn die Sitzung angemeldet und NICHT anonym ist (Claim is_anonymous). Fehlender Claim = echtes Konto.';
REVOKE ALL ON FUNCTION public.is_real_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_real_account() TO authenticated, anon;

-- ============================================================================================
-- T0. Rollen (R-A27-1) und Rechte (R-A27-2)
-- ============================================================================================
ALTER TABLE public.tournament_collaborators DROP CONSTRAINT IF EXISTS tournament_collaborators_role_check;
ALTER TABLE public.tournament_collaborators ADD CONSTRAINT tournament_collaborators_role_check
  CHECK (role IN ('owner', 'co-admin', 'trainer', 'collaborator', 'viewer', 'helper', 'screen'));
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_check
  CHECK (role IN ('co-admin', 'collaborator', 'trainer', 'viewer', 'helper', 'screen'));

INSERT INTO public.role_permissions (role, permission) VALUES
  ('helper', 'writeMatchData'),
  ('screen', 'readDisplay')
ON CONFLICT (role, permission) DO NOTHING;

DO $$
DECLARE v_ist text; v_soll text := 'co-admin:correctEvents,co-admin:leadMatches,co-admin:manageHelpers,co-admin:manageLifecycle,'
  'co-admin:manageSchedule,co-admin:manageScreens,co-admin:restructure,co-admin:teams,co-admin:tournamentSettings,'
  'co-admin:writeMatchData,collaborator:writeMatchData,helper:writeMatchData,screen:readDisplay';
BEGIN
  SELECT string_agg(role || ':' || permission, ',' ORDER BY role, permission) INTO v_ist FROM public.role_permissions;
  IF v_ist IS DISTINCT FROM v_soll THEN
    RAISE EXCEPTION '20261110_002_device_roles: role_permissions weicht ab (ist: %)', v_ist;
  END IF;
END;
$$;

-- ============================================================================================
-- T3. Anonym zaehlt nur mit Geraete-Rolle (R-A27-3). Signatur, Sprache, SECDEF, search_path wie 20260924_002.
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.has_tournament_permission(p_tournament_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN public.is_real_account() THEN
      public.user_owns_tournament(p_tournament_id)
      OR EXISTS (
        SELECT 1 FROM public.tournament_collaborators tc
          JOIN public.role_permissions rp ON rp.role = tc.role
         WHERE tc.tournament_id = p_tournament_id
           AND tc.user_id = (SELECT auth.uid())
           AND tc.accepted_at IS NOT NULL
           AND tc.declined_at IS NULL
           AND rp.permission = p_permission)
    ELSE
      EXISTS (
        SELECT 1 FROM public.tournament_collaborators tc
          JOIN public.role_permissions rp ON rp.role = tc.role
         WHERE tc.tournament_id = p_tournament_id
           AND tc.user_id = (SELECT auth.uid())
           AND tc.accepted_at IS NOT NULL
           AND tc.declined_at IS NULL
           AND tc.role IN ('helper', 'screen')
           AND rp.permission = p_permission)
  END;
$$;
COMMENT ON FUNCTION public.has_tournament_permission(uuid, text) IS
  'Die EINE Rechtepruefung (R5b, A-27). Echtes Konto: Eigentuemer (alle Rechte) oder angenommene, nicht widerrufene
   Mitgliedschaft mit einer Rolle, die role_permissions das Recht gibt. Anonyme Sitzung (A-27, E-A1): nur eine
   angenommene, nicht widerrufene Mitgliedschaft mit Geraete-Rolle helper/screen zaehlt; der Eigentuemer-Zweig gilt
   nicht. Jede rollenbasierte Schreib-Policy ruft ausschliesslich diese Funktion auf. EXECUTE fuer authenticated und
   anon, weil Policies im Aufruferkontext ausgewertet werden.';
REVOKE ALL ON FUNCTION public.has_tournament_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_tournament_permission(uuid, text) TO authenticated, anon;

-- ============================================================================================
-- T2. Guard: Geraete-Rollen und fremde Eintraege nie direkt ueber die Schnittstelle (R-A27-5)
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.protect_device_roles() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;   -- Definer-Funktionen (A-16, B-20), Service-Rolle, Migrationen
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IN ('helper', 'screen') THEN
      RAISE EXCEPTION 'Nicht erlaubt: Helfer- und Bildschirm-Zugaenge entstehen nur ueber Beitritt bzw. Kopplung.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
      RAISE EXCEPTION 'Nicht erlaubt: niemand wird ohne eigene Anfrage Mitglied.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.role IN ('helper', 'screen') OR OLD.role IN ('helper', 'screen'))
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'Nicht erlaubt: Rolle oder Geraet eines Helfer-/Bildschirm-Zugangs aendert sich nicht direkt.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND NOT (OLD.user_id IS NULL AND NEW.user_id = (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Nicht erlaubt: user_id einer Mitgliedschaft aendert nur die eigene Annahme.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_device_roles() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_device_roles ON public.tournament_collaborators;
CREATE TRIGGER protect_device_roles
  BEFORE INSERT OR UPDATE ON public.tournament_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.protect_device_roles();

-- ============================================================================================
-- T4. anon (ohne Sitzung) schreibt nie (R-A27-4)
-- ============================================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;

-- ============================================================================================
-- T5. Turnier anlegen nur mit echtem Konto (@AN-045, @HE-082); 3-Turniere-Regel entfaellt (R-A27-8)
-- ============================================================================================
DROP POLICY IF EXISTS tournaments_insert_v3 ON public.tournaments;
DROP POLICY IF EXISTS tournaments_insert_v4 ON public.tournaments;
CREATE POLICY tournaments_insert_v4 ON public.tournaments
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = owner_id AND (SELECT public.is_real_account()));

-- ============================================================================================
-- T6. Vorlagen nur mit echtem Konto (@HE-082)
-- ============================================================================================
DROP POLICY IF EXISTS templates_insert_v3 ON public.tournament_templates;
DROP POLICY IF EXISTS templates_update_v3 ON public.tournament_templates;
DROP POLICY IF EXISTS templates_delete_v3 ON public.tournament_templates;
DROP POLICY IF EXISTS templates_insert_v4 ON public.tournament_templates;
DROP POLICY IF EXISTS templates_update_v4 ON public.tournament_templates;
DROP POLICY IF EXISTS templates_delete_v4 ON public.tournament_templates;
CREATE POLICY templates_insert_v4 ON public.tournament_templates FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()) AND (SELECT public.is_real_account()));
CREATE POLICY templates_update_v4 ON public.tournament_templates FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND (SELECT public.is_real_account()))
  WITH CHECK (owner_id = (SELECT auth.uid()) AND (SELECT public.is_real_account()));
CREATE POLICY templates_delete_v4 ON public.tournament_templates FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND (SELECT public.is_real_account()));

-- ============================================================================================
-- T7. Kader: Recht teams statt "jede angenommene Mitgliedschaft" (fest verdrahtete Liste, Bauplan A-27 (c))
-- ============================================================================================
DROP POLICY IF EXISTS team_players_insert_v3 ON public.team_players;
DROP POLICY IF EXISTS team_players_update_v3 ON public.team_players;
DROP POLICY IF EXISTS team_players_delete_v3 ON public.team_players;
DROP POLICY IF EXISTS team_players_insert_v4 ON public.team_players;
DROP POLICY IF EXISTS team_players_update_v4 ON public.team_players;
DROP POLICY IF EXISTS team_players_delete_v4 ON public.team_players;
CREATE POLICY team_players_insert_v4 ON public.team_players FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_players.team_id
                        AND public.has_tournament_permission(t.tournament_id, 'teams')));
CREATE POLICY team_players_update_v4 ON public.team_players FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_players.team_id
                   AND public.has_tournament_permission(t.tournament_id, 'teams')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_players.team_id
                        AND public.has_tournament_permission(t.tournament_id, 'teams')));
CREATE POLICY team_players_delete_v4 ON public.team_players FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_players.team_id
                   AND public.has_tournament_permission(t.tournament_id, 'teams')));

-- ============================================================================================
-- T8. Eigene Zeilen nur mit echtem Konto (Record Anmelden: ohne Rolle darf eine anonyme Sitzung nichts)
-- ============================================================================================
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own_v2 ON public.profiles;
CREATE POLICY profiles_update_own_v2 ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id AND (SELECT public.is_real_account()))
  WITH CHECK ((SELECT auth.uid()) = id AND (SELECT public.is_real_account()));
DROP POLICY IF EXISTS sync_queue_all_own ON public.sync_queue;
DROP POLICY IF EXISTS sync_queue_all_own_v2 ON public.sync_queue;
CREATE POLICY sync_queue_all_own_v2 ON public.sync_queue FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.is_real_account()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.is_real_account()));

-- ============================================================================================
-- R-A27-8: tote 3-Turniere-Funktionen (kein Verbraucher, Schritt-0-Beleg 3). Ohne CASCADE.
-- ============================================================================================
DROP FUNCTION IF EXISTS public.can_create_tournament();
DROP FUNCTION IF EXISTS public.tournament_limit_error_message();
DROP FUNCTION IF EXISTS public.anonymous_tournament_limit();
DROP FUNCTION IF EXISTS public.count_active_tournaments(uuid);
DROP FUNCTION IF EXISTS public.is_anonymous_user();

-- ============================================================================================
-- T9. Registrierung nur ueber den Betreiber (@AN-006, C-REG); anonyme Geraetesitzungen erlaubt (P0-4).
--     Nie RAISE: wirft der Hook, lehnt der Auth-Dienst jede Anmeldung ab, auch die anonyme.
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.hook_before_user_created(event jsonb) RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $$
BEGIN
  IF jsonb_typeof(event -> 'user' -> 'is_anonymous') = 'boolean'
     AND (event -> 'user' ->> 'is_anonymous')::boolean THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Konten fuer Turnierleitungen legt im Moment der Betreiber an.'));
END;
$$;
COMMENT ON FUNCTION public.hook_before_user_created(jsonb) IS
  'A-27 Auth-Hook "Before User Created": nur anonyme Geraetesitzungen entstehen ueber die Schnittstelle (403 sonst).';
REVOKE ALL ON FUNCTION public.hook_before_user_created(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_before_user_created(jsonb) TO supabase_auth_admin;

-- ============================================================================================
-- T10. Aus einer Geraetesitzung wird kein Konto (@AN-006, Befund C-ANON-ZU-KONTO, Review A-27 K1). Der Hook greift nur
--      beim ANLEGEN; updateUser({email|phone}) bzw. linkIdentity aendern einen bestehenden anonymen Nutzer und machen ihn
--      sonst zum echten Konto. Der Trigger lehnt den Uebergang is_anonymous true -> false ab (auch fuer den Auth-Dienst;
--      Konten legt der Betreiber neu an). to_jsonb statt Spaltenbezug: im Pruef-Image fehlt auth.users.is_anonymous.
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.block_anonymous_upgrade() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce((to_jsonb(OLD) ->> 'is_anonymous')::boolean, false)
     AND NOT coalesce((to_jsonb(NEW) ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Nicht erlaubt: aus einer Geraetesitzung wird kein Konto (Konten legt der Betreiber an).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.block_anonymous_upgrade() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS block_anonymous_upgrade ON auth.users;
CREATE TRIGGER block_anonymous_upgrade
  BEFORE UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.block_anonymous_upgrade();

COMMIT;
