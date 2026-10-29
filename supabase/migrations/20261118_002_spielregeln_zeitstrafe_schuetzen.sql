-- supabase/migrations/20261118_002_spielregeln_zeitstrafe_schuetzen.sql
-- R2 PR 4, M1 (Plan R2 v2 § 3.1; Befunde C-ZEITSTRAFE-FEST-120S): Spielregeln beim Anpfiff aus den Einstellungen
-- des Turniers. Record docs/anforderungen/2026-09-27_wizard-regelinhalte.md.
-- Szenarien: @W2A-016 (Zeitstrafendauer einstellbar: eingestellte 1 Minute gilt im Spiel), @W2A-029 (Regel-Aenderung
--   wirkt ab dem naechsten Anpfiff -- der Server schreibt die Regel beim MATCH_START, das laufende Spiel behaelt seine),
--   @W2A-012 (Schuetzen einstellbar 1 bis 5, vorbelegt 3).
--
-- Inhalt: nur CREATE OR REPLACE FUNCTION match_engine.server_rules(integer, text, integer, integer, jsonb, jsonb, text),
--   Koerper woertlich aus 20261028_001_transitions_za3.sql (Abschnitt 4), mit genau zwei Abweichungen:
--   a. shootersPerTeam: matchCockpitSettings.penaltyShootersPerTeam, abgerundet, begrenzt auf 1 bis 5; fehlt der Wert
--      oder ist er ungueltig, gilt 3 (vorher: Vorgabe 5, Grenzen 0 bis INT4_MAX).
--   b. penaltySeconds: matchCockpitSettings.timePenaltyDurationSeconds, abgerundet, begrenzt auf 60 bis 600; fehlt der
--      Wert oder ist er ungueltig, gilt 120 (vorher: fest 120). Die Oberflaeche bietet 60, 120 und 300.
--   Signatur, search_path, IMMUTABLE PARALLEL SAFE, SECURITY INVOKER bleiben. Rechte wie 20261028_001: nur der Definer
--   (append_match_events) ruft die Funktion; REVOKE fuer PUBLIC und alle Client-Rollen.
-- TS-Zwilling: src/core/match/client/serverRules.ts (serverRules), Regel-Fixtures 35 bis 39 und die Vertraege
--   src/core/match/__contracts__/server-rules-*.json (scripts/match-engine-parity.sh, append-match-events-check.sh).
--
-- Wirkung: nur Spiele, die NACH dem Einspielen angepfiffen werden (MATCH_START speichert die Regeln im Ereignis,
--   compute_match_state liest sie von dort). Schon angepfiffene Spiele behalten ihre Regeln. Keine Tabellen-, Typ-,
--   Policy- oder Zeilenaenderung, kein Backfill, kein Typen-PR.
--
-- Voraussetzungen (Fail-fast unten): match_engine.server_rules mit der 7er-Signatur (20261028_001),
--   match_engine.cfg_num(jsonb) (20261001_001).
-- Idempotent: CREATE OR REPLACE FUNCTION, REVOKE.
--
-- RUECKWEG: eigene Datei (Anhang der Freigabe-Unterlage R2-M1-sql-freigabe-2026-10-25.md), EIN Block: den Koerper aus
--   20261028_001 (Abschnitt 4) woertlich zurueck, Rechte wie dort. Danach angepfiffene Spiele wieder 120 s und
--   Vorgabe 5 Schuetzen.
--
-- Produktion: nur nach Daniels Freigabe, Daniel spielt selbst ein (Regime: erst einspielen, dann mergen). Dieser Branch
-- spielt nichts ein.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regprocedure('match_engine.server_rules(integer,text,integer,integer,jsonb,jsonb,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'match_engine.server_rules(integer,text,integer,integer,jsonb,jsonb,text) (20261028_001)');
  END IF;
  IF to_regprocedure('match_engine.cfg_num(jsonb)') IS NULL THEN
    v_missing := array_append(v_missing, 'match_engine.cfg_num(jsonb) (20261001_001)');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'M1 Spielregeln: Voraussetzungen fehlen: %', array_to_string(v_missing, ', ');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. server_rules: Schuetzen 1 bis 5 (Vorgabe 3), Zeitstrafe aus der Einstellung (60 bis 600 s, Vorgabe 120)
-- ---------------------------------------------------------------------------------------------------------------
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
    -- M1 (@W2A-012): 1 bis 5 Schuetzen, Vorgabe 3. Zwilling: client/serverRules.ts (SHOOTERS_*).
    'shootersPerTeam', least(5, greatest(1, floor(coalesce(match_engine.cfg_num(v_settings -> 'penaltyShootersPerTeam'), 3))))::bigint,
    'suddenDeathAfter', least(2147483647, greatest(0, floor(coalesce(match_engine.cfg_num(v_settings -> 'penaltySuddenDeathAfter'), 6))))::bigint,
    -- M1 (@W2A-016, @W2A-029): Zeitstrafe aus der Einstellung, 60 bis 600 s, Vorgabe 120. Zwilling: client/serverRules.ts (PENALTY_*).
    'penaltySeconds', least(600, greatest(60, floor(coalesce(match_engine.cfg_num(v_settings -> 'timePenaltyDurationSeconds'), 120))))::bigint);
END;
$$;

-- server_rules braucht nur der Definer (append_match_events).
REVOKE ALL ON FUNCTION match_engine.server_rules(integer, text, integer, integer, jsonb, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
