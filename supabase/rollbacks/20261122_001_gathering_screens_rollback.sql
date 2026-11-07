-- supabase/rollbacks/20261122_001_gathering_screens_rollback.sql
-- RUECKWEG zu supabase/migrations/20261122_001_gathering_screens.sql (A1b Monitore der Veranstaltung). Liegt bewusst NICHT
-- in supabase/migrations (wird nie nachgespielt); belegt in scripts/gathering-screens-check.sh (Kategorie X: Schema danach =
-- Stand vor der Migration). EIN Block.
-- Reihenfolge: ZUERST die App auf den Stand ohne A7-Client (Bildschirme der Veranstaltung, "Auf die Bildschirme"), DANN dieser
-- Block. Bildschirme der Veranstaltung und das Turnier in der Halle gehen verloren (vorher sichern:
-- COPY public.gathering_screens TO ..., COPY (SELECT id, on_screen_tournament_id, on_screen_since, screen_location_name
-- FROM public.gatherings) TO ...). Veranstaltungen, Zuordnungen und Turniere bleiben; public_gathering verliert on_screen.
-- Rein ASCII, kein Unicode-Escape mit Backslash.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF to_regclass('public.gathering_screens') IS NULL
     OR md5(coalesce((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.public_gathering(text)')), ''))
        <> '6a9e35279f99c527341c85fce26af03a' THEN
    RAISE EXCEPTION 'Rueckweg 20261122_001: Bildschirme der Veranstaltung nicht in der Fassung 20261122_001 -- nichts geaendert';
  END IF;
END
$rw$;

-- public_gathering woertlich aus 20261119_001_gatherings.sql
CREATE OR REPLACE FUNCTION public.public_gathering(p_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_lag_us constant bigint := 5000000;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_now_us bigint := floor(extract(epoch FROM now()) * 1000000)::bigint;
  v_server_now bigint := floor(extract(epoch FROM now()) * 1000)::bigint;
  v_g public.gatherings;
  v_list jsonb;
  v_assigned integer;
  v_upcoming boolean;
  v_max timestamptz;
  v_version bigint;
BEGIN
  IF v_code !~ '^[A-Z0-9]{6}$' THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;
  SELECT * INTO v_g FROM public.gatherings g WHERE g.share_code = v_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;

  WITH ts AS (
    SELECT t.id, t.title, t.date, t.start_time, t.location_name, t.is_public, t.share_code, t.lifecycle_status,
           t.updated_at,
           ms.started, ms.first_start, ms.max_actual, ms.max_updated, sc.changed_at,
           coalesce((SELECT bool_and(m.match_status IN ('running', 'paused', 'finished') OR m.skipped_at IS NOT NULL)
                       FROM public.matches m
                      WHERE m.tournament_id = t.id
                        AND m.scheduled_start = (SELECT max(m2.scheduled_start) FROM public.matches m2
                                                  WHERE m2.tournament_id = t.id)), false) AS last_started
      FROM public.tournaments t
      LEFT JOIN LATERAL (
        SELECT coalesce(bool_or(m.match_status IN ('running', 'paused', 'finished')), false) AS started,
               min(m.scheduled_start) AS first_start, max(m.actual_start) AS max_actual, max(m.updated_at) AS max_updated
          FROM public.matches m WHERE m.tournament_id = t.id) AS ms ON true
      LEFT JOIN public_view.structure_changes sc ON sc.tournament_id = t.id
     WHERE t.gathering_id = v_g.id AND t.deleted_at IS NULL
  ), st AS (
    SELECT ts.*,
           CASE WHEN ts.lifecycle_status = 'cancelled' THEN 'cancelled'
                WHEN ts.lifecycle_status = 'finished' THEN 'finished'
                WHEN ts.started AND v_today >= ts.date + 2 THEN 'finished'   -- gekappt (wie @HE-111)
                WHEN ts.started THEN 'live'
                ELSE 'planned' END AS state
      FROM ts
  )
  SELECT (SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                    'title', s.title, 'date', s.date, 'begin', coalesce(s.first_start, s.start_time),
                    'location_name', s.location_name, 'state', s.state, 'last_match_started', s.last_started,
                    'share_code', s.share_code))
                  ORDER BY s.date, coalesce(s.first_start, s.start_time) NULLS LAST, s.title, s.id), '[]'::jsonb)
            FROM st s WHERE coalesce(s.is_public, false)),
         (SELECT count(*) FROM st),
         (SELECT coalesce(bool_or(s.state = 'planned' AND s.date >= v_today), false) FROM st s),
         (SELECT max(x) FROM st s
            CROSS JOIN LATERAL (VALUES (s.updated_at), (s.max_actual), (s.max_updated), (s.changed_at)) AS v(x))
    INTO v_list, v_assigned, v_upcoming, v_max;

  v_max := greatest(v_g.updated_at, v_max);
  v_version := greatest(least(floor(extract(epoch FROM v_max) * 1000000)::bigint, v_now_us - c_lag_us), 0);

  IF jsonb_array_length(v_list) > 0 THEN
    RETURN jsonb_build_object('state', 'full', 'version', v_version, 'server_now', v_server_now, 'name', v_g.name,
                              'tournaments', v_list);
  END IF;
  IF v_assigned = 0 OR v_upcoming THEN
    RETURN jsonb_build_object('state', 'pending', 'version', v_version, 'server_now', v_server_now, 'name', v_g.name);
  END IF;
  RETURN jsonb_build_object('state', 'not_found');
END;
$$;
COMMENT ON FUNCTION public.public_gathering(text) IS
  '20261119_001 (A1): oeffentliche Seite der Veranstaltung. {state:not_found} | {state:pending, version, server_now, name} | {state:full, version, server_now, name, tournaments:[title, date, begin, location_name, state, last_match_started, share_code]}; nur oeffentliche, nicht geloeschte Turniere, keine Teams, Spielstaende, Kontakte oder Anzahlen. Immer Voll-Antwort; version monoton.';

DROP TRIGGER IF EXISTS tournaments_clear_on_screen ON public.tournaments;
DROP TRIGGER IF EXISTS tournaments_clear_on_screen_delete ON public.tournaments;
DROP FUNCTION public.gathering_public_on_screen(uuid);
DROP FUNCTION public.gathering_screen_final_standings(text);
DROP FUNCTION public.gathering_screen_display(text, bigint);
DROP FUNCTION public.gathering_screens_overview(uuid);
DROP FUNCTION public.gathering_screen_status(uuid);
DROP FUNCTION public.set_gathering_on_screen(uuid, boolean);
DROP FUNCTION public.gathering_screen_tournament_or_fail(uuid);
DROP FUNCTION public.gathering_on_screen_for_caller(uuid);
DROP FUNCTION public.set_gathering_screen_location(uuid, text);
DROP FUNCTION public.adopt_tournament_monitor(uuid, uuid, text);
DROP FUNCTION public.delete_gathering_screen(uuid);
DROP FUNCTION public.rotate_gathering_screen_key(uuid);
DROP FUNCTION public.update_gathering_screen(uuid, text, jsonb, jsonb);
DROP FUNCTION public.create_gathering_screen(uuid, text, jsonb, jsonb);
DROP FUNCTION public.gathering_screen_new_key();
DROP FUNCTION public.gathering_lock_for_screens(uuid);
DROP FUNCTION public.gathering_clear_ineligible_on_screen(uuid);
DROP FUNCTION public.tournaments_clear_on_screen();
DROP FUNCTION public.gathering_screen_config_check(jsonb, jsonb);
DROP FUNCTION public.gathering_tournament_list(uuid);
DROP FUNCTION public.gathering_screen_reason(uuid, uuid);
DROP FUNCTION public.gathering_location_key(text);
DROP TABLE public.gathering_screens;
ALTER TABLE public.gatherings
  DROP COLUMN on_screen_tournament_id,
  DROP COLUMN on_screen_since,
  DROP COLUMN screen_location_name;

COMMIT;
