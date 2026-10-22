-- ============================================================================================
-- 20261110_010 — Realtime-Publikation in die Migrationskette aufnehmen (Befund C-PUB)
-- ============================================================================================
--
-- Zweck: Die Baseline (00000000000000_baseline_live_schema.sql) enthaelt keine Anweisung, mit der
-- die Echtzeit-Freigabe in der Publikation supabase_realtime gesetzt wird. Diese Migration haelt
-- den Zustand fest, der live bereits gilt: match_events, matches, teams, monitor_heartbeats.
-- Befund: docs/anforderungen/BEFUNDE-HEUTIGER-CODE.md, Zeile C-PUB (Entscheidung Daniel:
-- Migration nachziehen, live ohne Wirkung).
--
-- Wirkung: LIVE NO-OP. Die vier Tabellen sind laut Live-Abfrage 2026-09-25 schon Mitglied der
-- Publikation. Der Block ergaenzt nur fehlende Tabellen; ist die Publikation nicht vorhanden,
-- geschieht nichts und es entsteht kein Fehler.
--
-- Rueckweg: bewusst KEIN Entfernen aus der Publikation. Ein DROP wuerde die Echtzeit-Freigabe
-- live zerstoeren. Der Rueckweg ist ein No-op mit Begruendung:
-- .superpowers/sdd/2026-10-03-mvp-bauplan/kb6-rueckweg.sql
--
-- Einspielung: NICHT vor dem DB-Fenster G1b und ohne Freigabe durch Daniel (siehe
-- .superpowers/sdd/2026-10-03-mvp-bauplan/kb6-sql-freigabe.md). Pruefung ohne Live-Zugriff:
-- scripts/realtime-publication-check.sh
-- ============================================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY['match_events', 'matches', 'teams', 'monitor_heartbeats']
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END LOOP;
  END IF;
END;
$$;

COMMIT;
