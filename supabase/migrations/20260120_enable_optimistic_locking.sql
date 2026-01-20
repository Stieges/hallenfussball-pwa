-- Migration: Enable Optimistic Locking for Matches
-- Purpose: Prevent race conditions when goals are recorded just before match end
--
-- The matches table already has a 'version' column (nullable, default 1).
-- This migration:
-- 1. Initializes version to 1 where NULL (for existing data)
-- 2. Adds NOT NULL constraint
-- 3. Creates auto-increment trigger on UPDATE

-- 1. Initialize version for existing rows (use 1 as starting version)
UPDATE matches SET version = 1 WHERE version IS NULL;

-- 2. Add NOT NULL constraint (version must always be present)
ALTER TABLE matches
  ALTER COLUMN version SET NOT NULL;

-- 3. Create function to auto-increment version on UPDATE
CREATE OR REPLACE FUNCTION increment_match_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if this is an actual data change (not just version bump)
  -- This prevents infinite loops if someone manually sets version
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger (drop first if exists to make migration idempotent)
DROP TRIGGER IF EXISTS match_version_trigger ON matches;
CREATE TRIGGER match_version_trigger
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION increment_match_version();

-- 5. Add comment for documentation
COMMENT ON COLUMN matches.version IS 'Optimistic locking version. Auto-incremented on each UPDATE. Used for CAS (Compare-And-Swap) pattern.';
