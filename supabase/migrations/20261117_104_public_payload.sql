-- supabase/migrations/20261117_104_public_payload.sql
-- B-14 (MVP-Bauplan GB6, E-A2, E-A7, Review Focus 6): Oeffentliche Daten nur ueber Server-Funktionen mit fester
-- Positivliste. Szenarien: @ZM-001 (Schalter-Satz am Server, Vorbelegung), @ZM-036, @ZM-063, @ZM-065, @ZM-066, @ZM-067,
--   @ZM-068, @ZM-069, @ZM-096, @ZM-097, @ZM-098, @ZM-099, @ZM-100, @ZM-101, @ZM-102, @ZM-109, @ME-018, @W1-030, @W1-031,
--   @W1-032, @W3-001 (keine Schiedsrichter fuer Zuschauer). Befunde C-PUBLIC-REST, C-CONTACT-PUBLIC,
--   C-ANON-STANDARDRECHTE-NEUE-TABELLEN, C-ZUSCHAUER-FREIGABE-ZURUECK-ALS-STOERUNG.
--
-- Inhalt:
--   1. Spalte matches.original_start (time, NULL = Anstosszeit nie verschoben; schreibt B-26).
--   2. Lese-Helfer public.is_reading_member(uuid): angenommene, nicht widerrufene Mitgliedschaft mit einer Rolle
--      ausser 'screen' (GA5 v2.1 I-2: helper und viewer lesen weiter das ganze Turnier, nur screen ist begrenzt).
--   3. SELECT-Policies (E-A7: B-14 besitzt sie) auf tournaments, teams, team_players, matches, match_events,
--      sponsors, match_corrections: nur noch TO authenticated, Eigentuemer (owner_id) oder lesendes Mitglied; der
--      Zweig "is_public = true" entfaellt. monitors: nur manageScreens (Eigentuemer mit Konto, Co-Admin).
--      Folge: anon und Konten ohne Rolle lesen keine dieser Tabellen mehr direkt (0 Zeilen, kein Fehler).
--   4. Schema public_view (ohne USAGE fuer Client-Rollen) mit dem internen Baustein
--      public_view.public_payload(tournament_id, since_version, audience, monitor_id) und seinen Hilfen.
--      Positivliste (E-A2, Record Zuschauer und Monitor "Was die Schnittstelle ausliefert"):
--        Turnier  id, title, date, start_time, sport, tournament_type, status, Ort (location_*), Struktur (Felder,
--                 Teams, Gruppen, Spielzeiten, point_system, finals_config), is_public, share_code (nur wenn
--                 oeffentlich), Lebenszyklus (completed_at; lifecycle_status, finished_at sobald A-21a sie anlegt),
--                 config nur mit den Schluesseln aus c_config_keys, Gleichstands-Entscheidungen ohne Begruendung,
--                 Kontaktperson des Veranstalters nur mit Haekchen contactInfo.showPublic = true (nie fuer Monitore).
--        Teams    id, name, group_letter, is_removed, logo_path, logo_background_color, color_primary,
--                 color_secondary -- nie contact_*, removed_reason, owner_id.
--        Spiele   id, Nummer, Runde, Feld, Slot, Phase, Gruppe, Seiten (team_x_id, slot_x_source, origin_x),
--                 is_final, final_type, label, scheduled_start, original_start, match_status, Uhr (live_state,
--                 timer_*, actual_start, actual_end), skipped_at, Leibchen/Farben (kit_color_x, bib_side),
--                 Spielstand nur soweit Schalter und Kindermodus ihn erlauben, decided_by und forfeit_absent nicht im
--                 Kindermodus, Ereignisse (Tor, Karte, Zeitstrafe, Strafstoss) ohne Urheber, nie skipped_reason,
--                 referee_*, owner_id, last_modified_by, version.
--        Torschuetzen nur mit config.publicScorers = true, nie im Kindermodus (Zwischenstand, Tore beendeter Spiele
--                 und laufender Spiele nur bei eingeschaltetem Live-Stand, @ZM-102).
--        Bildschirm (audience 'screen') zusaetzlich: Schiedsrichter nach config.monitorReferees (@W3-001,
--                 @W3-032, Daniel 22.10.: 'number' Vorgabe = nur Nummern, referee_config ohne refereeNames;
--                 'name' = mit Namen; 'none' = keine SR-Angaben), nur der eigene Monitor (config.monitors) und nur die Sponsoren seiner Folien, ohne
--                 Kontaktperson. Nie: Team-Kontakte, andere Monitore, monitors.access_code, Mitglieder,
--                 Beitrittscodes, interne Notizen (adminNotes), Statistiken, Korrektur-Gruende und -Personen.
--      Antwort: {state:'not_found'} | {state:'unchanged', version, server_now} |
--               {state:'full', version, server_now, tournament, teams, matches[, scorers]} |
--               {state:'delta', version, base_version, server_now, tournament_date, matches[, scorers]}.
--      version = Mikrosekunden seit 1970 der letzten Aenderung an Turnier, Teams oder Spielen, hoechstens
--      "jetzt - 5 s" (c_lag_us): eine Schreib-Transaktion, die vor der Antwort begann und erst danach festschreibt,
--      liegt so immer nach der gemeldeten Version und kommt mit der naechsten Antwort. server_now in Millisekunden.
--      Voll-Antwort, wenn since fehlt, voraus ist oder sich Turnierzeile oder Teams seither geaendert haben -- also
--      auch bei jedem Wechsel eines Zuschauer-Schalters oder des Kindermodus (config steht in der Turnierzeile).
--      Sonst nur die seither geaenderten Spiele (Delta). Neue Spiele/Teams tragen updated_at vom Server (Trigger
--      BEFORE INSERT), geloeschte Spiele/Teams merkt public_view.structure_changes (Trigger AFTER DELETE) -- danach
--      kommt die Voll-Antwort, auch wenn save() zwischen Turnier-Upsert und Loeschen/Einfuegen lange braucht (A1).
--      live_state nur mit den Uhr-Schluesseln der Engine, im Kindermodus ohne Entscheidungs-Angaben (N2).
--   5. public.public_tournament(share_code, since_version) -- Zuschauer, anon und authenticated: nur ein
--      oeffentliches, nicht geloeschtes Turnier mit genau diesem Code; sonst {state:'not_found'} (nicht geteilt und
--      unbekannt sind gleich, @ZM-068). Eine Stoerung ist ein Fehler der Anfrage, nie not_found (@ZM-109).
--   6. public.display_tournament(tournament_id, monitor_id, since_version) -- Uebergang fuer die heutigen
--      Monitor-Links /display/:tournamentId/:monitorId bis B-20/B-21 (Kopplung, screen_display): liefert
--      audience 'screen', wenn der Monitor in config.monitors dieses Turniers steht; unabhaengig von is_public
--      (@ZM-066, @ZM-101: ein eingerichteter Monitor zeigt weiter). B-21 entfernt Route und Funktion.
--   6b. make_tournament_private behaelt share_code (nur is_public = false); make_tournament_public gibt einen
--      vorhandenen Code zurueck und teilt wieder (@ZM-067: derselbe Link nach erneutem Teilen). Sicher, weil anon den
--      Code ohne is_public nicht mehr aufloesen kann. Rechte, Signaturen, HF001 und der Zweig "schon oeffentlich"
--      bleiben wie in 20261110_004 (CA-2).
--   7. Standardrechte (C-ANON-STANDARDRECHTE-NEUE-TABELLEN): neue Tabellen in public, die postgres anlegt, bekommen
--      keine Rechte mehr fuer anon.
--
-- Bestandsdaten: keine neue Pruefregel, kein Backfill (original_start NULL = nie verschoben). Prognose-Zaehlung
--   (lesend, vor dem Fenster): Zahl oeffentlicher Turniere und Monitore je Turnier -- Freigabe-Unterlage
--   B-14-sql-freigabe.md, Abschnitt "Vorab-Pruefung". Wirkung auf den Bestand: anon liest danach nichts mehr direkt;
--   die App ab diesem Paket liest ueber die Funktionen (Zuschauer-Seite, Monitor).
--
-- Voraussetzungen (Fail-fast unten): has_tournament_permission (20260924_002/20261110_002), Rolle 'screen'
--   (20261110_002, A-27), matches.slot_x_source (20261003_001). origin_x (20261026_001), kit_color_x/bib_side
--   (20261028_004), forfeit_absent (A-25, 20261110_005) und lifecycle_status/finished_at (A-21a, 20261113_003) werden
--   gelesen, wenn es sie gibt (to_jsonb der Zeile), sonst fehlen die Schluessel -- keine harte Abhaengigkeit von der
--   Reihenfolge.
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE SCHEMA IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS vor
--   jedem CREATE POLICY, REVOKE/GRANT, ALTER DEFAULT PRIVILEGES.
--
-- RUECKWEG: eigene Datei supabase/rollbacks/20261117_104_public_payload_rollback.sql (Anhang B der
--   Freigabe-Unterlage), EIN Block. Vorher die App auf den Stand ohne B-14-Client zurueck (sonst findet die
--   Zuschauer-Seite die Funktion nicht und meldet "nicht erreichbar"). Belegt in scripts/public-payload-check.sh
--   (Kategorie X: Schema danach = vorher).
--
-- Produktion: nur im DB-Fenster F4 (Di 17.11.2026) durch den Controller nach Daniels Freigabe
--   (B-14-sql-freigabe.md). Typen-PR noetig (neue Spalte, neue Funktionen).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL THEN
    RAISE EXCEPTION '20261117_104_public_payload: has_tournament_permission fehlt -- zuerst 20260924_002 einspielen';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.tournament_collaborators'::regclass
                    AND conname = 'tournament_collaborators_role_check'
                    AND pg_get_constraintdef(oid) LIKE '%''screen''%') THEN
    RAISE EXCEPTION '20261117_104_public_payload: Rolle screen fehlt -- zuerst 20261110_002 (A-27) einspielen';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'matches'
         AND column_name IN ('slot_a_source', 'slot_b_source')) <> 2 THEN
    RAISE EXCEPTION '20261117_104_public_payload: Spalten der Spielseiten fehlen -- zuerst 20261003_001 einspielen';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. matches.original_start
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS original_start time without time zone;
COMMENT ON COLUMN public.matches.original_start IS
  'B-14 (E-A2): urspruengliche Anstosszeit, wenn scheduled_start am Turniertag verschoben wurde; NULL = nie verschoben. Oeffentlich (Positivliste).';

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Lese-Helfer
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_reading_member(p_tournament_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.tournament_collaborators tc
     WHERE tc.tournament_id = p_tournament_id
       AND tc.user_id = (SELECT auth.uid())
       AND tc.accepted_at IS NOT NULL
       AND tc.declined_at IS NULL
       AND tc.role <> 'screen');
$$;
COMMENT ON FUNCTION public.is_reading_member(uuid) IS
  'B-14: liest das ganze Turnier direkt (SELECT-Policies) -- angenommene, nicht widerrufene Mitgliedschaft ausser Rolle screen (Bildschirme lesen nur ueber die Positivliste).';
REVOKE ALL ON FUNCTION public.is_reading_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_reading_member(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. SELECT-Policies (E-A7)
-- ---------------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS tournaments_select_v3 ON public.tournaments;
DROP POLICY IF EXISTS tournaments_select_v4 ON public.tournaments;
CREATE POLICY tournaments_select_v4 ON public.tournaments FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = owner_id) OR public.is_reading_member(id));

DROP POLICY IF EXISTS teams_select_v3 ON public.teams;
DROP POLICY IF EXISTS teams_select_v4 ON public.teams;
CREATE POLICY teams_select_v4 ON public.teams FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = owner_id) OR public.is_reading_member(tournament_id));

DROP POLICY IF EXISTS team_players_select_v3 ON public.team_players;
DROP POLICY IF EXISTS team_players_select_v4 ON public.team_players;
CREATE POLICY team_players_select_v4 ON public.team_players FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t
                  WHERE t.id = team_players.team_id
                    AND (t.owner_id = (SELECT auth.uid()) OR public.is_reading_member(t.tournament_id))));

DROP POLICY IF EXISTS matches_select_v3 ON public.matches;
DROP POLICY IF EXISTS matches_select_v4 ON public.matches;
CREATE POLICY matches_select_v4 ON public.matches FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = owner_id) OR public.is_reading_member(tournament_id));

DROP POLICY IF EXISTS match_events_select_v3 ON public.match_events;
DROP POLICY IF EXISTS match_events_select_v4 ON public.match_events;
CREATE POLICY match_events_select_v4 ON public.match_events FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = owner_id)
         OR public.is_reading_member((SELECT m.tournament_id FROM public.matches m WHERE m.id = match_events.match_id)));

DROP POLICY IF EXISTS monitors_select_v4 ON public.monitors;
DROP POLICY IF EXISTS monitors_select_v5 ON public.monitors;
CREATE POLICY monitors_select_v5 ON public.monitors FOR SELECT TO authenticated
  USING (public.has_tournament_permission(tournament_id, 'manageScreens'));

DROP POLICY IF EXISTS sponsors_select_v3 ON public.sponsors;
DROP POLICY IF EXISTS sponsors_select_v4 ON public.sponsors;
CREATE POLICY sponsors_select_v4 ON public.sponsors FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = owner_id) OR public.is_reading_member(tournament_id));

DROP POLICY IF EXISTS match_corrections_select_v2 ON public.match_corrections;
DROP POLICY IF EXISTS match_corrections_select_v3 ON public.match_corrections;
CREATE POLICY match_corrections_select_v3 ON public.match_corrections FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = owner_id)
         OR public.is_reading_member((SELECT m.tournament_id FROM public.matches m WHERE m.id = match_corrections.match_id)));

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Schema public_view: interner Baustein (keine Client-Rechte)
-- ---------------------------------------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS public_view;
REVOKE ALL ON SCHEMA public_view FROM PUBLIC, anon, authenticated;
COMMENT ON SCHEMA public_view IS
  'B-14: interner Baustein der oeffentlichen Antworten (public_tournament, display_tournament, kuenftig screen_display). Keine Rechte fuer Client-Rollen.';

-- Mikrosekunden seit 1970 (Versionen, exakt: extract liefert numeric).
CREATE OR REPLACE FUNCTION public_view.epoch_us(p_at timestamptz) RETURNS bigint
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT floor(extract(epoch FROM p_at) * 1000000)::bigint;
$$;

-- Zuschauer-Schalter mit Vorbelegung (@ZM-001; gleiche Werte wie src/core/models/publicContentDefaults.json).
-- Nur ein JSON-Wahrheitswert zaehlt, alles andere ist die Vorbelegung.
CREATE OR REPLACE FUNCTION public_view.switches(p_config jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'kidsMode', coalesce(p_config -> 'hideScoresForPublic' = 'true'::jsonb, false),
    'tables', NOT coalesce(p_config -> 'hideRankingsForPublic' = 'true'::jsonb, false),
    'liveScore', NOT coalesce(p_config -> 'publicLiveScore' = 'false'::jsonb, false),
    'events', NOT coalesce(p_config -> 'publicEvents' = 'false'::jsonb, false),
    'scorers', coalesce(p_config -> 'publicScorers' = 'true'::jsonb, false));
$$;

-- Oberste Ebene ohne null-Werte (kleinere Antwort; verschachtelte Werte bleiben unveraendert).
CREATE OR REPLACE FUNCTION public_view.without_nulls(p_object jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    FROM jsonb_each(p_object) AS e
   WHERE e.value <> 'null'::jsonb;
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

-- Herkunft einer Seite: bei ausgeblendeten Tabellen (oder Kindermodus) keine Gruppen-Platzierung neben einem schon
-- eingesetzten Team (@ZM-102 Zeile 2); ohne Team bleibt die Herkunft (die Anzeige zeigt dann "noch offen").
CREATE OR REPLACE FUNCTION public_view.side_source(p_source jsonb, p_has_team boolean, p_rankings_visible boolean)
RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_source IS NULL OR p_source = 'null'::jsonb THEN NULL
    WHEN NOT p_rankings_visible AND p_has_team AND p_source ->> 'kind' = 'groupRank' THEN NULL
    ELSE p_source
  END;
$$;

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

-- Uhr der Spieluhr ohne Fremdschluessel (N2): nur die Schluessel, die die Engine schreibt; im Kindermodus ohne die
-- Entscheidungs-Angaben (Wahl Verlaengerung/Strafstoss offen, Art der Entscheidung).
CREATE OR REPLACE FUNCTION public_view.live_state_for(p_state jsonb, p_kids boolean) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_state IS NULL OR jsonb_typeof(p_state) <> 'object' THEN NULL ELSE (
    SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
      FROM jsonb_each(p_state) AS e
     WHERE e.key = ANY (ARRAY['engine', 'status', 'phase', 'section', 'running', 'elapsedMs', 'anchorAt', 'elapsedSeconds',
                              'durationSeconds', 'playPhase', 'tiebreakerMode', 'overtimeDurationSeconds',
                              'awaitingTiebreakerChoice', 'sections', 'sectionSeconds', 'breakSeconds', 'overtimeSeconds',
                              'sectionStartMs', 'breakStartedAt'])
       AND NOT (p_kids AND e.key IN ('tiebreakerMode', 'awaitingTiebreakerChoice'))) END;
$$;

-- Geloeschte Spiele und Teams (A1): save() loescht in eigenen Anfragen, ohne die Turnierzeile zu beruehren. Der
-- Loesch-Trigger merkt den Zeitpunkt je Turnier; public_payload antwortet danach voll (kein Delta mit Phantom-Spielen).
CREATE TABLE IF NOT EXISTS public_view.structure_changes (
  tournament_id uuid PRIMARY KEY,
  changed_at timestamptz NOT NULL
);
ALTER TABLE public_view.structure_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public_view.structure_changes FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public_view.structure_changes IS
  'B-14 (A1): letzter Loeschzeitpunkt von Spielen/Teams je Turnier; nur fuer public_payload (Voll-Antwort danach).';

CREATE OR REPLACE FUNCTION public_view.note_structure_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public_view.structure_changes (tournament_id, changed_at)
  VALUES (OLD.tournament_id, now())
  ON CONFLICT (tournament_id) DO UPDATE SET changed_at = greatest(public_view.structure_changes.changed_at, EXCLUDED.changed_at);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS matches_public_structure_delete ON public.matches;
CREATE TRIGGER matches_public_structure_delete AFTER DELETE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public_view.note_structure_change();
DROP TRIGGER IF EXISTS teams_public_structure_delete ON public.teams;
CREATE TRIGGER teams_public_structure_delete AFTER DELETE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public_view.note_structure_change();

-- Neue Spiele und Teams (A1): updated_at beim Einfuegen vom Server statt von der Geraeteuhr (Mapper schickt sie mit).
DROP TRIGGER IF EXISTS matches_updated_at_insert ON public.matches;
CREATE TRIGGER matches_updated_at_insert BEFORE INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS teams_updated_at_insert ON public.teams;
CREATE TRIGGER teams_updated_at_insert BEFORE INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Der interne Baustein (Plan B-14: public_payload(tournament_id, since_version)).
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

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Zuschauer: public_tournament(share_code, since_version)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_tournament(share_code text, since_version bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text := upper(btrim(coalesce($1, '')));
  v_id uuid;
BEGIN
  IF v_code !~ '^[A-Z0-9]{6}$' THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;
  SELECT t.id INTO v_id
    FROM public.tournaments t
   WHERE t.share_code = v_code AND coalesce(t.is_public, false) AND t.deleted_at IS NULL;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;
  RETURN public_view.public_payload(v_id, $2, 'viewer', NULL);
END;
$$;
COMMENT ON FUNCTION public.public_tournament(text, bigint) IS
  'B-14 (E-A2): Zuschauer-Seite. Nur oeffentliche Turniere mit diesem Code, Felder nach Positivliste; sonst {state:not_found}.';

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Monitor-Link (Uebergang bis B-20/B-21): display_tournament(tournament_id, monitor_id, since_version)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.display_tournament(tournament_id uuid, monitor_id text, since_version bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_config jsonb;
BEGIN
  IF $1 IS NULL OR $2 IS NULL OR char_length($2) NOT BETWEEN 1 AND 100 THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;
  SELECT t.config INTO v_config FROM public.tournaments t WHERE t.id = $1 AND t.deleted_at IS NULL;
  IF v_config IS NULL OR jsonb_typeof(v_config -> 'monitors') <> 'array'
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_config -> 'monitors') AS x(m) WHERE m ->> 'id' = $2) THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;
  RETURN public_view.public_payload($1, $3, 'screen', $2);
END;
$$;
COMMENT ON FUNCTION public.display_tournament(uuid, text, bigint) IS
  'B-14 (E-A2): heutiger Monitor-Link /display/:tournamentId/:monitorId bis B-20/B-21. Positivliste mit Schiedsrichtern, nur der eigene Monitor; unabhaengig vom Online-Teilen.';

REVOKE ALL ON FUNCTION public.public_tournament(text, bigint), public.display_tournament(uuid, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_tournament(text, bigint), public.display_tournament(uuid, text, bigint)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 6b. Erneut teilen behaelt den Code (@ZM-067; Fassung 20261110_004 CA-2, sonst woertlich)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.make_tournament_private(tournament_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Check permission (CA-2): tournamentSettings -- Eigentuemer (echtes Konto) und Co-Admin
  IF NOT public.has_tournament_permission(tournament_id, 'tournamentSettings') THEN
    RAISE EXCEPTION 'Not authorized to modify this tournament';
  END IF;

  -- B-14 (@ZM-067): der Code bleibt am Turnier; nicht geteilt heisst nur is_public = false. Ohne direkten SELECT fuer
  -- anon (B-14) liefert der Code dann nichts mehr (public_tournament prueft is_public).
  UPDATE tournaments
  SET is_public = false
  WHERE id = tournament_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.make_tournament_public(tournament_id uuid)
RETURNS TABLE(share_code text, share_code_created_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  new_code TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
  v_is_public BOOLEAN;
  v_existing_code TEXT;
  v_existing_created_at TIMESTAMPTZ;
BEGIN
  -- Check permission (CA-2): tournamentSettings -- Eigentuemer (echtes Konto) und Co-Admin
  IF NOT public.has_tournament_permission(tournament_id, 'tournamentSettings') THEN
    RAISE EXCEPTION 'Not authorized to modify this tournament';
  END IF;

  -- Freigabe-Backstop: ohne publishedAt im config-JSONB ist das Turnier ein Entwurf.
  -- NICHT 'PT001' (und kein anderer Code aus der PT-Namespace): PostgREST interpretiert
  -- SQLSTATEs der Form PTxyz als HTTP-Status-Override, 'PT001' waere HTTP-Status 1 —
  -- keine gueltige Status-Zeile, die Response kaeme beim Client gar nicht intakt an.
  -- 'HF' ist weder von Postgres reserviert noch Teil der PT-Namespace.
  IF NOT (
    COALESCE(
      (SELECT config FROM tournaments WHERE id = tournament_id),
      '{}'::jsonb
    ) ? 'publishedAt'
  ) THEN
    RAISE EXCEPTION 'Tournament has not been released yet and cannot be made public'
      USING ERRCODE = 'HF001';
  END IF;

  -- Code bleibt beim erneuten Teilen (CA-2, Auflage 5): schon oeffentlich mit Code -> genau diesen Code zurueck.
  -- FOR UPDATE: ein gleichzeitiger zweiter Aufruf wartet und sieht danach den Code des ersten.
  SELECT t.is_public, t.share_code, t.share_code_created_at
    INTO v_is_public, v_existing_code, v_existing_created_at
    FROM tournaments t
   WHERE t.id = tournament_id
   FOR UPDATE;
  IF v_is_public AND v_existing_code IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_code, v_existing_created_at;
    RETURN;
  END IF;
  -- B-14 (@ZM-067): nach dem Zuruecknehmen erneut geteilt -> derselbe Code, derselbe Link und QR-Code.
  IF v_existing_code IS NOT NULL THEN
    UPDATE tournaments SET is_public = true WHERE id = tournament_id;
    RETURN QUERY SELECT v_existing_code, v_existing_created_at;
    RETURN;
  END IF;

  -- Generate unique code with retry logic
  LOOP
    attempt := attempt + 1;
    new_code := generate_share_code();

    -- Check if code is unique
    IF NOT EXISTS (SELECT 1 FROM tournaments WHERE tournaments.share_code = new_code) THEN
      EXIT;
    END IF;

    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique share code after % attempts', max_attempts;
    END IF;
  END LOOP;

  -- Update tournament
  UPDATE tournaments
  SET
    is_public = true,
    share_code = new_code,
    share_code_created_at = NOW()
  WHERE id = tournament_id;

  RETURN QUERY SELECT new_code, NOW();
END;
$$;


-- ---------------------------------------------------------------------------------------------------------------
-- 7. Standardrechte neuer Tabellen (C-ANON-STANDARDRECHTE-NEUE-TABELLEN)
-- ---------------------------------------------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

COMMIT;
