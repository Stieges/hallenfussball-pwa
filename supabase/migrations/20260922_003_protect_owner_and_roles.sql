-- Härtung nach Abschluss-Review von R1: zwei kritische Lücken schließen.
--
-- Anlass: Das Abschluss-Review von R1 (20260922_001, 20260922_002 — beide bereits live) fand
-- zwei kritische Lücken. Heute ist niemand exponiert (tournament_collaborators ist leer, und
-- INSERT auf diese Tabelle verlangt user_owns_tournament) — das ändert sich, sobald Daniel den
-- ersten Helfer einlädt.
--
-- ============================================================================================
-- K1 — 20260922_001 hat selbst eine Owner-Übernahme geöffnet
-- ============================================================================================
--
-- SupabaseRepository.save() holt getUser() (Zeile 179), übergibt user.id an
-- mapTournamentToSupabase (Zeile 185-187), das ihn als owner_id setzt
-- (supabaseMappers.ts:610). Für ein bestehendes, versioniertes Turnier (der Normalfall --
-- ein Co-Admin beendet ein Spiel eines LAUFENDEN Turniers) ist das ein direktes
-- ".update({...tournamentRow, version: nextVersion}).eq('id', ...).eq('version', ...)"
-- (Zeilen 203-208, Optimistic Locking) -- owner_id steht dabei ungefragt im Payload, wie
-- bei jedem Feld von tournamentRow. Nur der Fallback-Pfad ohne bekannte Version (Zeile 236)
-- nutzt tatsächlich .upsert(...); für die hier relevante Sequenz "Turnier existiert bereits,
-- Co-Admin speichert es" ist die Optimistic-Locking-UPDATE die reale Route und die, die
-- dieses Migrations-SQL sowie der Harness-Beleg nachbilden. Seit 20260922_001 lässt
-- tournaments_update_v3 den Co-Admin bei BEIDEN Pfaden zu -- vorher war "role = 'admin'"
-- eine tote Bedingung und das Speichern scheiterte still für Co-Admins. Jetzt gelingt es,
-- und weil die App bei JEDEM Speichern owner_id = eigene user.id mitschickt: ein Co-Admin,
-- der ein Spiel beendet (und dabei das Turnier speichert), überschreibt tournaments.owner_id
-- mit sich selbst. Kein Angriff nötig, ein normaler Speicherpfad genügt. Aus stillem
-- Scheitern wurde eine stille Übernahme.
--
-- Umfang (live geprüft): Alle "*_sync_owner"-Trigger (matches_sync_owner,
-- match_events_sync_owner, teams_sync_owner, sponsors_sync_owner, monitors_sync_owner,
-- match_corrections_sync_owner) laufen NUR BEFORE INSERT und leiten owner_id vom Elternteil
-- ab. Bei INSERT ... ON CONFLICT DO UPDATE (das Upsert-Muster von SupabaseRepository) stammt
-- EXCLUDED aus dem schon vom Trigger synchronisierten Zeilenvorschlag — Kinder sind beim
-- Upsert also geschützt, SOLANGE tournaments.owner_id selbst intakt bleibt. Die Wurzel
-- (tournaments) hat aber keinen eigenen Schutz. Und bei einem DIREKTEN UPDATE (kein Upsert)
-- greift kein Sync-Trigger überhaupt — ein Mitarbeiter kann owner_id auf matches/match_events/
-- etc. direkt setzen, ganz ohne den Umweg über tournaments.
--
-- Fix: protect_owner_id() — BEFORE UPDATE auf JEDER public-Tabelle mit einer owner_id-Spalte.
-- Tabellen ermittelt durch Suche nach '"owner_id" "uuid"' in der Baseline (nicht aus einer
-- Altliste übernommen): match_corrections, match_events, matches, monitors, sponsors, teams,
-- tournament_templates, tournaments.
--
-- Wenn NEW.owner_id IS DISTINCT FROM OLD.owner_id UND current_user IN ('authenticated',
-- 'anon'): NEW.owner_id := OLD.owner_id — BEIBEHALTEN, NICHT ablehnen. Grund: owner_id ist
-- systemverwaltet, und die App schickt ihn bei jedem Upsert ungefragt mit (siehe oben).
-- Ablehnen würde jedes legitime Speichern eines Co-Admins mit einer Exception scheitern
-- lassen und exakt das stille Scheitern zurückbringen, das 20260922_001 beheben sollte.
-- Beibehalten lässt das Speichern gelingen und hält den Eigentümer fest — der Co-Admin merkt
-- nichts, das Turnier bleibt, wem es gehört.
--
-- current_user (nicht session_user!) unterscheidet einen PostgREST-Request (Rolle
-- authenticated/anon) von allem anderen: Innerhalb einer SECURITY DEFINER-Funktion wechselt
-- current_user für die Dauer des Aufrufs auf den Funktionseigentümer (hier: die Rolle, die
-- CREATE FUNCTION ausgeführt hat — in der Produktion eine Migrations-/Owner-Rolle, nicht
-- authenticated/anon); session_user bliebe unverändert. Empirisch im Container bestätigt:
-- current_user vor einem SECURITY-DEFINER-Aufruf unter der Rolle authenticated ist
-- "authenticated", INNERHALB der Funktion "postgres" (Funktionseigentümer), danach wieder
-- "authenticated". Die Eigentümer-Übertragung merge_user_data() (Baseline ab Zeile ~453,
-- SECURITY DEFINER) läuft deshalb außerhalb dieser Sperre — ihre direkten UPDATE-Statements
-- auf tournaments/teams/matches/match_events SET owner_id sind NICHT betroffen. Separater,
-- von K1/K2 unabhängiger Befund dazu im Report (Abschnitt "Fixrunde 2"): merge_user_data()
-- referenziert eine Tabelle "tournament_members", die es nicht gibt (vermutlich eine
-- Altlast vor der Umbenennung zu tournament_collaborators) — die Funktion schlägt deshalb
-- HEUTE SCHON fehl, sobald der Quellnutzer tatsächlich ein Turnier besitzt, unabhängig von
-- dieser Migration. Nicht Gegenstand dieses Fixes.
--
-- ============================================================================================
-- K2 — Mitglieder können ihre eigene Zeile beliebig ändern (schlimmer als im Review vermutet)
-- ============================================================================================
--
-- collaborators_update_v3 (unverändert seit der Baseline) erlaubt UPDATE, wenn
-- "user_id = auth.uid() OR invite_email = auth.email() OR user_owns_tournament(...)" —
-- OHNE Spaltenbeschränkung. Ein Mitglied darf damit nicht nur die eigene role ändern
-- (Rechte-Eskalation zu co-admin), sondern auch tournament_id — die Prüfung
-- "user_id = auth.uid()" bleibt nach dem Umhängen der eigenen Zeile auf ein FREMDES Turnier
-- weiterhin wahr (es ist ja immer noch dieselbe Zeile, nur mit anderem tournament_id-Wert).
-- Wer zu irgendeinem Turnier eingeladen ist, kann sich damit selbst in ein beliebiges anderes
-- Turnier eintragen, dort zum co-admin machen — und es über K1 (vor diesem Fix) übernehmen.
--
-- Zuerst nachverfolgt, nicht angenommen: Der einzige legitime Schreibpfad eines
-- NICHT-Eigentümers auf diese Tabelle ist das Annehmen einer Einladung
-- (invitationService.ts#acceptInvitation → mapInvitationAcceptToSupabase,
-- supabaseMappers.ts:702-710). Der schreibt GENAU drei Spalten: user_id (von NULL auf die
-- eigene auth.uid()), accepted_at (von NULL auf jetzt) und use_count (hochgezählt) — nicht
-- nur die zwei aus der ersten Vermutung. Jede andere Spalte bleibt beim Annehmen unverändert.
-- Es gibt keinen Invitee-seitigen "Ablehnen"-Pfad (deactivateInvitation wird laut Code nur aus
-- der Einladungs-Verwaltung des Eigentümers aufgerufen, nie von InviteAcceptScreen.tsx) —
-- ein Nicht-Eigentümer, der declined_at setzt, ist deshalb kein legitimer App-Ablauf.
--
-- Fix: protect_collaborator_row() — BEFORE UPDATE auf tournament_collaborators. Ist der
-- Ausführende Eigentümer des Turniers (user_owns_tournament(OLD.tournament_id), dieselbe
-- SECURITY-DEFINER-Funktion, die die bestehende UPDATE-Policy schon verwendet):
-- uneingeschränkt — der Eigentümer verwaltet seine Mitarbeiter wie bisher (Rollen ändern,
-- Einladungen widerrufen). Ist er es NICHT: erlaubt ist ausschließlich das exakte
-- Annahme-Muster (user_id NULL→auth.uid(), accepted_at NULL→gesetzt, use_count darf sich
-- ändern, ALLE anderen Spalten müssen unverändert bleiben, insbesondere tournament_id UND
-- role). Jede Abweichung → RAISE EXCEPTION. Anders als bei K1 ist Ablehnen hier richtig: das
-- sind keine legitimen App-Abläufe, es gibt nichts zu bewahren.
--
-- Bewusst KEIN current_user-Sonderfall wie bei K1: K2 hat keinen bekannten legitimen
-- Nicht-App-Pfad, der geschützt werden müsste (merge_user_data fasst tournament_collaborators
-- gar nicht an, siehe K1-Absatz). Ein Sonderfall ohne bekannten Bedarf wäre nur eine
-- zusätzliche Angriffsfläche.
--
-- ============================================================================================


-- ============================================================================
-- K1: protect_owner_id() + Trigger auf allen 8 Tabellen mit owner_id
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."protect_owner_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id AND current_user IN ('authenticated', 'anon') THEN
    NEW.owner_id := OLD.owner_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."protect_owner_id"() IS
  'BEFORE-UPDATE-Schutz: owner_id ist systemverwaltet. App-Requests (Rolle authenticated/anon)
   koennen ihn nicht per UPDATE aendern -- der alte Wert wird stillschweigend beibehalten
   (nicht abgelehnt, damit legitime Upserts, die owner_id ungefragt mitschicken, weiter
   gelingen). SECURITY-DEFINER-Funktionen (current_user = Funktionseigentuemer, z.B.
   merge_user_data) sind ausgenommen.';

CREATE OR REPLACE TRIGGER "match_corrections_protect_owner_id"
  BEFORE UPDATE ON "public"."match_corrections"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_owner_id"();

CREATE OR REPLACE TRIGGER "match_events_protect_owner_id"
  BEFORE UPDATE ON "public"."match_events"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_owner_id"();

CREATE OR REPLACE TRIGGER "matches_protect_owner_id"
  BEFORE UPDATE ON "public"."matches"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_owner_id"();

CREATE OR REPLACE TRIGGER "monitors_protect_owner_id"
  BEFORE UPDATE ON "public"."monitors"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_owner_id"();

CREATE OR REPLACE TRIGGER "sponsors_protect_owner_id"
  BEFORE UPDATE ON "public"."sponsors"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_owner_id"();

CREATE OR REPLACE TRIGGER "teams_protect_owner_id"
  BEFORE UPDATE ON "public"."teams"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_owner_id"();

CREATE OR REPLACE TRIGGER "tournament_templates_protect_owner_id"
  BEFORE UPDATE ON "public"."tournament_templates"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_owner_id"();

CREATE OR REPLACE TRIGGER "tournaments_protect_owner_id"
  BEFORE UPDATE ON "public"."tournaments"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_owner_id"();


-- ============================================================================
-- K2: protect_collaborator_row() + Trigger auf tournament_collaborators
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."protect_collaborator_row"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Turnier-Eigentümer verwaltet seine Mitarbeiter: uneingeschränkt (wie bisher).
  -- WICHTIG: OLD/NEW sind plpgsql-Record-Variablen, keine SQL-Tabellenreferenzen — NIE als
  -- "OLD"/"NEW" (doppelt gequotet) schreiben, sonst sucht Postgres eine Tabelle namens OLD/NEW
  -- im FROM-Klausel-Kontext und scheitert mit "missing FROM-clause entry for table \"OLD\""
  -- (im Container reproduziert, bevor dieser Kommentar geschrieben wurde).
  IF "public"."user_owns_tournament"(OLD.tournament_id) THEN
    RETURN NEW;
  END IF;

  -- Nicht Eigentümer: einzig erlaubter Vorgang ist das Annehmen der EIGENEN, noch nicht
  -- angenommenen Einladung -- exakt das Spaltenmuster aus
  -- invitationService.ts#acceptInvitation (mapInvitationAcceptToSupabase): user_id,
  -- accepted_at, use_count. Alle anderen Spalten müssen unverändert bleiben.
  IF OLD.user_id IS NULL
     AND OLD.accepted_at IS NULL
     AND NEW.user_id = ( SELECT "auth"."uid"() )
     AND NEW.accepted_at IS NOT NULL
     AND NEW.id = OLD.id
     AND NEW.tournament_id = OLD.tournament_id
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
  'BEFORE-UPDATE-Schutz auf tournament_collaborators: Nicht-Eigentuemer duerfen ausschliesslich
   ihre eigene, offene Einladung annehmen (user_id, accepted_at, use_count) -- niemals role
   oder tournament_id aendern. Der Eigentuemer bleibt uneingeschraenkt.';

CREATE OR REPLACE TRIGGER "tournament_collaborators_protect_row"
  BEFORE UPDATE ON "public"."tournament_collaborators"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_collaborator_row"();
