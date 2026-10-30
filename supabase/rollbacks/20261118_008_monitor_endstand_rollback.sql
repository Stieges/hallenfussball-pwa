-- supabase/rollbacks/20261118_008_monitor_endstand_rollback.sql
-- RUECKWEG zu supabase/migrations/20261118_008_monitor_endstand.sql. Liegt bewusst NICHT in supabase/migrations (wird nie
-- nachgespielt). Erzeugt mit `bash scripts/monitor-endstand-check.sh --print-rueckweg`; belegt in
-- scripts/monitor-endstand-check.sh (Kategorie X: Schema danach = Stand vor der Migration).
-- Reihenfolge: ZUERST die App auf den Stand ohne diesen Client-Teil (sie ruft dann wieder display_final_standings(uuid)),
-- DANN dieser Block. Danach zeigt ein Monitor ohne Online-Teilen nach dem Abschluss keinen Endstand, und nach dem
-- Wiederoeffnen faellt er ins normale Programm zurueck (Befunde C-MONITOR-ENDSTAND-OHNE-TEILEN,
-- C-MONITOR-ENDSTAND-WIEDEROEFFNEN wieder offen). Keine Daten gehen verloren.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF to_regprocedure('public.display_final_standings(uuid,text)') IS NULL
     OR position('20261118_008' IN coalesce(obj_description(to_regprocedure('public.display_final_standings(uuid,text)'), 'pg_proc'), '')) = 0 THEN
    RAISE EXCEPTION 'Rueckweg 20261118_008: Monitor-Endstand nicht in der Fassung 20261118_008 -- nichts geaendert';
  END IF;
END
$rw$;
DROP FUNCTION public.display_final_standings(uuid, text);
COMMIT;
-- Danach: Assertion monitor-endstand-display-link + PRIVILEGE_ASSERTION_NAMES + pending_assertions_for zurueck, Drift-Check.
