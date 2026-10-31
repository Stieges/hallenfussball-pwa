-- supabase/rollbacks/20261118_008_monitor_endstand_rollback.sql
-- RUECKWEG zu supabase/migrations/20261118_008_monitor_endstand.sql. Liegt bewusst NICHT in supabase/migrations (wird nie
-- nachgespielt). Erzeugt mit `bash scripts/monitor-endstand-check.sh --print-rueckweg`; belegt in
-- scripts/monitor-endstand-check.sh (Kategorie X: Schema danach = Stand vor der Migration).
-- Reihenfolge: ZUERST die App auf den Stand ohne diesen Client-Teil (sie ruft dann wieder display_final_standings(uuid)),
-- DANN dieser Block. Danach zeigt ein Monitor ohne Online-Teilen nach dem Abschluss keinen Endstand, und nach dem
-- Wiederoeffnen fallen Monitor und Zuschauer-Seite in die laufende Ansicht zurueck, und die Uhr-Art kommt dort nicht mehr an
-- (Befunde C-MONITOR-ENDSTAND-OHNE-TEILEN, C-MONITOR-ENDSTAND-WIEDEROEFFNEN, C-MONITOR-UHRART-FEHLT, @LZ-077 Z. 2 wieder offen).
-- Keine Daten gehen verloren.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF to_regprocedure('public.display_final_standings(uuid,text)') IS NULL
     OR position('20261118_008' IN coalesce(obj_description(to_regprocedure('public.display_final_standings(uuid,text)'), 'pg_proc'), '')) = 0
     OR position('20261118_008 (B)' IN coalesce((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.public_final_standings(text)')), '')) = 0
     OR position('20261118_008 (U)' IN coalesce((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public_view.config_for(jsonb,text,text,boolean)')), '')) = 0 THEN
    RAISE EXCEPTION 'Rueckweg 20261118_008: Monitor-Endstand nicht in der Fassung 20261118_008 -- nichts geaendert';
  END IF;
END
$rw$;
-- public_view.config_for woertlich aus 20261118_007_public_entscheidung_basis.sql
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
  -- Zeit, Grund). basis ist seit TB v2 der Fingerabdruck der Grundlage (src/core/standings/decisions.ts decisionBasis:
  -- Punkteschema, Kriterien, [Spielkennung, Stand, Status, Nichtantritt] der Spiele des Blocks) -- ohne ihn uebernimmt
  -- die Anzeige die Entscheidung nie (@W2A-059 Z. 3). Durchgereicht wird er nur in genau dieser Form (JSON-Objekt mit
  -- points, criteria, matches[, forfeit]); jeder andere Text (Altwert, frueher Begruendung) wird zu "".
  IF p_rankings_visible AND jsonb_typeof(v_config -> 'standingDecisions') = 'array' THEN
    v_out := v_out || jsonb_build_object('standingDecisions', (
      SELECT coalesce(jsonb_agg(public_view.without_nulls(jsonb_build_object(
               'id', d -> 'id', 'groupId', d -> 'groupId', 'teamIds', d -> 'teamIds', 'order', d -> 'order',
               'kind', d -> 'kind', 'shootout', d -> 'shootout',
               'basis', CASE WHEN jsonb_typeof(d -> 'basis') = 'string' AND pg_input_is_valid(d ->> 'basis', 'jsonb') THEN
                          CASE WHEN jsonb_typeof((d ->> 'basis')::jsonb) = 'object'
                                    AND ((d ->> 'basis')::jsonb ?& ARRAY['points', 'criteria', 'matches'])
                                    AND ((d ->> 'basis')::jsonb - ARRAY['points', 'criteria', 'matches', 'forfeit']) = '{}'::jsonb
                               THEN d -> 'basis' ELSE '""'::jsonb END
                        ELSE '""'::jsonb END)) ORDER BY ord), '[]'::jsonb)
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
-- public_final_standings woertlich aus 20261113_003_tournament_lifecycle.sql
CREATE OR REPLACE FUNCTION public.public_final_standings(p_share_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments;
BEGIN
  IF p_share_code IS NULL OR char_length(p_share_code) > 20 THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  SELECT * INTO v_t FROM public.tournaments t
   WHERE t.share_code = p_share_code AND coalesce(t.is_public, false) AND t.deleted_at IS NULL;
  RETURN match_engine.final_standings_payload(v_t);
END;
$$;
REVOKE ALL ON FUNCTION public.public_final_standings(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_final_standings(text) TO anon, authenticated;
DROP FUNCTION public.display_final_standings(uuid, text);
COMMIT;
-- Danach: Assertion monitor-endstand-display-link + PRIVILEGE_ASSERTION_NAMES + pending_assertions_for zurueck, Drift-Check.
