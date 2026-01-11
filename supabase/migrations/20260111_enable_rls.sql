-- Migration: Enable Row Level Security (RLS)
-- Description: Implements "Public Read, Owner Write" policies for core tables.

-- 1. Enable RLS on tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_corrections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. TOURNAMENTS
-- ============================================================================

-- Read: Public (Anyone can view)
-- Note: This creates a permissive read policy. If strict privacy is needed later,
-- revert to checking `is_public` column or owner.
DROP POLICY IF EXISTS "Public read tournaments" ON tournaments;
CREATE POLICY "Public read tournaments" 
ON tournaments FOR SELECT 
USING (true);

-- Write: Owner Only
DROP POLICY IF EXISTS "Owner write tournaments" ON tournaments;
CREATE POLICY "Owner write tournaments" 
ON tournaments FOR ALL 
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- ============================================================================
-- 2. TEAMS
-- ============================================================================

-- Read: Public
DROP POLICY IF EXISTS "Public read teams" ON teams;
CREATE POLICY "Public read teams" 
ON teams FOR SELECT 
USING (true);

-- Write: Tournament Owner
DROP POLICY IF EXISTS "Owner write teams" ON teams;
CREATE POLICY "Owner write teams" 
ON teams FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = teams.tournament_id 
    AND tournaments.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = teams.tournament_id 
    AND tournaments.owner_id = auth.uid()
  )
);

-- ============================================================================
-- 3. MATCHES
-- ============================================================================

-- Read: Public
DROP POLICY IF EXISTS "Public read matches" ON matches;
CREATE POLICY "Public read matches" 
ON matches FOR SELECT 
USING (true);

-- Write: Tournament Owner
DROP POLICY IF EXISTS "Owner write matches" ON matches;
CREATE POLICY "Owner write matches" 
ON matches FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = matches.tournament_id 
    AND tournaments.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = matches.tournament_id 
    AND tournaments.owner_id = auth.uid()
  )
);

-- ============================================================================
-- 4. MATCH EVENTS
-- ============================================================================

-- Read: Public
DROP POLICY IF EXISTS "Public read match_events" ON match_events;
CREATE POLICY "Public read match_events" 
ON match_events FOR SELECT 
USING (true);

-- Write: Tournament Owner (via Match -> Tournament)
DROP POLICY IF EXISTS "Owner write match_events" ON match_events;
CREATE POLICY "Owner write match_events" 
ON match_events FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM matches
    JOIN tournaments ON matches.tournament_id = tournaments.id
    WHERE matches.id = match_events.match_id
    AND tournaments.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM matches
    JOIN tournaments ON matches.tournament_id = tournaments.id
    WHERE matches.id = match_events.match_id
    AND tournaments.owner_id = auth.uid()
  )
);

-- ============================================================================
-- 5. SPONSORS
-- ============================================================================

-- Read: Public
DROP POLICY IF EXISTS "Public read sponsors" ON sponsors;
CREATE POLICY "Public read sponsors" 
ON sponsors FOR SELECT 
USING (true);

-- Write: Tournament Owner
DROP POLICY IF EXISTS "Owner write sponsors" ON sponsors;
CREATE POLICY "Owner write sponsors" 
ON sponsors FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = sponsors.tournament_id 
    AND tournaments.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = sponsors.tournament_id 
    AND tournaments.owner_id = auth.uid()
  )
);

-- ============================================================================
-- 6. MONITORS
-- ============================================================================

-- Read: Public
DROP POLICY IF EXISTS "Public read monitors" ON monitors;
CREATE POLICY "Public read monitors" 
ON monitors FOR SELECT 
USING (true);

-- Write: Tournament Owner
DROP POLICY IF EXISTS "Owner write monitors" ON monitors;
CREATE POLICY "Owner write monitors" 
ON monitors FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = monitors.tournament_id 
    AND tournaments.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = monitors.tournament_id 
    AND tournaments.owner_id = auth.uid()
  )
);

-- ============================================================================
-- 7. MATCH CORRECTIONS
-- ============================================================================

-- Read: Public
DROP POLICY IF EXISTS "Public read match_corrections" ON match_corrections;
CREATE POLICY "Public read match_corrections" 
ON match_corrections FOR SELECT 
USING (true);

-- Write: Tournament Owner
DROP POLICY IF EXISTS "Owner write match_corrections" ON match_corrections;
CREATE POLICY "Owner write match_corrections" 
ON match_corrections FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM matches
    JOIN tournaments ON matches.tournament_id = tournaments.id
    WHERE matches.id = match_corrections.match_id
    AND tournaments.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM matches
    JOIN tournaments ON matches.tournament_id = tournaments.id
    WHERE matches.id = match_corrections.match_id
    AND tournaments.owner_id = auth.uid()
  )
);
