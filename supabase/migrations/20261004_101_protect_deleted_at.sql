-- ============================================================================
-- 20261004_101_protect_deleted_at.sql
-- B-01 Paket b (Spur B, Nummernkreis _1xx): Server-Sperre
-- "Turnier nach dem ersten Anpfiff nicht loeschbar" (@LZ-003).
--
-- Paket a (Client) bietet "Turnier loeschen" nach dem ersten Anpfiff nicht mehr
-- an (DangerZone, getMatchStartState). Diese Migration erzwingt dieselbe Regel
-- auf dem Server -- zwei Loesch-Pfade plus eine Beleg-Sperre:
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
--      BEFORE-DELETE-Trigger protect_tournament_delete_started() mit demselben
--      Kriterium tournament_has_started() (Status ODER Ereignisse) und
--      derselben Sperre-Meldung. Ruling (Fixrunde 1, vorher ABWEICHUNG zum
--      Soft-Delete-Pfad bewusst): Hard- und Soft-Loeschung verwenden denselben
--      Anpfiff-Begriff -- die Anforderung hat sich geaendert (@LZ-003 und
--      @SL-129: Ereignisse belegen den Anpfiff und bleiben auch beim
--      Zuruecksetzen des Spielstatus erhalten). Der A6-Nachweis "Spiel mit
--      Ereignissen wird nie still geloescht" bleibt davon unberuehrt: die
--      Gesamtloeschung per Kaskade bleibt fuer Wartungsrollen erlaubt
--      (Prueffall (i) in scripts/protect-deleted-at-check.sh, Fall 5' in
--      scripts/protect-matches-with-events-check.sh -- dort als postgres).
--   3. Beleg-Sperre: BEFORE DELETE auf match_events ueber
--      protect_match_events_delete(). Client-Rollen duerfen Ereignis-Zeilen
--      nicht direkt loeschen -- auch keine Alt-Zeilen ohne event_format. Ohne
--      diese Sperre koennte der Anpfiff-Beleg (@SL-129) vor dem Turnier-
--      Loeschen entfernt werden und beide Pfade oben umgehen. Muster wie
--      Guard (d) der match_events_guard_engine_rows (20260928_001):
--      current_user IN ('authenticated', 'anon') AND pg_trigger_depth() <= 1
--      -> RAISE ... USING ERRCODE = 'insufficient_privilege'. Die Kaskade
--      (Tiefe > 1) bleibt erlaubt.
--
-- Rollentrennung (Review-Fund E3): alle drei Sperren greifen NUR fuer
-- Client-Rollen (current_user IN ('authenticated', 'anon')). Wartungsrollen
-- bleiben frei: service_role (Neu-Seed -- scripts/e2e-seed.ts loescht
-- bestehende Turniere), postgres (Wartung, Kaskaden-Nachweis) und die
-- FK-Kaskade aus auth.users (Konto-Loeschung ueber deleteUser/merge-accounts).
-- Ohne diese Ausnahme brechen genau diese Werkzeuge -- auch schon im Stand vor
-- dieser Migration, sobald das Status-Kriterium greift.
--
-- Rechte an tournament_has_started(): REVOKE EXECUTE FROM PUBLIC, anon;
-- GRANT EXECUTE TO authenticated. Die Funktion ist SECURITY DEFINER (Zaehlung
-- unabhaengig von der Lese-Policy des Aufrufers), wird aber von
-- protect_deleted_at() als INVOKER aufgerufen -- ohne GRANT fuer authenticated
-- wuerde jedes Soft-Delete mit "permission denied" scheitern. Als RPC bleibt
-- sie fuer anon/oeffentlich gesperrt.
--
-- Die bestehende Rechtepruefung in protect_deleted_at() bleibt UNVERAENDERT
-- (deleteTournament -- heute nur der Eigentuemer, siehe Kommentar in
-- supabase/migrations/20260924_002_central_role_permissions.sql Abschnitt 8).
--
-- Gegenprobe: scripts/protect-deleted-at-check.sh (Faelle a-g, f2-f5, h, h2,
-- i, k, l -- Exit != 0 bei jeder Abweichung) und
-- scripts/protect-matches-with-events-check.sh (Faelle 1-5, 5'). Ohne diese
-- Migration sind die Faelle (b)-(f), (f2)-(f4), (h) und (h2) rot.
--
-- IDEMPOTENZ: ausschliesslich CREATE OR REPLACE (Funktionen und Trigger),
-- REVOKE/GRANT sind beliebig oft wiederholbar, keine bedingte Logik ueber
-- Bestandszeilen, keine Abhaengigkeit von Zwischenstaenden -- der Lauf kann
-- beliebig oft wiederholt werden.
--
-- Bestandsdaten: keine Zeilenänderung, nur neue Sperre
--   Zaehlung nicht durchgefuehrt, Controller holt sie nach (Prognose gegen
--   Prod gemeinsam mit Daniel): Keine Zeile wird geaendert, kein
--   Backfill, keine Constraint-Nachpruefung. Die Sperre wirkt nur auf
--   ZUKUENFTIGE Aenderungen (NULL -> deleted_at, hartes DELETE, Direkt-
--   Loeschung von match_events). Bestehende Papierkorb-Zeilen (deleted_at
--   bereits gesetzt) bleiben unangetastet -- Wiederherstellen (deleted_at ->
--   NULL) bleibt ausdruecklich erlaubt (Prueffall (g)), ebenso das
--   Veraendern eines Turniers ohne deleted_at-Wechsel (die App schickt
--   deleted_at bei jedem save() mit unveraendertem Wert mit, siehe Kommentar
--   in 20260924_002 Abschnitt 8).
--   Hinweis am Rande: ein Turnier, das VOR dieser Migration bereits in den
--   Papierkorb gelangt ist, OBWOHL es angepfiffen war, kann weiterhin per
--   Wiederherstellen zurueckgeholt werden (Prueffall (g)) und danach nur noch
--   gemaess der neuen Regel behandelt werden; die Aufraeum-Funktion des
--   Papierkorbs loescht es hart nur weiterhin, solange das Turnier nicht als
--   angepfiffen gilt (gemeinsamer Kern tournament_has_started()).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. tournament_has_started() -- ist das Turnier "angepfiffen"?
--    true bei einem Spiel mit Status laufend/pausiert/beendet ODER irgendeinem
--    match_events-Eintrag eines Spiels dieses Turniers (is_deleted-Ereignisse
--    zaehlen mit -- sie bleiben im Verlauf, @SL-129, und belegen den Anpfiff).
--    SECURITY DEFINER + fester search_path wie has_tournament_permission():
--    die Zaehlung darf nicht an der Lese-Policy des Aufrufers haengen.
--    Rechte siehe REVOKE/GRANT nach der Definition.
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
   loeschbar" (@LZ-003) fuer Soft- und Hard-Loeschung.';

-- Rechte (Review-Fund VR5): EXECUTE nicht fuer PUBLIC/anon -- die Funktion waere
-- sonst als RPC aufrufbar (SECURITY DEFINER). authenticated behaelt EXECUTE:
-- protect_deleted_at() laeuft als INVOKER und ruft die Funktion als
-- authenticated auf, sonst scheitert jedes Soft-Delete mit "permission denied".
-- Wartungsrollen erreichen die Funktion ueber die Trigger gar nicht erst
-- (current_user-Waechter, siehe Abschnitte 2-4).
REVOKE EXECUTE ON FUNCTION "public"."tournament_has_started"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."tournament_has_started"("uuid") TO "authenticated";


-- ----------------------------------------------------------------------------
-- 2. protect_deleted_at() -- Soft-Delete-Sperre (BEFORE UPDATE)
--    Block 1 (UNVERAENDERT aus 20260924_002 Abschnitt 8): deleted_at nur mit
--    dem Recht deleteTournament.
--    Block 2 (NEU): NULL -> Wert bei angepfiffenem Turnier -> RAISE
--    'tournament_started: ...' (ERRCODE P0001).
--    Beide Bloecke nur fuer Client-Rollen (current_user-Waechter, E3).
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
  IF current_user IN ('authenticated', 'anon')
     AND NEW.deleted_at IS NOT NULL
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
   (current_user-Muster wie protect_owner_id/protect_parent_keys). N5 (R5-Review):
   has_tournament_permission() liefert IMMER true/false, nie NULL (EXISTS-basiert) --
   ein Aufrufer ohne auth.uid() (kein sub-Claim) erfuellt "NOT has_tournament_
   permission(...)" deshalb zuverlaessig, anders als der fruehere rohe "OLD.owner_id
   <> auth.uid()"-Vergleich, der bei auth.uid() IS NULL zu NULL auswertete und damit
   kein RAISE ausloeste.
   (2) NEU (B-01b, @LZ-003): Wechselt deleted_at von NULL auf einen Wert und gilt das
   Turnier als angepfiffen (tournament_has_started -- Status ODER Ereignisse), dann
   RAISE EXCEPTION tournament_started: ... mit ERRCODE P0001 -- nach dem ersten
   Anpfiff ist kein Loeschen (Soft-Delete) moeglich. Wiederherstellen (NULL setzen)
   bleibt erlaubt. Beide Bloecke greifen nur fuer Client-Rollen
   (current_user IN authenticated/anon, E3): Wartungsrollen (service_role beim
   Neu-Seed, Kaskade aus auth.users bei der Konto-Loeschung, postgres) bleiben frei.
   Gegenprobe: scripts/protect-deleted-at-check.sh.';


-- ----------------------------------------------------------------------------
-- 3. protect_tournament_delete_started() -- hartes DELETE (BEFORE DELETE)
--    Policy tournaments_delete_v2 (Baseline) erlaubt dem Eigentuemer DELETE --
--    ohne diesen Trigger waere die Sperre per direktem DELETE FROM tournaments
--    (z. B. DELETE_TOURNAMENT aus der Mutations-Queue) umgehbar.
--    Sperre-Meldung wie oben ('tournament_started: ...', ERRCODE P0001).
--    Kriterium wie auf dem Soft-Delete-Pfad: tournament_has_started(OLD.id)
--    (Status ODER Ereignisse) -- Ruling Fixrunde 1, die Anforderung hat sich
--    geaendert (@LZ-003 und @SL-129, Ereignisse belegen den Anpfiff).
--    Wartungsrollen-Ausnahme (E3) siehe Kopfkommentar.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."protect_tournament_delete_started"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND "public"."tournament_has_started"(OLD.id)
  THEN
    RAISE EXCEPTION 'tournament_started: Turnier kann nach dem ersten Anpfiff nicht geloescht werden.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION "public"."protect_tournament_delete_started"() IS
  'BEFORE-DELETE-Schutz (B-01b, @LZ-003): ein angepfiffenes Turnier kann nicht hart
   geloescht werden (Policy tournaments_delete_v2 erlaubt dem Eigentuemer DELETE --
   ohne diesen Trigger waere die Sperre umgehbar). RAISE tournament_started: ... mit
   ERRCODE P0001 wie bei protect_deleted_at(). Kriterium wie dort: Status
   running/paused/finished ODER irgendein match_events-Eintrag
   (tournament_has_started) -- Ruling Fixrunde 1, die Anforderung hat sich geaendert
   (@LZ-003, @SL-129: Ereignisse belegen den Anpfiff, auch nach einem Status-Reset).
   NUR fuer Client-Rollen (current_user IN authenticated/anon, Review-Fund E3):
   service_role (Neu-Seed), postgres (Wartung, Kaskaden-Nachweis Fall 5'/Prueffall
   (i)) und die FK-Kaskade aus auth.users (Konto-Loeschung) bleiben frei.';

CREATE OR REPLACE TRIGGER "tournaments_protect_delete_started"
  BEFORE DELETE ON "public"."tournaments"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_tournament_delete_started"();


-- ----------------------------------------------------------------------------
-- 4. protect_match_events_delete() -- Beleg-Sperre auf match_events
--    (BEFORE DELETE, NEU in Fixrunde 1, Review-Fund E2/VR2)
--    Ereignis-Zeilen sind der dauerhafte Beleg fuer den Anpfiff (@SL-129) --
--    wer sie direkt loescht, koennte danach das Turnier (Soft- oder hart)
--    loeschen, obwohl es angepfiffen war. Client-Rollen duerfen deshalb keine
--    match_events-Zeile direkt loeschen (auch keine Alt-Zeilen ohne
--    event_format -- Guard (d) der match_events_guard_engine_rows schuetzt nur
--    die Engine-Zeilen). Muster wie Guard (d):
--      current_user IN ('authenticated', 'anon') AND pg_trigger_depth() <= 1
--      -> RAISE ... USING ERRCODE = 'insufficient_privilege'.
--    Die Kaskade beim Turnier-Loeschen bleibt erlaubt (pg_trigger_depth() > 1)
--    -- Prueffall (i) bzw. Fall 5' in scripts/protect-matches-with-events-check.sh.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."protect_match_events_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND pg_trigger_depth() <= 1
  THEN
    RAISE EXCEPTION 'Nicht erlaubt: Ereignis-Zeilen koennen nicht direkt geloescht werden -- sie belegen den Anpfiff (@SL-129).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION "public"."protect_match_events_delete"() IS
  'BEFORE-DELETE-Schutz auf match_events (B-01b, Review-Fund E2/VR2, stuetzt sich auf
   @SL-129): Ereignis-Zeilen belegen den Anpfiff und bleiben auch beim
   Status-Zuruecksetzen erhalten. Client-Rollen (authenticated/anon) duerfen sie
   deshalb nicht direkt loeschen (pg_trigger_depth() <= 1) -- auch keine Alt-Zeilen
   ohne event_format. RAISE ... USING ERRCODE = 'insufficient_privilege' wie Guard (d)
   der match_events_guard_engine_rows (20260928_001). Kaskade (Tiefe > 1) und
   Wartungsrollen bleiben erlaubt (E3) -- die Gesamtloeschung eines Turniers per
   Kaskade ist der einzige zugelassene Weg, eine Ereignis-Zeile zu entfernen.';

CREATE OR REPLACE TRIGGER "match_events_protect_delete"
  BEFORE DELETE ON "public"."match_events"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_match_events_delete"();
