-- supabase/rollbacks/20261118_002_endstand_tabellenwerte_rollback.sql
-- RUECKWEG zu supabase/migrations/20261118_002_endstand_tabellenwerte.sql (R3-5b): die Zeilenpruefung des Endstands woertlich
-- wie vorher (20261113_003_tournament_lifecycle.sql, Zeilen 399-465). Liegt bewusst NICHT in supabase/migrations.
-- Reihenfolge: ZUERST die App auf den Stand ohne R3-5b (sie schreibt sonst tableValues, die die alte Funktion ablehnt),
-- DANN dieser Block. Schon gespeicherte Endstaende mit tableValues bleiben lesbar (die Funktion prueft nur beim Abschluss).

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION match_engine.final_standing_row_valid(r jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  o jsonb;
  g jsonb;
BEGIN
  IF jsonb_typeof(r) IS DISTINCT FROM 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(r) k WHERE k NOT IN ('place', 'teamId', 'teamName', 'origin', 'perGame'))
     OR NOT (r ?& ARRAY['place', 'teamId', 'teamName', 'origin']) THEN
    RETURN false;
  END IF;
  IF NOT match_engine.json_int_between(r -> 'place', 1, 999)
     OR jsonb_typeof(r -> 'teamId') IS DISTINCT FROM 'string'
     OR (r ->> 'teamId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR NOT match_engine.json_text_length_between(r -> 'teamName', 1, 200) THEN
    RETURN false;
  END IF;
  o := r -> 'origin';
  IF jsonb_typeof(o) IS DISTINCT FROM 'object' OR jsonb_typeof(o -> 'kind') IS DISTINCT FROM 'string' THEN
    RETURN false;
  END IF;
  CASE o ->> 'kind'
    WHEN 'placementGame' THEN
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(o) k WHERE k NOT IN ('kind', 'finalType', 'role'))
         OR NOT (o ?& ARRAY['finalType', 'role'])
         OR jsonb_typeof(o -> 'finalType') IS DISTINCT FROM 'string'
         OR (o ->> 'finalType') NOT IN ('final', 'thirdPlace', 'fifthSixth', 'seventhEighth')
         OR jsonb_typeof(o -> 'role') IS DISTINCT FROM 'string' OR (o ->> 'role') NOT IN ('winner', 'loser') THEN
        RETURN false;
      END IF;
    WHEN 'koRound' THEN
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(o) k WHERE k NOT IN ('kind', 'round'))
         OR jsonb_typeof(o -> 'round') IS DISTINCT FROM 'string' OR (o ->> 'round') NOT IN ('semi', 'quarter', 'r16') THEN
        RETURN false;
      END IF;
    WHEN 'groupPlace' THEN
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(o) k WHERE k NOT IN ('kind', 'group', 'place'))
         OR NOT match_engine.json_text_length_between(o -> 'group', 0, 40)
         OR NOT match_engine.json_int_between(o -> 'place', 1, 999) THEN
        RETURN false;
      END IF;
    WHEN 'open' THEN
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(o) k WHERE k NOT IN ('kind', 'finalType'))
         OR (o ? 'finalType' AND (jsonb_typeof(o -> 'finalType') IS DISTINCT FROM 'string'
                                  OR (o ->> 'finalType') NOT IN ('final', 'thirdPlace', 'fifthSixth', 'seventhEighth'))) THEN
        RETURN false;
      END IF;
    ELSE
      RETURN false;
  END CASE;
  IF r ? 'perGame' THEN
    g := r -> 'perGame';
    IF jsonb_typeof(g) IS DISTINCT FROM 'object'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(g) k WHERE k NOT IN ('points', 'goalDiff', 'goals', 'games'))
       OR NOT (g ?& ARRAY['points', 'goalDiff', 'goals', 'games'])
       OR jsonb_typeof(g -> 'points') IS DISTINCT FROM 'number' OR (g ->> 'points')::numeric < 0
       OR jsonb_typeof(g -> 'goalDiff') IS DISTINCT FROM 'number'
       OR jsonb_typeof(g -> 'goals') IS DISTINCT FROM 'number' OR (g ->> 'goals')::numeric < 0
       OR NOT match_engine.json_int_between(g -> 'games', 1, 1e12) THEN
      RETURN false;
    END IF;
  END IF;
  RETURN true;
END;
$$;

COMMIT;
