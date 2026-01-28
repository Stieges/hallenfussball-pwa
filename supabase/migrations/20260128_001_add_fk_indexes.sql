-- Migration: Add missing foreign key indexes
-- Purpose: Fix "unindexed_foreign_keys" Supabase linter warnings
-- Impact: Improves JOIN performance, especially for LiveMatch loads

-- ============================================
-- CRITICAL: Team FK Indexes
-- Used in EVERY LiveMatch load (liveMatchMappers.ts:180-181)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_matches_team_a_id
  ON matches(team_a_id);

CREATE INDEX IF NOT EXISTS idx_matches_team_b_id
  ON matches(team_b_id);

-- ============================================
-- HIGH: Audit Trail Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_matches_last_modified_by
  ON matches(last_modified_by)
  WHERE last_modified_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_match_events_team_id
  ON match_events(team_id)
  WHERE team_id IS NOT NULL;

-- ============================================
-- MEDIUM: Future Feature Indexes
-- ============================================

-- Referee assignment (Trainer-Cockpit feature)
CREATE INDEX IF NOT EXISTS idx_matches_referee_team_id
  ON matches(referee_team_id)
  WHERE referee_team_id IS NOT NULL;

-- Correction audit trail
CREATE INDEX IF NOT EXISTS idx_match_corrections_corrected_by
  ON match_corrections(corrected_by)
  WHERE corrected_by IS NOT NULL;

-- Tournament audit trail
CREATE INDEX IF NOT EXISTS idx_tournaments_last_modified_by
  ON tournaments(last_modified_by)
  WHERE last_modified_by IS NOT NULL;

-- Collaborator invites (Multi-User feature)
CREATE INDEX IF NOT EXISTS idx_tournament_collaborators_invited_by
  ON tournament_collaborators(invited_by)
  WHERE invited_by IS NOT NULL;
