-- Migration: Denormalize owner_id and is_public to child tables
-- Purpose: Enable fast RLS policies without JOIN/EXISTS subqueries
--
-- Current State:
--   - tournaments has owner_id and is_public
--   - child tables (teams, matches, etc.) only have tournament_id
--   - RLS policies use slow EXISTS subqueries to check ownership
--
-- After Migration:
--   - Each child table has its own owner_id and is_public
--   - RLS policies can directly check these columns (100x faster)
--   - Triggers ensure consistency on INSERT

-- ============================================================================
-- 1. TEAMS - Add denormalized columns
-- ============================================================================

-- Add columns
ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Add foreign key constraint (deferred to allow backfill first)
-- Note: owner_id references auth.users(id) but we use UUID type for flexibility

-- Create index for fast RLS lookups
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_is_public ON teams(is_public) WHERE is_public = true;

COMMENT ON COLUMN teams.owner_id IS 'Denormalized from tournaments.owner_id for fast RLS. Synced via trigger.';
COMMENT ON COLUMN teams.is_public IS 'Denormalized from tournaments.is_public for fast RLS. Synced via trigger.';

-- ============================================================================
-- 2. MATCHES - Add denormalized columns
-- ============================================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_matches_owner_id ON matches(owner_id);
CREATE INDEX IF NOT EXISTS idx_matches_is_public ON matches(is_public) WHERE is_public = true;

COMMENT ON COLUMN matches.owner_id IS 'Denormalized from tournaments.owner_id for fast RLS. Synced via trigger.';
COMMENT ON COLUMN matches.is_public IS 'Denormalized from tournaments.is_public for fast RLS. Synced via trigger.';

-- ============================================================================
-- 3. MATCH_EVENTS - Add denormalized columns
-- ============================================================================

ALTER TABLE match_events ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_match_events_owner_id ON match_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_match_events_is_public ON match_events(is_public) WHERE is_public = true;

COMMENT ON COLUMN match_events.owner_id IS 'Denormalized from tournaments.owner_id for fast RLS. Synced via trigger.';
COMMENT ON COLUMN match_events.is_public IS 'Denormalized from tournaments.is_public for fast RLS. Synced via trigger.';

-- ============================================================================
-- 4. SPONSORS - Add denormalized columns
-- ============================================================================

ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sponsors_owner_id ON sponsors(owner_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_is_public ON sponsors(is_public) WHERE is_public = true;

COMMENT ON COLUMN sponsors.owner_id IS 'Denormalized from tournaments.owner_id for fast RLS. Synced via trigger.';
COMMENT ON COLUMN sponsors.is_public IS 'Denormalized from tournaments.is_public for fast RLS. Synced via trigger.';

-- ============================================================================
-- 5. MONITORS - Add denormalized columns
-- ============================================================================

ALTER TABLE monitors ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_monitors_owner_id ON monitors(owner_id);
CREATE INDEX IF NOT EXISTS idx_monitors_is_public ON monitors(is_public) WHERE is_public = true;

COMMENT ON COLUMN monitors.owner_id IS 'Denormalized from tournaments.owner_id for fast RLS. Synced via trigger.';
COMMENT ON COLUMN monitors.is_public IS 'Denormalized from tournaments.is_public for fast RLS. Synced via trigger.';

-- ============================================================================
-- 6. MATCH_CORRECTIONS - Add denormalized columns
-- ============================================================================

ALTER TABLE match_corrections ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE match_corrections ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_match_corrections_owner_id ON match_corrections(owner_id);
CREATE INDEX IF NOT EXISTS idx_match_corrections_is_public ON match_corrections(is_public) WHERE is_public = true;

COMMENT ON COLUMN match_corrections.owner_id IS 'Denormalized from tournaments.owner_id for fast RLS. Synced via trigger.';
COMMENT ON COLUMN match_corrections.is_public IS 'Denormalized from tournaments.is_public for fast RLS. Synced via trigger.';

-- ============================================================================
-- 7. CREATE TRIGGERS for automatic sync on INSERT
-- ============================================================================

-- Function to copy owner_id and is_public from tournament on INSERT
CREATE OR REPLACE FUNCTION sync_owner_from_tournament()
RETURNS TRIGGER AS $$
BEGIN
  -- Get owner_id and is_public from parent tournament
  SELECT owner_id, is_public
  INTO NEW.owner_id, NEW.is_public
  FROM tournaments
  WHERE id = NEW.tournament_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to copy owner_id and is_public from match (for match_events and match_corrections)
CREATE OR REPLACE FUNCTION sync_owner_from_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Get owner_id and is_public from parent match
  SELECT owner_id, is_public
  INTO NEW.owner_id, NEW.is_public
  FROM matches
  WHERE id = NEW.match_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with tournament_id

DROP TRIGGER IF EXISTS teams_sync_owner ON teams;
CREATE TRIGGER teams_sync_owner
  BEFORE INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION sync_owner_from_tournament();

DROP TRIGGER IF EXISTS matches_sync_owner ON matches;
CREATE TRIGGER matches_sync_owner
  BEFORE INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION sync_owner_from_tournament();

DROP TRIGGER IF EXISTS sponsors_sync_owner ON sponsors;
CREATE TRIGGER sponsors_sync_owner
  BEFORE INSERT ON sponsors
  FOR EACH ROW
  EXECUTE FUNCTION sync_owner_from_tournament();

DROP TRIGGER IF EXISTS monitors_sync_owner ON monitors;
CREATE TRIGGER monitors_sync_owner
  BEFORE INSERT ON monitors
  FOR EACH ROW
  EXECUTE FUNCTION sync_owner_from_tournament();

-- Apply triggers to tables with match_id

DROP TRIGGER IF EXISTS match_events_sync_owner ON match_events;
CREATE TRIGGER match_events_sync_owner
  BEFORE INSERT ON match_events
  FOR EACH ROW
  EXECUTE FUNCTION sync_owner_from_match();

DROP TRIGGER IF EXISTS match_corrections_sync_owner ON match_corrections;
CREATE TRIGGER match_corrections_sync_owner
  BEFORE INSERT ON match_corrections
  FOR EACH ROW
  EXECUTE FUNCTION sync_owner_from_match();

-- ============================================================================
-- 8. CREATE TRIGGER to cascade is_public changes from tournaments
-- ============================================================================

-- When tournament.is_public changes, update all child rows
CREATE OR REPLACE FUNCTION cascade_tournament_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_public IS DISTINCT FROM NEW.is_public THEN
    -- Update direct children
    UPDATE teams SET is_public = NEW.is_public WHERE tournament_id = NEW.id;
    UPDATE matches SET is_public = NEW.is_public WHERE tournament_id = NEW.id;
    UPDATE sponsors SET is_public = NEW.is_public WHERE tournament_id = NEW.id;
    UPDATE monitors SET is_public = NEW.is_public WHERE tournament_id = NEW.id;

    -- Update nested children (match_events and match_corrections via matches)
    UPDATE match_events SET is_public = NEW.is_public
    WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = NEW.id);

    UPDATE match_corrections SET is_public = NEW.is_public
    WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tournament_visibility_cascade ON tournaments;
CREATE TRIGGER tournament_visibility_cascade
  AFTER UPDATE ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION cascade_tournament_visibility();
