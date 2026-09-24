-- R7 (task-R7-brief.md): Widerrufene und abgelaufene Einladungen schließen.
--
-- Zwei unabhängige, im R3- und R5b-Review dokumentierte Befunde, beide bewusst NICHT in den
-- Migrationen behoben, die die betroffenen Objekte ohnehin anfassten (Regel: nur Objekte
-- ändern, die die jeweilige Migration ohnehin anfasst, siehe task-R5b-report.md, Abschnitt
-- "Fixrunde 1, M3"):
--
--   F4 (task-R3-review.md): Der Annahme-Zweig in protect_collaborator_row() prüft weder
--   declined_at (der Eigentümer hat die Einladung per deactivateInvitation() widerrufen) noch
--   expires_at (die Einladung ist abgelaufen). Eine widerrufene oder abgelaufene Einladung lässt
--   sich also trotzdem annehmen.
--
--   Follow-up aus task-R5b-report.md ("Fixrunde 1", M3): has_tournament_permission() prüft seit
--   Fixrunde 1 declined_at, aber KEINE Lese-Policy und profile_visible_to_viewer() tun das --
--   ein Mitglied, dessen Mitgliedschaft der Eigentümer nach der Annahme widerruft (declined_at
--   gesetzt, accepted_at bleibt stehen), sieht weiterhin matches/teams/match_events/tournaments
--   des privaten Turniers und das Profil (E-Mail via display_name-Policy) des Eigentümers.
--
-- ============================================================================================
-- 1. Neue Funktion: is_active_tournament_member(p_tournament_id uuid)
-- ============================================================================================
--
-- Der Brief erlaubt zwei Wege: (a) jede betroffene Lese-Policy einzeln um "AND tc.declined_at
-- IS NULL" ergänzen, oder (b) eine Hilfsfunktion im Stil von has_tournament_permission(), die
-- die Mitgliedschaftsregel an einer Stelle hält -- ausdrücklich als die bessere Variante
-- benannt, "falls sauber machbar". Sie ist es: alle vier betroffenen Lese-Policies
-- (matches_select_v3, teams_select_v3, tournaments_select_v3, match_events_select_v3) haben
-- exakt dieselbe EXISTS-Klausel gegen tournament_collaborators, nur mit unterschiedlicher
-- Turnier-Referenz-Spalte -- eine reine Kopie derselben Bedingung an vier Stellen wäre die
-- Divergenz, die R5b bei has_tournament_permission() gerade erst beseitigt hat (siehe
-- Kopfkommentar 20260924_002, "Zwei Quellen für dieselbe Rechtetabelle"). Diese Funktion prüft
-- BEWUSST NUR die Mitgliedschaft (nicht den Eigentümer) -- jede der vier Policies hat bereits
-- einen eigenen, unveränderten "(SELECT auth.uid()) = owner_id"-Zweig, den diese Migration
-- nicht anfasst (kein Objekt, das nicht ohnehin geändert wird). Die Funktion ersetzt
-- ausschließlich die EXISTS-Klausel für Mitarbeiter.
--
-- SECURITY DEFINER (Stil von has_tournament_permission()/user_owns_tournament()): direkter
-- Tabellenzugriff umgeht RLS, vermeidet, dass die Policy von tournament_collaborators beim
-- Auswerten dieser Funktion erneut angewendet wird.
-- ============================================================================================

CREATE OR REPLACE FUNCTION "public"."is_active_tournament_member"(
  "p_tournament_id" "uuid"
) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "public"."tournament_collaborators" "tc"
    WHERE "tc"."tournament_id" = "p_tournament_id"
      AND "tc"."user_id" = ( SELECT "auth"."uid"() )
      AND "tc"."accepted_at" IS NOT NULL
      AND "tc"."declined_at" IS NULL
  );
$$;

REVOKE ALL ON FUNCTION "public"."is_active_tournament_member"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."is_active_tournament_member"("uuid") TO "authenticated", "anon";

COMMENT ON FUNCTION "public"."is_active_tournament_member"("uuid") IS
  'Wahr, wenn der aufrufende Nutzer fuer p_tournament_id ein angenommenes (accepted_at IS NOT
   NULL), NICHT widerrufenes (declined_at IS NULL) Mitglied ist. Prueft NUR die Mitgliedschaft,
   nicht den Eigentuemer -- die Lese-Policies (matches_select_v3/teams_select_v3/
   tournaments_select_v3/match_events_select_v3) haben je einen eigenen, unveraenderten
   Eigentuemer-Zweig. Haelt die Mitgliedschaftsregel an EINER Stelle, im Stil von
   has_tournament_permission() (20260924_002), das dieselbe EXISTS-Klausel fuer Schreib-Policies
   kapselt. R7 (20260924_003).';

-- ============================================================================================
-- 2. Lese-Policies: aktueller Live-Text (letzte definierende Migration je Policy), nur die
--    EXISTS-Klausel gegen is_active_tournament_member() ersetzt. Kein weiterer Zweig geändert.
-- ============================================================================================

-- matches_select_v3: zuletzt definiert in der Baseline (00000000000000_baseline_live_schema.sql),
-- seither unverändert (bestätigt in task-R5b-report.md, "Fixrunde 1", M3-Tabelle).
DROP POLICY IF EXISTS "matches_select_v3" ON "public"."matches";

CREATE POLICY "matches_select_v3" ON "public"."matches" FOR SELECT TO "authenticated", "anon"
  USING (
    ("is_public" = true)
    OR (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."is_active_tournament_member"("tournament_id")
  );

-- teams_select_v3: zuletzt definiert in der Baseline, seither unverändert.
DROP POLICY IF EXISTS "teams_select_v3" ON "public"."teams";

CREATE POLICY "teams_select_v3" ON "public"."teams" FOR SELECT TO "authenticated", "anon"
  USING (
    ("is_public" = true)
    OR (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."is_active_tournament_member"("tournament_id")
  );

-- tournaments_select_v3: zuletzt definiert in der Baseline, seither unverändert. Turnier-
-- Referenz-Spalte ist hier "id" (die Tabelle selbst), nicht "tournament_id".
DROP POLICY IF EXISTS "tournaments_select_v3" ON "public"."tournaments";

CREATE POLICY "tournaments_select_v3" ON "public"."tournaments" FOR SELECT TO "authenticated", "anon"
  USING (
    ("is_public" = true)
    OR (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."is_active_tournament_member"("id")
  );

-- match_events_select_v3: zuletzt definiert in 20260922_001_role_based_write_policies.sql
-- (Fixrunde 1 dieser Migration, der Mitarbeiter-Zweig wurde dort NEU ergänzt). match_events hat
-- keine eigene tournament_id-Spalte -- dieselbe Unterabfrage über matches wie bei den
-- Schreib-Policies in 20260924_002 (match_events_insert_v3 etc.).
DROP POLICY IF EXISTS "match_events_select_v3" ON "public"."match_events";

CREATE POLICY "match_events_select_v3" ON "public"."match_events"
  FOR SELECT TO "authenticated", "anon"
  USING (
    ("is_public" = true)
    OR (( SELECT "auth"."uid"() ) = "owner_id")
    OR "public"."is_active_tournament_member"(
      ( SELECT "tournament_id" FROM "public"."matches" WHERE "id" = "match_events"."match_id" )
    )
  );

-- ============================================================================================
-- 3. profile_visible_to_viewer(p_profile_id uuid): die Mitgliedszeile, die den Betrachter
--    adressiert (Regel (b), 20260924_001), darf nicht widerrufen sein. Aktueller Live-Text aus
--    20260924_001_restrict_profiles.sql übernommen, "AND tc.declined_at IS NULL" ergänzt
--    (Kommentar dazu in Fixrunde 1 korrigiert, N-1) und "AND (tc.user_id IS NOT NULL OR
--    tc.expires_at IS NULL OR tc.expires_at > now())" ergänzt (Fixrunde 1, N-2).
-- ============================================================================================

CREATE OR REPLACE FUNCTION "public"."profile_visible_to_viewer"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  -- Direct table access bypasses RLS (SECURITY DEFINER) — vermeidet, dass die Policies von
  -- tournament_collaborators/tournaments beim Auswerten dieser Funktion erneut angewendet
  -- werden (Stil von "user_owns_tournament").
  SELECT
    -- (a) die eigene Zeile
    p_profile_id = auth.uid()
    -- (b) p_profile_id ist EIGENTÜMER eines Turniers, in dem eine echte Mitarbeiter-/
    -- Einladungszeile MICH adressiert — angenommen (user_id) ODER noch offen (invite_email).
    -- Deckt "Eingeladener sieht Einladenden" (vor UND nach Annahme) und "Mitglied sieht
    -- Eigentümer" in EINER Regel ab, ohne die fälschbare Spalte "invited_by" zu prüfen (siehe
    -- Fixrunde-2-Kommentar oben, Ruling K). "collaborators_insert_v3" lässt einen Angreifer nur
    -- in EIGENEN Turnieren einfügen — für "t.owner_id = p_profile_id" (Opfer) bräuchte es eine
    -- Zeile in einem Turnier DES OPFERS, die der Angreifer nicht anlegen kann.
    --
    -- R7: die adressierende Zeile darf nicht widerrufen sein (tc.declined_at IS NULL) — sonst
    -- sieht ein Mitglied, dessen Mitgliedschaft der Eigentümer widerrufen hat, dessen Profil
    -- (und damit indirekt dessen E-Mail über die display_name-Spaltenfreigabe) weiter.
    --
    -- R7-Fixrunde 1 (N-1, final-review-2.md): Der vorherige Kommentar an dieser Stelle behauptete
    -- fälschlich, "declined_at IS NULL" sei vor der Annahme ("user_id IS NULL", nur
    -- "invite_email" adressiert) ein No-op, weil es dort noch nichts zu widerrufen gäbe. Das ist
    -- falsch: deactivateInvitation() (invitationService.ts:366) setzt declined_at GERADE bei
    -- offenen, noch nicht angenommenen Einladungen -- Review-Sonde P8a belegt das (1 → 0, sobald
    -- diese Bedingung greift). Die Wirkung ist gewollt (ein Eingeladener, dessen Einladung
    -- widerrufen wurde, soll das Profil des Einladenden nicht mehr sehen), war aber falsch
    -- dokumentiert und im Harness nicht gemessen (siehe Harness-Zeile
    -- "n1-widerrufene-offene-einladung-sieht-einladenden-nicht" unten).
    --
    -- R7-Fixrunde 1 (N-2): dieselbe Konsistenzlücke wie F4 -- eine ABGELAUFENE, nie widerrufene
    -- offene Einladung (expires_at in der Vergangenheit) zeigte das Profil des Einladenden
    -- weiterhin (Review-Sonde P8b = 1). "tc.user_id IS NOT NULL OR ..." lässt eine bereits
    -- angenommene Mitgliedschaft unberührt (deren Ablaufkonzept ist declined_at oben, nicht
    -- expires_at) und verlangt nur für eine noch OFFENE Einladung (user_id IS NULL) zusätzlich,
    -- dass sie nicht abgelaufen ist -- konsistent mit derselben Regel im Annahme-Zweig von
    -- protect_collaborator_row() unten.
    OR EXISTS (
      SELECT 1 FROM tournament_collaborators tc
      JOIN tournaments t ON t.id = tc.tournament_id
      WHERE t.owner_id = p_profile_id
        AND (tc.user_id = auth.uid() OR tc.invite_email = auth.email())
        AND tc.declined_at IS NULL
        AND (tc.user_id IS NOT NULL OR tc.expires_at IS NULL OR tc.expires_at > now())
    );
$$;

COMMENT ON FUNCTION "public"."profile_visible_to_viewer"("uuid") IS
  'SELECT-Policy-Helfer fuer profiles (profiles_select_related, 20260924_001): wahr fuer die
   eigene Zeile ODER wenn p_profile_id Eigentuemer eines Turniers ist, in dem eine NICHT
   widerrufene (declined_at IS NULL, R7) und -- falls noch offen -- NICHT abgelaufene
   (expires_at IS NULL OR expires_at > now(), R7-Fixrunde 1 N-2) Mitarbeiter-/Einladungszeile
   den Aufrufer adressiert (angenommen ueber user_id oder noch offen ueber invite_email).';

-- ============================================================================================
-- 4. protect_collaborator_row(): der Annahme-Zweig verlangt zusätzlich, dass die Einladung
--    weder widerrufen (declined_at IS NULL) noch abgelaufen (expires_at IS NULL ODER in der
--    Zukunft) ist -- F4 aus task-R3-review.md. Aktueller Live-Text aus
--    20260923_001_protect_parent_keys.sql übernommen, nur diese zwei Bedingungen ergänzt.
-- ============================================================================================

CREATE OR REPLACE FUNCTION "public"."protect_collaborator_row"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- K3: tournament_id ist ein Parent-Schlüssel, kein Gegenstand irgendeiner Mitarbeiter-
  -- Verwaltung. Diese Prüfung steht VOR der Eigentümer-Ausnahme unten und gilt für ALLE
  -- Aufrufer, auch den Turnier-Eigentümer selbst -- genau das hat 003 versäumt ("IF
  -- user_owns_tournament(OLD.tournament_id) THEN RETURN NEW" prüfte nur OLD, nie NEW). Ein
  -- Eigentümer, der die eigene tournament_id einer Mitarbeiterzeile per UPDATE auf ein fremdes
  -- Turnier umhängt, wird dadurch selbst zum Co-Admin dieses fremden Turniers (K3). Kein
  -- App-Pfad ändert tournament_id einer bestehenden Collaborator-Zeile -- RAISE, nicht
  -- stillschweigend beibehalten wie bei protect_owner_id (K1): ein Fehler hier ist sichtbar,
  -- ein stilles Beibehalten würde einen Fehler der App verdecken.
  IF NEW.tournament_id IS DISTINCT FROM OLD.tournament_id THEN
    RAISE EXCEPTION 'Nicht erlaubt: tournament_id einer Mitarbeiter-Zeile ist unveraenderlich.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Turnier-Eigentümer verwaltet seine Mitarbeiter: uneingeschränkt (wie bisher).
  -- WICHTIG: OLD/NEW sind plpgsql-Record-Variablen, keine SQL-Tabellenreferenzen — NIE als
  -- "OLD"/"NEW" (doppelt gequotet) schreiben, sonst sucht Postgres eine Tabelle namens OLD/NEW
  -- im FROM-Klausel-Kontext und scheitert mit "missing FROM-clause entry for table \"OLD\""
  -- (im Container reproduziert, bevor dieser Kommentar geschrieben wurde — Warnung aus 003
  -- unverändert übernommen).
  IF "public"."user_owns_tournament"(OLD.tournament_id) THEN
    RETURN NEW;
  END IF;

  -- Nicht Eigentümer: einzig erlaubter Vorgang ist das Annehmen der EIGENEN, noch nicht
  -- angenommenen Einladung -- exakt das Spaltenmuster aus
  -- invitationService.ts#acceptInvitation (mapInvitationAcceptToSupabase): user_id,
  -- accepted_at, use_count. Alle anderen Spalten müssen unverändert bleiben. tournament_id
  -- ist durch die Prüfung ganz oben bereits für ALLE Aufrufer erzwungen, taucht deshalb hier
  -- nicht mehr im AND-Katalog auf (wäre nach der ersten RAISE ohnehin unerreichbar).
  --
  -- L5-Präzisierung: use_count muss exakt um 1 steigen (App schreibt "invitation.useCount + 1",
  -- vor dieser Migration gegen mapInvitationAcceptToSupabase/acceptInvitation geprüft) --
  -- vorher war jeder Wert erlaubt, weil use_count in 003 im AND-Katalog schlicht fehlte.
  -- accepted_at darf höchstens 1 Minute in der Zukunft liegen (Uhrenabweichung zwischen Client
  -- und DB-Server), nicht beliebig weit (etwa ein Datum in ferner Zukunft, vorher möglich).
  --
  -- R7 (F4, task-R3-review.md): eine bereits widerrufene ODER abgelaufene Einladung lässt sich
  -- damit nicht mehr annehmen. "OLD.declined_at IS NULL" -- der Eigentümer hat
  -- deactivateInvitation() nicht aufgerufen. "OLD.expires_at IS NULL OR OLD.expires_at > now()"
  -- -- keine Ablaufzeit gesetzt, oder sie liegt noch in der Zukunft. Beide Spalten stehen bereits
  -- im NOT-DISTINCT-Katalog unten (dürfen sich beim Annehmen nicht ändern) -- diese zwei neuen
  -- Zeilen prüfen zusätzlich ihren WERT vor der Annahme, nicht nur, dass er gleich bleibt.
  IF OLD.user_id IS NULL
     AND OLD.accepted_at IS NULL
     AND OLD.declined_at IS NULL
     AND (OLD.expires_at IS NULL OR OLD.expires_at > now())
     AND NEW.user_id = ( SELECT "auth"."uid"() )
     AND NEW.accepted_at IS NOT NULL
     AND NEW.accepted_at <= now() + interval '1 minute'
     AND NEW.use_count = COALESCE(OLD.use_count, 0) + 1
     AND NEW.id = OLD.id
     AND NEW.role = OLD.role
     AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
     AND NEW.invite_email IS NOT DISTINCT FROM OLD.invite_email
     AND NEW.invite_code IS NOT DISTINCT FROM OLD.invite_code
     AND NEW.invited_at IS NOT DISTINCT FROM OLD.invited_at
     AND NEW.invited_by IS NOT DISTINCT FROM OLD.invited_by
     AND NEW.declined_at IS NOT DISTINCT FROM OLD.declined_at
     AND NEW.allowed_fields IS NOT DISTINCT FROM OLD.allowed_fields
     AND NEW.allowed_groups IS NOT DISTINCT FROM OLD.allowed_groups
     AND NEW.team_ids IS NOT DISTINCT FROM OLD.team_ids
     AND NEW.label IS NOT DISTINCT FROM OLD.label
     AND NEW.max_uses IS NOT DISTINCT FROM OLD.max_uses
     AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Nicht erlaubt: nur der Turnier-Eigentuemer darf Mitarbeiter-Zeilen aendern (Ausnahme: das Annehmen der eigenen, noch offenen, nicht widerrufenen und nicht abgelaufenen Einladung).'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

COMMENT ON FUNCTION "public"."protect_collaborator_row"() IS
  'BEFORE-UPDATE-Schutz auf tournament_collaborators: tournament_id ist fuer JEDEN Aufrufer
   unveraenderlich (K3, 20260923_001) -- auch fuer den Eigentuemer der Zeile. Danach wie 003:
   Nicht-Eigentuemer duerfen ausschliesslich ihre eigene, offene, NICHT widerrufene und NICHT
   abgelaufene Einladung annehmen (user_id, accepted_at, use_count = alter Wert + 1) -- niemals
   role (F4, R7: declined_at/expires_at werden vor der Annahme geprueft, 20260924_003). Der
   Eigentuemer bleibt darueber hinaus uneingeschraenkt.';

-- ============================================================================================
-- Harness (scripts/rls-role-matrix.sh): neuer Modus --without-r7 (alles bis 20260924_002,
-- ohne diese Migration) plus neue Zeilen in beiden Modi -- siehe task-R7-brief.md, Tabelle
-- "Harness". Typen (src/types/supabase.ts): is_active_tournament_member alphabetisch ergänzt.
-- ============================================================================================

-- ============================================================================================
-- Fixrunde 1 (adversariales Review, final-review-2.md, zugleich R7-Adversarial-Review)
-- ============================================================================================
--
-- Verdikt des Reviews zu dieser Migration: bereit für die Produktion, ja -- die Semantik ist
-- korrekt, kein bestehendes Verhalten wird zurückgedreht (jeder Basistext wurde gegen seinen
-- letzten definierenden Stand verglichen). Zwei Empfehlungen vor dem Anwenden, beide hier
-- umgesetzt, die Migration ist WEITERHIN NICHT live:
--
--   M-1 (mittel): Die Harness-Fixture für die gültige Einladung (C_PENDING_INVITE) hatte
--   expires_at = NULL -- die App setzt bei JEDER Einladung immer ein zukünftiges expires_at
--   (invitationService.ts:183). DB-Mutation M2 des Reviews (die expires_at-Prüfung im
--   Annahme-Zweig von protect_collaborator_row() entfernt) blieb deshalb im Harness GRÜN, obwohl
--   sie JEDE echte App-Einladung unannehmbar gemacht hätte. Fix: die GETEILTE Fixture
--   C_PENDING_INVITE selbst bekommt expires_at = now() + 7 Tage (Review-Vorschlag 1, statt einer
--   zweiten, redundanten Zeile) -- das macht ALLE bestehenden Zeilen, die diese Fixture nutzen
--   (k2-einladung-annehmen, l5-annahme-*, die R6-Zeilen "eingeladener sieht einladenden", die
--   neue "annahme-gueltige-einladung" aus Fixrunde 0), realistischer, ohne ihr erwartetes
--   Ergebnis zu ändern (alle waren und bleiben "allowed"/funktionierend).
--
--   N-1 (niedrig): Kommentar an profile_visible_to_viewer() korrigiert (siehe Abschnitt 3 oben)
--   -- behauptete fälschlich, declined_at IS NULL sei vor der Annahme ein No-op. Neue
--   Harness-Zeile "n1-widerrufene-offene-einladung-sieht-einladenden-nicht".
--
-- Zusätzlich vom Auftraggeber verlangt (über die Review-Empfehlung hinaus, die diese Punkte als
-- unblockierende Follow-ups eingestuft hatte -- hier trotzdem direkt gefixt, weil die Migration
-- noch nicht live ist):
--
--   N-2 (niedrig): profile_visible_to_viewer() prüft jetzt zusätzlich expires_at für NOCH OFFENE
--   Einladungen (siehe Abschnitt 3 oben) -- konsistent mit derselben Regel im Annahme-Zweig von
--   protect_collaborator_row(). Neue Harness-Zeile
--   "n2-abgelaufene-offene-einladung-sieht-einladenden-nicht".
--
--   N-3 (niedrig, Harness-Lücke): "accepted_at IS NOT NULL" in is_active_tournament_member() war
--   nicht bewacht -- DB-Mutation M1 des Reviews (diese Bedingung entfernt) blieb im Harness GRÜN.
--   Kein Code-Fix nötig (die Funktion selbst ist korrekt, siehe Abschnitt 1 oben) -- neue
--   Harness-Zeile "n3-offene-mitgliedschaft-liest-privates-turnier-nicht" (Fixture
--   U_PENDING/C_OPEN_COADMIN, bereits vorhanden, bisher nur bei Schreibzugriffen geprüft).
--
--   N-4 (niedrig): scripts/db_privilege_assertions.sql bekommt zwei neue Positivkontrollen
--   (EXECUTE für anon auf is_active_tournament_member(uuid) und has_tournament_permission(uuid,
--   text)) -- ohne sie bliebe ein Live-ACL-Drift (versehentliches REVOKE) dem Drift-Check
--   verborgen, Folge wäre der Ausfall von Public View und Monitoren.
--
-- Bewusst NICHT geändert, nur bestätigt (Ruling: kein Objekt anfassen, das diese Migration nicht
-- ohnehin ändert):
--
--   N-5 team_players_insert_v3 kennt keinen Rollenfilter (jedes akzeptierte Mitglied darf
--   Spieler einfügen, sollte laut Tabelle 'restructure' verlangen) -- älter als der Branch, App
--   schreibt team_players heute nicht, live ohne Exposition. Follow-up für einen eigenen Task.
--
--   N-6 Mutationsprobe A2 (!readOnly aus dem Auto-Finish-Effekt entfernt) hängt statt rot zu
--   werden (useMatchSound liefert bei jedem Render eine neue Identität) -- betrifft
--   src/components/live-cockpit/LiveCockpit.tsx, kein DB-Objekt dieser Migration. Bereits im
--   R7-Report (Bedenken 1) dokumentiert. Follow-up: useMatchSound memoisieren (Task F laut
--   Review).
--
--   N-7 permissions.ts#canEditTeamMetadata bindet an 'restructure', die JSON beschreibt dieselbe
--   Sache als Capability 'teams' -- toter Code (kein Aufrufer außerhalb der Tests), kein
--   DB-Objekt. Follow-up für einen eigenen Task.
-- ============================================================================================
