-- supabase/migrations/20261028_005_guard_all_matches.sql
-- A-10 (MVP-Bauplan GA3, brief-A-10.md): Ergebnis-Spalten ALLER Spiele schuetzen, ohne die Turnierleitung
-- auszusperren (@EK-031, @EK-060, @FU-055, @FU-065, @HE-042; Befunde C-RECHTE-ERGEBNIS-DIREKT und
-- C-SLOT-UPDATE-OHNE-VERSION (Rest), @TM-027).
--
-- Inhalt:
--   A. matches_guard_engine_columns: ohne Bedingung "hat Engine-Ereignisse" (vorher 20261001_001:1281-1329);
--      Client-Rollen (current_user authenticated/anon) aendern die 16 Schutzspalten nie, beim INSERT
--      werden sie neutral gesetzt. Trigger jetzt BEFORE INSERT OR UPDATE.
--   B. reset_match_results(uuid, uuid[]): Turnierleitung (leadMatches) setzt Ergebnisse von Spielen OHNE
--      Engine-Ereignisse zurueck; ein Spiel MIT Ereignissen -> nichts geaendert, Antwort HAS_ENTRIES
--      (Server-Zwilling von @FU-090). match_events und matches.version bleiben unberuehrt.
--   C. tournaments.change_revision: zaehlt Aenderungen ohne Versions-CAS -- Spielplan-Spalten an matches
--      (matches_bump_change_revision) und reset_match_results. Nur der Server schreibt sie (HF004).
--   D. Rechte.
--
-- Nicht geaendert: append_match_events (Fassung 20261028_003), match_has_engine_events (Rechte wie
-- 20261001_001), match_events, Policies.
-- Fehlercodes: HF001 make_tournament_public, HF002 Herkunft, HF003 getragene Farbe, HF004 change_revision.
-- Idempotent: CREATE OR REPLACE, ADD COLUMN IF NOT EXISTS, DROP TRIGGER IF EXISTS + CREATE, REVOKE/GRANT.
-- Keine Datenaenderung (neue Spalte 0, Bestandszeilen unveraendert). Portabel: reines SQL.
--
-- RUECKWEG (zuerst die App zurueck -- die neue App ruft reset_match_results und liest change_revision;
-- DANN die DB, eigene Datei <Datum>_<NNN>_guard_all_matches_rollback.sql, in EINEM Block):
--   BEGIN; SET LOCAL lock_timeout = '5s';
--   DROP TRIGGER IF EXISTS matches_bump_change_revision ON public.matches;
--   DROP TRIGGER IF EXISTS tournaments_guard_change_revision ON public.tournaments;
--   DROP FUNCTION IF EXISTS public.matches_bump_change_revision();
--   DROP FUNCTION IF EXISTS public.tournaments_guard_change_revision();
--   DROP FUNCTION IF EXISTS public.reset_match_results(uuid, uuid[]);
--   ALTER TABLE public.tournaments DROP COLUMN IF EXISTS change_revision;
--   -- Spalten-Schutz: Funktion, COMMENT und Trigger (nur BEFORE UPDATE) woertlich aus
--   -- 20261001_001_amend_event.sql Abschnitt 5 sowie dessen REVOKE-Zeile (Abschnitt 6) wieder einspielen.
--   COMMIT;
--   Danach: Assertions + PRIVILEGE_ASSERTION_NAMES zuruecknehmen, Drift-Check, Typen-PR.
--
-- Produktion: nur im DB-Fenster F2b durch den Controller nach Daniels Freigabe des woertlichen SQL
-- (A-10-sql-freigabe.md), Reihenfolge A-10 _005 -> UR _006 -> SW _007, danach Drift-Rerun, Merge, Deploy.
-- Die Migration darf vor dem Code-Merge live gehen (die alte App sendet keine Schutzspalten und liest
-- change_revision nicht). Dieser Branch spielt nichts ein.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ============================================================================================
-- 0. Voraussetzungen (Fail-fast)
-- ============================================================================================
DO $$
BEGIN
  IF to_regprocedure('public.matches_guard_engine_columns()') IS NULL
     OR to_regprocedure('public.match_has_engine_events(uuid)') IS NULL
     OR to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)') IS NULL
     OR to_regclass('public.matches') IS NULL OR to_regclass('public.tournaments') IS NULL THEN
    RAISE EXCEPTION '20261028_005_guard_all_matches: Spalten-Schutz/Schreibweg/Rechte fehlen -- zuerst 20260924_002, 20261001_001 und 20261028_001..004 einspielen';
  END IF;
END;
$$;

-- ============================================================================================
-- A. Spalten-Schutz fuer alle Spiele (Fassung 20261001_001 ohne Bedingung "hat Engine-Ereignisse")
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
       OR NEW.skipped_reason IS DISTINCT FROM OLD.skipped_reason THEN
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
  'A-10 (vorher C0b, 20261001_001): BEFORE-INSERT-OR-UPDATE-Schutz auf matches. Client-Rollen (current_user
   authenticated/anon) aendern score_a/b, overtime_score_a/b, penalty_score_a/b, match_status, decided_by,
   timer_start_time, timer_paused_at, timer_elapsed_seconds, live_state, actual_start, actual_end,
   skipped_at, skipped_reason bei KEINEM Spiel (auch ohne Engine-Ereignisse, @EK-060); beim INSERT werden
   sie neutral gesetzt. Schreiben duerfen nur append_match_events und reset_match_results (SECURITY DEFINER).';

CREATE OR REPLACE TRIGGER matches_guard_engine_columns
  BEFORE INSERT OR UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.matches_guard_engine_columns();

-- ============================================================================================
-- C (vor B, weil B die Spalte nutzt). tournaments.change_revision + Zaehlung der Spielplan-Spalten
-- ============================================================================================
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS change_revision bigint NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.tournaments.change_revision IS
  'A-10 (C-SLOT-UPDATE-OHNE-VERSION, @TM-027): zaehlt Aenderungen am Turnierinhalt ohne Versions-CAS
   (Spielplan-Spalten an matches, reset_match_results). Geraete uebernehmen die ganze Kopie, wenn der Wert
   der Cloud hoeher ist. Nur der Server schreibt (HF004). Nicht dasselbe wie version (CAS beim Speichern).';

CREATE OR REPLACE FUNCTION public.tournaments_guard_change_revision() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.change_revision := 0;
    ELSIF NEW.change_revision IS DISTINCT FROM OLD.change_revision THEN
      RAISE EXCEPTION 'Die Aenderungszaehlung des Turniers fuehrt nur der Server (Turnier %).', OLD.id
        USING ERRCODE = 'HF004';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournaments_guard_change_revision ON public.tournaments;
CREATE TRIGGER tournaments_guard_change_revision
  BEFORE INSERT OR UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.tournaments_guard_change_revision();

-- SECURITY DEFINER: Helfer haben kein UPDATE-Recht auf tournaments; die Zaehlung gilt fuer jede Rolle
-- (auch kuenftige Server-Funktionen, die Spielplan-Spalten setzen). Laeuft im Trigger-Kontext.
CREATE OR REPLACE FUNCTION public.matches_bump_change_revision() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.tournaments SET change_revision = change_revision + 1 WHERE id = NEW.tournament_id;
  RETURN NULL;
END;
$$;

-- Spaltenliste = Schluessel von mapMatchToScheduleUpdate (src/core/repositories/supabaseMappers.ts) ohne
-- updated_at und die Altspalten team_a/b_placeholder (Zwilling Z2, Waechter serverOnlyMatchColumns.test.ts).
DROP TRIGGER IF EXISTS matches_bump_change_revision ON public.matches;
CREATE TRIGGER matches_bump_change_revision
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  WHEN (OLD.team_a_id IS DISTINCT FROM NEW.team_a_id
     OR OLD.team_b_id IS DISTINCT FROM NEW.team_b_id
     OR OLD.slot_a_source IS DISTINCT FROM NEW.slot_a_source
     OR OLD.slot_b_source IS DISTINCT FROM NEW.slot_b_source
     OR OLD.round IS DISTINCT FROM NEW.round
     OR OLD.field IS DISTINCT FROM NEW.field
     OR OLD.slot IS DISTINCT FROM NEW.slot
     OR OLD.group_letter IS DISTINCT FROM NEW.group_letter
     OR OLD.is_final IS DISTINCT FROM NEW.is_final
     OR OLD.final_type IS DISTINCT FROM NEW.final_type
     OR OLD.label IS DISTINCT FROM NEW.label
     OR OLD.scheduled_start IS DISTINCT FROM NEW.scheduled_start
     OR OLD.match_number IS DISTINCT FROM NEW.match_number
     OR OLD.phase IS DISTINCT FROM NEW.phase
     OR OLD.referee_number IS DISTINCT FROM NEW.referee_number)
  EXECUTE FUNCTION public.matches_bump_change_revision();

-- ============================================================================================
-- B. reset_match_results -- Ergebnisse ohne Engine-Ereignisse zuruecksetzen (Turnierleitung)
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.reset_match_results(p_tournament_id uuid, p_match_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids uuid[];
  v_found integer;
  v_with_entries uuid[];
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'reset_match_results: nicht angemeldet' USING ERRCODE = '42501';
  END IF;
  IF p_tournament_id IS NULL OR p_match_ids IS NULL OR cardinality(p_match_ids) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'reset_match_results: Turnier und 1 bis 500 Spiele noetig' USING ERRCODE = '22023';
  END IF;
  -- Recht vor jeder Sperre; Papierkorb und unbekanntes Turnier antworten wie ein fehlendes Recht.
  IF NOT EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = p_tournament_id AND t.deleted_at IS NULL)
     OR NOT public.has_tournament_permission(p_tournament_id, 'leadMatches') THEN
    RAISE EXCEPTION 'reset_match_results: nur Turnierleitung' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest(p_match_ids) AS x WHERE x IS NOT NULL;
  -- Sperre in fester Reihenfolge (wie append_match_events je Spiel): kein Eintrag kommt dazwischen.
  SELECT count(*) INTO v_found
    FROM (SELECT m.id FROM public.matches m
           WHERE m.id = ANY (v_ids) AND m.tournament_id = p_tournament_id
           ORDER BY m.id FOR UPDATE) AS locked;
  IF v_ids IS NULL OR v_found <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'reset_match_results: Spiel gehoert nicht zu Turnier %', p_tournament_id USING ERRCODE = '22023';
  END IF;

  -- @FU-090: ein Spiel mit Eintraegen wird nie still zurueckgesetzt -- alles oder nichts.
  SELECT coalesce(array_agg(m.id ORDER BY m.match_number NULLS LAST, m.id), '{}'::uuid[]) INTO v_with_entries
    FROM public.matches m
   WHERE m.id = ANY (v_ids)
     AND EXISTS (SELECT 1 FROM public.match_events e WHERE e.match_id = m.id AND e.event_format IS NOT NULL);
  IF cardinality(v_with_entries) > 0 THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'HAS_ENTRIES', 'matchIds', to_jsonb(v_with_entries));
  END IF;

  -- Neutralwerte = INSERT-Zweig von matches_guard_engine_columns (Zwilling Z3). matches.version bleibt (Z4).
  UPDATE public.matches m SET
    score_a = NULL, score_b = NULL,
    overtime_score_a = NULL, overtime_score_b = NULL,
    penalty_score_a = NULL, penalty_score_b = NULL,
    match_status = 'scheduled', decided_by = NULL,
    timer_start_time = NULL, timer_paused_at = NULL, timer_elapsed_seconds = 0,
    live_state = NULL, actual_start = NULL, actual_end = NULL,
    skipped_at = NULL, skipped_reason = NULL,
    updated_at = now()
   WHERE m.id = ANY (v_ids)
     AND (m.score_a IS NOT NULL OR m.score_b IS NOT NULL
          OR m.overtime_score_a IS NOT NULL OR m.overtime_score_b IS NOT NULL
          OR m.penalty_score_a IS NOT NULL OR m.penalty_score_b IS NOT NULL
          OR m.match_status IS DISTINCT FROM 'scheduled' OR m.decided_by IS NOT NULL
          OR m.timer_start_time IS NOT NULL OR m.timer_paused_at IS NOT NULL
          OR coalesce(m.timer_elapsed_seconds, 0) <> 0 OR m.live_state IS NOT NULL
          OR m.actual_start IS NOT NULL OR m.actual_end IS NOT NULL
          OR m.skipped_at IS NOT NULL OR m.skipped_reason IS NOT NULL);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    UPDATE public.tournaments SET change_revision = change_revision + 1 WHERE id = p_tournament_id;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'reset', v_count);
END;
$$;

COMMENT ON FUNCTION public.reset_match_results(uuid, uuid[]) IS
  'A-10: Turnierleitung (leadMatches) setzt Ergebnisse von Spielen OHNE Engine-Ereignisse zurueck (Altbestand,
   Server-Weg statt Spalten-UPDATE). Ein Spiel mit Ereignissen -> nichts geaendert, HAS_ENTRIES (@FU-090).
   Aendert weder match_events noch matches.version; zaehlt tournaments.change_revision.';

-- ============================================================================================
-- D. Rechte
-- ============================================================================================
REVOKE ALL ON FUNCTION public.matches_guard_engine_columns() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tournaments_guard_change_revision() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.matches_bump_change_revision() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reset_match_results(uuid, uuid[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reset_match_results(uuid, uuid[]) TO authenticated;

COMMIT;
