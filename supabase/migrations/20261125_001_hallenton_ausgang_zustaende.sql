-- supabase/migrations/20261125_001_hallenton_ausgang_zustaende.sql
-- Hallenton -- Zustaende des Ausgangs und Abmelden fremder Geraete (Plan H4, Task H4-3). Record
-- docs/anforderungen/2026-10-15_hallenton.md, Szenarien (Server-Teil): @HT-053 (Ausgang waehlen: Zustand
-- „Ausgang bestaetigen“ kommt aus @HT-055), @HT-054 (gewaehlter Ausgang verschwunden = „nicht bereit – Ausgang verloren“),
-- @HT-055 (nach dem Neuladen fehlt die Kennung des Ausgangs = „nicht bereit – Ausgang bestaetigen“), @HT-057 (die Turnierleitung
-- meldet das Geraet eines Felds ab). Anzeige und Senden der neuen Zustaende kommen in H4-6 und H4-11, NICHT hier.
--
-- Inhalt:
--   1. Pruefregel hall_speakers_state_check: zusaetzlich 'output_lost' und 'output_unconfirmed' (Zustand aus dem Lebenszeichen,
--      Reihenfolge: die sechs bisherigen, dann die zwei neuen). NULL bleibt „noch kein Lebenszeichen“.
--   2. hall_speaker_heartbeat: nimmt die beiden neuen Zustaende an; jeder andere Zustand bleibt Fehler 22023. Rumpf sonst
--      woertlich 20261123_001 (nur die Zustandsliste ist laenger; Antwortform, Rechte, Sperre nach Turnierende unveraendert).
--   3. hall_speaker_unassign(p_tournament_id, p_fields) -- NEU: die Turnierleitung (manageScreens) meldet den Lautsprecher der
--      genannten Felder ab, gleich welches Geraet es ist (hall_speaker_release loescht nur Zeilen der EIGENEN Geraete-Kennung,
--      hall_sound_status gibt fremde Kennungen nicht heraus). Reihenfolge der Pruefung wie die uebrigen Verwaltungs-Funktionen:
--      manageScreens (42501), Turnier offen (55000), Felder (22023). Antwort {status:'unassigned', fields:[Felder, die einen
--      Lautsprecher hatten]} -- keine Geraete-Kennung, kein Geraetename. Das abgemeldete Geraet erfaehrt es beim naechsten
--      Lebenszeichen ueber den bestehenden Status 'unassigned' (Marke „abgemeldet“ aus H4-1); ein anderes Geraet, das sich
--      inzwischen zugeordnet hat, ist davon nicht betroffen, denn die Zuordnung ist dann eine neue Zeile.
--      Rechte: REVOKE fuer PUBLIC, anon, service_role; GRANT EXECUTE nur authenticated (wie die uebrigen Verwaltungs-Funktionen).
--   4. Spaltenkommentar hall_speakers.state nennt die neuen Zustaende.
--
-- Rueckwaertsvertraeglichkeit (die heute ausgelieferte App bleibt unveraendert funktionsfaehig):
--   - Die App sendet nur die sechs bisherigen Zustaende; sie sind weiter gueltig, die Antwort des Lebenszeichens hat dieselbe Form.
--   - hall_sound_status und hall_field_lead_heartbeat geben state unveraendert durch (Text); die App liest einen unbekannten
--     Zustand seit H4-2 tolerant als „nicht bereit“ -- und sie sieht einen neuen Zustand erst, wenn ein neuer Client ihn sendet
--     (H4-6, nach diesem Einspielen und nie an einem Turniertag).
--   - Keine Spalte, keine Funktion, keine Signatur wird entfernt oder umbenannt; hall_speaker_unassign ist neu und wird von
--     der heutigen App nicht aufgerufen.
--
-- Voraussetzungen (Fail-fast, ohne Aenderung): 20261121_001 und 20261123_001 (Lebenszeichen in der Fassung 20261123_001 oder schon
--   dieser; hall_speakers_state_check in der Fassung mit sechs oder mit acht Zustaenden).
-- Fehlercodes: nur Standard-SQLSTATE (42501, 22023, 55000).
-- Bestandsdaten: Zeilen mit den sechs bisherigen Zustaenden bleiben gueltig. Idempotent: DROP CONSTRAINT IF EXISTS + ADD,
--   CREATE OR REPLACE, Kommentar setzen.
--
-- RUECKWEG: supabase/rollbacks/20261125_001_hallenton_ausgang_zustaende_rollback.sql (belegt in scripts/hallenton-check.sh,
--   Kategorie A: Schema danach = vorher). Vorher die App auf den Stand ohne die neuen Zustaende (H4-6 zurueck). Der Rueckweg setzt
--   Zeilen mit einem der zwei neuen Zustaende auf NULL („noch kein Lebenszeichen“), stellt Pruefregel und Lebenszeichen in der
--   Fassung 20261123_001 wieder her und entfernt hall_speaker_unassign.
--
-- Produktion: nur nach Daniels Freigabe (SQL + SHA). Dieser Branch spielt nichts ein. Typen nachgezogen (src/types/supabase.ts).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.hall_speakers') IS NULL
     OR to_regprocedure('public.hall_require(uuid,text)') IS NULL
     OR to_regprocedure('public.hall_require_open(uuid)') IS NULL
     OR to_regprocedure('public.hall_checked_fields(uuid,integer[])') IS NULL
     OR to_regprocedure('public.hall_goal_anthems_set(uuid,text[])') IS NULL THEN
    RAISE EXCEPTION '20261125_001_hallenton_ausgang_zustaende: Hallenton (20261121_001) und Torhymne (20261123_001) fehlen -- zuerst einspielen';
  END IF;
  IF coalesce(md5((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.hall_speaker_heartbeat(uuid,uuid,integer[],text,boolean)'))), '')
       NOT IN ('223c2fcfc5c884d50400163f64c541bd', 'f0aff155a33b07316857d9f4c623825e') THEN
    RAISE EXCEPTION '20261125_001_hallenton_ausgang_zustaende: hall_speaker_heartbeat nicht in der Fassung 20261123_001 -- nichts geaendert';
  END IF;
  IF coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint
                WHERE conrelid = 'public.hall_speakers'::regclass AND conname = 'hall_speakers_state_check'), '')
       NOT IN ('CHECK (((state IS NULL) OR (state = ANY (ARRAY[''ready''::text, ''not_activated''::text, ''background''::text, ''slept''::text, ''custom_sound_failed''::text, ''volume_zero''::text]))))',
               'CHECK (((state IS NULL) OR (state = ANY (ARRAY[''ready''::text, ''not_activated''::text, ''background''::text, ''slept''::text, ''custom_sound_failed''::text, ''volume_zero''::text, ''output_lost''::text, ''output_unconfirmed''::text]))))') THEN
    RAISE EXCEPTION '20261125_001_hallenton_ausgang_zustaende: hall_speakers_state_check in unbekannter Fassung -- nichts geaendert';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Pruefregel: zwei neue Zustaende (@HT-054, @HT-055)
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.hall_speakers DROP CONSTRAINT IF EXISTS hall_speakers_state_check;
ALTER TABLE public.hall_speakers ADD CONSTRAINT hall_speakers_state_check CHECK (state IS NULL OR state IN
  ('ready', 'not_activated', 'background', 'slept', 'custom_sound_failed', 'volume_zero', 'output_lost', 'output_unconfirmed'));
COMMENT ON COLUMN public.hall_speakers.state IS
  'Zustand aus dem letzten Lebenszeichen: ready | not_activated (Ton nicht aktiviert) | background (Hintergrund) | slept
   (vom Browser schlafen gelegt) | custom_sound_failed (eigener Ton nicht geladen, spielt Hupe 1) | volume_zero
   (Lautstaerke 0 %) | output_lost (der gewaehlte Ausgang ist verschwunden, @HT-054) | output_unconfirmed (nach dem Neuladen
   fehlt die Kennung des gewaehlten Ausgangs, @HT-055). „meldet sich nicht“ ergibt sich aus dem Alter von last_seen (Server),
   „keine Verbindung“ zeigt nur das Geraet selbst.';

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Lebenszeichen: die zwei neuen Zustaende werden angenommen -- Rumpf sonst wie 20261123_001
-- ---------------------------------------------------------------------------------------------------------------
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
  PERFORM public.hall_require_open(p_tournament_id);
  IF p_device_id IS NULL
     OR p_state IS NULL
     OR p_state NOT IN ('ready', 'not_activated', 'background', 'slept', 'custom_sound_failed', 'volume_zero', 'output_lost', 'output_unconfirmed') THEN
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
-- 3. Lautsprecher fremder Geraete abmelden (@HT-057)
-- ---------------------------------------------------------------------------------------------------------------
-- Loescht die Zuordnung der genannten Felder, gleich welches Geraet sie haelt. Die Antwort nennt nur die Felder, die einen
-- Lautsprecher hatten -- nie eine Geraete-Kennung oder einen Geraetenamen. Felder ohne Lautsprecher sind kein Fehler.
CREATE OR REPLACE FUNCTION public.hall_speaker_unassign(p_tournament_id uuid, p_fields integer[])
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fields integer[];
  v_removed integer[];
BEGIN
  PERFORM public.hall_require(p_tournament_id, 'manageScreens');
  PERFORM public.hall_require_open(p_tournament_id);
  v_fields := public.hall_checked_fields(p_tournament_id, p_fields);
  PERFORM pg_advisory_xact_lock(hashtext('hallenton:' || p_tournament_id::text));
  WITH d AS (
    DELETE FROM public.hall_speakers s
     WHERE s.tournament_id = p_tournament_id AND s.field_id = ANY (v_fields)
    RETURNING s.field_id)
  SELECT coalesce(array_agg(field_id ORDER BY field_id), '{}') INTO v_removed FROM d;
  RETURN jsonb_build_object('status', 'unassigned', 'fields', to_jsonb(v_removed));
END;
$$;
REVOKE ALL ON FUNCTION public.hall_speaker_unassign(uuid, integer[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.hall_speaker_unassign(uuid, integer[]) TO authenticated;

COMMIT;
