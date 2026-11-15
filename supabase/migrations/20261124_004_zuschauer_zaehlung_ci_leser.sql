-- supabase/migrations/20261124_004_zuschauer_zaehlung_ci_leser.sql
-- Leserecht der Drift-Check-Rolle ci_schema_reader auf public.public_view_counts (Werkzeugkette, Kontext plattform; Folge
-- zu 20261124_003_zuschauer_zaehlung.sql, Muster: 20261110_007_ci_schema_reader_grants.sql).
--
-- Ursache: 20261124_003_zuschauer_zaehlung.sql legt public.public_view_counts an, vergibt aber kein SELECT an ci_schema_reader.
-- scripts/db-drift-check.sh zieht das Live-Schema per `pg_dump --schema=public --schema=match_engine --schema-only` als diese
-- Rolle; pg_dump sperrt jede Tabelle mit LOCK TABLE ... IN ACCESS SHARE MODE, das braucht SELECT. Seit 003 live ist, bricht der
-- Job "Compare live schema vs baseline migration (structural)" mit "pg_dump: error: query failed: ERROR: permission denied for
-- table public_view_counts" ab. Bewusst kein ALTER DEFAULT PRIVILEGES (Datenbank-Programm 21.09.): jede neue Tabelle bekommt
-- ihren GRANT ausdruecklich.
--
-- Inhalt: GRANT SELECT ON public.public_view_counts TO ci_schema_reader. Sonst nichts: keine Policy, kein INSERT/UPDATE/DELETE,
-- keine Aenderung an Tabelle oder Funktion. RLS bleibt an und die Tabelle hat keine Policy; ci_schema_reader ist laut
-- 20260924_002 (CREATE ROLE ... NOLOGIN, kein BYPASSRLS; Assertion helper-join-ci-schema-reader-no-bypassrls prueft das im
-- Repo-Stand) nicht RLS-befreit und sieht deshalb 0 Zeilen -- der GRANT sichert nur den Schema-Dump. anon/authenticated/PUBLIC
-- bleiben ohne Tabellenrecht (Assertion zuschauer-zaehlung-table-no-client-access und die Ausnahme in
-- lifecycle-guard-triggers-complete bleiben wahr).
--
-- Fail-fast ohne Aenderung, wenn die Rolle oder die Tabelle fehlt. Idempotent (GRANT ist wiederholbar). lock_timeout 5 s wie alle
-- Fenster-Dateien; bei 55P03 genau einmal wiederholen. Haengt nur an 20261124_003 (Tabelle) und 20260924_002 (Rolle).
--
-- RUECKWEG: supabase/rollbacks/20261124_004_zuschauer_zaehlung_ci_leser_rollback.sql (REVOKE SELECT ... FROM ci_schema_reader),
-- danach Assertion zuschauer-zaehlung-ci-schema-reader-select + PRIVILEGE_ASSERTION_NAMES + pending_assertions_for zurueck.
-- Achtung: ohne dieses Recht scheitert der Drift-Check live wieder an pg_dump.
-- Rein ASCII.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $pre$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ci_schema_reader') THEN
    RAISE EXCEPTION '20261124_004_zuschauer_zaehlung_ci_leser: Rolle ci_schema_reader fehlt -- zuerst 20260924_002 einspielen';
  END IF;
  IF to_regclass('public.public_view_counts') IS NULL THEN
    RAISE EXCEPTION '20261124_004_zuschauer_zaehlung_ci_leser: Tabelle public.public_view_counts fehlt -- zuerst 20261124_003 einspielen';
  END IF;
END
$pre$;

GRANT SELECT ON TABLE public.public_view_counts TO ci_schema_reader;

COMMIT;
