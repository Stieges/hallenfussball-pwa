-- supabase/migrations/20261113_003_tournament_lifecycle.sql
-- A-21a-S (plan-endstand-abschluss.md Fassung 2, § 2 R-EA-1..R-EA-14, § 3 „A-21a-S“, Nachtrag 22.10.): Lebenszyklus des
-- Turniers und Abschluss-Sperre am Server. „Turnier abschließen“ geht nur, wenn alles entschieden ist; dann werden in EINER
-- Transaktion Endstand und Torschützen gespeichert, der Zustand „Abgeschlossen“ gesetzt, und danach lehnt der Server jede
-- Änderung ab. Was später noch von einem Gerät kommt, zählt nicht, wird aber aufbewahrt („nach dem Ende eingetroffen“).
-- Szenarien: @LZ-001 (Server), @LZ-003/@LZ-090 (Regression), @LZ-004, @LZ-006, @LZ-009, @LZ-010, @LZ-012, @LZ-013, @LZ-016,
--   @LZ-017, @LZ-018, @LZ-021, @LZ-022, @LZ-023, @LZ-024, @LZ-029, @LZ-030, @LZ-036, @LZ-037, @LZ-038, @LZ-039, @LZ-040,
--   @LZ-044, @LZ-074, @LZ-075, @LZ-076 (Server), @LZ-091 (Notweg wieder öffnen); @HE-038, @HE-070, @HE-098 (Z. 2);
--   @FU-018, @FU-057 (Z. 1), @FU-068; @ZP-087, @SA-005 (Server); @ET-045, @ET-046, @ET-058; @ZM-011, @ZM-012.
--   Befunde C-APPEND-OHNE-ABSCHLUSS, C-FINISH-PROMISE (Server-Teil), C-WARTEND-OHNE-QUELLE (Server-Teil).
--
-- Inhalt:
--   1. tournaments.lifecycle_status ('draft' | 'fixed' | 'finished' | 'cancelled'), tournaments.finished_at; Backfill
--      (R-EA-11): 'fixed', wenn status = 'published', sonst 'draft'; finished_at bleibt leer (Alt-Haken zählt nicht, F9).
--      Lese-Funktion public.tournament_lifecycle(uuid): 'running' wird NICHT gespeichert, sondern gelesen
--      (fixed UND ein Spiel läuft, pausiert oder ist beendet; ein zurückgenommener Anpfiff zählt nicht, K2).
--   2. Tabellen tournament_final_standings, tournament_lifecycle_log, late_entries, device_outbox_reports (RLS an,
--      keine Client-Schreibrechte; ci_schema_reader liest für den Schema-Dump).
--   3. Hilfen im Schema match_engine (ohne EXECUTE für Client-Rollen): tournament_state, finish_open_items,
--      finish_warnings, final_standings_shape_valid (+ Zeilenprüfungen), place_numbers_valid, final_standings_consistent,
--      match_winner, actor_name, final_standings_payload,
--      closed_intake; dazu public.tournament_is_closed (NULL-fest, nur für Server-Funktionen).
--   4. RPCs finish_tournament, finish_preflight, reopen_tournament, report_device_outbox (authenticated) und
--      public_final_standings, display_final_standings (anon + authenticated), tournament_lifecycle (Invoker).
--   5. append_match_events (Fassung 20261110_005) mit EINEM Block nach der Prüfung „Spiel nicht mehr beschreibbar“ und
--      VOR dem field_control-INSERT: abgeschlossenes Turnier -> match_engine.closed_intake (R-EA-5, Review B3).
--   6. Trigger: tournaments_guard_lifecycle, tournaments_lifecycle_follow_status, *_guard_closed auf elf Tabellen;
--      Rumpf von tournament_closed_for_helpers (20261110_008) ersetzt (R-EA-12, I-4), falls die Funktion existiert.
--
-- Lesarten:
--   Zustand (R-EA-1): gespeichert werden nur Handlungen (Festlegen = status 'published', Abschluss, Wiederöffnen).
--     Client-Rollen setzen status nur auf 'draft' oder 'published' (W3); 'draft' nach dem ersten Anpfiff lässt den
--     Zustand auf 'fixed' (@LZ-004). Die Lebenszyklus-Spalten schreibt nur eine Server-Funktion mit dem Schalter
--     app.lifecycle_write = 'on' (transaktionslokal, nur außerhalb der Client-Rollen wirksam, Muster A-16 A1).
--   Sperre (R-EA-6): nach 'finished' lehnen die Trigger mit SQLSTATE 55000 und dem Text TOURNAMENT_FINISHED ab. Ein UPDATE
--     geht durch, wenn sich außer is_public und den Verwaltungsspalten (version, updated_at, change_revision, owner_id)
--     nichts ändert (Sichtbarkeits-Kaskade, No-op-Teil von save(), Review B1/B2). Auf tournaments bleiben nach dem
--     Abschluss is_public, share_code, share_code_created_at, die Verwaltungsspalten und in config nur publicScorers
--     änderbar (B-15, I-7); standingDecisions in config hält für Client-Rollen ohnehin tournaments_keep_standing_decisions.
--   Ausnahmen mit Grund (R-EA-6, Review B4): tournament_collaborators, tournament_join_codes, tournament_join_requests
--     (Helfer entfernen und Code erneuern bleiben möglich, F13; den Beitritt schließt tournament_closed_for_helpers),
--     monitors (nur is_public über die Kaskade; Folien sperrt die Oberfläche, @LZ-037 Z. 4), monitor_heartbeats,
--     monitor_screens (B-20), device_outbox_reports, late_entries, tournament_lifecycle_log, tournament_final_standings
--     (schreiben nur die Lebenszyklus-RPCs), match_event_authors (schreibt nur append_match_events, nach closed_intake
--     unerreichbar). Der Wächter lifecycle-guard-triggers-complete (db_privilege_assertions.sql) prüft jede Tabelle, die
--     per Fremdschlüssel an tournaments hängt.
--   Trigger-Reihenfolge (BEFORE, alphabetisch): matches_guard_closed vor matches_guard_engine_columns,
--     matches_guard_ga4_columns, matches_guard_kit_columns, matches_keep_origin; tournaments_guard_lifecycle vor
--     tournaments_keep_standing_decisions und tournaments_lifecycle_follow_status; team_version_trigger,
--     match_event_version_trigger, sponsor_version_trigger laufen vor der Sperre (version/updated_at sind ausgenommen).
--   Gleichzeitigkeit (K5): Die Sperr-Trigger lesen den Zustand ohne Zeilensperre. Ein teams-UPDATE genau während des
--     Abschlusses kann noch durchgehen – nicht erzwungen, folgenlos für den Endstand (Teams stehen mit Namen im
--     gespeicherten Endstand, matches schützt die Spielsperre des Abschlusses).
--   Grenze (K6): aufbewahrt wird nur, was über append_match_events kommt; andere Schreibwege lehnen ab (sichtbarer Fehler).
--   Endstand (R-EA-4): rechnet der Client; der Server prüft Form (Gleichlauf final-standings-shapes.json), jedes Team ohne
--     is_removed genau einmal, Platzziffern (Platz = 1 + Zahl der Teams davor, geteilte Plätze mit Sprung), bei Jeder gegen
--     jeden Reihenfolge und Platzziffern aus group_completions('') (Gleichlauf final-standings-roundrobin.json) und bei
--     jedem entschiedenen Platzierungsspiel „Sieger auf dem oberen, Verlierer auf dem unteren Platz des Spiels“.
--
-- Voraussetzung: 20261110_006 (group_completions, bracket_*, clarifications, complete_group), 20261110_005
--   (forfeit_absent, append_match_events mit Feldsteuerung), 20261110_003 (field_control), 20261110_001
--   (manageLifecycle), 20260924_002 (ci_schema_reader). 20261110_008 optional: ist tournament_closed_for_helpers da,
--   wird der Rumpf ersetzt. Idempotent (IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS + CREATE); der Backfill
--   läuft nur beim ersten Einspielen (Spalte neu).
--
-- RÜCKWEG: eigene Datei (Anhang B von A-21a-sql-freigabe.md, erzeugt mit
--   `bash scripts/tournament-lifecycle-check.sh --print-rueckweg`), EIN Block. Vorher die App ohne A-21a-Client deployen
--   und gespeicherte Endstände/späte Einträge per COPY sichern (sie gehen mit den Tabellen verloren).
--   append_match_events und tournament_closed_for_helpers kommen wörtlich aus 20261110_005 bzw. 20261110_008 zurück.
--   Belegt in scripts/tournament-lifecycle-check.sh (Kategorie X: Schema danach = vorher).
--
-- Produktion: nur im DB-Fenster (Vorschlag G2) durch den Controller nach Daniels Freigabe (A-21a-sql-freigabe.md), nach
-- 20261110_005 … _008 und 20261113_101. Dieser Branch spielt nichts ein. Typen-PR nötig (neue Spalten/Funktionen).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Voraussetzungen (Fail-fast, ohne Änderung)
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_append text;
BEGIN
  IF to_regclass('public.group_completions') IS NULL OR to_regclass('public.bracket_notices') IS NULL
     OR to_regclass('public.clarifications') IS NULL OR to_regclass('public.bracket_log') IS NULL
     OR to_regclass('public.field_control') IS NULL
     OR to_regprocedure('public.complete_group(uuid,text,uuid[],integer[],jsonb,text[],jsonb,boolean)') IS NULL
     OR to_regprocedure('match_engine.group_key(text)') IS NULL
     OR to_regprocedure('match_engine.envelope(jsonb,text,text)') IS NULL
     OR to_regprocedure('match_engine.dedupe_key(jsonb)') IS NULL
     OR to_regprocedure('public.has_tournament_permission(uuid,text)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'forfeit_absent')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'change_revision')
     OR NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'co-admin' AND permission = 'manageLifecycle')
     OR NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'screen' AND permission = 'readDisplay')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ci_schema_reader') THEN
    RAISE EXCEPTION '20261113_003_tournament_lifecycle: Voraussetzungen fehlen – zuerst 20261110_001 … 20261110_006 (Gruppe abschließen) einspielen';
  END IF;
  -- append_match_events: nur die Fassung aus 20261110_005 (Feldsteuerung + Nichtantritt) oder diese Datei ersetzen,
  -- nie still eine spätere Neufassung (I-5: wer append neu fasst, übernimmt closed_intake selbst).
  SELECT prosrc INTO v_append FROM pg_proc WHERE oid = to_regprocedure('public.append_match_events(uuid,jsonb,integer,uuid)');
  IF v_append IS NULL
     OR NOT (   position('match_engine.closed_intake(' IN v_append) > 0
             OR (    position('forfeit_absent = v_cache ->> ''forfeit_absent''' IN v_append) > 0
                 AND position('INSERT INTO public.field_control' IN v_append) > 0)) THEN
    RAISE EXCEPTION '20261113_003_tournament_lifecycle: append_match_events hat eine unbekannte Fassung – erst klären';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Spalten, Backfill, Lese-Funktion
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_first boolean := NOT EXISTS (SELECT 1 FROM information_schema.columns
                                  WHERE table_schema = 'public' AND table_name = 'tournaments'
                                    AND column_name = 'lifecycle_status');
  v_fixed integer;
BEGIN
  ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'draft';
  ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS finished_at timestamptz;
  IF v_first THEN
    -- R-EA-11: festgelegt = status 'published'; alles andere Entwurf; finished_at bleibt leer (F9). updated_at bleibt
    -- unverändert (sonst sortierte jedes Dashboard alle festgelegten Turniere neu nach oben).
    ALTER TABLE public.tournaments DISABLE TRIGGER tournaments_updated_at;
    UPDATE public.tournaments SET lifecycle_status = 'fixed' WHERE status = 'published';
    GET DIAGNOSTICS v_fixed = ROW_COUNT;
    ALTER TABLE public.tournaments ENABLE TRIGGER tournaments_updated_at;
    RAISE NOTICE '20261113_003: Backfill lifecycle_status – % Turnier(e) festgelegt (fixed), übrige Entwurf (draft)', v_fixed;
  END IF;
END;
$$;
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_lifecycle_status_check;
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_lifecycle_status_check
  CHECK (lifecycle_status IN ('draft', 'fixed', 'finished', 'cancelled'));   -- 'running' wird gelesen, nie gespeichert
COMMENT ON COLUMN public.tournaments.lifecycle_status IS
  'A-21a (R-EA-1): gespeicherter Zustand – draft | fixed | finished | cancelled (cancelled vorgehalten, MVP+). „Läuft“ liest public.tournament_lifecycle(uuid). Nur der Server schreibt (tournaments_guard_lifecycle, Schalter app.lifecycle_write).';
COMMENT ON COLUMN public.tournaments.finished_at IS
  'A-21a: Zeitpunkt des Turnierabschlusses; beim Wiederöffnen wieder NULL (R-EA-12, die Zeit bleibt im Verlauf). Bildschirm-Freigabe B-20: finished_at + 60 min.';

-- Zustand für App und Server (R-EA-1, K2). INVOKER: liefert nur, was der Aufrufer lesen darf (sonst NULL).
CREATE OR REPLACE FUNCTION public.tournament_lifecycle(p_tournament_id uuid) RETURNS text
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
           WHEN t.lifecycle_status = 'fixed'
                AND EXISTS (SELECT 1 FROM public.matches m
                             WHERE m.tournament_id = t.id AND m.match_status IN ('running', 'paused', 'finished'))
             THEN 'running'
           ELSE t.lifecycle_status
         END
    FROM public.tournaments t
   WHERE t.id = p_tournament_id;
$$;
REVOKE ALL ON FUNCTION public.tournament_lifecycle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tournament_lifecycle(uuid) TO anon, authenticated;

-- Abgeschlossen oder abgebrochen? NULL-fest: unbekanntes Turnier = nicht gesperrt (eine FK-Kaskade nach dem Löschen des
-- Turniers bleibt möglich). Nur aus Server-Funktionen und Triggern (SECURITY DEFINER) erreichbar.
CREATE OR REPLACE FUNCTION public.tournament_is_closed(p_tournament_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((SELECT t.lifecycle_status IN ('finished', 'cancelled')
                     FROM public.tournaments t WHERE t.id = p_tournament_id), false);
$$;
REVOKE ALL ON FUNCTION public.tournament_is_closed(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Tabellen
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_final_standings (
  tournament_id uuid        PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  snapshot      jsonb       NOT NULL,             -- FinalStandingsSnapshot (A-20a), geprüft beim Abschluss
  finished_at   timestamptz NOT NULL,
  finished_by   uuid        NOT NULL,
  request_id    uuid        NOT NULL
);
COMMENT ON TABLE public.tournament_final_standings IS
  'A-21a (R-EA-3, @ET-045): gespeicherter Endstand mit Torschützen. Nur finish_tournament schreibt. Lesen: Turnierleitung und Helfer (writeMatchData); Zuschauer und Monitor nur über public_final_standings/display_final_standings (Torschützen nur mit Schalter).';

CREATE TABLE IF NOT EXISTS public.tournament_lifecycle_log (
  id                 bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id      uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  kind               text        NOT NULL CHECK (kind IN ('finish', 'reopen')),
  reason             text        CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 500),
  request_id         uuid        NOT NULL UNIQUE,
  actor              uuid        NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  finished_at_before timestamptz              -- reopen: Zeitpunkt des aufgehobenen Abschlusses (@LZ-091)
);
CREATE INDEX IF NOT EXISTS tournament_lifecycle_log_tournament_idx ON public.tournament_lifecycle_log (tournament_id, id);
COMMENT ON TABLE public.tournament_lifecycle_log IS
  'A-21a: Verlauf von Abschluss und Wiederöffnen mit Person, Zeit, Grund (@LZ-021, @LZ-024, @LZ-091). Lesen nur Turnierleitung (manageLifecycle).';

CREATE TABLE IF NOT EXISTS public.late_entries (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id      uuid        NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  event_id      uuid        NOT NULL,
  event         jsonb       NOT NULL,         -- Ereignis wie gesendet (Umschlag geprüft)
  actor         uuid        NOT NULL,
  device_id     uuid,
  received_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid,
  CONSTRAINT late_entries_match_event_key UNIQUE (match_id, event_id)
);
CREATE INDEX IF NOT EXISTS late_entries_open_idx ON public.late_entries (tournament_id) WHERE resolved_at IS NULL;
COMMENT ON TABLE public.late_entries IS
  'A-21a (R-EA-5): Einträge, die nach dem Abschluss über append_match_events ankamen – zählen nicht, „nach dem Ende eingetroffen“ (@LZ-039, @LZ-040, @FU-018). Lesen nur Turnierleitung.';

CREATE TABLE IF NOT EXISTS public.device_outbox_reports (
  tournament_id uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  device_id     uuid        NOT NULL,
  user_id       uuid        NOT NULL,
  field         integer,
  pending       integer     NOT NULL CHECK (pending BETWEEN 0 AND 100000),
  reported_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, device_id)
);
COMMENT ON TABLE public.device_outbox_reports IS
  'A-21a (F3, @FU-068, @LZ-018): Zahl wartender Einträge je Gerät (report_device_outbox, A-21a-C3). Nur Server-Funktionen lesen und schreiben.';

ALTER TABLE public.tournament_final_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_lifecycle_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.late_entries               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_outbox_reports      ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tournament_final_standings, public.tournament_lifecycle_log, public.late_entries,
                    public.device_outbox_reports
  FROM PUBLIC, anon, authenticated, ci_schema_reader;
REVOKE ALL ON SEQUENCE public.tournament_lifecycle_log_id_seq, public.late_entries_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tournament_final_standings, public.tournament_lifecycle_log, public.late_entries TO authenticated;
-- Leserolle des Drift-Checks (wie 20261110_006 G1): pg_dump braucht SELECT; Daten sieht sie keine (RLS an, keine Policy).
GRANT SELECT ON TABLE public.tournament_final_standings, public.tournament_lifecycle_log, public.late_entries,
                      public.device_outbox_reports
  TO ci_schema_reader;

-- R-EA-3 (Review B5): Eigentümer, Co-Admin, Helfer und Helfer-Gerät (writeMatchData; has_tournament_permission enthält den
-- Eigentümer-Zweig user_owns_tournament), NICHT die Rolle screen (nur readDisplay) – der Bildschirm liest über
-- display_final_standings mit Torschützen-Schalter.
DROP POLICY IF EXISTS tournament_final_standings_select ON public.tournament_final_standings;
CREATE POLICY tournament_final_standings_select ON public.tournament_final_standings FOR SELECT TO authenticated
  USING (public.has_tournament_permission(tournament_id, 'writeMatchData'));
DROP POLICY IF EXISTS tournament_lifecycle_log_select ON public.tournament_lifecycle_log;
CREATE POLICY tournament_lifecycle_log_select ON public.tournament_lifecycle_log FOR SELECT TO authenticated
  USING (public.has_tournament_permission(tournament_id, 'manageLifecycle'));
DROP POLICY IF EXISTS late_entries_select ON public.late_entries;
CREATE POLICY late_entries_select ON public.late_entries FOR SELECT TO authenticated
  USING (public.has_tournament_permission(tournament_id, 'manageLifecycle'));

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Hilfen (nur aus SECURITY-DEFINER-Funktionen erreichbar)
-- ---------------------------------------------------------------------------------------------------------------

-- Stand ALLER Spiele für den Stand-Vergleich beim Abschluss (R-EA-14, @LZ-029): wie match_engine.group_state (_006), dazu
-- Verlängerung (oa/ob) und Strafstoßschießen (pa/pb). Zwilling expectedTournamentState (A-21a-C1), Gleichlauf
-- src/core/standings/__fixtures__/tournament-state.json. jsonb_strip_nulls: fehlend = null.
CREATE OR REPLACE FUNCTION match_engine.tournament_state(p_tournament_id uuid) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', m.id::text, 'ta', m.team_a_id::text, 'tb', m.team_b_id::text, 'a', m.score_a, 'b', m.score_b,
           'oa', m.overtime_score_a, 'ob', m.overtime_score_b, 'pa', m.penalty_score_a, 'pb', m.penalty_score_b,
           's', coalesce(m.match_status, 'scheduled'), 'f', m.forfeit_absent)) ORDER BY m.id::text), '[]'::jsonb)
    FROM public.matches m
   WHERE m.tournament_id = p_tournament_id;
$$;

-- Sieger eines beendeten Spiels ('A' | 'B' | NULL): Nichtantritt zuerst, dann Tore inkl. Verlängerung, dann Strafstoß.
CREATE OR REPLACE FUNCTION match_engine.match_winner(p_match public.matches) RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_match.forfeit_absent = 'A' THEN 'B'
    WHEN p_match.forfeit_absent = 'B' THEN 'A'
    WHEN p_match.forfeit_absent IS NOT NULL THEN NULL
    WHEN coalesce(p_match.score_a, 0) + coalesce(p_match.overtime_score_a, 0)
         > coalesce(p_match.score_b, 0) + coalesce(p_match.overtime_score_b, 0) THEN 'A'
    WHEN coalesce(p_match.score_a, 0) + coalesce(p_match.overtime_score_a, 0)
         < coalesce(p_match.score_b, 0) + coalesce(p_match.overtime_score_b, 0) THEN 'B'
    WHEN p_match.penalty_score_a > p_match.penalty_score_b THEN 'A'
    WHEN p_match.penalty_score_a < p_match.penalty_score_b THEN 'B'
  END;
$$;

-- Offene Punkte vor dem Abschluss (R-EA-7, @LZ-010, @LZ-012, @LZ-013, Review #332 H3). Ein Spiel ist entschieden, wenn es
-- beendet oder „nicht ausgetragen“ ist; ein beendetes Finalrunden-Spiel braucht zusätzlich einen Sieger (oder eine
-- Wertung). Gruppen: jede Gruppe (Jeder gegen jeden = '') braucht einen geltenden Abschluss; nach einer Korrektur
-- „Besetzung prüfen“ (group_stale); mit offenen Plätzen nach dem Neu-Abschluss ein offener Gleichstand (tie_open).
CREATE OR REPLACE FUNCTION match_engine.finish_open_items(p_tournament_id uuid) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(item ORDER BY ord, sortkey), '[]'::jsonb)
    FROM (
      -- Spiele
      SELECT 1 AS ord, lpad(coalesce(m.match_number, 0)::text, 6, '0') || m.id::text AS sortkey,
             jsonb_strip_nulls(jsonb_build_object(
               'kind', CASE WHEN m.match_status IN ('running', 'paused')
                                 AND coalesce(m.live_state ->> 'status', '') <> 'decision_pending'
                            THEN 'match_running' ELSE 'match_undecided' END,
               'matchId', m.id, 'matchNumber', m.match_number, 'field', m.field, 'finalType', m.final_type,
               'groupId', CASE WHEN NOT coalesce(m.is_final, false) THEN match_engine.group_key(m.group_letter) END)) AS item
        FROM public.matches m
       WHERE m.tournament_id = p_tournament_id
         AND (   coalesce(m.match_status, 'scheduled') NOT IN ('finished', 'skipped')
              OR (m.match_status = 'finished' AND coalesce(m.is_final, false) AND m.forfeit_absent IS NULL
                  AND match_engine.match_winner(m) IS NULL))
      UNION ALL
      -- Gruppen ohne geltenden Abschluss
      SELECT 2, g.group_id,
             jsonb_build_object('kind', CASE WHEN gc.group_id IS NULL OR gc.reopened_at IS NOT NULL THEN 'group_open'
                                             WHEN cardinality(gc.open_ranks) > 0 THEN 'tie_open'
                                             ELSE 'group_stale' END,
                                'groupId', g.group_id)
             || CASE WHEN gc.reopened_at IS NULL AND cardinality(gc.open_ranks) > 0
                     THEN jsonb_build_object('places', to_jsonb(gc.open_ranks),
                                             'teamIds', to_jsonb(ARRAY(SELECT gc.ranking[r] FROM unnest(gc.open_ranks) AS r
                                                                         WHERE r <= cardinality(gc.ranking))))
                     ELSE '{}'::jsonb END
        FROM (SELECT DISTINCT match_engine.group_key(m.group_letter) AS group_id
                FROM public.matches m
               WHERE m.tournament_id = p_tournament_id AND NOT coalesce(m.is_final, false)) g
        LEFT JOIN public.group_completions gc ON gc.tournament_id = p_tournament_id AND gc.group_id = g.group_id
       WHERE gc.group_id IS NULL OR gc.reopened_at IS NOT NULL OR gc.stale OR cardinality(gc.open_ranks) > 0
      UNION ALL
      -- offene Folgen-Hinweise
      SELECT 3, lpad(n.id::text, 20, '0'),
             jsonb_build_object('kind', 'notice_open', 'noticeId', n.id, 'matchId', n.match_id, 'side', n.side)
        FROM public.bracket_notices n
       WHERE n.tournament_id = p_tournament_id AND n.resolved_at IS NULL
      UNION ALL
      -- offene Klärungen
      SELECT 4, lpad(c.id::text, 20, '0'),
             jsonb_strip_nulls(jsonb_build_object('kind', 'clarification_open', 'clarificationId', c.id,
                                                  'matchId', c.match_id, 'groupId', c.group_id))
        FROM public.clarifications c
       WHERE c.tournament_id = p_tournament_id AND c.resolved_at IS NULL
    ) x;
$$;

-- Warnungen (sperren nie, @LZ-018, @FU-068, F3): wartende Einträge je Gerät (Stand der letzten Meldung) und Geräte mit
-- Feldsteuerung, die sich seit mehr als 2 Minuten nicht gemeldet haben.
CREATE OR REPLACE FUNCTION match_engine.finish_warnings(p_tournament_id uuid) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(w ORDER BY ord, sortkey), '[]'::jsonb)
    FROM (
      SELECT 1 AS ord, coalesce(r.field, 0)::text || r.device_id::text AS sortkey,
             jsonb_strip_nulls(jsonb_build_object('kind', 'outbox_pending', 'field', r.field, 'pending', r.pending,
                                                  'reportedAt', r.reported_at, 'deviceId', r.device_id)) AS w
        FROM public.device_outbox_reports r
       WHERE r.tournament_id = p_tournament_id AND r.pending > 0
      UNION ALL
      SELECT 2, fc.field::text,
             jsonb_strip_nulls(jsonb_build_object('kind', 'device_silent', 'field', fc.field,
                                                  'deviceId', fc.holder_device_id, 'deviceLabel', fc.holder_device_label,
                                                  'since', coalesce(r.reported_at, fc.claimed_at)))
        FROM public.field_control fc
        LEFT JOIN public.device_outbox_reports r
               ON r.tournament_id = fc.tournament_id AND r.device_id = fc.holder_device_id
       WHERE fc.tournament_id = p_tournament_id AND fc.holder_device_id IS NOT NULL
         AND coalesce(r.reported_at, fc.claimed_at, '-infinity'::timestamptz) < now() - interval '2 minutes'
    ) x;
$$;

-- Form des Endstands: GLEICH mit FinalStandingsSnapshotSchema (A-20a, strikt) – Gleichlauf final-standings-shapes.json,
-- jede Grenzzeile ist Vertrag (Review #332). Längen in Zeichen wie char_length; Zeitpunkt wie zod iso.datetime mit
-- Zeitzone (Sekunden Pflicht, Bruchteile beliebig, Z oder ±hh:mm); Ziffern nur 0–9.
CREATE OR REPLACE FUNCTION match_engine.json_int_between(p jsonb, p_min numeric, p_max numeric) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN jsonb_typeof(p) = 'number'
              THEN (p #>> '{}')::numeric = trunc((p #>> '{}')::numeric)
                   AND (p #>> '{}')::numeric BETWEEN p_min AND p_max
              ELSE false END;
$$;

CREATE OR REPLACE FUNCTION match_engine.json_text_length_between(p jsonb, p_min integer, p_max integer) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN jsonb_typeof(p) = 'string' THEN char_length(p #>> '{}') BETWEEN p_min AND p_max ELSE false END;
$$;

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

CREATE OR REPLACE FUNCTION match_engine.scorer_row_valid(s jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR jsonb_typeof(s -> 'kind') IS DISTINCT FROM 'string' THEN
    RETURN false;
  END IF;
  IF s ->> 'kind' = 'player' THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(s) k WHERE k NOT IN ('kind', 'rank', 'teamId', 'teamName', 'number', 'goals'))
       OR NOT match_engine.json_int_between(s -> 'rank', 1, 999)
       OR NOT match_engine.json_int_between(s -> 'number', 0, 999) THEN
      RETURN false;
    END IF;
  ELSIF s ->> 'kind' IN ('noNumber', 'ownGoals') THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(s) k WHERE k NOT IN ('kind', 'rank', 'teamId', 'teamName', 'goals'))
       OR NOT (s ? 'rank') OR jsonb_typeof(s -> 'rank') IS DISTINCT FROM 'null' THEN
      RETURN false;
    END IF;
  ELSE
    RETURN false;
  END IF;
  RETURN jsonb_typeof(s -> 'teamId') = 'string'
     AND (s ->> 'teamId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     AND match_engine.json_text_length_between(s -> 'teamName', 1, 200)
     AND match_engine.json_int_between(s -> 'goals', 1, 9999);
END;
$$;

CREATE OR REPLACE FUNCTION match_engine.final_standings_shape_valid(p jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('format', 'ranking', 'scorers', 'appVersion', 'computedAt'))
     OR NOT (p ?& ARRAY['format', 'ranking', 'scorers', 'appVersion', 'computedAt']) THEN
    RETURN false;
  END IF;
  IF jsonb_typeof(p -> 'format') IS DISTINCT FROM 'number' OR (p ->> 'format')::numeric <> 1
     OR jsonb_typeof(p -> 'ranking') IS DISTINCT FROM 'array' OR jsonb_typeof(p -> 'scorers') IS DISTINCT FROM 'array'
     OR NOT match_engine.json_text_length_between(p -> 'appVersion', 1, 50)
     OR jsonb_typeof(p -> 'computedAt') IS DISTINCT FROM 'string'
     OR (p ->> 'computedAt') !~ ('^(?:(?:[0-9][0-9][2468][048]|[0-9][0-9][13579][26]|[0-9][0-9]0[48]|[02468][048]00|[13579][26]00)-02-29'
                                 || '|[0-9]{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)'
                                 || '|(?:02)-(?:0[1-9]|1[0-9]|2[0-8])))'
                                 || 'T(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]+)?(?:Z|([+-](?:[01][0-9]|2[0-3]):[0-5][0-9])))$') THEN
    RETURN false;
  END IF;
  IF jsonb_array_length(p -> 'ranking') < 1
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'ranking') r WHERE NOT match_engine.final_standing_row_valid(r))
     OR (SELECT count(DISTINCT r ->> 'teamId') FROM jsonb_array_elements(p -> 'ranking') r) <> jsonb_array_length(p -> 'ranking')
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'scorers') s WHERE NOT match_engine.scorer_row_valid(s)) THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

-- Platzziffern-Regel (Zwilling placeNumbersValid, sharedPlaces.ts; Gleichlauf final-standings-roundrobin.json 'validity'):
-- erster Platz 1; jede weitere Ziffer = die des Vorgängers (geteilt) oder Position (Sprung nach geteiltem Platz).
CREATE OR REPLACE FUNCTION match_engine.place_numbers_valid(p_places integer[]) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT cardinality(p_places) > 0
     AND NOT EXISTS (SELECT 1 FROM generate_subscripts(p_places, 1) AS i
                      WHERE (i = 1 AND p_places[i] IS DISTINCT FROM 1)
                         OR (i > 1 AND p_places[i] IS DISTINCT FROM p_places[i - 1] AND p_places[i] IS DISTINCT FROM i));
$$;

-- Endstand gegen das Turnier (R-EA-4, Review W4). NULL = stimmig, sonst der Grund:
--   SHAPE           Form ungültig
--   TEAM_SET        nicht genau die Teams ohne is_removed (fehlend, fremd, entfernt; doppelt fängt schon SHAPE)
--   PLACE_NUMBERS   Platzziffern verletzen „Platz = 1 + Zahl der Teams davor, geteilt = Ziffer des Vorgängers“
--   GROUP_ORDER     Jeder gegen jeden: Reihenfolge ≠ Abschluss der Gruppe '' (ohne entfernte Teams, @ET-058)
--   GROUP_PLACES    Jeder gegen jeden: Platzziffern ≠ Reihenfolge + geteilte Blöcke aus „Ergebnis so akzeptieren“
--   PLACEMENT_GAME  ein entschiedenes Platzierungsspiel: Sieger nicht auf dem oberen, Verlierer nicht auf dem unteren Platz
-- Zwilling Platzziffern: src/core/standings/finalStandings/sharedPlaces.ts (placeNumbers, placeNumbersValid).
CREATE OR REPLACE FUNCTION match_engine.final_standings_consistent(p_tournament_id uuid, p_snapshot jsonb) RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids    text[];
  v_places integer[];
  v_active text[];
  v_gc     public.group_completions;
  v_order  text[];
  v_block  integer[];
  v_expect integer[];
  v_blocks jsonb;
  i        integer;
  m        public.matches;
  v_base   integer;
  v_win    text;
  v_lose   text;
BEGIN
  IF NOT match_engine.final_standings_shape_valid(p_snapshot) THEN
    RETURN 'SHAPE';
  END IF;
  SELECT array_agg(r ->> 'teamId' ORDER BY o), array_agg((r ->> 'place')::numeric::integer ORDER BY o)
    INTO v_ids, v_places
    FROM jsonb_array_elements(p_snapshot -> 'ranking') WITH ORDINALITY AS x(r, o);
  SELECT array_agg(t.id::text ORDER BY t.id::text) INTO v_active
    FROM public.teams t WHERE t.tournament_id = p_tournament_id AND NOT coalesce(t.is_removed, false);
  IF v_active IS NULL OR (SELECT array_agg(x ORDER BY x) FROM unnest(v_ids) AS x) IS DISTINCT FROM v_active THEN
    RETURN 'TEAM_SET';
  END IF;
  IF NOT match_engine.place_numbers_valid(v_places) THEN
    RETURN 'PLACE_NUMBERS';
  END IF;

  -- Jeder gegen jeden: keine Finalrunde, alle Spiele in der Gruppe ''.
  IF NOT EXISTS (SELECT 1 FROM public.matches mm
                  WHERE mm.tournament_id = p_tournament_id
                    AND (coalesce(mm.is_final, false) OR match_engine.group_key(mm.group_letter) <> '')) THEN
    SELECT * INTO v_gc FROM public.group_completions gc
     WHERE gc.tournament_id = p_tournament_id AND gc.group_id = '' AND gc.reopened_at IS NULL;
    IF NOT FOUND THEN
      RETURN 'GROUP_ORDER';
    END IF;
    v_order := ARRAY(SELECT x::text FROM unnest(v_gc.ranking) WITH ORDINALITY AS u(x, o)
                      WHERE x::text = ANY (v_active) ORDER BY o);
    IF v_order IS DISTINCT FROM v_ids THEN
      RETURN 'GROUP_ORDER';
    END IF;
    -- Blöcke aus „Ergebnis so akzeptieren“ (tie_orders kind 'shared'), ohne entfernte Teams; je Team die Nummer seines Blocks.
    v_blocks := (SELECT coalesce(jsonb_agg(d -> 'teamIds'), '[]'::jsonb) FROM jsonb_array_elements(v_gc.tie_orders) d
                  WHERE d ->> 'kind' = 'shared');
    v_block := ARRAY(SELECT (SELECT min(b.o) FROM jsonb_array_elements(v_blocks) WITH ORDINALITY AS b(ids, o)
                              WHERE b.ids ? v_ids[k])
                       FROM generate_subscripts(v_ids, 1) AS k ORDER BY k);
    v_expect := '{}'::integer[];
    FOR i IN 1 .. cardinality(v_ids) LOOP
      v_expect := v_expect || CASE WHEN i > 1 AND v_block[i] IS NOT NULL AND v_block[i] = v_block[i - 1]
                                   THEN v_expect[i - 1] ELSE i END;
    END LOOP;
    IF v_expect IS DISTINCT FROM v_places THEN
      RETURN 'GROUP_PLACES';
    END IF;
  END IF;

  -- Platzierungsspiele: der Sieger steht auf dem oberen, der Verlierer auf dem unteren Platz des Spiels.
  FOR m IN SELECT * FROM public.matches mm
            WHERE mm.tournament_id = p_tournament_id AND coalesce(mm.is_final, false)
              AND mm.final_type IN ('final', 'thirdPlace', 'fifthSixth', 'seventhEighth')
              AND mm.match_status = 'finished' AND mm.team_a_id IS NOT NULL AND mm.team_b_id IS NOT NULL
            ORDER BY mm.id LOOP
    v_base := CASE m.final_type WHEN 'final' THEN 1 WHEN 'thirdPlace' THEN 3 WHEN 'fifthSixth' THEN 5 ELSE 7 END;
    v_win := CASE match_engine.match_winner(m) WHEN 'A' THEN m.team_a_id::text WHEN 'B' THEN m.team_b_id::text END;
    v_lose := CASE match_engine.match_winner(m) WHEN 'A' THEN m.team_b_id::text WHEN 'B' THEN m.team_a_id::text END;
    IF v_win IS NOT NULL
       AND (v_places[array_position(v_ids, v_win)] IS DISTINCT FROM v_base
            OR v_places[array_position(v_ids, v_lose)] IS DISTINCT FROM v_base + 1) THEN
      RETURN 'PLACEMENT_GAME';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- Späte Einträge (R-EA-5, Review B3): Ereignisse eines abgeschlossenen Turniers zählen nicht. Schon gespeicherte IDs
-- antworten wie bisher (duplicate bzw. ID_CONFLICT, keine late_entries-Zeile); neue IDs werden aufbewahrt (eine Zeile je
-- Spiel und Ereignis, Wiederholung ohne zweite Zeile) und mit review AFTER_FINISH beantwortet (@FU-018: das Gerät nimmt
-- sie aus dem Ausgang, „an die Turnierleitung übergeben“). Kein field_control, keine Anwendung, kein match_events.
CREATE OR REPLACE FUNCTION match_engine.closed_intake(p_tournament_id uuid, p_match_id uuid, p_events jsonb,
                                                      p_actor uuid, p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match    public.matches;
  v_raw      jsonb;
  v_event    jsonb;
  v_id       jsonb;
  v_existing record;
  v_results  jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  FOR v_raw IN SELECT x.e FROM jsonb_array_elements(p_events) WITH ORDINALITY AS x(e, ord) ORDER BY x.ord LOOP
    v_event := match_engine.envelope(v_raw, v_match.team_a_id::text, v_match.team_b_id::text);
    v_id := coalesce(v_event -> 'id', CASE WHEN jsonb_typeof(v_raw) = 'object' THEN v_raw -> 'id' END, 'null'::jsonb);
    IF v_event IS NULL THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'rejected', 'code', 'INVALID_PAYLOAD'));
      CONTINUE;
    END IF;
    SELECT e.match_id, e.seq,
           match_engine.dedupe_key(jsonb_build_object(
             'type', e.type, 'teamId', e.team_id::text, 'targetId', e.target_event_id::text,
             'section', e.section, 'clockMs', e.clock_ms, 'payload', e.payload)) AS content
      INTO v_existing
      FROM public.match_events e
     WHERE e.id = (v_event ->> 'id')::uuid;
    IF FOUND THEN
      IF v_existing.match_id = p_match_id AND v_existing.content = match_engine.dedupe_key(v_event) THEN
        v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_event -> 'id', 'status', 'duplicate',
                                                                       'seq', v_existing.seq));
      ELSE
        v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_event -> 'id', 'status', 'rejected',
                                                                       'code', 'ID_CONFLICT'));
      END IF;
      CONTINUE;
    END IF;
    INSERT INTO public.late_entries (tournament_id, match_id, event_id, event, actor, device_id)
    VALUES (p_tournament_id, p_match_id, (v_event ->> 'id')::uuid, v_raw, p_actor, p_device_id)
    ON CONFLICT (match_id, event_id) DO NOTHING;
    v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_event -> 'id', 'status', 'review',
                                                                   'code', 'AFTER_FINISH'));
  END LOOP;
  RETURN jsonb_build_object('results', v_results, 'state', NULL, 'tournamentClosed', true,
                            'serverTime', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint);
END;
$$;

REVOKE ALL ON FUNCTION match_engine.tournament_state(uuid),
                       match_engine.match_winner(public.matches),
                       match_engine.finish_open_items(uuid),
                       match_engine.finish_warnings(uuid),
                       match_engine.json_int_between(jsonb, numeric, numeric),
                       match_engine.json_text_length_between(jsonb, integer, integer),
                       match_engine.final_standing_row_valid(jsonb),
                       match_engine.scorer_row_valid(jsonb),
                       match_engine.final_standings_shape_valid(jsonb),
                       match_engine.place_numbers_valid(integer[]),
                       match_engine.final_standings_consistent(uuid, jsonb),
                       match_engine.closed_intake(uuid, uuid, jsonb, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------------------------------------------------

-- Name einer Person für Antworten (wie bracket_log_read: Eigentümer Profilname, sonst Bezeichnung der Mitgliedschaft).
CREATE OR REPLACE FUNCTION match_engine.actor_name(p_tournament_id uuid, p_actor uuid) RETURNS text
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_actor = t.owner_id THEN nullif(btrim(p.display_name), '')
              ELSE coalesce((SELECT nullif(btrim(c.label), '') FROM public.tournament_collaborators c
                              WHERE c.tournament_id = t.id AND c.user_id = p_actor
                              ORDER BY c.accepted_at DESC NULLS LAST LIMIT 1),
                            nullif(btrim(p.display_name), '')) END
    FROM public.tournaments t
    LEFT JOIN public.profiles p ON p.id = p_actor
   WHERE t.id = p_tournament_id;
$$;
REVOKE ALL ON FUNCTION match_engine.actor_name(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Turnier abschließen (@LZ-009, R-EA-2). Reihenfolge: Recht -> Spiele sperren (nach id, eine Anweisung) -> Turnier
-- sperren -> request_id bekannt -> Zustand -> offene Punkte -> Stand -> Endstand -> schreiben. Alles in EINER Transaktion
-- (@LZ-024); eine Ausnahme danach rollt alles zurück.
CREATE OR REPLACE FUNCTION public.finish_tournament(p_tournament_id uuid, p_expected_state jsonb,
                                                    p_final_standings jsonb, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_t        public.tournaments;
  v_log      public.tournament_lifecycle_log;
  v_items    jsonb;
  v_expected jsonb;
  v_problem  text;
  v_now      timestamptz := now();
BEGIN
  IF v_uid IS NULL OR NOT public.has_tournament_permission(p_tournament_id, 'manageLifecycle') THEN
    RAISE EXCEPTION 'finish_tournament: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_request_id IS NULL OR jsonb_typeof(p_expected_state) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'INVALID_INPUT');
  END IF;

  -- Sperren wie complete_group (R-GA4v2-8): alle Spiele nach id in EINER Anweisung, dann die Turnierzeile.
  PERFORM 1 FROM public.matches m WHERE m.tournament_id = p_tournament_id ORDER BY m.id FOR UPDATE;
  SELECT * INTO v_t FROM public.tournaments WHERE id = p_tournament_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'finish_tournament: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Wiederholung nach ausgebliebener Antwort (@LZ-021): dieselbe request_id -> ok alreadyApplied.
  SELECT * INTO v_log FROM public.tournament_lifecycle_log WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_log.kind = 'finish' AND v_log.tournament_id = p_tournament_id THEN
      RETURN jsonb_build_object('status', 'ok', 'alreadyApplied', true, 'finishedAt', v_log.created_at);
    END IF;
    RETURN jsonb_build_object('status', 'rejected', 'code', 'REQUEST_ID_CONFLICT');
  END IF;

  IF v_t.lifecycle_status = 'finished' THEN
    SELECT * INTO v_log FROM public.tournament_lifecycle_log
     WHERE tournament_id = p_tournament_id AND kind = 'finish' ORDER BY id DESC LIMIT 1;
    RETURN jsonb_build_object('status', 'rejected', 'code', 'ALREADY_FINISHED',
                              'by', match_engine.actor_name(p_tournament_id, v_log.actor), 'byUserId', v_log.actor,
                              'at', v_t.finished_at);
  END IF;
  IF public.tournament_lifecycle(p_tournament_id) IS DISTINCT FROM 'running' THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'NOT_RUNNING',
                              'lifecycle', public.tournament_lifecycle(p_tournament_id));
  END IF;

  v_items := match_engine.finish_open_items(p_tournament_id);
  IF jsonb_array_length(v_items) > 0 THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'OPEN_ITEMS', 'items', v_items);
  END IF;

  -- Stand-Vergleich (@LZ-029, R-EA-14): der Endstand gilt nur für den Stand, auf dem das Gerät ihn gerechnet hat.
  v_expected := (SELECT coalesce(jsonb_agg(jsonb_strip_nulls(e) ORDER BY e ->> 'id'), '[]'::jsonb)
                   FROM jsonb_array_elements(p_expected_state) e);
  IF v_expected IS DISTINCT FROM match_engine.tournament_state(p_tournament_id) THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'STALE_STATE');
  END IF;

  v_problem := match_engine.final_standings_consistent(p_tournament_id, p_final_standings);
  IF v_problem IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'INVALID_STANDINGS', 'reason', v_problem);
  END IF;

  -- Schreiben: Endstand, Zustand, Verlauf. Der Schalter gilt nur in dieser Transaktion und nur hier.
  PERFORM set_config('app.lifecycle_write', 'on', true);
  INSERT INTO public.tournament_final_standings AS fs (tournament_id, snapshot, finished_at, finished_by, request_id)
  VALUES (p_tournament_id, p_final_standings, v_now, v_uid, p_request_id)
  ON CONFLICT (tournament_id) DO UPDATE
    SET snapshot = EXCLUDED.snapshot, finished_at = EXCLUDED.finished_at, finished_by = EXCLUDED.finished_by,
        request_id = EXCLUDED.request_id;
  UPDATE public.tournaments
     SET lifecycle_status = 'finished', finished_at = v_now, change_revision = change_revision + 1
   WHERE id = p_tournament_id;
  INSERT INTO public.tournament_lifecycle_log (tournament_id, kind, request_id, actor, created_at)
  VALUES (p_tournament_id, 'finish', p_request_id, v_uid, v_now);
  PERFORM set_config('app.lifecycle_write', '', true);
  RETURN jsonb_build_object('status', 'ok', 'finishedAt', v_now);
END;
$$;

-- Abschluss-Liste (R-EA-7): offene Punkte (sperren) und Warnungen (sperren nie); dazu der Stand für den Stand-Vergleich
-- (R-EA-14: das Gerät rechnet auf diesem bestätigten Serverstand). Nur Turnierleitung; nichts wird gesperrt.
CREATE OR REPLACE FUNCTION public.finish_preflight(p_tournament_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_lifecycle text;
  v_items     jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_tournament_permission(p_tournament_id, 'manageLifecycle')
     OR NOT EXISTS (SELECT 1 FROM public.tournaments WHERE id = p_tournament_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'finish_preflight: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_lifecycle := public.tournament_lifecycle(p_tournament_id);
  v_items := CASE WHEN v_lifecycle IN ('finished', 'cancelled') THEN '[]'::jsonb
                  ELSE match_engine.finish_open_items(p_tournament_id) END;
  RETURN jsonb_build_object(
    'status', 'ok',
    'lifecycle', v_lifecycle,
    'finishedAt', (SELECT finished_at FROM public.tournaments WHERE id = p_tournament_id),
    'canFinish', v_lifecycle = 'running' AND jsonb_array_length(v_items) = 0,
    'items', v_items,
    'warnings', CASE WHEN v_lifecycle IN ('finished', 'cancelled') THEN '[]'::jsonb
                     ELSE match_engine.finish_warnings(p_tournament_id) END,
    'state', match_engine.tournament_state(p_tournament_id));
END;
$$;

-- Wieder öffnen (R-EA-12, F1, @LZ-091 Notweg, @ET-046): Zustand 'fixed' (liest sich mit Anpfiff als „Läuft“),
-- finished_at = NULL, die Zeit bleibt im Verlauf. Der gespeicherte Endstand bleibt bis zum nächsten Abschluss stehen.
-- Grund 1–500 Zeichen. Helfer schreiben danach sofort wieder, der Helfer-Code gilt wieder (am selben Tag).
CREATE OR REPLACE FUNCTION public.reopen_tournament(p_tournament_id uuid, p_reason text, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_t   public.tournaments;
  v_log public.tournament_lifecycle_log;
BEGIN
  IF v_uid IS NULL OR NOT public.has_tournament_permission(p_tournament_id, 'manageLifecycle') THEN
    RAISE EXCEPTION 'reopen_tournament: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_request_id IS NULL THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'INVALID_INPUT');
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'REASON_REQUIRED');
  END IF;
  PERFORM 1 FROM public.matches m WHERE m.tournament_id = p_tournament_id ORDER BY m.id FOR UPDATE;
  SELECT * INTO v_t FROM public.tournaments WHERE id = p_tournament_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reopen_tournament: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_log FROM public.tournament_lifecycle_log WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_log.kind = 'reopen' AND v_log.tournament_id = p_tournament_id THEN
      RETURN jsonb_build_object('status', 'ok', 'alreadyApplied', true);
    END IF;
    RETURN jsonb_build_object('status', 'rejected', 'code', 'REQUEST_ID_CONFLICT');
  END IF;
  IF v_t.lifecycle_status IS DISTINCT FROM 'finished' THEN
    RETURN jsonb_build_object('status', 'rejected', 'code', 'NOT_FINISHED');
  END IF;
  PERFORM set_config('app.lifecycle_write', 'on', true);
  UPDATE public.tournaments
     SET lifecycle_status = 'fixed', finished_at = NULL, change_revision = change_revision + 1
   WHERE id = p_tournament_id;
  INSERT INTO public.tournament_lifecycle_log (tournament_id, kind, reason, request_id, actor, finished_at_before)
  VALUES (p_tournament_id, 'reopen', btrim(p_reason), p_request_id, v_uid, v_t.finished_at);
  PERFORM set_config('app.lifecycle_write', '', true);
  RETURN jsonb_build_object('status', 'ok', 'lifecycle', public.tournament_lifecycle(p_tournament_id));
END;
$$;

-- Gespeicherter Endstand für Zuschauer und Monitor (R-EA-3, R-EA-9, @LZ-074, @LZ-075, @LZ-076, @ZM-011, @ZM-012):
-- nur nach dem Abschluss ('finished'), Torschützen nur mit config.publicScorers = true. Sonst {status:'none'} (auch für
-- unbekannte oder nicht freigegebene Turniere: kein Existenz-Orakel).
CREATE OR REPLACE FUNCTION match_engine.final_standings_payload(p_tournament public.tournaments) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_tournament.id IS NULL OR p_tournament.deleted_at IS NOT NULL
         OR p_tournament.lifecycle_status IS DISTINCT FROM 'finished' OR fs.snapshot IS NULL
      THEN jsonb_build_object('status', 'none')
    ELSE jsonb_build_object(
      'status', 'final',
      'finishedAt', p_tournament.finished_at,
      'standings', CASE WHEN coalesce(p_tournament.config -> 'publicScorers' = 'true'::jsonb, false)
                        THEN fs.snapshot ELSE fs.snapshot - 'scorers' END)
  END
    FROM (SELECT 1) AS one
    LEFT JOIN public.tournament_final_standings fs ON fs.tournament_id = p_tournament.id;
$$;
REVOKE ALL ON FUNCTION match_engine.final_standings_payload(public.tournaments) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_final_standings(p_share_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments;
BEGIN
  IF p_share_code IS NULL OR char_length(p_share_code) > 20 THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  SELECT * INTO v_t FROM public.tournaments t
   WHERE t.share_code = p_share_code AND coalesce(t.is_public, false) AND t.deleted_at IS NULL;
  RETURN match_engine.final_standings_payload(v_t);
END;
$$;

-- Monitor (B5, I-2): lädt über /display/:tournamentId/:monitorId und kennt keinen Teilen-Code. Gleiche Regeln wie
-- public_final_standings; erlaubt mit readDisplay (Bildschirm, Turnierleitung) oder bei öffentlichem Turnier.
CREATE OR REPLACE FUNCTION public.display_final_standings(p_tournament_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments;
BEGIN
  SELECT * INTO v_t FROM public.tournaments t WHERE t.id = p_tournament_id AND t.deleted_at IS NULL;
  IF NOT FOUND
     OR NOT (coalesce(v_t.is_public, false)
             OR (auth.uid() IS NOT NULL AND public.has_tournament_permission(p_tournament_id, 'readDisplay'))) THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;
  RETURN match_engine.final_standings_payload(v_t);
END;
$$;

-- Meldung wartender Einträge eines Geräts (F3, A-21a-C3; @FU-068, @LZ-018). Recht wie für Einträge (writeMatchData);
-- bleibt nach dem Abschluss erlaubt (Ausnahmeliste), sperrt nie etwas.
CREATE OR REPLACE FUNCTION public.report_device_outbox(p_tournament_id uuid, p_device_id uuid, p_field integer,
                                                       p_pending integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_tournament_permission(p_tournament_id, 'writeMatchData')
     OR NOT EXISTS (SELECT 1 FROM public.tournaments WHERE id = p_tournament_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'report_device_outbox: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_device_id IS NULL OR p_pending IS NULL OR p_pending NOT BETWEEN 0 AND 100000
     OR (p_field IS NOT NULL AND p_field NOT BETWEEN 1 AND 99) THEN
    RAISE EXCEPTION 'report_device_outbox: Geraet und Zahl 0 bis 100000 sind Pflicht' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.device_outbox_reports (tournament_id, device_id, user_id, field, pending, reported_at)
  VALUES (p_tournament_id, p_device_id, v_uid, p_field, p_pending, now())
  ON CONFLICT (tournament_id, device_id) DO UPDATE
    SET user_id = EXCLUDED.user_id, field = EXCLUDED.field, pending = EXCLUDED.pending, reported_at = EXCLUDED.reported_at;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_tournament(uuid, jsonb, jsonb, uuid),
                       public.finish_preflight(uuid),
                       public.reopen_tournament(uuid, text, uuid),
                       public.report_device_outbox(uuid, uuid, integer, integer),
                       public.public_final_standings(text),
                       public.display_final_standings(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_tournament(uuid, jsonb, jsonb, uuid),
                          public.finish_preflight(uuid),
                          public.reopen_tournament(uuid, text, uuid),
                          public.report_device_outbox(uuid, uuid, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_final_standings(text), public.display_final_standings(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. append_match_events (Fassung 20261110_005) + A-21a-Block (R-EA-5)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.append_match_events(p_match_id uuid, p_events jsonb,
                                                      p_client_format integer, p_device_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_cascade_types constant text[] := ARRAY['MATCH_START', 'RESUME', 'SECTION_START', 'REOPEN', 'UNSKIP'];
  v_uid uuid := auth.uid();
  v_min_format integer;
  v_tournament_id uuid;
  v_actor text;
  v_match public.matches%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_ctx jsonb;
  v_transitions jsonb;
  v_stored jsonb;
  v_state jsonb;
  v_base_seq bigint;
  v_last_at bigint;
  v_now timestamptz;
  v_now_ms bigint;
  v_results jsonb := '[]'::jsonb;
  v_cascade boolean := false;
  v_raw jsonb;
  v_raw_type text;
  v_event jsonb;
  v_result_id jsonb;
  v_result jsonb;
  v_existing record;
  v_at_server bigint;
  v_at_eval bigint;
  v_phase_before text;
  v_step jsonb;
  v_seq bigint;
  v_accepted integer := 0;
  v_started_now boolean := false;
  v_cache jsonb;
  v_stored_count integer;
  -- ZA-3 Fixrunde 1 (W1, @SL-147): Fristen zusaetzlich an der Serveruhr, mit Nachsende-Spielraum.
  -- Gleiche Werte in TS: handlers/reopen.ts (CONTINUE_WINDOW_MS, SERVER_CLOCK_TOLERANCE_MS),
  -- handlers/retract.ts (MATCH_START_UNDO_MS).
  c_continue_window_ms constant bigint := 120000;
  c_match_start_undo_ms constant bigint := 30000;
  c_server_clock_tolerance_ms constant bigint := 600000;
  v_server_reject jsonb;
  v_server_mark timestamptz;
  -- A-25a (@FU-094, R-A25a-1): K.-o.-Kennzeichen aus derselben Quelle wie die Regeln beim Anpfiff.
  v_knockout boolean;
  v_shootout_violation text;
  -- A-34 (Steuer je Feld, brief-A-34.md): Zeile des Feldes dieses Spiels, fuer den ganzen Aufruf gesperrt.
  c_live_states constant text[] := ARRAY['running', 'paused', 'section_break', 'decision_pending', 'shootout'];
  v_fc public.field_control%ROWTYPE;
  v_claim_pending boolean;
  v_claimed_in_call boolean := false;
  v_control_reject jsonb;
  v_epoch_sent integer;
  -- A-25n (R-A25b-1): REOPEN, das eine Nichtantritt-Wertung zuruecknimmt (Spiel wird wieder 'scheduled', nicht laufend).
  v_forfeit_reopen boolean;
BEGIN
  -- 1. Aufrufer, Eingabe, Client-Format.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'append_match_events: nicht angemeldet (auth.uid() ist NULL)' USING ERRCODE = '42501';
  END IF;
  IF p_events IS NULL OR jsonb_typeof(p_events) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'append_match_events: p_events muss ein jsonb-Array sein' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_events) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'append_match_events: p_events braucht 1 bis 200 Ereignisse (war: %)', jsonb_array_length(p_events)
      USING ERRCODE = '22023';
  END IF;

  SELECT CASE WHEN jsonb_typeof(c.value) = 'number' THEN c.value::numeric::integer END
    INTO v_min_format
    FROM public.app_config c
   WHERE c.key = 'min_client_format';
  v_min_format := coalesce(v_min_format, 1);
  IF p_client_format IS NULL OR p_client_format < v_min_format THEN
    RETURN jsonb_build_object('error', 'CLIENT_OUTDATED', 'minClientFormat', v_min_format,
                              'serverTime', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint);
  END IF;

  -- 2./3. Spiel und Akteursklasse (R7). Rechtepruefung VOR der Sperre: wer kein Recht hat, darf
  -- das Spiel auch nicht sperren. Fixrunde 1 (M3, M6): ein nicht existierendes Spiel und ein
  -- soft-geloeschtes Turnier (tournaments.deleted_at) ergeben dieselbe Antwort wie ein fehlendes
  -- Recht -- kein Existenz-Orakel, kein Schreiben in den Papierkorb.
  SELECT m.tournament_id INTO v_tournament_id
    FROM public.matches m
    JOIN public.tournaments t ON t.id = m.tournament_id
   WHERE m.id = p_match_id
     AND t.deleted_at IS NULL;

  IF v_tournament_id IS NOT NULL AND public.has_tournament_permission(v_tournament_id, 'leadMatches') THEN
    v_actor := 'leitung';
  ELSIF v_tournament_id IS NOT NULL AND public.has_tournament_permission(v_tournament_id, 'writeMatchData') THEN
    v_actor := 'helper';
  ELSE
    SELECT jsonb_agg(jsonb_build_object(
             'id', coalesce(to_jsonb(match_engine.normalize_uuid(e -> 'id')), e -> 'id', 'null'::jsonb),
             'status', 'rejected', 'code', 'FORBIDDEN_ACTOR') ORDER BY ord)
      INTO v_results
      FROM jsonb_array_elements(p_events) WITH ORDINALITY AS x(e, ord);
    RETURN jsonb_build_object('results', v_results, 'state', NULL,
                              'serverTime', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint);
  END IF;

  -- R12/R3: ein Spiel je Aufruf, Geraete werden je Spiel serialisiert.
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;
  IF v_match.id IS NULL OR v_tournament.deleted_at IS NOT NULL THEN
    -- Zwischen Rechtepruefung und Sperre geloescht (sehr selten): nichts schreiben.
    RAISE EXCEPTION 'append_match_events: Spiel % nicht mehr beschreibbar', p_match_id USING ERRCODE = '55000';
  END IF;
  -- A-21a (R-EA-5, Review B3): abgeschlossenes Turnier -> spaete Eintraege aufbewahren (late_entries), nichts anwenden,
  -- keine field_control-Zeile. Steht VOR dem Feld-INSERT (I-5: wer append neu fasst, uebernimmt diesen Block hier).
  IF public.tournament_is_closed(v_match.tournament_id) THEN
    RETURN match_engine.closed_intake(v_match.tournament_id, p_match_id, p_events, v_uid, p_device_id);
  END IF;
  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN
    RAISE EXCEPTION 'append_match_events: Spiel % hat noch keine zwei Teams', p_match_id USING ERRCODE = '22023';
  END IF;

  -- Serverzeit NACH der Sperre: ein wartender Aufruf klemmt nicht hinter einen spaeter
  -- gespeicherten Vorgaenger.
  v_now := clock_timestamp();
  v_now_ms := floor(extract(epoch FROM v_now) * 1000)::bigint;
  v_ctx := jsonb_build_object('matchId', p_match_id::text,
                              'teamAId', v_match.team_a_id::text,
                              'teamBId', v_match.team_b_id::text);

  -- A-34 c0: Zeile des Feldes sperren. Mit Geraete-ID vorher anlegen (frei, Epoche 0), damit zwei gleichzeitige
  -- Erst-Ansprueche auf dasselbe Feld sich an dieser Zeile anstellen (@FU-030: genau ein Geraet steuert). Ohne
  -- Geraete-ID (App vor B-49) entsteht keine Zeile; eine bestehende wird trotzdem gesperrt und geprueft.
  IF p_device_id IS NOT NULL THEN
    INSERT INTO public.field_control (tournament_id, field, epoch)
    VALUES (v_match.tournament_id, v_match.field, 0)
    ON CONFLICT (tournament_id, field) DO NOTHING;
  END IF;
  SELECT * INTO v_fc FROM public.field_control
   WHERE tournament_id = v_match.tournament_id AND field = v_match.field
     FOR UPDATE;

  -- 4. Aktueller Zustand: gespeicherte Engine-Ereignisse, genau wie compute_match_state sie liest
  -- (S1 actor = leitung, S2 at aus client_time), aber im Definer-Kontext (alle Zeilen).
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'from', t.from_status, 'type', t.event_type, 'actor', t.actor, 'to', t.to_status)
           ORDER BY t.from_status, t.event_type), '[]'::jsonb)
    INTO v_transitions
    FROM public.match_transitions t;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id::text,
           'type', e.type,
           'actor', 'leitung',
           'at', floor(extract(epoch FROM coalesce(e.client_time, e.recorded_at)) * 1000)::bigint,
           'section', e.section,
           'clockMs', e.clock_ms,
           'teamId', e.team_id::text,
           'targetId', e.target_event_id::text,
           'payload', e.payload) ORDER BY e.seq), '[]'::jsonb)
    INTO v_stored
    FROM public.match_events e
   WHERE e.match_id = p_match_id
     AND e.event_format IS NOT NULL
     AND e.review_state IS NULL;

  v_last_at := (SELECT (x.e ->> 'at')::bigint FROM jsonb_array_elements(v_stored) WITH ORDINALITY AS x(e, ord)
                ORDER BY x.ord DESC LIMIT 1);
  SELECT coalesce(max(e.seq), 0) INTO v_base_seq FROM public.match_events e WHERE e.match_id = p_match_id;

  v_stored_count := jsonb_array_length(v_stored);

  -- Einmal reduzieren, danach je Ereignis anschliessen (B3a-Review M3).
  v_state := public.match_reduce(v_stored, v_ctx, v_transitions, 'log') -> 'state';

  -- 5. Je Ereignis in Array-Reihenfolge.
  FOR v_raw IN
    SELECT x.e FROM jsonb_array_elements(p_events) WITH ORDINALITY AS x(e, ord) ORDER BY x.ord
  LOOP
    v_raw_type := CASE WHEN jsonb_typeof(v_raw) = 'object' AND jsonb_typeof(v_raw -> 'type') = 'string'
                       THEN v_raw ->> 'type' END;
    -- a. Umschlag (S9/S10).
    v_event := match_engine.envelope(v_raw, v_ctx ->> 'teamAId', v_ctx ->> 'teamBId');
    v_result_id := coalesce(v_event -> 'id',
                            CASE WHEN jsonb_typeof(v_raw) = 'object' THEN v_raw -> 'id' END,
                            'null'::jsonb);

    IF v_cascade THEN
      v_result := jsonb_build_object('id', v_result_id, 'status', 'rejected', 'code', 'DEPENDS_ON_REJECTED');
    ELSIF v_event IS NULL THEN
      v_result := jsonb_build_object('id', v_result_id, 'status', 'rejected', 'code', 'INVALID_PAYLOAD');
    ELSE
      -- b. Idempotenz (R11/K3) gegen die Tabelle.
      SELECT e.match_id, e.seq,
             match_engine.dedupe_key(jsonb_build_object(
               'type', e.type, 'teamId', e.team_id::text, 'targetId', e.target_event_id::text,
               'section', e.section, 'clockMs', e.clock_ms, 'payload', e.payload)) AS content
        INTO v_existing
        FROM public.match_events e
       WHERE e.id = (v_event ->> 'id')::uuid;

      IF FOUND THEN
        IF v_existing.match_id = p_match_id AND v_existing.content = match_engine.dedupe_key(v_event) THEN
          v_result := jsonb_build_object('id', v_event -> 'id', 'status', 'duplicate', 'seq', v_existing.seq);
        ELSE
          v_result := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'ID_CONFLICT');
        END IF;
      ELSE
        -- c. Zeit (R2, S11).
        v_at_server := greatest(coalesce(v_last_at, 0), least((v_event -> 'at')::numeric, v_now_ms))::bigint;
        v_at_eval := floor(extract(epoch FROM to_timestamp(v_at_server / 1000.0)) * 1000)::bigint;
        v_event := v_event || jsonb_build_object('at', v_at_eval, 'actor', v_actor);

        -- c3. A-34 Steuer je Feld (@FU-026, @FU-030, @SL-018, @SL-046, @FU-081): an einem laufenden Spiel und fuer
        -- Anpfiff/Wiedereroeffnen nimmt der Server nur Eintraege des steuernden Geraets an (Konto bzw. Geraetesitzung
        -- UND Geraete-ID). An nicht laufenden Spielen sonst keine Steuer (Auflage Bauplan § 20: Direkteintrag,
        -- Korrektur, Absetzen, Nachtrag). Reine Serverpruefung (kein TS-Zwilling), vor den Fristen c2 und der
        -- Rechenfunktion, nach der Idempotenz (ein Duplikat bleibt ein Duplikat).
        v_control_reject := NULL;
        v_claim_pending := false;
        -- A-25n (R-A25b-1, @W2A-026): das Zuruecknehmen einer Wertung startet kein Spiel (Ziel 'scheduled') -- es
        -- braucht keine Steuer, wie Direkteintrag und Korrektur an nicht laufenden Spielen (Auflage Bauplan § 20).
        v_forfeit_reopen := coalesce(v_event ->> 'type' = 'REOPEN' AND v_state ->> 'status' = 'finished'
                                     AND v_state -> 'overrides' -> -1 ->> 'kind' = 'forfeit', false);
        IF v_state ->> 'status' = ANY (c_live_states)
           OR (v_event ->> 'type' IN ('MATCH_START', 'REOPEN') AND NOT v_forfeit_reopen) THEN
          IF v_fc.holder_user_id IS NULL THEN
            -- Feld frei: mit Geraete-ID wird der Aufrufer Halter, sobald das Ereignis angenommen ist (f2);
            -- ohne Geraete-ID bleibt es frei und ungeprueft (brief-A-34 L7).
            v_claim_pending := p_device_id IS NOT NULL;
          ELSIF v_fc.holder_user_id = v_uid AND v_fc.holder_device_id = p_device_id THEN
            -- Halter: ein Eintrag aus einer frueheren Steuer-Epoche desselben Geraets zaehlt nicht. null = unbekannt
            -- (zaehlt); nach einem Anspruch in diesem Aufruf gehoeren die folgenden Ereignisse schon dazu.
            v_epoch_sent := (v_event ->> 'controlEpoch')::integer;
            IF NOT v_claimed_in_call AND v_epoch_sent IS NOT NULL AND v_epoch_sent <> v_fc.epoch THEN
              v_control_reject := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'NOT_CONTROLLER',
                'detail', jsonb_build_object('reason', 'STALE_EPOCH')
                          || public.field_control_info(v_match.tournament_id, v_match.field, p_device_id));
            END IF;
          ELSE
            v_control_reject := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'NOT_CONTROLLER',
              'detail', jsonb_build_object('reason', 'OTHER_DEVICE')
                        || public.field_control_info(v_match.tournament_id, v_match.field, p_device_id));
          END IF;
        END IF;

        -- c2. ZA-3 Fixrunde 1 (W1, @SL-147): `at` ist nur nach oben geklemmt -- ein zurueckdatiertes `at`
        -- hielte die Fristen sonst kuenstlich offen. Gemessen wird zusaetzlich die Serverzeit seit dem
        -- Eintreffen des Abpfiffs (Helfer-REOPEN) bzw. des Anpfiffs (RETRACT des Anpfiffs), mit Spielraum
        -- fuer das Nachsenden ohne Netz. Die Rechenfunktion kennt keine Serverzeit; die Pruefung gilt nur hier.
        v_server_reject := NULL;
        IF v_event ->> 'type' = 'REOPEN' AND v_actor = 'helper' THEN
          SELECT max(e.recorded_at) INTO v_server_mark FROM public.match_events e
           WHERE e.match_id = p_match_id AND e.event_format IS NOT NULL AND e.review_state IS NULL AND e.type = 'MATCH_END';
          IF v_server_mark IS NOT NULL
             AND v_now_ms - floor(extract(epoch FROM v_server_mark) * 1000)::bigint > c_continue_window_ms + c_server_clock_tolerance_ms THEN
            v_server_reject := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'FORBIDDEN_ACTOR',
                                                  'detail', '{"reason": "CONTINUE_WINDOW_EXPIRED"}'::jsonb);
          END IF;
        ELSIF v_event ->> 'type' = 'RETRACT'
              AND v_state -> 'accepted' -> (v_event ->> 'targetId') ->> 'type' = 'MATCH_START' THEN
          SELECT max(e.recorded_at) INTO v_server_mark FROM public.match_events e
           WHERE e.match_id = p_match_id AND e.event_format IS NOT NULL AND e.review_state IS NULL AND e.type = 'MATCH_START';
          IF v_server_mark IS NOT NULL
             AND v_now_ms - floor(extract(epoch FROM v_server_mark) * 1000)::bigint > c_match_start_undo_ms + c_server_clock_tolerance_ms THEN
            v_server_reject := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'INVALID_PAYLOAD');
          END IF;
        END IF;

        IF v_control_reject IS NOT NULL THEN
          v_result := v_control_reject;
        ELSIF v_server_reject IS NOT NULL THEN
          v_result := v_server_reject;
        ELSE
        -- d. Regeln setzt der Server (R4/R4b).
        IF v_event ->> 'type' = 'MATCH_START' THEN
          v_event := jsonb_set(v_event, '{payload,rules}', match_engine.server_rules(
            v_match.duration_minutes, v_match.phase, v_tournament.group_phase_duration,
            v_tournament.final_round_duration, v_tournament.config, v_tournament.finals_config,
            v_match.final_type));
        END IF;

        -- e. Rechenfunktion.
        v_phase_before := v_state ->> 'phase';
        v_step := public.match_continue(v_state, jsonb_build_array(v_event), v_ctx, v_transitions, 'log');
        v_result := v_step -> 'results' -> 0;

        -- e2. A-25a (@FU-094, R-A25a-1): ein Direkteintrag in ein K.-o.-Spiel braucht bei Gleichstand ein
        -- Strafstossergebnis, ein Gruppenspiel darf keins haben. Die Rechenfunktion prueft nur die Form
        -- (sie kennt ohne Anpfiff keine Regeln); die Regel gilt hier, NACH ihr (Rechte-, Feld- und
        -- Zustandspruefungen haben Vorrang) und VOR dem Speichern. Die Payload bleibt unveraendert
        -- (dedupe_key). Zwilling: src/core/match/resultEntryShootout.ts (Geraet vor dem Senden).
        IF v_result ->> 'status' = 'accepted' AND v_event ->> 'type' = 'RESULT_ENTRY' THEN
          v_knockout := coalesce((match_engine.server_rules(
            v_match.duration_minutes, v_match.phase, v_tournament.group_phase_duration,
            v_tournament.final_round_duration, v_tournament.config, v_tournament.finals_config,
            v_match.final_type) ->> 'knockout')::boolean, false);
          v_shootout_violation := CASE
            WHEN NOT v_knockout AND (v_event -> 'payload') ? 'shootout' THEN 'SHOOTOUT_NOT_ALLOWED'
            -- A-25n (R-A25b-2): eine Nichtantritt-Wertung braucht kein Strafstossergebnis (beide fehlen im K.-o.: 0:0).
            WHEN v_knockout AND NOT ((v_event -> 'payload') ? 'shootout') AND NOT ((v_event -> 'payload') ? 'forfeit')
                 AND (v_event -> 'payload' -> 'scores' -> (v_ctx ->> 'teamAId'))
                     = (v_event -> 'payload' -> 'scores' -> (v_ctx ->> 'teamBId')) THEN 'SHOOTOUT_REQUIRED'
          END;
          IF v_shootout_violation IS NOT NULL THEN
            v_result := jsonb_build_object('id', v_event -> 'id', 'status', 'rejected', 'code', 'INVALID_PAYLOAD',
                                           'detail', jsonb_build_object('reason', v_shootout_violation));
          END IF;
        END IF;

        IF v_result ->> 'status' = 'accepted' THEN
          -- f2. A-34: freies Feld -> dieses Geraet steuert ab jetzt (Epoche +1). Die Zeile ist seit c0 gesperrt.
          IF v_claim_pending THEN
            UPDATE public.field_control fc
               SET epoch = fc.epoch + 1, holder_user_id = v_uid, holder_device_id = p_device_id,
                   holder_device_label = NULL, claimed_at = v_now
             WHERE fc.tournament_id = v_match.tournament_id AND fc.field = v_match.field
               AND fc.holder_user_id IS NULL
            RETURNING * INTO v_fc;
            v_claimed_in_call := true;
          END IF;
          -- Ruling S15/M1: hoechstens 2000 gespeicherte Engine-Ereignisse je Spiel -- danach bricht
          -- der ganze Aufruf ab (nichts gespeichert), statt das Spiel ueber statement_timeout zu treiben.
          IF v_stored_count >= 2000 THEN
            RAISE EXCEPTION 'append_match_events: Spiel % hat bereits % gespeicherte Ereignisse (Obergrenze 2000)',
              p_match_id, v_stored_count USING ERRCODE = '54000';
          END IF;
          v_stored_count := v_stored_count + 1;
          v_state := v_step -> 'state';
          -- f. Speichern (R14, R16).
          INSERT INTO public.match_events (
            id, match_id, type, team_id, player_id, timestamp_seconds, period, payload,
            score_home, score_away, event_format, recorded_at, client_time, clock_ms, section,
            target_event_id, base_seq, control_epoch)
          VALUES (
            (v_event ->> 'id')::uuid, p_match_id, v_event ->> 'type', (v_event ->> 'teamId')::uuid, NULL,
            coalesce((v_event ->> 'clockMs')::numeric, 0) / 1000.0,
            CASE v_phase_before WHEN 'overtime' THEN 'overtime' WHEN 'shootout' THEN 'penalty' ELSE 'regular' END,
            v_event -> 'payload',
            match_engine.effective_score(v_state, v_ctx ->> 'teamAId')::integer,
            match_engine.effective_score(v_state, v_ctx ->> 'teamBId')::integer,
            1, v_now, to_timestamp(v_at_server / 1000.0),
            (v_event ->> 'clockMs')::integer, (v_event ->> 'section')::smallint,
            (v_event ->> 'targetId')::uuid, v_base_seq, (v_event ->> 'controlEpoch')::integer)
          RETURNING seq INTO v_seq;

          INSERT INTO public.match_event_authors (event_id, tournament_id, user_id, device_id, base_state)
          VALUES ((v_event ->> 'id')::uuid, v_match.tournament_id, v_uid, p_device_id,
                  nullif(v_event -> 'baseState', 'null'::jsonb));

          v_last_at := v_at_eval;
          v_accepted := v_accepted + 1;
          v_started_now := v_started_now OR v_event ->> 'type' = 'MATCH_START';
          v_result := v_result || jsonb_build_object('seq', v_seq);
        ELSIF v_result ->> 'status' = 'noop' THEN
          -- g. noop wird nie gespeichert (K7).
          v_state := v_step -> 'state';
        END IF;
        END IF;  -- c2 (Serveruhr)
      END IF;
    END IF;

    v_results := v_results || jsonb_build_array(v_result);
    -- R12: abgelehnter zustandsaendernder Schritt -> Rest des Stapels DEPENDS_ON_REJECTED.
    IF v_result ->> 'status' = 'rejected' AND v_raw_type = ANY (c_cascade_types) THEN
      v_cascade := true;
    END IF;
  END LOOP;

  -- 6. Zwischenspeicher einmal je Aufruf (R15).
  IF v_accepted > 0 THEN
    v_cache := match_engine.cache_columns(v_state, v_ctx);
    UPDATE public.matches m SET
      score_a = (v_cache ->> 'score_a')::numeric::integer,
      score_b = (v_cache ->> 'score_b')::numeric::integer,
      overtime_score_a = (v_cache ->> 'overtime_score_a')::numeric::integer,
      overtime_score_b = (v_cache ->> 'overtime_score_b')::numeric::integer,
      penalty_score_a = (v_cache ->> 'penalty_score_a')::numeric::integer,
      penalty_score_b = (v_cache ->> 'penalty_score_b')::numeric::integer,
      match_status = v_cache ->> 'match_status',
      decided_by = v_cache ->> 'decided_by',
      -- A-25n (@W2A-022): wer nicht angetreten ist (nur Wertung im beendeten Spiel, sonst NULL).
      forfeit_absent = v_cache ->> 'forfeit_absent',
      timer_elapsed_seconds = (v_cache ->> 'timer_elapsed_seconds')::numeric::integer,
      timer_start_time = CASE WHEN (v_cache ->> 'running')::boolean
                              THEN to_timestamp((v_cache ->> 'anchor_at')::numeric / 1000.0) END,
      -- Pausenbeginn: bleibt stehen, solange die Uhr schon vorher stand; sonst jetzt.
      timer_paused_at = CASE WHEN (v_cache ->> 'running')::boolean OR NOT (v_cache ->> 'started')::boolean THEN NULL
                             ELSE coalesce(CASE WHEN m.timer_start_time IS NULL THEN m.timer_paused_at END, v_now) END,
      -- ZA-3 (@SL-066): ein zurueckgenommener Anpfiff setzt auch den tatsaechlichen Beginn zurueck.
      actual_start = CASE WHEN v_cache ->> 'match_status' = 'scheduled' THEN NULL
                          WHEN v_started_now THEN coalesce(m.actual_start, v_now) ELSE m.actual_start END,
      actual_end = CASE WHEN v_cache ->> 'match_status' = 'finished'
                        THEN to_timestamp(coalesce((v_cache ->> 'finished_at')::numeric, v_now_ms) / 1000.0) END,
      -- M4 (Fixrunde 1): zusammenfuehren statt ueberschreiben -- fremde Schluessel des alten
      -- Schreibwegs (z. B. refereeName) bleiben erhalten. Nicht mehr aktiv -> NULL wie bisher.
      live_state = CASE WHEN jsonb_typeof(v_cache -> 'live_state') = 'object'
                        THEN CASE WHEN jsonb_typeof(m.live_state) = 'object' THEN m.live_state ELSE '{}'::jsonb END
                             || (v_cache -> 'live_state') END,
      -- C0b-Fixrunde 1 (Review M2, PC6): SKIP -> skipped_at = at_server des SKIP (ueber at_eval,
      -- dieselbe Rundreise wie client_time), skipped_reason = payload.reason; sonst (UNSKIP) NULL.
      skipped_at = CASE WHEN jsonb_typeof(v_cache -> 'skipped_at') = 'number'
                        THEN to_timestamp((v_cache ->> 'skipped_at')::numeric / 1000.0) END,
      skipped_reason = v_cache ->> 'skipped_reason',
      version = coalesce(m.version, 0) + 1,
      last_modified_by = v_uid,
      updated_at = v_now
    WHERE m.id = p_match_id;
  END IF;

  -- 7. Antwort.
  RETURN jsonb_build_object('results', v_results,
                            'state', public.match_server_state(v_state),
                            'serverTime', v_now_ms,
                            -- A-34: Stand des Feldes aus Sicht dieses Geraets (Epoche zum Stempeln, B-49).
                            'control', public.field_control_info(v_match.tournament_id, v_match.field, p_device_id));
END;
$$;

REVOKE ALL ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.append_match_events(uuid, jsonb, integer, uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Trigger
-- ---------------------------------------------------------------------------------------------------------------

-- 6a. tournaments: Lebenszyklus-Spalten nur mit Schalter (R-EA-1, Muster A-16 A1), INSERT immer als Entwurf (K1), nach dem
--     Abschluss nur die Positivliste (R-EA-6).
CREATE OR REPLACE FUNCTION public.tournaments_guard_lifecycle() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  c_free constant text[] := ARRAY['is_public', 'share_code', 'share_code_created_at', 'version', 'updated_at',
                                  'change_revision', 'owner_id', 'config'];
  v_switch boolean := coalesce(current_setting('app.lifecycle_write', true), '') = 'on'
                      AND current_user NOT IN ('authenticated', 'anon');
  v_skip   text[];
BEGIN
  -- W3: Client-Rollen setzen status nur auf 'draft' oder 'published' (completed/live/archived schließen nichts mehr).
  IF current_user IN ('authenticated', 'anon') AND NEW.status NOT IN ('draft', 'published')
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'Nicht erlaubt: status % setzt nur der Server (Turnier %).', NEW.status, NEW.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.lifecycle_status := 'draft';
    NEW.finished_at := NULL;
    RETURN NEW;
  END IF;
  IF (NEW.lifecycle_status, NEW.finished_at) IS DISTINCT FROM (OLD.lifecycle_status, OLD.finished_at) AND NOT v_switch THEN
    RAISE EXCEPTION 'Nicht erlaubt: den Turnier-Zustand setzt nur der Server (Turnier %).', OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.lifecycle_status IN ('finished', 'cancelled') AND NOT v_switch THEN
    -- standingDecisions hält tournaments_keep_standing_decisions für Client-Rollen ohnehin auf dem Serverwert.
    v_skip := CASE WHEN current_user IN ('authenticated', 'anon') THEN ARRAY['publicScorers', 'standingDecisions']
                   ELSE ARRAY['publicScorers'] END;
    IF to_jsonb(NEW) - c_free IS DISTINCT FROM to_jsonb(OLD) - c_free
       OR coalesce(NEW.config, '{}'::jsonb) - v_skip IS DISTINCT FROM coalesce(OLD.config, '{}'::jsonb) - v_skip THEN
      RAISE EXCEPTION 'TOURNAMENT_FINISHED: Turnier ist abgeschlossen (Turnier %).', OLD.id USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tournaments_guard_lifecycle() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS tournaments_guard_lifecycle ON public.tournaments;
CREATE TRIGGER tournaments_guard_lifecycle
  BEFORE INSERT OR UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.tournaments_guard_lifecycle();

-- 6b. Festlegen folgt status (R-EA-1, W3): 'published' -> fixed; 'draft' -> draft nur ohne Anpfiff (@LZ-004).
--     Abgeschlossen/abgebrochen bleibt (die Sperre 6a lehnt status-Änderungen dann ab). SECURITY DEFINER: der Anpfiff
--     zählt über alle Spiele, unabhängig von der Lese-Policy des Aufrufers. Läuft nach 6a (alphabetisch).
CREATE OR REPLACE FUNCTION public.tournaments_lifecycle_follow_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.lifecycle_status IN ('draft', 'fixed') THEN
    IF NEW.status = 'published' THEN
      NEW.lifecycle_status := 'fixed';
    ELSIF NEW.status = 'draft'
          AND (TG_OP = 'INSERT'
               OR NOT EXISTS (SELECT 1 FROM public.matches m
                               WHERE m.tournament_id = OLD.id AND m.match_status IN ('running', 'paused', 'finished'))) THEN
      NEW.lifecycle_status := 'draft';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tournaments_lifecycle_follow_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS tournaments_lifecycle_follow_status ON public.tournaments;
CREATE TRIGGER tournaments_lifecycle_follow_status
  BEFORE INSERT OR UPDATE OF status ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.tournaments_lifecycle_follow_status();

-- 6c. Abschluss-Sperre auf den Kindtabellen (R-EA-6, Review B1/B2/B4). Argument: wie die Zeile zum Turnier führt
--     (tournament_id | match_id | team_id). Ein UPDATE, das außer is_public und den Verwaltungsspalten nichts ändert,
--     geht durch (Sichtbarkeits-Kaskade, No-op-Teil von save()). SECURITY DEFINER: der Zustand gilt unabhängig von der
--     Lese-Policy des Aufrufers.
CREATE OR REPLACE FUNCTION public.guard_closed_tournament() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_admin constant text[] := ARRAY['is_public', 'version', 'updated_at', 'change_revision', 'owner_id'];
  v_rows jsonb[];
  v_row  jsonb;
  v_tid  uuid;
  v_exists boolean;
BEGIN
  v_rows := CASE TG_OP WHEN 'INSERT' THEN ARRAY[to_jsonb(NEW)] WHEN 'DELETE' THEN ARRAY[to_jsonb(OLD)]
                       ELSE ARRAY[to_jsonb(NEW), to_jsonb(OLD)] END;
  FOREACH v_row IN ARRAY v_rows LOOP
    v_tid := CASE TG_ARGV[0]
               WHEN 'tournament_id' THEN (v_row ->> 'tournament_id')::uuid
               WHEN 'match_id' THEN (SELECT m.tournament_id FROM public.matches m WHERE m.id = (v_row ->> 'match_id')::uuid)
               WHEN 'team_id' THEN (SELECT t.tournament_id FROM public.teams t WHERE t.id = (v_row ->> 'team_id')::uuid)
             END;
    IF public.tournament_is_closed(v_tid) THEN
      IF TG_OP = 'UPDATE' AND to_jsonb(NEW) - c_admin = to_jsonb(OLD) - c_admin THEN
        RETURN NEW;
      END IF;
      -- INSERT … ON CONFLICT (save(): teams-Upsert) feuert BEFORE INSERT auch für eine schon vorhandene Zeile; dann
      -- entscheidet der UPDATE-Zweig (No-op erlaubt, Änderung abgelehnt). Ein echtes INSERT mit vorhandener id scheitert
      -- ohnehin am Primärschlüssel.
      IF TG_OP = 'INSERT' AND v_row ? 'id' THEN
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE id::text = $1)', TG_TABLE_SCHEMA, TG_TABLE_NAME)
          INTO v_exists USING v_row ->> 'id';
        IF v_exists THEN
          RETURN NEW;
        END IF;
      END IF;
      RAISE EXCEPTION 'TOURNAMENT_FINISHED: Turnier ist abgeschlossen (%, Turnier %).', TG_TABLE_NAME, v_tid
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_closed_tournament() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('matches', 'tournament_id'), ('teams', 'tournament_id'), ('team_players', 'team_id'),
      ('sponsors', 'tournament_id'), ('match_events', 'match_id'), ('match_corrections', 'match_id'),
      ('group_completions', 'tournament_id'), ('bracket_notices', 'tournament_id'),
      ('clarifications', 'tournament_id'), ('bracket_log', 'tournament_id'), ('field_control', 'tournament_id')
    ) AS x(tbl, via)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.tbl || '_guard_closed', r.tbl);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW '
                   'EXECUTE FUNCTION public.guard_closed_tournament(%L)', r.tbl || '_guard_closed', r.tbl, r.via);
  END LOOP;
END;
$$;

-- 6d. Helfer-Beitritt (R-EA-12, I-4): eine Quelle – gelöscht oder abgeschlossen/abgebrochen. status = 'completed' per
--     REST schließt den Code nicht mehr nebenbei; nach dem Wiederöffnen gilt der Code wieder. Unbekanntes Turnier =
--     geschlossen. Nur, wenn 20261110_008 eingespielt ist (sonst gibt es den Beitritt noch nicht).
DO $do$
BEGIN
  IF to_regprocedure('public.tournament_closed_for_helpers(uuid)') IS NOT NULL THEN
    EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.tournament_closed_for_helpers(p_tournament_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT coalesce((SELECT coalesce(t.deleted_at IS NOT NULL, false)
                          OR coalesce(t.lifecycle_status IN ('finished', 'cancelled'), false)
                     FROM public.tournaments t WHERE t.id = p_tournament_id), true)
$$
$fn$;
  ELSE
    RAISE NOTICE '20261113_003: tournament_closed_for_helpers fehlt (20261110_008 noch nicht eingespielt) – Rumpf nicht ersetzt';
  END IF;
END;
$do$;

COMMIT;
