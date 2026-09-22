-- Rollenbasierte Schreibrechte: die Datenbank auf eine Rollentabelle bringen.
--
-- Vorgeschichte: Die Oberfläche (src/features/auth/utils/permissions.ts) und die
-- Datenbank (RLS-Policies der Baseline, 00000000000000_baseline_live_schema.sql)
-- widersprachen sich an drei Stellen. Heute traf das niemanden — tournament_collaborators
-- ist in der Produktion leer — trifft aber genau das Turniertags-Szenario "Helfer am
-- zweiten Gerät". Die Rollentabelle (src/features/auth/__tests__/roleMatrix.json, die
-- EINE Quelle für diesen Task und den Vitest-Folgetask):
--
--   Rolle          | Spieldaten schreiben | Ereignisse korrigieren/löschen | Turniereinstellungen
--   owner          | ja                    | ja                              | ja
--   co-admin       | ja                    | ja                              | ja
--   collaborator   | ja                    | ja                              | nein
--   trainer        | nein                  | nein                            | nein
--   viewer         | nein                  | nein                            | nein
--   Nicht-Mitglied | nein                  | nein                            | nein
--
-- Was vorher galt (Baseline):
--   1. matches_update_v3 / match_events_insert_v3: JEDER akzeptierte Mitarbeiter durfte
--      schreiben, unabhängig von seiner Rolle — ein viewer konnte einen Spielstand ändern
--      oder ein Ereignis anlegen. Die Policies prüften nur "tc.accepted_at IS NOT NULL",
--      keine Rolle.
--   2. match_events_update_v2 / match_events_delete_v2: NUR der Eigentümer (owner_id =
--      auth.uid()). Ein Helfer (co-admin/collaborator), der laut UI ein Ereignis korrigieren
--      oder löschen darf, scheiterte an der Datenbank — der Fehlschlag landete still in der
--      Dead-Letter-Queue (MutationQueue), ohne dass die UI das dem Nutzer meldete.
--   3. tournaments_update_v3: prüfte "tc.role = 'admin'". Diese Rolle existiert laut
--      tournament_collaborators_role_check gar nicht (erlaubt sind nur owner, co-admin,
--      trainer, collaborator, viewer) — die Bedingung traf nie zu. Ein co-admin konnte
--      Turniereinstellungen nie über diesen Pfad ändern.
--
-- Was jetzt gilt: Alle vier Policies bekommen denselben Rollenfilter
-- "tc.role IN ('co-admin', 'collaborator')" für Spieldaten/Ereigniskorrektur bzw.
-- "tc.role = 'co-admin'" für Turniereinstellungen — zusätzlich zur (unveränderten)
-- Eigentümerprüfung "owner_id = auth.uid()", die für angemeldete UND anonym angemeldete
-- Eigentümer gleichermaßen gilt (Policies laufen TO authenticated, anon; signInAnonymously()
-- erzeugt einen echten auth.users-Eintrag, owner_id = auth.uid() unterscheidet nicht
-- zwischen anonym und regulär angemeldet — siehe roleMatrix.json, Zeile
-- "owner-anonymous").
--
-- trainer bekommt bewusst KEINE direkten Schreibrechte, obwohl permissions.ts (UI) das
-- heute für eigene Teams erlaubt (canEditResults). Daniel: "Ein Trainer soll perspektivisch
-- ein Spiel seines Teams eintragen dürfen. Dieser Eintrag ist aber ein Vorschlag und kann
-- von der Turnierleitung übernommen werden. Der Wert der Turnierleitung hat immer Vorrang."
-- Ein künftiger Vorschlagsweg läuft über einen GETRENNTEN Mechanismus (z.B. eine eigene
-- Tabelle / einen eigenen Status), nicht über direkte Schreibrechte auf matches/match_events
-- — die müssten sonst später wieder entzogen werden. Das UI-Redesign für Trainer-Vorschläge
-- ist NICHT Teil dieser Migration.
--
-- match_corrections wurde geprüft: Kein Pfad in src/core/* oder src/features/* schreibt
-- diese Tabelle (nur src/types/supabase.ts referenziert sie als generierten Typ). Sie ist
-- aktuell toter Code im Spielbetrieb und bleibt deshalb unverändert (weiterhin nur
-- Eigentümer) — nicht Teil der erhobenen Schreibpfade
-- (MatchExecutionService → OfflineRepository → MutationQueue → SupabaseRepository /
-- SupabaseLiveMatchRepository), die ausschließlich matches, match_events und tournaments
-- beschreiben.
--
-- Lese-Policies (SELECT) werden NICHT angefasst — nur INSERT/UPDATE/DELETE. Der Beweis
-- (scripts/rls-role-matrix.sh) prüft trotzdem stichprobenartig, dass anonymes Lesen eines
-- öffentlichen Turniers (is_public = true) weiter funktioniert.
--
-- Alte Policies werden ERSETZT (DROP POLICY IF EXISTS + CREATE POLICY unter demselben
-- Namen), nicht danebengestellt: Mehrere Policies derselben FOR-Klausel auf derselben
-- Tabelle werden von Postgres per ODER verknüpft — eine zusätzliche, großzügigere Policy
-- würde also weiter greifen und den Rollenfilter wirkungslos machen.


-- ============================================================================
-- matches: UPDATE — Rollenfilter ergänzt
-- ============================================================================

DROP POLICY IF EXISTS "matches_update_v3" ON "public"."matches";

CREATE POLICY "matches_update_v3" ON "public"."matches"
  FOR UPDATE TO "authenticated", "anon"
  USING (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR (EXISTS (
      SELECT 1
      FROM "public"."tournament_collaborators" "tc"
      WHERE "tc"."tournament_id" = "matches"."tournament_id"
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
      WHERE "tc"."tournament_id" = "matches"."tournament_id"
        AND "tc"."user_id" = ( SELECT "auth"."uid"() )
        AND "tc"."accepted_at" IS NOT NULL
        AND "tc"."role" IN ('co-admin', 'collaborator')
    ))
  );


-- ============================================================================
-- match_events: INSERT — derselbe Rollenfilter
-- ============================================================================

DROP POLICY IF EXISTS "match_events_insert_v3" ON "public"."match_events";

CREATE POLICY "match_events_insert_v3" ON "public"."match_events"
  FOR INSERT TO "authenticated", "anon"
  WITH CHECK (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR (EXISTS (
      SELECT 1
      FROM "public"."matches" "m"
      JOIN "public"."tournament_collaborators" "tc" ON "tc"."tournament_id" = "m"."tournament_id"
      WHERE "m"."id" = "match_events"."match_id"
        AND "tc"."user_id" = ( SELECT "auth"."uid"() )
        AND "tc"."accepted_at" IS NOT NULL
        AND "tc"."role" IN ('co-admin', 'collaborator')
    ))
  );


-- ============================================================================
-- match_events: UPDATE — von "nur Eigentümer" auf Eigentümer ODER co-admin/collaborator.
-- Repariert das stille Scheitern beim Korrigieren/Löschen (Soft-Delete läuft über
-- UPDATE is_deleted) durch Helfer.
-- ============================================================================

DROP POLICY IF EXISTS "match_events_update_v2" ON "public"."match_events";

CREATE POLICY "match_events_update_v2" ON "public"."match_events"
  FOR UPDATE TO "authenticated", "anon"
  USING (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR (EXISTS (
      SELECT 1
      FROM "public"."matches" "m"
      JOIN "public"."tournament_collaborators" "tc" ON "tc"."tournament_id" = "m"."tournament_id"
      WHERE "m"."id" = "match_events"."match_id"
        AND "tc"."user_id" = ( SELECT "auth"."uid"() )
        AND "tc"."accepted_at" IS NOT NULL
        AND "tc"."role" IN ('co-admin', 'collaborator')
    ))
  )
  WITH CHECK (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR (EXISTS (
      SELECT 1
      FROM "public"."matches" "m"
      JOIN "public"."tournament_collaborators" "tc" ON "tc"."tournament_id" = "m"."tournament_id"
      WHERE "m"."id" = "match_events"."match_id"
        AND "tc"."user_id" = ( SELECT "auth"."uid"() )
        AND "tc"."accepted_at" IS NOT NULL
        AND "tc"."role" IN ('co-admin', 'collaborator')
    ))
  );


-- ============================================================================
-- match_events: DELETE — dieselbe Menge wie UPDATE
-- ============================================================================

DROP POLICY IF EXISTS "match_events_delete_v2" ON "public"."match_events";

CREATE POLICY "match_events_delete_v2" ON "public"."match_events"
  FOR DELETE TO "authenticated", "anon"
  USING (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR (EXISTS (
      SELECT 1
      FROM "public"."matches" "m"
      JOIN "public"."tournament_collaborators" "tc" ON "tc"."tournament_id" = "m"."tournament_id"
      WHERE "m"."id" = "match_events"."match_id"
        AND "tc"."user_id" = ( SELECT "auth"."uid"() )
        AND "tc"."accepted_at" IS NOT NULL
        AND "tc"."role" IN ('co-admin', 'collaborator')
    ))
  );


-- ============================================================================
-- tournaments: UPDATE — tote Bedingung role = 'admin' durch role = 'co-admin' ersetzt
-- ============================================================================

DROP POLICY IF EXISTS "tournaments_update_v3" ON "public"."tournaments";

CREATE POLICY "tournaments_update_v3" ON "public"."tournaments"
  FOR UPDATE TO "authenticated", "anon"
  USING (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR (EXISTS (
      SELECT 1
      FROM "public"."tournament_collaborators" "tc"
      WHERE "tc"."tournament_id" = "tournaments"."id"
        AND "tc"."user_id" = ( SELECT "auth"."uid"() )
        AND "tc"."role" = 'co-admin'
        AND "tc"."accepted_at" IS NOT NULL
    ))
  )
  WITH CHECK (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR (EXISTS (
      SELECT 1
      FROM "public"."tournament_collaborators" "tc"
      WHERE "tc"."tournament_id" = "tournaments"."id"
        AND "tc"."user_id" = ( SELECT "auth"."uid"() )
        AND "tc"."role" = 'co-admin'
        AND "tc"."accepted_at" IS NOT NULL
    ))
  );
