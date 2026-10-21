-- supabase/migrations/20261110_006_group_completion.sql
-- GA4 A-13b (task-GA4-plan-v2.md, Anhang A, Fassung 2.1): „Gruppe abschließen“ am Server, Verlauf der Besetzung und der
-- Gleichstands-Entscheidungen, Folgen-Hinweise, schlanke Klärungsliste, Wiederöffnen.
-- Szenarien: @TM-016, @TM-046, @TM-047, @TM-049, @TM-053, @TM-054, @TM-057, @TM-058, @TM-069, @TM-099, @TM-113,
--   @TM-115, @TM-116, @TM-117, @TM-145, @TM-146, @TM-147; @W2A-004, @W2A-048, @W2A-060, @W2A-063, @W2A-070,
--   @W2A-071, @W2A-072; @ET-027, @ET-029. Befunde C-FIN (Gruppenteil), C-ENTSCHEIDUNG-PERSON-OEFFENTLICH,
--   C-MATCHVERSION-NUR-ENGINE, C-GRUPPE-ALL-UNEINHEITLICH.
--
-- Inhalt:
--   1. matches.reassigned_at (+ Schutz: nur der Server schreibt)
--   2. Tabellen group_completions, bracket_log, bracket_notices, clarifications
--      (RLS; keine Client-Schreibrechte; bracket_log ohne Tabellenrecht – Lesen nur über bracket_log_read)
--   3. Hilfsfunktionen im Schema match_engine (ohne EXECUTE für Client-Rollen)
--   4. RPCs record_standing_decision, complete_group, reopen_group, resolve_bracket_notice, resolve_clarification,
--      bracket_log_read
--   5. Trigger matches_mark_group_stale, tournaments_keep_standing_decisions
--   6. Realtime: group_completions, bracket_notices, clarifications
--
-- Lesarten:
--   Gruppe (R-GA4v2-7): '' = Turnier ohne Gruppen (Jeder gegen jeden). Spiele tragen dort group_letter 'all'
--     (scheduleGenerator/fairScheduler/TournamentCreationService), Teams NULL. match_engine.group_key bildet NULL, ''
--     und 'all' auf '' ab; TS-Zwilling groupKeyOf (standingsGroups.ts), Gleichlauf group-key.json/group-state.json.
--   Seite (R-GA4v2-2): von Hand besetzt <=> team_x_id gesetzt UND slot_x_source IS NULL;
--     Herkunft einer Seite = coalesce(slot_x_source, origin_x); origin_x bleibt unveränderlich (HF002).
-- Sperrreihenfolge (R-GA4v2-8), wie reset_match_results und matches_bump_change_revision:
--   Spiele (nach id, in EINER Anweisung) -> tournaments -> group_completions.
--   record_standing_decision sperrt nur tournaments.
-- Ablehnungen: jsonb {status:'rejected', code, ...}; Konflikte aus der Warteschlange: {status:'clarification', ...}.
-- Rechte: fehlendes Recht -> RAISE 42501 (kein Existenz-Orakel). Die Sperre nach dem Turnierabschluss ergänzt A-21a.
-- Bau A-13b-S gegenüber Anhang A (Fassung 2.1), alle in complete_group, Container-Beweis
-- scripts/group-completion-check.sh:
--   B1 Eine NEUE Reihenfolge (3+ Teams) aus der Warteschlange braucht ihren Grund wie in record_standing_decision
--      (REASON_REQUIRED, @W2A-004); vorher ging sie ohne Grund in den Verlauf.
--   B2 Eine Entscheidung, die am Server schon zurückgenommen wurde (standing_withdraw mit ihrer id), kommt nicht still
--      zurück ins config, sondern ist ein Konflikt DECIDED_ELSEWHERE (@TM-116 „nichts still überschrieben“).
--   M2 (Review A-13b-S) GROUP_REOPENED nur, wenn ein ANDERER die Gruppe wieder geöffnet hat (reopened_by ≠ Aufrufer,
--      @TM-116 Z4 „Maria … wieder geöffnet“). Eigenes Wiederöffnen und danach Abschluss aus der Warteschlange gilt; die
--      Ergebnisse schützt weiter der Stand-Vergleich (RT-10b).
--
-- Voraussetzung: 20261026_001 (origin_a/b), 20261110_001 (manageLifecycle), 20261110_005 (forfeit_absent).
-- Idempotent (IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS + CREATE). Keine Änderung an Bestandszeilen.
--
-- RÜCKWEG (zuerst die App zurück – die neue App ruft complete_group/record_standing_decision und schreibt Entscheidungen
-- nicht mehr per REST; DANN die DB, eigene Datei <Datum>_<NNN>_group_completion_rollback.sql, ein Block; vorher
-- bracket_log per COPY sichern, wenn ein Turnier läuft; DROP TABLE nimmt die Tabellen auch aus der Publication):
--   BEGIN; SET LOCAL lock_timeout = '5s';
--   DROP TRIGGER IF EXISTS matches_mark_group_stale ON public.matches;
--   DROP TRIGGER IF EXISTS matches_guard_ga4_columns ON public.matches;
--   DROP TRIGGER IF EXISTS tournaments_keep_standing_decisions ON public.tournaments;
--   DROP FUNCTION IF EXISTS public.matches_mark_group_stale(), public.matches_guard_ga4_columns(),
--     public.tournaments_keep_standing_decisions(),
--     public.complete_group(uuid, text, uuid[], integer[], jsonb, text[], jsonb, boolean),
--     public.reopen_group(uuid, text, text, boolean), public.record_standing_decision(uuid, text, jsonb, text, integer),
--     public.resolve_bracket_notice(bigint), public.resolve_clarification(bigint), public.bracket_log_read(uuid),
--     match_engine.conflict_or_reject(boolean, uuid, uuid, text, text, jsonb, text, uuid),
--     match_engine.apply_follow_up(uuid, uuid, text, uuid, uuid, jsonb, jsonb, text, uuid, jsonb),
--     match_engine.add_notice(uuid, uuid, text, text, uuid, uuid),
--     match_engine.write_side(uuid, text, uuid, jsonb, boolean),
--     match_engine.shared_allowed(uuid, text, integer[], jsonb), match_engine.standing_decision_valid(jsonb),
--     match_engine.same_team_set(jsonb, jsonb), match_engine.places_to_play_out(jsonb),
--     match_engine.group_state(uuid, text), match_engine.group_key(text);
--   DROP TABLE IF EXISTS public.clarifications, public.bracket_notices, public.bracket_log, public.group_completions;
--   ALTER TABLE public.matches DROP COLUMN IF EXISTS reassigned_at;
--   COMMIT;
--   Danach: Privileg-Assertions + PRIVILEGE_ASSERTION_NAMES zurücknehmen, Drift-Check, Typen-PR.
--   Probe im Container (Auflage 11): Rückweg-Block läuft, danach Drift = Stand vor _006.
--
-- Produktion: nur im DB-Fenster G1 durch den Controller nach Daniels Freigabe (GA4-G1-sql-freigabe.md),
-- Reihenfolge _005 -> _006, danach Drift-Rerun, Merge, Deploy. Dieser Branch spielt nichts ein.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR to_regnamespace('match_engine') IS NULL
     OR to_regprocedure('match_engine.slot_source_valid(jsonb)') IS NULL
     OR to_regclass('public.tournament_collaborators') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'origin_a')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'forfeit_absent')
     OR NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'co-admin' AND permission = 'manageLifecycle') THEN
    RAISE EXCEPTION '20261110_006_group_completion: Voraussetzungen fehlen – zuerst 20261026_001, 20261110_001 und 20261110_005 einspielen';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Spalte und ihr Schutz
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS reassigned_at timestamptz;
COMMENT ON COLUMN public.matches.reassigned_at IS
  'GA4: Seite automatisch neu besetzt (anderes Team als vorher); bis zum Anpfiff als „neu besetzt“ markiert (@TM-070, @TM-071). Nur der Server schreibt (matches_guard_ga4_columns).';

-- 2.1 (Soll 13): Client-Rollen schreiben reassigned_at nie; beim INSERT neutral. G2 (20261113_002) ergänzt advance_team_id.
CREATE OR REPLACE FUNCTION public.matches_guard_ga4_columns() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.reassigned_at := NULL;
    ELSIF NEW.reassigned_at IS DISTINCT FROM OLD.reassigned_at THEN
      RAISE EXCEPTION 'Nicht erlaubt: „neu besetzt“ setzt nur der Server (Spiel %).', OLD.id
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.matches_guard_ga4_columns() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS matches_guard_ga4_columns ON public.matches;
CREATE TRIGGER matches_guard_ga4_columns
  BEFORE INSERT OR UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.matches_guard_ga4_columns();

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Tabellen
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_completions (
  tournament_id  uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  group_id       text        NOT NULL CHECK (char_length(group_id) <= 40),   -- '' = ohne Gruppen (R-GA4v2-7)
  ranking        uuid[]      NOT NULL,
  open_ranks     integer[]   NOT NULL DEFAULT '{}'::integer[],               -- sortiert, ohne Doppelte
  tie_orders     jsonb       NOT NULL DEFAULT '[]'::jsonb,                   -- Kopien der Entscheidungen, ohne Grund/Grundlage
  completed_at   timestamptz NOT NULL DEFAULT now(),
  completed_by   uuid        NOT NULL,
  based_on_state jsonb       NOT NULL,                                       -- match_engine.group_state beim Abschluss
  stale          boolean     NOT NULL DEFAULT false,                         -- Korrektur nach dem Abschluss: Besetzung prüfen
  reopened_at    timestamptz,
  reopened_by    uuid,
  PRIMARY KEY (tournament_id, group_id)
);
COMMENT ON TABLE public.group_completions IS
  'GA4 A-13b: „Gruppe abschließen“ je Gruppe (@TM-046). Nur der Server schreibt (complete_group, reopen_group, Trigger).';

CREATE TABLE IF NOT EXISTS public.bracket_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id      uuid        REFERENCES public.matches(id) ON DELETE SET NULL,
  group_id      text,
  kind          text        NOT NULL,
  detail        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  reason        text        CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 500),
  actor         uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bracket_log DROP CONSTRAINT IF EXISTS bracket_log_kind_check;
ALTER TABLE public.bracket_log ADD CONSTRAINT bracket_log_kind_check CHECK (kind IN (
  'complete_group', 'reopen_group', 'standing_decision', 'standing_withdraw',
  'auto_advance', 'auto_reassign', 'release',
  'set_slot', 'swap_sides', 'set_advancement', 'set_slot_source',          -- Werkzeuge (G2)
  'notice_kept', 'clarification_resolved'));
CREATE INDEX IF NOT EXISTS bracket_log_tournament_idx ON public.bracket_log (tournament_id, id);
COMMENT ON TABLE public.bracket_log IS
  'GA4: Verlauf der Besetzung und der Gleichstands-Entscheidungen mit Person, Zeit und Grund. Nur die Turnierleitung liest ihn, über bracket_log_read (@TM-113, @W2A-071, @W2A-072).';

CREATE TABLE IF NOT EXISTS public.bracket_notices (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id   uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id        uuid        NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  side            text        NOT NULL CHECK (side IN ('A', 'B')),
  kind            text        NOT NULL CHECK (kind IN ('started_follow_up', 'manual_kept', 'released')),
  origin_team_id  uuid,      -- was die Herkunft jetzt ergibt (NULL: Platz wieder offen)
  current_team_id uuid,      -- was dort steht bzw. stand
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     uuid
);
CREATE INDEX IF NOT EXISTS bracket_notices_open_idx ON public.bracket_notices (tournament_id) WHERE resolved_at IS NULL;
COMMENT ON TABLE public.bracket_notices IS
  'GA4: Folgen-Hinweise (@EK-015, @EK-016, @TM-099, @TM-145). Nur der Server schreibt.';

CREATE TABLE IF NOT EXISTS public.clarifications (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id      uuid        REFERENCES public.matches(id) ON DELETE SET NULL,
  group_id      text,
  kind          text        NOT NULL CHECK (kind IN ('complete_group', 'reopen_group', 'set_slot', 'swap_sides',
                                                     'set_advancement', 'set_slot_source')),
  requested     jsonb       NOT NULL,     -- was das Gerät wollte (Parameter, bei Entscheidungen inkl. Grund)
  conflict_code text        NOT NULL CHECK (conflict_code IN ('STALE_VERSION', 'MATCH_STARTED', 'COMPLETED_DIFFERENTLY',
                                                              'GROUP_REOPENED', 'NOT_COMPLETED', 'DECIDED_ELSEWHERE',
                                                              'SHARED_NOT_ALLOWED')),
  server_last   jsonb,                    -- letzte Änderung am Server {actor, kind, at, detail} aus bracket_log
  requested_by  uuid        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid
);
CREATE INDEX IF NOT EXISTS clarifications_open_idx ON public.clarifications (tournament_id) WHERE resolved_at IS NULL;
COMMENT ON TABLE public.clarifications IS
  'GA4 A-15e (schlank): Offline-Aktionen der Turnierleitung, die am Server auf einen Konflikt trafen (@TM-116, @TM-117, @TM-146, @TM-147). Spätere Arten (FU-*) per CHECK-Erweiterung.';

-- Rechte: keine Client-Schreibrechte; anon nichts (C-ANON-STANDARDRECHTE-NEUE-TABELLEN); bracket_log ohne Tabellenrecht.
ALTER TABLE public.group_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracket_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracket_notices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clarifications    ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.group_completions, public.bracket_log, public.bracket_notices, public.clarifications
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.bracket_log_id_seq, public.bracket_notices_id_seq, public.clarifications_id_seq
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.group_completions, public.bracket_notices, public.clarifications TO authenticated;

DROP POLICY IF EXISTS group_completions_select ON public.group_completions;
CREATE POLICY group_completions_select ON public.group_completions FOR SELECT TO authenticated
  USING (public.has_tournament_permission(tournament_id, 'manageLifecycle')
      OR public.has_tournament_permission(tournament_id, 'writeMatchData'));
DROP POLICY IF EXISTS bracket_notices_select ON public.bracket_notices;
CREATE POLICY bracket_notices_select ON public.bracket_notices FOR SELECT TO authenticated
  USING (public.has_tournament_permission(tournament_id, 'manageLifecycle'));
DROP POLICY IF EXISTS clarifications_select ON public.clarifications;
CREATE POLICY clarifications_select ON public.clarifications FOR SELECT TO authenticated
  USING (public.has_tournament_permission(tournament_id, 'manageLifecycle'));

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Hilfsfunktionen (nur aus SECURITY-DEFINER-Funktionen erreichbar)
-- ---------------------------------------------------------------------------------------------------------------

-- 2.1 (Auflage 1, R-GA4v2-7): Gruppe eines Spiels bzw. Teams. NULL, '' und 'all' (Jeder gegen jeden) -> ''.
-- Zwilling groupKeyOf (src/core/models/standingsGroups.ts), Gleichlauf group-key.json.
CREATE OR REPLACE FUNCTION match_engine.group_key(p_group_letter text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_group_letter IS NULL OR p_group_letter IN ('', 'all') THEN '' ELSE p_group_letter END;
$$;

-- Stand einer Gruppe für den Konfliktvergleich (R-GA4v2-3): je Gruppenspiel Teams, Tore, Status, Nichtantritt; ohne
-- Version. 2.1 (Auflage 7): mit ta/tb. Zwilling GroupCompletionService.expectedState, Gleichlauf group-state.json aus
-- echt erzeugten Zeilen. jsonb_strip_nulls: fehlend = null.
CREATE OR REPLACE FUNCTION match_engine.group_state(p_tournament_id uuid, p_group_id text) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', m.id::text, 'ta', m.team_a_id::text, 'tb', m.team_b_id::text, 'a', m.score_a, 'b', m.score_b,
           's', coalesce(m.match_status, 'scheduled'), 'f', m.forfeit_absent)) ORDER BY m.id::text), '[]'::jsonb)
    FROM public.matches m
   WHERE m.tournament_id = p_tournament_id
     AND match_engine.group_key(m.group_letter) = p_group_id
     AND NOT coalesce(m.is_final, false);
$$;

-- Auszuspielende Plätze aus dem Turnier-config; Zwilling parsePlacementsToPlayOut (playOutPlaces.ts, 2.1: Plätze 1–99):
-- fehlend/unbrauchbar -> {1}; [] -> {}; sortiert, ohne Doppelte; ein ungültiger Eintrag verwirft die Liste.
CREATE OR REPLACE FUNCTION match_engine.places_to_play_out(p_config jsonb) RETURNS integer[]
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_config -> 'placementsToPlayOut') = 'array'
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_config -> 'placementsToPlayOut') e
                      WHERE jsonb_typeof(e) <> 'number'
                         OR (e #>> '{}')::numeric <> trunc((e #>> '{}')::numeric)
                         OR (e #>> '{}')::numeric NOT BETWEEN 1 AND 99)
      THEN coalesce(ARRAY(SELECT DISTINCT (e #>> '{}')::numeric::integer
                            FROM jsonb_array_elements(p_config -> 'placementsToPlayOut') e ORDER BY 1), '{}'::integer[])
    ELSE ARRAY[1]
  END;
$$;

CREATE OR REPLACE FUNCTION match_engine.same_team_set(p_a jsonb, p_b jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    jsonb_typeof(p_a) = 'array' AND jsonb_typeof(p_b) = 'array'
    AND jsonb_array_length(p_a) = jsonb_array_length(p_b)
    AND (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p_a) x) = jsonb_array_length(p_a)
    AND (SELECT array_agg(x ORDER BY x) FROM jsonb_array_elements_text(p_a) x)
      = (SELECT array_agg(x ORDER BY x) FROM jsonb_array_elements_text(p_b) x),
    false);
$$;

-- Form einer Gleichstands-Entscheidung. 2.1 (Auflage 8): GLEICH mit StandingDecisionSchema (nach der Angleichung in
-- A-13b-S Punkt 7) + checkDraftFields (decisions.ts) ohne den Grund – Gleichlauf standing-decision-shapes.json, jede Grenze
-- und „3.0“ als Zeile. Der Server ist damit weder strenger noch lockerer als TS.
CREATE OR REPLACE FUNCTION match_engine.standing_decision_valid(p jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    jsonb_typeof(p) = 'object'
    AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(p) k
                     WHERE k NOT IN ('id', 'groupId', 'teamIds', 'order', 'kind', 'shootout', 'basis'))
    AND p ?& ARRAY['id', 'groupId', 'teamIds', 'order', 'kind', 'basis']
    AND jsonb_typeof(p -> 'id') = 'string' AND char_length(p ->> 'id') BETWEEN 1 AND 100
    AND jsonb_typeof(p -> 'groupId') = 'string' AND char_length(p ->> 'groupId') <= 40
    AND jsonb_typeof(p -> 'basis') = 'string' AND char_length(p ->> 'basis') <= 20000
    AND jsonb_typeof(p -> 'teamIds') = 'array' AND jsonb_array_length(p -> 'teamIds') >= 2
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'teamIds') t
                     WHERE jsonb_typeof(t) <> 'string'
                        OR (t #>> '{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    AND match_engine.same_team_set(p -> 'teamIds', p -> 'order')
    -- Art je Teamzahl (checkDraftFields): 2 Teams shootout/shared, 3+ order/shared
    AND CASE WHEN jsonb_array_length(p -> 'teamIds') = 2 THEN p ->> 'kind' IN ('shootout', 'shared')
             ELSE p ->> 'kind' IN ('order', 'shared') END
    AND CASE WHEN p ->> 'kind' = 'shootout' THEN
               jsonb_typeof(p -> 'shootout') = 'object'
           AND (SELECT count(*) FROM jsonb_object_keys(p -> 'shootout')) = 2
           AND (p -> 'shootout') ?& ARRAY['winner', 'loser']
           AND jsonb_typeof(p -> 'shootout' -> 'winner') = 'number'
           AND jsonb_typeof(p -> 'shootout' -> 'loser') = 'number'
           AND (p -> 'shootout' ->> 'winner')::numeric = trunc((p -> 'shootout' ->> 'winner')::numeric)
           AND (p -> 'shootout' ->> 'loser')::numeric = trunc((p -> 'shootout' ->> 'loser')::numeric)
           AND (p -> 'shootout' ->> 'loser')::numeric >= 0
           AND (p -> 'shootout' ->> 'winner')::numeric > (p -> 'shootout' ->> 'loser')::numeric
         ELSE NOT (p ? 'shootout') END,
    false);
$$;

-- „Ergebnis so akzeptieren“ erlaubt? Zwilling sharedPlaceAllowed (decisions.ts, playOutPlaces.ts): kein Platz des Blocks in
-- der Einstellung UND keiner als Gruppenplatz-Herkunft eines Spiels (Platz- und Besetzungsherkunft, wie sourcesOf).
CREATE OR REPLACE FUNCTION match_engine.shared_allowed(p_tournament_id uuid, p_group_id text, p_places integer[],
                                                       p_config jsonb)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT NOT (p_places && match_engine.places_to_play_out(p_config))
     AND NOT EXISTS (
       SELECT 1
         FROM public.matches m
         CROSS JOIN LATERAL (VALUES (m.origin_a), (m.origin_b), (m.slot_a_source), (m.slot_b_source)) AS s(src)
        WHERE m.tournament_id = p_tournament_id
          AND s.src ->> 'kind' = 'groupRank' AND s.src ->> 'group' = p_group_id
          AND (s.src ->> 'rank')::integer = ANY (p_places));
$$;

-- Eine Seite schreiben (Server). Zählt matches.version selbst hoch (C-MATCHVERSION-NUR-ENGINE).
CREATE OR REPLACE FUNCTION match_engine.write_side(p_match_id uuid, p_side text, p_team uuid, p_source jsonb,
                                                   p_reassigned boolean)
RETURNS void
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  UPDATE public.matches SET
    team_a_id     = CASE WHEN p_side = 'A' THEN p_team   ELSE team_a_id END,
    slot_a_source = CASE WHEN p_side = 'A' THEN p_source ELSE slot_a_source END,
    team_b_id     = CASE WHEN p_side = 'B' THEN p_team   ELSE team_b_id END,
    slot_b_source = CASE WHEN p_side = 'B' THEN p_source ELSE slot_b_source END,
    reassigned_at = CASE WHEN p_reassigned THEN now() WHEN p_team IS NULL THEN NULL ELSE reassigned_at END,
    version       = coalesce(version, 0) + 1
  WHERE id = p_match_id;
$$;

-- Folgen-Hinweis ohne Doppel (ein erneuter Abschluss erzeugt denselben offenen Hinweis nicht zweimal).
CREATE OR REPLACE FUNCTION match_engine.add_notice(p_tournament_id uuid, p_match_id uuid, p_side text, p_kind text,
                                                   p_origin uuid, p_current uuid)
RETURNS void
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.bracket_notices (tournament_id, match_id, side, kind, origin_team_id, current_team_id)
  SELECT p_tournament_id, p_match_id, p_side, p_kind, p_origin, p_current
   WHERE NOT EXISTS (SELECT 1 FROM public.bracket_notices n
                      WHERE n.match_id = p_match_id AND n.side = p_side AND n.kind = p_kind AND n.resolved_at IS NULL
                        AND n.origin_team_id IS NOT DISTINCT FROM p_origin
                        AND n.current_team_id IS NOT DISTINCT FROM p_current);
$$;

-- Gemeinsame Regel je Folgespiel-Seite (complete_group; in G2 auch propagate_knockout):
--   gleiches Team bzw. schon offen       -> nichts (@EK-017)
--   von Hand besetzt oder angepfiffen    -> Folgen-Hinweis, Seite bleibt (@TM-099, @TM-079)
--   neues Team NULL (Platz wieder offen) -> Seite auf Herkunft, Hinweis 'released' (@TM-145)
--   sonst                                -> schreiben, Verlauf; offene 'released'-Hinweise der Seite erledigt
CREATE OR REPLACE FUNCTION match_engine.apply_follow_up(
  p_tournament_id uuid, p_match_id uuid, p_side text, p_new uuid, p_current uuid,
  p_place_source jsonb, p_slot_source jsonb, p_status text, p_actor uuid, p_detail jsonb)
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_manual  boolean := p_current IS NOT NULL AND p_slot_source IS NULL;
  v_started boolean := coalesce(p_status, 'scheduled') NOT IN ('scheduled', 'waiting');  -- paused zählt (C-MATCHSTATUS-OHNE-PAUSED)
BEGIN
  IF p_new IS NOT DISTINCT FROM p_current THEN
    RETURN 'unchanged';
  END IF;
  IF v_manual OR v_started THEN
    PERFORM match_engine.add_notice(p_tournament_id, p_match_id, p_side,
              CASE WHEN v_manual THEN 'manual_kept' ELSE 'started_follow_up' END, p_new, p_current);
    RETURN 'notice';
  END IF;
  IF p_new IS NULL THEN
    PERFORM match_engine.write_side(p_match_id, p_side, NULL, p_place_source, false);
    PERFORM match_engine.add_notice(p_tournament_id, p_match_id, p_side, 'released', NULL, p_current);
    INSERT INTO public.bracket_log (tournament_id, match_id, kind, detail, actor)
    VALUES (p_tournament_id, p_match_id, 'release',
            p_detail || jsonb_build_object('side', p_side, 'from', p_current), p_actor);
    RETURN 'released';
  END IF;
  PERFORM match_engine.write_side(p_match_id, p_side, p_new, p_place_source, p_current IS NOT NULL);
  UPDATE public.bracket_notices SET resolved_at = now(), resolved_by = p_actor
   WHERE match_id = p_match_id AND side = p_side AND kind = 'released' AND resolved_at IS NULL;
  INSERT INTO public.bracket_log (tournament_id, match_id, kind, detail, actor)
  VALUES (p_tournament_id, p_match_id, CASE WHEN p_current IS NULL THEN 'auto_advance' ELSE 'auto_reassign' END,
          p_detail || jsonb_build_object('side', p_side, 'from', p_current, 'to', p_new), p_actor);
  RETURN 'written';
END;
$$;

-- Ablehnung oder (aus der Warteschlange) Eintrag in der Klärungsliste, in derselben Transaktion.
-- 2.1 (Soll 13): Bei STALE_VERSION ohne Spielbezug (Gruppe korrigiert) ist server_last NULL – die Korrektur steht nicht
-- in bracket_log; der Client nennt die letzte Korrektur aus match_event_author_names.
CREATE OR REPLACE FUNCTION match_engine.conflict_or_reject(
  p_from_queue boolean, p_tournament_id uuid, p_match_id uuid, p_group_id text, p_kind text,
  p_requested jsonb, p_code text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_last jsonb;
  v_id bigint;
BEGIN
  IF NOT (p_code = 'STALE_VERSION' AND p_match_id IS NULL) THEN
    SELECT jsonb_build_object('actor', l.actor, 'kind', l.kind, 'at', l.created_at, 'detail', l.detail) INTO v_last
      FROM public.bracket_log l
     WHERE l.tournament_id = p_tournament_id
       AND (l.match_id = p_match_id OR (p_match_id IS NULL AND l.group_id IS NOT DISTINCT FROM p_group_id))
     ORDER BY l.id DESC
     LIMIT 1;
  END IF;
  IF NOT coalesce(p_from_queue, false) THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', p_code, 'last', v_last);   -- MG11: hier nie eine Klärung
  END IF;
  INSERT INTO public.clarifications (tournament_id, match_id, group_id, kind, requested, conflict_code, server_last,
                                     requested_by)
  VALUES (p_tournament_id, p_match_id, p_group_id, p_kind, p_requested, p_code, v_last, p_actor)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('status', 'clarification', 'code', p_code, 'clarificationId', v_id, 'last', v_last);
END;
$$;

REVOKE ALL ON FUNCTION match_engine.group_key(text),
                       match_engine.group_state(uuid, text),
                       match_engine.places_to_play_out(jsonb),
                       match_engine.same_team_set(jsonb, jsonb),
                       match_engine.standing_decision_valid(jsonb),
                       match_engine.shared_allowed(uuid, text, integer[], jsonb),
                       match_engine.write_side(uuid, text, uuid, jsonb, boolean),
                       match_engine.add_notice(uuid, uuid, text, text, uuid, uuid),
                       match_engine.apply_follow_up(uuid, uuid, text, uuid, uuid, jsonb, jsonb, text, uuid, jsonb),
                       match_engine.conflict_or_reject(boolean, uuid, uuid, text, text, jsonb, text, uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------------------------------------------------

-- Gleichstands-Entscheidung eintragen oder zurücknehmen: config.standingDecisions + Verlauf in EINER Transaktion
-- (R-GA4v2-1, Nachtrag 4 „log_standing_decision“). config enthält nie Person, Zeit oder Grund (@W2A-072); der Grund
-- (nur Reihenfolge 3+) steht im Verlauf. Zurücknehmen nur, solange die Gruppe nicht abgeschlossen ist (@W2A-070).
-- 2.1 (Soll 13): Wiederholung nach verlorener Antwort ist idempotent (ALREADY_APPLIED). Sperrt nur tournaments.
CREATE OR REPLACE FUNCTION public.record_standing_decision(
  p_tournament_id uuid, p_action text, p_decision jsonb, p_reason text, p_expected_version integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_t    public.tournaments;
  v_list jsonb;
  v_old  jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_tournament_permission(p_tournament_id, 'manageLifecycle') THEN
    RAISE EXCEPTION 'record_standing_decision: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('decide', 'withdraw')
     OR jsonb_typeof(p_decision) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_decision -> 'id') IS DISTINCT FROM 'string' THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'INVALID_INPUT');
  END IF;
  IF p_action = 'decide' AND NOT match_engine.standing_decision_valid(p_decision) THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'INVALID_DECISION');
  END IF;

  SELECT * INTO v_t FROM public.tournaments WHERE id = p_tournament_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_standing_decision: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_list := CASE WHEN jsonb_typeof(v_t.config -> 'standingDecisions') = 'array'
                 THEN v_t.config -> 'standingDecisions' ELSE '[]'::jsonb END;
  SELECT x INTO v_old FROM jsonb_array_elements(v_list) x WHERE x ->> 'id' = p_decision ->> 'id' LIMIT 1;

  -- Wiederholung erkennen, bevor die Version geprüft wird
  IF p_action = 'decide' AND v_old IS NOT NULL THEN
    IF v_old = p_decision THEN
      RETURN jsonb_build_object('status', 'ok', 'code', 'ALREADY_APPLIED', 'version', v_t.version);
    END IF;
    RETURN jsonb_build_object('status', 'rejected', 'code', 'DUPLICATE_ID');
  END IF;
  IF p_action = 'withdraw' AND v_old IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.bracket_log l
                WHERE l.tournament_id = p_tournament_id AND l.kind = 'standing_withdraw'
                  AND l.detail ->> 'id' = p_decision ->> 'id') THEN
      RETURN jsonb_build_object('status', 'ok', 'code', 'ALREADY_APPLIED', 'version', v_t.version);
    END IF;
    RETURN jsonb_build_object('status', 'rejected', 'code', 'NOT_FOUND');
  END IF;

  IF v_t.version IS DISTINCT FROM p_expected_version THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'STALE', 'version', v_t.version);
  END IF;

  IF p_action = 'decide' THEN
    IF p_decision ->> 'kind' = 'order'
       AND (p_reason IS NULL OR char_length(btrim(p_reason)) = 0 OR char_length(btrim(p_reason)) > 500) THEN
      RETURN jsonb_build_object('status', 'rejected', 'code', 'REASON_REQUIRED');
    END IF;
    v_list := v_list || jsonb_build_array(p_decision);
    INSERT INTO public.bracket_log (tournament_id, group_id, kind, detail, reason, actor)
    VALUES (p_tournament_id, p_decision ->> 'groupId', 'standing_decision', p_decision - 'basis',
            CASE WHEN p_decision ->> 'kind' = 'order' THEN btrim(p_reason) END, v_uid);
  ELSE
    IF EXISTS (SELECT 1 FROM public.group_completions gc
                WHERE gc.tournament_id = p_tournament_id AND gc.group_id = v_old ->> 'groupId'
                  AND gc.reopened_at IS NULL) THEN
      RETURN jsonb_build_object('status', 'rejected', 'code', 'WITHDRAW_NOT_ALLOWED');
    END IF;
    v_list := (SELECT coalesce(jsonb_agg(e.x ORDER BY e.ord), '[]'::jsonb)
                 FROM jsonb_array_elements(v_list) WITH ORDINALITY AS e(x, ord)
                WHERE e.x ->> 'id' IS DISTINCT FROM p_decision ->> 'id');
    INSERT INTO public.bracket_log (tournament_id, group_id, kind, detail, actor)
    VALUES (p_tournament_id, v_old ->> 'groupId', 'standing_withdraw',
            jsonb_build_object('id', v_old -> 'id', 'teamIds', v_old -> 'teamIds', 'kind', v_old -> 'kind',
                               'order', v_old -> 'order', 'shootout', v_old -> 'shootout'), v_uid);
  END IF;

  UPDATE public.tournaments
     SET config = jsonb_set(coalesce(config, '{}'::jsonb), '{standingDecisions}', v_list),
         version = coalesce(version, 0) + 1,
         updated_at = now()
   WHERE id = p_tournament_id;   -- Definer: tournaments_keep_standing_decisions greift nicht (current_user ≠ authenticated)
  RETURN jsonb_build_object('status', 'ok', 'version', coalesce(v_t.version, 0) + 1);
END;
$$;

-- Gruppe abschließen (@TM-046). Rangfolge kommt vom Gerät (R-GA4-2). Prüft: Recht, Stand (R-GA4v2-3), alle Spiele
-- entschieden, Teammenge, schon abgeschlossen, offene Plätze nur nach Korrektur (R-GA4v2-4), Entscheidungen
-- (F9, R-GA4v2-5). Übernimmt neue Entscheidungen ins config, besetzt die Folgespiel-Seiten.
CREATE OR REPLACE FUNCTION public.complete_group(
  p_tournament_id      uuid,
  p_group_id           text,
  p_ranking            uuid[],
  p_open_ranks         integer[],
  p_tie_decisions      jsonb,
  p_known_decision_ids text[],
  p_expected_state     jsonb,
  p_from_queue         boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid              uuid := auth.uid();
  v_t                public.tournaments;
  v_state            jsonb;
  v_expected         jsonb;
  v_open             integer;
  v_group_teams      uuid[];
  v_open_ranks       integer[];
  v_decisions        jsonb := coalesce(p_tie_decisions, '[]'::jsonb);
  v_server_decisions jsonb;
  v_new_decisions    jsonb := '[]'::jsonb;
  v_prev             public.group_completions;
  v_had_prev         boolean;
  v_reopened         boolean;
  v_requested        jsonb;
  v_places           integer[];
  v_changed          jsonb := '[]'::jsonb;
  v_result           text;
  d                  jsonb;
  r                  record;
BEGIN
  IF v_uid IS NULL OR NOT public.has_tournament_permission(p_tournament_id, 'manageLifecycle') THEN
    RAISE EXCEPTION 'complete_group: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_group_id IS NULL OR char_length(p_group_id) > 40
     OR p_ranking IS NULL OR cardinality(p_ranking) = 0 OR array_position(p_ranking, NULL) IS NOT NULL
     OR array_position(coalesce(p_open_ranks, '{}'::integer[]), NULL) IS NOT NULL
     OR jsonb_typeof(v_decisions) <> 'array'
     OR jsonb_typeof(p_expected_state) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'INVALID_INPUT');
  END IF;
  -- 2.1 (Soll 13): sortiert, ohne Doppelte
  v_open_ranks := coalesce(ARRAY(SELECT DISTINCT o FROM unnest(coalesce(p_open_ranks, '{}'::integer[])) AS o ORDER BY o),
                           '{}'::integer[]);
  v_requested := jsonb_build_object('groupId', p_group_id, 'ranking', to_jsonb(p_ranking),
                                    'openRanks', to_jsonb(v_open_ranks), 'tieDecisions', v_decisions);

  -- 2.1 (Auflage 2, R-GA4v2-8): Sperren Spiele -> Turnier -> Abschluss. Alle betroffenen Spiele (Gruppenspiele und
  -- Folgespiele mit Herkunft aus der Gruppe) in EINER Anweisung nach id – dieselbe Richtung wie reset_match_results und
  -- matches_bump_change_revision. PRÜFEN: Verklemmungs-Probe RT-16/RT-17.
  PERFORM 1 FROM public.matches m
   WHERE m.tournament_id = p_tournament_id
     AND (   (NOT coalesce(m.is_final, false) AND match_engine.group_key(m.group_letter) = p_group_id)
          OR (coalesce(m.slot_a_source, m.origin_a) ->> 'kind' = 'groupRank'
              AND coalesce(m.slot_a_source, m.origin_a) ->> 'group' = p_group_id)
          OR (coalesce(m.slot_b_source, m.origin_b) ->> 'kind' = 'groupRank'
              AND coalesce(m.slot_b_source, m.origin_b) ->> 'group' = p_group_id))
   ORDER BY m.id
   FOR UPDATE;
  SELECT * INTO v_t FROM public.tournaments WHERE id = p_tournament_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'complete_group: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_state := match_engine.group_state(p_tournament_id, p_group_id);
  IF v_state = '[]'::jsonb THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'UNKNOWN_GROUP');
  END IF;
  SELECT * INTO v_prev FROM public.group_completions
   WHERE tournament_id = p_tournament_id AND group_id = p_group_id FOR UPDATE;
  v_had_prev := FOUND;
  v_reopened := v_had_prev AND v_prev.reopened_at IS NOT NULL;

  -- 1. Stand unverändert? (RT-2, RT-18; @TM-116 Z1, @TM-117, @TM-146 Z2, @TM-147 Z2)
  v_expected := (SELECT coalesce(jsonb_agg(jsonb_strip_nulls(e) ORDER BY e ->> 'id'), '[]'::jsonb)
                   FROM jsonb_array_elements(p_expected_state) e);
  IF v_expected IS DISTINCT FROM v_state THEN
    RETURN match_engine.conflict_or_reject(p_from_queue, p_tournament_id, NULL, p_group_id, 'complete_group',
                                           v_requested, 'STALE_VERSION', v_uid);
  END IF;

  -- 2. Alle Spiele entschieden: beendet, gewertet oder „nicht ausgetragen“ (@TM-054, @W2A-055)
  SELECT count(*) INTO v_open FROM jsonb_array_elements(v_state) s WHERE s ->> 's' NOT IN ('finished', 'skipped');
  IF v_open > 0 THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'OPEN_MATCHES', 'open', v_open);
  END IF;

  -- 3. Rangfolge = genau die Teams der Gruppe; offene Plätze im Bereich
  SELECT array_agg(id ORDER BY id) INTO v_group_teams FROM public.teams
   WHERE tournament_id = p_tournament_id AND match_engine.group_key(group_letter) = p_group_id
     AND NOT coalesce(is_removed, false);
  IF v_group_teams IS NULL
     OR (SELECT array_agg(x ORDER BY x) FROM unnest(p_ranking) AS x) IS DISTINCT FROM v_group_teams
     OR EXISTS (SELECT 1 FROM unnest(v_open_ranks) AS o WHERE o < 1 OR o > cardinality(p_ranking)) THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'RANKING_MISMATCH');
  END IF;

  -- 4. Schon abgeschlossen (nicht wieder geöffnet, nicht nach Korrektur)? (RT-5, RT-6; @TM-116 Z4)
  IF v_had_prev AND NOT v_reopened AND NOT v_prev.stale THEN
    IF v_prev.ranking = p_ranking AND v_prev.open_ranks = v_open_ranks THEN
      RETURN jsonb_build_object('status', 'ok', 'code', 'ALREADY_COMPLETED');
    END IF;
    RETURN match_engine.conflict_or_reject(p_from_queue, p_tournament_id, NULL, p_group_id, 'complete_group',
                                           v_requested, 'COMPLETED_DIFFERENTLY', v_uid);
  END IF;
  IF p_from_queue AND v_reopened AND v_prev.reopened_by IS DISTINCT FROM v_uid THEN   -- M2: nur fremdes Wiederöffnen
    RETURN match_engine.conflict_or_reject(true, p_tournament_id, NULL, p_group_id, 'complete_group',
                                           v_requested, 'GROUP_REOPENED', v_uid);
  END IF;

  -- 5. Offene Plätze nur beim erneuten Abschluss nach einer Korrektur (@TM-145); sonst erst entscheiden (@TM-049)
  IF cardinality(v_open_ranks) > 0 AND NOT (v_had_prev AND v_prev.stale AND NOT v_reopened) THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'TIE_DECISION_REQUIRED');
  END IF;

  -- 6. Entscheidungen der Gruppe: Kopien (online) bzw. neue aus der Warteschlange (F9, @TM-146, @TM-147)
  v_server_decisions := CASE WHEN jsonb_typeof(v_t.config -> 'standingDecisions') = 'array'
                             THEN v_t.config -> 'standingDecisions' ELSE '[]'::jsonb END;
  FOR d IN SELECT value FROM jsonb_array_elements(v_decisions) LOOP
    IF NOT match_engine.standing_decision_valid(d - 'reason')
       OR d ->> 'groupId' IS DISTINCT FROM p_group_id
       OR (d ? 'reason' AND (d ->> 'kind' <> 'order' OR jsonb_typeof(d -> 'reason') <> 'string'
                             OR char_length(btrim(d ->> 'reason')) NOT BETWEEN 1 AND 500)) THEN
      RETURN jsonb_build_object('status', 'rejected', 'code', 'INVALID_TIE_DECISIONS');
    END IF;
    IF d ->> 'kind' = 'shared' THEN
      v_places := ARRAY(SELECT i FROM generate_subscripts(p_ranking, 1) AS i
                         WHERE p_ranking[i]::text IN (SELECT jsonb_array_elements_text(d -> 'teamIds')));
      IF NOT match_engine.shared_allowed(p_tournament_id, p_group_id, v_places, v_t.config) THEN   -- @TM-147 Z3
        RETURN match_engine.conflict_or_reject(p_from_queue, p_tournament_id, NULL, p_group_id, 'complete_group',
                                               v_requested, 'SHARED_NOT_ALLOWED', v_uid);
      END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_server_decisions) x WHERE x ->> 'id' = d ->> 'id') THEN
      -- B1: eine neue Reihenfolge nur mit Grund (wie record_standing_decision, @W2A-004)
      IF d ->> 'kind' = 'order' AND NOT (d ? 'reason') THEN
        RETURN jsonb_build_object('status', 'rejected', 'code', 'REASON_REQUIRED');
      END IF;
      -- B2: am Server schon zurückgenommen -> nicht still wieder eintragen (@TM-116)
      IF EXISTS (SELECT 1 FROM public.bracket_log l
                  WHERE l.tournament_id = p_tournament_id AND l.kind = 'standing_withdraw'
                    AND l.detail ->> 'id' = d ->> 'id') THEN
        RETURN match_engine.conflict_or_reject(p_from_queue, p_tournament_id, NULL, p_group_id, 'complete_group',
                                               v_requested, 'DECIDED_ELSEWHERE', v_uid);
      END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_server_decisions) x                         -- @TM-146 Z3, @TM-147 Z4
                  WHERE x ->> 'groupId' = p_group_id
                    AND match_engine.same_team_set(x -> 'teamIds', d -> 'teamIds')
                    AND NOT ((x ->> 'id') = ANY (coalesce(p_known_decision_ids, '{}'::text[])))) THEN
        RETURN match_engine.conflict_or_reject(p_from_queue, p_tournament_id, NULL, p_group_id, 'complete_group',
                                               v_requested, 'DECIDED_ELSEWHERE', v_uid);
      END IF;
      v_new_decisions := v_new_decisions || jsonb_build_array(d);
    END IF;
  END LOOP;

  -- 7. Schreiben: neue Entscheidungen ins config (ohne Grund), Verlauf mit Grund; Abschluss; Verlauf
  IF jsonb_array_length(v_new_decisions) > 0 THEN
    UPDATE public.tournaments
       SET config = jsonb_set(coalesce(config, '{}'::jsonb), '{standingDecisions}',
                              v_server_decisions
                              || (SELECT jsonb_agg(x - 'reason') FROM jsonb_array_elements(v_new_decisions) x)),
           version = coalesce(version, 0) + 1,
           updated_at = now()
     WHERE id = p_tournament_id;
    INSERT INTO public.bracket_log (tournament_id, group_id, kind, detail, reason, actor)
    SELECT p_tournament_id, p_group_id, 'standing_decision',
           (x - 'reason' - 'basis') || jsonb_build_object('via', 'complete_group'),
           CASE WHEN x ->> 'kind' = 'order' THEN btrim(x ->> 'reason') END, v_uid
      FROM jsonb_array_elements(v_new_decisions) x;
  END IF;

  INSERT INTO public.group_completions AS gc
    (tournament_id, group_id, ranking, open_ranks, tie_orders, completed_at, completed_by, based_on_state, stale,
     reopened_at, reopened_by)
  VALUES (p_tournament_id, p_group_id, p_ranking, v_open_ranks,
          (SELECT coalesce(jsonb_agg(x - 'reason' - 'basis'), '[]'::jsonb) FROM jsonb_array_elements(v_decisions) x),
          now(), v_uid, v_state, cardinality(v_open_ranks) > 0, NULL, NULL)
  ON CONFLICT (tournament_id, group_id) DO UPDATE
    SET ranking = EXCLUDED.ranking, open_ranks = EXCLUDED.open_ranks, tie_orders = EXCLUDED.tie_orders,
        completed_at = EXCLUDED.completed_at, completed_by = EXCLUDED.completed_by,
        based_on_state = EXCLUDED.based_on_state, stale = EXCLUDED.stale,
        reopened_at = NULL, reopened_by = NULL;

  INSERT INTO public.bracket_log (tournament_id, group_id, kind, detail, actor)
  VALUES (p_tournament_id, p_group_id, 'complete_group',
          jsonb_build_object('ranking', to_jsonb(p_ranking), 'openRanks', to_jsonb(v_open_ranks),
                             'recompleted', v_had_prev, 'fromQueue', coalesce(p_from_queue, false)), v_uid);

  -- 8. Folgespiele (oben schon gesperrt): jede Seite, deren Herkunft ein Platz dieser Gruppe ist (R-GA4v2-2).
  --    FOR UPDATE OF m sperrt nur ein Spiel nach, dessen Herkunft sich seit Schritt 0 geändert hat (Risiko 6).
  FOR r IN
    SELECT m.id, m.match_status, s.side, s.place_src, s.slot_src, s.team_id, (s.place_src ->> 'rank')::integer AS rank
      FROM public.matches m
      CROSS JOIN LATERAL (VALUES ('A', coalesce(m.slot_a_source, m.origin_a), m.slot_a_source, m.team_a_id),
                                 ('B', coalesce(m.slot_b_source, m.origin_b), m.slot_b_source, m.team_b_id))
                         AS s(side, place_src, slot_src, team_id)
     WHERE m.tournament_id = p_tournament_id
       AND s.place_src ->> 'kind' = 'groupRank' AND s.place_src ->> 'group' = p_group_id
     ORDER BY m.id, s.side
     FOR UPDATE OF m
  LOOP
    v_result := match_engine.apply_follow_up(
      p_tournament_id, r.id, r.side,
      CASE WHEN r.rank = ANY (v_open_ranks) OR r.rank > cardinality(p_ranking) THEN NULL ELSE p_ranking[r.rank] END,
      r.team_id, r.place_src, r.slot_src, r.match_status, v_uid, jsonb_build_object('groupId', p_group_id));
    IF v_result IN ('written', 'released') THEN
      v_changed := v_changed || jsonb_build_object('matchId', r.id, 'side', r.side, 'result', v_result);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('status', 'ok', 'state', v_state, 'changed', v_changed,
                            'tournamentVersion', (SELECT version FROM public.tournaments WHERE id = p_tournament_id));
END;
$$;

-- Gruppe wieder öffnen (@TM-099 Z1, @TM-116 Z4). Besetzung bleibt bis zum erneuten Abschluss stehen.
-- 2.1: Eingaben und gelöschtes Turnier geprüft (Soll 13); Sperren Spiele -> Abschluss (R-GA4v2-8, ohne Turnierzeile).
CREATE OR REPLACE FUNCTION public.reopen_group(p_tournament_id uuid, p_group_id text, p_reason text,
                                               p_from_queue boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_gc  public.group_completions;
BEGIN
  IF v_uid IS NULL OR NOT public.has_tournament_permission(p_tournament_id, 'manageLifecycle')
     OR NOT EXISTS (SELECT 1 FROM public.tournaments WHERE id = p_tournament_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'reopen_group: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_group_id IS NULL OR char_length(p_group_id) > 40 THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'INVALID_INPUT');
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) = 0 OR char_length(btrim(p_reason)) > 500 THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'REASON_REQUIRED');
  END IF;
  PERFORM 1 FROM public.matches m
   WHERE m.tournament_id = p_tournament_id AND match_engine.group_key(m.group_letter) = p_group_id
     AND NOT coalesce(m.is_final, false)
   ORDER BY m.id FOR UPDATE;
  SELECT * INTO v_gc FROM public.group_completions
   WHERE tournament_id = p_tournament_id AND group_id = p_group_id FOR UPDATE;
  IF NOT FOUND OR v_gc.reopened_at IS NOT NULL THEN
    RETURN match_engine.conflict_or_reject(p_from_queue, p_tournament_id, NULL, p_group_id, 'reopen_group',
                                           jsonb_build_object('groupId', p_group_id, 'reason', p_reason),
                                           'NOT_COMPLETED', v_uid);
  END IF;
  UPDATE public.group_completions SET reopened_at = now(), reopened_by = v_uid
   WHERE tournament_id = p_tournament_id AND group_id = p_group_id;
  INSERT INTO public.bracket_log (tournament_id, group_id, kind, detail, reason, actor)
  VALUES (p_tournament_id, p_group_id, 'reopen_group', '{}'::jsonb, btrim(p_reason), v_uid);
  RETURN jsonb_build_object('status', 'ok');
END;
$$;

-- Folgen-Hinweis „so belassen“ (@EK-016; Dialog B-25).
CREATE OR REPLACE FUNCTION public.resolve_bracket_notice(p_notice_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n   public.bracket_notices;
BEGIN
  SELECT * INTO v_n FROM public.bracket_notices WHERE id = p_notice_id FOR UPDATE;
  IF NOT FOUND OR v_uid IS NULL OR NOT public.has_tournament_permission(v_n.tournament_id, 'manageLifecycle') THEN
    RAISE EXCEPTION 'resolve_bracket_notice: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_n.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'ok', 'code', 'ALREADY_RESOLVED');
  END IF;
  UPDATE public.bracket_notices SET resolved_at = now(), resolved_by = v_uid WHERE id = p_notice_id;
  INSERT INTO public.bracket_log (tournament_id, match_id, kind, detail, actor)
  VALUES (v_n.tournament_id, v_n.match_id, 'notice_kept', jsonb_build_object('noticeId', p_notice_id), v_uid);
  RETURN jsonb_build_object('status', 'ok');
END;
$$;

-- Klärung „erledigt“ (@TM-117; Liste B).
CREATE OR REPLACE FUNCTION public.resolve_clarification(p_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_c   public.clarifications;
BEGIN
  SELECT * INTO v_c FROM public.clarifications WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_uid IS NULL OR NOT public.has_tournament_permission(v_c.tournament_id, 'manageLifecycle') THEN
    RAISE EXCEPTION 'resolve_clarification: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_c.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'ok', 'code', 'ALREADY_RESOLVED');
  END IF;
  UPDATE public.clarifications SET resolved_at = now(), resolved_by = v_uid WHERE id = p_id;
  INSERT INTO public.bracket_log (tournament_id, match_id, group_id, kind, detail, actor)
  VALUES (v_c.tournament_id, v_c.match_id, v_c.group_id, 'clarification_resolved',
          jsonb_build_object('clarificationId', p_id), v_uid);
  RETURN jsonb_build_object('status', 'ok');
END;
$$;

-- Verlauf lesen, nur Turnierleitung (Eigentümer, Co-Admin); Name wie match_event_author_names (20261028_006), nie E-Mail.
-- Helfer, Bildschirm und alle anderen: 0 Zeilen (kein Existenz-Orakel); anon: kein EXECUTE (@TM-113, @W2A-071, @W2A-072).
CREATE OR REPLACE FUNCTION public.bracket_log_read(p_tournament_id uuid)
RETURNS TABLE (id bigint, kind text, match_id uuid, group_id text, detail jsonb, reason text,
               actor_name text, actor_role text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.id, l.kind, l.match_id, l.group_id, l.detail, l.reason,
         CASE WHEN l.actor IS NOT NULL AND l.actor = t.owner_id THEN nullif(btrim(p.display_name), '')
              ELSE coalesce(nullif(btrim(tc.label), ''), nullif(btrim(p.display_name), '')) END,
         CASE WHEN l.actor IS NOT NULL AND l.actor = t.owner_id THEN 'owner' ELSE tc.role END,
         l.created_at
    FROM public.bracket_log l
    JOIN public.tournaments t ON t.id = l.tournament_id AND t.deleted_at IS NULL
    LEFT JOIN public.profiles p ON p.id = l.actor
    LEFT JOIN LATERAL (
      SELECT c.label, c.role
        FROM public.tournament_collaborators c
       WHERE c.tournament_id = t.id AND l.actor IS NOT NULL AND c.user_id = l.actor
       ORDER BY c.accepted_at DESC NULLS LAST, c.created_at DESC NULLS LAST
       LIMIT 1
    ) tc ON true
   WHERE l.tournament_id = p_tournament_id
     AND public.has_tournament_permission(t.id, 'manageLifecycle')
   ORDER BY l.id;
$$;

REVOKE ALL ON FUNCTION public.record_standing_decision(uuid, text, jsonb, text, integer),
                       public.complete_group(uuid, text, uuid[], integer[], jsonb, text[], jsonb, boolean),
                       public.reopen_group(uuid, text, text, boolean),
                       public.resolve_bracket_notice(bigint),
                       public.resolve_clarification(bigint),
                       public.bracket_log_read(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_standing_decision(uuid, text, jsonb, text, integer),
                          public.complete_group(uuid, text, uuid[], integer[], jsonb, text[], jsonb, boolean),
                          public.reopen_group(uuid, text, text, boolean),
                          public.resolve_bracket_notice(bigint),
                          public.resolve_clarification(bigint),
                          public.bracket_log_read(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 5a. Korrektur in einer abgeschlossenen Gruppe: Abschluss bleibt, „Besetzung prüfen“ (A-15b, @TM-071, @TM-145).
--     SECURITY DEFINER: auch Spielplan-Updates der Turnierleitung (Rolle authenticated) setzen stale.
--     2.1: WHEN-Klausel (Soll 13), Gruppe über group_key (Auflage 1, Jeder gegen jeden 'all').
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.matches_mark_group_stale() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.group_completions SET stale = true
   WHERE tournament_id = NEW.tournament_id AND group_id = match_engine.group_key(NEW.group_letter) AND NOT stale;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.matches_mark_group_stale() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS matches_mark_group_stale ON public.matches;
CREATE TRIGGER matches_mark_group_stale
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  WHEN (NOT coalesce(NEW.is_final, false)
        AND (NEW.score_a, NEW.score_b, NEW.overtime_score_a, NEW.overtime_score_b, NEW.penalty_score_a,
             NEW.penalty_score_b, NEW.match_status, NEW.decided_by, NEW.forfeit_absent, NEW.team_a_id, NEW.team_b_id)
            IS DISTINCT FROM
            (OLD.score_a, OLD.score_b, OLD.overtime_score_a, OLD.overtime_score_b, OLD.penalty_score_a,
             OLD.penalty_score_b, OLD.match_status, OLD.decided_by, OLD.forfeit_absent, OLD.team_a_id, OLD.team_b_id))
  EXECUTE FUNCTION public.matches_mark_group_stale();

-- ---------------------------------------------------------------------------------------------------------------
-- 5b. 2.1 (Soll 12): Gleichstands-Entscheidungen ändern nur record_standing_decision und complete_group (mit Verlauf).
--     Ein Voll-Speichern einer Client-Rolle (tournaments_update_v3) behält den Serverwert – wie matches_keep_origin
--     NULL behält. Es scheitert nicht (eine alte lokale Kopie darf das übrige Speichern nicht blockieren).
--     PRÜFEN: P-11 (Wert bleibt, placementsToPlayOut im selben Update übernommen), Mutation MG15.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournaments_keep_standing_decisions() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.config -> 'standingDecisions') IS DISTINCT FROM (OLD.config -> 'standingDecisions') THEN
    NEW.config := CASE WHEN OLD.config ? 'standingDecisions'
                       THEN jsonb_set(coalesce(NEW.config, '{}'::jsonb), '{standingDecisions}',
                                      OLD.config -> 'standingDecisions')
                       ELSE coalesce(NEW.config, '{}'::jsonb) - 'standingDecisions' END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tournaments_keep_standing_decisions() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS tournaments_keep_standing_decisions ON public.tournaments;
CREATE TRIGGER tournaments_keep_standing_decisions
  BEFORE UPDATE OF config ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.tournaments_keep_standing_decisions();

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Realtime (Muster 20260928_001:634-650): Abschluss, Hinweise und Klärungen erreichen die anderen Geräte
--    (@TM-115 „zeigen auch Marias und Toms Geräte“, @TM-116 „Olli und Maria sehen den Eintrag“). RLS gilt auch hier.
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY['group_completions', 'bracket_notices', 'clarifications'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END LOOP;
  END IF;
END;
$$;

COMMIT;
