-- A6 (.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A6-brief.md, PR A "Sofortschutz",
-- Befund C-K6): ein Spiel, zu dem bereits match_events existieren, darf nicht geloescht werden,
-- ausser als Teil einer echten Turnier-Loeschung (ON DELETE CASCADE von tournaments). Zweite,
-- unabhaengige Verteidigungslinie neben der App-seitigen Pruefung in SupabaseRepository.save()
-- (die den Normalfall abfaengt, BEVOR ueberhaupt ein DELETE versucht wird -- seit Fixrunde 1,
-- Ruling AN, wirft save() dafuer nicht mehr, sondern laesst das Spiel stehen und meldet es ueber
-- einen Hinweis-Kanal, siehe core/services/matchProtectionNotices.ts). Dieser Trigger greift dort,
-- wo die App-Pruefung nicht laeuft: alte App-Version, direkter REST-Aufruf, ein Race zwischen
-- Pruefung und DELETE, ein kuenftiger Bug in save().
--
-- Fixrunde 1 (task-A6-review.md): SECURITY DEFINER ergaenzt (M1), Falschangaben im Kopfkommentar
-- korrigiert (M2) und der RAISE-Text neutral formuliert (M3) -- Details in den jeweiligen
-- Abschnitten unten. Migration bleibt idempotent (CREATE OR REPLACE FUNCTION, DROP TRIGGER IF
-- EXISTS + CREATE TRIGGER), unveraendert seit Fixrunde 0.
--
-- ============================================================================================
-- Kaskaden-Ausnahme: pg_trigger_depth() > 1
-- ============================================================================================
--
-- pg_trigger_depth() liefert die Zahl der GERADE laufenden Trigger-Ausfuehrungen. Diese Funktion
-- wird ausschliesslich als Trigger aufgerufen, deshalb ist der Wert INNERHALB von ihr selbst
-- niemals 0: ein top-level "DELETE FROM matches WHERE ..." fuehrt genau EINEN Trigger aus (diesen
-- hier), pg_trigger_depth() liefert dabei 1. Eine durch ON DELETE CASCADE von tournaments
-- ausgeloeste Loeschung laeuft dagegen VERSCHACHTELT: die Kaskade selbst ist intern ein
-- (AFTER-DELETE-Constraint-)Trigger auf tournaments, der seinerseits
-- "DELETE FROM matches WHERE tournament_id = OLD.id" ausloest -- innerhalb DIESES bereits
-- laufenden Triggers feuert dann der Trigger unten, pg_trigger_depth() liefert dort 2. Deshalb
-- "> 1", nicht "> 0" (das wuerde JEDEN Aufruf faelschlich als Kaskade behandeln und die Sperre
-- wirkungslos machen). Durch Probe 5/5b/5c im Container empirisch bestaetigt (siehe
-- scripts/protect-matches-with-events-check.sh).
--
-- Review-Suche (task-A6-review.md, Adversarial-Punkt 1) ueber ALLE Migrationen: kein Trigger und
-- keine Funktion enthaelt "DELETE FROM matches" ausser der tournaments-Kaskade selbst.
-- matches.team_a_id/team_b_id sind ON DELETE SET NULL, nicht CASCADE (Baseline :1485/:1489) --
-- eine Team-Loeschung loescht also keine Spiele. tournament_id ist per eigenem Trigger
-- (matches_protect_tournament_id, 20260923_001) unveraenderlich, ein Umhaengen in ein anderes
-- Turnier (und damit ein indirekter Weg zu Tiefe > 1 ohne echte Turnier-Loeschung) ist damit
-- ausgeschlossen. Einziger weiterer Weg mit Tiefe > 1: Loeschen eines auth.users-Eintrags
-- (-> tournaments -> matches, Tiefe 3) -- legitime Konto-Loeschung, kein Umgehungsweg.
--
-- Randfaelle (bewusst so belassen, nicht Gegenstand dieser Migration):
-- - TRUNCATE auf matches wuerde diesen (Row-)Trigger komplett umgehen -- ueber PostgREST nicht
--   erreichbar, nur per direktem DB-Zugriff moeglich.
-- - Eine kuenftige SECURITY-DEFINER-Funktion, die matches direkt loescht (nicht ueber eine
--   Turnier-Kaskade), bliebe von diesem Trigger ERFASST -- gewuenscht, siehe SECURITY-DEFINER-
--   Abschnitt unten.
--
-- ============================================================================================
-- M1/SECURITY DEFINER: die Ereignis-Zaehlung ist jetzt unabhaengig von der Lese-Policy des
-- Aufrufers -- und warum das hier sicher ist
-- ============================================================================================
--
-- Fixrunde 0 begruendete "kein SECURITY DEFINER noetig" damit, dass jeder Aufrufer, der ueberhaupt
-- DELETE-Rechte auf matches hat (matches_delete_v2, Recht 'restructure', owner/co-admin), auch
-- match_events des eigenen Turniers lesen darf (match_events_select_v3). Das Review (M1) weist
-- zu Recht darauf hin: das koppelt die Sperre an eine RLS-Policy, die sich unabhaengig von dieser
-- Migration aendern kann (z. B. ein kuenftiger Ausschluss soft-geloeschter Ereignisse aus der
-- Lese-Policy) -- wird match_events_select_v3 enger, zaehlt dieser Trigger dann still 0 und laesst
-- ein Spiel mit tatsaechlich vorhandenen Ereignissen durch, OHNE dass irgendjemand diese Migration
-- angefasst haette. SECURITY DEFINER trennt die Zaehlung von der Lese-Policy: die Funktion zaehlt
-- IMMER alle match_events der Zeile, unabhaengig davon, was der Aufrufer selbst sehen darf.
--
-- Warum das hier sicher ist (SECURITY DEFINER ist normalerweise ein Risiko -- die Funktion laeuft
-- mit den Rechten ihres Eigentuemers, nicht des Aufrufers):
-- 1. Kein Eingabeparameter unter Kontrolle des Aufrufers: OLD.id kommt aus der Zeile, die gerade
--    geloescht wird (der Aufrufer hat sie per DELETE-Statement selbst ausgewaehlt, RLS von
--    matches_delete_v2 hat den Zugriff auf GENAU diese Zeile bereits geprueft) -- keine
--    Injektionsflaeche, kein frei waehlbarer Fremdschluessel.
-- 2. Nur lesend (SELECT COUNT(*)), keine Schreiboperation -- die Funktion kann nicht als Umweg
--    genutzt werden, um irgendetwas zu SCHREIBEN, das der Aufrufer selbst nicht duerfte.
-- 3. Der einzige "Mehrwert" gegenueber den Rechten des Aufrufers ist die Ereignisanzahl einer
--    Zeile, auf die der Aufrufer ohnehin schon DELETE-Zugriff hat (er verwaltet dieses Spiel als
--    owner/co-admin) -- keine Eskalation auf fremde Turniere: OLD.id ist immer eine Zeile des
--    Turniers, das der Aufrufer gerade administriert.
-- 4. Trigger-Funktionen (RETURNS trigger) sind ohnehin nicht per SELECT/direktem Aufruf erreichbar
--    -- Postgres laesst sie ausschliesslich im Trigger-Kontext laufen. Keine direkte Aufrufflaeche
--    fuer irgendeine Rolle.
-- 5. Fester search_path (siehe unten) schliesst das klassische SECURITY-DEFINER-Risiko
--    (search-path-hijacking ueber eine gleichnamige Funktion/Tabelle in einem frueheren Schema)
--    aus.
-- Damit ist SECURITY DEFINER hier eine reine Entkopplung von der Lese-Policy, keine
-- Rechteausweitung.
--
-- ============================================================================================
-- Fester search_path, kein dynamisches SQL, idempotent
-- ============================================================================================
--
-- SET "search_path" TO 'public', 'pg_temp' (wie protect_owner_id()/protect_parent_keys(),
-- 20260922_003/20260923_001) -- qualifizierte Tabellenreferenz (public.match_events) zusaetzlich,
-- doppelt abgesichert. CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS/CREATE TRIGGER: zweite
-- Anwendung im selben Container ist ein No-op (siehe Nachweis im Report).
--
-- ============================================================================================
-- M3: RAISE-Text neutral formuliert
-- ============================================================================================
--
-- Fixrunde 0 endete mit "... nur die Turnierleitung kann es ueber die Turnier-Loeschung
-- absetzen." -- dieser Text landet woertlich in SyncFailedList (A4), sobald ein RACE (Ereignis
-- entsteht zwischen App-Pruefung und DELETE) oder ein alter Client diesen Trigger tatsaechlich
-- ausloest, und legt faelschlich nahe, das GANZE Turnier muesse geloescht werden, um dieses eine
-- Spiel loszuwerden -- es gibt keine "Turnierleitung"-Sonderrolle und keine "absetzen"-Funktion.
-- Jetzt: "Spiel % hat % Ereignis(se) und wurde nicht geloescht." -- sachlich, ohne eine
-- Handlungsmoeglichkeit zu suggerieren, die nicht existiert. Dieselbe Formulierung wie der neue
-- App-seitige Hinweistext (matchProtectionNotices.ts/useMatchProtectionNotices.ts).
--
-- ============================================================================================
-- Bekannte Grenze (M4, unveraendert seit Fixrunde 0 -- nicht Gegenstand dieser Migration)
-- ============================================================================================
--
-- Dieser Trigger deckt NUR match_events ab, nicht match_corrections, und prueft NICHT
-- match_status -- ein beendetes Spiel OHNE Ereignisse (z. B. 0:0 ohne einen einzigen erfassten
-- Vorfall) waere fuer die Datenbank loeschbar, obwohl die App-Pruefung es zurueckhaelt (sie prueft
-- zusaetzlich match_status). Absichtlich nicht erweitert: die App-Pruefung deckt den Normalfall
-- vollstaendig ab, dieser Trigger ist die zweite Linie fuer genau den Fall "Spiel mit Ereignissen
-- wird uebergangen" (C-K6) -- eine Erweiterung auf match_status/match_corrections waere eine
-- eigene Entscheidung mit eigenen Randfaellen (z. B. ein absichtlich leeres, aber korrekt
-- beendetes Spiel), nicht Teil dieses Auftrags.

CREATE OR REPLACE FUNCTION "public"."protect_matches_with_events"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  event_count integer;
BEGIN
  -- Kaskaden-Ausnahme: siehe Kopfkommentar dieser Datei ("pg_trigger_depth() > 1").
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO event_count
  FROM public.match_events
  WHERE match_id = OLD.id;

  IF event_count > 0 THEN
    RAISE EXCEPTION 'Spiel % hat % Ereignis(se) und wurde nicht geloescht.',
      COALESCE(OLD.match_number::text, OLD.id::text), event_count;
  END IF;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION "public"."protect_matches_with_events"() IS
  'BEFORE-DELETE-Schutz auf matches (A6, 20260925_002, Fixrunde 1/M1: SECURITY DEFINER): ein Spiel
   mit vorhandenen match_events darf nicht geloescht werden, ausser als Teil einer echten
   ON-DELETE-CASCADE-Loeschung des zugehoerigen Turniers (erkannt ueber pg_trigger_depth() > 1,
   siehe Kopfkommentar der Datei). SECURITY DEFINER entkoppelt die Zaehlung von der
   match_events-Lese-Policy des Aufrufers (Begruendung, warum das hier sicher ist: Kopfkommentar
   der Datei, Abschnitt "M1/SECURITY DEFINER"). Zweite Verteidigungslinie neben der App-seitigen
   Pruefung in SupabaseRepository.save() (die den Normalfall bereits vor jedem Schreibzugriff
   abfaengt, ohne zu werfen -- Ruling AN, siehe core/services/matchProtectionNotices.ts).';

DROP TRIGGER IF EXISTS "matches_protect_events_before_delete" ON "public"."matches";

CREATE TRIGGER "matches_protect_events_before_delete"
  BEFORE DELETE ON "public"."matches"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_matches_with_events"();
