-- supabase/migrations/20261123_001_hallenton_torhymne.sql
-- Hallenton -- Torhymne (Plan „Paket Hallenton“ H3c). Record docs/anforderungen/2026-10-15_hallenton.md, Regeln 1-4.
-- Szenarien (Server-Teil): @HT-024 (Liste der Torhymnen je Turnier; „Ton bei Tor“ je Feld gibt es seit 20261121_001),
--   @HT-046 (nach dem Turnierende: Hymnen nicht mehr aendern; Lebenszeichen 55000, Ruling W1 aus H3b-3, dauerhaft).
--
-- Inhalt:
--   1. hall_sound_settings.goal_anthem_paths text[] NOT NULL DEFAULT '{}': die Torhymnen des Turniers in ihrer
--      Reihenfolge (der Lautsprecher spielt sie der Reihe nach). Pruefregel hall_sound_settings_goal_anthems: hoechstens 5,
--      eindimensional, keine NULL, kein Komma in einem Eintrag, jeder Pfad in der Form der bestehenden Pfad-Pruefung
--      <tournament_id>/<uuid>.mp3|wav|m4a
--      (Bucket hallenton-sounds, derselbe wie der eigene Ton; Hochladen/Policies unveraendert aus 20261121_001).
--   2. hall_goal_anthems_set(p_tournament_id, p_paths) -- Schreiben der Liste, SECURITY DEFINER, search_path fest, EXECUTE nur
--      authenticated (NICHT anon/PUBLIC/service_role). Reihenfolge der Pruefung wie hall_sound_settings_set: manageScreens
--      (42501, sonst „gibt es nicht“ und „darf nicht“ gleich), dann Turnier offen (55000 TOURNAMENT_FINISHED), dann die
--      Liste (22023: NULL, mehrdimensional, NULL-Eintrag, doppelter Pfad, mehr als 5, falscher Pfad). '{}' leert die Liste.
--      Antwort {status:'saved'}. Die uebrigen Spalten der Tonwahl bleiben unberuehrt; hall_sound_settings_set bleibt mit
--      unveraenderter Signatur (kein Ueberladen) und laesst goal_anthem_paths stehen.
--   3. hall_sound_status (volle Sicht, manageScreens): settings.goalAnthemPaths (Liste, ohne Zeile []). Die schmale
--      Helfer-Sicht bleibt Byte fuer Byte gleich (keine Tonwahl).
--   4. hall_speaker_heartbeat: zusaetzlich PERFORM public.hall_require_open(p_tournament_id) nach hall_require -- nach dem
--      Turnierende 55000 (Ruling W1 aus H3b-3, dauerhaft). Der Client schaltet darauf still ab (lautsprecherLebenszeichen.ts,
--      Zweig turnier_beendet). Quittung, Ausschalten, Lesen und das Lebenszeichen der Leitung bleiben nach dem Ende erlaubt.
--   Rumpfe von hall_speaker_heartbeat und hall_sound_status: woertlich 20261121_001 plus die genannten Zeilen
--   (md5 der Fassungen im Fail-fast und im Rueckweg).
--
-- Rechte: keine neue Tabelle; hall_sound_settings behaelt RLS an, keine Policy, keine Client-Rechte. Neue Funktion nur fuer
--   authenticated; anon hat kein EXECUTE (Assertion hallenton-goal-anthems-rpc-authenticated-only).
-- Voraussetzungen (Fail-fast, ohne Aenderung): 20261121_001 (hall_sound_settings, hall_require, hall_require_open,
--   hall_sound_settings_set) mit hall_speaker_heartbeat/hall_sound_status in der Fassung 20261121_001 oder schon dieser.
-- Fehlercodes: nur Standard-SQLSTATE (42501, 22023, 55000).
-- Bestandsdaten: bestehende Zeilen bekommen '{}' (keine Hymne). Idempotent: ADD COLUMN IF NOT EXISTS, Pruefregel nur wenn
--   sie fehlt, CREATE OR REPLACE.
--
-- RUECKWEG: supabase/rollbacks/20261123_001_hallenton_torhymne_rollback.sql (belegt in scripts/hallenton-check.sh,
--   Kategorie T: Schema danach = vorher). Vorher die App auf den Stand ohne Torhymne. Der Rueckweg loescht die Listen der
--   Torhymnen (Dateien im Bucket bleiben) und stellt Lebenszeichen und Stand in der Fassung 20261121_001 wieder her.
--
-- Produktion: nur nach Daniels Freigabe (SQL + SHA). Dieser Branch spielt nichts ein. Typen nachgezogen (src/types/supabase.ts).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.hall_sound_settings') IS NULL
     OR to_regprocedure('public.hall_require(uuid,text)') IS NULL
     OR to_regprocedure('public.hall_require_open(uuid)') IS NULL
     OR to_regprocedure('public.hall_sound_settings_set(uuid,text,text,text,integer[])') IS NULL THEN
    RAISE EXCEPTION '20261123_001_hallenton_torhymne: Hallenton fehlt -- zuerst 20261121_001_hallenton einspielen';
  END IF;
  IF coalesce(md5((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.hall_speaker_heartbeat(uuid,uuid,integer[],text,boolean)'))), '')
       NOT IN ('f797d16a103768b36036e000ecf3c1a6', '223c2fcfc5c884d50400163f64c541bd')
     OR coalesce(md5((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.hall_sound_status(uuid,uuid)'))), '')
       NOT IN ('b1b747dc4d0b3e901b79475a427ea4e2', 'ad84e366133f55a3e515ed416915ec66') THEN
    RAISE EXCEPTION '20261123_001_hallenton_torhymne: hall_speaker_heartbeat/hall_sound_status nicht in der Fassung 20261121_001 -- nichts geaendert';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Spalte und Pruefregel
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.hall_sound_settings ADD COLUMN IF NOT EXISTS goal_anthem_paths text[] NOT NULL DEFAULT '{}';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.hall_sound_settings'::regclass AND conname = 'hall_sound_settings_goal_anthems') THEN
    -- CASE: erst die Form der Liste, dann die Eintraege (array_position scheitert an mehrdimensionalen Listen)
    ALTER TABLE public.hall_sound_settings ADD CONSTRAINT hall_sound_settings_goal_anthems CHECK (
      CASE WHEN coalesce(array_ndims(goal_anthem_paths), 1) <> 1 OR cardinality(goal_anthem_paths) > 5 THEN false
           WHEN cardinality(goal_anthem_paths) = 0 THEN true
           ELSE array_position(goal_anthem_paths, NULL) IS NULL
                -- kein Eintrag mit Komma: sonst ergaebe ein einzelner Eintrag '<pfad>,<pfad>' zusammengefuegt zwei gueltige
                AND position(',' IN array_to_string(goal_anthem_paths, '')) = 0
                AND array_to_string(goal_anthem_paths, ',') ~ ('^(' || tournament_id::text
                    || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|wav|m4a))(,' || tournament_id::text
                    || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|wav|m4a))*$')
      END);
  END IF;
END
$$;
COMMENT ON COLUMN public.hall_sound_settings.goal_anthem_paths IS
  'Hallenton (@HT-024): Torhymnen des Turniers in ihrer Reihenfolge (hoechstens 5), Pfade <tournament_id>/<uuid>.mp3|wav|m4a
   im Bucket hallenton-sounds. Leer = keine Hymne. Schreiben nur ueber hall_goal_anthems_set.';

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Torhymnen setzen (@HT-024, @HT-046)
-- ---------------------------------------------------------------------------------------------------------------
-- Ersetzt die ganze Liste (Reihenfolge = Reihenfolge am Lautsprecher). Doppelte Pfade sind ungueltig (sonst kaeme dieselbe
-- Hymne zweimal hintereinander, @HT-024 Zeile 2).
CREATE OR REPLACE FUNCTION public.hall_goal_anthems_set(p_tournament_id uuid, p_paths text[])
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.hall_require(p_tournament_id, 'manageScreens');
  PERFORM public.hall_require_open(p_tournament_id);
  IF p_paths IS NULL
     OR coalesce(array_ndims(p_paths), 1) <> 1
     OR (SELECT count(DISTINCT u.x) FROM unnest(p_paths) AS u(x)) <> cardinality(p_paths) THEN
    RAISE EXCEPTION 'hallenton: goal anthems invalid' USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.hall_sound_settings AS s (tournament_id, goal_anthem_paths, updated_at)
    VALUES (p_tournament_id, p_paths, now())
    ON CONFLICT (tournament_id) DO UPDATE SET
      goal_anthem_paths = EXCLUDED.goal_anthem_paths, updated_at = EXCLUDED.updated_at;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'hallenton: goal anthems invalid' USING ERRCODE = '22023';
  END;
  RETURN jsonb_build_object('status', 'saved');
END;
$$;
REVOKE ALL ON FUNCTION public.hall_goal_anthems_set(uuid, text[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.hall_goal_anthems_set(uuid, text[]) TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Lebenszeichen: nach dem Turnierende 55000 (Ruling W1 aus H3b-3, @HT-046) -- Rumpf sonst wie 20261121_001
-- ---------------------------------------------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Stand lesen: volle Sicht mit settings.goalAnthemPaths (@HT-024) -- sonst wie 20261121_001
-- ---------------------------------------------------------------------------------------------------------------
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
                                                    'goalToneFields', to_jsonb(st.goal_tone_fields),
                                                    'goalAnthemPaths', to_jsonb(st.goal_anthem_paths))
                            FROM public.hall_sound_settings st WHERE st.tournament_id = p_tournament_id),
                         jsonb_build_object('halftimeSound', 'horn-1', 'halftimeCustomPath', NULL,
                                            'endCustomPath', NULL, 'goalToneFields', '[]'::jsonb,
                                            'goalAnthemPaths', '[]'::jsonb)));
END;
$$;

COMMIT;
