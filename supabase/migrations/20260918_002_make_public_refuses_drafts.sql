-- ============================================
-- 20260918_002: make_tournament_public lehnt nicht freigegebene Turniere ab
-- ============================================
--
-- Ein Turnier bleibt Entwurf, bis es jemand aktiv freigibt. Bisher hing die öffentliche
-- Erreichbarkeit allein an is_public/share_code — ein unfertiger Entwurf mit vorläufigen
-- Teamnamen war mit Link für jeden lesbar.
--
-- Freigabe-Marker ist `config->'publishedAt'` (ISO-Timestamp, gesetzt von
-- TournamentCreationService.publish), NICHT `status`:
--   `status = 'draft'` ist ein transienter Wizard-Marker. SettingsTab.tsx setzt ein
--   veröffentlichtes Turnier zum Bearbeiten zurück auf 'draft'; nur eine In-App-Rückkehr
--   stellt den Status wieder her. Ein Reload mitten in der Bearbeitung ließe ein laufendes
--   Turnier dauerhaft auf 'draft' stehen — eine Status-Prüfung würde es also mitten im
--   Spiel vom Netz nehmen.
--
-- Diese Funktion ist die Rückfallsicherung hinter der UI (Visibility/index.tsx) und dem
-- Service: auch ein direkter RPC-Aufruf kann einen Entwurf nicht öffentlich machen.
--
-- Body ansonsten unverändert übernommen aus 20260128_003_fix_function_search_path.sql.
-- SECURITY DEFINER und `SET search_path` bleiben exakt wie dort.
--
-- tournaments.config ist jsonb (DEFAULT '{}'), daher testet `?` auf Key-Existenz.
-- COALESCE deckt den Fall einer (theoretisch) NULL-config ab — ohne würde `NULL ? '…'`
-- zu NULL und die Sperre stillschweigend nicht greifen.

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

  -- Freigabe-Backstop: ohne publishedAt im config-JSONB ist das Turnier ein Entwurf.
  IF NOT (
    COALESCE(
      (SELECT config FROM tournaments WHERE id = tournament_id),
      '{}'::jsonb
    ) ? 'publishedAt'
  ) THEN
    RAISE EXCEPTION 'Tournament has not been released yet and cannot be made public';
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
