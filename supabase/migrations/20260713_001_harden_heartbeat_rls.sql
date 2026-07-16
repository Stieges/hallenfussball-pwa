-- =============================================================================
-- Harden monitor_heartbeats RLS: bind anon writes to a consistent
-- (monitor_id, tournament_id) pair. FK already guarantees monitor existence;
-- this prevents writing heartbeats under a foreign tournament_id.
-- Residual risk (spoofing a known monitor UUID) is accepted — full protection
-- would require per-monitor tokens.
-- =============================================================================

DROP POLICY IF EXISTS "anon_upsert_heartbeats" ON monitor_heartbeats;
DROP POLICY IF EXISTS "anon_update_heartbeats" ON monitor_heartbeats;

CREATE POLICY "anon_insert_heartbeats" ON monitor_heartbeats
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM monitors m
      WHERE m.id = monitor_heartbeats.monitor_id
        AND m.tournament_id = monitor_heartbeats.tournament_id
    )
  );

CREATE POLICY "anon_update_heartbeats" ON monitor_heartbeats
  FOR UPDATE USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM monitors m
      WHERE m.id = monitor_heartbeats.monitor_id
        AND m.tournament_id = monitor_heartbeats.tournament_id
    )
  );
