-- supabase/migrations/20261121_001_hallenton.sql
-- Hallenton – Server-Teil (Plan „Paket Hallenton“ H2, Task 5). Record docs/anforderungen/2026-10-15_hallenton.md,
-- Regeln 1–4. Szenarien (Server-Teil): @HT-001, @HT-002, @HT-015, @HT-016, @HT-017, @HT-022, @HT-025, @HT-026, @HT-027,
--   @HT-028, @HT-038, @HT-039, @HT-040, @HT-042, @HT-044, @HT-046, @HT-047 (Server-Teil); Lebenszeichen des leitenden Geraets fuer „Handy ohne Netz“
--   (@HT-034/@HT-035/@HT-036, Server liefert nur das Alter); Testton ohne Sperre bei laufendem Spiel (@HT-017 Z. 5: die
--   Rueckfrage ist Sache der Oberflaeche); @HT-024 nur die Einstellung „Ton bei Tor“ je Feld.
--
-- Inhalt:
--   1. Tabelle public.hall_speakers (tournament_id, field_id): je Feld genau ein Hallen-Lautsprecher (Regel 1) mit
--      Geraete-Kennung, Geraetename (1–60 Zeichen, kein Browser-Kennzeichen), letztem Lebenszeichen (Serverzeit), Zustand
--      aus fester Liste (CHECK) und dem letzten Testton (Kennung, Serverzeit der Anforderung, Quittung). Ein neues Geraet
--      loest das alte ab (Zeile wird ueberschrieben, das alte Geraet bekommt beim naechsten Lebenszeichen „superseded“).
--   2. Tabelle public.hall_field_leads (tournament_id, field_id): letztes Lebenszeichen des Geraets, das das Feld leitet
--      (Steuer je Feld, public.field_control). Daraus „Feld 1: Handy ohne Netz“ (Alter rechnet der Server).
--   3. Tabelle public.hall_sound_settings (tournament_id): Tonwahl je Turnier – Halbzeit-Ton (Vorbelegung 'horn-1'),
--      Pfade eigener Toene fuer Halbzeit und Abpfiff, Felder mit „Ton bei Tor“ (vorbelegt aus). Der Abpfiff-Ton selbst
--      bleibt config.matchCockpitSettings.soundId (unveraendert); steht er auf 'custom', gilt end_custom_path.
--   4. RPCs (SECURITY DEFINER, search_path fest, EXECUTE nur authenticated, ausdruecklich NICHT anon/PUBLIC/service_role):
--        hall_speaker_assign(tid, fields[], device_id, device_name, replace)   manageScreens
--        hall_speaker_release(tid, fields[], device_id)                        manageScreens
--        hall_speaker_heartbeat(tid, device_id, fields[], state)               manageScreens, nur zugeordnetes Geraet
--        hall_field_lead_heartbeat(tid, field, device_id)                      writeMatchData UND Steuer des Felds
--        hall_test_tone_request(tid, field)                                    manageScreens, hoechstens 1 je 3 s und Feld
--        hall_test_tone_ack(tid, field, device_id, test_id)                    manageScreens, nur zugeordnetes Geraet
--        hall_sound_settings_set(tid, halftime, halftime_path, end_path, goal_fields[])  manageScreens
--        hall_output_heard(tid, field)                                         manageScreens, „Gehört“ (@HT-049)
--        hall_sound_status(tid, device_id)            manageScreens: alles; nur writeMatchData: Zustand/Alter/Hinweis je Feld
--      Nach dem Turnierende (tournament_is_closed: finished/cancelled, @HT-046) lehnen die AENDERNDEN Wege ab
--      (55000 TOURNAMENT_FINISHED): Zuordnen/Abloesen, Tonwahl, Testton ausloesen, Hochladen/Loeschen eigener Ton. Lesen,
--      Lebenszeichen, Lebenszeichen der Leitung, Quittung und Ausschalten bleiben erlaubt (Status bleibt sichtbar).
--      Hinweis „Prüfen“ (@HT-047): das Lebenszeichen meldet ein Anzeichen (p_output_changed) -- nur drei Anlaesse,
--      erkannt am Geraet: Ausgabe-Verzoegerung springt um mehr als 50 ms, Browser meldet geaenderte Geraete, Ton-Ausgabe
--      ohne Zutun unterbrochen (Neuladen/Verdecken zaehlen nicht). Der Server setzt output_hint_at (Serverzeit), kein
--      freier Text. outputHint gilt, bis jemand mit manageScreens „Gehört“ waehlt (hall_output_heard, @HT-049, loescht
--      das Anzeichen) oder ein neues Geraet ablöst -- ein gespielter Testton allein nimmt ihn NICHT weg (die Pille
--      „Gespielt 14:02 – Gehört / Nicht gehört“ bleibt stehen, bis Olli antwortet, @HT-049/@HT-050). Den Hinweis sieht auch das Cockpit des Felds
--      (writeMatchData, @HT-050), ohne Geraetedaten. @HT-048 ist entfallen, der Server baut dafuer nichts.
--      Ein offener Testton geht nur an den Lautsprecher, solange er juenger als 10 s ist.
--      Alle Zeitangaben in den Antworten rechnet der Server (serverNow, ageMs) – die Uhr des Geraets zaehlt nie (@HT-042).
--      Kein Realtime-Kanal: der Testton erreicht den Lautsprecher ueber die Antwort auf sein Lebenszeichen (@HT-044:
--      auf einem oeffentlichen Kanal koennte jeder senden).
--   5. Eigener Ton (Storage, nur wenn das Schema storage.buckets/objects existiert – im reinen Postgres-Container der
--      Pruefskripte fehlt es, dann NOTICE und nichts): Bucket 'hallenton-sounds' (oeffentlich lesbar nur ueber den
--      vollen, nicht erratbaren Namen; ≤ 1 MB; MP3/WAV), Pfad <tid>/<uuid>.mp3|wav, Policy-Hilfe
--      hall_sound_object_allowed. Die drei Policies auf storage.objects (INSERT/SELECT/DELETE nur mit manageScreens,
--      INSERT hoechstens 10 Dateien je Turnier, Hochladen/Loeschen nicht nach dem Turnierende, KEIN UPDATE) sind ein
--      HANDSCHRITT nach dieser Migration: supabase/handschritte/20261121_001_hallenton_storage_policies.sql (live gehoert
--      storage.objects supabase_storage_admin, postgres darf dort keine Policy anlegen). Bis dahin verweigert der Bucket
--      jeden Zugriff ausser dem Lesen ueber die oeffentliche Adresse.
--   Loeschen des Turniers: Zeilen in hall_* kaskadieren (FK), Dateien im Bucket NICHT. Die App loescht beim Loeschen
--   des Turniers (Papierkorb) die Dateien <tid>/* ueber die Storage-Schnittstelle (list + remove; im Papierkorb erlauben
--   die Policies nur noch Auflisten und Loeschen). Vor einem endgueltigen Loeschen ohne App: Dashboard → Storage → hallenton-sounds →
--   Ordner <tid> loeschen. Kein Zeitplan-Job (Daniel 06.11.: zuerst Datenuebersicht).
--   6. public.hall_sound_purge_ended() (ohne EXECUTE fuer Client-Rollen): loescht Lautsprecher- und Lebenszeichen-Zeilen
--      (Geraetename, Zeitpunkt, Grund) von Turnieren, die seit mehr als 1 Tag beendet, abgebrochen oder geloescht sind
--      (DSGVO Art. 5 Abs. 1 lit. e). Wann und wie oft sie laeuft, legt Daniel fest (offener Punkt im Record).
--
-- Rechte: neue Tabellen RLS an, KEINE Policy, keine Tabellenrechte fuer PUBLIC/anon/authenticated (nur die
--   Definer-Funktionen lesen/schreiben); SELECT fuer ci_schema_reader (nur pg_dump des Drift-Checks, RLS: 0 Zeilen).
--   Helfer, Helfer-Zugang, Bildschirm, Mitarbeiter ohne manageScreens: weder Lautsprecher bestimmen, noch Lebenszeichen
--   „bereit“, noch Testton, noch Tonwahl, noch Hochladen (@HT-022, @HT-044). Anon hat auf keine Funktion EXECUTE.
-- Voraussetzungen (Fail-fast): has_tournament_permission + is_real_account (20261110_002), field_control (20261110_003),
--   tournaments.finished_at/lifecycle_status + tournament_is_closed (20261113_003), Rolle ci_schema_reader.
-- Fehlercodes: nur Standard-SQLSTATE (42501, 22023, 55000), keine HF-Codes.
-- Bestandsdaten: keine. Idempotent: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE, ON CONFLICT.
--
-- RUECKWEG: supabase/rollbacks/20261121_001_hallenton_rollback.sql (erzeugt mit
--   `bash scripts/hallenton-check.sh --print-rueckweg`, belegt dort in Kategorie X: Schema danach = vorher). Vorher die
--   App auf den Stand ohne Hallenton-Client (sonst meldet der Unterpunkt „nicht erreichbar“). Der Rueckweg loescht alle
--   Zuordnungen, Lebenszeichen und die Tonwahl; hochgeladene Dateien im Bucket bleiben liegen, bis Daniel sie im
--   Dashboard loescht (der Rueckweg entfernt den Bucket, wenn er leer ist). Reihenfolge: ZUERST den Rueckweg des
--   Handschritts (Policies weg, Dashboard), dann diese Datei -- sonst bricht sie ab (Policies haengen an
--   hall_sound_object_allowed).
--
-- Produktion: nur nach Daniels Freigabe (SQL + SHA). Dieser Branch spielt nichts ein. Typen-PR noetig (neue RPCs).
-- Einspiel-Reihenfolge: 1. diese Migration, 2. Handschritt supabase/handschritte/20261121_001_hallenton_storage_policies.sql
--   im Dashboard, 3. Pruefung (Abfragen im Kopf des Handschritts, Assertions hallenton-* im Drift-Check).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR to_regprocedure('public.is_real_account()') IS NULL THEN
    RAISE EXCEPTION '20261121_001_hallenton: has_tournament_permission/is_real_account fehlen -- zuerst 20261110_002 einspielen';
  END IF;
  IF to_regprocedure('public.tournament_is_closed(uuid)') IS NULL THEN
    RAISE EXCEPTION '20261121_001_hallenton: tournament_is_closed fehlt -- zuerst 20261113_003 einspielen';
  END IF;
  IF to_regclass('public.field_control') IS NULL THEN
    RAISE EXCEPTION '20261121_001_hallenton: field_control fehlt -- zuerst 20261110_003 einspielen';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tournaments'
         AND column_name IN ('finished_at', 'lifecycle_status', 'number_of_fields', 'deleted_at')) <> 4 THEN
    RAISE EXCEPTION '20261121_001_hallenton: tournaments.finished_at/lifecycle_status fehlen -- zuerst 20261113_003 einspielen';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ci_schema_reader') THEN
    RAISE EXCEPTION '20261121_001_hallenton: Rolle ci_schema_reader fehlt';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Tabellen
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hall_speakers (
  tournament_id     uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  field_id          integer     NOT NULL,
  device_id         uuid        NOT NULL,
  device_name       text        NOT NULL,
  assigned_at       timestamptz NOT NULL DEFAULT now(),
  state             text,
  last_seen         timestamptz,
  test_id           uuid,
  test_requested_at timestamptz,
  test_played_at    timestamptz,
  output_hint_at    timestamptz,
  PRIMARY KEY (tournament_id, field_id),
  CONSTRAINT hall_speakers_field_range CHECK (field_id BETWEEN 1 AND 99),
  CONSTRAINT hall_speakers_device_name_form CHECK (char_length(device_name) BETWEEN 1 AND 60 AND device_name = btrim(device_name)),
  CONSTRAINT hall_speakers_state_check CHECK (state IS NULL OR state IN
    ('ready', 'not_activated', 'background', 'slept', 'custom_sound_failed', 'volume_zero')),
  CONSTRAINT hall_speakers_test_form CHECK ((test_id IS NULL) = (test_requested_at IS NULL)
                                            AND (test_played_at IS NULL OR test_id IS NOT NULL))
);
COMMENT ON TABLE public.hall_speakers IS
  'Hallenton (Regel 1, @HT-001/@HT-015): je Feld genau ein Hallen-Lautsprecher. state NULL = noch kein Lebenszeichen.
   Personenbezug minimal (Geraetename, Zeitpunkt, Grund; kein Browser-Kennzeichen), Loeschen nach Turnierende ueber
   hall_sound_purge_ended(). Nur ueber die Definer-Funktionen hall_* -- keine Client-Rechte.';
COMMENT ON COLUMN public.hall_speakers.state IS
  'Zustand aus dem letzten Lebenszeichen: ready | not_activated (Ton nicht aktiviert) | background (Hintergrund) | slept
   (vom Browser schlafen gelegt) | custom_sound_failed (eigener Ton nicht geladen, spielt Hupe 1) | volume_zero
   (Lautstaerke 0 %). „meldet sich nicht“ ergibt sich aus dem Alter von last_seen (Server), „keine Verbindung“ zeigt nur
   das Geraet selbst.';
COMMENT ON COLUMN public.hall_speakers.output_hint_at IS
  'Serverzeit des letzten Anzeichens eines Wechsels des Audio-Ausgangs (@HT-047: Ausgabe-Verzoegerung springt > 50 ms,
   Browser meldet geaenderte Geraete, Ton-Ausgabe ohne Zutun unterbrochen). Hinweis gilt, bis „Gehört“ gewaehlt wurde
   (hall_output_heard setzt NULL, @HT-049) oder ein neues Geraet abloest; ein gespielter Testton allein loescht ihn nicht.';

CREATE TABLE IF NOT EXISTS public.hall_field_leads (
  tournament_id uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  field_id      integer     NOT NULL,
  device_id     uuid        NOT NULL,
  last_seen     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, field_id),
  CONSTRAINT hall_field_leads_field_range CHECK (field_id BETWEEN 1 AND 99)
);
COMMENT ON TABLE public.hall_field_leads IS
  'Hallenton (@HT-034/@HT-035): letztes Lebenszeichen (Serverzeit) des Geraets, das das Feld leitet (field_control).
   Kein Konto, kein Name. Loeschen nach Turnierende ueber hall_sound_purge_ended().';

CREATE TABLE IF NOT EXISTS public.hall_sound_settings (
  tournament_id        uuid        PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  halftime_sound       text        NOT NULL DEFAULT 'horn-1',
  halftime_custom_path text,
  end_custom_path      text,
  goal_tone_fields     integer[]   NOT NULL DEFAULT '{}',
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hall_sound_settings_halftime_check CHECK (halftime_sound IN ('horn-1', 'horn-2', 'horn-3', 'custom')),
  CONSTRAINT hall_sound_settings_halftime_custom CHECK (halftime_sound <> 'custom' OR halftime_custom_path IS NOT NULL),
  CONSTRAINT hall_sound_settings_path_form CHECK (
    (halftime_custom_path IS NULL OR halftime_custom_path ~ ('^' || tournament_id::text
       || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|wav)$'))
    AND (end_custom_path IS NULL OR end_custom_path ~ ('^' || tournament_id::text
       || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|wav)$'))),
  CONSTRAINT hall_sound_settings_goal_fields CHECK (array_position(goal_tone_fields, NULL) IS NULL
                                                    AND 0 < ALL (goal_tone_fields) AND 100 > ALL (goal_tone_fields))
);
COMMENT ON TABLE public.hall_sound_settings IS
  'Hallenton (@HT-025/@HT-027/@HT-024): Tonwahl je Turnier. Ohne Zeile gilt die Vorbelegung (Halbzeit horn-1, kein
   eigener Ton, Ton bei Tor aus). Der Abpfiff-Ton bleibt config.matchCockpitSettings.soundId; end_custom_path gilt, wenn
   soundId = custom. Pfade: <tournament_id>/<uuid>.mp3|wav im Bucket hallenton-sounds.';

ALTER TABLE public.hall_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hall_field_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hall_sound_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hall_speakers, public.hall_field_leads, public.hall_sound_settings
  FROM PUBLIC, anon, authenticated, ci_schema_reader;
GRANT SELECT ON TABLE public.hall_speakers, public.hall_field_leads, public.hall_sound_settings
  TO ci_schema_reader;  -- nur pg_dump des Drift-Checks; RLS an, keine Policy: 0 Zeilen

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Interne Hilfen (ohne EXECUTE fuer Client-Rollen)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hall_ms(p_ts timestamptz) RETURNS bigint
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT floor(extract(epoch FROM p_ts) * 1000)::bigint;
$$;

-- Felder pruefen und normalisieren (sortiert, ohne Doppel). 22023 bei leerer Liste, NULL-Eintrag, Feld ausserhalb
-- 1..number_of_fields oder mehr als 16 Feldern.
CREATE OR REPLACE FUNCTION public.hall_checked_fields(p_tournament_id uuid, p_fields integer[]) RETURNS integer[]
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_out integer[];
BEGIN
  IF p_fields IS NULL OR cardinality(p_fields) = 0 OR cardinality(p_fields) > 16
     OR array_position(p_fields, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'hallenton: fields invalid' USING ERRCODE = '22023';
  END IF;
  SELECT t.number_of_fields INTO v_count FROM public.tournaments t WHERE t.id = p_tournament_id;
  IF EXISTS (SELECT 1 FROM unnest(p_fields) f WHERE f < 1 OR f > coalesce(v_count, 0)) THEN
    RAISE EXCEPTION 'hallenton: field out of range' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(DISTINCT f ORDER BY f) INTO v_out FROM unnest(p_fields) f;
  RETURN v_out;
END;
$$;

-- Recht pruefen: Turnier vorhanden, nicht im Papierkorb, Recht vorhanden -- sonst 42501 (gleiche Meldung fuer
-- „gibt es nicht“ und „darf nicht“).
CREATE OR REPLACE FUNCTION public.hall_require(p_tournament_id uuid, p_permission text) RETURNS void
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_tournament_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = p_tournament_id AND t.deleted_at IS NULL)
     OR NOT public.has_tournament_permission(p_tournament_id, p_permission) THEN
    RAISE EXCEPTION 'hallenton: not allowed' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Nach dem Turnierende (abgeschlossen oder abgebrochen) keine Aenderung mehr (@HT-046) -- gleiche Lesart und gleicher
-- Fehler wie guard_closed_tournament (55000 TOURNAMENT_FINISHED).
CREATE OR REPLACE FUNCTION public.hall_require_open(p_tournament_id uuid) RETURNS void
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.tournament_is_closed(p_tournament_id) THEN
    RAISE EXCEPTION 'TOURNAMENT_FINISHED: Turnier ist abgeschlossen (hallenton, Turnier %).', p_tournament_id
      USING ERRCODE = '55000';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.hall_require_open(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.hall_ms(timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.hall_checked_fields(uuid, integer[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.hall_require(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Lautsprecher bestimmen / ausschalten (@HT-001, @HT-002, @HT-015, @HT-026, @HT-038)
-- ---------------------------------------------------------------------------------------------------------------
-- Ein Feld mit einem anderen Geraet: ohne p_replace {status:'occupied', fields:[{field, deviceName}]} und nichts
-- geaendert (Rueckfrage „Ablösen?“, @HT-015); mit p_replace loest das neue Geraet das alte ab (Zustand, Lebenszeichen
-- und Testton beginnen neu). Dasselbe Geraet erneut: nur der Name wird aktualisiert.
CREATE OR REPLACE FUNCTION public.hall_speaker_assign(p_tournament_id uuid, p_fields integer[], p_device_id uuid,
                                                      p_device_name text, p_replace boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fields integer[];
  v_name text := btrim(coalesce(p_device_name, ''));
  v_occupied jsonb;
BEGIN
  PERFORM public.hall_require(p_tournament_id, 'manageScreens');
  PERFORM public.hall_require_open(p_tournament_id);
  IF p_device_id IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'hallenton: device invalid' USING ERRCODE = '22023';
  END IF;
  v_fields := public.hall_checked_fields(p_tournament_id, p_fields);
  PERFORM pg_advisory_xact_lock(hashtext('hallenton:' || p_tournament_id::text));

  SELECT jsonb_agg(jsonb_build_object('field', s.field_id, 'deviceName', s.device_name) ORDER BY s.field_id)
    INTO v_occupied
    FROM public.hall_speakers s
   WHERE s.tournament_id = p_tournament_id AND s.field_id = ANY (v_fields) AND s.device_id <> p_device_id;
  IF v_occupied IS NOT NULL AND NOT coalesce(p_replace, false) THEN
    RETURN jsonb_build_object('status', 'occupied', 'fields', v_occupied);
  END IF;

  INSERT INTO public.hall_speakers AS s (tournament_id, field_id, device_id, device_name)
  SELECT p_tournament_id, f, p_device_id, v_name FROM unnest(v_fields) f
  ON CONFLICT (tournament_id, field_id) DO UPDATE SET
    device_name       = EXCLUDED.device_name,
    device_id         = EXCLUDED.device_id,
    assigned_at       = CASE WHEN s.device_id = EXCLUDED.device_id THEN s.assigned_at ELSE now() END,
    state             = CASE WHEN s.device_id = EXCLUDED.device_id THEN s.state ELSE NULL END,
    last_seen         = CASE WHEN s.device_id = EXCLUDED.device_id THEN s.last_seen ELSE NULL END,
    test_id           = CASE WHEN s.device_id = EXCLUDED.device_id THEN s.test_id ELSE NULL END,
    test_requested_at = CASE WHEN s.device_id = EXCLUDED.device_id THEN s.test_requested_at ELSE NULL END,
    test_played_at    = CASE WHEN s.device_id = EXCLUDED.device_id THEN s.test_played_at ELSE NULL END,
    output_hint_at    = CASE WHEN s.device_id = EXCLUDED.device_id THEN s.output_hint_at ELSE NULL END;

  RETURN jsonb_build_object('status', 'assigned', 'fields', to_jsonb(v_fields),
                            'replaced', coalesce(v_occupied, '[]'::jsonb));
END;
$$;

-- Schalter aus auf diesem Geraet: nur die eigenen Zeilen (gleiche Geraete-Kennung) entfallen; danach ist das Feld ohne
-- Hallen-Lautsprecher (neutral, @HT-038 Z. 2).
CREATE OR REPLACE FUNCTION public.hall_speaker_release(p_tournament_id uuid, p_fields integer[], p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fields integer[];
  v_released integer[];
BEGIN
  PERFORM public.hall_require(p_tournament_id, 'manageScreens');
  IF p_device_id IS NULL THEN
    RAISE EXCEPTION 'hallenton: device invalid' USING ERRCODE = '22023';
  END IF;
  v_fields := public.hall_checked_fields(p_tournament_id, p_fields);
  PERFORM pg_advisory_xact_lock(hashtext('hallenton:' || p_tournament_id::text));
  WITH d AS (
    DELETE FROM public.hall_speakers s
     WHERE s.tournament_id = p_tournament_id AND s.field_id = ANY (v_fields) AND s.device_id = p_device_id
    RETURNING s.field_id)
  SELECT coalesce(array_agg(field_id ORDER BY field_id), '{}') INTO v_released FROM d;
  RETURN jsonb_build_object('status', 'released', 'fields', to_jsonb(v_released));
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Lebenszeichen des Lautsprechers (@HT-039, @HT-042, @HT-044) mit Testton und Leitungs-Alter in der Antwort
-- ---------------------------------------------------------------------------------------------------------------
-- Nimmt nur Felder an, denen p_device_id zugeordnet ist; sonst je Feld 'superseded' (anderes Geraet) bzw. 'unassigned'
-- (kein Lautsprecher mehr). Antwort je Feld: status, offener Testton {testId, ageMs} (nur juenger als 10 s), Leitung
-- {ageMs} -- Alter vom Server. p_output_changed = true: Anzeichen eines Ausgangswechsels (@HT-047), Server setzt die Zeit.
CREATE OR REPLACE FUNCTION public.hall_speaker_heartbeat(p_tournament_id uuid, p_device_id uuid, p_fields integer[],
                                                         p_state text, p_output_changed boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fields integer[];
  v_now timestamptz := now();
  v_out jsonb;
BEGIN
  PERFORM public.hall_require(p_tournament_id, 'manageScreens');
  IF p_device_id IS NULL
     OR p_state IS NULL
     OR p_state NOT IN ('ready', 'not_activated', 'background', 'slept', 'custom_sound_failed', 'volume_zero') THEN
    RAISE EXCEPTION 'hallenton: heartbeat invalid' USING ERRCODE = '22023';
  END IF;
  v_fields := public.hall_checked_fields(p_tournament_id, p_fields);

  UPDATE public.hall_speakers s
     SET state = p_state, last_seen = v_now,
         output_hint_at = CASE WHEN coalesce(p_output_changed, false) THEN v_now ELSE s.output_hint_at END
   WHERE s.tournament_id = p_tournament_id AND s.field_id = ANY (v_fields) AND s.device_id = p_device_id;

  SELECT jsonb_agg(jsonb_build_object(
           'field', f.f,
           'status', CASE WHEN s.field_id IS NULL THEN 'unassigned'
                          WHEN s.device_id = p_device_id THEN 'ok' ELSE 'superseded' END,
           'test', CASE WHEN s.device_id = p_device_id AND s.test_id IS NOT NULL AND s.test_played_at IS NULL
                         AND s.test_requested_at > v_now - interval '10 seconds'
                        THEN jsonb_build_object('testId', s.test_id,
                                                'ageMs', public.hall_ms(v_now) - public.hall_ms(s.test_requested_at)) END,
           'lead', CASE WHEN s.device_id = p_device_id AND l.field_id IS NOT NULL
                        THEN jsonb_build_object('ageMs', public.hall_ms(v_now) - public.hall_ms(l.last_seen)) END)
           ORDER BY f.f)
    INTO v_out
    FROM unnest(v_fields) AS f(f)
    LEFT JOIN public.hall_speakers s ON s.tournament_id = p_tournament_id AND s.field_id = f.f
    LEFT JOIN public.hall_field_leads l ON l.tournament_id = p_tournament_id AND l.field_id = f.f;

  RETURN jsonb_build_object('status', 'ok', 'serverNow', public.hall_ms(v_now), 'fields', v_out);
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Lebenszeichen des leitenden Geraets je Feld (etwa alle 5 s, nur mit Leitungsrecht, nur angemeldet)
-- ---------------------------------------------------------------------------------------------------------------
-- Leitungsrecht = writeMatchData UND das Geraet haelt die Steuer des Felds (field_control: Konto UND Geraete-Kennung).
-- Sonst {status:'not_controller'} ohne Schreiben. Antwort: Lautsprecher des Felds {state, ageMs} oder null
-- (Cockpit-Hinweis „Hallen-Lautsprecher aus – Ende selbst anzeigen“, @HT-040).
CREATE OR REPLACE FUNCTION public.hall_field_lead_heartbeat(p_tournament_id uuid, p_field integer, p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_field integer;
  v_speaker jsonb;
BEGIN
  PERFORM public.hall_require(p_tournament_id, 'writeMatchData');
  IF p_device_id IS NULL THEN
    RAISE EXCEPTION 'hallenton: device invalid' USING ERRCODE = '22023';
  END IF;
  v_field := (public.hall_checked_fields(p_tournament_id, ARRAY[p_field]))[1];

  SELECT jsonb_build_object('state', s.state,
                            'ageMs', CASE WHEN s.last_seen IS NULL THEN NULL
                                          ELSE public.hall_ms(v_now) - public.hall_ms(s.last_seen) END,
                            'outputHint', s.output_hint_at IS NOT NULL)
    INTO v_speaker
    FROM public.hall_speakers s WHERE s.tournament_id = p_tournament_id AND s.field_id = v_field;

  IF NOT EXISTS (SELECT 1 FROM public.field_control fc
                  WHERE fc.tournament_id = p_tournament_id AND fc.field = v_field
                    AND fc.holder_user_id = auth.uid() AND fc.holder_device_id = p_device_id) THEN
    RETURN jsonb_build_object('status', 'not_controller', 'serverNow', public.hall_ms(v_now), 'speaker', v_speaker);
  END IF;

  INSERT INTO public.hall_field_leads AS l (tournament_id, field_id, device_id, last_seen)
  VALUES (p_tournament_id, v_field, p_device_id, v_now)
  ON CONFLICT (tournament_id, field_id) DO UPDATE SET device_id = EXCLUDED.device_id, last_seen = EXCLUDED.last_seen;

  RETURN jsonb_build_object('status', 'ok', 'serverNow', public.hall_ms(v_now), 'speaker', v_speaker);
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Testton in der Halle mit Quittung (@HT-017)
-- ---------------------------------------------------------------------------------------------------------------
-- Schreibt Kennung und Serverzeit, hoechstens einmal je 3 s und Feld ({status:'too_soon', retryInMs}). Ohne
-- Lautsprecher {status:'no_speaker'}. Ein laufendes Spiel sperrt NICHT (Rueckfrage in der Oberflaeche, @HT-017 Z. 5).
CREATE OR REPLACE FUNCTION public.hall_test_tone_request(p_tournament_id uuid, p_field integer)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_min_gap constant interval := interval '3 seconds';
  v_now timestamptz := now();
  v_field integer;
  v_row public.hall_speakers%ROWTYPE;
  v_test uuid := gen_random_uuid();
BEGIN
  PERFORM public.hall_require(p_tournament_id, 'manageScreens');
  PERFORM public.hall_require_open(p_tournament_id);
  v_field := (public.hall_checked_fields(p_tournament_id, ARRAY[p_field]))[1];
  SELECT * INTO v_row FROM public.hall_speakers s
   WHERE s.tournament_id = p_tournament_id AND s.field_id = v_field FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_speaker', 'serverNow', public.hall_ms(v_now));
  END IF;
  IF v_row.test_requested_at IS NOT NULL AND v_row.test_requested_at > v_now - c_min_gap THEN
    RETURN jsonb_build_object('status', 'too_soon', 'serverNow', public.hall_ms(v_now),
                              'retryInMs', public.hall_ms(v_row.test_requested_at + c_min_gap) - public.hall_ms(v_now));
  END IF;
  UPDATE public.hall_speakers s
     SET test_id = v_test, test_requested_at = v_now, test_played_at = NULL
   WHERE s.tournament_id = p_tournament_id AND s.field_id = v_field;
  RETURN jsonb_build_object('status', 'requested', 'testId', v_test, 'requestedAt', public.hall_ms(v_now),
                            'serverNow', public.hall_ms(v_now));
END;
$$;

-- Quittung des Lautsprechers: nur das zugeordnete Geraet, nur die offene Kennung; zweite Quittung aendert nichts.
CREATE OR REPLACE FUNCTION public.hall_test_tone_ack(p_tournament_id uuid, p_field integer, p_device_id uuid,
                                                     p_test_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_field integer;
  v_row public.hall_speakers%ROWTYPE;
BEGIN
  PERFORM public.hall_require(p_tournament_id, 'manageScreens');
  IF p_device_id IS NULL OR p_test_id IS NULL THEN
    RAISE EXCEPTION 'hallenton: ack invalid' USING ERRCODE = '22023';
  END IF;
  v_field := (public.hall_checked_fields(p_tournament_id, ARRAY[p_field]))[1];
  SELECT * INTO v_row FROM public.hall_speakers s
   WHERE s.tournament_id = p_tournament_id AND s.field_id = v_field FOR UPDATE;
  IF NOT FOUND OR v_row.device_id <> p_device_id THEN
    RETURN jsonb_build_object('status', 'superseded');
  END IF;
  IF v_row.test_id IS DISTINCT FROM p_test_id THEN
    RETURN jsonb_build_object('status', 'unknown_test');
  END IF;
  IF v_row.test_played_at IS NULL THEN
    UPDATE public.hall_speakers s SET test_played_at = now()
     WHERE s.tournament_id = p_tournament_id AND s.field_id = v_field
    RETURNING s.test_played_at INTO v_row.test_played_at;
  END IF;
  RETURN jsonb_build_object('status', 'acked', 'playedAt', public.hall_ms(v_row.test_played_at));
END;
$$;

-- „Gehört“ nach dem Testton (@HT-049): nimmt den Hinweis „Prüfen“ fuer dieses Feld weg, auch wenn Olli es auf einem
-- anderen Geraet waehlt. Loescht nur das Anzeichen (output_hint_at); kein Ton, keine Bereitschaft, kein Testton (@HT-044).
-- Nach dem Turnierende gesperrt (@HT-046). Ein neues Anzeichen im naechsten Lebenszeichen setzt den Hinweis wieder.
CREATE OR REPLACE FUNCTION public.hall_output_heard(p_tournament_id uuid, p_field integer)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_field integer;
BEGIN
  PERFORM public.hall_require(p_tournament_id, 'manageScreens');
  PERFORM public.hall_require_open(p_tournament_id);
  v_field := (public.hall_checked_fields(p_tournament_id, ARRAY[p_field]))[1];
  UPDATE public.hall_speakers s SET output_hint_at = NULL
   WHERE s.tournament_id = p_tournament_id AND s.field_id = v_field;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_speaker');
  END IF;
  RETURN jsonb_build_object('status', 'heard');
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Tonwahl je Turnier (@HT-025, @HT-027, @HT-024)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hall_sound_settings_set(p_tournament_id uuid, p_halftime_sound text,
                                                          p_halftime_custom_path text, p_end_custom_path text,
                                                          p_goal_tone_fields integer[])
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_goal integer[] := '{}';
BEGIN
  PERFORM public.hall_require(p_tournament_id, 'manageScreens');
  PERFORM public.hall_require_open(p_tournament_id);
  IF coalesce(cardinality(p_goal_tone_fields), 0) > 0 THEN
    v_goal := public.hall_checked_fields(p_tournament_id, p_goal_tone_fields);
  END IF;
  BEGIN
    INSERT INTO public.hall_sound_settings AS s
      (tournament_id, halftime_sound, halftime_custom_path, end_custom_path, goal_tone_fields, updated_at)
    VALUES (p_tournament_id, coalesce(p_halftime_sound, 'horn-1'), p_halftime_custom_path, p_end_custom_path, v_goal, now())
    ON CONFLICT (tournament_id) DO UPDATE SET
      halftime_sound = EXCLUDED.halftime_sound, halftime_custom_path = EXCLUDED.halftime_custom_path,
      end_custom_path = EXCLUDED.end_custom_path, goal_tone_fields = EXCLUDED.goal_tone_fields,
      updated_at = EXCLUDED.updated_at;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'hallenton: settings invalid' USING ERRCODE = '22023';
  END;
  RETURN jsonb_build_object('status', 'saved');
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Stand lesen (@HT-001, @HT-016, @HT-039, @HT-040, @HT-042)
-- ---------------------------------------------------------------------------------------------------------------
-- manageScreens (Turnierleitung, Co-Admin): je Feld mit Lautsprecher {field, deviceName, isThisDevice, state,
--   assignedAt, outputHint, hintAt, lastSeen, ageMs, test{testId, requestedAt, playedAt}}, Leitung je Feld {field, ageMs},
--   Tonwahl, closed (Turnier abgeschlossen/abgebrochen, @HT-046: lesen ja, aendern nein).
-- nur writeMatchData (Helfer, Mitarbeiter -- fuer den Cockpit-Hinweis, @HT-040/@HT-050): je Feld mit Lautsprecher
--   {field, state, ageMs, outputHint};
--   kein Geraetename, kein Testton, keine Tonwahl.
-- sonst 42501. Felder ohne Lautsprecher fehlen in der Liste (neutral, @HT-016).
CREATE OR REPLACE FUNCTION public.hall_sound_status(p_tournament_id uuid, p_device_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_full boolean;
BEGIN
  IF p_tournament_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = p_tournament_id AND t.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'hallenton: not allowed' USING ERRCODE = '42501';
  END IF;
  v_full := public.has_tournament_permission(p_tournament_id, 'manageScreens');
  IF NOT v_full AND NOT public.has_tournament_permission(p_tournament_id, 'writeMatchData') THEN
    RAISE EXCEPTION 'hallenton: not allowed' USING ERRCODE = '42501';
  END IF;

  IF NOT v_full THEN
    RETURN jsonb_build_object(
      'serverNow', public.hall_ms(v_now),
      'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object(
                     'field', s.field_id, 'state', s.state,
                     'ageMs', CASE WHEN s.last_seen IS NULL THEN NULL
                                   ELSE public.hall_ms(v_now) - public.hall_ms(s.last_seen) END,
                     'outputHint', s.output_hint_at IS NOT NULL) ORDER BY s.field_id)
                    FROM public.hall_speakers s WHERE s.tournament_id = p_tournament_id), '[]'::jsonb));
  END IF;

  RETURN jsonb_build_object(
    'serverNow', public.hall_ms(v_now),
    'closed', public.tournament_is_closed(p_tournament_id),
    'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object(
                   'field', s.field_id, 'deviceName', s.device_name,
                   'isThisDevice', coalesce(s.device_id = p_device_id, false),
                   'state', s.state, 'assignedAt', public.hall_ms(s.assigned_at),
                   'outputHint', s.output_hint_at IS NOT NULL,
                   'hintAt', public.hall_ms(s.output_hint_at),
                   'lastSeen', public.hall_ms(s.last_seen),
                   'ageMs', CASE WHEN s.last_seen IS NULL THEN NULL
                                 ELSE public.hall_ms(v_now) - public.hall_ms(s.last_seen) END,
                   'test', CASE WHEN s.test_id IS NULL THEN NULL
                                ELSE jsonb_build_object('testId', s.test_id,
                                                        'requestedAt', public.hall_ms(s.test_requested_at),
                                                        'playedAt', public.hall_ms(s.test_played_at)) END)
                   ORDER BY s.field_id)
                  FROM public.hall_speakers s WHERE s.tournament_id = p_tournament_id), '[]'::jsonb),
    'leads', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'field', l.field_id, 'ageMs', public.hall_ms(v_now) - public.hall_ms(l.last_seen)) ORDER BY l.field_id)
               FROM public.hall_field_leads l WHERE l.tournament_id = p_tournament_id), '[]'::jsonb),
    'settings', coalesce((SELECT jsonb_build_object('halftimeSound', st.halftime_sound,
                                                    'halftimeCustomPath', st.halftime_custom_path,
                                                    'endCustomPath', st.end_custom_path,
                                                    'goalToneFields', to_jsonb(st.goal_tone_fields))
                            FROM public.hall_sound_settings st WHERE st.tournament_id = p_tournament_id),
                         jsonb_build_object('halftimeSound', 'horn-1', 'halftimeCustomPath', NULL,
                                            'endCustomPath', NULL, 'goalToneFields', '[]'::jsonb)));
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 9. Loeschen nach Turnierende (DSGVO Art. 5 Abs. 1 lit. e) -- ohne EXECUTE fuer Client-Rollen
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hall_sound_purge_ended() RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n integer := 0;
  v_m integer := 0;
BEGIN
  WITH ended AS (
    SELECT t.id FROM public.tournaments t
     WHERE t.deleted_at IS NOT NULL
        OR t.lifecycle_status = 'cancelled'
        OR (t.finished_at IS NOT NULL AND t.finished_at < now() - interval '1 day'))
  , d1 AS (DELETE FROM public.hall_speakers s USING ended e WHERE s.tournament_id = e.id RETURNING 1)
  SELECT count(*) INTO v_n FROM d1;
  WITH ended AS (
    SELECT t.id FROM public.tournaments t
     WHERE t.deleted_at IS NOT NULL
        OR t.lifecycle_status = 'cancelled'
        OR (t.finished_at IS NOT NULL AND t.finished_at < now() - interval '1 day'))
  , d2 AS (DELETE FROM public.hall_field_leads l USING ended e WHERE l.tournament_id = e.id RETURNING 1)
  SELECT count(*) INTO v_m FROM d2;
  RETURN v_n + v_m;
END;
$$;
COMMENT ON FUNCTION public.hall_sound_purge_ended() IS
  'Hallenton: loescht Geraetename, Zeitpunkt und Grund der Lebenszeichen von Turnieren, die seit mehr als 1 Tag beendet,
   abgebrochen oder geloescht sind. Kein Client-Recht; Zeitplan legt Daniel fest (Record Hallenton, offener Punkt).';

-- ---------------------------------------------------------------------------------------------------------------
-- 10. Rechte der Funktionen: nur authenticated (Policies/Rollen pruefen innen), nie anon/PUBLIC/service_role
-- ---------------------------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.hall_speaker_assign(uuid, integer[], uuid, text, boolean) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.hall_speaker_release(uuid, integer[], uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.hall_speaker_heartbeat(uuid, uuid, integer[], text, boolean) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.hall_field_lead_heartbeat(uuid, integer, uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.hall_test_tone_request(uuid, integer) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.hall_test_tone_ack(uuid, integer, uuid, uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.hall_sound_settings_set(uuid, text, text, text, integer[]) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.hall_sound_status(uuid, uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.hall_output_heard(uuid, integer) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.hall_sound_purge_ended() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hall_speaker_assign(uuid, integer[], uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hall_speaker_release(uuid, integer[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hall_speaker_heartbeat(uuid, uuid, integer[], text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hall_field_lead_heartbeat(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hall_test_tone_request(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hall_test_tone_ack(uuid, integer, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hall_sound_settings_set(uuid, text, text, text, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hall_sound_status(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hall_output_heard(uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 11. Eigener Ton: Bucket und Policies (nur wenn das Storage-Schema existiert)
-- ---------------------------------------------------------------------------------------------------------------
-- Policy-Hilfe: Pfad <tid>/<uuid>.mp3|wav (klein geschrieben), Recht manageScreens, Turnier nicht im Papierkorb.
-- p_op 'insert' | 'delete' | 'select': Hochladen und Loeschen nur, solange das Turnier nicht abgeschlossen ist (@HT-046);
-- im Papierkorb nur noch Auflisten und Loeschen (Aufraeumen: Storage kaskadiert nicht -- die App entfernt die Dateien <tid>/* ueber
-- die Storage-Schnittstelle beim Loeschen des Turniers, bevor es endgueltig geloescht wird);
-- Hochladen zusaetzlich hoechstens 10 Dateien je Turnier. EXECUTE fuer authenticated (Policies laufen im Kontext des
-- Aufrufers), nie anon.
CREATE OR REPLACE FUNCTION public.hall_sound_object_allowed(p_name text, p_op text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_max_files constant integer := 10;
  v_tid uuid;
  v_deleted boolean;
  v_count integer;
BEGIN
  IF p_op IS NULL OR p_op NOT IN ('insert', 'delete', 'select') THEN
    RETURN false;
  END IF;
  IF p_name IS NULL OR p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|wav)$' THEN
    RETURN false;
  END IF;
  v_tid := split_part(p_name, '/', 1)::uuid;
  SELECT t.deleted_at IS NOT NULL INTO v_deleted FROM public.tournaments t WHERE t.id = v_tid;
  IF v_deleted IS NULL
     OR NOT public.has_tournament_permission(v_tid, 'manageScreens') THEN
    RETURN false;
  END IF;
  -- Papierkorb: nur noch aufraeumen (Auflisten + Loeschen der eigenen Toene, Storage kaskadiert nicht)
  IF v_deleted AND p_op = 'insert' THEN
    RETURN false;
  END IF;
  -- @HT-046: nach dem Turnierende kein Hochladen/Loeschen (ausser beim Aufraeumen im Papierkorb)
  IF NOT v_deleted AND p_op IN ('insert', 'delete') AND public.tournament_is_closed(v_tid) THEN
    RETURN false;
  END IF;
  IF p_op = 'insert' THEN
    IF to_regclass('storage.objects') IS NULL THEN
      RETURN false;
    END IF;
    EXECUTE 'SELECT count(*) FROM storage.objects o WHERE o.bucket_id = ''hallenton-sounds'' AND o.name LIKE $1'
       INTO v_count USING v_tid::text || '/%';
    IF v_count >= c_max_files THEN
      RETURN false;
    END IF;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.hall_sound_object_allowed(text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.hall_sound_object_allowed(text, text) TO authenticated;

-- Bucket: legt die Migration an (postgres hat live INSERT auf storage.buckets). Die drei Policies auf storage.objects
-- legt sie NICHT an: storage.objects gehoert live supabase_storage_admin, postgres ist nicht Mitglied -- CREATE POLICY
-- scheitert dort („must be owner“). Die Policies sind ein Handschritt:
--   supabase/handschritte/20261121_001_hallenton_storage_policies.sql (Dashboard-SQL-Editor bzw. Storage-Policy-UI).
-- Ohne die Policies bleibt der Bucket sicher: keine Policy fuer authenticated/anon = Hochladen, Auflisten und Loeschen
-- verweigert; Lesen nur ueber die oeffentliche Adresse mit dem vollen Namen (der Bucket ist anfangs leer).
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE '20261121_001_hallenton: storage.buckets/objects fehlen hier -- Bucket uebersprungen';
    RETURN;
  END IF;
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('hallenton-sounds', 'hallenton-sounds', true, 1048576,
          ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'])
  ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
END
$$;

COMMIT;
