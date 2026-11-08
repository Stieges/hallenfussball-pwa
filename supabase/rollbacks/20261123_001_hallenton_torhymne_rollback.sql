-- supabase/rollbacks/20261123_001_hallenton_torhymne_rollback.sql
-- RUECKWEG zu supabase/migrations/20261123_001_hallenton_torhymne.sql (Hallenton, Torhymne). Liegt bewusst NICHT in
-- supabase/migrations (wird nie nachgespielt); belegt in scripts/hallenton-check.sh (Kategorie T: Schema public danach =
-- Stand vor der Migration, danach erneut einspielbar).
-- Vorher: App auf den Stand ohne Torhymne. Wirkung: die Listen der Torhymnen entfallen (Dateien im Bucket bleiben, Daniel
-- loescht sie bei Bedarf im Dashboard), hall_goal_anthems_set entfaellt, Lebenszeichen und Stand wieder in der Fassung
-- 20261121_001 (Lebenszeichen nach dem Turnierende wieder ohne 55000). Rein ASCII.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF to_regprocedure('public.hall_goal_anthems_set(uuid,text[])') IS NULL
     OR coalesce(md5((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.hall_speaker_heartbeat(uuid,uuid,integer[],text,boolean)'))), '') <> '223c2fcfc5c884d50400163f64c541bd'
     OR coalesce(md5((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.hall_sound_status(uuid,uuid)'))), '') <> 'ad84e366133f55a3e515ed416915ec66' THEN
    RAISE EXCEPTION 'Rueckweg 20261123_001: Torhymne nicht in der Fassung 20261123_001 -- nichts geaendert';
  END IF;
END
$rw$;
DROP FUNCTION IF EXISTS public.hall_goal_anthems_set(uuid, text[]);
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

CREATE OR REPLACE FUNCTION public.hall_sound_status(p_tournament_id uuid, p_device_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_full boolean;
BEGIN
  IF p_tournament_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = p_tournament_id AND t.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'hallenton: not allowed' USING ERRCODE = '42501';
  END IF;
  v_full := public.has_tournament_permission(p_tournament_id, 'manageScreens');
  IF NOT v_full AND NOT public.has_tournament_permission(p_tournament_id, 'writeMatchData') THEN
    RAISE EXCEPTION 'hallenton: not allowed' USING ERRCODE = '42501';
  END IF;

  IF NOT v_full THEN
    RETURN jsonb_build_object(
      'serverNow', public.hall_ms(v_now),
      'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object(
                     'field', s.field_id, 'state', s.state,
                     'ageMs', CASE WHEN s.last_seen IS NULL THEN NULL
                                   ELSE public.hall_ms(v_now) - public.hall_ms(s.last_seen) END,
                     'outputHint', s.output_hint_at IS NOT NULL) ORDER BY s.field_id)
                    FROM public.hall_speakers s WHERE s.tournament_id = p_tournament_id), '[]'::jsonb));
  END IF;

  RETURN jsonb_build_object(
    'serverNow', public.hall_ms(v_now),
    'closed', public.tournament_is_closed(p_tournament_id),
    'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object(
                   'field', s.field_id, 'deviceName', s.device_name,
                   'isThisDevice', coalesce(s.device_id = p_device_id, false),
                   'state', s.state, 'assignedAt', public.hall_ms(s.assigned_at),
                   'outputHint', s.output_hint_at IS NOT NULL,
                   'hintAt', public.hall_ms(s.output_hint_at),
                   'lastSeen', public.hall_ms(s.last_seen),
                   'ageMs', CASE WHEN s.last_seen IS NULL THEN NULL
                                 ELSE public.hall_ms(v_now) - public.hall_ms(s.last_seen) END,
                   'test', CASE WHEN s.test_id IS NULL THEN NULL
                                ELSE jsonb_build_object('testId', s.test_id,
                                                        'requestedAt', public.hall_ms(s.test_requested_at),
                                                        'playedAt', public.hall_ms(s.test_played_at)) END)
                   ORDER BY s.field_id)
                  FROM public.hall_speakers s WHERE s.tournament_id = p_tournament_id), '[]'::jsonb),
    'leads', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'field', l.field_id, 'ageMs', public.hall_ms(v_now) - public.hall_ms(l.last_seen)) ORDER BY l.field_id)
               FROM public.hall_field_leads l WHERE l.tournament_id = p_tournament_id), '[]'::jsonb),
    'settings', coalesce((SELECT jsonb_build_object('halftimeSound', st.halftime_sound,
                                                    'halftimeCustomPath', st.halftime_custom_path,
                                                    'endCustomPath', st.end_custom_path,
                                                    'goalToneFields', to_jsonb(st.goal_tone_fields))
                            FROM public.hall_sound_settings st WHERE st.tournament_id = p_tournament_id),
                         jsonb_build_object('halftimeSound', 'horn-1', 'halftimeCustomPath', NULL,
                                            'endCustomPath', NULL, 'goalToneFields', '[]'::jsonb)));
END;
$$;
ALTER TABLE public.hall_sound_settings DROP CONSTRAINT IF EXISTS hall_sound_settings_goal_anthems;
ALTER TABLE public.hall_sound_settings DROP COLUMN IF EXISTS goal_anthem_paths;
COMMIT;
