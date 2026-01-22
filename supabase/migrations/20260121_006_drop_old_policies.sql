-- Migration: Drop old RLS policies after v2 policies are verified working
-- Purpose: Remove superseded policies to avoid confusion and potential conflicts
--
-- IMPORTANT: Only run this after verifying v2/v3 policies work correctly!
--
-- Old policies from:
--   - 20260109_init_public_view.sql
--   - 20260111_enable_rls.sql
--   - 20260115_fix_public_read_access.sql

-- ============================================================================
-- 1. DROP OLD TOURNAMENT POLICIES
-- ============================================================================

-- From 20260109_init_public_view.sql
DROP POLICY IF EXISTS "Public tournaments are viewable by everyone" ON tournaments;

-- From 20260111_enable_rls.sql
DROP POLICY IF EXISTS "Public read tournaments" ON tournaments;
DROP POLICY IF EXISTS "Owner write tournaments" ON tournaments;

-- ============================================================================
-- 2. DROP OLD TEAM POLICIES
-- ============================================================================

-- From 20260109_init_public_view.sql
DROP POLICY IF EXISTS "Teams of public tournaments are viewable" ON teams;

-- From 20260111_enable_rls.sql
DROP POLICY IF EXISTS "Public read teams" ON teams;
DROP POLICY IF EXISTS "Owner write teams" ON teams;

-- ============================================================================
-- 3. DROP OLD MATCH POLICIES
-- ============================================================================

-- From 20260109_init_public_view.sql
DROP POLICY IF EXISTS "Matches of public tournaments are viewable" ON matches;

-- From 20260111_enable_rls.sql
DROP POLICY IF EXISTS "Public read matches" ON matches;
DROP POLICY IF EXISTS "Owner write matches" ON matches;

-- ============================================================================
-- 4. DROP OLD MATCH_EVENTS POLICIES
-- ============================================================================

-- From 20260111_enable_rls.sql
DROP POLICY IF EXISTS "Public read match_events" ON match_events;
DROP POLICY IF EXISTS "Owner write match_events" ON match_events;

-- ============================================================================
-- 5. DROP OLD SPONSORS POLICIES
-- ============================================================================

-- From 20260111_enable_rls.sql
DROP POLICY IF EXISTS "Public read sponsors" ON sponsors;
DROP POLICY IF EXISTS "Owner write sponsors" ON sponsors;

-- ============================================================================
-- 6. DROP OLD MONITORS POLICIES
-- ============================================================================

-- From 20260111_enable_rls.sql
DROP POLICY IF EXISTS "Public read monitors" ON monitors;
DROP POLICY IF EXISTS "Owner write monitors" ON monitors;

-- ============================================================================
-- 7. DROP OLD MATCH_CORRECTIONS POLICIES
-- ============================================================================

-- From 20260111_enable_rls.sql
DROP POLICY IF EXISTS "Public read match_corrections" ON match_corrections;
DROP POLICY IF EXISTS "Owner write match_corrections" ON match_corrections;

-- ============================================================================
-- 8. VERIFICATION: List remaining policies
-- ============================================================================

-- Run this query after migration to verify only v2/v3 policies remain:
--
-- SELECT schemaname, tablename, policyname
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
--
-- Expected policies (all should end with _v2 or _v3):
--   tournaments: tournaments_select_v2, tournaments_insert_v3, tournaments_update_v2, tournaments_delete_v2
--   teams: teams_select_v2, teams_insert_v2, teams_update_v2, teams_delete_v2
--   matches: matches_select_v2, matches_insert_v2, matches_update_v2, matches_delete_v2
--   match_events: match_events_select_v2, match_events_insert_v2, match_events_update_v2, match_events_delete_v2
--   sponsors: sponsors_select_v2, sponsors_insert_v2, sponsors_update_v2, sponsors_delete_v2
--   monitors: monitors_select_v2, monitors_insert_v2, monitors_update_v2, monitors_delete_v2
--   match_corrections: match_corrections_select_v2, match_corrections_insert_v2, match_corrections_update_v2, match_corrections_delete_v2
