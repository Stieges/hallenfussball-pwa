-- supabase/rollbacks/20261121_001_hallenton_rollback.sql
-- RUECKWEG zu supabase/migrations/20261121_001_hallenton.sql (Hallenton, Server-Teil). Liegt bewusst NICHT in
-- supabase/migrations (wird nie nachgespielt). Erzeugt mit `bash scripts/hallenton-check.sh --print-rueckweg`; belegt in
-- scripts/hallenton-check.sh (Kategorie X: Schema public danach = Stand vor der Migration, Storage-Policies weg).
-- Vorher: App auf den Stand ohne Hallenton-Client und den Rueckweg des Handschritts
-- supabase/handschritte/20261121_001_hallenton_storage_policies.sql (Policies weg, Dashboard). Wirkung: alle Zuordnungen, Lebenszeichen und die Tonwahl entfallen
-- (der Abpfiff-Ton config.matchCockpitSettings.soundId bleibt). Hochgeladene Dateien bleiben im Bucket; ist er leer,
-- entfaellt er, sonst bleibt er (Hinweis) und Daniel loescht die Dateien im Dashboard.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                AND policyname IN ('hallenton_sounds_insert', 'hallenton_sounds_select', 'hallenton_sounds_delete')) THEN
    RAISE EXCEPTION 'Rueckweg 20261121_001: zuerst die Storage-Policies hallenton_sounds_* entfernen (Rueckweg des Handschritts) -- nichts geaendert';
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    BEGIN
      DELETE FROM storage.buckets b
       WHERE b.id = 'hallenton-sounds'
         AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = b.id);
      IF EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = 'hallenton-sounds') THEN
        RAISE NOTICE 'Rueckweg 20261121_001: Bucket hallenton-sounds enthaelt Dateien und bleibt -- im Dashboard leeren und loeschen';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Rueckweg 20261121_001: Bucket hallenton-sounds nicht geloescht (%) -- im Dashboard loeschen', SQLERRM;
    END;
  END IF;
END
$rw$;
DROP FUNCTION IF EXISTS public.hall_sound_object_allowed(text, text);
DROP FUNCTION IF EXISTS public.hall_sound_purge_ended();
DROP FUNCTION IF EXISTS public.hall_output_heard(uuid, integer);
DROP FUNCTION IF EXISTS public.hall_sound_status(uuid, uuid);
DROP FUNCTION IF EXISTS public.hall_sound_settings_set(uuid, text, text, text, integer[]);
DROP FUNCTION IF EXISTS public.hall_test_tone_ack(uuid, integer, uuid, uuid);
DROP FUNCTION IF EXISTS public.hall_test_tone_request(uuid, integer);
DROP FUNCTION IF EXISTS public.hall_field_lead_heartbeat(uuid, integer, uuid);
DROP FUNCTION IF EXISTS public.hall_speaker_heartbeat(uuid, uuid, integer[], text, boolean);
DROP FUNCTION IF EXISTS public.hall_speaker_release(uuid, integer[], uuid);
DROP FUNCTION IF EXISTS public.hall_speaker_assign(uuid, integer[], uuid, text, boolean);
DROP FUNCTION IF EXISTS public.hall_require_open(uuid);
DROP FUNCTION IF EXISTS public.hall_require(uuid, text);
DROP FUNCTION IF EXISTS public.hall_checked_fields(uuid, integer[]);
DROP FUNCTION IF EXISTS public.hall_ms(timestamptz);
DROP TABLE IF EXISTS public.hall_speakers;
DROP TABLE IF EXISTS public.hall_field_leads;
DROP TABLE IF EXISTS public.hall_sound_settings;
COMMIT;
