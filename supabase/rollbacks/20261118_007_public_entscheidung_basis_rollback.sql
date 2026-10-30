-- supabase/rollbacks/20261118_007_public_entscheidung_basis_rollback.sql
-- RUECKWEG zu supabase/migrations/20261118_007_public_entscheidung_basis.sql: public_view.config_for woertlich wie in
-- 20261117_104_public_payload.sql (basis wieder immer ""). Liegt bewusst NICHT in supabase/migrations.
-- Folge: Zuschauer-Seite und Monitor zeigen nach einer Gleichstands-Entscheidung wieder „Strafstoss folgt“ bzw.
-- „wird entschieden“ (Befund C-PUBLIC-ENTSCHEIDUNG-BASIS-LEER). Keine Daten betroffen; App-Stand egal.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- config nach Positivliste. Zielgruppe 'viewer' (Zuschauer-Link) oder 'screen' (Bildschirm eines Monitors).
CREATE OR REPLACE FUNCTION public_view.config_for(p_config jsonb, p_audience text, p_monitor_id text,
                                                  p_rankings_visible boolean)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  c_config_keys constant text[] := ARRAY[
    'sportId', 'tournamentType', 'tournamentSystem', 'mode', 'groupSystem', 'breakBetweenPhases', 'gamePeriods',
    'halftimeBreak', 'gameDuration', 'breakDuration', 'roundLogic', 'numberOfRounds', 'placementLogic',
    'fieldAssignments', 'groups', 'fields', 'finals', 'playoffConfig', 'minRestSlots', 'isKidsTournament',
    'hideScoresForPublic', 'hideRankingsForPublic', 'publicLiveScore', 'publicEvents', 'publicScorers', 'resultMode',
    'ageClass', 'organizer', 'bibColor', 'spectatorDisplay', 'hostTeamIds', 'openingMode', 'placementsToPlayOut',
    'forfeitScore', 'monitorReferees'];
  v_config jsonb := CASE WHEN jsonb_typeof(p_config) = 'object' THEN p_config ELSE '{}'::jsonb END;
  v_out jsonb;
  v_contact jsonb := v_config -> 'contactInfo';
  v_monitor jsonb;
  v_sponsor_ids text[];
BEGIN
  SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) INTO v_out
    FROM jsonb_each(v_config) AS e
   WHERE e.key = ANY (c_config_keys) AND e.value <> 'null'::jsonb;

  -- Gleichstands-Entscheidungen: nur wenn Tabellen oeffentlich sind; ohne Begruendung und ohne Altfelder (Person,
  -- Zeit, Grund). basis bleibt als leerer Text (Pflichtfeld des Client-Schemas).
  IF p_rankings_visible AND jsonb_typeof(v_config -> 'standingDecisions') = 'array' THEN
    v_out := v_out || jsonb_build_object('standingDecisions', (
      SELECT coalesce(jsonb_agg(public_view.without_nulls(jsonb_build_object(
               'id', d -> 'id', 'groupId', d -> 'groupId', 'teamIds', d -> 'teamIds', 'order', d -> 'order',
               'kind', d -> 'kind', 'shootout', d -> 'shootout', 'basis', '""'::jsonb)) ORDER BY ord), '[]'::jsonb)
        FROM jsonb_array_elements(v_config -> 'standingDecisions') WITH ORDINALITY AS x(d, ord)
       WHERE jsonb_typeof(d) = 'object'));
  END IF;

  IF p_audience = 'viewer' THEN
    -- Kontaktperson des Veranstalters nur mit Haekchen (@ZM-097, @W1-030..032); nur diese vier Felder.
    IF jsonb_typeof(v_contact) = 'object' AND v_contact -> 'showPublic' = 'true'::jsonb THEN
      v_out := v_out || jsonb_build_object('contactInfo', public_view.without_nulls(jsonb_build_object(
        'name', v_contact -> 'name', 'email', v_contact -> 'email', 'phone', v_contact -> 'phone',
        'website', v_contact -> 'website', 'showPublic', true)));
    END IF;
  ELSIF p_audience = 'screen' THEN
    -- Nur der eigene Monitor und nur die Sponsoren seiner Folien (E-A2, @ME-018).
    SELECT m INTO v_monitor
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_config -> 'monitors') = 'array'
                                     THEN v_config -> 'monitors' ELSE '[]'::jsonb END) AS x(m)
     WHERE m ->> 'id' = p_monitor_id
     LIMIT 1;
    IF v_monitor IS NOT NULL THEN
      v_out := v_out || jsonb_build_object('monitors', jsonb_build_array(v_monitor));
      SELECT coalesce(array_agg(DISTINCT s -> 'config' ->> 'sponsorId'), ARRAY[]::text[]) INTO v_sponsor_ids
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_monitor -> 'slides') = 'array'
                                       THEN v_monitor -> 'slides' ELSE '[]'::jsonb END) AS y(s)
       WHERE s -> 'config' ->> 'sponsorId' IS NOT NULL;
      v_out := v_out || jsonb_build_object('sponsors', (
        SELECT coalesce(jsonb_agg(public_view.without_nulls(jsonb_build_object(
                 'id', sp -> 'id', 'name', sp -> 'name', 'logoUrl', sp -> 'logoUrl', 'logoBase64', sp -> 'logoBase64',
                 'websiteUrl', sp -> 'websiteUrl', 'tier', sp -> 'tier')) ORDER BY ord), '[]'::jsonb)
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_config -> 'sponsors') = 'array'
                                         THEN v_config -> 'sponsors' ELSE '[]'::jsonb END) WITH ORDINALITY AS z(sp, ord)
         WHERE sp ->> 'id' = ANY (v_sponsor_ids)));
    END IF;
  ELSE
    RAISE EXCEPTION 'public_view.config_for: unbekannte Zielgruppe %', p_audience USING ERRCODE = '22023';
  END IF;
  RETURN v_out;
END;
$$;

COMMIT;
