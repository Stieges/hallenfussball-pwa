-- Migration: Cleanup unused indexes
-- Purpose: Remove indexes that are no longer needed to improve write performance
-- Note: Only removing indexes that are SAFE to drop - keeping those for future features

-- ============================================
-- SAFE TO DROP: is_public indexes
-- Reason: owner_id denormalization made these redundant for RLS
-- ============================================

DROP INDEX IF EXISTS idx_teams_is_public;
DROP INDEX IF EXISTS idx_matches_is_public;
DROP INDEX IF EXISTS idx_match_events_is_public;
DROP INDEX IF EXISTS idx_sponsors_is_public;
DROP INDEX IF EXISTS idx_monitors_is_public;
DROP INDEX IF EXISTS idx_match_corrections_is_public;

-- ============================================
-- SAFE TO DROP: Unused feature indexes
-- Reason: Features not implemented or queries don't use these
-- ============================================

DROP INDEX IF EXISTS idx_templates_owner;
DROP INDEX IF EXISTS idx_templates_public;
DROP INDEX IF EXISTS idx_monitors_access_code;
DROP INDEX IF EXISTS idx_tournaments_status;
DROP INDEX IF EXISTS idx_tournaments_date;
DROP INDEX IF EXISTS idx_matches_field_status;

-- ============================================
-- SAFE TO DROP: Sync queue indexes
-- Reason: sync_queue table is not actively used
-- ============================================

DROP INDEX IF EXISTS idx_sync_queue_user;
DROP INDEX IF EXISTS idx_sync_queue_status;
DROP INDEX IF EXISTS idx_sync_queue_table;

-- ============================================
-- KEEPING (for future features):
-- - idx_team_players_team       → Trainer-Cockpit
-- - idx_match_events_match      → Event-Filterung
-- - idx_match_events_type       → Event-Typ-Queries
-- - idx_match_events_player     → Player-Statistiken
-- - idx_collaborators_invite_code → Invite-System
-- - idx_matches_live_state_active → Live-Dashboard
--
-- KEEPING (newly added FK indexes - will be used):
-- - idx_matches_team_a_id       → LiveMatch loads
-- - idx_matches_team_b_id       → LiveMatch loads
-- - idx_matches_last_modified_by → Audit trail
-- - idx_match_events_team_id    → Event filtering
-- - idx_matches_referee_team_id → Trainer-Cockpit
-- - idx_match_corrections_corrected_by → Audit
-- - idx_tournaments_last_modified_by → Audit
-- - idx_tournament_collaborators_invited_by → Multi-user
-- ============================================
