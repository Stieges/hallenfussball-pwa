-- B3a (.superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B3a-brief.md): SQL-Zwilling der reinen
-- Spiel-Rechenfunktion src/core/match/ (TS, B1a/B1b/B1c).
--
-- Warum: Ab B3b entscheidet der SERVER (append_match_events), ob ein Ereignis zulaessig ist, und
-- rechnet den Spielstand selbst nach (compute_match_state). Dafuer steckt dieselbe
-- Entscheidungslogik hier ein zweites Mal, in PL/pgSQL (Ruling R1: "reine Rechenfunktion,
-- zweimal"). TS ist die REFERENZ -- Gleichlauf erzwingt scripts/match-engine-parity.sh: jede
-- JSON-Fixture unter src/core/match/__fixtures__/ laeuft durch beide Seiten, verlangt wird
-- SQL == TS == expect (Ergebnisse je Ereignis und der serverState vollstaendig).
--
-- Umfang (Ruling R18): SQL rechnet NUR, was der Server entscheidet -- Status, Phase, Abschnitt,
-- Uhr (running/elapsedMs/anchorAt), Stand je Team (regulaer/Verlaengerung/Strafstoss), effektiver
-- Stand (Ueberschreibungs-Stapel K1), Strafstoss-Serie, letzte spielstandaendernde ID, decidedBy,
-- finishedAt. Karten, Fouls, Wechsel und Zeitstrafen rechnet nur TS; hier werden sie nur als
-- angenommene Ereignisse gefuehrt (Ziel fuer RETRACT, Duplikat-Erkennung).
--
-- Oeffentliche Funktionen (Schema public, SET search_path = public, pg_temp):
--   match_initial_state(ctx)                                 initialState (inkl. teamAId <> teamBId)
--   match_apply_event(state, event, ctx, transitions)        applyEvent -- IMMUTABLE, rein
--   match_continue(state, events, ctx, transitions, mode)    continueLog (log) / applyBatch (batch)
--   match_reduce(events, ctx, transitions, mode)             dasselbe ab match_initial_state
--   match_server_state(state)                                toServerState (Ruling P2, K11)
--   compute_match_state(match_id)                            STABLE, SECURITY INVOKER (R17: RLS gilt)
-- Interne Teilfunktionen (Ruling S8) im nicht exponierten Schema match_engine (Ruling S12):
-- Validierung, Uhr, Tor, Ruecknahme, Korrektur, Abschnitte, Entscheidung, Strafstossschiessen,
-- Spielende-Pruefung.
--
-- `transitions` ist ein jsonb-Array [{from,type,actor,to}] (Form von matchTransitions.json).
-- Die reinen Funktionen lesen KEINE Tabelle (ehrliches IMMUTABLE, R1); compute_match_state liest
-- die Uebergaenge aus public.match_transitions.
--
-- Controller-Rulings B3a (Brief), wie umgesetzt:
--   S1  compute_match_state setzt fuer jedes gespeicherte Ereignis actor = 'leitung'. Beleg, dass
--       'leitung' Obermenge ist: die TS-Logik fragt den Akteur an genau zwei Stellen ab --
--       transitions.ts isActorAllowed (row.actor = 'helper' ODER actor = 'leitung') und
--       handlers/retract.ts K2 (Ziel CORRECTION verlangt 'leitung'). Beide lassen 'leitung'
--       immer zu; es gibt keinen Pfad, auf dem 'leitung' abgelehnt, 'helper' aber angenommen wird.
--   S2  at = floor(extract(epoch from coalesce(client_time, recorded_at)) * 1000)::bigint.
--   S3  Ganzzahl nur bei jsonb_typeof = 'number' und v = trunc(v) (M9); zusaetzlich |v| <=
--       2^53-1, weil zod 4 `.int()` nur sichere Ganzzahlen annimmt.
--   S4  payload kein jsonb-Objekt -> INVALID_PAYLOAD (RR-M3, Fixture 16).
--   S5  team-bezogener Typ ohne gueltige teamId -> INVALID_PAYLOAD (MR3; auch beim Nachrechnen,
--       wenn team_id nach einer Team-Loeschung NULL ist).
--   S6  Duplikat-Vergleich (K3) ueber jsonb_strip_nulls({type, teamId, targetId, section,
--       clockMs, payload}) -- jsonb-Gleichheit ist schluesselordnungsfrei.
--   S7  Log-Position fuer K9 wie in TS ueber einen Zaehler nextSeq im Zustand.
--   S8  Teilfunktionen, keine dynamische SQL.
-- Pruefreihenfolge applyEvent (verbindlich, applyEvent.ts): Payload -> MATCH_END-noop ->
-- Uebergangszeile -> Akteur -> typspezifische Wirkung -> `to` (inkl. @endcheck).
-- Pruefreihenfolge RETRACT (B-U16): UNKNOWN_TARGET -> Zieltyp-Zulaessigkeit (INVALID_PAYLOAD) ->
-- K2 (FORBIDDEN_ACTOR) -> ALREADY_RETRACTED -> K9 (STALE_BASE).
--
-- Zustandsform (jsonb, intern -- nur match_server_state ist Vertrag):
--   {status, phase, section, rules, tiebreakMode, clock{running,elapsedMs,anchorAt},
--    scores{<team>:{regular,overtime,shootout}}, goals[{id,scoringTeamId,phase,seq}],
--    overrides[{id,kind,scores,snapshot,seq}], nextSeq, baseDecidedBy,
--    shootoutKicks[{id,teamId,scored}], accepted{<id>: kanonischer Inhalt inkl. type},
--    retracted[<id>], lastScoreEventId, decidedBy, finishedAt}
--
-- Idempotent: CREATE SCHEMA IF NOT EXISTS, CREATE OR REPLACE FUNCTION, DROP FUNCTION IF EXISTS,
-- GRANT/REVOKE. Rueckweg: DROP SCHEMA match_engine CASCADE + DROP FUNCTION der sechs public-
-- Funktionen (keine Daten, keine Tabellen). Produktion wendet der Controller erst nach
-- Freigabe an (bis dahin nur lokal/Container).
--
-- Abschluss-Fixrunde (final-review-B.md, M1): SET LOCAL lock_timeout, wie 20260928_001 --
-- Begruendung dort (Kopfkommentar).

SET LOCAL lock_timeout = '5s';


-- ============================================================================================
-- 0. Voraussetzungen (M6), Schema match_engine (Ruling S12)
-- ============================================================================================
--
-- Fail-fast (Review M6): compute_match_state (plpgsql) liesse sich auch ohne das B2-Schema
-- anlegen und scheiterte erst beim ersten Aufruf. Beim Live-Einspielen in falscher Reihenfolge
-- (002 vor 001) bricht die Migration deshalb sofort ab.
DO $$
BEGIN
  IF to_regclass('public.match_transitions') IS NULL THEN
    RAISE EXCEPTION '20260928_002_match_engine: public.match_transitions fehlt -- zuerst 20260928_001_match_event_log.sql einspielen';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.match_events'::regclass AND attname = 'event_format' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION '20260928_002_match_engine: public.match_events.event_format fehlt -- zuerst 20260928_001_match_event_log.sql einspielen';
  END IF;
END;
$$;

-- Ruling S12 (Review M8): die internen Teilfunktionen liegen in einem eigenen Schema, das die
-- API (PostgREST, supabase/config.toml [api] schemas = public, graphql_public) NICHT ausliefert --
-- keine /rpc/-Endpunkte fuer Helfer, keine Eintraege in src/types/supabase.ts. USAGE + EXECUTE
-- fuer anon/authenticated/service_role ist trotzdem noetig: die oeffentlichen Funktionen sind
-- SECURITY INVOKER und rufen die Helfer mit den Rechten des Aufrufers. Alle Aufrufe sind
-- schema-qualifiziert (match_engine.x), search_path bleibt public, pg_temp.
CREATE SCHEMA IF NOT EXISTS match_engine;
REVOKE ALL ON SCHEMA match_engine FROM PUBLIC;
GRANT USAGE ON SCHEMA match_engine TO anon, authenticated, service_role;
-- Abschluss-Fixrunde (final-review-B.md, I2): ci_schema_reader (nur-lesende Drift-Check-Rolle)
-- braucht USAGE auf dem Schema, sonst schlaegt scripts/db_privilege_assertions.sql live fehl --
-- has_function_privilege() loest 'match_engine.f(...)'-Signaturen ueber regprocedure auf, und das
-- prueft USAGE auf dem Schema fuer den AUFRUFENDEN Nutzer (hier ci_schema_reader, siehe
-- db-drift-check.sh, das die Assertion-Datei seit dieser Fixrunde per SET ROLE ci_schema_reader
-- ausfuehrt). Harmlos: EXECUTE auf den einzelnen Funktionen bleibt unveraendert (nicht an PUBLIC
-- vergeben, siehe REVOKE/GRANT je Funktion unten) -- USAGE oeffnet nur die Namensaufloesung im
-- Schema, keinen Aufruf.
GRANT USAGE ON SCHEMA match_engine TO ci_schema_reader;
COMMENT ON SCHEMA match_engine IS
  'B3a/S12: interne Teilfunktionen der SQL-Rechenfunktion (20260928_002_match_engine.sql). Nicht ueber die API exponiert.';

-- Aufraeumen: eine fruehere lokale Fassung dieser (noch nie live eingespielten) Migration legte
-- die Helfer als public.match__* an. Auf frischen Datenbanken ein No-op.
DROP FUNCTION IF EXISTS
  public.match__is_int(jsonb),
  public.match__is_nonneg_int(jsonb),
  public.match__opt_nonneg_int(jsonb, text),
  public.match__num(jsonb),
  public.match__truthy(jsonb),
  public.match__reject(text, jsonb),
  public.match__ok(jsonb),
  public.match__rules_valid(jsonb),
  public.match__team_scores_valid(jsonb, jsonb),
  public.match__payload_valid(jsonb, jsonb),
  public.match__computed_score(jsonb, text),
  public.match__effective_score(jsonb, text),
  public.match__effective_scores(jsonb, jsonb),
  public.match__stale_base_detail(jsonb, jsonb),
  public.match__decided_by(jsonb),
  public.match__snapshot(jsonb, jsonb),
  public.match__canonical(jsonb),
  public.match__start_clock(jsonb),
  public.match__stop_clock(jsonb, jsonb),
  public.match__resume_clock(jsonb, jsonb),
  public.match__adjust_clock(jsonb, jsonb),
  public.match__enter_decision(jsonb, text),
  public.match__shootout_winner(jsonb, jsonb),
  public.match__endcheck(jsonb, jsonb, jsonb),
  public.match__apply_shootout_kick(jsonb, jsonb, jsonb),
  public.match__apply_shootout_end(jsonb, jsonb, jsonb),
  public.match__apply_goal(jsonb, jsonb, jsonb),
  public.match__apply_correction(jsonb, jsonb, jsonb),
  public.match__apply_result_entry(jsonb, jsonb, jsonb),
  public.match__apply_section_end(jsonb, jsonb),
  public.match__apply_section_start(jsonb, jsonb),
  public.match__retract_target_admissible(jsonb, text, text),
  public.match__apply_retract(jsonb, jsonb, jsonb),
  public.match__apply_effect(jsonb, jsonb, jsonb),
  public.match__process(jsonb, jsonb, jsonb, jsonb);


-- ============================================================================================
-- 1. Werte-Helfer (Ganzzahl, Zahl, JS-Wahrheitswert)
-- ============================================================================================

CREATE OR REPLACE FUNCTION match_engine.is_int(p_value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_value) = 'number'
      THEN p_value::numeric = trunc(p_value::numeric) AND abs(p_value::numeric) <= 9007199254740991
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION match_engine.is_nonneg_int(p_value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN match_engine.is_int(p_value) THEN p_value::numeric >= 0 ELSE false END;
$$;

-- zod `.optional()`: Schluessel fehlt -> gueltig; vorhanden (auch als JSON-null) -> muss passen.
CREATE OR REPLACE FUNCTION match_engine.opt_nonneg_int(p_payload jsonb, p_key text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_payload ? p_key THEN match_engine.is_nonneg_int(p_payload -> p_key) ELSE true END;
$$;

-- Zahl aus jsonb, sonst NULL (TS: `event.clockMs ?? …` -- null/fehlend faellt auf den Ersatz).
CREATE OR REPLACE FUNCTION match_engine.num(p_value jsonb) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) = 'number' THEN p_value::numeric END;
$$;

-- JS-Wahrheitswert (TS: `!event.targetId`).
CREATE OR REPLACE FUNCTION match_engine.truthy(p_value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE jsonb_typeof(p_value)
    WHEN 'string' THEN (p_value #>> '{}') <> ''
    WHEN 'number' THEN p_value::numeric <> 0
    WHEN 'boolean' THEN p_value::boolean
    WHEN 'object' THEN true
    WHEN 'array' THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION match_engine.reject(p_code text, p_detail jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object('status', 'rejected', 'code', p_code)
         || CASE WHEN p_detail IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('detail', p_detail) END;
$$;

CREATE OR REPLACE FUNCTION match_engine.ok(p_state jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object('status', 'ok', 'state', p_state);
$$;


-- ============================================================================================
-- 2. Payload-Validierung (payloadValidation.ts, K4 nicht-strikt, S3/S4/S5)
-- ============================================================================================

-- MatchRulesSchema (types.ts): alle Schluessel Pflicht, tiebreak nullable (Schluessel Pflicht).
CREATE OR REPLACE FUNCTION match_engine.rules_valid(p_rules jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF jsonb_typeof(p_rules) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;
  IF NOT match_engine.is_int(p_rules -> 'sections') THEN
    RETURN false;
  END IF;
  IF (p_rules -> 'sections')::numeric NOT IN (1, 2, 3, 4) THEN
    RETURN false;
  END IF;
  IF NOT (match_engine.is_nonneg_int(p_rules -> 'sectionSeconds')
          AND match_engine.is_nonneg_int(p_rules -> 'breakSeconds')
          AND match_engine.is_nonneg_int(p_rules -> 'overtimeSeconds')
          AND match_engine.is_nonneg_int(p_rules -> 'shootersPerTeam')
          AND match_engine.is_nonneg_int(p_rules -> 'suddenDeathAfter')
          AND match_engine.is_nonneg_int(p_rules -> 'penaltySeconds')) THEN
    RETURN false;
  END IF;
  IF jsonb_typeof(p_rules -> 'knockout') IS DISTINCT FROM 'boolean' THEN
    RETURN false;
  END IF;
  IF NOT (p_rules ? 'tiebreak') THEN
    RETURN false;
  END IF;
  IF jsonb_typeof(p_rules -> 'tiebreak') = 'null' THEN
    RETURN true;
  END IF;
  RETURN jsonb_typeof(p_rules -> 'tiebreak') = 'string'
         AND (p_rules ->> 'tiebreak') IN ('shootout', 'overtime-then-shootout', 'goldenGoal');
END;
$$;

-- TeamScoresSchema + "genau beide Teams" (CORRECTION/RESULT_ENTRY).
CREATE OR REPLACE FUNCTION match_engine.team_scores_valid(p_scores jsonb, p_ctx jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF jsonb_typeof(p_scores) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(p_scores) s WHERE NOT match_engine.is_nonneg_int(s.value)) THEN
    RETURN false;
  END IF;
  RETURN (SELECT count(*) FROM jsonb_object_keys(p_scores)) = 2
         AND p_scores ? (p_ctx ->> 'teamAId')
         AND p_scores ? (p_ctx ->> 'teamBId');
END;
$$;

-- isPayloadValid (payloadValidation.ts). Unbekannter Typ: TS wirft (kein Schema); hier
-- INVALID_PAYLOAD (Abweichung fuer Eingaben ausserhalb des TS-Typs, im Report benannt).
CREATE OR REPLACE FUNCTION match_engine.payload_valid(p_event jsonb, p_ctx jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text := p_event ->> 'type';
  v_payload jsonb := p_event -> 'payload';
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
      IF NOT coalesce(jsonb_typeof(v_payload -> 'scored') = 'boolean', false)
         OR NOT match_engine.opt_nonneg_int(v_payload, 'shooterNumber') THEN
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
    WHEN 'SKIP' THEN
      IF v_payload ? 'reason' AND jsonb_typeof(v_payload -> 'reason') <> 'string' THEN
        RETURN false;
      END IF;
    WHEN 'GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD', 'SUBSTITUTION', 'FOUL' THEN
      IF NOT match_engine.opt_nonneg_int(v_payload, 'playerNumber') THEN
        RETURN false;
      END IF;
    WHEN 'TIME_PENALTY' THEN
      IF NOT match_engine.opt_nonneg_int(v_payload, 'playerNumber') THEN
        RETURN false;
      END IF;
      IF v_payload ? 'durationSeconds'
         AND NOT (match_engine.is_int(v_payload -> 'durationSeconds')
                  AND (v_payload -> 'durationSeconds')::numeric > 0) THEN
        RETURN false;
      END IF;
    ELSE
      RETURN false;
  END CASE;

  -- S5 (MR3): team-bezogene Typen brauchen teamId aus {teamAId, teamBId}.
  IF v_type IN ('GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD', 'TIME_PENALTY',
                'FOUL', 'SUBSTITUTION', 'SHOOTOUT_KICK') THEN
    IF NOT coalesce(p_event -> 'teamId' IN (to_jsonb(p_ctx ->> 'teamAId'), to_jsonb(p_ctx ->> 'teamBId')), false) THEN
      RETURN false;
    END IF;
  END IF;

  IF v_type = 'RETRACT' AND NOT match_engine.truthy(p_event -> 'targetId') THEN
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
-- 3. Zustand: Anfang, Stand, decidedBy, kanonischer Inhalt
-- ============================================================================================

CREATE OR REPLACE FUNCTION public.match_initial_state(ctx jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_zero jsonb := '{"regular": 0, "overtime": 0, "shootout": 0}'::jsonb;
BEGIN
  -- MatchContextSchema (types.ts, M10): drei nicht-leere Strings, teamAId <> teamBId.
  IF jsonb_typeof(ctx) IS DISTINCT FROM 'object'
     OR jsonb_typeof(ctx -> 'matchId') IS DISTINCT FROM 'string' OR length(ctx ->> 'matchId') < 1
     OR jsonb_typeof(ctx -> 'teamAId') IS DISTINCT FROM 'string' OR length(ctx ->> 'teamAId') < 1
     OR jsonb_typeof(ctx -> 'teamBId') IS DISTINCT FROM 'string' OR length(ctx ->> 'teamBId') < 1 THEN
    RAISE EXCEPTION 'match_initial_state: ctx braucht matchId, teamAId, teamBId als nicht-leere Strings'
      USING ERRCODE = '22023';
  END IF;
  IF ctx ->> 'teamAId' = ctx ->> 'teamBId' THEN
    RAISE EXCEPTION 'match_initial_state: teamAId und teamBId muessen unterschiedlich sein'
      USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'status', 'scheduled',
    'phase', 'regular',
    'section', 1,
    'rules', NULL,
    'tiebreakMode', NULL,
    'clock', jsonb_build_object('running', false, 'elapsedMs', 0, 'anchorAt', NULL),
    'scores', jsonb_build_object(ctx ->> 'teamAId', v_zero, ctx ->> 'teamBId', v_zero),
    'goals', '[]'::jsonb,
    'overrides', '[]'::jsonb,
    'nextSeq', 0,
    'baseDecidedBy', NULL,
    'shootoutKicks', '[]'::jsonb,
    'accepted', '{}'::jsonb,
    'retracted', '[]'::jsonb,
    'lastScoreEventId', NULL,
    'decidedBy', NULL,
    'finishedAt', NULL
  );
END;
$$;

-- computedScoreFor (types.ts): regular + overtime aus Toren, ohne Ueberschreibungen.
CREATE OR REPLACE FUNCTION match_engine.computed_score(p_state jsonb, p_team text) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((p_state -> 'scores' -> p_team -> 'regular')::numeric
                  + (p_state -> 'scores' -> p_team -> 'overtime')::numeric, 0);
$$;

-- effectiveScoreFor (types.ts, Ruling K1): letzte Ueberschreibung + seitdem gefallene Tore.
CREATE OR REPLACE FUNCTION match_engine.effective_score(p_state jsonb, p_team text) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_array_length(p_state -> 'overrides') = 0 THEN match_engine.computed_score(p_state, p_team)
    ELSE coalesce(match_engine.num(p_state -> 'overrides' -> -1 -> 'scores' -> p_team), 0)
         + match_engine.computed_score(p_state, p_team)
         - coalesce(match_engine.num(p_state -> 'overrides' -> -1 -> 'snapshot' -> p_team), 0)
  END;
$$;

-- `{teamA: effektiv, teamB: effektiv}` in der ctx-Reihenfolge (STALE_BASE-detail).
CREATE OR REPLACE FUNCTION match_engine.effective_scores(p_state jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    p_ctx ->> 'teamAId', match_engine.effective_score(p_state, p_ctx ->> 'teamAId'),
    p_ctx ->> 'teamBId', match_engine.effective_score(p_state, p_ctx ->> 'teamBId'));
$$;

CREATE OR REPLACE FUNCTION match_engine.stale_base_detail(p_state jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'currentScores', match_engine.effective_scores(p_state, p_ctx),
    'lastScoreEventId', coalesce(p_state -> 'lastScoreEventId', 'null'::jsonb));
$$;

-- decidedByFor (types.ts, K1): letzte Ueberschreibung -> correction/direct, sonst baseDecidedBy.
CREATE OR REPLACE FUNCTION match_engine.decided_by(p_state jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_array_length(p_state -> 'overrides') = 0 THEN coalesce(p_state -> 'baseDecidedBy', 'null'::jsonb)
    WHEN p_state -> 'overrides' -> -1 ->> 'kind' = 'correction' THEN '"correction"'::jsonb
    ELSE '"direct"'::jsonb
  END;
$$;

-- Snapshot des aus Toren berechneten Stands (handlers/correction.ts snapshotFor).
CREATE OR REPLACE FUNCTION match_engine.snapshot(p_state jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    p_ctx ->> 'teamAId', match_engine.computed_score(p_state, p_ctx ->> 'teamAId'),
    p_ctx ->> 'teamBId', match_engine.computed_score(p_state, p_ctx ->> 'teamBId'));
$$;

-- K3/S6: kanonischer Inhalt fuer den Duplikat-Vergleich (ohne at/actor/actorUser).
CREATE OR REPLACE FUNCTION match_engine.canonical(p_event jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'type', p_event -> 'type',
    'teamId', p_event -> 'teamId',
    'targetId', p_event -> 'targetId',
    'section', p_event -> 'section',
    'clockMs', p_event -> 'clockMs',
    'payload', p_event -> 'payload'));
$$;


-- ============================================================================================
-- 4. Uhr (handlers/clock.ts, R2 -- Spielzeit statt Wanduhr)
-- ============================================================================================

CREATE OR REPLACE FUNCTION match_engine.start_clock(p_event jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'running', true,
    'elapsedMs', coalesce(match_engine.num(p_event -> 'clockMs'), 0),
    'anchorAt', match_engine.num(p_event -> 'at'));
$$;

-- PAUSE/MATCH_END/SECTION_END/Golden Goal: nur eine laufende Uhr wird neu berechnet.
CREATE OR REPLACE FUNCTION match_engine.stop_clock(p_clock jsonb, p_event jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_at numeric := match_engine.num(p_event -> 'at');
BEGIN
  IF NOT (p_clock -> 'running')::boolean THEN
    RETURN p_clock;
  END IF;
  RETURN jsonb_build_object(
    'running', false,
    'elapsedMs', coalesce(match_engine.num(p_event -> 'clockMs'),
                          (p_clock -> 'elapsedMs')::numeric
                          + (v_at - coalesce(match_engine.num(p_clock -> 'anchorAt'), v_at))),
    'anchorAt', NULL);
END;
$$;

-- RESUME/REOPEN/SECTION_START.
CREATE OR REPLACE FUNCTION match_engine.resume_clock(p_clock jsonb, p_event jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'running', true,
    'anchorAt', match_engine.num(p_event -> 'at'),
    'elapsedMs', coalesce(match_engine.num(p_event -> 'clockMs'), (p_clock -> 'elapsedMs')::numeric));
$$;

CREATE OR REPLACE FUNCTION match_engine.adjust_clock(p_clock jsonb, p_event jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN (p_clock -> 'running')::boolean THEN jsonb_build_object(
      'running', true,
      'elapsedMs', coalesce(match_engine.num(p_event -> 'clockMs'), (p_clock -> 'elapsedMs')::numeric),
      'anchorAt', match_engine.num(p_event -> 'at'))
    ELSE p_clock || jsonb_build_object(
      'elapsedMs', coalesce(match_engine.num(p_event -> 'clockMs'), (p_clock -> 'elapsedMs')::numeric))
  END;
$$;


-- ============================================================================================
-- 5. Entscheidung, Strafstossschiessen, Spielende-Pruefung (tiebreak.ts, shootout.ts, endcheck.ts)
-- ============================================================================================

-- enterDecision: shootout -> Strafstossschiessen; overtime-then-shootout/goldenGoal -> Pause vor
-- der Verlaengerung (section = sections + 1); ohne Modus decision_pending.
CREATE OR REPLACE FUNCTION match_engine.enter_decision(p_state jsonb, p_mode text) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_mode = 'shootout' THEN p_state || '{"status": "shootout", "phase": "shootout"}'::jsonb
    WHEN p_mode IN ('overtime-then-shootout', 'goldenGoal') THEN p_state || jsonb_build_object(
      'status', 'section_break',
      'phase', 'overtime',
      'section', coalesce(match_engine.num(p_state -> 'rules' -> 'sections'), 1) + 1)
    ELSE p_state || '{"status": "decision_pending"}'::jsonb
  END;
$$;

-- shootoutWinner: Sieger-Team-ID oder NULL. (a) uneinholbar innerhalb von shootersPerTeam,
-- (b) Sudden Death bei gleicher Schusszahl >= shootersPerTeam und ungleichen Treffern.
-- suddenDeathAfter wird wie in TS bewusst nicht ausgewertet.
CREATE OR REPLACE FUNCTION match_engine.shootout_winner(p_state jsonb, p_ctx jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_a text := p_ctx ->> 'teamAId';
  v_team_b text := p_ctx ->> 'teamBId';
  v_shooters numeric := coalesce(match_engine.num(p_state -> 'rules' -> 'shootersPerTeam'), 0);
  v_a_kicks numeric;
  v_a_goals numeric;
  v_b_kicks numeric;
  v_b_goals numeric;
BEGIN
  SELECT count(*) FILTER (WHERE k ->> 'teamId' = v_team_a),
         count(*) FILTER (WHERE k ->> 'teamId' = v_team_a AND k -> 'scored' = 'true'::jsonb),
         count(*) FILTER (WHERE k ->> 'teamId' = v_team_b),
         count(*) FILTER (WHERE k ->> 'teamId' = v_team_b AND k -> 'scored' = 'true'::jsonb)
    INTO v_a_kicks, v_a_goals, v_b_kicks, v_b_goals
    FROM jsonb_array_elements(p_state -> 'shootoutKicks') AS k;

  IF v_a_kicks <= v_shooters AND v_b_kicks <= v_shooters THEN
    IF v_b_goals + (v_shooters - v_b_kicks) < v_a_goals THEN
      RETURN v_team_a;
    END IF;
    IF v_a_goals + (v_shooters - v_a_kicks) < v_b_goals THEN
      RETURN v_team_b;
    END IF;
  END IF;
  IF v_a_kicks = v_b_kicks AND v_a_kicks >= v_shooters AND v_a_goals <> v_b_goals THEN
    RETURN CASE WHEN v_a_goals > v_b_goals THEN v_team_a ELSE v_team_b END;
  END IF;
  RETURN NULL;
END;
$$;

-- runEndCheck (@endcheck, R5): kein K.o. oder kein Remis -> finished (regular/overtime/goldenGoal);
-- K.o.-Remis nach Verlaengerung -> Strafstossschiessen; nach regulaerer Zeit -> je Modus.
CREATE OR REPLACE FUNCTION match_engine.endcheck(p_state jsonb, p_event jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_draw boolean := match_engine.effective_score(p_state, p_ctx ->> 'teamAId')
                       = match_engine.effective_score(p_state, p_ctx ->> 'teamBId');
  v_is_knockout boolean := coalesce(p_state -> 'rules' -> 'knockout' = 'true'::jsonb, false);
  v_phase text := p_state ->> 'phase';
BEGIN
  IF NOT v_is_knockout OR NOT v_is_draw THEN
    RETURN p_state || jsonb_build_object(
      'status', 'finished',
      'baseDecidedBy', CASE
        WHEN v_phase <> 'overtime' THEN 'regular'
        WHEN p_event ->> 'type' IN ('GOAL', 'OWN_GOAL') THEN 'goldenGoal'
        ELSE 'overtime'
      END,
      'finishedAt', match_engine.num(p_event -> 'at'));
  END IF;
  IF v_phase = 'overtime' THEN
    RETURN p_state || '{"status": "shootout", "phase": "shootout"}'::jsonb;
  END IF;
  RETURN match_engine.enter_decision(p_state, p_state ->> 'tiebreakMode');
END;
$$;

CREATE OR REPLACE FUNCTION match_engine.apply_shootout_kick(p_state jsonb, p_event jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team text := p_event ->> 'teamId';
  v_state jsonb;
BEGIN
  -- B-U13: Sieger steht schon fest (Zustand VOR dem Schuss) -> Geraet muss SHOOTOUT_END senden.
  IF match_engine.shootout_winner(p_state, p_ctx) IS NOT NULL THEN
    RETURN match_engine.reject('INVALID_TRANSITION', '{"reason": "WINNER_DETERMINED"}'::jsonb);
  END IF;
  v_state := jsonb_set(p_state, '{shootoutKicks}', (p_state -> 'shootoutKicks') || jsonb_build_array(
    jsonb_build_object('id', p_event -> 'id', 'teamId', p_event -> 'teamId', 'scored', p_event -> 'payload' -> 'scored')));
  IF p_event -> 'payload' -> 'scored' = 'true'::jsonb THEN
    v_state := jsonb_set(v_state, ARRAY['scores', v_team, 'shootout'],
                         to_jsonb((v_state -> 'scores' -> v_team -> 'shootout')::numeric + 1));
  END IF;
  RETURN match_engine.ok(v_state);
END;
$$;

CREATE OR REPLACE FUNCTION match_engine.apply_shootout_end(p_state jsonb, p_event jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN match_engine.shootout_winner(p_state, p_ctx) IS NULL THEN match_engine.reject('NO_WINNER', jsonb_build_object(
      'shootoutScores', jsonb_build_object(
        p_ctx ->> 'teamAId', p_state -> 'scores' -> (p_ctx ->> 'teamAId') -> 'shootout',
        p_ctx ->> 'teamBId', p_state -> 'scores' -> (p_ctx ->> 'teamBId') -> 'shootout')))
    ELSE match_engine.ok(p_state || jsonb_build_object(
      'baseDecidedBy', 'shootout',
      'finishedAt', match_engine.num(p_event -> 'at')))
  END;
$$;


-- ============================================================================================
-- 6. Tor, Korrektur, Direkteintrag, Abschnitte
-- ============================================================================================

-- applyGoal (records.ts) + Golden Goal (applyEvent.ts applyGoalEvent, B-U3). K5: Tor merkt sich
-- seine Phase; S7: Log-Position ueber nextSeq.
CREATE OR REPLACE FUNCTION match_engine.apply_goal(p_state jsonb, p_event jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team text := p_event ->> 'teamId';
  v_scoring text;
  v_phase_key text := CASE WHEN p_state ->> 'phase' = 'overtime' THEN 'overtime' ELSE 'regular' END;
  v_state jsonb;
BEGIN
  v_scoring := CASE
    WHEN p_event ->> 'type' = 'OWN_GOAL' THEN
      CASE WHEN v_team = p_ctx ->> 'teamAId' THEN p_ctx ->> 'teamBId' ELSE p_ctx ->> 'teamAId' END
    ELSE v_team
  END;
  v_state := jsonb_set(p_state, ARRAY['scores', v_scoring, v_phase_key],
                       to_jsonb((p_state -> 'scores' -> v_scoring -> v_phase_key)::numeric + 1));
  v_state := v_state || jsonb_build_object(
    'goals', (v_state -> 'goals') || jsonb_build_array(jsonb_build_object(
      'id', p_event -> 'id', 'scoringTeamId', v_scoring, 'phase', v_phase_key, 'seq', v_state -> 'nextSeq')),
    'nextSeq', (v_state -> 'nextSeq')::numeric + 1,
    'lastScoreEventId', p_event -> 'id');

  IF v_state ->> 'phase' = 'overtime' AND v_state ->> 'tiebreakMode' = 'goldenGoal' THEN
    v_state := jsonb_set(v_state, '{clock}', match_engine.stop_clock(v_state -> 'clock', p_event));
    v_state := match_engine.endcheck(v_state, p_event, p_ctx);
  END IF;
  RETURN v_state;
END;
$$;

-- CORRECTION (R8, K1): basedOn muss letztem standaendernden Ereignis entsprechen, sonst STALE_BASE.
CREATE OR REPLACE FUNCTION match_engine.apply_correction(p_state jsonb, p_event jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN (p_event -> 'payload' -> 'basedOn') IS DISTINCT FROM coalesce(p_state -> 'lastScoreEventId', 'null'::jsonb)
      THEN match_engine.reject('STALE_BASE', match_engine.stale_base_detail(p_state, p_ctx))
    ELSE match_engine.ok(p_state || jsonb_build_object(
      'overrides', (p_state -> 'overrides') || jsonb_build_array(jsonb_build_object(
        'id', p_event -> 'id',
        'kind', 'correction',
        'scores', p_event -> 'payload' -> 'scores',
        'snapshot', match_engine.snapshot(p_state, p_ctx),
        'seq', p_state -> 'nextSeq')),
      'nextSeq', (p_state -> 'nextSeq')::numeric + 1,
      'lastScoreEventId', p_event -> 'id'))
  END;
$$;

-- RESULT_ENTRY (K1): Direkteintrag als Ueberschreibung, beendet das Spiel (Status via Tabelle).
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
      'seq', p_state -> 'nextSeq')),
    'nextSeq', (p_state -> 'nextSeq')::numeric + 1,
    'finishedAt', match_engine.num(p_event -> 'at'),
    'lastScoreEventId', p_event -> 'id');
$$;

-- SECTION_END (B-U14/B-U2): in der Verlaengerung OVERTIME, im letzten Abschnitt LAST_SECTION.
CREATE OR REPLACE FUNCTION match_engine.apply_section_end(p_state jsonb, p_event jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_state ->> 'phase' <> 'regular'
      THEN match_engine.reject('INVALID_TRANSITION', '{"reason": "OVERTIME"}'::jsonb)
    WHEN (p_state -> 'section')::numeric >= coalesce(match_engine.num(p_state -> 'rules' -> 'sections'), 1)
      THEN match_engine.reject('INVALID_TRANSITION', '{"reason": "LAST_SECTION"}'::jsonb)
    ELSE match_engine.ok(jsonb_set(p_state, '{clock}', match_engine.stop_clock(p_state -> 'clock', p_event)))
  END;
$$;

CREATE OR REPLACE FUNCTION match_engine.apply_section_start(p_state jsonb, p_event jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT p_state || jsonb_build_object(
    'section', CASE WHEN p_state ->> 'phase' = 'regular' THEN (p_state -> 'section')::numeric + 1
                    ELSE (p_state -> 'section')::numeric END,
    'clock', match_engine.resume_clock(p_state -> 'clock', p_event));
$$;


-- ============================================================================================
-- 7. RETRACT (handlers/retract.ts, Pruefreihenfolge B-U16)
-- ============================================================================================

-- Zieltyp-Zulaessigkeit je Status/Phase (K10, B-U10, B-U6/B-U12, B-U15) -- false => INVALID_PAYLOAD.
-- Die Tor-Phase kommt aus `goals` (bleibt auch nach Ruecknahme erhalten).
CREATE OR REPLACE FUNCTION match_engine.retract_target_admissible(p_state jsonb, p_target_id text, p_target_type text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text := p_state ->> 'status';
BEGIN
  IF p_target_type NOT IN ('GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD', 'TIME_PENALTY',
                           'FOUL', 'SUBSTITUTION', 'CORRECTION', 'SHOOTOUT_KICK') THEN
    RETURN false;
  END IF;
  IF v_status = 'shootout' THEN
    RETURN p_target_type = 'SHOOTOUT_KICK';
  END IF;
  IF p_target_type = 'SHOOTOUT_KICK' THEN
    RETURN false;
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
  IF NOT match_engine.retract_target_admissible(p_state, v_target_id, v_target_type) THEN
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
-- 8. Wirkung je Typ, applyEvent, reduceMatch/applyBatch, serverState
-- ============================================================================================

-- applyTypeSpecificEffect (applyEvent.ts): liefert {status:'ok',state} oder eine Ablehnung.
CREATE OR REPLACE FUNCTION match_engine.apply_effect(p_state jsonb, p_event jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rules jsonb;
  v_mode text;
BEGIN
  CASE p_event ->> 'type'
    WHEN 'MATCH_START' THEN
      v_rules := p_event -> 'payload' -> 'rules';
      RETURN match_engine.ok(p_state || jsonb_build_object(
        'rules', v_rules,
        'tiebreakMode', coalesce(v_rules -> 'tiebreak', 'null'::jsonb),
        'phase', 'regular',
        'section', 1,
        'clock', match_engine.start_clock(p_event)));
    WHEN 'PAUSE', 'MATCH_END' THEN
      RETURN match_engine.ok(jsonb_set(p_state, '{clock}', match_engine.stop_clock(p_state -> 'clock', p_event)));
    WHEN 'RESUME' THEN
      RETURN match_engine.ok(jsonb_set(p_state, '{clock}', match_engine.resume_clock(p_state -> 'clock', p_event)));
    WHEN 'REOPEN' THEN
      -- B-U11: nach Strafstossschiessen nicht wiedereroeffnen (Leitung korrigiert per CORRECTION).
      IF p_state ->> 'phase' = 'shootout' THEN
        RETURN match_engine.reject('INVALID_TRANSITION', '{"reason": "SHOOTOUT_FINISHED"}'::jsonb);
      END IF;
      RETURN match_engine.ok(p_state || jsonb_build_object(
        'clock', match_engine.resume_clock(p_state -> 'clock', p_event),
        'finishedAt', NULL,
        'baseDecidedBy', NULL));
    WHEN 'CLOCK_ADJUST' THEN
      RETURN match_engine.ok(jsonb_set(p_state, '{clock}', match_engine.adjust_clock(p_state -> 'clock', p_event)));
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
      RETURN match_engine.ok(match_engine.enter_decision(p_state || jsonb_build_object('tiebreakMode', v_mode), v_mode));
    WHEN 'SHOOTOUT_KICK' THEN
      RETURN match_engine.apply_shootout_kick(p_state, p_event, p_ctx);
    WHEN 'SHOOTOUT_END' THEN
      RETURN match_engine.apply_shootout_end(p_state, p_event, p_ctx);
    WHEN 'RESULT_ENTRY' THEN
      RETURN match_engine.ok(match_engine.apply_result_entry(p_state, p_event, p_ctx));
    ELSE
      -- Karten/Zeitstrafe/Foul/Wechsel (nur TS-Listen, R18), SKIP/UNSKIP (reiner Statuswechsel).
      RETURN match_engine.ok(p_state);
  END CASE;
END;
$$;

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

  -- 5. Typspezifische Wirkung, dann `to`.
  v_effect := match_engine.apply_effect(state, event, ctx);
  IF v_effect ->> 'status' = 'rejected' THEN
    RETURN v_effect;
  END IF;
  v_state := v_effect -> 'state';
  IF v_row ->> 'to' = '@endcheck' THEN
    v_state := match_engine.endcheck(v_state, event, ctx);
  ELSIF v_row ->> 'to' <> '=' THEN
    v_state := v_state || jsonb_build_object('status', v_row ->> 'to');
  END IF;

  -- K1: decidedBy zentral ableiten; Ereignis als angenommen fuehren (kanonisch, K3).
  v_state := v_state || jsonb_build_object(
    'decidedBy', match_engine.decided_by(v_state),
    'accepted', (v_state -> 'accepted') || jsonb_build_object(event ->> 'id', match_engine.canonical(event)));
  RETURN jsonb_build_object('status', 'accepted', 'state', v_state);
END;
$$;

-- processEvent (reduceMatch.ts): Duplikat/ID_CONFLICT (R11, K3) vor applyEvent.
CREATE OR REPLACE FUNCTION match_engine.process(p_state jsonb, p_event jsonb, p_ctx jsonb, p_transitions jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing jsonb := p_state -> 'accepted' -> (p_event ->> 'id');
  v_outcome jsonb;
BEGIN
  IF v_existing IS NOT NULL THEN
    IF v_existing = match_engine.canonical(p_event) THEN
      RETURN jsonb_build_object('state', p_state,
                                'result', jsonb_build_object('id', p_event -> 'id', 'status', 'duplicate'));
    END IF;
    RETURN jsonb_build_object('state', p_state,
                              'result', jsonb_build_object('id', p_event -> 'id', 'status', 'rejected', 'code', 'ID_CONFLICT'));
  END IF;

  v_outcome := public.match_apply_event(p_state, p_event, p_ctx, p_transitions);
  IF v_outcome ->> 'status' IN ('accepted', 'noop') THEN
    RETURN jsonb_build_object('state', v_outcome -> 'state',
                              'result', jsonb_build_object('id', p_event -> 'id', 'status', v_outcome ->> 'status'));
  END IF;
  RETURN jsonb_build_object('state', p_state,
                            'result', jsonb_build_object('id', p_event -> 'id', 'status', 'rejected', 'code', v_outcome -> 'code')
                                      || CASE WHEN v_outcome ? 'detail'
                                              THEN jsonb_build_object('detail', v_outcome -> 'detail')
                                              ELSE '{}'::jsonb END);
END;
$$;

-- continueLog (mode 'log') bzw. applyBatch (mode 'batch', R12: abgelehnter zustandsaendernder
-- Schritt -> alle folgenden DEPENDS_ON_REJECTED, Zustand unveraendert).
CREATE OR REPLACE FUNCTION public.match_continue(state jsonb, events jsonb, ctx jsonb, transitions jsonb, mode text DEFAULT 'log')
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_state jsonb := state;
  v_results jsonb := '[]'::jsonb;
  v_cascade boolean := false;
  v_event jsonb;
  v_step jsonb;
BEGIN
  IF mode IS NULL OR mode NOT IN ('log', 'batch') THEN
    RAISE EXCEPTION 'match_continue: mode muss log oder batch sein (war: %)', mode USING ERRCODE = '22023';
  END IF;

  FOR v_event IN
    SELECT e FROM jsonb_array_elements(coalesce(events, '[]'::jsonb)) WITH ORDINALITY AS x(e, ord) ORDER BY ord
  LOOP
    IF v_cascade THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'id', v_event -> 'id', 'status', 'rejected', 'code', 'DEPENDS_ON_REJECTED'));
      CONTINUE;
    END IF;

    v_step := match_engine.process(v_state, v_event, ctx, transitions);
    v_state := v_step -> 'state';
    v_results := v_results || jsonb_build_array(v_step -> 'result');

    IF mode = 'batch' AND v_step -> 'result' ->> 'status' = 'rejected'
       AND v_event ->> 'type' IN ('MATCH_START', 'RESUME', 'SECTION_START', 'REOPEN', 'UNSKIP') THEN
      v_cascade := true;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('state', v_state, 'results', v_results);
END;
$$;

CREATE OR REPLACE FUNCTION public.match_reduce(events jsonb, ctx jsonb, transitions jsonb, mode text DEFAULT 'log')
RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT public.match_continue(public.match_initial_state(ctx), events, ctx, transitions, mode);
$$;

-- toServerState (serverState.ts, Ruling P2): exakt diese Form; decidedBy nur bei finished (K11).
CREATE OR REPLACE FUNCTION public.match_server_state(state jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'status', state -> 'status',
    'phase', state -> 'phase',
    'section', state -> 'section',
    'clock', jsonb_build_object(
      'running', state -> 'clock' -> 'running',
      'elapsedMs', state -> 'clock' -> 'elapsedMs',
      'anchorAt', coalesce(state -> 'clock' -> 'anchorAt', 'null'::jsonb)),
    'scores', coalesce((
      SELECT jsonb_object_agg(s.key, jsonb_build_object(
        'regular', s.value -> 'regular', 'overtime', s.value -> 'overtime', 'shootout', s.value -> 'shootout'))
      FROM jsonb_each(state -> 'scores') AS s), '{}'::jsonb),
    'effectiveScores', coalesce((
      SELECT jsonb_object_agg(s.key, match_engine.effective_score(state, s.key))
      FROM jsonb_each(state -> 'scores') AS s), '{}'::jsonb),
    'shootoutKicks', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', k -> 'id', 'teamId', k -> 'teamId', 'scored', k -> 'scored') ORDER BY ord)
      FROM jsonb_array_elements(state -> 'shootoutKicks') WITH ORDINALITY AS x(k, ord)), '[]'::jsonb),
    'lastScoreEventId', coalesce(state -> 'lastScoreEventId', 'null'::jsonb),
    'decidedBy', CASE WHEN state ->> 'status' = 'finished' THEN coalesce(state -> 'decidedBy', 'null'::jsonb)
                      ELSE 'null'::jsonb END,
    'finishedAt', coalesce(state -> 'finishedAt', 'null'::jsonb));
$$;


-- ============================================================================================
-- 9. compute_match_state -- STABLE, SECURITY INVOKER (R17: RLS gilt)
-- ============================================================================================
--
-- Liest ctx aus matches, die gespeicherten Engine-Ereignisse (event_format IS NOT NULL, ohne
-- Pruef-Zustand, in seq-Reihenfolge) und die Uebergaenge aus match_transitions -- jeweils mit den
-- Rechten des Aufrufers. Sieht der Aufrufer das Spiel nicht: NULL. Spiel ohne beide Teams:
-- match_initial_state wirft (wie initialState in TS).
CREATE OR REPLACE FUNCTION public.compute_match_state(p_match_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_a uuid;
  v_team_b uuid;
  v_ctx jsonb;
  v_events jsonb;
  v_transitions jsonb;
BEGIN
  SELECT m.team_a_id, m.team_b_id INTO v_team_a, v_team_b
    FROM public.matches m
   WHERE m.id = p_match_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_ctx := jsonb_build_object('matchId', p_match_id::text, 'teamAId', v_team_a::text, 'teamBId', v_team_b::text);

  -- S1: actor = 'leitung' (Obermenge, beim Anhaengen wurde der echte Akteur geprueft).
  -- S2: at = Epoch-ms aus client_time (von B3b geklemmt), sonst recorded_at.
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
    INTO v_events
    FROM public.match_events e
   WHERE e.match_id = p_match_id
     AND e.event_format IS NOT NULL
     AND e.review_state IS NULL;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'from', t.from_status, 'type', t.event_type, 'actor', t.actor, 'to', t.to_status)
           ORDER BY t.from_status, t.event_type), '[]'::jsonb)
    INTO v_transitions
    FROM public.match_transitions t;

  RETURN public.match_server_state(public.match_reduce(v_events, v_ctx, v_transitions, 'log') -> 'state');
END;
$$;


-- ============================================================================================
-- 10. Rechte (R17)
-- ============================================================================================
--
-- compute_match_state: authenticated + anon (liest nur, was RLS erlaubt; Public View/Monitor).
-- Reine Funktionen (6 in public) und interne Teilfunktionen (35 in match_engine, Schema-USAGE
-- siehe Abschnitt 0): REVOKE ALL FROM PUBLIC, EXECUTE fuer authenticated, anon, service_role.
-- Die Teilfunktionen MUESSEN mitgegeben werden, weil
-- compute_match_state SECURITY INVOKER ist -- sie laufen mit den Rechten des Aufrufers. Sie
-- lesen nichts und schreiben nichts (unschaedlich). service_role zusaetzlich auch fuer
-- compute_match_state (Server-Werkzeuge, RLS-frei; keine Erweiterung gegenueber heute, die Rolle
-- liest die Tabellen ohnehin).

REVOKE ALL ON FUNCTION
  match_engine.is_int(jsonb),
  match_engine.is_nonneg_int(jsonb),
  match_engine.opt_nonneg_int(jsonb, text),
  match_engine.num(jsonb),
  match_engine.truthy(jsonb),
  match_engine.reject(text, jsonb),
  match_engine.ok(jsonb),
  match_engine.rules_valid(jsonb),
  match_engine.team_scores_valid(jsonb, jsonb),
  match_engine.payload_valid(jsonb, jsonb),
  match_engine.computed_score(jsonb, text),
  match_engine.effective_score(jsonb, text),
  match_engine.effective_scores(jsonb, jsonb),
  match_engine.stale_base_detail(jsonb, jsonb),
  match_engine.decided_by(jsonb),
  match_engine.snapshot(jsonb, jsonb),
  match_engine.canonical(jsonb),
  match_engine.start_clock(jsonb),
  match_engine.stop_clock(jsonb, jsonb),
  match_engine.resume_clock(jsonb, jsonb),
  match_engine.adjust_clock(jsonb, jsonb),
  match_engine.enter_decision(jsonb, text),
  match_engine.shootout_winner(jsonb, jsonb),
  match_engine.endcheck(jsonb, jsonb, jsonb),
  match_engine.apply_shootout_kick(jsonb, jsonb, jsonb),
  match_engine.apply_shootout_end(jsonb, jsonb, jsonb),
  match_engine.apply_goal(jsonb, jsonb, jsonb),
  match_engine.apply_correction(jsonb, jsonb, jsonb),
  match_engine.apply_result_entry(jsonb, jsonb, jsonb),
  match_engine.apply_section_end(jsonb, jsonb),
  match_engine.apply_section_start(jsonb, jsonb),
  match_engine.retract_target_admissible(jsonb, text, text),
  match_engine.apply_retract(jsonb, jsonb, jsonb),
  match_engine.apply_effect(jsonb, jsonb, jsonb),
  match_engine.process(jsonb, jsonb, jsonb, jsonb),
  public.match_initial_state(jsonb),
  public.match_apply_event(jsonb, jsonb, jsonb, jsonb),
  public.match_continue(jsonb, jsonb, jsonb, jsonb, text),
  public.match_reduce(jsonb, jsonb, jsonb, text),
  public.match_server_state(jsonb),
  public.compute_match_state(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  match_engine.is_int(jsonb),
  match_engine.is_nonneg_int(jsonb),
  match_engine.opt_nonneg_int(jsonb, text),
  match_engine.num(jsonb),
  match_engine.truthy(jsonb),
  match_engine.reject(text, jsonb),
  match_engine.ok(jsonb),
  match_engine.rules_valid(jsonb),
  match_engine.team_scores_valid(jsonb, jsonb),
  match_engine.payload_valid(jsonb, jsonb),
  match_engine.computed_score(jsonb, text),
  match_engine.effective_score(jsonb, text),
  match_engine.effective_scores(jsonb, jsonb),
  match_engine.stale_base_detail(jsonb, jsonb),
  match_engine.decided_by(jsonb),
  match_engine.snapshot(jsonb, jsonb),
  match_engine.canonical(jsonb),
  match_engine.start_clock(jsonb),
  match_engine.stop_clock(jsonb, jsonb),
  match_engine.resume_clock(jsonb, jsonb),
  match_engine.adjust_clock(jsonb, jsonb),
  match_engine.enter_decision(jsonb, text),
  match_engine.shootout_winner(jsonb, jsonb),
  match_engine.endcheck(jsonb, jsonb, jsonb),
  match_engine.apply_shootout_kick(jsonb, jsonb, jsonb),
  match_engine.apply_shootout_end(jsonb, jsonb, jsonb),
  match_engine.apply_goal(jsonb, jsonb, jsonb),
  match_engine.apply_correction(jsonb, jsonb, jsonb),
  match_engine.apply_result_entry(jsonb, jsonb, jsonb),
  match_engine.apply_section_end(jsonb, jsonb),
  match_engine.apply_section_start(jsonb, jsonb),
  match_engine.retract_target_admissible(jsonb, text, text),
  match_engine.apply_retract(jsonb, jsonb, jsonb),
  match_engine.apply_effect(jsonb, jsonb, jsonb),
  match_engine.process(jsonb, jsonb, jsonb, jsonb),
  public.match_initial_state(jsonb),
  public.match_apply_event(jsonb, jsonb, jsonb, jsonb),
  public.match_continue(jsonb, jsonb, jsonb, jsonb, text),
  public.match_reduce(jsonb, jsonb, jsonb, text),
  public.match_server_state(jsonb),
  public.compute_match_state(uuid)
TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.match_apply_event(jsonb, jsonb, jsonb, jsonb) IS
  'B3a: SQL-Zwilling von applyEvent (src/core/match/applyEvent.ts). Rein/IMMUTABLE. Gleichlauf:
   scripts/match-engine-parity.sh (alle Fixtures, SQL == TS == expect).';
COMMENT ON FUNCTION public.compute_match_state(uuid) IS
  'B3a: serverState eines Spiels aus den gespeicherten Engine-Ereignissen (event_format IS NOT NULL,
   review_state IS NULL, ORDER BY seq). SECURITY INVOKER -- RLS gilt (R17). actor = leitung (S1).';
