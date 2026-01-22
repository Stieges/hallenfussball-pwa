-- Migration: Create merge_user_data function
-- Purpose: Atomic account merge operation (anonymous → authenticated)
-- This function runs in a single transaction, ensuring data consistency
--
-- @see supabase/functions/merge-accounts/index.ts
-- @see docs/concepts/AUTH-KONZEPT-ERWEITERT.md

-- Drop function if it exists (for idempotency)
DROP FUNCTION IF EXISTS merge_user_data(UUID, UUID);

/**
 * Merges all data from an anonymous user to a target authenticated user.
 *
 * This function runs atomically - if any operation fails, the entire
 * merge is rolled back, preventing data inconsistency.
 *
 * @param p_source_user_id - The anonymous user's UUID (data source)
 * @param p_target_user_id - The authenticated user's UUID (data destination)
 * @returns JSON object with transfer counts and status
 *
 * @example
 * SELECT merge_user_data(
 *   'anon-user-uuid'::uuid,
 *   'target-user-uuid'::uuid
 * );
 */
CREATE OR REPLACE FUNCTION merge_user_data(
  p_source_user_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournaments_count INTEGER := 0;
  v_teams_count INTEGER := 0;
  v_matches_count INTEGER := 0;
  v_events_count INTEGER := 0;
  v_members_count INTEGER := 0;
  v_tournament_ids UUID[];
BEGIN
  -- Validate inputs
  IF p_source_user_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Both source and target user IDs are required';
  END IF;

  IF p_source_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Source and target user IDs cannot be the same';
  END IF;

  -- 1. Get tournament IDs that will be transferred (for cascading updates)
  SELECT ARRAY_AGG(id) INTO v_tournament_ids
  FROM tournaments
  WHERE owner_id = p_source_user_id;

  -- 2. Transfer tournaments
  WITH updated AS (
    UPDATE tournaments
    SET owner_id = p_target_user_id
    WHERE owner_id = p_source_user_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_tournaments_count FROM updated;

  -- 3. Transfer teams (denormalized owner_id)
  IF v_tournament_ids IS NOT NULL AND array_length(v_tournament_ids, 1) > 0 THEN
    WITH updated AS (
      UPDATE teams
      SET owner_id = p_target_user_id
      WHERE owner_id = p_source_user_id
        OR tournament_id = ANY(v_tournament_ids)
      RETURNING id
    )
    SELECT COUNT(*) INTO v_teams_count FROM updated;

    -- 4. Transfer matches (denormalized owner_id)
    WITH updated AS (
      UPDATE matches
      SET owner_id = p_target_user_id
      WHERE owner_id = p_source_user_id
        OR tournament_id = ANY(v_tournament_ids)
      RETURNING id
    )
    SELECT COUNT(*) INTO v_matches_count FROM updated;

    -- 5. Transfer match_events (denormalized owner_id)
    WITH updated AS (
      UPDATE match_events
      SET owner_id = p_target_user_id
      WHERE owner_id = p_source_user_id
      RETURNING id
    )
    SELECT COUNT(*) INTO v_events_count FROM updated;

    -- 6. Transfer tournament_members
    WITH updated AS (
      UPDATE tournament_members
      SET user_id = p_target_user_id
      WHERE user_id = p_source_user_id
        AND tournament_id = ANY(v_tournament_ids)
      RETURNING id
    )
    SELECT COUNT(*) INTO v_members_count FROM updated;
  END IF;

  -- 7. Delete the anonymous user's profile
  -- Note: The auth.users deletion must be done via Admin API in Edge Function
  DELETE FROM profiles WHERE id = p_source_user_id;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'source_user_id', p_source_user_id,
    'target_user_id', p_target_user_id,
    'transferred', jsonb_build_object(
      'tournaments', v_tournaments_count,
      'teams', v_teams_count,
      'matches', v_matches_count,
      'match_events', v_events_count,
      'tournament_members', v_members_count
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise the exception to trigger transaction rollback
    RAISE EXCEPTION 'Merge failed: %', SQLERRM;
END;
$$;

-- Grant execute permission to service role (Edge Functions)
GRANT EXECUTE ON FUNCTION merge_user_data(UUID, UUID) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION merge_user_data(UUID, UUID) IS
'Atomically merges all data from an anonymous user to a target authenticated user.
Used by the merge-accounts Edge Function for account consolidation.
Runs in a single transaction - any failure triggers full rollback.';
