-- supabase/migrations/20261126_001_zuschauer_zaehlung_os_browser.sql
-- Zuschauer-Seite zaehlen, Stufe 1b: Summen zusaetzlich nach Betriebssystem- und Browser-Familie (Record
-- docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md, @RZ-031, @RZ-032; Folge zu 20261124_003_zuschauer_zaehlung.sql).
--
-- Inhalt:
--   1. public.public_view_counts: zwei neue Spalten os_family (ios, android, windows, macos, sonstige) und browser_family (safari,
--      chrome, firefox, samsung, sonstige), je text NOT NULL, Vorgabe 'sonstige', mit Pruefregel. Bestandszeilen behalten ihre Summen
--      und tragen danach 'sonstige' / 'sonstige' (ihre Herkunft ist nicht mehr bekannt).
--   2. Primaerschluessel um beide Spalten erweitert: die Summen werden je Kombination gefuehrt.
--   3. public.public_view_agent_families(text) -- NEU, IMMUTABLE: leitet aus der Kennung des Browsers (User-Agent) die zwei Familien
--      ab. Eingabe auf 512 Zeichen begrenzt (laenger, leer, NULL -> 'sonstige'); nur position()-Suchen, kein Regex, keine
--      Rueckverfolgung, Laufzeit linear in 512 Zeichen. Gibt NUR die zwei Familien zurueck, nie Teile der Kennung, keine Versionsnummer.
--      Keine Rechte fuer PUBLIC, anon, authenticated: sie wird nur aus count_public_view (SECURITY DEFINER, Eigentuemer) gerufen.
--      Dadurch taucht sie auch nicht als Schnittstellen-Aufruf (PostgREST /rpc) auf. Rechte-Zusicherung: db_privilege_assertions.sql.
--   4. public.count_public_view(...) -- GLEICHE Signatur, gleiche Rechte, gleicher Fehler-Verzicht (@RZ-028): liest die Kennung aus
--      current_setting('request.headers', true) (JSON, setzt PostgREST je Aufruf; Schluessel 'user-agent') und zaehlt unter den
--      abgeleiteten Familien. Fehlt die Einstellung (Aufruf ueber psql, nicht ueber PostgREST), ist sie leer, kein gueltiges JSON,
--      ohne Schluessel oder uebergross (mehr als 64 KiB) -> 'sonstige' / 'sonstige', nie ein Fehler (@RZ-032).
--
-- Ableitung (Reihenfolge ist Teil der Regel; Suche je Token im Text):
--   System:  iPhone, iPad oder iPod -> ios | Android -> android | Windows -> windows | Macintosh oder Mac OS X -> macos | sonst sonstige.
--            (iOS-Kennungen tragen "like Mac OS X", darum ios zuerst. Ein iPad, das sich als Mac ausgibt, zaehlt als macos: bekannt, bleibt.)
--   Browser: SamsungBrowser -> samsung | Firefox oder FxiOS -> firefox | Edg/, EdgA/, EdgiOS/, Edge/, OPR/, OPT/, OPiOS, Opera -> sonstige
--            | Android-WebView ("; wv)") -> sonstige | Chrome/ oder CriOS/ -> chrome | Safari/ mit Version/ und ohne Android -> safari
--            | sonst sonstige. (Chrome-Kennungen tragen "Safari", Edge, Opera und Samsung tragen "Chrome": darum diese Reihenfolge.)
--   Edge ist bewusst KEINE eigene Familie (Auftrag: Frage an den Product Owner). Edge, Opera und alle anderen -> 'sonstige'.
--
-- Rueckwaertsvertraeglichkeit (der heute ausgelieferte Client bleibt ohne Aenderung funktionsfaehig, vor und nach dem Einspielen):
--   - count_public_view hat dieselbe Signatur (text, text, text, text, boolean), denselben Rueckgabetyp void, dieselben Rechte; der
--     Client sendet nichts Neues. Die Kennung kommt vom Browser ohnehin bei jedem Aufruf mit.
--   - Alle Bedingungen des Zaehlens (Code, Art, Geraeteart, oeffentliches nicht geloeschtes Turnier, stilles Ende) sind woertlich die
--     der Fassung 20261124_003; nur der Schluessel ist laenger.
--   - Die Migration laeuft in EINER Transaktion; ein Aufruf sieht entweder den Stand davor oder den Stand danach, nie eine Mischung.
--   - Die neuen Spalten haben eine Vorgabe: Bestandszeilen und jeder Schreiber ohne die Spalten bleiben gueltig.
--
-- Sperren: lock_timeout 5 s wie die uebrigen Fenster-Dateien; ADD COLUMN mit konstanter Vorgabe schreibt die Tabelle nicht um, der
--   Primaerschluessel wird auf der kleinen Tabelle (Summen je 5 Minuten) neu aufgebaut; die Tabelle ist dabei kurz (Millisekunden)
--   gesperrt. Schreiber warten dann kurz, sie scheitern nicht. Bei 55P03 (Sperre nicht erhalten) genau einmal wiederholen.
-- Voraussetzungen (Fail-fast, ohne Aenderung): 20261124_003 (Tabelle in der Fassung davor oder schon dieser; count_public_view in der
--   Fassung 20261124_003, prosrc-md5 859971c10b8dfb7bc30ed9ac8444df14, oder schon dieser), Postgres mit pg_input_is_valid (16+).
-- Idempotent: zweimal einspielbar (ADD COLUMN IF NOT EXISTS, Primaerschluessel nur bei abweichender Fassung, CREATE OR REPLACE).
--
-- RUECKWEG: supabase/rollbacks/20261126_001_zuschauer_zaehlung_os_browser_rollback.sql (fuehrt die Summen je Kombination wieder
--   zusammen, kein Datenverlust bei den Summen; stellt Primaerschluessel und count_public_view der Fassung 003 wieder her). Der Rueckweg
--   von 003 darf erst danach laufen. Belegt in scripts/zuschauer-zaehlung-check.sh.
-- Produktion: nur nach Freigabe (SQL + SHA). Dieser Branch spielt nichts ein. Typen nachgezogen (src/types/supabase.ts).
-- Rein ASCII.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Aenderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $pre$
DECLARE
  v_pk text;
BEGIN
  IF to_regclass('public.public_view_counts') IS NULL
     OR to_regprocedure('public.count_public_view(text,text,text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION '20261126_001_zuschauer_zaehlung_os_browser: Zuschauer-Zaehlung (20261124_003) fehlt -- zuerst einspielen';
  END IF;
  IF to_regprocedure('pg_input_is_valid(text,text)') IS NULL THEN
    RAISE EXCEPTION '20261126_001_zuschauer_zaehlung_os_browser: pg_input_is_valid fehlt (Postgres 16 oder neuer noetig)';
  END IF;
  IF coalesce(md5((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.count_public_view(text,text,text,text,boolean)'))), '')
       <> '859971c10b8dfb7bc30ed9ac8444df14'
     AND position('public_view_agent_families' IN
           (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.count_public_view(text,text,text,text,boolean)'))) = 0 THEN
    RAISE EXCEPTION '20261126_001_zuschauer_zaehlung_os_browser: count_public_view ist weder die Fassung 20261124_003 noch diese -- abgebrochen';
  END IF;
  SELECT string_agg(a.attname, ',' ORDER BY k.ord) INTO v_pk
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
   WHERE c.conrelid = to_regclass('public.public_view_counts') AND c.contype = 'p';
  IF coalesce(v_pk, '') NOT IN ('tournament_id,window_start,channel,device_class,installed',
                                'tournament_id,window_start,channel,device_class,installed,os_family,browser_family') THEN
    RAISE EXCEPTION '20261126_001_zuschauer_zaehlung_os_browser: Primaerschluessel von public_view_counts ist nicht in der erwarteten Fassung (%)', coalesce(v_pk, 'keiner');
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Spalten und Primaerschluessel
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.public_view_counts
  ADD COLUMN IF NOT EXISTS os_family text NOT NULL DEFAULT 'sonstige'
    CONSTRAINT public_view_counts_os_family_check CHECK (os_family IN ('ios', 'android', 'windows', 'macos', 'sonstige'));
ALTER TABLE public.public_view_counts
  ADD COLUMN IF NOT EXISTS browser_family text NOT NULL DEFAULT 'sonstige'
    CONSTRAINT public_view_counts_browser_family_check CHECK (browser_family IN ('safari', 'chrome', 'firefox', 'samsung', 'sonstige'));

DO $pk$
DECLARE
  v_pk text;
BEGIN
  SELECT string_agg(a.attname, ',' ORDER BY k.ord) INTO v_pk
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
   WHERE c.conrelid = 'public.public_view_counts'::regclass AND c.contype = 'p';
  IF v_pk <> 'tournament_id,window_start,channel,device_class,installed,os_family,browser_family' THEN
    ALTER TABLE public.public_view_counts DROP CONSTRAINT public_view_counts_pkey;
    ALTER TABLE public.public_view_counts
      ADD CONSTRAINT public_view_counts_pkey
      PRIMARY KEY (tournament_id, window_start, channel, device_class, installed, os_family, browser_family);
  END IF;
END
$pk$;

COMMENT ON COLUMN public.public_view_counts.os_family IS
  'Betriebssystem-Familie aus der Kennung des Browsers (@RZ-031): ios, android, windows, macos, sonstige. Nie die Kennung selbst.';
COMMENT ON COLUMN public.public_view_counts.browser_family IS
  'Browser-Familie aus der Kennung des Browsers (@RZ-031): safari, chrome, firefox, samsung, sonstige. Nie die Kennung selbst, keine Version.';
COMMENT ON TABLE public.public_view_counts IS
  'Zuschauer-Seite zaehlen (@RZ-024..032): nur Summen je Turnier, 5-Minuten-Fenster, Kanal, Geraeteklasse, installiert, Betriebssystem- und Browser-Familie. Kein Client-Zugriff, nur Betreiber.';

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Ableitung der zwei Familien aus der Kennung (rein, unveraenderlich, ohne Rechte fuer Client-Rollen)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_view_agent_families(p_agent text)
RETURNS TABLE (os_family text, browser_family text)
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
  WITH a AS (
    SELECT CASE WHEN p_agent IS NULL OR char_length(p_agent) > 512 THEN '' ELSE p_agent END AS ua
  )
  SELECT
    CASE
      WHEN position('iPhone' IN ua) > 0 OR position('iPad' IN ua) > 0 OR position('iPod' IN ua) > 0 THEN 'ios'
      WHEN position('Android' IN ua) > 0 THEN 'android'
      WHEN position('Windows' IN ua) > 0 THEN 'windows'
      WHEN position('Macintosh' IN ua) > 0 OR position('Mac OS X' IN ua) > 0 THEN 'macos'
      ELSE 'sonstige'
    END,
    CASE
      WHEN position('SamsungBrowser' IN ua) > 0 THEN 'samsung'
      WHEN position('Firefox' IN ua) > 0 OR position('FxiOS' IN ua) > 0 THEN 'firefox'
      WHEN position('Edg/' IN ua) > 0 OR position('EdgA/' IN ua) > 0 OR position('EdgiOS/' IN ua) > 0 OR position('Edge/' IN ua) > 0
        OR position('OPR/' IN ua) > 0 OR position('OPT/' IN ua) > 0 OR position('OPiOS' IN ua) > 0 OR position('Opera' IN ua) > 0 THEN 'sonstige'
      WHEN position('; wv)' IN ua) > 0 THEN 'sonstige'
      WHEN position('Chrome/' IN ua) > 0 OR position('CriOS/' IN ua) > 0 THEN 'chrome'
      WHEN position('Safari/' IN ua) > 0 AND position('Version/' IN ua) > 0 AND position('Android' IN ua) = 0 THEN 'safari'
      ELSE 'sonstige'
    END
  FROM a;
$$;
COMMENT ON FUNCTION public.public_view_agent_families(text) IS
  'Zuschauer-Seite zaehlen (@RZ-031/032): leitet aus der Kennung des Browsers NUR Betriebssystem- und Browser-Familie ab; Eingabe auf 512 Zeichen begrenzt; nur aus count_public_view aufgerufen.';
REVOKE ALL ON FUNCTION public.public_view_agent_families(text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. count_public_view: gleiche Signatur und Rechte, zaehlt zusaetzlich unter den abgeleiteten Familien
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
$$;
COMMENT ON FUNCTION public.count_public_view(text, text, text, text, boolean) IS
  'Zuschauer-Seite zaehlen (@RZ-024..032): +1 Aufruf oder Lebenszeichen im laufenden 5-Minuten-Fenster, aufgeteilt nach Betriebssystem- und Browser-Familie (aus der Kennung des Aufrufs); nur oeffentliche Turniere; still bei allem anderen; speichert nur Summen.';

REVOKE ALL ON FUNCTION public.count_public_view(text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_public_view(text, text, text, text, boolean) TO anon, authenticated, service_role;

COMMIT;
