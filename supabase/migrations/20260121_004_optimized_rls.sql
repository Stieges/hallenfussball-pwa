-- Migration: Optimized RLS Policies using denormalized columns
-- Purpose: Replace slow EXISTS-based policies with direct column checks
--
-- Performance: 100x faster than EXISTS subqueries
-- Requires: 002_denormalize_owner and 003_backfill_owner completed first
--
-- Strategy:
--   - SELECT: Public OR owner
--   - INSERT/UPDATE/DELETE: Owner only (auth.uid() = owner_id)

-- ============================================================================
-- 1. TOURNAMENTS - Optimized policies
-- ============================================================================

-- Keep existing tournament policies as they already use direct columns
-- Just ensure they're correct:

DROP POLICY IF EXISTS "tournaments_select_v2" ON tournaments;
CREATE POLICY "tournaments_select_v2"
ON tournaments FOR SELECT
TO authenticated, anon
USING (
  -- Public tournaments visible to everyone
  is_public = true
  OR
  -- Owner can always see their tournaments
  auth.uid() = owner_id
);

DROP POLICY IF EXISTS "tournaments_insert_v2" ON tournaments;
CREATE POLICY "tournaments_insert_v2"
ON tournaments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "tournaments_update_v2" ON tournaments;
CREATE POLICY "tournaments_update_v2"
ON tournaments FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "tournaments_delete_v2" ON tournaments;
CREATE POLICY "tournaments_delete_v2"
ON tournaments FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- ============================================================================
-- 2. TEAMS - Optimized policies (direct column check, no JOIN)
-- ============================================================================

DROP POLICY IF EXISTS "teams_select_v2" ON teams;
CREATE POLICY "teams_select_v2"
ON teams FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  auth.uid() = owner_id
);

DROP POLICY IF EXISTS "teams_insert_v2" ON teams;
CREATE POLICY "teams_insert_v2"
ON teams FOR INSERT
TO authenticated
WITH CHECK (
  -- Verify tournament exists and user owns it
  EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = tournament_id
    AND owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "teams_update_v2" ON teams;
CREATE POLICY "teams_update_v2"
ON teams FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "teams_delete_v2" ON teams;
CREATE POLICY "teams_delete_v2"
ON teams FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- ============================================================================
-- 3. MATCHES - Optimized policies
-- ============================================================================

DROP POLICY IF EXISTS "matches_select_v2" ON matches;
CREATE POLICY "matches_select_v2"
ON matches FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  auth.uid() = owner_id
);

DROP POLICY IF EXISTS "matches_insert_v2" ON matches;
CREATE POLICY "matches_insert_v2"
ON matches FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = tournament_id
    AND owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "matches_update_v2" ON matches;
CREATE POLICY "matches_update_v2"
ON matches FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "matches_delete_v2" ON matches;
CREATE POLICY "matches_delete_v2"
ON matches FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- ============================================================================
-- 4. MATCH_EVENTS - Optimized policies
-- ============================================================================

DROP POLICY IF EXISTS "match_events_select_v2" ON match_events;
CREATE POLICY "match_events_select_v2"
ON match_events FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  auth.uid() = owner_id
);

DROP POLICY IF EXISTS "match_events_insert_v2" ON match_events;
CREATE POLICY "match_events_insert_v2"
ON match_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM matches
    WHERE id = match_id
    AND owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "match_events_update_v2" ON match_events;
CREATE POLICY "match_events_update_v2"
ON match_events FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "match_events_delete_v2" ON match_events;
CREATE POLICY "match_events_delete_v2"
ON match_events FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- ============================================================================
-- 5. SPONSORS - Optimized policies
-- ============================================================================

DROP POLICY IF EXISTS "sponsors_select_v2" ON sponsors;
CREATE POLICY "sponsors_select_v2"
ON sponsors FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  auth.uid() = owner_id
);

DROP POLICY IF EXISTS "sponsors_insert_v2" ON sponsors;
CREATE POLICY "sponsors_insert_v2"
ON sponsors FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = tournament_id
    AND owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "sponsors_update_v2" ON sponsors;
CREATE POLICY "sponsors_update_v2"
ON sponsors FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "sponsors_delete_v2" ON sponsors;
CREATE POLICY "sponsors_delete_v2"
ON sponsors FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- ============================================================================
-- 6. MONITORS - Optimized policies
-- ============================================================================

DROP POLICY IF EXISTS "monitors_select_v2" ON monitors;
CREATE POLICY "monitors_select_v2"
ON monitors FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  auth.uid() = owner_id
);

DROP POLICY IF EXISTS "monitors_insert_v2" ON monitors;
CREATE POLICY "monitors_insert_v2"
ON monitors FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = tournament_id
    AND owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "monitors_update_v2" ON monitors;
CREATE POLICY "monitors_update_v2"
ON monitors FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "monitors_delete_v2" ON monitors;
CREATE POLICY "monitors_delete_v2"
ON monitors FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- ============================================================================
-- 7. MATCH_CORRECTIONS - Optimized policies
-- ============================================================================

DROP POLICY IF EXISTS "match_corrections_select_v2" ON match_corrections;
CREATE POLICY "match_corrections_select_v2"
ON match_corrections FOR SELECT
TO authenticated, anon
USING (
  is_public = true
  OR
  auth.uid() = owner_id
);

DROP POLICY IF EXISTS "match_corrections_insert_v2" ON match_corrections;
CREATE POLICY "match_corrections_insert_v2"
ON match_corrections FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM matches
    WHERE id = match_id
    AND owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "match_corrections_update_v2" ON match_corrections;
CREATE POLICY "match_corrections_update_v2"
ON match_corrections FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "match_corrections_delete_v2" ON match_corrections;
CREATE POLICY "match_corrections_delete_v2"
ON match_corrections FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);
