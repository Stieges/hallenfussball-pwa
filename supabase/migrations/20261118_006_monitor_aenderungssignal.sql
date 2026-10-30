-- supabase/migrations/20261118_006_monitor_aenderungssignal.sql
-- R5 PR 1 „Sofort-Kanal“ (plan-R5-monitor.md § 3, § 4 PR 1). Record docs/anforderungen/2026-10-02_zuschauer-und-monitor.md,
-- Zone 1 „Aktualität“ (Monitor nach hoechstens 1 Sekunde, Stand und Uhr zugleich) und „Änderungssignal“ (Daniel 2026-10-29,
-- F2: ein nicht angemeldetes Geraet darf ein Signal ohne Inhalt empfangen, die Daten holt es ueber die Server-Funktion mit
-- der Positivliste). Szenarien: @ZM-084 (Zeile „Tor“, Tabellen/Finalrunde 3 s), @ZM-083, @ZM-178, @FU-001 (Monitor-Teil).
-- Befunde: C-MONPOLL (Monitor erfuhr Aenderungen nur im 5-s-Takt), B-14 M1 (nicht angemeldete Monitore bekamen seit B-14
-- kein einziges Realtime-Ereignis, weil postgres_changes die RLS je Empfaenger prueft).
--
-- Inhalt:
--   1. Trigger-Funktion public.monitor_display_signal() (SECURITY DEFINER, fester search_path, ohne EXECUTE fuer
--      Client-Rollen; bewusst NICHT im Schema public_view: dort bewacht public-read-core-unchanged genau die
--      Positivliste): schickt je Anweisung und betroffenem Turnier EIN Signal ueber Realtime-Broadcast aus der Datenbank:
--        realtime.send(jsonb_build_object('at', <Serverzeit in ms>), 'changed', 'display:' || <turnier-id>, false)
--      Oeffentlicher Kanal (private = false), Inhalt nur der Zeitpunkt (realtime.send ergaenzt eine zufaellige 'id') --
--      kein Stand, keine Namen, keine Spalte einer Tabelle. Der Monitor ruft danach display_tournament ab (Positivliste,
--      Kindermodus und Schalter bleiben allein am Server).
--      Zustellung erst nach dem Commit (realtime.send schreibt in realtime.messages, der Realtime-Dienst liest die
--      Publikation supabase_realtime_messages_publication): eine zurueckgerollte Aenderung sendet nichts.
--      Ein Fehler beim Senden (Realtime-Schema fehlt, Funktion umbenannt, ...) kippt die Aenderung NIE: eigener
--      EXCEPTION-Zweig, das Signal faellt still aus (der Monitor holt dann im Rueckfall-Takt von 2 s).
--   2. Sieben Trigger AFTER ... FOR EACH STATEMENT mit Uebergangstabellen (ein Signal je Anweisung, nicht je Zeile --
--      Voll-Speichern mit 30 Spielen = 1 Signal):
--        public.matches      INSERT, UPDATE, DELETE   (Stand, Uhr, Status, Spielplan; append_match_events schreibt je
--                                                       Aufruf eine Zeile in matches, also auch bei Karten)
--        public.teams        INSERT, UPDATE, DELETE   (Namen, Farben -> Tabellen, Folien)
--        public.tournaments  UPDATE                    (Schalter, Kindermodus, Monitore, Lebenszyklus)
--      PostgreSQL erlaubt Uebergangstabellen nur bei Triggern mit EINEM Ereignis -- deshalb je Ereignis ein Trigger.
--      Das Argument des Triggers nennt die Spalte mit der Turnier-Kennung ('tournament_id' bzw. 'id').
--
-- Rechte: keine neue Tabelle, keine Policy, keine Spalte, keine Aenderung an einer Positivliste. Realtime-Broadcast auf
-- oeffentlichen Kanaelen ist Supabase-Standard; jedes Geraet mit dem anon-Schluessel kann auf einem oeffentlichen Kanal
-- selbst senden (auch realtime.send hat EXECUTE fuer PUBLIC, Supabase-Vorgabe, nicht Teil dieser Migration). Ein
-- fremdes Signal loest beim Monitor nur einen gedrosselten Abruf aus (>= 250 ms Abstand), es wird kein Inhalt
-- uebernommen (Plan § 6 Risiko 3).
--
-- Voraussetzungen (Fail-fast unten): Schema public_view (20261117_104, display_tournament = Abruf nach dem Signal),
--   Tabellen public.matches/teams mit tournament_id, public.tournaments mit id. realtime.send wird NICHT vorausgesetzt:
--   fehlt sie (reiner Postgres-Container der Pruefskripte, Realtime-Dienst noch nicht verbunden), faellt das Signal
--   still aus.
-- Idempotent: CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS + CREATE TRIGGER, REVOKE.
-- Bestandsdaten: keine Aenderung an Zeilen.
--
-- RUECKWEG: supabase/rollbacks/20261118_006_monitor_aenderungssignal_rollback.sql (erzeugt mit
--   `bash scripts/monitor-signal-check.sh --print-rueckweg`, belegt dort in Kategorie X: Schema danach = vorher).
--   Reihenfolge: zuerst Rueckweg, die App braucht das Signal nicht (Rueckfall-Takt 2 s).
--
-- Produktion: nur nach Daniels Freigabe, Daniel spielt selbst ein. Dieser Branch spielt nichts ein. Kein Typen-PR noetig
-- (keine neue Spalte, keine neue RPC).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regnamespace('public_view') IS NULL THEN
    RAISE EXCEPTION '20261118_006: Schema public_view fehlt (20261117_104 zuerst einspielen)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'tournament_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'tournament_id')
     OR to_regclass('public.tournaments') IS NULL THEN
    RAISE EXCEPTION '20261118_006: public.matches/teams.tournament_id oder public.tournaments fehlt';
  END IF;
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN
    RAISE NOTICE '20261118_006: realtime.send fehlt hier -- das Signal faellt still aus, bis der Realtime-Dienst es anlegt';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Trigger-Funktion
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.monitor_display_signal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
-- R5 Sofort-Kanal: ein Signal ohne Inhalt je Anweisung und Turnier (Zeitpunkt in ms), Kanal 'display:<turnier-id>'.
DECLARE
  v_key text := TG_ARGV[0];
  v_at bigint := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  v_id text;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      FOR v_id IN SELECT DISTINCT to_jsonb(r) ->> v_key FROM old_rows r LOOP
        CONTINUE WHEN v_id IS NULL;
        PERFORM realtime.send(jsonb_build_object('at', v_at), 'changed', 'display:' || v_id, false);
      END LOOP;
    ELSE
      FOR v_id IN SELECT DISTINCT to_jsonb(r) ->> v_key FROM new_rows r LOOP
        CONTINUE WHEN v_id IS NULL;
        PERFORM realtime.send(jsonb_build_object('at', v_at), 'changed', 'display:' || v_id, false);
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ein Signal darf nie eine Aenderung kippen; der Monitor holt im Rueckfall-Takt.
    NULL;
  END;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.monitor_display_signal() IS
  'R5 Sofort-Kanal (20261118_006): Signal ohne Inhalt {at} auf dem oeffentlichen Kanal display:<turnier-id> je Anweisung; '
  'Fehler beim Senden kippen die Aenderung nie.';

REVOKE ALL ON FUNCTION public.monitor_display_signal() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Trigger (je Ereignis einer, Uebergangstabellen nur mit einem Ereignis erlaubt)
-- ---------------------------------------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS matches_signal_display_insert ON public.matches;
CREATE TRIGGER matches_signal_display_insert AFTER INSERT ON public.matches
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.monitor_display_signal('tournament_id');

DROP TRIGGER IF EXISTS matches_signal_display_update ON public.matches;
CREATE TRIGGER matches_signal_display_update AFTER UPDATE ON public.matches
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.monitor_display_signal('tournament_id');

DROP TRIGGER IF EXISTS matches_signal_display_delete ON public.matches;
CREATE TRIGGER matches_signal_display_delete AFTER DELETE ON public.matches
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.monitor_display_signal('tournament_id');

DROP TRIGGER IF EXISTS teams_signal_display_insert ON public.teams;
CREATE TRIGGER teams_signal_display_insert AFTER INSERT ON public.teams
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.monitor_display_signal('tournament_id');

DROP TRIGGER IF EXISTS teams_signal_display_update ON public.teams;
CREATE TRIGGER teams_signal_display_update AFTER UPDATE ON public.teams
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.monitor_display_signal('tournament_id');

DROP TRIGGER IF EXISTS teams_signal_display_delete ON public.teams;
CREATE TRIGGER teams_signal_display_delete AFTER DELETE ON public.teams
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.monitor_display_signal('tournament_id');

DROP TRIGGER IF EXISTS tournaments_signal_display_update ON public.tournaments;
CREATE TRIGGER tournaments_signal_display_update AFTER UPDATE ON public.tournaments
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.monitor_display_signal('id');

COMMIT;
