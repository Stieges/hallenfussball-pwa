-- supabase/migrations/20261127_001_zuschauer_zaehlung_netzstoerung.sql
-- Zuschauer-Seite zaehlen, Stufe 1c: ueberstandene Netzstoerungen mitzaehlen (Record
-- docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md, @RZ-033, @RZ-034, @RZ-035, @RZ-036; Folge zu 20261126_001_zuschauer_zaehlung_os_browser.sql).
--
-- Inhalt:
--   1. public.public_view_counts: zwei neue Spalten outages_short und outages_long (integer NOT NULL DEFAULT 0, Pruefregel >= 0, wie views und
--      heartbeats). Sie zaehlen, wie oft eine Zuschauer-Seite eine ueberstandene Stoerung gemeldet hat: kurz (unter 20 s ohne gelungenen Abruf)
--      oder lang (ab 20 s). Der Primaerschluessel bleibt UNVERAENDERT: die Stoerungen stehen in der Zeile, in der auch die Aufrufe derselben
--      Kombination (Turnier, 5-Minuten-Fenster, Kanal, Geraeteart, installiert, Betriebssystem, Browser) stehen -- "aufgeteilt wie die Aufrufe".
--   2. public.count_public_view(text,text,text,text,boolean) -- GLEICHE Signatur, gleicher Rueckgabetyp, gleiche Rechte, gleiches stilles Ende
--      (@RZ-028, @RZ-032): p_art kennt zusaetzlich 'stoerung_kurz' und 'stoerung_lang'. Alle uebrigen Bedingungen (Code, Geraeteart, Kanal,
--      oeffentliches nicht geloeschtes Turnier, Kennung des Browsers, stilles Ende) sind woertlich die der Fassung 20261126_001.
--      Eine Stoerung zaehlt weder als Aufruf noch als Lebenszeichen (views und heartbeats bleiben unberuehrt).
--
-- Rueckwaertsvertraeglichkeit (@RZ-036):
--   - Der heute ausgelieferte Client sendet nur 'aufruf' und 'lebenszeichen'; beides zaehlt vor und nach dem Einspielen wie bisher. Die neuen
--     Spalten haben eine Vorgabe: jeder Schreiber ohne sie bleibt gueltig, der ON-CONFLICT-Zweig der Funktion fasst sie bei Aufruf und
--     Lebenszeichen nicht an.
--   - Ein neuer Client gegen den Server OHNE diese Migration: die Fassung 20261126_001 verwirft jede unbekannte Art still (ELSE RETURN),
--     ohne Fehler und ohne Zeile. Belegt in scripts/zuschauer-zaehlung-check.sh.
--   - NUR ERGAENZEND: keine Zeile wird geloescht oder umgeschrieben, keine bestehende Spalte oder Pruefregel geaendert, Primaerschluessel gleich.
--     Bestandszeilen behalten ihre Summen und tragen danach 0 / 0 Stoerungen.
--   - Die Migration laeuft in EINER Transaktion: ein Aufruf sieht entweder den Stand davor oder den Stand danach.
--
-- Sperren: lock_timeout 5 s wie die uebrigen Fenster-Dateien; ADD COLUMN mit konstanter Vorgabe schreibt die Tabelle nicht um (Metadaten
--   aendern sich in Millisekunden). Schreiber warten dann kurz, sie scheitern nicht. Bei 55P03 (Sperre nicht erhalten) genau einmal wiederholen.
-- Voraussetzungen (Fail-fast, ohne Aenderung): 20261126_001 (Tabelle mit os_family/browser_family; count_public_view in der Fassung
--   20261126_001, prosrc-md5 814b327fa1dc1e8e92a03fd7031ff0b8, oder schon diese).
-- Idempotent: zweimal einspielbar (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE).
--
-- RUECKWEG: supabase/rollbacks/20261127_001_zuschauer_zaehlung_netzstoerung_rollback.sql (stellt count_public_view der Fassung 20261126_001
--   wieder her und entfernt die zwei Spalten; die Summen der Aufrufe und Lebenszeichen bleiben, nur die gezaehlten Stoerungen entfallen).
--   Der Rueckweg von 20261126_001 darf erst danach laufen. Belegt in scripts/zuschauer-zaehlung-check.sh.
-- Produktion: nur nach Freigabe (SQL + SHA). Dieser Branch spielt nichts ein. Typen nachgezogen (src/types/supabase.ts).
-- Rein ASCII.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $pre$
DECLARE
  v_src text;
BEGIN
  IF to_regclass('public.public_view_counts') IS NULL
     OR to_regprocedure('public.count_public_view(text,text,text,text,boolean)') IS NULL
     OR to_regprocedure('public.public_view_agent_families(text)') IS NULL THEN
    RAISE EXCEPTION '20261127_001_zuschauer_zaehlung_netzstoerung: Zuschauer-Zaehlung Stufe 1b (20261126_001) fehlt -- zuerst einspielen';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
                  WHERE attrelid = 'public.public_view_counts'::regclass AND attname IN ('os_family', 'browser_family') AND NOT attisdropped
                  HAVING count(*) = 2) THEN
    RAISE EXCEPTION '20261127_001_zuschauer_zaehlung_netzstoerung: public_view_counts hat die Spalten der Stufe 1b nicht -- abgebrochen';
  END IF;
  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = to_regprocedure('public.count_public_view(text,text,text,text,boolean)');
  IF coalesce(md5(v_src), '') <> '814b327fa1dc1e8e92a03fd7031ff0b8' AND position('outages_short' IN coalesce(v_src, '')) = 0 THEN
    RAISE EXCEPTION '20261127_001_zuschauer_zaehlung_netzstoerung: count_public_view ist weder die Fassung 20261126_001 noch diese -- abgebrochen';
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Spalten (nur ergaenzend; Primaerschluessel bleibt)
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.public_view_counts
  ADD COLUMN IF NOT EXISTS outages_short integer NOT NULL DEFAULT 0
    CONSTRAINT public_view_counts_outages_short_check CHECK (outages_short >= 0);
ALTER TABLE public.public_view_counts
  ADD COLUMN IF NOT EXISTS outages_long integer NOT NULL DEFAULT 0
    CONSTRAINT public_view_counts_outages_long_check CHECK (outages_long >= 0);

COMMENT ON COLUMN public.public_view_counts.outages_short IS
  'Ueberstandene Netzstoerungen unter 20 s ohne gelungenen Abruf (@RZ-033), gezaehlt im Fenster der Rueckkehr; Untergrenze (wer aufgibt, fehlt).';
COMMENT ON COLUMN public.public_view_counts.outages_long IS
  'Ueberstandene Netzstoerungen ab 20 s ohne gelungenen Abruf (@RZ-033), gezaehlt im Fenster der Rueckkehr; Untergrenze (wer aufgibt, fehlt).';
COMMENT ON TABLE public.public_view_counts IS
  'Zuschauer-Seite zaehlen (@RZ-024..036): nur Summen je Turnier, 5-Minuten-Fenster, Kanal, Geraeteklasse, installiert, Betriebssystem- und Browser-Familie; dazu ueberstandene Netzstoerungen (kurz, lang). Kein Client-Zugriff, nur Betreiber.';

-- ---------------------------------------------------------------------------------------------------------------
-- 2. count_public_view: gleiche Signatur und Rechte, zaehlt zusaetzlich 'stoerung_kurz' und 'stoerung_lang'
-- ---------------------------------------------------------------------------------------------------------------
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
  v_short   integer;
  v_long    integer;
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
    v_views := 1; v_beats := 0; v_short := 0; v_long := 0;
  ELSIF p_art = 'lebenszeichen' THEN
    v_views := 0; v_beats := 1; v_short := 0; v_long := 0;
  ELSIF p_art = 'stoerung_kurz' THEN
    v_views := 0; v_beats := 0; v_short := 1; v_long := 0;
  ELSIF p_art = 'stoerung_lang' THEN
    v_views := 0; v_beats := 0; v_short := 0; v_long := 1;
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

  INSERT INTO public.public_view_counts AS c (tournament_id, window_start, channel, device_class, installed, os_family, browser_family,
                                               views, heartbeats, outages_short, outages_long)
  VALUES (v_id, date_bin('5 minutes', now(), timestamptz '2000-01-01 00:00:00+00'), v_kanal, p_geraet,
          coalesce(p_installiert, false), v_os, v_browser, v_views, v_beats, v_short, v_long)
  ON CONFLICT (tournament_id, window_start, channel, device_class, installed, os_family, browser_family)
  DO UPDATE SET views = c.views + EXCLUDED.views, heartbeats = c.heartbeats + EXCLUDED.heartbeats,
                outages_short = c.outages_short + EXCLUDED.outages_short, outages_long = c.outages_long + EXCLUDED.outages_long;
END;
$$;
COMMENT ON FUNCTION public.count_public_view(text, text, text, text, boolean) IS
  'Zuschauer-Seite zaehlen (@RZ-024..036): +1 Aufruf, Lebenszeichen, kurze oder lange ueberstandene Stoerung im laufenden 5-Minuten-Fenster, aufgeteilt nach Betriebssystem- und Browser-Familie (aus der Kennung des Aufrufs); nur oeffentliche Turniere; still bei allem anderen; speichert nur Summen.';

REVOKE ALL ON FUNCTION public.count_public_view(text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_public_view(text, text, text, text, boolean) TO anon, authenticated, service_role;

COMMIT;
