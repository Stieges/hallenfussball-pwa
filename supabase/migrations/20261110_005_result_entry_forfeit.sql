-- supabase/migrations/20261110_005_result_entry_forfeit.sql
-- A-25b (GA4-Plan v2 Fassung 2.1, task-GA4-plan-v2.md "A-25b", Anhang B.1; v1 § 5.1): SQL-Zwilling der
-- Nichtantritt-Wertung (A-25n, src/core/match/, TS ist die Referenz) und Platzierungsspiele um Platz 5/7 in der Cloud
-- (@W2A-022, @W2A-024, @W2A-026, @TM-063 Server-Teil, @TM-004 Server-Teil; Befunde C-NICHTANTRITT-FEHLT, C-FINALTYPE-PLATZ5-7;
-- E-A4). Gleichlauf: scripts/match-engine-parity.sh (Fixtures 69a-69m), Schreibweg: scripts/append-match-events-check.sh,
-- Szenarien, Rechte, Proben: scripts/forfeit-check.sh, Feldsteuerung danach: scripts/field-control-check.sh (Kategorie N).
--
-- Inhalt:
--   1. matches.forfeit_absent (A|B|both, CHECK), decided_by-CHECK + 'forfeit', final_type-CHECK + 'fifthSixth',
--      'seventhEighth' (C-FINALTYPE-PLATZ5-7, @TM-004).
--   2. match_transitions: to_status-CHECK + '@reopen'; Zeile (finished, REOPEN) zeigt auf '@reopen' (R-GA4-4) -- den
--      Zielzustand setzt die Wirkung von REOPEN (running bzw. scheduled beim Zuruecknehmen einer Wertung).
--   3. Rechenfunktion: payload_valid (RESULT_ENTRY mit `forfeit` {absent}), apply_result_entry (Art 'forfeit' + absent),
--      decided_by ('forfeit'), apply_effect (REOPEN nimmt eine Wertung zurueck, setzt den Zielzustand),
--      match_apply_event ('@reopen'), cache_columns (forfeit_absent).
--   4. append_match_events (Fassung 20261110_003 A-34, Signatur unveraendert): Zwischenspeicher forfeit_absent;
--      R-A25b-1: das Zuruecknehmen einer Wertung braucht keine Feldsteuerung (Ziel 'scheduled', wie Direkteintrag);
--      R-A25b-2: eine Wertung ist von SHOOTOUT_REQUIRED ausgenommen (beide fehlen im K.-o.: 0:0 ohne Sieger).
--   5. matches_guard_engine_columns (Fassung 20261028_005): forfeit_absent ist Schutzspalte (17), INSERT neutral NULL.
--   6. Rechte unveraendert (ausdruecklich wiederholt). Keine neue Funktion (Engine-Zaehlung bleibt 52, R-A25b-3:
--      die Wertungs-Pruefung steht in payload_valid statt in einer eigenen forfeit_valid).
--
-- Ersetzte Funktionen (CREATE OR REPLACE, keine neue Signatur, Funktionszahl gleich) -- Basis ist jeweils die JUENGSTE
-- Fassung (Review-Auflage 4: append_match_events NIE aus einer 20261028-Fassung, sonst ist A-34 zurueckgedreht):
--   match_engine.payload_valid(jsonb, jsonb)                  vorher 20261028_003_result_entry_shootout.sql
--   match_engine.apply_result_entry(jsonb, jsonb, jsonb)      vorher 20261028_003_result_entry_shootout.sql
--   match_engine.decided_by(jsonb)                            vorher 20260928_002_match_engine.sql
--   match_engine.apply_effect(jsonb, jsonb, jsonb)            vorher 20261028_001_transitions_za3.sql
--   public.match_apply_event(jsonb, jsonb, jsonb, jsonb)      vorher 20261001_001_amend_event.sql
--   match_engine.cache_columns(jsonb, jsonb)                  vorher 20261028_007_entered_shootout_needs_draw.sql
--   public.append_match_events(uuid, jsonb, integer, uuid)    vorher 20261110_003_field_control.sql
--   public.matches_guard_engine_columns()                     vorher 20261028_005_guard_all_matches.sql
-- Den Unterschied je Funktion gegen genau diese Fassung haelt src/__tests__/architecture/forfeitTwins.test.ts fest.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, DROP/ADD CONSTRAINT, UPDATE auf denselben Wert, CREATE OR REPLACE, REVOKE/GRANT.
-- Datenaenderung: nur die eine Zeile in match_transitions. Bestand: neue Spalte NULL; CHECKs gelten fuer den Bestand
-- (decided_by/final_type nur erweitert). Portabel: reines SQL.
--
-- RUECKWEG: Vorlage 20261110_005-rueckweg.sql (Bauplan-Ordner; erzeugt mit
-- `bash scripts/forfeit-check.sh --print-rueckweg`, belegt in Kategorie X), in EINEM Block. Vorher die App zurueck
-- (die neue App kennt '@reopen' und sendet Wertungen). Spiele mit final_type Platz 5/7 halten den Rueckweg an
-- (vorher klaeren); gespeicherte Wertungen behalten ihre Ereignisse, ihr Zwischenspeicher wird 'regular'.
--
-- Produktion: nur im DB-Fenster G1 durch den Controller nach Daniels Freigabe des woertlichen SQL
-- (20261110_005-sql-freigabe.md), Reihenfolge NACH 20261110_001.._004, VOR 20261110_006. Dieser Branch spielt nichts ein.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ============================================================================================
-- 0. Voraussetzungen (Fail-fast): die juengsten Fassungen, auf denen diese Datei aufbaut
-- ============================================================================================

DO $$
BEGIN
  IF to_regclass('public.match_transitions') IS NULL
     OR to_regclass('public.field_control') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)')
                     AND position('public.field_control' IN prosrc) > 0)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('match_engine.cache_columns(jsonb,jsonb)')
                     AND position('match_engine.effective_score(p_state, v_a) = match_engine.effective_score(p_state, v_b)' IN prosrc) > 0)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('match_engine.apply_effect(jsonb,jsonb,jsonb)')
                     AND position('c_continue_window_ms' IN prosrc) > 0)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('match_engine.payload_valid(jsonb,jsonb)')
                     AND position('v_payload ? ''shootout''' IN prosrc) > 0)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.match_apply_event(jsonb,jsonb,jsonb,jsonb)')
                     AND position('details_from_payload' IN prosrc) > 0)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.matches_guard_engine_columns()')
                     AND position('TG_OP = ''INSERT''' IN prosrc) > 0)
     OR to_regprocedure('match_engine.decided_by(jsonb)') IS NULL
     OR to_regprocedure('match_engine.apply_result_entry(jsonb,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION '20261110_005_result_entry_forfeit: Vorgaenger fehlen (A-34 20261110_003, SW 20261028_007, ZA-3 20261028_001, A-25a 20261028_003, A-10 20261028_005) -- zuerst alle Migrationen bis 20261110_004 einspielen';
  END IF;
END;
$$;


-- ============================================================================================
-- 1. Spalten und CHECKs auf matches
-- ============================================================================================

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS forfeit_absent text;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_forfeit_absent_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_forfeit_absent_check
  CHECK (forfeit_absent IS NULL OR forfeit_absent IN ('A', 'B', 'both'));
COMMENT ON COLUMN public.matches.forfeit_absent IS
  'A-25 (@W2A-022, @W2A-024, E-A4): Nichtantritt-Wertung -- wer fehlte (A|B|both), nur im beendeten Spiel mit Wertung.
   Zwischenspeicher, nur append_match_events schreibt (matches_guard_engine_columns).';

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_decided_by_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_decided_by_check
  CHECK (decided_by IN ('regular', 'overtime', 'goldenGoal', 'penalty', 'forfeit'));

-- C-FINALTYPE-PLATZ5-7 (@TM-004): der Generator schreibt fifthSixth/seventhEighth (Anhang B.1 Nr. 1).
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_final_type_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_final_type_check
  CHECK (final_type IS NULL OR final_type IN ('quarterfinal', 'semifinal', 'thirdPlace', 'fifthSixth', 'seventhEighth', 'final'));


-- ============================================================================================
-- 2. match_transitions: REOPEN zeigt auf '@reopen' (exakt src/core/match/matchTransitions.json)
-- ============================================================================================

ALTER TABLE public.match_transitions DROP CONSTRAINT IF EXISTS match_transitions_to_status_check;
ALTER TABLE public.match_transitions ADD CONSTRAINT match_transitions_to_status_check CHECK (
  to_status IN ('scheduled', 'running', 'paused', 'section_break', 'decision_pending', 'shootout',
                'finished', 'skipped', '=', '@endcheck', '@reopen'));

UPDATE public.match_transitions SET to_status = '@reopen'
 WHERE from_status = 'finished' AND event_type = 'REOPEN' AND to_status IS DISTINCT FROM '@reopen';


-- ============================================================================================
-- 3a. payload_valid: RESULT_ENTRY mit optionaler Nichtantritt-Wertung (Fassung 20261028_003 + A-25n)
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
-- 3b. apply_result_entry: Art 'forfeit' und Fehlender (Fassung 20261028_003 + A-25n)
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
    'nextSeq', (p_state -> 'nextSeq')::numeric + 1,
    'finishedAt', match_engine.num(p_event -> 'at'),
    'lastScoreEventId', p_event -> 'id');
$$;


-- ============================================================================================
-- 3c. decided_by: 'forfeit' (Fassung 20260928_002 + A-25n)
-- ============================================================================================

-- decidedByFor (types.ts, K1): letzte Ueberschreibung -> correction/direct/forfeit, sonst baseDecidedBy.
CREATE OR REPLACE FUNCTION match_engine.decided_by(p_state jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_array_length(p_state -> 'overrides') = 0 THEN coalesce(p_state -> 'baseDecidedBy', 'null'::jsonb)
    WHEN p_state -> 'overrides' -> -1 ->> 'kind' = 'correction' THEN '"correction"'::jsonb
    -- A-25n (@W2A-022): Nichtantritt-Wertung (types.ts decidedByFor).
    WHEN p_state -> 'overrides' -> -1 ->> 'kind' = 'forfeit' THEN '"forfeit"'::jsonb
    ELSE '"direct"'::jsonb
  END;
$$;


-- ============================================================================================
-- 3d. apply_effect: REOPEN nimmt eine Wertung zurueck und setzt den Zielzustand (Fassung 20261028_001 + A-25n)
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
-- 3e. match_apply_event: Ziel '@reopen' (Fassung 20261001_001 + A-25n)
-- ============================================================================================

CREATE OR REPLACE FUNCTION public.match_apply_event(state jsonb, event jsonb, ctx jsonb, transitions jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text := event ->> 'type';
  v_status text := state ->> 'status';
  v_row jsonb;
  v_effect jsonb;
  v_state jsonb;
BEGIN
  -- 1. Payload (zod) -> INVALID_PAYLOAD.
  IF NOT match_engine.payload_valid(event, ctx) THEN
    RETURN match_engine.reject('INVALID_PAYLOAD');
  END IF;

  -- 2. R9/K8/B-U7: weiteres Spielende ist noop.
  IF v_type = 'MATCH_END' AND v_status IN ('finished', 'section_break', 'decision_pending', 'shootout') THEN
    RETURN jsonb_build_object('status', 'noop', 'state', state);
  END IF;

  -- 3. Uebergangszeile (erste passende, wie Array.find).
  SELECT r INTO v_row
    FROM jsonb_array_elements(coalesce(transitions, '[]'::jsonb)) WITH ORDINALITY AS x(r, ord)
   WHERE r ->> 'from' = v_status AND r ->> 'type' = v_type
   ORDER BY ord
   LIMIT 1;
  IF v_row IS NULL THEN
    RETURN match_engine.reject(CASE WHEN v_status = 'finished' THEN 'MATCH_FINISHED' ELSE 'INVALID_TRANSITION' END);
  END IF;

  -- 4. Akteur (R7): helper-Zeile erlaubt Helfer UND Turnierleitung.
  IF NOT (v_row ->> 'actor' = 'helper' OR coalesce(event -> 'actor' = '"leitung"'::jsonb, false)) THEN
    RETURN match_engine.reject('FORBIDDEN_ACTOR');
  END IF;

  -- 5. Typspezifische Wirkung, dann `to` (A-25n: '@reopen' = Zielzustand aus der Wirkung).
  v_effect := match_engine.apply_effect(state, event, ctx);
  IF v_effect ->> 'status' = 'rejected' THEN
    RETURN v_effect;
  END IF;
  v_state := v_effect -> 'state';
  IF v_row ->> 'to' = '@endcheck' THEN
    v_state := match_engine.endcheck(v_state, event, ctx);
  ELSIF v_row ->> 'to' NOT IN ('=', '@reopen') THEN
    -- A-25n: bei '@reopen' hat die Wirkung (apply_effect REOPEN) den Zielzustand schon gesetzt (applyEvent.ts).
    v_state := v_state || jsonb_build_object('status', v_row ->> 'to');
  END IF;

  -- K1: decidedBy zentral ableiten; Ereignis als angenommen fuehren (kanonisch, K3).
  v_state := v_state || jsonb_build_object(
    'decidedBy', match_engine.decided_by(v_state),
    'accepted', (v_state -> 'accepted') || jsonb_build_object(event ->> 'id', match_engine.canonical(event)));

  -- C0a (V1): ein angenommenes Zielereignis bringt seine Angaben aus der Payload mit.
  IF match_engine.detail_fields(v_type) IS NOT NULL THEN
    v_state := v_state || jsonb_build_object('details', coalesce(v_state -> 'details', '{}'::jsonb)
      || jsonb_build_object(event ->> 'id', match_engine.details_from_payload(v_type, event -> 'payload')));
  END IF;
  RETURN jsonb_build_object('status', 'accepted', 'state', v_state);
END;
$$;


-- ============================================================================================
-- 3f. cache_columns: forfeit_absent (Fassung 20261028_007 + A-25n)
-- ============================================================================================

CREATE OR REPLACE FUNCTION match_engine.cache_columns(p_state jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_a text := p_ctx ->> 'teamAId';
  v_b text := p_ctx ->> 'teamBId';
  v_status text := p_state ->> 'status';
  v_phase text := p_state ->> 'phase';
  v_override boolean := jsonb_array_length(coalesce(p_state -> 'overrides', '[]'::jsonb)) > 0;
  v_overtime boolean;
  v_running boolean := coalesce((p_state -> 'clock' -> 'running')::boolean, false);
  v_elapsed numeric := coalesce(match_engine.num(p_state -> 'clock' -> 'elapsedMs'), 0);
  v_rules jsonb := p_state -> 'rules';
  v_decided text := p_state ->> 'decidedBy';
  v_unplayed boolean := p_state ->> 'status' IN ('scheduled', 'skipped');
  -- A-25a (@FU-094, @ZM-147): Strafstossergebnis der LETZTEN Ueberschreibung (Direkteintrag), nur im
  -- beendeten Spiel (cacheColumns.ts enteredShootout).
  -- SW (@EK-062, C-STRAFSTOSS-NACH-WIEDEREROEFFNEN): und nur bei Gleichstand im effektiven Endstand --
  -- nach dem Wiedereroeffnen und einem Ende ohne Gleichstand zaehlt der alte Strafstoss nirgends mehr
  -- (shootoutStatus.ts enteredShootoutStatus, kind 'counts').
  v_last_override jsonb := coalesce(p_state -> 'overrides', '[]'::jsonb) -> -1;
  v_entered jsonb;
BEGIN
  v_entered := CASE WHEN v_status = 'finished' AND coalesce(v_last_override ? 'shootout', false)
                         AND match_engine.effective_score(p_state, v_a) = match_engine.effective_score(p_state, v_b)
                    THEN v_last_override -> 'shootout' END;
  v_overtime := v_phase = 'overtime'
                OR coalesce((p_state -> 'scores' -> v_a -> 'overtime')::numeric, 0)
                   + coalesce((p_state -> 'scores' -> v_b -> 'overtime')::numeric, 0) > 0
                OR coalesce(p_state ->> 'baseDecidedBy' IN ('overtime', 'goldenGoal'), false);
  RETURN jsonb_build_object(
    -- I1 (Fixrunde 1): ein nicht gespieltes Spiel (scheduled/skipped) hat keinen Stand -- NULL wie
    -- beim alten Weg; sonst zaehlten alte Leser (calculateStandings) es als 0:0.
    'score_a', CASE WHEN v_unplayed THEN NULL WHEN v_override THEN match_engine.effective_score(p_state, v_a)
                    ELSE (p_state -> 'scores' -> v_a -> 'regular')::numeric END,
    'score_b', CASE WHEN v_unplayed THEN NULL WHEN v_override THEN match_engine.effective_score(p_state, v_b)
                    ELSE (p_state -> 'scores' -> v_b -> 'regular')::numeric END,
    'overtime_score_a', CASE WHEN v_unplayed OR NOT v_overtime THEN NULL WHEN v_override THEN 0
                             ELSE (p_state -> 'scores' -> v_a -> 'overtime')::numeric END,
    'overtime_score_b', CASE WHEN v_unplayed OR NOT v_overtime THEN NULL WHEN v_override THEN 0
                             ELSE (p_state -> 'scores' -> v_b -> 'overtime')::numeric END,
    'penalty_score_a', CASE WHEN v_phase = 'shootout' AND NOT v_unplayed THEN (p_state -> 'scores' -> v_a -> 'shootout')::numeric
                            WHEN v_entered IS NOT NULL THEN (v_entered -> v_a)::numeric END,
    'penalty_score_b', CASE WHEN v_phase = 'shootout' AND NOT v_unplayed THEN (p_state -> 'scores' -> v_b -> 'shootout')::numeric
                            WHEN v_entered IS NOT NULL THEN (v_entered -> v_b)::numeric END,
    'match_status', CASE WHEN v_status IN ('section_break', 'decision_pending', 'shootout') THEN 'paused' ELSE v_status END,
    'decided_by', CASE WHEN v_status <> 'finished' OR v_decided IS NULL THEN NULL
                       WHEN v_decided = 'shootout' OR v_entered IS NOT NULL THEN 'penalty'
                       WHEN v_decided IN ('correction', 'direct') THEN 'regular'
                       ELSE v_decided END,
    'running', v_running,
    'started', v_status NOT IN ('scheduled', 'skipped'),
    'anchor_at', CASE WHEN v_running THEN match_engine.num(p_state -> 'clock' -> 'anchorAt') END,
    'timer_elapsed_seconds', floor(v_elapsed / 1000),
    'finished_at', match_engine.num(p_state -> 'finishedAt'),
    'live_state', CASE WHEN v_status IN ('scheduled', 'skipped', 'finished') THEN NULL ELSE jsonb_build_object(
      'engine', true,
      'status', v_status,
      'phase', v_phase,
      'section', p_state -> 'section',
      'running', v_running,
      'elapsedMs', v_elapsed,
      'anchorAt', coalesce(p_state -> 'clock' -> 'anchorAt', 'null'::jsonb),
      'elapsedSeconds', floor(v_elapsed / 1000),
      'durationSeconds', coalesce(match_engine.num(v_rules -> 'sections'), 1)
                         * coalesce(match_engine.num(v_rules -> 'sectionSeconds'), 0),
      'playPhase', CASE WHEN v_phase = 'shootout' THEN 'penalty'
                        WHEN v_phase = 'overtime' AND p_state ->> 'tiebreakMode' = 'goldenGoal' THEN 'goldenGoal'
                        WHEN v_phase = 'overtime' THEN 'overtime'
                        ELSE 'regular' END,
      'tiebreakerMode', coalesce(p_state -> 'tiebreakMode', 'null'::jsonb),
      'overtimeDurationSeconds', coalesce(v_rules -> 'overtimeSeconds', 'null'::jsonb),
      'awaitingTiebreakerChoice', v_status = 'decision_pending',
      -- C0a (RC12, V2): Abschnittsuhr fuer Monitor und Cockpit.
      'sections', coalesce(v_rules -> 'sections', 'null'::jsonb),
      'sectionSeconds', coalesce(v_rules -> 'sectionSeconds', 'null'::jsonb),
      'breakSeconds', coalesce(v_rules -> 'breakSeconds', 'null'::jsonb),
      'overtimeSeconds', coalesce(v_rules -> 'overtimeSeconds', 'null'::jsonb),
      'sectionStartMs', p_state -> 'sectionStartMs',
      'breakStartedAt', coalesce(p_state -> 'breakStartedAt', 'null'::jsonb)) END,
    -- Fixrunde 1 (Review M2, PC6): nur im Status skipped -- Zeitpunkt (Epoch-ms = at des SKIP,
    -- beim Anhaengen der geklemmte at_server) und payload.reason; sonst NULL (UNSKIP).
    'skipped_at', CASE WHEN v_status = 'skipped' THEN match_engine.num(p_state -> 'skippedAt') END,
    'skipped_reason', CASE WHEN v_status = 'skipped' THEN p_state ->> 'skipReason' END,
    -- A-25n (@W2A-022, @W2A-024): wer nicht angetreten ist -- nur im beendeten Spiel, solange die Wertung die letzte
    -- Ueberschreibung ist (cacheColumns.ts forfeitAbsent). decided_by 'forfeit' faellt oben in den ELSE-Zweig.
    'forfeit_absent', CASE WHEN v_status = 'finished' AND v_last_override ->> 'kind' = 'forfeit'
                           THEN v_last_override -> 'absent' END);
END;
$$;


-- ============================================================================================
-- 4. append_match_events: forfeit_absent, R-A25b-1, R-A25b-2 (Fassung 20261110_003 A-34 + A-25n)
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
        IF v_state ->> 'status' = ANY (c_live_states)
           OR (v_event ->> 'type' IN ('MATCH_START', 'REOPEN') AND NOT v_forfeit_reopen) THEN
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
-- 5. Spalten-Schutz: forfeit_absent (Fassung 20261028_005 + A-25n)
-- ============================================================================================

CREATE OR REPLACE FUNCTION public.matches_guard_engine_columns() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      -- Neutral wie mapMatchToSupabase (C3a-2b): ein neues Spiel traegt nie ein Ergebnis.
      NEW.score_a := NULL;
      NEW.score_b := NULL;
      NEW.overtime_score_a := NULL;
      NEW.overtime_score_b := NULL;
      NEW.penalty_score_a := NULL;
      NEW.penalty_score_b := NULL;
      NEW.match_status := 'scheduled';
      NEW.decided_by := NULL;
      NEW.timer_start_time := NULL;
      NEW.timer_paused_at := NULL;
      NEW.timer_elapsed_seconds := 0;
      NEW.live_state := NULL;
      NEW.actual_start := NULL;
      NEW.actual_end := NULL;
      NEW.skipped_at := NULL;
      NEW.skipped_reason := NULL;
      NEW.forfeit_absent := NULL;
    ELSIF NEW.score_a IS DISTINCT FROM OLD.score_a
       OR NEW.score_b IS DISTINCT FROM OLD.score_b
       OR NEW.overtime_score_a IS DISTINCT FROM OLD.overtime_score_a
       OR NEW.overtime_score_b IS DISTINCT FROM OLD.overtime_score_b
       OR NEW.penalty_score_a IS DISTINCT FROM OLD.penalty_score_a
       OR NEW.penalty_score_b IS DISTINCT FROM OLD.penalty_score_b
       OR NEW.match_status IS DISTINCT FROM OLD.match_status
       OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
       OR NEW.timer_start_time IS DISTINCT FROM OLD.timer_start_time
       OR NEW.timer_paused_at IS DISTINCT FROM OLD.timer_paused_at
       OR NEW.timer_elapsed_seconds IS DISTINCT FROM OLD.timer_elapsed_seconds
       OR NEW.live_state IS DISTINCT FROM OLD.live_state
       OR NEW.actual_start IS DISTINCT FROM OLD.actual_start
       OR NEW.actual_end IS DISTINCT FROM OLD.actual_end
       OR NEW.skipped_at IS DISTINCT FROM OLD.skipped_at
       OR NEW.skipped_reason IS DISTINCT FROM OLD.skipped_reason
       OR NEW.forfeit_absent IS DISTINCT FROM OLD.forfeit_absent THEN
      RAISE EXCEPTION
        'Nicht erlaubt: Spielstand, Status, Uhr und live_state eines Spiels aendern nur append_match_events und reset_match_results (Spiel %).',
        OLD.id
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.matches_guard_engine_columns() IS
  'A-10 (vorher C0b, 20261001_001), A-25n (20261110_005): BEFORE-INSERT-OR-UPDATE-Schutz auf matches. Client-Rollen
   (current_user authenticated/anon) aendern score_a/b, overtime_score_a/b, penalty_score_a/b, match_status, decided_by,
   timer_start_time, timer_paused_at, timer_elapsed_seconds, live_state, actual_start, actual_end,
   skipped_at, skipped_reason, forfeit_absent bei KEINEM Spiel (auch ohne Engine-Ereignisse, @EK-060); beim INSERT werden
   sie neutral gesetzt. Schreiben duerfen nur append_match_events und reset_match_results (SECURITY DEFINER).';


-- ============================================================================================
-- 6. Rechte (unveraendert, ausdruecklich wie 20260928_002, 20261001_001, 20261028_001/_003/_005/_007, 20261110_003)
-- ============================================================================================

REVOKE ALL ON FUNCTION
  match_engine.payload_valid(jsonb, jsonb),
  match_engine.apply_result_entry(jsonb, jsonb, jsonb),
  match_engine.decided_by(jsonb),
  match_engine.apply_effect(jsonb, jsonb, jsonb),
  public.match_apply_event(jsonb, jsonb, jsonb, jsonb)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  match_engine.payload_valid(jsonb, jsonb),
  match_engine.apply_result_entry(jsonb, jsonb, jsonb),
  match_engine.decided_by(jsonb),
  match_engine.apply_effect(jsonb, jsonb, jsonb),
  public.match_apply_event(jsonb, jsonb, jsonb, jsonb)
TO authenticated, anon, service_role;

-- cache_columns bleibt definer-only (wie 20261028_007), die Trigger-Funktion ohne EXECUTE (wie 20261028_005).
REVOKE ALL ON FUNCTION match_engine.cache_columns(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.matches_guard_engine_columns() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) TO authenticated;

COMMIT;
