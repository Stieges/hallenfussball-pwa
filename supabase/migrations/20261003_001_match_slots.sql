-- A-02 (MVP-Bauplan Spur A, Gruppe GA1, docs/superpowers/plans/2026-10-03-mvp-bauplan.md;
-- Vorlage V-TEAM-Plan §2a/V9): Spielseite = Team-ID ODER strukturierte Herkunft.
--
-- Warum (C-TEAMREF): Die App schrieb bisher die Team-ID als TEXT in team_a/b_placeholder und liess
-- team_a_id/team_b_id leer (Namenssuche im Mapper fand nichts). append_match_events lehnt solche
-- Spiele mit 22023 „noch keine zwei Teams“ ab -- kein Engine-Eintrag eines App-Turniers kam an.
-- Ab jetzt: team_a_id/team_b_id sind fuehrend; eine noch offene Seite traegt ihre Herkunft
-- strukturiert in slot_a_source/slot_b_source (bleibt nach der Aufloesung erhalten).
--
-- Herkunft (gleiche Regeln wie src/core/models/schemas/MatchSlotSchema.ts, A-01):
--   {"kind":"groupRank","group":"<1..40 Zeichen>","rank":<1..99>}
--   {"kind":"matchResult","matchId":"<UUID klein>","role":"winner"|"loser"}
--   genau diese drei Schluessel.
--
-- Bestandsdaten (Bauplan E-A5): Altzeilen tragen team_x_id NULL und die Team-UUID im Platzhalter.
-- Deterministischer Backfill: team_x_id := team_x_placeholder::uuid, wenn der Platzhalter eine UUID
-- eines Teams DESSELBEN Turniers ist; danach Platzhalter NULL. Dann die neuen Pruefregeln
-- NOT VALID + VALIDATE im selben Transaktionsblock: bleibt eine Seite ohne Team-ID und ohne
-- Herkunft (z. B. Platzhalter „Team X“), scheitert VALIDATE und die GANZE Migration rollt zurueck
-- (kein Backfill, keine Spalten). Prognose-Zaehlung vor dem Live-Einspielen: Bauplan P1-4 (erwartet 0).
--
-- team_a/b_placeholder bleiben als Spalte bestehen (nur noch NULL, von der App nicht mehr gelesen
-- oder geschrieben); das Entfernen ist eine eigene Aufgabe (Altweg-Abriss), weil
-- tests/e2e/cloud/public-view.cloud.spec.ts die Spalten noch per REST abfragt.
--
-- Voraussetzung: 20260928_002_match_engine.sql (Schema match_engine). Idempotent.
-- NUR lokal/Container. Live erst nach P1 und Daniels Freigabe (SQL wird vorher woertlich gezeigt).

BEGIN;

DO $$
BEGIN
  IF to_regnamespace('match_engine') IS NULL THEN
    RAISE EXCEPTION '20261003_001_match_slots: Schema match_engine fehlt -- zuerst 20260928_002 einspielen';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION match_engine.slot_source_valid(p jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p IS NULL OR jsonb_typeof(p) <> 'object' THEN false
    WHEN p ->> 'kind' = 'groupRank' THEN
          (SELECT count(*) FROM jsonb_object_keys(p)) = 3
      AND p ?& ARRAY['kind', 'group', 'rank']
      AND jsonb_typeof(p -> 'group') = 'string' AND char_length(p ->> 'group') BETWEEN 1 AND 40
      AND jsonb_typeof(p -> 'rank') = 'number' AND (p ->> 'rank') ~ '^[1-9][0-9]?$'
    WHEN p ->> 'kind' = 'matchResult' THEN
          (SELECT count(*) FROM jsonb_object_keys(p)) = 3
      AND p ?& ARRAY['kind', 'matchId', 'role']
      AND jsonb_typeof(p -> 'matchId') = 'string'
      AND (p ->> 'matchId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND jsonb_typeof(p -> 'role') = 'string' AND (p ->> 'role') IN ('winner', 'loser')
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION match_engine.slot_source_valid(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_engine.slot_source_valid(jsonb) TO anon, authenticated, service_role;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS slot_a_source jsonb,
  ADD COLUMN IF NOT EXISTS slot_b_source jsonb;
COMMENT ON COLUMN public.matches.slot_a_source IS
  'Herkunft der Heimseite (groupRank|matchResult), Pflicht wenn team_a_id NULL; bleibt nach Aufloesung erhalten.';
COMMENT ON COLUMN public.matches.slot_b_source IS
  'Herkunft der Gastseite (groupRank|matchResult), Pflicht wenn team_b_id NULL; bleibt nach Aufloesung erhalten.';

-- Bestandsdaten (E-A5): Platzhalter = UUID eines Teams desselben Turniers -> Team-ID.
-- CASE statt AND, damit der ::uuid-Cast nur fuer UUID-foermige Platzhalter ausgewertet wird.
UPDATE public.matches m
   SET team_a_id = m.team_a_placeholder::uuid,
       team_a_placeholder = NULL
 WHERE m.team_a_id IS NULL
   AND EXISTS (SELECT 1 FROM public.teams x
                WHERE x.tournament_id = m.tournament_id
                  AND x.id = CASE WHEN m.team_a_placeholder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                  THEN m.team_a_placeholder::uuid END);
UPDATE public.matches m
   SET team_b_id = m.team_b_placeholder::uuid,
       team_b_placeholder = NULL
 WHERE m.team_b_id IS NULL
   AND EXISTS (SELECT 1 FROM public.teams x
                WHERE x.tournament_id = m.tournament_id
                  AND x.id = CASE WHEN m.team_b_placeholder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                  THEN m.team_b_placeholder::uuid END);

-- Neue Pruefregeln: erst NOT VALID (gilt sofort fuer neue/geaenderte Zeilen), dann VALIDATE gegen
-- den Bestand -- scheitert es, rollt der ganze Block zurueck.
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_slot_a_source_valid;
ALTER TABLE public.matches ADD CONSTRAINT matches_slot_a_source_valid
  CHECK (slot_a_source IS NULL OR match_engine.slot_source_valid(slot_a_source)) NOT VALID;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_slot_b_source_valid;
ALTER TABLE public.matches ADD CONSTRAINT matches_slot_b_source_valid
  CHECK (slot_b_source IS NULL OR match_engine.slot_source_valid(slot_b_source)) NOT VALID;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_slot_a_present;
ALTER TABLE public.matches ADD CONSTRAINT matches_slot_a_present
  CHECK (team_a_id IS NOT NULL OR slot_a_source IS NOT NULL) NOT VALID;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_slot_b_present;
ALTER TABLE public.matches ADD CONSTRAINT matches_slot_b_present
  CHECK (team_b_id IS NOT NULL OR slot_b_source IS NOT NULL) NOT VALID;

ALTER TABLE public.matches VALIDATE CONSTRAINT matches_slot_a_source_valid;
ALTER TABLE public.matches VALIDATE CONSTRAINT matches_slot_b_source_valid;
ALTER TABLE public.matches VALIDATE CONSTRAINT matches_slot_a_present;
ALTER TABLE public.matches VALIDATE CONSTRAINT matches_slot_b_present;

COMMIT;
