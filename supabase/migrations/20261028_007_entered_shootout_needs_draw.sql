-- supabase/migrations/20261028_007_entered_shootout_needs_draw.sql
-- SW (MVP-Bauplan, brief-SW.md): Strafstossergebnis eines Direkteintrags zaehlt nur bei Gleichstand
-- (@EK-062, Zone-1-Regel "K.-o.-Spiel auf Unentschieden"; Befund C-STRAFSTOSS-NACH-WIEDEREROEFFNEN).
-- SQL-Zwilling der TS-Rechenfunktion (src/core/match/, TS ist die Referenz). Gleichlauf:
-- scripts/match-engine-parity.sh (Fixtures 68a-68d), Schreibweg: scripts/append-match-events-check.sh
-- (Abschnitt "SW").
--
-- Inhalt:
--   1. cache_columns: das Strafstossergebnis der LETZTEN Ueberschreibung (Direkteintrag, A-25a) gilt nur,
--      wenn das Spiel beendet ist UND der effektive Endstand gleich ist. Wird ein Direkteintrag 2:2 /
--      Strafstoss 4:3 wieder eroeffnet und endet 2:3, schreibt der Zwischenspeicher score 2:3,
--      penalty_score_* NULL, decided_by 'regular' -- Monitor, Zuschauer-Seite und Finalrunde lesen das.
--      Endet es erneut 2:2, gilt 4:3 weiter (die App fragt neu ab, vorbelegt mit 4:3 -- Client).
--   2. Rechte unveraendert (ausdruecklich wiederholt: definer-only wie 20261028_003).
--
-- Ersetzte Funktion (CREATE OR REPLACE, keine neue Signatur, Funktionszahl gleich):
--   match_engine.cache_columns(jsonb, jsonb)      vorher 20261028_003_result_entry_shootout.sql (Abschnitt 3)
-- Nicht geaendert: append_match_events, payload_valid, apply_result_entry, Engine-Zustand, Tabellen, Daten.
-- Idempotent (CREATE OR REPLACE, REVOKE). Portabel: reines SQL.
--
-- RUECKWEG (Reihenfolge egal -- alte App und neue DB bzw. neue App und alte DB brechen nichts, sie zeigen
-- nur fuer wiedereroeffnete Direkteintraege mit Strafstoss den alten Fehler; eigene Datei, ein Block):
--   BEGIN; SET LOCAL lock_timeout = '5s';
--   -- cache_columns woertlich aus 20261028_003_result_entry_shootout.sql (Abschnitt 3) +
--   REVOKE ALL ON FUNCTION match_engine.cache_columns(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
--   COMMIT;
--   Danach: Assertion cache-columns-immutable-no-client-execute bleibt gueltig (Rechte gleich), Drift-Check.
--   Spielzeilen, die bis dahin mit der SW-Regel geschrieben wurden, behalten ihren Zwischenspeicher bis
--   zum naechsten Ereignis des Spiels.
--
-- Produktion: nur im DB-Fenster F2b durch den Controller nach Daniels Freigabe des woertlichen SQL
-- (SW-sql-freigabe.md), Reihenfolge A-10 _005 -> UR _006 -> SW _007, danach Drift-Rerun, Merge, Deploy.
-- Dieser Branch spielt nichts ein.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ============================================================================================
-- 0. Voraussetzungen (Fail-fast): A-25a (20261028_003) muss eingespielt sein -- sonst ersetzte diese
--    Datei eine aeltere cache_columns-Fassung und naehme den Direkteintrag mit Strafstoss zurueck.
-- ============================================================================================

DO $$
BEGIN
  IF to_regprocedure('match_engine.cache_columns(jsonb,jsonb)') IS NULL
     OR to_regprocedure('match_engine.effective_score(jsonb,text)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_proc
                     WHERE oid = to_regprocedure('match_engine.cache_columns(jsonb,jsonb)')
                       AND position('v_last_override' IN prosrc) > 0) THEN
    RAISE EXCEPTION '20261028_007_entered_shootout_needs_draw: cache_columns in der Fassung 20261028_003 fehlt -- zuerst 20260928_002, 20261001_001, 20261028_001 und 20261028_003 einspielen';
  END IF;
END;
$$;


-- ============================================================================================
-- 1. cache_columns: Strafstoss aus dem Direkteintrag nur bei Gleichstand (Fassung 20261028_003 + SW)
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
    'skipped_reason', CASE WHEN v_status = 'skipped' THEN p_state ->> 'skipReason' END);
END;
$$;



-- ============================================================================================
-- 2. Rechte (unveraendert, ausdruecklich wie 20261028_003): cache_columns bleibt definer-only.
-- ============================================================================================

REVOKE ALL ON FUNCTION match_engine.cache_columns(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
