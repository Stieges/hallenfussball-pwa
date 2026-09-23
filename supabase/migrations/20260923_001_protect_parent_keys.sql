-- Härtung nach dem Abschluss-Review von R2 (fix/rechte-rollentabelle, 235d947..fa4bacc):
-- eine kritische, LIVE ausnutzbare Lücke (K3) und eine verwandte, älter als der Branch
-- selbst (H5) schließen. Dazu zwei kleine Präzisierungen (L5) und ein CI-Gate (L4).
--
-- ============================================================================================
-- K3 — Turnier-Eigentümer macht sich per UPDATE zum Co-Admin eines FREMDEN Turniers. LIVE.
-- ============================================================================================
--
-- 20260922_003 (protect_collaborator_row) prüft NUR "user_owns_tournament(OLD.tournament_id)"
-- und lässt bei true die Zeile uneingeschränkt durch ("RETURN NEW" ohne jede Prüfung von NEW).
-- Das schützt den Fall "fremde Mitarbeiter-Zeile ändern" (K2), aber nicht den Fall
-- "EIGENE Mitarbeiter-Zeile auf ein FREMDES Turnier umhängen": Ein Eigentümer A von T_A ist
-- Eigentümer von OLD.tournament_id (= T_A) — der Trigger lässt ihn passieren, unabhängig davon,
-- welchen Wert NEW.tournament_id trägt. Das WITH CHECK von collaborators_update_v3 bestätigt
-- anschließend "user_id = auth.uid()" — das bleibt nach dem Umhängen wahr, es ist ja dieselbe
-- Zeile, nur mit anderem tournament_id.
--
-- Bewiesener Ablauf (final-review.md, Abschnitt K3, Sonde P1 im Container reproduziert):
--   1. A legt ein eigenes Turnier T_A an (jeder darf das, auch anonym).
--   2. A fügt (T_A, user_id=A, role='co-admin', accepted_at=now()) ein — geht durch, weil
--      collaborators_insert_v3 nur user_owns_tournament(T_A) verlangt.
--   3. UPDATE tournament_collaborators SET tournament_id = T_Opfer WHERE tournament_id = T_A
--      AND user_id = A → UPDATE 1. protect_collaborator_row prüft user_owns_tournament(OLD.
--      tournament_id) = user_owns_tournament(T_A) = true (A ist ja Eigentümer von T_A) und
--      lässt jeden NEW-Wert durch.
--   4. A ist jetzt akzeptierter Co-Admin von T_Opfer. tournaments_update_v3 (seit 20260922_001)
--      lässt Co-Admins tournaments.* schreiben — A kann T_Opfer übernehmen, ganz ohne
--      Einladung. Die einzige Voraussetzung ist die UUID des Opfers, die jede öffentliche
--      Turnier-Seite und die Public View preisgeben.
--
-- Fix: Die ERSTE Prüfung in protect_collaborator_row, für ALLE Aufrufer, auch den Eigentümer
-- selbst: "NEW.tournament_id IS DISTINCT FROM OLD.tournament_id" → RAISE. Kein App-Pfad ändert
-- tournament_id einer bestehenden Collaborator-Zeile — weder das Einladen (INSERT, unberührt),
-- noch das Annehmen (nur user_id/accepted_at/use_count), noch die Mitarbeiter-Verwaltung des
-- Eigentümers (Rolle ändern, widerrufen — membershipService.ts ändert nirgends tournament_id
-- einer bestehenden Zeile). Deshalb RAISE, nicht wie bei protect_owner_id (K1, 003) still auf
-- OLD zurückfallen: ein stilles Beibehalten würde einen Fehler der App verdecken; hier gibt es
-- keinen legitimen Grund, den falschen Wert überhaupt anzunehmen und dann zu verwerfen.
--
-- ============================================================================================
-- H5 — Eigentümer hängt eigene matches/teams/match_events in fremde Turniere/Spiele um.
-- ============================================================================================
--
-- Nicht durch den Branch entstanden (die WITH-CHECK-Klauseln von matches_update_v3/
-- teams_update_v3/match_events_update_v2 prüfen seit jeher nur "owner_id = auth.uid()", und
-- protect_owner_id (K1, 003) hält owner_id sogar bewusst fest, gerade damit legitime Upserts
-- gelingen). Aber es ist exakt die Klasse, die K1/K2 schließen wollten: ein systemverwaltetes
-- Feld, das nach einem UPDATE weiterhin über den ALTEN Eigentümerbezug erlaubt bleibt, obwohl
-- die Zeile jetzt zu einem anderen Turnier/Spiel gehört (final-review.md, Sonde P5):
--   UPDATE matches SET tournament_id = T_Opfer WHERE id = M_eigen → UPDATE 1.
--   UPDATE match_events SET match_id = M_Opfer WHERE id = E_eigen → UPDATE 1 (mit is_public=true
--   auf der eigenen Zeile sogar für die Public View sichtbar).
--
-- Fix: dieselbe BEFORE-UPDATE-Sperre wie bei K3, aber generisch (protect_parent_keys(), über
-- TG_ARGV[0] parametrisiert — Begründung für diese statt zwei fast identischer Funktionen weiter
-- unten) auf jeder Tabelle mit einer Parent-Fremdschlüsselspalte:
--   tournament_id: matches, teams, sponsors, monitors, monitor_heartbeats
--   match_id:      match_events, match_corrections
--   tournament_collaborators.tournament_id ist bereits durch K3 oben abgedeckt (eigene
--   Funktion, weil dort die Eigentümer-Ausnahme und der Einladungs-Annahme-Zweig ganz andere
--   Fälle sind als "Parent-Fremdschlüssel niemals änderbar").
--
-- Tabellenliste ermittelt wie in 003 gefordert: Suche nach '"tournament_id" "uuid"' bzw.
-- '"match_id" "uuid"' in der Baseline (00000000000000_baseline_live_schema.sql), nicht aus
-- einer Altliste übernommen. Treffer für "tournament_id" NOT NULL: matches (:889),
-- monitor_heartbeats (:947), monitors (:959), sponsors (:1002), teams (:1081),
-- tournament_collaborators (:1114, siehe oben). Treffer für "match_id" NOT NULL:
-- match_corrections (:835), match_events (:858).
--
-- monitor_heartbeats — bewusst MIT aufgenommen, nicht ausgeklammert: Die Tabelle hat laut
-- Baseline genau EINE Policy, "owner_select_heartbeats" (nur SELECT). Es gibt keine
-- INSERT/UPDATE-Policy TO authenticated/anon — RLS verweigert Schreibzugriff für diese Rollen
-- also schon heute vollständig (ein UPDATE einer App-Rolle trifft 0 Zeilen, bevor der Trigger
-- über­haupt etwas zu prüfen hätte). Der tatsächliche Schreibpfad ist ausschließlich
-- record_monitor_heartbeat() (Baseline :515), eine SECURITY-DEFINER-Funktion, aufgerufen aus
-- MonitorDisplayPage.tsx per RPC — das ist die "bekannte, kaputte anon-Upsert-Pipeline" aus dem
-- Auftrag: sie schreibt tournament_id im ON-CONFLICT-DO-UPDATE-Zweig zwar erneut (Zeile 534:
-- "tournament_id = EXCLUDED.tournament_id"), aber EXCLUDED.tournament_id ist dort immer der
-- gegen monitors.tournament_id geprüfte p_tournament_id-Parameter (Zeile 520-527) — also
-- praktisch derselbe Wert wie zuvor, kein echtes Umhängen. Und weil die Funktion SECURITY
-- DEFINER ist, ist current_user beim Trigger-Aufruf der Funktionseigentümer, nicht
-- authenticated/anon (exakt dieselbe, in 003 empirisch geprüfte Eigenschaft, die
-- merge_user_data() von protect_owner_id ausnimmt) — der neue Trigger greift dort also gar
-- nicht ein. Die Aufnahme ist damit für die heutige, kaputte Pipeline folgenlos und schließt
-- nur die Lücke ab, die entstünde, wenn jemand künftig eine direkte UPDATE-Policy für
-- authenticated/anon auf monitor_heartbeats ergänzt, ohne an Parent-Schlüssel zu denken.
--
-- ============================================================================================
-- Warum current_user (wie bei K1/protect_owner_id in 003, hier zusätzlich für H5)
-- ============================================================================================
--
-- protect_parent_keys() lehnt nur ab, wenn zusätzlich "current_user IN ('authenticated',
-- 'anon')" gilt. Innerhalb einer SECURITY-DEFINER-Funktion (record_monitor_heartbeat(),
-- merge_user_data()) wechselt current_user für die Dauer des Aufrufs auf den
-- Funktionseigentümer — session_user bliebe unverändert, current_user nicht. Das ist in 003
-- empirisch im Container nachgewiesen (siehe dortigen Kommentar) und wird hier unverändert
-- übernommen. Ohne diese Ausnahme würde jede künftige SECURITY-DEFINER-Funktion, die
-- Parent-Schlüssel anfasst, an dieser Sperre scheitern, obwohl sie selbst schon geprüft hat,
-- dass der Aufruf legitim ist (record_monitor_heartbeat prüft z. B. explizit
-- "m.tournament_id = p_tournament_id" gegen monitors, bevor es schreibt).
--
-- ============================================================================================
-- protect_parent_keys(): eine Funktion statt zweier, ohne dynamisches SQL
-- ============================================================================================
--
-- Der Auftrag verlangt eine Entscheidung zwischen "über TG_ARGV[0] parametrisiert" und "zwei
-- Funktionen", "was ohne dynamisches SQL sauber geht". Eine EXECUTE-basierte Lösung (Spaltenname
-- in eine dynamische SQL-Zeichenkette einsetzen) wäre nötig, um NEW/OLD generisch per Spaltenname
-- zu lesen — genau das vermeidet diese Funktion: "to_jsonb(OLD) ->> col" liest die Spalte über
-- die JSON-Repräsentation der Zeile, mit dem Spaltennamen als reinem Zeichenketten-Schlüssel
-- (kein SQL-Text, keine Injektion, kein EXECUTE). Das ist eine Postgres-Bordfunktion, kein
-- dynamisches SQL im eigentlichen Sinn. Vorteil gegenüber zwei fast identischen Funktionen
-- (protect_tournament_id() / protect_match_id()): eine Stelle für Logik und Kommentar, ein
-- Test-/Wartungsziel statt zweier, und jede künftige dritte Parent-Spalte (falls je nötig)
-- braucht nur einen neuen Trigger, keine neue Funktion.
--
-- ============================================================================================
-- L5 — Annahme-Zweig in 003 präzisiert: use_count und accepted_at waren beliebig setzbar.
-- ============================================================================================
--
-- Vorher geprüft (Auftrag verlangt das, bevor dieser Zweig geändert wird): mapInvitationAccept-
-- ToSupabase (supabaseMappers.ts:702-710) schreibt "use_count: input.newUseCount", und
-- acceptInvitation (invitationService.ts:296ff, Zeile ~331) ruft es mit
-- "newUseCount: invitation.useCount + 1" auf — der App-Pfad schreibt also exakt
-- OLD.use_count + 1. Deshalb jetzt erzwungen: "NEW.use_count = COALESCE(OLD.use_count, 0) + 1"
-- (COALESCE für den Fall, dass eine Einladung ohne use_count-Default angelegt wurde) statt der
-- alten Lücke (use_count fehlte im AND-Katalog von 003 komplett, jeder Wert — auch 0 oder ein
-- Rücksetzen — kam durch). Zusätzlich "NEW.accepted_at <= now() + interval '1 minute'": die
-- App setzt "new Date().toISOString()" (Client-Uhrzeit), eine Minute Toleranz deckt normale
-- Uhrenabweichung ab, verhindert aber ein Datum in ferner Zukunft (harmlos, aber unpräzise,
-- wie im Review vermerkt).
--
-- ============================================================================================
-- L4 — Harness-CI-Gate (scripts/rls-role-matrix.sh, nicht Teil dieser Datei)
-- ============================================================================================
--
-- Gehört inhaltlich zu diesem Auftrag, ist aber kein SQL: Der Default-Modus von
-- scripts/rls-role-matrix.sh endet jetzt mit Exit 1, wenn MISMATCHES > 0 ist. Die
-- Gegenprobe-Modi (--baseline-only, --without-hardening, --without-004) bleiben bei Exit 0 —
-- sie sollen Abweichungen zeigen, nicht als fehlgeschlagen gelten.
--
-- ============================================================================================


-- ============================================================================
-- K3: protect_collaborator_row() — Parent-Schlüssel-Sperre VOR der Eigentümer-Ausnahme,
--     plus L5-Präzisierung von use_count/accepted_at im Annahme-Zweig
-- ============================================================================

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
  IF OLD.user_id IS NULL
     AND OLD.accepted_at IS NULL
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

  RAISE EXCEPTION 'Nicht erlaubt: nur der Turnier-Eigentuemer darf Mitarbeiter-Zeilen aendern (Ausnahme: das Annehmen der eigenen, noch offenen Einladung).'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

COMMENT ON FUNCTION "public"."protect_collaborator_row"() IS
  'BEFORE-UPDATE-Schutz auf tournament_collaborators: tournament_id ist fuer JEDEN Aufrufer
   unveraenderlich (K3, 20260923_001) -- auch fuer den Eigentuemer der Zeile. Danach wie 003:
   Nicht-Eigentuemer duerfen ausschliesslich ihre eigene, offene Einladung annehmen (user_id,
   accepted_at, use_count = alter Wert + 1) -- niemals role. Der Eigentuemer bleibt darueber
   hinaus uneingeschraenkt.';


-- ============================================================================
-- H5: protect_parent_keys() — generische Sperre für tournament_id/match_id auf den
--     Kind-Tabellen, TG_ARGV[0]-parametrisiert (Begründung im Kopfkommentar)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."protect_parent_keys"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  col text := TG_ARGV[0];
  old_val text;
  new_val text;
BEGIN
  -- to_jsonb(OLD)/to_jsonb(NEW) + ->> col: liest die durch den Trigger-Parameter benannte
  -- Spalte generisch, ohne EXECUTE/dynamisches SQL (Begründung im Kopfkommentar dieser Datei).
  old_val := to_jsonb(OLD) ->> col;
  new_val := to_jsonb(NEW) ->> col;

  IF new_val IS DISTINCT FROM old_val AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Nicht erlaubt: % ist ein unveraenderlicher Parent-Schluessel.', col
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."protect_parent_keys"() IS
  'BEFORE-UPDATE-Schutz (H5, 20260923_001): die per TG_ARGV[0] benannte Parent-Fremdschluessel-
   spalte (tournament_id bzw. match_id) ist fuer App-Requests (Rolle authenticated/anon)
   unveraenderlich -- RAISE statt stillschweigend beibehalten, denn kein App-Pfad aendert diese
   Werte (Kopiervorgaenge in App.tsx#handleCopyTournament und Settings/index.tsx#handleDuplicate
   vergeben neue IDs, kein UPDATE bestehender Zeilen). SECURITY-DEFINER-Funktionen (current_user
   = Funktionseigentuemer) sind ausgenommen, siehe Kopfkommentar.';

CREATE OR REPLACE TRIGGER "matches_protect_tournament_id"
  BEFORE UPDATE ON "public"."matches"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_parent_keys"('tournament_id');

CREATE OR REPLACE TRIGGER "teams_protect_tournament_id"
  BEFORE UPDATE ON "public"."teams"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_parent_keys"('tournament_id');

CREATE OR REPLACE TRIGGER "sponsors_protect_tournament_id"
  BEFORE UPDATE ON "public"."sponsors"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_parent_keys"('tournament_id');

CREATE OR REPLACE TRIGGER "monitors_protect_tournament_id"
  BEFORE UPDATE ON "public"."monitors"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_parent_keys"('tournament_id');

CREATE OR REPLACE TRIGGER "monitor_heartbeats_protect_tournament_id"
  BEFORE UPDATE ON "public"."monitor_heartbeats"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_parent_keys"('tournament_id');

CREATE OR REPLACE TRIGGER "match_events_protect_match_id"
  BEFORE UPDATE ON "public"."match_events"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_parent_keys"('match_id');

CREATE OR REPLACE TRIGGER "match_corrections_protect_match_id"
  BEFORE UPDATE ON "public"."match_corrections"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_parent_keys"('match_id');


-- ============================================================================
-- K3 (Fortsetzung): collaborators_update_v3 — WITH CHECK verengt
-- ============================================================================
--
-- USING bleibt unverändert (drei Zweige), denn die Annahme über "invite_email = auth.email()"
-- braucht es: vor dem Annehmen ist user_id noch NULL, nur invite_email macht die Zeile sichtbar.
-- WITH CHECK verliert den invite_email-Zweig: eine angenommene Zeile trägt user_id, der
-- Trigger-Guard oben erzwingt zusätzlich das exakte Annahme-Spaltenmuster. Ein invite_email-Match
-- allein (ohne dass NEW.user_id = auth.uid() gilt) darf eine Zeile nie mehr durchwinken --
-- zusätzliche, von protect_collaborator_row() unabhängige Verteidigungsebene auf Policy-Ebene.
DROP POLICY IF EXISTS "collaborators_update_v3" ON "public"."tournament_collaborators";

CREATE POLICY "collaborators_update_v3" ON "public"."tournament_collaborators"
  FOR UPDATE TO "authenticated", "anon"
  USING (
    (("user_id" = ( SELECT "auth"."uid"() )) OR ("invite_email" = ( SELECT "auth"."email"() )) OR "public"."user_owns_tournament"("tournament_id"))
  )
  WITH CHECK (
    ("public"."user_owns_tournament"("tournament_id") OR ("user_id" = ( SELECT "auth"."uid"() )))
  );
