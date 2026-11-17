-- supabase/rollbacks/20261127_001_zuschauer_zaehlung_netzstoerung_rollback.sql
-- RUECKWEG zu supabase/migrations/20261127_001_zuschauer_zaehlung_netzstoerung.sql. Liegt bewusst NICHT in supabase/migrations (wird nie
-- nachgespielt); belegt in scripts/zuschauer-zaehlung-check.sh (Summen der Aufrufe und Lebenszeichen vorher = nachher, Schema danach = Stand
-- 20261126_001). EIN Block.
-- Reihenfolge: dieser Rueckweg ZUERST, der von 20261126_001 (und 004, 003) erst danach. Ein neuer Client verschluckt die dann unbekannte Art
-- still (die Fassung 20261126_001 verwirft sie), der ausgelieferte Client aendert sich nicht.
-- Was er tut: stellt count_public_view in der Fassung 20261126_001 wieder her (Rumpf woertlich, prosrc-md5 814b327fa1dc1e8e92a03fd7031ff0b8)
-- und entfernt die zwei Spalten outages_short und outages_long samt Pruefregeln. Die Summen der Aufrufe und Lebenszeichen bleiben unberuehrt;
-- nur die gezaehlten Stoerungen entfallen (vorher sichern, falls noetig: COPY public.public_view_counts TO ...).
-- Idempotent: ein zweiter Lauf findet nichts mehr zu tun. Ist die Tabelle schon weg, wird count_public_view NICHT neu angelegt.
-- Sperre: ACCESS EXCLUSIVE (unter lock_timeout 5 s), damit Funktionswechsel und Spaltenentzug EINEN Stand zeigen. Aufrufe, die im Moment des
-- Rueckwegs unterwegs sind, warten kurz; scheitern sie, verschluckt der Client das.
-- Rein ASCII.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $rb$
BEGIN
  IF to_regclass('public.public_view_counts') IS NOT NULL THEN
    LOCK TABLE public.public_view_counts IN ACCESS EXCLUSIVE MODE;
    -- count_public_view in der Fassung 20261126_001 (Rumpf woertlich)
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
  v_headers text;
  v_agent   text;
  v_os      text;
  v_browser text;
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

  -- Kennung des Browsers aus den Kopfzeilen des Aufrufs (PostgREST). Alles Fehlende oder Unbrauchbare ergibt 'sonstige', nie einen Fehler.
  v_headers := nullif(current_setting('request.headers', true), '');
  IF v_headers IS NOT NULL AND char_length(v_headers) <= 65536 AND pg_input_is_valid(v_headers, 'jsonb') THEN
    v_agent := v_headers::jsonb ->> 'user-agent';
  END IF;
  SELECT f.os_family, f.browser_family INTO v_os, v_browser FROM public.public_view_agent_families(v_agent) f;

  INSERT INTO public.public_view_counts AS c (tournament_id, window_start, channel, device_class, installed, os_family, browser_family, views, heartbeats)
  VALUES (v_id, date_bin('5 minutes', now(), timestamptz '2000-01-01 00:00:00+00'), v_kanal, p_geraet,
          coalesce(p_installiert, false), v_os, v_browser, v_views, v_beats)
  ON CONFLICT (tournament_id, window_start, channel, device_class, installed, os_family, browser_family)
  DO UPDATE SET views = c.views + EXCLUDED.views, heartbeats = c.heartbeats + EXCLUDED.heartbeats;
END;
$$
$sql$;
    COMMENT ON FUNCTION public.count_public_view(text, text, text, text, boolean) IS
      'Zuschauer-Seite zaehlen (@RZ-024..032): +1 Aufruf oder Lebenszeichen im laufenden 5-Minuten-Fenster, aufgeteilt nach Betriebssystem- und Browser-Familie (aus der Kennung des Aufrufs); nur oeffentliche Turniere; still bei allem anderen; speichert nur Summen.';
    REVOKE ALL ON FUNCTION public.count_public_view(text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.count_public_view(text, text, text, text, boolean) TO anon, authenticated, service_role;
    ALTER TABLE public.public_view_counts DROP COLUMN IF EXISTS outages_short, DROP COLUMN IF EXISTS outages_long;
    COMMENT ON TABLE public.public_view_counts IS
      'Zuschauer-Seite zaehlen (@RZ-024..032): nur Summen je Turnier, 5-Minuten-Fenster, Kanal, Geraeteklasse, installiert, Betriebssystem- und Browser-Familie. Kein Client-Zugriff, nur Betreiber.';
  END IF;
END
$rb$;
COMMIT;
