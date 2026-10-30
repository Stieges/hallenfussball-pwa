-- supabase/migrations/20261118_007_public_entscheidung_basis.sql
-- Befund C-PUBLIC-ENTSCHEIDUNG-BASIS-LEER (kritisch, MVP): Nach einem Strafstossschiessen (oder einer anderen Entscheidung
-- eines Gleichstands) zeigten Zuschauer-Seite und Hallen-Monitor weiter beide Teams auf demselben Platz mit „Strafstoss
-- folgt“. Ursache: public_view.config_for (20261117_104, Zeile 256) gab standingDecisions[].basis immer als "" aus (alter
-- Gedanke: basis = Begruendung). Seit TB v2 ist basis der Fingerabdruck der Grundlage; die Anzeige uebernimmt eine
-- Entscheidung nur bei gleichem Fingerabdruck (src/core/standings/decisions.ts findValidDecision).
-- Szenarien: @W2A-059 Z. 3 (Markierung verschwindet, sobald der Platz entschieden ist -- Zuschauer und Monitor), @ET-026,
--   @ET-055 (Strafstossschiessen entscheidet; Sieger in Tabelle und Endstand vorn), @ET-044 (dieselben Plaetze),
--   @ZM-180 (Uebertragungsweg verliert keinen Abschluss-Zustand). Weiter gilt @W2A-072 (keine Person, Zeit, Grund).
--
-- Inhalt: NUR CREATE OR REPLACE FUNCTION public_view.config_for(jsonb, text, text, boolean). Der Text steht woertlich wie
--   in 20261117_104_public_payload.sql (letzte Fassung; keine spaetere Migration ersetzt die Funktion), geaendert sind nur
--   der Kommentar und der Wert 'basis': der gespeicherte Fingerabdruck, wenn er die Form von decisionBasis hat (JSON-Objekt
--   genau mit points, criteria, matches[, forfeit]), sonst "". Weiter nur, wenn Tabellen oeffentlich sind (nicht im
--   Kindermodus, nicht bei ausgeblendeten Tabellen); decidedBy, decidedAt, reason und andere Altfelder fehlen weiter.
--   Signatur, Rechte (public_view ohne USAGE fuer Client-Rollen), SECURITY und search_path unveraendert; keine Tabelle,
--   keine Policy, kein Trigger.
-- Datenschutz: der Fingerabdruck enthaelt Punkteschema, aktive Kriterien sowie Kennung, Stand, Status und fehlende Seite
--   (A/B) der Spiele des Blocks -- dieselben Werte, die die Antwort fuer beendete Spiele ohnehin zeigt; nichts ueber
--   Personen.
-- Bestandsdaten: keine Aenderung. Alt-Entscheidungen mit Begruendungstext in basis bleiben oeffentlich "".
-- Reihenfolge: unabhaengig vom App-Stand (der Client liest basis schon heute); App-Code dieses Pakets aendert nichts am
--   Lesen.
-- Rueckweg: supabase/rollbacks/20261118_007_public_entscheidung_basis_rollback.sql (Fassung aus 20261117_104).
-- Beweis: scripts/public-payload-check.sh (spielt diese Datei nach 20261117_104 ein; Kategorie P „Gleichstands-
--   Entscheidung“, Gegenprobe G14 = Fassung mit leerem basis -> rot).
-- Idempotent: CREATE OR REPLACE.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regprocedure('public_view.config_for(jsonb,text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION '20261118_007_public_entscheidung_basis: public_view.config_for fehlt -- zuerst 20261117_104 einspielen';
  END IF;
END
$$;

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

COMMIT;
