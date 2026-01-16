-- Migration: Secure RLS (Fix Public Access)
-- Description: Restricts read access to tournaments.
-- Rules:
-- 1. Owners can read/write their own tournaments.
-- 2. Public users can ONLY read tournaments where is_public = true.
-- Pre-requisites: 20260111_enable_rls.sql must be applied first.

-- ============================================================================
-- 1. TOURNAMENTS
-- ============================================================================

-- Drop insecure "Public read" policy
DROP POLICY IF EXISTS "Public read tournaments" ON tournaments;

-- Create secure read policy
-- Allows access if:
-- 1. Tournament is marked public
-- 2. OR User is the owner
CREATE POLICY "Public read tournaments" 
ON tournaments FOR SELECT 
USING (
  is_public = true 
  OR 
  auth.uid() = owner_id
);

-- Note: "Owner write" policy from previous migration remains valid.

-- ============================================================================
-- 2. CHILD TABLES (Teams, Matches, etc.)
-- ============================================================================
-- These tables rely on the parent tournament's visibility.
-- We must ensure the join checks the SAME conditions (is_public OR owner).

-- TEAMS
DROP POLICY IF EXISTS "Public read teams" ON teams;
CREATE POLICY "Public read teams" 
ON teams FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tournaments
    WHERE tournaments.id = teams.tournament_id
    AND (tournaments.is_public = true OR tournaments.owner_id = auth.uid())
  )
);

-- MATCHES
DROP POLICY IF EXISTS "Public read matches" ON matches;
CREATE POLICY "Public read matches" 
ON matches FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tournaments
    WHERE tournaments.id = matches.tournament_id
    AND (tournaments.is_public = true OR tournaments.owner_id = auth.uid())
  )
);

-- MATCH EVENTS
DROP POLICY IF EXISTS "Public read match_events" ON match_events;
CREATE POLICY "Public read match_events" 
ON match_events FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM matches
    JOIN tournaments ON matches.tournament_id = tournaments.id
    WHERE matches.id = match_events.match_id
    AND (tournaments.is_public = true OR tournaments.owner_id = auth.uid())
  )
);

-- SPONSORS
DROP POLICY IF EXISTS "Public read sponsors" ON sponsors;
CREATE POLICY "Public read sponsors" 
ON sponsors FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tournaments
    WHERE tournaments.id = sponsors.tournament_id
    AND (tournaments.is_public = true OR tournaments.owner_id = auth.uid())
  )
);

-- MONITORS
DROP POLICY IF EXISTS "Public read monitors" ON monitors;
CREATE POLICY "Public read monitors" 
ON monitors FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tournaments
    WHERE tournaments.id = monitors.tournament_id
    AND (tournaments.is_public = true OR tournaments.owner_id = auth.uid())
  )
);

-- MATCH CORRECTIONS
DROP POLICY IF EXISTS "Public read match_corrections" ON match_corrections;
CREATE POLICY "Public read match_corrections" 
ON match_corrections FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM matches
    JOIN tournaments ON matches.tournament_id = tournaments.id
    WHERE matches.id = match_corrections.match_id
    AND (tournaments.is_public = true OR tournaments.owner_id = auth.uid())
  )
);
