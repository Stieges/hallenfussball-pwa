-- supabase/migrations/20261110_007_ci_schema_reader_grants.sql
-- Leserecht der Drift-Check-Rolle ci_schema_reader auf public.field_control (Werkzeugkette, Kontext plattform;
-- Daniel-Freigabe 21.10.: "GRANT SELECT ON public.field_control TO ci_schema_reader" ins naechste DB-Fenster).
--
-- Ursache: 20261110_003_field_control.sql (A-34, live seit dem DB-Fenster 20.10.) legt public.field_control an,
-- vergibt aber kein SELECT an ci_schema_reader. scripts/db-drift-check.sh zieht das Live-Schema per
-- `pg_dump --schema=public --schema=match_engine --schema-only` als diese Rolle; pg_dump sperrt jede Tabelle mit
-- LOCK TABLE ... IN ACCESS SHARE MODE, das braucht SELECT. Seit dem Fenster bricht der Job schema-drift-check mit
-- "permission denied for table field_control" ab. Bewusst kein ALTER DEFAULT PRIVILEGES (Datenbank-Programm
-- 21.09.): jede neue Tabelle bekommt ihren GRANT ausdruecklich, wie match_event_authors (20260928_001, I1).
--
-- Vollstaendig geprueft (Wegwerf-Container, Baseline + alle Migrationen auf origin/main): field_control ist die
-- EINZIGE Tabelle in public/match_engine ohne SELECT fuer ci_schema_reader. Sequenzen und Funktionen braucht
-- pg_dump --schema-only (PG 17) nicht lesbar; Views gibt es in beiden Schemata keine.
--
-- Inhalt: nur GRANT SELECT ON public.field_control TO ci_schema_reader. Keine Policy: RLS bleibt an, fuer
-- ci_schema_reader greift keine Policy, sie sieht weiterhin 0 Zeilen -- der GRANT sichert nur den Schema-Dump.
-- anon/authenticated bleiben ohne Tabellenrecht (Assertion field-control-no-client-access unveraendert).
-- Fail-fast ohne Aenderung, wenn die Rolle oder die Tabelle fehlt. Idempotent (GRANT ist wiederholbar).
-- lock_timeout 5 s wie alle Fenster-Dateien (GRANT nimmt kurz eine Sperre auf den Katalogeintrag); bei 55P03
-- genau einmal wiederholen.
--
-- Haengt nur an 20261110_003 (Tabelle) und 20260924_002 (Rolle); unabhaengig von 20261110_005/_006 und
-- 20261113_101 (andere Branches, eigene Auflagen fuer deren neue Tabellen).
--
-- RUECKWEG (Anhang B von ci-grants-sql-freigabe.md): in EINEM Block
--   REVOKE SELECT ON public.field_control FROM ci_schema_reader;
-- danach Assertion positive-ci-schema-reader-select-field-control + PRIVILEGE_ASSERTION_NAMES +
-- pending_assertions_for zurueck. Schema und Rechte sind danach identisch zum Stand vorher (im Container belegt).

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ci_schema_reader') THEN
    RAISE EXCEPTION '20261110_007_ci_schema_reader_grants: Rolle ci_schema_reader fehlt -- zuerst 20260924_002 einspielen';
  END IF;
  IF to_regclass('public.field_control') IS NULL THEN
    RAISE EXCEPTION '20261110_007_ci_schema_reader_grants: Tabelle public.field_control fehlt -- zuerst 20261110_003 einspielen';
  END IF;
END
$$;

GRANT SELECT ON TABLE public.field_control TO ci_schema_reader;

COMMIT;
