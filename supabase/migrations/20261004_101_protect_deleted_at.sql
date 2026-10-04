-- ============================================================================
-- 20261004_101_protect_deleted_at.sql
-- B-01 Paket b (Spur B, Nummernkreis _1xx): Server-Sperre
-- "Turnier nach dem ersten Anpfiff nicht loeschbar" (@LZ-003).
--
-- Paket a (Client) bietet "Turnier loeschen" nach dem ersten Anpfiff nicht mehr
-- an (DangerZone, getMatchStartState). Diese Migration erzwingt dieselbe Regel
-- auf dem Server -- zwei Pfade:
--
--   1. Soft-Delete (App-Weg: Papierkorb/loeschen setzt tournaments.deleted_at
--      ueber save()/softDelete) -- BEFORE UPDATE via protect_deleted_at():
--      Wechselt deleted_at von NULL auf einen Wert und gilt das Turnier als
--      "angepfiffen", dann RAISE EXCEPTION 'tournament_started: ...'
--      (ERRCODE P0001). "Angepfiffen" heisst hier: ein Spiel mit Status
--      laufend/pausiert/beendet ODER irgendein match_events-Eintrag (ein
--      erfasstes Ereignis ist der Beweis fuer den Anpfiff, auch wenn der
--      Spielstatus nicht mitgezogen wurde -- Prueffall (e) des Skripts
--      scripts/protect-deleted-at-check.sh).
--   2. Hartes DELETE FROM tournaments (Policy tournaments_delete_v2 erlaubt es
--      dem Eigentuemer -- z. B. DELETE_TOURNAMENT aus der Mutations-Queue):
--      BEFORE-DELETE-Trigger protect_tournament_delete_started() mit derselben
--      Sperre-Meldung. ABWEICHUNG zum Soft-Delete-Pfad bewusst: hier zaehlt
--      EREIGNISSE allein NICHT als Anpfiff, sondern nur der Spielstatus
--      laufend/pausiert/beendet. Begruendung: das Abschlusskriterium zu
--      scripts/protect-matches-with-events-check.sh Fall 5 verlangt, dass das
--      vollstaendige Loeschen eines Turniers mit geplanten Spielen UND
--      Ereignissen per Kaskade weiter ERLAUBT bleibt (A6-Nachweis "Spiel mit
--      Ereignissen wird nie still geloescht" -- dort ist der Kaskaden-Fall die
--      einzige zugelassene Gesamtloeschung). Wuerde der BEFORE-DELETE-Trigger
--      auch Ereignisse sperren, ginge genau dieser Fall auf rot. Die
--      Ereignis-Sperre greift damit auf dem Pfad, den die App benutzt
--      (Soft-Delete/Papierkorb), und der Status-Kern (Anpfiff im engeren Sinn)
--      auf BEIDEN Pfaden.
--
-- Die bestehende Rechtepruefung in protect_deleted_at() bleibt UNVERAENDERT
-- (deleteTournament -- heute nur der Eigentuemer, siehe Kommentar in
-- supabase/migrations/20260924_002_central_role_permissions.sql Abschnitt 8).
-- Die neue Sperre haengt NICHT an current_user: sie ist eine Daten-Invariante
-- ("angepfiffen" -> nicht loeschbar), nicht eine Rechtefrage.
--
-- Gegenprobe: scripts/protect-deleted-at-check.sh (Faelle a-g, Exit != 0 bei
-- jeder Abweichung). Ohne diese Migration sind die Faelle (b)-(f) rot.
--
-- IDEMPOTENZ: ausschliesslich CREATE OR REPLACE (Funktionen und Trigger),
-- keine bedingte Logik ueber Bestandszeilen, keine Abhaengigkeit von
-- Zwischenstaenden -- der Lauf kann beliebig oft wiederholt werden.
--
-- Bestandsdaten: keine Zeilenänderung, nur neue Sperre
--   Prognose gegen Prod (nur gelesen): Keine Zeile wird geaendert, kein
--   Backfill, keine Constraint-Nachpruefung. Die Sperre wirkt nur auf
--   ZUKUENFTIGE Aenderungen (NULL -> deleted_at, hartes DELETE). Bestehende
--   Papierkorb-Zeilen (deleted_at bereits gesetzt) bleiben unangetastet --
--   Wiederherstellen (deleted_at -> NULL) bleibt ausdruecklich erlaubt
--   (Prueffall (g)), ebenso das Veraendern eines Turniers ohne
--   deleted_at-Wechsel (die App schickt deleted_at bei jedem save() mit
--   unveraendertem Wert mit, siehe Kommentar in 20260924_002 Abschnitt 8).
--   Hinweis am Rande: ein Turnier, das VOR dieser Migration bereits in den
--   Papierkorb gelangt ist, OBWOHL es angepfiffen war, kann weiterhin per
--   Wiederherstellen zurueckgeholt und danach nur noch gemaess der neuen
--   Regel behandelt werden; die Aufraeum-Funktion des Papierkorbs loescht es
--   hart nur weiterhin, solange keine laufenden/pausierten/beendeten Spiele
--   uebrig sind (Status-Kern des BEFORE-DELETE-Triggers).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. tournament_has_started() -- ist das Turnier "angepfiffen"?
--    true bei einem Spiel mit Status laufend/pausiert/beendet ODER irgendeinem
--    match_events-Eintrag eines Spiels dieses Turniers (is_deleted-Ereignisse
--    zaehlen mit -- sie bleiben im Verlauf, @SL-129, und belegen den Anpfiff).
--    SECURITY DEFINER + fester search_path wie has_tournament_permission():
--    die Zaehlung darf nicht an der Lese-Policy des Aufrufers haengen.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."tournament_has_started"("p_tournament_id" "uuid")
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
           SELECT 1
             FROM "public"."matches" "m"
            WHERE "m"."tournament_id" = "p_tournament_id"
              AND "m"."match_status" IN ('running', 'paused', 'finished')
         )
      OR EXISTS (
           SELECT 1
             FROM "public"."match_events" "e"
             JOIN "public"."matches" "m" ON "m"."id" = "e"."match_id"
            WHERE "m"."tournament_id" = "p_tournament_id"
         );
$$;

COMMENT ON FUNCTION "public"."tournament_has_started"("uuid") IS
  'B-01b: true, sobald das Turnier als "angepfiffen" gilt -- ein Spiel mit Status
   running/paused/finished ODER irgendein match_events-Eintrag eines Spiels dieses
   Turniers. Gemeinsamer Kern der Sperre "Turnier nach dem ersten Anpfiff nicht
   loeschbar" (@LZ-003).';


-- ----------------------------------------------------------------------------
-- 2. protect_deleted_at() -- Soft-Delete-Sperre (BEFORE UPDATE)
--    Block 1 (UNVERAENDERT aus 20260924_002 Abschnitt 8): deleted_at nur mit
--    dem Recht deleteTournament.
--    Block 2 (NEU): NULL -> Wert bei angepfiffenem Turnier -> RAISE
--    'tournament_started: ...' (ERRCODE P0001).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."protect_deleted_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     AND NOT "public"."has_tournament_permission"(OLD.id, 'deleteTournament')
     AND current_user IN ('authenticated', 'anon')
  THEN
    RAISE EXCEPTION 'Nicht erlaubt: nur der Turnier-Eigentuemer darf deleted_at aendern.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.deleted_at IS NOT NULL
     AND OLD.deleted_at IS NULL
     AND "public"."tournament_has_started"(OLD.id)
  THEN
    RAISE EXCEPTION 'tournament_started: Turnier kann nach dem ersten Anpfiff nicht geloescht werden.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."protect_deleted_at"() IS
  'BEFORE-UPDATE-Schutz: (1) tournaments.deleted_at (Soft-Delete) ist nur fuer Rollen
   mit dem Recht deleteTournament aenderbar -- role_permissions weist es heute KEINER
   Rolle zu, has_tournament_permission() reduziert sich fuer dieses Recht also auf den
   Eigentuemer-Zweig (user_owns_tournament()). RAISE nur bei TATSAECHLICHER Aenderung
   (IS DISTINCT FROM) -- die App schickt deleted_at bei jedem save() ungefragt mit
   demselben Wert mit (supabaseMappers.ts), ein unveraendertes Speichern durch einen
   Co-Admin darf deshalb nicht scheitern. SECURITY-DEFINER-Aufrufe sind ausgenommen
   (current_user-Muster wie protect_owner_id/protect_parent_keys).
   (2) NEU (B-01b, @LZ-003): Wechselt deleted_at von NULL auf einen Wert und gilt das
   Turnier als angepfiffen (tournament_has_started), dann RAISE EXCEPTION
   tournament_started: ... mit ERRCODE P0001 -- nach dem ersten Anpfiff ist kein
   Loeschen (Soft-Delete) moeglich. Wiederherstellen (NULL setzen) bleibt erlaubt.
   Gegenprobe: scripts/protect-deleted-at-check.sh.';


-- ----------------------------------------------------------------------------
-- 3. protect_tournament_delete_started() -- hartes DELETE (BEFORE DELETE)
--    Policy tournaments_delete_v2 (Baseline) erlaubt dem Eigentuemer DELETE --
--    ohne diesen Trigger waere die Sperre per direktem DELETE FROM tournaments
--    (z. B. DELETE_TOURNAMENT aus der Mutations-Queue) umgehbar.
--    Sperre-Meldung wie oben ('tournament_started: ...', ERRCODE P0001).
--    Kriterium: Spielstatus laufend/pausiert/beendet -- siehe Kopfkommentar,
--    Ereignisse allein sperren den Kaskaden-Fall NICHT
--    (scripts/protect-matches-with-events-check.sh Fall 5 bleibt gruen).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."protect_tournament_delete_started"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF EXISTS (
       SELECT 1
         FROM "public"."matches" "m"
        WHERE "m"."tournament_id" = OLD.id
          AND "m"."match_status" IN ('running', 'paused', 'finished')
     )
  THEN
    RAISE EXCEPTION 'tournament_started: Turnier kann nach dem ersten Anpfiff nicht geloescht werden.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION "public"."protect_tournament_delete_started"() IS
  'BEFORE-DELETE-Schutz (B-01b, @LZ-003): ein Turnier mit einem laufenden/pausierten/
   beendeten Spiel kann nicht hart geloescht werden (Policy tournaments_delete_v2
   erlaubt dem Eigentuemer DELETE -- ohne diesen Trigger waere die Sperre umgehbar).
   RAISE tournament_started: ... mit ERRCODE P0001 wie bei protect_deleted_at().
   Ereignisse allein sperren hier bewusst NICHT: der Kaskaden-Fall
   scripts/protect-matches-with-events-check.sh Fall 5 (Gesamtloeschen eines Turniers
   mit geplanten Spielen UND Ereignissen) muss erlaubt bleiben, siehe Kopfkommentar.';

CREATE OR REPLACE TRIGGER "tournaments_protect_delete_started"
  BEFORE DELETE ON "public"."tournaments"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_tournament_delete_started"();