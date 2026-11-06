-- supabase/rollbacks/20261119_001_gatherings_rollback.sql
-- RUECKWEG zu supabase/migrations/20261119_001_gatherings.sql (A1 Veranstaltung). Liegt bewusst NICHT in
-- supabase/migrations (wird nie nachgespielt); belegt in scripts/gatherings-check.sh (Kategorie X: Schema danach = Stand vor
-- der Migration). EIN Block.
-- Reihenfolge: ZUERST die App auf den Stand ohne Veranstaltungs-Client, DANN dieser Block. Veranstaltungen und Zuordnungen
-- gehen verloren (vorher sichern: COPY public.gatherings TO ..., COPY (SELECT id, gathering_id FROM public.tournaments
-- WHERE gathering_id IS NOT NULL) TO ...). Turniere, Spiele und Endstaende bleiben unveraendert; die Turnierantwort verliert
-- gathering_code.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF to_regclass('public.gatherings') IS NULL
     OR position('20261119_001' IN coalesce((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.tournaments_guard_lifecycle()')), '')) = 0
     OR position('20261119_001' IN coalesce((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public_view.public_payload(uuid,bigint,text,text)')), '')) = 0 THEN
    RAISE EXCEPTION 'Rueckweg 20261119_001: Veranstaltung nicht in der Fassung 20261119_001 -- nichts geaendert';
  END IF;
END
$rw$;

-- tournaments_guard_lifecycle woertlich aus 20261113_003_tournament_lifecycle.sql
CREATE OR REPLACE FUNCTION public.tournaments_guard_lifecycle() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  c_free constant text[] := ARRAY['is_public', 'share_code', 'share_code_created_at', 'version', 'updated_at',
                                  'change_revision', 'owner_id', 'config'];
  v_switch boolean := coalesce(current_setting('app.lifecycle_write', true), '') = 'on'
                      AND current_user NOT IN ('authenticated', 'anon');
  v_skip   text[];
BEGIN
  -- W3: Client-Rollen setzen status nur auf 'draft' oder 'published' (completed/live/archived schließen nichts mehr).
  IF current_user IN ('authenticated', 'anon') AND NEW.status NOT IN ('draft', 'published')
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'Nicht erlaubt: status % setzt nur der Server (Turnier %).', NEW.status, NEW.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.lifecycle_status := 'draft';
    NEW.finished_at := NULL;
    RETURN NEW;
  END IF;
  IF (NEW.lifecycle_status, NEW.finished_at) IS DISTINCT FROM (OLD.lifecycle_status, OLD.finished_at) AND NOT v_switch THEN
    RAISE EXCEPTION 'Nicht erlaubt: den Turnier-Zustand setzt nur der Server (Turnier %).', OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.lifecycle_status IN ('finished', 'cancelled') AND NOT v_switch THEN
    -- standingDecisions hält tournaments_keep_standing_decisions für Client-Rollen ohnehin auf dem Serverwert.
    v_skip := CASE WHEN current_user IN ('authenticated', 'anon') THEN ARRAY['publicScorers', 'standingDecisions']
                   ELSE ARRAY['publicScorers'] END;
    IF to_jsonb(NEW) - c_free IS DISTINCT FROM to_jsonb(OLD) - c_free
       OR coalesce(NEW.config, '{}'::jsonb) - v_skip IS DISTINCT FROM coalesce(OLD.config, '{}'::jsonb) - v_skip THEN
      RAISE EXCEPTION 'TOURNAMENT_FINISHED: Turnier ist abgeschlossen (Turnier %).', OLD.id USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tournaments_guard_lifecycle() FROM PUBLIC, anon, authenticated;

-- public_view.public_payload woertlich aus 20261117_104_public_payload.sql
CREATE OR REPLACE FUNCTION public_view.public_payload(p_tournament_id uuid, p_since_version bigint, p_audience text,
                                                     p_monitor_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  c_lag_us constant bigint := 5000000;
  v_t public.tournaments;
  v_now_us bigint := public_view.epoch_us(now());
  v_server_now bigint := floor(extract(epoch FROM now()) * 1000)::bigint;
  v_tournament_us bigint;
  v_teams_us bigint;
  v_matches_us bigint;
  v_structure_us bigint;
  v_max_us bigint;
  v_version bigint;
  v_full boolean;
  v_sw jsonb;
  v_kids boolean;
  v_rankings boolean;
  v_live boolean;
  v_events boolean;
  v_scorers boolean;
  v_screen boolean := p_audience = 'screen';
  v_referees text;
  v_tournament jsonb;
  v_teams jsonb;
  v_matches jsonb;
  v_result jsonb;
BEGIN
  IF p_audience IS NULL OR p_audience NOT IN ('viewer', 'screen') THEN
    RAISE EXCEPTION 'public_view.public_payload: unbekannte Zielgruppe %', p_audience USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_t FROM public.tournaments t WHERE t.id = p_tournament_id AND t.deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;

  v_tournament_us := public_view.epoch_us(coalesce(v_t.updated_at, v_t.created_at, '-infinity'::timestamptz));
  SELECT public_view.epoch_us(max(tm.updated_at)) INTO v_teams_us FROM public.teams tm WHERE tm.tournament_id = v_t.id;
  SELECT public_view.epoch_us(max(m.updated_at)) INTO v_matches_us FROM public.matches m WHERE m.tournament_id = v_t.id;
  -- Geloeschte Spiele/Teams (A1): Zeitpunkt der letzten Loeschung aus public_view.structure_changes.
  SELECT public_view.epoch_us(sc.changed_at) INTO v_structure_us
    FROM public_view.structure_changes sc WHERE sc.tournament_id = v_t.id;
  v_max_us := greatest(coalesce(v_tournament_us, 0), coalesce(v_teams_us, 0), coalesce(v_matches_us, 0),
                       coalesce(v_structure_us, 0), 0);
  v_version := greatest(least(v_max_us, v_now_us - c_lag_us), 0);

  IF p_since_version IS NULL OR p_since_version < 0 OR p_since_version > v_version THEN
    v_full := true;
  ELSIF v_max_us <= p_since_version THEN
    RETURN jsonb_build_object('state', 'unchanged', 'version', p_since_version, 'server_now', v_server_now);
  ELSE
    v_full := coalesce(v_tournament_us, 0) > p_since_version OR coalesce(v_teams_us, 0) > p_since_version
              OR coalesce(v_structure_us, 0) > p_since_version;
  END IF;

  v_sw := public_view.switches(v_t.config);
  v_kids := (v_sw ->> 'kidsMode')::boolean;
  v_rankings := NOT v_kids AND (v_sw ->> 'tables')::boolean;
  v_live := NOT v_kids AND (v_sw ->> 'liveScore')::boolean;
  v_events := NOT v_kids AND (v_sw ->> 'events')::boolean;
  v_scorers := NOT v_kids AND (v_sw ->> 'scorers')::boolean;
  -- Schiedsrichter am Bildschirm (@W3-032, Regel 12): config.monitorReferees 'number' (Vorgabe) | 'name' | 'none'.
  v_referees := CASE WHEN NOT v_screen THEN 'none'
                     WHEN v_t.config ->> 'monitorReferees' IN ('name', 'none') THEN v_t.config ->> 'monitorReferees'
                     ELSE 'number' END;

  -- Spiele (alle oder nur die seither geaenderten).
  SELECT coalesce(jsonb_agg(row_json ORDER BY sort_number NULLS LAST, sort_id), '[]'::jsonb) INTO v_matches
    FROM (
      SELECT m.match_number AS sort_number, m.id AS sort_id,
             public_view.without_nulls(jsonb_build_object(
               'id', m.id, 'match_number', m.match_number, 'round', m.round, 'field', m.field, 'slot', m.slot,
               'phase', m.phase, 'group_letter', m.group_letter,
               'slot_a_source', public_view.side_source(m.slot_a_source, m.team_a_id IS NOT NULL, v_rankings),
               'slot_b_source', public_view.side_source(m.slot_b_source, m.team_b_id IS NOT NULL, v_rankings),
               'origin_a', public_view.side_source(jm.j -> 'origin_a', true, v_rankings),
               'origin_b', public_view.side_source(jm.j -> 'origin_b', true, v_rankings),
               'is_final', m.is_final, 'final_type', m.final_type, 'label', m.label,
               'scheduled_start', m.scheduled_start, 'original_start', m.original_start,
               'match_status', m.match_status,
               'live_state', public_view.live_state_for(m.live_state, v_kids), 'timer_start_time', m.timer_start_time,
               'timer_paused_at', m.timer_paused_at, 'timer_elapsed_seconds', m.timer_elapsed_seconds,
               'actual_start', m.actual_start, 'actual_end', m.actual_end, 'skipped_at', m.skipped_at,
               'kit_color_a', jm.j -> 'kit_color_a', 'kit_color_b', jm.j -> 'kit_color_b', 'bib_side', jm.j -> 'bib_side',
               'score_a', CASE WHEN vis.scores THEN m.score_a END,
               'score_b', CASE WHEN vis.scores THEN m.score_b END,
               'overtime_score_a', CASE WHEN vis.scores THEN m.overtime_score_a END,
               'overtime_score_b', CASE WHEN vis.scores THEN m.overtime_score_b END,
               'penalty_score_a', CASE WHEN vis.scores THEN m.penalty_score_a END,
               'penalty_score_b', CASE WHEN vis.scores THEN m.penalty_score_b END,
               'decided_by', CASE WHEN NOT v_kids THEN m.decided_by END,
               'forfeit_absent', CASE WHEN NOT v_kids THEN jm.j -> 'forfeit_absent' END,
               'referee_number', CASE WHEN v_referees <> 'none' THEN m.referee_number END))
             -- Seiten immer mit Schluessel (der Client unterscheidet "kein Team" = null von "fehlt").
             || jsonb_build_object('team_a_id', m.team_a_id, 'team_b_id', m.team_b_id)
             || CASE WHEN ev.list = '[]'::jsonb THEN '{}'::jsonb ELSE jsonb_build_object('events', ev.list) END
             AS row_json
        FROM public.matches m
        -- Spalten spaeterer Pakete (origin_x A-36a, kit_* A-30a, forfeit_absent A-25) ueber die Zeile als JSON: fehlt eine
        -- Spalte, fehlt nur ihr Schluessel (keine Abhaengigkeit von der Einspiel-Reihenfolge).
        CROSS JOIN LATERAL (SELECT to_jsonb(m) AS j) AS jm
        CROSS JOIN LATERAL (
          SELECT NOT v_kids AND (m.match_status IS NULL OR m.match_status NOT IN ('running', 'paused') OR v_live)
                 AS scores) AS vis
        CROSS JOIN LATERAL (
          SELECT CASE WHEN v_kids OR NOT (v_events OR vis.scores) THEN '[]'::jsonb
                      ELSE public_view.match_events(m.id, vis.scores AND v_events, v_events, vis.scores, v_events)
                 END AS list) AS ev
       WHERE m.tournament_id = v_t.id
         AND (v_full OR public_view.epoch_us(m.updated_at) > p_since_version)
    ) AS r;

  -- Voll-Antwort: die eigene Version (auch wenn since voraus war, N5); Delta: nie kleiner als since.
  v_result := jsonb_build_object('version', CASE WHEN v_full THEN v_version ELSE greatest(v_version, p_since_version) END,
                                 'server_now', v_server_now);

  -- Torschuetzen-Zwischenstand (@ZM-099, @ZM-102): nur mit Schalter, aus Toren mit Nummer in Spielen, deren Stand
  -- oeffentlich ist; Eigentore zaehlen fuer keinen Schuetzen.
  IF v_scorers THEN
    v_result := v_result || jsonb_build_object('scorers', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('team_id', g.team_id, 'number', g.number, 'goals', g.goals)
                                ORDER BY g.goals DESC, g.team_id, g.number), '[]'::jsonb)
        FROM (
          SELECT (e ->> 'team_id')::uuid AS team_id, (e -> 'number') AS number, count(*) AS goals
            FROM public.matches m
            CROSS JOIN LATERAL jsonb_array_elements(public_view.match_events(m.id, true, false, false, true)) AS x(e)
           WHERE m.tournament_id = v_t.id
             AND (m.match_status IS NULL OR m.match_status NOT IN ('running', 'paused') OR v_live)
             AND e ->> 'type' = 'GOAL' AND e ? 'number'
           GROUP BY 1, 2) AS g));
  END IF;

  IF NOT v_full THEN
    RETURN v_result || jsonb_build_object('state', 'delta', 'base_version', p_since_version,
                                          'tournament_date', v_t.date, 'matches', v_matches);
  END IF;

  v_tournament := public_view.without_nulls(jsonb_build_object(
      'id', v_t.id, 'title', v_t.title, 'date', v_t.date, 'start_time', v_t.start_time, 'sport', v_t.sport,
      'tournament_type', v_t.tournament_type, 'status', v_t.status,
      'location_name', v_t.location_name, 'location_street', v_t.location_street,
      'location_city', v_t.location_city, 'location_postal_code', v_t.location_postal_code,
      'location_country', v_t.location_country,
      'number_of_fields', v_t.number_of_fields, 'number_of_teams', v_t.number_of_teams,
      'number_of_groups', v_t.number_of_groups, 'group_phase_duration', v_t.group_phase_duration,
      'group_phase_break', v_t.group_phase_break, 'final_round_duration', v_t.final_round_duration,
      'final_round_break', v_t.final_round_break, 'point_system', v_t.point_system,
      'finals_config', v_t.finals_config,
      'referee_config', CASE WHEN v_referees = 'name' THEN v_t.referee_config
                             WHEN v_referees = 'number' AND jsonb_typeof(v_t.referee_config) = 'object'
                               THEN v_t.referee_config - 'refereeNames' END,
      'is_public', coalesce(v_t.is_public, false),
      'share_code', CASE WHEN coalesce(v_t.is_public, false) THEN v_t.share_code END,
      'completed_at', v_t.completed_at,
      'lifecycle_status', to_jsonb(v_t) -> 'lifecycle_status',
      'finished_at', to_jsonb(v_t) -> 'finished_at',
      'config', public_view.config_for(v_t.config, p_audience, p_monitor_id, v_rankings)));

  SELECT coalesce(jsonb_agg(public_view.without_nulls(jsonb_build_object(
           'id', tm.id, 'name', tm.name, 'group_letter', tm.group_letter, 'is_removed', tm.is_removed,
           'logo_path', tm.logo_path, 'logo_background_color', tm.logo_background_color,
           'color_primary', tm.color_primary, 'color_secondary', tm.color_secondary))
           ORDER BY tm.sort_order NULLS LAST, tm.name, tm.id), '[]'::jsonb)
    INTO v_teams
    FROM public.teams tm
   WHERE tm.tournament_id = v_t.id;

  RETURN v_result || jsonb_build_object('state', 'full', 'tournament', v_tournament, 'teams', v_teams,
                                        'matches', v_matches);
END;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public_view FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.public_gathering(text);
DROP FUNCTION IF EXISTS public.set_gathering_tournaments(uuid, uuid[], uuid[]);
DROP FUNCTION IF EXISTS public.delete_gathering(uuid);
DROP FUNCTION IF EXISTS public.rename_gathering(uuid, text);
DROP FUNCTION IF EXISTS public.create_gathering(text);
DROP FUNCTION IF EXISTS public.gathering_name_or_fail(text);
DROP TRIGGER IF EXISTS tournaments_touch_gathering_trash ON public.tournaments;
DROP TRIGGER IF EXISTS tournaments_touch_gathering_delete ON public.tournaments;
DROP TRIGGER IF EXISTS tournaments_protect_gathering_id ON public.tournaments;
DROP FUNCTION IF EXISTS public.tournaments_touch_gathering();
DROP FUNCTION IF EXISTS public.tournaments_protect_gathering_id();
DROP INDEX IF EXISTS public.tournaments_gathering_id_idx;
ALTER TABLE public.tournaments DROP COLUMN IF EXISTS gathering_id;
DROP TABLE IF EXISTS public.gathering_members;
DROP FUNCTION IF EXISTS public.gathering_members_guard();
DROP POLICY IF EXISTS gatherings_select ON public.gatherings;
DROP TABLE IF EXISTS public.gatherings;
DROP FUNCTION IF EXISTS public.has_gathering_permission(uuid, text);
COMMIT;
