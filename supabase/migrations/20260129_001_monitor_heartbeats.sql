-- =============================================================================
-- Monitor Heartbeats - Display Online-Status Tracking
-- =============================================================================
-- Each monitor device sends a heartbeat every 30s so the admin dashboard
-- can show which displays are online, stale, or offline.

CREATE TABLE IF NOT EXISTS monitor_heartbeats (
  monitor_id UUID PRIMARY KEY REFERENCES monitors(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  slide_index INT,
  cache_status TEXT CHECK (cache_status IN ('fresh', 'stale', 'critical')),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by tournament (admin dashboard queries)
CREATE INDEX IF NOT EXISTS idx_monitor_heartbeats_tournament
  ON monitor_heartbeats(tournament_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE monitor_heartbeats ENABLE ROW LEVEL SECURITY;

-- Tournament owners can read heartbeats for their monitors
CREATE POLICY "owner_select_heartbeats" ON monitor_heartbeats
  FOR SELECT USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE owner_id = auth.uid()
    )
  );

-- Display pages (anon) can upsert heartbeats
-- Note: Display pages run unauthenticated with the anon key.
-- SELECT is restricted to owners only, so anon can write but not read others.
CREATE POLICY "anon_upsert_heartbeats" ON monitor_heartbeats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_update_heartbeats" ON monitor_heartbeats
  FOR UPDATE USING (true) WITH CHECK (true);
