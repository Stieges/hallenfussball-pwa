-- supabase/migrations/20261118_001_verschieben_server.sql
-- R8 (Befund C-VERSCHIEBEN-NUR-CLIENT, Opus-Review PR #376 B1 und Empfehlung 4): Der Server prueft das Verschieben von
-- Spielzeiten selbst, nicht nur die App. Record docs/anforderungen/2026-10-02_zeitplan-rueckt-nach.md, Zone 1
-- "Von Hand anpassen" und "Wer darf was".
-- Szenarien: @ZP-016 (laufende und beendete Spiele werden nie verschoben), @ZP-062 (unterbrochene Spiele gelten als
--   laufend), @ZP-057 (in die Vergangenheit zieht die App kein Spiel vor, "jetzt" = Serverzeit), @ZP-041 und @ZP-084
--   (der Server lehnt Zeitplan-Aenderungen ohne Recht ab), @ZP-008/@ZP-009 (frueher Anpfiff bleibt moeglich, die
--   Folgezeiten bleiben), @TM-027 (Aenderungszaehlung der Spielplan-Spalten).
--
-- Inhalt:
--   1. Trigger-Funktion public.matches_guard_schedule_times() (SECURITY INVOKER, fester search_path, ohne EXECUTE fuer
--      Client-Rollen) und Trigger matches_guard_schedule_times BEFORE UPDATE OF scheduled_start, original_start ON
--      public.matches. Gilt nur fuer Client-Rollen (current_user authenticated/anon, Muster matches_guard_kit_columns);
--      Server-Funktionen (SECURITY DEFINER), service_role und Migrationen bleiben frei.
--      a. Recht: scheduled_start oder original_start aendern nur Konten mit manageSchedule (Eigentuemer, Co-Admin).
--         Heute schliesst das schon matches_update_v4 (20261110_001: UPDATE nur mit manageSchedule, Helfer treffen
--         0 Zeilen); der Trigger haelt die Regel auch dann, wenn eine spaetere Policy UPDATE fuer weitere Rollen
--         oeffnet. Ablehnung 42501.
--      b. Angepfiffen: ist das Spiel laufend, unterbrochen oder beendet (match_status running, paused, finished; die
--         Engine-Zustaende section_break, decision_pending und shootout stehen in der Spalte als paused), bleibt
--         scheduled_start, wie er ist. Ein UPDATE mit demselben Wert (Voll-Speichern der App schreibt die
--         Zeitplan-Spalten aller Spiele) geht durch. Ablehnung HF005 SCHEDULE_LOCKED. Ausgefallene (skipped) und
--         wartende Spiele sind nicht gesperrt (die App verschiebt sie nicht mit, eine Neuansetzung bleibt moeglich).
--      c. Vergangenheit: wird ein Spiel vorgezogen (neue Uhrzeit frueher als die alte) und ist heute sein Turniertag
--         (tournaments.date = Datum in Europe/Berlin), darf die neue Uhrzeit nicht vor der laufenden Minute liegen
--         (Turnierdatum + scheduled_start als Wanduhr in Europe/Berlin, verglichen mit now() des Servers). Ablehnung
--         HF005 SCHEDULE_PAST. Nach hinten schieben prueft das nicht (ein ueberfaelliges Spiel ist geparkt, N38).
--         Ein Turnier mit vergangenem Datum (Nacharbeit) und ein kuenftiges Turnier pruefen nichts.
--   2. Trigger matches_bump_change_revision (Fassung 20261028_005) zaehlt zusaetzlich original_start (Review #376
--      Empfehlung 4); die Funktion bleibt unveraendert.
--
-- Der Anpfiff (auch der fruehe, @ZP-008) schreibt scheduled_start nicht: append_match_events setzt nur Stand, Status,
-- Uhr und actual_start (SECURITY DEFINER, current_user ist dort nicht authenticated). Belegt in
-- scripts/verschieben-server-check.sh (Kategorie A).
--
-- Fehlercodes: HF001 make_tournament_public, HF002 Herkunft, HF003 getragene Farbe, HF004 change_revision,
--   HF005 Uhrzeit nicht angenommen (SCHEDULE_LOCKED angepfiffen, SCHEDULE_PAST Vergangenheit).
--
-- Voraussetzungen (Fail-fast unten): has_tournament_permission (20261110_002), matches.original_start (20261117_104),
--   matches_bump_change_revision() (20261028_005), matches.scheduled_start und original_start vom Typ time,
--   tournaments.date vom Typ date, Statusliste von matches_match_status_check unveraendert.
-- Idempotent: CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS + CREATE TRIGGER, REVOKE.
-- Bestandsdaten: keine Aenderung an Zeilen, kein Backfill. Live (24.10.): 6 Spiele, davon 1 laufend und 1 beendet.
--
-- RUECKWEG: eigene Datei (Anhang B der Freigabe-Unterlage R8-sql-freigabe-2026-10-24.md, erzeugt mit
--   `bash scripts/verschieben-server-check.sh --print-rueckweg`), EIN Block: Trigger und Funktion entfernen,
--   matches_bump_change_revision woertlich wie 20261028_005. Belegt in scripts/verschieben-server-check.sh
--   (Kategorie X: Schema danach = vorher).
--
-- Produktion: nur nach Daniels Freigabe (R8-sql-freigabe-2026-10-24.md), Daniel spielt selbst ein. Dieser Branch spielt
-- nichts ein. Kein Typen-PR noetig (keine neue Spalte, keine neue RPC).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'has_tournament_permission(uuid,text) (20261110_002)');
  END IF;
  IF to_regprocedure('public.matches_bump_change_revision()') IS NULL THEN
    v_missing := array_append(v_missing, 'matches_bump_change_revision() (20261028_005)');
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'matches'
         AND column_name IN ('scheduled_start', 'original_start') AND data_type = 'time without time zone') <> 2 THEN
    v_missing := array_append(v_missing, 'matches.scheduled_start/original_start als time (20261117_104)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'date'
                    AND data_type = 'date') THEN
    v_missing := array_append(v_missing, 'tournaments.date als date');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.matches'::regclass AND conname = 'matches_match_status_check'
                    AND pg_get_constraintdef(oid) = 'CHECK ((match_status = ANY (ARRAY[''scheduled''::text, ''waiting''::text, ''running''::text, ''paused''::text, ''finished''::text, ''skipped''::text])))') THEN
    v_missing := array_append(v_missing, 'matches_match_status_check mit scheduled/waiting/running/paused/finished/skipped');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION '20261118_001_verschieben_server: Voraussetzungen fehlen: %', array_to_string(v_missing, '; ')
      USING ERRCODE = '55000';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Server-Pruefung beim Verschieben
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.matches_guard_schedule_times() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day date;
  v_new_at timestamptz;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;   -- Server-Funktionen (SECURITY DEFINER), service_role, Migrationen
  END IF;
  IF NEW.scheduled_start IS NOT DISTINCT FROM OLD.scheduled_start
     AND NEW.original_start IS NOT DISTINCT FROM OLD.original_start THEN
    RETURN NEW;   -- Voll-Speichern mit unveraenderten Zeitplan-Spalten
  END IF;

  -- a. Recht (@ZP-041, @ZP-084)
  IF NOT public.has_tournament_permission(OLD.tournament_id, 'manageSchedule') THEN
    RAISE EXCEPTION 'Nicht erlaubt: Uhrzeiten aendert nur, wer den Zeitplan verwalten darf (Spiel %).', OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.scheduled_start IS NOT DISTINCT FROM OLD.scheduled_start THEN
    RETURN NEW;   -- nur original_start geaendert
  END IF;

  -- b. Angepfiffen (@ZP-016, @ZP-062)
  IF OLD.match_status IN ('running', 'paused', 'finished') THEN
    RAISE EXCEPTION 'SCHEDULE_LOCKED: Spiel % ist angepfiffen oder beendet (%), seine Uhrzeit bleibt.', OLD.id, OLD.match_status
      USING ERRCODE = 'HF005';
  END IF;

  -- c. Vergangenheit beim Vorziehen am Turniertag (@ZP-057)
  IF OLD.scheduled_start IS NOT NULL AND NEW.scheduled_start IS NOT NULL AND NEW.scheduled_start < OLD.scheduled_start THEN
    SELECT t.date INTO v_day FROM public.tournaments t WHERE t.id = OLD.tournament_id;
    IF v_day IS NULL THEN
      RAISE EXCEPTION 'SCHEDULE_PAST: Turniertag von Spiel % nicht lesbar, Vorziehen nicht angenommen.', OLD.id
        USING ERRCODE = 'HF005';
    END IF;
    IF v_day = (now() AT TIME ZONE 'Europe/Berlin')::date THEN
      v_new_at := (v_day + NEW.scheduled_start) AT TIME ZONE 'Europe/Berlin';
      IF v_new_at < date_trunc('minute', now()) THEN
        RAISE EXCEPTION 'SCHEDULE_PAST: Spiel % wuerde auf % ruecken, das liegt in der Vergangenheit.', OLD.id, NEW.scheduled_start
          USING ERRCODE = 'HF005';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.matches_guard_schedule_times() IS
  'R8 (20261118_001, C-VERSCHIEBEN-NUR-CLIENT): BEFORE UPDATE OF scheduled_start, original_start auf matches, nur fuer
   Client-Rollen (current_user authenticated/anon). Uhrzeiten nur mit manageSchedule (42501); laufendes, unterbrochenes
   oder beendetes Spiel behaelt scheduled_start (HF005 SCHEDULE_LOCKED, gleicher Wert geht durch); Vorziehen am
   Turniertag nicht vor die laufende Minute (Europe/Berlin, Serverzeit; HF005 SCHEDULE_PAST).';

REVOKE ALL ON FUNCTION public.matches_guard_schedule_times() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS matches_guard_schedule_times ON public.matches;
CREATE TRIGGER matches_guard_schedule_times
  BEFORE UPDATE OF scheduled_start, original_start ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.matches_guard_schedule_times();

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Aenderungszaehlung um original_start (Fassung 20261028_005 + eine Zeile)
-- ---------------------------------------------------------------------------------------------------------------
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
     OR OLD.original_start IS DISTINCT FROM NEW.original_start
     OR OLD.match_number IS DISTINCT FROM NEW.match_number
     OR OLD.phase IS DISTINCT FROM NEW.phase
     OR OLD.referee_number IS DISTINCT FROM NEW.referee_number)
  EXECUTE FUNCTION public.matches_bump_change_revision();

COMMIT;
