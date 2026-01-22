-- Migration: Anonymous User Tournament Limit (3 active tournaments)
-- Purpose: Limit anonymous users to 3 active tournaments to encourage registration
--
-- How it works:
--   - Anonymous users are identified by is_anonymous flag in auth.users
--   - Active tournaments = status NOT IN ('archived', 'deleted')
--   - CHECK constraint on INSERT prevents exceeding limit
--
-- Notes:
--   - This uses RLS policy to enforce limit on INSERT
--   - Client should also check before attempting INSERT (for better UX)
--   - Authenticated users have no limit

-- ============================================================================
-- 1. HELPER FUNCTION: Check if current user is anonymous
-- ============================================================================

CREATE OR REPLACE FUNCTION is_anonymous_user()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the current user has is_anonymous = true in their JWT claims
  -- Supabase sets this automatically for anonymous sign-ins
  RETURN COALESCE(
    (auth.jwt() -> 'is_anonymous')::text::boolean,
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_anonymous_user() IS 'Returns true if the current user is an anonymous sign-in';

-- ============================================================================
-- 2. HELPER FUNCTION: Count active tournaments for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION count_active_tournaments(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO active_count
  FROM tournaments
  WHERE owner_id = user_id
    AND (status IS NULL OR status NOT IN ('archived', 'deleted'));

  RETURN COALESCE(active_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION count_active_tournaments(UUID) IS 'Counts active (non-archived) tournaments for a user';

-- ============================================================================
-- 3. CONSTANT: Maximum tournaments for anonymous users
-- ============================================================================

-- Using a function so it can be easily changed without migration
CREATE OR REPLACE FUNCTION anonymous_tournament_limit()
RETURNS INTEGER AS $$
BEGIN
  RETURN 3;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION anonymous_tournament_limit() IS 'Returns the maximum number of active tournaments for anonymous users';

-- ============================================================================
-- 4. REPLACE tournaments INSERT policy with limit check
-- ============================================================================

-- Drop the v2 insert policy we just created
DROP POLICY IF EXISTS "tournaments_insert_v2" ON tournaments;

-- Create new policy with anonymous limit
CREATE POLICY "tournaments_insert_v3"
ON tournaments FOR INSERT
TO authenticated
WITH CHECK (
  -- Must be the owner
  auth.uid() = owner_id
  AND
  -- If anonymous, check limit
  (
    NOT is_anonymous_user()
    OR
    count_active_tournaments(auth.uid()) < anonymous_tournament_limit()
  )
);

-- ============================================================================
-- 5. API FUNCTION: Check if user can create tournament (for client-side)
-- ============================================================================

CREATE OR REPLACE FUNCTION can_create_tournament()
RETURNS JSONB AS $$
DECLARE
  current_count INTEGER;
  max_limit INTEGER;
  is_anon BOOLEAN;
BEGIN
  is_anon := is_anonymous_user();
  current_count := count_active_tournaments(auth.uid());
  max_limit := CASE WHEN is_anon THEN anonymous_tournament_limit() ELSE 999999 END;

  RETURN jsonb_build_object(
    'canCreate', current_count < max_limit,
    'isAnonymous', is_anon,
    'currentCount', current_count,
    'limit', max_limit,
    'remaining', GREATEST(0, max_limit - current_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_create_tournament() IS 'Returns whether the current user can create a new tournament and their limits';

-- Grant execute to authenticated users (including anonymous)
GRANT EXECUTE ON FUNCTION can_create_tournament() TO authenticated;

-- ============================================================================
-- 6. ERROR MESSAGE FUNCTION: Friendly error for limit exceeded
-- ============================================================================

-- This function can be used by triggers or edge functions to provide
-- a user-friendly error message
CREATE OR REPLACE FUNCTION tournament_limit_error_message()
RETURNS TEXT AS $$
BEGIN
  IF is_anonymous_user() THEN
    RETURN 'Du hast das Limit von 3 Turnieren erreicht. Registriere dich kostenlos, um unbegrenzt Turniere zu erstellen.';
  ELSE
    RETURN NULL; -- No limit for registered users
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
