-- supabase/migrations/20261028_004_match_kit_colors.sql
-- A-30F (Bauplan Nachtrag 2026-10-15, @W3-028, @SL-137, @ZM-140): getragene Farben je Spiel.
-- Quelle: MATCH_START.payload.kit = {"a": "#RRGGBB", "b": "#RRGGBB", "bibSide": "a"|"b"} (Client, Anpfiff-Ansicht).
-- Der Server speichert das Payload wie gesendet (Ruling K4, append_match_events setzt nur payload.rules; juengste
-- Fassung 20261028_003_result_entry_shootout.sql, diese Migration aendert append_match_events NICHT).
-- Dieser Trigger uebertraegt die Farben beim Speichern des MATCH_START in die Spalten am Spiel. Nur er schreibt sie;
-- Client-Rollen koennen sie weder setzen noch aendern (HF003). Laufende/beendete Spiele behalten ihre Farbe (@W3-028).
-- Ungueltige Werte werden zu NULL (keine getragene Farbe: die Anzeige nimmt ihre Vorgabe; ein angepfiffenes Spiel
-- nimmt nie eine spaeter eingetragene Teamfarbe an, @W3-028), nie Abbruch des Anpfiffs.
-- Bestand: keine Zeile betroffen (neue Spalten NULL). Idempotent.
-- Fehlercode HF003 (Liste: HF001 make_tournament_public, HF002 Herkunft unveraenderlich, HF003 getragene Farbe).
-- RUECKBAU (zuerst App ohne kit_* zurueck, dann):
--   DROP TRIGGER IF EXISTS match_events_kit_from_match_start ON public.match_events;
--   DROP TRIGGER IF EXISTS matches_guard_kit_columns ON public.matches;
--   DROP FUNCTION IF EXISTS public.matches_kit_from_match_start();
--   DROP FUNCTION IF EXISTS public.matches_guard_kit_columns();
--   ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_kit_color_a_form,
--     DROP CONSTRAINT IF EXISTS matches_kit_color_b_form, DROP CONSTRAINT IF EXISTS matches_bib_side_valid;
--   ALTER TABLE public.matches DROP COLUMN IF EXISTS kit_color_a, DROP COLUMN IF EXISTS kit_color_b,
--     DROP COLUMN IF EXISTS bib_side;

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)') IS NULL THEN
    RAISE EXCEPTION '20261028_004_match_kit_colors: append_match_events fehlt -- zuerst 20261001_001 einspielen';
  END IF;
END $$;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS kit_color_a text,
  ADD COLUMN IF NOT EXISTS kit_color_b text,
  ADD COLUMN IF NOT EXISTS bib_side text;
COMMENT ON COLUMN public.matches.kit_color_a IS 'Getragene Farbe Heimseite (#RRGGBB), beim Anpfiff festgehalten; nur Server.';
COMMENT ON COLUMN public.matches.kit_color_b IS 'Getragene Farbe Gastseite (#RRGGBB), beim Anpfiff festgehalten; nur Server.';
COMMENT ON COLUMN public.matches.bib_side    IS 'Seite mit Leibchen in diesem Spiel (a|b) oder NULL; nur Server.';

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_kit_color_a_form;
ALTER TABLE public.matches ADD CONSTRAINT matches_kit_color_a_form
  CHECK (kit_color_a IS NULL OR kit_color_a ~ '^#[0-9A-F]{6}$') NOT VALID;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_kit_color_b_form;
ALTER TABLE public.matches ADD CONSTRAINT matches_kit_color_b_form
  CHECK (kit_color_b IS NULL OR kit_color_b ~ '^#[0-9A-F]{6}$') NOT VALID;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_bib_side_valid;
ALTER TABLE public.matches ADD CONSTRAINT matches_bib_side_valid
  CHECK (bib_side IS NULL OR bib_side IN ('a', 'b')) NOT VALID;
ALTER TABLE public.matches VALIDATE CONSTRAINT matches_kit_color_a_form;
ALTER TABLE public.matches VALIDATE CONSTRAINT matches_kit_color_b_form;
ALTER TABLE public.matches VALIDATE CONSTRAINT matches_bib_side_valid;

-- Server-Projektion aus dem gespeicherten MATCH_START.
CREATE OR REPLACE FUNCTION public.matches_kit_from_match_start() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kit jsonb := NEW.payload -> 'kit';
  v_a   text;
  v_b   text;
  v_bib text;
BEGIN
  IF v_kit IS NULL OR jsonb_typeof(v_kit) <> 'object' THEN
    RETURN NULL;
  END IF;
  v_a   := upper(v_kit ->> 'a');
  v_b   := upper(v_kit ->> 'b');
  v_bib := v_kit ->> 'bibSide';
  IF v_a IS NOT NULL AND v_a !~ '^#[0-9A-F]{6}$' THEN v_a := NULL; END IF;
  IF v_b IS NOT NULL AND v_b !~ '^#[0-9A-F]{6}$' THEN v_b := NULL; END IF;
  IF v_bib IS NOT NULL AND v_bib NOT IN ('a', 'b') THEN v_bib := NULL; END IF;
  UPDATE public.matches
     SET kit_color_a = v_a, kit_color_b = v_b, bib_side = v_bib
   WHERE id = NEW.match_id;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.matches_kit_from_match_start() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS match_events_kit_from_match_start ON public.match_events;
CREATE TRIGGER match_events_kit_from_match_start
  AFTER INSERT ON public.match_events
  FOR EACH ROW WHEN (NEW.type = 'MATCH_START')
  EXECUTE FUNCTION public.matches_kit_from_match_start();

-- Nur der Server schreibt die getragenen Farben (Muster matches_guard_engine_columns: current_user der Client-Rollen).
CREATE OR REPLACE FUNCTION public.matches_guard_kit_columns() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.kit_color_a := NULL;
      NEW.kit_color_b := NULL;
      NEW.bib_side    := NULL;
    ELSIF NEW.kit_color_a IS DISTINCT FROM OLD.kit_color_a
       OR NEW.kit_color_b IS DISTINCT FROM OLD.kit_color_b
       OR NEW.bib_side    IS DISTINCT FROM OLD.bib_side THEN
      RAISE EXCEPTION 'Getragene Farben setzt nur der Anpfiff (Spiel %)', OLD.id USING ERRCODE = 'HF003';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.matches_guard_kit_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS matches_guard_kit_columns ON public.matches;
CREATE TRIGGER matches_guard_kit_columns
  BEFORE INSERT OR UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.matches_guard_kit_columns();

COMMIT;
