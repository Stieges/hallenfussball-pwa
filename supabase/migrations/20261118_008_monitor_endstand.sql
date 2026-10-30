-- supabase/migrations/20261118_008_monitor_endstand.sql
-- Endstand fuer Monitor und Zuschauer am Server (Review #414 🟡1/🔵2; Entscheidung Daniel 30.10.): zwei Befunde, eine neue
-- Lese-Funktion fuer den Monitor-Link und der Zuschauer-Endstand nach dem Wiederoeffnen.
--   (A) C-MONITOR-ENDSTAND-OHNE-TEILEN (@ZM-121 Z. 1, @LZ-076): display_final_standings(uuid) verlangt is_public oder
--       readDisplay (nur Rolle 'screen', entsteht erst mit der Kopplung B-20). Ein heutiger Monitor ist ein Link
--       /display/:tournamentId/:monitorId ohne Anmeldung; display_tournament (20261117_104) liefert ihm das Turnier ueber
--       tournament_id + monitor_id, auch ohne Online-Teilen (@ZM-066, @ZM-101). Ohne Teilen bekam er daher nach dem
--       Abschluss keinen Endstand. NEU: public.display_final_standings(p_tournament_id uuid, p_monitor_id text) mit
--       DERSELBEN Pruefung wie display_tournament (Turnier nicht geloescht, ein Eintrag in config.monitors mit genau
--       dieser Kennung, Kennung 1-100 Zeichen); sonst {status:'none'} (kein Existenz-Orakel, wie bisher).
--   (B) C-MONITOR-ENDSTAND-WIEDEROEFFNEN (@ZM-121 Z. 2, Muss; Lern-Spur 2026-10-25 DEMOTION): Nach dem Wiederoeffnen ueber
--       den Betreiber (@LZ-091, reopen_tournament: lifecycle_status 'fixed', finished_at NULL) bleibt der beim Abschluss
--       gespeicherte Endstand in tournament_final_standings stehen (20261113_003 § reopen_tournament: „Der gespeicherte
--       Endstand bleibt bis zum naechsten Abschluss stehen“). Die neue Funktion liefert ihn dann UNVERAENDERT weiter --
--       dieselbe Antwort wie vor dem Wiederoeffnen (status 'final', finishedAt = Zeitpunkt des aufgehobenen Abschlusses,
--       derselbe Stand), bis neu abgeschlossen wird (dann ersetzt finish_tournament den Stand, @LZ-091 letzte Zeile).
--       Ohne Hinweis „vorlaeufig“: der ist MVP+ (@LZ-065, Beispiele-Block MVP+ von @ZM-121).
--   (B') Zuschauer-Seite gleich (@LZ-077 Z. 2 seit Lern-Spur 30.10. DEMOTION: „auf Bitte ueber den Betreiber wieder oeffnen
--       laesst (Notweg @LZ-091) -> den bisherigen Endstand unveraendert, bis Olli neu abschliesst“): public_final_standings
--       (Fassung 20261113_003, sonst wortgleich) bekommt denselben Zweig (B). Teilen-Pruefung, Kindermodus und
--       Torschuetzen-Schalter unveraendert.
-- Szenarien: @ZM-121 Z. 1 und Z. 2, @LZ-076, @LZ-077 Z. 2, @LZ-091 (Monitor- und Zuschauer-Sicht), @ZM-166, @ZM-137 (U), @ZM-101 (Monitor zeigt ohne Teilen weiter), @ZM-180
--   (beendet bleibt beendet: das Wiederoeffnen wirft den Monitor nicht aus dem Endstand); weiter gilt @ZM-121 Z. 4 /
--   „Kindermodus ueberstimmt alle Schalter“ und @ZM-012 Z. 2 (Torschuetzen nur mit Schalter).
--   (U) C-MONITOR-UHRART-FEHLT (@ZM-166, @ZM-137; Entscheidung Daniel 30.10. „Ja“ – Erweiterung der Positivliste):
--       public_view.config_for (Fassung 20261118_007, sonst wortgleich) gibt aus matchCockpitSettings genau clockMode
--       (Uhr-Art) und finalPhaseMinutes (Laenge der Schlussphase) heraus, fuer Zuschauer ('viewer', public_tournament) und
--       Monitor ('screen', display_tournament) gleich. Sonst blieb die Uhr dort immer bei der Vorgabe („durchlaufend, letzte
--       Minute angehalten“, 1 Minute): violetter Balken auch bei „immer durchlaufend/angehalten“, Schlussphase nie laenger.
--       Alle anderen Cockpit-Einstellungen (Ton, Bedienung, Regeln) bleiben draussen.
-- Nicht Teil: @ZM-121 Z. 3 (Abbruch, seit 30.10. MVP+) -- Abbrechen gibt es im MVP nicht (lifecycle_status 'cancelled'
--   vorgehalten; @LZ-046 … @LZ-053 sind @mvp-plus); 'cancelled' liefert in beiden Funktionen wie bisher {status:'none'}.
--   Andockstelle fuer MVP+: der Zweig (B) unten (dort kaeme ein Teil-Endstand mit Kennzeichen hinzu, sobald sein
--   Speicherformat aus @LZ-047 ff. feststeht).
--
-- Inhalt: CREATE OR REPLACE FUNCTION public_view.config_for(jsonb,text,text,boolean) (Text aus 20261118_007 + Block (U),
--   Kennzeichen „20261118_008 (U)“; Signatur, IMMUTABLE, search_path, Rechte unveraendert),
--   CREATE OR REPLACE FUNCTION public.public_final_standings(text) (Text aus 20261113_003 + Zweig (B), Kennzeichen
--   „20261118_008“ im Kommentar) und public.display_final_standings(uuid, text) (neu, zweite Fassung neben der
--   bisherigen display_final_standings(uuid), die UNVERAENDERT bleibt -- Monitore mit dem alten App-Stand lesen weiter
--   ueber sie, bis die App ausgerollt ist; Ablösung mit B-21). Die Antwort baut match_engine.final_standings_payload
--   (Fassung 20261118_004, Kindermodus -> none, Torschuetzen nur mit Schalter) -- dieselbe Lesart wie Zuschauer-Endstand
--   und display_tournament (Kindermodus, Torschuetzen-Schalter); nichts, was der Monitor-Link nicht schon sieht.
--   Keine Tabellen-, Policy- oder Trigger-Aenderung; final_standings_payload und display_final_standings(uuid) bleiben
--   wortgleich (die alte Monitor-Fassung kennt Zweig (B) nicht -- nur noch alte App-Staende, Abloesung B-21).
-- Rechte: SECURITY DEFINER, search_path fest, EXECUTE fuer anon und authenticated (wie display_tournament und
--   display_final_standings(uuid)), nicht PUBLIC.
-- Fail-fast: display_tournament(uuid,text,bigint) (20261117_104), display_final_standings(uuid) und
--   final_standings_payload in der Fassung mit Kindermodus (20261118_004, Kennzeichen „W-M (b)“), Tabelle
--   tournament_final_standings mit finished_at, public_final_standings in der Fassung 20261113_003 (md5) oder dieser Datei,
--   public_view.config_for in der Fassung 20261118_007 (md5) oder dieser Datei.
--   Sonst Abbruch ohne Aenderung.
-- Bestandsdaten: keine Aenderung.
-- Reihenfolge: VOR dem Merge des App-Teils live (die App ruft dann display_final_standings mit p_monitor_id).
-- RUECKWEG: supabase/rollbacks/20261118_008_monitor_endstand_rollback.sql (= `bash scripts/monitor-endstand-check.sh
--   --print-rueckweg`), EIN Block: public_view.config_for woertlich aus 20261118_007, public_final_standings woertlich aus
--   20261113_003, DROP der neuen Monitor-Fassung.
--   Vorher die App ohne diesen Client-Teil deployen.
-- Beweis: scripts/monitor-endstand-check.sh (Wegwerf-Container, Baseline + alle Migrationen; --without-migration,
--   --gegenprobe), scripts/public-payload-check.sh (Positivliste mit (U), Gegenprobe G16/G17), RLS-Matrix
--   scripts/rls-matrix.d/spur-zz-monitor-endstand.sh. Sicherheitskern public-read-core-unchanged auf die neue Fassung gezogen.
-- Produktion: Einspielen durch Daniel nach Freigabe; dieser Branch spielt nichts ein. Idempotent (CREATE OR REPLACE).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.display_tournament(uuid,text,bigint)') IS NULL
     OR to_regprocedure('public.display_final_standings(uuid)') IS NULL
     OR to_regprocedure('match_engine.final_standings_payload(public.tournaments)') IS NULL
     OR to_regclass('public.tournament_final_standings') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'tournament_final_standings'
                       AND column_name = 'finished_at') THEN
    RAISE EXCEPTION '20261118_008_monitor_endstand: Voraussetzungen fehlen – zuerst 20261113_003, 20261117_104 und 20261118_004 einspielen';
  END IF;
  -- Kindermodus muss im Endstand gelten (W-M (b), 20261118_004) -- sonst gaebe der Monitor-Link im Kindermodus Plaetze preis.
  IF position('W-M (b)' IN (SELECT prosrc FROM pg_proc
                             WHERE oid = to_regprocedure('match_engine.final_standings_payload(public.tournaments)'))) = 0 THEN
    RAISE EXCEPTION '20261118_008_monitor_endstand: final_standings_payload ohne Kindermodus (erwartet Fassung 20261118_004) – erst klären';
  END IF;
  -- public_final_standings: Fassung 20261113_003 oder diese Datei -- nie still eine andere Fassung ueberschreiben.
  IF to_regprocedure('public.public_final_standings(text)') IS NULL
     OR (md5((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.public_final_standings(text)'))) <> '1fe0c63df160d078910b09794a2cda66'
         AND position('20261118_008 (B)' IN (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.public_final_standings(text)'))) = 0) THEN
    RAISE EXCEPTION '20261118_008_monitor_endstand: public_final_standings hat eine unbekannte Fassung (erwartet 20261113_003) – erst klären';
  END IF;
  -- public_view.config_for: Fassung 20261118_007 (live seit 30.10.) oder diese Datei.
  IF to_regprocedure('public_view.config_for(jsonb,text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION '20261118_008_monitor_endstand: Voraussetzungen fehlen – zuerst 20261117_104 und 20261118_007 einspielen';
  END IF;
  IF md5((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public_view.config_for(jsonb,text,text,boolean)'))) <> 'ad6a688f10d82978b15ce850e2af8fff'
     AND position('20261118_008 (U)' IN (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public_view.config_for(jsonb,text,text,boolean)'))) = 0 THEN
    RAISE EXCEPTION '20261118_008_monitor_endstand: public_view.config_for hat eine unbekannte Fassung (erwartet 20261118_007) – erst klären';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 0b. (U) Positivliste: Uhr-Art und Laenge der Schlussphase fuer Zuschauer und Monitor (Text aus 20261118_007 + Block (U))
-- ---------------------------------------------------------------------------------------------------------------
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

  -- 20261118_008 (U): Uhr am Monitor und auf der Zuschauer-Seite (@ZM-166, @ZM-137) -- aus matchCockpitSettings NUR die
  -- Uhr-Art und die Laenge der Schlussphase (die Anzeige liest genau diese zwei, tournamentView clockRulesOf); keine Ton-,
  -- Bedien- oder Spielregel-Einstellungen. Nur mit dem passenden JSON-Typ; sonst fehlt der Wert (Vorgabe der App).
  IF jsonb_typeof(v_config -> 'matchCockpitSettings') = 'object' THEN
    v_out := v_out || jsonb_build_object('matchCockpitSettings', (
      SELECT coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
        FROM jsonb_each(v_config -> 'matchCockpitSettings') AS s
       WHERE (s.key = 'clockMode' AND jsonb_typeof(s.value) = 'string')
          OR (s.key = 'finalPhaseMinutes' AND jsonb_typeof(s.value) = 'number')));
    IF v_out -> 'matchCockpitSettings' = '{}'::jsonb THEN
      v_out := v_out - 'matchCockpitSettings';
    END IF;
  END IF;

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

-- ---------------------------------------------------------------------------------------------------------------
-- 1a. Zuschauer-Endstand: Text aus 20261113_003, dazu Zweig (B) (@LZ-077 Z. 2)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_final_standings(p_share_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments;
  v_finished_at timestamptz;
BEGIN
  IF p_share_code IS NULL OR char_length(p_share_code) > 20 THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  SELECT * INTO v_t FROM public.tournaments t
   WHERE t.share_code = p_share_code AND coalesce(t.is_public, false) AND t.deleted_at IS NULL;
  -- 20261118_008 (B): wieder geoeffnet (@LZ-091) -> der gespeicherte Endstand unveraendert, bis neu abgeschlossen (@LZ-077 Z. 2).
  IF v_t.lifecycle_status = 'fixed' THEN
    SELECT fs.finished_at INTO v_finished_at
      FROM public.tournament_final_standings fs WHERE fs.tournament_id = v_t.id;
    IF v_finished_at IS NOT NULL THEN
      v_t.lifecycle_status := 'finished';
      v_t.finished_at := v_finished_at;
    END IF;
  END IF;
  RETURN match_engine.final_standings_payload(v_t);
END;
$$;
REVOKE ALL ON FUNCTION public.public_final_standings(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_final_standings(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Endstand fuer den Monitor-Link (Uebergang bis B-20/B-21, wie display_tournament)
-- ---------------------------------------------------------------------------------------------------------------
-- (A) Zugang wie display_tournament: Turnier nicht geloescht und der Monitor steht in config.monitors -- unabhaengig vom
--     Online-Teilen (@ZM-101) und von einer Anmeldung. (B) Wieder geoeffnet (lifecycle_status 'fixed' mit gespeichertem
--     Endstand -- den gibt es nur nach einem Abschluss): die Antwort von vor dem Wiederoeffnen, unveraendert
--     (@ZM-121 Z. 2). Alles Weitere (Kindermodus, Torschuetzen-Schalter, nur 'finished') entscheidet
--     match_engine.final_standings_payload wie fuer Zuschauer.
CREATE OR REPLACE FUNCTION public.display_final_standings(p_tournament_id uuid, p_monitor_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments;
  v_finished_at timestamptz;
BEGIN
  IF p_tournament_id IS NULL OR p_monitor_id IS NULL OR char_length(p_monitor_id) NOT BETWEEN 1 AND 100 THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  SELECT * INTO v_t FROM public.tournaments t WHERE t.id = p_tournament_id AND t.deleted_at IS NULL;
  IF NOT FOUND
     OR NOT EXISTS (SELECT 1
                      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_t.config -> 'monitors') = 'array'
                                                     THEN v_t.config -> 'monitors' ELSE '[]'::jsonb END) AS x(m)
                     WHERE m ->> 'id' = p_monitor_id) THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  -- (B) wieder geoeffnet (@LZ-091): der gespeicherte Endstand gilt fuer den Monitor weiter, mit seinem Abschlusszeitpunkt.
  IF v_t.lifecycle_status = 'fixed' THEN
    SELECT fs.finished_at INTO v_finished_at
      FROM public.tournament_final_standings fs WHERE fs.tournament_id = v_t.id;
    IF v_finished_at IS NOT NULL THEN
      v_t.lifecycle_status := 'finished';
      v_t.finished_at := v_finished_at;
    END IF;
  END IF;
  RETURN match_engine.final_standings_payload(v_t);
END;
$$;
COMMENT ON FUNCTION public.display_final_standings(uuid, text) IS
  '20261118_008: Endstand fuer den Monitor-Link /display/:tournamentId/:monitorId (Pruefung wie display_tournament, unabhaengig vom Online-Teilen). Nach dem Wiederoeffnen (@LZ-091) der Endstand von vorher unveraendert, bis neu abgeschlossen (@ZM-121 Z. 2). Kindermodus/Torschuetzen wie final_standings_payload.';

REVOKE ALL ON FUNCTION public.display_final_standings(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.display_final_standings(uuid, text) TO anon, authenticated;

COMMIT;
