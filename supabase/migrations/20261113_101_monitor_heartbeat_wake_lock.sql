-- supabase/migrations/20261113_101_monitor_heartbeat_wake_lock.sql
-- B-48b (Bauplan § 19, @ME-064; Befund C-HEARTBEAT): Lebenszeichen der Monitore reparieren und um den
-- Wachhalten-Zustand erweitern.
-- Ursache C-HEARTBEAT: record_monitor_heartbeat nahm p_monitor_id uuid und pruefte gegen die unbenutzte Tabelle
-- monitors. Die Monitore tragen Kennungen 'mon-…' und liegen in tournaments.config -> 'monitors'.
-- Neu: Kennung als Text, Pruefung gegen config.monitors, Schluessel (tournament_id, monitor_id), Spalte wake_lock.
-- wake_lock: granted (zugesagt) | denied (abgelehnt/nicht unterstuetzt) | no_answer (5 s ohne Antwort)
--            | released (nach Zusage wieder freigegeben) | not_applicable (Browser-Quelle, Daniel D-B48-3).
-- Bestand: Zeilen bleiben erhalten (monitor_id wird Text). Laut C-HEARTBEAT kam nie ein Lebenszeichen an.
-- Idempotent bis auf die Signatur-Umstellung (DROP der alten Signatur, IF EXISTS).
-- Lesen unveraendert: heartbeats_select_v2 aus 20261110_004_coadmin_einsatz.sql (manageScreens).
-- RUECKBAU: eigene Datei (Anhang B von B-48b-sql-freigabe.md, erzeugt mit
--   `bash scripts/monitor-heartbeat-check.sh --print-rueckweg`): neue Funktion droppen, alte Funktion woertlich aus der
--   Baseline, Spalte wake_lock und Pruefregeln droppen, Zeilen ohne passenden monitors-Eintrag loeschen (mit Daniels
--   Freigabe), monitor_id zurueck auf uuid, PK (monitor_id) und FK auf monitors wiederherstellen.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.monitor_heartbeats') IS NULL THEN
    RAISE EXCEPTION '20261113_101_monitor_heartbeat_wake_lock: Tabelle monitor_heartbeats fehlt';
  END IF;
  IF to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL THEN
    RAISE EXCEPTION '20261113_101_monitor_heartbeat_wake_lock: has_tournament_permission fehlt';
  END IF;
END $$;

ALTER TABLE public.monitor_heartbeats DROP CONSTRAINT IF EXISTS monitor_heartbeats_monitor_id_fkey;
ALTER TABLE public.monitor_heartbeats DROP CONSTRAINT IF EXISTS monitor_heartbeats_pkey;
ALTER TABLE public.monitor_heartbeats ALTER COLUMN monitor_id TYPE text USING monitor_id::text;
ALTER TABLE public.monitor_heartbeats ADD CONSTRAINT monitor_heartbeats_pkey PRIMARY KEY (tournament_id, monitor_id);

ALTER TABLE public.monitor_heartbeats DROP CONSTRAINT IF EXISTS monitor_heartbeats_monitor_key_form;
ALTER TABLE public.monitor_heartbeats ADD CONSTRAINT monitor_heartbeats_monitor_key_form
  CHECK (char_length(monitor_id) BETWEEN 1 AND 100) NOT VALID;
ALTER TABLE public.monitor_heartbeats VALIDATE CONSTRAINT monitor_heartbeats_monitor_key_form;

ALTER TABLE public.monitor_heartbeats ADD COLUMN IF NOT EXISTS wake_lock text;
COMMENT ON COLUMN public.monitor_heartbeats.wake_lock IS
  'Zusage des Geraets zum Anlassen des Bildschirms (@ME-064): granted|denied|no_answer|released|not_applicable. Sagt nicht, ob der Fernseher an ist.';
ALTER TABLE public.monitor_heartbeats DROP CONSTRAINT IF EXISTS monitor_heartbeats_wake_lock_check;
ALTER TABLE public.monitor_heartbeats ADD CONSTRAINT monitor_heartbeats_wake_lock_check
  CHECK (wake_lock IS NULL OR wake_lock IN ('granted', 'denied', 'no_answer', 'released', 'not_applicable')) NOT VALID;
ALTER TABLE public.monitor_heartbeats VALIDATE CONSTRAINT monitor_heartbeats_wake_lock_check;

DROP FUNCTION IF EXISTS public.record_monitor_heartbeat(uuid, uuid, integer, text, text);

CREATE OR REPLACE FUNCTION public.record_monitor_heartbeat(
  p_monitor_key   text,
  p_tournament_id uuid,
  p_slide_index   integer DEFAULT NULL,
  p_cache_status  text    DEFAULT NULL,
  p_user_agent    text    DEFAULT NULL,
  p_wake_lock     text    DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_monitor_key IS NULL OR char_length(p_monitor_key) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'monitor key invalid' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.tournaments t
     WHERE t.id = p_tournament_id
       AND t.deleted_at IS NULL
       AND (t.is_public = true OR public.has_tournament_permission(t.id, 'tournamentSettings'))
       AND EXISTS (
         SELECT 1
           FROM jsonb_array_elements(
                  CASE WHEN jsonb_typeof(t.config -> 'monitors') = 'array'
                       THEN t.config -> 'monitors' ELSE '[]'::jsonb END) AS m(item)
          WHERE m.item ->> 'id' = p_monitor_key)
  ) THEN
    RAISE EXCEPTION 'monitor/tournament mismatch or not visible' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.monitor_heartbeats
    (monitor_id, tournament_id, last_seen, slide_index, cache_status, user_agent, wake_lock)
  VALUES
    (p_monitor_key, p_tournament_id, now(), p_slide_index, p_cache_status, left(p_user_agent, 500), p_wake_lock)
  ON CONFLICT (tournament_id, monitor_id) DO UPDATE SET
    last_seen    = now(),
    slide_index  = EXCLUDED.slide_index,
    cache_status = EXCLUDED.cache_status,
    user_agent   = EXCLUDED.user_agent,
    wake_lock    = EXCLUDED.wake_lock;
END;
$$;

REVOKE ALL ON FUNCTION public.record_monitor_heartbeat(text, uuid, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_monitor_heartbeat(text, uuid, integer, text, text, text) TO anon, authenticated;

COMMIT;
