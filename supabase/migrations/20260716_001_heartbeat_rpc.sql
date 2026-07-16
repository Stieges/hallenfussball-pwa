-- =============================================================================
-- Heartbeats über security-definer RPC (Muster: public.make_tournament_public).
-- Root-Cause der toten Heartbeats: Der Client sandte connectionStatus
-- ('online'|'offline'|'degraded') in cache_status, dessen CHECK nur
-- ('fresh'|'stale'|'critical') erlaubt — jeder Write scheiterte am Constraint.
-- Die RPC validiert Monitor↔Turnier-Konsistenz UND Sichtbarkeit (is_public
-- bzw. Owner) — Letzteres erzwang bisher implizit die monitors-RLS im
-- Policy-EXISTS; SECURITY DEFINER würde sie sonst umgehen.
-- Residual risk (Spoofing bekannter Monitor-UUIDs öffentlicher Turniere)
-- bleibt akzeptiert — volle Absicherung bräuchte Monitor-Tokens.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_monitor_heartbeat(
  p_monitor_id uuid,
  p_tournament_id uuid,
  p_slide_index int DEFAULT NULL,
  p_cache_status text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM monitors m
    WHERE m.id = p_monitor_id
      AND m.tournament_id = p_tournament_id
      AND (m.is_public = true OR m.owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'monitor/tournament mismatch or not visible' USING ERRCODE = '42501';
  END IF;

  INSERT INTO monitor_heartbeats
    (monitor_id, tournament_id, last_seen, slide_index, cache_status, user_agent)
  VALUES
    (p_monitor_id, p_tournament_id, now(), p_slide_index, p_cache_status, p_user_agent)
  ON CONFLICT (monitor_id) DO UPDATE SET
    tournament_id = EXCLUDED.tournament_id,
    last_seen     = now(),
    slide_index   = EXCLUDED.slide_index,
    cache_status  = EXCLUDED.cache_status,
    user_agent    = EXCLUDED.user_agent;
END;
$$;

REVOKE ALL ON FUNCTION public.record_monitor_heartbeat(uuid, uuid, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_monitor_heartbeat(uuid, uuid, int, text, text) TO anon, authenticated;

-- Direkte anon-Writes sind obsolet (liefen wegen des CHECK-Verstoßes nie durch):
DROP POLICY IF EXISTS "anon_insert_heartbeats" ON monitor_heartbeats;
DROP POLICY IF EXISTS "anon_update_heartbeats" ON monitor_heartbeats;

-- Realtime-Events für das Owner-Dashboard (useMonitorHeartbeats subscribed
-- auf postgres_changes; ohne Publication-Mitgliedschaft kommt nie ein Event.
-- RLS wird von Realtime respektiert — owner_select_heartbeats gated die Events).
ALTER PUBLICATION supabase_realtime ADD TABLE public.monitor_heartbeats;
