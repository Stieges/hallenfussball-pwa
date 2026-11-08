-- supabase/migrations/20261124_001_zeitstrafe_endet_bei_gegentor.sql
-- Befund C-ZEITSTRAFE-GEGENTOR-FEHLT: Ein Gegentor beendete eine laufende Zeitstrafe nicht. Das Ende wird jetzt aus den
-- Ereignissen abgeleitet (Cockpit, Neuladen, andere Geraete, Monitor, Zuschauer-Seite rechnen mit demselben Kern). Ob die
-- Regel "endet bei Gegentor" galt, steht im Eintrag der Strafe (payload.endsOnGoal, vom Cockpit beim Erfassen geschrieben);
-- Monitor und Zuschauer-Seite sehen nur die Positivliste der oeffentlichen Ereignisse und brauchen das Feld dort.
-- Szenarien: @W2A-013, @W2A-014, @W2A-015, @W2A-018 (Regelinhalte); @SL-030, @SL-044, @SL-092, @SL-094, @SL-095, @SL-200
--   (Spiel leiten); @ZM-192 Zeile "Tor beendet die Strafe", @ZM-180 (Zuschauer und Monitor).
--
-- Inhalt: NUR CREATE OR REPLACE FUNCTION public_view.match_events(uuid, boolean, boolean, boolean, boolean). Der Text steht
--   woertlich wie in 20261117_104_public_payload.sql (letzte Fassung; keine spaetere Migration ersetzt die Funktion), neu
--   ist genau ein Feld der Positivliste: `ends_on_goal` (nur bei TIME_PENALTY, nur wenn payload.endsOnGoal ein JSON-
--   Wahrheitswert ist; sonst fehlt der Schluessel, und die Anzeige nimmt die Vorgabe "an"). Signatur, SECURITY, search_path
--   und Rechte (public_view ohne USAGE fuer Client-Rollen) unveraendert; keine Tabelle, keine Policy, kein Trigger.
-- Datenschutz: ein Wahrheitswert zur Turnier-Regel, nichts ueber Personen. Die Engine speichert die payload unveraendert
--   (append_match_events prueft bei TIME_PENALTY nur playerNumber und durationSeconds), die Regel steht also schon im Eintrag.
-- Bestandsdaten: keine Aenderung. Strafen ohne Angabe (alle bisherigen) gelten als "Regel an" (Vorgabe).
-- Reihenfolge: unabhaengig vom App-Stand. Ein aelterer Client ignoriert das neue Feld (Zod ohne passthrough); ein neuerer
--   Client ohne die Migration nimmt "an" fuer jede Strafe (dann endet bei ausgeschalteter Regel die Anzeige zu frueh).
--   Deshalb: erst einspielen, dann mergen.
-- Rueckweg: supabase/rollbacks/20261124_001_zeitstrafe_endet_bei_gegentor_rollback.sql (Fassung aus 20261117_104).
-- Beweis: scripts/public-payload-check.sh (Kategorie P "Zeitstrafe endet bei Gegentor", Gegenprobe G18).
-- Idempotent: CREATE OR REPLACE.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regprocedure('public_view.match_events(uuid,boolean,boolean,boolean,boolean)') IS NULL THEN
    RAISE EXCEPTION '20261124_001_zeitstrafe_endet_bei_gegentor: public_view.match_events fehlt -- zuerst 20261117_104 einspielen';
  END IF;
END
$$;

-- Ereignisse eines Spiels nach Positivliste: angenommen (gespeichert), nicht zur Klaerung, nicht zurueckgenommen;
-- Rueckennummer nach dem letzten AMEND. Form: {id, type, team_id, section, clock_ms[, number][, duration_seconds]
-- [, ends_on_goal][, scored]} -- nie actor, Konto, Geraet, Grund oder Freitext.
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
           'ends_on_goal', CASE WHEN s.type = 'TIME_PENALTY' AND jsonb_typeof(s.payload -> 'endsOnGoal') = 'boolean'
                                THEN s.payload -> 'endsOnGoal' END,
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
