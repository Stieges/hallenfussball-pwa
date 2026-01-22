-- Migration: Add version columns for Optimistic Locking
-- Purpose: Extend optimistic locking to teams and match_events tables
--
-- Note: matches.version already exists (from 20260120_enable_optimistic_locking.sql)
-- This migration adds version to tables that didn't have it yet.

-- ============================================================================
-- 1. TEAMS - Add version column
-- ============================================================================

-- Add version column if not exists
ALTER TABLE teams ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Set NOT NULL constraint (initialize existing rows first)
UPDATE teams SET version = 1 WHERE version IS NULL;
ALTER TABLE teams ALTER COLUMN version SET NOT NULL;

-- Create auto-increment function for teams
CREATE OR REPLACE FUNCTION increment_team_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if this is an actual data change
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (idempotent)
DROP TRIGGER IF EXISTS team_version_trigger ON teams;
CREATE TRIGGER team_version_trigger
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION increment_team_version();

COMMENT ON COLUMN teams.version IS 'Optimistic locking version. Auto-incremented on each UPDATE.';

-- ============================================================================
-- 2. MATCH_EVENTS - Add version column
-- ============================================================================

-- Add version column if not exists
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Set NOT NULL constraint (initialize existing rows first)
UPDATE match_events SET version = 1 WHERE version IS NULL;
ALTER TABLE match_events ALTER COLUMN version SET NOT NULL;

-- Create auto-increment function for match_events
CREATE OR REPLACE FUNCTION increment_match_event_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if this is an actual data change
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (idempotent)
DROP TRIGGER IF EXISTS match_event_version_trigger ON match_events;
CREATE TRIGGER match_event_version_trigger
  BEFORE UPDATE ON match_events
  FOR EACH ROW
  EXECUTE FUNCTION increment_match_event_version();

COMMENT ON COLUMN match_events.version IS 'Optimistic locking version. Auto-incremented on each UPDATE.';

-- ============================================================================
-- 3. SPONSORS - Add version column (optional, for consistency)
-- ============================================================================

ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
UPDATE sponsors SET version = 1 WHERE version IS NULL;
ALTER TABLE sponsors ALTER COLUMN version SET NOT NULL;

CREATE OR REPLACE FUNCTION increment_sponsor_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sponsor_version_trigger ON sponsors;
CREATE TRIGGER sponsor_version_trigger
  BEFORE UPDATE ON sponsors
  FOR EACH ROW
  EXECUTE FUNCTION increment_sponsor_version();

COMMENT ON COLUMN sponsors.version IS 'Optimistic locking version. Auto-incremented on each UPDATE.';

-- ============================================================================
-- 4. MONITORS - Add version column (optional, for consistency)
-- ============================================================================

ALTER TABLE monitors ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
UPDATE monitors SET version = 1 WHERE version IS NULL;
ALTER TABLE monitors ALTER COLUMN version SET NOT NULL;

CREATE OR REPLACE FUNCTION increment_monitor_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS monitor_version_trigger ON monitors;
CREATE TRIGGER monitor_version_trigger
  BEFORE UPDATE ON monitors
  FOR EACH ROW
  EXECUTE FUNCTION increment_monitor_version();

COMMENT ON COLUMN monitors.version IS 'Optimistic locking version. Auto-incremented on each UPDATE.';
