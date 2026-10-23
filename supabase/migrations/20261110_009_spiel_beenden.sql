-- supabase/migrations/20261110_009_spiel_beenden.sql
-- Spiel im Spielplan beenden und Ergebnis eintragen (Variante A mit Review-Auflagen M1-M4, Freigabe Daniel 22.10.;
-- review-vorschlag-spiel-beenden.md): die Turnierleitung (Eigentuemer, Co-Admin mit leadMatches) beendet ein angepfiffenes
-- Spiel mit EINEM Eintrag RESULT_ENTRY -- Abpfiff und Ergebnis zugleich --, auch wenn ein anderes Geraet das Feld steuert,
-- ohne das Feld zu uebernehmen (@FU-081 praezisiert, @FU-112, @FU-113, @FU-114, @FU-115, @FU-116, @FU-118, @FU-119).
-- Gleichlauf: scripts/match-engine-parity.sh (Fixtures 40, 70a-70k); Schreibweg, Steuer, Rechte, Proben, Rueckweg:
-- scripts/spiel-beenden-check.sh.
--
-- Inhalt:
--   1. match_transitions: RESULT_ENTRY (Akteur leitung, Ziel finished) zusaetzlich aus running, paused, section_break und
--      decision_pending (exakt src/core/match/matchTransitions.json). Nicht aus shootout (@FU-118, MVP).
--   2. Rechenfunktion (TS ist die Referenz, handlers/correction.ts applyResultEntry, payloadValidation.ts):
--      payload_valid  -- RESULT_ENTRY darf `basedOn` (string|null) tragen (Review M4);
--      apply_effect   -- aus einem angepfiffenen Zustand: Wertung (`forfeit`) -> INVALID_TRANSITION FORFEIT_NOT_SCHEDULED
--                        (Review M1, @FU-119; REOPEN nimmt eine Wertung nach 'scheduled' mit unveraenderter Uhr zurueck);
--                        `basedOn` Pflicht, sonst STALE_BASE mit dem aktuellen Stand (Review M4, @FU-116);
--      apply_result_entry -- Uhr anhalten (stop_clock) und breakStartedAt NULL (Review M2; fuer 'scheduled' wirkungsgleich).
--   3. append_match_events (Fassung 20261110_005, Signatur unveraendert): c3-Ausnahme VOR dem ganzen c3-Block fuer
--      RESULT_ENTRY der Leitung aus running/paused/section_break/decision_pending -- keine NOT_CONTROLLER-Ablehnung, kein
--      Feldanspruch, keine Epochen-Pruefung (Review M3, Muster v_forfeit_reopen). Alles andere unveraendert.
--   4. Rechte unveraendert (ausdruecklich wiederholt). Keine neue Funktion, keine Spalte, keine Policy.
--
-- Ersetzte Funktionen (CREATE OR REPLACE, keine neue Signatur) -- Basis ist jeweils die JUENGSTE Fassung 20261110_005
-- (Review-Risiko 1: nie aus 20261110_003 oder aelter, sonst waeren Wertung und R-A25b-1/-2 zurueckgedreht):
--   match_engine.payload_valid(jsonb, jsonb)                  vorher 20261110_005_result_entry_forfeit.sql
--   match_engine.apply_result_entry(jsonb, jsonb, jsonb)      vorher 20261110_005_result_entry_forfeit.sql
--   match_engine.apply_effect(jsonb, jsonb, jsonb)            vorher 20261110_005_result_entry_forfeit.sql
--   public.append_match_events(uuid, jsonb, integer, uuid)    vorher 20261110_005_result_entry_forfeit.sql
-- Den Unterschied je Funktion gegen genau diese Fassung haelt src/__tests__/architecture/spielBeendenTwins.test.ts fest.
--
-- Idempotent: INSERT ... ON CONFLICT DO NOTHING, CREATE OR REPLACE, REVOKE/GRANT. Datenaenderung: nur vier neue Zeilen in
-- match_transitions. Bestand: unveraendert (kein gespeichertes Ereignis aendert seine Bedeutung -- ein RESULT_ENTRY aus
-- einem angepfiffenen Zustand war bisher nie annehmbar). Portabel: reines SQL.
--
-- RUECKWEG: Vorlage aus `bash scripts/spiel-beenden-check.sh --print-rueckweg` (Anhang B der Freigabe-Unterlage
-- spiel-beenden-sql-freigabe.md), in EINEM Block; belegt in Kategorie X. Vorher die App zurueck (die neue App sendet
-- RESULT_ENTRY mit basedOn). Haelt an, wenn schon ein Ergebnis mit basedOn gespeichert ist (ein solches Spiel liefe nach dem
-- Rueckweg beim Nachrechnen wieder) -- nach der ersten Nutzung gibt es nur noch eine Korrektur nach vorn. Haelt ebenso an, wenn
-- append_match_events schon eine spaetere Fassung ist (closed_intake, A-21a 20261113_003): der Rueckweg gilt nur bis G2.
--
-- Produktion: nur im DB-Fenster G1b durch den Controller nach Daniels Freigabe des woertlichen SQL
-- (spiel-beenden-sql-freigabe.md), Reihenfolge NACH 20261110_005 (.._008), VOR 20261113_003. Dieser Branch spielt nichts ein.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ============================================================================================
-- 0. Voraussetzungen (Fail-fast): die Fassungen aus 20261110_005, auf denen diese Datei aufbaut
-- ============================================================================================

DO $$
BEGIN
  IF to_regclass('public.match_transitions') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)')
                     AND position('v_forfeit_reopen' IN prosrc) > 0 AND position('public.field_control' IN prosrc) > 0)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('match_engine.apply_result_entry(jsonb,jsonb,jsonb)')
                     AND position('''forfeit''' IN prosrc) > 0)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('match_engine.apply_effect(jsonb,jsonb,jsonb)')
                     AND position('reopensBeforeStart' IN prosrc) > 0)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('match_engine.payload_valid(jsonb,jsonb)')
                     AND position('v_payload ? ''forfeit''' IN prosrc) > 0)
     OR to_regprocedure('match_engine.stale_base_detail(jsonb,jsonb)') IS NULL
     OR to_regprocedure('match_engine.stop_clock(jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION '20261110_009_spiel_beenden: Vorgaenger fehlen (Wertung 20261110_005 mit A-34 20261110_003) -- zuerst alle Migrationen bis 20261110_008 einspielen';
  END IF;
  -- Review A2: nie still ueber eine spaetere Neufassung spielen (A-21a 20261113_003 fasst append_match_events mit
  -- closed_intake neu) -- dann muss die spaetere Datei auf dieser aufbauen, nicht umgekehrt.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)')
              AND position('closed_intake' IN prosrc) > 0) THEN
    RAISE EXCEPTION '20261110_009_spiel_beenden: append_match_events ist schon eine spaetere Fassung (closed_intake, 20261113_003) -- diese Datei nicht darueber spielen';
  END IF;
END;
$$;


-- ============================================================================================
-- 1. match_transitions: RESULT_ENTRY der Leitung aus angepfiffenen Zustaenden (exakt src/core/match/matchTransitions.json)
-- ============================================================================================

INSERT INTO "public"."match_transitions" ("from_status", "event_type", "actor", "to_status") VALUES
  ('running', 'RESULT_ENTRY', 'leitung', 'finished'),
  ('paused', 'RESULT_ENTRY', 'leitung', 'finished'),
  ('section_break', 'RESULT_ENTRY', 'leitung', 'finished'),
  ('decision_pending', 'RESULT_ENTRY', 'leitung', 'finished')
ON CONFLICT ("from_status", "event_type") DO NOTHING;


-- ============================================================================================
-- 2a. payload_valid: RESULT_ENTRY mit optionalem basedOn (Fassung 20261110_005 + Review M4)
-- ============================================================================================

CREATE OR REPLACE FUNCTION match_engine.payload_valid(p_event jsonb, p_ctx jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text := p_event ->> 'type';
  v_payload jsonb := p_event -> 'payload';
  v_all_fields constant text[] := ARRAY['playerNumber', 'playerId', 'assists', 'shooterNumber', 'incomplete'];
  v_clear jsonb;
BEGIN
  -- S4 (RR-M3): zod z.object() lehnt Nicht-Objekte (auch Arrays) ab.
  IF jsonb_typeof(v_payload) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;

  CASE v_type
    WHEN 'MATCH_START' THEN
      IF NOT match_engine.rules_valid(v_payload -> 'rules') THEN
        RETURN false;
      END IF;
    WHEN 'PAUSE', 'RESUME', 'SECTION_END', 'SECTION_START', 'CLOCK_ADJUST', 'MATCH_END',
         'SHOOTOUT_END', 'RETRACT', 'REOPEN', 'UNSKIP', 'REVIEW_ACCEPT', 'REVIEW_DISCARD' THEN
      NULL;
    WHEN 'TIEBREAK_CHOICE' THEN
      IF NOT coalesce(jsonb_typeof(v_payload -> 'choice') = 'string'
                      AND (v_payload ->> 'choice') IN ('overtime', 'goldenGoal', 'shootout'), false) THEN
        RETURN false;
      END IF;
    WHEN 'SHOOTOUT_KICK' THEN
      IF NOT coalesce(jsonb_typeof(v_payload -> 'scored') = 'boolean', false) THEN
        RETURN false;
      END IF;
    WHEN 'CORRECTION' THEN
      IF NOT match_engine.team_scores_valid(v_payload -> 'scores', p_ctx) THEN
        RETURN false;
      END IF;
      IF NOT coalesce(jsonb_typeof(v_payload -> 'reason') = 'string' AND length(v_payload ->> 'reason') >= 1, false) THEN
        RETURN false;
      END IF;
      IF NOT coalesce(jsonb_typeof(v_payload -> 'basedOn') IN ('string', 'null'), false) THEN
        RETURN false;
      END IF;
    WHEN 'RESULT_ENTRY' THEN
      IF NOT match_engine.team_scores_valid(v_payload -> 'scores', p_ctx) THEN
        RETURN false;
      END IF;
      -- Spiel beenden (20261110_009, @FU-116, Review M4): optional der Stand, den die Turnierleitung kannte (string|null
      -- wie CORRECTION, payloadValidation.ts) -- Pflicht und geprueft nur aus einem angepfiffenen Zustand (apply_effect).
      IF v_payload ? 'basedOn' AND NOT coalesce(jsonb_typeof(v_payload -> 'basedOn') IN ('string', 'null'), false) THEN
        RETURN false;
      END IF;
      -- A-25a (@FU-094): optional das Strafstossergebnis -- genau beide Teams, nur bei Gleichstand und
      -- nur, wenn es entscheidet (payloadValidation.ts). Ein explizites null ist ungueltig (zod optional).
      IF v_payload ? 'shootout'
         AND NOT (match_engine.team_scores_valid(v_payload -> 'shootout', p_ctx)
                  AND (v_payload -> 'scores' -> (p_ctx ->> 'teamAId')) = (v_payload -> 'scores' -> (p_ctx ->> 'teamBId'))
                  AND (v_payload -> 'shootout' -> (p_ctx ->> 'teamAId')) <> (v_payload -> 'shootout' -> (p_ctx ->> 'teamBId'))) THEN
        RETURN false;
      END IF;
      -- A-25n (@W2A-022, @W2A-024): optional die Nichtantritt-Wertung -- genau der Schluessel `absent` (A|B|both),
      -- `both` nur 0:0, `A` fehlt -> B gewinnt, `B` fehlt -> A gewinnt, nie zusammen mit `shootout`
      -- (payloadValidation.ts ForfeitSchema/forfeitScoresValid). Ein explizites null ist ungueltig (zod optional).
      IF v_payload ? 'forfeit'
         AND NOT coalesce(jsonb_typeof(v_payload -> 'forfeit') = 'object'
                          AND (SELECT count(*) FROM jsonb_object_keys(v_payload -> 'forfeit')) = 1
                          AND NOT (v_payload ? 'shootout')
                          AND CASE v_payload -> 'forfeit' ->> 'absent'
                                WHEN 'both' THEN (v_payload -> 'scores' ->> (p_ctx ->> 'teamAId'))::numeric = 0
                                             AND (v_payload -> 'scores' ->> (p_ctx ->> 'teamBId'))::numeric = 0
                                WHEN 'A' THEN (v_payload -> 'scores' ->> (p_ctx ->> 'teamBId'))::numeric
                                            > (v_payload -> 'scores' ->> (p_ctx ->> 'teamAId'))::numeric
                                WHEN 'B' THEN (v_payload -> 'scores' ->> (p_ctx ->> 'teamAId'))::numeric
                                            > (v_payload -> 'scores' ->> (p_ctx ->> 'teamBId'))::numeric
                                ELSE false
                              END, false) THEN
        RETURN false;
      END IF;
    WHEN 'SKIP' THEN
      IF v_payload ? 'reason' AND jsonb_typeof(v_payload -> 'reason') <> 'string' THEN
        RETURN false;
      END IF;
    WHEN 'GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD', 'SUBSTITUTION', 'FOUL' THEN
      NULL;
    WHEN 'TIME_PENALTY' THEN
      IF v_payload ? 'durationSeconds'
         AND NOT (match_engine.is_int(v_payload -> 'durationSeconds')
                  AND (v_payload -> 'durationSeconds')::numeric > 0) THEN
        RETURN false;
      END IF;
    WHEN 'AMEND' THEN
      IF EXISTS (SELECT 1 FROM unnest(v_all_fields) AS f(name)
                  WHERE v_payload ? f.name AND NOT match_engine.detail_value_valid(f.name, v_payload -> f.name)) THEN
        RETURN false;
      END IF;
      v_clear := coalesce(v_payload -> 'clear', '[]'::jsonb);
      IF v_payload ? 'clear' THEN
        IF jsonb_typeof(v_clear) IS DISTINCT FROM 'array' THEN
          RETURN false;
        END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_clear) AS c(v)
                    WHERE jsonb_typeof(c.v) IS DISTINCT FROM 'string' OR (c.v #>> '{}') <> ALL (v_all_fields))
           OR (SELECT count(DISTINCT c.v) FROM jsonb_array_elements(v_clear) AS c(v)) <> jsonb_array_length(v_clear) THEN
          RETURN false;
        END IF;
      END IF;
      -- Mindestens ein Feld gesetzt oder clear nicht leer; kein Feld gesetzt UND in clear.
      IF NOT EXISTS (SELECT 1 FROM unnest(v_all_fields) AS f(name) WHERE v_payload ? f.name)
         AND jsonb_array_length(v_clear) = 0 THEN
        RETURN false;
      END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_clear) AS c(name) WHERE v_payload ? c.name) THEN
        RETURN false;
      END IF;
    ELSE
      RETURN false;
  END CASE;

  -- C0a (A3/A5): Angabe-Felder der Zieltypen -- nur die fuer den Typ zulaessigen, wenn gesetzt.
  IF EXISTS (SELECT 1 FROM unnest(match_engine.detail_fields(v_type)) AS f(name)
              WHERE v_payload ? f.name AND NOT match_engine.detail_value_valid(f.name, v_payload -> f.name)) THEN
    RETURN false;
  END IF;

  -- S5 (MR3): team-bezogene Typen brauchen teamId aus {teamAId, teamBId}.
  IF v_type IN ('GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD', 'TIME_PENALTY',
                'FOUL', 'SUBSTITUTION', 'SHOOTOUT_KICK') THEN
    IF NOT coalesce(p_event -> 'teamId' IN (to_jsonb(p_ctx ->> 'teamAId'), to_jsonb(p_ctx ->> 'teamBId')), false) THEN
      RETURN false;
    END IF;
  END IF;

  -- RETRACT und AMEND (C0a): targetId Pflicht (TS `!event.targetId`).
  IF v_type IN ('RETRACT', 'AMEND') AND NOT match_engine.truthy(p_event -> 'targetId') THEN
    RETURN false;
  END IF;

  -- TS: `event.clockMs === null` -- nur ein explizites JSON-null ist ungueltig.
  IF v_type = 'CLOCK_ADJUST' AND coalesce(p_event -> 'clockMs' = 'null'::jsonb, false) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- ============================================================================================
-- 2b. apply_result_entry: Uhr anhalten, Pause schliessen (Fassung 20261110_005 + Review M2)
-- ============================================================================================

CREATE OR REPLACE FUNCTION match_engine.apply_result_entry(p_state jsonb, p_event jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT p_state || jsonb_build_object(
    'overrides', (p_state -> 'overrides') || jsonb_build_array(jsonb_build_object(
      'id', p_event -> 'id',
      -- A-25n (@W2A-022): mit `forfeit` eine Nichtantritt-Wertung (handlers/correction.ts applyResultEntry).
      'kind', CASE WHEN (p_event -> 'payload') ? 'forfeit' THEN 'forfeit' ELSE 'direct' END,
      'scores', p_event -> 'payload' -> 'scores',
      'snapshot', match_engine.snapshot(p_state, p_ctx),
      'seq', p_state -> 'nextSeq')
      -- A-25a (@FU-094): Strafstossergebnis nur, wenn eingetragen (kein null-Schluessel, sonst weicht
      -- der Zustand von TS ab -- handlers/correction.ts applyResultEntry).
      || CASE WHEN (p_event -> 'payload') ? 'shootout'
              THEN jsonb_build_object('shootout', p_event -> 'payload' -> 'shootout') ELSE '{}'::jsonb END
      -- A-25n: wer fehlte, nur bei einer Wertung (sonst kein Schluessel, wie TS).
      || CASE WHEN (p_event -> 'payload') ? 'forfeit'
              THEN jsonb_build_object('absent', p_event -> 'payload' -> 'forfeit' -> 'absent') ELSE '{}'::jsonb END),
    -- Spiel beenden (20261110_009, Review M2): Uhr anhalten, eine offene Pause ist zu (fuer 'scheduled' wirkungsgleich,
    -- stop_clock laesst eine stehende Uhr unveraendert; handlers/correction.ts applyResultEntry).
    'clock', match_engine.stop_clock(p_state -> 'clock', p_event),
    'breakStartedAt', NULL,
    'nextSeq', (p_state -> 'nextSeq')::numeric + 1,
    'finishedAt', match_engine.num(p_event -> 'at'),
    'lastScoreEventId', p_event -> 'id');
$$;

-- ============================================================================================
-- 2c. apply_effect: Wertung nur aus 'scheduled', basedOn-Pflicht aus angepfiffenen Zustaenden (20261110_005 + M1, M4)
-- ============================================================================================

CREATE OR REPLACE FUNCTION match_engine.apply_effect(p_state jsonb, p_event jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rules jsonb;
  v_mode text;
  v_clock jsonb;
  v_undo jsonb := coalesce(p_state -> 'undo', '{"acceptedBeforeStart": 0, "clockAdjusts": []}'::jsonb);
  v_before numeric;
  c_continue_window_ms constant bigint := 120000;
BEGIN
  CASE p_event ->> 'type'
    WHEN 'MATCH_START' THEN
      v_rules := p_event -> 'payload' -> 'rules';
      v_clock := match_engine.start_clock(p_event);
      RETURN match_engine.ok(p_state || jsonb_build_object(
        'rules', v_rules,
        'tiebreakMode', coalesce(v_rules -> 'tiebreak', 'null'::jsonb),
        'phase', 'regular',
        'section', 1,
        'clock', v_clock,
        -- C0a (V2): Abschnittsuhr beginnt beim Uhrstand des Anpfiffs.
        'sectionStartMs', v_clock -> 'elapsedMs',
        'breakStartedAt', NULL,
        -- ZA-3 (@SL-066): was vor dem Anpfiff schon im Log stand; Korrekturen gelten je Anpfiff.
        -- A-25n (Review M1, @SL-074/@SL-075): "Spiel fortsetzen" ebenso je Anpfiff -- REOPEN davor zaehlen nicht.
        'undo', jsonb_build_object(
          'acceptedBeforeStart', (SELECT count(*) FROM jsonb_object_keys(coalesce(p_state -> 'accepted', '{}'::jsonb))),
          'reopensBeforeStart', (SELECT count(*) FROM jsonb_each(coalesce(p_state -> 'accepted', '{}'::jsonb)) AS a(k, v)
                                  WHERE a.v ->> 'type' = 'REOPEN'),
          'clockAdjusts', '[]'::jsonb)));
    WHEN 'PAUSE', 'MATCH_END' THEN
      RETURN match_engine.ok(jsonb_set(p_state, '{clock}', match_engine.stop_clock(p_state -> 'clock', p_event)));
    WHEN 'RESUME' THEN
      RETURN match_engine.ok(jsonb_set(p_state, '{clock}', match_engine.resume_clock(p_state -> 'clock', p_event)));
    WHEN 'REOPEN' THEN
      -- B-U11: nach Strafstossschiessen nicht wiedereroeffnen (Leitung korrigiert per CORRECTION).
      IF p_state ->> 'phase' = 'shootout' THEN
        RETURN match_engine.reject('INVALID_TRANSITION', '{"reason": "SHOOTOUT_FINISHED"}'::jsonb);
      END IF;
      -- ZA-3 (@SL-074/@SL-075, @HE-042): "Spiel fortsetzen" fuer Helfer -- Ende durch die
      -- Spielende-Pruefung, einmal je Spiel, hoechstens 120 s nach dem Abpfiff (handlers/reopen.ts).
      -- Die Turnierleitung oeffnet ohne Frist wieder. `at` ist am Server die geklemmte Serverzeit (S11).
      IF p_event -> 'actor' IS DISTINCT FROM '"leitung"'::jsonb THEN
        -- Fixrunde 1 (W2, @SL-146): Ende durch Ablauf = Uhr beim Spielende >= Ende des Abschnitts
        -- (sectionStartMs + sectionSeconds*1000, in der Verlaengerung overtimeSeconds); Abpfiff von Hand nicht.
        IF jsonb_typeof(p_state -> 'baseDecidedBy') IS DISTINCT FROM 'string'
           OR jsonb_typeof(p_state -> 'finishedAt') IS DISTINCT FROM 'number'
           OR jsonb_typeof(p_state -> 'rules') IS DISTINCT FROM 'object'
           OR match_engine.num(p_state -> 'clock' -> 'elapsedMs')
              < match_engine.num(p_state -> 'sectionStartMs')
                + 1000 * match_engine.num(p_state -> 'rules' -> (CASE WHEN p_state ->> 'phase' = 'overtime'
                                                                      THEN 'overtimeSeconds' ELSE 'sectionSeconds' END)) THEN
          RETURN match_engine.reject('FORBIDDEN_ACTOR', '{"reason": "NOT_ENDED_BY_CLOCK"}'::jsonb);
        END IF;
        -- A-25n (Review M1): einmal je Anpfiff -- nur ein REOPEN nach dem letzten Anpfiff zaehlt (undo.reopensBeforeStart);
        -- die Ruecknahme einer Wertung davor verbraucht das Fortsetzen nicht (handlers/reopen.ts acceptedReopenCount).
        IF (SELECT count(*) FROM jsonb_each(coalesce(p_state -> 'accepted', '{}'::jsonb)) AS a(k, v)
             WHERE a.v ->> 'type' = 'REOPEN') > coalesce(match_engine.num(v_undo -> 'reopensBeforeStart'), 0) THEN
          RETURN match_engine.reject('FORBIDDEN_ACTOR', '{"reason": "ALREADY_CONTINUED"}'::jsonb);
        END IF;
        IF match_engine.num(p_event -> 'at') - match_engine.num(p_state -> 'finishedAt') > c_continue_window_ms THEN
          RETURN match_engine.reject('FORBIDDEN_ACTOR', '{"reason": "CONTINUE_WINDOW_EXPIRED"}'::jsonb);
        END IF;
      END IF;
      -- A-25n (@W2A-026, R-GA4-4): ist die letzte Ueberschreibung eine Nichtantritt-Wertung, nimmt REOPEN sie
      -- zurueck -- Spiel wieder 'scheduled', Wertung vom Stapel, Uhr unveraendert (eine Wertung entsteht nur aus
      -- 'scheduled'), lastScoreEventId = REOPEN (handlers/reopen.ts). Helfer scheitern vorher (kein baseDecidedBy).
      -- Den Zielzustand setzt die Wirkung selbst: Uebergangszeile finished -> '@reopen' (match_apply_event).
      IF coalesce(p_state -> 'overrides', '[]'::jsonb) -> -1 ->> 'kind' = 'forfeit' THEN
        RETURN match_engine.ok(p_state || jsonb_build_object(
          'status', 'scheduled',
          'overrides', (p_state -> 'overrides') - (-1),
          'finishedAt', NULL,
          'baseDecidedBy', NULL,
          'breakStartedAt', NULL,
          'lastScoreEventId', p_event -> 'id'));
      END IF;
      -- C0a (V2): sectionStartMs bleibt, eine Pause ist nach REOPEN nicht offen.
      RETURN match_engine.ok(p_state || jsonb_build_object(
        'status', 'running',
        'clock', match_engine.resume_clock(p_state -> 'clock', p_event),
        'finishedAt', NULL,
        'baseDecidedBy', NULL,
        'breakStartedAt', NULL));
    WHEN 'CLOCK_ADJUST' THEN
      -- ZA-3 (@SL-109): Wirkung merken (deltaMs = neu - Spielzeit bei `at`), damit RETRACT sie umkehrt.
      v_clock := match_engine.adjust_clock(p_state -> 'clock', p_event);
      v_before := match_engine.num(p_state -> 'clock' -> 'elapsedMs')
        + CASE WHEN (p_state -> 'clock' -> 'running')::boolean
               THEN match_engine.num(p_event -> 'at')
                    - coalesce(match_engine.num(p_state -> 'clock' -> 'anchorAt'), match_engine.num(p_event -> 'at'))
               ELSE 0 END;
      RETURN match_engine.ok(p_state || jsonb_build_object(
        'clock', v_clock,
        'undo', v_undo || jsonb_build_object('clockAdjusts', coalesce(v_undo -> 'clockAdjusts', '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object(
               'id', p_event -> 'id',
               'deltaMs', match_engine.num(v_clock -> 'elapsedMs') - v_before,
               'section', p_state -> 'section',
               'phase', p_state -> 'phase')))));
    WHEN 'GOAL', 'OWN_GOAL' THEN
      RETURN match_engine.ok(match_engine.apply_goal(p_state, p_event, p_ctx));
    WHEN 'RETRACT' THEN
      RETURN match_engine.apply_retract(p_state, p_event, p_ctx);
    WHEN 'CORRECTION' THEN
      RETURN match_engine.apply_correction(p_state, p_event, p_ctx);
    WHEN 'SECTION_END' THEN
      RETURN match_engine.apply_section_end(p_state, p_event);
    WHEN 'SECTION_START' THEN
      RETURN match_engine.ok(match_engine.apply_section_start(p_state, p_event));
    WHEN 'TIEBREAK_CHOICE' THEN
      v_mode := CASE p_event -> 'payload' ->> 'choice'
        WHEN 'overtime' THEN 'overtime-then-shootout'
        WHEN 'goldenGoal' THEN 'goldenGoal'
        ELSE 'shootout'
      END;
      RETURN match_engine.ok(match_engine.enter_decision(p_state || jsonb_build_object('tiebreakMode', v_mode), v_mode,
                                                         match_engine.num(p_event -> 'at')));
    WHEN 'SHOOTOUT_KICK' THEN
      RETURN match_engine.apply_shootout_kick(p_state, p_event, p_ctx);
    WHEN 'SHOOTOUT_END' THEN
      RETURN match_engine.apply_shootout_end(p_state, p_event, p_ctx);
    WHEN 'RESULT_ENTRY' THEN
      -- Spiel beenden (20261110_009, @FU-112/@FU-114): aus einem angepfiffenen Zustand (Uebergaenge nur fuer die Leitung)
      -- gilt zusaetzlich (handlers/correction.ts applyResultEntry): Review M1 (@FU-119) eine Wertung nur aus 'scheduled';
      -- Review M4 (@FU-116) basedOn ist Pflicht und muss dem letzten Spielstand-Eintrag entsprechen (wie CORRECTION).
      IF p_state ->> 'status' <> 'scheduled' THEN
        IF (p_event -> 'payload') ? 'forfeit' THEN
          RETURN match_engine.reject('INVALID_TRANSITION', '{"reason": "FORFEIT_NOT_SCHEDULED"}'::jsonb);
        END IF;
        IF (p_event -> 'payload' -> 'basedOn') IS DISTINCT FROM coalesce(p_state -> 'lastScoreEventId', 'null'::jsonb) THEN
          RETURN match_engine.reject('STALE_BASE', match_engine.stale_base_detail(p_state, p_ctx));
        END IF;
      END IF;
      RETURN match_engine.ok(match_engine.apply_result_entry(p_state, p_event, p_ctx));
    WHEN 'AMEND' THEN
      RETURN match_engine.apply_amend(p_state, p_event);
    WHEN 'SKIP' THEN
      -- Fixrunde 1 (Review M2, PC6): Zeitpunkt und Grund fuer cache_columns (skipped_at/
      -- skipped_reason). Nur SQL-intern -- TS liest dasselbe aus dem angenommenen SKIP in
      -- state.accepted (client/cacheColumns.ts); SQL fuehrt in accepted kein `at`.
      RETURN match_engine.ok(p_state || jsonb_build_object(
        'skippedAt', match_engine.num(p_event -> 'at'),
        'skipReason', CASE WHEN jsonb_typeof(p_event -> 'payload' -> 'reason') = 'string'
                           THEN p_event -> 'payload' -> 'reason' ELSE 'null'::jsonb END));
    WHEN 'UNSKIP' THEN
      RETURN match_engine.ok(p_state || '{"skippedAt": null, "skipReason": null}'::jsonb);
    ELSE
      -- Karten/Zeitstrafe/Foul/Wechsel (nur TS-Listen, R18).
      RETURN match_engine.ok(p_state);
  END CASE;
END;
$$;

-- ============================================================================================
-- 3. append_match_events: c3-Ausnahme fuer das Beenden durch die Leitung (Fassung 20261110_005 + Review M3)
-- ============================================================================================

CREATE OR REPLACE FUNCTION public.append_match_events(p_match_id uuid, p_events jsonb,
                                                      p_client_format integer, p_device_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_cascade_types constant text[] := ARRAY['MATCH_START', 'RESUME', 'SECTION_START', 'REOPEN', 'UNSKIP'];
  v_uid uuid := auth.uid();
  v_min_format integer;
  v_tournament_id uuid;
  v_actor text;
  v_match public.matches%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_ctx jsonb;
  v_transitions jsonb;
  v_stored jsonb;
  v_state jsonb;
  v_base_seq bigint;
  v_last_at bigint;
  v_now timestamptz;
  v_now_ms bigint;
  v_results jsonb := '[]'::jsonb;
  v_cascade boolean := false;
  v_raw jsonb;
  v_raw_type text;
  v_event jsonb;
  v_result_id jsonb;
  v_result jsonb;
  v_existing record;
  v_at_server bigint;
  v_at_eval bigint;
  v_phase_before text;
  v_step jsonb;
  v_seq bigint;
  v_accepted integer := 0;
  v_started_now boolean := false;
  v_cache jsonb;
  v_stored_count integer;
  -- ZA-3 Fixrunde 1 (W1, @SL-147): Fristen zusaetzlich an der Serveruhr, mit Nachsende-Spielraum.
  -- Gleiche Werte in TS: handlers/reopen.ts (CONTINUE_WINDOW_MS, SERVER_CLOCK_TOLERANCE_MS),
  -- handlers/retract.ts (MATCH_START_UNDO_MS).
  c_continue_window_ms constant bigint := 120000;
  c_match_start_undo_ms constant bigint := 30000;
  c_server_clock_tolerance_ms constant bigint := 600000;
  v_server_reject jsonb;
  v_server_mark timestamptz;
  -- A-25a (@FU-094, R-A25a-1): K.-o.-Kennzeichen aus derselben Quelle wie die Regeln beim Anpfiff.
  v_knockout boolean;
  v_shootout_violation text;
  -- A-34 (Steuer je Feld, brief-A-34.md): Zeile des Feldes dieses Spiels, fuer den ganzen Aufruf gesperrt.
  c_live_states constant text[] := ARRAY['running', 'paused', 'section_break', 'decision_pending', 'shootout'];
  v_fc public.field_control%ROWTYPE;
  v_claim_pending boolean;
  v_claimed_in_call boolean := false;
  v_control_reject jsonb;
  v_epoch_sent integer;
  -- A-25n (R-A25b-1): REOPEN, das eine Nichtantritt-Wertung zuruecknimmt (Spiel wird wieder 'scheduled', nicht laufend).
  v_forfeit_reopen boolean;
  -- Spiel beenden (20261110_009, Review M3): Ergebnis der Turnierleitung in ein angepfiffenes Spiel -- ohne Feldsteuerung.
  v_end_by_lead boolean;
BEGIN
  -- 1. Aufrufer, Eingabe, Client-Format.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'append_match_events: nicht angemeldet (auth.uid() ist NULL)' USING ERRCODE = '42501';
  END IF;
  IF p_events IS NULL OR jsonb_typeof(p_events) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'append_match_events: p_events muss ein jsonb-Array sein' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_events) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'append_match_events: p_events braucht 1 bis 200 Ereignisse (war: %)', jsonb_array_length(p_events)
      USING ERRCODE = '22023';
  END IF;

  SELECT CASE WHEN jsonb_typeof(c.value) = 'number' THEN c.value::numeric::integer END
    INTO v_min_format
    FROM public.app_config c
   WHERE c.key = 'min_client_format';
  v_min_format := coalesce(v_min_format, 1);
  IF p_client_format IS NULL OR p_client_format < v_min_format THEN
    RETURN jsonb_build_object('error', 'CLIENT_OUTDATED', 'minClientFormat', v_min_format,
                              'serverTime', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint);
  END IF;

  -- 2./3. Spiel und Akteursklasse (R7). Rechtepruefung VOR der Sperre: wer kein Recht hat, darf
  -- das Spiel auch nicht sperren. Fixrunde 1 (M3, M6): ein nicht existierendes Spiel und ein
  -- soft-geloeschtes Turnier (tournaments.deleted_at) ergeben dieselbe Antwort wie ein fehlendes
  -- Recht -- kein Existenz-Orakel, kein Schreiben in den Papierkorb.
  SELECT m.tournament_id INTO v_tournament_id
    FROM public.matches m
    JOIN public.tournaments t ON t.id = m.tournament_id
   WHERE m.id = p_match_id
     AND t.deleted_at IS NULL;

  IF v_tournament_id IS NOT NULL AND public.has_tournament_permission(v_tournament_id, 'leadMatches') THEN
    v_actor := 'leitung';
  ELSIF v_tournament_id IS NOT NULL AND public.has_tournament_permission(v_tournament_id, 'writeMatchData') THEN
    v_actor := 'helper';
  ELSE
    SELECT jsonb_agg(jsonb_build_object(
             'id', coalesce(to_jsonb(match_engine.normalize_uuid(e -> 'id')), e -> 'id', 'null'::jsonb),
             'status', 'rejected', 'code', 'FORBIDDEN_ACTOR') ORDER BY ord)
      INTO v_results
      FROM jsonb_array_elements(p_events) WITH ORDINALITY AS x(e, ord);
    RETURN jsonb_build_object('results', v_results, 'state', NULL,
                              'serverTime', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint);
  END IF;

  -- R12/R3: ein Spiel je Aufruf, Geraete werden je Spiel serialisiert.
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;
  IF v_match.id IS NULL OR v_tournament.deleted_at IS NOT NULL THEN
    -- Zwischen Rechtepruefung und Sperre geloescht (sehr selten): nichts schreiben.
    RAISE EXCEPTION 'append_match_events: Spiel % nicht mehr beschreibbar', p_match_id USING ERRCODE = '55000';
  END IF;
  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN
    RAISE EXCEPTION 'append_match_events: Spiel % hat noch keine zwei Teams', p_match_id USING ERRCODE = '22023';
  END IF;

  -- Serverzeit NACH der Sperre: ein wartender Aufruf klemmt nicht hinter einen spaeter
  -- gespeicherten Vorgaenger.
  v_now := clock_timestamp();
  v_now_ms := floor(extract(epoch FROM v_now) * 1000)::bigint;
  v_ctx := jsonb_build_object('matchId', p_match_id::text,
                              'teamAId', v_match.team_a_id::text,
                              'teamBId', v_match.team_b_id::text);

  -- A-34 c0: Zeile des Feldes sperren. Mit Geraete-ID vorher anlegen (frei, Epoche 0), damit zwei gleichzeitige
  -- Erst-Ansprueche auf dasselbe Feld sich an dieser Zeile anstellen (@FU-030: genau ein Geraet steuert). Ohne
  -- Geraete-ID (App vor B-49) entsteht keine Zeile; eine bestehende wird trotzdem gesperrt und geprueft.
  IF p_device_id IS NOT NULL THEN
    INSERT INTO public.field_control (tournament_id, field, epoch)
    VALUES (v_match.tournament_id, v_match.field, 0)
    ON CONFLICT (tournament_id, field) DO NOTHING;
  END IF;
  SELECT * INTO v_fc FROM public.field_control
   WHERE tournament_id = v_match.tournament_id AND field = v_match.field
     FOR UPDATE;

  -- 4. Aktueller Zustand: gespeicherte Engine-Ereignisse, genau wie compute_match_state sie liest
  -- (S1 actor = leitung, S2 at aus client_time), aber im Definer-Kontext (alle Zeilen).
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'from', t.from_status, 'type', t.event_type, 'actor', t.actor, 'to', t.to_status)
           ORDER BY t.from_status, t.event_type), '[]'::jsonb)
    INTO v_transitions
    FROM public.match_transitions t;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id::text,
           'type', e.type,
           'actor', 'leitung',
           'at', floor(extract(epoch FROM coalesce(e.client_time, e.recorded_at)) * 1000)::bigint,
           'section', e.section,
           'clockMs', e.clock_ms,
           'teamId', e.team_id::text,
           'targetId', e.target_event_id::text,
           'payload', e.payload) ORDER BY e.seq), '[]'::jsonb)
    INTO v_stored
    FROM public.match_events e
   WHERE e.match_id = p_match_id
     AND e.event_format IS NOT NULL
     AND e.review_state IS NULL;

  v_last_at := (SELECT (x.e ->> 'at')::bigint FROM jsonb_array_elements(v_stored) WITH ORDINALITY AS x(e, ord)
                ORDER BY x.ord DESC LIMIT 1);
  SELECT coalesce(max(e.seq), 0) INTO v_base_seq FROM public.match_events e WHERE e.match_id = p_match_id;

  v_stored_count := jsonb_array_length(v_stored);

  -- Einmal reduzieren, danach je Ereignis anschliessen (B3a-Review M3).
  v_state := public.match_reduce(v_stored, v_ctx, v_transitions, 'log') -> 'state';

  -- 5. Je Ereignis in Array-Reihenfolge.
  FOR v_raw IN
    SELECT x.e FROM jsonb_array_elements(p_events) WITH ORDINALITY AS x(e, ord) ORDER BY x.ord
  LOOP
    v_raw_type := CASE WHEN jsonb_typeof(v_raw) = 'object' AND jsonb_typeof(v_raw -> 'type') = 'string'
                       THEN v_raw ->> 'type' END;
    -- a. Umschlag (S9/S10).
    v_event := match_engine.envelope(v_raw, v_ctx ->> 'teamAId', v_ctx ->> 'teamBId');
    v_result_id := coalesce(v_event -> 'id',
                            CASE WHEN jsonb_typeof(v_raw) = 'object' THEN v_raw -> 'id' END,
                            'null'::jsonb);

    IF v_cascade THEN
      v_result := jsonb_build_object('id', v_result_id, 'status', 'rejected', 'code', 'DEPENDS_ON_REJECTED');
    ELSIF v_event IS NULL THEN
      v_result := jsonb_build_object('id', v_result_id, 'status', 'rejected', 'code', 'INVALID_PAYLOAD');
    ELSE
      -- b. Idempotenz (R11/K3) gegen die Tabelle.
      SELECT e.match_id, e.seq,
             match_engine.dedupe_key(jsonb_build_object(
               'type', e.type, 'teamId', e.team_id::text, 'targetId', e.target_event_id::text,
               'section', e.section, 'clockMs', e.clock_ms, 'payload', e.payload)) AS content
        INTO v_existing
        FROM public.match_events e
       WHERE e.id = (v_event ->> 'id')::uuid;

      IF FOUND THEN
        IF v_existing.match_id = p_match_id AND v_existing.content = match_engine.dedupe_key(v_event) THEN
          v_result := jsonb_build_object('id', v_event -> 'id', 'status', 'duplicate', 'seq', v_existing.seq);
        ELSE
          v_result := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'ID_CONFLICT');
        END IF;
      ELSE
        -- c. Zeit (R2, S11).
        v_at_server := greatest(coalesce(v_last_at, 0), least((v_event -> 'at')::numeric, v_now_ms))::bigint;
        v_at_eval := floor(extract(epoch FROM to_timestamp(v_at_server / 1000.0)) * 1000)::bigint;
        v_event := v_event || jsonb_build_object('at', v_at_eval, 'actor', v_actor);

        -- c3. A-34 Steuer je Feld (@FU-026, @FU-030, @SL-018, @SL-046, @FU-081): an einem laufenden Spiel und fuer
        -- Anpfiff/Wiedereroeffnen nimmt der Server nur Eintraege des steuernden Geraets an (Konto bzw. Geraetesitzung
        -- UND Geraete-ID). An nicht laufenden Spielen sonst keine Steuer (Auflage Bauplan § 20: Direkteintrag,
        -- Korrektur, Absetzen, Nachtrag). Reine Serverpruefung (kein TS-Zwilling), vor den Fristen c2 und der
        -- Rechenfunktion, nach der Idempotenz (ein Duplikat bleibt ein Duplikat).
        v_control_reject := NULL;
        v_claim_pending := false;
        -- A-25n (R-A25b-1, @W2A-026): das Zuruecknehmen einer Wertung startet kein Spiel (Ziel 'scheduled') -- es
        -- braucht keine Steuer, wie Direkteintrag und Korrektur an nicht laufenden Spielen (Auflage Bauplan § 20).
        v_forfeit_reopen := coalesce(v_event ->> 'type' = 'REOPEN' AND v_state ->> 'status' = 'finished'
                                     AND v_state -> 'overrides' -> -1 ->> 'kind' = 'forfeit', false);
        -- Spiel beenden (20261110_009, @FU-112, @FU-115, Review M3): die Turnierleitung beendet ein angepfiffenes Spiel mit
        -- ihrem Ergebnis auch, wenn ein anderes Geraet das Feld steuert -- VOR dem ganzen c3-Block: keine Ablehnung, kein
        -- Anspruch auf ein freies Feld, keine Epochen-Pruefung (der Halter bleibt). Nicht im Strafstossschiessen (@FU-118:
        -- dort gilt c3, die Rechenfunktion lehnt ohnehin ab); Helfer pruefen c3 und die Rechenfunktion (@FU-113).
        v_end_by_lead := coalesce(v_actor = 'leitung' AND v_event ->> 'type' = 'RESULT_ENTRY'
                                  AND v_state ->> 'status' IN ('running', 'paused', 'section_break', 'decision_pending'), false);
        IF NOT v_end_by_lead
           AND (v_state ->> 'status' = ANY (c_live_states)
                OR (v_event ->> 'type' IN ('MATCH_START', 'REOPEN') AND NOT v_forfeit_reopen)) THEN
          IF v_fc.holder_user_id IS NULL THEN
            -- Feld frei: mit Geraete-ID wird der Aufrufer Halter, sobald das Ereignis angenommen ist (f2);
            -- ohne Geraete-ID bleibt es frei und ungeprueft (brief-A-34 L7).
            v_claim_pending := p_device_id IS NOT NULL;
          ELSIF v_fc.holder_user_id = v_uid AND v_fc.holder_device_id = p_device_id THEN
            -- Halter: ein Eintrag aus einer frueheren Steuer-Epoche desselben Geraets zaehlt nicht. null = unbekannt
            -- (zaehlt); nach einem Anspruch in diesem Aufruf gehoeren die folgenden Ereignisse schon dazu.
            v_epoch_sent := (v_event ->> 'controlEpoch')::integer;
            IF NOT v_claimed_in_call AND v_epoch_sent IS NOT NULL AND v_epoch_sent <> v_fc.epoch THEN
              v_control_reject := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'NOT_CONTROLLER',
                'detail', jsonb_build_object('reason', 'STALE_EPOCH')
                          || public.field_control_info(v_match.tournament_id, v_match.field, p_device_id));
            END IF;
          ELSE
            v_control_reject := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'NOT_CONTROLLER',
              'detail', jsonb_build_object('reason', 'OTHER_DEVICE')
                        || public.field_control_info(v_match.tournament_id, v_match.field, p_device_id));
          END IF;
        END IF;

        -- c2. ZA-3 Fixrunde 1 (W1, @SL-147): `at` ist nur nach oben geklemmt -- ein zurueckdatiertes `at`
        -- hielte die Fristen sonst kuenstlich offen. Gemessen wird zusaetzlich die Serverzeit seit dem
        -- Eintreffen des Abpfiffs (Helfer-REOPEN) bzw. des Anpfiffs (RETRACT des Anpfiffs), mit Spielraum
        -- fuer das Nachsenden ohne Netz. Die Rechenfunktion kennt keine Serverzeit; die Pruefung gilt nur hier.
        v_server_reject := NULL;
        IF v_event ->> 'type' = 'REOPEN' AND v_actor = 'helper' THEN
          SELECT max(e.recorded_at) INTO v_server_mark FROM public.match_events e
           WHERE e.match_id = p_match_id AND e.event_format IS NOT NULL AND e.review_state IS NULL AND e.type = 'MATCH_END';
          IF v_server_mark IS NOT NULL
             AND v_now_ms - floor(extract(epoch FROM v_server_mark) * 1000)::bigint > c_continue_window_ms + c_server_clock_tolerance_ms THEN
            v_server_reject := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'FORBIDDEN_ACTOR',
                                                  'detail', '{"reason": "CONTINUE_WINDOW_EXPIRED"}'::jsonb);
          END IF;
        ELSIF v_event ->> 'type' = 'RETRACT'
              AND v_state -> 'accepted' -> (v_event ->> 'targetId') ->> 'type' = 'MATCH_START' THEN
          SELECT max(e.recorded_at) INTO v_server_mark FROM public.match_events e
           WHERE e.match_id = p_match_id AND e.event_format IS NOT NULL AND e.review_state IS NULL AND e.type = 'MATCH_START';
          IF v_server_mark IS NOT NULL
             AND v_now_ms - floor(extract(epoch FROM v_server_mark) * 1000)::bigint > c_match_start_undo_ms + c_server_clock_tolerance_ms THEN
            v_server_reject := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'INVALID_PAYLOAD');
          END IF;
        END IF;

        IF v_control_reject IS NOT NULL THEN
          v_result := v_control_reject;
        ELSIF v_server_reject IS NOT NULL THEN
          v_result := v_server_reject;
        ELSE
        -- d. Regeln setzt der Server (R4/R4b).
        IF v_event ->> 'type' = 'MATCH_START' THEN
          v_event := jsonb_set(v_event, '{payload,rules}', match_engine.server_rules(
            v_match.duration_minutes, v_match.phase, v_tournament.group_phase_duration,
            v_tournament.final_round_duration, v_tournament.config, v_tournament.finals_config,
            v_match.final_type));
        END IF;

        -- e. Rechenfunktion.
        v_phase_before := v_state ->> 'phase';
        v_step := public.match_continue(v_state, jsonb_build_array(v_event), v_ctx, v_transitions, 'log');
        v_result := v_step -> 'results' -> 0;

        -- e2. A-25a (@FU-094, R-A25a-1): ein Direkteintrag in ein K.-o.-Spiel braucht bei Gleichstand ein
        -- Strafstossergebnis, ein Gruppenspiel darf keins haben. Die Rechenfunktion prueft nur die Form
        -- (sie kennt ohne Anpfiff keine Regeln); die Regel gilt hier, NACH ihr (Rechte-, Feld- und
        -- Zustandspruefungen haben Vorrang) und VOR dem Speichern. Die Payload bleibt unveraendert
        -- (dedupe_key). Zwilling: src/core/match/resultEntryShootout.ts (Geraet vor dem Senden).
        IF v_result ->> 'status' = 'accepted' AND v_event ->> 'type' = 'RESULT_ENTRY' THEN
          v_knockout := coalesce((match_engine.server_rules(
            v_match.duration_minutes, v_match.phase, v_tournament.group_phase_duration,
            v_tournament.final_round_duration, v_tournament.config, v_tournament.finals_config,
            v_match.final_type) ->> 'knockout')::boolean, false);
          v_shootout_violation := CASE
            WHEN NOT v_knockout AND (v_event -> 'payload') ? 'shootout' THEN 'SHOOTOUT_NOT_ALLOWED'
            -- A-25n (R-A25b-2): eine Nichtantritt-Wertung braucht kein Strafstossergebnis (beide fehlen im K.-o.: 0:0).
            WHEN v_knockout AND NOT ((v_event -> 'payload') ? 'shootout') AND NOT ((v_event -> 'payload') ? 'forfeit')
                 AND (v_event -> 'payload' -> 'scores' -> (v_ctx ->> 'teamAId'))
                     = (v_event -> 'payload' -> 'scores' -> (v_ctx ->> 'teamBId')) THEN 'SHOOTOUT_REQUIRED'
          END;
          IF v_shootout_violation IS NOT NULL THEN
            v_result := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'INVALID_PAYLOAD',
                                           'detail', jsonb_build_object('reason', v_shootout_violation));
          END IF;
        END IF;

        IF v_result ->> 'status' = 'accepted' THEN
          -- f2. A-34: freies Feld -> dieses Geraet steuert ab jetzt (Epoche +1). Die Zeile ist seit c0 gesperrt.
          IF v_claim_pending THEN
            UPDATE public.field_control fc
               SET epoch = fc.epoch + 1, holder_user_id = v_uid, holder_device_id = p_device_id,
                   holder_device_label = NULL, claimed_at = v_now
             WHERE fc.tournament_id = v_match.tournament_id AND fc.field = v_match.field
               AND fc.holder_user_id IS NULL
            RETURNING * INTO v_fc;
            v_claimed_in_call := true;
          END IF;
          -- Ruling S15/M1: hoechstens 2000 gespeicherte Engine-Ereignisse je Spiel -- danach bricht
          -- der ganze Aufruf ab (nichts gespeichert), statt das Spiel ueber statement_timeout zu treiben.
          IF v_stored_count >= 2000 THEN
            RAISE EXCEPTION 'append_match_events: Spiel % hat bereits % gespeicherte Ereignisse (Obergrenze 2000)',
              p_match_id, v_stored_count USING ERRCODE = '54000';
          END IF;
          v_stored_count := v_stored_count + 1;
          v_state := v_step -> 'state';
          -- f. Speichern (R14, R16).
          INSERT INTO public.match_events (
            id, match_id, type, team_id, player_id, timestamp_seconds, period, payload,
            score_home, score_away, event_format, recorded_at, client_time, clock_ms, section,
            target_event_id, base_seq, control_epoch)
          VALUES (
            (v_event ->> 'id')::uuid, p_match_id, v_event ->> 'type', (v_event ->> 'teamId')::uuid, NULL,
            coalesce((v_event ->> 'clockMs')::numeric, 0) / 1000.0,
            CASE v_phase_before WHEN 'overtime' THEN 'overtime' WHEN 'shootout' THEN 'penalty' ELSE 'regular' END,
            v_event -> 'payload',
            match_engine.effective_score(v_state, v_ctx ->> 'teamAId')::integer,
            match_engine.effective_score(v_state, v_ctx ->> 'teamBId')::integer,
            1, v_now, to_timestamp(v_at_server / 1000.0),
            (v_event ->> 'clockMs')::integer, (v_event ->> 'section')::smallint,
            (v_event ->> 'targetId')::uuid, v_base_seq, (v_event ->> 'controlEpoch')::integer)
          RETURNING seq INTO v_seq;

          INSERT INTO public.match_event_authors (event_id, tournament_id, user_id, device_id, base_state)
          VALUES ((v_event ->> 'id')::uuid, v_match.tournament_id, v_uid, p_device_id,
                  nullif(v_event -> 'baseState', 'null'::jsonb));

          v_last_at := v_at_eval;
          v_accepted := v_accepted + 1;
          v_started_now := v_started_now OR v_event ->> 'type' = 'MATCH_START';
          v_result := v_result || jsonb_build_object('seq', v_seq);
        ELSIF v_result ->> 'status' = 'noop' THEN
          -- g. noop wird nie gespeichert (K7).
          v_state := v_step -> 'state';
        END IF;
        END IF;  -- c2 (Serveruhr)
      END IF;
    END IF;

    v_results := v_results || jsonb_build_array(v_result);
    -- R12: abgelehnter zustandsaendernder Schritt -> Rest des Stapels DEPENDS_ON_REJECTED.
    IF v_result ->> 'status' = 'rejected' AND v_raw_type = ANY (c_cascade_types) THEN
      v_cascade := true;
    END IF;
  END LOOP;

  -- 6. Zwischenspeicher einmal je Aufruf (R15).
  IF v_accepted > 0 THEN
    v_cache := match_engine.cache_columns(v_state, v_ctx);
    UPDATE public.matches m SET
      score_a = (v_cache ->> 'score_a')::numeric::integer,
      score_b = (v_cache ->> 'score_b')::numeric::integer,
      overtime_score_a = (v_cache ->> 'overtime_score_a')::numeric::integer,
      overtime_score_b = (v_cache ->> 'overtime_score_b')::numeric::integer,
      penalty_score_a = (v_cache ->> 'penalty_score_a')::numeric::integer,
      penalty_score_b = (v_cache ->> 'penalty_score_b')::numeric::integer,
      match_status = v_cache ->> 'match_status',
      decided_by = v_cache ->> 'decided_by',
      -- A-25n (@W2A-022): wer nicht angetreten ist (nur Wertung im beendeten Spiel, sonst NULL).
      forfeit_absent = v_cache ->> 'forfeit_absent',
      timer_elapsed_seconds = (v_cache ->> 'timer_elapsed_seconds')::numeric::integer,
      timer_start_time = CASE WHEN (v_cache ->> 'running')::boolean
                              THEN to_timestamp((v_cache ->> 'anchor_at')::numeric / 1000.0) END,
      -- Pausenbeginn: bleibt stehen, solange die Uhr schon vorher stand; sonst jetzt.
      timer_paused_at = CASE WHEN (v_cache ->> 'running')::boolean OR NOT (v_cache ->> 'started')::boolean THEN NULL
                             ELSE coalesce(CASE WHEN m.timer_start_time IS NULL THEN m.timer_paused_at END, v_now) END,
      -- ZA-3 (@SL-066): ein zurueckgenommener Anpfiff setzt auch den tatsaechlichen Beginn zurueck.
      actual_start = CASE WHEN v_cache ->> 'match_status' = 'scheduled' THEN NULL
                          WHEN v_started_now THEN coalesce(m.actual_start, v_now) ELSE m.actual_start END,
      actual_end = CASE WHEN v_cache ->> 'match_status' = 'finished'
                        THEN to_timestamp(coalesce((v_cache ->> 'finished_at')::numeric, v_now_ms) / 1000.0) END,
      -- M4 (Fixrunde 1): zusammenfuehren statt ueberschreiben -- fremde Schluessel des alten
      -- Schreibwegs (z. B. refereeName) bleiben erhalten. Nicht mehr aktiv -> NULL wie bisher.
      live_state = CASE WHEN jsonb_typeof(v_cache -> 'live_state') = 'object'
                        THEN CASE WHEN jsonb_typeof(m.live_state) = 'object' THEN m.live_state ELSE '{}'::jsonb END
                             || (v_cache -> 'live_state') END,
      -- C0b-Fixrunde 1 (Review M2, PC6): SKIP -> skipped_at = at_server des SKIP (ueber at_eval,
      -- dieselbe Rundreise wie client_time), skipped_reason = payload.reason; sonst (UNSKIP) NULL.
      skipped_at = CASE WHEN jsonb_typeof(v_cache -> 'skipped_at') = 'number'
                        THEN to_timestamp((v_cache ->> 'skipped_at')::numeric / 1000.0) END,
      skipped_reason = v_cache ->> 'skipped_reason',
      version = coalesce(m.version, 0) + 1,
      last_modified_by = v_uid,
      updated_at = v_now
    WHERE m.id = p_match_id;
  END IF;

  -- 7. Antwort.
  RETURN jsonb_build_object('results', v_results,
                            'state', public.match_server_state(v_state),
                            'serverTime', v_now_ms,
                            -- A-34: Stand des Feldes aus Sicht dieses Geraets (Epoche zum Stempeln, B-49).
                            'control', public.field_control_info(v_match.tournament_id, v_match.field, p_device_id));
END;
$$;

-- ============================================================================================
-- 4. Rechte (unveraendert, ausdruecklich wie 20261110_005)
-- ============================================================================================

REVOKE ALL ON FUNCTION
  match_engine.payload_valid(jsonb, jsonb),
  match_engine.apply_result_entry(jsonb, jsonb, jsonb),
  match_engine.apply_effect(jsonb, jsonb, jsonb)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  match_engine.payload_valid(jsonb, jsonb),
  match_engine.apply_result_entry(jsonb, jsonb, jsonb),
  match_engine.apply_effect(jsonb, jsonb, jsonb)
TO authenticated, anon, service_role;

REVOKE ALL ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) TO authenticated;

COMMIT;
