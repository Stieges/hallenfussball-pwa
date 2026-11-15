-- supabase/rollbacks/20261126_001_zuschauer_zaehlung_os_browser_rollback.sql
-- RUECKWEG zu supabase/migrations/20261126_001_zuschauer_zaehlung_os_browser.sql. Liegt bewusst NICHT in supabase/migrations (wird nie
-- nachgespielt); belegt in scripts/zuschauer-zaehlung-check.sh (Summen vorher = nachher, Schema danach = Stand 20261124_004). EIN Block.
-- Reihenfolge: dieser Rueckweg ZUERST, der von 20261124_003 (und 004) erst danach. Der Client aendert sich nicht (er sendet nichts Neues).
-- Was er tut: fuehrt die Summen je (Turnier, Fenster, Kanal, Geraeteklasse, installiert) wieder zusammen (Zeilen mit verschiedenen
-- Familien werden ADDIERT: kein Datenverlust bei den Summen), entfernt die zwei Spalten und die Hilfsfunktion, stellt den
-- Primaerschluessel und count_public_view in der Fassung 20261124_003 wieder her (prosrc-md5 859971c10b8dfb7bc30ed9ac8444df14).
-- Idempotent: ein zweiter Lauf findet nichts mehr zu tun. Ist die Tabelle (003) schon weg, wird count_public_view NICHT neu angelegt.
-- Sperre: der Rueckweg sperrt die Tabelle ACCESS EXCLUSIVE (unter lock_timeout 5 s), damit Zusammenfuehren und Neuaufbau EINEN Stand sehen.
-- Aufrufe der neuen Funktion, die im Moment des Rueckwegs unterwegs sind, koennen scheitern (der Client verschluckt das).
-- Rein ASCII.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $rb$
BEGIN
  IF to_regclass('public.public_view_counts') IS NOT NULL THEN
    -- Summen zusammenfuehren (nur wenn die Spalten noch da sind)
    IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.public_view_counts'::regclass AND attname = 'os_family' AND NOT attisdropped) THEN
      LOCK TABLE public.public_view_counts IN ACCESS EXCLUSIVE MODE;
      CREATE TEMP TABLE zaehlung_rueckweg ON COMMIT DROP AS
        SELECT tournament_id, window_start, channel, device_class, installed, sum(views)::bigint AS views, sum(heartbeats)::bigint AS heartbeats
          FROM public.public_view_counts
         GROUP BY tournament_id, window_start, channel, device_class, installed;
      DELETE FROM public.public_view_counts;
      ALTER TABLE public.public_view_counts DROP CONSTRAINT IF EXISTS public_view_counts_pkey;
      ALTER TABLE public.public_view_counts DROP COLUMN os_family, DROP COLUMN browser_family;
      ALTER TABLE public.public_view_counts ADD CONSTRAINT public_view_counts_pkey PRIMARY KEY (tournament_id, window_start, channel, device_class, installed);
      INSERT INTO public.public_view_counts (tournament_id, window_start, channel, device_class, installed, views, heartbeats)
        SELECT tournament_id, window_start, channel, device_class, installed, views, heartbeats FROM zaehlung_rueckweg;
    END IF;
    COMMENT ON TABLE public.public_view_counts IS
      'Zuschauer-Seite zaehlen (@RZ-024..030): nur Summen je Turnier und 5-Minuten-Fenster. Kein Client-Zugriff, nur Betreiber.';
    -- count_public_view in der Fassung 20261124_003 (Rumpf woertlich)
    EXECUTE $sql$
CREATE OR REPLACE FUNCTION public.count_public_view(
  p_share_code  text,
  p_art         text,
  p_kanal       text,
  p_geraet      text,
  p_installiert boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code    text;
  v_id      uuid;
  v_kanal   text;
  v_views   integer;
  v_beats   integer;
BEGIN
  -- Eingaben streng begrenzen, bevor irgendetwas gelesen wird.
  IF p_share_code IS NULL OR char_length(p_share_code) > 16 THEN RETURN; END IF;
  v_code := upper(btrim(p_share_code));
  IF v_code !~ '^[A-Z0-9]{6}$' THEN RETURN; END IF;

  IF p_art = 'aufruf' THEN
    v_views := 1; v_beats := 0;
  ELSIF p_art = 'lebenszeichen' THEN
    v_views := 0; v_beats := 1;
  ELSE
    RETURN;
  END IF;

  IF p_geraet IS NULL OR p_geraet NOT IN ('handy', 'tablet', 'gross') THEN RETURN; END IF;
  v_kanal := CASE WHEN p_kanal IN ('qr', 'link', 'direkt') THEN p_kanal ELSE 'direkt' END;

  SELECT t.id INTO v_id
    FROM public.tournaments t
   WHERE t.share_code = v_code AND coalesce(t.is_public, false) AND t.deleted_at IS NULL;
  IF v_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.public_view_counts AS c (tournament_id, window_start, channel, device_class, installed, views, heartbeats)
  VALUES (v_id, date_bin('5 minutes', now(), timestamptz '2000-01-01 00:00:00+00'), v_kanal, p_geraet,
          coalesce(p_installiert, false), v_views, v_beats)
  ON CONFLICT (tournament_id, window_start, channel, device_class, installed)
  DO UPDATE SET views = c.views + EXCLUDED.views, heartbeats = c.heartbeats + EXCLUDED.heartbeats;
END;
$$
$sql$;
    COMMENT ON FUNCTION public.count_public_view(text, text, text, text, boolean) IS
      'Zuschauer-Seite zaehlen (@RZ-024..030): +1 Aufruf oder Lebenszeichen im laufenden 5-Minuten-Fenster; nur oeffentliche Turniere; still bei allem anderen; speichert nur Summen.';
    REVOKE ALL ON FUNCTION public.count_public_view(text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.count_public_view(text, text, text, text, boolean) TO anon, authenticated, service_role;
  END IF;
END
$rb$;

DROP FUNCTION IF EXISTS public.public_view_agent_families(text);
COMMIT;
