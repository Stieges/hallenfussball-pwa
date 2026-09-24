-- R5b (task-R5b-brief.md): Rechte an EINER Stelle.
--
-- Ersetzt die (nie live gewesene) Migration 20260924_002_coadmin_complete.sql aus R5 vollständig
-- -- diese Datei wurde umbenannt (git mv) und neu geschrieben, keine der beiden Fassungen ist je
-- an der Produktion angewendet worden. R5 hatte vier DB-Befunde (H4/M3/M4/M5) direkt in Policies
-- und Trigger-Bedingungen kodiert -- jede Rollenprüfung war eine eigene, im SQL fest verdrahtete
-- EXISTS-Klausel. Dieselbe Information stand zugleich, unabhängig gepflegt, in
-- src/features/auth/utils/permissions.ts. Zwei Quellen für dieselbe Rechtetabelle, verteilt über
-- neun Policies auf sechs Tabellen. Daniels Ziel, wörtlich: „so bauen, dass wir die Rechte in
-- Zukunft leicht umbauen können" -- dazu die Perspektive, dass „als Turnieradmin vielleicht sogar
-- Rechte vergeben und entziehen" möglich wird.
--
-- Diese Migration bringt beide Quellen auf eine Tabelle (public.role_permissions) plus eine
-- Funktion (public.has_tournament_permission), gespiegelt in GENAU einer JSON
-- (src/features/auth/permissions/rolePermissions.json, die App-seitige Laufzeit-Quelle von
-- permissions.ts#hasPermission()). Ein Recht ändern heißt ab jetzt: eine Zeile in
-- rolePermissions.json UND dieselbe Zeile im INSERT-Block unten -- KEINE Policy wird dafür mehr
-- angefasst. Das erzwingen drei automatisierte Prüfungen, die bei jeder Abweichung rot werden:
--   1. scripts/rls-role-matrix.sh liest role_permissions aus dem Container und vergleicht es
--      gegen rolePermissions.json (Abschnitt "Gleichlauf JSON/DB").
--   2. scripts/db-drift-check.sh vergleicht denselben Tabelleninhalt LIVE (über die nur-lesende
--      Rolle ci_schema_reader) gegen dieselbe JSON.
--   3. src/features/auth/utils/__tests__/permissions.rolePermissions.test.ts prüft jede Zelle von
--      permissions.ts gegen dieselbe JSON.
--
-- ============================================================================================
-- Die Rechteliste (verbindlich, aus task-R5b-brief.md)
-- ============================================================================================
--
--   Recht               | Bedeutung                                            | co-admin | collaborator | trainer | viewer
--   writeMatchData       | matches UPDATE, match_events INSERT                  | ja       | ja           | nein    | nein
--   correctEvents        | match_events UPDATE/DELETE                          | ja       | ja           | nein    | nein
--   tournamentSettings   | tournaments UPDATE (inkl. veröffentlichen)          | ja       | nein         | nein    | nein
--   teams                | bestehende Teams ändern: teams UPDATE               | ja       | ja           | nein    | nein
--   restructure (neu)    | teams/matches INSERT und DELETE (Spielplan umbauen) | ja       | nein         | nein    | nein
--   deleteTournament     | tournaments.deleted_at setzen/zurücksetzen          | nein     | nein         | nein    | nein
--   manageMembers        | tournament_collaborators verwalten                  | nein     | nein         | nein    | nein
--
-- Der Eigentümer hat IMMER alle Rechte -- das steht bewusst NICHT in role_permissions (keine
-- 'owner'-Zeile), sondern ist fest in has_tournament_permission() verankert (über
-- user_owns_tournament(), das für den Eigentümer immer true liefert, unabhängig vom Inhalt der
-- Tabelle). Nicht-Mitglieder haben keine Rechte (keine Zeile in tournament_collaborators -> die
-- EXISTS-Klausel in has_tournament_permission() trifft nie zu).
--
-- 'restructure' ist das einzige NEUE Recht (vorher implizit Teil eines rollenbasierten INSERT-
-- Zweigs in R5, jetzt eine eigene Spalte, weil INSERT/DELETE fachlich etwas anderes ist als
-- UPDATE bestehender Zeilen -- ein Collaborator darf laut Tabelle 'teams' [UPDATE], aber nicht
-- 'restructure' [INSERT/DELETE]). 'restructure' schließt außerdem R5-H1 (siehe unten): vorher
-- hatten teams_delete_v2/matches_delete_v2 GAR KEINEN Mitarbeiter-Zweig (nur der Eigentümer
-- durfte löschen) -- ein Co-Admin, der beim Speichern Teams/Spiele entfernte, traf dort still
-- 0 Zeilen, während sein INSERT (seit R5/H4) bereits gelang. Ergebnis: verwaiste Zeilen, der
-- Spielplan wurde verdoppelt. 'restructure' gibt Co-Admins jetzt GENAU dieselbe Berechtigung für
-- DELETE wie für INSERT -- symmetrisch, eine Zeile in der Tabelle statt einer Lücke im SQL.
--
-- ============================================================================================
-- Erweiterungspunkt (siehe auch Kommentar an has_tournament_permission() unten)
-- ============================================================================================
--
-- Eine künftige Rechtevergabe PRO TURNIER UND PERSON (Daniels Perspektive: "als Turnieradmin
-- vielleicht sogar Rechte vergeben und entziehen") wird AUSSCHLIESSLICH in
-- has_tournament_permission() ausgewertet -- z.B. eine zusätzliche Tabelle
-- tournament_permission_overrides(tournament_id, user_id, permission, granted), die dort vor
-- oder nach der Rollen-Prüfung befragt wird. NICHT Teil dieser Migration, nur vorbereitet: keine
-- Policy, kein Aufrufer von has_tournament_permission() müsste dafür geändert werden -- der
-- Erweiterungspunkt ist genau diese eine Funktion.
--
-- ============================================================================================
-- R5-H1 (Auflage aus dem R5-Review, task-R5-review.md): Co-Admin-save() mit entfernten
-- Teams/Spielen hinterließ still verwaiste Zeilen
-- ============================================================================================
--
-- SupabaseRepository.save() löscht zuerst Teams/Spiele, die nicht mehr im lokalen Stand stehen
-- (.delete().in('id', …)), danach folgt der Upsert. Vor dieser Migration hatten
-- teams_delete_v2/matches_delete_v2 (Baseline) NUR den Eigentümer-Zweig -- ein Co-Admin traf beim
-- DELETE still 0 Zeilen (kein Fehler), sein Upsert-INSERT neuer Zeilen gelang aber bereits seit
-- R5 (H4). Ergebnis: alte und neue Spiele lagen nebeneinander im Turnier.
-- Fix (DB-Seite, hier): teams_delete_v2/matches_delete_v2 bekommen denselben 'restructure'-Zweig
-- wie die INSERT-Policies -- ein Co-Admin darf jetzt auch löschen, ein Collaborator (kein
-- 'restructure') weiterhin nicht. Fix (App-Seite): SupabaseRepository.save() zählt die
-- tatsächlich gelöschten Zeilen (.select('id')) und wirft bei Abweichung einen Fehler statt still
-- weiterzumachen -- das fängt den Fall ab, in dem ein Aufrufer OHNE 'restructure' (z.B. ein
-- Collaborator, der laut Rollentabelle nie löschen darf) Zeilen entfernen will: DELETE trifft 0
-- Zeilen, der Fehler geht in den bestehenden Retry-/Fehlerpfad der MutationQueue, statt einen
-- unvollständigen Spielplan in der Cloud zu hinterlassen. Siehe
-- src/core/repositories/SupabaseRepository.ts und deren Test.
--
-- ============================================================================================
-- N5 (aus dem R5-Review): protect_deleted_at() war nicht NULL-fest
-- ============================================================================================
--
-- "OLD.owner_id <> (SELECT auth.uid())" ergibt bei auth.uid() IS NULL den Wert NULL, dann gibt es
-- kein RAISE (Postgres: NULL AND x ist NULL, keine der beiden RAISE-Bedingungen "IF"-true).
-- Diese Migration löst das nicht durch eine explizite IS DISTINCT FROM-Umformulierung, sondern
-- STRUKTURELL: protect_deleted_at() prüft jetzt "NOT has_tournament_permission(OLD.id,
-- 'deleteTournament')" statt eines rohen "<>"-Vergleichs. has_tournament_permission() liefert
-- IMMER true/false (nie NULL) -- sowohl user_owns_tournament() als auch die
-- Mitarbeiter-EXISTS-Klausel sind über EXISTS(...) gebaut, das bei auth.uid() IS NULL false
-- liefert (kein Treffer), nicht NULL. Ein Aufrufer ohne sub-Claim ist damit für JEDE Prüfung
-- "kein Eigentümer, kein Mitglied mit dem Recht" -- NOT has_tournament_permission(...) ist dann
-- true, das RAISE greift. Der Seiteneffekt (N5 gelöst) ist ein Beleg dafür, dass die Zentralisierung
-- nicht nur Verwaltungsaufwand spart, sondern eine ganze Klasse von NULL-Lücken strukturell
-- ausschließt, die bei jeder einzeln geschriebenen "<>"-Bedingung erneut auftreten könnte.
--
-- ============================================================================================


-- ============================================================================
-- 1. Tabelle public.role_permissions -- die EINE DB-seitige Quelle
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
  "role" "text" NOT NULL,
  "permission" "text" NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role", "permission"),
  -- Bewusst OHNE 'owner' -- der Eigentümer hat immer alle Rechte, fest in
  -- has_tournament_permission() verankert, siehe Kopfkommentar. Eine 'owner'-Zeile hier wäre
  -- irreführend (sie würde suggerieren, der Eigentümer bräuchte einen Tabelleneintrag).
  CONSTRAINT "role_permissions_role_check" CHECK (
    "role" IN ('co-admin', 'collaborator', 'trainer', 'viewer')
  ),
  CONSTRAINT "role_permissions_permission_check" CHECK (
    "permission" IN (
      'writeMatchData', 'correctEvents', 'tournamentSettings', 'teams',
      'restructure', 'deleteTournament', 'manageMembers'
    )
  )
);

COMMENT ON TABLE "public"."role_permissions" IS
  'Die EINE DB-seitige Rechtetabelle (R5b) -- gespiegelt in
   src/features/auth/permissions/rolePermissions.json (App-Laufzeit-Quelle,
   permissions.ts#hasPermission()). Ein Recht ändern: eine Zeile hier UND dieselbe Zeile in der
   JSON. Keine Policy anfassen -- siehe has_tournament_permission(). Gleichlauf wird erzwungen von
   scripts/rls-role-matrix.sh, scripts/db-drift-check.sh und
   permissions.rolePermissions.test.ts.';

ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;

-- Konfigurationsdaten, kein personenbezogener Bezug -- vollständig für jeden angemeldeten Nutzer
-- lesbar (die App braucht die ganze Tabelle nicht zur Laufzeit, aber ein künftiges "Rechte
-- anzeigen"-UI könnte). anon bekommt NICHTS (unten REVOKE ALL) -- unauthentifizierte Anfragen
-- haben ohnehin nie eine Turnier-Mitgliedschaft, für die diese Tabelle relevant wäre.
CREATE POLICY "role_permissions_select" ON "public"."role_permissions"
  FOR SELECT TO "authenticated"
  USING (true);

-- ci_schema_reader (scripts/db-drift-check.sh, nur-lesende CI-Rolle) braucht als EINZIGE Tabelle
-- echten ZEILENZUGRIFF (nicht nur Schema-Dump ohne Datenzugriff wie bei jeder anderen Tabelle,
-- siehe Kopfkommentar von scripts/db-drift-check.sh: "sie ist weder anon noch authenticated noch
-- Eigentümerin, also greift keine Policy für sie") -- der Drift-Check vergleicht den INHALT von
-- role_permissions live gegen rolePermissions.json (task-R5b-brief.md, Abschnitt 4). Ohne diese
-- eigene Policy bliebe die Tabelle für ci_schema_reader trotz des GRANT unten leer (RLS filtert
-- ohne passende Policy JEDE Zeile heraus, auch mit Tabellen-GRANT).
CREATE POLICY "role_permissions_select_ci_schema_reader" ON "public"."role_permissions"
  FOR SELECT TO "ci_schema_reader"
  USING (true);

REVOKE ALL ON "public"."role_permissions" FROM "anon", "authenticated";
GRANT SELECT ON "public"."role_permissions" TO "authenticated";
GRANT SELECT ON "public"."role_permissions" TO "ci_schema_reader";

-- Befüllt exakt wie src/features/auth/permissions/rolePermissions.json ("roles"-Block, jede
-- Rolle mit ihrem Array erlaubter Rechte). deleteTournament/manageMembers tauchen bewusst in
-- KEINER Zeile auf -- kein Recht ist heute an eine Rolle vergeben, beide bleiben Eigentümer-only
-- über has_tournament_permission()s festen owner-Zweig.
INSERT INTO "public"."role_permissions" ("role", "permission") VALUES
  ('co-admin', 'writeMatchData'),
  ('co-admin', 'correctEvents'),
  ('co-admin', 'tournamentSettings'),
  ('co-admin', 'teams'),
  ('co-admin', 'restructure'),
  ('collaborator', 'writeMatchData'),
  ('collaborator', 'correctEvents'),
  ('collaborator', 'teams')
ON CONFLICT ("role", "permission") DO NOTHING;


-- ============================================================================
-- 2. Funktion public.has_tournament_permission -- die EINE Auswertung
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."has_tournament_permission"(
  "p_tournament_id" "uuid",
  "p_permission" "text"
) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  -- Direkter Tabellenzugriff umgeht RLS (SECURITY DEFINER), Stil von user_owns_tournament()/
  -- profile_visible_to_viewer(): vermeidet, dass die Policies von tournaments/
  -- tournament_collaborators/role_permissions beim Auswerten dieser Funktion erneut angewendet
  -- werden.
  --
  -- Der Eigentümer hat immer alle Rechte -- user_owns_tournament() liefert dafür true,
  -- UNABHÄNGIG vom Inhalt von role_permissions (keine 'owner'-Zeile dort nötig oder erwartet).
  SELECT
    "public"."user_owns_tournament"("p_tournament_id")
    OR EXISTS (
      SELECT 1
      FROM "public"."tournament_collaborators" "tc"
      JOIN "public"."role_permissions" "rp" ON "rp"."role" = "tc"."role"
      WHERE "tc"."tournament_id" = "p_tournament_id"
        AND "tc"."user_id" = ( SELECT "auth"."uid"() )
        AND "tc"."accepted_at" IS NOT NULL
        AND "rp"."permission" = "p_permission"
    );
$$;

COMMENT ON FUNCTION "public"."has_tournament_permission"("uuid", "text") IS
  'Die EINE Rechteprüfung (R5b): true, wenn der aufrufende Nutzer für p_tournament_id entweder
   Eigentümer ist (user_owns_tournament(), immer alle Rechte) ODER ein akzeptiertes Mitglied
   dieses Turniers mit einer Rolle ist, die role_permissions das angefragte p_permission
   zuweist. Jede rollenbasierte Schreib-Policy in diesem Projekt ruft AUSSCHLIESSLICH diese
   Funktion auf -- keine Policy enthält mehr eine eigene EXISTS-Klausel gegen
   tournament_collaborators.role.

   ERWEITERUNGSPUNKT: Eine künftige Rechtevergabe PRO TURNIER UND PERSON (z.B. eine Tabelle
   tournament_permission_overrides(tournament_id, user_id, permission, granted)) wird
   AUSSCHLIESSLICH HIER ausgewertet -- z.B. als zusätzliche EXISTS-Klausel vor oder nach der
   rollenbasierten Prüfung oben. Keine Policy und kein App-Aufrufer müsste dafür geändert
   werden. Nicht Teil dieser Migration, nur vorbereitet.

   REVOKE ALL FROM PUBLIC, EXECUTE für authenticated UND anon: RLS-Policies laufen im
   AUFRUFERKONTEXT -- Postgres prüft das EXECUTE-Recht auf jede in einer USING/WITH-CHECK-Klausel
   aufgerufene Funktion gegen die Rolle, die die Policy gerade auswertet (SECURITY DEFINER
   schützt nur den FUNKTIONSKÖRPER, nicht den Aufruf selbst). Die rollenbasierten Schreib-
   Policies unten laufen TO authenticated, anon (Stil aller bisherigen Schreib-Policies seit
   20260922_001, deckt u.a. anonym angemeldete Eigentümer ab, siehe roleMatrix-Zeile
   "owner-anonymous") -- ohne EXECUTE für BEIDE Rollen würde die Policy-Auswertung selbst schon
   an einem fehlenden Funktionsrecht scheitern, bevor die eigentliche Prüfung überhaupt läuft.';

REVOKE ALL ON FUNCTION "public"."has_tournament_permission"("uuid", "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."has_tournament_permission"("uuid", "text") TO "authenticated", "anon";


-- ============================================================================
-- 3. matches -- INSERT/DELETE über 'restructure', UPDATE über 'writeMatchData'
-- ============================================================================

DROP POLICY IF EXISTS "matches_insert_v2" ON "public"."matches";

CREATE POLICY "matches_insert_v2" ON "public"."matches"
  FOR INSERT TO "authenticated", "anon"
  WITH CHECK (
    "public"."has_tournament_permission"("tournament_id", 'restructure')
  );

-- R5-H1: vorher (Baseline) nur "auth.uid() = owner_id", kein Mitarbeiter-Zweig -- ein Co-Admin
-- traf beim Löschen still 0 Zeilen, siehe Kopfkommentar dieser Datei.
DROP POLICY IF EXISTS "matches_delete_v2" ON "public"."matches";

CREATE POLICY "matches_delete_v2" ON "public"."matches"
  FOR DELETE TO "authenticated", "anon"
  USING (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."has_tournament_permission"("tournament_id", 'restructure')
  );

DROP POLICY IF EXISTS "matches_update_v3" ON "public"."matches";

CREATE POLICY "matches_update_v3" ON "public"."matches"
  FOR UPDATE TO "authenticated", "anon"
  USING (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."has_tournament_permission"("tournament_id", 'writeMatchData')
  )
  WITH CHECK (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."has_tournament_permission"("tournament_id", 'writeMatchData')
  );


-- ============================================================================
-- 4. match_events -- INSERT über 'writeMatchData', UPDATE/DELETE über 'correctEvents'.
--    Das Turnier ergibt sich über matches (match_events hat kein eigenes tournament_id).
--    match_events_select_v3 bleibt UNVERÄNDERT (Lese-Policy, nicht Teil dieses Auftrags).
-- ============================================================================

DROP POLICY IF EXISTS "match_events_insert_v3" ON "public"."match_events";

CREATE POLICY "match_events_insert_v3" ON "public"."match_events"
  FOR INSERT TO "authenticated", "anon"
  WITH CHECK (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."has_tournament_permission"(
      ( SELECT "tournament_id" FROM "public"."matches" WHERE "id" = "match_events"."match_id" ),
      'writeMatchData'
    )
  );

DROP POLICY IF EXISTS "match_events_update_v2" ON "public"."match_events";

CREATE POLICY "match_events_update_v2" ON "public"."match_events"
  FOR UPDATE TO "authenticated", "anon"
  USING (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."has_tournament_permission"(
      ( SELECT "tournament_id" FROM "public"."matches" WHERE "id" = "match_events"."match_id" ),
      'correctEvents'
    )
  )
  WITH CHECK (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."has_tournament_permission"(
      ( SELECT "tournament_id" FROM "public"."matches" WHERE "id" = "match_events"."match_id" ),
      'correctEvents'
    )
  );

DROP POLICY IF EXISTS "match_events_delete_v2" ON "public"."match_events";

CREATE POLICY "match_events_delete_v2" ON "public"."match_events"
  FOR DELETE TO "authenticated", "anon"
  USING (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."has_tournament_permission"(
      ( SELECT "tournament_id" FROM "public"."matches" WHERE "id" = "match_events"."match_id" ),
      'correctEvents'
    )
  );


-- ============================================================================
-- 5. teams -- INSERT/DELETE über 'restructure' (R5-H1 für DELETE, siehe Kopfkommentar),
--    UPDATE über 'teams'
-- ============================================================================

DROP POLICY IF EXISTS "teams_insert_v2" ON "public"."teams";

CREATE POLICY "teams_insert_v2" ON "public"."teams"
  FOR INSERT TO "authenticated", "anon"
  WITH CHECK (
    "public"."has_tournament_permission"("tournament_id", 'restructure')
  );

DROP POLICY IF EXISTS "teams_delete_v2" ON "public"."teams";

CREATE POLICY "teams_delete_v2" ON "public"."teams"
  FOR DELETE TO "authenticated", "anon"
  USING (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."has_tournament_permission"("tournament_id", 'restructure')
  );

DROP POLICY IF EXISTS "teams_update_v3" ON "public"."teams";

CREATE POLICY "teams_update_v3" ON "public"."teams"
  FOR UPDATE TO "authenticated", "anon"
  USING (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."has_tournament_permission"("tournament_id", 'teams')
  )
  WITH CHECK (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."has_tournament_permission"("tournament_id", 'teams')
  );


-- ============================================================================
-- 6. tournaments -- UPDATE über 'tournamentSettings'. DELETE bleibt beim Eigentümer
--    (tournaments_delete_v2, Baseline, UNVERÄNDERT -- "Turnier löschen" im Sinn von HARTEM
--    DELETE ist kein App-Pfad, siehe H4-Kommentar in 20260922_001; das Soft-Delete über
--    deleted_at läuft über den Trigger unten, Abschnitt 8).
-- ============================================================================

DROP POLICY IF EXISTS "tournaments_update_v3" ON "public"."tournaments";

CREATE POLICY "tournaments_update_v3" ON "public"."tournaments"
  FOR UPDATE TO "authenticated", "anon"
  USING (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."has_tournament_permission"("id", 'tournamentSettings')
  )
  WITH CHECK (
    (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."has_tournament_permission"("id", 'tournamentSettings')
  );


-- ============================================================================
-- 7. tournament_collaborators -- NUR der Verwaltungszweig von INSERT/UPDATE/DELETE wandert auf
--    'manageMembers'. Der Annahme- und Eigenzweig (user_id = auth.uid() bzw. invite_email =
--    auth.email()) bleibt unverändert -- das ist keine "Verwaltung", sondern das Wahrnehmen der
--    eigenen, an einen selbst gerichteten Einladung.
--
--    protect_collaborator_row() (20260922_003/20260923_001) bleibt UNVERÄNDERT: Sie prüft den
--    Eigentümer weiterhin über user_owns_tournament(OLD.tournament_id), nicht über
--    has_tournament_permission(OLD.tournament_id, 'manageMembers'). Begründung (Auftrag
--    verlangt das explizit): manageMembers ist HEUTE an keine Rolle vergeben, die Tabelle
--    role_permissions enthält keine Zeile dafür -- has_tournament_permission() reduziert sich
--    für 'manageMembers' also exakt auf user_owns_tournament(). Der Trigger bliebe deshalb schon
--    heute ohne Verhaltensänderung, wenn er umgestellt würde. Er bleibt trotzdem beim
--    Eigentümer-Check stehen: Der Trigger ist die ZWEITE, vom Policy-WITH-CHECK unabhängige
--    Verteidigungslinie gegen Rechte-Eskalation (K2/K3) -- sie soll NICHT automatisch
--    mitlaufen, sobald jemand künftig eine 'manageMembers'-Zeile für eine Rolle einträgt,
--    sondern bewusst separat entschieden werden (Mitarbeiter-Verwaltung ist sicherheitskritischer
--    als z.B. 'teams' oder 'restructure' -- sie kann Rollen und damit alle anderen Rechte
--    verändern). Wird 'manageMembers' künftig an eine Rolle vergeben, muss dieser Trigger in
--    einer EIGENEN, bewusst geprüften Migration mitgezogen werden.
-- ============================================================================

DROP POLICY IF EXISTS "collaborators_insert_v3" ON "public"."tournament_collaborators";

CREATE POLICY "collaborators_insert_v3" ON "public"."tournament_collaborators"
  FOR INSERT TO "authenticated", "anon"
  WITH CHECK (
    "public"."has_tournament_permission"("tournament_id", 'manageMembers')
  );

DROP POLICY IF EXISTS "collaborators_update_v3" ON "public"."tournament_collaborators";

CREATE POLICY "collaborators_update_v3" ON "public"."tournament_collaborators"
  FOR UPDATE TO "authenticated", "anon"
  USING (
    (("user_id" = ( SELECT "auth"."uid"() )) OR ("invite_email" = ( SELECT "auth"."email"() )) OR "public"."has_tournament_permission"("tournament_id", 'manageMembers'))
  )
  WITH CHECK (
    ("public"."has_tournament_permission"("tournament_id", 'manageMembers') OR ("user_id" = ( SELECT "auth"."uid"() )))
  );

DROP POLICY IF EXISTS "collaborators_delete_v3" ON "public"."tournament_collaborators";

CREATE POLICY "collaborators_delete_v3" ON "public"."tournament_collaborators"
  FOR DELETE TO "authenticated", "anon"
  USING (
    (("user_id" = ( SELECT "auth"."uid"() )) OR "public"."has_tournament_permission"("tournament_id", 'manageMembers'))
  );


-- ============================================================================
-- 8. tournaments.deleted_at -- Trigger aus R5 übernommen, jetzt über 'deleteTournament'
--    (löst N5 strukturell, siehe Kopfkommentar dieser Datei) statt eines rohen "<>"-Vergleichs.
-- ============================================================================

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
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."protect_deleted_at"() IS
  'BEFORE-UPDATE-Schutz: tournaments.deleted_at (Soft-Delete) ist nur fuer Rollen mit dem Recht
   deleteTournament aenderbar -- role_permissions weist es heute KEINER Rolle zu, has_tournament_
   permission() reduziert sich fuer dieses Recht also auf den Eigentuemer-Zweig
   (user_owns_tournament()). RAISE nur bei TATSAECHLICHER Aenderung (IS DISTINCT FROM) -- die App
   schickt deleted_at bei jedem save() ungefragt mit demselben Wert mit
   (supabaseMappers.ts:633), ein unveraendertes Speichern durch einen Co-Admin darf deshalb nicht
   scheitern. SECURITY-DEFINER-Aufrufe sind ausgenommen (current_user-Muster wie
   protect_owner_id/protect_parent_keys). N5 (R5-Review): has_tournament_permission() liefert
   IMMER true/false, nie NULL (EXISTS-basiert) -- ein Aufrufer ohne auth.uid() (kein sub-Claim)
   erfuellt "NOT has_tournament_permission(...)" deshalb zuverlaessig, anders als der fruehere
   rohe "OLD.owner_id <> auth.uid()"-Vergleich, der bei auth.uid() IS NULL zu NULL auswertete und
   damit kein RAISE ausloeste.';

CREATE OR REPLACE TRIGGER "tournaments_protect_deleted_at"
  BEFORE UPDATE ON "public"."tournaments"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_deleted_at"();


-- ============================================================================
-- 9. cascade_tournament_visibility() -- SECURITY DEFINER aus R5 übernommen (M4), Logik
--    UNVERÄNDERT: ändert ausschließlich is_public auf Kindern von NEW.id (siehe R5-Migration/
--    -Report für die vollständige Prüfung: sechs UPDATE-Anweisungen, je gefiltert auf
--    tournament_id = NEW.id bzw. match_id IN (... tournament_id = NEW.id), keine andere Spalte).
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
  'AFTER-UPDATE-Kaskade (M4, aus R5 uebernommen): SECURITY DEFINER, damit ein Co-Admin, der
   tournaments.is_public setzt, auch sponsors/monitors/match_corrections mitzieht -- diese drei
   Tabellen erlauben nur dem Eigentuemer zu schreiben (sponsors_update_v2/monitors_update_v2,
   Baseline, unveraendert). Aendert ausschliesslich is_public auf Kindern von NEW.id, keine
   andere Spalte, keine andere Tabelle.';


-- ============================================================================
-- 10. R5-H1 (App-Seite): siehe SupabaseRepository.ts -- diese Migration liefert nur die
--     DB-seitige Hälfte des Fixes (Abschnitt 3/5 oben). Kein SQL hier.
-- ============================================================================
