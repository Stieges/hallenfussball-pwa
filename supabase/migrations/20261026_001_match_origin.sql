-- supabase/migrations/20261026_001_match_origin.sql
-- A-36a (MVP-Bauplan § 23, Auflage Re-Review C5C6-F 2026-10-15): Herkunft des PLATZES als eigenes Feld am Spiel.
--
-- Warum: slot_a/b_source traegt die Herkunft der BESETZUNG (offen: Herkunft, automatisch besetzt: resolvedFrom,
-- von Hand besetzt: NULL). Vorlage (@DR-005), Spielplan auf Anfang (@SA-011), Folgen-Hinweis und die Anzeige
-- brauchen die Herkunft des Platzes auch nach „Neu besetzen“. origin_a/b wird beim Anlegen aus
-- def.teamASource/teamBSource geschrieben (playoffScheduler) und danach nie mehr geaendert; playoffResolver,
-- Neu-Besetzen und Spielplan auf Anfang fassen es nicht an (Zuruecksetzen schreibt slot_x_source := origin_x).
-- Form wie slot_x_source (match_engine.slot_source_valid). Gruppenspiele: NULL.
-- Bestand: origin := slot_x_source (offen bzw. automatisch besetzt). Von Hand besetzte Altzeilen bleiben NULL;
-- die Anzeige zeigt dort „noch offen“ statt einer geratenen Herkunft.
-- Fehlercode HF002 (Liste: HF001 make_tournament_public, HF002 Herkunft unveraenderlich).
-- Voraussetzung: 20261003_001_match_slots.sql. Idempotent. NUR lokal/Container; Live nach Daniels Freigabe (F1).
--
-- RUECKBAU (Reihenfolge: ZUERST die App auf den Stand ohne origin_* zurueck, DANN die Datenbank – sonst scheitert
-- jedes Insert/Upsert der neuen App an der fehlenden Spalte origin_a):
--   BEGIN;
--   DROP TRIGGER IF EXISTS matches_keep_origin ON public.matches;
--   DROP FUNCTION IF EXISTS public.matches_keep_origin();
--   ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_origin_a_valid;
--   ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_origin_b_valid;
--   ALTER TABLE public.matches DROP COLUMN IF EXISTS origin_a, DROP COLUMN IF EXISTS origin_b;
--   COMMIT;
--   Danach Drift-Check-Zahlen und db_privilege_assertions.sql auf den Stand davor.

BEGIN;

-- Fixrunde A-36a (Review Nr. 10, Muster 20261001_001): Sperren auf matches begrenzen. Innerhalb des
-- bestehenden Transaktionsblocks, kein zusaetzliches BEGIN -- SET LOCAL gilt nur bis COMMIT.
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regprocedure('match_engine.slot_source_valid(jsonb)') IS NULL THEN
    RAISE EXCEPTION '20261026_001_match_origin: match_engine.slot_source_valid fehlt -- zuerst 20261003_001 einspielen';
  END IF;
END $$;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS origin_a jsonb,
  ADD COLUMN IF NOT EXISTS origin_b jsonb;
COMMENT ON COLUMN public.matches.origin_a IS
  'Herkunft des Heim-Platzes (groupRank|matchResult), beim Anlegen gesetzt, danach unveraenderlich; NULL bei Gruppenspielen.';
COMMENT ON COLUMN public.matches.origin_b IS
  'Herkunft des Gast-Platzes (groupRank|matchResult), beim Anlegen gesetzt, danach unveraenderlich; NULL bei Gruppenspielen.';

UPDATE public.matches SET origin_a = slot_a_source WHERE origin_a IS NULL AND slot_a_source IS NOT NULL;
UPDATE public.matches SET origin_b = slot_b_source WHERE origin_b IS NULL AND slot_b_source IS NOT NULL;

-- Muster wie A-02: erst NOT VALID, dann VALIDATE im selben Block (N6).
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_origin_a_valid;
ALTER TABLE public.matches ADD CONSTRAINT matches_origin_a_valid
  CHECK (origin_a IS NULL OR match_engine.slot_source_valid(origin_a)) NOT VALID;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_origin_b_valid;
ALTER TABLE public.matches ADD CONSTRAINT matches_origin_b_valid
  CHECK (origin_b IS NULL OR match_engine.slot_source_valid(origin_b)) NOT VALID;
ALTER TABLE public.matches VALIDATE CONSTRAINT matches_origin_a_valid;
ALTER TABLE public.matches VALIDATE CONSTRAINT matches_origin_b_valid;

-- Einmal gesetzt, nie geaendert: NULL im Update behaelt den alten Wert (Schreiber ohne das Feld),
-- ein anderer Wert scheitert laut.
CREATE OR REPLACE FUNCTION public.matches_keep_origin() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.origin_a IS NOT NULL THEN
    IF NEW.origin_a IS NULL THEN
      NEW.origin_a := OLD.origin_a;
    ELSIF NEW.origin_a IS DISTINCT FROM OLD.origin_a THEN
      RAISE EXCEPTION 'Herkunft eines Platzes ist unveraenderlich (Spiel %, Seite A)', OLD.id USING ERRCODE = 'HF002';
    END IF;
  END IF;
  IF OLD.origin_b IS NOT NULL THEN
    IF NEW.origin_b IS NULL THEN
      NEW.origin_b := OLD.origin_b;
    ELSIF NEW.origin_b IS DISTINCT FROM OLD.origin_b THEN
      RAISE EXCEPTION 'Herkunft eines Platzes ist unveraenderlich (Spiel %, Seite B)', OLD.id USING ERRCODE = 'HF002';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.matches_keep_origin() FROM PUBLIC;

DROP TRIGGER IF EXISTS matches_keep_origin ON public.matches;
CREATE TRIGGER matches_keep_origin
  BEFORE UPDATE OF origin_a, origin_b ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.matches_keep_origin();

COMMIT;
