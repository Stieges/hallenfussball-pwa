-- B3b (.superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B3b-brief.md): der EINZIGE Schreibweg
-- fuer Ereignisse der neuen Rechenfunktion -- public.append_match_events -- plus
-- public.server_time() fuer die Zeitmessung der Geraete (C3).
--
-- Aufbau (setzt auf B2 = 20260928_001_match_event_log.sql und B3a = 20260928_002_match_engine.sql):
--   append_match_events(p_match_id, p_events, p_client_format, p_device_id)
--     SECURITY DEFINER (R17), prueft Recht (R7), Umschlag (S9/S10), Idempotenz (R11/K3),
--     klemmt die Zeit (R2/S11), setzt beim Anpfiff die Regeln selbst (R4/R4b), rechnet mit dem
--     SQL-Zwilling (match_reduce EINMAL je Aufruf, danach match_continue je Ereignis -- B3a-Review
--     M3), speichert angenommene Ereignisse (R14, K7: noop nie), wendet die Stapel-Kaskade an (R12)
--     und schreibt den Zwischenspeicher am Spiel einmal je Aufruf (R15).
--   server_time()  {"serverTime": epoch_ms}, STABLE, fuer anon + authenticated (R17).
--   Interne Helfer (Ruling S12, Schema match_engine, IMMUTABLE, rein, nur fuer den Definer):
--     normalize_uuid, cfg_num, envelope, dedupe_key, server_rules, cache_columns.
--
-- Rulings (rulings.md / progress.md), wie umgesetzt:
--   R2/S11  at_server = at geklemmt auf [at des zuletzt gespeicherten Ereignisses (bzw. 0), jetzt];
--           gerechnet wird mit at_eval = floor(extract(epoch from to_timestamp(at_server/1000.0))*1000)
--           -- exakt der Wert, den compute_match_state spaeter aus client_time zurueckrechnet (S2).
--   R4/R4b  Regeln beim MATCH_START aus matches/tournaments (server_rules, Quellen siehe dort).
--   R7      Akteursklasse aus has_tournament_permission: Turnierleitung (Recht leadMatches) ->
--           'leitung', sonst writeMatchData -> 'helper', sonst alle Ereignisse FORBIDDEN_ACTOR
--           (nichts gespeichert, kein Zustand in der Antwort -- kein Leck privater Spiele). Ein vom
--           Geraet mitgesendetes `actor` wird ueberschrieben.
--   R10     Ergebnisarten accepted | duplicate | noop | rejected (review erst ab F).
--   R11/K3  Idempotenz gegen die TABELLE (jede Zeile mit dieser id, auch anderes Spiel): gleiches
--           Spiel und gleicher kanonischer Inhalt -> duplicate mit seq des Originals, sonst
--           ID_CONFLICT. Beim MATCH_START zaehlen payload.rules nicht mit (setzt der Server, R4).
--   R12     Stapel-Semantik wie applyBatch: abgelehnter MATCH_START/RESUME/SECTION_START/REOPEN/
--           UNSKIP -> alle folgenden DEPENDS_ON_REJECTED (auch bei Umschlag-Ablehnung).
--   R13/G1  Der Guard aus B2 laesst die Zeilen zu, weil current_user hier der Eigentuemer der
--           Funktion ist (nicht authenticated/anon); Aendern/Loeschen bleibt fuer alle verboten.
--   R14     Pflichtspalten; period aus der Phase VOR dem Ereignis (shootout -> penalty),
--           score_home/away = effektiver Stand nach dem Ereignis.
--   R15     Zwischenspeicher einmal je Aufruf, nur wenn mindestens ein Ereignis angenommen wurde.
--   R16     p_device_id -> match_event_authors.device_id, controlEpoch -> control_epoch (ungeprueft
--           bis E), baseState -> match_event_authors.base_state.
--   R17     EXECUTE nur authenticated (REVOKE PUBLIC, anon), Muster 20260716_001_heartbeat_rpc.sql.
--   S9      Umschlag: id uuid, type bekannt, at Ganzzahl, section null|1-5 (CHECK aus B2, S13),
--           clockMs null|0..2147483647 (Spalte integer), payload Objekt, teamId null|Team A/B,
--           targetId null|uuid und nur bei RETRACT/REVIEW_*, controlEpoch null|int4, payload und
--           baseState je <= 16 KB -> sonst INVALID_PAYLOAD. (Fixrunde 1: section 1-5 nach S13,
--           Groessengrenze nach S15/M1.)
--   S14     fehlender oder ungueltiger finals_config.tiebreaker -> 'shootout' (nie NULL; decision_pending
--           bleibt Rueckfall der Rechenfunktion, der Server erzeugt es nicht mehr).
--   S15     Fixrunde 1: scheduled/skipped -> Stand-Spalten NULL (I1); hoechstens 2000 gespeicherte
--           Engine-Ereignisse je Spiel, sonst Aufruf-Fehler 54000 (M1); soft-geloeschtes Turnier und
--           nicht existierendes Spiel -> dieselbe Antwort wie fehlendes Recht (M3, M6); live_state
--           wird zusammengefuehrt statt ueberschrieben (M4); service_role ohne EXECUTE (C3).
--   S10     id, targetId, teamId, payload.basedOn werden kleingeschrieben-kanonisch normalisiert
--           (ungueltig -> INVALID_PAYLOAD) und so gespeichert.
--   Definer-Kontext (B3a-Review I1/M5): die gespeicherten Ereignisse liest die Funktion selbst
--           (kein RLS-Teilblick), nicht ueber compute_match_state.
--
-- Idempotent: CREATE OR REPLACE, REVOKE/GRANT. Keine Tabellen-/Datenaenderung. Rueckweg: DROP
-- FUNCTION der zwei public-Funktionen und der sechs Helfer. Produktion wendet der Controller erst
-- nach Freigabe an.


-- ============================================================================================
-- 0. Voraussetzungen (Fail-fast wie 20260928_002, Review M6)
-- ============================================================================================

DO $$
BEGIN
  IF to_regprocedure('public.match_continue(jsonb,jsonb,jsonb,jsonb,text)') IS NULL
     OR to_regprocedure('match_engine.canonical(jsonb)') IS NULL THEN
    RAISE EXCEPTION '20260928_003_append_match_events: SQL-Rechenfunktion fehlt -- zuerst 20260928_002_match_engine.sql einspielen';
  END IF;
  IF to_regclass('public.match_event_authors') IS NULL OR to_regclass('public.app_config') IS NULL THEN
    RAISE EXCEPTION '20260928_003_append_match_events: Ereignis-Log-Schema fehlt -- zuerst 20260928_001_match_event_log.sql einspielen';
  END IF;
END;
$$;


-- ============================================================================================
-- 1. Interne Helfer (Schema match_engine, Ruling S12)
-- ============================================================================================

-- S10: kanonische uuid (kleingeschrieben, 8-4-4-4-12) oder NULL.
CREATE OR REPLACE FUNCTION match_engine.normalize_uuid(p_value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_value) = 'string'
     AND lower(p_value #>> '{}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN lower(p_value #>> '{}')
  END;
$$;

-- Zahl aus einem Konfigurationswert: jsonb-Zahl oder Zahl als Text (der Wizard speichert einzelne
-- Werte als Text, z. B. halftimeBreak aus einem Auswahlfeld), sonst NULL.
CREATE OR REPLACE FUNCTION match_engine.cfg_num(p_value jsonb) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE jsonb_typeof(p_value)
    WHEN 'number' THEN p_value::numeric
    WHEN 'string' THEN CASE WHEN (p_value #>> '{}') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
                            THEN trim(p_value #>> '{}')::numeric END
  END;
$$;

-- S9/S10: prueft den Umschlag und liefert das normalisierte Ereignis
-- {id, type, at, section, clockMs, teamId, targetId, payload, controlEpoch, baseState} oder NULL
-- (= INVALID_PAYLOAD). Die Payload-Pruefung je Typ macht danach die Rechenfunktion.
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
  -- EventTypeSchema (src/core/match/types.ts), 26 Werte.
  IF v_type NOT IN ('MATCH_START', 'PAUSE', 'RESUME', 'SECTION_END', 'SECTION_START', 'CLOCK_ADJUST',
                    'MATCH_END', 'TIEBREAK_CHOICE', 'SHOOTOUT_KICK', 'SHOOTOUT_END', 'RETRACT',
                    'CORRECTION', 'REOPEN', 'SKIP', 'UNSKIP', 'RESULT_ENTRY', 'REVIEW_ACCEPT',
                    'REVIEW_DISCARD', 'GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD',
                    'TIME_PENALTY', 'SUBSTITUTION', 'FOUL') THEN
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

  -- targetId: null, oder uuid bei RETRACT/REVIEW_* (Fremdschluessel target_event_id).
  IF coalesce(jsonb_typeof(p_event -> 'targetId'), 'null') <> 'null' THEN
    v_target := match_engine.normalize_uuid(p_event -> 'targetId');
    IF v_target IS NULL OR v_type NOT IN ('RETRACT', 'REVIEW_ACCEPT', 'REVIEW_DISCARD') THEN
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

-- R11/K3: Vergleichsschluessel fuer die Idempotenz. = match_engine.canonical (S6); beim MATCH_START
-- ohne payload.rules, weil der Server sie setzt (R4) -- eine Wiederholung mit anderen oder fehlenden
-- Geraete-Regeln ist dasselbe Ereignis.
CREATE OR REPLACE FUNCTION match_engine.dedupe_key(p_event jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_event ->> 'type' = 'MATCH_START'
              THEN match_engine.canonical(p_event) #- '{payload,rules}'
              ELSE match_engine.canonical(p_event) END;
$$;

-- R4/R4b: Regeln, die der Server beim MATCH_START setzt. Quellen (App-Schreibweg
-- src/core/repositories/supabaseMappers.ts, Typen src/types/tournament.ts):
--   sections         tournaments.config->gamePeriods          (supabaseMappers.ts: config.gamePeriods), Standard 1, begrenzt 1-4
--   Gesamtdauer min  matches.duration_minutes, sonst Gruppenphase: tournaments.group_phase_duration
--                    (groupPhaseGameDuration), sonst final_round_duration (finalRoundGameDuration)
--                    ?? group_phase_duration. phase NULL gilt als Gruppenphase (Spalten-Standard).
--   sectionSeconds   floor(Gesamtdauer*60 / sections)
--   breakSeconds     config->halftimeBreak (Minuten, Standard 1) * 60
--   knockout         matches.phase <> 'groupStage'
--   tiebreak         finals_config->tiebreaker (FinalsConfig.tiebreaker, R4b) -- nur die drei Werte, sonst
--                    'shootout' (Ruling S14: "normal Strafstossschiessen")
--   overtimeSeconds  finals_config->tiebreakerDuration (Minuten, Standard 5) * 60
--   shootersPerTeam  config->matchCockpitSettings->penaltyShootersPerTeam (Standard 5)
--   suddenDeathAfter config->matchCockpitSettings->penaltySuddenDeathAfter (Standard 6)
--   penaltySeconds   120 (fest)
-- Alle Zahlen >= 0 und <= 2147483647 (MatchRulesSchema verlangt nicht-negative Ganzzahlen).
CREATE OR REPLACE FUNCTION match_engine.server_rules(p_duration_minutes integer, p_phase text,
                                                     p_group_duration integer, p_final_duration integer,
                                                     p_config jsonb, p_finals jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group boolean := coalesce(p_phase, 'groupStage') = 'groupStage';
  v_sections integer;
  v_total numeric;
  v_settings jsonb := CASE WHEN jsonb_typeof(p_config) = 'object' THEN p_config -> 'matchCockpitSettings' END;
  v_finals jsonb := CASE WHEN jsonb_typeof(p_finals) = 'object' THEN p_finals END;
  v_tiebreak text := 'shootout';
BEGIN
  v_sections := least(4, greatest(1, floor(coalesce(match_engine.cfg_num(
                  CASE WHEN jsonb_typeof(p_config) = 'object' THEN p_config -> 'gamePeriods' END), 1))))::integer;
  v_total := greatest(0, coalesce(p_duration_minutes,
                                  CASE WHEN v_group THEN p_group_duration
                                       ELSE coalesce(p_final_duration, p_group_duration) END, 0));
  IF jsonb_typeof(v_finals -> 'tiebreaker') = 'string'
     AND (v_finals ->> 'tiebreaker') IN ('shootout', 'overtime-then-shootout', 'goldenGoal') THEN
    v_tiebreak := v_finals ->> 'tiebreaker';
  END IF;

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

-- R15: Werte des Zwischenspeichers auf `matches` aus dem Zustand (vollstaendiger interner Zustand,
-- nicht nur der Server-Ausschnitt -- Ueberschreibungs-Stapel und tiebreakMode werden gebraucht).
-- Abbildung fuer alte Leser (liveMatchMappers.ts, Monitor, Zuschauersicht):
--   match_status     section_break/decision_pending/shootout -> paused (CHECK matches_match_status_check)
--   score_a/b        ohne aktive Ueberschreibung: regulaerer Stand; mit: effektiver Stand
--   overtime_score   nur wenn eine Verlaengerung stattfand (Phase overtime, Verlaengerungstor oder
--                    Entscheidung overtime/goldenGoal), sonst NULL; mit Ueberschreibung 0
--                    -> score + overtime = effektiver Stand
--   penalty_score    Strafstosstreffer, wenn das Spiel im Strafstossschiessen ist/war (Phase shootout)
--   decided_by       nur bei finished: shootout -> penalty, correction/direct -> regular (CHECK
--                    matches_decided_by_check), sonst gleichnamig
--   Stand-Spalten    bei scheduled/skipped alle NULL (Fixrunde 1, I1)
--   live_state       NULL fuer scheduled/skipped/finished (wie der alte Schreibweg bei FINISHED --
--                    isMatchActive() liest ein Spiel mit live_state als aktiv), sonst Engine-Ausschnitt
--                    plus die Schluessel, die liveMatchMappers.ts#LiveStateJson schon kennt
--                    (elapsedSeconds, durationSeconds, playPhase, tiebreakerMode,
--                    overtimeDurationSeconds, awaitingTiebreakerChoice).
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
      'awaitingTiebreakerChoice', v_status = 'decision_pending') END);
END;
$$;


-- ============================================================================================
-- 2. append_match_events -- der einzige Schreibweg (SECURITY DEFINER)
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
-- 3. server_time
-- ============================================================================================

CREATE OR REPLACE FUNCTION public.server_time() RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object('serverTime', floor(extract(epoch FROM now()) * 1000)::bigint);
$$;

COMMENT ON FUNCTION public.server_time() IS
  'B3b: Serverzeit {"serverTime": epoch_ms} fuer die Zeitmessung der Geraete (Offset, C3). anon +
   authenticated.';


-- ============================================================================================
-- 4. Rechte (R17)
-- ============================================================================================

-- C3 (Fixrunde 1): auch service_role nicht -- ohne auth.uid() waere der Aufruf wirkungslos (42501),
-- der Schreibweg ist ausschliesslich fuer angemeldete Geraete.
REVOKE ALL ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.server_time() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.server_time() TO anon, authenticated;

-- Die sechs B3b-Helfer braucht nur der Definer (Eigentuemer) -- niemand sonst bekommt EXECUTE.
REVOKE ALL ON FUNCTION
  match_engine.normalize_uuid(jsonb),
  match_engine.cfg_num(jsonb),
  match_engine.envelope(jsonb, text, text),
  match_engine.dedupe_key(jsonb),
  match_engine.server_rules(integer, text, integer, integer, jsonb, jsonb),
  match_engine.cache_columns(jsonb, jsonb)
FROM PUBLIC, anon, authenticated, service_role;
