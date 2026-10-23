-- supabase/rollbacks/20261117_104_public_payload_rollback.sql
-- RUECKWEG zu supabase/migrations/20261117_104_public_payload.sql (B-14). Liegt bewusst NICHT in supabase/migrations
-- (wird nie nachgespielt). Anhang B der Freigabe-Unterlage B-14-sql-freigabe.md; belegt in
-- scripts/public-payload-check.sh (Kategorie X: Schema danach = Stand vor der Migration).
--
-- Reihenfolge: ZUERST die App auf den Stand ohne B-14-Client zurueck (sie liest sonst ueber public_tournament /
-- display_tournament, die es danach nicht mehr gibt), DANN dieser Block. Achtung: matches.original_start geht mit
-- seinen Werten verloren (vorher per COPY sichern, falls B-26 schon geschrieben hat).
--
-- Die alten SELECT-Policies stehen woertlich wie vor B-14 (pg_policies nach 20261110_004, Baseline bzw. 20260922_001,
-- 20260924_003, 20261110_001): is_public = true fuer anon und authenticated.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;

DROP TRIGGER IF EXISTS matches_public_structure_delete ON public.matches;
DROP TRIGGER IF EXISTS teams_public_structure_delete ON public.teams;
DROP TRIGGER IF EXISTS matches_updated_at_insert ON public.matches;
DROP TRIGGER IF EXISTS teams_updated_at_insert ON public.teams;
DROP FUNCTION IF EXISTS public.public_tournament(text, bigint);
DROP FUNCTION IF EXISTS public.display_tournament(uuid, text, bigint);
DROP SCHEMA IF EXISTS public_view CASCADE;

DROP POLICY IF EXISTS tournaments_select_v4 ON public.tournaments;
DROP POLICY IF EXISTS tournaments_select_v3 ON public.tournaments;
CREATE POLICY tournaments_select_v3 ON public.tournaments AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_public = true) OR (( SELECT auth.uid() AS uid) = owner_id) OR is_active_tournament_member(id)));

DROP POLICY IF EXISTS teams_select_v4 ON public.teams;
DROP POLICY IF EXISTS teams_select_v3 ON public.teams;
CREATE POLICY teams_select_v3 ON public.teams AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_public = true) OR (( SELECT auth.uid() AS uid) = owner_id) OR is_active_tournament_member(tournament_id)));

DROP POLICY IF EXISTS team_players_select_v4 ON public.team_players;
DROP POLICY IF EXISTS team_players_select_v3 ON public.team_players;
CREATE POLICY team_players_select_v3 ON public.team_players AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM teams t
  WHERE ((t.id = team_players.team_id) AND ((t.is_public = true) OR (t.owner_id = ( SELECT auth.uid() AS uid)))))));

DROP POLICY IF EXISTS matches_select_v4 ON public.matches;
DROP POLICY IF EXISTS matches_select_v3 ON public.matches;
CREATE POLICY matches_select_v3 ON public.matches AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_public = true) OR (( SELECT auth.uid() AS uid) = owner_id) OR is_active_tournament_member(tournament_id)));

DROP POLICY IF EXISTS match_events_select_v4 ON public.match_events;
DROP POLICY IF EXISTS match_events_select_v3 ON public.match_events;
CREATE POLICY match_events_select_v3 ON public.match_events AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_public = true) OR (( SELECT auth.uid() AS uid) = owner_id) OR is_active_tournament_member(( SELECT matches.tournament_id
   FROM matches
  WHERE (matches.id = match_events.match_id)))));

DROP POLICY IF EXISTS monitors_select_v5 ON public.monitors;
DROP POLICY IF EXISTS monitors_select_v4 ON public.monitors;
CREATE POLICY monitors_select_v4 ON public.monitors AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_public = true) OR has_tournament_permission(tournament_id, 'manageScreens'::text)));

DROP POLICY IF EXISTS sponsors_select_v4 ON public.sponsors;
DROP POLICY IF EXISTS sponsors_select_v3 ON public.sponsors;
CREATE POLICY sponsors_select_v3 ON public.sponsors AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_public = true) OR (( SELECT auth.uid() AS uid) = owner_id)));

DROP POLICY IF EXISTS match_corrections_select_v3 ON public.match_corrections;
DROP POLICY IF EXISTS match_corrections_select_v2 ON public.match_corrections;
CREATE POLICY match_corrections_select_v2 ON public.match_corrections AS PERMISSIVE FOR SELECT TO public
  USING (((is_public = true) OR (( SELECT auth.uid() AS uid) = owner_id)));

DROP FUNCTION IF EXISTS public.is_reading_member(uuid);

-- make_tournament_private / make_tournament_public woertlich aus 20261110_004 (CA-2).
CREATE OR REPLACE FUNCTION public.make_tournament_private(tournament_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Check permission (CA-2): tournamentSettings -- Eigentuemer (echtes Konto) und Co-Admin
  IF NOT public.has_tournament_permission(tournament_id, 'tournamentSettings') THEN
    RAISE EXCEPTION 'Not authorized to modify this tournament';
  END IF;

  UPDATE tournaments
  SET
    is_public = false,
    share_code = NULL,
    share_code_created_at = NULL
  WHERE id = tournament_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.make_tournament_public(tournament_id uuid)
RETURNS TABLE(share_code text, share_code_created_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  new_code TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
  v_is_public BOOLEAN;
  v_existing_code TEXT;
  v_existing_created_at TIMESTAMPTZ;
BEGIN
  -- Check permission (CA-2): tournamentSettings -- Eigentuemer (echtes Konto) und Co-Admin
  IF NOT public.has_tournament_permission(tournament_id, 'tournamentSettings') THEN
    RAISE EXCEPTION 'Not authorized to modify this tournament';
  END IF;

  -- Freigabe-Backstop: ohne publishedAt im config-JSONB ist das Turnier ein Entwurf.
  -- NICHT 'PT001' (und kein anderer Code aus der PT-Namespace): PostgREST interpretiert
  -- SQLSTATEs der Form PTxyz als HTTP-Status-Override, 'PT001' waere HTTP-Status 1 —
  -- keine gueltige Status-Zeile, die Response kaeme beim Client gar nicht intakt an.
  -- 'HF' ist weder von Postgres reserviert noch Teil der PT-Namespace.
  IF NOT (
    COALESCE(
      (SELECT config FROM tournaments WHERE id = tournament_id),
      '{}'::jsonb
    ) ? 'publishedAt'
  ) THEN
    RAISE EXCEPTION 'Tournament has not been released yet and cannot be made public'
      USING ERRCODE = 'HF001';
  END IF;

  -- Code bleibt beim erneuten Teilen (CA-2, Auflage 5): schon oeffentlich mit Code -> genau diesen Code zurueck.
  -- FOR UPDATE: ein gleichzeitiger zweiter Aufruf wartet und sieht danach den Code des ersten.
  SELECT t.is_public, t.share_code, t.share_code_created_at
    INTO v_is_public, v_existing_code, v_existing_created_at
    FROM tournaments t
   WHERE t.id = tournament_id
   FOR UPDATE;
  IF v_is_public AND v_existing_code IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_code, v_existing_created_at;
    RETURN;
  END IF;

  -- Generate unique code with retry logic
  LOOP
    attempt := attempt + 1;
    new_code := generate_share_code();

    -- Check if code is unique
    IF NOT EXISTS (SELECT 1 FROM tournaments WHERE tournaments.share_code = new_code) THEN
      EXIT;
    END IF;

    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique share code after % attempts', max_attempts;
    END IF;
  END LOOP;

  -- Update tournament
  UPDATE tournaments
  SET
    is_public = true,
    share_code = new_code,
    share_code_created_at = NOW()
  WHERE id = tournament_id;

  RETURN QUERY SELECT new_code, NOW();
END;
$$;



ALTER TABLE public.matches DROP COLUMN IF EXISTS original_start;

COMMIT;
