-- A6 (.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A6-brief.md, PR A "Sofortschutz",
-- Befund C-K6, Fundament-Szenario "Spiel mit Eintraegen wird nicht still geloescht"): ein Spiel,
-- zu dem bereits match_events existieren, darf nicht mehr geloescht werden, ausser als Teil einer
-- echten Turnier-Loeschung (ON DELETE CASCADE von tournaments).
--
-- ============================================================================================
-- Problem (App-Ebene, siehe SupabaseRepository.ts)
-- ============================================================================================
--
-- SupabaseRepository.save() loescht Spiele, die in der lokal uebergebenen Turnier-Liste fehlen
-- (`matches.delete().in('id', matchesToDelete)`, save()). match_events und match_corrections
-- haengen per `ON DELETE CASCADE` am Spiel (Baseline: match_events_match_id_fkey Zeile 1465,
-- match_corrections_match_id_fkey Zeile 1461). Ein Geraet mit veralteter lokaler Spielliste (z. B.
-- nach einem Refresh-Fehler) oder ein neu erzeugter Spielplan, der ein Spiel mit bereits
-- erfassten Ereignissen nicht mehr enthaelt, loescht dieses Spiel bisher kommentarlos samt
-- Ereignissen -- ein Torschuetzen-Protokoll verschwindet, ohne dass irgendjemand es gesehen hat.
--
-- Die App-seitige Sperre (SupabaseRepository.save(), dieser Task) prueft das VOR jedem Loeschen
-- und wirft einen RepositoryError statt still zu loeschen -- das reicht fuer den normalen Weg
-- durch die App. Diese Migration ist die zweite, unabhaengige Verteidigungslinie direkt in der
-- Datenbank: sie wirkt auch, wenn ein Client die App-Pruefung umgeht (alte App-Version, direkter
-- REST-Aufruf, ein kuenftiger Bug in save()).
--
-- ============================================================================================
-- Zweiter Befund: SupabaseRepository.delete() (Turnier-Loeschung) loescht Spiele NICHT ueber
-- die Kaskade, sondern per eigenem, direktem DELETE-Statement VOR dem Loeschen des Turniers
-- ============================================================================================
--
-- `delete(id)` (SupabaseRepository.ts, vor diesem Task Zeilen ~510-524) tat bisher:
--   1. DELETE FROM matches WHERE tournament_id = id       -- eigenstaendige App-Anweisung
--   2. DELETE FROM teams WHERE tournament_id = id         -- eigenstaendige App-Anweisung
--   3. DELETE FROM tournaments WHERE id = id               -- erst danach
-- Kommentar im Bestandscode: "Note: Teams and matches should cascade delete via foreign keys" /
-- "Delete matches first (in case cascade isn't set up)" -- das war zum Zeitpunkt des Schreibens
-- offenbar unsicher; die Baseline zeigt heute zweifelsfrei ON DELETE CASCADE fuer beide
-- Fremdschluessel (Zeilen 1493 "matches_tournament_id_fkey", 1525 "teams_tournament_id_fkey").
-- Schritt 1 ist damit sowohl ueberfluessig als auch, sobald der Trigger unten existiert, SCHAEDLICH:
-- ein direktes "DELETE FROM matches WHERE tournament_id = X" ist KEINE Kaskade (das Turnier
-- existiert zu diesem Zeitpunkt noch), der Trigger wuerde ihn fuer jedes Spiel mit Ereignissen
-- zurueckweisen -- eine legitime Turnier-Loeschung (die per Auftrag ausdruecklich weiter erlaubt
-- sein soll) waere dann blockiert. Behoben im selben Task (App-Teil): `delete()` loescht jetzt NUR
-- noch die Turnierzeile selbst und ueberlaesst matches/teams/match_events/match_corrections/
-- sponsors/monitors/monitor_heartbeats/tournament_collaborators vollstaendig der ON-DELETE-CASCADE-
-- Kette (alle acht Fremdschluessel auf tournaments sind laut Baseline ON DELETE CASCADE).
--
-- ============================================================================================
-- Kaskaden-Ausnahme: pg_trigger_depth() > 1, nicht "> 0" und nicht "Turnierzeile existiert noch"
-- ============================================================================================
--
-- pg_trigger_depth() liefert die Zahl der GERADE laufenden Trigger-Ausfuehrungen. Diese Funktion
-- wird ausschliesslich als Trigger aufgerufen, deshalb ist der Wert INNERHALB von ihr selbst
-- niemals 0 -- ein top-level "DELETE FROM matches WHERE ..." (App ruft das direkt auf, keine
-- Kaskade) fuehrt genau EINEN Trigger aus (diesen hier), pg_trigger_depth() liefert dabei 1. Eine
-- durch ON DELETE CASCADE von tournaments ausgeloeste Loeschung laeuft dagegen VERSCHACHTELT: die
-- Kaskade selbst ist intern ein (AFTER-DELETE-Constraint-)Trigger auf tournaments, der seinerseits
-- "DELETE FROM matches WHERE tournament_id = OLD.id" ausloest -- innerhalb DIESES bereits
-- laufenden Triggers feuert dann der Trigger unten, pg_trigger_depth() liefert dort 2. Deshalb
-- "> 1", nicht "> 0" (das wuerde JEDEN Aufruf faelschlich als Kaskade behandeln und die Sperre
-- vollstaendig wirkungslos machen).
--
-- Alternative "Turnierzeile existiert noch" (im Auftrag genannt) waere ebenfalls korrekt --
-- innerhalb der cascade-ausgeloesten Loeschung ist die Turnierzeile zu diesem Zeitpunkt in
-- derselben Transaktion bereits verschwunden (Command-Counter-Fortschritt), ein direktes
-- "DELETE FROM matches" VOR dem Loeschen des Turniers saehe die Turnierzeile dagegen noch. Gegen
-- pg_trigger_depth() entschieden: keine zusaetzliche SELECT-Abfrage pro geloeschter Zeile noetig,
-- kein Sonderfall fuer ein Turnier, dessen Zeile aus einem anderen Grund fehlt (sollte nicht
-- vorkommen, aber pg_trigger_depth() haengt nicht von einer Fremdannahme ueber den Zustand einer
-- anderen Tabelle ab).
--
-- Randfaelle (bewusst so belassen, nicht Gegenstand dieser Migration):
-- - TRUNCATE auf matches wuerde diesen (Row-)Trigger komplett umgehen -- kein App-Pfad tut das,
--   nur ueber einen manuellen DB-Zugriff moeglich, und dort greifen ohnehin keine RLS-Policies.
-- - Eine kuenftige SECURITY-DEFINER-Funktion, die matches direkt loescht (nicht ueber eine
--   Turnier-Kaskade), bliebe von diesem Trigger ERFASST (pg_trigger_depth() ist unabhaengig von
--   SECURITY DEFINER/current_user) -- gewuenscht: die Sperre soll fuer JEDEN direkten Loeschpfad
--   gelten, nicht nur fuer App-Rollen wie bei protect_parent_keys() (dort ist die
--   current_user-Ausnahme noetig, weil legitime SECURITY-DEFINER-Schreibpfade wie
--   record_monitor_heartbeat() existieren -- fuer das direkte Loeschen eines Spiels mit
--   Ereignissen gibt es keinen entsprechenden legitimen Pfad).
-- - Eine zweistufige Kaskade (z. B. eine kuenftige Tabelle, die selbst per ON DELETE CASCADE an
--   tournaments haengt und ihrerseits matches loescht) bliebe ebenfalls erkannt: die Tiefe waere
--   dann sogar noch groesser als 2, die Bedingung "> 1" bleibt wahr.
--
-- ============================================================================================
-- Warum kein SECURITY DEFINER
-- ============================================================================================
--
-- Die Funktion liest ausschliesslich match_events (SELECT COUNT(*) ... WHERE match_id = OLD.id).
-- DELETE auf matches ist laut matches_delete_v2 (20260924_002_central_role_permissions.sql) nur
-- mit dem Recht 'restructure' erlaubt (owner/co-admin) -- genau diese Rollen duerfen laut
-- match_events_select_v3 (20260922_001) auch die Ereignisse des eigenen Turniers lesen. Der
-- Aufrufer, der ueberhaupt bis zu diesem Trigger kommt, hat also bereits ausreichend Leserechte
-- auf match_events fuer sein eigenes Turnier -- SECURITY DEFINER (mit den damit verbundenen
-- Risiken, siehe protect_owner_id()-Begruendung in 20260922_003) ist nicht noetig.
--
-- ============================================================================================
-- Fehlermeldung: eigener Text, SQLSTATE P0001 (Postgres-Default fuer RAISE EXCEPTION)
-- ============================================================================================
--
-- P0001 ("raise_exception") ist der Standard-Fehlercode fuer ein nacktes RAISE EXCEPTION ohne
-- eigenes ERRCODE und wird bereits an mehreren Stellen in diesem Projekt so verwendet (z. B.
-- enforce_release_before_public(), 20260921_001). Kein eigener SQLSTATE-Code noetig: der Text
-- ist sprechend, PostgREST liefert ihn 1:1 als error.message zurueck (kein Postgres-eigener
-- Fehlertext wie bei einer verletzten CHECK-Constraint), und SupabaseRepository.save() erkennt
-- den Fehler ohnehin nur ueber die Fehlermeldung (kein Code-Mapping im Client). Die App-seitige
-- Pruefung (save(), dieser Task) verhindert den Normalfall bereits VOR dem DELETE-Aufruf -- dieser
-- Trigger ist die zweite Verteidigungslinie, kein Pfad, den ein Nutzer im Normalbetrieb je sieht.

CREATE OR REPLACE FUNCTION "public"."protect_matches_with_events"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  event_count integer;
BEGIN
  -- Kaskaden-Ausnahme: siehe Kopfkommentar dieser Datei ("pg_trigger_depth() > 1, nicht > 0").
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO event_count
  FROM public.match_events
  WHERE match_id = OLD.id;

  IF event_count > 0 THEN
    RAISE EXCEPTION 'Spiel % hat % Ereignis(se) -- nur die Turnierleitung kann es ueber die Turnier-Loeschung absetzen.',
      COALESCE(OLD.match_number::text, OLD.id::text), event_count;
  END IF;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION "public"."protect_matches_with_events"() IS
  'BEFORE-DELETE-Schutz auf matches (A6, 20260925_002): ein Spiel mit vorhandenen match_events
   darf nicht geloescht werden, ausser als Teil einer echten ON-DELETE-CASCADE-Loeschung des
   zugehoerigen Turniers (erkannt ueber pg_trigger_depth() > 1, siehe Kopfkommentar der Datei).
   Zweite Verteidigungslinie neben der App-seitigen Pruefung in SupabaseRepository.save().';

DROP TRIGGER IF EXISTS "matches_protect_events_before_delete" ON "public"."matches";

CREATE TRIGGER "matches_protect_events_before_delete"
  BEFORE DELETE ON "public"."matches"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_matches_with_events"();
