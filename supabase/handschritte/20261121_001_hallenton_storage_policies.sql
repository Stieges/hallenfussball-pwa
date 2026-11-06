-- supabase/handschritte/20261121_001_hallenton_storage_policies.sql
-- HANDSCHRITT zu supabase/migrations/20261121_001_hallenton.sql (Hallenton, eigener Ton, @HT-022/@HT-027/@HT-028/@HT-046).
-- Liegt bewusst NICHT in supabase/migrations: wird nie automatisch nachgespielt.
--
-- Warum ein Handschritt: storage.objects gehoert live supabase_storage_admin; die Rolle postgres (Migrationen) ist nicht
--   Mitglied (Live-Pruefung 06.11.: pg_has_role('postgres', owner, 'USAGE') = false). CREATE POLICY auf storage.objects
--   scheitert deshalb in einer Migration („must be owner of table objects“). Die bisherigen 9 Policies auf storage.objects
--   (Logos, Sponsoren, Exporte) sind ebenso im Dashboard entstanden.
-- Ohne diese Policies ist der Bucket sicher: keine Policy = Hochladen, Auflisten und Loeschen fuer authenticated und anon
--   verweigert. Lesen geht nur ueber die oeffentliche Adresse mit dem vollen, nicht erratbaren Namen.
--
-- Wie: NACH der Migration (sie legt Bucket hallenton-sounds und die Hilfe public.hall_sound_object_allowed an).
--   Weg A: Dashboard → SQL-Editor, diesen Block ausfuehren. Meldet er „must be owner“, Weg B nehmen.
--   Weg B: Dashboard → Storage → Policies → Bucket hallenton-sounds → „New policy“ → „For full customization“, je Policy
--          Name, Befehl, Rolle „authenticated“ und den Ausdruck aus dem Block unten 1:1 uebernehmen (nur den Teil in
--          den Klammern hinter USING bzw. WITH CHECK). KEINE Policy fuer UPDATE anlegen.
--
-- Pruefung danach (nur lesend, Dashboard-SQL-Editor; erwartet genau 3 Zeilen, Wortlaut wie im Kommentar):
--   SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
--    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'hallenton\_%' ORDER BY policyname;
--   hallenton_sounds_delete | DELETE | {authenticated} | ((bucket_id = 'hallenton-sounds'::text) AND hall_sound_object_allowed(name, 'delete'::text)) |
--   hallenton_sounds_insert | INSERT | {authenticated} |  | ((bucket_id = 'hallenton-sounds'::text) AND hall_sound_object_allowed(name, 'insert'::text))
--   hallenton_sounds_select | SELECT | {authenticated} | ((bucket_id = 'hallenton-sounds'::text) AND hall_sound_object_allowed(name, 'select'::text)) |
--   Danach die Assertion hallenton-storage-policies-present (scripts/db_privilege_assertions.sql) im Drift-Check: |t.
--   Ebenfalls lesend: SELECT rolbypassrls FROM pg_roles WHERE rolname = 'postgres';  -- muss t sein, sonst zaehlt die
--   Grenze von 10 Dateien unter RLS (dann Daniel fragen).
--
-- Loeschen eines Turniers: Storage kaskadiert nicht. Die Delete-Policy erlaubt Turnierleitung/Co-Admin das Loeschen der
--   Dateien <tid>/* auch im Papierkorb (nur noch Auflisten und Loeschen, kein Hochladen). Die App entfernt sie beim Loeschen des
--   Turniers ueber die Storage-Schnittstelle (list + remove). Ohne App (Turnier endgueltig geloescht): Dashboard →
--   Storage → hallenton-sounds → Ordner <tid> loeschen. Uebrige Dateien findet:
--   SELECT split_part(name, '/', 1) AS tid, count(*) FROM storage.objects o WHERE o.bucket_id = 'hallenton-sounds'
--     AND NOT EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id::text = split_part(o.name, '/', 1)) GROUP BY 1;
--
-- Rueckweg (VOR dem Rueckweg der Migration, sonst bricht dieser ab): Dashboard → SQL-Editor bzw. Storage-Policy-UI:
--   DROP POLICY IF EXISTS hallenton_sounds_insert ON storage.objects;
--   DROP POLICY IF EXISTS hallenton_sounds_select ON storage.objects;
--   DROP POLICY IF EXISTS hallenton_sounds_delete ON storage.objects;
--
-- Lokal belegt: scripts/hallenton-check.sh spielt diese Datei nach der Migration als Storage-Eigentuemer ein und prueft
--   alle Rollen (Hochladen, Auflisten, Loeschen, Pfad, 10 Dateien, kein Ueberschreiben, nach dem Turnierende).
BEGIN;
DROP POLICY IF EXISTS hallenton_sounds_insert ON storage.objects;
DROP POLICY IF EXISTS hallenton_sounds_select ON storage.objects;
DROP POLICY IF EXISTS hallenton_sounds_delete ON storage.objects;
CREATE POLICY hallenton_sounds_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hallenton-sounds' AND public.hall_sound_object_allowed(name, 'insert'));
CREATE POLICY hallenton_sounds_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hallenton-sounds' AND public.hall_sound_object_allowed(name, 'select'));
CREATE POLICY hallenton_sounds_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hallenton-sounds' AND public.hall_sound_object_allowed(name, 'delete'));
-- Bewusst KEINE UPDATE-Policy: kein Ueberschreiben (auch kein upsert), kein Umbenennen/Verschieben.
COMMIT;
