-- Migration: Fix function search_path for security
-- Purpose: Eliminate 19 function_search_path_mutable warnings
-- Strategy: Recreate all functions with SET search_path = public, pg_temp

-- ============================================
-- TRIGGER FUNCTIONS (Version Increment)
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_team_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_match_event_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_sponsor_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_monitor_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

-- ============================================
-- TRIGGER FUNCTIONS (Owner/Visibility Sync)
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_owner_from_tournament()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  SELECT owner_id, is_public
  INTO NEW.owner_id, NEW.is_public
  FROM tournaments
  WHERE id = NEW.tournament_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_owner_from_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  SELECT owner_id, is_public
  INTO NEW.owner_id, NEW.is_public
  FROM matches
  WHERE id = NEW.match_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cascade_tournament_visibility()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF OLD.is_public IS DISTINCT FROM NEW.is_public THEN
    UPDATE teams SET is_public = NEW.is_public WHERE tournament_id = NEW.id;
    UPDATE matches SET is_public = NEW.is_public WHERE tournament_id = NEW.id;
    UPDATE sponsors SET is_public = NEW.is_public WHERE tournament_id = NEW.id;
    UPDATE monitors SET is_public = NEW.is_public WHERE tournament_id = NEW.id;

    UPDATE match_events SET is_public = NEW.is_public
    WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = NEW.id);

    UPDATE match_corrections SET is_public = NEW.is_public
    WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================
-- HELPER FUNCTIONS (Share Code)
-- ============================================

CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$function$;

-- ============================================
-- SECURITY DEFINER FUNCTIONS (Auth Helpers)
-- These are CRITICAL for security!
-- ============================================

CREATE OR REPLACE FUNCTION public.is_anonymous_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN COALESCE((auth.jwt() -> 'is_anonymous')::text::boolean, false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.count_active_tournaments(user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count FROM tournaments
  WHERE owner_id = user_id AND (status IS NULL OR status NOT IN ('archived', 'deleted'));
  RETURN COALESCE(active_count, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.anonymous_tournament_limit()
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN 3;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_create_tournament()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.tournament_limit_error_message()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF is_anonymous_user() THEN
    RETURN 'Du hast das Limit von 3 Turnieren erreicht. Registriere dich kostenlos, um unbegrenzt Turniere zu erstellen.';
  ELSE
    RETURN NULL;
  END IF;
END;
$function$;

-- ============================================
-- SECURITY DEFINER FUNCTIONS (Tournament Checks)
-- ============================================

CREATE OR REPLACE FUNCTION public.is_tournament_owner(p_tournament_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = p_tournament_id AND owner_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_tournament_collaborator(p_tournament_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM tournament_collaborators
    WHERE tournament_id = p_tournament_id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_tournament_admin(p_tournament_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM tournament_collaborators
    WHERE tournament_id = p_tournament_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND accepted_at IS NOT NULL
  );
$function$;

-- ============================================
-- SECURITY DEFINER FUNCTIONS (Visibility Management)
-- ============================================

CREATE OR REPLACE FUNCTION public.make_tournament_public(tournament_id uuid)
RETURNS TABLE(share_code text, share_code_created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  new_code TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  -- Check ownership
  IF NOT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = tournament_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify this tournament';
  END IF;

  -- Generate unique code with retry logic
  LOOP
    attempt := attempt + 1;
    new_code := generate_share_code();

    -- Check if code is unique
    IF NOT EXISTS (SELECT 1 FROM tournaments WHERE tournaments.share_code = new_code) THEN
      EXIT;
    END IF;

    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique share code after % attempts', max_attempts;
    END IF;
  END LOOP;

  -- Update tournament
  UPDATE tournaments
  SET
    is_public = true,
    share_code = new_code,
    share_code_created_at = NOW()
  WHERE id = tournament_id;

  RETURN QUERY SELECT new_code, NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.regenerate_share_code(tournament_id uuid)
RETURNS TABLE(share_code text, share_code_created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  new_code TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  -- Check ownership
  IF NOT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = tournament_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify this tournament';
  END IF;

  -- Generate unique code with retry logic
  LOOP
    attempt := attempt + 1;
    new_code := generate_share_code();

    IF NOT EXISTS (SELECT 1 FROM tournaments WHERE tournaments.share_code = new_code) THEN
      EXIT;
    END IF;

    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique share code after % attempts', max_attempts;
    END IF;
  END LOOP;

  -- Update tournament
  UPDATE tournaments
  SET
    share_code = new_code,
    share_code_created_at = NOW()
  WHERE id = tournament_id;

  RETURN QUERY SELECT new_code, NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.make_tournament_private(tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Check ownership
  IF NOT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = tournament_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify this tournament';
  END IF;

  UPDATE tournaments
  SET
    is_public = false,
    share_code = NULL,
    share_code_created_at = NULL
  WHERE id = tournament_id;
END;
$function$;
