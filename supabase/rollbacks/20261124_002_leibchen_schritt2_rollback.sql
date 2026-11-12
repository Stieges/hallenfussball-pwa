-- supabase/rollbacks/20261124_002_leibchen_schritt2_rollback.sql
-- RUECKWEG zu supabase/migrations/20261124_002_leibchen_schritt2.sql. Liegt bewusst NICHT in supabase/migrations.
-- Vorher: die App ohne Leibchen-Karte und ohne Lesen von kit_decision (Schritt 2a/2b zurueck). Der Rueckweg loescht den
-- Zustand der Wahl (matches.kit_decision) und beide neuen Funktionen; Waechter und Anpfiff-Projektion stehen wieder woertlich
-- wie in 20261028_004_match_kit_colors.sql (md5 des Funktionstexts mit dem Original vergleichen). Bestaetigte Leibchen
-- noch nicht angepfiffener Spiele bleiben als bib_side/kit_color_x stehen; das letzte Statement (auskommentiert) loescht sie,
-- falls gewollt. Beweis: scripts/leibchen-kit-check.sh (Kategorie X: Schema nach dem Rueckweg = Schema vor der Migration).

BEGIN;
SET LOCAL lock_timeout = '5s';

DROP TRIGGER IF EXISTS matches_kit_reset_on_team_change ON public.matches;
DROP FUNCTION IF EXISTS public.matches_kit_reset_on_team_change();
DROP FUNCTION IF EXISTS public.match_kit_set(uuid, text, jsonb, uuid, integer);
DROP FUNCTION IF EXISTS public.match_kit_team_color(uuid);

-- Fassungen woertlich aus 20261028_004_match_kit_colors.sql
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

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_kit_decision_valid;
ALTER TABLE public.matches DROP COLUMN IF EXISTS kit_decision;

-- Optional (als Eigentuemer; der Waechter blockt nur Client-Rollen): schon vor dem Anpfiff bestaetigte Leibchen loeschen.
-- UPDATE public.matches SET kit_color_a = NULL, kit_color_b = NULL, bib_side = NULL WHERE match_status IN ('scheduled', 'waiting');

COMMIT;
