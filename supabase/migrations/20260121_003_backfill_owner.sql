-- Migration: Backfill denormalized owner_id and is_public for existing data
-- Purpose: Populate the new columns added in 002_denormalize_owner
--
-- Note: This migration should be run AFTER 002_denormalize_owner
-- It fills in data for any existing rows that were created before triggers existed

-- ============================================================================
-- 1. BACKFILL TEAMS
-- ============================================================================

UPDATE teams
SET
  owner_id = tournaments.owner_id,
  is_public = COALESCE(tournaments.is_public, false)
FROM tournaments
WHERE teams.tournament_id = tournaments.id
  AND teams.owner_id IS NULL;

-- ============================================================================
-- 2. BACKFILL MATCHES
-- ============================================================================

UPDATE matches
SET
  owner_id = tournaments.owner_id,
  is_public = COALESCE(tournaments.is_public, false)
FROM tournaments
WHERE matches.tournament_id = tournaments.id
  AND matches.owner_id IS NULL;

-- ============================================================================
-- 3. BACKFILL SPONSORS
-- ============================================================================

UPDATE sponsors
SET
  owner_id = tournaments.owner_id,
  is_public = COALESCE(tournaments.is_public, false)
FROM tournaments
WHERE sponsors.tournament_id = tournaments.id
  AND sponsors.owner_id IS NULL;

-- ============================================================================
-- 4. BACKFILL MONITORS
-- ============================================================================

UPDATE monitors
SET
  owner_id = tournaments.owner_id,
  is_public = COALESCE(tournaments.is_public, false)
FROM tournaments
WHERE monitors.tournament_id = tournaments.id
  AND monitors.owner_id IS NULL;

-- ============================================================================
-- 5. BACKFILL MATCH_EVENTS (via matches)
-- ============================================================================

UPDATE match_events
SET
  owner_id = matches.owner_id,
  is_public = COALESCE(matches.is_public, false)
FROM matches
WHERE match_events.match_id = matches.id
  AND match_events.owner_id IS NULL;

-- ============================================================================
-- 6. BACKFILL MATCH_CORRECTIONS (via matches)
-- ============================================================================

UPDATE match_corrections
SET
  owner_id = matches.owner_id,
  is_public = COALESCE(matches.is_public, false)
FROM matches
WHERE match_corrections.match_id = matches.id
  AND match_corrections.owner_id IS NULL;

-- ============================================================================
-- 7. VERIFY BACKFILL SUCCESS
-- ============================================================================

-- This will fail if any rows still have NULL owner_id after backfill
-- (excluding orphaned rows which shouldn't exist due to FK constraints)
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Check for teams without owner_id that have valid tournament_id
  SELECT COUNT(*) INTO orphan_count
  FROM teams t
  WHERE t.owner_id IS NULL
    AND EXISTS (SELECT 1 FROM tournaments WHERE id = t.tournament_id);

  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % teams with NULL owner_id after backfill', orphan_count;
  END IF;

  -- Check for matches without owner_id that have valid tournament_id
  SELECT COUNT(*) INTO orphan_count
  FROM matches m
  WHERE m.owner_id IS NULL
    AND EXISTS (SELECT 1 FROM tournaments WHERE id = m.tournament_id);

  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % matches with NULL owner_id after backfill', orphan_count;
  END IF;
END $$;

-- ============================================================================
-- 8. ADD NOT NULL CONSTRAINTS (optional - uncomment if ready)
-- ============================================================================

-- Uncomment these once you've verified the backfill worked correctly.
-- For now, we leave owner_id nullable to allow gradual migration.

-- ALTER TABLE teams ALTER COLUMN owner_id SET NOT NULL;
-- ALTER TABLE matches ALTER COLUMN owner_id SET NOT NULL;
-- ALTER TABLE sponsors ALTER COLUMN owner_id SET NOT NULL;
-- ALTER TABLE monitors ALTER COLUMN owner_id SET NOT NULL;
-- ALTER TABLE match_events ALTER COLUMN owner_id SET NOT NULL;
-- ALTER TABLE match_corrections ALTER COLUMN owner_id SET NOT NULL;
