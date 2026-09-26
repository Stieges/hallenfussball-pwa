-- C0b (.superpowers/sdd/2026-09-26-pr-c-ausgang/task-C0b-brief.md, PR C): SQL-Zwilling fuer die
-- C0a-Erweiterungen der TS-Rechenfunktion (src/core/match/, Commits 5308520 + c90d68d) und
-- Spalten-Schutz der Ergebnis-Spalten von Engine-Spielen.
--
-- Warum: C0a hat die TS-Rechenfunktion um das Ereignis AMEND (Angaben nachtragen/aendern, D-C4/
-- D-C6), den Zustand `details` (Angaben je Ereignis, V1), die Abschnittsuhr `sectionStartMs`/
-- `breakStartedAt` (V2), den rules-freien Duplikatvergleich beim MATCH_START (V3) und sechs neue
-- live_state-Schluessel (RC12) erweitert. TS ist die REFERENZ -- diese Migration bringt dieselbe
-- Logik in den SQL-Zwilling (Schema match_engine/public aus 20260928_002/_003). Gleichlauf
-- erzwingt scripts/match-engine-parity.sh (Ergebnisse, serverState, details, Abschnittsuhr,
-- cache_columns, server_rules -- SQL == TS == expect), den Schreibweg scripts/append-match-events-
-- check.sh.
--
-- Inhalt:
--   1. Typ-CHECKs match_events_type_check / match_transitions_event_type_check + 'AMEND' (V7: DROP +
--      ADD, kein NOT VALID/VALIDATE -- die Tabellen sind klein, lock_timeout begrenzt die Sperre).
--   2. match_transitions: die sechs AMEND-Zeilen exakt wie src/core/match/matchTransitions.json.
--   3. Rechenfunktion (CREATE OR REPLACE, Verhalten exakt wie TS, Vertrag task-C0a-report.md §3):
--      match_initial_state (details/sectionStartMs/breakStartedAt), payload_valid (AMEND-Schema, neue
--      optionale Felder der Zieltypen, playerId-Regex auf Kleinbuchstaben ohne lower()),
--      enter_decision (jetzt mit `at`, Pause vor der Verlaengerung setzt breakStartedAt), endcheck,
--      apply_section_end/apply_section_start (Abschnittsuhr), apply_effect (MATCH_START, REOPEN,
--      TIEBREAK_CHOICE, AMEND), match_apply_event (details bei Annahme eines Zielereignisses),
--      process (Duplikatvergleich ohne payload.rules beim MATCH_START, `accepted` unveraendert
--      canonical(event)); neue Helfer detail_value_valid, detail_fields, details_from_payload,
--      apply_amend.
--   4. Schreibweg-Helfer (definer-only, B3b): cfg_num (PC5: nur ASCII-Leerraum), envelope (AMEND
--      in der Typliste, targetId bei AMEND), cache_columns (sechs neue live_state-Schluessel).
--   4b. append_match_events (Fixrunde 1, M2): Zwischenspeicher pflegt skipped_at/skipped_reason.
--   5. Spalten-Schutz (V4, Ruling PC2): public.matches_guard_engine_columns() + BEFORE-UPDATE-Trigger,
--      Fixrunde 1 (M1/M3): Definer-Helfer public.match_has_engine_events, CREATE OR REPLACE TRIGGER.
--   6. Rechte.
--
-- Nicht geaendert (V15, belegt): match_events_guard_engine_rows (legacy_types bleiben -- AMEND ist
-- ein NEUER Typ, darf also wie alle Engine-Typen nur ueber append_match_events geschrieben werden),
-- retract_target_admissible/apply_retract (AMEND steht nicht in RETRACTABLE_EVENT_TYPES -> RETRACT
-- auf AMEND = INVALID_PAYLOAD, Fixture 53), compute_match_state. append_match_events erst ab
-- Fixrunde 1 (4b, nur skipped_at/skipped_reason im Zwischenspeicher).
--
-- Bekannte Grenzen (kein Fix, Brief-Nachtrag):
--   - targetId: TS vergleicht woertlich, SQL normalisiert per normalize_uuid auf Kleinbuchstaben
--     (wie RETRACT) -- der Client schreibt immer klein (C3), der Harness nutzt nur kleine IDs.
--   - JSON-Zahlen mit > 17 signifikanten Stellen bzw. ausserhalb double: SQL rechnet exakt, TS
--     gerundet -- irrelevant, weil `config` nur per JSON.stringify geschrieben wird.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS + ADD, INSERT ... ON CONFLICT DO NOTHING, CREATE OR
-- REPLACE, DROP FUNCTION/TRIGGER IF EXISTS, REVOKE/GRANT. Rueckweg: die PR-B-Fassungen der
-- Funktionen aus 20260928_002/_003 erneut einspielen, DROP der vier neuen Helfer und von
-- match_engine.enter_decision(jsonb,text,numeric), DROP TRIGGER/FUNCTION
-- matches_guard_engine_columns und public.match_has_engine_events, AMEND-Zeilen aus match_transitions loeschen (nur solange keine
-- AMEND-Zeile in match_events steht), Typ-CHECKs ohne AMEND. Produktion: erst am Ende von PR C
-- zusammen mit Deploy + Merge (Ruling PC1), nach Daniels Freigabe des woertlichen SQL.

SET LOCAL lock_timeout = '5s';


-- ============================================================================================
-- 0. Voraussetzungen (Fail-fast wie 20260928_002/_003)
-- ============================================================================================

DO $$
BEGIN
  IF to_regclass('public.match_transitions') IS NULL
     OR to_regprocedure('public.match_continue(jsonb,jsonb,jsonb,jsonb,text)') IS NULL
     OR to_regprocedure('match_engine.enter_decision(jsonb,text)') IS NULL
        AND to_regprocedure('match_engine.enter_decision(jsonb,text,numeric)') IS NULL THEN
    RAISE EXCEPTION '20261001_001_amend_event: SQL-Rechenfunktion fehlt -- zuerst 20260928_001 und 20260928_002 einspielen';
  END IF;
  IF to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)') IS NULL
     OR to_regprocedure('match_engine.cache_columns(jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION '20261001_001_amend_event: Schreibweg fehlt -- zuerst 20260928_003_append_match_events.sql einspielen';
  END IF;
END;
$$;


-- ============================================================================================
-- 1. Typ-CHECKs (V7, V15)
-- ============================================================================================

ALTER TABLE "public"."match_events" DROP CONSTRAINT IF EXISTS "match_events_type_check";
ALTER TABLE "public"."match_events" ADD CONSTRAINT "match_events_type_check"
  CHECK ("type" = ANY (ARRAY[
    -- Alte 14 (20260918_001, unveraendert):
    'GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD',
    'TIME_PENALTY', 'TIME_PENALTY_END', 'SUBSTITUTION', 'TIMEOUT', 'STATUS_CHANGE',
    'RESULT_EDIT', 'NOTE', 'FOUL', 'HALFTIME',
    -- 18 aus 20260928_001 (R6):
    'MATCH_START', 'PAUSE', 'RESUME', 'SECTION_END', 'SECTION_START', 'CLOCK_ADJUST',
    'MATCH_END', 'TIEBREAK_CHOICE', 'SHOOTOUT_KICK', 'SHOOTOUT_END', 'RETRACT', 'CORRECTION',
    'REOPEN', 'SKIP', 'UNSKIP', 'RESULT_ENTRY', 'REVIEW_ACCEPT', 'REVIEW_DISCARD',
    -- C0a/C0b (D-C4): src/core/match/types.ts#EventTypeSchema, letzter Eintrag.
    'AMEND'
  ]::text[]));

ALTER TABLE "public"."match_transitions" DROP CONSTRAINT IF EXISTS "match_transitions_event_type_check";
ALTER TABLE "public"."match_transitions" ADD CONSTRAINT "match_transitions_event_type_check" CHECK (
  "event_type" IN (
    'GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD',
    'TIME_PENALTY', 'TIME_PENALTY_END', 'SUBSTITUTION', 'TIMEOUT', 'STATUS_CHANGE',
    'RESULT_EDIT', 'NOTE', 'FOUL', 'HALFTIME',
    'MATCH_START', 'PAUSE', 'RESUME', 'SECTION_END', 'SECTION_START', 'CLOCK_ADJUST',
    'MATCH_END', 'TIEBREAK_CHOICE', 'SHOOTOUT_KICK', 'SHOOTOUT_END', 'RETRACT', 'CORRECTION',
    'REOPEN', 'SKIP', 'UNSKIP', 'RESULT_ENTRY', 'REVIEW_ACCEPT', 'REVIEW_DISCARD',
    'AMEND'
  )
);


-- ============================================================================================
-- 2. match_transitions: AMEND (D-C6) -- exakt src/core/match/matchTransitions.json
-- ============================================================================================
--
-- Akteur `helper` (Turnierleitung ist Obermenge, R7) in allen Zustaenden eines gestarteten Spiels
-- einschliesslich `finished`; keine Zeile in `scheduled`/`skipped` (INVALID_TRANSITION). Die
-- Nachtrag-Regel fuer Helfer in `finished` prueft die Rechenfunktion (apply_amend, Schritt 7).

INSERT INTO "public"."match_transitions" ("from_status", "event_type", "actor", "to_status") VALUES
  ('running', 'AMEND', 'helper', '='),
  ('paused', 'AMEND', 'helper', '='),
  ('section_break', 'AMEND', 'helper', '='),
  ('decision_pending', 'AMEND', 'helper', '='),
  ('shootout', 'AMEND', 'helper', '='),
  ('finished', 'AMEND', 'helper', '=')
ON CONFLICT ("from_status", "event_type") DO NOTHING;


-- ============================================================================================
-- 3a. Angaben (details.ts) -- neue Helfer
-- ============================================================================================

-- Feld-Regel je Angabe (payloadValidation.ts PlayerDetailFields/AmendPayloadSchema). Aufgerufen nur
-- fuer GESETZTE Felder (`payload ? feld`); ein JSON-null ist ungueltig (zod `.optional()`).
-- playerId: kanonische kleingeschriebene uuid, Grossbuchstaben UNGUELTIG -- bewusst ohne lower()
-- (nicht normalize_uuid, Fixture 52).
CREATE OR REPLACE FUNCTION match_engine.detail_value_valid(p_field text, p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
BEGIN
  CASE p_field
    WHEN 'playerNumber', 'shooterNumber' THEN
      RETURN match_engine.is_nonneg_int(p_value);
    WHEN 'playerId' THEN
      RETURN jsonb_typeof(p_value) = 'string'
             AND (p_value #>> '{}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    WHEN 'assists' THEN
      IF jsonb_typeof(p_value) IS DISTINCT FROM 'array' THEN
        RETURN false;
      END IF;
      RETURN NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_value) AS e(v) WHERE NOT match_engine.is_nonneg_int(e.v));
    WHEN 'incomplete' THEN
      RETURN jsonb_typeof(p_value) = 'boolean';
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- allowedDetailFields (details.ts): SHOOTOUT_KICK -> shooterNumber/incomplete, die uebrigen
-- Zieltypen (AMENDABLE_EVENT_TYPES) -> playerNumber/playerId/assists/incomplete; kein Zieltyp -> NULL.
CREATE OR REPLACE FUNCTION match_engine.detail_fields(p_type text) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_type = 'SHOOTOUT_KICK' THEN ARRAY['shooterNumber', 'incomplete']
    WHEN p_type IN ('GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD', 'TIME_PENALTY',
                    'FOUL', 'SUBSTITUTION') THEN ARRAY['playerNumber', 'playerId', 'assists', 'incomplete']
  END;
$$;

-- detailsFromPayload (details.ts): nur die fuer den Typ zulaessigen, gesetzten Felder, fehlende
-- nicht als null; ohne Felder {}. Zahlen kanonisch (Brief-Nachtrag, C0a-Review M5): `7.0` -> `7`,
-- auch die assists-Elemente -- der Wert ist durch payload_valid bereits geprueft.
CREATE OR REPLACE FUNCTION match_engine.details_from_payload(p_type text, p_payload jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_object_agg(f.name, CASE
           WHEN f.name IN ('playerNumber', 'shooterNumber') THEN to_jsonb((p_payload -> f.name)::numeric::bigint)
           WHEN f.name = 'assists' THEN coalesce((SELECT jsonb_agg(to_jsonb(a.v::numeric::bigint) ORDER BY a.ord)
                                                  FROM jsonb_array_elements(p_payload -> f.name) WITH ORDINALITY AS a(v, ord)),
                                                 '[]'::jsonb)
           ELSE p_payload -> f.name
         END), '{}'::jsonb)
    FROM unnest(match_engine.detail_fields(p_type)) AS f(name)
   WHERE p_payload ? f.name;
$$;


-- ============================================================================================
-- 3b. Payload-Validierung (payloadValidation.ts, K4 nicht-strikt, S3/S4/S5)
-- ============================================================================================
--
-- Gegenueber 20260928_002 neu (C0a-Vertrag §3.2/§3.3, A3/A5):
--   - Zieltypen: die fuer den Typ zulaessigen Angabe-Felder werden geprueft, wenn gesetzt (GOAL,
--     OWN_GOAL, Karten, TIME_PENALTY, FOUL, SUBSTITUTION: playerNumber, playerId, assists,
--     incomplete; SHOOTOUT_KICK: shooterNumber, incomplete). Nicht zulaessige (z. B. shooterNumber an
--     GOAL, playerNumber an SHOOTOUT_KICK) werden weder geprueft noch uebernommen.
--   - AMEND: alle fuenf Felder bei Anwesenheit gueltig; clear = Array aus den fuenf Namen ohne
--     Dubletten; mindestens ein Feld gesetzt oder clear nicht leer; kein Feld zugleich gesetzt und
--     in clear; unbekannte Schluessel zaehlen nicht ({foo:1} ungueltig). targetId Pflicht (wahr).
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
-- 3c. Zustand und Abschnittsuhr (applyEvent.ts initialState, sections.ts, tiebreak.ts, endcheck.ts)
-- ============================================================================================
--
-- Abschnittsuhr (C0a-Vertrag §3.4):
--   MATCH_START       sectionStartMs = clock.elapsedMs nach dem Start (clockMs ?? 0), breakStartedAt null
--   SECTION_END       breakStartedAt = at (sectionStartMs bleibt)
--   SECTION_START     sectionStartMs = clock.elapsedMs nach Resume, breakStartedAt null
--   enter_decision    Pause vor der Verlaengerung (MATCH_END und TIEBREAK_CHOICE): breakStartedAt = at
--   REOPEN            breakStartedAt null (sectionStartMs bleibt)
--   alle anderen      beide bleiben

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
    'finishedAt', NULL,
    -- C0a (V1, V2): nicht im serverState (P2 unveraendert).
    'details', '{}'::jsonb,
    'sectionStartMs', 0,
    'breakStartedAt', NULL
  );
END;
$$;

-- enterDecision(state, mode, at) (tiebreak.ts): shootout -> Strafstossschiessen; overtime-then-
-- shootout/goldenGoal -> Pause vor der Verlaengerung (section = sections + 1, breakStartedAt = at);
-- ohne Modus decision_pending. Ersetzt enter_decision(jsonb, text) aus 20260928_002 (DROP unten).
CREATE OR REPLACE FUNCTION match_engine.enter_decision(p_state jsonb, p_mode text, p_at numeric) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_mode = 'shootout' THEN p_state || '{"status": "shootout", "phase": "shootout"}'::jsonb
    WHEN p_mode IN ('overtime-then-shootout', 'goldenGoal') THEN p_state || jsonb_build_object(
      'status', 'section_break',
      'phase', 'overtime',
      'section', coalesce(match_engine.num(p_state -> 'rules' -> 'sections'), 1) + 1,
      'breakStartedAt', p_at)
    ELSE p_state || '{"status": "decision_pending"}'::jsonb
  END;
$$;

-- runEndCheck (@endcheck, R5) -- unveraendert bis auf `at` fuer enter_decision.
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
  RETURN match_engine.enter_decision(p_state, p_state ->> 'tiebreakMode', match_engine.num(p_event -> 'at'));
END;
$$;

-- SECTION_END (B-U14/B-U2) + C0a: Beginn der Abschnittspause in Wanduhr-ms.
CREATE OR REPLACE FUNCTION match_engine.apply_section_end(p_state jsonb, p_event jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_state ->> 'phase' <> 'regular'
      THEN match_engine.reject('INVALID_TRANSITION', '{"reason": "OVERTIME"}'::jsonb)
    WHEN (p_state -> 'section')::numeric >= coalesce(match_engine.num(p_state -> 'rules' -> 'sections'), 1)
      THEN match_engine.reject('INVALID_TRANSITION', '{"reason": "LAST_SECTION"}'::jsonb)
    ELSE match_engine.ok(jsonb_set(p_state, '{clock}', match_engine.stop_clock(p_state -> 'clock', p_event))
                         || jsonb_build_object('breakStartedAt', match_engine.num(p_event -> 'at')))
  END;
$$;

-- SECTION_START + C0a: der neue Abschnitt beginnt beim Uhrstand nach dem Anpfiff, die Pause ist vorbei.
CREATE OR REPLACE FUNCTION match_engine.apply_section_start(p_state jsonb, p_event jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT p_state || jsonb_build_object(
    'section', CASE WHEN p_state ->> 'phase' = 'regular' THEN (p_state -> 'section')::numeric + 1
                    ELSE (p_state -> 'section')::numeric END,
    'clock', x.clock,
    'sectionStartMs', x.clock -> 'elapsedMs',
    'breakStartedAt', NULL)
  FROM (SELECT match_engine.resume_clock(p_state -> 'clock', p_event) AS clock) AS x;
$$;


-- ============================================================================================
-- 3d. AMEND (handlers/amend.ts) -- Schritte 4-7 und Wirkung
-- ============================================================================================
--
-- Schritte 1 (Payload), 2 (Uebergangszeile) und 3 (Akteur) prueft match_apply_event. Hier:
--   4 Ziel nicht in `accepted` -> UNKNOWN_TARGET
--   5 Zieltyp kein Angabe-Ziel, oder ein gesetztes Feld bzw. ein clear-Name fuer den Zieltyp nicht
--     zulaessig -> INVALID_PAYLOAD
--   6 Ziel in `retracted` -> ALREADY_RETRACTED
--   7 Nachtrag-Regel (status finished UND actor helper): clear nicht leer -> FORBIDDEN_ACTOR; jedes
--     gesetzte Feld muss am Ziel leer (Schluessel fehlt oder null, bei assists auch []) oder
--     jsonb-gleich sein (assists geordnet), sonst FORBIDDEN_ACTOR.
-- Wirkung: details[targetId] = (bisherige Angaben - clear) || gesetzte Felder (kanonisch). Stand,
-- nextSeq, lastScoreEventId, decidedBy und alle Listen bleiben unveraendert.
CREATE OR REPLACE FUNCTION match_engine.apply_amend(p_state jsonb, p_event jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_id text := p_event ->> 'targetId';
  v_target jsonb := p_state -> 'accepted' -> (p_event ->> 'targetId');
  v_payload jsonb := p_event -> 'payload';
  v_clear jsonb := coalesce(p_event -> 'payload' -> 'clear', '[]'::jsonb);
  v_all_fields constant text[] := ARRAY['playerNumber', 'playerId', 'assists', 'shooterNumber', 'incomplete'];
  v_allowed text[];
  v_current jsonb;
BEGIN
  -- 4.
  IF v_target IS NULL THEN
    RETURN match_engine.reject('UNKNOWN_TARGET');
  END IF;

  -- 5.
  v_allowed := match_engine.detail_fields(v_target ->> 'type');
  IF v_allowed IS NULL
     OR EXISTS (SELECT 1 FROM unnest(v_all_fields) AS f(name) WHERE v_payload ? f.name AND f.name <> ALL (v_allowed))
     OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_clear) AS c(name) WHERE c.name <> ALL (v_allowed)) THEN
    RETURN match_engine.reject('INVALID_PAYLOAD');
  END IF;

  -- 6.
  IF (p_state -> 'retracted') ? v_target_id THEN
    RETURN match_engine.reject('ALREADY_RETRACTED');
  END IF;

  -- 7.
  v_current := coalesce(p_state -> 'details' -> v_target_id, '{}'::jsonb);
  IF p_state ->> 'status' = 'finished' AND coalesce(p_event -> 'actor' = '"helper"'::jsonb, false) THEN
    IF jsonb_array_length(v_clear) > 0 THEN
      RETURN match_engine.reject('FORBIDDEN_ACTOR');
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_all_fields) AS f(name)
                WHERE v_payload ? f.name
                  AND NOT (NOT (v_current ? f.name)
                           OR v_current -> f.name = 'null'::jsonb
                           OR (f.name = 'assists' AND v_current -> f.name = '[]'::jsonb))
                  AND v_current -> f.name IS DISTINCT FROM v_payload -> f.name) THEN
      RETURN match_engine.reject('FORBIDDEN_ACTOR');
    END IF;
  END IF;

  -- Wirkung: gesetzte Felder sind genau die zulaessigen, vorhandenen Felder (Schritt 5) -- deshalb
  -- liefert details_from_payload(Zieltyp, payload) sie kanonisch.
  RETURN match_engine.ok(jsonb_set(p_state, '{details}',
    coalesce(p_state -> 'details', '{}'::jsonb) || jsonb_build_object(v_target_id,
      (v_current - ARRAY(SELECT jsonb_array_elements_text(v_clear)))
      || match_engine.details_from_payload(v_target ->> 'type', v_payload))));
END;
$$;


-- ============================================================================================
-- 3e. Wirkung je Typ, applyEvent, processEvent
-- ============================================================================================

-- applyTypeSpecificEffect (applyEvent.ts). Gegenueber 20260928_002: MATCH_START/REOPEN mit
-- Abschnittsuhr, TIEBREAK_CHOICE mit `at`, AMEND; Fixrunde 1: SKIP/UNSKIP merken Zeitpunkt/Grund.
CREATE OR REPLACE FUNCTION match_engine.apply_effect(p_state jsonb, p_event jsonb, p_ctx jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rules jsonb;
  v_mode text;
  v_clock jsonb;
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
        'breakStartedAt', NULL));
    WHEN 'PAUSE', 'MATCH_END' THEN
      RETURN match_engine.ok(jsonb_set(p_state, '{clock}', match_engine.stop_clock(p_state -> 'clock', p_event)));
    WHEN 'RESUME' THEN
      RETURN match_engine.ok(jsonb_set(p_state, '{clock}', match_engine.resume_clock(p_state -> 'clock', p_event)));
    WHEN 'REOPEN' THEN
      -- B-U11: nach Strafstossschiessen nicht wiedereroeffnen (Leitung korrigiert per CORRECTION).
      IF p_state ->> 'phase' = 'shootout' THEN
        RETURN match_engine.reject('INVALID_TRANSITION', '{"reason": "SHOOTOUT_FINISHED"}'::jsonb);
      END IF;
      -- C0a (V2): sectionStartMs bleibt, eine Pause ist nach REOPEN nicht offen.
      RETURN match_engine.ok(p_state || jsonb_build_object(
        'clock', match_engine.resume_clock(p_state -> 'clock', p_event),
        'finishedAt', NULL,
        'baseDecidedBy', NULL,
        'breakStartedAt', NULL));
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

-- Jetzt ohne Aufrufer (endcheck/apply_effect nutzen die Fassung mit `at`).
DROP FUNCTION IF EXISTS match_engine.enter_decision(jsonb, text);

-- applyEvent (applyEvent.ts). Gegenueber 20260928_002 nur der letzte Schritt: ein angenommenes
-- Zielereignis bringt seine Angaben mit (details[id] = details_from_payload, NACH Wirkung und `to`).
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

  -- C0a (V1): ein angenommenes Zielereignis bringt seine Angaben aus der Payload mit.
  IF match_engine.detail_fields(v_type) IS NOT NULL THEN
    v_state := v_state || jsonb_build_object('details', coalesce(v_state -> 'details', '{}'::jsonb)
      || jsonb_build_object(event ->> 'id', match_engine.details_from_payload(v_type, event -> 'payload')));
  END IF;
  RETURN jsonb_build_object('status', 'accepted', 'state', v_state);
END;
$$;

-- processEvent (reduceMatch.ts): Duplikat/ID_CONFLICT (R11, K3) vor applyEvent. C0a (V3): beim
-- MATCH_START zaehlt payload.rules nicht mit -- je Seite nach ihrem EIGENEN Typ, wie
-- comparablePayload in TS und dedupe_key (003) im Schreibweg. `accepted` speichert unveraendert
-- canonical(event) (mit rules, wie TS das ganze Ereignis fuehrt).
CREATE OR REPLACE FUNCTION match_engine.process(p_state jsonb, p_event jsonb, p_ctx jsonb, p_transitions jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing jsonb := p_state -> 'accepted' -> (p_event ->> 'id');
  v_existing_key jsonb;
  v_new_key jsonb;
  v_outcome jsonb;
BEGIN
  IF v_existing IS NOT NULL THEN
    v_existing_key := CASE WHEN v_existing ->> 'type' = 'MATCH_START'
                           THEN v_existing #- '{payload,rules}' ELSE v_existing END;
    v_new_key := CASE WHEN p_event ->> 'type' = 'MATCH_START'
                      THEN match_engine.canonical(p_event) #- '{payload,rules}' ELSE match_engine.canonical(p_event) END;
    IF v_existing_key = v_new_key THEN
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


-- ============================================================================================
-- 4. Schreibweg-Helfer (definer-only, 20260928_003)
-- ============================================================================================

-- PC5 (C0a-Review I1): `\s` trifft unter ICU auch Unicode-Leerraum (NBSP, U+2003, U+3000 ...),
-- trim() entfernt ihn nicht, ::numeric warf -- jeder MATCH_START eines betroffenen Turniers
-- scheiterte. Jetzt nur ASCII-Leerraum (Regex-Klasse, nicht [[:space:]] -- das ist unter ICU
-- ebenfalls Unicode) und btrim mit genau diesen sechs Zeichen; Unicode-Leerraum -> NULL ->
-- Standardwert, wie serverRules.ts (Regel-Fixture 23). E'\v' ist der vertikale Tab (im Container
-- geprueft: btrim(chr(11) || '5', E' \t\n\r\f\v') = '5', 'v5' bleibt unveraendert).
CREATE OR REPLACE FUNCTION match_engine.cfg_num(p_value jsonb) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE jsonb_typeof(p_value)
    WHEN 'number' THEN p_value::numeric
    WHEN 'string' THEN CASE WHEN (p_value #>> '{}') ~ '^[ \t\n\r\f\v]*-?[0-9]+(\.[0-9]+)?[ \t\n\r\f\v]*$'
                            THEN btrim(p_value #>> '{}', E' \t\n\r\f\v')::numeric END
  END;
$$;

-- S9/S10 (20260928_003) + C0a: AMEND in der Typliste (27 Werte), targetId auch bei AMEND.
CREATE OR REPLACE FUNCTION match_engine.envelope(p_event jsonb, p_team_a text, p_team_b text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
  v_type text;
  v_team text;
  v_target text;
  v_based text;
  v_payload jsonb;
BEGIN
  IF jsonb_typeof(p_event) IS DISTINCT FROM 'object' THEN
    RETURN NULL;
  END IF;

  v_id := match_engine.normalize_uuid(p_event -> 'id');
  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(p_event -> 'type') IS DISTINCT FROM 'string' THEN
    RETURN NULL;
  END IF;
  v_type := p_event ->> 'type';
  -- EventTypeSchema (src/core/match/types.ts), 27 Werte.
  IF v_type NOT IN ('MATCH_START', 'PAUSE', 'RESUME', 'SECTION_END', 'SECTION_START', 'CLOCK_ADJUST',
                    'MATCH_END', 'TIEBREAK_CHOICE', 'SHOOTOUT_KICK', 'SHOOTOUT_END', 'RETRACT',
                    'CORRECTION', 'REOPEN', 'SKIP', 'UNSKIP', 'RESULT_ENTRY', 'REVIEW_ACCEPT',
                    'REVIEW_DISCARD', 'GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD',
                    'TIME_PENALTY', 'SUBSTITUTION', 'FOUL', 'AMEND') THEN
    RETURN NULL;
  END IF;

  IF NOT match_engine.is_int(p_event -> 'at') THEN
    RETURN NULL;
  END IF;

  -- section: null oder 1-5 (match_events_section_check aus B2; Ruling S13: die Verlaengerung ist
  -- Abschnitt sections+1, bei vier Abschnitten also 5).
  IF coalesce(jsonb_typeof(p_event -> 'section'), 'null') <> 'null'
     AND NOT (match_engine.is_int(p_event -> 'section') AND (p_event -> 'section')::numeric BETWEEN 1 AND 5) THEN
    RETURN NULL;
  END IF;

  -- clockMs: null oder 0..2147483647 (Spalte clock_ms integer, CHECK >= 0).
  IF coalesce(jsonb_typeof(p_event -> 'clockMs'), 'null') <> 'null'
     AND NOT (match_engine.is_nonneg_int(p_event -> 'clockMs') AND (p_event -> 'clockMs')::numeric <= 2147483647) THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(p_event -> 'payload') IS DISTINCT FROM 'object' THEN
    RETURN NULL;
  END IF;
  v_payload := p_event -> 'payload';

  -- Ruling S15/M1: payload und baseState je hoechstens 16 KB (Textform) -- match_events ist fuer
  -- oeffentliche Turniere lesbar und in der Realtime-Publikation, jeder Aufruf reduziert das Log.
  IF octet_length(v_payload::text) > 16384
     OR octet_length(coalesce(p_event -> 'baseState', 'null'::jsonb)::text) > 16384 THEN
    RETURN NULL;
  END IF;

  -- teamId: null oder eines der beiden Teams des Spiels (sonst verletzte ein gespeichertes
  -- Ereignis den Fremdschluessel bzw. zeigte auf ein fremdes Team).
  IF coalesce(jsonb_typeof(p_event -> 'teamId'), 'null') <> 'null' THEN
    v_team := match_engine.normalize_uuid(p_event -> 'teamId');
    IF v_team IS NULL OR v_team NOT IN (p_team_a, p_team_b) THEN
      RETURN NULL;
    END IF;
  END IF;

  -- targetId: null, oder uuid bei RETRACT/AMEND/REVIEW_* (Fremdschluessel target_event_id).
  IF coalesce(jsonb_typeof(p_event -> 'targetId'), 'null') <> 'null' THEN
    v_target := match_engine.normalize_uuid(p_event -> 'targetId');
    IF v_target IS NULL OR v_type NOT IN ('RETRACT', 'AMEND', 'REVIEW_ACCEPT', 'REVIEW_DISCARD') THEN
      RETURN NULL;
    END IF;
  END IF;

  -- controlEpoch: null oder int4 (Spalte control_epoch integer; geprueft erst ab E).
  IF coalesce(jsonb_typeof(p_event -> 'controlEpoch'), 'null') <> 'null'
     AND NOT (match_engine.is_int(p_event -> 'controlEpoch')
              AND (p_event -> 'controlEpoch')::numeric BETWEEN -2147483648 AND 2147483647) THEN
    RETURN NULL;
  END IF;

  -- S10: payload.basedOn (wenn Text) kanonisch.
  IF jsonb_typeof(v_payload -> 'basedOn') = 'string' THEN
    v_based := match_engine.normalize_uuid(v_payload -> 'basedOn');
    IF v_based IS NULL THEN
      RETURN NULL;
    END IF;
    v_payload := jsonb_set(v_payload, '{basedOn}', to_jsonb(v_based));
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'type', v_type,
    'at', (p_event -> 'at')::numeric::bigint,
    'section', CASE WHEN jsonb_typeof(p_event -> 'section') = 'number' THEN (p_event -> 'section')::numeric::integer END,
    'clockMs', CASE WHEN jsonb_typeof(p_event -> 'clockMs') = 'number' THEN (p_event -> 'clockMs')::numeric::integer END,
    'teamId', v_team,
    'targetId', v_target,
    'payload', v_payload,
    'controlEpoch', CASE WHEN jsonb_typeof(p_event -> 'controlEpoch') = 'number' THEN (p_event -> 'controlEpoch')::numeric::integer END,
    'baseState', CASE WHEN jsonb_typeof(p_event -> 'baseState') IS DISTINCT FROM 'null' THEN p_event -> 'baseState' END);
END;
$$;

-- R15 (20260928_003) + RC12/V2 (C0a-Vertrag §3.5), Fixrunde 1: skipped_at/skipped_reason (M2).
-- live_state bekommt sechs Schluessel --
-- sections/sectionSeconds/breakSeconds/overtimeSeconds aus den Regeln (fehlend -> null) und die
-- Abschnittsuhr sectionStartMs/breakStartedAt. Zwilling: src/core/match/client/cacheColumns.ts.
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
BEGIN
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
    'penalty_score_a', CASE WHEN v_phase = 'shootout' AND NOT v_unplayed THEN (p_state -> 'scores' -> v_a -> 'shootout')::numeric END,
    'penalty_score_b', CASE WHEN v_phase = 'shootout' AND NOT v_unplayed THEN (p_state -> 'scores' -> v_b -> 'shootout')::numeric END,
    'match_status', CASE WHEN v_status IN ('section_break', 'decision_pending', 'shootout') THEN 'paused' ELSE v_status END,
    'decided_by', CASE WHEN v_status <> 'finished' THEN NULL
                       WHEN v_decided = 'shootout' THEN 'penalty'
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
-- 4b. append_match_events (Fixrunde 1, Review M2, Ruling PC6)
-- ============================================================================================
--
-- Unveraendert gegenueber 20260928_003 bis auf den Zwischenspeicher: skipped_at/skipped_reason aus
-- cache_columns (vorher schuetzte der Spalten-Schutz die beiden Spalten, der Schreibweg pflegte
-- sie aber nie). Rechte wie 003 (unten erneut ausdruecklich).

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

        -- d. Regeln setzt der Server (R4/R4b).
        IF v_event ->> 'type' = 'MATCH_START' THEN
          v_event := jsonb_set(v_event, '{payload,rules}', match_engine.server_rules(
            v_match.duration_minutes, v_match.phase, v_tournament.group_phase_duration,
            v_tournament.final_round_duration, v_tournament.config, v_tournament.finals_config));
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
      actual_start = CASE WHEN v_started_now THEN coalesce(m.actual_start, v_now) ELSE m.actual_start END,
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

COMMENT ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) IS
  'B3b: der einzige Schreibweg fuer Ereignisse der Rechenfunktion (event_format = 1). SECURITY
   DEFINER, EXECUTE nur authenticated (R17). Prueft Recht (R7), Umschlag (S9/S10), Idempotenz
   (R11), Zeit (R2/S11), setzt Regeln beim Anpfiff (R4), speichert angenommene Ereignisse,
   Stapel-Kaskade (R12), Zwischenspeicher auf matches einmal je Aufruf (R15). Rueckgabe
   {results:[{id,status,code?,detail?,seq?}], state, serverTime} oder {error:CLIENT_OUTDATED}.';


-- ============================================================================================
-- 5. Spalten-Schutz auf matches (V4, Ruling PC2)
-- ============================================================================================
--
-- Ein Spiel MIT Engine-Ereignissen (match_events.event_format IS NOT NULL) fuehrt seinen
-- Spielstand, Status, die Uhr und live_state ausschliesslich ueber append_match_events (R15:
-- Zwischenspeicher). Fuer Client-Rollen (current_user authenticated/anon -- PostgREST) sind diese
-- 16 Spalten dort gesperrt; eine veraltete App (L98, B4) oder ein direkter REST-Aufruf kann den
-- Zwischenspeicher also nicht mehr ueberschreiben. Andere Spalten (Spielplan, Teams, Schiri,
-- is_public-Kaskade, version/updated_at der Alt-Trigger ...) bleiben frei. Spiele OHNE
-- Engine-Ereignisse (Altspiele, DangerZone-Reset RC14) bleiben unveraendert auf dem alten Weg.
--
-- Nicht-Client-Rollen sind frei (current_user-Ausnahme wie 20260928_001/20260922_003):
-- append_match_events ist SECURITY DEFINER -- dort ist current_user der Eigentuemer der Funktion,
-- der Zwischenspeicher wird weiter geschrieben. Kein SECURITY DEFINER hier: sonst waere
-- current_user immer der Eigentuemer und die Rollenunterscheidung unmoeglich.
--
-- Fixrunde 1 (Review M1, Ruling PC6): ob ein Spiel Engine-Ereignisse hat, zaehlt der Helfer
-- public.match_has_engine_events (SECURITY DEFINER, fester search_path) -- unabhaengig von der
-- Lese-RLS des Aufrufers auf match_events. Vorher lief EXISTS als Aufrufer: wuerde
-- match_events_select_v3 kuenftig enger als matches_update_v3, zaehlte der Trigger still 0 und
-- liesse das UPDATE durch (im Review mit einer RESTRICTIVE-Policy USING (false) belegt; der Harness
-- prueft genau diesen Fall). Warum Definer hier sicher ist: kein Schreiben, nur ein Wahrheitswert
-- zu einer uuid; kein dynamisches SQL; fester search_path. EXECUTE nur anon/authenticated -- die
-- Trigger-Funktion bleibt SECURITY INVOKER (current_user muss unterscheidbar bleiben) und ruft den
-- Helfer deshalb mit der Rolle des Aufrufers; sie ruft ihn NUR fuer diese beiden Rollen
-- (verschachteltes IF), service_role/postgres brauchen kein EXECUTE. Preis: der Helfer ist per
-- /rpc aufrufbar und verraet, ob ein Spiel mit bekannter uuid Engine-Ereignisse hat -- uuids sind
-- nicht erratbar, bei oeffentlichen Turnieren sind die Ereignisse ohnehin lesbar.
--
-- Wechselwirkung mit den vorhandenen BEFORE-UPDATE-Triggern auf matches (Reihenfolge alphabetisch
-- nach Name, Stand Baseline + Migrationen): matches_guard_engine_columns <
-- matches_protect_owner_id (20260922_003: haelt owner_id fest) < matches_protect_tournament_id
-- (20260923_001: wirft bei geaendertem tournament_id) < matches_updated_at (Baseline: updated_at).
-- Keiner schreibt eine der 16 geschuetzten Spalten -- die Reihenfolge ist fuer das Ergebnis deshalb
-- unerheblich (belegt im Harness: Trigger-Liste aus pg_trigger). match_version_trigger aus
-- 20260120_enable_optimistic_locking.sql ist nicht Teil der Baseline (live nicht vorhanden). AFTER-Trigger auf tournaments
-- (tournament_visibility_cascade) aendert nur matches.is_public -- frei.
CREATE OR REPLACE FUNCTION "public"."match_has_engine_events"("p_match_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.match_events e WHERE e.match_id = p_match_id AND e.event_format IS NOT NULL);
$$;

COMMENT ON FUNCTION "public"."match_has_engine_events"("uuid") IS
  'C0b-Fixrunde 1 (Review M1): hat das Spiel Ereignisse der Rechenfunktion (event_format IS NOT
   NULL)? SECURITY DEFINER, damit der Spalten-Schutz (matches_guard_engine_columns) nicht von der
   Lese-RLS auf match_events abhaengt. EXECUTE nur anon/authenticated (Trigger laeuft als Aufrufer).';

CREATE OR REPLACE FUNCTION "public"."matches_guard_engine_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Verschachtelt statt AND-Kette: der Definer-Helfer wird garantiert nur fuer Client-Rollen und
  -- nur bei geaenderter Schutzspalte aufgerufen (keine Abhaengigkeit von der Auswertungsreihenfolge).
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.score_a IS DISTINCT FROM OLD.score_a
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
       OR NEW.skipped_reason IS DISTINCT FROM OLD.skipped_reason THEN
      IF public.match_has_engine_events(OLD.id) THEN
        RAISE EXCEPTION
          'Nicht erlaubt: Spielstand, Status, Uhr und live_state eines Spiels mit Ereignissen der Rechenfunktion aendert nur append_match_events (Spiel %).',
          OLD.id
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."matches_guard_engine_columns"() IS
  'C0b (V4, Ruling PC2): BEFORE-UPDATE-Schutz auf matches. Client-Rollen (current_user
   authenticated/anon) duerfen score_a/b, overtime_score_a/b, penalty_score_a/b, match_status,
   decided_by, timer_start_time, timer_paused_at, timer_elapsed_seconds, live_state, actual_start,
   actual_end, skipped_at, skipped_reason eines Spiels MIT Engine-Ereignissen (match_events.
   event_format IS NOT NULL) nicht aendern -- nur append_match_events (SECURITY DEFINER) schreibt
   dort den Zwischenspeicher. Altspiele und alle anderen Spalten bleiben frei.';

-- Fixrunde 1 (Review M3): CREATE OR REPLACE TRIGGER (PG >= 14) statt DROP + CREATE -- kein
-- zusaetzlicher DROP-Schritt auf der viel gelesenen Tabelle matches.
CREATE OR REPLACE TRIGGER "matches_guard_engine_columns"
  BEFORE UPDATE ON "public"."matches"
  FOR EACH ROW EXECUTE FUNCTION "public"."matches_guard_engine_columns"();


-- ============================================================================================
-- 6. Rechte (R17, Muster 20260928_002/_003)
-- ============================================================================================
--
-- Neue Engine-Helfer (4) und die neue enter_decision-Signatur: wie alle Engine-Teilfunktionen
-- REVOKE ALL FROM PUBLIC, EXECUTE fuer authenticated, anon, service_role (compute_match_state ist
-- SECURITY INVOKER und ruft sie mit den Rechten des Aufrufers). Die per CREATE OR REPLACE
-- ersetzten Funktionen behalten ihre ACL -- die REVOKE/GRANT-Zeilen unten stellen sie trotzdem
-- ausdruecklich her (idempotent, auch auf einer Datenbank mit abweichender ACL).
-- Die drei hier ersetzten B3b-Helfer (cfg_num, envelope, cache_columns) bleiben definer-only.
-- Trigger-Funktion: kein EXECUTE fuer irgendwen (sie laeuft nur im Trigger-Kontext; beim Feuern
-- prueft Postgres kein EXECUTE-Recht -- belegt im Harness).
-- Funktionszahl (scripts/db_privilege_assertions.sql): 47 -> 51 (+4 Helfer; enter_decision
-- ersetzt, nicht ergaenzt), davon IMMUTABLE 46 -> 50.

REVOKE ALL ON FUNCTION
  match_engine.detail_value_valid(text, jsonb),
  match_engine.detail_fields(text),
  match_engine.details_from_payload(text, jsonb),
  match_engine.apply_amend(jsonb, jsonb),
  match_engine.enter_decision(jsonb, text, numeric),
  match_engine.payload_valid(jsonb, jsonb),
  match_engine.endcheck(jsonb, jsonb, jsonb),
  match_engine.apply_section_end(jsonb, jsonb),
  match_engine.apply_section_start(jsonb, jsonb),
  match_engine.apply_effect(jsonb, jsonb, jsonb),
  match_engine.process(jsonb, jsonb, jsonb, jsonb),
  public.match_initial_state(jsonb),
  public.match_apply_event(jsonb, jsonb, jsonb, jsonb)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  match_engine.detail_value_valid(text, jsonb),
  match_engine.detail_fields(text),
  match_engine.details_from_payload(text, jsonb),
  match_engine.apply_amend(jsonb, jsonb),
  match_engine.enter_decision(jsonb, text, numeric),
  match_engine.payload_valid(jsonb, jsonb),
  match_engine.endcheck(jsonb, jsonb, jsonb),
  match_engine.apply_section_end(jsonb, jsonb),
  match_engine.apply_section_start(jsonb, jsonb),
  match_engine.apply_effect(jsonb, jsonb, jsonb),
  match_engine.process(jsonb, jsonb, jsonb, jsonb),
  public.match_initial_state(jsonb),
  public.match_apply_event(jsonb, jsonb, jsonb, jsonb)
TO authenticated, anon, service_role;

REVOKE ALL ON FUNCTION
  match_engine.cfg_num(jsonb),
  match_engine.envelope(jsonb, text, text),
  match_engine.cache_columns(jsonb, jsonb)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."matches_guard_engine_columns"() FROM PUBLIC, anon, authenticated, service_role;

-- Fixrunde 1: Definer-Helfer des Spalten-Schutzes -- EXECUTE nur fuer die beiden Rollen, fuer die
-- der (INVOKER-)Trigger ihn aufruft (Begruendung Abschnitt 5).
REVOKE ALL ON FUNCTION "public"."match_has_engine_events"("uuid") FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "public"."match_has_engine_events"("uuid") TO anon, authenticated;

-- Fixrunde 1: append_match_events per CREATE OR REPLACE -- Rechte wie 20260928_003 (R17, C3).
REVOKE ALL ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) TO authenticated;
