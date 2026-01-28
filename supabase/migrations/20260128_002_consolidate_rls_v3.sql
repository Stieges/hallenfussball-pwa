-- Migration: Consolidate RLS policies to eliminate multiple_permissive_policies warnings
-- Purpose: Reduce from 65 WARN to 0 by combining overlapping policies
-- Strategy: Create v3 policies that combine v2 + public + collaborator logic, then drop old ones
-- Note: Collaborator status is tracked via accepted_at IS NOT NULL (not a status column)

-- ============================================
-- TOURNAMENTS
-- ============================================

DROP POLICY IF EXISTS "tournaments_select_v2" ON tournaments;
DROP POLICY IF EXISTS "tournaments_select_collaborator" ON tournaments;
DROP POLICY IF EXISTS "tournaments_select_public" ON tournaments;
DROP POLICY IF EXISTS "tournaments_update_v2" ON tournaments;
DROP POLICY IF EXISTS "tournaments_update_admin" ON tournaments;

CREATE POLICY "tournaments_select_v3" ON tournaments FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  (SELECT auth.uid()) = owner_id
  OR
  EXISTS (
    SELECT 1 FROM tournament_collaborators tc
    WHERE tc.tournament_id = tournaments.id
    AND tc.user_id = (SELECT auth.uid())
    AND tc.accepted_at IS NOT NULL
  )
);

CREATE POLICY "tournaments_update_v3" ON tournaments FOR UPDATE
TO authenticated, anon
USING (
  (SELECT auth.uid()) = owner_id
  OR
  EXISTS (
    SELECT 1 FROM tournament_collaborators tc
    WHERE tc.tournament_id = tournaments.id
    AND tc.user_id = (SELECT auth.uid())
    AND tc.role = 'admin'
    AND tc.accepted_at IS NOT NULL
  )
)
WITH CHECK (
  (SELECT auth.uid()) = owner_id
  OR
  EXISTS (
    SELECT 1 FROM tournament_collaborators tc
    WHERE tc.tournament_id = tournaments.id
    AND tc.user_id = (SELECT auth.uid())
    AND tc.role = 'admin'
    AND tc.accepted_at IS NOT NULL
  )
);

-- ============================================
-- TEAMS
-- ============================================

DROP POLICY IF EXISTS "teams_select_v2" ON teams;
DROP POLICY IF EXISTS "teams_select_collaborator" ON teams;
DROP POLICY IF EXISTS "teams_select_public" ON teams;
DROP POLICY IF EXISTS "teams_update_v2" ON teams;
DROP POLICY IF EXISTS "teams_update_collaborator" ON teams;

CREATE POLICY "teams_select_v3" ON teams FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  (SELECT auth.uid()) = owner_id
  OR
  EXISTS (
    SELECT 1 FROM tournament_collaborators tc
    WHERE tc.tournament_id = teams.tournament_id
    AND tc.user_id = (SELECT auth.uid())
    AND tc.accepted_at IS NOT NULL
  )
);

CREATE POLICY "teams_update_v3" ON teams FOR UPDATE
TO authenticated, anon
USING (
  (SELECT auth.uid()) = owner_id
  OR
  EXISTS (
    SELECT 1 FROM tournament_collaborators tc
    WHERE tc.tournament_id = teams.tournament_id
    AND tc.user_id = (SELECT auth.uid())
    AND tc.accepted_at IS NOT NULL
  )
)
WITH CHECK (
  (SELECT auth.uid()) = owner_id
  OR
  EXISTS (
    SELECT 1 FROM tournament_collaborators tc
    WHERE tc.tournament_id = teams.tournament_id
    AND tc.user_id = (SELECT auth.uid())
    AND tc.accepted_at IS NOT NULL
  )
);

-- ============================================
-- MATCHES
-- ============================================

DROP POLICY IF EXISTS "matches_select_v2" ON matches;
DROP POLICY IF EXISTS "matches_select_collaborator" ON matches;
DROP POLICY IF EXISTS "matches_select_public" ON matches;
DROP POLICY IF EXISTS "matches_update_v2" ON matches;
DROP POLICY IF EXISTS "matches_update_scorer" ON matches;

CREATE POLICY "matches_select_v3" ON matches FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  (SELECT auth.uid()) = owner_id
  OR
  EXISTS (
    SELECT 1 FROM tournament_collaborators tc
    WHERE tc.tournament_id = matches.tournament_id
    AND tc.user_id = (SELECT auth.uid())
    AND tc.accepted_at IS NOT NULL
  )
);

CREATE POLICY "matches_update_v3" ON matches FOR UPDATE
TO authenticated, anon
USING (
  (SELECT auth.uid()) = owner_id
  OR
  EXISTS (
    SELECT 1 FROM tournament_collaborators tc
    WHERE tc.tournament_id = matches.tournament_id
    AND tc.user_id = (SELECT auth.uid())
    AND tc.accepted_at IS NOT NULL
  )
)
WITH CHECK (
  (SELECT auth.uid()) = owner_id
  OR
  EXISTS (
    SELECT 1 FROM tournament_collaborators tc
    WHERE tc.tournament_id = matches.tournament_id
    AND tc.user_id = (SELECT auth.uid())
    AND tc.accepted_at IS NOT NULL
  )
);

-- ============================================
-- MATCH_EVENTS
-- ============================================

DROP POLICY IF EXISTS "match_events_select_v2" ON match_events;
DROP POLICY IF EXISTS "match_events_select_public" ON match_events;
DROP POLICY IF EXISTS "match_events_insert_v2" ON match_events;
DROP POLICY IF EXISTS "match_events_insert_collaborator" ON match_events;

CREATE POLICY "match_events_select_v3" ON match_events FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  (SELECT auth.uid()) = owner_id
);

CREATE POLICY "match_events_insert_v3" ON match_events FOR INSERT
TO authenticated, anon
WITH CHECK (
  (SELECT auth.uid()) = owner_id
  OR
  EXISTS (
    SELECT 1 FROM matches m
    JOIN tournament_collaborators tc ON tc.tournament_id = m.tournament_id
    WHERE m.id = match_events.match_id
    AND tc.user_id = (SELECT auth.uid())
    AND tc.accepted_at IS NOT NULL
  )
);

-- ============================================
-- MONITORS
-- ============================================

DROP POLICY IF EXISTS "monitors_select_v2" ON monitors;
DROP POLICY IF EXISTS "monitors_select_public" ON monitors;

CREATE POLICY "monitors_select_v3" ON monitors FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  (SELECT auth.uid()) = owner_id
);

-- ============================================
-- SPONSORS
-- ============================================

DROP POLICY IF EXISTS "sponsors_select_v2" ON sponsors;
DROP POLICY IF EXISTS "sponsors_select_public" ON sponsors;

CREATE POLICY "sponsors_select_v3" ON sponsors FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  (SELECT auth.uid()) = owner_id
);

-- ============================================
-- TEAM_PLAYERS
-- ============================================

DROP POLICY IF EXISTS "team_players_all_own" ON team_players;
DROP POLICY IF EXISTS "team_players_select_public" ON team_players;
DROP POLICY IF EXISTS "team_players_insert_collaborator" ON team_players;

CREATE POLICY "team_players_select_v3" ON team_players FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = team_players.team_id
    AND (t.is_public = true OR t.owner_id = (SELECT auth.uid()))
  )
);

CREATE POLICY "team_players_insert_v3" ON team_players FOR INSERT
TO authenticated, anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = team_players.team_id
    AND (
      t.owner_id = (SELECT auth.uid())
      OR
      EXISTS (
        SELECT 1 FROM tournament_collaborators tc
        WHERE tc.tournament_id = t.tournament_id
        AND tc.user_id = (SELECT auth.uid())
        AND tc.accepted_at IS NOT NULL
      )
    )
  )
);

CREATE POLICY "team_players_update_v3" ON team_players FOR UPDATE
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = team_players.team_id
    AND t.owner_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = team_players.team_id
    AND t.owner_id = (SELECT auth.uid())
  )
);

CREATE POLICY "team_players_delete_v3" ON team_players FOR DELETE
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = team_players.team_id
    AND t.owner_id = (SELECT auth.uid())
  )
);

-- ============================================
-- TOURNAMENT_COLLABORATORS
-- ============================================

DROP POLICY IF EXISTS "collaborators_manage_own_tournaments" ON tournament_collaborators;
DROP POLICY IF EXISTS "collaborators_select_invited" ON tournament_collaborators;
DROP POLICY IF EXISTS "collaborators_update_accept" ON tournament_collaborators;

-- Helper function to check tournament ownership without RLS recursion
-- Uses SECURITY DEFINER to bypass RLS when checking ownership
CREATE OR REPLACE FUNCTION public.user_owns_tournament(p_tournament_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = p_tournament_id AND owner_id = auth.uid()
  );
$function$;

-- Note: Use user_owns_tournament() to avoid infinite recursion
-- (tournaments_select_v3 checks collaborators, which would check tournaments again)
CREATE POLICY "collaborators_select_v3" ON tournament_collaborators FOR SELECT
TO authenticated, anon
USING (
  user_id = (SELECT auth.uid())
  OR
  invite_email = (SELECT auth.email())
  OR
  user_owns_tournament(tournament_id)
);

CREATE POLICY "collaborators_insert_v3" ON tournament_collaborators FOR INSERT
TO authenticated, anon
WITH CHECK (
  user_owns_tournament(tournament_id)
);

CREATE POLICY "collaborators_update_v3" ON tournament_collaborators FOR UPDATE
TO authenticated, anon
USING (
  user_id = (SELECT auth.uid())
  OR
  invite_email = (SELECT auth.email())
  OR
  user_owns_tournament(tournament_id)
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR
  invite_email = (SELECT auth.email())
  OR
  user_owns_tournament(tournament_id)
);

CREATE POLICY "collaborators_delete_v3" ON tournament_collaborators FOR DELETE
TO authenticated, anon
USING (
  user_id = (SELECT auth.uid())
  OR
  user_owns_tournament(tournament_id)
);

-- ============================================
-- TOURNAMENT_TEMPLATES
-- ============================================

DROP POLICY IF EXISTS "templates_all_own" ON tournament_templates;
DROP POLICY IF EXISTS "templates_select_public" ON tournament_templates;

CREATE POLICY "templates_select_v3" ON tournament_templates FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  owner_id = (SELECT auth.uid())
);

CREATE POLICY "templates_insert_v3" ON tournament_templates FOR INSERT
TO authenticated, anon
WITH CHECK (
  owner_id = (SELECT auth.uid())
);

CREATE POLICY "templates_update_v3" ON tournament_templates FOR UPDATE
TO authenticated, anon
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "templates_delete_v3" ON tournament_templates FOR DELETE
TO authenticated, anon
USING (owner_id = (SELECT auth.uid()));
