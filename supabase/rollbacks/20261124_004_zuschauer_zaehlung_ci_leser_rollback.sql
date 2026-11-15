-- supabase/rollbacks/20261124_004_zuschauer_zaehlung_ci_leser_rollback.sql
-- RUECKWEG zu supabase/migrations/20261124_004_zuschauer_zaehlung_ci_leser.sql. Liegt bewusst NICHT in supabase/migrations (wird nie
-- nachgespielt); belegt in scripts/zuschauer-zaehlung-check.sh. EIN Block. Nimmt nur das Leserecht zurueck; Tabelle und Daten
-- bleiben. Laeuft auch, wenn der Rueckweg von 20261124_003 schon gelaufen ist (Tabelle weg -> nichts zu tun) oder die Rolle fehlt.
-- Ohne das Recht scheitert der Drift-Check live an pg_dump (permission denied for table public_view_counts).
-- Rein ASCII.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rb$
BEGIN
  IF to_regclass('public.public_view_counts') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ci_schema_reader') THEN
    REVOKE SELECT ON TABLE public.public_view_counts FROM ci_schema_reader;
  END IF;
END
$rb$;
COMMIT;
