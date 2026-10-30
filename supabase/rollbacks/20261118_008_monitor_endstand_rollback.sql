-- supabase/rollbacks/20261118_008_monitor_endstand_rollback.sql
-- RUECKWEG zu supabase/migrations/20261118_008_monitor_endstand.sql. Liegt bewusst NICHT in supabase/migrations (wird nie
-- nachgespielt). Erzeugt mit `bash scripts/monitor-endstand-check.sh --print-rueckweg`; belegt in
-- scripts/monitor-endstand-check.sh (Kategorie X: Schema danach = Stand vor der Migration).
-- Reihenfolge: ZUERST die App auf den Stand ohne diesen Client-Teil (sie ruft dann wieder display_final_standings(uuid)),
-- DANN dieser Block. Danach zeigt ein Monitor ohne Online-Teilen nach dem Abschluss keinen Endstand, und nach dem
-- Wiederoeffnen fallen Monitor und Zuschauer-Seite in die laufende Ansicht zurueck (Befunde C-MONITOR-ENDSTAND-OHNE-TEILEN,
-- C-MONITOR-ENDSTAND-WIEDEROEFFNEN, @LZ-077 Z. 2 wieder offen). Keine Daten gehen verloren.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF to_regprocedure('public.display_final_standings(uuid,text)') IS NULL
     OR position('20261118_008' IN coalesce(obj_description(to_regprocedure('public.display_final_standings(uuid,text)'), 'pg_proc'), '')) = 0
     OR position('20261118_008 (B)' IN coalesce((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.public_final_standings(text)')), '')) = 0 THEN
    RAISE EXCEPTION 'Rueckweg 20261118_008: Monitor-Endstand nicht in der Fassung 20261118_008 -- nichts geaendert';
  END IF;
END
$rw$;
-- public_final_standings woertlich aus 20261113_003_tournament_lifecycle.sql
CREATE OR REPLACE FUNCTION public.public_final_standings(p_share_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments;
BEGIN
  IF p_share_code IS NULL OR char_length(p_share_code) > 20 THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  SELECT * INTO v_t FROM public.tournaments t
   WHERE t.share_code = p_share_code AND coalesce(t.is_public, false) AND t.deleted_at IS NULL;
  RETURN match_engine.final_standings_payload(v_t);
END;
$$;
REVOKE ALL ON FUNCTION public.public_final_standings(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_final_standings(text) TO anon, authenticated;
DROP FUNCTION public.display_final_standings(uuid, text);
COMMIT;
-- Danach: Assertion monitor-endstand-display-link + PRIVILEGE_ASSERTION_NAMES + pending_assertions_for zurueck, Drift-Check.
