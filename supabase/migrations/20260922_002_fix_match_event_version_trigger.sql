-- match_events: kaputten Versions-Trigger reparieren.
--
-- Ursache: increment_match_event_version() (BEFORE UPDATE FOR EACH ROW auf match_events,
-- via match_event_version_trigger) setzt unbedingt "NEW.updated_at := NOW();". Die Tabelle
-- match_events hat aber KEINE updated_at-Spalte (nur created_at und version — siehe
-- 00000000000000_baseline_live_schema.sql, CREATE TABLE "public"."match_events"). Jedes
-- UPDATE auf match_events — Korrektur eines Ereignisses genauso wie der Soft-Delete
-- (UPDATE ... SET is_deleted = true, siehe SupabaseLiveMatchRepository.deleteEvent) —
-- scheitert deshalb mit:
--   ERROR: record "new" has no field "updated_at"
--   CONTEXT: PL/pgSQL assignment "NEW.updated_at := NOW()"
--   PL/pgSQL function increment_match_event_version() line 6 at assignment
--
-- Das ist unabhängig von Rolle oder RLS — reproduziert auch mit dem Postgres-Superuser
-- (RLS-Bypass, aber Trigger feuern trotzdem) und wurde vom Controller an der Live-Datenbank
-- verifiziert: match_events hat dort tatsächlich kein updated_at, der Trigger läuft trotzdem
-- BEFORE UPDATE. Jede Bearbeitung UND jedes Löschen (Soft-Delete) eines Ereignisses scheitert
-- damit heute live, für JEDEN Nutzer, auch den Eigentümer — unabhängig von der
-- rollenbasierten RLS-Reparatur aus 20260922_001_role_based_write_policies.sql. Ohne diesen
-- Fix bliebe das Kernversprechen von R1 (Helfer kann ein Ereignis korrigieren/löschen) tot,
-- selbst für den Eigentümer.
--
-- Fix: die fehlerhafte Zeile entfernen, sonst nichts. KEINE Schemaänderung (keine Spalte
-- hinzugefügt — match_events bekommt bewusst kein updated_at, das wäre eine andere
-- Entscheidung mit eigener Migration und TypeScript-Typ-Regenerierung). Das Hochzählen von
-- version bleibt unverändert (das ist die eigentliche Aufgabe dieses Triggers). Signatur,
-- Sprache und search_path bleiben identisch zur Baseline — CREATE OR REPLACE ersetzt nur den
-- Funktionskörper.

CREATE OR REPLACE FUNCTION "public"."increment_match_event_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;
