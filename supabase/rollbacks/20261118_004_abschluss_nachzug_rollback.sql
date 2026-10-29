-- supabase/rollbacks/20261118_004_abschluss_nachzug_rollback.sql
-- RUECKWEG zu supabase/migrations/20261118_004_abschluss_nachzug.sql (W-M). Liegt bewusst NICHT in supabase/migrations
-- (wird nie nachgespielt). Erzeugt mit `bash scripts/abschluss-nachzug-check.sh --print-rueckweg`; belegt in
-- scripts/abschluss-nachzug-check.sh (Kategorie X: Schema danach = Stand vor der Migration).
-- Reihenfolge: ZUERST die App auf den Stand ohne W-M-Client (sie haelt den Abschluss dann wieder nur selbst auf, E5),
-- DANN dieser Block. Danach haelt die Klaerungsliste den Abschluss am Server NICHT mehr auf, und der oeffentliche
-- Endstand eines Turniers im Kindermodus ist wieder lesbar (Befunde C-ABSCHLUSS-OHNE-KLAERUNG,
-- C-ENDSTAND-KINDERMODUS-OEFFENTLICH). Keine Daten gehen verloren.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $rw$
BEGIN
  IF to_regprocedure('public.list_late_entries(uuid)') IS NULL
     OR position('W-M (a)' IN coalesce((SELECT prosrc FROM pg_proc
                                        WHERE oid = to_regprocedure('match_engine.finish_open_items(uuid)')), '')) = 0 THEN
    RAISE EXCEPTION 'Rueckweg W-M: nicht in der W-M-Fassung -- nichts geaendert';
  END IF;
END
$rw$;
-- finish_open_items und final_standings_payload woertlich aus 20261113_003_tournament_lifecycle.sql
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
REVOKE ALL ON FUNCTION match_engine.finish_open_items(uuid),
                       match_engine.final_standings_payload(public.tournaments)
  FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.list_late_entries(uuid);
COMMIT;
-- Danach: Assertions abschluss-nachzug-* + PRIVILEGE_ASSERTION_NAMES + pending_assertions_for zurueck, Drift-Check.
