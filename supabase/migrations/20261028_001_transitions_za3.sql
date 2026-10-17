-- supabase/migrations/20261028_001_transitions_za3.sql
-- ZA-3 (MVP-Bauplan, brief-ZA-0-3.md inkl. "Delta nach ZA-0, 17.10."): Uebergaenge fuer "Spiel leiten" --
-- SQL-Zwilling der TS-Rechenfunktion (src/core/match/, TS ist die Referenz). Gleichlauf:
-- scripts/match-engine-parity.sh (alle __fixtures__/*.json und __fixtures__/rules/*.json, Seed-Gleichheit
-- match_transitions == matchTransitions.json), Schreibweg: scripts/append-match-events-check.sh.
--
-- Inhalt:
--   1. match_transitions: paused + GOAL/OWN_GOAL/FOUL (@SL-085), section_break + TIME_PENALTY (@SL-087),
--      finished/REOPEN Akteur helper (Spiel fortsetzen, @SL-074/@SL-075/@HE-042; die Grenzen prueft
--      apply_effect).
--   2. RETRACT: MATCH_START hoechstens 30 s danach und ohne weiteren Eintrag -> zurueck auf "geplant"
--      (@SL-066/@SL-067); CLOCK_ADJUST (nur die letzte, im selben Abschnitt) -> Spielzeit ohne Korrektur
--      (@SL-109). retract_target_admissible bekommt das Ereignis (neue Signatur, alte entfaellt),
--      apply_retract die zwei Wirkungen.
--   3. apply_effect: MATCH_START merkt `undo.acceptedBeforeStart`, CLOCK_ADJUST merkt `undo.clockAdjusts`
--      (Wirkung deltaMs), REOPEN fuer Helfer nur nach Ende durch die Spielende-Pruefung, einmal,
--      hoechstens 120 s nach dem Abpfiff, nie nach Strafstossschiessen; Turnierleitung ohne Frist.
--   4. server_rules(+ p_final_type): Entscheidungsart je Runde (tiebreakerByRound), Platzierungsspiele
--      ueber final_type (placement -> final), alte globale Regel nur fuer Altdaten, Rueckfall
--      'overtime-then-shootout' (E1, @SL-145, @W2A-007, @W2A-039; Befund C-KO-RUNDENREGEL-SERVER).
--   5. append_match_events: ruft server_rules mit matches.final_type; actual_start wird NULL, wenn das
--      Spiel nach einem zurueckgenommenen Anpfiff wieder "geplant" ist. Fixrunde 1 (W1, @SL-147): Helfer-REOPEN
--      und RETRACT des Anpfiffs zusaetzlich an der Serveruhr (recorded_at des Abpfiffs/Anpfiffs) mit 10 min
--      Nachsende-Spielraum. apply_effect: Helfer-REOPEN nur nach Ende durch Ablauf (W2, @SL-146).
--   6. Rechte wie bisher (Engine-Teilfunktionen: anon/authenticated/service_role; server_rules
--      definer-only; append_match_events nur authenticated).
--
-- Neu angelegte bzw. ersetzte Funktionen (fuer A-25a, das auf ZA-3 stapelt):
--   NEU (Signatur): match_engine.retract_target_admissible(jsonb, text, text, jsonb)
--                   match_engine.server_rules(integer, text, integer, integer, jsonb, jsonb, text)
--   ENTFERNT:       match_engine.retract_target_admissible(jsonb, text, text)
--                   match_engine.server_rules(integer, text, integer, integer, jsonb, jsonb)
--   ERSETZT:        match_engine.apply_retract(jsonb, jsonb, jsonb)
--                   match_engine.apply_effect(jsonb, jsonb, jsonb)
--                   public.append_match_events(uuid, jsonb, integer, uuid)
--   Funktionszahl der Engine bleibt 52 (zwei Signaturen getauscht, keine neue Funktion).
--
-- Idempotent: INSERT ... ON CONFLICT DO NOTHING, UPDATE auf einen festen Zielwert, DROP FUNCTION IF EXISTS,
-- CREATE OR REPLACE, REVOKE/GRANT. Portabel: reines SQL, keine Cloud-Funktionen.
--
-- RUECKWEG (eigene Datei, z. B. <Datum>_<NNN>_transitions_za3_rollback.sql; in EINEM Block):
--   BEGIN; SET LOCAL lock_timeout = '5s';
--   -- a) Uebergaenge zurueck (nur, solange keine solche Zeile in match_events steht -- sonst rechnet
--   --    compute_match_state alte Spiele anders; vorher pruefen:
--   --    SELECT count(*) FROM public.match_events e
--   --      LEFT JOIN public.match_events t ON t.id = e.target_event_id
--   --     WHERE e.event_format IS NOT NULL
--   --       AND (e.type IN ('GOAL','OWN_GOAL','FOUL','TIME_PENALTY','REOPEN')
--   --            OR (e.type = 'RETRACT' AND t.type IN ('MATCH_START','CLOCK_ADJUST')));
--   --    und Fall fuer Fall ansehen; RETRACT auf Anpfiff/Uhr-Korrektur rechnet die alte Engine als INVALID_PAYLOAD):
--   DELETE FROM public.match_transitions WHERE (from_status, event_type) IN
--     (('paused','GOAL'), ('paused','OWN_GOAL'), ('paused','FOUL'), ('section_break','TIME_PENALTY'));
--   UPDATE public.match_transitions SET actor = 'leitung' WHERE from_status = 'finished' AND event_type = 'REOPEN';
--   -- b) Funktionen: neue Signaturen entfernen, alte Fassungen wieder einspielen
--   DROP FUNCTION IF EXISTS match_engine.retract_target_admissible(jsonb, text, text, jsonb);
--   DROP FUNCTION IF EXISTS match_engine.server_rules(integer, text, integer, integer, jsonb, jsonb, text);
--   -- dann woertlich (mit Rechten) aus dem Repo: retract_target_admissible + apply_retract aus
--   -- 20260928_002_match_engine.sql, server_rules aus 20260928_003_append_match_events.sql,
--   -- apply_effect + append_match_events aus 20261001_001_amend_event.sql (Abschnitte 3e/4b + 6).
--   COMMIT;
--   Danach Drift-Check; Client-Stand vor ZA-3 ausliefern (sonst Abweichung TS != SQL bei REOPEN/RETRACT).
--
-- Produktion: nur im DB-Fenster F2 durch den Controller nach Daniels Freigabe des woertlichen SQL
-- (ZA-3-sql-freigabe.md), danach Drift-Rerun, Merge, Deploy. Dieser Branch spielt nichts ein.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ============================================================================================
-- 0. Voraussetzungen (Fail-fast)
-- ============================================================================================

DO $$
BEGIN
  IF to_regclass('public.match_transitions') IS NULL
     OR to_regprocedure('match_engine.apply_amend(jsonb,jsonb)') IS NULL
     OR to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)') IS NULL
     OR to_regprocedure('match_engine.adjust_clock(jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION '20261028_001_transitions_za3: Rechenfunktion/Schreibweg fehlen -- zuerst 20260928_001..003 und 20261001_001 einspielen';
  END IF;
END;
$$;


-- ============================================================================================
-- 1. match_transitions -- exakt src/core/match/matchTransitions.json
-- ============================================================================================

INSERT INTO "public"."match_transitions" ("from_status", "event_type", "actor", "to_status") VALUES
  ('paused', 'GOAL', 'helper', '='),
  ('paused', 'OWN_GOAL', 'helper', '='),
  ('paused', 'FOUL', 'helper', '='),
  ('section_break', 'TIME_PENALTY', 'helper', '=')
ON CONFLICT ("from_status", "event_type") DO NOTHING;

UPDATE "public"."match_transitions" SET "actor" = 'helper'
 WHERE "from_status" = 'finished' AND "event_type" = 'REOPEN' AND "actor" IS DISTINCT FROM 'helper';

-- ============================================================================================
-- 2. RETRACT: Anpfiff (@SL-066/@SL-067) und Uhr-Korrektur (@SL-109) -- handlers/retract.ts
-- ============================================================================================

-- Alte Signatur (ohne Ereignis) entfaellt: die Anpfiff-Regel braucht `at` des RETRACT.
DROP FUNCTION IF EXISTS match_engine.retract_target_admissible(jsonb, text, text);

CREATE OR REPLACE FUNCTION match_engine.retract_target_admissible(p_state jsonb, p_target_id text, p_target_type text,
                                                              p_event jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text := p_state ->> 'status';
  v_undo jsonb := coalesce(p_state -> 'undo', '{"acceptedBeforeStart": 0, "clockAdjusts": []}'::jsonb);
  v_adjusts jsonb;
  v_index bigint;
  v_record jsonb;
BEGIN
  IF p_target_type NOT IN ('MATCH_START', 'CLOCK_ADJUST', 'GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD', 'TIME_PENALTY',
                           'FOUL', 'SUBSTITUTION', 'CORRECTION', 'SHOOTOUT_KICK') THEN
    RETURN false;
  END IF;
  IF v_status = 'shootout' THEN
    RETURN p_target_type = 'SHOOTOUT_KICK';
  END IF;
  IF p_target_type = 'SHOOTOUT_KICK' THEN
    RETURN false;
  END IF;
  -- ZA-3 (@SL-066/@SL-067): Anpfiff nur, solange danach nichts im Log steht und hoechstens 30 s
  -- vergangen sind. Ohne weiteres Ereignis ist clock.anchorAt der Zeitpunkt des Anpfiffs (accepted
  -- fuehrt hier kein `at`) -- dieselbe Quelle wie retract.ts#isMatchStartUndoable.
  IF p_target_type = 'MATCH_START' THEN
    RETURN (SELECT count(*) FROM jsonb_object_keys(coalesce(p_state -> 'accepted', '{}'::jsonb)))
             = coalesce(match_engine.num(v_undo -> 'acceptedBeforeStart'), 0) + 1
       AND jsonb_typeof(p_state -> 'clock' -> 'anchorAt') = 'number'
       AND match_engine.num(p_event -> 'at') - match_engine.num(p_state -> 'clock' -> 'anchorAt') <= 30000;
  END IF;
  -- ZA-3 (@SL-109): Uhr-Korrektur nur, wenn danach keine andere (nicht zurueckgenommene) Korrektur
  -- kam und Abschnitt/Phase noch dieselben sind (retract.ts#isClockAdjustUndoable).
  IF p_target_type = 'CLOCK_ADJUST' THEN
    IF v_status NOT IN ('running', 'paused') THEN
      RETURN false;
    END IF;
    v_adjusts := coalesce(v_undo -> 'clockAdjusts', '[]'::jsonb);
    SELECT x.ord, x.r INTO v_index, v_record
      FROM jsonb_array_elements(v_adjusts) WITH ORDINALITY AS x(r, ord)
     WHERE x.r ->> 'id' = p_target_id ORDER BY x.ord LIMIT 1;
    IF v_record IS NULL THEN
      RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_adjusts) WITH ORDINALITY AS y(r, ord)
                WHERE y.ord > v_index AND NOT ((p_state -> 'retracted') ? (y.r ->> 'id'))) THEN
      RETURN false;
    END IF;
    RETURN match_engine.num(v_record -> 'section') = match_engine.num(p_state -> 'section')
       AND v_record ->> 'phase' = p_state ->> 'phase';
  END IF;
  IF p_target_type NOT IN ('GOAL', 'OWN_GOAL') THEN
    RETURN true;
  END IF;
  IF v_status = 'finished' THEN
    RETURN false;
  END IF;
  IF p_state ->> 'phase' = 'overtime' THEN
    IF v_status = 'section_break' THEN
      RETURN false;
    END IF;
    RETURN (SELECT g ->> 'phase' FROM jsonb_array_elements(p_state -> 'goals') WITH ORDINALITY AS x(g, ord)
            WHERE g ->> 'id' = p_target_id ORDER BY ord LIMIT 1) IS DISTINCT FROM 'regular';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION match_engine.apply_retract(p_state jsonb, p_event jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_id text := p_event ->> 'targetId';
  v_target jsonb := p_state -> 'accepted' -> (p_event ->> 'targetId');
  v_target_type text;
  v_state jsonb;
  v_goal jsonb;
  v_last_override jsonb;
  v_kick jsonb;
BEGIN
  IF v_target IS NULL THEN
    RETURN match_engine.reject('UNKNOWN_TARGET');
  END IF;
  v_target_type := v_target ->> 'type';
  IF NOT match_engine.retract_target_admissible(p_state, v_target_id, v_target_type, p_event) THEN
    RETURN match_engine.reject('INVALID_PAYLOAD');
  END IF;
  -- K2: eine CORRECTION nimmt nur die Turnierleitung zurueck.
  IF v_target_type = 'CORRECTION' AND (p_event -> 'actor') IS DISTINCT FROM '"leitung"'::jsonb THEN
    RETURN match_engine.reject('FORBIDDEN_ACTOR');
  END IF;
  IF (p_state -> 'retracted') ? v_target_id THEN
    RETURN match_engine.reject('ALREADY_RETRACTED');
  END IF;

  v_state := jsonb_set(p_state, '{retracted}', (p_state -> 'retracted') || to_jsonb(v_target_id));

  -- ZA-3 (@SL-066): zurueck auf "geplant" -- Uhr, Regeln und Abschnitt wie vor dem Anpfiff.
  IF v_target_type = 'MATCH_START' THEN
    RETURN match_engine.ok(v_state || jsonb_build_object(
      'status', 'scheduled', 'phase', 'regular', 'section', 1, 'rules', NULL, 'tiebreakMode', NULL,
      'clock', jsonb_build_object('running', false, 'elapsedMs', 0, 'anchorAt', NULL),
      'sectionStartMs', 0, 'breakStartedAt', NULL));
  END IF;
  -- ZA-3 (@SL-109): Spielzeit ohne die Korrektur (Anker bleibt).
  IF v_target_type = 'CLOCK_ADJUST' THEN
    SELECT r INTO v_kick FROM jsonb_array_elements(coalesce(p_state -> 'undo' -> 'clockAdjusts', '[]'::jsonb)) AS x(r)
     WHERE r ->> 'id' = v_target_id LIMIT 1;
    IF v_kick IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{clock,elapsedMs}',
        to_jsonb(match_engine.num(p_state -> 'clock' -> 'elapsedMs') - match_engine.num(v_kick -> 'deltaMs')));
    END IF;
    RETURN match_engine.ok(v_state);
  END IF;

  IF v_target_type IN ('GOAL', 'OWN_GOAL') THEN
    SELECT g INTO v_goal FROM jsonb_array_elements(p_state -> 'goals') WITH ORDINALITY AS x(g, ord)
      WHERE g ->> 'id' = v_target_id ORDER BY ord LIMIT 1;
    v_last_override := p_state -> 'overrides' -> -1;
    -- K9: Tor vor der letzten aktiven Ueberschreibung -> STALE_BASE (Detail wie CORRECTION).
    IF v_goal IS NOT NULL AND v_last_override IS NOT NULL
       AND (v_goal -> 'seq')::numeric < (v_last_override -> 'seq')::numeric THEN
      RETURN match_engine.reject('STALE_BASE', match_engine.stale_base_detail(p_state, p_ctx));
    END IF;
    IF v_goal IS NOT NULL THEN
      v_state := jsonb_set(v_state, ARRAY['scores', v_goal ->> 'scoringTeamId', v_goal ->> 'phase'],
        to_jsonb((v_state -> 'scores' -> (v_goal ->> 'scoringTeamId') -> (v_goal ->> 'phase'))::numeric - 1));
    END IF;
    RETURN match_engine.ok(v_state || jsonb_build_object('lastScoreEventId', p_event -> 'id'));
  END IF;

  IF v_target_type = 'CORRECTION' THEN
    RETURN match_engine.ok(v_state || jsonb_build_object(
      'overrides', coalesce((SELECT jsonb_agg(o ORDER BY ord)
                             FROM jsonb_array_elements(p_state -> 'overrides') WITH ORDINALITY AS x(o, ord)
                             WHERE o ->> 'id' IS DISTINCT FROM v_target_id), '[]'::jsonb),
      'lastScoreEventId', p_event -> 'id'));
  END IF;

  IF v_target_type = 'SHOOTOUT_KICK' THEN
    -- Schuss aus der Serie entfernen, Treffer zuruecknehmen; lastScoreEventId bleibt (A2).
    SELECT k INTO v_kick FROM jsonb_array_elements(p_state -> 'shootoutKicks') WITH ORDINALITY AS x(k, ord)
      WHERE k ->> 'id' = v_target_id ORDER BY ord LIMIT 1;
    IF v_kick IS NULL THEN
      RETURN match_engine.ok(v_state);
    END IF;
    v_state := jsonb_set(v_state, '{shootoutKicks}', coalesce((
      SELECT jsonb_agg(k ORDER BY ord)
      FROM jsonb_array_elements(p_state -> 'shootoutKicks') WITH ORDINALITY AS x(k, ord)
      WHERE k ->> 'id' IS DISTINCT FROM v_target_id), '[]'::jsonb));
    IF v_kick -> 'scored' = 'true'::jsonb THEN
      v_state := jsonb_set(v_state, ARRAY['scores', v_kick ->> 'teamId', 'shootout'],
        to_jsonb((v_state -> 'scores' -> (v_kick ->> 'teamId') -> 'shootout')::numeric - 1));
    END IF;
    RETURN match_engine.ok(v_state);
  END IF;

  -- Karten/Zeitstrafe/Foul/Wechsel: nur TS fuehrt die Listen (R18) -- hier zaehlt die Ruecknahme.
  RETURN match_engine.ok(v_state);
END;
$$;


-- ============================================================================================
-- 3. Wirkung je Typ: MATCH_START (Merker), REOPEN (Spiel fortsetzen), CLOCK_ADJUST (Merker)
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
        'undo', jsonb_build_object(
          'acceptedBeforeStart', (SELECT count(*) FROM jsonb_object_keys(coalesce(p_state -> 'accepted', '{}'::jsonb))),
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
        IF EXISTS (SELECT 1 FROM jsonb_each(coalesce(p_state -> 'accepted', '{}'::jsonb)) AS a(k, v)
                    WHERE a.v ->> 'type' = 'REOPEN') THEN
          RETURN match_engine.reject('FORBIDDEN_ACTOR', '{"reason": "ALREADY_CONTINUED"}'::jsonb);
        END IF;
        IF match_engine.num(p_event -> 'at') - match_engine.num(p_state -> 'finishedAt') > c_continue_window_ms THEN
          RETURN match_engine.reject('FORBIDDEN_ACTOR', '{"reason": "CONTINUE_WINDOW_EXPIRED"}'::jsonb);
        END IF;
      END IF;
      -- C0a (V2): sectionStartMs bleibt, eine Pause ist nach REOPEN nicht offen.
      RETURN match_engine.ok(p_state || jsonb_build_object(
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
-- 4. Server-Regeln: Entscheidungsart je Runde mit Rueckfall (D1, E1) -- client/serverRules.ts
-- ============================================================================================

-- Alte Signatur (ohne final_type) entfaellt; append_match_events ruft die neue (Abschnitt 5).
DROP FUNCTION IF EXISTS match_engine.server_rules(integer, text, integer, integer, jsonb, jsonb);

CREATE OR REPLACE FUNCTION match_engine.server_rules(p_duration_minutes integer, p_phase text,
                                                     p_group_duration integer, p_final_duration integer,
                                                     p_config jsonb, p_finals jsonb,
                                                     p_final_type text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group boolean := coalesce(p_phase, 'groupStage') = 'groupStage';
  v_sections integer;
  v_total numeric;
  v_settings jsonb := CASE WHEN jsonb_typeof(p_config) = 'object' THEN p_config -> 'matchCockpitSettings' END;
  v_finals jsonb := CASE WHEN jsonb_typeof(p_finals) = 'object' THEN p_finals END;
  v_by_round jsonb;
  v_keys text[];
  v_tiebreak text;
BEGIN
  v_sections := least(4, greatest(1, floor(coalesce(match_engine.cfg_num(
                  CASE WHEN jsonb_typeof(p_config) = 'object' THEN p_config -> 'gamePeriods' END), 1))))::integer;
  v_total := greatest(0, coalesce(p_duration_minutes,
                                  CASE WHEN v_group THEN p_group_duration
                                       ELSE coalesce(p_final_duration, p_group_duration) END, 0));
  -- ZA-3 D1 (E1, Befund C-KO-RUNDENREGEL-SERVER): Entscheidungsart je Spiel. Platzierungsspiel
  -- (final_type) -> tiebreakerByRound.placement -> .final; sonst tiebreakerByRound[<Runde aus phase>];
  -- danach die alte globale Regel tiebreaker (Altdaten); erste GUELTIGE Stufe gilt, sonst der
  -- Rueckfall 'overtime-then-shootout' (@SL-145). Zwilling: client/serverRules.ts#tiebreakFor.
  v_by_round := CASE WHEN jsonb_typeof(v_finals -> 'tiebreakerByRound') = 'object' THEN v_finals -> 'tiebreakerByRound' END;
  v_keys := CASE WHEN p_final_type IN ('thirdPlace', 'fifthSixth', 'seventhEighth') THEN ARRAY['placement', 'final']
                 WHEN p_phase IN ('roundOf16', 'quarterfinal', 'semifinal', 'final') THEN ARRAY[p_phase]
                 ELSE ARRAY[]::text[] END;
  SELECT s.v #>> '{}' INTO v_tiebreak
    FROM (SELECT k.ord, v_by_round -> k.key AS v FROM unnest(v_keys) WITH ORDINALITY AS k(key, ord)
          UNION ALL
          SELECT 1000, v_finals -> 'tiebreaker') AS s
   WHERE jsonb_typeof(s.v) = 'string' AND (s.v #>> '{}') IN ('shootout', 'overtime-then-shootout', 'goldenGoal')
   ORDER BY s.ord LIMIT 1;
  v_tiebreak := coalesce(v_tiebreak, 'overtime-then-shootout');

  RETURN jsonb_build_object(
    'sections', v_sections,
    'sectionSeconds', least(2147483647, floor(v_total * 60 / v_sections))::bigint,
    'breakSeconds', least(2147483647, greatest(0, floor(coalesce(match_engine.cfg_num(
                      CASE WHEN jsonb_typeof(p_config) = 'object' THEN p_config -> 'halftimeBreak' END), 1) * 60)))::bigint,
    'knockout', NOT v_group,
    'tiebreak', v_tiebreak,
    'overtimeSeconds', least(2147483647, greatest(0, floor(coalesce(match_engine.cfg_num(v_finals -> 'tiebreakerDuration'), 5) * 60)))::bigint,
    'shootersPerTeam', least(2147483647, greatest(0, floor(coalesce(match_engine.cfg_num(v_settings -> 'penaltyShootersPerTeam'), 5))))::bigint,
    'suddenDeathAfter', least(2147483647, greatest(0, floor(coalesce(match_engine.cfg_num(v_settings -> 'penaltySuddenDeathAfter'), 6))))::bigint,
    'penaltySeconds', 120);
END;
$$;


-- ============================================================================================
-- 5. append_match_events: final_type an server_rules; actual_start nach zurueckgenommenem Anpfiff
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

        IF v_server_reject IS NOT NULL THEN
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

        IF v_result ->> 'status' = 'accepted' THEN
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
                            'serverTime', v_now_ms);
END;
$$;


-- ============================================================================================
-- 6. Rechte (wie 20260928_002/_003 und 20261001_001; ausdruecklich, auch fuer ersetzte Funktionen)
-- ============================================================================================

REVOKE ALL ON FUNCTION
  match_engine.retract_target_admissible(jsonb, text, text, jsonb),
  match_engine.apply_retract(jsonb, jsonb, jsonb),
  match_engine.apply_effect(jsonb, jsonb, jsonb)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  match_engine.retract_target_admissible(jsonb, text, text, jsonb),
  match_engine.apply_retract(jsonb, jsonb, jsonb),
  match_engine.apply_effect(jsonb, jsonb, jsonb)
TO authenticated, anon, service_role;

-- server_rules braucht nur der Definer (append_match_events).
REVOKE ALL ON FUNCTION match_engine.server_rules(integer, text, integer, integer, jsonb, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) TO authenticated;

COMMIT;
