-- R5 (task-R5-brief.md): Co-Admin vollständig, Teams nach Rolle, Löschen und
-- Mitgliederverwaltung nur für den Eigentümer.
--
-- Vier DB-Befunde aus dem Abschluss-Review (final-review.md, Abschnitte H4/M3/M4/M5) in einer
-- Migration. M6 (Mitgliederverwaltung: UI erlaubt Co-Admin, DB nur Eigentümer) ist reine
-- UI-Arbeit (src/features/auth/utils/permissions.ts + zwei Oberflächen) und Teil desselben
-- Tasks, aber nicht dieser SQL-Datei — siehe Report.
--
-- ============================================================================================
-- H4 — Co-Admin-Speichern scheitert halb: tournaments geschrieben, teams/matches nicht
-- ============================================================================================
--
-- SupabaseRepository.save() (Zeilen 199-315) schreibt zuerst "tournaments" (klappt seit
-- 20260922_001 für Co-Admins), danach upsert(teams) / upsert(matches) — "INSERT ... ON CONFLICT
-- (id) DO UPDATE". Postgres prüft dabei das INSERT-WITH-CHECK AUCH für bestehende Zeilen (nicht
-- nur das UPDATE-WITH-CHECK) — und teams_insert_v2 / matches_insert_v2 (Baseline) verlangen
-- ausschließlich "tournaments.owner_id = auth.uid()". Ein Co-Admin scheitert dort, obwohl die
-- Rollentabelle "Turniereinstellungen + Teams: ja" für ihn sagt — ein Teilzustand bleibt zurück
-- (tournaments-Version steigt, teams/matches nicht), die Warteschlange wiederholt den Vorgang
-- und trifft danach auf einen OptimisticLockError, dann die Dead-Letter-Queue.
--
-- Fix: Beide INSERT-Policies bekommen einen zusätzlichen Co-Admin-Zweig, im Stil der bereits
-- rollengefilterten Policies aus 20260922_001 (EXISTS gegen tournament_collaborators, role =
-- 'co-admin', accepted_at IS NOT NULL). NUR co-admin, nicht collaborator: Eine neue Zeile
-- anzulegen (Team/Spiel im Spielplan) gehört zur Rollentabellen-Spalte "Turniereinstellungen +
-- Teams", die laut task-R5-brief.md nur co-admin (und der Eigentümer) hat — die separate
-- Teams-UPDATE-Ausnahme für collaborator (M3 unten) betrifft ausdrücklich nur BESTEHENDE
-- Zeilen, nicht das Anlegen neuer. Alte Policies werden ERSETZT (DROP POLICY IF EXISTS + CREATE
-- POLICY unter demselben Namen), nicht danebengestellt — dieselbe Begründung wie in
-- 20260922_001: mehrere Policies derselben FOR-Klausel auf derselben Tabelle werden von
-- Postgres per ODER verknüpft, eine zusätzliche Policy würde also nur additiv wirken.
--
-- Geprüft (Auftrag verlangt das, bevor der Co-Admin-Zweig geöffnet wird):
--   - teams_sync_owner / matches_sync_owner (Baseline, BEFORE INSERT) leiten NEW.owner_id aus
--     tournaments.owner_id ab — der neue INSERT-Zweig öffnet also KEINEN Weg, eine Zeile mit
--     einem vom Turnier-Eigentümer abweichenden owner_id anzulegen; der Client kann owner_id im
--     INSERT-Payload mitschicken, der Trigger überschreibt ihn ohnehin (belegt unten mit der
--     Harness-Zeile "Co-Admin Upsert neues Team", die owner_id NACH dem Insert liest).
--   - protect_owner_id (BEFORE UPDATE, 20260922_003) und protect_parent_keys (BEFORE UPDATE,
--     20260923_001) laufen NUR bei UPDATE, nicht bei INSERT — sie greifen beim Upsert-INSERT-Zweig
--     also gar nicht ein und stehen dem hier nicht im Weg. Der Upsert-UPDATE-Zweig (Zeile
--     existiert schon) läuft unverändert durch die bereits rollengefilterten
--     matches_update_v3 / teams_update_v3 (M3 unten).
--
-- ============================================================================================
-- M3 — DB lässt jedes Mitglied Teams ändern, auch viewer und trainer
-- ============================================================================================
--
-- teams_update_v3 (Baseline) hat keinen Rollenfilter — jeder akzeptierte Mitarbeiter (auch
-- viewer, trainer) darf ein Team umbenennen. Die Rollentabelle sagt: nur owner/co-admin/
-- collaborator (Teams-UPDATE-Ausnahme). Fix: derselbe Rollenfilter wie bei matches_update_v3
-- (20260922_001) — "tc.role IN ('co-admin', 'collaborator')". Collaborator bleibt bewusst
-- zugelassen: SupabaseRepository.save() schreibt Teams bei JEDEM Speichern mit (auch wenn nur
-- ein Ergebnis eingetragen wird) — ein Collaborator, der laut Rollentabelle "Spieldaten: ja" hat,
-- darf dabei nicht an einem Nebeneffekt (Teams-Upsert bestehender Zeilen) scheitern. Viewer und
-- Trainer verlieren den Zugriff, den sie laut Tabelle nie haben sollten.
--
-- ============================================================================================
-- M4 — Co-Admin veröffentlicht, Sponsoren und Monitore folgen nicht
-- ============================================================================================
--
-- cascade_tournament_visibility() (Baseline, AFTER UPDATE auf tournaments) ist NICHT SECURITY
-- DEFINER und läuft deshalb mit dem RLS des AUFRUFERS. Seit 20260922_001 darf ein Co-Admin
-- tournaments.is_public setzen; sponsors_update_v2 / monitors_update_v2 / match_corrections
-- (Baseline, unverändert) erlauben nur dem Eigentümer zu schreiben — die Kaskade bleibt für
-- diese drei Tabellen bei 0 Zeilen, während teams/matches/match_events (deren *_update_v3-
-- Policies seit 20260922_001 den Co-Admin zulassen) korrekt mitziehen.
--
-- Vorher geprüft (Auftrag verlangt das, bevor SECURITY DEFINER gesetzt wird): Die Funktion
-- ändert AUSSCHLIESSLICH Kinder von NEW.id — jede der sechs UPDATE-Anweisungen filtert entweder
-- "tournament_id = NEW.id" direkt (teams, matches, sponsors, monitors) oder "match_id IN
-- (SELECT id FROM matches WHERE tournament_id = NEW.id)" (match_events, match_corrections,
-- also wieder nur Kinder von NEW.id, über matches vermittelt) — und AUSSCHLIESSLICH die Spalte
-- is_public ("SET is_public = NEW.is_public" in jeder der sechs Anweisungen, sonst nichts).
-- Kein Zugriff auf eine andere Tabelle, keine andere Spalte, kein dynamisches SQL. SECURITY
-- DEFINER ist hier sicher.
--
-- Fix: SECURITY DEFINER ergänzt (SET search_path war schon vorher gesetzt) — die Kaskade läuft
-- jetzt mit den Rechten des Funktionseigentümers (der Migrations-/Owner-Rolle), nicht mit denen
-- des aufrufenden Co-Admins.
--
-- ============================================================================================
-- M5 — Co-Admin kann per tournaments.deleted_at weich löschen; UI erlaubt es nur dem Eigentümer
-- ============================================================================================
--
-- tournaments_update_v3 (20260922_001) lässt Co-Admins ALLE Spalten schreiben, auch deleted_at
-- (SupabaseRepository.softDelete()/restore(), Zeilen 458-479, setzen es per direktem UPDATE).
-- canDeleteTournament (permissions.ts) erlaubt nur "owner" — die DB kennt diese Grenze bisher
-- nicht.
--
-- Vorher geprüft (Auftrag verlangt das): mapTournamentToSupabase (supabaseMappers.ts:633)
-- schreibt "deleted_at: tournament.deletedAt ?? null" bei JEDEM save() ungefragt mit — auch wenn
-- der Wert sich nicht ändert (ein Co-Admin, der ein laufendes Spiel beendet, schickt dabei den
-- zuletzt geladenen deleted_at-Wert unverändert zurück). Ein Trigger, der JEDE Abweichung von
-- OLD.deleted_at ablehnt, würde deshalb nicht nur den Löschversuch blockieren, sondern JEDES
-- normale Co-Admin-Speichern brechen, sobald deleted_at im Payload steht (immer).
--
-- Fix: BEFORE-UPDATE-Trigger protect_deleted_at() — RAISE nur wenn sich deleted_at TATSÄCHLICH
-- ändert (IS DISTINCT FROM) UND der Aufrufer NICHT der Eigentümer ist (OLD.owner_id <>
-- auth.uid() — OLD, nicht NEW: protect_owner_id hält owner_id ohnehin fest, aber die
-- Trigger-Reihenfolge auf derselben Tabelle darf hier keine Rolle spielen) UND current_user IN
-- ('authenticated', 'anon') gilt (dasselbe current_user-Muster wie protect_owner_id /
-- protect_parent_keys — SECURITY-DEFINER-Aufrufe bleiben ausgenommen). Anders als bei
-- protect_owner_id (K1, 003: alten Wert BEIBEHALTEN, damit legitime Upserts gelingen) wird hier
-- RAISE verwendet: ein Nicht-Eigentümer, der deleted_at TATSÄCHLICH ändern will, hat keinen
-- legitimen App-Pfad (softDelete()/restore() sind laut UI nur über canDeleteTournament, also nur
-- dem Eigentümer, erreichbar) — ein stilles Beibehalten würde das Löschen scheinbar erfolgreich
-- aussehen lassen, obwohl nichts passiert ist. Gleicher Wert gilt als KEINE Änderung und deckt
-- den Normalfall — belegt durch die Harness-Zeile "Co-Admin speichert Turnier mit unverändertem
-- deleted_at", erwartet erlaubt.
--
-- ============================================================================================


-- ============================================================================
-- H4: teams_insert_v2 — Co-Admin-Zweig ergänzt
-- ============================================================================

DROP POLICY IF EXISTS "teams_insert_v2" ON "public"."teams";

CREATE POLICY "teams_insert_v2" ON "public"."teams"
  FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1
      FROM "public"."tournaments"
      WHERE "tournaments"."id" = "teams"."tournament_id"
        AND "tournaments"."owner_id" = ( SELECT "auth"."uid"() )
    ))
    OR (EXISTS (
      SELECT 1
      FROM "public"."tournament_collaborators" "tc"
      WHERE "tc"."tournament_id" = "teams"."tournament_id"
        AND "tc"."user_id" = ( SELECT "auth"."uid"() )
        AND "tc"."accepted_at" IS NOT NULL
        AND "tc"."role" = 'co-admin'
    ))
  );


-- ============================================================================
-- H4: matches_insert_v2 — Co-Admin-Zweig ergänzt (dieselbe Begründung wie oben)
-- ============================================================================

DROP POLICY IF EXISTS "matches_insert_v2" ON "public"."matches";

CREATE POLICY "matches_insert_v2" ON "public"."matches"
  FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1
      FROM "public"."tournaments"
      WHERE "tournaments"."id" = "matches"."tournament_id"
        AND "tournaments"."owner_id" = ( SELECT "auth"."uid"() )
    ))
    OR (EXISTS (
      SELECT 1
      FROM "public"."tournament_collaborators" "tc"
      WHERE "tc"."tournament_id" = "matches"."tournament_id"
        AND "tc"."user_id" = ( SELECT "auth"."uid"() )
        AND "tc"."accepted_at" IS NOT NULL
        AND "tc"."role" = 'co-admin'
    ))
  );


-- ============================================================================
-- M3: teams_update_v3 — Rollenfilter ergänzt (Muster: matches_update_v3, 20260922_001)
-- ============================================================================

DROP POLICY IF EXISTS "teams_update_v3" ON "public"."teams";

CREATE POLICY "teams_update_v3" ON "public"."teams"
  FOR UPDATE TO "authenticated", "anon"
  USING (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR (EXISTS (
      SELECT 1
      FROM "public"."tournament_collaborators" "tc"
      WHERE "tc"."tournament_id" = "teams"."tournament_id"
        AND "tc"."user_id" = ( SELECT "auth"."uid"() )
        AND "tc"."accepted_at" IS NOT NULL
        AND "tc"."role" IN ('co-admin', 'collaborator')
    ))
  )
  WITH CHECK (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR (EXISTS (
      SELECT 1
      FROM "public"."tournament_collaborators" "tc"
      WHERE "tc"."tournament_id" = "teams"."tournament_id"
        AND "tc"."user_id" = ( SELECT "auth"."uid"() )
        AND "tc"."accepted_at" IS NOT NULL
        AND "tc"."role" IN ('co-admin', 'collaborator')
    ))
  );


-- ============================================================================
-- M4: cascade_tournament_visibility() — SECURITY DEFINER
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."cascade_tournament_visibility"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.is_public IS DISTINCT FROM NEW.is_public THEN
    UPDATE teams SET is_public = NEW.is_public WHERE tournament_id = NEW.id;
    UPDATE matches SET is_public = NEW.is_public WHERE tournament_id = NEW.id;
    UPDATE sponsors SET is_public = NEW.is_public WHERE tournament_id = NEW.id;
    UPDATE monitors SET is_public = NEW.is_public WHERE tournament_id = NEW.id;

    UPDATE match_events SET is_public = NEW.is_public
    WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = NEW.id);

    UPDATE match_corrections SET is_public = NEW.is_public
    WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."cascade_tournament_visibility"() IS
  'AFTER-UPDATE-Kaskade (M4, 20260924_002): SECURITY DEFINER, damit ein Co-Admin, der
   tournaments.is_public setzt, auch sponsors/monitors/match_corrections mitzieht -- diese drei
   Tabellen erlauben nur dem Eigentuemer zu schreiben (sponsors_update_v2/monitors_update_v2,
   Baseline, unveraendert). Aendert ausschliesslich is_public auf Kindern von NEW.id, keine
   andere Spalte, keine andere Tabelle (siehe Kopfkommentar der Migration).';


-- ============================================================================
-- M5: protect_deleted_at() + Trigger auf tournaments
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."protect_deleted_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     AND OLD.owner_id <> ( SELECT "auth"."uid"() )
     AND current_user IN ('authenticated', 'anon')
  THEN
    RAISE EXCEPTION 'Nicht erlaubt: nur der Turnier-Eigentuemer darf deleted_at aendern.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."protect_deleted_at"() IS
  'BEFORE-UPDATE-Schutz (M5, 20260924_002): tournaments.deleted_at (Soft-Delete) ist nur fuer
   den Turnier-Eigentuemer aenderbar. RAISE nur bei TATSAECHLICHER Aenderung (IS DISTINCT FROM)
   -- die App schickt deleted_at bei jedem save() ungefragt mit demselben Wert mit
   (supabaseMappers.ts:633), ein unveraendertes Speichern durch einen Co-Admin darf deshalb nicht
   scheitern. SECURITY-DEFINER-Aufrufe sind ausgenommen (current_user-Muster wie
   protect_owner_id/protect_parent_keys, 20260922_003/20260923_001).';

CREATE OR REPLACE TRIGGER "tournaments_protect_deleted_at"
  BEFORE UPDATE ON "public"."tournaments"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_deleted_at"();
