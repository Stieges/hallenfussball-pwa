-- supabase/rollbacks/20261118_006_monitor_aenderungssignal_rollback.sql
-- RUECKWEG zu supabase/migrations/20261118_006_monitor_aenderungssignal.sql (R5 PR 1, Sofort-Kanal). Liegt bewusst NICHT in
-- supabase/migrations (wird nie nachgespielt). Erzeugt mit `bash scripts/monitor-signal-check.sh --print-rueckweg`; belegt
-- in scripts/monitor-signal-check.sh (Kategorie X: Schema danach = Stand vor der Migration).
-- Danach sendet die Datenbank kein Aenderungssignal mehr; Monitore holen den Stand wieder nur im Rueckfall-Takt (2 s).
-- Die App muss dafuer NICHT zurueckgesetzt werden. Keine Daten gehen verloren.
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP TRIGGER IF EXISTS matches_signal_display_insert ON public.matches;
DROP TRIGGER IF EXISTS matches_signal_display_update ON public.matches;
DROP TRIGGER IF EXISTS matches_signal_display_delete ON public.matches;
DROP TRIGGER IF EXISTS teams_signal_display_insert ON public.teams;
DROP TRIGGER IF EXISTS teams_signal_display_update ON public.teams;
DROP TRIGGER IF EXISTS teams_signal_display_delete ON public.teams;
DROP TRIGGER IF EXISTS tournaments_signal_display_update ON public.tournaments;
DROP FUNCTION IF EXISTS public.monitor_display_signal();
COMMIT;
-- Danach: Assertions monitor-signal-* in scripts/db_privilege_assertions.sql + PRIVILEGE_ASSERTION_NAMES +
-- pending_assertions_for in scripts/db-drift-check.sh zuruecknehmen, Drift-Check.
