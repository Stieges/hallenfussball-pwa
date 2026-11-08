-- supabase/rollbacks/20261124_001_zeitstrafe_endet_bei_gegentor_rollback.sql
-- RUECKWEG zu supabase/migrations/20261124_001_zeitstrafe_endet_bei_gegentor.sql: public_view.match_events woertlich wie in
-- 20261117_104_public_payload.sql (ohne `ends_on_goal`). Liegt bewusst NICHT in supabase/migrations.
-- Folge: Monitor und Zuschauer-Seite kennen die Regel "endet bei Gegentor" der Strafe nicht mehr und nehmen die Vorgabe "an"
-- (Befund C-ZEITSTRAFE-GEGENTOR-FEHLT). Keine Daten betroffen; App-Stand egal.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- Ereignisse eines Spiels nach Positivliste: angenommen (gespeichert), nicht zur Klaerung, nicht zurueckgenommen;
-- Rueckennummer nach dem letzten AMEND. Form: {id, type, team_id, section, clock_ms[, number][, duration_seconds]
-- [, scored]} -- nie actor, Konto, Geraet, Grund oder Freitext.
CREATE OR REPLACE FUNCTION public_view.match_events(p_match_id uuid, p_goals boolean, p_cards boolean,
                                                    p_kicks boolean, p_numbers boolean)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  WITH ev AS (
    SELECT e.id, e.seq, e.type, e.team_id, e.section, e.clock_ms, e.payload, e.target_event_id
      FROM public.match_events e
     WHERE e.match_id = p_match_id
       AND e.event_format IS NOT NULL
       AND e.review_state IS NULL
  ), shown AS (
    SELECT ev.*,
           CASE WHEN ev.type = 'SHOOTOUT_KICK' THEN 'shooterNumber' ELSE 'playerNumber' END AS number_field
      FROM ev
     WHERE NOT EXISTS (SELECT 1 FROM ev r WHERE r.type = 'RETRACT' AND r.target_event_id = ev.id)
       AND ((p_goals AND ev.type IN ('GOAL', 'OWN_GOAL'))
            OR (p_cards AND ev.type IN ('YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD', 'TIME_PENALTY'))
            OR (p_kicks AND ev.type = 'SHOOTOUT_KICK'))
  )
  SELECT coalesce(jsonb_agg(public_view.without_nulls(jsonb_build_object(
           'id', s.id,
           'type', s.type,
           'team_id', s.team_id,
           'section', s.section,
           'clock_ms', s.clock_ms,
           'number', CASE WHEN p_numbers THEN
                       CASE WHEN amend.found THEN amend.value ELSE s.payload -> s.number_field END END,
           'duration_seconds', CASE WHEN s.type = 'TIME_PENALTY' THEN s.payload -> 'durationSeconds' END,
           'scored', CASE WHEN s.type = 'SHOOTOUT_KICK' THEN s.payload -> 'scored' END)) ORDER BY s.seq), '[]'::jsonb)
    FROM shown s
    LEFT JOIN LATERAL (
      SELECT true AS found,
             CASE WHEN coalesce(a.payload -> 'clear', '[]'::jsonb) ? s.number_field THEN NULL
                  ELSE a.payload -> s.number_field END AS value
        FROM ev a
       WHERE a.type = 'AMEND' AND a.target_event_id = s.id
         AND (a.payload ? s.number_field OR coalesce(a.payload -> 'clear', '[]'::jsonb) ? s.number_field)
       ORDER BY a.seq DESC
       LIMIT 1
    ) AS amend ON true;
$$;

COMMIT;
