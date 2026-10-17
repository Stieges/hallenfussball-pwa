-- supabase/migrations/20261028_003_result_entry_shootout.sql
-- A-25a (MVP-Bauplan, brief-A-25a.md): Direkteintrag eines K.-o.-Ergebnisses mit Strafstossschiessen
-- (@FU-094, @ZM-147; Befund C-DIREKTEINTRAG-OHNE-STRAFSTOSS). SQL-Zwilling der TS-Rechenfunktion
-- (src/core/match/, TS ist die Referenz). Gleichlauf: scripts/match-engine-parity.sh (Fixtures 66a-66e),
-- Schreibweg: scripts/append-match-events-check.sh (Fixtures + Abschnitt "A-25a").
--
-- Inhalt:
--   1. payload_valid: RESULT_ENTRY darf `shootout` tragen (Strafstossstand je Team, ganzzahlig >= 0) --
--      genau beide Teams, nur bei Gleichstand in `scores` und nur, wenn er entscheidet (ungleich).
--   2. apply_result_entry: `shootout` wandert in die Ueberschreibung (nur, wenn eingetragen).
--   3. cache_columns: traegt die LETZTE Ueberschreibung ein `shootout` und ist das Spiel beendet ->
--      penalty_score_a/b = shootout, decided_by = 'penalty' (Monitor, Zuschauer-Seite, Folgerunde lesen das).
--   4. append_match_events (stapelt auf ZA-3 20261028_001): RESULT_ENTRY in ein K.-o.-Spiel mit
--      Gleichstand ohne `shootout` -> INVALID_PAYLOAD {reason: SHOOTOUT_REQUIRED}; Gruppenspiel mit
--      `shootout` -> INVALID_PAYLOAD {reason: SHOOTOUT_NOT_ALLOWED}; nichts gespeichert. K.-o. aus
--      server_rules (matches.phase), wie beim Anpfiff. Die Payload wird nicht veraendert (dedupe_key).
--   5. Rechte unveraendert (ausdruecklich wiederholt).
--
-- Ersetzte Funktionen (CREATE OR REPLACE, keine neue Signatur, Funktionszahl gleich):
--   match_engine.payload_valid(jsonb, jsonb)                    vorher 20261001_001_amend_event.sql
--   match_engine.apply_result_entry(jsonb, jsonb, jsonb)        vorher 20260928_002_match_engine.sql
--   match_engine.cache_columns(jsonb, jsonb)                    vorher 20261001_001_amend_event.sql
--   public.append_match_events(uuid, jsonb, integer, uuid)      vorher 20261028_001_transitions_za3.sql
--
-- Idempotent: nur CREATE OR REPLACE und REVOKE/GRANT. Keine Datenaenderung. Portabel: reines SQL.
--
-- RUECKWEG (zuerst die App zurueck, DANN die DB -- die neue App sendet `shootout`, die alte DB lehnt
-- das als INVALID_PAYLOAD ab; eigene Datei, z. B. <Datum>_<NNN>_result_entry_shootout_rollback.sql,
-- in EINEM Block):
--   -- a) vorher pruefen, ob schon Direkteintraege mit Strafstoss gespeichert sind (die alte Engine
--   --    rechnet sie beim Nachrechnen als INVALID_PAYLOAD; Fall fuer Fall ansehen):
--   --    SELECT count(*) FROM public.match_events
--   --     WHERE event_format IS NOT NULL AND type = 'RESULT_ENTRY' AND payload ? 'shootout';
--   BEGIN; SET LOCAL lock_timeout = '5s';
--   -- b) die vier Funktionen woertlich (mit ihren Rechten) in der Fassung davor wieder einspielen:
--   --    payload_valid + cache_columns aus 20261001_001_amend_event.sql (Abschnitte 3b/4a + 6),
--   --    apply_result_entry aus 20260928_002_match_engine.sql (+ REVOKE FROM PUBLIC / GRANT EXECUTE
--   --    TO authenticated, anon, service_role),
--   --    append_match_events aus 20261028_001_transitions_za3.sql (Abschnitt 5 + Rechte Abschnitt 6).
--   COMMIT;
--   Danach Drift-Check. Matches mit decided_by = 'penalty' aus einem Direkteintrag behalten ihren
--   Zwischenspeicher bis zum naechsten Ereignis des Spiels.
--
-- Produktion: nur im DB-Fenster F2 durch den Controller nach Daniels Freigabe des woertlichen SQL
-- (A-25a-sql-freigabe.md), Reihenfolge ZA-3 _001 -> A-08h _002 -> A-25a _003, danach Drift-Rerun,
-- Merge, Deploy. Dieser Branch spielt nichts ein.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ============================================================================================
-- 0. Voraussetzungen (Fail-fast): ZA-3 (20261028_001) muss eingespielt sein -- append_match_events
--    ruft die 7er-Signatur von server_rules.
-- ============================================================================================

DO $$
BEGIN
  IF to_regprocedure('match_engine.server_rules(integer,text,integer,integer,jsonb,jsonb,text)') IS NULL
     OR to_regprocedure('match_engine.apply_result_entry(jsonb,jsonb,jsonb)') IS NULL
     OR to_regprocedure('match_engine.cache_columns(jsonb,jsonb)') IS NULL
     OR to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)') IS NULL THEN
    RAISE EXCEPTION '20261028_003_result_entry_shootout: Rechenfunktion/Schreibweg/ZA-3 fehlen -- zuerst 20260928_001..003, 20261001_001 und 20261028_001 einspielen';
  END IF;
END;
$$;


-- ============================================================================================
-- 1. payload_valid: RESULT_ENTRY mit optionalem Strafstossergebnis (Fassung 20261001_001 + A-25a)
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
-- 2. apply_result_entry: Strafstossergebnis in die Ueberschreibung (Fassung 20260928_002 + A-25a)
-- ============================================================================================

CREATE OR REPLACE FUNCTION match_engine.apply_result_entry(p_state jsonb, p_event jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT p_state || jsonb_build_object(
    'overrides', (p_state -> 'overrides') || jsonb_build_array(jsonb_build_object(
      'id', p_event -> 'id',
      'kind', 'direct',
      'scores', p_event -> 'payload' -> 'scores',
      'snapshot', match_engine.snapshot(p_state, p_ctx),
      'seq', p_state -> 'nextSeq')
      -- A-25a (@FU-094): Strafstossergebnis nur, wenn eingetragen (kein null-Schluessel, sonst weicht
      -- der Zustand von TS ab -- handlers/correction.ts applyResultEntry).
      || CASE WHEN (p_event -> 'payload') ? 'shootout'
              THEN jsonb_build_object('shootout', p_event -> 'payload' -> 'shootout') ELSE '{}'::jsonb END),
    'nextSeq', (p_state -> 'nextSeq')::numeric + 1,
    'finishedAt', match_engine.num(p_event -> 'at'),
    'lastScoreEventId', p_event -> 'id');
$$;


-- ============================================================================================
-- 3. cache_columns: penalty_score_* und decided_by 'penalty' aus dem Direkteintrag
--    (Fassung 20261001_001 + A-25a)
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
  v_last_override jsonb := coalesce(p_state -> 'overrides', '[]'::jsonb) -> -1;
  v_entered jsonb;
BEGIN
  v_entered := CASE WHEN v_status = 'finished' AND coalesce(v_last_override ? 'shootout', false)
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
-- 4. append_match_events: Server-Pruefung K.-o.-Unentschieden (Fassung 20261028_001 ZA-3 + A-25a)
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
            WHEN v_knockout AND NOT ((v_event -> 'payload') ? 'shootout')
                 AND (v_event -> 'payload' -> 'scores' -> (v_ctx ->> 'teamAId'))
                     = (v_event -> 'payload' -> 'scores' -> (v_ctx ->> 'teamBId')) THEN 'SHOOTOUT_REQUIRED'
          END;
          IF v_shootout_violation IS NOT NULL THEN
            v_result := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'INVALID_PAYLOAD',
                                           'detail', jsonb_build_object('reason', v_shootout_violation));
          END IF;
        END IF;

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
-- 5. Rechte (unveraendert, ausdruecklich wie 20260928_002/_003, 20261001_001 und 20261028_001)
-- ============================================================================================

REVOKE ALL ON FUNCTION
  match_engine.payload_valid(jsonb, jsonb),
  match_engine.apply_result_entry(jsonb, jsonb, jsonb)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  match_engine.payload_valid(jsonb, jsonb),
  match_engine.apply_result_entry(jsonb, jsonb, jsonb)
TO authenticated, anon, service_role;

-- cache_columns bleibt definer-only (wie 20260928_003/20261001_001).
REVOKE ALL ON FUNCTION match_engine.cache_columns(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) TO authenticated;

COMMIT;
