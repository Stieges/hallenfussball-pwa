-- supabase/migrations/20261124_003_zuschauer_zaehlung.sql
-- Zuschauer-Seite zaehlen, intern, Stufe 1 (Record docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md, MVP-Schnitt
-- "intern, Stufe 1": @RZ-024, @RZ-025, @RZ-026, @RZ-027, @RZ-028, @RZ-030).
--
-- Inhalt:
--   1. Tabelle public.public_view_counts: NUR Summen je Turnier, 5-Minuten-Fenster (UTC), Kanal, Geraeteart, installiert.
--      Keine Zeile je Besucher, keine IP-Adresse, keine Kennung, kein genauerer Zeitpunkt als das Fenster.
--      ON DELETE CASCADE am Turnier: wird ein Turnier endgueltig geloescht (echtes DELETE, SupabaseRepository.delete), sind
--      auch seine Zahlen weg (@RZ-030). Der Papierkorb (deleted_at) aendert die Zahlen nicht.
--   2. RLS an, KEINE Policy, KEIN Recht fuer anon/authenticated: niemand liest oder schreibt ueber die Schnittstelle (@RZ-030).
--      Der Betreiber liest direkt in der Datenbank (Rolle postgres/service_role).
--   3. public.count_public_view(share_code, art, kanal, geraet, installiert) fuer anon und authenticated: zaehlt +1 im
--      laufenden Fenster. Zaehlt nur fuer ein oeffentliches, nicht geloeschtes Turnier mit genau diesem Code (dieselbe
--      Bedingung wie public_tournament); sonst still nichts (kein Fehler, kein Hinweis, @RZ-028). Gibt nichts zurueck.
--      Unbekannter Kanal -> 'direkt' (@RZ-024 "k=irgendwas"); unbekannte Geraeteart oder Art -> nichts.
--
-- Bestandsdaten: keine. Reiner Zusatz (neue Tabelle, neue Funktion); nichts Bestehendes wird veraendert.
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE, REVOKE/GRANT.
-- RUECKWEG: supabase/rollbacks/20261124_003_zuschauer_zaehlung_rollback.sql (Zahlen gehen dabei verloren).
-- Rein ASCII.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $pre$
BEGIN
  IF to_regclass('public.tournaments') IS NULL THEN
    RAISE EXCEPTION 'Zuschauer-Zaehlung: public.tournaments fehlt';
  END IF;
END
$pre$;

CREATE TABLE IF NOT EXISTS public.public_view_counts (
  tournament_id uuid        NOT NULL REFERENCES public.tournaments (id) ON DELETE CASCADE,
  window_start  timestamptz NOT NULL,
  channel       text        NOT NULL CHECK (channel IN ('qr', 'link', 'direkt')),
  device_class  text        NOT NULL CHECK (device_class IN ('handy', 'tablet', 'gross')),
  installed     boolean     NOT NULL,
  views         bigint      NOT NULL DEFAULT 0 CHECK (views >= 0),
  heartbeats    bigint      NOT NULL DEFAULT 0 CHECK (heartbeats >= 0),
  PRIMARY KEY (tournament_id, window_start, channel, device_class, installed)
);
COMMENT ON TABLE public.public_view_counts IS
  'Zuschauer-Seite zaehlen (@RZ-024..030): nur Summen je Turnier und 5-Minuten-Fenster. Kein Client-Zugriff, nur Betreiber.';

ALTER TABLE public.public_view_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_view_counts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_view_counts TO service_role;

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
$$;
COMMENT ON FUNCTION public.count_public_view(text, text, text, text, boolean) IS
  'Zuschauer-Seite zaehlen (@RZ-024..030): +1 Aufruf oder Lebenszeichen im laufenden 5-Minuten-Fenster; nur oeffentliche Turniere; still bei allem anderen; speichert nur Summen.';

REVOKE ALL ON FUNCTION public.count_public_view(text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_public_view(text, text, text, text, boolean) TO anon, authenticated, service_role;

COMMIT;
