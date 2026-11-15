-- supabase/rollbacks/20261125_001_hallenton_ausgang_zustaende_rollback.sql
-- RUECKWEG zu supabase/migrations/20261125_001_hallenton_ausgang_zustaende.sql (Hallenton, Zustaende des Ausgangs und Abmelden).
-- Liegt bewusst NICHT in supabase/migrations (wird nie nachgespielt); belegt in scripts/hallenton-check.sh (Kategorie A: Schema
-- public danach = Stand vor der Migration, danach erneut einspielbar).
-- Vorher: App auf den Stand ohne die neuen Zustaende (kein Senden von output_lost/output_unconfirmed, kein Abmelden fremder Geraete).
-- Wirkung: Zeilen mit einem der zwei neuen Zustaende werden auf NULL gesetzt („noch kein Lebenszeichen“, das naechste Lebenszeichen
-- schreibt wieder einen der sechs bisherigen Zustaende), hall_speakers_state_check wieder mit den sechs Zustaenden,
-- hall_speaker_heartbeat in der Fassung 20261123_001, hall_speaker_unassign entfaellt, der Spaltenkommentar ist wieder der alte.
-- Enthaelt wie die Migration typografische Anfuehrungszeichen im Spaltenkommentar (woertliche Wiederherstellung des Kommentars aus 20261121_001).
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF to_regprocedure('public.hall_speaker_unassign(uuid,integer[])') IS NULL
     OR coalesce(md5((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.hall_speaker_heartbeat(uuid,uuid,integer[],text,boolean)'))), '') <> 'f0aff155a33b07316857d9f4c623825e' THEN
    RAISE EXCEPTION 'Rueckweg 20261125_001: Hallenton nicht in der Fassung 20261125_001 -- nichts geaendert';
  END IF;
END
$rw$;
DROP FUNCTION IF EXISTS public.hall_speaker_unassign(uuid, integer[]);
UPDATE public.hall_speakers SET state = NULL WHERE state IN ('output_lost', 'output_unconfirmed');
ALTER TABLE public.hall_speakers DROP CONSTRAINT IF EXISTS hall_speakers_state_check;
ALTER TABLE public.hall_speakers ADD CONSTRAINT hall_speakers_state_check CHECK (state IS NULL OR state IN
  ('ready', 'not_activated', 'background', 'slept', 'custom_sound_failed', 'volume_zero'));
COMMENT ON COLUMN public.hall_speakers.state IS
  'Zustand aus dem letzten Lebenszeichen: ready | not_activated (Ton nicht aktiviert) | background (Hintergrund) | slept
   (vom Browser schlafen gelegt) | custom_sound_failed (eigener Ton nicht geladen, spielt Hupe 1) | volume_zero
   (Lautstaerke 0 %). „meldet sich nicht“ ergibt sich aus dem Alter von last_seen (Server), „keine Verbindung“ zeigt nur
   das Geraet selbst.';
CREATE OR REPLACE FUNCTION public.hall_speaker_heartbeat(p_tournament_id uuid, p_device_id uuid, p_fields integer[],
                                                         p_state text, p_output_changed boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fields integer[];
  v_now timestamptz := now();
  v_out jsonb;
BEGIN
  PERFORM public.hall_require(p_tournament_id, 'manageScreens');
  PERFORM public.hall_require_open(p_tournament_id);
  IF p_device_id IS NULL
     OR p_state IS NULL
     OR p_state NOT IN ('ready', 'not_activated', 'background', 'slept', 'custom_sound_failed', 'volume_zero') THEN
    RAISE EXCEPTION 'hallenton: heartbeat invalid' USING ERRCODE = '22023';
  END IF;
  v_fields := public.hall_checked_fields(p_tournament_id, p_fields);

  UPDATE public.hall_speakers s
     SET state = p_state, last_seen = v_now,
         output_hint_at = CASE WHEN coalesce(p_output_changed, false) THEN v_now ELSE s.output_hint_at END
   WHERE s.tournament_id = p_tournament_id AND s.field_id = ANY (v_fields) AND s.device_id = p_device_id;

  SELECT jsonb_agg(jsonb_build_object(
           'field', f.f,
           'status', CASE WHEN s.field_id IS NULL THEN 'unassigned'
                          WHEN s.device_id = p_device_id THEN 'ok' ELSE 'superseded' END,
           'test', CASE WHEN s.device_id = p_device_id AND s.test_id IS NOT NULL AND s.test_played_at IS NULL
                         AND s.test_requested_at > v_now - interval '10 seconds'
                        THEN jsonb_build_object('testId', s.test_id,
                                                'ageMs', public.hall_ms(v_now) - public.hall_ms(s.test_requested_at)) END,
           'lead', CASE WHEN s.device_id = p_device_id AND l.field_id IS NOT NULL
                        THEN jsonb_build_object('ageMs', public.hall_ms(v_now) - public.hall_ms(l.last_seen)) END)
           ORDER BY f.f)
    INTO v_out
    FROM unnest(v_fields) AS f(f)
    LEFT JOIN public.hall_speakers s ON s.tournament_id = p_tournament_id AND s.field_id = f.f
    LEFT JOIN public.hall_field_leads l ON l.tournament_id = p_tournament_id AND l.field_id = f.f;

  RETURN jsonb_build_object('status', 'ok', 'serverNow', public.hall_ms(v_now), 'fields', v_out);
END;
$$;
COMMIT;
